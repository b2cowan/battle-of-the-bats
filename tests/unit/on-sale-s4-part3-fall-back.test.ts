/**
 * On-sale pages S4 Part 3 — free time catches an ending paid plan (call 40, option A; owner rulings 2026-11-21).
 * Prompt: docs/projects/active/CLUB_ON_SALE_S4_PART3_PROMPT.md. The ending's own rules are tested in plan-ending.test.ts
 * (section 11) with the in-memory world; this file holds the wiring a pure test cannot see: the routes, the page, the
 * staff windows and the webhook.
 *
 *   1 · the cancel windows read the ending's own answer (never a guess of their own)
 *   2 · "Cancel is the one door": no move to a running free plan or below it — on the page and on the server
 *   3 · carried item 1: checkout's at-or-below refusal holds whatever plan the club stores
 *   4 · the comeback trap and the late Stripe message: a fall-back club stays stored active
 *   5 · a Premium coach's Plan & billing unchanged
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode, functionBody } from './_source-code.ts';
import { fallBackShutdownAreas } from '../../lib/billing-cancellation-policy.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { freeTimeCatchesEnd, moveLandsAt } from '../../lib/free-time.ts';

const body = () => readCode('components/billing/BillingBody.tsx');

describe('1 · the cancel windows read the ending’s own answer', () => {
  it('the owner’s preflight asks fallBackFor at the date the window names (or now), the ending’s read and rule', () => {
    const route = readCode('app/api/billing/cancel/preflight/route.ts');
    assert.match(route, /fallBackFor\(endingRead\[0\], ending\.waits \? ending\.endsOn! : new Date\(\)\.toISOString\(\)\)/);
    const server = functionBody(readCode('lib/plan-ending-server.ts'), 'fallBackFor');
    assert.match(server, /endingDeps\.freePlanGrant\(account\)/);
    assert.match(server, /freeTimeCatchesEnd\(grant, endIso\)/);
  });

  it('the staff window reads it at the period end (Cancel) and today (End now), and says to end free time to close a club', () => {
    const route = readCode('app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts');
    assert.match(route, /fallBackFor\(account, pending\?\.effectiveAt \?\? renewsOn\)/);
    assert.match(route, /fallBackFor\(account, now\)/);
    const record = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
    assert.match(record, /To close it, end its free time first\./);
    assert.match(record, /nothing is suspended or archived, and its site stays as it is/);
  });

  it('Reduce or cancel and the window say the fall-back words, never "goes offline" or "suspend", when free time catches it', () => {
    const b = body();
    assert.match(b, /preflight\.fallBack && !premium\s*\? preflight\.ending\?\.endsOn\s*\? W\.fallBack\.waitBody/);
    assert.match(b, /fallBack \? W\.fallBack\.title\(ownProfile\.config\.label\)/);
    assert.match(b, /fallBack \? W\.fallBack\.confirm\(ownProfile\.config\.label\)/);
    assert.match(b, /const fallBack = !premium \? cancel\?\.fallBack \?\? null : null;/);
  });

  it('what stops on a fall-back is only what the paid plan alone carried', () => {
    const stops = fallBackShutdownAreas(PLAN_CONFIG.club, PLAN_CONFIG.tournament_plus);
    assert.ok(stops.length > 0, 'Club carries areas Tournament Plus does not');
    assert.ok(!stops.some(line => /Public tournament pages|Tournament setup/.test(line)), 'the tournaments stay');
    assert.deepEqual(fallBackShutdownAreas(PLAN_CONFIG.club, PLAN_CONFIG.club), []);
  });

  it('the cancel confirm routes return what the ending did (fellBackTo), and the notice says it', () => {
    assert.match(readCode('app/api/billing/cancel/confirm/route.ts'), /fellBackTo: result\.ended\.fellBackTo \?\? null/);
    assert.match(readCode('app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts'), /fellBackTo: outcome\.fellBackTo \?\? null/);
    assert.match(body(), /typeof result\.fellBackTo === 'string' \? W\.fallBack\.done/);
  });
});

describe('2 · Cancel is the one door (owner 2026-11-21)', () => {
  it('the page offers a paying club no move to its running free plan or below it', () => {
    const b = body();
    assert.match(b, /const catchingGrant = !givenPlan && ownProfile\.key !== 'team' && ft\?\.planGrant && freeTimeCatchesEnd\(ft\.planGrant, moveLandsAt\(org\.currentPeriodEnd\)\)/);
    assert.match(b, /change\.mechanism === 'checkout' \|\| PLAN_RANK\[change\.target as OrgPlan\] > PLAN_RANK\[catchingGrant\.plan\]/);
  });

  it('the move, its preview and the move to free refuse it on the server with checkout’s words, before any Stripe work', () => {
    for (const file of ['app/api/billing/move/route.ts', 'app/api/billing/move/preview/route.ts']) {
      const code = readCode(file);
      const refusal = code.indexOf('refuseBelowFreePlan(');
      assert.ok(refusal > 0 && refusal < code.indexOf('paymentFailingRefusal('), `${file}: before the address and the move`);
    }
    const downgrade = readCode('app/api/billing/downgrade/confirm/route.ts');
    assert.ok(downgrade.indexOf('refuseBelowFreePlan(') > 0 && downgrade.indexOf('refuseBelowFreePlan(') < downgrade.indexOf('scheduleDowngrade('));
    const helper = functionBody(readCode('lib/plan-move-route.ts'), 'refuseBelowFreePlan');
    assert.match(helper, /\{ strict: true \}/);
    assert.match(helper, /PLAN_RANK\[toPlan\] > PLAN_RANK\[planGrant\.plan\]/);
    assert.match(helper, /code: 'below_free_plan'/);
    assert.match(helper, /W\.fallBack\.belowFreePlan\(org\.name, planGrant\.plan\)/);
  });
});

describe('2b · the moves are judged at the renewal they land on, never today (/review 2026-11-21)', () => {
  it('free time that ends before the renewal catches nothing, so the move down stays offered and allowed', () => {
    const grant = { plan: 'tournament_plus' as const, lastDay: '2026-12-01' };
    const now = new Date('2026-11-21T15:00:00.000Z');
    const renewal = '2026-12-20T05:00:00.000Z';
    assert.equal(moveLandsAt(renewal, now), renewal);
    assert.equal(freeTimeCatchesEnd(grant, moveLandsAt(renewal, now)), false, 'the move lands after the last free day');
    assert.equal(freeTimeCatchesEnd(grant, moveLandsAt(null, now)), true, 'no paid period: it lands now, inside free time');
    assert.equal(moveLandsAt('2026-11-01T00:00:00.000Z', now), now.toISOString(), 'a stored date already past reads as now');
  });

  it('the page, the move, its preview and the move to free all pass the renewal date', () => {
    assert.match(body(), /freeTimeCatchesEnd\(ft\.planGrant, moveLandsAt\(org\.currentPeriodEnd\)\)/);
    assert.match(functionBody(readCode('lib/plan-move-route.ts'), 'refuseBelowFreePlan'), /freeTimeCatchesEnd\(planGrant, at\)/);
    for (const file of ['app/api/billing/move/route.ts', 'app/api/billing/move/preview/route.ts']) {
      assert.match(readCode(file), /currentPeriodEnd: authorized\.org\.currentPeriodEnd \}, toPlan\)/, file);
    }
    assert.match(readCode('app/api/billing/downgrade/confirm/route.ts'), /currentPeriodEnd: ctx\.org\.currentPeriodEnd \?\? null \}, targetPlan\)/);
  });

  it('an ENDED club buying its way back is never refused as "already has it as free time"', () => {
    assert.match(readCode('app/api/billing/create-checkout/route.ts'), /const givenPlan = auth\.org\.subscriptionStatus === 'canceled' \? null : givenPlanOf\(auth\.org\);/);
  });

  it('Finish this ending now says the club went back to free time, and the history titles it so', () => {
    assert.match(readCode('app/api/platform-admin/orgs/[id]/finish-ending/route.ts'), /result\.fellBackTo \? W\.cancel\.finish\.fellBack\(/);
    assert.match(readCode('lib/platform-story.ts'), /fellBackToFreeTime === 'string' \? `\$\{planName\(e\.previous_plan_id\)\} ended: back on free/);
  });
});

describe('3 · carried item 1: checkout’s refusal holds whatever plan the club stores', () => {
  it('a start at or below a running free plan is refused for any own plan, not only free Tournament', () => {
    const code = readCode('app/api/billing/create-checkout/route.ts');
    assert.match(code, /: givenPlanOf\(auth\.org\);/);
    assert.doesNotMatch(code, /ownPlan === 'tournament' \? givenPlanOf/);
    assert.match(code, /error: W\.fallBack\.belowFreePlan\(auth\.org\.name, givenPlan\)/);
  });

  it('the fall-back stores the free own plan, so the refusal reads the grant as the given plan afterwards', () => {
    assert.match(functionBody(readCode('lib/plan-ending.ts'), 'applyFallBack'), /deps\.setPlan\(account\.orgId, FREE_OWN_PLAN\)/);
  });
});

describe('4 · the comeback trap and the late Stripe message', () => {
  it('a fall-back stores the club ACTIVE, so its next purchase is never read as a comeback', () => {
    // setPlan is the move to the free plan's own write: plan, its limit, and status active (never "canceled").
    assert.match(readCode('lib/plan-ending-server.ts'), /async setPlan\(orgId, plan\) \{[\s\S]*?\.update\(\{ plan_id: plan, tournament_limit: PLAN_CONFIG\[plan\]\.tournamentLimit, team_limit: null, subscription_status: 'active' \}\)/);
    // The comeback (restore, `subscription_recovered`, "Welcome back") is keyed on a stored "canceled" status.
    assert.match(readCode('lib/billing-webhook-handler.ts'), /const reactivation = currentOrg\?\.subscription_status === 'canceled'/);
  });

  it('an updated message about a CANCELLED subscription (or an ended one not on file) never takes the record over', () => {
    const code = readCode('lib/billing-webhook-handler.ts');
    const guard = code.indexOf("if (sub.status === 'canceled' || (isEndedSubscriptionStatus(sub.status) && onFileId !== sub.id)) {");
    assert.ok(guard > 0, 'the guard exists');
    assert.ok(guard < code.indexOf(".from('organizations')\n          .update({\n            plan_id: planKey,"), 'before the record is written');
  });

  it('the free-time reclose does not count a fall-back as "closed again"', () => {
    assert.match(readCode('lib/free-time-reclose-server.ts'), /applied: ended\.applied && !ended\.fellBackTo/);
  });
});

describe('5 · a Premium coach’s Plan & billing is unchanged', () => {
  it('the fall-back never reaches a Coaches Portal: not in the ending, the window, the rows or the emails', () => {
    assert.match(functionBody(readCode('lib/plan-ending.ts'), 'applyEnding'), /account\.isCoachesPortal \? null : await deps\.freePlanGrant\(account\)/);
    assert.match(readCode('lib/plan-ending-server.ts'), /async freePlanGrant\(account\) \{\s*if \(account\.isCoachesPortal\) return null;/);
    assert.match(body(), /ownProfile\.key !== 'team'/);
    assert.match(readCode('lib/plan-ending-emails.ts'), /if \(f\.fallBack && !f\.portal\)/);
  });
});
