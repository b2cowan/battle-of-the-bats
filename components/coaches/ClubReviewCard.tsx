'use client';
/**
 * THE CLUB'S PROPOSALS, IN A TEAM'S OVERVIEW TAIL (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimen 14 step 5
 * "The coach reviews"; Ask 24, amending Stage 11 Ask 1: an optional review round that NEVER blocks).
 *
 *   the list   — RE-PLACED by the owner 2026-11-14 (Overview drawings A1–A6, artifact claude.ai/artifact/6CBLokgyfhJ7eZTE3GgYro).
 *                It used to be one full accent card PER proposal ABOVE the One Thing card, each with its own lime "Review
 *                it" — two proposals pushed game day two thirds of the way down the window. Now: ONE row per schedule
 *                in review, in the Overview's tail (Chunk I rule 8: everything that is not today's work is ONE tail;
 *                rule 6: full width is the anchor's and the board's). A label that counts what still needs a reply
 *                ("2 waiting on your reply" · "Answered · waiting for the club"); each row is the schedule's name, what it
 *                holds, and on the right the reply-by — "⚠ Your reply was due …" in amber when it has passed (amber, not
 *                red: the reply-by never blocks), late rows first. An answered row goes quiet and sorts last but stays,
 *                so the answer can be changed until the club finalizes; it is gone once the schedule is final (the read
 *                returns only schedules in review). The whole row opens the window (the row list's own button row).
 *   the window — the bell and the email open the same window (they land on this list, `#club-proposals`): "The club's proposal ·
 *                Winter dome · Sundays · reply by Tue, Sep 22" (never "From the club", which the coach's Money says of
 *                money the club pays — P11-03, the /design review); Your time (the slots as a pattern); Your bill (its
 *                share and payments, each payment naming the slots it covers — Ask 23); "Nothing is on your schedule or
 *                your Money › Club tab until the club finalizes it."; Ask for a change (a sentence to the club, which changes
 *                nothing by itself) · Looks good.
 *
 * ⚖ WHO: a HEAD COACH of the team (the review carries the team's bill) — the route answers nothing for anyone else.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { CoachRow, CoachRowList } from '@/components/coaches/CoachRowList';
import QuestionShell, { QuestionReason } from './QuestionShell';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './CoachClubArrivalCard.module.css';
import own from './ClubSlot.module.css';
import { fmt } from '@/lib/coach-money-summary';
import { formatShortWeekdayDate, formatStoredDate, tournamentToday } from '@/lib/timezone';
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

/** Where the bell and the review email land (lib/club-schedule-send.ts): the list sits below the fold on a phone. */
export const CLUB_PROPOSALS_ANCHOR = 'club-proposals';

export default function ClubReviewCard({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [open, setOpen] = useState<Review | null>(null);
  // What the last answer said, NAMING its schedule: one line under the whole list, so with two proposals it must say which.
  const [said, setSaid] = useState<{ scheduleName: string; text: string } | null>(null);
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

  // Landing from the bell or the email (`…#club-proposals`): the rows arrive after the page has painted, so the
  // browser's own jump to the anchor found nothing — bring the list into view once, when it first has rows.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !reviews.length || window.location.hash !== `#${CLUB_PROPOSALS_ANCHOR}`) return;
    landed.current = true;
    document.getElementById(CLUB_PROPOSALS_ANCHOR)?.scrollIntoView({ block: 'start' });
  }, [reviews.length]);

  if (!reviews.length) return null;
  // The reply-by is a calendar day, compared with today's in the platform's org zone (`ORG_TIME_ZONE`, the zone
  // `formatShortWeekdayDate` shows it in) — both `YYYY-MM-DD`. Late only re-labels and re-sorts; it never blocks.
  const today = tournamentToday();
  const isLate = (r: Review) => !r.reply && r.replyBy !== null && r.replyBy < today;
  const rank = (r: Review) => (r.reply ? 2 : isLate(r) ? 0 : 1);
  const rows = [...reviews].sort((a, b) => rank(a) - rank(b) || (a.replyBy ?? '9999-12-31').localeCompare(b.replyBy ?? '9999-12-31'));
  const waiting = reviews.filter(r => !r.reply).length;
  const titleId = `${CLUB_PROPOSALS_ANCHOR}-title`;
  return (
    <>
      {/* A plain block, not a named <section>: the label names the LIST (one name, one thing). */}
      <div id={CLUB_PROPOSALS_ANCHOR} className={css.block}>
        <div className={css.head}>
          <h2 className={css.kicker} id={titleId}>{C.proposalsLabel(reviews.length)}</h2>
          <span className={css.count}>{C.proposalsWaiting(waiting, reviews.length)}</span>
        </div>
        <CoachRowList labelledBy={titleId}>
          {rows.map(r => (
            <CoachRow
              key={r.scheduleId}
              as="button"
              aria-haspopup="dialog"
              onClick={() => { setSaid(null); setOpen(r); }}
              className={css.proposalRow}
              title={r.scheduleName}
              titleWeight={r.reply ? 'plain' : undefined}
              caption={C.proposalHolds(slotCountWords(r.slots, r.days, r.oneWeekday), r.bill ? moneyCents(r.bill.cents) : null)}
              trail={r.reply
                ? <span className={css.said}>{C.proposalAnswered(r.reply.answer)}</span>
                : r.replyBy
                  ? isLate(r)
                    ? <span className={css.late}><TriangleAlert size={13} aria-hidden /> {C.proposalReplyLate(formatShortWeekdayDate(r.replyBy))}</span>
                    : <span className={css.by}>{C.proposalReplyBy(formatShortWeekdayDate(r.replyBy))}</span>
                  : null}
              door="chevron"
            />
          ))}
        </CoachRowList>
        {said && open === null && <p className={css.saidLine} role="status"><strong>{said.scheduleName}</strong> · {said.text}</p>}
      </div>
      {open && (
        <ReviewWindow review={open} url={url} onClose={() => setOpen(null)}
          onAnswered={text => { setSaid({ scheduleName: open.scheduleName, text }); setOpen(null); load(); }} />
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
