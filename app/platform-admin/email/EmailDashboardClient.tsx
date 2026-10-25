'use client';

import { useState, useCallback, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { Send, Eye, ChevronDown, ChevronRight, X, RotateCcw, Pencil, Lock, AlertTriangle, Clock } from 'lucide-react';
import type { EmailBatch, OptOutOrg, MarketingSchedule } from './page';
import { fmtAbsoluteDateTime } from '@/lib/format-date';
import { warmEmailForPreview } from '@/lib/email-envelope-warm';
import { UPCOMING_WINDOW_DAYS, classifyCampaignSend, daysUntil, formatPlannedDate } from '@/lib/marketing-schedule';
import { LIVE_MARKETING_CAMPAIGNS } from '@/lib/marketing-email-defaults';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import styles from './email.module.css';
import DateInput from '@/components/shared/DateInput';

// ── Founding season email schedule ────────────────────────────────────────────
// Built from the campaign registry (lib/marketing-email-defaults.ts), which is the one place a
// campaign is declared — Founding Season 2027 Phase 1.
//
// ⚠ THIS LIST USED TO BE HARDCODED HERE, and that is exactly how it went wrong. The table
// already preferred the DB's subject and planned date, so the stale copies looked harmless —
// but the "Confirm Send" dialog reads `email.subject` straight off this list, so an operator
// about to mail real customers was shown a subject line two rewrites out of date. A retired
// campaign also stayed on the board, marked past due, one click from a send that would have
// pitched a parked product.

type ScheduledEmail = {
  emailKey: string;
  subject: string;
  sendDate: string;      // display string, used for trigger campaigns (dated ones read the DB)
  audience: string;
  isTransactional: boolean;
  // How the send fires — a fixed calendar date (default), or a system event ("at
  // signup", "~day 60"). Content is editable regardless; timing/audience are
  // system-defined.
  timingKind?: 'date' | 'trigger';
};

const SCHEDULED_EMAILS: ScheduledEmail[] = LIVE_MARKETING_CAMPAIGNS.map(c => ({
  emailKey: c.key,
  // Fallback only for the table (which prefers the operator-editable DB subject), but the ONE
  // source for the Confirm Send dialog — so it must track the copy, and now it cannot drift.
  subject: c.subject,
  sendDate: c.timing.kind === 'trigger' ? c.timing.when : formatPlannedDate(c.timing.plannedSendDate),
  audience: c.audienceLabel,
  isTransactional: c.isTransactional === true,
  timingKind: c.timing.kind,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

// Was calling toLocaleDateString() with time options (wrong API — PF-5 fix);
// now routed through the shared date+time helper.
const formatDate = (iso: string | null): string => fmtAbsoluteDateTime(iso);

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    scheduled: '',
    pending: kit.chipWarn,
    running: kit.chipWarn,
    complete: kit.chipOk,
    sent: kit.chipOk,
    failed: kit.chipBad,
    past_due: kit.chipBad,
    due_soon: kit.chipWarn,
    planned: kit.chipQuiet,
    auto: kit.chipInfo,
  };
  const label: Record<string, string> = {
    scheduled: 'Scheduled',
    pending: 'Pending',
    running: 'Running',
    complete: 'Complete',
    failed: 'Failed',
    sent: 'Sent',
    past_due: 'Past due',
    due_soon: 'Due soon',
    planned: 'Planned',
    auto: 'Auto',
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

// ── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  email,
  onClose,
}: {
  email: ScheduledEmail;
  onClose: () => void;
}) {
  // Render the SAME HTML the send path produces, server-side, via the shared template
  // resolver — so "what you preview" always equals "what is sent". (Replaces the old
  // hardcoded client-side preview mirror that could drift from the real email.)
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>(email.subject);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The modal is remounted per email (key on the render site), so state starts fresh —
    // no synchronous reset needed here.
    let active = true;
    fetch(`/api/admin/email/preview?emailKey=${encodeURIComponent(email.emailKey)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Failed to load preview');
        return d;
      })
      .then(d => { if (!active) return; setHtml(d.html); if (d.subject) setSubject(d.subject); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unknown error'); });
    return () => { active = false; };
  }, [email.emailKey]);

  return (
    <div className="modal-overlay" onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="email-preview-title" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 id="email-preview-title">Email preview — {email.emailKey}</h3>
            <div className={styles.modalSubject}>{subject}</div>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {error ? (
            <div className={styles.previewNotice}>
              <p className={styles.previewError}>Couldn&apos;t load preview.</p>
              <p>{error}</p>
            </div>
          ) : html === null ? (
            <div className={styles.previewNotice}>
              <p>Loading preview…</p>
            </div>
          ) : (
            <div className={styles.previewFrame}>
              <div dangerouslySetInnerHTML={{ __html: warmEmailForPreview(html) }} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <Link href={`/platform-admin/email-templates/${email.emailKey}`} className="btn btn-secondary btn-sm">
            <Pencil size={12} aria-hidden /> Edit content
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Send confirmation modal ───────────────────────────────────────────────────

function SendConfirmModal({
  email,
  recipientCount,
  onConfirm,
  onCancel,
  sending,
}: {
  email: ScheduledEmail;
  recipientCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  sending: boolean;
}) {
  return (
    <div className="modal-overlay" onPointerDown={e => { if (e.target === e.currentTarget) (onCancel)?.(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="email-confirm-title" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="email-confirm-title">Confirm send</h3>
          <button type="button" className={styles.modalClose} onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className={styles.confirmTitle}>⚠ This will send real emails</div>
        <p>
          You are about to send <strong>{email.emailKey}</strong> to{' '}
          <strong>{recipientCount} recipient{recipientCount !== 1 ? 's' : ''}</strong>.
          <br /><br />
          Subject: <em>{email.subject}</em>
          <br /><br />
          This action cannot be undone. Ensure RESEND_API_KEY is configured and
          the recipient list looks correct before proceeding.
        </p>
        {sending && (
          <p className={styles.sendingNote}>
            Sending in progress — do not close this window.
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={sending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={sending}
          >
            {sending ? 'Sending…' : `Send to ${recipientCount} recipients`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type SendResult = { batchId: string | null; sent: number; suppressed: number; failed: number; message?: string } | null;

export default function EmailDashboardClient({
  initialBatches,
  initialOptOuts,
  recipientCount,
  optOutCount,
  recipientCounts,
  adminEmail,
  schedule: initialSchedule,
  todayISO,
}: {
  initialBatches: EmailBatch[];
  initialOptOuts: OptOutOrg[];
  recipientCount: number;
  optOutCount: number;
  recipientCounts: Record<string, number>;
  adminEmail: string;
  schedule: MarketingSchedule;
  todayISO: string;
}) {
  const [batches, setBatches] = useState<EmailBatch[]>(initialBatches);
  const [optOuts, setOptOuts] = useState<OptOutOrg[]>(initialOptOuts);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<ScheduledEmail | null>(null);
  const [sendTarget, setSendTarget] = useState<ScheduledEmail | null>(null);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult>(null);
  const [resubscribing, setResubscribing] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<MarketingSchedule>(initialSchedule);

  // Date-edit modal state.
  const [dateEditKey, setDateEditKey] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState('');
  const [savingDate, setSavingDate] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // ── Planned-date save handler ──────────────────────────────────────────────
  async function handleSaveDate() {
    if (!dateEditKey || !dateDraft) return;
    setSavingDate(true);
    setDateError(null);
    try {
      const res = await fetch('/api/admin/email/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailKey: dateEditKey, plannedDate: dateDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save date');
      setSchedule(prev => ({
        ...prev,
        [dateEditKey]: { ...prev[dateEditKey], plannedDate: data.plannedDate ?? dateDraft },
      }));
      setDateEditKey(null);
    } catch (e) {
      setDateError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSavingDate(false);
    }
  }

  function openDateEditor(email: ScheduledEmail) {
    const planned = schedule[email.emailKey]?.plannedDate ?? '';
    setDateDraft(planned);
    setDateError(null);
    setDateEditKey(email.emailKey);
  }

  // ── Send handler ──────────────────────────────────────────────────────────

  async function handleSend() {
    if (!sendTarget) return;
    setSending(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/admin/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailKey: sendTarget.emailKey }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLastResult({ batchId: null, sent: 0, suppressed: 0, failed: 0, message: data.error });
      } else {
        setLastResult(data);
        // Refresh batches from server
        const refreshRes = await fetch('/api/admin/email');
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setBatches(refreshData.batches ?? batches);
        }
      }
    } catch (e) {
      setLastResult({ batchId: null, sent: 0, suppressed: 0, failed: 0, message: 'Network error' });
    } finally {
      setSending(false);
      setSendTarget(null);
    }
  }

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

  // ── Whether a scheduled email has a sent batch ────────────────────────────

  function getBatchForKey(emailKey: string): EmailBatch | null {
    return batches.find(b => b.email_key === emailKey && b.status === 'complete') ?? null;
  }

  // ── Merge each campaign with its schedule + computed send status ────────────
  const rows = SCHEDULED_EMAILS.map(email => {
    const info = schedule[email.emailKey];
    const plannedDate = info?.plannedDate ?? null;
    const sent = !!getBatchForKey(email.emailKey);
    const status = classifyCampaignSend({ plannedDate, sent, isTrigger: email.timingKind === 'trigger', todayISO });
    const subject = info?.subject || email.subject; // prefer the (editable) DB subject
    const editableDate = email.timingKind !== 'trigger';
    return { email, plannedDate, sent, status, subject, editableDate };
  });
  const pastDue = rows.filter(r => r.status === 'past_due');
  const upcoming = rows
    .filter(r => r.status === 'due_soon')
    .sort((a, b) => (a.plannedDate ?? '').localeCompare(b.plannedDate ?? ''));

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Campaigns" />

      {/* Result banner */}
      {lastResult && (
        <div className={`${kit.notice} ${lastResult.message ? kit.noticeBad : kit.noticeGood}`} role="status">
          {lastResult.message
            ? `Error: ${lastResult.message}`
            : `Sent: ${lastResult.sent} · Suppressed: ${lastResult.suppressed} · Failed: ${lastResult.failed} · Batch: ${lastResult.batchId ?? 'n/a'}`
          }
        </div>
      )}

      {/* ── Needs sending (past due + upcoming) ── */}
      {pastDue.length > 0 && (
        <section className={kit.section}>
          <h2 className={`${kit.sectionTitle} ${styles.needsTitle}`}>
            <AlertTriangle size={15} aria-hidden /> Past due — send now ({pastDue.length})
          </h2>
          <div className={`${kit.card} ${styles.needsCard} ${styles.needsBad}`}>
            {pastDue.map(r => (
              <div key={r.email.emailKey} className={styles.needsItem}>
                <div className={styles.needsItemMain}>
                  <span className={styles.needsDate}>{r.plannedDate ? formatPlannedDate(r.plannedDate) : '—'}</span>
                  <span className={styles.needsSubject} title={r.subject}>{r.subject}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSendTarget(r.email)}>
                  <Send size={12} aria-hidden /> Send now
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {upcoming.length > 0 && (
        <section className={kit.section}>
          <h2 className={`${kit.sectionTitle} ${styles.needsTitle}`}>
            <Clock size={15} aria-hidden /> Upcoming — next {UPCOMING_WINDOW_DAYS} days ({upcoming.length})
          </h2>
          <div className={`${kit.card} ${styles.needsCard} ${styles.needsWarn}`}>
            {upcoming.map(r => (
              <div key={r.email.emailKey} className={styles.needsItem}>
                <div className={styles.needsItemMain}>
                  <span className={styles.needsDate}>{r.plannedDate ? formatPlannedDate(r.plannedDate) : '—'}</span>
                  <span className={styles.needsSubject} title={r.subject}>{r.subject}</span>
                  <span className={styles.needsDays}>
                    in {daysUntil(r.plannedDate!, todayISO)} day{daysUntil(r.plannedDate!, todayISO) !== 1 ? 's' : ''}
                  </span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSendTarget(r.email)}>
                  <Send size={12} aria-hidden /> Send early
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats */}
      <section className={kit.band} aria-label="Founding season email audience">
        <div className={`${kit.bandCell} ${styles.help}`} title="All organizations on a Founding Season comp period (free through September 30, 2027), including opted-out.">
          <span className={kit.bandLabel}>Founding season orgs</span>
          <strong className={kit.bandValue}>{recipientCount + optOutCount}</strong>
        </div>
        <div className={`${kit.bandCell} ${styles.help}`} title="Founding-season orgs that have NOT opted out of marketing email — the default 'founding' send audience.">
          <span className={kit.bandLabel}>Active recipients</span>
          <strong className={kit.bandValue}>{recipientCount}</strong>
        </div>
        <div className={`${kit.bandCell} ${styles.help}`} title="Founding-season orgs that opted out of marketing email and are suppressed from every send.">
          <span className={kit.bandLabel}>Opted out</span>
          <strong className={kit.bandValue}>{optOutCount}</strong>
        </div>
      </section>
      <p className={kit.caption}>
        Founding season organizations with active marketing email consent. Counts exclude opted-out orgs.
      </p>

      {/* ── Scheduled Sends ── */}
      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Scheduled sends</h2>
        <p className={kit.caption}>
          All {SCHEDULED_EMAILS.length} founding season emails. <strong>Subject, content &amp; calendar send dates are editable</strong>;
          <Lock size={10} aria-hidden style={{ verticalAlign: '-1px', margin: '0 0.15rem 0 0.3rem', opacity: 0.6 }} />
          trigger-based timing &amp; audience are set by the system. Sends are manual — this board tells you when.
        </p>
        <div className={kit.card}>
          <div className={`${kit.tableWrap} table-cards`}>
            <table>
              <thead>
                <tr>
                  <th>Email key</th>
                  <th>Subject</th>
                  <th>Send date</th>
                  <th>Audience</th>
                  <th>Recipients</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ email, plannedDate, sent, status, subject, editableDate }) => {
                  const count = email.isTransactional ? null : (recipientCounts[email.emailKey] ?? recipientCount);

                  return (
                    <tr key={email.emailKey}>
                      <td className="table-cards-title"><span className={`${kit.code} ${kit.nowrap}`}>{email.emailKey}</span></td>
                      <td data-label="Subject"><span className={styles.subject} title={subject}>{subject}</span></td>
                      <td data-label="Send date">
                        {editableDate ? (
                          <button
                            type="button"
                            className={styles.dateEditBtn}
                            onClick={() => openDateEditor(email)}
                            title="Edit planned send date"
                          >
                            <span>{plannedDate ? formatPlannedDate(plannedDate) : 'Set date'}</span>
                            <Pencil size={10} aria-hidden style={{ marginLeft: '0.35rem', opacity: 0.5 }} />
                          </button>
                        ) : (
                          <span title="System-defined: this email fires on an event, not a fixed date.">
                            <span className={styles.triggerDate}>
                              <Lock size={10} aria-hidden style={{ verticalAlign: '-1px', marginRight: '0.3rem', opacity: 0.45 }} />
                              {email.sendDate}
                            </span>
                          </span>
                        )}
                      </td>
                      <td data-label="Audience" title="System-defined audience (backed by real queries + consent rules).">
                        <span className={styles.audience}>
                          <Lock size={10} aria-hidden style={{ verticalAlign: '-1px', marginRight: '0.3rem', opacity: 0.45 }} />
                          {email.audience}
                        </span>
                      </td>
                      <td data-label="Recipients" className={kit.num}>
                        {email.isTransactional ? '—' : count ?? '…'}
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={status} />
                      </td>
                      <td data-label="Actions">
                        <div className={styles.actions}>
                          <Link
                            href={`/platform-admin/email-templates/${email.emailKey}`}
                            className={`btn btn-secondary btn-sm ${styles.iconBtn}`}
                            title="Edit content (subject & body)"
                            aria-label="Edit content (subject & body)"
                          >
                            <Pencil size={12} aria-hidden />
                          </Link>
                          <button
                            type="button"
                            className={`btn btn-secondary btn-sm ${styles.iconBtn}`}
                            onClick={() => setPreviewEmail(email)}
                            title="Preview"
                            aria-label="Preview"
                          >
                            <Eye size={12} aria-hidden />
                          </button>
                          {!email.isTransactional && (
                            <button
                              type="button"
                              className={`btn btn-secondary btn-sm ${styles.iconBtn}`}
                              onClick={() => setSendTarget(email)}
                              disabled={sent}
                              title={sent ? 'Already sent' : 'Send now'}
                              aria-label={sent ? 'Already sent' : 'Send now'}
                            >
                              <Send size={12} aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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

      {/* ── Modals ── */}
      {previewEmail && (
        <PreviewModal key={previewEmail.emailKey} email={previewEmail} onClose={() => setPreviewEmail(null)} />
      )}

      {sendTarget && (
        <SendConfirmModal
          email={sendTarget}
          recipientCount={recipientCounts[sendTarget.emailKey] ?? recipientCount}
          onConfirm={handleSend}
          onCancel={() => setSendTarget(null)}
          sending={sending}
        />
      )}

      {dateEditKey && (
        <div className="modal-overlay" onPointerDown={e => { if (e.target === e.currentTarget) (() => !savingDate && setDateEditKey(null))?.(); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="email-date-title" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="email-date-title">Planned send date</h3>
              <button type="button" className={styles.modalClose} onClick={() => setDateEditKey(null)} aria-label="Close" disabled={savingDate}>
                <X size={16} />
              </button>
            </div>
            <p>
              Set the planned send date for <strong>{dateEditKey}</strong>. This is a reminder of when to
              send — it appears in the &ldquo;upcoming&rdquo; and &ldquo;past due&rdquo; lists. It does{' '}
              <strong>not</strong> send automatically.
            </p>
            <DateInput
              className={`${kit.field} ${styles.dateInput}`}
              aria-label="Planned send date"
              value={dateDraft}
              onChange={v => setDateDraft(v)}
              disabled={savingDate}
            />
            {dateError && <p className={styles.dateError}>{dateError}</p>}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDateEditKey(null)} disabled={savingDate}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveDate} disabled={savingDate || !dateDraft}>
                {savingDate ? 'Saving…' : 'Save date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
