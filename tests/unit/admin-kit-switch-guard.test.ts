import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readAdminKit, isAdminKitAvailable, adminKitAttr, ADMIN_KIT_COOKIE } from '../../lib/admin-kit-preview.ts';
import { readCode, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ADMIN KIT SWITCH (Admin Design Continuity, Phase 1 — build prompt "THE SWITCH", binding)
 *
 * Phase 1 is built over several sessions on the one `dev` branch, which anyone may promote. Nothing
 * it changes may reach a customer before its release day, so every visible change hangs off one
 * attribute that one helper decides. What this pins:
 *
 *   1. NEVER ON THE PRODUCTION BRANCH, FAIL-CLOSED — the helper returns false on the `master` build
 *      (and on any production build that cannot say it is staging) whatever the cookie says, and
 *      the door that sets the cookie refuses before it reads anything. Staging (the `dev` build) and
 *      the local dev server may turn it on (owner, 2026-09-25).
 *   2. ONE PLACE TURNS IT ON — only the admin layout spreads the marker, and only through the
 *      helper's attribute set. A second place deciding it is exactly how a half-built screen leaks.
 *   3. PUBLIC LAYOUTS NEVER CARRY IT — R2: public pages stay in the organization's own branding.
 *
 * The release slice deletes the helper, and this file with it; the marker becomes unconditional.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = process.cwd();
const read = readCode;
const env = process.env as Record<string, string | undefined>;
const ORIGINAL_ENV = env.NODE_ENV;
const ORIGINAL_BRANCH = env.APP_BUILD_BRANCH;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

describe('the admin kit switch', () => {
  afterEach(() => {
    env.NODE_ENV = ORIGINAL_ENV;
    if (ORIGINAL_BRANCH === undefined) delete env.APP_BUILD_BRANCH;
    else env.APP_BUILD_BRANCH = ORIGINAL_BRANCH;
  });

  it('is on only for the cookie, on the dev server and the staging build — never on production', () => {
    env.NODE_ENV = 'development';
    delete env.APP_BUILD_BRANCH;
    assert.equal(isAdminKitAvailable(), true);
    assert.equal(readAdminKit('1'), true);
    assert.equal(readAdminKit(undefined), false, 'OFF BY DEFAULT on the dev server too');
    assert.equal(readAdminKit('0'), false);
    assert.equal(readAdminKit('true'), false, 'only the exact value the door writes');

    env.NODE_ENV = 'production';
    env.APP_BUILD_BRANCH = 'master';
    assert.equal(isAdminKitAvailable(), false, 'the production branch can never turn it on');
    assert.equal(readAdminKit('1'), false, 'the production branch must ignore the cookie entirely');

    delete env.APP_BUILD_BRANCH;
    assert.equal(readAdminKit('1'), false, 'FAIL-CLOSED: a production build that names no branch is production');
    env.APP_BUILD_BRANCH = '';
    assert.equal(readAdminKit('1'), false, 'an empty branch name is no branch');
    env.APP_BUILD_BRANCH = 'feature-x';
    assert.equal(readAdminKit('1'), false, 'only the staging branch, not "anything but master"');

    env.APP_BUILD_BRANCH = 'dev';
    assert.equal(readAdminKit('1'), true, 'the staging build honours the cookie');
    assert.equal(readAdminKit(undefined), false, 'OFF BY DEFAULT on staging too');
  });

  it('the build records its OWN branch, from Amplify, never from a console variable', () => {
    const yml = readFileSync('amplify.yml', 'utf8');
    assert.match(yml, /- echo "APP_BUILD_BRANCH=\$AWS_BRANCH" >> \.env\.production/,
      'amplify.yml must copy AWS_BRANCH (set by Amplify per build), so master can only ever name master');
  });

  it('carries both halves of the marker: the warm palette and the admin kit rules', () => {
    assert.deepEqual(Object.keys(adminKitAttr).sort(), ['data-admin-kit', 'data-coach-warm-enabled']);
  });

  it('the door refuses in production before it touches the cookie', () => {
    const src = read('app/api/dev/admin-kit/route.ts');
    const refuse = src.indexOf('isAdminKitAvailable()');
    const cookie = src.search(/cookies\.(set|delete)/);
    assert.ok(refuse > -1, 'the door must ask the helper whether it may exist');
    assert.ok(cookie > refuse, 'the production refusal must come before any cookie is written');
    assert.match(src, /status:\s*404/);
    assert.match(src, new RegExp(`ADMIN_KIT_COOKIE`), 'the door writes the helper\'s cookie, by name');
    assert.equal(ADMIN_KIT_COOKIE, 'flhq_admin_kit');
    // The layout sweep turns the switch on by writing the same cookie (it cannot import TS).
    assert.match(readFileSync('scripts/check-layout-invariants.mjs', 'utf8'), /name: 'flhq_admin_kit'/);
  });

  it('only the admin layout puts the marker on the page, and only through the helper', () => {
    const offenders: string[] = [];
    for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      const src = stripComments(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
      if (/\{\s*\.\.\.adminKitAttr\s*\}/.test(src) && rel !== 'app/[orgSlug]/admin/layout.tsx') offenders.push(`${rel} spreads adminKitAttr`);
      if (/data-admin-kit\s*=|['"]data-admin-kit['"]\s*:/.test(src)) offenders.push(`${rel} writes data-admin-kit by hand`);
    }
    assert.deepEqual(offenders, [], 'a second place deciding the switch is how a half-built screen leaks');
    const layout = read('app/[orgSlug]/admin/layout.tsx');
    assert.match(layout, /readAdminKit\(/, 'the admin layout decides it from the cookie, on the server');
    assert.match(layout, /adminKit\s*\?[\s\S]*\{\.\.\.adminKitAttr\}[\s\S]*:\s*shell/,
      'with the switch off the layout must render the bare shell — no wrapper, no attribute');
  });

  it('public layouts never carry the warm marker or the admin kit (R2)', () => {
    const publicLayouts = [
      'app/[orgSlug]/layout.tsx',
      'app/[orgSlug]/[tournamentSlug]/layout.tsx',
    ];
    for (const p of publicLayouts) {
      const src = read(p);
      assert.doesNotMatch(src, /coachWarmAttr|adminKitAttr|data-coach-warm-enabled|data-admin-kit/, `${p} must stay org-branded`);
    }
  });
});
