/**
 * A CANCELLED ADMIN ACCOUNT HAS ONE PAGE (owner 2026-11-05) — Plan & billing, with the reactivate control.
 *
 * The rail treated any /tournaments/* path as "inside a tournament" and drew the whole tournament tool list for a
 * cancelled Tournament-tier account, every row a link the cancellation guard bounced straight back. The shell now
 * decides ONCE (`suspended`) and draws no tool frame at all; only the top strip stays, on a phone too. This guard
 * holds the shape: if a nav comes back for a cancelled account, the build says so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chrome = readFileSync('app/[orgSlug]/admin/AdminChrome.tsx', 'utf8');
const strip = readFileSync('components/admin/AdminTopStrip.tsx', 'utf8');
const header = readFileSync('components/admin/AdminEventHeader.tsx', 'utf8');
const stripCss = readFileSync('components/coaches/CoachTopStrip.module.css', 'utf8');
const adminCss = readFileSync('app/[orgSlug]/admin/admin.module.css', 'utf8');

// ⚰ The phone's "In <program>" row retired with Club Tier Stage 13i (A6): every place's pages are its own tab row.
test('the cancelled shell draws no rail, no phone bar and no push banner', () => {
  assert.match(chrome, /const suspended = isCanceled;/);
  assert.match(chrome, /!isFocused && !suspended && <AdminKitRail \/>/);
  assert.match(chrome, /!isFocused && !suspended && <AdminKitBottomNav/);
  assert.doesNotMatch(chrome, /AdminKitProgramRow/);
  assert.match(chrome, /!suspended && <EnablePushBanner/);
});

test('the strip is the only chrome left: shown on a phone, without the bell', () => {
  assert.match(chrome, /<AdminTopStrip[^>]*suspended=\{suspended\}/);
  assert.match(strip, /styles\.stripAlways/);
  assert.match(strip, /!suspended && \(\s*<NotificationBell/);
  // The override must come AFTER the phone rule that hides the strip (equal weight — the later one wins).
  assert.ok(stripCss.indexOf('.stripAlways') > stripCss.indexOf('@media (max-width: 900px)'));
  // Room for the strip comes from the shell's own padding, never by un-zeroing the var the sticky header reads.
  const rule = adminCss.match(/\.adminShell\.adminShellSuspended\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /padding-top: var\(--chrome-bar-h\)/);
  assert.doesNotMatch(rule, /--admin-topstrip-h/);
});

test('the header names the org and offers no door to the suspended public site', () => {
  assert.match(header, /!suspended && <FlipPill/);
  // Round 4 (2026-11-08): View site also sits in the desktop strip, beside the bell — and the same rule holds there.
  assert.match(strip, /flip && !suspended && <FlipPill/);
  // The one place model both headers read: a cancelled account is never "in" a tournament or a place.
  const model = readFileSync('components/admin/useAdminPlace.tsx', 'utf8');
  assert.match(model, /const onTournament =\s*!suspended &&/);
  assert.match(model, /const routePlace = !suspended && !onTournament \? addressPlace : null;/);
  // Its page keeps the strip as it was (no sidebar to split on) and the bar keeps naming the organization on desktop.
  assert.match(strip, /const split = !suspended;/);
  assert.match(header, /const deskClass = suspended \? '' :/);
});
