import { NextResponse } from 'next/server';
import {
  getRepTeamEventById,
  getRepRosterPlayers,
  getRepTeamEventTagsByKind,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachHistoryReadFromRequest } from '@/lib/coach-team-read';
import { denyUnless, canReadPastPracticePlans, redactRoster } from '@/lib/coach-capabilities';

/**
 * ⚠ **ONE READ-ONLY PAST PLAN, AND NOTHING ELSE** (owner ruling 2026-08-01,
 * `COACH_PRACTICE_PLANS_PLAN.md` §10.8 ruling 1).
 *
 * ⚠ **A HISTORY ENDPOINT AGAIN, AND THIS TIME THE HEADER IS TRUE** (P3 C3, 2026-08-16). The history
 * of this comment is worth keeping, because it is why the guard test exists: it once described a
 * `?year=` P2 had taken away and claimed membership of an approved list it had been removed from,
 * and both claims sat here unnoticed because nothing enforced them. Where it stands now, verified
 * against the code below rather than against a plan:
 *
 *   · It resolves through `resolveCoachHistoryRead`, so it CAN be handed a season by name.
 *   · It is enumerated in `HISTORY_ENDPOINTS` in `tests/unit/coach-history-endpoint-guard.test.ts`,
 *     with the three questions answered at the list. The build fails if it leaves that set.
 *   · Absent `?year=` it is the team's WORKING season — which is what its original entry point,
 *     the "Practices you've run" list in the Development report, still relies on.
 *
 * ⚠ **WHY IT NEEDED THE YEAR BACK.** C3 gave this route a SECOND entry point: the practices section
 * on a finished season's own Season's End page. Season's End can be handed an older year by the
 * compare list while the team is mid-season, so a row opened from there names an event that is not
 * in the team's working season — and without the parameter this route would 404 it, correctly and
 * uselessly.
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
 * The unit of work is every page reachable from the door, never the door alone. This route IS the
 * whole subtree: the page it serves has exactly one link out, back to whichever list it came from,
 * carrying the season with it.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;

  // The year goes THROUGH the resolver, never around it — that is what makes the access check run
  // against the requested SEASON rather than against the team. Absent the parameter this is the
  // team's working season, which is how the Development report's own list reaches it.
  const seasonCtx = await resolveCoachHistoryReadFromRequest(req, orgSlug, teamId);
  if ('error' in seasonCtx) return seasonCtx.error;
  const { programYear, capabilities, isReadOnly } = seasonCtx;

  /**
   * ⚠ THE ARCHIVE DOOR IS NOT A HELPER'S DOOR (Phase 4, 2026-08-03).
   *
   * This route serves a PAST season's plan. A helper turns up to run a station on a Tuesday; they
   * have no business reading last season's plans, so the gate here mirrors the doors that lead to
   * it rather than resting on the schedule alone. **Matching the gate to its own entry points is
   * what keeps this from becoming a URL a helper can type — they must move together.**
   *
   * ⚠ There are TWO entry points from 2026-08-16 (P3 C3), and the rule above was the reason the
   * second one had to be built the way it was: the "Practices you've run" list inside the
   * Development report (which requires record access) and the practices section on Season's End
   * (whose own route, `season-practices`, was given this exact pair rather than Season's End's
   * looser `hasRecordAccess`, so the side door is no wider than the front one).
   *
   * ⚠ **A1 (2026-08-03): this is the one gate where retiring `roster` would have NARROWED rather
   * than widened.** It read `notes || roster !== 'off'`; assistants carry `notes: false` by default
   * and passed on the roster half, so dropping that clause would have locked every ordinary
   * assistant coach out of past plans while this change is supposed to take nothing away.
   * `hasRecordAccess` restores them and still excludes a helper.
   *
   * ⚠ The pair is now the NAMED predicate `canReadPastPracticePlans` (P3 C3 `/simplify`), so the
   * "these must move together" invariant is structural rather than kept by these comments alone.
   */
  const denied = denyUnless(canReadPastPracticePlans(capabilities), 'You do not have access to past practice plans.');
  if (denied) return denied;

  const event = await getRepTeamEventById(eventId);
  // ⚠ Matched against the RESOLVED season, not the active one. An event from any other season is a
  // 404 — the caller must not learn that the id exists.
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

  const [tagsByEvent, players] = await Promise.all([
    getRepTeamEventTagsByKind([eventId], 'focus').catch(() => ({} as Record<string, { id: string; name: string }[]>)),
    // Only to turn the plan's stored player ids into the names the coach wrote them as.
    // ⚠ A1 (2026-08-03): this used to be conditional on roster visibility. Names are baseline now,
    // and the gate above already decided who reaches this route at all, so the conditional is gone
    // rather than left as a constant nobody can flip.
    getRepRosterPlayers(programYear.id).catch(() => []),
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
