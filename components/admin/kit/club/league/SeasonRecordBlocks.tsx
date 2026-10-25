'use client';
import { useState, type ReactNode } from 'react';
import { Check, Pencil } from 'lucide-react';
import ck from '../ClubKit.module.css';
import { ClubSection, SavePill, repKit } from '../RepKit';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import { feePerPlayerLine, registrationDay, seasonDates } from '@/lib/house-league-season';
import { formatStoredDate } from '@/lib/timezone';
import type { LeagueSeason } from '@/lib/types';
import s from './LeagueSeason.module.css';

/**
 * THE SEASON'S TWO RECORDS ON ITS PAGE (Club Tier Stage 9a, Part 4; frame B): Season (name, dates, description) and
 * Registration (its dates, fee, waiver, how new registrations are taken). Each READS first and EDITS WHOLE — one pencil in
 * the block's head flips every field into its form, ✓ in the same spot flips back — and an edit saves as you go (the
 * floating pill; a required field emptied is held, said, and not sent). Today's fields, minus the dead "Auto-generate fee
 * entries" switch (S1·b). Shown only to the people who run the league, on a live season (the gate's `run`); everyone
 * else reads them.
 */

type Patch = Record<string, unknown>;

function useSeasonSave(seasonId: string, orgSlug: string, onSaved: () => void) {
  const queue = useSaveQueue();
  const save = (patch: Patch) => queue.run(async () => {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}?orgSlug=${encodeURIComponent(orgSlug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('save failed');
    onSaved();
  }, 'Couldn’t save your change.');
  return { ...queue, save };
}

/** The head's one button: pencil while reading, ✓ in its exact spot while editing. */
function EditToggle({ editing, onClick, what }: { editing: boolean; onClick: () => void; what: string }) {
  return (
    <button type="button" className={s.iconButton} onClick={onClick} aria-label={editing ? `Done editing ${what}` : `Edit ${what}`} aria-pressed={editing}>
      {editing ? <Check size={16} aria-hidden /> : <Pencil size={15} aria-hidden />}
    </button>
  );
}

/** A read row: the fact's name, then the saved value. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (<><dt className={s.factLabel}>{label}</dt><dd className={s.factValue}>{children}</dd></>);
}

const local = (iso: string | null) => (iso ? iso.slice(0, 16) : '');
const stamp = (v: string) => (v ? `${v}:00Z` : null);

export function SeasonBlock({ season, canEdit, orgSlug, onSaved }: {
  season: LeagueSeason; canEdit: boolean; orgSlug: string; onSaved: () => void;
}) {
  // A block open for editing closes the moment its season can no longer be edited (finished, or the access changed).
  const [editOpen, setEditing] = useState(false);
  const editing = editOpen && canEdit;
  const [draft, setDraft] = useState({ name: '', division: '', description: '', seasonStartDate: '', seasonEndDate: '' });
  const q = useSeasonSave(season.id, orgSlug, onSaved);
  const held = editing && !draft.name.trim() ? 'Give the season a name to save it.' : null;

  const start = () => {
    setDraft({
      name: season.name, division: season.division ?? '', description: season.description ?? '',
      seasonStartDate: season.seasonStartDate ?? '', seasonEndDate: season.seasonEndDate ?? '',
    });
    setEditing(true);
  };
  const commit = (patch: Patch) => { if (!('name' in patch) || String(patch.name).trim()) void q.save(patch); };

  return (
    <ClubSection
      title="Season"
      actions={canEdit ? <EditToggle editing={editing} what="the season" onClick={() => (editing ? (!held && setEditing(false)) : start())} /> : undefined}
    >
      {!editing ? (
        <dl className={s.facts}>
          <Fact label="Name">{season.name}</Fact>
          <Fact label="Dates">{seasonDates(season) ?? 'Not set'}</Fact>
          {season.division && <Fact label="Division">{season.division}</Fact>}
          <Fact label="Description">{season.description || 'None'}</Fact>
        </dl>
      ) : (
        <>
          <label className={ck.field}>
            <span className={ck.label}>Name<span className={repKit.req} aria-hidden>*</span></span>
            <input className={ck.input} value={draft.name} maxLength={120}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              onBlur={() => draft.name.trim() !== season.name && commit({ name: draft.name.trim() })} />
          </label>
          <div className={repKit.fieldGrid}>
            <label className={ck.field}>
              <span className={ck.label}>Season start</span>
              <input className={ck.input} type="date" value={draft.seasonStartDate}
                onChange={e => setDraft(d => ({ ...d, seasonStartDate: e.target.value }))}
                onBlur={() => draft.seasonStartDate !== (season.seasonStartDate ?? '') && commit({ seasonStartDate: draft.seasonStartDate || null })} />
            </label>
            <label className={ck.field}>
              <span className={ck.label}>Season end</span>
              <input className={ck.input} type="date" value={draft.seasonEndDate}
                onChange={e => setDraft(d => ({ ...d, seasonEndDate: e.target.value }))}
                onBlur={() => draft.seasonEndDate !== (season.seasonEndDate ?? '') && commit({ seasonEndDate: draft.seasonEndDate || null })} />
            </label>
          </div>
          <label className={ck.field}>
            <span className={ck.label}>Division</span>
            <input className={ck.input} value={draft.division} maxLength={30} placeholder="e.g. U11, Adult"
              onChange={e => setDraft(d => ({ ...d, division: e.target.value }))}
              onBlur={() => draft.division.trim() !== (season.division ?? '') && commit({ division: draft.division.trim() || null })} />
          </label>
          <label className={ck.field}>
            <span className={ck.label}>Description</span>
            <textarea className={ck.textarea} rows={3} value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              onBlur={() => draft.description.trim() !== (season.description ?? '') && commit({ description: draft.description.trim() || null })} />
          </label>
        </>
      )}
      <SavePill saving={q.saving} dirty={!!held} error={q.error} held={held} onRetry={q.retry} />
    </ClubSection>
  );
}

/** How new registrations are taken, in one sentence (the drawn read line). */
function intakeLine(season: LeagueSeason): string {
  const take = season.autoApproveUnderCapacity ? 'Approved while a division has room' : 'Each one waits for your review';
  const wait = season.autoPromoteWaitlist ? 'the waitlist moves up on its own' : 'you move the waitlist up';
  return `${take}; ${wait}`;
}

function regDates(season: LeagueSeason): string {
  const o = season.registrationOpenAt, c = season.registrationCloseAt;
  if (!o && !c) return 'Not set';
  const parts = [o ? formatStoredDate(registrationDay(o)!, { withYear: !c }) : null, c ? formatStoredDate(registrationDay(c)!, { withYear: true }) : null].filter(Boolean);
  const where = season.status === 'registration_open' ? 'open' : season.status === 'draft' ? 'not open yet' : 'closed';
  return `${parts.join(' – ')} · ${where}`;
}

export function RegistrationBlock({ season, canEdit, orgSlug, onSaved, door }: {
  season: LeagueSeason; canEdit: boolean; orgSlug: string; onSaved: () => void;
  /** Close registration / Reopen registration, when the season offers one (9a·4: it sits on this block). */
  door?: ReactNode;
}) {
  // A block open for editing closes the moment its season can no longer be edited (finished, or the access changed).
  const [editOpen, setEditing] = useState(false);
  const editing = editOpen && canEdit;
  const [draft, setDraft] = useState({ registrationOpenAt: '', registrationCloseAt: '', registrationFee: '', waiverText: '' });
  const q = useSeasonSave(season.id, orgSlug, onSaved);
  const start = () => {
    setDraft({
      registrationOpenAt: local(season.registrationOpenAt), registrationCloseAt: local(season.registrationCloseAt),
      registrationFee: season.registrationFee != null ? String(season.registrationFee) : '', waiverText: season.waiverText ?? '',
    });
    setEditing(true);
  };
  const commit = (patch: Patch) => void q.save(patch);
  const waiver = season.waiverText?.trim();

  return (
    <ClubSection
      title="Registration"
      actions={(door || canEdit) ? (
        <>
          {door}
          {canEdit && <EditToggle editing={editing} what="registration" onClick={() => (editing ? setEditing(false) : start())} />}
        </>
      ) : undefined}
    >
      {!editing ? (
        <dl className={s.facts}>
          <Fact label="Dates">{regDates(season)}</Fact>
          <Fact label="Fee">{feePerPlayerLine(season.registrationFee) ?? 'Not set'}</Fact>
          <Fact label="Waiver">{waiver ? `On · “${waiver.length > 60 ? `${waiver.slice(0, 60).trimEnd()}…` : waiver}”` : 'Off'}</Fact>
          <Fact label="New registrations">{intakeLine(season)}</Fact>
        </dl>
      ) : (
        <>
          <div className={repKit.fieldGrid}>
            <label className={ck.field}>
              <span className={ck.label}>Registration opens</span>
              <input className={ck.input} type="datetime-local" value={draft.registrationOpenAt}
                onChange={e => setDraft(d => ({ ...d, registrationOpenAt: e.target.value }))}
                onBlur={() => draft.registrationOpenAt !== local(season.registrationOpenAt) && commit({ registrationOpenAt: stamp(draft.registrationOpenAt) })} />
            </label>
            <label className={ck.field}>
              <span className={ck.label}>Registration closes</span>
              <input className={ck.input} type="datetime-local" value={draft.registrationCloseAt}
                onChange={e => setDraft(d => ({ ...d, registrationCloseAt: e.target.value }))}
                onBlur={() => draft.registrationCloseAt !== local(season.registrationCloseAt) && commit({ registrationCloseAt: stamp(draft.registrationCloseAt) })} />
            </label>
          </div>
          <label className={ck.field}>
            <span className={ck.label}>Registration fee (CAD)</span>
            <input className={ck.input} type="number" min="0" step="0.01" inputMode="decimal" value={draft.registrationFee}
              onChange={e => setDraft(d => ({ ...d, registrationFee: e.target.value }))}
              onBlur={() => {
                const next = draft.registrationFee === '' ? null : parseFloat(draft.registrationFee);
                if (next !== season.registrationFee && (next == null || Number.isFinite(next))) commit({ registrationFee: next });
              }} />
          </label>
          <label className={ck.field}>
            <span className={ck.label}>Waiver text</span>
            <textarea className={ck.textarea} rows={4} value={draft.waiverText} placeholder="Optional waiver shown on the public registration form"
              onChange={e => setDraft(d => ({ ...d, waiverText: e.target.value }))}
              onBlur={() => draft.waiverText.trim() !== (season.waiverText ?? '') && commit({ waiverText: draft.waiverText.trim() || null })} />
          </label>
          <label className={repKit.carryRow}>
            <input type="checkbox" checked={season.autoApproveUnderCapacity} onChange={e => commit({ autoApproveUnderCapacity: e.target.checked })} />
            <span className={repKit.carryText}><b>Auto-approve under capacity</b><span className={repKit.carryNote}>New submissions go directly to Active status while a division has open spots.</span></span>
          </label>
          <label className={repKit.carryRow}>
            <input type="checkbox" checked={season.autoPromoteWaitlist} onChange={e => commit({ autoPromoteWaitlist: e.target.checked })} />
            <span className={repKit.carryText}><b>Auto-promote from waitlist</b><span className={repKit.carryNote}>Automatically advance the next waitlisted player when a spot opens.</span></span>
          </label>
        </>
      )}
      <SavePill saving={q.saving} dirty={false} error={q.error} onRetry={q.retry} />
    </ClubSection>
  );
}
