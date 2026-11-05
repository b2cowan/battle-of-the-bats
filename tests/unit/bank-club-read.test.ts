import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateCheck, payoutTickMarks, type BankAccountState, type BankMark } from '../../lib/bank-check.ts';
import {
  accountOfPayout, assembleAccount, checkRecords, entryToBankLine, keysNamed, liveClubAccounts, marksOf, nameGap,
  payoutFloor, payoutsForBank, placeBooks, savedOf, stampsOf,
  type BankAccountRow, type ClubBook, type EntryRow, type PayoutRowLike,
} from '../../lib/bank-club-map.ts';
import { mapPayoutLines, type BtIn, type OurIndex } from '../../lib/online-payouts-map.ts';
import { readCode } from './_source-code.ts';

/**
 * Bank reconciliation R2a — THE CLUB'S READER (lib/bank-club-map.ts, the pure half of lib/bank-club-read.ts) and the
 * Payouts mapping it extends (lib/online-payouts-map.ts). Fixtures only, no network: a moved book, a transfer pair, a
 * payout with every member kind, an open dispute, a failed Stripe read, and a line old enough to need the by-id read.
 */

const acct = (id: string, created: string, over: Partial<BankAccountRow> = {}): BankAccountRow => ({
  id, name: id, owner_kind: 'club', created_at: created, archived_at: null, opening_date: '2026-08-31',
  opening_balance_cents: 500_000, set_up_at: created, ...over,
});
const book = (id: string, entityType = 'org'): ClubBook => ({ id, name: id, entityType, entityId: null });
const entry = (id: string, ledger: string, date: string, type: EntryRow['entry_type'], amount: number | string,
  over: Partial<EntryRow> = {}): EntryRow => ({
  id, ledger_id: ledger, entry_date: date, description: id, amount, entry_type: type, status: 'posted', linked_entry_id: null, ...over,
});
const noPayouts = payoutsForBank([]);

describe('accounts and books (rule 1)', () => {
  const rows = [
    acct('team-moved-in', '2025-01-01', { owner_kind: 'team' }),
    acct('gaming', '2026-09-02'),
    acct('chequing', '2026-09-01'),
    acct('old-archived', '2024-01-01', { archived_at: '2026-01-01' }),
  ];
  it('the first account is the oldest live CLUB account, never an older team account or an archived one', () => {
    assert.equal(liveClubAccounts(rows)[0]?.id, 'chequing');
  });
  it('a book with no move row belongs to the first account; a moved book to its account', () => {
    const placed = placeBooks(rows, [book('general'), book('casino'), book('hl', 'league_season')],
      [{ ledger_id: 'casino', bank_account_id: 'gaming' }]);
    assert.deepEqual(Object.fromEntries(placed.accountOfBook), { general: 'chequing', casino: 'gaming', hl: 'chequing' });
    assert.deepEqual(placed.booksOf.get('gaming')!.map(b => b.id), ['casino']);
    assert.deepEqual(placed.unplaced, []);
  });
  it('a move row naming an account that is not live falls back to the first account', () => {
    const placed = placeBooks(rows, [book('casino')], [{ ledger_id: 'casino', bank_account_id: 'old-archived' }]);
    assert.equal(placed.accountOfBook.get('casino'), 'chequing');
  });
  it('a club with no account at all: every book is unplaced (C1, "never done this")', () => {
    const placed = placeBooks([acct('t', '2025-01-01', { owner_kind: 'team' })], [book('general')], []);
    assert.deepEqual(placed.unplaced.map(b => b.id), ['general']);
    assert.equal(placed.accountOfBook.size, 0);
  });
});

