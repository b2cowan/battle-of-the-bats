import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { gstRegistrationDate } from './bookkeeping-store';
import {
  SALE_NOTE_COLUMNS, SALE_RECORD_COLUMNS,
  NEEDS_LOOK_WORDS, type SaleNoteRecord, type SaleRecord, type SalesRecords,
} from './console-money-sales';
import { needsLook, readAllPages, type LookedMark, type LookReason, type NeedsLookRead, type NeedsLookRecord } from './console-money-needs-look';
import { currentMark, lookKeysOf, looksHold, lookWhyRefusal, newestRow, settleLooks, type LookRow } from './console-money-looks';
import { chunked } from './supabase-paging';

/**
 * The Money tab's read of OUR kept tax records (GST/HST Stage 3 Part 2). The records are never written here: they are Part 1's
 * (lib/charge-tax-record-server.ts). The one write in this file is a "Mark as looked at" (Part 3b), into its own table beside them. A buyer's sales are found by its Stripe CUSTOMER and the site's mode, the same set Stripe's
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

/** Ids per `.in(...)`: half of supabase-paging's default, so a long list of Stripe ids keeps the request address short; each chunk is paged too. */
const IN_CHUNK = 100;

/**
 * Every row for these invoices, however many: chunked by invoice, each chunk read page by page, ONE CHUNK AT A TIME (Today's count
 * feeds this every flagged sale on the platform; a parallel fan-out of dozens of queries is not worth the seconds it saves).
 */
