'use client';
import { useState } from 'react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import DateInput from '@/components/shared/DateInput';
import DateTimeInput from '@/components/shared/DateTimeInput';
import { repKit } from './RepKit';
import type { LeagueCapKind } from '@/lib/free-floor';
import { OFFERED_SPORT_OPTIONS, DEFAULT_SPORT } from '@/lib/sports';

/**
 * Create a house-league season (Club Tier Stage 9a: the home on the kit). Create asks — an explicit Create, not autosave.
 * The fields are today's (what Create asks is S1·a, 9b-1's decision), minus the dead "Auto-generate fee entries" switch
 * (S1·b: stored by the route, read by nothing).
 */
type Form = {
  name: string; slug: string; sport: string; description: string;
  seasonStartDate: string; seasonEndDate: string; registrationOpenAt: string; registrationCloseAt: string;
  registrationFee: string; waiverText: string; autoApproveUnderCapacity: boolean; autoPromoteWaitlist: boolean;
};
const BLANK: Form = {
  name: '', slug: '', sport: DEFAULT_SPORT, description: '', seasonStartDate: '', seasonEndDate: '',
  registrationOpenAt: '', registrationCloseAt: '', registrationFee: '', waiverText: '',
  autoApproveUnderCapacity: false, autoPromoteWaitlist: false,
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export default function CreateLeagueSeasonDialog({ orgSlug, onClose, onCreated, onCapHit }: {
  orgSlug: string;
  onClose: () => void;
  onCreated: (season: { id: string; name: string }) => void;
  onCapHit: (kind: LeagueCapKind) => void;
}) {
  const [form, setForm] = useState<Form>(BLANK);
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const ready = !!form.name.trim() && !!form.slug.trim();
  const dirty = JSON.stringify(form) !== JSON.stringify(BLANK);

  async function create() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          sport: form.sport || DEFAULT_SPORT,
          description: form.description.trim() || null,
          seasonStartDate: form.seasonStartDate || null,
          seasonEndDate: form.seasonEndDate || null,
          registrationOpenAt: form.registrationOpenAt ? `${form.registrationOpenAt}:00Z` : null,
          registrationCloseAt: form.registrationCloseAt ? `${form.registrationCloseAt}:00Z` : null,
          registrationFee: form.registrationFee ? parseFloat(form.registrationFee) : null,
          waiverText: form.waiverText.trim() || null,
          autoApproveUnderCapacity: form.autoApproveUnderCapacity,
          autoPromoteWaitlist: form.autoPromoteWaitlist,
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
      title="Create season"
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
        <span className={ck.label}>Season name<span className={repKit.req} aria-hidden>*</span></span>
        <input
          className={ck.input}
          value={form.name}
          maxLength={120}
          placeholder="e.g. U11 Summer 2025"
          onChange={e => {
            const name = e.target.value;
            setForm(f => ({ ...f, name, slug: slugEdited ? f.slug : slugify(name) }));
          }}
        />
      </label>
      <label className={ck.field}>
        <span className={ck.label}>Slug<span className={repKit.req} aria-hidden>*</span></span>
        <input
          className={ck.input}
          value={form.slug}
          onChange={e => { setSlugEdited(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }}
        />
        <span className={ck.hint}>Used in public URLs. Lowercase letters, numbers, and hyphens only.</span>
      </label>
      <div className={repKit.fieldGrid}>
        <label className={ck.field}>
          <span className={ck.label}>Sport</span>
          <select className={ck.select} value={form.sport} onChange={e => set('sport', e.target.value)}>
            {OFFERED_SPORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Season start</span>
          <DateInput className={ck.input} value={form.seasonStartDate} onChange={v => set('seasonStartDate', v)} />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Season end</span>
          <DateInput className={ck.input} value={form.seasonEndDate} min={form.seasonStartDate || undefined} rangeStart={form.seasonStartDate || undefined} onChange={v => set('seasonEndDate', v)} />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Registration opens</span>
          <DateTimeInput className={ck.input} value={form.registrationOpenAt} onChange={v => set('registrationOpenAt', v)} />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Registration closes</span>
          <DateTimeInput className={ck.input} value={form.registrationCloseAt} min={form.registrationOpenAt || undefined} onChange={v => set('registrationCloseAt', v)} />
        </label>
      </div>
      <label className={ck.field}>
        <span className={ck.label}>Registration fee (CAD)</span>
        <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={form.registrationFee} placeholder="e.g. 150.00 (display-only; fees are not collected here)" onChange={e => set('registrationFee', e.target.value)} />
      </label>
      <label className={ck.field}>
        <span className={ck.label}>Description</span>
        <textarea className={ck.textarea} rows={3} value={form.description} placeholder="Optional description shown on the public registration page" onChange={e => set('description', e.target.value)} />
      </label>
      <label className={ck.field}>
        <span className={ck.label}>Waiver text</span>
        <textarea className={ck.textarea} rows={3} value={form.waiverText} placeholder="Optional waiver shown on the public registration form" onChange={e => set('waiverText', e.target.value)} />
      </label>
      <label className={repKit.carryRow}>
        <input type="checkbox" checked={form.autoApproveUnderCapacity} onChange={e => set('autoApproveUnderCapacity', e.target.checked)} />
        <span className={repKit.carryText}><b>Auto-approve registrations</b><span className={repKit.carryNote}>Automatically approve submissions while a division has open spots. New registrations go directly to Active status without manual review.</span></span>
      </label>
      <label className={repKit.carryRow}>
        <input type="checkbox" checked={form.autoPromoteWaitlist} onChange={e => set('autoPromoteWaitlist', e.target.checked)} />
        <span className={repKit.carryText}><b>Auto-promote from waitlist</b><span className={repKit.carryNote}>Automatically move the next waitlisted player to Active when a spot opens due to a withdrawal or decline.</span></span>
      </label>
    </KitDialog>
  );
}
