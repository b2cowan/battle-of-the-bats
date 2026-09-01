/**
 * THE STRIP'S OWN ROOT — which dollar is cash, in which month, in which direction.
 *
 * Same division of labour as `coach-expense-movements.test.ts`: `check:money-report` proves the
 * strip AGREES with the register month-by-month, but two surfaces agreeing on a wrong rule is
 * exactly what that script cannot see (both would apply it). Each inclusion/dating rule the strip
 * carries is pinned here individually, against the register's documented behaviour.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildActualCashStrip, type CashStripInputs } from '../../lib/coach-cash-strip.ts';
import { PAYOUT_CATEGORY_ID, PAYOUT_CATEGORY_NAME } from '../../lib/coach-budget-months.ts';

/**
 * A cash-out record's non-money half — the id, the words behind the figure and where it files.
 *
 * ⚠ THE PLACEMENT IS DELIBERATELY THE SAME ON EVERY FIXTURE ROW unless a test says otherwise. What
 * this module decides is WHICH record is cash, WHEN, and in WHICH DIRECTION; where it files is the
 * caller's answer, carried through unread. Varying it per row would make these tests look like they
 * were checking placement, which would be a lie about what is guarded.
 */
const outRec = (amount: number) => ({
  id: `rec-${amount}`,
  description: `Record ${amount}`,
  amount,
  place: { categoryId: 'cat-1', categoryName: 'Facilities', itemId: 'item-1' },
  // The word behind the id, for the "repaid Facilities / Dome time" line a refund's panel shows.
  itemName: 'Dome time',
});

/* ⚠ THE SUBJECT IS AS DELIBERATELY UNIFORM AS THE PLACEMENT ABOVE. What this module decides is
   which record is cash, when, and in which direction; WHO it came from is the caller's answer,
   carried through unread. A test that varies it says so on its own line. */
const duesPay = (amount: number, receivedDate: string | null) => ({
  id: `pay-${amount}`, amount, receivedDate,
  playerId: 'player-1', playerName: 'Maya Ledger', method: 'e-transfer',
});
const arrival = (amount: number, receivedDate: string | null, kind: 'income' | 'money_back') => ({
  id: `in-${amount}`, amount, receivedDate, kind,
  description: `Arrival ${amount}`, itemId: 'item-1', itemName: 'Gate takings', categoryName: 'Other',
});
const entry = (
  amountRaised: number, receivedDate: string | null, createdAt: string,
  kind: 'fundraiser' | 'sponsor',
) => ({
  id: `entry-${amountRaised}`, amountRaised, receivedDate, createdAt, kind,
  fundraiserId: kind === 'sponsor' ? 'sponsor-1' : 'drive-1',
  fundraiserName: kind === 'sponsor' ? 'Northside Physio' : 'Bottle drive',
  playerId: null, playerName: null, rebateAmount: 0,
});
const payoutRec = (id: string, amount: number, paidDate: string | null) => ({
  id, amount, paidDate,
  playerId: 'player-1', playerName: 'Maya Ledger', method: 'e-transfer', reason: null,
});

const empty = (): CashStripInputs => ({
  duesPayments: [],
  moneyInRecords: [],
  realisedEntries: [],
  clubRequests: [],
  expensePayments: [],
  duesPayouts: [],
  clubInstallments: [],
});

