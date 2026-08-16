/**
 * Chunk F — "everything in a closed season is read-only", enforced as a RULE over the source
 * tree rather than screen by screen.
 *
 * Why this test exists, precisely: before Chunk F, closed-season writes were refused by
 * ACCIDENT, not by a guard. Every write handler resolves its coaching assignment through the
 * active-only lookup (403 for a closed year) and then `getActiveRepProgramYear` (404 when the
 * team has none), so a past season was simply unaddressable. Chunk F makes past seasons
 * addressable — which dissolves that accident. The rule has to be stated somewhere, and stating
 * it here (once, over the whole tree) is worth more than forty runtime probes: a route added
 * next year is covered without anyone remembering to cover it.
 *
 * THE RULE: a write handler may not read the season parameter and may not touch the season-read
 * rail. Reads address a season; writes address the live one, always.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CLOSED_TEAM_NAV_ITEMS, isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';

/**
 * ⚠ SCOPE LIMIT, STATED SO IT IS NOT MISTAKEN FOR COVERAGE (/review 2026-08-02).
 *
 * This guard scans API ROUTES only. Since the desktop-shell masthead, a coach surface can also
 * read via a SERVER LAYOUT that queries with the service-role client and never touches
 * `lib/coach-season-read.ts` (`app/[orgSlug]/coaches/teams/[teamId]/layout.tsx`). That route is
 * invisible to everything below.
 *
 * The masthead complies by construction — its live query is pinned to the ACTIVE program year and
 * a closed season contributes only its own frozen final record — but nothing here would fail the
 * build if a future edit added a live read for an archived season from a layout. If that pattern
 * spreads beyond this one file, extend the scan to coach server components rather than trusting
 * the comment.
 */
const COACH_API_ROOT = join(process.cwd(), 'app', 'api', 'coaches');
const WRITE_VERBS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

/**
 * Governing rule 3's single deliberate exception: the head coach may still manage WHO CAN SEE a
 * closed season. Its writes touch assignment rows only — never that season's records. Adding a
 * path here is a security decision; it must come with an owner ruling.
 */
const READ_ACCESS_WRITE_EXCEPTIONS = [
  join('teams', '[teamId]', 'staff'),
];

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (entry === 'route.ts') out.push(full);
  }
  return out;
}

/** The body of one exported handler, from its `export const VERB` to the next one (or EOF). */
function ownHandlerBody(src: string, verb: string): string | null {
  const start = src.search(new RegExp(`export const ${verb}\\b`));
  if (start < 0) return null;
  const rest = src.slice(start + verb.length + 13);
  const next = rest.search(/\nexport const (GET|POST|PATCH|PUT|DELETE)\b/);
  return next < 0 ? src.slice(start) : src.slice(start, start + verb.length + 13 + next);
}

const TAG_ROUTE_FACTORY = join(process.cwd(), 'lib', 'coach-tag-routes.ts');

/**
 * ⚠ **A HANDLER MAY BE DELEGATED, AND THE GUARD MUST FOLLOW IT.**
 *
 * The three tag libraries collapsed into one factory, so nine route files now read
 * `export const { GET, POST } = coachTagCollectionRoutes({…})`. The literal text
 * `export const POST` no longer appears in ANY of them — which meant the two write-side tests
 * below stopped finding a body to inspect and silently `continue`d on all nine. They still
 * reported green. **A vacuous pass is worse than a failure**: it is the guard going blind while
 * claiming the contract still holds, which is precisely the regression class Chunk F built this
 * file to catch.
 *
 * So a delegated verb resolves to the FACTORY's implementation of it. Add a new factory here the
 * day a second one appears; the assertion at the bottom of this file fails if a route delegates
 * to something this map does not know about.
 */
