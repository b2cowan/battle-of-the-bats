/**
 * lib/notification-labels.ts
 *
 * Human-readable labels and descriptions for every NotificationEventType.
 * Used by the preferences UI (org-level and per-tournament).
 */

import type { NotificationEventType } from './types';

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
  registration_new:                  'New registration',
  registration_status_changed:       'Registration status changed',
  payment_received:                  'Payment received',
  payment_failed:                    'Payment failed',
  roster_change_requested:           'Roster change requested',
  score_submitted:                   'Score submitted',
  score_disputed:                    'Score disputed',
  registration_deadline_approaching: 'Registration deadline approaching',
  waitlist_opened:                   'Waitlist opened',
  coach_access_requested:            'Coach access requested',
  house_league_registration_new:     'House league registration',
};

export const NOTIFICATION_EVENT_DESCRIPTIONS: Record<NotificationEventType, string> = {
  registration_new:                  'A team completes and submits a registration for a tournament.',
  registration_status_changed:       'A registration is approved, waitlisted, or declined.',
  payment_received:                  'A team payment is recorded or confirmed.',
  payment_failed:                    'A scheduled or automatic payment fails.',
  roster_change_requested:           'A coach submits a roster change request for review.',
  score_submitted:                   'A scorekeeper or coach submits a game result.',
  score_disputed:                    'A submitted score is flagged as disputed by a coach.',
  registration_deadline_approaching: 'A tournament registration deadline is within 48 hours.',
  waitlist_opened:                   'A tournament waitlist is opened to allow additional registrations.',
  coach_access_requested:            'A coach requests access to the coaches portal.',
  house_league_registration_new:     'A player submits a house league season registration.',
};

/** All 11 event types in display order. */
export const ALL_EVENT_TYPES: NotificationEventType[] = [
  'registration_new',
  'registration_status_changed',
  'payment_received',
  'payment_failed',
  'roster_change_requested',
  'score_submitted',
  'score_disputed',
  'registration_deadline_approaching',
  'waitlist_opened',
  'coach_access_requested',
  'house_league_registration_new',
];
