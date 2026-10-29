/** Client-safe contracts for the existing billing reads and windows. */
import type { Organization, OrgPlan } from './types';
import type { EndingSection } from './online-payment-endings';
import type { CustomerFreeTime } from './free-time';
import type { PortalCustomerFreeTime } from './portal-free-time';

export type BillingUsage = {
  teams: { count: number; limit: number };
  tournament_slots: { count: number; limit: number };
  staff_seats: { count: number; limit: number };
  officials: number;
};
export type BillingRead<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };
export type BillingTournament = { id: string; name: string; status: string; year: number | null; startDate: string | null; endDate: string | null };
export type BillingCancellation = {
  currentPlan: OrgPlan; activeTournamentCount: number; tournaments: BillingTournament[]; retentionDays: number;
  shutsDown: string[]; shortShutsDown: string[]; activeTeams: number | null;
  cancelled: { at: string | null; keptUntil: string | null } | null; onlinePayments?: EndingSection | null;
};
export type BillingDowngrade = {
  currentPlan: OrgPlan; targetPlan: OrgPlan; targetPlanLabel: string; targetTournamentLimit: number;
  activeTournamentCount: number; allowedKeepCount: number; requiresTournamentChoice: boolean;
  tournaments: BillingTournament[]; overLimitTournamentCount: number; retentionDays: number; onlinePayments?: EndingSection | null;
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
  org: Organization; canManageBilling: boolean; usage: BillingRead<BillingUsage>; freeTime: BillingRead<BillingFreeTime>;
  founding: BillingRead<BillingFounding>; gating: BillingRead<Partial<Record<OrgPlan, boolean>>>;
  cancellation: BillingRead<BillingCancellation>; move: BillingRead<BillingMove>;
};
