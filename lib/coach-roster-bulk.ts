import { getCell } from './import/tabular.ts';
import { splitTypedName } from './coach-roster-name';
import type { ParsedImportFile } from './import/types.ts';

/**
 * Bulk roster intake for the premium coaches portal (Batch 2, P0 #7).
 *
 * Two front doors, one draft shape:
 *   - `parseRosterPaste`     — a coach pastes their team list. Runs CLIENT-side so the
 *                              preview updates as they type, with no network round trip.
 *   - `rowsFromParsedImportFile` — a `.csv`/`.xlsx` uploaded and parsed SERVER-side by the
 *                              existing `lib/import` parsers, then mapped through the same shape.
 *
 * Both land in the same preview table, are validated by the same `validateDraftRoster`, and are
 * written by the same commit endpoint — so there is one set of rules, not two half-features.
 *
 * Deliberately NOT parsed out of pasted free text: emails, phone numbers, dates of birth, and
 * positions. Guessing personal data out of prose produces confident wrong answers about real
 * families; those fields arrive through the spreadsheet's labelled columns (or per player).
 */

/** Upper bound on one intake, mirroring the `maxRows` guard the file importers use. */
export const MAX_BULK_ROSTER_ROWS = 200;

export type DraftRosterPlayer = {
  /** 1-based position in the paste / source file — shown in the preview and in commit errors. */
  rowNumber: number;
  playerFirstName: string;
  playerLastName: string;
  playerNumber: string;
  /** File-only fields. The paste flow always leaves these blank. */
  primaryPosition: string;
  playerDateOfBirth: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string;
  notes: string;
};

export type DraftRosterIssues = {
  /** Blocks this row from being created; every other row still goes through. */
  errors: string[];
  /** Worth a look, never blocking. */
  warnings: string[];
};

export type ValidatedDraftRow = DraftRosterPlayer & DraftRosterIssues;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A jersey is 1-4 chars, digits with an optional trailing letter (e.g. "7", "00", "12A"). */
const JERSEY_RE = /^\d{1,3}[A-Za-z]?$/;

export function blankDraftRow(rowNumber: number): DraftRosterPlayer {
  return {
    rowNumber,
    playerFirstName: '', playerLastName: '', playerNumber: '',
    primaryPosition: '', playerDateOfBirth: '',
    guardianFirstName: '', guardianLastName: '', guardianEmail: '', guardianPhone: '',
    notes: '',
  };
}

/**
 * Read one pasted line. Recognized shapes:
 *   `12 Jordan Smith` · `Jordan Smith 12` · `Jordan Smith` · `Jordan, Smith, 12` · `12<TAB>Jordan<TAB>Smith`
 *
 * A jersey is only taken from the HEAD or TAIL of a single-column line, so a name that merely
 * contains a number is left intact for the coach to fix in the preview rather than mangled.
 */
export function parseRosterLine(line: string, rowNumber: number): DraftRosterPlayer | null {
  // Strip separators hanging off either end first, so a stray `, Bianchi` reads as the name
  // "Bianchi" instead of a player whose first name is a comma.
  const trimmed = line.trim().replace(/^[\s,;|\t]+/, '').replace(/[\s,;|\t]+$/, '');
  if (!trimmed) return null;

  const row = blankDraftRow(rowNumber);
  const columns = trimmed.split(/\t|,/).map(part => part.trim()).filter(Boolean);

  if (columns.length >= 2) {
    // Explicit columns. A jersey may sit in any single cell; the rest are name parts in order.
    const jerseyIndex = columns.findIndex(part => JERSEY_RE.test(part));
    const nameParts = columns.filter((_, i) => i !== jerseyIndex);
    if (jerseyIndex >= 0) row.playerNumber = columns[jerseyIndex];
    if (nameParts.length >= 2) {
      row.playerFirstName = nameParts[0];
      row.playerLastName = nameParts.slice(1).join(' ');
    } else if (nameParts.length === 1) {
      const { first, last } = splitTypedName(nameParts[0]);
      row.playerFirstName = first;
      row.playerLastName = last;
    }
    return row;
  }

  // Single column: peel a standalone jersey token off the front or the back.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  // A line that is ONLY a number is a jersey with no player — kept as a row so the coach sees
  // "a first name is required" against it, rather than gaining a player named "7".
  if (tokens.length === 1 && JERSEY_RE.test(tokens[0])) {
    row.playerNumber = tokens[0];
    return row;
  }
  if (tokens.length > 1 && JERSEY_RE.test(tokens[0])) {
    row.playerNumber = tokens.shift()!;
  } else if (tokens.length > 1 && JERSEY_RE.test(tokens[tokens.length - 1])) {
    row.playerNumber = tokens.pop()!;
  }
  const { first, last } = splitTypedName(tokens.join(' '));
  // "12 12" would otherwise peel the first number as a jersey and leave a player named "12".
  // A name made only of digits is not a name — leave it blank so the row is flagged, not created.
  if (first && !last && JERSEY_RE.test(first)) return row;
  row.playerFirstName = first;
  row.playerLastName = last;
  return row;
}

/** Parse a whole pasted block, one player per line. Blank lines are skipped, not numbered. */
export function parseRosterPaste(text: string): DraftRosterPlayer[] {
  const rows: DraftRosterPlayer[] = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const row = parseRosterLine(line, rows.length + 1);
    if (row) rows.push(row);
    if (rows.length >= MAX_BULK_ROSTER_ROWS) break;
  }
  return rows;
}

