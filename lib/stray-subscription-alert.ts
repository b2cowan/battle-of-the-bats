import type Stripe from 'stripe';
import type { PlatformEventInput } from './platform-events';
import { formatCents } from './console-money';
import { planLabel } from './platform-labels';
import { stripeDashboardBase } from './stripe-mode';

/**
 * A SECOND SUBSCRIPTION THAT SLIPS THROUGH (On-sale pages S4 Part 4, call 45, owner 2026-11-21; Part 4 asks 2026-11-22).
 *
 * The record follows one subscription (`recordFollowsSubscription`). When a second paying one arrives on the same customer —
 * two tabs pressed in the same seconds, the case the second-press refusal cannot catch — the webhook leaves the record on
 * the first and calls this. The owner hears of it ONCE per stray subscription, by email to the admin inbox (never through
 * the error alert's hourly bucket, which unrelated errors could empty), and the club's Story in the support console shows
 * it. Nothing is cancelled or refunded here: staff cancel it in Stripe and refund its charge from our admin by hand.
 *
 * ONCE: keyed on the stray subscription's id, never the event's, because one stray subscription reaches the branch from
 * its `created`, its `updated`s and Stripe's re-sends. The platform event is the durable "told" mark and is written only
 * AFTER the email went, so a failed send leaves nothing marked and the next delivery tells again. A send that fails, or a
 * "told?" read that fails, THROWS: the webhook answers 500 and Stripe sends the event again (the branch changes nothing on
 * the record, so a retry is harmless) — a stray charge is money the owner must hand back, so its alarm is never dropped.
 * Two deliveries racing past the read share the mail service's once-only key (24 hours), so they send one email.
 */

export interface StraySubscriptionDeps {
  /** Has this stray subscription already been told? Throws when it cannot be read. */
  alreadyTold: (key: string) => Promise<boolean>;
  /**
   * The stray subscription as Stripe holds it NOW (a retried or late event's payload can be days old, and staff may already
   * have cancelled it); null when Stripe no longer has it. Throws when Stripe cannot be asked, so the event is sent again.
   */
  current: (sub: Stripe.Subscription) => Promise<Stripe.Subscription | null>;
  /** What the stray subscription's latest invoice took, when Stripe answers; null when it cannot be read or there is none. */
  latestInvoice: (sub: Stripe.Subscription) => Promise<{ number: string | null; amountPaidCents: number; totalCents: number; currency: string; status: string | null } | null>;
  /** The admin-inbox email under the once-only key: 'sent', 'skipped' (no mail key, a dev machine) or 'failed'. */
  send: (alert: { subject: string; html: string; key: string }) => Promise<'sent' | 'skipped' | 'failed'>;
  record: (event: PlatformEventInput) => Promise<void>;
  live: () => boolean;
  siteUrl: string;
}

export interface StraySubscription {
  sub: Stripe.Subscription;
  org: { id: string; name: string };
  /** The subscription the record keeps following. */
  onFileId: string;
  /** The plan the stray subscription is for (its price's plan). */
  planId: string;
  customerId: string;
}

export const straySubscriptionKey = (subscriptionId: string) => `${subscriptionId}:second_subscription`;

/** A short fingerprint of the email's words (FNV-1a, 32 bits): not security, only "the same words". */
function wordsHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "$219.00 a month before tax": the subscription's own price, from Stripe's payload; null when it carries none. */
export function strayChargeWords(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const cents = typeof item?.price?.unit_amount === 'number' ? item.price.unit_amount * (item.quantity ?? 1) : null;
  if (cents === null) return null;
  const interval = item?.price?.recurring?.interval;
  return `${formatCents(cents, item?.price?.currency ?? 'cad')}${interval ? ` a ${interval}` : ''} before tax`;
}

/** The states a stray subscription bills in (`PAYING_STATUSES`; the "Setting up" wait counts the same ones). */
const BILLING_STATES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due']);

