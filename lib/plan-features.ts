import type { OrgPlan } from './types';

export type PlanFeature =
  // ── Existing features ────────────────────────────────────────────────────
  | 'auto_schedule'
  | 'playoff_generator'
  /** Manual playoff bracket building (structure + by-seed placement + manual scheduling) — free on all tournament plans. The auto-schedule optimizer + tiered auto-split remain `playoff_generator`. */
  | 'playoff_manual'
  /** Bulk "shift the day" reschedule/cancel — the one-tap Rain-Delay / Day-of Ops tool. tournament_plus
   *  and above (same automation family as the generators). Free orgs keep manual single-game edits +
   *  the free pinned rain-delay banner; only the bulk convenience is gated (2026-07-07 decision). */
  | 'bulk_reschedule'
  | 'sealed_archives'
  | 'advanced_tournament_branding'
  | 'schedule_notification'
  | 'custom_registration_fields'
  | 'registration_export'
  | 'bulk_data_imports'
  | 'bulk_registration_actions'
  | 'waitlist_collection'
  | 'waitlist_automation'
  | 'tournament_cloning'
  | 'targeted_tournament_announcements'
  | 'post_tournament_summary'
  | 'payment_readiness_tools'
  // ── The open event (the free Tournament plan is the INVITE-ONLY event) ──────
  // Owner 2026-10-12, BUSINESS_DECISIONS.md "The free Tournament plan is the INVITE-ONLY event"; built 2026-10-16
  // (FREE_TOURNAMENT_TIER_REVIEW_PLAN.md §12). An event on a plan without `open_registration` is invite-only: the host
  // adds every team. `lib/invite-only-event.ts` is the one place that turns these four keys into what an event shows.
  /** Public registration (the form, the page, "Registration open") and the review queue (accept, decline, pending). */
  | 'open_registration'
  /** Fees and payment tracking: the Fees & payments card, the Payment column, Mark paid, amounts paid. */
  | 'payment_tracking'
  /** The organizer's check-in screen and the gate job. */
  | 'team_check_in'
  /** The Staff kit and every volunteer job (scorekeeper and gate): the `official` role. */
  | 'tournament_volunteers'
  // ── Export feature keys (Phase B7) ───────────────────────────────────────
  /** PDF generation on any export surface — tournament_plus and above */
  | 'pdf_exports'
  /** Custom PDF header/footer/logo via PDF Settings admin page — tournament_plus+ */
  | 'pdf_template_settings'
  /** All export formats for house league module — league and above */
  | 'league_exports'
  /** All export formats for rep teams + accounting module — club only */
  | 'club_exports'
  // ── Public fan experience (Phase 2) ──────────────────────────────────────
  /** Anonymous fan push score alerts — tournament_plus and above (the signature halo feature) */
  | 'fan_score_alerts'
  // ── Coach Chat (Project 1 — Tournament Chat) ─────────────────────────────
  /** Live group chat between the host org and all participating coaches — tournament_plus and above.
   *  Gates the HOST org only; participating coaches need no plan of their own. */
  | 'tournament_chat'
  // ── Coach Chat (Project 2A — Team staff rooms) ───────────────────────────
  /** A team's standing coach↔coach staff room (head + assistants, no tournament). Club tiers via the
   *  rank ladder + an explicit grant to the standalone Premium Coaches Portal ('team'). League is
   *  deliberately excluded — it has no rep teams, so it has no coaching staffs to chat. Gates room
   *  CREATION only; reading/posting stays membership-gated, mirroring tournament_chat. */
  | 'coach_peer_chat'
  // ── Club Shared Book ─────────────────────────────────────────────────────
  /**
   * A club's teams reading each other's opponent scouting books — CLUB PLAN EXCLUSIVE
   * (owner ruling 2026-08-04, logged in BUSINESS_DECISIONS.md; plan §8 Q3).
   *
   * ⚠ Deliberately NOT in PLAN_FEATURE_GRANTS for `team`: the value of this feature is a club
   * with several teams, so a standalone Premium Coaches Portal has no siblings to share with
   * and gets NOTHING — no switches, no layer, and no locked tease. Absent, not upsold: the
   * ruling is that a single-team customer should never see a door they cannot use.
   */
  | 'club_shared_book'
  // ── Online payments (Club Tier Stage 12a) ────────────────────────────────
  /**
   * The club takes payments online through its own Stripe account (the Payouts card, the pay pages, card refunds). Every
   * paid org plan, Tournament Plus and above (Decided 2026-07-28, `BUSINESS_DECISIONS.md`; the Facts doc's
   * facilitated-payments line). Separate from `payment_tracking`, which is the hand-kept fees and payments. The free
   * Tournament plan and the Premium Coaches Portal (`team`, no grant) are excluded.
   * ⚠ The plan is not the whole gate: the launch switch in `lib/online-payments-switch.ts` keeps it off in production
   * until counsel signs off.
   */
  | 'online_payments'
  // ── The club scheduler (Club Tier Stage 11a) ─────────────────────────────
  /**
   * The club's schedules — handing the club's shared time (a dome's winter, pitching nights, house league's practice
   * slots) to its teams: parameters in, ranked drafts out, adjusted by hand, finalized, kept by name, sent to staff.
   * League Plus and BOTH Club bands, alike (Decided 2026-10-08, `BUSINESS_DECISIONS.md` ×2; the Facts doc's inclusions):
   * plan choice follows what an organization runs, so it is NEVER an upgrade lever between League Plus and Club, and it
   * is not on a Tournament plan (their own generator is `auto_schedule`) or the standalone Premium Coaches Portal (no
   * grant in PLAN_FEATURE_GRANTS). On League Plus it has no rep team to hand time to until house league joins (11b):
   * the routes answer "nothing to schedule" and the screens hide the door.
   */
  | 'club_scheduler';

