import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ADMIN DESIGN CONTINUITY · SLICE 6 — THE CLUB WINDOWS STAND ON THE PORTAL'S DIALOG FLOOR, AND THE
 * PROVE STEP'S TWO OTHER FIXES (owner, 2026-09-27: "build it here, before the walk"; Q5 "colour it";
 * Q4 the public preview's Warm tab bar).
 *
 *   1. Every club window (`KitDialog`: Invite, Manage, the plan move, every question) is the coaches
 *      portal's own floor — Tab trapped, focus returned, Escape for the top window, phone Back one
 *      level. Before slice 6 it hand-rolled Escape and nothing else. A question is `role="dialog"`,
 *      as the portal's are: the floor holds Back while an `alertdialog` is on screen.
 *   2. The floor traps Tab among the controls that are RENDERED — a phone-only ← hidden at desktop
 *      width let Shift+Tab walk out (found by this slice's browser probe, 34 of 80 presses outside).
 *   3. Settings' unsaved-changes guard marks its own history entry, so a window tidying its Back step
 *      away is never read as a Back on the page; and its two leave buttons navigate with the question
 *      still open, because a step tidied before the router pushes cancels the navigation.
 *   4. The public tournament preview marks its SHELL as the public page too (R2): its ground is the
 *      public dark, not the kit's paper, under the public tab row.
 *   5. The phone bar's tab you are on is coloured by its name as well as its pill (Q5).
 * Proven in a browser: `.probe/6/windows.mjs` (29 checks) — this pins the source so it stays true.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

describe('the club windows stand on the dialog floor', () => {
  const dialog = readCode('components/admin/kit/club/KitDialog.tsx');

  it('KitDialog calls the floor, and hand-rolls no key listener of its own', () => {
    assert.match(dialog, /import \{ useDialogFloor \} from '@\/components\/coaches\/useDialogFloor';/);
    assert.match(dialog, /useDialogFloor\(true, panelRef, \{ onClose, busy \}\);/);
    assert.doesNotMatch(dialog, /addEventListener\(\s*'keydown'/, 'Escape and Tab belong to the floor — a second listener would answer twice');
  });

  it('a question is role="dialog", never alertdialog — or Back would do nothing on it', () => {
    assert.match(dialog, /role="dialog"/);
    assert.doesNotMatch(dialog, /alertdialog/);
  });

  it('the floor traps Tab among rendered controls only', () => {
    const floor = readCode('components/coaches/useDialogFloor.ts');
    assert.match(floor,
      /querySelectorAll<HTMLElement>\(FOCUSABLE\)\)\s*\.filter\(el => el\.getClientRects\(\)\.length > 0 && getComputedStyle\(el\)\.visibility !== 'hidden'\)/);
  });
});

describe('Settings\' unsaved-changes guard shares the Back stack', () => {
  const settings = readCode('components/admin/kit/club/SettingsKit.tsx');

  it('its history entry is marked, and a pop that lands on it is a window\'s, not the page\'s', () => {
    assert.match(settings, /window\.history\.pushState\(GUARD_ENTRY, '', window\.location\.href\);/);
    assert.match(settings, /const onPop = \(e: PopStateEvent\) => \{\s*if \(\(e\.state as \{ settingsGuard\?: boolean \} \| null\)\?\.settingsGuard\) return;/);
    assert.doesNotMatch(settings, /pushState\(null,/, 'an unmarked entry cannot be told apart from a window\'s tidy-up');
  });

  it('the landing is read off the event — the Back stack may already have re-pushed a window\'s entry', () => {
    assert.doesNotMatch(settings, /window\.history\.state as \{ settingsGuard/,
      'history.state is the window\'s entry when the stack\'s listener ran first — the mark is missed');
  });

  it('"Discard and leave" and "Save and continue" navigate with the question still open', () => {
    const leaves = settings.match(/if \(pendingHref\) \{ router\.push\(pendingHref\); return; \}/g) ?? [];
    assert.equal(leaves.length, 2, 'both leave buttons must push BEFORE any close');
    assert.doesNotMatch(settings, /setGuardOpen\(false\); if \(pendingHref\) router\.push/,
      'closing the question first lets its Back step cancel the navigation');
  });
});

describe('R2 — the tournament preview is the public page down to its ground', () => {
  it('the preview shell carries the island marker with the switch on, and nothing with it off', () => {
    const chrome = readCode('app/[orgSlug]/admin/AdminChrome.tsx');
    assert.match(chrome, /<div className=\{shellClassName\} \{\.\.\.\(kit && isTournamentPreview \? \{ 'data-public-preview': '' \} : \{\}\)\}>/);
  });
});

describe('Q5 — the phone bar names the tab you are on', () => {
  it('the active name is the primary ink in Dark and olive in Warm, at a weight that beats the warm grey', () => {
    const bar = readCode('components/coaches/CoachesBottomNav.module.css');
    assert.match(bar, /\.tab\.active \{ color: var\(--text-primary\); \}/);
    assert.match(bar, /:global\(html\[data-user-theme="warm"\] \[data-coach-warm-enabled\]\) \.tab\.active \{ color: var\(--home-olive\); \}/);
  });
});
