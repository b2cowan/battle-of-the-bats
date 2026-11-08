/**
 * THE GST/HST RETURN WORKSHEET (GST/HST Stage 4b Session A). Build prompt docs/projects/active/GST_HST_STAGE4B_BUILD_PROMPT.md,
 * rulings 1-11 and its design calls, as /accounting reviewed them 2026-11-07 (docs/agents/accounting/GST_HST_RETURN_LINES.md §7-§8).
 * Pure: no I/O, no clock. The reader is lib/gst-return-worksheet-read.ts; the screen (Session B) and the accountant package
 * (Session D) both call `buildWorksheet`, so the rules live here once.
 *
 *   · Lines 101-109, regular method. Sales come ONLY from Stage 3's per-invoice record (platform_charge_tax_records and the
 *     credit-note table), credits ONLY from 4a's expenses through `expenseCredit`. Never `platform_fee_invoices`, never the
 *     invoice's whole-tax column (it holds PST and US tax too), never the "looked at" marks, never the refunded figure.
 *   · GST/HST of a sale = its Canadian GST/HST lines (`isCanadianGstHst`), summed in the invoice's currency, converted at the
 *     record's rate (CAD = 1) and rounded PER INVOICE (`toCad`, the record's own rounding), then added up.
 *   · Dated by the Ontario day (`orgDayKey`, the day Stage 3 dates a sale and reads its rate for). A sale belongs to the period of
 *     its ISSUE day, paid or not. A credit note to the period of its own issue day; a write-off to the day of `uncollectible_at`; a
 *     recovery to the day of `paid_at`.
 *   · The registration date is 4a's changeable setting. A sale before it is outside the return (Stage 3's `beforeRegistration`,
 *     the rule the "needs a look" checks use), listed for information; change the date and it moves in.
 *   · 101 gross, whole dollars rounded once on the sum, with the credit notes issued as a memo beside it. 103 gross: a bare void
 *     stays in it (no line 107 without a credit note). 104 = recovered bad debt only (supplier refunds and the meals add-back are
 *     not tracked, and the screen says so). 107 = credit notes + bad debts written off, capped per invoice at its GST/HST.
 *   · A figure that cannot be known is `null` with a reason, never 0. A sales read failure leaves 106 standing, and the reverse.
 */
import { currentExpenses, hasConfirmedDates, type ExpenseRevision } from './bookkeeping-expenses';
import { selectExpenseRevisions, type ExpenseFilters } from './bookkeeping-export';
import { expenseCredit, resolveTaxState, sumTaxLines, TAX_TYPES, type CreditState, type TaxType } from './bookkeeping-gst';
import { isCanadianGstHst, toCad, type ChargeTaxRecordRow, type CreditNoteTaxRecordRow, type StoredTaxLine } from './charge-tax-record';
import { beforeRegistration } from './console-money-sales';
import { isCalendarDate, orgDayKey } from './timezone';

// ── What the worksheet reads ────────────────────────────────────────────────────────────────────────────────────────────

/** The invoice columns the worksheet reads, and no others (a guard test holds this list). */
export const WORKSHEET_SALE_COLUMNS = [
  'stripe_invoice_id', 'invoice_number', 'kind', 'buyer_kind', 'org_id', 'stripe_customer_id', 'issued_at', 'currency',
  'amount_before_tax_cents', 'total_cents', 'tax_lines', 'gst_hst_position', 'gst_hst_position_why', 'taxed_country', 'taxed_region',
  'status', 'paid_at', 'voided_at', 'uncollectible_at', 'stripe_payment_intent_id', 'fx_rate', 'fx_rate_date', 'cad_amount_before_tax_cents',
] as const;
export type WorksheetSale = Pick<ChargeTaxRecordRow, (typeof WORKSHEET_SALE_COLUMNS)[number]>;

/** The credit-note columns the worksheet reads. A note's own CAD figures are NOT read: its tax is valued at its invoice's rate. */
export const WORKSHEET_NOTE_COLUMNS = [
  'stripe_credit_note_id', 'stripe_invoice_id', 'note_number', 'note_type', 'issued_at', 'currency', 'amount_before_tax_cents',
  'total_cents', 'tax_lines', 'status',
] as const;
export type WorksheetNote = Pick<CreditNoteTaxRecordRow, (typeof WORKSHEET_NOTE_COLUMNS)[number]>;

