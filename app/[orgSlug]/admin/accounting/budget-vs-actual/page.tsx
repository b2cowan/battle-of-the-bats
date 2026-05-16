'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BarChart2, ChevronDown, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from './bva.module.css';

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number) { return `${n}%`; }

interface Period { id: string; label: string; periodDate: string | null; amount: number; }
interface BudgetLine {
  budgetLineId: string;
  description: string;
  estimated: number;
  allocated: number;
  collected: number;
  outstanding: number;
  unallocated: number;
  allocationId: string | null;
  teamCount: number;
  periods: Period[];
}
interface Category {
  id: string; name: string; sortOrder: number;
  totalEstimated: number; totalAllocated: number; totalCollected: number;
  lines: BudgetLine[];
}
interface OrgActualEntry { entryId: string; description: string; amount: number; entryDate: string; ledgerName: string; }
interface TeamHealth {
  teamId: string; teamName: string;
  totalAllocated: number; collected: number; collectionPct: number;
  overdueCount: number; status: 'on_track' | 'behind' | 'overdue';
}
interface Summary { totalBudgeted: number; totalOrgExpenses: number; totalAllocated: number; totalCollected: number; headroom: number; }
interface BVAData {
  year: number;
  availableYears: number[];
  summary: Summary;
  categories: Category[];
  uncategorized: BudgetLine[];
  orgActuals: { total: number; entries: OrgActualEntry[] };
  teamHealth: TeamHealth[];
}

