/**
 * Writing what `lib/payable-legacy-plan.ts` decided — the I/O half, in ONE place.
 *
 * ⚠⚠ WHY THIS IS ITS OWN MODULE, AND THE MISTAKE IT CORRECTS (`/simplify`, 2026-08-19 — flagged
 * independently by the simplification and altitude lenses). The plan module owns the DECISION and is
 * pure, which was right. But the surrounding I/O was then written out **twice** — once in `lib/db.ts`
 * for the app, once in `scripts/lib/backfill-commitment-records.mjs` for the three fixture seeders —
 * selecting the same columns, grouping the same way, issuing the same inserts in the same order,
 * including a four-line patch builder copied verbatim. `payable-legacy-plan.ts`'s own header argues
 * that a second copy of the RULE would let the QA fixture agree with a bug; the same argument applies
 * to the write shape, only more quietly, because a drift there shows up as a column that silently
 * stops being written on one path.
 *
 * ⚠ THE SEAM IS THE CLIENT, and it has to be a parameter rather than an import. `lib/db.ts` closes
 * over the service-role singleton in `lib/supabase-admin.ts`, which reads `process.env` at IMPORT
 * time — and a seed script's static imports resolve before its own `dotenv.config()` runs, so a
 * script importing that singleton would get placeholder credentials. (`lib/db.ts` cannot be loaded by
 * a plain `node` script at all: it uses TypeScript parameter properties, which the runtime's
 * strip-only mode refuses.) Taking the client as an argument is what lets both callers share this.
 *
 * ⚠ DELETE THIS WITH P2, alongside `lib/payable-legacy-plan.ts`. Once `Record a payment` writes these
 * tables directly they are the source of truth, and a one-way copier pointed the wrong way would
 * overwrite real records.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
/* ⚠ THE `.ts` EXTENSION IS LOAD-BEARING, and it is the one thing about this file that will look
   wrong to a reader used to the rest of `lib/`. The three fixture seeders are plain `node` scripts
   with no bundler, so an extensionless relative import here fails to resolve for them at runtime —
   which is exactly how the first draft of this module broke the seeders while typechecking clean.
   `lib/demo-coach-reconcile-core.ts` writes its imports the same way, for the same reason. */
import {
  legacyInstallmentPlan, legacyPayments, planInstallmentWrites, planPaymentWrites,
  type LegacyCommitmentRow, type StoredInstallment, type StoredPayment,
} from './payable-legacy-plan.ts';

/**
 * What the two tables need beside the rule's own inputs — the tenancy columns every `rep_*` money
 * table carries, plus the two fields a new payment row copies off its commitment.
 */
export interface CommitmentIdentity {
  id: string;
  orgId: string;
  teamId: string;
  programYearId: string;
  paymentMethod: string | null;
  createdBy: string | null;
}

export type SyncableCommitment = CommitmentIdentity & LegacyCommitmentRow;

/** PostgREST hands `numeric` back as a string; every comparison downstream is on numbers. */
const num = (v: unknown): number => Number(v ?? 0);

/**
 * A `rep_team_expenses` row as it comes off the wire → what the rule reads.
 *
 * ⚠ THE ONE snake_case→camelCase MAPPING FOR THIS PURPOSE. `mapRepTeamExpense` in `lib/db.ts` does
 * the same translation for the full domain type, but it is not exported and `lib/db.ts` is not
 * loadable from a script — so before this existed the seeder hand-wrote its own twelve-field copy,
 * which a column rename would have broken on one path only, silently.
 */
export function commitmentFromRow(r: Record<string, any>): SyncableCommitment {
  return {
    id:              r.id,
    orgId:           r.org_id,
    teamId:          r.team_id,
    programYearId:   r.program_year_id,
    paymentMethod:   r.payment_method ?? null,
    createdBy:       r.created_by ?? null,
    expenseType:     r.expense_type,
    amount:          num(r.amount),
    expensePaidAt:   r.expense_paid_at ?? null,
    depositAmount:   r.deposit_amount == null ? null : num(r.deposit_amount),
    depositDueDate:  r.deposit_due_date ?? null,
    depositPaidAt:   r.deposit_paid_at ?? null,
    balanceAmount:   r.balance_amount == null ? null : num(r.balance_amount),
    balanceDueDate:  r.balance_due_date ?? null,
    balancePaidAt:   r.balance_paid_at ?? null,
    accountingEntryId: r.accounting_entry_id ?? null,
    depositEntryId:  r.deposit_entry_id ?? null,
    balanceEntryId:  r.balance_entry_id ?? null,
    createdAt:       r.created_at,
  };
}

/** The columns `commitmentFromRow` reads — so a caller's `.select()` and this cannot drift apart. */
export const COMMITMENT_SYNC_COLUMNS =
  'id, org_id, team_id, program_year_id, expense_type, amount, payment_method, created_by, created_at,'
  + ' expense_paid_at, deposit_amount, deposit_due_date, deposit_paid_at,'
  + ' balance_amount, balance_due_date, balance_paid_at,'
  + ' accounting_entry_id, deposit_entry_id, balance_entry_id';

/**
 * Make each commitment's installments and payments say what its legacy columns say.
 *
 * Idempotent: a commitment whose plan and payments already agree costs two reads and no writes. It
 * writes **no accounting entry** and CARRIES the one each settled half already created, which is what
 * makes "the books do not move" true.
 *
 * @returns how many rows were written, for a seeder's own report.
 */
