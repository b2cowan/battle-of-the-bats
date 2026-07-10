import type { RegistrationAttentionKey, RegistrationAttentionSummary } from './registration-attention';

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
  capacityGaps: RegistrationHealthCapacityGap[];
  issues: RegistrationHealthIssue[];
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
  capacityGaps: RegistrationHealthCapacityGap[];
}): RegistrationHealthMetrics {
  const { attention, teamsTotal, accepted, paymentsTracked, capacityGaps } = input;

  const pending = bucketCount(attention, 'pending_review');
  const waitlist = bucketCount(attention, 'waitlist');
  const missingEmail = bucketCount(attention, 'missing_email');
  const unplaced = bucketCount(attention, 'unplaced');
  const missingIntake = paymentsTracked ? bucketCount(attention, 'missing_intake') : 0;
  const unpaid = paymentsTracked ? bucketCount(attention, 'unpaid') : 0;
  const pastDue = paymentsTracked ? bucketCount(attention, 'past_due') : 0;

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
    unplaced, missingIntake, unpaid, pastDue, paymentsTracked, capacityGaps, issues,
  };
}
