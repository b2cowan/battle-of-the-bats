import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { splitChild } from '@/lib/children-duplicates-read';
import { isUuid } from '@/lib/utils';
import { withObservability } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';

export const dynamic = 'force-dynamic';

/**
 * Split records (Club Tier Stage 14 S6, Ask 11): the seasons named in `seasonKeys` (the child page's own keys —
 * `rep:{entryId}`, `league:{signUpId}`) leave this child for a NEW one. Exact, because nothing was ever deleted: each season
 * keeps its entry, money and papers; parent links stay with the record kept; the pair is stored as "not the same child".
 *   POST — anyone who can open Families. 404 another org's child; 400 none or all of the seasons; 409 the seasons changed.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ childId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { childId } = await params;
  if (!isUuid(childId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const keys = Array.isArray(body.seasonKeys) && body.seasonKeys.every(k => typeof k === 'string') ? (body.seasonKeys as string[]) : null;
  if (!keys) return NextResponse.json({ error: 'split needs seasonKeys' }, { status: 400 });

  const result = await splitChild(gate.ctx.org.id, childId, keys, gate.ctx.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  // Ids and a count only — never names or dates.
  await writeOrgAudit(gate.ctx.org.id, gate.ctx.user.id, null, 'families_child_split', { keptChildId: childId, newChildId: result.newChildId, moved: result.moved });
  return NextResponse.json({ ok: true, newChildId: result.newChildId });
}, { route: '/api/admin/families/children/[childId]/split' });
