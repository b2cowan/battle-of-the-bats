/**
 * Free time where it is read (Support console Stage 4): the gate in front of the club pages, Today's queue, and the
 * customer's billing route. Guards 3, 8 and 9 of the build prompt.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { endInstantForLastDay, foldGrants, type OwnFacts } from '../../lib/free-time';
import { isTournamentTier } from '../../lib/billing-urls';
import { freeTimeCopy } from '../../lib/free-time-copy';

const read = (f: string) => readFileSync(f, 'utf8');

describe('the gate in front of the club pages reads the door (guard 3)', () => {
  const own: OwnFacts = { planId: 'tournament', subscriptionStatus: 'active', enabledAddons: [], storedTournamentLimit: 1, storedTeamLimit: null };
  const end = endInstantForLastDay('2027-03-31')!;
  const grant = [{ type: 'plan_tier', value: null, target: { plan: 'club' }, starts_at: '2026-10-01T00:00:00.000Z', expires_at: end, revoked_at: null }];

  it('admits a Tournament club with a running Club grant, and bounces it after the end', () => {
    assert.equal(isTournamentTier(foldGrants(own, grant, new Date('2027-03-31T20:00:00.000Z')).planId), false, 'admitted on its last free day');
    assert.equal(isTournamentTier(foldGrants(own, grant, new Date(end)).planId), true, 'bounced from the first moment after it');
  });

  it('the org-admin layout decides from the door\'s plan; proxy.ts no longer decides at all', () => {
    assert.match(read('app/[orgSlug]/admin/org/layout.tsx'), /if \(isTournamentTier\(authCtx\.org\.planId\)\)/);
    assert.match(read('lib/api-auth.ts'), /const effectiveOrg = await applyEntitlementGrants\(org,/);
  });
});

describe('Today\'s "Free time ending" counts the clubs the list shows (guard 8)', () => {
  const waiting = read('lib/platform-waiting.ts');
  const list = read('lib/free-time-list.ts');
  const client = read('app/platform-admin/free-time/FreeTimeClient.tsx');

  it('Today counts from the list itself, one per club, 14 days', () => {
    assert.match(waiting, /getStaffFreeTime\(\)\.then\(freeTimeEndingCount\)/);
    assert.match(waiting, /href: '\/platform-admin\/free-time\?view=staff&ending=14'/);
    assert.match(list, /return clubs\.filter\(c => c\.endingSoon\)\.length;/);
    assert.match(list, /endingSoon: isEndingSoon\(lastDay, now\)/);
    assert.ok(!/overrides_ending/.test(waiting), '"Overrides ending" is gone');
  });

  it('the list\'s 14-day filter is the same test', () => {
    assert.match(client, /endingOnly \? staff\.filter\(c => c\.endingSoon\) : staff/);
  });
});

describe('the customer is told the plan and the day, never the reason or the giver (guard 9, T15)', () => {
  it('the billing route answers with three fields', () => {
    const route = read('app/api/admin/org/free-time/route.ts');
    assert.match(route, /return NextResponse\.json\(\{ freeTime, overLimitAfter, foundingThrough \}\);/);
    assert.ok(!/reason|created_by|revoked_by/.test(route.replace(/\/\*[\s\S]*?\*\//g, '')), 'no reason or giver is read for the customer');
  });

  it('the words: free through the last free day, three states, no price', () => {
    const running = freeTimeCopy({ freeTime: { state: 'running', plan: 'tournament_plus', ownPlan: 'tournament', lastDay: '2027-03-31', daysLeft: 157 }, foundingThrough: null, givenOnSale: true, overLimitAfter: false });
    assert.deepEqual(running.card, { price: 'Free through March 31, 2027', from: 'from FieldLogicHQ · then the free Tournament plan, automatically' });
    assert.equal(running.band.title, 'Tournament Plus is free through March 31, 2027.');
    assert.equal(running.band.text, 'FieldLogicHQ gave your organization Tournament Plus for a while. On April 1 it goes back to the free Tournament plan automatically. Nothing is charged, and nothing you made is deleted.');
    assert.equal(running.billingCard, 'No billing action needed: your free time runs through March 31, 2027.');

    const ending = freeTimeCopy({ freeTime: { state: 'ending', plan: 'tournament_plus', ownPlan: 'tournament', lastDay: '2027-03-31', daysLeft: 9 }, foundingThrough: null, givenOnSale: true, overLimitAfter: true });
    assert.equal(ending.band.tone, 'amber');
    assert.equal(ending.band.eyebrow, 'Free time · 9 days left');
    assert.match(ending.band.text, /To keep Tournament Plus, choose it below\. Your tournaments are kept; you can start a new one once you're back within the free plan\.$/);

    const club = freeTimeCopy({ freeTime: { state: 'ending', plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31', daysLeft: 0 }, foundingThrough: 'September 30, 2027', givenOnSale: false, overLimitAfter: false });
    assert.equal(club.band.eyebrow, 'Free time · last day');
    assert.equal(club.band.text, "On April 1 you go back to Tournament Plus automatically, still free through September 30, 2027 as a founding organization. Club isn't open for sign-up yet, so there is nothing to choose on this page.");

    const ended = freeTimeCopy({ freeTime: { state: 'ended', plan: 'club', ownPlan: 'tournament_plus', lastDay: '2027-03-31' }, foundingThrough: 'September 30, 2027', givenOnSale: false, overLimitAfter: false });
    assert.equal(ended.card, null);
    assert.equal(ended.band.tone, 'plain');
    assert.equal(ended.band.title, 'Your free time on Club ran through March 31, 2027.');
    for (const c of [running, ending, club, ended]) {
      assert.ok(!/\$|CAD|\d+ teams|tournaments at a time/.test(JSON.stringify(c)), 'no price or limit is restated');
    }
  });
});
