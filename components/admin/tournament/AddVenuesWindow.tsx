'use client';
/**
 * ADD A VENUE — one window, two ways in (Tournament admin redesign Stage 5, E5, A51; hub v45). Import from Library and
 * Add Venue were two doors; now:
 *
 *   a club's plan (a Venue library — League Plus, Club, A5)   the library's venues first, ticked, each with its diamonds;
 *                                                            one already here is listed "Already in this tournament", so a
 *                                                            repeat import is never silent; then "A venue that isn't the
 *                                                            club's" (the four things, with a count)
 *   every other plan                                         "Your venues" — each venue past events used, once, with its
 *                                                            diamonds (the import-from-past route's first door); then
 *                                                            "A new venue". With no past venue at all, the four things.
 *
 * The same chooser as the New tournament window's venue step (VenueChooser) and the same New venue sheet. "Add 2
 * venues" adds each in turn; one that fails is named and the others stay added. ?import=library opens this window.
 */
import { useEffect, useMemo, useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import VenueChooser, { type ChooserVenue } from '@/components/admin/tournament/VenueChooser';
import NewVenueSheet, { type NewVenueDraft } from '@/components/admin/tournament/NewVenueSheet';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import type { OrgPlan } from '@/lib/types';
import { CREATE_WORDS as CW } from '@/lib/tournament-setup-words';
import { VENUE_WORDS as W } from '@/lib/tournament-venue-words';
import { dedupePastVenues, facilityKindForSport, type PastVenueRow } from '@/lib/venue-facilities';
// One park, whatever its spacing or case — the same rule the server's copy uses to skip a venue already here.
import { sameKey } from '@/lib/utils';

type Picked =
  | { kind: 'library'; orgVenueId: string; name: string }
  | { kind: 'past'; sourceVenueId: string; name: string }
  | { kind: 'new'; draft: NewVenueDraft; name: string };

type BookRow = { picked: Picked; row: ChooserVenue };

export default function AddVenuesWindow({
  orgSlug, planId, tournament, here, onClose, onAdded,
}: {
  orgSlug: string;
  planId: OrgPlan | null | undefined;
  tournament: { id: string; name: string; sport: string | null };
  /** The venues the tournament holds now (a library copy carries its link; a past one, its name). */
  here: ReadonlyArray<{ name: string; sourceOrgVenueId: string | null }>;
  onClose: () => void;
  /** Re-reads the list; the window then closes (or stays, naming what failed). */
  onAdded: () => Promise<void>;
}) {
  const kind = facilityKindForSport(tournament.sport);
  const library = hasOrgVenueLibrary(planId);
  const orgQuery = `?orgSlug=${encodeURIComponent(orgSlug)}`;
  const [book, setBook] = useState<BookRow[] | null>(null);
  const [bookFailed, setBookFailed] = useState(false);
  const [added, setAdded] = useState<BookRow[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<{ name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seq, setSeq] = useState(0);
  // Rows that went in while the window stayed open (some others failed): never offered twice.
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const read = library
      ? fetch(`/api/admin/org/venues${orgQuery}`).then(r => (r.ok ? r.json() : Promise.reject(new Error('library'))))
        .then((rows: Array<{ id: string; name: string; address: string | null; facilities?: { name: string }[] }>) => rows.map(v => ({
          picked: { kind: 'library' as const, orgVenueId: v.id, name: v.name },
          row: {
            key: `library:${v.id}`, name: v.name, address: v.address,
            caption: CW.libraryCaption((v.facilities ?? []).length, kind, v.address),
            alreadyHere: here.some(h => h.sourceOrgVenueId === v.id),
          },
        })))
      : fetch(`/api/admin/venues?scope=past&excludeTournamentId=${encodeURIComponent(tournament.id)}&orgSlug=${encodeURIComponent(orgSlug)}`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('past'))))
        .then((rows: Array<PastVenueRow & { facilities?: { name: string }[] }>) => dedupePastVenues(rows).map(v => ({
          picked: { kind: 'past' as const, sourceVenueId: v.id, name: v.name },
          row: {
            key: `past:${v.id}`, name: v.name, address: v.address,
            caption: CW.pastCaption((v.facilities ?? []).length, kind, v.sourceTournamentName),
            alreadyHere: here.some(h => sameKey(h.name) === sameKey(v.name)),
          },
        })));
    read
      .then(rows => {
        if (cancelled) return;
        setBook(rows);
        // Nothing to pick from (no library, no past venue): the four things straight away.
        if (!library && rows.length === 0) setSheet(s => s ?? { name: '' });
      })
      .catch(() => { if (!cancelled) { setBook([]); setBookFailed(true); } });
    return () => { cancelled = true; };
  // The window reads its book once, when it opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(
    () => (book ?? []).map(b => (done.has(b.row.key) ? { ...b.row, alreadyHere: true } : b.row)),
    [book, done],
  );
  const stillNew = added.filter(a => !done.has(a.row.key));
  const chosen = [...(book ?? []), ...stillNew].filter(b => ticked.has(b.row.key) && !b.row.alreadyHere && !done.has(b.row.key));
  const toggle = (key: string, checked: boolean) => setTicked(t => {
    const nextSet = new Set(t);
    if (checked) nextSet.add(key); else nextSet.delete(key);
    return nextSet;
  });

  function addNew(draft: NewVenueDraft) {
    const key = `new:${seq}`;
    setSeq(n => n + 1);
    setAdded(a => [...a, {
      picked: { kind: 'new', draft, name: draft.name },
      row: { key, name: draft.name, address: draft.address || null, caption: CW.newCaption(draft.count, draft.facilityType, draft.address || null) },
    }]);
    setTicked(t => new Set(t).add(key));
    setSheet(null);
  }

  async function addOne(p: Picked) {
    const body = p.kind === 'library'
      ? { action: 'import-from-org', data: { tournamentId: tournament.id, orgVenueId: p.orgVenueId } }
      : p.kind === 'past'
        ? { action: 'import-from-past', data: { tournamentId: tournament.id, sourceVenueId: p.sourceVenueId } }
        : {
          action: 'save-venue',
          data: {
            tournamentId: tournament.id, name: p.draft.name, address: p.draft.address || null, notes: p.draft.notes || null,
            count: p.draft.count, facilityType: p.draft.facilityType,
          },
        };
    const res = await fetch(`/api/admin/venues${orgQuery}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(p.name);
  }

  async function addAll(list: Array<{ key: string; picked: Picked }>) {
    if (busy || list.length === 0) return;
    setBusy(true);
    setError('');
    const failed: Array<{ key: string; name: string }> = [];
    const went: string[] = [];
    for (const { key, picked } of list) {
      try { await addOne(picked); went.push(key); } catch { failed.push({ key, name: picked.name }); }
    }
    await onAdded();
    setBusy(false);
    if (failed.length) {
      // The ones that went in are in the list now (and said so here); only the failures stay ticked, named.
      setDone(d => new Set([...d, ...went]));
      setTicked(new Set(failed.map(f => f.key)));
      setError(W.addFailed(failed.map(f => f.name).join(', ')));
      return;
    }
    onClose();
  }

  // No book to pick from: the four things are the window.
  if (sheet && !library && (book?.length ?? 0) === 0) {
    return (
      <NewVenueSheet
        defaultKind={kind}
        initialName={sheet.name}
        raised={false}
        busy={busy}
        error={error}
        onCancel={onClose}
        onAdd={draft => void addAll([{ key: 'new:only', picked: { kind: 'new', draft, name: draft.name } }])}
      />
    );
  }

  return (
    <>
      <KitDialog
        kind="form"
        title={W.add}
        identity={W.addIdentity(tournament.name)}
        onClose={() => { if (!busy) onClose(); }}
        busy={busy}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{CW.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => void addAll(chosen.map(c => ({ key: c.row.key, picked: c.picked })))} disabled={busy || chosen.length === 0}>
              {busy ? W.adding : W.addMany(chosen.length)}
            </button>
          </>
        )}
      >
        <FormError>{error}</FormError>
        {book === null ? <p className="sr-only" role="status">Loading…</p> : null}
        <VenueChooser
          idPrefix="add-venues"
          heading={library ? CW.library : CW.yourVenues}
          searchPlaceholder={library ? CW.searchLibrary : CW.searchYours}
          venues={rows}
          added={stillNew.map(a => a.row)}
          ticked={ticked}
          onToggle={toggle}
          newLabel={library ? CW.notTheClubs : CW.newVenue}
          newCaption={library ? CW.notTheClubsCaption : CW.newVenueCaption(kind)}
          onNew={typed => setSheet({ name: typed })}
          alreadyHereCaption={W.alreadyHere}
          noMatch={CW.noMatch}
          notice={bookFailed ? CW.venuesLoadFailed : undefined}
        />
      </KitDialog>
      {sheet && (
        <NewVenueSheet
          defaultKind={kind}
          initialName={sheet.name}
          identity={library ? CW.notTheClubsCaption : undefined}
          onCancel={() => setSheet(null)}
          onAdd={addNew}
        />
      )}
    </>
  );
}
