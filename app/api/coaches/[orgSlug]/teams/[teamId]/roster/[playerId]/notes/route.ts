import { NextResponse } from 'next/server';
import {
  getRepRosterPlayer, getRepPlayerNotesForPlayer, createRepPlayerNote,
  getRepTeamGameMomentsForPlayer, getRepPlayerObservationsForPlayer, getRepDevelopmentGoalReviewsForPlayer,
  getRepPlayerDevelopmentGoalsForPlayer, getRepTeamMeasurableTypes, getRepTeamEvents, getOrgMemberDisplayNames,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import {
  denyUnless, canLogGameMoment, canViewDevelopmentGoals, canWriteDevelopmentGoals,
} from '@/lib/coach-capabilities';
import { readPlayerNoteInput } from '@/lib/development-input';
import { resolveDevelopmentPlayerContext, assertGoalBelongsToPlayer, assertEventBelongsToSeason } from '@/lib/development-player-route';
import { buildPlayerNotesTimeline } from '@/lib/player-notes-timeline';

/**
 * The player's NOTES tab (roster + player page review, hub F20 — owner rulings 2026-09-13).
 *
 * GET is ONE READ over four sources — general notes (this table), bench moments, skill
 * observations and goal reviews — merged newest-first by `buildPlayerNotesTimeline`. Nothing is
 * written twice: observations and reviews are recorded on Skills & Goals, moments at the bench,
 * and only the general note is written here (POST).
 *
 * Gates, stated once:
 *   · The tab READS on Internal notes (`canViewDevelopmentGoals`) — every source here is a coach's
 *     written judgement about a child, the goals' sensitivity class. A coach without notes gets
 *     a 403, and the page never draws the tab for them.
 *   · Moments keep their own narrower gate on top: live season only, and only for a coach who
 *     could have logged one (`canLogGameMoment`) — the same predicate the record page used when
 *     it listed them, so nobody gains a line they could not read before.
 *   · Writes take the goals predicate: the Development grant AND notes.
 *
 * ⚠ LIVE SEASON ONLY for the moments, and the timeline itself is the working season's roster row
 * (a roster row is one player in one season) — this route learns no year.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear, isReadOnly } = resolved;
  const denied = denyUnless(canViewDevelopmentGoals(capabilities), 'You do not have access to this player’s notes.');
  if (denied) return denied;

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id || player.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const showMoments = !isReadOnly && canLogGameMoment(capabilities);
  const canWrite = !isReadOnly && canWriteDevelopmentGoals(capabilities);

  // All of a player's moments (no limit: one player, one season); the season's events name the
  // moment and note chips; the type library names the observation chips.
  const [notes, moments, observations, reviews, goals, types, events] = await Promise.all([
    getRepPlayerNotesForPlayer(playerId),
    showMoments ? getRepTeamGameMomentsForPlayer(teamId, programYear.id, playerId) : Promise.resolve({ moments: [], total: 0 }),
    getRepPlayerObservationsForPlayer(playerId),
    getRepDevelopmentGoalReviewsForPlayer(playerId),
    getRepPlayerDevelopmentGoalsForPlayer(playerId),
    getRepTeamMeasurableTypes(teamId, { includeRetired: true }),
    getRepTeamEvents(programYear.id),
  ]);

  const teamBase = `/${orgSlug}/coaches/teams/${teamId}`;
  const entries = buildPlayerNotesTimeline({
    notes, moments: moments.moments, observations, reviews, goals, types, events,
    playerBase: `${teamBase}/roster/${playerId}`, teamBase,
  });
  // Every entry names who wrote it (owner ruling 2026-09-11). A moment already carries its name.
  const authors = await getOrgMemberDisplayNames(ctx.org.id, entries.map(e => e.authorId ?? ''));
  for (const m of moments.moments) if (m.createdBy && m.createdByName && !authors[m.createdBy]) authors[m.createdBy] = m.createdByName;

  return NextResponse.json({
    canWrite,
    entries,
    authors,
    // The "about" pickers on the Add-a-note form — only for a coach who can open that form.
    goals: canWrite ? goals.map(g => ({ id: g.id, focusArea: g.focusArea })) : [],
    events: canWrite ? events.map(e => ({ id: e.id, name: e.name, startsAt: e.startsAt })) : [],
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/notes' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;
  const { ctx, player } = resolved;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const read = readPlayerNoteInput(body, 'create');
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { notedOn, body: text, goalId, eventId } = read.fields;

  // What the note is ABOUT must be this player's goal or this season's event — an id from the
  // address bar is not a fact until the route has looked.
  const [badGoal, badEvent] = await Promise.all([
    assertGoalBelongsToPlayer(teamId, playerId, goalId),
    assertEventBelongsToSeason(player.programYearId, eventId),
  ]);
  const bad = badGoal ?? badEvent;
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const note = await createRepPlayerNote({
    orgId: ctx.org.id, teamId, playerId, notedOn, body: text, goalId, eventId, createdBy: ctx.user.id,
  });
  return NextResponse.json({ note }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/notes' });
