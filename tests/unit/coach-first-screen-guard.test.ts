import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE FIRST SCREEN ON A PHONE (phone re-evaluation stage 1, owner rulings 2026-09-21)
 *
 * Four rulings, each of which a later "tidy-up" could quietly undo without any test failing:
 *
 *   B1 **THE TEAM NAME IS THE SWITCHER'S DOOR.** With two or more teams the masthead's name is a
 *      button that opens the team sheet; the More sheet no longer lists the teams. One switcher
 *      per width — the sidebar's select on a desktop, the name on a phone — so a second copy in
 *      More is drift, and a name that is a button for a one-team coach is a door onto nothing.
 *
 *   B2 **THE BAR NEVER CHANGES SHAPE UNDER SCROLL, AT ANY WIDTH.** The phone collapse (a 64/12
 *      hysteresis toggle that snapped 59→36 and hid the "?") was deleted, and the Overview wears
 *      the same one-line rest form as every other screen; its club · season line is an unpinned
 *      sibling under the bar. A scroll listener that sets state, or an Overview exception on the
 *      rest class, is the collapse coming back.
 *
 *   B3 **ON A PHONE A TILE IS A ROW.** The Overview renders its six tiles twice — the grid and the
 *      row list — and the stylesheet shows one per width. The rows are the portal's one row recipe
 *      (`CoachRowList`), not a second card system.
 *
 *   B4 **THE CARD'S DOORS GROUP BY DESTINATION; ITS FACTS SIT ON THE META LINE.** Three of the
 *      four door-chips open the same page; four doors to two pages was the shape refused.
 *
 * Asserted against SOURCE with comments stripped (see `_source-code.ts` for why).
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const MASTHEAD = 'components/coaches/CoachTeamHeader.tsx';
const SHEET = 'components/coaches/CoachTeamSwitchSheet.tsx';
const NAV = 'components/coaches/CoachesBottomNav.tsx';
const OVERVIEW = 'app/[orgSlug]/coaches/teams/[teamId]/page.tsx';
const STYLES = 'app/[orgSlug]/coaches/coaches.module.css';

