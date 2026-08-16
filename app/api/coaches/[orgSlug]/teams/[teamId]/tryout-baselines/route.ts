import { NextResponse } from 'next/server';
import {
  getRepTryout,
  getRepTryoutRubric,
  getRepTryoutRegistrations,
  getRepTryoutScores,
  getRepTryoutSessions,
  getRepRosterPlayers,
  getRepTeamTagLibrary,
  getRepPlayerTryoutBaselines,
  createRepPlayerTryoutBaseline,
  createRepPlayerDevelopmentGoal,
  getRepPlayerDevelopmentGoalsForPlayer,
} from '@/lib/db';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import { rankTryoutCandidates } from '@/lib/tryout-scoring';
import {
  buildTryoutBaselineSnapshot, suggestBaselineFocus, tryoutDateLabel, isEmptyBaselineSnapshot,
  MAX_SEEDED_GOALS,
} from '@/lib/tryout-baseline';
import { parseDevelopmentGoalInput, type DevelopmentGoalInput } from '@/lib/development-goal-input';
import { ORG_TIME_ZONE } from '@/lib/timezone';

/**
 * The development baseline seeded from a tryout — Tryout Insights Phase 2, work items B1–B3
 * (plan §5; rulings R3/R4/R5; mockups v1 frame 04).
 *
 * GET  — the walkthrough: every player this season's tryout put on the roster, each with the
 *        snapshot the coach is about to freeze, the suggested focus areas, and whether a
 *        baseline is already set. Plus the team's focus vocabulary, so the picker offers words
 *        the team already uses rather than inviting a duplicate.
 * POST — seed ONE player: freeze the snapshot, and create only the focus areas the coach
 *        explicitly confirmed.
 *
 * ⚠ **BOTH capabilities, and that is the honest gate.** This route reads tryout evaluation
 * content (`tryouts` — head-coach-only as today) AND writes development goals
 * (`canWriteDevelopment`). Gating on either alone would open a side door around the other's rule.
 *
 * ⚠ **LIVE SEASON ONLY, by construction.** Built on `resolveLiveCoachTeamContext`, never the
 * working-season read: seeding a season's development plan is an INSTRUMENT, not a record, so a
 * finished season cannot be addressed here at all.
 *
 * ⚠ **The client never supplies a snapshot.** It is recomputed server-side at seed time from the
 * scores, through the same `rankTryoutCandidates` the scoreboard and the report use — a posted
 * snapshot would be a coach-authored score record wearing a trusted name.
 */

async function resolveSeedingContext(orgSlug: string, teamId: string) {
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved;
  const caps = resolved.assignment.capabilities;
  const denied =
    denyUnless(caps.tryouts, 'Only the head coach manages tryouts.') ??
    denyUnless(canWriteDevelopment(caps), 'Only the head coach can edit development.');
  if (denied) return { error: denied };
  return resolved;
}

/**
 * The season's frozen-at-read-time picture: who came from the tryout, what their evaluation said,
 * and what it suggests. Shared by GET (render it) and POST (write from it), so the snapshot the
 * coach saw and the snapshot that gets stored are assembled by ONE piece of code.
 *
 * ⚠ It deliberately does NOT fetch the focus vocabulary — that is a GET-only need (the picker),
 * and bundling it here made every "Save baseline & next" click pay for a tag library it discarded.
 */
