/**
 * Support console Stage 4b · what the /review of the whole (2026-10-30) found and fixed. Each rule is pinned by its
 * source (the files import server-only code): the next edit that undoes one fails here with the reason.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

describe('the reminder job never mails a coach twice', () => {
  const code = readCode('lib/portal-free-time-reminders.ts');
  it('the stamp is given back only when the email DEFINITELY did not go', () => {
    assert.match(code, /const definitelyUnsent = result\?\.status === 'skipped' \|\| \(result\?\.status === 'provider_error' && result\.refused === true\)/);
    assert.match(code, /if \(!definitelyUnsent\) \{[\s\S]*?continue;/);
  });
  it('a hung mail call cannot stall the loop, and a failed release is logged, not swallowed', () => {
    assert.match(code, /timeoutMs: 15_000/);
    assert.match(code, /if \(releaseError\) console\.error/);
  });
  it('a portal that could not be processed fails the job step, not a green 200', () => {
    assert.match(code, /failed \+= 1/);
    assert.match(readCode('app/api/platform-admin/portal-free-time-daily/route.ts'), /if \(result\.failed > 0\) throw new Error/);
  });
});

describe('Keep Premium', () => {
  const code = readCode('lib/portal-keep-premium.ts');
  it('moves nothing until the first payment is through', () => {
    assert.match(code, /NOT_SETTLED = new Set\(\['incomplete', 'incomplete_expired'\]\)/);
    assert.match(code, /if \(NOT_SETTLED\.has\(params\.subscriptionStatus\)\) return \{ converted: false, reason: 'not_settled'/);
    // The refusal sits BEFORE the billing-mode claim.
    assert.ok(code.indexOf("reason: 'not_settled', workspaceOrgId: portal.orgId };") < code.indexOf(".eq('billing_mode', 'platform_override')"));
  });
  it('the delivery that FINISHES the job writes its record, so a repaired purchase is never unrecorded', () => {
    assert.match(code, /\.eq\('action', 'keep_premium'\)/);
    assert.match(code, /sourceEventId: `keep-premium:\$\{params\.stripeSubscriptionId\}:subscription_started`/);
    assert.doesNotMatch(code, /if \(!fresh\) return \{ converted: false, reason: 'already_converted'[^}]*\};\s*\n\s*await writePlatformAuditLog/);
  });
});

describe('a plan move on a portal staff gave free time is refused', () => {
  it('on the server, for every caller of the plan change', () => {
    const code = readCode('lib/operator-plan-change.ts');
    assert.match(code, /PORTAL_FREE_TIME_PLAN_REFUSAL/);
    assert.match(code, /\.not\('free_time_given_at', 'is', null\)[\s\S]*?\.eq\('billing_mode', 'platform_override'\)/);
    assert.match(code, /if \(givenPortal\) throw new PlanRefusedError\(PORTAL_FREE_TIME_PLAN_REFUSAL\)/);
  });
  it('and the pencil is not offered', () => {
    assert.match(readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx'), /const canMovePlan = can\.billing && !org\.paysThroughStripe && !props\.portalFreeTime\?\.freeTime && !props\.portalReadFailed/);
  });
});

describe('a failed read is said, never read as "not a free-time portal"', () => {
  it('the portal record holds back its status and its cancel and delete doors', () => {
    assert.match(readCode('app/platform-admin/orgs/[id]/page.tsx'), /\.catch\(\(\) => \{ portalReadFailed = true; return null; \}\)/);
    const record = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
    assert.match(record, /\{!props\.portalReadFailed && \(canCancel \|\| can\.delete\) && \(/);
    assert.match(record, /Status unread/);
  });
});

describe('the coach side', () => {
  it('Home does not tell a coach whose staff-given free time ended that a subscription lapsed', () => {
    const code = readCode('lib/user-contexts.ts');
    assert.match(code, /if \(staffGivenOrgIds\.has\(orgId\)\) continue;/);
  });
  it('a coach cannot cancel a portal whose free time already ended', () => {
    const route = readCode('app/api/billing/cancel/confirm/route.ts');
    assert.match(route, /const ended = await endedPortalFreeTime\(ctx\.org\.id\)/);
    assert.match(route, /coachCancelEndedRefusal\(ended\.lastDay\)/);
  });
  it('"free time ended" needs the give\'s own mark, as the running read does', () => {
    const server = readCode('lib/portal-free-time-server.ts');
    const fn = server.slice(server.indexOf('export async function endedPortalFreeTime'), server.indexOf('async function latestFreeTimeGrant'));
    assert.match(fn, /!ws\.free_time_given_at/);
  });
  it('the free-team write guard fails closed on a failed read, and the registration writes use it too', () => {
    assert.match(readCode('lib/coach-team-page.ts'), /if \(error\) throw error;\s*\n\s*if \(!data\) return null;/);
    assert.match(readCode('app/api/coaches/tournaments/[teamId]/route.ts'), /premiumInForceRefusalFor\(guard\.basicCoachTeamId\)/);
    assert.match(readCode('app/api/coaches/tournaments/[teamId]/roster/route.ts'), /premiumInForceRefusalFor\(guard\.basicCoachTeamId\)/);
  });
  it('an entry opens on the portal\'s record only while that portal is in force', () => {
    assert.match(readCode('app/coaches/tournaments/[teamId]/page.tsx'), /portalsInForce\(\[\{ workspaceId: ws\.id/);
  });
});

describe('the give', () => {
  const give = readCode('lib/portal-free-time-give.ts');
  it('a failed rollback is retried and then named; a refused give\'s grant that cannot be removed is named', () => {
    assert.match(readCode('lib/team-workspace-provisioning.ts'), /ROLLBACK FAILED after 3 tries/);
    assert.match(give, /a refused give left its grant behind/);
  });
  it('a later give finishes a portal an earlier give left without its entitlement', () => {
    assert.match(give, /finished_half_made: true/);
  });
});
