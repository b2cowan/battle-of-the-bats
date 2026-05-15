# Accounting Enhancements Plan
## Org Budget Planning + Rep Team Budget, Dues, Fundraising & Bidirectional Payments

---

## Product Manager Brief

**What this is:**
A complete overhaul of the financial planning and tracking experience for both org admins/treasurers and rep team coaches. Today both sides have a basic ledger. After this work, both sides have a structured budget planner, a live budget-vs-actual view, and a two-way payment channel between the org and its teams.

**Why it matters:**
Treasurers currently run the org budget in a spreadsheet alongside FieldLogicHQ. Coaches track player dues in their own notes. Neither side has visibility into whether they're on track. This ships a complete, structured alternative that lives inside the platform — reducing off-platform bookkeeping and increasing org adoption of the accounting module.

**Expected customer impact:**
- Org treasurers can plan the full season budget, distribute costs to teams, and track collection — all in one place
- Coaches can plan team costs, set player installments, track fundraising, and see whether they have room for an extra tournament — without a spreadsheet
- Parents benefit from structured payment reminders and a clear dues schedule
- Org admins get a roll-up view of all team financial health

**Priority:** High — directly extends already-shipped Phase 6K/6L accounting work  
**Success criteria:** An org treasurer can build a season budget, allocate shared costs to teams, and see a budget-vs-actual report without leaving the app. A coach can build a player dues plan, track a fundraiser, and answer "do I have room for this tournament?" from their dashboard.

---

## Architecture Overview

### Two parallel budget systems with a shared layer

```
ORG BUDGET PLANNER                    REP TEAM BUDGET PLANNER
  org_budget_lines                      rep_budget_lines
  org_budget_periods                    rep_budget_periods
        |                                     |
        | "Allocate to Teams"                 | "Generate installment plan"
        ↓                                     ↓
  rep_cost_allocations             rep_player_dues_installments
  rep_allocation_splits            (replaces legacy dues schedule system)
        ↑                                     ↑
        |______ Shared category library _______|
               budget_categories
               budget_items
```

### Money flow (bidirectional)
```
ORG LEDGER                           TEAM LEDGER
    ← transfer_in ←←←←←←←←←←←←←←← transfer_out (team pays allocation)
    → transfer_out →→→→→→→→→→→→→→→ transfer_in  (org pays team)
    ← [pending] ←←←←←←←←←←←←←←←← rep_team_payment_requests (team charges org)
    → [pending] →→→→→→→→→→→→→→→→→ rep_team_payment_requests (team sends payment)
```

### Estimated vs. Actual — two separate layers
The budget planner is a **planning overlay**. Actuals live in the existing `accounting_entries` ledger. The budget-vs-actual screen joins them; they are never merged.

---

## Phase A — Shared Category & Item Library

**Goal:** Single source of truth for budget categories and items, shared across org and team budget planners. Platform ships a read-only default set; orgs extend it with custom items.

### A1 — DB Migration (`027_budget_categories.sql`)

```sql
-- Category definitions (platform defaults have org_id = null)
create table budget_categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade,
  name        text not null,
  scope       text not null check (scope in ('org', 'team', 'both')) default 'both',
  sort_order  int not null default 0,
  is_default  boolean not null default false,  -- true = platform-seeded, read-only
  created_at  timestamptz not null default now()
);

-- Items within categories
create table budget_items (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references budget_categories(id) on delete cascade,
  org_id           uuid references organizations(id) on delete cascade,
  name             text not null,
  suggested_amount numeric(10,2),  -- optional hint shown in budget planner
  sort_order       int not null default 0,
  is_default       boolean not null default false,
  is_misc          boolean not null default false,  -- true = Misc catchall for this category
  created_at       timestamptz not null default now()
);

-- Unique constraint: one item name per category per org (or platform-wide for defaults)
create unique index budget_items_unique_name
  on budget_items (category_id, org_id, lower(name))
  where org_id is not null;

create unique index budget_items_unique_default_name
  on budget_items (category_id, lower(name))
  where org_id is null;

-- RLS
alter table budget_categories enable row level security;
alter table budget_items enable row level security;

-- Org members can read platform defaults and their own org's categories
create policy "read budget_categories" on budget_categories
  for select using (org_id is null or org_id = get_org_id());

create policy "read budget_items" on budget_items
  for select using (org_id is null or org_id = get_org_id());

-- Owners/treasurers can create custom categories and items
create policy "write budget_categories" on budget_categories
  for all using (org_id = get_org_id() and get_user_role() in ('owner','treasurer'));

create policy "write budget_items" on budget_items
  for all using (org_id = get_org_id() and get_user_role() in ('owner','treasurer','coach'));
```

