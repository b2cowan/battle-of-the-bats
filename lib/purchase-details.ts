/**
 * "THE DETAILS OF YOUR PURCHASE" (GST/HST Stage 6 step 6.4 Part A; build prompt docs/projects/active/GST_HST_STAGE6_4_BUILD_PROMPT.md
 * §3 and the words of §6, reviewed by /accounting and /legal 2026-11-13). Which paid invoice earns the email, its words, and the
 * once-only run (all of it given its database, Stripe and mail service, so the tests drive it). The reads are in lib/purchase-details-server.ts.
 *
 * ⚖ The figures are the invoice's TAX RECORD (platform_charge_tax_records), the row the billing page and the books read: never
 *   recomputed here. The one figure that is not the paid invoice is a trial's estimate (Stripe's preview), and it says so.
 * ⚖ The terms block (the figures, the renewal, cancel and refund sentences, the links, the seller, the Terms line) is FIXED: it is
 *   rendered by code below the editable words, so an operator customising the template cannot change what the buyer is told
 *   about cancelling or refunds (/legal 6). Only the opening and the closing are the template's.
 * ⚖ No upsell, pricing or sign-up link (CASL s. 6(6): transactional). The only links are the invoice, the billing page and the
 *   Terms. Never "paid", "payment received" or "receipt" anywhere in it: the invoice is the document to keep.
 */
import { escText as escapeHtml, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall, WARM_EMAIL_STYLE } from './email-envelope-warm';
import { formatStoredDate } from './timezone';
import { BILLING_TAX_WORDS, taxLineLabel } from './billing-tax';
import { COMEBACK_META, MOVE_METADATA_KEY } from './plan-growth';
import { sendToOwners, type SendResultLike } from './owners-send-outcome';
import type { StoredTaxLine } from './charge-tax-record';

export type PurchaseCase = 'first' | 'comeback' | 'plan_change' | 'trial' | 'trial_change';

/** What the classifier reads: the stored record, the invoice's own subscription metadata (as it stood when the invoice was
 *  made: `parent.subscription_details.metadata`) and the subscription's status now. */
export type PurchaseFacts = {
  billingReason: string | null;
  status: string;
  kind: string;
  totalCents: number;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  meta: Readonly<Record<string, string>>;
  /** The record names an organization or a person to tell. */
  hasRecipient: boolean;
};

/**
 * Which purchase a paid invoice is, or null for none (§3.2's table). A renewal (`subscription_cycle`) is never one, including a
 * trial's first real charge: the purchase email and the yearly reminder already told them.
 */
export function classifyPurchase(f: PurchaseFacts): PurchaseCase | null {
  if (f.status !== 'paid' || !f.hasRecipient) return null;
  if (f.kind === 'fee') return null; // a retired Stripe-fee invoice (history, Stripe-owned pricing Stage 4): never a purchase
  if (!f.subscriptionId || f.subscriptionId.startsWith('mock_')) return null;
  if (f.billingReason === 'subscription_create') {
    if (f.totalCents > 0) return f.meta[COMEBACK_META] === '1' ? 'comeback' : 'first';
    if (f.totalCents === 0 && f.subscriptionStatus === 'trialing') {
      return 'trial';
    }
    return null;
  }
  // An in-app move up (and Premium → Club in place, which is one: test mode 2026-11-13 shows `flhq_plan_move: 'up'` beside
  // `inPlaceClub: '1'`). Its proration invoice is `subscription_update`. Any other update (a dashboard change) is none.
  if (f.billingReason === 'subscription_update' && f.totalCents > 0 && f.meta[MOVE_METADATA_KEY] === 'up') return 'plan_change';
  // A move up DURING A TRIAL charges nothing: Stripe still makes a $0 paid `subscription_update` invoice carrying the move's
  // metadata (test mode 2026-11-16, .probe/66fix/trial-move-up-run1.txt), and the trial email in the inbox quotes the OLD plan's
  // first payment, so it earns the email (owner ruling 2, 2026-11-16). ⚠ The move metadata STAYS on the subscription after the
  // move, so the trialing guard is what keeps a later $0 dashboard update from sending one.
  if (f.billingReason === 'subscription_update' && f.totalCents === 0 && f.subscriptionStatus === 'trialing'
    && f.meta[MOVE_METADATA_KEY] === 'up') return 'trial_change';
  return null;
}

/** "$1,234.56". The record's own currency, named after the total ("CAD"). */
export function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol' }).format(cents / 100);
}

