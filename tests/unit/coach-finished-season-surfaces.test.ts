/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A FINISHED SEASON SHOWS RECORDS AND PUTS THE INSTRUMENTS AWAY.
 *
 * ⚠ **This file replaces `coach-archive-season-rail.test.ts`** (retired 2026-08-16 with P2 of
 * COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md). That file asserted two different things at once, and
 * only one of them survived Design A:
 *
 *   · **Died with the feature** — every "this page resolves `?year=` from the URL", "this fetch
 *     carries the season", "this inbound link carries the season", and the whole
 *     archive-menu-vs-archive-sections pair. There is no season dial, so there is no season to
 *     carry, and the client half of that contract now lives as an ABSENCE in
 *     `coach-history-endpoint-guard.test.ts` ("only Season's End reads a year off the URL").
 *   · **Kept, and re-homed here** — everything about how a page behaves when the season it is
 *     showing has ENDED. That state did not go anywhere: a team between seasons has a finished
 *     WORKING season, and every record surface renders it. Plus the two probes that were about
 *     staleness and scoping rather than about switching.
 *
 * ⚠ Asserted over the FILES rather than by rendering, for the reason the old file gave and P2 is
 * only partly fixing: these are client components, and the rendered layout fixture had NO completed
 * season to draw them against. P2 adds one, so the sweep can finally see these screens — but a
 * shape-over-source guard still catches the class of defect a screenshot cannot (a fetch that is
 * still made, a flag that is no longer read).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const COACH_PAGES = join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]');
const read = (...seg: string[]) => readFileSync(join(COACH_PAGES, ...seg, 'page.tsx'), 'utf8');

