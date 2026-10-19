import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildFamilyPage } from '@/lib/families-read';
import { handoffChips, handoffHistory, paymentPlan, readHandoffs } from '@/lib/families-payment';
import { readNotes } from '@/lib/families-notes';
import type { FamilyRecordPayload } from '@/lib/families-payment-plan';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  const { personId } = await params;
  // The read scopes to ctx.org.id — a personId from another org is "not found",
  // never a hint that it exists elsewhere.
  // Club Tier Stage 5c: the hand-offs (chips, History lines) and the notes need only the person, so they start beside the
  // page's org-wide read; Record a payment's lines (what this member can do, line by line) need the page.
  const own = Promise.all([
    readHandoffs(ctx.org.id, personId).then(async rows => ({ rows, lines: await handoffHistory(ctx.org.id, rows) })),
    readNotes(ctx.org.id, personId, ctx),
  ]);
  own.catch(() => {}); // a 404 below must not leave this rejection unhandled; the await rethrows it otherwise
  const page = await buildFamilyPage(ctx.org.id, personId);
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [{ plan }, [{ rows: handoffs, lines: handoffLines }, notes]] = await Promise.all([paymentPlan(ctx, page), own]);
  const history = [...page.history, ...handoffLines]
    .sort((x, y) => (y.at ?? '').localeCompare(x.at ?? '')).slice(0, 30);
  const payload: FamilyRecordPayload = { ...page, history, payment: plan, handoffChips: handoffChips(page, handoffs), notes };
  return NextResponse.json(payload);
}, { route: '/api/admin/families/[personId]' });
