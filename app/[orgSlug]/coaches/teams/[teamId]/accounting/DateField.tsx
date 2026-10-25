'use client';
import DateInput from '@/components/shared/DateInput';
import styles from './budget/budget.module.css';

/**
 * The Budget / dues screens' date control — now a thin wrapper over the shared `DateInput`
 * (owner ruling 2026-10-25: every date in the product is picked in that one field; the calendar,
 * its icon, typing, min/max and the phone's native picker all live there).
 *
 * The wrapper survives for ONE reason: the Budget Plan line form and the Set-dues-for-all-players
 * modal are two screens that must not drift into two different date controls, and this keeps their
 * call shape (`value`, `onChange(v)`, `ariaLabel`, `inputId`, `min`, `max`) and the budget input
 * class in a single place. It draws nothing of its own any more — the Calendar button and the
 * `showPicker` call that used to live here went with the move.
 */
export default function DateField({ value, onChange, ariaLabel, inputId, min, max }: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  inputId?: string;
  min?: string;
  /** Latest selectable day. For money that MOVED pass `moneyMovedMaxDate()` — see
   *  lib/money-date-guards.ts. The control had a `min` and no `max` for months, which is why
   *  three money screens hand-rolled the cap and three others simply forgot it. */
  max?: string;
}) {
  return (
    <DateInput
      id={inputId}
      className={styles.input}
      value={value}
      min={min}
      max={max}
      aria-label={ariaLabel}
      onChange={v => onChange(v)}
    />
  );
}
