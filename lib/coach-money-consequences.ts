/**
 * ═══ WHAT MOVES WHEN A COACH SAVES — the figures, derived once ══════════════════════════════════
 *
 * ⚠⚠ WHY THIS MODULE EXISTS. Every money form promises the coach what will happen when they save,
 * and those promises were **prose an author typed**. No gate in this repo can check a sentence: the
 * spelling, token, contrast, layout, dictionary and schema ratchets all pass happily on one that is
 * confidently false. Three were found wrong, and all three read perfectly —
 *
 *   · a club bill said it "doesn't appear on Budget vs. Actual" when the report deliberately counts
 *     it under **Not itemized** (it always appeared; it just had no name);
 *   · the refund line described the netting and never mentioned **cash on hand**, though a refund
 *     raises it exactly as income does — its sibling three lines away said so;
 *   · a Payables total read "still owing" over a figure that was not what was still owing.
 *
 * ⚖ **THE SPLIT THIS MODULE ENFORCES (owner ruling 2026-09-02).** A consequence line makes two kinds
 * of claim, and they need opposite treatment:
 *
 *   · a **NUMERIC** claim — "Umpires drops by $200" — is a figure, and a figure can be *reported*
 *     instead of asserted. That is this module. It is pure, so it is unit-tested, so a wrong figure
 *     is a failing test rather than a fluent lie.
 *   · a **STRUCTURAL** claim — "it isn't counted as income", "nobody is owed anything" — has no
 *     figure to return. **It stays in the sentence**, alone and visible, and is held by the audit.
 *
 * **So chips carry figures and prose carries rules, and neither repeats the other.** A form that says
 * both is a form that says everything twice and got longer instead of clearer.
 *
 * ⚠⚠ **CASH ON HAND ALWAYS TAKES SLOT ONE, EVEN WHEN IT DOES NOT MOVE.** This is the load-bearing
 * part of the design, and it is what the whole class of defect turns on. A paragraph that forgets to
 * mention cash still reads like a complete paragraph — that is precisely how the refund bug shipped
 * and survived review. A strip has a slot per figure, so a missing chip is a hole you can see; and
 * cash is the figure a coach most needs and the one prose most easily drops. Pinning it to the first
 * slot means an out-of-pocket cost states "no change" rather than staying silent about it.
 *
 * ⚠ **EVERY RULE BELOW IS TRACED TO A VERIFIED FACT, NOT TO THE SENTENCE IT REPLACES.** The old
 * sentences were the thing under audit; deriving the new figures from them would have carried the
 * defects forward. Each was checked against the code that actually moves the money — noted per rule.
 */

/** Which way a figure goes. `flat` is a real answer: it is how "no team cash moves" gets a slot. */
export type MoveDirection = 'up' | 'down' | 'flat';

export interface ConsequenceMove {
  /** What moves, in the coach's words — "Cash on hand", "Umpires", "The Doyle family". */
  label: string;
  /**
   * The quantity, wherever the label alone is ambiguous.
   *
   * ⚠⚠ REQUIRED ON A BUDGET LINE, AND THIS IS NOT A NICETY. "Umpires ▲ $200" means the team SPENT
   * $200 on a cost and RECEIVED $200 on an income record — the same arrow, the same label, opposite
   * facts. The register's own rule ("whatever lands in one column gets summed by someone") applies
   * to a chip as much as to a spreadsheet column.
   */
  quantity?: string;
  direction: MoveDirection;
  /** Dollars. Null when the fact is not a figure at all. */
  amount: number | null;
  /** Stands in for the figure when there is none — "no change", "fully paid". */
  words?: string;
  /**
   * ⚠⚠ ONLY CASH IS COLOURED, AND THIS FLAG IS WHY (found by looking at the rendered strip,
   * 2026-09-02). The first build coloured by ARROW — up green, down red — which reads as good news
   * and bad news. That is true of cash and FALSE of everything else: recording a $200 cost drew
   * **"Umpires · spent ▲ $200.00" in green**, congratulating a coach for spending, and a refund drew
   * its budget line in red for the best thing that had happened all week.
   * ⚖ A budget line moving is neither good nor bad — it is just where the money landed. Cash on hand
   * is the one figure with a stable reading, so it is the one figure that carries colour; every
   * other chip keeps ordinary ink and lets its arrow say the direction.
   */
  tone?: 'cash';
}

export type ConsequenceKind = 'cost' | 'income' | 'refund' | 'commitment' | 'billPayment';

