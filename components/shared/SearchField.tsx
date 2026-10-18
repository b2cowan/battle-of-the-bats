'use client';
/**
 * THE ONE SEARCH FIELD — Toolbar Rules, Rule 5 (owner ruling 2026-10-17; hub SPjRTAB6kVqd9vJ8x1vuza; plan
 * docs/projects/active/TOOLBAR_RULES_PLAN.md). Every list search in the tournament admin, the club admin and the
 * coaches portal wears this field instead of styling its own (the census found five hand-built boxes): rounded, a
 * 14px magnifier, 16rem on a desk, an inset outline that turns olive on focus, and the ROOM's height —
 *   - `room="admin"`: the admin control height on a desk, 44px at ≤768;
 *   - `room="coach"`: 44px at every width (the car-park rationale — the practice and skills rooms are opened on a
 *     phone in a car park), and on a phone its own full-width row.
 * Words: `label` is the accessible name and never carries dots ("Search teams"); the hint is always the label and
 * "…", so no field can forget them. The ✕ shows while there is text, named "Clear the search" on every field.
 * A host places the field (the tournament phone's square that opens a full-width row is `useToolbarSearch`); it never
 * restyles it.
 */
import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import styles from './SearchField.module.css';

export const CLEAR_SEARCH = 'Clear the search';

export default function SearchField({
  value, onChange, label, room = 'admin', layout = 'desk', onClear, autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  /** The accessible name, no dots: "Search teams". */
  label: string;
  room?: 'admin' | 'coach';
  /** `desk` — the ruled 16rem (a coach room's turns into a full-width row on a phone); `fill` — the line's whole
   *  width (a phone row, a sheet, the 320px docked library). */
  layout?: 'desk' | 'fill';
  /** Called instead of handing focus back to the input once the ✕ has emptied the field (the tournament phone row
   *  closes and returns focus to its square). Without it, focus goes back to the input, so a keyboard is not
   *  dropped on the page. */
  onClear?: () => void;
  autoFocus?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    /* The ✕ sits beside the label, not in it: a label may hold only the control it names (/review). */
    <div className={styles.field} data-search-field={room} data-layout={layout}>
      <label className={styles.inner}>
        <Search size={14} aria-hidden className={styles.icon} />
        <input
          ref={input}
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`${label}…`}
          aria-label={label}
          autoFocus={autoFocus}
        />
      </label>
      {value !== '' && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            onChange('');
            if (onClear) onClear();
            else input.current?.focus();
          }}
          aria-label={CLEAR_SEARCH}
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
