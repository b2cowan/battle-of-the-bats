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
