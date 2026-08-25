import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  monthKeyOf, addMonths, monthSpan, deriveMonthRange, buildMonthGrid, buildCashFlow,
  isElapsed, formatMonthLabel, formatMonthLong,
  lensCell, lensTotal, lensUndated, revenueGroupLabel, revenueGroupOf, bandTotalLabel,
  type GridLine, type CategoryEvent,
} from '../../lib/coach-budget-months.ts';

describe('month key helpers', () => {
  it('reads a month off a date or a timestamp, and rejects nonsense', () => {
    assert.equal(monthKeyOf('2026-03-15'), '2026-03');
    assert.equal(monthKeyOf('2026-03-15T12:00:00.000Z'), '2026-03');
    assert.equal(monthKeyOf('2026-13-01'), null);
    assert.equal(monthKeyOf(''), null);
    assert.equal(monthKeyOf(null), null);
  });

  it('adds months across a year boundary in both directions', () => {
    assert.equal(addMonths('2026-11', 3), '2027-02');
    assert.equal(addMonths('2026-02', -3), '2025-11');
    assert.equal(addMonths('2026-12', 1), '2027-01');
  });

  it('counts an inclusive span', () => {
    assert.equal(monthSpan('2026-03', '2026-03'), 1);
    assert.equal(monthSpan('2026-03', '2026-08'), 6);
    assert.equal(monthSpan('2025-11', '2026-02'), 4);
  });
});

