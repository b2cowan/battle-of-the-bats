import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { matchOwnTeamDivision } from '../../lib/own-team-division-match.ts';
import { applyOrgGrantPolicy } from '../../lib/coach-capabilities.ts';
import { STAFF_PRESETS } from '../../lib/coach-capabilities.ts';

/**
 * ADD OUR TEAMS (Club Tier Stage 7b; Ask 5 A, owner answers 2026-10-21). The database half is proved on dev by
 * `npm run check:club-money-atomicity` (scripts/club-stage7b-atomicity.sql, and a real two-press race). This file pins the rest:
 * the division match, who may enter, that nothing emails the coach, and that the portal's star and the coach side are unchanged.
 */

const ROUTE = readCode('app/api/admin/teams/our-teams/route.ts');
const LIB = readCode('lib/club-own-teams-entry.ts');
const MIG = readCode('supabase/migrations/346_a_club_enters_its_own_teams.sql');
const LINK_ROUTE = readCode('app/api/admin/teams/rep-team-link/route.ts');
const WINDOW = readCode('app/[orgSlug]/admin/tournaments/registrations/components/AddOurTeamsWindow.tsx');
const PAGE = readCode('app/[orgSlug]/admin/tournaments/registrations/page.tsx');

const D = [
  { id: 'u15', name: '15U' },
  { id: 'u13', name: '13U' },
  { id: 'u15g', name: 'U15 Girls' },
  { id: 'u15b', name: 'U15' },
];

describe('a division picks itself when its name matches the team\'s', () => {
  it('reads the rep team\'s own division word first', () => {
    assert.equal(matchOwnTeamDivision({ name: 'Lions AA', division: ' 15u ' }, D), 'u15');
  });
  it('else a division named inside the team\'s name, the longest one', () => {
    assert.equal(matchOwnTeamDivision({ name: '15U AA', division: null }, D), 'u15');
    assert.equal(matchOwnTeamDivision({ name: 'Lions U15 Girls AAA', division: null }, D), 'u15g');
  });
  it('picks nothing rather than guess', () => {
    assert.equal(matchOwnTeamDivision({ name: '14U AA', division: '14U' }, D), null);
    assert.equal(matchOwnTeamDivision({ name: 'U155 AA', division: null }, D), null, 'whole words only');
    assert.equal(matchOwnTeamDivision({ name: '15U 13U', division: null }, D), null, 'two of one length is a tie');
  });
});

