import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildFamilyPage } from '@/lib/families-read';
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
  const payload = await buildFamilyPage(ctx.org.id, personId);
  if (!payload) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(payload);
}, { route: '/api/admin/families/[personId]' });