export interface ConsequenceInput {
  kind: ConsequenceKind;
  amount: number;
  /**
   * Has the money actually moved? A cost with no date has not happened yet.
   *
   * ⚠ A COMMITMENT IS NEVER PAID BY THIS FORM — it schedules. It is its own kind rather than an
   * unpaid cost because the sentence it earns is different ("joins your payment schedule"), and
   * because a commitment with money already on it is a fourth state the panel handles itself.
   */
  paid: boolean;
  /**
   * The family who fronted it, if one did — their name, already formatted.
   *
   * ⚠ VERIFIED, NOT ASSUMED: the register sets `movesCash: !paidByPlayerId`, so a cost a family paid
   * genuinely leaves team cash untouched, and the credit is what the team owes them back.
   */
  paidByFamily: string | null;
  /** The budget line this lands on. Null is legitimate — an unfiled record reports as Not itemized. */
  itemName: string | null;
  /** Bill payments only: which bill, and what it is left owing afterwards. */
  billName?: string | null;
  billRemainingAfter?: number | null;
}

const CASH = 'Cash on hand';

/** Cash, in slot one, always. See the header — this is the anti-omission device, not a detail. */
function cash(direction: MoveDirection, amount: number): ConsequenceMove {
  return direction === 'flat'
    ? { label: CASH, direction: 'flat', amount: null, words: 'no change', tone: 'cash' }
    : { label: CASH, direction, amount, tone: 'cash' };
}

/**
 * What a save moves, in the order a coach should read it.
 *
 * **An empty list means nothing moves**, and the caller must then render NO strip at all — three
 * chips reading "no change" would be the loudest thing on a form about the quietest event on it.
 * The sentence says "nothing moves" in words, which is what that state actually needs.
 */
export function consequenceMoves(input: ConsequenceInput): ConsequenceMove[] {
  const { kind, amount, paid, paidByFamily, itemName } = input;
  if (!(amount > 0)) return [];

  /* A budget line the coach has not chosen yet still MOVES — it just reports under Not itemized.
     Saying "Not itemized" here is the same correction the club fold's sentence needed: the money
     counts either way, and a coach who is told nothing assumes it does not. */
  /* ⚠⚠ EMPTY STRING, NOT JUST NULL — and this was caught by the strip itself within minutes of
     rendering (2026-09-02). The form hands over `values.budgetItemName || itemFor(values)?.name ||
     ''` — an EMPTY STRING when nothing is chosen, which `??` sails straight past, because `??`
     only catches null and undefined. The chip drew a bare "· spent ▲ $200.00" with nothing named.
     ⚖ Which is the project working: in prose that would have been a sentence with a gap nobody
     noticed; as a chip it was a labelled slot standing empty, and it was obvious on sight. */
  const line = itemName?.trim() || 'Not itemized';

  switch (kind) {
    /* Nothing has moved and nothing is owed — verified: a commitment writes only scheduled
       instalments, and `cashOnHandCents` skips every row flagged `scheduled`. */
    case 'commitment':
      return [];

    case 'cost': {
      if (!paid) return [];
      const moves: ConsequenceMove[] = [
        cash(paidByFamily ? 'flat' : 'down', amount),
        { label: line, quantity: 'spent', direction: 'up', amount },
      ];
      /* The credit the team now owes. Verified: the out-of-pocket path is the credit mechanism —
         a refund's "who paid it back" is a LABEL and creates nothing (the money-in route says so
         itself), which is why only this branch adds a family. */
      if (paidByFamily) moves.push({ label: paidByFamily, quantity: 'owed', direction: 'up', amount });
      return moves;
    }

    /* Verified against the report: an income record is placed on its budget line as an arrival
       (`direction: 'in'`), so it does reach a line — the old sentence never mentioned one.
       ⚖ Owner ruling 2026-09-02: show the budget line here too. */
    case 'income':
      return [cash('up', amount), { label: line, quantity: 'received', direction: 'up', amount }];

    /* ⚠⚠ THE CASH CHIP IS THE FIGURE THE OLD SENTENCE FORGOT, and the reason this module exists.
       Verified in the register book: income and money-back share one row builder and both carry
       `movesCash: true`, so a refund raises cash exactly as income does.
       ⚠ The budget line goes DOWN: a refund nets into the cost it repaid rather than arriving as a
       second source for it. That it is not income, and that nobody is owed, are structural claims —
       they stay in the sentence and are deliberately NOT chips. */
    case 'refund':
      return [cash('up', amount), { label: line, quantity: 'spent', direction: 'down', amount }];

    case 'billPayment': {
      const moves: ConsequenceMove[] = [cash(paidByFamily ? 'flat' : 'down', amount)];
      if (input.billName) {
        const left = input.billRemainingAfter ?? 0;
        moves.push(left > 0.005
          ? { label: input.billName, quantity: 'still owing', direction: 'down', amount: left }
          : { label: input.billName, direction: 'flat', amount: null, words: 'fully paid' });
      }
      if (paidByFamily) moves.push({ label: paidByFamily, quantity: 'owed', direction: 'up', amount });
      return moves;
    }
  }
}