describe('deriveMonthRange', () => {
  it('is contiguous — a month with nothing in it still gets a column', () => {
    const { months } = deriveMonthRange(['2026-03-01', '2026-07-31'], '2026-03');
    assert.deepEqual(months, ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
  });

  it('always includes the month the coach is standing in', () => {
    const early = deriveMonthRange(['2026-05-01', '2026-06-01'], '2026-02');
    assert.equal(early.months[0], '2026-02');
    const late = deriveMonthRange(['2026-05-01', '2026-06-01'], '2026-09');
    assert.equal(late.months[late.months.length - 1], '2026-09');
  });

  it('extends forward to a readable minimum only when the range is degenerate', () => {
    const oneMonth = deriveMonthRange(['2026-03-10', '2026-03-28'], '2026-03');
    assert.equal(oneMonth.months.length, 6);
    assert.equal(oneMonth.months[0], '2026-03');
    assert.equal(oneMonth.months[5], '2026-08');

    // A real five-month season keeps five columns — padding it would invent an empty month.
    const real = deriveMonthRange(['2026-03-01', '2026-07-31'], '2026-03');
    assert.equal(real.months.length, 5);
  });

  it('falls back to a window around today when the team has no dated money at all', () => {
    const { months, truncated } = deriveMonthRange([null, undefined, ''], '2026-04');
    assert.equal(months[0], '2026-04');
    assert.equal(months.length, 6);
    assert.equal(truncated, false);
  });

  it('caps the column count and says so', () => {
    const { months, truncated } = deriveMonthRange(['2026-01-01', '2029-01-01'], '2026-01');
    assert.equal(months.length, 24);
    assert.equal(truncated, true);
  });
});

// ── grid ────────────────────────────────────────────────────────────────────

const TODAY = '2026-06';

function line(over: Partial<GridLine> & { id: string; description: string; categoryName: string; totalAmount: number }): GridLine {
  return { itemId: null, periods: [], ...over };
}

describe('buildMonthGrid', () => {
  const lines: GridLine[] = [
    line({
      id: 'l1', description: 'Entry Fees', categoryName: 'Tournaments', totalAmount: 3600,
      itemId: 'item-entry',
      periods: [
        { date: '2026-03-15', amount: 1200 },
        { date: '2026-05-15', amount: 1200 },
        { date: '2026-07-15', amount: 1200 },
      ],
    }),
    line({ id: 'l2', description: 'Uniforms', categoryName: 'Tournaments', totalAmount: 900 }),
  ];

  const actuals: CategoryEvent[] = [
    { categoryName: 'Tournaments', date: '2026-03-20', amount: 1250 },
    { categoryName: 'Tournaments', date: '2026-05-02', amount: 1100 },
  ];
  const scheduled: CategoryEvent[] = [
    { categoryName: 'Tournaments', date: '2026-06-01', amount: 1200 },
  ];

  it('places dated budget in its own month and never spreads undated budget', () => {
    const g = buildMonthGrid({ lines, actuals, scheduled, todayMonth: TODAY });
    const mar = g.months.indexOf('2026-03');
    const apr = g.months.indexOf('2026-04');

    const entry = g.categories[0].lines.find(l => l.description === 'Entry Fees')!;
    assert.equal(entry.cells[mar].budget, 1200);
    assert.equal(entry.cells[apr].budget, 0);
    assert.equal(entry.undated.budget, 0);

    const uniforms = g.categories[0].lines.find(l => l.description === 'Uniforms')!;
    assert.equal(uniforms.undated.budget, 900);
    // The whole point: an undated line contributes to NO month.
    assert.equal(uniforms.cells.reduce((s, c) => s + c.budget, 0), 0);
  });

  /* Owner ruling 2026-08-23 (Exhibit C): dues received two months before the first budgeted month
     must still have a column — folding off-range cash into an edge month, and footnote-only
     disclosure, were both rejected.

     ⚠ ASSERTED AGAINST `deriveMonthRange`, WHICH IS WHAT ACTUALLY RUNS. `buildMonthGrid` once took
     a `cashDates` parameter for this; Option D made the route derive the range ONCE over both bands
     and hand it to each, so the route now feeds cash days here instead and that parameter had no
     production reader left. Testing it would have been testing a branch nothing runs.
     ⚠ The route's own wiring — that it really does feed cash days in — is held by
     `check:money-report`, which fails out loud when cash moved in a month the grid has no column
     for. A unit test cannot see that seam; the guard is where it belongs. */
  it('grows a column for a month where only CASH moved (Exhibit C)', () => {
    const budgeted = ['2026-03-01', '2026-06-01'];
    const cashDay = '2026-01-14';
    const { months } = deriveMonthRange([...budgeted, cashDay], TODAY);
    assert.notEqual(months.indexOf('2026-01'), -1, 'the cash-only month got no column');
    // Contiguity holds: February exists between the cash month and the first budgeted month.
    assert.notEqual(months.indexOf('2026-02'), -1);

    // And the grid handed that domain puts no money in the new column — it is there for the bands.
    const g = buildMonthGrid({ lines, actuals, scheduled, todayMonth: TODAY, months });
    const jan = g.months.indexOf('2026-01');
    const cat = g.categories[0];
    assert.deepEqual(cat.cells[jan], { budget: 0, scheduled: 0, actual: 0 });
  });

  it('keeps scheduled and actual on their own tracks — they never merge into budget', () => {
    const g = buildMonthGrid({ lines, actuals, scheduled, todayMonth: TODAY });
    const cat = g.categories[0];
    const mar = g.months.indexOf('2026-03');
    const jun = g.months.indexOf('2026-06');

    assert.equal(cat.cells[mar].budget, 1200);
    assert.equal(cat.cells[mar].actual, 1250);
    assert.equal(cat.cells[mar].scheduled, 0);
    assert.equal(cat.cells[jun].scheduled, 1200);
    assert.equal(cat.cells[jun].budget, 0);

    assert.equal(cat.total.budget, 4500);
    assert.equal(cat.total.actual, 2350);
    assert.equal(cat.total.scheduled, 1200);
  });

  it('totals across the bottom and down the side agree', () => {
    const g = buildMonthGrid({ lines, actuals, scheduled, todayMonth: TODAY });
    const monthBudget = g.totals.cells.reduce((s, c) => s + c.budget, 0);
    assert.equal(monthBudget + g.totals.undated.budget, g.totals.total.budget);
    assert.equal(g.totals.total.budget, 4500);
  });

  it('gives a category with spending but no plan line its own row, flagged unplanned', () => {
    const g = buildMonthGrid({
      lines,
      actuals: [...actuals, { categoryName: 'Officials', date: '2026-05-10', amount: 400 }],
      scheduled: [],
     
      todayMonth: TODAY,
    });
    const officials = g.categories.find(c => c.categoryName === 'Officials')!;
    assert.equal(officials.unplanned, true);
    assert.equal(officials.total.actual, 400);
    assert.equal(officials.lines.length, 0);
  });

  it('never drops money it cannot place — an out-of-window date lands in the undated bucket', () => {
    const g = buildMonthGrid({
      lines,
      actuals: [{ categoryName: 'Tournaments', date: '2031-01-05', amount: 500 }],
      scheduled: [],
     
      todayMonth: TODAY,
      maxMonths: 6,
    });
    // A stray 2031 date stretches the derived range past the cap, so the grid says it was cut…
    assert.equal(g.truncated, true);
    // …and the money still shows in the row total rather than vanishing from the report.
    assert.equal(g.categories[0].total.actual, 500);
    assert.equal(g.categories[0].cells.reduce((s, c) => s + c.actual, 0), 0);
  });

  it('carries the not-itemized-yet estimate so both views report the same budget total', () => {
    const g = buildMonthGrid({
      lines, actuals: [], scheduled: [], todayMonth: TODAY, bufferAmount: 700,
    });
    const bufferRow = g.categories.find(c => c.categoryName === 'Not itemized yet')!;
    assert.equal(bufferRow.total.budget, 700);
    // It has no date by definition, so it belongs in the "no date yet" column, never a month.
    assert.equal(bufferRow.undated.budget, 700);
    assert.equal(bufferRow.cells.reduce((s, c) => s + c.budget, 0), 0);
    assert.equal(g.totals.total.budget, 4500 + 700);
  });

  it('treats a line whose periods no longer cover its total as partly undated, never as lost money', () => {
    const drifted = [line({
      id: 'l9', description: 'Dome Time', categoryName: 'Facilities', totalAmount: 1000,
      periods: [{ date: '2026-03-01', amount: 400 }],
    })];
    const g = buildMonthGrid({ lines: drifted, actuals: [], scheduled: [], todayMonth: TODAY });
    const l = g.categories[0].lines[0];
    assert.equal(l.cells[g.months.indexOf('2026-03')].budget, 400);
    assert.equal(l.undated.budget, 600);
  });
});

// ── cash flow ───────────────────────────────────────────────────────────────

describe('buildCashFlow', () => {
  const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];

  it('runs a cumulative balance and names the first month it goes short', () => {
    const { rows, shortfall } = buildCashFlow(
      months,
      { '2026-03': 3000, '2026-04': 1500, '2026-05': 1500, '2026-06': 500, '2026-08': 1500 },
      { '2026-03': 2550, '2026-04': 600, '2026-05': 2200, '2026-06': 400, '2026-07': 1600 },
    );
    assert.deepEqual(rows.map(r => r.running), [450, 1350, 650, 750, -850, 650]);
    assert.deepEqual(shortfall, { month: '2026-07', amount: 850 });
  });

  it('reports no shortfall when the balance never dips', () => {
    const { shortfall } = buildCashFlow(months, { '2026-03': 5000 }, { '2026-04': 100 });
    assert.equal(shortfall, null);
  });

  it('honours an opening balance', () => {
    const { rows } = buildCashFlow(['2026-03'], {}, { '2026-03': 500 }, 800);
    assert.equal(rows[0].running, 300);
  });

  it('does not call a rounding crumb a shortfall', () => {
    const { shortfall } = buildCashFlow(['2026-03'], { '2026-03': 100 }, { '2026-03': 100.001 });
    assert.equal(shortfall, null);
  });

  /* ── the three bottom rows prove each other (owner ruling 2026-08-23) ────────────────────────── */

  it('gives every month its own net, and the season the sum of them', () => {
    const { rows, net } = buildCashFlow(
      ['2026-03', '2026-04'], { '2026-03': 1000 }, { '2026-04': 400 });
    assert.deepEqual(rows.map(r => r.net), [1000, -400]);
    assert.equal(net, 600);
  });

  /* ⚠⚠ WHERE AN EM DASH USED TO SIT. "A running balance has no sum" was true and beside the point:
     the figure a treasurer wants is where the balance ENDED, and the Total column is pinned, so
     Cash on hand is now on screen whatever month has been scrolled to. */
  it('ends on opening + net — the figure the Running balance Total cell carries', () => {
    const flow = buildCashFlow(
      ['2026-09', '2026-10'], { '2026-10': 3300 }, { '2026-09': 3000 }, 500);
    assert.equal(flow.opening, 500);
    assert.equal(flow.net, 300);
    assert.equal(flow.ending, 800);
    assert.equal(flow.ending, flow.rows[flow.rows.length - 1].running);
  });

  /* ⚠⚠ THE FORWARD VIEW'S LOAD-BEARING RULE. A sponsor pledge and a club request awaiting an answer
     have no date, so they reach the TOTAL and no month — counted as possible, never as arrived. A
     pledge that leaked into a month's running balance would appear to rescue a February the team
     still has to get through without it, and the shortfall sentence would go quiet. */
  it('puts undated money in the Total and in no month — and lets a shortfall still fire', () => {
    const flow = buildCashFlow(
      ['2026-11', '2026-12'], {}, { '2026-12': 400 }, 100, { moneyIn: 345 });
    assert.deepEqual(flow.rows.map(r => r.running), [100, -300]);
    assert.deepEqual(flow.shortfall, { month: '2026-12', amount: 300 });
    assert.deepEqual(flow.undated, { moneyIn: 345, moneyOut: 0, net: 345 });
    // …and it is still counted where it belongs: opening 100 − 400 + 345.
    assert.equal(flow.net, -55);
    assert.equal(flow.ending, 45);
  });

  it('nets undated money in both directions', () => {
    const flow = buildCashFlow(['2026-11'], {}, {}, 0, { moneyIn: 250, moneyOut: 90 });
    assert.deepEqual(flow.undated, { moneyIn: 250, moneyOut: 90, net: 160 });
    assert.equal(flow.ending, 160);
  });
});

