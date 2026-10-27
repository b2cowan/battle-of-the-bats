/**
 * A spreadsheet cell that can never run as a formula (Support console Stage 7 Part 9, threat 3). A file of strangers'
 * words — a lead's name, organization or notes — is opened in Excel; a cell that starts with `=`, `+`, `-`, `@`, a tab or
 * a return can run there. Such a value gets a leading apostrophe, which Excel shows as text and never evaluates. Applied
 * to every column of an export a stranger's words can reach, before it is written as CSV or Excel.
 */
const RISKY_START = /^[=+\-@\t\r]/;

export function formulaSafe<T extends string | number | null | undefined>(value: T): T | string {
  if (typeof value !== 'string') return value;
  return RISKY_START.test(value) ? `'${value}` : value;
}

export function formulaSafeRow<T extends string | number | null | undefined>(row: T[]): (T | string)[] {
  return row.map(formulaSafe);
}
