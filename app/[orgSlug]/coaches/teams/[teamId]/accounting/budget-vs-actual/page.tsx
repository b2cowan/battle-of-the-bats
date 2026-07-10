'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { TrendingUp, ChevronDown, ChevronRight, X, ArrowLeft } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import type { BudgetCategoryWithItems } from '@/lib/types';
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

interface BvaData {
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
}

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
  if (v > 0.005) return '#4ade80';
  if (v < -0.005) return '#f87171';
  return 'rgba(255,255,255,0.6)';
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
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={ML} y1={g.y} x2={ML + CW} y2={g.y}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={ML - 4} y={g.y + 4} textAnchor="end" fontSize="9"
            fill="rgba(255,255,255,0.3)">{g.label}</text>
        </g>
      ))}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH}
        stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

      <path d={areaPath} fill="rgba(74,222,128,0.07)" />
      <path d={budgetPath} stroke="#60a5fa" strokeWidth="2" fill="none"
        strokeDasharray="5,3" opacity="0.7" />
      <path d={actualPath} stroke="#4ade80" strokeWidth="2" fill="none" />

      {data.map((d, i) => (
        <circle key={i} cx={xPos(i)} cy={yPos(d.cumActual)} r="3" fill="#4ade80" />
      ))}

      {data.map((d, i) => {
        if (n > 8 && i % 2 !== 0) return null;
        return (
          <text key={i} x={xPos(i)} y={VH - 6} textAnchor="middle" fontSize="9"
            fill="rgba(255,255,255,0.35)">
            {fmtMonth(d.month)}
          </text>
        );
      })}

      <g transform={`translate(${ML + 8},${MT + 8})`}>
        <line x1="0" y1="6" x2="18" y2="6" stroke="#60a5fa" strokeWidth="2"
          strokeDasharray="5,3" opacity="0.7" />
        <text x="22" y="10" fontSize="9" fill="rgba(255,255,255,0.45)">Budgeted (cumulative)</text>
        <line x1="132" y1="6" x2="150" y2="6" stroke="#4ade80" strokeWidth="2" />
        <text x="154" y="10" fontSize="9" fill="rgba(255,255,255,0.45)">Actual (cumulative)</text>
      </g>
    </svg>
  );
}

