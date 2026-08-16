/**
 * THE ARCHIVE'S RESULTS DOOR READS THE SEASON IT WAS HANDED.
 *
 * ⚠ WHY THIS EXISTS. `/history/results` is the page the archive's **Insights** door opens, and
 * until 2026-08-16 it never read `?year=` at all. It decided what to show from a single test —
 * *does this coach still hold a LIVE assignment on this team?* — which is a different question
 * from the one the coach asked. That produced TWO wrong answers from ONE missing question:
 *
 *   · a coach who still ran the team opened 2024 and was shown THIS season's record and game log,
 *     with no archive chip anywhere to say so (the header was simply never given a season);
 *   · a coach with no live assignment had the finalized-games table suppressed outright, so the
 *     archive's own results door showed no results.
 *
 * Both are invisible in review: every row renders, the totals add up, and the page is quietly
 * answering about a different year. Nothing in the type system can catch it — the failure is a
 * missing argument, not a wrong one — so the properties are pinned here as a shape over the source.
 *
 * ⚠ It is asserted over the FILE rather than by rendering, deliberately: this is a client component
 * whose behaviour depends on `useSearchParams` and the coaches context, and the layout fixture has
 * **no completed season** to render it against. That fixture gap is exactly how the defect survived
 * — so the guard must not depend on the fixture that could not see it.
 *
 * Sibling of `coach-season-write-guard.test.ts` (which ROUTES may address a past season) and
 * `season-scoped-lookup-guard.test.ts` (whether a query can tell seasons apart). This one asks a
 * third thing: does the PAGE bother to ask?
 *
 * Archive-rail Phase 2 makes the Insights hub season-aware; when it lands, generalise this file to
 * every page the archive nav points at rather than adding a second copy of it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = join(
  process.cwd(),
  'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'history', 'results', 'page.tsx',
);
const source = readFileSync(PAGE, 'utf8');

describe('the archive results page asks which season', () => {
  it('resolves the season from the URL', () => {
    assert.ok(
      /useCoachSeasonPage\s*\(\s*orgSlug\s*,\s*teamId\s*,\s*seasonSearchParams\.get\('year'\)/.test(source),
      'the page must resolve its season through useCoachSeasonPage from `?year=`, like every other '
      + 'season-aware coach page. Without it the page renders whatever season it can see today.',
    );
  });

  /**
   * ⚠ THE ONE THAT ACTUALLY MOVES DATA. A season on the header and not on the fetch is the
   * `?year=`-on-the-links mistake in a new costume — it was tried and reverted in 004ca10c,
   * where the query made an unsolved problem merely LOOK solved.
   */
  it('sends the season to the events read, not just to the header', () => {
    assert.ok(
      /\/events\$\{seasonQuery\}/.test(source),
      'the events fetch must carry the season. `events` has been on the season-read rail since '
      + 'Chunk F — a page that omits the year gets the ACTIVE season and says nothing about it.',
    );
  });

  it('renders the season chip', () => {
    assert.ok(
      /season=\{page\.season\}/.test(source),
      'CoachPageHeader must be given the season, or a coach reading a past year has nothing on '
      + 'screen telling them which year it is.',
    );
  });

  /**
   * ⚠ THE ACTUAL BUG, pinned so it cannot come back by a different name. What the page shows is a
   * property of the SEASON. Who is reading decides only what they are allowed to open — and the
   * API is the authority on that, not this file.
   */
  it('never decides what to show from whether the coach still holds a live assignment', () => {
    assert.equal(
      /isClosedOnly/.test(source), false,
      'the `isClosedOnly` test is gone for good: it suppressed the whole game log for a coach with '
      + 'no live assignment, which is the archive`s results door showing no results.',
    );
    assert.ok(
      /!page\.hasAccess/.test(source),
      'access is `page.hasAccess` (live OR archived), never the live assignment alone.',
    );
  });

  it('treats a record as a record — read-only branches come from the season', () => {
    assert.ok(
      /page\.isReadOnly \? \[\] : teamTags/.test(source),
      'game tags are a LIVE vocabulary the coach edits today; offering them as a filter over a past '
      + 'season fails "what the coach could see at the time" silently.',
    );
    assert.ok(
      /page\.isReadOnly \? null : \(\s*<section/.test(source),
      'the "Past seasons" list is the live season only — inside a record the season chip above is '
      + 'already the switcher, and two of them is one too many.',
    );
  });

  /**
   * ⚠ The season switcher rewrites THIS page's own URL with `?year=` and the page does not
   * remount, so a stale-guard keyed on the team alone lets a past year's header sit above the live
   * season's games until the new fetch lands. The Lineups and Practice hubs were both fixed for
   * exactly this a day earlier; this page had the same hole.
   */
  it('keys its stale-response guard on the season as well as the team', () => {
    assert.ok(
      /const loadKey = `\$\{teamId\}\|\$\{seasonQuery\}`/.test(source),
      'the load key must carry the season, or switching seasons paints the old one`s data under the '
      + 'new one`s header.',
    );
    assert.equal(
      /loadedFor !== teamId/.test(source), false,
      'the render guard must compare against the season-aware load key, not the team id.',
    );
  });
});
