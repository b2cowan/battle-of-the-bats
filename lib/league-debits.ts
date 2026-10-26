/**
 * A HOUSE-LEAGUE CHILD'S BANK DEBIT, AS THE DESK READS IT (Club Tier Stage 12c Part 6; words §3.1). Pure, so the Fee cell,
 * the row's menu, the ending window and the tests read one shape. Only the newest payment that touched the child counts:
 * a debit returned, then paid by card, no longer speaks.
 */
export interface RegDebit {
  /** clearing — on its way (not received); returned — came back before it cleared (owing); reversed — the bank took it
   *  back after it cleared (owing again, a returned line in the book). */
  state: 'clearing' | 'returned' | 'reversed';
  onlinePaymentId: string;
  itemId: string;
  /** The whole debit (every child on it, and the fee when the family paid it). */
  totalCents: number;
  /** This child's registration fee on it. */
  shareCents: number;
  /** This child's part of the processing fee (what A2's box gives back). */
  feeShareCents: number;
  familyPaysFee: boolean;
  last4: string | null;
  startedAt: string | null;
  returnedAt: string | null;
  reversedAt: string | null;
  /** One of the four mapped reasons, or null (unmapped prints no reason). */
  reason: string | null;
  receiptNo: number | null;
  /** The other children on the same debit, by first name (siblings clear and come back together). */
  siblings: string[];
  /** 12c Part 6: what happens when it clears, answered when the registration ended while it was clearing. */
  decision: { choice: 'send_back' | 'keep'; feeBack: boolean; reason: string | null } | null;
}

export const isClearing = (d: RegDebit | null | undefined): d is RegDebit => d?.state === 'clearing';
