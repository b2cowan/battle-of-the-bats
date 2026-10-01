import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource, functionBody } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * REPORTS ON A PHONE (phone re-evaluation stage 6, the last stage — owner ruling 2026-09-24:
 * "I agree with your recommendations", R1–R6 + R5b + T as recommended — plan §14)
 *
 *   R1 **A REPORT STAYS A TABLE WHEN IT FITS; A COMPARISON THAT DOESN'T KEEPS ITS COLUMNS IN THE
 *      PINNED SCROLLER; A LIST THAT DOESN'T BECOMES CARDS.** An amendment to the table standard's
 *      §3.8 (it asked list-or-comparison and never "does it fit?").
 *   R2 Attendance is a TABLE on a phone (291 of 326px) — twelve cards were 1,775px. The seven report
 *      tables that scroll sideways sit inside `CoachScrollX` (sticky + a hint), every cell on one
 *      line — Playing time was 3,825px of wrapped names. R2b: Results reads Date · Game · Result ·
 *      Score · Type. R2c: Awards' history is a card list with ONE corner menu on a phone.
 *   R3 The tab you are on scrolls into view (three of seven reports opened with it off-screen), and
 *      the ROW scrolls — never the window. R3b: "Playing time", one spelling.
 *   R4 Notification previews clamp to two lines at ≤640.
 *   R5 Practice review folds what is still to come into one row on a phone; R5b its practices are
 *      short rows and the sentence that repeated the truth chip is gone at every width.
 *   R6 Results' chart and one-run figure read the record rule — +1 against the Dashboard's +6 was a
 *      scrimmage counted in one and not the other.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const H = 'app/[orgSlug]/coaches/teams/[teamId]/history';
const results = readCode(`${H}/results/panel.tsx`);
const playing = readCode(`${H}/playing-time/panel.tsx`);
const awards = readCode(`${H}/awards/panel.tsx`);
const attendance = readCode(`${H}/attendance/panel.tsx`);
const development = readCode(`${H}/development/panel.tsx`);
const hub = readCode(`${H}/page.tsx`);
const tabBar = readCode('components/shared/HubTabBar.tsx');
const css = readSource('app/[orgSlug]/coaches/coaches.module.css');
const feedCss = readSource('components/notifications/notifications-page.module.css');

const count = (s: string, needle: string | RegExp) =>
  typeof needle === 'string' ? s.split(needle).length - 1 : (s.match(new RegExp(needle, 'g')) ?? []).length;

