'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Copy, RefreshCw, Send, TriangleAlert, Users, XCircle } from 'lucide-react';
import type {
  RepTeamAnnouncement,
  RepTeamAnnouncementRecipientSummary,
} from '@/lib/rep-team-announcements';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import styles from './AnnouncementEditor.module.css';

type Props = {
  orgSlug: string;
  teamId: string;
};

type ApiResponse = {
  announcement?: RepTeamAnnouncement;
  announcements?: RepTeamAnnouncement[];
  recipientSummary?: RepTeamAnnouncementRecipientSummary;
  error?: string;
};

const EMPTY_SUMMARY: RepTeamAnnouncementRecipientSummary = {
  recipientCount: 0,
  rosterPlayerCount: 0,
  rosterContactCount: 0,
  skippedInvalidCount: 0,
};

function byNewest(a: RepTeamAnnouncement, b: RepTeamAnnouncement) {
  return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
}

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusLabel(announcement: RepTeamAnnouncement): string {
  if (announcement.status === 'partial') {
    return `${announcement.sentCount}/${announcement.recipientCount} sent`;
  }
  if (announcement.status === 'failed') return 'Failed';
  return `${announcement.recipientCount} sent`;
}

export default function RepAnnouncementEditor({ orgSlug, teamId }: Props) {
  const [announcements, setAnnouncements] = useState<RepTeamAnnouncement[]>([]);
  const [recipientSummary, setRecipientSummary] =
    useState<RepTeamAnnouncementRecipientSummary>(EMPTY_SUMMARY);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const confirm = useConfirm();
  // Synchronous re-entry guard for the send flow (see requestSend).
  const sendingRef = useRef(false);

  const base = `/api/coaches/${orgSlug}/teams/${teamId}/announcements`;
  const subjectReady = subject.trim().length > 0;
  const bodyReady = body.trim().length > 0;
  const hasRecipients = recipientSummary.recipientCount > 0;
  const missingEmailCount = Math.max(
    0,
    recipientSummary.rosterPlayerCount - recipientSummary.rosterContactCount,
  );
  const canSend = subjectReady && bodyReady && hasRecipients && !busy;

  const load = useCallback(async (silent: boolean) => {
    if (silent) setRefreshBusy(true); else setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(base, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !data.recipientSummary) throw new Error(data.error ?? 'Could not load announcements.');
      setRecipientSummary(data.recipientSummary);
      setAnnouncements([...(data.announcements ?? [])].sort(byNewest));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load announcements.');
    } finally {
      if (silent) setRefreshBusy(false); else setLoading(false);
    }
  }, [base]);

  useEffect(() => { void load(false); }, [load]);

  // Quietly re-count recipients whenever the coach returns to this tab — e.g. after adding a
  // guardian email on the Roster — so they never have to reach for a manual Refresh button.
  const recountRecipients = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (res.ok && data.recipientSummary) setRecipientSummary(data.recipientSummary);
    } catch { /* silent — a background recount never surfaces an error or clears a notice */ }
  }, [base]);

  useEffect(() => {
    function onFocus() { if (!busy) void recountRecipients(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [busy, recountRecipients]);

  async function requestSend() {
    // `busy` only flips inside doSend (after the confirm resolves), so the Send button stays
    // enabled while the confirm dialog is open. sendingRef is a synchronous guard so a fast
    // double-click can't open two confirms and fire two sends.
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true;
    try {
      const n = recipientSummary.recipientCount;
      const ok = await confirm({
        title: 'Send this announcement?',
        message: `This emails ${n} ${n === 1 ? 'family' : 'families'} right away — it can't be unsent.`,
        confirmText: 'Send now',
        cancelText: 'Keep editing',
      });
      if (ok) await doSend();
    } finally {
      sendingRef.current = false;
    }
  }

  // Prefill the compose form from a past announcement (a "reuse / duplicate" shortcut).
  function reuse(a: RepTeamAnnouncement) {
    setSubject(a.subject);
    setBody(a.body);
    setExpandedId(null);
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function doSend() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !data.announcement) throw new Error(data.error ?? 'Could not send the announcement.');

      setAnnouncements(prev => [data.announcement as RepTeamAnnouncement, ...prev].sort(byNewest).slice(0, 10));
      if (data.recipientSummary) setRecipientSummary(data.recipientSummary);
      if (data.announcement.status !== 'failed') {
        setSubject('');
        setBody('');
      }
      setNotice(data.announcement.status === 'sent'
        ? 'Announcement sent.'
        : `Announcement logged with ${data.announcement.failedCount} failed send attempt${data.announcement.failedCount === 1 ? '' : 's'}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the announcement.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className={styles.editor}><p className={styles.logNote}>Loading announcements…</p></div>;
  }

  return (
    <div className={styles.editor}>
      <UnsavedChangesGuard active={subjectReady || bodyReady} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      {hasRecipients && (
        <p className={styles.recipientBar}>
          <Users size={14} className={styles.recipientBarIcon} aria-hidden />
          <span>
            Sending to <strong>{recipientSummary.recipientCount}</strong>{' '}
            {recipientSummary.recipientCount === 1 ? 'family' : 'families'} with a guardian email on file.
          </span>
        </p>
      )}

      {hasRecipients && missingEmailCount > 0 && (
        <p className={styles.missingEmailWarn} role="status">
          <TriangleAlert size={15} className={styles.missingEmailWarnIcon} aria-hidden />
          <span>
            {missingEmailCount === 1
              ? '1 player has no guardian email on file'
              : `${missingEmailCount} players have no guardian email on file`}{' '}
            — add one on your Roster to include them.
          </span>
        </p>
      )}

      {!hasRecipients && (
        <div className={styles.recipientsWarn} role="status">
          <TriangleAlert size={16} className={styles.recipientsWarnIcon} aria-hidden />
          <span>No one to email yet. Add a guardian email to a player on your Roster, then refresh.</span>
          <button
            type="button"
            className={styles.recipientsWarnAction}
            onClick={() => load(true)}
            disabled={refreshBusy || busy}
          >
            <RefreshCw size={13} aria-hidden /> {refreshBusy ? 'Checking…' : 'Refresh contacts'}
          </button>
        </div>
      )}

      <div className={styles.form}>
        <input
          className={styles.input}
          placeholder="Subject — e.g. Game time changed"
          maxLength={160}
          value={subject}
          onChange={e => setSubject(e.target.value)}
          aria-label="Announcement subject"
        />
        <textarea
          className={styles.textarea}
          placeholder="Write your update to the team…"
          maxLength={4000}
          rows={5}
          value={body}
          onChange={e => setBody(e.target.value)}
          aria-label="Announcement message"
        />
        <div className={styles.formActions}>
          {!hasRecipients && (
            <span className={styles.formHint}>Add a guardian email on your Roster to send.</span>
          )}
          <button
            type="button"
            className={styles.sendBtn}
            onClick={requestSend}
            disabled={!canSend}
          >
            <Send size={15} aria-hidden /> {busy ? 'Sending...' : 'Send announcement'}
          </button>
        </div>
      </div>

      <div className={styles.logCard}>
        <div className={styles.blockHeader}>
          <h3 className={styles.blockTitle}>Recent announcements</h3>
          <span className={styles.blockMeta}>{announcements.length}</span>
        </div>

        {announcements.length === 0 ? (
          <p className={styles.logNote}>No announcements sent yet.</p>
        ) : (
          <ul className={styles.list}>
            {announcements.map(announcement => {
              const expanded = expandedId === announcement.id;
              return (
                <li key={announcement.id} className={styles.row}>
                  <span className={styles.statusIcon} data-status={announcement.status}>
                    {announcement.status === 'failed'
                      ? <XCircle size={16} aria-hidden />
                      : <CheckCircle2 size={16} aria-hidden />}
                  </span>
                  <div className={styles.rowMain}>
                    <button
                      type="button"
                      className={styles.rowHead}
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : announcement.id)}
                    >
                      <span className={styles.name}>{announcement.subject}</span>
                      <span className={styles.meta}>
                        {formatSentAt(announcement.sentAt)} · {statusLabel(announcement)}
                      </span>
                      <ChevronDown
                        size={15}
                        className={styles.rowChevron}
                        data-open={expanded ? 'true' : undefined}
                        aria-hidden
                      />
                    </button>
                    <span className={expanded ? styles.bodyFull : styles.preview}>{announcement.body}</span>
                    {expanded && (
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.reuseBtn} onClick={() => reuse(announcement)}>
                          <Copy size={13} aria-hidden /> Reuse
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
