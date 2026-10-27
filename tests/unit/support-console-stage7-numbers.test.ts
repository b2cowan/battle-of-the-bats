/**
 * Support console Stage 7 Part 2 — THE ONE DEFINITION (guard 3) and the match's account rule (part of guard 4).
 * `lib/lead-numbers.ts` and `paysNow` are pure, so the figures are pinned on a fixture of leads.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { daysToSignUp, isStuck, leadNumbers, needsYou, selfConfirmed, stepCounts, type LeadFacts, type PayRead } from '../../lib/lead-numbers.ts';
import { paysNow } from '../../lib/plan-growth.ts';
import { leadPageLabel } from '../../lib/early-access-admin.ts';
import { readCode } from './_source-code.ts';

const NOW = new Date('2026-10-27T15:00:00Z');
const TODAY = '2026-10-27';

function lead(over: Partial<LeadFacts>): LeadFacts {
  return {
    id: 'l', createdAt: '2026-08-04T21:48:00Z', step: 'new', linkedAt: null, signedUpAt: null, orgId: null, linkMethod: null,
    plans: ['league'], sourcePath: '/start/league', source: null, refTag: null, followUpDueAt: null,
    stepChangedAt: '2026-10-25T00:00:00Z', lastNoteAt: null, lastFollowUpSetAt: null, demo: false, ...over,
  };
}

const LEADS: LeadFacts[] = [
  // Signed up through an offered match; its club was made Oct 26, 83 days after the form, linked the next day.
  lead({ id: 'cedar', step: 'converted', linkedAt: '2026-10-27T13:41:00Z', signedUpAt: '2026-10-26T23:12:00Z', orgId: 'org-cedar', linkMethod: 'offered', source: 'referral_club' }),
  // Signed up by hand to a club since deleted: the link is gone, the dated facts are not.
  lead({ id: 'gone', createdAt: '2026-09-01T00:00:00Z', step: 'converted', linkedAt: '2026-09-20T00:00:00Z', signedUpAt: '2026-09-11T00:00:00Z', orgId: null, linkMethod: 'by_hand', plans: ['club'], sourcePath: '/start/club' }),
  // Linked to a demo club: never a sign-up.
  lead({ id: 'demo', createdAt: '2026-09-05T00:00:00Z', step: 'converted', linkedAt: '2026-09-06T00:00:00Z', signedUpAt: '2026-09-06T00:00:00Z', orgId: 'org-demo', linkMethod: 'by_hand', demo: true }),
  // A paying club (its own subscription).
  lead({ id: 'pays', createdAt: '2026-07-01T00:00:00Z', step: 'converted', linkedAt: '2026-07-10T00:00:00Z', signedUpAt: '2026-07-05T00:00:00Z', orgId: 'org-pays', linkMethod: 'by_hand', plans: ['league', 'club'], source: 'search' }),
  lead({ id: 'open', createdAt: '2026-10-20T00:00:00Z', step: 'contacted', stepChangedAt: '2026-09-01T00:00:00Z' }),
  lead({ id: 'lost', createdAt: '2026-06-01T00:00:00Z', step: 'lost' }),
];
const PAY: PayRead = { kind: 'read', paying: new Set(['org-pays']) };
const ACCOUNTS = { kind: 'read' as const, created: [{ id: 'org-cedar', createdAt: '2026-10-26T23:12:00Z' }, { id: 'org-pays', createdAt: '2026-07-05T00:00:00Z' }, { id: 'org-other', createdAt: '2026-10-01T00:00:00Z' }] };

describe('Stage 7 · the one definition', () => {
  const all = leadNumbers(LEADS, { from: null, to: null }, PAY, ACCOUNTS, new Set(['org-cedar', 'org-pays']));

  it('gives the band: arrived, signed up (demo never, deleted still), pay now, offered', () => {
    assert.equal(all.arrived, 6);
    assert.equal(all.signedUp, 3, 'cedar, gone and pays; never the demo club');
    assert.equal(all.signedUpRate, 50);
    assert.equal(all.payNow, 1);
    assert.equal(all.offered, 1);
  });

  it('counts time to sign up to the club’s creation, not the link', () => {
    assert.equal(daysToSignUp(LEADS[0]), 83);
    assert.deepEqual(all.timeToSignUp, { middle: 10, quickest: 4, slowest: 83 });
    // A club made before the lead's form counts as 0, never negative.
    assert.equal(daysToSignUp(lead({ createdAt: '2026-10-01T00:00:00Z', signedUpAt: '2026-09-01T00:00:00Z' })), 0);
  });

  it('a failed read is "Not read" (null), never 0 or 0%; a rate with nothing behind it is a dash (null)', () => {
    const blind = leadNumbers(LEADS, { from: null, to: null }, { kind: 'not_read' }, { kind: 'not_read' }, new Set());
    assert.equal(blind.payNow, null);
    assert.equal(blind.newAccounts, null);
    assert.ok(blind.bySource.every(r => r.payNow === null));
    const none = leadNumbers([], { from: null, to: null }, PAY, ACCOUNTS, new Set());
    assert.equal(none.signedUpRate, null);
    assert.equal(none.timeToSignUp, null);
  });

  it('new accounts say how many came without a lead', () => {
    assert.deepEqual(all.newAccounts, { total: 3, withoutLead: 1 });
  });

  it('every source is a row, "Not set" first and never hidden; a lead may pick two plans', () => {
    assert.equal(all.bySource[0].label, 'Not set');
    assert.equal(all.bySource.length, 8);
    assert.equal(all.bySource.find(r => r.key === 'pitch_deck')?.leads, 0);
    assert.equal(all.byPlan.find(r => r.key === 'league')?.leads, 5);
    assert.equal(all.byPlan.find(r => r.key === 'club')?.leads, 2);
  });

  it('a period counts leads whose first form falls in it', () => {
    const oct = leadNumbers(LEADS, { from: '2026-10-01', to: '2026-10-31' }, PAY, ACCOUNTS, new Set());
    assert.equal(oct.arrived, 1);
  });

  it('stuck: an open lead with no step change, note or follow-up for 30 days; never Waiting for launch', () => {
    assert.equal(isStuck(LEADS[4], NOW), true);
    assert.equal(isStuck({ ...LEADS[4], lastNoteAt: '2026-10-20T00:00:00Z' }, NOW), false);
    assert.equal(isStuck({ ...LEADS[4], lastFollowUpSetAt: '2026-10-20T00:00:00Z' }, NOW), false);
    assert.equal(isStuck({ ...LEADS[4], step: 'waiting_for_launch' }, NOW), false);
    assert.equal(isStuck(LEADS[5], NOW), false, 'Lost is not open');
    assert.equal(stepCounts(LEADS, NOW).find(s => s.step === 'contacted')?.stuck, 1);
  });

  it('needs you: new, a follow-up come due, stuck, or a sign-up to confirm; never a closed lead', () => {
    assert.equal(needsYou(lead({}), NOW, TODAY, false), true);
    assert.equal(needsYou(lead({ step: 'qualified' }), NOW, TODAY, false), false);
    assert.equal(needsYou(lead({ step: 'qualified', followUpDueAt: TODAY }), NOW, TODAY, false), true);
    assert.equal(needsYou(lead({ step: 'qualified' }), NOW, TODAY, true), true);
    assert.equal(needsYou(lead({ step: 'lost', followUpDueAt: TODAY }), NOW, TODAY, true), false);
  });

  it('names the page a form sat on, dropping its hash', () => {
    assert.equal(leadPageLabel('/start/league#plans'), 'The League Plus page');
    assert.equal(leadPageLabel('/coaches/team/abc'), 'Inside the product (a coach asked)');
    assert.equal(leadPageLabel('/somewhere'), 'Other pages');
  });
});

describe('Stage 7 · pays now (owner Q2)', () => {
  const base = { ownPlanId: 'league', status: 'active', subscriptionId: 'sub_123', onFreeTime: false };
  it('a club on its own subscription, billing active, pays', () => assert.equal(paysNow(base), true));
  it('a trial is not paying', () => assert.equal(paysNow({ ...base, status: 'trialing' }), false));
  it('a Founding Season comp (active, no subscription) is not paying', () => assert.equal(paysNow({ ...base, subscriptionId: null }), false));
  it('free time is not paying', () => assert.equal(paysNow({ ...base, onFreeTime: true }), false));
  it('the Tournament plan, a past-due club and a test subscription are not paying', () => {
    assert.equal(paysNow({ ...base, ownPlanId: 'tournament' }), false);
    assert.equal(paysNow({ ...base, status: 'past_due' }), false);
    assert.equal(paysNow({ ...base, subscriptionId: 'mock_sub' }), false);
  });
});

describe('Stage 7 · the offered match reads an address its owner confirmed (build gate, "best signal, safe side")', () => {
  it('needs our confirmation email, its confirmation and a sign-in since', () => {
    const ok = { confirmation_sent_at: '2026-10-26T23:00:00Z', email_confirmed_at: '2026-10-26T23:05:00Z', last_sign_in_at: '2026-10-26T23:05:01Z' };
    assert.equal(selfConfirmed(ok), true);
    assert.equal(selfConfirmed({ ...ok, confirmation_sent_at: null }), false, 'created confirmed by staff or a script');
    assert.equal(selfConfirmed({ ...ok, last_sign_in_at: null }), false, 'never signed in');
    assert.equal(selfConfirmed({ ...ok, email_confirmed_at: '2026-10-26T22:00:00Z' }), false, 'confirmed before we sent anything');
  });

  it('refuses when a check cannot be read, and leaves out staff, console-confirmed accounts, invites, demo and staff-owned clubs', () => {
    const code = readCode('lib/lead-book.ts');
    for (const refusal of ['touchedError', 'memberError', 'ownerError', 'dismissError']) {
      assert.match(code, new RegExp(`if \\(${refusal}\\) return \\{ kind: 'not_read' \\}`), refusal);
    }
    // The staff list is read once, by `readStaffAddresses`, which throws when it cannot be read; the offer's own catch
    // turns that into not_read (nothing offered), and the hand link / club picker treat it as "cannot tell".
    assert.match(code, /export async function readStaffAddresses[\s\S]*?if \(error\) throw error;/);
    assert.match(code, /const staff = await readStaffAddresses\(\);[\s\S]*?\} catch \{\s*return \{ kind: 'not_read' \};/);
    assert.match(code, /\.in\('action', \['confirm_email', 'update_user'\]\)/);
    assert.match(code, /\.in\('role', \['owner', 'admin'\]\)\.eq\('status', 'active'\)\.not\('accepted_at', 'is', null\)/);
    assert.match(code, /demo\.has\(m\.organization_id\) \|\| staffOwned\.has\(m\.organization_id\)/);
    // organization_members keys the club as organization_id (a wrong name failed every offer, found by the render probe).
    assert.doesNotMatch(code, /from\('organization_members'\)[^;]*\b(?:eq|in)\('org_id'/);
    assert.match(code, /!dismissedKey\.has/);
  });

  it('the public form computes no match', () => {
    const route = readCode('app/api/early-access/route.ts');
    assert.doesNotMatch(route, /readOffers|lead-book|platform_lead_account_dates/);
  });
});

describe('Stage 7 finish pass · a lead belongs to the console’s day, not the UTC day', () => {
  it('a lead that arrived at 9 p.m. Eastern on the last day of a period is in that period and that month', () => {
    // 01:30 UTC on Nov 1 is 9:30 p.m. Eastern on Oct 31.
    const late = lead({ id: 'late', createdAt: '2026-11-01T01:30:00Z' });
    const october = leadNumbers([late], { from: '2026-10-01', to: '2026-10-31' }, PAY, ACCOUNTS, new Set());
    assert.equal(october.arrived, 1, 'counted in October, the day it arrived');
    const november = leadNumbers([late], { from: '2026-11-01', to: '2026-11-30' }, PAY, ACCOUNTS, new Set());
    assert.equal(november.arrived, 0, 'not in November');
    assert.deepEqual(october.byMonth.map(m => m.month), ['2026-10']);
  });
});
