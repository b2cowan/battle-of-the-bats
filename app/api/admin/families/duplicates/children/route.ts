import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { childProposalHolding } from '@/lib/children-duplicates';
import { buildChildProposals, joinChildren, rejectChildren } from '@/lib/children-duplicates-read';
import { CHILD_JOIN_WORDS as W } from '@/lib/child-join-words';
import { withObservability } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';

export const dynamic = 'force-dynamic';

/** The Children half of Families › Duplicates (Club Tier Stage 14 S6, Ask 11): the proposals standing now. */
export const GET = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  return NextResponse.json({ proposals: await buildChildProposals(ctx.org.id) });
}, { route: '/api/admin/families/duplicates/children' });

const ids = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string' && x.length > 0) ? (v as string[]) : null;

/**
 * Act on one proposal.
 *   { action: 'join', keepId, mergeIds: [...] }  — every record in `mergeIds` into the keeper THE REVIEWER CHOSE (it keeps its
 *                                                   name and birth date; every season's entry, money and papers stay as they are)
 *   { action: 'not_same', childIds: [...] }       — none of these is the same child (every pair among them remembered)
 *
 * ⚠ THE SERVER JOINS ONLY WHAT IT WOULD PROPOSE NOW (the parents' queue's rule): the rule (lib/children-duplicates.ts) is
 * run again on this request and the records must all stand in ONE proposal — a pair that was never proposed, was called "not
 * the same child", or stopped matching since the page loaded is refused (409), never joined. A pair on one team in one
 * season is refused in the drawn words (the database refuses it too). Joining is NEVER automatic: only an explicit decision
 * reaches here, and every decision goes to the club's audit log — the children's ids, never their details. A join can be
 * split again from the child's page.
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
  const mergeIds = ids(body.mergeIds);
  const childIds = ids(body.childIds);
  if (action === 'join' ? !keepId || !mergeIds : action === 'not_same' ? !childIds : true) {
    return NextResponse.json({ error: 'join needs keepId and mergeIds; not_same needs childIds' }, { status: 400 });
  }

  const asked = action === 'join' ? [keepId!, ...mergeIds!] : childIds!;
  // The card's description lines aren't needed to decide what is standing, only who matches and what blocks.
  const standing = childProposalHolding(await buildChildProposals(ctx.org.id, { detail: false }), asked);
  if (!standing) return NextResponse.json({ error: W.notProposed, code: 'not_proposed' }, { status: 409 });

  if (action === 'not_same') {
    await rejectChildren(asked, ctx.user.id);
    await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_children_not_same', { childIds: asked });
    return NextResponse.json({ ok: true });
  }

  const result = await joinChildren(keepId!, mergeIds!, standing.blockedBy);
  // One audit line per record joined in, even when the group stopped part-way.
  for (const absorbed of mergeIds!.slice(0, result.joined ?? (result.ok ? mergeIds!.length : 0))) {
    await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_children_joined', { keptChildId: keepId, joinedChildId: absorbed });
  }
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code, joined: result.joined ?? 0 }, { status: result.status });
  return NextResponse.json({ ok: true, joined: result.joined });
}, { route: '/api/admin/families/duplicates/children' });
