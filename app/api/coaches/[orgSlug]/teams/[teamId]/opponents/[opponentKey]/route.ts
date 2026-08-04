import { NextResponse } from 'next/server';
import {
  getRepTeamGameEventsForOpponentBook,
  getRepTeamOpponents,
  getRepTeamOpponentAliases,
  getRepTeamOpponentObservations,
  getRepTeamOpponentByKey,
  ensureRepTeamOpponent,
  updateRepTeamOpponentSummary,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canViewScoutingBook, canWriteScoutingSummary } from '@/lib/coach-capabilities';
import {
  buildOpponentBook, normalizeOpponentName, normalizeOpponentKeyParam,
  scoutingTagsForSport, OPPONENT_SUMMARY_MAX,
} from '@/lib/coach-opponents';
import { getSportPack } from '@/lib/sports';

/**
 * One opponent's card: cross-season meetings + the observation log + "the book line".
 * Keyed by NORMALIZED NAME (URL-encoded), not row id — entries exist before any write
 * mints a row, and aliases resolve to the owning entry. INSTRUMENT: off the season rail
 * by decision (see the list route's header comment).
 */
async function loadEntry(teamId: string, key: string) {
  const [events, opponents, aliases] = await Promise.all([
    getRepTeamGameEventsForOpponentBook(teamId),
    getRepTeamOpponents(teamId),
    getRepTeamOpponentAliases(teamId),
  ]);
  // Observation counts are NOT fetched here: this route serves ONE opponent, and its count
  // is just `observations.length` from the per-opponent read below — a team-wide count scan
  // would be a redundant round trip on every card view.
  const entries = buildOpponentBook({
    events, opponents, aliases,
    nowIso: new Date().toISOString(),
  });
  // The key may be an alias of the owning entry — normalize then look both ways.
  const direct = entries.find(e => e.key === key);
  if (direct) return direct;
  const aliased = aliases.find(a => a.normalizedAlias === key);
  if (!aliased) return null;
  const owner = opponents.find(o => o.id === aliased.opponentId);
  return owner ? entries.find(e => e.key === owner.normalizedName) ?? null : null;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; opponentKey: string }> },) => {
  const { orgSlug, teamId, opponentKey } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(canViewScoutingBook(assignment.capabilities), 'You do not have access to the scouting book.');
  if (denied) return denied;

  const key = normalizeOpponentKeyParam(opponentKey);
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entry = await loadEntry(teamId, key);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const observations = entry.opponentId
    ? await getRepTeamOpponentObservations(teamId, entry.opponentId)
    : [];

  return NextResponse.json({
    opponent: { ...entry, observationCount: observations.length },
    observations,
    tags: scoutingTagsForSport(getSportPack(team.sport)),
    canWriteSummary: canWriteScoutingSummary(assignment.capabilities),
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