/**
 * ⚠⚠ ABSENCE ASSERTIONS MUST READ CODE, NOT PROSE — found the hard way, by these very tests failing
 * on their first run.
 *
 * Every page here documents the defect it used to have, by name. A "this pattern must not appear"
 * check over raw source therefore fails on the EXPLANATION of the fix, which pressures the next
 * person into deleting the comment to make the test pass — the guard eating the only durable record
 * of why the code looks like this.
 *
 * So negatives run over code with comments removed. Block comments (where this repo's reasoning
 * lives, including JSX `{/* … *\/}`) and whole-line `//` comments go; trailing inline comments stay,
 * deliberately — stripping those needs string-awareness, and a `//` inside a URL would silently
 * swallow real code and turn this guard vacuous.
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
const seasonEnd = read('season-end');

describe('a record shows records, and puts the instruments away', () => {
  it('the awards report offers no way to give, manage or remove an award in a record', () => {
    for (const control of ['Give an award', 'Manage award types']) {
      const idx = awards.indexOf(control);
      assert.ok(idx > 0, `expected the "${control}" control to exist at all`);
      assert.ok(
        awards.slice(Math.max(0, idx - 700), idx).includes('!isRecord'),
        `"${control}" is not gated on the season. A finished season is a record: giving, managing `
        + 'and removing all ACT on a season and stay live-only. The server refuses them regardless '
        + '— this is the door, not the lock.',
      );
    }
    assert.match(
      awards, /\{!isRecord && \(\s*<button\s*\n\s*title="Remove"/,
      'removing an award UNDOES a night that happened — it must be absent in a record.',
    );
  });

  /**
   * ⚠ The keepsake is the deliberate exception, and it is worth pinning so a later tidy-up does not
   * "consistently" remove it: printing a certificate reproduces something that already happened,
   * which is precisely what a coach opens a finished season to do.
   *
   * ⚠ The `?year=` this link used to carry is GONE (P2) — and correctly, because the certificate
   * and the awards report now describe the same one season, the team's working one. The half that
   * still matters is that the certificate names the season the award was WON in rather than
   * whatever the coach's live assignment says, which is the defect that produced this test.
   */
  it('printing a certificate survives in a record, and names the right season', () => {
    assert.ok(
      awards.includes('certificate?awardId=${a.id}'),
      'the per-award print link must still exist — a certificate is a keepsake, and reproducing '
      + 'one is what a coach opens a finished season to do.',
    );
    assert.match(
      certificate, /page\.programYearName/,
      'the certificate must name the season the award was WON in. It printed the coach\'s CURRENT '
      + 'programYearName, which puts this year on a certificate for a past year\'s award.',
    );
    assert.equal(
      /assignment\.teamName|assignment\.programYearName/.test(code(certificate)), false,
      'the certificate must not read the live assignment for its printed facts.',
    );
  });

  /**
   * ⚠ Past tense, and no promise of anything arriving — nothing will, the season is over. Teaching
   * a coach how to fill in a season that has ended is the mistake the results page and the
   * attendance report both corrected first.
   */
  it('empty states in a record do not promise a future', () => {
    assert.match(hub, /isRecord \? 'This season was never filled in'/,
      'the hub\'s empty state must not teach a coach how to fill in a season that has ended.');
    assert.match(awards, /isRecord \? 'No awards were given'/,
      'the awards empty state must not point at a button a record does not have.');
    assert.match(results, /page\.isReadOnly \? 'No results were recorded' : 'No results yet'/,
      'the results empty state must be past tense in a record.');
  });

  it('the hub hides the Ask bar in a record', () => {
    assert.match(
      code(hub), /\{!isRecord && assignment && \(\s*<CoachAskBar/,
      'the Ask bar is an INSTRUMENT: it answers from the ACTIVE season by omission, taking no year '
      + 'anywhere. On a finished season every answer it gave would be about a different one.',
    );
  });

  it('the findings engine gets no "today" in a record', () => {
    assert.match(
      hub, /todayISO: isRecord \? undefined/,
      'the engine\'s one time-relative rule ("$X due in 3 days") gates on todayISO. A deadline '
      + 'countdown against a season that ended is nonsense dressed as urgency.',
    );
  });

  it('the results report hides its tag filter in a record', () => {
    assert.match(
      code(results), /const tagChips = page\.isReadOnly \? \[\]/,
      'game tags are a LIVE vocabulary the coach renames, merges and deletes as the season goes. '
      + 'Offering a finished season\'s games filtered by a tag invented last week is a page quietly '
      + 'answering a question nobody could have asked that year.',
    );
  });

  /**
   * ⚠⚠ THE GUARD MUST NOT BE OPT-IN, because an opt-in guard gets forgotten — and it was, three
   * times, found by `/review` 2026-08-16.
   *
   * The awards page's `load()` took an `isStale` predicate with a NO-OP DEFAULT, so only callers
   * that remembered to pass one were protected. The mount effect remembered; the three
   * write-triggered reloads (remove an award, and both modals' `onChanged`) did not.
   *
   * ⚠ The season switcher was the TRIGGER that made this reachable, and the switcher is gone — but
   * the guard stays, and deliberately. The property it pins is not "a season change can strand the
   * page"; it is "a caller CANNOT fail to be guarded". Team switching, a refresh and a write-driven
   * reload all still race, and the next caller will forget again.
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
    const bareCalls = (code(awards).match(/void load\(\);/g) ?? []).length;
    assert.ok(
      bareCalls >= 3,
      `expected the write-triggered reloads to still call load() bare (found ${bareCalls}). If they `
      + 'now thread a predicate by hand, this guard is testing a shape that no longer carries risk '
      + '— but the generation counter must stay, because the NEXT caller will forget again.',
    );
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE LOOK-BACK LAYER — three destinations, and who may open them.
 *
 * With the archive deleted as a place, a coach reaches a finished season three ways: Season's End,
 * Season Wrapped, and the compare list at the bottom of the results report. That makes the compare
 * list load-bearing rather than a nice extra, which is why its gate is pinned here.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('the look-back layer', () => {
  /**
   * ⚠⚠ EVERY CURRENT MEMBER SEES THE COMPARE LIST (owner ruling, reverted with Design A on
   * 2026-08-16). The head-coach-only restriction shipped hours earlier the same day as a FLOOR,
   * while access was still per-season and an ex-coach could still read the whole book. M1 removed
   * that premise — only current staff hold a membership at all — so narrowing the team's own
   * scrapbook was gating the wrong thing. Money figures inside stay money-gated server-side.
   */
  it('the compare list is not gated to head coaches on either side', () => {
    assert.equal(/everHeadCoach/.test(results), false,
      'the results page still gates its "Past seasons" list on being a head coach. That '
      + 'restriction was REVERTED with Design A — every current member of the staff sees the '
      + 'seasons the team has played.');
    assert.equal(/everHeadCoach/.test(seasonEnd), false,
      'Season\'s End still gates its "Compare every season" door. That door exists FOR the list; '
      + 'gating one without the other is how a link succeeds while quietly not delivering.');

    const historyRoute = readFileSync(
      join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'history', 'route.ts'),
      'utf8',
    );
    assert.equal(/everHeadCoach/.test(code(historyRoute)), false,
      'the history route still withholds the rows from anyone but a head coach. The client and the '
      + 'server must answer the same question — a client that shows the section over a server that '
      + 'withholds the rows is the "None yet" lie about a team with three archived years.');
  });

  it('Season’s End links to the compare list, and the list links back per season', () => {
    assert.match(seasonEnd, /Compare every season/,
      'Season\'s End must keep its door into the cross-season list — it is one of only three ways '
      + 'a coach reaches a finished season at all.');
    assert.match(results, /\$\{base\}\/season-end\?year=\$\{y\.id\}/,
      'each row of the compare list must link to THAT season\'s Wrapped. This is the only link in '
      + 'the portal that names a season other than the working one, and it is why `?year=` still '
      + 'exists on Season\'s End and the wrapped route.');
  });

  /**
   * ⚠ Season's End can be handed an OLDER year while the team is mid-season, so it must not read
   * "is this a record?" off the working season. It also must not silently answer a bare visit with
   * some other year's story — the hidden season choice P2 exists to delete.
   */
  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * THE PRACTICES SHELF (P3 C3, owner-approved 2026-08-16 from the gated mockup session).
   *
   * ⚠ The binding constraint of every shelf phase is that the LIVE screens stay as they were
   * (CLAUDE.md §1.6: a shelf that makes the live screen noisier is a failed design). These pin the
   * three properties that make that true, plus the two ways the shelf could quietly lie.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  it('the practices shelf is COLLAPSED by default', () => {
    assert.match(
      seasonEnd, /sectionId="season-practices"[\s\S]{0,300}defaultOpen=\{false\}/,
      'the practices section must arrive closed. The current season is always the primary focus '
      + '(owner ruling, CLAUDE.md §1.6) — an open shelf pushes Season Wrapped, which is what a '
      + 'coach opens this page for, below the fold.',
    );
  });

  /**
   * ⚠ Season's End gates on `hasRecordAccess`; the plan door has ALWAYS also required
   * `canViewSchedule`, so a helper who runs one station cannot type the URL. A second entry point
   * inheriting the LOOSER gate is how a closed door gets reopened from the side.
   */
  /**
   * ⚠ **ASSERTED AS A SHARED SYMBOL, NOT AS A SHAPE** (rewritten by P3 C3's `/simplify`). This test
   * first matched the raw expression `canViewSchedule(…) && hasRecordAccess(…)` at each site — a
   * test compensating for duplication rather than one proving a rule. Now the pair has ONE home
   * (`canReadPastPracticePlans`), and what is worth pinning is that all three sites call it: a
   * reordered or half-dropped conjunction is no longer expressible.
   */
  it('the practices shelf carries the plan door’s gate, not Season’s End’s', () => {
    const routeOf = (...seg: string[]) => readFileSync(
      join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', ...seg, 'route.ts'), 'utf8');

    assert.match(
      seasonEnd, /const mayReadPractices = [\s\S]{0,220}canReadPastPracticePlans\(/,
      'the section must gate on canReadPastPracticePlans. Season\'s End\'s own gate is wider, and '
      + 'the route behind every row refuses the difference — a section rendered over a route that '
      + 'will refuse it is the broken-page outcome this page exists to avoid.',
    );
    for (const [label, src] of [
      ['the season list', routeOf('season-practices')],
      ['the plan read route', routeOf('events', '[eventId]', 'practice-plan', 'read')],
    ] as const) {
      assert.match(
        code(src), /canReadPastPracticePlans\(capabilities\)/,
        `${label} must enforce the same predicate. The client half above is the door; these are `
        + 'the locks, and a helper must be refused whether or not the section rendered.',
      );
    }

    /**
     * ⚠ And the predicate itself still means what its three callers believe: a HELPER holds the
     * schedule and nothing else, so the conjunction — not either half — is what shuts the door.
     */
    const caps = readFileSync(join(process.cwd(), 'lib', 'coach-capabilities.ts'), 'utf8');
    assert.match(
      code(caps), /export const canReadPastPracticePlans = \(c: CoachCapabilities\) =>\s*canViewSchedule\(c\) && hasRecordAccess\(c\);/,
      'canReadPastPracticePlans must stay the conjunction. Relaxing it to either half alone hands '
      + 'a parent volunteer who ran one station last spring the whole season\'s plans.',
    );
  });

  /**
   * ⚠⚠ A LIST HEADED "the practices you ran" THAT TRUNCATES SILENTLY LIES ABOUT A SEASON — it
   * tells a coach they ran fewer practices than they did, which is the one dishonesty this shelf
   * is capable of. Season-scoping makes hitting the cap unlikely; it does not make the cap honest.
   */
  it('the practices shelf states its truncation instead of hiding it', () => {
    const route = readFileSync(
      join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'season-practices', 'route.ts'),
      'utf8',
    );
    assert.match(
      code(route), /limit: MAX_ROWS \+ 1[\s\S]{0,600}truncated = all\.length > MAX_ROWS/,
      'the route must ask for one MORE row than it shows, so it can tell a full page from a '
      + 'truncated one. Reading exactly the cap makes the two indistinguishable. ⚠ It is read off '
      + 'the RAW result (`all`), before the empty-row filter — see the sibling assertion.',
    );
    assert.match(
      seasonEnd, /practicesTruncated && \(/,
      'the page must render the truncation notice. A flag computed and never shown is the silent '
      + 'cap with extra steps.',
    );
  });

  /**
   * ⚠ A cancelled practice DID NOT HAPPEN. The exclusion lives in the shared read so the report's
   * list, this shelf and the route behind every row inherit ONE definition — a second copy is how
   * a called-off night ends up in the record complete with who was assigned where.
   */
  it('a cancelled practice cannot reach the shelf, and the rule has one home', () => {
    const db = readFileSync(join(process.cwd(), 'lib', 'db.ts'), 'utf8');
    assert.match(
      db, /export async function getRepTeamPracticesWithPlanOrRecap[\s\S]{0,1600}\.neq\('status', 'cancelled'\)/,
      'the shared read must exclude cancelled practices. Cancelling only flips `status`; it never '
      + 'clears the plan or the recap, so without this the record asserts a night that never took '
      + 'place.',
    );
    const route = readFileSync(
      join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'season-practices', 'route.ts'),
      'utf8',
    );
    assert.match(
      code(route), /getRepTeamPracticesWithPlanOrRecap\(/,
      'the shelf must read through the shared function rather than querying events itself — that '
      + 'is what keeps the cancelled rule, and the plan-or-recap rule, in one place.',
    );
  });

  /**
   * ⚠ The back link hard-coded ONE destination while it had one caller. C3 gave it a second, and a
   * hard-coded link would have returned a coach reading a finished season to a report about the
   * team's WORKING one — silently, because both pages render perfectly.
   */
  it('the past-plan page returns to whichever list sent the coach, carrying the season', () => {
    const plan = readFileSync(
      join(COACH_PAGES, 'history', 'development', 'practices', '[eventId]', 'page.tsx'), 'utf8',
    );
    assert.match(
      plan, /searchParams\.get\('from'\) === 'season-end'/,
      'the origin must be explicit. Inferring it from the presence of `year` drops the everyday '
      + 'between-seasons case, where Season\'s End shows the team\'s own working season and '
      + 'carries no year at all.',
    );
    assert.match(
      code(plan), /cameFromSeasonEnd \? \(\s*<CoachBackLink href=\{`\$\{base\}\/season-end/,
      'a coach who arrived from Season\'s End must be sent back to Season\'s End.',
    );
    assert.match(
      code(plan), /practice-plan\/read`\s*\+ \(yearParam \?/,
      'the read must carry the year, or a plan from a season the team has rolled past 404s.',
    );
    assert.match(
      seasonEnd, /\?from=season-end\$\{practiceSeasonId \? `&year=/,
      'Season\'s End must send both halves — the year the row belongs to, and where it came from.',
    );
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * THE FOUR DEFECTS `/review` FOUND IN THE SHELF (2026-08-16), pinned so they stay fixed.
   *
   * ⚠ Every one of them is a page or a row telling the coach something that is not true about
   * WHICH SEASON, or about what a practice holds — the two things this whole phase is for. None
   * would have shown as an error; each renders perfectly while being wrong.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  it('the shelf clears itself before refetching, so it cannot lag a season behind the page', () => {
    assert.match(
      code(seasonEnd),
      /setPractices\(null\);\s*setPracticeSeasonId\(null\);\s*setPracticesTruncated\(false\);\s*fetch\(/,
      'the practices effect must clear its state BEFORE fetching. Its `cancelled` flag only stops '
      + 'an old answer overwriting a new one — it does nothing about the old answer already on '
      + 'screen. Season\'s End hides the Wrapped card while refetching, so on a year change Wrapped '
      + 'can land first and render the new season beside the PREVIOUS season\'s practices, each row '
      + 'linking with the previous season\'s id.',
    );
  });

  it('a row never claims a note the practice does not have', () => {
    const route = readFileSync(
      join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'season-practices', 'route.ts'),
      'utf8',
    );
    assert.match(
      code(route), /\.filter\(e => \(e\.practicePlan\?\.blocks\.length \?\? 0\) > 0 \|\| !!e\.practiceRecap\)/,
      'the route must drop practices that carry neither a real plan nor a recap. A plan row is '
      + 'written the moment a coach types a GOAL — blockless — so "practice_plan IS NOT NULL" is '
      + 'not the same question as "there is something to read here".',
    );
    assert.match(
      code(route), /const truncated = all\.length > MAX_ROWS;/,
      'truncation must be read off the RAW result. Asking the filtered list would let a couple of '
      + 'dropped empty rows retract a truncation notice the season genuinely earned.',
    );
    assert.match(
      code(seasonEnd), /p\.hasRecap\s*\?\s*'No plan written — your note about how it went'\s*:\s*'No plan written'/,
      'the planless label must READ hasRecap rather than assume it. The flag was on the payload and '
      + 'unused, while the label asserted a note existed.',
    );
  });

  /**
   * ⚠ These two pages do NOT unmount when only the `[teamId]` / `[eventId]` segment changes — the
   * team layout renders `{children}` with no key. Every fetch on them therefore needs a generation,
   * and the picker needs its CACHE invalidated too: it answers "have I asked?" with a null check
   * that knows nothing about which team it asked for.
   */
  it('the picker’s past-season cache belongs to one team, and its fetch carries a generation', () => {
    const editor = readFileSync(join(COACH_PAGES, 'practice', '[eventId]', 'page.tsx'), 'utf8');
    assert.match(
      code(editor), /pastSeqRef\.current \+= 1;\s*setPastPlans\(null\);/,
      'the cache must reset when the team changes. Without it the "already asked" check refuses to '
      + 'refetch and offers TEAM A\'s past practices while planning team B — and copying one writes '
      + 'A\'s words into B\'s plan through the autosave.',
    );
    assert.match(
      code(editor), /const seq = \+\+pastSeqRef\.current;[\s\S]{0,900}seq !== pastSeqRef\.current/,
      'loadPastPlans must stamp and check a generation, like the main load\'s loadSeqRef beside it.',
    );
  });

  it('the past-plan page cannot be painted by a request for a practice the coach has left', () => {
    const plan = readFileSync(
      join(COACH_PAGES, 'history', 'development', 'practices', '[eventId]', 'page.tsx'), 'utf8',
    );
    assert.match(
      code(plan), /const myRun = \+\+runRef\.current;[\s\S]{0,900}runRef\.current !== myRun/,
      'this page had no stale guard at all. Before it could be handed a year the worst case was two '
      + 'events inside one season; with `?year=` the same race paints one season\'s plan under '
      + 'another season\'s header and back link.',
    );
  });

  it('Season’s End distinguishes the working season from a year it was handed', () => {
    assert.match(seasonEnd, /const showingWorkingSeason = !yearParam \|\| yearParam === page\.season\?\.programYearId;/,
      'Season\'s End must know whether the year on screen IS the working one — the page\'s copy '
      + 'and its promise about the menu both depend on it.');
    assert.match(seasonEnd, /if \(seasonStillUnderWay\) \{/,
      'a bare visit while the season is still running must say so, not quietly show the newest '
      + 'finished season\'s Wrapped under a heading that names no year.');
  });
});
