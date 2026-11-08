import 'server-only';

import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ExpenseRevision } from './bookkeeping-expenses';
import { currentRegistrationDate, isTaxType, taxLinesMatchTotal, type TaxLine } from './bookkeeping-gst';
import type { OwnerMovementRevision } from './bookkeeping-owner-movements';
import { MAX_SOURCES_BYTES, parseSources, type FiledSources, type GstReturnFiling } from './gst-return-filing';

type NewExpenseRevision = Omit<ExpenseRevision, 'created_at'>;
export type GstRegistrationRevision = { revision: number; effective_date: string; reason: string; created_at: string; created_by: string };
type NewOwnerMovementRevision = Omit<OwnerMovementRevision, 'created_at'>;
type ReceiptReference = Pick<ExpenseRevision, 'receipt_path' | 'receipt_name'>;

let database: ReturnType<typeof auroraDSQLPostgres> | undefined;
let storage: S3Client | undefined;

function db() {
  const host = process.env.BOOKKEEPING_DSQL_ENDPOINT;
  if (!host) throw new Error('Bookkeeping database endpoint is not configured');
  const username = process.env.BOOKKEEPING_DSQL_USERNAME || 'bookkeeping_app';
  if (username === 'admin' && process.env.NODE_ENV !== 'development') {
    throw new Error('Bookkeeping admin connection is only allowed in local development');
  }
  database ??= auroraDSQLPostgres({ host, username, max: 2, idle_timeout: 30,
    ssl: { rejectUnauthorized: true } });
  return database;
}

function bucket() {
  const name = process.env.BOOKKEEPING_S3_BUCKET;
  if (!name) throw new Error('Bookkeeping receipt bucket is not configured');
  return name;
}

function s3() {
  storage ??= new S3Client({ region: process.env.BOOKKEEPING_AWS_REGION || 'us-east-2' });
  return storage;
}

function revision(row: Record<string, unknown>): ExpenseRevision {
  const date = (value: unknown): string | null => value == null ? null : value instanceof Date
    ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return {
    ...row,
    revision: Number(row.revision),
    original_cents: Number(row.original_cents),
    cad_cents: Number(row.cad_cents),
    tax_cad_cents: Number(row.tax_cad_cents),
    tax_amount_known: row.tax_amount_known == null ? null : Boolean(row.tax_amount_known),
    conversion_rate: row.conversion_rate == null ? null : Number(row.conversion_rate),
    business_use_percent: Number(row.business_use_percent),
    expense_date: date(row.expense_date)!,
    incurred_date: date(row.incurred_date),
    paid_date: date(row.paid_date),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    ...('number_unobtainable' in row ? { number_unobtainable: row.number_unobtainable == null ? null : Boolean(row.number_unobtainable) } : {}),
  } as ExpenseRevision;
}

const lineKey = (expenseId: string, revisionNumber: number) => `${expenseId}/${revisionNumber}`;

function taxLine(row: Record<string, unknown>): TaxLine {
  const cents = Number(row.cents);
  if (!isTaxType(row.tax_type) || !Number.isSafeInteger(cents)) throw new Error('Stored tax line is not readable');
  return { type: row.tax_type, cents };
}

/** Attach each revision's stored tax lines. Revisions with none get [] once the 006 tables exist. */
function withTaxLines(revisions: ExpenseRevision[], lines: Record<string, unknown>[]): ExpenseRevision[] {
  const byRevision = new Map<string, TaxLine[]>();
  for (const line of lines) {
    const key = lineKey(String(line.expense_id), Number(line.revision));
    byRevision.set(key, [...(byRevision.get(key) ?? []), taxLine(line)]);
  }
  return revisions.map(row => ({ ...row, tax_lines: byRevision.get(lineKey(row.expense_id, row.revision)) ?? [] }));
}

export async function listExpenseRevisions(): Promise<ExpenseRevision[]> {
  const rows = (await db()`SELECT * FROM bookkeeping.expense_revisions ORDER BY expense_date DESC LIMIT 1001`).map(revision);
  if (!await hasGstTaxSchema()) return rows;
  const lines = await db()`SELECT expense_id::text AS expense_id, revision, line_no, tax_type, cents
    FROM bookkeeping.expense_tax_lines ORDER BY expense_id, revision, line_no LIMIT 10001`;
  if (lines.length > 10000) throw new Error('Expense tax lines need pagination');
  return withTaxLines(rows, [...lines]);
}

