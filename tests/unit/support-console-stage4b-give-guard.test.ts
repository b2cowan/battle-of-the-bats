/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE, STAGE 4b · PART 3 — THE GIVE (owner rulings Q2–Q5 and gate rulings (a)/(b), 2026-10-27; build
 * prompt §7 Part 3 and §8 guards 3–5, 7).
 *
 * A give makes a real Premium portal and copies the coach's team into it, so it is guarded as a money-adjacent write
 * AND a data migration:
 *   - every refusal is decided by a pure rule BEFORE anything is written (zero writes on a no);
 *   - the coach comes from the address, the team from the coach's own memberships, the end from a bare day (T5, T23);
 *   - the limits are measured from the FIRST give, so nothing chains past them (Q5, T11);
 *   - the give runs in an order where a stop at any step leaves nothing in force past the last free day (T31);
 *   - a later give reuses the one portal and its one entitlement row (Q5, T21), and two at once cannot both land (T26).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  cancelledPortalLine,
  decidePortalGive,
  portalChangeRefusal,
  portalGiveBlockOf,
  portalLastDayRefusal,
  portalLatestLastDay,
  weekLimitRefusal,
  type CoachPortalFacts,
  type FreeTeamFacts,
  type PortalGiveFacts,
} from '../../lib/portal-free-time.ts';

const NOW = new Date('2026-10-27T16:00:00Z'); // Oct 27, 2026, noon Eastern

const team = (over: Partial<FreeTeamFacts> = {}): FreeTeamFacts => ({
  id: 'team-1', name: 'UAT Free Team', sport: 'baseball', ageGroup: 'U13', claimed: false, shadow: false, ...over,
});

const portal = (over: Partial<CoachPortalFacts> = {}): CoachPortalFacts => ({
  workspaceId: 'ws-1', orgId: 'org-1', name: 'UAT Free Team Coaches Portal', billingMode: 'team_direct', movedIntoClub: false,
  inForce: true, freeTimeGivenAt: null, foundingLastDay: null, runningGrant: null, endedLastDay: null, retention: null, ...over,
});

const facts = (over: Partial<PortalGiveFacts> = {}): PortalGiveFacts => ({
  switchOn: true, coachIsGiver: false, coachIsStaff: false, coachIsDemo: false, giverOnTeam: false,
  freeTeams: [team()], portals: [], givesInWindow: 0, ...over,
});

const give = (f: PortalGiveFacts, req: Partial<{ teamId: unknown; lastDay: unknown; reason: unknown; role: string }> = {}) =>
  decidePortalGive({ teamId: 'team-1', lastDay: '2026-12-26', reason: 'Wants to try Premium', role: 'support', ...req }, f, NOW);

const refused = (r: ReturnType<typeof give>) => (r.ok ? null : r.error);

/** A free-time portal staff gave on Sep 1, 2026, whose free time has ended. */
const endedFreeTimePortal = portal({
  billingMode: 'platform_override', inForce: false, freeTimeGivenAt: '2026-09-01T15:00:00Z', endedLastDay: '2026-09-30', retention: null,
});

