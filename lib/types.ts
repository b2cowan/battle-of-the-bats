export type OrgPlan = 'tournament' | 'team' | 'tournament_plus' | 'league' | 'club';

// ── Tournament scope types ────────────────────────────────────────────────────
/** How game timing (duration + buffer) is managed across divisions. */
export type GameTimingScope = 'tournament' | 'allow_override' | 'per_division';
/** How tie-breaker rules are managed across divisions. */
export type TieBreakerScope = 'tournament' | 'allow_override' | 'per_division';
/** How registration fees are managed across divisions. 'free' = no payment tracking. */
export type FeeScope = 'tournament' | 'allow_override' | 'per_division' | 'free';
export type OrgAccountKind = 'organization' | 'team_workspace';
export type TeamWorkspaceStatus = 'active' | 'linked' | 'org_owned' | 'archived';
export type OrgRole = 'owner' | 'admin' | 'staff' | 'official' | 'league_admin' | 'league_registrar' | 'treasurer' | 'coach';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
export type TournamentStatus = 'draft' | 'active' | 'completed' | 'archived';
export type PublicPageKey = 'news' | 'schedule' | 'standings' | 'teams' | 'rules' | 'register';
/**
 * Tournament structure. 'round_robin_playoffs' (default) = the standard round
 * robin → playoffs flow (bracket seeds from standings). 'playoff_only' =
 * bracket-only: no round robin, the organizer seeds teams directly into the
 * first round (resolved at bracket creation).
 */
export type TournamentFormat = 'round_robin_playoffs' | 'playoff_only';

/**
 * Organizer-defined thresholds that determine what a "healthy" schedule is, edited
 * inline from the Schedule Health panel. Drives the health score, the same-day /
 * back-to-back / target warnings, and seeds the auto-Generator's per-day default.
 * Absent fields fall back to engine defaults (2 / 15 / no target). See lib/schedule-metrics.ts.
 */
export interface ScheduleHealthRules {
  /** Flag a team scheduled for more than this many games on a single day. Default 2. */
  maxGamesPerDay?: number;
  /** A team's consecutive games closer than this (minutes) count as back-to-back. Default 15. */
  minRestMinutes?: number;
  /** Target games per team; teams under/over are flagged. null/absent = no target (default). */
  targetGamesPerTeam?: number | null;
}

/**
 * Per-tournament display/behaviour preferences stored as JSONB in tournaments.settings.
 * Add new optional keys here as features require them — no migration needed for new keys.
 */
export interface TournamentSettings {
  /**
   * Tournament structure. Absent/`'round_robin_playoffs'` = standard round robin →
   * playoffs; `'playoff_only'` = bracket-only (no round robin; organizer seeds the
   * bracket directly). See lib/playoff-bracket.ts + lib/tournament-phase.ts helpers.
   */
  format?: TournamentFormat;
  /** Public rules page layout for the rule-section grid. Default: 'columns' (2-col). */
  rulesLayout?: 'columns' | 'single';
  /** Public rules page layout for the resources list. Default: 'list' (stacked). */
  resourcesLayout?: 'list' | 'grid';
  /**
   * Default game duration in minutes for all divisions in this tournament.
   * Individual divisions may override this via DivisionSettings. Default: 90.
   */
  game_duration_minutes?: number;
  /**
   * Minimum gap (in minutes) required between consecutive games at the same venue/facility.
   * Buffer-zone violations are soft warnings; true overlap is a hard block. Default: 15.
   */
  buffer_minutes?: number;
  /**
   * Organizer-entered estimate for how much rest a team should have when it changes parent venues.
   * This is a no-cost manual buffer; it is not calculated from maps or drive-time APIs.
   */
  schedule_travel_venue_buffer_minutes?: number;
  /**
   * Organizer-entered estimate for how much rest a team should have when it changes facilities inside a venue.
   */
  schedule_travel_facility_buffer_minutes?: number;
  /**
   * Organizer-defined "healthy schedule" thresholds, edited inline from the Schedule
   * Health panel (max games/day, min rest, target games/team). See ScheduleHealthRules.
   */
  schedule_health_rules?: ScheduleHealthRules;

  // ── Scope controls (Phase 2 — Divisions UX Rework) ─────────────────────────
  /**
   * How game timing is configured. null = not yet decided (blocks activation).
   * 'tournament' = one value for all divisions.
   * 'allow_override' = tournament default, divisions may override.
   * 'per_division' = each division must set its own value.
   */
  game_timing_scope?: GameTimingScope | null;
  /**
   * Tournament-level tie-breaker priority order. Used when tie_breaker_scope is
   * 'tournament' or 'allow_override'. Divisions may store their own override in
   * division.playoffConfig.tieBreakers. May be a SUBSET (organizers can add/remove
   * breakers) and may include 'coin' (Coin Toss — terminal, admin-resolved).
   * See lib/tie-breakers.ts for the canonical vocabulary.
   */
  tie_breakers?: import('./tie-breakers').TieBreaker[];
  /**
   * How tie-breaker rules are configured. null = not yet decided (blocks activation).
   */
  tie_breaker_scope?: TieBreakerScope | null;
  /**
   * Tournament-level cap on a single game's run differential when ranking
   * standings. A positive integer caps each game's Run Diff contribution
   * (e.g. cap 7 → a 14-0 win counts as +7); null/absent/0 = no cap. Caps the
   * RD column ONLY — Runs For / Runs Against keep the real totals, so RF − RA
   * may not equal the displayed RD when a cap is active. Divisions may override
   * via division.playoffConfig.maxRunDiffPerGame (governed by tie_breaker_scope).
   */
  max_run_diff_per_game?: number | null;
  /**
   * How registration fees are configured. null = not yet decided (blocks activation).
   * 'free' = organizer explicitly chose no payment tracking (valid confirmed state).
   */
  fee_scope?: FeeScope | null;