describe('isElapsed', () => {
  it('counts the current month as elapsed and future months as not', () => {
    assert.equal(isElapsed('2026-05', '2026-06'), true);
    assert.equal(isElapsed('2026-06', '2026-06'), true);
    assert.equal(isElapsed('2026-07', '2026-06'), false);
  });
});

describe('month labels', () => {
  it('formats short for a column header and long for prose', () => {
    assert.equal(formatMonthLabel('2026-03'), "Mar '26");
    assert.equal(formatMonthLong('2026-03'), 'March 2026');
  });
});

/**
 * ⚠⚠ SPENDING BELONGS ON THE ITEM ROW, NOT JUST ITS CATEGORY (owner-found 2026-08-21).
 *
 * The grid used to file every movement under a CATEGORY, so a coach saw the right total on
 * "Team Gear" and a dash on "Bags" — the row the money was actually for — while the Statement view
 * of the same report itemised it correctly. Both halves of the join already existed: every cost
 * names an item, and every grid row IS an item and knows its id. The item was simply dropped on the
 * way through. These cases pin the fix, and the last one pins the invariant that makes it safe.
 */
describe('buildMonthGrid — money lands on the item row it belongs to', () => {
  const TODAY_M = '2026-04' as const;
  const mk = (over: Partial<GridLine> & { id: string; description: string; itemId: string | null }): GridLine =>
    ({ categoryName: 'Team Gear', totalAmount: 0, periods: [], ...over });

  const rows: GridLine[] = [
    mk({ id: 'r-jerseys', description: 'Jerseys', itemId: 'item-jerseys', totalAmount: 1800 }),
    mk({ id: 'r-bags', description: 'Bags', itemId: 'item-bags' }),
  ];

  it('puts a paid amount on its own item row, not only on the category', () => {
    const g = buildMonthGrid({
      lines: rows,
      actuals: [{ categoryName: 'Team Gear', itemId: 'item-bags', date: '2026-04-10', amount: 150 }],
      scheduled: [{ categoryName: 'Team Gear', itemId: 'item-bags', date: '2026-09-04', amount: 450 }],
      todayMonth: TODAY_M,
    });
    const cat = g.categories.find(c => c.categoryName === 'Team Gear')!;
    const bags = cat.lines.find(l => l.description === 'Bags')!;
    const jerseys = cat.lines.find(l => l.description === 'Jerseys')!;

    assert.equal(bags.total.actual, 150, 'the Bags row carries the money that is for Bags');
    assert.equal(bags.total.scheduled, 450);
    assert.equal(jerseys.total.actual, 0, 'and a sibling row is untouched');
  });

  it('⚠ the category is the SUM of its rows — which is what a reader assumes it is', () => {
    const g = buildMonthGrid({
      lines: rows,
      actuals: [
        { categoryName: 'Team Gear', itemId: 'item-bags', date: '2026-04-10', amount: 150 },
        { categoryName: 'Team Gear', itemId: 'item-jerseys', date: '2026-04-12', amount: 900 },
      ],
      scheduled: [], todayMonth: TODAY_M,
    });
    const cat = g.categories.find(c => c.categoryName === 'Team Gear')!;
    const rowSum = cat.lines.reduce((s, l) => s + l.total.actual, 0);
    assert.equal(cat.total.actual, 1050);
    assert.equal(rowSum, 1050, 'nothing is held at the category level that a row could hold');
  });

  it('⚠ money with NO item still lands, at the category, rather than being dropped', () => {
    // Only reachable for costs predating the item requirement — but it must never vanish.
    const g = buildMonthGrid({
      lines: rows,
      actuals: [{ categoryName: 'Team Gear', date: '2026-04-10', amount: 75 }],
      scheduled: [], todayMonth: TODAY_M,
    });
    const cat = g.categories.find(c => c.categoryName === 'Team Gear')!;
    assert.equal(cat.total.actual, 75, 'the category still reports it');
    assert.equal(cat.lines.reduce((s, l) => s + l.total.actual, 0), 0, 'and no row claims it');
  });

  it('⚠⚠ two rows sharing an item do NOT each claim the same money', () => {
    // The category is the sum of its rows, so a double claim would double the category.
    const dupes: GridLine[] = [
      mk({ id: 'a', description: 'Bags', itemId: 'item-bags' }),
      mk({ id: 'b', description: 'Bags again', itemId: 'item-bags' }),
    ];
    const g = buildMonthGrid({
      lines: dupes,
      actuals: [{ categoryName: 'Team Gear', itemId: 'item-bags', date: '2026-04-10', amount: 200 }],
      scheduled: [], todayMonth: TODAY_M,
    });
    const cat = g.categories.find(c => c.categoryName === 'Team Gear')!;
    assert.equal(cat.total.actual, 200, 'counted once, not twice');
    assert.equal(cat.lines.reduce((s, l) => s + l.total.actual, 0), 200);
  });

  it('⚠⚠ UNDATED money reaches the row too, even when the caller ids its rows its own way', () => {
    /* The regression this pins (`/review`, correctness lens, 2026-08-21): the row total looked
       its undated money up by `line.id`, while the money was filed under `category|item`. It
       agreed only because the live caller happens to build ids in that same shape — and every
       test here uses short ids like `a`/`b`, so nothing would have caught the day that changed.
       These rows are deliberately id'd NOTHING like the money key. A commitment whose due date
       falls outside the grid's month window is undated as far as the columns are concerned, so
       this is the ordinary case, not an exotic one. */
    const oddlyIded: GridLine[] = [
      mk({ id: 'row-0001', description: 'Bags', itemId: 'item-bags', totalAmount: 400 }),
    ];
    const g = buildMonthGrid({
      lines: oddlyIded,
      actuals:   [{ categoryName: 'Team Gear', itemId: 'item-bags', date: null, amount: 120 }],
      scheduled: [{ categoryName: 'Team Gear', itemId: 'item-bags', date: null, amount: 260 }],
      todayMonth: TODAY_M,
    });
    const cat = g.categories.find(c => c.categoryName === 'Team Gear')!;
    const bags = cat.lines.find(l => l.description === 'Bags')!;
    assert.equal(bags.total.actual, 120, 'the ROW carries its own undated spending');
    assert.equal(bags.total.scheduled, 260, 'and its own undated commitment');
    // The invariant the whole change exists to hold.
    assert.equal(cat.total.actual, 120, 'category still equals the sum of its rows');
    assert.equal(cat.total.scheduled, 260);
  });
});

