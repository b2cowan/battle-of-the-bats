'use client';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { FilterSheetRow, useFilterGroupMember } from './FilterGroup';
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
  shrink = false,
  foot,
  restQuiet = false,
  restValue,
}: {
  /** Sits to the left of the chosen value — "Group by", "View", "Showing". */
  label: string;
  /** `detail` is a quiet figure at the option's end (a book's balance — the club's Book pill, Stage 3a). */
  options: readonly { id: string; label: string; detail?: string }[];
  value: string;
  onChange: (next: string) => void;
  /**
   * Does this pill choose WHAT IS READ rather than narrow it — the scope (the club's Year, the Ledger's
   * Book) or the arrangement (View)? It leads the strip and takes the accent, so it never reads as
   * another narrowing (plan §7). At most one scope and one arrangement, in that order (the club's Budget
   * and Budget vs. Actual lead Year · View, ruled with the Stage 3b drawings 2026-10-06; /design §271,
   * 2026-10-07). A narrowing is never `lead` — it takes `restQuiet`.
   */
  lead?: boolean;
  /**
   * May the pill give way in a tight row — its chosen value ellipsised rather than the row wrapping? The
   * club Ledger's Book pill, whose book names run long, beside three 44px icons on a phone (Ledger
   * Parity, 2026-10-02). Opt-in: a View or Group by value is always short.
   */
  shrink?: boolean;
  /**
   * The panel's foot, after a divider: doors that act on the LIST rather than pick from it — the club
   * Ledger's Book pill ends with "Add ledger" (Transfer and Payees moved into its Tools, 2026-10-02). Opt-in; no
   * portal strip passes one.
   */
  foot?: ReactNode;
  /**
   * A NARROWING, not an arrangement: quiet at rest (only the label shows while the value is `restValue`), the
   * olive tint and its value once it moves off — `MultiSelectDropdown`'s own rule. Inside a `FilterGroup` it
   * then counts on the phone's Filter button, draws itself as a row of the Filter sheet, and Reset puts it back
   * to `restValue` (Ledger Phone Filter D3/D6). First caller: Coming due's Due window (S3W3, 2026-10-05).
   * ⚠ Never on a `lead` pill: the arrangement stays in the top line and out of the sheet (FilterGroup's rule).
   */
  restQuiet?: boolean;
  restValue?: string;
}) {
  const narrowed = restValue != null && value !== restValue;
  const group = useFilterGroupMember(label, narrowed, () => { if (restValue != null) onChange(restValue); });
  const ref = useDetailsOutsideClick(group?.mode !== 'row');
  const chosen = options.find(o => o.id === value);
  const chosenLabel = chosen?.label ?? options[0]?.label ?? '';
  const atRest = restQuiet && !narrowed;

  const choices = options.map(o => (
    /* A button, not a radio: picking applies instantly and closes the panel, which is what
       `DateRangeDropdown`'s presets already do. A radio list would need a second click to
       dismiss, on a control whose whole job is one decision. In the phone's Filter sheet there is no
       panel to close: the list updates behind the sheet (D7). */
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
  ));

  if (group?.mode === 'row') {
    return <FilterSheetRow name={label} value={chosenLabel} lit={narrowed}>{choices}</FilterSheetRow>;
  }

  return (
    <details ref={ref} className={`${styles.multiSelect} ${lead ? styles.multiSelectLead : ''}${shrink ? ` ${styles.multiSelectShrink}` : ''}`}>
      <summary data-pill="summary" className={`${styles.multiSelectSummary}${restQuiet && !atRest ? ` ${styles.multiSelectActive}` : ''}`}>
        <span className={styles.multiSelectLabel}>{label}</span>
        {!atRest && <span className={styles.multiSelectValue}>{chosenLabel}</span>}
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div data-pill="panel" className={styles.multiSelectPanel} role="group" aria-label={label}>
        {choices}
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
