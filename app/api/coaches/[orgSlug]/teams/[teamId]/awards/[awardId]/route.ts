import { NextResponse } from 'next/server';
import {
  getRepRosterPlayers,
  getRepTeamAwardTypeLibrary,
  findRepPlayerAwardCollision,
  getRepPlayerAwardById,
  updateRepPlayerAward,
  deleteRepPlayerAward,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageAwards } from '@/lib/coach-capabilities';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { describeAwardOccasion } from '@/lib/rep-award-occasion';

// Both verbs need the caller to actually manage awards AND a live season — an award is a live
// instrument, and the DELETE route resolves the ACTIVE year regardless of what screen renders it.
async function resolveAwardWriteContext(orgSlug: string, teamId: string) {
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved;
  const denied = denyUnless(canManageAwards(resolved.assignment.capabilities), 'You do not have access to awards.');
  if (denied) return { error: denied };
  return resolved;
}

// Undo a mis-click — a hard delete of the record itself (distinct from retiring an award
// TYPE, which never deletes). Scoped by team_id, so an award can only be removed by a coach
// of its own team.
// DELIBERATELY not year-scoped (Batch 3 verification flagged this as a possible hole; it is
// intent): awards are the team's ALL-TIME history — the Awards page lists every season and
// the current head coach curates that record, including fixing a past season's mis-award.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; awardId: string }> },) => {
  const { orgSlug, teamId, awardId } = await params;
  const resolved = await resolveAwardWriteContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const deleted = await deleteRepPlayerAward(awardId, teamId);
  if (!deleted) return NextResponse.json({ error: 'Award not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/awards/[awardId]' });

// Fix a mis-given award without a delete-and-redo — same validation as giving one (POST on the
// collection route), minus eventId: WHICH GAME an award is for is not editable here (a wrong game
// is remove-and-re-give, the same as a tag on the wrong event). Also not year-scoped, for the
// same reason DELETE isn't — this curates the team's all-time history.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; awardId: string }> },) => {
  const { orgSlug, teamId, awardId } = await params;
  const resolved = await resolveAwardWriteContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, programYear } = resolved;

  const body = await req.json().catch(() => ({}));
  const fields: { playerId?: string; awardTypeId?: string; tournamentLabel?: string | null; note?: string | null } = {};

  const [roster, awardTypes, current] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamAwardTypeLibrary(teamId, ctx.org.id, { includeRetired: true }),
    getRepPlayerAwardById(awardId, teamId),
  ]);
  if (!current) return NextResponse.json({ error: 'Award not found' }, { status: 404 });

  if (body.playerId !== undefined) {
    if (typeof body.playerId !== 'string') {
      return NextResponse.json({ error: 'playerId must be a string' }, { status: 400 });
    }
    const player = roster.find(p => p.id === body.playerId && p.status === 'active');
    if (!player) {
      return NextResponse.json({ error: 'That player is not on the active roster' }, { status: 400 });
    }
    fields.playerId = body.playerId;
  }

  if (body.awardTypeId !== undefined) {
    if (typeof body.awardTypeId !== 'string') {
      return NextResponse.json({ error: 'awardTypeId must be a string' }, { status: 400 });
    }
    // Retired types don't come back from `getRepTeamAwardTypeLibrary`'s active default, so an
    // award already given under one that has since been retired must still be an allowed KEEP —
    // otherwise saving an unrelated field on the same award would fail on a type the coach never
    // touched. Accepting the incoming id when it matches an award that already carries it (below)
    // covers that; a genuinely unknown id is refused either way.
    if (!awardTypes.some(t => t.id === body.awardTypeId)) {
      return NextResponse.json({ error: 'That award type is not available for this team' }, { status: 400 });
    }
    fields.awardTypeId = body.awardTypeId;
  }

  if (body.tournamentLabel !== undefined) {
    // Mutually exclusive by construction, same as create (see rep_player_awards gotcha 1) — an
    // event-linked award has no occasion label to edit; the game it's for isn't editable either.
    if (current.eventId) {
      return NextResponse.json({ error: 'This award is linked to a game — it has no occasion label to change' }, { status: 400 });
    }
    fields.tournamentLabel = typeof body.tournamentLabel === 'string'
      ? body.tournamentLabel.trim().slice(0, 80) || null
      : null;
  }

  if (body.note !== undefined) {
    fields.note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  // R5 (owner, 2026-09-11): a player holds a given award once per occasion. Uses the award's
  // CURRENT event/date/label — whichever of player/type wasn't in the patch keeps its own value.
  const playerId = fields.playerId ?? current.playerId;
  const awardTypeId = fields.awardTypeId ?? current.awardTypeId;
  const collision = await findRepPlayerAwardCollision(
    teamId,
    playerId,
    awardTypeId,
    { eventId: current.eventId, tournamentLabel: current.tournamentLabel, awardedAt: current.awardedAt },
    awardId,
  );
  if (collision) {
    const type = awardTypes.find(t => t.id === awardTypeId);
    const player = roster.find(p => p.id === playerId);
    const playerName = player ? [player.playerFirstName, player.playerLastName].filter(Boolean).join(' ') : 'That player';
    return NextResponse.json(
      { error: `${playerName} already has ${type?.name ?? 'that award'} ${describeAwardOccasion(current)}.` },
      { status: 409 },
    );
  }

  const updated = await updateRepPlayerAward(awardId, teamId, fields);
  if (!updated) return NextResponse.json({ error: 'Award not found' }, { status: 404 });
  return NextResponse.json({ award: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/awards/[awardId]' });
