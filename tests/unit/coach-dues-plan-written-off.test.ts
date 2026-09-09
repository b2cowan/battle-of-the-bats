/**
 * A WRITTEN-OFF BILL IS NOT STILL PLANNED (owner ruling 2026-09-09) — which month the report stops
 * expecting dues in, and which credits may never touch the plan at all.
 *
 * ⚠⚠ THE DEFECT THIS CLOSES, in the owner's own words: *"if we write off a future payment, wouldn't
 * that future payment be removed from the planned figure? If we leave it there we would overstate
 * the planned amount."* A $500 bill forgiven left Budget vs. Actual planning to receive it, so the
 * season reported a $500 shortfall the coach had themselves cancelled — for the rest of the year.
 *
 * ⚠⚠ AND THE RULING IT MUST NOT SWALLOW. An earlier proposal to net **outside credits**
 * (fundraising, sponsorship, a bill a family paid direct) off the planned dues figure was deleted,
 * and its plan file says not to re-propose it. That ruling stands and is asserted here: those
 * credits DO bring money in, they simply bring it from elsewhere, and they land on the ACTUAL side.
 * Only a credit with no money behind it may lower the plan, because only it means the money is
 * never coming. A test that lets fundraising move the plan has reversed a standing decision.
 *
 * ⚠ THE MONTH IS NOT A NEW CONVENTION. A write-off carries its own date, not a bill's — but credits
 * already meet bills by the rule the team picked in settings, so the write-off comes out of the
 * month holding the bill it actually cancelled.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { duesPositionByInstallment } from '../../lib/coach-dues-remaining.ts';

const inst = (id: string, n: number, amount: number, dueDate: string, paidAt: string | null = null) =>
  ({ id, playerId: 'p1', installmentNumber: n, amount, dueDate, paidAt });

const credit = (id: string, creditType: string, amount: number, creditDate = '2026-09-01') =>
  ({ id, playerId: 'p1', amount, creditType, creditDate, createdAt: `${creditDate}T00:00:00Z` });

const pay = (id: string, amount: number, receivedDate = '2026-10-01') =>
  ({ id, playerId: 'p1', amount, receivedDate, createdAt: `${receivedDate}T00:00:00Z` });

/** The team setting that lands credits on the NEXT bill due — the simplest to reason about. */
const NEXT = 'next_first' as const;

