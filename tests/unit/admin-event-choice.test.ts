/**
 * THE CHOSEN TOURNAMENT (Navigation Phase 0, docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md §5): one rule, read by the
 * server's first paint and by the browser. The order is the provider's from before the cookie existed: the caller's pick →
 * the address's id → its slug → the saved choice → the live event → the first. A candidate that is not in the list (a
 * deleted event, another organization's, one this person is not assigned to) falls through, and only a CHOICE is
 * remembered, never the fallback.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';
import { chooseTournament, adminEventCookieName, adminEventCookiePath } from '../../lib/admin-event-choice.ts';

const list = [
  { id: 'a', slug: 'spring', status: 'completed' },
  { id: 'b', slug: 'invitational', status: 'active' },
  { id: 'c', slug: 'summer', status: 'draft' },
];

describe('chooseTournament', () => {
  it('a caller’s pick outranks the address and the saved choice', () => {
    const r = chooseTournament(list, { pick: 'c', urlId: 'a', savedIds: ['a'] });
    assert.equal(r.current?.id, 'c');
    assert.equal(r.remember?.id, 'c');
  });

  it('the address’s id, then its slug, outrank the saved choice', () => {
    assert.equal(chooseTournament(list, { urlId: 'a', urlSlug: 'summer', savedIds: ['c'] }).current?.id, 'a');
    assert.equal(chooseTournament(list, { urlSlug: 'summer', savedIds: ['a'] }).current?.id, 'c');
  });

  it('the saved choice is tried in order; the first one in the list wins', () => {
    const r = chooseTournament(list, { savedIds: ['gone', 'a', 'c'] });
    assert.equal(r.current?.id, 'a');
    assert.equal(r.remember?.id, 'a');
  });

  it('a stale, foreign or forbidden choice falls back to the live event, and nothing is remembered', () => {
    const r = chooseTournament(list, { pick: 'gone', urlId: 'other-org', urlSlug: 'nope', savedIds: ['deleted', null, undefined] });
    assert.equal(r.current?.id, 'b');
    assert.equal(r.remember, null);
  });

  it('with no live event, the first; with no events, nothing', () => {
    const noLive = list.filter(t => t.status !== 'active');
    assert.equal(chooseTournament(noLive, {}).current?.id, 'a');
    assert.deepEqual(chooseTournament([], { savedIds: ['a'] }), { current: null, remember: null });
  });

  it('an empty slug never matches an event without one', () => {
    const withBlank = [...list, { id: 'd', slug: '', status: 'draft' }];
    assert.equal(chooseTournament(withBlank, { urlSlug: '' }).current?.id, 'b');
  });
});

describe('the cookie', () => {
  it('is one per organization, sent only to that organization’s admin', () => {
    assert.notEqual(adminEventCookieName('club-a'), adminEventCookieName('club-b'));
    assert.equal(adminEventCookiePath('club-a'), '/club-a/admin');
  });

  it('the server and the browser read the choice through the one rule', () => {
    const provider = readCode('lib/tournament-context.tsx');
    const server = readCode('lib/admin-tournament-list.ts');
    assert.match(provider, /chooseTournament\(/, 'the provider decides with chooseTournament');
    assert.match(server, /adminEventCookieName\(orgSlug\)/, 'the server reads the org’s own cookie');
    assert.match(server, /getAuthContextWithScope\(\{ orgSlug, requireOrgSlug: true \}\)/,
      'the seed asks with the list route’s own auth call, so it never names an event the route would refuse');
    const route = readCode('app/api/admin/tournaments/route.ts');
    assert.match(route, /readAdminTournamentRows\(/, 'the list route and the first paint share one read');
  });
});
