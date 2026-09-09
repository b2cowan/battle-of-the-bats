/**
 * WHAT A FAMILY HAS ACTUALLY CONTRIBUTED TO THEIR DUES (owner rulings R1–R7, 2026-09-07).
 *
 * ⚠⚠ THE REPORT COUNTED THE COST AND FORGOT THE SETTLEMENT. When a family pays a team bill out of
 * their own pocket, Season spending counts that cost — its own words, at the expense query: *"The
 * report counts a family-paid cost as spending (the season spent it); cash must not."* The dues
 * credit that settled their bill was counted as revenue NOWHERE, because dues actual was cash
 * payments only. Measured on the UAT fixture 2026-09-07 and read off the rendered payload:
 * **$1,379.98** of family-paid spending inside $4,909.98, against $3,075.00 of dues actual, and the
 * reimbursement credits issued came to **$1,379.98** — every dollar on one side matched on the
 * other, with the report counting one side.
 *
 * ⚠⚠ THIS MODULE IS FOR THE **SEASON SPENDING** READING ONLY, AND THE SCOPE IS THE WHOLE POINT.
 * Three of the four errors this fixes existed because a rule right for one reading was applied to
 * another. **Cash must not call this.** Cash is gross both directions and team-cash only: a
 * family-paid cost moved no team money and a payout really did leave the account. Cash is already
 * right, and the register's identity depends on it staying that way.
 *
 * ⚠ AND NOTHING HERE TOUCHES THE BUDGET (R1). A family paying a bill directly does not change their
 * dues plan and does not change the item they paid for. Every figure below is an ACTUAL.
 *
 * THE RULING, IN ONE SENTENCE: **a credit counts as revenue only while it is still standing, and
 * only if real money stands behind it.**
 */

/** Money to the cent, the way every money module in this repo rounds. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
function toCents(n: number): number {
  return Math.round(n * 100);
}
function toDollars(c: number): number {
  return c / 100;
}

/**
 * The kinds a dues credit can be. Mirrors the database column; kept as a local union rather than an
 * import so this module stays loadable by the plain-node guard scripts (the same reason
 * `coach-dues-revenue.ts` imports with a `.ts` extension).
 */
export type DuesCreditKind =
  | 'fundraiser' | 'sponsorship' | 'reimbursement' | 'contribution'
  | 'overpayment' | 'forgiven' | 'other';

/**
 * Does this KIND of credit claim that money arrived somewhere?
 *
 * ⚠⚠ THE CLAIM IS NOT THE PROOF — see `creditIsRevenue`. A kind on this list still has to trace to
 * the record that made it. `forgiven` and `other` are not on it because they are adjustments: a
 * coach writing off part of a bill did not receive anything, and a write-off that counted as revenue
 * would report money nobody sent.
 *
 * ⚠ `overpayment` IS DELIBERATELY ABSENT and is not an adjustment either — it is the family's OWN
 * money, already sitting in their payments, and it is handled by the arithmetic in `duesActual`
 * rather than by this predicate. Listing it here would count the same dollar twice, which is the
 * exact double-count the paid-figure cap exists to prevent.
 */
const KIND_CLAIMS_MONEY: Record<DuesCreditKind, boolean> = {
  fundraiser: true,
  sponsorship: true,
  reimbursement: true,
  contribution: true,
  overpayment: false,
  forgiven: false,
  other: false,
};

/** One credit, as this module needs to see it. */
export interface DuesCreditInput {
  kind: DuesCreditKind;
  /** What was issued, gross — before anything was handed back. */
  amount: number;
  /**
   * Does this credit trace to the record that made it — a drive entry, a sponsor arrival, an
   * out-of-pocket expense?
   *
   * ⚠⚠ A COACH CAN TYPE A CREDIT THAT CLAIMS MONEY WITHOUT ANY MONEY EXISTING, which is why this
   * flag is separate from `kind` (owner rulings R6/R7, 2026-09-07). Measured 2026-09-07: of 33
   * fundraiser credits on dev exactly ONE traced to nothing, and on production all five traced —
   * so R7 (a fundraiser credit may not be typed by hand) strands nothing. Until every door is
   * closed this flag is what stops an untraceable assertion becoming revenue.
   */
  traced: boolean;
  /**
   * How much of this credit has been handed back to the family in cash.
   *
   * ⚠ THE CALLER OWNS THE ALLOCATION, AND TODAY IT IS AN ACCIDENT. A payout carries no link to the
   * credit it refunded — the schema has no such column — so which credit a refund consumed is
   * decided by an ASSUMPTION — see `allocatePayouts`. R5 replaces it with the coach's own
   * answer. This module deliberately takes the allocation as an input rather than repeating a rule
   * that is about to stop being true.
   */
  handedBack: number;
}

export interface FamilyDuesActualInput {
  /** The schedule total — what this family was billed. */
  dues: number;
  /** `Paid` as the dues surfaces compute it: payments CAPPED at the schedule total. */
  cappedPaid: number;
  /** Every credit issued to this family this season. */
  credits: DuesCreditInput[];
}

