'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Check, MapPin, RefreshCw, RotateCcw, X } from 'lucide-react';
import { Venue } from '@/lib/types';
import { formatVenueLocation } from '@/lib/venue-label';
import type { LocationResolvePlan, TypedLocationGroup } from '@/lib/tournament-location-resolve';
import styles from '../schedule-admin.module.css';

/**
 * Phase 3 of "game location — one source of truth": the review screen for field names that were
 * typed by hand before Phase 2 made picking the default.
 *
 * The unit of work is a NAME, not a game — "Diamond 1" is one decision that moves 39 games. Every
 * row offers exactly three outcomes: confirm a real field, create the field the name describes, or
 * leave it as text. Nothing is suggested unless the name matches a field EXACTLY, and nothing is
 * applied without a click (plan §4, binding).
 *
 * Two things worth knowing before editing this file:
 *
 *  - **The Undo is session-scoped, by design** (owner decision 2026-08-10). Phases 1–3 add nothing
 *    to the database, so there is no audit table; the before-state comes back from the server in
 *    the apply response and lives in this component's state until the panel closes. The durable
 *    half of the story is the "already linked" list below: a wrong pick noticed tomorrow is fixed
 *    by re-pointing the whole group, which is why that list exists at all.
 *  - **"Leave as typed text" cannot be persisted** for the same reason, so a name deliberately
 *    left alone would re-raise the banner forever. The banner's dismissal (this browser, keyed to
 *    the exact set of names) is the honest substitute — a NEW typed name raises it again.
 */

/** Encoded `<select>` values. Prefixed so a venue/facility uuid can never collide with a verb. */
const CHOICE_NONE = '';
const CHOICE_TEXT = '__text__';
const CHOICE_CREATE_VENUE = '__create_venue__';
const CREATE_FACILITY_PREFIX = 'cf:';
const VENUE_PREFIX = 'v:';

type RevertGame = { id: string; venueId: string | null; venueFacilityId: string | null; location: string | null };

type AppliedEntry = {
  id: string;
  name: string;
  label: string | null;
  gameCount: number;
  before: RevertGame[];
  /** What the apply wrote — the server refuses to undo a game that no longer holds this. */
  expected: { venueId: string | null; venueFacilityId: string | null; location: string | null };
};

type ApplyResponse = {
  applied?: {
    source: { kind: string; token?: string; key?: string };
    gameCount: number;
    label: string | null;
    written: { venueId: string | null; venueFacilityId: string | null; location: string | null };
    before: RevertGame[];
  }[];
  /** Revert only. */
  reverted?: number;
  skipped?: number;
  error?: string;
};

/** What a row's current selection means — decoded once, used by both the request and the copy. */
type DecodedChoice =
  | { kind: 'none' }
  | { kind: 'text' }
  | { kind: 'field'; venueId?: string | null; venueFacilityId?: string | null }
  | { kind: 'create-facility'; venueId: string; name: string }
  | { kind: 'create-venue'; name: string };

function decodeChoice(choice: string, name: string): DecodedChoice {
  if (choice === CHOICE_NONE) return { kind: 'none' };
  if (choice === CHOICE_TEXT) return { kind: 'text' };
  if (choice === CHOICE_CREATE_VENUE) return { kind: 'create-venue', name };
  if (choice.startsWith(CREATE_FACILITY_PREFIX)) {
    return { kind: 'create-facility', venueId: choice.slice(CREATE_FACILITY_PREFIX.length), name };
  }
  if (choice.startsWith(VENUE_PREFIX)) {
    return { kind: 'field', venueId: choice.slice(VENUE_PREFIX.length), venueFacilityId: null };
  }
  return { kind: 'field', venueFacilityId: choice };
}

/**
 * The venue/facility `<optgroup>`s both selects need, in the encoding
 * `TournamentFieldPicker` established (`v:` for a venue, bare id for a surface). `extraPerVenue`
 * is how the typed-name select adds its per-venue "create it here" option without a second copy of
 * this loop.
 */
