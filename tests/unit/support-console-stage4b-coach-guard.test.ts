/**
 * Support console Stage 4b, Parts 5–6 · the coach's screens and Keep Premium (drawing D; the gate's copy table,
 * /billing + /marketing 2026-10-27). What the coach is told about free time from staff, in the product only (Q7): the
 * state and the last free day, never why or by whom (T24); the price, the Stripe door, Cancel and the slots card absent
 * while it runs (Q10, Q11-7); Keep Premium the one lime (D-2); and the purchase attached to the SAME portal, before or
 * after the end, so the coach always ends on one portal (Q11-2).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  KEEP_PREMIUM_LINE, PORTAL_FREE_TIME_HOSTING_LINE, PREMIUM_WORK_SAVED_LINE, portalCustomerFreeTime, portalFreeTimeCopy,
} from '../../lib/portal-free-time';
import { freeTimeStoryEntries, type FreeTimeStoryRow } from '../../lib/free-time-story';
import type { AuditRow } from '../../lib/platform-story-view';

const DEC26_END = '2026-12-27T05:00:00.000Z'; // the end of Dec 26, Eastern
const GIVEN = '2026-10-27T18:31:00.000Z';
const grant = (extra: Partial<{ starts_at: string | null; expires_at: string | null; revoked_at: string | null }> = {}) =>
  ({ starts_at: GIVEN, expires_at: DEC26_END, revoked_at: null, ...extra });
const at = (iso: string) => new Date(iso);

describe('Part 5 · the coach\'s state: running, the last 14 days, ended for 30 days', () => {
  it('running more than 14 days out', () => {
    assert.deepEqual(portalCustomerFreeTime(grant(), at('2026-11-02T16:00:00.000Z')), { state: 'running', lastDay: '2026-12-26', daysLeft: 54 });
  });
  it('the last 14 days are "ending", and the last day reads 0', () => {
    assert.equal(portalCustomerFreeTime(grant(), at('2026-12-17T16:00:00.000Z'))?.state, 'ending');
    assert.deepEqual(portalCustomerFreeTime(grant(), at('2026-12-26T20:00:00.000Z')), { state: 'ending', lastDay: '2026-12-26', daysLeft: 0 });
  });
  it('ended by itself: the last free day, for 30 days, then nothing', () => {
    assert.deepEqual(portalCustomerFreeTime(grant(), at('2026-12-27T14:00:00.000Z')), { state: 'ended', lastDay: '2026-12-26' });
    assert.equal(portalCustomerFreeTime(grant(), at('2027-01-25T14:00:00.000Z'))?.state, 'ended');
    assert.equal(portalCustomerFreeTime(grant(), at('2027-01-27T14:00:00.000Z')), null);
  });
  it('ended early: the day it was ended', () => {
    assert.deepEqual(portalCustomerFreeTime(grant({ revoked_at: '2026-11-10T19:00:00.000Z' }), at('2026-11-11T14:00:00.000Z')), { state: 'ended', lastDay: '2026-11-10' });
  });
  it('no grant, or no end, says nothing', () => {
    assert.equal(portalCustomerFreeTime(null), null);
    assert.equal(portalCustomerFreeTime(grant({ expires_at: null })), null);
  });
});

describe('Part 5 · the words (the gate\'s copy table)', () => {
  it('running: the price line, its sub line, the band (phone drops its first sentence) and the Billing card', () => {
    const c = portalFreeTimeCopy({ state: 'running', lastDay: '2026-12-26', daysLeft: 54 });
    assert.deepEqual(c.card, { price: 'Free through December 26, 2026', from: 'from FieldLogicHQ · then the free Coaches Portal, automatically' });
    assert.equal(c.band.tone, 'olive');
    assert.equal(c.band.eyebrow, 'Free time');
    assert.equal(c.band.title, 'Premium Coaches Portal is free through December 26, 2026.');
    assert.equal(c.band.text, 'FieldLogicHQ gave you Premium for a while. On December 27 you go back to the free Coaches Portal automatically. Nothing is charged, and nothing you made is deleted. Everything you made on Premium is saved, and it comes back if you choose Premium again.');
    assert.equal(c.band.phoneText, c.band.text.replace('FieldLogicHQ gave you Premium for a while. ', ''));
    assert.equal(c.billingCard, 'No billing action needed: your free time runs through December 26, 2026.');
  });
  it('the last 14 days: amber, the day count, "ends today" on the last day', () => {
    const nine = portalFreeTimeCopy({ state: 'ending', lastDay: '2026-12-26', daysLeft: 9 });
    assert.equal(nine.band.tone, 'amber');
    assert.equal(nine.band.eyebrow, 'Free time · 9 days left');
    assert.equal(nine.band.title, 'Your free time runs through December 26, 2026.');
    assert.equal(nine.band.text, 'On December 27 you go back to the free Coaches Portal automatically, and everything you made on Premium is saved. To keep Premium, choose it below.');
    assert.equal(nine.billingCard, 'Your free time runs through December 26, 2026. To keep Premium, choose it below. Otherwise there is nothing to do.');
    assert.equal(portalFreeTimeCopy({ state: 'ending', lastDay: '2026-12-26', daysLeft: 1 }).band.eyebrow, 'Free time · 1 day left');
    const last = portalFreeTimeCopy({ state: 'ending', lastDay: '2026-12-26', daysLeft: 0 });
    assert.equal(last.band.eyebrow, 'Free time · last day');
    assert.equal(last.band.title, 'Your free time ends today.');
  });
  it('the day after (the free Overview, and Plan & billing once ended): "ran through", the team as it was', () => {
    const c = portalFreeTimeCopy({ state: 'ended', lastDay: '2026-12-26' });
    assert.equal(c.card, null);
    assert.equal(c.billingCard, null);
    assert.deepEqual(c.band, {
      tone: 'plain', eyebrow: 'Free time ended', title: 'Your Premium free time ran through December 26, 2026.',
      text: "You're back on the free Coaches Portal, with your team as it was when your free time started. Everything you made on Premium is saved, and it comes back if you choose Premium again.",
    });
  });
  it('a year that turns names the year on the day after', () => {
    assert.match(portalFreeTimeCopy({ state: 'running', lastDay: '2026-12-31', daysLeft: 40 }).band.text, /^FieldLogicHQ gave you Premium for a while\. On January 1, 2027 you go back/);
  });
  it('never "ends on", never a price, never what Premium includes', () => {
    const all = [
      ...(['running', 'ending', 'ended'] as const).flatMap(state => {
        const c = portalFreeTimeCopy(state === 'ended' ? { state, lastDay: '2026-12-26' } : { state, lastDay: '2026-12-26', daysLeft: state === 'ending' ? 3 : 40 });
        return [c.card?.price, c.card?.from, c.band.eyebrow, c.band.title, c.band.text, c.band.phoneText, c.billingCard];
      }),
      KEEP_PREMIUM_LINE, PORTAL_FREE_TIME_HOSTING_LINE, PREMIUM_WORK_SAVED_LINE,
    ].filter((s): s is string => !!s);
    for (const s of all) {
      assert.doesNotMatch(s, /ends on/i, s);
      assert.doesNotMatch(s, /\$|\bCAD\b|\/ ?month|lineups|attendance|budget/i, s);
    }
    assert.equal(KEEP_PREMIUM_LINE, 'Next you choose how to pay. Your team and everything you made stay as they are.');
    assert.equal(PORTAL_FREE_TIME_HOSTING_LINE, "Hosting a tournament isn't part of free time.");
    assert.equal(PREMIUM_WORK_SAVED_LINE, 'Everything you made on Premium is saved and comes back with Premium.');
  });
});

describe('Part 5 · the customer route says the state and the day, never the reason, the giver or the grant (T24)', () => {
  it('the portal\'s read selects no reason, giver or id from the grant', () => {
    const code = readCode('lib/portal-free-time-server.ts');
    const body = code.slice(code.indexOf('async function latestFreeTimeGrant'), code.indexOf('export async function customerPortalFreeTime'));
    assert.match(body, /\.select\('starts_at, expires_at, revoked_at'\)/);
    assert.doesNotMatch(body, /reason|created_by|revoked_by|'id/);
  });
  it('only a portal staff gave and nobody pays for (after Keep Premium it is an ordinary portal)', () => {
    const code = readCode('lib/portal-free-time-server.ts');
    assert.match(code, /ws\?\.billing_mode !== 'platform_override' \|\| !ws\.free_time_given_at/);
  });
  it('a team workspace answers with the portal\'s state alone', () => {
    const code = readCode('app/api/admin/org/free-time/route.ts');
    assert.match(code, /accountKind === 'team_workspace'[\s\S]{0,200}customerPortalFreeTime\(ctx\.org\.id\)/);
  });
});

describe('Part 5 · Plan & billing on free time (drawing D)', () => {
  const page = readCode('components/billing/BillingBody.tsx');
  it('the shared body keeps the same owner, hosting, payment and ended-grant boundaries', () => {
    const body = readCode('components/billing/BillingBody.tsx');
    assert.match(body, /if \(userRole !== 'owner'\) return/);
    assert.match(body, /const endedPortal = portal\?\.state === 'ended'/);
    assert.match(body, /&& !portal && !staffFree/);
    assert.match(body, /paid && !staffFree && !endedPortal && !founding/);
    assert.match(body, /profile\.freeTimeOmittedBillingItems\?\.includes\(index\)/);
    assert.match(body, /portal \? 'btn-outline' : 'btn-lime'/);
    assert.match(body, /teamWorkspaceReactivatePath\(org\)\}&keep=1/);
    assert.match(readCode('components/billing/Billing.module.css'), /\.keepPremiumButton \{ width: 100%; \}/);
  });
  it('the price, the Stripe door, Cancel and the tournament slots are not rendered while it runs (Q10, Q11-7)', () => {
    assert.match(page, /controlsReady && paid && !staffFree && !endedPortal && !founding/);
    assert.match(page, /controlsReady && paid && ownBilling && !founding/);
    assert.match(page, /profile\.usageMeters\.filter\(m => !portal \|\| m !== 'tournament_slots'\)/);
    assert.match(page, /const price = freeCard\?\.price/);
  });
  it('Keep Premium is the one lime, 44px; Join a club is outlined on free time (D-2, D-5)', () => {
    assert.match(page, /btn btn-lime \$\{styles\.keepPremiumButton\}/);
    assert.match(page, /btn \$\{portal \? 'btn-outline' : 'btn-lime'\}/);
    assert.match(readCode('components/billing/Billing.module.css'), /\.body :global\(\.btn\)[^}]+min-height: var\(--tap-min, 44px\)/);
  });
  it('after the end the page never says cancelled, retention or Reactivate: the ended band and Keep Premium', () => {
    const ended = page.slice(page.indexOf('if (endedPortal && controlsReady)'), page.indexOf('if (cancelled && controlsReady)'));
    assert.ok(ended.length > 0 && page.indexOf('if (endedPortal && controlsReady)') < page.indexOf('if (cancelled && controlsReady)'));
    assert.doesNotMatch(ended, /retention|Reactivate|has been cancelled|subscriptionStatusLabel/);
    assert.match(ended, /\{keepPremium\}/);
  });
  it('Keep Premium is the owner\'s, and says "Keep Premium" on the start page too', () => {
    assert.ok(page.indexOf('if (!s.canManageBilling) return') < page.indexOf('const keepPremium = portal ?'));
    assert.match(page, /teamWorkspaceReactivatePath\(org\)\}&keep=1/);
    const start = readCode('app/team/TeamSignupClient.tsx');
    assert.match(start, /isKeepPremium\s*\? 'Keep Premium'/);
    assert.match(start, /isKeepPremium\s*\? KEEP_PREMIUM_LINE/);
  });
});

describe('Part 5 · the free Overview the day after (D-3)', () => {
  const page = readCode('app/coaches/team/[basicTeamId]/page.tsx');
  it('the band shows only when the free time reads ended, and the shelf gains its one line while Premium work is saved', () => {
    assert.match(page, /savedPortal\?\.freeTime\?\.state === 'ended' \? portalFreeTimeCopy\(savedPortal\.freeTime\)\.band : null/);
    assert.match(page, /note=\{savedPortal \? PREMIUM_WORK_SAVED_LINE : undefined\}/);
  });
  it('a failed read drops the band, never the page', () => {
    assert.match(page, /savedFreeTimePortalOfTeam\(basicTeamId\)\.catch\(\(\) => null\)/);
  });
});

describe('Part 6 · Keep Premium attaches to the same portal (Q11-2)', () => {
  const checkout = readCode('lib/team-checkout.ts');
  const provision = checkout.slice(checkout.indexOf('export async function provisionTeamWorkspaceFromCheckoutMetadata'));
  it('the webhook reuses the portal BEFORE the one-live-portal guard, the reactivation and the fresh provision', () => {
    const keep = provision.indexOf('findKeepPremiumPortal(');
    assert.ok(keep > 0);
    assert.ok(keep < provision.indexOf('getActiveOwnedTeamWorkspace('), 'before the owner guard');
    assert.ok(keep < provision.indexOf('reactivateTeamWorkspaceFromParsedMetadata('), 'before the reactivation');
    assert.ok(keep < provision.indexOf('provisionStandaloneTeamWorkspace('), 'before a fresh provision');
    assert.match(provision.slice(keep, keep + 400), /stripeSubscriptionId: params\.stripeSubscriptionId/);
  });
  it('the checkout route lets the coach\'s own free-time portal through, refuses any other live one, and skips Founding', () => {
    const route = readCode('app/api/billing/create-team-checkout/route.ts');
    assert.match(route, /existingPortal && existingPortal\.workspaceOrgId !== keepPortal\?\.orgId/);
    assert.match(route, /if \(!keepPortal && \(foundingSeasonOfferFor/);
    assert.ok(route.indexOf('findKeepPremiumPortal(') < route.indexOf('getActiveOwnedTeamWorkspace(user.id)'));
  });
  const keep = readCode('lib/portal-keep-premium.ts');
  it('only a portal named by the checkout, never a tournament claim', () => {
    const find = keep.slice(keep.indexOf('export async function findKeepPremiumPortal'), keep.indexOf('export type KeepPremiumResult'));
    assert.match(find, /if \(input\.claimToken \|\| input\.teamWorkspaceClaimId\) return null;/);
    assert.match(find, /input\.reactivateOrgSlug === org\.slug/);
    assert.match(find, /input\.basicCoachTeamId === ws\.basic_coach_team_id/);
    assert.match(find, /\.eq\('primary_owner_user_id', input\.ownerUserId\)/);
  });
  it('idempotent: the billing mode moves by compare-and-set, and a repeat is taken again only while the end is still on the entitlement', () => {
    const convert = keep.slice(keep.indexOf('export async function convertFreeTimePortal'));
    assert.match(convert, /\.eq\('billing_mode', 'platform_override'\)\s*\.select\('id'\)/);
    assert.match(keep, /\.not\('ends_at', 'is', null\)/);
    // The entitlement's end is cleared LAST, so "an end still on it" means the rest is owed.
    const ent = convert.indexOf(".from('team_entitlements')");
    assert.ok(ent > convert.indexOf(".from('organizations')"));
    assert.ok(ent > convert.indexOf(".from('org_overrides')"));
    assert.match(convert.slice(ent, ent + 300), /source: 'team_plan'[\s\S]*ends_at: null/);
  });
  it('another subscription that converted first attaches nothing and makes no second portal', () => {
    assert.match(readCode('lib/portal-keep-premium.ts'), /reason: 'taken'/);
    assert.match(provision, /: \{ provisioned: false, reason: 'already_exists', workspaceOrgId: kept\.workspaceOrgId \}/);
  });
  it('the running free time ends with its own entry; the Story says the coach chose Premium, with no Put it back', () => {
    assert.match(keep, /'revoke_override', 'id', g\.id, \{\s*portal: true, subscribed: true/);
    const rows: FreeTimeStoryRow[] = [{
      id: 'g1', type: 'subscription_status', value: 'active', target: null, starts_at: GIVEN, expires_at: DEC26_END,
      reason: 'Wants to try Premium', created_by: 'support@fieldlogichq.ca', created_at: GIVEN,
      revoked_at: '2026-12-20T15:00:00.000Z', revoked_by: 'frankie@example.com',
    }];
    const audit: AuditRow[] = [{
      id: 70, actor_email: 'frankie@example.com', action: 'revoke_override', field: 'id', old_value: 'g1',
      new_value: { portal: true, subscribed: true, was_expires_at: DEC26_END }, reason: 'The coach chose Premium.', created_at: '2026-12-20T15:00:00.000Z',
    }];
    const entries = freeTimeStoryEntries({ org: { name: 'UAT Free Team Coaches Portal', plan_id: 'team' }, overrides: rows, audit, putBackAt: new Map(), portal: { summary: null }, now: at('2026-12-21T15:00:00.000Z') });
    const ended = entries.find(e => e.key === 'override-ended:g1')!;
    assert.equal(ended.title, 'Free time ended: the coach chose Premium');
    assert.equal(ended.who, 'frankie@example.com');
    assert.equal(ended.putBack, undefined);
  });
});
