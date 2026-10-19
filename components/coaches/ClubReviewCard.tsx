'use client';
/**
 * THE CLUB'S PROPOSAL, ON A TEAM'S OVERVIEW (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimen 14 step 5 "The
 * coach reviews"; Ask 24, amending Stage 11 Ask 1: an optional review round that NEVER blocks).
 *
 *   the card   — where a head coach already looks (`CoachClubArrivalCard`'s pattern: the accent card, a kicker, a
 *                title, a line, one action): "The club has a proposal for 15U AAA" · "Winter dome · Sundays: 25 Sundays
 *                and a $2,700.00 bill. Reply by Tue, Sep 22." · Review it. Once answered it SAYS the answer and offers
 *                to change it — either answer can be changed until the club finalizes (the drawing's tag); it is gone
 *                once the schedule is final (the read returns only schedules in review).
 *   the window — the bell and the email open the same window (they land on this Overview): "The club's proposal ·
 *                Winter dome · Sundays · reply by Tue, Sep 22" (never "From the club", which the coach's Money says of
 *                money the club pays — P11-03, the /design review); Your time (the slots as a pattern); Your bill (its
 *                share and payments, each payment naming the slots it covers — Ask 23); "Nothing is on your schedule or
 *                your Money › Club tab until the club finalizes it."; Ask for a change (a sentence to the club, which changes
 *                nothing by itself) · Looks good.
 *
 * ⚖ WHO: a HEAD COACH of the team (the review carries the team's bill) — the route answers nothing for anyone else.
 */
import { useCallback, useEffect, useState } from 'react';
import { CoachCard } from '@/components/coaches/kit';
import QuestionShell, { QuestionReason } from './QuestionShell';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './CoachClubArrivalCard.module.css';
import own from './ClubSlot.module.css';
import { fmt } from '@/lib/coach-money-summary';
import { formatShortWeekdayDate, formatStoredDate } from '@/lib/timezone';
import { joinWithAnd } from '@/lib/utils';
import { SCHEDULE_COACH_WORDS as C, moneyCents, slotCountWords } from '@/lib/club-schedule-words';

interface Review {
  scheduleId: string;
  scheduleName: string;
  replyBy: string | null;
  slots: number;
  days: number;
  hours: number;
  patterns: string[];
  bill: { cents: number; installments: { installmentNumber: number; amount: number; dueDate: string }[] } | null;
  covers: { slots: number; days: number; months: string[] }[];
  oneWeekday: number | null;
  seasonName: string | null;
  reply: { answer: 'looks_good' | 'ask_for_change'; words: string | null; at: string } | null;
}

export default function ClubReviewCard({ orgSlug, teamId, teamName }: { orgSlug: string; teamId: string; teamName: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [open, setOpen] = useState<Review | null>(null);
  const [said, setSaid] = useState<{ scheduleId: string; text: string } | null>(null);
  const url = `/api/coaches/${encodeURIComponent(orgSlug)}/teams/${encodeURIComponent(teamId)}/club-schedules`;
  const load = useCallback(() => {
    let cancelled = false;
    fetch(url, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { reviews: Review[] } | null) => { if (!cancelled && d) setReviews(d.reviews ?? []); })
      .catch(() => { /* a card that fails to load is simply not shown */ });
    return () => { cancelled = true; };
  }, [url]);
  useEffect(() => load(), [load]);

  if (!reviews.length) return null;
  return (
    <>
      {reviews.map(r => (
        <CoachCard key={r.scheduleId} accent className={css.card} role="status">
          <span className={css.kicker}>{C.reviewEyebrow}</span>
          <p className={css.title}>{C.reviewCardTitle(teamName)}</p>
          <p className={css.body}>
            {C.reviewCardBody(r.scheduleName, slotCountWords(r.slots, r.days, r.oneWeekday), r.bill ? moneyCents(r.bill.cents) : null, r.replyBy ? formatShortWeekdayDate(r.replyBy) : null)}
            {r.reply && <> {C.reviewCardAnswered(r.reply.answer)}</>}
          </p>
          {said?.scheduleId === r.scheduleId && open === null && <p className={css.body} role="status">{said.text}</p>}
          <div>
            <button type="button" className={`btn ${r.reply ? 'btn-outline' : 'btn-lime'} btn-sm`} onClick={() => { setSaid(null); setOpen(r); }}>
              {r.reply ? C.changeAnswer : C.reviewIt}
            </button>
          </div>
        </CoachCard>
      ))}
      {open && (
        <ReviewWindow review={open} url={url} onClose={() => setOpen(null)}
          onAnswered={text => { setSaid({ scheduleId: open.scheduleId, text }); setOpen(null); load(); }} />
      )}
    </>
  );
}

