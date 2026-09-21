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
 *   B5 **THE BOARD'S GROUND IS ONE WHITE FRAME, NOT SIX ROW-CARDS** (owner, 2026-09-20 — "why are
 *      these tiles grey?"). The recipe's phone form broke the board into six olive-washed cards
 *      where the approved drawing was white; the board declares the recipe's framed phone form
 *      (`phoneFrame`, walk rule S.7) and the recipe carries that form ONCE, at the foot of the
 *      stylesheet, AFTER the stand-down it overrides — order is the mechanism there, so a tidy-up
 *      that moves the block, or a "6px gap" rule that comes back on the board, is the grey coming back.
 *
 *   B6 **A PHONE ROW CARRIES A FACT OR NOTHING, AND NO ICON** (owner, 2026-09-21 — "a little squished
 *      and cluttered"). The qualifier is the flag, the pips, or the sub only when the tile has NOT
 *      marked it a hint (`subIsHint` — decided beside the sub, never inferred from its words); a row
 *      with nothing factual stays one line. No mark on a row. Rows are 52px (0.45rem, 1px between
 *      the lines) — the ceiling that keeps six above the bar; the figure is bold, not extra-bold.
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
    assert.ok(overview.includes('<CoachRowList className={styles.boardRows} labelledBy="board-title" phoneFrame>'), 'the rows are the one row recipe, in its framed phone form (B5)');
    const grid = (overview.match(/board\.slots\.map\(key => \{\s*const tile = buildTile\(key\);/g) || []).length;
    assert.equal(grid, 2, 'both renderings read buildTile for the same slots — the resolver knows neither exists');
    assert.match(styles, /\.boardRows \{ display: none; \}/, 'the rows are hidden above 640');
    assert.match(styles, /\.boardGrid \{ display: none; \}/, 'the grid is hidden at ≤640');
  });

  it('B5 — the board keeps its frame on a phone: the recipe carries the form once, after the stand-down, and the board adds no gap', () => {
    const rowList = stripComments(readSource('components/coaches/CoachRowList.tsx'));
    assert.ok(rowList.includes("data-row-list-phone={phoneFrame ? 'frame' : undefined}"), 'the form is DECLARED on the list — the sweep reads the attribute');
    assert.ok(rowList.includes("${phoneFrame ? ` ${styles.rowListPhoneFrame}` : ''}"), 'the declaration carries the recipe class');
    const standDown = styles.indexOf('ul.rowList, ul.rowListInset { border: 0; border-radius: 0; background: none;');
    const framed = styles.indexOf('ul.rowListPhoneFrame {');
    assert.ok(standDown > 0 && framed > standDown, 'the framed phone form is declared AFTER the stand-down it overrides (same specificity — order is the mechanism)');
    const lastRule = styles.indexOf('.rowListPhoneFrame .rowListItem:last-child');
    assert.ok(lastRule > framed, 'the form ends with the last row shedding its hairline');
    const block = styles.slice(framed, lastRule);
    assert.ok(block.includes('background: var(--card-bg, var(--surface));'), 'the frame paints the card ground');
    const rowRule = block.slice(block.indexOf('.rowListPhoneFrame .rowListItem {'));
    assert.ok(rowRule.includes('background: none;') && rowRule.includes('border-bottom: 1px solid'), 'a row paints nothing; the hairline is the whole separation');
    assert.ok(!styles.includes('.boardRows .rowListItem { margin-bottom: 6px; }'), 'the 6px gap between row-cards went with the row-cards');
  });

  it('a row carries one qualifier — the flag, else the pips, else a sub that is a FACT — and never the bar', () => {
    assert.match(overview, /const qualifier = tile\.flag\s*\?/, 'the flag wins the qualifier slot');
    const rows = overview.slice(overview.indexOf('<CoachRowList'), overview.indexOf('</CoachRowList>'));
    assert.ok(!rows.includes('CoachBar'), 'no progress bar on a row — the page it opens has it');
    assert.ok(!rows.includes('tile.progress'), 'no progress label on a row');
    assert.ok(rows.includes(': tile.subIsHint ? undefined : tile.sub;'), 'B6 — a hint sub is not drawn on a phone row; the row stays one line');
    assert.ok(!rows.includes('mark='), 'B6 — no icon on a phone row');
    assert.ok(!rows.includes('tile.icon'), 'B6 — the row does not read the tile icon');
  });

  it('B6 — every tile decides whether its sub is a hint beside the sub, and the row density is the 52px ceiling', () => {
    assert.ok(overview.includes('subIsHint?: boolean;'), 'the Tile type carries the decision');
    const tiles = overview.slice(overview.indexOf('const buildTile = '), overview.indexOf('const renderSetupRow'));
    const subs = (tiles.match(/^\s+sub: /gm) || []).length;
    const hints = (tiles.match(/^\s+subIsHint: /gm) || []).length;
    assert.equal(hints, subs, `every tile with a sub says whether it is a hint (${hints} of ${subs})`);
    assert.ok(tiles.includes('subIsHint: parts.length <= 1,'), '"in the next 7 days" is a hint; "1 game · 2 other" is a fact');
    assert.ok(tiles.includes('subIsHint: !(tournaments && tournaments.count > 0),'), '"Register for a tournament" is a hint; "next Sep 28" is a fact');
    assert.ok(styles.includes('.boardRows .rowListRow, .boardRows .rowListRow:has(.rowCaption) { padding-top: 0.45rem; padding-bottom: 0.45rem;'), 'the rows breathe at 0.45rem — the 52px ceiling');
    assert.ok(!styles.includes('.boardRows .rowListMark'), 'no mark rule on the board rows — there is no mark');
    const fig = styles.slice(styles.indexOf('.boardRowFigure {'), styles.indexOf('.boardRowFigure[data-tone'));
    assert.ok(fig.includes('font-weight: 700;'), 'the figure is bold, not extra-bold');
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
