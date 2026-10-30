import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { deepStrictEqual } from 'node:assert/strict';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';
import { DeleteObjectCommand, GetObjectCommand, ListObjectVersionsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const MAGIC = Buffer.from('FLHQBK1');
const HEADER_SIZE = MAGIC.length + 16 + 12;
const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const DEV_BUCKET = 'fieldlogichq-bookkeeping-receipts-dev-859850635274';
const PROD_HOST = 'yfufvc3kksszegkyztie7hveoq.dsql.us-east-2.on.aws';
const PROD_BUCKET = 'fieldlogichq-bookkeeping-receipts-859850635274';
const [command, filename] = process.argv.slice(2);
if (!['create', 'verify', 'restore-dev', 'restore-drill-dev'].includes(command) || !filename) {
  throw new Error('Usage: node --env-file=.env.local scripts/bookkeeping-backup.mjs <create|verify|restore-dev|restore-drill-dev> <archive.bkenc>');
}
const passphrase = process.env.BOOKKEEPING_BACKUP_PASSPHRASE;
if (!passphrase || passphrase.length < 16) throw new Error('Set BOOKKEEPING_BACKUP_PASSPHRASE to at least 16 characters before running');
const archive = resolve(filename);

function environment() {
  const host = process.env.BOOKKEEPING_DSQL_ENDPOINT;
  const bucket = process.env.BOOKKEEPING_S3_BUCKET;
  if (host === DEV_HOST && bucket === DEV_BUCKET) return { name: 'dev', host, bucket };
  if (host === PROD_HOST && bucket === PROD_BUCKET) return { name: 'prod', host, bucket };
  throw new Error('Bookkeeping endpoint and bucket must match one known environment');
}

function database(host) {
  return auroraDSQLPostgres({ host, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
}

function safeCents(value) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents)) throw new Error('Backup amount exceeds safe integer range');
  return cents;
}

function expenseRow(raw) {
  return { ...raw,
    revision: Number(raw.revision),
    original_cents: safeCents(raw.original_cents), cad_cents: safeCents(raw.cad_cents),
    tax_cad_cents: safeCents(raw.tax_cad_cents), business_use_percent: Number(raw.business_use_percent),
    expense_date: raw.expense_date instanceof Date ? raw.expense_date.toISOString().slice(0, 10) : String(raw.expense_date).slice(0, 10),
    incurred_date: raw.incurred_date instanceof Date ? raw.incurred_date.toISOString().slice(0, 10) : raw.incurred_date ?? null,
    paid_date: raw.paid_date instanceof Date ? raw.paid_date.toISOString().slice(0, 10) : raw.paid_date ?? null,
    created_at: raw.created_at instanceof Date ? raw.created_at.toISOString() : String(raw.created_at),
  };
}

function ownerRow(raw) {
  return { ...raw,
    revision: Number(raw.revision), amount_cents: safeCents(raw.amount_cents),
    movement_date: raw.movement_date instanceof Date ? raw.movement_date.toISOString().slice(0, 10) : String(raw.movement_date).slice(0, 10),
    created_at: raw.created_at instanceof Date ? raw.created_at.toISOString() : String(raw.created_at),
  };
}

