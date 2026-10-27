'use client';
/**
 * The Reply window (Support console Stage 5, Part 7; drawings D3 and D5, failure wording G2). 520 wide, the console's own
 * confirm shape (the person record's "Send a reset link" is the model): the sentence first, in the lime-primary family
 * — Send reply is lime, never red (rule meeting S5-D1).
 *
 * ⚠ THERE IS NO "To" FIELD. The server reads the address from the account behind the feedback; the browser sends the
 * reply's own number, the words, the newest reply this page showed and "Send mine too" — never an address or a header.
 *
 * The reply's number is made when the window opens and kept for every retry: the mail service sends a number at most
 * once. After the first press the words are fixed (read-only), because a retry sends the same words, never edited ones.
 *
 * Every sentence the server gives (`REPLY_WORDS`, `NO_REPLY_WORDS`, `concurrentWords`) is shown as it came. Outcomes:
 *   sent       → the window closes and the page says so;
 *   failed     → the sentence, foot "Nothing was sent.", Cancel + Try again (same number);
 *   unknown    → an amber warning, foot "It will not send twice.", Close + Try again (same number);
 *   concurrent → their reply shown, Cancel (keeps your words) + Send mine too (a NEW number);
 *   too late / limit / no address / already sending → the sentence and Close only.
 */
import { useState } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import { consoleWhen } from '@/lib/console-dates';
import kit from '../../console.module.css';
import record from '../../record.module.css';
import styles from '../feedback.module.css';

export type ReplyWindowProps = {
  feedbackId: string;
  /** Who the window is titled for. */
  name: string;
  /** The server's address for them (shown, never sent). */
  to: string;
  /** "Re: {title}", built on the server. */
  subject: string;
  /** "FieldLogicHQ support · noreply@…" */
  fromLine: string;
  repliesGoTo: string;
  /** The signature's first name for THIS staff member; empty = "FieldLogicHQ support" alone. */
  signedName: string;
  signedFrom: string;
  /** Whether sending moves the item to Acknowledged (the sentence promises it only then). */
  moves: boolean;
  /** The newest reply this page showed (its created_at), or null. */
  latestSeenAt: string | null;
  maxChars: number;
};

type Phase = 'write' | 'failed' | 'unknown' | 'concurrent' | 'final';
type Theirs = { by: string; at: string; body: string };

const NO_ANSWER =
  'We could not tell whether that reached the mail service, so we do not know yet whether it went. Check the conversation, then try again: it sends the same words, and the mail service sends them at most once.';

