import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';

// A stylesheet read as CODE: the comments that explain a rule (and name the rule they warn against) are not the rule.
const readCss = (rel: string) => readSource(rel).replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ACCOUNT SHEET ON A PHONE (owner ruled 2026-11-01; docs/projects/active/ACCOUNT_SHEET_PHONE_BUILD_PROMPT.md).
 * At ≤900 px the account menu is the shared bottom sheet, not a popover as wide as the signed-in address that ran off the
 * left of a 390 px screen; on the two public bars that had a separate building icon, that door moved INTO the sheet as a
 * "Go to" block. Source scans, because the traps are all in what the markup and the stylesheets say:
 *   1. The sheet is the shared one, decided by the live ≤900 hook, and its rows are links/buttons — never menu items.
 *   2. The door hides on a phone ONLY where the sheet is mounted, and the installed app keeps it.
 *   3. The standalone exception is spelled so it can't negate the width (a leading `not` negates the WHOLE query).
 *   4. One read of the viewer's hats on the tournament band, shared with the sheet.
 *   5. The marketing bar's hand re-anchoring (a workaround for the popover clipping) is gone.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const MENU = 'components/shared/AccountMenu.tsx';

describe('the account menu is the shared bottom sheet at ≤900 px', () => {
  const code = readCode(MENU);

  it('decides popover vs sheet from the live phone-nav hook and renders the shared BottomSheet', () => {
    assert.match(code, /useIsPhoneNav\(\)/);
    assert.match(code, /import BottomSheet from '@\/components\/admin\/BottomSheet'/);
    assert.match(code, /<BottomSheet[\s\S]*?open=\{open && isPhone\}/);
    assert.match(code, /\{open && !isPhone && \(\s*<div className=\{styles\.popover\} role="menu">/);
    assert.doesNotMatch(code, /useIsPhone\(/, 'the nav breakpoint is 900, not useIsPhone (640)');
  });

  it('the trigger is a dialog opener on a phone and a menu opener on a desk', () => {
    assert.match(code, /aria-haspopup=\{isPhone \? 'dialog' : 'menu'\}/);
  });

  it('sheet rows are plain links and buttons: role="menuitem" only on the popover', () => {
    assert.match(code, /const itemRole = \(inSheet: boolean\) => \(inSheet \? undefined : 'menuitem'\)/);
    assert.equal((code.match(/role="menuitem"/g) ?? []).length, 0, 'every menuitem role goes through itemRole()');
    const goTo = code.slice(code.indexOf('function GoToBlock'));
    assert.doesNotMatch(goTo, /role=/, 'the Go to rows are real links with no menu role');
    assert.match(goTo, /<Link\s/);
  });

  it('the sheet attaches inside the menu, so the host bar keeps its own colours', () => {
    assert.match(code, /portalTo=\{sheetHost\}/);
    assert.match(code, /<div className=\{styles\.sheetHost\} ref=\{setSheetHost\} \/>/);
  });

  it('the popover click-away boundary is off while the sheet is up, and focus returns to the trigger on close', () => {
    assert.match(code, /useDismissable\(open && !isPhone,/);
    assert.match(code, /triggerRef\.current\?\.focus\(\)/);
  });

  it('keeps closing on any route change, and Send feedback closes the sheet then opens the window that outlives it', () => {
    assert.match(code, /if \(lastPath !== pathname\) \{\s*setLastPath\(pathname\);\s*setOpen\(false\);/);
    assert.match(code, /onClick=\{\(\) => \{ setOpen\(false\); setFeedbackOpen\(true\); \}\}/);
    assert.match(code, /<FeedbackWidget open=\{feedbackOpen\}/);
  });

  it('the Go to block is the shared door-row logic, not a copy of it', () => {
    assert.match(code, /flipDoorRows\(door, back\)/);
    assert.match(code, /useFlipReturn\(\)/);
    const pill = readCode('components/shared/FlipPill.tsx');
    assert.match(pill, /useFlipReturn\(\)/);
    assert.match(pill, /flipDoorRows\(resolution, back\)/);
    assert.doesNotMatch(pill, /readReturnMemory|writeReturnMemory/, 'the return-memory rules live once, in the hook');
  });
});

describe('a sheet inside a bar is never painted under the page\'s bottom layers', () => {
  it('the bar that contains an open sheet is lifted to the sheet\'s own layer', () => {
    // The sheet attaches inside its bar, so it can only reach the bar's layer (marketing 50, console 80, phone club bar 90,
    // app top bar 200): under the bottom nav (200) and the install banner (255), which would cover Sign out.
    const css = readCss('components/shared/AccountMenu.module.css');
    assert.match(css, /:global\(:root\) :global\(:is\(header, nav\)\):has\(\.sheetHost \[aria-modal='true'\]\) \{ z-index: 600; \}/);
    const backdrop = readCss('components/admin/BottomSheet.module.css').match(/\.backdrop \{[^}]*?z-index:\s*(\d+)/);
    assert.equal(backdrop && Number(backdrop[1]), 600, 'the lift must match the sheet\'s own layer');
  });
});

describe('the shared sheet takes an optional attach point and is otherwise unchanged', () => {
  const sheet = readCode('components/admin/BottomSheet.tsx');
  it('portalTo wins; absent, the public light frame, else <body>', () => {
    assert.match(sheet, /portalTo\?: HTMLElement \| null/);
    assert.match(sheet, /portalTo \?\? document\.querySelector<HTMLElement>\('\[data-public-frame="light"\]'\) \?\? document\.body/);
  });
});

describe('the door steps aside on a phone only where the sheet carries it', () => {
  it('tournament band: the width rule nests the standalone exception instead of leading with `not`', () => {
    const css = readCss('components/public/TournamentFrame.module.css');
    assert.match(css, /@media \(max-width: 900px\) \{\s*@media not all and \(display-mode: standalone\) \{\s*\.bandDoor\.bandDoorInSheet \{ display: none; \}/);
    assert.doesNotMatch(css, /@media not all and \(display-mode: standalone\) and \(max-width: 900px\)/,
      'a leading `not` negates the whole query: it would hide the door on every desk');
  });

  it('tournament band: the hidden door is the one inside BandDoors, which also mounts the account menu', () => {
    const band = readCode('components/public/TournamentBand.tsx');
    const doors = band.slice(band.indexOf('function BandDoors'));
    assert.match(doors, /<AccountMenu[^>]*door=\{resolution\}/);
    assert.match(doors, /className=\{`\$\{styles\.bandDoor\} \$\{styles\.bandDoorInSheet\}`\}/);
    assert.match(band, /\{!inSandbox && !preview \? \(\s*<BandDoors/);
    // The sandbox shows no account menu: its door must NOT carry the hide class.
    const sandbox = band.slice(0, band.indexOf('function BandDoors'));
    assert.match(sandbox, /<span className=\{styles\.bandDoor\}>\s*<TournamentFlipPill look="band" \/>/);
    assert.doesNotMatch(sandbox, /bandDoorInSheet/);
  });

  it('tournament band: the viewer\'s hats are read once and shared', () => {
    const band = readCode('components/public/TournamentBand.tsx');
    assert.equal((band.match(/usePublicFlip\(\)/g) ?? []).length, 1);
    assert.match(readCode('components/public/TournamentFlipPill.tsx'), /export function TournamentFlipDoor/);
  });

  it('club bar: the door hides at ≤900 only when the account menu is mounted; the sheet gets the same resolution', () => {
    const bar = readCode('components/public/ClubBar.tsx');
    assert.match(bar, /const accountMounted = signedIn && !isDemoOrgSlug\(club\.slug\)/);
    assert.match(bar, /<AccountMenu[^>]*teams=\{myTeams\} door=\{door\}/);
    assert.match(bar, /accountMounted \? styles\.doorInSheet : ''/);
    const css = readSource('components/public/ClubFrame.module.css');
    assert.match(css, /@media \(max-width: 900px\) \{\s*\.actions \.doorInSheet \{ display: none; \}/);
  });

  it('FlipPill.module.css\'s icon-only phone rule is untouched (other bars rely on it)', () => {
    const css = readSource('components/shared/FlipPill.module.css');
    assert.doesNotMatch(css, /doorInSheet|bandDoorInSheet/);
  });
});

describe('the marketing bar and the support console wear the sheet without a door', () => {
  it('the marketing bar\'s hand re-anchoring of the popover is gone', () => {
    const css = readSource('components/Navbar.module.css');
    assert.doesNotMatch(css, /marketingAccount/);
    const tsx = readCode('components/Navbar.tsx');
    assert.doesNotMatch(tsx, /marketingAccount/);
    assert.match(tsx, /<AccountMenu className=\{quietCtaClass\} signOutTo="here" warm>/);
  });

  it('the support console keeps Appearance and drops the settings and feedback rows', () => {
    const shell = readCode('app/platform-admin/PlatformShell.tsx');
    assert.match(shell, /<AccountMenu[\s\S]*?showTheme[\s\S]*?showFeedback=\{false\}[\s\S]*?showAccount=\{false\}[\s\S]*?signOutTo="platform"/);
    assert.doesNotMatch(shell, /<AccountMenu[^>]*door=/);
  });
});
