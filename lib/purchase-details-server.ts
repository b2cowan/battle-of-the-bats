import 'server-only';
import type Stripe from 'stripe';
import { stripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import { stripeKeyIsLive } from './stripe-mode';
import { captureError } from './observability/capture';
import { SITE_URL } from './email';
import { notify } from './notify';
import { sendTransactionalEmail } from './platform-email-templates';
import { customerSenders, type RunOptions } from './billing-event-customer-messages';
import { orgOwnerEmails, type OwnerRecipient } from './notify-recipients';
import { isDemoOrganizerEmail } from './demo-org';
import { getUserPersonName } from './user-display';
import { FEE_INVOICE_META } from './online-payment-words';
import { getPlanFromPriceId } from './stripe-prices';
import { PLAN_CONFIG } from './plan-config';
import { getBillingHref, billingUrlOrgFromRow } from './billing-urls';
import { namedTaxLines } from './billing-tax';
import { legalPagesMode } from './legal-pages-switch';
import { legalPageHref } from './legal-links';
import { currentVersion, isPublishedVersion } from './legal-documents';
import { latestRecordedTermsVersion } from './legal-acceptance';
import { FIELDLOGICHQ_CONTACT_EMAIL, FIELDLOGICHQ_SELLER_MAILING_ADDRESS, FIELDLOGICHQ_SELLER_PHONE } from './fieldlogichq-contact';
import { idOf } from './charge-tax-record';
import { BUYER_USER_META } from './plan-growth';
import {
  isFreePurchase, purchaseDetailsEmail, recordTaxRows, runPurchaseEmail,
  type PurchaseRecord, type PurchaseRunDeps, type PurchaseSendResult, type TermsLine,
} from './purchase-details';

/**
 * THE SENDER of "The details of your purchase" (GST/HST Stage 6 step 6.4 Part A; pure rules and words in lib/purchase-details.ts).
 *
 *   · Called by the billing webhook AFTER the invoice's tax record is written (`runVerifiedBillingEvent`), and by the daily job's
 *     `purchase_emails` step for any email still owed (`catchUpPurchaseEmails`). Both read the STORED record, so the email, the
 *     billing page and the books show the same figures.
 *   · ONCE ONLY: the record's `purchase_email_at` is claimed before the send (one conditional update wins two events and the daily
 *     job racing), and given back only when the email definitely did not go. The mail service's once-only key is passed too, but
 *     it remembers 24 hours only.
 *   · A replay of a stored event sends nothing and claims nothing (owner ruling 1, 2026-11-08).
 *   · ⚖ NEVER throws to its caller's work: a club's plan never waits on this email (`sendPurchaseEmailOrReport`).
 */

const CHARGES = 'platform_charge_tax_records';
const STRIPE_OPTS = { timeout: 10_000 };
/** The catch-up only looks this far back: an email a week late is not "the details of your purchase", it is noise. */
const CATCH_UP_DAYS = 3;
/** The catch-up stops starting new invoices after this long (the daily route's own limit is 300 s and other steps follow it). */
const CATCH_UP_BUDGET_MS = 120_000;

async function readRecord(invoiceId: string): Promise<PurchaseRecord | null> {
  const { data, error } = await supabaseAdmin.from(CHARGES)
    .select('stripe_invoice_id, livemode, kind, org_id, user_id, status, billing_reason, purchase_email_at, currency, amount_before_tax_cents, tax_lines, total_cents, invoice_number, paid_at, issued_at, stripe_subscription_id')
    .eq('stripe_invoice_id', invoiceId).maybeSingle<PurchaseRecord>();
  if (error) throw error;
  return data;
}

async function personOf(userId: string): Promise<{ email: string | null; name: string | null }> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const u = data?.user;
  const name = u ? getUserPersonName(u) : '';
  return { email: u?.email?.trim() || null, name: name || null };
}

/** Who is told: every active owner of the record's organization (a coach's Premium: the coach), else the person on the record. */
async function recipientsOf(record: PurchaseRecord): Promise<OwnerRecipient[]> {
  const owners = record.org_id ? await orgOwnerEmails(record.org_id) : [];
  if (owners.length || !record.user_id) return owners;
  const { email } = await personOf(record.user_id);
  return email && !isDemoOrganizerEmail(email) ? [{ userId: record.user_id, email }] : [];
}

/** Our GST/HST number as THIS invoice prints it (never typed into code): the account tax ID of type ca_gst_hst. */
function gstHstNumber(inv: Stripe.Invoice): string | null {
  const ids = (inv.account_tax_ids ?? []) as Array<string | Stripe.TaxId | Stripe.DeletedTaxId>;
  for (const t of ids) if (typeof t !== 'string' && !('deleted' in t && t.deleted) && (t as Stripe.TaxId).type === 'ca_gst_hst') return (t as Stripe.TaxId).value;
  return null;
}

