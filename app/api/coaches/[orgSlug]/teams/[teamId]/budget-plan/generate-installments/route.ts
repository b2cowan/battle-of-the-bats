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
//   replace?: boolean,                   // rewrite an existing schedule (see below)
// }
//
// Creates one rep_player_dues_schedule + N rep_player_dues_installments per active
// roster player. Uses source='budget_generated' to distinguish from manual schedules.
//
// ── Re-running (owner ruling 2026-08-13) ─────────────────────────────────────────────────────
// Without `replace` this still refuses once a schedule exists, so nothing overwrites dues by
// accident. With `replace: true` it rewrites — but ONLY for players who have paid nothing.
//
// ⚠ That exception is the entire safety property here, and it is not theoretical: the "Set dues
// for all players" flow this endpoint replaced deleted every installment for a player, PAID ones
// with their accounting_entry_id included, silently destroying the record of money already
// collected. A player with any paid installment is skipped whole and reported back in
// `playersSkipped` so the coach is told rather than left to discover it.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const defaultInstallments: InstallmentInput[] = body.installments ?? [];
  const overrides: PlayerOverride[]             = body.overrides    ?? [];
  const replace: boolean                        = body.replace === true;

  // Existing schedules for this season, and which of them have money against them. Both are
  // needed before anything is written: the first decides create-vs-replace, the second decides
  // which players are off-limits.
  const existingSchedules = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, player_id')
    .eq('program_year_id', programYear.id);

  const scheduleRows  = (existingSchedules.data ?? []) as { id: string; player_id: string }[];
  const scheduleIds   = scheduleRows.map(s => s.id);
  const scheduleByPlayer = new Map(scheduleRows.map(s => [s.player_id, s.id]));
  /** Players with at least one PAID installment — never rewritten, never deleted. */
  const paidPlayerIds = new Set<string>();
  let existingInstallmentCount = 0;

  if (scheduleIds.length > 0) {
    const { data: instRows } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('player_id, paid_at')
      .in('schedule_id', scheduleIds);

    for (const row of (instRows ?? []) as { player_id: string; paid_at: string | null }[]) {
      existingInstallmentCount += 1;
      if (row.paid_at) paidPlayerIds.add(row.player_id);
    }
  }

  // ⚠ This refusal is a QUESTION for the client, not a dead end, so it carries a code.
  //
  // The client used to decide `replace` for itself from the budget plan's `hasInstallments`,
  // which counts only source='budget_generated'. A roster with any hand-set schedule therefore
  // reported "nothing here", sent replace:false, and landed on this 409 quoting an option no
  // screen offered — permanently, and by the commonest route in the product, since per-player
  // dues and bulk dues sit on the same page. The code lets the modal turn this into "replace
  // what's there?" with the coach's form still intact.
  if (existingInstallmentCount > 0 && !replace) {
    return NextResponse.json(
      {
        error: 'This roster already has a dues schedule.',
        code: 'ALREADY_HAS_DUES',
        playersWithDues:     new Set(scheduleRows.map(s => s.player_id)).size,
        playersWithPayments: paidPlayerIds.size,
      },
      { status: 409 },
    );
  }

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
  let playersSkipped = 0;
  let playersProcessed = 0;
  /** Players whose dues could not be written. NAMED, not counted — see the response note. */
  const playersFailed: string[] = [];
  const nameOf = (p: { player_first_name: string | null; player_last_name: string | null }) =>
    [p.player_first_name, p.player_last_name].filter(Boolean).join(' ').trim() || 'Unnamed player';

  for (const player of players) {
    // The money guard. A player who has paid anything keeps the schedule that payment was made
    // against — rewriting it would strand a recorded payment against an installment that no
    // longer exists. They are counted so the coach hears about it.
    if (replace && paidPlayerIds.has(player.id)) { playersSkipped += 1; continue; }

    const playerInstallments = overrideMap.get(player.id) ?? defaultInstallments;
    const playerTotal = playerInstallments.reduce((s, i) => s + i.amount, 0);

    // ⚠ ORDER IS LOAD-BEARING: secure the schedule row FIRST, delete only once it succeeded.
    //
    // Supabase gives us no transaction here, so the delete and the insert cannot be made atomic
    // — but the window can be made as small as possible and never opened for nothing. Deleting
    // before the upsert (as this did originally) meant a failed upsert wiped a player's dues and
    // wrote nothing back, and that player was then dropped from BOTH counters, so the coach was
    // told about a roster that was quietly one player short.
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

    // Nothing has been deleted yet, so this player is simply untouched — their old schedule (if
    // any) still stands. Reported, never swallowed.
    if (schedErr || !schedule) { playersFailed.push(nameOf(player)); continue; }

    // Now clear the old rows: installment_number is unique per schedule, so an insert over the
    // top would collide rather than supersede. Safe — every player reaching this line has paid
    // nothing (the guard above), so no paid row and no accounting entry is in reach.
    if (replace) {
      const { error: delErr } = await supabaseAdmin
        .from('rep_player_dues_installments')
        .delete()
        .eq('schedule_id', schedule.id);
      if (delErr) { playersFailed.push(nameOf(player)); continue; }
    }

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

    // ⚠ THE RESULT OF THIS INSERT IS THE WHOLE POINT. It used to be discarded, and the counters
    // incremented regardless — so a failure here (a unique-key collision from a double submit, a
    // transient error) left a player holding a total_amount with no installments behind it while
    // the coach was told "✓ Dues set for N players". On a replace that is silent data loss: the
    // old rows are already gone. A failure is now surfaced with the player's name.
    const { error: insErr } = await supabaseAdmin.from('rep_player_dues_installments').insert(installmentRows);
    if (insErr) { playersFailed.push(nameOf(player)); continue; }

    totalCreated += installmentRows.length;
    playersProcessed += 1;
  }

  // playersProcessed + playersSkipped + playersFailed.length === players.length, always. The
  // client states each bucket; a roster that silently didn't add up was the defect being fixed.
  return NextResponse.json({
    created: true,
    playersProcessed,
    playersSkipped,
    playersFailed,
    installmentsCreated: totalCreated,
    totalPerPlayer,
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/generate-installments' });
