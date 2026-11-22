import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  answerError, answerName, checkAnswers, fileRefusal, readAnswer, sizeLine, tickState, usesDropdown, type SignupQuestion,
} from '../../lib/club-form-signup.ts';
import { FAMILY_FORM_WORDS as W, YOUR_SIGNUP_FORM_WORDS as Y } from '../../lib/club-form-family-words.ts';

/**
 * BOARD READY STAGE 4 PART 2 — THE CLUB'S SIGN-UP FORM AS A FAMILY MEETS IT (drawing tabs 5 and 7; owner rulings 1–20,
 * 2026-11-20; call C3). The page and the routes read lib/club-form-signup.ts alike; these pin its rules, and the build
 * rules the code must keep (answers saved inside the placement; a PDF's tick needs our server's hand-over; health answers
 * and files never kept across a reload; a health answer's words never sent back to Your sign-up).
 */

const q = (over: Partial<SignupQuestion> = {}): SignupQuestion => ({
  id: '11111111-1111-4111-8111-111111111111', type: 'one_choice', label: 'T-shirt size', helpText: null,
  choices: [{ id: 'ys', label: 'YS' }, { id: 'ym', label: 'YM' }], required: true, asked: 'per_subject', health: false, ...over,
});
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('an answer, read against its question', () => {
  test('a choice must be one the question offers; one choice holds one', () => {
    assert.deepEqual(readAnswer(q(), { questionId: q().id, choiceIds: ['ym'] }), { value: { questionId: q().id, choiceIds: ['ym'] } });
    assert.deepEqual(readAnswer(q(), { questionId: q().id, choiceIds: ['xl'] }), { error: 'invalid' });
    assert.deepEqual(readAnswer(q(), { questionId: q().id, choiceIds: ['ys', 'ym'] }), { error: 'invalid' });
    // Many choices come back in the question's own order.
    assert.deepEqual(readAnswer(q({ type: 'many_choices' }), { questionId: q().id, choiceIds: ['ym', 'ys'] }), { value: { questionId: q().id, choiceIds: ['ys', 'ym'] } });
  });
  test('blank is "nothing given", never an error', () => {
    assert.deepEqual(readAnswer(q({ type: 'short_answer' }), { questionId: q().id, text: '   ' }), { value: null });
    assert.deepEqual(readAnswer(q({ type: 'yes_no' }), { questionId: q().id, bool: null }), { value: null });
    assert.deepEqual(readAnswer(q(), undefined), { value: null });
  });
  test('a date must be a real day; a file names an id', () => {
    assert.deepEqual(readAnswer(q({ type: 'date' }), { questionId: q().id, date: '2027-02-30' }), { error: 'invalid' });
    assert.deepEqual(readAnswer(q({ type: 'date' }), { questionId: q().id, date: '2027-02-28' }), { value: { questionId: q().id, date: '2027-02-28' } });
    assert.deepEqual(readAnswer(q({ type: 'file' }), { questionId: q().id, fileId: 'nope' }), { error: 'invalid' });
  });
  test('Required is checked, but never on a file question (ruling 9)', () => {
    const r = checkAnswers([q(), q({ id: '22222222-2222-4222-8222-222222222222', type: 'file', required: true })], [], 'Leo', id => `c.${id}`);
    assert.deepEqual(Object.keys(r.errors), [`c.${q().id}`]);
    assert.deepEqual(r.missing, [`c.${q().id}`]);
  });
});

