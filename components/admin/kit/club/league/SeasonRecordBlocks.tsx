'use client';
import { useState, type ReactNode } from 'react';
import { Check, Pencil } from 'lucide-react';
import ck from '../ClubKit.module.css';
import DateInput from '@/components/shared/DateInput';
import DateTimeInput from '@/components/shared/DateTimeInput';
import { ClubSection, SavePill, repKit } from '../RepKit';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import { registrationDay, seasonDates } from '@/lib/house-league-season';
import { clubDay, registrationDatesRow } from '@/lib/league-registration-state';
import type { LeagueSeason } from '@/lib/types';
import s from './LeagueSeason.module.css';

/**
 * THE SEASON'S TWO RECORDS ON ITS PAGE (Club Tier Stage 9a, Part 4; frame B): Season (name, dates, description) and
 * Registration (its dates, early bird, waiver, email consent, how to pay, how new registrations are taken — 9b-1). Each READS first and EDITS WHOLE — one pencil in
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
  const [draft, setDraft] = useState({ name: '', description: '', seasonStartDate: '', seasonEndDate: '' });
  const q = useSeasonSave(season.id, orgSlug, onSaved);
  // A season can't end before it starts: the date that makes it so is held, said, and not sent.
  const datesBackwards = !!draft.seasonStartDate && !!draft.seasonEndDate && draft.seasonEndDate < draft.seasonStartDate;
  const held = !editing ? null
    : !draft.name.trim() ? 'Give the season a name to save it.'
    : datesBackwards ? 'The season can’t end before it starts. Change a date to save it.'
    : null;

  const start = () => {
    setDraft({
      name: season.name, description: season.description ?? '',
      seasonStartDate: season.seasonStartDate ?? '', seasonEndDate: season.seasonEndDate ?? '',
    });
    setEditing(true);
  };
  const commit = (patch: Patch) => {
    if ('name' in patch && !String(patch.name).trim()) return;
    const out = { ...patch };
    if ('seasonStartDate' in out || 'seasonEndDate' in out) {
      // A date refused for putting the pair backward stays typed in its box. It goes out with the date that fixes the pair,
      // or the form would read "saved" while the first date was never sent.
      if (!('seasonStartDate' in out) && draft.seasonStartDate !== (season.seasonStartDate ?? '')) out.seasonStartDate = draft.seasonStartDate || null;
      if (!('seasonEndDate' in out) && draft.seasonEndDate !== (season.seasonEndDate ?? '')) out.seasonEndDate = draft.seasonEndDate || null;
    }
    const from = 'seasonStartDate' in out ? out.seasonStartDate : draft.seasonStartDate;
    const to = 'seasonEndDate' in out ? out.seasonEndDate : draft.seasonEndDate;
    if (from && to && String(to) < String(from)) return;
    void q.save(out);
  };

  return (
    <ClubSection
      title="Season"
      actions={canEdit ? <EditToggle editing={editing} what="the season" onClick={() => (editing ? (!held && setEditing(false)) : start())} /> : undefined}
    >
      {!editing ? (
        <dl className={s.facts}>
          <Fact label="Name">{season.name}</Fact>
          <Fact label="Dates">{seasonDates(season) ?? 'Not set'}</Fact>
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
              <DateInput className={ck.input} value={draft.seasonStartDate}
                onChange={v => setDraft(d => ({ ...d, seasonStartDate: v }))}
                onBlur={() => draft.seasonStartDate !== (season.seasonStartDate ?? '') && commit({ seasonStartDate: draft.seasonStartDate || null })} />
            </label>
            <label className={ck.field}>
              <span className={ck.label}>Season end</span>
              <DateInput className={ck.input} value={draft.seasonEndDate} min={draft.seasonStartDate || undefined} rangeStart={draft.seasonStartDate || undefined}
                onChange={v => setDraft(d => ({ ...d, seasonEndDate: v }))}
                onBlur={() => draft.seasonEndDate !== (season.seasonEndDate ?? '') && commit({ seasonEndDate: draft.seasonEndDate || null })} />
            </label>
          </div>
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

/** A read row's quieter second line. */
function Sub({ children }: { children: ReactNode }) {
  return <span className={s.factSub}>{children}</span>;
}


const quoted = (v: string) => `“${v.length > 60 ? `${v.slice(0, 60).trimEnd()}…` : v}”`;

/**
 * HOW THE SEASON TAKES REGISTRATIONS (Club Tier Stage 9b-1, Part 2; drawing §2, words HOUSE_LEAGUE_STAGE9B1_COPY.md §5):
 * the form's dates, the one early-bird date (9b·2), the waiver, the email-consent line (always asked, unticked, beside the
 * waiver), how families pay (required whenever a price is above $0, 9b·9), how new registrations are taken and whether the
 * waitlist moves up on its own (the two switches that moved off Create, S1·a). Reads first, edits whole, saves as you go.
 * Prices live on the divisions now; a season's own price is only what a division with none of its own charges.
 */
