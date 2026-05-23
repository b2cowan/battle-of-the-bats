'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DollarSign, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../../rep-teams.module.css';

interface Installment {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  paidBy: string | null;
}

interface Split {
  id: string;
  teamId: string;
  programYearId: string;
  amount: number;
  splitMethod: string;
  splitValue: number;
  paymentSchedule: string;
  notes: string | null;
  installments: Installment[];
}

interface Allocation {
  id: string;
  description: string;
  totalAmount: number;
  sourceEntryId: string | null;
  createdAt: string;
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isOverdue(dueDate: string, paidAt: string | null) {
  if (paidAt) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

// Resolve team names from the teams API (cached in-component)
async function fetchTeamName(teamId: string): Promise<string> {
  const r = await fetch(`/api/admin/rep-teams/teams/${teamId}`);
  const d = await r.json();
  return d.team?.name ?? teamId.slice(0, 8);
}

export default function AllocationDetailPage() {
  const params = useParams();
  const allocationId = params.allocationId as string;

  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canMarkPaid = userRole === 'owner' || userRole === 'treasurer';

  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    if (!currentOrg || !allocationId) return;
    setFetching(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/allocations/${allocationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setAllocation(data.allocation);
      setSplits(data.splits ?? []);

      // Default first split expanded
      if (data.splits?.length > 0) {
        setExpanded({ [data.splits[0].id]: true });
      }

      // Resolve team names
      const ids = [...new Set((data.splits ?? []).map((s: Split) => s.teamId))] as string[];
      const names: Record<string, string> = {};
      await Promise.all(ids.map(async id => {
        names[id] = await fetchTeamName(id);
      }));
      setTeamNames(names);
    } catch (e: any) {
      setFetchError(e.message ?? 'Failed to load.');
    } finally {
      setFetching(false);
    }
  }, [currentOrg, allocationId]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  async function markPaid(split: Split, inst: Installment) {
    const key = inst.id;
    setMarking(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `/api/admin/rep-teams/allocations/${allocationId}/splits/${split.id}/installments/${inst.id}`,
        { method: 'PATCH' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to mark paid');
      showFeedback('success', `Installment #${inst.installmentNumber} marked as paid.`);
      await load();
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to mark installment as paid.');
    } finally {
      setMarking(prev => ({ ...prev, [key]: false }));
    }
  }

  if (loading || fetching) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to this module.</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className={styles.page}>
        <p style={{ color: '#f87171' }}>{fetchError}</p>
        <Link href={`${base}/rep-teams/allocations`} className="btn btn-secondary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          ← Back to Allocations
        </Link>
      </div>
    );
  }

  if (!allocation) return null;

  // Summary stats
  const allInstallments = splits.flatMap(s => s.installments);
  const collected = allInstallments.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
  const outstanding = allInstallments.filter(i => !i.paidAt).reduce((s, i) => s + i.amount, 0);
  const totalAllocated = splits.reduce((s, sp) => s + sp.amount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = allInstallments.filter(i => !i.paidAt && i.dueDate < today).length;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span>/</span>
        <Link href={`${base}/rep-teams/allocations`}>Cost Allocations</Link>
        <span>/</span>
        <span>{allocation.description}</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><DollarSign size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>{allocation.description}</h1>
            <p className={styles.pageSub}>Created {fmtDate(allocation.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className={styles.summaryGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: '2rem' }}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Total</span>
          <span className={styles.summaryCardValue} style={{ fontSize: '1.3rem' }}>{fmt(allocation.totalAmount)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Allocated</span>
          <span className={styles.summaryCardValue} style={{ fontSize: '1.3rem' }}>{fmt(totalAllocated)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Collected</span>
          <span className={styles.summaryCardValue} style={{ fontSize: '1.3rem', color: '#4ade80' }}>{fmt(collected)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Outstanding</span>
          <span className={styles.summaryCardValue} style={{ fontSize: '1.3rem', color: outstanding > 0 ? 'var(--white-80)' : '#4ade80' }}>
            {fmt(outstanding)}
          </span>
        </div>
        {overdueCount > 0 && (
          <div className={styles.summaryCard} style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
            <span className={styles.summaryCardLabel} style={{ color: '#f87171' }}>Overdue</span>
            <span className={styles.summaryCardValue} style={{ fontSize: '1.3rem', color: '#f87171' }}>{overdueCount}</span>
          </div>
        )}
      </div>

      {/* Per-team accordions */}
      <p className={styles.sectionTitle}>Team Splits ({splits.length})</p>

      {splits.map(split => {
        const teamName = teamNames[split.teamId] ?? '…';
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
                <span style={{ fontWeight: 700, color: 'var(--white-90)', fontSize: '0.95rem' }}>
                  {teamName}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--white-40)' }}>
                  {fmt(split.amount)} total
                  {splitOverdue > 0 && (
                    <span style={{ color: '#f87171', marginLeft: '0.5rem' }}>
                      <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                      {splitOverdue} overdue
                    </span>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#4ade80' }}>{fmt(splitCollected)} paid</span>
                {splitOutstanding > 0 && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--white-50)' }}>{fmt(splitOutstanding)} due</span>
                )}
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--white-30)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--white-30)', flexShrink: 0 }} />}
              </div>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--white-8)', padding: '1rem 1.25rem' }}>
                {split.notes && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--white-40)', marginBottom: '1rem' }}>
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
                        {canMarkPaid && <th className={styles.th}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {split.installments.map(inst => {
                        const overdue = isOverdue(inst.dueDate, inst.paidAt);
                        return (
                          <tr key={inst.id} className={styles.tr}>
                            <td className={styles.td} style={{ color: 'var(--white-40)' }}>{inst.installmentNumber}</td>
                            <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(inst.amount)}</td>
                            <td className={styles.td} style={{ color: overdue ? '#f87171' : 'var(--white-70)' }}>
                              {fmtDate(inst.dueDate)}
                              {overdue && (
                                <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#f87171' }} />
                              )}
                            </td>
                            <td className={styles.td}>
                              {inst.paidAt ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', color: '#4ade80' }}>
                                  <CheckCircle2 size={13} /> Paid {fmtDate(inst.paidAt)}
                                </span>
                              ) : (
                                <span className={`${styles.badge} ${overdue ? styles.badgeCompleted : styles.badgeDraft}`}>
                                  {overdue ? 'Overdue' : 'Unpaid'}
                                </span>
                              )}
                            </td>
                            {canMarkPaid && (
                              <td className={styles.td}>
                                {!inst.paidAt && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                                    disabled={!!marking[inst.id]}
                                    onClick={() => markPaid(split, inst)}
                                  >
                                    {marking[inst.id] ? '…' : 'Mark Paid'}
                                  </button>
                                )}
                              </td>
                            )}
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

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'}
        message={feedbackMsg}
        type={feedbackType}
      />
    </div>
  );
}
