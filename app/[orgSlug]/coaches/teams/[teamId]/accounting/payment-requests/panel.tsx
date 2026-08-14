'use client';
import { useState, useEffect, useCallback, use, Fragment } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import styles from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import { PAYMENT_REQUEST_COLUMNS, paymentRequestRows } from '@/lib/coach-money-exports';
import { moneySectionHref } from '@/lib/coach-money-links';

interface PaymentRequest {
  id: string;
  requestType: 'payment_to_org' | 'charge_to_org';
  amount: number;
  description: string;
  paymentMethod: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'denied';
  denialReason: string | null;
  budgetLineId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const PAYMENT_METHODS = ['Cash', 'E-Transfer', 'Cheque', 'Card', 'Other'];

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending:  'color-mix(in srgb, var(--home-amber, #facc15) 15%, transparent)',
    approved: 'color-mix(in srgb, var(--success-light) 15%, transparent)',
    denied:   'color-mix(in srgb, var(--danger-light) 15%, transparent)',
  };
  const text: Record<string, string> = {
    pending:  'var(--home-amber, #facc15)',
    approved: 'var(--success-light)',
    denied:   'var(--danger-light)',
  };
  return (
    <span style={{
      background:   colors[status] ?? 'transparent',
      color:        text[status]   ?? 'var(--home-dim, rgba(255,255,255,0.5))',
      borderRadius: 6,
      padding:      '0.2rem 0.55rem',
      fontSize:     '0.75rem',
      fontWeight:   600,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isPay = type === 'payment_to_org';
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          '0.3rem',
      background:   isPay ? 'color-mix(in srgb, var(--danger-light) 10%, transparent)' : 'color-mix(in srgb, var(--success-light) 10%, transparent)',
      color:        isPay ? 'var(--danger-light)' : 'var(--success-light)',
      borderRadius: 6,
      padding:      '0.2rem 0.55rem',
      fontSize:     '0.75rem',
      fontWeight:   600,
    }}>
      {isPay
        ? <><ArrowUpRight size={12} /> Pay Org</>
        : <><ArrowDownLeft size={12} /> Request from Org</>}
    </span>
  );
}