/** The Terms line: off → none; preview → the draft; published → the version the purchaser accepted (else the current one, which
 *  6.3's purchase gate made them accept). */
async function termsLine(buyerUserId: string | null): Promise<TermsLine> {
  const mode = legalPagesMode();
  if (mode === 'off') return { mode: 'off' };
  if (mode === 'preview') return { mode: 'preview', href: legalPageHref('terms') };
  const accepted = buyerUserId ? await latestRecordedTermsVersion(buyerUserId) : null;
  const version = accepted && isPublishedVersion('terms', accepted) ? accepted : currentVersion('terms');
  return version ? { mode: 'published', version, href: legalPageHref('terms', version) } : { mode: 'off' };
}

/** A trial's after-trial tax, from Stripe's preview of the next invoice. Null (the sentence drops, the email still goes) when the
 *  preview fails or carries no tax. */
async function trialEstimate(subscriptionId: string): Promise<{ taxLines: Array<{ label: string; cents: number }>; totalCents: number } | null> {
  try {
    const preview = await stripe.invoices.createPreview({ subscription: subscriptionId }, STRIPE_OPTS);
    const taxLines = await namedTaxLines(preview.total_taxes, id => stripe.taxRates.retrieve(id, {}, STRIPE_OPTS));
    return taxLines.length ? { taxLines, totalCents: preview.total } : null;
  } catch (error) {
    void captureError(error, { route: 'purchase-details:estimate' });
    return null;
  }
}

type StripeRead = { inv: Stripe.Invoice; sub: Stripe.Subscription };

/** The real database, Stripe and mail service behind `runPurchaseEmail` (lib/purchase-details.ts holds the once-only rules). */
function purchaseDeps(opts: RunOptions): PurchaseRunDeps<StripeRead> {
  const say = customerSenders({ email: sendTransactionalEmail, notify }, opts);
  return {
    live: stripeKeyIsLive(),
    readRecord,
    async readStripe(record) {
      const inv = await stripe.invoices.retrieve(record.stripe_invoice_id, { expand: ['account_tax_ids'] }, STRIPE_OPTS);
      const subscriptionId = idOf(inv.parent?.subscription_details?.subscription ?? null) ?? record.stripe_subscription_id!;
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {}, STRIPE_OPTS);
      // The metadata AS IT STOOD when the invoice was made (Stripe copies it onto the invoice), else the subscription's now.
      const meta = (inv.parent?.subscription_details?.metadata ?? sub.metadata ?? {}) as Record<string, string>;
      return { feeInvoice: !!inv.metadata?.[FEE_INVOICE_META], meta, subscriptionStatus: sub.status, live: { inv, sub } };
    },
    recipients: recipientsOf,
    async claim(invoiceId, at) {
      const { data, error } = await supabaseAdmin.from(CHARGES).update({ purchase_email_at: at })
        .eq('stripe_invoice_id', invoiceId).is('purchase_email_at', null).select('stripe_invoice_id');
      if (error) throw error;
      return (data ?? []).length > 0;
    },
    async release(invoiceId, at) {
      const { error } = await supabaseAdmin.from(CHARGES).update({ purchase_email_at: null })
        .eq('stripe_invoice_id', invoiceId).eq('purchase_email_at', at); // only our own claim
      if (error) console.error('[purchase-details] the claim could not be given back; the email is lost:', invoiceId, error.message);
    },
    async build(record, purchase, meta, { inv, sub }) {
      const item = sub.items?.data?.[0];
      const plan = item?.price?.id ? await getPlanFromPriceId(item.price.id) : null;
      const planLabel = (plan && PLAN_CONFIG[plan.planId as keyof typeof PLAN_CONFIG]?.label) || 'your plan';
      const cycle = plan?.billingCycle === 'annual' || item?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
      const { data: org } = record.org_id
        ? await supabaseAdmin.from('organizations').select('name, slug, plan_id, account_kind').eq('id', record.org_id).maybeSingle()
        : { data: null };
      // A coach's first Premium invoice can be paid before its workspace exists: the name the checkout carried.
      const orgName = (org?.name as string | undefined) || meta.workspaceName || meta.teamName || 'your Coaches Portal';
      const billingUrl = org?.slug
        ? `${SITE_URL}${getBillingHref(billingUrlOrgFromRow(org as { slug: string; plan_id: string | null; account_kind: string | null; name: string }))}`
        : SITE_URL;
      const buyerUserId = meta[BUYER_USER_META] || null;
      const buyer = buyerUserId ? await personOf(buyerUserId) : null;
      const who = buyer?.name || buyer?.email || null;
      const isFree = isFreePurchase(purchase);
      const nextUnix = isFree ? sub.trial_end : item?.current_period_end;
      const unit = item?.price?.unit_amount;
      const taxNumber = gstHstNumber(inv);
      const email = purchaseDetailsEmail({
        case: purchase, orgName, planLabel, cycle,
        boughtBy: who ? { who, onIso: record.paid_at ?? record.issued_at } : null,
        currency: record.currency, beforeTaxCents: record.amount_before_tax_cents, taxLines: recordTaxRows(record.tax_lines ?? []),
        totalCents: record.total_cents, invoiceNumber: record.invoice_number, invoiceUrl: inv.hosted_invoice_url ?? null, billingUrl,
        startedIso: record.paid_at ?? record.issued_at,
        nextIso: nextUnix ? new Date(nextUnix * 1000).toISOString() : null,
        nextPriceCents: typeof unit === 'number' ? unit * (item?.quantity ?? 1) : null,
        estimate: isFree ? await trialEstimate(sub.id) : null,
        taxNumber, contactEmail: FIELDLOGICHQ_CONTACT_EMAIL,
        sellerPhone: FIELDLOGICHQ_SELLER_PHONE, sellerMailingAddress: FIELDLOGICHQ_SELLER_MAILING_ADDRESS,
        terms: await termsLine(buyerUserId),
      });
      return { email, noTaxNumber: !taxNumber, buyerUserId };
    },
    send: (to, email, idempotencyKey, who) => say.email({
      key: 'purchase_details', to: to.email, vars: email.vars, defaultSubject: email.subject, defaultHtml: email.html,
      fixedHtml: email.fixedHtml, orgId: who.orgId, askedBy: who.buyerUserId, idempotencyKey,
    }),
    now: () => new Date().toISOString(),
    log: (message, invoiceId) => {
      console.error(`[purchase-details] ${message}:`, invoiceId);
      void captureError(new Error(`purchase-details: ${message} (${invoiceId})`), { route: 'purchase-details' }); // a person is told, not only the log
    },
  };
}

