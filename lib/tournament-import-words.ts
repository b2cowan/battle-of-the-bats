/**
 * THE IMPORT SHEET, IN WORDS — one home (Tournament admin redesign Stage 5, E10, A59; hub v45; the words are
 * /marketing's, `.probe/s5b/words-final.md` §10: the coach sheet's verbs, one shape across both portals).
 *
 *   - Each import lives with its data: Teams' Tools imports teams, the schedule's Tools imports games. Data
 *     tools retired.
 *   - Nothing changes until a clean preview is imported (today's rule); a row that can't import is fixed in the file.
 *     While one does, the foot says so where Import would be — never a greyed "Import 2 rows" that imports nothing.
 *   - Rows: Adds / Updates / No change / Can't import, and why.
 *
 * Pure, so a plain Node unit test reads it.
 */
export type ImportKind = 'teams' | 'games';
export type ImportVerb = 'create' | 'update' | 'unchanged' | 'blocked';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const noun = (k: ImportKind) => (k === 'teams' ? 'teams' : 'games');

export const IMPORT_WORDS = {
  title: (k: ImportKind) => (k === 'teams' ? 'Import teams' : 'Import games'),
  identity: (event: string) => `From a spreadsheet · ${event}`,
  door: (k: ImportKind) => (k === 'teams' ? 'Import teams from a spreadsheet' : 'Import games from a spreadsheet'),
  doorHint: 'Start from a template; nothing changes until you import',
  template: 'Start from a template',
  templateCurrent: (k: ImportKind) => `This event’s ${noun(k)}, to update them`,
  templateEmpty: (k: ImportKind) => `An empty template, for new ${noun(k)}`,
  format: 'Format',
  excel: 'Excel',
  csv: 'CSV',
  download: 'Download template',
  file: 'Your file',
  choose: 'Choose a file',
  chooseAnother: 'Choose another file',
  reading: 'Reading your file…',
  fileLine: (name: string, rows: number) => `${name} · ${plural(rows, 'row', 'rows')}`,
  verb: { create: 'Adds', update: 'Updates', unchanged: 'No change', blocked: 'Can’t import' } as Record<ImportVerb, string>,
  missingStay: (k: ImportKind) => `${k === 'teams' ? 'Teams' : 'Games'} missing from this file stay as they are.`,
  /** The foot, in the Import button's place, while a row holds the file (owner, 2026-10-12): the count, then what to do. */
  blockedFoot: (n: number) =>
    `${plural(n, 'row', 'rows')} can’t import. Fix ${n === 1 ? 'it' : 'them'} in your file, then choose the file again.`,
  nothingChanges: 'Nothing in this file changes anything yet.',
  emailCoaches: 'Email the new teams’ coaches a link to their Coaches Portal (teams with an email address only)',
  importing: 'Importing…',
  importBare: 'Import',
  imported: (created: number, updated: number) =>
    `Imported: ${plural(created, 'added', 'added')} · ${plural(updated, 'updated', 'updated')}.`,
  emailed: (n: number) => ` Emailed ${plural(n, 'coach', 'coaches')} a portal link.`,
  showAll: (n: number) => `Show all ${plural(n, 'row', 'rows')}`,
  earlierTitle: 'Earlier imports',
  earlierFailed: 'The earlier imports didn’t load.',
  importedOn: 'Imported',
  failedOn: 'Didn’t import',
  cancel: 'Cancel',
  done: 'Done',
  previewFailed: 'Couldn’t read that file. Check it is the template’s Excel or CSV, then choose it again.',
  importFailed: 'Couldn’t import it. Nothing was changed.',
  unmatched: (n: number, fieldWord: string) =>
    `${n === 1 ? '1 field name' : `${n} field names`} didn’t match this tournament’s ${fieldWord}`,
  unmatchedLine: 'They import as typed text and aren’t checked for double-bookings. Exact matches were linked to real fields.',
  unmatchedRow: (name: string, rows: number) => `“${name}” · ${plural(rows, 'game', 'games')}`,
  ambiguous: ' (matches more than one field)',
} as const;

/** "Preview · 18 to add · 4 to update · nothing blocked" (or "· 2 can't import"). */
export function previewHead(creates: number, updates: number, blocked: number): string {
  return `Preview · ${creates} to add · ${updates} to update · ${blocked === 0 ? 'nothing blocked' : `${blocked} can’t import`}`;
}

/** "Import 22 rows" — the rows that change something (adds and updates). */
export const importAction = (n: number) => `Import ${plural(n, 'row', 'rows')}`;

/** "2 earlier imports". */
export const earlierLine = (n: number) => plural(n, 'earlier import', 'earlier imports');

/** A preview row's line: its verb, then what changes or why it can't import. */
export function rowCaption(op: ImportVerb, changedFields: readonly string[], errors: readonly string[], warnings: readonly string[]): string {
  const verb = IMPORT_WORDS.verb[op];
  const why = op === 'blocked' ? errors.join(' ') : op === 'update' ? changedFields.slice(0, 3).join(', ') + (changedFields.length > 3 ? ` and ${changedFields.length - 3} more` : '') : '';
  const warn = op !== 'blocked' && warnings.length ? ` · ${warnings[0]}` : '';
  return `${verb}${why ? ` · ${why}` : ''}${warn}`;
}