export const PLAN_RANK: Record<OrgPlan, number> = {
  tournament:      0,
  team:            0,
  tournament_plus: 1,
  league:          2,
  club:            3,
  club_large:      4,
};

export const FEATURE_MIN_PLAN: Record<PlanFeature, OrgPlan> = {
  // ── Existing features ────────────────────────────────────────────────────
  auto_schedule:                     'tournament_plus',
  playoff_generator:                 'tournament_plus',
  playoff_manual:                    'tournament',
  bulk_reschedule:                   'tournament_plus',
  sealed_archives:                   'tournament_plus',
  advanced_tournament_branding:      'tournament_plus',
  schedule_notification:             'tournament_plus',
  custom_registration_fields:        'tournament_plus',
  registration_export:               'tournament_plus',
  bulk_data_imports:                  'tournament_plus',
  bulk_registration_actions:         'tournament_plus',
  waitlist_collection:               'tournament_plus',
  waitlist_automation:               'tournament_plus',
  tournament_cloning:                'tournament_plus',
  targeted_tournament_announcements: 'tournament_plus',
  post_tournament_summary:           'tournament_plus',
  payment_readiness_tools:           'tournament_plus',
  // ── The open event (invite-only on free) ─────────────────────────────────
  open_registration:                 'tournament_plus',
  payment_tracking:                  'tournament_plus',
  team_check_in:                     'tournament_plus',
  tournament_volunteers:             'tournament_plus',
  // ── Export features (Phase B7) ───────────────────────────────────────────
  // Excel/CSV of the schedule and results, and the public site's live scores, following and install, are free on every
  // plan and carry no key: the six keys that said so were never checked anywhere (review F14, removed 2026-10-16).
  pdf_exports:                       'tournament_plus',
  pdf_template_settings:             'tournament_plus',
  league_exports:                    'league',
  club_exports:                      'club',
  // ── Public fan experience (Phase 2) ──────────────────────────────────────
  fan_score_alerts:                  'tournament_plus',
  // ── Coach Chat ───────────────────────────────────────────────────────────
  tournament_chat:                   'tournament_plus',
  coach_peer_chat:                   'club',
  // ── Club Shared Book ─────────────────────────────────────────────────────
  club_shared_book:                  'club',
  // ── Online payments ───────────────────────────────────────────────────────
  online_payments:                   'tournament_plus',
  // ── The club scheduler ────────────────────────────────────────────────────
  club_scheduler:                    'league',
};

