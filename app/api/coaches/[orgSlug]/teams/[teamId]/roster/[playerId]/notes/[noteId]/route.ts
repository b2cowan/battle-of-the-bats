import { NextResponse } from 'next/server';
import { getRepPlayerNote, updateRepPlayerNote, deleteRepPlayerNote } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { readPlayerNoteInput } from '@/lib/development-input';
import { resolveDevelopmentPlayerContext, assertGoalBelongsToPlayer, assertEventBelongsToSeason } from '@/lib/development-player-route';

/**
 * Edit or remove ONE general note (mig 296). Only a general note is edited here — a moment, an
 * observation or a review is edited at its source. Same gate as writing one: the Development
 * grant AND notes; team + player scoped in every query.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; noteId: string }> },) => {
  const { orgSlug, teamId, playerId, noteId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;
  const { player } = resolved;

  const existing = await getRepPlayerNote(noteId, teamId, playerId);
  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const read = readPlayerNoteInput(body, 'patch');
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const fields = read.fields;
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });

  const [badGoal, badEvent] = await Promise.all([
    fields.goalId !== undefined ? assertGoalBelongsToPlayer(teamId, playerId, fields.goalId) : Promise.resolve(null),
    fields.eventId !== undefined ? assertEventBelongsToSeason(player.programYearId, fields.eventId) : Promise.resolve(null),
  ]);
  const bad = badGoal ?? badEvent;
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const note = await updateRepPlayerNote(noteId, teamId, playerId, fields);
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  return NextResponse.json({ note });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/notes/[noteId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; noteId: string }> },) => {
  const { orgSlug, teamId, playerId, noteId } = await params;
  const resolved = await resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'goals');
  if ('error' in resolved) return resolved.error!;
  const gone = await deleteRepPlayerNote(noteId, teamId, playerId);
  if (!gone) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/notes/[noteId]' });