### A2 — Platform seed data

Insert platform-default categories and items in the migration. Minimum set:

| Category | Items |
|---|---|
| Tournaments | Entry Fees, Uniforms, Travel, *Misc* |
| Facilities | Diamond Permits, Dome Time, Field Equipment, Lighting Fees, *Misc* |
| Officials | Umpire Fees, Plate Fees, Certification, *Misc* |
| Team Gear | Jerseys, Hats, Balls, Bats, Bags, *Misc* |
| Training | Coaching Clinics, Off-Season Training, Batting Cages, *Misc* |
| Events | Year-End Party, Photo Day, Awards Night, Banquet, *Misc* |
| Admin | Registration Fees, Insurance, Association Dues, Software, *Misc* |
| Coaching | Clinics, Certifications, Honorariums, Travel, *Misc* |
| Fundraising Costs | Supplies, Venue, Printing, *Misc* |

Org-scope-only categories (scope = 'org'): **Admin**, **Coaching**  
Team-scope-only categories (scope = 'team'): **Team Gear**  
Both: all others

### A3 — API Routes

```
GET  /api/admin/accounting/budget-categories          — list categories + items for org (merged platform + custom)
POST /api/admin/accounting/budget-categories          — create custom category (owner/treasurer)
POST /api/admin/accounting/budget-categories/:id/items — create custom item
PATCH /api/admin/accounting/budget-categories/:catId/items/:itemId — update custom item
DELETE /api/admin/accounting/budget-categories/:catId/items/:itemId — delete custom item (if unused)

GET  /api/coaches/:orgSlug/budget-items               — same merged list, scoped to team-eligible categories
POST /api/coaches/:orgSlug/budget-items               — coach creates custom item (goes into org library)
```

### A4 — Shared UI Component

**File:** `components/accounting/BudgetItemPicker.tsx`
- Grouped `<select>` or searchable combobox
- Shows Category → Item hierarchy
- "Misc" always appears last in each group
- "+ Add custom item" inline action at bottom of list
- Used by both org budget planner and team budget planner

---

## Phase B — Rep Team Budget Planner

**Goal:** Coaches build a structured season budget with period distribution. Budget generates a player installment plan. Estimated layer is separate from the actual ledger.

### B1 — DB Migration (`028_rep_budget_planner.sql`)

```sql
-- Budget line items per team per program year
create table rep_budget_lines (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  team_id         uuid not null references rep_teams(id) on delete cascade,
  program_year_id uuid not null references rep_program_years(id) on delete cascade,
  category_id     uuid references budget_categories(id),
  item_id         uuid references budget_items(id),
  description     text not null,         -- override or free-text if no item selected
  total_amount    numeric(10,2) not null,
  notes           text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Period distribution for a budget line (optional; no rows = lump sum)
create table rep_budget_periods (
  id             uuid primary key default gen_random_uuid(),
  budget_line_id uuid not null references rep_budget_lines(id) on delete cascade,
  period_label   text not null,          -- e.g. 'May', 'June', 'Pre-season'
  period_date    date,                   -- anchor date for ordering and reminders
  amount         numeric(10,2) not null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create index on rep_budget_lines (team_id, program_year_id);
create index on rep_budget_periods (budget_line_id);

-- RLS: coaches see and write their own team's budget
alter table rep_budget_lines enable row level security;
alter table rep_budget_periods enable row level security;

create policy "coach budget_lines" on rep_budget_lines
  for all using (
    org_id = get_org_id() and (
      get_user_role() in ('owner','treasurer','admin')
      or team_id in (select team_id from coach_assignments where user_id = auth.uid())
    )
  );

create policy "coach budget_periods" on rep_budget_periods
  for all using (
    budget_line_id in (
      select id from rep_budget_lines where
        org_id = get_org_id() and (
          get_user_role() in ('owner','treasurer','admin')
          or team_id in (select team_id from coach_assignments where user_id = auth.uid())
        )
    )
  );
```