describe('book lines', () => {
  it('direction from entry_type, dollars to cents, the description as the label', () => {
    const l = entryToBankLine(entry('e1', 'g', '2026-09-03', 'expense', '12.34'), new Map());
    assert.deepEqual([l.key, l.direction, l.amountCents, l.label, l.transferPairKey], ['entry:e1', 'out', 1234, 'e1', null]);
    assert.equal(entryToBankLine(entry('e2', 'g', '2026-09-03', 'income', 0.1), new Map()).amountCents, 10);
  });
  it('a transfer half names its other half; a payout member names its payout', () => {
    const l = entryToBankLine(entry('t-out', 'g', '2026-09-05', 'transfer_out', 100, { linked_entry_id: 't-in' }), new Map([['t-out', 'payout:po_1']]));
    assert.deepEqual([l.transferPairKey, l.payoutKey], ['entry:t-in', 'payout:po_1']);
  });
});

/** One account, set up Aug 31 with $5,000.00, with the given lines and one open check ending Sep 30. */
function stateWith(over: Partial<BankAccountState>): BankAccountState {
  return {
    setup: { openingDate: '2026-08-31', openingBalanceCents: 500_000 },
    lines: [], payouts: [], checks: [{ id: 'sep', statementEndDate: '2026-09-30', statementEndingBalanceCents: 500_000, status: 'open' }],
    marks: [], ...over,
  };
}

describe('a transfer pair', () => {
  it('both halves in this account never reached the bank: left out automatically', () => {
    const { lines } = assembleAccount({
      accountId: 'chequing', firstAccountId: 'chequing', ownBooks: new Set(['general', 'tourney']),
      accountOfBook: new Map([['general', 'chequing'], ['tourney', 'chequing']]),
      rows: [
        entry('a', 'general', '2026-09-05', 'transfer_out', 250, { linked_entry_id: 'b' }),
        entry('b', 'tourney', '2026-09-05', 'transfer_in', 250, { linked_entry_id: 'a' }),
      ],
      marks: [], bank: noPayouts, payoutsTickedElsewhere: new Set(),
    });
    const ev = evaluateCheck(stateWith({ lines }), 'sep');
    assert.deepEqual(ev.autoExcluded.map(x => [x.row.key, x.reason]), [['entry:a', 'same_account_transfer'], ['entry:b', 'same_account_transfer']]);
    assert.equal(ev.outstanding.length, 0);
  });
  it('a transfer to a book in ANOTHER account is real money leaving: outstanding', () => {
    const { lines } = assembleAccount({
      accountId: 'chequing', firstAccountId: 'chequing', ownBooks: new Set(['general']),
      accountOfBook: new Map([['general', 'chequing'], ['casino', 'gaming']]),
      rows: [entry('a', 'general', '2026-09-05', 'transfer_out', 250, { linked_entry_id: 'b' })],
      marks: [], bank: noPayouts, payoutsTickedElsewhere: new Set(),
    });
    const ev = evaluateCheck(stateWith({ lines }), 'sep');
    assert.deepEqual(ev.outstanding.map(r => r.key), ['entry:a']);
  });
});

describe('a moved book (Ask 13)', () => {
  // The casino book moved from Club chequing to Gaming. Line c1 was ticked on chequing before the move; c2 was not
  // (chequing's September statement listed it as outstanding).
  const rows = [
    entry('c1', 'casino', '2026-09-10', 'income', 400),
    entry('c2', 'casino', '2026-09-12', 'income', 300),
    entry('g1', 'general', '2026-10-02', 'expense', 50),
  ];
  const accountOfBook = new Map([['general', 'chequing'], ['casino', 'gaming']]);
  const chequingMarks: BankMark[] = [{ key: 'entry:c1', checkId: 'sep', date: '2026-09-10', direction: 'in', amountCents: 40_000 }];

  it('on the OLD account: the ticked line stays; the unticked one moved away with its book', () => {
    const r = assembleAccount({
      accountId: 'chequing', firstAccountId: 'chequing', ownBooks: new Set(['general']), accountOfBook, rows,
      marks: chequingMarks, bank: noPayouts, payoutsTickedElsewhere: new Set(),
    });
    assert.deepEqual(r.lines.map(l => l.key).sort(), ['entry:c1', 'entry:g1']);
    assert.deepEqual(r.movedAway, ['entry:c2']);
    // Claimed elsewhere, the saved copy on September's list no longer lists it here either.
    const state = stateWith({
      lines: r.lines, marks: chequingMarks, claimedElsewhere: r.movedAway,
      checks: [
        { id: 'sep', statementEndDate: '2026-09-30', statementEndingBalanceCents: 540_000, status: 'checked',
          outstandingSnapshot: [{ key: 'entry:c2', date: '2026-09-12', direction: 'in', amountCents: 30_000 }] },
        { id: 'oct', statementEndDate: '2026-10-31', statementEndingBalanceCents: 535_000, status: 'open' },
      ],
    });
    assert.deepEqual(evaluateCheck(state, 'oct').outstanding.map(x => x.key), ['entry:g1']);
  });
  it('on the NEW account: the unticked line is outstanding; the one ticked on chequing is claimed elsewhere', () => {
    const r = assembleAccount({
      accountId: 'gaming', firstAccountId: 'chequing', ownBooks: new Set(['casino']), accountOfBook, rows: rows.slice(0, 2),
      marks: [], bank: noPayouts, payoutsTickedElsewhere: new Set(),
    });
    const ev = evaluateCheck(stateWith({ lines: r.lines, claimedElsewhere: ['entry:c1'] }), 'sep');
    assert.deepEqual(ev.outstanding.map(x => x.key), ['entry:c2']);
  });
});

