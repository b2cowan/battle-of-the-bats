'use client';

import { useState, useCallback, useEffect, Fragment } from 'react';
import { Send, Eye, ChevronDown, ChevronRight, X, RotateCcw } from 'lucide-react';
import type { EmailBatch, OptOutOrg } from './page';
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
};

const SCHEDULED_EMAILS: ScheduledEmail[] = [
  {
    emailKey: 'founding_welcome',
    subject: 'Your founding season starts now — Tournament Plus is free through Dec 31',
    sendDate: 'At signup',
    audience: 'Each new founding org owner (transactional)',
    isTransactional: true,
    templateBuilt: true,
  },
  {
    emailKey: 'founding_checkin',
    subject: "How's your season going? Update from FieldLogicHQ",
    sendDate: '~Day 60 post-signup',
    audience: 'Founding orgs, signed up ≥ 60 days ago',
    isTransactional: false,
    templateBuilt: true,
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    scheduled: styles.badgeScheduled,
    pending: styles.badgePending,
    running: styles.badgeRunning,
    complete: styles.badgeComplete,
    sent: styles.badgeSent,
    failed: styles.badgeFailed,
  }[status] ?? styles.badgeNotBuilt;

  return <span className={`${styles.badge} ${cls}`}>{status}</span>;
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
  // For founding_welcome we render the actual HTML server-side by fetching from a
  // preview endpoint. For unbuilt templates we show a placeholder.
  // In this phase we just show the template structure since we'd need a server
  // roundtrip to render the full HTML. A full preview endpoint can be added in
  // a follow-up session.

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Email Preview — {email.emailKey}</div>
            <div className={styles.modalSubject}>{email.subject}</div>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {email.templateBuilt ? (
            <div className={styles.previewFrame}>
              <div dangerouslySetInnerHTML={{ __html: PREVIEW_MAP[email.emailKey] ?? FOUNDING_WELCOME_PREVIEW }} />
            </div>
          ) : (
            <div className={styles.notBuiltNotice}>
              <p style={{ margin: '0 0 0.5rem' }}>Template not yet built.</p>
              <p style={{ margin: 0, opacity: 0.6 }}>
                Build it in a follow-up session, then update TEMPLATE_REGISTRY in<br />
                <code>app/api/admin/email/send/route.ts</code>.
              </p>
            </div>
          )}
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
}: {
  initialBatches: EmailBatch[];
  initialOptOuts: OptOutOrg[];
  recipientCount: number;
  optOutCount: number;
  recipientCounts: Record<string, number>;
  adminEmail: string;
}) {
  const [batches, setBatches] = useState<EmailBatch[]>(initialBatches);
  const [optOuts, setOptOuts] = useState<OptOutOrg[]>(initialOptOuts);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<ScheduledEmail | null>(null);
  const [sendTarget, setSendTarget] = useState<ScheduledEmail | null>(null);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult>(null);
  const [resubscribing, setResubscribing] = useState<string | null>(null);

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
          <span className={styles.sectionNote}>All 10 founding season emails — trigger manually from here</span>
        </div>
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
            {SCHEDULED_EMAILS.map(email => {
              const sentBatch = getBatchForKey(email.emailKey);
              const status = sentBatch ? 'sent' : email.templateBuilt ? 'scheduled' : 'not built';
              const count = email.isTransactional ? null : (recipientCounts[email.emailKey] ?? recipientCount);

              return (
                <tr key={email.emailKey}>
                  <td><span className={styles.emailKey}>{email.emailKey}</span></td>
                  <td><span className={styles.subject} title={email.subject}>{email.subject}</span></td>
                  <td><span className={styles.sendDate}>{email.sendDate}</span></td>
                  <td><span className={styles.audience}>{email.audience}</span></td>
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
                          disabled={!email.templateBuilt || !!sentBatch}
                          title={
                            !email.templateBuilt ? 'Template not yet built' :
                            sentBatch ? 'Already sent' :
                            'Send now'
                          }
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

      {/* ── Sent History ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Sent History</span>
          <span className={styles.sectionNote}>Batch-level log — expand row for individual recipients</span>
        </div>
        {batches.length === 0 ? (
          <div className={styles.emptyState}>No email batches sent yet.</div>
        ) : (
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
        <PreviewModal email={previewEmail} onClose={() => setPreviewEmail(null)} />
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
    </div>
  );
}

// ── Inline preview HTML for founding_welcome ──────────────────────────────────
// This is a static preview — the real send generates HTML dynamically per org.

// ── Shared outer wrapper used by all preview constants ───────────────────────
const W = (content: string) => `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2.5rem 2rem;border:1px solid rgba(30,58,138,0.25);">
  <div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(30,58,138,0.2);">
    <span style="font-size:0.75rem;font-weight:900;color:#D9F99D;letter-spacing:0.16em;text-transform:uppercase;">FIELDLOGICHQ</span>
  </div>
  ${content}
</div>`;

const FOUNDING_CHECKIN_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">How's your season going?</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;">It's been <strong>8 weeks</strong> since <strong>Demo Org</strong> joined FieldLogicHQ.</p>
  <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Season so far</p>
    <p style="margin:0;line-height:1.9;color:rgba(241,245,249,0.8);">You've run <strong>2 tournaments</strong> — <strong>47 games played</strong>.<br>That's 47 schedule exports and score entries you didn't have to do in a spreadsheet.</p>
  </div>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Set up another tournament →</a>
  <p style="margin:1.5rem 0 0;line-height:1.7;color:rgba(241,245,249,0.8);">We're also curious: what's working, and what isn't? Reply and tell us.</p>
  <p style="margin:0.75rem 0 0;line-height:1.7;color:rgba(241,245,249,0.65);">Your founding season runs through December 31, 2026. Starting January 1, Tournament Plus is $39/month — or you can continue free on the Tournament plan.</p>
  <p style="margin:1.25rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

const FOUNDING_RENEWAL_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">Your founding season ends December 31 — here's what happens next.</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;">Your FieldLogicHQ founding season ends December 31, 2026.</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;color:rgba(241,245,249,0.8);">Starting January 1, Tournament Plus is $39/month. Here's what that means for <strong>Demo Org</strong>:</p>
  <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">What happens to Demo Org</p>
    <p style="margin:0 0 0.75rem;line-height:1.7;color:rgba(241,245,249,0.8);">Your <strong>1 active tournament</strong>, all registered teams, scores, and archives carry over automatically — nothing changes except the billing.</p>
    <p style="margin:0;line-height:1.7;color:rgba(241,245,249,0.8);">Your <strong>3 past tournaments</strong> stay in your archives regardless of which plan you're on.</p>
  </div>
  <p style="margin:0 0 1rem;line-height:1.7;">To continue on Tournament Plus starting January 1:</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Add a payment method — takes 2 minutes →</a>
  <p style="margin:1.5rem 0 0.5rem;line-height:1.7;color:rgba(241,245,249,0.8);">If $39/month isn't right, you can continue free on the Tournament plan: 1 active tournament, manual scheduling, no cost.</p>
  <a href="#" style="display:inline-block;color:#D9F99D;text-decoration:none;font-weight:700;font-size:0.85rem;padding:0.4rem 0;">See plan comparison →</a>
  <p style="margin:1.5rem 0 0;color:rgba(241,245,249,0.65);">Questions? Reply to this email.</p>
  <p style="margin:0.75rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

const FOUNDING_FINAL_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">2 weeks left in your founding season.</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;">Quick reminder: your founding season ends in 16 days, on December 31.</p>
  <p style="margin:0 0 1rem;line-height:1.7;color:rgba(241,245,249,0.8);">If you'd like to continue with Tournament Plus starting January 1 ($39/month), add a payment method now:</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Add payment method →</a>
  <p style="margin:1.5rem 0 0;line-height:1.7;color:rgba(241,245,249,0.8);">Either way, everything you've built on FieldLogicHQ stays with you.</p>
  <p style="margin:1.25rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

const SPOTLIGHT_CLUB_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">Before your September season starts — Club is free through December 31.</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;">Most clubs are planning their September season right now.<br>Tryouts. Rep team rosters. League registrations. Budget prep.</p>
  <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Club on FieldLogicHQ puts your entire organization in one place</p>
    <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);">
      <li>Tournaments: same tools you're already using on your founding season</li>
      <li>House League: registration, draft, schedule, standings, parent notifications — no manual emails</li>
      <li>Rep Teams: tryouts, roster, lineups, and team budget</li>
      <li>Accounting: org ledger, team invoicing, budget vs. actual</li>
    </ul>
  </div>
  <p style="margin:0 0 1.5rem;line-height:1.7;">Club is normally <strong>$179/month</strong>. As a founding organization, <strong>Club is free through December 31, 2026</strong>.</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Start on Club — free through December 31 →</a>
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

const SPOTLIGHT_LEAGUE_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">What running a house league actually looks like on FieldLogicHQ.</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;">You're running tournaments. But if <strong>Demo Org</strong> also runs a house league season — or if that's where you're headed — here's what that looks like.</p>
  <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">From opening registration to final standings</p>
    <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);">
      <li>Parents register players online. You set division limits; waitlists fill automatically.</li>
      <li>Draft day uses a live board — pick order, team builds, no spreadsheet.</li>
      <li>The schedule generates itself. Parents get automated game notifications without you sending a single email.</li>
      <li>Standings update the moment scores are entered.</li>
    </ul>
  </div>
  <p style="margin:0 0 1.5rem;line-height:1.7;">Available on League Plus (<strong>$89/month</strong>) and Club (<strong>$179/month</strong>). Both are <strong>free through December 31, 2026</strong>.</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Get set up on League Plus — free through December 31 →</a>
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

const SPOTLIGHT_COACHES_ORG_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">For the coaches on your teams — a workspace that's actually theirs.</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;color:rgba(241,245,249,0.8);">The coaches managing teams in your tournaments are tracking rosters in group texts, lineups in notes apps, and team fees in someone's head.</p>
  <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">The Coaches Portal gives them one place for all of it</p>
    <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);">
      <li>Full roster management with season history</li>
      <li>Lineup builder — plan your starting lineup, export to PDF</li>
      <li>Team budget and player dues tracking</li>
      <li>Document management: consent forms, medical notes, eligibility files</li>
    </ul>
  </div>
  <p style="margin:0 0 1.5rem;line-height:1.7;">Standalone at <strong>$29/month</strong>, or included in League Plus and Club plans.</p>
  <p style="margin:0 0 0.75rem;line-height:1.7;">Know a coach who needs this?</p>
  <a href="#" style="display:inline-block;color:#D9F99D;text-decoration:none;font-weight:700;font-size:0.85rem;padding:0.4rem 0;">Send them this link →</a>
  <p style="margin:1.25rem 0 0.75rem;line-height:1.7;">Or express your own interest:</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">I'm interested in the Coaches Portal →</a>
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

const SPOTLIGHT_COACHES_COACH_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">For the coaches on your teams — a workspace that's actually theirs.</h2>
  <p style="margin:0 0 1rem;">Hi Demo Coach,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;color:rgba(241,245,249,0.8);">You've been through a tournament on FieldLogicHQ. But managing your team between tournaments is still probably spread across your phone, email, and memory.</p>
  <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">The Coaches Portal is built for exactly that</p>
    <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);">
      <li>Your full roster, season over season</li>
      <li>Lineups you can plan, save, and export to PDF</li>
      <li>Team budget: dues in, expenses out, who owes what</li>
      <li>Documents in one place — consent, medical, eligibility</li>
    </ul>
  </div>
  <p style="margin:0 0 1.5rem;line-height:1.7;">No organization account required. Standalone at <strong>$29/month</strong>.</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">I want the Coaches Portal →</a>
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

const SPOTLIGHT_CLUB_LAST_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">Last reminder — Club is still free through December 31.</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;">A quick follow-up to our August note about Club.</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;color:rgba(241,245,249,0.8);">If <strong>Demo Org</strong> is running a house league, rep teams, or both alongside your tournaments — Club is free through December 31, 2026 as part of your founding season.</p>
  <p style="margin:0 0 1.5rem;line-height:1.7;">After the new year, it's <strong>$179/month</strong>. Starting now, it costs nothing.</p>
  <p style="margin:0 0 1.5rem;line-height:1.7;color:rgba(241,245,249,0.8);">The longer you wait to set it up, the deeper into the season you go on separate systems.</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Start on Club — free through December 31 →</a>
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

const SPOTLIGHT_FULL_PICTURE_PREVIEW = W(`
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;">Where FieldLogicHQ is headed — a note from the founding season.</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;">You're one of the first organizations running on FieldLogicHQ. Here's a brief update on where things are headed.</p>
  <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">What's live today</p>
    <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);">
      <li>Tournament and Tournament Plus: free for your founding season through December 31</li>
      <li>House League, Rep Teams, and Accounting: available on League and Club (also free through December 31)</li>
      <li>Tournament Coach Portal for coaches tracking their teams</li>
    </ul>
  </div>
  <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">What's coming in 2027</p>
    <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);">
      <li>Coaches Portal standalone — a full season workspace for one team ($29/month)</li>
      <li>Expanded public org site tools</li>
    </ul>
  </div>
  <p style="margin:0 0 0.75rem;line-height:1.7;">If you know another organizer, league admin, or coach who should be here:</p>
  <a href="#" style="display:inline-block;color:#D9F99D;text-decoration:none;font-weight:700;font-size:0.85rem;padding:0.4rem 0;">Share FieldLogicHQ →</a>
  <p style="margin:1.25rem 0 0.75rem;line-height:1.7;">And if you haven't added a payment method yet:</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Continue after December 31 — takes 2 minutes →</a>
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.65);">See you in 2027.</p>
  <p style="margin:0.5rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
`);

// Map emailKey → preview HTML
const PREVIEW_MAP: Record<string, string> = {
  founding_checkin: FOUNDING_CHECKIN_PREVIEW,
  founding_renewal: FOUNDING_RENEWAL_PREVIEW,
  founding_final: FOUNDING_FINAL_PREVIEW,
  spotlight_club: SPOTLIGHT_CLUB_PREVIEW,
  spotlight_league: SPOTLIGHT_LEAGUE_PREVIEW,
  spotlight_coaches_org: SPOTLIGHT_COACHES_ORG_PREVIEW,
  spotlight_coaches_coach: SPOTLIGHT_COACHES_COACH_PREVIEW,
  spotlight_club_last: SPOTLIGHT_CLUB_LAST_PREVIEW,
  spotlight_full_picture: SPOTLIGHT_FULL_PICTURE_PREVIEW,
};

// ── Inline preview HTML for founding_welcome ──────────────────────────────────
// This is a static preview — the real send generates HTML dynamically per org.

const FOUNDING_WELCOME_PREVIEW = `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2.5rem 2rem;border:1px solid rgba(30,58,138,0.25);">
  <div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(30,58,138,0.2);">
    <span style="font-size:0.75rem;font-weight:900;color:#D9F99D;letter-spacing:0.16em;text-transform:uppercase;">FIELDLOGICHQ</span>
  </div>
  <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;letter-spacing:-0.01em;">Your founding season starts now.</h2>
  <p style="margin:0 0 1rem;">Hi Demo User,</p>
  <p style="margin:0 0 1.25rem;line-height:1.7;">You're in. <strong>Demo Org</strong> is set up on FieldLogicHQ and running <strong>Tournament Plus free through December 31, 2026</strong> as a founding organization.</p>
  <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
    <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Tournament Plus ($39/month) gives you</p>
    <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);">
      <li>Auto-scheduling across any number of fields and time slots</li>
      <li>Single and double-elimination brackets</li>
      <li>Team communications and announcements</li>
      <li>Tournament archives — every past event preserved</li>
      <li>Up to 3 active tournaments at once</li>
    </ul>
  </div>
  <p style="margin:0 0 1.5rem;line-height:1.7;color:rgba(241,245,249,0.8);">All of it, <strong>free until January 1, 2027</strong>. No credit card required.</p>
  <a href="#" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Set up your first tournament →</a>
  <p style="margin:1.75rem 0 0;line-height:1.7;color:rgba(241,245,249,0.65);">If anything doesn't work the way you'd expect, reply to this email. We read everything.</p>
  <p style="margin:0.75rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>
  <div style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid rgba(217,249,157,0.1);">
    <p style="margin:0;color:rgba(241,245,249,0.3);font-size:0.72rem;line-height:1.55;">
      You're receiving this because you signed up for FieldLogicHQ.&nbsp;
      <a href="#" style="color:rgba(217,249,157,0.5);text-decoration:underline;">Unsubscribe</a>
      &nbsp;·&nbsp; FieldLogicHQ · Canada
    </p>
  </div>
</div>`;
