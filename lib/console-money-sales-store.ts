import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { gstRegistrationDate } from './bookkeeping-store';
import {
  SALE_NOTE_COLUMNS, SALE_RECORD_COLUMNS,
  type SaleNoteRecord, type SaleRecord, type SalesRecords,
} from './console-money-sales';

/**
 * The Money tab's read of OUR kept tax records (GST/HST Stage 3 Part 2). Read, never written: the records are Part 1's
 * (lib/charge-tax-record-server.ts). A buyer's sales are found by its Stripe CUSTOMER and the site's mode, the same set Stripe's
 * side of the tab shows (a coach paying for several portals has one set of sales, shown on each portal's tab; drawing tab 5).
 * The route has already refused a shared customer and a role without the Stripe-reading power.
 */

/** One window's most: past it, the next "Show older sales" starts at the oldest read. */
const WINDOW_MAX = 300;

async function notesFor(invoiceIds: readonly string[]): Promise<SaleNoteRecord[]> {
  if (!invoiceIds.length) return [];
  const { data, error } = await supabaseAdmin.from('platform_credit_note_tax_records').select(SALE_NOTE_COLUMNS)
    .in('stripe_invoice_id', [...invoiceIds]);
  if (error) throw error;
  return (data ?? []) as unknown as SaleNoteRecord[];
}

/**
 * A paging cursor from a stored instant: always `…Z` to the millisecond (the route only accepts that shape, and the screen
 * compares cursors as text), and a millisecond LATER so the record it names is read again rather than skipped by rounding
 * (the repeat joins once, by id).
 */
const cursorAt = (stored: string) => new Date(Date.parse(stored) + 1).toISOString(); // utc-intentional: an instant

const failed = (err: unknown): SalesRecords => {
  console.warn('[platform-admin] sale records read failed:', (err as { code?: string }).code ?? 'error');
  return { state: 'failed' };
};

/**
 * This customer's sales issued in [since, before), newest first, with their credit notes. `failed` on any error: the screen then
 * says so, and never shows Stripe's charges as though they had no tax.
 */
export async function readSaleRecords(customerId: string, live: boolean, window: { since: string; before: string | null }): Promise<SalesRecords> {
  try {
    let q = supabaseAdmin.from('platform_charge_tax_records').select(SALE_RECORD_COLUMNS)
      .eq('stripe_customer_id', customerId).eq('livemode', live).gte('issued_at', window.since)
      .order('issued_at', { ascending: false }).limit(WINDOW_MAX);
    if (window.before) q = q.lt('issued_at', window.before);
    const [{ data, error }, older] = await Promise.all([
      q,
      // The newest record before the window: when the window is empty (a quiet year) the next page jumps straight to it.
      supabaseAdmin.from('platform_charge_tax_records').select('issued_at')
        .eq('stripe_customer_id', customerId).eq('livemode', live).lt('issued_at', window.since)
        .order('issued_at', { ascending: false }).limit(1),
    ]);
    if (error) throw error;
    if (older.error) throw older.error;
    const sales = (data ?? []) as unknown as SaleRecord[];
    const notes = await notesFor(sales.map(s => s.stripe_invoice_id));
    const newestOlder = (older.data?.[0] as { issued_at?: string } | undefined)?.issued_at;
    const olderBefore = sales.length >= WINDOW_MAX ? cursorAt(sales[sales.length - 1].issued_at) : (newestOlder ? cursorAt(newestOlder) : null);
    return { state: 'read', sales, notes, olderBefore };
  } catch (err) {
    return failed(err);
  }
}

/**
 * Adds the records of invoices Stripe's charges name that the window left out (a sale issued just before it, paid inside it), so
 * a charge always finds its sale rather than showing as "not written yet".
 */
export async function withSalesFor(records: SalesRecords, customerId: string, live: boolean, invoiceIds: readonly string[]): Promise<SalesRecords> {
  if (records.state !== 'read') return records;
  const have = new Set(records.sales.map(s => s.stripe_invoice_id));
  const missing = [...new Set(invoiceIds)].filter(id => !have.has(id)).slice(0, 100);
  if (!missing.length) return records;
  try {
    const { data, error } = await supabaseAdmin.from('platform_charge_tax_records').select(SALE_RECORD_COLUMNS)
      .eq('stripe_customer_id', customerId).eq('livemode', live).in('stripe_invoice_id', missing);
    if (error) throw error;
    const extra = (data ?? []) as unknown as SaleRecord[];
    return { ...records, sales: [...records.sales, ...extra], notes: [...records.notes, ...await notesFor(extra.map(s => s.stripe_invoice_id))] };
  } catch (err) {
    return failed(err);
  }
}

/**
 * One sale's record and its notes, only when it is this customer's in this mode. `null` = there is no such record; `'failed'` = the
 * read itself failed (the window then says "Not read", never "not written yet").
 */
export async function readSaleRecord(invoiceId: string, customerId: string, live: boolean): Promise<{ sale: SaleRecord; notes: SaleNoteRecord[] } | null | 'failed'> {
  try {
    const { data, error } = await supabaseAdmin.from('platform_charge_tax_records').select(SALE_RECORD_COLUMNS)
      .eq('stripe_invoice_id', invoiceId).eq('stripe_customer_id', customerId).eq('livemode', live).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { sale: data as unknown as SaleRecord, notes: await notesFor([invoiceId]) };
  } catch (err) {
    console.warn('[platform-admin] sale record read failed:', (err as { code?: string }).code ?? 'error');
    return 'failed';
  }
}

/** The sale record a payment paid (a charge opened from Find, whose invoice Stripe did not name). `'failed'` = the read failed. */
export async function saleInvoiceForIntent(paymentIntentId: string, customerId: string, live: boolean): Promise<string | null | 'failed'> {
  const { data, error } = await supabaseAdmin.from('platform_charge_tax_records').select('stripe_invoice_id')
    .eq('stripe_payment_intent_id', paymentIntentId).eq('stripe_customer_id', customerId).eq('livemode', live).limit(1);
  if (error) {
    console.warn('[platform-admin] sale record lookup failed:', error.code ?? 'error');
    return 'failed';
  }
  return (data?.[0] as { stripe_invoice_id?: string } | undefined)?.stripe_invoice_id ?? null;
}

/**
 * The GST/HST registration effective date (`YYYY-MM-DD`): the changeable Stage 4a setting, from the Bookkeeping store. A date,
 * nothing private, read only for the Stripe-reading roles this route already requires. Null when it cannot be read (before its
 * migration, the store not configured, an error, or slower than 4 seconds): the screen then never calls a sale "Tax missing".
 */
export async function registrationDateOrNull(): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const date = await Promise.race([
      gstRegistrationDate(),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 4000); }),
    ]);
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch (err) {
    console.warn('[platform-admin] registration date read failed:', (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
