# House League Module Plan (`module_house_league`)

**Phase 5 of PLATFORM_ROADMAP.md** — Seasonal recreational league management.

**Status:** In progress — Migration 020, C2 role expansion, Phase 5B (types + DB helpers) complete. Phase 5C shell (C3 sidebar nav, C4 hub tile, C5 layout passthrough) complete. Phase 5D next (confirm before proceeding).

**Answers to pre-implementation questions:**
- Q1/Q2: A season represents one age group (e.g., "U11 Summer 2025"). Each age group gets its own season entity. Within a season, optional divisions allow large age groups to be split into independent sub-groups with separate schedules and standings.
- Q3: Fee collection is external. FieldLogicHQ tracks fees in accounting but does not process payments.
- Q4: Registrants are almost always minors. Registration forms collect both player info and a separate parent/guardian contact record.
- Q5: A player may only be registered in one division per season. Waitlist promotion is manual — admin-controlled — to allow for priority and availability confirmation before a spot is offered.
- Q6: Introduce `league_admin` and `league_registrar` as new OrgRoles. Single-role model is retained for Phase 5; cross-module access (e.g., a `league_admin` who also manages accounting) is achieved via capability override. Multi-role architecture is deferred as a C2 follow-on decision.
- Q7: House league uses a distinct scheduling model — round-robin weekly games, no brackets or elimination rounds.
- Q8: All three team placement modes are in scope: randomize, manual adjustment, and structured draft.
- Q9: Option B — lightweight scoped email dispatch built into the house league module. `module_communications` remains org-member-facing and is not modified in Phase 5. C3 consolidation is deferred post-Phase 6.
- Q10: Admin choice per season — auto-generate accounting entries when a registration is approved, or log fees manually. The toggle is a per-season setting.

---

## For the Product Manager

**What changes for an org admin after Phase 5:**

Today, recreational leagues are managed with a combination of spreadsheets, email threads, and phone calls. Registration is manual, team placement is a separate exercise, and there is no single place to view a season's schedule, standings, and player roster at the same time.

After Phase 5, an org admin using the House League module can:

- **Create and manage seasons** — A season represents one age group's program (e.g., "U11 Summer 2025"). Each season has a full lifecycle: Draft → Registration Open → Registration Closed → Active → Completed. The admin controls when registration opens and closes.
- **Divide a large season into independent divisions** — If a U11 age group has 60 players across 8 teams, split them into Division A (4 teams) and Division B (4 teams), each with their own schedule and standings. Or leave the season as a single division. Either works.
- **Publish a public registration form** — Once registration opens, a public link goes live at `fieldlogichq.ca/{orgSlug}/league/{seasonSlug}/register`. Parents fill out player info and their own contact details, choose a division, and submit. No login required. They receive a confirmation email automatically.
- **Manage the registration queue** — The admin sees every submission in a list: pending review, active, waitlisted, or declined. They approve, waitlist, or decline individual registrations. Waitlist promotion is manual — the admin reviews the list and promotes specific players, then the system sends the parent an approval email.
- **Build teams three ways** — After registration closes: (1) **Randomize** — one click distributes all active registrants across a set number of teams, as balanced as possible. (2) **Manual** — drag-and-drop player cards onto teams, or use a team selector per player row. (3) **Draft** — a structured pick-order system where the admin advances the draft turn by turn, assigning players round-robin across teams.
- **Schedule and track games** — Create a round-robin schedule for each division (manually or auto-generated), enter game scores, and mark games as completed, postponed, or cancelled. The schedule is week-by-week, not a bracket.
- **View live standings** — Standings are computed from completed games: W/L/T record, points (W=2, T=1, L=0), runs for, runs against, and run differential. Sorted by points, then run differential.
- **Email registrants directly** — A notification tool built into the module lets the admin pick an audience (all registrants in a season, a specific division, a specific team, or the waitlist) and send a message via email. One-click to reach "all U13 Division A parents" without leaving the app.
- **Track registration fees in accounting** — If the accounting module is enabled, each season can optionally auto-generate an accounting entry when a registration is approved (income, pending status, amount set by the admin at season creation). Or the admin records fees manually in the accounting ledger. Either way, the season gets its own ledger entry in the accounting overview.
- **Review past seasons** — Completed and archived seasons appear in a "Past Seasons" section inside the house league module. Full history: roster, schedule, scores, and standings — all read-only.

**What this is not:**

This module does not process registration payments. Parents pay by whatever method the org uses (e-transfer, cash, cheque). FieldLogicHQ records whether the fee has been logged — it does not collect, hold, or transfer money.

This module also does not manage competitive rep teams, tryouts, or player documents. That is `module_rep_teams` (Phase 6).

---

## Goals

1. Introduce a parent-child season/division entity model that handles both simple (one division) and complex (multiple divisions) league structures without schema branching.
2. Design the C5 public registration form pattern here — the first public-facing form in the platform that works without a login. Build it reusably so Phase 6 (rep team tryout signups) can follow the same pattern.
3. Implement the C2 role model expansion: add `league_admin`, `league_registrar`, and `treasurer` to `OrgRole` and `ROLE_DEFAULTS`. (Accounting plan explicitly deferred `treasurer` to this phase.)
4. Keep house league scheduling entirely separate from tournament scheduling — different entity types, different UI, no shared components.
5. Apply all five layers of the Module Build Checklist.
6. Integrate with the existing accounting module via the `league_season` ledger type that is already reserved in the `accounting_ledgers` schema.
7. Defer multi-role architecture (a person holding two roles simultaneously) and C3 comms consolidation until both house league and rep teams are shipped.

---

## C2 — Role Model Expansion ✅ Complete

This is a prerequisite for Phase 5 and must be completed before implementing any route handlers or capability gates. It also closes the deferred `treasurer` item from the accounting plan.

### New Roles to Add

**`league_admin`**
- Full access to `module_house_league` — can create and manage seasons, divisions, teams, schedule, standings, registrations, and send notifications.
- Does NOT get `module_accounting`, `billing`, or other module caps by default.
- Typically assigned to the person who runs the league program.

**`league_registrar`**
- Read + write access to registration management only (view registrations, approve, waitlist, decline, promote from waitlist, send notifications to registrants).
- Cannot create or edit seasons, cannot manage teams, cannot enter game scores.
- Gets `module_house_league` cap by default — route handlers perform the additional role check for admin-only actions.
- Typically assigned to a volunteer who handles the registration inbox.