export default function BudgetVsActualPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();
  const { currentOrg } = useOrg();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data,    setData]    = useState<BvaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [expandedCats,  setExpandedCats]  = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());

  // Recategorize fix-it for unbudgeted expenses (money-write only)
  const [taxonomy, setTaxonomy] = useState<BudgetCategoryWithItems[]>([]);
  const [recatTarget, setRecatTarget] = useState<UnbudgetedActual | null>(null);
  const [recatCategory, setRecatCategory] = useState('');
  const [recatSaving, setRecatSaving] = useState(false);
  const [recatError, setRecatError] = useState('');

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  const assignment = assignments.find(a => a.teamId === teamId);
  const moneyCanWrite = assignment?.capabilities.money === 'write';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, catRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-vs-actual`),
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
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

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
    return { org: currentOrg?.slug ?? orgSlug, dataset: 'budget-vs-actual', scope: assignment?.programYearName ?? teamId };
  }

  async function handleExportXLSX() {
    const src = buildExportRows();
    if (!src.length) return;
    await downloadXLSX(
      buildFilename(exportMeta(), 'xlsx'),
      serializeHeaders(BVA_EXPORT_COLS), serializeRows(src, BVA_EXPORT_COLS), 'Budget vs Actual',
    );
  }

  function handleExportCSV() {
    const src = buildExportRows();
    if (!src.length) return;
    downloadCSVBlob(
      buildFilename(exportMeta(), 'csv'),
      generateCSV(serializeHeaders(BVA_EXPORT_COLS), serializeRows(src, BVA_EXPORT_COLS)),
    );
  }

  async function handleExportPDF() {
    const src = buildExportRows();
    if (!src.length) return;
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };
    const teamName = assignment?.teamName ?? teamId;
    const programYearName = assignment?.programYearName ?? '';
    const pdfHeaders = ['Item', 'Budgeted', 'Actual', 'Variance'];
    const pdfRows = src.map(r => [
      r.item,
      r.budgeted !== '' ? fmt(Number(r.budgeted)) : '—',
      r.actual   !== '' ? fmt(Number(r.actual))   : '—',
      r.variance !== '' ? fmt(Number(r.variance)) : '—',
    ]);
    await downloadPDF(
      buildFilename(exportMeta(), 'pdf'),
      'Budget vs. Actual',
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
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const unbudgetedTotal = data?.unbudgetedActuals.reduce((s, u) => s + u.amount, 0) ?? 0;

  return (
    <div className={styles.page}>
      <Link href={`${base}/accounting`} className={shared.backLink}>
        <ArrowLeft size={14} aria-hidden /> Back to Money
      </Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><TrendingUp size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Budget vs. Actual</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
        <ExportMenu
          formats={['xlsx', 'csv', 'pdf']}
          onExportXLSX={handleExportXLSX}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          planId={currentOrg?.planId}
          pdfFeatureKey="pdf_exports"
          disabled={!data || (data.effectiveBudget === 0 && data.totalActual === 0)}
        />
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : !data || data.effectiveBudget === 0 ? (
        <CoachEmptyState
          icon={<TrendingUp size={22} aria-hidden />}
          eyebrow="Budget vs. actual"
          headline="No budget plan yet"
          description="Create a budget plan to start tracking estimated spend against your actual ledger."
          primaryAction={{ label: 'Create a budget plan', href: `${base}/accounting/budget` }}
        />
      ) : (
        <>
          {/* Headroom summary */}
          <div className={styles.summaryBanner}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Headroom</span>
              <span
                className={styles.summaryValue}
                style={{ color: data.headroom >= 0 ? '#4ade80' : '#f87171', fontSize: '1.45rem' }}
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
                  <span className={styles.duesValue} style={{ color: '#4ade80' }}>
                    {fmt(data.duesCollection.collected)}
                  </span>
                </div>
                <div className={styles.duesStat}>
                  <span className={styles.summaryLabel}>Outstanding</span>
                  <span
                    className={styles.duesValue}
                    style={{ color: data.duesCollection.outstanding > 0 ? '#f87171' : undefined }}
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

          {/* Monthly cumulative chart */}
          {data.monthlyChart.length > 1 && (
            <div className={styles.chartCard}>
              <p className={styles.chartTitle}>Cumulative Spending vs. Budget</p>
              <CumulativeChart data={data.monthlyChart} />
            </div>
          )}

          {/* Category breakdown */}
          {data.categories.length > 0 && (
            <div className={styles.section}>
              <div className={styles.tableHeader}>
                <span className={styles.colDesc}>Category / Line Item</span>
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
                      <div className={styles.catHeaderInner}>
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
                              <div className={styles.lineInner}>
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
                                <span className={styles.lineDesc}>{line.description}</span>
                              </div>
                              <span className={styles.lineNum}>{fmt(line.totalEstimated)}</span>
                              <span className={styles.lineNum} style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                              <span className={styles.lineNum} style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                            </div>

                            {line.hasPeriods && expandedLines.has(line.budgetLineId) && (
                              <div className={styles.periodsBody}>
                                {line.periods.map((p, pi) => {
                                  const variance = p.estimated - p.actual;
                                  return (
                                    <div key={pi} className={styles.periodRow}>
                                      <span className={styles.periodLabel}>{p.label}</span>
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
                                        style={{ color: p.actual > 0 ? '#4ade80' : 'rgba(255,255,255,0.25)' }}
                                      >
                                        {p.actual > 0 ? fmt(p.actual) : '—'}
                                      </span>
                                      <span
                                        className={styles.periodNum}
                                        style={{ color: p.actual > 0 ? varianceColor(variance) : 'rgba(255,255,255,0.25)' }}
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
                    <div className={styles.catHeaderInner}>
                      <span className={styles.expandIcon} />
                      <span className={styles.categoryName}>Non-itemized buffer</span>
                    </div>
                    <span className={styles.catNum}>{fmt(data.buffer)}</span>
                    <span className={styles.catNum} style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                    <span className={styles.catNum} style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                  </div>
                </div>
              )}

              <div className={styles.grandTotal}>
                <span>Total</span>
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
          )}

          {/* Unbudgeted actuals */}
          {data.unbudgetedActuals.length > 0 && (
            <div className={styles.unbudgetedSection}>
              <p className={styles.sectionTitle}>Unbudgeted Expenses</p>
              <p className={styles.sectionSub}>
                These paid expenses don&apos;t match any budget category and reduce your headroom.
                {moneyCanWrite ? ' Recategorize them to count against the right budget line.' : ''}
              </p>
              {data.unbudgetedActuals.map(u => (
                <div key={u.id} className={styles.unbudgetedRow}>
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
                      className={shared.btnSecondary}
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', flexShrink: 0 }}
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

      {/* Recategorize modal — moves an unbudgeted expense onto a real category so it
          matches (or deliberately doesn't match) the budget plan. */}
      {recatTarget && (
        <div className={shared.modalOverlay} onClick={() => setRecatTarget(null)}>
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
