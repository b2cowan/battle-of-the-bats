/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE READS THAT USED TO ANSWER EVERY TEAM MEMBER** — a code-scanning guard for the staff access
 * review's pass 1 (2026-09-10).
 *
 * Five GET handlers checked only "is this caller on the team's staff" while the writes beside them
 * checked a grant. The severe one: `announcements` GET returned the full text of every email the
 * staff sent to families, plus recipient counts, to a schedule-only helper — the content the POST
 * governs, without the grant that governs it. `tournament-history` handed over the team's whole
 * tournament record; `history` every season the team has played.
 *
 * WHY A GUARD RATHER THAN A COMMENT. A read gate is invisible when it is missing: the route still
 * works for everyone who should reach it, every test written from a head coach's account passes,
 * and the only person who notices is the one the gate was for. This test reads the code, not the
 * prose, so a refactor that deletes the `denyUnless` line while keeping the paragraph fails.
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

/** The GET handler's body only — from `export const GET` to the next exported handler (or EOF). */
function getHandler(src: string): string {
  const start = src.indexOf('export const GET');
  assert.notEqual(start, -1, 'the route must export a GET handler');
  const rest = src.slice(start + 'export const GET'.length);
  const next = rest.search(/export const (POST|PATCH|PUT|DELETE)/);
  return next === -1 ? rest : rest.slice(0, next);
}

const READ_GATES: ReadonlyArray<{ route: string; predicate: RegExp; why: string }> = [
  {
    route: `${TEAM_API}/announcements/route.ts`,
    predicate: /denyUnless\([^)]*announcementsSend/,
    why: 'the sent-announcement log and recipient counts are readable only with the grant that governs sending',
  },
  {
    route: `${TEAM_API}/tournament-history/route.ts`,
    predicate: /denyUnless\([\s\S]{0,120}?canConfigureTeam\(/,
    why: 'the tournament record is readable only by a coach the Tournaments door opens for',
  },
  {
    route: `${TEAM_API}/history/route.ts`,
    predicate: /denyUnless\(hasNonMoneyRecordAccess\(/,
    why: 'the cross-season compare list is readable only by a coach the Insights door opens for',
  },
  {
    route: `${TEAM_API}/upgrade-summary/route.ts`,
    predicate: /denyUnless\([^)]*isHeadCoach/,
    why: 'the workspace migration record is the head coach’s, like the dismiss beside it',
  },
  {
    route: 'app/api/coaches/[orgSlug]/team-links/route.ts',
    predicate: /denyUnless\(resolved\.isHeadCoach/,
    why: 'the organization-link list is the head coach’s, like the actions beside it',
  },
  {
    route: `${TEAM_API}/practice-plans/past-seasons/route.ts`,
    predicate: /denyUnless\(canReadPastPracticePlans\(/,
    why: 'every past-plan read gates on the look-back predicate, and this was the one that did not',
  },
];

for (const { route, predicate, why } of READ_GATES) {
  test(`${route} — GET is gated: ${why}`, () => {
    assert.match(getHandler(read(route)), predicate);
  });
}

test('the schedule panel builds its tabs from the doors object, never unconditionally', () => {
  const page = read('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx');
  assert.match(page, /scheduleDrawerDoors\(/, 'the panel must derive its doors from lib/coach-schedule-doors');
  assert.doesNotMatch(
    page,
    /slideTabs[^\n]*=\s*\[\s*\{\s*key:\s*'attendance'/,
    'the Attendance tab must not be seeded for everyone — it rides the attendance grant',
  );
  assert.match(page, /drawerDoors\.attendanceTab\)\s*slideTabs\.push/, 'the Attendance tab rides drawerDoors.attendanceTab');
  assert.match(page, /drawerDoors\.lineupTab\)\s*slideTabs\.push/, 'the Lineup tab rides drawerDoors.lineupTab');
  assert.match(page, /drawerDoors\.scoreForm\s*&&/, 'the score form rides drawerDoors.scoreForm');
  assert.match(page, /drawerDoors\.awards\s*&&/, 'the award button rides drawerDoors.awards');
});

test('the pages behind hidden nav doors render the shared not-granted block, not a false empty state', () => {
  const pages = [
    'roster/page.tsx',
    'documents/page.tsx',
    'accounting/page.tsx',
    'history/page.tsx',
    'announcements/page.tsx',
    'chat/page.tsx',
    'tournaments/page.tsx',
    'development/board/page.tsx',
  ];
  for (const p of pages) {
    const src = read(`app/[orgSlug]/coaches/teams/[teamId]/${p}`);
    assert.match(src, /<CoachNotGranted/, `${p} must render CoachNotGranted for a coach its nav door hides`);
  }
});
