import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { adminKitAttr, guestKitAttr } from '../../lib/admin-kit-preview.ts';
import { readCode, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ADMIN KIT, RELEASED (Admin Design Continuity — Part A, the flip, 2026-09-28)
 *
 * Phase 1 was built behind a dev-only switch (a cookie, its door, a fail-closed staging check) so the
 * half-built kit could never reach a customer. The flip deleted the switch: the admin and both volunteer
 * shells wear the marker in EVERY build. What this pins now:
 *
 *   1. THE MARKER IS ON ALL THREE SHELLS, IN EVERY BUILD — the admin layout (`adminKitAttr`, the account's
 *      Warm / Dark setting chooses) and the scorekeeper and gate (`guestKitAttr` through `GuestKitRoot`,
 *      warm FIXED, R3). No condition sits between a shell and its marker.
 *   2. THE SWITCH IS GONE — nothing reads its cookie, the door route does not exist, and the helper no
 *      longer exports a reader. A second way to turn the kit off is how the old look would creep back.
 *   3. ONE PLACE SPREADS EACH MARKER — the admin layout (+ `PortalKitRoot`, which forwards it to portals),
 *      and `GuestKitRoot` for the guest pair.
 *   4. PUBLIC LAYOUTS NEVER CARRY IT — R2: public pages stay in the organization's own branding, and the
 *      tournament preview island inside the admin turns the kit off.
 *
 * The legacy branches (an admin page's `useAdminKit()` false path, `legacy` props, the switch-off
 * stylesheet rules) are dead code that Part B (the cleanup) deletes area by area; its first area (the
 * frame and shared parts, 2026-09-29) ended the one-revert rollback. The context's OFF answer itself is
 * not legacy: the preview island and other surfaces still rely on it (`AdminKitProvider`'s header).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = process.cwd();
const read = readCode;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

const VOLUNTEER_LAYOUTS = ['app/[orgSlug]/scorekeeper/layout.tsx', 'app/[orgSlug]/check-in/layout.tsx'];

describe('the admin kit, released', () => {
  it('the admin layout wears the marker unconditionally', () => {
    const layout = stripComments(read('app/[orgSlug]/admin/layout.tsx'));
    assert.match(layout, /<AdminKitProvider on>\s*<div style=\{\{ display: 'contents' \}\} \{\.\.\.adminKitAttr\}>/,
      'the admin layout must hand every page the kit and put the marker on a box-less wrapper above the shell');
    assert.doesNotMatch(layout, /\?\s*\(?\s*<div[^>]*\{\.\.\.adminKitAttr\}|:\s*shell\b/,
      'no condition may sit between the admin shell and its marker');
    assert.doesNotMatch(layout, /\bcookies\(/, 'the admin layout reads no switch cookie');
  });

  it('both volunteer shells wear the guest marker in every build (R3)', () => {
    for (const p of VOLUNTEER_LAYOUTS) {
      const src = stripComments(read(p));
      assert.match(src, /const guestKit = true;/, `${p}: the kit is on in every build`);
      assert.doesNotMatch(src, /\bcookies\(/, `${p} reads no switch cookie`);
      const roots = src.match(/<GuestKitRoot on=\{guestKit\}>/g) ?? [];
      assert.equal(roots.length, 3, `${p}: the wall, the refusal and the shell must each render through GuestKitRoot`);
    }
  });

  it('the switch is gone: no cookie, no door, no reader', () => {
    assert.ok(!existsSync(path.join(ROOT, 'app/api/dev/admin-kit')), 'the door route must stay deleted');
    const helper = stripComments(read('lib/admin-kit-preview.ts'));
    assert.doesNotMatch(helper, /export (function|const) (readAdminKit|isAdminKitAvailable|ADMIN_KIT_COOKIE)\b/,
      'the helper exports the markers only — no reader, no availability check, no cookie name');
    const offenders: string[] = [];
    for (const dir of ['app', 'components', 'lib', 'scripts']) {
      for (const file of walk(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        const src = stripComments(readFileSync(file, 'utf8'));
        if (/flhq_admin_kit|\/api\/dev\/admin-kit|\breadAdminKit\b|\bisAdminKitAvailable\b|\bADMIN_KIT_COOKIE\b/.test(src)) offenders.push(rel);
      }
    }
    assert.deepEqual(offenders, [], 'nothing may read, write or link the retired switch');
  });

  it('carries both halves of the admin marker: the warm palette and the admin kit rules', () => {
    assert.deepEqual(Object.keys(adminKitAttr).sort(), ['data-admin-kit', 'data-coach-warm-enabled']);
  });

  it('the volunteer shells\' marker pins the warm palette and never lets the device theme choose (R3)', () => {
    assert.deepEqual(Object.keys(guestKitAttr).sort(), ['data-admin-kit', 'data-guest-kit']);
    // `data-coach-warm-enabled` is the half the dark gate keys on — a Dark phone would get the dark palette.
    assert.ok(!('data-coach-warm-enabled' in guestKitAttr), 'the guest marker must not carry the account-theme half');
  });

  it('each marker is spread in ONE place', () => {
    const MARKER_DOORS = new Set(['app/[orgSlug]/admin/layout.tsx', 'components/admin/AdminKitProvider.tsx']);
    // The volunteer shells hand their decision to the provider's `GuestKitRoot`, so the twins cannot drift.
    const GUEST_DOORS = new Set(['components/admin/AdminKitProvider.tsx']);
    const offenders: string[] = [];
    for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      const src = stripComments(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
      // Any mention, not only a bare `{...adminKitAttr}` — `{...(on ? adminKitAttr : {})}` slipped past
      // that shape once (slice 4c's first bottom sheet). The one other door is the portal hook
      // (`PortalKitRoot`, AdminKitProvider), which forwards the layout's marker and decides nothing.
      if (/\badminKitAttr\b/.test(src) && !MARKER_DOORS.has(rel)) offenders.push(`${rel} uses adminKitAttr`);
      if (/\bguestKitAttr\b/.test(src) && !GUEST_DOORS.has(rel)) offenders.push(`${rel} uses guestKitAttr`);
      if (/data-admin-kit\s*=|['"]data-admin-kit['"]\s*:/.test(src)) offenders.push(`${rel} writes data-admin-kit by hand`);
      if (/data-guest-kit\s*=|['"]data-guest-kit['"]\s*:/.test(src)) offenders.push(`${rel} writes data-guest-kit by hand`);
    }
    assert.deepEqual(offenders, [], 'a second place spreading a marker is how one surface drifts from the rest');
    const provider = stripComments(read('components/admin/AdminKitProvider.tsx'));
    assert.match(provider, /<AdminKitProvider on guest>\s*<div style=\{\{ display: 'contents' \}\} \{\.\.\.guestKitAttr\}>/,
      'GuestKitRoot must name the guest context and the guest pair');
    assert.match(provider, /usePortalKitAttr\(\)[^{]*\{\s*const marker = useContext\(KitMarkerContext\);\s*return useAdminKit\(\) \? marker : NO_ATTR;\s*\}/,
      'usePortalKitAttr must be exactly "the context says on → the marker the layout named, else nothing"');
    assert.match(provider, /createContext<Readonly<Record<string, string>>>\(adminKitAttr\)/, 'the default marker is the admin\'s');
    assert.match(provider, /guest \? <KitMarkerContext\.Provider value=\{guestKitAttr\}>/, 'only `guest` names the guest pair');
    // …and inside a public preview the context says OFF, so a portal opened there is the public page (R2).
    assert.match(read('app/[orgSlug]/admin/AdminChrome.tsx'), /data-public-preview>\s*<AdminKitProvider on=\{false\}>/,
      'the tournament preview island must turn the kit off for everything inside it');
  });

  it('public layouts never carry the warm marker or the admin kit (R2)', () => {
    const publicLayouts = [
      'app/[orgSlug]/layout.tsx',
      'app/[orgSlug]/[tournamentSlug]/layout.tsx',
    ];
    for (const p of publicLayouts) {
      const src = read(p);
      assert.doesNotMatch(src, /coachWarmAttr|adminKitAttr|guestKitAttr|data-coach-warm-enabled|data-admin-kit|data-guest-kit/, `${p} must stay org-branded`);
    }
  });
});