### B2 — Installment plan generator (existing table reuse)

The existing `rep_player_dues_schedules` + `rep_player_dues_installments` tables are retired in favour of a budget-driven generation step:

1. Coach finalises budget (total amount per period)
2. Coach opens **"Generate Player Installments"** panel
   - Choose number of installments (or inherit from period count)
   - Set due dates per installment (or inherit from period_date)
   - System computes: total budget ÷ active roster count = per-player amount per installment
3. Coach reviews the generated schedule, adjusts individual players if needed
4. Submit creates `rep_player_dues_installments` rows for every active roster player

**Migration note:** Existing dues schedule rows are left in place; new season creates via this flow only. A `source` column (`'manual' | 'budget_generated'`) distinguishes them.

### B3 — API Routes

```
GET  /api/coaches/:orgSlug/teams/:teamId/budget-plan                           — full budget plan for current program year
POST /api/coaches/:orgSlug/teams/:teamId/budget-plan/lines                    — add budget line
PATCH /api/coaches/:orgSlug/teams/:teamId/budget-plan/lines/:lineId           — update line
DELETE /api/coaches/:orgSlug/teams/:teamId/budget-plan/lines/:lineId          — remove line (if no installments generated)
POST /api/coaches/:orgSlug/teams/:teamId/budget-plan/lines/:lineId/periods    — upsert period distribution
POST /api/coaches/:orgSlug/teams/:teamId/budget-plan/generate-installments    — generate dues installments from budget
GET  /api/coaches/:orgSlug/teams/:teamId/budget-plan/installment-preview      — preview per-player amounts before committing
```

### B4 — UI Pages

**File:** `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/page.tsx`

Layout:
- **Budget summary header** — total estimated budget, total collected to date, total spent to date, headroom
- **Line items table** — grouped by category, sortable, with period breakdown expandable per row
- "Add Line" action → opens item picker + amount + optional period distribution form
- **"Generate Installments" CTA** — appears when budget has at least one line and no installments exist yet for this program year
- Period distribution form: add rows for each period with label, date, and amount; totals must equal line total (validation)

**File:** `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/installment-preview/page.tsx`

Shows per-player installment table before committing. Allows individual overrides. Confirm button calls generate-installments endpoint.

---

## Phase C — Rep Team Budget vs. Actual

**Goal:** Coaches see estimated vs. actual side-by-side with period columns and headroom indicator.

### C1 — API Routes

```
GET /api/coaches/:orgSlug/teams/:teamId/budget-vs-actual?programYearId=...
```

Response shape:
```json
{
  "headroom": 420.00,
  "categories": [
    {
      "name": "Tournaments",
      "items": [
        {
          "budgetLineId": "...",
          "description": "Entry Fees",
          "totalEstimated": 1200.00,
          "totalActual": 800.00,
          "variance": 400.00,
          "periods": [
            { "label": "May", "estimated": 400.00, "actual": 400.00 },
            { "label": "June", "estimated": 400.00, "actual": 400.00 },
            { "label": "September", "estimated": 400.00, "actual": 0.00 }
          ]
        }
      ]
    }
  ],
  "unbudgetedActuals": [...],
  "duesCollection": {
    "expected": 2400.00,
    "collected": 1600.00,
    "outstanding": 800.00
  },
  "monthlyChart": [
    { "month": "2026-05", "estimated": 400.00, "actual": 400.00, "cumEstimated": 400.00, "cumActual": 400.00 }
  ]
}
```