describe('a line old enough to need the by-id read', () => {
  it('every key a mark, a checked list, an opening item, the carried list, an added line or a change names is read by id', () => {
    const checks = checkRecords([
      { id: 'sep', statement_end_date: '2026-09-30', statement_ending_balance_cents: '500000', status: 'checked',
        outstanding_snapshot: [{ key: 'entry:snap', date: '2026-09-20', direction: 'out', amountCents: 100 }] },
      { id: 'oct', statement_end_date: '2026-10-31', statement_ending_balance_cents: 1, status: 'open',
        outstanding_snapshot: [{ key: 'entry:stale', date: '2026-09-20', direction: 'out', amountCents: 100 }] },
    ], [{ check_id: 'oct', line_key: 'entry:fee' }]);
    const { openingItems, carried } = savedOf([
      { kind: 'opening_picked', line_key: 'entry:cheque', line_date: '2026-08-20', direction: 'out', amount_cents: 7_500, description: 'Cheque 214' },
      { kind: 'opening_typed', line_key: 'typed:abc', line_date: '2026-08-29', direction: 'in', amount_cents: 2_000, description: 'Deposit' },
      { kind: 'carried', line_key: 'entry:carry', line_date: '2026-09-01', direction: 'in', amount_cents: 1, description: null },
    ]);
    const marks = marksOf([{ check_id: 'sep', line_key: 'entry:ticked', line_date: '2026-09-02', direction: 'in', amount_cents: '900', payout_key: null }]);
    const stamps = stampsOf([
      { check_id: 'sep', line_key: 'entry:changed', removed: false, changed_by: null, changed_at: '2026-10-05T00:00:00Z', cleared_at: null },
      { check_id: 'sep', line_key: 'entry:cleared', removed: false, changed_by: null, changed_at: '2026-10-04T00:00:00Z', cleared_at: '2026-10-06T00:00:00Z' },
    ]);
    const keys = keysNamed({ marks, checks, openingItems, carried, stamps });
    assert.deepEqual(keys.sort(), ['entry:carry', 'entry:changed', 'entry:cheque', 'entry:fee', 'entry:snap', 'entry:ticked', 'typed:abc']);
    // An open statement's stale snapshot (gotcha 6) is not read; a cleared change is not open.
    assert.equal(checks[1].outstandingSnapshot, null);
    assert.equal(stamps.length, 1);
    assert.deepEqual([checks[0].statementEndingBalanceCents, checks[1].addedLineKeys], [500_000, ['entry:fee']]);
    assert.deepEqual(openingItems.map(o => [o.key, o.kind]), [['entry:cheque', 'picked'], ['typed:abc', 'typed']]);
    assert.equal(marks[0].amountCents, 900);
  });
  it('Stripe is read from the last CHECKED statement’s end (the line read starts at the account’s starting date)', () => {
    const checks = checkRecords([
      { id: 'a', statement_end_date: '2026-09-30', statement_ending_balance_cents: 1, status: 'checked', outstanding_snapshot: [] },
      { id: 'b', statement_end_date: '2026-10-31', statement_ending_balance_cents: 1, status: 'open', outstanding_snapshot: null },
    ], []);
    assert.equal(payoutFloor('2026-08-31', checks), '2026-09-30');
    assert.equal(payoutFloor('2026-08-31', []), '2026-08-31');
  });
  it('a cheque written before the starting date, read by id, is outstanding on the first check (Ask 3)', () => {
    const { lines } = assembleAccount({
      accountId: 'chequing', firstAccountId: 'chequing', ownBooks: new Set(['general']), accountOfBook: new Map([['general', 'chequing']]),
      rows: [entry('cheque', 'general', '2026-08-20', 'expense', 75)], marks: [], bank: noPayouts, payoutsTickedElsewhere: new Set(),
    });
    const ev = evaluateCheck(stateWith({
      lines, openingItems: [{ key: 'entry:cheque', date: '2026-08-20', direction: 'out', amountCents: 7_500, kind: 'picked' }],
    }), 'sep');
    assert.deepEqual(ev.outstanding.map(r => r.key), ['entry:cheque']);
  });
});

