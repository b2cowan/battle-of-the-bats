import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import {
  REMIND_GAP_MS, coachBellFires, lineupFamilyOuts, lineupTagWord, mergeCoachBell, remindAgainAt, remindPlan, roomFamilySummary,
  type CoachBellItem, type RoomFamilyRow,
} from '../../lib/family-availability-rules.ts';
import {
  FAMILY_AVAILABILITY_COACH_WORDS as CW, FAMILY_AVAILABILITY_WORDS as W, FAMILY_REMIND_COACH_WORDS as RW,
  FAMILY_REMINDER_WORDS as EW, coachBellWords, reminderEventLabel,
} from '../../lib/family-availability-words.ts';
import { lineupRowWords } from '../../lib/coach-schedule-sheet.ts';
import { joinWithAnd } from '../../lib/utils.ts';
import { ORG_TIME_ZONE } from '../../lib/timezone.ts';
import { functionBody, readCode, readSource } from './_source-code.ts';

/**
 * Signed-in family accounts Stage 4b, Session 3 (Parts 6–8; build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md;
 * drawing tabs 4–6). The pure rules by their real output; "this path never does X" by its source. The database half (a new day
 * clears answers, a leaving parent's notes go, a deleted account's note goes) is tests/sql/family-availability-fixture.sql 8–10.
 */

const REMIND_MODULE = 'lib/family-availability-remind.ts';
const REMIND_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/family-remind/route.ts';
const BELL_MODULE = 'lib/family-availability-coach-bell.ts';
const LINEUP_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/lineup/route.ts';
const EVENTS_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts';
const EVENT_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts';
const TEMPLATE_PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/lineups/templates/[templateId]/page.tsx';
const GAME_LINEUP_PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx';
const MIG_480 = 'supabase/migrations/480_a_new_day_asks_families_again.sql';

const T0 = '2027-04-20T14:00:00.000Z';
const LATER = '2027-04-21T14:00:00.000Z';

