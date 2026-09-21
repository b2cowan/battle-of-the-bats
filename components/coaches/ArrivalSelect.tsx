'use client';
import { useState } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { formatTime } from '@/lib/utils';
import { ARRIVAL_PRESET_MINUTES, arrivalClockFor, arrivalPresetOf, arrivalPresetLabel } from '@/lib/coach-arrival';

/**
 * ARRIVAL AS A LEAD TIME (Arrival & Places, owner rulings D1–D3, 2026-09-21).
 *
 * A coach thinks "be there 45 minutes early", so this asks how long before — a dropdown of the
 * seven answers with the clock beside each — and stores what families read: the clock
 * (`arrival_time`, `HH:mm`). The dropdown DERIVES its state from the clock and the start
 * (`arrivalPresetOf`); nothing else is stored.
 *
 * ⚠ "A specific time…" needs one bit the clock cannot carry: choosing it pre-fills start − 1 hour
 * (D3, the literal fix for the picker opening at the time of day the coach was sitting at), and
 * that clock IS the "1 hour before" preset — derived alone, the control would snap straight back
 * to the preset and hide the field. So `custom` is held here, per mount, and cleared when a preset
 * or None is chosen. An existing arrival that is no preset opens as a specific time on its own.
 *
 * ⚠ A DROPDOWN, NOT PILLS (the 08-22 convention — a one-value form field is a dropdown). The owner
 * suggested pills for the four common answers and ruled for the list: seven answers plus the
 * escape need it anyway.
 *
 * The FOLLOW rule (a preset moves with the start; a specific time stays put) lives with the form's
 * start setter — this control never sees the start change, only the result.
 */
export default function ArrivalSelect({
  id = 'event-arrival',
  startTime,
  value,
  onChange,
  disabled = false,
}: {
  id?: string;
  /** The event's start, `HH:mm` — the reference every preset is measured from. */
  startTime: string;
  /** The arrival clock, `HH:mm`, or '' for none. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState(false);
  const preset = arrivalPresetOf(startTime, value);
  const showCustom = value !== '' && (custom || preset === null);
  const selectValue = value === '' ? 'none' : showCustom ? 'custom' : String(preset);

  function choose(next: string) {
    if (next === 'none') { setCustom(false); onChange(''); return; }
    if (next === 'custom') {
      setCustom(true);
      onChange(value || arrivalClockFor(startTime, 60) || startTime || '');
      return;
    }
    setCustom(false);
    onChange(arrivalClockFor(startTime, Number(next)) ?? '');
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>Arrival</label>
      <div className={showCustom ? styles.formSectionGrid : undefined}>
        <select id={id} className={styles.select} value={selectValue} onChange={e => choose(e.target.value)} disabled={disabled}>
          <option value="none">None</option>
          {ARRIVAL_PRESET_MINUTES.map(m => {
            const clock = arrivalClockFor(startTime, m);
            return (
              // A preset that would land on the day before is offered greyed, not hidden — the
              // list keeps its shape and the coach sees why 1 hour is out for a 12:30 a.m. start.
              <option key={m} value={String(m)} disabled={!clock}>
                {arrivalPresetLabel(m)}{clock ? ` · ${formatTime(clock)}` : ''}
              </option>
            );
          })}
          <option value="custom">A specific time…</option>
        </select>
        {showCustom && (
          <input
            className={styles.input}
            type="time"
            aria-label="Arrival time"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
          />
        )}
      </div>
      {value ? (
        <p className={`${styles.formHint} ${styles.formHintConsequence}`}>
          <strong>Arrive by {formatTime(value)}</strong> — shows on the event and the calendar export.
        </p>
      ) : null}
    </div>
  );
}
