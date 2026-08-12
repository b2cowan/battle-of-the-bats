'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TrendingUp, ChevronDown, ChevronRight, X, ArrowLeft, Tag } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOrg } from '@/lib/org-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import SampleBudgetSheet from '@/components/coaches/SampleBudgetSheet';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import MoneyMonthGrid, { MONEY_LENSES, type MoneyLens, type MonthGridPayload } from '@/components/coaches/MoneyMonthGrid';
import { formatMonthLabel, lensCell, lensTotal, lensReadsPlan } from '@/lib/coach-budget-months';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import type { BudgetCategoryWithItems, RepTeamTag } from '@/lib/types';
import styles from './bva.module.css';
import shared from '../../../../coaches.module.css';

interface PeriodResult {
  label: string;
  periodDate: string | null;
  estimated: number;
  actual: number;
}

interface LineResult {
  budgetLineId: string;
  description: string;
  totalEstimated: number;
  hasPeriods: boolean;
  periods: PeriodResult[];
}

interface CategoryResult {
  categoryName: string;
  categoryEstimated: number;
  categoryActual: number;
  categoryVariance: number;
  lines: LineResult[];
}

interface UnbudgetedActual {
  id: string;
  description: string;
  category: string | null;
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
  totalBudget: number;      // itemized line-item sum
  seasonTotal: number | null;
  effectiveBudget: number;  // max(itemized, season total)
  buffer: number;           // season total not yet itemized
  totalActual: number;
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

const BVA_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Item',     key: 'item',     format: 'text' },
  { label: 'Budgeted', key: 'budgeted', format: 'currency' },
  { label: 'Actual',   key: 'actual',   format: 'currency' },
  { label: 'Variance', key: 'variance', format: 'currency' },
];

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const { currentOrg } = useOrg();
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

  // Recategorize fix-it for unbudgeted expenses (money-write only)
  const [taxonomy, setTaxonomy] = useState<BudgetCategoryWithItems[]>([]);
  const [recatTarget, setRecatTarget] = useState<UnbudgetedActual | null>(null);
  useOverlayOpen(!!recatTarget);
  const [recatCategory, setRecatCategory] = useState('');
  const [recatSaving, setRecatSaving] = useState(false);
  const [recatError, setRecatError] = useState('');

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

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
      const [res, catRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-vs-actual${bvaQuery}`),
        fetch(`/api/coaches/${orgSlug}/budget-items`),
      ]);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      setData(await res.json());
      if (catRes.ok) {
        const catData = await catRes.json();
        setTaxonomy(catData.categories ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, filterTagId, bvaQuery]);

  useEffect(() => { load(); }, [load]);

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

  useEffect(() => {
    fetch(`/api/admin/org/pdf-settings?orgSlug=${orgSlug}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setPdfSettings(d as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, [orgSlug]);

  async function saveRecategorize() {
    if (!recatTarget) return;
    setRecatError('');
    setRecatSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${recatTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: recatCategory || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setRecatTarget(null);
      await load();
    } catch (e: unknown) {
      setRecatError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setRecatSaving(false);
    }
  }

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
  const exportCols = inMonthView ? monthExportColumns() : BVA_EXPORT_COLS;
  const exportTitle = inMonthView
    ? `Budget by month — ${MONEY_LENSES.find(l => l.id === lens)?.label}`
    : 'Budget vs. Actual';

  function buildRows(): Array<Record<string, string | number>> {
    return inMonthView ? buildMonthExportRows() : buildExportRows();
  }

  function buildExportRows() {
    if (!data) return [];
    const rows: Array<{ item: string; budgeted: number | ''; actual: number | ''; variance: number | '' }> = [];
    for (const cat of data.categories) {
      rows.push({ item: cat.categoryName, budgeted: cat.categoryEstimated, actual: cat.categoryActual, variance: cat.categoryVariance });
      for (const line of cat.lines) {
        rows.push({ item: `  — ${line.description}`, budgeted: line.totalEstimated, actual: '', variance: '' });
      }
    }
    if (data.buffer > 0) {
      rows.push({ item: 'Non-itemized buffer', budgeted: data.buffer, actual: '', variance: '' });
    }
    for (const u of data.unbudgetedActuals) {
      rows.push({ item: `Unbudgeted — ${u.description}${u.category ? ` (${u.category})` : ''}`, budgeted: '', actual: u.amount, variance: '' });
    }
    rows.push({ item: 'Total', budgeted: data.effectiveBudget, actual: data.totalActual, variance: data.headroom });
    return rows;
  }

  function exportMeta() {
    return {
      org: currentOrg?.slug ?? orgSlug,
      dataset: inMonthView ? `budget-by-month-${lens}` : 'budget-vs-actual',
      scope: assignment?.programYearName ?? teamId,
    };
  }

  async function handleExportXLSX() {
    const src = buildRows();
    if (!src.length) return;
    await downloadXLSX(
      buildFilename(exportMeta(), 'xlsx'),
      serializeHeaders(exportCols), serializeRows(src, exportCols),
      inMonthView ? 'Budget by month' : 'Budget vs Actual',
    );
  }

  function handleExportCSV() {
    const src = buildRows();
    if (!src.length) return;
    downloadCSVBlob(
      buildFilename(exportMeta(), 'csv'),
      generateCSV(serializeHeaders(exportCols), serializeRows(src, exportCols)),
    );
  }

  async function handleExportPDF() {
    const src = buildRows();
    if (!src.length) return;
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };
    const teamName = assignment?.teamName ?? teamId;
    const programYearName = assignment?.programYearName ?? '';
    // Built from the same column definitions as the sheet exports, so the three formats can't
    // drift apart when the month range or the lens changes.
    const pdfHeaders = exportCols.map(c => c.label);
    const pdfRows = src.map(r => exportCols.map(c => {
      const v = r[c.key];
      if (c.format !== 'currency') return String(v ?? '');
      return v === '' || v === undefined || v === null ? '—' : fmt(Number(v));
    }));
    await downloadPDF(
      buildFilename(exportMeta(), 'pdf'),
      exportTitle,
      `${teamName} — ${programYearName}`,
      pdfHeaders,
      pdfRows,
      settings,
    );
  }

  function toggleCat(name: string) {
    setExpandedCats(prev => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });
  }

  function toggleLine(id: string) {
    setExpandedLines(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const unbudgetedTotal = data?.unbudgetedActuals.reduce((s, u) => s + u.amount, 0) ?? 0;

  // Page-header ruling 2026-08-11: the one action, shared by the standalone header and the
  // embedded (Money-hub tab) actions row.
  const bvaExportMenu = (
    <ExportMenu
      formats={['xlsx', 'csv', 'pdf']}
      onExportXLSX={handleExportXLSX}
      onExportCSV={handleExportCSV}
      onExportPDF={handleExportPDF}
      planId={currentOrg?.planId}
      pdfFeatureKey="pdf_exports"
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
        embedded={embedded}
        icon={TrendingUp}
        title="Budget vs. Actual"
        season={page.season}
        teamBase={page.teamBase}
        actions={bvaExportMenu}
        helpLabel="Budget vs. Actual"
        help={{ module: 'coaches', sectionIds: ['premium-money'], fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
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
            primaryAction={{ label: 'Create a budget plan', href: `${base}/accounting/budget` }}
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
                <span className={styles.summaryHint}>incl. {fmt(data.buffer)} non-itemized</span>
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
          </div>

          {view === 'months' ? (
            <MoneyMonthGrid
              data={data}
              lens={lens}
              base={base}
              canWrite={moneyCanWrite}
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
              <div className={styles.tableHeader}>
                <span className={`${styles.colDesc} ${shared.scrollXStickyCell}`}>Category / Line Item</span>
                <span className={styles.colNum}>Budgeted</span>
                <span className={styles.colNum}>Actual</span>
                <span className={styles.colNum}>Variance</span>
              </div>

              <div className={styles.linesContainer}>
                {data.categories.map(cat => (
                  <div key={cat.categoryName} className={styles.categoryGroup}>
                    <button
                      className={styles.categoryHeader}
                      onClick={() => toggleCat(cat.categoryName)}
                    >
                      <div className={`${styles.catHeaderInner} ${shared.scrollXStickyCell}`}>
                        <span className={styles.expandIcon}>
                          {expandedCats.has(cat.categoryName)
                            ? <ChevronDown size={14} />
                            : <ChevronRight size={14} />}
                        </span>
                        <span className={styles.categoryName}>{cat.categoryName}</span>
                      </div>
                      <span className={styles.catNum}>{fmt(cat.categoryEstimated)}</span>
                      <span className={styles.catNum}>{fmt(cat.categoryActual)}</span>
                      <span
                        className={styles.catNum}
                        style={{ color: varianceColor(cat.categoryVariance) }}
                      >
                        {cat.categoryVariance > 0.005 ? '+' : cat.categoryVariance < -0.005 ? '-' : ''}
                        {fmt(Math.abs(cat.categoryVariance))}
                      </span>
                    </button>

                    {expandedCats.has(cat.categoryName) && (
                      <div className={styles.linesBody}>
                        {cat.lines.map(line => (
                          <div key={line.budgetLineId} className={styles.lineRow}>
                            <div className={styles.lineMain}>
                              <div className={`${styles.lineInner} ${shared.scrollXStickyCell}`}>
                                {line.hasPeriods ? (
                                  <button
                                    className={styles.expandBtn}
                                    onClick={() => toggleLine(line.budgetLineId)}
                                  >
                                    {expandedLines.has(line.budgetLineId)
                                      ? <ChevronDown size={13} />
                                      : <ChevronRight size={13} />}
                                  </button>
                                ) : (
                                  <span className={styles.expandSpacer} />
                                )}
                                <span className={`${styles.lineDesc} ${shared.wrap640}`}>{line.description}</span>
                              </div>
                              <span className={styles.lineNum}>{fmt(line.totalEstimated)}</span>
                              <span className={styles.lineNum} style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                              <span className={styles.lineNum} style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                            </div>

                            {line.hasPeriods && expandedLines.has(line.budgetLineId) && (
                              <div className={styles.periodsBody}>
                                {line.periods.map((p, pi) => {
                                  const variance = p.estimated - p.actual;
                                  return (
                                    <div key={pi} className={styles.periodRow}>
                                      <span className={`${styles.periodLabel} ${shared.scrollXStickyCell} ${shared.wrap640}`}>{p.label}</span>
                                      <span className={styles.periodDate}>
                                        {p.periodDate
                                          ? new Date(p.periodDate + 'T12:00:00').toLocaleDateString('en-CA', {
                                              month: 'short', day: 'numeric', year: 'numeric',
                                            })
                                          : ''}
                                      </span>
                                      <span className={styles.periodNum}>{fmt(p.estimated)}</span>
                                      <span
                                        className={styles.periodNum}
                                        style={{ color: p.actual > 0 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.25))' }}
                                      >
                                        {p.actual > 0 ? fmt(p.actual) : '—'}
                                      </span>
                                      <span
                                        className={styles.periodNum}
                                        style={{ color: p.actual > 0 ? varianceColor(variance) : 'var(--home-dim, rgba(255,255,255,0.25))' }}
                                      >
                                        {p.actual > 0
                                          ? `${variance > 0.005 ? '+' : variance < -0.005 ? '-' : ''}${fmt(Math.abs(variance))}`
                                          : '—'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Non-itemized buffer — season-total dollars not yet covered by lines */}
              {data.buffer > 0 && (
                <div className={styles.categoryGroup}>
                  <div className={styles.categoryHeader} style={{ cursor: 'default' }}>
                    <div className={`${styles.catHeaderInner} ${shared.scrollXStickyCell}`}>
                      <span className={styles.expandIcon} />
                      <span className={styles.categoryName}>Non-itemized buffer</span>
                    </div>
                    <span className={styles.catNum}>{fmt(data.buffer)}</span>
                    <span className={styles.catNum} style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                    <span className={styles.catNum} style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                  </div>
                </div>
              )}

              <div className={styles.grandTotal}>
                <span className={shared.scrollXStickyCell}>Total</span>
                <span className={styles.grandNum}>{fmt(data.effectiveBudget)}</span>
                <span className={styles.grandNum}>{fmt(data.totalActual - unbudgetedTotal)}</span>
                <span
                  className={styles.grandNum}
                  style={{ color: varianceColor(data.headroom + unbudgetedTotal) }}
                >
                  {(data.headroom + unbudgetedTotal) > 0.005 ? '+' : (data.headroom + unbudgetedTotal) < -0.005 ? '-' : ''}
                  {fmt(Math.abs(data.headroom + unbudgetedTotal))}
                </span>
              </div>
              </div>
             </CoachScrollX>
            </div>
          )}

          {/* Unbudgeted actuals */}
          {data.unbudgetedActuals.length > 0 && (
            <div className={styles.unbudgetedSection}>
              <p className={styles.sectionTitle}>Unbudgeted Expenses</p>
              <p className={styles.sectionSub}>
                These paid expenses don&apos;t match any budget category and reduce your headroom.
                {moneyCanWrite ? ' Recategorize them to count against the right budget line.' : ''}
              </p>
              {/* A list of one-off expenses, not a comparison — so this stacks into a card at
                  640 rather than joining the scrolling grid above. */}
              {data.unbudgetedActuals.map(u => (
                <div key={u.id} className={`${styles.unbudgetedRow} ${shared.stack640}`}>
                  <span className={styles.unbudgetedDesc}>{u.description}</span>
                  {u.category && (
                    <span className={styles.unbudgetedCat}>{u.category}</span>
                  )}
                  {u.paidAt && (
                    <span className={styles.unbudgetedDate}>
                      {new Date(u.paidAt + 'T12:00:00').toLocaleDateString('en-CA', {
                        month: 'short', day: 'numeric',
                      })}
                    </span>
                  )}
                  <span className={styles.unbudgetedAmount}>{fmt(u.amount)}</span>
                  {moneyCanWrite && (
                    <button
                      type="button"
                      className={`${shared.btnSecondary} ${shared.block640} ${shared.compactAction}`}
                      style={{ flexShrink: 0 }}
                      onClick={() => { setRecatTarget(u); setRecatCategory(''); setRecatError(''); }}
                    >
                      Recategorize
                    </button>
                  )}
                </div>
              ))}
              <div className={styles.unbudgetedTotal}>
                <span>Unbudgeted Total</span>
                <span>{fmt(unbudgetedTotal)}</span>
              </div>
            </div>
          )}
          </>
          )}
        </>
      )}

      {/* Recategorize modal — moves an unbudgeted expense onto a real category so it
          matches (or deliberately doesn't match) the budget plan. */}
      {recatTarget && (
        <div className={`${shared.modalOverlay} ${shared.centeredOnMobile}`} onClick={() => setRecatTarget(null)}>
          <div className={shared.modal} style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <h3 className={shared.modalTitle}>Recategorize Expense</h3>
              <button className={shared.modalCloseBtn} onClick={() => setRecatTarget(null)}><X size={16} /></button>
            </div>
            <p className={shared.muted} style={{ margin: '0 0 0.9rem', fontSize: '0.85rem' }}>
              “{recatTarget.description}” — {fmt(recatTarget.amount)}
              {recatTarget.category ? <> · currently “{recatTarget.category}”</> : null}
            </p>
            <div className={shared.field}>
              <label className={shared.label}>Category</label>
              <select
                className={shared.select}
                value={recatCategory}
                onChange={e => setRecatCategory(e.target.value)}
              >
                <option value="">— select category —</option>
                {taxonomy.map(c => {
                  const inBudget = data?.categories.some(bc => bc.categoryName.toLowerCase() === c.name.toLowerCase());
                  return (
                    <option key={c.id} value={c.name}>
                      {c.name}{inBudget ? ' (in budget)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className={shared.muted} style={{ margin: '0.35rem 0 0', fontSize: '0.75rem' }}>
                Pick a category marked “(in budget)” to count this against your plan.
              </p>
            </div>
            {recatError && <p className={shared.errorText} style={{ marginTop: '0.6rem' }}>{recatError}</p>}
            <div className={shared.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={() => setRecatTarget(null)}>Cancel</button>
              <button type="button" className={shared.btnPrimary} disabled={recatSaving || !recatCategory} onClick={saveRecategorize}>
                {recatSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
