'use client';
/**
 * THE ONE DATE-AND-TIME FIELD (owner ruling 2026-10-25, Ask 4: a date-and-time field becomes a date box and a time box,
 * as drawn on the New season window). Plan docs/projects/active/THEMED_DATE_PICKER_PLAN.md; siblings `DateInput.tsx`
 * and `TimeInput.tsx`.
 *
 * - On a DESK: `DateInput` + `TimeInput` side by side, one row.
 * - On TOUCH, or at 768px and narrower: the device's own `type="datetime-local"`, one control.
 *
 * Value contract = the native one: `YYYY-MM-DDTHH:MM` or `''` — and, like the native control, it is `''` until BOTH
 * halves are filled. The half filled first is held here meanwhile, so choosing the date and then the time never loses
 * the date.
 */
import { useRef, useState } from 'react';
import { useDeskPicker } from '@/lib/hooks/useDeskPicker';
import { dateParts, normaliseTime } from '@/lib/date-field';
import DateInput from './DateInput';
import TimeInput from './TimeInput';
import { NativeField, useLeaveAfterCommit, type FieldProps } from './TypedField';
import styles from './DateInput.module.css';

/** What the screens that hold a date and a time pass (nothing else has been needed). */
export type DateTimeInputProps = Pick<FieldProps, 'onChange' | 'className' | 'min' | 'aria-label' | 'onBlur'> & {
  /** Always controlled: the pair holds a half-filled entry only against a host that keeps the value. */
  value: string;
};

function split(v: string | undefined): { date: string; time: string } {
  const [d = '', t = ''] = (v ?? '').split('T');
  return { date: dateParts(d) ? d : '', time: normaliseTime(t) ?? '' };
}

export default function DateTimeInput(props: DateTimeInputProps) {
  const desk = useDeskPicker();
  return desk ? <DeskDateTimeInput {...props} /> : <NativeField type="datetime-local" {...props} />;
}

function DeskDateTimeInput({ value, onChange, className, min, onBlur, ...aria }: DateTimeInputProps) {
  // The halves on screen. Re-read from the value whenever it changes from outside (a reset, a loaded record), but
  // never from our own '' while only one half is filled.
  const [parts, setParts] = useState(() => split(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    const next = split(value);
    if (next.date !== parts.date || next.time !== parts.time) setParts(next);
  }
  const pairRef = useRef<HTMLDivElement>(null);
  const left = useLeaveAfterCommit(onBlur);

  const update = (next: { date: string; time: string }) => {
    setParts(next);
    const joined = next.date && next.time ? `${next.date}T${next.time}` : '';
    setSeen(joined);
    if (joined !== value) onChange?.(joined);
  };

  // The earliest moment bounds the date, and bounds the time only on that same day.
  const lo = split(min);
  const label = aria['aria-label'];

  return (
    <div
      ref={pairRef}
      className={styles.pair}
      onBlur={e => { if (!pairRef.current?.contains(e.relatedTarget as Node | null)) left(); }}
    >
      <DateInput
        className={className}
        value={parts.date}
        onChange={date => update({ ...parts, date })}
        min={lo.date || undefined}
        aria-label={label ? `${label}: date` : undefined}
      />
      <TimeInput
        className={className}
        value={parts.time}
        onChange={time => update({ ...parts, time })}
        min={lo.date && parts.date === lo.date ? lo.time || undefined : undefined}
        // A date with no time is half a value: the form says so rather than saving nothing.
        required={!!parts.date}
        aria-label={label ? `${label}: time` : 'Time'}
      />
    </div>
  );
}
