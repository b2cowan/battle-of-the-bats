/** Client-safe contracts for the existing billing reads and windows. */
import type { Organization, OrgPlan } from './types';
import type { EndingSection } from './online-payment-endings';
import type { CustomerFreeTime } from './free-time';
import type { PortalCustomerFreeTime } from './portal-free-time';
import type { WaitingMoveView } from './plan-ending';

export type BillingUsage = {
  teams: { count: number; limit: number };
  tournament_slots: { count: number; limit: number };
  staff_seats: { count: number; limit: number };
  officials: number;
};
export type BillingRead<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };
export type BillingTournament = { id: string; name: string; status: string; year: number | null; startDate: string | null; endDate: string | null;
  /** When it was made (the downgrade review's slot holders): the Change window's "added {date}" (Stage 2 Part B). */
  createdAt?: string };
export type BillingCancellation = {
  currentPlan: OrgPlan; activeTournamentCount: number; tournaments: BillingTournament[]; retentionDays: number;
  shutsDown: string[]; shortShutsDown: string[]; activeTeams: number | null;
  cancelled: { at: string | null; keptUntil: string | null } | null; onlinePayments?: EndingSection | null;
  /** Plans end at the renewal date (Stage 1). Null while the account is cancelled (the reactivate card reads `cancelled`). */
  ending?: BillingEnding | null;
};
export type BillingEnding = {
  /** A real Stripe subscription: a cancel waits for its date. False: no paid period to wait for, so it ends at the click. */
  waits: boolean;
  /** The date a cancel made now would end on (the renewal, or the trial's end) — the window's preview; Stripe's is recorded. */
  endsOn: string | null;
  /** The cancel already waiting: the page's "Ends on" line and Keep {Plan}. `heldMovePlan` is a cheaper move it set aside (G1). */
  pending: ({ endsAt: string; heldMovePlan: OrgPlan | null } & (
    /** Which change waits (Stage 2): a cancel ends the plan on the date; a downgrade MOVES it to the free plan then, and
     *  carries what the date would do now — the band's kept and archived tournaments (G2). */
    | { kind: 'cancellation'; move: null }
    | { kind: 'downgrade'; move: WaitingMoveView }
  )) | null;
};
export type BillingDowngrade = {
  currentPlan: OrgPlan; targetPlan: OrgPlan; targetPlanLabel: string; targetTournamentLimit: number;
  activeTournamentCount: number; allowedKeepCount: number; requiresTournamentChoice: boolean;
  tournaments: BillingTournament[]; overLimitTournamentCount: number; retentionDays: number; onlinePayments?: EndingSection | null;
  /** Stage 2 Part B: a paying subscription's move waits for `movesOn` (the renewal, or the trial's end); with no live paid
   *  period (`waits` false) it happens at the click. `movesOn` null while waiting = the date is missing (said, no confirm). */
  when?: { waits: boolean; movesOn: string | null } | null;
};
export type BillingFreeTime = {
  freeTime: CustomerFreeTime | null; overLimitAfter: boolean; foundingThrough: string | null; portal: PortalCustomerFreeTime | null;
};
export type BillingFounding = {
  isFoundingSeason: boolean; compUntil: string | null;
  card?: { savedAt: string; brand: string | null; last4: string | null } | null;
  nextSeason?: { planKey: string; billingCycle: string; chosenAt: string | null } | null;
};
export type BillingMove = { live: boolean; scheduledMove: { toPlan: OrgPlan; effectiveAt: string | null } | null };
export type BillingSnapshot = {
  org: Organization; /** Owner-only (2026-10-29): the page renders the locked card for anyone else. */ canManageBilling: boolean;
  usage: BillingRead<BillingUsage>; freeTime: BillingRead<BillingFreeTime>;
  founding: BillingRead<BillingFounding>; gating: BillingRead<Partial<Record<OrgPlan, boolean>>>;
  cancellation: BillingRead<BillingCancellation>; move: BillingRead<BillingMove>;
};
