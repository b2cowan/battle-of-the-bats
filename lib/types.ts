export type OrgPlan = 'starter' | 'pro' | 'elite';
export type OrgRole = 'owner' | 'admin' | 'staff' | 'official' | 'league_admin' | 'league_registrar' | 'treasurer' | 'coach';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
export type TournamentStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  planId: OrgPlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: SubscriptionStatus;
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
  name: string;        // e.g. "Battle of the Bats 2026"
  slug: string;        // URL-safe identifier; unique per org among non-archived
  status: TournamentStatus;
  isActive: boolean;   // derived: status === 'active'. Kept for compatibility.
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;      // YYYY-MM-DD
  contactEmail?: string; // shown in coach-facing email footers
}

export interface Diamond {
  id: string;
  tournamentId: string;
  name: string;     // e.g. "Diamond 1 — Lions Park"
  address: string;  // full address for Google Maps
  notes?: string;   // parking info, field notes, etc.
}

export interface Contact {
  id: string;
  tournamentId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

export interface PlayoffConfig {
  type: 'single';
  crossover: 'standard' | 'reseed' | 'none';
  hasThirdPlace: boolean;
  teamsQualifying: number;
  tieBreakers: ('h2h' | 'rf' | 'ra' | 'rd')[];
  splitConfigs?: Record<string, { teamsQualifying: number; hasThirdPlace: boolean }>;
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

export interface AgeGroup {
  id: string;
  tournamentId: string;
  name: string; // e.g. "U11"
  minAge: number;
  maxAge: number;
  order: number;
  contactId?: string; // links to a managed Contact
  isClosed?: boolean; // if true, public registration is disabled
  capacity?: number;  // threshold for waitlist
  poolCount?: number;
  poolNames?: string; // (Legacy) Comma separated
  requiresPoolSelection?: boolean; // if true, user picks pool during registration
  pools?: Pool[]; // The new way
  playoffConfig?: PlayoffConfig;
}

export interface Pool {
  id: string;
  ageGroupId: string;
  name: string;
  order: number;
}

export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
}

export interface Team {
  id: string;
  tournamentId: string;
  ageGroupId: string;
  name: string;
  coach: string;
  email: string;
  players: Player[];
  status: 'pending' | 'accepted' | 'waitlist' | 'rejected';
  paymentStatus: 'pending' | 'paid';
  registeredAt: string;
  adminNotes?: string;
  poolId?: string; // The new way (link to pools table)
}

export type GameStatus = 'scheduled' | 'submitted' | 'completed' | 'cancelled';

export interface Game {
  id: string;
  tournamentId: string; // which tournament year this game belongs to
  ageGroupId: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string; // ISO date string YYYY-MM-DD
  time: string; // HH:MM
  location: string;      // display name (kept for backward compat)
  diamondId?: string;    // links to a managed Diamond record
  homeScore?: number | null;
  awayScore?: number | null;
  status: GameStatus;
  isPlayoff?: boolean;
  bracketId?: string;
  bracketCode?: string;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  notes?: string;
}

export interface Announcement {
  id: string;
  tournamentId: string;
  title: string;
  body: string;
  date: string; // ISO date string
  pinned: boolean;
  ageGroupIds?: string[] | null; // null = all divisions
}

export interface RuleSection {
  id: string;
  tournamentId: string;
  title: string;
  icon?: string;
  order: number;
  items: RuleItem[];
  ageGroupIds?: string[] | null; // null = all divisions
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
  division?: string;            // Comma-separated age group names
  finalSnapshot: {
    tournament: Tournament;
    ageGroups: AgeGroup[];
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
  ageGroup: string | null;
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
export type RepTryoutRegistrationStatus = 'pending_review' | 'offered' | 'accepted' | 'declined' | 'withdrawn';
export type RepRosterStatus = 'active' | 'inactive' | 'released';
export type RepEventType =
  | 'external_tournament'
  | 'tournament_game'
  | 'scrimmage'
  | 'league_game'
  | 'practice'
  | 'team_event';
export type RepDocumentType = 'waiver' | 'medical_consent' | 'code_of_conduct' | 'other';

export interface RepTeam {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  sport: string;
  ageGroup: string | null;
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
  programYearId: string;
  description: string;
  totalAmount: number;
  allocationMethod: 'equal' | 'manual';
  entryId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepAllocationSplit {
  id: string;
  allocationId: string;
  repTeamId: string;
  amount: number;
  createdAt: string;
}

export interface RepAllocationInstallment {
  id: string;
  splitId: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  entryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepPlayerDuesSchedule {
  id: string;
  programYearId: string;
  rosterPlayerId: string;
  orgId: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepPlayerDuesInstallment {
  id: string;
  duesScheduleId: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  entryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepTeamExpense {
  id: string;
  programYearId: string;
  orgId: string;
  description: string;
  amount: number;
  expenseDate: string;
  category: string | null;
  entryId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
