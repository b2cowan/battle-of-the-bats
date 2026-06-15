/**
 * Mark-paid fee resolution + paid-in-full stamp (J5-026).
 *
 * The bug this fixes: an organizer marking a registration paid via the single-row toggle
 * (`/api/admin/teams`) or the game-day check-in gate (`/api/admin/check-in`) wrote ONLY the raw
 * `payment_status` column — not `total_paid`/`deposit_paid`. The organizer's badge reads the raw
 * column and showed "Paid", but the coach portal's resolver honors `payment_status='paid'` only
 * when no fee schedule exists; with a schedule, "paid" requires `total_paid >= total_fee`. So the
 * coach still saw "OWED · $X due". Only the BULK "Mark Paid in Full" path stamped the amounts.
 *
 * This centralizes the bulk path's logic (registrations/bulk/route.ts `mark_paid`) so the two thin
 * write paths stamp the same paid-in-full amounts and "Paid" means $0 owed on every surface.
 */

/** Minimal team shape needed to compute the paid stamp. */
export interface MarkPaidTeam {
  division_id: string | null;
  deposit_paid: number | string | null;
  total_paid: number | string | null;
}

/** Tournament-level fee fields. */
export interface MarkPaidTournament {
  fee_schedule_mode: string | null;
  deposit_amount: number | string | null;
  total_fee_amount: number | string | null;
}

/** Division-level fee override fields (when `fee_schedule_mode === 'division'`). */
export interface MarkPaidDivisionFee {
  deposit_amount: number | string | null;
  total_fee_amount: number | string | null;
}

export interface EffectiveFee {
  depositAmount: number | null;
  totalFeeAmount: number | null;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The fee that applies to a team — the division override in division mode, else the tournament fee.
 * Mirrors the duplicated local `effectiveFee` in the bulk/export/summary/payment-reminders routes.
 */
export function effectiveFee(
  team: MarkPaidTeam,
  tournament: MarkPaidTournament,
  division: MarkPaidDivisionFee | null | undefined,
): EffectiveFee {
  if (tournament.fee_schedule_mode === 'division' && division?.total_fee_amount != null) {
    return { depositAmount: num(division.deposit_amount), totalFeeAmount: num(division.total_fee_amount) };
  }
  return { depositAmount: num(tournament.deposit_amount), totalFeeAmount: num(tournament.total_fee_amount) };
}

/**
 * The DB column patch for "mark this team paid in full" — the SAME shape the bulk `mark_paid`
 * action writes (registrations/bulk/route.ts). `Math.max` so an already-recorded larger amount is
 * never lowered. When the team has no fee schedule (both amounts null) it just sets
 * `payment_status='paid'` (the resolver treats that as paid with no schedule).
 */
export function markPaidInFullPatch(team: MarkPaidTeam, fee: EffectiveFee): {
  payment_status: 'paid';
  deposit_paid?: number;
  total_paid?: number;
} {
  const patch: { payment_status: 'paid'; deposit_paid?: number; total_paid?: number } = { payment_status: 'paid' };
  if (fee.depositAmount != null) patch.deposit_paid = Math.max(num(team.deposit_paid) ?? 0, fee.depositAmount);
  if (fee.totalFeeAmount != null) patch.total_paid = Math.max(num(team.total_paid) ?? 0, fee.totalFeeAmount);
  return patch;
}
