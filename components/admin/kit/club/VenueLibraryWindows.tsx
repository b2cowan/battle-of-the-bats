'use client';
/**
 * THE VENUE LIBRARY'S WINDOWS (Club Tier Stage 6b, Ask 9 — hub K4MPu4ni53Ct7yrDcmWJd9 v64, specimen 6; design log
 * 2026-10-09 (4)).
 *
 *   VenueWindow     — a venue READS FIRST and EDITS WHOLE (the 2026-10-01 record standard): Address (with Open in Maps),
 *                     Notes, Facilities (each with its kind and its upcoming bookings), Booked by this season. The head's
 *                     pencil turns the whole venue into its form — Name, Address, Notes, each facility's name and kind,
 *                     "＋ Add a facility" — saving as you go with the floating pill; ✓ turns it back. A facility a booking
 *                     holds says "In use" where its ✕ would be: renamed, never removed. A rename reaches the upcoming team
 *                     and house-league bookings that link it (the route's `carryWordsForward`); past ones keep their words.
 *   AddVenueWindow  — Add venue ASKS (create asks): the four things every "add a venue" asks — Name, Address, its
 *                     facilities, Notes (specimen 7's rule) — and nothing saves until its button is pressed.
 *   the questions   — Archive (the kit's question: who books it, what Archive does, that it comes back) and Delete
 *                     (red, only when nothing books it).
 *
 * ⚠ DEPARTURES FROM THE DRAWING, from the rulings made after it (said at build time, 2026-10-09):
 *   · NO "Done" in the foot — a record window's × (a phone's ←) closes it; the 2026-10-09 rulings took Close / Done out
 *     of every record window (the team's bill, Payees). The foot is Previous · Next through the list it was opened from
 *     (the 2026-09-30 ruling) and nothing else.
 *   · THE VENUE'S DOORS END THE BODY — Archive (anything books it), Bring back (archived), Delete (nothing books it: red,
 *     asking first). Delete's place is the 2026-09-30 / 2026-10-09 one for a record's Delete (the drawing put it in the
 *     foot); Archive and Bring back joined it on the owner's word, walking §288 W6 (2026-10-09): "does archive need to
 *     have a full pinned row above the footer?" — no: a rare door alone in a pinned row, the one the reader can't
 *     predict from what they see (booked → there, unbooked → the body's end). `RecordAction`, Delete's shape uncoloured.
 *   · An ARCHIVED venue reads, with Bring back; it has no pencil. Bring it back to change it.
 */
import { useCallback, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Plus, X } from 'lucide-react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import { RecordAction, RecordDelete, SavePill } from './RepKit';
import { FormError, TextField } from './money/MoneyKit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { getMapsUrl } from '@/components/LocationLink';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { FACILITY_TYPES, FACILITY_TYPE_LABELS } from '@/lib/types';
import {
  NO_USAGE, VENUE_LIBRARY_WORDS as W, archiveQuestion, deleteQuestion, duplicateFacilityName, seasonUseWords,
  tournamentUseWords, type LibraryVenue, type VenueUsage,
} from '@/lib/venue-library';
import { pluralize } from '@/lib/utils';
import own from './VenueLibrary.module.css';
// The club's record windows read their fields one way — quiet labels in plain case (the Payees window's list).
import fy from './money/FiscalYear.module.css';

type FacilityDraft = { key: string; id: string | null; name: string; facilityType: string };
type VenueDraft = { name: string; address: string; notes: string; facilities: FacilityDraft[] };

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

function draftOf(v: LibraryVenue): VenueDraft {
  return {
    name: v.name, address: v.address ?? '', notes: v.notes ?? '',
    facilities: [...v.facilities].sort((a, b) => a.displayOrder - b.displayOrder)
      .map(f => ({ key: f.id, id: f.id, name: f.name, facilityType: f.facilityType })),
  };
}

const kindWord = (k: string) => FACILITY_TYPE_LABELS[k as keyof typeof FACILITY_TYPE_LABELS] ?? 'Other';

/** Why the record's save is held right now, or null — the pill says it, nothing typed is lost. */
function heldReason(d: VenueDraft): string | null {
  if (!d.name.trim()) return W.nameHeld;
  if (d.facilities.some(f => f.id && !f.name.trim())) return W.facilityNameHeld;
  if (duplicateFacilityName(d.facilities.map(f => f.name))) return W.facilityTwiceHeld;
  return null;
}

