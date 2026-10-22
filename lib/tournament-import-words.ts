/**
 * THE IMPORT SHEET, IN WORDS — one home (Tournament admin redesign Stage 5, E10, A59; hub v45; the words are
 * /marketing's, `.probe/s5b/words-final.md` §10: the coach sheet's verbs, one shape across both portals).
 *
 *   - Each import lives with its data: Teams' Tools imports teams, the schedule's Tools imports games. Data
 *     tools retired.
 *   - Nothing changes until a clean preview is imported (today's rule); a row that can't import is fixed in the file.
 *     While one does, the foot says so where Import would be — never a greyed "Import 2 rows" that imports nothing.
 *   - THE PREVIEW IS A SUMMARY (owner, 2026-10-12 — the Import Preview Redraw sheet
 *     https://claude.ai/artifact/P6sgkHRLkKqKKA8guPaaa7, A1–A8 as recommended): one frame of group rows, Can't import ·
 *     To add · To update · No change, each with its count; only Can't import opens by itself. A note rows share is said
 *     once on its group (notes giving the same advice are one line); a note one row has stays on that row, and those
 *     rows lead their group. `previewGroups` below is that rule, pure.
 *
 * Pure, so a plain Node unit test reads it.
 */
export type ImportKind = 'teams' | 'games';
export type ImportVerb = 'create' | 'update' | 'unchanged' | 'blocked';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const noun = (k: ImportKind) => (k === 'teams' ? 'teams' : 'games');
/** A group row's title — the words a row's verb used, as a group: "Adds" became "To add". */
const GROUP_TITLES: Readonly<Record<ImportVerb, string>> = { blocked: 'Can’t import', create: 'To add', update: 'To update', unchanged: 'No change' };

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
  preview: 'Preview',
  missingStay: (k: ImportKind) => `${k === 'teams' ? 'Teams' : 'Games'} missing from this file stay as they are.`,
  /** The foot, in the Import button's place, while a row holds the file (owner, 2026-10-12): the count, then what to do. */
  blockedFoot: (n: number) =>
    `${plural(n, 'row', 'rows')} can’t import. Fix ${n === 1 ? 'it' : 'them'} in your file, then choose the file again.`,
  nothingChanges: 'Nothing in this file changes anything yet.',
  group: GROUP_TITLES,
  /** A group's button, for a screen reader: its group and its count (the 2 Sep fold ruling — a fold's button names it). */
  groupLabel: (key: ImportVerb, n: number) => `${GROUP_TITLES[key]}, ${plural(n, 'row', 'rows')}`,
  /** The group line for rows whose notes are their own: they lead the list when it opens. */
  ownNotes: (n: number) => (n === 1 ? '1 row has a note of its own, listed first.' : `${n} rows have a note of their own, listed first.`),
  row: (n: number) => `Row ${n}`,
  /** An emptied cell, old or new ("Notes: blank → Bring water"). */
  blank: 'blank',
  emailCoaches: 'Email the new teams’ coaches a link to their Coaches Portal (teams with an email address only)',
  importing: 'Importing…',
  importBare: 'Import',
  imported: (created: number, updated: number) =>
    `Imported: ${plural(created, 'added', 'added')} · ${plural(updated, 'updated', 'updated')}.`,
  emailed: (n: number) => ` Emailed ${plural(n, 'coach', 'coaches')} a portal link.`,
  /** A sheet's paid figure becomes a payment dated today; a refused one is said by row, and the rest of the import stands. */
  paymentsRecorded: (n: number) => ` Recorded ${plural(n, 'payment', 'payments')}.`,
  paymentRefused: (row: number, team: string, why: string) => `Row ${row}, ${team}: the payment wasn’t recorded. ${why}`,
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

/** "Import 22 rows" — the rows that change something (adds and updates). */
export const importAction = (n: number) => `Import ${plural(n, 'row', 'rows')}`;

/** "2 earlier imports". */
export const earlierLine = (n: number) => plural(n, 'earlier import', 'earlier imports');

/**
 * Notes that give the SAME advice are one line on a group (A3): the server says which column it matched for each, and
 * a group that names both would say one thing twice. Anything not listed here is said in the server's own words.
 */
