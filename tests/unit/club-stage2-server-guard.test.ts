import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, functionBody } from './_source-code.ts';
import {
  decideStrayOpenSeasons, isLiveSeasonStatus, latestClosedSeasonOf, liveSeasonOf,
  publicTryoutSeasonOf, twoOpenSeasonsMessage,
} from '../../lib/season-live.ts';
import {
  mayManageSeasons, orgManagesOwnSeasons, seasonNotLiveRefusal, seasonsClosedBy,
} from '../../lib/season-doors.ts';
import { countsInRecord, countsOnRoster, hasDecidedGames, rosterCountOf, seasonRecordOf } from '../../lib/team-season-figures.ts';
import { unsettledFamilyCounts } from '../../lib/season-close-warning.ts';
import { clubSeasonNotice } from '../../lib/club-season-notice.ts';
import { clubRoleWords } from '../../lib/club-coach-invite.ts';
import { formOnFile, hasEveryForm, templatesForTeam } from '../../lib/forms-coverage.ts';
import { NOTIFICATION_CATEGORY, NOTIFICATION_EVENT_LABELS, PUSH_DEFAULT_ON_EVENTS } from '../../lib/notification-labels.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 2 · SESSION 1 — THE SERVER RULES THE CLUB'S SCREENS WILL STAND ON
 * (owner rulings 2026-09-28, hub v15: Ask 1 (a), D10 + Ask 4, Ask 5, Ask 6; plan §6 Stage 2).
 *
 * Each block pins one ruling or finding against the code that carries it, so a later edit that
 * quietly reverses it fails here with the reason. Source guards read CODE (comments stripped).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTE = {
  clubSeasons: 'app/api/admin/rep-teams/teams/[teamId]/seasons/route.ts',
  portalSeasons: 'app/api/coaches/[orgSlug]/teams/[teamId]/seasons/route.ts',
  portalTeam: 'app/api/coaches/[orgSlug]/teams/[teamId]/route.ts',
  programYears: 'app/api/admin/rep-teams/teams/[teamId]/program-years/route.ts',
  programYear: 'app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/route.ts',
  clubCoaches: 'app/api/admin/rep-teams/teams/[teamId]/coaches/route.ts',
  clubCoachRemove: 'app/api/admin/rep-teams/teams/[teamId]/coaches/[membershipId]/route.ts',
  clubInvite: 'app/api/admin/rep-teams/teams/[teamId]/coaches/invites/[inviteId]/route.ts',
  portalInvite: 'app/api/coaches/[orgSlug]/teams/[teamId]/staff/invite/route.ts',
  portalStaffMember: 'app/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]/route.ts',
  adminTryouts: 'app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/route.ts',
  adminTryout: 'app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/[regId]/route.ts',
  register: 'app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts',
  teams: 'app/api/admin/rep-teams/teams/route.ts',
  team: 'app/api/admin/rep-teams/teams/[teamId]/route.ts',
  templates: 'app/api/admin/rep-teams/document-templates/route.ts',
  template: 'app/api/admin/rep-teams/document-templates/[templateId]/route.ts',
  teamLinks: 'app/api/admin/org/team-links/route.ts',
  seed: 'app/api/dev/seed/rep-team/route.ts',
  accept: 'app/api/auth/accept-assistant-invite/route.ts',
};

/** The handler `export const VERB = …` up to the next top-level export. */
function handler(code: string, verb: string): string {
  const start = code.indexOf(`export const ${verb} = `);
  if (start < 0) throw new Error(`export const ${verb} is gone — the guard reads it`);
  const rest = code.slice(start + 1);
  const end = rest.search(/\nexport (const|async function|function) /);
  return end > 0 ? rest.slice(0, end) : rest;
}

