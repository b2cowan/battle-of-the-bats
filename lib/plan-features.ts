import type { OrgPlan } from './types';

export type PlanFeature =
  // ── Existing features ────────────────────────────────────────────────────
  | 'auto_schedule'
  | 'playoff_generator'
  /** Manual playoff bracket building (structure + by-seed placement + manual scheduling) — free on all tournament plans. The auto-schedule optimizer + tiered auto-split remain `playoff_generator`. */
  | 'playoff_manual'
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
  | 'online_tournament_payments'
  // ── Export feature keys (Phase B7) ───────────────────────────────────────
  /** xlsx/CSV tournament schedule export — free on all plans */
  | 'schedule_xlsx_export'
  /** xlsx/CSV tournament results export — free on all plans */
  | 'results_xlsx_export'
  /** iCal export for any schedule surface — free on all plans */
  | 'ical_export'
  /** PDF generation on any export surface — tournament_plus and above */
  | 'pdf_exports'
  /** Custom PDF header/footer/logo via PDF Settings admin page — tournament_plus+ */
  | 'pdf_template_settings'
  /** All export formats for house league module — league and above */
  | 'league_exports'
  /** All export formats for rep teams + accounting module — club only */
  | 'club_exports'
  /** Multi-sheet combined workbook (registrations + schedule + results) — tournament_plus+ */
  | 'bulk_operational_workbook'
  // ── Public fan experience (Phase 2) ──────────────────────────────────────
  /** Real-time public-page refresh on game day — free on all plans */
  | 'live_score_refresh'
  /** Anonymous fan "follow a team" — free on all plans */
  | 'fan_following'
  /** PWA install prompts on public pages — free on all plans */
  | 'pwa_install'
  /** Anonymous fan push score alerts — tournament_plus and above (the signature halo feature) */
  | 'fan_score_alerts';

export const PLAN_RANK: Record<OrgPlan, number> = {
  tournament:      0,
  team:            0,
  tournament_plus: 1,
  league:          2,
  club:            3,
};

export const FEATURE_MIN_PLAN: Record<PlanFeature, OrgPlan> = {
  // ── Existing features ────────────────────────────────────────────────────
  auto_schedule:                     'tournament_plus',
  playoff_generator:                 'tournament_plus',
  playoff_manual:                    'tournament',
  sealed_archives:                   'tournament_plus',
  advanced_tournament_branding:      'tournament_plus',
  schedule_notification:             'tournament_plus',
  custom_registration_fields:        'tournament_plus',
  registration_export:               'tournament_plus',
  bulk_data_imports:                  'tournament_plus',
  bulk_registration_actions:         'tournament',
  waitlist_collection:                'tournament',
  waitlist_automation:               'tournament_plus',
  tournament_cloning:                'tournament_plus',
  targeted_tournament_announcements: 'tournament_plus',
  post_tournament_summary:           'tournament_plus',
  payment_readiness_tools:           'tournament_plus',
  online_tournament_payments:        'tournament_plus',
  // ── Export features (Phase B7) ───────────────────────────────────────────
  schedule_xlsx_export:              'tournament',
  results_xlsx_export:               'tournament',
  ical_export:                       'tournament',
  pdf_exports:                       'tournament_plus',
  pdf_template_settings:             'tournament_plus',
  league_exports:                    'league',
  club_exports:                      'club',
  bulk_operational_workbook:         'tournament_plus',
  // ── Public fan experience (Phase 2) ──────────────────────────────────────
  live_score_refresh:                'tournament',
  fan_following:                     'tournament',
  pwa_install:                       'tournament',
  fan_score_alerts:                  'tournament_plus',
};

export function hasPlanFeature(planId: OrgPlan, feature: PlanFeature): boolean {
  return PLAN_RANK[planId] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
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
    case 'bulk_operational_workbook':
      return 'Full tournament export workbooks (registrations, schedule, and results in one file) are included with Tournament Plus, League Plus, and Club.';
    case 'bulk_data_imports':
      return 'Spreadsheet imports are included with Tournament Plus, League Plus, and Club.';
    case 'schedule_xlsx_export':
    case 'results_xlsx_export':
    case 'ical_export':
      // Free on all plans — this copy should not appear in practice, but
      // provides a safe fallback if called unexpectedly.
      return 'Schedule, results, and calendar exports are available on all plans.';
    // ── Public fan experience ─────────────────────────────────────────────
    case 'fan_score_alerts':
      return 'Live score alerts to fans who follow a team are included with Tournament Plus, League Plus, and Club.';
    case 'live_score_refresh':
    case 'fan_following':
    case 'pwa_install':
      // Free on all plans — safe fallback if called unexpectedly.
      return 'Live public pages, team following, and home-screen install are available on all plans.';
    case 'playoff_manual':
      // Free on all tournament plans — safe fallback if called unexpectedly.
      return 'Building playoff brackets by seed is available on all tournament plans. Auto-scheduling and tiered brackets are included with Tournament Plus, League Plus, and Club.';
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
      return 'Automated schedule generation is included with Tournament Plus, League Plus, and Club.';
    case 'playoff_generator':
      return 'The playoff bracket generator is included with Tournament Plus, League Plus, and Club.';
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
      return 'Basic selected-row registration updates are available on all tournament plans.';
    case 'waitlist_collection':
      return 'Overflow waitlist collection is available on all tournament plans.';
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
    case 'online_tournament_payments':
      return 'Online tournament entry fee and deposit collection is planned as a Tournament Plus, League Plus, and Club workflow.';
    default:
      // New export features — forward to requiresPlanCopy to avoid duplication
      return requiresPlanCopy(feature);
  }
}
