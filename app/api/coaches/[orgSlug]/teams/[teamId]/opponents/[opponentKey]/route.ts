import { NextResponse } from 'next/server';
import {
  getRepTeamOpponentByKey,
  ensureRepTeamOpponent,
  updateRepTeamOpponentSummary,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canViewScoutingBook, canWriteScoutingSummary, canJoinStaffChat } from '@/lib/coach-capabilities';
import {
  normalizeOpponentName, normalizeOpponentKeyParam,
  scoutingTagsForSport, OPPONENT_SUMMARY_MAX,
} from '@/lib/coach-opponents';
import { assembleOpponentCard } from '@/lib/coach-opponent-card';
import { getStaffChatRoom } from '@/lib/chat-service';
import { getSportPack } from '@/lib/sports';

/**
 * One opponent's card: cross-season meetings + the observation log + "the book line" +
 * the derived "numbers vs them" insight lines (P2). Keyed by NORMALIZED NAME
 * (URL-encoded), not row id — entries exist before any write mints a row, and aliases
 * resolve to the owning entry. Assembly lives in lib/coach-opponent-card so the staff-chat
 * share posts exactly what this serves. INSTRUMENT: off the season rail by decision (see
 * the list route's header comment).
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; opponentKey: string }> },) => {
  const { orgSlug, teamId, opponentKey } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canViewScoutingBook(assignment.capabilities), 'You do not have access to the scouting book.');
  if (denied) return denied;

  const key = normalizeOpponentKeyParam(opponentKey);
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sportPack = getSportPack(team.sport);
  // The room lookup is independent of the card — its one indexed query rides under the
  // heavier assembly instead of adding a round trip after it.
  const [card, staffRoom] = await Promise.all([
    assembleOpponentCard({ teamId, key, activeYearId: programYear.id, sportPack }),
    canJoinStaffChat(assignment.capabilities) ? getStaffChatRoom(ctx.org.id, teamId) : Promise.resolve(null),
  ]);
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { entry, observations, insights } = card;

  return NextResponse.json({
    opponent: { ...entry, observationCount: observations.length },
    observations,
    insights,
    // This entry's merged-away spellings (un-merge list) — served from the assembly's own
    // alias read, never a second fetch of the table.
    aliases: card.aliases,
    tags: scoutingTagsForSport(sportPack),
    canWriteSummary: canWriteScoutingSummary(assignment.capabilities),
    // The share door renders only where it can succeed: grant held AND the staff room
    // exists (a team below the staff-chat plan gate, or not yet healed, shows no button).
    canShareToStaffChat: staffRoom !== null,
    isHeadCoach: assignment.capabilities.isHeadCoach,
    viewerId: ctx.user.id,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents/[opponentKey]' });

export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; opponentKey: string }> },) => {
  const { orgSlug, teamId, opponentKey } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteScoutingSummary(assignment.capabilities), 'Only coaches with notes access can edit the book line.');
  if (denied) return denied;

  const key = normalizeOpponentKeyParam(opponentKey);
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rawSummary = typeof body.summary === 'string' ? body.summary.trim() : '';
  if (rawSummary.length > OPPONENT_SUMMARY_MAX) {
    return NextResponse.json({ error: `The book line is capped at ${OPPONENT_SUMMARY_MAX} characters` }, { status: 400 });
  }

  // Resolve the existing row FIRST (alias-aware): once P2 merges exist, the URL key may be
  // an alias of the owning row, whose canonical displayName won't normalize back to the
  // alias key — a strict equality check here would 400 every legitimate save from an
  // alias-reached card. Only a brand-new mint requires the spelling to match the key.
  let opponent = await getRepTeamOpponentByKey(teamId, key);
  const displayName = typeof body.displayName === 'string' && body.displayName.trim().length > 0
    ? body.displayName.trim().slice(0, 120)
    : key;
  if (!opponent) {
    if (normalizeOpponentName(displayName) !== key) {
      return NextResponse.json({ error: 'Display name does not match this opponent' }, { status: 400 });
    }
    opponent = await ensureRepTeamOpponent({ teamId, orgId: ctx.org.id, displayName });
  }
  // A same-key respelling ("oakville thunder" → "Oakville Thunder") is an allowed rename;
  // anything that normalizes differently is ignored rather than rejected — the display
  // name's identity is the row, not the request body.
  const rename = normalizeOpponentName(displayName) === opponent.normalizedName && displayName !== opponent.displayName
    ? displayName
    : undefined;
  const updated = await updateRepTeamOpponentSummary({
    opponentId: opponent.id,
    teamId,
    summary: rawSummary.length > 0 ? rawSummary : null,
    displayName: rename,
    updatedBy: ctx.user.id,
  });
  return NextResponse.json({ opponent: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents/[opponentKey]' });
