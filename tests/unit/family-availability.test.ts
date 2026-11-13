import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cleanFamilyNote, cleanFirstName, familyAnswersCover, familyAnswerState, firstNameOf, isFamilyAnswer, normalizeFamilyAnswers,
} from '../../lib/family-availability-rules.ts';
import { FAMILY_AVAILABILITY_WORDS as W, FAMILY_ANSWER_NOTE_MAX, answeredDayWords } from '../../lib/family-availability-words.ts';
import { between, functionBody, readCode } from './_source-code.ts';

/**
 * Signed-in family accounts Stage 4b, Parts 1–3 (build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md;
 * drawing tab 7). Real output where the rule is pure; the source where the rule is "this path never does X" (Part 2's guards
 * a–f). The database half (the record, the 24-hour Remind claim, the purge) is proved by tests/sql/family-availability-fixture.sql.
 */

const MODULE = 'lib/family-availability.ts';
const ROUTE = 'app/api/family/teams/[teamId]/events/[eventId]/availability/route.ts';
const PAGE = 'app/(consumer)/family/teams/[teamId]/page.tsx';
const CLIENT = 'app/(consumer)/family/teams/[teamId]/FamilyAnswers.tsx';

describe('ask 1 — the switch decides which events families answer', () => {
  it('Off covers nothing; Games covers games only; Games and practices adds practices', () => {
    for (const t of ['league_game', 'tournament_game', 'practice', 'team_event', 'external_tournament']) {
      assert.equal(familyAnswersCover('off', t), false, t);
    }
    assert.equal(familyAnswersCover('games', 'league_game'), true);
    assert.equal(familyAnswersCover('games', 'tournament_game'), true);
    assert.equal(familyAnswersCover('games', 'practice'), false, 'guard (d): a practice is refused on Games only');
    assert.equal(familyAnswersCover('games_and_practices', 'practice'), true);
  });
  it('the tournament container and team events are never asked', () => {
    for (const s of ['games', 'games_and_practices'] as const) {
      assert.equal(familyAnswersCover(s, 'external_tournament'), false);
      assert.equal(familyAnswersCover(s, 'team_event'), false);
    }
  });
  it('an unknown or missing value is Off (a team never falls to a more open setting)', () => {
    assert.equal(normalizeFamilyAnswers(null), 'off');
    assert.equal(normalizeFamilyAnswers('everything'), 'off');
    assert.equal(normalizeFamilyAnswers('games'), 'games');
  });
});

describe('the answer and the note as stored', () => {
  it('only in / out / maybe (no Late: that is the coach’s word)', () => {
    assert.ok(['in', 'out', 'maybe'].every(isFamilyAnswer));
    assert.ok(!isFamilyAnswer('late') && !isFamilyAnswer('attending') && !isFamilyAnswer(null));
  });
  it('the note is one trimmed plain line, 200 at most; empty is no note', () => {
    assert.deepEqual(cleanFamilyNote('  away at a\n tournament\t '), { ok: true, note: 'away at a tournament' });
    assert.deepEqual(cleanFamilyNote(''), { ok: true, note: null });
    assert.deepEqual(cleanFamilyNote(undefined), { ok: true, note: null });
    assert.deepEqual(cleanFamilyNote('x'.repeat(FAMILY_ANSWER_NOTE_MAX)), { ok: true, note: 'x'.repeat(200) });
    assert.deepEqual(cleanFamilyNote('x'.repeat(FAMILY_ANSWER_NOTE_MAX + 1)), { ok: false });
    assert.deepEqual(cleanFamilyNote(42), { ok: false });
  });
});