/** Tell the owner of a stray subscription, once. Returns whether this call told them. */
export async function tellOwnerOfStraySubscription(input: StraySubscription, deps: StraySubscriptionDeps): Promise<boolean> {
  const { org, onFileId, planId, customerId } = input;
  // A mock subscription is a test fixture's, never a charge.
  if (input.sub.id.startsWith('mock_') || onFileId.startsWith('mock_') || input.sub.id === onFileId) return false;
  // Only one that bills (/review 2026-11-22): an `incomplete` one (a card step left halfway) has charged nothing and is not
  // marked, so the update that makes it active tells. Judged on Stripe's answer now, not the event's copy.
  if (!BILLING_STATES.has(input.sub.status)) return false;
  const key = straySubscriptionKey(input.sub.id);
  if (await deps.alreadyTold(key)) return false;
  const sub = await deps.current(input.sub);
  if (!sub || !BILLING_STATES.has(sub.status)) return false;

  const invoice = await deps.latestInvoice(sub).catch(() => null);
  const plan = planLabel(planId);
  const price = strayChargeWords(sub);
  const paid = !!invoice && invoice.amountPaidCents > 0;
  const invoiceName = invoice?.number ? `invoice ${invoice.number}` : 'its latest invoice';
  const charged = invoice
    ? paid
      ? `${formatCents(invoice.amountPaidCents, invoice.currency)} paid on ${invoiceName} (the whole invoice, with any tax)`
      : sub.status === 'trialing'
        ? 'nothing yet: it is in its free trial, and charges when the trial ends'
        : `nothing (${invoiceName} is ${invoice.status ?? 'open'}${invoice.totalCents > 0 ? `, ${formatCents(invoice.totalCents, invoice.currency)} with tax` : ''})`
    : 'not read from Stripe; open the subscription to see it';
  const dashboard = stripeDashboardBase(deps.live());
  const rows: Array<[string, string]> = [
    ['Plan', plan],
    ['The stray subscription', `${sub.id} (${sub.status})`],
    ['The subscription the club stays on', onFileId],
    ['It charges', price ?? 'its price was not in Stripe’s message'],
    ['Charged so far', charged],
  ];
  // /accounting + /billing 2026-11-22: Stripe's own cancel can refund or credit unused time, which would bypass the credit note
  // (the tax record) or quietly discount the club's next real invoice; and the refund must be the STRAY invoice's charge
  // (both are usually the same price). Nothing charged: nothing to refund; an open invoice is voided, never refunded.
  const refundStep = paid
    ? `<li>Refund the charge for ${esc(invoiceName)} from the club’s Money tab in our admin (not the other subscription’s charge), so the credit note gives the tax back.</li>`
    : invoice
      ? '<li>It has charged nothing, so there is nothing to refund. If its invoice is still open, void it in Stripe.</li>'
      : '<li>If it charged anything, refund that charge from the club’s Money tab in our admin (not the other subscription’s charge), so the credit note gives the tax back.</li>';
  const subject = `A second subscription slipped through: ${org.name}`;
  const html = `<p>${esc(org.name)} now has a second subscription on its Stripe customer. Our record stays on the first one, so the club pays twice until the second one is stopped.</p>`
    + `<ul>${rows.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join('')}</ul>`
    + '<p>Nothing has been cancelled or refunded. To put it right:</p>'
    + '<ol><li>Cancel the stray subscription in Stripe, immediately. In Stripe’s cancel window leave the refund of the last payment and any credit for unused time off.</li>'
    + `${refundStep}</ol>`
    + '<p>Until it is cancelled, a press to start another plan on the club’s Plan &amp; billing is refused, and the page says a plan is still being set up, then that it is taking longer than usual. Moving or cancelling its own plan still works.</p>'
    + `<p><a href="${esc(`${deps.siteUrl}/platform-admin/orgs/${org.id}`)}">Open the club’s record</a> &middot; `
    + `<a href="${esc(`${dashboard}/subscriptions/${encodeURIComponent(sub.id)}`)}">Open the stray subscription in Stripe</a></p>`;

  // The mail service's once-only key names these exact words (/review 2026-11-22): a key reused with different words (a later
  // delivery read a since-paid invoice) is refused for 24 hours, which would fail the event over and over. The same words send
  // once; different words may send a second email, never none. The "told" mark is what stops later deliveries.
  const sent = await deps.send({ subject, html, key: `${key}:${wordsHash(subject + html)}` });
  // A live send that "skipped" (no mail key) left nothing in an inbox: the same as a failure, never marked told.
  if (sent === 'failed' || (sent === 'skipped' && deps.live())) {
    throw new Error(`The owner could not be told of the stray subscription ${sub.id}; Stripe will send the event again`);
  }

  await deps.record({
    eventType: 'second_subscription', source: 'stripe', sourceEventId: key, orgId: org.id, planId, subscriptionStatus: sub.status,
    metadata: {
      straySubscriptionId: sub.id, onFileSubscriptionId: onFileId, stripeCustomerId: customerId,
      ...(price ? { price } : {}),
      ...(invoice ? { amountPaidCents: invoice.amountPaidCents, currency: invoice.currency } : {}),
    },
  });
  return true;
}
