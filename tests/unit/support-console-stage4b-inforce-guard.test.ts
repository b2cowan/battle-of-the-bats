/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE, STAGE 4b — THE ONE QUESTION (build prompt Parts 1–2, §8 guards 1, 2 and 10; plan "Stage 4b
 * build gate").
 *
 * "Is this Coaches Portal in force right now?" replaced six private definitions of a live portal. A portal on free
 * time is stored cancelled and held open by a grant, so a reader that still asks the workspace's own status would send
 * the coach to their free team DURING free time, and a list that reads the stored status would count the portal as a
 * cancelled customer. This file holds:
 *   1. the new power (Q3);
 *   2. the rule itself, including the free-time case through Stage 4's fold;
 *   3. the census allowlist: no raw read of a portal's liveness outside the files named here, each with its reason;
 *   4. the wall a coach meets after free time ends (never "subscription ended");
 *   5. a free-time portal is never churn (T35).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, filesUnder } from './_source-code.ts';
import { endedLastDay, freeTimeEndedWallWords } from '../../lib/portal-free-time.ts';
import { isEntitlementRunning, isPortalInForceFrom } from '../../lib/portal-in-force.ts';
import { foldGrants } from '../../lib/free-time.ts';
import { PLATFORM_AREAS, PLATFORM_POWERS, hasPlatformPower } from '../../lib/platform-areas.ts';

describe('1 · portal free time is its own power (Q3)', () => {
  it('Super admin, Billing and Support hold it; Product, Growth and Read only do not', () => {
    assert.deepEqual([...PLATFORM_POWERS.portal_free_time].sort(), ['billing', 'super_admin', 'support']);
    for (const role of ['product', 'growth', 'read_only'] as const) {
      assert.equal(hasPlatformPower(role, 'portal_free_time'), false, role);
    }
  });

  it('the person record and the portal record use it, so the eye tells the truth on both', () => {
    assert.ok(PLATFORM_AREAS.customer_users.powers.includes('portal_free_time'));
    assert.ok(PLATFORM_AREAS.organizations.powers.includes('portal_free_time'));
  });
});

const END = '2026-12-27T04:59:59.999Z'; // the end of Dec 26, 2026 in Toronto
const NOW = new Date('2026-11-01T12:00:00Z');
const running = { status: 'active', starts_at: '2026-10-27T12:00:00Z', ends_at: END };

describe('2 · the one question (lib/portal-in-force.ts)', () => {
  it('a running entitlement on an organization the door reads open is in force', () => {
    assert.equal(isPortalInForceFrom({ doorStatus: 'active', entitlements: [running] }, NOW), true);
  });

  it('one that ended a millisecond ago is not; nor one not started; nor a cancelled entitlement', () => {
    const at = new Date(END);
    assert.equal(isPortalInForceFrom({ doorStatus: 'active', entitlements: [running] }, new Date(at.getTime() - 1)), true);
    assert.equal(isPortalInForceFrom({ doorStatus: 'active', entitlements: [running] }, at), false, 'the end is exclusive');
    assert.equal(isEntitlementRunning({ ...running, starts_at: '2026-11-02T00:00:00Z' }, NOW), false, 'a future start');
    assert.equal(isEntitlementRunning({ ...running, status: 'cancelled' }, NOW), false);
    assert.equal(isEntitlementRunning({ ...running, ends_at: null }, NOW), true, 'a paid portal has no end');
  });

  it('an organization the door reads cancelled is not in force, whatever its entitlement says', () => {
    assert.equal(isPortalInForceFrom({ doorStatus: 'canceled', entitlements: [running] }, NOW), false);
    assert.equal(isPortalInForceFrom({ doorStatus: null, entitlements: [running] }, NOW), false);
    assert.equal(isPortalInForceFrom({ doorStatus: 'active', entitlements: [] }, NOW), false);
  });

  it('a free-time portal: stored cancelled and held open by its grant; ended when the grant ends; ended with the switch off', () => {
    const own = { planId: 'tournament' as const, subscriptionStatus: 'canceled' as const, enabledAddons: [], storedTournamentLimit: null, storedTeamLimit: null };
    const grant = { type: 'subscription_status', value: 'active', target: { status: 'active' }, starts_at: '2026-10-27T12:00:00Z', expires_at: END, revoked_at: null };
    const door = (now: Date, enabled = true) => foldGrants(own, [grant], now, enabled).subscriptionStatus;
    assert.equal(isPortalInForceFrom({ doorStatus: door(NOW), entitlements: [running] }, NOW), true);
    const after = new Date(new Date(END).getTime() + 1);
    assert.equal(isPortalInForceFrom({ doorStatus: door(after), entitlements: [running] }, after), false, 'lapsed');
    assert.equal(isPortalInForceFrom({ doorStatus: door(NOW, false), entitlements: [running] }, NOW), false, 'switch off = the stored state');
  });
});

