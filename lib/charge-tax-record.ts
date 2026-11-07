import type { ReviewReason, StoredBillingLocation } from './billing-location';
import { taxWasWorkedOut } from './billing-tax';
import { orgDayKey } from './timezone';

/**
 * EVERY INVOICE WE ISSUE KEEPS ITS TAX, ITS REASON AND THE BUYER'S EVIDENCE (GST/HST Stage 3 Part 1; build prompt
 * docs/projects/active/GST_HST_STAGE3_BUILD_PROMPT.md, owner rulings 2026-11-06; tables in migration 451). Pure: no I/O, no env.
 * The writer is lib/charge-tax-record-server.ts.
 *
 *   · One row per Stripe INVOICE (Ask 1): GST/HST is owed when the invoice is issued, paid or not. Only the payment state moves
 *     after; the database refuses anything else (platform_charge_tax_records_guard).
 *   · OUR reason, not Stripe's (Ask 2, revised after the Part 0 probe `.probe/gst3/part0-reasons-run1.txt`): Stripe's
 *     `taxability_reason` is per tax line, and for a US buyer it names the US STATE it is not collecting in, with no Canadian
 *     line at all. Zero-rating a sale to a non-resident is our call from the Stage 1 evidence. So the record carries one
 *     `gst_hst_position` for Canadian GST/HST and keeps every Stripe line verbatim beside it.
 *   · A Stripe HST line says "Canada" and never the province; the place is the invoice's own customer_address.
 *   · Credit notes are their own rows (Ask 3), dated by the note.
 */

export const CHARGE_TAX_KINDS = ['subscription', 'premium', 'fee', 'one_off'] as const;
export type ChargeTaxKind = (typeof CHARGE_TAX_KINDS)[number];

export const GST_HST_POSITIONS = ['taxed', 'zero_rated', 'missing'] as const;
export type GstHstPosition = (typeof GST_HST_POSITIONS)[number];

export const GST_HST_POSITION_WHYS = [
  'stripe_did_not_work_out', 'canadian_buyer_not_charged', 'no_evidence_for_zero_rating', 'unexpected_reason',
] as const;
export type GstHstPositionWhy = (typeof GST_HST_POSITION_WHYS)[number];

export const CHARGE_RECORD_STATUSES = ['open', 'paid', 'void', 'uncollectible'] as const;
export type ChargeRecordStatus = (typeof CHARGE_RECORD_STATUSES)[number];

/** Stripe's reasons that mean the Canadian line was RATED (a tax applied, even at $0 on a $0 trial). */
const RATED_REASONS = new Set([
  'standard_rated', 'reduced_rated', 'proportionally_rated', 'portion_standard_rated', 'portion_reduced_rated', 'taxable_basis_reduced',
]);

/** One tax line as stored (jsonb, snake_case so Stage 4 can sum it in SQL). */
export type StoredTaxLine = {
  source: 'stripe' | 'ours';
  name: string;
  tax_type: string | null;
  jurisdiction: string | null;
  jurisdiction_level: string | null;
  country: string | null;
  region: string | null;
  rate: number | null;
  effective_rate: number | null;
  taxable_cents: number;
  cents: number;
  taxability_reason: string | null;
  tax_rate_id: string | null;
  tax_behavior: string | null;
};

/** A Stripe tax rate as `expand: [...tax_rate_details.tax_rate]` gives it (or a bare id when not expanded). */
type RateLike = string | {
  id: string; display_name?: string | null; tax_type?: string | null; jurisdiction?: string | null; jurisdiction_level?: string | null;
  country?: string | null; state?: string | null; percentage?: number | null; effective_percentage?: number | null;
} | null | undefined;

export type TotalTaxLike = {
  amount: number;
  taxable_amount?: number | null;
  taxability_reason?: string | null;
  tax_behavior?: string | null;
  tax_rate_details?: { tax_rate?: RateLike } | null;
};

const upper = (code: string | null | undefined): string | null => (code ? code.toUpperCase() : null);
const iso = (unix: number | null | undefined): string | null => (unix ? new Date(unix * 1000).toISOString() : null);
export const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === 'string' ? value : value?.id ?? null;

