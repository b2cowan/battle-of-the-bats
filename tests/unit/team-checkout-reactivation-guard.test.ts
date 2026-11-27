import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideTeamReactivation, TEAM_REACTIVATION_REFUSALS, type TeamReactivationReads } from '../../lib/team-reactivation.ts';
import { readCode } from './_source-code.ts';

/**
 * A Premium checkout never takes payment for a reactivation it will refuse (2026-11-26). The webhook used to be the only
 * place that asked, so a coach could pay and get no portal. One rule, asked by the checkout before Stripe and by the
 * webhook after it.
 */

type Portal = { billing_mode: string | null; subscription_status: string | null };

function reads(over: { org?: Record<string, unknown> | null; role?: string | null; portal?: Portal | null } = {}) {
  const asked: string[] = [];
  const org = over.org === null ? null : { id: 'org-1', account_kind: 'team_workspace', plan_id: 'team', subscription_status: 'canceled', ...over.org };
  const r: TeamReactivationReads<Portal> = {
    async org(slug) { asked.push(`org:${slug}`); return org; },
    async activeRole(orgId, userId) { asked.push(`role:${orgId}:${userId}`); return over.role === undefined ? 'owner' : over.role; },
    async portal(orgId) { asked.push(`portal:${orgId}`); return over.portal === undefined ? { billing_mode: 'team_direct', subscription_status: 'canceled' } : over.portal; },
  };
  return { r, asked };
}

const ask = (over: Parameters<typeof reads>[0] = {}) =>
  decideTeamReactivation({ reactivateOrgSlug: 'falcons', ownerUserId: 'u1' }, reads(over).r);
const codeOf = async (over: Parameters<typeof reads>[0]) => {
  const a = await ask(over);
  return a.kind === 'refused' ? a.code : a.kind;
};

describe('the reactivation rule', () => {
  it('an owner reactivating their own cancelled portal', async () => {
    assert.equal((await ask()).kind, 'reactivate');
  });
  it('either record saying cancelled is enough', async () => {
    assert.equal(await codeOf({ org: { subscription_status: 'active' } }), 'reactivate');
    assert.equal(await codeOf({ portal: { billing_mode: 'team_direct', subscription_status: 'active' } }), 'reactivate');
  });
  it('a first purchase or a free-team upgrade names no portal: nothing is read, nothing refused', async () => {
    const { r, asked } = reads();
    assert.deepEqual(await decideTeamReactivation({ reactivateOrgSlug: null, ownerUserId: 'u1' }, r), { kind: 'not_asked' });
    assert.deepEqual(asked, []);
  });
  it('a named portal that is not cancelled is not a reactivation (unchanged: the caller carries on)', async () => {
    assert.equal(await codeOf({ org: { subscription_status: 'active' }, portal: { billing_mode: 'team_direct', subscription_status: 'active' } }), 'not_asked');
  });
  it('no such organization, or one with no portal', async () => {
    assert.equal(await codeOf({ org: null }), 'reactivation_workspace_not_found');
    assert.equal(await codeOf({ portal: null }), 'reactivation_workspace_not_found');
  });
  it('not a Premium portal (a portal that became a club reads this way)', async () => {
    assert.equal(await codeOf({ org: { account_kind: 'organization', plan_id: 'club' } }), 'invalid_reactivation_workspace');
  });
  it('either mark of a portal is enough', async () => {
    assert.equal(await codeOf({ org: { account_kind: 'team_workspace', plan_id: 'tournament' } }), 'reactivate');
    assert.equal(await codeOf({ org: { account_kind: 'organization', plan_id: 'team' } }), 'reactivate');
  });
  it('not the active owner: another role, or no membership', async () => {
    assert.equal(await codeOf({ role: 'admin' }), 'reactivation_not_owner');
    assert.equal(await codeOf({ role: null }), 'reactivation_not_owner');
  });
  it('someone else\'s portal tells them nothing about how it is billed', async () => {
    const { r, asked } = reads({ role: null });
    await decideTeamReactivation({ reactivateOrgSlug: 'falcons', ownerUserId: 'u1' }, r);
    assert.deepEqual(asked, ['org:falcons', 'role:org-1:u1']);
  });
  it('billed by a club, and set up by us, are told apart', async () => {
    for (const billing_mode of ['org_team_addon', 'club_included', 'club_extra_team']) {
      assert.equal(await codeOf({ portal: { billing_mode, subscription_status: 'canceled' } }), 'org_billed_reactivation_not_supported');
    }
    assert.equal(await codeOf({ portal: { billing_mode: 'platform_override', subscription_status: 'canceled' } }), 'reactivation_not_self_paid');
    assert.equal(await codeOf({ portal: { billing_mode: null, subscription_status: 'canceled' } }), 'reactivation_not_self_paid');
  });
  it('every sentence leaves the money to the caller (the webhook runs after payment)', () => {
    for (const { message } of Object.values(TEAM_REACTIVATION_REFUSALS)) assert.doesNotMatch(message, /charged|paid nothing/i);
  });
});

