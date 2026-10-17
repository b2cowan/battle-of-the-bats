import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { buildDuplicatePairs, mergePeople, rejectMatch } from '@/lib/families-read';
import { proposalHolding } from '@/lib/families-duplicates';
import { FAMILY_DUPLICATE_WORDS as DW } from '@/lib/families-words';
import { withObservability } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';

export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  const proposals = await buildDuplicatePairs(ctx.org.id);
  return NextResponse.json({ proposals });
}, { route: '/api/admin/families/duplicates' });

const ids = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string' && x.length > 0) ? (v as string[]) : null;

/**
 * Act on one proposal (Club Tier Stage 5b, Asks 7 and 18).
 *   { action: 'merge', keepId, mergeIds: [...] }  — every record in `mergeIds` into the keeper THE REVIEWER CHOSE
 *   { action: 'not_same', personIds: [...] }      — none of these is the same person (every pair among them remembered)
 *
 * ⚠ THE SERVER MERGES ONLY WHAT IT WOULD PROPOSE NOW (Ask 7): the duplicate rule (lib/families-duplicates.ts) is run
 * again on this request and the records must all stand in ONE proposal — a pair that was never proposed, was called
 * "not the same person", or stopped matching since the page loaded is refused (409), never merged. Until 5b the route
 * merged any two ids it was handed. Merging is NEVER automatic (plan §4): only an explicit decision reaches here. Every
 * decision goes to the club's audit log — the people's ids, never their details (org_person_merges keeps the snapshot).
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
  // `mergeId` (one) is the pre-5b body, accepted as a list of one.
  const mergeIds = ids(body.mergeIds) ?? (typeof body.mergeId === 'string' ? [body.mergeId] : null);
  const personIds = ids(body.personIds);
  if (action === 'merge' ? !keepId || !mergeIds : action === 'not_same' ? !personIds : true) {
    return NextResponse.json({ error: 'merge needs keepId and mergeIds; not_same needs personIds' }, { status: 400 });
  }

  const asked = action === 'merge' ? [keepId!, ...mergeIds!] : personIds!;
  const standing = proposalHolding(await buildDuplicatePairs(ctx.org.id), asked);
  if (!standing) return NextResponse.json({ error: DW.notProposed, code: 'not_proposed' }, { status: 409 });

  if (action === 'not_same') {
    for (let i = 0; i < asked.length; i++) {
      for (let j = i + 1; j < asked.length; j++) {
        const rejected = await rejectMatch(ctx.org.id, asked[i], asked[j], ctx.user.id);
        if (!rejected.ok) return NextResponse.json({ error: rejected.error }, { status: 400 });
      }
    }
    await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_not_same', { personIds: asked });
    return NextResponse.json({ ok: true });
  }

  // One transaction per record merged in (families_merge_people). A group merges one record at a time into the keeper;
  // a failure part-way says how many went, and the rest stays proposed.
  let merged = 0;
  for (const mergeId of mergeIds!) {
    const result = await mergePeople(ctx.org.id, keepId!, mergeId, ctx.user.id);
    if (!result.ok) {
      return NextResponse.json({ error: merged > 0 ? DW.partMerged(merged, mergeIds!.length) : result.error, merged }, { status: 400 });
    }
    merged++;
    await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_merged', { keptPersonId: keepId, mergedPersonId: mergeId });
  }
  return NextResponse.json({ ok: true, merged });
}, { route: '/api/admin/families/duplicates' });
