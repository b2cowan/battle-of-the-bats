'use client';

import { useState, useCallback, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { Send, Eye, ChevronDown, ChevronRight, X, RotateCcw, Pencil, Lock, Calendar, AlertTriangle, Clock } from 'lucide-react';
import type { EmailBatch, OptOutOrg, MarketingSchedule } from './page';
import { fmtAbsoluteDateTime } from '@/lib/format-date';
import { UPCOMING_WINDOW_DAYS, classifyCampaignSend, daysUntil, formatPlannedDate } from '@/lib/marketing-schedule';
import styles from './email.module.css';

// ── Founding season email schedule ────────────────────────────────────────────
// Hardcoded registry matching lib/email-sender.ts TEMPLATE_REGISTRY.
// Update status/sendDate here as templates are built and sends are completed.

type ScheduledEmail = {
  emailKey: string;
  subject: string;
  sendDate: string;      // display string
  audience: string;
  isTransactional: boolean;
  templateBuilt: boolean;
  // How the send fires — a fixed calendar date (default), or a system event ("at
  // signup", "~day 60"). Content is editable regardless; timing/audience are
  // system-defined.
  timingKind?: 'date' | 'trigger';
};

const SCHEDULED_EMAILS: ScheduledEmail[] = [
  {
    emailKey: 'founding_welcome',
    subject: 'Your founding season starts now — Tournament Plus is free through Dec 31',
    sendDate: 'At signup',
    audience: 'Each new founding org owner (transactional)',
    isTransactional: true,
    templateBuilt: true,
    timingKind: 'trigger',
  },
  {
    emailKey: 'founding_checkin',
    subject: "How's your season going? Update from FieldLogicHQ",
    sendDate: '~Day 60 post-signup',
    audience: 'Founding orgs, signed up ≥ 60 days ago',
    isTransactional: false,
    templateBuilt: true,
    timingKind: 'trigger',
  },
  {
    emailKey: 'founding_renewal',
    subject: 'Your founding season ends December 31 — here\'s what happens next',
    sendDate: 'Nov 1, 2026',
    audience: 'All founding season org owners',
    isTransactional: false,
    templateBuilt: true,
  },
  {
    emailKey: 'founding_final',
    subject: '2 weeks left in your founding season',
    sendDate: 'Dec 15, 2026',
    audience: 'All founding season org owners',
    isTransactional: false,
    templateBuilt: true,
  },
  {
    emailKey: 'spotlight_club',
    subject: 'Before your September season starts — Club is free through December 31',
    sendDate: 'Aug 1, 2026',
    audience: 'Org owners',
    isTransactional: false,
    templateBuilt: true,
  },
  {
    emailKey: 'spotlight_league',
    subject: 'What running a house league actually looks like on FieldLogicHQ',
    sendDate: 'Sep 1, 2026',
    audience: 'Org owners',
    isTransactional: false,
    templateBuilt: true,
  },
  {
    emailKey: 'spotlight_coaches_org',
    subject: 'For the coaches on your teams — a workspace that\'s actually theirs',
    sendDate: 'Oct 1, 2026',
    audience: 'Org owners',
    isTransactional: false,
    templateBuilt: true,
  },
  {
    emailKey: 'spotlight_coaches_coach',
    subject: 'For the coaches on your teams — a workspace that\'s actually theirs',
    sendDate: 'Oct 1, 2026',
    audience: 'Coach accounts (tournament participants)',
    isTransactional: false,
    templateBuilt: true,
  },
  {
    emailKey: 'spotlight_club_last',
    subject: 'Last reminder — Club is still free through December 31',
    sendDate: 'Oct 15, 2026',
    audience: 'Org owners not yet on Club plan',
    isTransactional: false,
    templateBuilt: true,
  },
  {
    emailKey: 'spotlight_full_picture',
    subject: 'Where FieldLogicHQ is headed — a note from the founding season',
    sendDate: 'Nov 15, 2026',
    audience: 'All founding season participants',
    isTransactional: false,
    templateBuilt: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Was calling toLocaleDateString() with time options (wrong API — PF-5 fix);
// now routed through the shared date+time helper.
const formatDate = (iso: string | null): string => fmtAbsoluteDateTime(iso);

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    scheduled: styles.badgeScheduled,
    pending: styles.badgePending,
    running: styles.badgeRunning,
    complete: styles.badgeComplete,
    sent: styles.badgeSent,
    failed: styles.badgeFailed,
    past_due: styles.badgePastDue,
    due_soon: styles.badgeDueSoon,
    planned: styles.badgePlanned,
    auto: styles.badgeAuto,
  };
  const label: Record<string, string> = {
    sent: 'Sent',
    past_due: 'Past due',
    due_soon: 'Due soon',
    planned: 'Planned',
    auto: 'Auto',
  };
  return <span className={`${styles.badge} ${cls[status] ?? styles.badgeNotBuilt}`}>{label[status] ?? status}</span>;
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
      <tbody><tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--data-gray)' }}>Loading…</td></tr></tbody>
    </table>
  );

  if (error) return (
    <table className={styles.subTable}>
      <tbody><tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: '#f87171' }}>Error: {error}</td></tr></tbody>
    </table>
  );

  if (!sends?.length) return (
    <table className={styles.subTable}>
      <tbody><tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--data-gray)' }}>No send records found.</td></tr></tbody>
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
            <td><span className={styles.resendId}>{s.resend_message_id ?? '—'}</span></td>
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
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Email Preview — {email.emailKey}</div>
            <div className={styles.modalSubject}>{subject}</div>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {error ? (
            <div className={styles.notBuiltNotice}>
              <p style={{ margin: '0 0 0.5rem', color: '#f87171' }}>Couldn&apos;t load preview.</p>
              <p style={{ margin: 0, opacity: 0.7 }}>{error}</p>
            </div>
          ) : html === null ? (
            <div className={styles.notBuiltNotice}>
              <p style={{ margin: 0, opacity: 0.6 }}>Loading preview…</p>
            </div>
          ) : (
            <div className={styles.previewFrame}>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          )}
        </div>
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(30,58,138,0.2)', textAlign: 'right' }}>
          <Link href={`/platform-admin/email-templates/${email.emailKey}`} className={styles.btnAction} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Pencil size={11} /> Edit content
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
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Confirm Send</div>
          <button className={styles.modalClose} onClick={onCancel} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className={styles.confirmDialog}>
          <div className={styles.confirmTitle}>⚠ This will send real emails</div>
          <p className={styles.confirmBody}>
            You are about to send <strong>{email.emailKey}</strong> to{' '}
            <strong>{recipientCount} recipient{recipientCount !== 1 ? 's' : ''}</strong>.
            <br /><br />
            Subject: <em>{email.subject}</em>
            <br /><br />
            This action cannot be undone. Ensure RESEND_API_KEY is configured and
            the recipient list looks correct before proceeding.
          </p>
          <div className={styles.confirmActions}>
            <button
              className={styles.btnConfirmSend}
              onClick={onConfirm}
              disabled={sending}
            >
              {sending ? 'Sending…' : `Send to ${recipientCount} recipients`}
            </button>
            <button className={styles.btnCancel} onClick={onCancel} disabled={sending}>
              Cancel
            </button>
          </div>
          {sending && (
            <p className={styles.sendingNote}>
              Sending in progress — do not close this window.
            </p>
          )}
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
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerLabel}>Platform Admin</div>
          <h1 className={styles.title}>Email Dashboard</h1>
        </div>
      </div>

      {/* Result banner */}
      {lastResult && (
        <div className={`${styles.resultBanner} ${lastResult.message ? styles.resultError : styles.resultSuccess}`}>
          {lastResult.message
            ? `Error: ${lastResult.message}`
            : `Sent: ${lastResult.sent} · Suppressed: ${lastResult.suppressed} · Failed: ${lastResult.failed} · Batch: ${lastResult.batchId ?? 'n/a'}`
          }
        </div>
      )}

      {/* ── Needs sending (past due + upcoming) ── */}
      {(pastDue.length > 0 || upcoming.length > 0) && (
        <div className={styles.needsSending}>
          {pastDue.length > 0 && (
            <div className={`${styles.needsGroup} ${styles.needsPastDue}`}>
              <div className={styles.needsTitle}>
                <AlertTriangle size={13} /> Past due — send now ({pastDue.length})
              </div>
              {pastDue.map(r => (
                <div key={r.email.emailKey} className={styles.needsItem}>
                  <div className={styles.needsItemMain}>
                    <span className={styles.needsDate}>{r.plannedDate ? formatPlannedDate(r.plannedDate) : '—'}</span>
                    <span className={styles.needsSubject} title={r.subject}>{r.subject}</span>
                  </div>
                  <button className={styles.needsSendBtn} onClick={() => setSendTarget(r.email)}>
                    <Send size={11} /> Send now
                  </button>
                </div>
              ))}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className={`${styles.needsGroup} ${styles.needsUpcoming}`}>
              <div className={styles.needsTitle}>
                <Clock size={13} /> Upcoming — next {UPCOMING_WINDOW_DAYS} days ({upcoming.length})
              </div>
              {upcoming.map(r => (
                <div key={r.email.emailKey} className={styles.needsItem}>
                  <div className={styles.needsItemMain}>
                    <span className={styles.needsDate}>{r.plannedDate ? formatPlannedDate(r.plannedDate) : '—'}</span>
                    <span className={styles.needsSubject} title={r.subject}>{r.subject}</span>
                    <span className={styles.needsDays}>
                      in {daysUntil(r.plannedDate!, todayISO)} day{daysUntil(r.plannedDate!, todayISO) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button className={styles.needsSendBtnGhost} onClick={() => setSendTarget(r.email)}>
                    <Send size={11} /> Send early
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <p className={styles.statsSubtitle}>
        Founding season organizations with active marketing email consent. Counts exclude opted-out orgs.
      </p>
      <div className={styles.statsRow}>
        <div className={styles.statCard} title="All organizations on a founding-season comp period (expiring Jan 1, 2027), including opted-out.">
          <div className={styles.statValue}>{recipientCount + optOutCount}</div>
          <div className={styles.statLabel}>Founding Season Orgs</div>
        </div>
        <div className={styles.statCard} title="Founding-season orgs that have NOT opted out of marketing email — the default 'founding' send audience.">
          <div className={styles.statValue}>{recipientCount}</div>
          <div className={styles.statLabel}>Active Recipients</div>
        </div>
        <div className={styles.statCard} title="Founding-season orgs that opted out of marketing email and are suppressed from every send.">
          <div className={styles.statValue}>{optOutCount}</div>
          <div className={styles.statLabel}>Opted Out</div>
        </div>
      </div>

      {/* ── Scheduled Sends ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Scheduled Sends</span>
          <span className={styles.sectionNote}>
            All 10 founding season emails. <strong>Subject, content &amp; calendar send dates are editable</strong>;
            <Lock size={10} style={{ verticalAlign: '-1px', margin: '0 0.15rem 0 0.3rem', opacity: 0.6 }} />
            trigger-based timing &amp; audience are set by the system. Sends are manual — this board tells you when.
          </span>
        </div>
        <div className={styles.tableScroll}>
        <table className={styles.table}>
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
                  <td><span className={styles.emailKey}>{email.emailKey}</span></td>
                  <td><span className={styles.subject} title={subject}>{subject}</span></td>
                  <td>
                    {editableDate ? (
                      <button
                        className={styles.dateEditBtn}
                        onClick={() => openDateEditor(email)}
                        title="Edit planned send date"
                      >
                        <Calendar size={10} style={{ verticalAlign: '-1px', marginRight: '0.3rem', opacity: 0.75 }} />
                        <span className={styles.sendDate}>{plannedDate ? formatPlannedDate(plannedDate) : 'Set date'}</span>
                        <Pencil size={9} style={{ marginLeft: '0.35rem', opacity: 0.5 }} />
                      </button>
                    ) : (
                      <span title="System-defined: this email fires on an event, not a fixed date.">
                        <Lock size={9} style={{ verticalAlign: '-1px', marginRight: '0.3rem', opacity: 0.45 }} />
                        <span className={styles.sendDate}>{email.sendDate}</span>
                      </span>
                    )}
                  </td>
                  <td title="System-defined audience (backed by real queries + consent rules).">
                    <Lock size={9} style={{ verticalAlign: '-1px', marginRight: '0.3rem', opacity: 0.45 }} />
                    <span className={styles.audience}>{email.audience}</span>
                  </td>
                  <td>
                    <span className={styles.recipientCount}>
                      {email.isTransactional ? '—' : count ?? '…'}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={status} />
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Link
                        href={`/platform-admin/email-templates/${email.emailKey}`}
                        className={`${styles.btnAction} ${styles.btnPreview}`}
                        title="Edit content (subject & body)"
                      >
                        <Pencil size={11} />
                      </Link>
                      <button
                        className={`${styles.btnAction} ${styles.btnPreview}`}
                        onClick={() => setPreviewEmail(email)}
                        title="Preview"
                      >
                        <Eye size={11} />
                      </button>
                      {!email.isTransactional && (
                        <button
                          className={`${styles.btnAction} ${styles.btnSend}`}
                          onClick={() => setSendTarget(email)}
                          disabled={sent}
                          title={sent ? 'Already sent' : 'Send now'}
                        >
                          <Send size={11} />
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

      {/* ── Sent History ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Sent History</span>
          <span className={styles.sectionNote}>Batch-level log — expand row for individual recipients</span>
        </div>
        {batches.length === 0 ? (
          <div className={styles.emptyState}>No email batches sent yet.</div>
        ) : (
          <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th></th>
                <th>Email key</th>
                <th>Subject</th>
                <th>Triggered by</th>
                <th>Recipients</th>
                <th>Sent</th>
                <th>Suppressed</th>
                <th>Failed</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(batch => (
                <Fragment key={batch.id}>
                  <tr>
                    <td style={{ width: '2rem' }}>
                      <button
                        className={`${styles.btnAction} ${styles.btnExpand}`}
                        onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                        title="Expand recipients"
                      >
                        {expandedBatch === batch.id ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                    </td>
                    <td><span className={styles.emailKey}>{batch.email_key}</span></td>
                    <td><span className={styles.subject} title={batch.subject}>{batch.subject}</span></td>
                    <td><span className={styles.audience}>{batch.triggered_by}</span></td>
                    <td>{batch.recipient_count}</td>
                    <td style={{ color: '#4ade80' }}>{batch.sent_count}</td>
                    <td style={{ color: '#f59e0b' }}>{batch.suppressed_count}</td>
                    <td style={{ color: '#f87171' }}>{batch.failed_count}</td>
                    <td><StatusBadge status={batch.status} /></td>
                    <td><span className={styles.sendDate}>{formatDate(batch.created_at)}</span></td>
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
        )}
      </div>

      {/* ── Opt-Outs ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Opt-Outs</span>
          <span className={styles.sectionNote}>{optOuts.length} org{optOuts.length !== 1 ? 's' : ''} unsubscribed</span>
        </div>
        {optOuts.length === 0 ? (
          <div className={styles.emptyState}>No opt-outs yet.</div>
        ) : (
          <table className={styles.table}>
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
                  <td>{org.orgName}</td>
                  <td>{org.ownerEmail ?? '—'}</td>
                  <td><span className={styles.sendDate}>{formatDate(org.optedOutAt)}</span></td>
                  <td>
                    <button
                      className={`${styles.btnAction} ${styles.btnResubscribe}`}
                      onClick={() => handleResubscribe(org.orgId)}
                      disabled={resubscribing === org.orgId}
                      title="Re-subscribe (only if org owner has explicitly requested)"
                    >
                      <RotateCcw size={10} />
                      {resubscribing === org.orgId ? ' …' : ' Re-subscribe'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
        <div className={styles.modalOverlay} onClick={() => !savingDate && setDateEditKey(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Planned send date</div>
              <button className={styles.modalClose} onClick={() => setDateEditKey(null)} aria-label="Close" disabled={savingDate}>
                <X size={14} />
              </button>
            </div>
            <div className={styles.confirmDialog}>
              <p className={styles.confirmBody} style={{ marginBottom: '0.75rem' }}>
                Set the planned send date for <strong>{dateEditKey}</strong>. This is a reminder of when to
                send — it appears in the &ldquo;upcoming&rdquo; and &ldquo;past due&rdquo; lists. It does{' '}
                <strong>not</strong> send automatically.
              </p>
              <input
                type="date"
                className={styles.dateInput}
                value={dateDraft}
                onChange={e => setDateDraft(e.target.value)}
                disabled={savingDate}
              />
              {dateError && <p className={styles.sendingNote} style={{ color: '#f87171' }}>{dateError}</p>}
              <div className={styles.confirmActions}>
                <button className={styles.btnConfirmSend} onClick={handleSaveDate} disabled={savingDate || !dateDraft}>
                  {savingDate ? 'Saving…' : 'Save date'}
                </button>
                <button className={styles.btnCancel} onClick={() => setDateEditKey(null)} disabled={savingDate}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
