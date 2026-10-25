'use client';
import { useState } from 'react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import DateInput from '@/components/shared/DateInput';
import { repKit } from './RepKit';
import type { LeagueCapKind } from '@/lib/free-floor';
import { OFFERED_SPORT_OPTIONS, DEFAULT_SPORT } from '@/lib/sports';

/**
 * Create a house-league season (Club Tier Stage 9b-1, Part 2; S1·a; drawing §1, words HOUSE_LEAGUE_STAGE9B1_COPY.md §1).
 * Three answers — name, sport, dates — and an explicit Create (create asks). Everything else (age groups and prices, when
 * the form opens and closes, the waiver, how families pay, how new registrations are taken) is set on the season's own
 * page. Its web address is made from the name on the server (a name another season already uses is refused there).
 */
type Form = { name: string; sport: string; seasonStartDate: string; seasonEndDate: string };
const BLANK: Form = { name: '', sport: DEFAULT_SPORT, seasonStartDate: '', seasonEndDate: '' };

export default function CreateLeagueSeasonDialog({ orgSlug, onClose, onCreated, onCapHit }: {
  orgSlug: string;
  onClose: () => void;
  onCreated: (season: { id: string; name: string }) => void;
  onCapHit: (kind: LeagueCapKind) => void;
}) {
  const [form, setForm] = useState<Form>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const ready = !!form.name.trim();
  const dirty = JSON.stringify(form) !== JSON.stringify(BLANK);

  async function create() {
    if (!ready) return;
    // A date range runs forward; the picker's minimum is only a hint, so a typed date is checked here.
    if (form.seasonStartDate && form.seasonEndDate && form.seasonEndDate < form.seasonStartDate) {
      setError('The last day can’t be before the first day.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          sport: form.sport || DEFAULT_SPORT,
          seasonStartDate: form.seasonStartDate || null,
          seasonEndDate: form.seasonEndDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        if (data.capHit) { onCapHit(data.capHit); return; }
        setError(data.error ?? 'We couldn’t create the season. Try again.');
        return;
      }
      // ⚠ STAY BUSY once it is made: the caller opens the new season's page with this window still open (KitDialog's header),
      // and until the page leaves, a live Create button would send a second request and a live Cancel would cancel the move.
      onCreated({ id: data.id, name: data.name });
    } catch {
      setBusy(false);
      setError('We couldn’t create the season. Try again.');
    }
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      title="Create a house-league season"
      onClose={onClose}
      busy={busy}
      dirty={dirty}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={create} disabled={!ready || busy}>
            {busy ? 'Creating…' : 'Create season'}
          </button>
        </>
      }
    >
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <label className={ck.field}>
        <span className={ck.label}>Name<span className={repKit.req} aria-hidden>*</span></span>
        <input className={ck.input} value={form.name} maxLength={120} placeholder="Summer 2027" onChange={e => set('name', e.target.value)} />
      </label>
      <label className={ck.field}>
        <span className={ck.label}>Sport</span>
        <select className={ck.select} value={form.sport} onChange={e => set('sport', e.target.value)}>
          {OFFERED_SPORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <div className={ck.field}>
        <span className={ck.label} id="create-season-dates">Season dates</span>
        <div className={repKit.fieldGrid} role="group" aria-labelledby="create-season-dates">
          <DateInput className={ck.input} value={form.seasonStartDate} aria-label="First day of the season" onChange={v => set('seasonStartDate', v)} />
          <DateInput className={ck.input} value={form.seasonEndDate} aria-label="Last day of the season"
            min={form.seasonStartDate || undefined} rangeStart={form.seasonStartDate || undefined} onChange={v => set('seasonEndDate', v)} />
        </div>
      </div>
      <p className={ck.hint}>Next, on the season’s page: age groups and prices, when the form opens and closes, the waiver and how families pay. Its web address is made from the name.</p>
    </KitDialog>
  );
}
