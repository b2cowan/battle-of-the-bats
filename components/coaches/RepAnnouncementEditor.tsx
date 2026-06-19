'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Send, TriangleAlert, Users, XCircle } from 'lucide-react';
import type {
  RepTeamAnnouncement,
  RepTeamAnnouncementRecipientSummary,
} from '@/lib/rep-team-announcements';
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

  async function sendAnnouncement() {
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
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.summary} aria-label="Announcement recipients">
        <div className={styles.summaryItem}>
          <span>On roster</span>
          <strong>{recipientSummary.rosterPlayerCount}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Recipients</span>
          <strong>{recipientSummary.recipientCount}</strong>
        </div>
      </div>

      {hasRecipients && (
        <p className={styles.recipientNote}>
          <Users size={13} className={styles.recipientNoteIcon} aria-hidden />
          <span>
            Each active player with a guardian email gets this —{' '}
            {recipientSummary.recipientCount === 1
              ? '1 person'
              : `${recipientSummary.recipientCount} people`}{' '}
            will receive it.
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
          {hasRecipients && (
            <button
              type="button"
              className={styles.refreshGhostBtn}
              onClick={() => load(true)}
              disabled={refreshBusy || busy}
            >
              <RefreshCw size={14} aria-hidden /> {refreshBusy ? 'Checking...' : 'Refresh'}
            </button>
          )}
          <button
            type="button"
            className={styles.sendBtn}
            onClick={sendAnnouncement}
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
            {announcements.map(announcement => (
              <li key={announcement.id} className={styles.row}>
                <span className={styles.statusIcon} data-status={announcement.status}>
                  {announcement.status === 'failed'
                    ? <XCircle size={16} aria-hidden />
                    : <CheckCircle2 size={16} aria-hidden />}
                </span>
                <div className={styles.rowMain}>
                  <span className={styles.name}>{announcement.subject}</span>
                  <span className={styles.meta}>
                    {formatSentAt(announcement.sentAt)} - {statusLabel(announcement)}
                  </span>
                  <span className={styles.preview}>{announcement.body}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
