import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { openFamilyForm } from '@/lib/club-form-family-route';
import { readSignupForm } from '@/lib/club-form-server';
import { ensureSubmission, familyFormState, handoversFrom, pruneEmptySubmission, recordFamilyTicks, undoFamilyTicks } from '@/lib/club-form-family';
import { FAMILY_FORM_WORDS as W, YOUR_SIGNUP_FORM_WORDS as Y } from '@/lib/club-form-family-words';
import { registrationReference } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * POST   /api/league/[orgSlug]/[seasonSlug]/form/tick { token, documentId, versionId } — Your sign-up's re-tick (Board Ready
 *        Stage 4 Part 2; rulings 8, 20; drawing tab 7). The family ticks the CURRENT version of a document that asks
 *        them for a tick, once for every child of the sign-up it asks about; a PDF only after our server handed it over
 *        (its receipt). Saved at once. The children's places are never touched.
 * DELETE /api/league/[orgSlug]/[seasonSlug]/form/tick { token, tickIds } — Undo, for a few seconds after (only this
 *        sign-up's own ticks, within two minutes).
 * The possession proof is the family's link (`openFamilyForm`). Refused on a finished season.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  let body: { token?: unknown; documentId?: unknown; versionId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: Y.saveFailed }, { status: 400 }); }
  const door = await openFamilyForm(orgSlug, seasonSlug, body.token);
  if ('fail' in door) return door.fail;
  if (door.finished) return NextResponse.json({ error: Y.saveFailed, code: 'finished' }, { status: 409 });

  const read = await readSignupForm(door.formId);
  const state = await familyFormState({ formId: door.formId, rows: door.rows, signupKey: door.signupKey, teamsMade: door.teamsMade, finished: door.finished, read });
  const ask = state.asks.find(a => a.document.id === body.documentId);
  if (!ask) {
    // Already ticked (another tab, the other parent) or no longer asked: nothing to do, and nothing to undo.
    const current = state.form.documents.find(d => d.id === body.documentId);
    return current && current.versionId === body.versionId ? NextResponse.json({ ok: true, tickIds: [], at: new Date().toISOString() })
      : NextResponse.json({ error: Y.questionGone, code: 'form_changed' }, { status: 409 });
  }
  if (ask.document.versionId !== body.versionId) return NextResponse.json({ error: Y.questionGone, code: 'form_changed' }, { status: 409 });
  const jar = await cookies();
  const handedOver = handoversFrom(name => jar.get(name)?.value, [ask.document]).get(ask.document.id) ?? null;
  if (ask.document.source === 'pdf' && !handedOver) return NextResponse.json({ error: W.docNotOpened(ask.document.name), code: 'not_opened' }, { status: 400 });

  const ids = new Set(ask.children.map(c => c.child));
  const registrationIds = door.live.filter(r => ids.has(registrationReference(r.id))).map(r => r.id);
  const guardianEmail = door.live[0]?.guardian_email ?? '';
  try {
    const submissionId = await ensureSubmission(door.org.id, door.formId, door.signupKey, guardianEmail);
    const tickIds = await recordFamilyTicks({
      orgId: door.org.id, formId: door.formId, submissionId, guardianEmail, registrationIds, document: ask.document,
      fingerprint: read.versions.find(v => v.id === ask.document.versionId)!.fingerprint, handedOverAt: handedOver,
    });
    return NextResponse.json({ ok: true, tickIds, at: new Date().toISOString() });
  } catch (e) {
    console.error('[club-form-tick] saving a family tick failed:', (e as { code?: string })?.code ?? 'no code');
    await pruneEmptySubmission(door.formId, door.signupKey);
    return NextResponse.json({ error: Y.saveFailed }, { status: 500 });
  }
}, { route: '/api/league/[orgSlug]/[seasonSlug]/form/tick' });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  let body: { token?: unknown; tickIds?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: Y.undoFailed }, { status: 400 }); }
  const door = await openFamilyForm(orgSlug, seasonSlug, body.token);
  if ('fail' in door) return door.fail;
  const tickIds = Array.isArray(body.tickIds) ? body.tickIds.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];
  try {
    const undone = await undoFamilyTicks(door.formId, tickIds, door.live.map(r => r.id));
    if (undone === 0 && tickIds.length) return NextResponse.json({ error: Y.undoFailed }, { status: 409 });
    if (undone > 0) await pruneEmptySubmission(door.formId, door.signupKey);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[club-form-tick] undoing a family tick failed:', (e as { code?: string })?.code ?? 'no code');
    return NextResponse.json({ error: Y.undoFailed }, { status: 500 });
  }
}, { route: '/api/league/[orgSlug]/[seasonSlug]/form/tick' });
