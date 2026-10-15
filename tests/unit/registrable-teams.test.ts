import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildRegistrableTeams, findRegistrableTeam, whoRegistersSentence,
  type FreeTeamMembership, type LivePortal, type PortalStaffMember,
} from '../../lib/registrable-teams';
import { portalTournamentRecordPath } from '../../lib/coaches-portal-routes';
import {
  STAFF_PRESETS, STAFF_KINDS, ASSISTANT_DEFAULTS, resolveCoachCapabilities, sanitizeAssistantGrants, grantsOf,
  applyOrgGrantPolicy, staffKindCopyFor, canOpenTournaments, canConfigureTeam,
} from '../../lib/coach-capabilities';
import { SENSITIVE_KEYS, delegationViolation } from '../../lib/coach-staff-delegation';
import { GRANT_LABELS } from '../../lib/coach-staff-labels';

/**
 * WHO MAY REGISTER WHICH TEAM (owner D1, 2026-10-13). A Premium coach registering from a WhatsApp
 * link was offered his portal under last season's free-team name and made a second team; none of his
 * five staff could have seen the team at all. These pin the one computation the form, the join page
 * and the server all read: the portal's CURRENT name, Premium first, the staff PERMISSION (never
 * membership of the free team underneath) deciding, a locked card naming who can, and the server
 * refusing exactly what the form greys out. Plan: COACH_REGISTER_EXISTING_TEAM_PLAN.md.
 */

const ME = 'me';
const free = (id: string, name: string, teamWorkspaceId: string | null = null): FreeTeamMembership => ({ id, name, teamWorkspaceId });
const head = (userId: string, name: string | null = null): PortalStaffMember => ({ userId, name, coachRole: 'head_coach', capabilities: null, staffKind: null });
const manager = (userId: string, name: string | null = null): PortalStaffMember => ({ userId, name, coachRole: 'assistant_coach', capabilities: { ...STAFF_PRESETS.manager }, staffKind: 'manager' });
const assistant = (userId: string, name: string | null = null, extra: Record<string, unknown> = {}): PortalStaffMember => ({ userId, name, coachRole: 'assistant_coach', capabilities: { ...STAFF_PRESETS.assistant, ...extra }, staffKind: 'assistant' });
const portal = (over: Partial<LivePortal> & Pick<LivePortal, 'workspaceId' | 'twinId'>): LivePortal => ({
  repTeamId: `rep-${over.workspaceId}`, orgSlug: `org-${over.workspaceId}`, name: 'Milton Bats U13 Purple',
  standalone: true, staff: [], ...over,
});

