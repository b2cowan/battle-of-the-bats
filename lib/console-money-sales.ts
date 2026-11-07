/**
 * THE MONEY TAB LISTS SALES, NOT CHARGES (GST/HST Stage 3 Part 2; owner rulings 2026-11-06, all eight Asks A; drawings
 * docs/projects/active/GST_HST_STAGE3_PART2_DRAWINGS.html). Pure, shared by the screen, the routes and the tests:
 *   · one row per SALE (a Stripe invoice), read from our kept tax record (lib/charge-tax-record.ts), with Stripe's payments
 *     joined in when Stripe answers. A charge joins its sale by its invoice, else by its payment (the record keeps
 *     `stripe_payment_intent_id`). Failed tries fold under their sale. A charge with no invoice still shows ("No tax record").
 *   · every word the list and the sale's window say about tax (one home; spelling-gated).
 * Ask 2: when Stripe cannot be read the rows come from our record alone; the reverse (our records fail) falls back to the
 * shipped charge list in the screen. The registration date is the changeable Stage 4a setting, read by the route; null = it
 * could not be read, and then an untaxed sale is never called "Tax missing".
 */
import { consoleDate, consoleDay } from './console-dates';
import { orgDayKey } from './timezone';
import { countryInfo, regionName, type StoredBillingLocation } from './billing-location';
import { brandLabel, STRIPE_FEE_WORDS } from './online-payment-words';
import {
  BACKFILL_FLOOR_ISO, isCanadianGstHst, isRatedTaxReason,
  type ChargeTaxRecordRow, type CreditNoteTaxRecordRow, type StoredTaxLine,
} from './charge-tax-record';
import {
  BAND_WORDS, isCountedRefund, chargeFailureWords, failedBillOf, invoicePaidForWords, nextTryShort, stripeSaysWords,
  type BandCell, type ChargeCreditNote, type ChargeFlag, type MoneyCharge, type MoneyInvoice, type Patterns,
} from './console-money';

// ── The shapes the route hands the screen (our record; read for the Stripe-reading roles only, Ask 7) ─────────────

/** The columns the Money tab reads from `platform_charge_tax_records` (no buyer name, no user id: not shown). */
export const SALE_RECORD_COLUMNS = [
  'stripe_invoice_id', 'livemode', 'kind', 'stripe_customer_id', 'stripe_subscription_id', 'stripe_payment_intent_id', 'invoice_number',
  'issued_at', 'currency', 'amount_before_tax_cents', 'tax_total_cents', 'total_cents', 'refunded_cents', 'tax_lines',
  'gst_hst_position', 'gst_hst_position_why', 'status', 'paid_at', 'voided_at', 'uncollectible_at',
  'taxed_country', 'taxed_region', 'taxed_postal_code', 'evidence_missing', 'evidence_country', 'evidence_region', 'evidence_line1',
  'evidence_line2', 'evidence_city', 'evidence_postal_code', 'us_declaration_version', 'us_declaration_at', 'card_country',
  'payout_country', 'review_reason', 'review_note', 'evidence_read_at', 'evidence_captured',
  'fx_rate', 'fx_rate_date', 'cad_amount_before_tax_cents', 'cad_tax_total_cents', 'cad_total_cents',
].join(', ');

export type SaleRecord = Pick<ChargeTaxRecordRow,
  | 'stripe_invoice_id' | 'livemode' | 'kind' | 'stripe_customer_id' | 'stripe_subscription_id' | 'stripe_payment_intent_id' | 'invoice_number'
  | 'issued_at' | 'currency' | 'amount_before_tax_cents' | 'tax_total_cents' | 'total_cents' | 'tax_lines'
  | 'gst_hst_position' | 'gst_hst_position_why' | 'status' | 'paid_at' | 'voided_at' | 'uncollectible_at'
  | 'taxed_country' | 'taxed_region' | 'taxed_postal_code' | 'evidence_missing' | 'evidence_country' | 'evidence_region' | 'evidence_line1'
  | 'evidence_line2' | 'evidence_city' | 'evidence_postal_code' | 'us_declaration_version' | 'us_declaration_at' | 'card_country'
  | 'payout_country' | 'review_reason' | 'review_note' | 'evidence_read_at' | 'evidence_captured'
  | 'fx_rate' | 'fx_rate_date' | 'cad_amount_before_tax_cents' | 'cad_tax_total_cents' | 'cad_total_cents'
> & { refunded_cents: number };

// `note_type` and `refund_cents` (Part 4): a note issued before the sale was paid reduces the bill, not the refunds; the cents a note
// sent back through Stripe say how much of a sale's Stripe refunds the note already explains.
export const SALE_NOTE_COLUMNS = 'stripe_credit_note_id, stripe_invoice_id, note_number, issued_at, currency, amount_before_tax_cents, tax_total_cents, total_cents, tax_lines, status, note_type, refund_cents';

export type SaleNoteRecord = Pick<CreditNoteTaxRecordRow,
  'stripe_credit_note_id' | 'stripe_invoice_id' | 'note_number' | 'issued_at' | 'currency' | 'amount_before_tax_cents' | 'tax_total_cents' | 'total_cents' | 'tax_lines' | 'status' | 'note_type' | 'refund_cents'>;

/**
 * Our records for the tab, or `failed` (the screen then shows Stripe's charges as shipped, Tax "Not read").
 * `bandNotes` (Part 4, the first page only): every credit note ISSUED in the twelve months, whatever sale it is on, so a note on an
 * older sale still counts in the period it was issued (the GST/HST return's rule). Optional so a page of older sales, which does
 * not read it, still fits.
 */
export type SalesRecords =
  | { state: 'read'; sales: SaleRecord[]; notes: SaleNoteRecord[]; olderBefore: string | null; bandNotes?: SaleNoteRecord[] }
  | { state: 'failed' };

