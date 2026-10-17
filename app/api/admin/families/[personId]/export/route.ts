import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildFamilyFile } from '@/lib/families-export';
import { writeOrgAudit } from '@/lib/org-audit';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * A family's Export (Club Tier Stage 5a, P5 — Asks 10, 11). The club's administrative file on the family
 * (lib/families-export.ts), which says exactly what it holds and what it does not (lib/family-file.ts — one list).
 *
 *   ?format=json  — the structured file, downloaded (a request to move the data elsewhere).
 *   ?format=pdf   — the same file as data, which the browser draws as the house PDF (lib/export/pdf.ts
 *                   `downloadFamilyFile`) — the PDF is drawn client-side like every document here.
 *
 * Every export goes to the club's audit log, with its format (never its contents). The three-check gate as every
 * Families route; the org-scoped read can never export another club's family.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  const format = new URL(req.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'json';
  const { personId } = await params;
  const file = await buildFamilyFile(ctx.org.id, ctx.org.name, personId, ctx.user.id);
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'family_exported', { personId, format });

  // Guardian PII and children's medical notes: never cached, never sniffed (/review 2026-10-17).
  const safe = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (format === 'pdf') return NextResponse.json({ file }, { headers: safe });
  const filename = `family-file-${file.family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  return new NextResponse(JSON.stringify(file, null, 2), {
    status: 200,
    headers: {
      ...safe,
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}, { route: '/api/admin/families/[personId]/export' });
