/**
 * THE ADMIN'S PINNED BAR NAMES WHERE YOU ARE (Admin header bar, option 4, owner 2026-11-07) — Phase 1, the bar's shape.
 * Plan: docs/projects/active/ADMIN_HEADER_BAR_PLAN.md.
 *
 * The name sits on top and the facts ride a small line UNDER it, in the coaches portal's masthead meta voice; the bar
 * never shrinks on scroll, at any width (the collapse made content jump under the thumb, and the portal took the same
 * snap out 2026-09-21). If a scroll listener, a collapsed class or a second chip copy comes back, the build says so.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';

const bar = readCode('components/admin/AdminEventHeader.tsx');
const css = readCode('components/admin/kit/AdminKitEventHeader.module.css');

/** One rule's body, by its exact selector. */
function block(sheet: string, selector: string): string {
  const at = sheet.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} exists`);
  return sheet.slice(at, sheet.indexOf('}', at));
}

describe('the admin bar never shrinks on scroll', () => {
  it('no collapsed state, no scroll listener, no second chip copy, no compact pill', () => {
    assert.doesNotMatch(bar, /setCollapsed|collapsed|addEventListener\('scroll'/);
    assert.doesNotMatch(bar, /chipCollapsed|chipOnDates|compact=/);
    assert.doesNotMatch(css, /\.collapsed\b|\.chipCollapsed\b|transition:\s*padding/);
  });

  it('it still publishes its height for the in-page sticky toolbars', () => {
    assert.match(bar, /setProperty\('--admin-header-h', `\$\{el\.offsetHeight\}px`\)/);
    assert.match(bar, /new ResizeObserver\(publish\)/);
  });

  it('the portal masthead’s padding: 0.45rem on a phone, 0.5rem on desktop; the 44px pill overhangs by 4px', () => {
    assert.match(block(css, '.header'), /padding: calc\(0\.45rem \+ env\(safe-area-inset-top\)\) [^;]* 0\.45rem /);
    assert.match(css, /@media \(min-width: 901px\) \{\s*\.header \{[^}]*padding: 0\.5rem 2rem;/);
    assert.match(css, /\.pill \{ margin-block: -4px; \}/);
  });
});

describe('the small line sits under the name', () => {
  it('the name comes first, then the line of facts: club · dates · chip', () => {
    const identity = bar.slice(bar.indexOf('className={styles.identity}'));
    const metaAt = identity.indexOf('${styles.meta}${clubOnly');
    assert.ok(metaAt > 0 && identity.indexOf('{nameEl}') < metaAt, 'name above the line');
    const meta = identity.slice(metaAt);
    assert.ok(meta.indexOf('styles.metaClub') < meta.indexOf('{dates}'), 'club before dates');
    assert.ok(meta.indexOf('{dates}') < meta.indexOf('{phaseLabel}'), 'dates before the chip');
    assert.doesNotMatch(bar, /eyebrow/i, 'no eyebrow above the name');
  });

  it('the line is the portal meta voice: data face, label step, normal weight, no tracking, no capitals', () => {
    const meta = block(css, '.meta');
    for (const decl of [/font-family: var\(--font-data\)/, /font-size: var\(--type-label\)/, /font-weight: 400/,
      /letter-spacing: normal/, /text-transform: none/, /color: var\(--text-tertiary\)/]) assert.match(meta, decl);
  });

  it('the dot is drawn between words, never before the chip, and a phone drops the club without a stranded dot', () => {
    assert.match(css, /\.meta > span:not\(\.chip\) \+ span:not\(\.chip\)::before \{\s*content: '·';/);
    // ⚠ The phone rule must match the separator rule's weight: a bare `.metaClub + span::before` loses to it and leaves
    // "· Nov 1–3, 2026" on a phone (caught in the browser, 2026-11-07).
    assert.match(css, /@media \(max-width: 900px\) \{\s*\.metaClub \{ display: none; \}[^}]*\.meta > span\.metaClub \+ span:not\(\.chip\)::before \{ content: none; \}/);
    assert.ok(css.indexOf('.meta > span.metaClub + span:not(.chip)::before') > css.indexOf('.meta > span:not(.chip) + span:not(.chip)::before'),
      'the phone rule comes after the separator rule, so it wins');
  });

  it('the tournament name still opens its dashboard', () => {
    assert.match(bar, /titleHref = `\/\$\{currentOrg\?\.slug \?\? ''\}\/admin\/tournaments\/dashboard`/);
    assert.match(bar, /<Link href=\{titleHref\} className=\{styles\.nameLink\}/);
  });
});

/**
 * Phase 2 (2026-11-07): a club place hands the bar its name, way up, small line, chip, switcher and tab row; the tabs pin
 * INSIDE the bar. The bar knows the place from the address before the frame has spoken, so the club's name never shows
 * and swaps; and it takes a hand-off only for the place the address is in.
 */
describe('a club place names itself in the bar, and its tabs pin inside it', () => {
  const hand = readCode('components/admin/AdminBarPlace.tsx');
  const frame = readCode('components/admin/kit/club/PlaceFrame.tsx');
  const tabBar = readCode('components/shared/HubTabBar.tsx');
  const tabCss = readCode('components/shared/HubTabBar.module.css');

  it('no flash: the place comes from the address first, and a hand-off counts only for that place', () => {
    assert.match(bar, /clubPlaceAt\(pathname, `\/\$\{currentOrg\.slug\}\/admin`, \{ canUse: canOpen, seasonAccess \}\)/);
    assert.match(bar, /handed\?\.key === routePlace\.key \? \{ \.\.\.handed, activeId: routePlace\.activeId \} : routePlace/);
    // A layout effect, so a client navigation redraws the bar before the browser paints.
    assert.match(hand, /useLayoutEffect\(\(\) => \{ hand\?\.\(place\); \}\);/);
    assert.match(hand, /useLayoutEffect\(\(\) => \(\) => hand\?\.\(null\), \[hand\]\);/);
    assert.match(readCode('app/[orgSlug]/admin/AdminChrome.tsx'), /<AdminBarPlaceProvider>\{frame\}<\/AdminBarPlaceProvider>/);
  });

  it('a frame given `place` hands it to the bar and draws nothing above the page', () => {
    const barFrame = frame.slice(frame.indexOf('function BarPlaceFrame'), frame.indexOf('function PaperPlaceFrame'));
    assert.match(barFrame, /useHandBarPlace\(place\);/);
    assert.doesNotMatch(barFrame, /HubTabBar|AdminPageHeader|\{header\}/);
    for (const f of ['RepTeamsFrame', 'SeasonFrame']) {
      const code = readCode(`components/admin/kit/club/${f}.tsx`);
      assert.match(code, /<PlaceFrame place=\{/, `${f} hands its parts to the bar`);
      assert.doesNotMatch(code, /AdminPageHeader/, `${f} draws a paper heading again (two titles, two <h1>s)`);
    }
  });

  it('the bar draws the way up, the switcher, the chip and the tab row, in that order', () => {
    const at = (s: string) => { const i = bar.indexOf(s); assert.ok(i >= 0, s); return i; };
    assert.ok(at('place?.back &&') < at('className={styles.identity}'), 'the way up leads the row');
    assert.ok(at('className={styles.switcher}') < at('${styles.meta}${clubOnly'), 'the switcher sits beside the name');
    assert.ok(at('{facts.map(') < at('place?.chip &&'), 'the chip ends the small line');
    assert.ok(at('<HubTabBar inBar') > at('className={styles.pill}'), 'the tab row is under the bar’s row');
    assert.match(css, /\.header\.withTabs \{ padding-bottom: 0; \}/);
    // The name is cut to ONE line beside its switcher; the switcher never is.
    assert.match(css, /\.header \.titleRow \.name \{[^}]*white-space: nowrap; text-overflow: ellipsis;/);
    assert.match(css, /\.switcher \{ flex: none;/);
  });

  // /review, 2026-11-07: the season is a place for whoever opens ANY of its pages (the treasurer reads Money through
  // Accounting), the row lists only the pages they open — and before the member is known there is no place at all — and a refusal drawn under a
  // place keeps the page's ONE <h1> (the bar's).
  it('who is in a season, which tabs they see, and a refusal under a place', () => {
    const nav = readCode('lib/admin-kit-nav.ts');
    const at = nav.slice(nav.indexOf('export function clubPlaceAt('));
    assert.match(at, /if \(!seasonAccess \|\| !\(seasonAccess\.read \|\| seasonAccess\.readMoney \|\| seasonAccess\.email\)\) return null;/);
    assert.match(at, /tabs: seasonTabs\(seasonPath, seasonAccess\),/);
    assert.equal((at.match(/EVERY_SEASON_PAGE/g) ?? []).length, 1, 'every page is asked only to light the tab, never listed');
    assert.match(readCode('components/admin/kit/club/NotYoursScreen.tsx'), /const Heading = inPlace \? 'h2' : 'h1';/);
    assert.match(readCode('components/admin/kit/club/NotYours.tsx'), /const inPlace = useInPlaceFrame\(\);/);
  });

  // /design, 2026-11-07: on a phone the document itself scrolled — 72px from the generic bottom-bar reserve on the outer
  // <main>, 721px on a season's Overview from visually-hidden labels placed against the window — so a swipe past a
  // page's end took the "pinned" bar off the screen. The locked shell stands the reserve down and anchors its children.
  it('a phone’s admin shell is the screen exactly: the document never scrolls the bar away', () => {
    assert.match(readCode('app/[orgSlug]/admin/AdminChrome.tsx'), /\{\.\.\.\(!isFocused \? \{ 'data-admin-locked': '' \} : \{\}\)\}/);
    assert.match(readCode('app/globals.css'), /#main-content:has\(\[data-admin-locked\]\) \{ padding-bottom: 0; \}/);
    const shell = readCode('app/[orgSlug]/admin/admin.module.css');
    assert.match(shell, /height: calc\(100dvh - var\(--sandbox-chrome-h, 0px\)\);\s*overflow: hidden;\s*position: relative;/);
  });

  it('the in-bar tab row is opt-in: the coaches portal’s rows are untouched', () => {
    assert.match(tabBar, /inBar\?: boolean;/);
    assert.match(tabBar, /\$\{inBar \? ` \$\{styles\.inBar\}` : ''\}/);
    // Every in-bar rule is scoped under `.inBar`, so none of them reaches a row that does not set it.
    // From the first in-bar rule to the @media that opens the phone tab padding (the next block; comments are stripped).
    const from = tabCss.indexOf('.inBar {');
    const to = tabCss.lastIndexOf('@media', tabCss.indexOf('.tab { padding: 0.5rem 0.6rem; }'));
    assert.ok(from > 0 && to > from, 'the in-bar block is found');
    const inBarRules = tabCss.slice(from, to);
    // Every selector in the block, indented ones inside its @media included.
    const selectors = (inBarRules.match(/^\s*[^\s@/}][^{;]*\{/gm) ?? []).map(s => s.trim());
    assert.ok(selectors.length >= 5, 'the in-bar rules are read');
    for (const sel of selectors) assert.match(sel, /^\.inBar\b/, sel);
    assert.match(inBarRules, /\.inBar \.bar \{ border-bottom: 0; \}/);
    assert.match(inBarRules, /var\(--card-bg\) 55%, transparent\)/, 'the arrows paint the bar’s white, not the paper');
    for (const f of ['app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx']) {
      assert.doesNotMatch(readCode(f), /<HubTabBar[^>]*\binBar\b/, `${f} opted in`);
    }
  });
});
