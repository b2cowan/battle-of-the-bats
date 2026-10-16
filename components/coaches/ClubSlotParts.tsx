'use client';
/**
 * A CLUB PRACTICE ON A COACH'S SCHEDULE (Club Tier Stage 11a, part B — hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11,
 * specimen 11 "A head coach"; Asks 15, 16, 17; plan §5.7). The published-tournament-game pattern (Stage 11 Ask 1): the
 * club owns the practice's time, place and whether it happens — the server refuses a coach's change to them — and the
 * coach keeps arrival, notes, attendance and the practice plan.
 *
 *   ClubSourceNote  — the sheet's source line, the mirror's own construction: "From **Winter dome 2026–27** · the club's
 *                     schedule" (Ask 16 — never a bare "From the club", which the coach's Money already says of money
 *                     the club pays: P11-03).
 *   ClubPracticeEnd — the body's END: **Hand back this practice** (the coach's one new door, a rare one — not red: it
 *                     frees time, it destroys nothing), then "Only the club can move or remove this practice." where the
 *                     mirror puts its own sentence and where Delete would be (the /design review, specimen 11). Stage 11d
 *                     (specimen 2): while an ask for money back waits, the amber **Hand-back asked** pill, what was asked,
 *                     and **Withdraw the ask** where Hand back was (the rare door; not red).
 *   HandBackQuestion— the repeating-event question in the coach's words (the series pencil's three rows, 2026-10-09):
 *                     This practice only · This & future · All practices, each naming the dates it reaches; one sentence
 *                     of what it does; Keep it · Hand back. Lands at once (the coach's own act); the builders get a notice.
 *                     Stage 11d (specimen 1; Asks 1, 2): one tick, **Ask the club for $432.00 back**, off by default, its
 *                     figure following the choice above it — only where the club billed the team for the time and this
 *                     coach can use the team's money; with it the second button reads **Ask the club** and nothing lands
 *                     until the club answers. Keep it · Ask the club stay the built question pair (no lime, no red).
 *   WithdrawAskQuestion — Withdraw the ask's question (a request's Withdraw asks first; so does this).
 *
 * Stage 11d part C (hub Stage 11d, the "C" links; Asks 10–14 ratified 2026-10-16) — A HAND-BACK THE COACH CAN CHANGE:
 *   HandedBackEnd   — a handed-back practice's END (C2): one sentence (when, with how many others, families see it as
 *                     cancelled, until when it can come back — or what the club did with the time or the money), then
 *                     its ways back as rare doors, each only while it can be true — **Ask the club for $X back** (the
 *                     team's money access) and **Take it back** (the schedule's) — then the club's sentence. While a late
 *                     ask waits: the amber **Money asked** pill, its line and **Withdraw the ask**. On a phone it ends the
 *                     sheet's body: no pinned foot (D2).
 *   TakeBackQuestion — Take back which practices? (C3): Hand back's three rows limited to this hand-back and to what can
 *                     come back; Keep it handed back · Take it back.
 *   LateAskQuestion — Ask the club for money back? (C3): the practices and the figure, read, never chosen; Cancel · Ask
 *                     the club. Both are the portal's question windows (nothing lime, nothing red).
 */
import { useEffect, useState } from 'react';
import { ClipboardList, DollarSign, LogIn, Undo2 } from 'lucide-react';
import QuestionShell from './QuestionShell';
import LoadingState from '@/components/shared/LoadingState';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import own from './ClubSlot.module.css';
import { SCHEDULE_COACH_WORDS as C, SCHEDULE_WORDS } from '@/lib/club-schedule-words';
import { HAND_BACK_WORDS as H, handedBackSentence, sundaysLine } from '@/lib/club-hand-back-words';
import { STATE_WORDS } from '@/lib/calendar-recipe';
import type { ClubSourceAsk } from '@/lib/club-schedule-coach';
import type { AskOffer, LateAskOffer, TakeBackChoices } from '@/lib/club-hand-back';
import type { PracticeHandBack } from '@/lib/club-hand-back-reads';