describe('B1 — the team name is the switcher\'s door', () => {
  const masthead = stripComments(readSource(MASTHEAD));
  const nav = stripComments(readSource(NAV));
  const sheet = stripComments(readSource(SHEET));

  it('the masthead offers the button only with somewhere to switch to, and only below the nav breakpoint', () => {
    assert.match(masthead, /const canSwitch = isPhoneNav && assignments\.length \+ closedAssignments\.length > 1;/,
      'the More sheet\'s own condition (2+ teams), gated on the phone nav — a one-team coach and a desktop see plain text');
    assert.match(masthead, /aria-haspopup="menu"/, 'the name is a real popup button');
    assert.ok(masthead.includes('<CoachTeamSwitchSheet'), 'the button opens the team sheet');
  });

  it('the sheet is the More sheet\'s own container and rows, not a second copy', () => {
    assert.ok(sheet.includes("from './CoachesBottomNav.module.css'"), 'one sheet stylesheet — the nav module\'s');
    for (const cls of ['sheet.sheetAnchor', 'sheet.sheetScrim', 'sheet.dropdown', 'sheet.dropItem', 'sheet.dropItemMeta']) {
      assert.ok(sheet.includes(cls), `the sheet draws with the nav module\'s \`${cls.slice(6)}\``);
    }
    assert.ok(sheet.includes("aria-current={active ? 'true' : undefined}"), 'the current team is marked, not linked as a door');
    assert.ok(sheet.includes('/season-end'), 'a team with no live season opens Season\'s End');
    assert.ok(!sheet.includes('useOverlayOpen'), 'the sheet is drawn ABOVE the bar and must not hide it');
  });

  it('the More sheet no longer lists the teams', () => {
    assert.ok(!nav.includes('Your teams'), 'the "Your teams" block left More for the masthead');
    assert.ok(!/closedAssignments\.map\(/.test(nav), 'no closed-season rows in More');
  });
});

describe('B2 — the bar never changes shape under scroll', () => {
  const masthead = stripComments(readSource(MASTHEAD));
  const styles = stripComments(readSource(STYLES));

  it('no scroll-driven state in the masthead', () => {
    assert.ok(!/addEventListener\('scroll'/.test(masthead), 'the collapse listener is gone');
    assert.ok(!/setCollapsed|teamHeaderCollapsed/.test(masthead), 'no collapsed state, no collapsed class');
    assert.ok(!/\.teamHeaderCollapsed\b/.test(styles), 'the collapsed form has no rules left in the stylesheet');
  });

  it('the rest form applies on every screen, the Overview included', () => {
    assert.match(masthead, /className=\{`\$\{styles\.teamHeader\} \$\{styles\.teamHeaderPhoneRest\}/,
      'teamHeaderPhoneRest is unconditional — no Overview exception');
  });

  it('the Overview\'s club · season line is an unpinned sibling of the sticky header', () => {
    assert.match(masthead, /\{onOverview && \(seasonText \|\| !isTeamWorkspace\) && \(\s*<div className=\{styles\.teamHeaderPageLine\} data-team-page-line>/,
      'rendered on the Overview only, outside the <header>');
    const headerClose = masthead.indexOf('</header>');
    const pageLine = masthead.indexOf('styles.teamHeaderPageLine');
    assert.ok(headerClose > 0 && pageLine > headerClose, 'the page line comes AFTER the header closes — never inside headerRef');
    assert.match(styles, /\.teamHeaderPageLine \{\s*display: none;/, 'hidden above 640, where the bar\'s meta line still carries both');
  });
});

describe('B3 — on a phone a tile is a row', () => {
  const overview = stripComments(readSource(OVERVIEW));
  const styles = stripComments(readSource(STYLES));

  it('the board renders the grid AND the row list from the same tiles', () => {
    assert.ok(overview.includes('<CoachRowList className={styles.boardRows} labelledBy="board-title">'), 'the rows are the one row recipe');
    const grid = (overview.match(/board\.slots\.map\(key => \{\s*const tile = buildTile\(key\);/g) || []).length;
    assert.equal(grid, 2, 'both renderings read buildTile for the same slots — the resolver knows neither exists');
    assert.match(styles, /\.boardRows \{ display: none; \}/, 'the rows are hidden above 640');
    assert.match(styles, /\.boardGrid \{ display: none; \}/, 'the grid is hidden at ≤640');
  });

  it('a row carries one qualifier — the flag, else the sub — and never the bar', () => {
    assert.match(overview, /const qualifier = tile\.flag\s*\?/, 'the flag wins the qualifier slot');
    const rows = overview.slice(overview.indexOf('<CoachRowList'), overview.indexOf('</CoachRowList>'));
    assert.ok(!rows.includes('CoachBar'), 'no progress bar on a row — the page it opens has it');
    assert.ok(!rows.includes('tile.progress'), 'no progress label on a row');
  });
});

describe('B4 — doors by destination, facts on the meta line', () => {
  const overview = stripComments(readSource(OVERVIEW));
  const styles = stripComments(readSource(STYLES));

  it('the doors group the chips by href, in first-seen order', () => {
    assert.match(overview, /const door = prepDoors\.find\(d => d\.href === chip\.href\);/, 'grouping is by href');
    assert.match(overview, /const phoneMetaFacts = prepChips\.filter\(c => !c\.href && c\.state === 'fact'\);/, 'the facts are the chips with no door AND no state — a toned chip without a door stays a toned row');
    assert.ok(overview.includes('className={styles.oneDoor}'), 'the doors render as .oneDoor rows');
  });

  it('a clock label on the meta line never splits across a wrap', () => {
    assert.match(styles, /\.oneMetaFactText \{ white-space: nowrap; \}/, 'each fact is nowrap; the dot sits outside it');
  });

  it('the phone shows doors, the desktop shows chips — by stylesheet, never by JS media query', () => {
    assert.match(styles, /\.oneDoors \{ display: none; \}/, 'doors hidden above 640');
    assert.ok(/@media \(max-width: 640px\) \{[^}]*\.oneChips \{ display: none; \}/.test(styles), 'chips hidden at ≤640');
    assert.ok(!/matchMedia\([^)]*640/.test(overview), 'no width branch in the page — the server and the first client frame must agree');
  });
});