async function readChunked<T>(invoiceIds: readonly string[], page: (chunk: string[]) => (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (const chunk of chunked([...new Set(invoiceIds)], IN_CHUNK)) out.push(...await readAllPages<T>(page(chunk)));
  return out;
}

/** Every credit note of these invoices. */
const allNotesFor = (invoiceIds: readonly string[]) => readChunked<SaleNoteRecord>(invoiceIds, chunk => (from, to) =>
  supabaseAdmin.from('platform_credit_note_tax_records').select(SALE_NOTE_COLUMNS).in('stripe_invoice_id', chunk)
    .order('stripe_credit_note_id').range(from, to) as unknown as PromiseLike<{ data: SaleNoteRecord[] | null; error: unknown }>);

// ── The marks ("Mark as looked at", Part 3b) ───────────────────────────────────────────────────────────────

const LOOK_COLUMNS = 'id, seq, stripe_invoice_id, looked_keys, put_back_of, looked_by, looked_at, why';
const LOOKS = 'platform_charge_tax_looks';

/** Every mark and put-back row of these invoices, by invoice (unique key under the pages: seq). */
async function allLooksFor(invoiceIds: readonly string[]): Promise<Map<string, LookRow[]>> {
  const rows = await readChunked<LookRow>(invoiceIds, chunk => (from, to) =>
    supabaseAdmin.from(LOOKS).select(LOOK_COLUMNS).in('stripe_invoice_id', chunk).order('seq').range(from, to) as unknown as PromiseLike<{ data: LookRow[] | null; error: unknown }>);
  const byInvoice = new Map<string, LookRow[]>();
  for (const row of rows) {
    const mine = byInvoice.get(row.stripe_invoice_id);
    if (mine) mine.push(row); else byInvoice.set(row.stripe_invoice_id, [row]);
  }
  return byInvoice;
}

/** What judging a set of sales found: the ones still needing a look (with their reasons), the ones a mark holds, and the notes read. */
export type Judged<T> = {
  standing: T[]; reasons: Record<string, LookReason[]>; looked: Record<string, LookedMark>; notes: SaleNoteRecord[];
  /** Every reason, marked or not (the mark door reads it). */
  allReasons: Record<string, LookReason[]>;
};

/**
 * THE ONE RULE for "needs a look and nobody has looked", used by a club's read AND by Today's count (so the two cannot differ):
 * the pure checks over each record, check 7 settled by the credit notes that exist, then each sale's newest un-undone mark
 * applied — a sale leaves the list only while every reason it has now is inside what the mark was made for. The pure rules
 * never see a mark (lib/console-money-needs-look.ts). `allReasons` holds every sale's reasons BEFORE the marks, for the mark door.
 */
export async function judgeSales<T extends NeedsLookRecord>(records: readonly T[], registration: string | null): Promise<Judged<T>> {
  // Judged once as if no credit note had been issued, the worst case: the only reason a credit note can clear is check 7, so
  // whatever this leaves empty can never be on the list (a void or pre-registration sale never reaches the notes read), and a
  // sale it flags only loses its refund line when an issued note turns up.
  const candidates = records.filter(r => needsLook(r, { registration, hasCreditNote: false }).length > 0);
  const ids = candidates.map(r => r.stripe_invoice_id);
  const [notes, rows] = await Promise.all([allNotesFor(ids), allLooksFor(ids)]);
  const issued = new Set(notes.filter(n => n.status === 'issued').map(n => n.stripe_invoice_id));
  return { ...settleLooks(candidates, { registration, issued }, rows), notes };
}

/**
 * GST/HST Stage 3 Part 3a: EVERY record of this customer in this mode, whatever its date (owner Ask 4: Needs a look reaches every
 * sale on record, not the twelve months the list first shows), run through the one rule above. Void sales are never read. Credit
 * notes are read only for the sales that could need them (refunded, or already flagged) — check 7 asks whether one was issued.
 */
export async function readNeedsLook(customerId: string, live: boolean, registration: string | null): Promise<NeedsLookRead> {
  try {
    const paged = await readAllPages<SaleRecord>((from, to) =>
      supabaseAdmin.from('platform_charge_tax_records').select(SALE_RECORD_COLUMNS)
        .eq('stripe_customer_id', customerId).eq('livemode', live).neq('status', 'void')
        .order('issued_at', { ascending: false }).order('stripe_invoice_id').range(from, to) as unknown as PromiseLike<{ data: SaleRecord[] | null; error: unknown }>);
    // A sale written while the pages are being read can shift a row onto two pages: one row per invoice, so the count is never inflated.
    const records = [...new Map(paged.map(r => [r.stripe_invoice_id, r])).values()];
    const judged = await judgeSales(records, registration);
    return {
      state: 'read',
      sales: judged.standing,
      notes: judged.notes.filter(n => judged.reasons[n.stripe_invoice_id]),
      reasons: judged.reasons,
      looked: judged.looked,
      registrationDate: registration,
    };
  } catch (err) {
    console.warn('[platform-admin] needs-a-look read failed:', (err as { code?: string }).code ?? 'error');
    return { state: 'failed' };
  }
}

// ── Making and undoing a mark ───────────────────────────────────────────────────────────────────────────────

const REFUSE = NEEDS_LOOK_WORDS.mark.refusals;
export type LookWrite = { ok: true; lookId: string; keys: string[] } | { ok: false; status: number; error: string };
type LookAsk = { customerId: string; live: boolean; invoiceId: string; why: unknown; actorEmail: string; orgId: string };

/** This customer's sale with the reasons it has right now (the SERVER's read, never the browser's) and its rows of marks. */
async function saleNow(ask: LookAsk, registration: string | null): Promise<
  | { ok: true; reasons: LookReason[]; keys: string[]; rows: LookRow[] }
  | { ok: false; status: number; error: string }
> {
  const one = await readSaleRecord(ask.invoiceId, ask.customerId, ask.live);
  if (one === 'failed') return { ok: false, status: 503, error: REFUSE.notRead };
  if (!one || one.sale.status === 'void') return { ok: false, status: 404, error: REFUSE.noSale };
  // The sale's rows are read for it alone: a sale with no reasons left is not a candidate in `judgeSales`, but its mark can still be put back.
  const [judged, looks] = await Promise.all([judgeSales([one.sale], registration), allLooksFor([ask.invoiceId])]);
  // The reasons it has now, marked or not (a sale a mark holds is not in `judged.reasons`).
  const reasons = judged.allReasons[ask.invoiceId] ?? [];
  return { ok: true, reasons, keys: lookKeysOf(one.sale, reasons), rows: looks.get(ask.invoiceId) ?? [] };
}

async function insertLook(row: Record<string, unknown>, lost: string): Promise<LookWrite> {
  const { data, error } = await supabaseAdmin.from(LOOKS).insert(row).select('id').single();
  if (error) {
    // 23505: the sale's chain moved while this was open (someone else marked it, or put it back, first).
    if (error.code === '23505') return { ok: false, status: 409, error: lost };
    throw error;
  }
  return { ok: true, lookId: (data as { id: string }).id, keys: row.looked_keys as string[] };
}

/**
 * Mark a sale as looked at. The reasons it is marked FOR are the server's, read now; a sale that needs no look, or is already
 * looked at, is refused (409). The record and its tax are not touched. The caller has checked the power and that the club has
 * this Stripe customer (not shared).
 */
export async function markSaleLooked(ask: LookAsk, registration: string | null): Promise<LookWrite> {
  const refusal = lookWhyRefusal(ask.why);
  if (refusal) return { ok: false, status: 400, error: refusal };
  const now = await saleNow(ask, registration);
  if (!now.ok) return now;
  if (!now.reasons.length) return { ok: false, status: 409, error: REFUSE.noLongerNeeds };
  const mark = currentMark(now.rows);
  if (mark && looksHold(mark, now.keys)) return { ok: false, status: 409, error: REFUSE.alreadyMarked };
  const newest = newestRow(now.rows);
  return insertLook({
    stripe_invoice_id: ask.invoiceId, livemode: ask.live, org_id: ask.orgId, looked_keys: now.keys, put_back_of: null,
    after_id: newest?.id ?? null, looked_by: ask.actorEmail, why: String(ask.why).trim(),
  }, REFUSE.alreadyMarked);
}

/** Put a marked sale back on the list: a NEW row naming the mark it undoes (`lookId`, the one the screen showed), with its own why. */
export async function putSaleBack(ask: LookAsk & { lookId: string }, registration: string | null): Promise<LookWrite> {
  const refusal = lookWhyRefusal(ask.why, true);
  if (refusal) return { ok: false, status: 400, error: refusal };
  const now = await saleNow(ask, registration);
  if (!now.ok) return now;
  const mark = currentMark(now.rows);
  if (!mark || mark.id !== ask.lookId) return { ok: false, status: 409, error: REFUSE.cannotPutBack };
  return insertLook({
    stripe_invoice_id: ask.invoiceId, livemode: ask.live, org_id: ask.orgId, looked_keys: [], put_back_of: mark.id,
    after_id: mark.id, looked_by: ask.actorEmail, why: String(ask.why).trim(),
  }, REFUSE.cannotPutBack);
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
