import type { CoachCapabilities } from './coach-capabilities';
import type { BudgetLineKind } from './coach-budget-totals';

export type OrgPlan = 'tournament' | 'team' | 'tournament_plus' | 'league' | 'club' | 'club_large';

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
  // Effective rep-team capacity (Club Repackaging): per-org override ?? plan band default.
  // 9999 ≈ uncapped. Computed via getEffectiveTeamLimit in the org mapper.
  teamLimit: number;
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
  /** Optional external privacy-policy URL. The consent gate links to it when set (see
   *  lib/privacy-policy.ts getOrgPrivacyPolicyHref). NULL/undefined = no policy → no link. */
  privacyPolicyUrl?: string | null;
  /**
   * Club Shared Book (mig 227): has the club admin allowed this org's teams to share their
   * opponent books with each other? Half of a two-key switch — each head coach still opts
   * their own team in (`RepTeam.shareClubBook`). Defaults FALSE, including for a row that
   * predates the migration, so the feature is absent until someone decides otherwise.
   */
  clubBookSharingEnabled: boolean;
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
  sport: string;       // e.g. 'softball' | 'basketball'; default 'softball'. Drives the Sport Pack (lib/sports). Free-text to match league_seasons/rep_teams.
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
  /** App-icon (home-screen/PWA) tile background. '#rrggbb' forces the tile colour;
   *  null = auto-detect from the logo's own background (mig 152). Read only by the
   *  apple-touch + Android maskable icon routes. */
  iconBgColor?: string | null;
  /** Custom home-screen label (manifest short_name + iOS title). Blank/null = derive
   *  from the tournament name as before (mig 153). The full name still drives the
   *  install prompt + browser title. */
  appName?: string | null;
  /** App-icon logo SIZE (zoom): relative size where 100 = the tuned default. Range
   *  70–125 (clamped); null = default look (mig 154). Read only by the apple-touch +
   *  Android maskable icon routes, which each clamp to their own safe ceiling. */
  iconScale?: number | null;
  publicHiddenPages?: PublicPageKey[];
  /** When true, team coach names render on the public tournament pages (Teams cards,
   *  team profile header, schedule search). Defaults to false — coach names are private
   *  on the public site by default (migration 150). Governs the public site only; coach
   *  names stay visible in admin + the Coaches Portal. */
  coachNamesShowOnPublic?: boolean;
  /** Opt-in flag for the public cross-platform discovery directory (/discover).
   *  Default false — a tournament is only listed when the organizer deliberately
   *  turns this on (migration 158). ANDed with the public-status gate at query
   *  time, so a flagged-but-draft tournament never surfaces. */
  listInDirectory?: boolean;
  /** Optional province code (e.g. 'ON') for the directory's location filter;
   *  captured at opt-in time. Null = unset (migration 158). */
  directoryProvince?: string | null;
  /** First time a playoff bracket was materialized for this tournament — the one-time
   *  guard for the "Playoffs are set" announcement (fan push + staff bell). Null until a
   *  bracket is created (migration 175). The home hero takeover derives from the presence
   *  of playoff games, not this timestamp. */
  playoffsPublishedAt?: string | null;
  /** First time this tournament's playoffs became complete (all playoff games terminal +
   *  a decided championship final) — the one-time guard for the "Champions crowned"
   *  announcement (fan push + staff bell). Null until playoffs finish (migration 176). The
   *  home Champions hero takeover + /champions recap page derive from live game state, not
   *  this timestamp. */
  championsCrownedAt?: string | null;
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
  tieBreakers?: import('./tie-breakers').TieBreaker[];
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
  scheduleVisibility?: 'unpublished' | 'published';
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

/**
 * The subset of {@link Team} fields safe to expose on public / anonymous tournament
 * surfaces. Deliberately EXCLUDES coach email, payment status, admin notes, roster
 * players, and all game-day check-in fields — see audit finding J6-001 (anonymous
 * public pages + `/api/public/tournament-data` were leaking coach emails, payment
 * status, and admin notes to every visitor). `coach` (the coach *name*) IS public by
 * design — the public Teams page displays and searches it. Build these via
 * `toPublicTeam` in lib/public-tournament-data.ts; never hand a raw `Team` to a
 * public client component or anonymous response.
 */
export type PublicTeam = Pick<
  Team,
  'id' | 'tournamentId' | 'divisionId' | 'name' | 'coach' | 'status' | 'poolId' | 'seed'
>;

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

// 'forfeit' is a terminal, app-level status (no DB CHECK on games.status).
// A forfeit records a nominal win for the present team (higher score = winner,
// same as a completed game, so W/L and bracket advancement read it identically),
// but the tie-breaker engine EXCLUDES forfeits from RF/RA/RD so invented margins
// can't poison playoff seeding. See lib/tie-breakers.ts and advancePlayoffs.
export type GameStatus = 'scheduled' | 'submitted' | 'completed' | 'cancelled' | 'forfeit';
// 'forfeit' (as a source) marks a result entered as a forfeit. It rides the same
// submit→finalize lifecycle as a score: a PENDING forfeit is status 'submitted'
// with source 'forfeit'; once an admin approves it, it becomes status 'forfeit'.
export type ScoreSubmissionSource = 'scorekeeper' | 'admin_results' | 'system' | 'forfeit';

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
  /**
   * Display name of the bracket/tier this game belongs to (e.g. "Gold", "Tier 1").
   * null/undefined = an ungrouped single bracket. `bracketId` stays the structural
   * key (one id per tier); `bracketLabel` is the grouping/title name so a tier's
   * name survives saves and the diagrams can split + title tiers.
   */
  bracketLabel?: string | null;
  /** Optional custom display name for this game's bracket COLUMN (null/undefined = auto-derived round name). */
  roundLabel?: string | null;
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
  // When the guardian accepted the season waiver on the public form (mig 252).
  // null = not recorded: admin-manual rows, and every row written before the
  // acceptance was stored at all.
  waiverAcceptedAt: string | null;
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
  /** Optional game end; the clash check assumes 90 minutes when null (mig 229). */
  endsAt: string | null;
  /** Picked venue/surface from the ORG venue library — not per-season copies (mig 229). */
  orgVenueId: string | null;
  orgVenueFacilityId: string | null;
  /** Display cache: server-derived from the picked venue, free text only when none picked. */
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
  /** Picked venue/surface from the ORG venue library (mig 229) — one booking pool with games. */
  orgVenueId: string | null;
  orgVenueFacilityId: string | null;
  /** Display cache: server-derived from the picked venue, free text only when none picked. */
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
export type RepTryoutRegistrationStatus = 'pending_review' | 'offered' | 'waitlisted' | 'accepted' | 'declined' | 'withdrawn';
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
  /**
   * Who may see this team's games and practices (Chunk D, mig 215): `staff` | `families` |
   * `public_link`. Carried on the mapped team so a caller that already loaded it can answer
   * "is anything family-facing switched on here?" without a second query — the public team
   * page reads it to skip the family lookups entirely for the ~all teams that never opt in.
   * It is NOT the enforcement point: every family/public read re-checks it server-side.
   */
  scheduleVisibility: 'staff' | 'families' | 'public_link';
  /**
   * Club Shared Book (mig 227): is this team sharing its opponent book with the club's other
   * sharing teams? The head coach's own switch, and also the RECIPROCITY key — a team reads
   * its siblings' books only while this is true for itself (owner ruling §8 Q2, enforced
   * server-side, never in the client). Lives on the TEAM, not the season: a book spans years.
   */
  shareClubBook: boolean;
  /**
   * The team layer of document branding (mig 259, PDF Export Quality decision 7): the look the
   * "How your documents look" card writes. Every key optional — an absent key inherits the
   * club's (organizations.pdf_settings) at resolve time. Lives on the TEAM, not the season: a
   * crest outlasts a program year. Resolution happens server-side only
   * (lib/export/resolve-pdf-settings.ts); nothing should read this raw to build a document.
   */
  pdfLook: { logoDataUrl?: string; accentColor?: string; footerText?: string } | null;
  createdAt: string;
  updatedAt: string;
}

