/**
 * lib/notification-labels.ts
 *
 * Human-readable labels and descriptions for every NotificationEventType.
 * Used by the preferences UI (org-level and per-tournament).
 */

import type { NotificationEventType } from './types';
import { CHAT_PAUSED } from './chat-pause';

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
  house_league_withdraw_request:     'House league withdrawal request',
  club_schedule_league_changes:      'The club changed house league’s practices',
  chat_message:                      'Chat message',
  // Intentionally NOT in NOTIFICATION_SECTIONS — an @mention is always delivered (not user-mutable here).
  chat_mention:                      'Chat @mention',
  tryout_offer_response:             'Tryout offer response',
  // Chunk D — reaches FAMILY accounts, not org staff, so it has no row in the org
  // preferences UI below (it is not in NOTIFICATION_SECTIONS). The label exists because the
  // bell renders one for every event it displays.
  family_game_update:                'Team schedule update',
  assistant_coach_joined:            'Assistant coach joined',
  assistant_coach_approval_requested: 'Assistant coach awaiting approval',
  playoffs_set:                      'Playoff bracket set',
  champions_crowned:                 'Champions crowned',
  tournament_announcement:           'Tournament announcement',
  coach_insights_digest:             'Weekly team insights',
  practice_plan_sent:                'Practice plan sent',
  // Club Tier Stage 2 — targeted lifecycle bells (no org-grid row, like assistant_coach_joined).
  // `club_season_changed` has ONE preferences row: "Your club" on a club coach's card in
  // /account/notifications (session 3), where it can arrive; never on a standalone portal's.
  club_season_changed:               'Season changed by your club',
  club_coach_listed:                 'Your club lists you as a coach',
  club_coach_joined:                 'Coach joined from your invitation',
  club_coach_declined:               'Coach declined your invitation',
  team_move_requested:               'A request to bring a team into a club',
  team_move_answered:                'A team move answered',
  // Club Tier Stage 3a — money between a club and its teams (mig 315). Words are /marketing's drafts.
  club_money_received:               'The club received a payment',
  club_money_undone:                 'The club undid a payment',
  club_request_approved:             'The club approved a request',
  club_request_declined:             'The club declined a request',
  club_request_reversed:             'The club reversed an approval',
  team_money_sent:                   'A team says it sent a payment',
  team_request_filed:                'A team filed a payment request',
  team_request_holding_payout:       'A request is holding up a team’s payout',
  // Club Tier Stage 11a — the club scheduler (mig 326). Words are /marketing's drafts.
  club_schedule_review:              'The club sent its schedule for review',
  club_schedule_final:               'The club’s schedule is on your team’s',
  club_schedule_changes:             'The club changed your team’s slots',
  club_bill_arrived:                 'The club billed your team',
  // Club Tier Stage 5b — Families' Ask the coaches. Words are /marketing's drafts.
  club_guardians_asked:              'The club needs guardian emails',
  // Club Tier Stage 5c — a payment the club passed to a coach (mig 338). Words are /marketing's drafts.
  club_payment_handed_off:           'The club received a family’s payment',
  club_payment_not_received:         'A coach says a payment never arrived',
  // Club Tier Stage 12a — online payments (mig 358). Words: CLUB_TIER_STAGE12A_COPY.md §19.
  payouts_need_attention:            'Stripe needs something to keep online payments on',
  online_payment_not_recorded:       'An online payment isn’t in the team’s record',
  card_refund_failed:                'A refund didn’t reach the card',
  // 12c words §5 `kind.*.label`.
  card_refund_whose:                 'A refund in Stripe needs you to say whose it was',
  card_refund_still_enrolled:        'A refunded child is still enrolled',
  card_refund_unmatched:             'A refund in Stripe matches no payment we recorded',
  // 12d-2 words §5.2 `terms.item.title`, §4.2 `ending.notice.title` (its own title carries the date).
  payments_terms_changed:            'New payments terms to agree to',
  payments_ending:                   'Online payments are about to stop',
  debit_returned:                    'A bank debit was returned',
  debit_reversed:                    'A bank payment was returned after it cleared',
  // 12d words §1.4 `kind.dispute.*` / `kind.disputeLost.*`; the paid-twice label is drawn from §2.2's item.
  online_payment_over:               'A team paid more than it owed',
  card_disputed:                     'A card payment was disputed',
  card_dispute_lost:                 'A dispute was lost',
  club_schedule_reply:               'A team replied to a schedule',
  club_schedule_handed_back:         'A team handed back club time',
  club_schedule_taken_back:          'A team took back club time',
  // Club Tier Stage 11d — a hand-back that asks for money back (mig 328). Words are /marketing's drafts.
  club_hand_back_asked:              'A team asks for money back for time it hands back',
  club_hand_back_withdrawn:          'A team withdrew a hand-back',
  club_hand_back_answered:           'The club answered your hand-back',
  club_hand_back_lapsed:             'A hand-back ask closed',
  club_hand_back_unasked:            'Practices handed back without asking for money',
  // Free coach header parity (2026-10-13) — a free coach's own notices (TEAM_COACH_EVENTS below).
  team_coach_registered:             'Your team’s registration',
  team_coach_accepted:               'Your team was accepted',
  team_coach_declined:               'Your team was declined',
  team_coach_payment_recorded:       'Your team’s fee was recorded',
  team_coach_payment_reminder:       'A payment reminder',
  team_coach_schedule_published:     'Your schedule is out',
  team_coach_game_changed:           'A game changed',
  team_coach_announcement:           'An announcement from the organizer',
  team_coach_results_posted:         'Final results are posted',
  team_coach_invitation:             'A club invited you to coach',
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
  house_league_withdraw_request:     'A family asks to withdraw a child from a house league season.',
  club_schedule_league_changes:      'The club sent changes to its schedule that moved or cancelled house-league practices.',
  chat_message:                      'A new message is posted in a tournament chat you are part of.',
  chat_mention:                      'Someone @mentions you in a tournament chat (always delivered).',
  tryout_offer_response:             'A tryout family accepts or declines an offer via their link — you confirm the roster spot.',
  family_game_update:                'A team you follow as family moves a game, cancels one, or puts one back on.',
  assistant_coach_joined:            'An assistant coach you invited accepted and joined the team.',
  assistant_coach_approval_requested: 'A head coach invited an assistant coach and it needs admin approval.',
  playoffs_set:                      'A published division’s playoff teams are all known, so its bracket is filled in.',
  champions_crowned:                 'A tournament’s playoffs are complete — the champion(s) are crowned and the final results are in.',
  tournament_announcement:           'An organizer posts a day-of announcement (like a rain delay or schedule shift) with the notify option on.',
  coach_insights_digest:             'Your team’s Sunday week-in-review — the top Insights findings, only when something stood out.',
  practice_plan_sent:                'A coach sent you the practice plan to read before practice — with the stations you’re running.',
  club_season_changed:               'Your club closed, started or reopened your team’s season.',
  club_coach_listed:                 'Your club chose to list you under Coaches on a team’s public page.',
  club_coach_joined:                 'A coach you invited from a team’s Coaches page accepted and joined the team.',
  club_coach_declined:               'A coach you invited from a team’s Coaches page declined the invitation.',
  team_move_requested:               'A club asked to bring your own team in, or a coach asked to bring theirs into your club. Nothing moves until you say yes.',
  team_move_answered:                'A team you asked to bring into a club moved, or the other side declined.',
  club_money_received:               'Your club recorded a payment from your team, or confirmed one you sent.',
  club_money_undone:                 'Your club undid a payment it had recorded, with its reason.',
  club_request_approved:             'Your club approved one of your team’s payment requests.',
  club_request_declined:             'Your club declined one of your team’s payment requests, with its reason.',
  club_request_reversed:             'Your club reversed an approval it had made, with its reason.',
  team_money_sent:                   'A team’s coach says they sent the club a payment. Confirm it when it arrives.',
  team_request_filed:                'A team’s coach filed a payment request for the club to answer.',
  team_request_holding_payout:       'A team can’t pay families their end-of-season share until you answer its request.',
  club_schedule_review:              'Your club sent its schedule for review: your team’s slots and its bill. Answer Looks good or Ask for a change.',
  club_schedule_final:               'Your club finalized a schedule: its practices are on your team’s schedule.',
  club_schedule_changes:             'Your club sent changes to your team’s slots on one of its schedules.',
  club_bill_arrived:                 'Your club billed your team for the time it got, with its payments on Money › Club.',
  club_guardians_asked:              'Your club asked you to add guardian emails for some of your players, on your Roster.',
  payouts_need_attention:            'Stripe needs something more from the club to keep online payments on. The owner fixes it on the Payouts card.',
  online_payment_not_recorded:       'A team paid by card, but the payment couldn’t be added to the team’s record. Refund it to the card.',
  card_refund_failed:                'A refund to a team’s card was returned. Send the team the money another way, then record the refund.',
  // 12c words §5 `kind.*.desc`.
  card_refund_whose:                 'A part refund was made in Stripe on a payment for more than one child. Choose whose fee it was.',
  card_refund_still_enrolled:        'A child’s fee was refunded in Stripe, but the registration is still active. Withdraw them, email the pay link or keep them enrolled.',
  card_refund_unmatched:             'A refund was made in Stripe on a payment that isn’t recorded yet. It clears when the payment arrives.',
  payments_terms_changed:            'FieldLogicHQ’s payments terms changed. The owner reads and agrees on the Payouts card; online payments stay on.',
  payments_ending:                   'Online payments stop through an ending the owner didn’t choose: a comp running out, or a subscription payment that failed.',
  debit_returned:                    'A bank debit was returned while it was clearing. Nothing was taken. The family was emailed a way to pay.',
  debit_reversed:                    'The bank reversed a payment that had cleared. It’s out of the book and the amount is owing again.',
  online_payment_over:               'A team’s online payment landed after it had paid, or for more than it owed. Refund the extra to the card.',
  card_disputed:                     'A cardholder’s bank is disputing a card payment. Only the person who set up payouts can answer it in Stripe.',
  card_dispute_lost:                 'The bank took back a payment. It’s out of the book and the amount is owing again.',
  club_payment_handed_off:           'Your club received a family’s dues payment for one of your players. Record it in the team’s book when the money reaches you.',
  club_payment_not_received:         'A head coach says a family’s payment you sent them never reached the team.',
  club_schedule_reply:               'A team answered a schedule you sent for review.',
  club_schedule_handed_back:         'A team handed back a practice from a schedule you built: the time is open for another team.',
  club_schedule_taken_back:          'A team took back practices it had handed back on a schedule you built: the time is the team’s again.',
  club_hand_back_asked:              'A team asks to hand back club practices with money back. The practices stay the team’s until someone who holds the club’s Accounting answers.',
  club_hand_back_withdrawn:          'A team withdrew a hand-back ask nobody had answered: its practices stay the team’s.',
  club_hand_back_answered:           'Your club accepted or declined your hand-back: what it did to what your team owes, or why it said no.',
  club_hand_back_lapsed:             'Your hand-back ask closed before the club answered: none of its practices was still to come (most often they had started). Nothing changed.',
  club_hand_back_unasked:            'A coach on your team without money access handed back time the club billed: you can ask the club for the money from the practice.',
  team_coach_registered:             'Your team’s registration reached a tournament’s organizer, or went on its waitlist.',
  team_coach_accepted:               'A tournament’s organizer accepted your team.',
  team_coach_declined:               'A tournament’s organizer declined your team.',
  team_coach_payment_recorded:       'A tournament’s organizer recorded your team’s fee as paid.',
  team_coach_payment_reminder:       'A tournament’s organizer reminded you of a payment that is due.',
  team_coach_schedule_published:     'A tournament’s organizer published your team’s schedule.',
  team_coach_game_changed:           'One of your team’s games moved, was cancelled, or is back on.',
  team_coach_announcement:           'A tournament’s organizer emailed an announcement to the teams.',
  team_coach_results_posted:         'A tournament’s organizer posted its final results.',
  team_coach_invitation:             'A club invited you to coach one of its teams. Answer it on Home.',
};

