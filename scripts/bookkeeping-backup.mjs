import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';
import { GetObjectCommand, ListObjectVersionsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const MAGIC = Buffer.from('FLHQBK1');
const HEADER_SIZE = MAGIC.length + 16 + 12;
const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const DEV_BUCKET = 'fieldlogichq-bookkeeping-receipts-dev-859850635274';
const PROD_HOST = 'yfufvc3kksszegkyztie7hveoq.dsql.us-east-2.on.aws';
const PROD_BUCKET = 'fieldlogichq-bookkeeping-receipts-859850635274';
const [command, filename] = process.argv.slice(2);
if (!['create', 'verify', 'restore-dev'].includes(command) || !filename) {
  throw new Error('Usage: node --env-file=.env.local scripts/bookkeeping-backup.mjs <create|verify|restore-dev> <archive.bkenc>');
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

async function* records(sql, s3, env) {
  const rows = await sql`SELECT * FROM bookkeeping.expense_revisions ORDER BY expense_id, revision LIMIT 1001`;
  if (rows.length > 1000) throw new Error('Backup needs pagination before more than 1000 revisions');
  yield JSON.stringify({ type: 'header', format: 1, environment: env.name, created_at: new Date().toISOString() }) + '\n';
  const paths = new Set();
  for (const raw of rows) {
    const row = { ...raw,
      expense_date: raw.expense_date instanceof Date ? raw.expense_date.toISOString().slice(0, 10) : String(raw.expense_date).slice(0, 10),
      created_at: raw.created_at instanceof Date ? raw.created_at.toISOString() : String(raw.created_at),
    };
    if (row.receipt_path) paths.add(row.receipt_path);
    yield JSON.stringify({ type: 'revision', row }) + '\n';
  }
  for (const path of [...paths].sort()) {
    const response = await s3.send(new GetObjectCommand({ Bucket: env.bucket, Key: `receipts/${path}` }));
    if (!response.Body) throw new Error(`Receipt body missing: ${path}`);
    const bytes = await response.Body.transformToByteArray();
    yield JSON.stringify({ type: 'receipt', path, content_type: response.ContentType || 'application/octet-stream',
      byte_length: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
      base64: Buffer.from(bytes).toString('base64') }) + '\n';
  }
  yield JSON.stringify({ type: 'end', revisions: rows.length, receipts: paths.size }) + '\n';
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
  const paths = new Set();
  const found = new Set();
  const ids = new Set();
  for await (const line of decryptedLines(envelope)) {
    const item = JSON.parse(line);
    if (!meta) {
      if (item.type !== 'header' || item.format !== 1 || !['dev', 'prod'].includes(item.environment)) throw new Error('Invalid backup header');
      meta = item;
    } else if (item.type === 'revision' && !end) {
      const row = item.row;
      if (!/^[0-9a-f-]{36}$/i.test(row.expense_id) || !Number.isInteger(row.revision) || row.revision < 1) throw new Error('Invalid revision identity');
      const id = `${row.expense_id}/${row.revision}`;
      if (ids.has(id)) throw new Error('Duplicate revision in backup');
      ids.add(id);
      if (row.receipt_path) {
        if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(row.receipt_path)) throw new Error('Invalid receipt path');
        paths.add(row.receipt_path);
      }
      rows.push(row);
    } else if (item.type === 'receipt' && !end) {
      if (!paths.has(item.path) || found.has(item.path)) throw new Error('Unexpected or duplicate receipt');
      const bytes = Buffer.from(item.base64, 'base64');
      if (bytes.length !== item.byte_length || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error('Receipt checksum mismatch');
      found.add(item.path);
    } else if (item.type === 'end' && !end) {
      if (item.revisions !== rows.length || item.receipts !== paths.size || found.size !== paths.size) throw new Error('Backup counts or receipts do not match');
      end = item;
    } else throw new Error('Unexpected backup record');
  }
  if (!meta || !end) throw new Error('Backup ended before its manifest');
  return { meta, rows, receiptCount: found.size };
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
    const objects = await s3.send(new ListObjectVersionsCommand({ Bucket: env.bucket, Prefix: 'receipts/', MaxKeys: 1 }));
    if (count[0].count !== 0 || (objects.Versions?.length ?? 0) !== 0 || (objects.DeleteMarkers?.length ?? 0) !== 0) {
      throw new Error('Development database and all receipt versions must be empty before restore');
    }
    for await (const line of decryptedLines(envelope)) {
      const item = JSON.parse(line);
      if (item.type !== 'receipt') continue;
      await s3.send(new PutObjectCommand({ Bucket: env.bucket, Key: `receipts/${item.path}`,
        Body: Buffer.from(item.base64, 'base64'), ContentType: item.content_type, IfNoneMatch: '*' }));
    }
    for (const row of verified.rows) {
      await sql`INSERT INTO bookkeeping.expense_revisions (
        expense_id, revision, expense_date, supplier, category, business_purpose,
        original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
        business_use_percent, payment_source, conversion_note, notes, change_reason,
        receipt_path, receipt_name, void_reason, created_at, created_by
      ) VALUES (
        ${row.expense_id}::uuid, ${row.revision}, ${row.expense_date}::date, ${row.supplier},
        ${row.category}, ${row.business_purpose}, ${row.original_currency}, ${row.original_cents},
        ${row.cad_cents}, ${row.tax_cad_cents}, ${row.tax_status}, ${row.business_use_percent},
        ${row.payment_source}, ${row.conversion_note}, ${row.notes}, ${row.change_reason},
        ${row.receipt_path}, ${row.receipt_name}, ${row.void_reason}, ${row.created_at}::timestamptz,
        ${row.created_by}::uuid
      )`;
    }
    const restored = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_revisions`;
    if (restored[0].count !== verified.rows.length) throw new Error('Restored revision count differs from the archive');
    console.log(`Restored ${restored[0].count} revisions and ${verified.receiptCount} receipts to development`);
  } finally { await sql.end(); s3.destroy(); }
}

if (command === 'create') await createBackup();
else {
  const envelope = await archiveEnvelope();
  const verified = await verifyBackup(envelope);
  console.log(`Verified ${verified.meta.environment} backup: ${verified.rows.length} revisions, ${verified.receiptCount} receipts`);
  if (command === 'restore-dev') await restoreDev(envelope, verified);
}
