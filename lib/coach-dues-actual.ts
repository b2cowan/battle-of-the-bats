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
 */
export function duesActual(input: FamilyDuesActualInput): FamilyDuesActual {
  const duesC = toCents(input.dues);
  const cappedC = toCents(input.cappedPaid);

  let issuedC = 0;
  let handedBackC = 0;
  let writeOffsC = 0;
  let untracedC = 0;
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
    if (!KIND_CLAIMS_MONEY[c.kind]) { writeOffsC += standingC; continue; }
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

/** What the season's dues actual is made of — the three lines behind the figure on the Statement. */
export interface SeasonDuesParts {
  actual: number;
  cashKept: number;
  familyPaidCosts: number;
  fundraisingCredited: number;
}

/**
 * The season's dues actual AND its three parts, in one pass.
 *
 * ⚠ ONE PASS, NOT FOUR SUMS. Totalling each part separately is how a door stops adding up to the
 * figure above it — the same defect shape as a fold whose rows do not reach their parent.
 */
export function seasonDuesParts(families: FamilyDuesActualInput[]): SeasonDuesParts {
  let actual = 0, cashKept = 0, familyPaidCosts = 0, fundraisingCredited = 0;
  for (const f of families) {
    const r = duesActual(f);
    actual += toCents(r.actual);
    cashKept += toCents(r.parts.cashKept);
    familyPaidCosts += toCents(r.parts.familyPaidCosts);
    fundraisingCredited += toCents(r.parts.fundraisingCredited);
  }
  return {
    actual: toDollars(actual),
    cashKept: toDollars(cashKept),
    familyPaidCosts: toDollars(familyPaidCosts),
    fundraisingCredited: toDollars(fundraisingCredited),
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
   */
  credits: Array<{ playerId: string; kind: DuesCreditKind; amount: number; traced: boolean }>;
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
  credits: Array<{ kind: DuesCreditKind; amount: number; traced: boolean }>,
  paidOut: number,
): DuesCreditInput[] {
  let leftC = Math.max(0, toCents(paidOut));
  const out: DuesCreditInput[] = credits.map(c => ({ ...c, handedBack: 0 }));
  /* Two passes over the same array, in the order the product already assumes: the family's own
     money, then everything else oldest-first (the order the caller supplies them in). */
  for (const wantOwn of [true, false]) {
    for (const c of out) {
      if ((c.kind === 'overpayment') !== wantOwn) continue;
      const takeC = Math.min(leftC, toCents(c.amount));
      c.handedBack = toDollars(takeC);
      leftC -= takeC;
    }
  }
  return out;
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
    out.set(playerId, {
      dues,
      cappedPaid: Math.min(paidBy.get(playerId) ?? 0, dues),
      credits: allocatePayouts(mine, outBy.get(playerId) ?? 0),
    });
  }
  return out;
}
