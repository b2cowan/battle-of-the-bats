/**
 * The two roster documents' column lists — ONE home, so the privacy guarantee is testable.
 *
 * The Rosters pass (PDF Export Quality Phase 2) split the team roster into a **wall copy** and a
 * **contacts sheet**. The whole point of that split is a promise: *nothing on the wall copy is
 * private*. A promise a test asserts against its own copy of the list is not a promise at all —
 * the production headers could drift back to printing dates of birth and the test would still
 * pass. So the lists live here and BOTH the roster page and `tests/unit/pdf-export-contract`
 * import them.
 *
 * Order is the print order. `Player` is one column, not First + Last — merging them is what buys
 * back enough width for the contacts sheet to print every value whole at readable density.
 */

/** The default roster PDF. Safe to pin to a dugout wall, a rink board, a check-in table. */
export const ROSTER_WALL_HEADERS = ['#', 'Player', 'Primary', 'Secondary', 'Status'] as const;

/** Anything on the wall copy that would make it unsafe to leave lying around. */
export const ROSTER_PRIVATE_HEADINGS = ['Date of Birth', 'Guardian', 'Email', 'Phone'] as const;

/**
 * The submission sheet: what a club sends an association or an insurer.
 *
 * `includeGuardian` is the club's own PDF setting — turned off, the three guardian columns go and
 * the date of birth stays, because DOB is the fact this document exists for.
 *
 * ⚠ `Secondary` is deliberately absent. With it this table runs nine columns, and at readable
 * density on landscape that squeezed the date column until every birthdate broke across two lines
 * ("2013-01-1 / 0"). No association asks for a secondary position; every one of them asks for a
 * date that can be read.
 */
export function rosterContactHeaders(includeGuardian: boolean): string[] {
  return [
    '#', 'Player', 'Date of Birth', 'Primary',
    ...(includeGuardian ? ['Guardian', 'Email', 'Phone'] : []),
    'Status',
  ];
}
