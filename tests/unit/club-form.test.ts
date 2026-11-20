import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  choicesFromEdit, docInSentence, linesToChoices, looksLikeHealth, readQuestionInput, settledQuestion, tickSentence,
  type FormQuestion,
} from '../../lib/club-form.ts';
import { copyLineSub, fixedFields, formFactLine, questionCaption, versionCaption } from '../../lib/club-form-words.ts';

/**
 * BOARD READY STAGE 4 — THE CLUB'S SIGN-UP FORM, ITS RULES (owner rulings 1–20, 2026-11-20; drawing
 * BOARD_READY_STAGE4_FORMS_DRAWINGS.html). The page, the windows and the routes all read lib/club-form.ts; these pin it.
 */

let n = 0;
const newId = () => `new-${++n}`;
const q = (over: Partial<FormQuestion> = {}): FormQuestion => ({
  id: 'q1', type: 'one_choice', label: 'T-shirt size', helpText: null,
  choices: [{ id: 'c1', label: 'YS', offered: true }, { id: 'c2', label: 'YM', offered: true }],
  required: false, asked: 'per_subject', health: false, onBoard: false, sortOrder: 0, archivedAt: null, answers: 0, ...over,
});
const opts = { perSubject: true, healthSwitch: true };

describe('the rulings a question is saved under', () => {
  test('a file question is never required (ruling 9)', () => {
    assert.equal(settledQuestion({ type: 'file', required: true, health: false, onBoard: false }).required, false);
    assert.equal(settledQuestion({ type: 'short_answer', required: true, health: false, onBoard: false }).required, true);
  });
  test('a health question is never on the draft board (ruling 12)', () => {
    assert.equal(settledQuestion({ type: 'long_answer', required: false, health: true, onBoard: true }).onBoard, false);
  });
  test('new questions are optional unless the club says otherwise', () => {
    const r = readQuestionInput({ label: 'Allergies?', type: 'long_answer' }, null, newId, opts);
    assert.ok('write' in r && r.write.required === false && r.write.asked === 'per_subject');
  });
  test('type and "Asked" lock once anyone has answered (ruling 7)', () => {
    const answered = q({ answers: 41 });
    assert.ok('error' in readQuestionInput({ type: 'short_answer' }, answered, newId, opts));
    assert.ok('error' in readQuestionInput({ asked: 'once' }, answered, newId, opts));
    assert.ok('write' in readQuestionInput({ label: 'Shirt size' }, answered, newId, opts));
    assert.ok('write' in readQuestionInput({ asked: 'once' }, q(), newId, opts), 'unanswered: it may move group');
  });
  test('a one-answerer form has no "Asked" (a sponsor\'s link) and no Health switch for a business', () => {
    const r = readQuestionInput({ label: 'Logo colours', type: 'short_answer', asked: 'per_subject', health: true }, null, newId,
      { perSubject: false, healthSwitch: false });
    assert.ok('write' in r && r.write.asked === 'once' && r.write.health === false);
  });
  test('a choice question needs a choice; the words are required', () => {
    assert.ok('error' in readQuestionInput({ label: 'Size', type: 'one_choice', choices: [] }, null, newId, opts));
    assert.ok('error' in readQuestionInput({ label: '  ', type: 'short_answer' }, null, newId, opts));
  });
});

describe('choices keep their ids (drawing tab 7)', () => {
  const had = [{ id: 'c1', label: 'YS' }, { id: 'c2', label: 'YM' }, { id: 'c3', label: 'YL' }];
  test('same words keep the choice; a line in place of one gone is a rename', () => {
    assert.deepEqual(linesToChoices('YS\nYouth medium\nYL', had), [{ id: 'c1', label: 'YS' }, { id: 'c2', label: 'Youth medium' }, { id: 'c3', label: 'YL' }]);
  });
  test('a new line with nothing gone is a new choice; duplicates count once', () => {
    assert.deepEqual(linesToChoices('YS\nYM\nYL\nAS\nys', had).map(c => c.id), ['c1', 'c2', 'c3', null]);
  });
  test('a removed choice stays, no longer offered, on the answers that chose it', () => {
    const out = choicesFromEdit([{ id: 'c1', label: 'YS' }], had.map(c => ({ ...c, offered: true })), newId);
    assert.deepEqual(out.map(c => [c.id, c.offered]), [['c1', true], ['c2', false], ['c3', false]]);
  });
  test('a choice dropped at the top and a new one typed at the bottom is a new choice, not a rename (/review)', () => {
    assert.deepEqual(linesToChoices(['YM', 'YL', 'XL'].join('\n'), had).map(c => c.id), ['c2', 'c3', null]);
  });
  test('a line sent again without its id keeps the choice it already became (a stale window, /review)', () => {
    const saved = [{ id: 'c1', label: 'YS', offered: true }, { id: 'x1', label: 'XL', offered: true }];
    const out = choicesFromEdit([{ id: 'c1', label: 'YS' }, { id: null, label: 'XL' }], saved, newId);
    assert.deepEqual(out.map(c => [c.id, c.offered]), [['c1', true], ['x1', true]]);
  });
  test('an id the question never had is never trusted', () => {
    const out = choicesFromEdit([{ id: 'stolen', label: 'XL' }], [], newId);
    assert.notEqual(out[0].id, 'stolen');
  });
});

