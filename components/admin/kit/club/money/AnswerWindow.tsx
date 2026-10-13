'use client';
/**
 * ANSWER — A HAND-BACK THAT ASKS FOR MONEY BACK (Club Tier Stage 11d, part A — hub K4MPu4ni53Ct7yrDcmWJd9 → Stage 11d,
 * specimen 4; Asks 3, 5, 6; the /design review's D2, D6).
 *
 * One window (a form, 640), the same from every door — Payment requests now, the schedule's page in part B, the bell:
 *   the facts — the Sundays still to come (Ask 7: one that started has left it), who asked and when, the figure and how
 *               it was worked out ("4 Sundays at $108.00 each, what the club billed for them"), the team's bill (billed ·
 *               paid · still owed, and which payments);
 *   ONE statement of what Accept does, exactly one of three (Ask 5; D2: "Accept opens …", the owner's "opening the time
 *               slot") — off what the team still owes, its latest payment first; or the club owes it the figure; or both;
 *   the quiet line — what the open time costs the club (the reason a club might decline, said before it answers);
 *   the foot — its sentence at the LEFT ("15U AA's coaches are told either way." — 2026-10-12), Decline… · Accept (the
 *               window's one lime) at the right. A member who can read it without the club's Accounting reads it with
 *               Close only (Ask 4).
 * Decline… opens its own question: an optional reason the coach reads; Keep it waiting · Decline (not red — nothing is
 * destroyed; the team keeps its Sundays and is told).
 */
import { useCallback, useEffect, useState } from 'react';
import KitDialog from '../KitDialog';
import { repKit } from '../RepKit';
import { Statement } from '../schedules/ScheduleParts';
import { Facts, FormError, isStale, jsonInit, moneyFetch, moneyKit, refusalText } from './MoneyKit';
import { HAND_BACK_WORDS as H, acceptStatement, namePractices, shortDay, type PracticesNamed } from '@/lib/club-hand-back-words';
import type { AnswerView } from '@/lib/club-hand-back';
import { formatTimeRange, joinWithAnd } from '@/lib/utils';
import { formatShortWeekdayDate, utcToZonedInputs } from '@/lib/timezone';
import ck from '../ClubKit.module.css';
import LoadingState from '@/components/shared/LoadingState';

/** The Answer window's read (GET /api/admin/accounting/hand-backs/[id]) — the server's own shape. */
type AnswerRead = AnswerView;

/** Someone else answered it, the coach withdrew it, or it lapsed or went stale since the window opened: read it again,
 *  so the window shows where it stands (Close only) instead of an Accept that keeps refusing (/review 2026-10-13). */
const RE_READ = new Set(['answered', 'lapsed', 'stale', 'year_closed', 'not_found']);
const codeOf = (data: unknown) => (data as { code?: string } | null)?.code ?? '';

/** "Mar 7, 14, 21 and 28 · 9:30–11:00 a.m. · Field 1" — one line when every Sunday shares its time and place. */
function sundaysLine(sundays: AnswerRead['sundays']): string {
  if (!sundays.length) return '—';
  const clock = (s: AnswerRead['sundays'][number]) => formatTimeRange(utcToZonedInputs(s.startsAt).time, utcToZonedInputs(s.endsAt).time);
  const days: string[] = [];
  let month = '';
  for (const s of sundays) {
    const [m, d] = shortDay(s.day).split(' ');
    days.push(m === month ? d : `${m} ${d}`);
    month = m;
  }
  const one = new Set(sundays.map(s => `${clock(s)}|${s.place}`)).size === 1;
  return one ? [joinWithAnd(days), clock(sundays[0]), sundays[0].place].filter(Boolean).join(' · ')
    : sundays.map(s => [shortDay(s.day), clock(s), s.place].filter(Boolean).join(' · ')).join('; ');
}