// ── The join ────────────────────────────────────────────────────────────────────────────────────

export type SaleRow = {
  /** The invoice's id, or a bare charge's own id. */
  key: string;
  /** When it was sold: the record's issue time, else Stripe's (a record not written yet), else the bare charge's. */
  at: string;
  record: SaleRecord | null;
  /** Stripe's invoice (null when Stripe was not read, or for a bare charge). */
  invoice: MoneyInvoice | null;
  /** Every charge of this sale, oldest first. */
  charges: MoneyCharge[];
  /** The charge that paid it (the newest that did not fail), or null. */
  paid: MoneyCharge | null;
  /** Its failed tries, oldest first. */
  failed: MoneyCharge[];
  /** Its credit notes as we kept them (issued only). */
  notes: SaleNoteRecord[];
  /** A charge made in Stripe with no invoice: no tax record can exist. */
  bare: boolean;
  /**
   * Stripe was read but this sale's charge may be among those it did not load (the read was capped, and the sale is older than the
   * oldest charge reached). The row then speaks from our record, never "outside Stripe".
   */
  chargeUnread: boolean;
};

const byNewest = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);
const uniq = <T>(items: readonly T[], key: (t: T) => string) => [...new Map(items.map(t => [key(t), t])).values()];

/**
 * Records + Stripe → one row per sale, newest first. `charges` null = Stripe was not read (rows from our record alone).
 * `shownFrom`: the oldest window read; a Stripe invoice with neither a record nor a charge shows only inside it, and only from
 * the day our records begin (before that the list is Stripe's charges, as shipped).
 */
export function joinSales(input: {
  records: readonly SaleRecord[];
  notes: readonly SaleNoteRecord[];
  charges: readonly MoneyCharge[] | null;
  invoices: readonly MoneyInvoice[];
  shownFrom: string | null;
  /** The instant Stripe's charges are complete down to (MoneyRead.chargesFrom of the last page read); null when not known. */
  chargesFrom?: string | null;
}): SaleRow[] {
  const records = new Map(uniq(input.records, r => r.stripe_invoice_id).map(r => [r.stripe_invoice_id, r]));
  const byIntent = new Map([...records.values()].filter(r => r.stripe_payment_intent_id).map(r => [r.stripe_payment_intent_id!, r.stripe_invoice_id]));
  const invoices = new Map(uniq(input.invoices, i => i.id).map(i => [i.id, i]));
  const notes = uniq(input.notes, n => n.stripe_credit_note_id).filter(n => n.status === 'issued');

  const chargesOf = new Map<string, MoneyCharge[]>();
  const bare: MoneyCharge[] = [];
  for (const c of uniq(input.charges ?? [], c => c.id)) {
    const invoiceId = c.invoice?.id ?? (c.paymentIntentId ? byIntent.get(c.paymentIntentId) : undefined);
    if (!invoiceId) { bare.push(c); continue; }
    chargesOf.set(invoiceId, [...(chargesOf.get(invoiceId) ?? []), c]);
    if (c.invoice && !invoices.has(invoiceId)) invoices.set(invoiceId, c.invoice);
  }

  const floor = Date.parse(BACKFILL_FLOOR_ISO);
  const from = input.shownFrom ? Date.parse(input.shownFrom) : floor;
  const keys = new Set<string>([...records.keys(), ...chargesOf.keys()]);
  if (input.charges) {
    for (const inv of invoices.values()) {
      const at = inv.issuedAt ? Date.parse(inv.issuedAt) : NaN;
      if (!keys.has(inv.id) && inv.status && inv.status !== 'draft' && at >= floor && at >= from) keys.add(inv.id);
    }
  }

  const rows: SaleRow[] = [];
  for (const key of keys) {
    const record = records.get(key) ?? null;
    const invoice = input.charges ? invoices.get(key) ?? null : null;
    const charges = [...(chargesOf.get(key) ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const at = record?.issued_at ?? invoice?.issuedAt ?? charges[0]?.createdAt;
    if (!at) continue;
    rows.push({
      key, at, record, invoice, charges, bare: false,
      chargeUnread: !!input.charges && !charges.length && !!input.chargesFrom && Date.parse(at) < Date.parse(input.chargesFrom),
      paid: [...charges].reverse().find(c => c.status !== 'failed') ?? null,
      failed: charges.filter(c => c.status === 'failed'),
      notes: notes.filter(n => n.stripe_invoice_id === key),
    });
  }
  for (const c of bare) {
    rows.push({ key: c.id, at: c.createdAt, record: null, invoice: null, charges: [c], bare: true, chargeUnread: false,
      paid: c.status === 'failed' ? null : c, failed: c.status === 'failed' ? [c] : [], notes: [] });
  }
  return rows.sort(byNewest);
}

/** The sale's state: Stripe's when it was read (fresher), else our record's. */
const saleStatus = (row: SaleRow): string | null => row.invoice?.status ?? row.record?.status ?? null;
export const isVoidSale = (row: SaleRow): boolean => saleStatus(row) === 'void';
/** "Not paid" (owner 2026-11-06, Part 2 gap 5): open or written off, never void. */
export const isUnpaidSale = (row: SaleRow): boolean => {
  const s = saleStatus(row);
  return s === 'open' || s === 'uncollectible';
};

/** The sale's total and its currency: our record's, else Stripe's invoice, else the charge's. */
export function saleAmount(row: SaleRow): { cents: number; currency: string } {
  const last = row.paid ?? row.charges[row.charges.length - 1];
  return {
    cents: row.record?.total_cents ?? row.invoice?.totalCents ?? last?.amountCents ?? 0,
    currency: row.record?.currency ?? row.invoice?.currency ?? last?.currency ?? 'cad',
  };
}

/**
 * The flag line under a sale (the shipped "charged twice" recipe), from the duplicate check on Stripe's charges. "Tried again
 * and it paid" and "not the subscription's" are not lines here: the row's own sub-lines say them (drawing tab 2, rows 9–11).
 */
export function saleFlag(row: SaleRow, patterns: Patterns): { flag: ChargeFlag; chargeId: string } | null {
  const found = row.charges
    .map(c => ({ flag: patterns.flags.get(c.id), chargeId: c.id }))
    .filter((f): f is { flag: ChargeFlag; chargeId: string } => !!f.flag && f.flag.kind !== 'retry_paid' && f.flag.kind !== 'not_subscription');
  return found.find(f => f.flag.kind === 'duplicate') ?? found[0] ?? null;
}

// ── Words: money, places ────────────────────────────────────────────────────────────────────────

/** "$100.01", "US$99.00": a sale in another currency names it (a CAD sale keeps the plain dollar sign). */
export function saleCents(cents: number, currency: string): string {
  const cur = currency.toUpperCase();
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: cur, currencyDisplay: cur === 'CAD' ? 'narrowSymbol' : 'symbol' })
    .format(cents / 100);
}