**`treasurer`** *(deferred from ACCOUNTING_MODULE_PLAN.md)*
- Gets `module_accounting` cap by default and read-only `module_members` cap.
- Does NOT get `billing`, `module_house_league`, or other module caps.
- All accounting route handlers gated to `owner` must be updated to also accept `treasurer`.
- `canSeeAccounting` sidebar check must be updated to include `treasurer`.

### Changes Required

**File: `lib/types.ts`**

Add to `OrgRole` union type:
```ts
export type OrgRole = 'owner' | 'admin' | 'official' | 'league_admin' | 'league_registrar' | 'treasurer';
```

**File: `lib/roles.ts` (or wherever `ROLE_DEFAULTS` lives)**

Add default capability sets:
```ts
ROLE_DEFAULTS['league_admin'] = [
  'module_house_league',
  'module_members',        // read-only members access for team/roster context
];

ROLE_DEFAULTS['league_registrar'] = [
  'module_house_league',
];

ROLE_DEFAULTS['treasurer'] = [
  'module_accounting',
  'module_members',        // read-only
];
```

**File: `components/admin/ManageModal.tsx` (or capability override UI)**

Add the three new roles to any role selector dropdowns and confirm the capability override panel renders them correctly.

**File: `app/api/admin/accounting/` — all owner-gated routes**

Add `treasurer` to write guards:
```ts
if (ctx.role !== 'owner' && ctx.role !== 'treasurer') return forbidden();
```

**File: `components/admin/AdminSidebar.tsx`**

Update `canSeeAccounting`:
```ts
const canSeeAccounting = userRole
  ? hasCapability(userRole, userCapabilities, 'module_accounting')
  : false;
// No change to the check itself — adding 'treasurer' to ROLE_DEFAULTS means the capability is already present.
// Verify ROLE_DEFAULTS['treasurer'] includes 'module_accounting' and this condition resolves correctly.
```

---

## Module Build Checklist (all five layers are mandatory)

| Layer | Phase |
|---|---|
| Route handler gate (`hasCapability` + `hasModuleEntitlement`) | 5C — C section |
| Page component guard (`<AccessDenied />` when cap missing) | 5C — D section |
| Sidebar nav item + section detection | 5C — E3 |
| Hub tile | 5C — E4 |
| Org admin layout passthrough | 5C — D1 |

---

## Phase 5A — DB Schema (Migration 020) ✅ Complete

> Verify the next migration number against `supabase/migrations/` before creating the file.

**File:** `supabase/migrations/019_house_league.sql`

```sql
-- ---------------------------------------------------------------
-- league_seasons: one row per age-group season.
-- Each age group runs as its own season entity (e.g., "U11 Summer 2025").
-- status lifecycle: draft → registration_open → registration_closed
--                   → active → completed → archived
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_seasons (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  slug                   text        NOT NULL,
  sport                  text        NOT NULL DEFAULT 'softball',
  age_group              text,                           -- e.g. 'U11', 'U13', 'Adult'
  status                 text        NOT NULL DEFAULT 'draft'
                                     CHECK (status IN (
                                       'draft','registration_open','registration_closed',
                                       'active','completed','archived'
                                     )),
  description            text,
  registration_fee       numeric(8,2),                  -- display-only on registration form; not collected here
  auto_generate_fees     boolean     NOT NULL DEFAULT false,  -- Phase 5L: auto-create accounting entries on approval
  auto_approve_under_capacity boolean NOT NULL DEFAULT false, -- auto-approve submissions while division has capacity
  auto_promote_waitlist  boolean     NOT NULL DEFAULT false,  -- auto-promote next waitlisted player when a spot opens
  registration_open_at   timestamptz,
  registration_close_at  timestamptz,
  season_start_date      date,
  season_end_date        date,
  waiver_text            text,                           -- optional waiver shown on public registration form
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

-- ---------------------------------------------------------------
-- league_divisions: optional sub-groups within a season.
-- Small leagues may have one division (e.g., "Division A").
-- Large leagues split into multiple divisions with independent
-- schedules and standings.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_divisions (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  name        text    NOT NULL,           -- e.g. 'Division A', 'Division 1'
  capacity    int,                        -- max active registrations; NULL = unlimited
  sort_order  int     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- league_teams: named teams within a division.
-- Created by the admin before or during the draft/placement phase.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_teams (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id    uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id  uuid    NOT NULL REFERENCES league_divisions(id) ON DELETE CASCADE,
  name         text    NOT NULL,
  color        text,               -- optional hex colour for display (e.g. '#E03030')
  coach_name   text,               -- optional free text; not linked to an org member in Phase 5
  sort_order   int     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- league_registrations: one row per player registration submission.
-- status flow:
--   pending_review → active (approved by admin)
--   pending_review → waitlisted (division full; manual admin review)
--   pending_review → declined
--   active | waitlisted → withdrawn (player/guardian cancels)
-- waitlist_position: set when status = 'waitlisted'; NULL otherwise.
-- team_id: set after draft/placement phase; NULL until then.
-- fee_entry_id: set when auto_generate_fees=true and registration is approved.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_registrations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id             uuid        NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id           uuid        REFERENCES league_divisions(id) ON DELETE SET NULL,
  -- Player info
  player_first_name     text        NOT NULL,
  player_last_name      text        NOT NULL,
  player_date_of_birth  date,
  player_jersey_pref    text,
  player_position_pref  text,
  player_notes          text,               -- experience, medical notes etc. (public form, guardian-supplied)
  -- Guardian info
  guardian_first_name   text        NOT NULL,
  guardian_last_name    text        NOT NULL,
  guardian_email        text        NOT NULL,
  guardian_phone        text,
  -- Administrative
  status                text        NOT NULL DEFAULT 'pending_review'
                                    CHECK (status IN (
                                      'pending_review','active','waitlisted','declined','withdrawn'
                                    )),
  waitlist_position     int,
  team_id               uuid        REFERENCES league_teams(id) ON DELETE SET NULL,
  registration_fee_paid boolean     NOT NULL DEFAULT false,
  fee_entry_id          uuid,               -- FK to accounting_entries.id (nullable; set by Phase 5L)
  admin_notes           text,               -- internal admin-only notes; never shown on public form
  source                text        NOT NULL DEFAULT 'public_form'
                                    CHECK (source IN ('public_form','admin_manual')),
  registered_at         timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_registrations_season_idx    ON league_registrations(season_id);
CREATE INDEX IF NOT EXISTS league_registrations_division_idx  ON league_registrations(division_id);
CREATE INDEX IF NOT EXISTS league_registrations_status_idx    ON league_registrations(season_id, status);
CREATE INDEX IF NOT EXISTS league_registrations_guardian_idx  ON league_registrations(guardian_email);

-- ---------------------------------------------------------------
-- league_games: scheduled games between two teams in a division.
-- status: scheduled → completed | cancelled | postponed
-- home_score / away_score: NULL until game is completed.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_games (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id     uuid    NOT NULL REFERENCES league_divisions(id) ON DELETE CASCADE,
  home_team_id    uuid    NOT NULL REFERENCES league_teams(id) ON DELETE CASCADE,
  away_team_id    uuid    NOT NULL REFERENCES league_teams(id) ON DELETE CASCADE,
  scheduled_at    timestamptz,
  location        text,                       -- diamond name / field number / address
  home_score      int,
  away_score      int,
  status          text    NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','completed','cancelled','postponed')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_games_season_idx      ON league_games(season_id);
CREATE INDEX IF NOT EXISTS league_games_division_idx    ON league_games(division_id);
CREATE INDEX IF NOT EXISTS league_games_schedule_idx    ON league_games(season_id, scheduled_at);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE league_seasons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_divisions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_teams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_games         ENABLE ROW LEVEL SECURITY;

-- Org members: read their org's seasons
CREATE POLICY "org members can read seasons"
  ON league_seasons FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Public: read seasons that are open or later (for the registration form and public schedule/standings)
CREATE POLICY "public can read non-draft seasons"
  ON league_seasons FOR SELECT
  USING (status IN ('registration_open','registration_closed','active','completed'));

-- Divisions: org member read
CREATE POLICY "org members can read divisions"
  ON league_divisions FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Divisions: public read for non-draft seasons
CREATE POLICY "public can read divisions of non-draft seasons"
  ON league_divisions FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE status IN ('registration_open','registration_closed','active','completed')
  ));

-- Teams: org member read
CREATE POLICY "org members can read teams"
  ON league_teams FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Teams: public read for active/completed seasons only (not during registration)
CREATE POLICY "public can read teams of active seasons"
  ON league_teams FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons WHERE status IN ('active','completed')
  ));

-- Registrations: org members only (guardian contact info is private)
CREATE POLICY "org members can read registrations"
  ON league_registrations FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Public insert: allowed only for registration_open seasons (no auth required)
CREATE POLICY "public can submit registrations"
  ON league_registrations FOR INSERT
  WITH CHECK (
    season_id IN (SELECT id FROM league_seasons WHERE status = 'registration_open')
  );

-- Games: org member read
CREATE POLICY "org members can read games"
  ON league_games FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Games: public read for active/completed seasons
CREATE POLICY "public can read games of active seasons"
  ON league_games FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons WHERE status IN ('active','completed')
  ));
```