// ── Section groups (org-level preferences page) ────────────────────────────────

export interface NotificationSection {
  label: string;
  /** null = always shown; string = module capability key required (e.g. 'module_rep_teams') */
  module: string | null;
  /** Only these roles can receive the section's notices (absent: every role the module reaches). */
  roles?: readonly string[];
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
    label: 'House league',
    module: 'module_house_league',
    eventTypes: ['house_league_registration_new', 'house_league_withdraw_request', 'club_schedule_league_changes'],
  },
  // ⚖ While chat is paused (2026-10-18, lib/chat-pause.ts) there is no chat to be told about: the row is not shown.
  // The stored preference is kept for the return.
  ...(CHAT_PAUSED ? [] : [{
    label: 'Messaging',
    module: null,
    eventTypes: ['chat_message'] as NotificationEventType[],
  }]),
  // Club Tier Stage 3a (Ask 5c): the Accounting rows Stage 1 drew, each shipping with its event. Shown
  // on the org card of an organization whose plan carries Accounting, to a member who can open it.
  {
    label: 'Accounting',
    module: 'module_accounting',
    // Stage 11d: a hand-back's ask is a payment request the money movers answer (the builders hear it too).
    eventTypes: ['team_money_sent', 'team_request_filed', 'team_request_holding_payout', 'club_hand_back_asked', 'club_hand_back_withdrawn'],
  },
  // Club Tier Stage 5c (Ask 28): the person who passed a family's payment to a coach hears a "never arrived" — only ever
  // someone who could open Families (it is sent to the sender alone).
  {
    label: 'Families',
    module: 'module_families',
    eventTypes: ['club_payment_not_received'],
  },
  // Club Tier Stage 11a (part B): the club scheduler's builders hear a team's review answer and a hand-back — the club's
  // owner and admins only (`resolveScheduler`), so the row shows only where its notices can arrive.
  {
    label: 'Schedules',
    module: 'module_rep_teams',
    roles: ['owner', 'admin'],
    eventTypes: ['club_schedule_reply', 'club_schedule_handed_back', 'club_schedule_taken_back'],
  },
  // Notification Settings Phase 1 (D3): the 5 DEAD event types — 'score_disputed',
  // 'registration_deadline_approaching', 'waitlist_opened', 'roster_change_requested',
  // 'coach_access_requested' — were removed from the sections above. They have zero live call
  // sites (nothing ever fires them), so a settings page must not advertise a toggle for them.
  // The NotificationEventType union, labels/descriptions, and NOTIFICATION_CATEGORY total map are
  // deliberately LEFT intact (drift guard) — reinstating a row when a trigger ships is one line.
  //
  // 'tryout_offer_response' JOINED that dead list on 2026-08-26 and took the whole 'Coaches
  // Portal' section with it (it was the section's only member). It fired when a family clicked
  // Accept/Decline in a tryout offer email; the decision emails and their reply loop were removed
  // outright — a rep offer is a custom letter the family signs, so the platform sends nothing on
  // a coach's behalf (owner ruling, binding). Same treatment as the other five: the union, label,
  // description and push-default entry stay put so existing bell rows still render, and its
  // coach-facing row on /account/notifications is gone too. This one is NOT waiting on a trigger
  // to ship — do not reinstate the row.
  //
  // NOTE: 'assistant_coach_joined' + 'assistant_coach_approval_requested' are INTENTIONALLY not
  // listed here (like 'chat_mention') — they're targeted lifecycle bells (to the head coach / org
  // admins), not general per-user-configurable events, so they don't get a preferences-UI row.
  // NOTE: 'coach_insights_digest' gets its coach-facing row on the universal
  // /account/notifications coach card, NOT here — an org admin doesn't receive the per-coach
  // digest, so it must not render on the org grid (R4).
];


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
  // The weekly digest's whole point is reach — push ON by default, weekly cadence, and it is
  // only ever sent when something actually fired (quiet weeks send nothing).
  'coach_insights_digest',
  // "Read this before 6:00 p.m." — time-sensitive by construction, and only ever sent because a
  // coach pressed Send to staff. (The coach's own EMAIL is a separate explicit act outside this
  // pipeline — lib/practice-plan-email.ts — so the email channel here stays off.)
  'practice_plan_sent',
  // Rare, and it changes what the coach can do today (their screens close or reopen).
  'club_season_changed',
  // Rare, and it puts a name on a public page, so the coach should hear it.
  'club_coach_listed',
  'club_coach_joined',
  'club_coach_declined',
  // Rare, and it waits on the recipient's yes (or reports the answer to theirs).
  'team_move_requested',
  'team_move_answered',
  // Money between a club and a team: each is rare and each changes what the other side can do next.
  'club_money_received',
  'club_money_undone',
  'club_request_approved',
  'club_request_declined',
  'club_request_reversed',
  'team_money_sent',
  'team_request_filed',
  'team_request_holding_payout',
  // The club scheduler: each is rare and each changes what the other side does next.
  'club_schedule_review',
  'club_schedule_final',
  'club_schedule_changes',
  'club_bill_arrived',
  // Families' Ask the coaches (Stage 5b): rare, and only ever sent because the club pressed Send.
  'club_guardians_asked',
  // A family's payment the club passed to a coach (Stage 5c), and the coach's "never arrived": rare, and each waits on,
  // or answers, the other side.
  'club_payment_handed_off',
  'club_payment_not_received',
  'club_schedule_reply',
  'club_schedule_handed_back',
  'club_schedule_taken_back',
  // A hand-back that asks for money back: each is rare and each waits on, or answers, the other side.
  'club_hand_back_asked',
  'club_hand_back_withdrawn',
  'club_hand_back_answered',
  'club_hand_back_lapsed',
  'club_hand_back_unasked',
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
 * Single source of truth — the bell panel groups by this. Checked as a total
 * `Record<NotificationEventType, …>` so adding a new event type fails typecheck
 * until it is deliberately categorized here (drift guard). Kept LITERAL (`as const`): the 'act'
 * kinds are a type of their own (`NeedsAttentionKind`), and every one must say how it ends
 * (`NEEDS_ATTENTION_END`, lib/needs-attention.ts — Needs attention clears itself, owner 2026-10-16).
 *
 * ⚰ RETIRED FROM NEEDS ATTENTION (owner ruling 2026-10-16): score_disputed, coach_access_requested,
 * roster_change_requested and tryout_offer_response — nothing has sent them for months, so nothing could
 * ever settle one. They read as old news; mig 332 cleared any still pinned.
 */
