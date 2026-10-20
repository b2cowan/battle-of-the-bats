import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  publicClubRefusal,
  isPublicClubSiteOpen,
  type PublicClubPage,
  type PublicClubAccessOrg,
} from '../../lib/public-club-access.ts';
import { clubNotFoundFace } from '../../lib/club-not-found-face.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE RULE, ONE REFUSAL (Club Tier Stage 4a; Ask 5 ruled 2026-10-19). The one question every public club page asks
 * before it renders, and the one decision about which face a "not found" wears. Pure functions, so the rule is pinned
 * here and the wiring is pinned by club-stage4a-guard.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const PAGES: PublicClubPage[] = ['home', 'teams', 'league', 'archives'];

function org(over: Partial<PublicClubAccessOrg> = {}): PublicClubAccessOrg {
  return { isPublic: true, subscriptionStatus: 'active', planId: 'club', enabledAddons: [], freeFloor: null, accountKind: 'organization', ...over } as PublicClubAccessOrg;
}

describe('the one question', () => {
  it('no club → refused on every page', () => {
    for (const p of PAGES) assert.equal(publicClubRefusal(null, p), 'no-club', p);
  });
  it('a club whose site is off is refused on every page (F06, F07)', () => {
    for (const p of PAGES) assert.equal(publicClubRefusal(org({ isPublic: false }), p), 'site-closed', p);
  });
  it('a cancelled club is refused on every page, whatever its switch says', () => {
    for (const p of PAGES) assert.equal(publicClubRefusal(org({ subscriptionStatus: 'canceled' }), p), 'site-closed', p);
  });
  it('a live Club org renders every page', () => {
    for (const p of PAGES) assert.equal(publicClubRefusal(org(), p), null, p);
  });
  it('past_due is not cancelled (the billing rail keeps it open)', () => {
    assert.equal(publicClubRefusal(org({ subscriptionStatus: 'past_due' }), 'teams'), null);
  });
  it('a plan that does not carry rep teams refuses the team and tryout pages', () => {
    assert.equal(publicClubRefusal(org({ planId: 'league' }), 'teams'), 'not-in-plan');
    assert.equal(publicClubRefusal(org({ planId: 'tournament' }), 'teams'), 'not-in-plan');
  });
  it('a plan that does not carry house league refuses the league pages', () => {
    assert.equal(publicClubRefusal(org({ planId: 'tournament' }), 'league'), 'not-in-plan');
    assert.equal(publicClubRefusal(org({ planId: 'league' }), 'league'), null);
  });
  it('a rep-teams add-on carries the team pages', () => {
    assert.equal(publicClubRefusal(org({ planId: 'tournament', enabledAddons: ['module_rep_teams'] }), 'teams'), null);
  });
  it('a standalone coach’s team (the team plan) keeps its team page: rep teams are per team there, not in the plan', () => {
    assert.equal(publicClubRefusal(org({ planId: 'team' }), 'teams'), null);
    assert.equal(publicClubRefusal(org({ planId: 'tournament', accountKind: 'team_workspace' }), 'teams'), null);
    assert.equal(publicClubRefusal(org({ planId: 'team', isPublic: false }), 'teams'), 'site-closed');
    assert.equal(publicClubRefusal(org({ planId: 'team' }), 'league'), 'not-in-plan');
  });
  it('a tournament-only org keeps its basic home', () => {
    assert.equal(publicClubRefusal(org({ planId: 'tournament' }), 'home'), null);
  });
  it('isPublicClubSiteOpen is the switch AND not cancelled', () => {
    assert.equal(isPublicClubSiteOpen(org()), true);
    assert.equal(isPublicClubSiteOpen(org({ isPublic: false })), false);
    assert.equal(isPublicClubSiteOpen(org({ subscriptionStatus: 'canceled' })), false);
  });
});

describe('which face a "not found" wears', () => {
  const open = { slug: 'lynx', siteOpen: true };
  const closed = { slug: 'lynx', siteOpen: false };

  it('a club page of a closed club is the neutral refusal', () => {
    for (const path of ['/lynx', '/lynx/', '/lynx/teams/15u', '/lynx/teams/15u/tryouts/register', '/lynx/league',
      '/lynx/archives', '/lynx/archives/abc', '/lynx/schedule', '/lynx/results']) {
      assert.equal(clubNotFoundFace(path, closed).face, 'refusal', path);
    }
  });
  it('a club page of a live club is "not found" inside the club', () => {
    assert.deepEqual(clubNotFoundFace('/lynx/teams/nope', open), { face: 'in-club', variant: 'teams' });
    assert.deepEqual(clubNotFoundFace('/lynx/league', open), { face: 'in-club', variant: 'league' });
    // a missing or unpublished SEASON of a club that runs a league is a plain not-found, never "doesn't run a house league"
    assert.deepEqual(clubNotFoundFace('/lynx/league/2026-spring', open), { face: 'in-club', variant: 'page' });
    assert.deepEqual(clubNotFoundFace('/lynx/schedule', open), { face: 'in-club', variant: 'page' });
    assert.deepEqual(clubNotFoundFace('/lynx/archives/x', open), { face: 'in-club', variant: 'page' });
  });
  it('tournament, admin, coach and volunteer addresses keep the platform page (out of 4a)', () => {
    for (const site of [open, closed]) {
      for (const path of ['/lynx/summer-cup', '/lynx/summer-cup/schedule', '/lynx/admin/teams', '/lynx/coaches/teams/1',
        '/lynx/scorekeeper/x', '/lynx/check-in/x', '/lynx/official/x']) {
        assert.equal(clubNotFoundFace(path, site).face, 'platform', path);
      }
    }
  });
  it('no club context (unknown org) is the platform page', () => {
    assert.equal(clubNotFoundFace('/lynx/teams/x', null).face, 'platform');
  });
});
