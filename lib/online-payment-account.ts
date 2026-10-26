/**
 * A club's payouts account, as the Payouts card reads it (Club Tier Stage 12a, drawn 12a §1). Pure: no database, no
 * Stripe — the facts come from `org_payment_accounts`, which the return from Stripe's onboarding and the account-events
 * webhook keep current. ONE rule turns them into the card's five states, and every surface (the card, the treasurer's
 * line, the quiet line, the pay block, Needs attention) reads it rather than its own reading of the facts.
 *
 * The facts are Stripe's Accounts v2 (owner 2026-10-25, plan §0d; mig 364): the merchant configuration's card_payments
 * capability, the requirement entries still waiting on the club, and when Stripe's sign-up was first seen finished.
 */
import type { OnlineFeePayer } from './online-payment-fee';

export type PayoutsState = 'not_set_up' | 'setting_up' | 'taking_payments' | 'needs_attention' | 'disconnected';

/** Stripe v2's card_payments capability status. */
export type CardPaymentsStatus = 'active' | 'pending' | 'restricted' | 'unsupported';
const CARD_PAYMENTS_STATUSES: readonly CardPaymentsStatus[] = ['active', 'pending', 'restricted', 'unsupported'];

/** The stored facts (a row of `org_payment_accounts`, camelCased). `null` = the club never started. */
export interface PayoutsAccountFacts {
  stripeAccountId: string;
  livemode: boolean;
  /** `null` until the first sync. */
  cardPayments: CardPaymentsStatus | null;
  /** The capability's first status-detail code; `null` while active. */
  cardPaymentsReason: string | null;
  /** When Stripe's sign-up was first seen finished — set once, kept (v1's `details_submitted`). */
  onboardingFinishedAt: string | null;
  /** What Stripe is waiting on the club for, due now or past due (the entries' descriptions). */
  requirementsDue: string[];
  /** When what is due becomes past due, ISO. */
  requirementsDeadline: string | null;
  feePayer: OnlineFeePayer;
  refundPolicy: string | null;
  disconnectedAt: string | null;
  /** 12c (mig 386): Stripe's `acss_debit_payments` capability — a Canadian pre-authorized debit. `null` = not read yet. */
  bankDebit?: CardPaymentsStatus | null;
}

/**
 * Stripe is still working through what it was given — the club has nothing to do but wait. No reason at all right after
 * onboarding (not yet active, nothing due) is the same wait, never "needs attention" (review 2026-10-25, M3).
 */
function waitingOnStripe(a: PayoutsAccountFacts): boolean {
  if (a.cardPayments === 'pending') return true;
  if (a.cardPayments === 'unsupported') return false; // Stripe will not turn it on by itself: the club must act

  const reason = a.cardPaymentsReason;
  return !reason || reason === 'requirements_pending_verification' || reason === 'determining_status';
}

/**
 * The card's state. "Needs attention" means the club has something to DO: Stripe lists something due, or has turned
 * card payments off for a reason that is not a wait. Payouts held while payments work is Stripe's matter, not a state.
 */
export function payoutsState(a: PayoutsAccountFacts | null): PayoutsState {
  if (!a) return 'not_set_up';
  if (a.disconnectedAt) return 'disconnected';
  if (a.cardPayments === 'active') return a.requirementsDue.length > 0 ? 'needs_attention' : 'taking_payments';
  if (!a.onboardingFinishedAt) return 'setting_up';
  return a.requirementsDue.length === 0 && waitingOnStripe(a) ? 'setting_up' : 'needs_attention';
}

/**
 * Whether a pay page may open now. Stripe's own capability decides, never the card's word: an account with a deadline
 * still takes payments until the deadline passes. A disconnected club takes none (A1: Disconnect stops new payments).
 */
export function takesPayments(a: PayoutsAccountFacts | null): boolean {
  return !!a && !a.disconnectedAt && a.cardPayments === 'active';
}

/** 12c: the pay block offers bank debit beside the card only while the account takes payments AND bank debit is on. */
export function takesBankDebit(a: PayoutsAccountFacts | null): boolean {
  return takesPayments(a) && a!.bankDebit === 'active';
}

/** The Needs attention item is up exactly while the card says "needs attention"; it clears itself when that ends. */
export function payoutsNeedAttention(a: PayoutsAccountFacts | null): boolean {
  return payoutsState(a) === 'needs_attention';
}

/** The columns every reader of the account selects, and their mapping back to the facts the rule takes. */
export const PAYOUTS_ACCOUNT_COLUMNS =
  'org_id, stripe_account_id, livemode, card_payments_status, card_payments_reason, onboarding_finished_at, requirements_due, requirements_deadline, fee_payer, refund_policy, disconnected_at, bank_debit_status';

export interface PayoutsAccountRow {
  org_id: string;
  stripe_account_id: string;
  livemode: boolean;
  card_payments_status: CardPaymentsStatus | null;
  card_payments_reason: string | null;
  onboarding_finished_at: string | null;
  requirements_due: string[] | null;
  requirements_deadline: string | null;
  fee_payer: OnlineFeePayer;
  refund_policy: string | null;
  disconnected_at: string | null;
  bank_debit_status?: CardPaymentsStatus | null;
}

