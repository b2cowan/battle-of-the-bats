import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { signupHasFormToDo, type SignupFormTodoInput, type TodoChild } from '../../lib/club-form-todo.ts';

/**
 * BOARD READY STAGE 4 PART 3 — THE "YOUR SIGN-UP" BUTTON ON THE CLUB'S "EMAIL FAMILIES" (owner call C4, 2026-11-20).
 * The decision (`signupHasFormToDo`) is pure; the loader reads in bulk; the email carries only the existing button.
 */

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const SHIRT = { id: 'q-shirt', asked: 'per_subject' as const, required: true };
const ALLERGY = { id: 'q-once', asked: 'once' as const, required: true };
// Owner 2026-11-20 (Part 3 call 5): an optional question a family skipped does not bring the button.
const OPTIONAL = { id: 'q-optional', asked: 'per_subject' as const, required: false };
const WAIVER = { id: 'd-waiver' };
const v = (id: string, versionNo: number, ticksStand: boolean | null = null, documentId = 'd-waiver') => ({ id, versionNo, ticksStand, documentId });
const kid = (id: string, over: Partial<TodoChild> = {}): TodoChild => ({ id, live: true, open: true, ...over });
const base = (over: Partial<SignupFormTodoInput> = {}): SignupFormTodoInput => ({
  finished: false, questions: [], documents: [], versions: [], children: [kid('c1')],
  answered: new Map(), onceAnswered: new Set(), ticks: [], ...over,
});
const tick = (versionId: string | null, subjectId = 'c1', moved = false, documentId = 'd-waiver') => ({ documentId, versionId, moved, subjectId });

describe('only a required question counts', () => {
  test('an optional question left empty is nothing to do; a required one is', () => {
    assert.equal(signupHasFormToDo(base({ questions: [OPTIONAL] })), false);
    assert.equal(signupHasFormToDo(base({ questions: [OPTIONAL, SHIRT] })), true);
  });
});

describe('a document needing a tick', () => {
  test('a document added since they signed up (never ticked) counts', () => {
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: [v('v1', 1)] })), true);
  });
  test('a tick on the current version is nothing to do', () => {
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: [v('v1', 1)], ticks: [tick('v1')] })), false);
  });
  test('a new version that asks for a new tick counts; one that lets ticks stand does not', () => {
    const again = [v('v2', 2, false), v('v1', 1)];
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: again, ticks: [tick('v1')] })), true);
    const stands = [v('v2', 2, true), v('v1', 1)];
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: stands, ticks: [tick('v1')] })), false);
  });
  test('the versions may come in any order', () => {
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: [v('v1', 1), v('v2', 2, false)], ticks: [tick('v1')] })), true);
  });
  test('a tick recorded before documents had versions (moved) counts as version 1', () => {
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: [v('v1', 1)], ticks: [tick(null, 'c1', true)] })), false);
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: [v('v2', 2, false), v('v1', 1)], ticks: [tick(null, 'c1', true)] })), true);
  });
  test('one child of the sign-up still needing the tick is enough', () => {
    const children = [kid('c1'), kid('c2')];
    assert.equal(signupHasFormToDo(base({ children, documents: [WAIVER], versions: [v('v1', 1)], ticks: [tick('v1', 'c1')] })), true);
    assert.equal(signupHasFormToDo(base({ children, documents: [WAIVER], versions: [v('v1', 1)], ticks: [tick('v1', 'c1'), tick('v1', 'c2')] })), false);
  });
  test('another sign-up\'s tick does not count for this child', () => {
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: [v('v1', 1)], ticks: [tick('v1', 'someone-else')] })), true);
  });
  test('a child whose teams are made still needs the tick (a tick is not an answer)', () => {
    assert.equal(signupHasFormToDo(base({ children: [kid('c1', { open: false })], documents: [WAIVER], versions: [v('v1', 1)] })), true);
  });
  test('a document with no version cannot be ticked, so is not asked', () => {
    assert.equal(signupHasFormToDo(base({ documents: [WAIVER], versions: [] })), false);
  });
});

describe('a live question not yet answered', () => {
  test('a per-child question unanswered for a live, open child counts', () => {
    assert.equal(signupHasFormToDo(base({ questions: [SHIRT] })), true);
  });
  test('answered for every live child is nothing to do', () => {
    const children = [kid('c1'), kid('c2')];
    assert.equal(signupHasFormToDo(base({ children, questions: [SHIRT], answered: new Map([['c1', new Set(['q-shirt'])]]) })), true);
    assert.equal(signupHasFormToDo(base({ children, questions: [SHIRT], answered: new Map([['c1', new Set(['q-shirt'])], ['c2', new Set(['q-shirt'])]]) })), false);
  });
  test('a once-per-sign-up question unanswered counts; answered does not', () => {
    assert.equal(signupHasFormToDo(base({ questions: [ALLERGY] })), true);
    assert.equal(signupHasFormToDo(base({ questions: [ALLERGY], onceAnswered: new Set(['q-once']) })), false);
  });
  test('a form with nothing on it asks nothing', () => {
    assert.equal(signupHasFormToDo(base()), false);
  });
  test('a child whose division\'s teams are made cannot change answers: its unanswered questions do not count', () => {
    assert.equal(signupHasFormToDo(base({ children: [kid('c1', { open: false })], questions: [SHIRT, ALLERGY] })), false);
  });
  test('the once-per-sign-up questions follow the open children: one open child among several keeps them open', () => {
    const children = [kid('c1', { open: false }), kid('c2')];
    assert.equal(signupHasFormToDo(base({ children, questions: [ALLERGY] })), true);
    assert.equal(signupHasFormToDo(base({ children, questions: [SHIRT], answered: new Map([['c2', new Set(['q-shirt'])]]) })), false);
  });
  test('a closed child does not hide an open sibling\'s unanswered question', () => {
    const children = [kid('c1', { open: false }), kid('c2')];
    assert.equal(signupHasFormToDo(base({ children, questions: [SHIRT], answered: new Map([['c1', new Set(['q-shirt'])]]) })), true);
  });
});