const season = (id: string, status: string, year: number, createdAt: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `${year} Season`, status, year, createdAt, tryoutOpen: false, ...extra });

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('Ask 1 (a) — one live-season rule, and NO SELF-HEAL for a club', () => {
  it('a season is live when it is draft or active — nothing else', () => {
    for (const s of ['draft', 'active']) assert.equal(isLiveSeasonStatus(s), true, s);
    for (const s of ['completed', 'archived', '', null, undefined]) assert.equal(isLiveSeasonStatus(s as string), false, String(s));
  });

  it('the live season is the newest-CREATED open one (getActiveRepProgramYear\'s tie-break)', () => {
    const a = season('a', 'active', 2026, '2026-01-01T00:00:00Z');
    const d = season('d', 'draft', 2027, '2026-06-01T00:00:00Z');
    const c = season('c', 'completed', 2025, '2025-01-01T00:00:00Z');
    assert.equal(liveSeasonOf([a, d, c])?.id, 'd', 'a Draft made after the Active one IS the live season');
    assert.equal(liveSeasonOf([c]), null);
    assert.equal(latestClosedSeasonOf([a, c, season('e', 'archived', 2024, '2024-01-01T00:00:00Z')])?.id, 'c');
  });

  it('the CLUB roll refuses a stray open season and names both (mutation-tested)', () => {
    const seasons = [season('now', 'active', 2026, '2026-01-01'), season('stray', 'draft', 2027, '2026-06-01')];
    const club = decideStrayOpenSeasons(seasons, 'now', 'club');
    assert.equal(club.action, 'refuse', 'a club team must never have an open season quietly completed');
    assert.deepEqual(club.action === 'refuse' ? club.open.map(s => s.id) : [], ['now', 'stray'],
      'the refusal names the season rolled from AND the stray one');
    assert.match(twoOpenSeasonsMessage('9U A', club.action === 'refuse' ? club.open : []),
      /^9U A has two seasons open: the 2026 Season and the 2027 Season, left as a draft\. Close one of them before starting another\. Nothing was changed\.$/);
  });

  it('the STANDALONE roll still completes a stray open season — its self-heal is kept (mutation-tested)', () => {
    const seasons = [season('now', 'active', 2026, '2026-01-01'), season('stray', 'draft', 2027, '2026-06-01')];
    assert.deepEqual(decideStrayOpenSeasons(seasons, 'now', 'coach'), { action: 'complete', seasonIds: ['stray'] });
  });

  it('with no stray season neither roll does anything', () => {
    const seasons = [season('now', 'active', 2026, '2026-01-01'), season('old', 'completed', 2025, '2025-01-01')];
    assert.deepEqual(decideStrayOpenSeasons(seasons, 'now', 'club'), { action: 'none' });
    assert.deepEqual(decideStrayOpenSeasons(seasons, 'now', 'coach'), { action: 'none' });
  });

  it('a club roll from a CLOSED season that finds ONE season opened meanwhile says so plainly (review 2026-09-28)', () => {
    const seasons = [season('old', 'completed', 2025, '2025-01-01'), season('raced', 'active', 2026, '2026-06-01')];
    const club = decideStrayOpenSeasons(seasons, 'old', 'club');
    assert.equal(club.action, 'refuse');
    const msg = twoOpenSeasonsMessage('9U A', club.action === 'refuse' ? club.open : []);
    assert.equal(msg, '9U A already has the 2026 Season open. Nothing was changed — refresh to see where the team is now.');
    assert.doesNotMatch(msg, /1 seasons/);
  });

  it('the club\'s Close never guesses between two open seasons — it asks which (review 2026-09-28)', () => {
    const patch = handler(readCode(ROUTE.clubSeasons), 'PATCH');
    assert.match(patch, /if \(open\.length > 1\) \{[\s\S]*?code: 'choose_season'/);
    assert.doesNotMatch(patch, /getActiveRepProgramYear\(/, 'the newest-created open season is usually the stray draft');
  });

  it('reopen and the first season re-check the WHOLE team after writing, and back out on a race', () => {
    const reopen = functionBody(readCode('lib/rep-season-rollover.ts'), 'reopenLatestClosedSeason');
    const flip = reopen.indexOf(".update({ status: 'active'");
    const recheck = reopen.indexOf('const otherLive = (await getRepProgramYears(teamId))');
    assert.ok(flip > 0 && recheck > flip, 'the team is read again AFTER the flip');
    assert.match(reopen.slice(recheck),
      /\.filter\(s => isLiveSeasonStatus\(s\.status\) && s\.id !== data\.id\);\s*if \(otherLive\.length > 0\) \{\s*await supabaseAdmin[\s\S]*?\.update\(\{ status: 'completed'[\s\S]*?reason: 'live_season_exists'/);
    const first = handler(readCode(ROUTE.programYears), 'POST');
    assert.match(first, /s\.createdAt < programYear\.createdAt/, 'the LATER of two simultaneous first seasons withdraws');
    assert.match(first, /from\('rep_program_years'\)\.delete\(\)\.eq\('id', programYear\.id\)/);
  });

  it('accepting names the seat actually held — a lost promotion never announces a head coach', () => {
    const accept = functionBody(readCode('lib/assistant-invites.ts'), 'acceptInviteRow');
    assert.match(accept, /if \(promoted\.ok\) \{ staffKind = null; seated = 'head_coach'; \}/);
    assert.match(accept, /coachRole: seated,/);
  });

  it('the roll asks the rule, states who manages, and never mints a club admin onto the staff', () => {
    const roll = readCode('lib/rep-season-rollover.ts');
    assert.match(roll, /decideStrayOpenSeasons\(existing, currentSeason\.id, managedBy\)/);
    assert.match(roll, /'two_open_seasons', 409/);
    assert.match(roll, /managedBy: 'coach' \| 'club';/, 'managedBy is REQUIRED — neither caller inherits the other\'s rules');
    assert.match(roll, /memberIds\.length === 0 && managedBy === 'coach'/,
      'the no-staff fallback mints the INITIATOR as head coach — a club owner must never be made the coach');
    assert.match(roll, /if \(isLiveSeasonStatus\(currentSeason\.status\)\) \{\s*await updateRepProgramYear\(currentSeason\.id, \{ status: 'completed' \}\)/,
      'rolling from a CLOSED season must not rewrite it (it un-archived an archived season)');
    assert.match(readCode(ROUTE.clubSeasons), /managedBy: 'club'/);
    assert.match(readCode(ROUTE.portalSeasons), /managedBy: 'coach'/);
  });

  it('the club\'s cash carry is always the team\'s own closing figure — never an amount from the request', () => {
    const post = handler(readCode(ROUTE.clubSeasons), 'POST');
    assert.match(post, /carryCash: \{ mode: 'all' \}/);
    assert.doesNotMatch(post, /body\.carryCash/);
  });

  it('close and reopen live in ONE place both doors call, every condition re-asserted in the WHERE', () => {
    const roll = readCode('lib/rep-season-rollover.ts');
    const close = functionBody(roll, 'closeOpenSeason');
    assert.match(close, /\.update\(\{ status: 'completed'[^}]*\}\)\s*\.eq\('id', seasonId\)\s*\.eq\('team_id', teamId\)\s*\.in\('status', \['draft', 'active'\]\)/);
    const reopen = functionBody(roll, 'reopenLatestClosedSeason');
    assert.match(reopen, /const live = await getActiveRepProgramYear\(teamId\);\s*if \(live\) return \{ ok: false, reason: 'live_season_exists'/,
      'reopen only while no season is live');
    assert.match(reopen, /closed\.status !== 'completed'/, 'an ARCHIVED season is not reopened');
    assert.match(reopen, /\.update\(\{ status: 'active'[^}]*\}\)\s*\.eq\('id', closed\.id\)\s*\.eq\('team_id', teamId\)\s*\.eq\('status', 'completed'\)/);
    assert.match(reopen, /projectMembershipsOntoProgramYear\(teamId, orgId, data\.id\)/,
      'a reopened season re-seats the CURRENT staff, or coaches added since it closed are locked out');
    for (const rel of [ROUTE.clubSeasons, ROUTE.portalSeasons]) {
      const patch = handler(readCode(rel), 'PATCH');
      assert.match(patch, /closeOpenSeason\(/, rel);
      assert.match(patch, /reopenLatestClosedSeason\(/, rel);
      assert.doesNotMatch(patch, /from\('rep_program_years'\)\s*\.update/, `${rel} writes the season row itself again`);
    }
  });

  it('the preflight NEVER refuses — it warns in counts, and says nothing that could block', () => {
    const get = handler(readCode(ROUTE.clubSeasons), 'GET');
    assert.doesNotMatch(get, /status: (4|5)\d\d/, 'the GET returns information only; the gate is the one refusal');
    assert.match(get, /unsettledFamilyCounts\(sheet\.rows\)/);
    assert.doesNotMatch(get, /expectedIn|totals\.payable|leftToSend|refund/, 'no dollar figure leaves the club\'s preflight (D1)');
  });

  it('the season doors are the owner or an admin with Rep Teams — never a treasurer', () => {
    const club = readCode(ROUTE.clubSeasons);
    for (const verb of ['GET', 'POST', 'PATCH']) {
      assert.match(handler(club, verb), /resolveClubTeam\(req, teamId, \{ write: true \}\)/, verb);
    }
    const gate = readCode('lib/club-team-route.ts');
    assert.match(gate, /opts\.write && ctx\.role !== 'owner' && ctx\.role !== 'admin'/);
    assert.match(gate, /repGroupScopeGuard\(ctx, team\.groupId\)/);
  });

  it('Add Program Year is the FIRST season only, and makes it live', () => {
    const post = handler(readCode(ROUTE.programYears), 'POST');
    assert.match(post, /if \(existing\.length > 0\) \{/);
    assert.match(post, /code: 'season_exists'/);
    assert.match(post, /status: 'active',/);
    assert.doesNotMatch(post, /py\.status === 'active'/, 'the old "only while none is ACTIVE" rule let a blank Draft sit beside a live season');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('S2-01 — the season-door predicate is ONE function, asked by the server and the page', () => {
  const org = (accountKind: string, planId: string, teamWorkspaceStatus: string | null) =>
    ({ accountKind, planId, teamWorkspaceStatus }) as never;

  it('a live standalone portal manages its own seasons; an adopted or archived one does not; a club never', () => {
    assert.equal(orgManagesOwnSeasons(org('team_workspace', 'team', 'active')), true);
    assert.equal(orgManagesOwnSeasons(org('team_workspace', 'team', 'linked')), true);
    assert.equal(orgManagesOwnSeasons(org('team_workspace', 'team', 'org_owned')), false, 'S2-01');
    assert.equal(orgManagesOwnSeasons(org('team_workspace', 'team', 'archived')), false);
    assert.equal(orgManagesOwnSeasons(org('organization', 'club', null)), false);
    assert.equal(mayManageSeasons(org('team_workspace', 'team', 'active'), 'head_coach'), true);
    assert.equal(mayManageSeasons(org('team_workspace', 'team', 'active'), 'assistant_coach'), false);
    assert.equal(seasonsClosedBy(org('organization', 'club', null)), 'club');
    assert.equal(seasonsClosedBy(org('team_workspace', 'team', 'active')), 'coach');
  });

  it('the closed-season page, the seasons route and the team route all ask lib/season-doors', () => {
    const page = readCode('app/[orgSlug]/coaches/teams/[teamId]/season-end/page.tsx');
    assert.match(page, /from '@\/lib\/season-doors'/);
    assert.match(page, /const showStartNext = !active && !!closed && mayManageSeasons\(currentOrg, coachRole\);/);
    assert.match(page, /\{!active && !managesOwnSeasons && \(/, 'the "Seasons are managed by" note asks the same predicate');
    assert.doesNotMatch(page, /accountKind === 'team_workspace'/, 'no hand-copied predicate on the page');
    for (const rel of [ROUTE.portalSeasons, ROUTE.portalTeam]) {
      const src = readCode(rel);
      assert.match(src, /mayManageSeasons\(/, rel);
      assert.doesNotMatch(src, /function mayManageSeasons|teamWorkspaceStatus !== 'org_owned'/, `${rel} keeps its own copy`);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('Specimen 4 — a refused save says why, in one coded answer', () => {
  it('the refusal carries the code, the season\'s name and who closed it', () => {
    const club = seasonNotLiveRefusal({ accountKind: 'organization', planId: 'club', teamWorkspaceStatus: null, name: 'Northfield Minor Ball' } as never, '2026 Season');
    assert.deepEqual(
      { ...club },
      { error: 'Northfield Minor Ball closed the 2026 Season, so this change wasn’t saved.', code: 'season_not_live', seasonName: '2026 Season', closedBy: 'club' },
    );
    const coach = seasonNotLiveRefusal({ accountKind: 'team_workspace', planId: 'team', teamWorkspaceStatus: 'active', name: 'Ridge' } as never, '2026 Season');
    assert.equal(coach.closedBy, 'coach');
    assert.equal(seasonNotLiveRefusal({ accountKind: 'organization', planId: 'club', teamWorkspaceStatus: null, name: 'X' } as never, null).seasonName, null);
  });

  it('the 409 is given only to a current member of the team — everyone else keeps the plain 403', () => {
    const fn = functionBody(readCode('lib/coach-season-refusal.ts'), 'refuseWithoutLiveSeat');
    const membershipAt = fn.indexOf('getEntitledTeamMembership(');
    const liveAt = fn.indexOf('getActiveRepProgramYear(');
    assert.ok(membershipAt > 0 && liveAt > membershipAt, 'membership is checked BEFORE anything about seasons is read');
    assert.match(fn, /if \(!membership\) return forbidden\(\);/);
    assert.match(fn, /catch[\s\S]*return forbidden\(\);/, 'a failure answers 403, never a 500');
  });

  it('no coach team route answers a missing live assignment with a bare forbidden() any more', () => {
    const root = path.join(import.meta.dirname, '..', '..', 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]');
    const files: string[] = [];
    (function walk(d: string) {
      for (const e of readdirSync(d)) { const p = path.join(d, e); if (statSync(p).isDirectory()) walk(p); else if (e === 'route.ts') files.push(p); }
    })(root);
    const offenders = files.filter(f => /if \(!assignment\) return (\{ (error|ok: false, res): )?forbidden\(\)/.test(
      readCode(path.relative(path.join(import.meta.dirname, '..', '..'), f)),
    ));
    assert.deepEqual(offenders, [], 'route the refusal through refuseWithoutLiveSeat (lib/coach-season-refusal.ts)');
    assert.ok(files.length > 80, 'the walk found the route tree');
    for (const rel of ['lib/coach-route-context.ts', 'lib/practice-plan-route-context.ts', 'lib/family-coach-route.ts']) {
      assert.match(readCode(rel), /refuseWithoutLiveSeat\(ctx\.org, ctx\.user\.id, teamId\)/, rel);
    }
  });

  it('the refusal takes no year — the one door is the team\'s closed-season page', () => {
    const src = readCode('lib/coach-season-refusal.ts');
    assert.doesNotMatch(src, /searchParams|yearId|programYearId/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('The coach is told when the club changes the season', () => {
  it('the three notices, in words, naming only what actually carried', () => {
    assert.deepEqual(
      clubSeasonNotice({ clubName: 'Northfield Minor Ball', teamName: '9U A', action: 'closed', seasonName: '2026 Season' }),
      { title: 'Northfield Minor Ball closed the 2026 Season', body: '9U A · Its page keeps the results, roster, practices and money.' },
    );
    assert.deepEqual(
      clubSeasonNotice({
        clubName: 'Northfield Minor Ball', teamName: '9U A', action: 'started', seasonName: '2027 Season',
        previousSeasonName: '2026 Season', carried: { players: 14, budgetPlan: true, feePlan: true, openingBalance: true },
      }).body,
      '9U A · Came with the team: 14 players, the budget plan, the fee plan and the opening balance. Tryouts are closed until you open them. The 2026 Season is kept as a record.',
    );
    assert.equal(
      clubSeasonNotice({ clubName: 'C', teamName: 'T', action: 'started', seasonName: '2027 Season', previousSeasonName: '2026 Season', carried: { players: 0, budgetPlan: false, feePlan: false, openingBalance: false } }).body,
      'T · Tryouts are closed until you open them. The 2026 Season is kept as a record.',
      'nothing carried → no "Came with the team" line',
    );
    assert.equal(clubSeasonNotice({ clubName: 'C', teamName: 'T', action: 'reopened', seasonName: '2026 Season' }).title, 'C reopened the 2026 Season');
  });

  it('the event types are registered as lifecycle bells', () => {
    for (const evt of ['club_season_changed', 'club_coach_joined'] as const) {
      assert.ok(NOTIFICATION_EVENT_LABELS[evt], evt);
      assert.equal(NOTIFICATION_CATEGORY[evt], 'know', evt);
      assert.ok(PUSH_DEFAULT_ON_EVENTS.has(evt), evt);
    }
  });

  it('each door tells the team\'s staff (memberships), never the person who pressed it', () => {
    const sender = readCode('lib/club-season-notify.ts');
    assert.match(sender, /listActiveStaffUserIds\(p\.team\.id\)/);
    assert.match(sender, /excludeUserIds: \[p\.actorUserId\]/);
    assert.match(sender, /eventType: 'club_season_changed'/);
    const club = readCode(ROUTE.clubSeasons);
    for (const action of ['started', 'closed', 'reopened']) {
      assert.match(club, new RegExp(`tellClubTeamStaff\\(\\{[^}]*action: '${action}'`), action);
    }
    assert.match(readCode(ROUTE.programYears), /tellClubTeamStaff\(\{[^}]*action: 'started'/,
      'the first season tells a staff invited before it');
  });

  it('the warning counts FAMILIES (siblings once), owing and waiting', () => {
    assert.deepEqual(unsettledFamilyCounts([
      { leftToSend: 50, refund: 0, familyKey: 'a' },
      { leftToSend: 20, refund: 0, familyKey: 'a' },
      { leftToSend: 0, refund: 12, familyKey: 'b' },
      { leftToSend: 0.004, refund: 0.004, familyKey: 'c' },
    ]), { familiesOwing: 1, familiesWaitingToReturn: 1 });
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('D10 + Ask 4 — Invite a coach: one door, both memberships, between seasons', () => {
  it('the club invites a head coach or an assistant; the club is the approver', () => {
    const post = handler(readCode(ROUTE.clubCoaches), 'POST');
    assert.match(post, /body\.kind === 'head_coach' \? 'head_coach' : body\.kind === 'assistant_coach' \? 'assistant_coach' : null/);
    assert.match(post, /sentBy: 'club'/);
    assert.match(post, /requireApproval: false/, 'Ask 6: the approval switch governs a head coach\'s own invites, not the club\'s');
    assert.match(post, /programYearId: workingSeason\?\.id \?\? null/, 'works for a team with no season yet (mig 312)');
    assert.match(post, /resolveClubTeam\(req, teamId, \{ write: true \}\)/);
    assert.match(post, /sendClubCoachInviteEmail\(/);
  });

  it('an invitation writes BOTH memberships on accept, in the seat it offers', () => {
    const accept = functionBody(readCode('lib/assistant-invites.ts'), 'acceptInviteRow');
    assert.match(accept, /from\('organization_members'\)\.insert\(\{[\s\S]*?role: 'coach'/, 'the coach\'s org membership');
    assert.match(accept, /await addStaffMember\(\{[\s\S]*?coachRole,/, 'the TEAM membership, in the invite\'s seat');
    assert.match(accept, /row\.coach_role === 'head_coach' \? 'head_coach' : 'assistant_coach'/);
    assert.match(accept, /setStaffMemberRole\(existing\.id, row\.team_id, 'head_coach'\)/, 'an existing assistant named head coach is promoted');
  });

  it('the head seat is a ROLE the portal\'s own door can never offer', () => {
    const portal = readCode(ROUTE.portalInvite);
    assert.doesNotMatch(portal, /coachRole|head_coach|sentBy/, 'the portal\'s invite route must never send a role');
    const invites = readCode('lib/assistant-invites.ts');
    assert.match(invites, /coach_role: input\.coachRole \?\? 'assistant_coach'/);
    assert.match(invites, /door === 'portal' \? q\.eq\('coach_role', 'assistant_coach'\) : q/, 'the portal never sees the club\'s head-coach invitation');
    for (const fn of ['listOpenAssistantInvitesForTeam', 'getOpenAssistantInviteForTeam', 'revokeAssistantInvite']) {
      assert.match(invites, new RegExp(`${fn}\\([^)]*door: InviteDoor = 'portal'`), `${fn} defaults to the portal's view`);
    }
    const migration = readCode('supabase/migrations/312_a_club_invites_its_head_coach.sql'.replace(/^/, ''));
    assert.match(migration, /check \(coach_role in \('head_coach', 'assistant_coach'\)\)/);
    assert.match(migration, /check \(coach_role <> 'head_coach' or staff_kind is null\)/);
  });

  it('the club\'s email names the club and the person, and never says "The head coach"', async () => {
    const { clubCoachInviteHtml, clubCoachInviteSubject } = await import('../../lib/email.ts').catch(() => ({}) as never);
    if (clubCoachInviteHtml) {
      const html = clubCoachInviteHtml({ clubName: 'Northfield <b>', teamName: '10U A', coachRole: 'head_coach', invitedByName: null, invitedByRoleWords: null, inviteUrl: 'https://x' });
      assert.doesNotMatch(html, /The head coach/);
      assert.match(html, /Northfield &lt;b&gt;/, 'escaped');
      assert.equal(clubCoachInviteSubject({ clubName: 'Northfield', teamName: '10U A', coachRole: 'head_coach' }), 'You’re the head coach of 10U A at Northfield');
    } else {
      const email = readCode('lib/email.ts');
      const fn = functionBody(email, 'clubCoachInviteHtml');
      assert.doesNotMatch(fn, /The head coach/);
      assert.match(fn, /escapeEmailHtml\(p\.clubName\)/);
    }
    assert.equal(clubRoleWords('owner'), 'the club’s owner');
    assert.equal(clubRoleWords('admin'), 'a club admin');
    assert.equal(clubRoleWords('treasurer'), null, 'a role the email cannot name honestly is left out');
  });

  it('removing the LAST head coach requires the explicit confirm; the portal still refuses it', () => {
    const del = handler(readCode(ROUTE.clubCoachRemove), 'DELETE');
    assert.match(del, /member\.coachRole === 'head_coach' && !confirmLastHeadCoach\s*&& wouldLeaveNoHeadCoach\(await countActiveHeadCoaches\(team\.id\), true\)/);
    assert.match(del, /code: 'last_head_coach'/);
    assert.match(del, /status: 409/);
    assert.match(del, /removeStaffMember\(ctx\.org\.id, team\.id, member\.userId, ctx\.user\.id\)/);
    assert.match(readCode(ROUTE.portalStaffMember), /refuseLastHeadCoach: true/, 'the portal\'s own rule is unchanged');
  });

  it('the "joined" notice reads memberships, and a club invite tells the club person who sent it', () => {
    // Session 3: the notices moved into ONE helper both answer doors call (the emailed link and the
    // home page's invitation card), so the two cannot tell different people.
    assert.match(readCode(ROUTE.accept), /await tellInviteAccepted\(result, user\)/);
    assert.match(readCode('app/api/auth/coach-invitations/[inviteId]/route.ts'), /await tellInviteAccepted\(result, user\)/);
    const src = readCode('lib/assistant-invite-notices.ts');
    assert.match(src, /listActiveStaffUserIds\(result\.teamId, \{ headCoachesOnly: true \}\)/);
    assert.doesNotMatch(src, /getRepTeamCoaches|getActiveRepProgramYear/, 'no season rows — between seasons they told nobody');
    assert.match(src, /eventType: 'club_coach_joined'/);
    assert.match(src, /userIds: \[result\.invitedByUserId\]/);
  });

  it('Resend and Cancel act through the club\'s door', () => {
    const src = readCode(ROUTE.clubInvite);
    assert.match(handler(src, 'POST'), /resendAssistantInvite\(inviteId, team\.id, \{ requireApproval: false, door: 'club' \}\)/);
    assert.match(handler(src, 'DELETE'), /revokeAssistantInvite\(inviteId, team\.id, 'club'\)/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('B07 — tryouts run on the live season, and the public has one rule', () => {
  it('the public tryout season is the LIVE one with tryouts open, never an archived team\'s', () => {
    const active = season('a', 'active', 2026, '2026-01-01', { tryoutOpen: true });
    const draft = season('d', 'draft', 2027, '2026-06-01', { tryoutOpen: true });
    assert.equal(publicTryoutSeasonOf({ isArchived: false }, [active])?.id, 'a');
    assert.equal(publicTryoutSeasonOf({ isArchived: false }, [active, draft])?.id, 'd', 'a Draft is live');
    assert.equal(publicTryoutSeasonOf({ isArchived: false }, [active, { ...draft, tryoutOpen: false }]), null,
      'an older season with the switch on is NOT the team\'s tryout');
    assert.equal(publicTryoutSeasonOf({ isArchived: false }, [season('c', 'completed', 2025, '2025-01-01', { tryoutOpen: true })]), null);
    assert.equal(publicTryoutSeasonOf({ isArchived: true }, [active]), null);
  });

  it('the team page, the sign-up API and the homepage list all ask the one rule', () => {
    assert.match(readCode('app/[orgSlug]/teams/[teamSlug]/page.tsx'), /publicTryoutSeasonOf\(team, programYears\)/);
    const reg = readCode(ROUTE.register);
    assert.match(reg, /const open = publicTryoutSeasonOf\(team, seasons\);\s*if \(!open \|\| open\.id !== programYear\.id\)/);
    assert.match(reg, /code: 'tryouts_not_open'/);
    assert.doesNotMatch(reg, /if \(!programYear\.tryoutOpen\)/, 'the switch alone accepted ANY season');
    assert.match(functionBody(readCode('lib/db.ts'), 'getOpenTryoutsByOrg'), /publicTryoutSeasonOf\(/);
    assert.match(readCode('lib/public-tryout.ts'), /publicTryoutSeasonOf\(team, seasons\)/);
  });

  it('an old season-numbered address redirects only while its season is the live one', () => {
    for (const rel of [
      'app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx',
      'app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/register/page.tsx',
    ]) {
      const src = readCode(rel);
      assert.match(src, /if \(live\?\.id === yearId\) redirect\(/, rel);
      assert.match(src, /season=\{null\}/, `${rel}: otherwise the team isn't taking sign-ups`);
    }
  });

  it('the club\'s tryout writes refuse a season that is not live', () => {
    assert.match(handler(readCode(ROUTE.adminTryouts), 'POST'), /refuseUnlessLiveSeason\(team, programYear,/);
    assert.match(handler(readCode(ROUTE.adminTryout), 'PATCH'), /refuseUnlessLiveSeason\(team, programYear,/);
    assert.match(handler(readCode(ROUTE.programYear), 'PATCH'), /typeof body\.tryoutOpen === 'boolean'\) \{\s*const notLive = await refuseUnlessLiveSeason/);
    const accept = functionBody(readCode('lib/db.ts'), 'acceptTryoutAndAddToRoster');
    assert.ok(accept.indexOf("'season_not_live'") > 0 && accept.indexOf("'season_not_live'") < accept.indexOf('accept_tryout_and_create_dues'),
      'the accept refuses a finished season BEFORE the roster write');
    const helper = functionBody(readCode('lib/club-team-route.ts'), 'refuseUnlessLiveSeason');
    assert.match(helper, /if \(live && live\.id === programYear\.id\) return null;/);
    assert.match(helper, /code: 'season_not_live'/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('B08 — one roster rule and one record rule, and every club surface calls them', () => {
  it('the roster counts ACTIVE players — never a call-up, never an inactive player', () => {
    assert.equal(countsOnRoster({ status: 'active' }), true);
    assert.equal(countsOnRoster({ status: 'callup' }), false);
    assert.equal(countsOnRoster({ status: 'inactive' }), false);
    assert.equal(rosterCountOf([{ status: 'active' }, { status: 'active' }, { status: 'callup' }, { status: 'inactive' }]), 2);
  });

  it('the record counts finalized league AND tournament games — never a scrimmage or a cancelled score', () => {
    const tally = seasonRecordOf([
      { eventType: 'league_game', isScrimmage: false, result: 'win', status: 'scheduled' },
      { eventType: 'tournament_game', result: 'loss', status: 'scheduled' },
      { eventType: 'external_tournament', result: 'tie' },
      { eventType: 'league_game', isScrimmage: true, result: 'win' },
      { eventType: 'league_game', result: 'win', status: 'cancelled' },
      { eventType: 'league_game', result: null },
      { eventType: 'practice', result: 'win' },
    ]);
    assert.deepEqual(tally, { w: 1, l: 1, t: 1 });
    assert.equal(countsInRecord({ eventType: 'tournament_game', result: 'win', status: 'scheduled' }), true,
      'the club schedule\'s widget counted league games only');
    assert.equal(hasDecidedGames({ w: 0, l: 0, t: 0 }), false);
  });

  it('every club surface reads the figures through the one rule', () => {
    const surfaces: Array<[string, RegExp]> = [
      ['lib/club-team-board.ts', /rosterCountOf\(/],
      ['lib/club-team-board.ts', /seasonRecordOf\(/],
      [ROUTE.teams, /loadClubBoard\(/],
      [ROUTE.team, /loadRosterCounts\(yearIds\)/],
      [ROUTE.team, /loadSeasonRecords\(yearIds\)/],
      [ROUTE.programYear, /loadRosterCounts\(\[programYear\.id\]\)/],
      ['app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx', /seasonRecordOf\(events\)/],
      ['app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx', /seasonRecordOf\(events\)/],
      ['app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx', /rosterCountOf\(roster\)/],
    ];
    for (const [rel, re] of surfaces) assert.match(readCode(rel), re, rel);
    const db = readCode('lib/db.ts');
    for (const fn of ['getRepTeamHistory', 'getRepCurrentSeasonSummary']) {
      const body = functionBody(db, fn);
      assert.match(body, /seasonRecordOf\(/, `${fn}: the record rule`);
      assert.match(body, /countsOnRoster\(|rosterCountOf\(/, `${fn}: the roster rule`);
    }
    assert.match(functionBody(db, 'getRepPastProgramYears'), /countsOnRoster\(/);
  });

  it('no club surface hand-tallies a record or counts a roster by hand any more', () => {
    for (const rel of [
      'app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx',
      'app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx',
      ROUTE.teams, ROUTE.team, 'lib/club-team-board.ts',
    ]) {
      const src = readCode(rel);
      assert.doesNotMatch(src, /result === 'win'\)\.length/, `${rel} tallies wins by hand`);
      assert.doesNotMatch(src, /from\('rep_roster_players'\)\s*\.select\('id', \{ count: 'exact'/, `${rel} counts a roster by hand`);
    }
  });

  it('the Documents column uses the Families book\'s forms rule', () => {
    const t = [{ team_id: null, document_type: 'waiver' }, { team_id: 't1', document_type: 'medical_consent' }, { team_id: 't2', document_type: 'other' }];
    assert.deepEqual(templatesForTeam(t, 't1').map(x => x.document_type), ['waiver', 'medical_consent']);
    assert.equal(hasEveryForm(new Set(['waiver', 'medical_consent']), templatesForTeam(t, 't1')), true);
    assert.equal(hasEveryForm(new Set(['waiver']), templatesForTeam(t, 't1')), false);
    assert.equal(formOnFile(new Set(['waiver']), { document_type: 'waiver' }), true);
    assert.match(readCode('lib/families-read.ts'), /templatesForTeamRule\(/, 'the Families book reads the same rule');
    assert.match(readCode('lib/club-team-board.ts'), /hasEveryForm\(/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('B09 / B11 / B12 / B13 — the rest of the server list', () => {
  it('the team PATCH takes a group, validated to the club and to the member\'s groups', () => {
    const patch = handler(readCode(ROUTE.team), 'PATCH');
    assert.match(patch, /from\('rep_team_groups'\)\.select\('id'\)\.eq\('id', groupId\)\.eq\('org_id', ctx!\.org\.id\)/);
    assert.match(patch, /code: 'group_not_found'/);
    assert.match(patch, /code: 'group_out_of_scope'/);
    assert.match(patch, /fields\.groupId = groupId;/);
    assert.match(functionBody(readCode('lib/db.ts'), 'updateRepTeam'), /patch\.group_id = fields\.groupId/);
  });

  it('a template\'s team must be one of this club\'s (create and update), checked before anything is stored', () => {
    const post = handler(readCode(ROUTE.templates), 'POST');
    const check = post.indexOf('refuseTeamOutsideClub(ctx!, teamId)');
    assert.ok(check > 0 && check < post.indexOf('.upload('), 'refused before the file is uploaded');
    assert.match(handler(readCode(ROUTE.template), 'PATCH'), /refuseTeamOutsideClub\(ctx!, teamId\)/);
    assert.match(functionBody(readCode('lib/club-team-route.ts'), 'refuseTeamOutsideClub'), /team\.orgId !== ctx\.org\.id/);
    assert.match(handler(readCode(ROUTE.templates), 'GET'), /teamIdsInScope\(ctx!\)/, 'a group-limited member sees only their groups\' teams');
  });

  it('the money decisions carry the team-group guard', () => {
    // Club Tier Stage 3a: the decisions moved into the one-step moves (lib/club-money-moves.ts), which
    // check the group limit before they write — club-stage3a-server-guard.test.ts holds each move to it.
    // Session 2 retired the old Rep Teams doors; Accounting's routes delegate, never write themselves.
    const request = handler(readCode('app/api/admin/accounting/payment-requests/[id]/route.ts'), 'PATCH');
    assert.match(request, /clubDeclineRequest\(ctx,/);
    assert.match(request, /clubApproveRequest\(ctx,/);
    assert.doesNotMatch(request, /from\('rep_team_payment_requests'\)/);
    const installment = readCode('app/api/admin/accounting/allocations/[allocationId]/installments/[installId]/route.ts');
    assert.match(installment, /clubReceiveInstallment\(ctx,/);
    assert.doesNotMatch(installment, /create_accounting_transfer/);
    assert.match(handler(readCode('app/api/admin/rep-teams/allocations/[allocationId]/route.ts'), 'PATCH'),
      /const inScope = await teamIdsInScope\(ctx!\);[\s\S]*detail\.splits\.some\(s => !inScope\.has\(s\.teamId\)\)/);
  });

  it('B10: coach standing on the four routes and the oversight list is TEAM MEMBERSHIP', () => {
    const access = functionBody(readCode('lib/team-workspace-entitlements.ts'), 'getTeamScopedRepTeamAccess');
    // The membership read, inline (session 2, 2026-09-29): same four filters as getActiveTeamMembership.
    assert.match(access, /\.from\('rep_team_staff_memberships'\)[\s\S]*?\.eq\('org_id', params\.orgId\)[\s\S]*?\.eq\('team_id', params\.repTeamId\)[\s\S]*?\.eq\('user_id', params\.userId\)[\s\S]*?\.eq\('status', 'active'\)/);
    assert.doesNotMatch(access, /rep_team_coaches/);
    // ⚠ Never through coach-membership, even dynamically: this file is in the BROWSER bundle (via
    // db.ts), and coach-membership → api-auth → next/headers 500'd every dev page (2026-09-29).
    assert.doesNotMatch(readCode('lib/team-workspace-entitlements.ts'), /['"]\.\/coach-membership['"]/);
    assert.match(functionBody(readCode('lib/db.ts'), 'getOrgAssistantCoaches'), /from\('rep_team_staff_memberships'\)/);
    assert.match(readCode('app/api/coaches/[orgSlug]/team-links/route.ts'), /getActiveTeamMembership\(ctx\.org\.id, workspace\.repTeamId, ctx\.user\.id\)/);
  });

  it('B12: the club\'s team-links API needs the Rep Teams module', () => {
    // Session 2 (the team move) folded the gate into the route's one resolver; both verbs call it.
    const src = readCode(ROUTE.teamLinks);
    assert.match(functionBody(src, 'resolveClub'), /hasModuleEntitlement\(ctx\.org, 'module_rep_teams'\)/);
    for (const verb of ['GET', 'POST']) {
      assert.match(handler(src, verb), /await resolveClub\(req\)/, verb);
    }
  });

  it('B13: the seed writes a real roster source and a real membership; the Shared Book switch is the head coach\'s', () => {
    const seed = readCode(ROUTE.seed);
    assert.match(seed, /source:\s+'admin_manual'/);
    assert.doesNotMatch(seed, /source:\s+'admin',/);
    assert.match(seed, /addStaffMember\(\{ orgId: org\.id, teamId: team\.id, userId: coachAuth\.id, coachRole: 'head_coach' \}\)/);
    const team = readCode(ROUTE.portalTeam);
    assert.match(team, /canEdit: assignment\.capabilities\.isHeadCoach,/);
    assert.match(team, /denyUnless\(\s*assignment\.capabilities\.isHeadCoach,\s*'Only the head coach can change book sharing\.'/);
  });
});