/** A waiting ask on the practice (Stage 11d): its live figure and the practices it still reaches. */
export type ClubSourceAskView = ClubSourceAsk;

/** The club practice's source, as the page reads it from `clubSources`. Part C: `handBack` — the hand-back that took
 *  this (cancelled) practice, for its end. */
export interface ClubSource { scheduleName: string; handedBack: boolean; ask?: ClubSourceAskView | null; handBack?: PracticeHandBack | null; teamName?: string }

export function ClubSourceNote({ source }: { source: ClubSource }) {
  return (
    <div className={`${styles.infoBanner} ${styles.sourceNote}`}>
      <ClipboardList size={13} aria-hidden style={{ flexShrink: 0 }} />
      <span>{C.sourceLead} <strong>{source.scheduleName}</strong> {C.sourceTail}</span>
    </div>
  );
}

/** The word a row that isn't happening wears beside its struck title (part C, Ask 14): Handed back for a club practice
 *  this team handed back, else Cancelled — the list row, a calendar cell, the sheet's head. */
export const notOnWord = (handedBack: boolean | undefined) => (handedBack ? C.handedBack : STATE_WORDS.cancelled);

/** The amber "Hand-back asked" pill — the built waiting badge (a waiting count is the amber pill, 2026-10-01). */
export function HandBackAskedPill() {
  return <span className={`${styles.badge} ${styles.badgePending}`}>{H.pill}</span>;
}

/** Part C (C1): the amber "Money asked" pill — a late ask waits on a practice already handed back. */
export function MoneyAskedPill() {
  return <span className={`${styles.badge} ${styles.badgePending}`}>{H.moneyAskedPill}</span>;
}

/**
 * A HANDED-BACK PRACTICE'S END (part C, C2). `thisDay` is the practice's club day; `canSchedule` / `canMoney` are the
 * viewer's — each door shows only while it can be true and only to whom it belongs (the routes refuse the rest).
 */
export function HandedBackEnd({ handBack, thisDay, teamName, canSchedule, canMoney, onTakeBack, onAskLater, onWithdraw }: {
  handBack: PracticeHandBack; thisDay: string; teamName: string; canSchedule: boolean; canMoney: boolean;
  onTakeBack: () => void; onAskLater: () => void; onWithdraw: () => void;
}) {
  const late = handBack.late;
  const waiting = late?.state === 'waiting';
  const askCents = canMoney && !late ? handBack.askCents : null;
  return (
    <div className={`${own.end} ${own.handedBackEnd}`}>
      {waiting && late ? (
        <p className={own.said}><MoneyAskedPill />{H.lateAskedLine({ askedOn: late.askedOn, cents: late.cents, count: late.count, on: handBack.on })}</p>
      ) : (
        <p className={own.said}>{handedBackSentence({ ...handBack, thisDay, canMoney, teamName })}</p>
      )}
      <div className={own.doors}>
        {waiting ? (canMoney && (
          <button type="button" className={own.handBack} onClick={onWithdraw}><Undo2 size={14} aria-hidden /> {H.withdrawDoor}</button>
        )) : (
          <>
            {askCents ? (
              <button type="button" className={own.handBack} onClick={onAskLater}><DollarSign size={14} aria-hidden /> {H.tick(askCents)}</button>
            ) : null}
            {canSchedule && handBack.canTakeBack && (
              <button type="button" className={own.handBack} onClick={onTakeBack}><LogIn size={14} aria-hidden /> {H.takeBackDoor}</button>
            )}
          </>
        )}
      </div>
      <p className={styles.formHint}>{SCHEDULE_WORDS.onlyTheClub}</p>
    </div>
  );
}

/** What the ask asked, under its amber pill (specimen 2) — at the practice's end at a desk; at the end of the sheet's body on a
 *  phone, where it reads with the record and leaves the pinned foot its door (owner 2026-10-13, the /design pass). */
export function HandBackAskStatus({ ask, inBody = false }: { ask: ClubSourceAskView; inBody?: boolean }) {
  return (
    <div className={`${own.asked}${inBody ? ` ${own.askedInBody}` : ''}`}>
      <HandBackAskedPill />
      <p className={own.askedLine}>{H.askedLine({ askedOn: ask.askedAt.slice(0, 10), count: ask.count, first: ask.first, last: ask.last, cents: ask.cents })}</p>
    </div>
  );
}

