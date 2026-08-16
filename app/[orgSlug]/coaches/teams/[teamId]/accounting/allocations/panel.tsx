'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { Building2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import styles from '../../../../coaches.module.css';
import type { RepAllocationInstallment } from '@/lib/types';
import { tournamentToday } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import { ALLOCATION_COLUMNS, allocationRows } from '@/lib/coach-money-exports';

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

/**
 * What an allocation IS — the pair of cards under the empty state (owner-approved mockup
 * 2026-08-15). Same shape as the Expense/Payable comparison on Expenses & Payables, because a
 * coach meeting an unfamiliar Money tab should meet the same teaching device every time.
 *
 * ⚠ THE EMPTY STATE IS THE ONLY PLACE A COACH EVER LEARNS THIS. Unlike Expenses, this screen has
 * no Add form whose subtitle could carry it and no toolbar at all while it is empty — a coach
 * whose club has never billed them sees this once and nothing else. So it answers the two
 * questions a blank screen actually raises: where does one come from, and what am I meant to do
 * when one arrives.
 *
 * ⚠ NO CTA, EVER. A coach cannot create an allocation, which is precisely why the block above
 * uses the QUIET empty-state variant (addendum §iii — the trigger is the absence of an action on
 * the block). Adding a button here would break that pairing.
 */
function AllocationExplainer() {
  return (
    <>
      <div className={styles.moneyKindCompare}>
        <div className={styles.moneyKindCard}>
          <h4>Where it comes from</h4>
          <p>
            Your club&apos;s <strong>owner or treasurer</strong> decides the split. You can&apos;t add or
            change one here — this tab is the bill, not the chequebook.
          </p>
          <p className={styles.moneyKindEgs}>Field and diamond fees · league insurance · association dues</p>
        </div>
        <div className={styles.moneyKindCard}>
          <h4>What you do with it</h4>
          <p>
            A share arrives <strong>split into instalments</strong> with due dates. Mark each one paid as
            you pay it and the club&apos;s books follow.
          </p>
          <p className={styles.moneyKindEgs}>
            Anything falling due soon also appears in Next 30 days on your Money overview
          </p>
        </div>
      </div>
      <p className={`${styles.moneyKindTest} ${styles.moneyKindTestStart}`}>
        <strong>Not the same as an expense:</strong> allocations are money owed to your own club.
        Anything you owe an outside supplier belongs on Expenses &amp; Payables.
      </p>
    </>
  );
}

