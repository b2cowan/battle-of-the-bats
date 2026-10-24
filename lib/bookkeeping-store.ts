import 'server-only';

import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ExpenseRevision } from './bookkeeping-expenses';

type NewExpenseRevision = Omit<ExpenseRevision, 'created_at'>;
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
  return {
    ...row,
    revision: Number(row.revision),
    original_cents: Number(row.original_cents),
    cad_cents: Number(row.cad_cents),
    tax_cad_cents: Number(row.tax_cad_cents),
    business_use_percent: Number(row.business_use_percent),
    expense_date: row.expense_date instanceof Date
      ? row.expense_date.toISOString().slice(0, 10)
      : String(row.expense_date).slice(0, 10),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  } as ExpenseRevision;
}

export async function listExpenseRevisions(): Promise<ExpenseRevision[]> {
  const rows = await db()`SELECT * FROM bookkeeping.expense_revisions ORDER BY expense_date DESC LIMIT 1001`;
  return rows.map(revision);
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
  const rows = await db()`INSERT INTO bookkeeping.expense_revisions (
    expense_id, revision, expense_date, supplier, category, business_purpose,
    original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
    business_use_percent, payment_source, conversion_note, notes, change_reason,
    receipt_path, receipt_name, void_reason, created_by
  ) VALUES (
    ${row.expense_id}::uuid, ${row.revision}, ${row.expense_date}::date, ${row.supplier},
    ${row.category}, ${row.business_purpose}, ${row.original_currency}, ${row.original_cents},
    ${row.cad_cents}, ${row.tax_cad_cents}, ${row.tax_status}, ${row.business_use_percent},
    ${row.payment_source}, ${row.conversion_note}, ${row.notes}, ${row.change_reason},
    ${row.receipt_path}, ${row.receipt_name}, ${row.void_reason}, ${row.created_by}::uuid
  ) RETURNING *`;
  return revision(rows[0]);
}

/** Permanently remove one expense and every saved revision, only if its latest revision still matches. */
export async function deleteExpenseRevisions(expenseId: string, expectedRevision: number): Promise<string[] | null> {
  const rows = await db()`DELETE FROM bookkeeping.expense_revisions
    WHERE expense_id = ${expenseId}::uuid
      AND (SELECT MAX(revision) FROM bookkeeping.expense_revisions WHERE expense_id = ${expenseId}::uuid) = ${expectedRevision}
    RETURNING receipt_path`;
  if (!rows.length) return null;
  return [...new Set(rows.map(row => typeof row.receipt_path === 'string' ? row.receipt_path : null).filter((path): path is string => path !== null))];
}

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
