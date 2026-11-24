/**
 * Notifications read at a glance, Stage 2 — the shared stored-facts shape (plan
 * docs/projects/archive/NOTIFICATION_MESSAGE_ROWS_PLAN.md; drawing tab 1; owner rulings Q1–Q3 and Q9, 2026-11-14).
 *
 *   · the shape round-trips through a notification's metadata; anything else reads as null (the notice keeps its paragraph)
 *   · every label in the shared vocabulary is at most 11 characters (Q1)
 *   · a list folds past 6 and keeps at most 30, the sender's closing line past that (Q3)
 *   · the reader drops the next step once the notice is settled (Q2), and pins the phone sheet's buttons only when it outgrows (Q9)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FACT_FOLD_WORDS, FACT_LABELS, FACT_LABEL_MAX, FACT_LIST_FOLD, FACT_LIST_MAX, capFactList, factLine, factLineText, factRow, noticeFacts,
  readNoticeFacts, type NoticeFacts,
} from '../../lib/notification-facts.ts';
import { readCode } from './_source-code.ts';
import {
  DEBIT_NOTICE_WORDS as DW, DISPUTE_WORDS as D, LEAGUE_ONLINE_NOTICE_WORDS as LW, OVER_WORDS as OW, notRecordedNotice, refundFailedNotice,
} from '../../lib/online-payment-words.ts';
import { CLUB_MONEY_NOTICE } from '../../lib/club-money-words.ts';
import { SCHEDULE_NOTICES } from '../../lib/club-schedule-words.ts';
import { FAMILY_HANDOFF_COACH_WORDS } from '../../lib/families-words.ts';
import { HAND_BACK_WORDS as H } from '../../lib/club-hand-back-words.ts';
import { LEAGUE_ADMIN_NOTICE, NO_LEAGUE_COUNTS } from '../../lib/club-schedule-league-words.ts';
import { coachBellWords } from '../../lib/family-availability-words.ts';
import { formatInsightDigest } from '../../lib/insight-findings.ts';
import { championsNotice } from '../../lib/champions.ts';
import { signupNotice } from '../../lib/league-signup.ts';
import { ASK_WORDS } from '../../lib/house-league-money-words.ts';
import { staffApprovalNotice } from '../../lib/coach-capabilities.ts';
import { practicePlanSentMessage } from '../../lib/practice-plan-send.ts';
import { clubSeasonNotice, clubSeasonStartedCard } from '../../lib/club-season-notice.ts';
import { scoreNotice, standingResult } from '../../lib/score-notice.ts';

const NOUN = { one: 'game', many: 'games' };

describe('the stored facts (A)', () => {
  it('round-trip through a notification’s metadata', () => {
    const facts = noticeFacts([
      factRow('Amount', '$450.00', { lead: true, detail: 'receipt 1042' }),
      factRow('Paid by', 'Pat Doe'),
      factRow('Games', '3 moved', { list: { lines: ['a', 'b'], noun: NOUN } }),
    ], 'Answer it in Stripe.');
    assert.deepEqual(readNoticeFacts(JSON.parse(JSON.stringify({ seasonId: 'x', facts }))), facts);
  });
  it('a row with no answer is left out, never drawn empty', () => {
    assert.deepEqual(noticeFacts([factRow('Reason', null), factRow('Reason', '  '), factRow('Held', 'Nothing has been taken')]).rows.map(r => r.label), ['Held']);
    assert.equal(noticeFacts([factRow('A', 'b')], '').next, undefined);
  });
  it('a notice without facts, or with a broken shape, reads as null and keeps its paragraph (ruling 4)', () => {
    for (const meta of [
      null, undefined, {}, { seasonId: 's' }, { facts: {} }, { facts: { rows: [] } },
      { facts: { rows: [{ label: 'Amount' }] } },
      { facts: { rows: [{ label: 'Amount', value: 5 }] } },
      { facts: { rows: [{ label: 'Amount', value: '$1.00', lead: 'yes' }] } },
      { facts: { rows: [{ label: 'Amount', value: '$1.00', list: { lines: ['a'] } }] } },
      { facts: { rows: [{ label: 'Amount', value: '$1.00' }], next: 7 } },
    ]) assert.equal(readNoticeFacts(meta), null, JSON.stringify(meta));
  });
});

describe('labels (Q1)', () => {
  it('every label in the shared vocabulary is sentence case and at most 11 characters', () => {
    for (const label of Object.values(FACT_LABELS)) {
      assert.ok(label.length <= FACT_LABEL_MAX, `"${label}" is ${label.length} characters`);
      // A word may hold the house apostrophe ("You’re on", Stage 4 ruling Q6).
      assert.match(label, /^[A-Z][a-z’]*( [a-z’]+)*$/, `"${label}" is sentence case`);
    }
    assert.equal(FACT_LABEL_MAX, 11);
  });
  it('the message block never stacks the label above its answer on a phone, and never wears the eyebrow face', () => {
    const css = readCode('components/notifications/NotificationMessage.module.css');
    assert.match(css, /\.fact \{[^}]*grid-template-columns: 5\.5rem minmax\(0, 1fr\);/);
    assert.doesNotMatch(css, /\.fact \{ grid-template-columns: minmax\(0, 1fr\); \}/, 'the reference case’s phone stacking is gone');
    assert.doesNotMatch(css.match(/\.fact dt \{[^}]*\}/)![0], /uppercase|letter-spacing/);
  });
});

describe('long lists (Q3)', () => {
  it('fold at 6 and name their noun', () => {
    assert.equal(FACT_LIST_FOLD, 6);
    assert.equal(FACT_FOLD_WORDS.more(3, NOUN), 'Show 3 more games');
    assert.equal(FACT_FOLD_WORDS.more(1, NOUN), 'Show 1 more game');
    assert.equal(FACT_FOLD_WORDS.fewer(NOUN), 'Show fewer games');
  });
  it('keep at most 30 lines; past 30 the last line is the sender’s', () => {
    const lines = Array.from({ length: 42 }, (_, i) => `line ${i}`);
    const l = capFactList(lines, NOUN, n => `and ${n} more on the schedule`);
    assert.equal(l.lines.length, FACT_LIST_MAX);
    assert.equal(l.overflow, 'and 12 more on the schedule');
    assert.equal(capFactList(lines.slice(0, 30), NOUN, () => 'x').overflow, undefined);
  });
});

describe('the fifteen money notices (C): one wording per kind, rows from the shared vocabulary', () => {
  const VOCAB = new Set<string>(Object.values(FACT_LABELS));
  const team = { team: 'Ridge 12U' };
  const kids = { children: 'Henry', one: true };
  const notices: Record<string, { body: string; facts: ReturnType<typeof noticeFacts> }[]> = {
    debit_returned: [
      DW.returned({ who: kids, total: '$450.00', last4: '6789', day: 'Nov 8', reason: 'insufficient_funds', emailed: true }),
      DW.returned({ who: team, total: '$450.00', last4: null, day: 'Nov 8', reason: null, emailed: false }),
    ],
    debit_reversed: [DW.reversed({ who: kids, receiptNo: '1042', total: '$450.00', day: 'Nov 8', owed: '$450.00', emailed: true })],
    card_disputed: [
      D.item({ payer: 'Pat Doe', receiptNo: '1042', amount: '$450.00', reason: 'fraudulent', held: '$450.00', inquiry: false, due: 'Nov 20 at 11:59 p.m.', dueDay: 'Nov 20', answers: null }),
      D.item({ payer: 'Pat Doe', receiptNo: '1042', amount: '$450.00', reason: null, held: '$0.00', inquiry: true, due: 'Nov 20 at 11:59 p.m.', dueDay: 'Nov 20', answers: 'Pat Smith' }),
    ],
    card_dispute_lost: [D.lostNotice({ who: team, receiptNo: '1042', amount: '$450.00', day: 'Nov 8', owed: '$450.00' })],
    card_refund_failed: [refundFailedNotice({ amount: '$150.00', bank: false, card: 'Visa •••• 4242', bankLast4: null, whose: team, sent: true })],
    card_refund_still_enrolled: [LW.enrolled({ amount: '$150.00', to: 'Visa •••• 4242', day: 'Nov 8', childFirst: 'Henry', owing: '$150.00' })],
    online_payment_not_recorded: [notRecordedNotice({ amount: '$150.00', bank: false, day: 'Nov 8', payer: 'Pat Doe', forWhat: 'Henry Doe', reason: 'the registration isn’t accepted', team: false })],
    online_payment_over: [OW.notice({ amount: '$450.00', receiptNo: '1042', day: 'Nov 8', extra: '$50.00', bank: false, whole: false })],
    team_money_sent: [CLUB_MONEY_NOTICE.sent({ teamName: 'Ridge 12U', amount: 216, what: 'Winter dome, 2 of 4', sentOn: '2026-11-08', how: 'E-Transfer 4471' })],
    club_bill_arrived: [SCHEDULE_NOTICES.bill({ orgName: 'Riverdale', teamName: 'Ridge 12U', cents: 86_400, scheduleName: 'Winter dome', first: { installmentNumber: 1, amount: 216, dueDate: '2026-11-15' } as never, payments: 4 })],
    club_schedule_review: [SCHEDULE_NOTICES.review({ orgName: 'Riverdale', scheduleName: 'Winter dome', teamName: 'Ridge 12U', slots: 8, billCents: 86_400, replyBy: '2026-11-20' })],
    club_payment_not_received: [FAMILY_HANDOFF_COACH_WORDS.admin({ team: 'Ridge 12U', child: 'Henry', amount: '$150.00', method: 'E-Transfer', receivedDay: 'Nov 8' })],
    club_hand_back_asked: [
      H.bellAsked({ teamName: 'Ridge 12U', count: 4, cents: 43_200, scheduleName: 'Winter dome', first: '2026-11-08', last: '2026-11-29' }),
      H.bellAskedLate({ teamName: 'Ridge 12U', count: 4, cents: null, scheduleName: 'Winter dome', first: '2026-11-08', last: '2026-11-29' }),
    ],
    club_hand_back_unasked: [H.bellUnasked({ name: 'Riley Chen', count: 4, scheduleName: 'Winter dome', first: '2026-11-08', cents: 43_200 })],
  };
  it('every row label is a shared word, at most 11 characters; every notice round-trips; every one line is one line', () => {
    for (const [kind, list] of Object.entries(notices)) {
      for (const n of list) {
        for (const r of n.facts.rows) assert.ok(VOCAB.has(r.label), `${kind}: "${r.label}" is not in the shared vocabulary`);
        assert.deepEqual(readNoticeFacts(JSON.parse(JSON.stringify({ facts: n.facts }))), n.facts, kind);
        assert.doesNotMatch(n.body, /\n/, kind);
      }
    }
  });
  it('the bank debit returned reads as drawn (tab 2), with and without an email on file', () => {
    const [kid, teamNoEmail] = notices.debit_returned;
    assert.equal(kid.body, '$450.00 didn’t go through on Nov 8. Nothing was taken.');
    assert.deepEqual(kid.facts.rows.map(r => [r.label, r.value]), [
      ['Amount', '$450.00'], ['Account', 'Ending 6789'], ['Returned', 'Nov 8'], ['Reason', 'There wasn’t enough money in the account'],
      ['Spot', 'Still held'], ['Told', 'Emailed a way to pay'],
    ]);
    assert.equal(kid.facts.next, undefined);
    // No bank reason, no row; a team's place; no email on file, and the next step says to tell them.
    assert.deepEqual(teamNoEmail.facts.rows.map(r => r.label), ['Amount', 'Returned', 'Place', 'Told']);
    assert.equal(teamNoEmail.facts.next, 'Tell the team yourself.');
  });
  it('the dispute reads as drawn (tab 3): the answerer’s deadline is a row; the desk’s copy says who answers', () => {
    const [answerer, deskInquiry] = notices.card_disputed;
    assert.equal(answerer.body, 'Receipt 1042, $450.00. Answer in Stripe by Nov 20 at 11:59 p.m.');
    assert.deepEqual(answerer.facts.rows.map(r => r.label), ['Amount', 'Paid by', 'Reason', 'Held', 'Answer by']);
    assert.equal(answerer.facts.rows.find(r => r.label === 'Held')?.value, 'From the club’s Stripe balance, until the bank decides', 'the same figure is not written twice');
    assert.equal(answerer.facts.next, 'Answer it in Stripe.');
    assert.deepEqual(deskInquiry.facts.rows.map(r => r.label), ['Amount', 'Paid by', 'Who answers', 'Answer by']);
    assert.equal(deskInquiry.body, 'Receipt 1042, $450.00. Pat Smith answers it in Stripe by Nov 20.');
  });
  it('a refund that didn’t reach: one entry, titles keep team / child, came back vs couldn’t be sent (Q6)', () => {
    const family = refundFailedNotice({ amount: '$150.00', bank: true, card: null, bankLast4: '6789', whose: { child: 'Henry Doe' }, sent: false });
    assert.equal(family.title, 'Henry Doe’s refund didn’t reach the bank account');
    assert.equal(family.body, '$150.00 to the account ending 6789 couldn’t be sent.');
    assert.deepEqual(family.facts.rows.map(r => [r.label, r.value]), [
      ['Amount', '$150.00'], ['Sent to', 'The account ending 6789'], ['For', 'Henry Doe’s family'], ['Reason', 'It couldn’t be sent'],
    ]);
    const teamCard = notices.card_refund_failed[0] as ReturnType<typeof refundFailedNotice>;
    assert.equal(teamCard.title, 'Ridge 12U’s refund didn’t reach the card');
    assert.equal(teamCard.body, '$150.00 to Visa •••• 4242 came back.');
    assert.equal(teamCard.facts.next, 'Send the money another way, then record the refund.');
  });
  it('a club notice that can email keeps the one fact its email needs in the one line (Stage 2 review)', () => {
    const notReceived = FAMILY_HANDOFF_COACH_WORDS.admin({ team: 'Ridge 12U', child: 'Henry', amount: '$150.00', method: 'E-Transfer', receivedDay: 'Nov 8' });
    assert.match(notReceived.body, /e-transfer, Nov 8/, 'which payment: how, and the day');
    assert.equal(CLUB_MONEY_NOTICE.sent({ teamName: 'Ridge 12U', amount: 150, what: 'Winter dome', sentOn: '2026-11-08', how: 'E-Transfer' }).body.includes('E-Transfer'), true);
  });
  it('every sender of a kind passes facts to its one entry — no sender writes its own paragraph', () => {
    const landing = readCode('lib/online-payment-landing.ts');
    assert.equal((landing.match(/(?<![a-zA-Z])refundFailedNotice\(/g) ?? []).length, 3, 'send-back (A, B), a team refund (C, E), a child’s (D)');
    assert.equal((landing.match(/\.\.\.sponsorRefundFailedNotice\(/g) ?? []).length, 1, 'a sponsor’s card refund (Part 3b, its own words: the deal page has no “record it another way” door)');
    assert.equal((landing.match(/\.\.\.notRecordedNotice\(/g) ?? []).length, 4, 'four callers: the last is a sponsor’s card payment (Part 3b)');
    assert.doesNotMatch(landing, /refundFailedBody|notRecordedBody|unrecordedBody|unrecordedSignupBody|itemBody|lostBody|returnedBody|reversedBody|bodyTwice|bodyMore|enrolledBody/);
    assert.match(landing, /metadata: \{ \.\.\.p\.extra, \.\.\.\(p\.facts \? \{ facts: p\.facts \} : \{\}\), \[p\.subjectKey\]: p\.subjectId \}/);
    // B: a team's send-back states the send-back's own amount (the refund's, or the whole payment with the fee that goes back).
    assert.match(landing, /const fee = feeBack && op\.fee_payer === 'family' \? Number\(op\.fee_amount \?\? 0\) : 0;/);
    assert.match(landing, /notice\(refunded \?\? Number\(op\.base_amount\) \+ fee, \{ team: name \}\)/);
    // payments_ending: the bell gets the rows; the Payouts card keeps its paragraph.
    assert.match(readCode('lib/online-payment-owner-notices.ts'), /const notice = endingBell\(ending, org\.name, outstanding\);[\s\S]*?facts: notice\.facts/);
    assert.match(readCode('app/api/admin/payouts/route.ts'), /endingNotice\(/);
  });
});

describe('the six list notices (Stage 3): one wording per kind, rows from the shared vocabulary', () => {
  const VOCAB = new Set<string>(Object.values(FACT_LABELS));
  const bell = (over: Partial<Parameters<typeof coachBellWords>[0]['items'][number]>) => ({
    child: 'Maya', answer: 'attending' as const, prior: 'absent' as const, parent: 'Dana', hasNote: false,
    count: '11 of 14 in · 2 out · 1 maybe', eventLabel: 'Sat vs Lakeshore', eventDay: 'Sat, Nov 8', ...over,
  });
  const champs = (n: number) => Array.from({ length: n }, (_, i) => ({ division: `U${10 + i}`, champion: `Team ${i + 1}`, runnerUp: null }));
  const accepted = H.bellAnswered({ answer: 'accepted', late: false, scheduleName: 'Winter dome', count: 4, creditCents: 43_200, payCents: 10_800, teamName: 'Ridge 12U',
    moves: [{ dueDate: '2027-02-01', fromCents: 86_400, toCents: 43_200 }, { dueDate: '2026-12-01', fromCents: 43_200, toCents: 0 }] });
  const notices: Record<string, { body: string; facts?: NoticeFacts }[]> = {
    club_schedule_league_changes: [LEAGUE_ADMIN_NOTICE.notice({ scheduleName: 'Winter dome', divisions: ['U10', 'U12'], gameLines: ['U12 · Sun, Nov 15: Field 2 → Field 4'],
      ...NO_LEAGUE_COUNTS, moved: 3, gamesMoved: 8, gamesNeedDate: 1, gamesWaiting: 9 })],
    family_availability_response: [
      coachBellWords({ kind: 'event', items: [bell({}), bell({ child: 'Leo', answer: 'absent', prior: null, hasNote: true }), bell({ child: 'Sam', answer: 'maybe', prior: 'attending' })] }),
      coachBellWords({ kind: 'event', items: [bell({ answer: 'absent', prior: 'attending', hasNote: true })] }),
      coachBellWords({ kind: 'family', items: [bell({ answer: 'absent', prior: 'attending' }), bell({ answer: 'absent', prior: null, eventDay: 'Sat, Nov 15', hasNote: true })] }),
    ],
    coach_insights_digest: [formatInsightDigest([
      { tier: 'good-news', tone: 'good', report: 'results', text: 'Won 4 of your last 5.' },
      { tier: 'attendance', tone: 'warn', report: 'attendance', text: 'Maya Chen has made 5 of 9 tracked sessions this season.' },
    ])!],
    club_hand_back_answered: [
      accepted,
      H.bellAnswered({ answer: 'accepted', late: true, scheduleName: 'Winter dome', count: 4, creditCents: 0, payCents: 43_200, teamName: 'Ridge 12U', moves: [] }),
      H.bellAnswered({ answer: 'declined', late: false, scheduleName: 'Winter dome', count: 4, reason: 'We can’t re-sell those dates.' }),
      H.bellAnswered({ answer: 'declined', late: true, scheduleName: 'Winter dome', count: 1, reason: null }),
    ],
    card_refund_whose: [LW.whose({ children: ['Henry', 'Sam', 'Ella'], total: '$450.00', receiptNo: '1042' })],
    champions_crowned: [championsNotice(champs(3)), championsNotice(champs(8))],
  };
  it('every row label is a shared word, at most 11 characters; every notice round-trips; every one line is one line', () => {
    for (const [kind, list] of Object.entries(notices)) {
      for (const n of list) {
        assert.ok(n.facts, kind);
        for (const r of n.facts!.rows) assert.ok(VOCAB.has(r.label), `${kind}: "${r.label}" is not in the shared vocabulary`);
        assert.deepEqual(readNoticeFacts(JSON.parse(JSON.stringify({ facts: n.facts }))), n.facts, kind);
        assert.doesNotMatch(n.body, /\n/, kind);
      }
    }
  });
  it('a row that IS its list, and a list line with a bold part, round-trip; an empty row or an empty part never does', () => {
    const facts = noticeFacts([factRow('Answers', null, { list: { lines: [factLine('Maya', 'In', 'was Out'), 'plain'], noun: { one: 'answer', many: 'answers' } } })]);
    assert.deepEqual(facts.rows[0], { label: 'Answers', value: '', list: { lines: [{ text: 'Maya', lead: 'In', detail: 'was Out' }, 'plain'], noun: { one: 'answer', many: 'answers' } } });
    assert.deepEqual(readNoticeFacts(JSON.parse(JSON.stringify({ facts }))), facts);
    assert.deepEqual(factLine('Sat, Nov 15', 'Out', ''), { text: 'Sat, Nov 15', lead: 'Out' }, 'an empty part is left out');
    assert.equal(factLineText(factLine('Maya', 'In', 'was Out')), 'Maya · In · was Out');
    assert.deepEqual(factRow('Answers', null, { list: { lines: [], noun: NOUN } }), [], 'an empty list is no row');
    assert.deepEqual(factLine('', 'Ridge 12U'), { text: 'Ridge 12U' }, 'a line with no text leads with its bold part');
    const kept = capFactList(['Maya', '', factLine('', ''), factLine('U12', 'Ridge')], NOUN, n => `and ${n} more`);
    assert.deepEqual(kept.lines, ['Maya', { text: 'U12', lead: 'Ridge' }], 'a blank line is left out, so it never voids the rows');
    assert.ok(readNoticeFacts({ facts: noticeFacts([factRow('Answers', null, { list: kept })]) }), 'and the notice still reads back');
    for (const meta of [
      { facts: { rows: [{ label: 'Answers', value: '' }] } },
      { facts: { rows: [{ label: 'Answers', value: '', list: { lines: [], noun: NOUN } }] } },
      { facts: { rows: [{ label: 'Answers', value: ' ', list: { lines: ['a'], noun: NOUN } }] } },
      { facts: { rows: [{ label: 'Answers', value: '', list: { lines: [{ text: 'Maya', lead: '' }], noun: NOUN } }] } },
      { facts: { rows: [{ label: 'Answers', value: '', list: { lines: [{ lead: 'In' }], noun: NOUN } }] } },
    ]) assert.equal(readNoticeFacts(meta), null, JSON.stringify(meta));
  });
  it('moved games read as drawn (tab 4): counts are rows, the games a list under Games, the waiting games the next step', () => {
    const [n] = notices.club_schedule_league_changes;
    assert.equal(n.body, 'U10 and U12: 3 practices moved, 8 games moved and 1 game needs a new date.');
    assert.deepEqual(n.facts!.rows.map(r => [r.label, r.value]), [['Schedule', 'Winter dome'], ['Divisions', 'U10 and U12'], ['Practices', '3 moved'], ['Games', '8 moved']]);
    assert.equal(n.facts!.rows[3].detail, '1 needs a new date');
    assert.equal(n.facts!.next, '9 games wait in Changes to send. Families are told when you send them.');
  });
  it('family answers read as drawn (tab 5): one child per line and Now; a single change; one family across events', () => {
    const [several, single, family] = notices.family_availability_response;
    assert.equal(several.body, 'Maya (In), Leo (Out) and Sam (Maybe) · now 11 of 14 in · 2 out · 1 maybe', 'three or fewer: today’s line');
    assert.deepEqual(several.facts!.rows[0].list!.lines, [
      { text: 'Maya', lead: 'In', detail: 'was Out' }, { text: 'Leo', lead: 'Out', detail: 'Dana left a note' }, { text: 'Sam', lead: 'Maybe', detail: 'was In' },
    ]);
    assert.deepEqual(several.facts!.rows.map(r => [r.label, r.value, r.detail]), [['Answers', '', undefined], ['Now', '11 of 14 in', '2 out · 1 maybe']]);
    assert.deepEqual(single.facts!.rows.map(r => [r.label, r.value, r.detail]), [['Answer', 'Out', 'was In'], ['Answered by', 'Dana', 'left a note'], ['Now', '11 of 14 in', '2 out · 1 maybe']]);
    assert.equal(family.body, 'Sat, Nov 8 · Sat, Nov 15');
    assert.deepEqual(family.facts!.rows.map(r => r.label), ['Events', 'Answered by']);
    assert.deepEqual(family.facts!.rows[0].list!.lines, [{ text: 'Sat, Nov 8', lead: 'Out', detail: 'was In' }, { text: 'Sat, Nov 15', lead: 'Out' }]);
    // More than three: the line names three and counts the rest; the rows keep every child.
    const seven = coachBellWords({ kind: 'event', items: ['Maya', 'Leo', 'Sam', 'Ava', 'Ben', 'Cal', 'Dee'].map(child => bell({ child })) });
    assert.equal(seven.body, 'Maya, Leo, Sam and 4 more · now 11 of 14 in');
    assert.equal(seven.facts.rows[0].list!.lines.length, 7);
    // Never the note's words: the bell has no note to read.
    assert.doesNotMatch(JSON.stringify(notices.family_availability_response), /note’s|said:/);
  });
  it('a family answer folded into an unread notice re-writes its rows with the title and body', () => {
    const src = readCode('lib/family-availability-coach-bell.ts');
    assert.match(src, /const words = coachBellWords\(merged\.bundle\);[\s\S]*?title: words\.title, body: words\.body,[\s\S]*?metadata: \{ teamId: params\.teamId, eventId: item\.eventId, bundle: merged\.bundle, facts: words\.facts \}/);
    assert.match(src, /const words = coachBellWords\(freshBundle\);[\s\S]*?metadata: \{ teamId: params\.teamId, eventId: item\.eventId, bundle: freshBundle, facts: words\.facts \}/);
  });
  it('weekly insights: the line leads with the first finding and counts the rest; the rows are the same findings (ruling 2026-11-15)', () => {
    const [n] = notices.coach_insights_digest;
    assert.equal(n.body, 'Won 4 of your last 5 · 1 more this week.');
    assert.deepEqual(n.facts!.rows[0].list!.lines, ['Won 4 of your last 5.', '⚠ Maya Chen has made 5 of 9 tracked sessions this season.']);
    // Each coach's own findings: the rows are built in the same call as the body, from the findings computed for that coach.
    assert.match(readCode('lib/insights-digest.ts'), /const digest = formatInsightDigest\(findings\);[\s\S]*?body: digest\.body,[\s\S]*?facts: digest\.facts/);
  });
  it('hand-back answered: one entry for four builds; one line per payment that dropped; a declined reason is quoted, never shortened', () => {
    assert.equal(accepted.body, 'Winter dome: 4 practices handed back. $432.00 came off what Ridge 12U owes. The club owes Ridge 12U $108.00 and will record paying it.');
    assert.deepEqual(accepted.facts.rows.map(r => [r.label, r.value]), [['Schedule', 'Winter dome'], ['Practices', '4 handed back'], ['Came off', '$432.00'], ['Club owes', '$108.00']]);
    assert.deepEqual(accepted.facts.rows[2].list!.lines, ['Dec 1 · $432.00 → $0.00', 'Feb 1 · $864.00 → $432.00'], 'in date order');
    const [, late, declined, declinedLate] = notices.club_hand_back_answered;
    assert.equal(late.facts!.rows.find(r => r.label === 'Came off'), undefined, 'no credit, no row');
    assert.equal(declined.body, 'Winter dome: the 4 practices stay yours. “We can’t re-sell those dates.”', 'the reason stays in the line (owner 2026-11-15)');
    assert.deepEqual(declined.facts!.rows.map(r => [r.label, r.value, r.detail]), [['Schedule', 'Winter dome', undefined], ['Practices', '4', 'stay yours'], ['Reason', '“We can’t re-sell those dates.”', undefined]]);
    assert.deepEqual(declinedLate.facts!.rows.map(r => [r.label, r.detail]), [['Schedule', undefined], ['Practices', 'stays handed back']], 'no reason, no row');
    const long = 'x'.repeat(480) + ' — and we told you in September.';
    const d = H.bellAnswered({ answer: 'declined', late: false, scheduleName: 'W', count: 2, reason: long });
    assert.equal(d.facts.rows.find(r => r.label === 'Reason')!.value, `“${long}”`);
    assert.ok(d.body.endsWith(`“${long}”`));
    const src = readCode('lib/club-hand-back.ts');
    assert.equal((src.match(/W\.bellAnswered\(/g) ?? []).length, 2);
    assert.doesNotMatch(src + readCode('lib/club-hand-back-words.ts'), /bellAcceptedLate|bellDeclinedLate|bellAccepted\b|bellDeclined\b/);
    assert.match(readCode('lib/club-money-notify.ts'), /export async function tellTeamMoneyPeople[\s\S]*?\.\.\.\(p\.facts \? \{ facts: p\.facts \} : \{\}\)/);
  });
  it('a refund whose: the children are the list to choose among; the payment and the book are rows; the choice is the next step', () => {
    const [n] = notices.card_refund_whose;
    assert.equal(n.body, 'It paid for Henry, Sam and Ella, so we can’t tell whose fee it was.');
    assert.deepEqual(n.facts!.rows.map(r => [r.label, r.value, r.detail]), [['Paid for', '', undefined], ['Payment', '$450.00', 'receipt 1042'], ['Book', 'Not in the season’s book until you choose', undefined]]);
    assert.deepEqual(n.facts!.rows[0].list!.lines, ['Henry', 'Sam', 'Ella']);
    assert.equal(n.facts!.next, 'Choose the child, and it goes on that registration.');
    assert.match(readCode('lib/online-payment-landing.ts'), /eventType: 'card_refund_whose'[\s\S]*?\.\.\.LW\.whose\(\{ children: regRows\.map/);
  });
  it('champions: up to three named with their division, more counted; one line per champion; no champion, no rows', () => {
    const [three, eight] = notices.champions_crowned;
    assert.equal(three.body, 'Team 1 won U10, Team 2 won U11 and Team 3 won U12.');
    assert.equal(eight.body, '8 divisions have their champions — see the final results.');
    assert.deepEqual(three.facts!.rows[0].list!.lines[0], { text: 'U10', lead: 'Team 1' });
    assert.equal(championsNotice(champs(1)).body, 'Team 1 won U10.');
    assert.deepEqual(championsNotice([]), { body: 'The playoffs are complete — see the final results.' });
    const src = readCode('lib/champions-notify.ts');
    assert.match(src, /const notice = championsNotice\(champs\);[\s\S]*?body: notice\.body,[\s\S]*?metadata: \{ facts: notice\.facts \}/);
    assert.match(src, /notifyFansForChampions\(tournamentId, headline\)/, 'the fans’ push keeps its own line');
  });
  it('every sender of the six passes facts to its one entry', () => {
    assert.match(readCode('lib/club-schedule-send.ts'), /const notice = LEAGUE_ADMIN_NOTICE\.notice\([\s\S]*?body: notice\.body,[\s\S]*?metadata: \{ seasonId, sendId, facts: notice\.facts \}/);
    assert.doesNotMatch(readCode('lib/club-schedule-league-words.ts'), /\\n\\n/, 'the one line never carries the game lines');
  });
});

describe('the six few-facts notices (Stage 4): one wording per kind, rows from the shared vocabulary (owner Q1–Q8, 2026-11-15)', () => {
  const VOCAB = new Set<string>(Object.values(FACT_LABELS));
  const kid = (firstName: string, status: string) => ({ firstName, lastName: 'Kim', status });
  const plan = (myLabels: string[], arriveLabel: string | null = '5:45 p.m.') => practicePlanSentMessage({ dayLabel: 'Tuesday', startLabel: '6:00 p.m.', arriveLabel, myLabels });
  const carried = { players: 14, budgetPlan: true, feePlan: true, openingBalance: false };
  const started = (over: Partial<Parameters<typeof clubSeasonNotice>[0]> = {}) =>
    clubSeasonNotice({ clubName: 'Northfield', teamName: 'Ridge 12U', action: 'started', seasonName: '2027 Season', previousSeasonName: '2026 Season', carried, ...over });
  const NOTE = 'Ava broke her wrist — we’ll be back in the fall.';
  const notices: Record<string, { body: string; facts?: NoticeFacts }[]> = {
    house_league_registration_new: [
      signupNotice([kid('Henry', 'active'), kid('Ava', 'waitlisted'), kid('Sam', 'pending_review')], 'Grace Kim', 'Summer 2027'),
      signupNotice([kid('Henry', 'active')], 'Grace Kim', 'Summer 2027', 'entered'),
      signupNotice([kid('Henry', 'declined')], ' ', 'Summer 2027', 'entered'),
    ],
    house_league_withdraw_request: [
      ASK_WORDS.notice('Ava Kim', 'Grace Kim', 'Summer 2027', NOTE),
      ASK_WORDS.notice('Ava Kim', 'Grace Kim', 'Summer 2027', null),
      ASK_WORDS.notice('Ava Kim', ' ', 'Summer 2027', '   '),
    ],
    assistant_coach_approval_requested: [
      staffApprovalNotice({ email: 'Pat.Lee+coach@Example.com', teamName: 'Ridge 12U', invitedByName: 'Sam Lee', staffKind: 'assistant' }),
      staffApprovalNotice({ email: 'pat@example.com', teamName: 'Ridge 12U', invitedByName: null, staffKind: 'treasurer', changed: true }),
    ],
    practice_plan_sent: [plan(['Close control', 'Footwork ladder']), plan(['A', 'B', 'C', 'D', 'E']), plan([], null), plan(['', 'Rondo'])],
    club_season_changed: [started(), started({ previousSeasonName: null, carried: null, tryoutsOpen: true })],
  };
  it('every row label is a shared word, at most 11 characters; every notice round-trips; every one line is one line', () => {
    for (const label of Object.values(FACT_LABELS)) assert.ok(label.length <= FACT_LABEL_MAX, label);
    for (const [kind, list] of Object.entries(notices)) {
      for (const n of list) {
        assert.ok(n.facts?.rows.length, kind);
        for (const r of n.facts!.rows) assert.ok(VOCAB.has(r.label), `${kind}: "${r.label}" is not in the shared vocabulary`);
        assert.deepEqual(readNoticeFacts(JSON.parse(JSON.stringify({ facts: n.facts }))), n.facts, `${kind}: ${n.body}`);
        assert.doesNotMatch(n.body, /\n/, kind);
      }
    }
  });
  it('a new registration: one wording for the sign-up and the hand-entered one; one line per child with the outcome (Q3)', () => {
    const [signup, admin, blank] = notices.house_league_registration_new;
    assert.equal(signup.body, 'Grace Kim · Summer 2027 · 1 approved, 1 to review, 1 on the waitlist');
    assert.deepEqual(signup.facts!.rows.map(r => [r.label, r.value]), [['Season', 'Summer 2027'], ['Family', 'Grace Kim'], ['Players', '']]);
    assert.deepEqual(signup.facts!.rows[2].list!.lines, [
      { text: 'Henry Kim', lead: 'Approved' }, { text: 'Ava Kim', lead: 'On the waitlist' }, { text: 'Sam Kim', lead: 'To review' },
    ]);
    assert.equal((admin as ReturnType<typeof signupNotice>).title, 'New registration: Henry Kim', 'the title keeps its word: staff entered it');
    assert.equal(admin.body, 'Grace Kim · Summer 2027 · 1 approved', 'the hand-entered body gains the guardian and the outcome (ruling 5)');
    assert.equal(blank.body, 'Summer 2027', 'no guardian, no outcome word: nothing invented');
    assert.deepEqual(blank.facts!.rows.map(r => r.label), ['Season', 'Players']);
    assert.deepEqual(blank.facts!.rows[1].list!.lines, [{ text: 'Henry Kim' }]);
  });
  it('a withdrawal request: the line never carries the family’s words; the note is quoted in full, “No note” when none (Q4)', () => {
    const [said, none, blank] = notices.house_league_withdraw_request;
    assert.equal(said.body, 'Grace Kim · Summer 2027 · Note attached');
    assert.ok(!said.body.includes('wrist'));
    assert.deepEqual(said.facts!.rows.map(r => [r.label, r.value]), [['Family', 'Grace Kim'], ['Season', 'Summer 2027'], ['Note', `“${NOTE}”`]]);
    assert.equal(none.body, 'Grace Kim · Summer 2027 · No note');
    assert.equal(none.facts!.rows[2].value, 'No note');
    assert.equal(blank.body, 'Summer 2027 · No note');
    assert.deepEqual(blank.facts!.rows.map(r => r.label), ['Season', 'Note']);
    const long = 'x'.repeat(299) + '!';
    const n = ASK_WORDS.notice('Ava Kim', 'Grace Kim', 'Summer 2027', long);
    assert.equal(n.facts.rows[2].value, `“${long}”`, 'never shortened');
    assert.ok(!n.body.includes('x'));
  });
  it('an assistant-coach approval: who invited whom, to which team, as what; the address exactly as typed (Q5)', () => {
    const [asked, changed] = notices.assistant_coach_approval_requested;
    assert.equal(asked.body, 'Sam Lee invited Pat.Lee+coach@Example.com to Ridge 12U as an assistant coach.');
    assert.deepEqual(asked.facts!.rows.map(r => [r.label, r.value, r.lead, r.detail]), [
      ['Invited by', 'Sam Lee', undefined, undefined], ['Invited', 'Pat.Lee+coach@Example.com', undefined, undefined], ['Team', 'Ridge 12U', undefined, undefined],
      ['Role', 'Assistant coach', true, 'Coaches the team. Starts with the everyday tools; you choose the rest.'],
    ]);
    assert.equal(changed.body, 'A head coach changed what pat@example.com will get on Ridge 12U: now the team treasurer.');
    assert.equal(changed.facts!.rows.find(r => r.label === 'Invited by'), undefined, 'an unknown inviter has no row');
  });
  it('a practice plan: three stations named, the rest counted; the stations a list; no stations, no list row (Q6)', () => {
    const [two, five, none, blank] = notices.practice_plan_sent;
    assert.equal(two.body, 'You’re on Close control and Footwork ladder. Arrive by 5:45 p.m. for 6:00 p.m.', 'three or fewer: today’s line');
    assert.equal(five.body, 'You’re on A, B, C and 2 more. Arrive by 5:45 p.m. for 6:00 p.m.');
    assert.deepEqual(five.facts!.rows.map(r => [r.label, r.value]), [['You’re on', ''], ['Arrive by', '5:45 p.m.'], ['Starts', '6:00 p.m.']]);
    assert.equal(five.facts!.rows[0].list!.lines.length, 5);
    assert.equal(none.body, 'Read it before 6:00 p.m.');
    assert.deepEqual(none.facts!.rows.map(r => r.label), ['Starts']);
    assert.equal(blank.body, 'You’re on Rondo. Arrive by 5:45 p.m. for 6:00 p.m.', 'a blank label is left out of the line and the list');
    const forty = plan(Array.from({ length: 40 }, (_, i) => `Station ${i + 1}`));
    assert.equal(forty.facts.rows[0].list!.lines.length, FACT_LIST_MAX);
    assert.equal(forty.facts.rows[0].list!.overflow, 'and 10 more on the plan');
  });
  it('a season started: the team and what came; Came with · Tryouts · Last season; a first season with tryouts open says so (Q7, Q8)', () => {
    const [rolled, first] = notices.club_season_changed;
    assert.equal(rolled.body, 'Ridge 12U · Came with the team: 14 players, the budget and the fee plan.');
    assert.deepEqual(rolled.facts!.rows.map(r => [r.label, r.value, r.detail]), [['Came with', '', undefined], ['Tryouts', 'Closed until you open them', undefined], ['Last season', '2026 Season', 'kept as a record']]);
    assert.deepEqual(rolled.facts!.rows[0].list!.lines, ['14 players', 'The budget', 'The fee plan'], 'only what actually carried');
    assert.equal(first.body, 'Ridge 12U · Tryouts are open.');
    assert.deepEqual(first.facts!.rows.map(r => [r.label, r.value]), [['Tryouts', 'Open']]);
    assert.equal(clubSeasonStartedCard({ clubName: 'N', seasonName: '2027 Season', tryoutsOpen: true }).body, 'Tryouts are open.', 'the Overview card tells the truth too');
    assert.equal(clubSeasonNotice({ clubName: 'N', teamName: 'T', action: 'closed', seasonName: '2026 Season' }).facts, undefined, 'closed and reopened keep their sentence');
    assert.equal(clubSeasonNotice({ clubName: 'N', teamName: 'T', action: 'reopened', seasonName: '2026 Season' }).facts, undefined);
  });
  it('every sender of the six passes facts to its one entry; the registration reaches the desk only (Q2); the moved game keeps its sentence (Q1)', () => {
    const signup = readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');
    assert.match(signup, /const n = signupNotice\(children,[\s\S]*?const userIds = await houseLeagueDeskUserIds\(org\);[\s\S]*?metadata: \{ facts: n\.facts \},\s*userIds,/);
    const admin = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts');
    assert.match(admin, /const notice = signupNotice\(\[[\s\S]*?'entered'\);\s*houseLeagueDeskUserIds\(ctx!\.org\)\s*\.then\(ids => ids\.filter\(id => id !== ctx!\.user\.id\)\)[\s\S]*?metadata: \{ facts: notice\.facts \},\s*userIds,/);
    for (const src of [signup, admin]) assert.equal((src.match(/eventType: 'house_league_registration_new'/g) ?? []).length, 1);
    assert.match(readCode('app/api/league/[orgSlug]/[seasonSlug]/withdraw-request/route.ts'),
      /const notice = ASK_WORDS\.notice\([\s\S]*?body: notice\.body,[\s\S]*?metadata: \{ registrationId: reg\.id, seasonId: season\.id, facts: notice\.facts \}/);
    assert.match(readCode('lib/assistant-invites.ts'), /const notice = staffApprovalNotice\(p\);[\s\S]*?body: notice\.body,[\s\S]*?metadata: \{ inviteId: p\.inviteId, facts: notice\.facts \}/);
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/practice-plan/send/route.ts'),
      /const \{ title, body: text, facts \} = practicePlanSentMessage\([\s\S]*?metadata: \{ teamId, eventId, audience, sentBy: ctx\.user\.id, facts \}/);
    assert.match(readCode('lib/club-season-notify.ts'), /const \{ title, body, facts \} = clubSeasonNotice\([\s\S]*?metadata: \{ teamId: p\.team\.id, action: p\.action, \.\.\.\(facts \? \{ facts \} : \{\}\) \}/);
    assert.match(readCode('app/api/admin/rep-teams/teams/[teamId]/program-years/route.ts'), /action: 'started', seasonName: programYear\.name,\s*tryoutsOpen: programYear\.tryoutOpen,/);
    assert.doesNotMatch(readCode('lib/family-notify.ts'), /facts/, 'Q1: a moved game keeps its sentence, like “A game changed”');
  });
});

describe('“Score submitted” (Stage 5): the game, the score, its state and who entered it (owner Q1–Q6, 2026-11-15)', () => {
  const VOCAB = new Set<string>(Object.values(FACT_LABELS));
  const game = { away: 'Hawks', home: 'Ridge 12U', division: 'U13' };
  const score = (awayScore: number, homeScore: number) => ({ kind: 'score' as const, awayScore, homeScore });
  const notices = [
    scoreNotice({ game, result: score(4, 6), held: false, enteredBy: 'kim@example.com' }),
    scoreNotice({ game, result: score(4, 6), held: true, enteredBy: 'kim@example.com' }),
    scoreNotice({ game, result: { kind: 'forfeit', winner: 'home' }, held: true, enteredBy: 'kim@example.com' }),
    scoreNotice({ game, result: { kind: 'forfeit', winner: 'away' }, held: false, enteredBy: 'kim@example.com' }),
    scoreNotice({ game, result: score(5, 6), held: false, enteredBy: 'kim@example.com', was: score(4, 6) }),
    scoreNotice({ game, result: score(3, 0), held: false, enteredBy: 'kim@example.com', was: { kind: 'forfeit', winner: 'home' } }),
    // Every blank part: no names, no division, no address — the rows still open.
    scoreNotice({ game: { away: ' ', home: '', division: ' ' }, result: score(0, 0), held: false, enteredBy: '  ' }),
    scoreNotice({ game: { away: '', home: '', division: null }, result: score(1, 2), held: true, enteredBy: null, was: score(2, 2) }),
    scoreNotice({ game: { away: 'Semifinal 1 winner', home: 'Hawks' }, result: score(5, 3), held: false, enteredBy: 'kim@example.com' }),
  ];
  it('every row label is a shared word; every notice round-trips; every one line is one line', () => {
    for (const n of notices) {
      assert.ok(n.facts.rows.length, n.body);
      for (const r of n.facts.rows) assert.ok(VOCAB.has(r.label), `"${r.label}" is not in the shared vocabulary`);
      assert.deepEqual(readNoticeFacts(JSON.parse(JSON.stringify({ facts: n.facts }))), n.facts, n.body);
      assert.doesNotMatch(n.body, /\n/);
      assert.ok(n.body.trim().length);
    }
  });
  it('a score: visitors first, its state, who entered it; Game · Score · Status · Entered by (Q1, Q2)', () => {
    const [final, held] = notices;
    assert.equal(final.title, 'Score submitted');
    assert.equal(final.body, 'Hawks 4, Ridge 12U 6 · Final · entered by kim@example.com');
    assert.deepEqual(final.facts.rows.map(r => [r.label, r.value, r.lead, r.detail]), [
      ['Game', 'Hawks vs Ridge 12U', undefined, 'U13'], ['Score', 'Hawks 4, Ridge 12U 6', true, undefined],
      ['Status', 'Final', undefined, undefined], ['Entered by', 'kim@example.com', undefined, undefined],
    ]);
    assert.equal(held.body, 'Hawks 4, Ridge 12U 6 · Waiting for approval · entered by kim@example.com', 'a held score never reads as final');
    assert.equal(held.facts.rows.find(r => r.label === 'Status')!.value, 'Waiting for approval');
    assert.equal(notices[8].body, 'Semifinal 1 winner 5, Hawks 3 · Final · entered by kim@example.com', 'a bracket slot in the bracket’s words');
  });
  it('a forfeit names the teams, never the stored 1–0; its titles are unchanged (Q3)', () => {
    const [, , held, final] = notices;
    assert.equal(held.title, 'Forfeit pending approval');
    assert.equal(held.body, 'Ridge 12U wins by forfeit vs Hawks · Waiting for approval · entered by kim@example.com');
    assert.equal(held.facts.rows.find(r => r.label === 'Score')!.value, 'Ridge 12U by forfeit');
    assert.equal(final.title, 'Game forfeited');
    assert.equal(final.body, 'Hawks wins by forfeit vs Ridge 12U · Final · entered by kim@example.com');
    for (const n of [held, final]) assert.doesNotMatch(n.body + JSON.stringify(n.facts), /\b1\b|\b0\b|home team|away team/);
  });
  it('a correction of a final result says so and keeps the old one in a Was row (Q4)', () => {
    const [, , , , corrected, overForfeit] = notices;
    assert.equal(corrected.body, 'Hawks 5, Ridge 12U 6 · Final · corrected by kim@example.com');
    assert.deepEqual(corrected.facts.rows.map(r => r.label), ['Game', 'Score', 'Was', 'Status', 'Entered by']);
    assert.equal(corrected.facts.rows[2].value, 'Hawks 4, Ridge 12U 6');
    assert.equal(overForfeit.facts.rows[2].value, 'Ridge 12U by forfeit');
    assert.equal(notices[0].facts.rows.find(r => r.label === 'Was'), undefined, 'a first entry has no Was row');
  });
  it('a blank part never voids the rows and nothing is invented', () => {
    const [, , , , , , blank, blankHeld] = notices;
    assert.equal(blank.body, 'TBD 0, TBD 0 · Final');
    assert.deepEqual(blank.facts.rows.map(r => r.label), ['Game', 'Score', 'Status'], 'no address, no Entered by row');
    assert.equal(blank.facts.rows[0].detail, undefined, 'no division, no detail');
    assert.equal(blankHeld.body, 'TBD 1, TBD 2 · Waiting for approval · corrected');
  });
  it('only a FINAL result stands to be corrected: completed or forfeit; a held one, an unplayed game and a half-written score have none (Q4)', () => {
    assert.deepEqual(standingResult({ status: 'completed', homeScore: 6, awayScore: 4 }), { kind: 'score', awayScore: 4, homeScore: 6 });
    assert.deepEqual(standingResult({ status: 'completed', homeScore: 0, awayScore: 0 }), { kind: 'score', awayScore: 0, homeScore: 0 }, 'a 0–0 is a result');
    assert.deepEqual(standingResult({ status: 'forfeit', homeScore: 0, awayScore: 1, source: 'forfeit' }), { kind: 'forfeit', winner: 'away' });
    assert.deepEqual(standingResult({ status: 'forfeit', homeScore: 1, awayScore: 0 }), { kind: 'forfeit', winner: 'home' });
    for (const status of ['submitted', 'scheduled', 'cancelled', 'in_progress']) {
      assert.equal(standingResult({ status, homeScore: 1, awayScore: 0, source: 'forfeit' }), null, `${status} has no standing result (a pending forfeit is not final)`);
    }
    assert.equal(standingResult({ status: 'completed', homeScore: null, awayScore: 3 }), null);
    assert.equal(standingResult({ status: 'completed', homeScore: 3, awayScore: null }), null);
  });
  it('the settings line says what sends it, and the server reads the standing result through the pure function', () => {
    assert.match(readCode('lib/notification-labels.ts'), /score_submitted:\s+'A game result is entered, or a forfeit is marked\.'/);
    assert.match(readCode('lib/score-notice-server.ts'), /standing: standingResult\(\{ status: g\.status, homeScore: g\.home_score, awayScore: g\.away_score, source: g\.score_submission_source \}\)/);
  });
  it('every sender of “Score submitted” passes facts through the one entry; it reaches Results’ people, never the whole club (Q5, Q6)', () => {
    const keeper = readCode('app/api/scorekeeper/[orgSlug]/score/route.ts');
    const admin = readCode('app/api/admin/games/route.ts');
    assert.equal((keeper.match(/sendScoreNotice\(\{/g) ?? []).length, 1);
    assert.equal((admin.match(/sendScoreNotice\(\{/g) ?? []).length, 2, 'the score entry and the forfeit');
    for (const src of [keeper, admin]) {
      assert.doesNotMatch(src, /eventType: 'score_submitted'/, 'no sender writes its own words');
      // The standing result is read BEFORE the save, so a correction can say what it replaced.
      for (const m of src.matchAll(/const before = await readScoreNoticeGame\(/g)) {
        assert.match(src.slice(m.index!), /^const before = await readScoreNoticeGame\([^)]*\);\s*const (?:result|\{ (?:pending|status) \}) = await submit(?:TournamentScore|Forfeit)\(/);
      }
      assert.equal((src.match(/readScoreNoticeGame\(/g) ?? []).length, (src.match(/sendScoreNotice\(\{/g) ?? []).length);
    }
    assert.match(admin, /const \{ status \} = await submitTournamentScore\([\s\S]*?held: status === 'submitted'/, 'the Results entry keeps whether it was held');
    const server = readCode('lib/score-notice-server.ts');
    assert.match(server, /const userIds = \(await resultsUserIds\(p\.org, p\.tournamentId\)\)\.filter\(id => id !== p\.actor\.id\);\s*if \(!userIds\.length\) return;/,
      'never an empty list (it would reach every member), never the person who entered it');
    assert.match(server, /eventType: 'score_submitted',[\s\S]*?metadata: \{ facts: notice\.facts \},\s*userIds,/);
    const recipients = readCode('lib/notify-recipients.ts');
    assert.match(recipients, /export async function resultsUserIds[\s\S]*?tournamentMembersWho\(org\.id, tournamentId, m => canScore\(m\.role, m\.capabilities\) && !volunteerShut\(org\.planId, m\.role\)\)/);
    // The three tournament-scoped lists share ONE member read (and its staff scoping), so none can drift from the others.
    assert.equal((recipients.match(/from\('organization_members'\)\.select\('id, user_id, role, capabilities'\)/g) ?? []).length, 1);
    assert.match(recipients, /async function tournamentMembersWho[\s\S]*?\.filter\(m => m\.user_id && keep\(m\)\), tournamentId\)/);
  });
});

describe('the message block', () => {
  const src = readCode('components/notifications/NotificationMessage.tsx');
  it('draws any kind’s stored facts; the settled line replaces the next step (Q2)', () => {
    assert.match(src, /readNoticeFacts\(lead\.metadata\)/);
    assert.match(src, /<FactRows facts=\{facts\} settled=\{!!settled\} \/>/);
    assert.match(src, /\{facts\.next && !settled && <p className=\{styles\.factNext\}>/);
  });
  it('a row that IS its list draws the list as its answer; a line’s bold part is the row’s bold face (Stage 3, drawing tab 5)', () => {
    assert.ok(src.includes('{r.value && (\n              <dd>'), 'a row with no answer of its own draws no empty answer');
    assert.ok(src.includes('<FactListLines list={r.list} only={!r.value} />'));
    assert.ok(src.includes(`const Wrap = only ? 'dd' : 'div';`), 'the list is the row’s answer');
    assert.ok(src.includes('<span className={styles.factLead}>{l.lead}</span>'));
    const css = readCode('components/notifications/NotificationMessage.module.css');
    assert.ok(css.includes('.factLines .factLead { color: var(--text-primary); }'));
  });
  it('a bundle opens as its members’ one-line bodies, never rows', () => {
    assert.match(src, /const facts = entry\.kind !== 'item' \? null/);
  });
  it('the phone sheet pins its buttons only when the message outgrows it (Q9), on the frame’s pinned-foot convention', () => {
    const reader = readCode('components/notifications/NotificationReader.tsx');
    assert.match(reader, /pinActions=\{isPhoneNav && pinned\}/);
    assert.match(reader, /setOutgrows\(sheet\.scrollHeight > sheet\.clientHeight \+ 1\)/);
    assert.match(src, /data-sheet-foot=\{pinActions \? '' : undefined\}/);
  });
});