/** When an invoice was issued (finalized; else its effective date; else made), or a credit note (effective; else made). The ONE
 *  rule for both the stored `issued_at` and the day its CAD rate is read for. */
export const invoiceIssuedAt = (inv: Pick<InvoiceLike, 'status_transitions' | 'effective_at' | 'created'>): string | null =>
  iso(inv.status_transitions?.finalized_at) ?? iso(inv.effective_at) ?? iso(inv.created);
export const noteIssuedAt = (note: Pick<CreditNoteLike, 'effective_at' | 'created'>): string => iso(note.effective_at) ?? iso(note.created)!;

/** An invoice's or note's figures: before tax, tax (the sum of Stripe's `total_taxes`), and total. */
export function amountsOf(doc: { total: number; total_excluding_tax?: number | null; total_taxes?: ReadonlyArray<{ amount: number }> | null }):
  { beforeTax: number; tax: number; total: number } {
  const tax = (doc.total_taxes ?? []).reduce((sum, t) => sum + t.amount, 0);
  return { beforeTax: doc.total_excluding_tax ?? doc.total - tax, tax, total: doc.total };
}

/** Stripe's `total_taxes`, one stored line each, in Stripe's order. A rate that was not expanded keeps only its id. */
export function storedTaxLines(totalTaxes: ReadonlyArray<TotalTaxLike> | null | undefined): StoredTaxLine[] {
  return (totalTaxes ?? []).map(t => {
    const ref = t.tax_rate_details?.tax_rate;
    const rate = ref && typeof ref === 'object' ? ref : null;
    return {
      source: 'stripe',
      name: rate?.display_name?.trim() || 'Tax',
      tax_type: rate?.tax_type ?? null,
      jurisdiction: rate?.jurisdiction ?? null,
      jurisdiction_level: rate?.jurisdiction_level ?? null,
      country: upper(rate?.country),
      region: upper(rate?.state),
      rate: rate?.percentage ?? null,
      effective_rate: rate?.effective_percentage ?? null,
      taxable_cents: t.taxable_amount ?? 0,
      cents: t.amount,
      taxability_reason: t.taxability_reason ?? null,
      tax_rate_id: idOf(ref ?? null),
      tax_behavior: t.tax_behavior ?? null,
    };
  });
}

/** A line of Canadian GST or HST (Stripe makes one per rate; QST and the provincial PSTs are not ours to answer here). */
export const isCanadianGstHst = (line: Pick<StoredTaxLine, 'country' | 'tax_type'>): boolean =>
  line.country === 'CA' && (line.tax_type === 'gst' || line.tax_type === 'hst');

/** The buyer's evidence as it stood when the record was written (lib/billing-location-server.ts `readSaleEvidence`). */
export type SaleEvidence = {
  location: StoredBillingLocation | null;
  cardCountry: string | null;
  payoutCountry: string | null;
  review: { reason: ReviewReason; note: string } | null;
};

/**
 * OUR answer for Canadian GST/HST, from Stripe's lines, the place Stripe taxed and our evidence. In order:
 *   1. Stripe did not work the tax out (automatic tax off, or not `complete`) → missing.
 *   2. A Canadian GST/HST line Stripe rated → taxed. Stripe's own `zero_rated` on it → zero_rated.
 *   3. Placed in Canada (or nowhere) with no rated line → missing: a Canadian buyer was not charged (e.g. a live account with no
 *      Canada registration, where Stripe answers `not_collecting`).
 *   4. Placed outside Canada → zero_rated only when OUR evidence is a US address with the US declaration ticked, in the same
 *      country Stripe placed; anything less → missing (we cannot show why it was not taxed). How strong that evidence is (a
 *      US card or payouts, a review flag) is Part 3's "needs a look", not this answer.
 *   5. A Canadian line with any other reason → missing (unexpected).
 */
