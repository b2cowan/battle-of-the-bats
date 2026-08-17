/**
 * Season settlement — the arithmetic behind the sheet at the foot of Player Dues, PURE: nothing
 * here touches a database, and every figure is computed in integer cents (the discipline
 * lib/dues-payments.ts and lib/dues-credits.ts already hold).
 *
 * The owner's rule, stated once and implemented once (2026-08-14):
 *
 *   > Owed-back money is paid to whoever earned it. Amounts already settled — forgiven, or handed
 *   > over — count as that family's share, already received. Whatever is left divides evenly
 *   > among the families still taking one.
 *
 * Debt joining the pot, a departed player stepping out, forgiveness and hand-set amounts are all
 * that one sentence, which is why the sheet can always show its work and always balance.
 *
 * ── THE PROMISE THIS MODULE KEEPS ────────────────────────────────────────────────────────────
 *
 *   Σ every row's refund  +  what stays with the team  +  hold-back  =  the cash the team holds
 *
 * It holds after a payout, after a forgiveness, after a family declines, and across randomised
 * rosters — pinned by property test. The old calculator could not promise it: it took a TYPED
 * pot, clamped each row at zero while building its total from unclamped figures, and subtracted
 * fundraising rebates a second time (they were never income to begin with — the flow posts the
 * full amount raised, and the player's rebate is a credit).
 *
 * ── WHY PAYING ONE FAMILY DOES NOT MOVE ANYONE ELSE'S SHARE ──────────────────────────────────
 *
 * A payout takes cash out of the team's hands, so a pot read naively from the bank balance would
 * shrink every remaining share the moment the first cheque was written — the numbers would be an
 * opinion that changed while the coach worked down the list. So the pot is measured as it stood
 * BEFORE distribution began: the SHARE portion of money already handed back (`sharePaid`, the
 * part of a payout beyond what the family was owed in credits) is added back in, and subtracted
 * again from that family's own row. Owed-back payouts need no such treatment — they lower the
 * cash and the debt by the same dollar, so the surplus never notices them.
 *
 * ⚠ The per-player figure IS the definition; every total is its sum. Computing a total from
 * unclamped figures while each row clamped at zero is what let one family's over-payout silently
 * cancel another family's real credit inside the shared pool (/review 2026-08-14, Critical).
 *
 * Relative imports are avoided entirely — this module has no dependencies, so the unit tests run
 * it under plain `node --test`.
 */

// ⚠ Coerces, exactly like its sibling in lib/dues-credits.ts. A `numeric` column arrives from
// PostgREST as a STRING, and a `Number.isFinite` guard would treat "250.00" as invalid and
// silently substitute zero — money vanishing quietly is worse than money throwing loudly. The
// `|| 0` catches only genuine NaN/undefined.
const toCents = (n: number) => Math.round(Number(n) * 100) || 0;
const toDollars = (c: number) => c / 100;

/** What a family is taking from the distribution. `even` is the default and the only one that
 *  needs no record; the other two live in `rep_season_refund_adjustments` (mig 235). */
export type ShareChoice = 'even' | 'fixed' | 'none';

export interface SettlementParticipant {
  playerId: string;
  /** On the season's-end roster ⇒ eligible for an even share (owner Call 8). A departed player
   *  still collects their OWN money — owed-back follows whoever earned it — but takes no share,
   *  and their absence raises everyone else's rather than stranding one. */
  onRoster: boolean;
  /** Σ non-forgiven credits ever issued to this family. Deliberately the ISSUED figure, not the
   *  owed-back one: it is the only credit number a payout does not move, so it is what tells a
   *  credit payout apart from a share payout. */
  creditsIssued: number;
  /** The family's own money the team is still holding (lib/dues-credits `owedBack`). */
  owedBack: number;
  /** Dues still to send after cash and credits — what the team still expects from them, and what
   *  a refund is netted against (owner Call 7: their debt joins the pot and their share cancels
   *  most of it). */
  leftToSend: number;
  /** Forgiven dollars that genuinely relieved debt. The team has already given the family this
   *  money, so it counts as their share, already received (owner Call 10). A forgiveness larger
   *  than the debt simply evaporates and must not be counted here. */
  forgiven: number;
  /** Everything ever handed back to this family in cash (rep_dues_payouts). */
  paidOut: number;
  choice: ShareChoice;
  /** Dollars, when `choice` is `fixed`. Replaces the share and never the owed-back money. */
  fixedAmount?: number;
}

