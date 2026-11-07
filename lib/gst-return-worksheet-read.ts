import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { stripeKeyIsLive } from './online-payments-switch';
import { gstRegistrationDate, listExpenseRevisions } from './bookkeeping-store';
import { BACKFILL_FLOOR_ISO } from './charge-tax-record';
import { readAllPages } from './console-money-needs-look';
import { chunked } from './supabase-paging';
import { addCalendarDays, isCalendarDate, orgDayKey, zonedWallClockToUtc } from './timezone';
import {
  backfillCompleteMarker, buildWorksheet, WORKSHEET_NOTE_COLUMNS, WORKSHEET_SALE_COLUMNS,
  type ExpensesRead, type SalesRead, type Worksheet, type WorksheetNote, type WorksheetPeriod, type WorksheetSale,
} from './gst-return-worksheet';

/**
 * THE GST/HST RETURN WORKSHEET'S READS (GST/HST Stage 4b Session A). Two stores, three reads, each failing on its own (drawing
 * tab 6 state A): sales unreadable never blanks line 106, and the reverse.
 *   · Sales: Stage 3's own record in Supabase, read where it lives and never copied (ruling 1), platform-wide (every buyer,
 *     including a customer shared by two portals), in the site's Stripe mode, page by page with no row cap.
 *   · Expenses and the registration date: the Bookkeeping store (Aurora DSQL), through 4a's own reads.
 * Nothing here reads the "looked at" marks: a mark never takes a sale out of the return (tests/unit/console-money-looks.test.ts).
 * Server-only; the route that calls it is platform-admin's Bookkeeping (Session B).
 */

const SALES = 'platform_charge_tax_records';
const NOTES = 'platform_credit_note_tax_records';
const SALE_COLUMNS = WORKSHEET_SALE_COLUMNS.join(', ');
const NOTE_COLUMNS = WORKSHEET_NOTE_COLUMNS.join(', ');
/** Ids per `.in(...)`, as the Money tab's reader uses: a long list of Stripe ids keeps the request address short. */
const IN_CHUNK = 100;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;
/** A real calendar range, or a thrown error (a programming error, never a "failed" read): `addCalendarDays` rolls 02-30 forward silently. */
function assertPeriod(period: WorksheetPeriod): void {
  if (!isCalendarDate(period.from) || !isCalendarDate(period.to) || period.from > period.to) throw new Error('Worksheet period is not a date range');
}
const warn = (what: string, err: unknown) => console.warn(`[platform-admin] GST/HST worksheet ${what} read failed:`, (err as { code?: string }).code ?? 'error');

/**
 * The first Ontario day the sales record is whole from (state C). The backfill's floor once a run of it said `complete`; before
 * that, the day AFTER the first record the webhook wrote at the time (the backfill window ends at that instant, so the rest of
 * that day may still be missing); null when neither exists.
 */
async function recordStart(live: boolean): Promise<string | null> {
  const [marker, first] = await Promise.all([
    // A STRING, never an array: postgrest-js writes an array as a Postgres array literal (`cs.{…}`), which a jsonb column refuses.
    // The run must be in THIS Stripe mode: a test-key run proves nothing about the live record.
    supabaseAdmin.from('platform_audit_log').select('id').eq('action', 'stripe_fees_sweep')
      .contains('new_value', backfillCompleteMarker(live)).limit(1),
    supabaseAdmin.from(SALES).select('created_at').eq('livemode', live).eq('evidence_captured', 'event')
      .order('created_at', { ascending: true }).limit(1),
  ]);
  if (marker.error) throw marker.error;
  if (first.error) throw first.error;
  if (marker.data?.length) return orgDayKey(BACKFILL_FLOOR_ISO);
  const at = (first.data?.[0] as { created_at?: string } | undefined)?.created_at;
  return at ? addCalendarDays(orgDayKey(at), 1) : null;
}

/** Rows of `table` whose `stripe_invoice_id` is one of these, every page, one chunk at a time. */
async function byInvoice<T>(table: string, columns: string, order: string, live: boolean, ids: readonly string[]): Promise<T[]> {
  const out: T[] = [];
  for (const chunk of chunked([...new Set(ids)], IN_CHUNK)) {
    out.push(...await readAllPages<T>((from, to) => supabaseAdmin.from(table).select(columns).eq('livemode', live)
      .in('stripe_invoice_id', chunk).order(order).range(from, to) as unknown as Page<T>));
  }
  return out;
}