/**
 * What the daily job's record (`platform_audit_log.new_value`, the steps array) must CONTAIN for a backfill run that finished in this
 * Stripe mode (lib/charge-tax-record-server.ts `backfillChargeTaxRecords`). A JSON STRING on purpose: postgrest-js `.contains` writes an
 * array as a Postgres array literal, which a jsonb column refuses (review 2026-11-07).
 */
export const backfillCompleteMarker = (live: boolean): string =>
  JSON.stringify([{ step: 'tax_records_backfill', ok: true, result: { complete: true, live } }]);

/** Inclusive Ontario days, `YYYY-MM-DD`. Any dates: the 2026 stub is an accountant question, never hard-coded. */
export type WorksheetPeriod = { from: string; to: string };

/**
 * Sales: every invoice the period could need (issued, written off or recovered in it, or named by a credit note issued in it) and
 * EVERY credit note of those invoices whatever its date (the cap and a write-off's unpaid share read them), plus the first Ontario
 * day the record is complete from (null = not known). Extra rows are harmless: the engine applies the period itself.
 */
export type SalesRead =
  | { state: 'read'; invoices: readonly WorksheetSale[]; notes: readonly WorksheetNote[]; recordStart: string | null }
  | { state: 'failed' };
/** Expenses: every revision from the Bookkeeping store (the engine picks the active, dated, in-period ones). */
export type ExpensesRead =
  | { state: 'read'; revisions: readonly ExpenseRevision[] }
  | { state: 'failed'; why: 'unreadable' | 'too_many' };

export type WorksheetInput = {
  period: WorksheetPeriod;
  /** 4a's current registration effective date, or null when it could not be read. */
  registrationDate: string | null;
  sales: SalesRead;
  expenses: ExpensesRead;
};

// ── What it says ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type LineNumber = 101 | 103 | 104 | 105 | 106 | 107 | 108 | 109;
export const WORKSHEET_LINES: readonly LineNumber[] = [101, 103, 104, 105, 106, 107, 108, 109];
const CALCULATED = new Set<LineNumber>([105, 108, 109]);
const SALES_LINES: readonly LineNumber[] = [101, 103, 104, 107];

export type NotAvailableWhy = 'sales_unread' | 'registration_unread' | 'expenses_unread' | 'expenses_too_many';

export type WorksheetLine = {
  line: LineNumber;
  /** Cents (101 too; its whole dollars are in `parts[101]`). Null = Not available: never shown as $0. Net tax: positive = you owe. */
  cents: number | null;
  notAvailable: NotAvailableWhy | null;
  /** Calculated from other lines (105, 108, 109): opens nothing. */
  calculated: boolean;
  /** The period starts before the sales record does (drawing state C). */
  partial: boolean;
  /** Known, not partial, and nothing under "Before you file" can still change it. */
  complete: boolean;
};

export type SaleTaxLine = { taxType: 'gst' | 'hst'; rate: number | null; cents: number; cadCents: number | null; taxableCad: number | null };
export type WorksheetSaleItem = {
  invoiceId: string; invoiceNumber: string | null; issuedOn: string; kind: WorksheetSale['kind'];
  buyerKind: WorksheetSale['buyer_kind']; orgId: string | null; customerId: string; status: WorksheetSale['status'];
  currency: string; fxRate: number | null; region: string | null;
  position: WorksheetSale['gst_hst_position']; positionWhy: WorksheetSale['gst_hst_position_why'];
  /** CAD, as the record valued it. Null = a foreign sale with no rate read yet. */
  beforeTaxCad: number | null;
  /** CAD GST/HST of this invoice, rounded once. Null when it has no rate. */
  gstHstCad: number | null;
  /** The same in the invoice's own currency. */
  gstHstOriginal: number;
  lines: SaleTaxLine[];
};
/** One part of line 103: "Ontario · HST 13% on $2,400.00". */
export type TaxGroup = { taxType: 'gst' | 'hst'; rate: number | null; region: string | null; taxableCad: number; cents: number; invoices: number };
export type ReliefItem = {
  invoiceId: string; invoiceNumber: string | null; on: string;
  /** What reaches the line, after the cap. */
  cents: number;
  /** What it would have been without the cap. */
  wouldBe: number;
  capped: boolean;
  noteId?: string; noteNumber?: string | null;
  /** A write-off: the share of the invoice written off (invoice currency). */
  share?: { writtenOff: number; total: number };
};
type Bucket = { cents: number; count: number };
/** Line 106's bridge from Reports' GST/HST paid: paid − every bucket below = line 106 (drawing tab 5, "Not on the return"). */
export type NotOnReturn = {
  gstHstPaid: Bucket;
  simplified: Bucket; notRegistered: Bucket; beforeRegistration: Bucket;
  shareNotClaimable: Bucket; held: Bucket; notClaimed: Bucket; typeNotSet: Bucket;
};
/** A step of the bridge below "GST/HST paid". */
export type NotOnReturnStep = Exclude<keyof NotOnReturn, 'gstHstPaid'>;
export type WorksheetCreditItem = {
  expenseId: string; revision: number; supplier: string; incurredOn: string; receiptCad: number;
  taxTypes: TaxType[]; gstHstPaid: number; creditCents: number; state: CreditState; registrationUnchecked: boolean;
  /** What of this expense's GST/HST the bridge took off, by step: the same cents the step's total holds (Session B: the
   *  window's steps filter the list by it, so the screen never sorts an expense into a step itself). */
  notOnReturn: Partial<Record<NotOnReturnStep, number>>;
};

