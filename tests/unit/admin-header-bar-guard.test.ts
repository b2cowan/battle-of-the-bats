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
/** The ONE place model both headers draw (round 4, 2026-11-08). */
const model = readCode('components/admin/useAdminPlace.tsx');
const strip = readCode('components/admin/AdminTopStrip.tsx');
const stripCss = readCode('components/admin/AdminTopStrip.module.css');

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

describe('the small line sits under the name (the phone’s; round 4 took it off the desktop)', () => {
  it('the name comes first, then the line of facts: section · dates · chip', () => {
    const identity = bar.slice(bar.indexOf('className={styles.identity}'));
    const metaAt = identity.indexOf('className={styles.meta}');
    assert.ok(metaAt > 0 && identity.indexOf('{nameEl}') < metaAt, 'name above the line');
    const meta = identity.slice(metaAt);
    assert.ok(meta.indexOf('{facts.map(') < meta.indexOf('{dates}'), 'section before dates');
    assert.ok(meta.indexOf('{dates}') < meta.indexOf('{phaseChip}'), 'dates before the chip');
    assert.doesNotMatch(bar, /eyebrow/i, 'no eyebrow above the name');
  });

  // ⚖ Round 4 (D1, D3, owner 2026-11-08): the desktop has no small line, so the words only a desk showed (the club, a
  // team's group) left with it. The phone never showed them. If a desk-only word comes back, it has no line to sit on.
  it('no desk-only words: the club and a team’s group are gone from the line', () => {
    assert.doesNotMatch(bar, /metaDesk|deskFacts|\{club &&/);
    assert.doesNotMatch(css, /\.metaDesk/);
    assert.doesNotMatch(readCode('components/admin/AdminBarPlace.tsx'), /deskFacts/);
    assert.doesNotMatch(readCode('components/admin/kit/club/TeamFrame.tsx'), /deskFacts|groupName: team/);
  });

  it('the line is the portal meta voice: data face, label step, normal weight, no tracking, no capitals', () => {
    const meta = block(css, '.meta');
    for (const decl of [/font-family: var\(--font-data\)/, /font-size: var\(--type-label\)/, /font-weight: 400/,
      /letter-spacing: normal/, /text-transform: none/, /color: var\(--text-tertiary\)/]) assert.match(meta, decl);
  });

  it('the dot is drawn between words, never before the chip', () => {
    assert.match(css, /\.meta > span:not\(\.chip\) \+ span:not\(\.chip\)::before \{\s*content: '·';/);
  });

  it('the tournament name still opens its dashboard, in both headers', () => {
    assert.match(model, /titleHref = `\/\$\{currentOrg\?\.slug \?\? ''\}\/admin\/tournaments\/dashboard`/);
    assert.match(bar, /<Link href=\{titleHref\} className=\{styles\.nameLink\}/);
    assert.match(strip, /<Link href=\{titleHref\} className=\{own\.nameLink\}/);
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
    // The bar and every frame ask ONE hook, which builds every gate once (session B: the access object). Since round 4 the
    // headers read it through the one place model (`useAdminPlace`), so the phone bar and the desktop strip cannot differ.
    assert.match(model, /const addressPlace = useClubPlaceAt\(\);/);
    assert.match(model, /const routePlace = !suspended && !onTournament \? addressPlace : null;/);
    for (const [name, code] of [['bar', bar], ['strip', strip], ['model', model]] as const) {
      assert.doesNotMatch(code, /clubPlaceAt\(pathname/, `the ${name} must not build its own gates (it would drift from the frames)`);
    }
    assert.match(bar, /= useAdminPlace\(suspended\);/);
    assert.match(strip, /= useAdminPlace\(false\);/);
    assert.match(hand, /return clubPlaceAt\(pathname, `\/\$\{currentOrg\.slug\}\/admin`, \{\s*canUse: canOpen,\s*seasonAccess,/);
    assert.match(model, /handed\?\.key === routePlace\.key \? \{ \.\.\.handed, activeId: routePlace\.activeId \} : routePlace/);
    // A layout effect, so a client navigation redraws the bar before the browser paints.
    // Phase 3: a record page hands nothing while it loads (null), so the bar keeps the address's placeholder meanwhile.
    assert.match(hand, /useLayoutEffect\(\(\) => \{ if \(!place\) return; mine\.current = place\.key; hand\?\.\(place\); \}\);/);
    // Withdrawn on unmount only if the bar still holds THIS frame's place (/review, session B): a frame leaving in a later
    // commit than its successor mounted must never wipe the successor's.
    assert.match(hand, /useLayoutEffect\(\(\) => \(\) => hand\?\.\(held => \(held\?\.key === mine\.current \? null : held\)\), \[hand\]\);/);
    assert.match(readCode('app/[orgSlug]/admin/AdminChrome.tsx'), /<AdminBarPlaceProvider>\{frame\}<\/AdminBarPlaceProvider>/);
  });

  // Session B: every place or none (the 2026-08-19 reversal) — the paper mode is GONE, and every place hands off.
  it('every place hands its parts to the bar and draws nothing above the page; the paper mode is gone', () => {
    const frameFn = frame.slice(frame.indexOf('export default function PlaceFrame'), frame.indexOf('export function TabActions'));
    assert.match(frameFn, /useHandBarPlace\(place\);/);
    assert.doesNotMatch(frame, /HubTabBar|PaperPlaceFrame|header: ReactNode|\{header\}/, 'no paper tab row or heading mode');
    for (const f of ['RepTeamsFrame', 'SeasonFrame', 'TeamFrame', 'money/AccountingFrame', 'families/FamiliesFrame', 'OrgFrame', 'PermitsFrame']) {
      const code = readCode(`components/admin/kit/club/${f}.tsx`);
      assert.match(code, /<PlaceFrame place=\{/, `${f} hands its parts to the bar`);
      assert.match(code, /useClubPlaceAt\(\)/, `${f} asks the bar's own question`);
      assert.doesNotMatch(code, /AdminPageHeader|<HubTabBar/, `${f} draws a paper heading or tab row again (two titles, two <h1>s)`);
    }
  });

  it('the bar draws the way up, the switcher, the chip and the tab row, in that order', () => {
    const at = (s: string) => { const i = bar.indexOf(s); assert.ok(i >= 0, s); return i; };
    assert.ok(at('place?.back &&') < at('className={styles.identity}'), 'the way up leads the row');
    assert.ok(at('className={styles.switcher}') < at('className={styles.meta}'), 'the switcher sits beside the name');
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

/**
 * ROUND 4 (owner 2026-11-08, D1–D5): above 900px the place names itself in the top strip, the bar is the tab band alone,
 * and the club heads the sidebar in a cell exactly the band's height. The phone keeps today's bar exactly.
 */
describe('desktop: the place in the strip, the bar is the tab band, the club cell meets it in one line', () => {
  const coachStripCss = readCode('components/coaches/CoachTopStrip.module.css');
  const shell = readCode('app/[orgSlug]/admin/admin.module.css');
  const frameCss = readCode('components/admin/kit/AdminKitFrame.module.css');

  it('which header names the place is CSS at 900/901px, never a width read in script (no first-paint swap)', () => {
    for (const code of [bar, strip, model]) assert.doesNotMatch(code, /matchMedia|innerWidth|useMediaQuery/);
    // Desktop: the bar's name row leaves (with its <h1>); a place without tabs draws no bar at all.
    assert.match(css, /@media \(min-width: 901px\) \{\s*\.header\.deskBand \{ height: var\(--admin-band-h\); padding-block: 0; \}\s*\.header\.deskBand \.row \{ display: none; \}/);
    assert.match(css, /\.header\.deskNone \{ display: none; \}/);
    assert.match(bar, /const deskClass = suspended \? '' : tabbed \? ` \$\{styles\.deskBand\}` : ` \$\{styles\.deskNone\}`;/);
    // Phone: the strip's place leaves (the strip itself is zeroed there, but a cancelled page keeps it on a phone).
    assert.match(stripCss, /@media \(max-width: 900px\) \{\s*\.place \{ display: none; \}/);
  });

  it('one <h1> per width: the strip’s name on desktop, the bar’s on a phone, a link inside a tournament', () => {
    assert.match(model, /isPageTitle: onOverview \|\| !!place,/);
    assert.match(bar, /const name = isPageTitle\s*\? <h1 className=\{styles\.name\}>\{title\}<\/h1>\s*: <span className=\{styles\.name\}>\{title\}<\/span>;/);
    assert.match(strip, /const name = isPageTitle \? <h1 className=\{own\.name\}>\{text\}<\/h1> : <span className=\{own\.name\}>\{text\}<\/span>;/);
    // D2: Overview's strip says "Overview" (the phone's Overview bar still names the club, A3).
    assert.match(strip, /const text = onOverview \? 'Overview' : title;/);
  });

  it('the strip splits on the sidebar’s edge, opt-in, and the portal’s strip is untouched', () => {
    assert.match(strip, /split \? ` \$\{styles\.stripSplit\}` : ''/);
    assert.match(stripCss, /\.lcell \{[^}]*width: var\(--admin-rail-w\);/);
    assert.match(stripCss, /\.rcell \{[^}]*padding: 0 1rem 0 2rem;/, 'the name starts where the bar’s name sat (call G)');
    assert.doesNotMatch(stripCss, /\b240px\b|\b64px\b/, 'the cell follows the sidebar’s one width variable');
    // The shared sheet gains one opt-in class, after `.strip` so it wins at equal weight; the portal never sets it.
    assert.ok(coachStripCss.indexOf('.stripSplit {') > coachStripCss.indexOf('.strip {'));
    assert.doesNotMatch(readCode('components/coaches/CoachTopStrip.tsx'), /stripSplit/);
  });

  it('View site sits in the strip by the bell, never on a cancelled account’s page', () => {
    assert.match(strip, /\{flip && !suspended && <FlipPill resolution=\{flip\} variant="inline" className=\{own\.pill\} \/>\}/);
    assert.ok(strip.indexOf('<FlipPill') < strip.indexOf('<NotificationBell'), 'View site before the bell');
  });

  it('the club cell and the tab band read ONE height variable, declared once', () => {
    assert.equal((shell.match(/--admin-band-h:/g) ?? []).length, 1, 'one declaration');
    assert.match(block(frameCss, '.clubCell'), /height: var\(--admin-band-h\);/);
    assert.match(css, /\.header\.deskBand \{ height: var\(--admin-band-h\);/);
    // Never a number that happens to match: neither sheet restates the band's height.
    assert.doesNotMatch(block(frameCss, '.clubCell'), /(^|[\s;{])(min-|max-)?height: \d/);
    // D5: the cell is a link to Overview; collapsed it is the club's initials.
    const rail = readCode('components/admin/kit/AdminKitRail.tsx');
    // (Part B moved the Link into `ClubCell`; the collapsed initials come from the one `SidebarLogoTile`.)
    assert.match(rail, /<Link href=\{href\} className=\{styles\.clubCell\}>/);
    assert.match(rail, /<ClubCell href=\{base\} /);
    assert.match(rail, /<SidebarLogoTile source=\{logoUrl\} aspect=\{logoAspect\} name=\{name\} \/>/);
  });
});

// ⚖ Phase 3 (round 5, owner 2026-11-08, Q1–Q6): THE SCREENS WITH NO PLACE OF THEIR OWN name themselves in the header, so the
// header's name is their one `<h1>` and the paper title goes. `TabPageHeader` keeps the paper heading exactly where the header
// names no place (a refusal, Q5; the tournament side's copy of a page, Q6), because it asks the header's own question.
describe('Phase 3 · one title per screen: a screen the header names has no paper title; one it does not keeps exactly one', () => {
  const A = 'app/[orgSlug]/admin';
  const named = [
    `${A}/calendar/page.tsx`, `${A}/schedules/page.tsx`, `${A}/schedules/[scheduleId]/page.tsx`,
    'components/notifications/NotificationsPageContent.tsx', `${A}/house-league/page.tsx`, `${A}/public-site/page.tsx`,
    'components/admin/kit/club/BillingKit.tsx', `${A}/rep-teams/rename-slugs/page.tsx`, `${A}/rep-teams/teams/[teamId]/history/page.tsx`,
    `${A}/rep-teams/teams/[teamId]/history/[yearId]/page.tsx`, `${A}/house-league/seasons/[seasonId]/club-schedule/[scheduleId]/page.tsx`,
    'components/admin/kit/club/families/ChildPage.tsx',
  ];
  it('every Phase 3 screen draws its title through TabPageHeader, never AdminPageHeader', () => {
    for (const f of named) {
      const code = readCode(f);
      assert.doesNotMatch(code, /<AdminPageHeader\b|import AdminPageHeader/, `${f} draws a paper title the header already says`);
      assert.match(code, /<TabPageHeader\b/, `${f} keeps its title for the screens the header does not name`);
    }
    const frame = readCode('components/admin/kit/club/PlaceFrame.tsx');
    assert.match(frame, /const named = useNamedInBar\(\);\s*if \(!inPlace && !named\) return <AdminPageHeader \{\.\.\.props\} \/>;/);
    // The page and the header ask ONE question: is this address a place (gates included)?
    assert.match(readCode('components/admin/AdminBarPlace.tsx'), /export function useNamedInBar\(\): boolean \{\s*return useClubPlaceAt\(\) !== null;/);
  });
  it('a cancelled account names no place: its one page (Plan & billing) keeps its paper title, the only <h1> it has (/review 2026-11-09)', () => {
    // The bar is `suspended` (names the organization as a span) and the strip draws no place, so a page that dropped its
    // paper title because the ADDRESS names it would be left with no heading at all.
    assert.match(readCode('components/admin/AdminBarPlace.tsx'), /if \(!currentOrg \|\| currentOrg\.subscriptionStatus === 'canceled'\) return null;\s*return clubPlaceAt\(/);
  });
  it('a screen the header does NOT name keeps exactly one paper title (Club setup, Q1; the org-wide tournament screens, Q6)', () => {
    // ⚖ Navigation Phase 2 Part B (2026-11-10): the Tournaments list keeps its one paper title (the strip names it on a computer
    // only, `DeskNamedPage`); the Settings & access card page retired — its address is the door to its first tab (E3).
    for (const f of ['components/admin/kit/club/ClubSetupKit.tsx', `${A}/org/tournaments/page.tsx`]) {
      assert.equal((readCode(f).match(/<AdminPageHeader\b/g) ?? []).length, 1, f);
    }
    assert.doesNotMatch(readCode(`${A}/tournaments/settings/page.tsx`), /<AdminPageHeader\b/);
  });
  it('a record names itself through the hand-off, for the address’s key only; its own fact sits beside the name (Q4)', () => {
    const hand = readCode('components/admin/AdminBarPlace.tsx');
    assert.match(hand, /export function useHandNamedPlace\(parts: NamedPlaceParts \| null\) \{\s*const at = useClubPlaceAt\(\);\s*useHandBarPlace\(at && parts \? \{ \.\.\.at, \.\.\.parts \} : null\);/);
    // Both renderings draw the record's fact: the strip as quiet words (the tournament's dates' class), the phone on its line.
    assert.match(strip, /\{place\?\.detail && <span className=\{own\.dates\}>\{place\.detail\}<\/span>\}/);
    assert.match(bar, /\{place\?\.detail && <span>\{place\.detail\}<\/span>\}/);
  });
  it('A7: the Calendar’s phone View menu is the toolbar’s first slot, before the desktop switch', () => {
    const cal = readCode(`${A}/calendar/page.tsx`);
    const bar = cal.slice(cal.indexOf('<CoachListToolbar'), cal.indexOf('</CoachListToolbar>'));
    // The first child after the toolbar's props (`readCode` drops comments, which may leave an empty `{}`).
    assert.match(bar, /\)\}\s*>\s*(?:\{\s*\}\s*)?\{viewMenu\}\s*<span className=\{cal\.viewDesk\}>/);
    assert.match(cal, /const viewMenu = \(\s*<span className=\{cal\.viewPhone\}>/);
  });
});
