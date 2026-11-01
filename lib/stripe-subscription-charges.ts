import type Stripe from 'stripe';
import type { PlatformEventInput, PlatformEventType } from './platform-events';
import { formatCents } from './console-money';
import { formatStoredDate } from './timezone';

/**
 * Disputes and refunds on OUR subscription charges (Plans & pricing Stage 0, Part 4, S9). The billing webhook hands these
 * four events here BEFORE its customer-less early return: a dispute's object names a charge, never a customer.
 *
 * Every one is resolved by re-reading the charge from Stripe → the invoice its payment paid → that invoice's subscription
 * → the club. A charge that paid no subscription invoice (a club's own Stripe-fees invoice, a one-off made in the
 * dashboard, anything else) is not ours to act on: the event's row says `not_ours` and nothing else happens. Family
 * payments never arrive here at all: they are direct charges on each club's connected account (lib/stripe-connect.ts),
 * so their disputes reach the Connect webhook.
 *
 * What happens to ours: a platform event on the club's record (the Story) and an email to the owner's inbox.
 * ⚖ NOTHING IS SUSPENDED OR FLAGGED. Whether a dispute should touch the account is the owner's call and is not ruled;
 * this records and tells, nothing more.
 */

export const SUBSCRIPTION_CHARGE_EVENT_TYPES = [
  'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed', 'charge.refunded',
] as const;
export type SubscriptionChargeEventType = (typeof SUBSCRIPTION_CHARGE_EVENT_TYPES)[number];

export function isSubscriptionChargeEvent(type: string): type is SubscriptionChargeEventType {
  return (SUBSCRIPTION_CHARGE_EVENT_TYPES as readonly string[]).includes(type);
}

const PLATFORM_EVENT: Record<SubscriptionChargeEventType, PlatformEventType> = {
  'charge.dispute.created': 'subscription_charge_disputed',
  'charge.dispute.updated': 'subscription_dispute_updated',
  'charge.dispute.closed': 'subscription_dispute_closed',
  'charge.refunded': 'subscription_charge_refunded',
};

export type ChargeOwner = { orgId: string; orgName: string; teamWorkspaceId: string | null };

export type OwnerAlert = { subject: string; html: string; idempotencyKey: string };

export type SubscriptionChargeDeps = {
  /** The charge as Stripe has it now, its refunds expanded. A failed read throws (500, Stripe retries). */
  retrieveCharge(id: string): Promise<Stripe.Charge>;
  /** The invoice a payment paid, or null when it paid none. */
  invoiceForPaymentIntent(paymentIntentId: string): Promise<Stripe.Invoice | null>;
  /** The club a subscription bills (or, once it has ended, the one club holding its customer). Null when none is found. */
  ownerOf(subscriptionId: string, customerId: string | null): Promise<ChargeOwner | null>;
  /** The Stripe refund ids our support console made on a charge (its refunds already have their own Story row). */
  consoleRefundIds(chargeId: string): Promise<Set<string>>;
  writeEvent(input: PlatformEventInput): Promise<void>;
  alertOwner(alert: OwnerAlert): Promise<void>;
  live(): boolean;
  siteUrl: string;
};

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === 'string' ? value : value?.id ?? null;

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Stripe's reason codes in plain words ("product_not_received" → "Product not received"). */
export function disputeReasonWords(reason: string | null | undefined): string {
  if (!reason) return 'No reason given';
  const words = reason.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Where a dispute stands, in plain words. `won` / `lost` are the two closings. */
export function disputeStatusWords(status: string | null | undefined): string {
  switch (status) {
    case 'warning_needs_response':
    case 'needs_response': return 'Needs a response';
    case 'warning_under_review':
    case 'under_review': return 'Under review by the bank';
    case 'warning_closed': return 'Closed (inquiry only)';
    case 'won': return 'Won';
    case 'lost': return 'Lost';
    case 'prevented': return 'Prevented';
    default: return status ? disputeReasonWords(status) : 'Unknown';
  }
}

export type SubscriptionChargeOutcome = 'processed' | 'not_ours';

/**
 * Runs one dispute or refund event. `not_ours`: the charge paid no subscription invoice, so nothing was written.
 * Throws on a failed Stripe or database read, so the webhook answers 500 and Stripe sends it again; a retry writes the
 * event once (keyed on Stripe's event id) and the email once (the mail service's once-only key is the event id).
 */
export async function handleSubscriptionChargeEvent(
  event: Stripe.Event,
  deps: SubscriptionChargeDeps,
): Promise<SubscriptionChargeOutcome> {
  const type = event.type as SubscriptionChargeEventType;
  const dispute = type === 'charge.refunded' ? null : (event.data.object as Stripe.Dispute);
  const chargeId = dispute ? idOf(dispute.charge) : (event.data.object as Stripe.Charge).id;
  if (!chargeId) return 'not_ours';

  const charge = await deps.retrieveCharge(chargeId);
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return 'not_ours';
  const invoice = await deps.invoiceForPaymentIntent(paymentIntentId);
  const subscriptionId = idOf(invoice?.parent?.subscription_details?.subscription ?? null);
  if (!invoice || !subscriptionId) return 'not_ours';

  const customerId = idOf(charge.customer as string | { id: string } | null);
  const owner = await deps.ownerOf(subscriptionId, customerId);

  // A refund made in our own console already has its Story row ("Refunded"); this one only says what happened in Stripe.
  const latestRefund = type === 'charge.refunded'
    ? [...(charge.refunds?.data ?? [])].sort((a, b) => b.created - a.created)[0] ?? null
    : null;
  const fromConsole = latestRefund ? (await deps.consoleRefundIds(charge.id)).has(latestRefund.id) : false;

  const eventType = PLATFORM_EVENT[type];
  await deps.writeEvent({
    eventType,
    source: 'stripe',
    sourceEventId: `${event.id}:${eventType}`,
    orgId: owner?.orgId ?? null,
    metadata: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      invoiceId: invoice.id,
      chargeId: charge.id,
      amountCents: charge.amount,
      currency: charge.currency,
      ...(dispute ? {
        disputeId: dispute.id,
        disputeAmountCents: dispute.amount,
        reason: dispute.reason,
        status: dispute.status,
        evidenceDueBy: iso(dispute.evidence_details?.due_by),
      } : {}),
      ...(latestRefund ? {
        refundId: latestRefund.id,
        refundCents: latestRefund.amount,
        refundedTotalCents: charge.amount_refunded,
        fromConsole,
      } : {}),
      ...(owner?.teamWorkspaceId ? { teamWorkspaceId: owner.teamWorkspaceId } : {}),
    },
  });

  // An update (evidence sent, the bank's review moving on) is on the record; the owner hears of the opening and the end.
  if (type === 'charge.dispute.updated') return 'processed';
  await deps.alertOwner(ownerAlert({ type, event, charge, dispute, latestRefund, fromConsole, owner, customerId, deps }));
  return 'processed';
}