// ── A payout with every member kind, through the Payouts mapping with the bank check's entry index ────────────────
const bt = (over: Partial<BtIn> & Pick<BtIn, 'id' | 'type'>): BtIn =>
  ({ reportingCategory: null, net: 0, created: 1_791_000_000, sourceId: null, sourceCharge: null, ...over });
const OURS: OurIndex = {
  payments: [
    { id: 'p-league', chargeId: 'ch_league', paymentIntentId: null, disputeId: null, receiptNo: 1, rail: 'card', who: 'Grant', what: 'House league' },
    { id: 'p-team', chargeId: 'ch_team', paymentIntentId: null, disputeId: null, receiptNo: 2, rail: 'card', who: 'Rockets', what: 'Fall Classic balance' },
    { id: 'p-debit', chargeId: 'py_debit', paymentIntentId: null, disputeId: 'du_bank', receiptNo: 3, rail: 'bank_debit', who: 'Singh', what: 'House league' },
    { id: 'p-lost', chargeId: 'ch_lost', paymentIntentId: null, disputeId: null, receiptNo: 4, rail: 'card', who: 'Chen', what: 'House league' },
    { id: 'p-open', chargeId: 'ch_open', paymentIntentId: null, disputeId: null, receiptNo: 5, rail: 'card', who: 'Park', what: 'House league' },
  ],
  refunds: { re_ours: 'p-team' },
  disputes: { du_lost: 'p-lost', du_won: 'p-lost', du_open: 'p-open' },
  entries: {
    payments: { 'p-league': ['e-hl-1', 'e-hl-2'], 'p-team': ['e-team', 'e-cost'] },
    refunds: { re_ours: ['e-refund', 'e-refund-fee'] },
    reversals: { 'p-debit': ['e-returned'] },
    disputes: {
      du_lost: { amountCents: 15_000, feeCents: 1_500, lostEntryIds: ['e-lost'], wonEntryIds: [] },
      du_won: { amountCents: 15_000, feeCents: 1_500, lostEntryIds: ['e-lost-2'], wonEntryIds: ['e-won'] },
      du_open: { amountCents: 15_675, feeCents: 1_500, lostEntryIds: [], wonEntryIds: [] },
    },
  },
};
const LINES = mapPayoutLines([
  bt({ id: 't0', type: 'payout', net: -1 }),
  bt({ id: 't1', type: 'charge', net: 30_000, sourceId: 'ch_league' }),
  bt({ id: 't2', type: 'charge', net: 14_325, sourceId: 'ch_team' }),
  bt({ id: 't3', type: 'refund', net: -5_000, sourceId: 're_ours' }),
  bt({ id: 't4', type: 'adjustment', reportingCategory: 'dispute', net: -5_000, sourceId: 'du_bank' }),
  bt({ id: 't5', type: 'adjustment', reportingCategory: 'dispute', net: -16_500, sourceId: 'du_lost' }),
  bt({ id: 't6', type: 'adjustment', reportingCategory: 'dispute_reversal', net: 16_500, sourceId: 'du_won' }),
  bt({ id: 't7', type: 'adjustment', reportingCategory: 'dispute', net: -17_175, sourceId: 'du_open' }),
  bt({ id: 't8', type: 'stripe_fee', net: -500 }),
  bt({ id: 't9', type: 'charge', net: 4_500, sourceId: 'ch_elsewhere' }),
], OURS);
const by = (id: string) => LINES.find(l => l.id === id)!;