/**
 * Migration 006 (GST/HST Stage 4a): the five tax columns and both new tables. Before it, the app still reads
 * every expense (no lines, no credit) and refuses saves with the storage-update message, rather than crashing.
 */
export async function hasGstTaxSchema(): Promise<boolean> {
  const columns = await db()`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions'
      AND column_name IN ('tax_answer', 'supplier_tax_number', 'supplier_registration', 'purchase_kind', 'number_unobtainable')`;
  if (columns.length !== 5) return false;
  const tables = await db()`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'bookkeeping' AND table_name IN ('expense_tax_lines', 'gst_registration_revisions')`;
  return tables.length === 2;
}

export async function hasExpenseDateColumns(): Promise<boolean> {
  const rows = await db()`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions'
      AND column_name IN ('incurred_date', 'paid_date')`;
  return rows.length === 2;
}

export async function hasExpenseTaxColumn(): Promise<boolean> {
  const rows = await db()`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions'
      AND column_name = 'tax_amount_known'`;
  return rows.length === 1;
}

export async function hasExpenseConversionColumns(): Promise<boolean> {
  const rows = await db()`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions'
      AND column_name IN ('conversion_source', 'conversion_rate')`;
  return rows.length === 2;
}

export async function hasOwnerMovementTable(): Promise<boolean> {
  const rows = await db()`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'bookkeeping' AND table_name = 'owner_movement_revisions'`;
  return rows.length === 1;
}

function ownerMovement(row: Record<string, unknown>): OwnerMovementRevision {
  const date = row.movement_date instanceof Date ? row.movement_date.toISOString().slice(0, 10) : String(row.movement_date).slice(0, 10);
  return {
    ...row,
    revision: Number(row.revision),
    amount_cents: Number(row.amount_cents),
    movement_date: date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  } as OwnerMovementRevision;
}

export async function listOwnerMovementRevisions(): Promise<OwnerMovementRevision[]> {
  const rows = await db()`SELECT * FROM bookkeeping.owner_movement_revisions ORDER BY movement_date DESC LIMIT 1001`;
  return rows.map(ownerMovement);
}

export async function latestOwnerMovementRevision(movementId: string): Promise<OwnerMovementRevision | null> {
  const rows = await db()`SELECT * FROM bookkeeping.owner_movement_revisions
    WHERE movement_id = ${movementId}::uuid ORDER BY revision DESC LIMIT 1`;
  return rows[0] ? ownerMovement(rows[0]) : null;
}

export async function insertOwnerMovementRevision(row: NewOwnerMovementRevision): Promise<OwnerMovementRevision> {
  const rows = await db()`INSERT INTO bookkeeping.owner_movement_revisions (
    movement_id, revision, movement_date, movement_kind, amount_cents, linked_expense_id,
    source_reference, note, change_reason, void_reason, created_by
  ) VALUES (
    ${row.movement_id}::uuid, ${row.revision}, ${row.movement_date}::date, ${row.movement_kind},
    ${row.amount_cents}, ${row.linked_expense_id}::uuid, ${row.source_reference}, ${row.note},
    ${row.change_reason}, ${row.void_reason}, ${row.created_by}::uuid
  ) RETURNING *`;
  return ownerMovement(rows[0]);
}

export async function latestExpenseRevision(expenseId: string): Promise<ExpenseRevision | null> {
  const rows = await db()`SELECT * FROM bookkeeping.expense_revisions
    WHERE expense_id = ${expenseId}::uuid ORDER BY revision DESC LIMIT 1`;
  if (!rows[0]) return null;
  const latest = revision(rows[0]);
  if (!await hasGstTaxSchema()) return latest;
  const lines = await db()`SELECT expense_id::text AS expense_id, revision, line_no, tax_type, cents FROM bookkeeping.expense_tax_lines
    WHERE expense_id = ${expenseId}::uuid AND revision = ${latest.revision} ORDER BY line_no`;
  return withTaxLines([latest], [...lines])[0];
}

export async function receiptReference(expenseId: string, revisionNumber: number): Promise<ReceiptReference | null> {
  const rows = await db()`SELECT receipt_path, receipt_name FROM bookkeeping.expense_revisions
    WHERE expense_id = ${expenseId}::uuid AND revision = ${revisionNumber}`;
  return (rows[0] as ReceiptReference | undefined) ?? null;
}

/**
 * One revision and its tax lines, in ONE transaction (DML only, as Aurora DSQL requires), so a revision is never
 * stored without its lines. Callers check hasGstTaxSchema() first: this insert names the 006 columns.
 */
