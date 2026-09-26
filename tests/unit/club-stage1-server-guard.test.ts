import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { moveDirection, hasLiveSubscription } from '../../lib/plan-move.ts';
import { foundingCompAppliesToPlan } from '../../lib/founding-season.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import type { OrgPlan } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 1 (session 1) — THE SERVER RULES THE CLUB SCREENS WILL STAND ON
 *
 * Each block pins one owner ruling or finding against the code that carries it, so a later edit
 * that quietly reverses it fails here with the reason. Twins: role-defaults-guard.test.ts (D8) and
 * member-access.test.ts (the one "what they can open" computation). The Stripe half of the move is
 * verified against the sandbox by API (.probe/club-s1-stripe-verify.mjs, recorded in the plan).
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const PLANS = Object.keys(PLAN_CONFIG) as OrgPlan[];

describe('A03 — the membership rule is Verified Network (owner choice 2026-09-25)', () => {
  const policy = read('lib/org-membership-policy.ts');

  it('only ACTIVE rows elsewhere count; coach rows and a standalone portal never do', () => {
    const fn = policy.slice(policy.indexOf('export async function checkCrossOrgJoin'));
    assert.match(fn, /\.eq\('status', 'active'\)/, 'pending and suspended rows must not count');
    assert.match(fn, /row\.role !== 'coach'/, 'a coaching-staff row elsewhere must never block a board seat');
    assert.match(fn, /isTeamWorkspaceRelation/, 'a coach\'s own Coaches Portal must never count');
  });

  it('only a scorekeeper keeps one home organization — a board seat elsewhere never blocks', () => {
    const fn = policy.slice(policy.indexOf('export async function checkCrossOrgJoin'), policy.indexOf('export function crossOrgJoinRefusalForAdmin'));
    assert.match(fn, /role === 'official'/);
    assert.match(fn, /joiningRole === 'official'/);
    // No other refusal: every return that blocks is one of the two scorekeeper reasons.
    const blocked = fn.match(/blocked: true/g) ?? [];
    assert.equal(blocked.length, 2, 'a third refusal reason was added — Verified Network allows every other membership');
  });

  it('invite, both accept doors and reinstate ask checkCrossOrgJoin — none keeps the old one-org block', () => {
    for (const route of [
      'app/api/admin/members/invite/route.ts',
      'app/api/auth/accept-invite/route.ts',
      'app/api/auth/invitations/[memberId]/route.ts',
      'app/api/admin/members/[memberId]/route.ts',
    ]) {
      const src = read(route);
      assert.match(src, /checkCrossOrgJoin\(/, `${route} must ask the membership rule`);
      assert.doesNotMatch(src, /userBelongsToOtherRealOrg/, `${route} went back to the one-org block (A03)`);
    }
  });

  it('a coach from another club can be made head coach here (the promotion path lands somewhere real)', () => {
    const src = read('app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/route.ts');
    assert.doesNotMatch(src, /userBelongsToOtherRealOrg/);
    assert.doesNotMatch(src, /guest from another organization/);
  });
});

describe('Members — the board endpoints (A02, A13, S1-03, J10-006, J10-022)', () => {
  const patch = read('app/api/admin/members/[memberId]/route.ts');

  it('an unknown role is REFUSED, never silently coerced to staff', () => {
    assert.match(patch, /isAssignableRole\(/);
    assert.match(patch, /code: 'role_not_assignable'/);
    assert.doesNotMatch(patch, /: 'staff';\s*$/m, 'the old "else staff" coercion is back');
  });

  it('a role change respects the seat limit', () => {
    assert.match(patch, /countsAsSeat\(body\.role, planCfg\)/);
    assert.match(patch, /code: 'seat_limit_reached'/);
  });

  it('owner-only powers cannot be granted', () => {
    assert.match(patch, /isOwnerOnlyCapability\(key\) && val === true/);
    assert.match(patch, /code: 'owner_only_power'/);
  });

  it('coaching-staff rows are refused by PATCH, DELETE and resend', () => {
    assert.equal((patch.match(/if \(target\.role === 'coach'\) return coachingStaffRowRefusal\(\);/g) ?? []).length, 2);
    assert.match(read('app/api/admin/members/[memberId]/reinvite/route.ts'), /if \(member\.role === 'coach'\) return coachingStaffRowRefusal\(\);/);
  });

  it('a member whose access changed is emailed what changed (J10-020)', () => {
    assert.match(patch, /describeAccessChange\(before, after, org\)/);
    assert.match(patch, /memberAccessChangedHtml\(/);
  });

  it('an unaccepted invite holds no role: every role-aware gate requires status = active (J10-006)', () => {
    const auth = read('lib/api-auth.ts');
    // One read behind all three gates, and it filters to accepted rows.
    const helper = auth.slice(auth.indexOf('async function getAcceptedMember'));
    assert.match(helper.slice(0, 400), /\.eq\('status', 'active'\)/);
    for (const gate of ['getAuthContextWithRole', 'getAuthContextWithScope', 'requireCapability']) {
      const body = auth.slice(auth.indexOf(`export async function ${gate}`));
      assert.match(body.slice(0, 400), /await getAcceptedMember\(ctx\.org\.id, ctx\.user\.id\)/, gate);
    }
    // No gate reads organization_members for a role on its own (the route to forgetting the filter).
    assert.equal((auth.match(/\.select\('id, role, capabilities/g) ?? []).length, 1);
  });

  it('one role vocabulary for every invite mail — the resend no longer says "team treasurer" (J10-005)', () => {
    const links = read('lib/invite-links.ts');
    assert.match(links, /roleEmailLabel\(role\)/);
    assert.doesNotMatch(links, /`team \$\{role\}`/);
  });
});

describe('B05 — the coaches portal checks the club\'s plan', () => {
  it('orgPlanCarriesCoachesPortal is the plan question, true only where Rep Teams is carried', async () => {
    const { orgPlanCarriesCoachesPortal } = await import('../../lib/coach-portal-plan.ts');
    const org = (planId: OrgPlan, extra = {}) => ({ planId, subscriptionStatus: 'active' as const, enabledAddons: [] as string[], freeFloor: null, accountKind: 'organization' as const, ...extra });
    for (const plan of PLANS) {
      const carries = PLAN_CONFIG[plan].moduleEntitlements.includes('module_rep_teams') || plan === 'team';
      assert.equal(orgPlanCarriesCoachesPortal(org(plan)), carries, plan);
    }
    assert.equal(orgPlanCarriesCoachesPortal(org('tournament_plus', { enabledAddons: ['module_rep_teams'] })), true, 'a Rep Teams add-on carries it');
    assert.equal(orgPlanCarriesCoachesPortal(org('club', { subscriptionStatus: 'canceled' })), true,
      'a cancelled club is walled by the billing rail, never by the plan wall (wrong remedy)');
    assert.equal(orgPlanCarriesCoachesPortal(org('tournament', { accountKind: 'team_workspace' })), true, 'a standalone workspace has its own entitlement model');
  });

  it('the portal layout walls a plan without the portal — after the billing wall, before any portal screen', () => {
    const layout = read('app/[orgSlug]/coaches/layout.tsx');
    const billing = layout.indexOf('isOrgBillingSuspended(authCtx.org)');
    const plan = layout.indexOf('if (!orgPlanCarriesCoachesPortal(authCtx.org))');
    const notAssigned = layout.indexOf('if (assignments.length === 0 && closedAssignments.length === 0)');
    const shell = layout.indexOf('<CoachesChrome');
    assert.ok(plan > 0, 'the coaches layout no longer asks the plan (B05)');
    assert.ok(billing < plan, 'a cancelled club must meet the billing wall first (the right remedy)');
    assert.ok(plan < notAssigned && plan < shell, 'the plan wall must come before any portal screen mounts');
    assert.match(layout, /<CoachPlanWall/);
  });
});

describe('D6 / A08 — no Founding Season offer for Club', () => {
  it('the comp applies to every plan except the two Club bands', () => {
    for (const plan of PLANS) assert.equal(foundingCompAppliesToPlan(plan), plan !== 'club' && plan !== 'club_large', plan);
  });

  it('the status endpoint, the next-season choice and the operator\'s move all apply it', () => {
    assert.match(read('app/api/admin/org/founding-season-status/route.ts'), /foundingCompAppliesToPlan\(ctx\.org\.planId\)/);
    assert.match(read('app/api/billing/choose-next-season/route.ts'), /foundingCompAppliesToPlan\(auth\.org\.planId\)/);
    // The operator's move runs the SAME database half of a plan change as a Stripe move and the
    // webhook — never its own copy (it had one, and it drifted from the shared rule).
    const operatorRoute = read('app/api/platform-admin/orgs/[id]/plan/route.ts');
    assert.match(operatorRoute, /applyPlanChangeSideEffects\(\{[\s\S]*?keepTeamLimit: teamLimitProvided/);
    assert.doesNotMatch(operatorRoute, /revokeFoundingSeasonComp|update\(\{ team_limit: null/);
    assert.match(read('lib/plan-move.ts'), /revokeFoundingSeasonComp\(p\.orgId, p\.actor\)/);
  });
});

describe('1b — the move between plans (Ask 4, D7) and the second-subscription guard (A06)', () => {
  it('moves: up from Tournament Plus and Club, down only Association → Club; nothing else is a move', () => {
    const moves: [OrgPlan, OrgPlan, string | null][] = [
      ['tournament_plus', 'club', 'up'], ['tournament_plus', 'club_large', 'up'],
      ['club', 'club_large', 'up'], ['club_large', 'club', 'down'],
      ['club', 'tournament_plus', null], ['club', 'league', null], ['tournament', 'club', null],
      ['league', 'club', null], ['club', 'club', null],
    ];
    for (const [from, to, want] of moves) assert.equal(moveDirection(from, to), want, `${from} → ${to}`);
  });

  it('a live subscription is active, trialing or past due, with a subscription id', () => {
    const o = (status: string | null, sub: string | null = 'sub_x') => ({ id: 'o', planId: 'club' as OrgPlan, stripeSubscriptionId: sub, subscriptionStatus: status });
    assert.equal(hasLiveSubscription(o('active')), true);
    assert.equal(hasLiveSubscription(o('trialing')), true);
    assert.equal(hasLiveSubscription(o('past_due')), true);
    assert.equal(hasLiveSubscription(o('canceled')), false);
    assert.equal(hasLiveSubscription(o('active', null)), false);
    // A dev mock subscription is not a Stripe one — nothing to move, and the mock checkout still runs.
    assert.equal(hasLiveSubscription(o('active', 'mock_sub_club_annual_1')), false);
  });

  it('checkout refuses a paying org with a structured "move instead" answer', () => {
    const src = read('app/api/billing/create-checkout/route.ts');
    assert.match(src, /hasLiveSubscription\(/);
    assert.match(src, /code: 'subscription_exists'/);
    // The refusal sits BEFORE either checkout path can run.
    assert.ok(src.indexOf("code: 'subscription_exists'") < src.indexOf('stripe.checkout.sessions.create'));
    assert.ok(src.indexOf("code: 'subscription_exists'") < src.indexOf('if (shouldApplyDirectly)'));
  });

  it('no second trial: checkout omits the trial for a customer who has had a subscription', () => {
    const src = read('app/api/billing/create-checkout/route.ts');
    assert.match(src, /mergedConfig\.trialDays > 0 && !\(await hadSubscriptionBefore\(customerId\)\)/);
    assert.match(src, /\.\.\.\(trialDays > 0 \? \{ trial_period_days: trialDays \} : \{\}\)/);
  });

  it('an UP move charges with Stripe\'s preview date; a DOWN move waits for renewal with no credit', () => {
    const src = read('lib/plan-move.ts');
    assert.match(src, /proration_behavior: 'always_invoice',\s*proration_date: prorationDate/);
    assert.match(src, /proration_behavior: 'none'/);
    assert.match(src, /code: 'band_too_small'/);
    assert.doesNotMatch(src, /trial_period_days|trial_end:/, 'a move never starts a trial');
  });

  it('the move routes use the ONE gating source (A10)', () => {
    assert.match(read('lib/plan-move-route.ts'), /getPlanGatingMap\(\)/);
  });

  it('the team-cap refusal offers the move up, structured', () => {
    for (const route of ['app/api/admin/rep-teams/teams/route.ts', 'app/api/admin/rep-teams/teams/[teamId]/route.ts']) {
      assert.match(read(route), /teamLimitRefusal\(ctx!\.org\.planId, cap, currentCount\)/, route);
    }
  });
});

describe('Webhook + reactivation (A07, the band change)', () => {
  const webhook = read('app/api/billing/webhook/route.ts');

  it('a plan change the webhook sees clears a stale team limit and revokes the Founding comp', () => {
    assert.match(webhook, /applyPlanChangeSideEffects\(\{/);
  });

  it('coming back from a cancellation restores what it took — webhook, mock checkout and operator', () => {
    assert.match(webhook, /restoreAfterReactivation\(updatedOrg\.id, cfg\.tournamentLimit\)/);
    assert.match(read('app/api/billing/create-checkout/route.ts'), /restoreAfterReactivation\(auth\.org\.id, plan\.tournamentLimit\)/);
    assert.match(read('app/api/platform-admin/orgs/[id]/plan/route.ts'), /restoreAfterReactivation\(id, effectiveTournamentLimit\)/);
  });

  it('reactivation closes the cancellation intent, so a later Stripe-side end is not mistaken for handled', () => {
    const src = read('lib/billing-reactivation.ts');
    assert.match(src, /\.update\(\{ status: 'restored' \}\)/);
    assert.match(src, /\.eq\('intent_type', 'cancellation'\)/);
    assert.match(src, /billing_suspended_at: null, billing_suspension_reason: null, is_public: true/);
  });
});

describe('/review 2026-09-26 — what the adversarial review found, pinned', () => {
  it('only an owner changes or removes an owner, and no one below owner changes their own role', () => {
    const src = read('app/api/admin/members/[memberId]/route.ts');
    // DELETE and PATCH (role change) both refuse an owner row to a non-owner.
    assert.equal((src.match(/if \(target\.role === 'owner' && ctx\.role !== 'owner'\) return ownerRowRefusal\(\);/g) ?? []).length, 2);
    assert.match(src, /target\.user_id === ctx\.user\.id && ctx\.role !== 'owner'[\s\S]{0,200}code: 'own_role'/);
  });

  it('the access-change email reads the status AFTER the request (a reinstate + role change together)', () => {
    assert.match(read('app/api/admin/members/[memberId]/route.ts'), /\(update\.status \?\? target\.status\) === 'active'/);
  });

  it('the attention counts ask the plan too, not the capability alone (D8 gave admins the program capabilities)', () => {
    const src = read('app/api/admin/attention-summary/route.ts');
    for (const cap of ['module_tournaments', 'module_house_league', 'module_rep_teams']) {
      assert.ok(src.includes(`canOpenModule(ctx, ctx.org, '${cap}')`), cap);
    }
    assert.doesNotMatch(src, /hasCapability\(/);
  });

  it('no second trial is ONE fact — checkout and the operator\'s Club trial both read the Stripe history', () => {
    const move = read('lib/plan-move.ts');
    assert.match(move, /export async function hadSubscriptionBefore\(/);
    // A checkout abandoned at the card step never started: it is not a used trial.
    assert.match(move, /NEVER_STARTED = new Set\(\['incomplete', 'incomplete_expired'\]\)/);
    assert.match(read('app/api/billing/create-checkout/route.ts'), /hadSubscriptionBefore\(customerId\)/);
    const operator = read('app/api/platform-admin/orgs/[id]/plan/route.ts');
    assert.match(operator, /hadSubscriptionBefore\(customerId\)/);
    // A failure after the plan is saved is reported to the operator, never swallowed.
    assert.match(operator, /planChangeWarning: planChangeWarnings\.join/);
    assert.match(read('app/platform-admin/orgs/[id]/OrgDetailClient.tsx'), /data\.planChangeWarning/);
  });

  it('a repeated move down keeps the RUNNING phase\'s start (not the down phase already queued after it)', () => {
    assert.match(read('lib/plan-move.ts'), /schedule\.current_phase\?\.start_date/);
  });

  it('a half-finished reactivation restore fails loudly instead of closing the cancellation', () => {
    const src = read('lib/billing-reactivation.ts');
    assert.match(src, /throw closeError;/);
  });

  it('a sign-in that lands after the 5-second wait still opens the invitation', () => {
    assert.match(read('app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx'), /prev === 'waiting' \|\| prev === 'expired' \? 'ready' : prev/);
  });
});
