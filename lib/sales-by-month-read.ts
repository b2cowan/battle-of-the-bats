import 'server-only';
import { stripeKeyIsLive } from './online-payments-switch';
import { notesPaidBackCents, type SaleNoteRecord } from './console-money-sales';
import { byInvoice, readClubNames, readWorksheetRegistrationDate, readWorksheetSales, type RegistrationRead } from './gst-return-worksheet-read';
import { buildWorksheet, type SalesRead, type WorksheetPeriod } from './gst-return-worksheet';
import { buildSalesReport, invoiceFileRows, SALES_RECORD_FLOOR, type RefundsRead, type SalesReport } from './sales-by-month';
import { orgDayKey } from './timezone';

/**
 * THE READS BEHIND SALES BY MONTH AND THE ACCOUNTANT PACKAGE'S INVOICE FILE (Plans & pricing Stage 2 Part 4d/4e). Server-only;
 * the caller has checked the Bookkeeping gate (`requireBookkeepingApi`) first: these read every sale on the platform.
 *
 *   · Invoices and credit notes: the GST/HST return's own loader, rows `every_event` (no second query over the sales).
 *   · Refunds made in Stripe's dashboard: their own small read, by design. The return's reader is guarded against EVER naming a
 *     refund figure (tests/unit/gst-return-worksheet.test.ts, "GUARD · what the worksheet reads"), so it is not widened to.
 *     The rule is Stage 3's (`needsLook` check 7): refunded beyond what the bill's ISSUED credit notes paid back.
 *   · Club names: by the record's org_id (the buying club on the invoice), failing on its own.
 */

type ChargeRefund = { stripe_invoice_id: string; refunded_cents: number };
type NoteRefund = { stripe_invoice_id: string } & Pick<SaleNoteRecord, 'status' | 'refund_cents'>;

export async function readRefundsWithoutNote(invoiceIds: readonly string[], live: boolean): Promise<RefundsRead> {
  try {
    const refunded = (await byInvoice<ChargeRefund>('platform_charge_tax_records', 'stripe_invoice_id, refunded_cents', 'stripe_invoice_id', live, invoiceIds))
      .filter(r => r.refunded_cents > 0);
    const notes = await byInvoice<NoteRefund>('platform_credit_note_tax_records', 'stripe_invoice_id, status, refund_cents', 'stripe_credit_note_id', live,
      refunded.map(r => r.stripe_invoice_id));
    const byInvoiceId = new Map<string, number>();
    for (const r of refunded) {
      const uncovered = r.refunded_cents - notesPaidBackCents(notes.filter(n => n.stripe_invoice_id === r.stripe_invoice_id));
      if (uncovered > 0) byInvoiceId.set(r.stripe_invoice_id, uncovered);
    }
    return { state: 'read', byInvoice: byInvoiceId };
  } catch (err) {
    console.warn('[platform-admin] Sales refunds read failed:', (err as { code?: string }).code ?? 'error');
    return { state: 'failed' };
  }
}

type SalesInputs = { sales: Extract<SalesRead, { state: 'read' }>; registration: RegistrationRead; refunds: RefundsRead; clubNames: Record<string, string> | null };

/** Everything both screens need, read once: the sales (null when they could not be read), the registration date, refunds, names. */
async function readSalesInputs(period: WorksheetPeriod, live: boolean): Promise<SalesInputs | null> {
  const [sales, registration] = await Promise.all([readWorksheetSales(period, live, 'every_event'), readWorksheetRegistrationDate()]);
  if (sales.state === 'failed') return null;
  const [refunds, clubNames] = await Promise.all([
    readRefundsWithoutNote(sales.invoices.map(s => s.stripe_invoice_id), live),
    readClubNames(sales.invoices.flatMap(s => (s.buyer_kind === 'club' && s.org_id ? [s.org_id] : []))),
  ]);
  return { sales, registration, refunds, clubNames };
}
const dateOf = (registration: RegistrationRead) => (registration.state === 'set' ? registration.date : null);

export type SalesReportRead =
  | { state: 'read'; report: SalesReport; live: boolean; clubNames: Record<string, string> | null }
  | { state: 'failed'; live: boolean };

/** Sales by month for these Ontario days, and the engine's line 101 for the same dates, from ONE read of the sales. */
export async function readSalesReport(period: WorksheetPeriod): Promise<SalesReportRead> {
  const live = stripeKeyIsLive();
  const inputs = await readSalesInputs(period, live);
  if (!inputs) return { state: 'failed', live };
  // Line 101 needs only the sales and the registration date (the engine's sales side). The credits side is not read here: lines
  // 106 to 109 of this worksheet are never shown, so the expenses and filings are not read for them.
  const worksheet = buildWorksheet({ period, registrationDate: dateOf(inputs.registration), sales: inputs.sales, expenses: { state: 'read', revisions: [] } });
  return {
    state: 'read', live, clubNames: inputs.clubNames,
    report: buildSalesReport({ period, sales: inputs.sales, registration: inputs.registration, refunds: inputs.refunds, worksheet }),
  };
}

export type InvoiceFileRead =
  /** `sales` is the very read the rows came from: the package's GST/HST worksheet is built from it, never from a second pass. */
  | { state: 'read'; rows: string[][]; live: boolean; period: WorksheetPeriod; registration: RegistrationRead; clubNamesRead: boolean; sales: SalesInputs['sales'] }
  /** The chosen dates end before our sales record starts: the file is a header only. */
  | { state: 'before_record' }
  | { state: 'failed' };

/**
 * The accountant package's invoice file for the package's dates. An open end reads from the start of our record to today.
 * Never throws: a failed read is `failed`, and the package is then refused rather than sent without its sales.
 */
export async function readInvoiceFile(range: { from?: string | null; to?: string | null }): Promise<InvoiceFileRead> {
  const period = { from: range.from || SALES_RECORD_FLOOR, to: range.to || orgDayKey(new Date().toISOString()) };
  if (period.from > period.to) return { state: 'before_record' };
  try {
    const live = stripeKeyIsLive();
    const inputs = await readSalesInputs(period, live);
    if (!inputs) return { state: 'failed' };
    const rows = invoiceFileRows(period, inputs.sales, dateOf(inputs.registration), inputs.refunds, inputs.clubNames);
    return { state: 'read', rows, live, period, registration: inputs.registration, clubNamesRead: inputs.clubNames != null, sales: inputs.sales };
  } catch (err) {
    console.warn('[platform-admin] Accountant package invoice file failed:', (err as { code?: string }).code ?? 'error');
    return { state: 'failed' };
  }
}