async function* records(sql, s3, env) {
  const rows = await sql`SELECT * FROM bookkeeping.expense_revisions ORDER BY expense_id, revision LIMIT 1001`;
  if (rows.length > 1000) throw new Error('Backup needs pagination before more than 1000 revisions');
  const ownerTable = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'bookkeeping' AND table_name = 'owner_movement_revisions'`;
  const ownerRows = ownerTable.length ? await sql`SELECT * FROM bookkeeping.owner_movement_revisions ORDER BY movement_id, revision LIMIT 1001` : [];
  if (ownerRows.length > 1000) throw new Error('Backup needs pagination before more than 1000 owner movement revisions');
  yield JSON.stringify({ type: 'header', format: 2, environment: env.name, created_at: new Date().toISOString() }) + '\n';
  const paths = new Set();
  for (const raw of rows) {
    const row = expenseRow(raw);
    if (row.receipt_path) paths.add(row.receipt_path);
    yield JSON.stringify({ type: 'revision', row }) + '\n';
  }
  for (const raw of ownerRows) {
    const row = ownerRow(raw);
    yield JSON.stringify({ type: 'owner_movement_revision', row }) + '\n';
  }
  for (const path of [...paths].sort()) {
    const response = await s3.send(new GetObjectCommand({ Bucket: env.bucket, Key: `receipts/${path}` }));
    if (!response.Body) throw new Error(`Receipt body missing: ${path}`);
    const bytes = await response.Body.transformToByteArray();
    yield JSON.stringify({ type: 'receipt', path, content_type: response.ContentType || 'application/octet-stream',
      byte_length: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
      base64: Buffer.from(bytes).toString('base64') }) + '\n';
  }
  yield JSON.stringify({ type: 'end', revisions: rows.length, owner_movements: ownerRows.length, receipts: paths.size }) + '\n';
}

async function createBackup() {
  const env = environment();
  const sql = database(env.host);
  const s3 = new S3Client({ region: 'us-east-2' });
  await mkdir(dirname(archive), { recursive: true });
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let created = false;
  try {
    await writeFile(archive, Buffer.concat([MAGIC, salt, iv]), { flag: 'wx', mode: 0o600 });
    created = true;
    await pipeline(Readable.from(records(sql, s3, env)), cipher, createWriteStream(archive, { flags: 'a' }));
    await appendFile(archive, cipher.getAuthTag());
    console.log(`Encrypted ${env.name} backup created: ${archive}`);
  } catch (error) {
    if (created) await rm(archive, { force: true });
    throw error;
  } finally { await sql.end(); s3.destroy(); }
}

async function archiveEnvelope() {
  const info = await stat(archive);
  if (info.size < HEADER_SIZE + 16) throw new Error('Archive is incomplete');
  const handle = await open(archive, 'r');
  const head = Buffer.alloc(HEADER_SIZE);
  const tag = Buffer.alloc(16);
  try {
    await handle.read(head, 0, head.length, 0);
    await handle.read(tag, 0, tag.length, info.size - tag.length);
  } finally { await handle.close(); }
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Unsupported backup format');
  return { size: info.size, salt: head.subarray(MAGIC.length, MAGIC.length + 16), iv: head.subarray(MAGIC.length + 16), tag };
}

async function* decryptedLines(envelope) {
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(passphrase, envelope.salt, 32), envelope.iv);
  decipher.setAuthTag(envelope.tag);
  const stream = createReadStream(archive, { start: HEADER_SIZE, end: envelope.size - 17 }).pipe(decipher);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) yield line;
}

async function verifyBackup(envelope) {
  let meta;
  let end;
  const rows = [];
  const ownerRows = [];
  const paths = new Set();
  const found = new Set();
  const ids = new Set();
  const ownerIds = new Set();
  for await (const line of decryptedLines(envelope)) {
    const item = JSON.parse(line);
    if (!meta) {
      if (item.type !== 'header' || ![1, 2].includes(item.format) || !['dev', 'prod'].includes(item.environment)) throw new Error('Invalid backup header');
      meta = item;
    } else if (item.type === 'revision' && !end) {
      const row = item.row;
      if (!/^[0-9a-f-]{36}$/i.test(row.expense_id) || !Number.isInteger(row.revision) || row.revision < 1) throw new Error('Invalid revision identity');
      const id = `${row.expense_id}/${row.revision}`;
      if (ids.has(id)) throw new Error('Duplicate revision in backup');
      ids.add(id);
      if (row.receipt_path) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9_-]{1,80}$/i.test(row.receipt_path)) {
          throw new Error('Invalid receipt path');
        }
        paths.add(row.receipt_path);
      }
      rows.push(row);
    } else if (item.type === 'owner_movement_revision' && !end && meta.format === 2) {
      const row = item.row;
      if (!/^[0-9a-f-]{36}$/i.test(row.movement_id) || !Number.isInteger(row.revision) || row.revision < 1 ||
        !['owner_contribution', 'owner_draw', 'expense_reimbursement'].includes(row.movement_kind) ||
        !Number.isSafeInteger(row.amount_cents) || row.amount_cents < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(row.movement_date)) {
        throw new Error('Invalid owner movement revision');
      }
      const id = `${row.movement_id}/${row.revision}`;
      if (ownerIds.has(id)) throw new Error('Duplicate owner movement revision in backup');
      ownerIds.add(id);
      ownerRows.push(row);
    } else if (item.type === 'receipt' && !end) {
      if (!paths.has(item.path) || found.has(item.path)) throw new Error('Unexpected or duplicate receipt');
      const bytes = Buffer.from(item.base64, 'base64');
      if (bytes.length !== item.byte_length || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error('Receipt checksum mismatch');
      found.add(item.path);
    } else if (item.type === 'end' && !end) {
      if (item.revisions !== rows.length || (meta.format === 2 && item.owner_movements !== ownerRows.length) ||
        item.receipts !== paths.size || found.size !== paths.size) throw new Error('Backup counts or receipts do not match');
      end = item;
    } else throw new Error('Unexpected backup record');
  }
  if (!meta || !end) throw new Error('Backup ended before its manifest');
  return { meta, rows, ownerRows, receiptCount: found.size };
}

async function insertExpense(sql, table, row) {
  await sql`INSERT INTO ${sql('bookkeeping')}.${sql(table)} (
    expense_id, revision, expense_date, incurred_date, paid_date, supplier, category, business_purpose,
    original_currency, original_cents, cad_cents, tax_cad_cents, tax_amount_known, tax_status,
    business_use_percent, payment_source, conversion_note, conversion_source, conversion_rate, notes, change_reason,
    receipt_path, receipt_name, void_reason, created_at, created_by
  ) VALUES (
    ${row.expense_id}::uuid, ${row.revision}, ${row.expense_date}::date,
    ${row.incurred_date ?? null}::date, ${row.paid_date ?? null}::date, ${row.supplier},
    ${row.category}, ${row.business_purpose}, ${row.original_currency}, ${row.original_cents},
    ${row.cad_cents}, ${row.tax_cad_cents}, ${row.tax_amount_known ?? null}, ${row.tax_status}, ${row.business_use_percent},
    ${row.payment_source}, ${row.conversion_note}, ${row.conversion_source ?? null}, ${row.conversion_rate ?? null}, ${row.notes}, ${row.change_reason},
    ${row.receipt_path}, ${row.receipt_name}, ${row.void_reason}, ${row.created_at}::timestamptz,
    ${row.created_by}::uuid
  )`;
}

async function insertOwner(sql, table, row) {
  await sql`INSERT INTO ${sql('bookkeeping')}.${sql(table)} (
    movement_id, revision, movement_date, movement_kind, amount_cents, linked_expense_id,
    source_reference, note, change_reason, void_reason, created_at, created_by
  ) VALUES (
    ${row.movement_id}::uuid, ${row.revision}, ${row.movement_date}::date, ${row.movement_kind},
    ${row.amount_cents}, ${row.linked_expense_id}::uuid, ${row.source_reference}, ${row.note},
    ${row.change_reason}, ${row.void_reason}, ${row.created_at}::timestamptz, ${row.created_by}::uuid
  )`;
}

async function restoreDev(envelope, verified) {
  const env = environment();
  if (env.name !== 'dev' || verified.meta.environment !== 'dev' || process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin') {
    throw new Error('Restore is restricted to a development backup, development resources and the local admin connection');
  }
  const sql = database(env.host);
  const s3 = new S3Client({ region: 'us-east-2' });
  try {
    const count = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_revisions`;
    const ownerTable = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'bookkeeping' AND table_name = 'owner_movement_revisions'`;
    if (verified.ownerRows.length && !ownerTable.length) throw new Error('Apply owner movement schema before restoring this archive');
    const ownerCount = ownerTable.length ? await sql`SELECT count(*)::int AS count FROM bookkeeping.owner_movement_revisions` : [{ count: 0 }];
    const objects = await s3.send(new ListObjectVersionsCommand({ Bucket: env.bucket, Prefix: 'receipts/', MaxKeys: 1 }));
    if (count[0].count !== 0 || ownerCount[0].count !== 0 || (objects.Versions?.length ?? 0) !== 0 || (objects.DeleteMarkers?.length ?? 0) !== 0) {
      throw new Error('Development database and all receipt versions must be empty before restore');
    }
    for await (const line of decryptedLines(envelope)) {
      const item = JSON.parse(line);
      if (item.type !== 'receipt') continue;
      await s3.send(new PutObjectCommand({ Bucket: env.bucket, Key: `receipts/${item.path}`,
        Body: Buffer.from(item.base64, 'base64'), ContentType: item.content_type, IfNoneMatch: '*' }));
    }
    for (const row of verified.rows) await insertExpense(sql, 'expense_revisions', row);
    for (const row of verified.ownerRows) await insertOwner(sql, 'owner_movement_revisions', row);
    const restored = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_revisions`;
    const restoredOwners = ownerTable.length ? await sql`SELECT count(*)::int AS count FROM bookkeeping.owner_movement_revisions` : [{ count: 0 }];
    if (restored[0].count !== verified.rows.length || restoredOwners[0].count !== verified.ownerRows.length) throw new Error('Restored revision count differs from the archive');
    console.log(`Restored ${restored[0].count} expense revisions, ${restoredOwners[0].count} owner movement revisions and ${verified.receiptCount} receipts to development`);
  } finally { await sql.end(); s3.destroy(); }
}

