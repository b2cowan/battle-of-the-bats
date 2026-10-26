/**
 * Free time's rules (Support console Stage 4): the fold the door applies, the last free day ↔ end instant in Eastern
 * time, the giver's cap, and what the customer's billing page is told. Pure: `lib/free-time.ts` reads no database.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  customerFreeTime,
  endInstantForLastDay,
  foldGrants,
  grantablePlansAbove,
  lastDayOfInstant,
  lastDayRefusal,
  latestLastDay,
  type GrantRow,
  type OwnFacts,
} from '../../lib/free-time';

const FREE_TOURNAMENT: OwnFacts = {
  planId: 'tournament',
  subscriptionStatus: 'active',
  enabledAddons: [],
  storedTournamentLimit: 1,
  storedTeamLimit: null,
};

const NOW = new Date('2026-10-25T16:00:00.000Z'); // Oct 25, 2026, 12:00 p.m. Eastern

function planGrant(plan: string, expiresAt: string, extra: Partial<GrantRow> = {}): GrantRow {
  return { type: 'plan_tier', value: null, target: { plan }, starts_at: '2026-10-01T00:00:00.000Z', expires_at: expiresAt, revoked_at: null, ...extra };
}

describe('the door: a whole-plan grant', () => {
  const END = endInstantForLastDay('2027-03-31')!;

  it('a running Club grant changes the plan AND the limits', () => {
    const f = foldGrants(FREE_TOURNAMENT, [planGrant('club', END)], NOW);
    assert.equal(f.planId, 'club');
    assert.equal(f.ownPlanId, 'tournament');
    // The stored tournament limit of 1 must not clamp the given plan.
    assert.equal(f.tournamentLimit, 9999);
    assert.equal(f.teamLimit, 15);
    assert.deepEqual(f.freeTime, { plan: 'club', lastDay: '2027-03-31' });
  });

  it('a Tournament Plus grant on a free club lifts the one-tournament limit', () => {
    const f = foldGrants(FREE_TOURNAMENT, [planGrant('tournament_plus', END)], NOW);
    assert.equal(f.planId, 'tournament_plus');
    assert.equal(f.tournamentLimit, 9999);
  });

  it('a grant that ended a millisecond ago gives nothing', () => {
    const justEnded = new Date(new Date(END).getTime() + 1);
    const f = foldGrants(FREE_TOURNAMENT, [planGrant('club', END)], justEnded);
    assert.equal(f.planId, 'tournament');
    assert.equal(f.tournamentLimit, 1);
    assert.equal(f.freeTime, null);
  });

  it('the end is exclusive: at the end instant itself it has ended', () => {
    assert.equal(foldGrants(FREE_TOURNAMENT, [planGrant('club', END)], new Date(END)).planId, 'tournament');
    assert.equal(foldGrants(FREE_TOURNAMENT, [planGrant('club', END)], new Date(new Date(END).getTime() - 1)).planId, 'club');
  });

  it('a grant that has not started gives nothing', () => {
    const f = foldGrants(FREE_TOURNAMENT, [planGrant('club', END, { starts_at: '2026-11-01T00:00:00.000Z' })], NOW);
    assert.equal(f.planId, 'tournament');
  });

  it('a revoked grant gives nothing', () => {
    const f = foldGrants(FREE_TOURNAMENT, [planGrant('club', END, { revoked_at: '2026-10-20T00:00:00.000Z' })], NOW);
    assert.equal(f.planId, 'tournament');
  });

  it('the switch off returns the stored plan', () => {
    const f = foldGrants(FREE_TOURNAMENT, [planGrant('club', END)], NOW, false);
    assert.equal(f.planId, 'tournament');
    assert.equal(f.tournamentLimit, 1);
  });

  it('a grant at or below the club\'s own plan changes nothing (a purchase overtakes it)', () => {
    const own: OwnFacts = { ...FREE_TOURNAMENT, planId: 'club', storedTournamentLimit: null };
    const f = foldGrants(own, [planGrant('tournament_plus', END), planGrant('club', END)], NOW);
    assert.equal(f.planId, 'club');
    assert.equal(f.freeTime, null);
  });

  it('a parked plan is never folded in, even if a row names it', () => {
    assert.equal(foldGrants(FREE_TOURNAMENT, [planGrant('league', END)], NOW).planId, 'tournament');
  });

  it('a Club grant keeps a raised stored team limit', () => {
    const own: OwnFacts = { ...FREE_TOURNAMENT, storedTeamLimit: 40 };
    assert.equal(foldGrants(own, [planGrant('club', END)], NOW).teamLimit, 40);
  });

  it('sections add and a billing status replaces, as before', () => {
    const rows: GrantRow[] = [
      { type: 'module_addon', value: null, target: { addons: ['module_accounting'] }, starts_at: null, expires_at: END, revoked_at: null },
      { type: 'subscription_status', value: 'active', target: null, starts_at: null, expires_at: END, revoked_at: null },
    ];
    const f = foldGrants({ ...FREE_TOURNAMENT, subscriptionStatus: 'past_due' }, rows, NOW);
    assert.deepEqual(f.enabledAddons, ['module_accounting']);
    assert.equal(f.subscriptionStatus, 'active');
  });

  it('only plans above the club\'s own are offered', () => {
    assert.deepEqual(grantablePlansAbove('tournament'), ['tournament_plus', 'club', 'club_large']);
    assert.deepEqual(grantablePlansAbove('tournament_plus'), ['club', 'club_large']);
    assert.deepEqual(grantablePlansAbove('club_large'), []);
  });
});

describe('the last free day is a day in Eastern time', () => {
  it('ends at the first moment of the next day, Eastern (EDT and EST)', () => {
    assert.equal(endInstantForLastDay('2027-09-30'), '2027-10-01T04:00:00.000Z'); // Founding's own end
    assert.equal(endInstantForLastDay('2026-12-31'), '2027-01-01T05:00:00.000Z');
  });

  it('reads back as the same day', () => {
    assert.equal(lastDayOfInstant('2027-10-01T04:00:00.000Z'), '2027-09-30');
    assert.equal(lastDayOfInstant(endInstantForLastDay('2027-03-31')!), '2027-03-31');
  });

  it('an instant is not a day', () => {
    assert.equal(endInstantForLastDay('2027-03-31T23:59:00.000Z'), null);
    assert.equal(lastDayRefusal('2027-03-31T23:59:00.000Z', 'billing', NOW), 'Choose the last free day.');
  });
});

describe('the giver\'s cap', () => {
  it('a day not after today is refused', () => {
    assert.equal(lastDayRefusal('2026-10-25', 'billing', NOW), 'The last free day must be after today.');
    assert.equal(lastDayRefusal('2026-10-24', 'super_admin', NOW), 'The last free day must be after today.');
    assert.equal(lastDayRefusal('2026-10-26', 'billing', NOW), null);
  });

  it('Billing gives up to 6 months, Super admin up to 12, in calendar months from today', () => {
    assert.equal(latestLastDay('billing', NOW), '2027-04-25');
    assert.equal(latestLastDay('super_admin', NOW), '2027-10-25');
    assert.equal(lastDayRefusal('2027-04-25', 'billing', NOW), null);
    assert.equal(
      lastDayRefusal('2027-04-26', 'billing', NOW),
      'You can give up to 6 months, through April 25, 2027. Longer needs a super admin.',
    );
    assert.equal(lastDayRefusal('2027-10-25', 'super_admin', NOW), null);
    assert.equal(lastDayRefusal('2027-10-26', 'super_admin', NOW), 'You can give up to 12 months, through October 25, 2027.');
  });

  it('a role that cannot give has no cap and is refused', () => {
    assert.equal(latestLastDay('support', NOW), null);
    assert.equal(lastDayRefusal('2026-11-01', 'support', NOW), "Your role can't give free time.");
  });
});

describe('what the customer is told', () => {
  const END = endInstantForLastDay('2027-03-31')!;

  it('running, with the plan, the last day and the plan it goes back to', () => {
    const c = customerFreeTime(FREE_TOURNAMENT, [planGrant('tournament_plus', END)], NOW);
    assert.deepEqual(c, { state: 'running', plan: 'tournament_plus', ownPlan: 'tournament', lastDay: '2027-03-31', daysLeft: 157 });
  });

  it('ending in the last 14 days (13 days left down to the last day)', () => {
    const at = (iso: string) => customerFreeTime(FREE_TOURNAMENT, [planGrant('club', END)], new Date(iso));
    assert.equal(at('2027-03-17T16:00:00.000Z')?.state, 'running'); // 14 days left
    assert.equal(at('2027-03-18T16:00:00.000Z')?.state, 'ending'); // 13 days left
    const last = at('2027-03-31T16:00:00.000Z');
    assert.equal(last?.state, 'ending');
    assert.equal(last && 'daysLeft' in last ? last.daysLeft : -1, 0);
  });

  it('ended for 30 days after, then nothing', () => {
    const c = customerFreeTime(FREE_TOURNAMENT, [planGrant('club', END)], new Date('2027-04-01T16:00:00.000Z'));
    assert.deepEqual(c, { state: 'ended', plan: 'club', ownPlan: 'tournament', lastDay: '2027-03-31' });
    assert.equal(customerFreeTime(FREE_TOURNAMENT, [planGrant('club', END)], new Date('2027-05-02T16:00:00.000Z')), null);
  });

  it('ended early reads the day it stopped', () => {
    const c = customerFreeTime(FREE_TOURNAMENT, [planGrant('club', END, { revoked_at: '2026-11-10T20:00:00.000Z' })], new Date('2026-11-12T16:00:00.000Z'));
    assert.deepEqual(c, { state: 'ended', plan: 'club', ownPlan: 'tournament', lastDay: '2026-11-10' });
  });

  it('a club that has since bought the plan is not told its free time ended', () => {
    const own: OwnFacts = { ...FREE_TOURNAMENT, planId: 'tournament_plus' };
    assert.equal(customerFreeTime(own, [planGrant('tournament_plus', END)], new Date('2027-04-01T16:00:00.000Z')), null);
  });

  it('carries no reason, giver or grant id', () => {
    const c = customerFreeTime(FREE_TOURNAMENT, [planGrant('club', END, { id: 'g-1' })], NOW)!;
    assert.deepEqual(Object.keys(c).sort(), ['daysLeft', 'lastDay', 'ownPlan', 'plan', 'state']);
  });
});