describe('Part 3 · the give refuses, each with one sentence and nothing written (guard 3)', () => {
  it('a first give to a coach with one free team goes ahead', () => {
    const r = give(facts());
    assert.ok(r.ok && r.mode === 'first' && r.team.id === 'team-1');
  });

  it('a role without the power (Product, Growth, Read only)', () => {
    for (const role of ['product', 'growth', 'read_only']) {
      assert.equal(refused(give(facts(), { role })), "Your role can't give free time.");
    }
  });

  it('the switch off', () => {
    const r = give(facts({ switchOn: false }));
    assert.ok(!r.ok && r.status === 409 && /switched off/.test(r.error));
  });

  it("the giver's own account, any platform staff account, and a coach whose team the giver belongs to (T1, T34)", () => {
    assert.match(refused(give(facts({ coachIsGiver: true }))) ?? '', /your own account, or a platform staff account/);
    assert.match(refused(give(facts({ coachIsStaff: true }))) ?? '', /your own account, or a platform staff account/);
    assert.match(refused(give(facts({ giverOnTeam: true }))) ?? '', /You belong to this coach's team/);
  });

  it('a public demo coach (T28)', () => {
    assert.match(refused(give(facts({ coachIsDemo: true }))) ?? '', /public demo coach/);
  });

  it('a team a portal already holds, and a shadow team, are never offered (T20)', () => {
    assert.match(refused(give(facts({ freeTeams: [team({ claimed: true })] }))) ?? '', /^No free team/);
    assert.match(refused(give(facts({ freeTeams: [team({ shadow: true })] }))) ?? '', /^No free team/);
    // Named in the request but not offerable: refused, never given.
    const two = facts({ freeTeams: [team({ id: 'held', claimed: true }), team({ id: 'free' })] });
    assert.equal(refused(give(two, { teamId: 'held' })), 'Choose one of their free teams.');
  });

  it("a team that is not one of the coach's own (T23)", () => {
    assert.equal(refused(give(facts(), { teamId: 'someone-elses-team' })), 'Choose one of their free teams.');
  });

  it('a coach whose portal pays through Stripe, is comped, is Founding, is club-billed, or was cancelled (Q4)', () => {
    assert.match(refused(give(facts({ portals: [portal()] }))) ?? '', /pays through Stripe/);
    assert.match(refused(give(facts({ portals: [portal({ billingMode: 'platform_override' })] }))) ?? '', /already free from FieldLogicHQ/);
    assert.match(refused(give(facts({ portals: [portal({ billingMode: 'platform_override', foundingLastDay: '2027-09-30' })] }))) ?? '', /under Founding Season/);
    assert.match(refused(give(facts({ portals: [portal({ billingMode: 'club_included' })] }))) ?? '', /the club pays for it/);
    assert.match(refused(give(facts({ portals: [portal({ movedIntoClub: true, inForce: false })] }))) ?? '', /the club pays for it/);
    assert.match(refused(give(facts({ portals: [portal({ inForce: false })] }))) ?? '', /was cancelled/);
  });

  it('a cancelled portal names its retention dates, and turns red inside 30 days of the delete day', () => {
    const line = (retention: CoachPortalFacts['retention']) => cancelledPortalLine(retention, NOW);
    assert.deepEqual(line({ cancelledDay: '2026-08-04', deleteDay: '2027-08-04' }), {
      line: "Their Premium portal was cancelled Aug 4, 2026. Its kept data is deleted Aug 4, 2027. Reopening it is not free time.", tone: 'quiet',
    });
    assert.equal(line({ cancelledDay: null, deleteDay: '2027-08-04' }).line, "Their Premium portal was cancelled. Its kept data is deleted Aug 4, 2027. Reopening it is not free time.");
    assert.deepEqual(line({ cancelledDay: '2025-11-26', deleteDay: '2026-11-26' }), {
      line: "Their Premium portal's kept data is deleted Nov 26, 2026, 30 days from now. Reopening it is not free time.", tone: 'red',
    });
    assert.equal(line({ cancelledDay: '2025-11-27', deleteDay: '2026-11-27' }).tone, 'quiet');
    assert.deepEqual(line({ cancelledDay: '2025-10-01', deleteDay: '2026-10-01' }), {
      line: "Their Premium portal's kept data was due to be deleted Oct 1, 2026, and may already be gone. Reopening it is not free time.", tone: 'red',
    });
    assert.equal(line(null).tone, 'quiet');
    assert.match(refused(give(facts({ portals: [portal({ inForce: false, retention: { cancelledDay: '2026-08-04', deleteDay: '2027-08-04' } })] }))) ?? '', /deleted Aug 4, 2027/);
  });

  it('a coach whose free time is running: change its end on the portal instead', () => {
    const running = portal({ billingMode: 'platform_override', freeTimeGivenAt: '2026-10-01T15:00:00Z', runningGrant: { overrideId: 'o', lastDay: '2026-12-26', expiresAt: '2026-12-27T05:00:00Z' } });
    assert.match(refused(give(facts({ portals: [running] }), { role: 'super_admin' })) ?? '', /free through December 26, 2026\. Change its end/);
  });

  it('a second give needs a Super admin (Q4), and then reuses the same portal (Q5, T21)', () => {
    const f = facts({ portals: [endedFreeTimePortal], freeTeams: [] });
    assert.match(refused(give(f, { role: 'billing', lastDay: '2026-11-15' })) ?? '', /had Premium free from Sep 1, 2026 to Sep 30, 2026\. A second time needs a Super admin/);
    const r = give(f, { role: 'super_admin', lastDay: '2026-11-15', teamId: 'anything' });
    assert.ok(r.ok && r.mode === 'again' && r.portal.workspaceId === 'ws-1');
  });

  it('no reason, no day, a day that is not after today, and an instant instead of a day (T5)', () => {
    assert.equal(refused(give(facts(), { reason: '   ' })), "Say why you're giving it.");
    assert.equal(refused(give(facts(), { lastDay: undefined })), 'Choose the last free day.');
    assert.equal(refused(give(facts(), { lastDay: '2026-10-27' })), 'The last free day must be after today.');
    assert.equal(refused(give(facts(), { lastDay: '2026-12-26T23:59:00-05:00' })), 'Choose the last free day.');
  });

  it("the end is the first moment after the last free day, in Eastern time (T5)", () => {
    const r = give(facts(), { lastDay: '2026-12-26' });
    assert.ok(r.ok);
    assert.equal(r.expiresAt, '2026-12-27T05:00:00.000Z');
  });
});

describe('Part 3 · the limits, measured from the first give (Q2/Q5, T11)', () => {
  it('Support and Billing 90 days, Super admin 6 months, for a first give', () => {
    assert.equal(portalLatestLastDay('support', '2026-10-27'), '2027-01-25');
    assert.equal(portalLatestLastDay('billing', '2026-10-27'), '2027-01-25');
    assert.equal(portalLatestLastDay('super_admin', '2026-10-27'), '2027-04-27');
    assert.equal(refused(give(facts(), { lastDay: '2027-01-25' })), null);
    assert.equal(refused(give(facts(), { lastDay: '2027-01-26' })), 'You can give up to 90 days, through January 25, 2027. Longer needs a Super admin.');
    assert.equal(refused(give(facts(), { lastDay: '2027-04-27', role: 'super_admin' })), null);
    assert.equal(refused(give(facts(), { lastDay: '2027-04-28', role: 'super_admin' })), 'You can give up to 6 months, through April 27, 2027.');
  });

  it('a later give is measured from the first give, not from today', () => {
    const f = facts({ portals: [endedFreeTimePortal], freeTeams: [] });
    // First given Sep 1, 2026: a Super admin's 6 months run through Mar 1, 2027.
    assert.equal(refused(give(f, { role: 'super_admin', lastDay: '2027-03-01' })), null);
    assert.match(refused(give(f, { role: 'super_admin', lastDay: '2027-03-02' })) ?? '', /from when free time was first given \(Sep 1, 2026\), through March 1, 2027/);
  });

  it('changing the end cannot chain past the first-give limit', () => {
    assert.equal(portalChangeRefusal({ lastDay: '2026-11-29', reason: 'more time', role: 'support' }, '2026-09-01', NOW), null);
    assert.match(portalChangeRefusal({ lastDay: '2026-12-01', reason: 'more time', role: 'support' }, '2026-09-01', NOW) ?? '', /through November 30, 2026/);
    assert.equal(portalChangeRefusal({ lastDay: '2026-11-29', reason: '', role: 'support' }, '2026-09-01', NOW), "Say why you're changing it.");
    assert.equal(portalChangeRefusal({ lastDay: '2026-11-29', reason: 'x', role: 'growth' }, '2026-09-01', NOW), "Your role can't change free time.");
    assert.equal(portalLastDayRefusal('2026-11-29', 'support', '2026-09-01', NOW), null);
  });
});

describe("Part 3 · a giver's sixth give inside seven days needs a Super admin (T2, gate ruling (a))", () => {
  it('five go ahead, the sixth is refused for Support and Billing, never for a Super admin', () => {
    assert.equal(weekLimitRefusal('support', 4), null);
    assert.equal(weekLimitRefusal('billing', 5), 'You have given free time to 5 Coaches Portals in the last 7 days. A Super admin can give this one.');
    assert.equal(weekLimitRefusal('super_admin', 50), null);
    assert.match(refused(give(facts({ givesInWindow: 5 }))) ?? '', /A Super admin can give this one/);
    assert.equal(refused(give(facts({ givesInWindow: 5 }), { role: 'super_admin' })), null);
  });

  it('the count is of this giver, this action, the last seven days', () => {
    const code = readCode('lib/portal-free-time-give.ts');
    const fn = code.slice(code.indexOf('async function givesInWindow'), code.indexOf('export type CoachIdentity'));
    assert.match(fn, /\.eq\('actor_email', actorEmail\)/);
    assert.match(fn, /\.eq\('action', 'give_portal_free_time'\)/);
    assert.match(fn, /PORTAL_GIVES_WINDOW_DAYS \* 24 \* 60 \* 60 \* 1000/);
  });
});

describe('Part 3 · the tab, the window and the server ask one rule', () => {
  it('the drawn order: the switch and your own account before anything about the coach', () => {
    assert.equal(portalGiveBlockOf(facts({ switchOn: false, coachIsGiver: true }), 'support')?.kind, 'switch');
    assert.equal(portalGiveBlockOf(facts({ coachIsGiver: true, portals: [portal()] }), 'support')?.kind, 'own');
    // A portal the coach can use now decides before one that ended.
    assert.equal(portalGiveBlockOf(facts({ portals: [portal({ inForce: false }), portal({ workspaceId: 'ws-2', orgId: 'org-2' })] }), 'support')?.kind, 'paying');
  });
});

describe('Part 3 · the server: who, what, and nothing written on a no (T23)', () => {
  const give = readCode('lib/portal-free-time-give.ts');
  const route = readCode('app/api/platform-admin/people/[id]/portal-free-time/route.ts');

  it('the power before anything is read; the coach from the address, never the body', () => {
    assert.match(route, /requirePlatformPower\('portal_free_time'\);\s*if \(auth\.response\) return auth\.response;/);
    assert.match(route, /coachUserId: id,/);
    assert.doesNotMatch(route, /body\.(coach|user|org|ends_at|expires_at)/);
  });

  it('the decision comes before any write', () => {
    const fn = give.slice(give.indexOf('export async function givePortalFreeTime'));
    const decided = fn.indexOf('if (!decision.ok) return decision;');
    assert.ok(decided > 0);
    for (const write of ['provisionStandaloneTeamWorkspace(', "from('org_overrides').insert", 'writePlatformAuditLog(']) {
      const at = fn.indexOf(write);
      assert.ok(at === -1 || at > decided, `${write} runs before the decision`);
    }
  });

  it("the team is read from the coach's own memberships, not the request", () => {
    const fn = give.slice(give.indexOf('async function readFreeTeams'), give.indexOf('async function readCoachPortals'));
    assert.match(fn, /\.from\('basic_coach_team_users'\)[\s\S]*\.eq\('user_id', coachUserId\)[\s\S]*\.eq\('status', 'active'\)/);
    assert.match(fn, /shadow: t\.source === 'premium_upgrade'/);
    assert.match(fn, /claimed: t\.team_workspace_id != null/);
  });

  it('a staff account is checked against the platform staff list, a demo coach against the demo list (T34, T28)', () => {
    assert.match(give, /coach\.email \? isPlatformAdminEmail\(coach\.email\)/);
    assert.match(give, /coachIsDemo: isDemoOrganizerEmail\(coach\.email\)/);
  });
});

describe('Part 3 · the order: a stop at any step leaves nothing in force past the last free day (T31, gate ruling (b))', () => {
  const prov = readCode('lib/team-workspace-provisioning.ts');
  const fn = prov.slice(prov.indexOf('export async function provisionStandaloneTeamWorkspace'));
  const give = readCode('lib/portal-free-time-give.ts');

  it('the grant is written right after the organization, before the team, the workspace or the entitlement', () => {
    const grant = fn.indexOf('await input.freeTime.onOrgCreated(org.id)');
    assert.ok(grant > fn.indexOf('createWorkspaceOrgWithUniqueSlug('));
    for (const later of ['createOrganizationMember(', 'createRepTeam(', ".from('team_workspaces')", ".from('team_entitlements')", ".from('basic_coach_teams')"]) {
      assert.ok(fn.indexOf(later) > grant, `${later} comes before the grant`);
    }
  });

  it('born ended and bounded: organization and workspace cancelled, entitlement live only until the end, the mark set', () => {
    const call = give.slice(give.indexOf('await provisionStandaloneTeamWorkspace({'));
    assert.match(call, /billingMode: 'platform_override'/);
    assert.match(call, /subscriptionStatus: 'canceled'/);
    assert.match(call, /entitlementStatus: 'active'/);
    assert.match(call, /entitlementEndsAt: expiresAt/);
    assert.match(fn, /ends_at: input\.freeTime\.entitlementEndsAt/);
    assert.match(fn, /free_time_given_at: input\.freeTime\.givenAt/);
  });

  it('the grant holds the portal open only to the last free day', () => {
    const row = give.slice(give.indexOf('const grantRow = '), give.indexOf("if (decision.mode === 'again')"));
    assert.match(row, /type: PORTAL_FREE_TIME_GRANT_TYPE/);
    assert.match(row, /expires_at: expiresAt/);
  });

  it('a lost claim undoes the give instead of making an empty portal beside the first (T20)', () => {
    assert.match(fn, /if \(!migrationClaimed && input\.freeTime\) \{\s*throw new TeamWorkspaceProvisioningError\('free_team_claimed'/);
    // Any throw deletes the organization, and the grant, workspace and entitlement go with it.
    assert.match(fn, /catch \(error\) \{\s*if \(createdOrgId\) await rollbackWorkspaceOrg\(createdOrgId\);/);
  });

  it('family reminders start off on a free-time portal (Q10, T30)', () => {
    assert.match(fn, /autoRemindersEnabled: input\.freeTime \? false : undefined/);
    assert.match(prov, /fields\.autoRemindersEnabled === false \? \{ auto_reminders_enabled: false \} : \{\}/);
  });

  it("staff-given, not a customer's purchase: the event says platform_admin, and the coach's saved wish to buy stays (T35)", () => {
    const call = give.slice(give.indexOf('await provisionStandaloneTeamWorkspace({'));
    assert.match(call, /eventSource: 'platform_admin'/);
    assert.match(call, /source: 'platform_admin'/);
    assert.match(fn, /if \(!input\.freeTime\) await clearStartDoor\(/);
  });
});

describe('Part 3 · two gives at once, and a later give (T21, T26, T32)', () => {
  const mig = readCode('supabase/migrations/406_a_portal_given_free_time_carries_its_mark.sql');
  const give = readCode('lib/portal-free-time-give.ts');

  it('the database holds one staff-given portal per coach and per free team, keyed on the mark, never on source', () => {
    assert.match(mig, /CREATE UNIQUE INDEX IF NOT EXISTS team_workspaces_one_free_time_portal_per_coach\s+ON public\.team_workspaces \(primary_owner_user_id\)\s+WHERE free_time_given_at IS NOT NULL/);
    assert.match(mig, /CREATE UNIQUE INDEX IF NOT EXISTS team_workspaces_one_free_time_portal_per_free_team\s+ON public\.team_workspaces \(basic_coach_team_id\)\s+WHERE free_time_given_at IS NOT NULL/);
    assert.doesNotMatch(mig.replace(/--.*$/gm, ''), /source/);
  });

  it('the loser of a race reads as the refusal, with nothing left of it', () => {
    assert.match(give, /code === '23505' \|\| \(err instanceof TeamWorkspaceProvisioningError && err\.code === 'free_team_claimed'\)/);
  });

  it('a later give updates the one entitlement row, only if it has ended, and takes back its grant if it lost', () => {
    const fn = give.slice(give.indexOf('async function giveAgain'), give.indexOf('export async function readFreeTimePortal'));
    assert.match(fn, /\.from\('team_entitlements'\)\s*\.update\(/);
    assert.doesNotMatch(fn, /\.from\('team_entitlements'\)\s*\.insert/);
    assert.match(fn, /\.lte\('ends_at', now\)/);
    assert.match(fn, /\.from\('org_overrides'\)\.delete\(\)\.eq\('id', grant\.id\)/);
    assert.doesNotMatch(fn, /provisionStandaloneTeamWorkspace|migrateBasicTeamIntoWorkspace/, 'nothing is copied again');
  });
});

describe('Part 3 · change the end and end it now (T11, D-1)', () => {
  const give = readCode('lib/portal-free-time-give.ts');
  const change = give.slice(give.indexOf('export async function changePortalFreeTimeEnd'), give.indexOf('export async function endPortalFreeTimeNow'));
  const end = give.slice(give.indexOf('export async function endPortalFreeTimeNow'));

  it('only a staff-given portal nobody pays for; the limit anchored on its mark', () => {
    const read = give.slice(give.indexOf('export async function readFreeTimePortal'), give.indexOf('async function portalWriteBlock'));
    assert.match(read, /!data\?\.free_time_given_at \|\| data\.billing_mode !== 'platform_override'/);
    assert.match(change, /portalChangeRefusal\([^)]*\}, portal\.firstGiveDay\)/);
  });

  it('compare-and-set on the end the window opened with; the entitlement follows, or the grant is put back', () => {
    assert.match(change, /\.eq\('expires_at', row\.expires_at\)/);
    assert.match(change, /\.gt\('expires_at', new Date\(\)\.toISOString\(\)\)/);
    assert.match(change, /\.from\('team_entitlements'\)[\s\S]*\.eq\('ends_at', row\.expires_at\)/);
    assert.match(change, /update\(\{ expires_at: row\.expires_at \}\)/);
  });

  it("end it now closes the team's entitlement first, then Stage 4's end path, and nothing else (T15)", () => {
    const ent = end.indexOf(".from('team_entitlements')");
    const grant = end.indexOf('endFreeTimeNow(');
    assert.ok(ent > 0 && grant > ent);
  });

  it("a portal's free time cannot be half-ended from a club's Access list", () => {
    const club = readCode('app/api/platform-admin/orgs/[id]/overrides/[oid]/route.ts');
    const del = club.slice(club.indexOf('export const DELETE'));
    assert.ok(del.indexOf('readFreeTimePortal(id)') > 0 && del.indexOf('readFreeTimePortal(id)') < del.indexOf('endFreeTimeNow('));
  });

  it('both routes hold the portal free time power before they read anything', () => {
    const route = readCode('app/api/platform-admin/orgs/[id]/portal-free-time/[oid]/route.ts');
    assert.equal((route.match(/requirePlatformPower\('portal_free_time'\);\s*if \(auth\.response\) return auth\.response;/g) ?? []).length, 2);
  });
});
