import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildFamilyPage } from '@/lib/families-read';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * "Export their data" — the single most concentrated read in the product
 * (plan §6: the one argued hardest for). Everything the family page shows,
 * as one downloadable JSON file: the answer to "what do you hold about me".
 * Same double gate as every Families route; carries the same org-scoped read,
 * so it can never export another club's family.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  const { personId } = await params;
  const payload = await buildFamilyPage(ctx.org.id, personId);
  if (!payload) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const exportBody = {
    exportedAt: new Date().toISOString(),
    organization: ctx.org.name,
    note: 'Everything this organization holds about this family, assembled from the same reads the Families page uses.',
    ...payload,
  };
  const filename = `family-${payload.person.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  return new NextResponse(JSON.stringify(exportBody, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}, { route: '/api/admin/families/[personId]/export' });
