'use client';
import { useState, useEffect, useCallback, use, Fragment } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TrendingUp, ChevronDown, ChevronRight, ArrowLeft, Tag } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import SampleBudgetSheet from '@/components/coaches/SampleBudgetSheet';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import MoneyMonthGrid, { MONEY_LENSES, type MoneyLens, type MonthGridPayload } from '@/components/coaches/MoneyMonthGrid';
import { formatMonthLabel, lensCell, lensTotal, lensReadsPlan } from '@/lib/coach-budget-months';
import { formatStoredDate } from '@/lib/timezone';
// The coach-money accounting-bracket formatter, shared with the settlement and payout sheets.
import { fmt as fmtBrackets } from '@/lib/coach-money-summary';
import { useMoneyRevision } from '@/lib/coach-money-refresh';
import { toggleKey } from '@/lib/toggle-key';
import { BVA_EXPORT_COLUMNS, bvaCategoryRows } from '@/lib/coach-money-exports';
import { moneySectionHref } from '@/lib/coach-money-links';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import type { ExportColumnDef } from '@/lib/export';
import type { RepTeamTag } from '@/lib/types';
import styles from './bva.module.css';
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
  /** Two or more budget lines summed into this row — worth captioning, per the SUM ruling. */
  lineCount: number;
  /** ⚠ DERIVED, never stored: is there a budget line for this category+item? False = the team was
   *  charged for something it never planned, which is the row this whole change exists to show. */
  inPlan: boolean;
  periods: PeriodResult[];
  /** The money back netted into this row, so it can show what came back and when. */
  refunds: Array<{ id: string; description: string; amount: number; receivedDate: string | null }>;
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

interface UnbudgetedActual {
  id: string;
  description: string;
  category: string | null;
  item: string | null;
  amount: number;
  paidAt: string | null;
}

interface DuesCollection {
  expected: number;
  collected: number;
  outstanding: number;
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
  /** Null when the team plans no money in at all — the closing row simply isn't there. */
  funding: {
    budget: number;
    /** Everything coming in: typed arrivals plus the team's SHARE of what fundraisers raised. */
    actual: number;
    fundedByPlayers: number;
  } | null;
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
  duesCollection: DuesCollection;
  monthlyChart: MonthlyPoint[];
  /** Plan money with no date on it — named so the chart can say what it isn't plotting. */
  undatedBudget: number;
  expenseTags: RepTeamTag[];
  activeTagId: string | null;
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
     congratulatory (/review, correctness lens). */
  if (actual != null && actual < -0.005) return '—';
  return `${fmt(v)} ${v > 0 ? 'under' : 'over'}`;
}

// The category table's columns and rows are NOT declared here — they live in
// `lib/coach-money-exports` beside the Money hub's own "Budget vs. actual" export, so the two
// cannot become two different spreadsheets. Only the MONTH-GRID export is local to this file,
// because its shape depends on the view and lens the coach chose (rule 12).

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

function CumulativeChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) return null;

  const VW = 760, VH = 160;
  const ML = 64, MR = 12, MT = 12, MB = 32;
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

  const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => ({
    y: MT + (1 - ratio) * CH,
    label: fmt(maxVal * ratio),
  }));

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* SVG presentation attributes can't resolve var(); colours live in inline style
          so the warm gate reaches them. Fallbacks keep dark byte-identical. */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={ML} y1={g.y} x2={ML + CW} y2={g.y}
            style={{ stroke: 'var(--home-line, rgba(255,255,255,0.06))' }} strokeWidth="1" />
          <text x={ML - 4} y={g.y + 4} textAnchor="end" fontSize="9"
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

      {data.map((d, i) => {
        if (n > 8 && i % 2 !== 0) return null;
        return (
          <text key={i} x={xPos(i)} y={VH - 6} textAnchor="middle" fontSize="9"
            style={{ fill: 'var(--home-dim, rgba(255,255,255,0.35))' }}>
            {fmtMonth(d.month)}
          </text>
        );
      })}

      <g transform={`translate(${ML + 8},${MT + 8})`}>
        <line x1="0" y1="6" x2="18" y2="6" style={{ stroke: 'var(--info-light)' }} strokeWidth="2"
          strokeDasharray="5,3" opacity="0.7" />
        <text x="22" y="10" fontSize="9" style={{ fill: 'var(--home-dim, rgba(255,255,255,0.45))' }}>Budgeted (cumulative)</text>
        <line x1="132" y1="6" x2="150" y2="6" style={{ stroke: 'var(--success-light)' }} strokeWidth="2" />
        <text x="154" y="10" fontSize="9" style={{ fill: 'var(--home-dim, rgba(255,255,255,0.45))' }}>Actual (cumulative)</text>
      </g>
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