describe('R1 · R2 — every report table on a phone is a table, a pinned scroller, or a card list', () => {
  it('a report table that scrolls sits inside the portal pinned scroller, never a bare frame', () => {
    for (const [name, src] of [['Results', results], ['Playing time', playing], ['Awards', awards]] as const) {
      const bare = count(src, /<div className=\{styles\.insightsTableWrap\}>/);
      assert.equal(bare, 0, `${name}: a bare .insightsTableWrap scrolls with no pinned column and no hint (K-05 half-built)`);
    }
    assert.equal(count(results, /<CoachScrollX sticky hint=\{[^}]*\} scrollerClassName=\{styles\.insightsTableWrap\}>/), 1, 'Results');
    assert.equal(count(playing, /<CoachScrollX sticky hint="[^"]+" scrollerClassName=\{styles\.insightsTableWrap\}>/), 4, 'Playing time: all four tables');
    // The leaderboard FITS and its first column is the rank: a scroller for the overflow, never a pinned rank
    // with the names swiped away (/review, 2026-09-24).
    // Three unpinned scrollers since §14.13: the leaderboard, the phone's history (it fits — the scroller
    // is the overflow's safety net) and the desktop's five-column history.
    assert.equal(count(awards, /<CoachScrollX hint="[^"]+" scrollerClassName=\{styles\.insightsTableWrap\}( wrapCells)?>/), 3, 'Awards: leaderboard + both histories, unpinned');
    // the phone history FITS: the scroller's wrap-cells option, not a per-table override of K-05
    assert.match(awards, /<CoachScrollX hint="Swipe for the award" scrollerClassName=\{styles\.insightsTableWrap\} wrapCells>/);
    assert.doesNotMatch(css, /awardsHistoryPhone td \{ white-space/);
    assert.equal(count(awards, /<CoachScrollX sticky/), 0, 'the leaderboard must not pin its rank column');
    assert.match(awards, /<td className=\{styles\.insightsNameCell\}>\{row\.playerName\}<\/td>/, 'a long name wraps rather than widening the leaderboard');
  });

  it('inside the scroller every cell is one line on a phone; the pinned name may take two', () => {
    const block = css.slice(css.indexOf('K-05 FINISHED — EVERY CELL ON ONE LINE'));
    assert.match(block, /\.scrollX \.insightsTable td \{ white-space: nowrap; \}/);
    assert.match(block, /\.scrollX \.insightsTable td\.insightsNameCell \{ white-space: normal; \}/);
    // the 8.5rem floor only where the name is the PINNED column (the unpinned leaderboard must still fit 360)
    assert.match(block, /\.scrollXSticky \.insightsTable td\.insightsNameCell \{ width: 8\.5rem; min-width: 8\.5rem; \}/);
    assert.equal(count(playing, 'className={styles.insightsNameCell}'), 3, 'the three player-row tables mark the pinned name');
  });

  it('the Playing time demo anchor survives the scroller (it cannot carry the attribute itself)', () => {
    assert.match(playing, /<div data-sandbox-tour="playing-time">\s*<CoachScrollX/);
  });

  it('Attendance is a table on a phone — no card reflow, no card labels', () => {
    assert.doesNotMatch(attendance, /tableAsCards/);
    assert.doesNotMatch(attendance, /data-label=/);
    assert.match(attendance, /<div className=\{styles\.tableWrap\}>\s*<table className=\{styles\.table\}>/);
  });

  /* §14.13 (owner, 2026-09-25) reverses R2c after the owner saw the cards built: on a phone the
     history is a TABLE THAT FITS — Date · Player · Award (the occasion under it) · a chevron — and
     the row opens the award's sheet. No report table takes the card reflow any more. */
  it('Awards history on a phone is a table that fits, and no report table takes the card reflow', () => {
    const hist = awards.slice(awards.indexOf('Full history'));
    assert.doesNotMatch(awards, /tableAsCards/, 'the history is no longer cards');
    assert.match(hist, /\{isPhone \? \(/, 'the phone draws its own table; the desktop keeps five columns');
    const phone = hist.slice(hist.indexOf('{isPhone ? ('), hist.indexOf(') : ('));
    assert.match(phone, /<th className=\{styles\.tdShrink\}>Date<\/th><th>Player<\/th><th>Award<\/th><th aria-hidden \/>/);
    assert.doesNotMatch(phone, /a\.note/, 'the note is read in the award\'s sheet, never in the phone row');
    assert.match(phone, /<span className=\{styles\.listRowSub\}>\{forText\}<\/span>/, 'what it was for sits under the award');
    assert.match(phone, /<td className=\{styles\.awardsPlayerCell\}>/, 'a name claims its width before a long occasion');
  });

  it('the whole row opens the award, and its last column is a real, named chevron button (2026-09-01 / 09-03)', () => {
    const hist = awards.slice(awards.indexOf('Full history'));
    const phone = hist.slice(hist.indexOf('{isPhone ? ('), hist.indexOf(') : ('));
    assert.match(phone, /className=\{styles\.rowTappable\}\s*onClick=\{\(\) => \{ if \(window\.getSelection\(\)\?\.toString\(\)\) return; setOpenAwardId\(a\.id\); \}\}/);
    assert.match(phone, /<button\s+type="button"\s+className=\{`\$\{styles\.linkBtn\} \$\{styles\.listRowToggle\}`\}\s+aria-label=\{`Open /);
    assert.match(phone, /onClick=\{e => \{ e\.stopPropagation\(\); setOpenAwardId\(a\.id\); \}\}/);
    assert.match(phone, /<ChevronRight size=\{18\}/);
    assert.doesNotMatch(awards, /CoachToolbarMenu|MoreHorizontal/, 'the row\'s ⋯ menu is retired');
  });

  it('R2b — Results reads Date · Game · Result · Score · Type, at every width', () => {
    assert.match(results, /<th className=\{styles\.tdShrink\}>Date<\/th><th>Game<\/th><th>Result<\/th><th className=\{styles\.insightsNumHead\}>Score<\/th><th>Type<\/th>/);
    const row = results.slice(results.indexOf('<td>{gameTitle(e)}</td>'), results.indexOf('{typeLabel(e)}'));
    assert.ok(row.indexOf('wltPip') > 0 && row.indexOf('insightsNum') > row.indexOf('wltPip'), 'Result then Score before Type in the row');
  });
});

describe('R6 — Results\' figures read the record rule; its rows still list everything', () => {
  it('the chart and the one-run tally come from the counted games', () => {
    assert.match(results, /const counted = finalized\.filter\(countsTowardRecord\);/);
    assert.match(results, /const scored = counted\.filter\(/);
    assert.match(results, /const chronological = \[\.\.\.counted\]\.reverse\(\);/);
  });
  it('the table still lists the scrimmage (the rows are the record of play, not the record)', () => {
    assert.match(results, /\{visibleGames\.map\(e => \(/);
  });
});

describe('R3 — the tab you are on is in view; R3b — one spelling', () => {
  it('the row scrolls to the active tab — the ROW, never the window', () => {
    assert.match(tabBar, /querySelector<HTMLElement>\('\[aria-current="page"\]'\)/);
    assert.match(tabBar, /el\.scrollTo\(\{ left: el\.scrollLeft \+ delta, behavior: 'instant' \}\)/);
    assert.doesNotMatch(tabBar, /scrollIntoView/, 'scrollIntoView also scrolls the page when the row is off screen');
    assert.match(tabBar, /\}, \[activeId, tabsKey, remeasureKey\]\);/, 're-checked when the caller says the row width moved');
  });
  it('"Playing time" — the tab says what the page\'s own finding chips say', () => {
    assert.match(hub, /\{ id: 'playing-time', label: 'Playing time',/);
    assert.doesNotMatch(readSource('lib/help-content/coaches.tsx'), /Playing Time/);
    assert.match(readSource('lib/coach-staff-labels.ts'), /scoutingBook: 'Scouting Book'/);
  });
});

describe('R4 — notification previews stop at two lines on a phone', () => {
  it('the clamp is ≤640 only, and only for a notification whose page says the rest', () => {
    const at = feedCss.indexOf('The preview clamp');
    assert.ok(at > 0, 'the clamp block is gone');
    const block = feedCss.slice(at, feedCss.indexOf('/* ── Touch widths', at));
    assert.match(block, /@media \(max-width: 640px\) \{\s*\.itemBodyClamp \{\s*display: -webkit-box;\s*-webkit-line-clamp: 2;/);
    assert.doesNotMatch(block, /\.itemBody \{/, 'a bare .itemBody clamp would cut an admin announcement with nowhere to read the rest');
    const feed = readCode('components/notifications/NotificationFeedBody.tsx');
    assert.match(feed, /const CLAMPED_ON_A_PHONE: ReadonlySet<AppNotification\['eventType'\]> = new Set\(\['coach_insights_digest'\]\);/);
    assert.match(feed, /CLAMPED_ON_A_PHONE\.has\(n\.eventType\)/);
  });
});

describe('R5 · R5b — Practice review opens on the last practice held, as short rows', () => {
  const review = functionBody(development, 'PracticeReview');
  it('the future folds into one row that opens in place — and a filter of only-upcoming opens it', () => {
    assert.match(review, /const futureShown = futureOpen \|\| heldCount === 0;/);
    // opened FOR one filter: a tag change closes it (/review, 2026-09-24)
    assert.match(review, /const futureOpen = futureOpenFor !== undefined && futureOpenFor === tag;/);
    assert.match(review, /data-future=\{futureShown \? 'shown' : 'folded'\}/);
    assert.match(review, /\{upcomingCount > 0 && heldCount > 0 && \(\s*<button type="button" className=\{styles\.reportRecapFold\} aria-expanded=\{futureOpen\}/);
    assert.match(css, /\.reportRecapList\[data-future='folded'\] \.reportRecap\[data-upcoming\] \{ display: none; \}/);
  });
  it('the truth chip is the ONE statement of a silence — the repeating sentence is gone at every width', () => {
    assert.doesNotMatch(review, /Nothing was written afterwards/);
    assert.doesNotMatch(review, /The practice is still to come/);
    assert.match(review, /\{p\.recap && <p className=\{styles\.reportRecapText\}>\{p\.recap\}<\/p>\}/);
  });
  it('the row is the door through a 44px corner chevron, named for its practice', () => {
    assert.match(review, /aria-label=\{`\$\{p\.recap \? 'Open plan and recap' : 'Open the plan'\} — \$\{p\.name\}`\}/);
    assert.match(css, /\.reportRecapLink::after \{ content: ''; position: absolute; inset: 0; \}/);
    assert.match(css, /\.reportRecap \.reportRecapText \{\s*margin-left: calc\(3\.2rem \+ 0\.6rem\);\s*display: -webkit-box;\s*-webkit-line-clamp: 3;/);
  });
});