export const NOTIFICATION_CATEGORY = {
  // Act — needs a decision
  payment_failed:                     'act',
  score_disputed:                     'know',
  coach_access_requested:             'know',
  roster_change_requested:            'know',
  assistant_coach_approval_requested: 'act',
  tryout_offer_response:              'know',
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
  // A family's ask to withdraw: a decision for the desk; clears itself when the registration ends (9b-2).
  house_league_withdraw_request:      'act',
  club_schedule_league_changes:       'know',
  coach_insights_digest:              'know',
  // A coach sent the practice plan — a read, not a decision to make.
  practice_plan_sent:                 'know',
  // The club changed the season / a club-invited coach joined — news, not a decision to make.
  club_season_changed:                'know',
  club_coach_listed:                  'know',
  club_coach_joined:                  'know',
  club_coach_declined:                'know',
  // A team move: the request is a decision to make; the answer is news.
  team_move_requested:                'act',
  team_move_answered:                 'know',
  // Club money (Stage 3a): the club's three wait on a decision from it; the coach's five are news.
  team_money_sent:                    'act',
  team_request_filed:                 'act',
  team_request_holding_payout:        'act',
  // The club scheduler (Stage 11a): a review waits on the coach's answer; the rest is news.
  club_schedule_review:               'act',
  club_schedule_final:                'know',
  club_schedule_changes:              'know',
  club_bill_arrived:                  'know',
  // Families' Ask the coaches (Stage 5b): news, not Needs attention (the build prompt's default — the owner may rule 'act').
  club_guardians_asked:               'know',
  // Families' payment hand-off (Stage 5c, Ask 28): the coach's Record it / Not received waits; the answer is news.
  club_payment_handed_off:            'act',
  club_payment_not_received:          'know',
  // Online payments (Stage 12a): each waits until Stripe or the club settles it.
  payouts_need_attention:             'act',
  online_payment_not_recorded:        'act',
  card_refund_failed:                 'act',
  card_refund_whose:                  'act',
  card_refund_still_enrolled:         'act',
  card_refund_unmatched:              'act',
  // 12d-2: the owner agrees (clears itself), or the ending passes or stops coming (clears itself).
  payments_terms_changed:             'act',
  payments_ending:                    'act',
  debit_returned:                     'act',
  debit_reversed:                     'act',
  online_payment_over:                'act',
  card_disputed:                      'act',
  card_dispute_lost:                  'act',
  club_schedule_reply:                'know',
  club_schedule_handed_back:          'know',
  club_schedule_taken_back:           'know',
  // A hand-back's ask waits on the club's answer; the rest is news.
  club_hand_back_asked:               'act',
  club_hand_back_withdrawn:           'know',
  club_hand_back_answered:            'know',
  club_hand_back_lapsed:              'know',
  // Part C (Ask 13): money nobody asked for waits on the team's money people.
  club_hand_back_unasked:             'act',
  club_money_received:                'know',
  club_money_undone:                  'know',
  club_request_approved:              'know',
  club_request_declined:              'know',
  club_request_reversed:              'know',
  // A family's own team news — informational, never a decision to make.
  family_game_update:                 'know',
  // A free coach's own notices (TEAM_COACH_EVENTS). News, except the payment reminder: money the coach owes
  // waits under Needs attention until they mark it Done, as action items do in the paid drawer (owner B4,
  // 2026-10-13 — the /design pass's DC7).
  team_coach_registered:              'know',
  team_coach_accepted:                'know',
  team_coach_declined:                'know',
  team_coach_payment_recorded:        'know',
  team_coach_payment_reminder:        'act',
  team_coach_schedule_published:      'know',
  team_coach_game_changed:            'know',
  team_coach_announcement:            'know',
  team_coach_results_posted:          'know',
  team_coach_invitation:              'know',
  // Talk — conversation (moves to the Chat tab in P3)
  chat_message:                       'talk',
  chat_mention:                       'talk',
} as const satisfies Record<NotificationEventType, NotificationCategory>;