describe('a written-off bill stops being planned, in its own month', () => {
  it('⚠⚠ the owner’s $500 — forgive a March bill and March stops expecting it', () => {
    const r = duesPositionByInstallment({
      installments: [inst('oct', 1, 1500, '2026-10-01', '2026-10-01'), inst('mar', 2, 500, '2027-03-01')],
      payments: [pay('c1', 1500)],
      credits: [credit('w1', 'forgiven', 500)],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOff.get('mar'), 500);
    assert.equal(r.writtenOff.get('oct'), undefined, 'a bill already paid cannot be written off');
    assert.equal(r.writtenOffPlaced, 500);
  });

  it('⚠ a part-paid bill drops to what actually arrived, so the variance is zero', () => {
    /* $500 billed, $200 sent, the rest forgiven. The plan for that month should read $200 — which
       is exactly the actual, and the season is correctly reported as on plan rather than short. */
    const r = duesPositionByInstallment({
      installments: [inst('mar', 1, 500, '2027-03-01')],
      payments: [pay('c1', 200)],
      credits: [credit('w1', 'forgiven', 300)],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOff.get('mar'), 300);
    assert.equal(500 - (r.writtenOff.get('mar') ?? 0), 200);
  });

  it('⚠⚠ a write-off bigger than the bill cancels only what was there', () => {
    /* Forgive $500 against $300 outstanding: exactly $300 of planned revenue stops being planned.
       The other $200 was never planned revenue, so subtracting it would take off money the plan
       never contained. */
    const r = duesPositionByInstallment({
      installments: [inst('mar', 1, 300, '2027-03-01')],
      payments: [],
      credits: [credit('w1', 'forgiven', 500)],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOff.get('mar'), 300);
    assert.equal(r.writtenOffPlaced, 300);
  });

  it('⚠⚠ FUNDRAISING NEVER TOUCHES THE PLAN — the standing ruling this must not reverse', () => {
    /* A rebate lowers a family's bill, but the money DID arrive; it simply arrived from the drive
       rather than the family, and it counts on the actual side. Netting it off the plan would
       report the season as planning less than it asked for, which is the proposal a previous
       ruling deleted. Same for sponsorship and for a bill a family paid a vendor direct. */
    const r = duesPositionByInstallment({
      installments: [inst('mar', 1, 500, '2027-03-01')],
      payments: [],
      credits: [
        credit('f1', 'fundraiser', 150),
        credit('s1', 'sponsorship', 100),
        credit('r1', 'reimbursement', 80),
        credit('o1', 'overpayment', 50),
      ],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOff.get('mar'), undefined);
    assert.equal(r.writtenOffPlaced, 0);
    // They still lower what the family SENDS — the plan is the only thing they leave alone.
    assert.ok((r.remaining.get('mar') ?? 500) < 500);
  });

  it('a typed adjustment counts, and names itself separately from forgiveness', () => {
    const r = duesPositionByInstallment({
      installments: [inst('mar', 1, 500, '2027-03-01')],
      payments: [],
      credits: [credit('a1', 'other', 17)],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOff.get('mar'), 17);
  });

  it('⚠ both kinds on one season are both counted, and both named', () => {
    const r = duesPositionByInstallment({
      installments: [inst('mar', 1, 500, '2027-03-01')],
      payments: [],
      credits: [credit('a1', 'other', 17, '2026-09-01'), credit('f1', 'forgiven', 50, '2026-09-02')],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOffPlaced, 67);
  });

  it('⚠ a write-off spreads across the bills it actually cancelled, month by month', () => {
    /* $700 forgiven against two open bills of $500 and $400: the first takes $500 and the second
       $200, so each month drops by what it really lost rather than by a season-level average. */
    const r = duesPositionByInstallment({
      installments: [inst('mar', 1, 500, '2027-03-01'), inst('may', 2, 400, '2027-05-01')],
      payments: [],
      credits: [credit('w1', 'forgiven', 700)],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOff.get('mar'), 500);
    assert.equal(r.writtenOff.get('may'), 200);
    assert.equal(r.writtenOffPlaced, 700);
  });

  it('a season with nothing written off says so, and every bill stays whole', () => {
    const r = duesPositionByInstallment({
      installments: [inst('oct', 1, 1500, '2026-10-01'), inst('mar', 2, 500, '2027-03-01')],
      payments: [],
      credits: [],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOff.size, 0);
    assert.equal(r.writtenOffPlaced, 0);
  });
});

describe('the walk places the money; it never decides how much there is', () => {
  it('⚠⚠ a family who already paid in cash has NO bill for a write-off to cancel', () => {
    /* THE DEFECT THIS PINS, found on the UAT fixture during the build rather than by reading.
       Avery was billed $700 and sent $1,250, so every instalment is settled in CASH and her $17.00
       adjustment lands on nothing. A season total taken from this walk would read $0.00 while the
       Player Dues band read $17.00 — two figures for one concept, on the two screens the whole
       ruling exists to reconcile. The caller takes the TOTAL from the band and uses this only for
       placement, carrying whatever cannot be placed to the undated column. */
    const r = duesPositionByInstallment({
      installments: [inst('oct', 1, 700, '2026-10-01', '2026-10-01')],
      payments: [pay('c1', 1250)],
      credits: [credit('a1', 'other', 17)],
      payouts: [],
      mode: NEXT,
    });
    assert.equal(r.writtenOffPlaced, 0, 'nothing to place — and that is not the same as nothing written off');
    assert.equal(r.writtenOff.size, 0);
  });

  it('⚠ a write-off bigger than the bills leaves the excess for the caller to place', () => {
    const r = duesPositionByInstallment({
      installments: [inst('mar', 1, 300, '2027-03-01')],
      payments: [],
      credits: [credit('w1', 'forgiven', 500)],
      payouts: [],
      mode: NEXT,
    });
    // $300 found a bill; the caller carries the remaining $200 undated.
    assert.equal(r.writtenOffPlaced, 300);
  });
});

describe('the placement can redistribute the write-off, never resize it', () => {
  /* ⚠⚠ THE INVARIANT THE REPORT'S PLAN FIGURE RESTS ON (/review, 2026-09-09).
     The Budget vs. Actual feed subtracts each bill's placed write-off from its own month, then
     emits the difference between the band's TOTAL and what was placed as an undated event —
     **in whichever direction it falls**. So the season figure is always

         Σ(instalment − placed) − (total − placed)  ≡  Σ instalment − total

     and the months only decide WHERE it sits. The first cut emitted the remainder only when it was
     positive, silently assuming this walk can never place more than the band counted. It can: the
     bill-application walk gives a forgiven credit its full amount, while the band reduces it by
     anything handed back — so a legacy family with a repaid forgiveness places MORE than the band
     counts, and the dropped negative would have quietly under-stated the plan. */
  const seasonPlan = (instalments: number[], placed: number, bandTotal: number) => {
    const perInstalment = instalments.reduce((s, a) => s + a, 0) - placed;
    const unplaced = Math.round((bandTotal - placed) * 100) / 100;
    return Math.round((perInstalment - unplaced) * 100) / 100;
  };

  it('the plan equals gross minus the BAND’s total when the walk places all of it', () => {
    assert.equal(seasonPlan([500, 400], 300, 300), 600);
  });

  it('…and when the walk can place NONE of it (every bill already paid in cash)', () => {
    assert.equal(seasonPlan([500, 400], 0, 17), 883);
  });

  it('⚠⚠ …and when the walk places MORE than the band counts — the dropped-negative case', () => {
    /* A forgiven credit of $100 that has been repaid: the band counts $0 lowered, the walk still
       puts $100 on a bill. The plan must come back to the gross $900, not $800. */
    assert.equal(seasonPlan([500, 400], 100, 0), 900);
  });
});
