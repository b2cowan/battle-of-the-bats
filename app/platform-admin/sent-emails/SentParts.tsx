'use client';
/**
 * The parts a person's Emails tab and Health > Sent emails share (Support console Stage 5, drawing E): the "What
 * happened" cell, the email's window (E4, 640 wide), and the person's Emails tab itself (E1, E6).
 *
 * Nothing here ever holds a subject, a body or a link: there are none (T13). A row is a fixed kind label, the address, the
 * club, times and the mail service's word. The window asks the server for one email by its id; the address is never put
 * in a web address.
 */
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import { consoleDate, consoleWhen } from '@/lib/console-dates';
import type { SentEmail } from '@/lib/sent-log';
import { timelineLines, whatHappenedTime, type SentWindowEmail } from '@/lib/sent-log-view';
import {
  EMAIL_WINDOW_FOOT, NO_EMAILS_FOR_PERSON, SENT_EMAIL_FAILED, SENT_LOG_FAILED, SENT_LOG_FOOT, SENT_STATES, listFlag, recordingStartedLine,
  whatToDo, windowFlag, type SentTone,
} from '@/lib/sent-log-words';
import kit from '../console.module.css';
import styles from './sent-emails.module.css';

const TONE_CHIP: Record<SentTone, string> = { plain: kit.chipQuiet, ok: kit.chipOk, warn: kit.chipWarn, bad: kit.chipBad };

/** "Delivered 9:50 a.m." - the state word as a chip, its time beside it, and a red line under Bounced and Not sent. */
export function SentWhat({ row, flag = true }: { row: Pick<SentEmail, 'state' | 'stateAt' | 'bounceReason' | 'wasDelayed'>; flag?: boolean }) {
  const def = SENT_STATES[row.state];
  const reason = flag ? listFlag(row.state, row.bounceReason) : null;
  return (
    <>
      <span className={styles.what}>
        <span className={`${kit.chip} ${TONE_CHIP[def.tone]}`} title={def.meaning}>{def.word}</span>
        <span className={styles.whatTime}>{whatHappenedTime(row)}</span>
      </span>
      {reason && <span className={styles.flag}>{reason}</span>}
    </>
  );
}

type WindowAnswer = { email: SentWindowEmail; noAccount: boolean; askedBy: { name: string; club: string | null } | null };

/** The email's window. `from` says where it was opened: Sent emails writes a trail row on the server, a person's tab does not. */
export function SentEmailWindow({ id, from, onClose }: { id: string; from: 'log' | 'person'; onClose: () => void }) {
  const [answer, setAnswer] = useState<WindowAnswer | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/platform-admin/sent-emails/${encodeURIComponent(id)}?from=${from}`, { cache: 'no-store', signal: controller.signal });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.email) { setFailed(typeof body?.error === 'string' ? body.error : SENT_EMAIL_FAILED); return; }
        setAnswer(body as WindowAnswer);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setFailed(SENT_EMAIL_FAILED);
      }
    })();
    return () => controller.abort();
  }, [id, from]);

  const email = answer?.email;
  const flag = email ? windowFlag(email.state, email.bounceReason) : null;
  const todo = email ? whatToDo(email.state, email.bounceReason) : null;

  return (
    <KitDialog
      kind="form"
      size="medium"
      record
      title={email ? `${email.label} · ${consoleWhen(email.sentAt)}` : 'Email'}
      onClose={onClose}
      footerStart={<span className={styles.winFoot}>{EMAIL_WINDOW_FOOT}</span>}
      footer={<DialogCancel className="btn btn-secondary">Close</DialogCancel>}
    >
      <div className={styles.winBody}>
        {failed && <p className={`${kit.notice} ${kit.noticeBad}`} role="alert">{failed}</p>}
        {!failed && !answer && <p className={kit.caption}>Reading this email…</p>}
        {answer && email && (
          <>
            {flag && <p className={`${kit.notice} ${kit.noticeBad}`}>{flag}</p>}
            <dl className={styles.facts}>
              <dt>To</dt>
              <dd>{email.to}{answer.noAccount ? ' (no account)' : ''}</dd>
              <dt>Club</dt>
              <dd>{email.orgName ?? 'None'}</dd>
              {answer.askedBy && (
                <>
                  <dt>Asked for by</dt>
                  <dd>{answer.askedBy.name}{answer.askedBy.club ? `, ${answer.askedBy.club}` : ''}</dd>
                </>
              )}
              <dt>Email</dt>
              <dd>{email.label}</dd>
              <dt>Mail service number</dt>
              <dd>{email.resendId ? <code className={kit.code}>{email.resendId}</code> : 'Not given'}</dd>
            </dl>
            <div>
              <div className={kit.eye}>What happened</div>
              <ol className={styles.timeline}>
                {timelineLines(email).map(line => (
                  <li key={line.key}>
                    <span className={styles.tTime}>{line.time}</span>
                    <span>{line.word && <><strong>{line.word}</strong>{' '}</>}{line.text}</span>
                  </li>
                ))}
              </ol>
            </div>
            {todo && <div className={kit.callout}><span><strong>What to do:</strong> {todo}</span></div>}
          </>
        )}
      </div>
    </KitDialog>
  );
}

export type PersonEmails = { rows: SentEmail[]; total: number; startedAt: string | null; failed?: boolean };

/** A person's Emails tab (E1): newest first, a row opens the window; the empty state is E6. */
export function PersonEmailsTab({ emails }: { emails: PersonEmails }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { rows, total } = emails;

  // A list that could not be read is an error, never "No emails recorded".
  if (emails.failed) return <div className={`${kit.notice} ${kit.noticeBad}`} role="alert">{SENT_LOG_FAILED}</div>;

  if (total === 0) {
    return (
      <div className={kit.card}>
        <div className={styles.sectionHead}>Emails · 0</div>
        <div className={kit.empty}>
          <strong className={styles.emptyBold}>{NO_EMAILS_FOR_PERSON}</strong>
          <span className={styles.emptyHint}>{recordingStartedLine(emails.startedAt ? consoleDate(emails.startedAt) : null)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={kit.card}>
      <div className="table-cards">
        <table className={kit.comfortable}>
          <thead>
            <tr><th>Sent</th><th>Email</th><th>Club</th><th>What happened</th><th aria-label="Open" /></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className={kit.clickableRow} onClick={() => setOpenId(r.id)}>
                <td className={`${styles.when} table-cards-title`}>{consoleWhen(r.sentAt)}</td>
                <td data-label="Email">
                  <button type="button" className={styles.labelButton} onClick={e => { e.stopPropagation(); setOpenId(r.id); }}>{r.label}</button>
                </td>
                <td data-label="Club">{r.orgName ?? <span className={kit.muted}>None</span>}</td>
                <td data-label="What happened"><SentWhat row={r} /></td>
                <td className={kit.rowDoor} aria-hidden><ChevronRight size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > rows.length && <div className={styles.pager}><span className={kit.countQuiet}>Showing the newest {rows.length} of {total}</span></div>}
      <div className={kit.foot}><span className={kit.caption}>{SENT_LOG_FOOT}</span></div>
      {openId && <SentEmailWindow key={openId} id={openId} from="person" onClose={() => setOpenId(null)} />}
    </div>
  );
}
