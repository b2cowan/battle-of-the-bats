/**
 * The billing webhook's handler: everything that runs ONE verified, claimed Stripe billing event (moved out of
 * app/api/billing/webhook/route.ts by Plans & pricing Stage 2 Part 1, a pure move, so the replay of a stored event can call
 * the same function the webhook does. A Next.js route file may export nothing but its verbs and config).
 *
 * The route keeps the signature check and `receiveBillingEvent` (mode, claim, outcome, lib/stripe-billing-events.ts); this file
 * is `runVerifiedBillingEvent`, "the seam", and the plan's own work behind it. It writes our records and reads Stripe live.
 */
import { stripe } from '@/lib/stripe';
import { PLAN_CONFIG, type BillingCycle } from '@/lib/plan-config';
import { getPlanFromPriceId } from '@/lib/stripe-prices';
import { restoreRetainedDowngradeTournaments } from '@/lib/billing-retention';
import { endingForDeletedSubscription, recordStripeSignal } from '@/lib/plan-ending';
import { endingAccountForSubscription, endingDeps, readEndingAccount, readPendingEnding, withdrawPendingEnding } from '@/lib/plan-ending-server';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { isPastDueTransition, isRecoveryTransition, writeGrowthEvent, writePlatformEvent } from '@/lib/platform-events';
import {
  provisionTeamWorkspaceFromCheckoutMetadata,
  syncTeamWorkspaceSubscription,
} from '@/lib/team-checkout';
import { completeOrgTeamAddonBillingFromMetadata } from '@/lib/team-org-billing';
import {
  recordCardOnFile, clearCardOnFileIfNoCardsLeft, recordNextSeasonChoice,
  clearNextSeasonChoice, orgIdForNextSeasonSubscription,
} from '@/lib/billing-setup';
import { NEXT_SEASON_CHOICE_KIND, classifyNextSeasonSubscription } from '@/lib/next-season-choice';
import { recordCardCountry } from '@/lib/billing-location-server';
import { PLAN_RANK } from '@/lib/plan-features';
import { applyPlanChangeSideEffects } from '@/lib/plan-move';
import { isInAppUpMove } from '@/lib/plan-growth';
import { clubNameFromMetadata } from '@/lib/workspace-upgrade';
import { restoreAfterReactivation } from '@/lib/billing-reactivation';
import { trialEndingHtml, welcomeBackHtml, SITE_URL, ADMIN_EMAIL, sendEmail, escapeHtml } from '@/lib/email';
import { stripeDashboardBase, stripeKeyIsLive } from '@/lib/stripe-mode';
import {
  handleSubscriptionChargeEvent, isSubscriptionChargeEvent, type SubscriptionChargeDeps,
} from '@/lib/stripe-subscription-charges';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { cancelScheduledEmail } from '@/lib/email-sender';
import { notify } from '@/lib/notify';
import { syncFeeInvoiceFromEvent } from '@/lib/platform-stripe-fees';
import { FEE_INVOICE_META } from '@/lib/online-payment-words';
import { CHARGE_TAX_CREDIT_NOTE_EVENTS, CHARGE_TAX_INVOICE_EVENTS } from '@/lib/charge-tax-record';
import { orgOfSubscription, recordCreditNoteTax, recordInvoiceRefunded, recordInvoiceTax, recordTaxOrReport } from '@/lib/charge-tax-record-server';
import { buyerNameAfterCheckout } from '@/lib/billing-tax';
import { orgOwnerUserIds } from '@/lib/notify-recipients';
import { clearSettled } from '@/lib/needs-attention';
import type { OrgPlan } from '@/lib/types';
import type Stripe from 'stripe';
import {
  invoiceFailureIsCurrent, isTheRecordsSubscription, recordFollowsSubscription, statusAfterInvoicePaid, subscriptionAmount,
  subscriptionEventIsStale, subscriptionIsPaying,
} from '@/lib/stripe-billing-state';
import type { BillingEventOutcome } from '@/lib/stripe-billing-events';
import { customerSenders, type RunOptions } from '@/lib/billing-event-customer-messages';
import { getBillingHref, billingUrlOrgFromRow } from '@/lib/billing-urls';


function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

/** Stripe expandable references arrive as either a plain id string or an expanded object. */
function stripeId<T extends { id: string }>(value: string | T | null | undefined): string | null {
  return typeof value === 'string' ? value : value?.id ?? null;
}

/**
 * When a paid invoice's subscription period ends: the latest end among its lines. ⚠ NEVER `invoice.period_end` — that is
 * the invoice's own window, and on a subscription's first (or any renewal) invoice it is the moment the invoice was made,
 * so it stored today's date as the "renewal" of a brand-new annual plan (2026-10-30).
 */
function invoicePeriodEnd(invoice: Stripe.Invoice): string | null {
  const ends = (invoice.lines?.data ?? []).map(l => l.period?.end ?? 0);
  return toIso(ends.length ? Math.max(...ends) : null);
}

function subscriptionIdFromSession(session: Stripe.Checkout.Session): string | null {
  return stripeId(session.subscription);
}

function subscriptionItemId(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.id ?? null;
}

async function cancelPriorTeamSubscription(subscriptionId: string | null | undefined, newSubscriptionId: string | null | undefined) {
  if (!subscriptionId || subscriptionId === newSubscriptionId || !subscriptionId.startsWith('sub_')) return;
  // The club's subscription replaces this one: a waiting cancel on it is withdrawn, or its deletion would end the portal.
  await withdrawPendingEnding({ subscriptionId }, 'Replaced by the club’s subscription');
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('[billing webhook] could not cancel prior Coaches Portal subscription:', error);
  }
}

/**
 * Stage 0 (S9): what the dispute and refund handler reads and writes. The club a subscription bills: the organization on
 * it, else the Coaches Portal on it (its paying club, else its own workspace), else, once it has ended and been cleared
 * from the record, the ONE organization holding its customer (a shared customer names no club).
 */
