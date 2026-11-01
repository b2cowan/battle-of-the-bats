import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  changeLines, dateLines, firstSubject, handOutAgainCounts, placeOfTold, practiceSummary, practiceTimesEmailWords, predictHandOut,
  sameUpcoming, snapshotOf, teamChange, tellStateOf, PRACTICE_TELL_WORDS as W, PRACTICES_SENT_NOTICE,
  type CurrentPractice, type ToldPractice,
} from '../../lib/league-practice-tell.ts';
import { CLUB_EMAIL_CAP } from '../../lib/families-words.ts';
import type { PracticeTimeSlot } from '../../lib/league-practice-time.ts';
import { readCode } from './_source-code.ts';

/**
 * HOUSE LEAGUE STAGE 9d-3 — TELLING FAMILIES THEIR PRACTICE TIMES (rulings 9d3·1, 9d3·6; words
 * HOUSE_LEAGUE_STAGE9D3_COPY.md, the owner's cap noun of 2026-10-31). The compare that decides who is told, the change
 * as the 11b rows, the hand-out predicted before it is written, and the email's words — then the guards: no link, and
 * households from `readHouseholds` only.
 */

const REPO = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

// Wednesdays 6:00–7:00 p.m. Eastern (22:00Z in June) at Maple Grove · Diamond 1.
const V = '00000000-0000-4000-8000-0000000000a1', F1 = '00000000-0000-4000-8000-0000000000f1', F2 = '00000000-0000-4000-8000-0000000000f2';
const at = (day: string, hourZ = 22, f = F1): ToldPractice => ({
  s: `${day}T${String(hourZ).padStart(2, '0')}:00:00.000Z`, e: `${day}T${String(hourZ + 1).padStart(2, '0')}:00:00.000Z`, v: V, f, l: null,
});
const NOW = Date.parse('2027-06-10T12:00:00Z');
const placeOf = placeOfTold({ venue: id => (id === V ? 'Maple Grove' : null), facility: id => (id === F1 ? 'Diamond 1' : id === F2 ? 'Diamond 2' : null) });

describe('what families know: only UPCOMING dates are compared', () => {
  it('a past practice that fell off the list is not a change', () => {
    const told = [at('2027-06-02'), at('2027-06-16'), at('2027-06-23')];
    const now = [at('2027-06-16'), at('2027-06-23')];
    assert.equal(sameUpcoming(told, now, NOW), true);
    assert.equal(tellStateOf(now, { snapshot: told }, NOW), 'told');
  });
  it('a moved upcoming date is a change; never told is untold; nothing at all is none', () => {
    const told = [at('2027-06-16'), at('2027-06-23')];
    assert.equal(tellStateOf([at('2027-06-16'), at('2027-06-24')], { snapshot: told }, NOW), 'changed');
    assert.equal(tellStateOf([at('2027-06-16')], null, NOW), 'untold');
    assert.equal(tellStateOf([], null, NOW), 'none');
    // Told, and every practice since cancelled: families must hear it.
    assert.equal(tellStateOf([], { snapshot: told }, NOW), 'changed');
  });
  it('the snapshot keeps upcoming dates only, in order, as ISO instants', () => {
    const snap = snapshotOf([at('2027-06-23'), at('2027-06-02'), at('2027-06-16')], NOW);
    assert.deepEqual(snap.map(x => x.s), ['2027-06-16T22:00:00.000Z', '2027-06-23T22:00:00.000Z']);
  });
});

describe('the change, as the 11b rows (Now / Was), paired within the week nearest first', () => {
  it('Wednesday moved to Thursday on another diamond reads as one row, every week', () => {
    const told = [at('2027-06-16'), at('2027-06-23'), at('2027-06-30')];
    const now = [at('2027-06-17', 23, F2), at('2027-06-24', 23, F2), at('2027-07-01', 23, F2)];
    const c = teamChange('t', told, now, NOW);
    assert.equal(c.rows.length, 1);
    assert.equal(c.added.length, 0);
    assert.equal(c.firstDay, '2027-06-16');
    const lines = changeLines(c, placeOf);
    assert.equal(lines[0], 'Now: Thursdays, 7:00–8:00 p.m. · Maple Grove · Diamond 2');
    assert.equal(lines[1], 'Was: Wednesdays, 6:00–7:00 p.m. · Diamond 1');
  });
  it('a date that went is a cancel; a second practice a week is added; an unchanged one is not mentioned', () => {
    const told = [at('2027-06-16'), at('2027-06-23')];
    const now = [at('2027-06-16'), at('2027-06-18', 23)];
    const c = teamChange('t', told, now, NOW);
    // Jun 23 has no partner in its week → cancelled; Jun 18 (another week) has none → added.
    assert.equal(c.rows.filter(r => r.kind === 'cancelled').length, 1);
    assert.equal(c.added.length, 1);
    const lines = changeLines(c, placeOf);
    assert.ok(lines.some(l => l.startsWith('Cancelled: Wed, Jun 23')), lines.join(' | '));
    assert.ok(lines.some(l => l.startsWith('Added: Fri, Jun 18')), lines.join(' | '));
    assert.ok(!lines.some(l => l.includes('Jun 16')), 'the unchanged date is not news');
  });
  it('a practice with no place reads with no trailing "·" (review 2026-10-31)', () => {
    const nowhere = (day: string, hourZ = 22): ToldPractice => ({ s: `${day}T${hourZ}:00:00.000Z`, e: null, v: null, f: null, l: null });
    const c = teamChange('t', [nowhere('2027-06-16'), nowhere('2027-06-23')], [nowhere('2027-06-16'), nowhere('2027-06-24', 23), nowhere('2027-06-18', 23)], NOW);
    const lines = changeLines(c, placeOf);
    assert.ok(lines.length >= 3, lines.join(' | '));
    for (const l of lines) assert.ok(!/·\s*$/.test(l) && !l.includes('null') && !l.includes('undefined'), l);
  });
});

