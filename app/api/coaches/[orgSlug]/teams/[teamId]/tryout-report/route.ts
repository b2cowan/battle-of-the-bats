import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTryout,
  getRepTryoutRubric,
  getRepTryoutRegistrations,
  getRepTryoutScores,
  getRepRosterPlayers,
  getRepTeamContinuityLinks,
  getRepProgramYears,
} from '@/lib/db';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import { buildTryoutReport, pickPriorProgramYear } from '@/lib/tryout-report';

/**
 * The Tryout Report — the season's record of the selection, assembled for the Build-your-team
 * stage (Tryout Insights Phase 1; rulings R1–R8 in memory/design_decisions.md 2026-08-02).
 *
 * Pure read on the ACTIVE season only. Deliberately a separate route from tryout-overview: the
 * overview is a lean strip polled for orientation; the report is the full aggregate a coach opens
 * on purpose. All math lives in lib/tryout-report.ts so it is unit-tested and shared with the
 * later phases' snapshot needs.
 *
 * R1/R6 enforcement happens server-side: while blind evaluation is on, `report.candidateRows` is
 * null — the name×score×decision mapping for the full-detail export does not leave the server.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const denied = denyUnless(assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });

  // getRepTryout, NOT getOrCreate — a report is a read; opening it must never mint workspace rows.
  const [tryout, allYears] = await Promise.all([
    getRepTryout(programYear.id),
    getRepProgramYears(teamId),
  ]);
  const prior = pickPriorProgramYear(allYears, programYear.id);

  const [rubric, registrations, scores, roster, continuityLinks, priorRegistrations] = await Promise.all([
    tryout ? getRepTryoutRubric(tryout.id) : Promise.resolve(null),
    getRepTryoutRegistrations(programYear.id),
    tryout ? getRepTryoutScores(tryout.id) : Promise.resolve([]),
    getRepRosterPlayers(programYear.id),
    getRepTeamContinuityLinks(teamId),
    prior ? getRepTryoutRegistrations(prior.id) : Promise.resolve(null),
  ]);

  const report = buildTryoutReport({
    tryout,
    rubric,
    registrations,
    scores,
    roster,
    continuityLinks,
    // Same withdrawn-exclusion as this report's own turnout count — comparing filtered-current
    // against raw-prior would systematically skew the "vs last season" delta (/review High).
    // (tryout-history's turnout counts raw on BOTH sides — internally consistent there; the two
    // definitions reconcile when Phase 3 shares the snapshot math.)
    priorRegistrationCount: priorRegistrations
      ? priorRegistrations.filter(r => r.status !== 'withdrawn').length
      : null,
    priorSeasonName: prior?.name ?? null,
    now: Date.now(),
  });

  return NextResponse.json({
    seasonName: programYear.name,
    teamName: team.name,
    orgName: ctx.org.name,
    // Board-summary PDF roster list — first-initial + surname, the only per-player content the
    // board-safe document carries (R1). These are roster names, not candidate evaluations.
    rosterNames: roster.map(p =>
      `${p.playerFirstName?.trim() ? `${p.playerFirstName.trim().charAt(0)}. ` : ''}${p.playerLastName ?? ''}`.trim(),
    ).filter(Boolean),
    report,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-report' });