const countryName = (code: string | null | undefined): string | null => (code ? countryInfo(code)?.name ?? code : null);
/** "the United States" in a sentence ("Card from the United States"). */
const countryInSentence = (code: string): string => (code === 'US' ? 'the United States' : countryName(code)!);
/** The province or state Stripe taxed for, by name ("Ontario"); a hand-made invoice may have spelled it out. */
function placeName(country: string | null, region: string | null): string | null {
  return regionName(country, region) ?? region ?? countryName(country);
}

const rateText = (rate: number | null) => (rate == null ? '' : ` ${Number(rate)}%`);
/** "HST 13%", "Sales Tax 8.875%": the line named as Stripe names it, with its rate. */
const taxLineName = (line: Pick<StoredTaxLine, 'name' | 'rate'>): string => `${line.name}${rateText(line.rate)}`;
/** The lines Stripe actually charged (rated, even at $0); a not-collected line is in the window only. */
const chargedLines = (record: SaleRecord) => record.tax_lines.filter(l => l.source === 'stripe' && isRatedTaxReason(l.taxability_reason));

// ── Before we registered ────────────────────────────────────────────────────────────────────────

/**
 * Issued before our GST/HST registration took effect (the Stage 4a setting, a `YYYY-MM-DD` day in Toronto): no GST/HST was owed.
 * Before the day our records begin is always before it (the floor covers either registration date). `registration` null = the
 * setting could not be read: only the floor can answer.
 */
export function beforeRegistration(issuedAt: string, registration: string | null): boolean {
  if (Date.parse(issuedAt) < Date.parse(BACKFILL_FLOOR_ISO)) return true;
  return !!registration && orgDayKey(issuedAt) < registration;
}

export const SALES_WORDS = {
  registrationUnread: 'The GST/HST registration date could not be read, so sales without tax are not sorted.',
  recordsFailed: (clock: string) => `Our tax records could not be read at ${clock}. The charges below are Stripe’s.`,
  bothFailed: (clock: string) => `Stripe and our tax records could not be read at ${clock}. Our subscription record is below; the sales, charges, any failed payment and refunds wait until they answer.`,
  unreachable: (clock: string) => `Stripe could not be read at ${clock}. The sales below are from our own record. The card, Stripe’s latest word on each payment, any failed payment and when Stripe tries again, the next charge and refunds wait until it answers.`,
  refundsWait: 'Refunds wait until Stripe answers.',
  notReadFromStripe: 'Not read from Stripe',
  addressChanged: 'The billing address has changed since.',
  emptyAll: 'No sales in these 12 months.',
  emptyUnpaid: 'Every sale in these 12 months is paid.',
  count: (n: number, filter: 'all' | 'unpaid', paged: boolean) => filter === 'unpaid'
    ? `${n} sale${n === 1 ? '' : 's'} not paid, newest first`
    : `${n} sale${n === 1 ? '' : 's'} ${paged ? 'read' : 'in the last 12 months'}, newest first`,
  showOlder: 'Show older sales',
  filters: { all: 'All sales', unpaid: 'Not paid' },
} as const;

// ── The row's cells ─────────────────────────────────────────────────────────────────────────────

/** The row's "What it paid for": Stripe's invoice words when it was read, else what our record knows (gap 1 = A). */
export function saleWhatWords(row: SaleRow): { main: string; period: string | null } {
  if (row.bare) return { main: 'A charge made in Stripe, not by an invoice', period: null };
  const inv = row.invoice;
  if (inv) {
    const words = invoicePaidForWords(inv, inv.currency ?? row.record?.currency ?? 'cad', { withTax: false });
    if (!inv.feeInvoice && !inv.subscriptionId) return { ...words, period: 'Not the subscription’s' };
    if (inv.feeInvoice && saleStatus(row) === 'open' && inv.dueDate) return { ...words, period: `Issued ${consoleDay(row.at)} · due ${consoleDay(inv.dueDate)}` };
    return words;
  }
  const r = row.record!;
  const no = r.invoice_number;
  switch (r.kind) {
    case 'fee': return { main: STRIPE_FEE_WORDS.paCharge(no), period: null };
    case 'premium': return { main: `Coach Premium${no ? ` · invoice ${no}` : ''}`, period: null };
    case 'one_off': return { main: `Invoice made in Stripe${no ? ` · ${no}` : ''}`, period: null };
    default: return { main: `The subscription${no ? ` · invoice ${no}` : ''}`, period: null };
  }
}

export type TaxCell = { tone: 'plain' | 'quiet' | 'missing'; main: string; sub: string | null };