---

## Phase 5B — TypeScript Types + DB Helpers ✅ Complete

### B1 — Add to `lib/types.ts`

```ts
export type LeagueSeasonStatus =
  | 'draft' | 'registration_open' | 'registration_closed'
  | 'active' | 'completed' | 'archived';

export type LeagueRegistrationStatus =
  | 'pending_review' | 'active' | 'waitlisted' | 'declined' | 'withdrawn';

export type LeagueGameStatus =
  | 'scheduled' | 'completed' | 'cancelled' | 'postponed';

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
```

### B2 — Add to `lib/db.ts`

Key helper signatures (full implementations follow the same pattern as accounting helpers):

```ts
// Seasons
export async function getLeagueSeasons(orgId: string): Promise<LeagueSeason[]>
export async function getLeagueSeasonBySlug(orgId: string, slug: string): Promise<LeagueSeason | null>
export async function getLeagueSeasonById(seasonId: string, orgId: string): Promise<LeagueSeason | null>
export async function createLeagueSeason(orgId: string, input: LeagueSeasonInput): Promise<LeagueSeason>
export async function updateLeagueSeason(seasonId: string, orgId: string, input: Partial<LeagueSeasonInput>): Promise<void>

// Divisions
export async function getDivisionsForSeason(seasonId: string): Promise<LeagueDivision[]>
export async function createDivision(seasonId: string, input: { name: string; capacity?: number }): Promise<LeagueDivision>
export async function updateDivision(divisionId: string, input: Partial<{ name: string; capacity: number | null }>): Promise<void>
export async function deleteDivision(divisionId: string): Promise<void>  // guard: no active registrations

// Teams
export async function getTeamsForSeason(seasonId: string): Promise<LeagueTeam[]>
export async function getTeamsForDivision(divisionId: string): Promise<LeagueTeam[]>
export async function createLeagueTeam(seasonId: string, divisionId: string, input: LeagueTeamInput): Promise<LeagueTeam>
export async function updateLeagueTeam(teamId: string, input: Partial<LeagueTeamInput>): Promise<void>
export async function deleteLeagueTeam(teamId: string): Promise<void>    // guard: no assigned players

// Registrations
export async function getRegistrationsForSeason(seasonId: string, opts?: { status?: LeagueRegistrationStatus }): Promise<LeagueRegistration[]>
export async function getRegistrationsForDivision(divisionId: string, opts?: { status?: LeagueRegistrationStatus }): Promise<LeagueRegistration[]>
export async function createRegistration(input: PublicRegistrationInput): Promise<LeagueRegistration>
export async function updateRegistrationStatus(registrationId: string, status: LeagueRegistrationStatus, adminNotes?: string): Promise<void>
export async function assignRegistrationToTeam(registrationId: string, teamId: string): Promise<void>
export async function bulkAssignTeams(assignments: Array<{ registrationId: string; teamId: string }>): Promise<void>
export async function getWaitlistForDivision(divisionId: string): Promise<LeagueRegistration[]>  // ordered by waitlist_position
export async function promoteFromWaitlist(registrationId: string): Promise<void>  // status → active, clears waitlist_position

// Games
export async function getGamesForDivision(divisionId: string): Promise<LeagueGame[]>
export async function createLeagueGame(input: LeagueGameInput): Promise<LeagueGame>
export async function updateLeagueGame(gameId: string, input: Partial<LeagueGameInput>): Promise<void>
export async function enterGameResult(gameId: string, homeScore: number, awayScore: number): Promise<void>

// Standings (computed, not stored)
export async function computeStandings(divisionId: string): Promise<LeagueStandingsRow[]>

// Summary for overview
export async function getLeagueSeasonSummary(season: LeagueSeason): Promise<LeagueSeasonSummary>
```