// Lineup Intelligence P3 (mig 172). Season-default innings caps for the game-day auto-fill,
// stored on rep_program_years.lineup_settings. App-enforced (lib/lineup-caps.ts); null = OFF.
export interface LineupSettings {
  maxInningsPerPosition: number | null;    // rotation cap: max innings any one player at a field spot (not the mound)
  pitcherMaxInningsDefault: number | null; // team default arm-care ceiling for pitching
  minInningsPerPlayer: number | null;      // min-play floor — everyone gets at least this many on-field innings
}
// Per-game override (rep_team_lineups.rules_override) — any subset; a missing key falls back to the
// season default. Persisted so a tournament with different rules sticks to that game.
export interface LineupRulesOverride {
  maxInningsPerPosition?: number | null;
  pitcherMaxInnings?: number | null;
  minInningsPerPlayer?: number | null;
}

// ⚠ `CoachSeasonOption` — one entry in a team's season switcher — was DELETED on 2026-08-16 with
// the switcher itself (Design A, P2 of COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md). The working
// season a page renders is resolved from the assignment arrays the shell already holds; see
// `CoachWorkingSeason` in lib/coach-season-view.ts. Nothing crosses the wire per-season any more.

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
  /** How this team's dues credits meet its bills (mig 233, owner Call 2 2026-08-14). */
  creditApplication: import('./dues-credits').CreditApplicationMode;
  /** The team's standard share (0-100) a player keeps of what they raise or bring in (mig 237).
   *  ⚠ It PRE-FILLS the new-fundraiser and new-sponsor forms and nothing else — never applied to
   *  a record that already exists, the same rule `player_rebate_percent` follows per entry. */
  defaultPlayerCreditPercent: number;
  /**
   * Cash the team was already holding on day one of this season (mig 262).
   *
   * ⚠⚠ NULL IS NOT ZERO. "Nothing was carried" and "we started at zero" are the same number and
   * different facts — the register and the Months report hide the line entirely for the first, so a
   * team's first season shows no opening line rather than a line of dashes. Born at
   * `Start next season` from the closing season's own register figure; corrected in Team settings →
   * Money, which is the ONLY correction path (the carry is a handoff, not a live link).
   */
  openingBalance: number | null;
  /** Which season it was carried FROM (mig 262) — the provenance the settings row reads back.
   *  Null when a coach typed the figure for a first season that began mid-stream. */
  openingBalanceFromYearId: string | null;
  lineupSettings: LineupSettings | null; // P3 season-default caps (mig 172)
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
  /** Per-assistant capability grants (jsonb, mig 173). NULL = assistant least-privilege
   *  defaults; ignored for head coaches. See lib/coach-capabilities.ts. */
  capabilities: import('./coach-capabilities').AssistantCapabilityGrants | null;
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
  /**
   * Where they played last season, in the family's own words (mig 265) — free text, never a
   * dropdown of levels (A/AA/AAA/Rep/House mean different things per sport and association, and
   * this product is sport-neutral). A CLAIM, not a verified fact: the coach's Add player form
   * pre-fills it from a prior-season ROSTER match and labels it as such, but never locks it.
   * NULL = nobody was asked (every row the public form or club admin wrote); '' = asked, left blank.
   */
  lastSeasonTeam: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string | null;
  status: RepTryoutRegistrationStatus;
  adminNotes: string | null;
  // Consent capture (PIPEDA/CASL), Phase 1.1. Since 2026-07-30 (CASL unbundling, owner-decided):
  // data-collection + eligibility are REQUIRED to submit — a non-null consentAt means those two
  // were ticked. consentEmailComms is OPTIONAL genuine MARKETING consent (club news / future
  // seasons); tryout STATUS emails are transactional and never gated on it. Rows consented
  // before the unbundling have all three true. NULL consentAt on pre-gate rows = no record.
  consentDataCollection: boolean | null;
  consentEmailComms: boolean | null;
  consentEligibility: boolean | null;
  consentAt: string | null;     // server timestamp at submit
  consentIp: string | null;     // best-effort client IP, captured server-side only
  // Tryout-day candidate fields (Phase 2A, mig 165). One bib + check-in per candidate per tryout.
  bibNumber: string | null;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  // Guardian offer-response loop (Phase 2B.5, mig 170). offerResponse is the family's self-serve
  // answer via the no-login token page; DISTINCT from status (coach still finalizes the roster add).
  // The token hash itself is never mapped to the client. offerExpiresAt is the 7-day deadline.
  offerSentAt: string | null;
  offerExpiresAt: string | null;
  offerResponse: 'accepted' | 'declined' | null;
  offerRespondedAt: string | null;
  /**
   * STICKY — when an offer was FIRST extended (mig 223). Stamped by a DB trigger on the first
   * transition to 'offered' and never cleared.
   *
   * ⚠ NOT interchangeable with `offerSentAt`, which is the live offer-email state and is WIPED by
   * `clearTryoutOffer` on any transition away from 'offered' (correct — a stale accept link must
   * die). That wipe is why offer HISTORY was unprovable before this column, and why the tryout
   * report's funnel could only claim current standing. NULL on rows whose record-only offer left
   * no timestamp behind to backfill from — never inferred from `updatedAt`.
   */
  firstOfferedAt: string | null;
  submittedAt: string;
  updatedAt: string;
}

/** The tryout/evaluation workspace — 1:1 with a program year (mig 165). Owns blind-mode + the
 *  Phase-2B score-lock; FK anchor for sessions and future 2B tables. */