export interface SettlementCashInput {
  /** Σ payment dollars received, UNCAPPED. ⚠ The Collected tile caps dues at each schedule total
   *  so an overpayment isn't double-counted in a BALANCE; for the pot that cap is wrong — the
   *  money physically arrived and the team is holding it. */
  duesReceived: number;
  /** The FULL amount raised, which is what the books receive. The players' rebates are credits,
   *  and appear on the owed-to-families line — never as a deduction from income. */
  fundraisingRaised: number;
  /**
   * Club funding the club approved for this SEASON.
   *
   * ⚠ THIS WAS HARD-CODED TO ZERO UNTIL 2026-08-17, and the sheet printed an apology for it.
   * `rep_team_payment_requests` carried no program year, so an approved request could not be
   * attributed to a season at all — counting it would have let a team in its third season pay
   * families out of money an earlier season received. Migration 247 gives those records a season,
   * so the pot can finally hold them and the caveat on the card retires.
   */
  orgFunding: number;
  /**
   * Income and money back the coach RECORDED (`rep_team_money_in`, mig 243).
   *
   * ⚠⚠ ALSO MISSING UNTIL 2026-08-17, and this one was silently wrong rather than openly excluded:
   * money a coach recorded as arriving reached no cash figure in the product, so this pot — the
   * thing that decides what each family is actually refunded — was UNDERSTATING what the team held
   * by every dollar of sponsor income and every refund the team had received. Both kinds raise cash;
   * their difference is a REPORT distinction, not a cash one.
   */
  recordedIn: number;
  /** Cash that left the team's account: paid expenses the TEAM paid, allocation installments,
   *  approved payments to the org. ⚠ Excludes out-of-pocket costs a family covered directly —
   *  that money never left the team, and subtracting it would understate what the team holds. */
  cashOut: number;
  /** Cash already handed back to families (rep_dues_payouts) — real money out. */
  payoutsTotal: number;
  /** The coach's intention to keep something for next season. Capped at the surplus, and refused
   *  against owed-back money: a coach may not hold back what the team owes families. */
  holdBack: number;
  /**
   * How many club requests this season are still awaiting the club's answer.
   *
   * ⚠⚠ IT IS NOT MONEY — it never enters the pot, and it must not. A pending request is money the
   * club may still decline, and every settled figure on this sheet deliberately excludes it. It is
   * here for ONE reason: it BLOCKS the close (see `closeOutBlockers`).
   *
   * ⚠ WHY A BLOCKER AND NOT A WARNING (owner ruling 2026-08-17, money redesign P4). Seasons are
   * independent — the Club tab shows the working season and nothing else, with no carry-over and no
   * cross-season view. That ruling is right, and it leaves one hole: a season that ends with a
   * request the club never answered leaves it in a season nobody looks at again. Rather than
   * re-open history to plug it, the loop is closed on the way OUT — beside the families who still
   * owe, which is the same shape of unfinished business.
   *
   * ⚠ THE ESCAPE IS ENTIRELY IN THE COACH'S HANDS, which is what makes a hard block fair: they can
   * chase the club, or withdraw the request. The refusal copy must name the second — a coach facing
   * an unresponsive club office otherwise cannot close their season at all, and that would be a
   * worse defect than the one this prevents.
   *
   * Optional so every existing caller and test keeps compiling with the pre-P4 behaviour; absent
   * means "none", which is what a team with no club has.
   */
  pendingClubRequests?: number;
}

