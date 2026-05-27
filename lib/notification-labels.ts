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

// ── Section groups (org-level preferences page) ────────────────────────────────

export interface NotificationSection {
  label: string;
  /** null = always shown; string = module capability key required (e.g. 'module_rep_teams') */
  module: string | null;
  eventTypes: NotificationEventType[];
}

export const NOTIFICATION_SECTIONS: NotificationSection[] = [
  {
    label: 'Tournaments',
    module: null,
    eventTypes: [
      'registration_new',
      'registration_status_changed',
      'score_submitted',
      'score_disputed',
      'registration_deadline_approaching',
      'waitlist_opened',
    ],
  },
  {
    label: 'Payments',
    module: null,
    eventTypes: ['payment_received', 'payment_failed'],
  },
  {
    label: 'Coaches Portal',
    module: 'module_rep_teams',
    eventTypes: ['roster_change_requested', 'coach_access_requested'],
  },
  {
    label: 'House League',
    module: 'module_house_league',
    eventTypes: ['house_league_registration_new'],
  },
];

/** All event types in display order — derived from NOTIFICATION_SECTIONS. Single source of truth. */
export const ALL_EVENT_TYPES: NotificationEventType[] =
  NOTIFICATION_SECTIONS.flatMap(s => s.eventTypes);

/**
 * The 6 event types that are wired and relevant to a specific tournament.
 *
 * Excluded deliberately:
 *   - roster_change_requested   — rep teams / coaches portal only
 *   - coach_access_requested    — org-wide, not tournament-scoped
 *   - house_league_registration_new — different module
 *   - score_disputed            — no dispute flow exists yet
 *   - waitlist_opened           — no trigger (needs slot-vacancy flow)
 *   - registration_deadline_approaching — Phase F cron, not yet built
 */
export const TOURNAMENT_EVENT_TYPES: NotificationEventType[] = [
  'registration_new',
  'registration_status_changed',
  'payment_received',
  'payment_failed',
  'score_submitted',
];