export interface RepTryout {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  isAnonymous: boolean;        // blind evaluation default-ON, freely switchable (owner 2026-08-25)
  /** The FIRST moment names were shown, stamped once and never cleared — the tryout report's
   *  evidence for "blind throughout", which `isAnonymous` stopped being the day the switch became
   *  two-way. NULL = nobody has ever seen a name against a score on this tryout. */
  namesShownAt: string | null;
  scoresLockedAt: string | null;  // reserved for Phase 2B one-way reveal/lock
  scoresLockedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RepTryoutSessionStatus = 'scheduled' | 'cancelled';

/** A scheduled date/time/location block of a tryout (mig 165). Projected onto the coach schedule
 *  at read time as a distinct read-only item — never a rep_team_events row. */
export interface RepTryoutSession {
  id: string;
  tryoutId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  locationAddress: string | null;
  fieldNumber: string | null;
  label: string | null;
  status: RepTryoutSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RepTryoutRubricCategory {
  key: string;              // stable id a score row references
  label: string;
  weight: number;           // relative weight in the composite ranking
  instructions?: string;    // optional evaluator guidance
}

/** The evaluation scorecard for a tryout — 1 per tryout (Phase 2B, mig 166). */
export interface RepTryoutRubric {
  id: string;
  tryoutId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  name: string | null;
  scaleMax: number;         // 5 or 10
  categories: RepTryoutRubricCategory[];
  createdAt: string;
  updatedAt: string;
}

/** A no-account co-coach scoring link (Phase 2B.2). token_hash is never surfaced. */
export interface RepTryoutEvaluatorSession {
  id: string;
  tryoutId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  evaluatorName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

/** One evaluator score for one candidate on one rubric category (Phase 2B.2). */
export interface RepTryoutScore {
  id: string;
  evaluatorSessionId: string;
  registrationId: string;
  tryoutId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  categoryKey: string;
  score: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// Lineup Intelligence player profile (mig 171). Additive richness ON TOP of primary/secondary,
// which stay authoritative for the top-two "Best" positions. Null on legacy rows and on rows
// created by non-picker paths (quick-add, tryout-accept, season rollover). Shape + vocabulary are
// app-enforced (lib/lineup-profile.ts, validated against the team Sport Pack) — no DB CHECK.
export interface LineupPitcherProfile {
  rank: number;              // 1 = ace; lower number = higher priority (P2)
  maxInnings: number | null; // per-player arm-care cap; null = use the season default (P2)
}
export interface LineupProfile {
  morePreferred: string[];   // "Best" positions ranked 3+ (primary/secondary hold ranks 1 & 2)
  canPlay: string[];         // "Okay" — fill in if needed
  never: string[];           // hard exclusions the auto-fill will NEVER assign
  pitcher: LineupPitcherProfile | null; // P2; null = not a pitcher
  aSquad: boolean;           // P4; gold-medal starter
}

export interface RepRosterPlayer {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  tryoutRegistrationId: string | null;
  source: 'tryout' | 'admin_manual';
  playerFirstName: string;
  playerLastName: string | null;
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
  // Wave B player-profile fields (mig 157)
  medicalNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bats: string | null;        // 'L' | 'R' | 'S'
  throws: string | null;      // 'L' | 'R'
  jerseySize: string | null;  // YS|YM|YL|AS|AM|AL|AXL
  // Lineup Intelligence profile (mig 171) — enriches auto-fill; null on legacy/non-picker rows.
  lineupProfile: LineupProfile | null;
  createdAt: string;
  updatedAt: string;
}

export type RepLineupMode = 'nine_player' | 'everyone_bats';

// A labelled resource attached to a coach event (Phase 4). V1 = 'link'; 'file' reserved for V2.
export interface RepEventResource {
  type: 'link' | 'file';
  label: string;
  url: string;
}

// ── Practice plans (mig 213) ─────────────────────────────────────────────────
// The plan that lives on a practice event. SHAPE ONLY lives here (this file is a pure leaf with
// no imports); every rule — validation, caps, the running clock, the random draw and the rotation
// grid — lives in `lib/rep-practice-plan.ts`. Same split as `RepEventResource`/`lib/rep-event-resources`.

/**
 * How long a block runs: a number of minutes, or exactly one "rest of practice" block per plan.
 *
 * ⚠ **Ranges were REMOVED 2026-08-01 (owner), reversing D13's "optional to".** A block that might
 * run 25 *or* 35 minutes makes the next block's start time unknowable — which is the single
 * question the running clock exists to answer, so the feature was undermining its own payoff. A
 * coach who wants slack types one number with the slack already in it. Do not re-add without
 * solving what the clock shows for every block after an open-ended one.
 */
export interface PracticeDuration {
  minutes: number | null;
  restOfPractice?: boolean;
}

/** How a rotation's groups were arrived at (D21). */
export type PracticeGroupSource = 'manual' | 'random' | 'previous';

export interface PracticeGroup {
  id: string;
  name: string;
  playerIds: string[];
}

/**
 * D27 — a station, split by SOURCE. **A station IS the drill** (owner-confirmed 2026-08-01), and
 * Phase 2 makes that literal: the DRILL supplies the shape + the teaching, the PRACTICE supplies
 * the people + the moment. The two halves are marked below and the divide is load-bearing —
 * `_PracticePlanEditor` renders the drill half read-only when `drillId` is set, and the field
 * screen, the run screen and the printed sheet all read the drill half in preference to the
 * block's.
 *
 * ⚠ **There is NO `count`** (owner ruling 2026-08-01). It read as "how many times" or "how long",
 * would have been 1 almost every time, and a coach wanting three of something adds the drill three
 * times or says so in `note`. A legacy 1a value is simply dropped on the next save.
 */
export interface PracticeStation {
  id: string;
  name: string;

  // ── The DRILL half ──
  // Read-only in the plan whenever `drillId` is set (owner ruling 2026-08-01): a drill is an
  // IDENTITY CLAIM, so "used 8x" has to mean eight of the same thing. Editing detaches instead.
  /** "What you're doing". ⚠ New in Phase 2 — see `drillId` for how older plans still read. */
  description?: string;
  /** "What you're watching for" — D28's direct answer to a coach arriving at a station cold. */
  goal?: string;
  coachingPoints?: string[];
  setup?: string;
  /** Reusable equipment labels (tags), suggested from what this team has used before. */
  equipment?: string[];

  /**
   * PROVENANCE ONLY — which library drill this station was picked from.
   *
   * ⚠ **Nothing renders from this id.** Every word above is COPIED into the plan when the drill is
   * added, so a plan never depends on `rep_team_drills` to display: editing a drill later cannot
   * rewrite a practice already written, a retired drill keeps reading for ever, and there is no
   * dangling-id failure of the kind §10.3 refused for staff tags. The id answers "used 8x", and
   * it is CLEARED the moment a coach detaches to edit — at which point it is no longer the same
   * drill, which is the entire point of the read-only rule.
   */
  drillId?: string;
  /**
   * The drill's tag NAMES, SNAPSHOTTED at add time (the `rep_player_measurables.unit` precedent).
   * Lets the focus rail match without a join, and stops a later re-tagging silently rewriting what
   * a past practice was about — the property that makes a read-only past plan honest about what the
   * coach could see AT THE TIME.
   *
   * ⚠ NAMES, not ids, and that is deliberate: a plan must render with no dependency on the tag
   * table, exactly as it renders with no dependency on the drill table. A merged-away tag still
   * reads correctly in every practice already written.
   */
  drillTags?: string[];