export type UnresolvedKind =
  | 'sale_missing_answer' | 'sale_no_rate' | 'sale_voided_no_note' | 'sale_before_registration'
  | 'relief_capped' | 'relief_no_rate' | 'write_off_share_unknown' | 'recovery_share_unknown' | 'note_without_sale'
  | 'credit_held' | 'tax_unknown' | 'registration_unchecked' | 'type_not_set' | 'dates_to_review';
/** "Before you file". `affects` = the lines it can still change; empty = information the owner should see (it changes nothing). */
export type UnresolvedItem = {
  kind: UnresolvedKind; affects: LineNumber[]; on: string | null; cents: number | null;
  invoiceId?: string; invoiceNumber?: string | null; noteId?: string; noteNumber?: string | null;
  expenseId?: string; supplier?: string; why?: string | null;
  /** type_not_set only: the GST/HST-typed tax on the same expense, which the bridge's "Tax type not set" step took off (absent when it took none). */
  bridgeCents?: number;
};

export type Worksheet = {
  period: WorksheetPeriod;
  registrationDate: string | null;
  /** The first day the sales record is complete from (null = not known, or sales unread). */
  salesRecordStart: string | null;
  failures: NotAvailableWhy[];
  /** Sales read, the record covers the period, and no invoice was issued in it: zeros are true (drawing state B). */
  nothingSold: boolean;
  partial: boolean;
  lines: Record<LineNumber, WorksheetLine>;
  parts: {
    101: { wholeDollars: number | null; zeroRatedCad: number; creditNotesIssuedCad: number; invoices: WorksheetSaleItem[] };
    103: { groups: TaxGroup[]; invoices: WorksheetSaleItem[] };
    104: { recoveries: ReliefItem[]; untracked: 'supplier_refunds_and_meals_add_back' };
    106: { credits: WorksheetCreditItem[]; notOnReturn: NotOnReturn | null };
    107: { creditNotes: ReliefItem[]; badDebts: ReliefItem[] };
  };
  unresolved: UnresolvedItem[];
};

// ── Small rules ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const canadianLines = (lines: readonly StoredTaxLine[]) => lines.filter(l => isCanadianGstHst(l) && l.cents !== 0);
const centsOf = (lines: readonly StoredTaxLine[]) => lines.reduce((sum, l) => sum + l.cents, 0);
/** The rate a figure in this invoice's currency is valued at: 1 for CAD, the record's Bank of Canada rate, or null (not read yet). */
const rateOf = (sale: Pick<WorksheetSale, 'currency' | 'fx_rate'>): number | null =>
  sale.currency === 'cad' ? 1 : sale.fx_rate == null ? null : Number(sale.fx_rate);
/** Whole dollars, half away from zero, once (CRA: "Round off the amount to the nearest dollar"). */
const wholeDollars = (cents: number) => (cents < 0 ? -1 : 1) * Math.floor((Math.abs(cents) + 50) / 100) || 0;
/** tax × part ÷ whole, half up, for non-negative figures. */
const shareOf = (tax: number, part: number, whole: number) => Math.floor((2 * tax * part + whole) / (2 * whole));
const bucket = (): Bucket => ({ cents: 0, count: 0 });
const add = (b: Bucket, cents: number) => { b.cents += cents; b.count += 1; };

