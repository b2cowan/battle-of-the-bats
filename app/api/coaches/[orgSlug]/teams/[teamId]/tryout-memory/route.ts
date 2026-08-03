import { NextResponse } from 'next/server';
import {
  getRepTryout,
  getRepTryoutRubric,
  getRepTryoutRegistrations,
  getRepTryoutScores,
  getRepTeamContinuityLinks,
  getRepProgramYears,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { resolveCoachSeasonReadContext, resolveCoachSeasonCapabilityMap } from '@/lib/coach-season-read';
import { canShowTryoutMemory, inPlayTryoutCandidates } from '@/lib/tryout-report';
import { resolveTryoutMemoryPairs } from '@/lib/tryout-memory';

/**
 * Year-over-year candidate MEMORY — one confirmed returning candidate's prior tryout, beside this
 * one (Tryout Insights Phase 3, plan §6; rulings R6/R7/R8, memory/design_decisions.md 2026-08-02).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠ **R8 — THIS ROUTE READS A PAST SEASON, AND THAT WAS DECIDED, NOT INHERITED.**
 *
 * It is listed in `APPROVED_SEASON_AWARE_ROUTES` (tests/unit/coach-season-write-guard.test.ts).
 * The archive's three questions, answered:
 *   1. **RECORD or INSTRUMENT?** A finished tryout's scores are a RECORD of an evaluation that
 *      happened. This route runs nothing: GET only, no writes, no side effects, no workspace row
 *      minted. The six live tryout instruments — check-in, scoring, evaluator links, decisions,
 *      offers — stay live-season-only and are deliberately absent from the allow-list. This is
 *      also why the memory is a SEPARATE endpoint rather than a `?year=` bolted onto
 *      tryout-decisions: a year parameter one typo away from a write path buys nothing.
 *   2. **Does the whole subtree carry the season?** There is no subtree. The read is one strip
 *      inside one card; it opens no page, links nowhere, and adds NO archive door — nav is
 *      untouched and `/tryouts/history` remains the only way into a finished tryout.
 *   3. **Does it show what the coach could see AT THE TIME?** Yes, twice over. Prior averages are
 *      recomputed from that season's own scores against that season's own scorecard, and the
 *      capability check runs against THAT year's assignment row (governing rule 1) — a coach who
 *      wasn't cleared for tryouts in 2026 reads nothing from 2026.
 *
 * ⚠ It deliberately takes NO `?year=`: `resolveCoachSeasonReadContext` is called with no yearId,
 * so the CURRENT season is always the live one. The past seasons this route reaches are chosen by
 * the coach's own confirmed continuity links, never by a query parameter.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  // No yearId — the memory strip belongs to the LIVE decision board (see the header).
  const resolved = await resolveCoachSeasonReadContext(orgSlug, teamId, {});
  if ('error' in resolved) return resolved.error;
  const { ctx, programYear, capabilities, isReadOnly } = resolved;

  const denied = denyUnless(capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  // A finished season has no decision board to decorate. Refusing here keeps this route from
  // quietly becoming a second archive door for the live tryout hub.
  if (isReadOnly) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // getRepTryout, NOT getOrCreate — a memory read must never mint a workspace row.
  const tryout = await getRepTryout(programYear.id);

  // R6 first, before any fetch: while names are hidden there is nothing to assemble, and the
  // client is told plainly rather than being handed an empty map it might misread as "no history".
  if (!canShowTryoutMemory(tryout)) {
    return NextResponse.json({ blind: true, byRegistration: {} });
  }

  const [rubric, registrations, scores, continuityLinks, allYears, capabilityByYear] = await Promise.all([
    getRepTryoutRubric(tryout!.id),
    getRepTryoutRegistrations(programYear.id),
    getRepTryoutScores(tryout!.id),
    getRepTeamContinuityLinks(teamId),
    getRepProgramYears(teamId),
    resolveCoachSeasonCapabilityMap(ctx.org, ctx.user.id, teamId),
  ]);

  const pairs = await resolveTryoutMemoryPairs({
    teamId,
    programYear,
    allYears,
    tryout,
    // Withdrawn candidates left the decision set — ONE shared definition with the report, so the
    // strip's "this tryout" composite can never disagree with the report's.
    registrations: inPlayTryoutCandidates(registrations),
    rubric,
    scores,
    continuityLinks,
    capabilityByYear,
  });

  const byRegistration = Object.fromEntries(pairs.map(p => [p.registrationId, p]));
  return NextResponse.json({ blind: false, byRegistration });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-memory' });
