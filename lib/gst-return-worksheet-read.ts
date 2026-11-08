import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { stripeKeyIsLive } from './online-payments-switch';
import { gstRegistrationDate, listExpenseRevisions, listGstReturnFilings, type StoredGstReturnFiling } from './bookkeeping-store';
import { filedCredits, type GstReturnFiling } from './gst-return-filing';
import { BACKFILL_FLOOR_ISO } from './charge-tax-record';
import { readAllPages } from './console-money-needs-look';
import { chunked } from './supabase-paging';
import { addCalendarDays, isCalendarDate, orgDayKey, zonedWallClockToUtc } from './timezone';
import {
  backfillCompleteMarker, buildWorksheet, WORKSHEET_NOTE_COLUMNS, WORKSHEET_SALE_COLUMNS,
  type ExpensesRead, type FiledRead, type SalesRead, type Worksheet, type WorksheetNote, type WorksheetPeriod, type WorksheetSale,
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

/**
 * Rows of `table` whose `stripe_invoice_id` is one of these, every page, one chunk at a time. Exported for Sales by month's own
 * read of the refunded figure (lib/sales-by-month-read.ts), which this file never names.
 */
export async function byInvoice<T>(table: string, columns: string, order: string, live: boolean, ids: readonly string[]): Promise<T[]> {
  const out: T[] = [];
  for (const chunk of chunked([...new Set(ids)], IN_CHUNK)) {
    out.push(...await readAllPages<T>((from, to) => supabaseAdmin.from(table).select(columns).eq('livemode', live)
      .in('stripe_invoice_id', chunk).order(order).range(from, to) as unknown as Page<T>));
  }
  return out;
}

/**
 * Which invoices the read gathers, named by what it reads. `return`: issued, written off, or a write-off recovered in the period.
 * `every_event`: ALSO every invoice voided or paid in the period, issued whenever (Sales by month and the accountant package's
 * invoice file read this). Same tables, same columns, same pages: a superset the engine ignores (it applies the period itself),
 * proven in tests/unit/sales-by-month.test.ts.
 */
export type SalesReadRows = 'return' | 'every_event';

/**
 * Every invoice the period can need and every credit note of those invoices. Read a day wider on each side than the period's
 * Ontario days (the engine applies the exact day rule, `orgDayKey`, so the edge is decided in one place).
 */
export async function readWorksheetSales(period: WorksheetPeriod, live: boolean = stripeKeyIsLive(), rows: SalesReadRows = 'return'): Promise<SalesRead> {
  assertPeriod(period);
  try {
    const since = zonedWallClockToUtc(addCalendarDays(period.from, -1), '00:00')!;
    const before = zonedWallClockToUtc(addCalendarDays(period.to, 2), '00:00')!;
    const every = rows === 'every_event';
    const salesWhere = (column: 'issued_at' | 'uncollectible_at' | 'paid_at' | 'voided_at') => readAllPages<WorksheetSale>((from, to) => {
      let q = supabaseAdmin.from(SALES).select(SALE_COLUMNS).eq('livemode', live).gte(column, since).lt(column, before);
      // A recovered write-off is the only payment the return reads; every_event reads every payment.
      if (column === 'paid_at' && !every) q = q.not('uncollectible_at', 'is', null);
      return q.order('stripe_invoice_id').range(from, to) as unknown as Page<WorksheetSale>;
    });
    const [issued, writtenOff, recovered, voided, periodNotes, start] = await Promise.all([
      salesWhere('issued_at'), salesWhere('uncollectible_at'), salesWhere('paid_at'),
      every ? salesWhere('voided_at') : Promise.resolve([] as WorksheetSale[]),
      readAllPages<WorksheetNote>((from, to) => supabaseAdmin.from(NOTES).select(NOTE_COLUMNS).eq('livemode', live)
        .gte('issued_at', since).lt('issued_at', before).order('stripe_credit_note_id').range(from, to) as unknown as Page<WorksheetNote>),
      recordStart(live),
    ]);
    // One row per invoice and per note: a row written while the pages are read can land on two pages.
    const invoices = new Map([...issued, ...writtenOff, ...recovered, ...voided].map(s => [s.stripe_invoice_id, s]));
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

/**
 * 4a's registration effective date, told apart three ways (Session B, review 2026-11-07: one null meant two things):
 *   · `set`: the date every line reads;
 *   · `unset`: the store answered and holds no date (migration 006, which seeds it, is not applied there yet);
 *   · `failed`: the store did not answer, or answered with something that is not a date.
 * The engine needs only the date; the screen words `unset` and `failed` differently.
 */
export type RegistrationRead = { state: 'set'; date: string } | { state: 'unset' } | { state: 'failed' };
export async function readWorksheetRegistrationDate(): Promise<RegistrationRead> {
  try {
    const date = await gstRegistrationDate();
    if (date == null) return { state: 'unset' };
    return isCalendarDate(date) ? { state: 'set', date } : { state: 'failed' };
  } catch (err) {
    warn('registration date', err);
    return { state: 'failed' };
  }
}

/**
 * Every "Mark as filed" filing (Session C), newest first; [] before migration 007 (no period is filed there, which is true).
 * A filing whose sources this code can't read fails the read: what it claimed is unknown, so an earlier-period credit could
 * be claimed twice, and line 106 must read Not available instead.
 */
export type FilingsRead = { state: 'read'; filings: StoredGstReturnFiling[] } | { state: 'failed' };
export async function readWorksheetFilings(): Promise<FilingsRead> {
  try {
    const filings = await listGstReturnFilings();
    if (filings.some(f => !f.sources)) throw new Error('A filing could not be read');
    return { state: 'read', filings };
  } catch (err) {
    warn('filings', err);
    return { state: 'failed' };
  }
}

/** The engine's view of the filings: what each filed period already claimed. */
export const filedForEngine = (read: FilingsRead): FiledRead => read.state === 'failed' ? { state: 'failed' }
  : { state: 'read', periods: filedCredits(read.filings as GstReturnFiling[], orgDayKey) };

/**
 * The worksheet for these Ontario days, inclusive, how the registration date read, and the filings (Session C). The caller has
 * checked the Bookkeeping gate (`requireBookkeepingApi`) BEFORE calling: this read is platform-wide, with the service role.
 */
export async function readGstReturnWorksheet(period: WorksheetPeriod): Promise<{ worksheet: Worksheet; registration: RegistrationRead['state']; filings: FilingsRead }> {
  assertPeriod(period);
  const [sales, expenses, registration, filings] = await Promise.all([
    readWorksheetSales(period), readWorksheetExpenses(), readWorksheetRegistrationDate(), readWorksheetFilings(),
  ]);
  const registrationDate = registration.state === 'set' ? registration.date : null;
  return { worksheet: buildWorksheet({ period, registrationDate, sales, expenses, filed: filedForEngine(filings) }), registration: registration.state, filings };
}

/**
 * The worksheet for the accountant package (Session D), built from the sales, registration date and expenses the package already
 * read, so no sale is read twice. The sales may be the wider `every_event` read: the engine applies the period itself, so the
 * lines are the Reports view's for the same dates (tests/unit/gst-package-files.test.ts). Only the filings are read here.
 */
export async function readPackageWorksheet(input: {
  period: WorksheetPeriod; registration: RegistrationRead; sales: Extract<SalesRead, { state: 'read' }>; expenses: ExpensesRead;
}): Promise<{ worksheet: Worksheet; filings: FilingsRead }> {
  const filings = await readWorksheetFilings();
  const registrationDate = input.registration.state === 'set' ? input.registration.date : null;
  return { worksheet: buildWorksheet({ period: input.period, registrationDate, sales: input.sales, expenses: input.expenses, filed: filedForEngine(filings) }), filings };
}

/**
 * Clubs' names by organization id (`organizations.name`): the return's invoice windows, the Sales window and the accountant
 * package's invoice file. A person is never named here (the files call an individual "Coach", /legal STAFF_CROSS_CLUB_BILLING_LISTS.md).
 * Fails on its own (null): the figures never wait on a name.
 */
export async function readClubNames(orgIds: readonly string[]): Promise<Record<string, string> | null> {
  try {
    const names: Record<string, string> = {};
    for (const chunk of chunked([...new Set(orgIds)], IN_CHUNK)) {
      const { data, error } = await supabaseAdmin.from('organizations').select('id, name').in('id', chunk);
      if (error) throw error;
      for (const row of (data ?? []) as { id: string; name: string | null }[]) names[row.id] = row.name ?? 'Club';
    }
    return names;
  } catch (err) {
    warn('club names', err);
    return null;
  }
}