/**
 * The item rows of one category — shared by both shapes, so the statement and the by-activity
 * lens can never render one row two different ways.
 */
function ItemRows({
  cat, expandedLines, toggleLine,
}: {
  cat: CategoryResult;
  expandedLines: Set<string>;
  toggleLine: (id: string) => void;
}) {
  const catKey = catKeyOf(cat);
  return (
    <>
      {cat.items.map(item => {
        const key = `${catKey}|${item.itemId ?? 'none'}`;
        const open = expandedLines.has(key);
        return (
          <Fragment key={key}>
            <div className={`${shared.ledgerRow} ${styles.lineMain} ${item.inPlan ? '' : styles.unplannedRow}`}>
              <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
                {item.periods.length > 0 ? (
                  <button
                    className={shared.ledgerExpand}
                    aria-expanded={open}
                    aria-label={open ? `Hide ${item.itemName}'s periods` : `Show ${item.itemName}'s periods`}
                    onClick={() => toggleLine(key)}
                  >
                    {open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                  </button>
                ) : (
                  <span className={shared.ledgerExpandSpacer} />
                )}
                <span className={shared.ledgerDesc}>{item.itemName}</span>
                {/* Two or more lines summed into one row is the SUM ruling made visible — without
                    the caption a coach would wonder why their plan has fewer rows than they wrote. */}
                {item.lineCount > 1 && (
                  <span className={shared.ledgerNote}>{item.lineCount} lines</span>
                )}
              </span>
              <span className={`${shared.ledgerNum} ${item.inPlan ? '' : shared.ledgerNumMuted}`}>
                {item.inPlan ? fmt(item.budgeted) : '—'}
              </span>
              <span className={shared.ledgerNum}>{fmtCell(item.actual)}</span>
              <span className={shared.ledgerNum} style={{ color: varianceColor(item.variance) }}>
                {varianceText(item.variance, item.direction, item.actual)}
              </span>
            </div>

            {/* ⚠ ONE ROW, NEVER TWO (money-back plan §4.3). A refund nets into the item, and the
                figures underneath say what made that number rather than splitting it: "$2,400 paid
                · $150 back". Two rows would make a coach add up in their head to answer the one
                question the row exists for. ⚠ NO "refund" CHIP AND NO ROW LABEL — the same ruling
                that retired "not budgeted" from both views. */}
            {item.refundTotal > 0.005 && (
              <div className={shared.ledgerSubRows}>
                <div className={`${shared.ledgerSubRow} ${styles.periodRow}`}>
                  <span className={`${shared.ledgerSubLabel} ${shared.scrollXStickyCell} ${shared.wrap640}`}>
                    {fmt(item.grossActual)} {item.direction === 'in' ? 'received' : 'paid'} · {fmt(item.refundTotal)} back
                  </span>
                  <span className={shared.ledgerSubMeta}>
                    {item.refunds.map(r => formatStoredDate(r.receivedDate, { withYear: false })).join(' · ')}
                  </span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumMuted}`}>—</span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumMuted}`}>—</span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumMuted}`}>—</span>
                </div>
              </div>
            )}

            {open && item.periods.length > 0 && (
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
                        style={moved ? { color: varianceColor(variance) } : undefined}
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
  cat, expandedCats, toggleCat, expandedLines, toggleLine,
}: {
  cat: CategoryResult;
  expandedCats: Set<string>;
  toggleCat: (id: string) => void;
  expandedLines: Set<string>;
  toggleLine: (id: string) => void;
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
        </span>
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong} ${cat.inPlan ? '' : shared.ledgerNumMuted}`}>
          {cat.inPlan ? fmt(cat.budgeted) : '—'}
        </span>
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>{fmtCell(cat.actual)}</span>
        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`} style={{ color: varianceColor(cat.variance) }}>
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
          <ItemRows cat={cat} expandedLines={expandedLines} toggleLine={toggleLine} />
        </div>
      )}
    </div>
  );
}

/** A REVENUE / EXPENSES band, or an activity's own name. */
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
      <span className={shared.ledgerNum} style={{ color: varianceColor(variance) }}>
        {varianceText(variance, direction, actual)}
      </span>
    </div>
  );
}

export function BudgetVsActualPanel({
  params: paramsPromise,
  embedded = false,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Rendered as a Money hub tab — suppress the standalone "back to Money" affordance. */
  embedded?: boolean;
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
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Money-tag filter (Phase 3): scope the actuals to expenses carrying a tag (server-side).
  const [filterTagId, setFilterTagId] = useState<string | null>(null);

  /* ⚠ THE RECATEGORIZE FIX-IT IS GONE (mig 240), and its absence is deliberate. It existed to
     move an expense onto a real CATEGORY so it stopped sitting in a separate Unbudgeted list at the
     foot of the report. There is no such list now: unplanned spending appears in its own category
     and item row, flagged, in place. And the fix itself moved — a coach opens the cost and picks
     its item, which is the same control that files it correctly in the first place, rather than a
     second half-strength editor that could only ever set the coarser of the two levels. */

  // No PDF-settings fetch here any more: MoneyExportButton loads the org's branding on the FIRST
  // PDF export and remembers it, rather than every Money tab requesting it on mount for a file
  // most coaches never ask for.

  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
  // This page already carries a tag filter, so the season has to MERGE into the same query
  // string rather than append a second `?`.
  const bvaQuery = (() => {
    const qs = new URLSearchParams();
    if (filterTagId) qs.set('tagId', filterTagId);
    if (page.season.isReadOnly && page.season.current) qs.set('year', page.season.current.programYearId);
    const q = qs.toString();
    return q ? `?${q}` : '';
  })();
  const assignment = assignments.find(a => a.teamId === teamId);
  const moneyCanWrite = page.canWrite(page.capabilities?.money === 'write');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // ⚠ ONE REQUEST NOW. The item taxonomy was fetched alongside the report purely to fill the
      // Recategorize picker, which mig 240 retired — the report names every category and item
      // itself, so a second call would load a list nothing reads.
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-vs-actual${bvaQuery}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, filterTagId, bvaQuery]);

  // Budget lines imported from the hub's Import menu change what this report compares against,
  // so it re-reads on the same signal — without remounting anything.
  const moneyRevision = useMoneyRevision();
  useEffect(() => { load(); }, [load, moneyRevision]);

  const prefsKey = assignment ? `flhq-coach-bva-view:${teamId}:${assignment.programYearId}` : null;
  useEffect(() => {
    if (!prefsKey) return;
    try {
      const raw = localStorage.getItem(prefsKey);
      // Shape-check, not just parse-check: a corrupt value must fall back, never crash.
      const parsed = raw ? JSON.parse(raw) as { view?: unknown; lens?: unknown } : {};
      // ⚠ The retired `categories` value still resolves — see `readStoredView`. It is stored per
      // device, so refusing it would silently reset every treasurer who had chosen a view.
      const stored = readStoredView(parsed.view);
      if (stored) setView(stored);
      if (MONEY_LENSES.some(l => l.id === parsed.lens)) setLens(parsed.lens as MoneyLens);
    } catch { /* device memory only */ }
    setPrefsLoaded(true);
  }, [prefsKey]);

  useEffect(() => {
    // Don't write back the defaults before the read has happened, or the first render would
    // stomp a remembered preference.
    if (!prefsKey || !prefsLoaded) return;
    try { localStorage.setItem(prefsKey, JSON.stringify({ view, lens })); } catch { /* device memory only */ }
  }, [prefsKey, prefsLoaded, view, lens]);

  // ── Export helpers ─────────────────────────────────────────────────────────
  // The export always matches what is on screen. In the Months view that means the month grid
  // in the SELECTED lens, with the months as columns — the same shape the import template will
  // take, so today's export is tomorrow's import.
  function monthExportColumns(): ExportColumnDef[] {
    const g = data!.monthGrid;
    const cols: ExportColumnDef[] = [{ label: 'Category / line', key: 'item', format: 'text' }];
    if (data!.priorSeasonLabel) cols.push({ label: data!.priorSeasonLabel, key: 'prior', format: 'currency' });
    if (g.totals.undatedBudget > 0.005) cols.push({ label: 'No date yet', key: 'undated', format: 'currency' });
    for (const m of g.months) cols.push({ label: formatMonthLabel(m), key: `m_${m}`, format: 'currency' });
    cols.push({ label: 'Total', key: 'total', format: 'currency' });
    return cols;
  }

  // The export shares the grid's own lens maths (`lensCell`/`lensTotal`/`lensReadsPlan`), so a
  // downloaded file can never disagree with the screen it was downloaded from.
  function buildMonthExportRows(): Array<Record<string, string | number>> {
    const g = data!.monthGrid;
    const { todayMonth, priorSeasonLabel } = data!;
    const undatedLive = lensReadsPlan(lens);
    const rows: Array<Record<string, string | number>> = [];

    /** A category or grand-total row: every lens has something to say about it. */
    function aggregateRow(
      item: string,
      cells: typeof g.totals.cells,
      total: typeof g.totals.total,
      undatedBudget: number,
      priorTotal: number | null,
    ): Record<string, string | number> {
      const row: Record<string, string | number> = { item };
      if (priorSeasonLabel) row.prior = priorTotal ?? '';
      row.undated = undatedLive ? undatedBudget : '';
      g.months.forEach((m, i) => { row[`m_${m}`] = lensCell(cells[i], lens, m, todayMonth) ?? ''; });
      row.total = lensTotal(total, lens);
      return row;
    }

    for (const cat of g.categories) {
      rows.push(aggregateRow(cat.categoryName, cat.cells, cat.total, cat.undatedBudget, cat.priorTotal));

      // Only the BUDGET is known per line — actuals and commitments are matched to a category,
      // not a line — so a line row is blank under every other lens, exactly as on screen.
      for (const line of cat.lines) {
        const lr: Record<string, string | number> = { item: `  — ${line.description}` };
        if (priorSeasonLabel) lr.prior = line.priorTotal ?? '';
        lr.undated = undatedLive ? line.undatedBudget : '';
        g.months.forEach((m, i) => { lr[`m_${m}`] = lens === 'budget' ? line.cells[i].budget : ''; });
        lr.total = lens === 'budget' ? line.total.budget : '';
        rows.push(lr);
      }
    }

    rows.push(aggregateRow('Total', g.totals.cells, g.totals.total, g.totals.undatedBudget, g.totals.priorTotal));
    return rows;
  }

  const inMonthView = view === 'months' && !!data?.monthGrid;
  const exportCols = inMonthView ? monthExportColumns() : BVA_EXPORT_COLUMNS;
  const exportTitle = inMonthView
    ? `Budget by month — ${MONEY_LENSES.find(l => l.id === lens)?.label}`
    : 'Budget vs. Actual';

  function buildRows(): Array<Record<string, string | number>> {
    return inMonthView ? buildMonthExportRows() : buildExportRows();
  }

  function buildExportRows() {
    // The category table comes from the SHARED builder, so this page's export and the Money hub's
    // "Budget vs. actual" row produce the same file — including the buffer and unbudgeted rows,
    // without which the spreadsheet's totals would disagree with the screen.
    return bvaCategoryRows(data);
  }


  /**
   * Everything the export needs, built AT CLICK TIME from what is on screen — the view, the
   * reading, the whole lot. This is the reason Export sits on the tab rather than in the hub
   * header: none of it is visible from up there, and pretending otherwise is what gave this
   * screen two Export buttons producing different files (owner ruling 2026-08-13).
   */
  function buildExport() {
    return {
      dataset: inMonthView ? `budget-by-month-${lens}` : 'budget-vs-actual',
      title: exportTitle,
      columns: exportCols,
      rows: buildRows(),
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
      emptyMessage: inMonthView
        ? 'There is nothing in this month view to export yet.'
        : 'Budget vs. Actual has nothing to report yet — it needs a budget plan.',
    };
  }

  function toggleCat(name: string) { setExpandedCats(prev => toggleKey(prev, name)); }
  function toggleLine(id: string)  { setExpandedLines(prev => toggleKey(prev, id)); }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
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
  const bvaExport = (
    <MoneyExportButton
      label={inMonthView ? 'Budget by month' : 'Budget vs. actual'}
      formats={['xlsx', 'csv', 'pdf']}
      build={buildExport}
      disabled={!data || (data.effectiveBudget === 0 && data.totalActual === 0)}
    />
  );

  return (
    <div className={styles.page}>
      {!embedded && (
        <Link href={`${base}/accounting${seasonQuery}`} className={shared.lineupBackLink}>
          <ArrowLeft size={14} aria-hidden /> Back to Money
        </Link>
      )}
      {/* Page-header ruling 2026-08-11: one shape, actions right, "?" in its fixed corner. */}
      <CoachPageHeader
        variant={embedded ? 'embedded' : 'standard'}
        icon={TrendingUp}
        title="Budget vs. Actual"
        season={page.season}
        teamBase={page.teamBase}
        helpLabel="Budget vs. Actual"
        /* Points at the SHAPES topic, not the month grid: Statement is what this page opens on
           now, and the "?" should explain the thing in front of the reader. */
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-report-shapes', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : !data || data.effectiveBudget === 0 ? (
        <>
          <CoachEmptyState
            icon={<TrendingUp size={22} aria-hidden />}
            eyebrow="Budget vs. actual"
            headline="No budget plan yet"
            description="Create a budget plan to start tracking estimated spend against your actual ledger."
            primaryAction={{ label: 'Create a budget plan', href: moneySectionHref(base, 'budget', undefined, seasonQuery) }}
            secondaryAction={{ label: 'See a finished example', onClick: () => setSampleOpen(true) }}
          />
          {sampleOpen && <SampleBudgetSheet initialTab="bva" onClose={() => setSampleOpen(false)} />}
        </>
      ) : (
        <>
          {/* Money-tag filter chip row — scopes the actuals to one tag's spending (self-hides at
              zero tagged expenses). Blue = org-shared, lime = team's own. */}
          {data.expenseTags.length > 0 && (
            <>
              <div className={shared.moneyFilterBar}>
                <Tag size={13} style={{ color: 'var(--white-40)' }} aria-hidden />
                <span style={{ fontSize: '0.72rem', color: 'var(--white-40)', marginRight: '0.1rem' }}>Filter by tag:</span>
                {data.expenseTags.map(t => {
                  const isOrg = t.teamId === null;
                  const active = filterTagId === t.id;
                  const cls = `${shared.moneyFilterChip} ${active ? shared.moneyFilterChipActive : ''} ${isOrg ? (active ? shared.moneyFilterChipOrgActive : shared.moneyFilterChipOrg) : ''}`;
                  return (
                    <button key={t.id} className={cls} onClick={() => setFilterTagId(active ? null : t.id)}>{t.name}</button>
                  );
                })}
              </div>
              <div className={shared.tagComboLegend} style={{ margin: '-0.2rem 0 0.7rem' }}>
                <span className={shared.tagComboLegendItem}>
                  <span className={shared.tagComboLegendDot} style={{ background: 'rgba(var(--blueprint-blue-rgb),0.55)', border: '1px solid rgba(var(--blueprint-blue-rgb),0.7)' }} /> Org tag
                </span>
                <span className={shared.tagComboLegendItem}>
                  <span className={shared.tagComboLegendDot} style={{ background: 'rgba(var(--logic-lime-rgb),0.55)', border: '1px solid rgba(var(--logic-lime-rgb),0.7)' }} /> Team tag
                </span>
              </div>
            </>
          )}
          {filterTagId && (
            <div className={shared.moneyTagSummary}>
              vs <strong>{data.expenseTags.find(t => t.id === filterTagId)?.name ?? 'tag'}</strong>: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(data.totalActual)}</span> spent (budget plan shown in full)
            </div>
          )}

          {/* Headroom summary */}
          <div className={`${styles.summaryBanner} ${shared.stack640}`}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Headroom</span>
              <span
                className={styles.summaryValue}
                style={{ color: data.headroom >= 0 ? 'var(--success-light)' : 'var(--danger-light)', fontSize: '1.45rem' }}
              >
                {data.headroom < 0 ? '-' : '+'}{fmt(data.headroom)}
              </span>
              <span className={styles.summaryHint}>
                {data.headroom >= 0 ? 'under budget' : 'over budget'}
              </span>
            </div>
            <div className={styles.summaryDivider} />
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Budget</span>
              <span className={styles.summaryValue}>{fmt(data.effectiveBudget)}</span>
              {data.buffer > 0 && (
                <span className={styles.summaryHint}>incl. {fmt(data.buffer)} not itemized yet</span>
              )}
              {/* When the plan is over its own estimate this report measures against the ESTIMATE
                  (the shared rule), which is a lower number than the lines add up to. The budget
                  page says so in red; without this the report just showed the smaller figure and
                  left the coach to notice — the same two-pages-disagree problem the rule fixed. */}
              {data.overPlanned && (
                <span className={styles.summaryHint} style={{ color: 'var(--danger-light)' }}>
                  your lines are {fmt(Math.abs(data.estimateDifference))} over this estimate
                </span>
              )}
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Actual</span>
              <span className={styles.summaryValue}>{fmt(data.totalActual)}</span>
            </div>
          </div>

          {/* Dues collection */}
          {(data.duesCollection.expected > 0 || data.duesCollection.collected > 0) && (
            <div className={styles.duesCard}>
              <span className={styles.duesTitle}>Dues Collection</span>
              <div className={styles.duesRow}>
                <div className={styles.duesStat}>
                  <span className={styles.summaryLabel}>Expected</span>
                  <span className={styles.duesValue}>{fmt(data.duesCollection.expected)}</span>
                </div>
                <div className={styles.duesStat}>
                  <span className={styles.summaryLabel}>Collected</span>
                  <span className={styles.duesValue} style={{ color: 'var(--success-light)' }}>
                    {fmt(data.duesCollection.collected)}
                  </span>
                </div>
                <div className={styles.duesStat}>
                  <span className={styles.summaryLabel}>Outstanding</span>
                  <span
                    className={styles.duesValue}
                    style={{ color: data.duesCollection.outstanding > 0 ? 'var(--danger-light)' : undefined }}
                  >
                    {fmt(data.duesCollection.outstanding)}
                  </span>
                </div>
                {data.duesCollection.expected > 0 && (
                  <div className={styles.duesStat}>
                    <span className={styles.summaryLabel}>Collection Rate</span>
                    <span className={styles.duesValue}>
                      {Math.round((data.duesCollection.collected / data.duesCollection.expected) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ⚠ THE TWO NEW SHAPES JOIN THE CONTROL THAT WAS ALREADY HERE (plan §3.5), rather than
              introducing a second idea of "switching views" beside it. Statement is the default —
              the shape a treasurer, a board and a parent already know, and the one that answers
              "are we going to be short?" By activity answers what a statement structurally cannot,
              because a category appears in both its sections: "did hosting the tournament pay for
              itself?" Months is the treasurer's spreadsheet shape and is money-OUT only. */}
          <div className={styles.viewBar}>
            <span className={styles.viewBarLabel}>View</span>
            <div className={shared.segChoice} role="group" aria-label="Report view">
              {([
                ['statement', 'Statement'],
                ['activity', 'By activity'],
                ['months', 'Months'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${shared.segBtn} ${view === id ? shared.segBtnActive : ''}`}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === 'months' && (
              <>
                <span className={styles.viewBarLabel}>Showing</span>
                <div className={shared.segChoice} role="group" aria-label="What each cell shows">
                  {MONEY_LENSES.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      className={`${shared.segBtn} ${lens === l.id ? shared.segBtnActive : ''}`}
                      aria-pressed={lens === l.id}
                      /* The visible label abbreviates on a phone ("Diff."); the accessible name
                         must not — a screen reader should hear the whole word at every width. */
                      aria-label={l.label}
                      onClick={() => setLens(l.id)}
                    >
                      <span className={styles.lensFull}>{l.label}</span>
                      <span className={styles.lensShort}>{l.short}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* On EVERY view, not just the month one — it exports whichever is on screen, so it
                has no reason to appear and disappear. Standalone route included: this row is on
                both, which is what stops the two shapes drifting apart. */}
            <span className={shared.panelToolbarActions}>{bvaExport}</span>
          </div>

          {view === 'months' ? (
            <MoneyMonthGrid
              data={data}
              lens={lens}
              base={base}
              canWrite={moneyCanWrite}
              seasonQuery={seasonQuery}
            />
          ) : (
          <>
          {/* Monthly cumulative chart */}
          {data.monthlyChart.length > 1 && (
            <div className={styles.chartCard}>
              <p className={styles.chartTitle}>Cumulative Spending vs. Budget</p>
              <CumulativeChart data={data.monthlyChart} />
              {data.undatedBudget > 0.005 && (
                /* Budget with no date used to be spread evenly across every month here, which
                   put money in months the coach never chose. It is now named instead (D-H4) —
                   and the Months view gives it a column of its own. */
                <p className={styles.chartNote}>
                  {fmt(data.undatedBudget)} of your plan has no date yet and isn&apos;t on this chart.{' '}
                  <button type="button" className={styles.chartNoteLink} onClick={() => setView('months')}>
                    See it by month
                  </button>
                </p>
              )}
            </div>
          )}

          {/* ── The report, in whichever shape the coach chose (plan §3.5) ──────────────────
              Both come off ONE grouping pass on the server and end on the same season net,
              because they are the same rows read two ways. */}
          {(data.report.revenue.categories.length > 0 || data.report.expenses.categories.length > 0) && (() => {
            /* ⚠ THE SERVER'S FIGURE, not a fourth recomputation. It is measured against the
               EFFECTIVE budget — the estimate whenever a coach has set one (owner ruling
               2026-08-12, shared with the plan page, the Money hub and headroom) — which is the
               same number the Total expenses row below shows. Both shapes and the export read it. */
            const { budgeted: netBudget, actual: netActual, variance: netVariance } = data.report.net;

            /* The part of the estimated total not yet covered by lines. Positive only — an
               estimate BELOW the lines has nothing unallocated to stand in for, and a negative
               pseudo-row here would read as a refund. Rendered in BOTH shapes so the rows a reader
               can see add up to the same Total expenses either way. */
            const bufferRow = data.buffer > 0 ? (
              <div className={shared.ledgerGroup}>
                <div className={`${shared.ledgerGroupHead} ${styles.categoryHeader}`}>
                  <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
                    <span className={styles.expandIcon} />
                    <span className={shared.ledgerName}>Not itemized yet</span>
                  </span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>{fmt(data.buffer)}</span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumMuted}`}>—</span>
                  <span className={`${shared.ledgerNum} ${shared.ledgerNumMuted}`}>—</span>
                </div>
              </div>
            ) : null;

            const groupProps = { expandedCats, toggleCat, expandedLines, toggleLine };

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
                <span className={shared.thNum}>Budgeted</span>
                <span className={shared.thNum}>Actual</span>
                <span className={shared.thNum}>Variance</span>
              </div>

              {view === 'statement' ? (
                /* ── Shape A: the statement ────────────────────────────────────────────────
                   REVENUE → categories → items → Total revenue; EXPENSES → the same → Total
                   expenses; SEASON NET. The shape every treasurer, board and parent already
                   knows, and the one that answers "are we going to be short?" */
                <>
                  {data.report.revenue.categories.length > 0 && (
                    <>
                      <SectionBand label="Revenue" />
                      <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                        {data.report.revenue.categories.map(cat => (
                          <CategoryGroup key={catKeyOf(cat)} cat={cat} {...groupProps} />
                        ))}
                      </div>
                      <SubtotalRow
                        label="Total revenue"
                        budgeted={data.report.revenue.budgeted}
                        actual={data.report.revenue.actual}
                        variance={data.report.revenue.variance}
                        direction="in"
                      />
                    </>
                  )}

                  <SectionBand label="Expenses" />
                  <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                    {data.report.expenses.categories.map(cat => (
                      <CategoryGroup key={catKeyOf(cat)} cat={cat} {...groupProps} />
                    ))}
                    {bufferRow}
                  </div>
                  <SubtotalRow
                    label="Total expenses"
                    budgeted={data.effectiveBudget}
                    actual={data.totalActual}
                    variance={data.headroom}
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
                  {data.report.activities.map(block => (
                    <Fragment key={`${block.categoryId ?? 'none'}|${block.categoryName}`}>
                      <SectionBand label={block.categoryName} />
                      {block.revenue && (
                        <>
                          {/* The inner Revenue/Costs bands appear only when the block has BOTH —
                              on a one-sided category they would be a heading distinguishing
                              nothing from nothing. */}
                          {block.costs && <SectionBand label="Revenue" inner />}
                          <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                            <ItemRows cat={block.revenue} expandedLines={expandedLines} toggleLine={toggleLine} />
                          </div>
                        </>
                      )}
                      {block.costs && (
                        <>
                          {block.revenue && <SectionBand label="Costs" inner />}
                          <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                            <ItemRows cat={block.costs} expandedLines={expandedLines} toggleLine={toggleLine} />
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
                      <SectionBand label="Not itemized yet" />
                      <div className={`${shared.ledgerList} ${styles.linesContainer}`}>{bufferRow}</div>
                    </>
                  )}
                </>
              )}

              {/* Where both shapes end. */}
              <div className={styles.netRow}>
                <span className={shared.scrollXStickyCell}>Season net</span>
                <span className={shared.ledgerTotalNum}>{fmtCell(netBudget)}</span>
                <span className={shared.ledgerTotalNum}>{fmtCell(netActual)}</span>
                <span className={shared.ledgerTotalNum} style={{ color: varianceColor(netVariance) }}>
                  {varianceText(netVariance, 'in')}
                </span>
              </div>

              {/* What players actually had to fund, once everything coming in is taken off. The
                  season net above is the books; this is the one figure a coach is asked for by a
                  parent, and it closes the same subtraction the budget plan's summary makes so the
                  two pages end on the same number. */}
              {data.funding && (() => {
                const fundedActual = data.totalActual - data.funding.actual;
                const fundedVariance = data.funding.fundedByPlayers - fundedActual;
                return (
                  <div className={`${shared.ledgerTotal} ${styles.grandTotal}`}>
                    <span className={shared.scrollXStickyCell}>Funded by players</span>
                    <span className={shared.ledgerTotalNum}>{fmt(data.funding.fundedByPlayers)}</span>
                    <span className={shared.ledgerTotalNum}>{fmtCell(fundedActual)}</span>
                    <span className={shared.ledgerTotalNum} style={{ color: varianceColor(fundedVariance) }}>
                      {varianceText(fundedVariance, 'out')}
                    </span>
                  </div>
                );
              })()}
              </div>
             </CoachScrollX>
             {data.funding && (
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
