'use client';
import { useMemo, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import PlaceSheet from './PlaceSheet';
import ManagePlacesSheet from './ManagePlacesSheet';
import { claimEscape } from './escapeOwnership';
import { applyPlaceToEvent, filterPlaces, matchPlace } from '@/lib/coach-places';
import type { RepTeamPlace } from '@/lib/types';

export interface PlaceFieldValue {
  location: string;
  locationAddress: string;
  fieldNumber: string;
  placeId: string | null;
}

/**
 * THE LOCATION FIELD IS THE DOOR TO THE PLACE BOOK (Arrival & Places D4–D6, D8, 2026-09-21).
 *
 * The tag picker's grammar, for one value: type to find one of the team's places (most recently
 * used first, with how many events sit at each), pick one and its address and usual diamond come
 * with it; type a name that isn't there and the list offers "＋ Add “…” as a place" (the small
 * sheet); "Manage places…" is the last row — the door lives where minting lives. ⚠ NOT a button
 * that opens a chooser: typing into the field IS the door (the owner's ask was a modal; the
 * ruling is this).
 *
 * ⚠ A FREE-TYPED LOCATION IS STILL A LOCATION (D5). Text with no place saves as text, exactly as
 * before, and creates nothing. It just has no address — the Address field left the event form
 * (D8) because a place carries it, so "Add … as a place" is where an address is typed. Typing over
 * a picked place's name detaches it AND clears the address copy (it belonged to the old place);
 * the diamond is per-game and stays.
 *
 * Reuses the tag combobox's CSS (`.tagCombo*`) so a coach meets one dropdown, and its two hard-won
 * rules: the list flips above the input inside a clipping box, and it owns Escape only while open.
 */
export default function PlaceCombobox({
  id = 'event-location',
  basePath,
  places,
  value,
  onChange,
  onPlacesChanged,
  disabled = false,
}: {
  id?: string;
  /** `/api/coaches/{org}/teams/{team}/places` */
  basePath: string;
  /** The host's copy of the book; the picker re-reads on open (the tag picker's rule). */
  places: RepTeamPlace[];
  value: PlaceFieldValue;
  onChange: (next: PlaceFieldValue) => void;
  /** The host's re-read after a sheet act; `movedEvents` > 0 means the events changed too. */
  onPlacesChanged: (movedEvents?: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [fresh, setFresh] = useState<RepTeamPlace[] | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refreshLibrary() {
    try {
      const res = await fetch(basePath);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.places)) setFresh(data.places as RepTeamPlace[]);
    } catch { /* offline — the host copy keeps the picker usable */ }
  }

  function openDropdown() {
    const el = inputRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      let top = 0, bottom = window.innerHeight;
      for (let n = el.parentElement; n; n = n.parentElement) {
        if (getComputedStyle(n).overflowY === 'visible') continue;
        const r = n.getBoundingClientRect();
        top = Math.max(top, r.top);
        bottom = Math.min(bottom, r.bottom);
      }
      setDropUp(bottom - rect.bottom < 250 && rect.top - top > 260);
    }
    setOpen(true);
    void refreshLibrary();
  }

  const lib = fresh ?? places;
  const q = value.location.trim();
  const matches = useMemo(() => filterPlaces(lib, q).slice(0, 8), [lib, q]);
  const exact = matchPlace(lib, q);
  const canAdd = q.length > 0 && !exact;
  const addIdx = matches.length;
  const manageIdx = addIdx + (canAdd ? 1 : 0);
  const optionCount = manageIdx + 1;
  const picked = value.placeId ? lib.find(p => p.id === value.placeId) ?? null : null;

  function pick(place: RepTeamPlace) {
    onChange(applyPlaceToEvent(value, place));
    setOpen(false);
    setActiveIdx(-1);
  }
  function type(text: string) {
    // Typing over a picked place detaches it and its address; the diamond is this game's own.
    const wasPicked = !!value.placeId && text.trim().toLowerCase() !== (picked?.name ?? '').trim().toLowerCase();
    onChange({ ...value, location: text, placeId: wasPicked ? null : value.placeId, locationAddress: wasPicked ? '' : value.locationAddress });
    openDropdown();
    setActiveIdx(-1);
  }
  function startAdd() { setOpen(false); setActiveIdx(-1); setAdding(q); }
  function openManager() { setOpen(false); setActiveIdx(-1); setManaging(true); }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIdx(i => Math.min(i + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < matches.length) pick(matches[activeIdx]);
      else if (canAdd && activeIdx === addIdx) startAdd();
      else if (activeIdx === manageIdx) openManager();
      else if (exact) pick(exact);
      else setOpen(false);
    } else if (e.key === 'Escape' && open) {
      claimEscape(e);
      setOpen(false);
    }
  }

  const facts = [value.locationAddress.trim(), value.fieldNumber.trim()].filter(Boolean).join(' · ');

  return (
    <div className={styles.tagCombo} data-escape-owner={open ? '' : undefined}>
      <input
        ref={inputRef}
        id={id}
        className={styles.input}
        value={value.location}
        placeholder="Type to find or add a place…"
        autoComplete="off"
        disabled={disabled}
        onChange={e => type(e.target.value)}
        onFocus={openDropdown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && (
        <div className={`${styles.tagComboDropdown} ${dropUp ? styles.tagComboDropdownUp : ''}`}>
          {matches.length > 0 && <div className={styles.tagComboGroup}>Your places</div>}
          {matches.map((p, i) => {
            const sub = [p.address, p.fieldNumber].filter(Boolean).join(' · ');
            const n = p.count ?? 0;
            return (
              <button
                type="button"
                key={p.id}
                className={`${styles.tagComboOpt} ${i === activeIdx ? styles.tagComboOptActive : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(p)}
              >
                <span className={styles.tagComboOptName} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                  <span>{p.name}</span>
                  {sub && <span className={styles.tagComboWord}>{sub}</span>}
                </span>
                {n > 0 && <span className={styles.tagComboCount}>{n} {n === 1 ? 'event' : 'events'}</span>}
              </button>
            );
          })}
          {matches.length === 0 && !canAdd && lib.length === 0 && (
            <div className={styles.tagComboEmpty}>No places yet — type one to add it.</div>
          )}
          {canAdd && (
            <button
              type="button"
              className={`${styles.tagComboOpt} ${styles.tagComboCreate} ${activeIdx === addIdx ? styles.tagComboOptActive : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={startAdd}
            >
              ＋ Add “{q}” as a place
            </button>
          )}
          <button
            type="button"
            className={`${styles.tagComboOpt} ${styles.tagComboManage} ${activeIdx === manageIdx ? styles.tagComboOptActive : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={openManager}
          >
            <Settings2 size={13} aria-hidden /> Manage places…
          </button>
        </div>
      )}
      {facts && <p className={styles.formHint}>{facts}</p>}

      {adding !== null && (
        <PlaceSheet
          basePath={basePath}
          initialName={adding}
          onClose={() => setAdding(null)}
          onSaved={place => {
            setAdding(null);
            setFresh(prev => (prev && !prev.some(p => p.id === place.id) ? [...prev, place] : prev));
            onChange(applyPlaceToEvent(value, place));
            onPlacesChanged();
          }}
        />
      )}
      {managing && (
        <ManagePlacesSheet
          basePath={basePath}
          places={lib}
          onClose={() => setManaging(false)}
          onChanged={moved => { void refreshLibrary(); onPlacesChanged(moved); }}
        />
      )}
    </div>
  );
}
