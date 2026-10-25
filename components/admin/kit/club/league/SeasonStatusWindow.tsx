'use client';
import { useState } from 'react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import DateInput from '@/components/shared/DateInput';
import { tournamentToday } from '@/lib/timezone';
import { MOVE_TO, moveWords, type MoveFacts, type StatusMove } from '@/lib/house-league-status-words';
import s from './LeagueSeason.module.css';

/**
 * ONE WINDOW FOR EVERY HOUSE-LEAGUE STATUS CHANGE (Club Tier Stage 9a, 9a·4; frame D; words lib/house-league-status-words.ts).
 * It says what changes for families, warns about loose ends in one amber sentence and never blocks, and its foot is the
 * sentence at the left and Cancel · the primary at the right. A form-kind window, so a phone gets the full screen with ←;
 * there the title is "{Verb} the season?" and the season's name leads the body. A refusal is said in the window.
 * "Reopen until…" (9b-1 Part 4, S2·b) asks for the new close date: the form runs until the end of that day. A season the
 * close date closed is still "open" by status, so its reopen sends only the date.
 */
export default function SeasonStatusWindow({ move, seasonId, orgSlug, facts, status, onClose, onDone }: {
  move: StatusMove;
  /** The season's status now (a season its close date closed reopens by its date alone). */
  status: string;
  seasonId: string;
  orgSlug: string;
  facts: MoveFacts;
  onClose: () => void;
  onDone: () => void;
}) {
  const w = moveWords(move, facts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = tournamentToday();
  const reopening = move === 'reopenRegistration';
  // The field starts as the close date when it is still ahead, blank when it has passed (copy §5.4).
  const stored = facts.registrationCloseAt?.slice(0, 10) ?? '';
  const [until, setUntil] = useState(stored && stored >= today ? stored : '');

  async function go() {
    if (reopening && !until) { setError('Pick the day the form should close.'); return; }
    if (reopening && until < today) { setError('Pick a day that hasn’t passed.'); return; }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = reopening
        // The close date is the last day families can sign up: the form runs to the end of it (stored as typed).
        ? { ...(status === MOVE_TO[move] ? {} : { status: MOVE_TO[move] }), registrationCloseAt: `${until}T23:59:00Z` }
        : { status: MOVE_TO[move] };
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'That didn’t go through. Try again.'); return; }
      onDone();
    } catch {
      setError('That didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      ariaLabel={w.title}
      title={<><span className={s.deskOnly}>{w.title}</span><span className={s.phoneOnly}>{w.phoneTitle}</span></>}
      onClose={onClose}
      busy={busy}
      footerStart={<span className={repKit.footNote}>{w.foot}</span>}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={go} disabled={busy}>{busy ? w.busy : w.button}</button>
        </>
      }
    >
      <p className={`${s.phoneOnly} ${s.windowName}`}>{facts.seasonName}</p>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <p className={s.windowLead}>{w.lead}</p>
      {reopening && (
        <label className={ck.field}>
          <span className={ck.label}>Close date<span className={repKit.req} aria-hidden>*</span></span>
          <DateInput className={ck.input} value={until} min={today} onChange={setUntil} />
          <span className={ck.hint}>The last day families can sign up.</span>
        </label>
      )}
      <ul className={s.windowChanges}>{w.changes.map(c => <li key={c}>{c}</li>)}</ul>
      {w.looseEnds.map(l => <p key={l} className={s.looseEnd}>{l}</p>)}
    </KitDialog>
  );
}