/** One invoice's Canadian GST/HST lines with their CAD figures, the residue of the per-invoice rounding on the largest line. */
function saleTaxLines(sale: WorksheetSale, rate: number | null): { lines: SaleTaxLine[]; original: number; cad: number | null } {
  const found = canadianLines(sale.tax_lines);
  const original = centsOf(found);
  const cad = rate == null ? null : toCad(original, rate);
  const lines: SaleTaxLine[] = found.map(l => ({
    taxType: l.tax_type as 'gst' | 'hst', rate: l.rate, cents: l.cents,
    cadCents: rate == null ? null : toCad(l.cents, rate), taxableCad: rate == null ? null : toCad(l.taxable_cents, rate),
  }));
  if (cad != null && lines.length > 1) {
    const residue = cad - lines.reduce((sum, l) => sum + l.cadCents!, 0);
    if (residue) lines.reduce((big, l) => (Math.abs(l.cents) > Math.abs(big.cents) ? l : big)).cadCents! += residue;
  }
  return { lines, original, cad };
}

// ── The sales side ──────────────────────────────────────────────────────────────────────────────────────────────────────

type ReliefEvent = { at: string; order: number; kind: 'note' | 'write_off' | 'recovery'; note?: WorksheetNote; raw: number | null; share?: ReliefItem['share'] };

/**
 * Every reduction of one invoice's tax, in time order, with the cap applied as they come: credit notes and the write-off never
 * relieve more than the invoice's GST/HST in all (Memo 12.2: only to the extent the tax was in net tax), and a recovery puts back
 * the tax fraction of what was actually paid (s.231(3)): the write-off's relief × (written off − notes issued after the write-off and
 * before the payment) ÷ written off. `raw` null = it cannot be worked out (the line lists it). A part payment BEFORE a write-off that
 * was later paid in full cannot be seen in the record (only the final payment is kept): known limit, review 2026-11-07.
 */
function reliefOf(sale: WorksheetSale, notes: readonly WorksheetNote[], tax: number, rate: number) {
  const issued = notes.filter(n => n.status === 'issued');
  const events: ReliefEvent[] = issued.map(note => ({
    at: note.issued_at, order: 0, kind: 'note', note,
    raw: note.currency === sale.currency ? toCad(centsOf(canadianLines(note.tax_lines)), rate) : null,
  }));
  const writeOff = sale.uncollectible_at;
  if (writeOff) {
    const at = Date.parse(writeOff);
    const recovered = sale.paid_at != null && Date.parse(sale.paid_at) > at;
    const before = issued.filter(n => Date.parse(n.issued_at) <= at);
    // A payment before the write-off means the record cannot show the unpaid share: the invoice is listed, never guessed.
    // A payment that IS the recovery (paid after the write-off) is not one.
    const paidBefore = (!recovered && (sale.stripe_payment_intent_id != null || sale.paid_at != null))
      || before.some(n => n.note_type !== 'pre_payment');
    let raw: number | null = null;
    let share: ReliefItem['share'];
    if (!paidBefore) {
      const total = sale.total_cents;
      const writtenOff = Math.min(total, Math.max(0, total - before.reduce((sum, n) => sum + n.total_cents, 0)));
      share = { writtenOff, total };
      raw = total > 0 && tax > 0 ? shareOf(tax, writtenOff, total) : 0;
    }
    events.push({ at: writeOff, order: 1, kind: 'write_off', raw, share });
    if (recovered) events.push({ at: sale.paid_at!, order: 2, kind: 'recovery', raw: null });
  }
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.order - b.order);

  let relieved = 0;
  let writtenOffRelief: number | null = null;
  let writtenOff: { amount: number; at: number } | null = null;
  const out: Array<ReliefEvent & { cents: number | null; capped: boolean }> = [];
  for (const e of events) {
    if (e.kind === 'write_off') writtenOff = e.share ? { amount: e.share.writtenOff, at: Date.parse(e.at) } : null;
    if (e.kind === 'recovery') {
      let cents: number | null = null;
      if (writtenOffRelief != null && writtenOff) {
        const paidAt = Date.parse(e.at);
        const cutAfter = issued.filter(n => Date.parse(n.issued_at) > writtenOff!.at && Date.parse(n.issued_at) <= paidAt)
          .reduce((sum, n) => sum + n.total_cents, 0);
        const paid = Math.max(0, writtenOff.amount - cutAfter);
        cents = writtenOff.amount > 0 ? shareOf(writtenOffRelief, paid, writtenOff.amount) : 0;
        relieved -= cents;
      }
      out.push({ ...e, cents, capped: false });
      continue;
    }
    if (e.raw == null) {
      if (e.kind === 'write_off') writtenOffRelief = null;
      out.push({ ...e, cents: null, capped: false });
      continue;
    }
    const allowed = Math.max(0, tax - relieved);
    const cents = Math.min(e.raw, allowed);
    relieved += cents;
    if (e.kind === 'write_off') writtenOffRelief = cents;
    out.push({ ...e, cents, capped: e.raw > allowed });
  }
  return out;
}

