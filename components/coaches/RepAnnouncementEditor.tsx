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
  /**
   * Whether THIS coach can add the guardian emails the recipient list is built from. Roster write
   * is head-coach-only in V1, so an assistant granted "send announcements" would otherwise be told
   * to go fix a roster they can only read. Fails OPEN (assume they can) — the roster page enforces.
   */
  canEditRoster?: boolean;
  /**
   * A draft the coach arrived with, written for them elsewhere (Chunk D 3.1 — the postgame
   * draft on the schedule). Seeds the compose box ONCE on mount and is never re-applied, so a
   * coach who edits the wording and navigates within the screen does not have their words
   * silently replaced. It is a starting point, not a value: nothing sends until they press Send.
   */
  initialDraft?: { subject: string; body: string } | null;
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
  optedOutCount: 0,
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

export default function RepAnnouncementEditor({ orgSlug, teamId, canEditRoster = true, initialDraft = null }: Props) {
  const [announcements, setAnnouncements] = useState<RepTeamAnnouncement[]>([]);
  const [recipientSummary, setRecipientSummary] =
    useState<RepTeamAnnouncementRecipientSummary>(EMPTY_SUMMARY);
  // Lazy initialisers, not an effect: the draft is present on the very first paint, so the
  // coach never sees an empty box flash and fill itself in.
  const [subject, setSubject] = useState(() => initialDraft?.subject ?? '');
  const [body, setBody] = useState(() => initialDraft?.body ?? '');
  // Real state, not a captured constant: the note below describes what is IN the box, and two
  // existing flows replace those contents — reusing a past announcement, and a successful send
  // (which clears them). A note still claiming "we drafted this from the score you just saved"
  // over someone else's old announcement, or over an empty box, is the same dishonesty the
  // note exists to prevent, pointed the other way.
  const [draftSeeded, setDraftSeeded] = useState(() => !!initialDraft);
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
    setDraftSeeded(false); // these are a past announcement's words now, not the postgame draft
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
        setDraftSeeded(false); // the box is empty now — nothing left for the note to describe
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
            {recipientSummary.optedOutCount > 0 && (
              /* A count, never the addresses — the coach sees their real reach without
                 learning which family opted out. */
              <> {recipientSummary.optedOutCount === 1
                ? '1 family has unsubscribed and will not receive it.'
                : `${recipientSummary.optedOutCount} families have unsubscribed and will not receive it.`}</>
            )}
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
            {canEditRoster
              ? '— add one on your Roster to include them.'
              : '— ask your head coach to add one on the roster to include them.'}
          </span>
        </p>
      )}

      {!hasRecipients && (
        <div className={styles.recipientsWarn} role="status">
          <TriangleAlert size={16} className={styles.recipientsWarnIcon} aria-hidden />
          <span>
            No one to email yet — announcements go to the guardian emails on your roster.{' '}
            {canEditRoster
              ? 'Add one to a player on your Roster, then refresh.'
              : 'Ask your head coach to add guardian emails to the roster, then refresh.'}
          </span>
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
        {/* Chunk D 3.1 — the coach arrived from a saved score with words already in the box.
            Saying so is not decoration: an unexplained pre-filled email reads as something the
            product already sent, which is the exact opposite of the no-auto-send guarantee. */}
        {draftSeeded && (
          <p className={styles.draftNote}>
            We drafted this from the score you just saved. Nothing is sent until you press
            Send — change any of it first.
          </p>
        )}
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
            <span className={styles.formHint}>
              {canEditRoster
                ? 'Add a guardian email on your Roster to send.'
                : 'Needs a guardian email on the roster before this can send.'}
            </span>
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
          <p className={styles.logNote}>
            No announcements sent yet. Every one you send is kept here with who received it and
            whether it landed — so you can prove the rain-out notice went out, and reuse the wording
            next time by copying it.
          </p>
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
