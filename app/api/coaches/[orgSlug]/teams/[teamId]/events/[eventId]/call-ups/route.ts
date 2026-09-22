import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  getRepTeamEventById,
  getRepCallUpPool,
  getRepCallUpsForEvent,
  createRepRosterPlayer,
  getRepRosterPlayer,
  linkRepCallUpToEvent,
  unlinkRepCallUpFromEvent,
  getRepTeamLineupForEvent,
  removePlayerFromSavedLineup,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, redactRoster } from '@/lib/coach-capabilities';
import { COACH_GAME_EVENT_TYPES as GAME_EVENT_TYPES } from '@/lib/coach-tournament-games';
import type { RepCallUpPoolEntry } from '@/lib/types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CALL-UPS ON ONE GAME — the "Call up a player" sheet (mig 309; owner rulings R1–R6, 2026-09-22;
 * plan `docs/projects/active/COACH_CALL_UPS_PLAN.md` §4.1).
 *
 * A call-up is a player borrowed for one game. They are a roster row with `status = 'callup'`,
 * which every `status === 'active'` read in the portal already excludes — so they are absent from
 * dues, skills & goals, awards, documents, tryouts, family audiences, the roster count, every
 * season-long playing-time figure, Season Wrapped, the closed-season roster shelf and next
 * season's rollover, for free and for anything built later.
 *
 * ⚠⚠ **THIS ROUTE IS THE ONLY WAY A CALL-UP REACHES A GAME, AND THAT IS THE DESIGN.** Owner ruling
 * R3: however many call-ups a team has saved, a fresh game's builder offers NONE of them. The
 * saved pool lives behind the button (this GET) and in the roster page's Call-ups section, and
 * nowhere else on the page. A change that puts the pool into the builder at rest re-creates the
 * exact clutter this feature was asked for to remove.
 *
 * ⚠ **R5 — the gate is `lineups`, not `rosterWrite`.** Calling someone up is a decision made at a
 * field, often by the assistant running that game. It creates no money and no record that outlives
 * the game, so it sits with the job, and the job is building a lineup.
 *
 * ⚠ **R6 — a call-up may carry a phone and NEVER an email.** Enforced in the database as well
 * (`rep_roster_players_callup_no_email_check`), because the consequence of getting it wrong is
 * emailing a family that is not yours: every family audience in the product is built by collecting
 * `guardian_email`, so a call-up that cannot hold one cannot enter an audience even if some future
 * audience query forgets to filter on status.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

async function resolveCoachContext(orgSlug: string, teamId: string, eventId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  const event = await getRepTeamEventById(eventId);
  if (!event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }
  /**
   * ⚠ Games only. A call-up is borrowed to PLAY — there is no such thing as calling someone up to
   * a practice, and offering it there would put a borrowed child on a practice plan, a station
   * rotation and a practice attendance sheet, none of which this feature has an answer for.
   */
  if (!GAME_EVENT_TYPES.includes(event.eventType)) {
    return { error: NextResponse.json({ error: 'Call-ups are for games.' }, { status: 400 }) };
  }

  return { ctx, team, assignment, programYear, event };
}

const nameOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The wire shape of one saved call-up. Written once — the GET and the POST both answer with it. */
const poolRow = (e: RepCallUpPoolEntry) => ({
  playerId: e.player.id,
  playerFirstName: e.player.playerFirstName,
  playerLastName: e.player.playerLastName,
  playerNumber: e.player.playerNumber,
  gamesCalledUp: e.gamesCalledUp,
});

