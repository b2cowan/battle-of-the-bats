'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
  directionLabel, nextSort, parseLibrarySort, serializeLibrarySort,
  type LibrarySort, type LibrarySortColumn,
} from '@/lib/library-sort';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The sortable head of a practice-library table, the phone's Sort menu, and the remembered choice
 * (practices re-evaluation, columns follow-up; owner rulings T3 · T4, 2026-09-17). The order
 * itself is `sortLibraryRows` in `lib/library-sort.ts` — pure, tested, and the only thing that
 * knows what a click means.
 *
 *  · `useLibrarySort` — the current sort for ONE tab, remembered in this browser under the tab's
 *    own key (the docked library's toggle is remembered the same way, L5). Nothing chosen means
 *    the tab's resting order — name A–Z, club drills first — and the table says nothing on its own.
 *  · `LibrarySortHead` — the `<th>`s at table width. A heading is a real button, the sorted one
 *    announces its direction through `aria-sort`, and the arrow marks the column in charge; the
 *    unsorted ones wear a quiet up-down glyph so the affordance is visible before the first click
 *    (the first sortable head in the coach portal — every other list is in one fixed order).
 *  · `LibrarySortMenu` — the phone's path: below 641px the table is a stack of cards with no head
 *    row to click, so the same choices sit in a menu beside the Tags filter that reads its own
 *    choice ("Sort · Plans"). Shown by the card breakpoint alone; a tablet and a desktop have the
 *    headings and never see it (house rule 6 — one control per question).
 */

/** Where a tab's sort is remembered: `coach-library-sort-drills` · `-templates` · `-circuits`. */
const storageKey = (tab: string) => `coach-library-sort-${tab}`;

export function useLibrarySort<T>(tab: string, columns: readonly LibrarySortColumn<T>[]) {
  const [sort, setSortState] = useState<LibrarySort | null>(null);
  // Read after mount — storage is a per-viewer convenience the server cannot see, so the first
  // client render must match the server's; the remembered order arrives one commit later, before
  // any rows do (the tab renders "Loading…" until its fetch returns). Once per mount, cannot
  // cascade — the same shape as the docked library's remembered toggle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setSortState(parseLibrarySort(localStorage.getItem(storageKey(tab)), columns)); } catch { /* no storage — resting order */ }
  // The column list is a module constant per tab; the tab key is what identifies the memory.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const setSort = useCallback((next: LibrarySort | null) => {
    setSortState(next);
    try {
      if (next) localStorage.setItem(storageKey(tab), serializeLibrarySort(next));
      else localStorage.removeItem(storageKey(tab));
    } catch { /* per-viewer convenience only */ }
  }, [tab]);
  /** A click on a heading or a pick in the menu. */
  const choose = useCallback((column: LibrarySortColumn<T>) => setSort(nextSort(sort, column)), [sort, setSort]);
  return { sort, choose, setSort };
}

/**
 * The `<th>`s between the table's edge and the chevron's blank head — the lead column first. Every
 * column given sorts; a column that must not (there is none today — Tags left the table before it
 * was built, T1) is simply not passed and rendered by the caller as a plain `<th>`.
 */
export function LibrarySortHead<T>({ columns, sort, onSort, shrinkFrom = 1 }: {
  columns: readonly LibrarySortColumn<T>[];
  sort: LibrarySort | null;
  onSort: (column: LibrarySortColumn<T>) => void;
  /** Columns from this index on are the narrow data columns (`tdShrink`); the lead is wide. */
  shrinkFrom?: number;
}) {
  return (
    <>
      {columns.map((column, i) => {
        const active = sort?.key === column.key;
        const Icon = !active ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;
        return (
          <th
            key={column.key}
            className={`${styles.th} ${styles.thSort}${i >= shrinkFrom ? ` ${styles.tdShrink}` : ''}`}
            aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <button type="button" className={styles.thSortBtn} onClick={() => onSort(column)}>
              {column.label}
              <Icon size={13} className={styles.thSortIcon} aria-hidden />
            </button>
          </th>
        );
      })}
    </>
  );
}

/** The phone's Sort menu — the same choices as the headings; the trigger reads the one in charge. */
export function LibrarySortMenu<T>({ columns, sort, onSort }: {
  columns: readonly LibrarySortColumn<T>[];
  sort: LibrarySort | null;
  onSort: (column: LibrarySortColumn<T>) => void;
}) {
  const current = sort ? columns.find(c => c.key === sort.key) : undefined;
  const word = (c: LibrarySortColumn<T>) => c.menuLabel ?? c.label;
  return (
    <span className={styles.libSortPhone}>
      <CoachToolbarMenu label={current ? `Sort · ${word(current)}` : 'Sort'} icon={<ArrowUpDown size={15} aria-hidden />}>
        {columns.map(column => (
          <CoachToolbarMenuItem
            key={column.key}
            label={word(column)}
            /* The chosen row says which way it runs — the menu has no arrow to read — and that a
               second tap turns it round, the heading's own rule. */
            hint={sort?.key === column.key ? `${directionLabel(column.kind, sort.dir)} · tap again to turn it round` : undefined}
            checked={sort?.key === column.key}
            onSelect={() => onSort(column)}
          />
        ))}
      </CoachToolbarMenu>
    </span>
  );
}