// ── the two bands (Option D, owner ruling 2026-08-23) ────────────────────────

/**
 * THE REVENUE BAND IS THE SAME BUILDER, and these pin the three additions that made that possible:
 * a plan that arrives as dated EVENTS, an undated bucket that holds more than budget, and a month
 * domain the CALLER owns so two bands line up column for column.
 */
describe('buildMonthGrid — a plan that arrives as events (the REVENUE band)', () => {
  const TODAY_B = '2026-05';
  const dues = (date: string | null, amount: number): CategoryEvent =>
    ({ categoryId: 'revenue:dues', categoryName: 'Player dues', itemId: null, date, amount });

  it('gives a category with NO budget lines a real budget row from its dated events', () => {
    const g = buildMonthGrid({
      lines: [],
      actuals: [], scheduled: [],
      budgets: [dues('2026-05-01', 2500), dues('2026-07-01', 2500)],
      todayMonth: TODAY_B,
    });
    const cat = g.categories.find(c => c.categoryName === 'Player dues')!;
    assert.equal(cat.cells[g.months.indexOf('2026-05')].budget, 2500);
    assert.equal(cat.cells[g.months.indexOf('2026-07')].budget, 2500);
    assert.equal(cat.total.budget, 5000);
  });

  /* ⚠ THE REGRESSION THIS EXISTS FOR: an "unplanned" category (one with no budget LINE) used to be
     dropped when it had no scheduled and no actual money. Every revenue group is line-less, so a
     group that is only ever BUDGETED — expected sponsorship, before a cheque arrives — would have
     vanished from the one lens it exists to appear on. */
  it('keeps a group that is only ever budgeted — it is the Budget lens own point', () => {
    const g = buildMonthGrid({
      lines: [], actuals: [], scheduled: [],
      budgets: [{ categoryId: 'revenue:sponsorship', categoryName: 'Sponsorships', itemId: null, date: '2026-06-01', amount: 500 }],
      todayMonth: TODAY_B,
    });
    assert.equal(g.categories.length, 1);
    assert.equal(g.categories[0].total.budget, 500);
  });

  it('an undated plan event reaches the Total and no month', () => {
    const g = buildMonthGrid({
      lines: [], actuals: [], scheduled: [],
      budgets: [dues('2026-05-01', 1000), dues(null, 400)],
      todayMonth: TODAY_B,
    });
    const cat = g.categories[0];
    assert.equal(cat.undated.budget, 400);
    assert.equal(cat.cells.reduce((s, c) => s + c.budget, 0), 1000);
    assert.equal(cat.total.budget, 1400);
  });

  /* ⚠⚠ THE FORWARD VIEW'S OWN BUCKET. Undated money used to be plan money and nothing else — a
     sponsor pledge and a club request awaiting an answer have no date either, and they must reach
     the Total without touching a month, or a pledge would appear to rescue a February the team has
     to get through without it. */
  it('holds undated SCHEDULED and ACTUAL money too, not only budget', () => {
    const g = buildMonthGrid({
      lines: [], actuals: [dues(null, 90)], scheduled: [dues(null, 250)],
      budgets: [dues('2026-05-01', 1000)],
      todayMonth: TODAY_B,
    });
    const cat = g.categories[0];
    assert.deepEqual(cat.undated, { budget: 0, scheduled: 250, actual: 90 });
    assert.deepEqual(g.totals.undated, { budget: 0, scheduled: 250, actual: 90 });
    assert.equal(cat.cells.reduce((s, c) => s + c.scheduled, 0), 0, 'undated money is in NO month');
  });
});

