/**
 * TEAMS' PRIVATE DETAILS ARE READ ONLY WHERE THEY BELONG (security fixes, 2026-10-16; the second sweep's fourth and
 * fifth findings).
 *  - The Teams screen's two reads (the registrations list and the teams route's GET) answered any member of the club —
 *    a pending invitee, a scorekeeper, a coach-role member — with every team's contacts, payment and admin notes. Now
 *    an ACCEPTED member who can open the tournaments area, within their assigned tournaments.
 *  - The public team page served draft events, hidden Teams pages and unpublished schedules, every team name and each
 *    game's notes. Now the public pages' own rules decide it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';

const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

describe('the registrations list', () => {
  const route = readCode('app/api/registrations/route.ts');
  it('answers an accepted member who can open the tournaments area, before any read', () => {
    assert.match(route, /getAuthContextWithScope\(\{ orgSlug, requireOrgSlug: true \}\)/);
    const gate = at(route, "if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();");
    assert.ok(gate < at(route, ".from('tournaments')"));
    assert.doesNotMatch(route, /getAuthContext\(/, 'not the any-membership context');
  });
  it('keeps to the caller’s assigned tournaments, and its name lookups to this club', () => {
    assert.match(route, /const denied = scopeGuard\(ctx, requestedTournamentId\);/);
    assert.match(route, /else if \(ctx\.assignedTournamentIds !== null\) \{\s*tournamentQuery = tournamentQuery\.in\('id', ctx\.assignedTournamentIds\);/);
    assert.match(route, /\.eq\('org_id', ctx\.org\.id\)/);
    assert.match(route, /\.from\('divisions'\)\.select\('id, name'\)\.in\('tournament_id', tournamentIds\)/);
    assert.equal([...route.matchAll(/\.from\('tournaments'\)/g)].length, 1, 'one tournaments read, the org-scoped one');
  });
});

describe('the teams route’s read', () => {
  it('answers only the tournaments area, before the teams are read', () => {
    const route = readCode('app/api/admin/teams/route.ts');
    const get = route.slice(route.indexOf('export const GET'), route.indexOf('export const POST'));
    assert.ok(at(get, "if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();") < at(get, ".from('teams')"));
  });
});

describe('the public team page', () => {
  const route = readCode('app/api/public/team-profile/route.ts');
  it('resolves the club and the tournament as the public pages do, before reading anything else', () => {
    const firstRead = at(route, 'getTeams(tournament.id');
    assert.ok(at(route, "if (!org || org.subscriptionStatus === 'canceled')") < firstRead);
    assert.ok(at(route, 'const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);') < firstRead);
    assert.ok(at(route, "if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });") < firstRead);
    assert.doesNotMatch(route, /getTournamentsByOrg/);
  });
  it('the Teams switch hides the team list, not a team’s page (the schedule and a followed team link here)', () => {
    assert.doesNotMatch(route, /isPublicPageEnabled\(tournament, 'teams'\)/);
  });
  it('its share card shows the record only where the page does', () => {
    const og = readCode('app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx');
    assert.match(og, /const showRecord = isPublicPageEnabled\(data\.tournament, 'standings'\) && \(division\?\.scheduleVisibility \?\? 'unpublished'\) !== 'unpublished';/);
    assert.match(og, /for \(const g of showRecord \? data\.games : \[\]\)/);
    assert.match(og, /\{c\.showRecord \? \(/);
  });
  it('shows games only where the public Schedule does, and the record only where Standings do', () => {
    assert.match(route, /const scheduleShown = isPublicPageEnabled\(tournament, 'schedule'\) && \(division\.scheduleVisibility \?\? 'unpublished'\) !== 'unpublished';/);
    assert.match(route, /const standingsShown = scheduleShown && isPublicPageEnabled\(tournament, 'standings'\);/);
    assert.match(route, /= !scheduleShown \? \[\] : games/);
    assert.match(route, /standings: standingsShown\s*\?/);
  });
  it('sends no game notes, no unaccepted team, and only the names its games need', () => {
    assert.match(route, /\.map\(\(\{ notes: _notes, \.\.\.g \}\) =>/);
    assert.match(route, /teams\.filter\(t => t\.status === 'accepted'\)\.map\(t => \[t\.id, t\.name\]\)/);
    assert.match(route, /teamNames,\n/);
    assert.doesNotMatch(route, /teamNames: teamMap/);
  });
});