describe('Part 6 — the lineup: one rule for the pool, the builder’s warning, the Lineup row and the triangle', () => {
  it('the pool word: the coach’s mark first (Out), then the family’s Out / Maybe; In says nothing', () => {
    assert.equal(lineupTagWord('absent', { answer: 'in' }), 'out');
    assert.equal(lineupTagWord('attending', { answer: 'out' }), null);
    assert.equal(lineupTagWord('unknown', { answer: 'out' }), 'out');
    assert.equal(lineupTagWord('unknown', { answer: 'maybe' }), 'maybe');
    assert.equal(lineupTagWord('unknown', { answer: 'in' }), null);
    assert.equal(lineupTagWord('unknown', null), null);
  });
  it('a lineup player with a family Out and no mark counts, whenever the Out came; afterSave says which sentence', () => {
    const outs = lineupFamilyOuts([
      { playerId: 'maya', status: 'unknown', markedAt: null, family: { answer: 'out', answeredAt: LATER } },
      { playerId: 'ava', status: 'unknown', markedAt: null, family: { answer: 'out', answeredAt: '2027-04-19T00:00:00.000Z' } },
      { playerId: 'noor', status: 'unknown', markedAt: null, family: { answer: 'maybe', answeredAt: LATER } },
      { playerId: 'zoe', status: 'unknown', markedAt: null, family: { answer: 'out', answeredAt: LATER } }, // not in the lineup
    ], new Set(['maya', 'ava', 'noor']), T0);
    assert.deepEqual(outs, [{ playerId: 'maya', afterSave: true }, { playerId: 'ava', afterSave: false }]);
  });
  it('a player the coach marked In counts only when the Out came after BOTH the mark and the save; marked Out is the book’s own line', () => {
    const players = (markedAt: string, answeredAt: string) => [
      { playerId: 'maya', status: 'attending' as const, markedAt, family: { answer: 'out' as const, answeredAt } },
      { playerId: 'leo', status: 'absent' as const, markedAt, family: { answer: 'out' as const, answeredAt } },
    ];
    const inLineup = new Set(['maya', 'leo']);
    assert.deepEqual(lineupFamilyOuts(players('2027-04-19T00:00:00.000Z', LATER), inLineup, T0), [{ playerId: 'maya', afterSave: true }]);
    assert.deepEqual(lineupFamilyOuts(players('2027-04-22T00:00:00.000Z', LATER), inLineup, T0), [], 'the coach re-marked after the Out');
    assert.deepEqual(lineupFamilyOuts(players('2027-04-19T00:00:00.000Z', LATER), inLineup, '2027-04-22T00:00:00.000Z'), [], 'saved after the Out');
  });
  it('the builder’s and the event window’s words', () => {
    assert.equal(CW.lineup.warn(['Maya'], true), '⚠ Maya’s family said Out after you saved this lineup.');
    assert.equal(CW.lineup.warn(['Maya', 'Blake'], true), '⚠ 2 families said Out after you saved this lineup: Maya, Blake');
    assert.equal(CW.lineup.takeOut(['Maya']), 'Take Maya out');
    assert.equal(CW.lineup.takeOut(['Maya', 'Blake']), 'Take them out');
    const words = lineupRowWords({
      hasLineup: true, door: 'builder',
      mismatch: { coming: [], out: [], family: { afterSave: [{ firstName: 'Maya' } as never], before: [] } },
    });
    assert.equal(words.head, 'Lineup · Needs a look');
    assert.equal(words.line, 'Maya’s family said Out after you saved');
    assert.equal(words.warn, true);
  });
  it('the template editor gets nothing; only a coach who can also mark attendance gets the answers; the triangle reads the same rule', () => {
    assert.doesNotMatch(readCode(TEMPLATE_PAGE), /family=/);
    assert.match(readCode(GAME_LINEUP_PAGE), /family=\{familyView\}/);
    assert.match(readCode(LINEUP_ROUTE), /!isReadOnly && capabilities\.attendance \? lineupFamilyAnswers\(/);
    assert.match(readCode(EVENTS_ROUTE), /capabilities\.attendance && programYear\.status === 'active'\s*\?\s*familyLineupFlagEventIds\(/);
    assert.match(functionBody(readCode('lib/family-availability-coach.ts'), 'familyLineupFlagEventIds'), /lineupFamilyOuts\(/);
    const lineupRead = functionBody(readCode('lib/family-availability-coach.ts'), 'lineupFamilyAnswers');
    assert.doesNotMatch(lineupRead, /note|answered_by|previous_/, 'the lineup never reads a note or who answered');
  });
  it('Take out changes only the lineup', () => {
    assert.match(readCode(GAME_LINEUP_PAGE), /onTakeOut: removePlayersFromLineup\b/);
  });
});

describe('Part 6 — a moved event, and a parent who leaves (guards k and l; the database rules are the fixture’s)', () => {
  it('mig 480 holds the three rules', () => {
    const sql = fs.readFileSync(MIG_480, 'utf8');
    for (const t of ['rep_team_events_new_day_clears_availability', 'family_links_end_clears_answer_notes', 'event_availability_answers_writer_gone']) {
      assert.match(sql, new RegExp(`create trigger ${t}`), t);
    }
    assert.match(sql, /at time zone 'America\/Toronto'\)::date is distinct from/);
  });
  it('the notice says families answer again only when a new day cleared answers, never on a cancel', () => {
    const route = readCode(EVENT_ROUTE);
    // Told only when answers existed AND the moved event can still be answered (the switch covers it, the new time is ahead).
    assert.match(route, /const familyAnswersCleared = dayChanges && fields\.startsAt/);
    assert.match(route, /await eventHasFamilyAnswers\(eventId\)/);
    assert.match(route, /familyAnswerState\(setting,[^)]*\)[^;]*=== 'open'/);
    assert.match(route, /answersCleared: familyAnswersCleared/);
    const notifyCode = readCode('lib/family-notify.ts');
    assert.match(notifyCode, /params\.answersCleared && params\.kind !== 'cancelled'/);
    assert.equal(W.answerAgain, 'Families who said whether their player is coming will need to answer again on the team page.');
  });
  it('the parent’s page names only a parent who is still connected (a departed parent reads as “the other parent”)', () => {
    const read = functionBody(readCode('lib/family-availability.ts'), 'readFamilyAnswers');
    assert.match(read, /connected\.has\(`\$\{childId\}\|\$\{userId\}`\)/);
    assert.equal(W.sheet.otherAnswered(null, 'out', 'on Tuesday', false), 'The other parent answered Out on Tuesday.');
  });
});

describe('Part 7 — Remind: who, once a day, through the one family door', () => {
  it('the recipient rule: a parent in the app, no answer, not marked; a marked player is settled; no parent is reported', () => {
    const plan = remindPlan([
      { playerId: 'owen', status: 'unknown', answered: false, connected: true },
      { playerId: 'ezra', status: 'attending', answered: false, connected: true },
      { playerId: 'zoe', status: 'unknown', answered: false, connected: false },
      { playerId: 'kai', status: 'absent', answered: false, connected: false },
      { playerId: 'ava', status: 'unknown', answered: true, connected: true },
    ]);
    assert.deepEqual(plan, { remind: ['owen'], marked: ['ezra'], noParent: ['zoe'] });
  });
  it('the room’s card counts the same families (call-ups never)', () => {
    const fam: RoomFamilyRow[] = [
      { playerId: 'owen', connected: true, line: null, answeredAt: null },
      { playerId: 'ezra', connected: true, line: null, answeredAt: null },
    ];
    const s = roomFamilySummary([
      { playerId: 'owen', status: 'unknown', markedAt: null },
      { playerId: 'ezra', status: 'attending', markedAt: T0 },
      { playerId: 'callup', status: 'unknown', markedAt: null },
    ], fam);
    assert.deepEqual(s.remind, ['owen']);
  });
  it('again in 24 hours, and the words (drawing tab 4)', () => {
    assert.equal(remindAgainAt('2027-04-20T20:12:00.000Z'), '2027-04-21T20:12:00.000Z');
    assert.equal(RW.ask(['Owen']), 'Remind Owen’s family?');
    assert.equal(RW.who({ families: ['Owen'], parents: 2, label: 'Ridge 12U vs Lakeshore', date: 'Sat, Apr 24' }),
      'Owen’s 2 parents get a note in the app and an email: “Ridge 12U vs Lakeshore, Sat, Apr 24: is Owen coming? Answer on the team page.”');
    assert.equal(RW.appOnly(1, 2, 'Riverdale Ridge Baseball'), 'One of them has turned off Riverdale Ridge Baseball’s emails, so they get the app note only.');
    assert.equal(RW.noParent(['Zoe', 'Ian', 'Kai']), 'Zoe, Ian and Kai have no parent in the app.');
    assert.equal(RW.send(1), 'Send 1 reminder');
    assert.equal(RW.report(['Owen'], 2), 'Reminded Owen’s family (2 parents)');
    const sent = '2027-04-20T20:12:00.000Z';
    const again = remindAgainAt(sent);
    assert.equal(RW.when(sent, again, Date.parse(sent)), 'Reminded at 4:12 p.m. You can remind again tomorrow at 4:12 p.m.');
    // Read the next morning, the 24 hours end later that same day: "today", never "tomorrow".
    assert.equal(RW.when(sent, again, Date.parse('2027-04-21T13:00:00.000Z')), 'Reminded at 4:12 p.m. You can remind again today at 4:12 p.m.');
    assert.equal(joinWithAnd(['Owen', 'Mia']), 'Owen and Mia');
  });
  it('guard (f): the email names the event and the child, never the child in the subject, and carries no answer, token or address', () => {
    const label = reminderEventLabel({ teamName: 'Ridge 12U', eventType: 'league_game', name: 'Game', opponent: 'Lakeshore', homeAway: 'home' });
    assert.equal(EW.subject(label, 'Sat, Apr 24', 1), 'Ridge 12U vs Lakeshore, Sat, Apr 24: is your player coming?');
    assert.equal(EW.subject(label, 'Sat, Apr 24', 2), 'Ridge 12U vs Lakeshore, Sat, Apr 24: are your players coming?');
    assert.equal(EW.title(['Owen', 'Mia']), 'Are Owen and Mia coming?');
    const remind = readCode(REMIND_MODULE);
    assert.match(remind, /const teamPagePath = \(teamId: string, eventId: string\) => `\/family\/teams\/\$\{teamId\}\?event=\$\{eventId\}`/);
    assert.doesNotMatch(remind, /token|answer=|email=|\?to=/i, 'no token, no answer and no address in a link');
  });
  it('guard (e): every reminder email goes through the family door with the unsubscribe list, which fails closed; no stop list is read', () => {
    const remind = readCode(REMIND_MODULE);
    assert.match(remind, /import \{ getFamilySuppressionList, sendFamilyEmail \} from '\.\/family-email'/);
    assert.doesNotMatch(remind, /from '\.\/email'|sendEmail\(|sendEmailBatch|sendFamilyServiceBatch|sendTransactionalEmail/);
    assert.match(remind, /sendFamilyEmail\(\{[\s\S]*?suppressed,/);
    assert.doesNotMatch(remind, /second_parent_stops/);
    // The address is the connected ACCOUNT's own, never the invited address.
    assert.match(remind, /auth\.admin\.getUserById\(userId\)/);
    assert.doesNotMatch(remind, /invited_email/);
  });
  it('the 24-hour slot is the database’s claim, taken before the send, and given back when every email failed', () => {
    const send = functionBody(readCode(REMIND_MODULE), 'sendRemind');
    assert.ok(send.indexOf("rpc('event_availability_remind_claim'") < send.indexOf('sendFamilyEmail('), 'claim before send');
    // Emails first, bells after: a send where every email plainly failed gives the slot back before any bell.
    assert.match(send, /if \(emailsTried > 0 && emailsFailed === emailsTried\) \{\s*await release\(\);/);
    assert.ok(send.indexOf('sendFamilyEmail(') < send.indexOf('notify('), 'emails before bells');
    assert.ok(send.indexOf('await release();') < send.indexOf('notify('), 'the give-back comes before any bell');
    assert.match(send, /catch \(err\) \{\s*await release\(\);\s*throw err;/);
  });
  it('the rules’ 24-hour gap is the database’s claim gap, and the trigger’s zone is the app’s', () => {
    assert.equal(REMIND_GAP_MS, 24 * 60 * 60 * 1000);
    assert.match(fs.readFileSync('supabase/migrations/476_families_say_if_theyre_coming.sql', 'utf8'), /v_last > now\(\) - interval '24 hours'/);
    assert.match(fs.readFileSync(MIG_480, 'utf8'), new RegExp(`at time zone '${ORG_TIME_ZONE}'`));
  });
  it('the route: 404 while the tier is off, the attendance capability, the live season only', () => {
    const route = readCode(REMIND_ROUTE);
    assert.match(route, /if \(!GUARDIAN_TIER_ENABLED\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\)/);
    assert.match(route, /denyUnless\(assignment\.capabilities\.attendance/);
    assert.match(route, /getActiveRepProgramYear\(teamId\)/);
  });
});

describe('Part 8 — the coach’s bell', () => {
  const NEAR = '2027-04-21T12:00:00.000Z';
  const FAR = '2027-05-20T12:00:00.000Z';
  const now = new Date(T0);
  it('an Out at any time; any change (a clear too) in the 48 hours before; never a first In or Maybe or a note-only save', () => {
    assert.equal(coachBellFires(null, 'out', FAR, now), true);
    assert.equal(coachBellFires('in', 'out', FAR, now), true);
    assert.equal(coachBellFires(null, 'in', NEAR, now), false);
    assert.equal(coachBellFires(null, 'maybe', NEAR, now), false);
    assert.equal(coachBellFires('out', 'in', FAR, now), false);
    assert.equal(coachBellFires('out', 'in', NEAR, now), true);
    assert.equal(coachBellFires('in', null, NEAR, now), true);
    assert.equal(coachBellFires('out', 'out', NEAR, now), false);
  });
  const item = (over: Partial<CoachBellItem>): CoachBellItem => ({
    eventId: 'e1', eventLabel: 'Sat vs Lakeshore', eventDay: 'Sat, Apr 24', childId: 'c-ava', child: 'Ava', answer: 'out', prior: null,
    parent: 'Priya', hasNote: true, markWord: null, count: '9 of 13 in · 1 out · 1 maybe', ...over,
  });
  it('the words as drawn, and never the note’s words', () => {
    assert.deepEqual(coachBellWords({ kind: 'event', items: [item({})] }),
      { title: 'Ava is Out for Sat vs Lakeshore', body: 'Priya left a note · now 9 of 13 in · 1 out · 1 maybe' });
    assert.deepEqual(coachBellWords({ kind: 'event', items: [item({ child: 'Maya', prior: 'in', markWord: 'In', hasNote: false })] }),
      { title: 'Maya’s family changed to Out for Sat vs Lakeshore', body: 'Was In · your mark still says In' });
    assert.doesNotMatch(readCode(BELL_MODULE), /\.note\b|'note'|note:/, 'the bell never reads a note');
  });
  it('bundling: the same event folds into one line; one family across events folds into one line; else a new line', () => {
    const first = mergeCoachBell([], item({}), 't');
    assert.equal(first.id, null);
    const e = mergeCoachBell([{ id: 'n1', bundle: first.bundle }], item({ childId: 'c-leo', child: 'Leo' }), 't');
    assert.equal(e.id, 'n1');
    assert.equal(e.bundle.kind, 'event');
    assert.equal(coachBellWords(e.bundle).title, '2 families said Out for Sat vs Lakeshore');
    const f = mergeCoachBell([{ id: 'n1', bundle: first.bundle }], item({ eventId: 'e2', eventDay: 'Tue, May 4' }), 't');
    assert.equal(f.id, 'n1');
    assert.equal(f.bundle.kind, 'family');
    assert.deepEqual(coachBellWords(f.bundle), { title: 'Ava’s family said Out for 2 events', body: 'Sat, Apr 24 · Tue, May 4' });
    assert.equal(mergeCoachBell([{ id: 'n1', bundle: first.bundle }], item({ eventId: 'e2', childId: 'c-leo' }), 't').id, null);
  });
  it('to coaches who can mark attendance only, never to the parent who answered, never an empty list (= everyone)', () => {
    const code = readCode(BELL_MODULE);
    assert.match(code, /m\.userId !== params\.actorUserId && resolveMembershipCapabilities\(m\)\.attendance/);
    assert.match(code, /if \(coachIds\.length === 0\) return;/);
    assert.match(readCode('app/api/family/teams/[teamId]/events/[eventId]/availability/route.ts'), /await notifyCoachesOfFamilyAnswer\(/);
  });
  it('Account → Notifications: the "Family answers" row only for a coach whose team has it on', () => {
    const client = readSource('app/(consumer)/account/notifications/AccountNotificationsClient.tsx');
    assert.match(client, /\.\.\.\(familyAnswers \? \[\{\s*label: 'Family answers',\s*blurb: 'When a family says Out, or changes an answer in the 48 hours before an event\.'/);
    assert.match(functionBody(readCode('lib/family-availability-coach.ts'), 'marksFamilyAnswersInOrg'), /if \(!GUARDIAN_TIER_ENABLED\) return false/);
  });
});
