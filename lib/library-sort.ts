/**
 * Sorting the practice library's three tables — Drills · Templates · Circuits (practices
 * re-evaluation, columns follow-up; owner ruling T3, 2026-09-17). The pure half: what a click on a
 * heading means and what order it produces. The table head, the phone's Sort menu and the
 * remembered choice live in `components/coaches/LibrarySort.tsx`.
 *
 * ⚠ **The tab still opens in name order and says nothing on its own.** A sort here is the coach
 * asking their own library a question — "which of these have I planned most?" — never the library
 * ranking their ideas unasked. That is what the stage-4 build's "sorted by name, never by use" was
 * protecting, and it survives as the DEFAULT: with no column chosen, `sortLibraryRows` returns
 * the caller's order untouched (name A–Z, club drills first). The no-ranking rule proper is about
 * children (Practice Plans plan §4) and has nothing to say about a drill.
 *
 * ⚠ **The first click gives the order a coach clicks for:** names A–Z, minutes shortest first,
 * counts most first, dates newest first. A second click on the same heading turns it round.
 *
 * ⚠ **A row with nothing to sort by sits at the foot whichever way the arrow points** — a dash
 * (no plan yet, no date, no length) is not a value, so "oldest first" must never put the
 * never-planned on top as if they were the oldest. Ties fall to the name, A–Z, so the order is
 * stable and readable however the figures collide.
 */

export type LibrarySortKind = 'text' | 'minutes' | 'count' | 'date';

export interface LibrarySortColumn<T> {
  /** Stable key — also the remembered value, so it must never be renamed casually. */
  key: string;
  /** The heading's word. */
  label: string;
  /** The phone menu's word when the heading's would read oddly off the table — "Name" for a lead column headed "Drill". */
  menuLabel?: string;
  kind: LibrarySortKind;
  /** The row's value for this column; `null`/`undefined`/`''`/`0` all mean "nothing to sort by". */
  get: (row: T) => string | number | null | undefined;
}

export type LibrarySortDir = 'asc' | 'desc';

export interface LibrarySort {
  key: string;
  dir: LibrarySortDir;
}

/** The direction the first click on a heading gives (see the module note). */
export function firstDirection(kind: LibrarySortKind): LibrarySortDir {
  return kind === 'count' || kind === 'date' ? 'desc' : 'asc';
}

/** The direction in words, for the phone's menu (which has no arrow to read) — "Newest first", "A–Z". */
export function directionLabel(kind: LibrarySortKind, dir: LibrarySortDir): string {
  switch (kind) {
    case 'text': return dir === 'asc' ? 'A–Z' : 'Z–A';
    case 'minutes': return dir === 'asc' ? 'Shortest first' : 'Longest first';
    case 'count': return dir === 'desc' ? 'Most first' : 'Fewest first';
    case 'date': return dir === 'desc' ? 'Newest first' : 'Oldest first';
  }
}

/** What a click on `column` does to the current sort: a new column starts in its first direction; the same column turns round. */
export function nextSort<T>(current: LibrarySort | null, column: LibrarySortColumn<T>): LibrarySort {
  if (current?.key === column.key) return { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key: column.key, dir: firstDirection(column.kind) };
}

/** A stored value is only a sort if it names a column this table has and a real direction. */
export function parseLibrarySort<T>(raw: string | null | undefined, columns: readonly LibrarySortColumn<T>[]): LibrarySort | null {
  if (!raw) return null;
  const at = raw.lastIndexOf(':');
  if (at <= 0) return null;
  const key = raw.slice(0, at);
  const dir = raw.slice(at + 1);
  if (dir !== 'asc' && dir !== 'desc') return null;
  if (!columns.some(c => c.key === key)) return null;
  return { key, dir };
}

export function serializeLibrarySort(sort: LibrarySort): string {
  return `${sort.key}:${sort.dir}`;
}

const isEmpty = (v: string | number | null | undefined) => v == null || v === '' || v === 0;

/**
 * The rows in the chosen order — or exactly as given when no column is chosen.
 *
 * Stable: rows that compare equal keep the caller's order, and the name breaks every tie before
 * that, so two drills "In 6 plans" read A–Z between themselves under a Plans sort.
 */
export function sortLibraryRows<T extends { name: string }>(
  rows: readonly T[],
  sort: LibrarySort | null,
  columns: readonly LibrarySortColumn<T>[],
): T[] {
  if (!sort) return [...rows];
  const column = columns.find(c => c.key === sort.key);
  if (!column) return [...rows];
  const sign = sort.dir === 'asc' ? 1 : -1;
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const compare = (a: T, b: T): number => {
    const va = column.get(a);
    const vb = column.get(b);
    const ea = isEmpty(va);
    const eb = isEmpty(vb);
    // The empties go last whichever way the arrow points — they are not the smallest value.
    if (ea && eb) return byName(a, b);
    if (ea) return 1;
    if (eb) return -1;
    let c: number;
    if (column.kind === 'text') c = String(va).localeCompare(String(vb));
    else if (column.kind === 'date') c = String(va) < String(vb) ? -1 : String(va) > String(vb) ? 1 : 0;
    else c = Number(va) - Number(vb);
    return c !== 0 ? c * sign : byName(a, b);
  };
  return [...rows].sort(compare);
}