describe('buildActualCashStrip', () => {
  it('buckets every stream by the month the money moved, both directions, gross', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [
        duesPay(2400, '2025-09-04'),
        duesPay(1600, '2025-10-12'),
      ],
      moneyInRecords: [
        // Both kinds are cash in — money back is netted by the REPORT, never by cash.
        arrival(200, '2025-10-20', 'money_back'),
      ],
      realisedEntries: [
        entry(640, '2025-10-18', '2025-11-01T14:00:00Z', 'fundraiser'),
      ],
      clubRequests: [
        { ...outRec(180), side: 'reimbursement' as const, reviewedAt: '2025-11-05T15:00:00Z', createdAt: '2025-11-01T15:00:00Z' },
        { ...outRec(95), side: 'cost' as const, reviewedAt: '2025-11-06T15:00:00Z', createdAt: '2025-11-02T15:00:00Z' },
      ],
      expensePayments: [
        { ...outRec(1200), paidDate: '2025-09-10', familyPaidDirect: false },
      ],
      duesPayouts: [payoutRec('payout-150', 150, '2025-11-14')],
      clubInstallments: [{ ...outRec(300), paidAt: '2025-09-20T18:00:00Z' }],
    });

    assert.deepEqual(strip.in, {
      '2025-09': 2400,
      '2025-10': 1600 + 200 + 640,
      '2025-11': 180,
    });
    assert.deepEqual(strip.out, {
      '2025-09': 1200 + 300,
      '2025-11': 150 + 95,
    });
  });

  /* ⚠⚠ 'DROPPED' IS NOT THE SAME AS 'FORGOTTEN' (2026-08-24). The Statement counts these and cash
     cannot, and the STATEMENT now explains that gap to a coach — from this list. If the exclusion
     ever stops reporting itself, the bridge on screen silently loses a line and stops adding up,
     while every other figure in this module stays correct. */
  it('REPORTS what it excluded, so the Statement can explain its own gap', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [
        { ...outRec(599), paidDate: '2026-07-02', familyPaidDirect: true },
        { ...outRec(61), paidDate: '2026-08-09', familyPaidDirect: true },
        { ...outRec(300), paidDate: '2026-06-01', familyPaidDirect: false },
      ],
    });
    assert.deepEqual(strip.excluded.map(e => e.amount).sort((a, b) => a - b), [61, 599]);
    // It carries the words and the filing, because the bridge names WHICH costs, not just how much.
    assert.equal(strip.excluded[0].description, 'Record 599');
    assert.equal(strip.excluded[0].place.categoryName, 'Facilities');
    assert.equal(strip.excluded[0].date, '2026-07-02');
    // And it stayed out of the cash the band actually shows.
    assert.deepEqual(strip.out, { '2026-06': 300 });
  });

  it('excludes nothing when no family paid a vendor directly', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [{ ...outRec(300), paidDate: '2026-06-01', familyPaidDirect: false }],
    });
    assert.deepEqual(strip.excluded, []);
  });
  it('drops a family-paid-direct cost — spending on the report, never team cash', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [
        { ...outRec(250), paidDate: '2025-10-08', familyPaidDirect: true },
        { ...outRec(100), paidDate: '2025-10-09', familyPaidDirect: false },
      ],
    });
    assert.deepEqual(strip.out, { '2025-10': 100 });
  });

  it('dates a drive by the day the money arrived, falling back to the recording day (mig 261)', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      realisedEntries: [
        // Knows its arrival day → that month, even though it was recorded much later.
        entry(300, '2025-08-30', '2025-10-01T12:00:00Z', 'fundraiser'),
        // Legacy row (and every sponsor today): the recording day, as the register does.
        entry(750, null, '2025-11-03T12:00:00Z', 'fundraiser'),
      ],
    });
    assert.deepEqual(strip.in, { '2025-08': 300, '2025-11': 750 });
  });

  it('settles a club request on the day it was DECIDED, not filed', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubRequests: [
        { ...outRec(400), side: 'cost' as const, reviewedAt: '2025-12-02T12:00:00Z', createdAt: '2025-11-20T12:00:00Z' },
        // Never reviewed (defensive: an approved row should always carry the stamp) → filing day.
        { ...outRec(60), side: 'reimbursement' as const, reviewedAt: null, createdAt: '2025-11-21T12:00:00Z' },
      ],
    });
    assert.deepEqual(strip.out, { '2025-12': 400 });
    assert.deepEqual(strip.in, { '2025-11': 60 });
  });

  it('counts only PAID club installments — an unpaid one is a projection, not cash', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubInstallments: [
        { ...outRec(300), paidAt: '2025-09-20T18:00:00Z' },
        { ...outRec(300), paidAt: null },
      ],
    });
    assert.deepEqual(strip.out, { '2025-09': 300 });
  });

  it('reports every dated cash day so the grid can grow a column for it (Exhibit C ruling)', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [duesPay(1050, '2025-08-14')],
    });
    assert.deepEqual(strip.dates, ['2025-08-14']);
    assert.deepEqual(strip.in, { '2025-08': 1050 });
  });

  it('drops undated and zero amounts without inventing a month', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [
        duesPay(100, null),
        duesPay(0, '2025-09-01'),
      ],
      duesPayouts: [payoutRec('payout-50', 50, null)],
    });
    assert.deepEqual(strip.in, {});
    assert.deepEqual(strip.out, {});
    assert.deepEqual(strip.dates, []);
  });

  it('sums to the cent within a month (floating amounts round once per add)', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [
        duesPay(0.1, '2025-09-01'),
        duesPay(0.2, '2025-09-02'),
      ],
    });
    assert.deepEqual(strip.in, { '2025-09': 0.3 });
  });
});