export default function ReplyWindow({ props, onSent, onClose }: {
  props: ReplyWindowProps;
  onSent: (to: string, moved: boolean) => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  // The reply's own number: made once, when the window opens, and kept for every retry of these words.
  const [replyId, setReplyId] = useState(() => crypto.randomUUID());
  const [sendAnyway, setSendAnyway] = useState(false);
  const [seenAt, setSeenAt] = useState(props.latestSeenAt);
  const [phase, setPhase] = useState<Phase>('write');
  // The words are fixed from the first press until the server says nothing was started (concurrent / a bad request).
  const [fixed, setFixed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [theirs, setTheirs] = useState<Theirs | null>(null);
  const [finalFoot, setFinalFoot] = useState<string | null>(null);

  const trimmed = message.trim();
  const nearLimit = message.length >= props.maxChars - 500;

  async function send(opts: { id: string; anyway: boolean }) {
    if (busy || !trimmed) return;
    setBusy(true);
    setAnswer(null);
    setFixed(true);
    let res: Response | null = null;
    try {
      res = await fetch(`/api/platform-admin/feedback/${props.feedbackId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyId: opts.id,
          message,
          ...(seenAt ? { latestSeenAt: seenAt } : {}),
          ...(opts.anyway ? { sendAnyway: true } : {}),
        }),
      });
    } catch {
      res = null;
    }
    const data = res ? ((await res.json().catch(() => ({}))) as Record<string, unknown>) : {};
    setBusy(false);
    const sentence = typeof data.error === 'string' ? data.error : null;

    if (res?.ok && data.state === 'sent') {
      onSent(String(data.to ?? props.to), typeof data.moved === 'string' && data.moved.length > 0);
      return;
    }
    if (res && data.state === 'unknown') { setPhase('unknown'); setAnswer(sentence ?? NO_ANSWER); return; }
    if (res && data.state === 'failed') { setPhase('failed'); setAnswer(sentence); return; }
    if (res && data.state === 'concurrent') {
      const t = data.theirs as Partial<Theirs> | undefined;
      setFixed(false); // nothing was written: the words are still yours to change
      setTheirs({ by: t?.by ?? 'Someone', at: t?.at ?? '', body: t?.body ?? '' });
      setPhase('concurrent');
      setAnswer(sentence);
      return;
    }
    if (res && (data.state === 'too_late' || data.state === 'limit' || data.state === 'sending' || data.state === 'edited' || typeof data.reason === 'string')) {
      setPhase('final');
      setAnswer(sentence);
      setFinalFoot(data.state === 'sending' || data.state === 'edited' ? null : 'Nothing was sent.');
      return;
    }
    if (res && res.status === 400) { setFixed(false); setAnswer(sentence ?? 'That did not go through.'); return; }
    if (res && (res.status === 401 || res.status === 403 || res.status === 404)) {
      setPhase('final');
      setAnswer(sentence ?? 'That did not go through.');
      setFinalFoot('Nothing was sent.');
      return;
    }
    // No answer at all, or one we cannot read: we do not know. A retry under the same number is safe.
    setPhase('unknown');
    setAnswer(NO_ANSWER);
  }

  /** "Send mine too": a NEW reply number, and the server is told to skip the "someone replied" check once. */
  function sendMineToo() {
    const id = crypto.randomUUID();
    setReplyId(id);
    setSendAnyway(true);
    void send({ id, anyway: true });
  }

  /** Cancel in the concurrent state: back to the words, kept. Their reply has been read, so the next press may go. */
  function keepWriting() {
    if (theirs?.at) setSeenAt(theirs.at);
    setTheirs(null);
    setAnswer(null);
    setPhase('write');
  }

  const bad = phase === 'failed' || phase === 'final';
  const foot =
    phase === 'write' ? 'Sends at once.'
    : phase === 'failed' ? 'Nothing was sent.'
    : phase === 'unknown' ? 'It will not send twice.'
    : phase === 'concurrent' ? 'Nothing was sent.'
    : finalFoot;

  const sentence = (
    <div className={record.sentence}>
      This sends an email to <strong>{props.to}</strong>. <strong>It cannot be taken back.</strong>
      {props.moves ? ' The feedback moves to Acknowledged.' : ''}
    </div>
  );

  return (
    <KitDialog
      kind="form"
      title={`Reply to ${props.name}`}
      onClose={onClose}
      busy={busy}
      dirty={trimmed.length > 0 && (phase === 'write' || phase === 'failed' || phase === 'concurrent')}
      discardAsk="Close without sending? What you typed won't be kept."
      footerStart={foot ? <span className={record.footNote}>{foot}</span> : undefined}
      footer={(
        <>
          {phase === 'concurrent' ? (
            <button type="button" className="btn btn-secondary" onClick={keepWriting} disabled={busy}>Cancel</button>
          ) : (
            <DialogCancel className="btn btn-secondary">{phase === 'unknown' || phase === 'final' ? 'Close' : 'Cancel'}</DialogCancel>
          )}
          {phase === 'write' && (
            <button type="button" className="btn btn-primary" onClick={() => void send({ id: replyId, anyway: sendAnyway })} disabled={busy || !trimmed}>
              {busy ? 'Sending…' : 'Send reply'}
            </button>
          )}
          {(phase === 'failed' || phase === 'unknown') && (
            <button type="button" className="btn btn-primary" onClick={() => void send({ id: replyId, anyway: sendAnyway })} disabled={busy}>
              {busy ? 'Sending…' : 'Try again'}
            </button>
          )}
          {phase === 'concurrent' && (
            <button type="button" className="btn btn-primary" onClick={sendMineToo} disabled={busy || !trimmed}>
              {busy ? 'Sending…' : 'Send mine too'}
            </button>
          )}
        </>
      )}
    >
      <div className={record.windowBody}>
        {sentence}

        {answer && phase !== 'write' && (
          <div className={`${record.refuseLine}${bad ? ` ${record.refuseLineBad}` : ''}`} role="alert">
            {bad
              ? <XCircle size={16} className={record.refuseIcon} aria-hidden />
              : <AlertTriangle size={16} className={record.refuseIcon} aria-hidden />}
            <span>{answer}</span>
          </div>
        )}
        {phase === 'concurrent' && theirs && (
          <div className={styles.theirs}>
            <span className={styles.theirsHead}>{theirs.by}{theirs.at ? ` · ${consoleWhen(theirs.at)}` : ''}</span>
            <p className={styles.theirsBody}>{theirs.body}</p>
          </div>
        )}

        <dl className={styles.lines}>
          <dt>From</dt><dd>{props.fromLine}</dd>
          <dt>Replies go to</dt><dd>{props.repliesGoTo}</dd>
          <dt>Subject</dt><dd>{props.subject}</dd>
        </dl>

        <label className={kit.fieldGroup}>
          <span className={kit.label}>Message<span className={kit.req} aria-hidden>*</span></span>
          <textarea
            className={`${kit.textarea}${fixed && phase !== 'write' ? ` ${styles.messageFixed}` : ''}`}
            value={message}
            onChange={e => setMessage(e.target.value)}
            readOnly={fixed}
            maxLength={props.maxChars}
            required
            aria-required
            rows={6}
          />
          <span className={`${kit.hint} ${styles.countLine}`}>
            <span>
              Signed: {props.signedName ? `${props.signedName}, ` : ''}{props.signedFrom}. Plain text; their message is quoted below yours.
            </span>
            {nearLimit && (
              <span className={message.length >= props.maxChars ? styles.countNear : undefined}>
                {message.length.toLocaleString('en-CA')} of {props.maxChars.toLocaleString('en-CA')}
              </span>
            )}
          </span>
        </label>

        {phase === 'write' && answer && <p className={kit.fieldError} role="alert">{answer}</p>}
      </div>
    </KitDialog>
  );
}