/** One paid invoice's purchase email, if it earns one (the rules: `runPurchaseEmail`). */
export async function sendPurchaseEmail(invoiceId: string, opts: RunOptions = {}): Promise<PurchaseSendResult> {
  return runPurchaseEmail(invoiceId, purchaseDeps(opts), opts);
}

/** The webhook's call: never throws (a club's plan never waits on this email); a failure is logged and the daily job catches up. */
export async function sendPurchaseEmailOrReport(invoiceId: string, opts: RunOptions = {}): Promise<void> {
  try {
    await sendPurchaseEmail(invoiceId, opts);
  } catch (error) {
    void captureError(error, { route: 'purchase-details' });
    console.error('[purchase-details] the purchase email was not sent; the daily job tries again:', invoiceId, error);
  }
}

/**
 * The daily job's `purchase_emails` step (after `tax_records`): any purchase still owed its email. Only rows with a billing
 * reason (old and backfilled rows never qualify) paid in the last three days, in this Stripe mode. One failure never stops the rest.
 */
export async function catchUpPurchaseEmails(now: Date): Promise<{ sent: number; none: number; failed: number; unknown: number; noTaxNumber: number }> {
  const since = new Date(now.getTime() - CATCH_UP_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin.from(CHARGES).select('stripe_invoice_id')
    .eq('livemode', stripeKeyIsLive()).eq('status', 'paid').in('billing_reason', ['subscription_create', 'subscription_update'])
    .is('purchase_email_at', null).gte('paid_at', since).order('paid_at', { ascending: true }).limit(200);
  if (error) throw error;
  const counts = { sent: 0, none: 0, failed: 0, unknown: 0, noTaxNumber: 0 };
  const stopAt = Date.now() + CATCH_UP_BUDGET_MS;
  for (const { stripe_invoice_id: id } of (data ?? []) as Array<{ stripe_invoice_id: string }>) {
    // A slow Stripe must not use up the route's whole run and starve the steps after this one: the rest wait for tomorrow (still in the window).
    if (Date.now() > stopAt) break;
    try {
      const r = await sendPurchaseEmail(id);
      if (r.outcome === 'sent') counts.sent += 1;
      else if (r.outcome === 'unknown') counts.unknown += 1;
      else if (r.outcome === 'not_sent') counts.failed += 1;
      else counts.none += 1;
      if (r.outcome === 'sent' && r.noTaxNumber) counts.noTaxNumber += 1;
    } catch (e) {
      counts.failed += 1;
      console.error('[purchase-details] catch-up', id, e instanceof Error ? e.message : String(e));
    }
  }
  if (counts.failed > 0) throw new Error(`The purchase emails: ${counts.failed} could not be sent, the next run tries again (${JSON.stringify(counts)})`);
  return counts;
}
