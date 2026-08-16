/**
 * THE PROJECTION INVARIANT, made structural (M1, 2026-08-16 — /simplify altitude finding).
 *
 * `rep_team_staff_memberships` is the only access truth; `rep_team_coaches` is the per-season
 * record plus a live-season projection that lib/coach-membership.ts keeps in sync. Two rules
 * hold that model together, and both used to live only in comments:
 *
 *  1. The M1-converted routes must never slide back onto the legacy row-reading lookups —
 *     reading access or capabilities from a season row when a membership exists re-opens the
 *     exact defect class the model replaced (stale grants gating live decisions).
 *  2. Membership rows are WRITTEN in exactly one module. A second writer would fork the
 *     revocation/reactivation semantics the owner ruled on (revoke keeps the record; re-add
 *     restores it).
 *
 * Style matches coach-season-write-guard.test.ts: explicit allow-lists over a source scan —
 * the ~54 legacy write routes legitimately still resolve season rows (that is what the
 * projection is FOR), so a tree-wide ban would be wrong; a precise whitelist is enforceable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/** The routes converted to membership resolution in P1. Additions here are deliberate. */
const MEMBERSHIP_CONVERTED_ROUTES = [
  join('app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'staff', 'route.ts'),
  join('app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'staff', '[coachId]', 'route.ts'),
  join('app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'staff', 'invite', 'route.ts'),
  join('app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'seasons', 'route.ts'),
  join('app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'route.ts'),
  join('app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'roster', '[playerId]', 'documents', 'route.ts'),
];

/** Row-reading lookups a membership-converted route must never regain. */
const LEGACY_ROW_LOOKUPS = [
  'getCoachingAssignmentsForUser',
  'getClosedCoachingAssignmentsForUser',
  'getRepTeamStaffForYear',
  'getRepTeamCoachById',
];

/** The only modules that may touch the memberships table directly. */
const MEMBERSHIP_TABLE_ACCESSORS = [
  join('lib', 'coach-membership.ts'),
  // Read-only membership FILTER inside the closed-assignments lookup — inlined there because
  // coach-membership.ts imports db.ts (a reverse import would cycle). Never writes.
  join('lib', 'db.ts'),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('coach membership — the projection invariant is structural, not conventional', () => {
  it('membership-converted routes never regain a legacy row-reading lookup', () => {
    for (const rel of MEMBERSHIP_CONVERTED_ROUTES) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      for (const fn of LEGACY_ROW_LOOKUPS) {
        assert.ok(!src.includes(fn),
          `${rel} references ${fn} — access truth is the TEAM MEMBERSHIP `
          + '(lib/coach-membership.ts). Reading a season row for access or capabilities here '
          + 're-opens the stale-projection defect class M1 closed. If this is deliberate, it '
          + 'needs an owner ruling and an edit to this list.');
      }
    }
  });

  it('the converted routes actually resolve membership (the whitelist is not guarding a no-op)', () => {
    for (const rel of MEMBERSHIP_CONVERTED_ROUTES) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      assert.match(src, /requireHeadCoachMembership\(|getEntitledTeamMembership\(/,
        `${rel} no longer resolves a team membership — if its gate moved somewhere shared, `
        + 'point this test at the new shape rather than deleting the assertion.');
    }
  });

  it('exactly one module family touches rep_team_staff_memberships directly', () => {
    // Source scan across app/ + lib/; tests and scripts provision fixtures with service-role
    // clients on purpose and are exempt.
    const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))];
    const offenders = files
      .filter(f => {
        const src = readFileSync(f, 'utf8');
        if (!src.includes("from('rep_team_staff_memberships')")) return false;
        return !MEMBERSHIP_TABLE_ACCESSORS.some(allowed => f.endsWith(allowed));
      })
      .map(f => f.slice(ROOT.length + 1));
    assert.deepEqual(offenders, [],
      'A new module reaches into rep_team_staff_memberships directly. Membership semantics '
      + '(revoke keeps the record, re-add reactivates, the live-season projection mirrors every '
      + 'write) live in lib/coach-membership.ts — route everything through it, or add the module '
      + 'here with a reason.');
  });
});
