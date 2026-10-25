'use client';
import { useCallback, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import ck from '../ClubKit.module.css';
import KitDialog from '../KitDialog';
import { ClubSection, RecordDelete, SavePill, repKit } from '../RepKit';
import { BornYearsBoxes } from '../BornYears';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { bornLine, checkBornYears, cutoffWords, isJan1, type Cutoff } from '@/lib/born-years';
import { dollarsLine } from '@/lib/house-league-season';
import { clubDay } from '@/lib/league-registration-state';
import { pluralize } from '@/lib/utils';
import type { LeagueSeason } from '@/lib/types';
import s from './LeagueSeason.module.css';
import fy from '../money/FiscalYear.module.css';

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
 * Division · Born in · Players · Price · Early bird; the whole row is the door. "+ Add age groups" is the create door (it
 * asks, in its window). A division is a RECORD WINDOW (owner 2026-10-25, reversing the build session's fold-in-place: a
 * row that opens a FORM opens a window — the table standard — and the table stays whole behind it): it reads first, the
 * head's pencil flips the whole record to its form, every field saves as you go, ✓ flips it back; Previous · Next step
 * through the divisions. "Remove this division" ends the body, only while nobody is in it. A price change applies to new
 * sign-ups only: each registration keeps the price it recorded.
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
  const openDivision = open ? divisions.find(d => d.id === open) ?? null : null;
  const early = season.earlyBirdUntil ? clubDay(season.earlyBirdUntil) : null;

  return (
    <ClubSection
      title="Divisions"
      actions={canEdit && divisions.length > 0 ? (
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
                  <th scope="col"><span className={repKit.srOnly}>Open</span></th>
                </tr>
              </thead>
              <tbody>
                {divisions.map(d => {
                  const born = bornLine({ from: d.bornFromYear, to: d.bornToYear }, cutoff)?.replace(/^Born /, '') ?? null;
                  const price = d.price ?? season.registrationFee;
                  const pct = d.capacity ? Math.min(100, Math.round((d.heldCount / d.capacity) * 100)) : 0;
                  const full = d.capacity != null && d.heldCount >= d.capacity;
                  return (
                    <tr key={d.id} className={s.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; setOpen(d.id); }}>
                      <td data-label="Division">
                        <button type="button" className={`${repKit.nameButton} ${ck.cellTitle}`} aria-haspopup="dialog"
                          onClick={e => { e.stopPropagation(); setOpen(d.id); }}>{d.name}</button>
                        {d.note && <span className={s.cellNote}>{d.note}</span>}
                      </td>
                      <td data-label="Born in">{born ?? <span className={s.amberText}>Not set</span>}</td>
                      <td data-label="Players">
                        {d.capacity != null && (
                          <span className={s.meter} role="img" aria-label={`${d.heldCount} of ${pluralize(d.capacity, 'spot')} taken`}>
                            <span className={`${s.meterFill}${full ? ` ${s.meterFull}` : ''}`} style={{ width: `${pct}%` }} />
                          </span>
                        )}
                        {`${d.heldCount} of ${d.capacity ?? '—'}`}
                        {d.waitlistCount > 0 && <span className={s.cellNote}>{d.waitlistCount} on the waitlist</span>}
                      </td>
                      <td data-label="Price">{price != null ? dollarsLine(price) : <span className={s.amberText}>Not set</span>}</td>
                      <td data-label="Early bird">
                        {d.earlyPrice == null ? '—'
                          : early ? `${dollarsLine(d.earlyPrice)} through ${early}`
                          : <span className={s.amberText}>{dollarsLine(d.earlyPrice)}, needs a date</span>}
                      </td>
                      <td className={ck.actions}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={s.blockHint}>A price change applies to new sign-ups only: each registration keeps the price it signed up at.</p>
        </>
      )}
      {openDivision && (
        <DivisionWindow division={openDivision} season={season} divisions={divisions} cutoff={cutoff} canEdit={canEdit}
          orgSlug={orgSlug} onOpen={setOpen} onChanged={onChanged} onClose={() => setOpen(null)} />
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

type Draft = { name: string; capacity: string; from: string; to: string; price: string; earlyPrice: string; note: string };

function draftOf(d: SeasonDivision): Draft {
  return {
    name: d.name, capacity: d.capacity != null ? String(d.capacity) : '',
    from: d.bornFromYear != null ? String(d.bornFromYear) : '', to: d.bornToYear != null ? String(d.bornToYear) : '',
    price: d.price != null ? String(d.price) : '', earlyPrice: d.earlyPrice != null ? String(d.earlyPrice) : '', note: d.note ?? '',
  };
}

/** What a save sends: only the fields that differ from what was last saved, so the birth years (and the "no longer fit"
 *  count the route answers them with) travel only when they change. Called only while nothing is held. */
function changes(next: Draft, was: Draft, cutoff: Cutoff): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (next.name.trim() !== was.name.trim()) p.name = next.name.trim();
  if (parseInt(next.capacity, 10) !== parseInt(was.capacity, 10)) p.capacity = parseInt(next.capacity, 10);
  if (next.from.trim() !== was.from.trim() || next.to.trim() !== was.to.trim()) {
    const born = checkBornYears(next.from, next.to, cutoff, new Date().getFullYear());
    if (born.ok) { p.bornFromYear = born.years.from; p.bornToYear = born.years.to; }
  }
  if (moneyValue(next.price) !== moneyValue(was.price)) p.price = moneyValue(next.price);
  if (moneyValue(next.earlyPrice) !== moneyValue(was.earlyPrice)) p.earlyPrice = moneyValue(next.earlyPrice);
  if ((next.note.trim() || null) !== (was.note.trim() || null)) p.note = next.note.trim() || null;
  return p;
}

/**
 * One division's RECORD WINDOW — the venue's and the payee's shape. It reads first; the head's pencil turns the whole
 * record into its form and ✓ turns it back, saving what is pending first and staying while a value is held or the save
 * fails. Every field autosaves (~0.9s after the last change); a refused save holds the window ONCE with the reason in its
 * pill, and leaving again leaves it unsaved (the payee's rule — never a window that cannot be left). Remove ends the body,
 * red and asking first, only while nobody is in the division.
 */
function DivisionWindow({ division: d, season, divisions, cutoff, canEdit, orgSlug, onOpen, onChanged, onClose }: {
  division: SeasonDivision;
  season: LeagueSeason;
  /** The season's divisions in the table's order — Previous · Next, and the name-taken check. */
  divisions: SeasonDivision[];
  cutoff: Cutoff;
  canEdit: boolean;
  orgSlug: string;
  onOpen: (id: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(d));
  const [saved, setSaved] = useState<Draft>(() => draftOf(d));
  const [seededFor, setSeededFor] = useState(d.id);
  const [refusedOnce, setRefusedOnce] = useState(false);
  const [noLongerFit, setNoLongerFit] = useState(0);
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  if (seededFor !== d.id) {
    setSeededFor(d.id);
    setEditing(false);
    setDraft(draftOf(d));
    setSaved(draftOf(d));
    setRefusedOnce(false);
    setNoLongerFit(0);
    setRemoveError(null);
  }
  // The page's re-read after a save is not awaited: until it lands the window reads (and the pencil opens on) what it last
  // wrote, and a re-read that brings different values (another admin) is taken while the window is reading.
  const dSig = JSON.stringify(draftOf(d));
  const [seenSig, setSeenSig] = useState(dSig);
  if (seenSig !== dSig) {
    setSeenSig(dSig);
    if (!editing) setSaved(draftOf(d));
  }
  const base = `/api/admin/house-league/seasons/${season.id}/divisions/${d.id}?orgSlug=${encodeURIComponent(orgSlug)}`;

  const nameTaken = divisions.some(o => o.id !== d.id && o.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
  const born = checkBornYears(draft.from, draft.to, cutoff, new Date().getFullYear());
  const price = moneyValue(draft.price), earlyPrice = moneyValue(draft.earlyPrice);
  const sizeOk = /^\d+$/.test(draft.capacity.trim()) && parseInt(draft.capacity, 10) >= 1;
  const held = !draft.name.trim() ? 'Give the division a name.'
    : nameTaken ? 'Another division in this season has this name.'
    : !born.ok ? born.held
    : !sizeOk ? `Give ${draft.name.trim()} its number of players.`
    : price === 'bad' || earlyPrice === 'bad' ? 'Enter $0 or more.'
    // Against the price the division charges: its own, else the season's (the route's rule).
    : earlyPrice != null && earlyPrice > (price ?? season.registrationFee ?? Infinity) ? 'The early-bird amount can’t be more than the price.'
    : null;
  const blocked = editing ? held : null;

  const write = useCallback(async (signal: AbortSignal) => {
    const patch = changes(draft, saved, cutoff);
    if (Object.keys(patch).length === 0) return;
    const res = await fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Couldn’t save. Try again.');
    if ('bornFromYear' in patch) setNoLongerFit(data.noLongerFit ?? 0);
    setSaved(draft);
    onChanged();
  }, [base, draft, saved, cutoff, onChanged]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canEdit && editing, loading: false, sig: JSON.stringify(draft), blocked, write, failText: 'Couldn’t save. Try again.',
  });
  const change = (next: Draft) => { setDraft(next); touch(); setRefusedOnce(false); setRemoveError(null); };

  const flush = async (): Promise<boolean> => {
    if (!editing || !dirty || blocked || refusedOnce) return true;
    if (await handleSave()) return true;
    setRefusedOnce(true);
    return false;
  };
  const leave = async (then: () => void) => { if (await flush()) { settle(); setRefusedOnce(false); then(); } };
  const toggleEdit = async () => {
    // The form opens on what is saved: the last write, or the page's re-read once it has landed.
    if (!editing) { setDraft(saved); setNoLongerFit(0); setEditing(true); return; }
    if (blocked) return;
    if (dirty && !(await handleSave())) return;
    setEditing(false);
  };

  const at = divisions.findIndex(o => o.id === d.id);
  const stepTo = (o: SeasonDivision | undefined) => (o ? { name: o.name, onStep: () => void leave(() => onOpen(o.id)) } : null);
  const steps = at >= 0 && divisions.length > 1
    ? { prev: stepTo(divisions[at - 1]), next: stepTo(divisions[at + 1]), position: `${at + 1} of ${divisions.length}`, noun: 'division' }
    : undefined;

  const empty = d.heldCount + d.waitlistCount === 0;
  async function remove() {
    setRemoving(true);
    try {
      const res = await fetch(base, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAsking(false); setRemoveError(data.error ?? 'This division has registrations, so it can’t be removed.'); return; }
      onClose();
      onChanged();
    } finally {
      setRemoving(false);
    }
  }

  // Reading shows SAVED values: the last write (see above), with the counts from the page.
  const money = (v: string) => { const m = moneyValue(v); return m === 'bad' ? null : m; };
  const shown = {
    name: saved.name.trim() || d.name,
    capacity: /^\d+$/.test(saved.capacity.trim()) ? parseInt(saved.capacity, 10) : null,
    price: money(saved.price), earlyPrice: money(saved.earlyPrice), note: saved.note.trim() || null,
  };
  const bornRead = bornLine({ from: saved.from.trim() ? Number(saved.from) : null, to: saved.to.trim() ? Number(saved.to) : null }, cutoff)
    ?.replace(/^Born /, '') ?? null;
  const readPrice = shown.price ?? season.registrationFee;
  const early = season.earlyBirdUntil ? clubDay(season.earlyBirdUntil) : null;
  const priceHint = shown.price == null && season.registrationFee != null
    ? `The season’s price (${dollarsLine(season.registrationFee)}) unless you change it.`
    : 'A change applies to new sign-ups only.';
  const earlyHint = early ? `Through ${early}, the season’s early-bird date.` : 'No early-bird date is set under Registration, so this amount never takes effect.';

  return (
    <>
      <KitDialog
        kind="form"
        size="medium"
        eyebrow={season.name}
        title={shown.name}
        onClose={() => void leave(onClose)}
        edit={canEdit ? { editing, onToggle: () => void toggleEdit(), label: `Edit ${shown.name}` } : undefined}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} /> : undefined}
        steps={steps}
        record
        levelKey={d.id}
      >
        {editing ? (
          <>
            <div className={repKit.fieldGrid}>
              <label className={ck.field}>
                <span className={ck.label}>Name<span className={repKit.req} aria-hidden>*</span></span>
                <input className={ck.input} value={draft.name} maxLength={100} onChange={e => change({ ...draft, name: e.target.value })} />
              </label>
              <label className={ck.field}>
                <span className={ck.label}>Players it holds<span className={repKit.req} aria-hidden>*</span></span>
                <input className={ck.input} type="number" min="1" step="1" inputMode="numeric" value={draft.capacity}
                  onChange={e => change({ ...draft, capacity: e.target.value })} />
                <span className={ck.hint}>{pluralize(d.heldCount, 'child', 'children')} signed up. A lower number never removes anyone.</span>
              </label>
            </div>
            <div className={ck.field}>
              <span className={ck.label} id={`rec-${d.id}-born`}>Born in</span>
              <div role="group" aria-labelledby={`rec-${d.id}-born`}>
                <BornYearsBoxes from={draft.from} to={draft.to} cutoff={cutoff} held={!born.ok}
                  onFrom={v => change({ ...draft, from: v })} onTo={v => change({ ...draft, to: v })} />
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
                  onChange={e => change({ ...draft, price: e.target.value })} />
                <span className={ck.hint}>{priceHint}</span>
              </label>
              <label className={ck.field}>
                <span className={ck.label}>Early bird</span>
                <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={draft.earlyPrice}
                  onChange={e => change({ ...draft, earlyPrice: e.target.value })} />
                <span className={ck.hint}>{earlyHint}</span>
              </label>
            </div>
            <label className={ck.field}>
              <span className={ck.label}>Note for families</span>
              <input className={ck.input} value={draft.note} maxLength={60} placeholder="Tuesday nights"
                onChange={e => change({ ...draft, note: e.target.value })} />
              <span className={ck.hint}>Shown on the sign-up form when a child fits more than one division.</span>
            </label>
          </>
        ) : (
          <dl className={fy.read}>
            <dt>Born in</dt>
            <dd>
              {bornRead ?? <span className={s.amberText}>Not set</span>}
              {bornRead && !isJan1(cutoff) && <span className={s.cellNote}>Birthdays count from {cutoffWords(cutoff, 'short')}</span>}
            </dd>
            <dt>Players it holds</dt>
            <dd>
              {shown.capacity ?? <span className={s.amberText}>Not set</span>}
              <span className={s.cellNote}>
                {pluralize(d.heldCount, 'child', 'children')} signed up{d.waitlistCount > 0 ? `, ${d.waitlistCount} on the waitlist` : ''}
              </span>
            </dd>
            <dt>Price</dt>
            <dd>
              {readPrice != null ? dollarsLine(readPrice) : <span className={s.amberText}>Not set</span>}
              {shown.price == null && readPrice != null && <span className={s.cellNote}>The season’s price</span>}
            </dd>
            <dt>Early bird</dt>
            <dd>
              {shown.earlyPrice == null ? '—'
                : early ? `${dollarsLine(shown.earlyPrice)} through ${early}`
                : <span className={s.amberText}>{dollarsLine(shown.earlyPrice)}, needs a date</span>}
            </dd>
            <dt>Note for families</dt>
            <dd>{shown.note ?? '—'}</dd>
          </dl>
        )}
        {/* ⚖ The record's door ends the body, never a foot row (owner, 2026-10-09): red, asking first, only while empty. */}
        {canEdit && empty && (
          <div className={s.recordEnd}>
            <RecordDelete onClick={() => void leave(() => setAsking(true))}>Remove this division</RecordDelete>
          </div>
        )}
        {removeError && <p className={repKit.formError} role="alert">{removeError}</p>}
      </KitDialog>
      {asking && (
        <KitDialog
          kind="question"
          title={`Remove ${shown.name}?`}
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
    </>
  );
}