export async function syncCommitmentRecords(
  db: SupabaseClient,
  commitments: readonly SyncableCommitment[],
): Promise<number> {
  if (commitments.length === 0) return 0;
  const ids = commitments.map(c => c.id);

  const [instRes, payRes] = await Promise.all([
    db.from('rep_payable_installments')
      .select('id, expense_id, installment_number, amount, due_date').in('expense_id', ids),
    db.from('rep_payable_payments')
      .select('id, expense_id, installment_id, amount, paid_date, accounting_entry_id').in('expense_id', ids),
  ]);
  if (instRes.error) throw new Error(`rep_payable_installments: ${instRes.error.message}`);
  if (payRes.error) throw new Error(`rep_payable_payments: ${payRes.error.message}`);

  function groupBy<T>(rows: Array<Record<string, any>> | null, shape: (r: Record<string, any>) => T) {
    const out = new Map<string, T[]>();
    for (const r of rows ?? []) {
      const list = out.get(r.expense_id);
      if (list) list.push(shape(r)); else out.set(r.expense_id, [shape(r)]);
    }
    return out;
  }
  const instByExpense = groupBy<StoredInstallment>(instRes.data, r => ({
    id: r.id, installmentNumber: r.installment_number, amount: num(r.amount), dueDate: r.due_date,
  }));
  const payByExpense = groupBy<StoredPayment>(payRes.data, r => ({
    id: r.id, installmentId: r.installment_id ?? null, amount: num(r.amount),
    paidDate: r.paid_date, accountingEntryId: r.accounting_entry_id ?? null,
  }));

  let written = 0;
  for (const c of commitments) {
    const plan = legacyInstallmentPlan(c);
    const wanted = legacyPayments(c, plan);
    const stored = instByExpense.get(c.id) ?? [];
    const storedPayments = payByExpense.get(c.id) ?? [];
    const idByNumber = new Map(stored.map(i => [i.installmentNumber, i.id]));

    // ── The plan ────────────────────────────────────────────────────────────
    const instWrites = planInstallmentWrites(
      plan, stored, id => storedPayments.some(p => p.installmentId === id));

    if (instWrites.insert.length > 0) {
      /* ⚠ UPSERT, NOT INSERT, ON `(expense_id, installment_number)` (`/review`, concurrency lens,
         2026-08-19). This function reads what exists and then writes, with no transaction around
         the pair — so two near-simultaneous saves on one commitment (a double-clicked Save, two
         open tabs) can both observe "piece 2 does not exist yet" and both try to create it. A plain
         insert makes the loser hit the UNIQUE constraint and throw, which used to abort the whole
         save. The row they are racing to write is IDENTICAL — both derive it from the same legacy
         columns — so letting the second one land on top is not a merge conflict, it is the same
         answer arriving twice. */
      const { data, error } = await db.from('rep_payable_installments').upsert(
        instWrites.insert.map(p => ({
          expense_id:         c.id,
          org_id:             c.orgId,
          team_id:            c.teamId,
          program_year_id:    c.programYearId,
          installment_number: p.installmentNumber,
          amount:             p.amount,
          due_date:           p.dueDate,
          source:             'legacy_columns',
        })), { onConflict: 'expense_id,installment_number' }).select('id, installment_number');
      if (error) throw new Error(`rep_payable_installments: ${error.message}`);
      for (const r of data ?? []) idByNumber.set(r.installment_number, r.id);
      written += instWrites.insert.length;
    }
    for (const u of instWrites.update) {
      const { error } = await db.from('rep_payable_installments')
        .update({ amount: u.amount, due_date: u.dueDate, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (error) throw new Error(`rep_payable_installments: ${error.message}`);
      written++;
    }
    if (instWrites.deleteIds.length > 0) {
      const { error } = await db.from('rep_payable_installments')
        .delete().in('id', instWrites.deleteIds);
      if (error) throw new Error(`rep_payable_installments: ${error.message}`);
      written += instWrites.deleteIds.length;
    }

    // ── What actually happened ──────────────────────────────────────────────
    const payWrites = planPaymentWrites(wanted, storedPayments, idByNumber);
    for (const u of payWrites.update) {
      const patch: Record<string, unknown> = {};
      if (u.patch.amount !== undefined) patch.amount = u.patch.amount;
      if (u.patch.paidDate !== undefined) patch.paid_date = u.patch.paidDate;
      if (u.patch.installmentId !== undefined) patch.installment_id = u.patch.installmentId;
      if (u.patch.accountingEntryId !== undefined) patch.accounting_entry_id = u.patch.accountingEntryId;
      const { error } = await db.from('rep_payable_payments').update(patch).eq('id', u.id);
      if (error) throw new Error(`rep_payable_payments: ${error.message}`);
      written++;
    }
    if (payWrites.insert.length > 0) {
      const { error } = await db.from('rep_payable_payments').insert(
        payWrites.insert.map(want => ({
          expense_id:          c.id,
          org_id:              c.orgId,
          team_id:             c.teamId,
          program_year_id:     c.programYearId,
          installment_id:      want.installmentId,
          amount:              want.amount,
          paid_date:           want.paidDate,
          method:              c.paymentMethod,
          accounting_entry_id: want.accountingEntryId,
          source:              `legacy_${want.half}`,
          created_by:          c.createdBy,
        })));
      if (error) throw new Error(`rep_payable_payments: ${error.message}`);
      written += payWrites.insert.length;
    }
  }
  return written;
}