describe('the Payouts mapping carries the book lines (bank check only)', () => {
  it('a payment: each child’s receipt, or the team receipt and the club-pays processing cost', () => {
    assert.deepEqual(by('t1').entryIds, ['e-hl-1', 'e-hl-2']);
    assert.deepEqual(by('t2').entryIds, ['e-team', 'e-cost']);
  });
  it('a refund: its line and the fee paid back', () => assert.deepEqual(by('t3').entryIds, ['e-refund', 'e-refund-fee']));
  it('a bank debit reversed after it landed: the lines its reversal booked', () => assert.deepEqual(by('t4').entryIds, ['e-returned']));
  it('a card dispute lost, and won after the loss, with our stored figures', () => {
    assert.deepEqual([by('t5').entryIds, by('t5').dispute], [['e-lost'], { id: 'du_lost', amountCents: 15_000, feeCents: 1_500 }]);
    assert.deepEqual(by('t6').entryIds, ['e-won']);
  });
  it('an open dispute has no book line yet; a Stripe fee and a stranger’s charge never have one', () => {
    assert.deepEqual([by('t7').entryIds, by('t8').entryIds, by('t9').entryIds, by('t9').kind], [[], [], [], 'not_ours']);
  });
  it('the Payouts tab’s read (no entry index) is unchanged: no entryIds, no dispute', () => {
    const plain = mapPayoutLines([bt({ id: 'x', type: 'charge', net: 100, sourceId: 'ch_team' })], { ...OURS, entries: undefined });
    assert.equal('entryIds' in plain[0], false);
    assert.equal('dispute' in plain[0], false);
  });
});

