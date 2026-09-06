/**
 * A FAMILY'S OWN MONEY IS NOT A CREDIT TO THEM (owner ruling 2026-09-06, QA §146 · D6).
 *
 * ⚠⚠ WHY THIS FILE EXISTS. The owner read one row of the dues table and asked a question nobody had:
 *
 *     Avery   Total Dues $700.00 · Credits ($1,128.15) · Paid $700.00 · Balance ($1,128.15)
 *
 * Avery had sent **$1,250.00**. The row said $700, because an overpayment is auto-converted to a
 * credit and the `Paid` figure is capped at the bill so the same dollars are not counted twice. The
 * cap is correct and stays. What was wrong was that "Credits" then held three unrelated things —
 * $550.00 of Avery's own money, $380.00 the club owed them for costs they had paid, and $198.15 they
 * had raised — and a family asking *"how much of my own money are you holding?"* could not be told.
 *
 * ⚠⚠ THE PROPERTY THAT MATTERS IS THE ONE THAT LOOKS LIKE AN IMPLEMENTATION DETAIL: the two returned
 * figures ALWAYS sum to what they replaced, so every balance in the product is unchanged. This is a
 * re-split of one total, never a re-derivation. Coaches have acted on those balances; a redesign
 * that quietly moved them would be a different and much worse change. The first test below is that
 * invariant, over the awkward cases as well as the happy one.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitFamilyOwnMoney } from '../../lib/dues-payments.ts';

/** Every shape that reached this helper on the QA fixture, plus the ones that break naive maths. */
const CASES: Array<{ name: string; cappedPaid: number; netCredits: number; overpaymentCredits: number; paidOut: number }> = [
  { name: 'Avery — overpaid, nothing handed back', cappedPaid: 700,    netCredits: 1128.15, overpaymentCredits: 550, paidOut: 0 },
  { name: 'Blake — a fundraiser credit partly refunded', cappedPaid: 625, netCredits: 176.98, overpaymentCredits: 0, paidOut: 100 },
  { name: 'Casey — overpaid, then handed it all back', cappedPaid: 900, netCredits: 37.5, overpaymentCredits: 300, paidOut: 300 },
  { name: 'Kai — a sponsor covered nearly the whole bill', cappedPaid: 0, netCredits: 900, overpaymentCredits: 0, paidOut: 0 },
  { name: 'nothing at all', cappedPaid: 0, netCredits: 0, overpaymentCredits: 0, paidOut: 0 },
  { name: 'payouts exceed the credits that remain', cappedPaid: 500, netCredits: 0, overpaymentCredits: 200, paidOut: 400 },
  { name: 'cents that do not divide', cappedPaid: 33.33, netCredits: 66.67, overpaymentCredits: 33.34, paidOut: 0 },
];

describe('splitFamilyOwnMoney — the balance cannot move', () => {
  for (const c of CASES) {
    it(`preserves paid + credits: ${c.name}`, () => {
      const out = splitFamilyOwnMoney(c);
      assert.equal(
        Math.round((out.paid + out.credits) * 100) / 100,
        Math.round((c.cappedPaid + c.netCredits) * 100) / 100,
        'The re-split changed the total the balance is computed from. Every dues balance in the '
        + 'product is `assessed - paid - credits`; if this sum moves, so does a number coaches and '
        + 'families have already acted on. Nothing about D6 was supposed to touch it.',
      );
    });
  }

  it('never returns a negative on either side', () => {
    for (const c of CASES) {
      const out = splitFamilyOwnMoney(c);
      assert.ok(out.paid >= 0 && out.credits >= 0 && out.ownMoneyHeld >= 0, `negative in: ${c.name}`);
    }
  });
});

