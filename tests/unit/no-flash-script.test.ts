import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NO_FLASH_SCRIPT } from '../../lib/no-flash-script.ts';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE NO-FLASH SCRIPT (root layout, before first paint) — and the restore that re-runs it.
 *
 *   1. THE STRING IS THE FUNCTION. The inline script is `applyNoFlashAttributes`' own source,
 *      stringified (2026-10-13), so NoFlashRestore can call the same rule after React strips
 *      <html>. These cases run the STRING — with nothing but the four browser globals it may
 *      touch — so a helper import or an outer variable that sneaks into the function fails here,
 *      not as a silent no-op in every visitor's <head>.
 *   2. WARM IS THE DEFAULT; DARK ONLY ON AN EXPLICIT STORED CHOICE. Blocked storage is warm too.
 *   3. THE RESTORE IS MOUNTED. Without it, any root hydration failure turns a Warm coach's
 *      portal Dark under a white top bar (the bug this was built for).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

function run({
  store = {} as Record<string, string>,
  path = '/',
  coarse = false,
  blocked = false,
} = {}): Map<string, string> {
  const attrs = new Map<string, string>();
  const documentStub = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, String(v)) } };
  const storageStub = {
    getItem: (k: string) => {
      if (blocked) throw new Error('SecurityError');
      return k in store ? store[k] : null;
    },
  };
  const windowStub = { matchMedia: () => ({ matches: coarse }) };
  const locationStub = { pathname: path };
  new Function('document', 'localStorage', 'window', 'location', NO_FLASH_SCRIPT)(
    documentStub, storageStub, windowStub, locationStub,
  );
  return attrs;
}

describe('the no-flash script', () => {
  it('defaults to Warm and compact on a fresh device', () => {
    const attrs = run();
    assert.equal(attrs.get('data-user-theme'), 'warm');
    assert.equal(attrs.get('data-density'), 'compact');
  });

  it('goes Dark only on an explicit stored Dark', () => {
    assert.equal(run({ store: { fl_user_theme: 'dark' } }).get('data-user-theme'), 'dark');
    assert.equal(run({ store: { fl_user_theme: 'warm' } }).get('data-user-theme'), 'warm');
    assert.equal(run({ store: { fl_user_theme: 'junk' } }).get('data-user-theme'), 'warm');
  });

  it('stays Warm when storage is blocked (private mode)', () => {
    const attrs = run({ blocked: true, coarse: true });
    assert.equal(attrs.get('data-user-theme'), 'warm');
    assert.equal(attrs.get('data-density'), 'comfortable');
  });

  it('honours a stored density, else defaults by pointer', () => {
    assert.equal(run({ store: { fl_admin_density: 'comfortable' } }).get('data-density'), 'comfortable');
    assert.equal(run({ coarse: true }).get('data-density'), 'comfortable');
    assert.equal(run({ coarse: true, store: { fl_admin_density: 'compact' } }).get('data-density'), 'compact');
  });

  it('narrows the sidebar before the first paint only on a stored strip', () => {
    assert.equal(run({ store: { 'flhq-sidebar': 'strip' } }).get('data-sidebar'), 'strip');
    assert.equal(run().has('data-sidebar'), false);
    assert.equal(run({ store: { 'flhq-sidebar': 'junk' } }).has('data-sidebar'), false);
    assert.equal(run({ blocked: true }).has('data-sidebar'), false);
  });

  it('flags a skipped setup card for THAT team only', () => {
    const store = { 'fl_coach_nudge_dismissed:team-a:first_run_setup': '1' };
    assert.equal(run({ store, path: '/coaches/team/team-a' }).get('data-coach-setup-skipped'), '1');
    assert.equal(run({ store, path: '/coaches/team/team-b' }).has('data-coach-setup-skipped'), false);
    assert.equal(run({ store, path: '/coaches' }).has('data-coach-setup-skipped'), false);
  });
});

describe('the restore after a root rebuild', () => {
  it('is mounted by the root layout', () => {
    assert.match(readCode('app/layout.tsx'), /<NoFlashRestore\s*\/>/);
  });

  it('re-runs the same function the script is made from', () => {
    assert.match(readCode('components/NoFlashRestore.tsx'), /applyNoFlashAttributes\(\)/);
  });
});
