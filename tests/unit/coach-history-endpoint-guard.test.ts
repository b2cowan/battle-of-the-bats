/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A YEAR PARAMETER IS A DECISION** (Design A, owner ruling 2026-08-16; P2 of
 * COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md).
 *
 * This file is the rewritten `coach-season-write-guard.test.ts`. Same fs-scan mechanism, new
 * contract, because the thing it guarded changed shape rather than going away.
 *
 * The old rule was "the archive is opt-in": ~30 routes could serve whatever season a `?year=` named,
 * and two allow-lists (`APPROVED_ARCHIVE_DOORS`, `APPROVED_SEASON_AWARE_ROUTES`) made joining that
 * set a decision someone had to make on purpose. The owner then deleted the archive as a PLACE —
 * no season dial, no second nav, history delivered inside the live tools. So the default is no
 * longer "live-season-only unless approved"; it is **"the team's WORKING season, full stop"**, and
 * the narrow thing left to guard is the handful of endpoints that may still be handed a year.
 *
 * THE RULES, in the order they are asserted below:
 *   1. No route under `app/api/coaches` may read a season/year parameter, or resolve a season the
 *      caller named, EXCEPT the enumerated `HISTORY_ENDPOINTS`.
 *   2. No coach PAGE may read `?year=` except the one page those endpoints serve. (New in P2: the
 *      client half used to be uncheckable because ~24 pages legitimately carried the parameter.)
 *   3. Writes still address the LIVE season, always — a finished season is a record.
 *   4. The decided absences survive, re-worded: drills, plan templates, the opponent scouting book,
 *      the club shared book and playing-time analytics never become history surfaces.
 *   5. The guard must not go blind — a delegated handler it cannot follow fails here rather than
 *      passing vacuously (the lesson that cost nine tag routes their coverage in 2026-08).
 *
 * If one of these fails, the change is not necessarily wrong — it just isn't approved yet. Take the
 * question to the owner, then edit the list in the same commit.
 *
 * ⚠⚠ **SCOPE LIMITS, STATED SO THEY ARE NOT MISTAKEN FOR COVERAGE.** This is a source SCAN. It
 * proves what it can read, and these are the shapes it cannot:
 *
 *   1. **A season id arriving in a request BODY**, not the query string. `READS_A_YEAR` matches
 *      `searchParams.get('year')`; a write that did `const { programYearId } = await req.json()` and
 *      trusted it would violate the rule invisibly. Nothing here would catch it. Today every write
 *      that carries a `programYearId` takes it from a SERVER-resolved context
 *      (`resolveLiveCoachTeamContext`), never from client input — that is architecture by
 *      convention, and this sentence is the only thing recording that it is not architecture by
 *      test. If a body-supplied year is ever genuinely needed, extend the scan in the same change.
 *   2. **Server COMPONENTS and layouts.** The scan reads `app/api/coaches` routes and
 *      `app/[orgSlug]/coaches` pages. A coach surface can also read via a server layout that queries
 *      with the service-role client (`app/[orgSlug]/coaches/teams/[teamId]/layout.tsx` does), and
 *      that path is invisible here. It complies by construction — it resolves the working season
 *      through the same shared resolver — but nothing below would fail if a future edit changed it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const COACH_API_ROOT = join(process.cwd(), 'app', 'api', 'coaches');
const COACH_PAGES_ROOT = join(process.cwd(), 'app', '[orgSlug]', 'coaches');
const WRITE_VERBS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

/**
 * ⚠⚠ **THE LOOK-BACK LAYER, ENUMERATED.** Routes permitted to resolve a season the CALLER names.
 * Everything else resolves the team's working season and cannot address another one at all.
 *
 * There is exactly one, and that is the design rather than an accident of the current build:
 *
 *   · `wrapped` — Season Wrapped for one finished season, and the payload behind the Season's End
 *     page. Reached from the compare list at the bottom of the results report, which is the only
 *     surface in the portal that links to a season other than the working one.
 *
 * ⚠ Adding an entry re-opens the question the owner closed. Three questions first — and note the
 * SECOND one is what the deleted archive kept failing:
 *   1. Is this a RECORD or an INSTRUMENT? Instruments (anything that runs a tryout, moves money,
 *      messages families or configures the team) stay on the working season.
 *   2. Does the whole subtree carry the year? An archive is a container — the unit of work is every
 *      page reachable from the door, not the door. Chunk F's expensive defects were all one level
 *      down, and Season Wrapped is on this list partly because it HAS no level down.
 *   3. Would the coach be able to tell which season they are reading? The page-title season chip
 *      is gone; a surface that can show two different years needs its own answer to that.
 *
 * ⚠ The gated shelf phases (P3 practice plans, P4 the money book) are each an owner mockup session
 * BEFORE any build. Neither may add itself here on the way past.
 */