describe('buildMonthGrid — one month domain, two bands', () => {
  const TODAY_B = '2026-05';
  it('takes the caller months verbatim so both bands line up column for column', () => {
    /* ⚠ THE DEFECT THIS PREVENTS IS NOT COSMETIC. `Net for the month` subtracts the expense band's
       cell from the revenue band's at the SAME index — one extra column on either side and every
       month after it subtracts the wrong pair. */
    const months = ['2026-04', '2026-05', '2026-06', '2026-07'];
    const revenue = buildMonthGrid({
      lines: [], actuals: [{ categoryId: 'revenue:dues', categoryName: 'Player dues', itemId: null, date: '2026-05-04', amount: 900 }],
      scheduled: [], todayMonth: TODAY_B, months, truncated: false,
    });
    const expenses = buildMonthGrid({
      lines: [], actuals: [{ categoryName: 'Facilities', date: '2026-07-02', amount: 300 }],
      scheduled: [], todayMonth: TODAY_B, months, truncated: false,
    });
    assert.deepEqual(revenue.months, months);
    assert.deepEqual(expenses.months, months);
    assert.equal(revenue.totals.cells.length, expenses.totals.cells.length);
    assert.equal(revenue.totals.cells[1].actual, 900);
    assert.equal(expenses.totals.cells[3].actual, 300);
  });

  it('carries the caller truncation flag rather than inventing its own', () => {
    const g = buildMonthGrid({
      lines: [], actuals: [], scheduled: [], todayMonth: TODAY_B,
      months: ['2026-05'], truncated: true,
    });
    assert.equal(g.truncated, true);
  });
});

