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
  budgeted: number;
  actual: number;
  variance: number;
  /** Two or more budget lines summed into this row — worth captioning, per the SUM ruling. */
  lineCount: number;
  /** ⚠ DERIVED, never stored: is there a budget line for this category+item? False = the team was
   *  charged for something it never planned, which is the row this whole change exists to show. */
  inPlan: boolean;
  periods: PeriodResult[];
}

interface CategoryResult {
  categoryId: string | null;
  categoryName: string;
  budgeted: number;
  actual: number;
  variance: number;
  /** False when nothing in this category was ever budgeted — the whole heading is unplanned. */
  inPlan: boolean;
  items: ItemResult[];
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
  /** Null when the team budgets no expected funding — the row simply isn't there. */
  funding: {
    budget: number;
    /** The team's SHARE of what was raised: total less what went back to the players. */
    actual: number;
    lines: Array<{ id: string; description: string; amount: number }>;
    fundedByPlayers: number;
  } | null;
  totalActual: number;
  /** How much of `totalActual` went on items nobody planned. A figure to NAME, never to add. */
  unbudgeted: number;
  categories: CategoryResult[];
  unbudgetedActuals: UnbudgetedActual[];
  duesCollection: DuesCollection;
  monthlyChart: MonthlyPoint[];
  /** Plan money with no date on it — named so the chart can say what it isn't plotting. */
  undatedBudget: number;
  expenseTags: RepTeamTag[];
  activeTagId: string | null;
}