/**
 * Every invoice the period can need and every credit note of those invoices. Read a day wider on each side than the period's
 * Ontario days (the engine applies the exact day rule, `orgDayKey`, so the edge is decided in one place).
 */
export async function readWorksheetSales(period: WorksheetPeriod, live: boolean = stripeKeyIsLive()): Promise<SalesRead> {
  assertPeriod(period);
  try {
    const since = zonedWallClockToUtc(addCalendarDays(period.from, -1), '00:00')!;
    const before = zonedWallClockToUtc(addCalendarDays(period.to, 2), '00:00')!;
    const salesWhere = (column: 'issued_at' | 'uncollectible_at' | 'paid_at') => readAllPages<WorksheetSale>((from, to) => {
      let q = supabaseAdmin.from(SALES).select(SALE_COLUMNS).eq('livemode', live).gte(column, since).lt(column, before);
      if (column === 'paid_at') q = q.not('uncollectible_at', 'is', null); // a recovered write-off is the only payment the return reads
      return q.order('stripe_invoice_id').range(from, to) as unknown as Page<WorksheetSale>;
    });
    const [issued, writtenOff, recovered, periodNotes, start] = await Promise.all([
      salesWhere('issued_at'), salesWhere('uncollectible_at'), salesWhere('paid_at'),
      readAllPages<WorksheetNote>((from, to) => supabaseAdmin.from(NOTES).select(NOTE_COLUMNS).eq('livemode', live)
        .gte('issued_at', since).lt('issued_at', before).order('stripe_credit_note_id').range(from, to) as unknown as Page<WorksheetNote>),
      recordStart(live),
    ]);
    // One row per invoice and per note: a row written while the pages are read can land on two pages.
    const invoices = new Map([...issued, ...writtenOff, ...recovered].map(s => [s.stripe_invoice_id, s]));
    const named = periodNotes.map(n => n.stripe_invoice_id).filter(id => !invoices.has(id));
    for (const s of await byInvoice<WorksheetSale>(SALES, SALE_COLUMNS, 'stripe_invoice_id', live, named)) invoices.set(s.stripe_invoice_id, s);
    const notes = new Map(periodNotes.map(n => [n.stripe_credit_note_id, n]));
    for (const n of await byInvoice<WorksheetNote>(NOTES, NOTE_COLUMNS, 'stripe_credit_note_id', live, [...invoices.keys()])) notes.set(n.stripe_credit_note_id, n);
    return { state: 'read', invoices: [...invoices.values()], notes: [...notes.values()], recordStart: start };
  } catch (err) {
    warn('sales', err);
    return { state: 'failed' };
  }
}

/** listExpenseRevisions stops at 1,001 rows without saying so; a return must not drop the oldest, so past 1,000 it is refused. */
export async function readWorksheetExpenses(): Promise<ExpensesRead> {
  try {
    const revisions = await listExpenseRevisions();
    if (revisions.length > 1000) return { state: 'failed', why: 'too_many' };
    return { state: 'read', revisions };
  } catch (err) {
    warn('expenses', err);
    return { state: 'failed', why: 'unreadable' };
  }
}

/** 4a's registration effective date, or null when it cannot be read (before migration 006, or the store failed). */
export async function readWorksheetRegistrationDate(): Promise<string | null> {
  try {
    const date = await gstRegistrationDate();
    return date && isCalendarDate(date) ? date : null;
  } catch (err) {
    warn('registration date', err);
    return null;
  }
}

/** The worksheet for these Ontario days, inclusive. The caller has checked the platform-admin power. */
export async function readGstReturnWorksheet(period: WorksheetPeriod): Promise<Worksheet> {
  assertPeriod(period);
  const [sales, expenses, registrationDate] = await Promise.all([readWorksheetSales(period), readWorksheetExpenses(), readWorksheetRegistrationDate()]);
  return buildWorksheet({ period, registrationDate, sales, expenses });
}