export function PaymentRequestsPanel({
  params: paramsPromise,
  embedded = false,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Rendered as a Money hub tab — suppress the standalone "back to Money" affordance. */
  embedded?: boolean;
  /** Is this panel the tab currently on screen? See UnsavedChangesGuard's `interceptClicks`. */
  tabActive?: boolean;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [requests, setRequests]   = useState<PaymentRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formType, setFormType]   = useState<'payment_to_org' | 'charge_to_org'>('payment_to_org');
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc]   = useState('');
  const [formMethod, setFormMethod] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  const [cancelling, setCancelling] = useState<string | null>(null);

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  useOverlayOpen(showForm);

  // Discard guard (review f7-3/f7-7) — the form's fields are separate state rather than one
  // BLANK_* object, so dirtiness is read off them directly; the type picker doesn't count
  // (it always has a value, so it can never be "entered").
  const formDirty = Boolean(formAmount || formDesc || formMethod || formNotes);
  const closeForm = useDiscardGuard({
    dirty: formDirty,
    close: () => setShowForm(false),
    noun: 'payment request',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/payment-requests`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load payment requests.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  function openForm() {
    setFormType('payment_to_org');
    setFormAmount('');
    setFormDesc('');
    setFormMethod('');
    setFormNotes('');
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit() {
    setFormError('');
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { setFormError('Enter a valid amount greater than 0.'); return; }
    if (!formDesc.trim()) { setFormError('Description is required.'); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/payment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType:   formType,
          amount,
          description:   formDesc.trim(),
          paymentMethod: formMethod || null,
          notes:         formNotes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to submit');
      setShowForm(false);
      await load();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to submit request.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    setCancelling(id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/payment-requests/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to cancel');
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to cancel request.');
    } finally {
      setCancelling(null);
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

  const canWriteMoney = assignment.capabilities.money === 'write';
  const pending  = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const denied   = requests.filter(r => r.status === 'denied').length;

  return (
    <div className={styles.page}>
      {!embedded && (
        <CoachBackLink href={`${base}/accounting`}>Back to Money</CoachBackLink>
      )}
      {/* Page-level action ruling 2026-08-13: the create acts on THIS list of requests, so it
          drops into the tab's own toolbar below rather than sitting in a hub header that names
          "Money". This tab had no control row and gains a thin one. The write gate stands — a
          read-only assistant is never offered a form the server would refuse. */}
      <CoachPageHeader
        embedded={embedded}
        icon={ArrowUpRight}
        title="Payment Requests"
        helpLabel="Payment Requests"
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-navigation', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {/* Cross-link (review f4-7) — the other half of the org-money pair. */}
      <p className={styles.muted} style={{ fontSize: '0.8rem', margin: '-0.75rem 0 1.25rem' }}>
        Looking for what the org has billed this team?{' '}
        <Link href={moneySectionHref(base, 'allocations')} className={`${styles.linkBtn} ${styles.linkBtnAccent}`}>
          Open Org Allocations <ArrowRight size={12} aria-hidden />
        </Link>
      </p>

      {/* ⚠ RENDERS AT EVERY STATE, INCLUDING THE EMPTY ONE (rule 7 — "nothing hides"). This
          screen's empty state names the two request types but offers no button of its own, so
          gating the toolbar on `requests.length` would leave a coach with no way to make their
          first request. */}
      <div className={styles.panelToolbar}>
        <div className={styles.panelToolbarActions}>
          <MoneyExportButton
            label="Payment requests"
            formats={['xlsx', 'csv']}
            build={() => ({
              dataset: 'payment-requests',
              title: 'Payment Requests',
              columns: PAYMENT_REQUEST_COLUMNS,
              rows: paymentRequestRows(requests),
              scopeLabel: assignment?.programYearName ?? '',
              teamName: assignment?.teamName ?? '',
              emptyMessage: 'There are no payment requests to export yet.',
            })}
            disabled={requests.length === 0}
          />
          {canWriteMoney && (
            <button type="button" className={styles.btnPrimary} onClick={openForm}>
              + New Request
            </button>
          )}
        </div>
      </div>

      {/* Summary row */}
      {requests.length > 0 && (
        <div className={styles.summaryGrid} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Pending</span>
            <span className={styles.summaryCardValue} style={{ color: 'var(--home-amber, #facc15)' }}>{pending}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Approved</span>
            <span className={styles.summaryCardValue} style={{ color: 'var(--success-light)' }}>{approved}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Denied</span>
            <span className={styles.summaryCardValue} style={{ color: 'var(--danger-light)' }}>{denied}</span>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : requests.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No payment requests yet.</p>
          <p className={styles.muted} style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Use <strong>Pay Org</strong> to send a payment to the org, or <strong>Request from Org</strong> to ask for reimbursement.
          </p>
        </div>
      ) : (
        /* ⚠ WAS A HAND-BUILT CARD LIST until 2026-08-13 (Money-hub table consistency). It carried
           no shared class and — unlike its two sibling card lists — printed NO column labels at
           all: the amount, the type and the date simply sat in a row of text, so a figure had
           nothing naming it. Now the shared list table, with one heading row and the amounts in
           one column. Every control, badge and expanded detail is the same as before. */
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Request</th>
                <th className={styles.th}>Type</th>
                <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Submitted</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const hasDetail = !!r.notes || r.status === 'denied';
                const open = expandedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className={styles.tr}>
                      <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Request">{r.description}</td>
                      <td className={styles.td} data-label="Type"><TypeBadge type={r.requestType} /></td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ fontWeight: 700 }}>{fmt(r.amount)}</td>
                      <td className={styles.td} data-label="Status"><StatusBadge status={r.status} /></td>
                      <td className={styles.td} data-label="Submitted" style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', fontSize: '0.82rem' }}>
                        {fmtDate(r.createdAt)}
                        {r.paymentMethod && <span style={{ display: 'block' }}>{r.paymentMethod}</span>}
                        {r.reviewedAt && <span style={{ display: 'block' }}>Reviewed {fmtDate(r.reviewedAt)}</span>}
                      </td>
                      <td className={`${styles.td} ${styles.cardActionCell}`}>
                        {hasDetail && (
                          <button
                            type="button"
                            className={`${styles.btnGhost} ${styles.compactAction}`}
                            aria-expanded={open}
                            aria-label={open ? 'Hide details' : 'Show details'}
                            onClick={() => setExpandedId(open ? null : r.id)}
                          >
                            {open ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                            <span className={styles.cardActionLabel}>{open ? 'Hide details' : 'Details'}</span>
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button
                            type="button"
                            className={`${styles.btnGhost} ${styles.compactAction}`}
                            style={{ color: 'var(--danger-light)' }}
                            onClick={() => handleCancel(r.id)}
                            disabled={cancelling === r.id}
                          >
                            {cancelling === r.id ? '…' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {open && (
                      <tr className={styles.tr}>
                        <td className={`${styles.td} ${styles.cardStackCell}`} colSpan={6}>
                          {r.status === 'denied' && r.denialReason && (
                            <div style={{
                              background:   'color-mix(in srgb, var(--danger-light) 8%, transparent)',
                              border:       '1px solid color-mix(in srgb, var(--danger-light) 20%, transparent)',
                              borderRadius: 6,
                              padding:      '0.6rem 0.75rem',
                              marginBottom: r.notes ? '0.5rem' : 0,
                            }}>
                              <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--danger-light)' }}>Denial reason:</p>
                              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))' }}>{r.denialReason}</p>
                            </div>
                          )}
                          {r.notes && (
                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.6))' }}>
                              <strong style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>Notes:</strong> {r.notes}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Request form */}
      {showForm && (
        <div className={styles.modalOverlay} onClick={closeForm}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <CoachModalHeader title="New Payment Request" onClose={closeForm} />

            <div className={styles.formGrid}>
              {/* Type picker */}
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Request Type <span style={{ color: 'var(--danger-light)' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setFormType('payment_to_org')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: `2px solid ${formType === 'payment_to_org' ? 'var(--danger-light)' : 'var(--home-line, rgba(255,255,255,0.1))'}`,
                      background: formType === 'payment_to_org' ? 'color-mix(in srgb, var(--danger-light) 10%, transparent)' : 'var(--home-card, rgba(255,255,255,0.03))',
                      color: formType === 'payment_to_org' ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.5))',
                      cursor: 'pointer',
                      fontSize: '0.83rem',
                      fontWeight: 600,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <ArrowUpRight size={14} /> Pay Org
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Team sends money to org</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('charge_to_org')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: `2px solid ${formType === 'charge_to_org' ? 'var(--success-light)' : 'var(--home-line, rgba(255,255,255,0.1))'}`,
                      background: formType === 'charge_to_org' ? 'color-mix(in srgb, var(--success-light) 10%, transparent)' : 'var(--home-card, rgba(255,255,255,0.03))',
                      color: formType === 'charge_to_org' ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.5))',
                      cursor: 'pointer',
                      fontSize: '0.83rem',
                      fontWeight: 600,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <ArrowDownLeft size={14} /> Request from Org
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Org covers team cost</div>
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="pr-amount">Amount ($) <span style={{ color: 'var(--danger-light)' }}>*</span></label>
                <input
                  id="pr-amount"
                  className={styles.input}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="pr-method">Payment Method</label>
                <select
                  id="pr-method"
                  className={styles.select}
                  value={formMethod}
                  onChange={e => setFormMethod(e.target.value)}
                >
                  <option value="">— optional —</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="pr-desc">Description <span style={{ color: 'var(--danger-light)' }}>*</span></label>
                <input
                  id="pr-desc"
                  className={styles.input}
                  type="text"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="e.g. Diamond permit reimbursement — July 14"
                  maxLength={500}
                />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="pr-notes">Notes</label>
                <textarea
                  id="pr-notes"
                  className={styles.textarea}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Optional — any additional context for the admin"
                  rows={2}
                />
              </div>

              {formError && <p className={`${styles.errorText} ${styles.formGridFull}`}>{formError}</p>}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnGhost} onClick={closeForm}>Cancel</button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSubmit}
                disabled={saving || !formAmount || !formDesc.trim()}
              >
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      <UnsavedChangesGuard
        active={showForm && formDirty}
        interceptClicks={showForm && formDirty && tabActive}
        message="You haven't submitted this payment request. Leave without saving it?"
      />
    </div>
  );
}
