import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  recordRepDuesPayout,
  PayoutExceedsOwedError,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';

// ⚠ ACTIVE YEAR ONLY, deliberately (plan §10): this resolves the team's live season and cannot
// address a past one. Money moves; an archived season is a record, and the refund sheet renders
// there with no payout controls at all.
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

const METHODS = ['etransfer', 'cash', 'cheque', 'other'] as const;

// POST /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payouts
// Hand a family their credit back in cash (mig 234) — the mirror of recording a payment. Posts
// one money-out entry to the team ledger dated the day the money LEFT, and puts that family's
// bills back up: those dollars are settled now, so they stop lowering installments.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { amount, paidDate = tournamentToday(), method = 'etransfer', note = null } = body;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (amount > 999999.99) {
    return NextResponse.json({ error: 'amount is too large' }, { status: 400 });
  }
  if (typeof paidDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
    return NextResponse.json({ error: 'paidDate must be a YYYY-MM-DD date' }, { status: 400 });
  }
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
  }

  const { data: playerRow } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('id', playerId)
    .eq('program_year_id', programYear.id)
    .single();
  if (!playerRow) {
    return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });
  }
  const playerName = [playerRow.player_first_name, playerRow.player_last_name].filter(Boolean).join(' ') || 'player';

  try {
    const result = await recordRepDuesPayout({
      team: { id: team.id, orgId: team.orgId, name: team.name },
      programYearId: programYear.id,
      playerId,
      playerName,
      amount,
      paidDate,
      method,
      note: typeof note === 'string' ? note : null,
      createdBy: ctx!.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof PayoutExceedsOwedError) {
      // The ceiling rides the error — it is the figure the write actually refused against, so
      // the reason a coach reads is the reason it refused, with no second round-trip.
      const owed = e.owedBack;
      return NextResponse.json(
        {
          error: owed > 0.005
            ? `This family has $${owed.toFixed(2)} left in credit — you can't pay out more than that.`
            : 'This family has no credit left, so there is nothing to pay out.',
          code: 'PAYOUT_EXCEEDS_OWED',
          owedBack: owed,
        },
        { status: 409 },
      );
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payouts' });
