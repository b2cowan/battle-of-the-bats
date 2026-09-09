/**
 * WHICH DEBTS A PAYBACK SETTLES (lib/dues-payback-selection.ts) — owner ruling R5, 2026-09-07.
 *
 * The arithmetic is a sum, so these tests are about the RULES a later tidy-up would soften without
 * any figure looking wrong:
 *
 *   1. **The coach selects, the server sums.** The amount is an OUTPUT of the selection, never an
 *      input to be trusted. A client figure that disagrees is refused rather than reconciled,
 *      because a disagreement means the two sides are looking at different credits.
 *   2. **Forgiveness can never be paid back.** It is debt relief the team GAVE, not money it holds.
 *      Two doors say so — the ceiling and this list — and they must not be able to disagree.
 *   3. **Whole credits only**, and a credit part-settled by a PRE-281 payout pays back what is left.
 *      That is the only reading under which legacy rows and the new rule coexist.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  selectPayback,
  PAYBACK_NO_SELECTION, PAYBACK_UNKNOWN_CREDIT, PAYBACK_CREDIT_NOT_PAYABLE,
  PAYBACK_ALREADY_SETTLED, PAYBACK_AMOUNT_DISAGREES,
  type SelectableCredit,
} from '../../lib/dues-payback-selection.ts';
/* The other two modules the save runs through — imported, never restated. The defect these guard
   was two doors disagreeing about one figure, and a test carrying its own copy would agree with
   whichever door it was copied from. */
import { settledPerCredit, type DuesCreditKind } from '../../lib/coach-dues-actual.ts';
import { payoutCeiling } from '../../lib/dues-credits.ts';

const c = (
  id: string, amount: number, creditType = 'fundraiser', alreadyPaidBack = 0,
): SelectableCredit => ({ id, amount, creditType, alreadyPaidBack });

/** Blake's real shape on the UAT fixture — a rebate, a contribution and a cost they fronted. */
const blake: SelectableCredit[] = [
  c('rebate', 150, 'fundraiser'),
  c('contrib', 67, 'contribution'),
  c('socks', 59.98, 'reimbursement'),
];

function ok(r: ReturnType<typeof selectPayback>) {
  assert.ok('ok' in r, 'expected a selection, got a refusal: ' + JSON.stringify(r));
  return r.ok;
}
function refused(r: ReturnType<typeof selectPayback>) {
  assert.ok('refused' in r, 'expected a refusal, got a selection');
  return r.refused;
}

describe('the coach selects, the server sums', () => {
  it('one cheque can settle two debts', () => {
    const r = ok(selectPayback(blake, ['rebate', 'socks']));
    assert.equal(r.amount, 209.98);
    assert.deepEqual(r.links, [
      { creditId: 'rebate', amount: 150 },
      { creditId: 'socks', amount: 59.98 },
    ]);
  });

  it('adds in cents, so three awkward thirds do not drift', () => {
    const thirds = [c('a', 323.61), c('b', 323.61), c('c', 323.61)];
    assert.equal(ok(selectPayback(thirds, ['a', 'b', 'c'])).amount, 970.83);
  });

  it('a repeated id is settled once, not twice', () => {
    // The unique index would refuse this with a database error; a coach deserves the same answer
    // as one who ticked it once.
    const r = ok(selectPayback(blake, ['rebate', 'rebate']));
    assert.equal(r.links.length, 1);
    assert.equal(r.amount, 150);
  });

  it('ticking nothing is refused', () => {
    assert.equal(refused(selectPayback(blake, [])).code, PAYBACK_NO_SELECTION);
  });
});

describe('the claimed amount is a check, never a source', () => {
  it('agreeing is accepted', () => {
    assert.equal(ok(selectPayback(blake, ['rebate', 'socks'], 209.98)).amount, 209.98);
  });

  it('⚠ disagreeing is REFUSED, not reconciled — the screen is stale', () => {
    // A client that thinks the rebate is still $150 when it has since been part-paid must not have
    // its number written, and must not silently have ours written either.
    assert.equal(refused(selectPayback(blake, ['rebate'], 999)).code, PAYBACK_AMOUNT_DISAGREES);
  });

  it('a cent of disagreement is still a disagreement', () => {
    assert.equal(refused(selectPayback(blake, ['socks'], 59.97)).code, PAYBACK_AMOUNT_DISAGREES);
  });
});

describe('what cannot be paid back', () => {
  it('forgiveness — debt relief the team gave, not money it holds', () => {
    const withForgiven = [...blake, c('mercy', 200, 'forgiven')];
    const r = refused(selectPayback(withForgiven, ['mercy']));
    assert.equal(r.code, PAYBACK_CREDIT_NOT_PAYABLE);
    assert.match(r.message, /forgiven/i);
  });

  it('and it is refused even when ticked alongside real debts', () => {
    const withForgiven = [...blake, c('mercy', 200, 'forgiven')];
    assert.equal(refused(selectPayback(withForgiven, ['rebate', 'mercy'])).code, PAYBACK_CREDIT_NOT_PAYABLE);
  });

  it('a credit that is not this family’s', () => {
    assert.equal(refused(selectPayback(blake, ['someone-else'])).code, PAYBACK_UNKNOWN_CREDIT);
  });

  it('one already settled in full', () => {
    const spent = [c('rebate', 150, 'fundraiser', 150)];
    assert.equal(refused(selectPayback(spent, ['rebate'])).code, PAYBACK_ALREADY_SETTLED);
  });
});

