import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepDuesCreditsForPlayer,
  getRepDuesPayoutsForPlayer,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { amountsTotal, payoutCeiling } from '@/lib/dues-credits';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// DELETE /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits/[creditId]
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; creditId: string }> },) => {
  const { orgSlug, teamId, playerId, creditId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // ⚠ A CREDIT THAT HAS ALREADY BEEN PAID OUT CANNOT SIMPLY VANISH (mig 234). Removing it would
  // leave the family holding cash the books no longer say they were owed — and, at season's end,
  // that missing credit silently inflated everyone else's share of the pool (/review 2026-08-14).
  // Remove the payout first; that is the undo, and it voids the ledger line honestly.
  const [credits, payouts] = await Promise.all([
    getRepDuesCreditsForPlayer(programYear.id, playerId),
    getRepDuesPayoutsForPlayer(programYear.id, playerId),
  ]);
  // The rule, stated once: whatever credits remain must still cover what has gone out.
  const paidOut = amountsTotal(payouts);
  const creditsAfterDelete = payoutCeiling(credits.filter(c => c.id !== creditId), []);
  if (paidOut > creditsAfterDelete + 0.005) {
    return NextResponse.json(
      {
        error: `$${paidOut.toFixed(2)} has already been paid out to this family — removing this credit would leave the books owing them less than they have received. Remove the payout first.`,
        code: 'CREDIT_HAS_PAYOUT',
      },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin
    .from('rep_dues_credits')
    .delete()
    .eq('id', creditId)
    .eq('player_id', playerId)
    .eq('program_year_id', programYear.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits/[creditId]' });
