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
 *                     mirror puts its own sentence and where Delete would be (the /design review, specimen 11).
 *   HandBackQuestion— the repeating-event question in the coach's words (the series pencil's three rows, 2026-10-09):
 *                     This practice only · This & future · All practices, each naming the dates it reaches; one sentence
 *                     of what it does; Keep it · Hand back. Lands at once (the coach's own act); the builders get a notice.
 */
import { useEffect, useState } from 'react';
import { ClipboardList, Undo2 } from 'lucide-react';
import QuestionShell from './QuestionShell';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import own from './ClubSlot.module.css';
import { SCHEDULE_COACH_WORDS as C, SCHEDULE_WORDS } from '@/lib/club-schedule-words';

/** The club practice's source, as the page reads it from `clubSources`. */
export interface ClubSource { scheduleName: string; handedBack: boolean }

export function ClubSourceNote({ source }: { source: ClubSource }) {
  return (
    <div className={`${styles.infoBanner} ${styles.sourceNote}`}>
      <ClipboardList size={13} aria-hidden style={{ flexShrink: 0 }} />
      <span>{C.sourceLead} <strong>{source.scheduleName}</strong> {C.sourceTail}</span>
    </div>
  );
}

export function ClubPracticeEnd({ canHandBack, onHandBack }: { canHandBack: boolean; onHandBack: () => void }) {
  return (
    <div className={own.end}>
      {canHandBack && (
        <button type="button" className={own.handBack} onClick={onHandBack}>
          <Undo2 size={14} aria-hidden /> {SCHEDULE_WORDS.handBackDoor}
        </button>
      )}
      <p className={styles.formHint}>{SCHEDULE_WORDS.onlyTheClub}</p>
    </div>
  );
}

interface Choices {
  scheduleName: string;
  one: { count: number; dates: string };
  remaining: { count: number; dates: string };
  all: { count: number; dates: string };
}

export function HandBackQuestion({ orgSlug, teamId, eventId, onClose, onDone }: {
  orgSlug: string;
  teamId: string;
  eventId: string;
  onClose: () => void;
  /** Handed back: the sentence the page says once. */
  onDone: (text: string) => void;
}) {
  const url = `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/hand-back`;
  const [choices, setChoices] = useState<Choices | null>(null);
  const [scope, setScope] = useState<'one' | 'remaining' | 'all'>('remaining');
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

  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError(data.error ?? C.handBackFailed); setBusy(false); return; }
      onDone(C.handedBackNotice(data.handedBack ?? 1));
    } catch {
      setError(C.handBackFailed);
      setBusy(false);
    }
  }

  const rows: { id: 'one' | 'remaining' | 'all'; label: string; hint: string }[] = choices ? [
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
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </div>
      <div className={styles.modalFooter}>
        <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>{C.keepIt}</button>
        <button type="button" className={styles.btnSecondary} onClick={() => void go()} disabled={busy || !choices}>
          {busy ? C.handingBack : C.handBack}
        </button>
      </div>
    </QuestionShell>
  );
}