export interface SettlementRow {
  playerId: string;
  /** The family's own money, still held by the team. No judgement, payable in any month. */
  owedBack: number;
  /** This row's slice of the surplus — an even share, a hand-set amount, or nothing. */
  cashShare: number;
  /** Dues still to send, subtracted from the refund (their share cancels their debt). */
  leftToSend: number;
  /** Share money already handed over — the part of this family's payouts beyond their credits. */
  sharePaid: number;
  /** owedBack + cashShare − leftToSend − sharePaid. NEGATIVE means STILL OWES: shown as such,
   *  never as a payout. */
  refund: number;
  /** What this family gets out of the distribution in total, cash or not — the share plus what
   *  was forgiven. The Set-refund sheet quotes it ("$154.50, of which $20.00 was forgiven"). */
  benefit: number;
  forgiven: number;
  choice: ShareChoice;
  /** True once nothing is left to pay on this row and something has been paid. */
  settled: boolean;
}

export interface SettlementPot {
  /** duesReceived + fundraisingRaised + orgFunding + recordedIn − cashOut − payoutsTotal. */
  cashHeld: number;
  duesReceived: number;
  fundraisingRaised: number;
  orgFunding: number;
  recordedIn: number;
  cashOut: number;
  payoutsTotal: number;
  /** Σ owed-back across every family — their money, held by the team. */
  owedBack: number;
  /** Σ dues still to send: money coming in, which joins the pot (owner Call 7). */
  expectedIn: number;
  /** Share dollars already handed out, added back so the pot reads as it did before distribution
   *  began — the reason paying one family never moves another's share. */
  sharePaid: number;
  /** The most a coach may hold back: the surplus before hold-back, never below zero. */
  holdBackCap: number;
  holdBack: number;
  /** What there is to divide. Zero in a shortfall — state it, share nothing, pro-rate nothing. */
  surplus: number;
  /** owedBack − cashHeld when the team cannot cover what it owes; 0 otherwise (owner Call 9). */
  shortfall: number;
}

export interface Settlement {
  pot: SettlementPot;
  rows: SettlementRow[];
  totals: {
    owedBack: number;
    cashShare: number;
    refund: number;
    /** Positive refunds only — the cheques that would actually be written. */
    payable: number;
  };
  /** Surplus nobody is taking (every family declined, or hand-set amounts left a remainder that
   *  no even share could absorb). It stays with the team, and the sheet says so rather than
   *  quietly holding an unallocated balance. */
  unallocated: number;
  /** Paying everyone needs money that has not arrived yet: payable − (cash held − hold-back).
   *  A forward-looking split spends money still owed BY a family, and the sheet must say whose
   *  (plan §4.5). Zero when the cash is genuinely there. */
  awaitingCash: number;
  /** Club requests still awaiting an answer. Not money — see `SettlementCashInput`. */
  pendingClubRequests: number;
}

/**
 * CAN THIS SEASON BE CLOSED OUT? — the ONE definition of the rule (owner ruling 2026-08-14).
 *
 * ⚠ IT LIVES HERE, PURE, BECAUSE IT IS ENFORCED IN TWO PLACES: the dues panel disables the
 * button with it, and `recordSettlementPayouts` refuses the write with it. Those were two
 * hand-written copies of the same boolean, and the unit test contained a THIRD — so a regression
 * to a single condition at either site would have shipped with every test green. Adversarial
 * review found exactly that (2026-08-14). One function, both callers, and the test now exercises
 * the real thing.
 *
 * ⚠ TWO CONDITIONS, AND THE SECOND IS NOT REDUNDANT.
 *   • `expectedIn` — a family still owes dues. A forward-looking split spends money the team has
 *     not received.
 *   • `awaitingCash` — what would leave the account exceeds what is in it. NOT implied by the
 *     first: `sharePaid` (money already handed to a family) is not bounded by their eventual
 *     share, so a family paid out EARLY can owe value back at close-out, and one negative row
 *     makes `payable` exceed the cash even with every due collected.
 *
 * ⚠ A THIRD CONDITION SINCE 2026-08-17 (money redesign P4, owner ruling), and it is the only one
 * that is NOT about the arithmetic:
 *   • `pendingClubRequests` — a request the club has never answered. It is excluded from every
 *     figure on this sheet (it is money the club may still decline), so the split is correct with
 *     or without it. What it would do is DISAPPEAR: seasons are independent by ruling, the Club tab
 *     shows the working season only, and a closed season's open loop is then in a place nobody
 *     looks at again. The loop gets closed on the way out instead of by re-opening history.
 *     ⚠ The escape is the coach's — chase the club or withdraw the request — and the refusal copy
 *     has to say so, or an unresponsive club office locks a team out of closing its season.
 *
 * The remaining soft conditions — a budget still planning to spend — deliberately do NOT appear
 * here: they are the coach's judgement and only ever warn. (Club money the sheet "cannot attribute"
 * was in that list and is gone: migration 247 gave club money a season, so there is nothing left
 * to fail to attribute.)
 */
