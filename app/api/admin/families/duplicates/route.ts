import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildDuplicatePairs, mergePeople, rejectMatch } from '@/lib/families-read';
import { withObservability } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';

export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  const pairs = await buildDuplicatePairs(ctx.org.id);
  return NextResponse.json({ pairs });
}, { route: '/api/admin/families/duplicates' });

/**
 * Act on one pair. body: { action: 'merge' | 'not_same', keepId, mergeId }
 * (for not_same the ids are just the pair — order does not matter).
 *
 * Merging is NEVER automatic (plan §4): this route only ever runs on an
 * explicit human decision from the review queue. Both decisions go to the club's audit log (Club Tier Stage 5a, E07) —
 * the two people's ids, never their details (the merge's own record, org_person_merges, keeps the snapshot).
 */
export const POST = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const action = body.action;
  const keepId = typeof body.keepId === 'string' ? body.keepId : null;
  const mergeId = typeof body.mergeId === 'string' ? body.mergeId : null;
  if (!keepId || !mergeId || (action !== 'merge' && action !== 'not_same')) {
    return NextResponse.json({ error: 'action (merge|not_same), keepId and mergeId are required' }, { status: 400 });
  }

  if (action === 'not_same') {
    const rejected = await rejectMatch(ctx.org.id, keepId, mergeId, ctx.user.id);
    if (!rejected.ok) return NextResponse.json({ error: rejected.error }, { status: 400 });
    await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_not_same', { personIds: [keepId, mergeId] });
    return NextResponse.json({ ok: true });
  }

  const result = await mergePeople(ctx.org.id, keepId, mergeId, ctx.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_merged', { keptPersonId: keepId, mergedPersonId: mergeId });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/families/duplicates' });
