/**
 * lib/export/catalog.ts
 * Central registry of every export surface in FieldLogicHQ.
 *
 * EXPORT STANDARD: Every admin page that displays a filterable table of
 * records with five or more columns — or where the data is intended to flow
 * outside the platform — must have an entry here. Either the entry describes
 * a live ExportMenu, or it sets `omittedReason` explaining why export is not
 * appropriate. A table page with no ExportMenu and no catalog entry is a bug.
 *
 * This file is the source of truth for:
 *   - Help documentation availability tables
 *   - Plan-feature audit (pricing accuracy)
 *   - Coverage gap detection (CI can check: every catalogued surface without
 *     omittedReason must have an ExportMenu in its page file)
 */

export interface ExportCatalogEntry {
  /** Stable unique ID — kebab-case, never reused */
  id: string;
  /** Human-readable label shown in help documentation */
  label: string;
  /** Module this export belongs to */
  module:
    | 'tournaments'
    | 'house_league'
    | 'rep_teams'
    | 'accounting'
    | 'coaches'
    | 'org'
    | 'platform_admin';
  /** Brief description of the page */
  page: string;
  /** Source file path (relative to repo root) */
  file: string;
  /** Formats available on this surface */
  formats: ('xlsx' | 'csv' | 'ics' | 'pdf')[];
  /** Default format triggered by the primary Export button click */
  defaultFormat: 'xlsx' | 'csv';
  /** Minimum plan required for this export. Absent = no plan gate. */
  minPlan?: 'tournament' | 'tournament_plus' | 'league' | 'club';
  /** Module-level feature gate key (from lib/plan-features.ts), if applicable */
  moduleGate?: string;
  /** Who can reach this export surface */
  audiences: ('org_admin' | 'coach' | 'treasurer' | 'platform_admin' | 'public')[];
  /**
   * Specific capabilities required beyond the plan gate.
   * Enables granular role control when plan-level gates are too coarse.
   */
  requiredCapabilities?: string[];
  /** Whether any ExportColumnDef in this export is marked sensitive: true */
  includesSensitiveFields: boolean;
  /**
   * 'excluded_by_default'  — sensitive columns appear only in opt-in variant
   * 'opt_in_required'      — user must take a deliberate action (same as above, explicit label)
   * 'included_justified'   — sensitive in base export; justification must be written here
   */
  sensitiveFieldPolicy?: 'excluded_by_default' | 'opt_in_required' | 'included_justified';
  /**
   * Required when sensitiveFieldPolicy = 'included_justified'.
   * Must name the specific role, export name, and use-case justification.
   */
  sensitiveFieldJustification?: string;
  /** Does the export reflect the user's current on-screen filters? */
  respectsCurrentFilters: boolean;
  /** Is data fetched server-side for full-dataset export? */
  serverSide: boolean;
  /** One-sentence description for the help documentation availability table */
  helpSummary: string;
  /**
   * Set when a table page intentionally has no export — replaces ExportMenu.
   * Valid reasons: data too sensitive to export, configuration surface not data
   * surface, module not yet in scope, legacy route being deprecated.
   * A table page with no ExportMenu and no omittedReason is a bug.
   */
  omittedReason?: string;
  /**
   * Implementation phase. Present on entries that are planned but not yet built.
   * Remove when the ExportMenu is live.
   */
  plannedPhase?: string;
}

// ---------------------------------------------------------------------------
// Existing export surfaces (Phase A1) — migrated from inline CSV to ExportMenu
// in Phase C. These entries reflect the PLANNED state after Phase C ships.
// ---------------------------------------------------------------------------

