/**
 * The room's Prev / Next answer — pure, so the walk order a room offers can be pinned by a unit
 * test instead of trusted (List · Room · Question, D6: named destinations + a position count).
 *
 * ⚠ THE ORDER IS THE LIST'S ORDER AS THE COACH SEES IT. A room opened from a filtered list walks
 * that filtered list — "overdue bills only" reads as exactly that — so callers pass the rows they
 * RENDERED, never the unfiltered set. The names on the arrows are what make the filter legible.
 */
export interface RoomNeighbour {
  id: string;
  label: string;
}

export interface RoomNeighbours {
  prev: RoomNeighbour | null;
  next: RoomNeighbour | null;
  /** 1-based position of the open record in the list; 0 when it is not in the list. */
  index: number;
  total: number;
}

export function roomNeighbours<T>(
  list: readonly T[],
  currentId: string | null,
  id: (row: T) => string,
  label: (row: T) => string,
): RoomNeighbours {
  const total = list.length;
  const at = currentId === null ? -1 : list.findIndex(row => id(row) === currentId);
  if (at < 0) return { prev: null, next: null, index: 0, total };
  const toNeighbour = (row: T | undefined): RoomNeighbour | null =>
    row === undefined ? null : { id: id(row), label: label(row) };
  return {
    prev: toNeighbour(list[at - 1]),
    next: toNeighbour(list[at + 1]),
    index: at + 1,
    total,
  };
}
