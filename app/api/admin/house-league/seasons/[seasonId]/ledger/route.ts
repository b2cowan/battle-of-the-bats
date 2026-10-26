import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getDivisionsForSeason, getLeagueSeasonById, getRegistrationsForSeason } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { seasonCharges } from '@/lib/league-price';
import { feeState, isOwing, seasonMoney } from '@/lib/league-money';
import { filesToClubStatement, loadSeasonMoneyLines } from '@/lib/league-money-read';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { daysBetweenDateStrings, orgDayKey, tournamentToday } from '@/lib/timezone';

/**
 * THE SEASON'S MONEY — its book (Club Tier Stage 9b-2 Part 4; owner Q15, Q18, 9b·10; copy §10). Read by everyone who opens
 * house league AND by whoever holds the club's Accounting (the treasurer, Q17), so it asks the one gate's `readMoney` and
 * carries the season's name itself (a treasurer cannot read the season). Open after Complete (Q16): money arrives late.
 *
 * Owed · Received (net of refunds) · Still owing are lib/league-money.ts `seasonMoney` — the frozen prices of accepted
 * registrations and the book's posted lines — so this page, the Overview's tiles and Registrations can never disagree.
 * ⚰ The old "Outstanding" (pending ledger entries, always $0.00 — F14) is gone and shown nowhere.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'readMoney');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const [regs, divisions, lines, changes] = await Promise.all([
    getRegistrationsForSeason(seasonId),
    getDivisionsForSeason(seasonId),
    loadSeasonMoneyLines(ctx!.org.id, seasonId),
    supabaseAdmin.from('league_registration_price_changes')
      .select('id, registration_id, kind, old_amount, new_amount, reason, refund_entry_id, changed_at')
      .eq('org_id', ctx!.org.id).eq('season_id', seasonId).order('changed_at', { ascending: false }),
  ]);
  if (changes.error) throw changes.error;

  const today = tournamentToday();
  const regById = new Map(regs.map(r => [r.id, r]));
  const divName = new Map(divisions.map(d => [d.id, d.name]));
  const name = (id: string) => { const r = regById.get(id); return r ? `${r.playerFirstName} ${r.playerLastName}` : null; };
  const corrections = (changes.data ?? []).filter(c => c.kind === 'corrected');
  const correctedRegs = new Set(corrections.map(c => c.registration_id as string));
  const refundForCorrection = new Set(corrections.map(c => c.refund_entry_id as string | null).filter(Boolean));

  // Every line in the season's book, newest first, with what it was (copy §10.2 "What").
  const book = [...lines.values()].flat().map(l => {
    const reg = regById.get(l.regId);
    const why = l.dir === 'out'
      ? refundForCorrection.has(l.id) ? 'corrected'
        : reg?.status === 'declined' ? 'declined'
        : reg?.status === 'withdrawn' ? (reg.spotReleased ? 'released' : 'withdrawn')
        : 'corrected'
      : null;
    return {
      id: l.id, regId: l.regId, player: name(l.regId), day: l.day, amount: l.amount, method: l.method, receiptNo: l.receiptNo ?? null,
      kind: l.status === 'void' ? 'voided' as const : l.dir === 'out' ? 'refund' as const : 'fee' as const,
      refundWhy: why,
      priceKind: l.dir === 'in' ? (correctedRegs.has(l.regId) ? 'corrected' : 'regular') : null,
      note: l.note, createdAt: l.createdAt,
    };
  }).sort((a, b) => (a.day === b.day ? b.createdAt.localeCompare(a.createdAt) : b.day.localeCompare(a.day)));

  // The history lines that move no money: corrections, and fees the club kept on an ending.
  const history = [
    ...corrections.map(c => ({
      kind: 'corrected' as const, regId: c.registration_id as string, player: name(c.registration_id as string),
      at: c.changed_at as string, oldAmount: c.old_amount != null ? Number(c.old_amount) : null, newAmount: Number(c.new_amount),
      reason: (c.reason as string | null) ?? '',
    })),
    ...regs.filter(r => r.endMoney === 'kept' && r.endedAt).map(r => ({
      kind: 'kept' as const, regId: r.id, player: `${r.playerFirstName} ${r.playerLastName}`, at: r.endedAt as string,
      oldAmount: null, newAmount: 0, reason: r.endMoneyReason ?? '',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // The Still owing tab lists players, not lines (copy §10.2).
  const owing = regs.flatMap(r => {
      const s = feeState(r, season, lines.get(r.id) ?? [], today);
      if (!isOwing(s)) return [];
      // Owing since acceptance — a part-paid child too (its fee cell shows no count, but this list is how long they've owed).
      const acceptedDay = r.acceptedAt ? orgDayKey(r.acceptedAt) : null;
      const days = acceptedDay ? Math.max(0, daysBetweenDateStrings(acceptedDay, today)) : null;
      return [{
        regId: r.id, player: `${r.playerFirstName} ${r.playerLastName}`,
        division: r.divisionId ? divName.get(r.divisionId) ?? null : null,
        owing: s.owing,
        acceptedDay, days, late: days != null && days >= season.owingAmberDays,
      }];
    })
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return NextResponse.json({
    season: { id: season.id, name: season.name, status: season.status, owingAmberDays: season.owingAmberDays },
    free: !seasonCharges(divisions, season),
    // Club plan: fees also file on the club's Budget vs. Actual; League Plus: this page is the book (Q15).
    filesToStatement: filesToClubStatement(ctx!.org),
    band: seasonMoney(regs, season, lines),
    // 12b copy §8: how much of Received came by card (posted card receipts less card refunds).
    byCard: Math.round([...lines.values()].flat()
      .filter(l => l.status === 'posted' && l.method === 'online_card')
      .reduce((sum, l) => sum + (l.dir === 'in' ? l.amount : -l.amount), 0) * 100) / 100,
    lines: book,
    history,
    owing,
    today,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/ledger' });
