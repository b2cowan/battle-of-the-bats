import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { figureCheck, suspectsSince } from '../../lib/bank-check.ts';
import {
  bookIdsOf, clubBooksOnDate, entryToBankLine, liveClubAccounts, onItsWay, onItsWayFloor, placeBooks, savedChecksOf,
  type BankAccountRow, type CheckRow, type ClubBook, type EntryRow, type PayoutRowLike, type WaitingRow,
} from '../../lib/bank-club-map.ts';
import { mapPayoutLines, type BtIn, type OurIndex } from '../../lib/online-payouts-map.ts';
import { readCode } from './_source-code.ts';

/**
 * Bank balance check BC1 — THE CLUB'S READER (lib/bank-club-map.ts, the pure half of lib/bank-club-read.ts) and the
 * Payouts mapping it reads (lib/online-payouts-map.ts). Fixtures only, no network: the first account, a moved book, a
 * transfer pair, Stripe "on its way" (paid out by D, not yet, a manual payout, the 30 days), the saved checks and the
 * club's "Your books on D".
 */

const acct = (id: string, created: string, over: Partial<BankAccountRow> = {}): BankAccountRow => ({
  id, name: id, owner_kind: 'club', created_at: created, archived_at: null, ...over,
});
const book = (id: string, entityType = 'org'): ClubBook => ({ id, name: id, entityType, entityId: null });
const entry = (id: string, ledger: string, date: string, type: EntryRow['entry_type'], amount: number | string,
  over: Partial<EntryRow> = {}): EntryRow => ({
  id, ledger_id: ledger, entry_date: date, description: id, amount, entry_type: type, status: 'posted', linked_entry_id: null,
  payment_method: null, ...over,
});

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
  it('a club with no account at all: every book is unplaced ("never done this")', () => {
    const placed = placeBooks([acct('t', '2025-01-01', { owner_kind: 'team' })], [book('general')], []);
    assert.deepEqual(placed.unplaced.map(b => b.id), ['general']);
    assert.equal(placed.accountOfBook.size, 0);
  });
  it('the books a check counts are distinct and sorted, as the save step compares them', () => {
    assert.deepEqual(bookIdsOf([book('b'), book('a'), book('b')]), ['a', 'b']);
  });
});

describe('book lines', () => {
  it('direction from entry_type, dollars to cents, the description as the label', () => {
    const l = entryToBankLine(entry('e1', 'g', '2026-09-03', 'expense', '12.34'));
    assert.deepEqual([l.key, l.direction, l.amountCents, l.label, l.transferPairKey], ['entry:e1', 'out', 1234, 'e1', null]);
    assert.equal(entryToBankLine(entry('e2', 'g', '2026-09-03', 'income', 0.1)).amountCents, 10);
  });
  it('a transfer pair inside one account nets out of the suspects; a transfer to another account stays', () => {
    const lines = [
      entry('a', 'general', '2026-09-05', 'transfer_out', 250, { linked_entry_id: 'b' }),
      entry('b', 'tourney', '2026-09-05', 'transfer_in', 250, { linked_entry_id: 'a' }),
      entry('c', 'general', '2026-09-06', 'transfer_out', 90, { linked_entry_id: 'elsewhere' }),
    ].map(entryToBankLine);
    const s = suspectsSince({ lines, checks: [], date: '2026-09-30', startDate: '2026-08-31' });
    assert.deepEqual(s.lines.map(l => l.key), ['entry:c']);
  });
});

describe('Your books on D (P5, plan §4)', () => {
  it('the start\'s books + the movement after the start through D (through(D) − through(start))', () => {
    // Start Aug 31 at $5,000.00; the books moved +$400.00 all-time through Aug 31 and +$1,000.00 through Sep 30.
    assert.equal(clubBooksOnDate({ startBooksCents: 500_000, throughD: 100_000, throughStart: 40_000 }), 560_000);
  });
});

