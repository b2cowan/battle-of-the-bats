/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE STAFF ROUTES' FOUR PROMISES** — a code-scanning guard for pass 2 of the staff access plan
 * (2026-09-11), in the idiom of `coach-read-gates-guard.test.ts`.
 *
 *   1. An invite REQUIRES a kind. The sheet forces the choice; a route that quietly defaulted a
 *      missing kind would reopen the "safer accident" the sheet was built to close.
 *   2. The last head coach cannot be demoted or removed — from the portal. Both write paths read
 *      the one pure rule, and the portal's removal opts into it explicitly.
 *   3. A pending invite is head-coach-only and team-scoped on every verb: an id from another team
 *      is a 404, never a row.
 *   4. Practice-plan, drill and template WRITES gate on `canWritePracticePlans`, and the past-season
 *      library imports on BOTH that and the look-back read — never on the head-only Development
 *      predicate they borrowed until R7.
 *
 * WHY A GUARD RATHER THAN A COMMENT. Each of these is invisible when it is missing: the route
 * still works for the head coach who tests it, and the only person who notices is the one the
 * rule was for. This reads the code, not the prose, so a refactor that deletes a line while
 * keeping its paragraph fails.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEAM_API = 'app/api/coaches/[orgSlug]/teams/[teamId]';

/** Comments stripped — this guard is about code. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}
const read = (p: string) => codeOnly(readFileSync(join(ROOT, p), 'utf8'));

/** One exported handler's body — from `export const METHOD` to the next exported handler (or EOF). */
function handler(src: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'): string {
  const start = src.indexOf(`export const ${method}`);
  assert.notEqual(start, -1, `the route must export a ${method} handler`);
  const rest = src.slice(start + `export const ${method}`.length);
  const next = rest.search(/export const (GET|POST|PATCH|PUT|DELETE)/);
  return next === -1 ? rest : rest.slice(0, next);
}

