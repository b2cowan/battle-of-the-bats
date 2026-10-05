import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, readCode, splitPhoneCss } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * SHEET FRAME — one frame for the portal's phone sheets (owner rulings D1–D6, 2026-10-05; plan
 * docs/projects/active/SHEET_FRAME_PLAN.md, hub https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc).
 *
 * The test that sorts every sheet (D1): "would a stray tap on the bottom bar lose something?" No → the
 * MENU layer (on top of the bar, the bar live, not modal). Yes → the FORM layer (covers the bar, modal,
 * the keyboard kept inside).
 *
 * THIS GUARD GROWS WITH EACH STEP: the layer each sheet is in, one dim, one height rule, no hand-copied
 * bar height, `aria-modal` only on the form layer.
 *   · Step 1 (2026-10-05): the frame is promoted from the Tools drawer; the Tools menu (every
 *     `drawerOnPhone` caller) and the Ledgers' Filter sheet render through it; the Filter sheet stops
 *     claiming `aria-modal`; the admin shell declares the bar, so the club's sheets stop hanging mid-page.
 *   · Step 2 (2026-10-05): the small menus — the team and player switchers move onto the frame (its
 *     label, its card surface in dark, a dim that hands focus back to the name); Print names itself (the
 *     frame's label worn on its own, a dialog role, focus in and back to Tools); the Schedule's view menu
 *     and Add event become drawers on a phone (D5); a menu of choices answers the arrow keys.
 *
 * What it cannot see is the rendered sheet — `.probe/sf1/capture.mjs` (step 1, ten sheets) and
 * `.probe/sf2/capture.mjs` (step 2, five sheets and two Tools sheets as the regression check) measured
 * them before and after at 390 (touch), warm and dark, and diffed their computed styles and pixels.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const frame = readCode('components/coaches/SheetFrame.tsx');
const frameCss = readCode('components/coaches/SheetFrame.module.css');
const menu = readCode('components/coaches/CoachToolbarMenu.tsx');
const filter = readCode('components/coaches/FilterGroup.tsx');

/** Every sheet on the frame so far, and the one line that renders it. */
const CONSUMERS = [
  { who: 'Tools menu', src: menu, ref: 'panelRef', role: 'menu', onClose: '() => setOpen(false)', opener: 'triggerRef' },
  { who: 'Filter sheet', src: filter, ref: 'sheetRef', role: 'dialog', onClose: 'close', opener: 'triggerRef' },
] as const;
const frameLine = (src: string, ref: string): string => {
  const at = src.indexOf(`<SheetFrame ref={${ref}}`);
  assert.notEqual(at, -1, `no <SheetFrame ref={${ref}}`);
  return src.slice(at, src.indexOf('\n', at));
};

describe('step 1 · the frame is ONE place', () => {
  it('the sheet’s geometry AND surface live in the frame’s stylesheet, inside the bar’s breakpoint', () => {
    const sheet = cssRule(frameCss, '.sheet');
    for (const decl of [
      'position: fixed;', 'left: 0;', 'right: 0;', 'bottom: var(--coach-foot-clear);',
      'max-height: calc(100dvh - var(--coach-foot-clear) - 12px);', 'overflow-y: auto;', 'overscroll-behavior: contain;',
      'z-index: 260;', 'border-radius: 18px 18px 0 0;', 'border-bottom: 0;', 'background: var(--home-card, var(--bg-2));',
    ]) {
      assert.ok(sheet.includes(decl), `.sheet: ${decl}`);
    }
    const grab = cssRule(frameCss, '.sheet::before');
    assert.ok(grab.includes('width: 38px;') && grab.includes('height: 4px;') && grab.includes('position: sticky;'), 'the grab line, 38×4, sticky');
    assert.match(frameCss, /@media \(max-width: 900px\) \{\s*\.sheet \{/, 'every declaration inert on a computer');
    assert.match(cssRule(frameCss, '.label'), /text-transform: uppercase;/, 'the menu label (D2): small capitals');
  });

  it('no hand-copied bar height, and nothing in the menu layer rises above the nav', () => {
    assert.doesNotMatch(frameCss, /--bottom-nav-height|safe-area-inset-bottom/, 'the token, never the arithmetic');
    assert.doesNotMatch(frameCss, /z-index:\s*3\d\d/, 'the menu layer sits under the nav (300)');
  });

  it('the Tools stylesheet keeps no second copy of the drawer', () => {
    const css = readCode('components/coaches/CoachToolbarMenu.module.css');
    assert.doesNotMatch(css, /\.drawer\b|\.drawerTitle\b/);
    assert.doesNotMatch(css, /--coach-foot-clear/, 'its geometry went with the frame');
    assert.doesNotMatch(css, /z-index:\s*3\d\d/, 'and its popover never rises above the nav (300) either');
  });
});

describe('step 1 · the dim travels with the sheet, inside the dismiss boundary', () => {
  it('the frame renders the portal dim, then the sheet, as siblings — never portalled', () => {
    const body = frame.slice(frame.indexOf('return ('));
    const dim = body.indexOf('<LineupSheetScrim onClose={() => { onClose(); rescueFocusTo(opener); }} />');
    const sheet = body.indexOf('<div ref={ref} className={styles.sheet}');
    assert.ok(dim > 0 && sheet > dim, 'the dim, then the sheet');
    assert.doesNotMatch(frame, /createPortal/, 'in-tree, so the sheet inherits --coach-foot-clear');
  });

  it('the frame owns the dim’s hand-back: a tap on it returns focus to the REQUIRED opener (step 2 /simplify)', () => {
    // Three of five step-2 sheets had written the close and forgotten the hand-back when it was the caller's job.
    assert.match(frame, /\n {2}opener: RefObject<HTMLElement \| null>;/, 'required — no sheet can leave it out');
  });

  for (const c of CONSUMERS) {
    it(`${c.who}: through the frame, inside the root its dismiss hook watches, a tap on the dim handing focus back`, () => {
      // ⚠ A dim OUTSIDE that root let a touch dismissal press the button underneath (2026-09-22, a lineup marked
      // READY with no way back). The frame brings the dim, so where the frame sits is where the dim sits.
      assert.ok(c.src.indexOf(`<SheetFrame ref={${c.ref}}`) > c.src.indexOf('<div ref={rootRef}'), 'inside the watched root');
      assert.match(c.src, /useDismissable\((open|sheetOpen), rootRef, /, 'and rootRef is what the hook watches');
      assert.doesNotMatch(c.src, /<LineupSheetScrim/, 'no dim of its own — the frame brings it');
      const line = frameLine(c.src, c.ref);
      assert.ok(line.includes(`onClose={${c.onClose}} opener={${c.opener}}`), 'the dim closes; the frame hands focus back to the opener');
      assert.ok(line.includes(`role="${c.role}"`), c.role === 'dialog' ? 'a dialog: checkboxes and dates, a pick does not close it' : 'a menu');
      assert.doesNotMatch(c.src, /aria-modal=/, 'the menu layer is never modal (D1)');
    });
  }

  it('the Tools menu: one close for every way out, the frame worn ALONE in sheet mode, and no placement work there', () => {
    assert.match(menu, /const dismiss = useCallback\(\(\) => \{ setOpen\(false\); rescueFocus\(\); \}/);
    assert.match(menu, /useDismissable\(open, rootRef, dismiss\);/);
    // Two classes across two CSS modules resolve by bundle order, so the sheet never also wears `.panel`.
    assert.match(menu, /<div ref=\{panelRef\} className=\{styles\.panel\} style=\{panelStyle\}/, 'the popover keeps .panel and its measured place');
    assert.doesNotMatch(menu, /styles\.drawer/);
    assert.match(menu, /useAnchoredMenu\(open && !asDrawer, /, 'the sheet does not re-measure a popover place on every scroll');
    assert.doesNotMatch(filter, /menu\.(?:panel|drawer|drawerTitle)\b/, 'the Filter sheet no longer borrows the menu’s surface');
  });

  it('the frame refuses className and style by type, and keeps aria-modal off at runtime', () => {
    assert.match(frame, /Omit<HTMLAttributes<HTMLDivElement>, 'aria-modal' \| 'className' \| 'style'/);
    // ⚠ The Omit alone does not hold: TypeScript does not check a hyphenated attribute a props type leaves out,
    // so `<SheetFrame aria-modal="true">` compiles and would ride the spread. The override AFTER it is the guard.
    assert.match(frame, /\{\.\.\.sheet\} aria-modal=\{undefined\}>/);
    assert.equal(frame.split('aria-modal=').length - 1, 1, 'and nothing else in the frame sets it');
  });

  it('the Tools menu moves focus into the panel again when the width crosses 640 while it is open', () => {
    // The sheet and the popover are different elements, so crossing remounts the panel; without this the focused
    // item went with it and the arrow keys (heard on the root) did nothing (/review 2026-10-05).
    assert.match(menu, /\}, \[open, asDrawer, items\]\);/);
  });
});

describe('step 1 · every shell that hosts a framed sheet declares the bar, once', () => {
  it('the coach shell and the admin shell both declare --coach-foot-clear where their bar shows', () => {
    assert.match(readCode('app/[orgSlug]/coaches/coaches.module.css'),
      /--coach-foot-clear: calc\(var\(--bottom-nav-height, 72px\) \+ env\(safe-area-inset-bottom, 0px\)\);/);
    const admin = readCode('app/[orgSlug]/admin/admin.module.css');
    const shell = cssRule(admin.slice(admin.indexOf('@media (max-width: 900px) {')), '.adminShell');
    assert.ok(
      shell.includes('--coach-foot-clear: calc(var(--bottom-nav-height, 72px) + env(safe-area-inset-bottom, 0px) + var(--admin-strip-h, 0px));'),
      'the admin: its bar (the coach bar’s own stylesheet), the context strip, the home indicator — without it the club’s sheets hung under their toolbar, undimmed',
    );
  });

  it('an admin page reads the shell’s token instead of declaring its own copy', () => {
    const teams = readCode('app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css');
    assert.doesNotMatch(teams, /--coach-foot-clear:/, 'Teams declared the same sum per page until step 1');
    assert.match(cssRule(splitPhoneCss(teams).phone, '.bulkDock'), /bottom: var\(--coach-foot-clear\);/, 'its docked bulk bar reads the token too');
  });
});

describe('step 2 · the small menus', () => {
  const team = readCode('components/coaches/CoachTeamSwitchSheet.tsx');
  const player = readCode('components/coaches/CoachPlayerSwitchSheet.tsx');
  const header = readCode('components/coaches/CoachTeamHeader.tsx');
  const playerPage = readCode('app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx');
  const schedule = readCode('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx');
  const builder = readCode('app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx');

  it('the menu label has ONE home: the frame wears SheetLabel, and nothing restates its small capitals', () => {
    assert.match(frame, /export function SheetLabel\(\{ children \}: \{ children: ReactNode \}\) \{\s*return <div className=\{styles\.label\}>\{children\}<\/div>;/);
    assert.match(frame, /\{label && <SheetLabel>\{label\}<\/SheetLabel>\}/, 'the frame’s own head is the same component');
  });

  for (const s of [
    { who: 'team switcher', src: team, label: 'Your teams' },
    { who: 'player switcher', src: player, label: 'Players' },
  ]) {
    it(`the ${s.who} wears the frame: the menu label, the card surface, a dim that hands focus back to the name`, () => {
      // Until step 2 it was the More sheet's container re-anchored outside the nav: a hand-copied bar height,
      // the mono section label (a third head style), and in dark the BAR'S colour.
      assert.ok(s.src.includes(`<SheetFrame ref={panelRef} label="${s.label}" onClose={onClose} opener={opener} role="menu" aria-label="${s.label}"`),
        'through the frame, labelled; a tap on the dim closes and the frame hands focus back to the name (it went to <body>)');
      assert.doesNotMatch(s.src, /sheet\.(sheetAnchor|sheetScrim|dropdown|sheetGrab|dropSectionLabel)\b/, 'no part of the More sheet’s container');
      assert.doesNotMatch(s.src, /aria-modal=|useOverlayOpen/, 'a menu: never modal, and it never hides the bar it sits on (D1)');
    });
  }

  it('both hosts render the switcher inside the boundary their dismiss hook watches, and name the opener', () => {
    assert.match(header, /useDismissable\(switchOpen, \[switchRef, switchSheetRef\], closeSwitch,/);
    assert.match(header, /<div ref=\{switchSheetRef\} style=\{\{ display: 'contents' \}\}>\s*<CoachTeamSwitchSheet[\s\S]*?opener=\{switchButtonRef\}/);
    assert.match(playerPage, /useDismissable\(sheetOpen, \[nameButtonRef, sheetRef\], closeSheet,/);
    assert.match(playerPage, /<div ref=\{sheetRef\} style=\{\{ display: 'contents' \}\}>\s*<CoachPlayerSwitchSheet[\s\S]*?opener=\{nameButtonRef\}/);
  });

  it('D5 · the Schedule’s view menu and Add event rise from the bar on a phone, titled', () => {
    const tag = (from: string) => { const at = schedule.indexOf(from); assert.notEqual(at, -1, from); return schedule.slice(at, schedule.indexOf('>', schedule.indexOf('\n', at))); };
    assert.match(tag('<CoachToolbarMenu label={`Change view'), /drawerOnPhone drawerTitle="View"/, 'the view menu');
    const add = schedule.slice(schedule.indexOf('label="Add Event"'), schedule.indexOf('{ADD_MENU.map'));
    assert.match(add, /drawerOnPhone\s+drawerTitle="Add event"/, 'Add event');
  });

  it('Print names itself: the menu label, a dialog role, never modal — focus in on open, back to Tools on Escape and on the dim', () => {
    assert.match(builder, /<LineupSheetScrim onClose=\{closePrint\} \/>\s*<div ref=\{printRef\} className=\{styles\.lineupAutoMenu\} role="dialog" aria-label="Print">\s*<SheetLabel>Print<\/SheetLabel>/);
    assert.match(builder, /function closePrint\(\) \{ setLineupPdfOpen\(false\); rescueFocusTo\(toolsTriggerRef\); \}/);
    assert.match(builder, /if \(lineupPdfOpen\) printRef\.current\?\.querySelector<HTMLElement>\('button'\)\?\.focus\(\{ preventScroll: true \}\);/, 'a dialog that never takes focus is never announced');
    // Escape went to <body> on every Tools panel (Copy from's was booked for step 5; it is the same line).
    assert.match(builder, /function escapeToolPanels\(\) \{ closeToolPanels\(\); rescueFocusTo\(toolsTriggerRef\); \}/);
    assert.match(builder, /useDismissable\(copyOpen \|\| saveTemplateOpen \|\| lineupPdfOpen, toolsRef, closeToolPanels, escapeToolPanels\);/);
    // The Tools menu LENDS its button — never a query into its markup (step 2 /simplify).
    assert.match(builder, /triggerRef=\{toolsTriggerRef\}/);
    assert.match(menu, /const triggerRef = triggerRefProp \?\? ownTriggerRef;/);
    assert.doesNotMatch(builder, /aria-haspopup="menu"\]/, 'no reaching into the menu by attribute');
    const print = builder.slice(builder.indexOf('<div ref={printRef}'), builder.indexOf('\n', builder.indexOf('<div ref={printRef}')));
    assert.doesNotMatch(print, /aria-modal|lineupDrawerOverNav/, 'the menu layer: never modal, never over the bar (D1)');
  });

  it('a menu of CHOICES answers the arrow keys, and opens on the one in force', () => {
    // `checked` rows are `menuitemradio`; the list read `menuitem` alone, so the Schedule's view menu had no stops.
    assert.ok(menu.includes(`querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled])')`));
    assert.match(menu, /const chosen = list\.find\(el => el\.getAttribute\('aria-checked'\) === 'true'\);/);
    assert.match(menu, /\(openOnRef\.current === 'last' \? list\[list\.length - 1\] : chosen \?\? list\[0\]\)\?\.focus/);
  });
});