/**
 * THE CENSUS ALLOWLIST (build gate step 2). A read of a portal workspace's own `subscription_status`, or of a team
 * entitlement's status or end, outside these files fails the build: liveness is the one question. Writers may touch
 * the columns anywhere (they keep the Stripe mirror up to date).
 */
const WORKSPACE_STATUS_READERS: Record<string, string> = {
  'app/api/billing/webhook/route.ts': 'Stripe sync: finds the row it is about to rewrite',
  'lib/team-checkout.ts': 'reactivation: changes the rows it reads',
  'lib/team-org-billing.ts': 'the club billing move: reads the row it rewrites',
  'lib/team-org-links.ts': "a link summary's stored display (adopted by a club), not liveness",
  'lib/lead-book.ts': '"pays now" is the stored billing standing; a portal billed by nobody never pays',
};
const ENTITLEMENT_READERS: Record<string, string> = {
  'lib/team-workspace-entitlements.ts': 'the per-team gate: the same running rule as the one question',
  'lib/portal-in-force-server.ts': 'the one question',
};

const CODE_FILES = ['app', 'lib', 'components']
  .flatMap(root => [...filesUnder(root, '.ts'), ...filesUnder(root, '.tsx')])
  .filter(f => !f.includes('.test.'));

/** Files with a READ chain on `table` (no update/insert/upsert/delete in it) that names `column`. */
function liveReads(table: string, column: RegExp): string[] {
  const out = new Set<string>();
  const from = new RegExp(`\\.from\\('${table}'\\)`, 'g');
  for (const file of CODE_FILES) {
    const code = readCode(file);
    for (const m of code.matchAll(from)) {
      const end = code.indexOf(';', m.index);
      const chain = code.slice(m.index, end < 0 ? m.index + 800 : end);
      if (/\.(update|insert|upsert|delete)\(/.test(chain)) continue;
      if (column.test(chain)) out.add(file);
    }
  }
  return [...out];
}

describe("3 · nothing reads a portal's liveness around the one question (the census)", () => {
  it('raw reads of a workspace status are the allowlisted ones', () => {
    for (const file of liveReads('team_workspaces', /subscription_status/)) {
      assert.ok(file in WORKSPACE_STATUS_READERS,
        `${file} reads team_workspaces.subscription_status: ask the one question (lib/portal-in-force-server.ts), or allowlist it here with its reason`);
    }
  });

  it('raw reads of an entitlement status or end are the allowlisted ones', () => {
    for (const file of liveReads('team_entitlements', /ends_at|status/)) {
      assert.ok(file in ENTITLEMENT_READERS, `${file} reads team_entitlements' status or end: ask the one question instead`);
    }
  });

  it('the private definitions of "live portal" are gone', () => {
    for (const file of CODE_FILES) {
      assert.doesNotMatch(readCode(file), /isLivePortalStatus|LIVE_TEAM_WORKSPACE_SUB_STATUSES/, file);
    }
  });

  it('each moved reader asks the one question', () => {
    const moved: [string, string][] = [
      ['lib/coach-team-page.ts', 'portalsInForce'],
      ['lib/coach-team-page.ts', 'workspacesInForce'],
      ['lib/basic-coach-teams.ts', 'workspacesInForce'],
      ['lib/registrable-teams-server.ts', 'portalsInForce'],
      ['lib/team-workspace-owned.ts', 'portalsInForce'],
      ['app/platform-admin/customer-users/people-rows.ts', 'portalsInForce'],
    ];
    for (const [file, fn] of moved) assert.match(readCode(file), new RegExp(`\\b${fn}\\(`), `${file} calls ${fn}`);
  });

  it('the two sweeps read the club through the door, so a lapsed grant drops the portal from both', () => {
    const db = readCode('lib/db.ts');
    const digestTeams = db.slice(db.indexOf('export async function getInsightsDigestTeams'));
    assert.match(digestTeams.slice(0, 3000), /effectiveStatuses\(/);
    for (const sweep of ['lib/dues-reminders.ts', 'lib/insights-digest.ts']) {
      assert.match(readCode(sweep), /getInsightsDigestTeams\(/, sweep);
    }
  });

  it('the one question reaches no cancel, retention clock, Stripe or email (T15)', () => {
    for (const file of ['lib/portal-in-force.ts', 'lib/portal-in-force-server.ts']) {
      for (const [, spec] of readCode(file).matchAll(/from '([^']+)'/g)) {
        assert.doesNotMatch(spec, /billing-retention|cancel|operator-plan-change|stripe|email/i, `${file} imports ${spec}`);
      }
    }
  });
});

describe('4 · a coach whose free time ended never reads "subscription ended"', () => {
  it('the words (copy 8)', () => {
    const w = freeTimeEndedWallWords('2026-12-26');
    assert.equal(w.title, 'Your free time has ended');
    assert.equal(w.text, 'Your Premium free time ran through December 26, 2026. Your team is back on the free Coaches Portal, and everything you made on Premium is saved. It comes back if you choose Premium again.');
    assert.equal(w.door, 'Go to your team');
    assert.doesNotMatch(`${w.title} ${w.text}`, /subscription/i);
  });

  it('the last day: ended early is the day it was ended; ended by itself is its own last day; running is none', () => {
    assert.equal(endedLastDay({ starts_at: null, expires_at: END, revoked_at: '2026-11-03T15:00:00Z' }, NOW), '2026-11-03');
    assert.equal(endedLastDay({ starts_at: null, expires_at: END, revoked_at: null }, new Date('2027-01-01T00:00:00Z')), '2026-12-26');
    assert.equal(endedLastDay({ starts_at: null, expires_at: END, revoked_at: null }, NOW), null);
  });

  it('the portal shell picks it, only for a portal staff gave free time and nobody pays for', () => {
    const layout = readCode('app/[orgSlug]/coaches/layout.tsx');
    assert.match(layout, /endedPortalFreeTime\(authCtx\.org\.id\)/);
    assert.match(layout, /freeTimeEnded \? \(\s*<FreeTimeEndedWall/);
    assert.match(readCode('lib/portal-free-time-server.ts'), /billing_mode !== 'platform_override'/);
  });
});

describe('5 · a free-time portal is not a customer, so it is never churn (T35, gate step 3)', () => {
  it('Business numbers, the lead book and the Clubs list leave it out', () => {
    assert.match(readCode('lib/platform-metrics.ts'), /!freeTimePortals\.has\(org\.id\)/);
    assert.match(readCode('lib/lead-book.ts'), /!freeTimePortals\.has\(r\.id\)/);
    assert.match(readCode('app/platform-admin/orgs/page.tsx'), /isFreeTimePortal: +freeTimePortals\.has\(id\)/);
    assert.match(readCode('app/platform-admin/orgs/OrgsClient.tsx'), /statusFilter === 'canceled' && !isCancelledCustomer\(o\)/);
  });

  it("the mark is the give's own (free_time_given_at, mig 406), never the workspace's source (Founding and comped portals are platform_admin too)", () => {
    const server = readCode('lib/portal-free-time-server.ts');
    const fn = server.slice(server.indexOf('export async function freeTimePortalOrgIds'));
    assert.match(fn, /\.not\('free_time_given_at', 'is', null\)/);
    assert.match(fn, /\.eq\('billing_mode', 'platform_override'\)/);
    assert.doesNotMatch(fn, /\.eq\('source'/);
  });
});