function ReviewWindow({ review: r, url, onClose, onAnswered }: { review: Review; url: string; onClose: () => void; onAnswered: (text: string) => void }) {
  const [asking, setAsking] = useState(r.reply?.answer === 'ask_for_change');
  const [words, setWords] = useState(r.reply?.words ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** A change request typed and not sent: closing asks first, in the window's foot (One Window B2, 2026-10-19). */
  const typed = asking && words.trim() !== (r.reply?.words ?? '').trim();

  async function answer(a: 'looks_good' | 'ask_for_change') {
    if (busy) return;
    if (a === 'ask_for_change' && !words.trim()) { setError(C.askWhat); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduleId: r.scheduleId, answer: a, words: a === 'ask_for_change' ? words.trim() : null }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? C.replyFailed); setBusy(false); return; }
      onAnswered(a === 'looks_good' ? C.thanksGood : C.thanksAsked);
    } catch {
      setError(C.replyFailed);
      setBusy(false);
    }
  }

  const payments = r.bill?.installments ?? [];
  return (
    <QuestionShell open onClose={onClose} dirty={typed} ariaLabel={r.scheduleName} title={r.scheduleName} subtitle={C.reviewEyebrow} busy={busy} wide
      footer={asking ? (
        <>
          <button type="button" className={styles.btnGhost} onClick={() => setAsking(false)} disabled={busy}>{C.keepIt}</button>
          <button type="button" className={styles.btnPrimary} onClick={() => void answer('ask_for_change')} disabled={busy}>{C.askSend}</button>
        </>
      ) : (
        <>
          <button type="button" className={styles.btnSecondary} onClick={() => setAsking(true)} disabled={busy}>{C.askForChange}</button>
          <button type="button" className={styles.btnPrimary} onClick={() => void answer('looks_good')} disabled={busy}>{C.looksGood}</button>
        </>
      )}>
      <div className={styles.formBody}>
        <div className={`${styles.infoBanner} ${styles.sourceNote} ${own.from}`}>
          <span>{C.reviewFrom} · <strong>{r.scheduleName}</strong>{r.replyBy ? ` · ${C.replyByWords(formatShortWeekdayDate(r.replyBy))}` : ''}</span>
        </div>
        <h3 className={own.sectionHead}>{C.yourTime}</h3>
        <div className={own.rows}>
          {r.patterns.map(p => (
            <div key={p} className={own.row}><span className={own.rowMain}><b>{p}</b></span></div>
          ))}
          <div className={own.row}>
            <span className={own.rowMain}><small>{slotCountWords(r.slots, r.days, r.oneWeekday)}</small></span>
            <span className={own.figure}>{Math.round(r.hours * 10) / 10} h</span>
          </div>
        </div>
        {r.bill && (
          <>
            <h3 className={own.sectionHead}>{C.yourBill}</h3>
            <div className={own.band}>
              <div className={own.tile}>
                <span className={own.tileLabel}>{C.yourShare}</span>
                <span className={own.tileValue}>{moneyCents(r.bill.cents)}</span>
                <span className={own.tileSub}>{C.byTheTime}</span>
              </div>
              <div className={own.tile}>
                <span className={own.tileLabel}>{C.payments}</span>
                <span className={own.tileValue}>{payments.length}</span>
                <span className={own.tileSub}>{payments.map(i => formatStoredDate(i.dueDate, { withYear: false })).join(' · ')}</span>
              </div>
            </div>
            <div className={own.rows}>
              {payments.map((i, k) => (
                <div key={i.installmentNumber} className={own.row}>
                  <span className={own.rowMain}>
                    <b>{formatStoredDate(i.dueDate, { withYear: false })}</b>
                    {r.covers[k]?.slots ? <small>{C.paymentCovers(r.covers[k].slots, r.covers[k].days, joinWithAnd(r.covers[k].months), r.oneWeekday)}</small> : null}
                  </span>
                  <span className={own.figure}>{fmt(i.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <p className={own.note}>{r.bill ? C.nothingYet : C.nothingYetNoBill}</p>
        {asking && (
          <label className={`${styles.field} ${own.ask}`}>
            <span className={styles.label}>{C.askWhat}</span>
            <textarea className={styles.input} rows={3} maxLength={1000} value={words} placeholder={C.askPlaceholder}
              onChange={e => setWords(e.target.value)} autoFocus />
          </label>
        )}
        <QuestionReason className={styles.errorText}>{error}</QuestionReason>
      </div>
    </QuestionShell>
  );
}