function venueOptionGroups(
  venues: Venue[],
  nounLower: string,
  extraPerVenue?: (venue: Venue) => React.ReactNode,
) {
  return venues.map(venue => (
    <optgroup key={venue.id} label={venue.name}>
      <option value={`${VENUE_PREFIX}${venue.id}`}>Any {nounLower} at {venue.name}</option>
      {(venue.facilities ?? []).map(facility => (
        <option key={facility.id} value={facility.id}>{facility.name}</option>
      ))}
      {extraPerVenue?.(venue)}
    </optgroup>
  ));
}

export default function ResolveLocationsModal({
  plan,
  venues,
  noun,
  orgSlug,
  tournamentId,
  onClose,
  onGamesChanged,
  onCreateVenue,
}: {
  plan: LocationResolvePlan;
  venues: Venue[];
  /** Sport-pack surface noun ("Diamond" / "Court" / "Rink") — never hard-coded. */
  noun: string;
  orgSlug: string;
  tournamentId: string;
  onClose: () => void;
  /**
   * The games behind this panel changed — reload them. The page derives the plan from its games,
   * so awaiting this is also how the rows above refresh; there is no second plan to keep in sync.
   */
  onGamesChanged: () => Promise<void> | void;
  onCreateVenue: () => void;
}) {
  const nounLower = noun.toLowerCase();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [linkedChoices, setLinkedChoices] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<AppliedEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';

  /** The default for a row: the exact match when there is one, otherwise nothing pre-picked. */
  const choiceFor = useCallback((group: TypedLocationGroup): string => {
    const explicit = choices[group.token];
    if (explicit !== undefined) return explicit;
    if (group.match === 'exact' && group.suggestion) {
      return group.suggestion.facilityId ?? `${VENUE_PREFIX}${group.suggestion.venueId}`;
    }
    return CHOICE_NONE;
  }, [choices]);

  const pendingCount = useMemo(
    () => plan.typedGroups.filter(group => {
      const choice = choiceFor(group);
      return choice !== CHOICE_NONE && choice !== CHOICE_TEXT;
    }).length,
    [plan.typedGroups, choiceFor],
  );

  const pendingGames = useMemo(
    () => plan.typedGroups.reduce((total, group) => {
      const choice = choiceFor(group);
      return choice !== CHOICE_NONE && choice !== CHOICE_TEXT ? total + group.gameCount : total;
    }, 0),
    [plan.typedGroups, choiceFor],
  );

  const linkedPendingCount = useMemo(
    () => Object.values(linkedChoices).filter(value => value !== CHOICE_NONE).length,
    [linkedChoices],
  );

  async function post(body: Record<string, unknown>): Promise<ApplyResponse | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/schedule-locations${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as ApplyResponse;
      // Reloading the games is what re-derives the rows above — await it so the panel never shows
      // a name as still pending after its games have already moved.
      //
      // Done on FAILURE too, deliberately. The server refuses a batch whose name has since been
      // resolved by someone else, and its message tells the admin to look at the current
      // locations — but without this refresh the rows would still be the stale ones, so the only
      // action the message suggests would resubmit the identical doomed request, forever.
      await onGamesChanged();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Nothing was changed.');
        return null;
      }
      return data;
    } catch {
      setError('Could not reach the server. Nothing was changed.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    const assignments: unknown[] = [];
    const names = new Map<string, string>();
    // Only the selections that actually go in this request may be forgotten afterwards. A row the
    // admin explicitly set to "Leave as typed text" is NOT submitted, so clearing it wholesale
    // would drop it back to its pre-filled exact-match suggestion — and the next Apply, made for
    // some unrelated row, would sweep in and convert a name the admin had twice declined to touch.
    const submittedTokens = new Set<string>();
    const submittedKeys = new Set<string>();

    for (const group of plan.typedGroups) {
      const target = decodeChoice(choiceFor(group), group.name);
      if (target.kind === 'none' || target.kind === 'text') continue;
      assignments.push({ source: { kind: 'text', token: group.token }, target });
      names.set(`text:${group.token}`, group.name);
      submittedTokens.add(group.token);
    }
    for (const group of plan.linkedGroups) {
      const target = decodeChoice(linkedChoices[group.key] ?? CHOICE_NONE, group.label);
      if (target.kind === 'none' || target.kind === 'text') continue;
      assignments.push({ source: { kind: 'field', key: group.key }, target });
      names.set(`field:${group.key}`, group.label);
      submittedKeys.add(group.key);
    }
    if (assignments.length === 0) return;

    const data = await post({ action: 'resolve', assignments });
    if (!data?.applied) return;

    setApplied(prev => [
      ...data.applied!.map(entry => {
        const sourceKey = entry.source.kind === 'text' ? `text:${entry.source.token}` : `field:${entry.source.key}`;
        return {
          // Unique per application, so an entry removed by Undo can never hand its React key to a
          // later one — the same name can be applied again after an undo.
          id: crypto.randomUUID(),
          name: names.get(sourceKey) ?? sourceKey,
          label: entry.label,
          gameCount: entry.gameCount,
          before: entry.before ?? [],
          expected: entry.written,
        };
      }),
      ...prev,
    ]);
    setChoices(prev => Object.fromEntries(Object.entries(prev).filter(([token]) => !submittedTokens.has(token))));
    setLinkedChoices(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => !submittedKeys.has(key))));
  }

  async function handleUndo(entry: AppliedEntry) {
    if (entry.before.length === 0) return;
    const data = await post({
      action: 'revert',
      games: entry.before,
      // What this apply wrote. The server leaves alone any game that no longer holds it, so an
      // undo cannot quietly wipe out an edit somebody else made in the meantime.
      expected: entry.expected,
    });
    if (!data) return;
    if (data.skipped) {
      setError(
        `Undone for ${data.reverted} ${data.reverted === 1 ? 'game' : 'games'}. `
        + `${data.skipped} ${data.skipped === 1 ? 'game was' : 'games were'} changed by someone else since, so ${data.skipped === 1 ? 'it was' : 'they were'} left alone.`,
      );
    }
    setApplied(prev => prev.filter(item => item.id !== entry.id));
  }

  const hasWork = plan.typedGroups.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className={styles.resolveLocationsTitle}>Match Typed Locations</h3>
          <button className="btn btn-ghost btn-data" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className={styles.resolveLocationsBody}>
          {hasWork ? (
            <p className={styles.resolveLocationsIntro}>
              {plan.typedGroups.length === 1 ? 'One location was' : `${plan.typedGroups.length} locations were`} typed
              by hand on this tournament&apos;s games. Match each one to a real {nounLower}, create it, or leave it as
              text. Nothing changes until you apply — and <strong>nobody is notified.</strong>
            </p>
          ) : (
            <div className={styles.resolveLocationsEmpty}>
              <MapPin size={18} />
              <strong className={styles.resolveLocationsEmptyTitle}>
                Every game is linked to a real {nounLower}
              </strong>
              <span>Nothing here needs matching.</span>
            </div>
          )}

          {applied.length > 0 && (
            <div className={styles.resolveLocationsGroup}>
              {applied.map(entry => (
                <div key={entry.id} className={`${styles.resolveLocationRow} ${styles.resolveLocationRowDone}`}>
                  <div className={styles.resolveLocationId}>
                    <strong className={styles.resolveLocationName}>{entry.name}</strong>
                    <span className={styles.resolveLocationCount}>
                      {entry.gameCount} {entry.gameCount === 1 ? 'game' : 'games'}
                    </span>
                    <span className={`${styles.resolveLocationChip} ${styles.resolveLocationChipOk}`}>
                      <Check size={10} /> Applied
                    </span>
                  </div>
                  <div className={styles.resolveLocationAct}>
                    <div className={styles.resolveLocationDoneLine}>
                      <span className={styles.resolveLocationWrites}>
                        Now <b>{entry.label}</b>
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline btn-data"
                        onClick={() => void handleUndo(entry)}
                        disabled={busy}
                      >
                        <RotateCcw size={12} /> Undo
                      </button>
                    </div>
                    <span className={styles.resolveLocationWrites}>
                      Undo puts the typed text back. Available until you close this panel.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasWork && (
            <div className={styles.resolveLocationsGroup}>
              {plan.typedGroups.map(group => {
                const choice = choiceFor(group);
                const isText = choice === CHOICE_TEXT;
                return (
                  <div
                    key={group.token}
                    className={`${styles.resolveLocationRow} ${isText ? styles.resolveLocationRowText : ''}`}
                  >
                    <div className={styles.resolveLocationId}>
                      <strong className={styles.resolveLocationName}>{group.name}</strong>
                      <span className={styles.resolveLocationCount}>
                        {group.gameCount} {group.gameCount === 1 ? 'game' : 'games'}
                        {group.completedCount === group.gameCount && group.gameCount > 0 ? ' · all completed' : ''}
                        {group.completedCount > 0 && group.completedCount < group.gameCount
                          ? ` · ${group.completedCount} completed`
                          : ''}
                      </span>
                      <MatchChip group={group} hasVenues={plan.hasVenues} nounLower={nounLower} />
                    </div>
                    <div className={styles.resolveLocationAct}>
                      <select
                        className={styles.formSelect}
                        value={choice}
                        disabled={busy}
                        aria-label={`What does "${group.name}" mean?`}
                        onChange={e => setChoices(prev => ({ ...prev, [group.token]: e.target.value }))}
                      >
                        <option value={CHOICE_NONE}>Choose what this means…</option>
                        {/* "Create it here" is withheld where this venue already has a surface by
                            this name — a second "Diamond 1" in one park would make the name
                            permanently ambiguous, the problem this screen exists to clear up. */}
                        {venueOptionGroups(venues, nounLower, venue =>
                          group.existingAtVenueIds.includes(venue.id) ? null : (
                            <option value={`${CREATE_FACILITY_PREFIX}${venue.id}`}>
                              + Create “{group.name}” at {venue.name}
                            </option>
                          ),
                        )}
                        <optgroup label="Other">
                          {!plan.hasVenues && (
                            <option value={CHOICE_CREATE_VENUE}>+ Create “{group.name}” as a venue</option>
                          )}
                          <option value={CHOICE_TEXT}>Leave as typed text</option>
                        </optgroup>
                      </select>
                      <ChoiceOutcome
                        decoded={decodeChoice(choice, group.name)}
                        group={group}
                        venues={venues}
                        nounLower={nounLower}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(plan.excluded.placeholderGames > 0 || plan.excluded.laneGames > 0) && (
            <div className={styles.resolveLocationsNote}>
              <b>Not shown here:</b>{' '}
              {plan.excluded.placeholderGames > 0 && (
                <>
                  {plan.excluded.placeholderGames} {plan.excluded.placeholderGames === 1 ? 'game is' : 'games are'} marked
                  TBD or similar — that names no {nounLower}, so there is nothing to match.
                </>
              )}
              {plan.excluded.placeholderGames > 0 && plan.excluded.laneGames > 0 ? ' ' : ''}
              {plan.excluded.laneGames > 0 && (
                <>
                  {plan.excluded.laneGames} {plan.excluded.laneGames === 1 ? 'game is' : 'games are'} still on a
                  temporary facility from the generator — use <b>Resolve Temporary Facilities</b> for those.
                </>
              )}
            </div>
          )}

          {plan.linkedGroups.length > 0 && (
            <>
              <div className={styles.resolveLocationsSectionLabel}>
                Already linked to a {nounLower}
              </div>
              <div className={styles.resolveLocationsGroup}>
                {plan.linkedGroups.map(group => (
                  <div key={group.key} className={styles.resolveLocationRow}>
                    <div className={styles.resolveLocationId}>
                      <strong className={styles.resolveLocationLinkedName}>{group.label}</strong>
                      <span className={styles.resolveLocationCount}>
                        {group.gameCount} {group.gameCount === 1 ? 'game' : 'games'}
                      </span>
                    </div>
                    <div className={styles.resolveLocationAct}>
                      <select
                        className={styles.formSelect}
                        value={linkedChoices[group.key] ?? CHOICE_NONE}
                        disabled={busy}
                        aria-label={`Move the ${group.gameCount} games at ${group.label}`}
                        onChange={e => setLinkedChoices(prev => ({ ...prev, [group.key]: e.target.value }))}
                      >
                        <option value={CHOICE_NONE}>Leave where they are</option>
                        {venueOptionGroups(venues, nounLower)}
                      </select>
                      {(linkedChoices[group.key] ?? CHOICE_NONE) !== CHOICE_NONE && (
                        <span className={styles.resolveLocationWrites}>
                          Moves all {group.gameCount} {group.gameCount === 1 ? 'game' : 'games'}.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!plan.hasVenues && hasWork && (
            <div className={styles.resolveLocationsNote}>
              This tournament has no venues set up, so there is nothing to match against yet.
              {' '}
              <button type="button" className="btn btn-ghost btn-data" onClick={onCreateVenue}>
                <MapPin size={12} /> Set up venues
              </button>
            </div>
          )}

          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className={styles.resolveLocationsCount}>
            {pendingCount + linkedPendingCount === 0
              ? 'No changes selected'
              : `${pendingCount + linkedPendingCount} ${pendingCount + linkedPendingCount === 1 ? 'change' : 'changes'}${pendingGames > 0 ? ` · ${pendingGames} ${pendingGames === 1 ? 'game' : 'games'}` : ''}`}
          </span>
          <div className={styles.resolveLocationsActions}>
            <button type="button" className="btn btn-ghost btn-data" onClick={onClose}>Close</button>
            <button
              type="button"
              className="btn btn-primary btn-data"
              onClick={() => void handleApply()}
              disabled={busy || pendingCount + linkedPendingCount === 0}
            >
              {busy ? <><RefreshCw className="spin" size={14} /> Applying…</> : <><Check size={14} /> Apply</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Says WHY a suggestion is or is not there, so a blank picker never reads as broken. */
function MatchChip({ group, hasVenues, nounLower }: { group: TypedLocationGroup; hasVenues: boolean; nounLower: string }) {
  if (group.match === 'exact') {
    return (
      <span className={`${styles.resolveLocationChip} ${styles.resolveLocationChipOk}`}>
        <Check size={10} /> Exact match
      </span>
    );
  }
  if (group.match === 'ambiguous') {
    return (
      <span className={`${styles.resolveLocationChip} ${styles.resolveLocationChipWarn}`}>
        {group.ambiguousTargets.length} possible matches
      </span>
    );
  }
  return (
    <span className={`${styles.resolveLocationChip} ${styles.resolveLocationChipWarn}`}>
      {hasVenues ? 'No match' : `No ${nounLower}s set up`}
    </span>
  );
}

/**
 * The exact result of the current choice, in words. The organizer never types the display string —
 * the server derives it — so without this line they would be applying an unseen result to N games.
 */
function ChoiceOutcome({
  decoded,
  group,
  venues,
  nounLower,
}: {
  decoded: DecodedChoice;
  group: TypedLocationGroup;
  venues: Venue[];
  nounLower: string;
}) {
  const line = (children: React.ReactNode) => (
    <span className={styles.resolveLocationWrites}>{children}</span>
  );
  const games = `${group.gameCount} ${group.gameCount === 1 ? 'game' : 'games'}`;

  switch (decoded.kind) {
    case 'text':
      return line(<>Unchanged. Still checked against other games typed “{group.name}”, but never against a real {nounLower}.</>);

    case 'create-venue':
      return line(<>Creates the venue <b>{group.name}</b> and points {games} at it.</>);

    case 'create-facility': {
      const venue = venues.find(item => item.id === decoded.venueId);
      return line(
        <>
          Creates <b>{group.name}</b> at {venue?.name ?? 'the venue'}, then games will read{' '}
          <b>{formatVenueLocation(venue?.name ?? '', group.name)}</b>
        </>,
      );
    }

    case 'field': {
      if (decoded.venueFacilityId) {
        for (const venue of venues) {
          const facility = (venue.facilities ?? []).find(item => item.id === decoded.venueFacilityId);
          if (facility) return line(<>Games will read <b>{formatVenueLocation(venue.name, facility.name)}</b></>);
        }
        return null;
      }
      const venue = venues.find(item => item.id === decoded.venueId);
      return venue ? line(<>Games will read <b>{venue.name}</b></>) : null;
    }

    // Nothing picked yet — say why there is no suggestion to accept.
    case 'none':
      if (group.match === 'ambiguous') {
        return line(<>This name matches more than one of your records. Pick which you meant.</>);
      }
      if (group.match === 'unmatched') {
        return line(<>Only exact names are suggested — a wrong guess would move real games to the wrong {nounLower}.</>);
      }
      return null;
  }
}
