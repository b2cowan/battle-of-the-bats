'use client';
import React from 'react';
import { Venue } from '@/lib/types';

/**
 * The one way a tournament game's field is chosen (Phase 2 of the game-location project):
 * a picker over the tournament's OWN venues/surfaces, with typed text demoted to the
 * explicit "Somewhere else (type it)" choice — mirroring the house-league FieldPicker.
 * Used by the Add/Edit game modal and the inline schedule-row editor so the two can't
 * drift; the bracket builder keeps its compact select but follows the same encoding.
 *
 * The parent owns all state. `location` is only the TYPED text — when a venue is picked,
 * the display string is derived server-side and nothing typed here survives.
 */

export interface FieldPickerValue {
  venueId: string;
  venueFacilityId: string;
  /** Typed free text — meaningful only while `textMode` is true. */
  location: string;
  textMode: boolean;
}

/** Initial picker state for an existing game: venue wins; else non-empty text means text mode. */
export function fieldPickerValueForGame(g: { venueId?: string | null; venueFacilityId?: string | null; location?: string | null }): FieldPickerValue {
  const venueId = g.venueId ?? '';
  const location = g.location ?? '';
  return {
    venueId,
    venueFacilityId: g.venueFacilityId ?? '',
    location,
    textMode: !venueId && location.trim().length > 0,
  };
}

export default function TournamentFieldPicker({
  venues,
  noun,
  value,
  onChange,
  onCreateVenue,
  selectClassName,
  inputClassName,
  disabled,
  showTypedHint = true,
}: {
  venues: Venue[];
  /** Sport-pack surface noun, e.g. "Diamond" / "Court" — never hard-coded. */
  noun: string;
  value: FieldPickerValue;
  onChange: (next: FieldPickerValue) => void;
  onCreateVenue?: () => void;
  selectClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
  showTypedHint?: boolean;
}) {
  const nounLower = noun.toLowerCase();
  const selectValue = value.textMode
    ? '__text__'
    : (value.venueFacilityId || (value.venueId ? `v:${value.venueId}` : ''));

  function handleSelect(val: string) {
    if (val === '__create__') {
      onCreateVenue?.();
      return;
    }
    if (val === '') {
      onChange({ venueId: '', venueFacilityId: '', location: '', textMode: false });
      return;
    }
    if (val === '__text__') {
      // Keep whatever was typed before — switching modes must not eat a draft.
      onChange({ ...value, venueId: '', venueFacilityId: '', textMode: true });
      return;
    }
    if (val.startsWith('v:')) {
      onChange({ venueId: val.slice(2), venueFacilityId: '', location: '', textMode: false });
      return;
    }
    // A facility id — resolve its parent venue.
    for (const v of venues) {
      const fac = v.facilities?.find(f => f.id === val);
      if (fac) {
        onChange({ venueId: v.id, venueFacilityId: fac.id, location: '', textMode: false });
        return;
      }
    }
  }

  return (
    <>
      <select
        className={selectClassName}
        value={selectValue}
        disabled={disabled}
        onChange={e => handleSelect(e.target.value)}
      >
        <option value="">— No {nounLower} —</option>
        {venues.filter(v => (v.facilities?.length ?? 0) > 0).map(v => (
          <optgroup key={v.id} label={v.name}>
            <option value={`v:${v.id}`}>Any {nounLower} at {v.name}</option>
            {v.facilities!.map(f => (
              <option key={f.id} value={f.id}>{v.name} — {f.name}</option>
            ))}
          </optgroup>
        ))}
        {venues.filter(v => (v.facilities?.length ?? 0) === 0).map(v => (
          <option key={v.id} value={`v:${v.id}`}>{v.name}</option>
        ))}
        <option value="__text__">Somewhere else (type it)</option>
        {onCreateVenue && (
          <>
            <option disabled>──────────</option>
            <option value="__create__">＋ Add venue…</option>
          </>
        )}
      </select>
      {value.textMode && (
        <>
          <input
            className={inputClassName}
            style={{ marginTop: '0.35rem' }}
            placeholder="Type a location…"
            value={value.location}
            disabled={disabled}
            onChange={e => onChange({ ...value, location: e.target.value })}
          />
          {showTypedHint && (
            <small style={{ display: 'block', marginTop: '0.3rem', color: 'var(--white-40)', fontSize: '0.7rem' }}>
              Typed locations aren’t checked for double-bookings.
            </small>
          )}
        </>
      )}
    </>
  );
}
