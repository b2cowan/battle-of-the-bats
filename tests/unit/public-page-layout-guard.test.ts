import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, filesUnder, openingTags, parseProps, readCode, readSource, reachableFrom, sourceExists } from './_source-code.ts';

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
    assert.match(page, /className=\{className \? `\$\{parts\.page\} \$\{className\}` : parts\.page\}/);
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
      assert.equal(twoCol, sheet === 'components/public/PublicParts.module.css' ? 1 : 0, `${sheet}: the two-column pages share ONE rule (PublicParts .cols)`);
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
