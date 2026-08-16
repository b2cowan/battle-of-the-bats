/**
 * THE ARCHIVE'S INSIGHTS RAIL READS THE SEASON IT WAS HANDED — hub, doors, and one level down.
 *
 * ⚠ WHY THIS EXISTS. `/history/results` never read `?year=` at all until 2026-08-16, and the hub
 * above it held no season resolver whatsoever. Each decided what to show from a single test —
 * *does this coach still hold a LIVE assignment on this team?* — which is a different question
 * from the one the coach asked. ONE missing question produced THREE wrong answers:
 *
 *   · a coach who still ran the team opened 2024 and was shown THIS season's record and game log,
 *     with no archive chip anywhere to say so (the header was simply never given a season);
 *   · a coach with no live assignment had the finalized-games table suppressed outright, so the
 *     archive's own results door showed no results;
 *   · and on the hub, that same coach hit a "Team not found" wall describing the season they ran.
 *
 * All three are invisible in review: every row renders, the totals add up, and the page is quietly
 * answering about a different year. Nothing in the type system can catch it — the failure is a
 * missing ARGUMENT, not a wrong one — so the properties are pinned here as a shape over the source.
 *
 * ⚠ Asserted over the FILES rather than by rendering, deliberately. These are client components
 * whose behaviour depends on `useSearchParams` and the coaches context, and **the layout fixture
 * has no completed season to render them against.** That fixture gap is exactly how the defect
 * survived — so the guard must not depend on the fixture that could not see it. The runtime half
 * lives in `tests/uat/scenarios/coach-frozen-season-smoke.spec.ts`, the only fixture with a
 * finished season; owner QA on a real archive is the only complete proof.
 *
 * Sibling of `coach-season-write-guard.test.ts` (which ROUTES may address a past season) and
 * `season-scoped-lookup-guard.test.ts` (whether a QUERY can tell seasons apart). This one asks a
 * third thing: does the PAGE bother to ask?
 *
 * ⚠ Phase 1 covered the results page alone (as `coach-archive-results-season.test.ts`). Phase 2
 * widened it to the hub and its doors rather than starting a second copy — when a door joins the
 * archive, add it to SEASON_AWARE_PAGES below instead of writing a new file.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLOSED_TEAM_NAV_ITEMS,
  CLOSED_SECTION_EXTRAS,
  LIVE_ONLY_ARCHIVE_SECTIONS,
  PLAYING_TIME_SECTION,
  OPPONENTS_SECTION,
  archiveHasSection,
} from '../../lib/coach-nav-visibility.ts';

const COACH_PAGES = join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]');
const read = (...seg: string[]) => readFileSync(join(COACH_PAGES, ...seg, 'page.tsx'), 'utf8');

/**
 * ⚠⚠ ABSENCE ASSERTIONS MUST READ CODE, NOT PROSE — and this was found the hard way, by these
 * very tests failing on their first run.
 *
 * Every page on this rail documents the defect it used to have, by name: the certificate's comment
 * says it *used to* print `assignment.programYearName`, the hub's says it *used to* read
 * `assignment.capabilities`. A "this pattern must not appear" check over raw source therefore fails
 * on the explanation of the fix — which pressures the next person into deleting the comment to make
 * the test pass. That is the guard eating the only durable record of why the code looks like this.
 *
 * So negatives run over code with comments removed. Block comments (where all of this repo's
 * reasoning lives, including JSX `{/* … *\/}`) and whole-line `//` comments go; trailing inline
 * comments stay, deliberately — stripping those needs string-awareness, and a `//` inside a URL
 * would silently swallow real code and turn this guard vacuous.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const hub = read('history');
const results = read('history', 'results');
const awards = read('history', 'awards');
const certificate = read('history', 'awards', 'certificate');

/**
 * Every page the archive's Insights rail can reach, and the fetch each one MUST carry the season
 * on. The path is the fetch's route fragment — asserting on `${fragment}${seasonQuery}` is the
 * assertion that actually moves data, as opposed to decorating the header.
 */
