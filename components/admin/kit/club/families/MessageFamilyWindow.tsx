'use client';
/**
 * MESSAGE THIS FAMILY (Club Tier Stage 5a, P4 — Asks 9, 19; hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5). The one club
 * send window (the 2026-10-11 ruling — `../SendParts`): its head names the family and the job; what sending does in one
 * statement; To, guardian by guardian, an opted-out one named as not receiving it; "Last messaged … by …"; Subject and
 * Message; See the email (the family envelope, as the guardian will receive it); Cancel and the lime that counts who it
 * reaches. A message is a create, so it asks: Send.
 *
 * The server decides everything on the press (reach, the three-a-day cap, the claim that refuses a double send). A send
 * that lost a race — another tab spent the third, or the family opted out since the window opened — keeps the message
 * typed: Send goes and the reason stands in its place, amber, the count first (the 10-12 ruling), so nothing tempts a
 * second press. × asks first only when something is typed.
 *
 * ⚠ The words are /marketing's (lib/families-words.ts — drafts as drawn).
 */
import { useCallback, useEffect, useState } from 'react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit, useLatestRead } from '../RepKit';
import { Statement } from '../schedules/ScheduleParts';
import { MailView, SampleBand, SamplePlatformLine, SendDoor, SendRow, SendRows, SendStanding, sendEnvelope, useSendLevel } from '../SendParts';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import LoadingState from '@/components/shared/LoadingState';
import { FAMILY_MESSAGE_WORDS as W, SEND_VIEW_WORDS as VW } from '@/lib/families-words';
import { familyEnvelopeFooterWords } from '@/lib/family-mail-footer';
import { familySenderName, type ClubEmailFacts } from '@/lib/email-club-identity';

interface Read {
  familyName: string;
  recipients: { name: string; email: string; optedOut: boolean }[];
  state: { lastMessaged: { at: string; by: string | null } | null; capped: boolean; nextAt: string | null };
  orgName: string;
  /** The club's face and the reply line the email will carry (S3b). */
  club?: ClubEmailFacts | null;
  replyLine?: string | null;
  reason: string;
}

