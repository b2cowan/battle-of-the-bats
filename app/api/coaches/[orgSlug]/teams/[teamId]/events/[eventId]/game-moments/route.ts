import { NextResponse } from 'next/server';
import {
  createRepTeamGameMoment,
  getRepRosterPlayers,
  getRepTeamEventById,
  getRepTeamStaffForYear,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { canLogGameMoment, denyUnless } from '@/lib/coach-capabilities';
import { COACH_GAME_EVENT_TYPES } from '@/lib/coach-tournament-games';
import { validateGameMoment } from '@/lib/coach-game-moments';

/**
 * Game-Day Mode P2 — capture ONE moment (plan §3.7 / §4).
 *
 * ⚠ LIVE-SEASON INSTRUMENT, exactly like the P1 console read whose auth chain this follows:
 * `resolveLiveCoachTeamContext`, never the working-season read, so a past season is unaddressable
 * here by construction. This route joins NEITHER `APPROVED_ARCHIVE_DOORS` nor
 * `HISTORY_ENDPOINTS` — a finished season SHOWS moments (owner ruling 2026-08-05,
 * via Wrapped) and offers no way to add one.
 *
 * ⚠ NOTHING HERE NOTIFIES. No `notify()`, no family layer, no toast that reaches a guardian.
 * The one-notification-at-End-game promise is the feature's spine and a moment must never
 * become a second ping.
 *
 * ⚠ APPEND-ONLY: there is no PATCH/PUT export in this file and no update helper in `lib/db.ts`
 * to call. A mistyped moment is deleted and retyped, which keeps "what you wrote at 7:32"
 * honest — the same convention the scouting book's capture log follows.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment, programYear } = resolved;

  // Q1 (owner, 2026-08-05): anyone who DRIVES the console. A schedule-only Helper's console
  // renders no footer, so this gate and that screen agree.
  const denied = denyUnless(canLogGameMoment(assignment.capabilities), 'Your coach runs the bench.');
  if (denied) return denied;

  const event = await getRepTeamEventById(eventId);
  if (!event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  // A moment belongs to a GAME. A practice has the run screen; a team event has no bench.
  if (!COACH_GAME_EVENT_TYPES.includes(event.eventType)) {
    return NextResponse.json({ error: 'Moments belong to games and scrimmages' }, { status: 400 });
  }

  // The tag is validated against THIS season's active roster — a moment filed under a player
  // who isn't on the team would render under nobody forever.
  const roster = await getRepRosterPlayers(programYear.id);
  const rosterIds = roster.filter(p => p.status === 'active').map(p => p.id);

  const payload = await req.json().catch(() => ({}));
  const verdict = validateGameMoment(payload, rosterIds);
  if (!verdict.ok) return NextResponse.json({ error: verdict.reason }, { status: 400 });

  // Attribution snapshot (the scouting book's pattern): a label for display, the user id for
  // author-own deletion. A label match can miss; identity never does.
  const staff = await getRepTeamStaffForYear(programYear.id, ctx.org.id);
  const createdByName = staff.find(s => s.userId === ctx.user.id)?.displayName ?? null;

  const moment = await createRepTeamGameMoment({
    teamId, orgId: ctx.org.id, programYearId: programYear.id, eventId: event.id,
    playerId: verdict.playerId, body: verdict.body,
    createdBy: ctx.user.id, createdByName,
  });
  return NextResponse.json({ moment });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/game-moments' });
