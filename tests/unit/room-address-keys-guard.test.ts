/**
 * EVERY ROOM'S ADDRESS KEY IS ON THE MONEY HUB'S ONE-SHOT LIST, AND EVERY ROOM'S SENTINEL IS SWEPT —
 * enforced as rules over the tree.
 *
 * The hub keeps every visited tab mounted (`accounting/page.tsx`), so a query key it does not scrub
 * rides from tab to tab and silently reopens a record on the way back; and a key two panels both
 * read opens two rooms for one address (the 2026-08-26 "mounted twice" defect). Both are
 * "somebody forgot the list" failures, which a per-room convention guarantees eventually — so the
 * rule is stated once, here: **a key passed to `useRoomAddress()` anywhere in the coaches portal
 * must appear in `ONE_SHOT_KEYS`, and no two rooms may share one.** Adding a room fails the build
 * until someone edits the hub's list, and that edit IS the decision.
 *
 * The second rule is the layout gate's: **a room the sweep cannot open is a room it reports green
 * on** (`check:layout` measures only what is drawn — the `?bill=` page shipped unswept once). So
 * every `sentinel="…"` a `RoomShell` consumer declares must be named by a `ready` selector in
 * `scripts/layout-screens.mjs`. The plan calls this a blocking checklist item; this makes it one.
 *
 * Same shape as `budget-line-kind-guard.test.ts`: each scanner proves it can still see the offence
 * (a probe), so a green run is never a run that looked at nothing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const HUB = join(ROOT, 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'accounting', 'page.tsx');
const SCREENS = join(ROOT, 'scripts', 'layout-screens.mjs');
const SCAN_DIRS = [
  join(ROOT, 'app', '[orgSlug]', 'coaches'),
  join(ROOT, 'components', 'coaches'),
];
const CALL = /useRoomAddress\(\s*['"]([A-Za-z][A-Za-z0-9]*)['"]\s*\)/g;
const SENTINEL = /\bsentinel=["']([a-z][a-z0-9-]*)["']/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules') walk(p, out); }
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function oneShotKeys(): string[] {
  const src = readFileSync(HUB, 'utf8');
  const m = src.match(/const ONE_SHOT_KEYS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'accounting/page.tsx must still declare ONE_SHOT_KEYS as an array literal');
  return Array.from(m![1].matchAll(/['"]([^'"]+)['"]/g), x => x[1]);
}

/** Every match of `re` in every scanned source file, with the file it came from. */
function scan(re: RegExp, skipFile: (file: string) => boolean = () => false): Array<{ value: string; file: string }> {
  const found: Array<{ value: string; file: string }> = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      if (skipFile(file)) continue;
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(re)) found.push({ value: m[1], file: file.slice(ROOT.length + 1) });
    }
  }
  return found;
}

const roomKeys = () => scan(CALL, file => file.endsWith('useRoomAddress.ts'));
const roomSentinels = () => scan(SENTINEL, file => file.endsWith('RoomShell.tsx'));

describe('every room address key is a one-shot key of the money hub', () => {
  it('can still see a call (the scanner is not looking at nothing)', () => {
    const probe = `const [open, setOpen] = useRoomAddress('clubBill');`;
    assert.deepEqual(Array.from(probe.matchAll(CALL), m => m[1]), ['clubBill']);
  });

  it('lists every key a room reads', () => {
    const keys = oneShotKeys();
    assert.ok(keys.length > 0, 'the hub list parsed as empty');
    for (const { value: key, file } of roomKeys()) {
      assert.ok(
        keys.includes(key),
        `${file} reads the room key "${key}" but accounting/page.tsx's ONE_SHOT_KEYS does not list it — `
          + 'add it there in the same commit, or the record reopens on an unrelated tab.',
      );
    }
  });

  it('never lets two rooms share a key', () => {
    const byKey = new Map<string, Set<string>>();
    for (const { value: key, file } of roomKeys()) {
      const files = byKey.get(key) ?? new Set<string>();
      files.add(file);
      byKey.set(key, files);
    }
    for (const [key, files] of byKey) {
      assert.ok(
        files.size === 1,
        `room key "${key}" is read by ${files.size} files (${[...files].join(', ')}) — the hub keeps `
          + 'every tab mounted, so both would open a room for one address.',
      );
    }
  });
});

describe('every room the shell draws is a screen the layout sweep opens', () => {
  it('can still see a sentinel (the scanner is not looking at nothing)', () => {
    const probe = `<RoomShell sentinel="club-bill" loaded>`;
    assert.deepEqual(Array.from(probe.matchAll(SENTINEL), m => m[1]), ['club-bill']);
  });

  it('names every sentinel in a layout-screens `ready` selector', () => {
    const screens = readFileSync(SCREENS, 'utf8');
    const found = roomSentinels();
    for (const { value, file } of found) {
      assert.ok(
        screens.includes(`[data-room="${value}"]`),
        `${file} opens a room with sentinel "${value}" but scripts/layout-screens.mjs has no entry `
          + `waiting on [data-room="${value}"] — the sweep would report the room green without ever `
          + 'drawing it. Add the SCREENS entry (and its fixture id) in the same commit.',
      );
    }
  });
});