const HISTORY_ENDPOINTS = ['wrapped'];

/**
 * Pages permitted to read `?year=` — the client half of rule 1. One page, for the same reason.
 * Paths are relative to `app/[orgSlug]/coaches`, with `/page.tsx` dropped.
 */
const HISTORY_PAGES = ['teams/[teamId]/season-end'];

/**
 * Routes that ask the CROSS-SEASON capability question — `resolveCoachTeamCapabilities`, i.e.
 * "may this member open this team at all, and with what?", asked without resolving one season.
 *
 * A different and narrower power than a history endpoint, listed so the two are not confused and
 * so this one cannot grow silently either. Each derives which prior seasons it touches from the
 * team's own data (its season list, the coach's confirmed continuity links), never from the
 * request — which is why neither needs a year parameter and neither can be pointed at a season.
 *
 * ⚠ Deliberately keyed on that ONE resolver rather than on "reads more than one year", which is
 * not mechanically detectable: plenty of live-season routes legitimately look up the prior year to
 * carry something forward. A guard with a noisy signal gets edited until it passes, which is worse
 * than no guard.
 */
const CROSS_SEASON_READERS = [
  'history',        // the compare list — every season at once, by definition
  'tryout-report',  // the returning-improvement aggregate (ruling R8, 2026-08-02)
];

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (entry === 'route.ts') out.push(full);
  }
  return out;
}

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) pageFiles(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
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
 * The three tag libraries collapsed into one factory, so nine route files read
 * `export const { GET, POST } = coachTagCollectionRoutes({…})`. The literal text
 * `export const POST` appears in none of them — which meant the write-side rules below stopped
 * finding a body to inspect and silently `continue`d on all nine, while still reporting green.
 * **A vacuous pass is worse than a failure**: it is the guard going blind while claiming the
 * contract holds.
 *
 * Add a new factory here the day a second one appears; the blindness assertion below fails if a
 * route delegates to something this map does not know about.
 *
 * ⚠ A THIRD shape — `export { POST } from './shared'` — is deliberately counted as "exported" by the
 * blindness test below even though nothing here can follow it. That makes such a route fail LOUDLY
 * (with the instruction to extend this map) instead of vanishing from every rule at once, which is
 * what a re-export would otherwise do: invisible to the detector AND to the extractor, so not even
 * flagged as blind. No route uses it today; the point is that the day one does, the build says so.
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
  if (!new RegExp(`export const \\{[^}]*\\b${verb}\\b[^}]*\\}`).test(src)) return null;
  for (const d of DELEGATED_HANDLERS) {
    if (!d.call.test(src)) continue;
    const delegated = factoryHandlerBody(readFileSync(d.file, 'utf8'), d.fn, verb);
    if (delegated) return delegated;
  }
  return null;
}

const files = routeFiles(COACH_API_ROOT);

/** `app/api/coaches/[orgSlug]/teams/[teamId]/foo/route.ts` → `foo`. */
function routeName(file: string): string {
  return file
    .replace(process.cwd(), '')
    .replace(/^[\\/]app[\\/]api[\\/]coaches[\\/]/, '')
    .replace(/\[orgSlug\][\\/](teams[\\/]\[teamId\][\\/])?/, '')
    .replace(/[\\/]route\.ts$/, '')
    .replace(/\\/g, '/');
}