export function closeOutBlockers(s: Pick<Settlement, 'pot' | 'awaitingCash' | 'pendingClubRequests'>): {
  duesOutstanding: number;
  cashShort: number;
  pendingClubRequests: number;
  canClose: boolean;
} {
  const duesOutstanding = s.pot.expectedIn > 0.005 ? s.pot.expectedIn : 0;
  const cashShort = s.awaitingCash > 0.005 ? s.awaitingCash : 0;
  // `?? 0` rather than a required field: a team with no club has no such records, and every caller
  // that predates P4 (including the unit tests that exercise the arithmetic) means exactly zero.
  const pendingClubRequests = Math.max(0, Math.trunc(s.pendingClubRequests ?? 0));
  return {
    duesOutstanding,
    cashShort,
    pendingClubRequests,
    canClose: duesOutstanding === 0 && cashShort === 0 && pendingClubRequests === 0,
  };
}

/**
 * The whole sheet, from one call. Everything is derived: call it again after any payment,
 * credit, payout, expense, forgiveness or adjustment and the answer is simply true again.
 */
export function deriveSettlement(input: {
  cash: SettlementCashInput;
  participants: readonly SettlementParticipant[];
}): Settlement {
  const { cash, participants } = input;

  // ── The pot ────────────────────────────────────────────────────────────────────────────────
  const duesReceivedC      = toCents(cash.duesReceived);
  const fundraisingRaisedC = toCents(cash.fundraisingRaised);
  const orgFundingC        = toCents(cash.orgFunding);
  const recordedInC        = toCents(cash.recordedIn);
  const cashOutC           = toCents(cash.cashOut);
  const payoutsTotalC      = toCents(cash.payoutsTotal);
  const cashHeldC = duesReceivedC + fundraisingRaisedC + orgFundingC + recordedInC
    - cashOutC - payoutsTotalC;

  // Per-player, before anything is summed — the row IS the definition.
  const parts = participants.map(p => {
    const creditsIssuedC = Math.max(0, toCents(p.creditsIssued));
    const paidOutC       = Math.max(0, toCents(p.paidOut));
    return {
      p,
      owedBackC:   Math.max(0, toCents(p.owedBack)),
      leftToSendC: Math.max(0, toCents(p.leftToSend)),
      forgivenC:   Math.max(0, toCents(p.forgiven)),
      // The part of this family's payouts that was NOT settling their credits: share money
      // already in their hands.
      sharePaidC:  Math.max(0, paidOutC - creditsIssuedC),
    };
  });

  const owedBackC   = parts.reduce((s, x) => s + x.owedBackC, 0);
  const expectedInC = parts.reduce((s, x) => s + x.leftToSendC, 0);
  const sharePaidC  = parts.reduce((s, x) => s + x.sharePaidC, 0);

  // ⚠ THE POT IS MEASURED BEFORE DISTRIBUTION, and the shortfall question is asked of THAT, not
  // of the bank balance. Share money already handed out is not missing — it is distributed — so
  // asking "is the team short?" against the raw balance would flip to YES the moment a coach paid
  // the sheet out, collapse every share to zero (Call 9), and turn every family it had just paid
  // into one that suddenly owes money back. Found by settling a whole team and re-reading.
  const potCashC = cashHeldC + sharePaidC;
  const shortfallC = Math.max(0, owedBackC - potCashC);
  // ⚠ Owner Call 9: when the team cannot cover what it owes, there is NO surplus — state it,
  // share nothing, pro-rate nothing. Quietly shrinking a family's earned rebate by a hidden
  // percentage is not a decision software should make on a coach's behalf.
  const surplusBeforeHoldC = shortfallC > 0
    ? 0
    : Math.max(0, potCashC - owedBackC + expectedInC);
  const holdBackC = Math.min(Math.max(0, toCents(cash.holdBack)), surplusBeforeHoldC);
  const surplusC  = Math.max(0, surplusBeforeHoldC - holdBackC);

  // ── The distribution ───────────────────────────────────────────────────────────────────────
  // Hand-set amounts come off the top and leave the split entirely; whatever is left divides
  // among the families still taking a share. Clamped in row order so the sheet can never promise
  // more than the pot holds.
  let remainingC = surplusC;
  const shareByPlayer = new Map<string, number>();
  for (const x of parts) {
    if (!x.p.onRoster || x.p.choice !== 'fixed') continue;
    const wantC = Math.max(0, toCents(x.p.fixedAmount ?? 0));
    const grantC = Math.min(wantC, remainingC);
    remainingC -= grantC;
    shareByPlayer.set(x.p.playerId, grantC);
  }

  const even = parts.filter(x => x.p.onRoster && x.p.choice === 'even');
  if (even.length > 0 && remainingC > 0) {
    const level = solveEvenLevel(even.map(x => x.forgivenC), remainingC);
    let handedC = 0;
    for (const x of even) {
      const c = Math.max(0, level - x.forgivenC);
      shareByPlayer.set(x.p.playerId, c);
      handedC += c;
    }
    // The pennies that don't divide land on the LAST row — the rule installments already use, and
    // what makes the rows re-add to the pot exactly.
    // ⚠ The last row TAKING CASH, not simply the last row: a family whose forgiveness already
    // exceeded a share has dropped out of the split, and handing them the four stray cents would
    // put a cheque back in front of a family the sheet just said takes none.
    const remainderC = remainingC - handedC;
    if (remainderC !== 0) {
      const takers = even.filter(x => level > x.forgivenC);
      if (takers.length > 0) {
        // The ordinary case: a few stray cents, onto the last row taking cash.
        const last = takers.at(-1)!;
        shareByPlayer.set(last.p.playerId, (shareByPlayer.get(last.p.playerId) ?? 0) + remainderC);
      } else {
        // ⚠ A pot too small to give anyone a whole cent (a $0.04 close-out across ten families):
        // the level solves to zero, so NOBODY is a taker. Dropping the lot on whoever sorts last
        // on the roster would hand one family the entire remainder every time — so it goes a cent
        // at a time from the top instead. Trivial money; not a reason to be arbitrary about it.
        for (let i = 0; i < remainderC && even.length > 0; i++) {
          const p = even[i % even.length].p.playerId;
          shareByPlayer.set(p, (shareByPlayer.get(p) ?? 0) + 1);
        }
      }
      handedC += remainderC;
    }
    remainingC -= handedC;
  }

  const rows: SettlementRow[] = parts.map(x => {
    const cashShareC = shareByPlayer.get(x.p.playerId) ?? 0;
    const refundC = x.owedBackC + cashShareC - x.leftToSendC - x.sharePaidC;
    return {
      playerId:   x.p.playerId,
      owedBack:   toDollars(x.owedBackC),
      cashShare:  toDollars(cashShareC),
      leftToSend: toDollars(x.leftToSendC),
      sharePaid:  toDollars(x.sharePaidC),
      refund:     toDollars(refundC),
      benefit:    toDollars(cashShareC + x.forgivenC),
      forgiven:   toDollars(x.forgivenC),
      choice:     x.p.onRoster ? x.p.choice : 'none',
      // SQUARE, and something went out — a paid row stops asking to be paid.
      // ⚠ Exactly zero, not "≤ zero". A family paid in full and THEN invoiced for something new
      // has a negative refund: they owe the team now. Calling that "settled" would put a Paid
      // badge on a debt for any reader that trusted the field name (today the row also checks
      // "owes" separately, but a contract that needs a second guard to be true is not a contract).
      settled:    refundC === 0 && (x.sharePaidC > 0 || toCents(x.p.paidOut) > 0),
    };
  });

  const totalRefundC  = rows.reduce((s, r) => s + toCents(r.refund), 0);
  const totalShareC   = rows.reduce((s, r) => s + toCents(r.cashShare), 0);
  const payableC      = rows.reduce((s, r) => s + Math.max(0, toCents(r.refund)), 0);
  // What the team can actually write cheques against today.
  const cashAvailableC = Math.max(0, cashHeldC - holdBackC);

  return {
    pot: {
      cashHeld:          toDollars(cashHeldC),
      duesReceived:      toDollars(duesReceivedC),
      fundraisingRaised: toDollars(fundraisingRaisedC),
      orgFunding:        toDollars(orgFundingC),
      recordedIn:        toDollars(recordedInC),
      cashOut:           toDollars(cashOutC),
      payoutsTotal:      toDollars(payoutsTotalC),
      owedBack:          toDollars(owedBackC),
      expectedIn:        toDollars(expectedInC),
      sharePaid:         toDollars(sharePaidC),
      holdBackCap:       toDollars(surplusBeforeHoldC),
      holdBack:          toDollars(holdBackC),
      surplus:           toDollars(surplusC),
      shortfall:         toDollars(shortfallC),
    },
    rows,
    totals: {
      owedBack:  toDollars(owedBackC),
      cashShare: toDollars(totalShareC),
      refund:    toDollars(totalRefundC),
      payable:   toDollars(payableC),
    },
    unallocated: toDollars(Math.max(0, remainingC)),
    awaitingCash: toDollars(Math.max(0, payableC - cashAvailableC)),
    /* ⚠ CARRIED THROUGH UNTOUCHED, and deliberately not converted to cents anywhere above: it is a
       COUNT of open conversations, not money. Nothing in the arithmetic reads it; only the close
       gate does. */
    pendingClubRequests: Math.max(0, Math.trunc(cash.pendingClubRequests ?? 0)),
  };
}