/**
 * Column aliases for the spreadsheet path. Matched through `normalizeHeader`, so casing,
 * punctuation, and parenthetical notes in a header cell don't matter.
 */
const COLUMN_ALIASES: Record<keyof Omit<DraftRosterPlayer, 'rowNumber'>, string[]> = {
  playerFirstName:   ['first name', 'first', 'player first name', 'given name', 'player'],
  playerLastName:    ['last name', 'last', 'player last name', 'surname', 'family name'],
  playerNumber:      ['jersey', 'jersey number', 'number', '#', 'no', 'player number'],
  primaryPosition:   ['position', 'primary position', 'pos'],
  playerDateOfBirth: ['date of birth', 'dob', 'birthdate', 'birth date'],
  guardianFirstName: ['guardian first name', 'parent first name', 'guardian first', 'parent first'],
  guardianLastName:  ['guardian last name', 'parent last name', 'guardian last', 'parent last'],
  guardianEmail:     ['guardian email', 'parent email', 'email', 'contact email'],
  guardianPhone:     ['guardian phone', 'parent phone', 'phone', 'contact phone', 'mobile'],
  notes:             ['notes', 'note', 'comment', 'comments'],
};

/**
 * Map a parsed `.csv`/`.xlsx` file onto draft rows.
 *
 * A file with a single "Name"/"Player" column and no separate last-name column is split the same
 * way a pasted line is, so a one-column export still works. Position is carried as free text —
 * sport vocabulary belongs to the Sport Pack at the picker, never to a parser.
 */
export function rowsFromParsedImportFile(file: ParsedImportFile): DraftRosterPlayer[] {
  const rows: DraftRosterPlayer[] = [];
  file.rows.forEach((source, index) => {
    const row = blankDraftRow(index + 1);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
      keyof Omit<DraftRosterPlayer, 'rowNumber'>, string[],
    ][]) {
      row[field] = getCell(source, aliases).value;
    }
    // One combined name column, no separate surname column → split it.
    if (row.playerFirstName && !row.playerLastName && !getCell(source, COLUMN_ALIASES.playerLastName).present) {
      const { first, last } = splitTypedName(row.playerFirstName);
      row.playerFirstName = first;
      row.playerLastName = last;
    }
    rows.push(row);
  });
  return rows.slice(0, MAX_BULK_ROSTER_ROWS);
}

/** The subset of an existing roster player this validator needs. */
export type ExistingRosterEntry = {
  playerFirstName: string | null;
  playerLastName: string | null;
  playerNumber: string | null;
};

function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first ?? '', last ?? ''].map(part => part.trim()).filter(Boolean).join(' ');
}

/**
 * Attach per-row errors and warnings.
 *
 * Jersey clashes are surfaced BEFORE anything is written — both inside the paste and against the
 * players already on the roster. The single-player form only ever flagged duplicates after saving
 * (readiness-review finding f1-7), so this is the first place a coach is told in time to fix it.
 */
export function validateDraftRoster(
  rows: DraftRosterPlayer[],
  existing: ExistingRosterEntry[] = [],
): ValidatedDraftRow[] {
  // Jerseys compare case-insensitively so "12a" and "12A" are recognised as the same shirt.
  const numberKey = (value: string) => value.trim().toUpperCase();
  const existingByNumber = new Map<string, string>();
  for (const player of existing) {
    const number = numberKey(player.playerNumber ?? '');
    if (number && !existingByNumber.has(number)) {
      existingByNumber.set(number, fullName(player.playerFirstName, player.playerLastName) || 'another player');
    }
  }
  const existingNames = new Set(
    existing.map(player => fullName(player.playerFirstName, player.playerLastName).toLowerCase()).filter(Boolean),
  );

  // Numbers used more than once WITHIN this batch.
  const batchCounts = new Map<string, number>();
  for (const row of rows) {
    const number = numberKey(row.playerNumber);
    if (number) batchCounts.set(number, (batchCounts.get(number) ?? 0) + 1);
  }

  return rows.map(row => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const number = numberKey(row.playerNumber);
    const name = fullName(row.playerFirstName, row.playerLastName);

    if (!row.playerFirstName.trim()) {
      errors.push('A first name is required — this row won’t be added.');
    }
    if (number) {
      if ((batchCounts.get(number) ?? 0) > 1) warnings.push(`#${number} is used more than once in this list.`);
      const held = existingByNumber.get(number);
      if (held) warnings.push(`#${number} is already worn by ${held}.`);
    }
    if (name && existingNames.has(name.toLowerCase())) {
      warnings.push(`${name} is already on your roster.`);
    }
    if (row.guardianEmail.trim() && !EMAIL_RE.test(row.guardianEmail.trim())) {
      // Guardian fields aren't editable in the preview (only spreadsheets carry them), so say
      // where it can actually be fixed rather than implying it's correctable here.
      warnings.push('That guardian email doesn’t look right — fix it on the player after adding.');
    }

    return { ...row, errors, warnings };
  });
}

/** Rows that will actually be created (everything without a blocking error). */
export function committableRows(rows: ValidatedDraftRow[]): ValidatedDraftRow[] {
  return rows.filter(row => row.errors.length === 0);
}

/** Column headings for the downloadable spreadsheet template — the aliases' canonical spelling. */
export const BULK_ROSTER_TEMPLATE_HEADERS = [
  'First Name', 'Last Name', 'Jersey', 'Position', 'Date of Birth',
  'Guardian First Name', 'Guardian Last Name', 'Guardian Email', 'Guardian Phone', 'Notes',
] as const;
