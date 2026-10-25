'use client';
import { useState } from 'react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { RecordDelete, repKit } from '../RepKit';
import DivisionBornYears from '@/app/[orgSlug]/admin/house-league/seasons/[seasonId]/DivisionBornYears';
import { divisionBornState } from '@/lib/birthday-cutoff';
import type { Cutoff } from '@/lib/born-years';
import type { LeagueCapKind } from '@/lib/free-floor';

/** A division as the season page lists it. */
export type SeasonDivision = {
  id: string;
  name: string;
  capacity: number | null;
  bornFromYear: number | null;
  bornToYear: number | null;
  activeCount: number;
  waitlistCount: number;
  teamCount: number;
};

/**
 * Add or edit one of the season's divisions (Club Tier Stage 9a, Part 4: the windows on the kit; birth years 4c-2; prices
 * per division are 9b-1's). Create asks (Add division); an edit saves on Save, as the window always has. Delete is the
 * record's rare door at the end of its body, and asks first; the server refuses a division that has registrations.
 */
export default function DivisionWindow({ orgSlug, seasonId, division, cutoff, sport, onClose, onSaved, onCapHit }: {
  orgSlug: string;
  seasonId: string;
  /** null = Add division. */
  division: SeasonDivision | null;
  cutoff: Cutoff;
  sport: string;
  onClose: () => void;
  onSaved: () => void;
  onCapHit: (kind: LeagueCapKind) => void;
}) {
  const adding = division == null;
  const [name, setName] = useState(division?.name ?? '');
  const [spots, setSpots] = useState(division?.capacity != null ? String(division.capacity) : '');
  const [from, setFrom] = useState(division?.bornFromYear != null ? String(division.bornFromYear) : '');
  const [to, setTo] = useState(division?.bornToYear != null ? String(division.bornToYear) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  // Has a box changed since the window opened? An untouched stored pair is never sent back (divisionBornState).
  const touched = adding || from !== (division?.bornFromYear != null ? String(division.bornFromYear) : '')
    || to !== (division?.bornToYear != null ? String(division.bornToYear) : '');
  const born = divisionBornState(from, to, touched, cutoff, new Date().getFullYear());
  const dirty = adding ? !!(name || spots || from || to)
    : name !== division!.name || spots !== (division!.capacity != null ? String(division!.capacity) : '') || touched;
  const q = `?orgSlug=${encodeURIComponent(orgSlug)}`;

  async function save() {
    if (!name.trim() || born.blocks) return;
    setBusy(true);
    setError(null);
    try {
      const url = adding
        ? `/api/admin/house-league/seasons/${seasonId}/divisions${q}`
        : `/api/admin/house-league/seasons/${seasonId}/divisions/${division!.id}${q}`;
      const res = await fetch(url, {
        method: adding ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          capacity: spots ? parseInt(spots, 10) : null,
          ...(adding
            ? { bornFromYear: born.years?.from ?? null, bornToYear: born.years?.to ?? null }
            : touched && born.years ? { bornFromYear: born.years.from, bornToYear: born.years.to } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.capHit) { onCapHit(data.capHit); return; }
        setError(data.error ?? 'We couldn’t save the division. Try again.');
        return;
      }
      onSaved();
    } catch {
      setError('We couldn’t save the division. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!division) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/divisions/${division.id}${q}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAsking(false); setError(data.error ?? 'We couldn’t delete the division. Try again.'); return; }
      onSaved();
    } catch {
      setAsking(false);
      setError('We couldn’t delete the division. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <KitDialog
        kind="form"
        title={adding ? 'Add division' : 'Edit division'}
        onClose={onClose}
        busy={busy}
        dirty={dirty}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-lime" onClick={save} disabled={busy || !name.trim() || born.blocks}>
              {busy ? (adding ? 'Adding…' : 'Saving…') : (adding ? 'Add division' : 'Save')}
            </button>
          </>
        }
      >
        {error && <p className={repKit.formError} role="alert">{error}</p>}
        <label className={ck.field}>
          <span className={ck.label}>Division name<span className={repKit.req} aria-hidden>*</span></span>
          <input className={ck.input} value={name} maxLength={100} placeholder="e.g. Division A, East" onChange={e => setName(e.target.value)} />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Spots</span>
          <input className={ck.input} type="number" min="1" step="1" inputMode="numeric" value={spots} placeholder="Leave blank for no limit" onChange={e => setSpots(e.target.value)} />
          <span className={ck.hint}>The most players the division takes before a waitlist starts.</span>
        </label>
        <DivisionBornYears
          idPrefix={adding ? 'div' : 'ediv'}
          from={from}
          to={to}
          state={born}
          onChange={(f, t) => { setFrom(f); setTo(t); }}
          cutoff={cutoff}
          sportLabel={sport}
        />
        {!adding && <RecordDelete onClick={() => setAsking(true)} disabled={busy}>Delete this division</RecordDelete>}
      </KitDialog>
      {asking && division && (
        <KitDialog
          kind="question"
          raised
          title={`Delete ${division.name}?`}
          onClose={() => setAsking(false)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Keep it</button>
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
            </>
          }
        >
          <p className={repKit.lead}>This cannot be undone. A division with registrations can’t be deleted.</p>
        </KitDialog>
      )}
    </>
  );
}