describe('O2 — a first name comes from the account, never from an address', () => {
  it('first_name, else the first word of full_name or display_name, else none', () => {
    assert.equal(firstNameOf({ first_name: 'Priya', full_name: 'Someone Else' }), 'Priya');
    assert.equal(firstNameOf({ full_name: 'Dev Patel' }), 'Dev');
    assert.equal(firstNameOf({ display_name: 'Sam Ortiz' }), 'Sam');
    assert.equal(firstNameOf({ email: 'priya@example.com' }), null);
    assert.equal(firstNameOf(null), null);
  });
  it('a name another person reads is cleaned: invisible and direction-override characters gone, 50 at most, a visible letter required', () => {
    assert.equal(cleanFirstName('  Priya   '), 'Priya');
    assert.equal(cleanFirstName('Pri​ya‮'), 'Priya');
    assert.equal(cleanFirstName('​'), null, 'a zero-width name is no name');
    assert.equal(cleanFirstName('...'), null);
    assert.equal(cleanFirstName('x'.repeat(500))?.length, 50);
    assert.equal(cleanFirstName(42), null);
    assert.equal(firstNameOf({ first_name: '​​', full_name: 'Dev Patel' }), null, 'metadata the other parent edited is cleaned too');
  });
  it('the join page asks only when the sign-up holds no name, and never sends one to the page', () => {
    const inv = readCode('lib/family-invitation.ts');
    const check = functionBody(inv, 'invitationEmailCheck');
    assert.match(check, /askName = !hasAccount && !\(await nameOnSignup\(/);
    assert.doesNotMatch(check, /first_name|guardian_first_name|name:/, 'the email check answers a yes/no, never a name');
    const accept = functionBody(inv, 'acceptWithNewAccount');
    assert.match(accept, /if \(!name\) return \{ kind: 'name_required' \};/);
    assert.ok(accept.indexOf("kind: 'name_required'") < accept.indexOf('createUser('), 'refused BEFORE the account exists');
  });
});

describe('ask 5 and 6 — the parent’s sheet words', () => {
  it('the other parent’s answer names them, the day, and THAT they left a note — never its words', () => {
    assert.equal(W.sheet.otherAnswered('Priya', 'out', 'on Tuesday', true), 'Priya answered Out on Tuesday and left a note for the coach.');
    assert.equal(W.sheet.otherAnswered(null, 'in', 'yesterday', false), 'The other parent answered In yesterday.');
    // The sentence takes no note argument at all: it has nowhere to put the words.
    assert.equal(W.sheet.otherAnswered.length, 4);
  });
  it('/legal’s hint names who sees what; the other-parent sentence only when one is connected', () => {
    assert.equal(
      W.sheet.privacy('Ava', 'Priya'),
      'Your team’s coaches see your answer and note. Priya, Ava’s other parent, sees the answer but not your note. Other families see neither. Please don’t put health details here; tell the coach directly.',
    );
    assert.equal(
      W.sheet.privacy('Ava', null),
      'Your team’s coaches see your answer and note. Other families see neither. Please don’t put health details here; tell the coach directly.',
    );
    assert.match(W.sheet.privacy('Ava', W.otherParentFallback), /^Your team’s coaches see your answer and note\. The other parent sees the answer/);
  });
  it('the day, never the clock time (ask 6)', () => {
    const now = new Date('2027-04-22T16:00:00Z'); // Thu, Apr 22 in Toronto
    assert.equal(answeredDayWords('2027-04-20T14:00:00Z', now), 'on Tuesday');
    assert.equal(answeredDayWords('2027-04-22T13:00:00Z', now), 'today');
    assert.equal(answeredDayWords('2027-04-21T13:00:00Z', now), 'yesterday');
    assert.equal(answeredDayWords('2027-04-02T13:00:00Z', now), 'on Apr 2');
    for (const iso of ['2027-04-20T14:00:00Z', '2027-04-02T13:00:00Z']) assert.doesNotMatch(answeredDayWords(iso, now), /\d:\d|a\.m\.|p\.m\./);
  });
  it('the reminder line names the children still unanswered', () => {
    assert.equal(W.coachAsked(['Owen']), 'The coach asked whether Owen is coming.');
    assert.equal(W.coachAsked(['Ezra', 'Lily']), 'The coach asked whether Ezra and Lily are coming.');
  });
});

describe('Part 2 guards — who may answer (source)', () => {
  const mod = readCode(MODULE);
  const write = functionBody(mod, 'writeFamilyAnswer');
  const read = functionBody(mod, 'readFamilyAnswers');

  it('(f) a family write can never touch the coach’s attendance book', () => {
    for (const rel of [MODULE, ROUTE, 'lib/family-availability-rules.ts', CLIENT]) {
      assert.doesNotMatch(readCode(rel), /rep_team_event_attendance/, rel);
    }
    assert.match(write, /from\('event_availability_answers'\)/);
  });
  it('reach is re-derived from the signed-in account on every write; the first-link helper is never used', () => {
    assert.match(write, /await getFamilyReach\(params\.userId\)/);
    assert.match(write, /r\.link\.childId === params\.childId && r\.teams\.some\(isThisTeam\)/);
    assert.match(write, /t\.kind === 'rep' && t\.teamId === params\.teamId/);
    assert.doesNotMatch(mod, /getVerifiedLinkForUserTeam/);
  });
  it('(c) a parent with no VERIFIED link (left, removed, stopped) is refused: the reach reads verified links only', () => {
    const access = readCode('lib/family-access.ts');
    assert.match(functionBody(access, 'getFamilyReach'), /\.eq\('status', 'verified'\)/);
    assert.match(write, /if \(!hold \|\| !reached\) return \{ ok: false, code: 'not_found' \};/);
  });
  it('the event must be this team’s, in the season the child is live on', () => {
    assert.match(write, /ev\.team_id !== params\.teamId/);
    assert.match(write, /ev\.program_year_id !== season/);
  });
  it('(e) a started or cancelled event is refused', () => {
    assert.match(write, /if \(state !== 'open'\) return \{ ok: false, code: 'closed' \};/);
    const at = (iso: string) => new Date(iso);
    const ev = { eventType: 'league_game', status: 'scheduled', startsAt: '2027-04-22T18:00:00Z' };
    assert.equal(familyAnswerState('games', ev, at('2027-04-22T17:59:59Z')), 'open');
    assert.equal(familyAnswerState('games', ev, at('2027-04-22T18:00:00Z')), 'closed', 'answers close AT the start time');
    assert.equal(familyAnswerState('games', { ...ev, status: 'cancelled' }, at('2027-04-20T12:00:00Z')), 'cancelled');
    assert.equal(familyAnswerState('games', { ...ev, eventType: 'practice' }, at('2027-04-20T12:00:00Z')), 'not_covered');
    assert.equal(familyAnswerState('off', ev, at('2027-04-20T12:00:00Z')), 'not_covered');
  });
  it('(b) tier off: the route 404s first, the read is null, the writer refuses', () => {
    const route = readCode(ROUTE);
    const body = between(route, 'export const POST', 'getSignedInUser(supabase)');
    assert.match(body, /if \(!GUARDIAN_TIER_ENABLED\) return NextResponse\.json\(\{ error: 'not_found' \}, \{ status: 404 \}\);/);
    assert.match(read, /if \(!GUARDIAN_TIER_ENABLED \|\| params\.kind !== 'rep'/);
    assert.match(write, /if \(!GUARDIAN_TIER_ENABLED\) return \{ ok: false, code: 'not_found' \};/);
    assert.match(readCode(PAGE), /if \(!GUARDIAN_TIER_ENABLED\) notFound\(\);/);
  });
  it('house league: nothing (ask 4) — the read answers null for a league team', () => {
    assert.match(read, /params\.kind !== 'rep'/);
  });
});

describe('(a) the family payload — the account’s own children only, and no note but its own', () => {
  const mod = readCode(MODULE);
  it('FamilyAnswerRow names exactly the allow-listed fields', () => {
    const shape = between(mod, 'export interface FamilyAnswerRow {', '\n}');
    const fields = [...shape.matchAll(/^\s+(\w+):/gm)].map(m => m[1]).sort();
    assert.deepEqual(fields, ['answer', 'byFirstName', 'child', 'childId', 'dayWords', 'eventId', 'mine', 'note', 'open', 'otherHasNote'].sort());
  });
  it('a note’s words reach the page only when the answer is this account’s own', () => {
    const row = functionBody(mod, 'rowOf');
    assert.match(row, /note: mine \? a\?\.note \?\? null : null/);
    assert.match(row, /otherHasNote: !!a && !mine && !!a\.note/);
  });
  it('answers are read only for the children the caller proved this account reaches here', () => {
    const read = functionBody(mod, 'readFamilyAnswers');
    assert.match(read, /\.in\('child_id', childIds\)/);
    assert.match(read, /const childIds = params\.children\.map\(c => c\.childId\)/);
  });
  it('the team-level schedule DTO stays team-level: the public page’s entry gained no child field', () => {
    const view = readCode('lib/family-view.ts');
    const entry = between(view, 'export interface FamilyScheduleEntry {', '\n}');
    assert.doesNotMatch(entry, /answer|child|player|note/i);
  });
});

describe('the writer’s change and repeat rules (source)', () => {
  const write = functionBody(readCode(MODULE), 'writeFamilyAnswer');
  it('a CHANGED answer keeps the one before it; the same answer re-sent changes only the note', () => {
    assert.match(write, /previous_answer: prior\.answer, previous_by_user_id: prior\.answered_by_user_id, previous_at: prior\.answered_at/);
    assert.match(write, /: \{ note: cleaned\.note, updated_at: stamp, \.\.\.\(sameWriter \? \{\} : \{ answered_by_user_id: params\.userId, answered_at: stamp \}\) \}/);
  });
  it('the update applies only to the row that was read and goes again once; the insert goes again once on a duplicate key', () => {
    assert.match(write, /\.eq\('id', prior\.id\)\.eq\('answered_at', prior\.answered_at\)\.eq\('answer', prior\.answer\)\.select\('id'\)/);
    assert.match(write, /if \(!updated\?\.length\) \{\s*\n\s*if \(attempt === 0\) continue;/);
    assert.match(write, /error\?\.code === '23505' && attempt === 0/);
  });
});

describe('the sheet — a tap is never dropped (source)', () => {
  const sheet = readCode(CLIENT);
  it('the choices are not locked while a save runs, and saves run in order', () => {
    assert.doesNotMatch(sheet, /disabled=\{busy\}/, 'a locked choice eats the tap that blurred the note');
    assert.match(sheet, /queue\.current = queue\.current\.then\(task\)/);
  });
  it('a tap carries the note and decides AT RUN TIME from the latest confirmed row (nothing to roll back after a failure)', () => {
    assert.match(sheet, /await send\(latest\(\)\.answer === answer \? null : answer, noteNow\.current\)/);
    assert.doesNotMatch(sheet, /intent\.current|noteSaved\.current/, 'no guessed state to drift');
  });
  it('the note box saves through the same queue, and a closed answer locks the sheet', () => {
    assert.match(sheet, /function saveNote\(\) \{\s*\n\s*enqueue\(/);
    assert.match(sheet, /disabled=\{!row\.open\}\s*\n\s*onClick=\{\(\) => choose\(c\.answer\)\}/);
  });
});
