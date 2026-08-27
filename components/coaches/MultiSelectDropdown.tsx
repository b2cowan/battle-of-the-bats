'use client';
import { ChevronDown } from 'lucide-react';
import useDetailsOutsideClick from './useDetailsOutsideClick';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * A checkbox list inside a native `<details>` disclosure — the compact-toolbar counterpart to a
 * row of filter pills, for a control strip that has run out of room for one pill per option
 * (register reading-order ruling, follow-up to P3: seven type-filter pills plus a budget-item
 * dropdown plus a date range no longer fit on one line once the list itself needed to be dense).
 *
 * ⚠ EMPTY SELECTION MEANS "ALL", ALWAYS — there is no separate "All" state to fall out of sync
 * with an empty set. The caller never has to reconcile the two.
 *
 * ⚠ `<details>`, NOT A HAND-ROLLED POPOVER (memory: CollapsibleCard primitive) — free keyboard
 * support, no portal/positioning code, and it closes itself on repeat click. The one thing it
 * doesn't do natively is close on an outside click — `useDetailsOutsideClick`, shared with its
 * single-select sibling `DateRangeDropdown`.
 */
export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel = 'All',
}: {
  /** Sits to the left of the summary value — "Show", "Item". */
  label: string;
  /**
   * `swatch` is optional and draws the tag dot before an option's name: `'org'` for a label the
   * organization shares, `'own'` for one the team made.
   *
   * ⚠⚠ A NAMED ROLE, NOT A COLOUR, and that is the point. The first build of this took a raw CSS
   * colour string and the money-tag caller passed fresh `rgba()` literals in — which gave the
   * org-vs-team distinction a SECOND encoding, drifting from the one `TagSearchCombobox` and the
   * row chips already use, and left "only pass this for tags" enforceable by a comment rather than
   * by the compiler (`/simplify`, reuse + altitude lenses, 2026-08-25). The two values map to the
   * same `.tagComboDot*` rules the tag picker draws, so there is one place to change the meaning
   * of blue.
   *
   * ⚠ Do not widen this to brighten up a filter: an option list where colour means nothing is a
   * legend the reader has to invent.
   */
  options: readonly { id: string; label: string; swatch?: 'org' | 'own' }[];
  /** Empty = every option, i.e. "All". */
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  allLabel?: string;
}) {
  const ref = useDetailsOutsideClick();

  const summary = selected.size === 0 ? allLabel
    : selected.size === 1 ? (options.find(o => selected.has(o.id))?.label ?? allLabel)
    : `${selected.size} selected`;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  return (
    <details ref={ref} className={styles.multiSelect}>
      <summary className={styles.multiSelectSummary}>
        <span className={styles.multiSelectLabel}>{label}</span>
        <span className={styles.multiSelectValue}>{summary}</span>
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div className={styles.multiSelectPanel} role="group" aria-label={label}>
        <label className={styles.multiSelectOption}>
          <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} />
          {allLabel}
        </label>
        <div className={styles.multiSelectDivider} />
        {options.map(o => (
          <label key={o.id} className={styles.multiSelectOption}>
            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
            {o.swatch && (
              <span
                className={`${styles.tagComboDot} ${o.swatch === 'org' ? styles.tagComboDotOrg : styles.tagComboDotOwn}`}
                aria-hidden
              />
            )}
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}