describe('the words under a field and in the error box (tab 5)', () => {
  test('a short noun label reads as the drawing: "Choose a T-shirt size for Leo."', () => {
    assert.equal(answerError(q(), 'Leo', 'missing'), 'Choose a T-shirt size for Leo.');
    assert.equal(answerName(q(), 'Leo'), 'T-shirt size for Leo');
  });
  test('a label written as a question is quoted', () => {
    const asked = q({ label: 'How did you hear about us?' });
    assert.equal(answerError(asked, null, 'missing'), 'Answer “How did you hear about us?”.');
    assert.equal(answerName(asked, null), '“How did you hear about us?”');
  });
  test('the box counts and names the first', () => {
    assert.equal(W.errorsMissing(2, 'T-shirt size for Leo'), '2 answers are missing. The first is T-shirt size for Leo.');
  });
  test('the club\'s privacy link and the health line', () => {
    assert.equal(W.privacyLink('Riverdale Minor Ball'), 'Riverdale Minor Ball’s privacy policy');
    assert.equal('notice' in W, false, 'the fixed notice was removed (owner, 2026-11-21)');
    assert.equal(W.healthLine('Riverdale Minor Ball', 'Maya'), 'Only answer what Riverdale Minor Ball needs to keep Maya safe.');
  });
  test('a reload says what it did not keep (call C3)', () => {
    assert.equal(W.reloadLost(true, false), 'Answers to health questions weren’t kept when the page reloaded. Please answer them again.');
  });
  test('one choice: round buttons up to four, a dropdown from five', () => {
    const five = q({ choices: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, label: id })) });
    assert.equal(usesDropdown(q()), false);
    assert.equal(usesDropdown(five), true);
  });
});

describe('a tick on a document (ruling 8)', () => {
  const versions = [
    { id: 'v3', versionNo: 3, ticksStand: false },
    { id: 'v2', versionNo: 2, ticksStand: true },
    { id: 'v1', versionNo: 1, ticksStand: null },
  ];
  test('current, standing, needing a new tick, never ticked', () => {
    assert.equal(tickState(versions, [{ versionId: 'v3', moved: false }]), 'current');
    assert.equal(tickState(versions.slice(1), [{ versionId: 'v1', moved: false }]), 'stands');
    assert.equal(tickState(versions, [{ versionId: 'v2', moved: false }]), 'again');
    assert.equal(tickState(versions, []), 'none');
  });
  test('a tick moved in with the waiver counts as one on version 1', () => {
    assert.equal(tickState(versions.slice(1), [{ versionId: null, moved: true }]), 'stands');
    assert.equal(tickState(versions, [{ versionId: null, moved: true }]), 'again');
  });
});

describe('a family file, checked before it travels (ruling 9)', () => {
  test('too big and the wrong kind are refused in words', () => {
    assert.equal(fileRefusal({ size: 11.4 * 1024 * 1024, type: 'image/heic', name: 'IMG_2041.HEIC' }), 'too_big');
    assert.equal(fileRefusal({ size: 1000, type: 'text/html', name: 'a.html' }), 'type');
    assert.equal(fileRefusal({ size: 1000, type: '', name: 'IMG_1.HEIC' }), null);
    assert.equal(W.fileTooBig(sizeLine(11.4 * 1024 * 1024), true), 'This photo is 11.4 MB. The limit is 8 MB. Choose a smaller photo or a PDF.');
    assert.equal(sizeLine(412 * 1024), '412 KB');
  });
});

