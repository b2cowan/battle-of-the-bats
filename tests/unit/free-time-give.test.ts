/**
 * Giving free time: every refusal the server makes (Support console Stage 4, the threat list T1–T16). `decideGive` is
 * pure and the server inserts only on its yes (lib/free-time-writes.ts), so each refusal here is a refusal with zero
 * writes. The route-level guards (the power, the address's club, the day as a string) are asserted by scan below.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { decideGive, freeTimeBlockOf, type ClubFacts, type GiveContext, type GiveRequest } from '../../lib/free-time';

const NOW = new Date('2026-10-25T16:00:00.000Z');
const CLUB: ClubFacts = { id: 'c1', name: 'UAT Test Org', planId: 'tournament', accountKind: 'organization', payingThroughStripe: false, runningPlanGrant: null };
const OPEN: GiveContext = { switchOn: true, staffIsMember: false, isDemo: false };
const PLAN: GiveRequest = { kind: 'plan_tier', plan: 'club', lastDay: '2027-03-31', reason: 'Trying Club', role: 'billing' };

const refusal = (r: ReturnType<typeof decideGive>) => (r.ok ? null : r.error);

describe('giving free time: the yes', () => {
  it('a whole plan through a last free day, ending at midnight Eastern', () => {
    const r = decideGive(PLAN, CLUB, OPEN, NOW);
    assert.ok(r.ok);
    assert.deepEqual(r.row, { type: 'plan_tier', value: null, target: { plan: 'club' }, expires_at: '2027-04-01T04:00:00.000Z' });
    assert.equal(r.reason, 'Trying Club');
  });

  it('sections and a billing status', () => {
    const s = decideGive({ kind: 'module_addon', addons: ['module_accounting', 'module_accounting'], lastDay: '2026-12-31', reason: 'Books', role: 'super_admin' }, CLUB, OPEN, NOW);
    assert.ok(s.ok);
    assert.deepEqual(s.row.target, { addons: ['module_accounting'] });
    const b = decideGive({ kind: 'subscription_status', lastDay: '2026-11-06', reason: 'Card expired', role: 'billing' }, CLUB, OPEN, NOW);
    assert.ok(b.ok);
    assert.equal(b.row.value, 'active');
  });
});

describe('giving free time: every refusal', () => {
  it('the switch off (all kinds)', () => {
    const off = { ...OPEN, switchOn: false };
    assert.match(refusal(decideGive(PLAN, CLUB, off, NOW))!, /^Free time is switched off on this server/);
    assert.match(refusal(decideGive({ ...PLAN, kind: 'module_addon', addons: ['module_accounting'] }, CLUB, off, NOW))!, /switched off/);
  });

  it('a club the staff member belongs to (T1)', () => {
    assert.equal(refusal(decideGive(PLAN, CLUB, { ...OPEN, staffIsMember: true }, NOW)), "You're a member of UAT Test Org, so you can't give it free time. Another staff member can.");
  });

  it('a public demo club (T12)', () => {
    assert.match(refusal(decideGive(PLAN, CLUB, { ...OPEN, isDemo: true }, NOW))!, /public demo club/);
  });

  it('a Coaches Portal (Q10), by account kind or by the portal plan', () => {
    assert.match(refusal(decideGive(PLAN, { ...CLUB, accountKind: 'team_workspace' }, OPEN, NOW))!, /^A Coaches Portal can't be given free time yet\./);
    assert.match(refusal(decideGive(PLAN, { ...CLUB, planId: 'team' }, OPEN, NOW))!, /Coaches Portal/);
  });

  it('a paying club, for a plan only: sections and status stay (Q3, T6)', () => {
    const paying = { ...CLUB, planId: 'tournament_plus' as const, payingThroughStripe: true };
    assert.match(refusal(decideGive(PLAN, paying, OPEN, NOW))!, /pays for Tournament Plus through Stripe/);
    assert.ok(decideGive({ ...PLAN, kind: 'module_addon', addons: ['module_accounting'] }, paying, OPEN, NOW).ok);
    assert.ok(decideGive({ ...PLAN, kind: 'subscription_status' }, paying, OPEN, NOW).ok);
  });

  it('a plan not above the club\'s own, and the top plan', () => {
    assert.equal(refusal(decideGive({ ...PLAN, plan: 'tournament_plus' }, { ...CLUB, planId: 'club' }, OPEN, NOW)), "Tournament Plus isn't above UAT Test Org’s own plan, Club.");
    assert.match(refusal(decideGive(PLAN, { ...CLUB, planId: 'club_large' }, OPEN, NOW))!, /is on Club · Association, the top plan/);
  });

  it('League plans and plans that are not plans (T13)', () => {
    assert.equal(refusal(decideGive({ ...PLAN, plan: 'league' }, CLUB, OPEN, NOW)), "League plans can't be given as free time.");
    assert.equal(refusal(decideGive({ ...PLAN, plan: 'team' }, CLUB, OPEN, NOW)), 'Choose a plan to give.');
  });

  it('a second running plan grant (Q6)', () => {
    const granted = { ...CLUB, runningPlanGrant: { id: 'g1', plan: 'club' as const, lastDay: '2027-03-31' } };
    assert.equal(
      refusal(decideGive({ ...PLAN, plan: 'club_large' }, granted, OPEN, NOW)),
      'UAT Test Org already has Club free through March 31, 2027. Give it more time from that entry instead of a second grant.',
    );
  });

  it('no end, an instant, a day not after today, and over the cap per role (T4, T5)', () => {
    assert.equal(refusal(decideGive({ ...PLAN, lastDay: undefined }, CLUB, OPEN, NOW)), 'Choose the last free day.');
    assert.equal(refusal(decideGive({ ...PLAN, lastDay: '2027-03-31T04:00:00.000Z' }, CLUB, OPEN, NOW)), 'Choose the last free day.');
    assert.equal(refusal(decideGive({ ...PLAN, lastDay: '2026-10-25' }, CLUB, OPEN, NOW)), 'The last free day must be after today.');
    assert.match(refusal(decideGive({ ...PLAN, lastDay: '2027-04-26' }, CLUB, OPEN, NOW))!, /up to 6 months, through April 25, 2027\. Longer needs a super admin\./);
    assert.ok(decideGive({ ...PLAN, lastDay: '2027-04-26', role: 'super_admin' }, CLUB, OPEN, NOW).ok);
    assert.match(refusal(decideGive({ ...PLAN, lastDay: '2027-10-26', role: 'super_admin' }, CLUB, OPEN, NOW))!, /up to 12 months/);
    // Sections and a billing status follow the same caps (Q2).
    assert.match(refusal(decideGive({ ...PLAN, kind: 'module_addon', addons: ['module_accounting'], lastDay: '2027-05-01' }, CLUB, OPEN, NOW))!, /up to 6 months/);
  });

  it('no reason (T14)', () => {
    assert.equal(refusal(decideGive({ ...PLAN, reason: '   ' }, CLUB, OPEN, NOW)), "Say why you're giving it.");
  });

  it('comp period, from the console (Q5)', () => {
    assert.match(refusal(decideGive({ ...PLAN, kind: 'comp_period' }, CLUB, OPEN, NOW))!, /no longer given/);
  });

  it('a role without the power to give (T3)', () => {
    for (const role of ['support', 'product', 'growth', 'read_only']) {
      assert.equal(refusal(decideGive({ ...PLAN, role }, CLUB, OPEN, NOW)), "Your role can't give free time.");
    }
  });

  it('a section the console does not give', () => {
    assert.equal(refusal(decideGive({ ...PLAN, kind: 'module_addon', addons: ['module_tournaments'] }, CLUB, OPEN, NOW)), 'That section is not one the console gives.');
  });

  it('the record knows before the click: switch and own club are red, portal and demo amber', () => {
    assert.equal(freeTimeBlockOf(CLUB, { ...OPEN, switchOn: false })?.tone, 'red');
    assert.equal(freeTimeBlockOf(CLUB, { ...OPEN, staffIsMember: true })?.tone, 'red');
    assert.equal(freeTimeBlockOf({ ...CLUB, accountKind: 'team_workspace' }, OPEN)?.tone, 'amber');
    assert.equal(freeTimeBlockOf(CLUB, OPEN), null);
  });
});

describe('the routes', () => {
  const give = readFileSync('app/api/platform-admin/orgs/[id]/overrides/route.ts', 'utf8');
  const one = readFileSync('app/api/platform-admin/orgs/[id]/overrides/[oid]/route.ts', 'utf8');
  const writes = readFileSync('lib/free-time-writes.ts', 'utf8');

  it('check the plan-and-billing power before anything else (T3)', () => {
    for (const src of [give, one]) {
      for (const handler of src.split('export const ').slice(1)) {
        if (!/^(POST|PATCH|DELETE|GET)\b/.test(handler)) continue;
        const body = handler.slice(handler.indexOf('=>'));
        assert.ok(/^=> \{\s*const auth = await requirePlatformPower\('club_billing'\);/.test(body), `${handler.slice(0, 6)} must check club_billing first`);
      }
    }
  });

  it('take the club from the address and the end as a day, never an instant (T5, T16)', () => {
    assert.ok(/orgId: id,/.test(give) && /lastDay: body\.last_day/.test(give));
    assert.ok(!/expires_at/.test(give), 'the give route must not read an end instant from the body');
  });

  it('insert only after the pure decision says yes', () => {
    const fn = writes.slice(writes.indexOf('export async function giveFreeTime'));
    assert.ok(fn.indexOf('if (!decision.ok) return decision;') < fn.indexOf(".from('org_overrides')"));
  });
});