**`computeStandings` algorithm:**
1. Fetch all `completed` games for the division.
2. For each team: count W/L/T from games where the team is home or away.
3. Points = W×2 + T×1.
4. Sort: points DESC, runDifferential DESC, runsFor DESC.

---

## Phase 5C — Module Shell (Module Build Checklist) ✅ Complete

### C1 — Route Handler Gate Pattern

All house league API routes begin with:
```ts
const ctx = await getAuthContextWithScope();
if (!ctx) return unauthorized();
if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
```

For write operations that are `league_admin`-only (season management, team management, score entry):
```ts
if (ctx.role !== 'owner' && ctx.role !== 'league_admin') return forbidden();
```

For write operations accessible to both `league_admin` and `league_registrar` (registration status updates, waitlist management):
```ts
const canManageRegistrations =
  ctx.role === 'owner' || ctx.role === 'league_admin' || ctx.role === 'league_registrar';
if (!canManageRegistrations) return forbidden();
```

### C2 — Page Component Guard

In all admin house league pages (after `useOrg()` resolves):
```tsx
if (!hasCapability(userRole, userCapabilities, 'module_house_league')) {
  return (
    <div className="p-8 text-center">
      <Users size={32} className="mx-auto mb-4 opacity-40" />
      <h2 className="font-bold text-lg mb-2">Access Restricted</h2>
      <p className="text-sm text-data-gray">
        You don't have access to the House League module.
        Contact your organization owner to enable it.
      </p>
    </div>
  );
}
```

For `league_registrar` accessing admin-only sub-pages (e.g., team placement), render a more specific message:
```tsx
<p className="text-sm text-data-gray">
  This section is restricted to league administrators.
</p>
```

### C3 — Sidebar Nav Item

**File:** `components/admin/AdminSidebar.tsx`

Add detection variable:
```ts
const isHouseLeague = pathname.startsWith(`${base}/house-league`);

const canSeeHouseLeague = userRole
  ? hasCapability(userRole, userCapabilities, 'module_house_league')
  : false;
```

Update tournament operations guard to exclude house league section:
```ts
{!isHub && !isOrgAdmin && !isPublicSite && !isAccounting && !isHouseLeague && (
```

Add house league sidebar block. The sidebar is season-context-aware: when the admin is inside a specific season's sub-pages, a secondary nav group appears.

```tsx
{isHouseLeague && canSeeHouseLeague && (
  <>
    {backLink}
    <div className={styles.navSection}>
      <div className={styles.sectionHeader}>House League</div>
      <nav className={styles.nav}>
        {navLink('hl-seasons', CalendarDays, 'Seasons',
          `${base}/house-league`, pathname === `${base}/house-league`)}
        {navLink('hl-past', Archive, 'Past Seasons',
          `${base}/house-league/past`,
          pathname.startsWith(`${base}/house-league/past`))}
      </nav>
    </div>
    {/* Season-level nav: rendered when a season ID is in the path */}
    {currentSeasonId && (
      <div className={styles.navSection}>
        <div className={styles.sectionHeader}>{currentSeasonName}</div>
        <nav className={styles.nav}>
          {navLink('hl-registrations', ClipboardList, 'Registrations', `${base}/house-league/seasons/${currentSeasonId}/registrations`, ...)}
          {navLink('hl-teams', Users, 'Teams & Draft', `${base}/house-league/seasons/${currentSeasonId}/teams`, ...)}
          {navLink('hl-schedule', Calendar, 'Schedule', `${base}/house-league/seasons/${currentSeasonId}/schedule`, ...)}
          {navLink('hl-standings', Trophy, 'Standings', `${base}/house-league/seasons/${currentSeasonId}/standings`, ...)}
          {navLink('hl-notifications', Bell, 'Notifications', `${base}/house-league/seasons/${currentSeasonId}/notifications`, ...)}
        </nav>
      </div>
    )}
  </>
)}
```

`currentSeasonId` and `currentSeasonName` are extracted from the pathname using a regex match against `house-league/seasons/[id]`.

### C4 — Hub Tile

**File:** `app/[orgSlug]/admin/page.tsx`

```tsx
const canSeeHouseLeague = !loading && userRole
  ? hasCapability(userRole, userCapabilities, 'module_house_league')
  : false;

// Add to tiles array:
canSeeHouseLeague && {
  label: 'House League',
  desc: 'Manage recreational seasons, player registrations, team placement, scheduling, and standings',
  icon: CalendarDays,
  href: `${base}/house-league`,
},
```

### C5 — Layout Passthrough

**File:** `app/[orgSlug]/admin/house-league/layout.tsx`

