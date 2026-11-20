'use client';

import { useState, useCallback, useEffect, Fragment } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import type { EmailBatch, OptOutOrg } from './page';
import { fmtAbsoluteDateTime } from '@/lib/format-date';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import styles from './email.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Was calling toLocaleDateString() with time options (wrong API — PF-5 fix);
// now routed through the shared date+time helper.
const formatDate = (iso: string | null): string => fmtAbsoluteDateTime(iso);

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: kit.chipWarn,
    running: kit.chipWarn,
    complete: kit.chipOk,
    sent: kit.chipOk,
    failed: kit.chipBad,
  };
  const label: Record<string, string> = {
    pending: 'Pending',
    running: 'Running',
    complete: 'Complete',
    failed: 'Failed',
    sent: 'Sent',
  };
  return <span className={`${kit.chip} ${cls[status] ?? kit.chipQuiet}`}>{label[status] ?? status}</span>;
}

// ── Sub-component: individual sends for an expanded batch ─────────────────────

type IndividualSend = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  status: string;
  suppression_reason: string | null;
  resend_message_id: string | null;
  sent_at: string | null;
};

function BatchSendsTable({ batchId }: { batchId: string }) {
  const [sends, setSends] = useState<IndividualSend[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/email/sends?batchId=${batchId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setSends(data.sends ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  // Load on mount
  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <table className={styles.subTable}>
      <tbody><tr><td colSpan={5} className={styles.subNote}>Loading…</td></tr></tbody>
    </table>
  );

  if (error) return (
    <table className={styles.subTable}>
      <tbody><tr><td colSpan={5} className={`${styles.subNote} ${styles.subError}`}>Error: {error}</td></tr></tbody>
    </table>
  );

  if (!sends?.length) return (
    <table className={styles.subTable}>
      <tbody><tr><td colSpan={5} className={styles.subNote}>No send records found.</td></tr></tbody>
    </table>
  );

  return (
    <table className={styles.subTable}>
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Status</th>
          <th>Sent at</th>
          <th>Resend ID</th>
        </tr>
      </thead>
      <tbody>
        {sends.map(s => (
          <tr key={s.id}>
            <td>{s.recipient_email}</td>
            <td>{s.recipient_name ?? '—'}</td>
            <td><StatusBadge status={s.status} />{s.suppression_reason ? ` (${s.suppression_reason})` : ''}</td>
            <td>{formatDate(s.sent_at)}</td>
            <td><span className={kit.code}>{s.resend_message_id ?? '—'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmailDashboardClient({
  initialBatches,
  initialOptOuts,
}: {
  initialBatches: EmailBatch[];
  initialOptOuts: OptOutOrg[];
}) {
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [optOuts, setOptOuts] = useState<OptOutOrg[]>(initialOptOuts);
  const [resubscribing, setResubscribing] = useState<string | null>(null);

  // ── Resubscribe handler ───────────────────────────────────────────────────

  async function handleResubscribe(orgId: string) {
    setResubscribing(orgId);
    try {
      const res = await fetch('/api/admin/email/resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) {
        setOptOuts(prev => prev.filter(o => o.orgId !== orgId));
      }
    } finally {
      setResubscribing(null);
    }
  }

  const batches = initialBatches;

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Campaigns" />
      <p className={`${kit.caption} ${kit.captionTight}`}>No campaign is planned. Past sends and opt-outs are kept here. Leads are never emailed from here.</p>

      {/* ── Sent History ── */}
      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Sent history</h2>
        <p className={kit.caption}>Batch-level log — expand row for individual recipients</p>
        {batches.length === 0 ? (
          <div className={kit.card}><div className={kit.empty}>No email batches sent yet.</div></div>
        ) : (
          <div className={kit.card}>
            {/* A COMPARISON-shaped log (ten columns, a row that opens a nested table): it keeps its columns and
                scrolls inside its own box — it never becomes cards. */}
            <div className={kit.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th aria-label="Expand"></th>
                    <th>Email key</th>
                    <th>Subject</th>
                    <th>Triggered by</th>
                    <th className={kit.num}>Recipients</th>
                    <th className={kit.num}>Sent</th>
                    <th className={kit.num}>Suppressed</th>
                    <th className={kit.num}>Failed</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(batch => (
                    <Fragment key={batch.id}>
                      <tr>
                        <td className={styles.expandCell}>
                          <button
                            type="button"
                            className={`btn btn-secondary btn-sm ${styles.iconBtn}`}
                            onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                            title="Expand recipients"
                            aria-label="Expand recipients"
                            aria-expanded={expandedBatch === batch.id}
                          >
                            {expandedBatch === batch.id ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
                          </button>
                        </td>
                        <td><span className={`${kit.code} ${kit.nowrap}`}>{batch.email_key}</span></td>
                        <td><span className={styles.subject} title={batch.subject}>{batch.subject}</span></td>
                        <td className={kit.muted}>{batch.triggered_by}</td>
                        <td className={kit.num}>{batch.recipient_count}</td>
                        <td className={`${kit.num} ${styles.okNum}`}>{batch.sent_count}</td>
                        <td className={`${kit.num} ${styles.warnNum}`}>{batch.suppressed_count}</td>
                        <td className={`${kit.num} ${styles.badNum}`}>{batch.failed_count}</td>
                        <td><StatusBadge status={batch.status} /></td>
                        <td className={kit.nowrap}>{formatDate(batch.created_at)}</td>
                      </tr>
                      {expandedBatch === batch.id && (
                        <tr className={styles.expandedRow}>
                          <td colSpan={10}>
                            <BatchSendsTable batchId={batch.id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Opt-Outs ── */}
      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Opt-outs</h2>
        <p className={kit.caption}>{optOuts.length} org{optOuts.length !== 1 ? 's' : ''} unsubscribed</p>
        {optOuts.length === 0 ? (
          <div className={kit.card}><div className={kit.empty}>No opt-outs yet.</div></div>
        ) : (
          <div className={kit.card}>
            <div className={`${kit.tableWrap} table-cards`}>
              <table>
                <thead>
                  <tr>
                    <th>Org name</th>
                    <th>Owner email</th>
                    <th>Opted out</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {optOuts.map(org => (
                    <tr key={org.orgId}>
                      <td className="table-cards-title">{org.orgName}</td>
                      <td data-label="Owner email">{org.ownerEmail ?? '—'}</td>
                      <td data-label="Opted out" className={kit.nowrap}>{formatDate(org.optedOutAt)}</td>
                      <td data-label="Action">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleResubscribe(org.orgId)}
                          disabled={resubscribing === org.orgId}
                          title="Re-subscribe (only if org owner has explicitly requested)"
                        >
                          <RotateCcw size={12} aria-hidden />
                          {resubscribing === org.orgId ? ' …' : ' Re-subscribe'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