describe('who counts, and when nothing does', () => {
  test('a declined or withdrawn child is not live: it asks nothing and needs no tick', () => {
    const children = [kid('c1', { live: false })];
    assert.equal(signupHasFormToDo(base({ children, questions: [SHIRT, ALLERGY], documents: [WAIVER], versions: [v('v1', 1)] })), false);
  });
  test('a sign-up with a live sibling is judged by the live sibling', () => {
    const children = [kid('c1', { live: false }), kid('c2')];
    assert.equal(signupHasFormToDo(base({ children, questions: [SHIRT] })), true);
  });
  test('a finished season counts nothing, tick and question alike', () => {
    assert.equal(signupHasFormToDo(base({ finished: true, questions: [SHIRT, ALLERGY], documents: [WAIVER], versions: [v('v1', 1)] })), false);
  });
  test('a sign-up with no children is nothing to do', () => {
    assert.equal(signupHasFormToDo(base({ children: [], questions: [SHIRT], documents: [WAIVER], versions: [v('v1', 1)] })), false);
  });
  test('either reason is enough, and a sign-up needing both is still one yes (one button, never two)', () => {
    const both = base({ questions: [SHIRT], documents: [WAIVER], versions: [v('v1', 1)] });
    assert.equal(signupHasFormToDo(both), true);
  });
});

describe('the loader reads in bulk, never an answer, and only the club\'s own send reaches it', () => {
  const loader = read('lib/club-form-email-links.ts');

  test('it asks which questions have an answer — no answer value column is ever selected', () => {
    for (const col of ['value_text', 'value_choice_ids', 'value_bool', 'value_date', 'file_id', 'club_form_files']) {
      assert.ok(!loader.includes(col), `the sign-up button's loader reads ${col}: it may only learn THAT a question was answered`);
    }
  });
  test('answers the clock removed count as unanswered (a cleared answer is deleted; mig 518 keeps its date apart)', () => {
    const answers = loader.match(/from\('club_form_answers'\)[\s\S]*?\.range\(from, to\)/g) ?? [];
    assert.equal(answers.length, 2);
    for (const a of answers) assert.match(a, /\.is\('removed_at', null\)/);
  });
  test('every read pages and chunks (a select stops silently at 1,000 rows)', () => {
    const bodies = loader.split('export async function formButtonLinks(')[1].split('export async function formButtonLinksOrNone')[0];
    assert.ok(!/await supabaseAdmin\.from\('(league_registrations|club_form_answers|club_form_ticks)'\)/.test(bodies), 'a per-row table is read without fetchAllIn');
    assert.ok((bodies.match(/fetchAllIn</g) ?? []).length >= 5);
  });
  test('it shares the page\'s own rules instead of re-deriving them', () => {
    assert.match(loader, /import \{ answersOpen, liveRow \} from '\.\/club-form-family'/);
    assert.match(loader, /isFinishedLeagueSeason\(season\)/);
    assert.match(loader, /leaguePayUrl\(SITE_URL, \{ orgSlug: org\.slug, seasonSlug: season\.slug, registrationId: anchor\.id/);
  });
  test('a failed read sends the email without the button', () => {
    assert.match(loader, /export async function formButtonLinksOrNone/);
    assert.match(loader, /catch \(e\)[\s\S]{0,300}return new Map\(\)/);
  });
  test('only the club\'s own Email families (and its "send to the ones it missed") ask for a button', () => {
    const callers = ['lib', 'app'].flatMap(dir => walk(dir)).filter(f => /formButtonLinks(OrNone)?\(/.test(read(f)) && f !== 'lib/club-form-email-links.ts');
    assert.deepEqual(callers.sort(), ['lib/families-email.ts', 'lib/house-league-email.ts']);
    assert.match(read('lib/house-league-email.ts'), /signupLinks = await formButtonLinksOrNone\(/);
    assert.ok(!/formButtonLinks/.test(read('lib/house-league-placement-mail.ts')), 'no automatic email gains this button');
  });
  test('the email carries the existing "Your sign-up" button and nothing about the form', () => {
    const fe = read('lib/family-email.ts');
    assert.match(fe, /signupButton\(content\.signupLinks\?\.get\(recipientEmail\)\)/);
    assert.match(fe, /familyEmailHtml\(params\.content, params\.orgId, to\)/, 'every address still builds its own envelope');
    assert.match(read('lib/email.ts'), /export function signupButton\(url: string \| null \| undefined\)/);
    // The one body of words a family sees is the club's own message plus the button: nothing from the form is named in either send path.
    const sends = `${read('lib/house-league-email.ts')}\n${read('lib/families-email.ts')}\n${loader}`;
    assert.ok(!/health|question\.label|\.label\b/.test(loader), 'the loader names no question text');
    assert.ok(!/signupLinks[^\n]*(label|health|answer)/i.test(sends));
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  const root = new URL(`../../${dir}/`, import.meta.url);
  const visit = (rel: string) => {
    for (const e of readdirSync(new URL(rel, root), { withFileTypes: true })) {
      const p = `${rel}${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') visit(`${p}/`); }
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(`${dir}/${p}`);
    }
  };
  visit('');
  return out;
}