type BvaView = 'categories' | 'months';

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
  const [view, setView] = useState<BvaView>('categories');
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
      if (parsed.view === 'months' || parsed.view === 'categories') setView(parsed.view);
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
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-months', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
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

          {/* Chunk H — how the coach wants to read the same report. Categories is the shipped
              view and stays the default; Months is the treasurer's spreadsheet shape. */}
          <div className={styles.viewBar}>
            <span className={styles.viewBarLabel}>View</span>
            <div className={shared.segChoice} role="group" aria-label="Report view">
              <button
                type="button"
                className={`${shared.segBtn} ${view === 'categories' ? shared.segBtnActive : ''}`}
                aria-pressed={view === 'categories'}
                onClick={() => setView('categories')}
              >
                Categories
              </button>
              <button
                type="button"
                className={`${shared.segBtn} ${view === 'months' ? shared.segBtnActive : ''}`}
                aria-pressed={view === 'months'}
                onClick={() => setView('months')}
              >
                Months
              </button>
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

          {/* Category breakdown */}
          {data.categories.length > 0 && (
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

              <div className={`${shared.ledgerList} ${styles.linesContainer}`}>
                {data.categories.map(cat => {
                  /* ⚠ A CATEGORY NOBODY BUDGETED FOR IS THE POINT, NOT AN EDGE CASE (owner ruling
                     2026-08-15). It carries no Budgeted figure at all, so the row is flagged and
                     the dash is explained by the flag rather than left to read as a lost number.
                     The sentence rides the header via aria-describedby: a screen reader meeting a
                     bare em-dash in the Budgeted column would otherwise get no explanation at all,
                     because the flag is a visual one (/review, 2026-08-15). */
                  const noteId = cat.inPlan ? undefined : `bva-cat-note-${cat.categoryName}`;
                  return (
                  <div key={cat.categoryName} className={shared.ledgerGroup}>
                    <button
                      className={`${shared.ledgerGroupHead} ${shared.ledgerGroupHeadBtn} ${styles.categoryHeader} ${cat.inPlan ? '' : styles.unplannedRow}`}
                      aria-expanded={expandedCats.has(cat.categoryName)}
                      aria-describedby={noteId}
                      onClick={() => toggleCat(cat.categoryName)}
                    >
                      <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
                        <span className={styles.expandIcon}>
                          {expandedCats.has(cat.categoryName)
                            ? <ChevronDown size={14} aria-hidden />
                            : <ChevronRight size={14} aria-hidden />}
                        </span>
                        <span className={shared.ledgerName}>{cat.categoryName}</span>
                        {/* ⚠ THE "not budgeted" TAG WAS REMOVED HERE (owner ruling 2026-08-15) —
                            the dash in the Budget column one cell to the right already says it, and
                            the label was the same fact twice. The amber ground stays as the scanning
                            cue and `aria-describedby` still carries the sentence, so the meaning
                            survives for a reader who cannot see the tint. */}
                      </span>
                      <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong} ${cat.inPlan ? '' : shared.ledgerNumMuted}`}>
                        {cat.inPlan ? fmt(cat.budgeted) : '—'}
                      </span>
                      <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>{fmt(cat.actual)}</span>
                      <span
                        className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}
                        style={{ color: varianceColor(cat.variance) }}
                      >
                        {fmtVariance(cat.variance)}
                      </span>
                    </button>
                    {noteId && (
                      <p id={noteId} className={styles.srOnly}>
                        Nothing in {cat.categoryName} was budgeted for this season.
                      </p>
                    )}

                    {expandedCats.has(cat.categoryName) && (
                      <div>
                        {cat.items.map(item => {
                          const key = `${cat.categoryName}|${item.itemId ?? 'none'}`;
                          const open = expandedLines.has(key);
                          return (
                          <Fragment key={key}>
                            <div className={`${shared.ledgerRow} ${styles.lineMain} ${item.inPlan ? '' : styles.unplannedRow}`}>
                              <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
                                {item.periods.length > 0 ? (
                                  <button
                                    className={shared.ledgerExpand}
                                    aria-expanded={open}
                                    aria-label={open
                                      ? `Hide ${item.itemName}'s periods`
                                      : `Show ${item.itemName}'s periods`}
                                    onClick={() => toggleLine(key)}
                                  >
                                    {open
                                      ? <ChevronDown size={13} aria-hidden />
                                      : <ChevronRight size={13} aria-hidden />}
                                  </button>
                                ) : (
                                  <span className={shared.ledgerExpandSpacer} />
                                )}
                                <span className={shared.ledgerDesc}>{item.itemName}</span>
                                {/* Two or more lines summed into one row is the SUM ruling made
                                    visible — without the caption a coach would wonder why their
                                    plan has fewer rows than they wrote. */}
                                {item.lineCount > 1 && (
                                  <span className={shared.ledgerNote}>{item.lineCount} lines</span>
                                )}
                                {/* The item's own "not budgeted" tag went with the category's — see
                                    the note on the category header above. The dash in this row's
                                    Budget cell, one span down, is the signal. */}
                              </span>
                              <span className={`${shared.ledgerNum} ${item.inPlan ? '' : shared.ledgerNumMuted}`}>
                                {item.inPlan ? fmt(item.budgeted) : '—'}
                              </span>
                              {/* ⚠ EVERY ROW NOW CARRIES A REAL FIGURE. This column printed "—"
                                  unconditionally until 2026-08-15, because spending recorded a
                                  category and nothing finer; the item is what made it knowable. */}
                              <span className={shared.ledgerNum}>{fmt(item.actual)}</span>
                              <span
                                className={shared.ledgerNum}
                                style={{ color: varianceColor(item.variance) }}
                              >
                                {fmtVariance(item.variance)}
                              </span>
                            </div>

                            {open && item.periods.length > 0 && (
                              <div className={shared.ledgerSubRows}>
                                {item.periods.map((p, pi) => {
                                  const spent = p.actual > 0;
                                  const variance = p.amount - p.actual;
                                  return (
                                    <div key={pi} className={`${shared.ledgerSubRow} ${styles.periodRow}`}>
                                      <span className={`${shared.ledgerSubLabel} ${shared.scrollXStickyCell} ${shared.wrap640}`}>{p.label}</span>
                                      <span className={shared.ledgerSubMeta}>
                                        {p.date
                                          ? new Date(p.date + 'T12:00:00').toLocaleDateString('en-CA', {
                                              month: 'short', day: 'numeric', year: 'numeric',
                                            })
                                          : ''}
                                      </span>
                                      <span className={shared.ledgerNum}>{fmt(p.amount)}</span>
                                      <span
                                        className={`${shared.ledgerNum} ${spent ? '' : shared.ledgerNumMuted}`}
                                        style={spent ? { color: 'var(--success-light)' } : undefined}
                                      >
                                        {spent ? fmt(p.actual) : '—'}
                                      </span>
                                      <span
                                        className={`${shared.ledgerNum} ${spent ? '' : shared.ledgerNumMuted}`}
                                        style={spent ? { color: varianceColor(variance) } : undefined}
                                      >
                                        {spent ? fmtVariance(variance) : '—'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* The part of the estimated total not yet covered by lines. Positive only — an
                  estimate BELOW the lines has nothing unallocated to show. */}
              {data.buffer > 0 && (
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
              )}

              {/* Expected funding — the money the team planned to bring IN, measured against what
                  it actually KEPT: everything raised, less whatever was rebated to the player who
                  raised it (owner ruling 2026-08-12). A rebate lowers that player's own dues, so
                  counting it here would lower the same dues twice. */}
              {data.funding && (
                <div className={shared.ledgerGroup}>
                  <div className={`${shared.ledgerGroupHead} ${styles.categoryHeader}`}>
                    <span className={`${shared.ledgerCell} ${shared.scrollXStickyCell}`}>
                      <span className={styles.expandIcon} />
                      <span className={shared.ledgerName}>Expected fundraising</span>
                    </span>
                    {/* Positive, like the plan page (owner 2026-08-13): the row's name says the
                        direction; the variance beside them stays a real signed comparison. */}
                    <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>{fmt(data.funding.budget)}</span>
                    <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>{fmt(data.funding.actual)}</span>
                    <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`} style={{ color: varianceColor(data.funding.actual - data.funding.budget) }}>
                      {fmtVariance(data.funding.actual - data.funding.budget)}
                    </span>
                  </div>
                </div>
              )}

              <div className={`${shared.ledgerTotal} ${styles.grandTotal}`}>
                <span className={shared.scrollXStickyCell}>Total</span>
                <span className={shared.ledgerTotalNum}>{fmt(data.effectiveBudget)}</span>
                <span className={shared.ledgerTotalNum}>{fmt(data.totalActual)}</span>
                <span
                  className={shared.ledgerTotalNum}
                  style={{ color: varianceColor(data.headroom) }}
                >
                  {fmtVariance(data.headroom)}
                </span>
              </div>

              {/* What players actually had to fund, once the money coming in is taken off. The
                  Total above stays the COST comparison — this closes the same subtraction the
                  budget plan's summary makes, so the two pages end on the same number. */}
              {data.funding && (() => {
                const fundedActual = data.totalActual - data.funding.actual;
                const fundedVariance = data.funding.fundedByPlayers - fundedActual;
                return (
                  <div className={`${shared.ledgerTotal} ${styles.grandTotal}`}>
                    <span className={shared.scrollXStickyCell}>Funded by players</span>
                    <span className={shared.ledgerTotalNum}>{fmt(data.funding.fundedByPlayers)}</span>
                    <span className={shared.ledgerTotalNum}>{fmt(fundedActual)}</span>
                    <span className={shared.ledgerTotalNum} style={{ color: varianceColor(fundedVariance) }}>
                      {fmtVariance(fundedVariance)}
                    </span>
                  </div>
                );
              })()}
              </div>
             </CoachScrollX>
             {data.funding && (
               <p className={styles.fundingNote}>
                 Expected fundraising&apos;s actual is your team&apos;s share — everything raised, less
                 anything paid back to the player who raised it (that already lowers their own dues).
               </p>
             )}
            </div>
          )}

          </>
          )}
        </>
      )}

    </div>
  );
}