/** The kinds that wait in Needs attention — each one says how it ends (lib/needs-attention.ts). */
export type NeedsAttentionKind = {
  [K in keyof typeof NOTIFICATION_CATEGORY]: (typeof NOTIFICATION_CATEGORY)[K] extends 'act' ? K : never
}[keyof typeof NOTIFICATION_CATEGORY];

/** The same kinds, as a list (a query's `in`). */
export const NEEDS_ATTENTION_KINDS = (Object.keys(NOTIFICATION_CATEGORY) as (keyof typeof NOTIFICATION_CATEGORY)[])
  .filter((k): k is NeedsAttentionKind => NOTIFICATION_CATEGORY[k] === 'act');

/** Zone for an event type; unknown/legacy types fall back to the activity feed. */
export function notificationCategory(eventType: string): NotificationCategory {
  return (NOTIFICATION_CATEGORY as Record<string, NotificationCategory>)[eventType] ?? 'know';
}

// ── A free coach's own notices (Free coach header parity, owner 2026-10-13) ──────

/**
 * THE FREE COACH'S BELL, AS A LIST OF KINDS (B1). A free coach has no club of their own, so each of
 * these rows is filed under the HOST club whose tournament their team is in (`notifications.org_id` is
 * NOT NULL). What keeps it out of that club's bells is this list, and nothing else:
 *   · every org-scoped read — the list, the count, Mark all read, the live count — EXCLUDES these kinds,
 *     so a person who is also that club's staff never sees a coach notice in the club's bell;
 *   · the free portal's bell reads ONLY these kinds, from every club, so it never shows club rows.
 * One list, read by both sides (`lib/notification-bell-scope.ts`), the way the chat ("talk") exclusion
 * is. ⚠ A new free-coach kind joins HERE or it lands in a club's bell. Bell-only: none of these is in
 * PUSH_DEFAULT_ON_EVENTS or NOTIFICATION_SECTIONS, and no writer sends them through notify().
 */
