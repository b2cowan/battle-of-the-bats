import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getDivisionsForSeason, getLeagueSeasonById, getRegistrationsForSeason } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { seasonCharges } from '@/lib/league-price';
import { feeState, isOwing, seasonMoney } from '@/lib/league-money';
import { filesToClubStatement, loadSeasonMoneyLines } from '@/lib/league-money-read';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAll } from '@/lib/supabase-paging';
import { loadCardRefunds, loadRegistrationDebits } from '@/lib/league-pay-facts';
import { isBank, isShown, refundBase, refundState } from '@/lib/league-card-refunds';

/** The season book's card costs (12b, mig 374: source 'online_payment'), newest first. */
async function seasonProcessingLines(orgId: string, seasonId: string): Promise<Array<{ id: string; day: string; amount: number; description: string; createdAt: string }>> {
  const { data: book } = await supabaseAdmin.from('accounting_ledgers').select('id')
    .eq('org_id', orgId).eq('entity_type', 'league_season').eq('entity_id', seasonId).maybeSingle();
  if (!book) return [];
  // Paged, as every book read here (/review: a large season passes the 1,000-row default).
  const data = await fetchAll<Record<string, unknown>>((from, to) => supabaseAdmin.from('accounting_entries')
    .select('id, entry_date, amount, description, created_at')
    .eq('ledger_id', book.id as string).eq('source_module', 'online_payment').eq('status', 'posted')
    .order('entry_date', { ascending: false }).order('id').range(from, to));
  return data.map(r => ({ id: r.id as string, day: r.entry_date as string, amount: Number(r.amount), description: (r.description as string) ?? '', createdAt: r.created_at as string }));
}
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

  const [regs, divisions, lines, changes, processing] = await Promise.all([
    getRegistrationsForSeason(seasonId),
    getDivisionsForSeason(seasonId),
    loadSeasonMoneyLines(ctx!.org.id, seasonId),
    supabaseAdmin.from('league_registration_price_changes')
      .select('id, registration_id, kind, old_amount, new_amount, reason, refund_entry_id, changed_at')
      .eq('org_id', ctx!.org.id).eq('season_id', seasonId).order('changed_at', { ascending: false }),
    seasonProcessingLines(ctx!.org.id, seasonId),
  ]);
  if (changes.error) throw changes.error;
  // 12c words §3: a refund line that went to the card says so (and how it stands); one that never entered the book is
  // named under the Refunds list.
  const cardRefunds = Object.values(await loadCardRefunds(ctx!.org.id, regs.map(r => r.id))).flat().filter(isShown);
  const cardByEntry = new Map(cardRefunds.filter(r => r.entryId).map(r => [r.entryId as string, r]));

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
      kind: l.status === 'void' ? 'voided' as const : l.returned ? 'returned' as const : l.dir === 'out' ? 'refund' as const : 'fee' as const,
      refundWhy: why,
      priceKind: l.dir === 'in' ? (correctedRegs.has(l.regId) ? 'corrected' : 'regular') : null,
      note: l.note, createdAt: l.createdAt,
      card: (() => {
        const c = l.dir === 'out' ? cardByEntry.get(l.id) : undefined;
        return c ? { state: refundState(c), bank: isBank(c), stripe: c.origin === 'stripe_dashboard' } : null;
      })(),
    };
  });
  // 12b (drawn m1): the season's card costs — a club-paid processing fee, a fee given back on a refund. A cost on the
  // book, never a fee or a refund (the Statement files them under Payment processing).
  const costs = processing.map(p => ({
    id: p.id, regId: '', player: null, day: p.day, amount: p.amount, method: 'online_card', receiptNo: null,
    kind: 'processing' as const, refundWhy: null, priceKind: null, note: p.description, createdAt: p.createdAt, card: null,
  }));
  const bookAll = [...book, ...costs].sort((a, b) => (a.day === b.day ? b.createdAt.localeCompare(a.createdAt) : b.day.localeCompare(a.day)));

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

  // 12c Part 6: each child's fee on a bank debit on its way (the band's Clearing), and Received by rail.
  const debits = await loadRegistrationDebits(ctx!.org.id, regs.map(r => r.id));
  const activeIds = new Set(regs.filter(r => r.status === 'active').map(r => r.id));
  const clearingCents = new Map(Object.entries(debits).filter(([id, d]) => d.state === 'clearing' && activeIds.has(id)).map(([id, d]) => [id, d.shareCents]));
  const { data: reversedRows } = await supabaseAdmin.from('online_payment_items')
    .select('registration_id, online_payments!inner(receipt_no, return_reason, reversed_at, status, rail, stripe_dispute_id)')
    .in('registration_id', regs.map(r => r.id)).eq('online_payments.status', 'reversed');
  // 12d-1 Part 3 (words §1.5): a CARD payment is reversed only by a lost dispute — its line says so, with the
  // cardholder's reason mapped (or none), never the bank-debit words.
  const reversedOps = ((reversedRows ?? []) as Array<Record<string, unknown>>)
    .map(x => (Array.isArray(x.online_payments) ? x.online_payments[0] : x.online_payments) as Record<string, unknown>);
  const lostIds = reversedOps.filter(o => o.rail === 'card' && o.stripe_dispute_id).map(o => o.stripe_dispute_id as string);
  const { data: lostRows } = lostIds.length
    ? await supabaseAdmin.from('online_payment_disputes').select('stripe_dispute_id, reason').in('stripe_dispute_id', lostIds)
    : { data: [] };
  const lostReason = new Map(((lostRows ?? []) as Array<{ stripe_dispute_id: string; reason: string | null }>).map(d => [d.stripe_dispute_id, d.reason]));
  const reversedOf = new Map<string, { receiptNo: number | null; reason: string | null; at: string; disputeLost: boolean }>();
  for (const x of (reversedRows ?? []) as Array<Record<string, unknown>>) {
    const op = (Array.isArray(x.online_payments) ? x.online_payments[0] : x.online_payments) as Record<string, unknown>;
    const prev = reversedOf.get(x.registration_id as string);
    if (prev && prev.at >= String(op.reversed_at)) continue;
    const card = op.rail === 'card';
    reversedOf.set(x.registration_id as string, {
      receiptNo: op.receipt_no != null ? Number(op.receipt_no) : null, at: String(op.reversed_at), disputeLost: card,
      reason: card ? lostReason.get(op.stripe_dispute_id as string) ?? null : (op.return_reason as string | null) ?? null,
    });
  }
  // 12d-1 Part 3 (words §1.5 `band.disputed`): open card disputes on this season's payments, and what Stripe holds.
  const { data: openDisputes } = await supabaseAdmin.from('online_payment_disputes')
    .select('held, online_payments!inner(season_id)').eq('org_id', ctx!.org.id).eq('online_payments.season_id', seasonId)
    // A dispute, never an inquiry: an inquiry took nothing and puts nothing at risk (/review 2026-10-27).
    .in('status', ['needs_response', 'under_review']);
  const disputed = {
    n: (openDisputes ?? []).length,
    held: Math.round(((openDisputes ?? []) as Array<{ held: number }>).reduce((s, d) => s + Number(d.held) * 100, 0)) / 100,
  };
  const onlineOf = (method: string) => Math.round([...lines.values()].flat()
    .filter(l => l.status === 'posted' && l.method === method)
    .reduce((sum, l) => sum + (l.dir === 'in' ? l.amount : -l.amount), 0) * 100) / 100;

  return NextResponse.json({
    season: { id: season.id, name: season.name, status: season.status, owingAmberDays: season.owingAmberDays },
    free: !seasonCharges(divisions, season),
    // Club plan: fees also file on the club's Budget vs. Actual; League Plus: this page is the book (Q15).
    filesToStatement: filesToClubStatement(ctx!.org),
    band: seasonMoney(regs, season, lines, clearingCents),
    // 12b copy §8 / 12c words §3.4: how much of Received came by card, and by bank debit (posted receipts less refunds and
    // returned lines) — the band's note.
    byCard: onlineOf('online_card'),
    byBank: onlineOf('online_bank'),
    // 12c Part 6: a returned line names the receipt the bank took back, and the bank's reason (words §3.5) — read from the
    // reversed payments themselves, not the child's newest payment (review: a later payment hid it).
    lines: bookAll.map(l => (l.kind === 'returned'
      ? { ...l, receiptNo: reversedOf.get(l.regId)?.receiptNo ?? null, returnReason: reversedOf.get(l.regId)?.reason ?? null,
        disputeLost: reversedOf.get(l.regId)?.disputeLost ?? false } : l)),
    disputed,
    neverBooked: cardRefunds.filter(r => !r.entryId && !r.inBook && r.regId).map(r => ({
      regId: r.regId as string, player: name(r.regId as string) ?? '—', amount: r.amount, base: refundBase(r), feeBack: r.feeBack,
      day: orgDayKey(r.succeededAt ?? r.createdAt),
    })),
    history,
    // 12c Part 6: what is clearing is on its way, not owing (the band adds up the same way).
    owing: owing.flatMap(o => {
      const left = Math.round(o.owing * 100) - (clearingCents.get(o.regId) ?? 0);
      return left > 0 ? [{ ...o, owing: left / 100 }] : [];
    }),
    today,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/ledger' });