export interface FamilyDuesActual {
  /**
   * What this family has actually contributed to their dues, for the Season spending reading:
   * cash they sent that they still have not had back, plus money OTHERS put toward their bill that
   * is still standing and really arrived.
   */
  actual: number;
  /**
   * The family's balance — **unchanged, and the anchor for everything else.**
   *
   * ⚠⚠ A RE-SPLIT OF ONE TOTAL, NEVER A RE-DERIVATION. Coaches have chased families on these
   * balances; §148 shipped a defect for one round by pairing a narrowed credit column with a
   * balance built from a different pair, and only the rendered screen caught it. `actual` is proved
   * against this figure in the tests rather than trusted beside it.
   */
  balance: number;
  /**
   * Everything held back from revenue — write-offs plus untraced credits — **clamped to what the
   * credits are actually reducing this family's bill by.**
   *
   * ⚠⚠ THE CLAMP IS THE WHOLE REASON THIS FIELD EXISTS RATHER THAN TWO ADDENDS. `netCredits` is
   * clamped at the FAMILY level in the shipped derivation (`Math.max(0, creditsIssued − paidOut)`,
   * in `lib/db.ts` and the dues route), so a family whose payouts exceed their credits has nothing
   * reducing their bill at all — and subtracting an unclamped write-off from that would push the
   * contribution below the cash they actually sent. Found by the unit test below, not by reading.
   */
  excluded: number;
  /**
   * The three things `actual` is made of, for the panel behind the figure.
   *
   * ⚠⚠ THEY SUM TO `actual` BY CONSTRUCTION, AND THAT IS THE WHOLE POINT OF SHOWING THEM. A coach
   * who knows what arrived in cash sees a larger figure on the Statement; a door whose lines do not
   * add up to the number that opened it would be worse than no door. The unit tests assert the sum
   * on every case.
   *
   * ⚠ THE SUM HOLDS ONLY WHILE `handedBack` IS ALLOCATED WITHOUT EXCEEDING ITS OWN CREDIT —
   * which `allocatePayouts` guarantees, because it caps each take at the credit and
   * carries the rest to the next one. A caller that hand-builds a credit with more handed back than
   * it holds breaks the tie: the family-level clamp on `netCredits` would swallow the excess while
   * the per-kind figures below would not. Use the allocator.
   *
   * ⚠ MONEY HANDED BACK APPEARS IN NONE OF THEM, on purpose. It is not a fourth line to subtract —
   * it is simply absent from the three, because a credit that has been repaid is not money anyone
   * put toward this family's dues any more.
   */
  parts: {
    /** Cash the family sent and still has not had back — the capped paid figure plus whatever of
     *  their own overpayment the team is still holding. */
    cashKept: number;
    /** Team bills this family paid a vendor directly, still standing. */
    familyPaidCosts: number;
    /** Fundraising and sponsor money credited against this family's dues, still standing. */
    fundraisingCredited: number;
  };
  /** Standing credits that are adjustments — a forgiven balance, an `other` write-off. Before the clamp. */
  writeOffs: number;
  /**
   * ⚠ Standing credits whose KIND claims money arrived but which trace to no record. Before the
   * clamp. On the UAT fixture this is one hand-typed $150.00 fundraiser credit — it reduces the
   * family's bill while sitting in no revenue figure anywhere, which is why R7 closes the door that
   * creates it.
   */
  untraced: number;
  /**
   * ⚠⚠ WHAT CAME OFF THE BILL — the figure the Player Dues band subtracts from `Dues`
   * (owner ruling R1, 2026-09-09: "a bill lowered is not a collection").
   *
   * A credit with no money behind it lowers what a family OWES; it is not something the team
   * collected. `Dues` therefore reads `dues − billLowered.total`, and `Collected` reads `actual`.
   *
   * ⚠⚠ THE CLAMP IS WHY THIS IS NOT SIMPLY `writeOffs`, AND SUBTRACTING THE WRONG ONE MOVES EVERY
   * BALANCE — the single way this ruling can be got wrong. `balance` must stay
   * `dues − netCredits − cappedPaid`, untouched. It does, because
   *
   *     (dues − billLowered.total) − actual  ≡  balance        while `untraced` is zero
   *
   * and `billLowered.total` is clamped by the SAME rule `excluded` is. Subtract the unclamped
   * `writeOffs` instead and a family whose payouts exceed their credits shifts by the difference —
   * the §148 defect shape, where a figure was paired with a differently-clamped twin.
   *
   * ⚠ AN UNTRACED CREDIT IS NOT A BILL ADJUSTMENT and deliberately does not appear here: no coach
   * decided to lower that bill. It is held out of revenue (see `untraced`) but leaves `Dues` alone,
   * so a season carrying one would show the band short by exactly it. There are none on either
   * database — R7 closed the door that made them — which is why the band closes today. If one is
   * ever seen again, that gap is a true statement about a legacy record, not a rounding fault.
   *
   * ⚠ FORGIVENESS TAKES THE CLAMP FIRST, matching this module's header rule that a forgiveness
   * applies to bills before the family's own credits. It only ever changes which WORD the caption
   * uses, never the total.
   */
  billLowered: {
    /** Standing `forgiven` credits, after the clamp. */
    forgiven: number;
    /** Standing `other` credits — what a coach types as an **Adjustment** — after the clamp. */
    adjustment: number;
    /** The two together: what `Dues` is reduced by. */
    total: number;
  };
}

