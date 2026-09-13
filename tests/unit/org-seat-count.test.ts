import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countsAsSeat, seatExemptRoles } from '../../lib/roles.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';

/**
 * Which memberships are seats (owner ruling 2026-09-13: "coaching staff don't count"). One rule,
 * read by the invite-time guard, the seat-count read and the Members page — this pins the rule
 * itself, so the three cannot drift apart by re-deriving it.
 */
describe('countsAsSeat', () => {
  const free = { officialsFreeSeats: true };
  const paid = { officialsFreeSeats: false };

  it('coaching staff never count, on any plan', () => {
    assert.equal(countsAsSeat('coach', free), false);
    assert.equal(countsAsSeat('coach', paid), false);
  });

  it('officials count only where the plan does not free them', () => {
    assert.equal(countsAsSeat('official', free), false);
    assert.equal(countsAsSeat('official', paid), true);
  });

  it('everyone who runs the org side is a seat', () => {
    for (const role of ['owner', 'admin', 'staff', 'league_admin', 'league_registrar', 'treasurer'] as const) {
      assert.equal(countsAsSeat(role, free), true, role);
      assert.equal(countsAsSeat(role, paid), true, role);
    }
  });

  it('the database exclusion list agrees with the predicate', () => {
    assert.deepEqual(seatExemptRoles(free), ['coach', 'official']);
    assert.deepEqual(seatExemptRoles(paid), ['coach']);
  });

  it('a Premium workspace with three coaching staff has its bundled 3-seat guard EMPTY, not full', () => {
    const team = PLAN_CONFIG.team;
    const members = ['owner', 'coach', 'coach', 'coach'];
    const seats = members.filter(r => countsAsSeat(r, team)).length;
    assert.equal(seats, 1, 'the owner is the only seat');
    assert.ok(seats < team.seatLimit, 'room to invite an org-side co-organizer');
  });
});
