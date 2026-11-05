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
