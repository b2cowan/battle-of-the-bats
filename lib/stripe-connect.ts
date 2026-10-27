import 'server-only';
import type Stripe from 'stripe';
import { getStripe } from './stripe';
import type { StripeProfile } from './online-payment-profile';

/**
 * Every Stripe Connect call online payments make (Club Tier Stage 12). One module, so no route talks to Stripe directly
 * and the account shape ruled on 2026-10-25 (plan §0c, §0d) lives in one place.
 *
 * The account (ruled 2026-07-28 + 2026-10-25), on Stripe's Accounts v2 (owner 2026-10-25, plan §0d — Stripe refuses v1
 * account creation for new platforms, and the "Accounts v1 support" toggle stays OFF):
 *   - the club's OWN connected account, a merchant; charges are DIRECT charges on it, so FieldLogicHQ never holds the
 *     money;
 *   - the Express Dashboard for the club (`dashboard: 'express'`), Stripe collecting what it needs (derived on v2:
 *     `requirements_collector` comes back `stripe`);
 *   - Stripe covers losses (`losses_collector: 'stripe'`) — with the Express Dashboard that is a public preview, so the
 *     account is CREATED on the preview API version below;
 *   - FieldLogicHQ pays Stripe's processing fee (`fees_collector: 'application'`, Stripe's "you handle pricing"), so the
 *     application fee is the whole all-in fee.
 * ⚠ The preview version is for account creation ONLY. Every other call stays on the repo's pinned version
 * (`lib/stripe.ts`): the two disagree on the onboarding link's body (probe 2026-10-25, plan §0d).
 */
export const CONNECT_ACCOUNT_API_VERSION = '2026-09-30.preview';

/** What a v2 account read includes: the rule reads the merchant capability, the country and the requirements. */
const ACCOUNT_INCLUDE: Stripe.V2.Core.AccountRetrieveParams['include'] = ['configuration.merchant', 'identity', 'requirements'];

/** The connected account to act on, as Stripe's request option. */
function on(accountId: string): Stripe.RequestOptions {
  return { stripeAccount: accountId };
}

export async function createClubAccount(args: {
  orgId: string;
  email: string | null;
  businessName: string;
}): Promise<Stripe.V2.Core.Account> {
  return getStripe().v2.core.accounts.create(
    {
      contact_email: args.email ?? undefined,
      display_name: args.businessName,
      identity: { country: 'ca' },
      dashboard: 'express',
      defaults: {
        currency: 'cad',
        responsibilities: { fees_collector: 'application', losses_collector: 'stripe' },
      },
      // 12c: bank debit (Canadian pre-authorized debit) beside the card; the pay block offers it once Stripe turns it on.
      configuration: { merchant: { capabilities: { card_payments: { requested: true }, acss_debit_payments: { requested: true } } } },
      metadata: { org_id: args.orgId },
    },
    { apiVersion: CONNECT_ACCOUNT_API_VERSION, idempotencyKey: `club-account:${args.orgId}` },
  );
}

/**
 * Hand Stripe's sign-up what it would otherwise ask the club (`lib/online-payment-profile.ts`), before the first onboarding
 * link. A SEPARATE call from the creation, on purpose (/review 2026-10-25): the creation keeps one fixed body under its
 * idempotency key, so a retried Set up payouts never meets a body that changed with the club's site; and nothing here can
 * block setting up payouts. A website Stripe refuses is tried again as the description alone; any other failure leaves the
 * question to Stripe's form, as before this existed.
 */
export async function prefillClubProfile(accountId: string, profile: StripeProfile): Promise<void> {
  // Stripe's rule: the website when there is one, the description only when there is not.
  const send = (p: { business_url?: string; product_description?: string }) => getStripe().v2.core.accounts.update(accountId, { defaults: { profile: p } });
  try {
    await send(profile.businessUrl ? { business_url: profile.businessUrl } : { product_description: profile.productDescription });
  } catch (first) {
    console.warn('[stripe-connect] Stripe refused the filled-in profile:', (first as Error).message);
    if (!profile.businessUrl) return;
    try {
      await send({ product_description: profile.productDescription });
    } catch (second) {
      console.warn('[stripe-connect] Stripe refused the description too; the club answers in Stripe:', (second as Error).message);
    }
  }
}

