import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';

// GST/HST Stage 4b Session C migration 007 ("Mark as filed"): development cluster only. Inspect, apply, then re-count.
// Run: AWS_PROFILE=fieldlogichq BOOKKEEPING_DSQL_USERNAME=admin node --env-file=.env.local scripts/bookkeeping-dsql-filings-migration.mjs <inspect|apply>
const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const mode = process.argv[2] ?? 'inspect';
if (!['inspect', 'apply'].includes(mode)) throw new Error('Usage: node --env-file=.env.local scripts/bookkeeping-dsql-filings-migration.mjs <inspect|apply>');
if (process.env.BOOKKEEPING_DSQL_ENDPOINT !== DEV_HOST || process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin' ||
  (process.env.BOOKKEEPING_AWS_REGION || 'us-east-2') !== 'us-east-2') {
  throw new Error('This script is restricted to the local development bookkeeping database');
}

const TABLE = 'gst_return_filings';
const COLUMNS = 21;
const sql = auroraDSQLPostgres({ host: DEV_HOST, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
const present = async () => (await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'bookkeeping' AND table_name = ${TABLE}`).length === 1;
const columnCount = async () => (await sql`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = 'bookkeeping' AND table_name = ${TABLE}`)[0].n;
const grants = async () => (await sql`SELECT privilege_type FROM information_schema.role_table_grants
  WHERE table_schema = 'bookkeeping' AND table_name = ${TABLE} AND grantee = 'bookkeeping_app' ORDER BY privilege_type`).map(row => row.privilege_type);
const counts = async () => (await sql`SELECT
  (SELECT COUNT(*)::int FROM bookkeeping.expense_revisions) AS expense_revisions,
  (SELECT COUNT(*)::int FROM bookkeeping.gst_registration_revisions) AS registration_revisions`)[0];
const filings = async () => (await present()) ? (await sql.unsafe(`SELECT COUNT(*)::int AS n FROM bookkeeping.${TABLE}`))[0].n : null;

try {
  const before = { ...await counts(), table: await present(), filings: await filings() };
  console.log(JSON.stringify({ environment: 'dev', mode, before }));
  if (mode === 'apply') {
    const file = fileURLToPath(new URL('./bookkeeping-aws/007_gst_return_filings.sql', import.meta.url));
    // Aurora DSQL runs each DDL statement in its own transaction, apart from any DML: one statement at a time.
    for (const statement of readFileSync(file, 'utf8').replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(Boolean)) {
      await sql.unsafe(statement);
    }
    const after = { ...await counts(), table: await present(), columns: await columnCount(), grants: await grants(), filings: await filings() };
    const ok = after.table && after.columns === COLUMNS && after.grants.join(',') === 'INSERT,SELECT' &&
      after.expense_revisions === before.expense_revisions && after.registration_revisions === before.registration_revisions &&
      (before.table || after.filings === 0);
    if (!ok) throw new Error(`Filings migration post-check failed; inspect the development cluster: ${JSON.stringify(after)}`);
    console.log(JSON.stringify({ applied: true, after }));
  }
} finally { await sql.end(); }