/** One facility row in a form: its name, its kind, then "In use" (a booking holds it) or its ✕. */
function FacilityFields({ idPrefix, rows, onChange, inUse }: {
  idPrefix: string;
  rows: FacilityDraft[];
  onChange: (rows: FacilityDraft[]) => void;
  /** A facility a booking holds — renamed, never removed. */
  inUse: (f: FacilityDraft) => boolean;
}) {
  const set = (key: string, patch: Partial<FacilityDraft>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <>
      {rows.map((f, i) => (
        <div key={f.key} className={own.facEdit}>
          <input className={ck.input} aria-label={`Facility ${i + 1} name`} value={f.name} maxLength={60}
            placeholder="For example: Diamond 1" id={`${idPrefix}-fac-${i}`}
            onChange={e => set(f.key, { name: e.target.value })} />
          <select className={ck.select} aria-label={`Facility ${i + 1} kind`} value={f.facilityType}
            onChange={e => set(f.key, { facilityType: e.target.value })}>
            {FACILITY_TYPES.map(t => <option key={t} value={t}>{FACILITY_TYPE_LABELS[t]}</option>)}
          </select>
          {inUse(f)
            ? <span className={own.inUse}>{W.inUse}</span>
            : (
              <button type="button" className={own.facRemove} aria-label={`Remove ${f.name.trim() || `facility ${i + 1}`}`}
                onClick={() => onChange(rows.filter(r => r.key !== f.key))}>
                <X size={15} aria-hidden />
              </button>
            )}
        </div>
      ))}
      <button type="button" className={`btn btn-outline ${own.addFacility}`}
        onClick={() => onChange([...rows, { key: newKey(), id: null, name: '', facilityType: rows[rows.length - 1]?.facilityType ?? 'other' }])}>
        <Plus size={14} aria-hidden /> Add a facility
      </button>
    </>
  );
}

/** What books the venue this season, as the window's section reads it. */
function BookedBy({ usage }: { usage: VenueUsage }) {
  const lines = [
    ...(usage.teams.length ? [{ key: 'teams', lead: pluralize(usage.teams.length, 'team'), rest: usage.teams.join(', ') }] : []),
    ...usage.seasons.map(s => ({ key: `s-${s.id}`, lead: s.name, rest: seasonUseWords(s) })),
    ...usage.tournaments.map(t => ({ key: `t-${t.id}`, lead: t.name, rest: tournamentUseWords(t) })),
  ];
  if (!lines.length) return <p className={own.quiet}>{W.nothingThisSeason}</p>;
  return (
    <div className={own.uses}>
      {lines.map(l => <span key={l.key}><b>{l.lead}</b> <span className={own.usesRest}>· {l.rest}</span></span>)}
    </div>
  );
}

