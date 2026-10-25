'use client';
import { Fragment, useState } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import ck from '../ClubKit.module.css';
import KitDialog from '../KitDialog';
import { ClubSection, SavePill, repKit } from '../RepKit';
import { BornYearsBoxes } from '../BornYears';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import { bornLine, checkBornYears, cutoffWords, isJan1, type Cutoff } from '@/lib/born-years';
import { dollarsLine } from '@/lib/house-league-season';
import { clubDay } from '@/lib/league-registration-state';
import { pluralize } from '@/lib/utils';
import type { LeagueSeason } from '@/lib/types';
import s from './LeagueSeason.module.css';

/** A division as the season page lists it. */
export type SeasonDivision = {
  id: string;
  name: string;
  capacity: number | null;
  bornFromYear: number | null;
  bornToYear: number | null;
  price: number | null;
  earlyPrice: number | null;
  note: string | null;
  /** Accepted. */
  activeCount: number;
  /** Accepted and received: what holds a spot (mig 362). */
  heldCount: number;
  waitlistCount: number;
  teamCount: number;
};

/**
 * THE SEASON'S DIVISIONS (Club Tier Stage 9b-1, Part 2; drawing §2–§3, words HOUSE_LEAGUE_STAGE9B1_COPY.md §2 and §4).
 * Division · Born in · Players · Price · Early bird, a pencil per row. "+ Add age groups" is the create door (it asks, in its
 * window). A division READS FIRST AND EDITS WHOLE: the pencil flips the whole row into its record, every field saves as
 * you go, ✓ flips it back (owner 2026-10-25, as drawn). "Remove this division…" ends the record's body, only while nobody
 * is in it. A price change applies to new sign-ups only: each registration keeps the price it recorded.
 */
