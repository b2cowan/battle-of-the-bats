import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { carryBudgetPlan } from '@/lib/rep-budget-carry';

// POST /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/carry
//
// "Bring last season's plan" (owner Q8b, 2026-09-02) — the later door for a coach who declined
// the rollover's budget carry. Copies the most recent prior season's lines, periods (dates
// shifted forward) and split modes onto the ACTIVE season, through the same shared helper the
// rollover runs (lib/rep-budget-carry.ts), so the two doors cannot drift.
//
// ⚠ ONLY onto an EMPTY plan. This door exists for the empty state; on a plan with lines it would
// silently double a budget — refused with the reason, not merged.
export const POST = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  // Check-then-act: the emptiness check and the copy are two statements, so a double-tap could
  // race them — the 409 here plus the door only rendering on an empty plan make that a
  // two-mistakes-deep case, and a second tap after a first success is refused by this same check.
  const { count: existingCount } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('id', { count: 'exact', head: true })
    .eq('program_year_id', programYear.id)
    .eq('org_id', ctx.org.id)
    .eq('team_id', teamId);
  if ((existingCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This plan already has lines — bringing last season’s plan onto it would double the budget.' },
      { status: 409 },
    );
  }

  // The most recent PRIOR season for this team that actually holds budget lines. A team rarely
  // has more than a handful of years, so a short walk beats a clever join.
  const { data: yearsData } = await supabaseAdmin
    .from('rep_program_years')
    .select('id, year')
    .eq('team_id', teamId)
    .eq('org_id', ctx.org.id)
    .neq('id', programYear.id)
    .lt('year', programYear.year)
    .order('year', { ascending: false })
    .limit(5);
  const priorYears = (yearsData ?? []) as Array<{ id: string; year: number }>;

  let source: { id: string; year: number } | null = null;
  for (const py of priorYears) {
    const { count } = await supabaseAdmin
      .from('rep_budget_lines')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', py.id)
      .eq('org_id', ctx.org.id)
      .eq('team_id', teamId);
    if ((count ?? 0) > 0) { source = py; break; }
  }
  if (!source) {
    return NextResponse.json(
      { error: 'No earlier season with budget lines was found for this team.' },
      { status: 404 },
    );
  }

  const summary = await carryBudgetPlan({
    orgId: ctx.org.id,
    teamId,
    fromProgramYearId: source.id,
    toProgramYearId: programYear.id,
    yearDelta: programYear.year - source.year,
  });

  return NextResponse.json({ carried: summary, fromYear: source.year });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/carry' });
