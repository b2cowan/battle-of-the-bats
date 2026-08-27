/**
 * "Last, First" — the one assembly for a roster player's picker/list name.
 *
 * Three call sites were each writing `[last, first].filter(Boolean).join(', ')` by hand (the
 * money form's Paid-by picker, the recording conversation's players, the installment generator's
 * roster list) — three spots to keep in sync over a formatting fact with exactly one right answer
 * (/simplify, 2026-08-23). Either half may be blank on a partially-entered roster row; the join
 * simply omits it.
 */
export function formatPlayerLastFirst(
  p: { playerFirstName?: string | null; playerLastName?: string | null },
): string {
  return [p.playerLastName, p.playerFirstName].filter(Boolean).join(', ');
}

/**
 * "First Last" — the same fact in the order PROSE reads it, for a sentence rather than a list.
 *
 * ⚠ A SECOND FUNCTION, NOT A FLAG ON THE FIRST, because the two answer different questions: a
 * picker and a column sort by surname, a sentence about a household does not. "Test, Avery's
 * family" is not English.
 *
 * ⚠ IT RETURNS '' FOR AN UNKNOWN PLAYER, DELIBERATELY, and callers must fall back with a WHOLE
 * PHRASE rather than a substituted name (`/review`, 2026-08-16): the money form once substituted
 * the string "that family" into "<name>'s family" and printed "that family's family" whenever the
 * roster had not loaded. A missing name should cost the possessive, not the grammar.
 *
 * Three copies of this join appeared in the money panel in one release (money centralization P4) —
 * the consequence line, the payments drawer and the pre-existing out-of-pocket branch — which is
 * the same regrowth the sibling above was extracted to stop.
 */
export function formatPlayerFirstLast(
  p: { playerFirstName?: string | null; playerLastName?: string | null } | undefined | null,
): string {
  if (!p) return '';
  return [p.playerFirstName, p.playerLastName].filter(Boolean).join(' ');
}