describe('saved checks', () => {
  const row = (id: string, date: string, over: Partial<CheckRow> = {}): CheckRow => ({
    id, bank_account_id: 'chequing', kind: 'check', statement_end_date: date, statement_ending_balance_cents: '100000',
    books_cents: '100000', on_its_way_cents: '0', cash_not_deposited_cents: null, book_ids: ['b', 'a'], created_by: 'u1',
    created_at: `${date}T12:00:00Z`, ...over,
  });
  const waiting = (check: string, key: string, over: Partial<WaitingRow> = {}): WaitingRow => ({
    check_id: check, line_key: key, line_date: '2026-09-28', label: null, amount_cents: '7500', direction: 'out', at_start: false, ...over,
  });
  it('oldest first, figures in cents, NULL on its way kept as not counted, items with their check, books sorted', () => {
    const checks = savedChecksOf([
      row('oct', '2026-10-31', { on_its_way_cents: null, cash_not_deposited_cents: '18000' }),
      row('start', '2026-08-31', { kind: 'start', book_ids: ['a'] }),
      row('sep', '2026-09-30'),
    ], [waiting('sep', 'entry:214'), waiting('start', 'entry:188', { at_start: true, label: 'Cheque #188' })]);
    assert.deepEqual(checks.map(c => c.id), ['start', 'sep', 'oct']);
    assert.equal(checks[2].onItsWayCents, null);
    assert.equal(checks[2].cashCents, 18000);
    assert.deepEqual(checks[1].bookIds, ['a', 'b']);
    assert.deepEqual(checks[1].waiting, [{ key: 'entry:214', date: '2026-09-28', direction: 'out', amountCents: 7500 }]);
    assert.deepEqual(checks[0].waiting[0], { key: 'entry:188', date: '2026-09-28', direction: 'out', amountCents: 7500, label: 'Cheque #188', atStart: true });
    // A saved check figures from its own saved figures: the September item adds back $75.00, so it reads Off by $75.00.
    assert.equal(figureCheck({ ...checks[1], waiting: checks[1].waiting }).offByCents, 7500);
  });
});