/** The row's Tax column (Ask 3 = A), from OUR record. `recordsRead` false = our records failed: "Not read". */
export function saleTaxCell(row: SaleRow, registration: string | null, recordsRead = true): TaxCell {
  if (!recordsRead) return { tone: 'quiet', main: 'Not read', sub: null };
  if (isVoidSale(row)) return { tone: 'quiet', main: '—', sub: null };
  if (row.bare) return { tone: 'quiet', main: 'No tax record', sub: 'not an invoice' };
  const r = row.record;
  const before = { tone: 'quiet' as const, main: 'Before we registered', sub: 'no GST/HST owed' };
  if (!r) return beforeRegistration(row.at, registration) ? before : { tone: 'quiet', main: 'No tax record', sub: 'not written yet' };
  const place = placeName(r.taxed_country, r.taxed_region);
  switch (r.gst_hst_position) {
    case 'taxed': {
      const lines = chargedLines(r);
      return { tone: 'plain', main: lines.length ? lines.map(taxLineName).join(' + ') : 'Taxed',
        sub: `${saleCents(r.tax_total_cents, r.currency)}${place ? ` · ${place}` : ''}` };
    }
    case 'zero_rated': return { tone: 'plain', main: 'Zero-rated', sub: countryName(r.taxed_country) };
    case 'missing':
      if (beforeRegistration(r.issued_at, registration)) return before;
      if (!registration) return { tone: 'quiet', main: 'Not taxed', sub: null };
      return { tone: 'missing', main: 'Tax missing', sub: place };
  }
}

export type SaysCell = { text: string; tone: 'plain' | 'warn' | 'bad' | 'quiet'; sub: string | null; void: boolean };

const triesSub = (failed: readonly MoneyCharge[]) => {
  const last = failed[failed.length - 1];
  return last ? `after ${failed.length} failed tr${failed.length === 1 ? 'y' : 'ies'}, ${consoleDay(last.createdAt)}` : null;
};
const fromShipped = (s: ReturnType<typeof stripeSaysWords>): SaysCell['tone'] => (s.tone === 'ok' ? 'plain' : s.tone);

/**
 * "Stripe says" for a sale, when Stripe was read. `readAt` (the list's read): a failed bill's second line says when Stripe
 * tries next, or that it has none scheduled (Plans & pricing Stage 2 Part 2); without it the line is left out.
 */
export function saleStripeSays(row: SaleRow, readAt?: string): SaysCell {
  const status = saleStatus(row);
  const cell = (text: string, tone: SaysCell['tone'], sub: string | null = null): SaysCell => ({ text, tone, sub, void: false });
  if (status === 'void') return { text: 'Void', tone: 'quiet', sub: null, void: true };
  if (row.paid) {
    const s = stripeSaysWords(row.paid);
    return cell(s.text, fromShipped(s), row.paid.status === 'succeeded' ? triesSub(row.failed.filter(f => f.createdAt < row.paid!.createdAt)) : null);
  }
  const currency = row.invoice?.currency ?? row.record?.currency ?? row.charges[0]?.currency ?? 'cad';
  const total = row.invoice?.totalCents ?? row.record?.total_cents ?? 0;
  if (status === 'uncollectible') {
    return cell(`Written off ${consoleDay(row.record?.uncollectible_at ?? row.invoice?.markedUncollectibleAt ?? null)}`, 'quiet');
  }
  if (status === 'open') {
    const owes = `Owes ${saleCents(row.invoice?.amountRemainingCents ?? total, currency)}`;
    const last = row.failed[row.failed.length - 1];
    const bill = readAt && row.invoice ? failedBillOf(row.invoice, row.charges, readAt) : null;
    if (last) return cell(`${owes} · ${chargeFailureWords(last)} ${consoleDay(last.createdAt)}`, 'bad', bill ? nextTryShort(bill.next) : null);
    if (bill) return cell(`${owes} · not paid`, 'bad', nextTryShort(bill.next));
    return cell(`${owes}${row.invoice?.dueDate ? ` · due ${consoleDay(row.invoice.dueDate)}` : ''}`, 'plain');
  }
  if (status === 'paid') {
    if (total === 0) return cell('Nothing to pay', 'plain');
    if (row.invoice && row.invoice.amountDueCents === 0) return cell('Paid from credit', 'plain');
    return cell('Paid outside Stripe', 'plain');
  }
  const last = row.charges[row.charges.length - 1];
  if (last) { const s = stripeSaysWords(last); return cell(s.text, fromShipped(s)); }
  return cell('—', 'quiet');
}

/** "Our record says" (Ask 2 = A): the column's words when Stripe could not be read. */
export function saleRecordSays(row: SaleRow): SaysCell {
  const r = row.record;
  const cell = (text: string): SaysCell => ({ text, tone: 'plain', sub: null, void: false });
  if (!r) return cell('—');
  switch (r.status) {
    case 'void': return { text: 'Void', tone: 'quiet', sub: null, void: true };
    case 'open': return cell('Open');
    case 'uncollectible': return cell(`Written off ${consoleDay(r.uncollectible_at)}`);
    case 'paid': return cell(`Paid ${consoleDay(r.paid_at ?? r.issued_at)}${r.refunded_cents > 0 ? ` · ${saleCents(r.refunded_cents, r.currency)} refunded` : ''}`);
  }
}

/** The row's Card: the card that paid, else the one that failed; "Not charged yet" for an open sale with no try. */
export function saleCardCell(row: SaleRow, stripeRead: boolean): { text: string; quiet: boolean } {
  if (!stripeRead) return { text: 'Not read', quiet: true };
  const c = row.paid ?? row.failed[row.failed.length - 1];
  if (c) return { text: c.card ? `${brandLabel(c.card.brand)} ${c.card.last4}` : (c.otherMethod ?? '—'), quiet: !c.card && !c.otherMethod };
  return saleStatus(row) === 'open' ? { text: 'Not charged yet', quiet: true } : { text: '—', quiet: true };
}

