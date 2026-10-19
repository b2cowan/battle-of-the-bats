import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { deleteNote, updateNote } from '@/lib/families-notes';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * One of a family's notes (Club Tier Stage 5c, Part D — lib/families-notes.ts holds the rules).
 *   PATCH  { body } — its author only (the edit autosaves).
 *   DELETE — its author or the owner; an org audit line keeps who and when, never the words.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string; noteId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { personId, noteId } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const r = await updateNote(gate.ctx, personId, noteId, body.body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}, { route: '/api/admin/families/[personId]/notes/[noteId]' });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string; noteId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { personId, noteId } = await params;
  const r = await deleteNote(gate.ctx, personId, noteId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/families/[personId]/notes/[noteId]' });