async function assembleSeedingPlayers(teamId: string, programYearId: string, seasonLabel: string) {
  // getRepTryout, NOT getOrCreate — this is a read of a tryout that happened; opening the
  // walkthrough must never mint a workspace row.
  const tryout = await getRepTryout(programYearId);
  const [rubric, registrations, scores, sessions, roster, baselines] = await Promise.all([
    tryout ? getRepTryoutRubric(tryout.id) : Promise.resolve(null),
    getRepTryoutRegistrations(programYearId),
    tryout ? getRepTryoutScores(tryout.id) : Promise.resolve([]),
    tryout ? getRepTryoutSessions(tryout.id) : Promise.resolve([]),
    getRepRosterPlayers(programYearId),
    getRepPlayerTryoutBaselines(programYearId),
  ]);

  const categories = rubric?.categories ?? [];
  // Names are needed here and this surface is post-decision by definition (these players are on
  // the roster), so the ranker runs non-blind. The blind FACT still travels into the snapshot.
  const ranked = rankTryoutCandidates(registrations, categories, scores, { blind: false });
  const rankedByRegistration = new Map(ranked.map(r => [r.registrationId, r]));
  const baselineByPlayer = new Map(baselines.map(b => [b.rosterPlayerId, b]));
  const dateLabel = tryoutDateLabel(sessions, ORG_TIME_ZONE);

  // ⚠ ROSTERED PLAYERS ONLY, and only those who arrived through the tryout. A manually-added
  // player has no tryout to be a baseline OF; offering them an empty walkthrough step would be a
  // blank the coach has to dismiss for no reason.
  const players = roster
    .filter(p => p.status === 'active' && p.source === 'tryout')
    .map(p => {
      const snapshot = buildTryoutBaselineSnapshot({
        ranked: p.tryoutRegistrationId ? rankedByRegistration.get(p.tryoutRegistrationId) ?? null : null,
        rubric,
        tryoutId: tryout?.id ?? null,
        seasonLabel,
        dateLabel,
        blindUsed: tryout?.isAnonymous ?? false,
      });
      const stored = baselineByPlayer.get(p.id);
      return {
        rosterPlayerId: p.id,
        name: `${p.playerFirstName ?? ''} ${p.playerLastName ?? ''}`.trim() || 'Player',
        playerNumber: p.playerNumber,
        tryoutRegistrationId: p.tryoutRegistrationId,
        // What is stored WINS over what would be computed now: the card must keep showing what
        // the coach acted on, even after a rubric edit (R4).
        snapshot: stored ? stored.snapshot : snapshot,
        hasSnapshot: !isEmptyBaselineSnapshot(stored ? stored.snapshot : snapshot),
        seededAt: stored?.seededAt ?? null,
        suggestions: stored ? [] : suggestBaselineFocus(snapshot),
      };
    });

  return players;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveSeedingContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear } = resolved;

  // The vocabulary has no dependency on the tryout assembly — the two run together.
  const [players, tags] = await Promise.all([
    assembleSeedingPlayers(teamId, programYear.id, programYear.name),
    getRepTeamTagLibrary(teamId, 'focus', ctx.org.id),
  ]);
  return NextResponse.json({ players, tags });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-baselines' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveSeedingContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear } = resolved;

  const body = await req.json().catch(() => ({}));
  const rosterPlayerId = typeof body.rosterPlayerId === 'string' ? body.rosterPlayerId : '';
  if (!rosterPlayerId) return NextResponse.json({ error: 'rosterPlayerId is required' }, { status: 400 });

  // ⚠ R5, server-side: `focusAreas` is what the COACH confirmed. An empty array is a complete,
  // first-class answer ("Don't add" on every suggestion) and seeds the baseline alone.
  const rawAreas: unknown[] = Array.isArray(body.focusAreas) ? body.focusAreas : [];
  if (rawAreas.length > MAX_SEEDED_GOALS) {
    return NextResponse.json({ error: `You can start with up to ${MAX_SEEDED_GOALS} focus areas.` }, { status: 400 });
  }
  // ⚠ The SAME validator the goals route uses — the 80-character rule and the tag-ownership check
  // are one rule, not two copies. It never mints a tag: the picker creates new vocabulary through
  // the focus-tags route, which carries the vocabulary's own write gate.
  // The checks are independent of each other, so they resolve together rather than in series.
  const validations = await Promise.all(
    rawAreas.map(raw => parseDevelopmentGoalInput(raw, { orgId: ctx.org.id, teamId })),
  );
  const rejected = validations.find(v => 'error' in v);
  if (rejected && 'error' in rejected) return rejected.error;
  const focusAreas = validations.map(v => (v as { value: DevelopmentGoalInput }).value);

  const players = await assembleSeedingPlayers(teamId, programYear.id, programYear.name);
  const player = players.find(p => p.rosterPlayerId === rosterPlayerId);
  // Not on this season's tryout-sourced roster: a 404 rather than a 403, and the same answer for
  // "wrong team" as for "wrong season" (tenancy).
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  /**
   * ⚠ **A BASELINE IS ONLY WRITTEN WHEN THERE IS SOMETHING TO RECORD** (/simplify altitude
   * finding, 2026-08-02). The table's whole contract is "a copy of what the tryout said"; a row
   * whose every number is null says nothing, cannot be corrected (the table has no update path by
   * design), and would permanently BLOCK a real baseline if an evaluator submits their scores
   * after the coach ran the walkthrough — silently, because the card renders nothing for an empty
   * snapshot. So an unscored player's step still saves their focus areas and simply leaves no
   * baseline behind, which is the truth: there isn't one yet.
   *
   * ⚠ **AN ALREADY-SEEDED PLAYER IS NOT AN ERROR, AND MUST NOT DISCARD THE COACH'S PICKS**
   * (/review Critical, 2026-08-02). This returned 409 before the goals were written, which lost
   * work silently in two ordinary situations: two tabs (or two coaches) reaching the same player,
   * and — far more likely — a coach RETRYING after a failed save whose baseline write had already
   * landed. The retry hit "already seeded" and the confirmed focus areas vanished with no error
   * shown. The two writes are independent: the baseline is written once and never overwritten,
   * while the focus areas are the coach's decision and are always honoured (deduped below).
   */
  const alreadySeeded = !!player.seededAt;
  const created = alreadySeeded || isEmptyBaselineSnapshot(player.snapshot)
    ? null
    : await createRepPlayerTryoutBaseline({
        orgId: ctx.org.id,
        teamId,
        programYearId: programYear.id,
        rosterPlayerId,
        tryoutRegistrationId: player.tryoutRegistrationId,
        snapshot: player.snapshot,
        seededBy: ctx.user.id,
      });
  // `created === null` from the insert means the unique index refused it — another walkthrough
  // seeded this player between the read above and this write. Nothing was overwritten, and the
  // focus areas below still land, so there is nothing to report as a failure.

  // ⚠ Only what the coach confirmed, and a focus area the player already has is skipped rather
  // than duplicated — a coach re-running a half-finished walkthrough must not end up with "Arm
  // strength" twice. The dedup is pure JS, so the inserts themselves are independent and run
  // together instead of one round trip at a time.
  const existing = await getRepPlayerDevelopmentGoalsForPlayer(rosterPlayerId);
  const taken = new Set(existing.map(g => g.focusArea.trim().toLowerCase()));
  const toCreate = focusAreas.filter(area => {
    const key = area.focusArea.toLowerCase();
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  });
  const goals = await Promise.all(toCreate.map(area => createRepPlayerDevelopmentGoal({
    orgId: ctx.org.id,
    teamId,
    playerId: rosterPlayerId,
    focusArea: area.focusArea,
    // ⚠ NO note. A note is the coach's words about a player; inventing one from a score
    // ("scored 2.4 at tryouts") would put an evaluation number into a field that already
    // travels further than this table does.
    status: 'working',
    tagId: area.tagId,
    createdBy: ctx.user.id,
  })));

  // `baselineSet` is what the walkthrough counts, and it is true whether this request wrote the
  // baseline or found one already there — either way the player now has one.
  return NextResponse.json(
    { baseline: created, baselineSet: !!created || alreadySeeded, goals },
    { status: 201 },
  );
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-baselines' });
