import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyNoFlashAttributes, NO_FLASH_SCRIPT } from '../../lib/no-flash-script.ts';
import { isSupabaseAuthCookieName } from '../../lib/sandbox-exit-rule.ts';
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

const SESSION = 'sb-abcdefgh-auth-token=base64-xyz';

function run({
  store = {} as Record<string, string>,
  path = '/',
  coarse = false,
  blocked = false,
  cookie = '',
} = {}): Map<string, string> {
  const attrs = new Map<string, string>();
  const documentStub = { cookie, documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, String(v)) } };
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

  it('goes Dark only on an explicit stored Dark, signed in', () => {
    assert.equal(run({ cookie: SESSION, store: { fl_user_theme: 'dark' } }).get('data-user-theme'), 'dark');
    assert.equal(run({ cookie: SESSION, store: { fl_user_theme: 'warm' } }).get('data-user-theme'), 'warm');
    assert.equal(run({ cookie: SESSION, store: { fl_user_theme: 'junk' } }).get('data-user-theme'), 'warm');
  });

  it('is Warm whenever nobody is signed in, whatever the device holds', () => {
    const dark = { fl_user_theme: 'dark' };
    assert.equal(run({ store: dark }).get('data-user-theme'), 'warm');
    assert.equal(run({ store: dark, cookie: 'flhq-in-sandbox=1; other=2' }).get('data-user-theme'), 'warm');
    // A cookie that merely CONTAINS the words is not a session.
    assert.equal(run({ store: dark, cookie: 'x=sb-abc-auth-token' }).get('data-user-theme'), 'warm');
  });

  it('reads a chunked session cookie anywhere in the jar as signed in', () => {
    const dark = { fl_user_theme: 'dark' };
    assert.equal(run({ store: dark, cookie: 'a=1; sb-abcdefgh-auth-token.0=aaa; sb-abcdefgh-auth-token.1=bbb' }).get('data-user-theme'), 'dark');
    assert.equal(run({ store: dark, cookie: 'a=1;sb-abcdefgh-auth-token=zzz' }).get('data-user-theme'), 'dark');
  });

  it('matches the same cookie names as the one shared helper, minus the half-finished-sign-in verifier', () => {
    for (const name of ['sb-abc-auth-token', 'sb-abc-auth-token.0', 'sb-abc-auth-token.12', 'flhq-in-sandbox', 'other-sb-abc-auth-token', 'sb-abc']) {
      const viaScript = run({ store: { fl_user_theme: 'dark' }, cookie: `${name}=v` }).get('data-user-theme') === 'dark';
      assert.equal(viaScript, isSupabaseAuthCookieName(name), `cookie "${name}"`);
    }
  });

  it('does not count a half-finished sign-in as a session', () => {
    // `…-code-verifier` is left behind by a password-reset or sign-up link that was never opened.
    const dark = { fl_user_theme: 'dark' };
    assert.equal(run({ store: dark, cookie: 'sb-abc-auth-token-code-verifier=v' }).get('data-user-theme'), 'warm');
    assert.equal(run({ store: dark, cookie: 'sb-abc-auth-token-code-verifier=v; sb-abc-auth-token=s' }).get('data-user-theme'), 'dark');
  });

  it('never rewrites the stored choice, so signing back in finds Dark', () => {
    // The stub has no setItem: a script that tried to clear or write the choice would throw and,
    // being fully try/caught, silently skip the rest — so assert the attribute still lands.
    assert.equal(run({ store: { fl_user_theme: 'dark' } }).get('data-user-theme'), 'warm');
    assert.doesNotMatch(NO_FLASH_SCRIPT, /setItem|removeItem|\.clear\(/);
  });

  it('runs the theme rule alone for the auth watcher', () => {
    const attrs = new Map<string, string>();
    const documentStub = { cookie: SESSION, documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, String(v)) } };
    const storageStub = { getItem: (k: string) => (k === 'fl_user_theme' ? 'dark' : null) };
    new Function('document', 'localStorage', 'window', 'location', `(${applyNoFlashAttributes.toString()})(true);`)(
      documentStub, storageStub, { matchMedia: () => ({ matches: false }) }, { pathname: '/' },
    );
    assert.equal(attrs.get('data-user-theme'), 'dark');
    assert.equal(attrs.has('data-density'), false);
    assert.equal(attrs.has('data-sidebar'), false);
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

describe('signed out is warm (owner 2026-10-23)', () => {
  it('has a root watcher that re-runs the theme rule when a session starts or ends', () => {
    assert.match(readCode('app/layout.tsx'), /<ThemeSessionWatch\s*\/>/);
    const watcher = readCode('components/ThemeSessionWatch.tsx');
    assert.match(watcher, /applyNoFlashAttributes\(true\)/);
    for (const event of ['SIGNED_IN', 'SIGNED_OUT', 'INITIAL_SESSION']) assert.match(watcher, new RegExp(event));
    // The device's saved choice is the sign-in restore — the watcher must never touch it.
    assert.doesNotMatch(watcher, /applyTheme|removeItem|setItem|localStorage/);
  });

  it('keeps sign-out from clearing the saved choice', () => {
    assert.doesNotMatch(readCode('lib/auth.ts'), /fl_user_theme|THEME_STORAGE_KEY|applyTheme/);
  });

  it('applies the same rule on the static offline page', () => {
    const offline = readCode('public/offline.html');
    assert.match(offline, /document\.cookie/);
    assert.match(offline, /indexOf\('sb-'\) === 0/);
    assert.match(offline, /slice\(-11\) === '-auth-token'/);
  });
});