describe('legacy payouts, which carry no links at all', () => {
  it('⚠ a credit PART-settled before mig 281 pays back only what is left', () => {
    // Production had zero payouts when 281 shipped, but dev fixtures carry six and a real season
    // could carry any number. Whole-credits-only has to mean "whole of what remains", or a coach
    // with history could never pay back the rest of anything.
    const part = [c('rebate', 150, 'fundraiser', 100)];
    const r = ok(selectPayback(part, ['rebate']));
    assert.equal(r.amount, 50);
    assert.deepEqual(r.links, [{ creditId: 'rebate', amount: 50 }]);
  });
});

/**
 * THE SAVE'S OWN WIRING — the three modules the Pay out door runs through, composed here in the
 * order the route composes them.
 *
 * ⚠⚠ THIS IS THE TEST THE DEFECT OF 2026-09-09 WALKED PAST. Every piece was individually right and
 * individually tested: `settledPerCredit` knew a legacy payback had consumed part of a credit, the
 * ceiling knew what the family was owed, and `selectPayback` knew how to sum a tick-list. The route
 * simply did not put the first one in front of the third — it fed the LINKS to the selection — so
 * the sheet offered $100.00 of Logan's $300.00 sponsorship share and the save asked to hand back
 * $300.00, which its own ceiling then refused. A unit test per module cannot see that; only the
 * composition can, which is why the composition is pinned rather than described.
 */
describe('what the coach ticks is what the ceiling will accept', () => {
  type Credit = {
    id: string; kind: DuesCreditKind; amount: number; linked: number;
    creditDate: string; createdAt?: string | null;
  };

  /**
   * Exactly what the route does: derive each credit's standing, then sum the ticks against it.
   *
   * ⚠ IT MIRRORS THE ROUTE FIELD FOR FIELD, INCLUDING THE TWO IT IS TEMPTING TO DROP (`createdAt`,
   * and the claimed amount the route passes through as a CHECK). A composition test that quietly
   * simplifies the composition stops describing the thing it is named after — which is the very
   * failure this block exists to catch, one level up.
   */
  const save = (credits: Credit[], paidOut: number, ticked: string[], claimedAmount?: number) => {
    const settled = settledPerCredit(
      credits.map(x => ({
        kind: x.kind, amount: x.amount, linkedPaidBack: x.linked,
        creditDate: x.creditDate, createdAt: x.createdAt ?? null,
      })),
      paidOut,
    );
    return selectPayback(
      credits.map((x, i) => ({
        id: x.id, amount: x.amount, creditType: x.kind, alreadyPaidBack: settled[i],
      })),
      ticked,
      claimedAmount,
    );
  };
  const ceilingOf = (credits: Credit[], paidOut: number) => payoutCeiling(
    credits.map(x => ({ amount: x.amount, creditType: x.kind })),
    [{ amount: paidOut }],
  );

  it('⚠⚠ Logan: the $300.00 share carrying a $200.00 legacy payback hands back the $100.00 left', () => {
    const credits: Credit[] = [
      { id: 'share', kind: 'fundraiser', amount: 300, linked: 0, creditDate: '2026-08-28' },
    ];
    const r = ok(save(credits, 200, ['share']));
    assert.equal(r.amount, 100, 'the save asks for what the sheet offered, not the issued amount');
    assert.deepEqual(r.links, [{ creditId: 'share', amount: 100 }]);
    assert.ok(r.amount <= ceilingOf(credits, 200), 'and the ceiling accepts it');
  });

  it('a write-off beside a real credit does not push the tick past the ceiling', () => {
    const credits: Credit[] = [
      { id: 'written-off', kind: 'forgiven', amount: 100, linked: 0, creditDate: '2026-08-01' },
      { id: 'rebate', kind: 'fundraiser', amount: 200, linked: 0, creditDate: '2026-08-15' },
    ];
    const r = ok(save(credits, 100, ['rebate']));
    assert.equal(r.amount, 100);
    assert.ok(r.amount <= ceilingOf(credits, 100));
  });

  it('a family whose paybacks have taken everything is told there is nothing left', () => {
    const credits: Credit[] = [
      { id: 'share', kind: 'fundraiser', amount: 300, linked: 0, creditDate: '2026-08-28' },
    ];
    assert.equal(refused(save(credits, 300, ['share'])).code, PAYBACK_ALREADY_SETTLED);
    assert.equal(ceilingOf(credits, 300), 0);
  });
});
