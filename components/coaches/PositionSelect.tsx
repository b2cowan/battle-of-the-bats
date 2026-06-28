'use client';
import { useState } from 'react';

const CUSTOM = '__custom__';

interface PositionSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Sport-appropriate positions. Empty → falls back to a plain free-text input. */
  positions: string[];
  selectClass?: string;
  inputClass?: string;
  /** Placeholder for the custom / free-text input. */
  placeholder?: string;
}

/**
 * Position picker shared by the roster add-player modal and the player profile.
 * Shows a dropdown of the sport's positions plus a "Custom…" escape for anything
 * not on the list. When the sport defines no positions, it degrades to free text.
 */
export default function PositionSelect({
  id, value, onChange, positions, selectClass, inputClass, placeholder = 'Custom position',
}: PositionSelectProps) {
  const valueIsKnown = positions.includes(value);
  const [customMode, setCustomMode] = useState(value !== '' && !valueIsKnown);

  // No defined vocabulary for this sport — behave exactly like the old free-text field.
  if (positions.length === 0) {
    return (
      <input
        id={id}
        className={inputClass}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={20}
      />
    );
  }

  return (
    <>
      <select
        id={id}
        className={selectClass}
        value={customMode ? CUSTOM : value}
        onChange={e => {
          if (e.target.value === CUSTOM) {
            setCustomMode(true);
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">—</option>
        {positions.map(p => <option key={p} value={p}>{p}</option>)}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {customMode && (
        <input
          className={inputClass}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={20}
          autoFocus
          style={{ marginTop: '0.35rem' }}
        />
      )}
    </>
  );
}
