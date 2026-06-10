/**
 * lib/coaches-status.ts
 *
 * Single source of truth for the coach-facing tournament REGISTRATION status
 * vocabulary (accepted / pending / waitlist / rejected). Consolidates the three
 * copies that were duplicated across the coach portal surfaces:
 *   - app/coaches/tournaments/[teamId]/page.tsx   (label + badge + desc)
 *   - app/coaches/tournaments/page.tsx            (label + badge)
 *   - app/coaches/team/[basicTeamId]/page.tsx     (label + badge)
 *
 * This is the membership status a coach sees on a tournament record — distinct
 * from the organizer-side payment/attention vocabulary in lib/registration-attention.ts.
 */

export const REGISTRATION_STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  pending:  'Pending Review',
  waitlist: 'Waitlisted',
  rejected: 'Not Accepted',
};

export const REGISTRATION_STATUS_BADGE: Record<string, string> = {
  accepted: 'badge-success',
  pending:  'badge-warning',
  waitlist: 'badge-info',
  rejected: 'badge-danger',
};

export const REGISTRATION_STATUS_DESC: Record<string, string> = {
  accepted: 'Your team has been accepted into this tournament. Check below for your schedule and announcements.',
  pending:  'Your registration is pending review by the tournament director. You will receive an email when your status is updated.',
  waitlist: 'The division is currently full. Your team is on the waitlist and will be notified if a spot opens up.',
  rejected: 'Your team was not accepted into this tournament. Contact the organizer for more information.',
};

/** Human label for a registration status; falls back to the raw value. */
export function registrationStatusLabel(status: string): string {
  return REGISTRATION_STATUS_LABEL[status] ?? status;
}

/** Global badge class for a registration status; falls back to `badge-info`. */
export function registrationStatusBadge(status: string): string {
  return REGISTRATION_STATUS_BADGE[status] ?? 'badge-info';
}

/** Long-form description for a registration status; empty string when unknown. */
export function registrationStatusDesc(status: string): string {
  return REGISTRATION_STATUS_DESC[status] ?? '';
}
