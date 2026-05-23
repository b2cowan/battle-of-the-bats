export const TOURNAMENT_PLUS_EVENT_TYPES = [
  'tournament_plus_upgrade_gate_viewed',
  'tournament_plus_upgrade_gate_clicked',
  'tournament_plus_acquisition_cta_viewed',
  'tournament_plus_acquisition_cta_clicked',
  'tournament_plus_feature_used',
] as const;

export type TournamentPlusEventType = typeof TOURNAMENT_PLUS_EVENT_TYPES[number];

export const TOURNAMENT_PLUS_LOCKED_FEATURES = [
  'advanced_tournament_branding',
  'custom_registration_fields',
  'registration_export',
  'waitlist_automation',
  'tournament_cloning',
  'targeted_tournament_announcements',
  'post_tournament_summary',
  'payment_readiness_tools',
  'online_tournament_payments',
] as const;

export type TournamentPlusLockedFeature = typeof TOURNAMENT_PLUS_LOCKED_FEATURES[number];

export const TOURNAMENT_PLUS_ACQUISITION_SOURCES = [
  'public_powered_by_badge',
  'public_tournament_banner',
  'registration_confirmation',
  'post_event_results_email',
  'coach_portal_banner',
  'post_tournament_summary',
] as const;

export type TournamentPlusAcquisitionSource = typeof TOURNAMENT_PLUS_ACQUISITION_SOURCES[number];

export const TOURNAMENT_PLUS_MARKETING_SURFACES = [
  'public_home',
  'public_pricing',
  'signup_plan_selection',
  'onboarding_plan_selection',
  'admin_billing',
  'admin_upgrade_gate',
  'platform_admin_support',
  'help_docs',
  'email_template',
] as const;

export type TournamentPlusMarketingSurface = typeof TOURNAMENT_PLUS_MARKETING_SURFACES[number];
