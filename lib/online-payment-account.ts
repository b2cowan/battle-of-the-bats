/**
 * A club's payouts account, as the Payouts card reads it (Club Tier Stage 12a, drawn 12a §1). Pure: no database, no
 * Stripe — the facts come from `org_payment_accounts`, which the return from Stripe's onboarding and the
 * `account.updated` webhook keep current. ONE rule turns them into the card's five states, and every surface (the card,
 * the treasurer's line, the quiet line, the pay block, Needs attention) reads it rather than its own reading of the flags.
 */
import type { OnlineFeePayer } from './online-payment-fee';

export type PayoutsState = 'not_set_up' | 'setting_up' | 'taking_payments' | 'needs_attention' | 'disconnected';

/** The stored facts (a row of `org_payment_accounts`, camelCased). `null` = the club never started. */
export interface PayoutsAccountFacts {
  stripeAccountId: string;
  livemode: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** Stripe's currently_due ∪ past_due: what it still needs. */
  requirementsDue: string[];
  disabledReason: string | null;
  /** Stripe's current_deadline for what is due, ISO. */
  requirementsDeadline: string | null;
  feePayer: OnlineFeePayer;
  refundPolicy: string | null;
  disconnectedAt: string | null;
}

/**
 * Stripe is still working through what it was given — the club has nothing to do but wait. No reason at all right after
 * onboarding (charges not yet on, nothing due) is the same wait, never "needs attention" (review 2026-10-25, M3).
 */
function waitingOnStripe(reason: string | null): boolean {
  return !reason || reason === 'requirements.pending_verification' || reason === 'under_review';
}

/**
 * The card's state. "Needs attention" means the club has something to DO: Stripe lists something due, or has turned
 * payments off for a reason that is not a wait. Payouts held while payments work is Stripe's matter, not a state.
 */
export function payoutsState(a: PayoutsAccountFacts | null): PayoutsState {
  if (!a) return 'not_set_up';
  if (a.disconnectedAt) return 'disconnected';
  if (a.chargesEnabled) return a.requirementsDue.length > 0 ? 'needs_attention' : 'taking_payments';
  if (!a.detailsSubmitted) return 'setting_up';
  return a.requirementsDue.length === 0 && waitingOnStripe(a.disabledReason) ? 'setting_up' : 'needs_attention';
}

/**
 * Whether a pay page may open now. Stripe's own flag decides, never the card's word: an account with a deadline still
 * takes payments until the deadline passes. A disconnected club takes none (A1: Disconnect stops new payments).
 */
export function takesPayments(a: PayoutsAccountFacts | null): boolean {
  return !!a && !a.disconnectedAt && a.chargesEnabled;
}

/** The Needs attention item is up exactly while the card says "needs attention"; it clears itself when that ends. */
export function payoutsNeedAttention(a: PayoutsAccountFacts | null): boolean {
  return payoutsState(a) === 'needs_attention';
}

/** The columns every reader of the account selects, and their mapping back to the facts the rule takes. */
export const PAYOUTS_ACCOUNT_COLUMNS =
  'org_id, stripe_account_id, livemode, charges_enabled, payouts_enabled, details_submitted, requirements_due, disabled_reason, requirements_deadline, fee_payer, refund_policy, disconnected_at';

export interface PayoutsAccountRow {
  org_id: string;
  stripe_account_id: string;
  livemode: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due: string[] | null;
  disabled_reason: string | null;
  requirements_deadline: string | null;
  fee_payer: OnlineFeePayer;
  refund_policy: string | null;
  disconnected_at: string | null;
}

export function factsFromRow(r: PayoutsAccountRow | null | undefined): PayoutsAccountFacts | null {
  if (!r) return null;
  return {
    stripeAccountId: r.stripe_account_id,
    livemode: r.livemode,
    chargesEnabled: r.charges_enabled,
    payoutsEnabled: r.payouts_enabled,
    detailsSubmitted: r.details_submitted,
    requirementsDue: r.requirements_due ?? [],
    disabledReason: r.disabled_reason,
    requirementsDeadline: r.requirements_deadline,
    feePayer: r.fee_payer,
    refundPolicy: r.refund_policy,
    disconnectedAt: r.disconnected_at,
  };
}

/** Stripe's account object → the stored facts. Kept beside the rule so a new Stripe field is read in one place. */
export interface StripeAccountLike {
  id: string;
  livemode?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    disabled_reason?: string | null;
    current_deadline?: number | null;
  } | null;
}

export function factsFromStripe(acct: StripeAccountLike) {
  const due = new Set([...(acct.requirements?.currently_due ?? []), ...(acct.requirements?.past_due ?? [])]);
  const deadline = acct.requirements?.current_deadline;
  return {
    stripe_account_id: acct.id,
    livemode: !!acct.livemode,
    charges_enabled: !!acct.charges_enabled,
    payouts_enabled: !!acct.payouts_enabled,
    details_submitted: !!acct.details_submitted,
    requirements_due: [...due].sort(),
    disabled_reason: acct.requirements?.disabled_reason ?? null,
    requirements_deadline: deadline ? new Date(deadline * 1000).toISOString() : null,
  };
}
