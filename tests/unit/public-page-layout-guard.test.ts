import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, cssRule, filesUnder, openingTags, parseProps, readCode, readSource, reachableFrom, sourceExists } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC PAGE LAYOUT STANDARD — PART 1: ONE PAGE, ONE COLUMN (owner ruling 2026-11-04, A1–A14).
 * Standard: docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md (R1–R11 + the registered exceptions).
 * Plan: docs/projects/active/PUBLIC_PAGE_LAYOUT_STANDARD_PLAN.md; build prompt …_BUILD_PROMPT.md Part 1.
 *
 * Why this exists: each Stage (2–6) built its page on its own, so each picked its own edges — the Schedule started
 * 16 px down, Standings 24, a game's page 0; the Overview filled the window while Standings stopped at 720 and Teams at
 * 860. A visitor clicking from page to page watched the content jump. Now every public tournament page renders its
 * body in ONE wrapper (components/public/PublicPage.tsx → PublicParts.module.css `.page`), and this guard keeps it so:
 *
 *   · every route under app/[orgSlug]/[tournamentSlug] is a page on the wrapper, or a registered exception;
 *   · every branch each page returns (loading, unavailable, not found, the page itself) is the wrapper;
 *   · no page's stylesheet sets its own page padding, a page-level width cap, or its own two-column grid;
 *   · the wrapper's numbers are the drawing's: 960 px, 28 / 32 at a desk, 16 on a phone, 24 between sections;
 *     the two-column pages stand side by side only from a 1,200 px window.
 *
 * A NEW page joins PAGES (and renders <PublicPage>); a page that truly cannot is a registered EXCEPTION with its
 * reason, and goes into the standard's Exceptions section too. Never widen the allow-lists to make a build pass.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTES = 'app/[orgSlug]/[tournamentSlug]';

/** Each public tournament page: its route, the component that draws its body, and how many root branches that
 *  component returns. The count is pinned on purpose — a branch added or removed is a decision this guard should see. */
const PAGES: { route: string; component: string; branches: number }[] = [
  { route: `${ROUTES}/page.tsx`, component: 'components/public/TournamentOverview.tsx', branches: 1 },
  { route: `${ROUTES}/schedule/page.tsx`, component: 'components/public/PublicSchedule.tsx', branches: 4 },
  { route: `${ROUTES}/standings/page.tsx`, component: 'components/public/PublicStandings.tsx', branches: 3 },
  { route: `${ROUTES}/playoffs/page.tsx`, component: 'components/public/PublicPlayoffs.tsx', branches: 2 },
  { route: `${ROUTES}/teams/page.tsx`, component: 'components/public/PublicTeams.tsx', branches: 1 },
  { route: `${ROUTES}/rules/page.tsx`, component: 'components/public/PublicRules.tsx', branches: 2 },
  { route: `${ROUTES}/champions/page.tsx`, component: 'components/public/PublicChampionsPage.tsx', branches: 3 },
  { route: `${ROUTES}/schedule/[gameId]/page.tsx`, component: 'components/public/PublicGameDetails.tsx', branches: 2 },
  { route: `${ROUTES}/teams/[id]/page.tsx`, component: 'components/public/PublicTeamPage.tsx', branches: 3 },
  { route: `${ROUTES}/news/page.tsx`, component: 'components/public/NewsContent.tsx', branches: 2 },
  { route: `${ROUTES}/register/page.tsx`, component: 'components/public/RegisterContent.tsx', branches: 2 },
];

/** Routes that are not a page on the wrapper, each with its reason. */
const ROUTE_EXCEPTIONS: Record<string, string> = {
  [`${ROUTES}/results/page.tsx`]: 'a redirect to Standings — it draws nothing',
  [`${ROUTES}/pay/[token]/page.tsx`]: 'the focused team pay page (Stage 7 Ask 6, lib/public-focused-page.ts): no rail, its own 640 px column centred under the slim band',
};

/** The Overview's body is TournamentOverview, reached through TournamentHomeContent. */
const ROUTE_VIA: Record<string, string> = {
  [`${ROUTES}/page.tsx`]: 'components/public/TournamentHomeContent.tsx',
};

