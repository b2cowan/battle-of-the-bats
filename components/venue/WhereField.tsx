'use client';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Ban, MapPin, Plus, Settings2 } from 'lucide-react';
import { claimEscape } from '@/components/coaches/escapeOwnership';
import { fieldNounFor, surfaceLabel } from '@/lib/sports';
import { matchPlace } from '@/lib/coach-places';
import {
  pickClubFacility, pickClubVenue, pickPlace, typeVenue, venueListGroups,
  type WhereValue,
} from '@/lib/where-field';
import { VENUE_SOURCE_PILL, venueSourceLine } from '@/lib/venue-clash-words';
import type { ClubVenueOption, RepTeamPlace } from '@/lib/types';
import pill from '@/components/shared/FilterPill.module.css';
import styles from './WhereField.module.css';

/**
 * ONE WAY TO SAY WHERE, ON EVERY FORM (Club Tier Stage 6a, Ask 13 with Asks 1–2, ratified 2026-10-08 — hub
 * K4MPu4ni53Ct7yrDcmWJd9 v64, specimens 1 and 7).
 *
 * Two fields, in this order, with these labels, everywhere an event's place is entered:
 *   **Venue** — a search box (type to find, by name or address). Its list is grouped: the program's venues first
 *     (the club's, read-only — a coach never edits the library), then a coach's own places ("Your places"), then
 *     whatever is typed, which saves as words and says it isn't checked. The foot rows are each program's own
 *     (a coach's "＋ Add … as a place" and "Manage places…"); the field only renders the rows its host passes.
 *   **The facility, under the sport's own word** (Diamond / Court / Field — `fieldNounFor`, never written in) —
 *     the picked club venue's facilities with "Not set" first, opening on the one this team used there last; for a
 *     typed venue or a coach's own place, a short typed box with the same label.
 * The address belongs to the venue and is never typed on an event: one quiet line under Venue says where the name
 * came from — a pill wearing the tag chips' dot ("● Club venue  41 Lions Park Dr"). On a 640px window the two sit
 * on one row (1.5fr / 1fr); on a phone they stack, Venue above. The clash line (amber), a refusal (red) or the
 * quiet "isn't checked" line sits under the row — the host decides which, because only it knows its program's
 * rule (`WhereLine`).
 *
 * The host passes its own label / input / select / hint classes, so the two controls look like the fields beside
 * them on that form; this component owns the shape, the list and the line.
 */

/** The source pill's dot — the tag chips' own: blue the club's, olive the team's own. A typed name is neither: no dot. */
const SOURCE_DOT = { club: pill.tagComboDotOrg, place: pill.tagComboDotOwn } as const;

export interface WhereFieldClasses {
  field?: string;
  label?: string;
  input?: string;
  select?: string;
  hint?: string;
}

