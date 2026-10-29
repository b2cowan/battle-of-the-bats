import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { cssRule, readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * IN THE ADMIN, A FORM WINDOW OPENS OVER THE PHONE BAR, NEVER UNDER IT (Admin bar behind forms, 2026-10-18; the rule is
 * the drawer-layers ruling of 2026-09-23: a FORM covers the nav, a MENU sits on top of it).
 *
 * The coaches portal keeps a form clear of its bar two ways: the window's layer is above the bar's, AND every window
 * registers (`lib/coaches-overlay.tsx`) so the bar steps aside. The admin keeps ONE of them, deliberately: its windows
 * clear the bar BY LAYER. The census of 2026-10-18 found every admin form already did, bar three, which this unit
 * lifted (the chat's New room window; on a 641–900px screen, the coach windows the admin borrows — Budget vs. Actual's
 * cell and plan windows, the shared library's award icon picker — by moving the coach window's clearance from the
 * @640 block to @900, so the coaches portal gains it too). The registration route was not built: it would hide
 * a bar already covered, and its page-scroll lock is inert in the admin, whose phone page scrolls inside `.adminMain`,
 * not the body (plan `docs/projects/active/ADMIN_BAR_BEHIND_FORMS_PLAN.md`).
 *
 * So this guard holds two things:
 *   1. every window layer the admin draws or borrows sits above the bar's own layer, read from the bar's stylesheet;
 *   2. every admin file that draws its own window is NAMED below, with which layer clears the bar or why it is not a
 *      form. A new one fails here until someone answers that — the decision point, not a formality.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = process.cwd();
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(rel(p));
  }
  return out;
}

const zOf = (block: string, where: string): number => {
  const m = /z-index:\s*(\d+)/.exec(block);
  assert.ok(m, `${where}: no z-index`);
  return Number(m[1]);
};

/** The phone bar's layer: `.bottomNav` inside the stylesheet's phone block (the admin bar wears this stylesheet). */
const BAR = (() => {
  const css = readSource('components/coaches/CoachesBottomNav.module.css');
  const at = css.indexOf('@media (max-width: 900px) {');
  assert.ok(at >= 0, 'the bar stylesheet has no phone block');
  return zOf(cssRule(css.slice(at), '.bottomNav'), 'CoachesBottomNav .bottomNav (phone)');
})();

/** Every window layer the admin draws or borrows, keyed for the file list below. `selector` reads a CSS rule; `inline`
 *  reads a `zIndex` written in the component. */
const LAYERS: Record<string, { file: string; selector?: string; inline?: true }> = {
  kitForm: { file: 'components/shared/KitDialog.module.css', selector: '.overlay' },
  houseLeague: { file: 'app/[orgSlug]/admin/house-league/house-league.module.css', selector: '.modalOverlay' },
  globalModal: { file: 'app/globals.css', selector: '.modal-overlay' },
  bottomSheet: { file: 'components/admin/BottomSheet.module.css', selector: '.backdrop' },
  leagueCap: { file: 'components/admin/LeagueCapUpgrade.tsx', inline: true },
  newRoom: { file: 'components/chat/NewRoomDialog.module.css', selector: '.backdrop' },
  // The shared windows the admin shell renders (the census, 2026-10-18).
  chatManage: { file: 'components/chat/ChatManagePanel.module.css', selector: '.backdrop' },
  feedback: { file: 'components/feedback/FeedbackWidget.tsx', inline: true },
  earlyAccess: { file: 'components/EarlyAccessModalTrigger.module.css', selector: '.overlay' },
  planPanel: { file: 'components/billing/PlanArticlePanel.module.css', selector: '.backdrop' },
  helpDrawer: { file: 'components/help/help.module.css', selector: '.helpDrawerBackdrop' },
  sheetForm: { file: 'components/coaches/SheetFrame.module.css', selector: '.sheet.form' },
};

/**
 * Every admin file whose own code draws a window (comments stripped): the layer that clears the bar, or why it needs
 * none. ⚠ Adding a file here is the decision — a FORM names its layer; a MENU says what it does instead of taking input.
 */
