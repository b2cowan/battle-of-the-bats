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
      // GST/HST Stage 4a: a revision and its tax lines are written in one DML-only transaction, as the app does.
      const rows = await tx`INSERT INTO bookkeeping.expense_revisions (
        expense_id, revision, expense_date, supplier, category, business_purpose,
        original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
        business_use_percent, payment_source, created_by,
        tax_answer, supplier_tax_number, supplier_registration, purchase_kind, number_unobtainable
      ) VALUES (
        ${expenseId}::uuid, 1, '2026-10-23'::date, 'Synthetic probe', 'Testing',
        'Rollback-only schema check', 'CAD', 113, 113, 13, 'pending', 100, 'personal',
        ${randomUUID()}::uuid,
        'shown', NULL, 'not_checked', 'operating', false
      ) RETURNING expense_id, revision, cad_cents, tax_answer`;
      if (rows.length !== 1 || rows[0].revision !== 1 || Number(rows[0].cad_cents) !== 113 || rows[0].tax_answer !== 'shown') {
        throw new Error('Expense insert did not return the expected revision');
      }
      await tx`INSERT INTO bookkeeping.expense_tax_lines (expense_id, revision, line_no, tax_type, cents)
        VALUES (${expenseId}::uuid, 1, 1, 'gst5', 5), (${expenseId}::uuid, 1, 2, 'pst', 8)`;
      const lines = await tx`SELECT sum(cents)::int AS cents, count(*)::int AS count FROM bookkeeping.expense_tax_lines
        WHERE expense_id = ${expenseId}::uuid AND revision = 1`;
      if (lines[0].count !== 2 || lines[0].cents !== 13) throw new Error('Tax lines did not read back inside the transaction');
      const registration = await tx`SELECT effective_date FROM bookkeeping.gst_registration_revisions ORDER BY revision DESC LIMIT 1`;
      if (registration.length !== 1) throw new Error('No GST/HST registration date is on record');
      throw new ProbeRollback();
    });
  } catch (error) {
    if (!(error instanceof ProbeRollback)) throw error;
  }
  const remaining = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_revisions
    WHERE expense_id = ${expenseId}::uuid`;
  if (remaining[0].count !== 0) throw new Error('Rollback left the synthetic expense behind');
  const remainingLines = await sql`SELECT count(*)::int AS count FROM bookkeeping.expense_tax_lines
    WHERE expense_id = ${expenseId}::uuid`;
  if (remainingLines[0].count !== 0) throw new Error('Rollback left the synthetic tax lines behind');
  console.log('Development DSQL insert (revision + tax lines) and rollback passed');
} finally {
  await sql.end();
}