  // ── The PRACTICE half — always editable, never written back to the library ──
  /** Names, never grants — a staff entry carries no account and no capability. */
  staff?: string[];
  /** ⚠ Only when the block has stations that do NOT rotate. See `blockRotates`. */
  playerIds?: string[];
  rotationNote?: string;
  /** "Just for tonight" — the one-off note that is never saved back to the drill. */
  note?: string;
}

/**
 * D22–D26 — a real carousel: the grid is computed rather than typed.
 *
 * ⚠ There is deliberately NO `totalMinutes` here (removed 2026-08-01). A rotation runs for exactly
 * as long as its block does, so storing the length twice invited the two numbers to disagree —
 * the block's own `duration` is the single source.
 *
 * `intervalMinutes` is nullable because it has a sensible DERIVED default: the block's length
 * divided by the number of stations, i.e. everyone gets one turn each. Left null it follows the
 * block and the station count as they change; set, it is the coach's choice and stays put.
 */
export interface PracticeRotation {
  intervalMinutes: number | null;
  groups: PracticeGroup[];
  groupSource: PracticeGroupSource;
}

/**
 * A block is one stretch of the practice. It may hold stations; if it holds two or more, they
 * either ROTATE (groups move between them) or run separately (each station keeps its own players).
 *
 * ⚠ **People live at exactly ONE level** (owner ruling 2026-08-01) — see `blockRotates`:
 *   · no stations       → `playerIds` on the block
 *   · stations, no rotate → `playerIds` on each station
 *   · stations, rotating  → `rotation.groups` only
 * Whichever level doesn't apply is stripped on save, so no surface can ever show two different
 * answers to "who's here".
 */
export interface PracticePlanBlock {
  id: string;
  /**
   * Do the stations rotate? **Defaults to TRUE** (undefined = rotate) and is only meaningful
   * with two or more stations — always read it through `blockRotates`, never directly.
   */
  rotates?: boolean;
  title: string;
  description?: string;
  goal?: string;
  duration: PracticeDuration;
  staff?: string[];
  /** ⚠ Only when the block has NO stations. */
  playerIds?: string[];
  coachingPoints?: string[];
  stations?: PracticeStation[];
  /** Groups + the clock. Present when the block's stations rotate. */
  rotation?: PracticeRotation | null;
}

export interface PracticePlan {
  version: number;
  goal?: string;
  /**
   * What kind of practice this is ("Hitting", "Fielding" …) — COACH-TYPED tags, never a fixed
   * list, because the vocabulary is sport-specific and this platform is not.
   *
   * ⚠ A LABEL ONLY in slice 1a: it does not filter the focus rail. Filtering needs focus areas to
   * carry a category, which the drill library pays for in Phase 2 (D16) — and when it lands,
   * non-matching areas DIM, never hide (owner ruling 2026-08-01), so a player whose only focus
   * areas are off-type never vanishes from a coverage list.
   */
  practiceTypes?: string[];
  /** Reusable equipment labels (tags) for the whole practice. */
  equipment?: string[];
  blocks: PracticePlanBlock[];