describe('a second hand-out, predicted before it is written (the re-hand-out confirm)', () => {
  const slots: PracticeTimeSlot[] = [
    { id: 's1', day: '2027-06-16', weekday: 3, start: '18:00', end: '20:00', startsAt: '2027-06-16T22:00:00.000Z', place: 'Diamond 1', placeKey: `${V}|${F1}` },
  ];
  it('rows on the planned slots replace the team\'s upcoming ones there; its others stay', () => {
    const current = new Map<string, CurrentPractice[]>([
      ['a', [{ ...at('2027-06-16'), slot: 's1' }, { s: '2027-06-19T14:00:00.000Z', e: null, v: null, f: null, l: 'Gym', slot: null }]],
      ['b', [{ ...at('2027-06-16', 23), slot: 's1' }]],
    ]);
    // A and B swap their hours.
    const predicted = predictHandOut({
      current, slotIds: ['s1'], slots, nowMs: NOW,
      rows: [
        { slotId: 's1', teamId: 'a', scheduledAt: '2027-06-16T23:00:00.000Z', endsAt: '2027-06-17T00:00:00.000Z' },
        { slotId: 's1', teamId: 'b', scheduledAt: '2027-06-16T22:00:00.000Z', endsAt: '2027-06-16T23:00:00.000Z' },
      ],
    });
    assert.equal(predicted.get('a')!.length, 2, 'the hand-booked gym practice stays');
    const told = new Map([
      ['a', { snapshot: [at('2027-06-16'), { s: '2027-06-19T14:00:00.000Z', e: null, v: null, f: null, l: 'Gym' }] }],
      ['c', { snapshot: [] as ToldPractice[] }],
    ]);
    assert.deepEqual(handOutAgainCounts({ predicted, told, nowMs: NOW }), { told: 2, change: 1, same: 1 });
  });
});

describe('a team’s row in the Tell step (redrawn 2026-10-31)', () => {
  it('says the weekly pattern once and each place once, whatever the number of dates', () => {
    const s = practiceSummary([at('2027-06-16'), at('2027-06-23'), at('2027-06-30')], NOW, placeOf);
    assert.deepEqual(s, { when: 'Wed, 6:00–7:00 p.m.', where: 'Maple Grove · Diamond 1' });
  });
  it('two places are both named; three or more are a count; a past date is not said', () => {
    assert.equal(practiceSummary([at('2027-06-16'), at('2027-06-23', 22, F2)], NOW, placeOf).where, 'Maple Grove · Diamond 1 and Maple Grove · Diamond 2');
    const third = { ...at('2027-06-30'), v: null, f: null, l: 'Kinsmen Park' };
    const three = practiceSummary([at('2027-06-16'), at('2027-06-23', 22, F2), third], NOW, placeOf);
    assert.equal(three.where, '3 places');
    assert.deepEqual(practiceSummary([at('2027-06-02')], NOW, placeOf), { when: '', where: '' });
  });
  it('different weeks are never merged into one long practice (/review 2026-11-01)', () => {
    // Tue 6–7 one week and Tue 7–8 the next are two shapes, not a two-hour practice; two clocks on one day stay two clocks.
    const touching = practiceSummary([at('2027-06-16', 22), at('2027-06-23', 23)], NOW, placeOf).when;
    assert.equal(touching, 'Wed, 6:00–7:00 p.m.; Wed, 7:00–8:00 p.m.');
    assert.ok(!touching.includes('6:00–8:00'));
    const twoDays = practiceSummary([at('2027-06-16', 22), at('2027-06-17', 22), at('2027-06-23', 22)], NOW, placeOf).when;
    assert.equal(twoDays, 'Wed and Thu, 6:00–7:00 p.m.');
  });
  it('a practice with no end time still says its start', () => {
    const open: ToldPractice = { ...at('2027-06-16'), e: null };
    assert.equal(practiceSummary([open], NOW, placeOf).when, 'Wed, 6:00 p.m.');
  });
});

