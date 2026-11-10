/**
 * SALES BY MONTH, AND THE ACCOUNTANT PACKAGE'S INVOICE FILE (Plans & pricing Stage 2 Part 4d and 4e).
 * Build prompt docs/projects/active/PLANS_PRICING_STAGE2_PART4_BUILD_PROMPT.md; the figures are /accounting's
 * docs/agents/accounting/REVENUE_REPORT_DEFINITIONS.md; the privacy limits /legal's STAFF_CROSS_CLUB_BILLING_LISTS.md.
 * Pure: no I/O, no clock. The reads are lib/sales-by-month-read.ts (server-only).
 *
 *   ⚖ THE SAME ROWS AS THE GST/HST RETURN. Invoices and credit notes come from the return's own loader
 *     (`readWorksheetSales`, scope `sales_report`), and each invoice's GST/HST from the return's own rule (`saleGstHst`,
 *     `noteGstHst`). Nothing here is a second engine: the line-101 sentence quotes the engine's line 101, never a sum made here.
 *   ⚖ EACH EVENT IN THE MONTH IT HAPPENS (Ontario days): invoiced by issue day; voided by void day; a credit note by its own
 *     issue day (a voided note never counts); collected by payment day (with tax, labelled); written off by the day Stripe marked
 *     it uncollectible (a bad debt, OUTSIDE net sales). Net sales = invoiced − voided − credit notes.
 *   ⚖ Tax is never revenue (its own column), test and live never mix (the read is the site's mode), and two currencies are never
 *     added raw: CAD comes from the record's Bank of Canada valuation; a sale not yet valued is left out of every CAD figure and
 *     counted, with its own-currency subtotal.
 *   ⚖ A refund made in Stripe's dashboard with no credit note is LISTED on its bill's month, never netted: the record keeps no
 *     refund date, so the bill's issue day stands in and says so.
 */
import { BACKFILL_FLOOR_ISO, toCad } from './charge-tax-record';
import { provinceName } from './canadian-provinces';
import { beforeRegistration } from './console-money-sales';
import {
  isRecovery, noteGstHst, noteRate, saleGstHst, type NotAvailableWhy, type SalesRead, type Worksheet, type WorksheetNote, type WorksheetPeriod,
  type WorksheetSale,
} from './gst-return-worksheet';
import { buyerWords, formatMoney, formatWholeDollars, taxRateLabel } from './gst-return-worksheet-text';
import { formatCad } from './bookkeeping-gst';
import { addCalendarMonths, lastDayOfMonth, orgDayKey, SHORT_MONTHS } from './timezone';

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type SalesKind = WorksheetSale['kind'] | 'unknown';
export const SALES_KINDS: readonly SalesKind[] = ['subscription', 'premium', 'fee', 'one_off', 'unknown'];
/** The kinds, named apart (/accounting §5): fees billed back to clubs are income, never "Stripe's fees" (our cost). */
export const SALES_KIND_LABELS: Record<SalesKind, string> = {
  subscription: 'Plans', premium: 'Coach Premium', fee: 'Fees billed back to clubs', one_off: 'One-off charges', unknown: 'Kind not recorded',
};
export type SalesEventType = 'invoiced' | 'voided' | 'credit_note' | 'written_off' | 'paid' | 'recovered' | 'refund_no_note';
export const SALES_EVENT_LABELS: Record<SalesEventType, string> = {
  invoiced: 'Invoiced', voided: 'Voided', credit_note: 'Credit note', written_off: 'Written off (bad debt)', paid: 'Payment received', recovered: 'Recovered (paid after write-off)',
  refund_no_note: 'Refunded, no credit note',
};

