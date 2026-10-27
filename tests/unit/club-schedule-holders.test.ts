import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cutSlots, generateDrafts, heldSlots, teamTwice, type EngineInput, type EngineTeam } from '../../lib/club-schedule-engine.ts';
import { defaultSettings, type ScheduleSettings } from '../../lib/club-schedule-settings.ts';
import { billShares, pricedMinutes, sharesAtRate } from '../../lib/club-schedule-bill.ts';
import { HOUSE_LEAGUE, isProgramHolder, storedHolders, teamsOnly } from '../../lib/club-schedule-holders.ts';
import type { TimeBlock } from '../../lib/permit-time.ts';

/**
 * HOUSE LEAGUE AS A HOLDER OF THE CLUB'S TIME (Club Tier Stage 11b — HOUSE_LEAGUE_STAGE9_PLAN.md §0h: 9d2·15, 11b·A, 11b·B;
 * mig 392). The club gives time to House league as a whole; inside the scheduler it is one holder beside the teams, and at
 * each edge it is taken back out. The database half of the floor is scripts/club-stage11b-check.sql.
 */

const FIELD = 'v-park', D1 = 'f-d1', D2 = 'f-d2';
const VF = new Map([[FIELD, [D1, D2]]]);
const block = (weekdays: number[], startTime: string, endTime: string): TimeBlock =>
  ({ id: 'b', venueId: FIELD, facilityIds: [D1, D2], weekdays, startTime, endTime, fromDate: null, untilDate: null });
const TIME = { startsOn: '2027-06-07', endsOn: '2027-06-27', blocks: [block([1, 3], '18:00', '21:00')], datesOff: [] };
const team = (id: string, name: string): EngineTeam => ({ id, name, groupId: null, age: null });
const HL: EngineTeam = { id: HOUSE_LEAGUE, name: 'House league', groupId: null, age: null, many: true };

function input(teams: EngineTeam[], over: Partial<ScheduleSettings> = {}, rules: Partial<ScheduleSettings['rules']> = {}): EngineInput {
  const base = defaultSettings();
  const settings: ScheduleSettings = { ...base, slotMinutes: 90, ...over, teamIds: teams.map(t => t.id), rules: { ...base.rules, avoidGameDays: false, ...rules } };
  const slots = cutSlots(TIME, { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
  return { slots, teams, settings, held: heldSlots(slots, []), teamBookings: new Map(), fixed: new Map() };
}

describe('the edges: house league in, house league out', () => {
  it('a slot\'s holders split into its rep teams and its program — never both kinds in the database (11b·B)', () => {
    assert.deepEqual(storedHolders(['t1', 't2']), { teamIds: ['t1', 't2'], program: null });
    assert.deepEqual(storedHolders([HOUSE_LEAGUE]), { teamIds: [], program: HOUSE_LEAGUE });
    assert.deepEqual(teamsOnly(['t1', HOUSE_LEAGUE]), ['t1']);
    assert.ok(isProgramHolder(HOUSE_LEAGUE) && !isProgramHolder('t1'));
  });

  it('house league is never billed (11b·A) — whatever order a caller passes, its time is on no bill', () => {
    const priced = pricedMinutes([
      { day: '2027-06-07', startMs: 0, endMs: 90 * 60_000, weight: 1, teamIds: ['t1'] },
      { day: '2027-06-07', startMs: 0, endMs: 90 * 60_000, weight: 1, teamIds: [HOUSE_LEAGUE] },
    ]);
    const shares = billShares(priced, { fullHour: 100, amount: null, teamOrder: ['t1', HOUSE_LEAGUE] })!;
    assert.deepEqual([...shares.shares.keys()], ['t1']);
    assert.equal(shares.totalCents, 15000, 'the rep team pays its own 90 minutes, not house league\'s');
    assert.deepEqual([...sharesAtRate(priced, 100 / 60, undefined).keys()], ['t1']);
  });
});

describe('the engine: house league holds many slots at once', () => {
  it('all of it to house league: every slot, both facilities at once, every night — no team rule caps it', () => {
    const inp = input([HL], {}, { maxPerDay: 1, maxPerWeek: 1, noBackToBack: true });
    const [best] = generateDrafts(inp);
    const held = [...best.assignments.values()].filter(ids => ids.includes(HOUSE_LEAGUE)).length;
    assert.equal(held, inp.slots.length, 'house league takes every slot (two facilities at each start, two starts a night)');
  });

  it('a share beside a team: the team is never twice at once, house league may be', () => {
    const inp = input([team('t13', '13U AAA'), HL], { split: { method: 'percentage', values: { t13: 25, [HOUSE_LEAGUE]: 75 } } });
    const [best] = generateDrafts(inp);
    const teamOnly = new Map([...best.assignments].map(([k, ids]) => [k, teamsOnly(ids)]));
    assert.equal(teamTwice(inp.slots, teamOnly), null);
    const hl = [...best.assignments.values()].filter(ids => ids.includes(HOUSE_LEAGUE)).length;
    const t13 = [...best.assignments.values()].filter(ids => ids.includes('t13')).length;
    assert.ok(hl > t13, `house league's 75% outweighs the team's 25% (${hl} vs ${t13})`);
    for (const ids of best.assignments.values()) assert.ok(!(ids.includes(HOUSE_LEAGUE) && ids.length > 1), 'house league shares a slot with nobody');
  });
});
