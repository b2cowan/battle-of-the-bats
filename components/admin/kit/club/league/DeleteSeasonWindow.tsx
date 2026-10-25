'use client';
import { useState } from 'react';
import KitDialog from '../KitDialog';
import { repKit } from '../RepKit';
import { deleteSeasonWords } from '@/lib/house-league-status-words';
import s from './LeagueSeason.module.css';

/**
 * DELETE A SEASON THAT IS ONLY A SHELL (owner, 2026-10-25; words lib/house-league-status-words.ts `deleteSeasonWords`). The
 * server decides whether the season may go (not yet open, nothing real attached) and says so here when it refuses.
 * ⚠ ON SUCCESS THE WINDOW STAYS OPEN while the caller navigates: closing it first lets its Back step tidy its history
 * before the router has pushed, and that Back cancels the navigation (KitDialog's header). The page unmounts as it leaves.
 */
export default function DeleteSeasonWindow({ seasonId, seasonName, orgSlug, onClose, onDeleted }: {
  seasonId: string;
  seasonName: string;
  orgSlug: string;
  onClose: () => void;
  /** The season is gone: leave its page. Do NOT close the window first. */
  onDeleted: () => void;
}) {
  const w = deleteSeasonWords(seasonName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}?orgSlug=${encodeURIComponent(orgSlug)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'That didn’t go through. Try again.'); setBusy(false); return; }
      onDeleted();
    } catch {
      setError('That didn’t go through. Try again.');
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
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Keep it</button>
          <button type="button" className="btn btn-danger" onClick={go} disabled={busy}>{busy ? w.busy : w.button}</button>
        </>
      }
    >
      <p className={`${s.phoneOnly} ${s.windowName}`}>{seasonName}</p>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <p className={s.windowLead}>{w.lead}</p>
      <ul className={s.windowChanges}>{w.changes.map(c => <li key={c}>{c}</li>)}</ul>
    </KitDialog>
  );
}
