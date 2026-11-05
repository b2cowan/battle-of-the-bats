import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { clubTeamLink, tournamentTeamPaths, type RegistrationLinkFacts } from '../../lib/team-two-pages.ts';
import type { PublicClubAccessOrg } from '../../lib/public-club-access.ts';

/**
 * A team's two pages link to each other (club round C6, ruled 2026-11-05) — the host club's own team only, and only to a
 * page that opens. Registered + public → a link; not public → none; another club's → none.
 */

const CLUB = 'club-1';
const OTHER = 'club-2';
const club = (over: Partial<PublicClubAccessOrg> = {}) => ({
  id: CLUB, name: 'Lakeshore Lightning',
  isPublic: true, subscriptionStatus: 'active', planId: 'club', enabledAddons: [], freeFloor: null, accountKind: 'organization',
  ...over,
}) as PublicClubAccessOrg & { id: string; name: string };
const ours: RegistrationLinkFacts = { orgId: CLUB, repTeam: { orgId: CLUB, slug: '15u-aaa', name: '15U AAA' } };

describe('Tournament team page → the team’s club page', () => {
  it('our team, the club page public: one link row to /teams/{slug}', () => {
    assert.deepEqual(clubTeamLink({ club: club(), tournamentOrgId: CLUB, link: ours }),
      { name: '15U AAA', clubName: 'Lakeshore Lightning', path: '/teams/15u-aaa' });
  });
  it('the club page not public: no link (the same check the club team page makes)', () => {
    assert.equal(clubTeamLink({ club: club({ isPublic: false }), tournamentOrgId: CLUB, link: ours }), null, 'site off');
    assert.equal(clubTeamLink({ club: club({ subscriptionStatus: 'canceled' }), tournamentOrgId: CLUB, link: ours }), null, 'cancelled');
    assert.equal(clubTeamLink({ club: club({ planId: 'tournament' }), tournamentOrgId: CLUB, link: ours }), null, 'plan has no team pages');
    assert.equal(clubTeamLink({ club: club({ planId: 'league' }), tournamentOrgId: CLUB, link: ours }), null, 'League plan');
  });
  it('a registration with no rep team, or a rep team with no address: no link', () => {
    assert.equal(clubTeamLink({ club: club(), tournamentOrgId: CLUB, link: null }), null);
    assert.equal(clubTeamLink({ club: club(), tournamentOrgId: CLUB, link: { orgId: CLUB, repTeam: null } }), null);
    assert.equal(clubTeamLink({ club: club(), tournamentOrgId: CLUB,
      link: { orgId: CLUB, repTeam: { orgId: CLUB, slug: null, name: '15U AAA' } } }), null);
  });
  it('another club’s team: no link, whichever of the three belongs elsewhere', () => {
    assert.equal(clubTeamLink({ club: club(), tournamentOrgId: CLUB, link: { ...ours, orgId: OTHER } }), null, 'link');
    assert.equal(clubTeamLink({ club: club(), tournamentOrgId: CLUB,
      link: { orgId: CLUB, repTeam: { ...ours.repTeam!, orgId: OTHER } } }), null, 'rep team');
    assert.equal(clubTeamLink({ club: club(), tournamentOrgId: OTHER, link: ours }), null, 'tournament');
  });
  it('a slug is put on the address safely', () => {
    assert.equal(clubTeamLink({ club: club(), tournamentOrgId: CLUB,
      link: { orgId: CLUB, repTeam: { orgId: CLUB, slug: 'a b', name: 'A' } } })?.path, '/teams/a%20b');
  });
});

describe('Club team page → the team’s tournament page', () => {
  const base = {
    clubOrgId: CLUB,
    events: [{ id: 'ev-1', sourceGameId: 'g-1' }],
    games: [{ id: 'g-1', tournamentId: 't-1' }],
    tournaments: [{ id: 't-1', slug: 'spring-classic', status: 'active', orgId: CLUB }],
    registrations: [{ registrationId: 'reg-1', tournamentId: 't-1', status: 'accepted', linkOrgId: CLUB, repTeamOrgId: CLUB }],
  };
  it('our team in the club’s running tournament: the game opens /{tournament}/teams/{registration}', () => {
    assert.deepEqual([...tournamentTeamPaths(base)], [['ev-1', '/spring-classic/teams/reg-1']]);
  });
  it('a finished tournament still links (its pages stay public)', () => {
    assert.equal(tournamentTeamPaths({ ...base, tournaments: [{ ...base.tournaments[0], status: 'completed' }] }).size, 1);
  });
  it('the tournament page not public: no link', () => {
    for (const status of ['draft', 'archived', 'cancelled']) {
      assert.equal(tournamentTeamPaths({ ...base, tournaments: [{ ...base.tournaments[0], status }] }).size, 0, status);
    }
    assert.equal(tournamentTeamPaths({ ...base, registrations: [{ ...base.registrations[0], status: 'pending' }] }).size, 0,
      'team not accepted');
  });
  it('another club: no link (its tournament, or a link the guard would never write)', () => {
    assert.equal(tournamentTeamPaths({ ...base, tournaments: [{ ...base.tournaments[0], orgId: OTHER }] }).size, 0, 'tournament');
    assert.equal(tournamentTeamPaths({ ...base, registrations: [{ ...base.registrations[0], linkOrgId: OTHER }] }).size, 0, 'link');
    assert.equal(tournamentTeamPaths({ ...base, registrations: [{ ...base.registrations[0], repTeamOrgId: OTHER }] }).size, 0, 'rep team');
  });
  it('a game in a tournament this team is not registered in: no link', () => {
    assert.equal(tournamentTeamPaths({ ...base, registrations: [{ ...base.registrations[0], tournamentId: 't-2' }] }).size, 0);
    assert.equal(tournamentTeamPaths({ ...base, games: [] }).size, 0, 'game not found');
  });
});

describe('Both directions build the address through the club’s own address helper', () => {
  it('the tournament team page uses useOrgHref; the club team page uses orgLinks', () => {
    const teamPage = readFileSync('components/public/PublicTeamPage.tsx', 'utf8');
    assert.match(teamPage, /href=\{orgHref\(club\.path\)\}/);
    const clubPage = readFileSync('app/[orgSlug]/teams/[teamSlug]/page.tsx', 'utf8');
    assert.match(clubPage, /tournamentTeamPathsForSchedule[\s\S]*?href\(path\)/);
  });
});