export async function insertExpenseRevision(row: NewExpenseRevision): Promise<ExpenseRevision> {
  if ((!row.incurred_date || !row.paid_date) && !row.void_reason) {
    throw new Error('Both expense dates are required for a new or corrected expense');
  }
  const lines = row.tax_lines ?? [];
  // A 4a revision (tax_answer stated) always obeys the sum rule, and "shown" always has a line; a pre-4a one has no lines.
  const stated = row.tax_answer != null;
  if ((lines.length || stated) && !taxLinesMatchTotal(lines, row.tax_cad_cents)) throw new Error('Tax lines must add up to the tax amount');
  if (row.tax_answer === 'shown' && !lines.length) throw new Error('A receipt that shows tax needs its tax lines');
  const inserted = await db().begin(async tx => {
    const rows = await tx`INSERT INTO bookkeeping.expense_revisions (
      expense_id, revision, expense_date, incurred_date, paid_date, supplier, category, business_purpose,
      original_currency, original_cents, cad_cents, tax_cad_cents, tax_amount_known, tax_status,
      business_use_percent, payment_source, conversion_note, conversion_source, conversion_rate, notes, change_reason,
      receipt_path, receipt_name, void_reason, created_by,
      tax_answer, supplier_tax_number, supplier_registration, purchase_kind, number_unobtainable
    ) VALUES (
      ${row.expense_id}::uuid, ${row.revision}, ${row.expense_date}::date,
      ${row.incurred_date ?? null}::date, ${row.paid_date ?? null}::date, ${row.supplier},
      ${row.category}, ${row.business_purpose}, ${row.original_currency}, ${row.original_cents},
      ${row.cad_cents}, ${row.tax_cad_cents}, ${row.tax_amount_known ?? null}, ${row.tax_status}, ${row.business_use_percent},
      ${row.payment_source}, ${row.conversion_note}, ${row.conversion_source ?? null}, ${row.conversion_rate ?? null}, ${row.notes}, ${row.change_reason},
      ${row.receipt_path}, ${row.receipt_name}, ${row.void_reason}, ${row.created_by}::uuid,
      ${row.tax_answer ?? null}, ${row.supplier_tax_number ?? null}, ${row.supplier_registration ?? null},
      ${row.purchase_kind ?? null}, ${row.number_unobtainable ?? null}
    ) RETURNING *`;
    for (const [index, line] of lines.entries()) {
      await tx`INSERT INTO bookkeeping.expense_tax_lines (expense_id, revision, line_no, tax_type, cents)
        VALUES (${row.expense_id}::uuid, ${row.revision}, ${index + 1}, ${line.type}, ${line.cents})`;
    }
    return rows[0];
  });
  return { ...revision(inserted as Record<string, unknown>), tax_lines: lines.map(line => ({ type: line.type, cents: line.cents })) };
}

function registration(row: Record<string, unknown>): GstRegistrationRevision {
  return {
    revision: Number(row.revision),
    effective_date: row.effective_date instanceof Date ? row.effective_date.toISOString().slice(0, 10) : String(row.effective_date).slice(0, 10),
    reason: String(row.reason),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    created_by: String(row.created_by),
  };
}

/** The registration date's history, newest first. The highest revision is the current date. */
export async function listGstRegistrationRevisions(): Promise<GstRegistrationRevision[]> {
  const rows = await db()`SELECT revision, effective_date, reason, created_at, created_by::text AS created_by
    FROM bookkeeping.gst_registration_revisions ORDER BY revision DESC LIMIT 1001`;
  if (rows.length > 1000) throw new Error('Registration date history needs pagination');
  return rows.map(registration);
}

/** The current registration effective date every credit reads, or null before migration 006. */
export async function gstRegistrationDate(): Promise<string | null> {
  if (!await hasGstTaxSchema()) return null;
  return currentRegistrationDate(await listGstRegistrationRevisions());
}

export async function insertGstRegistrationRevision(row: Omit<GstRegistrationRevision, 'created_at'>): Promise<GstRegistrationRevision> {
  const rows = await db()`INSERT INTO bookkeeping.gst_registration_revisions (revision, effective_date, reason, created_by)
    VALUES (${row.revision}, ${row.effective_date}::date, ${row.reason}, ${row.created_by}::uuid)
    RETURNING revision, effective_date, reason, created_at, created_by::text AS created_by`;
  return registration(rows[0]);
}

// ── GST/HST return filings (Stage 4b Session C, migration 007) ─────────────────────────────────────────────────────────

