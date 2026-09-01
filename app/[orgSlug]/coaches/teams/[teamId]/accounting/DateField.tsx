'use client';
import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import styles from './budget/budget.module.css';

/**
 * A date field with OUR calendar button instead of the browser's.
 *
 * Chrome draws its own indicator as a masked BACKGROUND COLOUR, which is why three attempts to
 * tame it each failed differently: raising opacity did nothing (it was never faded, only drawn
 * pale), recolouring it flattened Chrome's hover highlight into a grey square, and clearing that
 * highlight erased the glyph itself. It also rendered green against this palette, and its own
 * padding made the field taller than the two controls beside it.
 *
 * So the browser's button is hidden and a real icon takes its place: our colour, our size, aligned
 * with its neighbours, and immune to the next Chrome change. Clicking it opens the native picker
 * (`showPicker`), falling back to focusing the field where that isn't supported. It carries
 * `tabIndex={-1}` because the input itself is already the keyboard route to the same picker — a
 * second stop would just be furniture in the tab order.
 *
 * It lives in its own file rather than inside a panel because the Budget Plan line form and the
 * Set-dues-for-all-players modal are two screens that must not drift into two different date
 * controls — the fix above is too expensive to have to make twice.
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
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className={styles.dateField}>
      <input
        ref={ref}
        id={inputId}
        className={styles.input}
        type="date"
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        className={styles.dateFieldBtn}
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={() => {
          const el = ref.current as (HTMLInputElement & { showPicker?: () => void }) | null;
          if (!el) return;
          if (typeof el.showPicker === 'function') el.showPicker();
          else el.focus();
        }}
      >
        <Calendar size={15} aria-hidden />
      </button>
    </span>
  );
}
