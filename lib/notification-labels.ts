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
  team_no_show:                      'Team marked no-show',
  coach_access_requested:            'Coach access requested',
  house_league_registration_new:     'House league registration',
  chat_message:                      'Chat message',
  // Intentionally NOT in NOTIFICATION_SECTIONS — an @mention is always delivered (not user-mutable here).
  chat_mention:                      'Chat @mention',
  tryout_offer_response:             'Tryout offer response',
  assistant_coach_joined:            'Assistant coach joined',
  assistant_coach_approval_requested: 'Assistant coach awaiting approval',
  playoffs_set:                      'Playoff bracket set',
  champions_crowned:                 'Champions crowned',
  tournament_announcement:           'Tournament announcement',
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
  team_no_show:                      'A team is marked as a no-show during gate check-in.',
  coach_access_requested:            'A coach requests access to the coaches portal.',
  house_league_registration_new:     'A player submits a house league season registration.',
  chat_message:                      'A new message is posted in a tournament chat you are part of.',
  chat_mention:                      'Someone @mentions you in a tournament chat (always delivered).',
  tryout_offer_response:             'A tryout family accepts or declines an offer via their link — you confirm the roster spot.',
  assistant_coach_joined:            'An assistant coach you invited accepted and joined the team.',
  assistant_coach_approval_requested: 'A head coach invited an assistant coach and it needs admin approval.',
  playoffs_set:                      'The playoff bracket is set for a tournament — the seeding is locked and the knockout stage is on.',
  champions_crowned:                 'A tournament’s playoffs are complete — the champion(s) are crowned and the final results are in.',
  tournament_announcement:           'An organizer posts a day-of announcement (like a rain delay or schedule shift) with the notify option on.',
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
      'team_no_show',
      'playoffs_set',
      'champions_crowned',
      'tournament_announcement',
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
    eventTypes: ['roster_change_requested', 'coach_access_requested', 'tryout_offer_response'],
  },
  {
    label: 'House League',
    module: 'module_house_league',
    eventTypes: ['house_league_registration_new'],
  },
  {
    label: 'Messaging',
    module: null,
    eventTypes: ['chat_message'],
  },
  // NOTE: 'assistant_coach_joined' + 'assistant_coach_approval_requested' are INTENTIONALLY not
  // listed here (like 'chat_mention') — they're targeted lifecycle bells (to the head coach / org
  // admins), not general per-user-configurable events, so they don't get a preferences-UI row.
];

/** All event types in display order — derived from NOTIFICATION_SECTIONS. Single source of truth. */
export const ALL_EVENT_TYPES: NotificationEventType[] =
  NOTIFICATION_SECTIONS.flatMap(s => s.eventTypes);

/**
 * Events whose Push channel is ON by default (when a user has no saved preference row).
 *
 * These are the time-sensitive, action-worthy moments an organizer/coach wants on their
 * phone the instant they happen. Push only ever reaches a *subscribed* device, so a
 * default of ON here never spams anyone who hasn't opted their device in.
 *
 * Kept OFF by default (informational / high-volume — users opt in per event):
 *   registration_status_changed, registration_deadline_approaching, waitlist_opened,
 *   house_league_registration_new
 *
 * Single source of truth — consumed by both the server dispatch (lib/notify.ts) and the
 * org preferences UI so the toggles shown always match what actually fires.
 */
export const PUSH_DEFAULT_ON_EVENTS: ReadonlySet<NotificationEventType> = new Set([
  'registration_new',
  'payment_received',
  'payment_failed',
  'score_submitted',
  'score_disputed',
  'team_no_show',
  'roster_change_requested',
  'coach_access_requested',
  'tryout_offer_response',
  'assistant_coach_joined',
  'assistant_coach_approval_requested',
  'chat_message',
  'chat_mention',
  'playoffs_set',
  'champions_crowned',
  'tournament_announcement',
]);

/**
 * The event types that are wired and relevant to a specific tournament.
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
  'team_no_show',
  'playoffs_set',
  'champions_crowned',
  'tournament_announcement',
];

// ── Bell zone categories (Notification Center Rework P1) ───────────────────────

export type NotificationCategory = 'act' | 'know' | 'talk';

/**
 * Which zone each event belongs to in the notification bell.
 *   act  — needs a decision from the recipient → pinned "Needs attention" section
 *   know — informational activity → the date-grouped activity feed
 *   talk — a conversation (chat) → P3 relocates these off the bell to the Chat tab
 *
 * Single source of truth — the bell panel groups by this. Typed as a total
 * `Record<NotificationEventType, …>` so adding a new event type fails typecheck
 * until it is deliberately categorized here (drift guard).
 */
export const NOTIFICATION_CATEGORY: Record<NotificationEventType, NotificationCategory> = {
  // Act — needs a decision
  payment_failed:                     'act',
  score_disputed:                     'act',
  coach_access_requested:             'act',
  roster_change_requested:            'act',
  assistant_coach_approval_requested: 'act',
  tryout_offer_response:              'act',
  team_no_show:                       'act',
  // Know — informational activity
  registration_new:                   'know',
  registration_status_changed:        'know',
  payment_received:                   'know',
  score_submitted:                    'know',
  playoffs_set:                       'know',
  champions_crowned:                  'know',
  tournament_announcement:            'know',
  waitlist_opened:                    'know',
  registration_deadline_approaching:  'know',
  assistant_coach_joined:             'know',
  house_league_registration_new:      'know',
  // Talk — conversation (moves to the Chat tab in P3)
  chat_message:                       'talk',
  chat_mention:                       'talk',
};

/** Zone for an event type; unknown/legacy types fall back to the activity feed. */
export function notificationCategory(eventType: string): NotificationCategory {
  return (NOTIFICATION_CATEGORY as Record<string, NotificationCategory>)[eventType] ?? 'know';
}