function ownerAlert(p: {
  type: SubscriptionChargeEventType;
  event: Stripe.Event;
  charge: Stripe.Charge;
  dispute: Stripe.Dispute | null;
  latestRefund: Stripe.Refund | null;
  fromConsole: boolean;
  owner: ChargeOwner | null;
  customerId: string | null;
  deps: Pick<SubscriptionChargeDeps, 'live' | 'siteUrl'>;
}): OwnerAlert {
  const { type, charge, dispute, latestRefund, owner } = p;
  const club = owner?.orgName ?? 'A customer we could not match to a club';
  const amount = formatCents(charge.amount, charge.currency);
  const dashboard = `https://dashboard.stripe.com${p.deps.live() ? '' : '/test'}`;
  const links = [
    owner ? `<a href="${esc(`${p.deps.siteUrl}/platform-admin/orgs/${owner.orgId}`)}">Open the club's record</a>` : null,
    dispute
      ? `<a href="${esc(`${dashboard}/disputes/${dispute.id}`)}">Open the dispute in Stripe</a>`
      : `<a href="${esc(`${dashboard}/payments/${idOf(charge.payment_intent) ?? charge.id}`)}">Open the payment in Stripe</a>`,
  ].filter(Boolean).join(' &middot; ');
  const unmatched = owner ? '' : `<p>Stripe customer: ${esc(p.customerId ?? 'none')}</p>`;
  const nothingChanged = '<p>Nothing on the account has been changed.</p>';
  const rows = (items: Array<[string, string]>) =>
    `<ul>${items.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join('')}</ul>`;

  let subject: string;
  let body: string;
  if (type === 'charge.dispute.created' && dispute) {
    subject = `Dispute: ${club}, ${amount} subscription charge`;
    body = `<p>${esc(club)} disputed a subscription charge with their bank.</p>`
      + rows([
        ['Amount disputed', formatCents(dispute.amount, dispute.currency)],
        ['Reason', disputeReasonWords(dispute.reason)],
        ['Where it stands', disputeStatusWords(dispute.status)],
        ['Evidence due', dispute.evidence_details?.due_by ? formatStoredDate(iso(dispute.evidence_details.due_by), { longMonth: true }) : 'No date given'],
      ])
      + `${nothingChanged}<p>Whether the account should be flagged or suspended is not decided; this email only tells you.</p>`;
  } else if (type === 'charge.dispute.closed' && dispute) {
    const result = disputeStatusWords(dispute.status);
    subject = `Dispute closed (${result}): ${club}`;
    body = `<p>The dispute on a ${esc(amount)} subscription charge to ${esc(club)} is closed.</p>`
      + rows([['Result', result], ['Reason it was opened', disputeReasonWords(dispute.reason)]])
      + nothingChanged;
  } else {
    const refund = latestRefund ? formatCents(latestRefund.amount, latestRefund.currency) : formatCents(charge.amount_refunded, charge.currency);
    subject = `Refund: ${refund} of a subscription charge to ${club}`;
    body = `<p>${esc(refund)} of a ${esc(amount)} subscription charge to ${esc(club)} was refunded${p.fromConsole ? ' from our support console' : ' in Stripe'}.</p>`
      + rows([['Refunded on this charge so far', formatCents(charge.amount_refunded, charge.currency)]])
      + nothingChanged;
  }

  return { subject, html: `${body}${unmatched}<p>${links}</p>`, idempotencyKey: `billing-charge-alert:${p.event.id}` };
}