export function VenueWindow({ q, venue, usage, canSave, list, actionError, onOpen, onSaved, onArchive, onRestore, onDelete, onClose }: {
  q: string;
  venue: LibraryVenue;
  usage: VenueUsage | undefined;
  canSave: boolean;
  /** The list it was opened from (the active venues, or the archived ones) — its Previous · Next. */
  list: readonly LibraryVenue[];
  /** Why Bring back didn't go through — said under it, at the body's end. */
  actionError?: string;
  onOpen: (id: string) => void;
  /** A save landed: the venue as the server now holds it. */
  onSaved: (venue: LibraryVenue) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const u = usage ?? NO_USAGE;
  const archived = !venue.isActive;
  const canEdit = canSave && !archived;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VenueDraft>(() => draftOf(venue));
  const [seededFor, setSeededFor] = useState(venue.id);
  const [refusedOnce, setRefusedOnce] = useState(false);
  // A new facility row's server id once it is saved, by its row key — kept beside the draft so the save's answer never
  // changes what the record's signature reads (which would mark it dirty again). Never cleared: a stored row's key is
  // its own id and a new row's key is unique for the page's life, so two venues' rows can't meet in it.
  const savedIds = useRef(new Map<string, string>());
  if (seededFor !== venue.id) {
    setSeededFor(venue.id);
    setEditing(false);
    setDraft(draftOf(venue));
    setRefusedOnce(false);
  }

  const blocked = editing ? heldReason(draft) : null;
  const write = useCallback(async (signal: AbortSignal) => {
    const body = {
      action: 'update-venue', id: venue.id,
      data: {
        name: draft.name.trim(), address: draft.address.trim() || null, notes: draft.notes.trim() || null,
        facilities: draft.facilities.map(f => ({ id: f.id ?? savedIds.current.get(f.key) ?? null, key: f.key, name: f.name.trim(), facilityType: f.facilityType })),
      },
    };
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const res = await fetch(`/api/admin/org/venues?${q}`, { ...jsonInit('POST', body), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
    for (const [key, id] of Object.entries((data as { created?: Record<string, string> }).created ?? {})) savedIds.current.set(key, id);
    if ((data as { venue?: LibraryVenue }).venue) onSaved((data as { venue: LibraryVenue }).venue);
  }, [venue.id, draft, q, onSaved]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canEdit && editing, loading: false, sig: JSON.stringify(draft), blocked, write, failText: 'Couldn’t save',
  });
  // Any edit lifts the once-only hold a refused save put on leaving (the payee's rule): the next leave saves again.
  const change = (next: VenueDraft) => { setDraft(next); touch(); setRefusedOnce(false); };

  /* A refused save (a facility a booking now holds, a name taken) holds the window ONCE with the reason in its pill;
     leaving again leaves it unsaved — never a window that cannot be left (the autosave-close trap, Payees' rule). */
  const flush = async (): Promise<boolean> => {
    if (!editing || !dirty || blocked || refusedOnce) return true;
    if (await handleSave()) return true;
    setRefusedOnce(true);
    return false;
  };
  const leave = async (then: () => void) => { if (await flush()) { settle(); setRefusedOnce(false); then(); } };
  // ✓ saves what is pending and goes back to reading — and stays while a value is held or the save fails (the standard).
  const toggleEdit = async () => {
    if (!editing) { setEditing(true); return; }
    if (blocked) return;
    if (dirty && !(await handleSave())) return;
    setEditing(false);
    // Read the venue as it is now saved: new facilities carry their real ids from here on.
    setSeededFor('');
  };

  const at = list.findIndex(v => v.id === venue.id);
  const stepTo = (v: LibraryVenue | undefined) => (v ? { name: v.name, onStep: () => void leave(() => onOpen(v.id)) } : null);
  const steps = at >= 0 && list.length > 1
    ? { prev: stepTo(list[at - 1]), next: stepTo(list[at + 1]), position: `${at + 1} of ${list.length}`, noun: 'venue' }
    : undefined;
  const facilities = [...venue.facilities].sort((a, b) => a.displayOrder - b.displayOrder);
  const usageOf = (id: string | null) => (id ? u.facilities[id] : undefined);
  // The venue's way out of the library, in both modes: Bring back once archived, Archive while anything books it.
  const lifeDoor = !canSave ? null
    : archived ? <RecordAction icon={<ArchiveRestore size={13} aria-hidden />} onClick={() => void leave(onRestore)}>Bring back this venue</RecordAction>
    : u.anyBooking ? <RecordAction icon={<Archive size={13} aria-hidden />} onClick={() => void leave(onArchive)}>Archive this venue</RecordAction>
    : null;
  const canDelete = canSave && !u.anyBooking;

  return (
    <KitDialog
      kind="form"
      eyebrow={archived ? W.archivedEyebrow : 'Venue library'}
      title={venue.name}
      onClose={() => void leave(onClose)}
      edit={canEdit ? { editing, onToggle: () => void toggleEdit(), label: `Edit ${venue.name}` } : undefined}
      status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} /> : undefined}
      steps={steps}
      levelKey={venue.id}
    >
      {editing ? (
        <>
          <TextField id="venue-name" label="Name" required value={draft.name} maxLength={120} onChange={v => change({ ...draft, name: v })} />
          <TextField id="venue-address" label="Address" value={draft.address} maxLength={200} hint={W.addressHint}
            onChange={v => change({ ...draft, address: v })} />
          <label className={ck.field} htmlFor="venue-notes">
            <span className={ck.label}>Notes</span>
            <textarea id="venue-notes" className={ck.textarea} rows={2} maxLength={500} value={draft.notes}
              placeholder="Parking, gate access, washrooms…" onChange={e => change({ ...draft, notes: e.target.value })} />
          </label>
          <h3 className={own.sectionHead}>{W.facilitiesHeading}</h3>
          <FacilityFields idPrefix="venue" rows={draft.facilities} onChange={rows => change({ ...draft, facilities: rows })}
            inUse={f => !!usageOf(f.id)?.anyBooking} />
        </>
      ) : (
        <>
          <dl className={fy.read}>
            <dt>Address</dt>
            <dd>
              {venue.address ?? <span className={own.quiet}>No address</span>}
              {venue.address && <a className={own.maps} href={getMapsUrl(venue.address)} target="_blank" rel="noopener noreferrer">Open in Maps</a>}
            </dd>
            {venue.notes && <><dt>Notes</dt><dd>{venue.notes}</dd></>}
          </dl>
          <h3 className={own.sectionHead}>{W.facilitiesHeading}</h3>
          {facilities.length === 0 ? <p className={own.quiet}>{W.noFacilities}</p> : (
            <div className={own.facRows}>
              {facilities.map(f => {
                const n = usageOf(f.id)?.upcoming ?? 0;
                return (
                  <div key={f.id} className={own.facRow}>
                    <span>{f.name}</span>
                    <span className={own.facKind}>{kindWord(f.facilityType)}</span>
                    <span className={own.facUpcoming}>{n ? `${n} upcoming` : 'Nothing upcoming'}</span>
                  </div>
                );
              })}
            </div>
          )}
          <h3 className={own.sectionHead}>{W.bookedByHeading}</h3>
          <BookedBy usage={u} />
        </>
      )}
      {/* ⚖ The venue's doors end the body, never a foot row (owner, 2026-10-09): Archive / Bring back, and Delete — red,
          asking first — only when NOTHING books the venue (Ask 9). A refused Bring back says why under it. */}
      {(lifeDoor || canDelete) && (
        <div className={own.recordEnd}>
          {lifeDoor}
          {canDelete && <RecordDelete onClick={() => void leave(onDelete)}>Delete this venue</RecordDelete>}
        </div>
      )}
      {actionError && <FormError inPlace>{actionError}</FormError>}
    </KitDialog>
  );
}