describe('Stripe on its way (ask 8, plan §4, O6)', () => {
  const D = '2026-10-31';
  const online = (id: string, date: string, type: EntryRow['entry_type'], amount: number, method = 'online_card') =>
    entry(id, 'general', date, type, amount, { payment_method: method });
  const payout = (id: string, arrives: string, entryIds: string[], over: Partial<PayoutRowLike> = {}): PayoutRowLike => ({
    id, arrives, status: 'paid', contents: 'listed',
    lines: [{ id: `l-${id}`, kind: 'payment', amount: 0, entryIds } as unknown as PayoutRowLike['lines'][number]], ...over,
  });

  it('the 30 days before D: a line landed more than 30 days back is taken as paid out', () => {
    assert.equal(onItsWayFloor(D), '2026-10-01');
    const r = onItsWay({ date: D, payouts: [], online: [online('old', '2026-10-01', 'income', 100), online('new', '2026-10-02', 'income', 200)] });
    assert.deepEqual(r.lines.map(l => l.key), ['entry:new']);
  });
  it('a line in a payout that arrived by D is in the bank; one arriving after D, or in none yet, is on its way (net)', () => {
    const r = onItsWay({
      date: D,
      online: [
        online('paid', '2026-10-20', 'income', 300), online('late', '2026-10-29', 'income', 412),
        online('fee', '2026-10-29', 'expense', 12), online('fresh', '2026-10-31', 'income', 12),
        // A line that isn't an online payment never counts here; nor one dated after D.
        entry('cash', 'general', '2026-10-30', 'income', 50), online('after', '2026-11-01', 'income', 99),
      ],
      payouts: [payout('po_1', '2026-10-22', ['paid']), payout('po_2', '2026-11-03', ['late', 'fee'])],
    });
    assert.equal(r.state, 'counted');
    assert.equal(r.cents, 41200 - 1200 + 1200);
    assert.deepEqual(r.lines.map(l => [l.key, l.paysOutOn]), [['entry:fresh', null], ['entry:fee', '2026-11-03'], ['entry:late', '2026-11-03']]);
    // Not every line is in a payout yet, so no single "pays them out" day.
    assert.equal(r.state === 'counted' && r.paysOutOn, null);
  });
  it('every line in a payout: "Stripe pays them out" the day the last one lands', () => {
    const r = onItsWay({ date: D, online: [online('late', '2026-10-29', 'income', 412)], payouts: [payout('po_2', '2026-11-03', ['late'])] });
    assert.equal(r.state === 'counted' && r.paysOutOn, '2026-11-03');
  });
  it('a FAILED payout put nothing in the bank: its lines are still on their way', () => {
    const r = onItsWay({ date: D, online: [online('x', '2026-10-20', 'income', 500)],
      payouts: [payout('po_f', '2026-10-22', ['x'], { status: 'failed' })] });
    assert.equal(r.cents, 50000);
  });
  it('a manual or still-matching payout arriving in the window makes the line NOT COUNTED (O6)', () => {
    for (const contents of ['manual', 'matching'] as const) {
      const r = onItsWay({ date: D, online: [online('x', '2026-10-20', 'income', 500)],
        payouts: [payout('po_m', '2026-10-25', [], { contents })] });
      assert.deepEqual([r.state, r.cents], ['not_counted', null], contents);
    }
    // …but one arriving after D doesn't (it can't have put anything in the bank by then).
    const after = onItsWay({ date: D, online: [online('x', '2026-10-20', 'income', 500)],
      payouts: [payout('po_m', '2026-11-04', [], { contents: 'manual' })] });
    assert.equal(after.state, 'counted');
  });
  it('a bank debit is a "bank" line, a card payment a "card" one', () => {
    const r = onItsWay({ date: D, payouts: [], online: [online('d', '2026-10-20', 'income', 1, 'online_bank'), online('c', '2026-10-21', 'income', 1)] });
    assert.deepEqual(r.lines.map(l => l.rail), ['card', 'bank']);
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

describe('the reader reads no year and writes nothing (rule 6)', () => {
  const src = readCode('lib/bank-club-read.ts') + readCode('lib/bank-club-map.ts');
  it('no fiscal year, season or program year anywhere', () => {
    assert.doesNotMatch(src, /fiscal|program_year|programYear|season_id|seasonId|searchParams/i);
  });
  it('no write: select and the one read-only function only', () => {
    assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\(/);
    assert.deepEqual([...src.matchAll(/\.rpc\('(\w+)'/g)].map(m => m[1]), ['bank_books_through']);
  });
  it('the first account is filtered to club accounts (rule 1); a deleted check is never read as live', () => {
    assert.match(src, /\.eq\('owner_kind', 'club'\)/);
    assert.match(src, /\.eq\('bank_accounts\.org_id', orgId\)\.eq\('bank_accounts\.owner_kind', 'club'\)\.is\('bank_accounts\.archived_at', null\)\s*\.is\('deleted_at', null\)/);
  });
  it('Stripe is read through the Payouts reader, never a second one; a failure is not counted, never a throw', () => {
    assert.match(src, /readPayouts\(/);
    assert.doesNotMatch(src, /stripe-connect|listPayoutsPage|balanceTransactions/);
    assert.match(src, /if \(payouts\.kind === 'unavailable'\) return \{ state: 'not_counted', reason: 'stripe_down', cents: null, lines: figured\.lines \};/);
  });
  it('"Books now say" re-figures each check over its OWN books (Q3, O1), grouped by book list', () => {
    assert.match(src, /const k = c\.bookIds\.join\(','\);/);
    assert.match(src, /await booksOnDates\(start, g\[0\]\.bookIds, g\.map\(c => c\.date\)\)/);
  });
});
