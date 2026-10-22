/**
 * Fee resolution for a team (J5-026; the paid-in-full STAMP retired with mig 345).
 *
 * "Mark paid" used to write `payment_status`, `total_paid` and `deposit_paid` from here so the coach portal's resolver
 * (with a fee schedule, "paid" needs `total_paid >= total_fee`) agreed with the organizer's badge. A mark is now a RECORDED
 * payment, written by the database (`lib/team-payments-server.ts` `payTeamDue`), which keeps the figures as the sum of the
 * team's payments. What stays here is the fee that applies to a team, read by the check-in board's "owes".
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