```tsx
export default function HouseLeagueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

---

## Phase 5D — Season + Division Management

### API Routes

**`app/api/admin/house-league/seasons/route.ts`**
```
GET  — list all seasons for org (with summary: registration count, team count, status)
POST — create a new season (league_admin or owner only)
```

POST body:
```ts
{
  name: string;           // max 120 chars
  slug: string;           // auto-suggested from name, unique per org
  sport: string;          // default 'softball'
  ageGroup: string | null;
  description: string | null;
  registrationFee: number | null;
  autoGenerateFees: boolean;
  autoApproveUnderCapacity: boolean;   // skip pending_review; approve on submit if capacity available
  autoPromoteWaitlist: boolean;        // auto-promote next waitlisted player when a spot opens
  registrationOpenAt: string | null;   // ISO datetime
  registrationCloseAt: string | null;
  seasonStartDate: string | null;      // YYYY-MM-DD
  seasonEndDate: string | null;
  waiverText: string | null;
}
```

**`app/api/admin/house-league/seasons/[seasonId]/route.ts`**
```
GET   — season detail with divisions and registration summary
PATCH — update season fields (league_admin or owner only)
```

Lifecycle transitions via PATCH on `status`. Guard rules:
- `draft → registration_open`: allowed if at least one division exists.
- `active → completed`: allowed at any time by owner or league_admin.
- `completed → archived`: allowed; creates or archives the season's accounting ledger.
- No backwards transitions (no `registration_open → draft`).

**`app/api/admin/house-league/seasons/[seasonId]/divisions/route.ts`**
```
GET  — list divisions for season (with capacity used / capacity total)
POST — create division (league_admin or owner only)
```

**`app/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]/route.ts`**
```
PATCH  — rename, update capacity
DELETE — only if zero registrations assigned to this division
```

### Admin UI Pages

**`app/[orgSlug]/admin/house-league/page.tsx`** — Season List

Server or client component. After the capability guard:
- Page header: "House League"
- Season cards: name, age group badge, status badge, registration count, quick-action buttons (Open Registration, View, Edit)
- Owner / `league_admin` only: "Create Season" button → modal or dedicated page. Season creation form includes an **Automation** section with two toggles:
- **Auto-approve registrations** (off by default) — "Automatically approve registrations while a division has open spots. Submissions will go directly to Active status without manual review."
- **Auto-promote from waitlist** (off by default) — "Automatically move the next waitlisted player to Active when a spot opens due to a withdrawal or decline."

Both toggles are editable after creation (in season settings) and take effect immediately — turning on auto-approve mid-registration will not retroactively approve pending-review submissions, but all new submissions will be auto-approved going forward.
- Status badges use distinct colours: Draft (grey), Registration Open (green), Registration Closed (amber), Active (blue), Completed (purple)

**`app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx`** — Season Overview

Season header: name, age group, status, dates. Division cards below: each card shows division name, capacity bar (registrations / capacity), team count, and links to registration/schedule/standings sub-pages.

Owner / `league_admin` only: division creation, season settings edit, lifecycle status controls.

---

## Phase 5E — Public Registration Form (C5 Pattern)

This is the first public-facing form in the platform. The pattern established here is reused by Phase 6 (rep team tryout signups).

### Public Route

**`app/[orgSlug]/league/[seasonSlug]/page.tsx`** — Season Landing (public)

Displays: season name, age group, description, open/close dates, registration fee (if set), list of divisions with capacity indicators. If `status === 'registration_open'`, shows a "Register Now" call-to-action.

**`app/[orgSlug]/league/[seasonSlug]/register/page.tsx`** — Registration Form (public, no auth)

This is a server-rendered page that loads the season and its divisions. The form itself is a client component (`RegisterForm`).

Form sections:

**Section 1 — Division Selection**
- Dropdown or radio cards showing each division with available spots remaining.
- If a division is full: shows "Waitlist" label; submission proceeds but status will be set to `waitlisted`.
- If the season is not `registration_open`: renders an "Registration is not currently open" message and no form.

**Section 2 — Player Information**
- Player first name, last name (required)
- Date of birth (required; date picker)
- Jersey number preference (optional; text, max 3 chars)
- Position preference (optional; dropdown for sport)
- Additional notes for the league (optional; textarea, max 500 chars — e.g., medical notes, experience level)

**Section 3 — Parent/Guardian Information**
- Guardian first name, last name (required)
- Guardian email (required; validated format)
- Guardian phone (optional)

**Section 4 — Waiver/Agreement**
- If `season.waiverText` is set: renders the text in a scrollable box with a required acknowledgement checkbox.
- If not set: section is hidden.

**Section 5 — Submit**
- Submit button: "Submit Registration"
- On success: replaces form with a confirmation panel showing player name, division, and reference (registration ID truncated to 8 chars). Instructs parent to watch for a confirmation email.
- On error: inline validation messages.

### Registration API (public — no auth required)

**`app/api/league/[orgSlug]/[seasonSlug]/register/route.ts`** *(public route, outside `/api/admin/`)*

```
POST — submit a new registration
```

Server-side:
1. Resolve org by `orgSlug`, season by `seasonSlug` within that org.
2. Verify `season.status === 'registration_open'`; return 409 if not.
3. Validate all required fields; return 400 with field errors if invalid.
4. Check division capacity and automation settings:
   - Count active (`active` status) registrations for the chosen division.
   - **Under capacity path:** `division.capacity` is null OR active count < capacity:
     - If `season.auto_approve_under_capacity` is true: set `status = 'active'`. Send immediate approval email ("Your registration has been approved").
     - If `season.auto_approve_under_capacity` is false: set `status = 'pending_review'`. Send pending-review email ("We've received your registration — an admin will review it shortly").
   - **At capacity path:** set `status = 'waitlisted'`, set `waitlist_position` = current waitlist count + 1. Send waitlist email regardless of automation settings (no auto-approve when full).
5. Insert into `league_registrations`.
6. Send confirmation email to `guardian_email` via Resend:
   - Approved path: "Thank you — your registration for [Player Name] has been received. An admin will review it shortly."
   - Waitlisted path: "Your registration for [Player Name] has been received. The [Division Name] is currently full and you have been added to the waitlist. We will contact you if a spot becomes available."
7. Return `{ id, status, waitlistPosition }`.

Rate limiting consideration: add a basic IP-based rate limit (max 5 submissions per hour from a single IP) to prevent form spam. Implement as a simple in-memory check or via a `registrations_ip_log` table. Note: this is a deferred hardening item — log a note in the plan rather than blocking implementation.

### Status Notification Emails

Triggered by admin status updates (Phase 5F), not the public form:

- `pending_review → active`: "Great news! [Player Name]'s registration for [Season Name] — [Division Name] has been approved."
- `pending_review → waitlisted`: "We've received your registration for [Player Name]. Unfortunately [Division Name] is currently full. You've been added to the waitlist at position [N]."
- `waitlisted → active` (waitlist promotion): "[Player Name] has been moved off the waitlist and is now registered for [Division Name]. Welcome!"
- `active | pending_review → declined`: "We're sorry — [Player Name]'s registration for [Season Name] was not approved. Please contact [org contact email] for more information."

All emails use the org's existing Resend setup and the FieldLogicHQ email templates.

---

## Phase 5F — Registration Management Admin

### API Routes

**`app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts`**
```
GET  — list registrations (supports ?status=&divisionId=&search=)
POST — manually add a registration (admin_manual source; league_admin or owner only)
```

Search filter (`?search=`): matches player first/last name or guardian email. Useful for admins looking up a specific family.

**`app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts`**
```
GET   — single registration detail
PATCH — update status, division assignment, team assignment, fee_paid flag, admin_notes
```

PATCH guards:
- Status changes: `canManageRegistrations` check (owner, league_admin, league_registrar).
- Team assignment: `league_admin` or `owner` only (done during draft/placement phase).
- Status transition `waitlisted → active` (manual promote): use `promoteFromWaitlist` helper; triggers approval email.

**Auto-promote trigger:** Whenever a registration's status transitions to `withdrawn` or `declined` (freeing a spot), the route handler checks `season.auto_promote_waitlist`:
- If true: query the waitlist for the same division ordered by `waitlist_position ASC`, take the first result, call `promoteFromWaitlist` on it (sets status = `active`, clears `waitlist_position`, compacts remaining positions), and send the approval email. This runs synchronously within the same request so the admin sees the outcome immediately.
- If false: the spot opens and the admin promotes manually from the waitlist tab.

Edge case: if `auto_promote_waitlist` is true and a bulk status change frees multiple spots at once (not in scope for Phase 5), only the first waitlisted player is promoted per request. Bulk promotion is a deferred enhancement.

### Admin UI Page

**`app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx`**

Client component with tabs: **Pending Review** | **Active** | **Waitlist** | **Declined/Withdrawn** | **All**

Each tab shows a table:
- Player name, Division, Guardian email, Phone, Registered at, Status badge, Fee paid checkbox
- Action column: Approve / Waitlist / Decline buttons (Pending tab); Promote (Waitlist tab); Add Notes (all tabs)

**Waitlist sub-view:** Ordered by `waitlist_position`. "Promote to Active" button per row — sends approval email and removes waitlist position. Position numbers automatically compact after a promotion.

**Manual add button** (league_admin/owner only): opens a slide-over with the same fields as the public form, pre-fills source as `admin_manual`, bypasses the `registration_open` status check (admin can add manually even when registration is closed).

---

## Phase 5G — Team Placement + Draft Tools

### API Routes

**`app/api/admin/house-league/seasons/[seasonId]/teams/route.ts`**
```
GET  — list teams for season (with player count per team)
POST — create a new team (league_admin or owner only)
```

**`app/api/admin/house-league/seasons/[seasonId]/teams/[teamId]/route.ts`**
```
PATCH  — rename, change colour, update coach name
DELETE — only if no players assigned
```

**`app/api/admin/house-league/seasons/[seasonId]/placement/route.ts`**
```
POST — execute a placement action
```

Body:
```ts
{
  action: 'randomize' | 'assign' | 'bulk_assign' | 'clear';
  divisionId: string;
  // For 'assign': { registrationId, teamId }
  // For 'bulk_assign': { assignments: Array<{ registrationId, teamId }> }
  // For 'randomize': { teamIds: string[] } — auto-distributes active registrations across these teams
  // For 'clear': clears all team assignments for the division (returns all to unassigned pool)
}
```

**`app/api/admin/house-league/seasons/[seasonId]/draft/route.ts`**
```
GET  — current draft state (picks made so far, whose pick it is, remaining player pool)
POST — advance draft (make a pick)
```

Draft state:
```ts
{
  draftId: string;
  divisionId: string;
  round: number;
  pickNumber: number;        // overall pick number
  currentTeamId: string;     // whose pick it is (round-robin order)
  pickOrder: string[];       // teamId array defining the pick rotation
  remainingPlayers: LeagueRegistration[];   // unassigned active registrations
  picks: Array<{ round, pickNumber, teamId, registrationId }>;
}
```

Draft is stored in memory (or a simple `league_draft_state` JSONB column on `league_seasons`) — it is a transient working state, not a permanent record. When the draft is finalized, `bulk_assign` is called with all picks and the draft state is cleared.

### Admin UI Page

**`app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx`**

Three-panel layout:

**Left panel — Player Pool**
- Unassigned active registrations for the selected division (filterable by name)
- Each player card: name, age/DOB, position pref, jersey pref

**Right panel — Teams**
- One column per team; colour-coded by `team.color`
- Draggable player cards — drag from pool to a team slot (or between teams)
- Each team header shows: team name, coach name, player count

**Toolbar (top)**
- Division selector (dropdown; defaults to first division)
- "Create Teams" button (if no teams exist for this division): enter team count + names, creates them
- "Randomize" button: distributes all unassigned pool players across existing teams randomly, balanced by count. Prompts "This will assign [N] players to [M] teams randomly. Continue?"
- "Start Draft" button: opens draft mode overlay
- "Clear All Assignments" button (destructive, owner/league_admin only): confirmation dialog before executing

**Draft Mode Overlay**

Full-screen modal. Shows:
- Pick order across the top (team names with current pick highlighted)
- Current pick: "Round 2 — Pick 7 — [Team Name]'s turn"
- Player pool list on the left (sorted by position pref by default)
- "Pick Player" action per player in the pool
- "Undo Last Pick" button
- "Finalize Draft" button (disabled until all players are assigned): applies all picks via `bulk_assign` and closes the draft

---

## Phase 5H — Scheduling

House league scheduling is round-robin based, not bracket-based. Do not reuse tournament scheduling components.

### API Routes

**`app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts`**
```
GET  — list games for a season (optionally filtered by ?divisionId= or ?weekOf=YYYY-MM-DD)
POST — create a single game (manual)
```

**`app/api/admin/house-league/seasons/[seasonId]/schedule/generate/route.ts`**
```
POST — auto-generate a round-robin schedule for a division
```

Auto-generate body:
```ts
{
  divisionId: string;
  startDate: string;       // first game date
  gamesPerWeek: number;    // how many game slots per week (typically 1 or 2)
  gameTime: string;        // default time HH:MM (same for all games initially)
  location: string | null; // default location for all games
}
```

Algorithm: standard round-robin rotation (fixed first team, rotate remaining). With N teams, schedule N-1 rounds. Each round: pair teams by the rotation. Output a set of `LeagueGame` insert rows. Return the generated schedule for admin review before saving (preview step).

**`app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts`**
```
PATCH  — edit game (time, location, status, scores)
DELETE — cancel game (sets status='cancelled', does not hard-delete)
```

Score entry via PATCH:
```ts
{
  homeScore: number;
  awayScore: number;
  status: 'completed';
}
```

### Admin UI Page

**`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx`**

**View modes:** Week view (default) | List view (all games in chronological order)

**Week view:** Displays games grouped by week. Each game card shows: teams, time, location, score (if completed), status badge. Click a game to edit inline (score entry, reschedule, cancel).

**List view:** Table — Date | Home Team | Away Team | Location | Score | Status | Actions

**Toolbar:**
- Division selector
- "Generate Schedule" button → opens a configuration panel (start date, games per week, default time/location) → shows a preview of generated games → "Save Schedule" confirms

**Score entry:** Inline edit on completed-status games. Number inputs for home/away score, submit marks the game as `completed`. Triggers standing recomputation on the client.

---

## Phase 5I — Standings

Standings are computed on-demand from completed games (not stored). The `computeStandings` DB helper is called by the standings API.

### API Route

**`app/api/admin/house-league/seasons/[seasonId]/standings/route.ts`**
```
GET — standings for all divisions in the season (or ?divisionId= for one)
```

Response:
```ts
{
  divisions: Array<{
    division: LeagueDivision;
    standings: LeagueStandingsRow[];
    games: { total: number; completed: number; remaining: number };
  }>
}
```

### Admin + Public UI

**`app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx`** — Admin view

Standings table per division: Rank | Team | GP | W | L | T | Pts | RF | RA | DIFF

**`app/[orgSlug]/league/[seasonSlug]/standings/page.tsx`** — Public view *(new public route)*

Same standings table, no authentication required. Available for seasons with status `active` or `completed`.

---

## Phase 5J — Scoped Email Dispatch

A lightweight notification tool scoped to house league registrant records. Entirely separate from `module_communications` (which reaches org members).

### API Route

**`app/api/admin/house-league/seasons/[seasonId]/notifications/route.ts`**

```
POST — send an email to a scoped audience
GET  — list recent sends (basic history: timestamp, audience, subject, recipient count)
```

POST body:
```ts
{
  audience: 'season' | 'division' | 'team' | 'waitlist';
  divisionId?: string;   // required when audience = 'division' | 'team' | 'waitlist'
  teamId?: string;       // required when audience = 'team'
  subject: string;       // max 200 chars
  body: string;          // plain text or basic markdown; max 4000 chars
}
```

Server-side:
1. Dual capability gate + role check (`canManageRegistrations`).
2. Resolve recipient email addresses from `league_registrations` based on audience:
   - `season`: all `active` registrations in the season (guardian_email)
   - `division`: all `active` in the specified division
   - `team`: all `active` in the specified team
   - `waitlist`: all `waitlisted` in the specified division
3. Deduplicate by email address (a guardian with two kids in the same division should receive one email).
4. Send via Resend batch send API (up to 100 per request; loop if larger).
5. Return `{ recipientCount: number; sent: number; failed: number }`.

Log each send in a simple `league_notification_log` table:
```sql
CREATE TABLE IF NOT EXISTS league_notification_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id      uuid        NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  sent_by        uuid        REFERENCES auth.users(id),
  audience_type  text        NOT NULL,
  audience_label text,                    -- human-readable e.g. "U11 Division A"
  subject        text        NOT NULL,
  recipient_count int        NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now()
);
```

### Admin UI Page

**`app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx`**

Two sections:

**Compose panel (top):**
- Audience dropdown: "All Season Registrants" | per-division options | per-team options | per-division waitlists
- Subject field
- Message body (textarea)
- Estimated recipients count (updates live as audience changes, from cached registration counts)
- Send button → confirmation dialog: "Send to [N] recipients? This cannot be undone."

**Send history (bottom):**
- Table: Sent At | Audience | Subject | Recipients | Sent By

---

## Phase 5K — Accounting Integration

The `accounting_ledgers` table already supports `entity_type = 'league_season'`. This phase wires that support into house league.

### API Extension

**`app/api/admin/house-league/seasons/[seasonId]/ledger/route.ts`**
```
GET  — get or create the season ledger and return its summary
POST — open the season ledger (creates it if it doesn't exist)
```

Uses `getOrCreateLeagueSeasonLedger` helper (new DB helper, follows the pattern of `getOrCreateTournamentLedger`):

```ts
export async function getOrCreateLeagueSeasonLedger(
  orgId: string,
  seasonId: string,
  seasonName: string
): Promise<AccountingLedger>
```

### Auto-Generated Fee Entries

When `season.auto_generate_fees = true` AND `registration.status` transitions to `active`:

1. Check if `registration.fee_entry_id` is already set — if so, skip (idempotent).
2. Call `createEntry` on the season ledger:
   - `entryType: 'income'`
   - `status: 'pending'` (not yet received — marks it receivable; admin reconciles to 'posted' when paid)
   - `amount: season.registrationFee`
   - `description: '[Player First] [Player Last] — Registration Fee'`
   - `category: 'Registration fees'`
   - `sourceModule: 'module_house_league'`
   - `sourceEntityId: registration.id`
3. Update `registration.fee_entry_id` with the new entry ID.

This logic runs inside the `updateRegistrationStatus` helper when the new status is `active` and `auto_generate_fees` is true.

### Admin UI Integration

On the season overview page (Phase 5D): if the accounting module is enabled and the user has `module_accounting` access, add an "Accounting →" link card pointing to the season's ledger in the accounting module. Mirror the pattern used by tournament ledger access in Phase 4B.

---

## Phase 5L — Past Seasons

### Admin UI Pages

**`app/[orgSlug]/admin/house-league/past/page.tsx`** — Past Seasons List

Lists all seasons with `status IN ('completed', 'archived')`. Cards show: name, age group, season dates, final registration count. Links to per-season detail.

**`app/[orgSlug]/admin/house-league/past/[seasonId]/page.tsx`** — Past Season Detail

Read-only view (no edit actions). Tabs: Roster | Schedule & Results | Standings. Mirrors the active season layout without action buttons.

---

## Testing Module Gating

Follow the Module Build Checklist testing pattern from PLATFORM_ROADMAP.md:

1. As owner: Manage modal → Capability Overrides → Module Access → set `module_house_league` to Revoke → Save.
2. Sign in as a `league_admin` member in incognito.
3. Confirm:
   - Hub tile for House League is not shown.
   - Direct URL `/{orgSlug}/admin/house-league` renders the access-denied state.
   - `GET /api/admin/house-league/seasons` returns 403.
4. As owner: restore the cap. Confirm tile and season list return.
5. As platform admin: remove `module_house_league` from `org.enabled_addons` (via DB). Confirm entitlement check fails — tile and pages are gone even for owner.

**Additional role-level test for `league_registrar`:**

1. Assign a member the `league_registrar` role.
2. Sign in as that member.
3. Confirm: season list is visible, registrations tab is editable, teams/schedule/standings tabs render the "restricted to league administrators" message, and the "Create Season" / "Randomize" buttons are absent.

---

## File Map (New + Modified)

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/019_house_league.sql` | New | All tables, indexes, RLS policies, notification log |
| `lib/types.ts` | Modified | Add `LeagueSeason`, `LeagueDivision`, `LeagueTeam`, `LeagueRegistration`, `LeagueGame`, `LeagueStandingsRow`, `LeagueSeasonSummary`, status enums |
| `lib/roles.ts` | Modified | C2: Add `league_admin`, `league_registrar`, `treasurer` to `OrgRole` and `ROLE_DEFAULTS` |
| `lib/db.ts` | Modified | Add all season, division, team, registration, game, standings, notification helpers + mappers |
| `app/api/admin/house-league/seasons/route.ts` | New | GET (list) + POST (create season) |
| `app/api/admin/house-league/seasons/[seasonId]/route.ts` | New | GET (detail) + PATCH (update/lifecycle) |
| `app/api/admin/house-league/seasons/[seasonId]/divisions/route.ts` | New | GET + POST |
| `app/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]/route.ts` | New | PATCH + DELETE |
| `app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts` | New | GET + POST (manual add) |
| `app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts` | New | GET + PATCH |
| `app/api/admin/house-league/seasons/[seasonId]/teams/route.ts` | New | GET + POST |
| `app/api/admin/house-league/seasons/[seasonId]/teams/[teamId]/route.ts` | New | PATCH + DELETE |
| `app/api/admin/house-league/seasons/[seasonId]/placement/route.ts` | New | POST (randomize, assign, bulk_assign, clear) |
| `app/api/admin/house-league/seasons/[seasonId]/draft/route.ts` | New | GET (draft state) + POST (make pick) |
| `app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts` | New | GET + POST (create game) |
| `app/api/admin/house-league/seasons/[seasonId]/schedule/generate/route.ts` | New | POST (round-robin auto-generate) |
| `app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts` | New | PATCH + DELETE (cancel) |
| `app/api/admin/house-league/seasons/[seasonId]/standings/route.ts` | New | GET (computed standings) |
| `app/api/admin/house-league/seasons/[seasonId]/notifications/route.ts` | New | GET (history) + POST (send) |
| `app/api/admin/house-league/seasons/[seasonId]/ledger/route.ts` | New | GET/POST season ledger |
| `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts` | New | Public registration submit (no auth) |
| `app/[orgSlug]/league/[seasonSlug]/page.tsx` | New | Public season landing page |
| `app/[orgSlug]/league/[seasonSlug]/register/page.tsx` | New | Public registration form |
| `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx` | New | Public standings page |
| `app/[orgSlug]/admin/house-league/layout.tsx` | New | Minimal passthrough layout (Layer 5) |
| `app/[orgSlug]/admin/house-league/page.tsx` | New | Season list overview (Layer 2) |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx` | New | Season detail + division cards |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx` | New | Registration queue management |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx` | New | Team placement + draft UI |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` | New | Schedule management (week + list views) |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx` | New | Standings (admin view) |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx` | New | Email dispatch + send history |
| `app/[orgSlug]/admin/house-league/past/page.tsx` | New | Past seasons list |
| `app/[orgSlug]/admin/house-league/past/[seasonId]/page.tsx` | New | Past season read-only detail |
| `app/[orgSlug]/admin/page.tsx` | Modified | Add House League hub tile (Layer 4) |
| `components/admin/AdminSidebar.tsx` | Modified | Add `isHouseLeague` detection + season-context nav (Layer 3) + `!isHouseLeague` guard on tournament mode |
| `app/api/admin/accounting/` (all owner-gated routes) | Modified | C2: accept `treasurer` role alongside `owner` |

---

## Build Order

1. ✅ **Migration 020** — Run in Supabase before any testing
2. ✅ **C2 role model expansion** — types.ts + roles.ts + ROLE_DEFAULTS + accounting route updates for `treasurer`
3. ✅ **B1, B2** — TypeScript types and DB helpers
4. ✅ **5C: E3, E4, C5** — Sidebar, hub tile, layout passthrough (validate the shell before building pages)
5. **5D** — Season + division management API + admin pages
6. **5E** — Public registration form + public API route + confirmation emails
7. **5F** — Registration management admin page
8. **5G** — Team creation + placement tools (randomize + manual); draft mode can follow immediately after
9. **5H** — Schedule management (manual game creation first; round-robin generator second)
10. **5I** — Standings (computed; depends on 5H score entry)
11. **5J** — Scoped email dispatch + notification log
12. **5K** — Accounting integration (season ledger + auto-fee generation)
13. **5L** — Past seasons pages
14. **Module gating test** — Full five-layer verification + role-level registrar test

---

## Deferred Items

| Item | Deferred to |
|---|---|
| Multi-role architecture (a user holding two OrgRoles simultaneously) | Post-Phase 6 C2 follow-on decision |
| C3 — `module_communications` consolidation with registrant audiences | Post-Phase 6 once both modules are shipped |
| Draft mode: coach-picks variant (coaches log in and make their own picks) | Rep Teams plan phase or post-Phase 5 enhancement |
| Public standings widget / embeddable iframe | Post-roadmap, after first live season |
| Registration IP rate limiting (spam prevention on public form) | Hardening pass after first external org uses the module |
| Emergency contact fields on registration form | Can be added as additional guardian fields with no schema change |
| Sport-specific position preference dropdowns | Refinement; current plain-text field is sufficient for Phase 5 |
| Export registrations to CSV | Post-Phase 5 polish |
| Multi-currency support for registration fees | Not planned; CAD assumed throughout |
| Automated league schedule publishing to public site (`module_public_site` integration) | Cross-module integration, post both Phase 3 and Phase 5 |
