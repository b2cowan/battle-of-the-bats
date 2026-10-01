/**
 * TEAMS' MODEL (Tournament admin redesign Stage 2): how a division's teams are banded, the order the
 * record's Previous / Next walks, and the payment words a row and the record say.
 *
 * The rules held here (each ruled 2026-09-30):
 *   - T2 / F41: a team waiting for a decision is ON the board — the first band, "To review";
 *     one that already holds its spot stays on its spot's row (owner P2), never in two places.
 *   - T4: a band per pool with its fill ("3 of 3"), an open spot is a row (a swap can move a team in),
 *     the waitlist and "Accepted — needs a spot" as bands. Bands follow STATUS, never a stale waitlist
 *     number (an accepted team with a leftover position is not on the waitlist).
 *   - T3: the record's foot walks the list's own order — review band, then pools, then the waitlist.
 *   - T5: "Paid" / "Owes $475" (Check-in's words); only an accepted team pays.
 *   - D10: the record's payment line is facts, not narration.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListBands, buildSlotBands, narrowSlotBands, nextOpenSlot, paymentFact, paymentLine, recordOrder,
  type FeeSchedule, type PoolSlot, type TeamRecord,
} from '../../lib/tournament-teams';

const team = (id: string, status: TeamRecord['status'], extra: Partial<TeamRecord> = {}): TeamRecord => ({
  id, name: `${id} U11 Girls`, coach: `Coach ${id}`, email: `${id}@example.test`, division_id: 'u11', division_name: 'U11 Girls',
  status, paymentStatus: 'pending', depositPaid: 0, totalPaid: 0, registered_at: '2026-05-01T12:00:00Z', ...extra,
});
const slot = (id: string, poolId: string, n: number, teamId: string | null, name: string): PoolSlot => ({
  id, poolId, divisionId: 'u11', slotNumber: n, displayName: name, teamId, teamName: teamId ? `${teamId} U11 Girls` : null,
});
const pools = [{ id: 'blue', name: 'Blue', display_order: 2 }, { id: 'red', name: 'Red', display_order: 1 }];

describe('the slot board (T2, T4)', () => {
  const regs = [
    team('blaze', 'pending', { registered_at: '2026-05-08T12:00:00Z' }),   // waiting, no spot
    team('falcons', 'accepted'), team('storm', 'accepted'),
    team('comets', 'pending'),                                            // waiting, holds a spot (P2)
    team('titans', 'waitlist', { waitlistPosition: 1 }),
    team('ravens', 'accepted', { waitlistPosition: 2 }),                  // accepted, stale number, no spot
    team('freeze', 'rejected'),
  ];
  const slots = [
    slot('r1', 'red', 1, 'falcons', 'Red Team 1'), slot('r2', 'red', 2, 'storm', 'Red Team 2'),
    slot('b1', 'blue', 1, 'comets', 'Blue Team 1'), slot('b2', 'blue', 2, null, 'Blue Team 2'),
  ];
  const bands = buildSlotBands({ divRegs: regs, pools, poolSlots: slots });

  it('puts a waiting team with no spot first, in "To review"', () => {
    assert.equal(bands[0].kind, 'review');
    assert.deepEqual(bands[0].rows.map(r => r.kind === 'team' && r.team.id), ['blaze']);
  });

  it('keeps a waiting team that holds a spot on its spot, and nowhere else (P2)', () => {
    const blue = bands.find(b => b.key === 'pool-blue')!;
    assert.equal(blue.rows[0].kind === 'team' && blue.rows[0].team.id, 'comets');
    assert.ok(!bands[0].rows.some(r => r.kind === 'team' && r.team.id === 'comets'));
  });

  it('bands each pool in display order with its fill, an open spot as a row', () => {
    assert.deepEqual(bands.filter(b => b.kind === 'pool').map(b => [b.label, b.count]), [['Red Pool', '2 of 2'], ['Blue Pool', '1 of 2']]);
    assert.equal(bands.find(b => b.key === 'pool-blue')!.rows[1].kind, 'empty');
  });

  it('bands by status: the waitlist is waitlisted teams; an accepted team without a spot needs one', () => {
    assert.deepEqual(bands.find(b => b.kind === 'waitlist')!.rows.map(r => r.kind === 'team' && r.team.id), ['titans']);
    assert.deepEqual(bands.find(b => b.kind === 'unplaced')!.rows.map(r => r.kind === 'team' && r.team.id), ['ravens']);
  });

  it('leaves a rejected team off the board', () => {
    assert.ok(!recordOrder(bands).some(t => t.id === 'freeze'));
  });

  it('never loses a team whose slot sits in a pool the read does not have', () => {
    const orphan = buildSlotBands({ divRegs: regs, pools, poolSlots: [...slots, slot('g1', 'gone', 1, 'ravens', 'Green Team 1')] });
    assert.deepEqual(orphan.find(b => b.kind === 'unplaced')!.rows.map(r => r.kind === 'team' && r.team.id), ['ravens']);
  });

  it('walks the record in the list\'s order: review, the pools, the waitlist', () => {
    assert.deepEqual(recordOrder(bands).map(t => t.id), ['blaze', 'falcons', 'storm', 'comets', 'titans', 'ravens']);
  });

  it('finds the spot the next accept would take (pool order, then slot number)', () => {
    assert.equal(nextOpenSlot(pools, slots)?.id, 'b2');
    assert.equal(nextOpenSlot(pools, slots.map(s => ({ ...s, teamId: s.teamId ?? 'x' }))), null);
  });

  // The Teams toolbar ruling (owner, 2026-10-01): a search or a filter on a board lists the matches.
  it('narrowed, keeps a match on its spot under its pool, counted, with no open spots', () => {
    const narrowed = narrowSlotBands(bands, [regs[2]]);   // storm, Red Team 2
    assert.deepEqual(narrowed.map(b => [b.label, b.count]), [['Red Pool', '1']]);
    const row = narrowed[0].rows[0];
    assert.equal(row.kind === 'team' && row.slot?.displayName, 'Red Team 2');
  });

  it('narrowed, keeps the board\'s other bands for their matches, in the board\'s order', () => {
    const narrowed = narrowSlotBands(bands, regs.filter(t => t.status === 'pending' || t.status === 'waitlist'));
    assert.deepEqual(narrowed.map(b => b.kind), ['review', 'pool', 'waitlist']);
    assert.deepEqual(recordOrder(narrowed).map(t => t.id), ['blaze', 'comets', 'titans']);
  });

  it('narrowed, gives a rejected match (never on the board) its own band, and nothing twice', () => {
    const narrowed = narrowSlotBands(bands, regs);
    assert.equal(narrowed[narrowed.length - 1].kind, 'rejected');
    const ids = recordOrder(narrowed).map(t => t.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(narrowSlotBands(bands, []), []);
  });
});

describe('a division without slots (T6)', () => {
  const regs = [
    team('a', 'accepted', { poolId: 'red' }), team('b', 'accepted'), team('c', 'pending'),
    team('d', 'waitlist', { waitlistPosition: 2 }), team('e', 'waitlist', { waitlistPosition: 1 }), team('f', 'rejected'),
  ];

  it('bands by status, To review first, the waitlist in its order, Rejected only when let through', () => {
    const bands = buildListBands({ teams: regs, grouping: 'status', pools: [] });
    assert.deepEqual(bands.map(b => b.kind), ['review', 'accepted', 'waitlist', 'rejected']);
    assert.deepEqual(bands[2].rows.map(r => r.kind === 'team' && r.team.id), ['e', 'd']);
    const hidden = buildListBands({ teams: regs.filter(t => t.status !== 'rejected'), grouping: 'status', pools: [] });
    assert.ok(!hidden.some(b => b.kind === 'rejected'));
  });

  it('groups by pool where the division has pools: "No pool yet", then each pool, even an empty one', () => {
    const bands = buildListBands({ teams: regs, grouping: 'pools', pools });
    assert.deepEqual(bands.map(b => [b.label, b.count]), [['To review', '1'], ['No pool yet', '4'], ['Red Pool', '1'], ['Blue Pool', '0']]);
  });

  it('has no Pools grouping without pools (what does not apply is absent)', () => {
    const bands = buildListBands({ teams: regs, grouping: 'pools', pools: [] });
    assert.ok(!bands.some(b => b.kind === 'pool' || b.kind === 'nopool'));
  });
});

describe('payment words (T5, D10)', () => {
  const fee: FeeSchedule = { depositAmount: 150, depositDueDate: '2026-05-28', totalFeeAmount: 475, totalFeeDueDate: '2026-06-07' };

  it('says Paid or Owes $… for an accepted team, and nothing for any other', () => {
    assert.deepEqual(paymentFact(team('x', 'accepted', { totalPaid: 475 }), fee), { text: 'Paid', owes: false });
    assert.deepEqual(paymentFact(team('x', 'accepted', { totalPaid: 75 }), fee), { text: 'Owes $400', owes: true });
    assert.equal(paymentFact(team('x', 'pending'), fee), null);
  });

  it('with no fee set, reads the paid flag as Check-in does', () => {
    const none: FeeSchedule = { depositAmount: null, depositDueDate: null, totalFeeAmount: null, totalFeeDueDate: null };
    assert.equal(paymentFact(team('x', 'accepted', { paymentStatus: 'paid' }), none)?.text, 'Paid');
    assert.equal(paymentFact(team('x', 'accepted'), none)?.text, 'Unpaid');
    assert.equal(paymentLine(team('x', 'accepted'), none, '2026-06-10'), null);
  });

  it('states the record\'s line as facts', () => {
    assert.deepEqual(paymentLine(team('x', 'accepted'), fee, '2026-06-10'),
      { lead: 'Owes $475', owes: true, rest: ['deposit due May 28', 'balance due Jun 7', 'past due'] });
    assert.deepEqual(paymentLine(team('x', 'accepted', { depositPaid: 150, totalPaid: 150 }), fee, '2026-05-20'),
      { lead: 'Owes $325', owes: true, rest: ['deposit paid', 'balance due Jun 7'] });
    assert.deepEqual(paymentLine(team('x', 'accepted', { totalPaid: 475 }), fee, '2026-06-10'),
      { lead: 'Paid in full · $475', owes: false, rest: [] });
  });
});
