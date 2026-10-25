'use client';
import { useState } from 'react';
import KitDialog from '../KitDialog';
import { repKit } from '../RepKit';
import { MOVE_TO, moveWords, type MoveFacts, type StatusMove } from '@/lib/house-league-status-words';
import s from './LeagueSeason.module.css';

/**
 * ONE WINDOW FOR EVERY HOUSE-LEAGUE STATUS CHANGE (Club Tier Stage 9a, 9a·4; frame D; words lib/house-league-status-words.ts).
 * It says what changes for families, warns about loose ends in one amber sentence and never blocks, and its foot is the
 * sentence at the left and Cancel · the primary at the right. A form-kind window, so a phone gets the full screen with ←;
 * there the title is "{Verb} the season?" and the season's name leads the body. A refusal is said in the window.
 */
export default function SeasonStatusWindow({ move, seasonId, orgSlug, facts, onClose, onDone }: {
  move: StatusMove;
  seasonId: string;
  orgSlug: string;
  facts: MoveFacts;
  onClose: () => void;
  onDone: () => void;
}) {
  const w = moveWords(move, facts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: MOVE_TO[move] }),
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
      <ul className={s.windowChanges}>{w.changes.map(c => <li key={c}>{c}</li>)}</ul>
      {w.looseEnds.map(l => <p key={l} className={s.looseEnd}>{l}</p>)}
    </KitDialog>
  );
}
