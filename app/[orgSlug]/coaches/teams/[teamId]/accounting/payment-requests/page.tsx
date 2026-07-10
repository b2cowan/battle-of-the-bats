'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft, X, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import styles from '../../../../coaches.module.css';

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
    pending:  'rgba(250,204,21,0.15)',
    approved: 'rgba(74,222,128,0.15)',
    denied:   'rgba(248,113,113,0.15)',
  };
  const text: Record<string, string> = {
    pending:  '#facc15',
    approved: '#4ade80',
    denied:   '#f87171',
  };
  return (
    <span style={{
      background:   colors[status] ?? 'transparent',
      color:        text[status]   ?? 'rgba(255,255,255,0.5)',
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
      background:   isPay ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)',
      color:        isPay ? '#f87171' : '#4ade80',
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

export default function PaymentRequestsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
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

  const pending  = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const denied   = requests.filter(r => r.status === 'denied').length;

  return (
    <div className={styles.page}>
      <Link href={`${base}/accounting`} className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden /> Back to Money
      </Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><ArrowUpRight size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Payment Requests</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={openForm}>
          + New Request
        </button>
      </div>

      {/* Summary row */}
      {requests.length > 0 && (
        <div className={styles.summaryGrid} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Pending</span>
            <span className={styles.summaryCardValue} style={{ color: '#facc15' }}>{pending}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Approved</span>
            <span className={styles.summaryCardValue} style={{ color: '#4ade80' }}>{approved}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Denied</span>
            <span className={styles.summaryCardValue} style={{ color: '#f87171' }}>{denied}</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {requests.map(r => (
            <div key={r.id} className={styles.detailSection} style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <TypeBadge type={r.requestType} />
                    <StatusBadge status={r.status} />
                    <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>
                      {fmt(r.amount)}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.88rem' }}>{r.description}</p>
                  <p className={styles.muted} style={{ margin: '0.2rem 0 0', fontSize: '0.78rem' }}>
                    Submitted {fmtDate(r.createdAt)}
                    {r.paymentMethod && ` · ${r.paymentMethod}`}
                    {r.reviewedAt && ` · Reviewed ${fmtDate(r.reviewedAt)}`}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                  {(r.notes || r.status === 'denied') && (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      {expandedId === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                  {r.status === 'pending' && (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem', color: '#f87171' }}
                      onClick={() => handleCancel(r.id)}
                      disabled={cancelling === r.id}
                    >
                      {cancelling === r.id ? '…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>

              {expandedId === r.id && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {r.status === 'denied' && r.denialReason && (
                    <div style={{
                      background:   'rgba(248,113,113,0.08)',
                      border:       '1px solid rgba(248,113,113,0.2)',
                      borderRadius: 6,
                      padding:      '0.6rem 0.75rem',
                      marginBottom: r.notes ? '0.5rem' : 0,
                    }}>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#f87171' }}>Denial reason:</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{r.denialReason}</p>
                    </div>
                  )}
                  {r.notes && (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
                      <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Notes:</strong> {r.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Request form */}
      {showForm && (
        <div className={styles.modalOverlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>New Payment Request</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              {/* Type picker */}
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Request Type <span style={{ color: '#f87171' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setFormType('payment_to_org')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: `2px solid ${formType === 'payment_to_org' ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
                      background: formType === 'payment_to_org' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.03)',
                      color: formType === 'payment_to_org' ? '#f87171' : 'rgba(255,255,255,0.5)',
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
                      border: `2px solid ${formType === 'charge_to_org' ? '#4ade80' : 'rgba(255,255,255,0.1)'}`,
                      background: formType === 'charge_to_org' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.03)',
                      color: formType === 'charge_to_org' ? '#4ade80' : 'rgba(255,255,255,0.5)',
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
                <label className={styles.label} htmlFor="pr-amount">Amount ($) <span style={{ color: '#f87171' }}>*</span></label>
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
                <label className={styles.label} htmlFor="pr-desc">Description <span style={{ color: '#f87171' }}>*</span></label>
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
              <button type="button" className={styles.btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
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
    </div>
  );
}
