import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear, recordRepDuesPayment } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';

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

// POST /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments
// Record a dues payment FACT (mig 232): what arrived, when, how much. Posts one income entry to
// the team ledger dated the day the money ARRIVED (owner ruling 3), allocates oldest-first, and
// auto-credits any amount beyond everything left on the schedule (ruling 5 — no prompt).
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { amount, receivedDate = tournamentToday(), method = 'other', note = null } = body;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (amount > 999999.99) {
    return NextResponse.json({ error: 'amount is too large' }, { status: 400 });
  }
  if (typeof receivedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
    return NextResponse.json({ error: 'receivedDate must be a YYYY-MM-DD date' }, { status: 400 });
  }
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
  }

  // Verify the player belongs to this program year (and get the name the ledger line carries —
  // the old mark-paid entries said only "installment #2" and were untraceable in the books).
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
    const result = await recordRepDuesPayment({
      team: { id: team.id, orgId: team.orgId, name: team.name },
      programYearId: programYear.id,
      playerId,
      playerName,
      amount,
      receivedDate,
      method,
      note: typeof note === 'string' ? note : null,
      createdBy: ctx!.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === 'NO_SCHEDULE') {
      return NextResponse.json(
        { error: 'This player has no dues schedule yet — set their dues first, then record what arrived.' },
        { status: 400 },
      );
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments' });