export const TEAM_COACH_EVENTS = [
  'team_coach_registered',
  'team_coach_accepted',
  'team_coach_declined',
  'team_coach_payment_recorded',
  'team_coach_payment_reminder',
  'team_coach_schedule_published',
  'team_coach_game_changed',
  'team_coach_announcement',
  'team_coach_results_posted',
  'team_coach_invitation',
] as const satisfies readonly NotificationEventType[];

export type TeamCoachEventType = (typeof TEAM_COACH_EVENTS)[number];

const TEAM_COACH_EVENT_SET: ReadonlySet<string> = new Set(TEAM_COACH_EVENTS);

/** Is this a free coach's own notice (one a club's bell never shows)? */
export function isTeamCoachEvent(eventType: string | null | undefined): boolean {
  return !!eventType && TEAM_COACH_EVENT_SET.has(eventType);
}

/* ⚰ `ACT_EVENT_TYPES` STOOD HERE and is deleted (Notifications Open in Place, 2026-10-05, D9). It was the
   set "Mark all read" skipped (the 2026-09-03 rule), read by the route and both clients' optimistic passes.
   Mark all read now marks everything read: a Needs-attention row leaves its zone on Done (`cleared_at`),
   never on read, so the skip protected nothing. The zone itself reads `notificationCategory(...) === 'act'`. */