### C2 — UI Page

**File:** `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/page.tsx`

Layout:
- **Headroom headline** — large number, green/amber/red based on remaining
- **Budget vs. actual table** — grouped by category; period columns shown if any lines have period distribution; variance column colour-coded
- **Unbudgeted actuals section** — expenses without a budget line, prompted to assign or ignore
- **Dues collection row** — expected vs. collected vs. outstanding
- **Running delta chart** — cumulative estimated vs. cumulative actual over season months (line chart, two series)

---

## Phase D — Player-Linked Transactions & Dues Credits

**Goal:** Any ledger entry can be linked to a player. Equipment contributions and other player-linked income generate a dues credit applied to that player's installments (last first by default).

### D1 — DB Migration (`029_dues_credits.sql`)

```sql
-- Add player link + credit fields to rep_team_expenses
alter table rep_team_expenses
  add column player_id          uuid references rep_players(id),
  add column payment_method     text,                             -- cash | e-transfer | cheque | card | in-kind | other
  add column payee_payer        text,                             -- free text
  add column additional_notes   text,
  add column generates_credit   boolean not null default false,  -- true = creates dues credit for linked player
  add column credit_apply_order text not null default 'last'     -- 'last' | 'first'
    check (credit_apply_order in ('last','first'));

-- Add transaction detail fields to accounting_entries
alter table accounting_entries
  add column payment_method     text,
  add column payee_payer        text,
  add column player_id          uuid references rep_players(id),
  add column team_id            uuid references rep_teams(id),
  add column budget_line_id     uuid references rep_budget_lines(id),
  add column fundraiser_entry_id uuid;  -- FK added in Phase E migration

-- Dues credits applied against player installments
create table rep_dues_credits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  team_id         uuid not null references rep_teams(id) on delete cascade,
  player_id       uuid not null references rep_players(id) on delete cascade,
  program_year_id uuid not null references rep_program_years(id) on delete cascade,
  amount          numeric(10,2) not null,
  credit_type     text not null check (credit_type in ('contribution', 'fundraiser', 'manual')),
  source_entry_id uuid,         -- FK to rep_team_expenses or rep_fundraiser_entries
  applied_at      timestamptz,  -- null = not yet applied to installments
  notes           text,
  created_at      timestamptz not null default now()
);

create index on rep_dues_credits (player_id, program_year_id);

alter table rep_dues_credits enable row level security;

create policy "coach dues_credits" on rep_dues_credits
  for all using (
    org_id = get_org_id() and (
      get_user_role() in ('owner','treasurer','admin')
      or team_id in (select team_id from coach_assignments where user_id = auth.uid())
    )
  );
```

### D2 — Credit application logic

**Function:** `apply_dues_credit(credit_id uuid)` (Postgres function)
- Fetches all unpaid installments for the player, ordered by `due_date DESC` (last-first) or `ASC` (first-first) based on `credit_apply_order`
- Reduces installment amounts starting from the ordered list until the credit is exhausted
- Records which installments were reduced and by how much (stored as a `credit_allocations` JSONB column on `rep_dues_credits`)
- Marks `applied_at = now()`

Coaches can preview the credit application before confirming.

### D3 — API Routes

```
POST /api/coaches/:orgSlug/teams/:teamId/expenses       — updated to accept player_id, payment_method, payee_payer, generates_credit, credit_apply_order
POST /api/coaches/:orgSlug/teams/:teamId/dues-credits   — manually create a credit
GET  /api/coaches/:orgSlug/teams/:teamId/dues-credits   — list credits for team
POST /api/coaches/:orgSlug/teams/:teamId/dues-credits/:creditId/apply — apply credit to installments
GET  /api/coaches/:orgSlug/teams/:teamId/dues-credits/:creditId/preview — preview before apply
```

### D4 — UI changes

- Add optional **Player** dropdown to Add Expense / Add Income forms
- When player is selected and income type is chosen, show **"Apply as dues credit"** toggle
- Credit apply order toggle: Last payment first / First payment first
- "Preview" shows which installments will be reduced before confirming