/**
 * Is this credit revenue — money someone other than the family actually put toward their bill?
 *
 * ⚠ BOTH HALVES. The kind has to claim money AND the record has to exist. A kind alone is an
 * assertion; a link alone cannot tell a rebate from a write-off.
 */
export function creditIsRevenue(c: Pick<DuesCreditInput, 'kind' | 'traced'>): boolean {
  return KIND_CLAIMS_MONEY[c.kind] && c.traced;
}

/**
 * One family's dues, as the Season spending reading should count them.
 *
 * ⚠⚠ THE ARITHMETIC, AND WHY THE OVERPAYMENT CREDIT IS LOAD-BEARING RATHER THAN AWKWARD.
 * `cappedPaid` is what the surfaces show — payments capped at the bill, so the same dollars are
 * never counted as paid AND as a credit. The excess above the bill lives as an `overpayment`
 * credit. So `cappedPaid + overpayment credits` restores what the family actually SENT, which is
 * why this function adds every credit in and then removes the ones that are not revenue: the
 * overpayment is not "someone else's money", it is the family's own cash coming back into view.
 *
 *     actual = cappedPaid + netCredits − (write-offs + untraced, clamped to netCredits)
 *
 * ⚠ AND IT EQUALS `dues − balance − excluded` BY CONSTRUCTION, which is the gate. Two
 * ways to the same number, one anchored on the balance a coach has already acted on. The unit tests
 * assert the identity on every case rather than trusting this comment.
 *
 * ⚠⚠ SINCE 2026-09-09 THE PLAYER DUES BAND READS THIS FUNCTION TOO, and that is the point rather
 * than a convenience: `Collected` on the dues screen and `Player dues` on Budget vs. Actual are now
 * ONE derivation reached from two directions, so they cannot drift apart the way they had. The band
 * pairs `actual` with `dues − billLowered.total` and lands on the balance a coach already knows —
 * see `billLowered` for why the pairing is exact and what breaks if the wrong figure is subtracted.
 */
export function duesActual(input: FamilyDuesActualInput): FamilyDuesActual {
  const duesC = toCents(input.dues);
  const cappedC = toCents(input.cappedPaid);

  let issuedC = 0;
  let handedBackC = 0;
  let writeOffsC = 0;
  let untracedC = 0;
  /* Split the moment they are counted, not re-walked afterwards — the caption names whichever
     kinds are actually present (R5), and a second pass over the same list is how two figures on
     one screen start disagreeing about the same credit. */
  let forgivenC = 0;
  /* The three parts, accumulated from the SAME per-credit standing amounts the exclusions use, so
     the door's lines and the figure it opened from cannot part company. */
  let ownStandingC = 0;
  let familyPaidC = 0;
  let fundraisingC = 0;

  for (const c of input.credits) {
    const amountC = toCents(c.amount);
    /* ⚠ STANDING, NOT ISSUED, for the two exclusions. A write-off that was somehow handed back in
       cash has already stopped reducing the bill, so subtracting its full issued amount would take
       the same dollars off twice — the double-count this module's own header warns about, rebuilt
       inside the fix. Clamped at zero: a payout larger than its credit is a data state the ladder
       already tolerates and it must not turn into a negative exclusion. */
    const standingC = Math.max(0, amountC - toCents(c.handedBack));
    issuedC += amountC;
    handedBackC += toCents(c.handedBack);

    if (c.kind === 'overpayment') {
      // The family's own money — see the header. It rejoins the cash they sent, not the credits.
      ownStandingC += standingC;
      continue;
    }
    if (!KIND_CLAIMS_MONEY[c.kind]) {
      writeOffsC += standingC;
      if (c.kind === 'forgiven') forgivenC += standingC;
      continue;
    }
    if (!c.traced) { untracedC += standingC; continue; }
    if (c.kind === 'reimbursement') familyPaidC += standingC;
    else fundraisingC += standingC;   // fundraiser, sponsorship, contribution
  }

  /* ⚠⚠ THE SAME CLAMP THE BALANCE USES, AND IT MUST STAY THE SAME ONE. `netCredits` is
     `Math.max(0, creditsIssued − paidOut)` in `lib/db.ts` and again in the dues route — clamped at
     the FAMILY level, so a family whose payouts exceed their credits has nothing reducing their
     bill. Deriving `actual` from a differently-clamped pair is exactly the shape of the defect §148
     shipped for one round, where the balance quietly used one pair and the columns another. */
  const netCreditsC = Math.max(0, issuedC - handedBackC);
  const balanceC = duesC - netCreditsC - cappedC;

  /* Nothing may be held back that the credits are not reducing the bill by in the first place. */
  const excludedC = Math.min(writeOffsC + untracedC, netCreditsC);
  const actualC = cappedC + netCreditsC - excludedC;

  /* ⚠ THE SAME CLAMP, APPLIED TO THE BILL-LOWERING HALF ALONE — see `billLowered` above for why
     this may not simply be `writeOffsC`. Forgiveness takes it first (module header: a forgiveness
     meets bills before the family's own credits), which moves no total and only decides the word. */
  const loweredC = Math.min(writeOffsC, netCreditsC);
  const loweredForgivenC = Math.min(forgivenC, loweredC);

  return {
    actual: toDollars(actualC),
    balance: toDollars(balanceC),
    excluded: toDollars(excludedC),
    parts: {
      cashKept: toDollars(cappedC + ownStandingC),
      familyPaidCosts: toDollars(familyPaidC),
      fundraisingCredited: toDollars(fundraisingC),
    },
    writeOffs: toDollars(writeOffsC),
    untraced: toDollars(untracedC),
    billLowered: {
      forgiven: toDollars(loweredForgivenC),
      adjustment: toDollars(loweredC - loweredForgivenC),
      total: toDollars(loweredC),
    },
  };
}