describe('a Premium team is offered to its staff by permission', () => {
  it('offers the head coach their portal under its CURRENT name, first, already theirs to choose (F3)', () => {
    const [card] = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('twin', 'Milton Bats U13 White', 'ws')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head(ME, 'Brett Jackson')] })],
    });
    assert.equal(card.name, 'Milton Bats U13 Purple');
    assert.equal(card.basicCoachTeamId, 'twin', 'the entry still links to the twin the portal reads');
    assert.equal(card.isPortalTeam, true);
    assert.equal(card.locked, false);
    assert.equal(card.youAre, 'the head coach');
    assert.deepEqual(card.portal, { orgSlug: 'org-ws', repTeamId: 'rep-ws' });
  });

  it('offers a team manager the team with no change from the head coach (the preset holds the grant)', () => {
    const [card] = buildRegistrableTeams({
      userId: ME, freeTeams: [],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head('h', 'Brett Jackson'), manager(ME)] })],
    });
    assert.equal(card.locked, false);
    assert.equal(card.youAre, 'the team manager');
    assert.equal(card.basicCoachTeamId, 'twin', 'offered WITHOUT being a member of the free team underneath');
  });

  it('locks the team for an assistant without the switch, naming who can register it, head coaches first', () => {
    const [card] = buildRegistrableTeams({
      userId: ME, freeTeams: [],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [manager('m', 'Alex Morgan'), assistant(ME, 'Sam Patel'), head('h', 'Brett Jackson')] })],
    });
    assert.equal(card.locked, true);
    assert.equal(card.youAre, 'an assistant coach');
    assert.deepEqual(card.registeredBy, [{ name: 'Brett Jackson', role: 'head coach' }, { name: 'Alex Morgan', role: 'team manager' }]);
    assert.equal(whoRegistersSentence(card),
      'Brett Jackson (head coach) or Alex Morgan (team manager) registers this team. Ask Brett if you need to do it yourself.');
  });

  it('unlocks it for an assistant the head coach gave the switch to', () => {
    const [card] = buildRegistrableTeams({
      userId: ME, freeTeams: [],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head('h'), assistant(ME, null, { registerTournaments: true })] })],
    });
    assert.equal(card.locked, false);
  });

  it('gives a member of the twin who is NOT on the staff nothing: membership of the free team confers no right', () => {
    const teams = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('twin', 'Twin', 'ws'), free('mine', 'My free team')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head('someone-else')] })],
    });
    assert.deepEqual(teams.map(t => t.basicCoachTeamId), ['mine']);
  });

  it('shows the team once when this person is both on the staff and a member of the twin', () => {
    const teams = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('twin', 'Old name', 'ws')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head(ME)] })],
    });
    assert.equal(teams.length, 1);
    assert.equal(teams[0].name, 'Milton Bats U13 Purple');
  });

  it('skips a portal whose twin could not be resolved rather than offering a team nothing can link to', () => {
    assert.deepEqual(buildRegistrableTeams({
      userId: ME, freeTeams: [], portals: [portal({ workspaceId: 'ws', twinId: null, staff: [head(ME)] })],
    }), []);
  });

  it('lands a portal with no readable slug as a free team would (no Premium record link)', () => {
    const [card] = buildRegistrableTeams({
      userId: ME, freeTeams: [], portals: [portal({ workspaceId: 'ws', twinId: 'twin', orgSlug: null, staff: [head(ME)] })],
    });
    assert.equal(card.portal, null);
  });
});

describe('the order and the names on the cards (A4, kept)', () => {
  it('lists open Premium teams, then locked ones, then free teams, keeping each group’s own order', () => {
    const teams = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('a', 'Old free team'), free('c', 'Another free')],
      portals: [
        portal({ workspaceId: 'ws-l', twinId: 'l', name: 'Locked portal', staff: [head('h'), assistant(ME)] }),
        portal({ workspaceId: 'ws-b', twinId: 'b', name: 'Portal B', staff: [head(ME)] }),
        portal({ workspaceId: 'ws-d', twinId: 'd', name: 'Portal D', staff: [manager(ME)] }),
      ],
    });
    assert.deepEqual(teams.map(t => t.name), ['Portal B', 'Portal D', 'Locked portal', 'Old free team', 'Another free']);
  });

  it('renames only the portal’s own twin: a second free team with the same back-link stays an ordinary team', () => {
    const teams = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('stale', 'Old copy', 'ws'), free('twin', 'Twin', 'ws')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', name: 'Portal', staff: [head(ME)] })],
    });
    assert.deepEqual(teams.map(t => [t.basicCoachTeamId, t.name, t.isPortalTeam]), [['twin', 'Portal', true], ['stale', 'Old copy', false]]);
  });

  it('leaves a canceled portal’s free team alone: own name, own place, no tag (a canceled portal is not live)', () => {
    const teams = buildRegistrableTeams({ userId: ME, freeTeams: [free('a', 'Free A'), free('b', 'Was Premium', 'ws-canceled')], portals: [] });
    assert.deepEqual(teams.map(t => [t.name, t.isPortalTeam, t.locked]), [['Free A', false, false], ['Was Premium', false, false]]);
  });

  it('keeps the twin’s own name when the portal’s name is missing or blank', () => {
    for (const name of [null, '   ']) {
      const [card] = buildRegistrableTeams({
        userId: ME,
        freeTeams: [free('twin', 'Twin name', 'ws')],
        portals: [portal({ workspaceId: 'ws', twinId: 'twin', name, staff: [head(ME)] })],
      });
      assert.equal(card.name, 'Twin name', String(name));
      assert.equal(card.isPortalTeam, true);
    }
  });

  it('does not change what it was given, and copes with nothing', () => {
    const freeTeams = [free('twin', 'Twin', 'ws')];
    buildRegistrableTeams({ userId: ME, freeTeams, portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head(ME)] })] });
    assert.equal(freeTeams[0].name, 'Twin');
    assert.deepEqual(buildRegistrableTeams({ userId: ME, freeTeams: [], portals: [] }), []);
  });
});

