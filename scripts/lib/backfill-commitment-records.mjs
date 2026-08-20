/**
 * Give every seeded commitment the installments and payments the money screens read.
 *
 * ⚠⚠ WHY A SEEDER NEEDS THIS AT ALL (Payables Rebuild P1, mig 255). Since P1, every coach-facing
 * money surface reads `rep_payable_installments` / `rep_payable_payments` — the payment schedule,
 * the register, Budget vs. Actual and its Months grid, the Overview's next-30 panel, the exports and
 * the season close-out pot. The APP writes those rows on every save (`reconcileCommitmentRecords` in
 * lib/db.ts), but the three fixture seeders insert `rep_team_expenses` directly with their own
 * Supabase client and never go through it. Without this call they produce commitments with no plan:
 *
 *   · the coach demo — a public shop window — would render every money screen empty;
 *   · the UAT fixture would lose the split-month payable `npm run check:money-report` REQUIRES, and
 *     that check would exit non-zero reading like a seeding problem rather than this;
 *   · the QA-day fixture is what the owner walks §64 Part A against, so the acceptance test for
 *     "the books did not move" would be run against books with nothing in them.
 *
 * ⚠ NOTHING IS DECIDED OR WRITTEN HERE. `lib/payable-legacy-sync.ts` does both, and `lib/db.ts` calls
 * the very same function — so this file is a QUERY and a call. It cannot drift from the app, which is
 * the whole point: a copy of either half would let the fixture the acceptance test runs against agree
 * with a bug.
 *
 * ⚠ THE CLIENT IS PASSED IN, and that is the reason this file exists rather than the seeders calling
 * `lib/db.ts` directly. That module closes over the service-role singleton, which reads `process.env`
 * at IMPORT time — and a seed script's static imports resolve before its own `dotenv.config()` runs.
 * (It also cannot be loaded by a plain `node` script at all: it uses TypeScript parameter properties,
 * which the runtime's strip-only mode refuses.)
 *
 * Idempotent. A seeder that runs twice, or repairs rows in place, converges rather than duplicating.
 */
import {
  syncCommitmentRecords, commitmentFromRow, COMMITMENT_SYNC_COLUMNS,
} from '../../lib/payable-legacy-sync.ts';

/**
 * @param db      a Supabase client with service-role rights.
 * @param filter  applied to the `rep_team_expenses` read — `{ programYearId }` or `{ teamId }`.
 * @returns how many installment and payment rows were written, for the seeder's own report.
 */
export async function backfillCommitmentRecords(db, filter) {
  let q = db.from('rep_team_expenses').select(COMMITMENT_SYNC_COLUMNS);
  if (filter?.programYearId) q = q.eq('program_year_id', filter.programYearId);
  if (filter?.teamId) q = q.eq('team_id', filter.teamId);
  const { data, error } = await q;
  if (error) throw new Error(`rep_team_expenses: ${error.message}`);
  return syncCommitmentRecords(db, (data ?? []).map(commitmentFromRow));
}
