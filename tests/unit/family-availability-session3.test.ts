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
 * clears NOTHING since call C1, a leaving parent's notes go, a deleted account's note goes) is
 * tests/sql/one-attendance-record-fixture.sql 10–12.
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
  it('the pool word reads the one answer, whoever set it: Out or Maybe; In, Late and Not marked say nothing', () => {
    assert.equal(lineupTagWord('absent'), 'out');
    assert.equal(lineupTagWord('maybe'), 'maybe');
    assert.equal(lineupTagWord('attending'), null);
    assert.equal(lineupTagWord('late'), null);
    assert.equal(lineupTagWord('unknown'), null);
  });
  it('a lineup player whose Out a FAMILY set is worded as the family’s, whenever it came; afterSave says which sentence', () => {
    const outs = lineupFamilyOuts([
      { playerId: 'maya', status: 'absent', family: { status: 'absent', answeredAt: LATER } },
      { playerId: 'ava', status: 'absent', family: { status: 'absent', answeredAt: '2027-04-19T00:00:00.000Z' } },
      { playerId: 'noor', status: 'maybe', family: { status: 'maybe', answeredAt: LATER } },
      { playerId: 'zoe', status: 'absent', family: { status: 'absent', answeredAt: LATER } }, // not in the lineup
    ], new Set(['maya', 'ava', 'noor']), T0, true);
    assert.deepEqual(outs, [{ playerId: 'maya', afterSave: true }, { playerId: 'ava', afterSave: false }]);
  });
  it('a coach’s own Out is the book’s line, not the family’s; a coach who taps In over a family’s Out takes it off', () => {
    const inLineup = new Set(['maya', 'leo']);
    assert.deepEqual(lineupFamilyOuts([
      { playerId: 'maya', status: 'attending', family: { status: 'absent', answeredAt: LATER } }, // tapped In in this screen
      { playerId: 'leo', status: 'absent', family: null }, // the coach's own Out
    ], inLineup, T0, true), []);
    // The two never say the same player twice: the callers leave the family's Outs out of "marked Out but still in the lineup".
    assert.match(readCode(GAME_LINEUP_PAGE), /lineupRowIds\.has\(r\.player\.id\) && !familyOutIds\.has\(r\.player\.id\)\);/);
    assert.match(readCode('components/coaches/ScheduleEventSheet.tsx'), /lineupEntryIds\.has\(r\.player\.id\) && !familyOutIds\.has\(r\.player\.id\)\)/);
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
  it('the template editor gets nothing; only a coach who can also mark attendance gets the answers; the triangle is the book’s', () => {
    assert.doesNotMatch(readCode(TEMPLATE_PAGE), /family=/);
    assert.match(readCode(GAME_LINEUP_PAGE), /family=\{familyView\}/);
    assert.match(readCode(LINEUP_ROUTE), /!isReadOnly && capabilities\.attendance \? lineupFamilyAnswers\(/);
    // One attendance record (S2): a family's Out IS the status, so the book's own rule is the whole triangle.
    assert.doesNotMatch(readCode(EVENTS_ROUTE), /familyLineupFlagEventIds/);
    assert.doesNotMatch(readCode('lib/family-availability-coach.ts'), /familyLineupFlagEventIds/);
    assert.match(readCode(EVENTS_ROUTE), /const \[\[lineupMismatchEventIds, lineupReadiness\], \[tags,/);
    const lineupRead = functionBody(readCode('lib/family-availability-coach.ts'), 'lineupFamilyAnswers');
    assert.doesNotMatch(lineupRead, /note|set_by_user_id|previous_/, 'the lineup never reads a note or who answered');
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
  it('C1 (owner 2026-11-13, reverses ask 10): a new day clears NOTHING, and no notice asks families to answer again', () => {
    // Mig 485 drops the new-day trigger (not retargeted); answers and the Remind log carry over.
    const mig485 = readCode('supabase/migrations/485_the_family_answers_table_retires.sql');
    assert.match(mig485, /drop trigger if exists rep_team_events_new_day_clears_availability on public\.rep_team_events;/);
    assert.match(mig485, /drop function if exists public\.rep_team_events_new_day_clears_availability\(\);/);
    assert.doesNotMatch(readCode(EVENT_ROUTE), /familyAnswersWillClear|familyAnswersCleared|answersCleared/);
    assert.doesNotMatch(readCode('lib/family-notify.ts'), /answersCleared|answerAgain/);
    assert.doesNotMatch(readCode('lib/family-availability-words.ts'), /answerAgain/, 'the words file no longer holds the sentence (S2)');
    assert.doesNotMatch(readCode('lib/family-availability-coach.ts'), /familyAnswersWillClear/);
  });
  it('the parent’s page names only a parent who is still connected (a departed parent reads as “the other parent”)', () => {
    const read = functionBody(readCode('lib/family-availability.ts'), 'readFamilyAnswers');
    assert.match(read, /connected\.has\(`\$\{childId\}\|\$\{userId\}`\)/);
    assert.equal(W.setLine('absent', { by: 'family', name: null, day: 'Tue', previous: null }), 'Out · The other parent, Tue');
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
      { playerId: 'owen', connected: true },
      { playerId: 'ezra', connected: true },
    ];
    const s = roomFamilySummary([
      { playerId: 'owen', status: 'unknown', setByKind: null },
      { playerId: 'ezra', status: 'attending', setByKind: 'coach' },
      { playerId: 'callup', status: 'unknown', setByKind: null },
    ], fam);
    assert.deepEqual(s.remind, ['owen']);
  });
  it('again in 24 hours, and the words (drawing tab 4)', () => {
    assert.equal(remindAgainAt('2027-04-20T20:12:00.000Z'), '2027-04-21T20:12:00.000Z');
    assert.equal(RW.ask(['Owen']), 'Remind about Owen?');
    assert.equal(RW.ask(['Owen', 'Maya']), 'Remind about Owen and Maya?');
    assert.equal(RW.who({ players: ['Owen'], parents: 2, label: 'Ridge 12U vs Lakeshore', date: 'Sat, Apr 24' }),
      'Owen’s 2 parents get a note in the app and an email asking whether Owen is coming to Ridge 12U vs Lakeshore, Sat, Apr 24.');
    assert.equal(RW.appOnly(1, 2, 'Riverdale Ridge Baseball'), 'One of them has unsubscribed from Riverdale Ridge Baseball’s emails, so that parent gets the app note only.');
    assert.equal(RW.capped(2), '2 parents have already had a reminder email today, so they get the app note only.');
    assert.equal(RW.ask(['A', 'B', 'C', 'D', 'E']), 'Remind about A, B and 3 others?');
    assert.equal(RW.noParent(['Zoe', 'Ian', 'Kai']), 'Zoe, Ian and Kai have no parent in the app.');
    // Owner, Session 4: name players, count parents (one message per parent; two siblings are not two families).
    assert.equal(RW.send(1), 'Send to 1 parent');
    assert.equal(RW.send(3), 'Send to 3 parents');
    assert.equal(RW.report(['Owen'], 2), 'Reminded 2 parents about Owen');
    assert.equal(RW.report(['Owen', 'Maya'], 2), 'Reminded 2 parents about Owen and Maya');
    const sent = '2027-04-20T20:12:00.000Z';
    const again = remindAgainAt(sent);
    assert.equal(RW.when(sent, again, Date.parse(sent)), 'Reminded at 4:12 p.m. You can remind again tomorrow at 4:12 p.m.');
    // Read the next morning, the 24 hours end later that same day: "today", never "tomorrow".
    assert.equal(RW.when(sent, again, Date.parse('2027-04-21T13:00:00.000Z')), 'Reminded yesterday at 4:12 p.m. You can remind again today at 4:12 p.m.');
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
    assert.equal(route.match(/await resolveFamilyAttendanceContext\(params\)/g)?.length, 2, 'GET and POST both run the chain');
    const chain = functionBody(readCode('lib/family-coach-route.ts'), 'resolveFamilyAttendanceContext');
    assert.match(chain, /if \(!GUARDIAN_TIER_ENABLED\) return \{ error: NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\) \}/);
    assert.match(chain, /denyUnless\(resolved\.assignment\.capabilities\.attendance/);
    assert.match(chain, /getActiveRepProgramYear\(teamId\)/);
  });
});

describe('Part 8 — the coach’s bell', () => {
  const NEAR = '2027-04-21T12:00:00.000Z';
  const FAR = '2027-05-20T12:00:00.000Z';
  const now = new Date(T0);
  it('an Out, or an Out taken back, at any time; any change (a clear too) in the 48 hours before; never a first In or Maybe or a note-only save', () => {
    assert.equal(coachBellFires(null, 'absent', FAR, now), true);
    assert.equal(coachBellFires('attending', 'absent', FAR, now), true);
    assert.equal(coachBellFires(null, 'attending', NEAR, now), false);
    assert.equal(coachBellFires(null, 'maybe', NEAR, now), false);
    assert.equal(coachBellFires(null, 'late', NEAR, now), false);
    // Owner, Session 4: an Out taken back rings at any time, else the coach's unread line keeps saying "Out".
    assert.equal(coachBellFires('absent', 'attending', FAR, now), true);
    assert.equal(coachBellFires('absent', null, FAR, now), true);
    assert.equal(coachBellFires('absent', 'maybe', FAR, now), true);
    assert.equal(coachBellFires('attending', 'maybe', FAR, now), false);
    assert.equal(coachBellFires('maybe', null, FAR, now), false);
    assert.equal(coachBellFires('absent', 'attending', NEAR, now), true);
    assert.equal(coachBellFires('attending', null, NEAR, now), true);
    assert.equal(coachBellFires('absent', 'absent', NEAR, now), false);
    // One record: the prior is any setter's — a parent's In over the coach's Late is a change, inside the 48 hours.
    assert.equal(coachBellFires('late', 'attending', NEAR, now), true);
    assert.equal(coachBellFires('late', 'attending', FAR, now), false);
  });
  const item = (over: Partial<CoachBellItem>): CoachBellItem => ({
    eventId: 'e1', eventLabel: 'Sat vs Lakeshore', eventDay: 'Sat, Apr 24', childId: 'c-ava', child: 'Ava', answer: 'absent', prior: null,
    parent: 'Priya', hasNote: true, count: '9 of 13 in · 1 out · 1 maybe', ...over,
  });
  it('the words as drawn, and never the note’s words', () => {
    assert.deepEqual(coachBellWords({ kind: 'event', items: [item({})] }),
      { title: 'Ava’s family said Out for Sat vs Lakeshore', body: 'Priya left a note · now 9 of 13 in · 1 out · 1 maybe' });
    assert.deepEqual(coachBellWords({ kind: 'event', items: [item({ child: 'Maya', prior: 'late', hasNote: false, count: null })] }),
      { title: 'Maya’s family changed to Out for Sat vs Lakeshore', body: 'Was Late' });
    assert.doesNotMatch(readCode(BELL_MODULE), /markWord/, 'one record cannot disagree with itself: no "your mark still says"');
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

describe('a dev bell line filed before One attendance record still folds into words (S3)', () => {
  it('the unread line is read through the old-to-current answer mapping, so a fold never says "undefined"', () => {
    const src = readCode(BELL_MODULE);
    assert.match(src, /const OLD_ANSWER_WORD: Record<string, AnswerStatus> = \{ in: 'attending', out: 'absent' \};/);
    assert.match(src, /list\.push\(\{ id: r\.id, bundle: withCurrentAnswerWords\(r\.metadata\.bundle\) \}\);/);
  });
});
