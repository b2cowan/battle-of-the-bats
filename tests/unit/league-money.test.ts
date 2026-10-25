import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { feeState, formatLeagueMoney, isOwing, receivedOf, seasonMoney, type LeagueMoneyLine, type LeagueMoneyReg } from '../../lib/league-money.ts';

const season = { registrationFee: 150, owingAmberDays: 14 };
const reg = (over: Partial<LeagueMoneyReg> = {}): LeagueMoneyReg => ({
  id: 'r1', status: 'active', feeAmount: 150, acceptedAt: null, endedAt: null, spotReleased: false,
  endMoney: null, endMoneyReason: null, ...over,
});
let n = 0;
const line = (dir: 'in' | 'out', amount: number, day: string, over: Partial<LeagueMoneyLine> = {}): LeagueMoneyLine => ({
  id: `l${++n}`, regId: 'r1', dir, amount, day, method: 'etransfer', status: 'posted', note: null,
  createdAt: `${day}T12:00:0${n % 10}Z`, ...over,
});

describe('a registration\'s fee, read one way (9b-2)', () => {
  it('received: a whole payment reads received with its day and method', () => {
    const s = feeState(reg(), season, [line('in', 150, '2026-10-24')], '2026-10-25');
    assert.equal(s.kind, 'received');
    assert.equal(s.kind === 'received' && s.last?.day, '2026-10-24');
    assert.equal(isOwing(s), false);
  });
  it('refunded: an ended registration with its refund beside the payment', () => {
    const lines = [line('in', 150, '2026-10-20'), line('out', 150, '2026-10-24')];
    const s = feeState(reg({ status: 'declined', endMoney: 'refunded' }), season, lines, '2026-10-25');
    assert.equal(s.kind, 'refunded');
    assert.equal(s.kind === 'refunded' && s.refunded, 150);
    assert.equal(receivedOf(lines), 0);
  });
  it('kept: the club kept the money, with its reason', () => {
    const s = feeState(reg({ status: 'withdrawn', endMoney: 'kept', endMoneyReason: 'After the refund date' }), season, [line('in', 150, '2026-10-20')], '2026-10-25');
    assert.deepEqual(s.kind === 'kept' && [s.kept, s.reason], [150, 'After the refund date']);
  });
  it('partly correct: after a price rise the difference shows owing, with no day count', () => {
    const s = feeState(reg({ feeAmount: 180, acceptedAt: '2026-04-12T14:00:00Z' }), season, [line('in', 150, '2026-10-24')], '2026-10-25');
    assert.equal(s.kind, 'part');
    assert.deepEqual(s.kind === 'part' && [s.received, s.owing], [150, 30]);
    assert.equal(isOwing(s), true);
  });
  it('a lower price after payment: the refund of the difference leaves it received', () => {
    const s = feeState(reg({ feeAmount: 120 }), season, [line('in', 150, '2026-10-20'), line('out', 30, '2026-10-24')], '2026-10-25');
    assert.equal(s.kind, 'received');
  });
  it('a free season reads Free and owes nothing', () => {
    assert.equal(feeState(reg({ feeAmount: 0 }), { registrationFee: 0, owingAmberDays: 14 }, [], '2026-10-25').kind, 'free');
  });
  it('only an accepted child owes (review and waitlist owe nothing yet)', () => {
    assert.equal(feeState(reg({ status: 'pending_review' }), season, [], '2026-10-25').kind, 'review');
    assert.equal(feeState(reg({ status: 'waitlisted' }), season, [], '2026-10-25').kind, 'waitlist');
  });
  it('a voided payment (Undo) counts nowhere', () => {
    const s = feeState(reg(), season, [line('in', 150, '2026-10-24', { status: 'void' })], '2026-10-25');
    assert.equal(s.kind, 'owing');
  });
});

describe('owing N days: the club\'s day, never re-zoned (§0e)', () => {
  it('counts from acceptance in the club\'s day: 8 p.m. Toronto is still that day', () => {
    // 2026-10-24 20:00 in Toronto is 2026-10-25 00:00 UTC: the club accepted on the 24th.
    const s = feeState(reg({ acceptedAt: '2026-10-25T00:00:00Z' }), season, [], '2026-10-25');
    assert.deepEqual(s.kind === 'owing' && [s.acceptedDay, s.days, s.late], ['2026-10-24', 1, false]);
  });
  it('turns amber at the club\'s threshold', () => {
    const s = feeState(reg({ acceptedAt: '2026-04-12T14:00:00Z' }), season, [], '2026-10-24');
    assert.deepEqual(s.kind === 'owing' && [s.days, s.late], [195, true]);
    const under = feeState(reg({ acceptedAt: '2026-10-12T14:00:00Z' }), season, [], '2026-10-25');
    assert.equal(under.kind === 'owing' && under.late, false);
  });
  it('an acceptance from before the fact existed has no day count and is never amber', () => {
    const s = feeState(reg({ acceptedAt: null }), season, [], '2026-10-25');
    assert.deepEqual(s.kind === 'owing' && [s.days, s.late, s.acceptedDay], [null, false, null]);
  });
});

describe('the season band: Owed · Received (net of refunds) · Still owing', () => {
  it('reads the drawn 2026 season: 14 at $150, 10 paid, one paid then refunded', () => {
    const regs: LeagueMoneyReg[] = [];
    const lines = new Map<string, LeagueMoneyLine[]>();
    for (let i = 0; i < 14; i++) {
      const id = `a${i}`;
      regs.push(reg({ id }));
      if (i < 10) lines.set(id, [{ ...line('in', 150, '2026-10-01'), regId: id }]);
    }
    regs.push(reg({ id: 'ethan', status: 'declined', endMoney: 'refunded' }));
    lines.set('ethan', [{ ...line('in', 150, '2026-10-20'), regId: 'ethan' }, { ...line('out', 150, '2026-10-24'), regId: 'ethan' }]);
    const m = seasonMoney(regs, season, lines);
    assert.deepEqual(
      [m.owed, m.owedPlayers, m.received, m.receivedPlayers, m.refunded, m.owing, m.owingPlayers],
      [2100, 14, 1500, 10, 150, 600, 4],
    );
  });
  it('is cent-exact', () => {
    const m = seasonMoney([reg({ feeAmount: 0.3 })], season, new Map([['r1', [line('in', 0.1, '2026-10-01'), line('in', 0.2, '2026-10-02')]]]));
    assert.equal(m.owing, 0);
  });
});

describe('money words', () => {
  it('drops whole cents and puts the minus before the sign', () => {
    assert.equal(formatLeagueMoney(150), '$150');
    assert.equal(formatLeagueMoney(150.5), '$150.50');
    assert.equal(formatLeagueMoney(2100), '$2,100');
    assert.equal(formatLeagueMoney(-150), '−$150');
  });
});
