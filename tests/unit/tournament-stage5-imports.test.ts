/**
 * IMPORTS WHERE THEIR DATA LIVES; DATA TOOLS RETIRES (Tournament admin redesign Stage 5, Part 8 — E10, A59). What the
 * build must keep true:
 *   - one import sheet in the coach budget's shape: a template to start from, the file, a preview that says what each
 *     row will do, Import N rows, the earlier imports inside it;
 *   - Teams' Tools imports teams (P1, ruled at the build's start) and the schedule's Tools imports games; an empty
 *     list offers it too; the Export menu only exports; on the Tournament plan each row is the one Tools lock;
 *   - nothing changes until a clean preview is imported (today's rule);
 *   - Data tools retired: no rail row, its address opens Teams, its help article moved, the sandbox and the guidance
 *     no longer point at it; the old dialogs are gone.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  IMPORT_WORDS as W, changeLine, changedColumns, changedOnly, columnLabel, earlierLine, importAction, noteFor, previewGroups,
} from '../../lib/tournament-import-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const exists = (p: string) => existsSync(new URL(`../../${p}`, import.meta.url));

describe('the words (E10, the coach sheet\'s verbs)', () => {
  it('the action and the earlier imports', () => {
    assert.equal(importAction(22), 'Import 22 rows');
    assert.equal(importAction(1), 'Import 1 row');
    assert.equal(earlierLine(2), '2 earlier imports');
  });
  it('the preview is "Preview"; its groups and their words (owner, 2026-10-12, A1)', () => {
    assert.equal(W.preview, 'Preview');
    assert.deepEqual(W.group, { blocked: 'Can’t import', create: 'To add', update: 'To update', unchanged: 'No change' });
    assert.equal(W.groupLabel('create', 120), 'To add, 120 rows');
    assert.equal(W.groupLabel('blocked', 1), 'Can’t import, 1 row');
    assert.equal(W.ownNotes(1), '1 row has a note of its own, listed first.');
    assert.equal(W.ownNotes(2), '2 rows have a note of their own, listed first.');
  });
  it('a change names the column as the file does, with its old and new value (A4)', () => {
    assert.equal(columnLabel('Facility'), 'Facility Name');
    assert.equal(columnLabel('Division'), 'Division Name');
    assert.equal(columnLabel('Start Time'), 'Start Time');
    assert.equal(changeLine('Start Time', '9:00 a.m.', '10:30 a.m.'), 'Start Time: 9:00 a.m. → 10:30 a.m.');
    // Two sides that read the same (long notes differing past their cut) say only that the column changed (/review).
    assert.equal(changedOnly('Notes'), 'Notes changed');
    assert.equal(changedOnly('Division'), 'Division Name changed');
    assert.equal(changedColumns([['Start Time', 22], ['Facility Name', 10]]), 'Start Time on 22 rows · Facility Name on 10 rows');
    assert.equal(changedColumns([['A', 3], ['B', 2], ['C', 1], ['D', 1], ['E', 1]]), 'A on 3 rows · B on 2 rows · C on 1 row · 2 more columns');
  });
  it('while a row can\'t import, the foot counts them and says what to do (owner, 2026-10-12)', () => {
    assert.equal(W.blockedFoot(1), '1 row can’t import. Fix it in your file, then choose the file again.');
    assert.equal(W.blockedFoot(3), '3 rows can’t import. Fix them in your file, then choose the file again.');
  });
  it('the doors', () => {
    assert.equal(W.door('teams'), 'Import teams from a spreadsheet');
    assert.equal(W.door('games'), 'Import games from a spreadsheet');
  });
});

describe('the preview\'s groups (A1, A3)', () => {
  const HOME = 'Home Team matched by name. Team ID is safer for future imports.';
  const AWAY = 'Away Team matched by name. Team ID is safer for future imports.';
  const TURNOVER = 'Inside the turnover after the game before it on this field. Earliest clean start is 10:45 a.m.';
  type Row = { rowNumber: number; operation: 'create' | 'update' | 'unchanged' | 'blocked'; warnings: string[]; changes: { field: string }[] };
  const row = (rowNumber: number, operation: Row['operation'], warnings: string[] = [], changes: string[] = []): Row =>
    ({ rowNumber, operation, warnings, changes: changes.map(field => ({ field })) });

  it('Can\'t import leads, then To add, To update, No change; an empty group is absent', () => {
    const groups = previewGroups([row(2, 'create'), row(3, 'unchanged'), row(4, 'blocked'), row(5, 'create')]);
    assert.deepEqual(groups.map(g => g.key), ['blocked', 'create', 'unchanged']);
    assert.deepEqual(groups[1].items.map(i => i.row.rowNumber), [2, 5], 'the file\'s order inside a group');
  });
  it('the same advice is one note, said once with its count; a row counts once', () => {
    assert.equal(noteFor(HOME), noteFor(AWAY));
    const [adds] = previewGroups([row(2, 'create', [HOME, AWAY]), row(3, 'create', [HOME, AWAY])]);
    assert.deepEqual(adds.shared, [{ text: 'Teams matched by name. Team IDs are safer for future imports.', count: 2 }]);
    assert.equal(adds.ownCount, 0);
  });
  it('a note only one row has stays on that row, and that row leads its group', () => {
    const [adds] = previewGroups([row(2, 'create', [HOME]), row(3, 'create', [HOME, TURNOVER]), row(4, 'create', [HOME])]);
    assert.deepEqual(adds.items.map(i => i.row.rowNumber), [3, 2, 4]);
    assert.deepEqual(adds.items[0].ownNotes, [TURNOVER]);
    assert.equal(adds.ownCount, 1);
    assert.equal(adds.shared[0].count, 3);
  });
  it('a lone row\'s note is said on its group, never "listed first" in a group of one (/review)', () => {
    const [adds] = previewGroups([row(2, 'create', [TURNOVER])]);
    assert.deepEqual(adds.shared, [{ text: TURNOVER, count: 1 }]);
    assert.equal(adds.ownCount, 0);
    assert.deepEqual(adds.items[0].ownNotes, []);
  });
  it('a row that can\'t import says its errors, never its notes', () => {
    const [blocked] = previewGroups([row(4, 'blocked', [HOME])]);
    assert.deepEqual(blocked.shared, []);
    assert.deepEqual(blocked.items[0].ownNotes, []);
  });
  it('To update counts each changed column once per row, by the file\'s name for it', () => {
    const [updates] = previewGroups([row(2, 'update', [], ['Start Time', 'Facility']), row(3, 'update', [], ['Start Time'])]);
    assert.deepEqual(updates.columns, [['Start Time', 2], ['Facility Name', 1]]);
  });
});

describe('the sheet (E10)', () => {
  const sheet = code('components/admin/tournament/ImportSheet.tsx');
  it('reads the file at once and changes nothing until Import, only from a clean preview', () => {
    assert.match(sheet, /onChange=\{e => \{ const f = e\.target\.files\?\.\[0\]; if \(f\) void read\(f\); \}\}/);
    assert.match(sheet, /if \(!preview\?\.canCommit \|\| importing \|\| result \|\| changing === 0\) return;/);
    assert.match(sheet, /\/commit\?/);
  });
  it('a row that can\'t import: the foot says so in Import\'s place, and the row leads the preview (owner, 2026-10-12)', () => {
    // In the foot, seen at any scroll — not under a list of up to twenty rows.
    const foot = sheet.slice(sheet.indexOf('footer={'), sheet.indexOf('<FormError>'));
    assert.match(foot, /\{blocked > 0 && <p className=\{styles\.blockedFoot\} role="alert">\{W\.blockedFoot\(blocked\)\}<\/p>\}/);
    // Never a greyed "Import 2 rows" that imports nothing: the button is absent while a row holds the file.
    assert.match(foot, /\{blocked === 0 && \(\s*<button[^>]*onClick=\{\(\) => void doImport\(\)\}/);
    assert.equal((sheet.match(/W\.blockedFoot/g) ?? []).length, 1, 'said once, in the foot');
  });
  it('the preview is one frame of group rows; only Can\'t import opens by itself (owner, 2026-10-12, A1, A2)', () => {
    assert.match(sheet, /const groups = previewGroups\(preview\?\.rows \?\? \[\]\);/);
    assert.match(sheet, /<RecordSection title=\{W\.preview\}>/);
    // Open: Can't import alone, when the sheet opens and again for every file read.
    assert.match(sheet, /useState<ReadonlySet<ImportVerb>>\(\(\) => new Set<ImportVerb>\(\['blocked'\]\)\)/);
    assert.match(sheet, /setOpen\(new Set<ImportVerb>\(\['blocked'\]\)\);/);
    // A fold's button is a real button that says whether it is open and names its group (the 2 Sep fold ruling).
    assert.match(sheet, /aria-expanded=\{isOpen\}/);
    assert.match(sheet, /aria-label=\{W\.groupLabel\(g\.key, g\.items\.length\)\}/);
    // An open group shows twenty rows, then its own "Show all".
    assert.match(sheet, /\(all \? g\.items : g\.items\.slice\(0, FIRST_ROWS\)\)/);
    // A change keeps its cents, and two sides that read the same say only that the column changed (/review).
    assert.match(sheet, /Number\.isInteger\(n\) \? formatMoney\(n\) : CENTS\.format\(n\)/);
    assert.match(sheet, /before === after \? changedOnly\(c\.field\) : changeLine\(c\.field, before, after\)/);
    // The lines under a group's title describe its button to a screen reader.
    assert.match(sheet, /aria-describedby=\{hasAbout \? aboutId : undefined\}/);
    // Only Can't import carries a mark.
    assert.match(sheet, /\{g\.key === 'blocked' && <TriangleAlert size=\{16\} \/>\}/);
  });
  it('on a phone, reading a file brings the preview up (A8); the template row is one height (A5)', () => {
    assert.match(sheet, /window\.matchMedia\('\(max-width: 640px\)'\)\.matches/);
    assert.match(sheet, /scrollIntoView\(\{ block: 'start'/);
    assert.equal((sheet.match(/className=\{`\$\{ck\.select\} \$\{ck\.toolbarSelect\}`\}/g) ?? []).length, 2);
    const css = read('components/admin/tournament/ImportSheet.module.css');
    assert.match(css, /\.templateRow > label:nth-child\(2\) \{ flex: 0 0 5\.5rem; \}/);
  });
  it('the earlier imports are this kind\'s, the ones that went in or failed', () => {
    assert.match(sheet, /imports\/history\?\$\{org\}&limit=20&kind=\$\{IMPORT_TYPE\[kind\]\}&applied=1/);
    const route = code('app/api/admin/tournaments/[tournamentId]/imports/history/route.ts');
    assert.match(route, /if \(url\.searchParams\.get\('applied'\) === '1'\) query = query\.in\('status', \['committed', 'failed'\]\);/);
  });
  it('the old dialogs are gone', () => {
    assert.equal(exists('components/admin/import/TournamentTeamsImportDialog.tsx'), false);
    assert.equal(exists('components/admin/import/TournamentScheduleImportDialog.tsx'), false);
  });
});

describe('each import lives with its data (A59)', () => {
  it('Teams\' Tools opens the sheet for teams — and only Tools (owner, 2026-10-12); Export only exports', () => {
    const teams = code('app/[orgSlug]/admin/tournaments/registrations/page.tsx');
    assert.match(teams, /label=\{IMPORT_WORDS\.door\('teams'\)\} hint=\{IMPORT_WORDS\.doorHint\}/);
    assert.match(teams, /<PlanLockedTool name=\{IMPORT_WORDS\.door\('teams'\)\}/);
    assert.doesNotMatch(teams, /hasImportOption|importLabel=/);
    assert.doesNotMatch(code('components/admin/ExportMenu.tsx'), /hasImportOption|onImport/);
    // The empty list's second button (drawn with E10, beside Add my team) went the schedule's way.
    assert.doesNotMatch(teams, /<ImportDoor\b/);
    assert.doesNotMatch(code('components/admin/tournament/ImportSheet.tsx'), /export function ImportDoor/);
    assert.match(teams, /<ImportSheet\s+kind="teams"/);
    assert.doesNotMatch(teams, /data-tools/);
  });
  it('the schedule\'s Tools opens the sheet for games — and only Tools (owner, 2026-10-12)', () => {
    const schedule = code('app/[orgSlug]/admin/tournaments/schedule/page.tsx');
    assert.match(schedule, /label=\{IMPORT_WORDS\.door\('games'\)\}/);
    assert.match(schedule, /lockedTool\(IMPORT_WORDS\.door\('games'\)\)/);
    assert.match(schedule, /<PlanLockedTool name=\{name\}/);
    // An empty schedule offered a second button beside the "No games scheduled yet" note.
    assert.doesNotMatch(schedule, /<ImportDoor\b/);
    assert.match(schedule, /<ImportSheet\s+kind="games"/);
  });
});

describe('Data tools retires (A59)', () => {
  it('its address opens Teams; its rail row, sandbox key and guidance shortcut are gone', () => {
    assert.match(code('app/[orgSlug]/admin/tournaments/data-tools/page.tsx'), /redirect\(`\/\$\{encodeURIComponent\(orgSlug\)\}\/admin\/tournaments\/registrations`\)/);
    assert.doesNotMatch(code('components/admin/admin-nav-config.ts'), /key: 'data-tools'/);
    assert.doesNotMatch(code('lib/sandbox-curation.ts'), /'data-tools'/);
    assert.doesNotMatch(read('lib/tournament-guidance.ts'), /data-tools-imports/);
  });
  it('its help article moved into Teams\' and the schedule\'s topics', () => {
    const help = read('lib/help-content/tournaments.tsx');
    assert.doesNotMatch(help, /id: 'data-tools-imports'/);
    assert.match(help, /id: 'import-teams'/);
    assert.match(help, /id: 'import-games'/);
    assert.match(help, /id: 'faq-import-current-vs-empty'/);
  });
});
