'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft, Check, X } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../rep-teams.module.css';

interface PaymentRequest {
  id: string;
  teamId: string;
  teamName: string | null;
  requestType: 'payment_to_org' | 'charge_to_org';
  amount: number;
  description: string;
  paymentMethod: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'denied';
  denialReason: string | null;
  budgetLineId: string | null;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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
      background:    colors[status] ?? 'transparent',
      color:         text[status]   ?? 'var(--white-50)',
      borderRadius: '2px',
      padding:       '0.2rem 0.55rem',
      fontSize:      '0.75rem',
      fontWeight:    600,
      textTransform: 'capitalize',
      display:       'inline-block',
    }}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isPay = type === 'payment_to_org';
  return (
    <span style={{
      display:    'inline-flex',
      alignItems: 'center',
      gap:        '0.3rem',
      background: isPay ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)',
      color:      isPay ? '#f87171' : '#4ade80',
      borderRadius: '2px',
      padding:    '0.2rem 0.55rem',
      fontSize:   '0.75rem',
      fontWeight: 600,
    }}>
      {isPay
        ? <><ArrowUpRight size={12} /> Pay Org</>
        : <><ArrowDownLeft size={12} /> Request from Org</>}
    </span>
  );
}

export default function AdminPaymentRequestsPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const canReview = userRole === 'owner' || userRole === 'treasurer' || userRole === 'admin';

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [pendingRequests, setPendingRequests]  = useState<PaymentRequest[]>([]);
  const [historyRequests, setHistoryRequests]  = useState<PaymentRequest[]>([]);
  const [fetching, setFetching]               = useState(true);
  const [error, setError]                     = useState('');

  const [denyTarget, setDenyTarget]   = useState<PaymentRequest | null>(null);
  const [denyReason, setDenyReason]   = useState('');
  const [denyError, setDenyError]     = useState('');
  const [reviewing, setReviewing]     = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    if (!currentOrg) return;
    const res = await fetch(`/api/admin/rep-teams/payment-requests?status=pending${orgParam}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load');
    setPendingRequests(data.requests ?? []);
  }, [currentOrg, orgParam]);

  const loadHistory = useCallback(async () => {
    if (!currentOrg) return;
    const res = await fetch(`/api/admin/rep-teams/payment-requests?status=all${orgParam}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load');
    setHistoryRequests((data.requests ?? []).filter((r: PaymentRequest) => r.status !== 'pending'));
  }, [currentOrg, orgParam]);

  const load = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      await Promise.all([loadPending(), loadHistory()]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load payment requests.');
    } finally {
      setFetching(false);
    }
  }, [loadPending, loadHistory]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  async function handleApprove(req: PaymentRequest) {
    setReviewing(req.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/payment-requests/${req.id}${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Approval failed');
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Approval failed.');
    } finally {
      setReviewing(null);
    }
  }

  function openDeny(req: PaymentRequest) {
    setDenyTarget(req);
    setDenyReason('');
    setDenyError('');
  }

  async function handleDeny() {
    if (!denyTarget) return;
    if (!denyReason.trim()) { setDenyError('A denial reason is required.'); return; }
    setReviewing(denyTarget.id);
    setDenyError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/payment-requests/${denyTarget.id}${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deny', denialReason: denyReason.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Denial failed');
      setDenyTarget(null);
      await load();
    } catch (e: any) {
      setDenyError(e.message ?? 'Denial failed.');
    } finally {
      setReviewing(null);
    }
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <ArrowUpRight size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  const tabStyle = (active: boolean) => ({
    padding:       '0.5rem 1.1rem',
    borderRadius: '2px',
    border:        'none',
    background:    active ? 'var(--white-8)' : 'transparent',
    color:         active ? 'var(--white-90)' : 'var(--white-40)',
    fontWeight:    active ? 600 : 400,
    fontSize:      '0.88rem',
    cursor:        'pointer',
    position:      'relative' as const,
  });

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span>/</span>
        <span>Payment Requests</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><ArrowUpRight size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Payment Requests</h1>
            <p className={styles.pageSub}>{currentOrg?.name} — inbound team payment requests</p>
          </div>
        </div>
      </div>

      {error && <p className={styles.errorText} style={{ marginBottom: '1rem' }}>{error}</p>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--white-8)', paddingBottom: '0' }}>
        <button type="button" style={tabStyle(tab === 'pending')} onClick={() => setTab('pending')}>
          Pending
          {pendingRequests.length > 0 && (
            <span style={{
              marginLeft: '0.4rem',
              background: '#facc15',
              color: '#000',
              borderRadius: '2px',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.05rem 0.45rem',
            }}>
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button type="button" style={tabStyle(tab === 'history')} onClick={() => setTab('history')}>
          History
        </button>
      </div>

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : tab === 'pending' ? (
        pendingRequests.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.muted}>No pending payment requests.</p>
            <p className={styles.muted} style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
              When coaches submit payment requests, they&apos;ll appear here for your review.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingRequests.map(r => (
              <div key={r.id} style={{
                background:   'var(--white-03)',
                border:       '1px solid var(--white-8)',
                borderRadius: '2px',
                padding:      '1rem 1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--white-90)', fontSize: '0.88rem' }}>
                        {r.teamName ?? r.teamId}
                      </span>
                      <TypeBadge type={r.requestType} />
                      <span style={{ fontWeight: 700, color: 'var(--white-80)', fontSize: '0.95rem' }}>
                        {fmt(r.amount)}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--white-80)', fontSize: '0.88rem' }}>{r.description}</p>
                    <p className={styles.muted} style={{ margin: '0.2rem 0 0', fontSize: '0.78rem' }}>
                      Submitted {fmtDate(r.createdAt)}
                      {r.paymentMethod && ` · ${r.paymentMethod}`}
                    </p>
                    {r.notes && (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--white-50)', fontStyle: 'italic' }}>
                        {r.notes}
                      </p>
                    )}
                  </div>

                  {canReview && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleApprove(r)}
                        disabled={reviewing === r.id}
                        style={{
                          display:    'inline-flex',
                          alignItems: 'center',
                          gap:        '0.35rem',
                          padding:    '0.4rem 0.85rem',
                          borderRadius: '2px',
                          border:     'none',
                          background: reviewing === r.id ? 'rgba(74,222,128,0.1)' : 'rgba(74,222,128,0.15)',
                          color:      '#4ade80',
                          fontWeight: 600,
                          fontSize:   '0.82rem',
                          cursor:     reviewing === r.id ? 'default' : 'pointer',
                        }}
                      >
                        <Check size={14} />
                        {reviewing === r.id ? '…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeny(r)}
                        disabled={reviewing === r.id}
                        style={{
                          display:    'inline-flex',
                          alignItems: 'center',
                          gap:        '0.35rem',
                          padding:    '0.4rem 0.85rem',
                          borderRadius: '2px',
                          border:     '1px solid rgba(248,113,113,0.25)',
                          background: 'transparent',
                          color:      '#f87171',
                          fontWeight: 600,
                          fontSize:   '0.82rem',
                          cursor:     reviewing === r.id ? 'default' : 'pointer',
                        }}
                      >
                        <X size={14} />
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // History tab
        historyRequests.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.muted}>No reviewed requests yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table} style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th className={styles.th}>Team</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Description</th>
                  <th className={styles.th} style={{ textAlign: 'right' }}>Amount</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {historyRequests.map(r => (
                  <tr key={r.id} className={styles.tr}>
                    <td className={styles.td} style={{ fontWeight: 600, color: 'var(--white-80)', whiteSpace: 'nowrap' }}>
                      {r.teamName ?? '—'}
                    </td>
                    <td className={styles.td}><TypeBadge type={r.requestType} /></td>
                    <td className={styles.td}>
                      <span style={{ color: 'var(--white-80)', fontSize: '0.85rem' }}>{r.description}</span>
                      {r.denialReason && (
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.77rem', color: '#f87171', fontStyle: 'italic' }}>
                          Denied: {r.denialReason}
                        </p>
                      )}
                    </td>
                    <td className={styles.td} style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {fmt(r.amount)}
                    </td>
                    <td className={styles.td}><StatusBadge status={r.status} /></td>
                    <td className={styles.td} style={{ whiteSpace: 'nowrap', color: 'var(--white-45)', fontSize: '0.82rem' }}>
                      {r.reviewedAt ? fmtDate(r.reviewedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Deny modal */}
      {denyTarget && (
        <div className={styles.confirmOverlay} onClick={() => setDenyTarget(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <p className={styles.confirmTitle}>Deny request from {denyTarget.teamName ?? 'this team'}?</p>
            <p className={styles.confirmMsg}>
              <TypeBadge type={denyTarget.requestType} />{' '}
              {fmt(denyTarget.amount)} — {denyTarget.description}
            </p>
            <div className={styles.field} style={{ marginTop: '0.75rem' }}>
              <label className={styles.label} htmlFor="deny-reason">
                Reason <span style={{ color: '#f87171' }}>*</span>
              </label>
              <textarea
                id="deny-reason"
                className={styles.textarea}
                value={denyReason}
                onChange={e => setDenyReason(e.target.value)}
                placeholder="Explain why this request is being denied — the coach will see this."
                rows={3}
                autoFocus
              />
            </div>
            {denyError && <p className={styles.errorText}>{denyError}</p>}
            <div className={styles.confirmActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setDenyTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeny}
                disabled={reviewing === denyTarget.id || !denyReason.trim()}
              >
                {reviewing === denyTarget.id ? 'Denying…' : 'Deny Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