describe('payouts for the bank check', () => {
  const row = (id: string, arrives: string, amount: number, over: Partial<PayoutRowLike> = {}): PayoutRowLike =>
    ({ id, arrives, status: 'paid', contents: 'listed', amount, lines: [], ...over });

  it('only automatic payouts Stripe finished matching, that did not fail, are passed', () => {
    const read = payoutsForBank([
      row('po_ok', '2026-09-14', 100), row('po_manual', '2026-09-14', 1, { contents: 'manual' }),
      row('po_matching', '2026-09-14', 1, { contents: 'matching' }), row('po_failed', '2026-09-14', 1, { status: 'failed' }),
      row('po_way', '2026-10-03', 5, { status: 'on_its_way' }),
    ]);
    assert.deepEqual(read.payouts.map(p => [p.key, p.amountCents]), [['payout:po_ok', 10_000], ['payout:po_way', 500]]);
  });
  it('every member kind rides the payout; an entry belongs to one payout only', () => {
    const read = payoutsForBank([row('po_1', '2026-09-14', 1_281.75, { lines: LINES }), row('po_2', '2026-09-20', 300, { lines: [by('t1')] })]);
    assert.deepEqual(read.membersOf.get('payout:po_1'),
      ['e-hl-1', 'e-hl-2', 'e-team', 'e-cost', 'e-refund', 'e-refund-fee', 'e-returned', 'e-lost', 'e-won']);
    assert.deepEqual(read.membersOf.get('payout:po_2'), []);
    assert.equal(read.payoutOf.get('e-hl-1'), 'payout:po_1');
  });
  it('the gap is named by its reason: an open dispute from our stored figures, Stripe activity not ours', () => {
    const f = payoutsForBank([row('po_1', '2026-09-14', 0, { lines: LINES })]).facts['payout:po_1'];
    assert.deepEqual(f.disputesHeld, [{ disputeId: 'du_open', amountCents: 15_675, feeCents: 1_500 }]);
    assert.equal(f.disputeHeldCents, -17_175);
    assert.equal(f.notOursCents, 4_500);
    assert.equal(f.disputeReturnedCents, 0);
    assert.equal(f.stripeFeeCents, -500);
  });
  it('a gap an open dispute explains is NOT offered as payment processing (P4); a remainder that is money out is', () => {
    const f = payoutsForBank([row('po_1', '2026-09-14', 0, { lines: [by('t7')] })]).facts['payout:po_1'];
    assert.deepEqual(nameGap(-17_175, f), { disputeHeldCents: -17_175, disputeReturnedCents: 0, notOursCents: 0, stripeFeeCents: 0, otherCents: 0, offerPaymentProcessing: false, processingCents: 0 });
    assert.deepEqual([nameGap(-17_675, f).offerPaymentProcessing, nameGap(-17_675, f).processingCents], [true, 500]);
    assert.equal(nameGap(500, f).offerPaymentProcessing, false);
  });
  it('a Stripe fee no book line records is named as one, and offered as payment processing (it is one)', () => {
    const f = payoutsForBank([row('po_f', '2026-09-14', 0, { lines: [by('t8')] })]).facts['payout:po_f'];
    assert.deepEqual(nameGap(-500, f), { disputeHeldCents: 0, disputeReturnedCents: 0, notOursCents: 0, stripeFeeCents: -500, otherCents: 0, offerPaymentProcessing: true, processingCents: 500 });
  });
  it('a dispute won before any loss was booked: money back that no book line records, named', () => {
    const won = mapPayoutLines([bt({ id: 'w', type: 'adjustment', reportingCategory: 'dispute_reversal', net: 17_175, sourceId: 'du_open' })], OURS);
    const f = payoutsForBank([row('po_w', '2026-10-01', 171.75, { lines: won })]).facts['payout:po_w'];
    assert.deepEqual(nameGap(17_175, f), { disputeHeldCents: 0, disputeReturnedCents: 17_175, notOursCents: 0, stripeFeeCents: 0, otherCents: 0, offerPaymentProcessing: false, processingCents: 0 });
  });
});

describe('which account a payout belongs to', () => {
  const accountOfBook = new Map([['general', 'chequing'], ['hl', 'chequing'], ['casino', 'gaming']]);
  const ledgerOf = new Map([['a', 'general'], ['b', 'casino'], ['c', 'casino']]);
  it('the account its book lines sit in; the first account when it holds any of them', () => {
    assert.equal(accountOfPayout({ members: ['b', 'c'], ledgerOf, accountOfBook, firstAccountId: 'chequing' }), 'gaming');
    assert.equal(accountOfPayout({ members: ['a', 'b', 'c'], ledgerOf, accountOfBook, firstAccountId: 'chequing' }), 'chequing');
  });
  it('none of its lines in a club book: the first account', () => {
    assert.equal(accountOfPayout({ members: [], ledgerOf, accountOfBook, firstAccountId: 'chequing' }), 'chequing');
  });
  it('a payout ticked on an account stays there, whatever its lines say; one ticked elsewhere is not passed here', () => {
    const bank = payoutsForBank([{ id: 'po_x', arrives: '2026-09-14', status: 'paid', contents: 'listed', amount: 100,
      lines: [{ id: 'l', kind: 'payment', at: '2026-09-10T00:00:00Z', who: null, what: 'x', receiptNo: null, amount: 100, entryIds: ['b'] }] }]);
    const input = { firstAccountId: 'chequing', ownBooks: new Set(['general']), accountOfBook,
      rows: [entry('b', 'casino', '2026-09-10', 'income', 100)], bank };
    const mark: BankMark = { key: 'payout:po_x', checkId: 'sep', date: '2026-09-14', direction: 'in', amountCents: 10_000 };
    const mk = (accountId: string, marks: BankMark[], elsewhere: string[]) =>
      assembleAccount({ ...input, accountId, marks, payoutsTickedElsewhere: new Set(elsewhere) }).payouts.map(p => p.key);
    assert.deepEqual(mk('gaming', [], []), ['payout:po_x']);                 // its line sits in gaming's book
    assert.deepEqual(mk('chequing', [mark], []), ['payout:po_x']);           // ticked here: stays here
    assert.deepEqual(mk('gaming', [], ['payout:po_x']), []);                 // ticked on another account: not here
  });
});