// ── 1. The invite requires a kind ──────────────────────────────────────────────────────────────
test('the head coach’s invite refuses a body with no kind — nothing is preselected on the sheet, and nothing is defaulted here', () => {
  const src = read(`${TEAM_API}/staff/invite/route.ts`);
  const post = handler(src, 'POST');
  assert.match(post, /sanitizeStaffKind\(body\.kind\)/, 'the kind must be read through the sanitiser');
  assert.match(post, /if \(!kind\) return NextResponse\.json\([\s\S]{0,120}?status: 400/, 'a missing or unknown kind must 400 before any write');
  assert.doesNotMatch(post, /body\.preset/, 'the Phase 4 `preset` field is retired — a kind is the only word the route takes');
  assert.match(post, /staffKind: kind/, 'the kind must be stored on the invite');
});

// ── 2. The last head coach ─────────────────────────────────────────────────────────────────────
test('both membership write paths decide the last-head rule from the one pure function', () => {
  const lib = read('lib/coach-membership.ts');
  const setRole = lib.slice(lib.indexOf('export async function setStaffMemberRole'), lib.indexOf('export async function updateStaffMemberAccess'));
  assert.match(setRole, /wouldLeaveNoHeadCoach\(/, 'a demotion must ask the rule');
  assert.match(setRole, /countActiveHeadCoaches\(teamId\)\) === 0/, 'and re-count AFTER the write, so two racing demotions converge on a refusal rather than a headless team');
  const remove = lib.slice(lib.indexOf('export async function removeStaffMember'), lib.indexOf('export async function updateStaffMemberAccess'));
  assert.match(remove, /refuseLastHeadCoach/, 'removal must offer the rule');
  assert.match(remove, /wouldLeaveNoHeadCoach\(/, 'and decide it from the same function');
});

test('the portal’s DELETE opts into the last-head refusal and the PATCH turns the refusal into a 409', () => {
  const src = read(`${TEAM_API}/staff/[coachId]/route.ts`);
  const del = handler(src, 'DELETE');
  assert.match(del, /refuseLastHeadCoach: true/, 'a head coach removing another head coach must be refused on the last one');
  assert.match(del, /'last_head'[\s\S]{0,160}?status: 409/, 'the refusal must be a 409 with the shared wording, not a 500');
  const patch = handler(src, 'PATCH');
  assert.match(patch, /setStaffMemberRole\(/, 'the role change must go through the guarded write');
  assert.match(patch, /reason === 'last_head'[\s\S]{0,120}?status: 409/, 'and refuse the last demotion as a 409');
  assert.match(src, /target\.userId === ctx\.user\.id/, 'a head coach may never target their own row');
});

// ── 3. Pending invites: head-coach-only, team-scoped, every verb ───────────────────────────────
test('every verb on a pending invite resolves the caller as THIS team’s head coach and the invite as THIS team’s', () => {
  const src = read(`${TEAM_API}/staff/invites/[inviteId]/route.ts`);
  assert.match(src, /requireHeadCoachMembership\(orgSlug, teamId/, 'the shared head-coach gate');
  assert.match(src, /getOpenAssistantInviteForTeam\(inviteId, teamId\)/, 'the invite read must carry the team — a foreign id is a 404');
  for (const method of ['PATCH', 'POST', 'DELETE'] as const) {
    assert.match(handler(src, method), /resolveInvite\(orgSlug, teamId, inviteId\)/, `${method} must go through the shared resolver`);
  }
  const lib = read('lib/assistant-invites.ts');
  for (const fn of ['getOpenAssistantInviteForTeam', 'updateAssistantInviteAccess', 'resendAssistantInvite']) {
    const body = lib.slice(lib.indexOf(`export async function ${fn}`));
    const firstQuery = body.slice(0, body.indexOf('maybeSingle'));
    assert.match(firstQuery, /\.eq\('team_id', teamId\)/, `${fn} must re-assert team_id in its own WHERE`);
  }
});

// ── 4. Plan, drill and template writes follow "Schedule: View + edit" ──────────────────────────
const PLAN_WRITES: ReadonlyArray<{ route: string; method: 'POST' | 'PUT' | 'PATCH' }> = [
  { route: `${TEAM_API}/events/[eventId]/practice-plan/route.ts`, method: 'PUT' },
  { route: `${TEAM_API}/events/[eventId]/practice-plan/route.ts`, method: 'PATCH' },
  { route: `${TEAM_API}/development/drills/route.ts`, method: 'POST' },
  { route: `${TEAM_API}/development/drills/[drillId]/route.ts`, method: 'PATCH' },
  { route: `${TEAM_API}/development/plan-templates/route.ts`, method: 'POST' },
  { route: `${TEAM_API}/development/plan-templates/[templateId]/route.ts`, method: 'PATCH' },
];
test('every plan, drill and template write gates on canWritePracticePlans and none on the head-only Development predicate', () => {
  for (const { route, method } of PLAN_WRITES) {
    const body = handler(read(route), method);
    assert.match(body, /denyUnless\(\s*canWritePracticePlans\(/, `${route} ${method}`);
    assert.doesNotMatch(body, /canWriteDevelopment\(/, `${route} ${method} must not borrow the Skills & Goals gate any more`);
  }
});

test('the past-season library imports need BOTH the library write and the look-back read', () => {
  for (const route of [`${TEAM_API}/development/drills/past-seasons/route.ts`, `${TEAM_API}/development/plan-templates/past-seasons/route.ts`]) {
    const get = handler(read(route), 'GET');
    assert.match(get, /canWritePracticePlans\([^)]*\) && canReadPastPracticePlans\(/, route);
    assert.doesNotMatch(get, /canWriteDevelopment\(/, route);
  }
});

test('Skills & Goals writes stay head-coach-only — the seam R7 did not cross', () => {
  for (const route of [
    `${TEAM_API}/roster/[playerId]/development/goals/route.ts`,
    `${TEAM_API}/roster/[playerId]/development/measurables/route.ts`,
    `${TEAM_API}/development/sessions/route.ts`,
    `${TEAM_API}/development/measurable-types/route.ts`,
  ]) {
    const post = handler(read(route), 'POST');
    assert.match(post, /denyUnless\(canWriteDevelopment\(/, `${route} must still gate on the head-only Development predicate`);
  }
});
