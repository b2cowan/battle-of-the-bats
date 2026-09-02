import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { consequenceMoves, type ConsequenceInput } from '../../lib/coach-money-consequences.ts';

/**
 * ═══ THE POINT OF THIS FILE ═════════════════════════════════════════════════════════════════════
 *
 * These figures used to be PROSE — a sentence an author typed, which no gate in this repo could
 * check. Three shipped wrong and every one of them read perfectly. The whole value of moving them
 * into a pure module is that a wrong figure now fails a build instead of quietly misinforming a
 * coach at the moment money moves.
 *
 * ⚠ So these tests assert the FACTS, each traced to the code that actually moves the money — never
 * "what the old sentence said". The old sentences were the thing under audit.
 */

const base: ConsequenceInput = {
  kind: 'cost', amount: 200, paid: true, paidByFamily: null, itemName: 'Umpires',
};
const of = (o: Partial<ConsequenceInput> = {}) => consequenceMoves({ ...base, ...o });
const labels = (o: Partial<ConsequenceInput> = {}) => of(o).map(m => m.label);
const cashOf = (o: Partial<ConsequenceInput> = {}) => of(o).find(m => m.label === 'Cash on hand');

describe('what moves when a coach saves', () => {
  describe('cash on hand always takes slot one', () => {
    /* The anti-omission device. A paragraph that forgets cash still reads complete — that is
       exactly how the refund defect shipped. A strip cannot forget a slot it is required to fill. */
    for (const kind of ['cost', 'income', 'refund', 'billPayment'] as const) {
      test(`${kind}: cash is present and first`, () => {
        const moves = of({ kind, billName: 'Diamond permits', billRemainingAfter: 100 });
        assert.ok(moves.length > 0, 'this kind must move something');
        assert.equal(moves[0].label, 'Cash on hand');
      });
    }

    test('an out-of-pocket cost still states cash — as "no change", never by silence', () => {
      const c = cashOf({ paidByFamily: 'The Doyle family' });
      assert.equal(c?.direction, 'flat');
      assert.equal(c?.words, 'no change');
      assert.equal(c?.amount, null);
    });
  });

  describe('a refund — the live defect this module was built to make impossible', () => {
    /* VERIFIED IN THE REGISTER BOOK: income and money-back share one row builder and both carry
       `movesCash: true`. The shipped sentence described the netting and never mentioned cash. */
    test('raises cash on hand, exactly as income does', () => {
      const c = cashOf({ kind: 'refund' });
      assert.equal(c?.direction, 'up');
      assert.equal(c?.amount, 200);
      assert.deepEqual(cashOf({ kind: 'income' }), c, 'money arriving is money arriving');
    });

    test('reduces the budget line rather than adding to it', () => {
      const item = of({ kind: 'refund' }).find(m => m.label === 'Umpires');
      assert.equal(item?.direction, 'down');
      assert.equal(item?.quantity, 'spent');
    });

    test('owes nobody — a refund names who paid it back, and that is a LABEL, not a credit', () => {
      /* The money-in route says so itself. Only the out-of-pocket path creates a credit. */
      assert.equal(of({ kind: 'refund', paidByFamily: 'The Doyle family' }).length, 2);
      assert.ok(!labels({ kind: 'refund', paidByFamily: 'The Doyle family' }).includes('The Doyle family'));
    });

    test('does not chip its structural claims — those stay in the sentence', () => {
      const words = of({ kind: 'refund' }).map(m => `${m.label} ${m.words ?? ''}`).join(' ').toLowerCase();
      assert.ok(!words.includes('income'), '"it isn\'t counted as income" is prose, not a chip');
      assert.ok(!words.includes('owed'), '"nobody is owed anything" is prose, not a chip');
    });
  });

  describe('a budget line never says ▲ without saying of what', () => {
    /* "Umpires ▲ $200" is SPENT on a cost and RECEIVED on income — same arrow, same label,
       opposite facts. The register's "any column someone might sum" rule, applied to a chip. */
    test('a cost spends, income receives, and they are distinguishable', () => {
      const cost = of({ kind: 'cost' }).find(m => m.label === 'Umpires');
      const income = of({ kind: 'income' }).find(m => m.label === 'Umpires');
      assert.equal(cost?.quantity, 'spent');
      assert.equal(income?.quantity, 'received');
      assert.equal(cost?.direction, 'up');
      assert.equal(income?.direction, 'up');
      assert.notEqual(cost?.quantity, income?.quantity, 'the arrow alone cannot tell them apart');
    });

    test('every budget-line chip carries a quantity', () => {
      for (const kind of ['cost', 'income', 'refund'] as const) {
        const item = of({ kind }).find(m => m.label === 'Umpires' || m.label === 'Not itemized');
        assert.ok(item?.quantity, `${kind}: the line chip must say what the figure is`);
      }
    });
  });

  describe('an unfiled record still moves — it reports as Not itemized', () => {
    /* The exact correction the club fold's sentence needed: unfiled money counts, it just has no
       name. Saying nothing here would teach a coach it does not count. */
    test('names the report row rather than dropping the chip', () => {
      assert.ok(labels({ itemName: null }).includes('Not itemized'));
      assert.equal(of({ itemName: null }).length, of({ itemName: 'Umpires' }).length);
    });

    /* ⚠ AN EMPTY STRING, NOT ONLY NULL. The form hands over '' when nothing is chosen, and a
       nullish fallback sails straight past it — the chip drew a bare '· spent' naming nothing.
       Caught on sight the first time the strip rendered, which is the whole argument for chips. */
    test('an empty or blank name is not a name', () => {
      for (const blank of ['', '   ']) {
        assert.ok(labels({ itemName: blank }).includes('Not itemized'), JSON.stringify(blank));
        assert.ok(!labels({ itemName: blank }).some(l => l.trim() === ''), 'no chip may be unlabelled');
      }
    });
  });

  describe('nothing moves — and an empty list is the instruction not to draw a strip', () => {
    test('a commitment schedules and moves nothing', () => {
      assert.deepEqual(of({ kind: 'commitment' }), []);
    });
    test('an unpaid cost has not happened yet', () => {
      assert.deepEqual(of({ paid: false }), []);
    });
    test('a zero or blank amount moves nothing', () => {
      assert.deepEqual(of({ amount: 0 }), []);
      assert.deepEqual(of({ amount: Number.NaN }), []);
    });
  });

  describe('a family who fronted the money is owed it back', () => {
    test('a cost they paid: team cash still, the line still spends, the family is owed', () => {
      const moves = of({ paidByFamily: 'The Doyle family' });
      assert.deepEqual(moves.map(m => m.label), ['Cash on hand', 'Umpires', 'The Doyle family']);
      assert.equal(moves[1].direction, 'up', 'it counts in the budget as usual');
      assert.equal(moves[2].quantity, 'owed');
      assert.equal(moves[2].amount, 200);
    });
  });

  describe('paying a bill reports the balance it leaves, not the payment twice', () => {
    const bill = { kind: 'billPayment' as const, billName: 'Diamond permits' };
    test('a part payment names what is left owing', () => {
      const b = of({ ...bill, billRemainingAfter: 100 }).find(m => m.label === 'Diamond permits');
      assert.equal(b?.quantity, 'still owing');
      assert.equal(b?.amount, 100, 'the balance AFTER, never the payment amount again');
      assert.equal(b?.direction, 'down');
    });
    test('a payment that clears it says so in words, with no figure', () => {
      const b = of({ ...bill, billRemainingAfter: 0 }).find(m => m.label === 'Diamond permits');
      assert.equal(b?.words, 'fully paid');
      assert.equal(b?.amount, null);
    });
    test('a family paying a bill: cash unchanged, and they are owed', () => {
      const moves = of({ ...bill, billRemainingAfter: 100, paidByFamily: 'The Doyle family' });
      assert.equal(moves[0].direction, 'flat');
      assert.equal(moves.at(-1)?.label, 'The Doyle family');
      assert.equal(moves.at(-1)?.amount, 200, 'they are owed what they PAID, not the bill balance');
    });
  });

  describe('only cash carries colour', () => {
    /* Colouring by arrow painted 'spent ▲' in success green — congratulating a coach for spending —
       and painted a refund's budget line in danger red. Good news and bad news are only meaningful
       for cash; a budget line moving is just where the money landed. */
    test('the cash chip is tagged, and nothing else is', () => {
      for (const kind of ['cost', 'income', 'refund', 'billPayment'] as const) {
        const moves = of({ kind, billName: 'Diamond permits', billRemainingAfter: 100, paidByFamily: kind === 'refund' ? null : 'The Doyle family' });
        const toned = moves.filter(m => m.tone === 'cash');
        assert.equal(toned.length, 1, kind + ': exactly one figure may carry colour');
        assert.equal(toned[0].label, 'Cash on hand', kind + ': and it is cash');
      }
    });
  });

  describe('the shape holds for every state', () => {
    test('a figure is either a number or words, never neither and never both', () => {
      const every: ConsequenceInput[] = [
        base,
        { ...base, paidByFamily: 'The Doyle family' },
        { ...base, kind: 'income' },
        { ...base, kind: 'refund' },
        { ...base, kind: 'billPayment', billName: 'Diamond permits', billRemainingAfter: 100 },
        { ...base, kind: 'billPayment', billName: 'Diamond permits', billRemainingAfter: 0 },
      ];
      for (const input of every) {
        for (const m of consequenceMoves(input)) {
          assert.ok(m.label.trim().length > 0, 'every chip names what moved');
          const hasFigure = m.amount !== null;
          const hasWords = !!m.words;
          assert.ok(hasFigure !== hasWords, `${m.label}: one of a figure or words, not both`);
          if (m.direction === 'flat') assert.equal(m.amount, null, 'flat never carries a figure');
        }
      }
    });
  });
});
