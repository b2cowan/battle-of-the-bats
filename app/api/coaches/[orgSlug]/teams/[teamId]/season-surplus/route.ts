import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear, getRepRosterPlayers } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === teamId)) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, programYear };
}

async function buildRefundBreakdown(programYearId: string, totalSurplus: number) {
  // Load active roster players
  const rosterPlayers = await getRepRosterPlayers(programYearId);
  const activePlayers = rosterPlayers.filter(p => p.status === 'active');
  const playerCount = activePlayers.length;

  if (playerCount === 0) return { breakdown: [], totalAllCredits: 0, evenPool: totalSurplus, playerCount: 0 };

  // Load all credits for this program year
  const { data: allCredits } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('player_id, amount')
    .eq('program_year_id', programYearId);

  // Load dues schedules for rolling balance calculation
  const { data: schedules } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, player_id, total_amount')
    .eq('program_year_id', programYearId);

  // Load paid installments
  const { data: paidInst } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .select('schedule_id, amount')
    .not('paid_at', 'is', null);

  // Build schedule map
  const scheduleMap = new Map<string, { totalAmount: number; scheduleId: string }>();
  for (const s of (schedules ?? []) as Array<{ id: string; player_id: string; total_amount: number }>) {
    scheduleMap.set(s.player_id, { totalAmount: s.total_amount, scheduleId: s.id });
  }

  // Build paid map: scheduleId → total paid
  const paidMap = new Map<string, number>();
  for (const inst of (paidInst ?? []) as Array<{ schedule_id: string; amount: number }>) {
    paidMap.set(inst.schedule_id, (paidMap.get(inst.schedule_id) ?? 0) + inst.amount);
  }

  // Build credits map per player
  const creditMap = new Map<string, number>();
  for (const c of (allCredits ?? []) as Array<{ player_id: string; amount: number }>) {
    creditMap.set(c.player_id, (creditMap.get(c.player_id) ?? 0) + c.amount);
  }

  // Total individual credits (sum of all player credits)
  const totalAllCredits = Math.round(
    [...creditMap.values()].reduce((s, v) => s + v, 0) * 100,
  ) / 100;

  // Even pool = surplus minus the portion already accounted for by individual credits
  const evenPool = Math.max(0, Math.round((totalSurplus - totalAllCredits) * 100) / 100);
  const evenShare = playerCount > 0 ? Math.round((evenPool / playerCount) * 100) / 100 : 0;

  // Build per-player breakdown
  const breakdown = activePlayers.map(p => {
    const sched = scheduleMap.get(p.id);
    const paid  = sched ? (paidMap.get(sched.scheduleId) ?? 0) : 0;
    const credits = creditMap.get(p.id) ?? 0;
    const outstanding = sched ? sched.totalAmount - paid : 0;
    const rollingBalance = Math.round((outstanding - credits) * 100) / 100;

    return {
      playerId:        p.id,
      playerFirstName: p.playerFirstName,
      playerLastName:  p.playerLastName,
      creditPortion:   Math.round(credits * 100) / 100,
      evenShare,
      totalRefund:     Math.round((credits + evenShare) * 100) / 100,
      rollingBalance,
    };
  });

  return { breakdown, totalAllCredits, evenPool, playerCount };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/season-surplus
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

  const { data: surplusRow } = await supabaseAdmin
    .from('rep_season_surplus')
    .select('*')
    .eq('program_year_id', programYear.id)
    .maybeSingle();

  const totalSurplus = surplusRow ? (surplusRow.total_surplus as number) : 0;
  const surplus = surplusRow
    ? {
        id:            surplusRow.id,
        totalSurplus,
        notes:         surplusRow.notes ?? null,
        createdAt:     surplusRow.created_at,
        updatedAt:     surplusRow.updated_at,
      }
    : null;

  const { breakdown, totalAllCredits, evenPool, playerCount } =
    await buildRefundBreakdown(programYear.id, totalSurplus);

  return NextResponse.json({ surplus, breakdown, totalAllCredits, evenPool, playerCount });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-surplus' });

// PUT /api/coaches/[orgSlug]/teams/[teamId]/season-surplus
export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear } = resolved;

  const body = await req.json();
  const { totalSurplus, notes = null } = body;

  if (typeof totalSurplus !== 'number' || totalSurplus < 0) {
    return NextResponse.json({ error: 'totalSurplus must be a non-negative number' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rep_season_surplus')
    .upsert(
      {
        program_year_id: programYear.id,
        total_surplus:   Math.round(totalSurplus * 100) / 100,
        notes:           notes?.trim() || null,
        created_by:      ctx.user.id,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'program_year_id' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { breakdown, totalAllCredits, evenPool, playerCount } =
    await buildRefundBreakdown(programYear.id, data.total_surplus as number);

  return NextResponse.json({
    surplus: {
      id:           data.id,
      totalSurplus: data.total_surplus,
      notes:        data.notes ?? null,
      createdAt:    data.created_at,
      updatedAt:    data.updated_at,
    },
    breakdown,
    totalAllCredits,
    evenPool,
    playerCount,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-surplus' });
