/**
 * lib/coach-status-model.ts
 *
 * Builds the read-only payment / check-in / roster status a coach sees on their
 * tournament record (Phase 5b). The fee + payment computation REUSES the canonical
 * organizer-side resolver in lib/registration-attention.ts, so the coach always
 * sees the same answer the organizer's gate / registrations view computes — no fork.
 *
 * No payment is ever collected here (manual fee tracking only): the coach is shown
 * where they stand and told to contact the organizer.
 */
import {
  getRegistrationAttentionFee,
  computeRegistrationAttentionPaymentStatus,
  type RegistrationPaymentStatus,
} from './registration-attention';

export type CoachTournamentStatusInput = {
  team: {
    divisionId: string | null;
    paymentStatus: string | null;
    depositPaid: number | null;
    totalPaid: number | null;
    checkInStatus: string | null;
    checkedInAt: string | null;
    rosterSubmittedAt: string | null;
    rosterConfirmedAt: string | null;
    paymentCollectedAt: string | null;
  };
  tournament: {
    feeMode: string | null;
    depositAmount: number | null;
    depositDueDate: string | null;
    totalFeeAmount: number | null;
    totalFeeDueDate: string | null;
  } | null;
  division: {
    id: string;
    name: string;
    depositAmount: number | null;
    depositDueDate: string | null;
    totalFeeAmount: number | null;
    totalFeeDueDate: string | null;
  } | null;
  /** ISO date (YYYY-MM-DD); defaults to today. */
  today?: string;
};

export type CoachCheckInState = 'not_arrived' | 'checked_in' | 'no_show';
export type CoachRosterState = 'none' | 'submitted' | 'confirmed';

export type CoachTournamentStatus = {
  fee: {
    state: RegistrationPaymentStatus;
    isPaid: boolean;
    hasSchedule: boolean;
    /** Remaining amount owed (deposit-phase or balance), mirroring the organizer's getPaymentDue. */
    amountDue: number | null;
    /** Due date for `amountDue` (deposit due date in the deposit phase, else the total due date). */
    dueDate: string | null;
    collectedAt: string | null;
  };
  checkIn: {
    state: CoachCheckInState;
    checkedInAt: string | null;
  };
  roster: {
    state: CoachRosterState;
    submittedAt: string | null;
    confirmedAt: string | null;
  };
};

function coerceCheckInState(value: string | null): CoachCheckInState {
  return value === 'checked_in' || value === 'no_show' ? value : 'not_arrived';
}

/** PostgREST returns numeric columns as strings — coerce to a finite number (0 fallback). */
function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildCoachTournamentStatus(input: CoachTournamentStatusInput): CoachTournamentStatus {
  const today = input.today ?? new Date().toISOString().split('T')[0];

  // teams.payment_status is prod-NULLABLE with a column default of 'paid', so a
  // registration that was never touched must NOT read as Paid. Coerce anything that
  // isn't an explicit 'paid' to 'pending' (matches the gate's coercion, not lib/db's).
  // The fee math below drives the result whenever a fee schedule exists; this only
  // decides the no-fee-schedule branch.
  const paymentStatus = input.team.paymentStatus === 'paid' ? 'paid' : 'pending';

  const attentionTeam = {
    id: 'coach-view',
    divisionId: input.team.divisionId,
    status: 'accepted',
    paymentStatus,
    depositPaid: input.team.depositPaid,
    totalPaid: input.team.totalPaid,
  };

  const fee = getRegistrationAttentionFee(attentionTeam, {
    divisions: input.division ? [input.division] : [],
    feeMode: input.tournament?.feeMode ?? null,
    feeSchedule: input.tournament
      ? {
          depositAmount: input.tournament.depositAmount,
          depositDueDate: input.tournament.depositDueDate,
          totalFeeAmount: input.tournament.totalFeeAmount,
          totalFeeDueDate: input.tournament.totalFeeDueDate,
        }
      : {},
  });

  const state = computeRegistrationAttentionPaymentStatus(attentionTeam, fee, today);

  // PostgREST returns numeric columns as strings, so coerce before any math/truthiness:
  // - hasSchedule must agree with the resolver's `!Number(totalFee)` semantics, otherwise an
  //   explicit-$0 fee (totalFee = '0.00') would pass `Boolean('0.00') === true` and render
  //   "Owed · $0.00" while the organizer correctly shows no schedule.
  const totalFee = num(fee.totalFeeAmount);
  const depositAmount = num(fee.depositAmount);
  const totalPaid = num(input.team.totalPaid);
  const depositPaid = num(input.team.depositPaid);
  const hasSchedule = totalFee > 0;
  const isPaid = state === 'paid';

  // Remaining amount owed — mirrors the organizer's getPaymentDue (deposit phase vs balance)
  // so the coach sees the SAME number they do, not the gross fee. A deposit/partial-paid team
  // owes the outstanding balance, not the full total.
  let amountDue: number | null = null;
  let dueDate: string | null = null;
  if (hasSchedule && !isPaid && totalPaid < totalFee) {
    if (depositAmount > 0 && depositPaid < depositAmount) {
      amountDue = Math.max(depositAmount - depositPaid, 0);
      dueDate = fee.depositDueDate ?? null;
    } else {
      amountDue = Math.max(totalFee - totalPaid, 0);
      dueDate = fee.totalFeeDueDate ?? null;
    }
  }

  const rosterState: CoachRosterState = input.team.rosterConfirmedAt
    ? 'confirmed'
    : input.team.rosterSubmittedAt
      ? 'submitted'
      : 'none';

  return {
    fee: {
      state,
      isPaid,
      hasSchedule,
      amountDue,
      dueDate,
      collectedAt: input.team.paymentCollectedAt,
    },
    checkIn: {
      state: coerceCheckInState(input.team.checkInStatus),
      checkedInAt: input.team.checkedInAt,
    },
    roster: {
      state: rosterState,
      submittedAt: input.team.rosterSubmittedAt,
      confirmedAt: input.team.rosterConfirmedAt,
    },
  };
}
