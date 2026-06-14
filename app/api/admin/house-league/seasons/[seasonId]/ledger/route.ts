import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getLeagueSeasonById,
  getOrCreateLeagueSeasonLedger,
  getLedgerSummary,
  getLedgerEntries,
  getRegistrationsForSeason,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
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

  // Expected = fee × active registrants (independent of whether entries exist)
  const feePerReg    = season.registrationFee ?? 0;
  const activeCount  = regs.filter(r => r.status === 'active').length;
  const expectedTotal = feePerReg * activeCount;

  return NextResponse.json({
    ledger,
    summary,
    entries: annotatedEntries,
    expectedTotal,
    feePerReg,
    activeCount,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/ledger' });