function salesSide(input: WorksheetInput, sales: Extract<SalesRead, { state: 'read' }>, registration: string, unresolved: UnresolvedItem[]) {
  const { from, to } = input.period;
  const inPeriod = (iso: string) => { const day = orgDayKey(iso); return day >= from && day <= to; };
  const invoices = new Map(sales.invoices.map(s => [s.stripe_invoice_id, s]));
  const notesOf = new Map<string, WorksheetNote[]>();
  for (const note of new Map(sales.notes.map(n => [n.stripe_credit_note_id, n])).values()) {
    notesOf.set(note.stripe_invoice_id, [...(notesOf.get(note.stripe_invoice_id) ?? []), note]);
  }

  const items: WorksheetSaleItem[] = [];
  let line101 = 0, line103 = 0, line104 = 0, line107 = 0, zeroRated = 0, notesMemo = 0;
  const groups = new Map<string, TaxGroup>();
  const recoveries: ReliefItem[] = [], creditNotes: ReliefItem[] = [], badDebts: ReliefItem[] = [];

  for (const sale of [...invoices.values()].sort((a, b) => a.issued_at.localeCompare(b.issued_at))) {
    const outside = beforeRegistration(sale.issued_at, registration);
    const rate = rateOf(sale);
    const tax = saleTaxLines(sale, rate);
    const on = orgDayKey(sale.issued_at);
    const ref = { invoiceId: sale.stripe_invoice_id, invoiceNumber: sale.invoice_number };

    if (inPeriod(sale.issued_at)) {
      if (outside) {
        unresolved.push({ kind: 'sale_before_registration', affects: [], on, cents: sale.cad_amount_before_tax_cents, ...ref });
      } else {
        items.push({
          ...ref, issuedOn: on, kind: sale.kind, buyerKind: sale.buyer_kind, orgId: sale.org_id, customerId: sale.stripe_customer_id,
          status: sale.status, currency: sale.currency, fxRate: rate, region: sale.taxed_region, position: sale.gst_hst_position,
          positionWhy: sale.gst_hst_position_why, beforeTaxCad: sale.cad_amount_before_tax_cents, gstHstCad: tax.cad, gstHstOriginal: tax.original,
          lines: tax.lines,
        });
        if (sale.cad_amount_before_tax_cents != null) {
          line101 += sale.cad_amount_before_tax_cents;
          if (sale.gst_hst_position === 'zero_rated') zeroRated += sale.cad_amount_before_tax_cents;
        }
        if (tax.cad != null) line103 += tax.cad;
        if (sale.cad_amount_before_tax_cents == null || tax.cad == null) {
          unresolved.push({ kind: 'sale_no_rate', affects: [101, 103], on, cents: null, ...ref, why: sale.currency.toUpperCase() });
        }
        if (sale.gst_hst_position === 'missing') {
          unresolved.push({ kind: 'sale_missing_answer', affects: [103], on, cents: tax.cad, ...ref, why: sale.gst_hst_position_why });
        }
        if (sale.status === 'void' && !(notesOf.get(sale.stripe_invoice_id) ?? []).some(n => n.status === 'issued')) {
          unresolved.push({ kind: 'sale_voided_no_note', affects: [], on, cents: tax.cad, ...ref });
        }
        const counted = new Set<string>();
        for (const l of tax.lines) {
          if (l.cadCents == null) continue;
          const key = `${l.taxType}|${l.rate}|${sale.taxed_region ?? ''}`;
          const group = groups.get(key) ?? { taxType: l.taxType, rate: l.rate, region: sale.taxed_region, taxableCad: 0, cents: 0, invoices: 0 };
          group.taxableCad += l.taxableCad ?? 0;
          group.cents += l.cadCents;
          // Invoices, not lines: two lines of one tax on one invoice count once.
          if (!counted.has(key)) { group.invoices += 1; counted.add(key); }
          groups.set(key, group);
        }
      }
    }

    // Reductions (notes, write-off, recovery) may fall in this period whenever the invoice was issued; never for a sale outside
    // the return (its tax was never reported).
    if (outside) continue;
    const notes = notesOf.get(sale.stripe_invoice_id) ?? [];
    if (!notes.length && !sale.uncollectible_at) continue;
    if (rate == null || tax.cad == null) {
      for (const n of notes) if (n.status === 'issued' && inPeriod(n.issued_at)) {
        unresolved.push({ kind: 'relief_no_rate', affects: [107], on: orgDayKey(n.issued_at), cents: null, ...ref, noteId: n.stripe_credit_note_id, noteNumber: n.note_number });
      }
      if (sale.uncollectible_at && inPeriod(sale.uncollectible_at)) unresolved.push({ kind: 'relief_no_rate', affects: [107], on: orgDayKey(sale.uncollectible_at), cents: null, ...ref });
      // A recovery of such a write-off is unknowable too, and must not vanish from line 104 (review 2026-11-07).
      if (sale.uncollectible_at && sale.paid_at && Date.parse(sale.paid_at) > Date.parse(sale.uncollectible_at) && inPeriod(sale.paid_at)) {
        unresolved.push({ kind: 'relief_no_rate', affects: [104], on: orgDayKey(sale.paid_at), cents: null, ...ref });
      }
      continue;
    }
    for (const e of reliefOf(sale, notes, tax.cad, rate)) {
      if (!inPeriod(e.at)) continue;
      const day = orgDayKey(e.at);
      if (e.kind === 'note' && e.note) {
        const noteRef = { noteId: e.note.stripe_credit_note_id, noteNumber: e.note.note_number };
        if (e.cents == null) { unresolved.push({ kind: 'relief_no_rate', affects: [107], on: day, cents: null, ...ref, ...noteRef }); continue; }
        notesMemo += toCad(e.note.amount_before_tax_cents, rate);
        creditNotes.push({ ...ref, ...noteRef, on: day, cents: e.cents, wouldBe: e.raw!, capped: e.capped });
        line107 += e.cents;
      } else if (e.kind === 'write_off') {
        if (e.cents == null) { unresolved.push({ kind: 'write_off_share_unknown', affects: [107], on: day, cents: tax.cad, ...ref }); continue; }
        badDebts.push({ ...ref, on: day, cents: e.cents, wouldBe: e.raw!, capped: e.capped, share: e.share });
        line107 += e.cents;
      } else {
        if (e.cents == null) { unresolved.push({ kind: 'recovery_share_unknown', affects: [104], on: day, cents: tax.cad, ...ref }); continue; }
        recoveries.push({ ...ref, on: day, cents: e.cents, wouldBe: e.cents, capped: false });
        line104 += e.cents;
      }
      if (e.capped) unresolved.push({ kind: 'relief_capped', affects: [], on: day, cents: e.raw! - e.cents!, ...ref, noteId: e.note?.stripe_credit_note_id });
    }
  }

  // A credit note issued in the period on an invoice with no record: its tax cannot be checked against what was reported.
  for (const [invoiceId, notes] of notesOf) {
    if (invoices.has(invoiceId)) continue;
    for (const n of notes) if (n.status === 'issued' && inPeriod(n.issued_at)) {
      unresolved.push({ kind: 'note_without_sale', affects: [107], on: orgDayKey(n.issued_at), cents: null, invoiceId, noteId: n.stripe_credit_note_id, noteNumber: n.note_number });
    }
  }

  const sortedGroups = [...groups.values()].sort((a, b) => b.cents - a.cents || (a.region ?? '').localeCompare(b.region ?? ''));
  return { items, line101, line103, line104, line107, zeroRated, notesMemo, groups: sortedGroups, recoveries, creditNotes, badDebts };
}

