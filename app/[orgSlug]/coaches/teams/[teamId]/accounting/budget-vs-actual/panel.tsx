'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, Fragment } from 'react';
import Link from 'next/link';
import { TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import ColumnPager from '@/components/coaches/ColumnPager';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import QuestionShell from '@/components/coaches/QuestionShell';
import SampleBudgetSheet from '@/components/coaches/SampleBudgetSheet';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import MoneyMonthGrid, { MONEY_LENSES, MONTH_WINDOW, type MoneyLens, type MonthGridPayload } from '@/components/coaches/MoneyMonthGrid';
import {
  formatMonthLabel, periodRangeLabel, lensCell, lensTotal, lensUndated, lensReadsSpendingGrid,
  buildBandCashFlow, categoryHasFigure, hasUndated, isPayoutCategory, balanceShowsMonth,
  bandTotalLabel, revenueGroupLabel, revenueGroupOf, scheduledForward,
  RETURNED_BAND_LABEL, RETURNED_TOTAL_LABEL,
  type MonthGrid, type MonthCell, type MoneyRowDirection,
} from '@/lib/coach-budget-months';
import {
  duesRowRenders, duesSentenceRenders, duesFundingState, duesGap, isDuesCategory,
  type DuesRevenue,
} from '@/lib/coach-dues-revenue';
import ReportNotes from '@/components/coaches/ReportNotes';
import { statementNotes, monthGridNotesFor } from '@/lib/coach-money-report-notes';
import {
  COMPARE_BASES, normalizeBasis, budgetedOn, varianceOn,
  planColumnLabel, netRowLabel, type CompareBasis,
} from '@/lib/coach-budget-basis';
// ⚠ ORG TIMEZONE, never the runtime's UTC — a naive slice puts a coach in Vancouver a day ahead of
// themselves all evening, and this basis is entirely a question about which side of today money
// falls on.
import { formatStoredDate, tournamentToday } from '@/lib/timezone';
// The coach-money accounting-bracket formatter, shared with the settlement and payout sheets.
import { fmt as fmtBrackets } from '@/lib/coach-money-summary';
import { useOnMoneyRevisionBump } from '@/lib/coach-money-refresh';
import { toggleKey } from '@/lib/toggle-key';
import {
  bvaExportColumns, bvaCategoryRows, bvaActivityRows,
  type MoneyExportFormat, type MoneyRowKind, type MoneyMasthead,
} from '@/lib/coach-money-exports';
import { moneySectionHref } from '@/lib/coach-money-links';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import type { ExportColumnDef } from '@/lib/export';
import styles from './bva.module.css';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachLoading from '@/components/coaches/CoachLoading';
import shared from '../../../../coaches.module.css';

/* ⚠ THE REPORT IS TWO LEVELS: CATEGORY → ITEM (owner ruling 2026-08-15). It used to be category →
   budget line, named by whatever description a coach had typed, which is why a line filed under the
   item "Entry Fees" could render as a row called "test" and why the plan and the books could never
   be matched to each other. The shapes below mirror `lib/coach-budget-rollup.ts`, which owns the
   grouping for this screen and for the route together. */
interface PeriodResult {
  label: string;
  date: string | null;
  amount: number;
  actual: number;
}

interface ItemResult {
  /** Null = the "Not itemized" bucket: lines or costs in this category naming no item. */
  itemId: string | null;
  itemName: string;
  /** Which section this row belongs to. One item may legitimately appear as two rows (mig 243). */
  direction: 'in' | 'out';
  budgeted: number;
  actual: number;
  /** What moved before money back — the "$2,400 paid" half of "$2,400 paid · $150 back". */
  grossActual: number;
  refundTotal: number;
  /** ⚠ GOOD-NEWS-POSITIVE, per direction. The formula differs (revenue: actual − budget; a cost:
   *  the reverse) and is decided ONCE in the rollup, so this screen has one colour rule and
   *  changes only its wording per section. */
  variance: number;
  /** Two or more budget lines summed into this row. ⚠ NOTHING RENDERS THIS ANY MORE — the caption
   *  it existed for was removed from every surface (owner ruling 2026-09-04, QA §133). Kept because
   *  `lines` is optional across a rolling deploy and this is the one field that still says "this
   *  row is a merge" without it; delete it only together with that guard. */
  lineCount: number;
  /** ⚠ DERIVED, never stored: is there a budget line for this category+item? False = the team was
   *  charged for something it never planned, which is the row this whole change exists to show. */
  inPlan: boolean;
  periods: PeriodResult[];
  /** The money back netted into this row, so it can show what came back and when. */
  refunds: Array<{ id: string; description: string; amount: number; receivedDate: string | null }>;
  /** The budget lines summed into this row — what the Budget figure opens (QA §132). One entry
   *  when `lineCount` is 1, so the panel never has to reason about a missing list. */
  /** ⚠ OPTIONAL ON PURPOSE (adversarial review, 2026-09-04). This field is NEWER THAN THE CLIENT
   *  that may be asking for it: the route stripped it until this release, the report is fetched in a
   *  separate request after the bundle loads, and a rolling deploy really does pair a new bundle
   *  with an old route. Typed as possibly-absent so the compiler forces the guard rather than
   *  leaving it to whoever writes the next reader. */
  lines?: Array<{ id: string; description: string; notes: string | null; totalAmount: number }>;
  /** The individual payments summed into this row — what the ACTUAL figure opens (QA §132 round
   *  three). ⚠ NOT ALL OF THESE ARE RECORDS A COACH CAN OPEN: a payable contributes one entry per
   *  instalment, club money arrives as a synthetic id, and the derived pools are a NAME with no
   *  record at all ("From your fundraisers"). That is why this panel states and never links, where
   *  the plan panel beside it does both — see the note on `RecordsBehind`.
   *  ⚠⚠ OPTIONAL FOR THE SAME REASON `lines` IS, AND IT WAS MISSED ON THE FIRST PASS (`/review`,
   *  2026-09-04). Both fields were stripped by the SAME deleted helper, so both are newer than a
   *  client that may be asking for them — but only `lines` was typed possibly-absent. Reading
   *  `item.costs.length` unguarded runs for EVERY row on every render, so during a rolling deploy
   *  (new bundle, old route) the whole statement threw before a single figure painted. A guarded
   *  read degrades to a plain number; an unguarded one takes the page down. */
  costs?: Array<{ id: string; description: string; amount: number; paidDate: string | null }>;
}

interface CategoryResult {
  categoryId: string | null;
  categoryName: string;
  direction: 'in' | 'out';
  budgeted: number;
  /** Net of any money back its items carry. The "paid · back" caption is a ROW's, not a category's. */
  actual: number;
  variance: number;
  /** False when nothing in this category was ever budgeted — the whole heading is unplanned. */
  inPlan: boolean;
  items: ItemResult[];
}

interface ReportSection {
  direction: 'in' | 'out';
  categories: CategoryResult[];
  budgeted: number;
  actual: number;
  variance: number;
}

/** One block of the by-activity lens: what a category earned, what it cost, what it netted. */
interface ActivityBlock {
  categoryId: string | null;
  categoryName: string;
  revenue: CategoryResult | null;
  costs: CategoryResult | null;
  net: { budgeted: number; actual: number; variance: number };
  inPlan: boolean;
}

interface MoneyReport {
  revenue: ReportSection;
  expenses: ReportSection;
  activities: ActivityBlock[];
  /** Where BOTH shapes end. Variance is actual − budgeted: more net is the good news. */
  net: { budgeted: number; actual: number; variance: number };
}

/**
 * The whole report, re-cut onto a comparison basis — ONE pass, so every figure the two shapes draw
 * comes from the same arithmetic and no render site has to know which basis it is in.
 *
 * ⚠ THIS IS WHY THE BASIS DID NOT NEED A SERVER CHANGE. `ItemResult.periods` already ships every
 * period with its date and amount (it feeds the row's own expander), so "plan dated on or before
 * today" is a filter over data the report has always carried. Re-deriving it on the server would
 * have created a second source for a figure the Months view also plots — the drift this report has
 * been consolidated twice to remove.
 *
 * ⚠⚠ TOTALS ARE RE-SUMMED FROM THE ITEMS UP, never scaled. A category's to-date plan is the sum of
 * its items' to-date plans; a section's is the sum of its categories'. Anything else lets a
 * category disagree with the rows a coach can open underneath it.
 *
 * ⚠ THE DUES ROW IS THE ONE SPECIAL CASE, and it has to be. Dues are not budget lines and carry no
 * periods, so the generic rule would report $0.00 for the season's largest money in — on a team
 * whose families are being billed perfectly on schedule. Its instalments already carry due dates,
 * so the route ships `billedToDate` and this reads it (owner ruling 2026-09-04).
 */
function rebaseReport(
  report: MoneyReport, dues: DuesRevenue, basis: CompareBasis, today: string,
): MoneyReport {
  if (basis === 'season') return report;

  const rebaseItem = (it: ItemResult): ItemResult => {
    const budgeted = budgetedOn('todate', it.budgeted, it.periods, today);
    return { ...it, budgeted, variance: varianceOn(it.direction, budgeted, it.actual) };
  };

  const rebaseCat = (cat: CategoryResult): CategoryResult => {
    /* The synthetic dues category has no items to sum — see the note above. */
    if (isDuesCategory(cat.categoryId)) {
      const budgeted = dues.billedToDate ?? 0;
      return { ...cat, budgeted, variance: varianceOn('in', budgeted, cat.actual) };
    }
    const items = cat.items.map(rebaseItem);
    const budgeted = r2(items.reduce((s, i) => s + i.budgeted, 0));
    return { ...cat, items, budgeted, variance: varianceOn(cat.direction, budgeted, cat.actual) };
  };

  const rebaseSection = (sec: ReportSection): ReportSection => {
    const categories = sec.categories.map(rebaseCat);
    const budgeted = r2(categories.reduce((s, c) => s + c.budgeted, 0));
    return { ...sec, categories, budgeted, variance: varianceOn(sec.direction, budgeted, sec.actual) };
  };

  const revenue  = rebaseSection(report.revenue);
  const expenses = rebaseSection(report.expenses);

  const activities = report.activities.map(block => {
    const rev = block.revenue ? rebaseCat(block.revenue) : null;
    const cst = block.costs   ? rebaseCat(block.costs)   : null;
    const budgeted = r2((rev?.budgeted ?? 0) - (cst?.budgeted ?? 0));
    const actual   = r2((rev?.actual ?? 0) - (cst?.actual ?? 0));
    /* A block's net is money IN less money OUT, so more of it is the good news — the same rule the
       report's own closing row uses, and the reason both take direction 'in'. */
    return { ...block, revenue: rev, costs: cst,
      net: { budgeted, actual, variance: varianceOn('in', budgeted, actual) } };
  });

  const netBudget = r2(revenue.budgeted - expenses.budgeted);
  return {
    revenue, expenses, activities,
    net: {
      budgeted: netBudget,
      actual: report.net.actual,
      variance: varianceOn('in', netBudget, report.net.actual),
    },
  };
}

interface UnbudgetedActual {
  id: string;
  description: string;
  category: string | null;
  item: string | null;
  amount: number;
  paidAt: string | null;
}

interface MonthlyPoint {
  month: string;
  budgetedForMonth: number;
  actualForMonth: number;
  cumBudget: number;
  cumActual: number;
}

interface BvaData extends MonthGridPayload {
  headroom: number;
  totalBudget: number;      // itemized COST sum (funding lines are never in here)
  seasonTotal: number | null;   // the optional estimated total
  effectiveBudget: number;  // the estimate when one is set, else the itemized sum
  buffer: number;           // estimate not yet itemized (positive part only)
  /** Signed: negative means the lines have outgrown the estimate. */
  estimateDifference: number;
  overPlanned: boolean;
  /**
   * What families are billed, what the plan needs from them, and whether those two meet.
   *
   * ⚠ THE ROW'S OWN FIGURES ARE NOT HERE — they ride inside `report.revenue` like every other row,
   * which is what makes Total revenue and Season net move with them and the export follow without
   * knowing anything new. This block is what the SENTENCE under the table is written from, plus the
   * two facts no figure on the report can state: that a schedule exists at all, and that the plan's
   * residual was floored (`lib/coach-dues-revenue.ts` carries the whole reasoning).
   */
  dues: DuesRevenue;
  /** Both report shapes, off one grouping pass (mig 243). */
  report: MoneyReport;
  totalActual: number;
  /** How much of `totalActual` went on items nobody planned. A figure to NAME, never to add. */
  unbudgeted: number;
  /* ⚠ NO TOP-LEVEL `categories`. The expenses tree lives at `report.expenses.categories` and
     nowhere else — it was briefly sent twice, doubling the heaviest part of the payload, and a
     declared-but-unsent field is how the next reader gets `undefined` at runtime with a clean
     typecheck. */
  unbudgetedActuals: UnbudgetedActual[];
  monthlyChart: MonthlyPoint[];
  /** Plan money with no date on it — named so the chart can say what it isn't plotting. */
  undatedBudget: number;
  /**
   * Spending a FAMILY paid the vendor directly — on this statement, absent from the cash view.
   *
   * ⚠ IT COMES FROM THE CASH ARITHMETIC THAT EXCLUDED IT, not from a second reading of the same
   * rule. It exists so the Statement can explain its own gap rather than leaving Months to do it in
   * a footnote a board never sees.
   */
  familyPaidCosts: Array<{
    id: string;
    description: string;
    categoryName: string | null;
    itemId: string | null;
    amount: number;
    /** The day the family paid it — both bridges date their itemized lines (owner D5.2). */
    date: string | null;
  }>;
}

/**
 * How the coach wants to read the same records (mig 243).
 *
 * ⚠ `categories` STILL RESOLVES — see `readStoredView`. It was the shipped value and it is stored
 * per device, so dropping it would silently reset every treasurer who had chosen a view.
 */
type BvaView = 'statement' | 'activity' | 'months';

/**
 * The stored preference, narrowed — including the legacy value.
 *
 * `categories` became **Statement**: the same rows, now split into REVENUE and EXPENSES with a
 * season net, because money in finally has the vocabulary to be reported beside money out.
 */
function readStoredView(raw: unknown): BvaView | null {
  if (raw === 'months' || raw === 'statement' || raw === 'activity') return raw;
  if (raw === 'categories') return 'statement';
  return null;
}

/**
 * Money in a report cell. ⚠ A negative reads as BRACKETS, never a minus sign — the notation the
 * budget importer already understands, so the product has one and not two (money-back plan §4.3).
 *
 * ⚠ THE SHARED FORMATTER, not a second bracket rule. `fmtBrackets` (lib/coach-money-summary.ts) is
 * what the settlement sheet, the payout sheet, the Money overview and the money rail already print
 * accounting negatives with; a local re-derivation would be the same convention maintained in two
 * places. The half-cent deadband is this screen's own: a rounding tail must not render `($0.00)`
 * beside figures a coach can see are equal.
 */
function fmtCell(n: number): string {
  return Math.abs(n) <= 0.005 ? fmt(0) : fmtBrackets(n);
}

/**
 * ⚠⚠ VARIANCE READS DIFFERENTLY IN EACH SECTION, AND THAT IS THE FIX, NOT A QUIRK.
 *
 * Over budget is good news on income and bad news on a cost. The retired design ran both formulas
 * behind one column heading, distinguished only by a two-letter IN/OUT tag — registration revenue
 * showed `+$400` meaning *actual − budget* while entry fees showed `+$150` meaning *budget −
 * actual*, both green, both positive. The arithmetic is settled in the rollup (always
 * good-news-positive); what is settled HERE is the wording, which is what a reader actually uses:
 * revenue varies **up and down**, costs run **over and under**.
 *
 * ⚠ COLOUR NEVER CARRIES IT ALONE. Our overrun and healthy tones are near-identical to a deutan
 * eye, so the sign and the word do the work and the hue is decoration on top.
 */
function varianceText(v: number, direction: 'in' | 'out', actual?: number): string {
  if (Math.abs(v) <= 0.005) return '—';
  if (direction === 'in') return fmtVariance(v);
  /* ⚠⚠ A NEGATIVE COST NEVER READS AS "UNDER BUDGET" — the plan warned about this by name (§4.5:
     "the over/under styling must cope, or a negative renders as a triumphant 'under budget'"), and
     the arithmetic walks straight into it: an item budgeted $0 that took $150 back has an actual of
     −$150 and therefore a variance of +$150, which the wording below would print as "$150 under",
     indistinguishable from an ordinary underspend. It is not an underspend — nothing was spent.
     The bracketed actual beside it is the fact worth reading, and it is almost always the signal
     the refund is filed against the wrong item, so the variance says nothing rather than something
     congratulatory (/review, correctness lens).
     ⚠ SINCE 2026-09-02 (owner D5.4) THE GUARD PRINTS "refund only" RATHER THAN A BARE EM-DASH —
     the odd refund is named, not hidden, and the muted ink (see `varianceInk`) keeps it from
     reading as a verdict. */
  if (actual != null && actual < -0.005) return 'refund only';
  return `${fmt(v)} ${v > 0 ? 'under' : 'over'}`;
}

/**
 * The colour that goes WITH `varianceText` — the pair travels together, or the "refund only"
 * guard word would arrive painted in the success green its variance happens to compute to.
 */
function varianceInk(v: number, direction: 'in' | 'out', actual?: number): string {
  if (direction === 'out' && actual != null && actual < -0.005 && Math.abs(v) > 0.005) {
    return 'var(--home-ink-soft, rgba(255,255,255,0.6))';
  }
  return varianceColor(v);
}

// The category table's columns and rows are NOT declared here — they live in
// `lib/coach-money-exports` beside the Money hub's own "Budget vs. actual" export, so the two
// cannot become two different spreadsheets. Only the MONTH-GRID export is local to this file,
// because its shape depends on the view and lens the coach chose (rule 12).

/** Money to the cent, once for the whole module — three local copies of this lambda had
 *  accumulated by the time `/simplify` looked (2026-09-02). */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ⚠ STRIPS THE SIGN — every screen caller prints its own (`fmtVariance`, the headroom's ±). */
function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The same figure with its sign kept — for anywhere nothing else supplies one, i.e. a file. */
function fmtSigned(n: number) {
  return n < 0 ? `-${fmt(n)}` : fmt(n);
}

function fmtMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(month, 10) - 1]} '${year.slice(2)}`;
}

