import { NextResponse } from 'next/server';
import {
  getRepTeamEventById,
  getRepRosterPlayers,
  getRepTeamEventTagsByKind,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';
import { denyUnless, canManageSchedule, canViewRoster, redactRoster } from '@/lib/coach-capabilities';

/**
 * ⚠ **THE NEW ARCHIVE DOOR — one read-only past plan, and nothing else** (owner ruling
 * 2026-08-01, `COACH_PRACTICE_PLANS_PLAN.md` §10.8 ruling 1).
 *
 * The archive is OPT-IN. This is the single route in Practice Plans that opts in, and it is on the
 * approved list in `tests/unit/coach-season-write-guard.test.ts` because that decision was taken
 * explicitly — the build failing until the list was edited is what forced the question.
 *
 * ── Why a SEPARATE route from the practice-plan GET beside it ──
 * That route is the live editor's: it also holds the PUT and the PATCH, it hands back drills,
 * templates, staff suggestions and the focus rail, and it must keep resolving the team's ACTIVE
 * year so no write can ever address a past season. Putting the rail on its GET would make the
 * whole editor addressable in an archive and leave one file carrying both postures. This one is
 * GET-only and hands back exactly what a record needs to render.
 *
 * ── What is deliberately NOT here ──
 *   · **No focus areas.** The rail is an instrument for planning tonight; a record does not need
 *     to restate coach-judgement text about a minor, so the `notes`-gated data is simply never
 *     fetched. Nothing to leak.
 *   · **No drills, no templates, no tag library, no suggestions.** All instruments, all live-season
 *     only. The plan renders entirely from its own jsonb — the property Phase 2's copy-on-add
 *     bought: editing a drill since cannot rewrite what June's practice says.
 *   · **No write of any kind.** There is no other verb in this file.
 *
 * ── The container rule ──
 * An archive is a container, and the unit of work is every page reachable from the door. This
 * route is the whole subtree: the page it serves links only back to the list it came from, and
 * carries the viewed season on that link.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;

  // Governing rule 1 — capabilities come from the assignment row recorded against the RESOLVED
  // season, never from the coach's newest one.
  const seasonCtx = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in seasonCtx) return seasonCtx.error;
  const { programYear, capabilities, isReadOnly } = seasonCtx;

  const denied = denyUnless(canManageSchedule(capabilities), 'You do not have access to the schedule.');
  if (denied) return denied;

  const event = await getRepTeamEventById(eventId);
  // ⚠ Matched against the RESOLVED season, not the active one. This is the whole difference
  // between a door and a dead end: `?year=` decides which season, and an event from any other one
  // is a 404 — the caller must not learn that the id exists.
  if (!event || event.programYearId !== programYear.id || event.teamId !== teamId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (event.eventType !== 'practice') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  /**
   * ⚠ **A CANCELLED PRACTICE DID NOT HAPPEN**, so it is not part of the record this door opens.
   *
   * The list that leads here already excludes them, and this is the matching guard on the page
   * itself — otherwise a kept link (or a typed id) would open a full plan, complete with who was
   * assigned to each station, for a night that was called off. Cancelling only flips `status`; it
   * never clears the plan or the recap.
   */
  if (event.status === 'cancelled') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const showRoster = canViewRoster(capabilities);
  const [tagsByEvent, players] = await Promise.all([
    getRepTeamEventTagsByKind([eventId], 'focus').catch(() => ({} as Record<string, { id: string; name: string }[]>)),
    // Only to turn the plan's stored player ids into the names the coach wrote them as. Gated at
    // the SOURCE: an assistant without roster visibility never receives the list, so no client
    // mistake can surface it, and the page renders the groups without names.
    showRoster
      ? getRepRosterPlayers(programYear.id).catch(() => [])
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.location,
      fieldNumber: event.fieldNumber,
    },
    plan: event.practicePlan,
    recap: event.practiceRecap,
    tags: tagsByEvent[eventId] ?? [],
    // Every player who was on the roster THAT season — including those since departed, because
    // the record must read as it read at the time. Names + number only; a record needs identity,
    // not PII, and redactRoster is the gate that catches the day someone spreads `...p` in here.
    roster: redactRoster(
      players.map(p => ({
        id: p.id,
        playerFirstName: p.playerFirstName,
        playerLastName: p.playerLastName,
        playerNumber: p.playerNumber,
      })),
      capabilities,
    ),
    season: {
      programYearId: programYear.id,
      name: programYear.name,
      /** True when the season is a record. The page renders no write control either way. */
      isReadOnly,
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/practice-plan/read' });