function subscriptionChargeDeps(): SubscriptionChargeDeps {
  const orgName = async (id: string) => {
    const { data, error } = await supabaseAdmin.from('organizations').select('name').eq('id', id).maybeSingle();
    if (error) throw new Error(`Couldn't read the club: ${error.message}`);
    return (data as { name: string } | null)?.name ?? 'A club';
  };
  return {
    retrieveCharge: id => stripe.charges.retrieve(id, { expand: ['refunds'] }),
    recordRefunded: (invoiceId, refundedCents) =>
      recordTaxOrReport({ kind: 'invoice', id: invoiceId }, () => recordInvoiceRefunded(invoiceId, refundedCents)),
    async invoiceForPaymentIntent(paymentIntent) {
      const res = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntent }, limit: 1, expand: ['data.invoice'] });
      const inv = res.data[0]?.invoice;
      return inv && typeof inv !== 'string' && !('deleted' in inv && inv.deleted) ? inv as Stripe.Invoice : null;
    },
    // GST/HST Stage 3: the ONE owner rule, shared with the tax record, so a charge's alert and its record name the same club.
    async ownerOf(subscriptionId, customerId) {
      const owner = await orgOfSubscription(subscriptionId, customerId);
      return owner ? { ...owner, orgName: await orgName(owner.orgId) } : null;
    },
    async consoleRefundIds(chargeId) {
      const { data, error } = await supabaseAdmin.from('platform_refunds').select('stripe_refund_id').eq('stripe_charge_id', chargeId);
      if (error) throw new Error(`Couldn't read the console's refunds: ${error.message}`);
      return new Set(((data ?? []) as Array<{ stripe_refund_id: string | null }>).map(r => r.stripe_refund_id).filter((v): v is string => !!v));
    },
    writeEvent: writePlatformEvent,
    alertOwner: ({ subject, html, idempotencyKey }) => alertOwner('subscription_charge_alert', subject, html, idempotencyKey),
    live: () => stripeKeyIsLive(),
    siteUrl: SITE_URL,
  };
}

/**
 * An email to the owner's inbox about our own billing (Stage 0). Not gated to production like the error alert: these are
 * rare and the owner tests them in test mode. A failed send is logged, never a 500: the platform event is the record, the
 * email the alarm. The once-only key keeps a retried event from sending twice.
 */
async function alertOwner(kind: 'subscription_charge_alert' | 'unrecognised_price_alert' | 'buyer_name_alert', subject: string, html: string, idempotencyKey: string) {
  const result = await sendEmail(ADMIN_EMAIL, subject, html, { kind, idempotencyKey })
    .catch(error => { console.error('[billing webhook] the owner alert could not be sent:', error); return null; });
  if (result && result.status === 'provider_error') console.error('[billing webhook] the owner alert was refused:', subject);
}

/**
 * Stage 0 (fix 1): what a Coaches Portal's subscription charges, onto the record that follows it. The portal paths write
 * the plan in lib/team-checkout.ts; this writes the amount after them, matched on the subscription id, so only a record
 * that follows this subscription gets it (a club-paid portal's record holds none, and is never written).
 */
async function recordSubscriptionAmount(sub: Stripe.Subscription) {
  const { error } = await supabaseAdmin.from('organizations').update(subscriptionAmount(sub)).eq('stripe_subscription_id', sub.id);
  if (error) throw new Error(`Couldn't record what the subscription charges: ${error.message}`);
}

/** Stage 0 (fix 2): a subscription on a price we know nothing of. Keyed on the subscription and the day, so once a day. */
async function tellOwnerOfUnrecognisedPrice(sub: Stripe.Subscription, priceId: string, customerId: string) {
  // utc-intentional: a dedupe key, not a calendar answer; any fixed day boundary gives "at most once a day".
  const key = `${sub.id}:unrecognised_price:${new Date().toISOString().slice(0, 10)}`;
  console.warn(`[billing webhook] ${sub.id} is on ${priceId}, a price no slot has ever used: the record was not changed`);
  const { data: org } = await supabaseAdmin.from('organizations').select('id, name')
    .eq('stripe_customer_id', customerId).limit(1).maybeSingle();
  await writePlatformEvent({
    eventType: 'unrecognised_price', source: 'stripe', sourceEventId: key, orgId: org?.id ?? null, subscriptionStatus: sub.status,
    metadata: { priceId, stripeSubscriptionId: sub.id, stripeCustomerId: customerId },
  });
  const club = org?.name ?? 'A customer we could not match to a club';
  const dashboard = stripeDashboardBase();
  await alertOwner('unrecognised_price_alert', `A subscription is on a price we do not know: ${club}`,
    `<p>${escapeHtml(club)} has a subscription on a Stripe price that no plan slot has ever used, so our record of their plan was not changed.</p>`
      + `<ul><li>Price: ${escapeHtml(priceId)}</li><li>Subscription: ${escapeHtml(sub.id)} (${escapeHtml(sub.status)})</li></ul>`
      + '<p>Nothing on the account has been changed. Either put the price in a plan slot, or move the subscription to a known price in Stripe.</p>'
      + `<p>${org ? `<a href="${SITE_URL}/platform-admin/orgs/${org.id}">Open the club's record</a> &middot; ` : ''}`
      + `<a href="${dashboard}/subscriptions/${encodeURIComponent(sub.id)}">Open the subscription in Stripe</a></p>`,
    key);
}

/**
 * GST/HST Stage 2 Part 6b Part 3 (owner 2026-11-05): after a subscription Checkout, the club's name goes back on its Stripe
 * customer unless the buyer typed a business name on Stripe's page (`buyerNameAfterCheckout` decides). Read fresh, one update.
 * ⚠ NEVER throws: the name is not money, and a 500 would make Stripe re-send the whole event (the plan's record with it). But
 * nothing later repairs a miss (`buyerNameUpdate` reads the cardholder's name as the buyer's own), so a failure is told the way
 * an unrecognised price is: a log line, a platform event and an email to the owner, once per session.
 */