// ── The revenue band: before tax, from our record (GST/HST Stage 3 Part 4; owner ruling 2026-11-06) ────────────
// ONE function over the sales rows serves both the Stripe-read and the Stripe-unreachable band, so the two cannot drift. The
// source order is the plan's: our kept record first; where a sale has none, Stripe's own invoice (its total less the tax Stripe
// itself reports); a charge with no invoice at all counts at its amount and the note says so. Never "the total minus a guess".

/** A paid sale at its before-tax figure; `asCharged` = no record or invoice holds its tax, so it counts at the amount charged. */
type PaidSale = { cents: number; currency: string; at: string; asCharged: boolean };

/** An instant on or after another, compared as instants: the database's `+00:00` and our `Z` spellings must not sort apart. */
const onOrAfter = (a: string, b: string): boolean => Date.parse(a) >= Date.parse(b);

/**
 * A paid sale at its before-tax figure, or null when it is not a paid sale of value (unpaid, void, or a $0 sale). `notes` = this
 * sale's issued credit notes; the band passes every note it knows (a note can be known when its sale's record was not listed).
 */
export function paidSaleBeforeTax(row: SaleRow, notes: readonly SaleNoteRecord[] = row.notes): PaidSale | null {
  if (isVoidSale(row)) return null;
  const record = row.record;
  const paidCharge = row.paid && row.paid.status === 'succeeded' ? row.paid : null;
  if (row.bare ? !paidCharge : saleStatus(row) !== 'paid') return null;
  // One date rule for both states: the record's, else the paid charge's, else the sale's.
  const at = record?.paid_at ?? paidCharge?.createdAt ?? record?.issued_at ?? row.invoice?.issuedAt ?? row.at;
  // A note issued before the bill was paid took that much off what was billed (it is not a refund of money).
  const billedLess = notes.filter(n => n.note_type === 'pre_payment').reduce((s, n) => s + n.amount_before_tax_cents, 0);
  // Our record first; else Stripe's own invoice less the tax Stripe itself reports; else (below) the charge as charged.
  const invoice = row.invoice;
  const source = record ? { total: record.total_cents, beforeTax: record.amount_before_tax_cents, currency: record.currency }
    : invoice?.totalCents != null ? { total: invoice.totalCents, beforeTax: invoice.totalCents - (invoice.taxCents ?? 0), currency: invoice.currency ?? paidCharge?.currency ?? 'cad' }
      : null;
  if (source) return source.total === 0 ? null : { cents: Math.max(0, source.beforeTax - billedLess), currency: source.currency, at, asCharged: false };
  return paidCharge ? { cents: paidCharge.amountCents, currency: paidCharge.currency, at, asCharged: true } : null;
}

/** One refund as the band counts it: `split` = its before-tax figure comes from a credit note; `at` null = no real refund date is known. */
type RefundItem = { cents: number; currency: string; at: string | null; split: boolean };

/**
 * Each refund counts at what it took off the revenue, in the period it was recorded. A credit note counts at its before-tax figure
 * on the day the note was issued (the return's rule), whatever sale it is on. Money Stripe refunded that no note explains counts at
 * the amount refunded and is not split: with Stripe read, a sale's notes are taken to explain the refunds the console made first (a
 * note is made with its refund, and Stripe's dashboard refunds never have one), then the oldest of the rest, each dated by the
 * refund's own day; with Stripe unread our record keeps no refund day, so the sale's. `notes` = every issued note known, however
 * it was read (the sale's own, or by its issue date), once each; `byInvoice` groups them.
 */
function refundItems(rows: readonly SaleRow[], since: string, notes: readonly SaleNoteRecord[], byInvoice: ReadonlyMap<string, SaleNoteRecord[]>, stripeRead: boolean): RefundItem[] {
  const items: RefundItem[] = [];
  for (const n of notes) {
    if (n.note_type !== 'pre_payment' && onOrAfter(n.issued_at, since) && n.total_cents > 0) items.push({ cents: n.amount_before_tax_cents, currency: n.currency, at: n.issued_at, split: true });
  }
  for (const row of rows) {
    if (isVoidSale(row)) continue;
    let explained = (byInvoice.get(row.key) ?? []).reduce((s, n) => s + n.refund_cents, 0);
    if (stripeRead && row.charges.length) {
      const refunds = row.charges.flatMap(c => c.refunds.filter(isCountedRefund).map(r => ({ r, currency: c.currency })))
        .sort((a, b) => Number(!a.r.ourRefundId) - Number(!b.r.ourRefundId) || a.r.createdAt.localeCompare(b.r.createdAt));
      for (const { r, currency } of refunds) {
        const covered = Math.min(explained, r.amountCents);
        explained -= covered;
        if (r.amountCents - covered > 0 && onOrAfter(r.createdAt, since)) items.push({ cents: r.amountCents - covered, currency, at: r.createdAt, split: false });
      }
    } else if (row.record && row.record.refunded_cents > explained && onOrAfter(row.record.issued_at, since)) {
      items.push({ cents: row.record.refunded_cents - explained, currency: row.record.currency, at: null, split: false });
    }
  }
  return items;
}

/**
 * The revenue band: Paid before tax · Refunded · Next charge. `next` is the third cell (Stripe's quote, or "Not read"); the caller
 * supplies it because it comes from Stripe, not from the sales. `stripeRead` false = every figure is from our record alone and
 * says so. `bandNotes` = the credit notes issued in the twelve months (see SalesRecords).
 */
