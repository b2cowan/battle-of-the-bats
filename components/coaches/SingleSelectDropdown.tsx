'use client';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import useDetailsOutsideClick from './useDetailsOutsideClick';
import styles from '../shared/FilterPill.module.css';

/**
 * PICK ONE — the single-select member of the reporting control family, beside
 * `MultiSelectDropdown` (checkboxes, empty = all) and `DateRangeDropdown` (a window).
 *
 * ⚠⚠ ONE CONTROL SHAPE ACROSS THE REPORTS (owner instruction 2026-08-19, reaffirmed and REWORDED
 * 2026-08-20). Payables' `Group by` and Budget vs. Actual's `View` / `Showing` do the same job —
 * choose how one set of records is laid out — and until now they wore two different looks in one
 * product: a labelled pill on Transactions, a bank of segmented buttons on the report.
 *
 * ⚠ THE REWORDING MATTERS, because the rule it replaces was never the owner's. A plan document had
 * written "two or three fixed, permanent options → pills stay; a dropdown for two things is a click
 * tax" underneath the owner's actual instruction, and it was quoted back at them as their own words
 * (caught 2026-08-20). The standing rule is now: **one shape, and short lists judged case by case,
 * with clutter counted as a real cost** — five pill groups of two options each put ten things on
 * screen where five dropdowns put five. `Group by` has exactly two options and is a dropdown for
 * that reason, not in spite of it.
 *
 * ⚠ `<details>`, NOT A HAND-ROLLED POPOVER (memory: CollapsibleCard primitive) — free keyboard
 * support, no portal or positioning code, and it closes itself on a repeat click. The one thing it
 * does not do natively is close on an outside click: `useDetailsOutsideClick`, shared with both
 * siblings.
 */
export default function SingleSelectDropdown({
  label,
  options,
  value,
  onChange,
  lead = false,
  foot,
}: {
  /** Sits to the left of the chosen value — "Group by", "View", "Showing". */
  label: string;
  /** `detail` is a quiet figure at the option's end (a book's balance — the club's Book pill, Stage 3a). */
  options: readonly { id: string; label: string; detail?: string }[];
  value: string;
  onChange: (next: string) => void;
  /**
   * Is this the ARRANGEMENT control? It sits first in the strip and takes the accent, so it never
   * reads as another narrowing (plan §7). Exactly one control per strip should set this.
   */
  lead?: boolean;
  /**
   * The panel's foot, after a divider: doors that act on the LIST rather than pick from it — the club
   * Ledger's Book pill ends with "Add ledger" (and, on a phone, Transfer and Payees). Opt-in; no
   * portal strip passes one.
   */
  foot?: ReactNode;
}) {
  const ref = useDetailsOutsideClick();
  const chosen = options.find(o => o.id === value);

  return (
    <details ref={ref} className={`${styles.multiSelect} ${lead ? styles.multiSelectLead : ''}`}>
      <summary data-pill="summary" className={styles.multiSelectSummary}>
        <span className={styles.multiSelectLabel}>{label}</span>
        <span className={styles.multiSelectValue}>{chosen?.label ?? options[0]?.label ?? ''}</span>
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div data-pill="panel" className={styles.multiSelectPanel} role="group" aria-label={label}>
        {options.map(o => (
          /* A button, not a radio: picking applies instantly and closes the panel, which is what
             `DateRangeDropdown`'s presets already do. A radio list would need a second click to
             dismiss, on a control whose whole job is one decision. */
          <button
            key={o.id}
            type="button"
            className={`${styles.multiSelectOption} ${styles.multiSelectPick} ${o.id === value ? styles.multiSelectPickOn : ''}`}
            aria-pressed={o.id === value}
            onClick={ev => {
              onChange(o.id);
              (ev.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
            }}
          >
            {o.label}
            {o.detail != null && <span className={styles.multiSelectCount}>{o.detail}</span>}
          </button>
        ))}
        {foot != null && (
          <>
            <div className={styles.multiSelectDivider} />
            {foot}
          </>
        )}
      </div>
    </details>
  );
}