export function RegistrationBlock({ season, canEdit, orgSlug, onSaved, door, charges, openSignal = 0 }: {
  season: LeagueSeason; canEdit: boolean; orgSlug: string; onSaved: () => void;
  /** Close registration / Reopen until…, when the season offers one (9a·4: it sits on this block). */
  door?: ReactNode;
  /** Does any price in the season sit above $0? Then how to pay is required. */
  charges: boolean;
  /** Bump to open the block for editing (the checklist's "Set dates" and "Add instructions"). */
  openSignal?: number;
}) {
  // A block open for editing closes the moment its season can no longer be edited (finished, or the access changed).
  const [editOpen, setEditing] = useState(false);
  const editing = editOpen && canEdit;
  const [draft, setDraft] = useState({ registrationOpenAt: '', registrationCloseAt: '', earlyBirdUntil: '', waiverText: '', howToPay: '' });
  const q = useSeasonSave(season.id, orgSlug, onSaved);
  // Registration can't close before it opens: the date that makes it so is held, said, and not sent.
  const windowBackwards = !!draft.registrationOpenAt && !!draft.registrationCloseAt && draft.registrationCloseAt < draft.registrationOpenAt;
  const payCleared = charges && season.status === 'registration_open' && !draft.howToPay.trim();
  const held = !editing ? null
    : windowBackwards ? 'The form can’t close before it opens. Change a date to save it.'
    : payCleared ? 'Registration is open and a division has a price, so how to pay can’t be empty.'
    : null;
  const start = () => {
    setDraft({
      registrationOpenAt: local(season.registrationOpenAt), registrationCloseAt: local(season.registrationCloseAt),
      earlyBirdUntil: season.earlyBirdUntil?.slice(0, 10) ?? '', waiverText: season.waiverText ?? '', howToPay: season.howToPay ?? '',
    });
    setEditing(true);
  };
  // The checklist's doors open this block (render-time, the house pattern for a prop that changes state).
  const [seenSignal, setSeenSignal] = useState(openSignal);
  if (openSignal !== seenSignal) {
    setSeenSignal(openSignal);
    if (canEdit && !editOpen) start();
  }
  const commit = (patch: Patch) => {
    const out = { ...patch };
    if ('registrationOpenAt' in out || 'registrationCloseAt' in out) {
      // As in the Season block: a date refused for putting the pair backward goes out with the date that fixes it.
      if (!('registrationOpenAt' in out) && draft.registrationOpenAt !== local(season.registrationOpenAt)) out.registrationOpenAt = stamp(draft.registrationOpenAt);
      if (!('registrationCloseAt' in out) && draft.registrationCloseAt !== local(season.registrationCloseAt)) out.registrationCloseAt = stamp(draft.registrationCloseAt);
    }
    const opens = 'registrationOpenAt' in out ? local(out.registrationOpenAt as string | null) : draft.registrationOpenAt;
    const closes = 'registrationCloseAt' in out ? local(out.registrationCloseAt as string | null) : draft.registrationCloseAt;
    if (opens && closes && closes < opens) return;
    if ('howToPay' in out && !out.howToPay && charges && season.status === 'registration_open') return;
    void q.save(out);
  };
  const waiver = season.waiverText?.trim();
  const pay = season.howToPay?.trim();
  const early = season.earlyBirdUntil?.slice(0, 10);
  // The dates run the form (Part 4): the row says what they are doing, and whether the date or you closed it.
  const dates = registrationDatesRow(season);
  const closesDay = registrationDay(season.registrationCloseAt);

  return (
    <ClubSection
      id="registration-block"
      title="Registration"
      actions={(door || canEdit) ? (
        <>
          {door}
          {canEdit && <EditToggle editing={editing} what="registration settings" onClick={() => (editing ? (!held && setEditing(false)) : start())} />}
        </>
      ) : undefined}
    >
      {!editing ? (
        <dl className={s.facts}>
          <Fact label="Registration dates">
            {dates.value}
            {dates.sub && <Sub>{dates.sub}</Sub>}
            {dates.door === 'set' && canEdit && <button type="button" className={repKit.inlineLink} onClick={start}>Set dates</button>}
          </Fact>
          <Fact label="Early bird">
            {early ? `Through ${clubDay(early)}.` : 'Not set.'}
            <Sub>{early ? 'The last day the early-bird price applies, in the club’s time.' : 'Set a date to offer an early-bird price.'}</Sub>
          </Fact>
          <Fact label="Waiver">{waiver ? `On · ${quoted(waiver)}` : <>None<Sub>Families sign up without one.</Sub></>}</Fact>
          <Fact label="Email consent">Asked on the form, unticked, beside the waiver.<Sub>Emails about a registration are sent either way.</Sub></Fact>
          <Fact label="How to pay">
            {!charges ? 'Not needed: this season is free.'
              : pay ? quoted(pay)
              : <span className={s.amberText}>Required before registration can open.</span>}
          </Fact>
          <Fact label="New registrations">
            {season.autoApproveUnderCapacity
              ? 'Approved while a division has room. A full division starts a waitlist.'
              : 'Held for your review. A child waiting for review holds a spot.'}
          </Fact>
          <Fact label="Waitlist">{season.autoPromoteWaitlist ? 'Moves up on its own when a spot frees.' : 'You move it up yourself.'}</Fact>
        </dl>
      ) : (
        <>
          <div className={repKit.fieldGrid}>
            <label className={ck.field}>
              <span className={ck.label}>Form opens</span>
              <DateTimeInput className={ck.input} value={draft.registrationOpenAt}
                onChange={v => setDraft(d => ({ ...d, registrationOpenAt: v }))}
                onBlur={() => draft.registrationOpenAt !== local(season.registrationOpenAt) && commit({ registrationOpenAt: stamp(draft.registrationOpenAt) })} />
            </label>
            <label className={ck.field}>
              <span className={ck.label}>Form closes</span>
              <DateTimeInput className={ck.input} value={draft.registrationCloseAt} min={draft.registrationOpenAt || undefined}
                onChange={v => setDraft(d => ({ ...d, registrationCloseAt: v }))}
                onBlur={() => draft.registrationCloseAt !== local(season.registrationCloseAt) && commit({ registrationCloseAt: stamp(draft.registrationCloseAt) })} />
            </label>
          </div>
          <label className={ck.field}>
            <span className={ck.label}>Early-bird date</span>
            <DateInput className={ck.input} value={draft.earlyBirdUntil}
              onChange={v => setDraft(d => ({ ...d, earlyBirdUntil: v }))}
              onBlur={() => draft.earlyBirdUntil !== (season.earlyBirdUntil?.slice(0, 10) ?? '') && commit({ earlyBirdUntil: draft.earlyBirdUntil || null })} />
            <span className={ck.hint}>The last day the early-bird price applies. Each division has its own early-bird amount.</span>
            {draft.earlyBirdUntil && closesDay && draft.earlyBirdUntil > closesDay && (
              <span className={s.amberText}>The early-bird date is after the form closes, so it never applies.</span>
            )}
          </label>
          <label className={ck.field}>
            <span className={ck.label}>Waiver text</span>
            <textarea className={ck.textarea} rows={4} value={draft.waiverText}
              onChange={e => setDraft(d => ({ ...d, waiverText: e.target.value }))}
              onBlur={() => draft.waiverText.trim() !== (season.waiverText ?? '') && commit({ waiverText: draft.waiverText.trim() || null })} />
            <span className={ck.hint}>Families tick a box to agree. Leave it empty if you don’t need one.</span>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>How families pay{charges && <span className={repKit.req} aria-hidden>*</span>}</span>
            <textarea className={ck.textarea} rows={3} value={draft.howToPay} maxLength={1000}
              onChange={e => setDraft(d => ({ ...d, howToPay: e.target.value }))}
              onBlur={() => draft.howToPay.trim() !== (season.howToPay ?? '') && commit({ howToPay: draft.howToPay.trim() || null })} />
            <span className={ck.hint}>Shown to families once a child is accepted, and in their email. For example: “e-Transfer to treasurer@yourclub.ca within 14 days of acceptance, with your child’s name in the message.”</span>
          </label>
          <label className={repKit.carryRow}>
            <input type="checkbox" checked={season.autoApproveUnderCapacity} onChange={e => commit({ autoApproveUnderCapacity: e.target.checked })} />
            <span className={repKit.carryText}><b>Approve new registrations while a division has room</b><span className={repKit.carryNote}>Off: every registration waits for your review, and a child waiting for review holds a spot.</span></span>
          </label>
          <label className={repKit.carryRow}>
            <input type="checkbox" checked={season.autoPromoteWaitlist} onChange={e => commit({ autoPromoteWaitlist: e.target.checked })} />
            <span className={repKit.carryText}><b>Move the waitlist up on its own</b><span className={repKit.carryNote}>When a spot frees, the first child waiting is accepted and emailed.</span></span>
          </label>
        </>
      )}
      <SavePill saving={q.saving} dirty={!!held} error={q.error} held={held} onRetry={q.retry} />
    </ClubSection>
  );
}