  // ── Public registration payment display ────────────────────────────────────
  /**
   * Public registration form: when `false`, the fee/payment panel is hidden on the
   * public register page even if a fee schedule is set (the organizer still tracks
   * fees in admin). Absent/`true` = show (preserves legacy behaviour). Set from
   * Event Settings → Fee Schedule.
   */
  show_fees_on_register?: boolean;
  /**
   * Organizer-authored "how to pay" instructions (e.g. e-transfer details, cheque
   * payable-to, deadline mechanics). Included in the acceptance email when set; also
   * rendered on the public register form when `payment_instructions_on_form` is true.
   */
  payment_instructions?: string;
  /**
   * When `true`, `payment_instructions` also render on the public register form.
   * Absent/`false` = instructions appear only in the acceptance email (the default
   * delivery channel — how these are typically sent).
   */
  payment_instructions_on_form?: boolean;

  // ── Automatic coach emails ─────────────────────────────────────────────────
  // Per-tournament on/off switches for the transactional emails sent automatically
  // to a team's coach/contact. Absent/`true` = enabled (legacy behaviour); only an
  // explicit `false` disables. Read via `coachEmailEnabled()` (lib/email.ts), set
  // from Event Settings → Notifications & Contact. Do not gate the org-admin
  // notifications or the manual send tools (announcements, payment reminders, resend
  // access) — these keys only govern the automatic coach emails. The master
  // `coach_email_pause_all` (below) overrides every per-type key when on.
  /** Registration confirmation / waitlist receipt sent when a coach submits a registration. */
  coach_email_confirmation?: boolean;
  /** "Team accepted" email sent when a team's status changes to accepted. */
  coach_email_acceptance?: boolean;
  /** "Registration declined" email sent when a team's status changes to rejected. */
  coach_email_rejection?: boolean;
  /** "Payment recorded" email sent when a team's payment_status changes to paid. */
  coach_email_payment?: boolean;
  /** "Schedule published" email sent to accepted teams when the organizer publishes a schedule. */
  coach_email_schedule?: boolean;
  /** Game-day reminder (Phase 5m) scheduled the evening before a team's first game. Still bypasses the org marketing opt-out, but the organizer can disable it here (5n). */
  coach_email_game_day?: boolean;
  /**
   * Master kill-switch (Phase 5n): when `true`, suppresses ALL automatic coach-facing
   * emails for this tournament — the per-type keys above AND the post-event results email.
   * The organizer is handling coach communication manually; there is NO transactional
   * carve-out. Default OFF (absent/`false` = not paused). OPPOSITE polarity from the per-type
   * keys (`true` DISABLES). Read via `coachEmailsPaused`/`coachEmailEnabled` (lib/email.ts).
   */
  coach_email_pause_all?: boolean;

  // ── Roster requirements (Phase 5 — tournament coach experience) ────────────
  // What an accepted team must provide when it submits its event roster from the
  // Coaches Portal. Authored in Event Settings → Roster Requirements. These apply
  // ONLY to the per-event submission (tournament_roster_players) — they never add
  // required fields to a coach's master roster (basic_coach_team_players stays
  // identity-only, DOB consent-gated). Defaults are all OFF/absent: legacy
  // tournaments require nothing; only an explicit `true`/number activates a
  // requirement. Note: opposite polarity from the coach_email_* keys above
  // (those treat absent as enabled).
  /** Require accepted teams to submit an event roster. When false/absent the coach checklist shows no Roster item and none of the keys below apply. */
  roster_require?: boolean;
  /** Require a date of birth per player on the submitted roster (written to the event snapshot only — never back to the master roster). */
  roster_require_dob?: boolean;
  /** Require a jersey number per player on the submitted roster. */
  roster_require_jersey?: boolean;
  /** Require a waiver acknowledgment checkbox at submit (V1 stores no waiver document). */
  roster_require_waiver?: boolean;
  /**
   * Organizer-authored statement the coach ticks agreement to when
   * `roster_require_waiver` is on (max 2000 chars). Absent/'' = the shared
   * default acknowledgment (DEFAULT_ROSTER_WAIVER_TEXT, lib/roster-requirements.ts).
   */
  roster_waiver_text?: string;
  /**
   * Minimum players on a submitted roster (1–99). null/absent = no minimum.
   * ⚠ min>max IS storable (Event Settings warns but still auto-saves, and the
   * merge-patch API validates each key independently) — readers (5k submit
   * gating) MUST treat min>max as no-minimum (max wins), never as an
   * unsatisfiable gate that would block every submission.
   */
  roster_min_players?: number | null;
  /** Maximum players on a submitted roster (1–99). null/absent = no maximum. See roster_min_players for the min>max rule. */
  roster_max_players?: number | null;
}

