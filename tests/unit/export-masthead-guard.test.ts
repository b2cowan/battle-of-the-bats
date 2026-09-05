/**
 * WHICH FILES ARE ALLOWED TO WEAR LETTERHEAD.
 *
 * A masthead is what makes an export a REPORT — something a person reads, emails and files. A file
 * without one is a DATASET, and a dataset must start on its column row and end on its last data
 * row, because this product reads its own exports back in.
 *
 * ⚠⚠ THIS GUARD EXISTS BECAUSE THE RULE HAS NEARLY BEEN BROKEN TWICE IN ONE DAY (2026-09-05):
 *   · the branding footer went onto every Money spreadsheet, including the re-imported ones, where
 *     a trailing prose row comes back as a budget line; and
 *   · an inventory of every Excel export in the portal found that **Coaches → Team Schedule** is a
 *     designed round trip — its importer is written to read the export's own column spellings, with
 *     a comment saying "a round trip must close" — while NOTHING on that screen says so. It looks
 *     exactly like a harmless dataset, and a rollout of "put a title on every export" would have
 *     broken it silently.
 *
 * So the list is closed. Adding a file here is a decision: prove nothing reads that export back
 * before you do, and remember that a missing import path today is not a promise about tomorrow.
 *
 * ⚠ THE IMPORTER'S BANNER-SKIP IS A SAFETY NET, NOT A LICENCE. It tolerates a title row so a
 * coach's own club or bank spreadsheet imports cleanly; it is not permission to put one on a file
 * we designed to come back.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** Every file allowed to hand the Excel writer a masthead, and why it earns one. */
const ALLOWED = new Map([
  ['app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx',
    'the team report a treasurer emails to a board; nothing imports it'],
  ['app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx',
    'the same report one level up, for the club board; no admin-side budget importer exists'],
]);

/** Named so a future reader meets them before they meet the temptation. */
const NEVER = [
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx',   // budget plan — round trip
  'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx',             // schedule — round trip
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('only a report wears letterhead', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  /* The writer's own option, at a call site — not the type declarations or the helper that reads
     them, which legitimately name it in `lib/export/` and `lib/coach-money-exports.ts`. */
  const callSites = walk(path.join(root, 'app'))
    .filter(f => /(^|\n)\s*masthead:/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(root, f).split(path.sep).join('/'));

  test('every export that passes a masthead is one we decided on', () => {
    const unexpected = callSites.filter(f => !ALLOWED.has(f));
    assert.deepEqual(unexpected, [],
      'A new export grew a masthead. Before allowing it: does anything import that file back? '
      + 'A title row is read AS the column header, so the import fails on a file we produced.');
  });

  test('the two designed round trips never grow one', () => {
    for (const f of NEVER) {
      assert.ok(!callSites.includes(f),
        `${f} is a designed export→edit→import round trip and must stay a bare dataset`);
    }
  });

  test('the allowlist stays honest — every entry still exists and still passes one', () => {
    for (const [file, why] of ALLOWED) {
      assert.ok(fs.existsSync(path.join(root, file)), `${file} is on the allowlist but is gone`);
      assert.ok(callSites.includes(file),
        `${file} is allowed a masthead (${why}) but no longer passes one — stale allowlist entry`);
    }
  });
});
