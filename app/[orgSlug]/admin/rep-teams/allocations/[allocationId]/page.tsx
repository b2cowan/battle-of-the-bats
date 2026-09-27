'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DollarSign, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useAdminKit, useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK, KIT_LINE, KIT_SURFACE } from '@/components/admin/kit/kit-inline';
import styles from '../../rep-teams.module.css';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';

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

/* ⚠ Shared, because this page prints BOTH a `date` (`dueDate`) and timestamps (`paidAt`,
   `createdAt`). The local `new Date(s)` was right for the timestamps and read a bare
   `2026-05-15` as UTC midnight — which renders as May 14 in Toronto, so every due date on
   the allocation schedule was reported one day early. */
const fmtDate = formatStoredDate;

// Resolve team names from the teams API (cached in-component)
async function fetchTeamName(teamId: string, orgQuery: string): Promise<string> {
  const r = await fetch(`/api/admin/rep-teams/teams/${teamId}${orgQuery}`);
  const d = await r.json();
  return d.team?.name ?? teamId.slice(0, 8);
}

export default function AllocationDetailPage() {
  const params = useParams();
  const allocationId = params.allocationId as string;

  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canMarkPaid = userRole === 'owner' || userRole === 'treasurer';
  // Admin Design Continuity slice 3: the kit's patch over each hand-set style while the switch is on.
  const kit = useAdminKit();
  const kx = useKitStyle();

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
      const res = await fetch(`/api/admin/rep-teams/allocations/${allocationId}${orgQuery}`);
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
        names[id] = await fetchTeamName(id, orgQuery);
      }));
      setTeamNames(names);
    } catch (e: any) {
      setFetchError(e.message ?? 'Failed to load.');
    } finally {
      setFetching(false);
    }
  }, [currentOrg, allocationId, orgQuery]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  async function markPaid(split: Split, inst: Installment) {
    const key = inst.id;
    setMarking(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `/api/admin/rep-teams/allocations/${allocationId}/splits/${split.id}/installments/${inst.id}${orgQuery}`,
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
        <p style={{ color: 'var(--danger-light)' }}>{fetchError}</p>
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
  const today = tournamentToday();
  const overdueCount = allInstallments.filter(i => !i.paidAt && i.dueDate < today).length;

  // Row-invariant styles, computed once per render rather than once per row.
  const splitMeta = kx({ fontSize: '0.78rem', color: 'var(--white-40)' }, KIT_INK.tertiary);
  const chevron = kx({ color: 'var(--white-30)', flexShrink: 0 }, KIT_INK.tertiary);
  const splitBody = kx({ borderTop: '1px solid var(--white-8)', padding: '1rem 1.25rem' }, { borderTop: KIT_LINE });
  const splitNotes = kx({ fontSize: '0.82rem', color: 'var(--white-40)', marginBottom: '1rem' }, KIT_INK.tertiary);
  const numberCell = kx({ color: 'var(--white-40)' }, KIT_INK.tertiary);

  return (
    <div className={styles.page}>
      {/* Header — today's breadcrumb and header as `legacy` while the switch is off. On the kit the way
          up is Cost allocations and "Rep Teams" is the eyebrow (still a link); the subtitle's creation
          date moves to the top of the body it describes (F3). */}
      <AdminPageHeader
        crumbs={[{ href: `${base}/rep-teams`, label: 'Rep Teams' }, { label: currentOrg?.name ?? '' }]}
        title={allocation.description}
        backTo={{ href: `${base}/rep-teams/allocations`, label: 'Cost allocations' }}
        legacy={<>
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
        </>}
      />
      {kit && <p className={styles.kitLede}>Created {fmtDate(allocation.createdAt)}</p>}

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
          <span className={styles.summaryCardValue} style={{ fontSize: '1.3rem', color: 'var(--success-light)' }}>{fmt(collected)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Outstanding</span>
          <span className={styles.summaryCardValue} style={{ fontSize: '1.3rem', color: outstanding > 0 ? 'var(--white-80)' : 'var(--success-light)' }}>
            {fmt(outstanding)}
          </span>
        </div>
        {overdueCount > 0 && (
          <div className={styles.summaryCard} style={kx({ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }, KIT_SURFACE.alert)}>
            <span className={styles.summaryCardLabel} style={{ color: 'var(--danger-light)' }}>Overdue</span>
            <span className={styles.summaryCardValue} style={{ fontSize: '1.3rem', color: 'var(--danger-light)' }}>{overdueCount}</span>
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
                <span style={splitMeta}>
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
                  <span style={{ fontSize: '0.82rem', color: 'var(--white-50)' }}>{fmt(splitOutstanding)} due</span>
                )}
                {isOpen ? <ChevronUp size={16} style={chevron} /> : <ChevronDown size={16} style={chevron} />}
              </div>
            </button>

            {isOpen && (
              <div style={splitBody}>
                {split.notes && (
                  <p style={splitNotes}>
                    {split.notes}
                  </p>
                )}

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>#</th>
                        <th className={`${styles.th} ${styles.num}`}>Amount</th>
                        <th className={styles.th}>Due Date</th>
                        <th className={styles.th}>Status</th>
                        {canMarkPaid && <th className={styles.th}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {split.installments.map(inst => {
                        const overdue = isInstallmentOverdue(inst.dueDate, inst.paidAt);
                        return (
                          <tr key={inst.id} className={styles.tr}>
                            <td className={styles.td} style={numberCell}>{inst.installmentNumber}</td>
                            <td className={`${styles.td} ${styles.num}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(inst.amount)}</td>
                            <td className={styles.td} style={{ color: overdue ? 'var(--danger-light)' : 'var(--white-70)' }}>
                              {fmtDate(inst.dueDate)}
                              {overdue && (
                                <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--danger-light)' }} />
                              )}
                            </td>
                            <td className={styles.td}>
                              {inst.paidAt ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--success-light)' }}>
                                  <CheckCircle2 size={13} /> Paid {fmtDate(inst.paidAt)}
                                </span>
                              ) : (
                                // The legacy page borrows "completed" for Overdue; the kit gives a verdict its own chip.
                                <span className={`${styles.badge} ${overdue ? (kit ? styles.badgeOverdue : styles.badgeCompleted) : styles.badgeDraft}`}>
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
