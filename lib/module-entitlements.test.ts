/**
 * Unit tests for `isOrgHomeRealDestination` — the ONE statement of "is /{orgSlug} a real
 * destination?" (Nav Unification Stage B.2; the `is_public` half folded in 2026-08-01 per
 * top-nav repair ruling R1 / audit finding D1).
 *
 * The defect these pin: an org with its "public page" toggle OFF served a 404 behind an
 * ordinary-looking navigation link, because the org page enforced `is_public` while two of the
 * three callers of this predicate re-stated it and the third forgot. Both halves now live here,
 * so the answer cannot drift between a link-renderer and the page it points at.
 *
 * Runs on Node's built-in runner:  `node --test lib/module-entitlements.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOrgHomeRealDestination, type OrgHomeDestinationOrg } from './module-entitlements.ts';

/** A tournament-tier org (no public-site module) with the public page switched ON. */
const tournamentOrg: OrgHomeDestinationOrg = {
  isPublic: true,
  planId: 'tournament',
  subscriptionStatus: 'active',
  enabledAddons: [],
  freeFloor: null,
};

/** A League org — carries `module_public_site`, so its home always renders. */
const leagueOrg: OrgHomeDestinationOrg = {
  isPublic: true,
  planId: 'league',
  subscriptionStatus: 'active',
  enabledAddons: [],
  freeFloor: null,
};

test('the public-site module makes the org home real regardless of event count', () => {
  assert.equal(isOrgHomeRealDestination(leagueOrg, 0), true);
  assert.equal(isOrgHomeRealDestination(leagueOrg, 1), true);
  assert.equal(isOrgHomeRealDestination(leagueOrg, 5), true);
});

test('a tournament-tier org needs 2+ active events for its home to be a real selector', () => {
  assert.equal(isOrgHomeRealDestination(tournamentOrg, 0), false);
  assert.equal(isOrgHomeRealDestination(tournamentOrg, 1), false);
  assert.equal(isOrgHomeRealDestination(tournamentOrg, 2), true);
});

test('the "public page" toggle vetoes BOTH paths — this is the D1 fix', () => {
  // The module path: a League/Club org that switched its public page off.
  assert.equal(isOrgHomeRealDestination({ ...leagueOrg, isPublic: false }, 0), false);
  assert.equal(isOrgHomeRealDestination({ ...leagueOrg, isPublic: false }, 9), false);
  // The event-count path: a tournament org running many events with the page off.
  assert.equal(isOrgHomeRealDestination({ ...tournamentOrg, isPublic: false }, 2), false);
  assert.equal(isOrgHomeRealDestination({ ...tournamentOrg, isPublic: false }, 50), false);
});

test('a canceled subscription still fails the module half (unchanged behaviour)', () => {
  const canceled: OrgHomeDestinationOrg = { ...leagueOrg, subscriptionStatus: 'canceled' };
  assert.equal(isOrgHomeRealDestination(canceled, 0), false);
  // …but the 2+-events path is deliberately independent of the module check, as before.
  assert.equal(isOrgHomeRealDestination(canceled, 2), true);
});