// ── The sheet as the SCREEN receives it ──────────────────────────────────────────────────────
// These shapes live here, with the arithmetic, rather than with the assembly next door: the
// assembly imports `server-only`, and the dues panel is a client component that needs to name
// what it is rendering. Same reason `lib/coach-money-summary.ts` exists.

/** Everything a row needs to be shown, opened, and paid — nothing re-derived in the browser. */
export interface SettlementSheetRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string | null;
  /** Off the season's-end roster ⇒ no even share, but their own money still follows them. */
  departed: boolean;
  owedBack: number;
  cashShare: number;
  leftToSend: number;
  refund: number;
  benefit: number;
  forgiven: number;
  choice: ShareChoice;
  /** The coach's own words on a hand-set amount. */
  choiceNote: string | null;
  settled: boolean;
  /** Cash already handed to this family, all season (rep_dues_payouts). */
  paidOut: number;
  /** Share money already in their hands — the part of their payouts beyond their credits. */
  sharePaid: number;
  /** The most that may be paid out on this row RIGHT NOW — the refund, never more. */
  payableNow: number;
  /** The day the last cheque went out, for a settled row's "Paid — Aug 14". */
  lastPaidDate: string | null;
  /** Which family this row belongs to; siblings share one key. */
  familyKey: string;
  /** The line-by-line story of this row's number. Sums to `refund`, to the cent. */
  breakdown: { label: string; detail: string | null; amount: number }[];
}