export function gstHstPosition(facts: {
  taxWorkedOut: boolean;
  placeCountry: string | null;
  lines: ReadonlyArray<StoredTaxLine>;
  evidence: SaleEvidence | null;
}): { position: GstHstPosition; why: GstHstPositionWhy | null } {
  if (!facts.taxWorkedOut) return { position: 'missing', why: 'stripe_did_not_work_out' };
  const canadian = facts.lines.filter(isCanadianGstHst);
  if (canadian.some(l => l.taxability_reason && RATED_REASONS.has(l.taxability_reason))) return { position: 'taxed', why: null };
  if (canadian.some(l => l.taxability_reason === 'zero_rated')) return { position: 'zero_rated', why: null };
  const place = upper(facts.placeCountry);
  if (!place || place === 'CA') {
    return canadian.length === 0 || canadian.some(l => l.taxability_reason === 'not_collecting')
      ? { position: 'missing', why: 'canadian_buyer_not_charged' }
      : { position: 'missing', why: 'unexpected_reason' };
  }
  const loc = facts.evidence?.location;
  if (loc && loc.country === 'US' && place === 'US' && loc.usDeclarationVersion && loc.usDeclarationAt) {
    return { position: 'zero_rated', why: null };
  }
  return { position: 'missing', why: 'no_evidence_for_zero_rating' };
}

/** Our 0% Canadian line on a sale we zero-rated (Stripe shows none for a buyer outside Canada), so Stage 4 totals it. */
export function zeroRatedLine(beforeTaxCents: number): StoredTaxLine {
  return {
    source: 'ours', name: 'GST/HST', tax_type: 'gst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA', region: null,
    rate: 0, effective_rate: 0, taxable_cents: beforeTaxCents, cents: 0, taxability_reason: 'zero_rated', tax_rate_id: null, tax_behavior: null,
  };
}

/** How a record was captured: at the time (the webhook, a note maker), by the daily catch-up, or by the one-time backfill (Stage 4
 *  Ask 11, owner 2026-11-06). Only `event` is evidence as at the sale. */
export const EVIDENCE_CAPTURED = ['event', 'catch_up', 'backfill'] as const;
export type EvidenceCaptured = (typeof EVIDENCE_CAPTURED)[number];

/** The first issue date the backfill copies from: the GST/HST registration date with CRA's pending backdate (Sept 26 → May 1, 2026;
 *  nothing was sold before either, so the earlier floor covers both). */
export const BACKFILL_FLOOR_ISO = '2026-05-01T00:00:00-04:00';

// ── Currency (Stage 4 Ask 4, owner 2026-11-06; docs/agents/accounting/GST_HST_RETURN_LINES.md §5) ─────────────────────────────

/** A non-CAD sale's rate: CAD per unit, and the Bank of Canada date it is for. */
export type FxRate = { rate: number; date: string };

/** The Bank of Canada series for a currency against CAD ("usd" → "FXUSDCAD"). */
export const valetSeries = (currency: string): string => `FX${currency.toUpperCase()}CAD`;

/**
 * The rate for a day from Bank of Canada Valet observations (`[{ d: 'YYYY-MM-DD', FXUSDCAD: { v: '1.3912' } }]`): that day's, else the
 * nearest business day BEFORE it (a weekend or holiday has none: Memo 3-6). Null when none is on or before the day.
 */
export function rateFromValet(
  observations: ReadonlyArray<{ d: string } & Record<string, unknown>>,
  series: string,
  onOrBefore: string,
): FxRate | null {
  let best: FxRate | null = null;
  for (const o of observations) {
    const v = Number((o[series] as { v?: string } | undefined)?.v);
    if (!o.d || o.d > onOrBefore || !Number.isFinite(v) || v <= 0) continue;
    if (!best || o.d > best.date) best = { rate: v, date: o.d };
  }
  return best;
}

/** Cents × rate, rounded half away from zero (a negative proration credit rounds like its positive). The product is cut to 15
 *  significant digits first, so a true half cent that binary arithmetic lands a hair under (100 × 1.005 = 100.49999…) still rounds
 *  up. Never -0. */
const toCad = (cents: number, rate: number): number => {
  const magnitude = Math.round(Number((Math.abs(cents) * rate).toPrecision(15)));
  return cents < 0 && magnitude !== 0 ? -magnitude : magnitude;
};

export type CadValuation = {
  fx_rate: number | null; fx_rate_date: string | null; fx_source: 'same_currency' | 'bank_of_canada' | null;
  cad_amount_before_tax_cents: number | null; cad_tax_total_cents: number | null; cad_total_cents: number | null;
};

