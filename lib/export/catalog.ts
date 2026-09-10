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
  /** Default format triggered by the primary Export button click. 'pdf' is a ruled exception:
   *  the coaches tryout report defaults to the board-safe PDF so the safe-to-share variant is
   *  the path of least resistance (Tryout Insights ruling R1, 2026-08-02). */
  defaultFormat: 'xlsx' | 'csv' | 'pdf';
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
   *
   * ⚠ IT MEANS THE WHOLE SURFACE, NOT ONE FORMAT. Two entries used it to mean "a PDF is coming
   * later" while the screen exported happily in three other formats — and to anything reading the
   * schema (this registry's gate, the operator page, the help table) that says the export does not
   * exist at all. `formats` already records which formats are live. Remove this when the export
   * ships; never use it to park a format.
   */
  plannedPhase?: string;
  /**
   * CAN THE PRODUCT READ THIS FILE BACK? The path of the importer that does, or absent for a
   * one-way export.
   *
   * ⚠⚠ THIS IS LOAD-BEARING IN TWO DIRECTIONS, which is why it is recorded rather than remembered.
   *
   * Outward, it is a real capability a club asks about before buying — *can we get our data out,
   * and can we fix it in Excel and put it back?* — and until now nothing in the product recorded
   * the answer.
   *
   * Inward, it decides whether the file may carry a MASTHEAD. A round-trip file has to start on
   * its column row, because the importer reads the first non-empty row as the headings. On
   * 2026-09-05 two separate changes nearly put a title block on one — the second was
   * **Coaches → Team Schedule**, whose importer is written to read the export's own column
   * spellings while nothing on that screen says so. It looks exactly like a harmless dataset.
   * `tests/unit/export-masthead-guard.test.ts` refuses it now; this field is how a human finds
   * out before the build does.
   */
  roundTrip?: string;
  /**
   * The test that PROVES the round trip — the file built from the exporter, read back by the reader.
   *
   * ⚠⚠ REQUIRED WHENEVER `roundTrip` IS SET, AND THIS FIELD EXISTS BECAUSE THE CLAIM WAS FALSE FOR
   * A WEEK (2026-09-10). `roundTrip` is published to the platform-admin Export Registry and to the
   * customer help system — it is the product telling a coach "edit this file and bring it back" —
   * and the gate behind it verified only that the named reader FILE EXISTED. Meanwhile the Budget
   * plan's own file came back with no amounts (its money column was renamed `Planned` on 2026-09-02
   * and the reader's alias list was never told), with every cost line silently dropped (the line
   * marker went with the sub-rows on 2026-09-09), and with every money-in line re-read as a new
   * cost. Three defects, eight days, one green gate.
   *
   * ⚠ THE TEST MUST BUILD ITS FIXTURE FROM THE EXPORTER'S OWN COLUMN DEFINITIONS, never from
   * hand-typed headers — a test that spells the headings out cannot see a rename, and a rename was
   * two of those three defects. That is the whole technique; copy it rather than inventing another.
   */
  roundTripTest?: string;
  /**
   * Why a `roundTrip` claim has no test yet — the exception register, in this repo's usual shape.
   *
   * A claim with neither a test nor a stated gap fails the build. This field is deliberately
   * uncomfortable to write: it records a promise the product is making to a coach with nothing
   * standing behind it, and it should read that way to whoever finds it.
   */
  roundTripTestGap?: string;
  /**
   * A file whose columns happen to match an importer's aliases without being designed to — a
   * coach could reasonably try it and get a wrong result. Recorded so the answer to "can I
   * re-upload this?" is never a shrug.
   */
  roundTripCaveat?: string;
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
      // The "(PDF coming in Phase F3)" this sentence used to carry outlived the PDF's arrival by
      // months — the same stale-claim class this whole export-quality programme exists to kill.
      // Found while writing the Working-sheets prompt; fixed in passing 2026-08-24.
      'Export the registered team list with coach names, emails, division, payment status, and slot assignments. The PDF prints a division-grouped register of the registered teams.',
  },
  /* ⚰ THE THREE `*-legacy` ENTRIES ARE GONE (2026-09-06). They described the old top-level
     `/admin/teams`, `/admin/schedule` and `/admin/results` routes, which were deleted at some
     point without their entries — so the registry went on listing three exports nobody could
     reach, each carrying an "Open Decision" note asking whether the route was still user-visible.
     The answer had been no for long enough that the files were gone. An entry describing a page
     that does not exist is not a record, it is a rumour, and `check:export-catalog` now refuses
     one. */

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
      'Export the game schedule with date, time, division, teams, venue, and status. iCal format adds games directly to Google Calendar, Apple Calendar, or Outlook. The PDF is a wall copy — one section per day, so a parent can find one game at a glance.',
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
      'Export game results with scores, division, and status. The PDF is the printed register — one section per division, landscape. It deliberately OMITS the three score-audit columns (submitted by / at / source), which are working data and stay in xlsx and csv.',
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
    file: 'app/platform-admin/early-access/EarlyAccessClient.tsx',
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

  {
    // The PDF is the printed REGISTER (Phase 2 Registers pass): division sections with their
    // own counts, and player / registered / status / fee paid. It deliberately carries none of
    // the sensitive columns the spreadsheets do — a printed page gets left on tables.
    id: 'house-league-season-registrations',
    label: 'House League Season Registrations',
    module: 'house_league',
    page: 'Season Registrations',
    file: 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx',
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
      'Export season registrations with player info, guardian contacts, division, status, and preferences. The PDF prints a division-grouped register with counts — names, dates and fees only, no contact details.',
  },
  {
    // Catalog true-up 2026-08-02 (Tryout Insights Phase 1): this export shipped in Phase D1 but
    // the entry still claimed "not yet implemented" and pointed at a page that never existed.
    id: 'rep-teams-tryout-registrations',
    label: 'Rep Teams Tryout Registrations',
    module: 'rep_teams',
    page: 'Program Year — Tryout Applicants',
    file: 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx',
    // The PDF is the printed REGISTER (Phase 2 Registers pass): status sections with counts, and
    // the consent record. No contact details, no notes, no consent IP — those stay in the sheets.
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
      'Export tryout applicants with player info, guardian contacts, consent audit columns, and application status. The PDF prints a status-grouped register with counts and the consent record — no contact details.',
  },
  {
    id: 'coaches-tryout-check-in',
    label: 'Coaches Portal — Tryout Check-in Sheet',
    module: 'coaches',
    page: 'Tryouts — Tryout day (Check-in)',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/tryouts/page.tsx',
    formats: ['pdf'],
    defaultFormat: 'pdf',
    // ⚠ NOT an Export menu — a "Print sheet" button on the check-in face, because it is the
    // paper equivalent of the screen beside it rather than a data extract. Catalogued anyway:
    // it is a document a customer produces, and it was the only one missing from the list that
    // tells customers what this product prints (Working-sheets pass, owner-approved 2026-08-24).
    //
    // ⚠ NO PLAN GATE, and that is a statement of fact, not an aspiration. The button has been
    // ungated since it shipped; adding `pdf_exports` here would be a claim the code does not
    // make, and enforcing it would take a working sheet away from teams that print one today.
    // A packaging call, not this pass's.
    audiences: ['coach'],
    requiredCapabilities: ['tryouts'],
    // Bib, first/last name and age. No date of birth, no guardian, no contact details — the
    // same privacy floor as the two tryout registers.
    includesSensitiveFields: false,
    respectsCurrentFilters: false,
    serverSide: false,
    helpSummary:
      'Print the day-of check-in sheet: every candidate with their bib number and age, a box to tick as each one arrives, and room for a note. Named for the session it is for, on your team’s paper. In a blind tryout it prints bib numbers only and says so.',
  },
  {
    id: 'coaches-tryout-report',
    label: 'Coaches Portal — Tryout Report',
    module: 'coaches',
    page: 'Tryouts — Build your team (Tryout report)',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/tryouts/page.tsx',
    formats: ['xlsx', 'pdf'],
    // Ruled exception to the xlsx-primary standard (R1, 2026-08-02): the board-safe PDF —
    // aggregates and roster names only — is the default so the shareable variant is the easy one.
    // Full detail (names × scores × decisions) exists only behind an explicit staff-only confirm,
    // and not at all while blind evaluation is on.
    // NOTE for any future coverage check: this surface deliberately uses a bespoke menu (mockup-
    // bound, R1) rather than components/admin/ExportMenu — a "catalogued file must import
    // ExportMenu" assertion needs a carve-out here. PDF variants gate on the pdf_exports plan
    // feature (same as every PDF export); Excel is ungated.
    defaultFormat: 'pdf',
    audiences: ['coach'],
    requiredCapabilities: ['tryouts'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'opt_in_required',
    respectsCurrentFilters: false,
    serverSide: false,
    helpSummary:
      'Tryout report exports: a board-safe summary PDF (turnout, funnel, class profile, fairness receipt, roster) and a full-detail PDF/Excel of every candidate with scores and decisions, behind a deliberate coaching-staff-only confirmation.',
  },
  {
    id: 'coaches-roster',
    roundTripCaveat: 'Several columns alias-match the bulk-add importer (#, first/last name, position, DOB, guardian email/phone, notes), so a coach may reasonably try to re-upload this. It is NOT a round trip: the combined "Guardian Name" column has no matching alias, Status and Secondary Position are not read, and the importer is add-only — re-uploading duplicates every player rather than updating them.',
    label: 'Coaches Portal — Team Roster',
    module: 'coaches',
    page: 'Team Roster',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    // ⚠ NO PLAN GATE, AND THAT IS THE RULING — not an omission.
    // This entry asserted `minPlan: 'club'` / `moduleGate: 'club_exports'` for months while the
    // product never behaved that way: the PDF takes the generic `pdf_exports` key (which the
    // standalone Premium Coaches Portal clears by explicit grant) and xlsx/csv take no plan check
    // at all. Owner ruling 2026-08-23 (`BUSINESS_DECISIONS.md`): **roster export is an inclusion
    // of the Premium Coaches Portal** — a coach's own roster is the coach's own data, and
    // enforcing the stale claim would have TAKEN Excel away from paying standalone coaches.
    // The real gate is architectural, not a feature key: a coaches-portal roster exists only for
    // a Premium or club-owned team, so there is no open door to close. Do not add one.
    //
    // ⚠⚠ `minPlan`/`moduleGate` ARE DESCRIPTIVE ONLY — nothing reads them at runtime. That is
    // precisely how this drifted. Never infer a plan's inclusions from this file;
    // `lib/plan-features.ts` and the surface's own guard are the truth.
    audiences: ['coach'],
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'excluded_by_default',
    respectsCurrentFilters: true,
    serverSide: false,
    // Catalog true-up 2026-08-23 (PDF Export Quality, Phase 2 Rosters pass): all three formats
    // have shipped for a long time — the "not yet implemented" note below was stale, and the
    // "travel/insurance sheet" sentence described the ONE roster PDF that used to exist. There
    // are now TWO documents behind the PDF option (owner ruling, decided on rendered paper):
    // the wall copy is the default and carries nothing private; the contacts sheet is a second
    // document row, offered only to a coach cleared for family contacts.
    helpSummary:
      'Export team roster to Excel or CSV, or as two PDFs: the team roster (names, numbers and positions — safe to pin up) and, for coaches cleared for family contacts, a roster with contacts adding dates of birth and guardian details for league or insurance submissions.',
  },
  {
    id: 'coaches-player-dues',
    label: 'Coaches Portal — Player Dues',
    module: 'coaches',
    page: 'Player Dues',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export player dues summary with total fee, amount paid, outstanding balance, and installment status. It is a TEAM SHEET — one row per player, every balance on one page — so it is a coach document, not something to hand a family.',
  },
  {
    id: 'coaches-family-dues-statement',
    label: 'Coaches Portal — Family Dues Statement',
    module: 'coaches',
    page: 'Player Dues',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx',
    formats: ['pdf'],
    defaultFormat: 'pdf',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    includesSensitiveFields: false,
    respectsCurrentFilters: false,
    serverSide: false,
    helpSummary:
      'The dues document a coach can HAND ONE FAMILY: what that household was billed, payments received (with a thank-you), credits earned, what is left, and when the next payment falls due. Siblings share one statement; no other family appears. Two doors: a single family from the player’s drawer, or one PDF with every family on its own page for handing out.',
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
      'Export budget vs. actual report by category and line item. The PDF prints one section per category, so it carries no Category column — the heading is the category.',
  },

  // ── Coaches Portal: the Money hub's Export ▾ menu ────────────────────────
  // Five datasets behind one hub-wide menu (owner ruling 2026-08-13; the coach picks WHAT and
  // WHICH FORMAT on one level). Player dues and budget vs. actual are the same column contracts
  // their own screens ship — catalogued above and unchanged. The three below did not exist on
  // any surface before that pass, which is what made the ruling's "in and out travel together"
  // rule false on the very screen that triggered it.
  //
  // ⚠ ALL THREE ARE SPREADSHEET-ONLY BY DESIGN, and that is what removes them from a phone
  // (rule 11 keys off what an export PRODUCES, never off which screen it sits on).
  {
    /* ⚠ THE CATALOG ID IS UNCHANGED (budget tab revamp, 2026-09-02) — same stable-key reasoning
       as `coaches-expenses-payables` below. The FILE it names was rebuilt under the owner's
       export rider: grouped exactly as the screen is grouped (statement shape from the List,
       month/quarter columns from the By-period view, BvA's own date-header format), with a PDF
       added — the flat one-row-per-line dataset it described is gone. */
    id: 'coaches-budget-lines',
    /* ⚠⚠ THIS CLAIM WAS FALSE FOR A WEEK AND THE GATE COULD NOT SEE IT (2026-09-10). `check:export-
       catalog` verifies only that the named reader FILE EXISTS — so "round trip" stood here while
       the plan's own file came back with no amounts (the money column was renamed `Planned`
       2026-09-02 and the reader's aliases were never told), with every cost line dropped (a word's
       row lost its line marker 2026-09-09), and with every money-in line re-read as a new cost.
       The claim now names its proof in `roundTripTest`, and `check:export-catalog` ENFORCES it.
       This comment used to end "do not let this entry outlive that test" — a note asking a human to
       remember something a gate can simply check, which is the shape of every rule in this file
       that has ever gone stale. */
    roundTrip: 'lib/coach-budget-import.ts',
    roundTripTest: 'tests/unit/coach-budget-plan-round-trip.test.ts',
    label: 'Coaches Portal — Budget plan',
    module: 'coaches',
    page: 'Money → Export ▾',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    // Carries the coach's own planning note on each line ("3 × $1000"), unlike the expenses
    // export below which drops its notes. The asymmetry is deliberate: a budget-line note is
    // written ABOUT A PLANNED COST, whereas an expense note is free text against a real
    // transaction and can end up holding anything.
    includesSensitiveFields: false,
    // Built from the plan the coach is looking at, in the view they are reading it.
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export the season budget plan, grouped exactly as the screen shows it — categories, summed items, each line’s schedule and notes, and the money-in sections; the By-period view exports its month or quarter columns. PDF prints the statement.',
  },
  {
    /* ⚠ THE CATALOG ID IS UNCHANGED (Money split P1, 2026-08-16). It is a stable key the help
       system and the plan-gating tests address this dataset by; the SCREEN it names has split, and
       the label and summary follow the screen. The downloaded files keep their own dataset
       segments (`expenses`, `payables`, `payment-schedule`) for the same reason — a coach's
       downloads folder already holds a season of them.
       ⚠ `money-in` IS NO LONGER ONE OF THEM (money redesign P3). That list held income AND refunds,
       so the file did too; the register splits them into two filters, and the two files that come
       out — `income` and `refund` — each finally mean what their heading says. `register` is the
       whole book, balance column and all. */
    id: 'coaches-expenses-payables',
    roundTripCaveat: 'The Payment Schedule view shares Due date / What / Amount with the bills importer by alias coincidence only; Payee, Category, Deposit and Balance would come back empty. Not a designed round trip.',
    label: 'Coaches Portal — Transactions & payables',
    module: 'coaches',
    page: 'Money → Export ▾',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    // Expense NOTES are deliberately excluded from the column set — free text a coach may have
    // used for anything, so keeping it out leaves this dataset with no sensitive-field policy.
    includesSensitiveFields: false,
    // ⚠ TRUE, and it is the whole reason Export sits on the tab rather than in the hub header
    // (owner ruling 2026-08-13): this export follows the SUB-TAB the coach is on and the money-tag
    // filter beside it.
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export what is on screen on Transactions or Payables — the whole dated register with its running balance, or just one kind of it (expenses, income, refunds, dues, fundraising, club), plus your commitments and the payment schedule. Honours every filter you have set.',
  },
  {
    id: 'coaches-fundraisers',
    label: 'Coaches Portal — Fundraisers',
    module: 'coaches',
    page: 'Money → Export ▾',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/panel.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    // ⚠ PER-FUNDRAISER TOTALS ONLY — never the per-player breakdown, which names children
    // beside the money they raised and stays on the fundraiser's own page.
    includesSensitiveFields: false,
    respectsCurrentFilters: false,
    serverSide: false,
    helpSummary:
      'Export each fundraiser with its rebate, dates, total raised, player credits, the team’s net, and how many players took part.',
  },

  // ── Planned: Phase D2 (P1 new table exports) ────────────────────────────
  {
    id: 'coaches-schedule',
    roundTrip: 'lib/coach-schedule-import.ts',
    /* ⚠ FOUND BY THE SAME `/simplify` PASS THAT ADDED `roundTripTest` (2026-09-10), and it is the
       Budget plan's own defect sitting one file away: this export's column labels are hand-typed on
       the screen (`SCHEDULE_EXPORT_COLS`) and the reader's aliases are hand-typed in
       `coach-schedule-import.ts` — two lists that must agree with nothing tying them together — and
       **no test anywhere calls `rowsFromScheduleFile`**. So this claim has LESS standing behind it
       than the Budget plan's had on the morning its three defects were found.
       It is recorded as a gap rather than quietly accepted. The fix is a round-trip test built from
       `SCHEDULE_EXPORT_COLS`, copying `coach-budget-plan-round-trip.test.ts`, and it belongs to
       whoever owns the schedule importer. ⚠ Do NOT close this by deleting the `roundTrip` claim: the
       product does tell coaches this file reads back, so that promise is either true or it is a
       defect, and deleting the claim would hide the question rather than answer it. */
    /* ⚠ ONE LINE, SINGLE-QUOTED, DELIBERATELY. The gate reads this file as TEXT with a regex (it
       would otherwise need the whole app's module graph to resolve four fields), so a value split
       across lines or built by concatenation is INVISIBLE to it — and an invisible gap reads exactly
       like a missing one. Found on this field's first run. */
    roundTripTestGap: 'No test calls rowsFromScheduleFile. The export column labels are hand-typed on the screen and the reader aliases are hand-typed in the importer, with nothing tying them together — the same shape as the Budget plan rename defect of 2026-09-02. Needs a round-trip test built from SCHEDULE_EXPORT_COLS.',
    label: 'Coaches Portal — Team Schedule',
    module: 'coaches',
    page: 'Team Schedule',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx',
    formats: ['xlsx', 'csv', 'ics'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'club_exports',
    audiences: ['coach'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export team schedule with date, time, arrival time, event type, opponent, location and uniform. iCal adds all events to your calendar.',
    // ⚠ A PDF is OWED here and is deliberately not built yet. Decision 6's floor rule — "a document
    // that is read, handed, or pinned gets a PDF" — plainly covers a team's season on a fridge, and
    // the owner agreed (2026-08-25, Schedules pass checkpoint 1) that it gets one in its OWN pass:
    // it is a new document with its own column decisions, not a variant of the tournament schedule.
    // See PDF_EXPORT_QUALITY_PLAN.md §4.
  },
  {
    id: 'house-league-season-schedule',
    label: 'House League Season Schedule',
    module: 'house_league',
    page: 'Season Schedule',
    file: 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx',
    formats: ['xlsx', 'csv', 'ics'],
    defaultFormat: 'xlsx',
    minPlan: 'league',
    moduleGate: 'league_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export season schedule with date, time, teams, venue, status and score.',
    // A PDF is owed here too, behind the coach one — a league season is pinned in a clubhouse
    // rather than on a fridge (owner, 2026-08-25).
  },
  {
    id: 'house-league-season-standings',
    label: 'House League Season Standings',
    module: 'house_league',
    page: 'Season Standings',
    file: 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'league',
    moduleGate: 'league_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export season standings by team with W, L, T, points, GF, and GA.',
  },
  {
    id: 'house-league-season-teams',
    label: 'House League Season Teams',
    module: 'house_league',
    page: 'Season Teams',
    file: 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'league',
    moduleGate: 'league_exports',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export season team list with team name, division, and player count.',
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
  },
  {
    // Catalog true-up 2026-08-22 (PDF Export Quality Phase 1): the xlsx/csv exports have been
    // live on this page all along — the entry wrongly claimed the whole export was unbuilt,
    // and pointed at a path that never existed. The PDF stub (an info modal promising org
    // branding no org had ever printed) came OUT of the menu (decision 2). The real rep roster
    // PDF shipped in the Phase 2 Rosters pass (2026-08-23) and joins `formats` here with it.
    id: 'rep-teams-roster-admin',
    label: 'Rep Teams Roster (admin view)',
    module: 'rep_teams',
    page: 'Program Year Roster',
    file: 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/page.tsx',
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
      'Export rep team roster with player names, numbers, DOB, and status. The PDF prints on the club’s paper, grouped by each player’s standing with a count on every heading — names, numbers and positions only, with no dates of birth or guardian contacts.',
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
    id: 'org-venues',
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
    file: 'app/platform-admin/orgs/OrgsClient.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export filtered org list with name, slug, plan, subscription status, and created date.',
  },
  {
    id: 'platform-admin-founding-season',
    label: 'Platform Admin — Founding Season',
    module: 'platform_admin',
    page: 'Founding Season',
    file: 'app/platform-admin/founding-season/FoundingSeasonDeskClient.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    // The billing contact is the account owner's email — the same data the Organizations and
    // Customer Users exports already carry for the same reason: the September 2027 conversion is a
    // sequence of conversations with named people, and a list without their address is not a list.
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'included_justified',
    sensitiveFieldJustification:
      'The billing contact is the whole point of the export: it is the list the operator works through when a free season ends. Platform-admin only, internal tooling, never exposed to customers.',
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export the founding cohort — account, kind, plan, free-period end, card on file, next-season plan choice, owner last sign-in, usage and billing contact — honouring the on-screen filters.',
  },
  {
    id: 'platform-admin-customer-users',
    label: 'Platform Admin — Customer Users',
    module: 'platform_admin',
    page: 'Customer Users',
    file: 'app/platform-admin/customer-users/CustomerUsersClient.tsx',
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
    file: 'app/platform-admin/audit/AuditExportClient.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: true,
    helpSummary: 'Server-side export of filtered platform audit log entries via the API route. Supports xlsx and csv format parameters.',
  },

  /* ── Surfaces that were exporting without an entry (added 2026-09-06) ──────────────────────
     Five screens shipped an export and never joined the registry. None of them was hidden — they
     are on live nav — so the registry was simply not kept. That is what `check:export-catalog`
     now prevents: a screen cannot gain an Export button without gaining a row here. */

  // ── Coaches: Budget vs. Actual ───────────────────────────────────────────
  {
    id: 'coaches-budget-vs-actual',
    label: 'Coach Budget vs. Actual',
    module: 'coaches',
    page: 'Money → Budget vs. Actual',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx',
    formats: ['xlsx', 'csv', 'pdf'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'coach_money',
    audiences: ['coach'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary:
      'Export the team\'s budget against what actually happened, in whichever shape is on screen — the Statement, By activity, or a column per month. The file opens on a header naming the team, the season, the reading it was cut on and the day it was true, and closes with the notes explaining what the figures mean.',
  },

  // ── Coaches: Club money ──────────────────────────────────────────────────
  {
    id: 'coaches-club-money',
    label: 'Club Money (allocations & requests)',
    module: 'coaches',
    page: 'Money → Club',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'club',
    moduleGate: 'coach_money',
    audiences: ['coach'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export what the club has billed the team and what the team has asked the club to cover, with each item\'s status.',
  },

  // ── Tournaments: Venues ──────────────────────────────────────────────────
  {
    id: 'tournament-venues',
    label: 'Tournament Venues',
    module: 'tournaments',
    page: 'Venues & Facilities',
    file: 'app/[orgSlug]/admin/tournaments/venues/page.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    minPlan: 'tournament',
    audiences: ['org_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: false,
    helpSummary: 'Export the venue and facility list with addresses and field names.',
  },

  // ── Platform: Feedback queue ─────────────────────────────────────────────
  {
    id: 'platform-admin-feedback',
    label: 'Feedback Queue',
    module: 'platform_admin',
    page: 'Support & Diagnostics → Feedback',
    file: 'app/platform-admin/feedback/FeedbackExportClient.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    /* In-app feedback carries whatever a customer typed and the account it came from. Internal
       surface, platform staff only — but it is customer content, so it is marked as such. */
    includesSensitiveFields: true,
    sensitiveFieldPolicy: 'included_justified',
    sensitiveFieldJustification:
      'Platform admin only, never reachable by a customer. Triage requires the submitter and the message together — an anonymised feedback queue cannot be answered or followed up.',
    respectsCurrentFilters: true,
    serverSide: true,
    helpSummary: 'Export the in-app feedback queue for triage. Platform staff only.',
  },

  // ── Platform: Observability issues ───────────────────────────────────────
  {
    id: 'platform-admin-observability-issues',
    label: 'Observability Issues',
    module: 'platform_admin',
    page: 'Support & Diagnostics → Observability',
    file: 'app/platform-admin/observability/IssuesExportClient.tsx',
    formats: ['xlsx', 'csv'],
    defaultFormat: 'xlsx',
    audiences: ['platform_admin'],
    includesSensitiveFields: false,
    respectsCurrentFilters: true,
    serverSide: true,
    helpSummary: 'Export the error and issue list for a period, to work through outside the console. Platform staff only.',
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