/** Everything the sheet needs, in one call: the season's pool, and who is already on this game. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;

  const [pool, linked] = await Promise.all([
    getRepCallUpPool(programYear.id),
    getRepCallUpsForEvent(eventId),
  ]);

  /**
   * ⚠ The sheet needs to know who is ALREADY on this game so it can show a tick instead of an Add —
   * hiding those rows would make it look like it had lost a name, and the question a coach has at
   * that moment is "did I already do this?". It derives that from `callUps`, which the builder
   * already holds; there is no separate `linkedIds` on the wire.
   */
  return NextResponse.json({
    pool: pool.map(poolRow),
    callUps: redactRoster(linked, assignment.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/call-ups' });

/**
 * Call someone up to this game — an existing name from the pool (`playerId`), or a new one
 * (`playerFirstName` + optional last name / number / phone), created and linked in one step so the
 * sheet's two paths cost the coach the same number of taps.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  let playerId: string | null = typeof body.playerId === 'string' ? body.playerId : null;

  if (playerId) {
    // Re-using a saved name: it must be a call-up of THIS season and THIS team. A roster player's
    // id sent here would otherwise quietly convert them into a borrowed player.
    // ⚠ One primary-key read, not the whole pool: validating an id by fetching every call-up and
    // counting every appearance in the season was two queries and a count map to answer a question
    // about one row.
    const existing = await getRepRosterPlayer(playerId, { includeCallUps: true });
    if (!existing || existing.status !== 'callup'
        || existing.teamId !== teamId || existing.programYearId !== programYear.id) {
      return NextResponse.json({ error: 'That call-up is not on this team’s list.' }, { status: 404 });
    }
  } else {
    const playerFirstName = nameOrNull(body.playerFirstName);
    if (!playerFirstName) {
      return NextResponse.json({ error: 'A first name is required.' }, { status: 400 });
    }
    const created = await createRepRosterPlayer({
      programYearId: programYear.id,
      teamId: team.id,
      orgId: ctx!.org.id,
      source: 'admin_manual',
      playerFirstName,
      playerLastName: nameOrNull(body.playerLastName),
      playerNumber: nameOrNull(body.playerNumber),
      // R6: a phone so a coach can reach someone at the field. No email, ever — the database
      // refuses one on a call-up row, so this is belt and braces rather than the only guard.
      guardianPhone: nameOrNull(body.guardianPhone),
      guardianEmail: null,
      // ⚠ ONE write. This used to insert an active player and immediately PATCH it to 'callup',
      // which left a window in which the row was a real active roster player — in the roster count,
      // in the dues list, in the roster order — and a phantom active player behind if the second
      // write failed.
      status: 'callup',
    });
    playerId = created.id;
  }

  await linkRepCallUpToEvent({
    eventId,
    playerId: playerId!,
    programYearId: programYear.id,
    teamId: team.id,
    orgId: ctx!.org.id,
    createdBy: ctx!.user.id,
  });

  /**
   * ⚠ **THE CALL-UP ROWS GO BACK WITH THE RESPONSE**, which is what lets the builder stop re-fetching
   * the whole lineup endpoint after every add. It used to return only ids, so the client asked the
   * lineup route for the rows it had just created — re-running auth, the team, the working year, the
   * event, the entire roster, attendance, the lineup, its entries and this same call-up read, roughly
   * ten queries and tens of KB, to recover one row this handler already had in hand.
   *
   * The pool is NOT returned: the sheet closes on success and re-reads it on next open, so a fresh
   * pool here was two queries and a count map for something never rendered.
   */
  const linked = await getRepCallUpsForEvent(eventId);
  return NextResponse.json({
    playerId,
    callUps: redactRoster(linked, assignment.capabilities),
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/call-ups' });

/**
 * Take a call-up off THIS game. Their saved entry and their other games are untouched.
 *
 * ⚠ **The lineup row goes with them, here, server-side.** Leaving a lineup entry behind would
 * strand a player the builder no longer offers: invisible in every list, still holding a batting
 * slot and a fielding position, still counted by the lineup check, and still printed on the card.
 * A client that forgot to clear it would produce a lineup nobody could fix from the screen.
 */
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;

  const playerId = new URL(req.url).searchParams.get('playerId');
  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  /**
   * ⚠ **VALIDATE THE ID BEFORE IT REACHES A WRITE.** `playerId` arrives on the query string and used
   * to be passed straight to a lineup rewrite — so this endpoint could be used to strip an ACTIVE
   * roster player out of a saved lineup while bypassing every guard the lineup PUT applies (the
   * admitted-player set, batting-order uniqueness, the nine-starter cap), leaving a lineup the PUT
   * would then refuse to re-save. No privilege escalation — the caller can already rewrite the
   * lineup — but an unvalidated id reaching a write is how that stops being true. Found by `/review`.
   */
  const linked = await getRepCallUpsForEvent(eventId);
  if (!linked.some(p => p.id === playerId)) {
    return NextResponse.json({ error: 'That player is not called up to this game.' }, { status: 404 });
  }

  const lineup = await getRepTeamLineupForEvent(eventId);
  if (lineup) await removePlayerFromSavedLineup(lineup.id, playerId);

  await unlinkRepCallUpFromEvent(eventId, playerId);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/call-ups' });