export default function MessageFamilyWindow({ q, personId, familyName, raised = false, onClose, onSent }: {
  /** `orgSlug=…` */
  q: string;
  personId: string;
  familyName: string;
  /** Opened from the family's record window (Stage 5b): a form over a record stands one layer above it (KitDialog `raised`). */
  raised?: boolean;
  onClose: () => void;
  /** The send went: the page says so and re-reads (the door may now be spent). */
  onSent: (text: string) => void;
}) {
  // org-slug-ok: `q` IS the org ("orgSlug=…", passed by the family page — the same shape as the send windows' `q`).
  const url = `/api/admin/families/${encodeURIComponent(personId)}/message?${q}`;
  const [read, setRead] = useState<Read | null>(null);
  const [failed, setFailed] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [standing, setStanding] = useState<string | null>(null);
  const lv = useSendLevel(VW.backToMessage);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<Read>(url).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setRead(r.data);
  }, [url, beginRead]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const reach = read ? read.recipients.filter(r => !r.optedOut).length : 0;
  /** With something typed, ×, Cancel, Escape and a phone's Back ask first, in the foot (the one window's `dirty`, One
   *  Window Stage 2: this window's own ask, now everyone's); while it asks, the same key again is Keep writing. */
  const typed = subject.trim() !== '' || message.trim() !== '';

  async function send() {
    if (busy || !read || held) return;
    if (!subject.trim()) { setError(W.needSubject); return; }
    if (!message.trim()) { setError(W.needMessage); return; }
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ sent?: number; recipients?: number; code?: string; nextAt?: string | null; error?: string }>(
        url, jsonInit('POST', { subject, body: message }));
      if (r.ok) { onSent(W.sent(r.data.sent ?? 0, r.data.recipients ?? reach)); return; }
      if (r.data?.code === 'cap') setStanding(W.capRace(r.data.nextAt ?? null));
      else if (r.data?.code === 'opted_out') setStanding(W.optedOutRace);
      else setError(refusalText(r.data, W.failed));
    } catch {
      // No answer: it may have gone. Re-read "Last messaged" and say so, rather than inviting a second press.
      setError(W.unknown);
      void load();
    } finally {
      setBusy(false);
    }
  }

  const footer = read ? familyEnvelopeFooterWords(read.orgName, read.reason) : null;
  const last = read?.state.lastMessaged ?? null;
  // A standing reason from the read itself (the family opted out, or today's three went, since the page loaded): the
  // lime is absent and the reason stands in its place, as for a send that lost a race.
  const held = standing ?? (read && reach === 0 ? W.optedOutRace : read?.state.capped ? W.capRace(read.state.nextAt) : null);

  const showMail = lv.level === 'email' && !!read && !!footer;

  return (
    <KitDialog
      kind="form"
      raised={raised}
      {...(showMail ? lv.dialog : {})}
      eyebrow={familyName}
      title={W.title}
      onClose={onClose}
      busy={busy}
      dirty={typed}
      discardAsk={W.discardAsk}
      footerStart={held ? <SendStanding>{held}</SendStanding> : undefined}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          {!held && (
            <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy || !read}>
              {busy ? W.sending : read ? W.send(reach) : W.title}
            </button>
          )}
        </>
      )}
    >
      <FormError>{error}</FormError>
      {failed && !read ? (
        <p className={repKit.formError}>{W.previewFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{W.tryAgain}</button></p>
      ) : !read ? (
        <LoadingState inline label="Loading this family…" />
      ) : showMail ? (
        <MailView from={familySenderName(read.orgName)} subject={subject.trim() || W.subject}
          to={read.recipients.filter(r => !r.optedOut).map(r => r.name).join(', ')}>
          {read.club ? <SampleBand club={read.club} /> : <span className={sendEnvelope.kicker}>{read.orgName}</span>}
          <p className={sendEnvelope.body}>{message.trim() || W.message}</p>
          <p className={sendEnvelope.foot}>{footer!.sentBy}<br />{read.replyLine && <>{read.replyLine}<br /></>}<u>{footer!.unsubscribe}</u></p>
          {read.club && <SamplePlatformLine clubName={read.club.name} />}
        </MailView>
      ) : (
        <>
          <Statement lead={W.statement(read.orgName)} />
          <p className={repKit.factsLabel}>{W.to}</p>
          <SendRows>
            {read.recipients.map(r => (
              <SendRow key={r.email || r.name} title={r.name} off={r.optedOut}
                sub={r.optedOut ? (r.email ? `${r.email} · ${W.optedOutGuardian}` : W.noAddress) : r.email} />
            ))}
          </SendRows>
          <p className={ck.hint}>
            {last ? `${W.lastMessaged} ${W.lastMessagedValue(last.at, last.by)}.` : `${W.neverMessaged}.`}
          </p>
          <label className={ck.field} htmlFor="family-message-subject" style={{ marginTop: '0.9rem' }}>
            <span className={ck.label}>{W.subject}<span className={ck.required} aria-hidden>*</span></span>
            <input id="family-message-subject" className={ck.input} value={subject} maxLength={200}
              onChange={e => { setSubject(e.target.value); setError(''); }} aria-required data-autofocus="" />
          </label>
          <label className={ck.field} htmlFor="family-message-body">
            <span className={ck.label}>{W.message}<span className={ck.required} aria-hidden>*</span></span>
            <textarea id="family-message-body" className={ck.textarea} value={message} maxLength={5000} rows={7}
              onChange={e => { setMessage(e.target.value); setError(''); }} aria-required />
          </label>
          {footer && <SendDoor onOpen={() => lv.open('email')}>{W.seeEmail}</SendDoor>}
        </>
      )}
    </KitDialog>
  );
}