describe('who may enter our teams', () => {
  it('whoever may add teams, in a club that runs rep teams and is not a coaches portal', () => {
    assert.match(ROUTE, /hasCapability\(ctx\.role, ctx\.capabilities, 'create_tournaments'\)/);
    assert.match(ROUTE, /hasModuleEntitlement\(ctx\.org, 'module_rep_teams'\)/);
    assert.match(ROUTE, /!isTeamWorkspaceOrg\(ctx\.org\)/);
    assert.match(ROUTE, /if \(!mayEnter\(ctx\)\) return forbidden\(\)/);
  });
  it('every refusal the database raises on purpose is one the route turns into a 409 (a reworded sentence must not become a 500)', () => {
    const listed = LIB.slice(LIB.indexOf('const DELIBERATE_REFUSALS'), LIB.indexOf('];', LIB.indexOf('const DELIBERATE_REFUSALS')));
    const patterns = [...listed.matchAll(/^\s*\/(.+)\/,\s*$/gm)].map(m => new RegExp(m[1]));
    assert.ok(patterns.length >= 10, 'the refusal list was not read');
    const enter = MIG.slice(MIG.indexOf('CREATE OR REPLACE FUNCTION public.club_enter_own_teams'));
    const guard = MIG.slice(0, MIG.indexOf('CREATE OR REPLACE FUNCTION public.club_enter_own_teams'));
    const raised = [
      ...[...enter.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'/g)].map(m => m[1]),
      // The link guard's two refusals a brand-new team can reach (the others need a payment or a delete).
      ...[...guard.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'/g)].map(m => m[1]).filter(s => /same club|already in this tournament/.test(s)),
    ].map(s => s.replace(/''/g, "'").replace(/%/g, 'Lions U15'));
    assert.ok(raised.length >= 14, `only ${raised.length} refusals were read from the migration`);
    const unmatched = raised.filter(sentence => !patterns.some(p => p.test(sentence)));
    assert.deepEqual(unmatched, [], 'the database raises a sentence the route does not know; it would answer 500');
  });
  it('the list of our teams (it names each head coach) is the tournaments area\'s to read, like the Teams route', () => {
    const get = ROUTE.slice(ROUTE.indexOf('export const GET'), ROUTE.indexOf('export const POST'));
    assert.match(get, /canOpenModule\(ctx, ctx\.org, 'module_tournaments'\)\) return forbidden\(\)/);
  });
  it('the tournament in the member\'s scope and in their club; a team-group limit holds', () => {
    const post = ROUTE.slice(ROUTE.indexOf('export const POST'));
    assert.match(post, /scopeGuard\(ctx, tournamentId\)/);
    assert.match(post, /requireTournamentInOrg\(ctx, tournamentId\)/);
    assert.match(post, /repGroupIdsOf\(ctx, orgSlug\)/);
    assert.match(LIB, /ids\.some\(id => !found\.has\(id\) \|\| !inScope\(found\.get\(id\)!, params\.repGroupIds\)\)/);
  });
  it('one database step, all or none, under a lock; no money; the server only', () => {
    assert.match(LIB, /rpc\('club_enter_own_teams'/);
    assert.match(MIG, /FROM tournaments WHERE id = p_tournament FOR SHARE/);
    assert.equal((MIG.match(/pg_advisory_xact_lock\(hashtextextended\('club_own_team_entry:'/g) ?? []).length, 2, 'the function and the link guard take one lock');
    assert.match(MIG, /'accepted', 'paid', now\(\)/);
    assert.doesNotMatch(MIG, /tournament_team_payments\s*\(/i, 'entering writes no payment');
    assert.match(MIG, /REVOKE ALL ON FUNCTION public\.club_enter_own_teams\(uuid, uuid, jsonb, uuid\) FROM PUBLIC, anon, authenticated/);
  });
  it('the record\'s Link to a rep team refuses a second entry in words', () => {
    assert.match(LINK_ROUTE, /\/ is already in this tournament\\\.\$\//);
  });
});

describe('nothing emails the club\'s own coach', () => {
  it('the route sends no email and tells only the people who may add teams', () => {
    assert.doesNotMatch(ROUTE + LIB, /sendEmail|sendTransactionalEmail|notifyTeamCoaches/);
    assert.match(ROUTE, /tournamentTeamAdderUserIds\(ctx\.org\.id, tournamentId\)/);
    assert.match(ROUTE, /if \(recipients\.length\)/, 'an empty list never reaches notify() (it would fall back to every member)');
    assert.match(ROUTE, /userIds: recipients/);
  });
});

describe('what stays', () => {
  it('a head coach cannot enter the club\'s tournament from the coaches portal (registration is off for club teams)', () => {
    assert.equal(applyOrgGrantPolicy({ ...STAFF_PRESETS.manager }, { isTeamWorkspace: false }).registerTournaments, false);
    assert.equal(applyOrgGrantPolicy({ registerTournaments: true }, { isTeamWorkspace: false }).registerTournaments, false);
  });
  it('the portal\'s star is its own route and its own button; the two never show together', () => {
    assert.match(PAGE, /canAddOurTeams = !isLocked && !isHostPortal/);
    assert.match(PAGE, /\/api\/admin\/teams\/own-team\$\{orgQuery\}/, 'Add my team is unchanged');
  });
  it('the window says "Our teams enter with no fee" once, ending the intro; the foot holds only the live count', () => {
    assert.match(WINDOW, /\{W\.introMore\}<\/span> \{W\.noFee\}<\/p>/);
    assert.match(WINDOW, /footerStart=\{count > 0 \? <span>\{W\.ticked\(count\)\}<\/span> : undefined\}/);
    assert.equal((WINDOW.match(/W\.noFee\b/g) ?? []).length, 1);
    assert.match(WINDOW, /size="medium"/);
    assert.match(WINDOW, /dirty=\{count > 0\}/);
  });
});