/** The record's taxes as the buyer reads them, summed per label ("HST (ON) 13%", "GST/HST 0%"). None → one "Tax" row at $0.00. */
export function recordTaxRows(lines: ReadonlyArray<Pick<StoredTaxLine, 'name' | 'rate' | 'effective_rate' | 'cents'>>): Array<{ label: string; cents: number }> {
  const out = new Map<string, number>();
  for (const l of lines) {
    const label = taxLineLabel({ display_name: l.name, percentage: l.rate, effective_percentage: l.effective_rate });
    out.set(label, (out.get(label) ?? 0) + l.cents);
  }
  return out.size ? [...out].map(([label, cents]) => ({ label, cents })) : [{ label: 'Tax', cents: 0 }];
}

export type TermsLine = { mode: 'off' } | { mode: 'preview'; href: string } | { mode: 'published'; href: string; version: string };

export type PurchaseEmailInput = {
  case: PurchaseCase;
  orgName: string;
  planLabel: string;
  cycle: 'monthly' | 'yearly';
  /** "Bought by": the purchaser's name or email, and the day. Null drops the row. */
  boughtBy: { who: string; onIso: string } | null;
  currency: string;
  beforeTaxCents: number;
  taxLines: Array<{ label: string; cents: number }>;
  totalCents: number;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  billingUrl: string;
  startedIso: string;
  /** The renewal (or first payment) date: the subscription's period end, or its trial end. */
  nextIso: string | null;
  /** The plan's own price before tax for the next charge ("{price} plus applicable taxes"). Null drops the price. */
  nextPriceCents: number | null;
  /** A trial's after-trial tax, from Stripe's preview; null drops only the estimate sentence (it never holds the email). */
  estimate: { taxLines: Array<{ label: string; cents: number }>; totalCents: number } | null;
  /** Our GST/HST number, from the invoice's account tax IDs (type ca_gst_hst). Null drops the number, never the seller line. */
  taxNumber: string | null;
  contactEmail: string;
  sellerPhone: string;
  sellerMailingAddress: string;
  terms: TermsLine;
};

/** A trial, or a move up during a trial: nothing is charged today. */
export const isFreePurchase = (c: PurchaseCase) => c === 'trial' || c === 'trial_change';
const PLUS_TAX = BILLING_TAX_WORDS.plusTax;

export const PURCHASE_WORDS = {
  subject: (planLabel: string) => `The details of your purchase: ${planLabel}`,
  heading: 'The details of your purchase',
  opening(c: PurchaseCase, planLabel: string, orgName: string): string {
    switch (c) {
      case 'first': return `Thanks for choosing ${planLabel} for ${orgName}. Here are the details of your purchase.`;
      case 'comeback': return `Welcome back to ${planLabel}, ${orgName}. Here are the details of your purchase.`;
      case 'plan_change': return `${orgName} is now on ${planLabel}. Here are the details of the change.`;
      case 'trial': return `Your free trial of ${planLabel} for ${orgName} has started. Nothing has been charged today.`;
      case 'trial_change': return `${orgName} is now on ${planLabel}. Your free trial continues, and nothing has been charged today.`;
    }
  },
  closing: 'This email is a summary of your purchase. Your invoice is the document to keep for your books, and it’s always on your billing page.',
} as const;

const day = (iso: string) => formatStoredDate(iso, { longMonth: true });

function rows(i: PurchaseEmailInput): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (i.boughtBy) out.push(['Bought by', `${i.boughtBy.who}, on ${day(i.boughtBy.onIso)}`]);
  out.push(['Plan', `${i.planLabel}, billed ${i.cycle}, in advance, to the card on file`]);
  out.push([i.case === 'plan_change' ? 'Price before tax, for the rest of this period' : 'Price before tax', money(i.beforeTaxCents, i.currency)]);
  for (const t of i.taxLines.length ? i.taxLines : [{ label: 'Tax', cents: 0 }]) out.push([t.label, money(t.cents, i.currency)]);
  out.push(['Total', `${money(i.totalCents, i.currency)} ${i.currency.toUpperCase()}`]);
  if (isFreePurchase(i.case)) out.push(['Charged today', money(0, i.currency)]);
  if (i.invoiceNumber) out.push(['Invoice number', i.invoiceNumber]);
  return out;
}