// ── Simple-view groups (Notification Settings Phase 2) ─────────────────────────

export interface SimpleGroup {
  label: string;
  blurb: string;
  category: NotificationCategory;
  eventTypes: NotificationEventType[];
}

/**
 * The plain-language groups the Simple (default) view rolls events into, in order.
 * 'talk' (chat) is deliberately absent — chat keeps its own surface (constraint 3),
 * so a card shows a pointer, never a chat rollup.
 */
const SIMPLE_GROUP_META: { category: NotificationCategory; label: string; blurb: string }[] = [
  { category: 'act',  label: 'Needs your attention', blurb: 'The things that want a decision from you.' },
  { category: 'know', label: 'What’s happening',      blurb: 'Activity updates as they happen.' },
];

/**
 * Group a card's event types into the two Simple-view groups (act / know), preserving
 * order and dropping empty groups. Chat ('talk') and any lead events the caller pulls
 * out first (e.g. the coach digest — rule R1) are simply not passed in.
 */
export function simpleGroupsFor(eventTypes: NotificationEventType[]): SimpleGroup[] {
  return SIMPLE_GROUP_META
    .map(meta => ({
      label:      meta.label,
      blurb:      meta.blurb,
      category:   meta.category,
      eventTypes: eventTypes.filter(et => notificationCategory(et) === meta.category),
    }))
    .filter(g => g.eventTypes.length > 0);
}