describe('the family email (copy section C)', () => {
  it('the first email: every date, the place on each line, the intro, no link', () => {
    const lines = dateLines([at('2027-06-23'), at('2027-06-16', 22, F2)], NOW, placeOf);
    assert.deepEqual(lines, ['Wed, Jun 16, 6:00–7:00 p.m. · Maple Grove · Diamond 2', 'Wed, Jun 23, 6:00–7:00 p.m. · Maple Grove · Diamond 1']);
    const w = practiceTimesEmailWords({ club: 'Riverdale', season: 'Summer 2027', guardianFirst: 'Sun', zoneSentence: 'Times in Eastern time.',
      parts: [{ child: 'Ava', team: 'Twins', kind: 'first', lines, firstDay: null }] });
    assert.equal(w.subject, 'Twins’ practice times');
    assert.equal(w.greeting, 'Hi Sun,');
    assert.equal(w.paragraphs[0], W.intro('Summer 2027'));
    assert.equal(w.lists[0].title, 'Ava’s practices with Twins:');
    assert.equal(w.link, null);
    assert.equal(w.outro, 'Questions? Ask Twins’ coach.');
    assert.equal(w.foot, 'Times in Eastern time.');
  });
  it('one told team and one new team: the change opening for one, the first for the other, the first subject', () => {
    const w = practiceTimesEmailWords({ club: 'Riverdale', season: 'Summer 2027', guardianFirst: null, zoneSentence: 'Z',
      parts: [
        { child: 'Ava', team: 'Twins', kind: 'change', lines: ['Now: …', 'Was: …'], firstDay: '2027-06-16' },
        { child: 'Henry', team: 'Rays', kind: 'first', lines: ['Wed, Jun 16 …'], firstDay: null },
      ] });
    assert.equal(w.greeting, 'Hi,');
    assert.equal(w.subject, 'Practice times for Twins and Rays');
    assert.equal(w.lists[0].title, 'Riverdale changed Ava’s practices with Twins, from Wed, Jun 16:');
    assert.equal(w.lists[1].title, 'Henry’s practices with Rays:');
  });
  it('a change only reads exactly as the 11b email; three teams take the copy\'s list', () => {
    const w = practiceTimesEmailWords({ club: 'R', season: 'S', guardianFirst: null, zoneSentence: 'Z',
      parts: [{ child: 'Ava', team: 'Twins', kind: 'change', lines: ['x'], firstDay: '2027-06-16' }] });
    assert.equal(w.subject, 'Twins’ practices changed');
    assert.deepEqual(w.paragraphs, []);
    assert.equal(firstSubject(['A', 'B', 'C']), 'Practice times for A, B, and C');
  });
});

describe('the words', () => {
  it('the cap noun is the owner\'s "the season\'s 3 emails", from the real cap', () => {
    assert.equal(CLUB_EMAIL_CAP, 3);
    assert.equal('foot' in W, false, 'the window has no foot sentence (owner dropped it 2026-11-01)');
    assert.match(PRACTICES_SENT_NOTICE.body('U12', CLUB_EMAIL_CAP), /U12’s families their practice times.*the season’s 3 emails\.$/);
  });
  it('singulars', () => {
    assert.equal(W.lead(1, 1), 'Practice times go to 1 family on 1 team.');
    assert.equal(W.lead(8, 2), 'Practice times go to 8 families on 2 teams.');
    assert.equal(W.reminder(1), '1 team’s families haven’t been sent their practice times');
    assert.equal(W.tellThem, 'Tell the families');
    assert.equal(W.totalWords(0), 'One email per family.');
    assert.equal(W.totalWords(1), 'One email per family. 1 family has a child on more than one team, so it counts once.');
    assert.equal(W.leftOutRow(2, true), '2 more families have no working email, so they won’t get this.');
    assert.equal(W.leftOutRow(1, false), '1 family has no working email, so they won’t get this.');
    assert.equal(W.againChange(2, 1), '2 teams’ practices change. 1 team’s don’t.');
    assert.equal(W.leftOut(1), '1 family has no email that works, so they won’t get this.');
    assert.equal(W.send(1), 'Send to 1 family');
  });
  it('the step 1 foot no longer says families aren\'t emailed', () => {
    const src = read('lib/league-practice-time.ts');
    assert.ok(!src.includes('Families aren’t emailed.'));
  });
});