/**
 * The season's dues actual — the figure the Statement's Player dues row should carry.
 *
 * ⚠ SUMMED FROM THE FAMILIES, NEVER DERIVED SEPARATELY. The dues-by-family fold shows these rows,
 * and a total that does not equal the rows underneath it is the defect that fold exists to avoid.
 */
export function seasonDuesActual(families: FamilyDuesActualInput[]): number {
  return r2(families.reduce((sum, f) => sum + duesActual(f).actual, 0));
}

/**
 * THE PLAYER DUES BAND AND THE MONEY HUB'S CARD, FROM ONE WALK (owner R1–R4, 2026-09-09).
 *
 * ⚠⚠ IT EXISTS BECAUSE THREE SURFACES ASK THESE QUESTIONS AND USED TO ANSWER THEM SEPARATELY —
 * the dues band, the Money Overview card and the Statement. The ruling's whole payoff is that
 * `contributed` here IS the Statement's `Player dues` figure; a second derivation anywhere is how
 * that stops being true, quietly, on a screen a coach reconciles their books on.
 *
 * ⚠⚠ `settled` IS CAPPED PER FAMILY AND NEVER SEASON-WIDE, and the distinction is load-bearing.
 * One family's overshoot may not settle another family's bill — a season-level
 * `min(duesNet, contributed)` would silently let it, reporting a season as further paid down than
 * any family actually is. That is why this loops rather than taking two totals.
 *
 * ⚠ `balanceOwing` COUNTS ONLY THE FAMILIES WHO OWE, exactly as the dues screen has always
 * counted it — a family in credit is not netted off another family's debt. `owedBack` is the other
 * side, stated rather than folded in, and the two are what the band's captions name.
 */
export interface SeasonDuesBand {
  /** Everything billed, before anything was written off it. */
  duesGross: number;
  /** What came off the bills with no money behind it, split so a caption can name the kinds. */
  billLowered: { forgiven: number; adjustment: number; total: number };
  /** The bill as it now stands — the `Dues` tile. */
  duesNet: number;
  /** Everything families put in — the `Collected` tile, and the Statement's Player dues figure. */
  contributed: number;
  /** How much of the bill is settled — the Money Overview's `Bills settled` card. */
  settled: number;
  /** What is left to chase (positive balances only). */
  balanceOwing: number;
  /** What is owed back to families in credit (negative balances). */
  owedBack: number;
}

export function seasonDuesBand(records: SeasonDuesRecords): SeasonDuesBand {
  let duesGrossC = 0, forgivenC = 0, adjustmentC = 0, contributedC = 0, settledC = 0;
  let owingC = 0, owedBackC = 0;
  for (const input of buildFamilyDuesInputs(records).values()) {
    const r = duesActual(input);
    const duesC = toCents(input.dues);
    const netC = duesC - toCents(r.billLowered.total);
    duesGrossC += duesC;
    forgivenC += toCents(r.billLowered.forgiven);
    adjustmentC += toCents(r.billLowered.adjustment);
    contributedC += toCents(r.actual);
    settledC += Math.min(netC, toCents(r.actual));
    const balC = toCents(r.balance);
    if (balC > 0) owingC += balC; else if (balC < 0) owedBackC += -balC;
  }
  return {
    duesGross: toDollars(duesGrossC),
    billLowered: {
      forgiven: toDollars(forgivenC),
      adjustment: toDollars(adjustmentC),
      total: toDollars(forgivenC + adjustmentC),
    },
    duesNet: toDollars(duesGrossC - forgivenC - adjustmentC),
    contributed: toDollars(contributedC),
    settled: toDollars(settledC),
    balanceOwing: toDollars(owingC),
    owedBack: toDollars(owedBackC),
  };
}

/** What the season's dues actual is made of — the three lines behind the figure on the Statement. */
export interface SeasonDuesParts {
  actual: number;
  cashKept: number;
  familyPaidCosts: number;
  fundraisingCredited: number;
  /**
   * WHAT CAME OFF THE BILLS THIS SEASON, split by kind (owner R1/R5, 2026-09-09).
   *
   * ⚠⚠ THIS IS THE AUTHORITATIVE TOTAL FOR THE REPORT'S PLAN SIDE, and it rides along here rather
   * than being derived at the report because the report must not reach a different figure from the
   * Player Dues band — that disagreement is the whole defect this ruling closes. The month-by-month
   * PLACEMENT is a separate question answered by `duesPositionByInstallment`; read its header,
   * which explains why a total taken from that walk is wrong.
   */
  billLowered: { forgiven: number; adjustment: number; total: number };
}

