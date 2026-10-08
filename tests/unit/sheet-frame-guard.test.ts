import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readdirSync } from 'node:fs';
import { cssRule, readCode, readSource, splitPhoneCss } from './_source-code.ts';

/** Every .tsx under `dir` that renders a `CoachToolbarMenuItem` (repo-relative, forward slashes). */
function toolsRowFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map(rel => `${dir}/${rel.split('\\').join('/')}`)
    .filter(rel => rel.endsWith('.tsx') && readSource(rel).includes('<CoachToolbarMenuItem'));
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * SHEET FRAME — one frame for the portal's phone sheets (owner rulings D1–D6, 2026-10-05; plan
 * docs/projects/archive/SHEET_FRAME_PLAN.md, hub https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc).
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
 *   · Step 3 (2026-10-06): the FORM layer joins the frame (over the bar, the bar out of reach, modal, the
 *     keyboard kept inside, focus home to the opener); the game day's five sheets move onto the frame at
 *     ≤900 — Note and End game in the form layer, Scouting switching to it while an observation is typed
 *     (owner, 2026-10-06), Score and Who's here in the menu layer — and the console's own drawer recipe,
 *     its dark-only dim, its hand-copied bar height and its fall-through dim are gone.
 *   · Follow-up (2026-10-06, owner D7 + D8): the game-day button row DOCKS on the nav at ≤900 — edge to
 *     edge, its buttons in the console's column, on the nav at every scroll position; a computer unchanged.
 *   · Step 4 (2026-10-06): the record sheets — the position picker, the Award sheet, RSVP and the player
 *     row menus — move onto the frame, their contents where they were. The frame gains its own dim, a
 *     place OVER A WINDOW (RSVP, the depth chart's row menu), the grab line as a record head's Close, and
 *     — for a sheet with no trigger of its own — the menu layer's keys (`ownsKeys`: the floor WITHOUT its
 *     trap, and a tap on the bar closes it first; owner 2026-10-06). The picker and a read award stop
 *     claiming `aria-modal`.
 *   · Step 5 (2026-10-06): the frame answers EVERY sheet's keys — Escape, the phone's Back, a tap outside (its
 *     opener inside the boundary, so a trigger stays a toggle), focus in and home — and `ownsKeys` is gone; the
 *     sheets that answered their own (Tools, Filter, the switchers, game day, the row menus) stop, which gives
 *     Tools, Filter and the switchers the back step they lacked. The lineup builder's five drawers (Setup, Save
 *     as template, Call up, Copy from, Print) move onto the frame and its own dim (`LineupSheetScrim`) retires;
 *     the three forms keep the keyboard inside; Call up takes the shared form head (owner D9). A row that leaves
 *     the page is a link. The dim's colours are one setting (`--sheet-dim`).
 *
 * What it cannot see is the rendered sheet — `.probe/sf1/capture.mjs` (step 1, ten sheets),
 * `.probe/sf2/capture.mjs` (step 2, five sheets and two Tools sheets as the regression check) and
 * `.probe/sf3/capture.mjs` (step 3, the seven game-day surfaces at 390, 768 and 1280) and `.probe/sf4/capture.mjs`
 * (step 4, the record sheets, with Tab, Escape, Back, the dim and a tap on the bar) and `.probe/sf5/capture.mjs`
 * (step 5, every sheet the frame now answers for, with Back pressed twice) measured them before and after, warm
 * and dark, and diffed their computed styles and pixels.
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
    // The form layer (step 3) sits at the screen's foot, so it alone pads by the home indicator and stacks over
    // the nav — both pinned in step 3's own test. Everything else in the frame: the token, under the nav.
    // Over a window (step 4) sits at the screen's foot too, and the dims of both stack with their sheets.
    const raised = [cssRule(frameCss, '.sheet.form'), cssRule(frameCss, '.sheet.overWindow'),
      '.dim.form { bottom: 0; z-index: 389; }', '.dim.overWindow { bottom: 0; z-index: 409; }'];
    for (const rule of raised) assert.ok(frameCss.includes(rule), rule);
    const menuLayer = raised.reduce((css, rule) => css.split(rule).join(''), frameCss);
    assert.doesNotMatch(frameCss, /--bottom-nav-height/, 'the token, never the bar’s arithmetic');
    assert.doesNotMatch(menuLayer, /safe-area-inset-bottom/, 'the home indicator is inside the token for a sheet on the bar');
    assert.doesNotMatch(menuLayer, /z-index:\s*3\d\d/, 'the menu layer sits under the nav (300)');
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
    const dim = body.indexOf('<div ref={dimRef} className={`${styles.dim}${layer}`} aria-hidden="true" onClick={holdDim ? undefined : close} />');
    // `holdDim` (Tournament admin redesign Stage 6, 2026-10-07): the score sheet's named exception — a tap on its
    // dim does nothing (owner 2026-08-08: Cancel is the way out). Every other sheet's dim closes it.
    assert.match(frame, /\n {2}holdDim\?: boolean;/);
    assert.match(frame, /holdDim = false, keypad = false,/, 'off by default');
    const sheet = body.indexOf('ref={setPanel}');
    assert.ok(dim > 0 && sheet > dim, 'the dim, then the sheet');
    // A tap on the dim closes and waits for a write in flight; the floor (standing for every sheet since step 5)
    // hands focus back to the opener as the sheet unmounts, however it closed.
    assert.match(frame, /const close = \(\) => \{ if \(!busy\) onClose\(\); \};/);
    assert.doesNotMatch(frame, /createPortal/, 'in-tree, so the sheet inherits --coach-foot-clear');
  });

  it('the frame owns the dim’s hand-back: a tap on it returns focus to the REQUIRED opener (step 2 /simplify)', () => {
    // Three of five step-2 sheets had written the close and forgotten the hand-back when it was the caller's job.
    assert.match(frame, /\n {2}opener: RefObject<HTMLElement \| null>;/, 'required — no sheet can leave it out');
  });

  for (const c of CONSUMERS) {
    it(`${c.who}: through the frame, which answers its keys and hands focus back to the opener`, () => {
      // ⚠ A dim OUTSIDE the "tap outside" boundary let a touch dismissal press the button underneath (2026-09-22, a
      // lineup marked READY with no way back). Since step 5 the frame watches its own sheet, dim and opener.
      assert.doesNotMatch(c.src, /useDismissable\((open|sheetOpen), rootRef/, 'the sheet’s keys are the frame’s (step 5)');
      assert.doesNotMatch(c.src, /<LineupSheetScrim/, 'no dim of its own — the frame brings it');
      const line = frameLine(c.src, c.ref);
      assert.ok(line.includes(`onClose={${c.onClose}} opener={${c.opener}}`), 'the dim closes; the frame hands focus back to the opener');
      assert.ok(line.includes(`role="${c.role}"`), c.role === 'dialog' ? 'a dialog: checkboxes and dates, a pick does not close it' : 'a menu');
      assert.doesNotMatch(c.src, /aria-modal=/, 'the menu layer is never modal (D1)');
    });
  }

  it('the Tools menu: one close for every way out, the frame worn ALONE in sheet mode, and no placement work there', () => {
    assert.match(menu, /const dismiss = useCallback\(\(\) => \{ setOpen\(false\); rescueFocus\(\); \}/);
    assert.match(menu, /useDismissable\(open && !asDrawer, rootRef, dismiss\);/, 'the popover’s; the sheet’s keys are the frame’s (step 5)');
    // Two classes across two CSS modules resolve by bundle order, so the sheet never also wears `.panel`.
    assert.match(menu, /<div ref=\{panelRef\} className=\{styles\.panel\} style=\{panelStyle\}/, 'the popover keeps .panel and its measured place');
    assert.doesNotMatch(menu, /styles\.drawer/);
    assert.match(menu, /useAnchoredMenu\(open && !asDrawer, /, 'the sheet does not re-measure a popover place on every scroll');
    assert.doesNotMatch(filter, /menu\.(?:panel|drawer|drawerTitle)\b/, 'the Filter sheet no longer borrows the menu’s surface');
  });

  it('the frame refuses className and style by type, and the LAYER alone decides aria-modal', () => {
    assert.match(frame, /Omit<HTMLAttributes<HTMLDivElement>, 'aria-modal' \| 'className' \| 'style'/);
    // ⚠ The Omit alone does not hold: TypeScript does not check a hyphenated attribute a props type leaves out,
    // so `<SheetFrame aria-modal="true">` compiles and would ride the spread. The value AFTER it is the guard:
    // modal in the form layer (step 3), absent in the menu layer (D1).
    assert.match(frame, /\{\.\.\.sheet\}\s+data-escape-owner=""\s+aria-modal=\{form \|\| undefined\}\s+>/);
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

  it('both hosts name the opener and leave the sheet’s keys to the frame (step 5: Back closes the sheet)', () => {
    // Until step 5 each host answered the sheet with `useDismissable` and stood no back step, so on a phone
    // Back with the sheet open left the page (measured 2026-10-06). The frame stands it now.
    assert.match(header, /<CoachTeamSwitchSheet[\s\S]*?opener=\{switchButtonRef\}/);
    assert.match(playerPage, /<CoachPlayerSwitchSheet[\s\S]*?opener=\{nameButtonRef\}/);
    for (const host of [header, playerPage]) assert.doesNotMatch(host, /useDismissable/, 'no second answer to the sheet’s keys');
  });

  it('D5 · the Schedule’s view menu and Add event rise from the bar on a phone, titled', () => {
    const tag = (from: string) => { const at = schedule.indexOf(from); assert.notEqual(at, -1, from); return schedule.slice(at, schedule.indexOf('>', schedule.indexOf('\n', at))); };
    assert.match(tag('<CoachToolbarMenu label={`Change view'), /drawerOnPhone drawerTitle="View"/, 'the view menu');
    const add = schedule.slice(schedule.indexOf('label="Add Event"'), schedule.indexOf('{ADD_MENU.map'));
    assert.match(add, /drawerOnPhone\s+drawerTitle="Add event"/, 'Add event');
  });

  it('Print names itself: the menu label, a dialog role, never modal — focus in on open, back to Tools on Escape and on the dim', () => {
    // One body for both shells (step 5): the frame on a phone (its hand-back to Tools), the popover above 900.
    assert.match(builder, /const printBody = \(\s*<>\s*<SheetLabel>Print<\/SheetLabel>/);
    assert.ok(builder.includes('<LineupDrawer label="Print" ref={printRef} onClose={() => setLineupPdfOpen(false)} opener={toolsTriggerRef}>{printBody}</LineupDrawer>'));
    assert.match(builder, /if \(lineupPdfOpen\) printRef\.current\?\.querySelector<HTMLElement>\('button'\)\?\.focus\(\{ preventScroll: true \}\);/, 'a dialog that never takes focus is never announced');
    // Escape went to <body> on every Tools panel (Copy from's was booked for step 5; it is the same line) — the
    // popovers' line above 900; on a phone the frame's.
    assert.match(builder, /function escapeToolPanels\(\) \{ closeToolPanels\(\); rescueFocusTo\(toolsTriggerRef\); \}/);
    assert.match(builder, /useDismissable\(toolPanelOpen, toolsRef, closeToolPanels, escapeToolPanels\);/);
    // The Tools menu LENDS its button — never a query into its markup (step 2 /simplify).
    assert.match(builder, /triggerRef=\{toolsTriggerRef\}/);
    assert.match(menu, /const triggerRef = triggerRefProp \?\? ownTriggerRef;/);
    assert.doesNotMatch(builder, /aria-haspopup="menu"\]/, 'no reaching into the menu by attribute');
    const print = builder.slice(builder.indexOf('<LineupDrawer label="Print"'), builder.indexOf('\n', builder.indexOf('<LineupDrawer label="Print"')));
    assert.doesNotMatch(print, /aria-modal|\bform\b/, 'the menu layer: never modal, never over the bar (D1)');
  });

  it('a menu of CHOICES answers the arrow keys, and opens on the one in force', () => {
    // `checked` rows are `menuitemradio`; the list read `menuitem` alone, so the Schedule's view menu had no stops.
    assert.ok(menu.includes(`querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled])')`));
    assert.match(menu, /const chosen = list\.find\(el => el\.getAttribute\('aria-checked'\) === 'true'\);/);
    assert.match(menu, /\(openOnRef\.current === 'last' \? list\[list\.length - 1\] : chosen \?\? list\[0\]\)\?\.focus/);
  });
});

describe('step 3 · the form layer, and the game day on the frame', () => {
  const game = readCode('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx');
  const coachesCss = readCode('app/[orgSlug]/coaches/coaches.module.css');
  const floor = readCode('components/coaches/useDialogFloor.ts');
  const panel = readCode('components/coaches/OpponentScoutingPanel.tsx');
  const observation = readCode('components/coaches/ScoutObservationForm.tsx');

  it('the form layer’s geometry: flush to the screen’s foot, over the nav, under a modal, the home indicator padded', () => {
    assert.match(frameCss, /@media \(max-width: 900px\) \{[\s\S]*\.sheet\.form \{/, 'inside the bar’s breakpoint, like the rest');
    const form = cssRule(frameCss, '.sheet.form');
    // The bottom padding is named since step 5 (a pinned foot takes it over) — the home indicator still added.
    for (const decl of ['bottom: 0;', 'max-height: calc(100dvh - 12px);', 'z-index: 390;', '--sheet-foot-pad: calc(14px + env(safe-area-inset-bottom, 0px));', 'padding-bottom: var(--sheet-foot-pad);']) {
      assert.ok(form.includes(decl), `.sheet.form: ${decl}`);
    }
    // 390: over the nav (300), under `.modalOverlay` (400), so a dialog opened from a form lands on top of it.
    // The sheet and its dim wear the same layer classes, so the two can never disagree (step 4: one string).
    assert.ok(frame.includes("const layer = `${form ? ` ${styles.form}` : ''}${overWindow ? ` ${styles.overWindow}` : ''}`;"));
    assert.ok(frame.includes('className={`${styles.sheet}${layer}${grabCloses ? ` ${styles.grabCloses}` : \'\'}${full ? ` ${styles.full}` : \'\'}${keypad ? ` ${styles.keypad}` : \'\'}`}'));
  });

  it('the form layer takes the bar away from the thumb, the keyboard AND the screen reader, and keeps the keyboard inside', () => {
    // Covering a nav is not taking it away (2026-09-23): geometry alone defends the thumb and nothing else.
    // (Over a window the window already took the bar — step 4's own test.)
    assert.match(frame, /useOverlayOpenIfAvailable\(form && !overWindow\);/, 'the nav goes visibility: hidden — tolerant, the Tools menu’s frame also renders on admin pages');
    assert.match(frame, /useDialogFloor\(true, panelRef, \{ onClose, busy, opener, trap: form \}\);/,
      'Escape, Back, focus in and home for every sheet (step 5) — and Tab kept inside in the form layer only');
    assert.match(frame, /tabIndex=\{-1\}/, 'the panel takes focus when it opens, so it is announced');
    assert.match(frameCss, /\.sheet:focus \{ outline: none; \}/);
    // The dim comes down over the bar WITH the sheet — a lit bar under a modal is the mixed signal the ruling removes.
    assert.match(cssRule(frameCss, '.dim.form'), /^\s*bottom: 0; z-index: 389;\s*$/);
  });

  it('the floor hands focus back to an opener the caller NAMES — a tap on iOS never focused it', () => {
    assert.match(floor, /opener\?: RefObject<HTMLElement \| null>;/);
    assert.match(floor, /const openerRef = optsRef\.current\.opener;\s*const named = openerRef\?\.current;\s*restoreFocusRef\.current = named\?\.isConnected \? named : openerOf\(panelRef\.current\);/);
    assert.match(floor, /const named = openerRef\?\.current;\s*\(named\?\.isConnected \? named : captured\)\.focus/, 'and reads the named opener again as the panel closes');
  });

  it('game day: every sheet but the substitution confirm renders ONE way — the frame at ≤900, the card above', () => {
    const render = game.slice(game.indexOf('const renderSheet = '), game.indexOf('const bookSheet = '));
    // The console's own dim let a tap fall through and leave the game; the frame's is inside the boundary it watches.
    assert.ok(render.includes('<SheetFrame role="dialog" aria-label={label} onClose={dismissOverlay} opener={sheetOpenerRef} form={sheetIsForm} busy={sheetBusy}>'),
      'the plain close — the frame hands focus back itself, however the sheet closes');
    assert.ok(render.includes('<div className={styles.gdSheetBody}>{body}</div>'));
    assert.ok(render.includes('<div ref={sheetRef} className={styles.gdSheet} role="dialog" aria-label={label}>{body}</div>'), 'the card above 900, which the page’s hook watches');
    assert.ok(render.indexOf('isPhoneNav ?') < render.indexOf('<SheetFrame'), 'the frame only where the bar is');
    for (const call of ["renderSheet('Score', (", "renderSheet('Who’s here', (", "renderSheet('Note a moment', (", "renderSheet('End game', (", 'renderSheet(`Your book on ${event.opponent}`, (']) {
      assert.ok(game.includes(call), call);
    }
    assert.doesNotMatch(game, /className=\{styles\.gdSheet\}[^>]*>\s*<SheetFrame/, 'no sheet rendered around the frame');
    assert.match(game, /<div ref=\{swapRef\} className=\{styles\.gdSheet\} data-card="yes"/, 'the substitution confirm stays a card');
    assert.doesNotMatch(game, /aria-modal=|gdScrim|gdGrab|drawerScrim/, 'the frame decides modal; the console’s dim and grab line are gone');
  });

  it('game day: the test sorts the five — Note, End game and Scouting-while-logging are forms, on a phone', () => {
    assert.ok(game.includes("const sheetIsForm = isPhoneNav && (sheet === 'moment' || sheet === 'end' || (sheet === 'book' && bookLogging));"));
    assert.match(game, /const isPhoneNav = useIsPhoneNav\(\);/, 'the bar’s breakpoint, not the ≤640 phone one: the bar shows to 900');
    // The floor stands its own history entry; since step 5 the page stands down for EVERY sheet on a phone (either
    // layer), or Back pops two for one sheet. It keeps the substitution card and the computer's cards.
    assert.ok(game.includes('const pageOverlayOpen = pendingSwap !== null || (sheet !== null && !isPhoneNav);'));
    assert.ok(game.includes('useDismissable(pageOverlayOpen, [sheetRef, swapRef], dismissOverlay, sheet !== null ? closeSheetToOpener : undefined);'),
      'a card’s Escape hands focus to its opener at once, before the card unmounts');
    assert.ok(game.includes('useBackStep(pageOverlayOpen, dismissOverlay);'));
    assert.ok(game.includes("const sheetBusy = (sheet === 'moment' && momentSaving) || (sheet === 'end' && endSaving);"), 'a save in flight holds the form open');
  });

  it('game day: every door names its opener, and the × and Keep coaching hand focus home', () => {
    assert.doesNotMatch(game, /openSheet\('\w+'\)|setSheet\('book'\)|onClick=\{openEndSheet\}/, 'a door that does not say what opened the sheet');
    assert.match(game, /const openSheet = \(kind: SheetKind, from: HTMLElement \| null = null\) => \{\s*sheetOpenerRef\.current = from;/);
    // ONE close-and-hand-back for the ×, Keep coaching and Escape — at once, before the sheet unmounts (the hook's own Escape contract).
    assert.match(game, /const closeSheetToOpener = \(\) => \{\s*if \(sheetBusy\) return;\s*dismissOverlay\(\);\s*sheetOpenerRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*\};/,
      'held while a save is in flight, as the dim, Escape and Back are (/review 2026-10-06)');
    assert.ok(game.includes('onClick={closeSheetToOpener} aria-label="Close"'), 'the sheet head’s ×');
    assert.match(game, /onClick=\{closeSheetToOpener\} disabled=\{endSaving\}>\s*Keep coaching/, 'and looks held while End game sends');
    // A form owes a 44px × (D2): the head every game-day sheet wears.
    assert.match(cssRule(coachesCss, '.gdSheetClose'), /min-width: var\(--tap-min, 44px\); min-height: var\(--tap-min, 44px\);/);
  });

  it('game day: Scouting switches layer IN THE HANDLER the observation box opens and closes in', () => {
    assert.ok(game.includes('onLoggingChange={setBookLogging}'));
    assert.ok(panel.includes('onOpenChange={onLoggingChange}'));
    assert.ok(observation.includes('onClick={() => { setOpen(true); onOpenChange?.(true); }}'), 'the door');
    assert.match(observation, /setOpen\(false\);\s*onOpenChange\?\.\(false\);/, 'close — Cancel, Done and Escape');
    // From an effect keyed on the box, the switch would land a commit after the box's own focus move, and the
    // frame's floor would hand focus back to Scouting — behind the dim — after the box gave it to the door.
    assert.equal(observation.split('onOpenChange?.(').length - 1, 2, 'the door and close(): the closes a coach makes, in their handlers');
    // …and the close nobody makes: the box unmounting while open (the sheet closing; a tablet crossing 900px, the
    // sheet remounting as the card) — the book came back over the bar with no box in it (/review 2026-10-06).
    assert.match(observation, /useEffect\(\(\) => \(\) => \{\s*const \{ open: wasOpen, onOpenChange: report \} = reportRef\.current;\s*if \(wasOpen\) report\?\.\(false\);\s*\}, \[reportRef\]\);/);
    assert.doesNotMatch(game, /setBookLogging\(false\)/, 'one owner: the box reports every close, so the page never resets it by hand');
  });

  it('the console’s own drawer recipe is gone: no hand-copied bar height, no dark-only dim', () => {
    assert.doesNotMatch(coachesCss, /\.gdSheet:not\(\[data-card\]\)|\.gdScrim|\.gdGrab/);
    const gameDay = coachesCss.slice(coachesCss.indexOf('.gdSheet {'), coachesCss.indexOf('.gdSheetHead {'));
    const card = cssRule(gameDay, '.gdSheet[data-card]');
    assert.ok(card.includes('bottom: calc(var(--coach-foot-clear) + 0.5rem);'), 'the card that stays a card reads the token');
    assert.doesNotMatch(gameDay, /--bottom-nav-height/);
    assert.match(cssRule(coachesCss, '.gdSheetBody'), /padding: 0 0\.4rem;/, 'the frame’s 8px plus this = the 0.9rem the hub drew');
  });
});

/* Found by the owner in the §268 walk and ruled from the hub's true-size drawings (Mockup › 7): the
   game-day button row was a sticky bar inside the page's column — 358px of a 390px phone, and 32px
   off the nav once the page ran out. `.probe/gdfoot/verify.mjs` measured the built row at 390, 768,
   800 and 1280; `.probe/gdfoot/sheets.mjs` hit-tested its buttons and the sheets over it. */
describe('follow-up · the game-day button row docks on the nav (owner D7 + D8, 2026-10-06)', () => {
  const coachesCss = readCode('app/[orgSlug]/coaches/coaches.module.css');
  const gameFoot = coachesCss.slice(coachesCss.indexOf('.gdFooter {'), coachesCss.indexOf('.gdFbtn {'));
  const phone = gameFoot.slice(gameFoot.indexOf('@media (max-width: 900px) {'));

  it('D7 · at ≤900 the row is pinned on the nav at every scroll position, edge to edge, its buttons in the console’s column', () => {
    const docked = cssRule(phone, '.gdFooter.gdFooter');
    for (const decl of [
      'position: fixed;', 'left: 0;', 'right: 0;', 'bottom: var(--coach-foot-clear);', 'margin: 0;',
      'padding-inline: max(var(--coach-gutter), calc((100% - var(--gd-col-w)) / 2));',
    ]) assert.ok(docked.includes(decl), decl);
    assert.doesNotMatch(docked, /z-index/, 'the clearance is geometric — a raised row buried its own sheets once (2026-09-22)');
    assert.match(cssRule(phone, '.gdPage:has(> .gdFooter)'), /^\s*padding-bottom: var\(--gd-foot-h\);\s*$/,
      'the console leaves the row its own height, and only while the row is there (a read-only viewer has none)');
  });

  it('the column and the gutter the row insets to each have ONE declaration', () => {
    assert.match(coachesCss, /\.gdPage \{ --gd-col-w: 30rem; max-width: var\(--gd-col-w\);/);
    assert.match(coachesCss, /--coach-gutter: 1rem;/);
    assert.match(coachesCss, /\.coachesMain \{ padding: 1rem var\(--coach-gutter\) 2rem; \}/, 'the page pads by the same gutter');
  });

  it('D8 · above 900 the row stays sticky in its column — only the phone block docks it', () => {
    assert.doesNotMatch(cssRule(gameFoot, '.gdFooter'), /position|left:|right:/);
    assert.equal(coachesCss.split('.gdFooter.gdFooter {').length - 1, 1, 'one docking rule');
  });
});

/* Step 4 (2026-10-06): the record sheets onto the frame, their contents where they were. The owner ruled the
   menu layer's keys the same day: what the old floor gave a record sheet stays (Escape, Back, focus in and
   home), the hold on the keyboard and the modal claim go, and Tab past the end closes the sheet.
   `.probe/sf4/capture.mjs` measured every sheet before and after (Tab, Escape, Back, the dim, a tap on the bar). */
describe('step 4 · the record sheets on the frame', () => {
  const floor = readCode('components/coaches/useDialogFloor.ts');
  const picker = readCode('components/coaches/LineupPositionSheet.tsx');
  const rsvp = readCode('components/coaches/CoachRsvpSheet.tsx');
  const award = readCode('components/coaches/AwardSheet.tsx');
  const editor = readCode('app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx');
  const profile = readCode('components/coaches/PositionProfileEditor.tsx');
  const game = readCode('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx');
  const eventSheet = readCode('components/coaches/ScheduleEventSheet.tsx');
  const awards = readCode('app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx');
  const coachesCss = readCode('app/[orgSlug]/coaches/coaches.module.css');
  const tagLine = (src: string, from: string): string => {
    const at = src.indexOf(from);
    assert.notEqual(at, -1, from);
    return src.slice(at, src.indexOf('\n', at));
  };

  it('the frame owns its dim — the portal dim in both themes, nothing above 900 — and borrows no coach stylesheet', () => {
    assert.doesNotMatch(frame, /LineupSheetScrim|coaches\.module\.css/, 'a dim borrowed from the coach portal tied every framed sheet to its ~945KB stylesheet');
    assert.match(frameCss, /\n\.dim \{ display: none; \}/, 'inert on a computer: no call site needs a width branch');
    const phone = frameCss.slice(frameCss.lastIndexOf('@media (max-width: 900px) {'));
    const dim = cssRule(phone, '.dim');
    for (const d of ['position: fixed;', 'top: 0;', 'bottom: var(--coach-foot-clear);', 'z-index: 259;', 'background: var(--sheet-dim);']) {
      assert.ok(dim.includes(d), `.dim: ${d}`);
    }
    // Step 5: the portal's sheet dim is ONE setting for both themes. Its warm value must travel with the dark one,
    // or the portal's DEFAULT theme dims flat black; the More sheet reads it too, and nothing else copies the pair.
    const globals = readCode('app/globals.css');
    assert.match(globals, /--sheet-dim:\s+rgba\(13, 17, 26, 0\.45\);/, 'the dark dim, at the root');
    assert.match(globals, /--sheet-dim:\s+rgba\(36, 30, 21, 0\.28\);/, 'the warm dim, in the warm palette');
    assert.match(readCode('components/coaches/CoachesBottomNav.module.css'), /\.sheetScrim \{[^}]*background: var\(--sheet-dim\);/);
    for (const css of [frameCss, coachesCss]) assert.doesNotMatch(css, /rgba\(13, 17, 26, 0\.45\)|rgba\(36, 30, 21, 0\.28\)/, 'no second copy of the pair');
    assert.doesNotMatch(coachesCss, /\.lineupSheetScrim/, 'the builder’s own dim retired with step 5');
  });

  it('over a window: at the screen’s foot, above `.modalOverlay`, and no overlay of its own — the window holds the lock', () => {
    const over = cssRule(frameCss, '.sheet.overWindow');
    for (const d of ['bottom: 0;', 'max-height: calc(100dvh - 12px);', 'z-index: 410;', '--sheet-foot-pad: calc(14px + env(safe-area-inset-bottom, 0px));', 'padding-bottom: var(--sheet-foot-pad);']) {
      assert.ok(over.includes(d), `.sheet.overWindow: ${d}`);
    }
    assert.ok(frameCss.indexOf('.sheet.overWindow {') > frameCss.indexOf('.sheet.form {'), 'after the form layer, so a form over a window takes 410');
    assert.match(frame, /useOverlayOpenIfAvailable\(form && !overWindow\);/);
  });

  it('a record head keeps its Close: the grab line as a 44px button, in place of the drawn one', () => {
    assert.match(frame, /\{grabCloses && \(\s*<button type="button" className=\{styles\.grab\} aria-label="Close" onClick=\{close\}>/);
    assert.match(cssRule(frameCss, '.grab'), /min-height: var\(--tap-min, 44px\);/);
    assert.match(frameCss, /\.sheet\.grabCloses::before \{ content: none; \}/, 'one grab line, never two');
  });

  it('the menu layer’s keys, for a sheet with no trigger of its own: the floor WITHOUT its trap, and a tap on the bar closes it first', () => {
    assert.match(floor, /\n {4}trap\?: boolean;/);
    assert.ok(floor.includes("const held = optsRef.current.trap !== false;"));
    // Even with nothing focusable inside, a menu-layer panel never holds the keyboard (/review 2026-10-06).
    assert.match(floor, /if \(focusables\.length === 0\) \{\s*if \(!held\) \{ leave\(\); return; \}/);
    assert.match(floor, /if \(!held\) \{ leave\(\); return; \}\s*event\.preventDefault\(\);\s*\(event\.shiftKey \? last : first\)\.focus\(\);/);
    assert.match(floor, /const leave = \(\) => \{[\s\S]*?const home = restoreFocusRef\.current;\s*restoreFocusRef\.current = null;\s*home\?\.focus\?\.\(\{ preventScroll: true \}\);\s*onClose\(\);/,
      'Tab past the end closes it — home first, so the browser’s Tab carries on from the opener, and the close’s hand-back spent');
    // The bar tap is the menu layer's (a form's dim covers the bar), and the dim and the sheet are the boundary — a
    // dim counted as outside lets a tap fall through. The pointer half of `useDismissable`, one boundary rule.
    // Step 5: for every menu-layer sheet, and the opener is inside the boundary so a trigger stays a toggle.
    assert.ok(frame.includes('const close = () => { if (!busy) onClose(); };'), 'one close, the dim’s and the outside tap’s');
    assert.ok(frame.includes('usePointerOutside(!form, [panelRef, dimRef, opener], close);'));
    const hooks = readCode('lib/overlay-hooks.ts');
    assert.match(hooks, /export function usePointerOutside\(/);
    assert.equal(hooks.split('isOutside(refsRef.current, e.target)').length - 1, 2, 'useDismissable and usePointerOutside share one boundary test');
    assert.doesNotMatch(frame, /addEventListener\('pointerdown'/, 'no hand-written listener in the frame');
  });

  it('the position picker: a menu on the frame, never modal, the frame owning its keys — on the builder and on game day', () => {
    assert.ok(picker.includes('<SheetFrame grabCloses onClose={onClose} opener={opener} role="dialog" aria-labelledby={nameId} aria-describedby={subId}>'));
    assert.ok(picker.includes("<div data-position-sheet style={{ display: 'contents' }}>"), 'the layout sweep finds the dialog INSIDE the marker');
    assert.doesNotMatch(picker, /aria-modal|useDialogFloor|sheetAnchor|CoachesBottomNav/, 'no hold, no modal claim, no More-sheet container');
    assert.ok(editor.includes('opener={positionOpenerRef}') && game.includes('opener={positionOpenerRef}'), 'both hosts name the pill');
    assert.ok(game.includes('onClick={e => beginPositionEdit(r.playerId, e.currentTarget)}'), 'iOS does not focus a tapped button — the tap names it');
  });

  it('the Award sheet: ONE floor in both layers — the form layer while it is edited, the menu layer while it is read', () => {
    assert.match(award, /<SheetFrame\s+form=\{editing\}\s+busy=\{removing\}\s+onClose=\{requestClose\}\s+opener=\{opener\}/);
    assert.doesNotMatch(award, /useDialogFloor|useOverlayOpen|aria-modal|sheetAnchor/, 'the frame decides all of it from the layer');
    assert.ok(awards.includes('opener={awardOpenerRef}'));
    // A form owes a 44px way out (D2): the head's ✓ is the portal's 44px `.ppIconBtn`.
    assert.match(award, /aria-label=\{editing \? 'Done editing' : 'Edit this award'\}/);
  });

  it('RSVP: a FORM over its window wherever the bar shows — over a MODAL window it is modal itself — and the computer keeps its dialog', () => {
    assert.ok(rsvp.includes('<SheetFrame form overWindow grabCloses onClose={onClose} opener={opener} role="dialog" aria-labelledby={nameId} aria-describedby={subId}>'),
      'its 44px way out is the record head’s Close');
    assert.ok(rsvp.includes("<div data-rsvp-sheet style={{ display: 'contents' }}>"), 'the layout sweep finds the dialog INSIDE the marker');
    assert.match(rsvp, /if \(isPhoneNav\) \{/, 'the bar’s breakpoint decides');
    // …synchronously for a sheet that mounts after hydration — an effect-read media query rendered the phone
    // frame for one commit on a computer, standing a floor and a history step up and down (/review 2026-10-06).
    assert.match(readCode('lib/hooks/useIsPhoneNav.ts'), /return useSyncExternalStore\(subscribe, getSnapshot, getServerSnapshot\);/);
    assert.ok(rsvp.includes('useDialogFloor(!isPhoneNav, panelRef, { onClose, opener });'), 'one floor at a time — the dialog’s own above 900');
    assert.ok(eventSheet.includes('opener={rsvpOpenerRef}'));
    assert.doesNotMatch(rsvp, /CoachesBottomNav|sheetAnchor/, 'no More-sheet container left');
  });

  it('the notification reader, on both portals’ pages: a menu on the frame owning its keys; the computer keeps its dialog', () => {
    const reader = readCode('components/notifications/NotificationReader.tsx');
    assert.ok(reader.includes('<SheetFrame grabCloses onClose={onClose} opener={opener} role="dialog" aria-labelledby={titleId}>'));
    assert.ok(reader.includes("<div data-notification-reader style={{ display: 'contents' }}>"));
    assert.ok(reader.includes('useDialogFloor(!isPhoneNav, panelRef, { onClose, opener });'), 'one floor at a time — the dialog’s own above 900');
    assert.doesNotMatch(reader, /CoachesBottomNav|sheetAnchor|addEventListener\('pointerdown'/,
      'the bar-tap rule is the frame’s now — the reader’s 09-25 /review fix, held for every record sheet');
  });

  it('the player row menus: on the frame — on the bar, or over the depth chart’s window — their keys the frame’s', () => {
    const row = tagLine(editor, '<SheetFrame ref={rowSheetRef} onClose={() => setRowActionsFor(null)} opener={rowOpenerRef} role="dialog"');
    // Step 5: the frame answers their keys and stands their back step; the builder's opens only on a phone.
    assert.doesNotMatch(editor, /useDismissable\(rowActionsFor|useBackStep\(rowActionsFor/, 'no second answer to the row menu’s keys');
    const best = tagLine(profile, '<SheetFrame onClose={closeMenu} opener={menuOpenerRef} overWindow={menuCoversNav} role="dialog"');
    assert.ok(profile.includes('const popoverOpen = menuFor !== null && !isPhoneNav;'), 'the profile’s popover keeps its own keys above 900');
    assert.match(profile, /useDismissable\(popoverOpen, menuRef, closeMenu\);\s*useBackStep\(popoverOpen, closeMenu\);/);
    for (const tag of [row, best]) assert.doesNotMatch(tag, /\bform\b/, 'menus: the bar (or the window) stays theirs');
    assert.doesNotMatch(profile, /LineupSheetScrim|lineupDrawerOverNav/, 'over the window is the frame’s place now');
  });
});

/* Step 5 (2026-10-06): the lineup builder's five drawers onto the frame, and the frame answering every sheet's
   keys. `.probe/sf5/capture.mjs` measured every sheet the frame now answers for, before and after, warm and dark,
   at 390, 768 and 1280, with Back pressed twice (the second must leave the page: no entry left behind);
   `.probe/sf5/keys.mjs` walked the keyboard. Before: Back with Tools, Filter, either switcher, or the Schedule's
   two menus open LEFT THE PAGE (7 of 7); Setup, Save as template and Call up let 4, 9 and 10 of 12 Tab presses
   walk out under their dim. */
describe('step 5 · the frame answers every sheet, and the lineup builder\'s drawers stand on it', () => {
  const floor = readCode('components/coaches/useDialogFloor.ts');
  const builder = readCode('app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx');
  const editor = readCode('app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx');
  const callUp = readCode('components/coaches/CallUpSheet.tsx');
  const saveTemplate = readCode('components/coaches/LineupSaveTemplate.tsx');
  const copyFrom = readCode('components/coaches/LineupCopyFrom.tsx');
  const drawer = readCode('components/coaches/LineupDrawer.tsx');
  const copyCss = readCode('components/coaches/LineupCopyFrom.module.css');
  const coachesCss = readCode('app/[orgSlug]/coaches/coaches.module.css');
  const game = readCode('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx');

  it('one floor for every sheet: Escape, Back, focus in and home; the keyboard held only in the form layer', () => {
    assert.ok(frame.includes('useDialogFloor(true, panelRef, { onClose, busy, opener, trap: form });'));
    assert.doesNotMatch(frame, /ownsKeys/, 'the frame-owned-keys flag retired: the floor always stands');
    // A floor the sheet opens over (a window, a block editor) hears the same Escape and must yield: the sheet marks
    // itself, and the floor reads a marker on its OWN panel as its own claim.
    assert.ok(floor.includes("const owner = target instanceof Element ? target.closest('[data-escape-owner]') : null;"));
    assert.ok(floor.includes('if (owner && owner !== panel) return;'));
    // Focus home no longer scrolls the page — since step 4 it also runs on a tap on the bar — and it reads the
    // opener as the panel closes (a re-rendered button is a new node).
    assert.ok(floor.includes('(named?.isConnected ? named : captured).focus?.({ preventScroll: true });'));
    // /review: since every sheet stands the floor, a Tools pick that opens a window closes the Tools sheet in the
    // window's own commit, and the window's autoFocus field already holds focus when the sheet's floor stands down.
    // Pulled home, the field lost its cursor (practice plan › Save as template… on a phone, measured). Home only
    // when focus is nowhere or still inside the closing panel.
    assert.match(floor, /const went = now instanceof HTMLElement && now !== document\.body && now !== document\.documentElement\s+&& !\(panel && panel\.contains\(now\)\);\s+if \(went\) return;/);
    // …and a floor that stands down and up over the SAME panel (React's dev double effect: every window, every
    // dev open) hands focus back to the control that had it, not to the frame.
    assert.ok(floor.includes('heldRef.current = now instanceof HTMLElement && panel?.contains(now) ? now : null;'));
    assert.ok(floor.includes('(held?.isConnected && panel.contains(held) ? held : panel).focus();'));
  });

  it('nothing else answers a sheet’s keys on a phone — answered twice, Back would pop two entries for one sheet', () => {
    for (const [file, src] of [
      ['components/coaches/FilterGroup.tsx', filter],
      ['components/coaches/CoachTeamHeader.tsx', readCode('components/coaches/CoachTeamHeader.tsx')],
      ['app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx', readCode('app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx')],
    ] as const) assert.doesNotMatch(src, /useDismissable\(/, `${file}: its sheet is the frame’s`);
    assert.doesNotMatch(filter, /onBlur/, 'Tab past the Filter sheet’s end is the frame’s too');
    assert.match(menu, /useDismissable\(open && !asDrawer, rootRef, dismiss\);/, 'the Tools popover keeps its own; the sheet does not');
    // The builder's Tools panels, Setup and Call up: their own keys above 900 only.
    assert.ok(builder.includes('const toolPanelOpen = (copyOpen || saveTemplateOpen || lineupPdfOpen) && !isPhoneNav;'));
    for (const step of ['useBackStep(copyOpen && !isPhoneNav,', 'useBackStep(saveTemplateOpen && !isPhoneNav,', 'useBackStep(lineupPdfOpen && !isPhoneNav,']) {
      assert.ok(builder.includes(step), step);
    }
    assert.ok(editor.includes('const callUpPopoverOpen = !!callUps?.sheetOpen && !isPhoneNav;'));
    assert.doesNotMatch(editor, /useDismissable\(autoFillOpen|useBackStep\(autoFillOpen/, 'Setup: the frame on a phone, its own floor above 900');
    assert.doesNotMatch(game, /useBackStep\(overlayOpen/, 'game day: the page’s back step is the card’s and the swap’s');
  });

  it('a row that leaves the page is a LINK — a back step cancels a router.push from a button (the §258 failure)', () => {
    assert.match(menu, /if \(href !== undefined && !disabled\) \{\s*return <Link href=\{href\} className=\{className\} role="menuitem" tabIndex=\{-1\}>\{body\}<\/Link>;/);
    assert.ok(menu.includes("if ((event.target as HTMLElement).closest('button, a[href]')) dismiss();"), 'picking a link closes the menu like any row');
    assert.match(menu, /case ' ':\s*if \(event\.target instanceof HTMLAnchorElement && event\.target\.matches\('\[role="menuitem"\]'\)\) \{\s*event\.preventDefault\(\);\s*event\.target\.click\(\);/,
      'Space activates a link row, as it does the button rows (/review)');
    // Every file that renders a Tools row — found, not listed, so a new page is covered the day it adds one:
    // no row navigates by code.
    const rowFiles = [...toolsRowFiles('app'), ...toolsRowFiles('components')];
    assert.ok(rowFiles.length >= 10, `found ${rowFiles.length} files with a Tools row — the walk is reading the tree`);
    for (const file of rowFiles) {
      assert.doesNotMatch(readCode(file), /onSelect=\{\(\) => \{?\s*router\.(push|replace)\(/, `${file}: a Tools row that navigates is an href`);
    }
    assert.match(readCode('app/[orgSlug]/admin/accounting/ledger/page.tsx'), /label="Payees"[\s\S]{0,200}href=\{payeesHref\} \/>/);
    assert.match(readCode('app/[orgSlug]/admin/tournaments/registrations/page.tsx'), /label=\{TEAMS_WORDS\.registrationQuestions\}\s+href=\{questionsHref\} \/>/);
  });

  it('the three forms stand on the frame’s form layer on a phone — over the bar, the keyboard kept inside — each with its 44px ×', () => {
    // Through the builder's one drawer shell, which hands `form`, `busy` and the opener straight to the frame.
    assert.match(drawer, /<SheetFrame ref=\{ref\} form=\{form\} full=\{full\} busy=\{busy\} id=\{id\} role="dialog" aria-label=\{label\} onClose=\{onClose\} opener=\{opener\}>/);
    assert.ok(editor.includes('<LineupDrawer label="Lineup setup" form id={SETUP_PANEL_ID} ref={setupPanelRef} onClose={closePanelToRow} opener={setupRowRef}'));
    assert.ok(editor.includes('<LineupDrawer label="Call up a player" form busy={callUps.busy} onClose={callUps.onCloseSheet} opener={callUpButtonRef}>'));
    assert.ok(saveTemplate.includes('<LineupDrawer label="Save as template" form busy={busy} onClose={onClose} opener={opener}>'));
    assert.ok(builder.includes('busy: callUpSaving,'), 'a call-up being added holds its sheet');
    // D2: a form's head is the shared one — Call up's own <h3> and bare × were a third copy (owner D9, 2026-10-06).
    assert.ok(editor.includes('<LineupDrawerHead title="Lineup setup" onClose={closePanelToRow} desktopClose />'));
    assert.ok(callUp.includes('<LineupDrawerHead title="Call up a player" onClose={onClose} desktopClose />'));
    assert.doesNotMatch(callUp, /<h3|modalCloseBtn/, 'no head of its own');
    assert.ok(saveTemplate.includes('<LineupDrawerHead title="Save as template" onClose={onClose}'));
    assert.match(coachesCss, /@media \(max-width: 900px\) \{[^@]*?\.lineupSetupDrawerClose \{\s*display: inline-flex;\s*width: var\(--tap-min, 44px\);\s*height: var\(--tap-min, 44px\);/,
      'the head’s × at the 44px floor wherever it is a form (≤900)');
    // Above 900 Setup is a centred modal: it stands the same floor (Escape, Tab kept inside, Back, focus home).
    assert.ok(editor.includes('useDialogFloor(autoFillOpen && !isPhoneNav, setupPanelRef, { onClose: closePanelToRow, opener: setupRowRef });'));
    assert.ok(editor.includes(`popover={{ className: styles.lineupSetupDrawer, tabIndex: -1, 'aria-modal': 'true' }}`));
    // No form calls useOverlayOpen itself: the frame takes the bar away (and only the frame).
    for (const src of [builder, editor, saveTemplate, callUp]) assert.doesNotMatch(src, /useOverlayOpen\(/);
  });

  it('the two menus stand on the frame’s menu layer on a phone — Copy from filling the screen above the bar (D7, kept by D3)', () => {
    assert.ok(copyFrom.includes('<LineupDrawer label="Copy from" ref={panelRef} full busy={busy} onClose={onClose} opener={opener}'));
    assert.ok(builder.includes('opener={toolsTriggerRef}'), 'Copy from and Save as template hand focus home to Tools — the menu item that opened them is gone');
    const full = frameCss.slice(frameCss.indexOf('@media (max-width: 640px) {'));
    const sheetFull = cssRule(full, '.sheet.full');
    for (const d of ['top: 0;', 'max-height: none;', 'display: flex;', 'flex-direction: column;', 'border-radius: 0;', 'box-shadow: none;']) {
      assert.ok(sheetFull.includes(d), `.sheet.full: ${d}`);
    }
    assert.doesNotMatch(sheetFull, /(^|\n)\s*bottom:/, 'it keeps the bar’s top: a menu leaves the bar live');
    assert.match(full, /\.sheet\.full::before \{ content: none; \}/, 'no grab line on a full screen');
    assert.match(copyCss, /\.body\.body \{ flex: 1 1 auto; min-height: 0; padding: 0; \}/, 'two classes: the shared body lives in another module');
  });

  it('a pinned foot takes the sheet’s bottom padding, by one value — the strip of scrolled content under it stays closed', () => {
    assert.ok(frameCss.includes('.sheet.sheet:has([data-sheet-foot]) { padding-bottom: 0; }'));
    assert.match(cssRule(frameCss, '.sheet'), /--sheet-foot-pad: 14px;\s*padding: 6px 8px var\(--sheet-foot-pad\);/);
    for (const layer of ['.sheet.form', '.sheet.overWindow']) {
      assert.match(cssRule(frameCss, layer), /--sheet-foot-pad: calc\(14px \+ env\(safe-area-inset-bottom, 0px\)\);\s*padding-bottom: var\(--sheet-foot-pad\);/, layer);
    }
    assert.match(cssRule(coachesCss, '.lineupSheetFoot'), /padding-bottom: var\(--sheet-foot-pad, 14px\);/);
    assert.ok(editor.includes('<div className={styles.lineupSheetFoot} data-sheet-foot>') && callUp.includes('<div className={coach.lineupSheetFoot} data-sheet-foot>'),
      'both feet say so — the question is "is there a foot?", never which sheet this is');
  });

  it('the builder’s own drawer recipe is gone, and what is inside a drawer kept its place', () => {
    assert.ok(!existsSync('components/coaches/LineupSheetScrim.tsx'), 'the builder’s dim retired');
    for (const src of [builder, editor, copyFrom, saveTemplate]) assert.doesNotMatch(src, /LineupSheetScrim|lineupDrawerOverNav/);
    assert.doesNotMatch(coachesCss, /\.lineupDrawerOverNav[ .{]|--lineup-drawer-foot-pad/, 'its over-nav modifier went with it');
    assert.doesNotMatch(coachesCss, /@media \(max-width: 900px\) \{\s*\.lineupAutoMenu \{/, 'no phone drawer left in .lineupAutoMenu — the popover above 900 only');
    // The body: the old drawer's 14px inset (the frame's 8 + 6) and the gap its grab line left (0.6rem).
    assert.match(cssRule(coachesCss, '.lineupSheetBody'), /display: flex;\s*flex-direction: column;\s*gap: 0\.6rem;\s*padding: 0\.6rem 6px 0;/);
    // Every rule that reached a drawer's insides through the popover reaches them through the body too.
    for (const rule of ['.lineupSheetBody .lineupControlLabel', '.lineupSheetBody .select', '.lineupSheetBody .select:focus-visible',
      '.lineupSheetBody .lineupSetupFields', '.lineupSheetBody .btnSecondary']) {
      assert.ok(coachesCss.includes(rule), rule);
    }
  });
});