describe('a team that moved into its club is out of scope — offered exactly as before', () => {
  const club = (over: Partial<LivePortal> = {}) => portal({ workspaceId: 'ws', twinId: 'twin', name: 'Club team', standalone: false, ...over });

  it('offers its twin to the twin’s members under the portal’s name, unlocked, landing as before', () => {
    const [card] = buildRegistrableTeams({ userId: ME, freeTeams: [free('twin', 'Old', 'ws')], portals: [club()] });
    assert.deepEqual([card.name, card.isPortalTeam, card.locked, card.portal], ['Club team', true, false, null]);
  });

  it('with no twin recorded, the earliest back-linked team stands in (the one the portal adopts)', () => {
    const teams = buildRegistrableTeams({
      userId: ME, freeTeams: [free('first', 'First', 'ws'), free('second', 'Second', 'ws')], portals: [club({ twinId: null })],
    });
    assert.deepEqual(teams.map(t => [t.basicCoachTeamId, t.name, t.isPortalTeam]), [['first', 'Club team', true], ['second', 'Second', false]]);
  });

  it('never offers a club team through the staff permission', () => {
    assert.deepEqual(buildRegistrableTeams({ userId: ME, freeTeams: [], portals: [club({ staff: [head(ME)] })] }), []);
  });
});

