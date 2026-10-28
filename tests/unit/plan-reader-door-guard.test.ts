/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **ONE DOOR FOR "WHAT PLAN IS THIS CLUB ON RIGHT NOW"** (Support console Stage 4, owner ruling Q1,
 * 2026-10-25).
 *
 * Free time gives a club a whole plan, sections or a billing status for a set time, and the product takes it back by
 * itself: nothing is scheduled, every reader asks the door (`lib/entitlement-grants.ts`), which compares the end with
 * the moment of reading. That only holds while NOTHING reads the stored columns around the door. A reader that does
 * keeps a club on its stored plan while it is free (a bounce, a closed section), and the bug is silent.
 *
 * THE RULES:
 *   1. A file that names `plan_id`, `tournament_limit`, `team_limit`, `subscription_status` or `enabled_addons` in code
 *      (comments ignored) is on `ALLOWED`, with its class and reason. A new one fails: route it through the door, or add
 *      it here with a reason someone can argue with. A file that stops naming them fails too, so the list cannot rot.
 *   2. The three org builders hand the door the stored limits (a free club stores a tournament limit of 1, and the
 *      given plan must not be clamped by it).
 *   3. Every billing ACTION reads the plan the club holds (`ownPlanOf`), never the door's `planId`: reading the given
 *      plan let a free club on free Club time downgrade itself onto Tournament Plus and keep it (/billing, 2026-10-25).
 *   4. `proxy.ts` reads no plan (its Tournament-tier bounce went: owner, 2026-10-25).
 *
 * Classes:
 *   door      the door and the three builders that call it
 *   through   selects the columns and hands them straight to the door (the door's answer is what decides)
 *   writer    writes them (Stripe, plan changes, the console's own writes, creation)
 *   stored    reads what the club HOLDS on purpose (revenue and customer counts, billing standing, audiences, the
 *             console showing the stored plan beside free time)
 *   portal    a Coaches Portal's own columns on `team_workspaces` (free time does not reach a portal: owner Q10)
 *   identity  `plan_id === 'team'` as the Coaches Portal stub's identity, not a rank
 *   other     another table's column of the same name
 *   dev       dev and seed tooling
 *
 * ⚠ Scope: a scan sees names, not meaning. A file on the list can still grow a new raw read beside its allowed one;
 * review keeps that honest. And the DATABASE reads these columns too: the fee-book checks call `org_effective_plan`
 * (migration 373), the one SQL copy of the door's plan rule.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Klass = 'door' | 'through' | 'writer' | 'stored' | 'portal' | 'identity' | 'other' | 'dev';

const ALLOWED: Record<string, [Klass, string]> = {
  // ── the door ──
  'lib/entitlement-grants.ts': ['door', 'the door itself'],
  'lib/free-time.ts': ['door', "the door's rules: the columns it folds"],
  'lib/api-auth.ts': ['door', 'getAuthContext builds the org, then calls the door with the stored limits'],
  'lib/db.ts': ['door', 'getOrganizationBySlug builds the org, then calls the door; createOrganization writes them; the sweep reads status through the door'],
  'lib/server-organizations.ts': ['door', 'getOrganizationBySlugForServer builds the org, then calls the door'],
  // ── through the door ──
  'lib/directory.ts': ['through', 'the sitemaps fold every row through the door; the followable filter keeps stored "canceled" (a cancel also makes the club not public, so no grant can make it discoverable)'],
  'lib/fan-follows.ts': ['through', 'selects status, the door decides cancelled'],
  'lib/platform-online-payments.ts': ['through', 'the console’s Online payments tab (Club Tier 12d-2) names a suspension from the stored status; the plan it reads is the door’s (effectiveOrgFactsForId)'],
  'lib/scores-feed.ts': ['through', 'selects status, the door decides cancelled'],
  'lib/user-contexts.ts': ['through', 'membership reads fold through withEffectiveOrgs'],
  'lib/invite-acceptance.ts': ['through', 'folds through withEffectiveOrgs before routing'],
  // ── writers ──
  'app/api/billing/webhook/route.ts': ['writer', 'Stripe is the source of truth for what the club holds'],
  'app/api/billing/create-checkout/route.ts': ['writer', 'plan change on checkout'],
  'app/api/billing/downgrade/confirm/route.ts': ['writer', 'plan change'],
  'app/api/billing/cancel/confirm/route.ts': ['writer', 'cancellation'],
  'app/api/billing/mock-apply/route.ts': ['writer', 'mock checkout (dev)'],
  'app/api/admin/org/onboarding-plan/route.ts': ['writer', 'onboarding plan write'],
  'lib/operator-plan-change.ts': ['writer', 'the one operator plan-change rule'],
  'lib/plan-move.ts': ['writer', 'plan move side effects (clears team_limit)'],
  'lib/billing-retention.ts': ['writer', 'cancellation retention writes status'],
  'lib/club-record-changes.ts': ['writer', "the console's section writer (compare-and-set on the stored sections)"],
  'app/api/platform-admin/bulk-operations/route.ts': ['writer', 'bulk plan, status and section changes (stored)'],
  'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts': ['writer', 'console cancel'],
  'app/api/platform-admin/orgs/[id]/delete/route.ts': ['writer', 'console delete'],
  'app/api/platform-admin/orgs/[id]/plan/route.ts': ['writer', 'console plan change'],
  'app/api/platform-admin/orgs/[id]/record/route.ts': ['writer', 'console record edits (stored vs proposed)'],
  'lib/free-time-writes.ts': ['writer', 'gives, changes and ends free time; reads the stored plan, status and Stripe subscription to refuse'],
  'lib/free-time-list.ts': ['other', "'subscription_status' here is a grant KIND (org_overrides.type), not the org's column"],
  'lib/portal-free-time.ts': ['other', "Stage 4b: 'subscription_status' names the grant KIND that holds a free-time portal open (org_overrides.type), not the org's column"],
  'app/platform-admin/orgs/[id]/FreeTimeWindows.tsx': ['other', "'subscription_status' here is a grant KIND (the Give window's choice), not the org's column"],
  'lib/free-time-story.ts': ['stored', "the Story names the plan the club goes back to (its own); 'subscription_status' is a grant kind"],
  'app/api/admin/org/free-time/route.ts': ['through', "the customer's free time: the rows go to the door's rules; the own tournament limit for the over-limit warning"],
  'app/api/platform-admin/product-catalog/change-requests/route.ts': ['writer', 'plan catalogue changes'],
  'lib/platform-events.ts': ['writer', 'event rows carry the plan and status columns'],
  // ── stored on purpose ──
  'lib/platform-metrics.ts': ['stored', 'revenue and customer counts: free time is never revenue (/billing 2026-10-25)'],
  'lib/lead-book.ts': ['stored', 'Stage 7 "pays now" (owner Q2): the club’s OWN plan, status and subscription, with free time read through the door and never counted as paying; and an offered club’s plan name'],
  'lib/lead-timeline.ts': ['stored', 'Stage 7: the plan named on the subscription-start fact a linked club’s billing records hold'],
  'app/platform-admin/early-access/[leadId]/page.tsx': ['stored', 'Stage 7: the linked club’s own plan and trial, in words ("on a League Plus trial until Nov 25"); whether it pays is `readPaying`'],
  'lib/needs-attention.ts': ['stored', '"card payment failed" is about a real card, so it reads the stored status'],
  'lib/email-sender.ts': ['stored', 'the Founding email audience targets purchase intent (stored plan)'],
  'app/api/admin/email/send/route.ts': ['stored', 'the Founding email audience (stored plan)'],
  'lib/platform-story.ts': ['stored', "the club's Story: what was bought and changed"],
  'lib/platform-people-lookup.ts': ['stored', 'the console shows the stored plan'],
  'lib/founding-season-desk.ts': ['stored', 'the Founding desk reads the stored plan'],
  'app/api/platform-admin/find/route.ts': ['stored', 'Find shows the stored plan'],
  'app/platform-admin/orgs/page.tsx': ['stored', 'the clubs list shows the stored plan'],
  'app/platform-admin/orgs/OrgsClient.tsx': ['stored', 'the clubs list shows the stored plan'],
  'app/platform-admin/orgs/[id]/page.tsx': ['stored', 'the record shows the stored plan beside free time'],
  'app/platform-admin/customer-users/people-rows.ts': ['stored', 'the console shows the stored plan'],
  'app/platform-admin/customer-users/[id]/page.tsx': ['stored', 'the console shows the stored plan'],
  'app/platform-admin/plans-pricing/page.tsx': ['stored', 'console counts per plan'],
  'app/platform-admin/plans-pricing/PlansPricingClient.tsx': ['stored', 'console plan catalogue'],
  'app/platform-admin/bulk-operations/page.tsx': ['stored', 'bulk changes act on the stored plan'],
  'app/platform-admin/change-requests/ChangeRequestsClient.tsx': ['stored', 'plan catalogue changes'],
  'app/platform-admin/dev-tools/page.tsx': ['stored', 'console dev tools'],
  'app/platform-admin/dev-tools/AgentPlaybook.tsx': ['stored', 'console dev tools'],
  'app/api/platform-admin/product-catalog/change-requests/validate-price/route.ts': ['stored', 'plan catalogue changes'],
  // ── Coaches Portal (team_workspaces) ──
  'lib/basic-coach-teams.ts': ['portal', 'team_workspaces status'],
  'lib/coach-team-page.ts': ['portal', 'team_workspaces status'],
  'lib/registrable-teams-server.ts': ['portal', 'team_workspaces status'],
  'lib/team-workspace-entitlements.ts': ['portal', 'team_workspaces status'],
  'lib/team-org-billing.ts': ['portal', 'team_workspaces billing'],
  'lib/team-workspace-provisioning.ts': ['portal', 'portal provisioning'],
  'lib/team-checkout.ts': ['portal', 'portal checkout and reactivation'],
  // ── identity ──
  'lib/coach-membership.ts': ['identity', "plan_id 'team' = the portal stub"],
  'lib/org-membership-policy.ts': ['identity', "plan_id 'team' = the portal stub"],
  'lib/team-org-links.ts': ['identity', "plan_id 'team' = the portal stub"],
  'app/coaches/welcome/page.tsx': ['identity', "plan_id 'team' = the portal stub"],
  'app/coaches/tournaments/[teamId]/page.tsx': ['identity', "plan_id 'team' = the portal stub"],
  // ── another table ──
  'lib/plan-config-db.ts': ['other', 'plan_config_overrides.plan_id'],
  'lib/console-money-store.ts': ['other', "stripe_prices.plan_id: the Money tab's price → plan map, never an org's plan (Support console Stage 3)"],
  'lib/plan-module-entitlements.ts': ['other', 'plan_config_overrides.plan_id'],
  'lib/stripe-prices.ts': ['other', 'stripe_prices.plan_id'],
  'lib/stripe-price-validation.ts': ['other', 'stripe_prices.plan_id'],
  'lib/platform-labels.ts': ['other', 'the label for an override type'],
  // ── dev tooling ──
  'app/api/dev/seed/memberships/route.ts': ['dev', 'seed'],
  'app/api/dev/seed/org/route.ts': ['dev', 'seed'],
  'app/api/dev/seed/status/route.ts': ['dev', 'seed'],
  'app/api/dev/seed/users/route.ts': ['dev', 'seed'],
  'app/api/dev/team-checkout-readiness/route.ts': ['dev', 'dev check'],
  'app/api/dev/users/route.ts': ['dev', 'dev tool'],
};

const ROOT = process.cwd();
const COLUMNS = /\b(plan_id|tournament_limit|team_limit|subscription_status|enabled_addons)\b/;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const SOURCES = [...walk('app'), ...walk('lib'), ...walk('components'), 'proxy.ts'];

describe('one door for the plan right now', () => {
  it('finds the source at all (guards against a vacuous pass)', () => {
    assert.ok(SOURCES.length > 500, `only ${SOURCES.length} source files found`);
  });

  it('no file reads the stored plan, limits, status or sections around the door unless it is on the list', () => {
    const readers = SOURCES.filter(f => COLUMNS.test(stripComments(read(f))));
    const unlisted = readers.filter(f => !(f in ALLOWED));
    assert.deepEqual(unlisted, [], `New raw reads of an org's plan/limits/status/sections. Route them through the door
(lib/entitlement-grants.ts: effectiveOrgFacts / effectiveOrgFactsForId / effectiveStatuses), or add the file to ALLOWED
with its class and a reason:\n  ${unlisted.join('\n  ')}`);
    const stale = Object.keys(ALLOWED).filter(f => !readers.includes(f));
    assert.deepEqual(stale, [], `These ALLOWED entries no longer name the columns; remove them:\n  ${stale.join('\n  ')}`);
  });

  it('the three org builders hand the door the stored limits', () => {
    for (const f of ['lib/api-auth.ts', 'lib/db.ts', 'lib/server-organizations.ts']) {
      assert.ok(/applyEntitlementGrants\([\s\S]{0,80}?\{\s*tournamentLimit:/.test(read(f)), `${f} must pass the stored limits`);
    }
  });

  it('every billing action reads the plan the club holds, never the door\'s planId', () => {
    const ACTIONS = [
      'lib/plan-move.ts',
      'lib/plan-move-route.ts',
      'lib/billing-retention.ts',
      'app/api/billing/move/route.ts',
      'app/api/billing/create-checkout/route.ts',
      'app/api/billing/downgrade/preflight/route.ts',
      'app/api/billing/downgrade/confirm/route.ts',
      'app/api/billing/cancel/preflight/route.ts',
      'app/api/billing/cancel/confirm/route.ts',
      'app/api/billing/choose-next-season/route.ts',
      'app/api/billing/mock-apply/route.ts',
      'app/api/admin/org/founding-season-status/route.ts',
      'app/api/admin/org/request-deletion/route.ts',
    ];
    const offenders = ACTIONS.filter(f => /\b(?:auth|ctx)\.org\.planId\b|(?<![.\w])org\.planId\b/.test(stripComments(read(f))));
    assert.deepEqual(offenders, [], `Billing actions must read ownPlanOf(org), not org.planId:\n  ${offenders.join('\n  ')}`);
  });

  it('proxy.ts reads no plan', () => {
    assert.ok(!/plan_id|isTournamentTier/.test(stripComments(read('proxy.ts'))), 'proxy.ts must not read a plan');
  });
});