/**
 * Migration 007: `bookkeeping.gst_return_filings`. Before it, every read still works (no period is filed) and "Mark as filed" is
 * refused with the storage-update message, rather than crashing.
 */
export async function hasGstReturnFilingsTable(): Promise<boolean> {
  const rows = await db()`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'bookkeeping' AND table_name = 'gst_return_filings'`;
  return rows.length === 1;
}

const FILING_LINES = [101, 103, 104, 105, 106, 107, 108, 109] as const;
const day = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

/** A stored filing. `sources` is null when its JSON is not a format this code reads (the screen says it can't compare). */
function filing(row: Record<string, unknown>): Omit<GstReturnFiling, 'sources'> & { sources: FiledSources | null } {
  const cents = (n: number) => Number(row[`line_${n}_cents`]);
  return {
    filingNo: Number(row.filing_no),
    period: { from: day(row.period_from), to: day(row.period_to) },
    periodRevision: Number(row.period_revision),
    filedOn: day(row.filed_on),
    registrationDate: day(row.registration_date),
    lines: Object.fromEntries(FILING_LINES.map(n => [n, cents(n)])) as GstReturnFiling['lines'],
    wholeDollars101: Number(row.line_101_dollars),
    partial: Boolean(row.partial),
    openItems: Number(row.open_items),
    sources: parseSources(String(row.sources)),
    reason: row.reason == null ? null : String(row.reason),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    createdBy: String(row.created_by),
  };
}
export type StoredGstReturnFiling = ReturnType<typeof filing>;

/** Every filing, newest first; [] before migration 007. */
export async function listGstReturnFilings(): Promise<StoredGstReturnFiling[]> {
  if (!await hasGstReturnFilingsTable()) return [];
  const rows = await db()`SELECT * FROM bookkeeping.gst_return_filings ORDER BY filing_no DESC LIMIT 1001`;
  if (rows.length > 1000) throw new Error('GST/HST return filings need pagination');
  return rows.map(filing);
}

/**
 * One filing, appended. Callers check `hasGstReturnFilingsTable()` and the filing rules (`checkFiling`) first. `filingNo` is the
 * next number after the newest the caller read: a filing saved in between takes it first, and this insert is refused by the key
 * (23505) or by Aurora DSQL's optimistic concurrency (40001), so the rules are never checked against a stale list.
 */
export async function insertGstReturnFiling(row: Omit<GstReturnFiling, 'createdAt'>): Promise<StoredGstReturnFiling> {
  const sources = JSON.stringify(row.sources);
  if (new TextEncoder().encode(sources).length > MAX_SOURCES_BYTES) throw new Error('Filing sources are too large to store');
  const l = row.lines;
  const rows = await db()`INSERT INTO bookkeeping.gst_return_filings (
    filing_no, period_from, period_to, period_revision, filed_on, registration_date, line_101_dollars,
    line_101_cents, line_103_cents, line_104_cents, line_105_cents, line_106_cents, line_107_cents, line_108_cents, line_109_cents,
    partial, open_items, sources, reason, created_by
  ) VALUES (
    ${row.filingNo}, ${row.period.from}::date, ${row.period.to}::date, ${row.periodRevision}, ${row.filedOn}::date, ${row.registrationDate}::date,
    ${row.wholeDollars101}, ${l[101]}, ${l[103]}, ${l[104]}, ${l[105]}, ${l[106]}, ${l[107]}, ${l[108]}, ${l[109]},
    ${row.partial}, ${row.openItems}, ${sources}, ${row.reason}, ${row.createdBy}::uuid
  ) RETURNING *`;
  return filing(rows[0]);
}

// Records are append-only: a void is the only way one leaves the totals (owner ruling R1, 2026-10-25).
// The one object delete below removes a receipt this request uploaded when its revision then failed to save.
function key(path: string) { return `receipts/${path}`; }

export async function putReceipt(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key(path), Body: bytes,
    ContentType: contentType, IfNoneMatch: '*' }));
}

export async function deleteReceipt(path: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key(path) }));
}

export async function getReceipt(path: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key(path) }));
  if (!response.Body) throw new Error('Receipt object has no body');
  return { bytes: await response.Body.transformToByteArray(),
    contentType: response.ContentType || 'application/octet-stream' };
}

export async function headReceipt(path: string): Promise<{ size: number; contentType: string }> {
  const response = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key(path) }));
  if (response.ContentLength === undefined) throw new Error('Receipt object size is unavailable');
  return { size: response.ContentLength, contentType: response.ContentType || 'application/octet-stream' };
}
