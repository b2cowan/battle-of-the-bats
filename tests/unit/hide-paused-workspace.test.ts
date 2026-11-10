/**
 * Hide a paused workspace (owner ruling 2026-11-09, migration 456).
 *
 * THE BUG THIS CLOSES: Home's Workspaces list asked "is this person a coach there, and is the subscription active?" while
 * the Coaches Portal's own gate also asks "does the club's PLAN carry the portal?" (B05). A coach on a club that moved to a
 * plan without the portal still got a card, and the card opened a wall. The list now asks the gate's own question, labels
 * the card "Paused", and lets the coach hide it. HIDE, NOT LEAVE: the hide is one personal row; it only applies while the
 * workspace is paused, and it is removed once it no longer applies.
 *
 * Real user-contexts runs; only the database and the hide table are replaced.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { billingTestLoader } from './_billing-test-loader.ts';
import { isTeamWorkspaceOrg } from '../../lib/team-workspace-kind.ts';
import type { UserAccessContext, HiddenWorkspace, LapsedWorkspace, WorkspaceDoor } from '../../lib/user-contexts.ts';

const userId = 'coach-1';
const ORG = 'org-1';

type World = { plan: string; status?: string; hidden?: string[]; role?: string; assignments?: number };

function world(w: World) {
  const dropped: string[][] = [];
  const member = {
    id: 'm-1', organization_id: ORG, role: w.role ?? 'coach', capabilities: null,
    organizations: {
      id: ORG, slug: 'falcons-club', name: 'Falcons Club', plan_id: w.plan, account_kind: 'organization',
      subscription_status: w.status ?? 'active', enabled_addons: [], onboarding_completed_at: '2026-10-01', free_floor: null,
    },
  };
  const chain = (data: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'not', 'neq', 'limit']) c[m] = () => c;
    c.maybeSingle = async () => ({ data: null, error: null });
    c.then = (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve, reject);
    return c;
  };
  const load = billingTestLoader({
    './db': {
      getCoachingAssignmentsForUser: async () => Array.from({ length: w.assignments ?? 0 }, (_, i) => ({ teamId: `t${i}`, teamName: `Team ${i}` })),
      getClosedCoachingAssignmentsForUser: async () => [],
    },
    './supabase-admin': { supabaseAdmin: { from: (table: string) => chain(table === 'organization_members' ? [member] : []) } },
    './entitlement-grants': { effectiveOrgFacts: async () => new Map() },
    './basic-coach-teams': { getBasicCoachTournamentSummary: async () => ({ teamCount: 0 }), countClaimableRegistrationsForUser: async () => 0 },
    './fan-follows': { getFanFollowSummary: async () => ({ followCount: 0 }) },
    './house-league-coach': { getCoachTeamCards: async () => [] },
    './house-league-coach-invites': {},
    './team-workspace-entitlements': { isTeamWorkspaceOrg },
    './user-hidden-workspaces': {
      readHiddenOrgIds: async () => new Set(w.hidden ?? []),
      dropStaleHiddenWorkspaces: async (_u: string, ids: string[]) => { if (ids.length) dropped.push(ids); },
    },
  });
  const mod = load('lib/user-contexts.ts') as {
    getUserAccessContexts: (u: { id: string; email: string }) => Promise<UserAccessContext[]>;
    getHiddenWorkspaces: (id: string) => Promise<HiddenWorkspace[]>;
    getLapsedWorkspacesForUser: (id: string) => Promise<LapsedWorkspace[]>;
    canHideWorkspace: (id: string, orgId: string) => Promise<boolean>;
    workspaceDoorsFromContexts: (c: UserAccessContext[]) => WorkspaceDoor[];
  };
  return { ...mod, dropped, contexts: () => mod.getUserAccessContexts({ id: userId, email: 'c@example.test' }) };
}

describe('a coach card asks the same plan question the portal gate asks', () => {
  it('a club whose plan has no Coaches Portal: the card shows, says Paused, and is marked paused', async () => {
    const w = world({ plan: 'tournament' });
    const [card, ...rest] = await w.contexts();
    assert.equal(rest.length, 0);
    assert.equal(card.paused, 'plan');
    assert.match(card.detail, /^Paused/);
    assert.equal(card.destination, '/falcons-club/coaches', 'it still opens the wall, which explains why');
  });
  it('a club whose plan carries the portal: an ordinary card, never paused', async () => {
    const w = world({ plan: 'club' });
    const [card] = await w.contexts();
    assert.equal(card.paused, undefined);
    assert.equal(card.detail, 'Coach');
  });
  it('an admin who also coaches on a paused club: the coach card is paused, the admin card is not', async () => {
    const w = world({ plan: 'tournament', role: 'admin', assignments: 1 });
    const all = await w.contexts();
    assert.equal(all.find(c => c.kind === 'organization')?.paused, undefined);
    assert.equal(all.find(c => c.kind === 'coaches_premium')?.paused, 'plan');
  });
});

describe('hiding a paused workspace', () => {
  it('a hidden paused card is not drawn, and Home lists it under Hidden', async () => {
    const w = world({ plan: 'tournament', hidden: [ORG] });
    assert.equal((await w.contexts()).length, 0);
    assert.deepEqual(await w.getHiddenWorkspaces(userId), [{ orgId: ORG, orgName: 'Falcons Club' }]);
    assert.deepEqual(w.dropped, [], 'a hide that still applies is kept');
  });
  it('when the club comes back the card returns by itself and the stale hide is deleted', async () => {
    const w = world({ plan: 'club', hidden: [ORG] });
    const [card] = await w.contexts();
    assert.equal(card.paused, undefined);
    assert.deepEqual(await w.getHiddenWorkspaces(userId), []);
    // (Memoized once per request in the app; outside a request each read repeats the idempotent delete.)
    assert.ok(w.dropped.length >= 1 && w.dropped.every(ids => ids.join() === ORG), 'the stale hide is deleted');
  });
  it('a hide for a club the person is no longer part of is deleted', async () => {
    const w = world({ plan: 'tournament', hidden: ['some-other-org'] });
    await w.getHiddenWorkspaces(userId);
    assert.deepEqual(w.dropped, [['some-other-org']]);
  });
  it('a lapsed subscription is hideable too: its Reactivate card leaves the list and joins Hidden', async () => {
    const shown = world({ plan: 'club', status: 'canceled' });
    assert.equal((await shown.getLapsedWorkspacesForUser(userId)).length, 1);
    const hidden = world({ plan: 'club', status: 'canceled', hidden: [ORG] });
    assert.equal((await hidden.getLapsedWorkspacesForUser(userId)).length, 0);
    assert.equal((await hidden.getHiddenWorkspaces(userId)).length, 1);
  });
  it('only a PAUSED workspace can be hidden — a working one, or one the person is not in, cannot', async () => {
    assert.equal(await world({ plan: 'tournament' }).canHideWorkspace(userId, ORG), true);
    assert.equal(await world({ plan: 'club', status: 'canceled' }).canHideWorkspace(userId, ORG), true);
    assert.equal(await world({ plan: 'club' }).canHideWorkspace(userId, ORG), false);
    assert.equal(await world({ plan: 'tournament' }).canHideWorkspace(userId, 'someone-elses-org'), false);
    assert.equal(await world({ plan: 'tournament', role: 'admin' }).canHideWorkspace(userId, ORG), false, 'an admin who coaches nothing has no card to hide');
  });
});

describe('the Workspaces menu lists only places you can go', () => {
  it('a paused workspace is not a door in the menu (Home carries it, labelled)', async () => {
    const w = world({ plan: 'tournament' });
    assert.deepEqual(w.workspaceDoorsFromContexts(await w.contexts()), []);
    const live = world({ plan: 'club' });
    assert.equal(live.workspaceDoorsFromContexts(await live.contexts()).length, 1);
  });
});

describe('the hide route and its storage', () => {
  const route = readFileSync('app/api/consumer/hidden-workspaces/route.ts', 'utf8');
  it('refuses a hide unless the workspace is paused for the caller', () => {
    assert.match(route, /canHideWorkspace\(user\.id, raw\.orgId\)/);
    assert.match(route, /status: 409/);
    assert.match(route, /getAuthenticatedUser/);
  });
  it('is walled in the database: RLS on, no policies, service role only', () => {
    const sql = readFileSync('supabase/migrations/456_a_coach_can_hide_a_paused_workspace.sql', 'utf8');
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.user_hidden_workspaces FROM anon, authenticated/);
    assert.doesNotMatch(sql, /CREATE POLICY/);
  });
  it('a paused card is a plain card, not a door — except for the club\'s owner, whose wall offers "See plans"', () => {
    const home = readFileSync('components/consumer/HomePersonalization.tsx', 'utf8');
    assert.match(home, /const plain = !!ctx\.paused && !ctx\.pausedFor\?\.viewerIsOwner;/);
    assert.match(home, /if \(plain\) \{\s*return <div className=\{styles\.wsCard\} data-paused="true" data-plain="true">/, 'no link, no arrow');
    assert.match(home, /Your teams and records are kept\./);
    assert.match(home, /Ask \$\{ctx\.pausedFor\.ownerName\} about the plan\./);
    const route = readFileSync('app/api/consumer/home/route.ts', 'utf8');
    assert.match(route, /const viewerIsOwner = ownedOrgIds\.has\(c\.orgId\);/);
    assert.match(route, /viewerIsOwner \? null : await orgOwnerDisplayName\(c\.orgId\)/, 'the owner is never told to ask themselves');
    // The owner's name is read for Home only — never inside the library that sign-in and the menu share.
    assert.doesNotMatch(readFileSync('lib/user-contexts.ts', 'utf8'), /orgOwnerDisplayName/);
  });
  it('Home puts Hide under a paused or lapsed card as a sibling of its link, never inside it', () => {
    const home = readFileSync('components/consumer/HomePersonalization.tsx', 'utf8');
    assert.match(home, /<HideRow name=\{ws\.title\}/);
    assert.match(home, /<HideRow name=\{l\.orgName\}/);
    assert.match(home, /Hidden workspaces \(/);
  });
});