/** Does this source name a season the CALLER chose? */
const READS_A_YEAR = /searchParams\.get\(\s*['"]year['"]\s*\)|resolveCoachHistoryRead\s*\(/;

/** Reads across seasons without being handed one — see CROSS_SEASON_READERS. */
const READS_ACROSS_SEASONS = /resolveCoachTeamCapabilities\s*\(/;

describe('a year parameter is a decision — the coach API', () => {
  it('finds the coach API routes at all (guards against a vacuous pass)', () => {
    assert.ok(files.length > 40, `expected the coach API tree, found ${files.length} route files`);
  });

  it('only the enumerated history endpoints resolve a season the caller named', () => {
    const actual = files
      .filter(f => READS_A_YEAR.test(readFileSync(f, 'utf8')))
      .map(routeName)
      .sort();
    assert.deepEqual(actual, [...HISTORY_ENDPOINTS].sort(),
      'A coach route gained (or lost) the ability to serve a season the caller names. The season '
      + 'dial was DELETED on 2026-08-16 (Design A) — every other route resolves the team\'s working '
      + 'season and cannot address another one. If this one genuinely belongs in the look-back '
      + 'layer, answer the three questions above HISTORY_ENDPOINTS and add it there in the same '
      + 'commit as the owner\'s decision.');
  });

  it('the cross-season readers are the ones we know about, and no more', () => {
    const actual = files
      .filter(f => {
        const src = readFileSync(f, 'utf8');
        return READS_ACROSS_SEASONS.test(src) && !READS_A_YEAR.test(src);
      })
      .map(routeName)
      .sort();
    assert.deepEqual(actual, [...CROSS_SEASON_READERS].sort(),
      'A coach route started asking the cross-season capability question. That is a narrower power '
      + 'than a history endpoint — it derives which seasons it touches from the team\'s own data '
      + 'rather than from the request — but it is still a route reaching outside the working '
      + 'season, and it is listed on purpose. Add it to CROSS_SEASON_READERS with the reason.');
  });

  /**
   * ⚠⚠ **THE GUARD MUST NOT GO BLIND, and this is the test that says so.** The two write rules
   * below inspect a handler's BODY; a verb whose body cannot be found is silently skipped. That is
   * exactly what happened when nine tag routes moved into a factory.
   */
  it('every exported write verb resolves to a body the rules can actually inspect', () => {
    const blind: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const verb of WRITE_VERBS) {
        const exported = new RegExp(`export const ${verb}\\b`).test(src)
          || new RegExp(`export const \\{[^}]*\\b${verb}\\b[^}]*\\}`).test(src)
          // `export { POST } from './shared'` — see DELEGATED_HANDLERS' note.
          || new RegExp(`export \\{[^}]*\\b${verb}\\b[^}]*\\}`).test(src);
        if (exported && !handlerBody(src, verb)) {
          blind.push(`${file.replace(process.cwd(), '')} → ${verb}`);
        }
      }
    }
    assert.deepEqual(blind, [],
      'These routes export a write verb whose body this guard cannot read, so the two rules below '
      + 'are SKIPPING them and passing vacuously. If the handler was moved into a shared factory, '
      + 'add that factory to DELEGATED_HANDLERS so the contract follows it.');
  });

  it('no write handler reads a season parameter', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const verb of WRITE_VERBS) {
        const body = handlerBody(src, verb);
        if (!body) continue;
        if (/searchParams\.get\(\s*['"]year['"]\s*\)/.test(body)) {
          offenders.push(`${file.replace(process.cwd(), '')} → ${verb}`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      'A write handler reads a season parameter. Writes address the LIVE season only — a season '
      + 'that has finished is a record, and nothing may be written into it.');
  });

  it('no write handler resolves through a read context that admits a finished season', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.replace(process.cwd(), '');
      const src = readFileSync(file, 'utf8');
      for (const verb of WRITE_VERBS) {
        const body = handlerBody(src, verb);
        if (!body) continue;
        if (/resolveCoachTeamRead\s*\(|resolveCoachHistoryRead\s*\(/.test(body)) {
          offenders.push(`${rel} → ${verb}`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      'A write handler uses lib/coach-team-read.ts. Those resolvers admit a FINISHED working '
      + 'season by design — they are read-only infrastructure. Write handlers keep an active-year '
      + 'resolver (resolveLiveCoachTeamContext), which is what makes a finished season unwritable.');
  });
});

describe('a year parameter is a decision — the coach pages', () => {
  const pages = pageFiles(COACH_PAGES_ROOT);

  it('finds the coach pages at all (guards against a vacuous pass)', () => {
    assert.ok(pages.length > 30, `expected the coach page tree, found ${pages.length} files`);
  });

  /**
   * ⚠ The CLIENT half of rule 1, and it is new in P2 — it could not exist before, because ~24 pages
   * legitimately read `?year=` to carry the dial's choice. Now that they do not, an inbound link
   * that appends a year is a dead parameter, and a page that reads one is a page quietly re-growing
   * a season mode. Both used to be invisible: every row renders, and the page is answering about a
   * year the coach cannot see named anywhere.
   */
  it('only Season’s End reads a year off the URL', () => {
    const actual = pages
      .filter(f => /searchParams\.get\(\s*['"]year['"]\s*\)/.test(readFileSync(f, 'utf8')))
      .map(f => f
        .replace(process.cwd(), '')
        .replace(/^[\\/]app[\\/]\[orgSlug\][\\/]coaches[\\/]/, '')
        .replace(/[\\/]page\.tsx$/, '')
        .replace(/\\/g, '/'))
      .sort();
    assert.deepEqual(actual, [...HISTORY_PAGES].sort(),
      'A coach page learned to read `?year=`. There is no season dial to carry: pages render the '
      + 'team\'s WORKING season. Season\'s End is the exception because the compare list links to '
      + 'one finished season by id — a page joining it needs the owner decision that puts its '
      + 'endpoint in HISTORY_ENDPOINTS too.');
  });

  /** The dial itself, pinned absent — the three controls that were deleted. */
  it('no season switcher has grown back in either nav', () => {
    for (const rel of ['components/coaches/CoachesSidebar.tsx', 'components/coaches/CoachesBottomNav.tsx']) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      assert.equal(/coach-season-select|resolveSeasonSwitchHref|seasonStatusLabel/.test(src), false,
        `${rel} has a season switcher again. The sidebar select, the phone More sheet's season `
        + 'list and the page-title chip were deleted together on 2026-08-16 (Design A): a coach '
        + 'reads the season their team is on, and looking back is Season\'s End, Season Wrapped '
        + 'and the compare list. Re-adding one is an owner decision, not a convenience.');
    }
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE DECIDED ABSENCES — carried over verbatim in substance from the archive-is-opt-in guard.
 *
 * Each of these was ruled on by the owner, and each is recorded here so a later session cannot
 * mistake it for a gap. The rulings did not change when the archive did; what changed is the
 * vocabulary they are expressed in.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('the decided absences — instruments never become history surfaces', () => {
  const REACHES_A_NAMED_SEASON = /resolveCoachHistoryRead\s*\(|searchParams\.get\(\s*['"]year['"]\s*\)/;

  /**
   * The drill library (Practice Plans Phase 2). Owner ruling 2026-08-01: a drill library is a
   * reusable INSTRUMENT, not a record of a season. A coach loses nothing — a team is PERMANENT and
   * only its program year turns over, so drills carry forward on their own. What genuinely IS
   * season-locked (past practice plans) is readable through `drills/past-seasons`, which copies
   * forward into the live library and writes nothing back.
   */
  it('the drill library never serves a season it was handed (Practice Plans Phase 2)', () => {
    const drillRoutes = files.filter(f => f.replace(/\\/g, '/').includes('/development/drills'));
    assert.ok(drillRoutes.length >= 2, 'expected the drill routes to exist');
    for (const file of drillRoutes) {
      assert.equal(REACHES_A_NAMED_SEASON.test(readFileSync(file, 'utf8')), false,
        `${file} learned to serve a named season. The drill library is an INSTRUMENT and was ruled `
        + 'live-season-only (owner, 2026-08-01).');
    }
  });

  /**
   * The plan-template library (Practice Plans Phase 3) — the same decided absence, for the same
   * reason. The table is keyed by TEAM rather than by program year, so templates cross a rollover
   * with nothing to import.
   */
  it('the plan-template library never serves a season it was handed (Practice Plans Phase 3)', () => {
    const templateRoutes = files.filter(f => f.replace(/\\/g, '/').includes('/development/plan-templates'));
    assert.ok(templateRoutes.length >= 3, 'expected the plan-template routes to exist');
    for (const file of templateRoutes) {
      assert.equal(REACHES_A_NAMED_SEASON.test(readFileSync(file, 'utf8')), false,
        `${file} learned to serve a named season. A plan-template library is an INSTRUMENT and was `
        + 'ruled live-season-only (owner, 2026-08-01). What IS readable for one past night is one '
        + 'plan, through events/[eventId]/practice-plan/read — a different, narrower door.');
    }
  });

  /**
   * The Opponent Scouting Book — ratified with the project approval (owner, 2026-08-04, again
   * 2026-08-16). The book is an INSTRUMENT: it reads game events from EVERY season to feed the LIVE
   * season's preparation. Notes update in place, so a note written last week is not what the coach
   * saw two years ago. The per-season FACTS stay reachable through Schedule and Insights.
   */
  it('the opponent scouting book stays an instrument (Scouting Book P1)', () => {
    const bookRoutes = files.filter(f => f.replace(/\\/g, '/').includes('/opponents/'));
    assert.ok(bookRoutes.length >= 7, `expected the scouting-book routes to exist, found ${bookRoutes.length}`);
    for (const file of bookRoutes) {
      assert.equal(REACHES_A_NAMED_SEASON.test(readFileSync(file, 'utf8')), false,
        `${file} learned to serve a named season. The scouting book is an INSTRUMENT and was ruled `
        + 'live-season-only (owner, 2026-08-04). If that has genuinely changed, get the decision '
        + 'and give the Insights hub an Opponents door that does not vanish on a finished season.');
    }
  });

  /**
   * The Club Shared Book inherits the book's INSTRUMENT ruling whole — and adds a NEW way to be
   * wrong, which is why it gets its own test: the club layer reads OTHER teams' books, so a year
   * parameter bolted onto it would let one team address another team's past season.
   */
  it('the club shared book is never a door into a sibling’s past', () => {
    for (const rel of ['lib/coach-club-book.ts', 'lib/coach-club-book-server.ts']) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      assert.equal(REACHES_A_NAMED_SEASON.test(src), false,
        `${rel} learned to serve a named season. The club layer is an INSTRUMENT over other teams' `
        + 'books — a year parameter here would make a SIBLING team\'s finished season addressable, '
        + 'which no ruling has ever granted. Take that question to the owner first.');
      // Read-only by construction: curation stays with the team that wrote the words.
      assert.equal(/\.(update|insert|delete|upsert)\s*\(/.test(src), false,
        `${rel} performs a write. The club layer is READ-ONLY — no cross-team edit or delete of `
        + 'any kind (owner ruling, plan §4.4).');
    }
  });

  /**
   * ⚠⚠ **PLAYING TIME IS LIVE-SEASON-ONLY, PERMANENTLY** (owner ruling, 2026-08-16).
   *
   * The reason is governing rule 3 rather than effort: the figures are **recomputed** from saved
   * lineups every time the report is opened, so what it would show for a finished season is what
   * today's code makes of that season's lineups — not what the coach actually read that year.
   * Everything the look-back layer offers is a stored record; this one is a derivation, and a
   * derivation cannot promise "what the coach could see AT THE TIME".
   *
   * The Insights hub hides its tile on a finished season — including the FETCH, not just the door,
   * because a tile hidden over a request still made is how the live season's number leaks into a
   * finding written about a finished one.
   *
   * ⚠ Reversing this needs a new owner ruling AND an answer to the recomputation problem.
   */
  it('playing-time analytics are live-season only, by ruling (2026-08-16)', () => {
    const analytics = files.find(f => f.replace(/\\/g, '/').includes('/lineup-analytics/'));
    assert.ok(analytics, 'expected the lineup-analytics route to exist');
    assert.equal(REACHES_A_NAMED_SEASON.test(readFileSync(analytics!, 'utf8')), false,
      'lineup-analytics learned to serve a named season. Playing time was ruled live-season-only '
      + 'PERMANENTLY (owner, 2026-08-16) because its figures are recomputed. Reversing that needs '
      + 'a new ruling and an answer to the recomputation problem.');

    const hub = readFileSync(join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'history', 'page.tsx'), 'utf8');
    assert.match(hub, /const canLineups = !isRecord &&/,
      'the Insights hub must hide the playing-time tile AND its fetch on a finished season — the '
      + 'same flag gates both, which is what stops a live number reaching a finding about a '
      + 'season that has ended.');
    assert.match(hub, /const canScouting = !isRecord &&/,
      'the scouting tile rides the same rule, for the same reason: the book is today\'s book.');
  });

  /**
   * ⚠ The LIVE practice-plan route must never gain a year. It holds the PUT and the PATCH, so a
   * season parameter on its GET would make the whole editor addressable for a finished season and
   * leave one file carrying both postures. The read-only door is a separate GET-only route beside
   * it, which is why that separation is worth a test rather than a comment.
   */
  it('the LIVE practice-plan route stays live-season only', () => {
    const live = files.find(f => f.replace(/\\/g, '/').endsWith('/practice-plan/route.ts'));
    assert.ok(live, 'expected the live practice-plan route to exist');
    assert.equal(REACHES_A_NAMED_SEASON.test(readFileSync(live!, 'utf8')), false,
      'The live practice-plan route also writes. A season must never be addressable by name from a '
      + 'file that can write — the read-only door is events/[eventId]/practice-plan/read.');
  });
});
