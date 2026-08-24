import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  monthKeyOf, addMonths, monthSpan, deriveMonthRange, buildMonthGrid, buildCashFlow,
  isElapsed, formatMonthLabel, formatMonthLong,
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
    assert.equal(entry.undatedBudget, 0);

    const uniforms = g.categories[0].lines.find(l => l.description === 'Uniforms')!;
    assert.equal(uniforms.undatedBudget, 900);
    // The whole point: an undated line contributes to NO month.
    assert.equal(uniforms.cells.reduce((s, c) => s + c.budget, 0), 0);
  });

  it('grows a column for a month where only CASH moved — and puts no money in its cells', () => {
    // Owner ruling 2026-08-23 (Exhibit C): dues received in January, two months before the first
    // budgeted month, must have a column for the strip to land on — silently dropping it fails
    // the register identity by exactly the hidden amount. The grid's own rows stay empty there.
    const g = buildMonthGrid({
      lines, actuals, scheduled, todayMonth: TODAY,
      cashDates: ['2026-01-14'],
    });
    const jan = g.months.indexOf('2026-01');
    assert.notEqual(jan, -1);
    // Contiguity holds: February exists between the cash month and the first budgeted month.
    assert.notEqual(g.months.indexOf('2026-02'), -1);
    // The column exists for the STRIP; the grid's money cells show nothing there.
    const cat = g.categories[0];
    assert.equal(cat.cells[jan].budget, 0);
    assert.equal(cat.cells[jan].actual, 0);
    assert.equal(cat.cells[jan].scheduled, 0);
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
    assert.equal(monthBudget + g.totals.undatedBudget, g.totals.total.budget);
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
    assert.equal(bufferRow.undatedBudget, 700);
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
    assert.equal(l.undatedBudget, 600);
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
