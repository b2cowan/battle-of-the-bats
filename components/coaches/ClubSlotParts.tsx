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
 */
import { useEffect, useState } from 'react';
import { ClipboardList, Undo2 } from 'lucide-react';
import QuestionShell from './QuestionShell';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import own from './ClubSlot.module.css';
import { SCHEDULE_COACH_WORDS as C, SCHEDULE_WORDS } from '@/lib/club-schedule-words';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import type { ClubSourceAsk } from '@/lib/club-schedule-coach';
import type { AskOffer } from '@/lib/club-hand-back';

/** A waiting ask on the practice (Stage 11d): its live figure and the practices it still reaches. */
export type ClubSourceAskView = ClubSourceAsk;

/** The club practice's source, as the page reads it from `clubSources`. */
export interface ClubSource { scheduleName: string; handedBack: boolean; ask?: ClubSourceAskView | null }

export function ClubSourceNote({ source }: { source: ClubSource }) {
  return (
    <div className={`${styles.infoBanner} ${styles.sourceNote}`}>
      <ClipboardList size={13} aria-hidden style={{ flexShrink: 0 }} />
      <span>{C.sourceLead} <strong>{source.scheduleName}</strong> {C.sourceTail}</span>
    </div>
  );
}

/** The amber "Hand-back asked" pill — the built waiting badge (a waiting count is the amber pill, 2026-10-01). */
export function HandBackAskedPill() {
  return <span className={`${styles.badge} ${styles.badgePending}`}>{H.pill}</span>;
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
interface Choices {
  scheduleName: string;
  one: { count: number; dates: string };
  remaining: { count: number; dates: string };
  all: { count: number; dates: string };
  /** Stage 11d: each scope's figure for the tick — absent where the tick can't be true (Ask 1). */
  money: AskOffer | null;
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

  const rows: { id: Scope; label: string; hint: string }[] = choices ? [
    { id: 'one', label: SCHEDULE_WORDS.handBackScopes.one, hint: choices.one.dates },
    { id: 'remaining', label: SCHEDULE_WORDS.handBackScopes.remaining, hint: C.handBackAll(choices.remaining.dates, choices.remaining.count) },
    { id: 'all', label: SCHEDULE_WORDS.handBackScopes.all, hint: C.handBackAll(choices.all.dates, choices.all.count) },
  ] : [];
  return (
    <QuestionShell open onClose={onClose} ariaLabel={SCHEDULE_WORDS.handBackQuestion} title={SCHEDULE_WORDS.handBackQuestion} busy={busy}>
      <div className={`${styles.formBody} ${own.questionBody}`}>
        <p className={own.what}>{SCHEDULE_WORDS.handBackWhat}</p>
        {!choices && !error && <p className={styles.formHint}>Loading…</p>}
        {choices && (
          <div className={own.choices} role="radiogroup" aria-label={SCHEDULE_WORDS.handBackQuestion}>
            {rows.map(r => (
              <label key={r.id} className={own.choice} data-on={scope === r.id || undefined}>
                <input type="radio" name="hand-back-scope" value={r.id} checked={scope === r.id} onChange={() => setScope(r.id)} />
                <span>
                  <b>{r.label}</b>
                  <small>{r.hint}</small>
                </span>
              </label>
            ))}
          </div>
        )}
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

/** WITHDRAW THE ASK (Stage 11d, Ask 3) — the ask and its request go together; the practices stay the team's. */
export function WithdrawAskQuestion({ orgSlug, teamId, eventId, count, onClose, onDone }: {
  orgSlug: string; teamId: string; eventId: string; count: number; onClose: () => void; onDone: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/hand-back`, { method: 'DELETE' });
      const data = await r.json().catch(() => ({}));
      // The club answered it while this was open: say so and read the practice again (/review 2026-10-13).
      if (r.status === 409 && data.code === 'answered') { onDone(data.error ?? H.refuse.answered); return; }
      if (!r.ok) { setError(data.error ?? H.withdrawFailed); setBusy(false); return; }
      onDone(H.withdrawnNotice);
    } catch {
      setError(H.withdrawFailed);
      setBusy(false);
    }
  }
  return (
    <QuestionShell open onClose={onClose} ariaLabel={H.withdrawQuestion} title={H.withdrawQuestion} busy={busy}>
      <div className={`${styles.formBody} ${own.questionBody}`}>
        <p className={own.what}>{H.withdrawWhat(count)}</p>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </div>
      <div className={styles.modalFooter}>
        <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>{H.withdrawKeep}</button>
        <button type="button" className={styles.btnSecondary} onClick={() => void go()} disabled={busy}>{busy ? H.withdrawing : H.withdrawConfirm}</button>
      </div>
    </QuestionShell>
  );
}