export const EXPORT_CATALOG: ExportCatalogEntry[] = [
  // ── Tournament: Registrations ────────────────────────────────────────────
  {
    id: 'tournament-registrations',
    label: 'Tournament Registrations',
    module: 'tournaments',
    page: 'Teams & Registrations',
    file: 'app/[orgSlug]/admin/tournaments/registrations/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'tournament_plus',
    moduleGate: 'registration_export',
    audiences: ['org_admin'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'excluded_by_default',
    respectsCurrentFilters: true,
    serverSide: true,
    helpSummary:
      'Export the registered team list with coach names, emails, division, payment status, and slot assignments. PDF format produces a check-in / insurance sheet (PDF coming in Phase F3).',
  },
  {
    id: 'tournament-registrations-legacy',
    label: 'Tournament Registrations (legacy /admin route)',
    module: 'tournaments',
    page: 'Teams (legacy)',
    file: 'app/admin/teams/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['org_admin'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'excluded_by_default',
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Legacy route — mirrors the canonical registrations export.',
    omittedReason:
      'Legacy /admin route. Confirm with owner whether still user-visible; if deprecated, canonical route only. See Open Decision #1 in MERGED_EXPORTS_IMPLEMENTATION_PLAN.md.',
    plannedPhase: 'Phase C',
  },

  // ── Tournament: Schedule ─────────────────────────────────────────────────
  {
    id: 'tournament-schedule',
    label: 'Tournament Schedule',
    module: 'tournaments',
    page: 'Schedule Management',
    file: 'app/[orgSlug]/admin/tournaments/schedule/page.tsx',
    formats: ['xlsx', 'csv', 'ics', 'pdf'],
    defaultFormat: 'xlsx',
    // xlsx/CSV/iCal: free — PDF: tournament_plus (handled per-format in ExportMenu)
    minPlan: 'tournament',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export the game schedule with date, time, division, teams, venue, and status. iCal format adds games directly to Google Calendar, Apple Calendar, or Outlook. PDF coming in Phase F3.',
  },
  {
    id: 'tournament-schedule-legacy',
    label: 'Tournament Schedule (legacy /admin route)',
    module: 'tournaments',
    page: 'Schedule (legacy)',
    file: 'app/admin/schedule/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Legacy route — mirrors the canonical schedule export.',
    omittedReason:
      'Legacy /admin route. Confirm with owner whether still user-visible; if deprecated, canonical route only. See Open Decision #1 in MERGED_EXPORTS_IMPLEMENTATION_PLAN.md.',
    plannedPhase: 'Phase C',
  },

  // ── Tournament: Results ──────────────────────────────────────────────────
  {
    id: 'tournament-results',
    label: 'Tournament Results & Scoring',
    module: 'tournaments',
    page: 'Results & Scoring',
    file: 'app/[orgSlug]/admin/tournaments/results/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    // xlsx/CSV: free — PDF: tournament_plus
    minPlan: 'tournament',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export game results with scores, division, and status. PDF produces a post-event summary report grouped by division (PDF coming in Phase F3).',
  },
  {
    id: 'tournament-results-legacy',
    label: 'Tournament Results (legacy /admin route)',
    module: 'tournaments',
    page: 'Results (legacy)',
    file: 'app/admin/results/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Legacy route — mirrors the canonical results export.',
    omittedReason:
      'Legacy /admin route. Confirm with owner whether still user-visible; if deprecated, canonical route only. See Open Decision #1 in MERGED_EXPORTS_IMPLEMENTATION_PLAN.md.',
    plannedPhase: 'Phase C',
  },

  // ── Accounting: Ledger ───────────────────────────────────────────────────
  {
    id: 'accounting-ledger',
    label: 'Accounting Ledger',
    module: 'accounting',
    page: 'Ledger Detail',
    file: 'app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['org_admin', 'treasurer'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export ledger entries with date, description, category, type, amount, and status. Exports the currently loaded entries for the active tab (all / posted / pending).',
  },

  // ── Platform Admin: Early Access Leads ──────────────────────────────────
  {
    id: 'platform-admin-early-access',
    label: 'Early Access Leads',
    module: 'platform_admin',
    page: 'Early Access',
    file: 'app/api/platform-admin/early-access/export/route.ts',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'included_justified',
    sensitiveFieldJustification:
      'Platform admin role has full data access by design; early access leads are prospective customers whose contact data is the primary operational value of this export. The export is server-side and only accessible to authenticated platform admin users.',
    respectsCurrentFilters: true,
    serverSide: true,
    helpSummary:
      'Server-side export of early access lead data including contact info, interest level, status, consent, and notes. Supports format=xlsx|csv query param.',
  },

  // ── Planned: Phase D1 (P0 new table exports) ────────────────────────────
  {
    id: 'house-league-season-registrations',
    label: 'House League Season Registrations',
    module: 'house_league',
    page: 'Season Registrations',
    file: 'app/[orgSlug]/admin/house-league/seasons/[id]/registrations/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'league',
    moduleGate: 'league_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'excluded_by_default',
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export season registrations with player info, guardian contacts, division, status, and preferences.',
    omittedReason: 'Not yet implemented — planned Phase D1.',
    plannedPhase: 'Phase D1',
  },
  {
    id: 'rep-teams-tryout-registrations',
    label: 'Rep Teams Tryout Registrations',
    module: 'rep_teams',
    page: 'Tryout Registrations',
    file: 'app/[orgSlug]/admin/rep-teams/tryouts/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'excluded_by_default',
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export tryout registrations with player info, guardian contacts, notes, and evaluation status.',
    omittedReason: 'Not yet implemented — planned Phase D1.',
    plannedPhase: 'Phase D1',
  },
  {
    id: 'coaches-roster',
    label: 'Coaches Portal — Team Roster',
    module: 'coaches',
    page: 'Team Roster',
    file: 'app/[orgSlug]/coaches/teams/[id]/roster/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'excluded_by_default',
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export team roster with player names, numbers, DOB, guardian contacts, and status. PDF format produces a travel/insurance sheet.',
    omittedReason: 'Not yet implemented — planned Phase D1.',
    plannedPhase: 'Phase D1',
  },
  {
    id: 'coaches-player-dues',
    label: 'Coaches Portal — Player Dues',
    module: 'coaches',
    page: 'Player Dues',
    file: 'app/[orgSlug]/coaches/teams/[id]/accounting/dues/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export player dues summary with total fee, amount paid, outstanding balance, and installment status.',
    omittedReason: 'Not yet implemented — planned Phase D1.',
    plannedPhase: 'Phase D1',
  },
  {
    id: 'accounting-budget-vs-actual',
    label: 'Budget vs. Actual',
    module: 'accounting',
    page: 'Budget vs. Actual',
    file: 'app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['org_admin', 'treasurer'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export budget vs. actual report by category and line item. PDF produces a board-ready financial report.',
    omittedReason: 'Not yet implemented — planned Phase D1.',
    plannedPhase: 'Phase D1',
  },

  // ── Planned: Phase D2 (P1 new table exports) ────────────────────────────
  {
    id: 'coaches-schedule',
    label: 'Coaches Portal — Team Schedule',
    module: 'coaches',
    page: 'Team Schedule',
    file: 'app/[orgSlug]/coaches/teams/[id]/schedule/page.tsx',
    formats: ['xlsx', 'csv', 'ics'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export team schedule with date, time, event type, opponent, and location. iCal adds all events to your calendar.',
    omittedReason: 'Not yet implemented — planned Phase D2.',
    plannedPhase: 'Phase D2',
  },
  {
    id: 'house-league-season-schedule',
    label: 'House League Season Schedule',
    module: 'house_league',
    page: 'Season Schedule',
    file: 'app/[orgSlug]/admin/house-league/seasons/[id]/schedule/page.tsx',
    formats: ['xlsx', 'csv', 'ics'],
    defaultFormat: 'xlsx',
    minPlan: 'league',
    moduleGate: 'league_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export season schedule with date, time, teams, venue, and status.',
    omittedReason: 'Not yet implemented — planned Phase D2.',
    plannedPhase: 'Phase D2',
  },
  {
    id: 'house-league-season-standings',
    label: 'House League Season Standings',
    module: 'house_league',
    page: 'Season Standings',
    file: 'app/[orgSlug]/admin/house-league/seasons/[id]/standings/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'league',
    moduleGate: 'league_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export season standings by team with W, L, T, points, GF, and GA.',
    omittedReason: 'Not yet implemented — planned Phase D2.',
    plannedPhase: 'Phase D2',
  },
  {
    id: 'house-league-season-teams',
    label: 'House League Season Teams',
    module: 'house_league',
    page: 'Season Teams',
    file: 'app/[orgSlug]/admin/house-league/seasons/[id]/teams/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'league',
    moduleGate: 'league_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export season team list with team name, division, and player count.',
    omittedReason: 'Not yet implemented — planned Phase D2.',
    plannedPhase: 'Phase D2',
  },
  {
    id: 'accounting-budget-plan',
    label: 'Budget Plan',
    module: 'accounting',
    page: 'Budget Plan',
    file: 'app/[orgSlug]/admin/accounting/budget/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['org_admin', 'treasurer'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export budget plan by category and line with total, allocated, and collected amounts.',
    omittedReason: 'Not yet implemented — planned Phase D2.',
    plannedPhase: 'Phase D2',
  },
  {
    id: 'rep-teams-roster-admin',
    label: 'Rep Teams Roster (admin view)',
    module: 'rep_teams',
    page: 'Program Year Roster',
    file: 'app/[orgSlug]/admin/rep-teams/program-years/[id]/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'excluded_by_default',
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export rep team roster with player names, numbers, DOB, and status.',
    omittedReason: 'Not yet implemented — planned Phase D2.',
    plannedPhase: 'Phase D2',
  },

  // ── Planned: Phase D3 (P2 new table exports) ────────────────────────────
  {
    id: 'org-members',
    label: 'Org Members',
    module: 'org',
    page: 'Members',
    file: 'app/[orgSlug]/admin/org/members/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'tournament_plus',
    audiences: ['org_admin'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'excluded_by_default',
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export org members with name, email, role, status, and last sign-in.',
  },
  {
    id: 'org-member-audit',
    label: 'Member Audit Log',
    module: 'org',
    page: 'Member Audit',
    file: 'app/[orgSlug]/admin/org/members/audit/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export the member change history log — invites, role changes, suspensions, and removals. Visible to org owners only.',
  },
  {
    id: 'org-diamonds-venues',
    label: 'Venues',
    module: 'org',
    page: 'Venues',
    file: 'app/[orgSlug]/admin/org/venues/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: false,
    serverSide: false,
    helpSummary: 'Export venue list with name, address, and notes (scoped to the currently selected tournament).',
  },
  {
    id: 'platform-admin-orgs',
    label: 'Platform Admin — Organizations',
    module: 'platform_admin',
    page: 'Organizations',
    file: 'app/platform-admin/orgs/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export filtered org list with name, slug, plan, subscription status, and created date.',
  },
  {
    id: 'platform-admin-customer-users',
    label: 'Platform Admin — Customer Users',
    module: 'platform_admin',
    page: 'Customer Users',
    file: 'app/platform-admin/customer-users/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'included_justified',
    sensitiveFieldJustification:
      'Platform admin role requires contact data for support operations; this is internal tooling not exposed to customers.',
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export current search results with email, display name, user ID, auth status, last sign-in, and org memberships.',
  },
  {
    id: 'platform-admin-audit-log',
    label: 'Platform Admin — Audit Log',
    module: 'platform_admin',
    page: 'Audit Log',
    file: 'app/platform-admin/audit/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: true,
    helpSummary: 'Server-side export of filtered platform audit log entries via the API route. Supports xlsx and csv format parameters.',
  },
];

/**
 * Look up a catalog entry by its stable ID.
 */
export function getCatalogEntry(id: string): ExportCatalogEntry | undefined {
  return EXPORT_CATALOG.find((e) => e.id === id);
}

/**
 * All catalog entries that have a live ExportMenu (no omittedReason, no plannedPhase).
 */
export function getLiveExports(): ExportCatalogEntry[] {
  return EXPORT_CATALOG.filter((e) => !e.omittedReason && !e.plannedPhase);
}

/**
 * All catalog entries for a given module.
 */
export function getExportsByModule(
  module: ExportCatalogEntry['module'],
): ExportCatalogEntry[] {
  return EXPORT_CATALOG.filter((e) => e.module === module);
}