/* readCode strips comments, so these read the code only. Blank lines and indentation are dropped, so the blocks below are
   pinned line for line: nothing can be slipped inside one, or wrapped around it, without a deliberate edit here. */
const tight = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean).join('\n');

describe('the checkout cannot reach Stripe without asking', () => {
  const source = readCode('app/api/billing/create-team-checkout/route.ts').replace(/\r\n/g, '\n');
  const route = tight(source);
  const BLOCK = tight(`
    if (!keepPortal) {
      const reactivation = await checkTeamReactivation({
        reactivateOrgSlug: checkoutRequest.reactivateOrgSlug,
        ownerUserId: user.id,
      });
      if (reactivation.kind === 'refused') {
        return new Response(JSON.stringify({ error: \`\${reactivation.message} Nothing has been charged.\`, code: reactivation.code }), {
          status: reactivation.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  `);
  const start = route.indexOf(BLOCK);
  const end = start + BLOCK.length;

  it('asks once, of the person signed in and the portal named, and a refusal returns', () => {
    assert.ok(start > 0, 'the check block changed: re-prove that nothing reaches Stripe before the refusal returns');
    assert.equal((route.match(/checkTeamReactivation\(/g) ?? []).length, 1);
  });
  it('stands at the handler\'s own level, so no outer condition can skip it', () => {
    // Two spaces of indentation, straight after the one-portal guard has closed.
    assert.match(source, /\n  \}\n\s*\n  if \(!keepPortal\) \{\n/);
  });
  it('only Keep Premium skips it, and that is the one finder\'s answer', () => {
    assert.equal((route.match(/keepPortal =[^=]/g) ?? []).length, 1);
    assert.match(route, /const keepPortal = await findKeepPremiumPortal\(\{/);
  });
  it('the portal checked is the portal Stripe is told about', () => {
    assert.doesNotMatch(route.slice(end), /checkoutRequest(\.\w+)?\s*=[^=]/);
  });
  it('everything that talks to Stripe or makes a portal comes after the refusal', () => {
    // Imports are blanked, not removed, so every position still compares with the block's.
    const code = route.replace(/^import\b[\s\S]*?from '[^']+';$/gm, m => ' '.repeat(m.length));
    for (const reach of [
      'requireBillingLocation(', 'provisionTeamWorkspaceFromCheckoutMetadata(', 'getStripePriceId(', "lib/stripe')",
      'buyerStripeCustomer(', 'stampStripeCustomerAddress(', 'hadSubscriptionBefore(', 'stripe.',
    ]) {
      const first = code.indexOf(reach);
      assert.ok(first >= 0, `${reach} is no longer in the route: update this list`);
      assert.ok(first >= end, `${reach} must come after the reactivation check`);
    }
  });
  it('Stripe is imported once, inside the handler, after the check', () => {
    assert.equal((route.match(/['"](@\/lib\/stripe|stripe)['"]/g) ?? []).length, 1);
    assert.ok(route.indexOf("await import('@/lib/stripe')") >= end);
  });
});

describe('the webhook asks the same rule', () => {
  const checkout = tight(readCode('lib/team-checkout.ts').replace(/\r\n/g, '\n'));
  const reads = checkout.slice(
    checkout.indexOf('export async function checkTeamReactivation'),
    checkout.indexOf('async function reactivateTeamWorkspaceFromParsedMetadata'),
  );

  it('reactivation throws the rule\'s refusal, and nothing stands between its answer and the first write', () => {
    assert.match(checkout, /const answer = await checkTeamReactivation\(params\.parsed\);\nif \(answer\.kind === 'refused'\) \{\nthrow new TeamWorkspaceProvisioningError\(answer\.code, [^\n]*\$\{answer\.message\}`\);\n\}\nif \(answer\.kind !== 'reactivate'\) return null;\nconst workspace = answer\.portal;\nconst subscriptionStatus /);
    assert.equal((checkout.match(/new TeamWorkspaceProvisioningError\(/g) ?? []).length, 1, 'a new refusal belongs in lib/team-reactivation.ts, or the checkout will not ask it');
  });
  it('the reads ask about the portal named and the person asking, and refuse nothing themselves', () => {
    for (const filter of [".eq('slug', slug)", ".eq('organization_id', orgId)", ".eq('user_id', userId)", ".eq('status', 'active')", ".eq('workspace_org_id', orgId)"]) {
      assert.ok(reads.includes(filter), `the reactivation reads lost ${filter}`);
    }
    assert.equal((reads.match(/throw /g) ?? []).length, (reads.match(/if \(error\) throw error;/g) ?? []).length, 'only a failed read throws');
  });
});
