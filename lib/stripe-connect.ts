import 'server-only';
import type Stripe from 'stripe';
import { getStripe } from './stripe';

/**
 * Every Stripe Connect call online payments make (Club Tier Stage 12). One module, so no route talks to Stripe directly
 * and the account shape ruled on 2026-10-25 (plan §0c) lives in one place.
 *
 * The account (ruled 2026-07-28 + 2026-10-25):
 *   - the club's OWN connected account; charges are DIRECT charges on it, so FieldLogicHQ never holds the money;
 *   - the Express Dashboard for the club (`controller.stripe_dashboard.type = 'express'`), Stripe collecting what it
 *     needs (`requirement_collection = 'stripe'`);
 *   - Stripe covers losses (`losses.payments = 'stripe'`) — with the Express Dashboard that is a public preview, so the
 *     account is created on the preview API version below; every other call stays on the repo's pinned version;
 *   - FieldLogicHQ pays Stripe's processing fee (`fees.payer = 'application'`, Stripe's "you handle pricing"), so the
 *     application fee is the whole all-in fee.
 * Stripe's legacy `type: 'express'` is NOT used: Stripe discourages direct charges on it.
 */
export const CONNECT_ACCOUNT_API_VERSION = '2026-09-30.preview';

/** The connected account to act on, as Stripe's request option. */
function on(accountId: string): Stripe.RequestOptions {
  return { stripeAccount: accountId };
}

export async function createClubAccount(args: {
  orgId: string;
  email: string | null;
  businessName: string;
}): Promise<Stripe.Account> {
  return getStripe().accounts.create(
    {
      country: 'CA',
      email: args.email ?? undefined,
      business_profile: { name: args.businessName },
      controller: {
        stripe_dashboard: { type: 'express' },
        fees: { payer: 'application' },
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
      },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { org_id: args.orgId },
    },
    { apiVersion: CONNECT_ACCOUNT_API_VERSION, idempotencyKey: `club-account:${args.orgId}` },
  );
}

/** Stripe's own onboarding, single use; the return URL never says whether it finished, so the caller re-reads. */
export async function onboardingLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: refreshUrl,
    return_url: returnUrl,
    collection_options: { fields: 'eventually_due' },
  });
  return link.url;
}

export async function retrieveAccount(accountId: string): Promise<Stripe.Account> {
  return getStripe().accounts.retrieve(accountId);
}

/** "Open Stripe": a single-use sign-in to the club's Express Dashboard. */
export async function dashboardLink(accountId: string): Promise<string> {
  const link = await getStripe().accounts.createLoginLink(accountId);
  return link.url;
}

/**
 * A Checkout Session on the club's account (a direct charge). Card only in 12a (L2); no saved cards (A3) — no customer is
 * created and nothing is set up for later use. `receipt_email` is never set: our receipt is the only one (Stripe sends
 * its own whenever that field is set).
 */
export async function createCheckout(args: {
  accountId: string;
  currency: 'cad';
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
      payment_method_types: ['card'],
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
    { expand: ['payment_intent.latest_charge'] },
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

/** The Connect webhook's signature check — its own secret, never the billing webhook's. */
export function connectWebhookSecret(): string | null {
  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || null;
}

export function constructConnectEvent(rawBody: string, signature: string, secret: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
