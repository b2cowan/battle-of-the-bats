/**
 * WHICH DEBTS A PAYBACK SETTLES (owner ruling R5, 2026-09-07; migration 281).
 *
 * ⚠⚠ THE COACH SELECTS, THE SERVER SUMS. Owner: *"if we don't let reimbursements be free to select
 * their amounts but actually make them select the ones we owe and calculate the sum ourselves, we
 * can ensure that link exists."* So the amount is NOT an input to be trusted and re-checked — it is
 * an OUTPUT of the selection. A client that sends a number gets it ignored; a client that sends a
 * number that disagrees gets refused, because a disagreement means the two sides are looking at
 * different credits and the honest answer is to stop.
 *
 * ⚠⚠ WHY THE LINK HAD TO EXIST AT ALL. Before 281 a payout carried no reference to the credit it
 * refunded, so every reader assumed the allocation — and the product held TWO assumptions.
 * `splitFamilyOwnMoney` lands a refund on the family's own money first and says so at the line; a
 * second reader adopted oldest-first, and on the UAT fixture that sent $37.50 of Casey's cash into
 * the fundraising line of a panel a coach can open while the dues screen said the reverse. Totals
 * agreed either way. Only the story differed, and only where a coach could read it.
 *
 * ⚠ WHOLE CREDITS ONLY, and it is a ruling rather than a limitation: *"they could not partially pay
 * back 1 debt, they can wholely pay back 1 or more than 1 debt."* One cheque may settle several
 * debts; half a debt is not a thing a coach can express. `rep_dues_payout_credits.amount` still
 * records the figure, so lifting this later is a screen change and not a second migration.
 *
 * Pure: no IO, no React, no Date.
 */

function toCents(n: number): number { return Math.round(n * 100); }
function toDollars(c: number): number { return c / 100; }

/** A credit as the selection needs to see it. */
export interface SelectableCredit {
  id: string;
  amount: number;
  /** 'fundraiser' | 'contribution' | 'overpayment' | 'other' | 'reimbursement' | 'forgiven' */
  creditType: string;
  /** How much of this credit earlier paybacks have already settled. */
  alreadyPaidBack: number;
}

export interface PaybackSelection {
  /** The credits this payback settles, with what it takes off each. */
  links: Array<{ creditId: string; amount: number }>;
  /** What the payback is worth — the SUM, computed here and never taken from the client. */
  amount: number;
}

/** The refusal codes a client may branch on. */
export const PAYBACK_NO_SELECTION = 'PAYBACK_NO_SELECTION';
export const PAYBACK_UNKNOWN_CREDIT = 'PAYBACK_UNKNOWN_CREDIT';
export const PAYBACK_CREDIT_NOT_PAYABLE = 'PAYBACK_CREDIT_NOT_PAYABLE';
export const PAYBACK_ALREADY_SETTLED = 'PAYBACK_ALREADY_SETTLED';
export const PAYBACK_AMOUNT_DISAGREES = 'PAYBACK_AMOUNT_DISAGREES';

export interface PaybackRefusal { code: string; message: string }

/**
 * Turn a coach's tick-list into the rows to write, or the reason it cannot be done.
 *
 * @param available every credit this family holds, with what has already been handed back
 * @param creditIds what the coach ticked
 * @param claimedAmount what the client thinks the total is — checked, never used
 */
export function selectPayback(
  available: readonly SelectableCredit[],
  creditIds: readonly string[],
  claimedAmount?: number,
): { ok: PaybackSelection } | { refused: PaybackRefusal } {
  if (creditIds.length === 0) {
    return { refused: { code: PAYBACK_NO_SELECTION, message: 'Pick at least one thing to pay back.' } };
  }

  /* ⚠ DE-DUPLICATED BEFORE ANYTHING ELSE. The unique index on (payout, credit) would refuse a
     repeated id with a database error; a coach who somehow sent one deserves the same answer as
     one who ticked it once, not a 500. */
  const wanted = [...new Set(creditIds)];
  const byId = new Map(available.map(c => [c.id, c]));
  const links: Array<{ creditId: string; amount: number }> = [];
  let totalC = 0;

  for (const id of wanted) {
    const credit = byId.get(id);
    if (!credit) {
      return {
        refused: {
          code: PAYBACK_UNKNOWN_CREDIT,
          message: 'One of those credits is no longer on this family — reload and try again.',
        },
      };
    }
    /* ⚠ FORGIVENESS CAN NEVER BE PAID OUT, and this is the second door that says so. A forgiven
       balance is debt relief the team GAVE, never money it HOLDS — paying it out would invent a
       debt and hand a family cash twice. `payoutCeiling` excludes it from the total; this excludes
       it from the list, so the two cannot disagree about what is payable. */
    if (credit.creditType === 'forgiven') {
      return {
        refused: {
          code: PAYBACK_CREDIT_NOT_PAYABLE,
          message: 'A forgiven balance is not the family’s money, so it cannot be paid back.',
        },
      };
    }
    const standingC = toCents(credit.amount) - toCents(credit.alreadyPaidBack);
    if (standingC <= 0) {
      return {
        refused: {
          code: PAYBACK_ALREADY_SETTLED,
          message: 'One of those has already been paid back — reload and try again.',
        },
      };
    }
    /* WHOLE CREDITS ONLY (R5). What is left standing IS the amount; there is no partial to express.
       A credit part-settled by a legacy payout still pays back what remains, which is the only
       reading that lets pre-281 rows coexist with the rule. */
    links.push({ creditId: id, amount: toDollars(standingC) });
    totalC += standingC;
  }

  /* ⚠ THE CLAIMED AMOUNT IS A CHECK, NOT A SOURCE. If it disagrees, the two sides are looking at
     different credits — a stale screen, most likely — and writing either figure would be a guess.
     Refuse and let the coach reload. */
  if (claimedAmount !== undefined && toCents(claimedAmount) !== totalC) {
    return {
      refused: {
        code: PAYBACK_AMOUNT_DISAGREES,
        message: 'What you picked adds up differently now — reload and try again.',
      },
    };
  }

  return { ok: { links, amount: toDollars(totalC) } };
}
