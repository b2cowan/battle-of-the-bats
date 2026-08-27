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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const COACH_PAGES = join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]');
const read = (...seg: string[]) => readFileSync(join(COACH_PAGES, ...seg, 'page.tsx'), 'utf8');

/**
 * Every `.tsx` under the team segment — pages AND the panels they render, because the read-only
 * branches this file guards against lived in both (`accounting/dues/panel.tsx` held one).
 */
function pageFilesUnder(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) pageFilesUnder(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

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

// ⚠ The Insights hub no longer appears here: every assertion that read it was about the
// finished-season copy of that page, which is deleted (2026-08-18). The hub's live behaviour is
// covered by its own tests; what replaced these is "a closed season is one page" below.
/**
 * ⚠ **THESE TWO ARE `panel.tsx`, NOT `page.tsx`** (reports portal P1, 2026-08-18). Insights became
 * one tabbed page, so each report's body moved into a panel the hub mounts, and every `page.tsx`
 * beside it is now a four-line permanent redirect. Reading the page file here would have passed a
 * `readFileSync` and then asserted against a redirect stub — every match failing for a reason that
 * has nothing to do with what these tests are about.
 */
const panel = (...seg: string[]) => readFileSync(join(COACH_PAGES, ...seg, 'panel.tsx'), 'utf8');
const results = panel('history', 'results');
const awards = panel('history', 'awards');
/** Still a real page — the certificate is its own printable route, not a tab. */
const certificate = read('history', 'awards', 'certificate');
const seasonEnd = read('season-end');

describe('the keepsakes a finished season is opened for', () => {
  /**
   * ⚠⚠ **FIVE ASSERTIONS WERE DELETED FROM THIS BLOCK ON 2026-08-18**, and the deletion is the
   * change rather than a casualty of it. They pinned that a finished season hid "Give an award",
   * "Manage award types" and the per-row Remove; that four empty states switched to the past tense;
   * that the Ask bar vanished; that the findings engine lost "today"; and that the results report
   * dropped its tag filter. Every one described a read-only copy of a live screen — the state the
   * owner deleted. A closed season is one page, and the live screens are not rendered for it at
   * all, which is asserted in "a closed season is one page" below.
   *
   * ⚠ What survives here is the half that was never about read-only: a certificate is a KEEPSAKE,
   * and reproducing one is what a coach opens a finished season to do.
   */

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

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════════
   * ⚠⚠ **THE COMPARE LIST IS DELETED, AND THIS TEST NOW GUARDS ITS ABSENCE** (owner, 2026-08-19).
   *
   * It previously asserted the opposite — that Season's End kept a "Compare every season" door and
   * that the Results report ended in a season-by-season list linking to each year's own page. The
   * owner removed the list ("that doesn't need to be there" — a report about THIS season has no
   * business ending in a table of every other one), and the door went with it in the same change
   * because a door onto a list that no longer exists is the loop-back defect this page was already
   * fixed for once, on the first walk of 2026-08-18.
   *
   * ⚠ **THE CONSEQUENCE IS ACCEPTED, NOT OVERLOOKED:** while a season is RUNNING there is now no
   * route to a previous season's page. Look-back happens once a season closes, when this page
   * becomes the team's one door. Anyone re-adding a compare list to a live screen is reopening a
   * settled decision — which is exactly what this test exists to make them notice.
   * ══════════════════════════════════════════════════════════════════════════════════════════════
   */
  it('no live screen has re-grown a cross-season compare list', () => {
    assert.equal(
      /Compare every season/.test(seasonEnd), false,
      'Season\'s End has re-grown its "Compare every season" door. The list it opened is deleted, so '
      + 'this is a door onto nothing — the loop-back defect this page was already fixed for.',
    );
    assert.equal(
      /Past seasons/.test(results), false,
      'the Results report has re-grown its past-seasons list. It describes ONE season by decision; a '
      + 'season-by-season table belongs to the closed-season page, not to a live report.',
    );
    /**
     * ⚠ `?year=` is NOT retired with it, and that is deliberate. Season's End still reads a year —
     * it is an approved history page in `coach-history-endpoint-guard.test.ts` — and the roll-forward
     * modal still hands it one so a coach who has just started next season can open the one they
     * finished. That single caller is now the whole reason the parameter exists; if it ever goes,
     * the parameter is genuinely dead and should be reconsidered rather than left lying around.
     */
    const modal = readFileSync(
      join(process.cwd(), 'components', 'coaches', 'StartNextSeasonModal.tsx'), 'utf8',
    );
    assert.match(
      modal, /season-end\?year=\$\{encodeURIComponent\(summary\.previousSeason\.id\)\}/,
      'the roll-forward modal is now the ONLY surface that names a season other than the working '
      + 'one. Losing it would leave `?year=` on Season\'s End with no caller at all.',
    );
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
    /* ⚠ RE-AIMED, NOT RELAXED (back-in-header amendment, 2026-08-26). The way out stopped being a
       row above the page and became the ARROW in the page header's leading corner, so this used to
       read `<CoachBackLink href=…>` and now reads a `backTo` destination. The CLAIM is unchanged
       and is the only thing that ever mattered: the season-end href hangs off the TRUE side of
       `cameFromSeasonEnd`. Pinning markup rather than the claim is why this line needed touching
       at all — worth remembering the next time a guard is written against a shape. */
    assert.match(
      code(plan), /cameFromSeasonEnd\s*\?\s*\{\s*href: `\$\{base\}\/season-end/,
      'a coach who arrived from Season\'s End must be sent back to Season\'s End.',
    );
    /* And the header carrying that arrow must sit ABOVE the loading/error fork: an arrow inside a
       header rendered only in the content branch leaves a still-loading or failed plan with no way
       back at all — this page's own comment calls its link "THE ONLY LINK OUT". */
    assert.match(
      code(plan), /backTo=\{backTo\}[\s\S]{0,120}\{loading \?/,
      'the past-plan page header must render above the loading/error fork, or the two states that '
      + 'are not the plan lose their way out.',
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
    /**
     * ⚠ **ASSERTED AS "EVERYTHING IS CLEARED", NOT AS A FIXED SEQUENCE** (widened 2026-08-18). The
     * original regex pinned three setters in one order and broke the moment a fourth arrived with
     * the summary strip — which is a guard testing its own transcription rather than the property.
     * The property is that NO practices state survives into a new season's answer, so the check is
     * that every `setPractices*` clear happens between the effect's start and its `fetch(`.
     */
    const practicesEffect = code(seasonEnd).slice(
      code(seasonEnd).indexOf('setPractices(null);'),
      code(seasonEnd).indexOf('/season-practices'),
    );
    for (const setter of ['setPractices(null)', 'setPracticeSeasonId(null)', 'setPracticesTruncated(false)', 'setPracticesSummary(null)']) {
      assert.ok(
        practicesEffect.includes(setter),
        `${setter} must run BEFORE the practices fetch. Anything left behind is the previous `
        + 'season\'s answer sitting under the new season\'s card.',
      );
    }
    assert.match(
      code(seasonEnd),
      /setPractices\(null\);[\s\S]{0,400}fetch\(/,
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

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * THE CLOSED MONEY BOOK (P4, owner-approved 2026-08-17) — the second and LAST shelf.
   *
   * ⚠ Its whole risk is one sentence: the statement's figures are DOORS on the live screen, and a
   * record must not be an entrance to a live editor. The route cannot enforce that — it hands back
   * the full payload the live panel needs — so the constraint lives on the caller, and therefore
   * here.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  it('the money shelf is COLLAPSED, and its shut face already answers the question', () => {
    assert.match(
      seasonEnd, /sectionId="season-statement"[\s\S]{0,400}defaultOpen=\{false\}/,
      'the statement must arrive closed. The live content is always the primary focus (CLAUDE.md '
      + '§1.6) — a shelf that makes the screen noisier is a failed design however useful it is.',
    );
    assert.match(
      seasonEnd, /meta=\{statement\.expenses\.variance === 0[\s\S]{0,200}under[\s\S]{0,40}over/,
      'the shut face must carry the under/over summary. "Did we come in under?" is usually the '
      + 'whole question, and answering it on the closed face is what keeps the section shut.',
    );
  });

  /**
   * ⚠⚠ THE ONE THAT MATTERS. Two of the live statement's own drill-in links were dead for two days
   * in the week this shipped and nobody noticed — which is exactly how little attention a wrong
   * destination attracts here.
   */
  it('nothing in the closed money book is a link into a live editor', () => {
    const shelf = seasonEnd.slice(
      seasonEnd.indexOf('sectionId="season-statement"'),
      seasonEnd.indexOf('── The one door off this page ──'),
    );
    assert.ok(shelf.length > 400, 'expected to find the statement shelf to inspect');
    for (const forbidden of ['<Link', 'href=', 'moneySectionHref', 'onClick']) {
      assert.equal(
        code(shelf).includes(forbidden), false,
        `the statement shelf renders "${forbidden}". It must be FLAT — figures and nothing else. On `
        + 'the live screen these same cells open the budget editor and a month chooser; a closed '
        + 'season must not be a door into an instrument it cannot write to.',
      );
    }
  });

  /**
   * ⚠ THREE gates now live on this page — the page, the practices shelf, the money shelf — and they
   * are three DIFFERENT questions. An assistant with attendance and lineups but no money access
   * reads the practices and must not read the books.
   */
  it('the money shelf keys on money access, not on the practices shelf’s gate', () => {
    assert.match(
      seasonEnd, /const mayReadMoney = [\s\S]{0,160}canViewMoney\(page\.capabilities\)/,
      'the statement must gate on canViewMoney. Inheriting the practices shelf\'s gate would show '
      + 'the team\'s books to every assistant who can read a practice plan.',
    );
    assert.equal(
      /const mayReadMoney = [\s\S]{0,160}canReadPastPracticePlans/.test(seasonEnd), false,
      'the two shelves must not share a gate — they answer different questions about the reader.',
    );
    const route = readFileSync(
      join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'budget-vs-actual', 'route.ts'),
      'utf8',
    );
    assert.match(
      code(route), /denyUnless\(canViewMoney\(capabilities\)/,
      'and the route must enforce it. The client half above is the door; this is the lock.',
    );
  });

  /**
   * ⚠ ONE ARITHMETIC. A second "season statement" endpoint would be a second walk of the same
   * records — the defect fixed on 2026-08-17, when the statement, the Months grid and the chart
   * turned out to be three independent walks and two of them disagreed.
   */
  it('the closed book reads the LIVE statement route, not a copy of it', () => {
    assert.match(
      seasonEnd, /fetch\(`\/api\/coaches\/\$\{orgSlug\}\/teams\/\$\{teamId\}\/budget-vs-actual\$\{yearParam/,
      'the shelf must call budget-vs-actual with the year. A season\'s figures must not depend on '
      + 'which screen asked — there is one rollup, and it stays one.',
    );
    assert.match(
      code(seasonEnd), /setStatement\(null\);\s*fetch\(/,
      'and it must clear before refetching, for the reason the practices shelf already records: a '
      + 'cancelled flag stops a stale answer landing, not a stale answer already on screen.',
    );
  });

  it('the closed-season page distinguishes its own season from a year it was handed', () => {
    assert.match(seasonEnd, /const showingOwnClosedSeason = !yearParam;/,
      'the page must know whether it is showing the team\'s OWN closed season or a year the compare '
      + 'list named. The reopen offer depends on it: reopening acts on the team\'s newest closed '
      + 'season, so offering it while an OLDER year is on screen would act on a different season '
      + 'from the one the coach is reading.');
    assert.match(seasonEnd, /if \(seasonStillUnderWay\) \{/,
      'a bare visit while the season is still running must say so, not quietly show the newest '
      + 'finished season\'s Wrapped under a heading that names no year.');
    assert.match(seasonEnd, /const showReopen = showStartNext && showingOwnClosedSeason;/,
      'the reopen offer must require BOTH: the team has no live season, and the page is showing '
      + 'that team\'s own closed season.');
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * **THE TWO NEW SHELVES** (2026-08-18). Results and the roster join the practices and the money
   * book, on exactly the same terms — collapsed, and flat.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  for (const [sectionId, label] of [
    ['season-results', 'Results'],
    ['season-roster', 'The roster'],
  ] as const) {
    it(`the ${label} shelf is COLLAPSED by default`, () => {
      assert.match(
        seasonEnd, new RegExp(`sectionId="${sectionId}"[\\s\\S]{0,300}defaultOpen=\\{false\\}`),
        `the ${label} section must arrive closed. The season's story is what a coach opens this `
        + 'page for (owner ruling, CLAUDE.md §1.6) — an open shelf pushes it below the fold.',
      );
    });
  }

  /**
   * ⚠⚠ **FLAT, AND THE ROSTER SHELF IS THE ONE THAT MATTERS MOST.** A player row that opened a
   * profile would be a record acting as a door into the busiest instrument in the portal — dues,
   * documents, development, guardians, medical. The route behind it cannot enforce this; only the
   * caller can, which is why it is asserted here.
   */
  it('no row of the results or roster shelf is a link', () => {
    for (const [sectionId, until] of [
      ['season-results', 'sectionId="season-roster"'],
      ['season-roster', '── "The practices you ran"'],
    ] as const) {
      const shelf = seasonEnd.slice(seasonEnd.indexOf(`sectionId="${sectionId}"`), seasonEnd.indexOf(until));
      assert.ok(shelf.length > 400, `expected to find the ${sectionId} shelf to inspect`);
      for (const forbidden of ['<Link', 'href=', 'onClick']) {
        assert.equal(
          code(shelf).includes(forbidden), false,
          `the ${sectionId} shelf renders "${forbidden}". It must be FLAT — a record must not be an `
          + 'entrance to a live instrument, and on the live screens these same rows open the game, '
          + 'the lineup, the attendance sheet and the player profile.',
        );
      }
    }
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * **THE LONG SHELVES SUMMARISE BEFORE THEY LIST** (owner design gate 2026-08-18, mockup
   * `bed11050`). A real season is 26 games and 44 practices; the seeded fixture is 4 and 2, which
   * is why the flat lists looked fine and were not.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */

  /**
   * ⚠⚠ **THE SUMMARY IS COMPUTED OVER EVERY ROW THE SEASON HOLDS, NEVER OVER THE PAGE OF ROWS THE
   * SHELF SHOWS.** Both routes cap their list. A record — or a season's focus — derived from the
   * rows that happened to fit is a different season's, and it is wrong in the direction nobody
   * checks: quietly a few games short, on the page a coach opens once a year to find out how the
   * season went. This is why the arithmetic is on the SERVER and not in the browser.
   */
  it('both summaries are computed before the row cap, not after it', () => {
    const routeOf = (seg: string) => readFileSync(
      join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', seg, 'route.ts'), 'utf8');

    /**
     * ⚠ Asserted over the summary OBJECT, not by proximity. The first version of this check tested
     * that `shown` did not appear within 400 characters of `byType:` — which passed only because an
     * unrelated field happened to sit between them, and failed the moment that field was removed.
     * A guard keyed on distance is testing its own transcription; the property is that NOTHING in
     * the summary reads the capped list.
     */
    /**
     * ⚠ Deliberately NOT called `results` — this file already has a module-level `results` holding
     * the results PAGE, and an earlier draft of this test shadowed it away, then lost the local
     * binding in an edit and silently began asserting against the wrong file. A guard reading the
     * wrong source is the vacuous pass this suite has a whole test about.
     */
    const resultsRoute = code(routeOf('season-results'));
    const summaryBlock = resultsRoute.slice(
      resultsRoute.indexOf('summary: {'),
      resultsRoute.indexOf('games: shown.map'),
    );
    assert.ok(summaryBlock.length > 200, 'expected to find the results summary block to inspect');
    assert.equal(
      summaryBlock.includes('shown'), false,
      'the results summary reads the capped list. Every figure in it — the record, the competition '
      + 'split, home/away, scoring — must be computed over `games`, every decided game the season '
      + 'holds. A record built from the rows that happened to fit is a different season\'s record, '
      + 'and wrong in the direction nobody checks.',
    );
    assert.match(
      summaryBlock, /WLT_CATEGORIES\s*\n?\s*\.map\(/,
      'the competition split must be DERIVED from WLT_CATEGORIES, not hand-listed. Writing the '
      + 'three keys out again recreates exactly the "convention two files must agree by hand" that '
      + '`lib/coach-season-record.ts` exists to end — and the page\'s own label lookup reads that '
      + 'list, so a hand-written server copy is the two halves already disagreeing.',
    );

    const practices = code(routeOf('season-practices'));
    assert.match(
      practices, /total: events\.length/,
      'the practices summary must count `events` (every written-up night), not `shown`.',
    );
    assert.match(
      practices, /getRepTeamEventTagsByKind\(events\.map/,
      'and the tag read must cover every row too — "what you worked on" computed from the rows '
      + 'that fit is a different season\'s focus.',
    );
  });

  /**
   * ⚠⚠ **"44" IS NOT THE SEASON'S PRACTICE COUNT, AND THE PAGE MUST NOT IMPLY IT IS.** This shelf
   * holds nights a coach WROTE SOMETHING ABOUT; a practice nobody wrote up never reaches it. A team
   * that ran sixty and planned forty-four would otherwise be told, by a bare number on a closed
   * season's page, that they ran forty-four. Found while drawing the mockup, fixed in the same
   * change — the kind of small lie that survives every test because nothing contradicts it.
   */
  it('the practices shelf says its number is nights WRITTEN UP', () => {
    assert.match(
      seasonEnd, /night\{practicesSummary\.total === 1 \? '' : 's'\} written up/,
      'the practices summary must qualify its count. A bare number reads as the season\'s practice '
      + 'count, which this shelf does not know.',
    );
  });

  /**
   * ⚠⚠ **THE PRACTICES SUMMARY IS A FLOOR, NOT A TOTAL, AND THE PAGE HAS TO SAY SO** (`/review`,
   * 2026-08-18). `getRepTeamPracticesWithPlanOrRecap` applies `.limit()` in the QUERY, so a season
   * past the cap yields a summary that silently undercounts — while `season-results` reads through
   * `getRepTeamEvents`, which has no limit, and genuinely is the whole season.
   *
   * That asymmetry is invisible at every realistic size and wrong at the one that matters, on the
   * page a coach opens once a year. The `+` is what keeps the number honest, and it is the SECOND
   * way this one figure learned to overstate itself — the first was reading as "practices run".
   */
  it('the practices summary marks itself as a floor when the read was capped', () => {
    for (const field of ['total', 'withPlan', 'withRecap']) {
      assert.match(
        seasonEnd, new RegExp(`practicesSummary\\.${field}\\}\\{practicesTruncated \\? '\\+' : ''\\}`),
        `${field} must print a "+" when the read was truncated. Every figure on that line comes `
        + 'from the same capped read, so any one of them left bare claims a total it cannot see.',
      );
    }
    /** ⚠ Including the TAG counts, which come from the same capped read and were briefly the only
     *  bare number left — two figures one line apart, one flagged as a floor and one not. */
    assert.match(
      seasonEnd, /t\.count\}\$\{practicesTruncated \? '\+' : ''\}/,
      'the tag counts must carry the "+" too — they are drawn from the same capped read as the '
      + 'counts directly beneath them.',
    );
  });

  /**
   * ⚠⚠ **AN "OF N" ON A RECORD MUST COUNT THE SEASON, NOT THE ROWS THAT ARRIVED** (`/review`,
   * 2026-08-18). The results list is capped; the summary is not. Using the received row count as
   * the denominator was wrong twice over on a long season — the caveat could suppress itself
   * (330 known is not `<` 300 shown) and, when it did render, it named the cap rather than the
   * season.
   */
  it('the results caveats count the whole season, never the rows received', () => {
    const strip = seasonEnd.slice(
      seasonEnd.indexOf('const seasonTitle'),
      seasonEnd.indexOf('THE TRUNCATION IS STATED'),
    );
    assert.ok(strip.length > 200, 'expected to find the results answer strip to inspect');
    assert.equal(
      /(scoresKnown|homeAwayKnown) < games\.length/.test(code(strip)), false,
      'a caveat is measuring itself against the CAPPED row list. Every denominator in the answer '
      + 'strip must come from the summary\'s own uncapped `totalGames`.',
    );
    assert.match(
      code(strip), /homeAwayKnown < resultsSummary\.totalGames/,
      'the home/away pair must disclose how many games it covers. A neutral site — or a game with '
      + 'no side recorded — falls into neither bucket, so the pair can quietly describe fewer '
      + 'games than the season held, exactly as the scoring clause beside it can.',
    );
  });

  /**
   * ⚠⚠ **ONE EVENT VOCABULARY IN THE COACH PORTAL.** A shield is a league game, a trophy a
   * tournament, swords a scrimmage, a dumbbell a practice — the marks a coach reads every week on
   * their own schedule. The closed-season page borrows them rather than inventing a second set,
   * which would be worst possible place to teach one: it is the page opened least often.
   *
   * ⚠ A second COPY of the map would drift silently — both screens render perfectly while
   * disagreeing about what amber means — so the guard is that nobody defines their own.
   */
  it('the coach portal has one event-type mark, and no surface redefines it', () => {
    const offenders: string[] = [];
    for (const file of pageFilesUnder(COACH_PAGES)) {
      const src = code(readFileSync(file, 'utf8'));
      if (/const EVENT_(COLORS|ICONS)\s*[:=]/.test(src)) {
        offenders.push(file.replace(process.cwd(), '').replace(/\\/g, '/'));
      }
    }
    assert.deepEqual(offenders, [],
      'A coach surface declared its own event-type icon or colour map. There is one, in '
      + '`components/coaches/eventTypeMark.tsx`, and the pair moves together on purpose: the icon '
      + 'says which type, the colour reinforces it, and a second copy drifts on exactly the axis a '
      + 'coach reads fastest.');
    assert.match(
      seasonEnd, /import \{ EventTypeMark \} from '@\/components\/coaches\/eventTypeMark'/,
      'the closed-season page must use the shared mark rather than naming types in words alone.',
    );
  });

  /**
   * ⚠ **A SHORT SEASON SKIPS THE MONTH LAYER.** Two month rows that each need a click to reveal
   * four nights is worse than a list of nine — the layer exists to shorten a long season, and below
   * three months it only adds a step.
   */
  it('the month layer is skipped for a season inside two months', () => {
    assert.match(
      code(seasonEnd), /if \(groups\.length < MONTH_GROUPING_MIN\) \{/,
      'SeasonMonths must fall back to a flat list for a short season.',
    );
  });

  /**
   * ⚠ **THE MONTH IS THE ORG'S, NEVER THE READER'S AND NEVER THE RAW STRING'S.** A Saturday-evening
   * game in Toronto is already the next day in UTC, so slicing the stored instant files the last
   * night of July under August. This repo has shipped that defect on three screens before.
   */
  it('months are grouped in the org’s timezone', () => {
    assert.match(
      code(seasonEnd), /const key = orgDayKey\(instantOf\(row\)\)\.slice\(0, 7\)/,
      'month grouping must go through `orgDayKey`. Slicing the ISO string reads the UTC day, which '
      + 'is a different month for every evening game near the end of one.',
    );
  });

  /**
   * ⚠ Both shelves must use ONE month component. A month header that expands on one shelf and
   * navigates on the other — or a count meaning different things — is the drift a shared class
   * would not have stopped, which is why it is a component.
   */
  it('both long shelves group through the same month component', () => {
    const uses = (code(seasonEnd).match(/<SeasonMonths\b/g) ?? []).length;
    assert.equal(uses, 2, `expected Results and practices to share SeasonMonths (found ${uses}).`);
  });

  /**
   * ⚠ The results shelf carries the SCHEDULE grant as well as record access — the same conjunction
   * the practices shelf carries, because a helper who ran one station holds neither half.
   */
  it('the results shelf keys on the schedule grant too', () => {
    assert.match(
      seasonEnd, /const mayReadResults = [\s\S]{0,160}canViewSchedule\(page\.capabilities\)/,
      'results must gate on canViewSchedule as well as record access — who the team played is the '
      + 'fact the schedule read has always gated.',
    );
  });

  /**
   * ⚠⚠ **NOT ONE FIELD OF GUARDIAN OR MEDICAL DATA MAY LEAVE THE ROSTER READ.** Player names are
   * baseline (owner, 2026-08-03) and that is why record access alone opens this shelf — the ruling
   * covers NAMES and stops there. The projection is the whole answer; adding a field to it is a
   * decision about a minor's private data, not a tidy-up.
   */
  it('the season roster read emits names and numbers, and nothing about a family', () => {
    const route = readFileSync(
      join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'season-roster', 'route.ts'),
      'utf8',
    );
    for (const forbidden of [
      'guardianFirstName', 'guardianLastName', 'guardianEmail', 'guardianPhone',
      'medicalNotes', 'emergencyContactName', 'emergencyContactPhone', 'adminNotes',
      'playerDateOfBirth',
    ]) {
      assert.equal(
        code(route).includes(forbidden), false,
        `the season roster route emits "${forbidden}". Record access is the gate here ONLY because `
        + 'player names are baseline; every field above is behind its own grant on the live roster '
        + 'and has nothing to do with remembering who played.',
      );
    }
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE DELETION** (owner ruling 2026-08-18, COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN §3.5).
 *
 * ⚠⚠ These tests replace the whole "a record shows records, and puts the instruments away" block
 * that stood above them until 2026-08-18 — seven assertions that a finished season rendered
 * past-tense empty states, hid its write controls and suppressed its live filters. Every one of
 * them described the state this ruling deletes: seventeen screens carried a finished-season branch
 * and twelve carried a "comes back next season" notice, and none of them do now.
 *
 * They are re-aimed rather than removed, because the property that mattered did not go away — it
 * MOVED. It used to be "a record must not offer an instrument"; it is now "a closed season must
 * not render a live screen at all". One gate answers it, and these hold that gate in place.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('a closed season is one page, not a read-only copy of the portal', () => {
  const gate = readFileSync(
    join(process.cwd(), 'components', 'coaches', 'CoachTeamSeasonGate.tsx'), 'utf8',
  );
  const layout = readFileSync(join(COACH_PAGES, 'layout.tsx'), 'utf8');

  /**
   * ⚠ The gate must not render `children` for a team with no live season. A prop, a class or an
   * `aria-disabled` would leave every live page MOUNTED — issuing its fetches, opening its modals
   * and offering controls the server refuses one at a time. Not mounting is the only version of
   * this that is true.
   */
  it('the gate withholds the live screens rather than dressing them as read-only', () => {
    assert.match(
      code(gate), /if \(!redirecting\) return <>\{children\}<\/>;/,
      'the gate must return children or not — a finished season may not render a live screen in '
      + 'any form.',
    );
    assert.match(
      code(gate), /RECORD_PATHS\.some\(p =>/,
      'and it must compare the PATHNAME, so a coach opening an older year with `?year=` is not '
      + 'bounced back to the default one.',
    );
  });

  /**
   * ⚠⚠ **"ONE PAGE" MEANS ONE PAGE OF THE SEASON, NOT ONE ROUTE — and getting that wrong shipped
   * a shelf whose every row looped** (found on the first owner walk, 2026-08-18). The practices
   * shelf's rows open the read-only past-plan page; the gate's first build allowed only
   * `/season-end`, so every row bounced straight back to the page it was on. It read as a
   * rendering bug and was a routing one.
   *
   * ⚠ The allowance is exactly TWO record surfaces, and this test is what keeps it at two. A third
   * entry is the twenty-nine branches returning one route at a time — the bar is "a record with no
   * way to act on it, reached FROM the closed-season page", not "useful".
   */
  it('the gate allows the closed season’s record surfaces, and only those', () => {
    const list = code(gate).match(/const RECORD_PATHS = \[([\s\S]*?)\];/)?.[1] ?? '';
    assert.ok(list.includes('closedHref'), 'the closed-season page itself must be allowed');
    assert.ok(
      list.includes('/history/development/practices/'),
      'the read-only past-plan page must be allowed — it is what every row of the practices shelf '
      + 'opens, and without it the shelf loops back to the page it sits on.',
    );
    assert.equal(
      list.split(',').filter(s => s.trim()).length, 2,
      'exactly two record surfaces. A third is a live screen coming back through the door the '
      + 'twenty-nine branches used to hold open.',
    );
  });

  /**
   * ⚠ The compare door was REMOVED from the closed-season page (owner, first walk 2026-08-18): it
   * pointed at the compare list under Insights, which a team with no live season cannot reach — so
   * for the coach most likely to press it, it redirected back to the page they pressed it on.
   */
  it('the closed-season page offers no door that its own gate would bounce', () => {
    const body = code(seasonEnd.slice(seasonEnd.indexOf('const seasonTitle')));
    /**
     * ⚠ **TWO SPELLINGS, BECAUSE THE ADDRESS CHANGED SHAPE** (reports portal P1, 2026-08-18). The
     * compare list moved from the route `/history/results` to the tab `?section=results`, built by
     * `insightsSectionHref`. Checking only the old literal would leave this test passing over a
     * re-added door written the new way — a guard that quietly stops guarding is worse than none,
     * and this one protects against a link that loops back to the page a coach pressed it on.
     */
    for (const spelling of ['/history/results', "insightsSectionHref(base, 'results')"]) {
      assert.equal(
        body.includes(spelling), false,
        `the closed-season page links to the compare list again (as \`${spelling}\`). That list `
        + 'lives under Insights, which a team with no live season does not have — the link loops, '
        + 'and a link that loops reads as a broken page rather than as a closed door.',
      );
    }
  });

  it('the team layout decides it on the SERVER, from the shared resolvers', () => {
    assert.match(
      code(layout), /seasonFinished=\{!live && !!closed\}/,
      'the layout must pass the decision down, resolved from `resolveLiveSeason` / '
      + '`resolveClosedSeason`. Deciding it client-side would give a live tool a frame to paint '
      + 'against a closed season.',
    );
  });

  /**
   * ⚠⚠ THE COUNT IS THE POINT. `isReadOnly` / `isRecord` drove seventeen screens and the twelve
   * notices rode one component's second branch. This asserts they have not crept back — a single
   * new `page.isReadOnly` is the thirtieth special case, and the whole ruling was that there should
   * be none.
   */
  it('no coach page has re-grown a finished-season branch', () => {
    const offenders: string[] = [];
    for (const file of pageFilesUnder(COACH_PAGES)) {
      const src = code(readFileSync(file, 'utf8'));
      if (/page\.isReadOnly|\bisRecord\b|page\.canWrite\(/.test(src)) {
        offenders.push(file.replace(process.cwd(), '').replace(/\\/g, '/'));
      }
    }
    assert.deepEqual(offenders, [],
      'A coach page is branching on a finished season again. There is no such state to branch on: '
      + 'a team with no live season lands on its closed-season page and the live screens are not '
      + 'rendered at all. If a finished season needs to show something, it needs a SHELF on that '
      + 'page — not a second version of a live screen.');
  });

  /**
   * ⚠ The "this season has finished, it comes back next season" notice is gone from the wall the
   * twelve live instruments share. What is left is the one true sentence, said once — and the
   * branch is exactly how the last one grew.
   */
  it('the not-on-team wall says one thing', () => {
    const wall = readFileSync(
      join(process.cwd(), 'components', 'coaches', 'CoachNotOnTeam.tsx'), 'utf8',
    );
    assert.equal(
      /This season has finished|comes back when the next one starts/.test(code(wall)), false,
      'the finished-season notice is deleted — a coach whose team has no live season never reaches '
      + 'these pages now.',
    );
    assert.equal(
      /resolveClosedSeason|resolveClosedAssignment|useCoaches/.test(code(wall)), false,
      'and it must not read the season at all any more. Reading it is how the second branch would '
      + 'come back.',
    );
  });
});