/**
 * THE SIGN OF "DIFFERENCE" FLIPS BETWEEN THE BANDS.
 *
 * ⚠⚠ THIS IS A COLOUR BUG WAITING TO HAPPEN, WHICH IS WHY IT IS ARITHMETIC AND NOT A STYLE RULE.
 * Under budget on a cost is good news; under budget on dues is a shortfall. Computed one way for
 * both, a season $900 light on dues would print a positive figure in the same green the grid uses
 * for "you saved money".
 */
describe('lensCell / lensTotal — direction', () => {
  const cell = { budget: 1000, scheduled: 0, actual: 600 };
  it('a cost reads plan minus actual; revenue reads actual minus plan', () => {
    assert.equal(lensCell(cell, 'difference', '2026-04', '2026-05'), 400);
    assert.equal(lensCell(cell, 'difference', '2026-04', '2026-05', 'out'), 400);
    assert.equal(lensCell(cell, 'difference', '2026-04', '2026-05', 'in'), -400);
    assert.equal(lensTotal(cell, 'difference'), 400);
    assert.equal(lensTotal(cell, 'difference', 'in'), -400);
  });

  it('defaults to a cost, so every pre-Option-D caller reads exactly as it did', () => {
    assert.equal(lensCell(cell, 'difference', '2026-04', '2026-05'),
      lensCell(cell, 'difference', '2026-04', '2026-05', 'out'));
  });

  it('a month still ahead says nothing on either band', () => {
    assert.equal(lensCell(cell, 'difference', '2026-09', '2026-05', 'in'), null);
    assert.equal(lensCell(cell, 'difference', '2026-09', '2026-05', 'out'), null);
  });

  it('every other lens ignores direction entirely', () => {
    for (const lens of ['budget', 'scheduled', 'actual'] as const) {
      assert.equal(lensCell(cell, lens, '2026-04', '2026-05', 'in'), cell[lens]);
      assert.equal(lensCell(cell, lens, '2026-04', '2026-05', 'out'), cell[lens]);
    }
  });
});