const WINDOWS: Record<string, { layers: string[] } | { notAForm: string }> = {
  // (The season's Registrations left 2026-10-25, Club Tier 9b-2 Part 3, and Teams & draft with Club Tier 9c Part 3: every
  //  window they open is a KitDialog now.)
  'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx': { layers: ['houseLeague'] },
  'app/[orgSlug]/admin/onboarding/page.tsx': { notAForm: 'a FOCUSED flow: the admin shell draws no bar on onboarding (AdminChrome `isFocused`)' },
  'app/[orgSlug]/admin/tournaments/chat/page.tsx': { layers: ['kitForm', 'newRoom'] },
  'app/[orgSlug]/admin/tournaments/registrations/page.tsx': { layers: ['globalModal'] },
  'app/[orgSlug]/admin/tournaments/schedule/components/ResolveFacilitiesModal.tsx': { layers: ['globalModal'] },
  'app/[orgSlug]/admin/tournaments/schedule/components/ResolveLocationsModal.tsx': { layers: ['globalModal'] },
  'components/admin/BottomSheet.tsx': { layers: ['bottomSheet'] },
  'components/admin/LeagueCapUpgrade.tsx': { layers: ['leagueCap'] },
  'components/shared/KitDialog.tsx': { layers: ['kitForm'] },
  'components/admin/kit/club/money/AllocationWindow.tsx': { notAForm: 'reads its KitDialog (`closest(\'[role="dialog"]\')`); draws none' },
  // (MoneyKit.tsx left 2026-10-19: FormError is KitDialog's own refusal line now, `DialogReason`, One Window 2b.)
  'components/admin/kit/club/league/teams/TeamsBoard.tsx': { notAForm: 'a row mark\'s READ-ONLY window (a family\'s children, a sign-up note, an amount owing): a popover at a desk, a SheetFrame menu on a phone; it takes no input' },
  'components/admin/tournament/PrintedPage.tsx': { notAForm: 'a print-only portal; never on screen' },
  'components/admin/tournament/ReorderList.tsx': { notAForm: 'a MENU: the row\'s options (move up, move down), a SheetFrame menu on a phone' },
  // (TournamentAdminUI.tsx left 2026-10-20: its status legend popover went with admin type sweep Stage 5.)
};

const SIGNAL = /aria-modal|createPortal\(|modal-overlay|\.modalOverlay\b|role="dialog"/;

describe('admin windows open over the phone bar (Admin bar behind forms, 2026-10-18)', () => {
  it('the admin bar wears the coach bar\'s stylesheet, whose phone layer this guard reads', () => {
    const nav = readCode('components/admin/kit/AdminKitBottomNav.tsx');
    assert.match(nav, /import styles from '@\/components\/coaches\/CoachesBottomNav\.module\.css'/);
    assert.match(nav, /<nav className=\{styles\.bottomNav\}/);
    assert.equal(BAR, 300, 'the bar moved layer: re-read every window below against the new value');
  });

  for (const [key, l] of Object.entries(LAYERS)) {
    it(`${key} sits above the bar`, () => {
      const src = readSource(l.file);
      const z = l.inline
        ? Math.max(...[...src.matchAll(/zIndex:\s*(\d+)/g)].map(m => Number(m[1])))
        : zOf(cssRule(src, l.selector!), `${l.file} ${l.selector}`);
      assert.ok(z > BAR, `${l.file}${l.selector ? ` ${l.selector}` : ''} is at ${z}, under the bar (${BAR})`);
    });
  }

  it('a coach window the admin borrows clears the bar at every width the bar shows (641–900 included)', () => {
    const css = readSource('app/[orgSlug]/coaches/coaches.module.css');
    const m = /@media \(max-width: 900px\) \{\s*\.modalOverlay \{ z-index: (\d+); \}/.exec(css);
    assert.ok(m, 'the .modalOverlay clearance at 900px (the bar\'s own breakpoint) is gone');
    assert.ok(Number(m[1]) > BAR);
    // The autosave word rises with it at 641–900, or a coach's "Couldn't save · Retry" hides under the window whose
    // edits it reports (the §227 lesson at 640, /review 2026-10-18).
    const pill = /@media \(min-width: 641px\) and \(max-width: 900px\) \{\s*body:has\(\.modalOverlay\) \.savePill \{ z-index: (\d+); \}/.exec(css);
    assert.ok(pill, 'the save pill no longer rises over a window at 641–900');
    assert.ok(Number(pill[1]) > Number(m[1]), 'the save pill must sit above the window it reports on');
  });

  it('every admin file that draws its own window is named, with its layer or why it is not a form', () => {
    const found = [...walk(path.join(ROOT, 'app/[orgSlug]/admin')), ...walk(path.join(ROOT, 'components/admin')), 'components/shared/KitDialog.tsx']
      .filter(f => SIGNAL.test(readCode(f)));
    const unnamed = found.filter(f => !(f in WINDOWS));
    assert.deepEqual(unnamed, [], `a new admin window: name it in WINDOWS with the layer that clears the bar (a FORM) or why it is not a form (a MENU)`);
    const stale = Object.keys(WINDOWS).filter(f => !found.includes(f));
    assert.deepEqual(stale, [], 'named but no longer draws a window: take it off the list');
    for (const [f, w] of Object.entries(WINDOWS)) {
      if ('layers' in w) for (const k of w.layers) assert.ok(k in LAYERS, `${f}: unknown layer ${k}`);
    }
  });

  it('the chat\'s rooms drawer closes when New room opens — a MENU closes on a pick, and it stood over the window', () => {
    const page = readCode('app/[orgSlug]/admin/tournaments/chat/page.tsx');
    assert.match(page, /onNewRoom=\{\(\) => \{ closeRooms\(\);[^}]*setComposerOpen\(true\); \}\}/);
  });
});