const SEASON_AWARE_PAGES: { label: string; source: string; fetches: string[] }[] = [
  { label: 'the Insights hub', source: hub, fetches: ['/events', '/attendance', '/dues'] },
  { label: 'the results report', source: results, fetches: ['/events'] },
  { label: 'the awards report', source: awards, fetches: ['/award-types', '/awards'] },
  { label: 'the award certificate', source: certificate, fetches: ['/awards'] },
];

describe('every page on the archive Insights rail asks which season', () => {
  for (const { label, source } of SEASON_AWARE_PAGES) {
    it(`${label} resolves the season from the URL`, () => {
      assert.match(
        source, /useCoachSeasonPage\s*\(\s*orgSlug\s*,\s*teamId\s*,\s*\w+\.get\('year'\)/,
        `${label} must resolve its season through useCoachSeasonPage from '?year=', like every `
        + 'other season-aware coach page. Without it the page renders whatever season it can see '
        + 'today and says nothing about which one that is.',
      );
    });

    /**
     * ⚠ THE ONE THAT ACTUALLY MOVES DATA. A season on the header and not on the fetch is the
     * `?year=`-on-the-links mistake in a new costume — it was tried and reverted in 004ca10c,
     * where the query made an unsolved problem merely LOOK solved.
     */
    it(`${label} sends the season to its reads, not just to the header`, () => {
      for (const path of SEASON_AWARE_PAGES.find(p => p.source === source)!.fetches) {
        assert.ok(
          source.includes(`${path}\${seasonQuery}`),
          `${label} must carry the season on its ${path} fetch. Those routes have been on the `
          + 'season-read rail since Chunk F — a page that omits the year silently gets the ACTIVE '
          + 'season back and presents it as the one on screen.',
        );
      }
    });

    it(`${label} never decides what to show from whether the coach holds a LIVE assignment`, () => {
      assert.match(
        source, /!page\.hasAccess/,
        `${label} must gate on page.hasAccess (live OR archived). The live-assignment test is what `
        + 'walled a coach with no live assignment out of a season they ran themselves.',
      );
    });
  }

  it('the hub and the results page both render the season chip', () => {
    for (const [label, source] of [['hub', hub], ['results', results], ['awards', awards]] as const) {
      assert.match(
        source, /season=\{page\.season\}/,
        `the ${label} must hand CoachPageHeader the season, or a coach reading a past year has `
        + 'nothing on screen telling them which year it is.',
      );
    }
  });

  /**
   * ⚠ THE ACTUAL BUG, pinned so it cannot come back by a different name. What a page shows is a
   * property of the SEASON. Who is reading decides only what they may open — and the API is the
   * authority on that, not these files.
   */
  it('the isClosedOnly test stays gone for good', () => {
    for (const source of [hub, results, awards]) {
      assert.equal(
        /isClosedOnly/.test(code(source)), false,
        'the `isClosedOnly` test suppressed a whole report for a coach with no live assignment, '
        + 'which is the archive`s own door showing nothing behind it.',
      );
    }
  });

  it('capabilities come from the viewed season, never the coach’s current ones', () => {
    for (const [label, source] of [['hub', hub], ['awards', awards]] as const) {
      /**
       * ⚠ CoachAskBar is the ONE permitted reader of the live assignment on these pages, and it is
       * permitted precisely because it is hidden in a record — so its line is excused by name
       * rather than by widening the rule. If the bar ever renders in an archive, this exemption is
       * wrong and the assertion above it should start failing again.
       */
      const body = code(source).replace(/capabilities=\{assignment\.capabilities\}/g, '');
      assert.equal(
        /assignment\.capabilities|assignment\?\.capabilities/.test(body), false,
        `the ${label} reads capabilities off the LIVE assignment. Governing rule 1: an assistant `
        + 'granted money this year and not last must not read last year`s money. `page.capabilities` '
        + 'is already that season`s. (CoachAskBar is the one exception and is live-season-only.)',
      );
    }
  });
});

describe('a record shows records, and puts the instruments away', () => {
  /**
   * ⚠ THE FETCH IS THE GATE, NOT THE TILE. Hiding a door while still calling the route behind it
   * leaves the live season's numbers in state, where a finding or a summary line can still print
   * them under a past season's chip — a hidden tile over a live fetch is not a hidden feature.
   */
  /**
   * ⚠ The gate is DERIVED from `LIVE_ONLY_ARCHIVE_SECTIONS`, not restated as a bare `!isRecord`
   * (/simplify 2026-08-16). Asserting on the derivation rather than on the boolean is the point:
   * a hand-written second copy of the ruling is how the hub and the season switcher drift apart,
   * and only one of them would have a test.
   */
  it('the hub derives its hidden reports from the ruling list, not a second copy of it', () => {
    assert.match(
      hub, /const canLineups = \(!isRecord \|\| archiveHasSection\(PLAYING_TIME_SECTION\)\)/,
      'playing time must ASK archiveHasSection. `lineup-analytics` is NOT on the season-read rail '
      + '(ruled live-season-only permanently, owner 2026-08-16) — asking it from an archive answers '
      + 'with the LIVE season`s numbers under a past year`s chip. Restating the ruling as a bare '
      + '`!isRecord` here would let a reversal in the list leave this tile still hidden.',
    );
    assert.match(
      hub, /const canScouting = \(!isRecord \|\| archiveHasSection\(OPPONENTS_SECTION\)\)/,
      'the scouting book must ASK archiveHasSection too. It is an INSTRUMENT (owner 2026-08-04, '
      + 're-confirmed 2026-08-16) and its routes are off the rail; a build-enforced test in '
      + 'coach-season-write-guard.test.ts fails the moment one joins.',
    );
    // …and the derivation must actually resolve to "hidden" today, or the shape above is decorative.
    for (const section of [PLAYING_TIME_SECTION, OPPONENTS_SECTION]) {
      assert.equal(archiveHasSection(section), false,
        `${section} must be hidden in a record for the hub's gate to hide its tile.`);
    }
  });

  it('the hub hides the Ask bar in a record', () => {
    assert.match(
      hub, /\{!isRecord && assignment && \(\s*<CoachAskBar/,
      'Ask the Front Office is live-season-only BY OMISSION — it takes no `?year=` anywhere, so '
      + 'inside an archive every answer it gave would be about this year under a past year`s chip.',
    );
  });

  it('the awards report offers no way to give, manage or remove an award in a record', () => {
    for (const control of ['Give an award', 'Manage award types']) {
      const idx = awards.indexOf(control);
      assert.ok(idx > 0, `expected the "${control}" control to exist at all`);
      assert.ok(
        awards.slice(Math.max(0, idx - 700), idx).includes('!isRecord'),
        `"${control}" is not gated on the season. A finished season is a record: giving, managing `
        + 'and removing all ACT on a season and stay live-only (CLAUDE.md rule 1). The server '
        + 'refuses them regardless — this is the door, not the lock.',
      );
    }
    assert.match(
      awards, /\{!isRecord && \(\s*<button\s*\n\s*title="Remove"/,
      'removing an award UNDOES a night that happened — it must be absent in a record.',
    );
  });

  /**
   * ⚠ The keepsake is the deliberate exception, and it is worth pinning so a later tidy-up does
   * not "consistently" remove it: printing a certificate reproduces something that already
   * happened, which is precisely what a coach opens a finished season to do.
   */
  it('printing a certificate survives in a record, and carries the year', () => {
    assert.ok(
      awards.includes('certificate?awardId=${a.id}${seasonParam}'),
      'the per-award print link must carry the season — the certificate prints the season name '
      + 'onto paper handed to a child, and it reads that name from the URL.',
    );
    assert.match(
      certificate, /page\.programYearName/,
      'the certificate must name the season the award was WON in. It printed the coach`s CURRENT '
      + 'programYearName, which puts this year on a certificate for a past year`s award.',
    );
    assert.equal(
      /assignment\.teamName|assignment\.programYearName/.test(code(certificate)), false,
      'the certificate must not read the live assignment for its printed facts.',
    );
  });

  /**
   * ⚠ Past tense, and no promise of anything arriving — nothing will, the season is over. The
   * results page and the attendance report both took this rule the day before; the hub and the
   * awards report take it here.
   */
  it('empty states in a record do not promise a future', () => {
    assert.match(hub, /isRecord \? 'This season was never filled in'/,
      'the hub`s empty state must not teach a coach how to fill in a season that has ended.');
    assert.match(awards, /isRecord \? 'No awards were given'/,
      'the awards empty state must not point at a button a record does not have.');
  });

  /**
   * ⚠⚠ THE GUARD MUST NOT BE OPT-IN, because an opt-in guard gets forgotten — and it was, three
   * times, found by `/review` 2026-08-16.
   *
   * The awards page's `load()` took an `isStale` predicate with a NO-OP DEFAULT, so only callers
   * that remembered to pass one were protected. The mount effect remembered; the three
   * write-triggered reloads (remove an award, and both modals' `onChanged`) did not. Phase 2 is
   * what made that reachable — it put a season chip on this page for the first time, and the chip
   * re-navigates without remounting, so a reload in flight when the season changes stamps ITS key
   * into `loadedFor` and strands the page on a spinner **permanently**.
   *
   * So the property pinned here is not "the callers pass a guard" — it is "the callers CANNOT fail
   * to be guarded". A generation counter inside `load` makes every run stale the moment a newer one
   * starts, whoever started it, including a caller added years from now.
   */
  it('the awards reload cannot be started without its stale guard', () => {
    assert.match(
      awards, /const runRef = useRef\(0\);/,
      'the awards page must carry a run generation, so staleness is decided INSIDE load() rather '
      + 'than by whichever caller remembered to pass a predicate.',
    );
    assert.match(
      awards, /const myRun = \+\+runRef\.current;[\s\S]{0,240}runRef\.current !== myRun/,
      'load() must stamp its own generation and treat a newer generation as stale — that is what '
      + 'protects the write-triggered reloads, which call load() with no argument.',
    );
    // …and those bare callers must still exist, or this assertion is guarding nothing.
    const bareCalls = (code(awards).match(/void load\(\);/g) ?? []).length;
    assert.ok(
      bareCalls >= 3,
      `expected the write-triggered reloads to still call load() bare (found ${bareCalls}). If they `
      + 'now thread a predicate by hand, this guard is testing a shape that no longer carries risk '
      + '— but the generation counter must stay, because the NEXT caller will forget again.',
    );
  });

  it('the findings engine gets no "today" in a record', () => {
    assert.match(
      hub, /todayISO: isRecord \? undefined/,
      'the engine`s one time-relative rule ("$X due in 3 days") gates on todayISO. A deadline '
      + 'countdown against a season that ended is nonsense dressed as urgency.',
    );
  });
});

/**
 * ⚠⚠ THE TEAM'S SEASON-BY-SEASON HISTORY IS HEAD-COACH ONLY (owner ruling, 2026-08-16).
 *
 * The scrapbook — per-season record, roster size, tryout acceptance and money summaries — was
 * served to ANY coach who had ever staffed the team, for EVERY season, **including years before
 * they arrived and after they left**. Money figures were correctly per-year scoped; nothing else
 * was. Surfaced as pre-existing by this project's review, then ruled on.
 *
 * The ruling is deliberately the SIMPLE one — head coach, no tenure windows. Widening it is a
 * decision someone has to make on purpose, which is what this test is for.
 */
describe('the team scrapbook is head-coach only', () => {
  const historyRoute = readFileSync(
    join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'history', 'route.ts'),
    'utf8',
  );

  /**
   * ⚠ THE SERVER IS THE AUTHORITY. Hiding the section while still shipping the rows would leave a
   * team's whole history in a browser that is not allowed it — the distinction this repo draws
   * between "the client hides it" and "the server refuses it".
   */
  it('withholds the rows at the API, not just on the page', () => {
    assert.match(
      code(historyRoute), /const everHeadCoach = \[\.\.\.capsByYear\.values\(\)\]\.some\(c => c\.isHeadCoach\)/,
      'the history route must decide head-coach-ness from the per-season capability rows.',
    );
    assert.match(
      code(historyRoute), /everHeadCoach\s*\?[\s\S]{0,200}getRepTeamHistory[\s\S]{0,200}:\s*\[\[\], null\]/,
      'a coach who was never head coach must get NO history rows from the server — not rows the '
      + 'page then declines to draw.',
    );
    assert.match(
      code(historyRoute), /canViewSeasonHistory: everHeadCoach/,
      'the response must SAY whether history is permitted. "Allowed but empty" and "not allowed" '
      + 'need different words on screen — "None yet" would be a lie to an assistant on a team with '
      + 'three archived years.',
    );
  });

  it('hides the scrapbook section rather than showing an empty state', () => {
    assert.match(
      results, /\{page\.everHeadCoach && \(\s*<section/,
      'the "Past seasons" section must be ABSENT for a non-head-coach. An empty state under a '
      + '"Past seasons" heading tells them the team has none, which is false.',
    );
  });

  it('omits the past-seasons count on the Insights tile', () => {
    assert.match(
      hub, /const pastSeasonsClause = page\.everHeadCoach/,
      'the "N past seasons on file" clause must be omitted, not rendered as 0 — the server sends '
      + 'no history to a non-head-coach, so a count would be a fabricated zero.',
    );
  });

  /**
   * ⚠ HIDE THE ENTRY POINT. This door's entire promise is the cross-season list; leaving it for a
   * coach who cannot see that list is a door that succeeds while quietly not delivering — the
   * exact failure this project's Phase 1 review called out about this very link.
   */
  it("hides Season's End's \"Compare every season\" door for everyone else", () => {
    assert.match(
      read('season-end'), /\{page\.everHeadCoach && \(\s*\n?\s*<Link href=\{`\$\{base\}\/history\/results\$\{page\.query\}`\}/,
      'the "Compare every season" door must be hidden when the list behind it is not permitted.',
    );
  });

  it('asks the same question the server asks', () => {
    assert.match(
      readFileSync(join(process.cwd(), 'lib', 'coach-season-view.ts'), 'utf8'),
      /everHeadCoach: season\.options\.some\(o => o\.capabilities\?\.isHeadCoach === true\)/,
      'the client predicate must mirror the server exactly (ever head coach of THIS team, across '
      + 'seasons). A per-season test would show the scrapbook on one year and hide it on the next '
      + 'for the same person; a looser client test would draw a section the server will not fill.',
    );
  });
});

describe('the season survives every link the rail offers', () => {
  it('every Insights tile carries the year', () => {
    for (const dest of [
      '/history/results', '/attendance', '/accounting', '/history/awards', '/history/development',
    ]) {
      assert.ok(
        hub.includes(`\${base}${dest}\${seasonQuery}`),
        `the ${dest} tile drops the season. A tile is a door out of the season on screen — a bare `
        + 'href hands the coach a 2024 summary and then opens the live season to explain it.',
      );
    }
  });

  it('the callout links carry the year too', () => {
    assert.match(
      hub, /askReportHref\(base, f\.report\)\}\$\{seasonQuery\}/,
      'a finding is a sentence ABOUT the season on screen; its link must open that season.',
    );
  });

  /**
   * ⚠⚠ THE BACK LINK CAME BACK, and its premise is exactly what Phase 2 changed. Phase 1 removed
   * it in a record, correctly at the time: the archive nav pointed Insights straight at the
   * results page, so it was the destination rather than a drill-in, and a link claiming a parent
   * it did not have is the double-parent defect. The hub is the archive's door now, so the page
   * has a real parent in every season again.
   */
  it('the results page has a parent again, in every season, carrying the year', () => {
    assert.match(
      results, /<CoachBackLink href=\{`\$\{base\}\/history\$\{seasonQuery\}`\}>/,
      'the results page must link back to the hub in EVERY season now that the hub is the '
      + 'archive`s Insights door — and carry the year, or it returns to the live season`s hub.',
    );
    assert.equal(
      /page\.isReadOnly \? null : <CoachBackLink/.test(results), false,
      'the record-only suppression of the back link is retired: its premise (the archive routing '
      + 'around the hub) stopped being true in Phase 2.',
    );
  });

  /**
   * ⚠⚠ THE INBOUND LINKS ARE THE HALF THAT GETS MISSED. Twice on this rail, making a destination
   * season-aware silently invalidated a deliberately-bare link one level up — and each time the
   * only thing that made it findable was the REASON written beside the omission. Grep for inbound
   * links whenever a page joins the rail; a deliberate omission is only as durable as its reason.
   */
  it('every inbound link to a rail page carries the season', () => {
    const inbound: { label: string; source: string; needle: string }[] = [
      {
        label: 'the attendance report`s back link',
        source: read('attendance'),
        needle: '<CoachBackLink href={`${base}/history${seasonQuery}`}>',
      },
      {
        label: 'the awards report`s back link',
        source: awards,
        needle: '<CoachBackLink href={`${base}/history${seasonQuery}`}>',
      },
      {
        label: 'the certificate`s back link',
        source: certificate,
        needle: '<CoachBackLink href={`${base}/history/awards${seasonQuery}`}>',
      },
      {
        label: 'Season`s End "Compare every season"',
        source: read('season-end'),
        needle: '${base}/history/results${page.query}',
      },
    ];
    for (const { label, source, needle } of inbound) {
      assert.ok(
        source.includes(needle),
        `${label} drops the season. Its destination reads '?year=' — a bare link lands a coach `
        + 'reading a past season on the LIVE one, which is the exact cross-season mix-up this rail '
        + 'exists to end, re-entered through a link nobody re-examined.',
      );
    }
  });
});

/**
 * ⚠⚠ THE MENU IS NOT THE SET OF SECTIONS, and conflating them breaks the season switcher in BOTH
 * directions. This became true on 2026-08-16 and had never been true before, which is why the
 * switcher read the menu directly for as long as it did.
 */
describe('the archive nav and the archive`s actual sections are different questions', () => {
  it('Insights points at the HUB, not the results page', () => {
    const insights = CLOSED_TEAM_NAV_ITEMS.find(i => i.label === 'Insights');
    assert.ok(insights, 'the archive must keep an Insights door');
    assert.equal(
      insights!.href, '/history',
      'the archive`s Insights door is the hub. It pointed at /history/results only because the hub '
      + 'was live-season-only, and that single workaround is what forced Attendance to keep an '
      + 'archive-only nav entry it has in no live season.',
    );
  });

  it('Attendance left the menu and kept its access', () => {
    assert.equal(
      CLOSED_TEAM_NAV_ITEMS.some(i => i.label === 'Attendance'), false,
      'Attendance is reached through the Insights hub in both seasons now.',
    );
    assert.ok(
      archiveHasSection('/attendance'),
      'a finished season STILL HAS its attendance report — it is an approved archive door (D-F1) '
      + 'whose route and page are both season-aware. Losing the menu line must not lose the '
      + 'section, or the season switcher dumps a coach reading it onto Season`s End.',
    );
    assert.ok(
      CLOSED_SECTION_EXTRAS.includes('/attendance'),
      'the extras list is what keeps that true — it is the difference between the menu and the '
      + 'set of sections a finished season has.',
    );
  });

  /**
   * ⚠ THE SUBTLER HALF. `/history` is an archive door, and a prefix match on it sweeps in every
   * page beneath — including the two Insights reports a record deliberately hides. Without the
   * subtraction, the season switcher becomes the one control that reaches a hidden page.
   */
  /**
   * ⚠ A SECTION IS MATCHED ON A PATH BOUNDARY, not on shared letters (`/review` 2026-08-16).
   *
   * `archiveHasSection` began as a bare `startsWith`, which answers yes for `/rosterNotes` against
   * `/roster` — they share a prefix, not a parent. No such route exists today, and that is the
   * reason to pin it now rather than later: the failure mode is a future route silently classified
   * as archive-reachable (or silently hidden), with no type error and nothing visibly wrong.
   */
  it('matches a section on a path boundary, not on shared letters', () => {
    // Real shapes that MUST match: the section itself, a child route, and a query-tab.
    for (const s of ['/roster', '/roster/abc123', '/accounting?section=dues', '/lineups/42']) {
      assert.equal(archiveHasSection(s), true, `${s} is a real archive section or a child of one`);
    }
    // Near-misses that must NOT: same letters, different route.
    for (const s of ['/rosterNotes', '/schedule2', '/accountingX', '/historyBoard']) {
      assert.equal(archiveHasSection(s), false,
        `${s} merely shares a prefix with an archive door — it is not under one. A bare startsWith `
        + 'would misclassify it, silently.');
    }
    // And a section that is a strict PARENT of a door is not itself a door.
    assert.equal(archiveHasSection('/tryouts'), false,
      'only /tryouts/history is an archive door — the live tryout hub runs a tryout.');
  });

  /**
   * ⚠⚠ THE SECTIONS ARE NAMED HERE, NOT READ OUT OF THE LIST UNDER TEST — and that distinction was
   * found by mutation-testing this very assertion, which passed happily when
   * `/history/playing-time` was deleted from `LIVE_ONLY_ARCHIVE_SECTIONS`.
   *
   * A loop over the list can only ever check that its entries behave; it cannot notice an entry
   * that left. That is the guard going blind while reporting green — the same vacuous-pass class
   * `coach-season-write-guard.test.ts` grew a dedicated test for. Naming both paths makes deleting
   * one a failure, which is what a decision list is for.
   */
  it('a hidden report under an archive prefix is still hidden to the switcher', () => {
    for (const section of [
      PLAYING_TIME_SECTION,
      OPPONENTS_SECTION,
      // ⚠ Pre-existing, found by /review 2026-08-16: both are INSTRUMENTS ruled live-season-only
      // (owner 2026-08-01, build-enforced), and the Development hub hides both doors in a record —
      // but `/development` is an archive door, so the switcher reached them through the prefix.
      '/development/drills',
      '/development/templates',
    ]) {
      assert.ok(
        LIVE_ONLY_ARCHIVE_SECTIONS.includes(section),
        `${section} left LIVE_ONLY_ARCHIVE_SECTIONS. Every entry is a surface some OTHER control `
        + 'already hides in a record (owner rulings 2026-08-01, -08-04 and -08-16) — dropping one '
        + 'makes the season switcher the single control that still reaches it, showing the LIVE '
        + 'season under a past-season chip with nothing to say so.',
      );
      assert.equal(
        archiveHasSection(section), false,
        `${section} is reachable in an archive. It sits under an archive DOOR's prefix, so the `
        + 'match sweeps it in unless the live-only subtraction runs first.',
      );
    }
    // …while the archive doors themselves, and their archive-reachable children, stay reachable: a
    // prefix rule that hides too much is the same bug as one that hides too little.
    for (const section of [
      '/history', '/history/results', '/history/awards', '/history/development',
      '/development', '/development/sessions',
    ]) {
      assert.ok(
        archiveHasSection(section),
        `${section} is an archive door and must survive the live-only subtraction.`,
      );
    }
  });
});