/**
 * Per-division settings stored as JSONB in divisions.settings.
 * When set, these override the parent tournament's settings for conflict detection.
 * Add new optional keys here as features require them — no migration needed for new keys.
 */
export interface DivisionSettings {
  /**
   * Game duration override for this division (minutes).
   * If omitted, inherits from TournamentSettings.game_duration_minutes or system default (90).
   */
  game_duration_minutes?: number;
  /**
   * Buffer override for this division (minutes).
   * If omitted, inherits from TournamentSettings.buffer_minutes or system default (15).
   */
  buffer_minutes?: number;
}

/**
 * Free-floor entitlement profile on an org (NULL = none). A free floor contributes extra module
 * entitlements + server-side caps on top of the paid `planId` — it is NOT a new OrgPlan key.
 * `league_starter` = the capped free house-league floor (Free Tier Phase 6, migration 125).
 * Forward-compatible with a future `'tournament_free'`. See lib/free-floor.ts.
 */
export type FreeFloor = 'league_starter' | null;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  planId: OrgPlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPeriod?: 'monthly' | 'annual';
  currentPeriodEnd?: string | null;
  repTeamSubscriptionItemId?: string | null;
  tournamentLimit: number;
  isPublic: boolean;
  createdAt: string;
  themePreset?: string;
  themePrimary?: string;
  themeAccent?: string;
  heroBannerUrl?: string;
  themeFont?: string;       // 'system' | 'inter' | 'barlow' | 'dm-serif'
  themeCardStyle?: string;  // 'default' | 'glass' | 'outlined' | 'flat'
  requireScoreFinalization?: boolean;
  onboardingCompletedAt?: string | null;
  enabledAddons: string[];
  contactEmail?: string | null;
  accountKind: OrgAccountKind;
  teamWorkspaceStatus?: TeamWorkspaceStatus | null;
  isDiscoverable: boolean;
  /** Free-floor entitlement profile (NULL/undefined = none). See FreeFloor + lib/free-floor.ts. */
  freeFloor?: FreeFloor;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  invitedAt: string;
  acceptedAt?: string;
}

export interface Tournament {
  id: string;
  organizationId?: string;   // FK → organizations (nullable during migration)
  year: number;        // e.g. 2026
  name: string;        // e.g. "Spring Classic 2026"
  slug: string;        // URL-safe identifier; unique per org among non-archived
  status: TournamentStatus;
  isActive: boolean;   // derived: status === 'active'. Kept for compatibility.
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;      // YYYY-MM-DD
  contactEmail?: string; // shown in coach-facing email footers
  feeScheduleMode?: 'tournament' | 'division';
  depositAmount?: number | null;
  depositDueDate?: string | null;   // YYYY-MM-DD
  totalFeeAmount?: number | null;
  totalFeeDueDate?: string | null;  // YYYY-MM-DD
  // Per-tournament branding (overrides org-level when set)
  logoUrl?: string | null;
  heroBannerUrl?: string | null;
  themePreset?: string | null;
  themePrimary?: string | null;
  themeAccent?: string | null;
  themeFont?: string | null;
  themeCardStyle?: string | null;
  colorMode?: 'dark' | 'light' | null;
  publicHiddenPages?: PublicPageKey[];
  requireScoreFinalization?: boolean | null;
  notifyTeamsOnComplete?: boolean;
  resultsNotifiedAt?: string | null;
  resultsNotificationSentCount?: number;
  /** Per-tournament display/behaviour preferences. See TournamentSettings. */
  settings?: TournamentSettings;
}

// ---------------------------------------------------------------------------
// Venue hierarchy — Venue (facility) → VenueFacility (playing surface)
// ---------------------------------------------------------------------------

export type FacilityType = 'diamond' | 'field' | 'court' | 'rink' | 'gym' | 'other';

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  diamond: 'Diamond',
  field:   'Field',
  court:   'Court',
  rink:    'Rink',
  gym:     'Gym',
  other:   'Other',
};

export const FACILITY_TYPES: FacilityType[] = ['diamond', 'field', 'court', 'rink', 'gym', 'other'];

/** A playing surface within a tournament venue (e.g. "Diamond 1", "Rink North"). */
export interface VenueFacility {
  id: string;
  venueId: string;
  tournamentId: string;
  name: string;                    // free text: "Diamond 1", "Court Sigma"
  facilityType: FacilityType;
  displayOrder: number;
  notes?: string;
  sourceOrgFacilityId?: string;    // set when imported from org venue library
  gameCount?: number;              // games linked to this facility (set when fetched withGameCounts)
  playedGameCount?: number;        // of those, games with a recorded result (completed/submitted)
}