  /**
   * PROVENANCE ONLY — which plan TEMPLATE this practice was started from (Phase 3).
   *
   * ⚠ Exactly the `PracticeStation.drillId` idiom, one level up, and it means the same thing:
   * nothing renders from the template row, because loading a template COPIES its shape. Editing
   * the template later cannot rewrite a practice already written, and a retired template keeps
   * reading for ever. The id answers "Started 8 plans".
   *
   * ⚠ **And here the two rules diverge, deliberately.** A loaded DRILL stays read-only and its id
   * is cleared the moment a coach edits it, because a drill is an identity claim. A loaded
   * TEMPLATE is fully editable from the first keystroke and KEEPS this id, because a template is
   * scaffolding: "this plan started from Standard Tuesday" stays true however much the coach then
   * changes. Making these two consistent would break one of them.
   */
  templateId?: string;
  /**
   * The template's NAME, snapshotted at load time — the same reason `drillTags` snapshots names.
   * The provenance line must keep reading after the template is renamed or retired, with no
   * dependency on the template table.
   */
  templateName?: string;
}

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
  location: string | null;          // human-readable place NAME (shows on schedule + chips)
  locationAddress: string | null;   // optional street address (mig 161) — powers the Maps link
  // Game-day detail (mig 160), all optional / UI-shaped free text:
  arrivalTime: string | null;   // "be there by" clock time, HH:mm (same day as startsAt)
  fieldNumber: string | null;   // diamond/field label within the location, e.g. "Diamond 2"
  uniform: string | null;       // game-day uniform/jersey note (games only, UI-gated)
  resources: RepEventResource[]; // per-event labelled links (mig 162), app-validated/capped
  /**
   * The structured practice plan for THIS practice (mig 213), or null when none is written.
   *
   * ⚠ OCCURRENCE-SCOPED (D7): a plan belongs to ONE practice and is never written by the
   * recurrence series update. A "this & future"/"all" edit must never reach it — one careless
   * series write would wipe a season of per-practice thinking.
   */
  practicePlan: PracticePlan | null;
  /**
   * "How it went" — one free-text note a coach writes AFTER a practice, at home (D17, mig 221).
   * Null means nothing was written, which the UI states honestly rather than rendering blank.
   *
   * ⚠ **ABOUT THE PRACTICE, NEVER ABOUT A CHILD** (D17's hard guardrail). *"Tees were too crowded,
   * run four next time"* is the whole value. There is deliberately no per-player equivalent and
   * none may be added — per-child commentary would drift into behavioural profiling on minors.
   *
   * ⚠ **This does NOT reopen D4.** Nothing at the field records anything, and there are still no
   * per-block "ran it" ticks: an unhurried note written at home is a different act from an
   * abandoned tick-box mid-drill. A recap existing therefore does NOT license any other surface to
   * claim the plan happened — coverage still says "planned" (§4).
   *
   * ⚠ Coach-facing only. Families never see it.
   */
  practiceRecap: string | null;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  // Team-relative scoring (mig 158): your team's score vs the opponent's, NOT literal
  // home/away. `result` derives from these; `homeAway` is independent context for splits.
  teamScore: number | null;
  opponentScore: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  parentEventId: string | null;
  isRecurring: boolean;
  recurrenceRule: Record<string, unknown> | null;
  recurrenceParentId: string | null;
  status: 'scheduled' | 'cancelled';
  /**
   * Batch 4 (mig 207): the tournament-side `games.id` this event MIRRORS, or null for an ordinary
   * coach-created event. Non-null means the ORGANIZER owns its facts — time, opponent, home/away,
   * venue, score, result and whether it happened at all are kept in step by
   * `lib/rep-tournament-game-mirror.ts` and are refused by the events PATCH/DELETE. The coach still
   * owns arrival time, uniform, field, notes, links, tags, attendance and the lineup.
   */
  sourceTournamentGameId: string | null;
  /**
   * Chunk D 1.8 (mig 215): when the coach shared THIS game's public page, or null.
   *
   * Non-null is the whole reason `/{org}/teams/{slug}/games/{id}` resolves at all — the page
   * does not exist until a coach deliberately shares it, and stops existing when they stop.
   * Never set on a practice: a standing weekly practice location is what the Public-link
   * visibility setting is for, and a per-game share must not publish one sideways.
   */
  familySharedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Opponent Scouting Book (mig 225) — one row per (team, normalized opponent name).
 * An overlay: NO FK from events; identity resolved at read via normalizeOpponentName()
 * + aliases (lib/coach-opponents.ts). Rows are minted lazily on first write.
 */
export interface RepTeamOpponent {
  id: string;
  teamId: string;
  orgId: string;
  displayName: string;
  normalizedName: string;
  /** "The book line" — coach-distilled read (≤500, `notes`-gated). Null renders honestly. */
  summary: string | null;
  lastNoteUpdatedAt: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Scouting Book capture log — attributed, append-only in spirit (delete = head coach / author-own). */
export interface RepTeamOpponentObservation {
  id: string;
  opponentId: string;
  teamId: string;
  orgId: string;
  /** The game it was learned in; null = logged from the card ("General"). */
  eventId: string | null;
  body: string;
  /** Sport-pack-supplied vocab (scoutingTagsForSport), app-validated — no DB CHECK. */
  tag: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

/**
 * Game-Day Mode P2 — one line a coach captured at the bench (`rep_team_game_moments`).
 * Append-only at the app layer (no UPDATE route); DELETE removes a mistake. Feeds no
 * analytics, no coverage surface and no notification — see lib/coach-game-moments.ts.
 */
export interface RepTeamGameMoment {
  id: string;
  teamId: string;
  orgId: string;
  programYearId: string;
  /** The game it was captured at. Required — a moment without a night is not a moment. */
  eventId: string;
  /** Optional player tag; null = a moment about the night. */
  playerId: string | null;
  body: string;
  happenedAt: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

/**
 * A receipt for a COMMITTED coach money import (migration 231) — what the Money hub's
 * `Import ▾ → Recent imports` lists. Append-only: there is no update shape and no update
 * helper, because a receipt that can be edited is not a receipt.
 */
export interface RepTeamImportEvent {
  id: string;
  teamId: string;
  orgId: string;
  programYearId: string;
  /** The Import menu's own vocabulary, so the history reads back in the words it was offered in. */
  dataset: 'budget_lines' | 'payables';
  /** The sheet shape the coach chose — a month grid and a simple list build very different plans. */
  shape: 'month-grid' | 'list' | 'payables';
  /** 'paste' is the phone path the phone-header rule (2026-08-13 decision 4) relies on surviving. */
  source: 'paste' | 'file';
  sourceFilename: string | null;
  rowsCreated: number;
  rowsUpdated: number;
  rowsSkipped: number;
  rowsFailed: number;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
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
  rulesOverride: LineupRulesOverride | null; // P3 per-game cap override (mig 172)
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

// A per-player slot inside a saved lineup TEMPLATE (mig 159). Keyed by player_id so the
// loader can remap to the current roster; mirrors a lineup entry minus the stored notes.
export interface RepTeamLineupTemplateEntry {
  playerId: string;
  battingOrder: number | null;
  starter: boolean;
  inningPositions: Record<string, string>;
}

// A named, reusable "base start" lineup, program-year-scoped (mig 159 / Phase 4).
export interface RepTeamLineupTemplate {
  id: string;
  orgId: string;
  teamId: string;
  programYearId: string;
  name: string;
  lineupMode: RepLineupMode;
  inningCount: number;
  entries: RepTeamLineupTemplateEntry[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Coach Tags (Coach Tags & Player Awards, Phase 1 game tags + Phase 3 expense tags).
 *
 * `focus` (Practice Plans Phase 3, mig 221) is the ONE shared vocabulary behind drills, plan
 * templates, practice plans and players' focus areas — named for what it describes (what the work
 * is about), not for any single surface that uses it. It REPLACED the free-text `category` mig 218
 * put on drills and focus areas: the case-insensitive unique index tags have carried since mig 181
 * makes the "Hitting" vs "hitting" split structurally impossible, and `merge_rep_team_tags`
 * atomically re-points history when a coach ends up with two near-duplicates.
 */
export type RepTagKind = 'game' | 'expense' | 'focus';

export interface RepTeamTag {
  id: string;
  orgId: string;
  // null = org-authored shared tag (visible to every team in the org); a UUID = a team's own
  // private tag. Widened to nullable in migration 184 for the org shared library (Phase 3).
  teamId: string | null;
  kind: RepTagKind;
  name: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Player Awards (Coach Tags & Player Awards, Phase 2). No merge tool (unlike tags) — a coach
// picks from a short curated library rather than free-typing per game, so rename + retire is
// sufficient. Retiring flips isActive; every past award keeps resolving the type's current
// name/emoji at render time, same as a rename does.
export interface RepTeamAwardType {
  id: string;
  orgId: string;
  // null = org-authored shared award type (visible to every team); a UUID = a team's own.
  // Widened to nullable in migration 184 for the org shared library (Phase 3).
  teamId: string | null;
  name: string;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// event_id and tournamentLabel are mutually optional — a row can carry neither, meaning a
// general/season recognition not tied to any single occasion.
export interface RepPlayerAward {
  id: string;
  orgId: string;
  teamId: string;
  playerId: string;
  awardTypeId: string;
  eventId: string | null;
  tournamentLabel: string | null;
  awardedAt: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Denormalized for list/report reads (joined at query time, not persisted columns).
  awardType?: RepTeamAwardType;
  playerName?: string;
  eventOpponent?: string | null;
}

// Player Development (roadmap Phase 3, slice 3A — migration 189)

export interface RepTeamMeasurableType {
  id: string;
  orgId: string;
  teamId: string;
  name: string;
  // Free-text unit ("seconds", "mph") — snapshotted onto each entry at log time, so editing
  // the type's unit never rewrites logged history.
  unit: string;
  sortOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A saved practice shape (Practice Plans Phase 3, migration 221). Rules live in
 * `lib/rep-plan-templates.ts`.
 *
 * ⚠ **A TEMPLATE IS SCAFFOLDING, NOT AN IDENTITY** — and that is the seam a later session will be
 * tempted to "fix". Loading a template gives a FULLY EDITABLE plan (D14 copy-on-load): of course a
 * coach adapts a practice, and adapting it is the point. A loaded DRILL, one level down inside that
 * same plan, stays READ-ONLY, because a drill's name is a claim about what was run. **Both rules
 * are correct and they sit one screen apart. Do not unify them.**
 *
 * ⚠ **`planCount` counts PLANS STARTED, never practices run.** Nothing records what actually
 * happened (D4), so "used 8×" would be a claim the data cannot support. On screen: "Started 8
 * plans" / "Not started a plan yet".
 *
 * ⚠ **Scoped to the TEAM, not the program year** — deliberately NOT the `rep_team_lineup_templates`
 * shape (mig 159). A team is permanent and only its program year turns over, so templates cross a
 * season rollover with nothing to import; year-keying them would strand a coach's library every
 * autumn.
 */
export interface RepTeamPlanTemplate {
  id: string;
  orgId: string;
  /** NOT nullable: club-wide templates were never asked for and are not built. See mig 221. */
  teamId: string;
  name: string;
  /** Several, from the same 'focus' vocabulary as drills, plans and focus areas. */
  tags: RepTeamTag[];
  /**
   * The plan SHAPE — same structure as `rep_team_events.practice_plan`. Copied on load.
   *
   * ⚠ It carries NO PEOPLE: `planToTemplateShape` strips players, staff, rotation groups and
   * "just for tonight" notes on every write. The same D20 divide a drill draws, one level up —
   * the template supplies the shape and the teaching, the practice supplies the people and the
   * moment, which is what lets one template work in April with twelve and July with nine.
   */
  plan: PracticePlan;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A template plus its honest usage figures. */
export interface RepTeamPlanTemplateWithUsage extends RepTeamPlanTemplate {
  /** ⚠ Plans STARTED from this template — never practices run. See the note above. */
  planCount: number;
  /** ISO date of the most recent plan started from it, or null. ⚠ "last planned", never "last run". */
  lastPlannedAt: string | null;
  // ⚠ The block count and total minutes are deliberately NOT fields here. They are derived from
  // `plan` at render time by `templateShapeLabel`, which every surface shares — sending them as
  // numbers alongside the plan they come from would be the second source of truth this row's
  // original note already warned against.
}

/**
 * A reusable drill (Practice Plans Phase 2, migration 218) — the SHAPE of one activity and its
 * TEACHING, and nothing else. Rules live in `lib/rep-drills.ts`.
 *
 * ⚠ **A drill carries NO PEOPLE** (D20) — no coaches, no players, no groups. That is what keeps
 * one drill working in April with twelve and July with nine.
 *
 * ⚠ **A drill is ONE activity — one station's worth.** Picking a second drill into the same block
 * is what produces two stations, and therefore a rotation. There is no nested station list.
 */
export interface RepTeamDrill {
  id: string;
  orgId: string;
  /**
   * NULL = an ORG-AUTHORED shared drill, offered to every team in the club and writable only by an
   * org owner/admin (owner ruling 2026-08-01; the mig-184 shape adopted up front).
   */
  teamId: string | null;
  name: string;
  /**
   * Tags from the shared 'focus' vocabulary (Phase 3, mig 221) — SEVERAL per drill, replacing the
   * single free-text `category` Phase 2 shipped.
   *
   * ⚠ NEVER a fixed or seeded list — every tag is coach-typed, because a supplied
   * "Hitting / Fielding / Pitching" set is one sport talking to a platform serving many. What tags
   * add over free text is that duplicate spellings are now IMPOSSIBLE rather than discouraged, and
   * that two near-duplicates can be merged with their history intact.
   */
  tags: RepTeamTag[];
  /** ONE number. Ranges were removed at owner QA (§10.5) and must not return via the library. */
  usualMinutes: number | null;
  /** "What you're doing". */
  description: string | null;
  /** "What you're watching for". */
  goal: string | null;
  coachingPoints: string[];
  setup: string | null;
  equipment: string[];
  /** Retire, never delete — every plan the drill already sits in keeps working untouched. */
  isActive: boolean;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A drill plus how many plans it appears in. Assembled by the API, never stored. */
export interface RepTeamDrillWithUsage extends RepTeamDrill {
  /**
   * How many stations across this team's practice PLANS were picked from this drill.
   *
   * ⚠ A fact about the DRILL, never about a child — the one count this feature is allowed to show
   * (§4). Zero renders as "Not in a plan yet" rather than a 0, so an unused drill does not read as
   * a failing score.
   *
   * ⚠ **It counts PLANS, not practices, and every surface must say so.** Nothing in this product
   * records what was actually run (D4), so "used 8×" would be a claim the data cannot support —
   * a coach may well have planned this drill and skipped it in the rain. The name is `planCount`
   * for the same reason the copy says "In 8 plans": the honest word, in the type as well as on the
   * screen.
   */
  planCount: number;
}

export interface RepPlayerMeasurable {
  id: string;
  orgId: string;
  teamId: string;
  playerId: string;
  measurableTypeId: string;
  value: number;
  // Unit snapshot (see RepTeamMeasurableType.unit) — render THIS, never re-join to the type.
  unit: string;
  recordedOn: string;
  note: string | null;
  // Evaluation-session back-reference (mig 190) — null = logged as a single from the
  // player profile. Both doors write the same rows.
  sessionId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// The Evaluation Session artifact (Player Development 3B, mig 190) — a grouping of
// measurable readings collected in one sitting; stats are derived at read time.
export interface RepTeamEvaluationSession {
  id: string;
  orgId: string;
  teamId: string;
  programYearId: string;
  sessionDate: string;
  /**
   * D10 (mig 213) — the scheduled event these readings were collected at, or null.
   *
   * ⚠ The link and the date are TWO SEPARATE FACTS. Picking a practice PRE-FILLS `sessionDate`;
   * it never derives it. A rescheduled practice must NOT move the session's date (and so must not
   * re-stamp its readings) — the measurements happened when they happened.
   */
  eventId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived (never stored): how many players/tests/readings the session touched.
  playerCount?: number;
  typeCount?: number;
  entryCount?: number;
}

export type RepDevelopmentGoalStatus = 'working' | 'achieved' | 'parked';

export interface RepPlayerDevelopmentGoal {
  id: string;
  orgId: string;
  teamId: string;
  playerId: string;
  focusArea: string;
  note: string | null;
  status: RepDevelopmentGoalStatus;
  /**
   * ONE optional grouping tag from the shared 'focus' vocabulary (Phase 3, mig 221 — replaces the
   * free-text `category` of mig 218).
   *
   * ⚠ **A FOCUS AREA IS FREE TEXT FIRST, TAGGED SECOND** (owner ruling 2026-08-01). `focusArea`
   * above stays the coach's own specific words — *"loading their back hip"*, *"changeup accuracy"* —
   * because that is what a coach actually coaches from. **The tag never replaces it.** It exists
   * only so the focus rail can tell this area belongs to tonight's practice.
   *
   * ⚠ Hence the deliberate asymmetry with drills and templates, which carry SEVERAL tags: a focus
   * area is MORE SPECIFIC than a plan tag by design, so one grouping handle is the whole need.
   * Do not "make them consistent".
   *
   * ⚠ NULL means "the coach hasn't said" and renders at FULL strength in the focus rail — never
   * dimmed, never hidden. Nothing is back-filled and nothing is inferred from keywords: free text
   * does not cluster, and guessing would be a confident lie (§4).
   */
  tagId: string | null;
  /** Denormalised for render — the tag's name, or null when `tagId` is null. */
  tagName: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Tryout development baseline (Tryout Insights Phase 2, mig 223) ───────────────────────────
// "Where this player's season started": ONE frozen copy of their tryout evaluation, written once
// by an explicit coach act. Shape only lives here (this file is a pure leaf); every rule — how a
// snapshot is assembled, and which categories become suggestions — lives in lib/tryout-baseline.ts,
// the same split RepEventResource/lib/rep-event-resources uses.

export interface RepTryoutBaselineCategory {
  key: string;
  label: string;
  /** Cross-evaluator average on the scorecard's scale; null when nobody scored this category. */
  avg: number | null;
}

/**
 * ⚠ A COPY, NOT A JOIN. Every label and number is snapshotted at seed time so a later rubric edit
 * or corrected score can never rewrite a baseline the coach already chose focus areas from (R4).
 * Bump `version` if the shape changes — stored rows are historic records and are never migrated
 * in place.
 */
export interface RepTryoutBaselineSnapshot {
  version: 1;
  /** Provenance; null on a snapshot assembled without a tryout workspace row. */
  tryoutId: string | null;
  seasonLabel: string;
  /** Human date span of the tryout ("Aug 12–13"), or null when no session dates existed. */
  dateLabel: string | null;
  scaleMax: number;
  /** Weighted composite on the scorecard scale; null when this player was never scored. */
  composite: number | null;
  evaluatorCount: number;
  /** Whether the evaluation was still blind when the snapshot was taken — a fairness fact. */
  blindUsed: boolean;
  categories: RepTryoutBaselineCategory[];
}

export interface RepPlayerTryoutBaseline {
  id: string;
  orgId: string;
  teamId: string;
  programYearId: string;
  rosterPlayerId: string;
  /** Provenance only — nullable, and null after a registration is purged. */
  tryoutRegistrationId: string | null;
  snapshot: RepTryoutBaselineSnapshot;
  seededBy: string | null;
  seededAt: string;
}

// Returning-player continuity (Player Development 3C, mig 191 — DBA Finding #31).
// One row per (current, prior) pair for its whole lifecycle; a rejected row is the
// never-re-suggest tombstone. Exactly one FK per side; sides are immutable.
export type RepContinuityStatus = 'suggested' | 'confirmed' | 'rejected';

export interface RepPlayerContinuityLink {
  id: string;
  orgId: string;
  teamId: string;
  currentRosterId: string | null;
  currentRegistrationId: string | null;
  priorRosterId: string | null;
  priorRegistrationId: string | null;
  status: RepContinuityStatus;
  confidence: 'high' | 'possible';
  decidedBy: string | null;
  decidedAt: string | null;
  // One-time rollover carry-forward answer (3D, mig 192) — null until the coach answers.
  carryStatus: 'carried' | 'fresh' | null;
  carryDecidedBy: string | null;
  carryDecidedAt: string | null;
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

export type DuesPaymentMethod = 'etransfer' | 'cash' | 'cheque' | 'card' | 'other';
/**
 * The accepted methods, as a value — so the record door and the correct-a-receipt door validate
 * against ONE list. They each carried their own copy, with a comment on the second promising it
 * mirrored the first and nothing enforcing it; a fifth method added to one and not the other
 * would have been accepted by one door and refused by the other, silently.
 *
 * ⚠ 'card' joined 2026-08-22 (mig 260, one-method-list ruling): the product's one shared method
 * list is E-Transfer · Cash · Cheque · Card · Other, and dues was the surface that couldn't say
 * Card. The DB CHECKs on payments AND payouts widened with it — they share this type.
 */
export const DUES_PAYMENT_METHODS: readonly DuesPaymentMethod[] = ['etransfer', 'cash', 'cheque', 'card', 'other'];
/**
 * What each stored token is CALLED on screen — one map, every reader (2026-08-22). The payout
 * sheet and the dues panel each carried their own copy; the recording conversation would have
 * been the third. Casing follows the product's established method vocabulary
 * (`lib/payment-methods.ts`): 'E-Transfer', as the club's payment-request list has always spelled it.
 */
export const DUES_PAYMENT_METHOD_LABEL: Record<DuesPaymentMethod, string> = {
  etransfer: 'E-Transfer',
  cash:      'Cash',
  cheque:    'Cheque',
  card:      'Card',
  other:     'Other',
};

/** A dues payment FACT (mig 232): what arrived, when, how much. Installments are the plan;
 *  coverage is derived (lib/dues-payments.ts) and projected onto installment paidAt. */
export interface RepDuesPayment {
  id: string;
  programYearId: string;
  playerId: string;
  amount: number;
  /** The day the money arrived (org-timezone date) — also the ledger entry's date. */
  receivedDate: string;
  method: DuesPaymentMethod;
  note: string | null;
  accountingEntryId: string | null;
  source: 'recorded' | 'migrated_mark_paid';
  createdAt: string;
}

/**
 * The OUTBOX (mig 234) — cash handed back to a family against their credits. Deliberately the
 * mirror of RepDuesPayment: a credit is money the team owes a family, and this is one of the
 * three ways it settles. WHICH credits a payout settles is derived at read time, never stored.
 */
export interface RepDuesPayout {
  id: string;
  programYearId: string;
  playerId: string;
  amount: number;
  /** The day the money LEFT (org-timezone date) — also the ledger entry's date. */
  paidDate: string;
  method: DuesPaymentMethod;
  note: string | null;
  accountingEntryId: string | null;
  /** 'recorded' = the Pay out sheet; 'season_settlement' = the season's bulk settlement. */
  source: 'recorded' | 'season_settlement';
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
  /** The installment's face value. */
  amount: number;
  /** What the family is asked to SEND — cash remainder minus credits applied to this
   *  installment (owner model 2026-08-14; before credits landed on bills this was the cash
   *  remainder alone). The reminder email quotes exactly this figure. */
  remainingAmount: number;
  /** Credit dollars applied to this installment — the email names the earning (owner Call 4). */
  creditApplied: number;
  /** Where the credit came from ("Bottle Drive"), when one source can be named. */
  creditNote: string | null;
  dueDate: string;
  /** Already past its due date (org-timezone calendar). Only the coach's ad-hoc send produces
   *  these — the automated 30/7 waves look forward by construction. */
  overdue: boolean;
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
  /** WHAT THIS COST IS (mig 240) — the item, in the same words the budget uses, and the key
   *  Budget vs. Actual groups on. Null for a row recorded before this shipped, an imported row, or
   *  one whose item was later deleted. ⚠ Whether it was BUDGETED is not stored anywhere: it is
   *  derived, by asking whether a budget line exists for the same category and item. */
  budgetItemId: string | null;
  /** The item's category — derived from it, and the surviving link if that item is deleted. */
  budgetCategoryId: string | null;
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
  /** Out-of-pocket (mig 234, owner Call 5): a family covered this cost directly. Counts in the
   *  budget exactly as a team-paid expense; NO team cash left, so cash figures exclude it; and
   *  the team owes that family, carried as an ordinary `reimbursement` credit. */
  paidByPlayerId: string | null;
  /** The ledger entry a LUMP expense's payment created, so a delete can void it (mig 236).
   *  Null on payables, and null on anything paid before 2026-08-15 — a null here does NOT mean
   *  unpaid; `expensePaidAt` answers that. */
  accountingEntryId: string | null;
  /** Same, for a payable's deposit half. The two halves post months apart, so each needs its own. */
  depositEntryId: string | null;
  /** Same, for a payable's balance half. */
  balanceEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Money coming IN (mig 243) ────────────────────────────────────────────────

/**
 * What kind of arrival this is. ⚠ ONLY THE COACH CAN DECIDE — a club grant and a club
 * reimbursement arrive as the same amount, from the same club, on the same day.
 */
export type MoneyInKind = 'income' | 'money_back';

/** An optional LABEL on a refund. Never a behaviour: `family` touches no dues credit. */
export type MoneyInSource = 'club' | 'vendor' | 'sponsor' | 'family' | 'other';

/**
 * Money arriving on a rep team, in the same category+item vocabulary spending uses (mig 243).
 *
 * ⚠⚠ `money_back` IS NOT `rep_team_expenses.paidByPlayerId`. A coach describes both as "a parent
 * paid me back". Out of pocket = the team's cash never moved and it now OWES that family a credit;
 * money back = the team's cash went out and some returned, and it owes nobody. Merging them
 * credits a family twice or loses a credit entirely.
 *
 * ⚠ A refund is NOT a negative expense and NOT income. It nets into the row it repaid, so no list
 * of expenses ever shows a negative amount and no revenue total ever counts it.
 */
export interface RepTeamMoneyIn {
  id: string;
  programYearId: string;
  teamId: string | null;
  orgId: string;
  kind: MoneyInKind;
  /** Always positive on both kinds — the kind carries the sign, never the amount. */
  amount: number;
  /** `YYYY-MM-DD`, the day it ARRIVED. Format with `formatStoredDate()`. */
  receivedDate: string;
  /** What this is, in the budget's own words. Null = the "Not itemized" bucket. */
  budgetItemId: string | null;
  budgetCategoryId: string | null;
  /**
   * The names those two ids resolve to, read with the record.
   *
   * ⚠ NOT DENORMALIZED — joined on read, so renaming an item in the library renames it here too.
   * The money-OUT sibling stores a free-text `category` copy instead, for a reason that does not
   * apply here: those rows predate the taxonomy and many carry text and no id at all.
   *
   * ⚠ THEY LIVE HERE SO ONE PLACE RESOLVES THEM. Before this, the list, the export and the report
   * route each invented their own lookup, and the report's simply gave up — it passed a null item
   * name, so an arrival on an item the plan never mentions rendered as "Not itemized" while the
   * list two tabs away showed its real name. Null only when the id is null, or the row it pointed
   * at was deleted.
   */
  budgetItemName: string | null;
  budgetCategoryName: string | null;
  /** A note. ⚠ NEVER a grouping key — the item names the row. */
  description: string | null;
  notes: string | null;
  /** Offered on `money_back` only. */
  receivedFrom: MoneyInSource | null;
  /** The team-ledger income entry this posted, so a delete can void it. Cash on hand, not dues. */
  accountingEntryId: string | null;
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

/**
 * Which side of the books a budget word belongs to (mig 243, mandatory since mig 246).
 *
 * ⚠ DECLARED HERE RATHER THAN IN `lib/coach-budget-items.ts`, which owns the behaviour around it —
 * that module imports this one, so the type has to sit on this side of the edge or the import
 * becomes a cycle. `coach-budget-items` re-exports it, so callers can take both from the module
 * whose rules they are already using.
 */
export type BudgetItemDirection = 'in' | 'out';

export interface BudgetItem {
  id: string;
  categoryId: string;
  orgId: string | null;       // null = platform default (read-only)
  /** mig 240 — set = this TEAM's own item, visible in its picker only. Null with an orgId = the
   *  club published it to every team. See lib/coach-budget-items.ts for the one-way rule. */
  teamId: string | null;
  name: string;
  suggestedAmount: number | null;
  sortOrder: number;
  isDefault: boolean;
  /** ⚠ RETIRED AS A CHOICE 2026-08-15. The item names the budget row now, and a report row called
   *  "Misc" answers nothing — the coach picker no longer offers these, though historic lines keep
   *  pointing at them. */
  isMisc: boolean;
  /**
   * Which side of the books this word belongs to: `in` = money the team receives, `out` = money it
   * spends. Added mig 243, **made mandatory by mig 246**.
   *
   * ⚠⚠ THIS COMMENT USED TO SAY THE OPPOSITE, and it was already false when /simplify found it.
   * Mig 243 called it "a picker HINT that sorts, never a constraint", null on every club- and
   * coach-created item by design. The owner's 2026-08-16 ruling — *a coach clicking income must not
   * be offered expense items* — made it the thing the item list is FILTERED by, so mig 246
   * backfilled every untagged row and set the column NOT NULL. Not nullable any more; a reader
   * writing a `null` branch is defending against a state the database cannot produce.
   *
   * ⚠ The REPORT still never reads this. A row's direction comes from what was actually filed
   * against it, which is why moving an item to the other side re-files nothing and moves no money.
   */
  direction: BudgetItemDirection;
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
  /** Is this money the team SPENDS or money it expects to bring IN (fundraising, sponsorship,
   *  a grant)? The amount is always positive — the kind carries the sign (migration 230). */
  lineKind: BudgetLineKind;
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
  /** Σ COST lines only. Funding lines are not part of what the season costs — they are what
   *  offsets it — so a payload that lumped them together would report a smaller season. */
  totalBudget: number;
  hasInstallments: boolean;
  rosterCount: number;
}

// Installment preview row returned before generating dues installments
export interface RepInstallmentPreviewRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string | null;
  installments: { installmentNumber: number; dueDate: string; amount: number }[];
}

/** 'forgiven' and 'reimbursement' joined in mig 233 (owner model 2026-08-14): forgiveness is
 *  debt relief — lowers bills, never owed back, never paid out; a reimbursement is born from an
 *  out-of-pocket expense. One credit mechanism for every kind. */
export type DuesCreditType = 'contribution' | 'fundraiser' | 'overpayment' | 'other' | 'forgiven' | 'reimbursement';

export interface DuesCredit {
  id: string;
  programYearId: string;
  playerId: string;
  amount: number;
  description: string;
  creditDate: string;
  creditType: DuesCreditType;
  notes: string | null;
  /** Set only on overpayment credits auto-created by recording a payment (mig 232) — the credit
   *  is removed with its payment (DB CASCADE), so the UI hides its delete button. */
  paymentId?: string | null;
  /**
   * The other two provenance links. **A credit with ANY of these three set was created by another
   * record, and that record states its amount** — a fundraiser rebate is the entry's raised × rate,
   * a reimbursement is the out-of-pocket expense, an overpayment is the payment's excess. Editing
   * such a credit directly would leave two disagreeing numbers with no way to tell which is true,
   * and the next reconcile would quietly overwrite whichever the coach had just corrected. The
   * ledger drawer offers Edit only when all three are null.
   */
  fundraiserEntryId?: string | null;
  expenseId?: string | null;
  createdAt: string;
}

/* The season settlement's shapes live with its arithmetic (lib/season-settlement.ts) and its
   assembly (lib/coach-season-settlement.ts) — SettlementSheet, SettlementSheetRow,
   SettlementFamily. The old `SeasonSurplus` (a hand-typed pot) and `SeasonRefundRow` (a
   four-number breakdown that could not re-add to it) were deleted with the calculator they
   described, 2026-08-14. */

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
  | 'house_league_registration_new'
  // Coach Chat (Project 1 — Tournament Chat). These default push ON (the chat-app model).
  | 'chat_message'
  // A targeted @mention — a DISTINCT, higher-priority event so it still reaches a coach who has muted
  // general chat_message notifications. Defaults push ON; intentionally not in the settings UI yet
  // (so it can't be silenced there). No DB CHECK on event_type, so this is a TS-union change only.
  | 'chat_mention'
  // A tryout family responded (Accept/Decline) to an offer via the no-login link (Phase 2B.5) — the
  // coach still finalizes. Bell default on; TS-union change only (no DB CHECK on event_type).
  | 'tryout_offer_response'
  // Chunk D 1.11 — a connected family's team moved a game or posted a final score. Reaches
  // FAMILY accounts (not org staff), who are not organization members, so it is always
  // dispatched with an explicit recipient list. Deliberately NOT in PUSH_DEFAULT_ON_EVENTS:
  // Android/prod push delivery is still unverified (discovery G9), and promising a family a
  // push we cannot prove arrives would be the dishonest kind of feature. Bell + email only;
  // the email half is sent by lib/family-notify.ts so it honours the family opt-out list.
  // TS-union change only (no DB CHECK on event_type).
  | 'family_game_update'
  // Assistant Coaches Phase 2 — an assistant accepted an invite (→ the head coach) / a head coach
  // requested approval (→ org admins). Bell default on; TS-union change only (no DB CHECK).
  | 'assistant_coach_joined'
  | 'assistant_coach_approval_requested'
  // The playoff bracket was materialized for a tournament (fires once, the first time).
  // Reaches org staff (bell + push) AND anonymous fans following a team (push). Defaults
  // push ON — it's a headline, time-sensitive moment. TS-union change only (no DB CHECK).
  | 'playoffs_set'
  // The tournament's playoffs became complete — champion(s) crowned (fires once, the first
  // time the whole bracket resolves). Reaches org staff (bell + push) AND anonymous fans
  // following a team (push). Defaults push ON — the payoff moment. TS-union change only.
  | 'champions_crowned'
  // A day-of / operational tournament announcement (e.g. a rain-delay "shift the day" notice) was
  // posted with the notify intent. Reaches org staff + Coaches-Portal coach members (bell + push);
  // anonymous fans get it via the separate fan-push channel, external team coaches via email.
  // Defaults push ON — day-of, action-worthy. TS-union change only (no DB CHECK on event_type).
  | 'tournament_announcement'
  // Insights weekly digest — the Sunday "week in review" sent to a rep team's coaches, built
  // per-recipient from what that coach's capabilities allow (quiet week ⇒ no send). Defaults
  // push ON. TS-union change only (no DB CHECK on event_type).
  | 'coach_insights_digest';

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