/**
 * Stripe's own onboarding, single use; the return URL never says whether it finished, so the caller re-reads. Collects
 * what Stripe will eventually need as well as what is due now, so the club fills the form once.
 */
export async function onboardingLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
  const link = await getStripe().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['merchant'],
        refresh_url: refreshUrl,
        return_url: returnUrl,
        collection_options: { fields: 'eventually_due' },
      },
    },
  });
  return link.url;
}

/**
 * 12c: ask Stripe to turn bank debit on for an account that has card payments (an account made before 12c). On the pinned
 * version (sandbox probe 2026-10-26: accepted, and the capability then reads "pending").
 */
export async function requestBankDebit(accountId: string): Promise<void> {
  await getStripe().v2.core.accounts.update(
    accountId,
    { configuration: { merchant: { capabilities: { acss_debit_payments: { requested: true } } } } },
    { idempotencyKey: `bank-debit:${accountId}` },
  );
}

export async function retrieveAccount(accountId: string): Promise<Stripe.V2.Core.Account> {
  return getStripe().v2.core.accounts.retrieve(accountId, { include: ACCOUNT_INCLUDE });
}

/** "Open Stripe": a single-use sign-in to the club's Express Dashboard. */
export async function dashboardLink(accountId: string): Promise<string> {
  const link = await getStripe().accounts.createLoginLink(accountId);
  return link.url;
}

/**
 * A Checkout Session on the club's account (a direct charge). No saved cards (A3) — no customer is created and nothing is
 * set up for later use. `receipt_email` is never set: our receipt is the only one (Stripe sends its own whenever that field
 * is set). 12c: `rail` 'bank_debit' opens a Canadian pre-authorized debit (`acss_debit`) instead of the card: one-off
 * ("sporadic") on a personal account, verified by the family signing in to their bank only (owner §0k 3 — no micro-deposit
 * wait), the agreement shown and accepted on Stripe's own page. The rail is one per session: its fee differs.
 */
export async function createCheckout(args: {
  accountId: string;
  currency: 'cad';
  rail?: 'card' | 'bank_debit';
  lines: { name: string; amountCents: number }[];
  applicationFeeCents: number;
  payerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  description: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
}): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: [args.rail === 'bank_debit' ? 'acss_debit' : 'card'],
      ...(args.rail === 'bank_debit' ? {
        payment_method_options: {
          acss_debit: {
            mandate_options: { payment_schedule: 'sporadic', transaction_type: 'personal' },
            verification_method: 'instant',
          },
        },
      } : {}),
      line_items: args.lines.map((l) => ({
        quantity: 1,
        price_data: { currency: args.currency, unit_amount: l.amountCents, product_data: { name: l.name } },
      })),
      customer_email: args.payerEmail ?? undefined,
      customer_creation: 'if_required',
      payment_intent_data: {
        application_fee_amount: args.applicationFeeCents,
        description: args.description,
        metadata: args.metadata,
      },
      metadata: args.metadata,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    },
    { ...on(args.accountId), idempotencyKey: args.idempotencyKey },
  );
}

export async function retrieveCheckout(accountId: string, sessionId: string): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(
    sessionId,
    { expand: ['payment_intent.latest_charge', 'payment_intent.payment_method'] },
    on(accountId),
  );
}

export async function expireCheckout(accountId: string, sessionId: string): Promise<void> {
  try {
    await getStripe().checkout.sessions.expire(sessionId, {}, on(accountId));
  } catch {
    // Already complete or expired: nothing to stop.
  }
}