describe('splitFamilyOwnMoney — whose money is it', () => {
  it("moves the family's own overpayment out of credits and into paid", () => {
    // Avery: sent $1,250 against a $700 bill; $550 of the credit column is their own money.
    const out = splitFamilyOwnMoney({ cappedPaid: 700, netCredits: 1128.15, overpaymentCredits: 550, paidOut: 0 });
    assert.equal(out.paid, 1250);          // what Avery actually sent
    assert.equal(out.credits, 578.15);     // reimbursement + fundraising — other people's money
    assert.equal(out.ownMoneyHeld, 550);
  });

  it('leaves a sponsor-funded family entirely alone', () => {
    // Kai's bill was covered by sponsorship. None of it is Kai's money, so nothing moves.
    const out = splitFamilyOwnMoney({ cappedPaid: 0, netCredits: 900, overpaymentCredits: 0, paidOut: 0 });
    assert.deepEqual(out, { paid: 0, credits: 900, ownMoneyHeld: 0 });
  });

  /**
   * ⚠⚠ THE ONE THAT MADE TWO FIGURES WRONG IN THE QA §146 MOCKUP, twice, before the owner insisted
   * the discrepancy be chased before any build. A credit handed back in cash has ALREADY stopped
   * reducing what the family owes; counting it again as money they paid would credit them twice for
   * a dollar they no longer have. Casey sent $1,200 against a $900 bill and was given the $300 back.
   */
  it('does not re-count an overpayment that was handed back in cash', () => {
    const out = splitFamilyOwnMoney({ cappedPaid: 900, netCredits: 37.5, overpaymentCredits: 300, paidOut: 300 });
    assert.equal(out.ownMoneyHeld, 0, 'Casey was given her overpayment back — the team holds none of it');
    assert.equal(out.paid, 900);
    assert.equal(out.credits, 37.5, 'the fundraiser credit is untouched by a refund of something else');
  });

  it('moves only the part of an overpayment that is still standing', () => {
    // Sent $200 over, $80 handed back: $120 of their own money is still with the team.
    const out = splitFamilyOwnMoney({ cappedPaid: 500, netCredits: 200, overpaymentCredits: 200, paidOut: 80 });
    assert.equal(out.ownMoneyHeld, 120);
    assert.equal(out.paid, 620);
    assert.equal(out.credits, 80);
  });

  it('can never move more than the credit column actually holds', () => {
    // A schedule change can leave payouts larger than what is left to move.
    const out = splitFamilyOwnMoney({ cappedPaid: 500, netCredits: 0, overpaymentCredits: 200, paidOut: 0 });
    assert.equal(out.credits, 0);
    assert.equal(out.paid, 500);
    assert.equal(out.ownMoneyHeld, 0);
  });
});

/**
 * ⚠⚠ THE ONE THING THIS HELPER HAS TO GUESS, PINNED SO IT STAYS A DECISION.
 *
 * A payout record carries no link to the credit it refunded, so when a family holds both a standing
 * overpayment and other credits, nothing in the data says which one was handed back. The helper
 * assumes the family's own money goes back first. `/review` flagged the assumption as undocumented;
 * these two tests are what make it reviewable — the first fixes the behaviour, the second states its
 * cost out loud so nobody "fixes" it into being wrong about the common case.
 */
describe('splitFamilyOwnMoney — the refund-order assumption, stated', () => {
  it('a refund stops the family being shown as overpaid — the case that actually happens', () => {
    // Designed flow: excess auto-credited, later handed back. Getting this wrong invites a coach
    // paying the same family twice.
    const out = splitFamilyOwnMoney({ cappedPaid: 900, netCredits: 37.5, overpaymentCredits: 300, paidOut: 300 });
    assert.equal(out.ownMoneyHeld, 0);
  });

  it('KNOWN COST: refunding someone else\'s credit understates the family\'s own money held', () => {
    // Bill $700, sent $1,250 ($550 over), plus a $200 sponsor credit, and $100 handed back that in
    // reality refunded the SPONSOR credit. Truth would be ownMoneyHeld $550; we report $450.
    const out = splitFamilyOwnMoney({ cappedPaid: 700, netCredits: 650, overpaymentCredits: 550, paidOut: 100 });
    assert.equal(out.ownMoneyHeld, 450, 'documented under-report, not a regression — read the note on splitFamilyOwnMoney');
    // The balance is untouched either way, which is why this is a split question and not a money one.
    assert.equal(Math.round((out.paid + out.credits) * 100) / 100, 1350);
  });
});
