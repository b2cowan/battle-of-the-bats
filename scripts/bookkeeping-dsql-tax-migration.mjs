import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';

const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const mode = process.argv[2] ?? 'inspect';
if (!['inspect', 'apply'].includes(mode)) throw new Error('Usage: node --env-file=.env.local scripts/bookkeeping-dsql-tax-migration.mjs <inspect|apply>');
if (process.env.BOOKKEEPING_DSQL_ENDPOINT !== DEV_HOST || process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin') {
  throw new Error('This script is restricted to the local development bookkeeping database');
}

const sql = auroraDSQLPostgres({ host: DEV_HOST, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
try {
  const count = await sql.unsafe('SELECT COUNT(*)::int AS revisions, COUNT(DISTINCT expense_id)::int AS expenses FROM bookkeeping.expense_revisions');
  const taxGroups = await sql.unsafe('SELECT tax_status, (tax_cad_cents = 0) AS zero_amount, COUNT(*)::int AS revisions FROM bookkeeping.expense_revisions GROUP BY tax_status, (tax_cad_cents = 0) ORDER BY tax_status, zero_amount');
  const columns = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions' AND column_name = 'tax_amount_known'");
  console.log(JSON.stringify({ environment: 'dev', ...count[0], tax_groups: taxGroups, tax_column: columns.length === 1 }));
  if (mode === 'apply') {
    const path = fileURLToPath(new URL('./bookkeeping-aws/003_tax_amount_known.sql', import.meta.url));
    const statements = readFileSync(path, 'utf8').replace(/^--.*$/gm, '').split(';').map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
    const after = await sql.unsafe('SELECT COUNT(*)::int AS revisions, COUNT(DISTINCT expense_id)::int AS expenses FROM bookkeeping.expense_revisions');
    const migratedColumn = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions' AND column_name = 'tax_amount_known'");
    if (after[0].revisions !== count[0].revisions || after[0].expenses !== count[0].expenses || migratedColumn.length !== 1) {
      throw new Error('Tax migration post-check failed; inspect the development cluster');
    }
    console.log(JSON.stringify({ applied: true, ...after[0], tax_column: true }));
  }
} finally {
  await sql.end();
}