export default function WhereField({
  idPrefix = 'where',
  sport,
  value,
  onChange,
  clubVenues,
  inClub,
  clubGroupLabel = 'Club venues',
  places,
  usualFacilityByVenue,
  onOpen,
  onAddPlace,
  onManagePlaces,
  classes = {},
  line,
  footHint,
  disabled = false,
  venueLabel = 'Venue',
  facilityLabel,
}: {
  idPrefix?: string;
  /** The program's sport — the facility's word. */
  sport: string | null | undefined;
  value: WhereValue;
  onChange: (next: WhereValue) => void;
  /** The program's venues — the club's. Empty outside a club. */
  clubVenues: readonly ClubVenueOption[];
  /** A club with a Venue library: the Club venues group, and the quiet lines, exist only here. */
  inClub: boolean;
  clubGroupLabel?: string;
  /** A coach's own place book; absent on a form that has none (house league, a tryout day). */
  places?: readonly RepTeamPlace[];
  /** The facility this team used last at each club venue — the dropdown's opening pick. */
  usualFacilityByVenue?: Record<string, string>;
  /** The host's chance to re-read its book when the list opens (the place book's rule). */
  onOpen?: () => void;
  /** "＋ Add “…” as a place" — the coach's add sheet, opened by the host. */
  onAddPlace?: (name: string) => void;
  /** "Manage places…" — the coach's manager, opened by the host. */
  onManagePlaces?: () => void;
  classes?: WhereFieldClasses;
  /** The line under the row (a `WhereLine`), or nothing. */
  line?: ReactNode;
  /** A program's own note under the field (house league's "Set up your diamonds once"). */
  footHint?: ReactNode;
  disabled?: boolean;
  venueLabel?: string;
  /** Overrides the sport's word (only for a form whose label is not the bare noun, e.g. "Default diamond"). */
  facilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const noun = fieldNounFor(sport);
  const facLabel = facilityLabel ?? noun;
  const q = value.location.trim();
  // While a picked venue's name sits in the box unchanged, the list offers everything again (the place book's rule).
  const query = value.source === 'club' || value.source === 'place' ? '' : q;
  const { venues, places: placeRows } = useMemo(
    () => venueListGroups({ inClub, clubVenues, places, query }),
    [inClub, clubVenues, places, query],
  );
  const exactPlace = places ? matchPlace(places, q) : null;
  const canAdd = !!onAddPlace && q.length > 0 && !exactPlace && value.source !== 'club';

  // One flat list for the arrow keys: venues, places, then the foot rows.
  type Opt = { kind: 'venue'; venue: ClubVenueOption } | { kind: 'place'; place: RepTeamPlace } | { kind: 'add' } | { kind: 'manage' };
  const opts: Opt[] = [
    ...venues.map(venue => ({ kind: 'venue' as const, venue })),
    ...placeRows.map(place => ({ kind: 'place' as const, place })),
    ...(canAdd ? [{ kind: 'add' as const }] : []),
    ...(onManagePlaces ? [{ kind: 'manage' as const }] : []),
  ];
  const hasList = opts.length > 0;

  const pickedVenue = value.source === 'club' && value.orgVenueId ? clubVenues.find(v => v.id === value.orgVenueId) ?? null : null;

  function openList() {
    const el = inputRef.current;
    if (el) {
      // Flip above the input inside a clipping box when there's no room below (the tag picker's hard-won rule).
      const rect = el.getBoundingClientRect();
      let top = 0, bottom = window.innerHeight;
      for (let n = el.parentElement; n; n = n.parentElement) {
        if (getComputedStyle(n).overflowY === 'visible') continue;
        const r = n.getBoundingClientRect();
        top = Math.max(top, r.top);
        bottom = Math.min(bottom, r.bottom);
      }
      setDropUp(bottom - rect.bottom < 260 && rect.top - top > 270);
    }
    if (!open) onOpen?.();
    setOpen(true);
  }
  function close() { setOpen(false); setActiveIdx(-1); }
  function choose(o: Opt) {
    if (o.kind === 'venue') onChange(pickClubVenue(o.venue, usualFacilityByVenue?.[o.venue.id] ?? null));
    else if (o.kind === 'place') onChange(pickPlace(value, o.place));
    else if (o.kind === 'add') onAddPlace?.(q);
    else onManagePlaces?.();
    close();
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openList();
      setActiveIdx(i => Math.min(i + 1, opts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      if (activeIdx >= 0 && opts[activeIdx]) choose(opts[activeIdx]);
      else close();
    } else if (e.key === 'Escape' && open) {
      claimEscape(e);
      close();
    }
  }

  const under = venueSourceLine(value.source, value.locationAddress, inClub);
  const venueId = `${idPrefix}-venue`;
  const facilityId = `${idPrefix}-facility`;
  // Each row's place in the flat list the arrow keys walk: venues, places, then the foot rows.
  const placeStart = venues.length;
  const addIdx = placeStart + placeRows.length;
  const manageIdx = addIdx + (canAdd ? 1 : 0);
  const row = (i: number, o: Opt, body: ReactNode, extra?: string) => {
    return (
      <button
        type="button"
        key={o.kind === 'venue' ? `v:${o.venue.id}` : o.kind === 'place' ? `p:${o.place.id}` : o.kind}
        role="option"
        aria-selected={i === activeIdx}
        className={`${styles.opt} ${extra ?? ''} ${i === activeIdx ? styles.optActive : ''}`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => choose(o)}
      >
        {body}
      </button>
    );
  };

  return (
    <div className={styles.where}>
      <div className={styles.row}>
        <div className={`${classes.field ?? ''} ${styles.venueCol}`} data-escape-owner={open ? '' : undefined}>
          <label className={classes.label} htmlFor={venueId}>{venueLabel}</label>
          <div className={styles.combo}>
            <input
              ref={inputRef}
              id={venueId}
              className={classes.input}
              value={value.location}
              placeholder={inClub ? 'Type to find a venue…' : places ? 'Type to find or add a place…' : 'Type a venue'}
              autoComplete="off"
              role="combobox"
              aria-expanded={open && hasList}
              aria-controls={`${venueId}-list`}
              disabled={disabled}
              onChange={e => { onChange(typeVenue(value, e.target.value)); openList(); setActiveIdx(-1); }}
              onFocus={() => { if (hasList || inClub || places) openList(); }}
              onBlur={() => setTimeout(close, 150)}
              onKeyDown={onKeyDown}
            />
            {open && !disabled && hasList && (
              <div id={`${venueId}-list`} role="listbox" className={`${styles.list} ${dropUp ? styles.listUp : ''}`}>
                {venues.length > 0 && <div className={styles.group}>{clubGroupLabel}</div>}
                {venues.map((v, vi) => row(vi, { kind: 'venue', venue: v }, (
                  <span className={styles.optText}>
                    <span className={styles.optName}>{v.name}</span>
                    <span className={styles.optSub}>
                      {[v.address, v.facilities.length ? `${v.facilities.length} ${v.facilities.length === 1 ? noun.toLowerCase() : `${noun.toLowerCase()}s`}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                )))}
                {placeRows.length > 0 && <div className={styles.group}>Your places</div>}
                {placeRows.map((p, pi) => {
                  const n = p.count ?? 0;
                  // A same-named place reads like any other place: the group header says whose it is, and picking it says
                  // it isn't checked (owner, 2026-10-09 — "Your own place · not checked for clashes" here was clutter).
                  const sub = [p.address, surfaceLabel(sport, p.fieldNumber)].filter(Boolean).join(' · ');
                  return row(placeStart + pi, { kind: 'place', place: p }, (
                    <>
                      <span className={styles.optText}>
                        <span className={styles.optName}>{p.name}</span>
                        {sub && <span className={styles.optSub}>{sub}</span>}
                      </span>
                      {n > 0 && <span className={styles.optCount}>{n} {n === 1 ? 'event' : 'events'}</span>}
                    </>
                  ));
                })}
                {(canAdd || onManagePlaces) && <div className={styles.sep} />}
                {canAdd && row(addIdx, { kind: 'add' }, <><Plus size={14} aria-hidden /> Add “{q}” as a place</>, styles.optAct)}
                {onManagePlaces && row(manageIdx, { kind: 'manage' }, <><Settings2 size={14} aria-hidden /> Manage places…</>, styles.optFoot)}
              </div>
            )}
          </div>
          {(under.pill || under.rest) && (
            <p className={`${classes.hint ?? ''} ${styles.under}`}>
              {under.pill && (
                <span className={styles.sourcePill}>
                  {under.pill !== 'typed' && <span className={`${pill.tagComboDot} ${SOURCE_DOT[under.pill]}`} aria-hidden />}
                  {VENUE_SOURCE_PILL[under.pill]}
                </span>
              )}
              {under.rest && <span className={styles.underRest}>{under.rest}</span>}
            </p>
          )}
        </div>

        <div className={`${classes.field ?? ''} ${styles.facilityCol}`}>
          <label className={classes.label} htmlFor={facilityId}>{facLabel}</label>
          {value.source === 'club' ? (
            <select
              id={facilityId}
              className={classes.select}
              value={value.orgVenueFacilityId ?? ''}
              disabled={disabled || !pickedVenue?.facilities.length}
              onChange={e => onChange(pickClubFacility(value, pickedVenue, e.target.value || null))}
            >
              <option value="">Not set</option>
              {(pickedVenue?.facilities ?? []).map(f => (
                <option key={f.id} value={f.id}>{surfaceLabel(sport, f.name) || f.name}</option>
              ))}
            </select>
          ) : (
            <input
              id={facilityId}
              className={classes.input}
              value={value.fieldNumber}
              maxLength={40}
              placeholder={`e.g. ${noun} 2`}
              disabled={disabled}
              onChange={e => onChange({ ...value, fieldNumber: e.target.value })}
            />
          )}
        </div>
      </div>
      {line}
      {footHint}
    </div>
  );
}

/**
 * The line under the place row (Asks 3–5): amber `warn` ("Diamond 2 is booked by …"), the softer `busy` ("Lions
 * Park is busy then …", its mark still amber), red `refuse` (house league's own rule, before Create), or the quiet
 * `quiet` ("Not one of the club’s venues, so it isn’t checked for clashes."). One shape, four inks. `lead` is bold.
 */
export function WhereLine({ tone, lead, rest }: { tone: 'warn' | 'busy' | 'refuse' | 'quiet'; lead?: string; rest?: string }) {
  const Icon = tone === 'refuse' ? Ban : tone === 'quiet' ? MapPin : AlertTriangle;
  return (
    <p className={`${styles.line} ${styles[`line_${tone}`]}`} role={tone === 'refuse' ? 'alert' : 'status'}>
      <Icon size={15} aria-hidden className={styles.lineIcon} />
      <span>{lead ? <b>{lead}</b> : null}{rest}</span>
    </p>
  );
}
