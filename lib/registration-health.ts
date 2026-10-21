import type { RegistrationAttentionKey, RegistrationAttentionSummary } from './registration-attention';
import { daysBetweenDateStrings, tournamentToday } from './timezone';

/**
 * Calendar days from today to the tournament's start date, read in the organization's own time zone — the ONE reading for
 * the Teams page (a browser, any zone) and the dashboard's route (a server in UTC), so a viewer's clock never moves the score.
 * null when the tournament has no start date.
 */
export function registrationDaysUntilStart(startDate: string | null | undefined, now: Date = new Date()): number | null {
  return startDate ? daysBetweenDateStrings(tournamentToday(now), startDate.slice(0, 10)) : null;
}

export type RegistrationHealthTone = 'good' | 'warning' | 'danger' | 'neutral';

export type RegistrationHealthCapacityGap = {
  divisionId: string;
  divisionName: string;
  accepted: number;
  capacity: number;
  /** closed_under: registration is closed but the division never filled. soon_under: still
   *  open, but the tournament starts within days and spots remain — same organizer risk,
   *  different cause, so the panel can word them differently. */
  reason: 'closed_under' | 'soon_under';
};

export type RegistrationHealthIssue = {
  key: string;
  label: string;
  detail: string;
  tone: 'danger' | 'warning' | 'neutral';
  /** Present when clicking the issue should jump to that filtered attention bucket. */
  attentionKey?: RegistrationAttentionKey;
  /** Present when clicking the issue should switch to that division instead (capacity gaps). */
  capacityDivisionId?: string;
};

export type RegistrationHealthMetrics = {
  hasTeams: boolean;
  score: number;
  tone: RegistrationHealthTone;
  teamsTotal: number;
  accepted: number;
  pending: number;
  waitlist: number;
  missingEmail: number;
  unplaced: number;
  missingIntake: number;
  unpaid: number;
  pastDue: number;
  paymentsTracked: boolean;
  /** False for "Not tracked here": the event does not track payments, so the Payments figure is absent (not a
   *  plan lock) and nothing is scored against it. */
  eventTracksPayments: boolean;
  capacityGaps: RegistrationHealthCapacityGap[];
  issues: RegistrationHealthIssue[];
};

/** A division's fill against its capacity, across every division that HAS a capacity set. */
export type RegistrationHealthCapacity = {
  gaps: RegistrationHealthCapacityGap[];
  capacityTotal: number;
  capacityAccepted: number;
};

/**
 * The capacity half of Registration health — ONE function for the Teams page and the dashboard, so the score is one
 * number on both (the schedule's rule, owner 2026-10-19). A division is a gap when it never filled and either its
 * registration is closed or the tournament starts within three days.
 */
export function buildRegistrationCapacity(input: {
  divisions: Array<{ id: string; name: string; capacity?: number | null; isClosed?: boolean | null }>;
  acceptedByDivision: Map<string, number>;
  /** Calendar days until the tournament starts; null when it has no start date. */
  daysUntilStart: number | null;
}): RegistrationHealthCapacity {
  const gaps: RegistrationHealthCapacityGap[] = [];
  let capacityTotal = 0;
  let capacityAccepted = 0;
  for (const division of input.divisions) {
    if (division.capacity == null || division.capacity <= 0) continue;
    const accepted = input.acceptedByDivision.get(division.id) ?? 0;
    capacityTotal += division.capacity;
    capacityAccepted += accepted;
    if (accepted >= division.capacity) continue;
    if (division.isClosed) {
      gaps.push({ divisionId: division.id, divisionName: division.name, accepted, capacity: division.capacity, reason: 'closed_under' });
    } else if (input.daysUntilStart != null && input.daysUntilStart <= 3) {
      gaps.push({ divisionId: division.id, divisionName: division.name, accepted, capacity: division.capacity, reason: 'soon_under' });
    }
  }
  return { gaps, capacityTotal, capacityAccepted };
}

/** The team counts the score divides by: every registration but a rejected one, and the accepted ones among them. */
export function countRegistrationHealthTeams(
  teams: Array<{ status?: string | null; divisionId?: string | null }>,
): { teamsTotal: number; accepted: number; acceptedByDivision: Map<string, number> } {
  let teamsTotal = 0;
  let accepted = 0;
  const acceptedByDivision = new Map<string, number>();
  for (const team of teams) {
    if (!team.status || team.status === 'rejected') continue;
    teamsTotal++;
    if (team.status === 'accepted') {
      accepted++;
      if (team.divisionId) acceptedByDivision.set(team.divisionId, (acceptedByDivision.get(team.divisionId) ?? 0) + 1);
    }
  }
  return { teamsTotal, accepted, acceptedByDivision };
}

/** What a screen holds to wear Registration health: the metrics and the fill figures the window's Teams cell reads. */
export type RegistrationHealthView = {
  metrics: RegistrationHealthMetrics;
  capacityTotal: number;
  capacityAccepted: number;
};

function bucketCount(attention: RegistrationAttentionSummary, key: RegistrationAttentionKey): number {
  return attention.buckets.find(bucket => bucket.key === key)?.count ?? 0;
}

function ratio(count: number, denom: number): number {
  return denom > 0 ? count / denom : 0;
}

const TONE_RANK: Record<RegistrationHealthIssue['tone'], number> = { danger: 0, warning: 1, neutral: 2 };

