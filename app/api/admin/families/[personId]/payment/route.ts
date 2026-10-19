import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildFamilyPage } from '@/lib/families-read';
import { recordFamilyPayment } from '@/lib/families-payment';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * Record a payment (Club Tier Stage 5c, Parts B + C — the rules live in lib/families-payment.ts).
 *   POST { amountCents, receivedDate, method, note, lines: [{ key, cents }] } — every line is validated against a fresh
 *   plan before anything is written; then each house-league fee is marked paid (the Registrations tick's one write)
 *   and each rep line is handed to the team's head coach. It reports exactly what was done.
 * ⚖ No team's book is written here: a rep payment is recorded only by the coach's own Record money (Ask 26).
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;
  const { personId } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const page = await buildFamilyPage(ctx.org.id, personId);
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const result = await recordFamilyPayment(ctx, page, body);
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });
  return NextResponse.json(result);
}, { route: '/api/admin/families/[personId]/payment' });