describe('the build rules (Part 2)', () => {
  test('answers, files and ticks are saved INSIDE the placement, never after it', () => {
    const route = read('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');
    assert.doesNotMatch(route, /recordTicks\(/);
    assert.match(route, /form: childAnswers\[i\]\.length/);
    assert.match(read('lib/league-registration-place.ts'), /rpc\('club_form_place_signup'/);
    assert.match(read('supabase/migrations/515_a_signup_saves_its_answers_with_the_child.sql'), /FROM league_registration_place\(/);
  });
  test('a PDF tick needs the receipt our server handed over', () => {
    const route = read('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');
    assert.match(route, /d\.source === 'pdf' && !handedOver\.has\(d\.id\)/);
    assert.match(read('app/api/league/[orgSlug]/[seasonSlug]/form/tick/route.ts'), /ask\.document\.source === 'pdf' && !handedOver/);
  });
  test('a reload never keeps a health answer or a file (call C3)', () => {
    const page = read('components/league/RegisterForm.tsx');
    assert.match(page, /const strip = \(a: Record<string, AnswerDraft>\) => Object\.fromEntries\(Object\.entries\(a\)\.filter\(\(\[id\]\) => !health\.has\(id\) && !fileQs\.has\(id\)\)\)/);
    assert.match(page, /answers: strip\(c\.answers\)/);
    assert.match(page, /once: strip\(once\)/);
  });
  test('a health answer\'s words never go back to Your sign-up', () => {
    assert.match(read('lib/club-form-family.ts'), /if \(health\.get\(a\.question_id\)\) return \[\{ questionId: a\.question_id, hidden: true/);
    assert.match(Y.healthKept, /isn’t shown here/);
  });
  test('a family file is checked from its bytes, and the upload is rate-limited', () => {
    const upload = read('app/api/league/[orgSlug]/[seasonSlug]/form/files/route.ts');
    assert.match(upload, /checkDocumentUpload\(bytes, file\.name \|\| 'file', FAMILY_FILE_KINDS\)/);
    assert.match(upload, /throttleSignupFiles\(req\)/);
  });
  test('nothing says "scanned" or "virus-checked" (/legal)', () => {
    for (const p of ['lib/club-form-family-words.ts', 'components/league/SignupFormFields.tsx', 'components/league/YourSignupForm.tsx']) {
      assert.doesNotMatch(read(p), /scanned|virus/i, p);
    }
  });
});

describe('the sentences a family reads (review fixes, 2026-11-20)', () => {
  test('a label reads as an ordinary noun with the right article, a plural or a question is quoted', () => {
    assert.equal(answerError(q({ label: 'T-shirt size' }), 'Leo', 'missing'), 'Choose a T-shirt size for Leo.');
    assert.equal(answerError(q({ label: 'Uniform size' }), 'Leo', 'missing'), 'Choose a uniform size for Leo.');
    assert.equal(answerError(q({ label: 'Extra day' }), 'Leo', 'missing'), 'Choose an extra day for Leo.');
    assert.match(answerError(q({ label: 'Allergies' }), 'Leo', 'missing'), /“Allergies”/);
    assert.doesNotMatch(answerError(q({ label: 'Allergies' }), 'Leo', 'missing'), /an allergies|a allergies/i);
  });
  test('a reason the club gave ends inside its quote, once', () => {
    assert.match(Y.retickWhy('Ridge', 'Feb. 24', 'Added the photo policy', 1), /“Added the photo policy\.” Read it/);
    assert.match(Y.retickWhy('Ridge', 'Feb. 24', 'Added the photo policy.', 1), /“Added the photo policy\.” Read it/);
  });
  test('the focus moves to the error box only when Sign up is refused, and a finishing upload finds its own child', () => {
    const form = read('components/league/RegisterForm.tsx');
    assert.match(form, /useEffect\(\(\) => \{ if \(refusals > 0\) errorBox\.current\?\.focus\(\); \}, \[refusals\]\)/);
    assert.match(form, /setAnswer\(c\.key, q\.id, next\)/);
  });
});

describe('/legal 2026-11-20 · Part 2 review rulings', () => {
  test('a reload never keeps the child’s notes, and says so', () => {
    assert.match(W.reloadLost(false, false, true), /^Additional notes weren’t kept when the page reloaded\. Please enter them again\.$/);
    assert.match(W.reloadLost(true, true, true), /^Answers to health questions, additional notes and attached files weren’t kept.*enter and attach them again\.$/);
    const form = read('components/league/RegisterForm.tsx');
    assert.match(form, /children\.map\(c => \(\{ \.\.\.c, notes: '', answers: strip\(c\.answers\) \}\)\)/);
  });
  test('a health mark can’t come off a question people have answered (its words would show on the emailed-link page)', () => {
    const src = read('lib/club-form.ts');
    assert.match(src, /existing\.health && !health && isAnswered\(existing\)/);
  });
  test('Your sign-up’s routes never leave a sign-up row holding only an email', () => {
    assert.match(read('app/api/league/[orgSlug]/[seasonSlug]/form/answers/route.ts'), /pruneEmptySubmission/);
    assert.match(read('app/api/league/[orgSlug]/[seasonSlug]/form/tick/route.ts'), /pruneEmptySubmission/);
  });
});