describe('the health suggestion suggests and never blocks (ruling 5)', () => {
  test('medical words trip it; ordinary words do not', () => {
    assert.ok(looksLikeHealth('Does your child have any allergies or medical needs?'));
    assert.ok(looksLikeHealth('EpiPen?'));
    assert.ok(!looksLikeHealth('T-shirt size'));
    assert.ok(!looksLikeHealth('Conditioning drills you enjoy'));
    assert.ok(!looksLikeHealth('I accept the terms and conditions'));
    assert.ok(looksLikeHealth('Any dietary needs or special needs?'));
    assert.ok(looksLikeHealth('Any medical conditions?'));
  });
  test('a medical question still saves with the switch off', () => {
    assert.ok('write' in readQuestionInput({ label: 'Any allergies?', type: 'long_answer', health: false }, null, newId, opts));
  });
});

describe('the tick\'s words (ruling 2)', () => {
  test('the two sentences', () => {
    assert.equal(tickSentence('Waiver', 'read_agree'), 'I have read and agree to the waiver.');
    assert.equal(tickSentence('Code of conduct', 'read'), 'I have read the code of conduct.');
  });
  test('a proper name keeps its capitals', () => {
    assert.equal(docInSentence('Riverdale Code of Conduct'), 'the Riverdale Code of Conduct');
    assert.equal(docInSentence('AGM rules'), 'the AGM rules');
    assert.equal(docInSentence('The club handbook'), 'the club handbook');
    assert.equal(docInSentence('Our code of conduct.'), 'our code of conduct');
    assert.equal(docInSentence('The Waiver'), 'the waiver');
  });
  test('the waiver keeps today\'s exact sentence', () => {
    assert.equal(tickSentence('Waiver', 'read_agree'), 'I have read and agree to the waiver.');
  });
});

describe('the words the club reads', () => {
  test('the Registration block\'s line (drawing tab 1)', () => {
    assert.deepEqual(formFactLine(0, ['Waiver']), {
      value: 'No questions of your own · 1 document to read', sub: 'The waiver, and the details every sign-up asks for.',
    });
    assert.equal(formFactLine(5, []).value, '5 questions · no documents');
  });
  test('a question\'s caption, desk and phone (drawing tab 2)', () => {
    const shirt = q({ required: true, answers: 41, choices: ['YS', 'YM', 'YL', 'AS', 'AM', 'AL'].map((l, i) => ({ id: `c${i}`, label: l, offered: true })) });
    assert.equal(questionCaption(shirt), 'One choice · 6 choices · required · 41 answers');
    assert.equal(questionCaption(shirt, true), 'One choice · required');
    assert.equal(questionCaption(q({ type: 'file', choices: [], answers: 12 })), 'File upload · 12 files');
  });
  test('the locked card counts ten details with friends and the email line', () => {
    const f = fixedFields(2, 'Riverdale Minor Ball', true);
    assert.equal(f.child.length + f.guardian.length + f.end.length, 10);
    assert.ok(!fixedFields(0, 'X', true).child.some(x => x.startsWith('Friends')));
  });
  test('a version\'s caption says what happened to the ticks before it', () => {
    const v = { versionNo: 2, createdAt: '2027-02-09', ticks: 15, ticksStand: true, movedIn: false };
    assert.match(versionCaption(v, null), /^Since Feb 9, 2027 · 15 ticks · ticks on version 1 stand$/);
    assert.match(versionCaption({ ...v, ticksStand: false }, null), /ticks on version 1 don’t stand/);
  });
  test('Start next season\'s line never promises answers', () => {
    assert.equal(copyLineSub(5, 2), '5 questions and 2 documents. No answers are copied.');
  });
});