export function moneyBandFromSales(rows: readonly SaleRow[], ctx: { since: string; bandNotes?: readonly SaleNoteRecord[]; stripeRead: boolean; next: BandCell }): BandCell[] {
  const { since, stripeRead } = ctx;
  const ours = stripeRead ? '' : BAND_WORDS.ourRecord;
  // Every issued note once, however it was read; grouped by the sale it is on (a sale's record may not be listed though its note is).
  const notes = [...new Map([...rows.flatMap(r => r.notes), ...(ctx.bandNotes ?? [])].filter(n => n.status === 'issued').map(n => [n.stripe_credit_note_id, n] as const)).values()];
  const byInvoice = new Map<string, SaleNoteRecord[]>();
  for (const n of notes) byInvoice.set(n.stripe_invoice_id, [...(byInvoice.get(n.stripe_invoice_id) ?? []), n]);
  const paid = rows.flatMap(r => { const p = paidSaleBeforeTax(r, byInvoice.get(r.key) ?? []); return p && onOrAfter(p.at, since) ? [p] : []; });
  const asCharged = paid.filter(p => p.asCharged).length;
  const oldest = [...paid].sort((a, b) => a.at.localeCompare(b.at))[0];
  const paidNote = [paid.length ? `${BAND_WORDS.sales(paid.length)} since ${consoleDay(oldest.at)}` : BAND_WORDS.none, ...(asCharged ? [BAND_WORDS.asCharged(asCharged)] : [])].join(' · ');

  const refunds = refundItems(rows, since, notes, byInvoice, stripeRead);
  const unsplit = refunds.filter(r => !r.split).length;
  // One refund names its day (when a real one is known); a mix says how many have no credit note.
  const dated = refunds.length === 1 && refunds[0].at ? `, ${consoleDay(refunds[0].at)}` : '';
  const unsplitTail = unsplit === 0 ? '' : unsplit === refunds.length ? ` · ${BAND_WORDS.noCreditNote}` : `, ${BAND_WORDS.someUnsplit(unsplit)}`;
  const refundNote = refunds.length ? `${BAND_WORDS.refunds(refunds.length)}${dated}${unsplitTail}` : BAND_WORDS.none;
  return [
    { label: BAND_WORDS.paidBeforeTax, value: saleCents(paid.reduce((s, p) => s + p.cents, 0), paid[0]?.currency ?? 'cad'), note: `${paidNote}${ours}` },
    { label: refunds.length > 0 && unsplit === 0 ? BAND_WORDS.refundedBeforeTax : BAND_WORDS.refunded,
      value: saleCents(refunds.reduce((s, r) => s + r.cents, 0), refunds[0]?.currency ?? paid[0]?.currency ?? 'cad'),
      note: `${refundNote}${ours}`, ...(refunds.length ? { tone: 'warn' as const } : {}) },
    ctx.next,
  ];
}

// ── The sale's window (Ask 3 = A; drawing tab 3) ───────────────────────────────────────────────────

/** The window's joined band: Before tax · {the tax} · Total, each note netting the credit notes (and a non-CAD sale in CAD). */
export function saleWindowBand(record: SaleRecord, notes: readonly SaleNoteRecord[]): Array<{ label: string; value: string; note: string | null }> {
  const cur = record.currency;
  const sum = (pick: (n: SaleNoteRecord) => number) => notes.reduce((s, n) => s + pick(n), 0);
  const credited = (whole: number, part: number) => (notes.length ? `${saleCents(part, cur)} credited · ${saleCents(whole - part, cur)} left` : null);
  const inCad = (cad: number | null) => (cur !== 'cad' && cad != null ? `${saleCents(cad, 'cad')} in Canadian dollars` : null);
  const join = (...parts: Array<string | null>) => parts.filter(Boolean).join(' · ') || null;
  const lines = chargedLines(record);
  const taxLabel = record.gst_hst_position === 'taxed' && lines.length === 1 ? taxLineName(lines[0]) : 'Tax';
  const taxNote = record.gst_hst_position === 'zero_rated' ? 'zero-rated'
    : record.tax_total_cents === 0 && record.gst_hst_position === 'missing' ? 'none charged'
      : credited(record.tax_total_cents, sum(n => n.tax_total_cents));
  return [
    { label: 'Before tax', value: saleCents(record.amount_before_tax_cents, cur),
      note: join(credited(record.amount_before_tax_cents, sum(n => n.amount_before_tax_cents)), inCad(record.cad_amount_before_tax_cents)) },
    { label: taxLabel, value: saleCents(record.tax_total_cents, cur), note: taxNote },
    { label: 'Total', value: saleCents(record.total_cents, cur),
      note: join(credited(record.total_cents, sum(n => n.total_cents)), inCad(record.cad_total_cents)) },
  ];
}

/** "At 1.3912, the Bank of Canada rate for Oct 12, 2026" (a sale in another currency only). */
export function cadRateWords(record: SaleRecord): string | null {
  if (record.currency === 'cad') return null;
  if (record.fx_rate == null || !record.fx_rate_date) return 'Not valued yet: the daily job reads the Bank of Canada rate for its day.';
  return `At ${Number(record.fx_rate)}, the Bank of Canada rate for ${consoleDate(record.fx_rate_date)}`;
}

const MISSING_WHY: Record<string, string> = {
  stripe_did_not_work_out: 'Stripe did not work out the tax on this invoice.',
  canadian_buyer_not_charged: 'A Canadian buyer was not charged GST/HST.',
  no_evidence_for_zero_rating: 'It was not taxed, and there is no proof the buyer is outside Canada (no US address or no US declaration).',
  unexpected_reason: 'Stripe gave the GST/HST line a reason we do not expect.',
};

/**
 * "Needs a look" (GST/HST Stage 3 Part 3; drawing tab 5, owner Asks 4 and 8 = A): the sentence each check says, in priority order
 * (the rules are lib/console-money-needs-look.ts), and the strip, count and empty-state lines. A row says "Needs a look: " + one.
 * `unexpected` reuses the window's own words for that reason (owner 2026-11-06, undrawn state (a) = as recommended).
 */
