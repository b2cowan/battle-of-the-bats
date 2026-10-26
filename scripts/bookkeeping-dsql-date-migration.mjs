import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';

const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const mode = process.argv[2] ?? 'inspect';
if (!['inspect', 'apply'].includes(mode)) throw new Error('Usage: node --env-file=.env.local scripts/bookkeeping-dsql-date-migration.mjs <inspect|apply>');
if (process.env.BOOKKEEPING_DSQL_ENDPOINT !== DEV_HOST || process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin') {
  throw new Error('This script is restricted to the local development bookkeeping database');
}

const sql = auroraDSQLPostgres({ host: DEV_HOST, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
try {
  const before = await sql.unsafe('SELECT COUNT(*)::int AS revisions, COUNT(DISTINCT expense_id)::int AS expenses FROM bookkeeping.expense_revisions');
  const categories = await sql.unsafe('SELECT DISTINCT category FROM bookkeeping.expense_revisions ORDER BY category');
  const columns = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions' AND column_name IN ('incurred_date', 'paid_date') ORDER BY column_name");
  console.log(JSON.stringify({ environment: 'dev', ...before[0], categories: categories.map(row => row.category), date_columns: columns.map(row => row.column_name) }));
  if (mode === 'apply') {
    const path = fileURLToPath(new URL('./bookkeeping-aws/002_expense_dates.sql', import.meta.url));
    const statements = readFileSync(path, 'utf8').replace(/^--.*$/gm, '').split(';').map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
    const after = await sql.unsafe('SELECT COUNT(*)::int AS revisions, COUNT(DISTINCT expense_id)::int AS expenses FROM bookkeeping.expense_revisions');
    const migratedColumns = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions' AND column_name IN ('incurred_date', 'paid_date') ORDER BY column_name");
    if (after[0].revisions !== before[0].revisions || after[0].expenses !== before[0].expenses || migratedColumns.length !== 2) {
      throw new Error('Date migration post-check failed; inspect the development cluster');
    }
    console.log(JSON.stringify({ applied: true, ...after[0], date_columns: migratedColumns.map(row => row.column_name) }));
  }
} finally {
  await sql.end();
}
