import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STAFF_KINDS, STAFF_PRESETS, ASSISTANT_DEFAULTS, DEVELOPMENT_GRANT_MESSAGE,
  resolveCoachCapabilities, sanitizeAssistantGrants,
  canWriteDevelopment, canWriteDevelopmentGoals, canViewDevelopmentGoals, canViewMeasurables,
  hasRecordAccess, hasNonMoneyRecordAccess, canWritePracticePlans, staffKindLabel,
  type AssistantCapabilityGrants, type CoachCapabilities,
} from '../../lib/coach-capabilities.ts';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';

/**
 * ═══ THE DEVELOPMENT GRANT (owner ruling 2026-09-11, development lifecycle ruling 9) ═══
 *
 * One "Development" switch on the staff sheet covers EVERY development write — defining and
 * retiring tests, starting sessions, recording results, goals, observations, reviews. Always on
 * for the head coach (and not switchable for themselves); off by default for an assistant; every
 * kind preset carries it off. Reading stays where it was: goals ride Internal notes, results ride
 * record access.
 *
 * ⚠ These are contracts, not preferences. A failure here is a model change, and the fix is a
 * decision entry — not a new expectation.
 */

const assistant = (grants?: AssistantCapabilityGrants): CoachCapabilities =>
  resolveCoachCapabilities('assistant_coach', grants);
const head = (): CoachCapabilities => resolveCoachCapabilities('head_coach');

describe('who may write development', () => {
  it('the head coach always holds it, and no stored grant can take it away', () => {
    assert.equal(head().development, true);
    assert.equal(canWriteDevelopment(head()), true);
    // Head coaches ignore grants entirely — `{ development: false }` on a head row means nothing.
    assert.equal(canWriteDevelopment(resolveCoachCapabilities('head_coach', { development: false })), true);
  });

  it('a fresh assistant does not, and switching it on is the whole difference', () => {
    assert.equal(ASSISTANT_DEFAULTS.development, false);
    assert.equal(canWriteDevelopment(assistant()), false);
    assert.equal(canWriteDevelopment(assistant({ development: true })), true);
    assert.equal(canWriteDevelopment(assistant({ development: false })), false);
  });

  it('every kind preset starts with it OFF — delegation is a per-person decision, never a bundle', () => {
    for (const kind of STAFF_KINDS) {
      assert.equal(STAFF_PRESETS[kind].development, false, `${kind} must carry development: false explicitly`);
      assert.equal(canWriteDevelopment(assistant(STAFF_PRESETS[kind])), false, kind);
    }
  });

  it('survives the client sanitiser both ways, so the sheet’s PATCH cannot drop it', () => {
    assert.deepEqual(sanitizeAssistantGrants({ development: true }), { development: true });
    assert.deepEqual(sanitizeAssistantGrants({ development: false }), { development: false });
    assert.deepEqual(sanitizeAssistantGrants({ development: 'yes' }), {});
  });

  /**
   * A write grant with no read door is a dead switch. A helper holds none of the record duties, so
   * without this the Skills & Goals door, the roster and every development read would stay shut on
   * a person the head coach just delegated recording to. Record access is the UNION of duties by
   * design (A1, 2026-08-03) — this is the eighth duty, and it self-corrects the way the others do.
   */
  it('opens the record surfaces for a coach whose only duty is development', () => {
    const helperPlusDevelopment = assistant({ ...STAFF_PRESETS.helper, development: true });
    assert.equal(hasRecordAccess(helperPlusDevelopment), true);
    assert.equal(hasNonMoneyRecordAccess(helperPlusDevelopment), true);
    assert.equal(canViewMeasurables(helperPlusDevelopment), true);
    assert.equal(isCoachNavItemVisible(helperPlusDevelopment, 'Development'), true);
    assert.equal(isCoachNavItemVisible(helperPlusDevelopment, 'Roster'), true);
    // And the plain helper is exactly as shut as before.
    assert.equal(hasRecordAccess(assistant(STAFF_PRESETS.helper)), false);
  });

  /**
   * Goals are read through Internal notes (unchanged). Writing a goal you cannot read back is the
   * standing contradiction the scouting summary already refuses, so a goal write needs both.
   */
  it('goal writes need the grant AND Internal notes; result writes need the grant alone', () => {
    const grantOnly = assistant({ development: true, notes: false });
    assert.equal(canWriteDevelopment(grantOnly), true);
    assert.equal(canViewDevelopmentGoals(grantOnly), false);
    assert.equal(canWriteDevelopmentGoals(grantOnly), false);
    const both = assistant({ development: true, notes: true });
    assert.equal(canWriteDevelopmentGoals(both), true);
    assert.equal(canWriteDevelopmentGoals(assistant({ notes: true })), false, 'notes alone never writes');
    assert.equal(canWriteDevelopmentGoals(head()), true);
  });

  /**
   * The display fallback for a row written before mig 288 derives "helper" from holding NO record
   * duty. Development is a duty now, so such a row granted the switch reads "assistant" — intended:
   * a person who records results is not a station helper any more. A label only; it gates nothing.
   */
  it('a pre-288 helper granted Development is labelled an assistant by the fallback (a label, never a gate)', () => {
    assert.equal(staffKindLabel(assistant({ ...STAFF_PRESETS.helper, development: true }), null), 'assistant');
    assert.equal(staffKindLabel(assistant({ ...STAFF_PRESETS.helper, development: true }), 'helper'), 'helper', 'a STORED kind still wins');
  });

  it('does not touch the practice-plan seam (R7): plans, drills and templates still ride schedule editing', () => {
    const grantOnly = assistant({ ...STAFF_PRESETS.helper, development: true });
    assert.equal(canWritePracticePlans(grantOnly), false);
    assert.equal(canWritePracticePlans(assistant({ development: false })), true, 'the default assistant edits the schedule');
  });
});

