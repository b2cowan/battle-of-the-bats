/**
 * Insert a commitment WITH the installments and payments the money screens read — the seeders'
 * write door since Payables Rebuild P2.
 *
 * ⚠⚠ THE BRIDGE IS GONE, AND THIS IS ITS SUCCESSOR IN THE ONLY DIRECTION THAT SURVIVES. P1's
 * `backfill-commitment-records.mjs` DERIVED the plan and the payments from the legacy
 * deposit/balance columns after the fact; once `Record a payment` made `rep_payable_payments` the
 * source of truth, a deriver pointed that way would overwrite real payments with whatever stale
 * columns said (the P2 build prompt's single most dangerous thing). So a seeder now STATES its
 * plan and its payments explicitly, and nothing writes the legacy schedule/paid columns at all.
 *
 * ⚠ EVERY FIXTURE COMMITMENT COMES THROUGH HERE (R1). An expense row inserted bare has no
 * installment, which makes it invisible to the payment schedule, Budget vs. Actual, the register
 * and the Overview's next-30 panel — the demo would render empty money screens, and
 * `check:money-report` would report the UAT fixture as lacking the split-month shape it REQUIRES.
 *
 * ⚠ `amount` IS DERIVED (R2): the row's total is the sum of the installments, typed nowhere.
 *
 * @param db  a Supabase client with service-role rights (passed in — the seeders' own client;
 *            lib/db.ts closes over a singleton their dotenv timing cannot use).
 * @param opts.row           the `rep_team_expenses` columns MINUS amount and the legacy
 *                           schedule/paid columns (org_id, team_id, program_year_id,
 *                           expense_type, description, category, …).
 * @param opts.installments  1..n pieces `{ amount, dueDate }`, in order.
 * @param opts.payments      0..n payments `{ amount, paidDate, installmentNumber?, method?,
 *                           note?, accountingEntryId? }`. `installmentNumber` records which piece
 *                           it was for (the demo re-anchor matches on it); omit for untargeted.
 * @returns the new expense row's id.
 */
/**
 * The commonest fixture shape, named once: one piece, settled in full the day it was due.
 * Spread into `insertCommitmentWithRecords`: `{ row, ...paidOnce(240, day) }`.
 */
export function paidOnce(amount, day) {
  return {
    installments: [{ amount, dueDate: day }],
    payments: [{ amount, paidDate: day, installmentNumber: 1 }],
  };
}

export async function insertCommitmentWithRecords(db, { row, installments, payments = [] }) {
  if (!installments?.length) {
    throw new Error(`insertCommitmentWithRecords: "${row?.description}" needs at least one installment (R1)`);
  }
  const amount = installments.reduce((s, i) => s + Math.round(i.amount * 100), 0) / 100;
  const { data, error } = await db.from('rep_team_expenses')
    .insert({ ...row, amount })
    .select('id, org_id, team_id, program_year_id')
    .single();
  if (error) throw new Error(`rep_team_expenses: ${error.message}`);

  const base = {
    expense_id: data.id,
    org_id: data.org_id,
    team_id: data.team_id,
    program_year_id: data.program_year_id,
  };
  const { data: instRows, error: instError } = await db.from('rep_payable_installments')
    .insert(installments.map((p, at) => ({
      ...base,
      installment_number: at + 1,
      amount: p.amount,
      due_date: p.dueDate,
      source: 'manual',
    })))
    .select('id, installment_number');
  if (instError) throw new Error(`rep_payable_installments: ${instError.message}`);
  const idByNumber = new Map((instRows ?? []).map(r => [r.installment_number, r.id]));

  if (payments.length) {
    const { error: payError } = await db.from('rep_payable_payments')
      .insert(payments.map(p => ({
        ...base,
        installment_id: p.installmentNumber ? (idByNumber.get(p.installmentNumber) ?? null) : null,
        amount: p.amount,
        paid_date: p.paidDate,
        method: p.method ?? null,
        note: p.note ?? null,
        // ⚠ NULL is the honest value for a seeded payment with no ledger entry behind it — the
        // same state a pre-mig-236 record is in, which every reverse path already handles.
        accounting_entry_id: p.accountingEntryId ?? null,
        source: 'manual',
      })));
    if (payError) throw new Error(`rep_payable_payments: ${payError.message}`);
  }
  return data.id;
}