/** A physical venue/facility location within a tournament (e.g. "Lions Park"). */
export interface Venue {
  id: string;
  tournamentId: string;
  name: string;                    // facility name: "Lions Park"
  address?: string;                // full address for Google Maps
  notes?: string;                  // facility-level notes
  sourceOrgVenueId?: string;       // set when imported from org venue library
  facilities?: VenueFacility[];    // populated when fetched with includeFacilities option
  gameCount?: number;              // games linked to this venue (set when fetched withGameCounts)
  playedGameCount?: number;        // of those, games with a recorded result (completed/submitted)
}

/** A temporary schedule resource that can later be mapped to a real venue/facility. */
export interface ScheduleFacilityLane {
  id: string;
  tournamentId: string;
  divisionId: string;
  label: string;
  sortOrder: number;
  resolvedVenueId?: string | null;
  resolvedVenueFacilityId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** A playing surface within an org venue library entry. */
export interface OrgVenueFacility {
  id: string;
  orgVenueId: string;
  orgId: string;
  name: string;
  facilityType: FacilityType;
  displayOrder: number;
  notes?: string;
}

/** An org-level venue library entry (persists across tournaments). */
export interface OrgVenue {
  id: string;
  orgId: string;
  name: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  facilities?: OrgVenueFacility[];
}

export interface PlayoffConfig {
  type: 'single';
  /**
   * Bracket elimination format (unified bracket engine — see lib/playoff-bracket.ts).
   * 'single' = single elimination (default), 'consolation' = single elim + a
   * consolation bracket so no team is eliminated after one game (2-game
   * guarantee), 'double' = double elimination. Absent = 'single' (legacy).
   */
  format?: 'single' | 'consolation' | 'double' | 'placement';
  /** Double elimination only: include the if-necessary grand-final reset game. Default true. */
  grandFinalReset?: boolean;
  /**
   * How qualifying teams map into bracket(s):
   * - 'standard' — 2-pool crossover (interleaved pool labels)
   * - 'reseed'   — single bracket, global reseed (Seed #1..N)
   * - 'none'     — one independent bracket per pool (requires ≥2 pools)
   * - 'tiers'    — split ONE division's overall standings into N contiguous
   *                tiered brackets (see tierConfigs). Each tier is independent
   *                and self-seeded from global standings (no cross-tier movement).
   */
  crossover: 'standard' | 'reseed' | 'none' | 'tiers';
  hasThirdPlace: boolean;
  teamsQualifying: number;
  /**
   * Per-division tie-breaker priority order (overrides the tournament order when set).
   * May be a SUBSET and may include 'coin'. See lib/tie-breakers.ts.
   */
  tieBreakers: import('./tie-breakers').TieBreaker[];
  /**
   * Per-division override for the run-diff-per-game cap. A positive integer caps
   * each game's Run Diff contribution; null/absent = inherit the tournament-level
   * TournamentSettings.max_run_diff_per_game (or no cap). Caps the RD column only.
   */
  maxRunDiffPerGame?: number | null;
  /**
   * Admin-recorded coin-toss results, used when 'coin' is the deciding breaker.
   * Keyed by lib/tie-breakers.coinTossKey(tiedTeamIds) (the SORTED set of the
   * tied teams' ids joined by '|'); the value is the organizer's finishing order
   * for that group (team ids, best → worst). Self-invalidates if the tied set
   * changes, because the key no longer matches.
   */
  coinTossResults?: Record<string, string[]>;
  splitConfigs?: Record<string, { teamsQualifying: number; hasThirdPlace: boolean }>;
  /**
   * Tiered-bracket definitions (crossover === 'tiers'). Each tier covers a
   * contiguous range of OVERALL seeds [fromSeed..toSeed] (1-based) and becomes
   * its own bracket. Ranges must be contiguous (no gaps/overlaps) starting at 1,
   * names unique. Per-tier format/options fall back to the top-level config.
   */
  tierConfigs?: PlayoffTierConfig[];
}

export interface PlayoffTierConfig {
  /** Display name + grouping key, e.g. "Tier 1" / "Gold". Must be unique. */
  name: string;
  /** First overall seed in this tier (1-based, inclusive). */
  fromSeed: number;
  /** Last overall seed in this tier (1-based, inclusive). */
  toSeed: number;
  format?: 'single' | 'consolation' | 'double' | 'placement';
  hasThirdPlace?: boolean;
  grandFinalReset?: boolean;
}

export interface BracketSlot {
  id: string;
  seedLabel: string;       // "Seed #1", "1st Pool A", or team name
  teamId?: string;         // Resolved team ID (null until seeded)
  isBye: boolean;
}

export interface BracketMatchup {
  id: string;
  roundIndex: number;
  position: number;        // Vertical position within the round
  bracketCode: string;     // "QF1", "SF2", "FIN", etc.
  homeSlot: BracketSlot;
  awaySlot: BracketSlot;
  winnersTo?: string;      // bracketCode of next matchup for winner
  losersTo?: string;       // bracketCode for consolation/3rd place
}

export interface BracketConfig {
  rounds: {
    name: string;          // "Quarterfinals", "Semifinals", etc.
    matchups: BracketMatchup[];
  }[];
  consolation: BracketMatchup[];  // 3rd place / consolation bracket
}

export interface Division {
  id: string;
  tournamentId: string;
  name: string; // e.g. "U11"
  minAge: number | null;
  maxAge: number | null;
  order: number;
  contactMemberId?: string | null; // FK to organization_members
  isClosed?: boolean; // if true, public registration is disabled
  capacity?: number;  // threshold for waitlist
  /** Number of accepted teams in this division. Populated by admin divisions API; may be absent in other contexts. */
  acceptedCount?: number;
  poolCount?: number;
  poolNames?: string; // (Legacy) Comma separated
  requiresPoolSelection?: boolean; // if true, user picks pool during registration
  pools?: Pool[]; // The new way
  playoffConfig?: PlayoffConfig;
  depositAmount?: number | null;
  depositDueDate?: string | null;
  totalFeeAmount?: number | null;
  totalFeeDueDate?: string | null;
  scheduleVisibility?: 'unpublished' | 'published_generic' | 'published_teams';
  /** Per-division game timing overrides. See DivisionSettings. */
  settings?: DivisionSettings;
}

export interface Pool {
  id: string;
  divisionId: string;
  name: string;
  order: number;
  /** Per-pool settings. Reserved for future use. */
  settings?: Record<string, unknown>;
}

export interface PoolSlot {
  id: string;
  poolId: string;
  tournamentId: string;
  divisionId: string;
  slotNumber: number;
  displayName: string;  // e.g. "Pool A Team 1"
  teamId?: string | null;
  teamName?: string;    // joined from teams for display convenience
}

export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
}