---

## Phase E — Fundraiser Module

**Goal:** Coaches track per-player fundraising, define player rebate %, automatically credit player dues.

### E1 — DB Migration (`030_fundraisers.sql`)

```sql
create table rep_fundraisers (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id) on delete cascade,
  team_id              uuid not null references rep_teams(id) on delete cascade,
  program_year_id      uuid not null references rep_program_years(id) on delete cascade,
  name                 text not null,
  description          text,
  player_rebate_percent numeric(5,2) not null default 0   -- % of raised amount credited to player dues
    check (player_rebate_percent between 0 and 100),
  start_date           date,
  end_date             date,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table rep_fundraiser_entries (
  id              uuid primary key default gen_random_uuid(),
  fundraiser_id   uuid not null references rep_fundraisers(id) on delete cascade,
  org_id          uuid not null references organizations(id) on delete cascade,
  team_id         uuid not null references rep_teams(id) on delete cascade,
  player_id       uuid not null references rep_players(id) on delete cascade,
  amount_raised   numeric(10,2) not null,
  rebate_amount   numeric(10,2) generated always as (amount_raised * player_rebate_percent / 100) stored,
                  -- NOTE: requires join to fundraiser for player_rebate_percent; use a trigger or compute in app
  accounting_entry_id uuid references accounting_entries(id),  -- income entry in team ledger
  credit_id       uuid references rep_dues_credits(id),        -- dues credit for player's rebate share
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (fundraiser_id, player_id)
);

-- Back-fill the FK from Phase D migration
alter table rep_dues_credits
  add constraint fk_fundraiser_entry
  foreign key (source_entry_id) references rep_fundraiser_entries(id);

create index on rep_fundraiser_entries (fundraiser_id);
create index on rep_fundraiser_entries (player_id);

alter table rep_fundraisers enable row level security;
alter table rep_fundraiser_entries enable row level security;

create policy "coach fundraisers" on rep_fundraisers
  for all using (
    org_id = get_org_id() and (
      get_user_role() in ('owner','treasurer','admin')
      or team_id in (select team_id from coach_assignments where user_id = auth.uid())
    )
  );

create policy "coach fundraiser_entries" on rep_fundraiser_entries
  for all using (
    org_id = get_org_id() and (
      get_user_role() in ('owner','treasurer','admin')
      or team_id in (select team_id from coach_assignments where user_id = auth.uid())
    )
  );
```

### E2 — Fundraiser flow

1. Coach creates fundraiser: name, dates, rebate %
2. Coach logs per-player amounts raised as the fundraiser runs
3. On save of each entry:
   - Creates `accounting_entries` income record in team ledger (full amount)
   - Creates `rep_fundraiser_entries` row
   - Creates `rep_dues_credits` row for the player's rebate share (credit_type = 'fundraiser')
   - Prompts coach to apply credit now or later
4. Team budget headroom increases by the full amount raised
5. Player's remaining dues decrease by their rebate share (last installment first)

### E3 — API Routes

```
GET  /api/coaches/:orgSlug/teams/:teamId/fundraisers                              — list fundraisers
POST /api/coaches/:orgSlug/teams/:teamId/fundraisers                              — create fundraiser
PATCH /api/coaches/:orgSlug/teams/:teamId/fundraisers/:fundraiserId               — update fundraiser
GET  /api/coaches/:orgSlug/teams/:teamId/fundraisers/:fundraiserId/entries        — per-player entries + totals
POST /api/coaches/:orgSlug/teams/:teamId/fundraisers/:fundraiserId/entries        — log player amount (creates ledger entry + credit)
PATCH /api/coaches/:orgSlug/teams/:teamId/fundraisers/:fundraiserId/entries/:entryId — update entry
```

### E4 — UI Pages

**File:** `app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/page.tsx`
- List of fundraisers with: total raised, team net, total credits issued, status (active/closed)
- "New Fundraiser" button

