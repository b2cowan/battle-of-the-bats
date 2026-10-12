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
import { IMPORT_WORDS as W, earlierLine, importAction, previewHead, rowCaption } from '../../lib/tournament-import-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const exists = (p: string) => existsSync(new URL(`../../${p}`, import.meta.url));

describe('the words (E10, the coach sheet\'s verbs)', () => {
  it('the preview head, the action and the earlier imports', () => {
    assert.equal(previewHead(18, 4, 0), 'Preview · 18 to add · 4 to update · nothing blocked');
    assert.equal(previewHead(1, 0, 2), 'Preview · 1 to add · 0 to update · 2 can’t import');
    assert.equal(importAction(22), 'Import 22 rows');
    assert.equal(importAction(1), 'Import 1 row');
    assert.equal(earlierLine(2), '2 earlier imports');
  });
  it('a row says what it will do, and why it can\'t', () => {
    assert.equal(rowCaption('create', [], [], []), 'Adds');
    assert.equal(rowCaption('update', ['Coach email'], [], []), 'Updates · Coach email');
    assert.equal(rowCaption('unchanged', [], [], []), 'No change');
    assert.equal(rowCaption('blocked', [], ['Division not found.'], []), 'Can’t import · Division not found.');
  });
  it('the doors', () => {
    assert.equal(W.door('teams'), 'Import teams from a spreadsheet');
    assert.equal(W.door('games'), 'Import games from a spreadsheet');
  });
});

describe('the sheet (E10)', () => {
  const sheet = code('components/admin/tournament/ImportSheet.tsx');
  it('reads the file at once and changes nothing until Import, only from a clean preview', () => {
    assert.match(sheet, /onChange=\{e => \{ const f = e\.target\.files\?\.\[0\]; if \(f\) void read\(f\); \}\}/);
    assert.match(sheet, /if \(!preview\?\.canCommit \|\| importing \|\| result \|\| changing === 0\) return;/);
    assert.match(sheet, /\/commit\?/);
    assert.match(sheet, /W\.blockedFoot/);
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