const DELEGATED_HANDLERS: { call: RegExp; file: string; fn: string }[] = [
  { call: /coachTagCollectionRoutes\s*\(/, file: TAG_ROUTE_FACTORY, fn: 'coachTagCollectionRoutes' },
  { call: /coachTagItemRoutes\s*\(/, file: TAG_ROUTE_FACTORY, fn: 'coachTagItemRoutes' },
  { call: /coachTagMergeRoute\s*\(/, file: TAG_ROUTE_FACTORY, fn: 'coachTagMergeRoute' },
];

/** The body of `const VERB = …` inside one exported factory function. */
function factoryHandlerBody(factorySrc: string, fn: string, verb: string): string | null {
  const fnStart = factorySrc.search(new RegExp(`export function ${fn}\\b`));
  if (fnStart < 0) return null;
  const body = factorySrc.slice(fnStart);
  const start = body.search(new RegExp(`\\n\\s*const ${verb}\\s*=`));
  if (start < 0) return null;
  const rest = body.slice(start + verb.length + 10);
  // Stop at the next handler in the same factory, or at its `return { … }`.
  const next = rest.search(/\n\s*const (GET|POST|PATCH|PUT|DELETE)\s*=|\n\s*return \{/);
  return next < 0 ? body.slice(start) : body.slice(start, start + verb.length + 10 + next);
}

/**
 * The body that actually RUNS for `verb` in this route file — its own, or the factory's when the
 * file delegates. Returns null only when the route genuinely has no such verb.
 */
function handlerBody(src: string, verb: string): string | null {
  const own = ownHandlerBody(src, verb);
  if (own) return own;
  // `export const { GET, POST } = factory(…)` — the verb is delegated, so follow it.
  if (!new RegExp(`export const \\{[^}]*\\b${verb}\\b[^}]*\\}`).test(src)) return null;
  for (const d of DELEGATED_HANDLERS) {
    if (!d.call.test(src)) continue;
    const delegated = factoryHandlerBody(readFileSync(d.file, 'utf8'), d.fn, verb);
    if (delegated) return delegated;
  }
  return null;
}

const files = routeFiles(COACH_API_ROOT);

/**
 * ⚠ **A route's season posture may also be DECLARED rather than called** (Practice Plans Phase 3).
 *
 * The three tag libraries collapsed into one factory (`lib/coach-tag-routes.ts`), so their route
 * files no longer call `resolveCoachSeasonRead` themselves — they spread a descriptor that carries
 * `seasonAwareRead: true | false`. A source scan that only looked for the CALL would have quietly
 * lost sight of `tags` and `expense-tags`, which is the guard going blind rather than the rule
 * changing. This reads the flag out of the descriptor so the contract still bites.
 *
 * The flag is deliberately FALSE for the 'focus' vocabulary (owner ruling 2026-08-01): a tag
 * library is an INSTRUMENT, and the read-only past-plan page renders from tag NAMES snapshotted
 * into the plan, so it needs nothing live.
 */
function seasonAwareTagLibraries(): Set<string> {
  const src = readFileSync(TAG_ROUTE_FACTORY, 'utf8');
  const aware = new Set<string>();
  for (const match of src.matchAll(/export const (\w+_TAG_LIBRARY)\s*=\s*\{([\s\S]*?)\n\}/g)) {
    if (/seasonAwareRead:\s*true/.test(match[2])) aware.add(match[1]);
  }
  return aware;
}

/**
 * Does this route serve a past season — by calling the rail, or by declaring it?
 *
 * ⚠ Only `coachTagCollectionRoutes` carries a GET. The `[tagId]` and `merge` files spread the same
 * descriptor but export write verbs only, and every write resolves the LIVE season regardless of
 * the flag — so matching the descriptor alone would list four write-only routes as archive doors
 * and make the allow-list mean less than it says.
 */
function servesPastSeason(src: string, awareLibraries: Set<string>): boolean {
  if (/resolveCoachSeasonRead(Context)?\s*\(|resolveCoachSeasonCapabilityMap\s*\(/.test(src)) return true;
  if (!/coachTagCollectionRoutes\s*\(/.test(src)) return false;
  return [...awareLibraries].some(name => new RegExp(`\\.\\.\\.${name}\\b`).test(src));
}

describe('Chunk F — no write handler can address a past season', () => {
  it('finds the coach API routes at all (guards against a vacuous pass)', () => {
    assert.ok(files.length > 40, `expected the coach API tree, found ${files.length} route files`);
  });

  /**
   * ⚠ **THE GUARD MUST NOT GO BLIND, and this is the test that says so.**
   *
   * The two rules below inspect a handler's BODY. If a route exports a verb the extractor cannot
   * find a body for, those rules skip it and still report green — which is exactly what happened
   * when nine tag routes moved to a factory: `export const POST` vanished from every one of them
   * and the write-side contract stopped being checked at all, silently.
   *
   * So: every write verb a route file EXPORTS must resolve to a body, whether its own or the
   * factory's. A delegation this file does not know how to follow fails here rather than
   * disappearing.
   */
  it('every exported write verb resolves to a body the rules can actually inspect', () => {
    const blind: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const verb of WRITE_VERBS) {
        const exported = new RegExp(`export const ${verb}\\b`).test(src)
          || new RegExp(`export const \\{[^}]*\\b${verb}\\b[^}]*\\}`).test(src);
        if (exported && !handlerBody(src, verb)) {
          blind.push(`${file.replace(process.cwd(), '')} → ${verb}`);
        }
      }
    }
    assert.deepEqual(blind, [],
      'These routes export a write verb whose body this guard cannot read, so the two rules below ' +
      'are SKIPPING them and passing vacuously. If the handler was moved into a shared factory, ' +
      'add that factory to DELEGATED_HANDLERS so the contract follows it.');
  });

  it('no write handler reads the ?year= season parameter', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const verb of WRITE_VERBS) {
        const body = handlerBody(src, verb);
        if (!body) continue;
        if (/seasonParam\s*\(|searchParams\.get\(\s*['"]year['"]\s*\)/.test(body)) {
          offenders.push(`${file.replace(process.cwd(), '')} → ${verb}`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      'A write handler reads the season parameter. Writes address the live season only — ' +
      'see lib/coach-season-read.ts. If this is the staff read-access exception, it still may ' +
      'not take a year from the query string.');
  });

  it('no write handler resolves through the season-READ rail', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.replace(process.cwd(), '');
      if (READ_ACCESS_WRITE_EXCEPTIONS.some(ex => rel.includes(ex))) continue;
      const src = readFileSync(file, 'utf8');
      for (const verb of WRITE_VERBS) {
        const body = handlerBody(src, verb);
        if (!body) continue;
        if (/resolveCoachSeasonRead(Context)?\s*\(/.test(body)) {
          offenders.push(`${rel} → ${verb}`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      'A write handler uses the season-read rail. That rail admits CLOSED seasons by design — ' +
      'it is read-only infrastructure. Write handlers keep their active-only resolver.');
  });

  it('the read rail is actually in use, so the rule is not guarding an empty set', () => {
    const aware = seasonAwareTagLibraries();
    const readers = files.filter(f => servesPastSeason(readFileSync(f, 'utf8'), aware));
    assert.ok(readers.length >= 10,
      `expected the season-read rail on the converted GET routes, found ${readers.length}`);
  });

  it('the tag-route factory declares a season posture for every library', () => {
    const src = readFileSync(TAG_ROUTE_FACTORY, 'utf8');
    const libraries = [...src.matchAll(/export const (\w+_TAG_LIBRARY)\s*=/g)].map(m => m[1]);
    assert.ok(libraries.length >= 3, `expected the tag libraries, found ${libraries.length}`);
    for (const name of libraries) {
      const body = src.match(new RegExp(`export const ${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
      assert.match(body, /seasonAwareRead:\s*(true|false)/,
        `${name} must state seasonAwareRead explicitly. A tag library that reaches into a past `
        + 'season is an archive decision, and the default is NO.');
    }
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE ARCHIVE IS OPT-IN (owner ruling, 2026-08-01)
 *
 * "Any new feature, window, etc. in the coaches portal defaults to NOT being viewable in
 *  archived seasons, and we explicitly add them if needed — so we aren't opening up new
 *  functionality to historical seasons without explicitly saying so."
 *
 * The architecture already fails closed: a coach API route that does not opt into the
 * season-read rail resolves the team's ACTIVE year and cannot address a past season at all.
 * These two lists turn that default from an accident into a CONTRACT — reaching into history
 * requires editing a list, which is a decision someone has to make on purpose.
 *
 * If one of these fails, the change is not wrong — it just isn't approved yet. Take the
 * question to the owner, then add the entry in the same commit.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe('the archive is opt-in — nothing reaches a past season by default', () => {
  /**
   * Doors a coach can open on a FINISHED season. Adding one means a whole section becomes
   * historical: every page it leads to must resolve the viewed season, show the read-only
   * chip, and offer no write control (tests/uat/scenarios/coach-frozen-season-smoke.spec.ts
   * sweeps exactly that). Owner ruling D-F1 governs what belongs here.
   */
  /**
   * ⚠⚠ **ATTENDANCE LEFT THIS LIST ON 2026-08-16, AND LOST NO ACCESS** (archive rail Phase 2).
   *
   * This list is the archive's MENU, not the set of sections a finished season has. Attendance is
   * still an approved archive door under D-F1 — its route is still on the season-read rail, its
   * page still resolves `?year=`, and a coach still reads a past season's report. What changed is
   * the route TO it: the archive's "Insights" door pointed at `/history/results` only because the
   * Insights hub was live-season-only, and that one workaround is the entire reason Attendance
   * needed a menu line of its own while having none in a live season. The hub reads its season
   * now, so Attendance is reached through it in BOTH seasons and the two navs tell one story.
   *
   * ⚠ ORDER WAS THE RISK, not the removal. Deleting this entry before the hub became the door
   * would have made a past season's attendance report unreachable — an approved archive door
   * removed by accident while tidying a menu, which is exactly the defect the live-nav tidy-up
   * caught and avoided a day earlier. The sections-vs-menu distinction now lives in
   * `CLOSED_SECTION_EXTRAS` (lib/coach-nav-visibility.ts) so the season switcher cannot make the
   * same mistake.
   */
  const APPROVED_ARCHIVE_DOORS = [
    "Season's End", 'Roster', 'Schedule', 'Lineups', 'Money',
    'Documents', 'Development', 'Tryouts', 'Insights', 'Staff',
  ];

  /**
   * Routes permitted to serve a past season. Everything absent from this list resolves the
   * ACTIVE year — which is the default, and the safe one.
   *
   * ⚠ Adding a path here is the moment a feature becomes historical. Ask three questions
   * first: is it a RECORD or an INSTRUMENT (instruments stay live — D-F7); does its page
   * carry the season through every link and fetch; and does it show what the coach could see
   * AT THE TIME rather than today (governing rule 1)?
   */
  const APPROVED_SEASON_AWARE_ROUTES = [
    'attendance', 'award-types', 'awards', 'budget', 'budget-plan', 'budget-vs-actual',
    'development/board', 'development/sessions', 'dues', 'events',
    'events/[eventId]/lineup',
    /**
     * ⚠ **THE PRACTICE-PLANS ARCHIVE DOOR — ruled explicitly** (owner, 2026-08-01, plan §10.8
     * ruling 1). A past practice plan is readable READ-ONLY in any season, reached ONLY from the
     * Development report's "Practices you've run" list.
     *
     * The three questions this list demands, answered:
     *   1. **RECORD or INSTRUMENT?** A written plan is a RECORD of what a coach intended on a
     *      night that has happened. The instruments beside it — the drill library, the template
     *      library, the tag vocabulary — all stay live-season-only and are absent from this list.
     *   2. **Does the whole subtree carry the season?** Yes, and the subtree is one page: the
     *      route is GET-only and the page it serves has exactly one outbound link, back to the
     *      list, carrying `?year=`. Chunk F's expensive defects were all one level down; here
     *      there is no level down.
     *   3. **Does it show what the coach could see AT THE TIME?** Yes, by construction. Every word
     *      renders from the plan's own jsonb, which COPIED the drill's text when the drill was
     *      added — so editing that drill since cannot rewrite what June's practice says.
     *
     * ⚠ This does NOT reopen the schedule's practice-plan section, which stays hidden in a
     * completed season exactly as slice 1b ruled (§11.1). The new door is narrow and one-way.
     */
    'events/[eventId]/practice-plan/read',
    'expense-tags', 'expenses', 'fundraisers',
    /**
     * ⚠ **ONE FUNDRAISER'S PER-PLAYER SHEET — ruled with the drill-in build** (2026-08-14,
     * `docs/projects/active/COACH_FUNDRAISER_DRILL_IN_PLAN.md`). Its parent `fundraisers` has
     * served a past season since Chunk F, so an archived Money hub already LISTED that season's
     * drives; this is the room behind that door, and it was being furnished from the live season.
     *
     * The three questions this list demands, answered:
     *   1. **RECORD or INSTRUMENT?** A finished drive's per-player totals are a RECORD of money
     *      that was raised. The instruments that act on it — logging an amount, editing one,
     *      changing the fundraiser's settings — are the write verbs in this same file and its
     *      siblings, and every one of them still resolves the ACTIVE year and cannot address a
     *      past season at all.
     *   2. **Does the whole subtree carry the season?** Yes, and the subtree is now SHALLOWER
     *      than it was: the fundraiser is no longer a page of its own but a state of the Money
     *      hub's Fundraisers tab, so it inherits the hub's `?year=` rather than needing its own
     *      copy of it. Its one outbound link is back to the list, in the same season.
     *   3. **Does it show what the coach could see AT THE TIME?** Yes — and this is the defect it
     *      was built to close. The roster comes from the RESOLVED season, so 2025's drive lists
     *      2025's players; capabilities come from that season's assignment row (rule 1).
     */
    'fundraisers/[fundraiserId]/entries',
    'history',
    'lineup-templates', 'milestones',
    /**
     * ⚠ **MONEY THAT ARRIVED — ruled with the money-in build** (2026-08-16, mig 243;
     * `docs/projects/active/COACH_MONEY_IN_TAXONOMY_PLAN.md`). Income and money back on something,
     * listed on the Expenses & Payables tab and rolled into Budget vs. Actual.
     *
     * ⚠⚠ **LEAVING IT OUT WOULD HAVE BEEN THE DEFECT, NOT THE SAFE DEFAULT** — which is why this
     * entry exists rather than the route resolving the live year. Its two neighbours, `expenses`
     * and `budget-vs-actual`, have served a past season since Chunk F. A live-season-only money-in
     * read would have furnished an ARCHIVED season's Money screens with THIS season's arrivals:
     * 2025's costs beside 2027's income, on one page, adding up to a number that never existed.
     * That is precisely the one-level-down leak Chunk F's expensive defects were.
     *
     * The three questions this list demands, answered:
     *   1. **RECORD or INSTRUMENT?** The GET is a RECORD — what came in, and what came back, in a
     *      season that has finished. Every instrument is a separate verb in this file or its
     *      `[moneyInId]` sibling (POST, PATCH, DELETE), and each resolves the ACTIVE year through
     *      `resolveCoachContext` and additionally re-asserts the record's own program year, so
     *      none of them can address a past season even by id.
     *   2. **Does the whole subtree carry the season?** Yes, and there is no level down: the list
     *      is a tab inside a page that already carries `?year=` through every fetch, and a money
     *      row has no page of its own — its only detail is the edit form, which a read-only season
     *      never renders because the panel gates every write door on `page.canWrite()`.
     *   3. **Does it show what the coach could see AT THE TIME?** Yes. Rows are read by
     *      `program_year_id` and name their category and item by id, so re-filing a word in the
     *      library today cannot rewrite what 2025's report says a refund was against.
     */
    'money-in',
    'money-summary', 'roster', 'roster/[playerId]',
    'season-surplus', 'staff', 'staff/[coachId]', 'tags',
    /**
     * ⚠ **CANDIDATE MEMORY — ruled explicitly** (owner, 2026-08-02, ruling **R8**;
     * `docs/projects/active/COACH_TRYOUT_INSIGHTS_PLAN.md` §2/§6). These two routes read a PRIOR
     * season's tryout scores into a LIVE surface: `tryout-memory` serves the decision board's
     * memory strip, `tryout-report` the "returning candidates improved +X" aggregate built from
     * the same pairs. Both call `resolveCoachSeasonCapabilityMap`; neither accepts a `?year=`.
     *
     * The three questions this list demands, answered:
     *   1. **RECORD or INSTRUMENT?** A finished tryout's scores are a RECORD of an evaluation that
     *      happened. Both routes are GET-only and write nothing (neither even mints the lazy
     *      tryout workspace row). The six live tryout INSTRUMENTS — check-in, scoring, evaluator
     *      links, decisions, offers — stay live-season-only and are absent from this list.
     *   2. **Does the whole subtree carry the season?** There is no subtree: the read renders as
     *      one strip inside one existing card and one caption on the report. It opens no page and
     *      adds NO archive door — nav is untouched and `/tryouts/history` remains the only way
     *      into a finished tryout.
     *   3. **Does it show what the coach could see AT THE TIME?** Yes. Prior averages are
     *      recomputed from that season's own scores against that season's own scorecard, and each
     *      prior season is gated on THAT year's assignment row (governing rule 1) — a coach who
     *      wasn't cleared for tryouts in 2026 reads nothing from 2026.
     *
     * ⚠ Which past seasons get read is decided by the coach's own CONFIRMED continuity links,
     * never by a query parameter — and nothing is assembled at all while blind evaluation is on
     * (R6, enforced in `lib/tryout-memory.ts` before any fetch).
     */
    'tryout-history', 'tryout-memory', 'tryout-report', 'wrapped',
  ];

  it('no door has been added to a finished season without a decision', () => {
    assert.deepEqual(
      CLOSED_TEAM_NAV_ITEMS.map(i => i.label).sort(),
      [...APPROVED_ARCHIVE_DOORS].sort(),
      'The archive door set changed. A new section is NOT viewable in past seasons by default ' +
      '(owner ruling 2026-08-01) — if it should be, get that decision, add it to ' +
      'APPROVED_ARCHIVE_DOORS, and make every page behind it season-aware and read-only.',
    );
  });

  /**
   * The drill library (Practice Plans Phase 2) — a DECIDED absence, not an oversight.
   *
   * Owner ruling 2026-08-01: a drill library is a reusable INSTRUMENT, not a record of a season,
   * so it gets no archive door — the Development hub hides the Drills door when the season is a
   * record, and the routes below resolve the live context and cannot address a past season.
   *
   * A coach loses nothing: a team is PERMANENT and only its program year turns over, so drills
   * carry forward on their own. What genuinely IS season-locked — past practice plans — is
   * readable through `drills/past-seasons`, which copies forward into the live library and writes
   * nothing back. That route is the single deliberate cross-season read in the feature, and it is
   * deliberately NOT on the season-read rail: it serves the LIVE season.
   *
   * ⚠ This test exists so a later session cannot quietly put drills on the rail and assume the
   * archive question was already answered. It was answered: NO.
   */
  it('the drill library is live-season only, by decision (Practice Plans Phase 2)', () => {
    const drillRoutes = files.filter(f => f.replace(/\\/g, '/').includes('/development/drills'));
    assert.ok(drillRoutes.length >= 2, 'expected the drill routes to exist');
    for (const file of drillRoutes) {
      const src = readFileSync(file, 'utf8');
      assert.ok(
        !/resolveCoachSeasonRead(Context)?\s*\(|resolveCoachSeasonCapabilityMap\s*\(/.test(src),
        `${file} joined the season-read rail. The drill library is an INSTRUMENT and was ruled `
        + 'live-season-only (owner, 2026-08-01). If that has genuinely changed, get the decision, '
        + 'add it to APPROVED_SEASON_AWARE_ROUTES, and make the Development hub stop hiding its door.',
      );
    }
  });

  /**
   * The plan-template library (Practice Plans Phase 3) — the SAME decided absence as drills, for
   * the same reason, recorded so a later session cannot assume the question was open.
   *
   * Owner ruling 2026-08-01: a template library is a reusable INSTRUMENT, not a record of a
   * season. It gets no archive door — the Development hub hides it in a completed season, and the
   * routes below resolve the live context. That costs a coach nothing, because the table is keyed
   * by TEAM rather than by program year, so templates cross a rollover with nothing to import.
   *
   * ⚠ `plan-templates/past-seasons` is the ONE deliberate cross-season read: it copies a coach's
   * own past plans FORWARD into the live library and writes nothing into the finished season, so
   * it belongs off the rail exactly as its drill sibling does.
   */
  it('the plan-template library is live-season only, by decision (Practice Plans Phase 3)', () => {
    const templateRoutes = files.filter(f => f.replace(/\\/g, '/').includes('/development/plan-templates'));
    assert.ok(templateRoutes.length >= 3, 'expected the plan-template routes to exist');
    for (const file of templateRoutes) {
      const src = readFileSync(file, 'utf8');
      assert.ok(
        !/resolveCoachSeasonRead(Context)?\s*\(|resolveCoachSeasonCapabilityMap\s*\(/.test(src),
        `${file} joined the season-read rail. A plan-template library is an INSTRUMENT and was `
        + 'ruled live-season-only (owner, 2026-08-01). What IS readable in an archive is one past '
        + 'PLAN, through events/[eventId]/practice-plan/read — a different, narrower door.',
      );
    }
  });

  /**
   * The Opponent Scouting Book — the SAME decided absence as drills and plan templates,
   * ratified with the project approval (owner, 2026-08-04).
   *
   * The book is an INSTRUMENT: it reads game events from EVERY season (team-scoped, the
   * drills-past-seasons query shape) to feed the LIVE season's preparation — "our record vs
   * them", the observation log, the book line. Notes update in place; nothing is written
   * into a finished season, and an archived season shows no scouting UI anywhere. The
   * per-season FACTS (game logs) stay reachable through the already-approved Schedule and
   * Insights doors, so the archive loses nothing by this absence.
   *
   * ⚠ This test exists so a later session cannot quietly put the book on the rail and
   * assume the archive question was open. It was answered at approval: INSTRUMENT, no door.
   */
  it('the opponent scouting book is live-season only, by decision (Scouting Book P1)', () => {
    const bookRoutes = files.filter(f => f.replace(/\\/g, '/').includes('/opponents/'));
    // P1 shipped four routes; P2 added merge, aliases/[aliasId], and share-to-staff-chat —
    // all of them live-season instruments like their siblings, none of them archive doors.
    // ⚠ The Club Shared Book (P1, 2026-08-04) added NO route here on purpose: the club layer
    // rides the existing card + list GETs, so this floor deliberately did not move.
    assert.ok(bookRoutes.length >= 7, `expected the scouting-book routes to exist, found ${bookRoutes.length}`);
    for (const file of bookRoutes) {
      const src = readFileSync(file, 'utf8');
      assert.ok(
        !/resolveCoachSeasonRead(Context)?\s*\(|resolveCoachSeasonCapabilityMap\s*\(/.test(src),
        `${file} joined the season-read rail. The scouting book is an INSTRUMENT and was ruled `
        + 'live-season-only (owner, 2026-08-04, with the project approval). If that has genuinely '
        + 'changed, get the decision, add its routes to APPROVED_SEASON_AWARE_ROUTES, and give the '
        + 'Insights hub an archive-aware Opponents door.',
      );
    }
  });

  /**
   * The Club Shared Book inherits the book's INSTRUMENT ruling whole (owner, 2026-08-04) — and
   * it adds a NEW way to be wrong, which is why it gets its own test: the club layer reads
   * OTHER teams' books, so a season rail bolted onto it would let one team address another
   * team's past season. Neither module may ever touch the rail, and the club layer must not
   * become an archive door of its own.
   */
  it('the club shared book is live-season only, and never a door into a sibling’s past', () => {
    for (const rel of ['lib/coach-club-book.ts', 'lib/coach-club-book-server.ts']) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      assert.ok(
        !/resolveCoachSeasonRead(Context)?\s*\(|resolveCoachSeasonCapabilityMap\s*\(/.test(src),
        `${rel} joined the season-read rail. The club layer is an INSTRUMENT over other teams' `
        + 'books — putting it on the rail would make a SIBLING team’s finished season addressable, '
        + 'which no ruling has ever granted. Take that question to the owner first.',
      );
      // The club layer is read-only by construction: curation stays with the team that wrote
      // the words. A write helper reaching another team's book would be the ruling breaking.
      assert.ok(
        !/\.(update|insert|delete|upsert)\s*\(/.test(src),
        `${rel} performs a write. The club layer is READ-ONLY — no cross-team edit or delete of `
        + 'any kind (owner ruling, plan §4.4). Curation is each head coach’s, on their own book.',
      );
    }
  });

  /**
   * ⚠⚠ **PLAYING TIME IS LIVE-SEASON-ONLY, PERMANENTLY** (owner ruling, 2026-08-16, taken with
   * archive rail Phase 2). Recorded here as a DECISION so no later session mistakes it for a gap.
   *
   * It was the one Insights door with no season rail behind it, and the plan of record left open
   * whether a Phase 3 should build one. The answer is no, and the reason is governing rule 3
   * rather than effort: the figures are **recomputed** from saved lineups every time the report is
   * opened, so what it would show for 2024 is what today's code makes of 2024's lineups — not what
   * the coach actually read that season. Everything else in this list is a stored record; this one
   * is a derivation, and a derivation cannot promise "what the coach could see AT THE TIME".
   *
   * A coach loses nothing they had: the report has never been reachable in an archive. Phase 2
   * HIDES its Insights tile in a finished season rather than letting it dead-end (CLAUDE.md: hide
   * the entry point, never 404 politely), and `LIVE_ONLY_ARCHIVE_SECTIONS` keeps the season
   * switcher from reaching it sideways.
   *
   * ⚠ Reversing this needs a new owner ruling AND an answer to the recomputation problem — not
   * just an entry in APPROVED_SEASON_AWARE_ROUTES.
   */
  it('playing-time analytics are live-season only, by ruling (archive rail, 2026-08-16)', () => {
    const analytics = files.find(f => f.replace(/\\/g, '/').includes('/lineup-analytics/'));
    assert.ok(analytics, 'expected the lineup-analytics route to exist');
    assert.ok(
      !/resolveCoachSeasonRead(Context)?\s*\(|resolveCoachSeasonCapabilityMap\s*\(/.test(readFileSync(analytics!, 'utf8')),
      'lineup-analytics joined the season-read rail. Playing time was ruled live-season-only '
      + 'PERMANENTLY (owner, 2026-08-16): its figures are recomputed from saved lineups, so a past '
      + 'season would be shown as today`s code reads it rather than as the coach saw it. Reversing '
      + 'that needs a new ruling and an answer to the recomputation problem — then the Insights hub '
      + 'must stop hiding its tile and LIVE_ONLY_ARCHIVE_SECTIONS must drop the path.',
    );
  });

  /**
   * ⚠ The LIVE practice-plan route must never gain the rail.
   *
   * It holds the PUT and the PATCH, so putting the season rail on its GET would make the whole
   * editor addressable in an archive and leave one file carrying both postures. The read-only door
   * is a separate GET-only route beside it, which is why that separation is worth a test rather
   * than a comment.
   */
  it('the LIVE practice-plan route stays live-season only; only its /read sibling is a door', () => {
    const live = files.find(f => f.replace(/\\/g, '/').endsWith('/practice-plan/route.ts'));
    assert.ok(live, 'expected the live practice-plan route to exist');
    assert.ok(
      !/resolveCoachSeasonRead(Context)?\s*\(/.test(readFileSync(live!, 'utf8')),
      'The live practice-plan route also writes. A past season must never be addressable from a '
      + 'file that can write — the read-only door is events/[eventId]/practice-plan/read.',
    );
  });

  it('no route has learned to serve a past season without a decision', () => {
    const aware = seasonAwareTagLibraries();
    const actual = files
      .filter(f => servesPastSeason(readFileSync(f, 'utf8'), aware))
      .map(f => f
        .replace(process.cwd(), '')
        .replace(/^[\\/]app[\\/]api[\\/]coaches[\\/]/, '')
        .replace(/\[orgSlug\][\\/]teams[\\/]\[teamId\][\\/]/, '')
        .replace(/[\\/]route\.ts$/, '')
        .replace(/\\/g, '/'))
      .sort();

    assert.deepEqual(actual, [...APPROVED_SEASON_AWARE_ROUTES].sort(),
      'A coach route gained (or lost) the ability to serve a past season. New features are ' +
      'live-season-only by default (owner ruling 2026-08-01). If this one genuinely belongs in ' +
      'the archive, confirm it is a RECORD and not an INSTRUMENT, make its page carry the ' +
      'season through every link and fetch, then add it to APPROVED_SEASON_AWARE_ROUTES.');
  });
});

/**
 * The label-keyed nav gate is a known trap: `isCoachNavItemVisible` switches on the DISPLAY
 * label and falls through to `default: return true`. Chunk F opens nine new doors on a closed
 * season, so a label that isn't in that switch silently hands an ungranted assistant the door.
 * Chunk B's own review found this exact class of bug on a rename.
 */
describe('Chunk F — every closed-season door is actually gated', () => {
  /** Doors deliberately open to any assigned coach — each is a conscious decision, not a gap. */
  /**
   * ⚠ A1 (2026-08-03) removed **Insights** from this exemption. Its nav case used to be a
   * hand-written union that a denied-everything bundle still satisfied; it is `hasRecordAccess`
   * now, so it is genuinely gated and exempting it would silently stop testing it.
   *
   * ⚠ **Season's End left this set on 2026-08-03 too**, when the season-review ruling closed it to
   * non-coaches. **The set is now EMPTY, and that is the point** — every closed-season door is
   * governed by a grant, so a label the switch fails to recognise falls through to
   * `default: return true` and this test catches it. Re-adding an entry here means re-opening a
   * door to a persona who cannot use it, which needs an owner ruling, not an exemption.
   */
  const INTENTIONALLY_UNGATED = new Set<string>();

  /**
   * Everything OFF. Not a real grant bundle — an assistant's floor legitimately includes
   * schedule/attendance/lineups/documents-view, so testing against the floor would pass
   * regardless. This tests the thing that actually matters: that the switch RECOGNISES each
   * label at all. A label it doesn't recognise falls through to `default: return true` and stays
   * visible even here.
   *
   * ⚠ Written out in full rather than spread from a helper, so adding a grant to the model is a
   * compile error here — which is how A1 (2026-08-03) surfaced this fixture at all.
   */
  const deniedEverything: ReturnType<typeof resolveCoachCapabilities> = {
    isHeadCoach: false, schedule: false, scheduleManage: false, attendance: false, lineups: false,
    rosterWrite: false, rosterPii: false, notes: false, staffChat: false,
    money: 'off', documents: 'off', announcementsSend: false, tryouts: false,
  };

  it('the closed-season nav is the full record set, not Batch 3’s two doors', () => {
    assert.ok(CLOSED_TEAM_NAV_ITEMS.length >= 10,
      `expected the opened door set, found ${CLOSED_TEAM_NAV_ITEMS.length}`);
  });

  it('no door falls through the label switch to default:true', () => {
    const ungated = CLOSED_TEAM_NAV_ITEMS
      .map(i => i.label)
      .filter(label => !INTENTIONALLY_UNGATED.has(label))
      .filter(label => isCoachNavItemVisible(deniedEverything, label));
    assert.deepEqual(ungated, [],
      'These closed-season doors stay visible to a coach denied everything. The label is missing ' +
      'from the switch in lib/coach-nav-visibility.ts and fell through to `default: return true` ' +
      '— or it belongs in INTENTIONALLY_UNGATED with a reason.');
  });

  it('a head coach still sees every door', () => {
    const head = resolveCoachCapabilities('head_coach', null);
    const hidden = CLOSED_TEAM_NAV_ITEMS
      .map(i => i.label)
      .filter(label => !isCoachNavItemVisible(head, label));
    assert.deepEqual(hidden, [], 'A head coach must see the whole archive.');
  });

  it('the tryouts door points at the ARCHIVE, never the live hub', () => {
    const tryouts = CLOSED_TEAM_NAV_ITEMS.find(i => i.label === 'Tryouts');
    assert.ok(tryouts, 'the tryouts door should exist on a closed season (owner ruling D-F1)');
    assert.equal(tryouts!.href, '/tryouts/history',
      'the live tryout hub runs a tryout — check-in, evaluator links, decisions, offer emails. ' +
      'A finished season gets the record, not the machinery.');
  });
});
