/**
 * Support console Stage 4b · the three owner asks left after the review (2026-10-30). Each rule is pinned by what the
 * code does or its source, because the route and the pages import server-only code.
 *   1. Keep Premium on the Overview goes to the portal's OWNER; every other coach is told to ask them.
 *   2. The free team's "your Premium work is saved" line outlives the 30-day band: it follows the saved work.
 *   3. A second subscription that attaches to nothing is reported to staff, never left billing in silence.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { ASK_OWNER_KEEP_LINE, portalEndingOverviewBand } from '../../lib/portal-free-time.ts';

const ENDING = { state: 'ending', lastDay: '2026-12-26', daysLeft: 5 } as const;

describe('Keep Premium on the Overview goes to the portal owner', () => {
  it("the owner's band is the notice alone; anyone else's also says to ask the owner", () => {
    const owner = portalEndingOverviewBand(ENDING, true);
    const other = portalEndingOverviewBand(ENDING, false);
    assert.ok(owner && other);
    assert.doesNotMatch(owner.text, /ask the portal/i);
    assert.equal(other.text, `${owner.text} ${ASK_OWNER_KEEP_LINE}`);
    assert.equal(ASK_OWNER_KEEP_LINE, "Ask the portal's owner to keep Premium.");
  });
  it('the band is still only for the last 14 days', () => {
    assert.equal(portalEndingOverviewBand({ state: 'running', lastDay: '2026-12-26', daysLeft: 40 }, false), null);
    assert.equal(portalEndingOverviewBand({ state: 'ended', lastDay: '2026-12-26' }, false), null);
  });
  it('the server decides who the owner is, by the same person the checkout looks the portal up by', () => {
    const route = readCode('app/api/admin/org/free-time/route.ts');
    assert.match(route, /\.select\('primary_owner_user_id'\)/);
    assert.match(route, /ws\.primary_owner_user_id === ctx\.user\.id/);
    assert.match(route, /canKeepPremium/);
    assert.match(readCode('lib/portal-keep-premium.ts'), /\.eq\('primary_owner_user_id', input\.ownerUserId\)/);
  });
  it('the band reads the server answer, not "is a head coach"', () => {
    const band = readCode('components/coaches/PortalFreeTimeEndingBand.tsx');
    assert.match(band, /state\?\.canKeepPremium === true/);
    assert.doesNotMatch(band, /canKeep: boolean|isHeadCoach/);
    assert.doesNotMatch(readCode('app/[orgSlug]/coaches/teams/[teamId]/page.tsx'), /PortalFreeTimeEndingBand[^>]*canKeep=/);
  });
});

describe('the saved-work line follows the saved work, not the 30-day band', () => {
  it('the free team looks for its saved portal with no time limit, and the line shows whenever it exists', () => {
    const fn = readCode('lib/portal-free-time-server.ts');
    const body = fn.slice(fn.indexOf('export async function savedFreeTimePortalOfTeam'), fn.indexOf('export async function freeTimePortalOrgIds'));
    assert.match(body, /\.not\('free_time_given_at', 'is', null\)/);
    assert.match(body, /\.eq\('billing_mode', 'platform_override'\)/);
    assert.match(body, /if \(!data\) return null;/);
    assert.doesNotMatch(body, /FREE_TIME_ENDED_SHOWN_DAYS|state ===|\.gt\(|\.gte\(/);
    assert.match(readCode('app/coaches/team/[basicTeamId]/page.tsx'), /note=\{savedPortal \? PREMIUM_WORK_SAVED_LINE : undefined\}/);
  });
});

describe('a second subscription that attaches to nothing is reported to staff', () => {
  const code = readCode('lib/portal-keep-premium.ts');
  const taken = code.slice(code.indexOf('ws?.stripe_subscription_id !== params.stripeSubscriptionId'), code.indexOf('const { error: orgError }'));
  it('it is captured with the portal and the coach, naming the subscription to cancel and refund', () => {
    assert.match(taken, /await captureError\(/);
    assert.match(taken, /Cancel \$\{params\.stripeSubscriptionId\} in Stripe and refund its payment/);
    assert.match(taken, /org: \{ id: portal\.orgId, slug: portal\.orgSlug \}/);
    assert.match(taken, /severity: 'error'/);
  });
  it('the report comes before the result is returned, and nothing else is changed', () => {
    assert.ok(taken.indexOf('captureError') < taken.indexOf("reason: 'taken'"));
    assert.doesNotMatch(taken, /\.update\(|\.insert\(|\.delete\(/);
  });
});