describe('the server refuses exactly what the form greys out (D1, part 4)', () => {
  const teams = buildRegistrableTeams({
    userId: ME,
    freeTeams: [free('mine', 'My free team')],
    portals: [
      portal({ workspaceId: 'ws-open', twinId: 'open', staff: [head(ME)] }),
      portal({ workspaceId: 'ws-locked', twinId: 'locked', staff: [head('h'), assistant(ME)] }),
    ],
  });

  it('allows a free team and a Premium team the person may register', () => {
    assert.equal(findRegistrableTeam(teams, 'mine')?.basicCoachTeamId, 'mine');
    assert.equal(findRegistrableTeam(teams, 'open')?.basicCoachTeamId, 'open');
  });

  it('refuses a locked card, a team the person is not on, and no team at all', () => {
    assert.equal(findRegistrableTeam(teams, 'locked'), null);
    assert.equal(findRegistrableTeam(teams, 'someone-elses'), null);
    assert.equal(findRegistrableTeam(teams, null), null);
    assert.equal(findRegistrableTeam(teams, ''), null);
  });

  it('names the portal a Premium entry joins, and none for a free team; the record route is spelled once', () => {
    assert.deepEqual(findRegistrableTeam(teams, 'open')?.portal, { orgSlug: 'org-ws-open', repTeamId: 'rep-ws-open' });
    assert.equal(findRegistrableTeam(teams, 'mine')?.portal, null);
    assert.equal(portalTournamentRecordPath('org-ws-open', 'rep-ws-open', 'reg-1'), '/org-ws-open/coaches/teams/rep-ws-open/tournaments/reg-1');
  });

  it('the free record forwards a Premium entry exactly when the portal record will open (its own gate)', () => {
    const page = readFileSync(join(process.cwd(), 'app', 'coaches', 'tournaments', '[teamId]', 'page.tsx'), 'utf8');
    assert.match(page, /findRepTeamAccessForRegistration\(user\.id, teamId\)/);
    assert.match(page, /isTeamWorkspaceOrg\(/, 'standalone portals only — a club is out of scope');
    assert.ok(page.indexOf('if (portalHref) redirect(portalHref)') < page.indexOf('<CoachTournamentRecord'));
  });

  it('is asked BEFORE the entry is created, and by the link itself — never by free-team membership', () => {
    const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
    const register = read('app', 'api', 'register', 'route.ts');
    const check = register.search(/!findRegistrableTeam\(registrableTeams/);
    assert.ok(check > 0, '/api/register asks the D1 question');
    const insert = register.search(/\.from\('teams'\)\s*\.insert\(/);
    assert.ok(insert > 0 && check < insert, 'and asks it before the entry exists');
    assert.match(register, /registrableTeams,\s*\}\);/, 'and hands the same answer to the link, so it is computed once');
    const link = read('lib', 'basic-coach-teams.ts').replace(/\r\n/g, '\n');
    const linkFn = link.slice(link.indexOf('export async function linkTournamentRegistrationToBasicCoachTeam'));
    const body = linkFn.slice(0, linkFn.indexOf('\n}\n'));
    assert.match(body, /const mayRegister = async \(teamId: string\) => findRegistrableTeam\(/);
    assert.match(body, /!\(await mayRegister\(basicCoachTeamId\)\)/);
    assert.doesNotMatch(body, /userOwnsBasicCoachTeam\(params\.userId, basicCoachTeamId\)/,
      'twin membership is not the question any more');
  });
});

describe('the sentence under a locked card', () => {
  it('names people by role alone when their name could not be read', () => {
    assert.equal(whoRegistersSentence({ registeredBy: [{ name: '', role: 'head coach' }] }),
      'Your head coach registers this team. Ask your head coach if you need to do it yourself.');
  });

  it('names a head coach by email in the list but never addresses them by it', () => {
    assert.equal(whoRegistersSentence({ registeredBy: [{ name: 'brett@example.com', role: 'head coach' }] }),
      'brett@example.com (head coach) registers this team. Ask your head coach if you need to do it yourself.');
  });

  it('lists three or more with commas, and copes with nobody', () => {
    assert.equal(whoRegistersSentence({ registeredBy: [{ name: 'A B', role: 'head coach' }, { name: 'C D', role: 'team manager' }, { name: 'E F', role: 'assistant coach' }] }),
      'A B (head coach), C D (team manager) or E F (assistant coach) registers this team. Ask A if you need to do it yourself.');
    assert.equal(whoRegistersSentence({ registeredBy: [] }), 'Only the head coach can register this team.');
  });
});

describe('the Register for tournaments grant (A6, A3)', () => {
  it('is always the head coach’s, off by default, and on only in the Team manager preset', () => {
    assert.equal(resolveCoachCapabilities('head_coach').registerTournaments, true);
    assert.equal(resolveCoachCapabilities('head_coach', { registerTournaments: false }).registerTournaments, true);
    assert.equal(ASSISTANT_DEFAULTS.registerTournaments, false);
    assert.equal(resolveCoachCapabilities('assistant_coach', { schedule: true }).registerTournaments, false, 'a bundle stored before the key existed reads OFF');
    for (const kind of STAFF_KINDS) assert.equal(STAFF_PRESETS[kind].registerTournaments, kind === 'manager', kind);
  });

  it('survives the sanitiser and the sheet’s full-bundle PATCH, and is named in one place', () => {
    assert.deepEqual(sanitizeAssistantGrants({ registerTournaments: true }), { registerTournaments: true });
    assert.deepEqual(sanitizeAssistantGrants({ registerTournaments: 'yes' }), {}, 'a non-boolean is dropped, not coerced');
    assert.equal(grantsOf(resolveCoachCapabilities('assistant_coach', { registerTournaments: true })).registerTournaments, true);
    assert.equal(GRANT_LABELS.registerTournaments, 'Register for tournaments');
  });

  it('is Sensitive — a delegate hands it out only while holding it — and sits right under Run tournaments', () => {
    const keys = [...SENSITIVE_KEYS];
    assert.equal(keys.indexOf('registerTournaments'), keys.indexOf('tournaments') + 1);
    const cur = grantsOf(resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.assistant));
    const delegate = (g: Record<string, unknown>) => resolveCoachCapabilities('assistant_coach', { ...STAFF_PRESETS.manager, ...g });
    assert.equal(delegationViolation(delegate({}), cur, { ...cur, registerTournaments: true }), null);
    assert.deepEqual(delegationViolation(delegate({ registerTournaments: false }), cur, { ...cur, registerTournaments: true }),
      { key: 'registerTournaments', reason: 'above_ceiling' });
  });

  it('exists only in a standalone Premium workspace: a club bundle is written with it off', () => {
    assert.equal(applyOrgGrantPolicy({ ...STAFF_PRESETS.manager }, { isTeamWorkspace: false }).registerTournaments, false);
    assert.equal(applyOrgGrantPolicy({ registerTournaments: true }, { isTeamWorkspace: false }).registerTournaments, false);
    assert.equal(applyOrgGrantPolicy({ ...STAFF_PRESETS.manager }, { isTeamWorkspace: true }).registerTournaments, true);
  });

  it('is promised in the Team manager invite email in a workspace, and never in a club', () => {
    assert.match(staffKindCopyFor('manager', { isTeamWorkspace: true }).emailWhat, /entering it in other organizers’ tournaments/);
    assert.doesNotMatch(staffKindCopyFor('manager', { isTeamWorkspace: false }).emailWhat, /tournament/);
  });

  it('migration 329 backfills existing standalone managers only, never over a key already set', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '329_existing_managers_can_register_their_team.sql'), 'utf8');
    assert.match(sql, /m\.staff_kind = 'manager'/);
    assert.match(sql, /o\.account_kind = 'team_workspace' or o\.plan_id = 'team'/);
    assert.match(sql, /not \(coalesce\(m\.capabilities, '\{\}'::jsonb\) \? 'registerTournaments'\)/);
    assert.match(sql, /y\.status in \('draft', 'active'\)/, 'the live projection only — closed seasons are the record');
  });
});