function varianceColor(v: number): string {
  if (v > 0.005) return 'var(--success-light)';
  if (v < -0.005) return 'var(--danger-light)';
  return 'var(--home-ink-soft, rgba(255,255,255,0.6))';
}

/** A variance's sign, on the same half-cent deadband as its colour — the two must agree, and
 *  five hand-written copies of the ternary were one epsilon edit away from disagreeing. */
function signPrefix(v: number): string {
  if (v > 0.005) return '+';
  if (v < -0.005) return '-';
  return '';
}

/** A variance rendered whole: sign, then magnitude. */
function fmtVariance(v: number): string {
  return `${signPrefix(v)}${fmt(Math.abs(v))}`;
}

/** "2026-03" → "Mar" — the bare name the chart's middle labels carry (G3: only the edges keep
 *  their year). Derived from `fmtMonth` rather than a fourth copy of the month-name array. */
function fmtMonthBare(yyyyMm: string): string {
  return fmtMonth(yyyyMm).split(' ')[0];
}

/**
 * The cumulative spending-vs-plan chart, as approved at the G3 gate (2026-09-02):
 *  · about half its old height — it lives in a shelf now, not at the head of the page;
 *  · the FIRST month label anchors `start` and the LAST anchors `end`, both keeping their year —
 *    the fix for the owner-spotted clipped "Sep '2" (the old code centred the last label on a
 *    point ~22px from the viewBox edge, so half of it escaped and clipped at the container);
 *  · the flatline marker (D5.8): where the budgeted line goes flat because the rest of the plan
 *    has no date, the chart says so at the kink instead of letting the plateau read as a plan;
 *  · the legend moved OUT of the SVG (see the shelf) so it never scales away on a phone.
 */
