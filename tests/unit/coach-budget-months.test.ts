import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  monthKeyOf, addMonths, monthSpan, deriveMonthRange, buildMonthGrid, buildCashFlow,
  isElapsed, formatMonthLabel, formatMonthLong,
  type GridLine, type CategoryEvent, type PriorLine,
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
  return { itemId: null, itemName: null, periods: [], ...over };
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
    const g = buildMonthGrid({ lines, actuals, scheduled, priorLines: [], todayMonth: TODAY });
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

  it('keeps scheduled and actual on their own tracks — they never merge into budget', () => {
    const g = buildMonthGrid({ lines, actuals, scheduled, priorLines: [], todayMonth: TODAY });
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
    const g = buildMonthGrid({ lines, actuals, scheduled, priorLines: [], todayMonth: TODAY });
    const monthBudget = g.totals.cells.reduce((s, c) => s + c.budget, 0);
    assert.equal(monthBudget + g.totals.undatedBudget, g.totals.total.budget);
    assert.equal(g.totals.total.budget, 4500);
  });

  it('gives a category with spending but no plan line its own row, flagged unplanned', () => {
    const g = buildMonthGrid({
      lines,
      actuals: [...actuals, { categoryName: 'Officials', date: '2026-05-10', amount: 400 }],
      scheduled: [],
      priorLines: [],
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
      priorLines: [],
      todayMonth: TODAY,
      maxMonths: 6,
    });
    // A stray 2031 date stretches the derived range past the cap, so the grid says it was cut…
    assert.equal(g.truncated, true);
    // …and the money still shows in the row total rather than vanishing from the report.
    assert.equal(g.categories[0].total.actual, 500);
    assert.equal(g.categories[0].cells.reduce((s, c) => s + c.actual, 0), 0);
  });

  it('matches the prior season by item link first, then by name', () => {
    const priorLines: PriorLine[] = [
      { description: 'Entry Fees', itemId: 'item-entry', itemName: 'Entry Fees', categoryName: 'Tournaments', totalAmount: 3300 },
      { description: 'uniforms', itemId: null, itemName: null, categoryName: 'Tournaments', totalAmount: 850 },
      { description: 'Banquet', itemId: null, itemName: null, categoryName: 'Events', totalAmount: 400 },
    ];
    const g = buildMonthGrid({ lines, actuals: [], scheduled: [], priorLines, todayMonth: TODAY });

    const entry = g.categories[0].lines.find(l => l.description === 'Entry Fees')!;
    assert.equal(entry.priorTotal, 3300);
    const uniforms = g.categories[0].lines.find(l => l.description === 'Uniforms')!;
    assert.equal(uniforms.priorTotal, 850, 'name match is case-insensitive');

    assert.equal(g.hasPriorSeason, true);
    assert.deepEqual(g.priorOnly.map(p => p.description), ['Banquet']);
  });

  it('never counts one prior line twice, however many current lines match it', () => {
    // Two current lines share a name with ONE prior line. Naively summing the per-line prior
    // figures would report $1,800 of last-season spend that never existed.
    const dupes: GridLine[] = [
      line({ id: 'a', description: 'Umpire fees', categoryName: 'Officials', totalAmount: 500 }),
      line({ id: 'b', description: 'umpire fees', categoryName: 'Officials', totalAmount: 300 }),
    ];
    const priorLines: PriorLine[] = [
      { description: 'Umpire fees', itemId: null, itemName: null, categoryName: 'Officials', totalAmount: 900 },
    ];
    const g = buildMonthGrid({ lines: dupes, actuals: [], scheduled: [], priorLines, todayMonth: TODAY });
    assert.equal(g.categories[0].priorTotal, 900);
    assert.equal(g.totals.priorTotal, 900);
    // …and it is not ALSO reported as missing from this season.
    assert.deepEqual(g.priorOnly, []);
  });

  it('carries the not-itemized-yet estimate so both views report the same budget total', () => {
    const g = buildMonthGrid({
      lines, actuals: [], scheduled: [], priorLines: [], todayMonth: TODAY, bufferAmount: 700,
    });
    const bufferRow = g.categories.find(c => c.categoryName === 'Not itemized yet')!;
    assert.equal(bufferRow.total.budget, 700);
    // It has no date by definition, so it belongs in the "no date yet" column, never a month.
    assert.equal(bufferRow.undatedBudget, 700);
    assert.equal(bufferRow.cells.reduce((s, c) => s + c.budget, 0), 0);
    assert.equal(g.totals.total.budget, 4500 + 700);
  });

  it('reports no prior season when the team has none', () => {
    const g = buildMonthGrid({ lines, actuals: [], scheduled: [], priorLines: [], todayMonth: TODAY });
    assert.equal(g.hasPriorSeason, false);
    assert.deepEqual(g.priorOnly, []);
    assert.equal(g.totals.priorTotal, null);
  });

  it('treats a line whose periods no longer cover its total as partly undated, never as lost money', () => {
    const drifted = [line({
      id: 'l9', description: 'Dome Time', categoryName: 'Facilities', totalAmount: 1000,
      periods: [{ date: '2026-03-01', amount: 400 }],
    })];
    const g = buildMonthGrid({ lines: drifted, actuals: [], scheduled: [], priorLines: [], todayMonth: TODAY });
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