**File:** `app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/[fundraiserId]/page.tsx`
- Fundraiser detail: name, dates, rebate %
- Per-player table: name, amount raised, rebate earned, credit applied, remaining dues
- Leaderboard sorted by amount raised
- "Log Amount" per player (or bulk entry grid)
- Summary: total raised, team portion, total credits issued

---

## Phase F — Org Budget Planner

**Goal:** Treasurers build an org-level season budget with period distribution. Budget lines can be directly allocated to teams.

### F1 — DB Migration (`031_org_budget_planner.sql`)

```sql
create table org_budget_lines (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  season_year  int not null,             -- e.g. 2026
  category_id  uuid references budget_categories(id),
  item_id      uuid references budget_items(id),
  description  text not null,
  total_amount numeric(10,2) not null,
  notes        text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table org_budget_periods (
  id             uuid primary key default gen_random_uuid(),
  budget_line_id uuid not null references org_budget_lines(id) on delete cascade,
  period_label   text not null,
  period_date    date,
  amount         numeric(10,2) not null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

-- Link org budget line to its downstream team allocations
alter table rep_cost_allocations
  add column source_budget_line_id uuid references org_budget_lines(id);

create index on org_budget_lines (org_id, season_year);
create index on org_budget_periods (budget_line_id);

alter table org_budget_lines enable row level security;
alter table org_budget_periods enable row level security;

create policy "read org_budget_lines" on org_budget_lines
  for select using (org_id = get_org_id());

create policy "write org_budget_lines" on org_budget_lines
  for all using (org_id = get_org_id() and get_user_role() in ('owner','treasurer'));

create policy "write org_budget_periods" on org_budget_periods
  for all using (
    budget_line_id in (
      select id from org_budget_lines
      where org_id = get_org_id() and get_user_role() in ('owner','treasurer')
    )
  );
```

### F2 — "Allocate to Teams" action

From any org budget line, treasurer can open **"Allocate to Teams"**:
1. Select participating teams
2. Choose split method (percentage / sessions / fixed per team)
3. If the budget line has period distribution, the installment due dates inherit from periods
4. Preview per-team amounts before confirming
5. Submit creates `rep_cost_allocations` + `rep_allocation_splits` + `rep_allocation_installments` with `source_budget_line_id` set to the originating line
6. Teams immediately see the allocation in their 30/60/90 payables dashboard

### F3 — API Routes

```
GET  /api/admin/accounting/budget-plan?year=2026                           — full org budget plan
POST /api/admin/accounting/budget-plan/lines                               — add line
PATCH /api/admin/accounting/budget-plan/lines/:lineId                     — update line
DELETE /api/admin/accounting/budget-plan/lines/:lineId                    — remove line
POST /api/admin/accounting/budget-plan/lines/:lineId/periods               — upsert periods
POST /api/admin/accounting/budget-plan/lines/:lineId/allocate-to-teams    — open allocation wizard
GET  /api/admin/accounting/budget-plan/lines/:lineId/allocation-preview   — preview per-team amounts
```

### F4 — UI Pages

**File:** `app/[orgSlug]/admin/accounting/budget/page.tsx`

Layout:
- Season year selector (default: current year)
- **Budget summary header** — total budget, total actual spent, total allocated to teams, collected from teams, org headroom
- **Line items table** — grouped by category; each row shows total, period breakdown toggle, "Allocated" badge if already sent to teams, "Allocate to Teams" CTA
- "Add Line" with BudgetItemPicker component + amount + optional periods

**File:** `app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx`
- Team picker + split method per team
- Per-team preview table before confirming
- If line has periods, shows installment due dates inherited from periods (editable)

---

## Phase G — Org Budget vs. Actual

**Goal:** Treasurers see estimated vs. actual vs. allocated/collected side-by-side with team health panel.

### G1 — API Route

```
GET /api/admin/accounting/budget-vs-actual?year=2026
```

Response shape mirrors team version, plus:
- `allocationRecovery` per line: `{ allocated, collected, outstanding }`
- `teamSummary`: per-team status (on track / behind / overdue)
- `inboundQueue`: pending team payment requests count

### G2 — UI Page

**File:** `app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx`