/** Add venue — the four things, asked; nothing saves until "Add venue" is pressed. */
export function AddVenueWindow({ q, onClose, onAdded }: { q: string; onClose: () => void; onAdded: (venue: LibraryVenue) => void }) {
  const [draft, setDraft] = useState<VenueDraft>({ name: '', address: '', notes: '', facilities: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add() {
    if (busy) return;
    if (!draft.name.trim()) { setError('Give the venue a name.'); return; }
    const twice = duplicateFacilityName(draft.facilities.map(f => f.name));
    if (twice) { setError(`Two facilities can’t both be called “${twice}”.`); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch<{ venue?: LibraryVenue }>(`/api/admin/org/venues?${q}`, jsonInit('POST', {
        action: 'save-venue',
        data: {
          name: draft.name.trim(), address: draft.address.trim() || null, notes: draft.notes.trim() || null,
          facilities: draft.facilities.filter(f => f.name.trim()).map(f => ({ name: f.name.trim(), facilityType: f.facilityType })),
        },
      }));
      if (!r.ok || !r.data.venue) { setError(refusalText(r.data, 'The venue couldn’t be added. Please try again.')); return; }
      onAdded(r.data.venue);
    } catch {
      setError('The venue couldn’t be added. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="form"
      eyebrow="Venue library"
      title="Add venue"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void add()} disabled={busy}>{busy ? 'Adding…' : 'Add venue'}</button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <TextField id="new-venue-name" label="Name" required value={draft.name} maxLength={120} placeholder="For example: Lions Park"
        onChange={v => setDraft(d => ({ ...d, name: v }))} />
      <TextField id="new-venue-address" label="Address" value={draft.address} maxLength={200} hint={W.addressHint}
        onChange={v => setDraft(d => ({ ...d, address: v }))} />
      <h3 className={own.sectionHead}>{W.facilitiesHeading}</h3>
      <FacilityFields idPrefix="new-venue" rows={draft.facilities} onChange={rows => setDraft(d => ({ ...d, facilities: rows }))} inUse={() => false} />
      <label className={ck.field} htmlFor="new-venue-notes" style={{ marginTop: '1rem' }}>
        <span className={ck.label}>Notes</span>
        <textarea id="new-venue-notes" className={ck.textarea} rows={2} maxLength={500} value={draft.notes}
          placeholder="Parking, gate access, washrooms…" onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
      </label>
    </KitDialog>
  );
}

/** One of the venue's two questions, asked over its window: Archive (when anything books it) or Delete (when nothing does). */
export function VenueQuestion({ q, kind, venue, usage, onClose, onDone }: {
  q: string;
  kind: 'archive' | 'delete';
  venue: LibraryVenue;
  usage: VenueUsage | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const words = kind === 'archive' ? archiveQuestion(venue.name, usage ?? NO_USAGE) : null;
  const del = kind === 'delete' ? deleteQuestion(venue.name) : null;
  async function go() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/org/venues?${q}`, jsonInit('POST', { action: kind === 'archive' ? 'archive-venue' : 'delete-venue', id: venue.id }));
      if (!r.ok) { setError(refusalText(r.data, kind === 'archive' ? 'The venue couldn’t be archived. Please try again.' : 'The venue couldn’t be deleted. Please try again.')); return; }
      onDone();
    } catch {
      setError('That didn’t go through. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="question"
      title={words?.title ?? del!.title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={kind === 'delete' ? 'btn btn-danger' : 'btn btn-outline'} onClick={() => void go()} disabled={busy}>
            {kind === 'delete' ? (busy ? 'Deleting…' : 'Delete') : (busy ? 'Archiving…' : 'Archive')}
          </button>
        </>
      }
    >
      <FormError>{error}</FormError>
      {words ? (
        <>
          <p>{words.who}</p>
          <p className={ck.hint}>{words.what}</p>
        </>
      ) : <p className={ck.hint}>{del!.body}</p>}
    </KitDialog>
  );
}