/**
 * Registration Health score for the Registrations page — same "start at 100, subtract weighted
 * penalties" shape as lib/schedule-metrics.ts's healthScore, sized to registration-specific risk
 * instead of schedule risk. Deliberately does NOT penalize waitlist size (a full waitlist isn't a
 * problem to fix) or payment/intake signals on plans that don't track them (paymentsTracked=false
 * zeroes those inputs so a free-tier org is never scored against a Plus-only feature it can't use).
 */
export function buildRegistrationHealth(input: {
  attention: RegistrationAttentionSummary;
  teamsTotal: number;
  accepted: number;
  paymentsTracked: boolean;
  /** The event's own answer (lib/tournament-payments-tracked); absent = tracked. */
  eventTracksPayments?: boolean;
  capacityGaps: RegistrationHealthCapacityGap[];
}): RegistrationHealthMetrics {
  const { attention, teamsTotal, accepted, paymentsTracked, capacityGaps } = input;
  const eventTracksPayments = input.eventTracksPayments !== false;
  const paymentsScored = paymentsTracked && eventTracksPayments;

  const pending = bucketCount(attention, 'pending_review');
  const waitlist = bucketCount(attention, 'waitlist');
  const missingEmail = bucketCount(attention, 'missing_email');
  const unplaced = bucketCount(attention, 'unplaced');
  const missingIntake = paymentsTracked ? bucketCount(attention, 'missing_intake') : 0;
  const unpaid = paymentsScored ? bucketCount(attention, 'unpaid') : 0;
  const pastDue = paymentsScored ? bucketCount(attention, 'past_due') : 0;

  const hasTeams = teamsTotal > 0;

  const missingEmailPenalty = Math.min(25, Math.round(25 * ratio(missingEmail, teamsTotal)));
  const pendingPenalty = Math.min(10, Math.round(10 * ratio(pending, teamsTotal)));
  const unplacedPenalty = Math.min(20, Math.round(20 * ratio(unplaced, accepted)));
  const missingIntakePenalty = Math.min(15, Math.round(15 * ratio(missingIntake, teamsTotal)));
  const pastDuePenalty = Math.min(20, Math.round(20 * ratio(pastDue, accepted)));
  const unpaidPenalty = Math.min(10, Math.round(10 * ratio(unpaid, accepted)));
  const closedGap = capacityGaps.some(gap => gap.reason === 'closed_under');
  const soonGap = capacityGaps.some(gap => gap.reason === 'soon_under');
  const capacityPenalty = closedGap ? 10 : soonGap ? 5 : 0;

  const totalPenalty = missingEmailPenalty + pendingPenalty + unplacedPenalty
    + missingIntakePenalty + pastDuePenalty + unpaidPenalty + capacityPenalty;

  const score = hasTeams ? Math.max(0, Math.min(100, 100 - totalPenalty)) : 100;
  const tone: RegistrationHealthTone = !hasTeams ? 'neutral' : score >= 85 ? 'good' : score >= 65 ? 'warning' : 'danger';

  const issues: RegistrationHealthIssue[] = [];
  if (missingEmail > 0) {
    issues.push({
      key: 'missing_email', attentionKey: 'missing_email', tone: 'danger',
      label: `${missingEmail} team${missingEmail === 1 ? '' : 's'} missing an email`,
      detail: 'They can’t be reached or invited to sign up.',
    });
  }
  if (pastDue > 0) {
    issues.push({
      key: 'past_due', attentionKey: 'past_due', tone: 'danger',
      label: `${pastDue} team${pastDue === 1 ? '' : 's'} past due on payment`,
      detail: 'Accepted teams past a deposit or balance deadline.',
    });
  }
  if (unplaced > 0) {
    issues.push({
      key: 'unplaced', attentionKey: 'unplaced', tone: 'warning',
      label: `${unplaced} accepted team${unplaced === 1 ? '' : 's'} without a spot`,
      detail: 'Not yet assigned into a pool or bracket slot.',
    });
  }
  if (missingIntake > 0) {
    issues.push({
      key: 'missing_intake', attentionKey: 'missing_intake', tone: 'warning',
      label: `${missingIntake} team${missingIntake === 1 ? '' : 's'} missing required info`,
      detail: 'Required registration answers or files not yet provided.',
    });
  }
  if (unpaid > 0) {
    issues.push({
      key: 'unpaid', attentionKey: 'unpaid', tone: 'neutral',
      label: `${unpaid} accepted team${unpaid === 1 ? '' : 's'} unpaid`,
      detail: 'No completed payment yet (not past due).',
    });
  }
  if (pending > 0) {
    issues.push({
      key: 'pending_review', attentionKey: 'pending_review', tone: 'neutral',
      label: `${pending} team${pending === 1 ? '' : 's'} waiting for review`,
      detail: 'New registrations waiting for an accept, waitlist, or reject decision.',
    });
  }
  for (const gap of capacityGaps) {
    issues.push({
      key: `capacity-${gap.divisionId}`, capacityDivisionId: gap.divisionId,
      tone: gap.reason === 'closed_under' ? 'warning' : 'neutral',
      label: `${gap.divisionName}: ${gap.accepted}/${gap.capacity} filled`,
      detail: gap.reason === 'closed_under'
        ? 'Registration is closed with open spots left.'
        : 'Tournament starts soon with open spots left.',
    });
  }
  issues.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);

  return {
    hasTeams, score, tone, teamsTotal, accepted, pending, waitlist, missingEmail,
    unplaced, missingIntake, unpaid, pastDue, paymentsTracked, eventTracksPayments, capacityGaps, issues,
  };
}