describe('guards (owner 2026-10-31: no link is ever sent to a family; one household reader)', () => {
  // As code, comments stripped: the header comments say what the email never carries.
  const sender = readCode('lib/league-practice-tell-server.ts');
  const words = readCode('lib/league-practice-tell.ts');
  it('the family email carries no link, button, unsubscribe, "Open in the app" or "Your sign-up"', () => {
    for (const src of [words]) {
      for (const bad of ['http', 'href', 'unsubscribe', 'Unsubscribe', 'Open in the app', 'Your sign-up']) {
        assert.ok(!src.includes(bad), `the practice email's words mention ${bad}`);
      }
    }
    assert.match(words, /link: null,/);
    assert.ok(!/warmEmailButton|statusUrl|href/.test(sender), 'the sender builds no link');
  });
  it('households come from readHouseholds and nowhere else', () => {
    assert.ok(sender.includes("import { readHouseholds, type Household } from './club-schedule-league-mail';"));
    // Every household list handed to the database is the reader's, filtered.
    const passed = [...sender.matchAll(/p_households: householdRows\((\w+)\)/g)].map(m => m[1]);
    assert.deepEqual(passed, ['households', 'households']);
    assert.equal((sender.match(/const households = sendableHouseholds\(/g) ?? []).length, 2);
    assert.ok(!/group\w*\(.*guardian_email/i.test(sender));
  });
  it('the shared household reader drops a division whose teams are not published, so the club\'s practice-change email agrees with the Tell gate', () => {
    const mail = readCode('lib/club-schedule-league-mail.ts');
    const reader = mail.slice(mail.indexOf('export async function readHouseholds'), mail.indexOf('export function householdParts'));
    assert.ok(reader.includes("select('id, teams_published_at')"), 'the reader looks up which divisions are published');
    assert.ok(/filter\(x => x\.division_id && published\.has\(x\.division_id\)\)/.test(reader), 'and keeps only a published division\'s registrations');
  });
});

describe('the moved child (Part 4, owner 2026-10-31: dates only once the new team has been TOLD)', () => {
  it('the new-team email reads its dates from the told snapshot, and gains no link', () => {
    const mail = readCode('lib/house-league-placement-mail.ts');
    assert.ok(mail.includes('toldDateLines(org.id, movedTo)'));
    assert.ok(mail.includes('practices: toldLines.has(child.team_id!) ?'));
    const server = readCode('lib/league-practice-tell-server.ts');
    // From the snapshot of what families were TOLD (readTold), never the practices as they are now.
    const told = server.slice(server.indexOf('export async function toldDateLines'), server.indexOf('interface TeamRow'));
    assert.ok(told.includes('await readTold(') && !told.includes('readPracticesNow('));
    const html = readCode('lib/email.ts');
    const moved = html.slice(html.indexOf('export function leagueTeamMovedHtml'), html.indexOf('export function leaguePracticesChangedHtml'));
    // Signed-in family accounts Stage 1: the one button is "Your sign-up" (signupButton), drawn only while money is owed.
    assert.equal(moved.split('signupButton(').length - 1, 1, 'one button, as before');
    assert.ok(!moved.includes('warmEmailButton('), 'and no second one');
    assert.ok(moved.includes('input.practices.zone'));
  });
});

describe('families are told their team before anything about it (owner 2026-11-01, /ux)', () => {
  const server = readCode('lib/league-practice-tell-server.ts');
  it('a division whose teams are not published names nobody and refuses the press', () => {
    const readTell = server.slice(server.indexOf('export async function readTell('), server.indexOf('async function registeredTeams'));
    assert.ok(readTell.includes('publishedDivisions(season.id)') && readTell.includes('unpublishedRead('));
    const press = server.slice(server.indexOf('export async function tellFamilies('), server.indexOf('export async function sendPracticeNotice'));
    assert.ok(press.indexOf("refusedWith('teams_first')") > -1 && press.indexOf("refusedWith('teams_first')") < press.indexOf("refusedWith(p.saw.length ? 'already' : 'nothing')"),
      'the teams-first refusal comes before any other reading of the teams');
  });
  it('the schedule’s reminder counts only divisions with published teams', () => {
    const reminders = server.slice(server.indexOf('export async function readTellReminders('));
    assert.ok(reminders.includes('publishedDivisions(seasonId)') && reminders.includes('published.has(t.division_id)'));
  });
  it('says it with the game Publish’s own sentence, and the route has a row for the refusal', () => {
    assert.equal(W.teamsFirst('U9'), 'Publish U9’s teams first, so every family knows its child’s team.');
    assert.ok(readCode('app/api/admin/house-league/seasons/[seasonId]/practice-tell/route.ts').includes('teams_first: { status: 409, error: R.teamsFirst }'));
  });
});
