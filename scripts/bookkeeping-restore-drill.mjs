import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';
import { DeleteObjectCommand, GetObjectCommand, ListObjectVersionsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const host = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const bucket = 'fieldlogichq-bookkeeping-receipts-dev-859850635274';
if (process.env.BOOKKEEPING_DSQL_ENDPOINT !== host || process.env.BOOKKEEPING_S3_BUCKET !== bucket ||
  process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin') {
  throw new Error('Restore drill is restricted to the local development database and bucket');
}
const sql = auroraDSQLPostgres({ host, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
const s3 = new S3Client({ region: 'us-east-2' });
const id = randomUUID();
const actor = randomUUID();
const key = `receipts/${id}/${randomUUID()}`;
const archive = `.bookkeeping-backups/drill-${randomUUID()}.bkenc`;
const tamperedArchive = `${archive}.tampered`;
const passphrase = `${randomUUID()}${randomUUID()}`;
const bytes = Buffer.from('%PDF-1.7\nsynthetic bookkeeping restore drill\n');

function backup(command) {
  execFileSync(process.execPath, ['--env-file=.env.local', 'scripts/bookkeeping-backup.mjs', command, archive], {
    stdio: 'inherit', env: { ...process.env, BOOKKEEPING_BACKUP_PASSPHRASE: passphrase },
  });
}

try {
  const count = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_revisions`;
  const objects = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket, Prefix: 'receipts/', MaxKeys: 1 }));
  if (count[0].count !== 0 || (objects.Versions?.length ?? 0) !== 0 || (objects.DeleteMarkers?.length ?? 0) !== 0) {
    throw new Error('Drill requires an empty development expense table and all receipt versions');
  }
  await mkdir('.bookkeeping-backups', { recursive: true });
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: 'application/pdf', IfNoneMatch: '*' }));
  await sql`INSERT INTO bookkeeping.expense_revisions (
    expense_id, revision, expense_date, supplier, category, business_purpose,
    original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
    business_use_percent, payment_source, receipt_path, receipt_name, created_by
  ) VALUES (
    ${id}::uuid, 1, '2026-10-23'::date, 'Synthetic restore drill', 'Testing',
    'Restore proof only', 'CAD', 123, 123, 0, 'none', 100, 'personal',
    ${key.slice('receipts/'.length)}, 'synthetic.pdf', ${actor}::uuid
  )`;
  const before = await sql`SELECT created_at FROM bookkeeping.expense_revisions WHERE expense_id = ${id}::uuid`;
  backup('create');
  backup('verify');
  const tampered = await readFile(archive);
  tampered[40] ^= 1;
  await writeFile(tamperedArchive, tampered);
  let rejected = false;
  try {
    execFileSync(process.execPath, ['--env-file=.env.local', 'scripts/bookkeeping-backup.mjs', 'verify', tamperedArchive], {
      stdio: 'pipe', env: { ...process.env, BOOKKEEPING_BACKUP_PASSPHRASE: passphrase },
    });
  } catch { rejected = true; }
  if (!rejected) throw new Error('Tampered encrypted backup was accepted');
  await sql`DELETE FROM bookkeeping.expense_revisions WHERE expense_id = ${id}::uuid`;
  const versionsBefore = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket, Prefix: key }));
  for (const version of versionsBefore.Versions ?? []) {
    if (version.Key === key) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: version.VersionId }));
  }
  backup('restore-dev');
  const after = await sql`SELECT expense_id, revision, created_at, cad_cents FROM bookkeeping.expense_revisions WHERE expense_id = ${id}::uuid`;
  if (after.length !== 1 || after[0].revision !== 1 || Number(after[0].cad_cents) !== 123 ||
    String(after[0].created_at) !== String(before[0].created_at)) throw new Error('Restored row differs from source');
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const received = object.Body && await object.Body.transformToByteArray();
  if (!received || !Buffer.from(received).equals(bytes)) throw new Error('Restored receipt bytes differ from source');
  console.log('Synthetic development backup and restore preserved the revision, timestamp and receipt bytes');
} finally {
  try { await sql`DELETE FROM bookkeeping.expense_revisions WHERE expense_id = ${id}::uuid`; }
  finally {
    const versions = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket, Prefix: key }));
    for (const version of [...(versions.Versions ?? []), ...(versions.DeleteMarkers ?? [])]) {
      if (version.Key === key) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: version.VersionId }));
    }
    await rm(archive, { force: true });
    await rm(tamperedArchive, { force: true });
    await sql.end();
    s3.destroy();
  }
}
