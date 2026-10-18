'use client';
/**
 * A TOURNAMENT'S VENUE, AS A RECORD — Tournament admin redesign Stage 5 (E5, A51; F87), built to hub v45 in the shape of
 * the club's Venue library venue (Club Tier Stage 6b's VenueWindow), so a club admin sees one venue two ways, not two
 * designs. The kit's record window: full screen with ← on a phone, a window at a desk.
 *
 *   reads first   Address (Open in Maps) · Note · its diamonds, each with its games · the library line and its door
 *                 · the in-use rule said BEFORE any tap (a played game: renamed, never deleted) · Delete at the end
 *   the pencil    the venue AND its diamonds in one form — rename in place, add one, take one out (✕ absent on a
 *                 diamond with played games, which says "2 played" in its place); it saves as you go with the floating
 *                 pill; ✓ returns to reading. One line of address (the old edit split it into four and blanked three).
 *   foot          Previous · Next, in both modes.
 *
 * Every write reports its failure (the old per-diamond edits failed silently, F87). The route is the authority: a diamond
 * that gained a played game since the window opened is refused in words.
 */
import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { RecordDelete, SavePill } from '@/components/admin/kit/club/RepKit';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useRecordWindow } from '@/components/admin/tournament/useRecordWindow';
import { getMapsUrl } from '@/components/LocationLink';
import { facilityNoun } from '@/lib/venue-facilities';
import {
  VENUE_WORDS as W, addLane, deleteVenueQuestion, lanesHeading, noLanes,
} from '@/lib/tournament-venue-words';
import type { FacilityType } from '@/lib/types';
import styles from './VenueRecord.module.css';

export type RecordFacility = { id: string; name: string; displayOrder: number; gameCount?: number; playedGameCount?: number };
export type RecordVenue = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  sourceOrgVenueId: string | null;
  gameCount?: number;
  playedGameCount?: number;
  facilities?: RecordFacility[];
};

type LaneDraft = { key: string; id: string | null; name: string };
type Draft = { name: string; address: string; notes: string; lanes: LaneDraft[] };

let nextKey = 0;
const newKey = () => `lane-${++nextKey}`;

function draftOf(v: RecordVenue): Draft {
  return {
    name: v.name,
    address: v.address ?? '',
    notes: v.notes ?? '',
    lanes: [...(v.facilities ?? [])].sort((a, b) => a.displayOrder - b.displayOrder).map(f => ({ key: f.id, id: f.id, name: f.name })),
  };
}

