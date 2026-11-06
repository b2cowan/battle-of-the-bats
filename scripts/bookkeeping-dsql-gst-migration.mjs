import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';

// GST/HST Stage 4a migration 006: development cluster only. Inspect, apply, then re-count.
const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const mode = process.argv[2] ?? 'inspect';
if (!['inspect', 'apply'].includes(mode)) throw new Error('Usage: node --env-file=.env.local scripts/bookkeeping-dsql-gst-migration.mjs <inspect|apply>');
if (process.env.BOOKKEEPING_DSQL_ENDPOINT !== DEV_HOST || process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin' ||
  (process.env.BOOKKEEPING_AWS_REGION || 'us-east-2') !== 'us-east-2') {
  throw new Error('This script is restricted to the local development bookkeeping database');
}

const NEW_COLUMNS = { tax_answer: 'text', supplier_tax_number: 'text', supplier_registration: 'text', purchase_kind: 'text', number_unobtainable: 'boolean' };
const NEW_TABLES = ['expense_tax_lines', 'gst_registration_revisions'];
const sql = auroraDSQLPostgres({ host: DEV_HOST, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
const columns = () => sql.unsafe(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions' AND column_name IN (${Object.keys(NEW_COLUMNS).map(name => `'${name}'`).join(', ')}) ORDER BY column_name`);
const tables = () => sql.unsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'bookkeeping' AND table_name IN (${NEW_TABLES.map(name => `'${name}'`).join(', ')}) ORDER BY table_name`);
const counts = () => sql.unsafe('SELECT COUNT(*)::int AS revisions, COUNT(DISTINCT expense_id)::int AS expenses FROM bookkeeping.expense_revisions');
const tally = async present => ({
  tax_lines: present.includes('expense_tax_lines') ? (await sql.unsafe('SELECT COUNT(*)::int AS n FROM bookkeeping.expense_tax_lines'))[0].n : null,
  registration: present.includes('gst_registration_revisions') ? await sql.unsafe('SELECT revision, effective_date::text AS effective_date, reason FROM bookkeeping.gst_registration_revisions ORDER BY revision') : null,
});

try {
  const before = (await counts())[0];
  const beforeTables = (await tables()).map(row => row.table_name);
  console.log(JSON.stringify({ environment: 'dev', ...before, columns: await columns(), tables: beforeTables, ...await tally(beforeTables) }));
  if (mode === 'apply') {
    const file = fileURLToPath(new URL('./bookkeeping-aws/006_gst_tax_lines.sql', import.meta.url));
    for (const statement of readFileSync(file, 'utf8').replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(Boolean)) {
      await sql.unsafe(statement);
    }
    const after = (await counts())[0];
    const actual = await columns();
    const afterTables = (await tables()).map(row => row.table_name);
    const { tax_lines, registration } = await tally(afterTables);
    const columnsOk = Object.entries(NEW_COLUMNS).every(([name, type]) => actual.find(row => row.column_name === name)?.data_type === type);
    const registrationOk = registration?.length >= 1 && registration[0].revision === 1 && registration[0].effective_date === '2026-09-26';
    if (after.revisions !== before.revisions || after.expenses !== before.expenses || !columnsOk ||
      afterTables.length !== NEW_TABLES.length || !registrationOk || (beforeTables.length === 0 && tax_lines !== 0)) {
      throw new Error('GST/HST migration post-check failed; inspect the development cluster');
    }
    console.log(JSON.stringify({ applied: true, ...after, columns: actual, tables: afterTables, tax_lines, registration }));
  }
} finally { await sql.end(); }