/** The dates, renewal and cancel sentences (fixed), as plain sentences: the email's paragraphs and the tests read the same words. */
export function purchaseTermsSentences(i: PurchaseEmailInput): { dates: string[]; cancel: string[] } {
  const price = i.nextPriceCents != null ? money(i.nextPriceCents, i.currency) : null;
  const next = i.nextIso ? day(i.nextIso) : null;
  const dates: string[] = [];
  const cancel: string[] = [];
  if (isFreePurchase(i.case)) {
    if (price && next) {
      let s = `Your first payment: ${price} ${PLUS_TAX}, on ${next}.`;
      if (i.estimate && i.estimate.taxLines.length) {
        const tax = i.estimate.taxLines.map(t => `${t.label} ${money(t.cents, i.currency)}`).join(' and ');
        s += ` Estimated tax, based on your billing address today: ${tax}, for a total of ${money(i.estimate.totalCents, i.currency)} ${i.currency.toUpperCase()}.`
          + ' The tax is worked out when the payment is taken, so it can change if your address or the tax rate does.';
      }
      dates.push(s);
    }
    if (next) cancel.push(`Cancel from your billing page before ${next} and you won’t be charged.`);
  } else {
    dates.push(`Started on ${day(i.startedIso)}.`);
    if (next && price) {
      dates.push(`Renews on ${next} at ${price} ${PLUS_TAX}, until you cancel. If the price changes, we’ll email you at least 30 days before.`);
    }
    cancel.push('You can cancel any time from your billing page. Your plan stays active until the end of the period you’ve paid for, and you won’t be charged again.');
  }
  cancel.push('We don’t refund the unused part of a period. This doesn’t affect any refund right you have under the law.');
  return { dates, cancel };
}

const link = (label: string, href: string) =>
  `<a href="${escapeHtml(href)}" style="color:#55641c;text-decoration:underline;font-weight:700;">${escapeHtml(label)}</a>`;