/** The first day our sales record can hold (the backfill's floor): a month wholly before it reads "Before our record starts". */
export const SALES_RECORD_FLOOR = orgDayKey(BACKFILL_FLOOR_ISO);
/** "Nov 2026" for `2026-11`. */
export const monthLabel = (month: string) => `${SHORT_MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

// ── What it reads ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Per invoice, what Stripe refunded beyond its issued credit notes (Stage 3's rule, `needsLook` check 7). Only amounts > 0. */
export type RefundsRead = { state: 'read'; byInvoice: ReadonlyMap<string, number> } | { state: 'failed' };
export type SalesRegistration = { state: 'set'; date: string } | { state: 'unset' } | { state: 'failed' };

export type SalesEvent = {
  type: SalesEventType;
  /** The Ontario day it happened (`YYYY-MM-DD`). */
  on: string;
  invoiceId: string; invoiceNumber: string | null;
  noteId: string | null; noteNumber: string | null;
  kind: SalesKind;
  buyerKind: WorksheetSale['buyer_kind'] | null;
  orgId: string | null;
  currency: string;
  /** In its own currency: before tax (invoiced, voided, credit note, written off) or with tax (payment, refund). */
  cents: number;
  /** The same in CAD. Null = not yet valued in CAD (a foreign sale whose Bank of Canada rate has not been read). */
  cad: number | null;
  /** CAD GST/HST (invoiced, voided, credit note). Null for the other kinds, or when not valued. */
  gstHstCad: number | null;
  /** Its bill was issued before the GST/HST registration date (or before our record starts): income, outside the return. */
  beforeRegistration: boolean;
  /** The record holds no date for it, so it sits on its bill's issue day (a dashboard refund; a void with no void date). */
  dateNotRecorded: boolean;
};

export type SalesFigures = {
  invoiced: number; voided: number; creditNotes: number; net: number; gstHst: number; collected: number; writtenOff: number;
  /** A payment on a bill already written off: income back (/accounting §2), its own figure. Also inside `collected` (it is money received). */
  recovered: number;
  /** Of `invoiced`: what was invoiced before the registration date (the reconciling sentence's third part). */
  beforeRegistration: number;
};
const zero = (): SalesFigures => ({ invoiced: 0, voided: 0, creditNotes: 0, net: 0, gstHst: 0, collected: 0, writtenOff: 0, recovered: 0, beforeRegistration: 0 });

// ── The events ──────────────────────────────────────────────────────────────────────────────────────────────────────

const sum = <T>(rows: readonly T[], of: (row: T) => number) => rows.reduce((total, row) => total + of(row), 0);
const EVENT_ORDER: Record<SalesEventType, number> = { invoiced: 0, paid: 1, recovered: 1, credit_note: 2, voided: 3, written_off: 4, refund_no_note: 5 };

/**
 * Every sales event of the period, one per thing that happened. `sales` may hold invoices with nothing in the period (the loader
 * reads a day wider and a superset): only an event whose day is inside the period is kept.
 */
export function salesEvents(period: WorksheetPeriod, sales: Extract<SalesRead, { state: 'read' }>, registrationDate: string | null,
  refunds: RefundsRead | null): SalesEvent[] {
  const inPeriod = (day: string) => day >= period.from && day <= period.to;
  const invoices = new Map(sales.invoices.map(s => [s.stripe_invoice_id, s]));
  const notesOf = new Map<string, WorksheetNote[]>();
  for (const note of sales.notes) notesOf.set(note.stripe_invoice_id, [...(notesOf.get(note.stripe_invoice_id) ?? []), note]);
  const out: SalesEvent[] = [];

  for (const sale of sales.invoices) {
    const { rate, cad: gst } = saleGstHst(sale);
    // Only issued notes reduce a bill, and only one in the bill's own currency can be valued at its rate (the return's rule).
    const notes = (notesOf.get(sale.stripe_invoice_id) ?? []).filter(n => n.status === 'issued' && n.currency === sale.currency);
    const cadOf = (cents: number) => (rate == null ? null : toCad(cents, rate));
    const issuedOn = orgDayKey(sale.issued_at);
    const before = beforeRegistration(sale.issued_at, registrationDate);
    const base = {
      invoiceId: sale.stripe_invoice_id, invoiceNumber: sale.invoice_number, noteId: null, noteNumber: null, kind: sale.kind as SalesKind,
      buyerKind: sale.buyer_kind, orgId: sale.org_id, currency: sale.currency, beforeRegistration: before, dateNotRecorded: false,
    };
    /** What is left of the bill once these notes are off it: before tax, its CAD (each note valued as its own row is), its GST/HST. */
    const leftAfter = (taken: readonly WorksheetNote[]) => ({
      cents: Math.max(0, sale.amount_before_tax_cents - sum(taken, n => n.amount_before_tax_cents)),
      cad: sale.cad_amount_before_tax_cents == null || rate == null ? null
        : Math.max(0, sale.cad_amount_before_tax_cents - sum(taken, n => toCad(n.amount_before_tax_cents, rate))),
      gst: gst == null ? null : Math.max(0, gst - sum(taken, n => noteGstHst(n, rate).cad ?? 0)),
    });

    if (inPeriod(issuedOn)) {
      out.push({ ...base, type: 'invoiced', on: issuedOn, cents: sale.amount_before_tax_cents, cad: sale.cad_amount_before_tax_cents,
        gstHstCad: sale.cad_amount_before_tax_cents == null ? null : gst });
    }
    if (sale.status === 'void') {
      const day = sale.voided_at ? orgDayKey(sale.voided_at) : issuedOn;
      if (inPeriod(day)) {
        // A note took part of the bill off: the void takes off only what the notes leave, so nothing comes off twice (a note
        // after the void too, though Stripe refuses one: /review 2026-11-08).
        const left = leftAfter(notes);
        out.push({ ...base, type: 'voided', on: day, cents: left.cents, cad: left.cad, gstHstCad: left.gst, dateNotRecorded: !sale.voided_at });
      }
    }
    // A bill voided after Stripe marked it uncollectible (Stripe allows it): the void reverses the sale, so the write-off is not
    // also a bad debt here; the same dollars never come off twice (/review 2026-11-08). The return keeps its own rule (line 107).
    if (sale.uncollectible_at && sale.status !== 'void' && inPeriod(orgDayKey(sale.uncollectible_at))) {
      const at = Date.parse(sale.uncollectible_at);
      const left = leftAfter(notes.filter(n => Date.parse(n.issued_at) <= at));
      out.push({ ...base, type: 'written_off', on: orgDayKey(sale.uncollectible_at), cents: left.cents, cad: left.cad, gstHstCad: null });
    }
    if (sale.paid_at && inPeriod(orgDayKey(sale.paid_at))) {
      // A pre-payment note lowered what was owed before it was paid; the payment is what was left, tax included.
      const paid = Math.max(0, sale.total_cents - sum(notes.filter(n => n.note_type === 'pre_payment'), n => n.total_cents));
      // Paid after Stripe marked it uncollectible = a recovery of the bad debt (the return's own test).
      out.push({ ...base, type: isRecovery(sale) ? 'recovered' : 'paid', on: orgDayKey(sale.paid_at), cents: paid, cad: cadOf(paid), gstHstCad: null });
    }
    const refunded = refunds?.state === 'read' ? refunds.byInvoice.get(sale.stripe_invoice_id) ?? 0 : 0;
    if (refunded > 0 && inPeriod(issuedOn)) {
      out.push({ ...base, type: 'refund_no_note', on: issuedOn, cents: refunded, cad: cadOf(refunded), gstHstCad: null, dateNotRecorded: true });
    }
  }

  for (const [invoiceId, notes] of notesOf) {
    const sale = invoices.get(invoiceId);
    for (const note of notes) {
      const day = orgDayKey(note.issued_at);
      if (note.status !== 'issued' || !inPeriod(day)) continue;
      const rate = noteRate(note, sale);
      out.push({
        type: 'credit_note', on: day, invoiceId, invoiceNumber: sale?.invoice_number ?? null,
        noteId: note.stripe_credit_note_id, noteNumber: note.note_number, kind: sale?.kind ?? 'unknown',
        buyerKind: sale?.buyer_kind ?? null, orgId: sale?.org_id ?? null, currency: note.currency, cents: note.amount_before_tax_cents,
        cad: rate == null ? null : toCad(note.amount_before_tax_cents, rate), gstHstCad: noteGstHst(note, rate).cad,
        beforeRegistration: sale ? beforeRegistration(sale.issued_at, registrationDate) : false, dateNotRecorded: false,
      });
    }
  }
  return out.sort((a, b) => a.on.localeCompare(b.on) || EVENT_ORDER[a.type] - EVENT_ORDER[b.type]
    || (a.invoiceNumber ?? a.invoiceId).localeCompare(b.invoiceNumber ?? b.invoiceId));
}

/** Adds events into figures. A figure not valued in CAD is left out of every CAD figure (it is counted apart). */
export function figuresOf(events: readonly SalesEvent[]): SalesFigures {
  const f = zero();
  for (const e of events) {
    if (e.cad == null) continue;
    if (e.type === 'invoiced') {
      f.invoiced += e.cad;
      f.gstHst += e.gstHstCad ?? 0;
      if (e.beforeRegistration) f.beforeRegistration += e.cad;
    } else if (e.type === 'voided') { f.voided += e.cad; f.gstHst -= e.gstHstCad ?? 0; }
    else if (e.type === 'credit_note') { f.creditNotes += e.cad; f.gstHst -= e.gstHstCad ?? 0; }
    else if (e.type === 'written_off') f.writtenOff += e.cad;
    else if (e.type === 'paid') f.collected += e.cad;
    else if (e.type === 'recovered') { f.collected += e.cad; f.recovered += e.cad; }
  }
  f.net = f.invoiced - f.voided - f.creditNotes;
  return f;
}

// ── The report ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A calendar month the period touches: `YYYY-MM`, its days inside the period, and whether the period covers all of it. */
export type MonthSpan = { month: string; from: string; to: string; wholeMonth: boolean };

export type SalesMonth = MonthSpan & {
  /** Wholly before our record can start, and nothing in it: "Before our record starts", not $0. */
  beforeRecord: boolean;
  /** Part of it is before the day the record is complete from (or that day is not known yet). */
  partial: boolean;
  /** Against the registration date: wholly before it, split by it, or neither (also when the date could not be read). */
  registration: 'before' | 'part_before' | null;
  figures: SalesFigures;
  byKind: { kind: SalesKind; figures: SalesFigures }[];
  events: SalesEvent[];
  /** Sales issued in it not yet valued in CAD. */
  unvalued: number;
  refundsWithoutNote: number;
};

/**
 * Line 101 of the return for the same dates, beside the report: net sales + voids + credit notes − sales before registration.
 * The engine's figure is quoted; the report's own figures only explain the gap. `does_not_reconcile` should never happen
 * (both read the same rows): the screen says so plainly rather than hiding it.
 */
export type Reconciliation =
  | { state: 'reconciled'; wholeDollars: number; line101Cents: number; beforeRegistration: number; voided: number; creditNotes: number }
  | { state: 'not_available'; why: NotAvailableWhy }
  | { state: 'does_not_reconcile'; line101Cents: number; fromSales: number };

export type SalesReport = {
  period: WorksheetPeriod;
  /** Newest first. */
  months: SalesMonth[];
  totals: SalesFigures;
  unvalued: { count: number; byCurrency: { currency: string; cents: number; count: number }[] };
  refundsWithoutNote: { state: 'read' | 'failed'; count: number };
  registration: SalesRegistration;
  /** The first day the record is complete from (null = not known yet). */
  recordStart: string | null;
  partial: boolean;
  reconciliation: Reconciliation;
};

export type SalesReportInput = {
  period: WorksheetPeriod;
  sales: Extract<SalesRead, { state: 'read' }>;
  registration: SalesRegistration;
  refunds: RefundsRead;
  /** The engine's worksheet for the same dates, built from the same read. */
  worksheet: Pick<Worksheet, 'lines' | 'parts'>;
};

/** The calendar months the period touches, oldest first, each clipped to the period. */
export function periodMonths(period: WorksheetPeriod): MonthSpan[] {
  const out: MonthSpan[] = [];
  for (let first = `${period.from.slice(0, 7)}-01`; first <= period.to; first = addCalendarMonths(first, 1)) {
    const end = lastDayOfMonth(first);
    out.push({ month: first.slice(0, 7), from: first > period.from ? first : period.from, to: end < period.to ? end : period.to, wholeMonth: first >= period.from && end <= period.to });
  }
  return out;
}

export function buildSalesReport(input: SalesReportInput): SalesReport {
  const { period, sales, registration, refunds, worksheet } = input;
  const regDate = registration.state === 'set' ? registration.date : null;
  const events = salesEvents(period, sales, regDate, refunds);
  const recordStart = sales.recordStart;

  const months: SalesMonth[] = periodMonths(period).map(m => {
    const own = events.filter(e => e.on >= m.from && e.on <= m.to);
    const beforeRecord = m.to < SALES_RECORD_FLOOR && own.length === 0;
    return {
      ...m, beforeRecord,
      partial: !beforeRecord && (recordStart == null || m.from < recordStart),
      registration: beforeRecord || !regDate ? null : m.to < regDate ? 'before' : m.from < regDate ? 'part_before' : null,
      figures: figuresOf(own),
      byKind: SALES_KINDS.filter(k => own.some(e => e.kind === k)).map(kind => ({ kind, figures: figuresOf(own.filter(e => e.kind === kind)) })),
      events: own,
      unvalued: own.filter(e => e.type === 'invoiced' && e.cad == null).length,
      refundsWithoutNote: own.filter(e => e.type === 'refund_no_note').length,
    };
  });
  const totals = figuresOf(events);

  const byCurrency = new Map<string, { currency: string; cents: number; count: number }>();
  for (const e of events) {
    if (e.type !== 'invoiced' || e.cad != null) continue;
    const row = byCurrency.get(e.currency) ?? { currency: e.currency, cents: 0, count: 0 };
    row.cents += e.cents;
    row.count += 1;
    byCurrency.set(e.currency, row);
  }

  const line = worksheet.lines[101];
  const fromSales = totals.net + totals.voided + totals.creditNotes - totals.beforeRegistration;
  const reconciliation: Reconciliation = line.cents == null
    ? { state: 'not_available', why: line.notAvailable ?? 'sales_unread' }
    : line.cents !== fromSales
      ? { state: 'does_not_reconcile', line101Cents: line.cents, fromSales }
      : { state: 'reconciled', wholeDollars: worksheet.parts[101].wholeDollars ?? 0, line101Cents: line.cents,
        beforeRegistration: totals.beforeRegistration, voided: totals.voided, creditNotes: totals.creditNotes };

  return {
    period,
    months: [...months].reverse(),
    totals,
    unvalued: { count: sum(months, m => m.unvalued), byCurrency: [...byCurrency.values()] },
    refundsWithoutNote: { state: refunds.state, count: sum(months, m => m.refundsWithoutNote) },
    registration,
    recordStart,
    partial: months.some(m => m.partial),
    reconciliation,
  };
}

// ── Money words and the Sales CSV ───────────────────────────────────────────────────────────────────────────────────

const dollars = (cents: number) => (Math.abs(cents) / 100).toFixed(2);
/** "$1,239.00"; below zero "minus $12.00" (negative money is in words: the return's formatter). */
export const salesMoney = formatMoney;

export const SALES_WORDS = {
  mode: { live: 'Live sales', test: 'Test sales' },
  caption: 'Sales invoiced by the day each bill was issued, paid or not, less voids and credit notes in the month they happened. Before tax; GST/HST apart. Collected is money received, tax included. A written-off bill is a bad debt, not less sales.',
  beforeRecord: 'Before our record starts',
  nothingInvoiced: 'No sales invoiced',
  beforeRegistration: 'before registration',
  partBeforeRegistration: 'part before registration',
  partial: 'PARTIAL',
  yearly: 'A yearly plan counts in the month it was billed. All amounts in CAD; a sale in another currency is valued at the Bank of Canada rate for its invoice day.',
  unread: 'Could not read this just now. That is not the same as nothing being sold. Try again.',
  recordUnknown: 'We can’t yet tell where the sales record starts. Until the daily job confirms its catch-up of older invoices, months are marked partial.',
  recordStarts: (day: string) => `Sales are recorded from ${day}. Bills issued before that day aren’t in these figures, so those months are marked partial.`,
  registrationUnread: 'The GST/HST registration date could not be read, so sales before it are not marked.',
  registrationUnset: 'Your GST/HST registration date isn’t recorded yet, so sales before it are not marked.',
  unvalued: (n: number, subtotals: string) =>
    `${n === 1 ? '1 sale is' : `${n} sales are`} not yet valued in CAD (${subtotals}): ${n === 1 ? 'its' : 'their'} Bank of Canada rate has not been read. Left out of the CAD figures and listed in ${n === 1 ? 'its month' : 'their months'}.`,
  refunds: (n: number) =>
    `${n === 1 ? '1 refund was' : `${n} refunds were`} made in Stripe’s dashboard with no credit note. ${n === 1 ? 'It still reduces' : 'They still reduce'} your income in the month refunded (Stripe’s dashboard has the date; our record does not), so net sales here are overstated by ${n === 1 ? 'it' : 'them'}. Listed in the bill’s month. Without a credit note the GST/HST can’t be reduced.`,
  refundsUnread: 'Refunds made in Stripe’s dashboard could not be read just now, so any without a credit note are not listed.',
  notBusinessNumbers: { title: 'Not the figure on Business numbers.', body: 'That one is the list price of the plans active today, a month, before tax: no history, no discounts, no yearly plans.' },
  reconciled: (r: Extract<Reconciliation, { state: 'reconciled' }>) => {
    const parts = [
      r.beforeRegistration ? `sales before registration −${formatCad(r.beforeRegistration)}` : '',
      r.voided ? `voids, which line 101 does not take off +${formatCad(r.voided)}` : '',
      r.creditNotes ? `credit notes, which line 101 does not take off (the return puts them on line 107) +${formatCad(r.creditNotes)}` : '',
    ].filter(Boolean);
    const whole = formatWholeDollars(r.wholeDollars);
    // Whole dollars on the return; the parts are in cents, so the unrounded figure is shown beside it when they differ.
    const line = `Line 101 of the GST/HST return for these dates reads ${whole}${r.line101Cents !== r.wholeDollars * 100 ? ` (${formatCad(r.line101Cents)} before rounding to whole dollars)` : ''}.`;
    return { title: line, body: parts.length ? `It differs by: ${parts.join(', ')}.` : 'It matches net sales for these dates.' };
  },
  notAvailable: 'Line 101 of the GST/HST return is not available for these dates, so it can’t be set beside these figures. The GST/HST return view says why.',
  doesNotReconcile: 'These figures don’t reconcile with line 101 of the GST/HST return for the same dates, though both read the same bills. Please report it; don’t file from either until it is explained.',
  refundDate: 'date not in our record',
  voidDate: 'no void date in our record',
  notValued: 'not yet valued in CAD',
};

export const SALES_CSV_HEADER = [
  'Month', 'From', 'To', 'Invoiced before tax (CAD)', 'Voided before tax (CAD)', 'Credit notes before tax (CAD)', 'Net sales before tax (CAD)',
  'GST/HST on net sales (CAD)', 'Collected with tax (CAD)', 'Written off before tax (CAD)', 'Of collected, recovered after write-off (CAD)', 'Of which before GST/HST registration (CAD)',
  'Not yet valued in CAD (sales)', 'Note',
];

/** One row per month (oldest first, as a spreadsheet reads), then the period's total and the line-101 sentence. Totals only. */
export function salesCsvRows(report: SalesReport, live: boolean): string[][] {
  const row = (label: string, from: string, to: string, f: SalesFigures, notes: string[], unvalued: number, blank = false) => [
    label, from, to,
    ...(blank ? Array(9).fill('') : [f.invoiced, f.voided, f.creditNotes, f.net, f.gstHst, f.collected, f.writtenOff, f.recovered, f.beforeRegistration].map(dollars)),
    blank ? '' : String(unvalued),
    [...notes, !blank && f.net < 0 ? 'Net sales below zero' : '', !blank && f.gstHst < 0 ? 'GST/HST below zero' : ''].filter(Boolean).join('; '),
  ];
  const rows = [SALES_CSV_HEADER];
  for (const m of [...report.months].reverse()) {
    rows.push(row(monthLabel(m.month), m.from, m.to, m.figures, [
      m.beforeRecord ? SALES_WORDS.beforeRecord : '',
      m.partial ? 'Partial: part of the month is before the sales record is complete' : '',
      m.registration === 'before' ? 'Before GST/HST registration' : m.registration === 'part_before' ? 'Part before GST/HST registration' : '',
      m.refundsWithoutNote ? `${m.refundsWithoutNote} refund(s) with no credit note, not taken off` : '',
    ], m.unvalued, m.beforeRecord));
  }
  rows.push(row('Period total', report.period.from, report.period.to, report.totals, [], report.unvalued.count));
  const r = report.reconciliation;
  const sentence = r.state === 'reconciled' ? (({ title, body }) => `${title} ${body}`)(SALES_WORDS.reconciled(r))
    : r.state === 'not_available' ? SALES_WORDS.notAvailable : SALES_WORDS.doesNotReconcile;
  rows.push(['', `${live ? SALES_WORDS.mode.live : SALES_WORDS.mode.test}. ${sentence} Collected includes tax; written off is a bad debt outside net sales.`, ...Array(SALES_CSV_HEADER.length - 2).fill('')]);
  return rows;
}

// ── The accountant package's ONE invoice file (owner ruling 2026-11-08) ─────────────────────────────────────────────

/** Named here once: GST/HST Stage 4b Session D reuses this file and adds nothing that repeats it. */
export const INVOICE_FILE_NAME = 'invoices-and-credit-notes.csv';
export const INVOICE_FILE_HEADER = [
  'Record', 'Invoice number', 'Credit note number', 'Listed for', 'Issued on', 'Kind', 'Buyer', 'Province taxed', 'GST/HST treatment', 'Status', 'Currency',
  'Before tax', 'Tax (all kinds)', 'Total', 'GST/HST', 'GST/HST rate', 'Bank of Canada rate', 'Rate date', 'Before tax (CAD)', 'GST/HST (CAD)',
  'Paid on', 'Voided on', 'Written off on', 'Written off (before tax)', 'Before GST/HST registration', 'Refunded with no credit note',
];
const INVOICE_STATUS: Record<WorksheetSale['status'], string> = { open: 'Open', paid: 'Paid', void: 'Void', uncollectible: 'Written off' };
/** Zero-rated sales are in line 101 with no tax: without this column a 0.00 GST/HST reads as a defect (/accounting 2026-11-08). */
const TREATMENT: Record<WorksheetSale['gst_hst_position'], string> = { taxed: 'Taxed', zero_rated: 'Zero-rated', missing: 'Missing: needs a look' };
const plain = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2));
const day = (iso: string | null) => (iso ? orgDayKey(iso) : '');

/** The buyer by the record's buying club (`buyerWords`: "Coach" for an individual, never a person's name, address or postal code). */
export const invoiceBuyer = (buyerKind: WorksheetSale['buyer_kind'] | null, orgId: string | null, clubNames: Record<string, string> | null): string =>
  buyerWords(buyerKind, buyerKind === 'club' && orgId ? clubNames?.[orgId] ?? (clubNames ? CLUB_GONE : null) : null);
/**
 * A club whose organization row is gone (org_id has no foreign key on purpose: the sale outlives the club). Never the record's
 * buyer_name: that is Stripe's customer name, which can be a person (/review 2026-11-08).
 */
export const CLUB_GONE = 'A club no longer on file';
/** "Listed for", in this order: why an invoice row is in the file. */
const LISTED_FOR: readonly [SalesEventType, string][] = [['invoiced', 'Issued'], ['paid', 'Paid'], ['recovered', 'Recovered'], ['voided', 'Voided'], ['written_off', 'Written off']];

/**
 * One row per invoice with anything in the period (issued, paid, voided or written off; "Listed for" says which) and one per
 * credit note issued in it, linked to its bill by the invoice number. Both the sales figures and the GST/HST figures: the bill's
 * own currency, its CAD at the record's Bank of Canada rate, and its GST/HST valued by the return's rule.
 */
export function invoiceFileRows(period: WorksheetPeriod, sales: Extract<SalesRead, { state: 'read' }>, registrationDate: string | null,
  refunds: RefundsRead, clubNames: Record<string, string> | null): string[][] {
  const events = salesEvents(period, sales, registrationDate, refunds);
  const invoices = new Map(sales.invoices.map(s => [s.stripe_invoice_id, s]));
  const listed = new Map<string, Set<SalesEventType>>();
  // The bad-debt amount (before tax less earlier notes, the bill's own currency): the event's own figure, for T2125.
  const writtenOff = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'written_off') writtenOff.set(e.invoiceId, e.cents);
    if (e.type !== 'credit_note' && e.type !== 'refund_no_note') listed.set(e.invoiceId, (listed.get(e.invoiceId) ?? new Set()).add(e.type));
  }
  const notesById = new Map(sales.notes.map(n => [n.stripe_credit_note_id, n]));
  const rows: string[][] = [INVOICE_FILE_HEADER];
  const rateWords = (lines: { taxType: string; rate: number | null }[]) => [...new Set(lines.map(taxRateLabel))].join('; ');
  const where = (sale: WorksheetSale | undefined) => (sale?.taxed_region ? provinceName(sale.taxed_region) ?? sale.taxed_region : '');
  /** The rate a row is valued at, in words: a CAD figure is its own; a foreign one the record's Bank of Canada rate. */
  const fx = (rate: number | null, currency: string) => (currency === 'cad' ? '1 (same currency)' : rate == null ? 'not yet read' : String(rate));

  const ordered = [...listed.keys()].map(id => invoices.get(id)!).sort((a, b) => a.issued_at.localeCompare(b.issued_at));
  for (const sale of ordered) {
    const tax = saleGstHst(sale);
    const refund = refunds.state === 'read' ? refunds.byInvoice.get(sale.stripe_invoice_id) ?? 0 : null;
    rows.push([
      'Invoice', sale.invoice_number ?? sale.stripe_invoice_id, '',
      LISTED_FOR.filter(([type]) => listed.get(sale.stripe_invoice_id)!.has(type)).map(([, words]) => words).join('; '),
      day(sale.issued_at), SALES_KIND_LABELS[sale.kind], invoiceBuyer(sale.buyer_kind, sale.org_id, clubNames), where(sale),
      TREATMENT[sale.gst_hst_position], INVOICE_STATUS[sale.status], sale.currency.toUpperCase(),
      plain(sale.amount_before_tax_cents), plain(sale.total_cents - sale.amount_before_tax_cents), plain(sale.total_cents),
      plain(tax.original), rateWords(tax.lines), fx(tax.rate, sale.currency), sale.fx_rate_date ?? '', plain(sale.cad_amount_before_tax_cents),
      plain(tax.cad), day(sale.paid_at), day(sale.voided_at), day(sale.uncollectible_at), plain(writtenOff.get(sale.stripe_invoice_id) ?? null),
      beforeRegistration(sale.issued_at, registrationDate) ? 'Yes' : 'No',
      refund == null ? 'Could not be read' : refund > 0 ? plain(refund) : '',
    ]);
  }
  for (const e of events) {
    if (e.type !== 'credit_note') continue;
    const sale = invoices.get(e.invoiceId);
    const note = notesById.get(e.noteId!)!;
    const rate = noteRate(note, sale);
    const tax = noteGstHst(note, rate);
    rows.push([
      'Credit note', e.invoiceNumber ?? e.invoiceId, e.noteNumber ?? e.noteId ?? '', 'Issued', e.on,
      SALES_KIND_LABELS[e.kind], invoiceBuyer(e.buyerKind, e.orgId, clubNames), where(sale), sale ? TREATMENT[sale.gst_hst_position] : '', 'Issued', note.currency.toUpperCase(),
      plain(note.amount_before_tax_cents), plain(note.total_cents - note.amount_before_tax_cents), plain(note.total_cents),
      plain(tax.original), sale ? rateWords(saleGstHst(sale).lines) : '', fx(rate, note.currency),
      sale?.fx_rate_date ?? '', plain(e.cad), plain(tax.cad), '', '', '', '', e.beforeRegistration ? 'Yes' : 'No', '',
    ]);
  }
  return rows;
}