describe('the Tournaments door follows Register for tournaments (owner option (a), 2026-10-15)', () => {
  const assistantWith = (g: Record<string, unknown>) => resolveCoachCapabilities('assistant_coach', g);

  it('opens for whoever may configure the team, and for whoever may enter it — and for nobody else', () => {
    assert.equal(canOpenTournaments(resolveCoachCapabilities('head_coach')), true);
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.assistant })), true, 'schedule editing, as before');
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.manager })), true);
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.treasurer })), false, 'no change for anyone until a head coach flips it');
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.treasurer, registerTournaments: true })), true);
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.helper, registerTournaments: true })), true);
  });

  it('never widens configuring the team: Settings’ groups stay on their own rule', () => {
    assert.equal(canConfigureTeam(assistantWith({ ...STAFF_PRESETS.treasurer, registerTournaments: true })), false);
  });

  it('every Tournaments door reads the one rule', () => {
    const read = (p: string) => readFileSync(join(process.cwd(), ...p.split('/')), 'utf8');
    const doors = [
      'lib/coach-nav-visibility.ts',
      'lib/coach-registration-access.ts',
      'app/[orgSlug]/coaches/teams/[teamId]/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/tournaments/[registrationId]/page.tsx',
      'app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts',
      'app/api/coaches/[orgSlug]/teams/[teamId]/hosted-tournaments/route.ts',
    ];
    for (const door of doors) assert.match(read(door), /canOpenTournaments\(/, door);
    assert.match(read('lib/coach-nav-visibility.ts'), /case 'Tournaments':\s+return canOpenTournaments\(caps\)/);
  });
});
