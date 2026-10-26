import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';

const DEV_HOST = 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws';
const mode = process.argv[2] ?? 'inspect';
if (!['inspect', 'apply'].includes(mode)) throw new Error('Usage: node --env-file=.env.local scripts/bookkeeping-dsql-owner-movement-migration.mjs <inspect|apply>');
if (process.env.BOOKKEEPING_DSQL_ENDPOINT !== DEV_HOST || process.env.BOOKKEEPING_DSQL_USERNAME !== 'admin') {
  throw new Error('This script is restricted to the local development bookkeeping database');
}
const sql = auroraDSQLPostgres({ host: DEV_HOST, username: 'admin', max: 1, ssl: { rejectUnauthorized: true } });
try {
  const expenses = await sql.unsafe('SELECT COUNT(*)::int AS revisions FROM bookkeeping.expense_revisions');
  const table = await sql.unsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'bookkeeping' AND table_name = 'owner_movement_revisions'");
  const before = table.length ? await sql.unsafe('SELECT COUNT(*)::int AS revisions FROM bookkeeping.owner_movement_revisions') : [{ revisions: 0 }];
  console.log(JSON.stringify({ environment: 'dev', expense_revisions: expenses[0].revisions, owner_movement_table: table.length === 1, owner_movement_revisions: before[0].revisions }));
  if (mode === 'apply') {
    const path = fileURLToPath(new URL('./bookkeeping-aws/004_owner_movements.sql', import.meta.url));
    const statements = readFileSync(path, 'utf8').replace(/^--.*$/gm, '').split(';').map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
    const migratedTable = await sql.unsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'bookkeeping' AND table_name = 'owner_movement_revisions'");
    const afterExpenses = await sql.unsafe('SELECT COUNT(*)::int AS revisions FROM bookkeeping.expense_revisions');
    const after = await sql.unsafe('SELECT COUNT(*)::int AS revisions FROM bookkeeping.owner_movement_revisions');
    if (migratedTable.length !== 1 || afterExpenses[0].revisions !== expenses[0].revisions || after[0].revisions !== before[0].revisions) {
      throw new Error('Owner movement migration post-check failed; inspect the development cluster');
    }
    console.log(JSON.stringify({ applied: true, expense_revisions: afterExpenses[0].revisions, owner_movement_revisions: after[0].revisions }));
  }
} finally {
  await sql.end();
}