export default function OrgBudgetVsActualPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const [year, setYear]     = useState(new Date().getFullYear());
  const [data, setData]     = useState<BVAData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError]   = useState('');

  const [expandedLines,    setExpandedLines]    = useState<Set<string>>(new Set());
  const [showActuals,      setShowActuals]      = useState(false);

  const load = useCallback(async (y: number) => {
    setFetching(true);
    setError('');
    try {
      const res  = await fetch(`/api/admin/accounting/budget-vs-actual?year=${y}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setData(json);
      setYear(y);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load data.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (currentOrg) load(year);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_accounting')) {
    return (
      <div className={styles.accessDenied}>
        <BarChart2 size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Accounting module.</p>
      </div>
    );
  }

  function toggleLine(id: string) {
    setExpandedLines(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function varianceClass(unallocated: number) {
    if (unallocated > 0)   return styles.varPos;
    if (unallocated < 0)   return styles.varNeg;
    return styles.varNeutral;
  }

  function renderLines(lines: BudgetLine[]) {
    return lines.flatMap(line => {
      const isExpanded = expandedLines.has(line.budgetLineId);
      const rows = [
        <tr key={line.budgetLineId} className={styles.tr}>
          <td className={styles.td} style={{ width: '28%' }}>
            <div className={styles.lineDesc}>{line.description}</div>
          </td>

          <td className={`${styles.td} ${styles.tdRight}`} style={{ width: '13%' }}>
            {fmt(line.estimated)}
          </td>

          <td className={`${styles.td} ${styles.tdRight}`} style={{ width: '13%' }}>
            {line.allocated > 0 ? (
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{fmt(line.allocated)}</span>
            ) : (
              <span className={styles.varNeutral}>—</span>
            )}
          </td>

          <td className={`${styles.td} ${styles.tdRight}`} style={{ width: '13%' }}>
            {line.collected > 0 ? (
              <span style={{ color: '#4ade80' }}>{fmt(line.collected)}</span>
            ) : (
              <span className={styles.varNeutral}>—</span>
            )}
          </td>

          <td className={`${styles.td} ${styles.tdRight}`} style={{ width: '13%' }}>
            <span className={varianceClass(line.unallocated)}>
              {line.unallocated === 0
                ? '—'
                : `${line.unallocated > 0 ? '+' : ''}${fmt(line.unallocated)}`}
            </span>
          </td>

          <td className={styles.td} style={{ width: '10%' }}>
            {line.allocationId ? (
              <span className={styles.badgeAllocated}><Check size={10} /> Allocated</span>
            ) : (
              <span className={styles.badgeUnallocated}>Unallocated</span>
            )}
          </td>

          <td className={styles.td} style={{ width: '10%' }}>
            {line.periods.length > 0 && (
              <button type="button" className={styles.periodToggleBtn} onClick={() => toggleLine(line.budgetLineId)}>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {line.periods.length}
              </button>
            )}
          </td>
        </tr>,
      ];

      if (isExpanded && line.periods.length > 0) {
        rows.push(
          <tr key={`${line.budgetLineId}-periods`} className={styles.periodsRow}>
            <td colSpan={7} className={styles.td}>
              <div className={styles.periodsInner}>
                <table className={styles.periodTable}>
                  <thead>
                    <tr>
                      <th className={styles.periodTh}>Period</th>
                      <th className={styles.periodTh}>Date</th>
                      <th className={`${styles.periodTh}`} style={{ textAlign: 'right' }}>Estimated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {line.periods.map(p => (
                      <tr key={p.id}>
                        <td className={styles.periodTd}>{p.label}</td>
                        <td className={styles.periodTd}>{p.periodDate ?? '—'}</td>
                        <td className={`${styles.periodTd} ${styles.periodTdRight}`}>{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        );
      }

      return rows;
    });
  }

  function renderTable(lines: BudgetLine[]) {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Description</th>
              <th className={`${styles.th} ${styles.thRight}`}>Estimated</th>
              <th className={`${styles.th} ${styles.thRight}`}>Allocated</th>
              <th className={`${styles.th} ${styles.thRight}`}>Collected</th>
              <th className={`${styles.th} ${styles.thRight}`}>Unallocated</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>{renderLines(lines)}</tbody>
        </table>
      </div>
    );
  }

  const s = data?.summary;
  const noData = !fetching && data && data.categories.length === 0 && data.uncategorized.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/accounting`}>Accounting</Link>
        <span>/</span>
        <span>Budget vs. Actual</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><BarChart2 size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Budget vs. Actual</h1>
            <p className={styles.pageSub}>{currentOrg?.name} — {year} season</p>
          </div>
        </div>
        <Link href={`${base}/accounting/budget`} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
          Edit Budget →
        </Link>
      </div>

      {/* Year selector */}
      <div className={styles.yearRow}>
        <span>Season year:</span>
        <select
          className={styles.yearSelect}
          value={year}
          onChange={e => load(Number(e.target.value))}
          disabled={fetching}
        >
          {(data?.availableYears ?? [year]).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {/* Headroom headline */}
          {s && (
            <div className={styles.headroom}>
              <div>
                <div className={styles.headroomLabel}>Org Headroom</div>
                <div className={`${styles.headroomValue} ${s.headroom >= 0 ? styles.headroomPos : styles.headroomNeg}`}>
                  {s.headroom >= 0 ? '+' : ''}{fmt(s.headroom)}
                </div>
                <div className={styles.headroomNote}>
                  Budgeted {fmt(s.totalBudgeted)} minus org ledger expenses {fmt(s.totalOrgExpenses)}
                </div>
              </div>
            </div>
          )}

          {/* Summary cards */}
          {s && (
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Total Budgeted</div>
                <div className={styles.summaryValue}>{fmt(s.totalBudgeted)}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Org Ledger Expenses</div>
                <div className={`${styles.summaryValue} ${s.totalOrgExpenses > 0 ? styles.summaryNeg : ''}`}>
                  {fmt(s.totalOrgExpenses)}
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Allocated to Teams</div>
                <div className={`${styles.summaryValue} ${styles.summaryMuted}`}>{fmt(s.totalAllocated)}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Collected from Teams</div>
                <div className={`${styles.summaryValue} ${s.totalCollected > 0 ? styles.summaryPos : ''}`}>
                  {fmt(s.totalCollected)}
                </div>
              </div>
            </div>
          )}

          {noData ? (
            <div className={styles.emptySection}>
              No budget lines for {year}. <Link href={`${base}/accounting/budget`} style={{ color: 'rgba(255,255,255,0.6)' }}>Add lines in the Budget Planner →</Link>
            </div>
          ) : (
            <>
              {/* Budget lines by category */}
              {data?.categories.map(cat => (
                <div key={cat.id} className={styles.categorySection}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryName}>{cat.name}</span>
                    <div className={styles.categoryMeta}>
                      <span className={styles.categoryMetaItem}>
                        <span>Est</span>{fmt(cat.totalEstimated)}
                      </span>
                      <span className={styles.categoryMetaItem}>
                        <span>Alloc</span>{fmt(cat.totalAllocated)}
                      </span>
                      <span className={styles.categoryMetaItem}>
                        <span>Collected</span>{fmt(cat.totalCollected)}
                      </span>
                    </div>
                  </div>
                  {renderTable(cat.lines)}
                </div>
              ))}

              {data && data.uncategorized.length > 0 && (
                <div className={styles.categorySection}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryName}>Uncategorized</span>
                  </div>
                  {renderTable(data.uncategorized)}
                </div>
              )}
            </>
          )}

          {/* Org ledger actuals panel */}
          {data && (
            <div className={styles.actualsPanel}>
              <div className={styles.actualsPanelHeader}>
                <span className={styles.actualsPanelTitle}>Org Ledger Expenses — {year}</span>
                {data.orgActuals.total > 0 && (
                  <span className={styles.actualsPanelTotal}>{fmt(data.orgActuals.total)}</span>
                )}
              </div>
              <p className={styles.actualsPanelNote}>
                Posted expense entries across all org ledgers for {year}. Per-line mapping to budget items arrives in a future update.
              </p>
              {data.orgActuals.entries.length === 0 ? (
                <p style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)' }}>
                  No posted expense entries for {year}.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.actualsToggleBtn}
                    onClick={() => setShowActuals(p => !p)}
                  >
                    {showActuals ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {showActuals ? 'Hide' : 'Show'} entries ({data.orgActuals.entries.length})
                  </button>
                  {showActuals && (
                    <table className={styles.actualsTable}>
                      <tbody>
                        {data.orgActuals.entries.map(e => (
                          <tr key={e.entryId} className={styles.actualsTableTr}>
                            <td className={styles.actualsTd} style={{ width: '40%' }}>
                              <div>{e.description}</div>
                              <div className={styles.actualsLedger}>{e.ledgerName}</div>
                            </td>
                            <td className={`${styles.actualsTd} ${styles.actualsDate}`} style={{ width: '20%' }}>
                              {e.entryDate}
                            </td>
                            <td className={`${styles.actualsTd} ${styles.actualsTdRight}`} style={{ width: '20%', color: '#f87171' }}>
                              {fmt(e.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}

          {/* Team health panel */}
          {data && data.teamHealth.length > 0 && (
            <div>
              <h2 className={styles.sectionTitle}>Team Collection Health</h2>
              <div className={styles.teamGrid}>
                {data.teamHealth.map(t => {
                  const cardClass = t.status === 'overdue'
                    ? `${styles.teamCard} ${styles.teamCardOverdue}`
                    : t.status === 'behind'
                    ? `${styles.teamCard} ${styles.teamCardBehind}`
                    : styles.teamCard;

                  const badgeClass = t.status === 'overdue'
                    ? `${styles.statusBadge} ${styles.statusOverdue}`
                    : t.status === 'behind'
                    ? `${styles.statusBadge} ${styles.statusBehind}`
                    : `${styles.statusBadge} ${styles.statusOnTrack}`;

                  const badgeLabel = t.status === 'overdue'
                    ? 'Overdue'
                    : t.status === 'behind'
                    ? 'Behind'
                    : 'On Track';

                  const progressClass = t.collectionPct >= 75
                    ? styles.progressFillGood
                    : t.collectionPct >= 40
                    ? styles.progressFillWarning
                    : styles.progressFillDanger;

                  return (
                    <Link key={t.teamId} href={`${base}/rep-teams`} className={cardClass}>
                      <div className={styles.teamCardHeader}>
                        <span className={styles.teamCardName}>{t.teamName}</span>
                        <span className={badgeClass}>{badgeLabel}</span>
                      </div>

                      <div className={styles.teamCardStats}>
                        <div>
                          <div className={styles.teamStatLabel}>Allocated</div>
                          <div className={styles.teamStatValue}>{fmt(t.totalAllocated)}</div>
                        </div>
                        <div>
                          <div className={styles.teamStatLabel}>Collected</div>
                          <div className={styles.teamStatValue}>{fmt(t.collected)}</div>
                        </div>
                        <div>
                          <div className={styles.teamStatLabel}>Collection</div>
                          <div className={styles.teamStatValue}>{pct(t.collectionPct)}</div>
                        </div>
                        <div>
                          <div className={styles.teamStatLabel}>Overdue</div>
                          <div className={styles.teamStatValue} style={{ color: t.overdueCount > 0 ? '#f87171' : 'rgba(255,255,255,0.8)' }}>
                            {t.overdueCount > 0 ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <AlertTriangle size={13} /> {t.overdueCount}
                              </span>
                            ) : '—'}
                          </div>
                        </div>
                      </div>

                      <div className={styles.progressBar}>
                        <div
                          className={`${styles.progressFill} ${progressClass}`}
                          style={{ width: `${Math.min(t.collectionPct, 100)}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {data && data.teamHealth.length === 0 && !noData && (
            <div className={styles.emptySection}>
              No team allocations yet for {year}. Allocate budget lines to teams to see team health here.
            </div>
          )}
        </>
      )}
    </div>
  );
}