export default function VenueRecord({
  venue, orgSlug, kind, canWrite, libraryHref, prev, next, position, onStep, onClose, onChanged,
}: {
  venue: RecordVenue;
  orgSlug: string;
  /** The sport's lane — the word for "diamond". */
  kind: FacilityType;
  /** This member may change venues (create_tournaments). */
  canWrite: boolean;
  /** The club's Venue library, for those who may open it (a plan with a library, an owner or admin); null otherwise. */
  libraryHref: string | null;
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  position: string;
  onStep: (id: string) => void;
  onClose: () => void;
  /** Re-reads the list (after a save, a delete); false when it didn't load. */
  onChanged: () => Promise<boolean>;
}) {
  const orgQuery = `?orgSlug=${encodeURIComponent(orgSlug)}`;
  const one = facilityNoun(kind, 1);
  const played = venue.playedGameCount ?? 0;
  const facilities = [...(venue.facilities ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const playedOf = (id: string | null) => (id ? facilities.find(f => f.id === id)?.playedGameCount ?? 0 : 0);
  const gamesOf = (id: string | null) => (id ? facilities.find(f => f.id === id)?.gameCount ?? 0 : 0);
  /** A lane with upcoming games asks before it goes (its games keep the venue, lose the lane). */
  const [takingOut, setTakingOut] = useState<LaneDraft | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(venue));
  const [seededFor, setSeededFor] = useState(venue.id);
  // A new lane's server id once saved, by its row key — beside the draft, so the save's answer never changes what the
  // record's signature reads (the library window's lesson).
  const savedIds = useRef(new Map<string, string>());
  const changed = useRef(false);

  const held = !editing ? null
    : !draft.name.trim() ? W.nameHeld
      : draft.lanes.some(l => !l.name.trim()) ? W.laneNameHeld(one)
        : new Set(draft.lanes.map(l => l.name.trim().toLowerCase())).size !== draft.lanes.length ? W.laneTwiceHeld(one)
          : null;

  const write = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`/api/admin/venues${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        action: 'update-venue', id: venue.id,
        data: {
          name: draft.name.trim(),
          address: draft.address.trim() || null,
          notes: draft.notes.trim() || null,
          facilities: draft.lanes.map(l => ({ id: l.id ?? savedIds.current.get(l.key) ?? null, key: l.key, name: l.name.trim() })),
        },
      }),
    });
    const data = await res.json().catch(() => null) as { error?: string; created?: Record<string, string> } | null;
    if (!res.ok) throw new Error(data?.error ?? W.saveFailed);
    for (const [key, id] of Object.entries(data?.created ?? {})) savedIds.current.set(key, id);
    changed.current = true;
  }, [venue.id, draft, orgQuery]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canWrite && editing, loading: false, sig: JSON.stringify(draft), blocked: held, write, failText: W.saveFailed,
  });
  // Leaving, stepping and ✓ (one rule for every record window): a held or refused edit holds the window once.
  const { resetRefused, leave, toggleEdit } = useRecordWindow({
    editing, setEditing, dirty, held, handleSave, settle, onChanged,
    consumeChanged: () => { const was = changed.current; changed.current = false; return was; },
    onAfterSave: reread => {
      if (reread) {
        // Read the venue as it is now saved: new lanes carry their real ids from here on.
        setSeededFor('');
      } else {
        // The list didn't re-read: keep what was saved (with the new lanes' ids), never the old list, so the next edit
        // can't send it back.
        setDraft(d => ({ ...d, lanes: d.lanes.map(l => (l.id ? l : { ...l, id: savedIds.current.get(l.key) ?? null })) }));
      }
    },
  });
  if (seededFor !== venue.id) {
    setSeededFor(venue.id);
    setEditing(false);
    setDraft(draftOf(venue));
    resetRefused();
    setTakingOut(null);
  }
  const change = (nextDraft: Draft) => { setDraft(nextDraft); touch(); resetRefused(); };

  // ── Delete: never with a played game (said before the tap); asks first, naming the games that lose their place ──
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askError, setAskError] = useState('');
  const question = deleteVenueQuestion(venue.name, Math.max(0, (venue.gameCount ?? 0) - played));
  async function doDelete() {
    setBusy(true);
    setAskError('');
    try {
      const res = await fetch(`/api/admin/venues${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-venue', id: venue.id }),
      });
      const data = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? 'Couldn’t delete it. Nothing was changed.');
      setAsking(false);
      await onChanged();
      onClose();
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Couldn’t delete it. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  const identity = [
    facilities.length ? `${facilities.length} ${facilityNoun(kind, facilities.length)}` : noLanes(kind),
    venue.gameCount ? W.games(venue.gameCount) : W.noGames,
  ].join(' · ');

  return (
    <>
      <KitDialog
        kind="form"
        size="medium"
        title={venue.name}
        identity={identity}
        onClose={() => void leave(onClose)}
        edit={canWrite ? { editing, onToggle: () => void toggleEdit(), label: W.edit(venue.name) } : undefined}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={held} onRetry={() => void handleSave()} /> : undefined}
        steps={{
          prev: prev ? { name: prev.name, onStep: () => void leave(() => onStep(prev.id)) } : null,
          next: next ? { name: next.name, onStep: () => void leave(() => onStep(next.id)) } : null,
          position,
          positionWide: position,
          noun: 'venue',
        }}
        levelKey={venue.id}
      >
        {editing ? (
          <>
            <TextField id="tvenue-name" label={W.name} required value={draft.name} maxLength={120} onChange={v => change({ ...draft, name: v })} />
            <TextField id="tvenue-address" label={W.address} value={draft.address} maxLength={200} hint={W.addressHint}
              onChange={v => change({ ...draft, address: v })} />
            <label className={ck.field} htmlFor="tvenue-notes">
              <span className={ck.label}>{W.note}</span>
              <textarea id="tvenue-notes" className={ck.textarea} rows={2} maxLength={500} value={draft.notes}
                placeholder={W.notePlaceholder} onChange={e => change({ ...draft, notes: e.target.value })} />
            </label>
            <h3 className={styles.sectionHead}>{lanesHeading(kind)}</h3>
            {draft.lanes.map((l, i) => {
              const n = playedOf(l.id);
              return (
                <div key={l.key} className={styles.laneEdit}>
                  <input className={ck.input} aria-label={W.laneName(i + 1)} value={l.name} maxLength={60}
                    onChange={e => change({ ...draft, lanes: draft.lanes.map(x => (x.key === l.key ? { ...x, name: e.target.value } : x)) })} />
                  {n > 0
                    ? <span className={styles.inUse}>{W.played(n)}</span>
                    : (
                      <button type="button" className={styles.remove} aria-label={W.remove(l.name.trim() || W.laneName(i + 1))}
                        aria-haspopup={gamesOf(l.id) > 0 ? 'dialog' : undefined}
                        onClick={() => (gamesOf(l.id) > 0
                          ? setTakingOut(l)
                          : change({ ...draft, lanes: draft.lanes.filter(x => x.key !== l.key) }))}>
                        <X size={15} aria-hidden />
                      </button>
                    )}
                </div>
              );
            })}
            <button type="button" className={`btn btn-outline ${styles.addLane}`}
              onClick={() => change({ ...draft, lanes: [...draft.lanes, { key: newKey(), id: null, name: `${one.charAt(0).toUpperCase()}${one.slice(1)} ${draft.lanes.length + 1}` }] })}>
              <Plus size={14} aria-hidden /> {addLane(kind)}
            </button>
          </>
        ) : (
          <>
            <dl className={screenParts.recordFacts}>
              <div>
                <dt>{W.address}</dt>
                <dd>
                  {venue.address ?? <span className={styles.quiet}>{W.noAddress}</span>}
                  {venue.address && <a className={styles.maps} href={getMapsUrl(venue.address)} target="_blank" rel="noopener noreferrer">{W.maps}</a>}
                </dd>
              </div>
              {venue.notes && <div><dt>{W.note}</dt><dd>{venue.notes}</dd></div>}
            </dl>
            <h3 className={styles.sectionHead}>{lanesHeading(kind)}</h3>
            {facilities.length === 0 ? <p className={styles.noLanes}>{noLanes(kind)}</p> : (
              <div className={styles.lanes}>
                {facilities.map(f => (
                  <div key={f.id} className={styles.lane}>
                    <span>{f.name}</span>
                    <span className={styles.laneGames}>{W.facilityGames(f.gameCount ?? 0, f.playedGameCount ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {venue.sourceOrgVenueId && (
          <RecordSection>
            <p className={screenParts.recordText}>{W.fromLibrary}</p>
            {libraryHref && <Link className={screenParts.door} href={libraryHref}>{W.openLibrary}</Link>}
          </RecordSection>
        )}
        {canWrite && (
          <RecordSection>
            {played > 0
              ? <p className={screenParts.recordBefore}>{W.inUse}</p>
              : <RecordDelete onClick={() => void leave(() => { setAskError(''); setAsking(true); })} disabled={busy}>{W.deleteVenue}</RecordDelete>}
          </RecordSection>
        )}
        {askError && !asking && <FormError inPlace>{askError}</FormError>}
      </KitDialog>

      {takingOut && (
        <KitDialog
          kind="question"
          raised
          title={W.takeOut(takingOut.name.trim() || one)}
          onClose={() => setTakingOut(null)}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setTakingOut(null)}>Keep it</button>
              <button type="button" className="btn btn-danger" onClick={() => {
                change({ ...draft, lanes: draft.lanes.filter(x => x.key !== takingOut.key) });
                setTakingOut(null);
              }}>{W.takeOutAction}</button>
            </>
          )}
        >
          <p>{W.takeOutBody(gamesOf(takingOut.id), draft.name.trim() || venue.name, one)}</p>
        </KitDialog>
      )}

      {asking && (
        <KitDialog
          kind="question"
          title={question.title}
          onClose={() => { if (!busy) setAsking(false); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Keep it</button>
              <button type="button" className="btn btn-danger" onClick={() => void doDelete()} disabled={busy}>{question.action}</button>
            </>
          )}
        >
          <p>{question.body}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}
    </>
  );
}
