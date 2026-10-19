import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { createNote } from '@/lib/families-notes';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * A family's notes (Club Tier Stage 5c, Part D — lib/families-notes.ts holds the rules). The list rides the family
 * record's own read; this adds one.
 *   POST { body } — anyone who can open Families.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { personId } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const r = await createNote(gate.ctx, personId, body.body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r, { status: 201 });
}, { route: '/api/admin/families/[personId]/notes' });
