import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  answerOfStatus, cleanFamilyNote, cleanFirstName, familyAnswersCover, familyAnswerState, firstNameOf, isAnswerStatus, normalizeFamilyAnswers,
} from '../../lib/family-availability-rules.ts';
import { FAMILY_AVAILABILITY_WORDS as W, FAMILY_ANSWER_NOTE_MAX, answeredDayWords } from '../../lib/family-availability-words.ts';
import { between, functionBody, readCode } from './_source-code.ts';

/**
 * Signed-in family accounts Stage 4b, Parts 1–3 (build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md;
 * drawing tab 7). Real output where the rule is pure; the source where the rule is "this path never does X" (Part 2's guards
 * a–f). The database half (the one record and its writer, the 24-hour Remind claim, the purge) is proved by
 * tests/sql/one-attendance-record-fixture.sql.
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
  it('the record’s own four: In · Late · Maybe · Out (ruling 1); Not marked is a clear (null), never a word the family sends', () => {
    assert.ok(['attending', 'late', 'maybe', 'absent'].every(isAnswerStatus));
    assert.ok(!isAnswerStatus('unknown') && !isAnswerStatus('in') && !isAnswerStatus('out') && !isAnswerStatus(null));
    assert.equal(answerOfStatus('late'), 'late', 'a coach’s Late reads to the family as Late (S2), never as In');
    assert.equal(answerOfStatus('unknown'), null);
    assert.deepEqual(['attending', 'late', 'maybe', 'absent'].map(a => W.answer[a as 'late']), ['In', 'Late', 'Maybe', 'Out']);
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
  it('ruling 4: who set the answer and when, the coach’s change included, and the one before — never a note’s words', () => {
    assert.equal(W.setLine('absent', { by: 'coach', name: null, day: 'today', previous: { by: 'family', name: 'Adasmom', day: 'Nov 1', status: 'attending' } }),
      'Out · Coach, today · earlier: In (Adasmom, Nov 1)', 'the ruling’s own example');
    assert.equal(W.setLine('late', { by: 'you', name: null, day: 'Tue', previous: null }), 'Late · You, Tue');
    assert.equal(W.setLine('maybe', { by: 'family', name: null, day: 'yesterday', previous: null }), 'Maybe · The other parent, yesterday');
    assert.equal(W.sheet.otherNote, 'The other parent left a note for the coach.');
    // The line takes no note at all on the family side: it has nowhere to put the words.
    assert.equal(W.setLine.length, 2);
    assert.match(W.pillLabel('Ava', 'Sat vs Lakeshore', 'late', { by: 'coach', name: null, day: 'today', previous: null }), /^Ava: Late for Sat vs Lakeshore, set by Coach\. /);
  });
  it('/legal’s hint names who sees what; the other-parent sentence only when one is connected', () => {
    assert.equal(
      W.sheet.privacy('Ava', 'Priya'),
      'Your team’s coaches see your answer, your note, your first name and the day you answered. Priya, Ava’s other parent, sees your answer and first name, but not your note. Other families see none of it. Please don’t put health details here; tell the coach directly.',
    );
    assert.equal(
      W.sheet.privacy('Ava', null),
      'Your team’s coaches see your answer, your note, your first name and the day you answered. Other families see none of it. Please don’t put health details here; tell the coach directly.',
    );
    assert.match(W.sheet.privacy('Ava', W.otherParentFallback), /^Your team’s coaches see your answer, your note, your first name and the day you answered\. The other parent sees your answer and first name/);
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

  it('(f) ONE RECORD: a family write goes through the one writer as a family, never the coach’s note or audit', () => {
    // One attendance record (owner 2026-11-13, mig 483): the family's answer IS the attendance, written ONLY through
    // rep_attendance_write with kind 'family'. Nothing family-side writes the table directly.
    assert.match(write, /supabaseAdmin\.rpc\('rep_attendance_write', \{/);
    assert.match(write, /p_kind: 'family'/);
    assert.match(write, /p_player: reached\.entryId/, 'the player is this team’s roster entry from the reach (a call-up stays coach-only)');
    assert.doesNotMatch(write, /p_note:|p_set_note:/, 'the coach’s note is the coach’s');
    for (const rel of [MODULE, ROUTE, 'lib/family-availability-rules.ts', CLIENT]) {
      assert.doesNotMatch(readCode(rel), /from\('rep_team_event_attendance'\)\s*\.(insert|update|upsert|delete)\(/, rel);
      assert.doesNotMatch(readCode(rel), /event_availability_answers/, `${rel}: the retired record (mig 485)`);
    }
    // The database is the second guard (mig 483): a family write after the start, or on a cancelled event, is refused there too,
    // and only a coach's write moves the coach's audit column.
    const mig = readCode('supabase/migrations/483_one_attendance_record.sql');
    assert.match(mig, /if p_kind = 'family' and \(e\.status = 'cancelled' or e\.starts_at is null or e\.starts_at <= v_now\) then\s*\n\s*raise exception 'attendance_closed'/);
    assert.match(mig, /updated_by\s+= case when p_kind = 'coach' then p_by else r\.updated_by end/);
    assert.match(mig, /if p_set_note and p_kind <> 'coach' then raise exception/);
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
    assert.deepEqual(fields, ['answer', 'child', 'childId', 'eventId', 'mine', 'note', 'open', 'otherHasNote', 'setBy'].sort());
  });
  it('who set it reads "Coach" for the coach’s side — never a coach’s name; another parent is named only while connected', () => {
    const who = functionBody(mod, 'whoFor');
    assert.match(who, /return \{ by: 'coach', name: null, day \};/);
    assert.match(who, /by === userId \? \{ by: 'you', name: null, day \} : \{ by: 'family', name: by \? nameOf\(by, childId\) : null, day \}/);
  });
  it('a note’s words reach the page only when the answer is this account’s own', () => {
    // One record: the family's note has its own writer (family_note_by_user_id); the coach's `note` is never read here.
    const row = functionBody(mod, 'rowOf');
    assert.match(row, /const noteMine = !!b\?\.family_note && b\.family_note_by_user_id === userId;/);
    assert.match(row, /note: noteMine \? b!\.family_note : null/);
    assert.match(row, /otherHasNote: !!b\?\.family_note && !noteMine/);
    assert.doesNotMatch(between(mod, 'const FAMILY_BOOK_COLUMNS', '\n'), /[ ,']note[,']/, 'the coach’s note is never selected');
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

describe('the one writer’s change and repeat rules (mig 483; behaviour held by tests/sql/one-attendance-record-fixture.sql §3)', () => {
  const mig = readCode('supabase/migrations/483_one_attendance_record.sql');
  const write = functionBody(readCode(MODULE), 'writeFamilyAnswer');
  it('a CHANGED status keeps the one before it, with who and when; the same status re-sent moves nothing', () => {
    assert.match(mig, /v_move := p_status is not null and p_status is distinct from r\.status;/);
    assert.match(mig, /r\.previous_status := r\.status;\s*\n\s*r\.previous_by_kind := r\.set_by_kind;\s*\n\s*r\.previous_by_user_id := r\.set_by_user_id;\s*\n\s*r\.previous_at := r\.set_at;/);
  });
  it('the row is locked for the write (latest wins, never a lost update); the guards are decided under the lock', () => {
    assert.match(mig, /where event_id = p_event and player_id = p_player for update;/);
    assert.match(mig, /if \(p_only_if_unknown and r\.status <> 'unknown'\)\s*\n\s*or \(p_only_if_set_by is not null[^]*?coalesce\(r\.set_by_kind, case when r\.status <> 'unknown' then 'coach' end\) is distinct from p_only_if_set_by\) then/);
  });
  it('the answer IS the status: no interim guard keeps a coach’s Late over a parent’s In any more (S2: the page picks Late)', () => {
    assert.match(write, /p_status: params\.answer \?\? 'unknown',/);
    assert.doesNotMatch(write, /nextStatus|status === 'late'/);
  });
  it('an INACTIVE roster entry answers nothing (owner, S2): the writer refuses it and the page offers no pill', () => {
    assert.match(write, /held\?\.status !== 'active'\) \{\s*\n\s*return \{ ok: false, code: 'not_found' \};/);
    assert.match(functionBody(readCode(MODULE), 'childSeasons'), /\.in\('id', entries\.map\(e => e\.entryId\)\)\.eq\('status', 'active'\)/);
  });
  it('a family write always replaces the family’s note (a second parent’s change clears the first’s); a clear clears it', () => {
    assert.match(write, /p_family_note: params\.answer === null \? null : cleaned\.note,/);
    // A bare "agree" sends no note, and then the other parent's note is left alone.
    assert.match(write, /p_set_family_note: params\.answer === null \|\| params\.note !== undefined,/);
  });
  it('a family CLEAR takes away a family’s answer only: a coach’s answer set since the page loaded stays (review of S2)', () => {
    assert.match(write, /p_only_if_set_by: params\.answer === null \? 'family' : null,/);
    // The bell reads what the record holds now, so a refused clear is never told as a clear.
    assert.match(write, /next: answerOfStatus\(result\.row\.status\),/);
  });
  it('the start passing between the gate and the write reads as closed, never as a failure', () => {
    assert.match(write, /if \(error\?\.message\?\.includes\('attendance_closed'\)\) return \{ ok: false, code: 'closed' \};/);
  });
});

describe('the sheet — a tap is never dropped (source)', () => {
  const sheet = readCode(CLIENT);
  it('the choices are not locked while a save runs, and saves run in order', () => {
    assert.doesNotMatch(sheet, /disabled=\{busy\}/, 'a locked choice eats the tap that blurred the note');
    assert.match(sheet, /queue\.current = queue\.current\.then\(task\)/);
  });
  it('a tap carries the note and decides AT RUN TIME from the latest confirmed row (nothing to roll back after a failure)', () => {
    // Tapping YOUR answer again clears it; the same answer set by the coach or the other parent is agreed with, not cleared.
    assert.match(sheet, /const cur = latest\(\);\s*\n[^]*?const agreeing = cur\.answer === answer && !cur\.mine;\s*\n\s*await send\(cur\.answer === answer && cur\.mine \? null : answer, agreeing && !noteNow\.current\.trim\(\) \? undefined : noteNow\.current\);/);
    assert.doesNotMatch(sheet, /intent\.current|noteSaved\.current/, 'no guessed state to drift');
  });
  it('the note box saves through the same queue, and a closed answer locks the sheet', () => {
    assert.match(sheet, /function saveNote\(\) \{\s*\n\s*enqueue\(/);
    assert.match(sheet, /disabled=\{!row\.open\}\s*\n\s*onClick=\{\(\) => choose\(answer\)\}/);
    assert.match(sheet, /\{ANSWER_STATUSES\.map\(answer => \{/, 'the four choices, in the ruling’s order');
  });
});
