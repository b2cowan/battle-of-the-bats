import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear,
  getRepPlayerDuesSchedule, getRepPlayerDuesInstallments, getRepDuesCreditsForPlayer,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { MANUAL_CREDIT_TYPES } from '@/lib/dues-credits';
import { SCHEDULE_CHANGE_CREDIT_DESCRIPTION, RESERVED_CREDIT_DESCRIPTION_REFUSAL } from '@/lib/dues-payments';
import { adjustmentCeilingViolation, adjustmentCeilingMessage, ADJUSTMENT_EXCEEDS_CEILING } from '@/lib/dues-credit-guards';

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

// GET /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('*')
    .eq('program_year_id', programYear.id)
    .eq('player_id', playerId)
    .order('credit_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const credits = (data ?? []).map((r: Record<string, unknown>) => ({
    id:            r.id,
    programYearId: r.program_year_id,
    playerId:      r.player_id,
    amount:        r.amount,
    description:   r.description,
    creditDate:    r.credit_date,
    creditType:    r.credit_type,
    notes:         r.notes ?? null,
    createdAt:     r.created_at,
  }));

  return NextResponse.json({ credits });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits' });

// POST /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { amount, description, creditType = 'other', creditDate, notes = null } = body;

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  // The engine recognizes its own row by this exact sentence — a hand-made credit wearing it
  // would be locked and then silently rewritten by the next reconcile (see the constant's home).
  if (description.trim() === SCHEDULE_CHANGE_CREDIT_DESCRIPTION) {
    return NextResponse.json({ error: RESERVED_CREDIT_DESCRIPTION_REFUSAL }, { status: 400 });
  }
  if (!creditDate) {
    return NextResponse.json({ error: 'creditDate is required' }, { status: 400 });
  }
  /* ⚠ THE PICKER READS THIS SAME LIST (money centralization P3, 2026-08-25). It was a literal
     here and the whole display map on the screen, so the Add-credit form offered two kinds this
     very line then refused with a bare 400 — see MANUAL_CREDIT_TYPES' header for the whole
     story. */
  if (!MANUAL_CREDIT_TYPES.includes(creditType)) {
    return NextResponse.json({ error: 'Invalid creditType' }, { status: 400 });
  }

  // Verify player belongs to this program year
  const { data: playerRow } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id')
    .eq('id', playerId)
    // ⚠ NOT A CALL-UP (mig 309). Money never attaches to a borrowed player: they have no dues, no
    // share and no payout. This route proves the player with a RAW query rather than
    // `getRepRosterPlayer` (which refuses one), so the exclusion has to be spelled here — a crafted
    // request could otherwise land a real money row on a call-up, and the money screens then never
    // show it, because they exclude call-ups. Found by `/review`.
    .eq('program_year_id', programYear.id)
    .neq('status', 'callup')
    .single();

  if (!playerRow) {
    return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });
  }

  /* ⚠⚠ THE ADJUSTMENT CEILING IS THE BILL (owner ruling 2026-09-11, corrected 2026-09-12) — see
     lib/dues-credit-guards.ts. The bill minus what is already written off it; payments, payouts
     and the team's credit mode play no part. MANUAL_CREDIT_TYPES is `['other']` today, so this
     always fires here; the `=== 'other'` guard stays explicit so a future kind added to that list
     is not silently capped without a decision. */
  if (creditType === 'other') {
    const schedule = await getRepPlayerDuesSchedule(playerId, programYear.id);
    const [installments, existingCredits] = await Promise.all([
      schedule ? getRepPlayerDuesInstallments(schedule.id) : Promise.resolve([]),
      getRepDuesCreditsForPlayer(programYear.id, playerId),
    ]);
    const violation = adjustmentCeilingViolation(amount, { installments, credits: existingCredits });
    if (violation) {
      return NextResponse.json(
        { error: adjustmentCeilingMessage(violation.ceiling), code: ADJUSTMENT_EXCEEDS_CEILING },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from('rep_dues_credits')
    .insert({
      program_year_id: programYear.id,
      player_id:       playerId,
      amount:          Math.round(amount * 100) / 100,
      description:     description.trim(),
      credit_type:     creditType,
      credit_date:     creditDate,
      notes:           notes?.trim() || null,
      created_by:      ctx.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* ⚠ RE-CHECK AGAINST THE TRUE POST-WRITE STATE (mirrors the PATCH route's payout-floor
     re-check). Two concurrent Adjustment adds can each pass the pre-check against the same stale
     "room left" reading and together overshoot it — rare, but the undo is cheap: delete the row
     we just wrote and say why, exactly as a fresh request would have been refused. */
  if (creditType === 'other') {
    const schedule = await getRepPlayerDuesSchedule(playerId, programYear.id);
    const [installments, freshCredits] = await Promise.all([
      schedule ? getRepPlayerDuesInstallments(schedule.id) : Promise.resolve([]),
      getRepDuesCreditsForPlayer(programYear.id, playerId),
    ]);
    const stillSafe = adjustmentCeilingViolation(amount, {
      installments,
      credits: freshCredits.filter(c => c.id !== data.id),
    });
    if (stillSafe) {
      await supabaseAdmin.from('rep_dues_credits').delete().eq('id', data.id);
      return NextResponse.json(
        { error: adjustmentCeilingMessage(stillSafe.ceiling), code: ADJUSTMENT_EXCEEDS_CEILING },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({
    credit: {
      id:            data.id,
      programYearId: data.program_year_id,
      playerId:      data.player_id,
      amount:        data.amount,
      description:   data.description,
      creditDate:    data.credit_date,
      creditType:    data.credit_type,
      notes:         data.notes ?? null,
      createdAt:     data.created_at,
    },
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits' });
