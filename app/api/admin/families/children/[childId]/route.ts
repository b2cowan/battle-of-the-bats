import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildChildPage } from '@/lib/child-page';
import { isUuid } from '@/lib/utils';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * The club's child page (Club Tier Stage 14 S5): every season of one child, rep teams and house league together. Behind
 * the Families gate — a child spans teams, so a member limited to a group of teams is refused, as for a household.
 * The read scopes to the org: another club's child is "not found", never a hint that it exists elsewhere.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ childId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { childId } = await params;
  if (!isUuid(childId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const page = await buildChildPage(gate.ctx.org.id, childId);
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(page);
}, { route: '/api/admin/families/children/[childId]' });