// ── Source guard: the routes say what the model says ───────────────────────────────────────────
const ROOT = process.cwd();
const TEAM_API = 'app/api/coaches/[orgSlug]/teams/[teamId]';
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const read = (p: string) => codeOnly(readFileSync(join(ROOT, p), 'utf8'));

/** Every route under the development umbrella that WRITES a development record. */
const DEVELOPMENT_WRITE_ROUTES = [
  `${TEAM_API}/development/measurable-types/route.ts`,
  `${TEAM_API}/development/measurable-types/[typeId]/route.ts`,
  `${TEAM_API}/development/sessions/route.ts`,
  `${TEAM_API}/development/sessions/[sessionId]/route.ts`,
  `${TEAM_API}/development/continuity/route.ts`,
  `${TEAM_API}/development/continuity/[linkId]/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/goals/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/goals/[goalId]/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/measurables/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/measurables/[entryId]/route.ts`,
  `${TEAM_API}/tryout-baselines/route.ts`,
  // Phase 2 (2026-09-13): not-assessed marks, observations, goal reviews.
  `${TEAM_API}/development/sessions/[sessionId]/not-assessed/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/observations/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/observations/[observationId]/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/goals/[goalId]/reviews/route.ts`,
];
/** The ones that write a coach's JUDGEMENT about a child — goals, observations, reviews — which
 *  need notes as well (see above). */
const GOAL_WRITE_ROUTES = new Set([
  `${TEAM_API}/roster/[playerId]/development/goals/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/goals/[goalId]/route.ts`,
  `${TEAM_API}/tryout-baselines/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/observations/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/observations/[observationId]/route.ts`,
  `${TEAM_API}/roster/[playerId]/development/goals/[goalId]/reviews/route.ts`,
]);
/** The per-player routes may gate through the ONE shared resolver instead of inline — the gate
 *  literal it is called with is the proof, and the resolver itself is checked below to hold the
 *  real predicates, so the delegation is never a hollow claim. */
const PLAYER_RESOLVER = 'lib/development-player-route.ts';
const viaResolver = (src: string, gate: 'results' | 'goals') =>
  new RegExp(String.raw`resolveDevelopmentPlayerContext\([^)]*'${gate}'\)`).test(src);

describe('the development routes refuse with the grant’s own sentence, never "Only the head coach"', () => {
  it('no development write route still claims head-coach-only', () => {
    for (const route of DEVELOPMENT_WRITE_ROUTES) {
      const src = read(route);
      // The tryout-seeding route ALSO gates on `tryouts`, whose refusal is the tryout family's own
      // sentence and out of this ruling's reach — so there the check is on the development half.
      const scope = route.endsWith('tryout-baselines/route.ts') ? src.replace(/Only the head coach manages tryouts./g, '') : src;
      assert.doesNotMatch(scope, /Only the head coach/, `${route} still says "Only the head coach" — the grant made that untrue`);
      if (!viaResolver(src, 'results') && !viaResolver(src, 'goals')) {
        assert.match(src, /DEVELOPMENT_GRANT_MESSAGE/, `${route} must refuse with the shared sentence`);
      }
    }
    assert.match(read(PLAYER_RESOLVER), /DEVELOPMENT_GRANT_MESSAGE/, 'the shared resolver must refuse with the shared sentence');
  });

  it('every write gates through the grant predicate, and goal writes through the compound one', () => {
    const resolver = read(PLAYER_RESOLVER);
    assert.match(resolver, /gate === 'goals' \? canWriteDevelopmentGoals\(/, 'the resolver’s goals gate is the compound one');
    assert.match(resolver, /: canWriteDevelopment\(/, 'the resolver’s results gate is the grant');
    assert.match(resolver, /denyUnless\(allowed, DEVELOPMENT_GRANT_MESSAGE\)/);
    for (const route of DEVELOPMENT_WRITE_ROUTES) {
      const src = read(route);
      if (GOAL_WRITE_ROUTES.has(route)) {
        assert.ok(viaResolver(src, 'goals') || /denyUnless\(canWriteDevelopmentGoals\(/.test(src), `${route} writes a goal — it needs the grant AND notes`);
        assert.ok(!viaResolver(src, 'results'), `${route} writes a goal and must not resolve on the results gate`);
      } else {
        assert.ok(viaResolver(src, 'results') || /canWriteDevelopment\(/.test(src), route);
      }
    }
  });

  it('the shared sentence names the grant and the remedy', () => {
    assert.match(DEVELOPMENT_GRANT_MESSAGE, /Development grant/);
    assert.match(DEVELOPMENT_GRANT_MESSAGE, /head coach/);
  });

  it('the staff sheet enumerates the grant, so a PATCH from it cannot drop the switch', () => {
    // The sheet's `grantsFrom` is the model's `grantsOf` since 2026-09-13 (the server reads the same
    // enumeration to compare bundles) — the promise is the same: every key is sent, or the type fails.
    const model = read('lib/coach-capabilities.ts');
    const grantsOf = model.slice(model.indexOf('export function grantsOf'), model.indexOf('}', model.indexOf('export function grantsOf')) + 1);
    assert.match(grantsOf, /development: c\.development/, 'grantsOf() must send the development key');
    const sheet = read('components/coaches/CoachStaffSheet.tsx');
    assert.match(sheet, /grantsFrom[^\n]*= grantsOf/, 'the sheet must send bundles through grantsOf');
    assert.match(sheet, /key: 'development'/, 'the sheet must render the Development switch');
  });
});