/** Replay an archive into isolated development tables and S3 keys without clearing working data. */
async function restoreDrillDev(envelope, verified) {
  const env = environment();
  if (env.name !== 'dev' || verified.meta.environment !== 'dev' || process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin') {
    throw new Error('Recovery drill is restricted to a development archive and development admin connection');
  }
  const id = randomBytes(8).toString('hex');
  const expenseTable = `recovery_expenses_${id}`;
  const ownerTable = `recovery_owners_${id}`;
  const sql = database(env.host);
  const s3 = new S3Client({ region: 'us-east-2' });
  const objects = [];
  let expenseCreated = false;
  let ownerCreated = false;
  try {
    const hasOwnerTable = await sql`SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'bookkeeping' AND table_name = 'owner_movement_revisions'`;
    if (verified.ownerRows.length && !hasOwnerTable.length) throw new Error('Owner movement table is required for this archive');
    const beforeExpenses = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_revisions`;
    const beforeOwners = hasOwnerTable.length ? await sql`SELECT count(*)::int AS count FROM bookkeeping.owner_movement_revisions` : [{ count: 0 }];
    await sql.unsafe(`CREATE TABLE bookkeeping.${expenseTable} (LIKE bookkeeping.expense_revisions INCLUDING ALL)`);
    expenseCreated = true;
    if (hasOwnerTable.length) {
      await sql.unsafe(`CREATE TABLE bookkeeping.${ownerTable} (LIKE bookkeeping.owner_movement_revisions INCLUDING ALL)`);
      ownerCreated = true;
    }
    for (const row of verified.rows) await insertExpense(sql, expenseTable, row);
    for (const row of verified.ownerRows) await insertOwner(sql, ownerTable, row);
    const replayedExpenses = await sql.unsafe(`SELECT * FROM bookkeeping.${expenseTable} ORDER BY expense_id, revision`);
    deepStrictEqual(replayedExpenses.map(expenseRow), verified.rows);
    if (ownerCreated) {
      const replayedOwners = await sql.unsafe(`SELECT * FROM bookkeeping.${ownerTable} ORDER BY movement_id, revision`);
      deepStrictEqual(replayedOwners.map(ownerRow), verified.ownerRows);
    }
    let receiptCount = 0;
    for await (const line of decryptedLines(envelope)) {
      const item = JSON.parse(line);
      if (item.type !== 'receipt') continue;
      const key = `recovery-drills/${id}/receipts/${item.path}`;
      const bytes = Buffer.from(item.base64, 'base64');
      const object = { key, versionId: null };
      objects.push(object);
      const uploaded = await s3.send(new PutObjectCommand({ Bucket: env.bucket, Key: key,
        Body: bytes, ContentType: item.content_type, IfNoneMatch: '*' }));
      object.versionId = uploaded.VersionId ?? null;
      const replayed = await s3.send(new GetObjectCommand({ Bucket: env.bucket, Key: key }));
      if (!replayed.Body) throw new Error('Replayed receipt has no body');
      const replayedBytes = Buffer.from(await replayed.Body.transformToByteArray());
      if (createHash('sha256').update(replayedBytes).digest('hex') !== item.sha256 || replayed.ContentType !== item.content_type) {
        throw new Error('Replayed receipt differs from archive');
      }
      receiptCount++;
    }
    if (receiptCount !== verified.receiptCount) throw new Error('Replayed receipt count differs from archive');
    const afterExpenses = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_revisions`;
    const afterOwners = hasOwnerTable.length ? await sql`SELECT count(*)::int AS count FROM bookkeeping.owner_movement_revisions` : [{ count: 0 }];
    if (afterExpenses[0].count !== beforeExpenses[0].count || afterOwners[0].count !== beforeOwners[0].count) {
      throw new Error('Working bookkeeping row counts changed during the recovery drill');
    }
    console.log(`Development recovery drill replayed ${verified.rows.length} expense revisions, ${verified.ownerRows.length} owner movement revisions and ${receiptCount} receipts; working row counts stayed at ${afterExpenses[0].count} expenses and ${afterOwners[0].count} owner movements`);
  } finally {
    const cleanupErrors = [];
    for (const object of objects) {
      try {
        if (object.versionId) await s3.send(new DeleteObjectCommand({ Bucket: env.bucket, Key: object.key, VersionId: object.versionId }));
        else {
          const versions = await s3.send(new ListObjectVersionsCommand({ Bucket: env.bucket, Prefix: object.key }));
          for (const version of [...(versions.Versions ?? []), ...(versions.DeleteMarkers ?? [])]) {
            if (version.Key === object.key) await s3.send(new DeleteObjectCommand({ Bucket: env.bucket, Key: object.key, VersionId: version.VersionId }));
          }
        }
      } catch (error) { cleanupErrors.push(error); }
    }
    if (ownerCreated) try { await sql.unsafe(`DROP TABLE bookkeeping.${ownerTable}`); } catch (error) { cleanupErrors.push(error); }
    if (expenseCreated) try { await sql.unsafe(`DROP TABLE bookkeeping.${expenseTable}`); } catch (error) { cleanupErrors.push(error); }
    try { await sql.end(); } catch (error) { cleanupErrors.push(error); }
    s3.destroy();
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Recovery drill cleanup was incomplete');
  }
}

if (command === 'create') await createBackup();
else {
  const envelope = await archiveEnvelope();
  const verified = await verifyBackup(envelope);
  console.log(`Verified ${verified.meta.environment} backup: ${verified.rows.length} expense revisions, ${verified.ownerRows.length} owner movement revisions, ${verified.receiptCount} receipts`);
  if (command === 'restore-dev') await restoreDev(envelope, verified);
  if (command === 'restore-drill-dev') await restoreDrillDev(envelope, verified);
}