// ── The credits side (4a) ───────────────────────────────────────────────────────────────────────────────────────────────

function creditsSide(revisions: readonly ExpenseRevision[], period: WorksheetPeriod, registration: string, unresolved: UnresolvedItem[]) {
  const filters: ExpenseFilters = { ...period, category: '', query: '', review: 'all', status: 'active', dateStatus: 'confirmed' };
  // The same set Reports totals: each expense's current, active revision, with confirmed dates, incurred in the period.
  const inPeriod = currentExpenses(selectExpenseRevisions([...revisions], filters, registration));
  const b: NotOnReturn = {
    gstHstPaid: bucket(), simplified: bucket(), notRegistered: bucket(), beforeRegistration: bucket(),
    shareNotClaimable: bucket(), held: bucket(), notClaimed: bucket(), typeNotSet: bucket(),
  };
  const credits: WorksheetCreditItem[] = [];
  let line106 = 0;
  for (const row of inPeriod) {
    const on = row.incurred_date!;
    const ref = { expenseId: row.expense_id, supplier: row.supplier };
    const { answer, lines } = resolveTaxState(row, row.tax_lines ?? []);
    if (answer === 'unknown') { unresolved.push({ kind: 'tax_unknown', affects: [106], on, cents: null, ...ref }); continue; }
    const paid = lines.filter(l => l.cents > 0);
    const gstHst = sumTaxLines(paid.filter(l => TAX_TYPES[l.type].gstHst));
    const credit = expenseCredit(row, registration)!;
    if (credit.state === 'type_not_set') {
      unresolved.push({ kind: 'type_not_set', affects: [106], on, cents: sumTaxLines(paid.filter(l => l.type === 'unset')), ...ref, ...(gstHst ? { bridgeCents: gstHst } : {}) });
      if (gstHst) { add(b.gstHstPaid, gstHst); add(b.typeNotSet, gstHst); }
      continue;
    }
    if (!gstHst) continue;
    add(b.gstHstPaid, gstHst);
    const item: WorksheetCreditItem = {
      ...ref, revision: row.revision, incurredOn: on, receiptCad: row.cad_cents, taxTypes: [...new Set(paid.map(l => l.type))],
      gstHstPaid: gstHst, creditCents: credit.countsOnReturn ? credit.creditCents : 0, state: credit.state, registrationUnchecked: credit.registrationUnchecked,
      notOnReturn: {},
    };
    credits.push(item);
    /** One step of the bridge: its total and this expense's part of it move together. */
    const step = (key: NotOnReturnStep, cents: number) => { add(b[key], cents); item.notOnReturn[key] = cents; };
    switch (credit.state) {
      case 'not_claimable': step(row.supplier_registration === 'simplified' ? 'simplified' : 'notRegistered', gstHst); break;
      case 'before_registration': step('beforeRegistration', gstHst); break;
      case 'no_credit': step('shareNotClaimable', gstHst); break;
      case 'not_claimed': step('notClaimed', gstHst); break;
      case 'held':
        step('held', credit.creditCents);
        if (gstHst > credit.creditCents) step('shareNotClaimable', gstHst - credit.creditCents);
        unresolved.push({ kind: 'credit_held', affects: [106], on, cents: credit.creditCents, ...ref });
        break;
      case 'counted':
        line106 += credit.creditCents;
        if (gstHst > credit.creditCents) step('shareNotClaimable', gstHst - credit.creditCents);
        if (credit.registrationUnchecked) unresolved.push({ kind: 'registration_unchecked', affects: [106], on, cents: credit.creditCents, ...ref });
        break;
      default: break;
    }
  }
  // An entry whose dates are not confirmed is never counted (Reports leaves it out of its totals the same way). It is listed in a
  // period it could belong to: no incurred date at all (any period), or one inside this period (the filter's own rule).
  for (const row of currentExpenses([...revisions])) {
    if (row.void_reason || hasConfirmedDates(row)) continue;
    if (row.incurred_date && (row.incurred_date < period.from || row.incurred_date > period.to)) continue;
    if (resolveTaxState(row, row.tax_lines ?? []).answer === 'none') continue;
    unresolved.push({ kind: 'dates_to_review', affects: [106], on: row.expense_date, cents: row.tax_cad_cents || null, expenseId: row.expense_id, supplier: row.supplier });
  }
  return { line106, credits, notOnReturn: b };
}

