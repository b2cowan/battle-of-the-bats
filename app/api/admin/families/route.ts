import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildWorklist } from '@/lib/families-read';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  const payload = await buildWorklist(ctx.org.id, ctx.org.slug);
  return NextResponse.json(payload);
}, { route: '/api/admin/families' });
