/**
 * Add or remove one key from a Set of open/expanded ids, returning a NEW Set.
 *
 * ⚠ WHY THIS IS SHARED. Six places in the coach Money hub had a byte-identical copy of this body —
 * the budget plan's collapsed categories and its List view's collapsed sections, a line's expanded
 * payment periods, Budget vs. Actual's expanded categories and lines, and the month grid's — and
 * they had ALREADY drifted into two spellings (`if/else` vs a ternary) before anyone noticed. One
 * definition means one place to be right, and one place for any future change ("also collapse the
 * siblings", "remember it per device") to land.
 *
 * Closed-set or open-set is the CALLER's decision, not this function's: the budget plan tracks what
 * is CLOSED so a category added later arrives open, while the grids track what is OPEN so a big
 * grid starts compact. Both are just membership.
 */
export function toggleKey<T>(prev: ReadonlySet<T>, key: T): Set<T> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}