export function OrgAllocationsPanel({
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

  const [splits, setSplits] = useState<SplitWithInstallments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState<Record<string, boolean>>({});
  const [markError, setMarkError] = useState('');

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // Money is three-state (off|read|write). The server already refuses a read-only coach's
  // mark-paid, but offering the button and failing at submit is the same broken affordance
  // this chunk fixed on Expenses and Payment Requests.
  const canWriteMoney = assignment?.capabilities.money === 'write';

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
    return <CoachNotOnTeam orgSlug={orgSlug} teamId={teamId} />;
  }

  const allInstallments = splits.flatMap(s => s.installments);
  const collected = allInstallments.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
  const outstanding = allInstallments.filter(i => !i.paidAt).reduce((s, i) => s + i.amount, 0);
  const totalAllocated = splits.reduce((s, sp) => s + sp.amount, 0);
  const today = tournamentToday();
  const overdueCount = allInstallments.filter(i => !i.paidAt && i.dueDate < today).length;

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {!embedded && (
        <CoachBackLink href={`${base}/accounting`}>Back to Money</CoachBackLink>
      )}
      {/* Page-header ruling 2026-08-11: title + help, nothing under the title (embedded mode
          renders nothing here — no actions, and the hub's own header is already on screen). */}
      <CoachPageHeader
        variant={embedded ? 'embedded' : 'standard'}
        icon={Building2}
        title="Org Allocations"
        helpLabel="Org Allocations"
        /* ⚠ `premium-money-org`, the sub-topic that actually answers THIS screen. It pointed at
           "Getting around the Money hub" until 2026-08-15 only because no org-money answer
           existed to point at — so the "?" on a screen a coach was confused by opened a tour of
           the tab bar. */
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-org', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {/* Allocations is READ-ONLY and had no control row at all — it gains one for this, and
          only this. What the club has billed a team is exactly the sort of thing a treasurer
          reconciles against a bank statement, so "read-only" was never a reason to withhold it. */}
      {splits.length > 0 && (
        <div className={styles.panelToolbar}>
          <div className={styles.panelToolbarActions}>
            <MoneyExportButton
              label="Club allocations"
              formats={['xlsx', 'csv']}
              build={() => ({
                dataset: 'club-allocations',
                title: 'Club Allocations',
                columns: ALLOCATION_COLUMNS,
                // One row per INSTALLMENT, not per allocation — a payment is what gets matched.
                rows: allocationRows(splits, today),
                scopeLabel: assignment?.programYearName ?? '',
                teamName: assignment?.teamName ?? '',
                emptyMessage: 'Nothing has been allocated to this team yet.',
              })}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : splits.length === 0 ? (
        <>
          <CoachEmptyState
            quiet
            icon={<Building2 size={18} aria-hidden />}
            headline="Your club hasn't billed this team yet"
            description="When your club splits a shared cost across its teams, this team's share shows up here with its own payment schedule."
          />
          <AllocationExplainer />
        </>
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
                {/* Title on the left, the two money chips on the right — until a phone, where
                    the row stacks so neither the allocation name nor the paid/due figures get
                    squeezed off the edge. */}
                <button
                  type="button"
                  className={styles.stack640}
                  style={{
                    alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '1rem 1.25rem', textAlign: 'left',
                  }}
                  onClick={() => setExpanded(prev => ({ ...prev, [split.id]: !prev[split.id] }))}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
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
                  <div className={styles.allocFigures}>
                    <span className={`${styles.allocFigure} ${styles.allocFigurePaid}`}>{fmt(splitCollected)} paid</span>
                    {/* Always present — see the note on .allocFigure. A fully-paid share renders
                        an empty slot rather than collapsing the column. */}
                    <span className={`${styles.allocFigure} ${styles.allocFigureDue}`}>
                      {splitOutstanding > 0 ? `${fmt(splitOutstanding)} due` : ''}
                    </span>
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
                    {/* One installment per row: a list, so it stacks into cards at 640 (the
                        Dues exemplar) rather than scrolling sideways. */}
                    <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>#</th>
                            <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                            <th className={styles.th}>Due Date</th>
                            <th className={styles.th}>Status</th>
                            <th className={styles.th}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {split.installments.map(inst => {
                            const overdue = isInstallmentOverdue(inst.dueDate, inst.paidAt);
                            return (
                              <tr key={inst.id} className={styles.tr}>
                                <td className={styles.td} data-label="Installment" style={{ color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>{inst.installmentNumber}</td>
                                <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount">{fmt(inst.amount)}</td>
                                <td className={styles.td} data-label="Due date" style={{ color: overdue ? 'var(--danger-light)' : 'var(--home-ink-soft, rgba(255,255,255,0.65))' }}>
                                  {fmtDate(inst.dueDate)}
                                  {overdue && <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--danger-light)' }} />}
                                </td>
                                <td className={styles.td} data-label="Status">
                                  {inst.paidAt ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--success-light)' }}>
                                      <CheckCircle2 size={13} /> Paid {fmtDate(inst.paidAt)}
                                    </span>
                                  ) : (
                                    /* ⚠ `badgeOverdue`, NOT `badgeCompleted`. This row said
                                       "Overdue" in the AMBER of a completed season while the
                                       Overdue summary tile directly above it — and every other
                                       overdue mark in the portal — said it in red. The badge
                                       existed; this table had simply never been pointed at it. */
                                    <span className={`${styles.badge} ${overdue ? styles.badgeOverdue : styles.badgeDraft}`}>
                                      {overdue ? 'Overdue' : 'Unpaid'}
                                    </span>
                                  )}
                                </td>
                                <td className={`${styles.td} ${styles.cardActionCell}`}>
                                  {!inst.paidAt && canWriteMoney && (
                                    <button
                                      type="button"
                                      className={`${styles.btnSecondary} ${styles.compactAction}`}
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

      {/* ⚠ THE PAYMENT-REQUESTS CROSS-LINK WAS REMOVED HERE (owner ruling 2026-08-15), and its
          twin on Payment Requests with it. It was added when both org-money screens were
          standalone pages reachable only from the Money hub; since they became TABS the row
          above already sits two words away, and a body-copy link to the neighbouring tab reads
          as though the two are alternatives to each other rather than opposite directions of
          the same relationship. Do not reinstate one without reinstating both. */}
    </div>
  );
}