// ── The worksheet ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function buildWorksheet(input: WorksheetInput): Worksheet {
  const { period, registrationDate: registration } = input;
  if (!isCalendarDate(period.from) || !isCalendarDate(period.to) || period.from > period.to) throw new Error('Worksheet period is not a date range');

  const unresolved: UnresolvedItem[] = [];
  const failures: NotAvailableWhy[] = [];
  if (input.sales.state === 'failed') failures.push('sales_unread');
  if (!registration) failures.push('registration_unread');
  if (input.expenses.state === 'failed') failures.push(input.expenses.why === 'too_many' ? 'expenses_too_many' : 'expenses_unread');

  const salesWhy: NotAvailableWhy | null = input.sales.state === 'failed' ? 'sales_unread' : !registration ? 'registration_unread' : null;
  const creditsWhy: NotAvailableWhy | null = input.expenses.state === 'failed' ? failures.find(f => f.startsWith('expenses'))! : !registration ? 'registration_unread' : null;

  const sales = input.sales.state === 'read' && registration ? salesSide(input, input.sales, registration, unresolved) : null;
  const credits = input.expenses.state === 'read' && registration ? creditsSide(input.expenses.revisions, period, registration, unresolved) : null;

  // State C: the part of the period the return covers (from the registration date) starts before the record is complete.
  const recordStart = input.sales.state === 'read' ? input.sales.recordStart : null;
  const returnFrom = registration && registration > period.from ? registration : period.from;
  const partial = !!sales && returnFrom <= period.to && (recordStart == null || returnFrom < recordStart);

  const figure: Partial<Record<LineNumber, number | null>> = {
    101: sales?.line101 ?? null, 103: sales?.line103 ?? null, 104: sales?.line104 ?? null, 107: sales?.line107 ?? null,
    106: credits?.line106 ?? null,
  };
  const sum = (a: number | null | undefined, b: number | null | undefined, sign = 1) => (a == null || b == null ? null : a + sign * b);
  figure[105] = sum(figure[103], figure[104]);
  figure[108] = sum(figure[106], figure[107]);
  figure[109] = sum(figure[105], figure[108], -1);

  const operands: Record<LineNumber, LineNumber[]> = {
    101: [101], 103: [103], 104: [104], 106: [106], 107: [107], 105: [103, 104], 108: [106, 107], 109: [103, 104, 106, 107],
  };
  const why = (n: LineNumber): NotAvailableWhy | null => {
    for (const o of operands[n]) {
      const w = SALES_LINES.includes(o) ? salesWhy : creditsWhy;
      if (w) return w;
    }
    return null;
  };
  const touched = new Set(unresolved.flatMap(u => u.affects));
  const lines = Object.fromEntries(WORKSHEET_LINES.map(n => {
    const cents = figure[n] ?? null;
    const isPartial = partial && operands[n].some(o => SALES_LINES.includes(o));
    const complete = cents != null && !isPartial && operands[n].every(o => !touched.has(o));
    return [n, { line: n, cents, notAvailable: cents == null ? why(n) : null, calculated: CALCULATED.has(n), partial: isPartial, complete }];
  })) as Record<LineNumber, WorksheetLine>;

  return {
    period,
    registrationDate: registration,
    salesRecordStart: recordStart,
    failures,
    nothingSold: !!sales && !partial && sales.items.length === 0,
    partial,
    lines,
    parts: {
      101: { wholeDollars: sales ? wholeDollars(sales.line101) : null, zeroRatedCad: sales?.zeroRated ?? 0, creditNotesIssuedCad: sales?.notesMemo ?? 0, invoices: sales?.items ?? [] },
      103: { groups: sales?.groups ?? [], invoices: sales?.items ?? [] },
      104: { recoveries: sales?.recoveries ?? [], untracked: 'supplier_refunds_and_meals_add_back' },
      106: { credits: credits?.credits ?? [], notOnReturn: credits?.notOnReturn ?? null },
      107: { creditNotes: sales?.creditNotes ?? [], badDebts: sales?.badDebts ?? [] },
    },
    unresolved,
  };
}