async function restoreBuyerName(session: Stripe.Checkout.Session, customerId: string) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) return;
    const naming = buyerNameAfterCheckout(session, customer as Stripe.Customer);
    if (naming) await stripe.customers.update(customerId, naming);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[billing webhook] ${session.id}: the club's name could not be put back on ${customerId}:`, error);
    try {
      const key = `${session.id}:buyer_name_not_restored`;
      const orgId = session.metadata?.orgId ?? null;
      await writePlatformEvent({
        eventType: 'buyer_name_not_restored', source: 'stripe', sourceEventId: key, orgId,
        metadata: { stripeCheckoutSessionId: session.id, stripeCustomerId: customerId, error: message },
      });
      await alertOwner('buyer_name_alert', 'A club’s name was not put back on its Stripe customer',
        '<p>After a Checkout, the club’s name could not be put back on its Stripe customer, so its later invoices may name the person who paid.</p>'
          + `<ul><li>Customer: ${escapeHtml(customerId)}</li><li>Checkout session: ${escapeHtml(session.id)}</li><li>Stripe said: ${escapeHtml(message)}</li></ul>`
          + '<p>Nothing else was changed. Put the club’s name on the customer in Stripe (the name stored under fieldlogic_buyer_name in its metadata).</p>'
          + `<p>${orgId ? `<a href="${SITE_URL}/platform-admin/orgs/${encodeURIComponent(orgId)}">Open the club's record</a> &middot; ` : ''}`
          + `<a href="${stripeDashboardBase()}/customers/${encodeURIComponent(customerId)}">Open the customer in Stripe</a></p>`,
        key);
    } catch (tellError) {
      console.error('[billing webhook] the name failure could not be recorded:', tellError);
    }
  }
}

/** The subscription an invoice bills, when it bills one (a one-off invoice made in Stripe's dashboard bills none). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return stripeId(invoice.parent?.subscription_details?.subscription ?? null);
}

/**
 * THE SEAM (Plans & pricing Stage 0, S5): runs one verified, claimed billing event. The POST above reaches it through
 * `receiveBillingEvent`, which has already refused the other Stripe mode and a replay; a later replay of a stored event
 * (Stage 2) and Plans end at renewal's webhook work build on this one function. Throwing is the failure answer: the event's
 * row keeps the error, the webhook answers 500 and Stripe sends it again.
 *
 * `opts.replay` (Stage 2 Part 5, a staff replay of a stored event) sends no message to a customer and changes nothing else; a live
 * delivery passes nothing. Every customer message below goes through `customerSenders` (`billing-event-replay.test.ts` guards it).
 */
export async function runVerifiedBillingEvent(event: Stripe.Event, customerId: string | null, opts: RunOptions = {}): Promise<BillingEventOutcome> {
  // Stage 0 (S9): a dispute names no customer, so these are resolved through their charge BEFORE the early return below.
  if (isSubscriptionChargeEvent(event.type)) return handleSubscriptionChargeEvent(event, subscriptionChargeDeps());

  // GST/HST Stage 3 Part 1: every invoice we issue and every credit note keeps its tax record. A credit note has no plan work.
  // An invoice's record is written AFTER the plan's own work, whatever that work answered (a club's Stripe-fees invoice, a
  // stray subscription's invoice and a coach's own Premium are all recorded), so a club's plan never waits on our bookkeeping.
  // Reported, never thrown (the daily job's catch-up writes a record that failed here). A throw in the plan work skips it:
  // Stripe sends the event again.
  if ((CHARGE_TAX_CREDIT_NOTE_EVENTS as readonly string[]).includes(event.type)) {
    const noteId = (event.data.object as Stripe.CreditNote).id;
    await recordTaxOrReport({ kind: 'credit_note', id: noteId }, () => recordCreditNoteTax(noteId));
    return 'processed';
  }
  const outcome = await runPlanWork(event, customerId, opts);
  if ((CHARGE_TAX_INVOICE_EVENTS as readonly string[]).includes(event.type)) {
    const invoiceId = (event.data.object as Stripe.Invoice).id;
    if (invoiceId) await recordTaxOrReport({ kind: 'invoice', id: invoiceId }, () => recordInvoiceTax(invoiceId));
  }
  return outcome;
}