/** The stylesheets the pages draw with that are the tournament pages' own (the club kit's sheets are the club round's). */
const PAGE_SHEETS = [...reachableFrom(...PAGES.map(p => p.component))]
  .filter(f => f.endsWith('.css'))
  .filter(f => /^components\/(public|bracket)\/Public[^/]*\.module\.css$/.test(f) || /^app\/\[orgSlug\]\/(news|register)\//.test(f))
  .sort();

/** A fixed `max-width` of 600 px or more is a page-level cap unless it is one of these, each with its reason. */
const WIDE_CAP_EXCEPTIONS: Record<string, string> = {
  'app/[orgSlug]/register/register.module.css .formWrap 640': 'the tournament Register form\'s own reading column, 640 like every club form (club round C2, 2026-11-05); `.leftEdge` puts it on the page\'s left edge',
  'components/public/PublicTournamentState.module.css .state 620': 'the old state card OUTSIDE the frame only; under the frame it fills the column (Part 3)',
  'components/public/PublicParts.module.css .prose 720': 'R1: prose inside a box holds to 720 px — a paragraph\'s measure, not a page width (club round C2)',
};

/** Every fixed px `max-width` in a sheet, as "<sheet> <selector> <px>" (comments stripped, media blocks entered). */
function fixedCaps(sheet: string): { key: string; px: number }[] {
  const css = readSource(sheet).replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { key: string; px: number }[] = [];
  for (const m of css.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    for (const cap of m[2].matchAll(/max-width:\s*(\d+)px/g)) out.push({ key: `${sheet} ${selector} ${cap[1]}`, px: Number(cap[1]) });
  }
  return out;
}

describe('Public page layout standard Part 1 — every public tournament page is one page on one column', () => {
  it('the wrapper is one component on one class, and its numbers are the drawing\'s', () => {
    const page = readCode('components/public/PublicPage.tsx');
    assert.match(page, /import parts from '\.\/PublicParts\.module\.css'/);
    assert.match(page, /const classes = \[parts\.page, frame === 'club' && parts\.club, width === 'form' && parts\.form, className\]\.filter\(Boolean\)\.join\(' '\);/);
    assert.match(page, /className=\{classes\}/);
    assert.match(page, /data-public-page=""/, 'the marker the layout check and the walk read');

    const css = readSource('components/public/PublicParts.module.css');
    const rule = cssRule(css, '.page');
    assert.match(rule, /gap: 24px;/, 'R3: 24 between sections, the phone too');
    assert.match(rule, /max-width: calc\(960px \+ 2 \* 16px\);/, 'R1: the content is 960 at most, the sides counted in');
    assert.match(rule, /padding: 16px;/, 'a phone: 16 all round');
    assert.doesNotMatch(rule, /margin/, 'R1: left-aligned to the frame\'s edge, never centred');
    assert.match(css, /@media \(min-width: 1024px\) \{\s*\.page \{ max-width: calc\(960px \+ 2 \* 32px\); padding: 28px 32px; \}/,
      'R1/R2: at a desk 32 from the menu, 28 under the band or the today\'s-games line');
    assert.match(css, /\.page > \.leftEdge \{ margin-inline: 0; \}/);
    assert.match(cssRule(css, '.tools'), /gap: 12px;/, 'R3: 12 between toolbar rows');
  });

  it('every route is a page on the wrapper, or a registered exception', () => {
    const routes = filesUnder(ROUTES, 'page.tsx').filter(f => f.endsWith('/page.tsx')).sort();
    const known = new Set([...PAGES.map(p => p.route), ...Object.keys(ROUTE_EXCEPTIONS)]);
    const unknown = routes.filter(r => !known.has(r));
    assert.deepEqual(unknown, [], 'a new public tournament route: put its body in <PublicPage> and add it to PAGES, or register it as an exception with its reason');
    for (const r of Object.keys(ROUTE_EXCEPTIONS)) assert.ok(sourceExists(r), `stale exception: ${r} is gone`);
    for (const { route, component } of PAGES) {
      const entry = ROUTE_VIA[route] ?? route;
      assert.ok(reachableFrom(route).has(component) || reachableFrom(entry).has(component), `${route} draws its body with ${component}`);
    }
  });

  it('every branch a page returns is the wrapper (loading, unavailable and not found too)', () => {
    for (const { component, branches } of PAGES) {
      const code = readCode(component);
      assert.match(code, /import PublicPage from '(\.\/|@\/components\/public\/)PublicPage'/, `${component} imports the wrapper`);
      const tags = openingTags(code, 'PublicPage', component);
      assert.equal(tags.length, branches, `${component}: ${tags.length} <PublicPage> roots, the guard expects ${branches} — a branch added or removed? Each one renders in the wrapper; update the count with it`);
      // The old roots and the old centred column are gone, so nothing re-creates a page frame beside the wrapper.
      assert.doesNotMatch(code, /<(div|main|section) className=\{styles\.(page|overview|schedule|standings|playoffs|teams|rules|content)\}/,
        `${component} still draws an old page root`);
      assert.doesNotMatch(code, /className="(page-content|container|section|public-page-header)"/, `${component} still sits in the old centred column`);
    }
  });

  it('a class a page hands the wrapper only scopes its own rules — never the page\'s edges, width or rhythm', () => {
    for (const { component } of PAGES) {
      const code = readCode(component);
      const sheetImport = /import styles from '([^']+\.module\.css)'/.exec(code);
      for (const tag of openingTags(code, 'PublicPage', component)) {
        const cls = parseProps(tag).get('className');
        if (!cls) continue;
        const name = /^\{?styles\.(\w+)\}?$/.exec(cls)?.[1];
        assert.ok(name && sheetImport, `${component}: the wrapper takes the page's own module class, plain (${cls})`);
        const sheet = sheetImport[1].replace(/^@\//, '').replace(/^\.\//, 'components/public/');
        const css = readSource(sheet);
        if (!new RegExp(`(^|\\n)[ \\t]*\\.${name}\\s*\\{`).test(css)) continue; // only descendant rules: nothing to check
        assert.doesNotMatch(cssRule(css, `.${name}`), /padding|max-width|gap|display/, `${sheet} .${name} re-sets the page frame`);
      }
    }
  });

  it('no page sheet sets its own page padding, a page-level width cap, or its own two-column grid', () => {
    assert.ok(PAGE_SHEETS.includes('components/public/PublicParts.module.css') && PAGE_SHEETS.length >= 10, 'the scan reaches the page sheets');
    const caps = PAGE_SHEETS.flatMap(fixedCaps).filter(c => c.px >= 600).map(c => c.key);
    assert.deepEqual(caps.filter(k => !WIDE_CAP_EXCEPTIONS[k]), [],
      'a page-level width cap: the 960 column is the page\'s width (R1); register a real exception with its reason');
    for (const k of Object.keys(WIDE_CAP_EXCEPTIONS)) assert.ok(caps.includes(k), `stale width exception: ${k}`);
    for (const sheet of PAGE_SHEETS) {
      const css = readSource(sheet).replace(/\/\*[\s\S]*?\*\//g, '');
      const deskPadding = [...css.matchAll(/padding: 28px 32px/g)].length;
      assert.equal(deskPadding, sheet === 'components/public/PublicParts.module.css' ? 1 : 0, `${sheet}: the desk page padding belongs to the wrapper only`);
      assert.doesNotMatch(css, /\.\w+ > \* \{[^}]*max-width/, `${sheet}: a cap on every child is a page width`);
      const twoCol = [...css.matchAll(/grid-template-columns: minmax\(0, 1\.\d+fr\) minmax\(0, 1fr\)/g)].length;
      // PublicParts holds the split twice: the tournament's from 1,200 px and the club's from 1,024 (club round C2) — one
      // sheet, one split, two frames. No page sheet holds its own.
      assert.equal(twoCol, sheet === 'components/public/PublicParts.module.css' ? 2 : 0, `${sheet}: the two-column pages share ONE rule (PublicParts .cols)`);
    }
  });

  it('the two-column pages share one rule, side by side only from a 1,200 px window', () => {
    const css = readSource('components/public/PublicParts.module.css');
    assert.match(css, /@media \(min-width: 1200px\) \{\s*\.cols \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1\.35fr\) minmax\(0, 1fr\);\s*gap: 28px;/);
    assert.match(readCode('components/public/TournamentOverview.tsx'), /<div className=\{styles\.cols\}>/);
    // A game's page places its two cards inside the shared rule (score card main, when-and-where side: A11).
    assert.match(readCode('components/public/PublicGameDetails.tsx'), /<div className=\{`\$\{parts\.cols\} \$\{styles\.cards\}`\}>/);
    assert.match(readCode('components/public/PublicTeamPage.tsx'), /<div className=\{parts\.cols\}>/);
    // Its two columns are the shared column parts (24 gap, min-width 0); the side one carries the record card's padding.
    assert.match(readCode('components/public/PublicTeamPage.tsx'), /<div className=\{parts\.colMain\}>/);
    assert.match(readCode('components/public/PublicTeamPage.tsx'), /parts\.colSide\} \$\{mainLeadsWithHeading \? styles\.sideBelowHeading/);
    // The record card's alignment pad only means something where the columns stand side by side.
    assert.match(readSource('components/public/PublicTeamPage.module.css'), /@media \(min-width: 1200px\) \{[^}]*\.sideBelowHeading \{/);
  });

  it('News and Register have no page title (R2): the menu names the page; a screen reader still gets its heading', () => {
    const news = readCode('components/public/NewsContent.tsx');
    assert.match(news, /<h1 className="sr-only">News & Announcements<\/h1>/);
    assert.doesNotMatch(news, /public-page-header|Stay up to date/);
    assert.match(readCode('components/public/RegisterContent.tsx'), /className=\{`\$\{styles\.formWrap\} \$\{parts\.leftEdge\}`\}/);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB ROUND — EVERY CLUB PUBLIC PAGE ON THE SAME COLUMN (C2 + C5, ruled 2026-11-05).
 * Plan §5b; build prompt docs/projects/active/PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md Part 1.
 *
 * Why this exists: the club's pages each picked their own column — the home and a team's page 1,152 wide, Teams 744,
 * the house league 760, Schedule and Standings 800, Your sign-up 560 — and About, a tryout page, the tryout form and
 * off-season Tryouts CENTRED, breaking the 2026-08-01 rule that content starts under the club's logo. A family clicking
 * from page to page (and into the club's tournament) watched the content jump. Now every club public page renders in
 * the same wrapper with `frame="club"`: 960 px at most on the logo edge, 28 down (16 on a phone), 24 between sections,
 * forms 640 (`width="form"`), the two-column pages split from 1,024 px.
 *
 * A NEW club public page joins CLUB_PAGES; a route that is not a page (a shortcut, a redirect, a tool) is a registered
 * exception with its reason. Never widen the allow-lists to make a build pass.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const CLUB = 'app/[orgSlug]';

/** Each club public page: its route, the component that draws its body, how many root branches it returns (pinned, as
 *  above), and whether it is a form. */
const CLUB_PAGES: { route: string; component: string; branches: number; form?: true }[] = [
  { route: `${CLUB}/page.tsx`, component: 'components/public/ClubSiteHome.tsx', branches: 1 },
  { route: `${CLUB}/teams/page.tsx`, component: `${CLUB}/teams/page.tsx`, branches: 1 },
  { route: `${CLUB}/teams/[teamSlug]/page.tsx`, component: `${CLUB}/teams/[teamSlug]/page.tsx`, branches: 1 },
  { route: `${CLUB}/tryouts/page.tsx`, component: `${CLUB}/tryouts/page.tsx`, branches: 2 },
  { route: `${CLUB}/teams/[teamSlug]/tryouts/page.tsx`, component: 'components/rep-teams/TryoutLandingView.tsx', branches: 1 },
  { route: `${CLUB}/teams/[teamSlug]/tryouts/[yearId]/page.tsx`, component: 'components/rep-teams/TryoutLandingView.tsx', branches: 1 },
  { route: `${CLUB}/teams/[teamSlug]/tryouts/register/page.tsx`, component: 'components/rep-teams/TryoutRegisterView.tsx', branches: 1, form: true },
  { route: `${CLUB}/teams/[teamSlug]/tryouts/[yearId]/register/page.tsx`, component: 'components/rep-teams/TryoutRegisterView.tsx', branches: 1, form: true },
  { route: `${CLUB}/league/page.tsx`, component: `${CLUB}/league/page.tsx`, branches: 1 },
  { route: `${CLUB}/league/[seasonSlug]/page.tsx`, component: `${CLUB}/league/[seasonSlug]/page.tsx`, branches: 2 },
  { route: `${CLUB}/league/[seasonSlug]/register/page.tsx`, component: `${CLUB}/league/[seasonSlug]/register/page.tsx`, branches: 1, form: true },
  { route: `${CLUB}/league/[seasonSlug]/status/page.tsx`, component: `${CLUB}/league/[seasonSlug]/status/page.tsx`, branches: 1, form: true },
  { route: `${CLUB}/league/[seasonSlug]/status/[token]/page.tsx`, component: `${CLUB}/league/[seasonSlug]/status/[token]/page.tsx`, branches: 1, form: true },
  { route: `${CLUB}/league/[seasonSlug]/schedule/page.tsx`, component: `${CLUB}/league/[seasonSlug]/schedule/page.tsx`, branches: 1 },
  { route: `${CLUB}/league/[seasonSlug]/standings/page.tsx`, component: `${CLUB}/league/[seasonSlug]/standings/page.tsx`, branches: 1 },
  { route: `${CLUB}/tournaments/page.tsx`, component: `${CLUB}/tournaments/page.tsx`, branches: 1 },
  { route: `${CLUB}/about/page.tsx`, component: `${CLUB}/about/page.tsx`, branches: 1 },
  { route: `${CLUB}/archives/[archiveId]/page.tsx`, component: `${CLUB}/archives/[archiveId]/page.tsx`, branches: 1 },
];

/** Routes under the club's address that are not a club public page, each with its reason. (The admin, the coaches
 *  portal and the tournament pages are other surfaces and are not walked.) */
const CLUB_ROUTE_EXCEPTIONS: Record<string, string> = {
  [`${CLUB}/archives/page.tsx`]: 'a redirect to Tournaments (#past) — it draws nothing',
  [`${CLUB}/news/page.tsx`]: 'a shortcut to the club\'s running tournament (lib/club-shortcut.ts) — it draws nothing of its own',
  [`${CLUB}/register/page.tsx`]: 'a shortcut to the club\'s running tournament',
  [`${CLUB}/results/page.tsx`]: 'a shortcut to the club\'s running tournament',
  [`${CLUB}/rules/page.tsx`]: 'a shortcut to the club\'s running tournament',
  [`${CLUB}/schedule/page.tsx`]: 'a shortcut to the club\'s running tournament',
  [`${CLUB}/standings/page.tsx`]: 'a shortcut to the club\'s running tournament',
  [`${CLUB}/official/page.tsx`]: 'a redirect to the scorekeeper',
  [`${CLUB}/official/score/page.tsx`]: 'a redirect to the scorekeeper',
  [`${CLUB}/scorekeeper/page.tsx`]: 'the scorekeeper\'s tool, not a page a family reads',
  [`${CLUB}/check-in/page.tsx`]: 'the gate volunteer\'s check-in tool, not a page a family reads',
  [`${CLUB}/league/[seasonSlug]/team/[teamId]/page.tsx`]: 'the coach\'s house-league team page: signed in, out of the club round (plan §5b scope); it keeps the old league column',
};

/** The club pages' own stylesheets: none may set a page's padding, width, centring or two-column grid. */
const CLUB_SHEETS = [
  'components/public/ClubSiteHome.module.css',
  'components/public/ClubSponsors.module.css',
  `${CLUB}/teams/ClubTeams.module.css`,
  `${CLUB}/teams/[teamSlug]/TeamPage.module.css`,
  'components/public/TryoutPage.module.css',
  `${CLUB}/league/league-column.module.css`,
  `${CLUB}/tournaments/ClubTournaments.module.css`,
  'components/public/ClubAbout.module.css',
];

describe('Public page layout standard, club round — every club public page is one page on one column', () => {
  it('the club frame\'s numbers are the drawing\'s: 960 on the logo edge, 28 / 16 down, 40 / 32 at the foot, forms 640', () => {
    const css = readSource('components/public/PublicParts.module.css');
    const phone = cssRule(css, '.page.club');
    assert.match(phone, /max-width: calc\(960px \+ 2 \* 16px\);/, 'a phone: 960 at most, 16 each side');
    assert.match(phone, /padding: 16px 16px 32px;/, 'a phone: 16 down, 16 each side, 32 at the foot');
    assert.doesNotMatch(phone, /margin/, 'never centred: the edge is the padding');
    assert.match(css, /\.page\.club\.form \{ max-width: calc\(640px \+ 2 \* 16px\); \}/, 'C2: a form is 640 on a phone');
    const desk = /@media \(min-width: 901px\) \{\s*\.page\.club \{([^}]*)\}\s*\.page\.club\.form \{([^}]*)\}/.exec(css);
    assert.ok(desk, 'the desk rule starts where the frame\'s tabs join the band (901 px)');
    assert.match(desk[1], /--club-edge: max\(24px, calc\(\(100% - 1200px\) \/ 2 \+ 24px\)\);/, 'the logo edge: the frame\'s centred 1,200 column, 24 in');
    assert.match(desk[1], /max-width: calc\(960px \+ 2 \* var\(--club-edge\)\);/);
    assert.match(desk[1], /padding: 28px var\(--club-edge\) 40px;/, 'a desk: 28 under the band, 40 at the foot');
    assert.match(desk[2], /max-width: calc\(640px \+ 2 \* var\(--club-edge\)\);/, 'C2: a form is 640 at a desk');
    // The band's own edge is the same expression, so the content stands under the logo at every width.
    assert.match(readSource('components/public/ClubFrame.module.css'), /max\(24px, calc\(\(100% - 1200px\) \/ 2 \+ 24px\)\)/);
    assert.match(css, /@media \(min-width: 1024px\) \{\s*\.club \.cols \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1\.35fr\) minmax\(0, 1fr\);\s*gap: 24px 28px;/,
      'C2: the club\'s two-column pages split the tournament\'s way, from 1,024 px, 24 between rows');
    assert.match(css, /\.prose \{ max-width: 720px; \}/, 'R1: prose holds to 720');
  });

  it('every club route is a page on the wrapper, or a registered exception', () => {
    const skip = [`${CLUB}/admin/`, `${CLUB}/coaches/`, `${CLUB}/[tournamentSlug]/`];
    const routes = filesUnder(CLUB, 'page.tsx').filter(f => f.endsWith('/page.tsx') && !skip.some(s => f.startsWith(s))).sort();
    const known = new Set([...CLUB_PAGES.map(p => p.route), ...Object.keys(CLUB_ROUTE_EXCEPTIONS)]);
    assert.deepEqual(routes.filter(r => !known.has(r)), [],
      'a new club route: render its body in <PublicPage frame="club"> and add it to CLUB_PAGES, or register it as an exception with its reason');
    for (const r of Object.keys(CLUB_ROUTE_EXCEPTIONS)) assert.ok(sourceExists(r), `stale exception: ${r} is gone`);
    for (const { route, component } of CLUB_PAGES) assert.ok(reachableFrom(route).has(component), `${route} draws its body with ${component}`);
  });

  it('every branch a club page returns is the club wrapper; a form is 640; the old columns are gone', () => {
    for (const { component, branches, form } of CLUB_PAGES) {
      const code = readCode(component);
      assert.match(code, /import PublicPage from '@\/components\/public\/PublicPage'|import PublicPage from '\.\/PublicPage'/, `${component} imports the wrapper`);
      const tags = openingTags(code, 'PublicPage', component);
      assert.equal(tags.length, branches, `${component}: ${tags.length} <PublicPage> roots, the guard expects ${branches} — a branch added or removed? Each one renders in the wrapper; update the count with it`);
      for (const tag of tags) {
        const props = parseProps(tag);
        assert.equal(props.get('frame'), 'club', `${component}: a club page renders in the club frame's column (frame="club")`);
        assert.equal(props.get('width') ?? null, form ? 'form' : null, `${component}: ${form ? 'a form is 640 (width="form")' : 'a page is the 960 column (no width)'}`);
        assert.ok(!props.has('className') && !props.has('style'), `${component}: the club wrapper takes no class or style of the page's own — the column is the wrapper's`);
      }
      assert.doesNotMatch(code, /className="container"|column\.column|styles\.(column|wide|pagePreview)\b|className=\{styles\.page\}/, `${component} still draws an old page column`);
      assert.doesNotMatch(code, /maxWidth: '(560|600|640|760|800|1000)px'|margin: '0 auto'|--league-measure/, `${component} still sets its own width inline`);
    }
  });

  it('no club page sheet sets its own page padding, width, centring or two-column grid', () => {
    for (const sheet of CLUB_SHEETS) {
      const css = readSource(sheet).replace(/\/\*[\s\S]*?\*\//g, '');
      assert.doesNotMatch(css, /margin: 0 auto/, `${sheet}: a centred page column (the 08-01 rule: content starts under the logo)`);
      assert.doesNotMatch(css, /max-width: (1200px|calc\(\d+px \+ 48px\))/, `${sheet}: a page-level width (the 960 column is the wrapper's)`);
      assert.doesNotMatch(css, /margin-left: max\(0px/, `${sheet}: a hand-made logo edge (the wrapper's)`);
      assert.doesNotMatch(css, /padding: (16px 16px 32px|28px 24px 40px|20px 24px 40px)/, `${sheet}: page padding (the wrapper's)`);
      assert.doesNotMatch(css, /grid-template-columns: minmax\(0, 1(\.\d+)?fr\) (380px|minmax\(0, 1fr\))/, `${sheet}: its own two-column split (PublicParts .cols)`);
      const caps = fixedCaps(sheet).filter(c => c.px >= 600);
      assert.deepEqual(caps.map(c => c.key), [], `${sheet}: a page-level width cap`);
      const childCaps = [...css.matchAll(/(\.\w+) > \* \{[^}]*max-width/g)].map(m => m[1]);
      assert.deepEqual(childCaps, sheet.endsWith('league-column.module.css') ? ['.column'] : [],
        `${sheet}: a cap on every child is a page width (only the coach's team page keeps league-column's .column)`);
    }
  });

  it('the home keeps its banner above the column and its sponsors last inside it; a team with no games is one column', () => {
    const home = readCode('components/public/ClubSiteHome.tsx');
    const column = between(home, '<PublicPage frame="club">', '</PublicPage>');
    assert.ok(home.indexOf('styles.bannerStrip') < home.indexOf('<PublicPage frame="club">'), 'the banner strip stays above the column, full-bleed (10-20)');
    assert.match(column, /<ClubSponsorStrip sponsors=\{p\.sponsors\} \/>\s*$/, 'the sponsors stay last on the home, inside the column\'s width (10-23)');
    assert.match(column, /className=\{`\$\{parts\.cols\} \$\{styles\.withAbout\}`\}/, 'the home splits on the shared rule');
    const team = readCode(`${CLUB}/teams/[teamSlug]/page.tsx`);
    assert.match(team, /schedule: teamScheduleShows\(publicSchedule\)/, 'the schedule part is decided from what renders, never from the view existing');
    assert.match(team, /teamParts\.includes\('schedule'\) \? <div className=\{`\$\{parts\.cols\} \$\{styles\.withSchedule\}`\}>\{body\}<\/div> : body/);
    assert.match(readCode('components/public/RepTeamPublicSchedule.tsx'), /if \(!teamScheduleShows\(view\)\) return null;/, 'the section asks the same question');
  });
});

/**
 * THE CLUB ROUND, PART 2 — TITLES, HEADINGS, LISTS, ROWS (C3, C4, R4, R5, R7; build prompt Part 2).
 * A page whose lit tab names it has no visible title (a screen reader still gets its h1); a page about one thing keeps its
 * name at 24 px (`kit.pageName`); every club section heading is the tournament's heading row; the house-league seasons and
 * Your sign-up's children are one framed list each; About's documents are link rows with the new-tab symbol.
 */
describe('Public page layout standard, club round Part 2 — one title rule, one heading row', () => {
  const TAB_PAGES = [`${CLUB}/teams/page.tsx`, `${CLUB}/league/page.tsx`, `${CLUB}/tournaments/page.tsx`];
  const NAMED_PAGES = [
    `${CLUB}/teams/[teamSlug]/page.tsx`, 'components/rep-teams/TryoutLandingView.tsx', 'components/rep-teams/TryoutRegisterView.tsx',
    `${CLUB}/league/[seasonSlug]/page.tsx`, `${CLUB}/league/[seasonSlug]/register/page.tsx`, `${CLUB}/league/[seasonSlug]/status/page.tsx`,
    `${CLUB}/league/[seasonSlug]/status/[token]/page.tsx`, `${CLUB}/about/page.tsx`,
  ];
  it('C3: a tab page has no visible title — its h1 is for a screen reader; Tryouts keeps 24 out of season only', () => {
    for (const f of [...TAB_PAGES, `${CLUB}/tryouts/page.tsx`]) {
      const code = readCode(f);
      assert.match(code, /<h1 className=\{kit\.srOnly\}>/, `${f}: the page keeps an h1 for a screen reader`);
      assert.doesNotMatch(code, /kit\.title\b/, `${f}: no visible 32 px title (the lit tab names the page)`);
    }
    const tryouts = readCode(`${CLUB}/tryouts/page.tsx`);
    assert.equal((tryouts.match(/kit\.pageName/g) ?? []).length, 1, 'Tryouts out of season keeps its name (its tab is gone)');
    assert.doesNotMatch(readCode(`${CLUB}/tournaments/page.tsx`), /pluralize\(count, 'tournament'\)/, 'the count line went: each section\'s pill says it');
  });
  it('C4: a page about one thing names itself at 24 px in the title face; the club-name line over a form title is gone', () => {
    const kitCss = readSource('components/public/ClubKit.module.css');
    assert.match(cssRule(kitCss, '.pageName'), /font-family: var\(--club-title-face\);[\s\S]*font-weight: var\(--club-title-weight\);[\s\S]*font-size: 1\.5rem;/);
    for (const f of NAMED_PAGES) {
      const code = readCode(f);
      assert.match(code, /className=\{(`\$\{)?kit\.pageName/, `${f}: its name is kit.pageName (24)`);
      assert.doesNotMatch(code, /kit\.title\b/, `${f}: no 32 px title left`);
      assert.doesNotMatch(code, /\{org\.name\}<\/div>|\{org\.name\} · \{team\.name\}/, `${f}: the band names the club, not a line over the title`);
    }
  });
  it('R4: every club section heading is the shared heading row — the kit has no heading of its own any more', () => {
    assert.doesNotMatch(readSource('components/public/ClubKit.module.css'), /\.sectionTitle\b/);
    const users = [...filesUnder('app/[orgSlug]', '.tsx'), ...filesUnder('components/public', '.tsx'), ...filesUnder('components/rep-teams', '.tsx')]
      .filter(f => /import kit from '[^']*\/ClubKit\.module\.css'|import kit from '\.\/ClubKit\.module\.css'/.test(readSource(f)));
    assert.deepEqual(users.filter(f => /kit\.sectionTitle/.test(readSource(f))), []);
    const season = readCode(`${CLUB}/league/[seasonSlug]/page.tsx`);
    assert.match(season, /<PublicSectionHead id="season-divisions" title="Divisions" count=\{divisions\.length\} \/>/, 'Divisions is a heading with its count');
    assert.match(season, /<PublicSectionHead id="season-standings" title=\{standingsTitle\(season\.status\)\} \/>/);
    assert.doesNotMatch(season, /<div className=\{kit\.band\}>(Divisions|\{standingsTitle)/, 'no capitals label heads a section');
    assert.match(readCode('components/public/RepTeamPublicSchedule.tsx'), /<PublicSectionHead id="schedule" title="Schedule"\s+action=\{subscribe && <TeamSubscribeButton/, 'Subscribe keeps the right slot');
    assert.match(readCode('components/public/LeaguePayBlock.tsx'), /<PublicSectionHead id="pay-now" title=\{LW\.heading\} \/>/, 'Your sign-up\'s pay heading is the heading row');
  });
  it('R5 + R7: the seasons and the children are one framed list each; About\'s documents are link rows with the new-tab symbol', () => {
    const seasons = readSource('components/public/LeagueSeasonRows.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(cssRule(seasons, '.list'), /border: 1px solid var\(--club-line\);[\s\S]*overflow: hidden;/, 'one frame');
    assert.doesNotMatch(cssRule(seasons, '.row'), /border-radius|border: 1px/, 'a row is a hairline, never a card');
    assert.match(cssRule(seasons, '.name'), /min-height: 44px;/, 'the name link is a 44 px target in its own right');
    assert.match(readCode(`${CLUB}/league/[seasonSlug]/status/YourSignup.tsx`), /<ul className=\{kit\.list\}[^>]*aria-label="Your children">/);
    const about = readCode(`${CLUB}/about/page.tsx`);
    assert.match(about, /className=\{`\$\{kit\.row\} \$\{kit\.rowExternal\}`\}/);
    assert.match(readSource('components/public/ClubKit.module.css'), /\.rowExternal::after \{ display: none; \}/, 'the symbol stands where the chevron would');
  });
});

/** Club round Part 3 (2026-11-05): the sweep (R10 type and corners, R11 buttons) and the shared pay block. The pay block is
 *  also the tournament's team pay page and the house-league sign-up's confirmation, so what it pins holds on both sites. */
describe('Public page layout standard, club round Part 3 — one type scale, one corner, one button', () => {
  const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  it('the pay block: every heading a 16/700 section heading in the text face, the field on the field edge, buttons 44 at 8', () => {
    const pay = noComments(readSource('components/public/PayBlock.module.css'));
    assert.match(cssRule(pay, '.state h2, .receipt h2, .owing h2'), /font: 700 var\(--type-heading\)\/1\.25 var\(--club-text-face, inherit\);/,
      'one heading rule for every state, the receipts and the owing block — never the global 800-weight title face');
    assert.match(cssRule(pay, '.clearing h2'), /color: rgb\(var\(--info-rgb\)\);/, 'the clearing heading keeps its blue (registered exception)');
    assert.match(cssRule(pay, '.input'), /border: 1px solid var\(--pay-field\);[\s\S]*border-radius: var\(--radius-md\);/, 'the field edge, 8 px');
    assert.match(cssRule(pay, '.block'), /--pay-field: var\(--club-field, var\(--border-2\)\);/);
    assert.match(cssRule(pay, '.receipt'), /border: 1px solid var\(--pay-line\);[\s\S]*border-radius: var\(--radius-md\);/, 'a receipt is a box: hairline, 8 px');
    assert.match(cssRule(pay, '.payButton'), /min-height: 44px;/, 'R11: 44 like every button (was 48)');
    assert.match(cssRule(pay, '.payRow > .payButton'), /border-radius: var\(--radius-md\);/, '8 px on the tournament too (its global .btn is 6)');
    assert.doesNotMatch(pay, /48px|radius-sm/);
    assert.match(pay, /@media \(max-width: 640px\) \{ \.payButton \{ width: 100%;/, 'full width on a phone at the club frame\'s 640');
    assert.match(readSource(`${CLUB}/league/[seasonSlug]/status/EmailMyLinkForm.module.css`), /@media \(max-width: 640px\) \{\s*\.button \{ width: 100%; \}/,
      '"Email me my link" goes full width at the same 640 as the pay buttons');
  });
  it('R11: Subscribe and Follow are the kit\'s small buttons; "Sign up for tryouts" takes its own width at a desk', () => {
    assert.match(readCode('components/public/TeamSubscribeButton.tsx'), /className=\{`\$\{kit\.btn\} \$\{kit\.btnSecondary\} \$\{kit\.btnSm\} \$\{styles\.button\}`\}/);
    const sub = noComments(readSource('components/public/TeamSubscribeButton.module.css'));
    assert.doesNotMatch(cssRule(sub, '.button'), /border|radius|font|padding|min-height/, 'Subscribe keeps no button recipe of its own');
    assert.doesNotMatch(sub, /font-weight: 650|border-radius: (9|12)px|font-size: 0\.(9375|8125|6875)rem|font-size: 1\.1875rem/, 'the popover on the scale');
    assert.match(readCode('components/public/FollowOrgButton.tsx'), /\$\{kit\.btn\} \$\{kit\.btnSm\} \$\{following \? `\$\{kit\.btnPrimary\} \$\{styles\.on\}` : kit\.btnSecondary\}/);
    assert.doesNotMatch(noComments(readSource('components/public/FollowOrgButton.module.css')), /min-height|border-radius|border:/, 'Follow keeps no copy of the kit\'s buttons');
    assert.match(readCode('components/rep-teams/TryoutLandingView.tsx'), /\$\{kit\.btnPrimary\} \$\{kit\.btnPhoneFull\}`\}>Sign up for tryouts/);
    assert.match(readSource('components/public/ClubKit.module.css'), /@media \(max-width: 640px\) \{\s*\.btnPhoneFull \{ align-self: stretch; width: 100%; \}/);
  });
  it('R10: the strays on the scale — early-bird price, the fit line, Your sign-up\'s weights and total; Tournaments in text ink', () => {
    assert.match(readCode(`${CLUB}/league/[seasonSlug]/page.tsx`), /fontSize: '1rem', fontWeight: 700, color: cardSave > 0/, 'the early-bird price 16 (was 15)');
    assert.match(cssRule(readSource('components/league/register.module.css'), '.fit'), /border-radius: 0 8px 8px 0;/);
    assert.match(cssRule(readSource('components/league/register.module.css'), '.fitLine'), /font-size: 0\.875rem;/);
    const signup = readCode(`${CLUB}/league/[seasonSlug]/status/YourSignup.tsx`);
    assert.doesNotMatch(signup, /fontWeight: (650|750|800)|fontSize: '1\.15rem'/);
    assert.match(signup, /fontFamily: 'var\(--club-title-face\)', fontWeight: 'var\(--club-title-weight\)', fontSize: '1\.25rem'/, 'the total: 20 px title face');
    const t = noComments(readSource(`${CLUB}/tournaments/ClubTournaments.module.css`));
    assert.match(cssRule(t, '.tableRow td'), /color: var\(--club-text\);/, 'both tables\' cells in text ink');
    assert.doesNotMatch(t, /\.championCell/);
  });
});

describe('Public page layout standard, club round Part 4 — the house league\'s Schedule and Standings, the record, the not-found', () => {
  const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  it('C4: Schedule, Standings, a past tournament\'s record, the in-club not-found and error name themselves at 24', () => {
    for (const f of [`${CLUB}/league/[seasonSlug]/schedule/page.tsx`, `${CLUB}/league/[seasonSlug]/standings/page.tsx`,
      `${CLUB}/archives/[archiveId]/page.tsx`, 'components/public/ClubNotFound.tsx', `${CLUB}/error.tsx`]) {
      const code = readCode(f);
      assert.match(code, /<h1 className=\{kit\.pageName\}>/, `${f}: its name is kit.pageName (24)`);
      assert.doesNotMatch(code, /kit\.title\b/, `${f}: no 32 px title left`);
    }
    // The 32 px title stays for ONE page outside the club round: the coach's signed-in house-league team page.
    const users = [...filesUnder('app/[orgSlug]', '.tsx'), ...filesUnder('components/public', '.tsx'), ...filesUnder('components/rep-teams', '.tsx')]
      .filter(f => /kit\.title\b/.test(readCode(f)));
    assert.deepEqual(users.map(f => f.replace(/\\/g, '/')), [`${CLUB}/league/[seasonSlug]/team/[teamId]/page.tsx`]);
  });
  it('C7 + R6: the house league\'s Schedule draws every game on the standard\'s game row, each week under a heading row', () => {
    const code = readCode(`${CLUB}/league/[seasonSlug]/schedule/page.tsx`);
    assert.match(code, /<ScheduleMatchup\b/);
    assert.doesNotMatch(code, /column\.(game|when|match|matchName|place|state|struck|week|weekHead)\b/, 'no house-league row of its own');
    assert.match(code, /<PublicSectionHead title=\{head\} \/>/, 'a week\'s heading is the heading row (R4)');
    assert.match(code, /<PublicSectionHead title=\{SEASON_SCHEDULE_WORDS\.needsDate\} \/>/);
    assert.equal((code.match(/className=\{`\$\{kit\.list\} \$\{parts\.gameList\}`\}/g) ?? []).length, 2, 'one framed game list per section');
    // Away first (R6's "away score – score home"), and the place kept on every game (the house league's own ruling).
    assert.match(code, /sides=\{\[side\(game\.awayTeamId, game\.awayScore, game\.homeScore\), side\(game\.homeTeamId/);
    assert.match(code, /place=\{place \? \{ text: place \} : undefined\}/);
    // Postponed and Moved are pills in the one set, amber like Unofficial.
    assert.match(readCode('components/public/PublicGameRow.tsx'), /postponed: 'Postponed', moved: 'Moved'/);
    assert.match(readSource('components/public/PublicSchedule.module.css'),
      /\.gameStatus:is\(\[data-state='unofficial'\], \[data-state='postponed'\], \[data-state='moved'\]\) \{ color: var\(--club-warn\); \}/);
  });
  it('Standings: its name at 24 with the season 8 px under it; the table keeps its look (the registered table exception)', () => {
    const code = readCode(`${CLUB}/league/[seasonSlug]/standings/page.tsx`);
    assert.match(code, /<div className=\{kit\.nameBlock\}>\s*<h1 className=\{kit\.pageName\}>\{standingsTitle\(season\.status\)\}<\/h1>/);
    assert.match(cssRule(noComments(readSource('components/public/ClubKit.module.css')), '.nameBlock'), /gap: 8px;/);
  });
  it('a past tournament\'s record: heading rows, and its results on the game row — no row held wider than a phone', () => {
    const code = readCode(`${CLUB}/archives/[archiveId]/page.tsx`);
    assert.match(code, /<ScheduleMatchup\b/);
    assert.doesNotMatch(code, /minWidth: '(520|560)px'/, 'the old rows scrolled sideways on a phone');
    assert.match(code, /<PublicSectionHead title="Playoff results" \/>/);
    assert.match(code, /<PublicSectionHead title=\{titled\('Pool play results', ag\.name\)\} \/>/);
    assert.match(code, /<PublicSectionHead title=\{titled\('Pool play standings', ag\.name\)\} \/>/);
  });
  it('the in-club not-found is on the club column, never centred; its buttons are the kit\'s', () => {
    const code = readCode('components/public/ClubNotFound.tsx');
    assert.match(code, /<PublicPage frame="club">/);
    assert.match(code, /\$\{kit\.btnPrimary\} \$\{kit\.btnPhoneFull\}`\}>See all teams/);
    assert.match(code, /\$\{kit\.btnSecondary\} \$\{kit\.btnPhoneFull\}`\}>\{club\.name\} home/);
    const css = noComments(readSource('components/public/ClubNotFound.module.css'));
    assert.doesNotMatch(css, /^\.page\b|:global\(\.btn\)|^\.wide\b/m, 'no centred box or restyled global button left');
  });
  it('the in-club error (owner yes 2026-11-05): the club\'s face only where the club frame is drawn; the platform\'s page elsewhere', () => {
    const code = readCode(`${CLUB}/error.tsx`);
    assert.match(code, /const clubFace = wearsClubFrame\(pathname, club\);/);
    assert.match(code, /if \(!clubFace \|\| !club\) return <PageError error=\{error\} retry=\{retry\} \/>;/);
    assert.match(code, /<PublicPage frame="club">/);
    assert.match(code, /onClick=\{\(\) => retry\(\)\}/, 'Next 16: retry re-fetches the failed segment (reset only cleared the state)');
  });
});