export function ClubPracticeEnd({ canHandBack, onHandBack, ask = null, askInBody = false, onWithdraw }: {
  canHandBack: boolean;
  onHandBack: () => void;
  /** Stage 11d: the waiting ask this practice is in — Withdraw the ask replaces Hand back while it waits. */
  ask?: ClubSourceAskView | null;
  /** A phone: the ask's status sits at the end of the body (`HandBackAskStatus`), so this foot keeps only its door. */
  askInBody?: boolean;
  /** Absent for a coach who can't use the team's money: the ask reads without Withdraw. */
  onWithdraw?: () => void;
}) {
  return (
    <div className={own.end}>
      {ask ? (
        <>
          {!askInBody && <HandBackAskStatus ask={ask} />}
          {onWithdraw && (
            <button type="button" className={own.handBack} onClick={onWithdraw}>
              <Undo2 size={14} aria-hidden /> {H.withdrawDoor}
            </button>
          )}
        </>
      ) : canHandBack && (
        <button type="button" className={own.handBack} onClick={onHandBack}>
          <Undo2 size={14} aria-hidden /> {SCHEDULE_WORDS.handBackDoor}
        </button>
      )}
      <p className={styles.formHint}>{SCHEDULE_WORDS.onlyTheClub}</p>
    </div>
  );
}

type Scope = 'one' | 'remaining' | 'all';
/** What each of the series question's three rows reaches: its count and its dates. */
type ScopeReach = Record<Scope, { count: number; dates: string }>;
interface Choices extends ScopeReach {
  scheduleName: string;
  /** Stage 11d: each scope's figure for the tick — absent where the tick can't be true (Ask 1). */
  money: AskOffer | null;
}

/** THE SERIES QUESTION'S THREE ROWS — Hand back's and Take it back's alike (part C, C3: "Hand back's own three rows"):
 *  This practice only · This & future · All practices, each naming the dates it reaches. */
function ScopeRows({ name, label, reach, scope, onScope }: { name: string; label: string; reach: ScopeReach; scope: Scope; onScope: (s: Scope) => void }) {
  const hint: Record<Scope, string> = {
    one: reach.one.dates,
    remaining: C.handBackAll(reach.remaining.dates, reach.remaining.count),
    all: C.handBackAll(reach.all.dates, reach.all.count),
  };
  return (
    <div className={own.choices} role="radiogroup" aria-label={label}>
      {(['one', 'remaining', 'all'] as const).map(id => (
        <label key={id} className={own.choice} data-on={scope === id || undefined}>
          <input type="radio" name={name} value={id} checked={scope === id} onChange={() => onScope(id)} />
          <span>
            <b>{SCHEDULE_WORDS.handBackScopes[id]}</b>
            <small>{hint[id]}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

export function HandBackQuestion({ orgSlug, teamId, eventId, onClose, onDone }: {
  orgSlug: string;
  teamId: string;
  eventId: string;
  onClose: () => void;
  /** Handed back (or asked): the sentence the page says once. */
  onDone: (text: string) => void;
}) {
  const url = `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/hand-back`;
  const [choices, setChoices] = useState<Choices | null>(null);
  const [scope, setScope] = useState<Scope>('remaining');
  const [askMoney, setAskMoney] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(url).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) { setError(data.error ?? C.handBackFailed); return; }
      setChoices(data as Choices);
      if ((data as Choices).remaining.count <= 1) setScope('one');
    }).catch(() => { if (live) setError(C.handBackFailed); });
    return () => { live = false; };
  }, [url]);

  const money = choices?.money ?? null;
  const picked = money ? money[scope] : null;
  // The tick's figure follows the choice above it; a choice with nothing to ask (fully asked back already) clears it.
  const asking = askMoney && !!picked && picked.cents > 0;

  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, askMoney: asking }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError(data.error ?? C.handBackFailed); setBusy(false); return; }
      onDone(asking ? H.askedNotice(data.count ?? 1) : C.handedBackNotice(data.handedBack ?? 1));
    } catch {
      setError(C.handBackFailed);
      setBusy(false);
    }
  }

  return (
    <QuestionShell open onClose={onClose} ariaLabel={SCHEDULE_WORDS.handBackQuestion} title={SCHEDULE_WORDS.handBackQuestion} busy={busy}>
      <div className={`${styles.formBody} ${own.questionBody}`}>
        <p className={own.what}>{SCHEDULE_WORDS.handBackWhat}</p>
        {!choices && !error && <LoadingState inline label={C.loadingPractices} />}
        {choices && <ScopeRows name="hand-back-scope" label={SCHEDULE_WORDS.handBackQuestion} reach={choices} scope={scope} onScope={setScope} />}
        {money && picked && picked.cents > 0 && (
          <label className={own.money} data-on={askMoney || undefined}>
            <input type="checkbox" checked={askMoney} onChange={e => setAskMoney(e.target.checked)} />
            <span>
              <b>{H.tick(picked.cents)}</b>
              <small>{H.tickLine({ count: picked.count, weekday: picked.weekday, eachCents: picked.eachCents, teamName: money.teamName })}</small>
            </span>
          </label>
        )}
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </div>
      <div className={styles.modalFooter}>
        <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>{C.keepIt}</button>
        <button type="button" className={styles.btnSecondary} onClick={() => void go()} disabled={busy || !choices}>
          {busy ? (asking ? H.asking : C.handingBack) : asking ? H.askButton : C.handBack}
        </button>
      </div>
    </QuestionShell>
  );
}