describe('lensUndated', () => {
  const undated = { budget: 700, scheduled: 250, actual: 40 };
  it('gives each lens its own bucket', () => {
    assert.equal(lensUndated(undated, 'budget'), 700);
    assert.equal(lensUndated(undated, 'scheduled'), 250);
    assert.equal(lensUndated(undated, 'actual'), 40);
  });
  /* Comparing an undated plan against an undated arrival is not a comparison anyone asked for, so
     Difference reports the plan's own figure — the behaviour that column has always had. */
  it('stays plan-only under Difference', () => {
    assert.equal(lensUndated(undated, 'difference'), 700);
  });
});

describe('the band vocabulary', () => {
  it('only the club row is re-named by a lens — the others are the same object read forward', () => {
    assert.equal(revenueGroupLabel('dues', 'actual'), 'Player dues');
    assert.equal(revenueGroupLabel('dues', 'budget'), 'Player dues');
    // ⚠ THE SAME NAME ON EVERY LENS (owner 2026-08-24) — a dues instalment still to come IS player
    // dues. Only a group whose forward view is a DIFFERENT OBJECT gets renamed.
    assert.equal(revenueGroupLabel('dues', 'scheduled'), 'Player dues');
    assert.equal(revenueGroupLabel('sponsorship', 'scheduled'), 'Sponsorships');
    assert.equal(revenueGroupLabel('moneyback', 'scheduled'), 'Asked of the club');
    // A drive has no forward record; if one ever renders there it still says what it is.
    assert.equal(revenueGroupLabel('fundraising', 'scheduled'), 'Fundraising');
  });

  it('a band total takes the lens own adjective, on screen and in the file alike', () => {
    assert.equal(bandTotalLabel('in', 'actual'), 'Total revenue');
    assert.equal(bandTotalLabel('out', 'actual'), 'Total expenses');
    assert.equal(bandTotalLabel('in', 'budget'), 'Budgeted revenue');
    assert.equal(bandTotalLabel('out', 'scheduled'), 'Scheduled expenses');
    assert.equal(bandTotalLabel('in', 'difference'), 'Total revenue');
  });

  /* ⚠ THE GRID RETURNS `id:<categoryId>` and the route holds the bare id. Both have to answer, or
     the screen silently falls back to the lens-neutral name and the Scheduled lens stops
     re-labelling — which looks like nothing at all going wrong. */
  it('recognises a revenue group from either spelling of its key, and nothing else', () => {
    assert.equal(revenueGroupOf('id:revenue:dues'), 'dues');
    assert.equal(revenueGroupOf('revenue:sponsorship'), 'sponsorship');
    assert.equal(revenueGroupOf('id:cat-1'), null);
    assert.equal(revenueGroupOf('name:facilities'), null);
    assert.equal(revenueGroupOf('id:revenue:not-a-group'), null);
    assert.equal(revenueGroupOf(null), null);
  });
});