/**
 * Per-plan feature grants that bypass the rank ladder.
 * The per-team Premium "team" plan ranks at the free tier for tournament
 * features, but the paid Coaches Portal explicitly includes PDF exports
 * (roster, schedule, lineup cards, etc.) — and, since the 2026-08-21 packaging
 * decision (BUSINESS_DECISIONS.md), PDF customization too: a standalone team's
 * identity IS its team brand, so the plan that includes the paper includes the
 * "How your documents look" card that brands it. Free Basic coaches are
 * unchanged — no PDF export, so no customization surface.
 *
 * ⚖ A Premium coach's hosted event follows the free plan, whatever free becomes, plus these PDF grants and nothing
 * more (R1, 2026-10-12): `team` is never granted the open-event keys, so its event is invite-only.
 */
const PLAN_FEATURE_GRANTS: Partial<Record<OrgPlan, PlanFeature[]>> = {
  team: ['pdf_exports', 'pdf_template_settings', 'coach_peer_chat'],
};

export function hasPlanFeature(planId: OrgPlan, feature: PlanFeature): boolean {
  if (PLAN_FEATURE_GRANTS[planId]?.includes(feature)) return true;
  return PLAN_RANK[planId] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

/**
 * Whether this plan carries the org-level venue library (`org_venues`). League/Club only —
 * Tournament tiers are standalone events with per-tournament venues. This predicate used to
 * be an inline plan-id array copied across seven files; a plan restructure must only ever
 * need to touch this one.
 */
export function hasOrgVenueLibrary(planId: OrgPlan | null | undefined): boolean {
  return !!planId && ['league', 'club', 'club_large'].includes(planId);
}

/**
 * Returns upgrade copy for any plan feature.
 * Use this in ExportMenu and any new upsell surfaces.
 * Delegates to requiresTournamentPlusCopy() for existing features so callers
 * can migrate to requiresPlanCopy() at their own pace.
 */
export function requiresPlanCopy(feature: PlanFeature): string {
  switch (feature) {
    // ── Export features ───────────────────────────────────────────────────
    case 'pdf_exports':
      return 'PDF exports are included with Tournament Plus, League Plus, and Club.';
    case 'pdf_template_settings':
      return 'Custom PDF headers, logos, and footers are included with Tournament Plus, League Plus, and Club.';
    case 'league_exports':
      return 'Data exports for house league seasons are included with League Plus and Club.';
    case 'club_exports':
      return 'Data exports for rep teams and accounting are included with Club.';
    case 'bulk_data_imports':
      return 'Spreadsheet imports are included with Tournament Plus, League Plus, and Club.';
    // ── Public fan experience ─────────────────────────────────────────────
    case 'fan_score_alerts':
      return 'Live score alerts to fans who follow a team are included with Tournament Plus, League Plus, and Club.';
    case 'tournament_chat':
      return 'Tournament Chat — a live group chat with all your participating coaches — is included with Tournament Plus, League Plus, and Club.';
    case 'coach_peer_chat':
      // Explicit case REQUIRED: both copy helpers forward unknown features to each other, so a
      // missing case here would recurse forever.
      return 'A team staff room — a standing chat for the head coach and assistants — is included with the Premium Coaches Portal and Club.';
    case 'club_shared_book':
      // ⚠ This string should never reach a customer: the ruling is ABSENT, not locked — no
      // surface renders an upsell for it. The case exists because both copy helpers forward
      // unknown features to each other and a missing one recurses forever.
      return 'Teams sharing their opponent scouting books with each other across the club is included with Club.';
    case 'online_payments':
      // Explicit case REQUIRED (the two copy helpers forward unknown features to each other). Reaches a customer only as a
      // server refusal's fallback: the screens hide the door rather than lock it (A6).
      return 'Taking payments online is included with Tournament Plus, League Plus, and Club.';
    case 'club_scheduler':
      // Explicit case REQUIRED (the two copy helpers forward unknown features to each other). ⚠ Never an upgrade lever:
      // League Plus and Club carry it alike, so no surface offers it as a reason to move between them.
      return 'The club scheduler — handing your shared time to your teams — is included with League Plus and Club.';
    // ── The open event (invite-only on free). The screens hide these areas rather than lock them (R5), so a sentence
    //    here reaches a customer only as a server refusal's fallback. Explicit cases REQUIRED (no recursion).
    case 'open_registration':
      return 'Public registration and the review queue are included with Tournament Plus, League Plus, and Club.';
    case 'payment_tracking':
      return 'Fees and payment tracking are included with Tournament Plus, League Plus, and Club.';
    case 'team_check_in':
      return 'Team check-in is included with Tournament Plus, League Plus, and Club.';
    case 'tournament_volunteers':
      return 'The Staff kit and volunteer scorekeepers are included with Tournament Plus, League Plus, and Club.';
    case 'playoff_manual':
      // Free on all tournament plans — safe fallback if called unexpectedly.
      return 'Building playoff brackets by seed is available on all tournament plans. Auto-scheduling and tiered brackets are included with Tournament Plus, League Plus, and Club.';
    case 'bulk_reschedule':
      return 'One-tap rain delay — moving or cancelling a whole day’s games at once, then telling everyone — is included with Tournament Plus, League Plus, and Club. On the free plan you can still reschedule games one at a time and post a rain-delay banner.';
    // ── Existing features — delegate ──────────────────────────────────────
    default:
      return requiresTournamentPlusCopy(feature);
  }
}

/**
 * @deprecated Use requiresPlanCopy() for new code. Kept for backward
 * compatibility — 16 existing callers reference this name and will be
 * migrated in Phase C as each export surface is updated.
 */
export function requiresTournamentPlusCopy(feature: PlanFeature): string {
  switch (feature) {
    case 'auto_schedule':
      return 'The round-robin generator is included with Tournament Plus, League Plus, and Club.';
    case 'playoff_generator':
      return 'The playoff generator is included with Tournament Plus, League Plus, and Club.';
    case 'sealed_archives':
      return 'Permanent sealed archives are included with Tournament Plus, League Plus, and Club.';
    case 'advanced_tournament_branding':
      return 'Full tournament branding control - logos, colors, presets, and public appearance options - is included with Tournament Plus, League Plus, and Club.';
    case 'schedule_notification':
      return 'Email notifications to registered teams are included with Tournament Plus, League Plus, and Club.';
    case 'custom_registration_fields':
      return 'Custom registration questions and file collection are included with Tournament Plus, League Plus, and Club.';
    case 'registration_export':
      return 'Registration CSV export for insurance, check-in, and reporting is included with Tournament Plus, League Plus, and Club.';
    case 'bulk_data_imports':
      return 'Spreadsheet imports are included with Tournament Plus, League Plus, and Club.';
    case 'bulk_registration_actions':
      return 'Updating many registrations at once is included with Tournament Plus, League Plus, and Club.';
    case 'waitlist_collection':
      return 'A waitlist for full divisions is included with Tournament Plus, League Plus, and Club.';
    case 'waitlist_automation':
      return 'Waitlist promotion and queue management are included with Tournament Plus, League Plus, and Club.';
    case 'tournament_cloning':
      return 'Tournament cloning is included with Tournament Plus, League Plus, and Club so repeat events can start from last year\'s setup.';
    case 'targeted_tournament_announcements':
      return 'Targeted tournament announcements by division or registration status are included with Tournament Plus, League Plus, and Club.';
    case 'post_tournament_summary':
      return 'Post-tournament summaries for reporting, sharing, and renewal planning are included with Tournament Plus, League Plus, and Club.';
    case 'payment_readiness_tools':
      return 'Payment tracking dashboards, payment filters, and payment reminder workflows are included with Tournament Plus, League Plus, and Club.';
    default:
      // New export features — forward to requiresPlanCopy to avoid duplication
      return requiresPlanCopy(feature);
  }
}