const SAME_ADVICE: Readonly<Record<string, string>> = {
  'Home Team matched by name. Team ID is safer for future imports.': 'Teams matched by name. Team IDs are safer for future imports.',
  'Away Team matched by name. Team ID is safer for future imports.': 'Teams matched by name. Team IDs are safer for future imports.',
  'Venue matched by name. Venue ID is safer for future imports.': 'Venue and Facility matched by name. Their IDs are safer for future imports.',
  'Facility matched by name. Facility ID is safer for future imports.': 'Venue and Facility matched by name. Their IDs are safer for future imports.',
};
export const noteFor = (warning: string): string => SAME_ADVICE[warning] ?? warning;

/**
 * A changed column, named as the import's template names it (A4 — "the column as your file names it"): the preview
 * labels an ID column by its record ("Division"), and the file's own heading for the name is "Division Name".
 */
const COLUMN_FOR: Readonly<Record<string, string>> = { Division: 'Division Name', Venue: 'Venue Name', Facility: 'Facility Name' };
export const columnLabel = (field: string): string => COLUMN_FOR[field] ?? field;

/** "Start Time: 9:00 a.m. → 10:30 a.m." — the caller formats each value. */
export const changeLine = (field: string, before: string, after: string) => `${columnLabel(field)}: ${before} → ${after}`;

/** When the two sides READ the same (two long notes that differ past their cut), say only that the column changed. */
export const changedOnly = (field: string) => `${columnLabel(field)} changed`;

/** A closed To update says which columns change, and on how many rows: "Start Time on 22 rows · Facility Name on 10 rows". */
export function changedColumns(columns: readonly (readonly [string, number])[], max = 3): string {
  const shown = columns.slice(0, max).map(([column, n]) => `${column} on ${plural(n, 'row', 'rows')}`);
  const rest = columns.length - shown.length;
  return [...shown, ...(rest > 0 ? [plural(rest, 'more column', 'more columns')] : [])].join(' · ');
}

/** The order the groups read in: what you act on first, what changes nothing last (the 11 Oct grouping rule). */
export const GROUP_ORDER: readonly ImportVerb[] = ['blocked', 'create', 'update', 'unchanged'];

type GroupableRow = {
  operation: ImportVerb;
  warnings: readonly string[];
  changes: readonly { field: string }[];
};

export type PreviewGroup<R> = {
  key: ImportVerb;
  /** The group's rows: those with a note of their own first, then the file's order. */
  items: { row: R; ownNotes: string[] }[];
  /** Notes two or more rows share, said once on the group with their count (most rows first). */
  shared: { text: string; count: number }[];
  /** How many rows carry a note of their own. */
  ownCount: number;
  /** To update only: each changed column with how many rows change it (most first). */
  columns: [string, number][];
};

/**
 * THE PREVIEW'S GROUPS (A1, A3). Rows arrive in the file's order; a group with nothing in it is absent. A row that
 * can't import says its errors, never its notes (as before). Notes are grouped AFTER the same-advice merge and counted
 * once per row, so a game matched by name on both teams counts one row, not two. A LONE row's notes are said on its
 * group: "listed first" means nothing in a group of one (/review, 2026-10-12).
 */
export function previewGroups<R extends GroupableRow>(rows: readonly R[]): PreviewGroup<R>[] {
  const groups: PreviewGroup<R>[] = [];
  for (const key of GROUP_ORDER) {
    const inGroup = rows.filter(r => r.operation === key);
    if (inGroup.length === 0) continue;
    const notesOf = (r: R) => (key === 'blocked' ? [] : [...new Set(r.warnings.map(noteFor))]);
    const counts = new Map<string, number>();
    for (const r of inGroup) for (const note of notesOf(r)) counts.set(note, (counts.get(note) ?? 0) + 1);
    const onGroup = (note: string) => (counts.get(note) ?? 0) > 1 || inGroup.length === 1;
    const all = inGroup.map(r => ({ row: r, ownNotes: notesOf(r).filter(note => !onGroup(note)) }));
    const withOwn = all.filter(i => i.ownNotes.length > 0);
    const columns = new Map<string, number>();
    if (key === 'update') {
      for (const r of inGroup) for (const column of new Set(r.changes.map(c => columnLabel(c.field)))) columns.set(column, (columns.get(column) ?? 0) + 1);
    }
    groups.push({
      key,
      items: [...withOwn, ...all.filter(i => i.ownNotes.length === 0)],
      shared: [...counts].filter(([text]) => onGroup(text)).map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count),
      ownCount: withOwn.length,
      columns: [...columns].sort((a, b) => b[1] - a[1]),
    });
  }
  return groups;
}