/** The CAD figures beside the original ones: a CAD sale is itself (rate 1, dated the Ontario day it was issued: our place of
 *  business); another currency needs its rate (null = not yet valued). */
export function cadValuation(
  currency: string,
  amounts: { beforeTax: number; tax: number; total: number },
  issuedAt: string,
  fx: FxRate | null,
): CadValuation {
  if (currency.toLowerCase() === 'cad') {
    return { fx_rate: 1, fx_rate_date: orgDayKey(issuedAt), fx_source: 'same_currency',
      cad_amount_before_tax_cents: amounts.beforeTax, cad_tax_total_cents: amounts.tax, cad_total_cents: amounts.total };
  }
  if (!fx) return { fx_rate: null, fx_rate_date: null, fx_source: null, cad_amount_before_tax_cents: null, cad_tax_total_cents: null, cad_total_cents: null };
  return { fx_rate: fx.rate, fx_rate_date: fx.date, fx_source: 'bank_of_canada',
    cad_amount_before_tax_cents: toCad(amounts.beforeTax, fx.rate), cad_tax_total_cents: toCad(amounts.tax, fx.rate), cad_total_cents: toCad(amounts.total, fx.rate) };
}

/** What the writer passes in beside Stripe's invoice. */
export type RecordContext = {
  kind: ChargeTaxKind;
  buyer: { kind: 'club'; orgId: string } | { kind: 'person'; userId: string; orgId: string | null } | { kind: 'unknown'; orgId: string | null };
  evidence: SaleEvidence | null;
  /** When the evidence was read (now, in the writer). */
  readAt: string;
  captured: EvidenceCaptured;
  /** The Bank of Canada rate for the issue date, for a non-CAD invoice (ignored for CAD). */
  fx: FxRate | null;
};

/** The subset of a Stripe invoice the builder reads (retrieved with the tax rates and payments expanded). */
export type InvoiceLike = {
  id: string;
  livemode: boolean;
  status: string | null;
  number?: string | null;
  customer: string | { id: string } | null;
  customer_name?: string | null;
  customer_address?: { country?: string | null; state?: string | null; postal_code?: string | null } | null;
  currency: string;
  total: number;
  total_excluding_tax?: number | null;
  total_taxes?: ReadonlyArray<TotalTaxLike> | null;
  automatic_tax?: { enabled?: boolean | null; status?: string | null } | null;
  effective_at?: number | null;
  created?: number | null;
  status_transitions?: { finalized_at?: number | null; paid_at?: number | null; voided_at?: number | null; marked_uncollectible_at?: number | null } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  payments?: { data?: ReadonlyArray<{ status?: string | null; payment?: { payment_intent?: string | { id: string } | null } | null }> } | null;
};

/** The columns that may change after a record is written (the guard trigger's list). */
export type ChargeRecordState = {
  status: ChargeRecordStatus;
  paid_at: string | null;
  voided_at: string | null;
  uncollectible_at: string | null;
  stripe_payment_intent_id: string | null;
};

/** An invoice's payment state, or null for a draft (not issued, so nothing is owed or recorded yet). */
export function chargeRecordState(inv: InvoiceLike): ChargeRecordState | null {
  const status = inv.status as ChargeRecordStatus | null;
  if (!status || !(CHARGE_RECORD_STATUSES as readonly string[]).includes(status)) return null;
  const paidPayment = (inv.payments?.data ?? []).find(p => p.status === 'paid') ?? null;
  const t = inv.status_transitions ?? {};
  return {
    status,
    paid_at: iso(t.paid_at),
    voided_at: iso(t.voided_at),
    uncollectible_at: iso(t.marked_uncollectible_at),
    stripe_payment_intent_id: idOf(paidPayment?.payment?.payment_intent ?? null),
  };
}

