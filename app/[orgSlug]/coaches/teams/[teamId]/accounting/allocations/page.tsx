'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import styles from '../../../../coaches.module.css';
import type { RepAllocationInstallment } from '@/lib/types';

interface SplitWithInstallments {
  id: string;
  allocationId: string;
  allocationDescription: string;
  teamId: string;
  programYearId: string;
  amount: number;
  notes: string | null;
  installments: RepAllocationInstallment[];
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string) {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isOverdue(dueDate: string, paidAt: string | null) {
  if (paidAt) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export default function CoachesAllocationsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [splits, setSplits] = useState<SplitWithInstallments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState<Record<string, boolean>>({});
  const [markError, setMarkError] = useState('');

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/allocations`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      const fetchedSplits: SplitWithInstallments[] = data.splits ?? [];
      setSplits(fetchedSplits);
      if (fetchedSplits.length > 0) {
        setExpanded({ [fetchedSplits[0].id]: true });
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load allocations.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  async function markPaid(split: SplitWithInstallments, inst: RepAllocationInstallment) {
    const key = inst.id;
    setMarking(prev => ({ ...prev, [key]: true }));
    setMarkError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/allocations/${split.id}/installments/${inst.id}`,
        { method: 'PATCH' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to mark paid');
      await load();
    } catch (e: any) {
      setMarkError(e.message ?? 'Failed to mark installment as paid.');
    } finally {
      setMarking(prev => ({ ...prev, [key]: false }));
    }
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

  const allInstallments = splits.flatMap(s => s.installments);
  const collected = allInstallments.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
  const outstanding = allInstallments.filter(i => !i.paidAt).reduce((s, i) => s + i.amount, 0);
  const totalAllocated = splits.reduce((s, sp) => s + sp.amount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = allInstallments.filter(i => !i.paidAt && i.dueDate < today).length;

  return (
    <div className={styles.page}>
      <Link href={`${base}/accounting`} className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden /> Back to Money
      </Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Building2 size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Org Allocations</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : splits.length === 0 ? (
        <div className={styles.emptyState}>No allocations have been assigned to this team yet.</div>
      ) : (
        <>
          {/* Summary */}
          <div className={styles.summaryGrid} style={{ marginBottom: '2rem' }}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Total Allocated</span>
              <span className={styles.summaryCardValue}>{fmt(totalAllocated)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Paid</span>
              <span className={styles.summaryCardValue} style={{ color: 'var(--success-light)' }}>{fmt(collected)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Outstanding</span>
              <span className={styles.summaryCardValue} style={{ color: outstanding > 0 ? 'var(--home-ink, rgba(255,255,255,0.8))' : 'var(--success-light)' }}>{fmt(outstanding)}</span>
            </div>
            {overdueCount > 0 && (
              <div className={styles.summaryCard} style={{ borderColor: 'color-mix(in srgb, var(--danger-light) 30%, transparent)', background: 'color-mix(in srgb, var(--danger-light) 5%, transparent)' }}>
                <span className={styles.summaryCardLabel} style={{ color: 'var(--danger-light)' }}>Overdue</span>
                <span className={styles.summaryCardValue} style={{ color: 'var(--danger-light)' }}>{overdueCount}</span>
              </div>
            )}
          </div>

          {markError && <p className={styles.errorText} style={{ marginBottom: '1rem' }}>{markError}</p>}

          {splits.map(split => {
            const isOpen = !!expanded[split.id];
            const splitCollected = split.installments.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
            const splitOutstanding = split.installments.filter(i => !i.paidAt).reduce((s, i) => s + i.amount, 0);
            const splitOverdue = split.installments.filter(i => !i.paidAt && i.dueDate < today).length;

            return (
              <div key={split.id} className={styles.detailSection} style={{ marginBottom: '0.75rem', padding: 0 }}>
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '1rem 1.25rem', textAlign: 'left',
                  }}
                  onClick={() => setExpanded(prev => ({ ...prev, [split.id]: !prev[split.id] }))}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))', fontSize: '0.95rem' }}>
                      {split.allocationDescription}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>
                      {fmt(split.amount)} total
                      {splitOverdue > 0 && (
                        <span style={{ color: 'var(--danger-light)', marginLeft: '0.5rem' }}>
                          <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                          {splitOverdue} overdue
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--success-light)' }}>{fmt(splitCollected)} paid</span>
                    {splitOutstanding > 0 && (
                      <span style={{ fontSize: '0.82rem', color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>{fmt(splitOutstanding)} due</span>
                    )}
                    {isOpen
                      ? <ChevronUp size={16} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', flexShrink: 0 }} />
                      : <ChevronDown size={16} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', flexShrink: 0 }} />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--home-line, rgba(255,255,255,0.07))', padding: '1rem 1.25rem' }}>
                    {split.notes && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--home-dim, rgba(255,255,255,0.4))', marginBottom: '1rem' }}>
                        {split.notes}
                      </p>
                    )}
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>#</th>
                            <th className={styles.th}>Amount</th>
                            <th className={styles.th}>Due Date</th>
                            <th className={styles.th}>Status</th>
                            <th className={styles.th}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {split.installments.map(inst => {
                            const overdue = isOverdue(inst.dueDate, inst.paidAt);
                            return (
                              <tr key={inst.id} className={styles.tr}>
                                <td className={styles.td} style={{ color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>{inst.installmentNumber}</td>
                                <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(inst.amount)}</td>
                                <td className={styles.td} style={{ color: overdue ? 'var(--danger-light)' : 'var(--home-ink-soft, rgba(255,255,255,0.65))' }}>
                                  {fmtDate(inst.dueDate)}
                                  {overdue && <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--danger-light)' }} />}
                                </td>
                                <td className={styles.td}>
                                  {inst.paidAt ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--success-light)' }}>
                                      <CheckCircle2 size={13} /> Paid {fmtDate(inst.paidAt)}
                                    </span>
                                  ) : (
                                    <span className={`${styles.badge} ${overdue ? styles.badgeCompleted : styles.badgeDraft}`}>
                                      {overdue ? 'Overdue' : 'Unpaid'}
                                    </span>
                                  )}
                                </td>
                                <td className={styles.td}>
                                  {!inst.paidAt && (
                                    <button
                                      type="button"
                                      className={styles.btnSecondary}
                                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                                      disabled={!!marking[inst.id]}
                                      onClick={() => markPaid(split, inst)}
                                    >
                                      {marking[inst.id] ? '…' : 'Mark Paid'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
