import { NextResponse } from 'next/server';
import { deleteRepPlayerMeasurable, correctRepPlayerMeasurable } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { readMeasurableCorrectionInput } from '@/lib/development-input';
import { resolveDevelopmentPlayerContext } from '@/lib/development-player-route';

// The context — the coach, the player, the season guard (F04: a finished season's reading is a
// record, and "read-only" holds beyond navigation) and the grant — is the shared per-player resolver.
const resolveContext = (orgSlug: string, teamId: string, playerId: string) =>
  resolveDevelopmentPlayerContext(orgSlug, teamId, playerId, 'results');

/**
 * A CORRECTION (plan §9, mig 295): editing a saved reading keeps the original value on the row and
 * never shows two active readings. Only the value (and the note) — the attempt, the test, the
 * session and the date are the record's identity; a wrong one is removed and re-entered.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; entryId: string }> },) => {
  const { orgSlug, teamId, playerId, entryId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const read = readMeasurableCorrectionInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const entry = await correctRepPlayerMeasurable(entryId, teamId, playerId, { ...read.fields, correctedBy: resolved.ctx.user.id });
  // Null = no row matched: not this player's, or another correction landed first (the write is
  // guarded on the value it read). Either way the screen reloads the row rather than overwriting.
  if (!entry) return NextResponse.json({ error: 'That reading changed underneath you — reload the row and try again.' }, { status: 409 });
  return NextResponse.json({ entry });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/measurables/[entryId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; entryId: string }> },) => {
  const { orgSlug, teamId, playerId, entryId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;

  // The URL names the player — an entry id from another player 404s via the player_id
  // scope on the delete query itself (awards precedent), no ownership pre-fetch.
  const deleted = await deleteRepPlayerMeasurable(entryId, teamId, playerId);
  if (!deleted) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/measurables/[entryId]' });