export type ChargeTaxRecordRow = ChargeRecordState & CadValuation & {
  evidence_captured: EvidenceCaptured;
  stripe_invoice_id: string; livemode: boolean; kind: ChargeTaxKind;
  org_id: string | null; user_id: string | null; buyer_kind: 'club' | 'person' | 'unknown'; buyer_name: string | null;
  stripe_customer_id: string; stripe_subscription_id: string | null; invoice_number: string | null;
  issued_at: string; currency: string; amount_before_tax_cents: number; tax_total_cents: number; total_cents: number;
  tax_lines: StoredTaxLine[]; stripe_tax_status: string | null;
  gst_hst_position: GstHstPosition; gst_hst_position_why: GstHstPositionWhy | null;
  taxed_country: string | null; taxed_region: string | null; taxed_postal_code: string | null;
  evidence_missing: boolean; evidence_country: string | null; evidence_region: string | null; evidence_line1: string | null;
  evidence_line2: string | null; evidence_city: string | null; evidence_postal_code: string | null; evidence_confirmed_at: string | null;
  us_declaration_version: string | null; us_declaration_at: string | null; card_country: string | null; payout_country: string | null;
  review_reason: string | null; review_note: string | null; evidence_read_at: string;
};

/** The whole row for a first write. Null for a draft or an invoice with no customer (nothing to record). */
export function buildChargeTaxRecord(inv: InvoiceLike, ctx: RecordContext): ChargeTaxRecordRow | null {
  const state = chargeRecordState(inv);
  const customer = idOf(inv.customer);
  if (!state || !customer) return null;
  const issued = invoiceIssuedAt(inv);
  if (!issued) return null;

  const stripeLines = storedTaxLines(inv.total_taxes);
  const amounts = amountsOf(inv);
  const { beforeTax, tax: taxTotal } = amounts;
  const place = inv.customer_address ?? null;
  const { position, why } = gstHstPosition({
    taxWorkedOut: taxWasWorkedOut(inv.automatic_tax), placeCountry: place?.country ?? null, lines: stripeLines, evidence: ctx.evidence,
  });
  const lines = position === 'zero_rated' && !stripeLines.some(isCanadianGstHst) ? [...stripeLines, zeroRatedLine(beforeTax)] : stripeLines;

  const loc = ctx.evidence?.location ?? null;
  const b = ctx.buyer;
  return {
    ...state,
    ...cadValuation(inv.currency, amounts, issued, ctx.fx),
    evidence_captured: ctx.captured,
    stripe_invoice_id: inv.id,
    livemode: inv.livemode,
    kind: ctx.kind,
    org_id: b.orgId,
    user_id: b.kind === 'person' ? b.userId : null,
    buyer_kind: b.kind,
    // Kept within the column's limit: a name typed in Stripe's dashboard must never leave an invoice unrecorded.
    buyer_name: inv.customer_name?.trim().slice(0, 300) || null,
    stripe_customer_id: customer,
    stripe_subscription_id: idOf(inv.parent?.subscription_details?.subscription ?? null),
    invoice_number: inv.number || null,
    issued_at: issued,
    currency: inv.currency.toLowerCase(),
    amount_before_tax_cents: beforeTax,
    tax_total_cents: taxTotal,
    total_cents: inv.total,
    tax_lines: lines,
    stripe_tax_status: inv.automatic_tax?.enabled ? inv.automatic_tax.status ?? null : null,
    gst_hst_position: position,
    gst_hst_position_why: why,
    taxed_country: upper(place?.country),
    taxed_region: upper(place?.state),
    taxed_postal_code: place?.postal_code ?? null,
    evidence_missing: !loc,
    evidence_country: loc?.country ?? null,
    evidence_region: loc?.regionCode ?? null,
    evidence_line1: loc?.line1 ?? null,
    evidence_line2: loc?.line2 ?? null,
    evidence_city: loc?.city ?? null,
    evidence_postal_code: loc?.postalCode ?? null,
    evidence_confirmed_at: loc?.confirmedAt ?? null,
    us_declaration_version: loc?.usDeclarationVersion ?? null,
    us_declaration_at: loc?.usDeclarationAt ?? null,
    card_country: upper(ctx.evidence?.cardCountry),
    payout_country: upper(ctx.evidence?.payoutCountry),
    review_reason: ctx.evidence?.review?.reason ?? null,
    review_note: ctx.evidence?.review?.note ?? null,
    evidence_read_at: ctx.readAt,
  };
}