/**
 * THE REVENUE BAND'S GROUPING (Option D, owner ruling 2026-08-23).
 *
 * ⚠ EVERY ONE OF THESE IS A ROUTING DECISION A GUARD CANNOT MAKE. `check:money-report` holds the
 * bands equal to the register, but the register carries a fundraising row's NAME and not its kind —
 * so it cannot tell a bottle drive from a sponsor cheque, and it deliberately sums the two groups
 * together. Which of the five groups a dollar lands in is pinned HERE and nowhere else.
 */
describe('buildActualCashStrip — the revenue band', () => {
  const groups = (strip: ReturnType<typeof buildActualCashStrip>) => {
    const by: Record<string, number> = {};
    for (const e of strip.revenue) by[e.group] = Math.round(((by[e.group] ?? 0) + e.amount) * 100) / 100;
    return by;
  };

  it('routes each source to its own group — and money back is REVENUE, never a smaller cost', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [duesPay(2400, '2025-09-04')],
      moneyInRecords: [
        arrival(500, '2025-09-05', 'income'),
        arrival(200, '2025-10-20', 'money_back'),
      ],
      realisedEntries: [
        entry(640, '2025-10-18', '2025-10-18T12:00:00Z', 'fundraiser'),
        entry(750, '2025-11-03', '2025-11-03T12:00:00Z', 'sponsor'),
      ],
      // The club repaying a cost is the same species of arrival as a vendor refunding one.
      clubRequests: [{ ...outRec(180), side: 'reimbursement' as const, reviewedAt: '2025-11-05T15:00:00Z', createdAt: '2025-11-01T15:00:00Z' }],
    });
    assert.deepEqual(groups(strip), {
      dues: 2400,
      other: 500,
      moneyback: 200 + 180,
      fundraising: 640,
      sponsorship: 750,
    });
  });

  it('a drive and a sponsor are two groups, not one “fundraising” figure', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      realisedEntries: [
        entry(100, '2025-09-01', '2025-09-01T12:00:00Z', 'fundraiser'),
        entry(250, '2025-09-02', '2025-09-02T12:00:00Z', 'sponsor'),
      ],
    });
    assert.deepEqual(groups(strip), { fundraising: 100, sponsorship: 250 });
  });

  /* ⚠⚠ THE TWO INCOMING ANSWERS ARE THE SAME CASH AND DIFFERENT ROWS (mig 271, owner D1). Every
     arrival from the club landed in "Repaid by the club" until 2026-08-30, so a grant was reported
     as a repayment on the one band a treasurer scans top to bottom. Both are still a dollar
     arriving — this is a cash strip — which is why the test asserts the TOTAL is unchanged and only
     the group moves. Getting that backwards in either direction is a money defect no total can
     catch. */
  it('new money from the club joins OTHER INCOME under its filed word; a repayment stays in Money back', () => {
    const grant = buildActualCashStrip({
      ...empty(),
      clubRequests: [{ ...outRec(325), side: 'funding' as const, reviewedAt: '2025-11-05T15:00:00Z', createdAt: '2025-11-01T15:00:00Z' }],
    });
    assert.deepEqual(groups(grant), { other: 325 });
    assert.equal(grant.expenses.length, 0);
    // Its row is the WORD it was filed under — the only grouping a grant has (D4).
    assert.equal(grant.revenue[0].subject.name, 'Dome time');
    assert.equal(grant.revenue[0].subject.id, 'item-1');
    // And the club is named on the row rather than earning a sixth revenue group.
    assert.equal(grant.revenue[0].kind, 'From the club');

    const repaid = buildActualCashStrip({
      ...empty(),
      clubRequests: [{ ...outRec(325), side: 'reimbursement' as const, reviewedAt: '2025-11-05T15:00:00Z', createdAt: '2025-11-01T15:00:00Z' }],
    });
    assert.deepEqual(groups(repaid), { moneyback: 325 });
    assert.equal(repaid.revenue[0].subject.name, 'Repaid by the club');
    // Same cash, same month, either way — the answer moves a row, never a dollar.
    assert.deepEqual(grant.in, repaid.in);
  });

  /* An unfiled grant still arrives, and still has to sit somewhere a coach can open. */
  it('a grant with nothing filed against it is its own “Not itemized” row rather than a dropped dollar', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubRequests: [{
        ...outRec(120), itemName: null, place: { categoryId: null, categoryName: null, itemId: null },
        side: 'funding' as const, reviewedAt: '2025-11-05T15:00:00Z', createdAt: '2025-11-01T15:00:00Z',
      }],
    });
    assert.deepEqual(groups(strip), { other: 120 });
    assert.equal(strip.revenue[0].subject.name, 'Not itemized');
  });

  it('an outgoing club request is a COST filed where the request was filed, never negative revenue', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubRequests: [{ ...outRec(400), side: 'cost' as const, reviewedAt: '2025-12-02T12:00:00Z', createdAt: '2025-11-20T12:00:00Z' }],
    });
    assert.deepEqual(strip.revenue, []);
    assert.equal(strip.expenses.length, 1);
    assert.equal(strip.expenses[0].place.categoryName, 'Facilities');
  });
});