/** WITHDRAW THE ASK (Stage 11d, Ask 3) — the ask and its request go together; the practices stay the team's. Part C: a
 *  LATE ask is withdrawn through its own route (the team's money access), and its practices stay handed back. */
export function WithdrawAskQuestion({ orgSlug, teamId, eventId, count, late = false, onClose, onDone }: {
  orgSlug: string; teamId: string; eventId: string; count: number; late?: boolean; onClose: () => void; onDone: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/${late ? 'money-back' : 'hand-back'}`, { method: 'DELETE' });
      const data = await r.json().catch(() => ({}));
      // The club answered it while this was open: say so and read the practice again (/review 2026-10-13).
      if (r.status === 409 && data.code === 'answered') { onDone(data.error ?? H.refuse.answered); return; }
      if (!r.ok) { setError(data.error ?? H.withdrawFailed); setBusy(false); return; }
      onDone(late ? H.withdrawnLateNotice : H.withdrawnNotice);
    } catch {
      setError(H.withdrawFailed);
      setBusy(false);
    }
  }
  return (
    <QuestionShell open onClose={onClose} ariaLabel={H.withdrawQuestion} title={H.withdrawQuestion} busy={busy}>
      <div className={`${styles.formBody} ${own.questionBody}`}>
        <p className={own.what}>{H.withdrawWhat(count, late)}</p>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </div>
      <div className={styles.modalFooter}>
        <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>{H.withdrawKeep}</button>
        <button type="button" className={styles.btnSecondary} onClick={() => void go()} disabled={busy}>{busy ? H.withdrawing : H.withdrawConfirm}</button>
      </div>
    </QuestionShell>
  );
}

/** TAKE BACK WHICH PRACTICES? (part C, C3; Ask 11) — Hand back's three rows, reaching only this hand-back's practices that
 *  can come back now; lands at once (the practices are back as they were; the club's schedulers are told). */
export function TakeBackQuestion({ orgSlug, teamId, eventId, onClose, onDone }: {
  orgSlug: string; teamId: string; eventId: string; onClose: () => void;
  /** Taken back: the sentence the page says once. */
  onDone: (text: string) => void;
}) {
  const url = `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/take-back`;
  const [choices, setChoices] = useState<TakeBackChoices | null>(null);
  const [scope, setScope] = useState<Scope>('remaining');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(url).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) { setError(data.error ?? H.takeBackFailed); return; }
      setChoices(data as TakeBackChoices);
      if ((data as TakeBackChoices).remaining.count <= 1) setScope('one');
    }).catch(() => { if (live) setError(H.takeBackFailed); });
    return () => { live = false; };
  }, [url]);

  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }) });
      const data = await r.json().catch(() => ({}));
      // Someone else changed it while this was open (the club gave the time away, an ask was made): say so and read the
      // practice again, as Withdraw does (/review 2026-10-16) — never leave a door that can no longer be true.
      if (r.status === 409) { onDone(data.error ?? H.refuse.takeBackNothing); return; }
      if (!r.ok) { setError(data.error ?? H.takeBackFailed); setBusy(false); return; }
      onDone(H.takenBackNotice(data.takenBack ?? 1));
    } catch {
      setError(H.takeBackFailed);
      setBusy(false);
    }
  }

  return (
    <QuestionShell open onClose={onClose} ariaLabel={H.takeBackQuestion} title={H.takeBackQuestion} busy={busy}>
      <div className={`${styles.formBody} ${own.questionBody}`}>
        <p className={own.what}>{H.takeBackLead}</p>
        {!choices && !error && <LoadingState inline label={C.loadingPractices} />}
        {choices && <ScopeRows name="take-back-scope" label={H.takeBackQuestion} reach={choices} scope={scope} onScope={setScope} />}
        {choices?.left && <p className={own.left}>{choices.left}</p>}
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </div>
      <div className={styles.modalFooter}>
        <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>{H.takeBackKeep}</button>
        <button type="button" className={styles.btnSecondary} onClick={() => void go()} disabled={busy || !choices}>
          {busy ? H.takingBack : H.takeBackConfirm}
        </button>
      </div>
    </QuestionShell>
  );
}

/** ASK THE CLUB FOR MONEY BACK? (part C, C3; Ask 12) — every practice of the hand-back still handed back and its figure,
 *  read, not chosen: the mistake it fixes is the whole hand-back's money. The time is already open. */
export function LateAskQuestion({ orgSlug, teamId, eventId, onClose, onDone }: {
  orgSlug: string; teamId: string; eventId: string; onClose: () => void;
  /** Asked: the sentence the page says once. */
  onDone: (text: string) => void;
}) {
  const url = `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/money-back`;
  const [offer, setOffer] = useState<LateAskOffer | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(url).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) { setError(data.error ?? H.lateFailed); return; }
      setOffer(data as LateAskOffer);
    }).catch(() => { if (live) setError(H.lateFailed); });
    return () => { live = false; };
  }, [url]);

  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(url, { method: 'POST' });
      const data = await r.json().catch(() => ({}));
      // Already asked, or nothing left to ask (another coach was first): say so and read the practice again.
      if (r.status === 409) { onDone(data.error ?? H.refuse.lateAsked); return; }
      if (!r.ok) { setError(data.error ?? H.lateFailed); setBusy(false); return; }
      onDone(H.lateAskedNotice);
    } catch {
      setError(H.lateFailed);
      setBusy(false);
    }
  }

  return (
    <QuestionShell open onClose={onClose} ariaLabel={H.lateQuestion} title={H.lateQuestion} busy={busy}>
      <div className={`${styles.formBody} ${own.questionBody}`}>
        {!offer && !error && <LoadingState inline label={H.lateLoading} />}
        {offer && (
          <>
            <p className={own.what}>{H.lateLead(offer.on, offer.count)}</p>
            <dl className={own.lateFacts}>
              <dt>{H.factPractices}</dt>
              <dd>{sundaysLine(offer.practices)}</dd>
              <dt>{H.factAsksFor}</dt>
              <dd>{H.asksFor(offer.cents)}<small>{H.lateAsksForHow({ count: offer.count, weekday: offer.weekday, eachCents: offer.eachCents, teamName: offer.teamName })}</small></dd>
            </dl>
          </>
        )}
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </div>
      <div className={styles.modalFooter}>
        <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>{H.lateCancel}</button>
        <button type="button" className={styles.btnSecondary} onClick={() => void go()} disabled={busy || !offer}>{busy ? H.asking : H.askButton}</button>
      </div>
    </QuestionShell>
  );
}
