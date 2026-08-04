import { NextResponse } from 'next/server';
import {
  getRepTeamEventById,
  getRepTeamStaffForYear,
  getRepTeamOpponentByKey,
  ensureRepTeamOpponent,
  createRepTeamOpponentObservation,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canLogScoutingObservation } from '@/lib/coach-capabilities';
import {
  normalizeOpponentName, normalizeOpponentKeyParam, scoutingTagsForSport, OPPONENT_OBSERVATION_MAX,
} from '@/lib/coach-opponents';
import { getSportPack } from '@/lib/sports';

/**
 * Log an observation into the book (owner-ratified open-contribution model, 2026-08-04):
 * every schedule-holder — assistants AND Helpers — may log; entries are attributed
 * (created_by + display-name snapshot) and appear immediately; curation is the DELETE
 * route's job (head-coach-any / author-own). Mints the opponent row lazily.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; opponentKey: string }> },) => {
  const { orgSlug, teamId, opponentKey } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canLogScoutingObservation(assignment.capabilities), 'You do not have access to the scouting book.');
  if (denied) return denied;

  const key = normalizeOpponentKeyParam(opponentKey);
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const payload = await req.json().catch(() => ({}));
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (body.length < 1 || body.length > OPPONENT_OBSERVATION_MAX) {
    return NextResponse.json({ error: `An observation is 1–${OPPONENT_OBSERVATION_MAX} characters` }, { status: 400 });
  }

  const validTags = scoutingTagsForSport(getSportPack(team.sport));
  const tag = typeof payload.tag === 'string' && payload.tag.length > 0 ? payload.tag : null;
  if (tag && !validTags.includes(tag)) {
    return NextResponse.json({ error: 'Unknown tag' }, { status: 400 });
  }

  // Resolve the URL key to its CANONICAL owner first (the key itself may be an alias once
  // P2 merges exist) — every comparison below is against the canonical key, so an
  // alias-reached card and a canonically-named event still agree.
  const urlOwner = await getRepTeamOpponentByKey(teamId, key);
  const canonicalKey = urlOwner?.normalizedName ?? key;

  // Optional game linkage: the event must be this team's, and must be against THIS
  // opponent (directly or via alias) — a mislinked observation would render under the
  // wrong meeting forever.
  let eventId: string | null = null;
  let eventOpponentSpelling: string | null = null;
  if (typeof payload.eventId === 'string' && payload.eventId.length > 0) {
    const event = await getRepTeamEventById(payload.eventId);
    if (!event || event.teamId !== teamId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const eventKey = normalizeOpponentName(event.opponent);
    if (eventKey !== canonicalKey) {
      const eventOwner = eventKey ? await getRepTeamOpponentByKey(teamId, eventKey) : null;
      if (!eventOwner || eventOwner.normalizedName !== canonicalKey) {
        return NextResponse.json({ error: 'That game is not against this opponent' }, { status: 400 });
      }
    }
    eventId = event.id;
    eventOpponentSpelling = event.opponent;
  }

  // Already minted (directly or via alias): attach to the owner row. Otherwise mint, with
  // a display spelling that must normalize to the key: client's spelling > event's > key.
  let opponent = urlOwner;
  if (!opponent) {
    const displayName = typeof payload.opponentName === 'string' && payload.opponentName.trim().length > 0
      ? payload.opponentName.trim().slice(0, 120)
      : (eventOpponentSpelling ?? key);
    if (normalizeOpponentName(displayName) !== key) {
      return NextResponse.json({ error: 'Opponent name does not match this opponent' }, { status: 400 });
    }
    opponent = await ensureRepTeamOpponent({ teamId, orgId: ctx.org.id, displayName });
  }

  // Attribution snapshot (the practice-plan viewerName pattern): a label for display,
  // the user id for author-own deletion. A label match can miss; identity never does.
  const staff = await getRepTeamStaffForYear(programYear.id, ctx.org.id);
  const createdByName = staff.find(s => s.userId === ctx.user.id)?.displayName ?? null;

  const observation = await createRepTeamOpponentObservation({
    opponentId: opponent.id, teamId, orgId: ctx.org.id, eventId,
    body, tag, createdBy: ctx.user.id, createdByName,
  });
  return NextResponse.json({ observation, opponentId: opponent.id });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents/[opponentKey]/observations' });