export const NEEDS_LOOK_WORDS = {
  lead: 'Needs a look: ',
  filter: 'Needs a look',
  reasons: {
    not_worked_out: 'Stripe did not work out the tax on this invoice.',
    unexpected: MISSING_WHY.unexpected_reason,
    buyer_not_charged: 'a Canadian buyer was not charged GST/HST.',
    no_zero_rating_proof: 'zero-rated, but there is no proof the buyer is outside Canada (no US address or no US declaration).',
    rate_mismatch: (taxedAt: string, place: string, expected: string) => `taxed at ${taxedAt}, but the address kept with the sale is in ${place} (${expected}).`,
    review: (note: string | null) => `flagged for review when it was sold.${note ? ` ${note}` : ''}`,
    no_evidence: 'no billing address could be read when it was sold.',
    refund_no_note: (amount: string) => `refunded ${amount} in Stripe’s dashboard with no credit note, so the tax was not reduced.`,
  },
  /** Ask 8: the same clause on the window's "Refunded so far" line, after a refund made in Stripe's dashboard. */
  refundClause: 'no credit note, so the tax was not reduced',
  strip: (n: number) => (n === 1 ? '1 sale needs a look at its tax.' : `${n} sales need a look at their tax.`),
  showThem: 'Show them',
  count: (n: number) => (n === 0 ? 'No sales need a look' : `${n} sale${n === 1 ? ' needs' : 's need'} a look, newest first`),
  emptyTitle: 'Nothing needs a look.',
  /** Undrawn state (b) = as recommended: with the registration date unread, the same line without the date. */
  emptyText: (registration: string | null) => (registration
    ? `Every sale since ${consoleDate(registration)}, when our GST/HST registration took effect, has a GST/HST answer that matches what was kept with it.`
    : 'Every sale has a GST/HST answer that matches what was kept with it.'),
  showAll: 'Show all sales',
  /** Undrawn: the needs-a-look read itself failed (the choice is then left out, as when our records fail; drawing tab 4). */
  readFailed: 'Which sales need a look could not be read.',
  /**
   * "Mark as looked at" (Part 3b; drawing tab 5, owner Ask 6; the re-list ruling 2026-11-06). The put-back window is the same recipe
   * (the drawing says it "asks for a why too"); its sentence is not drawn and is plain on purpose.
   */
  mark: {
    door: 'Mark as looked at',
    title: (day: string) => `Mark the ${day} sale as looked at`,
    sentenceA: 'The ',
    sentenceB: ' sale leaves the list of sales that need a look. ',
    sentenceBold: 'Its record and its tax do not change',
    sentenceC: ', and the GST/HST return still counts it as it stands.',
    whyPlaceholder: 'What did you find, and what was done? Never a card number.',
    foot: 'Goes in the audit log and on the sale’s window.',
    confirm: 'Mark as looked at',
    done: 'Marked as looked at.',
    looked: (when: string, by: string, why: string) => `Looked at ${when} by ${by}: ${why}`,
    putBack: 'Put it back on the list',
    putBackTitle: (day: string) => `Put the ${day} sale back on the list`,
    putBackSentence: 'The sale goes back on the list of sales that need a look. Its record and its tax do not change.',
    putBackPlaceholder: 'Why is it going back on the list? Never a card number.',
    putBackFoot: 'Goes in the audit log.',
    putBackDone: 'Put back on the list.',
    supportLine: 'Billing or Super admin marks a sale as looked at.',
    refusals: {
      whyBlank: 'Say why before marking it as looked at.',
      whyBlankPutBack: 'Say why before putting it back.',
      whyLong: (max: number) => `Keep the reason under ${max} characters.`,
      whyCard: 'The reason looks like it holds a card number. Leave card details out.',
      noSale: 'There is no such sale on this club.',
      notRead: 'The sale could not be read. Try again in a moment.',
      noLongerNeeds: 'This sale no longer needs a look. Read again to see what changed.',
      alreadyMarked: 'This sale was already marked as looked at. Read again to see what changed.',
      cannotPutBack: 'This mark can no longer be put back. Read again to see what changed.',
      failed: 'That did not go through. Try again in a moment.',
    },
  },
} as const;

/** "Our GST/HST answer", in words: a lead word, then the sentence (gap 6 = A for a sale before we registered). */
export function gstAnswerWords(record: SaleRecord, registration: string | null): { lead: string; text: string; tone: 'plain' | 'warn' } {
  const place = placeName(record.taxed_country, record.taxed_region) ?? 'Canada';
  switch (record.gst_hst_position) {
    case 'taxed': {
      const kinds = [...new Set(chargedLines(record).filter(isCanadianGstHst).map(l => (l.tax_type ?? '').toUpperCase()).filter(Boolean))];
      return { lead: 'Taxed.', text: `Stripe charged ${kinds.length ? kinds.join(' and ') : 'GST/HST'} to a buyer in ${place}.`, tone: 'plain' };
    }
    case 'zero_rated':
      return record.tax_lines.some(l => l.source === 'stripe' && isCanadianGstHst(l) && l.taxability_reason === 'zero_rated')
        ? { lead: 'Zero-rated.', text: 'Stripe rated the GST/HST line at 0%.', tone: 'plain' }
        : { lead: 'Zero-rated.', text: 'A buyer outside Canada: a US address and the US declaration, so the service is sold to a non-resident at 0%.', tone: 'plain' };
    case 'missing':
      if (beforeRegistration(record.issued_at, registration)) {
        return { lead: 'Before we registered.', tone: 'plain', text: registration
          ? `Issued before our GST/HST registration took effect on ${consoleDate(registration)}, so no GST/HST was owed.`
          : 'Issued before our GST/HST registration took effect, so no GST/HST was owed.' };
      }
      if (!registration) return { lead: 'Not taxed.', text: SALES_WORDS.registrationUnread, tone: 'plain' };
      return { lead: 'Missing.', text: (record.gst_hst_position_why && MISSING_WHY[record.gst_hst_position_why]) ?? 'No reason was kept.', tone: 'warn' };
  }
}