Layout:
- **Headroom headline** — org net headroom
- **Budget vs. actual table** — per category/item: estimated, actual, allocation recovery (allocated / collected), variance
- **Period columns** — if any line has period distribution
- **Unbudgeted actuals** — expenses without a budget line
- **Running delta chart** — cumulative estimated vs. actual
- **Team health panel** — per-team card: allocated total, collected %, overdue count, status badge

---

## Phase H — Bidirectional Team Payment Requests

**Goal:** Teams can initiate payments to the org or submit charge requests. Admin reviews and approves/denies.

### H1 — DB Migration (`032_team_payment_requests.sql`)

```sql
create table rep_team_payment_requests (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  team_id          uuid not null references rep_teams(id) on delete cascade,
  request_type     text not null check (request_type in ('payment_to_org', 'charge_to_org')),
  amount           numeric(10,2) not null,
  description      text not null,
  payment_method   text,
  notes            text,
  status           text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  denial_reason    text,
  budget_line_id   uuid references org_budget_lines(id),     -- optional: links to org budget line
  accounting_entry_id uuid references accounting_entries(id), -- set on approval
  created_by       uuid not null references auth.users(id),
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on rep_team_payment_requests (org_id, status);
create index on rep_team_payment_requests (team_id, status);

alter table rep_team_payment_requests enable row level security;

-- Coaches see their own team's requests
create policy "coach payment_requests" on rep_team_payment_requests
  for all using (
    org_id = get_org_id() and (
      get_user_role() in ('owner','treasurer','admin')
      or team_id in (select team_id from coach_assignments where user_id = auth.uid())
    )
  );
```

### H2 — Approval flow

**Approve (payment_to_org):**
- Creates `transfer_out` in team ledger + `transfer_in` in org ledger (via `create_accounting_transfer()` RPC)
- Sets `accounting_entry_id` on the request
- Status → 'approved'

**Approve (charge_to_org):**
- Creates `expense` entry in org ledger linked to the requesting team
- Creates `transfer_in` in team ledger
- Status → 'approved'

**Deny:**
- Requires `denial_reason`
- Coach sees denial reason in their request history

### H3 — API Routes

```
GET  /api/coaches/:orgSlug/teams/:teamId/payment-requests         — list team's requests
POST /api/coaches/:orgSlug/teams/:teamId/payment-requests         — create request
DELETE /api/coaches/:orgSlug/teams/:teamId/payment-requests/:id   — cancel pending request

GET  /api/admin/rep-teams/payment-requests                        — list all pending requests (admin/treasurer)
PATCH /api/admin/rep-teams/payment-requests/:id                   — approve or deny
```

### H4 — UI Pages

**File:** `app/[orgSlug]/coaches/teams/[teamId]/accounting/payment-requests/page.tsx`
- List of submitted requests with status badges (pending / approved / denied)
- "New Request" → choose type (Pay Org / Request from Org), enter amount, method, description, notes
- Denied requests show denial reason

**File:** `app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx`
- Inbound queue of all pending requests across all teams
- Approve button → triggers transfer creation
- Deny button → requires reason input
- History tab showing past approvals/denials

---

## Phase I — 30/60/90 Dashboards

**Goal:** Both coaches and org admins have a single forward-looking payables view.

### I1 — API Routes

```
GET /api/coaches/:orgSlug/teams/:teamId/upcoming-payables?days=90
GET /api/admin/rep-teams/upcoming-payables?days=90
```

Both return three lanes:
- **collections_due** — player installments (coach) or org income (admin) coming due
- **team_payables** — team expenses (coach) or org expenses (admin) coming due
- **org_payables** — allocation installments owed to org (coach lane only) / pending team requests (admin lane)

Each item includes: description, amount, due_date, days_until_due, overdue (bool), player/team name.

### I2 — UI Components

**File:** `components/accounting/UpcomingPayablesPanel.tsx`
- Three-lane layout (tabs on mobile, columns on desktop)
- Overdue items at top of each lane, flagged red
- 30 / 60 / 90 day toggle filter
- Empty state per lane

