import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { openFamilyForm } from '@/lib/club-form-family-route';
import { answersOpen, checkFileUses, ensureSubmission, familyFormState, formGoneError, pruneEmptySubmission, saveFamilyAnswers } from '@/lib/club-form-family';
import { readSignupForm } from '@/lib/club-form-server';
import { answerError, answersIn, onceQuestions, perChildQuestions, readAnswer, type AnswerOut } from '@/lib/club-form-signup';
import { YOUR_SIGNUP_FORM_WORDS as Y } from '@/lib/club-form-family-words';
import { registrationReference } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/league/[orgSlug]/[seasonSlug]/form/answers { token, child | null, answers, clear } — Your sign-up's Change
 * (Board Ready Stage 4 Part 2; ruling 20; drawing tab 7). A family changes one child's answers (`child` = its registration
 * code) or the sign-up's own (`child` null), saved together (mig 515). Open until the child's division has its teams made
 * (the sign-up's own: while any child's is still open), never on a finished season; then the page names the club's
 * contact. A question added after they signed up can be answered here. Only the questions the form asks now; a required
 * one can't be cleared, but a blank one never blocks saving the rest (tab 7: Required turned on later is not enforced).
 * A health answer the page never shows is kept unless the family types a new one or clears it. Files follow the sign-up's
 * rules (still waiting, this question's, at most five with those kept). The answer is the sign-up's form state.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  let body: { token?: unknown; child?: unknown; answers?: unknown; clear?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: Y.saveFailed }, { status: 400 }); }
  const door = await openFamilyForm(orgSlug, seasonSlug, body.token);
  if ('fail' in door) return door.fail;

  const child = body.child == null ? null : door.childOf(body.child);
  if (body.child != null && !child) return NextResponse.json({ error: Y.saveFailed }, { status: 404 });
  const open = (r: { division_id: string | null }) => answersOpen(r, door.teamsMade, door.finished);
  if (child ? !open(child) : !door.live.some(open)) return NextResponse.json({ error: Y.afterTeams(door.org.name, null), code: 'closed' }, { status: 409 });

  const read = await readSignupForm(door.formId);
  const questions = child ? perChildQuestions(read.view) : onceQuestions(read.view);
  const byId = new Map(questions.map(q => [q.id, q]));
  const who = child?.player_first_name ?? null;
  const sent = answersIn(body.answers);
  const clear = (Array.isArray(body.clear) ? body.clear : []).filter((x): x is string => typeof x === 'string').slice(0, 100);
  if ([...sent.map(a => a.questionId), ...clear].some(id => !byId.has(id))) {
    return NextResponse.json({ error: Y.questionGone, code: 'form_changed' }, { status: 409 });
  }
  const errors: Record<string, string> = {};
  const answers: AnswerOut[] = [];
  for (const a of sent) {
    const q = byId.get(a.questionId)!;
    const r = readAnswer(q, a);
    if ('error' in r) errors[`q.${q.id}`] = answerError(q, who, 'invalid');
    else if (r.value) answers.push(r.value);
  }
  for (const id of clear) {
    const q = byId.get(id)!;
    if (q.required) errors[`q.${id}`] = answerError(q, who, 'missing');
  }
  // The files this sign-up keeps (those not replaced or cleared by this change) count toward its five.
  const before = await familyFormState({ formId: door.formId, rows: door.rows, signupKey: door.signupKey, teamsMade: door.teamsMade, finished: door.finished, read });
  const changing = new Set([...answers.map(a => a.questionId), ...clear]);
  const mine = child ? before.children.find(c => c.child === registrationReference(child.id))?.answers : before.once.answers;
  const kept = (mine ?? []).filter(a => a.file && !changing.has(a.questionId)).length;
  Object.assign(errors, await checkFileUses(door.formId, answers.map(answer => ({ answer, key: `q.${answer.questionId}`, who, set: 'this' })), byId, new Map([['this', kept]])));
  if (errors['this.files']) { errors.files = errors['this.files']; delete errors['this.files']; }
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 400 });

  const toClear = clear.filter(id => !answers.some(a => a.questionId === id));
  // Nothing to save makes no sign-up row; a save that fails or empties the sign-up leaves none behind (/legal 2026-11-20).
  if (answers.length || toClear.length) {
    try {
      const submissionId = await ensureSubmission(door.org.id, door.formId, door.signupKey, door.live[0]?.guardian_email ?? '');
      await saveFamilyAnswers({ formId: door.formId, submissionId, subject: child?.id ?? null, answers, clear: toClear });
    } catch (e) {
      const gone = formGoneError(e);
      console.error('[club-form-answers] saving a family change failed:', gone ?? (e as { code?: string })?.code ?? 'no code');
      await pruneEmptySubmission(door.formId, door.signupKey);
      return gone ? NextResponse.json({ error: Y.questionGone, code: 'form_changed' }, { status: 409 }) : NextResponse.json({ error: Y.saveFailed }, { status: 500 });
    }
    if (toClear.length) await pruneEmptySubmission(door.formId, door.signupKey);
  }
  const state = await familyFormState({ formId: door.formId, rows: door.rows, signupKey: door.signupKey, teamsMade: door.teamsMade, finished: door.finished, read });
  return NextResponse.json({ ok: true, state });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/form/answers' });