/**
 * WHO EACH DOLLAR CAME FROM (D-2, owner ruling 2026-08-24).
 *
 * ⚠ THE SUBJECT IS WHY A ROW EXISTS AT ALL. A revenue group's rows are the families, drives,
 * sponsors and filings behind its figure — and the grid keys a row by exactly this id, so a stream
 * that stopped carrying one would silently collapse into a single unnamed row while every total
 * stayed correct. No guard downstream can see that: the money still adds up.
 */
describe('buildActualCashStrip — who the money came from', () => {
  const subjects = (strip: ReturnType<typeof buildActualCashStrip>) =>
    strip.revenue.map(e => [e.group, e.subject.id, e.subject.name, e.kind, e.description, e.note]);

  /* ⚠⚠ THE KIND AND THE RECORD'S OWN WORDS ARE TWO FIELDS, and every assertion below turns on the
     difference (owner-found 2026-08-25). A panel opened from ONE family is titled with her name, so
     the KIND leads each row; a panel opened from the GROUP is titled "Player dues", so the FAMILY
     leads and the kind is never printed — it would be the title restated on every line, which is
     exactly how thirteen families reached a coach as thirteen rows reading "Dues payment".
     ⚠ No rule inferred from the records can separate the two: "every row says the same thing" drops
     "Season sponsorship" correctly and "Home opener gate" wrongly. The source says which is which. */
  it('names the family behind a dues payment, and how it arrived — and has no words of its own', () => {
    const strip = buildActualCashStrip({ ...empty(), duesPayments: [duesPay(217, '2026-08-06')] });
    assert.deepEqual(subjects(strip),
      [['dues', 'player-1', 'Maya Ledger', 'Dues payment', null, 'e-transfer']]);
  });

  it('opens a drive to the drive, and shows the rebate as a NOTE rather than a second figure', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      realisedEntries: [{
        ...entry(240, '2026-08-09', '2026-08-09T12:00:00Z', 'fundraiser'),
        playerId: 'player-1', playerName: 'Maya Ledger', rebateAmount: 120,
      }],
    });
    /* ⚠ THE FIGURE IS GROSS. The credit already lowered that family's dues; printing it as an
       amount beside the gross would read as money leaving, which a drive's cash never does. */
    assert.equal(strip.revenue[0].amount, 240);
    /* ⚠ A DRIVE'S RECORD HAS WORDS OF ITS OWN — one family's effort — where a sponsor's does not:
       a sponsor's arrival IS the sponsor, who is already the row. */
    assert.deepEqual(subjects(strip), [
      ['fundraising', 'drive-1', 'Bottle drive', 'Fundraising', 'Maya Ledger', '$120 credited to their dues'],
    ]);
  });

  it('a sponsor’s arrival carries a kind and no words — the sponsor is already the row', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      realisedEntries: [entry(500, '2026-08-15', '2026-08-15T12:00:00Z', 'sponsor')],
    });
    assert.deepEqual(subjects(strip), [
      ['sponsorship', 'sponsor-1', 'Northside Physio', 'Season sponsorship', null, 'received'],
    ]);
  });

  it('says so when a drive entry was not attributed to anybody', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      realisedEntries: [entry(240, '2026-08-11', '2026-08-11T12:00:00Z', 'fundraiser')],
    });
    assert.deepEqual(subjects(strip), [
      ['fundraising', 'drive-1', 'Bottle drive', 'Fundraising', 'Team collection', 'not attributed'],
    ]);
  });

  it('groups typed income by what it was filed under, and unfiled income on its own row', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      moneyInRecords: [
        { ...arrival(300, '2026-07-12', 'income'), description: 'Home opener gate' },
        { ...arrival(120, '2026-08-02', 'income'), itemId: null, itemName: null },
      ],
    });
    assert.deepEqual(subjects(strip), [
      ['other', 'item-1', 'Gate takings', 'Income', 'Home opener gate', null],
      ['other', null, 'Not itemized', 'Income', 'Arrival 120', null],
    ]);
  });

  /* ⚠⚠ THE TWO SOURCES OF MONEY BACK ARE TWO EVENTS, and one of them has a door the other cannot
     have — the club has a Club screen; a refund a coach typed in has no "thing itself" behind it.
     Both NAME WHAT THEY REPAID, which is the load-bearing detail: these are the figures that behave
     differently here than on the Statement, and the panel is where a coach finds that out. */
  it('splits money back into what you recorded and what the club repaid, each naming the cost', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      moneyInRecords: [{
        ...arrival(150, '2026-07-18', 'money_back'),
        description: 'Umpire clinic — two spots refunded',
        categoryName: 'Officials', itemName: 'Clinic fees',
      }],
      clubRequests: [{
        ...outRec(180), description: 'Dome permit share', side: 'reimbursement' as const,
        reviewedAt: '2026-08-05T15:00:00Z', createdAt: '2026-08-01T15:00:00Z',
      }],
    });
    assert.deepEqual(subjects(strip), [
      ['moneyback', 'moneyback:recorded', 'Money back you recorded',
        'Money back', 'Umpire clinic — two spots refunded', 'repaid Officials / Clinic fees'],
      ['moneyback', 'moneyback:club', 'Repaid by the club',
        'Money back', 'Dome permit share', 'repaid Facilities / Dome time'],
    ]);
  });

  it('carries a payout’s reason on its own meta line, beside how it was sent', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayouts: [{ ...payoutRec('dues-payout-1', 20, '2026-08-18'), reason: 'overpaid instalment #2' }],
    });
    assert.equal(strip.expenses[0].note, 'e-transfer · overpaid instalment #2');
    /* ⚠ THE KIND, NOT A DESCRIPTION. Under a panel already titled "Paid back to families" those
       words say nothing; the family, the day and the reason are the record. */
    assert.equal(strip.expenses[0].kind, 'Paid back');
    assert.equal(strip.expenses[0].description, '');
  });
});

