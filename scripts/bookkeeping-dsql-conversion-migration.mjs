import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';

const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const mode = process.argv[2] ?? 'inspect';
if (!['inspect', 'apply'].includes(mode)) throw new Error('Usage: node --env-file=.env.local scripts/bookkeeping-dsql-conversion-migration.mjs <inspect|apply>');
if (process.env.BOOKKEEPING_DSQL_ENDPOINT !== DEV_HOST || process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin' ||
  (process.env.BOOKKEEPING_AWS_REGION || 'us-east-2') !== 'us-east-2') {
  throw new Error('This script is restricted to the local development bookkeeping database');
}

const sql = auroraDSQLPostgres({ host: DEV_HOST, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
const columns = () => sql.unsafe("SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = 'bookkeeping' AND table_name = 'expense_revisions' AND column_name IN ('conversion_source', 'conversion_rate') ORDER BY column_name");
const counts = () => sql.unsafe('SELECT COUNT(*)::int AS revisions, COUNT(DISTINCT expense_id)::int AS expenses FROM bookkeeping.expense_revisions');
try {
  const before = (await counts())[0];
  const constraints = await sql.unsafe("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'bookkeeping.expense_revisions'::regclass AND contype = 'c'");
  console.log(JSON.stringify({ environment: 'dev', ...before, columns: await columns(), constraints }));
  if (mode === 'apply') {
    const file = fileURLToPath(new URL('./bookkeeping-aws/005_conversion_source_rate.sql', import.meta.url));
    for (const statement of readFileSync(file, 'utf8').replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(Boolean)) {
      await sql.unsafe(statement);
    }
    const after = (await counts())[0];
    const actual = await columns();
    const source = actual.find(row => row.column_name === 'conversion_source');
    const rate = actual.find(row => row.column_name === 'conversion_rate');
    if (after.revisions !== before.revisions || after.expenses !== before.expenses || source?.data_type !== 'text' ||
      rate?.data_type !== 'numeric' || Number(rate.numeric_precision) !== 30 || Number(rate.numeric_scale) !== 18) {
      throw new Error('Conversion migration post-check failed; inspect the development cluster');
    }
    console.log(JSON.stringify({ applied: true, ...after, columns: actual }));
  }
} finally { await sql.end(); }