export default function DivisionsBlock({ season, divisions, cutoff, canEdit, orgSlug, onChanged, onAdd }: {
  season: LeagueSeason;
  divisions: SeasonDivision[];
  cutoff: Cutoff;
  canEdit: boolean;
  orgSlug: string;
  onChanged: () => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const editing = canEdit ? open : null;
  const early = season.earlyBirdUntil ? clubDay(season.earlyBirdUntil) : null;
  const cols = canEdit ? 6 : 5;

  return (
    <ClubSection
      title="Divisions"
      actions={canEdit ? (
        <button type="button" className={`btn btn-outline ${ck.iconOnlyPhone}`} onClick={onAdd} aria-label="Add age groups">
          <Plus size={14} aria-hidden /><span className={ck.btnWord}>Add age groups</span>
        </button>
      ) : undefined}
    >
      {divisions.length === 0 ? (
        <div className={s.emptyBlock}>
          <p className={s.emptyTitle}>No age groups yet</p>
          <p className={s.emptyLine}>Add the age groups you run. Each becomes a division with its own birth years, size and price.</p>
          {canEdit && <button type="button" className="btn btn-lime" onClick={onAdd}>Add age groups</button>}
        </div>
      ) : (
        <>
          <div className={s.tableWrap}>
            <table className={ck.table}>
              <thead>
                <tr>
                  <th scope="col">Division</th>
                  <th scope="col">Born in</th>
                  <th scope="col">Players</th>
                  <th scope="col">Price</th>
                  <th scope="col">Early bird</th>
                  {canEdit && <th scope="col"><span className={repKit.srOnly}>Edit</span></th>}
                </tr>
              </thead>
              <tbody>
                {divisions.map(d => {
                  const born = bornLine({ from: d.bornFromYear, to: d.bornToYear }, cutoff)?.replace(/^Born /, '') ?? null;
                  const price = d.price ?? season.registrationFee;
                  const pct = d.capacity ? Math.min(100, Math.round((d.heldCount / d.capacity) * 100)) : 0;
                  const full = d.capacity != null && d.heldCount >= d.capacity;
                  if (editing === d.id) {
                    return (
                      <tr key={d.id} className={s.recordRow}>
                        <td colSpan={cols}>
                          <DivisionRecord division={d} season={season} siblings={divisions} cutoff={cutoff} orgSlug={orgSlug}
                            onChanged={onChanged} onDone={() => setOpen(null)} />
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <Fragment key={d.id}>
                      <tr>
                        <td data-label="Division">
                          <span className={ck.cellTitle}>{d.name}</span>
                          {d.note && <span className={s.cellNote}>{d.note}</span>}
                        </td>
                        <td data-label="Born in">{born ?? <span className={s.amberText}>Not set</span>}</td>
                        <td data-label="Players">
                          {d.capacity != null && (
                            <span className={s.meter} role="img" aria-label={`${d.heldCount} of ${pluralize(d.capacity, 'spot')} taken`}>
                              <span className={`${s.meterFill}${full ? ` ${s.meterFull}` : ''}`} style={{ width: `${pct}%` }} />
                            </span>
                          )}
                          {`${d.heldCount} / ${d.capacity ?? '—'}`}
                          {d.waitlistCount > 0 && <span className={s.cellNote}>{d.waitlistCount} on the waitlist</span>}
                        </td>
                        <td data-label="Price">{price != null ? dollarsLine(price) : <span className={s.amberText}>Not set</span>}</td>
                        <td data-label="Early bird">
                          {d.earlyPrice == null ? '—'
                            : early ? `${dollarsLine(d.earlyPrice)} through ${early}`
                            : <span className={s.amberText}>{dollarsLine(d.earlyPrice)}, needs a date</span>}
                        </td>
                        {canEdit && (
                          <td className={ck.actions}>
                            <button type="button" className={s.iconButton} onClick={() => setOpen(d.id)} aria-label={`Edit ${d.name}`}>
                              <Pencil size={15} aria-hidden />
                            </button>
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={s.blockHint}>A price change applies to new sign-ups only: each registration keeps the price it signed up at.</p>
        </>
      )}
    </ClubSection>
  );
}

/** Money as typed in a field: "" is no value; otherwise dollars, 0 or more, cents at most. */
function moneyValue(v: string): number | null | 'bad' {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? Math.round(n * 100) / 100 : 'bad';
}

function DivisionRecord({ division: d, season, siblings, cutoff, orgSlug, onChanged, onDone }: {
  division: SeasonDivision;
  season: LeagueSeason;
  siblings: SeasonDivision[];
  cutoff: Cutoff;
  orgSlug: string;
  onChanged: () => void;
  onDone: () => void;
}) {
  const q = useSaveQueue();
  const [draft, setDraft] = useState({
    name: d.name, capacity: d.capacity != null ? String(d.capacity) : '',
    from: d.bornFromYear != null ? String(d.bornFromYear) : '', to: d.bornToYear != null ? String(d.bornToYear) : '',
    price: d.price != null ? String(d.price) : '', earlyPrice: d.earlyPrice != null ? String(d.earlyPrice) : '', note: d.note ?? '',
  });
  const [refused, setRefused] = useState<string | null>(null);
  const [noLongerFit, setNoLongerFit] = useState(0);
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const base = `/api/admin/house-league/seasons/${season.id}/divisions/${d.id}?orgSlug=${encodeURIComponent(orgSlug)}`;

  const nameTaken = siblings.some(o => o.id !== d.id && o.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
  const born = checkBornYears(draft.from, draft.to, cutoff, new Date().getFullYear());
  const price = moneyValue(draft.price), earlyPrice = moneyValue(draft.earlyPrice);
  const sizeOk = /^\d+$/.test(draft.capacity.trim()) && parseInt(draft.capacity, 10) >= 1;
  const held = !draft.name.trim() ? 'Give the division a name.'
    : nameTaken ? 'Another division in this season has this name.'
    : !born.ok ? born.held
    : !sizeOk ? `Give ${draft.name.trim()} its number of players.`
    : price === 'bad' || earlyPrice === 'bad' ? 'Enter $0 or more.'
    : price != null && earlyPrice != null && earlyPrice > price ? 'The early-bird amount can’t be more than the price.'
    : null;

  const save = (patch: Record<string, unknown>) => {
    if (held) return;
    setRefused(null);
    void q.run(async () => {
      const res = await fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setRefused(data.error ?? null); throw new Error('save failed'); }
      if ('bornFromYear' in patch) setNoLongerFit(data.noLongerFit ?? 0);
      onChanged();
    }, 'Couldn’t save. Try again.');
  };
  const blurSave = (key: 'name' | 'capacity' | 'price' | 'earlyPrice' | 'note') => {
    if (held) return;
    if (key === 'name' && draft.name.trim() !== d.name) save({ name: draft.name.trim() });
    if (key === 'capacity' && parseInt(draft.capacity, 10) !== d.capacity) save({ capacity: parseInt(draft.capacity, 10) });
    if (key === 'price' && price !== 'bad' && price !== d.price) save({ price });
    if (key === 'earlyPrice' && earlyPrice !== 'bad' && earlyPrice !== d.earlyPrice) save({ earlyPrice });
    if (key === 'note' && (draft.note.trim() || null) !== d.note) save({ note: draft.note.trim() || null });
  };
  const bornSave = (from: string, to: string) => {
    const check = checkBornYears(from, to, cutoff, new Date().getFullYear());
    if (!check.ok) return;
    if (check.years.from === d.bornFromYear && check.years.to === d.bornToYear) return;
    save({ bornFromYear: check.years.from, bornToYear: check.years.to });
  };

  const empty = d.heldCount + d.waitlistCount === 0;
  async function remove() {
    setRemoving(true);
    try {
      const res = await fetch(base, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAsking(false); setRefused(data.error ?? 'This division has registrations, so it can’t be removed.'); return; }
      onDone();
      onChanged();
    } finally {
      setRemoving(false);
    }
  }

  const priceHint = d.price == null && season.registrationFee != null
    ? `The season’s price (${dollarsLine(season.registrationFee)}) unless you change it.`
    : 'A change applies to new sign-ups only.';
  const earlyHint = season.earlyBirdUntil
    ? `Through ${clubDay(season.earlyBirdUntil)}, the season’s early-bird date.`
    : 'Set the early-bird date under Registration first.';

  return (
    <div className={s.record}>
      <div className={s.recordHead}>
        <span className={s.recordTitle}>{d.name}</span>
        <button type="button" className={s.iconButton} onClick={() => !held && onDone()} aria-label="Done" disabled={!!held}>
          <Check size={16} aria-hidden />
        </button>
      </div>
      {refused && <p className={repKit.formError} role="alert">{refused}</p>}
      <div className={repKit.fieldGrid}>
        <label className={ck.field}>
          <span className={ck.label}>Name<span className={repKit.req} aria-hidden>*</span></span>
          <input className={ck.input} value={draft.name} maxLength={100}
            onChange={e => setDraft(x => ({ ...x, name: e.target.value }))} onBlur={() => blurSave('name')} />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Players<span className={repKit.req} aria-hidden>*</span></span>
          <input className={ck.input} type="number" min="1" step="1" inputMode="numeric" value={draft.capacity}
            onChange={e => setDraft(x => ({ ...x, capacity: e.target.value }))} onBlur={() => blurSave('capacity')} />
          <span className={ck.hint}>{pluralize(d.heldCount, 'child', 'children')} signed up. A lower number never removes anyone.</span>
        </label>
      </div>
      <div className={ck.field}>
        <span className={ck.label} id={`rec-${d.id}-born`}>Born in</span>
        <div role="group" aria-labelledby={`rec-${d.id}-born`}>
          <BornYearsBoxes from={draft.from} to={draft.to} cutoff={cutoff} held={!born.ok}
            onFrom={v => { setDraft(x => ({ ...x, from: v })); if (v.length === 4 || v === '') bornSave(v, draft.to); }}
            onTo={v => { setDraft(x => ({ ...x, to: v })); if (v.length === 4 || v === '') bornSave(draft.from, v); }} />
        </div>
        <span className={ck.hint}>
          {!isJan1(cutoff) && `Birthdays count from ${cutoffWords(cutoff, 'short')}. `}Changing the years never moves a child who is already registered.
        </span>
        {noLongerFit > 0 && (
          <span className={s.amberText}>
            {noLongerFit === 1 ? '1 registered child no longer fits these years.' : `${noLongerFit} registered children no longer fit these years.`} They stay where they are.
          </span>
        )}
      </div>
      <div className={repKit.fieldGrid}>
        <label className={ck.field}>
          <span className={ck.label}>Price</span>
          <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={draft.price}
            placeholder={season.registrationFee != null ? String(season.registrationFee) : undefined}
            onChange={e => setDraft(x => ({ ...x, price: e.target.value }))} onBlur={() => blurSave('price')} />
          <span className={ck.hint}>{priceHint}</span>
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Early bird</span>
          <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={draft.earlyPrice}
            onChange={e => setDraft(x => ({ ...x, earlyPrice: e.target.value }))} onBlur={() => blurSave('earlyPrice')} />
          <span className={ck.hint}>{earlyHint}</span>
        </label>
      </div>
      <label className={ck.field}>
        <span className={ck.label}>Note for families</span>
        <input className={ck.input} value={draft.note} maxLength={60} placeholder="Tuesday nights"
          onChange={e => setDraft(x => ({ ...x, note: e.target.value }))} onBlur={() => blurSave('note')} />
        <span className={ck.hint}>Shown on the sign-up form when a child fits more than one division.</span>
      </label>
      {empty && (
        <p className={s.rareDoor}>
          Nobody has signed up for it yet.{' '}
          <button type="button" className={repKit.inlineLink} onClick={() => setAsking(true)}>Remove this division…</button>
        </p>
      )}
      <SavePill saving={q.saving} dirty={!!held} error={q.error} held={held} onRetry={q.retry} />
      {asking && (
        <KitDialog
          kind="question"
          title={`Remove ${d.name}?`}
          onClose={() => setAsking(false)}
          busy={removing}
          footerStart={<span>You can add it again later.</span>}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={removing}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={remove} disabled={removing}>{removing ? 'Removing…' : 'Remove division'}</button>
            </>
          }
        >
          <p className={repKit.lead}>Nobody has signed up for it. Families will no longer see it on the sign-up form.</p>
        </KitDialog>
      )}
    </div>
  );
}