/**
 * THE EXPENSES BAND — placement carried through, and money paid back to a family in its own group.
 */
describe('buildActualCashStrip — the expenses band', () => {
  it('files a payout under its own group rather than a budget category it never had', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [{ ...outRec(1200), paidDate: '2025-09-10', familyPaidDirect: false }],
      duesPayouts: [payoutRec('dues-payout-1', 150, '2025-11-14')],
    });
    const payout = strip.expenses.find(e => e.id === 'dues-payout-1');
    assert.ok(payout, 'the payout never reached the expenses band');
    assert.equal(payout!.place.categoryId, PAYOUT_CATEGORY_ID);
    assert.equal(payout!.place.categoryName, PAYOUT_CATEGORY_NAME);
    /* ⚠ AND ON THE FAMILY'S OWN ROW (owner call 2026-08-24). "Paid back to families" opens by
       family, mirroring dues — so the family is the row, and the row is what `itemId` carries. */
    assert.equal(payout!.place.itemId, 'player-1');
  });

  /* ⚠ THE ORDER IS A DISPLAY RULE WITH A REAL CONSEQUENCE: the month grid orders categories it
     learns from events by FIRST APPEARANCE, so a payout emitted early would sit among the team's
     real spending categories instead of at the foot of the band, where it is drawn. */
  it('emits payouts LAST so “Paid back to families” lands at the foot of the band', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayouts: [payoutRec('dues-payout-1', 150, '2025-09-01')],
      expensePayments: [{ ...outRec(80), paidDate: '2025-12-01', familyPaidDirect: false }],
    });
    assert.deepEqual(strip.expenses.map(e => e.place.categoryName), ['Facilities', PAYOUT_CATEGORY_NAME]);
  });

  it('carries the id and the words a drill-in shows behind a figure', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [{
        id: 'exp-1-payment-9', description: 'Dome rental — payment 2 of 3', amount: 400,
        place: { categoryId: 'cat-2', categoryName: 'Facilities', itemId: 'item-9' },
        paidDate: '2025-10-02', familyPaidDirect: false,
      }],
    });
    assert.deepEqual(strip.expenses[0], {
      id: 'exp-1-payment-9', description: 'Dome rental — payment 2 of 3', amount: 400,
      place: { categoryId: 'cat-2', categoryName: 'Facilities', itemId: 'item-9' },
      // An ordinary bill has nothing to add: its date and its own words already say everything —
      // which is why it carries no KIND either. That field is for records whose only description
      // would be their kind repeated.
      note: null,
      kind: null,
      date: '2025-10-02',
    });
  });

  /* ⚠⚠ THE COARSE MAPS ARE A PROJECTION OF THE EVENTS, NOT A SECOND WALK. This is the property the
     module's header promises and the one thing that could silently stop being true: a stream added
     to the events and not to the maps (or the reverse) is precisely how payouts and drive money
     went missing from the strip for weeks. */
  it('in/out are exactly the events summed — one walk, two grains', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [duesPay(2400, '2025-09-04')],
      moneyInRecords: [arrival(200, '2025-09-20', 'money_back')],
      realisedEntries: [entry(640, '2025-10-18', '2025-10-18T12:00:00Z', 'sponsor')],
      expensePayments: [{ ...outRec(1200), paidDate: '2025-09-10', familyPaidDirect: false }],
      duesPayouts: [payoutRec('dues-payout-1', 150, '2025-10-14')],
    });
    const bucket = (events: Array<{ date: string | null; amount: number }>) => {
      const by: Record<string, number> = {};
      for (const e of events) {
        if (!e.date) continue;
        const m = e.date.slice(0, 7);
        by[m] = Math.round(((by[m] ?? 0) + e.amount) * 100) / 100;
      }
      return by;
    };
    assert.deepEqual(strip.in, bucket(strip.revenue));
    assert.deepEqual(strip.out, bucket(strip.expenses));
  });
});