describe('end to end through the engine: a payout ticks its members, and a failed Stripe read falls back', () => {
  const rows = [
    entry('e-hl-1', 'hl', '2026-09-08', 'income', 150), entry('e-hl-2', 'hl', '2026-09-08', 'income', 150),
    entry('e-team', 'tourney', '2026-09-09', 'income', 150), entry('e-cost', 'tourney', '2026-09-09', 'expense', 6.75),
    entry('e-cash', 'general', '2026-09-15', 'income', 40),
  ];
  const ownBooks = new Set(['hl', 'tourney', 'general']);
  const accountOfBook = new Map([['hl', 'chequing'], ['tourney', 'chequing'], ['general', 'chequing']]);
  const lines = [by('t1'), by('t2')];
  const deposit = 300 + 143.25;

  it('Stripe answered: one payout row, its book side = the deposit, a $0.00 Difference once ticked', () => {
    const bank = payoutsForBank([{ id: 'po_1', arrives: '2026-09-14', status: 'paid', contents: 'listed', amount: deposit, lines }]);
    const r = assembleAccount({ accountId: 'chequing', firstAccountId: 'chequing', ownBooks, accountOfBook, rows, marks: [], bank, payoutsTickedElsewhere: new Set() });
    const base = stateWith({ lines: r.lines, payouts: r.payouts,
      checks: [{ id: 'sep', statementEndDate: '2026-09-30', statementEndingBalanceCents: 500_000 + 44_325, status: 'open' }] });
    const marks = payoutTickMarks(base, 'sep', 'payout:po_1');
    assert.equal(marks.length, 5);
    const ev = evaluateCheck({ ...base, marks }, 'sep');
    assert.deepEqual([ev.differenceCents, ev.payoutGapCents, ev.outstanding.map(x => x.key)], [0, 0, ['entry:e-cash']]);
  });
  it('Stripe did not answer: no payouts passed, members read as ordinary lines, a ticked member stays ticked', () => {
    const r = assembleAccount({ accountId: 'chequing', firstAccountId: 'chequing', ownBooks, accountOfBook, rows, marks: [], bank: noPayouts, payoutsTickedElsewhere: new Set() });
    assert.equal(r.payouts.length, 0);
    assert.ok(r.lines.every(l => !l.payoutKey));
    const marks: BankMark[] = [{ key: 'entry:e-hl-1', checkId: 'sep', date: '2026-09-08', direction: 'in', amountCents: 15_000, payoutKey: 'payout:po_1' }];
    const ev = evaluateCheck(stateWith({ lines: r.lines, marks }), 'sep');
    assert.deepEqual(ev.ticked.map(x => x.key), ['entry:e-hl-1']);
    assert.deepEqual(ev.outstanding.map(x => x.key), ['entry:e-hl-2', 'entry:e-cost', 'entry:e-team', 'entry:e-cash']);
  });
});

describe('the reader reads no year and writes nothing (B3, B10, rule 6)', () => {
  const src = readCode('lib/bank-club-read.ts') + readCode('lib/bank-club-map.ts');
  it('no fiscal year, season or program year anywhere', () => {
    assert.doesNotMatch(src, /fiscal|program_year|programYear|season_id|seasonId|searchParams/i);
  });
  it('no write: select only', () => assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\(/));
  it('the first account is filtered to club accounts (rule 1)', () => assert.match(src, /\.eq\('owner_kind', 'club'\)/));
  it('Stripe is read through the Payouts reader, never a second one', () => {
    assert.match(src, /readPayouts\(/);
    assert.doesNotMatch(src, /stripe-connect|listPayoutsPage|balanceTransactions/);
  });
});