export interface SettlementFamily {
  key: string;
  /** "Okafor family" / "Noor and Owen" when guardian names are not this coach's to see. */
  label: string;
  playerIds: string[];
  /** Σ the family's refunds — what one cheque would be. */
  refund: number;
  payable: number;
}

export interface SettlementSheet extends Settlement {
  rows: SettlementSheetRow[];
  /**
   * Households: who is one family, what the household is owed, and what it is payable.
   *
   * ⚠ CURRENTLY READ BY NOTHING, and kept deliberately. The settlement sheet stopped naming who
   * shares a payment (owner ruling 2026-08-14) — combining cheques belongs to whatever screen
   * ISSUES payments, and that screen needs exactly this shape. It also carries the guardian-PII
   * capability seam (a coach without the grant gets players' own names), which is the part that
   * would be expensive to rebuild. Delete it if that screen never arrives.
   */
  families: SettlementFamily[];
  /** Planned season costs not yet spent. Not part of the arithmetic — but a coach reading this
   *  sheet in October is looking at cash the season still needs, and the card says so. */
  unspentPlan: number;
  /* ⚠ `clubMoneyUncounted` IS GONE (money redesign P3, 2026-08-17). It carried the amount of club
     money the pot could not honestly claim, and the sheet printed it as a warning, because those
     records had no season. Migration 247 gave them one, so the money is simply IN the pot now —
     `pot.orgFunding` — and a field whose only job was to apologise for an absence has nothing left
     to say. The warning line on the dues panel went with it. */
  notes: string | null;
  /** A finished season renders as a RECORD: the screen offers no payouts, no hold-back and no
   *  row menu. Set by the route from the season-read rail, absent on a write response. */
  readOnly?: boolean;
}