/** Game-day arrival state for a tournament team (migration 110). */
export type CheckInStatus = 'not_arrived' | 'checked_in' | 'no_show';

/**
 * A tournament team's roster player (migration 110, `tournament_roster_players`).
 * Coach-submitted ahead of game day or captured at the gate. Replaces the vestigial
 * `teams.players` jsonb / `Player[]` for tournaments.
 */
export interface RosterPlayer {
  id: string;
  teamId: string;
  tournamentId: string;
  orgId: string;
  name: string;
  jerseyNumber?: string | null;
  dateOfBirth?: string | null; // YYYY-MM-DD
  position?: string | null;
  notes?: string | null;
  source: 'coach' | 'gate' | 'admin';
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Team {
  id: string;
  tournamentId: string;
  divisionId: string;
  name: string;
  coach: string;
  email: string;
  status: 'pending' | 'accepted' | 'waitlist' | 'rejected';
  paymentStatus: 'pending' | 'paid';
  registeredAt: string;
  adminNotes?: string;
  poolId?: string; // The new way (link to pools table)
  waitlistPosition?: number | null;
  slotId?: string | null;
  /** Optional organizer-assigned seed number within the division (1 = top seed). Null = unseeded. */
  seed?: number | null;
  // ── Game-day check-in (migration 110) — optional; populated by the check-in API ──
  checkInStatus?: CheckInStatus;
  checkedInAt?: string | null;
  checkedInByUserId?: string | null;
  checkedInByName?: string | null;
  rosterSubmittedAt?: string | null;
  rosterConfirmedAt?: string | null;
  paymentCollectedAt?: string | null;
  checkInNotes?: string | null;
}

export type TournamentRegistrationFieldType =
  | 'short_text'
  | 'long_text'
  | 'dropdown'
  | 'checkbox'
  | 'file';

export interface TournamentRegistrationField {
  id: string;
  tournamentId: string;
  orgId: string;
  label: string;
  fieldType: TournamentRegistrationFieldType;
  options: string[];
  required: boolean;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentRegistrationFieldAnswer {
  id: string;
  registrationId: string;
  fieldId: string;
  valueText: string | null;
  valueJson: unknown;
  fileUrl: string | null;
  createdAt: string;
  field?: TournamentRegistrationField;
}

export type GameStatus = 'scheduled' | 'submitted' | 'completed' | 'cancelled';
export type ScoreSubmissionSource = 'scorekeeper' | 'admin_results' | 'system';

export interface Game {
  id: string;
  tournamentId: string; // which tournament year this game belongs to
  divisionId: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string; // ISO date string YYYY-MM-DD
  time: string; // HH:MM
  /** Optional per-game length (minutes). Null/undefined = resolved default (division → tournament → 90). */
  durationMinutes?: number | null;
  location: string;          // display name (kept for backward compat)
  venueId?: string;          // links to a managed Venue record (diamonds.id)
  venueFacilityId?: string;  // links to a venue_facilities record
  scheduleFacilityLaneId?: string | null; // temporary generation lane, if venue is TBD
  scheduleFacilityLaneLabel?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status: GameStatus;
  isPlayoff?: boolean;
  generatorLocked?: boolean;
  bracketId?: string;
  bracketCode?: string;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  homeSlotId?: string;   // FK to pool_slots — set for slot-based games
  awaySlotId?: string;
  notes?: string;
  scoreSubmittedByUserId?: string | null;
  scoreSubmittedByEmail?: string | null;
  scoreSubmittedAt?: string | null;
  scoreSubmissionSource?: ScoreSubmissionSource | null;
}

export interface Announcement {
  id: string;
  tournamentId: string;
  title: string;
  body: string;
  date: string; // ISO date string
  pinned: boolean;
  divisionIds?: string[] | null; // null = all divisions
}

/** Unified communication record — can be a site post, an email send, or both. */
export interface Communication {
  id: string;
  tournamentId: string;
  title: string;
  body: string;
  pinned: boolean;
  divisionIds: string[] | null;
  channelSite: boolean;
  channelEmail: boolean;
  emailTargeting: Record<string, unknown> | null;
  emailRecipientCount: number | null;
  emailSuccessCount: number | null;
  emailFailedCount: number | null;
  emailFailedAddresses: string[] | null;
  emailSentAt: string | null;
  sentByEmail: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface RuleSection {
  id: string;
  tournamentId: string;
  title: string;
  icon?: string;
  order: number;
  items: RuleItem[];
  divisionIds?: string[] | null; // null = all divisions
}

export interface RuleItem {
  id: string;
  ruleId: string;
  content: string;
  order: number;
}

export interface Resource {
  id: string;
  tournamentId: string;
  label: string;
  url: string;
  order: number;
}

export interface OrgPublicSiteContent {
  id: string;
  orgId: string;
  tagline: string | null;
  description: string | null;
  contactEmail: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialX: string | null;
  socialWebsite: string | null;
  showUpcomingTournaments: boolean;
  showArchivesLink: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Accounting Module ─────────────────────────────────────────────────────────

export type AccountingEntityType = 'org' | 'tournament' | 'team' | 'league_season';
export type AccountingEntryType  = 'income' | 'expense' | 'transfer_in' | 'transfer_out';
export type AccountingEntryStatus = 'pending' | 'posted' | 'void';

export interface OrgPayee {
  id: string;
  orgId: string;
  teamId: string | null;   // null = org-wide; set = team-scoped
  name: string;
  notes: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface AccountingLedger {
  id: string;
  orgId: string;
  entityType: AccountingEntityType;
  entityId: string | null;
  name: string;
  currency: string;
  isArchived: boolean;
  createdAt: string;
}

export interface AccountingEntry {
  id: string;
  ledgerId: string;
  entryDate: string;          // ISO date string YYYY-MM-DD
  description: string;
  amount: number;             // always positive; entry_type gives direction
  entryType: AccountingEntryType;
  status: AccountingEntryStatus;
  category: string | null;
  linkedEntryId: string | null;
  sourceModule: string | null;
  sourceEntityId: string | null;
  paymentMethod: string | null;
  payeeId: string | null;
  payeePayer: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerSummary {
  ledger: AccountingLedger;
  postedIncome: number;
  postedExpenses: number;
  pendingIncome: number;
  pendingExpenses: number;
  netPosted: number;
  incomeOnly: number;    // income entries only — for org-level totals that exclude inter-ledger transfers
  expensesOnly: number;  // expense entries only — counterpart to incomeOnly
}

export interface TournamentArchive {
  id: string;
  tournamentId: string | null;  // null if source tournament was deleted post-seal
  orgId: string;
  tournamentName: string;
  season: string;               // String year, e.g. "2026"
  division?: string;            // Comma-separated division names
  finalSnapshot: {
    tournament: Tournament;
    divisions: Division[];
    teams: Team[];
    games: Game[];
  };
  winnerTeamId?: string;
  winnerTeamName?: string;
  runnerUpName?: string;
  totalTeams?: number;
  totalGames?: number;
  integrityHash: string;
  sealedAt: string;
  sealedBy?: string;
}

// ── House League Module ───────────────────────────────────────────────────────

export type LeagueSeasonStatus =
  | 'draft' | 'registration_open' | 'registration_closed'
  | 'active' | 'completed' | 'archived';

export type LeagueRegistrationStatus =
  | 'pending_review' | 'active' | 'waitlisted' | 'declined' | 'withdrawn';

export type LeagueGameStatus =
  | 'scheduled' | 'completed' | 'cancelled' | 'postponed';

export interface LeagueDraftPick {
  round: number;
  pickNumber: number;
  teamId: string;
  registrationId: string;
}

export interface LeagueDraftState {
  draftId: string;
  divisionId: string;
  round: number;
  pickNumber: number;
  currentTeamId: string;
  pickOrder: string[];
  picks: LeagueDraftPick[];
}

export interface LeagueSeason {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  sport: string;
  division: string | null;
  status: LeagueSeasonStatus;
  description: string | null;
  registrationFee: number | null;
  autoGenerateFees: boolean;
  autoApproveUnderCapacity: boolean;
  autoPromoteWaitlist: boolean;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  waiverText: string | null;
  draftState: LeagueDraftState | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueDivision {
  id: string;
  seasonId: string;
  name: string;
  capacity: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface LeagueTeam {
  id: string;
  seasonId: string;
  divisionId: string;
  name: string;
  color: string | null;
  coachName: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface LeagueRegistration {
  id: string;
  seasonId: string;
  divisionId: string | null;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth: string | null;
  playerJerseyPref: string | null;
  playerPositionPref: string | null;
  playerNotes: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string | null;
  status: LeagueRegistrationStatus;
  waitlistPosition: number | null;
  teamId: string | null;
  registrationFeePaid: boolean;
  feeEntryId: string | null;
  adminNotes: string | null;
  source: 'public_form' | 'admin_manual';
  registeredAt: string;
  updatedAt: string;
}

export interface LeagueGame {
  id: string;
  seasonId: string;
  divisionId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string | null;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: LeagueGameStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeaguePracticeStatus = 'scheduled' | 'cancelled';

export interface LeaguePractice {
  id: string;
  seasonId: string;
  divisionId: string | null;
  teamId: string;
  scheduledAt: string | null;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  status: LeaguePracticeStatus;
  recurrenceGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Computed standings row per team within a division
export interface LeagueStandingsRow {
  team: LeagueTeam;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;      // W=2, T=1, L=0
  runsFor: number;
  runsAgainst: number;
  runDifferential: number;
}

// Summary shape for the season overview card
export interface LeagueSeasonSummary {
  season: LeagueSeason;
  divisionCount: number;
  activeRegistrationCount: number;
  waitlistCount: number;
  pendingReviewCount: number;
  teamCount: number;
}

// ── Rep Teams Module ──────────────────────────────────────────────────────────

export type RepProgramYearStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface RepTeamGroup {
  id: string;
  orgId: string;
  name: string;
  displayOrder: number;
  createdAt: string;
}
export type RepTryoutRegistrationStatus = 'pending_review' | 'offered' | 'accepted' | 'declined' | 'withdrawn';
export type RepRosterStatus = 'active' | 'inactive' | 'released';
export type RepEventType =
  | 'external_tournament'
  | 'tournament_game'
  | 'scrimmage'
  | 'league_game'
  | 'practice'
  | 'team_event';
export type RepAttendanceStatus = 'unknown' | 'attending' | 'absent' | 'late';
export type RepDocumentType = 'waiver' | 'medical_consent' | 'code_of_conduct' | 'other';

export interface RepTeam {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  sport: string;
  division: string | null;
  groupId: string | null;
  groupName: string | null;
  description: string | null;
  color: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepProgramYear {
  id: string;
  teamId: string;
  orgId: string;
  name: string;
  year: number;
  status: RepProgramYearStatus;
  tryoutOpen: boolean;
  tryoutDescription: string | null;
  budgetAmount: number | null;
  autoRemindersEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepTeamCoach {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  createdAt: string;
}

export interface RepTryoutRegistration {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth: string | null;
  playerNotes: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string | null;
  status: RepTryoutRegistrationStatus;
  adminNotes: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface RepRosterPlayer {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  tryoutRegistrationId: string | null;
  source: 'tryout' | 'admin_manual';
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth: string | null;
  playerNumber: string | null;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  status: RepRosterStatus;
  guardianFirstName: string | null;
  guardianLastName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RepLineupMode = 'nine_player' | 'everyone_bats';

export interface RepTeamEvent {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  eventType: RepEventType;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  homeScore: number | null;
  awayScore: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  parentEventId: string | null;
  isRecurring: boolean;
  recurrenceRule: Record<string, unknown> | null;
  recurrenceParentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepTeamEventAttendance {
  id: string;
  eventId: string;
  playerId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  status: RepAttendanceStatus;
  note: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepTeamLineup {
  id: string;
  eventId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  lineupMode: RepLineupMode;
  inningCount: number;
  notes: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepTeamLineupEntry {
  id: string;
  lineupId: string;
  playerId: string;
  battingOrder: number | null;
  starter: boolean;
  inningPositions: Record<string, string>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepDocumentTemplate {
  id: string;
  orgId: string;
  teamId: string | null;
  name: string;
  documentType: RepDocumentType;
  storagePath: string;
  fileName: string;
  fileSize: number;
  isActive: boolean;
  publishedBy: string | null;
  createdAt: string;
}

export interface RepPlayerDocument {
  id: string;
  playerId: string;
  teamId: string;
  orgId: string;
  documentType: RepDocumentType;
  storagePath: string;
  fileName: string;
  fileSize: number;
  templateId: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface RepCostAllocation {
  id: string;
  orgId: string;
  sourceEntryId: string | null;
  description: string;
  totalAmount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface RepAllocationSplit {
  id: string;
  allocationId: string;
  teamId: string;
  programYearId: string;
  orgId: string;
  amount: number;
  splitMethod: 'percentage' | 'sessions' | 'fixed';
  splitValue: number;
  paymentSchedule: 'standard' | 'custom';
  notes: string | null;
  createdAt: string;
}

export interface RepAllocationInstallment {
  id: string;
  splitId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  paidBy: string | null;
  accountingEntryId: string | null;
  reminderSentAt: string | null;
  createdAt: string;
}

export interface RepPlayerDuesSchedule {
  id: string;
  programYearId: string;
  playerId: string;
  teamId: string;
  orgId: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepPlayerDuesInstallment {
  id: string;
  scheduleId: string;
  playerId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  paidAt: string | null;
  reminderSentAt: string | null;
  reminder30SentAt: string | null;
  reminder7SentAt: string | null;
  accountingEntryId: string | null;
  createdAt: string;
}

export interface RepDueReminderCandidate {
  installmentId: string;
  scheduleId: string;
  playerId: string;
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string | null;
  guardianLastName: string | null;
  guardianEmail: string | null;
  teamId: string;
  teamName: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
}

export interface RepAllocationReminderCandidate {
  installmentId: string;
  splitId: string;
  teamId: string;
  teamName: string;
  allocationDescription: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
}

export interface RepPastProgramYear {
  id: string;
  teamId: string;
  teamName: string;
  teamColor: string | null;
  teamDivision: string | null;
  orgId: string;
  name: string;
  year: number;
  status: 'completed' | 'archived';
  rosterCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepTeamHistoryYear extends RepPastProgramYear {
  wins: number;
  losses: number;
  ties: number;
  tryoutTotal: number;
  tryoutAccepted: number;
}

export interface RepTeamExpense {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  expenseType: 'expense' | 'tournament_payable';
  description: string;
  category: string | null;
  amount: number;
  expensePaidAt: string | null;
  depositAmount: number | null;
  depositDueDate: string | null;
  depositPaidAt: string | null;
  balanceAmount: number | null;
  balanceDueDate: string | null;
  balancePaidAt: string | null;
  eventId: string | null;
  notes: string | null;
  paymentMethod: string | null;
  payeeId: string | null;
  payeePayer: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Budget category & item library ───────────────────────────────────────────

export type BudgetScope = 'org' | 'team' | 'both';

export interface BudgetCategory {
  id: string;
  orgId: string | null;       // null = platform default (read-only)
  name: string;
  scope: BudgetScope;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  items?: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  orgId: string | null;       // null = platform default (read-only)
  name: string;
  suggestedAmount: number | null;
  sortOrder: number;
  isDefault: boolean;
  isMisc: boolean;            // true = Misc catch-all, always rendered last
  createdAt: string;
}

export interface BudgetCategoryWithItems extends BudgetCategory {
  items: BudgetItem[];
}

// ── Rep team budget planner ───────────────────────────────────────────────────

export interface RepBudgetLine {
  id: string;
  orgId: string;
  teamId: string;
  programYearId: string;
  categoryId: string | null;
  itemId: string | null;
  description: string;
  totalAmount: number;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepBudgetPeriod {
  id: string;
  budgetLineId: string;
  periodLabel: string;
  periodDate: string | null;
  amount: number;
  sortOrder: number;
  createdAt: string;
}

export interface RepBudgetLineWithPeriods extends RepBudgetLine {
  periods: RepBudgetPeriod[];
  categoryName: string | null;
  itemName: string | null;
}

export interface RepBudgetPlan {
  lines: RepBudgetLineWithPeriods[];
  totalBudget: number;
  hasInstallments: boolean;
  rosterCount: number;
}

// Installment preview row returned before generating dues installments
export interface RepInstallmentPreviewRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string;
  installments: { installmentNumber: number; dueDate: string; amount: number }[];
}

export type DuesCreditType = 'contribution' | 'fundraiser' | 'overpayment' | 'other';

export interface DuesCredit {
  id: string;
  programYearId: string;
  playerId: string;
  amount: number;
  description: string;
  creditDate: string;
  creditType: DuesCreditType;
  notes: string | null;
  createdAt: string;
}

export interface SeasonSurplus {
  id: string;
  programYearId: string;
  totalSurplus: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonRefundRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string;
  creditPortion: number;
  evenShare: number;
  totalRefund: number;
  rollingBalance: number;
}

// ── Platform (FieldLogicHQ company) users ────────────────────────────────────

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationEventType =
  | 'registration_new'
  | 'registration_status_changed'
  | 'payment_received'
  | 'payment_failed'
  | 'roster_change_requested'
  | 'score_submitted'
  | 'score_disputed'
  | 'registration_deadline_approaching'
  | 'waitlist_opened'
  | 'team_no_show'
  | 'coach_access_requested'
  | 'house_league_registration_new';

export interface AppNotification {
  id: string;
  orgId: string;
  eventType: NotificationEventType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface NotificationPreference {
  eventType: NotificationEventType;
  channelBell: boolean;
  channelPush: boolean;
  channelEmail: boolean;
}

export interface TournamentNotificationPreference {
  eventType: NotificationEventType;
  optedOut: boolean;
}

export type CloneCopiedCounts = {
  venues?: number;
  divisions?: number;
  pools?: number;
  slots?: number;
  rules?: number;
  resources?: number;
  welcome?: boolean;
  registrationFields?: number;
};
