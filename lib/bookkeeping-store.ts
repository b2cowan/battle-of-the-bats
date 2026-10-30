import 'server-only';

import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ExpenseRevision } from './bookkeeping-expenses';
import type { OwnerMovementRevision } from './bookkeeping-owner-movements';

type NewExpenseRevision = Omit<ExpenseRevision, 'created_at'>;
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
  } as ExpenseRevision;
}

export async function listExpenseRevisions(): Promise<ExpenseRevision[]> {
  const rows = await db()`SELECT * FROM bookkeeping.expense_revisions ORDER BY expense_date DESC LIMIT 1001`;
  return rows.map(revision);
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
  return rows[0] ? revision(rows[0]) : null;
}

export async function receiptReference(expenseId: string, revisionNumber: number): Promise<ReceiptReference | null> {
  const rows = await db()`SELECT receipt_path, receipt_name FROM bookkeeping.expense_revisions
    WHERE expense_id = ${expenseId}::uuid AND revision = ${revisionNumber}`;
  return (rows[0] as ReceiptReference | undefined) ?? null;
}

export async function insertExpenseRevision(row: NewExpenseRevision): Promise<ExpenseRevision> {
  if ((!row.incurred_date || !row.paid_date) && !row.void_reason) {
    throw new Error('Both expense dates are required for a new or corrected expense');
  }
  const rows = await db()`INSERT INTO bookkeeping.expense_revisions (
    expense_id, revision, expense_date, incurred_date, paid_date, supplier, category, business_purpose,
    original_currency, original_cents, cad_cents, tax_cad_cents, tax_amount_known, tax_status,
    business_use_percent, payment_source, conversion_note, conversion_source, conversion_rate, notes, change_reason,
    receipt_path, receipt_name, void_reason, created_by
  ) VALUES (
    ${row.expense_id}::uuid, ${row.revision}, ${row.expense_date}::date,
    ${row.incurred_date ?? null}::date, ${row.paid_date ?? null}::date, ${row.supplier},
    ${row.category}, ${row.business_purpose}, ${row.original_currency}, ${row.original_cents},
    ${row.cad_cents}, ${row.tax_cad_cents}, ${row.tax_amount_known ?? null}, ${row.tax_status}, ${row.business_use_percent},
    ${row.payment_source}, ${row.conversion_note}, ${row.conversion_source ?? null}, ${row.conversion_rate ?? null}, ${row.notes}, ${row.change_reason},
    ${row.receipt_path}, ${row.receipt_name}, ${row.void_reason}, ${row.created_by}::uuid
  ) RETURNING *`;
  return revision(rows[0]);
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