/**
 * What a season's expenses did to the books — the TWO figures, which are deliberately different
 * and have been confused before.
 *
 * `paid` is what the season COST and is what Budget vs. Actual compares against: a cost a family
 * covered directly is real spending and belongs in it. `cashPaid` is what actually LEFT THE
 * TEAM'S ACCOUNT and excludes those, because no team cash moved — counting them would subtract
 * money the team is still holding, and hand every family a smaller refund for a bill nobody sent
 * the team.
 *
 * Lives here because "what cash does the team hold" is the pot's own question. ⚠ THREE readers
 * hand-rolled this branch before it existed — the Money hub, the budget summary and (nearly) the
 * settlement pot — and they had already begun to differ: the budget summary had no notion of an
 * out-of-pocket cost at all. All three now call this, so the hub's cash line, the budget's spend
 * and the settlement pot cannot disagree about what left the team's account.
 */
export function expenseTotals(
  expenses: readonly {
    expenseType: 'expense' | 'tournament_payable';
    amount: number;
    expensePaidAt: string | null;
    depositAmount: number | null;
    depositPaidAt: string | null;
    balanceAmount: number | null;
    balancePaidAt: string | null;
    paidByPlayerId?: string | null;
  }[],
): { paid: number; cashPaid: number } {
  let paidC = 0;
  let cashPaidC = 0;
  for (const e of expenses) {
    if (e.expenseType === 'tournament_payable') {
      // A payable is billed to the team by a third party — there is no out-of-pocket leg.
      if (e.depositPaidAt) { paidC += toCents(e.depositAmount ?? 0); cashPaidC += toCents(e.depositAmount ?? 0); }
      if (e.balancePaidAt) { paidC += toCents(e.balanceAmount ?? 0); cashPaidC += toCents(e.balanceAmount ?? 0); }
    } else if (e.expensePaidAt) {
      paidC += toCents(e.amount);
      if (!e.paidByPlayerId) cashPaidC += toCents(e.amount);
    }
  }
  return { paid: toDollars(paidC), cashPaid: toDollars(cashPaidC) };
}

/**
 * Water-filling: the level `B` where topping every participant up to it spends exactly the pool.
 *
 *   Σ over participants of max(0, B − settled_i) = pool
 *
 * A family that already received $20 (forgiven) is topped up to the same level as everyone else,
 * so they take $20 less in cash; a family that received MORE than a share drops out of the split
 * entirely and their absence raises everyone else's level. One sentence, both outcomes, nothing
 * special-cased — which is exactly why the owner's $154.50 and $169.44 both fall out of it.
 *
 * Returns the largest integer-cent level whose cost does not exceed the pool; the caller lands
 * the few remaining cents on the last row.
 */
export function solveEvenLevel(settledCents: readonly number[], poolCents: number): number {
  if (settledCents.length === 0 || poolCents <= 0) return 0;
  const cost = (level: number) =>
    settledCents.reduce((s, settled) => s + Math.max(0, level - settled), 0);

  // The level can never exceed "everyone starts from zero and one person takes the lot".
  let lo = 0;
  let hi = poolCents + Math.max(...settledCents);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (cost(mid) <= poolCents) lo = mid; else hi = mid - 1;
  }
  return lo;
}
