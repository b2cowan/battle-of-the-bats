/**
 * The plan list's **When** column (owner ruling 2026-09-04) — what replaced `scheduleSummaryLabel`.
 *
 * ⚠ THE PARTLY-DATED CASE IS THE ONE THAT MATTERS, and it is the reason this became a rewrite
 * rather than a rename. The old label printed "Mar · 2 chunks" over the UAT team's jersey order — a
 * $500 deposit dated March plus a $1,000 balance with NO date — so a coach scanning the column for
 * undated money saw a fully dated line, and the $1,000 stayed invisible until they opened the row.
 *
 * The other two defects it carried: it COUNTED CHUNKS, which is not an answer to "when" (and §133
 * ruled counts off rows elsewhere the same week), and it printed "—" for a lump sum, which cannot
 * tell a deliberate "No date yet" from a line nobody ever asked about.
 *
 * Its own file rather than appended to the periods-view suite: that file was being committed by a
 * concurrent session while this was written, and a new file cannot collide with one.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { whenSummary, whenSummaryText } from '../../lib/coach-budget-periods-view.ts';

/** Plain and explicit, so an assertion below reads as the string a coach sees. */
const money = (n: number) => `$${n.toFixed(2)}`;

describe('whenSummary — what the When column says', () => {
  it('a lump sum with no periods has no months and is undated in full', () => {
    // ⚠ THE LINE TOTAL, not zero. There are no periods to add up, so summing them would report an
    // entirely undated line as fully dated — which is precisely what "—" used to do.
    assert.deepEqual(whenSummary([], 3200), { months: [], undated: 3200 });
    assert.equal(whenSummaryText(whenSummary([], 3200), money), 'No date yet');
  });

  it('one month reads as that month alone — no chunk count', () => {
    const s = whenSummary([{ periodDate: '2026-04-01', amount: 3200 }], 3200);
    assert.deepEqual(s, { months: ['Apr'], undated: 0 });
    assert.equal(whenSummaryText(s, money), 'Apr');
  });

  it('a few months are named, in order, deduped', () => {
    const s = whenSummary([
      { periodDate: '2026-03-15', amount: 1734 },
      { periodDate: '2026-01-15', amount: 1733 },
      { periodDate: '2026-02-15', amount: 1733 },
    ], 5200);
    assert.deepEqual(s.months, ['Jan', 'Feb', 'Mar']);
    assert.equal(s.undated, 0);
    assert.equal(whenSummaryText(s, money), 'Jan · Feb · Mar');
  });

  it('two chunks in ONE month say that month once', () => {
    const s = whenSummary([
      { periodDate: '2026-04-01', amount: 300 },
      { periodDate: '2026-04-20', amount: 200 },
    ], 500);
    assert.deepEqual(s.months, ['Apr']);
  });

  it('names the undated HALF of a partly-dated line — the defect this replaced', () => {
    const s = whenSummary([
      { periodDate: '2026-03-01', amount: 500 },
      { periodDate: null,         amount: 1000 },
    ], 1500);
    assert.deepEqual(s.months, ['Mar']);
    assert.equal(s.undated, 1000);
    assert.equal(whenSummaryText(s, money), 'Mar · $1000.00 no date');
  });

  it('a split whose chunks are ALL undated reads as no date at all', () => {
    const s = whenSummary([
      { periodDate: null, amount: 600 },
      { periodDate: null, amount: 400 },
    ], 1000);
    assert.deepEqual(s.months, []);
    assert.equal(s.undated, 1000);
    assert.equal(whenSummaryText(s, money), 'No date yet');
  });

  it('collapses to a span once more than four months carry money', () => {
    // Twelve month names would not fit the column, and "spread across the year" is what a coach
    // would say out loud anyway.
    const periods = Array.from({ length: 12 }, (_, m) => ({
      periodDate: `2026-${String(m + 1).padStart(2, '0')}-01`, amount: 100,
    }));
    assert.deepEqual(whenSummary(periods, 1200).months, ['Jan–Dec']);
  });

  it('lists exactly four, and spans at five', () => {
    const at = (n: number) => Array.from({ length: n }, (_, m) => ({
      periodDate: `2026-${String(m + 1).padStart(2, '0')}-01`, amount: 100,
    }));
    assert.deepEqual(whenSummary(at(4), 400).months, ['Jan', 'Feb', 'Mar', 'Apr']);
    assert.deepEqual(whenSummary(at(5), 500).months, ['Jan–May']);
  });

  it('tags the YEAR on every label once a line crosses New Year', () => {
    // Two Januaries a year apart must not read alike — the same reason the retired label borrowed
    // formatMonthLabel for a cross-year span.
    const s = whenSummary([
      { periodDate: '2026-12-01', amount: 500 },
      { periodDate: '2027-01-01', amount: 500 },
    ], 1000);
    assert.deepEqual(s.months, ["Dec '26", "Jan '27"]);
  });

  it('reports no undated money when the dated chunks cover the total', () => {
    const s = whenSummary([
      { periodDate: '2026-01-01', amount: 600 },
      { periodDate: '2026-02-01', amount: 400 },
    ], 1000);
    assert.equal(s.undated, 0);
  });

  it('never reports negative undated money when a split over-adds', () => {
    // A desync the server refuses, but a stale payload must not print "−$200 no date" on screen.
    assert.equal(whenSummary([{ periodDate: '2026-01-01', amount: 1200 }], 1000).undated, 0);
  });

  it('treats a missing amount as zero rather than NaN', () => {
    // The export's rows carry amounts as strings on some paths; NaN would propagate into the chip
    // and print "$NaN no date" on a real screen.
    const s = whenSummary([{ periodDate: null, amount: undefined }], 900);
    assert.equal(s.undated, 900);
  });
});