function CumulativeChart({ data, undatedBudget }: { data: MonthlyPoint[]; undatedBudget: number }) {
  if (data.length === 0) return null;

  const VW = 760, VH = 120;
  const ML = 64, MR = 16, MT = 14, MB = 26;
  const CW = VW - ML - MR;
  const CH = VH - MT - MB;

  const maxVal = Math.max(...data.map(d => Math.max(d.cumBudget, d.cumActual)), 1);
  const n = data.length;

  function xPos(i: number) {
    return ML + (n === 1 ? CW / 2 : (i / (n - 1)) * CW);
  }
  function yPos(v: number) {
    return MT + (1 - v / maxVal) * CH;
  }

  const budgetPoints = data.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.cumBudget).toFixed(1)}`);
  const actualPoints = data.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.cumActual).toFixed(1)}`);

  const budgetPath = `M ${budgetPoints.join(' L ')}`;
  const actualPath = `M ${actualPoints.join(' L ')}`;
  const areaPath   = `M ${xPos(0).toFixed(1)},${(MT + CH).toFixed(1)} L ${actualPoints.join(' L ')} L ${xPos(n - 1).toFixed(1)},${(MT + CH).toFixed(1)} Z`;

  /* ⚠ NO CENTS ON AN AXIS, and this is a clipping fix rather than a taste one. The labels are
     right-anchored at `ML - 4` = 60px, so a full "$11,000.00" at 10px runs past the left edge of
     the viewBox and is cut — caught by the rendered sweep at 1440 the moment this fixture's plan
     gained dates and the axis climbed above $9,999. Cents on a gridline were never information
     anyway: the axis says the SCALE, and every exact figure is in the table above it. */
  const gridLines = [0.5, 1].map(ratio => ({
    y: MT + (1 - ratio) * CH,
    label: fmt(Math.round(maxVal * ratio)).replace(/\.00$/, ''),
  }));

  /* The last month the PLAN placed money in — after it the budgeted line runs flat, and when the
     plan still holds undated dollars that plateau is a statement about DATES, not about the plan
     being finished. The marker only appears when both are true. */
  let kink = -1;
  data.forEach((d, i) => { if (Math.abs(d.budgetedForMonth) > 0.005) kink = i; });
  const showFlatline = undatedBudget > 0.005 && kink >= 0 && kink < n - 1;
  const flatlineAtEnd = kink >= 0 && xPos(kink) > VW - 190;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* SVG presentation attributes can't resolve var(); colours live in inline style
          so the warm gate reaches them. Fallbacks keep dark byte-identical. */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={ML} y1={g.y} x2={ML + CW} y2={g.y}
            style={{ stroke: 'var(--home-line, rgba(255,255,255,0.06))' }} strokeWidth="1" />
          <text x={ML - 4} y={g.y + 4} textAnchor="end" fontSize="10"
            style={{ fill: 'var(--home-dim, rgba(255,255,255,0.3))' }}>{g.label}</text>
        </g>
      ))}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH}
        style={{ stroke: 'var(--home-line-strong, rgba(255,255,255,0.12))' }} strokeWidth="1" />

      <path d={areaPath} style={{ fill: 'color-mix(in srgb, var(--success-light) 7%, transparent)' }} />
      <path d={budgetPath} style={{ stroke: 'var(--info-light)' }} strokeWidth="2" fill="none"
        strokeDasharray="5,3" opacity="0.7" />
      <path d={actualPath} style={{ stroke: 'var(--success-light)' }} strokeWidth="2" fill="none" />

      {data.map((d, i) => (
        <circle key={i} cx={xPos(i)} cy={yPos(d.cumActual)} r="3" style={{ fill: 'var(--success-light)' }} />
      ))}

      {showFlatline && (
        <text
          x={flatlineAtEnd ? xPos(kink) - 6 : xPos(kink) + 6}
          y={Math.max(MT + 9, yPos(data[kink].cumBudget) - 7)}
          textAnchor={flatlineAtEnd ? 'end' : 'start'}
          fontSize="10"
          style={{ fill: 'var(--warning-light)' }}
        >
          ⌇ rest of plan has no date
        </text>
      )}

      {data.map((d, i) => {
        const last = n - 1;
        const isEdge = i === 0 || i === last;
        /* Middles thin out when crowded, and the one beside the end-anchored last label always
           yields to it; the EDGES always render — the whole point of the anchor fix. */
        if (!isEdge && n > 8 && (i % 2 !== 0 || i === last - 1)) return null;
        return (
          <text
            key={i}
            x={xPos(i)}
            y={VH - 6}
            textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
            fontSize="10"
            style={{ fill: 'var(--home-dim, rgba(255,255,255,0.35))' }}
          >
            {isEdge ? fmtMonth(d.month) : fmtMonthBare(d.month)}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * How a category is addressed for expand state, React keys and `aria-describedby`.
 *
 * ⚠ THE DIRECTION IS PART OF THE KEY: one category appears in BOTH sections of the statement, and
 * keying by name alone would give those two rows one shared toggle.
 *
 * ⚠ AND SO IS THE ID. The rollup buckets by category ID when there is one, so a club that has
 * created its own "Officials" alongside the platform's gets two legitimate rows with the same name
 * and the same direction — which a name-only key collapsed into one React key, one expand toggle
 * and one duplicated element id, so opening either opened both (/review, correctness lens). This
 * is the same collision the route's own `learnCategory` fix chased in 2026-08-15, one layer up.
 */
function catKeyOf(cat: CategoryResult): string {
  return `${cat.direction}|${cat.categoryId ?? `name:${cat.categoryName}`}`;
}

/** Which side of the row a coach asked about: the plan, or what actually moved. */
type BehindSide = 'plan' | 'actual';

/**
 * WHAT IS BEHIND THIS FIGURE — one panel, both columns (owner ruling 2026-09-04, QA §132 round
 * three).
 *
 * ⚠ THE PLAN HALF EXISTED AND THE ACTUAL HALF DID NOT, which is the whole finding. The month grid
 * had solved "which lines?" and the statement had not; that was fixed the day before by making the
 * "N lines" caption a door. But the ACTUAL column had never had an answer at all — its only
 * explanation was a permanent "$815.00 paid · $125.00 back" sub-row, which named two totals and no
 * records. A report that will name the plan lines behind a budget figure and refuses to name the
 * payments behind an actual one is answering half of its own question.
 *
 * ⚠⚠ IT IS A `QuestionShell`, NOT A HAND-ROLLED OVERLAY (`/review`, 2026-09-04). The first cut
 * copied the markup of the modal it grew out of — a bare overlay div with a header and a close
 * button — which meant it had NONE of the floor every other money overlay stands on: no
 * `role="dialog"`, no focus into the panel, no Tab trap, no Escape, no focus returned to the
 * figure that opened it. **A coach who opened this with the keyboard could not close it with the
 * keyboard**, and a screen reader could tab straight through the panel into the table underneath,
 * which is only visually covered. This is the exact defect class the §134 walk found on the bill
 * room, and the shared shell exists because of it — so it is used rather than re-derived.
 *
 * ⚠⚠ THE PLAN LIST LINKS AND THE ACTUAL LIST DOES NOT, and that asymmetry is deliberate rather
 * than unfinished. A budget line is one editable record with a stable id, so the panel can open it.
 * A movement is not: a commitment contributes one entry PER INSTALMENT, club money arrives under a
 * synthetic id, and a derived pool is a name with no record behind it at all ("From your
 * fundraisers"). Linking those would mean four kinds of door, three of which 404 — the politer face
 * of a dead end, which is the thing this whole change removes. The list states; Transactions is
 * where a coach edits.
 */
function RecordsBehind({ item, side, base, canWrite, onClose }: {
  item: ItemResult;
  side: BehindSide;
  base: string;
  canWrite: boolean;
  onClose: () => void;
}) {
  const moved = item.direction === 'in' ? 'received' : 'paid';
  return (
    <QuestionShell
      open
      onClose={onClose}
      /* Names the panel for assistive tech, and says which of the two questions it is answering —
         "Umpire Fees" alone would read identically from either figure. */
      ariaLabel={side === 'plan'
        ? `What ${item.itemName} plans`
        : `What ${item.itemName} has actually ${moved}`}
      title={item.itemName}
      scroll
    >
      <>
        {side === 'plan' ? (
          <>
            {/* The figure is the answer; the lines are listed directly underneath it. Counting
                them here was the same over-explaining the row caption was removed for (owner,
                2026-09-04, QA §133) — a sentence telling you the length of the list you are
                looking at. */}
            <p className={styles.linesBehindSub}>
              <strong>{fmt(item.budgeted)}</strong> planned
            </p>
            <ul className={styles.linesBehindList}>
              {(item.lines ?? []).map(l => (
                <li key={l.id}>
                  {canWrite ? (
                    <Link
                      href={moneySectionHref(base, 'budget', { line: l.id })}
                      className={styles.linesBehindRow}
                      onClick={onClose}
                      title={`Open ${l.description}`}
                    >
                      <span className={styles.linesBehindWho}>
                        {l.description}
                        {l.notes && <span className={styles.linesBehindNote}>{l.notes}</span>}
                      </span>
                      <span className={styles.linesBehindAmt}>{fmt(l.totalAmount)}</span>
                    </Link>
                  ) : (
                    <span className={styles.linesBehindRow}>
                      <span className={styles.linesBehindWho}>
                        {l.description}
                        {l.notes && <span className={styles.linesBehindNote}>{l.notes}</span>}
                      </span>
                      <span className={styles.linesBehindAmt}>{fmt(l.totalAmount)}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className={styles.linesBehindFoot}>
              These are shown as one row because they name the same item.
              {canWrite ? ' Open one to edit it.' : ''}
            </p>
          </>
        ) : (
          <>
            {/* ⚠ THE TWO FIGURES THE DELETED SUB-ROW CARRIED, IN THE ONE PLACE THEY EXPLAIN
                SOMETHING. On the row they were an unexplained pair; here they are the total of the
                list directly beneath them. A row with nothing back keeps a single figure — the
                "· $0.00 back" half would be furniture. */}
            {/* ⚠ THREE SHAPES, NOT TWO (`/review`, 2026-09-04). The pair reads as a contradiction
                on a row that holds ONLY money back — "$0.00 paid · $125.00 back" says money came
                back from something that cost nothing — and that row is not hypothetical: it is
                what the table itself already calls "refund only", so the panel has to speak the
                same words the row does. */}
            <p className={styles.linesBehindSub}>
              {item.refundTotal > 0.005 && item.grossActual < 0.005 ? (
                <><strong>{fmt(item.refundTotal)}</strong> back — refund only, nothing {moved} against this row</>
              ) : item.refundTotal > 0.005 ? (
                <>
                  <strong>{fmt(item.grossActual)}</strong> {moved} · <strong>{fmt(item.refundTotal)}</strong> back
                </>
              ) : (
                <><strong>{fmt(item.grossActual)}</strong> {moved}</>
              )}
            </p>
            <ul className={styles.linesBehindList}>
              {(item.costs ?? []).map(c => (
                <li key={c.id}>
                  <span className={styles.linesBehindRow}>
                    <span className={styles.linesBehindWho}>
                      {c.description || 'No description'}
                      <span className={styles.linesBehindNote}>
                        {c.paidDate ? formatStoredDate(c.paidDate, { withYear: false }) : 'no date recorded'}
                      </span>
                    </span>
                    <span className={styles.linesBehindAmt}>{fmt(c.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {/* ⚠ MONEY BACK IS LISTED APART, NEVER MERGED INTO THE PAYMENTS. Merging them would
                hide which records were spending and which were repayment — one of those is the
                out-of-pocket trap the money-back plan's §2 exists to keep apart — and the amounts
                pull in opposite directions, so one list would not add up to anything. */}
            {item.refunds.length > 0 && (
              <>
                <p className={styles.behindGroup}>Money back, netted off the figure above</p>
                <ul className={styles.linesBehindList}>
                  {item.refunds.map(r => (
                    <li key={r.id}>
                      <span className={styles.linesBehindRow}>
                        <span className={styles.linesBehindWho}>
                          {r.description || 'No description'}
                          <span className={styles.linesBehindNote}>
                            {r.receivedDate ? formatStoredDate(r.receivedDate, { withYear: false }) : 'no date recorded'}
                          </span>
                        </span>
                        <span className={styles.linesBehindAmt}>−{fmt(r.amount)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className={styles.linesBehindFoot}>
              Every payment counted against this row, on the day it happened — whoever paid it.
              {canWrite ? ' Edit them on Transactions.' : ''}
            </p>
          </>
        )}
      </>
    </QuestionShell>
  );
}

/**
 * The item rows of one category — shared by both shapes, so the statement and the by-activity
 * lens can never render one row two different ways.
 *
 * ⚠⚠ EVERY FIGURE ON THE ROW IS A DOOR, AND THE ROW ITSELF OPENS (owner ruling 2026-09-04,
 * QA §132 round three). Three things were wrong at once and they were one thing:
 *   · the ACTUAL figure explained itself with a permanent sub-row — "$815.00 paid · $125.00 back" —
 *     hanging under a row that, for an item with no dated periods, had no expander at all. It read
 *     as the expansion of something that could not be expanded, and it was WHITE against the tint
 *     of the rows above it. Worse, it was the only thing the Actual column ever said: WHICH
 *     payments made that figure was unanswerable on this screen under every data shape.
 *   · the BUDGET figure had a door ("N lines") and the actual figure did not, so one report
 *     answered "what is behind this number?" on one column and refused on the other.
 *   · the category bar opened on a click anywhere; the item row opened only on its 13px chevron.
 * Both figures now open the same shape of panel, the whole row toggles its schedule, and the
 * sub-row is gone — its two figures moved INTO the panel, where they are the sentence naming what
 * the list adds up to.
 */
function ItemRows({
  cat, expandedLines, toggleLine, openBehind,
}: {
  cat: CategoryResult;
  expandedLines: Set<string>;
  toggleLine: (id: string) => void;
  /** Opens "what is behind this figure?" for one side of the row — see `RecordsBehind`. */
  openBehind: (item: ItemResult, side: BehindSide) => void;
}) {
  const catKey = catKeyOf(cat);
  return (
    <>
      {cat.items.map(item => {
        const key = `${catKey}|${item.itemId ?? 'none'}`;
        const open = expandedLines.has(key);
        const canExpand = item.periods.length > 0;
        /* What each figure has to SHOW, which is not the same as whether it is non-zero: a row can
           hold only money back (actual negative, nothing "paid"), and an unplanned row has no lines
           at all. A figure with an empty list behind it stays a plain number — a door onto nothing
           is the politer face of the same dead end this change exists to close. */
        /* ⚠⚠ `item.lines?.length`, NOT `.length` — see the field's own note. This predicate runs
           on every row of the statement, so an unguarded read against a stale payload would not
           merely break the panel, it would take the whole table down before a figure rendered. */
        const planBehind = (item.lines?.length ?? 0) > 0;
        /* ⚠ `item.costs?.length`, NOT `.length` — same deploy-skew note as `lines`, and the same
           predicate position: this runs unconditionally for every row. `refunds` needs no guard,
           it was never stripped. */
        const actualBehind = (item.costs?.length ?? 0) > 0 || item.refunds.length > 0;
        return (
          <Fragment key={key}>
            {/* The whole row opens its schedule, matching the category bar above it. The chevron stays
                the SEMANTIC control — keyboard and screen reader reach the fold through it — and the
                row is the pointer/touch shortcut. Every control inside stops propagation, so
                opening a panel never also folds the row underneath it.

                ⚠⚠ THIS DOES **NOT** MATCH THE BUDGET PLAN'S ROWS, AND THE DIFFERENCE IS DELIBERATE
                (owner ruling 2026-09-05). This comment claimed it did — wrongly, and for long enough
                that the claim was cited as precedent. Over there the row opens the EDITOR; here it
                folds. The reason is the job each screen does:
                  · This is the REPORT. Nothing on it can be edited, most rows have figures behind
                    them, and folding is the only thing a tap could mean.
                  · The plan tab is the WORKLIST. Its pencil is clipped out of the layout on a phone
                    (its own ruling), so the row is the ONLY edit door a thumb has; and its chevron
                    exists only on lines split across two or more periods — "One month" and
                    "No date yet" have nothing to open — so row-to-fold would be a dead gesture on
                    most rows and on every row of the coach demo's mid-season plan.
                Reading a plan line's split is served over there by its WHEN CELL, which folds the row
                the same way this one does. Before "aligning" the two screens, re-read those two
                bullets — they are why they differ. */}
            <div
              className={`${shared.ledgerRow} ${styles.lineMain} ${item.inPlan ? '' : styles.unplannedRow} ${canExpand ? shared.rowTappable : ''}`}
              // Selecting text to copy an amount must not toggle the row — a click that ends a
              // selection is a copy gesture, not a tap (the same guard the plan page carries).
              onClick={canExpand ? () => { if (window.getSelection()?.toString()) return; toggleLine(key); } : undefined}
            >
              <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
                {canExpand ? (
                  <button
                    className={shared.ledgerExpand}
                    aria-expanded={open}
                    aria-label={open ? `Hide ${item.itemName}'s periods` : `Show ${item.itemName}'s periods`}
                    onClick={e => { e.stopPropagation(); toggleLine(key); }}
                  >
                    {open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                  </button>
                ) : (
                  <span className={shared.ledgerExpandSpacer} />
                )}
                <span className={shared.ledgerDesc}>{item.itemName}</span>
                {/* ⚠⚠ THE "N lines" CAPTION IS GONE — FROM EVERY SURFACE (owner ruling 2026-09-04,
                    QA §133), together with its twins on the Budget list and the by-period grid. It
                    had changed hands three times in three days: a caption, then a door, then a
                    caption again, each time argued from "nothing else on the row says the row is a
                    merge". The owner ended the argument by rejecting its premise — *"we can spiral
                    with logic like that; I don't know how much gas is in my car until I turn it on"*.
                    Nothing bad happens when a coach opens a row and only then sees two lines. The
                    words were over-explaining, and over-explaining is what fills these screens with
                    text a coach has to read past.
                    ⚠ The build enforces the absence: tests/unit/bva-figure-doors-guard.test.ts. If
                    you are about to re-add it in ANY form, that test is where to argue first. */}
                {/* ⚠⚠ THE VISIBLE "not planned" WORD IS GONE (owner ruling 2026-09-04, QA §132
                    round three) — a deliberate RE-REVERSAL of D5.5 (2026-09-02), taken on the built
                    screen rather than on a plan, and the help article had been carrying the owner's
                    reason all along before D5.5 briefly contradicted it: *the empty Budget figure is
                    the whole answer*. THREE signals were saying one thing — a tinted row, a dash
                    where a number goes, and a word — and the tint was reading as GROUPING rather
                    than status precisely because the word beside it carried the meaning. The tint
                    stays and keeps the row honest at a glance; the dash states it exactly.
                    ⚠ THE SENTENCE STAYS FOR A SCREEN READER, because a tint and a dash are not
                    readable — the same reason the category header carries one. */}
                {!item.inPlan && (
                  <span className={styles.srOnly}> — not planned</span>
                )}
              </span>
              {/* ⚠ BOTH FIGURES ARE THE SAME CONTROL. They differ only in which list they open, so
                  a coach meeting them has one habit to learn rather than two. */}
              <span className={`${shared.ledgerNum} ${item.inPlan ? '' : shared.ledgerNumMuted}`}>
                {item.inPlan && planBehind ? (
                  <button
                    type="button"
                    className={styles.figureBtn}
                    onClick={e => { e.stopPropagation(); openBehind(item, 'plan'); }}
                    title={`See what ${item.itemName} plans`}
                  >
                    {fmt(item.budgeted)}
                  </button>
                ) : item.inPlan ? fmt(item.budgeted) : '—'}
              </span>
              <span className={shared.ledgerNum}>
                {actualBehind ? (
                  <button
                    type="button"
                    className={styles.figureBtn}
                    onClick={e => { e.stopPropagation(); openBehind(item, 'actual'); }}
                    title={`See what ${item.itemName} has actually cost`}
                  >
                    {fmtCell(item.actual)}
                  </button>
                ) : fmtCell(item.actual)}
              </span>
              <span className={shared.ledgerNum} style={{ color: varianceInk(item.variance, item.direction, item.actual) }}>
                {varianceText(item.variance, item.direction, item.actual)}
              </span>
            </div>

            {open && canExpand && (
              <div className={shared.ledgerSubRows}>
                {item.periods.map((p, pi) => {
                  const moved = Math.abs(p.actual) > 0.005;
                  const variance = item.direction === 'in' ? p.actual - p.amount : p.amount - p.actual;
                  return (
                    <div key={pi} className={`${shared.ledgerSubRow} ${styles.periodRow}`}>
                      <span className={`${shared.ledgerSubLabel} ${shared.scrollXStickyCell} ${shared.wrap640}`}>{p.label}</span>
                      <span className={shared.ledgerSubMeta}>
                        {p.date ? formatStoredDate(p.date) : ''}
                      </span>
                      <span className={shared.ledgerNum}>{fmt(p.amount)}</span>
                      <span
                        className={`${shared.ledgerNum} ${moved ? '' : shared.ledgerNumMuted}`}
                        style={moved && p.actual > 0 ? { color: 'var(--success-light)' } : undefined}
                      >
                        {moved ? fmtCell(p.actual) : '—'}
                      </span>
                      <span
                        className={`${shared.ledgerNum} ${moved ? '' : shared.ledgerNumMuted}`}
                        style={moved ? { color: varianceInk(variance, item.direction, p.actual) } : undefined}
                      >
                        {/* The same negative guard as the row above: the September period of a
                            refunded item has a negative actual, and "under" would be wrong there
                            for exactly the same reason. */}
                        {moved ? varianceText(variance, item.direction, p.actual) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/** A category: its collapsible header, then its items. */
function CategoryGroup({
  cat, expandedCats, toggleCat, expandedLines, toggleLine, openBehind,
}: {
  cat: CategoryResult;
  expandedCats: Set<string>;
  toggleCat: (id: string) => void;
  expandedLines: Set<string>;
  toggleLine: (id: string) => void;
  openBehind: (item: ItemResult, side: BehindSide) => void;
}) {
  const catKey = catKeyOf(cat);
  /* ⚠ A CATEGORY NOBODY BUDGETED FOR IS THE POINT, NOT AN EDGE CASE (owner ruling 2026-08-15). It
     carries no Budgeted figure at all, so the row is flagged and the dash is explained by the flag
     rather than left to read as a lost number. The sentence rides the header via aria-describedby:
     a screen reader meeting a bare em-dash would otherwise get no explanation, because the flag is
     a visual one (/review, 2026-08-15). */
  const noteId = cat.inPlan ? undefined : `bva-cat-note-${catKey.replace(/\W+/g, '-')}`;
  return (
    <div className={shared.ledgerGroup}>
      <button
        className={`${shared.ledgerGroupHead} ${shared.ledgerGroupHeadBtn} ${styles.categoryHeader} ${cat.inPlan ? '' : styles.unplannedRow}`}
        aria-expanded={expandedCats.has(catKey)}
        aria-describedby={noteId}
        onClick={() => toggleCat(catKey)}
      >
        <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
          <span className={styles.expandIcon}>
            {expandedCats.has(catKey) ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          </span>
          <span className={shared.ledgerName}>{cat.categoryName}</span>
          {/* No visible "not planned" word here either — see the item rows' note. The header
              already carries the sentence for a screen reader through `aria-describedby` below,
              which is why this one needed no replacement. */}
        </span>
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong} ${cat.inPlan ? '' : shared.ledgerNumMuted}`}>
          {cat.inPlan ? fmt(cat.budgeted) : '—'}
        </span>
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>{fmtCell(cat.actual)}</span>
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`} style={{ color: varianceInk(cat.variance, cat.direction, cat.actual) }}>
          {varianceText(cat.variance, cat.direction, cat.actual)}
        </span>
      </button>
      {noteId && (
        <p id={noteId} className={styles.srOnly}>
          Nothing in {cat.categoryName} was budgeted for this season.
        </p>
      )}
      {expandedCats.has(catKey) && (
        <div>
          <ItemRows cat={cat} expandedLines={expandedLines} toggleLine={toggleLine} openBehind={openBehind} />
        </div>
      )}
    </div>
  );
}

/** A REVENUE / EXPENSES band, or an activity's own name. */
/**
 * WHY THIS STATEMENT'S TOTAL IS NOT THE TEAM'S BANK BALANCE (owner ruling 2026-08-24, Option A,
 * drawn at `claude.ai/code/artifact/4a160131-fea3-4f6b-99f4-4f9217932ee6`).
 *
 * The Statement is what the season SPENT; Months is what the CASH DID. They differ by design, and
 * until now only Months explained it — in a footnote, on the half a board never opens. **The
 * Statement is what gets exported to a meeting**, which is exactly where the question gets asked
 * and where nobody can ask a follow-up.
 *
 * ⚠ IT IS A RECONCILIATION, NOT A SENTENCE. Start at one figure, list the adjustments, arrive at the
 * other — the shape the question already has, and the shape a treasurer can defend line by line.
 *
 * ⚠⚠ IT RENDERS ONLY WHEN THERE IS A GAP. A team with no family-paid cost, no payout and no money
 * back has two identical totals, and a bridge saying "no difference" is furniture. This is also why
 * the arithmetic is not hidden behind a flag: the row's own presence IS the claim.
 *
 * ⚠ EVERY FIGURE HERE ALREADY EXISTED except the family-paid list, which is reported by the cash
 * arithmetic that excluded it. Nothing is re-derived, so the bridge cannot disagree with either view.
 */
/**
 * ⚠⚠ THE THREE ADJUSTMENTS BETWEEN "WHAT THE SEASON SPENT" AND "WHAT THE CASH DID", DERIVED ONCE.
 *
 * Two bridges now walk this gap in opposite directions — the Statement's (spend → cash) and the
 * Months view's (plan-against-cash → plan-against-spend) — and they are the same three facts read
 * from either end. Written out twice they would be one edit away from disagreeing in front of a
 * board, which is the exact defect class this report has been consolidated twice to remove; the
 * screen and the export having had two different formulas for `hasUndated` is the precedent.
 *
 * ⚠ EVERY FIGURE IS READ, NOT RE-DERIVED. `familyPaidCosts` is reported by the cash arithmetic that
 * excluded it, the refunds are the statement's own netting, and the payouts are the returned band's
 * total — so a bridge can never contradict the table above it.
 */
function cashAdjustments(data: BvaData) {
  /** Season spending that was never team cash — a parent paid the vendor. */
  const familyPaid = r2(data.familyPaidCosts.reduce((s, c) => s + c.amount, 0));
  /* Money back NETS INTO the cost it repaid on the statement; in cash it is an arrival on the
     revenue side, so it never reduced the cash that went out. */
  const moneyBack = r2(data.report.expenses.categories
    .flatMap(c => c.items).reduce((s, i) => s + (i.refundTotal ?? 0), 0));
  /* ⚠ THE RETURNED BAND'S OWN TOTAL (2026-09-02). This read `monthGrid.categories` filtered on the
     payouts group until that group became a band of its own — a filter that now matches nothing and
     would have quietly reported every season as having handed back $0, breaking the Statement's
     bridge by exactly the amount it exists to explain. */
  const payouts = r2(data.returnedGrid.totals.total.actual);
  /**
   * ⚠ `monthGrid` IS NO LONGER THE WHOLE OF CASH OUT. It is what the team paid VENDORS; the cheques
   * to families are the returned band. Anything answering "what left the account" adds both.
   */
  const cashOut = r2(data.monthGrid.totals.total.actual + payouts);
  /* ⚠ NO SHARED `delta` HERE, AND THAT IS DELIBERATE (found in review, 2026-09-02). One was written —
     `moneyBack − familyPaid + payouts` — documented as "the gap both bridges cross". It is not: the
     Months tie-out crosses `moneyBack − familyPaid`, because payouts are no part of Total expenses.
     Neither caller ever read it, so it was inert; it is deleted rather than re-worded because a
     dead field with a persuasive name is an invitation to a wrong DRY-up, and this helper's own
     header argues for exactly that consolidation. Each bridge states its own gap. */
  return { familyPaid, moneyBack, payouts, cashOut };
}

/**
 * A family-paid cost as either bridge itemizes it — one spelling of the line, dated (owner D5.2).
 * "less $660" is not an answer a coach can take to a board: WHICH costs, and WHEN, is the question.
 */
function familyPaidSub(c: BvaData['familyPaidCosts'][number]): { id: string; label: string; amount: number } {
  return {
    id: c.id,
    label: [
      c.categoryName, c.description,
      c.date ? formatStoredDate(c.date, { withYear: false }) : null,
    ].filter(Boolean).join(' · '),
    amount: c.amount,
  };
}

/**
 * The walk's three conditional lines — which fire, what they are called, in what order — decided
 * ONCE for the on-screen bridge and the exported reconciliation (`/simplify`, 2026-09-02: the two
 * had been typed out twice, which is the exact label-drift this file's "ONE NAME FOR ONE THING"
 * note already records happening before).
 *
 * ⚠ THE ITEMISATION TRAVELS WITH THE LINE IT EXPLAINS. Rendered as a separate pass it landed at
 * the foot of the list, under whichever adjustment happened to be last — so "Officials · $599"
 * read as a breakdown of *money paid back to families*.
 * ⚠ ONE NAME FOR ONE THING: 'money returned to families' is the band's own phrase — an earlier
 * draft said 'money paid back to families' here while the band it describes had been renamed.
 */
function cashBridgeLines(data: BvaData): Array<{ label: string; amount: number; subs?: Array<{ id: string; label: string; amount: number }> }> {
  const { familyPaid, moneyBack, payouts } = cashAdjustments(data);
  const lines: Array<{ label: string; amount: number; subs?: Array<{ id: string; label: string; amount: number }> }> = [];
  if (moneyBack > 0.005) lines.push({ label: 'Plus money back, counted in cash as money arriving', amount: moneyBack });
  if (familyPaid > 0.005) {
    lines.push({
      label: 'Less costs a family paid the vendor',
      amount: -familyPaid,
      subs: data.familyPaidCosts.map(familyPaidSub),
    });
  }
  if (payouts > 0.005) lines.push({ label: 'Plus money returned to families', amount: payouts });
  return lines;
}

/**
 * ⚠ PROMOTED FROM A COLLAPSED QUESTION TO A VISIBLE SENTENCE (owner D5.3, 2026-09-02). The old
 * `<details>` summary asked "why the difference?" — which only helps a reader who had already
 * noticed one. The cash figure and its causes are now stated out loud; the walk-through stays
 * behind one press for the reader who wants the arithmetic line by line.
 */
function CashBridge({ data, onSeeMonths }: { data: BvaData; onSeeMonths: () => void }) {
  const [walkOpen, setWalkOpen] = useState(false);
  const { familyPaid, moneyBack, payouts, cashOut } = cashAdjustments(data);

  if (familyPaid < 0.005 && moneyBack < 0.005 && payouts < 0.005) return null;
  const lines = cashBridgeLines(data);

  /* The sentence's causes, in the walk's own order — approved wording at the G3 gate mockup
     ("a family paid one cost directly, and some money came back"). */
  const causes: string[] = [];
  if (familyPaid > 0.005) {
    causes.push(data.familyPaidCosts.length === 1
      ? 'a family paid one cost directly'
      : `families paid ${data.familyPaidCosts.length} costs directly`);
  }
  if (moneyBack > 0.005) causes.push('some money came back');
  if (payouts > 0.005) causes.push('money went back to families');
  const causeSentence = causes.length === 1 ? causes[0]
    : causes.length === 2 ? `${causes[0]}, and ${causes[1]}`
      : `${causes[0]}, ${causes[1]}, and ${causes[2]}`;

  return (
    <div className={styles.bridge}>
      <p className={styles.bridgeSentence}>
        In cash, this season spent <strong>{fmt(cashOut)}</strong> — {causeSentence}.{' '}
        <button
          type="button"
          className={styles.bridgeLink}
          onClick={() => setWalkOpen(o => !o)}
          aria-expanded={walkOpen}
        >
          {walkOpen ? 'Hide the walk-through' : 'See the walk-through'}
        </button>
      </p>
      {walkOpen && (
        <div className={styles.bridgeBody}>
          <dl className={styles.bridgeList}>
            <div className={styles.bridgeRow}>
              <dt>What this season spent</dt><dd>{fmt(data.totalActual)}</dd>
            </div>
            {lines.map(l => (
              <Fragment key={l.label}>
                <div className={styles.bridgeRow}>
                  <dt>{l.label}</dt>
                  <dd>{l.amount < 0 ? `−${fmt(Math.abs(l.amount))}` : `+${fmt(l.amount)}`}</dd>
                </div>
                {l.subs?.map(s => (
                  <div className={`${styles.bridgeRow} ${styles.bridgeSub}`} key={s.id}>
                    <dt>{s.label}</dt>
                    <dd>{fmt(s.amount)}</dd>
                  </div>
                ))}
              </Fragment>
            ))}
            <div className={`${styles.bridgeRow} ${styles.bridgeOut}`}>
              <dt>Cash that left the team&apos;s account</dt><dd>{fmt(cashOut)}</dd>
            </div>
          </dl>
          <button type="button" className={styles.bridgeLink} onClick={onSeeMonths}>See it by month</button>
        </div>
      )}
    </div>
  );
}

/**
 * THE MONTHS VIEW'S TIE-OUT TO HEADROOM (owner ruling 2026-09-02).
 *
 * ⚠⚠ IT IS THE CASH BRIDGE WALKED BACKWARDS, AND THAT IS WHY IT EXISTS. The Statement has explained
 * its own gap since 2026-08-24; the Months view — where a treasurer actually goes looking, and where
 * Headroom sits three inches above a Total expenses that disagrees with it — never has. Two figures
 * on one screen that cannot both be right, with nothing on the screen saying they are.
 *
 * ⚠ TWO LINES NOW, NOT THREE. Money paid back to families left `Total expenses` for its own band, so
 * it left this reconciliation with it: what remains are the two genuine differences in BASIS, and
 * neither will ever go away. Netting a refund against a cost and receiving it as cash are two
 * legitimate readings of one dollar; a cost a family fronted is spending that was never team cash.
 *
 * ⚠ THE STARTING FIGURE IS READ OFF THE TABLE, never recomputed from the parts. A bridge whose first
 * row disagrees with the row above it is worse than no bridge — it looks like a proof.
 */
function HeadroomBridge({ data, lens }: { data: BvaData; lens: MoneyLens }) {
  /* ⚠⚠ CASH ONLY, SINCE Q3 (ruled 2026-09-02). The Difference half of this tie-out RETIRED with
     the lens's move to the spending basis: Difference now reads plan − spending, so it lands on
     Headroom exactly and there is nothing left to reconcile — its basis note says so instead.
     Season spending never needed one (it IS the headroom figure), and Budget and Scheduled have
     no actual in them. What remains is the one genuine gap: Cash against what the season spent. */
  if (lens !== 'actual') return null;

  const { familyPaid, moneyBack } = cashAdjustments(data);
  /** Cash the team paid vendors, less what the season spent. The whole gap on this view. */
  const delta = r2(moneyBack - familyPaid);
  /* ⚠ THE ROW'S OWN PRESENCE IS THE CLAIM — the same rule as the Statement's bridge. A season with
     no money back and no family-fronted cost has two identical figures, and a reconciliation
     announcing "no difference" is furniture on the narrowest screen in the portal. */
  if (Math.abs(delta) < 0.005) return null;

  /* Cash walks DOWN to the spending figure: Headroom's total is the smaller of the two here. */
  const lines = [
    { key: 'back', label: 'money back, counted here as arriving', amount: r2(-moneyBack), subs: [] as Array<{ id: string; label: string; amount: number }> },
    {
      key: 'family',
      label: 'costs a family paid the vendor',
      amount: familyPaid,
      // The same dated line the Statement's bridge prints — one spelling (see `familyPaidSub`).
      subs: data.familyPaidCosts.map(familyPaidSub),
    },
  ].filter(l => Math.abs(l.amount) > 0.005);

  return (
    <details className={styles.bridge}>
      <summary className={styles.bridgeSummary}>
        <ChevronRight size={13} className={styles.bridgeChev} aria-hidden />
        <span>
          Headroom counts <strong>{fmt(data.totalActual)}</strong> spent — why the difference?
        </span>
      </summary>
      <div className={styles.bridgeBody}>
        <dl className={styles.bridgeList}>
          <div className={styles.bridgeRow}>
            <dt>Expenses — what you paid vendors</dt><dd>{fmt(data.monthGrid.totals.total.actual)}</dd>
          </div>
          {lines.map(l => (
            <Fragment key={l.key}>
              <div className={styles.bridgeRow}>
                <dt>{l.amount < 0 ? 'Less ' : 'Plus '}{l.label}</dt>
                <dd>{l.amount < 0 ? `−${fmt(Math.abs(l.amount))}` : `+${fmt(l.amount)}`}</dd>
              </div>
              {l.subs.map(s => (
                <div className={`${styles.bridgeRow} ${styles.bridgeSub}`} key={s.id}>
                  <dt>{s.label}</dt><dd>{fmt(s.amount)}</dd>
                </div>
              ))}
            </Fragment>
          ))}
          <div className={`${styles.bridgeRow} ${styles.bridgeOut}`}>
            <dt>What this season spent</dt><dd>{fmt(data.totalActual)}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

function SectionBand({ label, inner }: { label: string; inner?: boolean }) {
  return (
    <div className={`${styles.sectionBand} ${inner ? styles.sectionBandInner : ''}`}>
      <span className={shared.scrollXStickyCell}>{label}</span>
      <span /><span /><span />
    </div>
  );
}

function SubtotalRow({
  label, budgeted, actual, variance, direction,
}: {
  label: string; budgeted: number; actual: number; variance: number; direction: 'in' | 'out';
}) {
  return (
    <div className={styles.sectionSubtotal}>
      <span className={shared.scrollXStickyCell}>{label}</span>
      <span className={shared.ledgerNum}>{fmtCell(budgeted)}</span>
      <span className={shared.ledgerNum}>{fmtCell(actual)}</span>
      <span className={shared.ledgerNum} style={{ color: varianceInk(variance, direction, actual) }}>
        {varianceText(variance, direction, actual)}
      </span>
    </div>
  );
}

/**
 * THE PLAYER DUES ROW (owner ruling 2026-09-04).
 *
 * ⚠⚠ IT IS NOT A `CategoryGroup`, AND THAT IS DELIBERATE. Every other row on this report opens
 * what is behind it (QA §132 round three) — the budget figure opens the plan lines, the actual
 * opens the payments. This row has neither: dues are a SCHEDULE, not budget lines, and the payments
 * are another screen's book. Rendered through the ordinary group it would offer a chevron and two
 * figure-buttons that all open nothing, which is precisely the empty-panel defect `slimCategory`
 * caused two days before this was written. Its caption names the screen that holds the records
 * instead, and in the not-set state that caption IS the door.
 *
 * ⚠ AN EM-DASH, NEVER A ZERO. A `$0.00` dues row reads "nothing owed"; the truth on a team that has
 * not set a schedule is "not set yet", and every team is in that state on day one. The download
 * already writes a blank rather than a 0 for the same reason.
 */
function DuesRow({ cat, dues, base, canWrite }: {
  cat: CategoryResult; dues: DuesRevenue; base: string; canWrite: boolean;
}) {
  const isSet = dues.billed !== null;
  const duesHref = moneySectionHref(base, 'dues');
  return (
    <div className={`${shared.ledgerGroup} ${styles.duesRow}`}>
      <div className={`${shared.ledgerGroupHead} ${styles.categoryHeader}`}>
        <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
          {/* The width of the chevron its neighbours carry, so one row without a control does not
              sit a quarter-inch left of every other name in the band. */}
          <span className={styles.duesIndent} aria-hidden />
          <span className={styles.duesNameStack}>
          <span className={shared.ledgerName}>{cat.categoryName}</span>
          <span className={styles.duesCaption}>
            {isSet ? (
              `${dues.familyCount} ${dues.familyCount === 1 ? 'family' : 'families'} · set on Player Dues`
            ) : canWrite ? (
              <>
                Not set yet · <Link href={duesHref} className={styles.duesLink}>Set player dues</Link>
              </>
            ) : (
              /* ⚠ NO DOOR A READ-ONLY COACH CANNOT WALK THROUGH. The words are an invitation to act;
                 offered to someone the server will refuse, they are a dead end wearing a link's
                 clothes. The fact still gets said. */
              'Not set yet'
            )}
          </span>
          </span>
        </span>
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong} ${isSet ? '' : shared.ledgerNumMuted}`}>
          {isSet ? fmt(cat.budgeted) : '—'}
        </span>
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>
          {Math.abs(cat.actual) > 0.005 ? fmtCell(cat.actual) : '—'}
        </span>
        {/* ⚠ NO VARIANCE WITHOUT A PLAN TO VARY FROM. With no schedule there is no budgeted figure,
            so "−$0.00" would be arithmetic on an absence. */}
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}
              style={{ color: isSet ? varianceColor(cat.variance) : undefined }}>
          {isSet ? varianceText(cat.variance, 'in') : '—'}
        </span>
      </div>
    </div>
  );
}

/*
 * ⚰ DuesSentence LIVED HERE. Its wording, and every ruling behind it, moved to
 * lib/coach-money-report-notes.ts on 2026-09-05 when the owner asked for the disclaimers to
 * travel with the Excel and PDF exports — a sentence a board reads in a file cannot have a
 * second author on the screen. The four states, the basis clause and the identity it may only
 * claim under Whole season are all argued there now. The stack renders through <ReportNotes />
 * at the foot of the statement.
 */
export function BudgetVsActualPanel({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data,    setData]    = useState<BvaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  // Chunk G — the sample sheet, opened from the empty state on its BvA tab so a coach
  // two pages from home can see the destination before building the budget (D4).
  const [sampleOpen, setSampleOpen] = useState(false);

  const [expandedCats,  setExpandedCats]  = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());

  // Chunk H — the month grid. Which view and which lens a coach reads in is DEVICE memory
  // (localStorage per team+season, the shipped pattern for quiet per-coach state): a treasurer
  // who lives in the month view should land there, and it is nobody else's business.
  const [view, setView] = useState<BvaView>('statement');
  const [lens, setLens] = useState<MoneyLens>('budget');
  /** The Spending trend shelf's open state — device memory beside view/lens (D2, 2026-09-02):
   *  a coach who reads the chart gets it back open; everyone else keeps the quiet page. */
  const [trendOpen, setTrendOpen] = useState(false);
  /** "What is behind this figure?" — one panel, either side of the row (QA §132 round three).
   *  ONE piece of state rather than two, because the two panels are one answer read on two
   *  columns: a second state could hold both open at once, which is a shape the screen has no
   *  drawing for. */
  const [behind, setBehind] = useState<{ item: ItemResult; side: BehindSide } | null>(null);
  const openBehind = useCallback((item: ItemResult, side: BehindSide) => setBehind({ item, side }), []);
  /* ⚠ NULL MEANS "wherever today is" — see `monthStart` below. Holding the DEFAULT as null rather
     than a number is what lets the window follow a data reload without an effect, and without a
     frame of the wrong months while one settles. */
  const [monthStartRaw, setMonthStartRaw] = useState<number | null>(null);
  /**
   * WHICH SPAN THE PLAN COLUMN COVERS (owner ruling 2026-09-04) — device memory beside view/lens,
   * the shipped pattern for quiet per-coach state.
   *
   * ⚠ 'season' STAYS THE DEFAULT and flipping it is its own decision, taken after the owner has
   * seen To date working. Headroom is quoted against the whole-season plan on five surfaces and
   * pinned by a build gate; a default that moved underneath them would change five screens as a
   * side effect of adding a control to one.
   */
  const [basis, setBasis] = useState<CompareBasis>('season');
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  /* ⚠ ONE 'today' PER RENDER, in the ORG's timezone. Computed here rather than inside the
     arithmetic so every figure on one screen is cut against the same day — a helper calling
     tournamentToday() per row would straddle midnight on the one night a year it matters, and
     would make the memo below impossible to key. */
  const today = tournamentToday();

  /* ⚠ THERE IS NO MONEY-TAG FILTER ON THIS REPORT, and its absence is a ruling rather than a gap
     (owner, 2026-08-21 — the route carries the full argument at the same point in its read). A
     budget line carries no tag, so a tag-filtered reading set a slice of spending against the
     whole plan and Headroom ROSE as you narrowed. Tag filtering lives on Transactions, which
     LISTS; this screen COMPARES. Reinstating it here needs tagged plan lines first.
     ⚠ A comment claiming this filter still existed sat here until 2026-08-25 over code that had
     had none since §64 — which is how a reader learns the opposite of the truth from a file that
     compiles perfectly. */

  /* ⚠ THE RECATEGORIZE FIX-IT IS GONE (mig 240), and its absence is deliberate. It existed to
     move an expense onto a real CATEGORY so it stopped sitting in a separate Unbudgeted list at the
     foot of the report. There is no such list now: unplanned spending appears in its own category
     and item row, flagged, in place. And the fix itself moved — a coach opens the cost and picks
     its item, which is the same control that files it correctly in the first place, rather than a
     second half-strength editor that could only ever set the coarser of the two levels. */

  // No PDF-settings fetch here any more: MoneyExportButton loads the org's branding on the FIRST
  // PDF export and remembers it, rather than every Money tab requesting it on mount for a file
  // most coaches never ask for.

  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all, so a capability check is
  // just a capability check.
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);
  const moneyCanWrite = (page.capabilities?.money === 'write');

  /* Stamp-and-drop + `quiet` — the Money-panel loading convention, written once above
     `useMoneyRevision` in lib/coach-money-refresh.tsx. */
  const loadSeq = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const seq = ++loadSeq.current;
    if (!quiet) { setLoading(true); setError(''); }
    try {
      // ⚠ ONE REQUEST NOW. The item taxonomy was fetched alongside the report purely to fill the
      // Recategorize picker, which mig 240 retired — the report names every category and item
      // itself, so a second call would load a list nothing reads.
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-vs-actual`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const body = await res.json();
      if (seq !== loadSeq.current) return;
      setError(''); // a winning load that succeeded means there is no error any more — see the convention
      setData(body);
    } catch (e: unknown) {
      if (!quiet && seq === loadSeq.current) setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [orgSlug, teamId]);

  /* Mount loud, bump quiet. Budget lines imported from the hub's Import menu — and any money
     recorded on another tab — change what this report compares against, so it re-reads on the
     same signal, without remounting anything. */
  useEffect(() => { load(); }, [load]);
  const quietReload = useCallback(() => { void load(true); }, [load]);
  useOnMoneyRevisionBump(quietReload);

  /* ══ THE FORWARD STAT (owner D4 + Q2, wording G2 Variant 1, 2026-09-02) ═══════════════════════
     ⚠⚠ ONE DERIVATION, TWO READERS (`scheduledForward` — walk feedback 2026-09-02). The banner
     prints the headline; the Months · Scheduled basis note prints the SAME derivation out loud
     (closing balance, less the possible, equals this figure), because the owner clicked a number
     that never literally appeared on the screen it opened. Committed dues stay in the headline;
     pledges and pending club asks are the "possible" clause, never banked — the lib helper's
     header carries the invariant and its build guard. */
  const forward = useMemo(() => {
    if (!data) return null;
    return scheduledForward(
      data.revenueGrid, data.monthGrid, data.returnedGrid,
      data.cashOnHand, data.openingBalance ?? null);
  }, [data]);

  const prefsKey = assignment ? `flhq-coach-bva-view:${teamId}:${assignment.programYearId}` : null;
  useEffect(() => {
    if (!prefsKey) return;
    try {
      const raw = localStorage.getItem(prefsKey);
      // Shape-check, not just parse-check: a corrupt value must fall back, never crash.
      const parsed = raw ? JSON.parse(raw) as { view?: unknown; lens?: unknown; trendOpen?: unknown; basis?: unknown } : {};
      // ⚠ The retired `categories` value still resolves — see `readStoredView`. It is stored per
      // device, so refusing it would silently reset every treasurer who had chosen a view.
      const stored = readStoredView(parsed.view);
      if (stored) setView(stored);
      if (MONEY_LENSES.some(l => l.id === parsed.lens)) setLens(parsed.lens as MoneyLens);
      if (typeof parsed.trendOpen === 'boolean') setTrendOpen(parsed.trendOpen);
      if (parsed.basis !== undefined) setBasis(normalizeBasis(parsed.basis));
    } catch { /* device memory only */ }
    setPrefsLoaded(true);
  }, [prefsKey]);

  useEffect(() => {
    // Don't write back the defaults before the read has happened, or the first render would
    // stomp a remembered preference.
    if (!prefsKey || !prefsLoaded) return;
    try { localStorage.setItem(prefsKey, JSON.stringify({ view, lens, trendOpen, basis })); } catch { /* device memory only */ }
  }, [prefsKey, prefsLoaded, view, lens, trendOpen, basis]);

  // ── Export helpers ─────────────────────────────────────────────────────────
  // The export always matches what is on screen. In the Months view that means the month grid
  // in the SELECTED lens, with the months as columns — the same shape the import template will
  // take, so today's export is tomorrow's import.
  /** Which grid the EXPENSES band reads under this lens — the lib's own predicate, shared with
   *  the screen (`lensReadsSpendingGrid`), so the file cannot pick a different band. The `??` is
   *  the deploy-skew belt (see MoneyMonthGrid): a stale payload degrades to the cash grid. */
  function exportExpensesBand(): MonthGrid {
    return (lensReadsSpendingGrid(lens) ? data!.spendingGrid : undefined) ?? data!.monthGrid;
  }

  function monthExportColumns(): ExportColumnDef[] {
    const g = data!.monthGrid;
    const cols: ExportColumnDef[] = [{ label: 'Category / line', key: 'item', format: 'text' }];
    /* ⚠ THE SCREEN'S OWN PREDICATE, not a second spelling of it (`/simplify`, 2026-08-23 — the two
       had already drifted apart near the rounding threshold). A column of blanks in a spreadsheet is
       worse than on a screen, because the file outlives the session and nothing explains it — but so
       is silently dropping a pledge the coach could see. Per band, per lens, as the screen asks. */
    const undatedBands = lens === 'spending'
      ? [exportExpensesBand()]
      : [data!.revenueGrid, exportExpensesBand(), data!.returnedGrid];
    if (hasUndated(undatedBands, lens)) {
      cols.push({ label: 'No date yet', key: 'undated', format: 'currency' });
    }
    /* ⚠⚠ EVERY MONTH, NEVER THE WINDOW. The grid shows twelve at a time (owner ruling
       2026-08-21); the FILE is the whole season and must stay that way. A spreadsheet that
       silently contained only what happened to be on screen is the worst outcome available
       here — it leaves the product, and nothing in it says a slice was taken. */
    // `headerMonth` writes the Excel header as the month's real date ("Feb 2026"); the label
    // stays the CSV/PDF spelling, which is the one the import parser has always read.
    for (const m of g.months) cols.push({ label: formatMonthLabel(m), key: `m_${m}`, format: 'currency', headerMonth: m });
    cols.push({ label: 'Total', key: 'total', format: 'currency' });
    return cols;
  }

  // The export shares the grid's own lens maths (`lensCell`/`lensTotal`/`lensReadsPlan`), so a
  // downloaded file can never disagree with the screen it was downloaded from.
  /**
   * The Months file, in the same two bands the screen shows (Option D, owner ruling 2026-08-23).
   *
   * ⚠⚠ IT READS THE GRID'S OWN HELPERS — `lensCell`, `lensTotal`, `lensUndated`, `hasUndated`,
   * `categoryHasFigure`, `buildBandCashFlow`, `bandTotalLabel`, `revenueGroupLabel`. Every one of
   * them is shared with the component, so a downloaded file cannot disagree with the screen it was
   * downloaded from. A spreadsheet outlives the session that made it; it is the LAST place to
   * re-derive anything — and the last two that were re-derived here (which revenue groups render,
   * and whether the undated column appears) had ALREADY drifted from the screen by 2026-08-23.
   */
  function buildMonthExportRows(): {
    rows: Array<Record<string, string | number>>;
    kinds: Array<MoneyRowKind | undefined>;
  } {
    /* ⚠ THE SCREEN'S OWN BAND SELECTION (D1 + Q3, 2026-09-02): under Season spending and
       Difference the expenses rows come from the spending grid, exactly as rendered. */
    const g = exportExpensesBand();
    const rev = data!.revenueGrid;
    const returned = data!.returnedGrid;
    const { todayMonth, cashOnHand } = data!;
    const opening = data!.openingBalance ?? null;
    const rows: Array<Record<string, string | number>> = [];
    // Index-aligned with `rows` — Excel presentation only (bold bands, collapsible line rows).
    // The `  — ` prefixes pushed below stay in the CSV/PDF text but are stripped from the Excel
    // cells at download (the indent replaces them) — see MoneyRowKind for why the import round
    // trip survives that.
    const kinds: Array<MoneyRowKind | undefined> = [];
    const push = (row: Record<string, string | number>, kind?: MoneyRowKind) => {
      rows.push(row);
      kinds.push(kind);
    };

    /** A category, item or band-total row: every lens has something to say about it. */
    function moneyRow(
      item: string, cells: MonthCell[], total: MonthCell, undated: MonthCell,
      band: MoneyRowDirection,
    ): Record<string, string | number> {
      const row: Record<string, string | number> = { item };
      row.undated = lensUndated(undated, lens) || '';
      g.months.forEach((m, i) => { row[`m_${m}`] = lensCell(cells[i], lens, m, todayMonth, band) ?? ''; });
      row.total = lensTotal(total, lens, band);
      return row;
    }

    function band(
      grid: MonthGrid, dir: MoneyRowDirection, categories: MonthGrid['categories'],
      /** The heading and closing label, when they are not simply the direction's — the returned
       *  band, and the spending lens's lone band (2026-09-02). */
      opts: { heading?: string; totalLabel?: string } = {},
    ) {
      push({ item: opts.heading ?? (dir === 'in' ? 'REVENUE' : 'EXPENSES') }, 'section');
      for (const cat of categories) {
        const group = dir === 'in' ? revenueGroupOf(cat.categoryKey) : null;
        push(moneyRow(
          group ? revenueGroupLabel(group, lens) : cat.categoryName,
          cat.cells, cat.total, cat.undated, dir), 'category');

        /* ⚠⚠ THE FILE CARRIES LINE-LEVEL MONEY TOO (fixed 2026-08-21). This blanked every line row
           under any lens but Budget, on the same stale reasoning the screen used — so a coach who
           exported Actual got a spreadsheet whose category rows had figures and whose item rows were
           empty, and no way to tell that was a display rule rather than the truth.

           ⚠⚠ AND THE SAME PER-LENS FILTER THE SCREEN APPLIES TO SUBJECT ROWS (D-2, 2026-08-24) —
           `categoryHasFigure`, literally the same predicate. The families, drives and sponsors
           behind a revenue group (and the families behind "Paid back to families") are RECORDS, not
           plan lines: none of them has a Budget figure and none appears under Difference, because
           there is no per-family plan to compare against. A file listing every family blank under
           Budget would be rows the screen never showed, and a reader cannot tell an empty row from
           a missing one. */
        const subjectRows = dir === 'in' || isPayoutCategory(cat.categoryKey);
        const lines = !subjectRows ? cat.lines
          : lens === 'difference' ? []
            : cat.lines.filter(l => categoryHasFigure(l.total, lens));
        for (const line of lines) {
          push(moneyRow(`  — ${line.description}`, line.cells, line.total, line.undated, dir), 'item');
        }
      }
      push(moneyRow(
        opts.totalLabel ?? bandTotalLabel(dir, lens),
        grid.totals.cells, grid.totals.total, grid.totals.undated, dir),
        'total');
    }

    /* ⚠ THE SAME PER-LENS FILTER THE SCREEN APPLIES to revenue groups — literally the same
       function. A file listing "Sponsor pledges — blank" under Actual would be a row the screen
       never showed, and a reader has no way to tell an empty row from a missing one.
       ⚠ NO REVENUE BAND AT ALL ON SEASON SPENDING (D1): that lens is the Statement's expense
       half, one band, and the file reads as the screen does. */
    if (lens !== 'spending') {
      band(rev, 'in', rev.categories.filter(c => categoryHasFigure(c.total, lens)));
    }
    /* ⚠ NO PAYOUT EXCEPTION HERE ANY MORE (2026-09-02). Every category in this band is a real
       budget category now, and a category the coach planned for stays in the file whether or not
       this lens has anything in it — its emptiness is itself the answer. */
    band(g, 'out', g.categories,
      lens === 'spending' ? { heading: 'SEASON SPENDING' } : {});
    /* ⚠⚠ THE RETURNED BAND — ACTUAL ONLY, AND ONLY WHERE IT HAS SOMETHING TO SAY, which is exactly
       the rule the screen applies. A file carrying a band the screen never showed leaves a reader
       unable to tell an empty band from a missing one, and this file outlives the session. */
    const returnedCats = lens === 'actual'
      ? returned.categories.filter(c => categoryHasFigure(c.total, lens))
      : [];
    if (returnedCats.length > 0) {
      band(returned, 'out', returnedCats,
        { heading: RETURNED_BAND_LABEL.toUpperCase(), totalLabel: RETURNED_TOTAL_LABEL });
    }

    // The three summary rows, off the same assembly the screen runs — see `buildBandCashFlow`.
    // ⚠ Not on Difference, and not on Season spending either (D1: no balance rows there).
    if (lens !== 'difference' && lens !== 'spending') {
      /* ⚠ THE RETURNED BAND IS PASSED, NOT ADDED. It left `Total expenses` and did not leave the
         season; the helper owns that subtraction so the file and the screen cannot differ. */
      const flow = buildBandCashFlow(rev, g, lens, cashOnHand, opening ?? 0, returned);
      /* The screen's "Total cash out" row (owner D5.9) — same condition, same assembly, so the
         file cannot disagree with the table it came from. */
      if (returnedCats.length > 0) {
        const out: Record<string, string | number> = {
          item: 'Total cash out',
          undated: flow.undated.moneyOut || '',
        };
        flow.rows.forEach(r => { out[`m_${r.month}`] = r.moneyOut || ''; });
        out.total = flow.totalMoneyOut;
        push(out, 'total');
      }
      /* ⚠⚠ THREE ROWS, AND THE FILE READS AS THE STATEMENT THE SCREEN DOES (owner ruling
         2026-08-26): every month says what it OPENED with, what it NETTED, and what it CLOSED on,
         so `opening + net = closing` is checkable in a spreadsheet column exactly as it is on
         screen. The old shape put the carried figure in the first month and dashes everywhere else.
         ⚠ THE ROW NO LONGER DEPENDS ON A CARRY. Every month opens on the one before it, so a team
         that carried nothing still has an opening series worth reading — its first month is simply
         zero, which this file leaves blank the way the screen shows an em dash.
         ⚠ A BALANCE IS A MOMENT AND UNDATED MONEY HAS NONE, so both balance rows leave the
         "No date yet" column empty while Net carries a figure. That one column cannot balance, in
         the file or on the screen. */
      const open: Record<string, string | number> = { item: 'Opening balance', undated: '' };
      const net: Record<string, string | number> = { item: 'Net for the month', undated: flow.undated.net || '' };
      const run: Record<string, string | number> = { item: 'Closing balance', undated: '' };
      flow.rows.forEach(r => {
        /* ⚠ A MONTH STILL AHEAD HAS NO ACTUAL BALANCE (owner ruling 2026-09-02) — the SCREEN's own
           predicate, so the file cannot show a flat forecast the table refuses to. See
           `balanceShowsMonth`; `Net for the month` already lands on blank there by arithmetic. */
        const shows = balanceShowsMonth(lens, r.month, todayMonth);
        open[`m_${r.month}`] = shows ? (r.opening || '') : '';
        net[`m_${r.month}`] = r.net;
        run[`m_${r.month}`] = shows ? r.running : '';
      });
      /* ⚠ THE SEASON'S OWN OPENING AND ENDING, never the visible window's — the Total column is the
         whole season on every other row of this file. */
      open.total = flow.opening || '';
      net.total = flow.net;
      run.total = flow.ending;
      push(open, 'total');
      push(net, 'total');
      push(run, 'total');
    }
    return { rows, kinds };
  }

  const inMonthView = view === 'months' && !!data?.monthGrid;

  /* Plan money sitting in the "No date yet" column — BOTH bands, because a fundraising or
     other-income line is as undatable as a permit, and the statement covers both. Read off the
     grids' own totals rather than re-derived, so the sentence under the statement can never quote
     a figure the months view does not show. */
  const undatedPlan = data
    ? r2((data.monthGrid?.totals.undated.budget ?? 0) + (data.revenueGrid?.totals.undated.budget ?? 0))
    : 0;

  /**
   * THE FOOTNOTE STACK, BUILT ONCE — read by the screen below AND by the Excel and PDF exports
   * (owner ruling 2026-09-05).
   *
   * ⚠ THIS IS THE POINT. A treasurer downloads this report and emails it to a board; before today
   * the figures travelled and every sentence explaining what they mean stayed on the screen, so a
   * board read "Total expenses" with no way to know which costs it deliberately leaves out. One
   * array, two renderers — the file cannot fall behind the page.
   *
   * ⚠ THE FIGURES ARE FORMATTED HERE, by this screen's own `fmt`. The notes module never formats
   * money: a second formatter is how one report starts printing one number two ways.
   */
  const statementNoteStack = useMemo(() => statementNotes({
    basis,
    dues: data && duesSentenceRenders(data.dues)
      ? {
        state: duesFundingState(data.dues),
        planNeeds: fmt(data.dues.planNeeds),
        billed: fmt(data.dues.billed ?? 0),
        gap: fmt(Math.abs(duesGap(data.dues))),
      }
      : null,
    canWriteDues: moneyCanWrite,
    undatedPlan: undatedPlan > 0.005 ? fmt(undatedPlan) : null,
  }), [basis, data, moneyCanWrite, undatedPlan]);

  /**
   * THE REPORT THE TWO SHAPES ACTUALLY DRAW — re-cut onto the chosen basis, once.
   *
   * ⚠ EVERY RENDER SITE READS THIS, NOT `data.report`. That is the whole design: the statement,
   * By activity, the totals, the closing row and the export all take one object, so a figure
   * cannot be on the wrong basis in one place and right in another. If you add a reader of
   * `data.report` below this line, it will silently ignore the control.
   */
  const report = useMemo(
    () => (data ? rebaseReport(data.report, data.dues, basis, today) : null),
    [data, basis, today]);

  /**
   * ⚠ THE MONTH VIEW'S **PDF** IS THE CATEGORY STATEMENT, NOT THE MONTH GRID (owner ruling
   * 2026-08-21, built in the Phase 2 Registers pass). The grid's columns are one per month of
   * the season, so on paper it could only ever leave months off and admit it — which is what it
   * did. A treasurer reads the whole-season statement anyway, so that is what the PDF button
   * produces; Excel and CSV still carry every month, which is where a month-by-month reading
   * belongs. The swap is announced in the file-type dialog (`pdfHint`) — never silent.
   */
  const monthGridInFormat = (format: MoneyExportFormat) => inMonthView && format !== 'pdf';

  /**
   * Everything the export needs, built AT CLICK TIME from what is on screen — the view, the
   * reading, the whole lot. This is the reason Export sits on the tab rather than in the hub
   * header: none of it is visible from up there, and pretending otherwise is what gave this
   * screen two Export buttons producing different files (owner ruling 2026-08-13).
   */
  /**
   * The reconciliation the STATEMENT file carries whenever the on-screen sentence renders
   * (D6.1, 2026-09-02) — the same walk, from the same `cashAdjustments`, never re-derived, with
   * the family-paid lines dated (`familyPaidSub`). A board reads the file where nobody can ask a
   * follow-up, which is exactly where the question "why doesn't this match the bank?" gets asked.
   */
  function reconciliationRows(): { rows: Array<Record<string, string | number>>; kinds: Array<MoneyRowKind | undefined> } {
    const rows: Array<Record<string, string | number>> = [];
    const kinds: Array<MoneyRowKind | undefined> = [];
    if (!data) return { rows, kinds };
    const { familyPaid, moneyBack, payouts, cashOut } = cashAdjustments(data);
    // The screen's own condition: no gap, no walk — a reconciliation announcing "no difference"
    // is furniture in a file exactly as it is on screen.
    if (familyPaid < 0.005 && moneyBack < 0.005 && payouts < 0.005) return { rows, kinds };
    const push = (row: Record<string, string | number>, kind?: MoneyRowKind) => { rows.push(row); kinds.push(kind); };
    push({ item: 'RECONCILIATION — SPENDING TO CASH', budgeted: '', actual: '', variance: '' }, 'section');
    push({ item: 'What this season spent', budgeted: '', actual: data.totalActual, variance: '' });
    // The same lines the on-screen walk shows, from the one builder — see `cashBridgeLines`.
    for (const l of cashBridgeLines(data)) {
      push({ item: l.label, budgeted: '', actual: l.amount, variance: '' });
      for (const s of l.subs ?? []) {
        push({ item: `  — ${s.label}`, budgeted: '', actual: s.amount, variance: '' }, 'item');
      }
    }
    push({ item: 'Cash that left the team’s account', budgeted: '', actual: cashOut, variance: '' }, 'total');
    return { rows, kinds };
  }

  /** The board-ready PDF opening block (D6.3) — the screen's own figures, no new arithmetic. */
  function pdfIntro(): { label: string; rows: Array<[string, string]> } | undefined {
    if (!data) return undefined;
    const rows: Array<[string, string]> = [
      ['Team', assignment?.teamName ?? ''],
      ['Season', assignment?.programYearName ?? ''],
      ['Headroom', `${data.headroom < 0 ? '-' : '+'}${fmt(data.headroom)} ${data.headroom >= 0 ? 'under' : 'over'} budget — ${fmt(data.totalActual)} spent of ${fmt(data.effectiveBudget)} planned`],
    ];
    if (data.unbudgeted > 0.005) rows.push(['Spent off-plan', fmt(data.unbudgeted)]);
    /* ⚠ "Funded by players" WENT FROM HERE TOO (owner ruling 2026-09-04), and this was the easiest
       half of the deletion to miss. The row left the table and the spreadsheet; this block is the
       PDF's own opening summary, and it quoted the same two figures — so leaving it would have been
       the deletion in name only, with a board reading the deleted row at the top of the very file
       it was deleted from. Both of its figures are Season net's, negated (plan §2). */
    return { label: 'This season', rows };
  }

  /**
   * THE BLOCK ABOVE THE TABLE (owner ruling 2026-09-05, QA §145) — whose money, what report, on
   * what settings, true as of when. Everything identifying this file used to live in its FILENAME,
   * which is the first thing lost when a treasurer saves the attachment or pastes the table into an
   * email to their board.
   *
   * ⚠⚠ "THE PARAMETERS, IF ANY" — and *if any* is load-bearing. The two shapes of this report take
   * DIFFERENT settings: Months takes a reading and never a Compare (its columns already are the
   * calendar); the Statement and By activity take a Compare and never a reading. Naming a setting
   * the file does not have would be worse than naming none, so each shape lists only its own.
   *
   * ⚠ "As at" IS NOT DECORATION ON A TO DATE FILE — it is what the figures mean. "Plan to date"
   * with no date attached is an unreadable number.
   *
   * ⚠ NO FIGURES, EVER. A spreadsheet's opening rows sum into whatever a treasurer later pivots or
   * selects — the ruling that keeps the PDF's board block out of Excel — and a headline goes stale
   * inside its own file the moment anyone filters the rows beneath it.
   */
  function exportMasthead(asMonthGrid: boolean, asActivity: boolean): MoneyMasthead {
    const shape = asMonthGrid ? 'Months' : asActivity ? 'By activity' : 'Statement';
    const setting = asMonthGrid
      ? `Reading: ${MONEY_LENSES.find(l => l.id === lens)?.label ?? ''}`
      : `Compare: ${COMPARE_BASES.find(b => b.id === basis)?.label ?? ''}`;
    return {
      title: `${assignment?.teamName ?? ''} · ${assignment?.programYearName ?? ''}`.replace(/^ · | · $/g, ''),
      subtitle: `Budget vs. Actual — ${shape} · ${setting}`,
      /**
       * ⚠⚠ THE SAME `today` THE FIGURES ARE CUT ON — never a fresh `new Date()` (/review,
       * 2026-09-05). This line and the To date basis have to agree about what day it is, and a
       * browser clock does not: a coach in Vancouver exporting at 9:30 p.m. on the 4th is already
       * on the 5th in the org's timezone, so every Budgeted figure in the file would be cut to the
       * 5th under a masthead saying the 4th. That is precisely the failure this line exists to
       * prevent — its own comment two lines up calls the date "what the figures mean".
       *
       * ⚠ The first version got the LOCALE right (en-CA, so a Canadian club's board paper does not
       * carry a US date) and missed the TIMEZONE entirely, which is a comment that looks like it
       * addressed the problem sitting directly on top of the problem. `formatStoredDate` is the
       * product's one date formatter and takes the org's own day.
       */
      meta: `As at ${formatStoredDate(today, { withYear: true, longMonth: true })}`,
    };
  }

  function buildExport(format: MoneyExportFormat) {
    const asMonthGrid = monthGridInFormat(format);
    /**
     * ⚠⚠ BY ACTIVITY GETS ITS OWN FILE (owner ruling 2026-09-05, QA §145). It used to fall through
     * to the statement — never a decision, just what was left when the view was not Months — and it
     * cost the reader the only rows that view exists for: a category's revenue set against its own
     * costs, closing on "<name> netted". A coach reading "did the tournament pay for itself?" and
     * pressing Export got a file that could not answer it.
     *
     * ⚠ THE MONTHS PDF SWAP IS DIFFERENT AND STAYS. That one is a ruling (a month grid on paper can
     * only leave months off) and it is ANNOUNCED in the file-type dialog. The by-activity one was
     * silent, which is how nobody noticed for a release.
     */
    const asActivity = !asMonthGrid && view === 'activity';
    const exportCols = asMonthGrid ? monthExportColumns() : bvaExportColumns(basis);
    // The category table comes from the SHARED builder, so this page's export and the Money hub's
    // "Budget vs. actual" row produce the same file — including the buffer and unbudgeted rows,
    // without which the spreadsheet's totals would disagree with the screen.
    /* ⚠⚠ THE FILE FOLLOWS THE CONTROL. A treasurer who switched to To date and pressed Download
       must not get a whole-season file — a spreadsheet is exactly where nobody re-checks which
       basis they were on, and it is the copy that gets emailed to a board. The re-cut report goes
       in, and with it the buffer and the expense total, for the same reasons the screen re-cuts
       them (an undatable estimate cannot sit inside a to-date column).
       ⚠ The MONTH grid is untouched: its columns already are the time axis, which is why Compare
       never renders on that view. */
    const exportSource = basis === 'todate'
      ? {
          ...data!,
          report: report!,
          buffer: 0,
          effectiveBudget: report!.expenses.budgeted,
          headroom: report!.expenses.variance,
        }
      : data;
    const built = asMonthGrid
      ? buildMonthExportRows()
      : asActivity
        /* The blocks come from the re-cut report, so the by-activity file follows Compare exactly
           as the statement does — every figure in it is already on the chosen basis. */
        ? bvaActivityRows(
          { activities: report!.activities, buffer: basis === 'todate' ? 0 : (data?.buffer ?? 0), net: report!.net },
          basis,
          isDuesCategory,
        )
        : bvaCategoryRows(exportSource, basis);
    if (!asMonthGrid) {
      // D6.1: the statement file ends on the same walk the screen shows — all three formats,
      // the months-view PDF included, because that PDF IS the whole-season statement.
      const recon = reconciliationRows();
      built.rows.push(...recon.rows);
      built.kinds.push(...recon.kinds);
    }
    return {
      // The filename says which shape it is, so two downloads a minute apart cannot overwrite
      // each other in a downloads folder and be told apart only by opening them.
      dataset: asMonthGrid ? `budget-by-month-${lens}` : asActivity ? 'budget-by-activity' : 'budget-vs-actual',
      title: asMonthGrid
        ? `Budget by month — ${MONEY_LENSES.find(l => l.id === lens)?.label}`
        : asActivity ? 'Budget vs. Actual — By activity' : 'Budget vs. Actual',
      columns: exportCols,
      rows: built.rows,
      rowKinds: built.kinds,
      // This report's binding screen notation (`fmtCell`): a negative in brackets, a zero as an
      // em dash. The Excel file reads like the screen it came from; every other tab keeps the
      // default minus-sign notation because that is what THEIR screens and PDFs use.
      currencyNotation: 'brackets' as const,
      // The month grid's columns depend on the season, so its PDF rows are formatted from the
      // same column definitions rather than a hand-written list — that is what keeps the three
      // formats in step when the month range or the reading changes.
      //
      // ⚠ `fmtSigned`, NOT this file's `fmt`. `fmt` strips the sign because every SCREEN caller
      // prints its own (`fmtVariance`, the headroom's `+`/`-`) — but a PDF cell has no such
      // partner, so using it here printed an over-budget variance and an under-budget one
      // identically, and negated the expected-funding rows into positives (/review, 2026-08-13).
      pdfRows: (rows: Array<Record<string, string | number>>) => rows.map(r => exportCols.map(c => {
        const v = r[c.key];
        if (c.format !== 'currency') return String(v ?? '');
        return v === '' || v === undefined || v === null ? '—' : fmtSigned(Number(v));
      })),
      scopeLabel: assignment?.programYearName ?? '',
      teamName: assignment?.teamName ?? '',
      // D6.3: the PDF opens on the board block. The PDF is always the whole-season statement
      // (the month grid stays in Excel/CSV), so the intro applies to every PDF from this tab.
      pdfIntro: format === 'pdf' ? pdfIntro() : undefined,
      /**
       * THE REPORT'S OWN CAVEATS, CARRIED INTO THE FILE (owner ruling 2026-09-05).
       *
       * ⚠ THE SAME ARRAY THE SCREEN RENDERS, never a second copy — that is the whole reason
       * `lib/coach-money-report-notes.ts` exists. Change a sentence there and it changes in the
       * spreadsheet a board receives on the same line of code.
       *
       * ⚠ WHICH STACK FOLLOWS THE VIEW, because the two say different things: the month grid's
       * notes are about the LENS being read (Cash vs Season spending vs Scheduled), the
       * statement's are about the SPAN being compared and what could not be. Sending the wrong
       * one would be a file explaining a reading it does not contain.
       *
       * ⚠ THE MONTH GRID'S LENS IS COERCED THE WAY THE GRID COERCES IT — a payload with no
       * spending grid falls back to the cash reading, and a file must state the reading it
       * actually holds rather than the one that was asked for.
       */
      notes: asMonthGrid
        ? monthGridNotesFor(data!, lensReadsSpendingGrid(lens) && !data!.spendingGrid ? 'actual' : lens)
        : statementNoteStack,
      /* ⚠ EXCEL ONLY, and the download path enforces it: the PDF already opens on its own titled
         header drawn with the club's branding, so a second title block under it would be the title
         twice, and a CSV is a data file that must start on its column row. */
      masthead: exportMasthead(asMonthGrid, asActivity),
      emptyMessage: asMonthGrid
        ? 'There is nothing in this month view to export yet.'
        : 'Budget vs. Actual has nothing to report yet — it needs a budget plan.',
    };
  }

  function toggleCat(name: string) { setExpandedCats(prev => toggleKey(prev, name)); }

  /* ⚠ THIS REPORT OPENS FULLY FOLDED, so every reading started with a row of clicks — the outline
     had a toggle per category and no way to say "all of them" (owner, §133 walk 2026-09-04). The
     Budget tab's List has carried this control since its P3; this is the same verb in the same
     place on the bar, so the two tabs cannot drift into two vocabularies for one gesture.
     ⚠ STATEMENT ONLY, and that is not an omission: By activity renders its items with no category
     fold at all, so a control there would have nothing to act on. (Months keeps its folds inside
     the grid component and is not wired to this yet.)
     ⚠ The dues row is excluded because it is not a foldable group — counting it would make "all
     open" unreachable and leave the button stuck on one word. */
  function toggleLine(id: string)  { setExpandedLines(prev => toggleKey(prev, id)); }

  const statementCatKeys = data
    ? [
        ...data.report.revenue.categories.filter(c => !isDuesCategory(c.categoryId)),
        ...data.report.expenses.categories,
      ].map(catKeyOf)
    : [];
  const allCatsOpen = statementCatKeys.length > 0 && statementCatKeys.every(k => expandedCats.has(k));
  function toggleAllCats() {
    setExpandedCats(allCatsOpen ? new Set() : new Set(statementCatKeys));
    /* ⚠ IT DOES NOT TOUCH THE ITEM FOLDS, and the first version did (/review). `expandedLines` is
       shared with By activity, which renders its item rows with NO category fold above them — so
       "Collapse all" on the statement was quietly shutting rows a coach had opened on the other
       view. Leaving them be also means their place survives a collapse-and-expand here, which is
       the better behaviour anyway. */
  }

  if (ctxLoading) return <CoachLoading label="Loading the report…" />;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // ⚠ THIS SCREEN IS WHY EXPORT LEFT THE HUB HEADER (owner ruling 2026-08-13, mockup 96675523).
  // For a while it had TWO Export buttons: one above the tab bar exporting the category table,
  // one here exporting the month grid at the chosen reading — both labelled "Export", neither
  // saying which. There is now one, and it sits beside the switches that decide what it contains,
  // so it can only mean "what I am looking at".
  /* ── The month window ────────────────────────────────────────────────────────────────────
     The control sits in the view bar beside View and Showing (owner call 2026-08-21) rather than
     on a line of its own, so the two things that change what the grid shows are together.

     ⚠ IT MOVES ONE MONTH PER PRESS, not a whole window (owner call 2026-08-21). A twelve-month
     jump skipped past the month a coach was aiming for and made ← after → land somewhere new;
     stepping by one is reversible by construction — press → then ←, and you are back. */
  const gridMonths = data?.monthGrid.months ?? [];
  const maxMonthStart = Math.max(0, gridMonths.length - MONTH_WINDOW);
  const defaultMonthStart = (() => {
    if (!data || gridMonths.length <= MONTH_WINDOW) return 0;
    // Open on the window CONTAINING TODAY — a coach lands on the month they are standing in.
    const here = gridMonths.indexOf(data.todayMonth);
    const centred = (here < 0 ? 0 : here) - Math.floor(MONTH_WINDOW / 2);
    return Math.max(0, Math.min(centred, maxMonthStart));
  })();
  const monthStart = Math.min(Math.max(0, monthStartRaw ?? defaultMonthStart), maxMonthStart);
  const monthWindow = gridMonths.slice(monthStart, monthStart + MONTH_WINDOW);
  const monthsPaged = gridMonths.length > MONTH_WINDOW;

  const bvaExport = (
    <MoneyExportButton
      label={inMonthView ? 'Budget by month' : 'Budget vs. actual'}
      formats={['xlsx', 'csv', 'pdf']}
      build={buildExport}
      pdfHint={inMonthView
        ? 'The whole-season statement — month-by-month detail is in Excel and CSV'
        : undefined}
      disabled={!data || (data.effectiveBudget === 0 && data.totalActual === 0)}
    />
  );

  return (
    <div className={`${shared.page} ${shared.pageWide} ${styles.page}`}>
      {/* ⚰ The "Back to Money" row that stood here is GONE (back-in-header ruling, 2026-08-26).
          It was one of the TWO surviving hand-written copies of the retired back-link style — the
          shared-component pass missed both because they never imported the component. It rendered
          only on the legacy standalone route, and every legacy money route is a permanent redirect
          into the hub, so no coach has seen it since. Deleted as dead code. */}
      {/* ⚰ And so is this panel's own CoachPageHeader (cleanup tranche 6, 2026-09-01). Its title,
          icon and help topic only ever rendered on the standalone route; inside the hub the header
          collapsed to an actions row this panel had none of, so it rendered nothing at all. The
          live "?" for this tab is the hub's own, which is tab-aware. Reasoning at the hub's mount
          in accounting/page.tsx. */}
      {loading ? (
        <CoachLoading label="Loading the report…" />
      ) : error ? (
        <CoachLoadError message={error} onRetry={() => { void load(); }} />
      ) : !data || data.effectiveBudget === 0 ? (
        <>
          <CoachEmptyState
            icon={<TrendingUp size={22} aria-hidden />}
            eyebrow="Budget vs. actual"
            headline="No budget plan yet"
            description="Create a budget plan to start tracking estimated spend against your actual ledger."
            primaryAction={{ label: 'Create a budget plan', href: moneySectionHref(base, 'budget', undefined) }}
            secondaryAction={{ label: 'See a finished example', onClick: () => setSampleOpen(true) }}
          />
          {sampleOpen && <SampleBudgetSheet initialTab="bva" onClose={() => setSampleOpen(false)} />}
        </>
      ) : (
        <>
          {/* ⚠⚠ THE MONEY-TAG FILTER WAS REMOVED HERE (owner ruling 2026-08-21). It worked — it
              narrowed Actual and Scheduled to one tag's spending — but it could not narrow the
              BUDGET, because a plan line carries no tag. So every filtered reading compared a
              SLICE of spending against the WHOLE plan, and Headroom went UP when you filtered:
              on the fixture, $8,905 became $10,900. A report cannot half-filter a comparison.
              Tag filtering still lives on Transactions, where it narrows a LIST and nothing is
              being compared. Do not reinstate it here without a way to tag the plan. */}
          {/* ⚠⚠ ONE ROW, AND THE DUES CARD IS GONE (owner ruling 2026-08-26).
              This page opened with ~280px of summary above the table it exists to show. Two
              separate blocks, and neither survived the question "who reads this here?":

              · THE THREE-TILE BANNER WAS THE TABLE'S OWN FOOT. Headroom / Total Budget /
                Total Actual are the same three figures the `Total expenses` SubtotalRow states
                at the bottom of the statement — the coach read the arithmetic, scrolled past a
                card, and met it again. Headroom keeps its size and its colour because it is the
                one number this page exists to give; budget and actual are the WORKING and now
                read as such, on the same line.

              · THE DUES CARD ANSWERED A DIFFERENT QUESTION, and answered it third. Dues are
                money IN; this report measures spending against plan. All four of its figures
                are already told on the Money hub's Overview card (which draws the bar and the
                `· 88%` rate) and again on Player Dues' own footer — and since the income work
                landed, this report states dues month by month in its OWN income band, which the
                card never could. ⚠ Do not "restore" it: the connection a coach actually needs
                here (is enough coming in to fund the plan?) is answered at the foot by
                `Funded by players` and the cash bridge.

              ⚠ THE BUFFER HINT WENT WITH IT (`incl. X not itemized yet`) — informational, and
              it did not earn a second row. The over-planned warning below DID: it is the only
              thing on this page that explains why this total disagrees with the budget plan
              page, so it stays INLINE rather than wrapping the strip. */}
          {/* ══ THE TAB'S SUMMARY BAND (owner D1/D2 Option A, 2026-09-03) ══════════════════════
              ⚰ THE PROSE STRIP IS GONE. It carried five numbers in ~25 words and wrapped to two
              lines, with no two facts aligned; the owner's read was that it was "too wordy for a
              banner". Four tiles carry the same five figures in ~12 words — the plan total and the
              "possible" money ride captions — through the shared `MoneySummaryBand`, so this tab
              and every other money tab draw their summary one way.

              ⚠ THIS DOES NOT UNDO THE 2026-08-26 ONE-ROW RULING. That ruling cut ~280px of banner
              (three tiles plus a dues card) down to one row; this is still one row at the same
              height. What changed is that the figures land in columns instead of a sentence.

              ⚠ THE OVER-PLANNED WARNING IS NOT A TILE, deliberately. It is a sentence about the
              PLAN disagreeing with itself, not a figure about the season — it rides the band's one
              note line, which is exactly what that slot is for. */}
          <MoneySummaryBand
            ariaLabel="Budget vs. actual summary"
            tiles={[
              {
                key: 'headroom',
                label: 'Headroom',
                figure: `${data.headroom < 0 ? '-' : '+'}${fmt(data.headroom)}`,
                /* The page's one verdict — the only figure here whose colour IS the reading. */
                tone: data.headroom >= 0 ? 'good' : 'danger',
                caption: data.headroom >= 0 ? 'under budget' : 'over budget',
              },
              {
                key: 'spent',
                label: 'Spent',
                figure: fmt(data.totalActual),
                caption: `of ${fmt(data.effectiveBudget)} planned`,
              },
              {
                /* ⚠ HIDES AT ZERO, AND THAT IS THE POINT (recipe deviation 2). Off-plan spending is
                   a WARNING rather than a fact, so it gets a tile of its own rather than a clause
                   in someone else's caption — and a well-run team simply sees three tiles. */
                key: 'offplan',
                label: 'Off-plan',
                figure: fmt(data.unbudgeted),
                tone: 'warn',
                caption: 'nobody budgeted this',
                hidden: !(data.unbudgeted > 0.005),
              },
              {
                /* The forward stat (D4, G2 Variant 1). ⚰ It stopped being a LINK on 2026-09-02
                   (owner: "not sure why we decided that that 1 metric should be a link"); the
                   Months · Scheduled notes derive this exact figure from the same helper, so the
                   arithmetic is still findable. Do not re-link it. */
                key: 'season-end',
                label: 'Season end',
                figure: forward ? fmtSigned(forward.headline) : '—',
                caption: forward && forward.possible > 0.005
                  ? `plus ${fmt(forward.possible)} possible`
                  : undefined,
                hidden: !forward,
              },
            ]}
            note={data.overPlanned
              ? <>Your lines are <strong>{fmt(Math.abs(data.estimateDifference))}</strong> over this
                  estimate, and this report measures against the estimate.</>
              : undefined}
          />

          {/* ⚠ THE TWO NEW SHAPES JOIN THE CONTROL THAT WAS ALREADY HERE (plan §3.5), rather than
              introducing a second idea of "switching views" beside it. Statement is the default —
              the shape a treasurer, a board and a parent already know, and the one that answers
              "are we going to be short?" By activity answers what a statement structurally cannot,
              because a category appears in both its sections: "did hosting the tournament pay for
              itself?" Months is the treasurer's spreadsheet shape and is money-OUT only. */}
          {/* ⚠⚠ TWO PILLS WHERE SEVEN SEGMENTED BUTTONS WERE (owner instruction 2026-08-20).
              Transactions and Payables choose how one set of records is laid out with a labelled
              pill that opens a small list; this report did the same job with two banks of buttons,
              so one product asked the same question two ways. `View` here IS Payables' `Group by`:
              same control, same place in the strip, same accent on the arrangement.

              ⚠ The saving is real, which was the owner's own argument: seven buttons and two labels
              wrapped onto a second line on anything narrower than a desktop, and a report gains
              controls over time rather than shedding them.

              ⚠ NO DEFAULT MOVED. The report still opens on Statement, and Months still opens on
              Budget — only the shape of the control changed. */}
          <div className={styles.viewBar}>
            <SingleSelectDropdown
              label="View"
              lead
              value={view}
              options={[
                { id: 'statement', label: 'Statement' },
                { id: 'activity', label: 'By activity' },
                { id: 'months', label: 'Months' },
              ]}
              onChange={next => setView(next as BvaView)}
            />

            {/* ⚠ NOT ON MONTHS, and that is the ruling rather than an omission (owner 2026-09-04).
                The month view's columns already ARE the time axis — a coach reading across them
                can see exactly which months have happened — so a basis there would be a second,
                quieter way of saying the same thing over a grid that already says it.
                ⚠ ON BOTH THE STATEMENT AND BY ACTIVITY. They are one set of rows read two ways and
                they close on the same net; a basis on one and not the other would let one report
                end on two different numbers depending on which shape a coach opened.
                ⚠ THE BRIEF EXPECTED A THREE-SELECTOR CRUSH HERE AND IT CANNOT HAPPEN: `Showing`
                renders only under `view === 'months'`, so Compare and Showing are never on this
                row together. Measured at 361 / 641 / 768 — two lines before, two lines after. */}
            {view !== 'months' && (
              <SingleSelectDropdown
                label="Compare"
                value={basis}
                options={COMPARE_BASES.map(b => ({ id: b.id, label: b.label }))}
                onChange={next => setBasis(normalizeBasis(next))}
              />
            )}

            {view === 'months' && (
              /* ⚠ THE FULL WORD, ALWAYS. The segmented buttons abbreviated to "Diff." to survive a
                 phone and carried an `aria-label` so a screen reader still heard the whole word.
                 A pill names one chosen value, so there is room for it — and the abbreviation, and
                 the accessibility patch it needed, both go away. */
              <SingleSelectDropdown
                label="Showing"
                value={lens}
                /* ⚠ Season spending is offered only when the payload can feed it — the deploy-skew
                   belt's menu half (see MoneyMonthGrid): an ordinary click must never reach a lens
                   whose grid a stale response did not send. */
                options={MONEY_LENSES
                  .filter(l => l.id !== 'spending' || !!data.spendingGrid)
                  .map(l => ({ id: l.id, label: l.label }))}
                onChange={next => setLens(next as MoneyLens)}
              />
            )}

            {/* ⚠ ONLY WHEN THERE IS SOMETHING TO MOVE. Twelve months or fewer is the whole season
                already, and a control that can never do anything is worse than no control. */}
            {view === 'months' && monthsPaged && (
              /* ⚖ THE SHARED PAGER (owner G3, 2026-09-04). This control was born here (owner call
                 2026-08-21: in the view bar beside View and Showing, one month per press) and the
                 By-installment dues grid needed the same one — so it became ColumnPager and both
                 grids read it. Nothing visible changed on this screen.
                 ⚠ THE RANGE IS NAMED, and it is not decoration: `Total` is the WHOLE SEASON,
                 never these twelve months, so a reader adding up what they can see has to be
                 able to tell why it does not match. */
              <ColumnPager
                unit="month"
                /* ⚠ ONE WORDING, BOTH GRIDS (2026-09-04). This built its range inline from
                   `formatMonthLabel` while the Budget tab's new pager said it differently — two
                   controls a tab apart naming the same kind of window in two vocabularies. */
                range={<><strong>{periodRangeLabel(monthWindow)}</strong>{` · of ${gridMonths.length} months`}</>}
                onPrev={() => setMonthStartRaw(Math.max(0, monthStart - 1))}
                onNext={() => setMonthStartRaw(Math.min(maxMonthStart, monthStart + 1))}
                prevDisabled={monthStart === 0}
                nextDisabled={monthStart >= maxMonthStart}
              />
            )}

            {/* ⚠ ONLY WHERE IT CAN DO SOMETHING — the same rule the month pager follows one block
                up. See `toggleAllCats` for why that is the statement alone. */}
            {view === 'statement' && statementCatKeys.length > 0 && (
              <button
                type="button"
                className={`${shared.btnGhost} ${styles.collapseAllBtn}`}
                onClick={toggleAllCats}
              >
                {allCatsOpen ? 'Collapse all' : 'Expand all'}
              </button>
            )}

            {/* On EVERY view, not just the month one — it exports whichever is on screen, so it
                has no reason to appear and disappear. Standalone route included: this row is on
                both, which is what stops the two shapes drifting apart. */}
            <span className={shared.panelToolbarActions}>{bvaExport}</span>
          </div>

          {/* ⚰ THE VIEW SUBLABEL LINE LIVED HERE FOR ONE DAY (D5.7, built 2026-09-02) and the owner
              removed it ON SIGHT during the §132 walk, reversing that quick fix: the pill already
              names the shape, and a caption under the toolbar was furniture. Do not reinstate. */}

          {view === 'months' ? (
            <>
              <MoneyMonthGrid
                data={data}
                lens={lens}
                base={base}
                canWrite={moneyCanWrite}
                monthStart={monthStart}
              />
              {/* ⚠ UNDER THE GRID'S OWN NOTES, not above them. Those notes state what the lens
                  MEANS; this states why two figures on the screen differ. Basis first, then the
                  arithmetic that follows from it. */}
              <HeadroomBridge data={data} lens={lens} />
            </>
          ) : (
          <>
          {/* ⚰ THE CHART NO LONGER OPENS THE PAGE (owner D2, 2026-09-02, G3-approved). It spent
              ~200px saying "roughly on track" before the table said anything exact; it is now the
              "Spending trend" shelf BELOW the table, collapsed, its open state remembered with the
              view preference. The undated-budget footnote moved inside the shelf with it. */}

          {/* ── The report, in whichever shape the coach chose (plan §3.5) ──────────────────
              Both come off ONE grouping pass on the server and end on the same season net,
              because they are the same rows read two ways. */}
          {(report!.revenue.categories.length > 0 || report!.expenses.categories.length > 0) && (() => {
            /* ⚠ THE SERVER'S FIGURE, not a fourth recomputation. It is measured against the
               EFFECTIVE budget — the estimate whenever a coach has set one (owner ruling
               2026-08-12, shared with the plan page, the Money hub and headroom) — which is the
               same number the Total expenses row below shows. Both shapes and the export read it. */
            const { budgeted: netBudget, actual: netActual, variance: netVariance } = report!.net;

            /* The part of the estimated total not yet covered by lines. Positive only — an
               estimate BELOW the lines has nothing unallocated to stand in for, and a negative
               pseudo-row here would read as a refund. Rendered in BOTH shapes so the rows a reader
               can see add up to the same Total expenses either way. */
            /* ⚠⚠ NO BUFFER ROW UNDER "To date", and this is the load-bearing half of the basis's
               honesty. The estimate buffer is plan money with NO LINES UNDERNEATH IT — a coach who
               set a season total before itemising anything — so there is nothing to attach a month
               to, and it can never join a to-date comparison however diligently every line is
               dated. Printing it here would put undatable money inside a column that claims to hold
               only money dated on or before today. It is also why the excluded figure in the
               sentence below the table can never reach zero on a team that sets an estimate. */
            const bufferRow = basis === 'season' && data.buffer > 0 ? (
              <div className={shared.ledgerGroup}>
                <div className={`${shared.ledgerGroupHead} ${styles.categoryHeader}`}>
                  <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
                    <span className={styles.expandIcon} />
                    {/* "Estimate not yet broken out" (owner D5.11) — the old "Not itemized yet"
                        collided with "Not itemized", a different concept on this same table. */}
                    <span className={shared.ledgerName}>Estimate not yet broken out</span>
                  </span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>{fmt(data.buffer)}</span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumMuted}`}>—</span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumMuted}`}>—</span>
                </div>
              </div>
            ) : null;

            const groupProps = { expandedCats, toggleCat, expandedLines, toggleLine, openBehind };

            return (
            // data-sandbox-tour: the beat the demo's "is the season on budget" step rings —
            // planned against actually spent, line by line. Inert off a demo org.
            <div className={styles.section} data-sandbox-tour="budget-variance">
             {/* Budgeted / Actual / Variance side by side IS the report — card-stacking it
                 would remove the sideways scroll and the comparison with it (Chunk A D1). So
                 the grid keeps its shape, scrolls inside its own frame, pins the line name,
                 and says out loud that it scrolls. Frameless: the category cards already have
                 borders, and on a desktop this never overflows at all. */}
             <CoachScrollX sticky frame={false} hint="Swipe the table to see Actual and Variance">
              <div className={styles.gridInner}>
              <div className={`${shared.ledgerHead} ${styles.tableHeader}`}>
                <span className={shared.scrollXStickyCell}>Category / Line Item</span>
                {/* ⚠ THE HEADING MOVES WITH THE BASIS, so a reader who has scrolled past the
                    control can still tell which span these figures cover. "Budgeted" alone over a
                    to-date column is how one report ends up meaning two things. */}
                <span className={shared.thNum}>{planColumnLabel(basis)}</span>
                <span className={shared.thNum}>Actual</span>
                <span className={shared.thNum}>Variance</span>
              </div>

              {view === 'statement' ? (
                /* ── Shape A: the statement ────────────────────────────────────────────────
                   REVENUE → categories → items → Total revenue; EXPENSES → the same → Total
                   expenses; SEASON NET. The shape every treasurer, board and parent already
                   knows, and the one that answers "are we going to be short?" */
                <>
                  {report!.revenue.categories.length > 0 && (
                    <>
                      <SectionBand label="Revenue" />
                      <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                        {/* ⚠ THE DUES ROW IS RECOGNISED BY ITS KEY, the same sentinel pattern
                            `isPayoutCategory` established for the payouts band — the route injects a
                            synthetic category carrying the id the Months band already uses for its
                            dues group, so the two views name one thing one way. It renders itself
                            because it has no records of this report's kind behind it (see
                            `DuesRow`); everything else goes through the ordinary group. */}
                        {report!.revenue.categories.map(cat => (
                          isDuesCategory(cat.categoryId)
                            ? <DuesRow key={catKeyOf(cat)} cat={cat} dues={data.dues} base={base} canWrite={moneyCanWrite} />
                            : <CategoryGroup key={catKeyOf(cat)} cat={cat} {...groupProps} />
                        ))}
                      </div>
                      <SubtotalRow
                        label="Total revenue"
                        budgeted={report!.revenue.budgeted}
                        actual={report!.revenue.actual}
                        variance={report!.revenue.variance}
                        direction="in"
                      />
                    </>
                  )}

                  <SectionBand label="Expenses" />
                  <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                    {report!.expenses.categories.map(cat => (
                      <CategoryGroup key={catKeyOf(cat)} cat={cat} {...groupProps} />
                    ))}
                    {bufferRow}
                  </div>
                  {/* ⚠ THE SEASON TOTAL IS `effectiveBudget` — the categories PLUS the estimate
                      buffer, which is what makes the rows a reader can see add up to this figure.
                      Under To date the buffer is gone (see `bufferRow`), so the total has to come
                      from the re-cut categories instead. Reading `effectiveBudget` under either
                      basis would print a whole-season total over a to-date column and hand a coach
                      a variance measured against two different spans — the exact defect this whole
                      control exists to remove. `headroom` is the season's variance for the same
                      reason. */}
                  <SubtotalRow
                    label="Total expenses"
                    budgeted={basis === 'todate' ? report!.expenses.budgeted : data.effectiveBudget}
                    actual={data.totalActual}
                    variance={basis === 'todate' ? report!.expenses.variance : data.headroom}
                    direction="out"
                  />
                </>
              ) : (
                /* ── Shape B: by activity ──────────────────────────────────────────────────
                   One block per category, split into what it earned and what it cost, ending in
                   what it netted. The question a statement structurally cannot answer, because a
                   category appears in both of its sections: "did hosting the tournament pay for
                   itself?" */
                <>
                  {/* ⚠⚠ DUES LEAD THIS SHAPE TOO, OR THE BLOCKS STOP ADDING UP TO SEASON NET. Both
                      shapes close on the same figure, and it moved when dues joined the revenue
                      half — so a by-activity reading without them would show a coach blocks that
                      sum to one number under a total that says another.
                      ⚠ AS A ROW, NOT A BLOCK. A band, one row and a subtotal would be the words
                      "Player dues" three times over a category that has exactly one figure and can
                      never have a cost half; the payload still carries the block so nothing reading
                      `activities` is short of a category. */}
                  {report!.activities.filter(b => isDuesCategory(b.categoryId)).map(block => (
                    block.revenue && (
                      <DuesRow key="dues" cat={block.revenue} dues={data.dues} base={base} canWrite={moneyCanWrite} />
                    )
                  ))}
                  {report!.activities.filter(b => !isDuesCategory(b.categoryId)).map(block => (
                    <Fragment key={`${block.categoryId ?? 'none'}|${block.categoryName}`}>
                      <SectionBand label={block.categoryName} />
                      {block.revenue && (
                        <>
                          {/* The inner Revenue/Costs bands appear only when the block has BOTH —
                              on a one-sided category they would be a heading distinguishing
                              nothing from nothing. */}
                          {block.costs && <SectionBand label="Revenue" inner />}
                          <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                            <ItemRows cat={block.revenue} expandedLines={expandedLines} toggleLine={toggleLine} openBehind={openBehind} />
                          </div>
                        </>
                      )}
                      {block.costs && (
                        <>
                          {block.revenue && <SectionBand label="Costs" inner />}
                          <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                            <ItemRows cat={block.costs} expandedLines={expandedLines} toggleLine={toggleLine} openBehind={openBehind} />
                          </div>
                        </>
                      )}
                      {/* ⚠ A COST-ONLY BLOCK NETS NEGATIVE, and it says so in brackets rather than
                          being hidden or flipped: that is the honest reading of a category that
                          earned nothing. The label follows suit — "netted" only where something
                          came in. */}
                      <SubtotalRow
                        label={block.revenue ? `${block.categoryName} netted` : `${block.categoryName} cost`}
                        budgeted={block.net.budgeted}
                        actual={block.net.actual}
                        variance={block.net.variance}
                        direction="in"
                      />
                    </Fragment>
                  ))}
                  {bufferRow && (
                    <>
                      <SectionBand label="Estimate not yet broken out" />
                      <div className={`${shared.ledgerList} ${styles.linesContainer}`}>{bufferRow}</div>
                    </>
                  )}
                </>
              )}

              {/* Where both shapes end. */}
              <div className={styles.netRow}>
                {/* ⚠⚠ RENAMED UNDER To date, BY RULING (owner 2026-09-04) — see `netRowLabel`.
                    Under that basis this figure is a CASH-TIMING statement wearing a PROFITABILITY
                    name: a team whose costs run early and whose dues start in October reads deeply
                    under water while its bank balance is fine, and dating every budget line cannot
                    move it. One row, two bases, two honest names. */}
                <span className={shared.scrollXStickyCell}>{netRowLabel(basis)}</span>
                <span className={shared.ledgerTotalNum}>{fmtCell(netBudget)}</span>
                <span className={shared.ledgerTotalNum}>{fmtCell(netActual)}</span>
                <span className={shared.ledgerTotalNum} style={{ color: varianceColor(netVariance) }}>
                  {varianceText(netVariance, 'in')}
                </span>
              </div>

              {/* ⚠⚠ "FUNDED BY PLAYERS" STOOD HERE AND IS DELETED (owner ruling 2026-09-04). The table
                  now ends where a statement ends: Total expenses, Season net, done.

                  Once dues sit in the revenue band above, this row was the budgeted Season net with
                  the sign flipped — always, not on one team. With D = dues billed, F = other income
                  and E = the plan, "plan needs" is E − F, so its shortfall (E − F) − D is exactly
                  −((D + F) − E). Its Actual column was spending less money in, which under this
                  change is Season net's own Actual negated. Two rows, four figures, no new fact.

                  ⚠ THE SHORTFALL STILL SHIPS, and it is the reason the change was worth making — it
                  ships as Season net itself, named by the sentence in the stack below, which is
                  where an explanation belongs rather than in a money column. Do not restore this
                  row; if a figure here seems missing, it is one of the two directly above it. */}
              </div>
             </CoachScrollX>
             {/* THE FOOTNOTE STACK — the variance key, what the bottom line means, and what could
                 not be compared, in the order the owner ruled (2026-09-04).

                 ⚠⚠ EVERY SENTENCE AND EVERY RULING ABOUT ITS WORDING NOW LIVES IN
                 lib/coach-money-report-notes.ts (owner ruling 2026-09-05). The Excel and PDF files
                 carry this stack too, and a note with two authors drifts — which this report has
                 already proved three times. Change the copy there, not here.

                 ⚠ THE PER-NOTE CLASSES SURVIVE. Each of the three has its own, and folding them
                 into one would have restyled the stack on adoption — so the class comes from this
                 call site and the words come from the module. */}
             <ReportNotes
               notes={statementNoteStack}
               noteClassName={n => n.id === 'variance-key' ? styles.varianceKey
                 : n.id === 'dues' ? styles.duesNote : styles.undatedNote}
               controls={{
                 /* The sentence names the control AND is the control. */
                 'compare-to-date': text => (
                   <button type="button" className={styles.bridgeLink} onClick={() => setBasis('todate')}>
                     {text}
                   </button>
                 ),
                 'months-view': text => (
                   <button type="button" className={styles.bridgeLink} onClick={() => setView('months')}>
                     {text}
                   </button>
                 ),
                 'set-dues': text => (
                   <Link href={moneySectionHref(base, 'dues')} className={styles.duesLink}>{text}</Link>
                 ),
               }}
             />
             {/* ⚠ THE BRIDGE BELONGS AT THE FOOT, WITH THE NOTES (owner, 2026-08-24). It was first put
                 under Total expenses, which dropped a bordered panel into the middle of the
                 statement's own closing arithmetic — Total expenses → Season net → Funded by
                 players is one continuous chain and reads as one. A basis is explained where the
                 other bases are explained: underneath, quietly, for the reader who went looking. */}
             <CashBridge data={data} onSeeMonths={() => setView('months')} />

             {/* WHAT IS BEHIND THIS FIGURE (owner ruling 2026-09-04, QA §132 round three).
                 ⚠ THE MONTH GRID SOLVED THIS AND THE STATEMENT DID NOT — the grid's plan panel
                 names every line behind a figure, while this view captioned the merge and stopped.
                 One report answering "which two?" on one of its two views is the drift this report
                 has been consolidated twice to remove. Same words, same shape, same door — and now
                 on the ACTUAL column too, which never had an answer of any kind. */}
             {behind && (
               <RecordsBehind
                 item={behind.item}
                 side={behind.side}
                 base={base}
                 canWrite={moneyCanWrite}
                 onClose={() => setBehind(null)}
               />
             )}
             {/* The Spending trend shelf (D2, G3-approved): the chart, below the table it used to
                 sit above, closed by default and remembered per device. */}
             {data.monthlyChart.length > 1 && (
               <details
                 className={styles.trendShelf}
                 open={trendOpen}
                 onToggle={e => setTrendOpen((e.target as HTMLDetailsElement).open)}
               >
                 <summary className={styles.trendSummary}>
                   <ChevronRight size={13} className={styles.trendChev} aria-hidden />
                   <span><strong>Spending trend</strong> — cumulative actual vs plan, month by month</span>
                 </summary>
                 <div className={styles.trendBody}>
                   {/* ⚠ THE CHART NEVER SHRINKS ITS TEXT AWAY. Inside the shelf it keeps its
                       natural width and SCROLLS on anything narrower — the G3 frame's own
                       behaviour — instead of scaling 10px labels down to 4px at 375px. */}
                   <div className={styles.chartScroll}>
                     <CumulativeChart data={data.monthlyChart} undatedBudget={data.undatedBudget} />
                   </div>
                   <div className={styles.trendLegend}>
                     <span><span className={`${styles.legendSwatch} ${styles.legendBudget}`} aria-hidden /> Budgeted (cumulative)</span>
                     <span><span className={`${styles.legendSwatch} ${styles.legendActual}`} aria-hidden /> Actual (cumulative)</span>
                   </div>
                   {data.undatedBudget > 0.005 && (
                     /* Budget with no date used to be spread evenly across every month here, which
                        put money in months the coach never chose. It is named instead (D-H4) —
                        and the Months view gives it a column of its own.

                        ⚠⚠ "your SPENDING plan", NOT "your plan" (adversarial review, 2026-09-04).
                        This figure is COST lines only — the chart plots spending, and the route
                        derives it from the cost-side lines alone. The sentence under the statement
                        table names undated plan across BOTH bands, so on a team with an undated
                        fundraising or other-income line the two quote different dollars for what
                        read as one fact. Both are right for their own sentence; only the words were
                        wrong. ⚠ IF EITHER SENTENCE'S SCOPE CHANGES, RE-READ THE OTHER — they sit on
                        one screen and are the pair this note exists to keep honest. */
                     <p className={styles.chartNote}>
                       {fmt(data.undatedBudget)} of your spending plan has no date yet and isn&apos;t on this chart.{' '}
                       <button type="button" className={styles.chartNoteLink} onClick={() => setView('months')}>
                         See it by month
                       </button>
                     </p>
                   )}
                 </div>
               </details>
             )}
             {/* ⚠ THE CONDITION MOVED OFF THE DELETED `funding` BLOCK to the thing it was always
                 really about: is there a revenue half on this report at all? `funding` was a
                 stand-in for exactly that test and is gone (route, §9). */}
             {report!.revenue.categories.length > 0 && (
               <p className={styles.fundingNote}>
                 A fundraiser&apos;s actual is your team&apos;s share — everything raised, less anything
                 paid back to the player who raised it (that already lowers their own dues). Money
                 back on something never counts as income: it reduces the row it repaid.
               </p>
             )}
            </div>
            );
          })()}

          </>
          )}
        </>
      )}

    </div>
  );
}