/** The plan's own work for one verified billing event (everything but the tax record above). */
async function runPlanWork(event: Stripe.Event, customerId: string | null, opts: RunOptions): Promise<BillingEventOutcome> {
  if (!customerId) return 'no_customer';
  // The customer's messages (emails and the in-app notice): silent on a replay (owner ruling 1, 2026-11-08).
  const say = customerSenders({ email: sendTransactionalEmail, notify }, opts);

  // 12d-1 Part 4: a club's own invoice of Stripe fees is written to its own row and NOTHING else. Read before the switch,
  // because the invoice cases below would read its payment as the subscription's (a comped club with no subscription would
  // turn "active", and a failed fee payment "past due").
  if (event.type.startsWith('invoice.') && (event.data.object as Stripe.Invoice).metadata?.[FEE_INVOICE_META]) {
    await syncFeeInvoiceFromEvent(event.data.object as Stripe.Invoice);
    return 'processed';
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Founding Season card-on-file (mode='setup'): no subscription exists — the
      // session only saved a payment method. Promote it to the customer's default
      // so the end-of-Founding-Season conversion (September 2027) can charge it, and defensively persist
      // stripe_customer_id on the org. Nothing is billed here. The Stripe chain and
      // the org update are independent — run them concurrently.
      if (session.mode === 'setup') {
        const setupIntentId = stripeId(session.setup_intent);
        const setupOrgId = session.metadata?.orgId;
        await Promise.all([
          (async () => {
            if (!setupIntentId) return;
            // Expanded, so the card's brand and last4 arrive with the SetupIntent — otherwise
            // recording the card below would fetch back the payment method we already have.
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
              expand: ['payment_method'],
            });
            const paymentMethod = typeof setupIntent.payment_method === 'object'
              ? setupIntent.payment_method
              : null;
            const paymentMethodId = stripeId(setupIntent.payment_method);
            if (paymentMethodId) {
              await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
              });
            }
            // ⚠ Record the card as a FACT ON THE ACCOUNT (mig 283). Until now this lived only in
            // Stripe, so "who still has no card?" — the question the September 2027 conversion runs
            // on — could not be asked of the database at all. Never derived from stripe_customer_id:
            // comp reactivation and subscription deletion both NULL that column.
            await recordCardOnFile({
              customerId,
              paymentMethod,
              paymentMethodId,
              fallbackOrgId: setupOrgId ?? null,
            });
          })(),
          setupOrgId
            ? supabaseAdmin
                .from('organizations')
                .update({ stripe_customer_id: customerId })
                .eq('id', setupOrgId)
                .is('stripe_customer_id', null)
            : Promise.resolve(),
        ]);
        break;
      }

      // GST/HST Stage 2 Part 6b Part 3: every subscription Checkout (A club, B coach Premium, C Founding next-season) puts our
      // name back over the cardholder's. ⚠ HERE, before the arms below: the next-season and standalone_team arms `break` early,
      // so a call placed after them never runs for paths C and B. Never throws (build guard: billing-buyer-name-path-guard).
      if (session.mode === 'subscription') await restoreBuyerName(session, customerId);

      // The next-season plan choice (Founding Season: the 2028 choice). Recorded from the SESSION as
      // well as from the subscription event, because the two arrive independently and the desk must
      // never show "no choice yet" for an account that has just made one.
      if (session.metadata?.choiceKind === NEXT_SEASON_CHOICE_KIND && session.metadata.orgId) {
        await recordNextSeasonChoice({
          orgId: session.metadata.orgId,
          planKey: session.metadata.planKey ?? '',
          billingCycle: session.metadata.billingCycle ?? 'annual',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionIdFromSession(session),
          teamWorkspaceId: session.metadata.teamWorkspaceId ?? null,
        });
        break;
      }

      // RETIRING (Club Repackaging 2026-06-22): org_team_addon checkouts are no longer
      // initiated (the takeover is retired). Kept only to settle any in-flight pre-cutover
      // session — 0 exist in dev/prod. Remove this arm post-cutover.
      if (session.metadata?.checkoutKind === 'org_team_addon') {
        const subscriptionId = subscriptionIdFromSession(session);
        const sub = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;

        const result = await completeOrgTeamAddonBillingFromMetadata({
          metadata: session.metadata,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionItemId: sub ? subscriptionItemId(sub) : null,
          subscriptionStatus: sub?.status ?? 'active',
          currentPeriodEnd: sub ? toIso(sub.items?.data?.[0]?.current_period_end) : null,
          sourceEventId: `${event.id}:org_team_addon_completed`,
        });
        if (result.ok) {
          await cancelPriorTeamSubscription(result.previousTeamSubscriptionId, subscriptionId);
        }
        break;
      }

      if (session.metadata?.checkoutKind === 'standalone_team') {
        const subscriptionId = subscriptionIdFromSession(session);
        const sub = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;

        await provisionTeamWorkspaceFromCheckoutMetadata({
          metadata: session.metadata,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionItemId: sub ? subscriptionItemId(sub) : null,
          subscriptionStatus: sub?.status ?? 'active',
          billingCycle: session.metadata.billingCycle ?? null,
          currentPeriodEnd: sub ? toIso(sub.items?.data?.[0]?.current_period_end) : null,
          eventSource: 'stripe',
          sourceEventId: `${event.id}:team_workspace_created`,
        });
        if (sub) await recordSubscriptionAmount(sub);
        break;
      }

      const orgId = session.metadata?.orgId;
      if (orgId && customerId) {
        // Defensively ensure stripe_customer_id is set — create-checkout sets it before
        // redirect but this covers any race or retry scenarios.
        await supabaseAdmin
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('id', orgId)
          .is('stripe_customer_id', null);
      }
      break;
    }

    // ── A card arrived or left, by a door the setup session never sees ──────────
    // A founding org's billing portal ("Payment method & invoices") can attach a card without any
    // checkout session at all, so the setup arm alone would miss it.
    case 'payment_method.attached': {
      const pm = event.data.object as Stripe.PaymentMethod;
      if (pm.type === 'card') {
        // The event delivers the whole payment method — passing it saves a Stripe round trip
        // inside a webhook handler, which is the one place latency has a consequence (Stripe
        // retries a slow endpoint).
        // GST/HST Stage 1 Part 3: the card's issuing country beside the billing address (evidence only, never acted on).
        await Promise.all([recordCardOnFile({ customerId, paymentMethod: pm }), recordCardCountry(customerId)]);
      }
      break;
    }

    // ⚠ A SWAP IS NOT A REMOVAL. Replacing a card fires `detached` for the old one, frequently AFTER
    // the new one has attached — clearing unconditionally would drop the account into the "no card
    // yet" reminder audience and chase somebody who had just updated their card. The writer asks
    // Stripe whether any card remains, and fails CLOSED if it cannot ask.
    case 'payment_method.detached': {
      const pm = event.data.object as Stripe.PaymentMethod;
      if (pm.type === 'card') {
        await Promise.all([clearCardOnFileIfNoCardsLeft(customerId, pm), recordCardCountry(customerId)]);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      // Stage 0 (S5): Stripe's CURRENT subscription, not the event's copy, so a late event cannot write an older status or
      // price over a newer one. A failed read throws: 500, and Stripe sends the event again.
      const eventSub = event.data.object as Stripe.Subscription;
      const sub = await stripe.subscriptions.retrieve(eventSub.id);
      const priceId: string = sub.items?.data?.[0]?.price?.id ?? '';

      // ── The next-season plan choice ───────────────────────────────────────────
      // The subscription exists from the moment the customer chooses, but its first charge is the
      // Founding Season's end instant and it sits in `trialing` until then.
      //
      // ⚠⚠ THE PLAN DOES NOT MOVE WHILE IT IS TRIALING (owner ruling D2, 2026-09-07). Falling
      // through to the arm below would write `plan_id` from the price the moment somebody chose in
      // June — handing a bigger plan over free for four months and making the free season worth
      // different amounts to different accounts. Once the trial ends and Stripe reports a real
      // status, the same event DOES fall through and the plan applies exactly as any other
      // subscription's would.
      if (sub.metadata?.choiceKind === NEXT_SEASON_CHOICE_KIND && sub.metadata.orgId) {
        const state = classifyNextSeasonSubscription(sub.status);

        // ⚠⚠ WITHDRAWN IS NOT A CANCELLATION OF THE ACCOUNT. Falling through here with a dead
        // subscription would write `subscription_status: 'canceled'` from it and suspend an account
        // whose Founding Season comp still has months to run. Clear the choice; touch nothing else.
        if (state === 'withdrawn') {
          await clearNextSeasonChoice(sub.metadata.orgId);
          break;
        }

        await recordNextSeasonChoice({
          orgId: sub.metadata.orgId,
          planKey: sub.metadata.planKey ?? '',
          billingCycle: sub.metadata.billingCycle ?? 'annual',
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          teamWorkspaceId: sub.metadata.teamWorkspaceId ?? null,
        });
        // Still before the first charge — the plan does not move (ruling D2). Once it converts,
        // this falls through and the plan applies exactly as any other subscription's would.
        if (state === 'pending') break;
      }

      // Plans end at renewal (Stage 1): the waiting cancel agrees with Stripe — recorded when a cancel is set in Stripe's
      // own portal (or a dated cancel_at), withdrawn when both signals clear. AFTER the next-season block, so a placeholder
      // that is pending or withdrawn never gets one; from the LIVE subscription, so a late event cannot undo a Keep.
      // Only for the subscription our record follows (a Coaches Portal's, or the club's on file).
      const endingAccount = await endingAccountForSubscription(sub.id, customerId);
      if (endingAccount) await recordStripeSignal(endingAccount, sub, endingDeps);

      // A late event about a subscription that has since ended: its deletion speaks for it (and has cleared the record).
      if (subscriptionEventIsStale(eventSub.status, sub.status)) {
        console.warn(`[billing webhook] ${event.id} is stale: ${sub.id} is ${sub.status} now`);
        break;
      }

      const matchedPlan = await getPlanFromPriceId(priceId);
      if (matchedPlan) {
        // RETIRING (Club Repackaging 2026-06-22): org_team_addon is retired; kept only to
        // settle any in-flight pre-cutover subscription (0 exist). Remove post-cutover.
        if (matchedPlan.planId === 'org_team_addon') {
          const result = await completeOrgTeamAddonBillingFromMetadata({
            metadata: sub.metadata,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripeSubscriptionItemId: subscriptionItemId(sub),
            subscriptionStatus: sub.status,
            currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            sourceEventId: `${event.id}:org_team_addon_completed`,
          });
          if (result.ok) {
            await cancelPriorTeamSubscription(result.previousTeamSubscriptionId, sub.id);
          }
          break;
        }

        const planKey = matchedPlan.planId as OrgPlan;
        const billingCycle = matchedPlan.billingCycle as BillingCycle;
        if (planKey === 'team') {
          const provisionResult = await provisionTeamWorkspaceFromCheckoutMetadata({
            metadata: sub.metadata,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripeSubscriptionItemId: subscriptionItemId(sub),
            subscriptionStatus: sub.status,
            billingCycle,
            currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            eventSource: 'stripe',
            sourceEventId: `${event.id}:team_workspace_created`,
          });

          if (!provisionResult.provisioned && provisionResult.reason === 'not_team_checkout') {
            // Snapshot previous status before sync for reactivation detection
            const { data: prevWs } = await supabaseAdmin
              .from('team_workspaces')
              .select('workspace_org_id, subscription_status')
              .eq('stripe_subscription_id', sub.id)
              .maybeSingle();

            await syncTeamWorkspaceSubscription({
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              stripeSubscriptionItemId: subscriptionItemId(sub),
              subscriptionStatus: sub.status,
              billingCycle,
              currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            });

            // Welcome back email when a canceled team workspace reactivates
            if (
              prevWs?.workspace_org_id &&
              prevWs.subscription_status === 'canceled' &&
              (sub.status === 'active' || sub.status === 'trialing')
            ) {
              const [wsOwnerEmail, wsOrg] = await Promise.all([
                getOrgOwnerEmail(prevWs.workspace_org_id),
                supabaseAdmin
                  .from('organizations')
                  .select('name, slug')
                  .eq('id', prevWs.workspace_org_id)
                  .maybeSingle()
                  .then(r => r.data),
              ]);
              if (wsOwnerEmail && wsOrg) {
                await say.email({
                  key: 'welcome_back',
                  to: wsOwnerEmail,
                  vars: { orgName: wsOrg.name, planLabel: 'Team', dashboardUrl: `${SITE_URL}/${wsOrg.slug}/coaches` },
                  defaultSubject: `Welcome back — ${wsOrg.name}`,
                  defaultHtml: welcomeBackHtml({
                    orgName: wsOrg.name,
                    planLabel: 'Team',
                    restoredTournaments: 0,
                    dashboardUrl: `${SITE_URL}/${wsOrg.slug}/coaches`,
                  }),
                  orgId: prevWs.workspace_org_id,
                });
              }
            }
          }
          await recordSubscriptionAmount(sub);
          break;
        }

        const cfg = PLAN_CONFIG[planKey];
        if (!cfg) break;
        // current_period_end moved to SubscriptionItem in API 2026-04-22.dahlia
        const currentPeriodEnd = toIso(sub.items?.data?.[0]?.current_period_end);
        const { data: currentOrg } = await supabaseAdmin
          .from('organizations')
          .select('id, plan_id, subscription_status, stripe_subscription_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        // ⚠⚠ A SECOND SUBSCRIPTION DOES NOT TAKE THE RECORD OVER (see recordFollowsSubscription). Asked of Stripe
        // only when a different one is on file; a failed ask throws, so Stripe retries rather than guessing.
        const onFileId = currentOrg?.stripe_subscription_id ?? null;
        if (onFileId && onFileId !== sub.id && !onFileId.startsWith('mock_')
          && !recordFollowsSubscription({ onFileId, incomingId: sub.id, onFileIsPaying: await subscriptionIsPaying(onFileId, currentOrg?.subscription_status ?? null, id => stripe.subscriptions.retrieve(id)) })) {
          console.warn(`[billing webhook] ignored ${sub.id}: ${currentOrg?.id} already follows live subscription ${onFileId}`);
          break;
        }

        const { data: updatedOrg } = await supabaseAdmin
          .from('organizations')
          .update({
            plan_id: planKey,
            tournament_limit: cfg.tournamentLimit,
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
            subscription_period: billingCycle,
            current_period_end: currentPeriodEnd,
            // Stage 0 (fix 1): what this subscription charges, so the billing page shows it rather than the price list.
            ...subscriptionAmount(sub),
          })
          .eq('stripe_customer_id', customerId)
          .select('id, name, slug')
          .maybeSingle();

        if (updatedOrg) {
          const previousPlan = currentOrg?.plan_id as OrgPlan | undefined;
          const previousStatus = currentOrg?.subscription_status as string | null | undefined;

          // The growth half of the Billing events card: a first subscription, or a paying org moving up.
          // Written FIRST, before the side effects below: if one of them throws, Stripe retries this event,
          // and the retry finds the org already updated, so the move would never be classified again.
          // A subscription starts once, so its start is keyed on the subscription, not on this event: two
          // different events for one new subscription (created + updated, or a late stale one) count once.
          await writeGrowthEvent({
            source: 'stripe',
            sourceEventId: event.id,
            startSourceEventId: sub.id,
            orgId: updatedOrg.id,
            previousPlanId: previousPlan ?? null,
            previousStatus,
            previousSubscriptionId: currentOrg?.stripe_subscription_id ?? null,
            planId: planKey,
            status: sub.status,
            ignoreUpgrade: isInAppUpMove(sub.metadata, planKey),
            metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
          });

          const restoreResult = await restoreRetainedDowngradeTournaments(updatedOrg.id, cfg.tournamentLimit);

          // Club Tier Stage 1b — what only the webhook sees change the plan (a scheduled down-move
          // reaching its renewal, a checkout onto Club): a custom team limit set for the old band is
          // cleared, and a move onto Club revokes the Founding Season comp (⚖ D6).
          await applyPlanChangeSideEffects({
            orgId: updatedOrg.id,
            fromPlan: currentOrg?.plan_id ?? null,
            toPlan: planKey,
            actor: 'stripe-webhook',
            // Stage 4b: the name a coach typed for the club their portal is becoming. It rides on the subscription (set at
            // checkout or by the move), so a retried event with no request behind it reads the same name.
            clubName: clubNameFromMetadata(sub.metadata),
          });
          // A07: coming back from a cancellation restores what it took — the site, the retained
          // tournaments and records (so the retention emails stop), and the cancellation intent.
          const reactivation = currentOrg?.subscription_status === 'canceled'
            && (sub.status === 'active' || sub.status === 'trialing')
            ? await restoreAfterReactivation(updatedOrg.id, cfg.tournamentLimit)
            : null;

          // Moved onto a paid plan — cancel any pending free-tier upsell email so the
          // org doesn't get a now-stale "you're missing Tournament Plus" nudge.
          if (planKey !== 'tournament') {
            await cancelScheduledEmail(updatedOrg.id, 'tournament_plus_upsell');
          }

          if (previousPlan && PLAN_RANK[planKey] < PLAN_RANK[previousPlan]) {
            await writePlatformEvent({
              eventType: 'plan_downgraded',
              source: 'stripe',
              sourceEventId: `${event.id}:plan_downgraded`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });
          }

          if (isPastDueTransition(previousStatus, sub.status)) {
            await writePlatformEvent({
              eventType: 'subscription_past_due',
              source: 'stripe',
              sourceEventId: `${event.id}:subscription_past_due`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan ?? null,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });
          }

          // A failed payment's notice leaves Needs attention for everyone once billing is good again, or the plan ended —
          // never on `unpaid` / `incomplete`, which still aren't paying (/review 2026-10-16).
          if (['active', 'trialing', 'canceled'].includes(sub.status)) await clearSettled({ orgIds: [updatedOrg.id], kinds: ['payment_failed'] });

          if (isRecoveryTransition(previousStatus, sub.status)) {
            await writePlatformEvent({
              eventType: 'subscription_recovered',
              source: 'stripe',
              sourceEventId: `${event.id}:subscription_recovered`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan ?? null,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });

            // Welcome back email — only for resubscriptions (canceled → active/trialing),
            // not for payment recovery (past_due → active) which is a different context.
            if (previousStatus === 'canceled') {
              const ownerEmail = await getOrgOwnerEmail(updatedOrg.id);
              if (ownerEmail) {
                const planLabel = PLAN_CONFIG[planKey]?.label ?? planKey;
                const dashboardUrl = `${SITE_URL}/${updatedOrg.slug}/admin`;
                await say.email({
                  key: 'welcome_back',
                  to: ownerEmail,
                  vars: { orgName: updatedOrg.name, planLabel, dashboardUrl },
                  defaultSubject: `Welcome back to FieldLogicHQ — ${updatedOrg.name}`,
                  defaultHtml: welcomeBackHtml({
                    orgName: updatedOrg.name,
                    planLabel,
                    restoredTournaments: restoreResult.restoredCount + (reactivation?.restoredTournamentIds.length ?? 0),
                    dashboardUrl,
                  }),
                  orgId: updatedOrg.id,
                });
              }
            }
          }
        }
      } else if (priceId) {
        // Stage 0 (fix 2): unknown even among the replaced prices. Nothing changes on the record (as before), but it is no
        // longer silent: an event and an email to the owner, at most once per subscription per day.
        await tellOwnerOfUnrecognisedPrice(sub, priceId, customerId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;

      // ⚠⚠ A WITHDRAWN NEXT-SEASON CHOICE IS NOT AN ACCOUNT CANCELLATION, AND EVERYTHING BELOW
      // ASSUMES IT IS. The 2028 choice creates a real Stripe subscription months before it charges,
      // and the billing page hands the customer a portal link — where the obvious thing to do with
      // a choice you have changed your mind about is cancel it. Falling through would run the
      // Stripe-initiated-deletion path: archive every tournament, hide the public site, stamp
      // `billing_suspended_at`, and 402 the org out of the product — or, for a coach workspace,
      // revoke Premium entitlements and email them a cancellation notice — all while the account's
      // Founding Season comp still has months to run.
      //
      // Recognised by the subscription's own metadata AND by the id we recorded at choice time, so
      // a stripped-metadata event (a Dashboard action, an old event replayed) still lands here.
      const choiceOrgId = sub.metadata?.choiceKind === NEXT_SEASON_CHOICE_KIND && sub.metadata.orgId
        ? sub.metadata.orgId
        : await orgIdForNextSeasonSubscription(sub.id);
      if (choiceOrgId) {
        await clearNextSeasonChoice(choiceOrgId);
        // The chooser reappears on the billing page and the desk counts the account as "no choice
        // yet" again — which is exactly what it now is.
        break;
      }

      const syncedTeamWorkspace = await syncTeamWorkspaceSubscription({
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripeSubscriptionItemId: subscriptionItemId(sub),
        subscriptionStatus: 'canceled',
        currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
      });

      if (syncedTeamWorkspace) {
        // The `subscription_canceled` event has ONE writer, the ending (keyed to its intent, with the portal's org) — this
        // arm used to write a second, org-less one, so an owner's cancel counted twice in churn.
        const { data: cancelledWs } = await supabaseAdmin
          .from('team_workspaces')
          .select('id, workspace_org_id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle();
        if (cancelledWs?.workspace_org_id) {
          // Plans end at renewal (Stage 1): THE ending — the waiting cancel's (with the owner's reason and date), else this
          // subscription's own applied one means a door already ended it (and sent its email), else Stripe ended it
          // with nobody asking. Records, archive, suspension, pay pages, the one event and the email are all in it.
          const account = await readEndingAccount(cancelledWs.workspace_org_id);
          if (account) await endingForDeletedSubscription(account, sub, endingDeps);
        }
        break;
      }

      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, plan_id, subscription_status, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      // ⚠⚠ ONLY THE SUBSCRIPTION ON FILE CAN END THE CLUB'S PLAN. A stray one deleted in Stripe's dashboard (or the old
      // one after a new one took over) used to run everything below: blank the record, and with no cancellation on
      // file archive the tournaments and suspend a club that was still paying.
      if (org && !isTheRecordsSubscription(org.stripe_subscription_id, sub.id)) {
        console.warn(`[billing webhook] ignored deletion of ${sub.id}: ${org.id} follows ${org.stripe_subscription_id}`);
        break;
      }

      if (org) {
        // Plans end at renewal (Stage 1): THE ending (lib/plan-ending.ts). The waiting cancel first — it carries the
        // owner's reason and the date; the ending promotes it in place. Else this subscription's OWN applied ending (an End
        // now, an immediate cancel, a downgrade to free) means a door already ran it. Else Stripe ended it with nobody
        // asking (a card that failed for good): records, archive, suspension, the one `subscription_canceled` event and the
        // pay pages closing, as before.
        //
        // ⚠ The old check took "the latest applied cancellation or downgrade, at any age": a stale downgrade from an earlier
        // year let a later paid plan that Stripe ended skip its suspension and stay free for good. The applied row must now
        // belong to THIS subscription (review S4).
        const account = await readEndingAccount(org.id);
        if (account) await endingForDeletedSubscription(account, sub, endingDeps);

        // Every path: the Stripe subscription fields become accurate only now that Stripe confirms the deletion. A downgrade
        // to free keeps its plan and status (the move just set them — Stage 2: a waiting move runs here, on its date, through
        // `applyDowngrade`, never the suspension); an ending has already set canceled and suspended.
        await supabaseAdmin
          .from('organizations')
          .update({
            stripe_subscription_id: null,
            subscription_period: null,
            current_period_end: null,
            subscription_amount_cents: null,
            subscription_currency: null,
          })
          .eq('stripe_customer_id', customerId);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const currentPeriodEnd = invoicePeriodEnd(invoice);
      const { data: currentOrg } = await supabaseAdmin
        .from('organizations')
        .select('id, plan_id, subscription_status, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      // A stray subscription's payment (or a Coaches Portal's) says nothing about the club's own.
      if (currentOrg && !isTheRecordsSubscription(currentOrg.stripe_subscription_id, invoiceSubscriptionId(invoice))) break;
      // Stage 0 (S5): what the subscription is NOW decides the status, so a late payment never reactivates a cancelled
      // subscription. An invoice that bills none (a one-off made in Stripe's dashboard) keeps the old rule. A failed read throws.
      const paidSubscriptionId = invoiceSubscriptionId(invoice);
      const status = paidSubscriptionId
        ? statusAfterInvoicePaid((await stripe.subscriptions.retrieve(paidSubscriptionId)).status)
        : 'active';
      if (!status) {
        console.warn(`[billing webhook] ${event.id} is stale: ${paidSubscriptionId} no longer pays`);
        break;
      }
      await supabaseAdmin
        .from('organizations')
        .update({
          subscription_status: status,
          ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
        })
        .eq('stripe_customer_id', customerId);

      // This handler can flip a first subscription from `incomplete` to `active` before the subscription's
      // own update arrives, which would then see "already active" and never count the start. Count it here
      // too — keyed on the subscription, so whichever event gets there first counts it once. Only once the
      // subscription is on the org row; before that the subscription event itself counts it.
      if (currentOrg?.stripe_subscription_id) {
        await writeGrowthEvent({
          source: 'stripe',
          sourceEventId: event.id,
          startSourceEventId: currentOrg.stripe_subscription_id,
          orgId: currentOrg.id,
          previousPlanId: currentOrg.plan_id,
          previousStatus: currentOrg.subscription_status,
          previousSubscriptionId: currentOrg.stripe_subscription_id,
          planId: currentOrg.plan_id,
          status,
          ignoreUpgrade: true,
          metadata: { stripeCustomerId: customerId, invoiceId: invoice.id },
        });
      }

      // A failed payment's notice leaves Needs attention for everyone once billing is good again (not while another
      // invoice keeps the subscription past due).
      if (currentOrg && status !== 'past_due') await clearSettled({ orgIds: [currentOrg.id], kinds: ['payment_failed'] });

      if (currentOrg && isRecoveryTransition(currentOrg.subscription_status, status)) {
        await writePlatformEvent({
          eventType: 'subscription_recovered',
          source: 'stripe',
          sourceEventId: `${event.id}:subscription_recovered`,
          orgId: currentOrg.id,
          previousPlanId: currentOrg.plan_id,
          planId: currentOrg.plan_id,
          previousSubscriptionStatus: currentOrg.subscription_status,
          subscriptionStatus: status,
          metadata: { stripeCustomerId: customerId, invoiceId: invoice.id },
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const failedInvoice = event.data.object as Stripe.Invoice;
      const { data: currentOrg } = await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, plan_id, account_kind, subscription_status, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      if (currentOrg && !isTheRecordsSubscription(currentOrg.stripe_subscription_id, invoiceSubscriptionId(failedInvoice))) break;
      // Stage 0 (S5): a failure Stripe has since moved past (a later payment went through, or the subscription ended) must
      // not mark the club past due or tell its owners. A failed read throws.
      const failedSubscriptionId = invoiceSubscriptionId(failedInvoice);
      if (failedSubscriptionId && !invoiceFailureIsCurrent((await stripe.subscriptions.retrieve(failedSubscriptionId)).status)) {
        console.warn(`[billing webhook] ${event.id} is stale: ${failedSubscriptionId} has moved on`);
        break;
      }
      await supabaseAdmin
        .from('organizations')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId);

      if (currentOrg && isPastDueTransition(currentOrg.subscription_status, 'past_due')) {
        await writePlatformEvent({
          eventType: 'subscription_past_due',
          source: 'stripe',
          sourceEventId: `${event.id}:subscription_past_due`,
          orgId: currentOrg.id,
          previousPlanId: currentOrg.plan_id,
          planId: currentOrg.plan_id,
          previousSubscriptionStatus: currentOrg.subscription_status,
          subscriptionStatus: 'past_due',
          metadata: { stripeCustomerId: customerId },
        });
      }
      // Tell the club's OWNERS — billing is owner-only, so they are who can act on it (Needs attention clears itself,
      // 2026-10-16: with no list it reached every member, coaches included). Their email default stays on (systemDefaults
      // reads each one's real role). An empty list must never reach notify(): that means every member.
      if (currentOrg) {
        const owners = await orgOwnerUserIds(currentOrg.id).catch(e => { console.error(e); return [] as string[]; });
        if (owners.length) {
          say.notify({
            orgId: currentOrg.id,
            eventType: 'payment_failed',
            title: 'Subscription payment failed',
            body: 'Your subscription payment could not be processed. Please update your billing information.',
            link: getBillingHref(billingUrlOrgFromRow(currentOrg, 'past_due')),
            userIds: owners,
          }).catch(console.error);
        }
      }
      break;
    }

    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription;
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, plan_id, account_kind, subscription_status, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      if (!org || !isTheRecordsSubscription(org.stripe_subscription_id, sub.id)) break;
      // Plans end at renewal (G5): an account that cancelled is not asked to add a card for a plan it is leaving.
      if (sub.cancel_at_period_end || sub.cancel_at || await readPendingEnding(org.id)) break;

      const ownerEmail = await getOrgOwnerEmail(org.id);
      if (!ownerEmail) break;

      const planLabel = PLAN_CONFIG[org.plan_id as OrgPlan]?.label ?? org.plan_id;
      const trialEndDate = sub.trial_end
        ? new Date(sub.trial_end * 1000).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'soon';
      const billingUrl = `${SITE_URL}${getBillingHref(billingUrlOrgFromRow(org))}`;

      await say.email({
        key: 'trial_ending',
        to: ownerEmail,
        vars: { orgName: org.name, planLabel, trialEndDate, billingUrl },
        defaultSubject: `Your ${planLabel} trial ends ${trialEndDate}`,
        defaultHtml: trialEndingHtml({ orgName: org.name, planLabel, trialEndDate, billingUrl }),
        orgId: org.id,
      });
      break;
    }
  }

  return 'processed';
}
