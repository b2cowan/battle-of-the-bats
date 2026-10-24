import { randomUUID } from 'node:crypto';
import { auroraDSQLPostgres } from '@aws/aurora-dsql-postgresjs-connector';

const host = process.env.BOOKKEEPING_DSQL_ENDPOINT;
if (host !== 'wbufvbnlahjfagmjgrheg4ee5q.dsql.us-east-2.on.aws') {
  throw new Error('This rollback-only probe is restricted to the development cluster');
}

class ProbeRollback extends Error {}
const sql = auroraDSQLPostgres({ host, username: 'admin', max: 1,
  ssl: { rejectUnauthorized: true } });
const expenseId = randomUUID();
try {
  try {
    await sql.begin(async tx => {
      const rows = await tx`INSERT INTO bookkeeping.expense_revisions (
        expense_id, revision, expense_date, supplier, category, business_purpose,
        original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
        business_use_percent, payment_source, created_by
      ) VALUES (
        ${expenseId}::uuid, 1, '2026-10-23'::date, 'Synthetic probe', 'Testing',
        'Rollback-only schema check', 'CAD', 101, 101, 0, 'none', 100, 'personal',
        ${randomUUID()}::uuid
      ) RETURNING expense_id, revision, cad_cents`;
      if (rows.length !== 1 || rows[0].revision !== 1 || Number(rows[0].cad_cents) !== 101) {
        throw new Error('Expense insert did not return the expected revision');
      }
      throw new ProbeRollback();
    });
  } catch (error) {
    if (!(error instanceof ProbeRollback)) throw error;
  }
  const remaining = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_revisions
    WHERE expense_id = ${expenseId}::uuid`;
  if (remaining[0].count !== 0) throw new Error('Rollback left the synthetic expense behind');
  console.log('Development DSQL insert and rollback passed');
} finally {
  await sql.end();
}
