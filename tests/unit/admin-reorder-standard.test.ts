import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ORDER_WORDS } from '../../lib/tournament-settings-words.ts';

/**
 * THE PORTAL'S REORDER STANDARD, IN THE ADMIN (owner 2026-10-12: "on mobile for this screen we can also use the hold and
 * drag to reorder rather than the up/down arrows. more consistent with our portal standard", then "lets just update
 * those 3 lists during this change"). Every admin list that reorders uses ONE part, `ReorderList`: a handle per row —
 * drag it, hold it on a phone, tap it for Move up · Move down · Cancel. No Reorder mode, no Done, no arrow pair on every
 * row, no hint line — anywhere in the admin. A54's Tools → Reorder (Stage 5, 2026-10-10) is superseded.
 */

const ROOT = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8').replace(/\r\n/g, '\n');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
function walk(dir: string, out: string[] = []): string[] {
  const abs = new URL(dir, ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  for (const name of readdirSync(abs)) {
    const rel = `${dir}/${name}`;
    if (statSync(join(abs, name)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}
const ADMIN = [...walk('app/[orgSlug]/admin'), ...walk('components/admin')];

describe('no Reorder mode and no arrow pair anywhere in the admin', () => {
  test('nothing renders the retired parts or words', () => {
    const offenders: string[] = [];
    for (const f of ADMIN) {
      const c = code(read(f));
      if (/\bMoveButtons\b|ORDER_WORDS\.(?:reorder|done|up|down|drag)\b|setReordering|reorderNote|from '@\/components\/admin\/tournament\/OrderParts'/.test(c)) offenders.push(f);
      // A Tools row that switches a list into a mode for moving rows.
      if (/label=\{?['"]Reorder['"]\}?/.test(c)) offenders.push(f);
    }
    assert.deepEqual(offenders, [], 'a reorderable admin list uses ReorderList (the handle, the tap menu) — never a mode');
  });
  test('the words are the standard\'s: Move up · Move down · Cancel, and a handle that says what it does', () => {
    // `remove` and `handleHeld`: the tie-breakers' opt-ins (Stage 5 addendum A73, 2026-10-12) — a Remove item, and a
    // row that holds its place (Coin Toss) says it doesn't drag.
    assert.deepEqual(Object.keys(ORDER_WORDS).sort(), ['cancel', 'handle', 'handleHeld', 'moveDown', 'moveUp', 'options', 'position', 'remove', 'saveFailed']);
    assert.equal(ORDER_WORDS.remove, 'Remove');
    assert.equal(ORDER_WORDS.handleHeld('Coin Toss', '5 of 5'), 'Coin Toss, 5 of 5. Press for options.');
    assert.equal(ORDER_WORDS.cancel, 'Cancel');
    assert.equal(ORDER_WORDS.handle('Hotel block', '2 of 5'), 'Hotel block, 2 of 5. Drag to move, or press for options.');
  });
});

describe('the one part', () => {
  const part = code(read('components/admin/tournament/ReorderList.tsx'));
  test('one copy of the gesture: the portal\'s sensors (a mouse after 6px, a finger after a 250 ms hold, the keyboard)', () => {
    assert.match(part, /const sensors = useReorderSensors\(\);/);
    assert.doesNotMatch(part, /useSensor\(/, 'never a second copy of the hold');
  });
  test('a tap on the handle opens the menu; a phone gets the portal\'s sheet in the MENU layer (never a form)', () => {
    assert.match(part, /onClick=\{e => ctx\.open\(id, e\.currentTarget\)\}/);
    assert.match(part, /<SheetFrame onClose=\{close\} opener=\{openerRef\} overWindow=\{overWindow\}/);
    assert.doesNotMatch(part, /<SheetFrame[^>]*\bform\b/);
  });
  test('one move per open: the menu closes on a move, and focus goes home to the handle', () => {
    const moveBy = part.slice(part.indexOf('const moveBy = '), part.indexOf('const name = '));
    assert.match(moveBy, /onMove\(idx, to\)/);
    assert.match(moveBy, /setMenu\(null\);\n\s+openerRef\.current\?\.focus/);
  });
  test('the handle is 44px at touch widths, and a numbered handle is the lineup builder\'s square, with no border', () => {
    const css = read('components/admin/tournament/ReorderList.module.css');
    assert.match(css, /@media \(max-width: 768px\) \{\n\s+\.handle \{ width: var\(--tap-min, 44px\); min-height: var\(--tap-min, 44px\); \}/);
    assert.match(css, /\.handleNumber \{\n\s+width: var\(--tap-min, 44px\);[\s\S]{0,200}border-radius: 8px;\n\s+\}/);
    // No box inside the bordered row (owner, 2026-10-19).
    assert.doesNotMatch(css, /\.handleNumber \{[^}]*border: 1px/);
  });
});

// (The free coaches portal's roster DOES take the admin part — Free coach tap targets Q2, 2026-10-19 — so this
// pins only the two paid-portal lists that keep their own.)
describe('the lineup builder and Best positions are untouched (they keep their own, as they were)', () => {
  test('both still read the one sensors hook, and neither borrows the admin part', () => {
    for (const f of ['app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx', 'components/coaches/PositionProfileEditor.tsx']) {
      const src = read(f);
      assert.match(src, /useReorderSensors/);
      assert.doesNotMatch(src, /ReorderList/);
    }
  });
});