/**
 * A full refund to the card (12a, A12). The payer gets `amountCents` back out of the club's balance: the base, plus the
 * processing fee when the organizer includes it (A2's box). FieldLogicHQ's application fee is NEVER refunded — Stripe
 * keeps its own fee on a refund, and FieldLogicHQ keeps its (owner, 2026-10-25, plan §0c) — so `refund_application_fee`
 * is deliberately absent. Idempotent on our refund's own id.
 */
export async function refundToCard(args: {
  accountId: string;
  paymentIntentId: string;
  amountCents: number;
  refundId: string;
  metadata: Record<string, string>;
}): Promise<Stripe.Refund> {
  return getStripe().refunds.create(
    { payment_intent: args.paymentIntentId, amount: args.amountCents, metadata: args.metadata },
    { ...on(args.accountId), idempotencyKey: `refund:${args.refundId}` },
  );
}

/** One refund at Stripe, read when a person answers "whose was it?" (its status decides pending or refunded). */
export async function retrieveRefund(accountId: string, refundId: string): Promise<Stripe.Refund> {
  return getStripe().refunds.retrieve(refundId, {}, on(accountId));
}

/** A dispute on the club's account (12d-1), read fresh on every event: Stripe's events state no order. Its balance
 *  transactions (always included) say what Stripe took from the club's balance and the fee it charged there. */
export async function retrieveDispute(accountId: string, disputeId: string): Promise<Stripe.Dispute> {
  return getStripe().disputes.retrieve(disputeId, {}, on(accountId));
}

/** A payment's refunds at Stripe (12c): a refund made in Stripe before its payment landed here is recorded once it lands. */
export async function listRefunds(accountId: string, paymentIntentId: string): Promise<Stripe.Refund[]> {
  const page = await getStripe().refunds.list({ payment_intent: paymentIntentId, limit: 100 }, on(accountId));
  return page.data;
}

/** One page of the club's payouts arriving in a window of Stripe days (12d-2, the Payouts tab), newest first, with the
 *  bank account each went to. Read only. */
export async function listPayoutsPage(accountId: string, arrival: { gte: number; lte: number }, startingAfter?: string): Promise<Stripe.ApiList<Stripe.Payout>> {
  return getStripe().payouts.list(
    { limit: 100, arrival_date: arrival, expand: ['data.destination'], ...(startingAfter ? { starting_after: startingAfter } : {}) },
    on(accountId),
  );
}

/** One page of what is inside an AUTOMATIC payout (12d-2): Stripe lists contents for automatic payouts only. Each line's
 *  source is expanded one level, so a refund or a dispute names its charge. Read only. */
export async function listPayoutLinesPage(accountId: string, payoutId: string, startingAfter?: string): Promise<Stripe.ApiList<Stripe.BalanceTransaction>> {
  return getStripe().balanceTransactions.list(
    { payout: payoutId, limit: 100, expand: ['data.source'], ...(startingAfter ? { starting_after: startingAfter } : {}) },
    on(accountId),
  );
}

/**
 * The two Connect webhooks, each with its own signing secret — never the billing webhook's (plan §0d):
 *   - the PAYMENTS webhook: v1 snapshot events from clubs' connected accounts (checkout, refunds);
 *   - the ACCOUNT webhook: v2 thin events from FieldLogicHQ's own account about the clubs' v2 accounts.
 */
export function connectWebhookSecret(): string | null {
  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || null;
}

export function constructConnectEvent(rawBody: string, signature: string, secret: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

export function connectAccountWebhookSecret(): string | null {
  return process.env.STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET?.trim() || null;
}

/** A thin event carries no account data: the caller fetches the account (`retrieveAccount`), so order never matters. */
export function parseAccountEvent(rawBody: string, signature: string, secret: string): Stripe.V2.Core.EventNotification {
  return getStripe().parseEventNotification(rawBody, signature, secret);
}
