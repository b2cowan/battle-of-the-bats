import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import {
  getLeagueSeasonById,
  getOrCreateLeagueSeasonLedger,
  getLedgerSummary,
  getLedgerEntries,
  getRegistrationsForSeason,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { registrationOwes } from '@/lib/league-price';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  // Money: everyone who opens house league, and whoever holds the club's Accounting (the treasurer, Q17).
  const err = houseLeagueRefusal(ctx, 'readMoney');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const ledger = await getOrCreateLeagueSeasonLedger(ctx!.org.id, seasonId, season.name);
  const [summary, entries, regs] = await Promise.all([
    getLedgerSummary(ledger),
    getLedgerEntries(ledger.id),
    getRegistrationsForSeason(seasonId),
  ]);

  // Build a lookup map for registration details
  const regMap = new Map(regs.map(r => [r.id, r]));

  // Annotate entries with player info from the registration
  const annotatedEntries = entries.map(e => {
    const reg = e.sourceModule === 'league_registration' && e.sourceEntityId
      ? regMap.get(e.sourceEntityId)
      : undefined;
    return {
      ...e,
      playerFirstName: reg?.playerFirstName ?? null,
      playerLastName:  reg?.playerLastName  ?? null,
      divisionId:      reg?.divisionId      ?? null,
      registrationId:  reg?.id              ?? null,
    };
  });

  // Expected = what each active registrant owes, summed (independent of whether entries exist). Each child's price is the
  // one recorded at sign-up (Club Tier 9b-1, lib/league-price.ts), so prices can differ: feePerReg is the one price they all
  // owe, or null when they differ.
  const active        = regs.filter(r => r.status === 'active');
  const owed          = active.map(r => registrationOwes(r, season) ?? 0);
  const activeCount   = active.length;
  const expectedTotal = owed.reduce((s, n) => s + n, 0);
  const feePerReg: number | null = activeCount === 0 ? (season.registrationFee ?? 0)
    : owed.every(n => n === owed[0]) ? owed[0] : null;

  return NextResponse.json({
    ledger,
    summary,
    entries: annotatedEntries,
    expectedTotal,
    feePerReg,
    activeCount,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/ledger' });
