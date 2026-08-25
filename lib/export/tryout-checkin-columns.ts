/**
 * lib/export/tryout-checkin-columns.ts
 * What the printed tryout check-in sheet has columns for — ONE home, shared by the page that
 * prints it and the tests that hold it to its promises.
 *
 * ⚠ It exists because a privacy assertion that checks the TEST'S OWN copy of a column list
 * proves nothing: production can regress freely and the test still passes (found in the Rosters
 * pass, QA §86). The page imports these; so does the contract test.
 *
 * Two promises live here:
 *  1. **The tick column is named, not abbreviated.** "In" is two characters, so the fit
 *     contract's measured floor gave the one column a volunteer actually marks less width than
 *     the always-empty Notes column beside it. Its name is what earns it its width.
 *  2. **No contact details, ever.** Bib, name, age — the same privacy floor as the two tryout
 *     registers. No date of birth, no guardian, no email, no phone.
 */

/** The heading on the column a volunteer marks. Also the column that prints a pen box. */
export const CHECKIN_TICK_HEADING = 'Checked in';

/** Columns that must NEVER appear on this sheet, however the page evolves. */
export const CHECKIN_FORBIDDEN_HEADINGS = [
  'Date of Birth', 'Date of birth', 'DOB',
  'Guardian', 'Guardian Name', 'Guardian Email', 'Guardian Phone', 'Email', 'Phone',
] as const;

/**
 * The sheet's columns. A blind tryout drops the Player column — the whole point of blind
 * evaluation — and the bib number carries the identity instead.
 */
export function checkinSheetHeadings(blind: boolean): string[] {
  return blind
    ? ['Bib', 'Age', CHECKIN_TICK_HEADING, 'Notes']
    : ['Bib', 'Player', 'Age', CHECKIN_TICK_HEADING, 'Notes'];
}

/** Which column prints the hand-marked box, for the report contract's `penColumns`. */
export function checkinTickColumn(blind: boolean): number {
  return checkinSheetHeadings(blind).indexOf(CHECKIN_TICK_HEADING);
}