/**
 * The season's dues actual AND its three parts, in one pass.
 *
 * ⚠ ONE PASS, NOT FOUR SUMS. Totalling each part separately is how a door stops adding up to the
 * figure above it — the same defect shape as a fold whose rows do not reach their parent.
 */
export function seasonDuesParts(families: FamilyDuesActualInput[]): SeasonDuesParts {
  let actual = 0, cashKept = 0, familyPaidCosts = 0, fundraisingCredited = 0;
  let forgiven = 0, adjustment = 0;
  for (const f of families) {
    const r = duesActual(f);
    actual += toCents(r.actual);
    cashKept += toCents(r.parts.cashKept);
    familyPaidCosts += toCents(r.parts.familyPaidCosts);
    fundraisingCredited += toCents(r.parts.fundraisingCredited);
    forgiven += toCents(r.billLowered.forgiven);
    adjustment += toCents(r.billLowered.adjustment);
  }
  return {
    actual: toDollars(actual),
    cashKept: toDollars(cashKept),
    familyPaidCosts: toDollars(familyPaidCosts),
    fundraisingCredited: toDollars(fundraisingCredited),
    billLowered: {
      forgiven: toDollars(forgiven),
      adjustment: toDollars(adjustment),
      total: toDollars(forgiven + adjustment),
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────────────────────
   ASSEMBLING THE FAMILIES FROM A SEASON'S RECORDS
   ──────────────────────────────────────────────────────────────────────────────────────────── */

/** A season's records, in the shapes the report already holds. */
export interface SeasonDuesRecords {
  /** One row per dues schedule. Siblings each carry their own. */
  schedules: Array<{ playerId: string; total: number }>;
  payments: Array<{ playerId: string; amount: number }>;
  payouts: Array<{ playerId: string; amount: number }>;
  /**
   * Every credit issued this season, **OLDEST FIRST** — see `allocatePayouts` for why
   * the order is load-bearing rather than cosmetic.
   *
   * ⚠ `paidBack` IS THE RECORDED FACT (mig 281) — what this credit's own paybacks say they settled.
   * Omit it and the credit falls to the assumption; supply it and the assumption never runs for
   * that credit.
   */
  credits: Array<{
    playerId: string; kind: DuesCreditKind; amount: number; traced: boolean;
    paidBack?: number;
  }>;
}

/**
 * Decide how much of each credit a family's paybacks have consumed.
 *
 * ⚠⚠ THIS IS AN ASSUMPTION WEARING A FUNCTION'S NAME, AND IT IS NAMED SO IT CAN BE DELETED. A
 * payout carries no link to the credit it refunded — the schema has no such column — so nothing in
 * the data says which credit a coach handed back. Something has to be assumed; the assumption is
 * visible here rather than buried.
 *
 * ⚠⚠ OWN MONEY FIRST, AND IT MUST MATCH `splitFamilyOwnMoney` — THIS WAS A REAL DEFECT FOR ONE RUN
 * (found on the live fixture, 2026-09-07). The first cut walked the credits oldest-first, which is
 * how the payout total is applied. But the shipped dues screen assumes the OPPOSITE and says so at
 * the line: *"A REFUND LANDS AGAINST THE FAMILY'S OWN MONEY FIRST, AND THAT IS A CHOICE"* — because
 * the case that actually occurs is an overpayment auto-converted to a credit and later handed back.
 * Casey's fundraiser credit is dated 2026-08-20 and their overpayment 2026-09-01, so oldest-first
 * ate the $37.50 rebate and left $37.50 of their own money standing. The TOTAL was identical either
 * way, and the panel still added up — but the door would have told a coach $37.50 of their cash was
 * fundraising while the dues screen told them the reverse. **Two answers to one event in one
 * product, which is the exact defect class this whole project exists to remove.**
 *
 * ⚠ R5 REPLACES THIS WHOLE FUNCTION with the coach's own answer: a payback will select the debts it
 * settles. When it does, delete this and read the links — and delete `splitFamilyOwnMoney`'s twin
 * assumption in the same breath, or the two will part company again.
 *
 * ⚠ IT ONLY MOVES MONEY BETWEEN KINDS, NEVER THE TOTAL. `netCredits` is clamped at the family level,
 * so the season's dues actual is the same whichever credit a payout is said to have consumed. What
 * the order changes is which LINE of the panel the money appears on — which is why it is worth
 * getting right even though no total moves.
 */
export function allocatePayouts(
  credits: Array<{
    kind: DuesCreditKind; amount: number; traced: boolean;
    /** What this credit's OWN paybacks say they settled (mig 281). Absent = nothing recorded. */
    recorded?: number;
  }>,
  paidOut: number,
): DuesCreditInput[] {
  const recordedC = credits.map(c => Math.min(toCents(c.recorded ?? 0), toCents(c.amount)));
  const unexplainedC = Math.max(0, toCents(paidOut) - recordedC.reduce((s, n) => s + n, 0));
  /* ⚠⚠ FORGIVEN CREDITS TAKE THE TAIL HERE AND ONLY HERE, and it is the identity that demands it,
     not fairness: `actual = dues − balance − excluded` holds only while every paid-out dollar lands
     on SOME credit, because the shipped balance subtracts the payout total from ALL credits at the
     family level (`Math.max(0, creditsIssued − paidOut)`, in `lib/db.ts` and the dues route). Leave
     a dollar unplaced and the Statement's balance parts from the one the dues screen renders — the
     §148 shape. `settledPerCredit` answers a different question and gives forgiveness nothing; the
     payable credits come out the same either way, which is what lets the two doors agree. */
  const takenC = spreadPayback(
    credits.map((c, i) => ({ kind: c.kind, amount: c.amount, recordedC: recordedC[i] })),
    unexplainedC,
    true,
  );
  return credits.map((c, i) => ({
    kind: c.kind, amount: c.amount, traced: c.traced,
    handedBack: toDollars(recordedC[i] + takenC[i]),
  }));
}

/**
 * WHICH CREDITS A PAYBACK CONSUMED WHEN NOTHING RECORDED IT — the capacity and the order, in one
 * place, for both readers of the assumption.
 *
 * ⚠⚠ CAPACITY IS WHAT IS STILL STANDING, never the issued amount. A credit its own links have
 * already spent cannot absorb unexplained money as well — and when it was allowed to, the clamp
 * threw those dollars away and they were simply lost. Measured on the sequence that reaches it with
 * no legacy data at all (settle a season, then pay the family the rest): $300.00 of paybacks with
 * $200.00 accounted for, the Statement's balance $900.00 against the dues screen's $1,000.00, and a
 * family who had every credit returned still reading as having contributed $100.00.
 *
 * ⚠ THE ONLY DIFFERENCE BETWEEN THE TWO READERS IS THE TAIL. Payable credits are consumed first,
 * identically, so the debts a coach is OFFERED and the credits the Statement says were consumed
 * name the same rows. What is left when payable capacity runs out either lands on the write-offs
 * (the report — see `allocatePayouts`, where the balance identity requires it) or is dropped
 * (the tick-list — see `settledPerCredit`, where the ceiling excludes forgiveness anyway).
 *
 * @returns how much each credit absorbed of the UNEXPLAINED money, in cents, in the order given
 */
function spreadPayback(
  credits: readonly { kind: DuesCreditKind; amount: number; recordedC: number }[],
  unexplainedC: number,
  forgivenTakesTail: boolean,
): number[] {
  const capacityC = credits.map(c => Math.max(0, toCents(c.amount) - c.recordedC));
  const kinds = credits.map(c => c.kind);
  const takenC = spreadOwnMoneyFirst(
    credits.map((c, i) => (c.kind === 'forgiven' ? 0 : capacityC[i])),
    kinds,
    unexplainedC,
  );
  if (!forgivenTakesTail) return takenC;
  const leftC = unexplainedC - takenC.reduce((s, n) => s + n, 0);
  if (leftC <= 0) return takenC;
  const tailC = spreadOwnMoneyFirst(
    credits.map((c, i) => (c.kind === 'forgiven' ? capacityC[i] : 0)),
    kinds,
    leftC,
  );
  return takenC.map((n, i) => n + tailC[i]);
}

/**
 * THE ORDER A PAYBACK IS ASSUMED TO HAVE CONSUMED A FAMILY'S CREDITS, and the one place it is
 * written: the family's own money first, then everything else oldest-first. Both readers of the
 * assumption go through here, so they can never part company about the ORDER — what they differ on
 * is each credit's CAPACITY, which is a genuinely different question and is documented at each
 * caller.
 *
 * @param capacitiesC how much each credit may absorb, in cents, in the caller's order
 * @param kinds       the same credits' kinds, for the own-money-first pass
 * @param amountC     the payback money to spread, in cents
 * @returns how much each credit absorbed, in cents, in the order given
 */
function spreadOwnMoneyFirst(
  capacitiesC: readonly number[],
  kinds: readonly DuesCreditKind[],
  amountC: number,
): number[] {
  let leftC = Math.max(0, amountC);
  const takenC = capacitiesC.map(() => 0);
  // Two passes over the same array: the family's own money, then everything else in the order given.
  for (const wantOwn of [true, false]) {
    for (let i = 0; i < capacitiesC.length; i++) {
      if ((kinds[i] === 'overpayment') !== wantOwn) continue;
      const takeC = Math.min(leftC, Math.max(0, capacitiesC[i]));
      takenC[i] = takeC;
      leftC -= takeC;
    }
  }
  return takenC;
}

/**
 * Fill in what a PRE-281 payback settled, for a screen that has to offer whole debts.
 *
 * ⚠⚠ A LEGACY PAYOUT SETTLED SOMETHING AND SAYS NOTHING ABOUT WHAT, AND A TICK-LIST HAS TO COPE
 * (found on the UAT fixture while writing the QA walk, 2026-09-07). Reading each credit's settled
 * amount from the links alone left every credit a legacy payout had touched reading as fully
 * standing — so one family's list offered a $300.00 debt while the team held $100.00 of their
 * money, and another's offered an overpayment that had already been handed back. A coach ticks it,
 * the server's ceiling refuses the save, and they have met a dead end wearing a button's clothes.
 *
 * ⚠⚠ THE ONE INVARIANT THIS FUNCTION EXISTS TO HOLD: **what the tick-list OFFERS may never exceed
 * what the save's ceiling ALLOWS** (`payoutCeiling` — payable credits minus every payout). Each
 * clause below is one way the first cut broke it, and each was a live dead end on the UAT fixture:
 *
 *   • **FORGIVEN CREDITS ABSORB NOTHING.** The ceiling excludes them — debt relief is never the
 *     family's money — so a write-off soaking up part of a legacy payback leaves the payable
 *     credits reading fuller than the ceiling allows.
 *   • **CAPACITY IS WHAT IS STILL STANDING**, not the issued amount. A credit its own links have
 *     already settled cannot swallow legacy money as well; the first cut let it, the clamp then
 *     threw those dollars away, and the NEXT credit read fully standing.
 *   • **THE ORDER IS DECIDED HERE, NOT AT THE CALLER.** "Oldest first" was stated as a contract in
 *     a comment and the only caller was breaking it: the dues route holds its credits newest-first,
 *     so the spread ate the wrong end of the list. A rule a caller can get wrong is a rule that
 *     will be got wrong — so the dates come in and the sort happens here.
 *
 * ⚠ THE SAME ORDER THE REPORT USES — own money first, then oldest (`spreadOwnMoneyFirst`) — so the
 * debts a coach is OFFERED and the figures the Statement SHOWS name the same credit wherever both
 * can. Only the UNEXPLAINED remainder is spread: a payback that named its debts is already accounted
 * for, and spreading the whole payout total again would settle the same dollars twice.
 *
 * ⚠⚠ **THIS COMMENT ONCE SAID "the forgiven case is where they cannot", AND THAT WAS AN OVERSTATED
 * GUARANTEE** (review, 2026-09-09). There are TWO places this function and `buildFamilyDuesInputs`
 * part company, and only the first is a seam anyone chose:
 *   1. **Forgiven credits** — deliberate, and the reason is written on `allocatePayouts`: the
 *      report's capacity is pinned by the balance identity and must not narrow.
 *   2. **A credit carrying a PARTIAL link** — not deliberate, and it is a live defect in the
 *      report rather than in this function. `buildFamilyDuesInputs` hands the assumption only
 *      credits with NO link at all, so when the unnamed remainder is larger than those credits can
 *      hold, the leftover lands nowhere and `duesActual`'s balance drifts from the balance the dues
 *      screen renders. **Measured: $950.00 against $1,000.00** on a $300 credit (linked $250)
 *      beside a $100 credit with $400 of payouts — the §148 shape, in code this change did not
 *      touch. Do not "align" this function to it; the report is the side that is wrong.
 * Both are recorded in `COACH_MONEY_CREDITS_AND_PAYBACKS_PLAN.md` §6g, awaiting an owner call
 * because the fix moves figures a coach reads.
 *
 * ⚠ IT LIVES HERE, NOT AT THE SCREEN. `dues-definition-guard` refuses a hand-rolled credit sum
 * outside the definition homes, and it is right to: five hand-copies existed before that guard. It
 * caught this one the same day it was written.
 *
 * @returns the settled amount per credit, in the order given.
 */
export function settledPerCredit(
  credits: readonly {
    kind: DuesCreditKind;
    amount: number;
    /** What this credit's OWN paybacks say they settled (mig 281). */
    linkedPaidBack: number;
    /** YYYY-MM-DD. Required — the spread is oldest-first and no caller may decide the order. */
    creditDate: string;
    /** Tiebreak for two credits dated the same day. */
    createdAt?: string | null;
  }[],
  totalPaidOut: number,
): number[] {
  /* ⚠ CLAMPED TO ITS OWN CREDIT, like every other reader of this figure. Nothing caps the
     CUMULATIVE linked amount per credit (mig 281's unique key is per payout, not per credit) and a
     credit's amount can be edited down after a payback already pointed at it. */
  const settledC = credits.map(c => Math.min(toCents(c.linkedPaidBack), toCents(c.amount)));

  /* What the payouts took that no link accounts for. Only PAYABLE credits' links count against it:
     a link on a forgiven credit is not a state any door can create, and reading one as explained
     would understate the remainder — in the direction that offers a coach too much. */
  let namedC = 0;
  for (let i = 0; i < credits.length; i++) {
    if (credits[i].kind !== 'forgiven') namedC += settledC[i];
  }
  const legacyC = Math.max(0, toCents(totalPaidOut) - namedC);

  if (legacyC > 0) {
    const order = credits.map((_, i) => i).sort((a, b) => (
      credits[a].creditDate.localeCompare(credits[b].creditDate)
      || (credits[a].createdAt ?? '').localeCompare(credits[b].createdAt ?? '')
      || a - b
    ));
    /* ⚠ THE SAME CAPACITY AND ORDER THE REPORT USES (`spreadPayback`) — one home, so the two doors
       cannot part company again about which credit a legacy payback consumed. Only the TAIL differs,
       and the difference is documented at both ends. */
    const takenC = spreadPayback(
      order.map(i => ({ kind: credits[i].kind, amount: credits[i].amount, recordedC: settledC[i] })),
      legacyC,
      false,
    );
    order.forEach((i, pos) => { settledC[i] += takenC[pos]; });
  }
  return settledC.map(toDollars);
}

/**
 * Group a season's records into one input per family.
 *
 * ⚠ `cappedPaid` IS COMPUTED HERE, THE SAME WAY EVERY DUES SURFACE COMPUTES IT — payments capped at
 * the schedule total. Passing an uncapped figure would count the excess as paid AND leave it in the
 * overpayment credit, which is the double-count the cap exists to prevent.
 */
export function buildFamilyDuesInputs(records: SeasonDuesRecords): Map<string, FamilyDuesActualInput> {
  const duesBy = new Map<string, number>();
  for (const s of records.schedules) {
    duesBy.set(s.playerId, r2((duesBy.get(s.playerId) ?? 0) + s.total));
  }
  const sumBy = (rows: Array<{ playerId: string; amount: number }>) => {
    const out = new Map<string, number>();
    for (const r of rows) out.set(r.playerId, r2((out.get(r.playerId) ?? 0) + r.amount));
    return out;
  };
  const paidBy = sumBy(records.payments);
  const outBy = sumBy(records.payouts);

  const out = new Map<string, FamilyDuesActualInput>();
  for (const [playerId, dues] of duesBy) {
    const mine = records.credits.filter(c => c.playerId === playerId);

    /* ⚠⚠ THE RECORDED FACT BEATS THE ASSUMPTION, PER CREDIT (mig 281). A payback now says which
       debts it settled, so where a credit carries `paidBack` there is nothing to infer. What is
       left for the assumption is only the money that pre-281 paybacks took and never named.

       ⚠ THE REMAINDER IS WHAT THE ASSUMPTION GETS, NOT THE WHOLE PAYOUT TOTAL. Subtracting every
       payout again over credits that already carry their own links would take the same dollars
       twice — the double-count this module's header exists to warn about, rebuilt inside the fix.
       A season with no legacy payouts leaves this at zero and `allocatePayouts` does nothing. */
    /* ⚠⚠ THE RECORDED FACT IS CLAMPED TO ITS OWN CREDIT (found by review, 2026-09-07). `duesActual`
       sums the panel's three parts from PER-CREDIT standing amounts while deriving `actual` from a
       FAMILY-level clamp, so the two agree only while no single credit has more handed back than it
       holds. `allocatePayouts` guarantees that and this module's own header says to use it — and
       then this path took `paidBack` straight through, bypassing the very allocator the warning
       names. With `paidBack > amount` on one credit the door stopped adding up to the figure that
       opened it, which is the failure that header calls "worse than no door".

       ⚠ AND IT IS REACHABLE WITHOUT A BUG ELSEWHERE: nothing caps the CUMULATIVE linked amount per
       credit (mig 281's unique key is per payout, not per credit), and a credit's amount can be
       edited down after a payback already pointed at it. Clamping here is the belt; do not remove
       it on the grounds that the writers "should" prevent it. */
    /* ⚠⚠ EVERY CREDIT IS OFFERED TO THE ASSUMPTION, EACH WITH THE ROOM IT HAS LEFT (owner question,
       2026-09-09). This used to hand the assumption only credits with NO link at all — "one that
       already says what it settled must not be reached for again" — which is true of the dollars its
       link NAMED and false of the rest of it. When the unexplained money outgrew the unlinked
       credits, the remainder landed nowhere and was silently dropped, and the Statement's balance
       parted from the one the dues screen renders.

       ⚠ IT NEEDS NO STALE DATA, which is why it is worth the words. The season settlement writes
       paybacks with no links BY DESIGN, so: settle a season, then hand the family the rest.
       Measured — $300.00 of paybacks, $200.00 accounted for, balance $900.00 against $1,000.00, and
       a family who had every credit returned still reading as having contributed $100.00. The
       partial link that triggers it could not exist before the Pay-out sheet learned to settle the
       remainder of a credit, which is what makes this the same fix arriving a step late.

       `allocatePayouts` now takes the recorded figure per credit and subtracts it from that credit's
       CAPACITY rather than from the list — so a linked credit is neither double-spent nor skipped,
       and it returns rows in the order given, which is why there is no re-merge here any more. */
    out.set(playerId, {
      dues,
      cappedPaid: Math.min(paidBy.get(playerId) ?? 0, dues),
      credits: allocatePayouts(
        mine.map(c => ({ kind: c.kind, amount: c.amount, traced: c.traced, recorded: c.paidBack })),
        outBy.get(playerId) ?? 0,
      ),
    });
  }
  return out;
}
