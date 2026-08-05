import { NextResponse } from 'next/server';
import {
  getRepRosterPlayers,
  getRepTeamEventAttendance,
  getRepTeamEventById,
  getRepTeamGameMomentsForEvent,
  getRepTeamLineupEntries,
  getRepTeamLineupForEvent,
  getRepTeamStaffForYear,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import {
  canLogGameMoment, canManageSchedule, canViewSchedule, denyUnless, redactRoster,
} from '@/lib/coach-capabilities';
import { COACH_GAME_EVENT_TYPES, isMirroredEvent } from '@/lib/coach-tournament-games';
import { gameDayWindow } from '@/lib/coach-game-day';

/**
 * Game-Day Mode P1 — the bench console's ONE aggregated read (plan §5): the event, the saved
 * lineup + entries, the active roster, tonight's attendance, and the per-zone capability
 * answers, in a single round trip, mirroring the practice-plan read's shape.
 *
 * ⚠ LIVE-SEASON INSTRUMENT (CLAUDE.md archive ruling, test #1: it runs a game). This route
 * deliberately rides `resolveLiveCoachTeamContext` — NOT the season-read rail — so a past
 * season is unaddressable here by construction. It joins NEITHER `APPROVED_ARCHIVE_DOORS` nor
 * `APPROVED_SEASON_AWARE_ROUTES`, and archived seasons never show an entry point. (The plan's
 * §5 mention of `resolveCoachSeasonRead` was overridden by the build prompt for exactly this
 * reason — the P3 /simplify lesson: never hand-copy the auth chain, and never put an
 * instrument on the archive rail.)
 *
 * ⚠ NOTHING IS WRITTEN HERE, and no write route is added anywhere in P1. The console's writes
 * are the EXISTING lineup PUT, attendance PATCH and events PATCH (with the quiet flag) — one
 * gate per write, all already in place.
 *
 * Who gets in: anyone who can see the schedule — a schedule-only Helper receives a READ-ONLY
 * console ("Your coach runs the bench", the practice-run sentence pattern). What each zone
 * allows is answered per capability in `can` below, zone by zone (plan §6): a lineup-less
 * attendance helper gets score-view + attendance only.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment, programYear } = resolved;
  const caps = assignment.capabilities;

  const denied = denyUnless(canViewSchedule(caps), 'You do not have access to the schedule.');
  if (denied) return denied;

  const event = await getRepTeamEventById(eventId);
  if (!event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  // A cancelled game still resolves (the deep link renders review mode, never a 404); a
  // practice or team event has no bench to run and is a 400, same rule as the lineup route.
  if (!COACH_GAME_EVENT_TYPES.includes(event.eventType)) {
    return NextResponse.json({ error: 'Game day is for games and scrimmages' }, { status: 400 });
  }

  // Each zone's DATA is gated at the SOURCE (the practice-plan read's rule): no grant, no
  // payload — `can` flags gate affordances, never data. The lineup gate mirrors the standalone
  // lineup GET's denyUnless: without `lineups`, the full inning-by-inning board (coaching
  // strategy) must not ride along to a schedule-only Helper or an attendance-only assistant —
  // their console is matchup + score view (+ attendance if granted), exactly plan §6.
  const showAttendance = caps.attendance;
  const showLineup = caps.lineups;
  // P2: moments ride THIS read rather than a second GET (the build prompt's rule) and are
  // gated at the source on the same predicate that allows capturing one — a read-only Helper's
  // console never receives the staff's private lines about the night.
  const showMoments = canLogGameMoment(caps);
  const [players, attendance, lineup, staff, moments] = await Promise.all([
    getRepRosterPlayers(programYear.id).then(all => all.filter(p => p.status === 'active')),
    showAttendance ? getRepTeamEventAttendance(eventId) : Promise.resolve([]),
    showLineup ? getRepTeamLineupForEvent(eventId) : Promise.resolve(null),
    getRepTeamStaffForYear(programYear.id, ctx.org.id),
    showMoments ? getRepTeamGameMomentsForEvent(teamId, eventId) : Promise.resolve([]),
  ]);
  const entries = lineup ? await getRepTeamLineupEntries(lineup.id) : [];

  return NextResponse.json({
    event,
    lineup,
    entries,
    players: redactRoster(players, caps),
    attendance,
    moments,
    isMirrored: isMirroredEvent(event),
    // The one clock both the entry points and the quiet-flag guard read (lib/coach-game-day) —
    // sent so the client renders live/review from the same arithmetic without re-deriving it.
    window: gameDayWindow(event),
    /**
     * Zone-by-zone drive (plan §6). No new capability key: subs ride `lineups`, the attendance
     * sheet rides `attendance`, score + End game ride `scheduleManage` (the same field
     * ownership as the schedule's score form). All false = the Helper's read-only console.
     */
    can: {
      subs: caps.lineups,
      attendance: caps.attendance,
      score: canManageSchedule(caps),
      // P2 (owner Q1, 2026-08-05): any console DRIVE grant. Same predicate as the payload gate
      // above — an affordance the data doesn't back is how a button becomes a 403.
      moments: showMoments,
    },
    // Who DOES run the bench, named, for the read-only sentence (practice-run pattern).
    headCoachName: staff.find(s => s.coachRole === 'head_coach')?.displayName ?? null,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/game-console' });
