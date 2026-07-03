import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

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

interface InstallmentInput {
  installmentNumber: number;
  dueDate: string;
  amount: number;
}

interface PlayerOverride {
  playerId: string;
  installments: InstallmentInput[];
}

// POST /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/generate-installments
// Body: {
//   installments: InstallmentInput[],   // default schedule for all players
//   overrides?: PlayerOverride[],        // per-player adjustments (optional)
// }
//
// Creates one rep_player_dues_schedule + N rep_player_dues_installments per active
// roster player. Uses source='budget_generated' to distinguish from manual schedules.
// Blocked if budget-generated installments already exist for this program year.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Block double-generation
  const existingSchedules = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id')
    .eq('program_year_id', programYear.id);

  const scheduleIds = (existingSchedules.data ?? []).map((s: { id: string }) => s.id);
  if (scheduleIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('id', { count: 'exact', head: true })
      .in('schedule_id', scheduleIds)
      .eq('source', 'budget_generated');

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Budget-generated installments already exist for this program year. Delete them before regenerating.' },
        { status: 409 },
      );
    }
  }

  const body = await req.json();
  const defaultInstallments: InstallmentInput[] = body.installments ?? [];
  const overrides: PlayerOverride[]             = body.overrides    ?? [];

  if (defaultInstallments.length === 0) {
    return NextResponse.json({ error: 'installments array is required and must not be empty' }, { status: 400 });
  }

  for (const inst of defaultInstallments) {
    if (!inst.dueDate || typeof inst.amount !== 'number' || inst.amount <= 0) {
      return NextResponse.json({ error: 'Each installment must have a dueDate and a positive amount' }, { status: 400 });
    }
  }

  const totalPerPlayer = defaultInstallments.reduce((s, i) => s + i.amount, 0);

  // Fetch active roster
  const { data: players, error: rosterErr } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name, org_id')
    .eq('program_year_id', programYear.id)
    .eq('status', 'active');

  if (rosterErr || !players || players.length === 0) {
    return NextResponse.json({ error: 'No active roster players found.' }, { status: 400 });
  }

  const overrideMap = new Map(overrides.map(o => [o.playerId, o.installments]));

  // Create all schedules and installments in sequence
  let totalCreated = 0;

  for (const player of players) {
    const playerInstallments = overrideMap.get(player.id) ?? defaultInstallments;
    const playerTotal = playerInstallments.reduce((s, i) => s + i.amount, 0);

    // Upsert schedule (one per player per year)
    const { data: schedule, error: schedErr } = await supabaseAdmin
      .from('rep_player_dues_schedules')
      .upsert(
        {
          program_year_id: programYear.id,
          player_id:       player.id,
          team_id:         team.id,
          org_id:          ctx!.org.id,
          total_amount:    playerTotal,
          notes:           'Generated from budget plan',
        },
        { onConflict: 'program_year_id,player_id' },
      )
      .select('id')
      .single();

    if (schedErr || !schedule) continue;

    const installmentRows = playerInstallments.map(inst => ({
      schedule_id:        schedule.id,
      player_id:          player.id,
      installment_number: inst.installmentNumber,
      amount:             inst.amount,
      due_date:           inst.dueDate,
      source:             'budget_generated' as const,
      org_id:             ctx!.org.id,
      team_id:            team.id,
    }));

    await supabaseAdmin.from('rep_player_dues_installments').insert(installmentRows);
    totalCreated += installmentRows.length;
  }

  return NextResponse.json({
    created: true,
    playersProcessed: players.length,
    installmentsCreated: totalCreated,
    totalPerPlayer,
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/generate-installments' });
