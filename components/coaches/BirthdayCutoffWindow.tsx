'use client';
/**
 * "When birthdays count from" for a Premium workspace (Settings in both workspaces Session 2, owner rulings A6 and C6,
 * 2026-11-20): one date for the team's sport, in a window built like the Name window — title, the line naming who can
 * change it, month and day, Cancel and a lime "Save date". The window is the confirmation, so it does not ask again (the
 * club's card asks because it changes on a pick).
 *
 * Saves through the club's own route (PATCH /api/admin/org-settings/birthday-cutoffs — owner only, the team's sport only),
 * whose gate opens for a standalone Premium workspace since A6. The portal already reads this date: next season's birth
 * years, the roster's born-year warnings, tryout decisions.
 */
import { useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CUTOFF_MONTHS, daysInCutoffMonth, type Cutoff } from '@/lib/born-years';
import { TEAM_ORGANIZATION_WORDS } from '@/lib/workspace-identity-words';

const W = TEAM_ORGANIZATION_WORDS.birthdayWindow;

export default function BirthdayCutoffWindow({ orgSlug, sport, sportName, current, onSaved, onClose }: {
  orgSlug: string;
  /** The team's sport id, as stored. */
  sport: string;
  /** The sport as a coach reads it ("Baseball"). */
  sportName: string;
  current: Cutoff;
  onSaved: (cutoff: Cutoff) => void;
  onClose: () => void;
}) {
  const [m, setM] = useState(current.m);
  const [d, setD] = useState(current.d);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = m !== current.m || d !== current.d;

  function pickMonth(next: number) {
    setM(next);
    setD(prev => Math.min(prev, daysInCutoffMonth(next)));
    setError('');
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/org-settings/birthday-cutoffs?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, cutoff: { m, d } }),
      });
      if (!res.ok) throw new Error();
      onSaved({ m, d });
    } catch {
      setError(W.failed);
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title={W.title}
      identity={W.identity(sportName)}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy || !changed}>{W.save}</button>
        </>
      )}
    >
      <div className={ck.field}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label className={ck.label} style={{ flex: '1 1 10rem' }}>
            {W.month}
            <select className={ck.select} value={m} disabled={busy} onChange={e => pickMonth(Number(e.target.value))}>
              {CUTOFF_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </select>
          </label>
          <label className={ck.label} style={{ flex: '0 1 6rem' }}>
            {W.day}
            <select className={ck.select} value={d} disabled={busy} onChange={e => { setD(Number(e.target.value)); setError(''); }}>
              {Array.from({ length: daysInCutoffMonth(m) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
        </div>
        <p className={ck.hint}>{W.hint}</p>
        {error && <p className={ck.hint} role="alert" style={{ color: 'var(--danger-light)' }}>{error}</p>}
      </div>
    </KitDialog>
  );
}