export default function AnswerWindow({ q, handBackId, onClose, onDone }: {
  q: string;
  handBackId: string;
  onClose: () => void;
  /** Answered: the sentence the page says once, and the lists re-read. */
  onDone: (text: string) => void;
}) {
  const url = `/api/admin/accounting/hand-backs/${encodeURIComponent(handBackId)}?${q}`;
  const [read, setRead] = useState<AnswerRead | null>(null);
  const [failed, setFailed] = useState('');
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await moneyFetch<{ ask: AnswerRead }>(url).catch(() => null);
    if (!r?.ok) { setFailed(refusalText(r?.data, H.refuse.notFound)); return; }
    setFailed('');
    setRead(r.data.ask);
  }, [url]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  async function accept() {
    if (busy || !read) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ notice: string }>(url, jsonInit('PATCH', { action: 'accept' }));
      if (!r.ok) { setError(refusalText(r.data, H.acceptFailed)); if (isStale(r.status, r.data) || RE_READ.has(codeOf(r.data))) void load(); return; }
      onDone(r.data.notice);
    } catch {
      setError(H.acceptFailed);
    } finally {
      setBusy(false);
    }
  }

  if (declining && read) {
    return <DeclineAskWindow url={url} read={read} what={namePractices(Math.max(1, read.count), read.weekday)} onClose={() => setDeclining(false)} onDone={onDone}
      onStale={text => { setDeclining(false); setError(text); void load(); }} />;
  }

  const what = read ? namePractices(Math.max(1, read.count), read.weekday) : null;
  const statement = read && what ? acceptStatement({ what, teamName: read.teamName, ...read.settle }) : null;
  const refusal = read?.refusal?.text ?? null;
  const answerable = !!read && read.canAnswer && !refusal;

  return (
    <KitDialog
      kind="form"
      eyebrow={read ? H.answerEyebrow(read.scheduleName, read.askedAt.slice(0, 10)) : undefined}
      title={read ? H.answerTitle(read.teamName, Math.max(1, read.count), read.weekday) : H.answer}
      onClose={onClose}
      busy={busy}
      // A window's foot: its sentence at the LEFT, the buttons at the right (2026-10-12).
      footerStart={read && read.state === 'waiting' ? <span className={repKit.footNote}>{H.answerFoot(read.teamName)}</span> : undefined}
      footer={answerable ? (
        <>
          <button type="button" className="btn btn-outline" onClick={() => setDeclining(true)} disabled={busy}>{H.declineDoor}</button>
          <button type="button" className="btn btn-lime" onClick={() => void accept()} disabled={busy}>{busy ? H.accepting : H.accept}</button>
        </>
      ) : <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>}
    >
      <FormError>{error}</FormError>
      {failed && !read ? <p className={repKit.formError}>{failed}</p>
        : !read ? <LoadingState inline label="Loading the hand-back…" />
        : (
          <>
            <Facts rows={[
              [H.factSundays(read.weekday), sundaysLine(read.sundays)],
              [H.factAskedBy, <>{read.askedBy.name ?? 'A coach'}{read.askedBy.headCoach ? ', head coach' : ''} <small className={repKit.cellSub}>{formatShortWeekdayDate(read.askedAt.slice(0, 10))}</small></>],
              [H.factAsksFor, <>{H.asksFor(read.cents)} <small className={repKit.cellSub}>{H.asksForHow({ count: read.count, weekday: read.weekday, eachCents: read.eachCents })}</small></>],
              [H.factBill(read.teamName), H.billLine({ ...read.bill })],
            ]} />
            {read.state === 'waiting' && statement && !refusal && <Statement lead={statement.lead} rest={statement.rest} />}
            {refusal && <p className={repKit.formError}>{refusal}</p>}
            {read.state === 'waiting' && !refusal && read.cents > 0 && (
              <p className={moneyKit.who}>{what && H.quietLine({ what, cents: read.cents, lineName: read.lineName })}</p>
            )}
            {read.state === 'waiting' && !read.canAnswer && <p className={ck.hint}>{H.answeredBySomeoneElse}</p>}
            {read.state === 'declined' && read.closed?.reason && <p className={moneyKit.who}>“{read.closed.reason}”</p>}
            {read.state === 'accepted' && read.closed && (
              <p className={moneyKit.who}>
                {[read.closed.creditedCents ? H.creditedPartOf(read.closed.creditedCents, read.teamName) : null,
                  read.closed.toPayCents ? H.toPayPart(read.closed.toPayCents) : null].filter(Boolean).join(' · ')}
              </p>
            )}
          </>
        )}
    </KitDialog>
  );
}

/** DECLINE (Ask 3): an optional reason the coach reads; the Sundays stay the team's. */
function DeclineAskWindow({ url, read, what, onClose, onDone, onStale }: {
  url: string; read: AnswerRead; what: PracticesNamed; onClose: () => void; onDone: (text: string) => void;
  /** It was answered or withdrawn meanwhile: back to Answer, read again, with the reason. */
  onStale: (text: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ notice: string }>(url, jsonInit('PATCH', { action: 'decline', reason: reason.trim() || null }));
      if (!r.ok) {
        if (RE_READ.has(codeOf(r.data))) { onStale(refusalText(r.data, H.declineFailed)); return; }
        setError(refusalText(r.data, H.declineFailed)); return;
      }
      onDone(r.data.notice);
    } catch {
      setError(H.declineFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="question"
      title={H.declineTitle(read.teamName)}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{H.declineKeep}</button>
          <button type="button" className="btn btn-outline" onClick={() => void go()} disabled={busy}>{busy ? H.declining : H.declineConfirm}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <label className={ck.field} htmlFor="decline-ask-why">
        <span className={ck.label}>{H.declineField}</span>
        <textarea id="decline-ask-why" className={ck.textarea} rows={3} maxLength={500} value={reason} placeholder={H.declinePlaceholder}
          onChange={e => setReason(e.target.value)} />
        <span className={ck.hint}>{H.declineHint(what, read.teamName)}</span>
      </label>
    </KitDialog>
  );
}
