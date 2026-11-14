/**
 * Notifications read at a glance, Stage 2 — the shared stored-facts shape (plan
 * docs/projects/active/NOTIFICATION_MESSAGE_ROWS_PLAN.md; drawing tab 1; owner rulings Q1–Q3 and Q9, 2026-11-14).
 *
 *   · the shape round-trips through a notification's metadata; anything else reads as null (the notice keeps its paragraph)
 *   · every label in the shared vocabulary is at most 11 characters (Q1)
 *   · a list folds past 6 and keeps at most 30, the sender's closing line past that (Q3)
 *   · the reader drops the next step once the notice is settled (Q2), and pins the phone sheet's buttons only when it outgrows (Q9)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FACT_FOLD_WORDS, FACT_LABELS, FACT_LABEL_MAX, FACT_LIST_FOLD, FACT_LIST_MAX, capFactList, factRow, noticeFacts, readNoticeFacts,
} from '../../lib/notification-facts.ts';
import { readCode } from './_source-code.ts';
import {
  DEBIT_NOTICE_WORDS as DW, DISPUTE_WORDS as D, LEAGUE_ONLINE_NOTICE_WORDS as LW, OVER_WORDS as OW, notRecordedNotice, refundFailedNotice,
} from '../../lib/online-payment-words.ts';
import { CLUB_MONEY_NOTICE } from '../../lib/club-money-words.ts';
import { SCHEDULE_NOTICES } from '../../lib/club-schedule-words.ts';
import { FAMILY_HANDOFF_COACH_WORDS } from '../../lib/families-words.ts';
import { HAND_BACK_WORDS as H } from '../../lib/club-hand-back-words.ts';

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
      assert.match(label, /^[A-Z][a-z]*( [a-z]+)*$/, `"${label}" is sentence case`);
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
      ['Spot', 'Still held'], ['Family', 'Emailed a way to pay'],
    ]);
    assert.equal(kid.facts.next, undefined);
    // No bank reason, no row; a team's place; no email on file, and the next step says to tell them.
    assert.deepEqual(teamNoEmail.facts.rows.map(r => r.label), ['Amount', 'Returned', 'Place', 'Team']);
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
  it('every sender of a kind passes facts to its one entry — no sender writes its own paragraph', () => {
    const landing = readCode('lib/online-payment-landing.ts');
    assert.equal((landing.match(/refundFailedNotice\(/g) ?? []).length, 3, 'send-back (A, B), a team refund (C, E), a child’s (D)');
    assert.equal((landing.match(/\.\.\.notRecordedNotice\(/g) ?? []).length, 3);
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

describe('the message block', () => {
  const src = readCode('components/notifications/NotificationMessage.tsx');
  it('draws any kind’s stored facts; the settled line replaces the next step (Q2)', () => {
    assert.match(src, /readNoticeFacts\(lead\.metadata\)/);
    assert.match(src, /<FactRows facts=\{facts\} settled=\{!!settled\} \/>/);
    assert.match(src, /\{facts\.next && !settled && <p className=\{styles\.factNext\}>/);
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
