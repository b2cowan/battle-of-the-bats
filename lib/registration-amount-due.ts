/**
 * WHAT A TOURNAMENT REGISTRATION STILL OWES — the one reading the payment reminder sends by, and the one a free coach's
 * reminder notification clears by (Needs attention clears itself, 2026-10-16: "Paid in full" — part-payment keeps it).
 * Lifted out of the payment-reminders route so the two cannot drift. Pure: no server imports.
 */

export interface DueTeam { division_id: string; deposit_paid: number | null; total_paid: number | null }

export interface DueTournament {
  fee_schedule_mode: string | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
}

export type DueDivision = Omit<DueTournament, 'fee_schedule_mode'>;

export type FeeDetails = {
  depositAmount: number | null;
  depositDueDate: string | null;
  totalFeeAmount: number | null;
  totalFeeDueDate: string | null;
};

/** The fee a registration answers to: its division's when the tournament prices by division, else the tournament's. */
export function registrationFee(team: DueTeam, tournament: DueTournament, divisions: Map<string, DueDivision>): FeeDetails {
  const group = divisions.get(team.division_id);
  if (tournament.fee_schedule_mode === 'division' && group?.total_fee_amount != null) {
    return {
      depositAmount: group.deposit_amount ?? null,
      depositDueDate: group.deposit_due_date ?? null,
      totalFeeAmount: group.total_fee_amount ?? null,
      totalFeeDueDate: group.total_fee_due_date ?? null,
    };
  }

  return {
    depositAmount: tournament.deposit_amount ?? null,
    depositDueDate: tournament.deposit_due_date ?? null,
    totalFeeAmount: tournament.total_fee_amount ?? null,
    totalFeeDueDate: tournament.total_fee_due_date ?? null,
  };
}

/** What is due next — the deposit until it is paid, then the rest — or null once the whole fee is paid (or none is set). */
export function registrationAmountDue(team: DueTeam, fee: FeeDetails): { amount: number; dueDate: string | null } | null {
  const depositPaid = Number(team.deposit_paid ?? 0);
  const totalPaid = Number(team.total_paid ?? 0);

  if (!fee.totalFeeAmount || totalPaid >= Number(fee.totalFeeAmount)) return null;

  if (fee.depositAmount && depositPaid < Number(fee.depositAmount)) {
    return {
      amount: Math.max(Number(fee.depositAmount) - depositPaid, 0),
      dueDate: fee.depositDueDate,
    };
  }

  return {
    amount: Math.max(Number(fee.totalFeeAmount) - totalPaid, 0),
    dueDate: fee.totalFeeDueDate,
  };
}