/** Stripe's `taxability_reason` in plain words; one we have no words for shows Stripe's own code, never hidden. */
const REASON_WORDS: Record<string, string> = {
  standard_rated: 'charged', reduced_rated: 'charged at a reduced rate', proportionally_rated: 'charged on part of it',
  portion_standard_rated: 'charged on part of it', portion_reduced_rated: 'charged on part of it at a reduced rate',
  taxable_basis_reduced: 'charged on a reduced amount', zero_rated: 'zero-rated', product_exempt: 'exempt',
  product_exempt_holiday: 'exempt (a tax holiday)', customer_exempt: 'exempt (the buyer is exempt)', portion_product_exempt: 'part exempt',
  reverse_charge: 'reverse charge', not_subject_to_tax: 'not subject to tax', not_supported: 'not supported by Stripe',
  excluded_territory: 'not taxed: an excluded territory', jurisdiction_unsupported: 'not supported by Stripe there', vat_exempt: 'exempt',
};
export function taxReasonWords(line: Pick<StoredTaxLine, 'source' | 'taxability_reason' | 'country' | 'tax_type'>): string {
  if (line.source === 'ours') return 'zero-rated (our line)';
  const reason = line.taxability_reason;
  if (!reason) return 'no reason given';
  // Stripe says "not collecting" both for a place we are not registered in (BC's PST, a US state) and for a Canadian GST/HST
  // line on an account whose Canada registration Stripe does not hold: the second is ours to fix.
  if (reason === 'not_collecting') return isCanadianGstHst(line) ? 'not collected: Stripe had no registration for it' : 'not collected: we are not registered there';
  return REASON_WORDS[reason] ?? reason;
}

/** "HST 13% · Canada · $11.51 · charged". */
export function taxLineWords(line: StoredTaxLine, currency: string): string {
  return `${taxLineName(line)} · ${line.jurisdiction ?? countryName(line.country) ?? '—'} · ${saleCents(line.cents, currency)} · ${taxReasonWords(line)}`;
}

/** "Ontario, Canada · N1H 4H2": where Stripe placed the buyer. */
export function taxedForWords(record: SaleRecord): string {
  const region = record.taxed_country ? regionName(record.taxed_country, record.taxed_region) ?? record.taxed_region : record.taxed_region;
  const place = [region, countryName(record.taxed_country)].filter(Boolean).join(', ') || 'Not given';
  return record.taxed_postal_code ? `${place} · ${record.taxed_postal_code}` : place;
}

/** "As it stood {day}": the day the evidence was copied (the sale's day only when it was kept at the sale). */
export const asItStoodLabel = (record: SaleRecord): string => `As it stood ${consoleDay(record.evidence_read_at)}`;

/** The evidence copy kept with the sale, one line each. */
export function evidenceLines(record: SaleRecord): string[] {
  const lines: string[] = [];
  if (record.evidence_missing) lines.push('No billing address could be read');
  else {
    const region = regionName(record.evidence_country, record.evidence_region) ?? record.evidence_region;
    const street = [record.evidence_line1, record.evidence_line2, record.evidence_city].filter(Boolean).join(', ');
    lines.push(`${street}${street ? ', ' : ''}${[region, record.evidence_postal_code].filter(Boolean).join(' ')}`);
  }
  if (record.us_declaration_at && record.us_declaration_version) {
    lines.push(`US declaration ticked ${consoleDate(record.us_declaration_at)} (wording ${record.us_declaration_version})`);
  }
  const card = record.card_country ? `Card from ${countryInSentence(record.card_country)}` : null;
  const payout = record.payout_country ? countryInSentence(record.payout_country) : null;
  if (card && payout) lines.push(`${card} · payouts to ${payout}`);
  else if (card) lines.push(card);
  else if (payout) lines.push(`Payouts to ${payout}`);
  lines.push(record.review_note ?? (record.review_reason ? 'A review was open' : 'No review open'));
  return lines;
}

/** "Kept": how the record was written, in the screen's three wordings (only "at the sale" is evidence as at the sale). */
export function keptWords(record: SaleRecord): { text: string; warn: boolean } {
  switch (record.evidence_captured) {
    case 'event': return { text: 'At the sale, when the invoice was issued', warn: false };
    case 'catch_up': return { warn: true,
      text: `Caught up by the daily job on ${consoleDate(record.evidence_read_at)}: the address and card are as they stood that day, not at the sale.` };
    case 'backfill': return { warn: true,
      text: `Copied from Stripe on ${consoleDate(record.evidence_read_at)}, when the tax records began. The address and card are as they stood that day, not on the day of the sale.` };
  }
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
/** Whether the buyer's address today differs from the copy kept with the sale (one line in the window, with a door). */
export function addressChangedSince(record: SaleRecord, today: StoredBillingLocation | null): boolean {
  if (record.evidence_missing || !today) return false;
  return norm(record.evidence_country) !== norm(today.country) || norm(record.evidence_region) !== norm(today.regionCode)
    || norm(record.evidence_line1) !== norm(today.line1) || norm(record.evidence_line2) !== norm(today.line2)
    || norm(record.evidence_city) !== norm(today.city) || norm(record.evidence_postal_code).replace(/ /g, '') !== norm(today.postalCode).replace(/ /g, '');
}

/** ", of it $5.75 HST": a credit note's GST/HST, from our record of the note (none when we hold no record or it carried none). */
export function creditNoteTaxWords(note: Pick<ChargeCreditNote, 'id'>, records: readonly SaleNoteRecord[]): string {
  const rec = records.find(r => r.stripe_credit_note_id === note.id);
  const lines = rec?.tax_lines.filter(l => isCanadianGstHst(l) && l.cents !== 0) ?? [];
  if (!rec || !lines.length) return '';
  const names = [...new Set(lines.map(l => l.name))].join(' and ');
  return `, of it ${saleCents(lines.reduce((s, l) => s + l.cents, 0), rec.currency)} ${names}`;
}