Embedded in:
- Coach accounting dashboard (`/coaches/teams/[teamId]/accounting/page.tsx`) — replace current summary cards with this panel + headroom headline
- Admin rep-teams hub — new "Payables" section

---

## Phase J — Transaction Detail Enhancements

**Goal:** Every ledger entry and team expense carries payment method, payee, and optional links.

### J1 — Schema (covered in Phase D migration)

Fields already added to `accounting_entries` and `rep_team_expenses` in migration `029`.

### J2 — UI Updates

Update all entry/expense add and edit modals to include:
- **Payment method** — segmented control or select: Cash · E-Transfer · Cheque · Card · In-Kind · Other
- **Payee / Payer** — text input (optional)
- **Notes** — textarea (already exists on expenses; add to accounting_entries modal)
- **Budget line** — optional dropdown linking entry to a budget line item (for actuals-vs-estimated mapping)
- **Player link** (expenses + income) — optional player dropdown; shows credit toggle when income type

Files to update:
- `app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx` — Add/Edit Entry modal
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/page.tsx` — Add Expense / Add Payable modals

---

## Phase K — Reminder System & Notification Enhancements

**Goal:** Automated reminders for upcoming player installments and allocation installments. Coaches and org admins control send timing.

### K1 — Reminder triggers (extend existing system)

The existing `reminder_sent_at` column on `rep_player_dues_installments` is already in place. Extend with:
- Automated reminder at 30 days before due (if not paid)
- Automated reminder at 7 days before due
- Manual "Send Now" still available

Add `reminder_sent_at` tracking to `rep_allocation_installments` (allocation reminders to coaches).

### K2 — API Routes

```
POST /api/coaches/:orgSlug/teams/:teamId/dues/send-reminders     — existing; extend to accept reminder window param
POST /api/admin/rep-teams/allocations/:id/send-reminders        — new; send allocation payment reminders to coaches
```

### K3 — Reminder copy

Player dues reminder: subject "Payment reminder: [Team] dues due [date]"
Allocation reminder: subject "Payment reminder: [Org] allocation due [date] — [description]"

---

## Build Order

| Phase | Description | Migrations | Blocking |
|---|---|---|---|
| A | Category & item library | 027 | None |
| B | Rep team budget planner | 028 | A |
| C | Rep team budget vs. actual | — | B |
| D | Player-linked transactions & dues credits | 029 | B |
| E | Fundraiser module | 030 | D |
| F | Org budget planner | 031 | A |
| G | Org budget vs. actual | — | F |
| H | Bidirectional payment requests | 032 | F |
| I | 30/60/90 dashboards | — | B, F, H |
| J | Transaction detail enhancements | (in 029) | A |
| K | Reminder system enhancements | — | B |

Phases A → B → C can ship as one milestone (team budget planner MVP).  
Phases F → G → H can ship as a second milestone (org budget planner + payment requests).  
Phases D + E are additive enhancements that can follow either milestone.

---

## Key Design Decisions

1. **Estimated and actual layers are always separate.** Budget lines never write to `accounting_entries`. The budget-vs-actual view is a read-only join. This preserves the integrity of the ledger as the single source of financial truth.

2. **Custom categories are org-wide, not team-specific.** A coach who creates a custom item makes it available to all coaches in that org. This prevents duplicate naming and ensures proper aggregation in org-level reports.

3. **Fundraiser income always hits the team ledger in full.** The player's rebate is handled as a dues credit, not a deduction from the income entry. This keeps the ledger clean and makes the team's gross fundraising revenue visible.

4. **Payment requests require admin approval before ledger entries are created.** Coaches cannot self-post transfers to the org ledger. This maintains the integrity of org-side accounting.

5. **Budget period distribution is optional.** A coach can add a single flat amount with no periods; period distribution is an enhancement for coaches who want monthly cash-flow visibility.

6. **Allocation installment dates can inherit from org budget periods.** When a treasurer allocates a budget line with periods to teams, the installment due dates default to the period dates. Treasurer can override before confirming.