export function factsFromRow(r: PayoutsAccountRow | null | undefined): PayoutsAccountFacts | null {
  if (!r) return null;
  return {
    stripeAccountId: r.stripe_account_id,
    livemode: r.livemode,
    cardPayments: r.card_payments_status,
    cardPaymentsReason: r.card_payments_reason,
    onboardingFinishedAt: r.onboarding_finished_at,
    requirementsDue: r.requirements_due ?? [],
    requirementsDeadline: r.requirements_deadline,
    feePayer: r.fee_payer,
    refundPolicy: r.refund_policy,
    disconnectedAt: r.disconnected_at,
    bankDebit: r.bank_debit_status ?? null,
  };
}

/**
 * Stripe's v2 account object, the part the rule reads (retrieved with `include: configuration.merchant, identity,
 * requirements`). A structural subset of the SDK's `Stripe.V2.Core.Account`, so a test can build one by hand. Kept beside
 * the rule so a new Stripe field is read in one place.
 */
export interface StripeAccountLike {
  id: string;
  closed?: boolean;
  identity?: { country?: string | null } | null;
  configuration?: {
    merchant?: {
      capabilities?: {
        card_payments?: { status: string; status_details?: { code: string }[] | null } | null;
        acss_debit_payments?: { status: string; status_details?: { code: string }[] | null } | null;
      } | null;
    } | null;
  } | null;
  requirements?: {
    entries?: {
      awaiting_action_from: string;
      description: string;
      errors?: { code: string }[] | null;
      minimum_deadline: { status: string };
      requested_reasons?: { code: string }[] | null;
    }[] | null;
    summary?: { minimum_deadline?: { status: string; time?: string | null } | null } | null;
  } | null;
}

/**
 * Stripe's v2 account → the stored columns, plus two facts the sync acts on rather than stores as they come:
 * `onboardingFinished` (stamped once into `onboarding_finished_at`) and `closed` (a Disconnect, A1).
 *
 * Sign-up is unfinished while Stripe still lists ANYTHING it asks for at sign-up (`routine_onboarding`, at any deadline —
 * the link collects eventually-due items too) that the club has not given it. An entry with an error against it is
 * something the club gave and Stripe refused — that is "needs attention", not an unfinished form. Erring strict is
 * deliberate (review 2026-10-25): a stamp written too early is permanent and would raise "Stripe needs something"
 * mid-sign-up, while a stamp written late only keeps the card on "Setting up", whose button is the same.
 *
 * A part of the account that did not come back on the read writes nothing: one short read must never switch an
 * account's payments off, or empty what Stripe is waiting for. Neither part read → never called finished.
 */
export function factsFromStripe(acct: StripeAccountLike) {
  const card = acct.configuration?.merchant?.capabilities?.card_payments ?? null;
  const status = card && (CARD_PAYMENTS_STATUSES as readonly string[]).includes(card.status) ? card.status as CardPaymentsStatus : null;
  // 12c: bank debit, read the same way (only when the merchant part came back, so a short read never switches it off).
  const merchant = acct.configuration?.merchant ?? null;
  const bank = merchant?.capabilities?.acss_debit_payments ?? null;
  const bankStatus = bank && (CARD_PAYMENTS_STATUSES as readonly string[]).includes(bank.status) ? bank.status as CardPaymentsStatus : null;
  const requirements = acct.requirements ?? null;
  const fromClub = (requirements?.entries ?? []).filter(e => e.awaiting_action_from === 'user');
  const dueNow = fromClub.filter(e => e.minimum_deadline.status === 'currently_due' || e.minimum_deadline.status === 'past_due');
  const signUpOpen = fromClub.some(e =>
    (e.requested_reasons ?? []).some(r => r.code === 'routine_onboarding') && !(e.errors ?? []).length);
  const deadline = requirements?.summary?.minimum_deadline;
  return {
    columns: {
      stripe_account_id: acct.id,
      ...(acct.identity?.country ? { country: acct.identity.country.toUpperCase() } : {}),
      ...(card ? {
        card_payments_status: status,
        card_payments_reason: status === 'active' ? null : card.status_details?.[0]?.code ?? null,
      } : {}),
      ...(merchant?.capabilities ? { bank_debit_status: bankStatus } : {}),
      ...(requirements ? {
        requirements_due: [...new Set(dueNow.map(e => e.description))].sort(),
        requirements_deadline: deadline?.status === 'currently_due' && deadline.time ? new Date(deadline.time).toISOString() : null,
      } : {}),
    },
    onboardingFinished: status !== null && requirements !== null && !signUpOpen,
    closed: acct.closed === true,
    /** Card payments are on and bank debit was never asked for: the sync asks Stripe for it (12c). */
    bankDebitToRequest: status === 'active' && !!merchant?.capabilities && !bank,
  };
}

/** Where the Payouts card lives (A8): the club's Settings on League and Club, its own page under tournament Settings &
 *  access on a Tournament plan. One home for the path, read by links in the browser and by the server's notices. */
export function payoutsPath(org: { slug: string; planId: string }): string {
  return org.planId === 'tournament' || org.planId === 'tournament_plus'
    ? `/${org.slug}/admin/tournaments/settings/payouts`
    : `/${org.slug}/admin/org/settings#payouts`;
}