/** Which kind of invoice this is: the fee marker first, then who buys (a person = Premium), then whether it bills a plan. */
export function chargeTaxKind(facts: { feeInvoice: boolean; buyerKind: 'club' | 'person' | 'unknown'; subscriptionId: string | null }): ChargeTaxKind {
  if (facts.feeInvoice) return 'fee';
  if (facts.buyerKind === 'person') return 'premium';
  return facts.subscriptionId ? 'subscription' : 'one_off';
}

// ── Credit notes ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type CreditNoteLike = {
  id: string;
  livemode: boolean;
  invoice: string | { id: string } | null;
  customer: string | { id: string } | null;
  number?: string | null;
  type?: string | null;
  reason?: string | null;
  status: string;
  currency: string;
  total: number;
  total_excluding_tax?: number | null;
  total_taxes?: ReadonlyArray<TotalTaxLike> | null;
  refunds?: ReadonlyArray<{ amount_refunded?: number | null }> | null;
  out_of_band_amount?: number | null;
  effective_at?: number | null;
  created: number;
  voided_at?: number | null;
};

export type CreditNoteTaxRecordRow = CadValuation & {
  evidence_captured: EvidenceCaptured;
  stripe_credit_note_id: string; stripe_invoice_id: string; livemode: boolean; kind: ChargeTaxKind | null;
  org_id: string | null; user_id: string | null; stripe_customer_id: string; note_number: string | null;
  note_type: 'pre_payment' | 'post_payment' | 'mixed'; stripe_reason: string | null; issued_at: string; currency: string;
  amount_before_tax_cents: number; tax_total_cents: number; total_cents: number; tax_lines: StoredTaxLine[];
  refund_cents: number; out_of_band_cents: number; status: 'issued' | 'void'; voided_at: string | null;
};

/** A credit note's row. Null when it names no invoice or customer. `owner` is copied from the invoice's own record when there is one;
 *  a non-CAD note is valued at the rate for its OWN issue date. */
export function buildCreditNoteTaxRecord(
  note: CreditNoteLike,
  owner: { kind: ChargeTaxKind | null; orgId: string | null; userId: string | null },
  how: { captured: EvidenceCaptured; fx: FxRate | null } = { captured: 'event', fx: null },
): CreditNoteTaxRecordRow | null {
  const invoice = idOf(note.invoice);
  const customer = idOf(note.customer);
  if (!invoice || !customer) return null;
  const lines = storedTaxLines(note.total_taxes);
  const amounts = amountsOf(note);
  const { beforeTax, tax: taxTotal } = amounts;
  const type = note.type === 'pre_payment' || note.type === 'post_payment' || note.type === 'mixed' ? note.type : 'post_payment';
  const status = note.status === 'void' ? 'void' : 'issued';
  const issued = noteIssuedAt(note);
  return {
    ...cadValuation(note.currency, amounts, issued, how.fx),
    evidence_captured: how.captured,
    stripe_credit_note_id: note.id,
    stripe_invoice_id: invoice,
    livemode: note.livemode,
    kind: owner.kind,
    org_id: owner.orgId,
    user_id: owner.userId,
    stripe_customer_id: customer,
    note_number: note.number || null,
    note_type: type,
    stripe_reason: note.reason ?? null,
    issued_at: issued,
    currency: note.currency.toLowerCase(),
    amount_before_tax_cents: beforeTax,
    tax_total_cents: taxTotal,
    total_cents: note.total,
    tax_lines: lines,
    refund_cents: (note.refunds ?? []).reduce((sum, r) => sum + (r.amount_refunded ?? 0), 0),
    out_of_band_cents: note.out_of_band_amount ?? 0,
    status,
    voided_at: status === 'void' ? (iso(note.voided_at) ?? new Date().toISOString()) : null,
  };
}

/** The invoice and credit-note events the billing webhook hands the writer (the live endpoint needs each: MANUAL_PROD_STEPS 451). */
export const CHARGE_TAX_INVOICE_EVENTS = [
  'invoice.finalized', 'invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed', 'invoice.voided', 'invoice.marked_uncollectible',
] as const;
export const CHARGE_TAX_CREDIT_NOTE_EVENTS = ['credit_note.created', 'credit_note.updated', 'credit_note.voided'] as const;