/** The fixed block, as HTML (below the editable opening; the closing follows it in the built-in email). */
function purchaseFixedHtml(i: PurchaseEmailInput): string {
  const cell = 'padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#211c15;vertical-align:top;';
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4px 0 18px;">${
    rows(i).map(([k, v]) => `<tr><td style="${cell}color:#665f57;padding-right:16px;">${escapeHtml(k)}</td><td style="${cell}text-align:right;">${escapeHtml(v)}</td></tr>`).join('')
  }</table>`;
  const { dates, cancel } = purchaseTermsSentences(i);
  const links = [i.invoiceUrl ? link('View your invoice', i.invoiceUrl) : null, link('Your billing page', i.billingUrl)].filter(Boolean).join(' &middot; ');
  const seller = [
    `Sold by FieldLogicHQ${i.taxNumber ? ` · GST/HST registration number ${i.taxNumber}` : ''}`,
    `Questions? ${i.contactEmail}`,
    i.sellerPhone.trim() || null,
    i.sellerMailingAddress.trim() || null,
  ].filter((s): s is string => !!s);
  const terms = i.terms.mode === 'published'
    // "for this purchase", never "you accepted": the email goes to every owner, and only the buyer ticked (/legal, 6.6).
    ? `The Terms of Service for this purchase: ${link(`version ${day(i.terms.version)}`, i.terms.href)}`
    : i.terms.mode === 'preview' ? `The Terms of Service for this purchase: ${link('the draft', i.terms.href)}` : null;
  return [
    table,
    ...dates.map(s => warmEmailParagraph(escapeHtml(s))),
    ...cancel.map(s => warmEmailParagraph(escapeHtml(s))),
    `<p style="${WARM_EMAIL_STYLE.paragraph}">${links}</p>`,
    ...seller.map(s => warmEmailSmall(escapeHtml(s))),
    terms ? warmEmailSmall(terms) : '',
  ].filter(Boolean).join('\n');
}

/** The whole email: subject, the template's variables, the fixed block, and the built-in html (opening, fixed block, closing). */
export function purchaseDetailsEmail(i: PurchaseEmailInput): { subject: string; vars: Record<string, string>; fixedHtml: string; html: string } {
  const opening = PURCHASE_WORDS.opening(i.case, i.planLabel, i.orgName);
  const fixedHtml = purchaseFixedHtml(i);
  return {
    subject: PURCHASE_WORDS.subject(i.planLabel),
    vars: { orgName: i.orgName, planLabel: i.planLabel, opening, billingUrl: i.billingUrl, invoiceUrl: i.invoiceUrl ?? '' },
    fixedHtml,
    html: warmEmailDocument([
      warmEmailHeading(escapeHtml(PURCHASE_WORDS.heading)),
      warmEmailParagraph(escapeHtml(opening)),
      fixedHtml,
      warmEmailParagraph(escapeHtml(PURCHASE_WORDS.closing)),
    ].join('\n')),
  };
}

// ── The run: once only, every owner (the server hands in the database, Stripe and the mail service) ─────────────────────────

/** The stored tax record's columns the email reads (platform_charge_tax_records). */
export type PurchaseRecord = {
  stripe_invoice_id: string; livemode: boolean; kind: string; org_id: string | null; user_id: string | null; status: string;
  billing_reason: string | null; purchase_email_at: string | null; currency: string; amount_before_tax_cents: number;
  tax_lines: StoredTaxLine[]; total_cents: number; invoice_number: string | null; paid_at: string | null; issued_at: string;
  stripe_subscription_id: string | null;
};

export type PurchaseSendResult = {
  outcome: 'sent' | 'none' | 'already' | 'not_sent' | 'unknown' | 'no_record' | 'no_recipient' | 'replay';
  case?: PurchaseCase;
  /** The invoice carried no GST/HST number (`ca_gst_hst` account tax ID): the line was left out. Owner step: Stripe → tax ID on invoices. */
  noTaxNumber?: boolean;
};

export type PurchaseRunDeps<Live> = {
  /** The Stripe mode this server runs in: a record of the other mode's is never emailed from here. */
  live: boolean;
  readRecord(invoiceId: string): Promise<PurchaseRecord | null>;
  /** What the classifier reads from Stripe (its subscription's metadata as it stood, the subscription's status now), with
   *  whatever the build step needs again (`live`). */
  readStripe(record: PurchaseRecord): Promise<{ meta: Record<string, string>; subscriptionStatus: string | null; live: Live }>;
  recipients(record: PurchaseRecord): Promise<Array<{ userId: string; email: string }>>;
  /** Sets purchase_email_at = at where it is null; true when this run won it. */
  claim(invoiceId: string, at: string): Promise<boolean>;
  /** Gives back only our own claim (purchase_email_at = at). */
  release(invoiceId: string, at: string): Promise<void>;
  build(record: PurchaseRecord, purchase: PurchaseCase, meta: Record<string, string>, live: Live):
    Promise<{ email: ReturnType<typeof purchaseDetailsEmail>; noTaxNumber: boolean; buyerUserId: string | null }>;
  /** One owner's email; a throw is read as "may have gone". */
  send(to: { userId: string; email: string }, email: ReturnType<typeof purchaseDetailsEmail>, idempotencyKey: string,
    who: { buyerUserId: string | null; orgId: string | null }):
    Promise<SendResultLike | undefined>;
  now(): string;
  log(message: string, invoiceId: string): void;
};

/**
 * One paid invoice's purchase email, if it earns one. ONCE ONLY: claimed on the record before the send (one conditional update
 * wins both paid events and the daily job racing), given back only when it definitely did not go. A replay claims and sends
 * nothing. Throws on a failed read before the claim; after the claim, a failure that means nothing went gives the claim back.
 */
export async function runPurchaseEmail<Live>(invoiceId: string, deps: PurchaseRunDeps<Live>, opts: { replay?: boolean } = {}): Promise<PurchaseSendResult> {
  if (opts.replay) return { outcome: 'replay' };
  const record = await deps.readRecord(invoiceId);
  // No record (it failed: the daily job writes it), a backfilled or old one, the other Stripe mode's, or already sent.
  if (!record) return { outcome: 'no_record' };
  if (!record.billing_reason || record.livemode !== deps.live) return { outcome: 'none' };
  if (record.purchase_email_at) return { outcome: 'already' };
  if (record.status !== 'paid' || !record.stripe_subscription_id) return { outcome: 'none' };
  // Only a first charge or a plan change can earn it (`classifyPurchase`): a renewal or a fee invoice costs no Stripe read here.
  if (record.kind === 'fee' || (record.billing_reason !== 'subscription_create' && record.billing_reason !== 'subscription_update')) return { outcome: 'none' };

  const stripeFacts = await deps.readStripe(record);
  const purchase = classifyPurchase({
    billingReason: record.billing_reason, status: record.status, kind: record.kind, totalCents: record.total_cents,
    subscriptionId: record.stripe_subscription_id, subscriptionStatus: stripeFacts.subscriptionStatus,
    meta: stripeFacts.meta, hasRecipient: !!(record.org_id || record.user_id),
  });
  if (!purchase) return { outcome: 'none' };
  const recipients = await deps.recipients(record);
  if (!recipients.length) return { outcome: 'no_recipient', case: purchase };

  const at = deps.now();
  if (!(await deps.claim(invoiceId, at))) return { outcome: 'already', case: purchase };
  let built: Awaited<ReturnType<PurchaseRunDeps<Live>['build']>>;
  try {
    built = await deps.build(record, purchase, stripeFacts.meta, stripeFacts.live);
  } catch (error) {
    await deps.release(invoiceId, at); // nothing went
    throw error;
  }
  const outcome = await sendToOwners(recipients, r =>
    deps.send(r, built.email, `purchase-details:${invoiceId}:${r.userId}`, { buyerUserId: built.buyerUserId, orgId: record.org_id }));
  if (outcome === 'not_sent') await deps.release(invoiceId, at);
  if (outcome === 'unknown') deps.log('the email may or may not have gone; not sent again', invoiceId);
  return { outcome, case: purchase, ...(built.noTaxNumber ? { noTaxNumber: true } : {}) };
}
