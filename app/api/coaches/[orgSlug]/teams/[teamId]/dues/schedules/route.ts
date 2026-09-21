import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { getFamilyPaymentSchedules } from '@/lib/sponsor-arrivals-server';

/**
 * GET /api/coaches/[orgSlug]/teams/[teamId]/dues/schedules
 *
 * Every family's CURRENT payment schedule, positions and dates and amounts only — the raw
 * material of the "Applies to" picker on a sponsorship's credit families (Sponsorship Applies
 * To, owner rulings D1–D8, 2026-09-21) and of the D4 "check the payments" cue.
 *
 * ⚠ DELIBERATELY NOT THE DUES GET. That route computes every family's whole position (payments,
 * credits, payouts, the three-pass landing) so a picker that only needs "which payments exist"
 * would pay for arithmetic it never reads, on two doors (the pledge form and the sponsor's room).
 * Same read the writer validates against (`resolveArrangements`), so the list the coach ticks and
 * the list the server checks can never disagree.
 *
 * Live season only (no year parameter — the endpoint guard): an arrangement is an instrument.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const schedules = await getFamilyPaymentSchedules(programYear.id);
  return NextResponse.json({
    // The team default, for the line's wording — the same field the dues GET returns.
    creditApplication: programYear.creditApplication,
    families: [...schedules.values()].map(f => ({
      playerId: f.playerId,
      installments: f.installments,
      lastRunAt: f.lastRunAt,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues/schedules' });
