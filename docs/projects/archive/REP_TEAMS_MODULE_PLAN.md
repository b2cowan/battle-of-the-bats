# Rep Teams Module Plan (`module_rep_teams`)

**Phase 6 of PLATFORM_ROADMAP.md** — Competitive team program management.

**Status:** Phases 6A–6F complete. Next: 6G (roster management).

**Dependencies:** Phase 2 (plan entitlements), Phase 4 (accounting), Phase 5 (C5 public form pattern, Phase 5M practice scheduling), C2 (coach role), C4 (Supabase Storage first use).

**Migration:** `021_rep_teams.sql` — applied to Supabase ✓

---

## For the Product Manager

**What changes for an org after Phase 6:**

Today, competitive team programs — tryouts, rosters, coaches, player documents, team budgets, and schedules — are managed entirely offline: spreadsheets, email threads, shared drives, and paper waivers. There is no single place that connects a player from their tryout application through to their signed waiver, their spot on the roster, and their dues payment.

After Phase 6, the Rep Teams module gives org admins and coaches a fully connected tool for running a competitive team program, from tryouts through to end-of-year financials.

**For the org admin:**

- **Create and manage teams permanently.** Teams like "U13A" are created once and persist year-round. Each year, the admin opens a new Program Year (e.g., "2025 Season") to track that year's roster, coaching staff, schedule, and finances — while all previous years remain fully accessible as read-only history.
- **Run public tryout signups.** When tryouts are announced, the admin publishes a public registration link (no login required) that parents use to sign up their players. Submissions feed directly into an admin approval queue: Pending Review → Offer Extended → Accepted (auto-added to roster) or Declined. Players can also be added manually — no form required.
- **Manage player documents.** Publish blank waiver, medical consent, and code-of-conduct templates — org-wide or for a specific team — that coaches and families can download. Upload signed copies against specific player records. Coaches can also publish their own team-level templates.
- **Allocate shared costs across teams.** Enter a shared expense (dome permits, affiliation fees, bulk equipment) and split it across teams by percentage, number of sessions, or fixed dollar amount. Set a payment schedule per team — lump sum or custom installments with specific due dates. See in real time: what's been allocated, what's been collected, and what's overdue.

**For the coach (via the Coaches Portal — a separate portal at `/{orgSlug}/coaches/`):**

Coaches get their own access point that is completely outside the admin shell. The portal shows only the team(s) they are explicitly assigned to. A person who is both an admin and a coach has both access points; their duties are intentionally separated.

Inside the portal, a coach can:
- **Set and manage the team budget.** Set the total program budget for the season.
- **Manage player dues.** Set the dues amount per family, with installment schedules and due dates. The platform automatically sends reminder emails to families before each due date — and intelligently skips families who are already fully paid.
- **Log team expenses.** Record privately-arranged training sessions, gear purchases, and field rentals. Log tournament entry fees with separate deposit and balance due dates; mark each payment as settled.
- **Track org allocations.** See what the org has allocated to the team, view the payment schedule, and mark installments as paid — which settles the record in both the team's and the org's financials simultaneously.
- **Manage the team calendar.** Schedule all team activities in one unified view: External Tournaments (with individual game slots per day of the tournament, each with opponent and score), Scrimmages, League Games (W/L/T tracking), Practices (with recurring schedule support identical to Phase 5M), and general Team Events.

**What this is not:**

The platform does not process payments from families. Dues are collected by the coach by whatever method they use (e-transfer, cash, etc.). FieldLogicHQ records whether dues have been paid and sends reminders — it does not hold or transfer money. This module does not manage recreational leagues. That is `module_house_league` (Phase 5).

**Role-based access:**

- `owner` / `admin`: full access to all rep teams functions in the admin shell (teams, tryouts, rosters, documents, org cost allocation).
- `coach`: access only to the Coaches Portal, scoped to their explicitly assigned team(s). Cannot access the admin shell unless they also hold a separate admin-level role.

---

## Goals

1. Introduce persistent team entities (not recreated per season) with a Program Year anchor that preserves full year-over-year history.
2. Design the C2 coach role as the first team-scoped role in the platform — scoped to a specific team within a program year, not the whole org.
3. Deploy Supabase Storage for the first time (C4) and establish the bucket structure, upload API pattern, and signed URL serving approach as a reusable foundation for all future modules.
4. Reuse the C5 public registration form pattern from Phase 5E for tryout signups — no redesign.
5. Build the Coaches Portal as the first authenticated route tree outside the admin shell.
6. Implement a three-tier accounting model: (a) org cost allocation with team payment schedules, (b) coach-managed team budget with player dues and tournament payables, (c) automated payment reminder emails with paid-status awareness.
7. Apply all five layers of the Module Build Checklist.

---

## C2 — Coach Role + Team-Scope Model

This is a prerequisite for all coaches portal routes and must be completed before implementing any route handlers.

### The Coach Role

The `coach` OrgRole is an org-level membership role (same as `admin`, `official`, etc.), but its data access is gated at the team level by the `rep_team_coaches` join table, not at the org level.

**`coach`**
- Gets `module_rep_teams` cap by default; no other module caps.
- Does NOT get admin shell access (`module_members`, `billing`, `module_accounting`, etc.).
- Route handlers for the admin shell reject the `coach` role regardless of capability overrides.
- Coaches portal routes accept only org members who have at least one active coaching assignment.

A person who is both an admin and a coach holds two separate access paths:
- As `admin`: accesses the admin shell via `/{orgSlug}/admin/`.
- As a user with a coaching assignment: accesses the coaches portal via `/{orgSlug}/coaches/`. The admin must also have a row in `rep_team_coaches` to use the portal — holding the `admin` role alone is not sufficient.

### Changes Required

**File: `lib/types.ts`**

```ts
export type OrgRole =
  | 'owner' | 'admin' | 'official'
  | 'league_admin' | 'league_registrar' | 'treasurer'
  | 'coach';   // ← new
```

**File: `lib/roles.ts`**

```ts
ROLE_DEFAULTS['coach'] = [
  'module_rep_teams',
];
```

**File: `components/admin/ManageModal.tsx` (or capability override UI)**

Add `coach` to the role selector dropdown. Confirm the capability override panel renders it correctly.

### Team-Scope Model

**`rep_team_coaches`** is the canonical authority for which teams a coach is assigned to. It is per program year — coaching staff can change when a new program year is opened.

Portal auth guard (every coaches portal route):
1. `getAuthContextWithScope()` — must return a valid org member.
2. `getCoachingAssignments(orgId, userId)` — returns `Array<{ teamId, programYearId, coachRole }>` for active program years in this org. Returns empty if none.
3. If the returned array is empty → redirect to a "You are not assigned to any teams" page; do not render portal content.
4. Every data-fetching query appends `AND team_id = ANY($coachTeamIds)` to scope results.

Coaches never see other teams' data even if they guess a URL — the team ID is always cross-checked against the coach's assignment list before any data is returned.

---

## C4 — Supabase Storage (First Use)

This is the first use of Supabase Storage in the platform. The pattern established here is the foundation for all future modules that need file storage.

### Bucket

**Bucket name:** `rep-team-documents`

**Settings:**
- **Private bucket** — public access disabled. No files are accessible without a signed URL.
- All operations use `supabaseAdmin` (service role key). The bucket itself has no Supabase-level RLS because our API routes enforce auth before generating signed URLs or uploading files.

### Path Structure

```
rep-team-documents/
  {orgId}/
    templates/
      {uuid}-{filename}        ← org-wide templates (admin-published)
    teams/
      {teamId}/
        templates/
          {uuid}-{filename}    ← team-specific templates (admin or coach published)
        players/
          {playerId}/
            {uuid}-{filename}  ← signed player documents
```

The `{uuid}-` prefix on filenames ensures uniqueness without collisions when the same filename is uploaded twice.

### Upload API Route Pattern

All upload routes follow this pattern:

```ts
// 1. Parse multipart form data (Next.js 16 FormData API)
const formData = await request.formData();
const file = formData.get('file') as File;

// 2. Validate: file type (PDF, JPG, PNG, DOCX), max size 10MB
if (file.size > 10 * 1024 * 1024) return badRequest('File exceeds 10MB limit');
const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
if (!allowedTypes.includes(file.type)) return badRequest('Unsupported file type');

// 3. Generate a unique storage path
const ext = file.name.split('.').pop();
const storagePath = `${orgId}/teams/${teamId}/players/${playerId}/${crypto.randomUUID()}-${file.name}`;

// 4. Upload to Supabase Storage
const bytes = await file.arrayBuffer();
const { error } = await supabaseAdmin.storage
  .from('rep-team-documents')
  .upload(storagePath, bytes, { contentType: file.type });
if (error) throw error;

// 5. Create DB record
const doc = await createPlayerDocument({ playerId, teamId, orgId, fileName: file.name,
  storagePath, fileSize: file.size, documentType, uploadedBy: ctx.userId });

// 6. Return document record (NOT the storage path)
return ok({ document: doc });
```

### Signed URL Serving

Documents are never served via direct URL. Every download goes through an API route that:
1. Verifies the requester's org membership and team access.
2. Calls `supabaseAdmin.storage.from('rep-team-documents').createSignedUrl(storagePath, 3600)` (1-hour expiry).
3. Returns `{ url, expiresAt }` — the client issues a direct download from the signed URL.

The `storagePath` is never exposed to the client; only the document DB record ID is used in API calls.

### Bucket Creation

The bucket must be created once in Supabase before any uploads. Document this in the migration notes:

```
-- Run once in Supabase Dashboard → Storage → New Bucket:
-- Name: rep-team-documents
-- Public: false
-- File size limit: 10485760 (10MB)
-- Allowed MIME types: application/pdf, image/jpeg, image/png,
--   application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

---

## C5 — Public Tryout Registration (Reuse Pattern)

The public tryout registration form follows the **exact pattern** established in Phase 5E (`app/[orgSlug]/league/[seasonSlug]/register/`). Do not redesign.

Key reuse points:
- Server-rendered page loads team + program year context; form is a client component.
- Form is accessible without login.
- Submission goes to a public API route (outside `/api/admin/`).
- Confirmation email sent via Resend on submit.
- Rate limiting note carried forward: basic IP-based limiting is a deferred hardening item.

Public routes for tryout registration:
- Landing: `/{orgSlug}/teams/{teamSlug}/tryouts/{yearId}`
- Form: `/{orgSlug}/teams/{teamSlug}/tryouts/{yearId}/register`
- API: `POST /api/rep-teams/{orgSlug}/{teamSlug}/tryouts/{yearId}/register`

---

## Coaches Portal Architecture

### Route Tree

The coaches portal lives entirely outside the admin shell:

```
app/[orgSlug]/coaches/
  layout.tsx              ← auth guard + coaches nav
  page.tsx                ← dashboard: list of assigned teams
  teams/
    [teamId]/
      page.tsx            ← team overview (current program year)
      schedule/
        page.tsx          ← unified team calendar
      roster/
        page.tsx          ← roster view (read-only for coach)
      documents/
        page.tsx          ← templates + download links
      accounting/
        page.tsx          ← budget overview
        dues/
          page.tsx        ← player dues schedules + installments
        expenses/
          page.tsx        ← expenses + tournament payables
        allocations/
          page.tsx        ← org allocations to this team
      history/
        page.tsx          ← past program years for this team
```

### Layout + Auth Guard

**`app/[orgSlug]/coaches/layout.tsx`** — Server component.

```tsx
export default async function CoachesLayout({ children, params }) {
  const { orgSlug } = params;
  const ctx = await getAuthContextWithScope(orgSlug).catch(() => null);

  if (!ctx) {
    redirect(`/${orgSlug}/auth/login?redirectTo=/${orgSlug}/coaches`);
  }

  const assignments = await getCoachingAssignments(ctx.org.id, ctx.userId);

  if (assignments.length === 0) {
    return <CoachesNoAssignment orgSlug={orgSlug} />;
  }

  return (
    <CoachesProvider assignments={assignments} org={ctx.org} userId={ctx.userId}>
      <CoachesShell>{children}</CoachesShell>
    </CoachesProvider>
  );
}
```

`CoachesProvider` is a client context that exposes `assignments`, `org`, and `userId` to all portal pages. This avoids re-fetching assignments on every page render.

`CoachesShell` renders a simple navigation sidebar (`CoachesSidebar.tsx`) that shows:
- "← Back to {org name}" link
- "My Teams" section — one nav entry per assigned team
- Under each team: Schedule | Roster | Documents | Accounting | History

### Team-Scope Verification in API Routes

All coaches API routes (`/api/coaches/[orgSlug]/...`) use this helper before any data access:

```ts
async function getVerifiedCoachAssignment(
  orgSlug: string,
  teamId: string,
  userId: string
): Promise<CoachingAssignment | null> {
  const assignments = await getCoachingAssignments(orgSlug, userId);
  return assignments.find(a => a.teamId === teamId) ?? null;
}

// Usage in every coaches route handler:
const assignment = await getVerifiedCoachAssignment(orgSlug, teamId, ctx.userId);
if (!assignment) return forbidden();
```

This means even if a coach guesses a team ID from another org or a team they're not assigned to, every route returns 403.

---

## Module Build Checklist (all five layers are mandatory)

| Layer | Phase |
|---|---|
| Route handler gate (`hasCapability` + `hasModuleEntitlement`) | 6C |
| Page component guard (`<AccessDenied />` when cap missing) | 6C |
| Sidebar nav item + section detection | 6C |
| Hub tile | 6C |
| Org admin layout passthrough | 6C |

---

## Phase 6A — DB Schema (Migration 021)

**File:** `supabase/migrations/021_rep_teams.sql`

> Verify the migration number against `supabase/migrations/` before creating the file. The last migration is `020_house_league.sql`.

Also required before this migration runs: create the `rep-team-documents` storage bucket in Supabase Dashboard (see C4 above).

```sql
-- ---------------------------------------------------------------
-- rep_teams: persistent team entities.
-- A team like "U13A" exists year-round; program years anchor
-- season-specific data. Teams are never deleted — archive them.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  slug        text        NOT NULL,
  sport       text        NOT NULL DEFAULT 'softball',
  age_group   text,                         -- e.g. 'U13', 'U15', 'Senior'
  description text,
  color       text,                         -- optional hex colour
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

-- ---------------------------------------------------------------
-- rep_program_years: one row per team per season year.
-- Anchors that year's roster, coaching staff, schedule, and ledger.
-- status: draft → active → completed → archived
-- tryout_open controls whether the public tryout form is accepting.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_program_years (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id                uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  text        NOT NULL,  -- e.g. '2025 Season'
  year                  int         NOT NULL,  -- e.g. 2025
  status                text        NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','active','completed','archived')),
  tryout_open           boolean     NOT NULL DEFAULT false,
  tryout_description    text,
  budget_amount         numeric(10,2),         -- total budget set by coach
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, year)
);

-- ---------------------------------------------------------------
-- rep_team_coaches: scoped coach assignments per program year.
-- A coach must be an org member (user_id maps to auth.users).
-- coach_role: head_coach or assistant_coach (display only in Phase 6;
--   no capability difference between the two in this phase).
-- UNIQUE (program_year_id, user_id): one assignment per user per year.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_team_coaches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_role      text        NOT NULL DEFAULT 'head_coach'
                              CHECK (coach_role IN ('head_coach', 'assistant_coach')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_year_id, user_id)
);

CREATE INDEX IF NOT EXISTS rep_team_coaches_user_idx
  ON rep_team_coaches(org_id, user_id);

-- ---------------------------------------------------------------
-- rep_tryout_registrations: public form submissions.
-- status flow:
--   pending_review → offered (admin extends an offer)
--   offered → accepted (player/admin confirms) → player added to roster
--   offered → declined
--   pending_review → declined
--   accepted | offered → withdrawn
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_tryout_registrations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id       uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id               uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id                uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_first_name     text        NOT NULL,
  player_last_name      text        NOT NULL,
  player_date_of_birth  date,
  player_notes          text,                  -- experience, position preference, etc.
  guardian_first_name   text        NOT NULL,
  guardian_last_name    text        NOT NULL,
  guardian_email        text        NOT NULL,
  guardian_phone        text,
  status                text        NOT NULL DEFAULT 'pending_review'
                                    CHECK (status IN (
                                      'pending_review','offered','accepted','declined','withdrawn'
                                    )),
  admin_notes           text,
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_tryout_registrations_year_idx
  ON rep_tryout_registrations(program_year_id);
CREATE INDEX IF NOT EXISTS rep_tryout_registrations_status_idx
  ON rep_tryout_registrations(program_year_id, status);
CREATE INDEX IF NOT EXISTS rep_tryout_registrations_email_idx
  ON rep_tryout_registrations(guardian_email);

-- ---------------------------------------------------------------
-- rep_roster_players: active and inactive roster members.
-- source: 'tryout' = promoted from tryout_registrations;
--         'admin_manual' = directly added by admin, bypassing tryout.
-- tryout_registration_id: links back to the originating tryout submission.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_roster_players (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id       uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id               uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id                uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_first_name     text        NOT NULL,
  player_last_name      text        NOT NULL,
  player_date_of_birth  date,
  player_number         text,
  guardian_first_name   text        NOT NULL,
  guardian_last_name    text        NOT NULL,
  guardian_email        text        NOT NULL,
  guardian_phone        text,
  status                text        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','inactive')),
  source                text        NOT NULL DEFAULT 'admin_manual'
                                    CHECK (source IN ('tryout','admin_manual')),
  tryout_registration_id uuid       REFERENCES rep_tryout_registrations(id) ON DELETE SET NULL,
  notes                 text,
  admin_notes           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_roster_players_year_idx
  ON rep_roster_players(program_year_id);
CREATE INDEX IF NOT EXISTS rep_roster_players_email_idx
  ON rep_roster_players(guardian_email);

-- ---------------------------------------------------------------
-- rep_team_events: unified team calendar.
-- event_type values:
--   external_tournament — top-level tournament entry (multi-day event)
--   tournament_game     — individual game slot within an external_tournament;
--                         parent_event_id REFERENCES the tournament entry
--   scrimmage           — standalone scrimmage vs. an opponent
--   league_game         — standalone league game (W/L/T tracked)
--   practice            — practice session; supports Phase 5M recurrence pattern
--   team_event          — catch-all (meetings, team dinners, etc.)
-- parent_event_id: NULL for top-level events; set for tournament_game slots.
-- recurrence_rule: JSONB following the Phase 5M recurrence schema.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_team_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id     uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id             uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id              uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type          text        NOT NULL
                                  CHECK (event_type IN (
                                    'external_tournament','tournament_game',
                                    'scrimmage','league_game','practice','team_event'
                                  )),
  name                text        NOT NULL,
  description         text,
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz,
  location            text,
  opponent            text,                   -- for tournament_game, scrimmage, league_game
  home_away           text        CHECK (home_away IN ('home','away','neutral')),
  home_score          int,
  away_score          int,
  result              text        CHECK (result IN ('win','loss','tie')),
  parent_event_id     uuid        REFERENCES rep_team_events(id) ON DELETE CASCADE,
  is_recurring        boolean     NOT NULL DEFAULT false,
  recurrence_rule     jsonb,
  recurrence_parent_id uuid       REFERENCES rep_team_events(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_team_events_year_idx
  ON rep_team_events(program_year_id, starts_at);
CREATE INDEX IF NOT EXISTS rep_team_events_parent_idx
  ON rep_team_events(parent_event_id);

-- ---------------------------------------------------------------
-- rep_document_templates: blank forms published for download.
-- team_id NULL = org-wide template; team_id set = team-specific template.
-- Coaches may publish their own team-specific templates.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_document_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id         uuid        REFERENCES rep_teams(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  document_type   text        NOT NULL
                              CHECK (document_type IN (
                                'waiver','medical_consent','code_of_conduct','other'
                              )),
  storage_path    text        NOT NULL,   -- path in rep-team-documents bucket
  file_name       text        NOT NULL,
  file_size       bigint      NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  published_by    uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- rep_player_documents: signed/completed forms per player.
-- template_id: links back to the template this document was uploaded against.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_player_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid        NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type   text        NOT NULL
                              CHECK (document_type IN (
                                'waiver','medical_consent','code_of_conduct','other'
                              )),
  storage_path    text        NOT NULL,
  file_name       text        NOT NULL,
  file_size       bigint      NOT NULL,
  template_id     uuid        REFERENCES rep_document_templates(id) ON DELETE SET NULL,
  uploaded_by     uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_player_documents_player_idx
  ON rep_player_documents(player_id);

-- ---------------------------------------------------------------
-- Accounting tables (three-tier model)
-- ---------------------------------------------------------------

-- rep_cost_allocations: org admin allocates a shared expense across teams.
-- source_entry_id: FK to the accounting_entries row in the org ledger
-- that represents the shared expense being split.
CREATE TABLE IF NOT EXISTS rep_cost_allocations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_entry_id  uuid        REFERENCES accounting_entries(id) ON DELETE SET NULL,
  description      text        NOT NULL,
  total_amount     numeric(10,2) NOT NULL CHECK (total_amount > 0),
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- rep_allocation_splits: per-team portion of a cost allocation.
-- split_method: how the org admin specified the split.
-- amount: the resolved dollar amount for this team (always stored as the
--   final dollar amount regardless of split_method used to compute it).
CREATE TABLE IF NOT EXISTS rep_allocation_splits (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id    uuid        NOT NULL REFERENCES rep_cost_allocations(id) ON DELETE CASCADE,
  team_id          uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  program_year_id  uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount           numeric(10,2) NOT NULL CHECK (amount > 0),
  split_method     text        NOT NULL
                               CHECK (split_method IN ('percentage','sessions','fixed')),
  split_value      numeric(10,4) NOT NULL,  -- the %, session count, or fixed $ used to compute amount
  payment_schedule text        NOT NULL DEFAULT 'standard'
                               CHECK (payment_schedule IN ('standard','custom')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (allocation_id, team_id)
);

CREATE INDEX IF NOT EXISTS rep_allocation_splits_team_idx
  ON rep_allocation_splits(team_id, program_year_id);

-- rep_allocation_installments: per-installment payment schedule for a split.
-- For payment_schedule='standard': one row with amount = full split amount.
-- For payment_schedule='custom': multiple rows with specific amounts + dates.
-- accounting_entry_id: set when marked paid (creates a transfer entry in both ledgers).
CREATE TABLE IF NOT EXISTS rep_allocation_installments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id             uuid        NOT NULL REFERENCES rep_allocation_splits(id) ON DELETE CASCADE,
  installment_number   int         NOT NULL,
  amount               numeric(10,2) NOT NULL CHECK (amount > 0),
  due_date             date        NOT NULL,
  paid_at              timestamptz,
  paid_by              uuid        REFERENCES auth.users(id),
  accounting_entry_id  uuid        REFERENCES accounting_entries(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (split_id, installment_number)
);

-- rep_player_dues_schedules: coach's dues configuration per player for a program year.
-- One row per player per program year. The coach sets total_amount and
-- installments are defined in rep_player_dues_installments.
CREATE TABLE IF NOT EXISTS rep_player_dues_schedules (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id  uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  player_id        uuid        NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  team_id          uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  total_amount     numeric(10,2) NOT NULL CHECK (total_amount > 0),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_year_id, player_id)
);

-- rep_player_dues_installments: individual due dates + amounts per player.
-- reminder_sent_at: timestamp of the last automated reminder email for this installment.
-- accounting_entry_id: set when marked paid (creates income entry in team ledger).
CREATE TABLE IF NOT EXISTS rep_player_dues_installments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id          uuid        NOT NULL REFERENCES rep_player_dues_schedules(id) ON DELETE CASCADE,
  player_id            uuid        NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  installment_number   int         NOT NULL,
  amount               numeric(10,2) NOT NULL CHECK (amount > 0),
  due_date             date        NOT NULL,
  paid_at              timestamptz,
  reminder_sent_at     timestamptz,
  accounting_entry_id  uuid        REFERENCES accounting_entries(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, installment_number)
);

CREATE INDEX IF NOT EXISTS rep_player_dues_installments_due_idx
  ON rep_player_dues_installments(due_date)
  WHERE paid_at IS NULL;

-- rep_team_expenses: coach-logged independent expenses and tournament payables.
-- expense_type='expense': general expense; amount is the total.
-- expense_type='tournament_payable': split into deposit and balance with separate due dates.
-- event_id: optional link to a rep_team_events row (for tournament payables).
-- accounting_entry_id: set when marked fully paid.
CREATE TABLE IF NOT EXISTS rep_team_expenses (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id      uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id              uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id               uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_type         text        NOT NULL
                                   CHECK (expense_type IN ('expense','tournament_payable')),
  description          text        NOT NULL,
  category             text,
  amount               numeric(10,2) NOT NULL CHECK (amount > 0),
  -- For expense: when was it paid?
  expense_paid_at      timestamptz,
  -- For tournament_payable: deposit tracking
  deposit_amount       numeric(10,2),
  deposit_due_date     date,
  deposit_paid_at      timestamptz,
  -- For tournament_payable: balance tracking
  balance_amount       numeric(10,2),
  balance_due_date     date,
  balance_paid_at      timestamptz,
  -- Optional link to a rep_team_events row
  event_id             uuid        REFERENCES rep_team_events(id) ON DELETE SET NULL,
  accounting_entry_id  uuid        REFERENCES accounting_entries(id) ON DELETE SET NULL,
  created_by           uuid        REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_team_expenses_year_idx
  ON rep_team_expenses(program_year_id);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE rep_teams                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_program_years            ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_team_coaches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_tryout_registrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_roster_players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_team_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_document_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_player_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_cost_allocations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_allocation_splits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_allocation_installments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_player_dues_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_player_dues_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_team_expenses            ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's rep teams data
CREATE POLICY "org members can read rep_teams"
  ON rep_teams FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read rep_program_years"
  ON rep_program_years FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read rep_team_coaches"
  ON rep_team_coaches FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read rep_tryout_registrations"
  ON rep_tryout_registrations FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Public insert: allowed only for program years with tryout_open = true
CREATE POLICY "public can submit tryout registrations"
  ON rep_tryout_registrations FOR INSERT
  WITH CHECK (
    program_year_id IN (
      SELECT id FROM rep_program_years WHERE tryout_open = true
    )
  );

CREATE POLICY "org members can read rep_roster_players"
  ON rep_roster_players FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Coaches can read their assigned team's roster
CREATE POLICY "coaches can read assigned team roster"
  ON rep_roster_players FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read rep_team_events"
  ON rep_team_events FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team events"
  ON rep_team_events FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read document_templates"
  ON rep_document_templates FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team templates"
  ON rep_document_templates FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ) OR team_id IS NULL AND org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read player documents"
  ON rep_player_documents FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team player documents"
  ON rep_player_documents FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read cost_allocations"
  ON rep_cost_allocations FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read allocation_splits"
  ON rep_allocation_splits FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read their team's allocation_splits"
  ON rep_allocation_splits FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read allocation_installments"
  ON rep_allocation_installments FOR SELECT
  USING (split_id IN (
    SELECT id FROM rep_allocation_splits
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

CREATE POLICY "coaches can read their team's allocation_installments"
  ON rep_allocation_installments FOR SELECT
  USING (split_id IN (
    SELECT id FROM rep_allocation_splits
    WHERE team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())
  ));

CREATE POLICY "coaches can read their team's dues_schedules"
  ON rep_player_dues_schedules FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read their team's dues_installments"
  ON rep_player_dues_installments FOR SELECT
  USING (schedule_id IN (
    SELECT id FROM rep_player_dues_schedules
    WHERE team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())
  ));

CREATE POLICY "coaches can read their team's expenses"
  ON rep_team_expenses FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read team_expenses"
  ON rep_team_expenses FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
```

---

## Phase 6B — TypeScript Types + DB Helpers

### B1 — Add to `lib/types.ts`

```ts
export type RepProgramYearStatus = 'draft' | 'active' | 'completed' | 'archived';
export type RepTryoutStatus = 'pending_review' | 'offered' | 'accepted' | 'declined' | 'withdrawn';
export type RepRosterStatus = 'active' | 'inactive';
export type RepEventType =
  | 'external_tournament' | 'tournament_game'
  | 'scrimmage' | 'league_game' | 'practice' | 'team_event';
export type RepDocumentType = 'waiver' | 'medical_consent' | 'code_of_conduct' | 'other';
export type RepExpenseType = 'expense' | 'tournament_payable';
export type RepCoachRole = 'head_coach' | 'assistant_coach';
export type RepSplitMethod = 'percentage' | 'sessions' | 'fixed';

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
  coachRole: RepCoachRole;
  createdAt: string;
}

// Enriched coach record with display name (joined from profiles/members)
export interface RepTeamCoachDetail extends RepTeamCoach {
  displayName: string | null;
  email: string | null;
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
  status: RepTryoutStatus;
  adminNotes: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface RepRosterPlayer {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth: string | null;
  playerNumber: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string | null;
  status: RepRosterStatus;
  source: 'tryout' | 'admin_manual';
  tryoutRegistrationId: string | null;
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
  splitMethod: RepSplitMethod;
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
  amount: number;
  dueDate: string;
  paidAt: string | null;
  reminderSentAt: string | null;
  accountingEntryId: string | null;
  createdAt: string;
}

export interface RepTeamExpense {
  id: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  expenseType: RepExpenseType;
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
  accountingEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Coaching assignment shape returned by getCoachingAssignments
export interface CoachingAssignment {
  teamId: string;
  programYearId: string;
  coachRole: RepCoachRole;
  team: RepTeam;
  programYear: RepProgramYear;
}

// Summary for the admin team list card
export interface RepTeamSummary {
  team: RepTeam;
  activeProgramYear: RepProgramYear | null;
  rosterCount: number;
  coachCount: number;
  pendingTryouts: number;
}
```

### B2 — Add to `lib/db.ts`

Key helper signatures. Implementations follow the same pattern as accounting and house league helpers.

```ts
// Teams
export async function getRepTeams(orgId: string): Promise<RepTeam[]>
export async function getRepTeamBySlug(orgId: string, slug: string): Promise<RepTeam | null>
export async function getRepTeamById(teamId: string, orgId: string): Promise<RepTeam | null>
export async function createRepTeam(orgId: string, input: RepTeamInput): Promise<RepTeam>
export async function updateRepTeam(teamId: string, orgId: string, input: Partial<RepTeamInput>): Promise<void>

// Program Years
export async function getProgramYearsForTeam(teamId: string): Promise<RepProgramYear[]>
export async function getActiveProgramYear(teamId: string): Promise<RepProgramYear | null>
export async function getProgramYearById(yearId: string, orgId: string): Promise<RepProgramYear | null>
export async function createProgramYear(input: RepProgramYearInput): Promise<RepProgramYear>
export async function updateProgramYear(yearId: string, input: Partial<RepProgramYearInput>): Promise<void>
export async function getOrCreateTeamLedger(orgId: string, programYearId: string, label: string): Promise<AccountingLedger>

// Coaches
export async function getCoachesForProgramYear(programYearId: string): Promise<RepTeamCoachDetail[]>
export async function getCoachingAssignments(orgId: string, userId: string): Promise<CoachingAssignment[]>
export async function assignCoach(input: { programYearId: string; teamId: string; orgId: string; userId: string; coachRole: RepCoachRole }): Promise<RepTeamCoach>
export async function removeCoach(programYearId: string, userId: string): Promise<void>

// Tryout Registrations
export async function getTryoutRegistrations(programYearId: string, opts?: { status?: RepTryoutStatus }): Promise<RepTryoutRegistration[]>
export async function getTryoutRegistrationById(regId: string, orgId: string): Promise<RepTryoutRegistration | null>
export async function createTryoutRegistration(input: PublicTryoutInput): Promise<RepTryoutRegistration>
export async function updateTryoutStatus(regId: string, status: RepTryoutStatus, adminNotes?: string): Promise<void>
// When status → accepted: creates a rep_roster_players row copied from tryout data
export async function acceptTryoutAndAddToRoster(regId: string, orgId: string): Promise<RepRosterPlayer>

// Roster Players
export async function getRosterPlayers(programYearId: string, opts?: { status?: RepRosterStatus }): Promise<RepRosterPlayer[]>
export async function getRosterPlayerById(playerId: string, orgId: string): Promise<RepRosterPlayer | null>
export async function addPlayerToRoster(input: ManualRosterAddInput): Promise<RepRosterPlayer>
export async function updateRosterPlayer(playerId: string, orgId: string, input: Partial<ManualRosterAddInput>): Promise<void>

// Team Events (unified calendar)
export async function getTeamEvents(programYearId: string, opts?: { from?: string; to?: string; eventType?: RepEventType }): Promise<RepTeamEvent[]>
export async function getEventById(eventId: string, orgId: string): Promise<RepTeamEvent | null>
export async function createTeamEvent(input: RepTeamEventInput): Promise<RepTeamEvent>
export async function updateTeamEvent(eventId: string, orgId: string, input: Partial<RepTeamEventInput>): Promise<void>
export async function deleteTeamEvent(eventId: string, orgId: string): Promise<void>
// For tournament game slots: convenience helper to fetch parent + all child game slots
export async function getTournamentWithGameSlots(tournamentEventId: string, orgId: string): Promise<{ tournament: RepTeamEvent; games: RepTeamEvent[] }>

// Document Templates
export async function getDocumentTemplates(orgId: string, teamId?: string): Promise<RepDocumentTemplate[]>
export async function createDocumentTemplate(input: RepDocumentTemplateInput): Promise<RepDocumentTemplate>
export async function deactivateDocumentTemplate(templateId: string, orgId: string): Promise<void>

// Player Documents
export async function getPlayerDocuments(playerId: string, orgId: string): Promise<RepPlayerDocument[]>
export async function createPlayerDocument(input: RepPlayerDocumentInput): Promise<RepPlayerDocument>
export async function deletePlayerDocument(docId: string, orgId: string): Promise<void>

// Cost Allocations
export async function getCostAllocations(orgId: string): Promise<RepCostAllocation[]>
export async function getAllocationById(allocationId: string, orgId: string): Promise<RepCostAllocation | null>
export async function createCostAllocation(input: RepCostAllocationInput): Promise<RepCostAllocation>
export async function getAllocationSplits(allocationId: string): Promise<RepAllocationSplit[]>
export async function createAllocationSplit(input: RepAllocationSplitInput): Promise<RepAllocationSplit>
export async function getAllocationInstallments(splitId: string): Promise<RepAllocationInstallment[]>
export async function createAllocationInstallments(splitId: string, installments: Array<{ installmentNumber: number; amount: number; dueDate: string }>): Promise<void>
export async function markAllocationInstallmentPaid(installId: string, paidBy: string): Promise<void>
// markAllocationInstallmentPaid: sets paid_at, calls create_accounting_transfer RPC to settle
// both the org ledger (income) and the team ledger (expense reduction) atomically.

// Player Dues
export async function getPlayerDuesSchedule(programYearId: string, playerId: string): Promise<RepPlayerDuesSchedule | null>
export async function upsertPlayerDuesSchedule(input: RepPlayerDuesScheduleInput): Promise<RepPlayerDuesSchedule>
export async function getDuesInstallments(scheduleId: string): Promise<RepPlayerDuesInstallment[]>
export async function replaceDuesInstallments(scheduleId: string, playerId: string, installments: Array<{ installmentNumber: number; amount: number; dueDate: string }>): Promise<void>
export async function markDuesInstallmentPaid(installId: string, teamLedgerId: string, playerId: string, createdBy: string): Promise<void>
// markDuesInstallmentPaid: sets paid_at, creates a 'posted' income entry in the team ledger.

// Team Expenses
export async function getTeamExpenses(programYearId: string): Promise<RepTeamExpense[]>
export async function createTeamExpense(input: RepTeamExpenseInput): Promise<RepTeamExpense>
export async function updateTeamExpense(expenseId: string, orgId: string, input: Partial<RepTeamExpenseInput>): Promise<void>
export async function markExpensePaid(expenseId: string, teamLedgerId: string, createdBy: string): Promise<void>
export async function markTournamentDeposit(expenseId: string, teamLedgerId: string, createdBy: string): Promise<void>
export async function markTournamentBalance(expenseId: string, teamLedgerId: string, createdBy: string): Promise<void>
// Each mark* helper creates a corresponding accounting_entries row in the team ledger.

// Due reminders (Phase 6M)
export async function getDueReminderCandidates(orgId: string, daysAhead: number): Promise<Array<{
  installment: RepPlayerDuesInstallment;
  player: RepRosterPlayer;
  schedule: RepPlayerDuesSchedule;
}>>
// Returns unpaid installments due within daysAhead days where:
//   - paid_at IS NULL
//   - The player's schedule has at least one unpaid installment
//   - reminder_sent_at IS NULL OR reminder_sent_at < NOW() - interval '7 days'
```

---

## Phase 6C — Module Shell (Module Build Checklist)

### C1 — Route Handler Gate

All admin rep teams API routes begin with:
```ts
const ctx = await getAuthContextWithScope();
if (!ctx) return unauthorized();
if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
```

For write operations (admin only — owner, admin):
```ts
const canWrite = ctx.role === 'owner' || ctx.role === 'admin';
if (!canWrite) return forbidden();
```

Coaches API routes use a different guard (see Coaches Portal Architecture above) — they do not use `hasCapability` against `module_rep_teams` because the coach role is already validated via the coaching assignment check.

### C2 — Page Component Guard

In all admin rep teams pages (after `useOrg()` resolves):
```tsx
if (!hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
  return (
    <div className="p-8 text-center">
      <Users size={32} className="mx-auto mb-4 opacity-40" />
      <h2 className="font-bold text-lg mb-2">Access Restricted</h2>
      <p className="text-sm text-data-gray">
        You don't have access to the Rep Teams module.
        Contact your organization owner to enable it.
      </p>
    </div>
  );
}
```

### C3 — Sidebar Nav Item

**File:** `components/admin/AdminSidebar.tsx`

```ts
const isRepTeams = pathname.startsWith(`${base}/rep-teams`);

const canSeeRepTeams = userRole
  ? hasCapability(userRole, userCapabilities, 'module_rep_teams')
  : false;
```

Update the tournament operations guard to exclude the rep teams section:
```ts
{!isHub && !isOrgAdmin && !isPublicSite && !isAccounting && !isHouseLeague && !isRepTeams && (
```

Add rep teams sidebar block (with team-context-aware secondary nav):
```tsx
{isRepTeams && canSeeRepTeams && (
  <>
    {backLink}
    <div className={styles.navSection}>
      <div className={styles.sectionHeader}>Rep Teams</div>
      <nav className={styles.nav}>
        {navLink('rt-teams', Users, 'Teams', `${base}/rep-teams`,
          pathname === `${base}/rep-teams`)}
        {navLink('rt-allocations', DollarSign, 'Cost Allocation',
          `${base}/rep-teams/allocations`,
          pathname.startsWith(`${base}/rep-teams/allocations`))}
        {navLink('rt-docs', FileText, 'Document Templates',
          `${base}/rep-teams/documents`,
          pathname.startsWith(`${base}/rep-teams/documents`))}
        {navLink('rt-past', Archive, 'Past Seasons',
          `${base}/rep-teams/past`,
          pathname.startsWith(`${base}/rep-teams/past`))}
      </nav>
    </div>
    {currentTeamId && (
      <div className={styles.navSection}>
        <div className={styles.sectionHeader}>{currentTeamName}</div>
        <nav className={styles.nav}>
          {navLink('rt-tryouts', ClipboardList, 'Tryouts',
            `${base}/rep-teams/teams/${currentTeamId}/program-years/${currentYearId}/tryouts`, ...)}
          {navLink('rt-roster', Users, 'Roster',
            `${base}/rep-teams/teams/${currentTeamId}/program-years/${currentYearId}/roster`, ...)}
          {navLink('rt-schedule', Calendar, 'Schedule',
            `${base}/rep-teams/teams/${currentTeamId}/program-years/${currentYearId}/schedule`, ...)}
          {navLink('rt-documents', FileText, 'Documents',
            `${base}/rep-teams/teams/${currentTeamId}/program-years/${currentYearId}/documents`, ...)}
          {navLink('rt-coaches', UserCheck, 'Coaches',
            `${base}/rep-teams/teams/${currentTeamId}/program-years/${currentYearId}/coaches`, ...)}
        </nav>
      </div>
    )}
  </>
)}
```

`currentTeamId` and `currentYearId` extracted from the pathname via regex.

### C4 — Hub Tile

**File:** `app/[orgSlug]/admin/page.tsx`

```tsx
const canSeeRepTeams = !loading && userRole
  ? hasCapability(userRole, userCapabilities, 'module_rep_teams')
  : false;

canSeeRepTeams && {
  label: 'Rep Teams',
  desc: 'Manage competitive team programs — tryouts, rosters, player documents, schedules, and team finances',
  icon: Users,
  href: `${base}/rep-teams`,
},
```

### C5 — Layout Passthrough

**File:** `app/[orgSlug]/admin/rep-teams/layout.tsx`

```tsx
export default function RepTeamsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

---

## Phase 6D — Team + Program Year Management (Admin)

### API Routes

**`app/api/admin/rep-teams/teams/route.ts`**
```
GET  — list all teams for org (with RepTeamSummary: active year, roster count, pending tryouts)
POST — create a new team (owner or admin only)
```

POST body:
```ts
{
  name: string;        // max 100 chars
  slug: string;        // auto-suggested from name; unique per org
  sport: string;       // default 'softball'
  ageGroup: string | null;
  description: string | null;
  color: string | null; // hex color
}
```

**`app/api/admin/rep-teams/teams/[teamId]/route.ts`**
```
GET   — team detail (all program years + coaches per year + summary)
PATCH — update team fields (name, description, color, isArchived)
```

**`app/api/admin/rep-teams/teams/[teamId]/program-years/route.ts`**
```
GET  — list all program years for this team (chronological)
POST — create a new program year (owner or admin only)
```

POST body:
```ts
{
  name: string;             // e.g. '2025 Season'
  year: number;             // integer year
  tryoutOpen: boolean;
  tryoutDescription: string | null;
}
```

Guard: only one program year per team may be `active` at a time. If a previous year is `active`, the POST returns 409 with a message to complete or archive the current year first.

**`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/route.ts`**
```
GET   — program year detail (coaches, roster summary, tryout count)
PATCH — update fields (name, status, tryoutOpen, tryoutDescription, budgetAmount)
```

Lifecycle transitions via PATCH on `status`:
- `draft → active`: allowed; can only have one active year per team.
- `active → completed`: allowed at any time.
- `completed → archived`: allowed; archives the program year ledger.
- No backwards transitions.

**`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/route.ts`**
```
GET    — list coaches for this program year (with display names)
POST   — assign a coach (orgId + userId + coachRole)
DELETE — remove a coaching assignment (?userId=)
```

POST guard: the `userId` must be an existing org member. Coaches are assigned from the org's existing members list (no separate invite flow).

### Admin UI Pages

**`app/[orgSlug]/admin/rep-teams/page.tsx`** — Team List

After capability guard: page header "Rep Teams". A card per team showing name, age group badge, active program year name + status badge, roster count, pending tryouts count. Owner/admin: "Create Team" button → modal with the POST body fields. Archive toggle on each card (destructive confirmation).

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx`** — Team Overview

Team header: name, age group, sport, color swatch. Program years list below (newest first): year name, status badge, roster count, quick-action links (Open Tryouts, View Roster, View Schedule). "Add Program Year" button.

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/page.tsx`** — Program Year Overview

Program year header: team name → year name, status badge, tryout open/closed indicator. Summary cards: Roster (N active players), Tryouts (N pending review), Coaches (N assigned), Schedule (N upcoming events). Links to each sub-section. Lifecycle controls (owner/admin): status transition buttons. If accounting module is enabled: "Team Ledger →" link.

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/page.tsx`** — Coach Management

Two-column layout: left shows current coach assignments (name, role badge, "Remove" action). Right shows an "Assign Coach" panel: org member search dropdown → role selector (Head Coach / Assistant) → Assign button.

---

## Phase 6E — Public Tryout Registration (C5 Pattern)

### Public Routes

**`app/[orgSlug]/teams/[teamSlug]/page.tsx`** — Team Public Landing

Displays: team name, sport/age group, description, color accent. If an active program year has `tryout_open = true`: "Tryouts Open" banner with link to the registration form. Past program years shown as a history timeline (read-only: year, completion status).

**`app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx`** — Tryout Landing

Displays: program year name, tryout description, dates (from program year). If `tryout_open = true`: "Register for Tryouts" CTA. If closed: "Tryout registration is not currently open."

**`app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/register/page.tsx`** — Tryout Form

Server-rendered page loads team + program year context. Form is a `TryoutRegisterForm` client component. Follows the Phase 5E `RegisterForm` pattern exactly.

Form sections:
1. **Player Information** — First name, last name (required); date of birth (required); additional notes (optional, 500 chars max — position preference, experience, etc.)
2. **Parent/Guardian Information** — First name, last name (required); email (required); phone (optional)
3. **Submit** — "Submit Tryout Application". On success: confirmation panel with player name, reference ID, and instruction to watch for a confirmation email. On error: inline validation.

### Tryout Registration API (public — no auth)

**`app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts`**

```
POST — submit a tryout application
```

Server-side:
1. Resolve org by `orgSlug`, team by `teamSlug` within org, program year by `yearId`.
2. Verify `programYear.tryoutOpen === true`; return 409 if not.
3. Validate all required fields; return 400 with field errors if invalid.
4. Insert into `rep_tryout_registrations` with `status = 'pending_review'`.
5. Send confirmation email to `guardianEmail` via Resend: "We've received your tryout application for [Player Name] for the [Team Name] [Year Name] program. Our coaching staff will be in touch."
6. Return `{ id, status: 'pending_review' }`.

### Status Notification Emails

Triggered by admin status updates in Phase 6F:

- `pending_review → offered`: "We're pleased to let you know that [Player Name] has been offered a roster spot on [Team Name]. Please log in to accept or decline this offer by [date]." (Or: "Please reply to this email to accept or decline.")
- `offered → accepted`: "[Player Name] has been added to the [Team Name] [Year Name] roster. Welcome to the team!"
- `offered → declined`: "Thank you for attending tryouts. Unfortunately we are unable to offer [Player Name] a roster spot at this time."
- `pending_review → declined`: "Thank you for registering. Unfortunately we are unable to offer [Player Name] a roster spot at this time."

All emails use the org's existing Resend setup and FieldLogicHQ email templates.

---

## Phase 6F — Tryout Approval Queue (Admin)

### API Routes

**`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/route.ts`**
```
GET  — list tryout registrations (supports ?status=&search=)
POST — manually add a tryout applicant (admin_manual source; bypasses tryoutOpen check)
```

**`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/[regId]/route.ts`**
```
GET   — single registration detail
PATCH — update status, adminNotes
```

PATCH status transitions:
- `pending_review → offered`: sends offer email.
- `offered → accepted`: calls `acceptTryoutAndAddToRoster` helper — creates a `rep_roster_players` row copied from tryout data (with `tryout_registration_id` linking back), sends acceptance email. The player appears immediately on the roster.
- `offered → declined | pending_review → declined | any → withdrawn`: sends decline email (for `declined`).

### Admin UI Page

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx`**

Client component with tabs: **Pending Review** | **Offer Extended** | **Accepted** | **Declined/Withdrawn** | **All**

Each tab shows a table: Player name | Date of birth | Guardian email | Phone | Submitted at | Status badge | Actions

Action column per tab:
- Pending: "Extend Offer" button → confirmation dialog → PATCH status → offer email.
- Offer Extended: "Mark Accepted" / "Mark Declined" buttons.
- All tabs: "View details" slide-over showing full application + admin notes field.

**Open Tryouts toggle** at page top (owner/admin): switches `programYear.tryoutOpen`. When enabled, shows the public form URL with a copy-link button.

---

## Phase 6G — Roster Management

### API Routes

**`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/route.ts`**
```
GET  — list roster players (supports ?status=active|inactive&search=)
POST — manually add a player to the roster (bypasses tryout flow)
```

POST body:
```ts
{
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth: string | null;
  playerNumber: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string | null;
  notes: string | null;
  adminNotes: string | null;
}
```

**`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/[playerId]/route.ts`**
```
GET   — player detail (with documents list + dues schedule summary)
PATCH — update player fields, status (active ↔ inactive)
```

### Admin UI Page

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/page.tsx`**

List view: player name | number | guardian email | phone | source badge (Tryout / Manual) | status badge | "View" link.

"Add Player" button (owner/admin): slide-over with the POST body fields.

Status toggle per row: Active / Inactive.

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/[playerId]/page.tsx`** — Player Detail

Player info section (editable). Documents section below: list of uploaded documents with type badge, filename, upload date, download link. "Upload Document" button → file picker with document type selector. Document templates section: downloadable blank forms for this team/org. Dues summary: total dues configured, amount paid, outstanding balance (links to the accounting section).

---

## Phase 6H — Player Documents (C4: Supabase Storage)

### Storage Bucket Setup

Create `rep-team-documents` bucket as described in C4. This is a one-time setup step that must happen before any uploads.

### API Routes

**`app/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents/route.ts`**
```
GET  — list documents for a player
POST — upload a document (multipart/form-data)
```

POST: follows the C4 upload pattern. Form fields: `file` (File), `documentType` (RepDocumentType), `templateId?` (string).

**`app/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents/[docId]/route.ts`**
```
GET    — returns a signed download URL (1-hour expiry)
DELETE — removes the DB record + deletes from Supabase Storage
```

**`app/api/admin/rep-teams/document-templates/route.ts`**
```
GET  — list org-wide templates (optionally ?teamId= for team-specific)
POST — upload a new template (multipart/form-data)
```

POST body: `file` (File), `name` (string), `documentType` (RepDocumentType), `teamId?` (string — null for org-wide).

**`app/api/admin/rep-teams/document-templates/[templateId]/route.ts`**
```
GET    — returns a signed download URL for the template
PATCH  — toggle isActive
DELETE — removes template DB record + deletes from storage
```

**Coaches portal upload:**

**`app/api/coaches/[orgSlug]/teams/[teamId]/documents/templates/route.ts`**
```
GET  — list templates for this team (org-wide + team-specific)
POST — upload a team-specific template (coach can publish their own)
```

### Admin UI Page

**`app/[orgSlug]/admin/rep-teams/documents/page.tsx`** — Document Templates

Two sections: **Org-Wide Templates** and **Team Templates** (grouped by team). Each template row: name, document type badge, filename, active toggle, download link, delete button.

"Upload Template" button → modal: file picker + name field + document type selector + "Org-wide or specific team?" selector.

---

## Phase 6I — Coaches Portal Foundation

### Files

**`app/[orgSlug]/coaches/layout.tsx`** — Server component auth guard (see Coaches Portal Architecture above).

**`components/coaches/CoachesSidebar.tsx`** — Client component.

Navigation structure:
- "← [org name]" back link (to the org's public page, not the admin shell)
- "My Teams" section: one item per assigned team → links to `/coaches/teams/[teamId]`
- When inside a team sub-page: team-level nav group appears:
  - Overview | Schedule | Roster | Documents | Accounting | History

**`app/[orgSlug]/coaches/page.tsx`** — Dashboard

Reads `assignments` from `CoachesContext`. Renders one card per assigned team:
- Team name, age group, color swatch
- Current program year name + status badge
- Quick stats: roster count, next upcoming event, outstanding dues

**`app/[orgSlug]/coaches/teams/[teamId]/page.tsx`** — Team Overview

Fetches current program year for this team. Renders:
- Team header (name, age group, season name)
- Upcoming events widget (next 3 events from rep_team_events)
- Accounting summary widget (budget, dues collected %, expenses total)
- Quick links: Schedule | Roster | Accounting | Documents

Coach auth check in every coaches portal page component:
```tsx
const { assignments } = useCoaches();
const assignment = assignments.find(a => a.teamId === teamId);
if (!assignment) return <CoachesAccessDenied />;
```

### Coaches API: Team Info

**`app/api/coaches/[orgSlug]/teams/[teamId]/route.ts`**
```
GET — team + current program year detail (scoped to coach's assignment)
```

---

## Phase 6J — Coaches Portal: Team Calendar

The team calendar is the coaches portal's primary scheduling tool. Six event types as defined in the schema. The `practice` event type uses the Phase 5M recurring schedule pattern exactly — follow the house league implementation without deviation.

### API Routes

**`app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts`**
```
GET  — list events for the current program year (?from=&to=&type=)
POST — create an event
```

POST body:
```ts
{
  eventType: RepEventType;
  name: string;
  description: string | null;
  startsAt: string;       // ISO datetime
  endsAt: string | null;
  location: string | null;
  // For tournament_game / scrimmage / league_game:
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  // For tournament_game: link to parent External Tournament event
  parentEventId: string | null;
  // For practice: recurrence
  isRecurring: boolean;
  recurrenceRule: Record<string, unknown> | null;
}
```

Creating an `external_tournament` event: creates the top-level entry only. Game slots are added as separate POST calls with `eventType='tournament_game'` and `parentEventId` pointing to the tournament.

**`app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts`**
```
PATCH  — update event (score entry, reschedule, rename)
DELETE — remove event; if external_tournament, also deletes all child game slots (CASCADE)
```

Score entry via PATCH:
```ts
{
  homeScore: number;
  awayScore: number;
  result: 'win' | 'loss' | 'tie';  // auto-computed for league_game but accept explicitly
}
```

Admins can also manage the team calendar via:

**`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/events/route.ts`**
```
GET  — same as coaches route (read-only for admin calendar view)
POST — same event creation (admin can add events too)
```

### Coaches Portal UI

**`app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`**

Month/week/list view toggle. Unified calendar showing all event types color-coded by type:
- External Tournament: orange
- Tournament Game (child slot): amber
- Scrimmage: blue
- League Game: green
- Practice: purple
- Team Event: grey

Clicking an event opens a detail slide-over: full event info, opponent, score (if entered), edit/delete actions.

"Add Event" dropdown button with event type picker. Creating an External Tournament opens the form; after saving, the event detail shows a "Add Game Slot" action to add child games.

Recurring practices: same UI as Phase 5M — create practice with recurrence rule, edit individual occurrence or all future occurrences.

**League game record tracker:** A summary widget below the calendar shows the season W/L/T record computed from all `league_game` events with a result set.

### Admin Calendar View

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx`**

Read-only calendar view for org admin visibility. Admin can add/edit events here too (via the admin API routes). Same layout as the coaches portal calendar.

---

## Phase 6K — Accounting: Org Cost Allocation

The org admin enters shared expenses and splits them across teams with custom payment schedules. The org ledger (existing `entity_type='org'`) tracks the source expense. Each team's split appears as a payable in the team's ledger.

### API Routes

**`app/api/admin/rep-teams/allocations/route.ts`**
```
GET  — list all cost allocations for the org (with split status per team)
POST — create a cost allocation (owner or treasurer only)
```

POST body:
```ts
{
  description: string;           // max 200 chars
  totalAmount: number;
  sourceEntryId: string | null;  // existing accounting_entries id (the org expense being allocated)
  splits: Array<{
    teamId: string;
    programYearId: string;
    splitMethod: 'percentage' | 'sessions' | 'fixed';
    splitValue: number;          // % or session count or fixed $
    amount: number;              // resolved dollar amount (client computes; server validates sum ≤ totalAmount)
    paymentSchedule: 'standard' | 'custom';
    installments: Array<{
      installmentNumber: number;
      amount: number;
      dueDate: string;           // YYYY-MM-DD
    }>;
  }>;
}
```

Server-side:
1. Dual gate + `owner` or `treasurer` check.
2. Validate: splits sum ≤ totalAmount (allow partial allocation — org may retain a portion).
3. Create `rep_cost_allocations` row.
4. For each split: create `rep_allocation_splits` + `rep_allocation_installments` rows.
5. For each team split: call `getOrCreateTeamLedger` to ensure the team has an accounting ledger.
6. Return allocation with all splits and installments.

**`app/api/admin/rep-teams/allocations/[allocationId]/route.ts`**
```
GET   — allocation detail with all splits + installment status
PATCH — update description (splits cannot be edited after creation; void and re-create)
```

**`app/api/admin/rep-teams/allocations/[allocationId]/splits/[splitId]/installments/[installId]/route.ts`**
```
PATCH — mark installment paid (owner, treasurer, or the assigned coach for their team)
```

Marking paid:
1. Verify caller is owner/treasurer OR a coach assigned to the split's team.
2. Set `paid_at = NOW()`, `paid_by = ctx.userId`.
3. Call `create_accounting_transfer` RPC: from team ledger (transfer_out) to org ledger (transfer_in) for the installment amount. Sets `accounting_entry_id` on the installment.
4. Return updated installment.

### Admin UI Pages

**`app/[orgSlug]/admin/rep-teams/allocations/page.tsx`** — Allocation Overview

Table of all cost allocations: description, total amount, number of teams, amount collected, amount outstanding. Color-coded overdue indicators.

**`app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx`** — Create Allocation

Step 1: Enter description, total amount, and optionally link to an existing org ledger entry (typeahead search).

Step 2: Per-team split configuration. Team selector (dropdown). Split method selector with live calculation: entering "35%" shows computed dollar amount. Payment schedule selector: "Lump Sum" (one installment, one due date) or "Custom" (add installment rows with amount + date).

Step 3: Review + submit. Shows split breakdown and total allocated vs. total amount.

**`app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx`** — Allocation Detail

Per-team accordion: team name, amount allocated, payment schedule. Each installment row: amount, due date, paid status, paid date (if paid). Overdue installments highlighted. Admin can mark installments as paid from this page (owner/treasurer only from admin UI; coaches use their portal).

Real-time summary header: Total allocated | Total collected | Total outstanding | Overdue count.

---

## Phase 6L — Accounting: Coach-Managed Team Budget

Coaches have full budget autonomy in their team's accounting section of the coaches portal. All writes go through authenticated coaches API routes.

### Budget Settings

**`app/api/coaches/[orgSlug]/teams/[teamId]/budget/route.ts`**
```
GET   — current program year budget + high-level summary
PATCH — set/update budget_amount for the active program year
```

### Player Dues

**`app/api/coaches/[orgSlug]/teams/[teamId]/dues/route.ts`**
```
GET  — all player dues schedules for the program year (with installments + paid status per player)
POST — create or update a dues schedule for a player
```

POST body:
```ts
{
  playerId: string;
  totalAmount: number;
  notes: string | null;
  installments: Array<{
    installmentNumber: number;
    amount: number;
    dueDate: string;
  }>;
}
```

Server-side: calls `upsertPlayerDuesSchedule` + `replaceDuesInstallments`. Validates installments sum = totalAmount.

**`app/api/coaches/[orgSlug]/teams/[teamId]/dues/[scheduleId]/installments/[installId]/route.ts`**
```
PATCH — mark installment paid
```

Marking paid: sets `paid_at`, creates a posted income entry in the team's accounting ledger via `markDuesInstallmentPaid`, sets `accounting_entry_id`.

**Org Allocation View for Coaches:**

**`app/api/coaches/[orgSlug]/teams/[teamId]/allocations/route.ts`**
```
GET — all allocation splits for this team with installment status
```

**`app/api/coaches/[orgSlug]/teams/[teamId]/allocations/[splitId]/installments/[installId]/route.ts`**
```
PATCH — mark allocation installment paid (same as admin route; coach is allowed for their team)
```

### Team Expenses

**`app/api/coaches/[orgSlug]/teams/[teamId]/expenses/route.ts`**
```
GET  — list expenses for the program year
POST — log a new expense or tournament payable
```

POST body:
```ts
{
  expenseType: 'expense' | 'tournament_payable';
  description: string;
  category: string | null;
  amount: number;
  // For tournament_payable:
  depositAmount: number | null;
  depositDueDate: string | null;
  balanceAmount: number | null;
  balanceDueDate: string | null;
  eventId: string | null;       // optional link to a rep_team_events row
}
```

**`app/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]/route.ts`**
```
PATCH — update description, mark expense paid, mark deposit paid, mark balance paid
```

Mark actions:
- `markExpensePaid`: sets `expense_paid_at`, creates expense entry in team ledger.
- `markTournamentDeposit`: sets `deposit_paid_at`, creates partial expense entry in team ledger.
- `markTournamentBalance`: sets `balance_paid_at`, creates partial expense entry in team ledger.

### Coaches Portal Accounting UI Pages

**`app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx`** — Budget Overview

Header: Budget set: $X,XXX | Dues collected: $Y,YYY | Expenses: $Z,ZZZ | Net: $...

Sub-sections with quick links: Player Dues | Expenses & Tournament Payables | Org Allocations.

**`app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx`** — Player Dues

Table: Player name | Total dues | Amount paid | Outstanding | Status (Fully paid / Partial / Not started). Click player row → slide-over with installment schedule. "Mark paid" per installment. "Edit schedule" → form to update total amount and installments.

"Apply to all players" shortcut: if the coach sets the same dues structure for all players, a "Set dues for all players" panel creates the same installment schedule for every active roster player in one action.

**`app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/page.tsx`** — Expenses + Tournament Payables

Two sections:

**Independent Expenses:** table with description, category, amount, paid status, paid date.

**Tournament Payables:** table with description, deposit (amount, due date, paid status), balance (amount, due date, paid status). Each payable optionally linked to a tournament calendar event.

"Add Expense" / "Add Tournament Payable" buttons.

**`app/[orgSlug]/coaches/teams/[teamId]/accounting/allocations/page.tsx`** — Org Allocations

Table per allocation: allocation description, total allocated to this team, installment rows (amount, due date, paid/overdue status, "Mark paid" button).

---

## Phase 6M — Accounting: Automated Payment Reminders

Reminder emails are sent to guardians for unpaid player dues installments approaching their due date. The system skips families where all installments are already fully paid.

### Reminder API Route

**`app/api/admin/rep-teams/send-due-reminders/route.ts`**

```
POST — find and send due reminders
```

Auth: restricted to owner or treasurer. In production, this route is intended to be called by an AWS EventBridge Scheduler (cron) on a daily schedule. It can also be triggered manually from the admin UI.

Server-side:
1. Resolve org from the auth context.
2. Call `getDueReminderCandidates(orgId, 3)` — returns installments due within 3 days where:
   - `paid_at IS NULL`
   - `reminder_sent_at IS NULL` OR `reminder_sent_at < NOW() - interval '7 days'` (resend if no response after 7 days)
   - At least one other installment in the player's schedule is also unpaid (skips players who are fully paid)
3. Group candidates by `guardianEmail` (a guardian with multiple players on the same team gets one consolidated email).
4. For each guardian: send a reminder email via Resend listing all upcoming due installments for their players.
5. Update `reminder_sent_at = NOW()` for each installment that triggered a reminder.
6. Return `{ remindersChecked, emailsSent, installmentsTagged }`.

### Reminder Email Content

Subject: "Reminder: Player dues due soon — [Team Name]"

Body:
```
Hi [Guardian First Name],

This is a friendly reminder that the following dues installments are coming up for your player(s) on [Team Name]:

• [Player Name] — $[amount] due [due date] (Installment [N] of [M])
  [repeat per installment]

To view your full payment schedule or if you have already submitted payment, please contact your coach directly.

[FieldLogicHQ]
```

### EventBridge Scheduler Setup (deferred to deployment)

Document the AWS CLI command to create the schedule in the infrastructure notes — the implementation note is tracked here but AWS setup happens at deployment time:

```
aws scheduler create-schedule \
  --name "fieldlogichq-dues-reminders" \
  --schedule-expression "cron(0 9 * * ? *)" \
  --target '{"Arn": "...", "RoleArn": "...", "Input": "..."}' \
  --flexible-time-window '{"Mode": "OFF"}'
```

### Admin UI

**Button on** `app/[orgSlug]/admin/rep-teams/allocations/page.tsx` — "Send Due Reminders" button (owner/treasurer only). Shows result: "Sent X reminder emails for Y installments." This is the manual trigger path; EventBridge is the production path.

---

## Phase 6N — Past Program Years

### Admin UI Pages

**`app/[orgSlug]/admin/rep-teams/past/page.tsx`** — Past Program Years

Lists all program years with `status IN ('completed', 'archived')` across all teams. Grouped by team. Card per year: team name, year name, season year, final roster count, completion date.

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/page.tsx`** — Per-Team History

All program years for this team in reverse chronological order. Quick stats per year: roster count, W/L/T record (from league_game events), tryout acceptance rate.

**`app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx`** — Past Year Read-Only Detail

Read-only view. Tabs: Roster | Schedule & Results | Coaches | Documents. Mirrors the active year layout without any edit actions. All buttons and toggles are replaced by read-only displays.

### Coaches Portal History

**`app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx`** — Past Program Years (Coach View)

Lists completed program years for this team. Read-only: roster, schedule results, accounting summary. Coach can view but not edit.

---

## Testing Module Gating

Follow the Module Build Checklist testing pattern from PLATFORM_ROADMAP.md:

1. As owner: Manage modal → Capability Overrides → Module Access → set `module_rep_teams` to Revoke → Save.
2. Sign in as an `admin` member in incognito.
3. Confirm:
   - Hub tile for Rep Teams is not shown.
   - Direct URL `/{orgSlug}/admin/rep-teams` renders the access-denied state.
   - `GET /api/admin/rep-teams/teams` returns 403.
4. As owner: restore the cap. Confirm tile and team list return.
5. As platform admin: remove `module_rep_teams` from `org.enabled_addons` (via DB). Confirm entitlement check fails — tile and pages are gone even for owner.

**Coach role + team-scope test:**

1. Invite a member and assign the `coach` role.
2. Assign them as head coach to Team A (but NOT Team B) via the coaches management page.
3. Sign in as that member in incognito.
4. Confirm: coaches portal dashboard shows only Team A. Attempting to navigate to `/{orgSlug}/coaches/teams/{teamBId}` returns the "You are not assigned to this team" access denied view.
5. Confirm: direct access to `GET /api/coaches/{orgSlug}/teams/{teamBId}/events` returns 403.
6. Confirm: the admin shell at `/{orgSlug}/admin/` is inaccessible (no admin tile, no nav entries for admin-only modules).

---

## File Map (New + Modified)

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/021_rep_teams.sql` | New | All tables, indexes, RLS policies |
| `lib/types.ts` | Modified | All new rep teams types + enums; add `coach` to `OrgRole` |
| `lib/roles.ts` | Modified | C2: Add `coach` to `OrgRole` and `ROLE_DEFAULTS` |
| `lib/db.ts` | Modified | All rep teams DB helpers + mappers |
| `app/api/admin/rep-teams/teams/route.ts` | New | GET (list) + POST (create team) |
| `app/api/admin/rep-teams/teams/[teamId]/route.ts` | New | GET (detail) + PATCH (update) |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/route.ts` | New | GET + POST |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/route.ts` | New | GET + PATCH (lifecycle) |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/route.ts` | New | GET + POST + DELETE |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/route.ts` | New | GET + POST (manual add) |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/[regId]/route.ts` | New | GET + PATCH (status transitions) |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/route.ts` | New | GET + POST (manual add) |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/[playerId]/route.ts` | New | GET + PATCH |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/events/route.ts` | New | GET + POST (admin calendar) |
| `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx` | New | Admin calendar read/write page |
| `app/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents/route.ts` | New | GET + POST (upload) |
| `app/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents/[docId]/route.ts` | New | GET (signed URL) + DELETE |
| `app/api/admin/rep-teams/document-templates/route.ts` | New | GET + POST (org-wide templates) |
| `app/api/admin/rep-teams/document-templates/[templateId]/route.ts` | New | GET (signed URL) + PATCH + DELETE |
| `app/api/admin/rep-teams/allocations/route.ts` | New | GET + POST (create allocation with splits) |
| `app/api/admin/rep-teams/allocations/[allocationId]/route.ts` | New | GET + PATCH |
| `app/api/admin/rep-teams/allocations/[allocationId]/splits/[splitId]/installments/[installId]/route.ts` | New | PATCH (mark paid + ledger transfer) |
| `app/api/admin/rep-teams/send-due-reminders/route.ts` | New | POST (dues reminder dispatch) |
| `app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts` | New | POST (public tryout submission) |
| `app/api/coaches/[orgSlug]/teams/[teamId]/route.ts` | New | GET (team + year info for coaches) |
| `app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts` | New | GET + POST |
| `app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts` | New | PATCH + DELETE |
| `app/api/coaches/[orgSlug]/teams/[teamId]/budget/route.ts` | New | GET + PATCH |
| `app/api/coaches/[orgSlug]/teams/[teamId]/dues/route.ts` | New | GET + POST |
| `app/api/coaches/[orgSlug]/teams/[teamId]/dues/[scheduleId]/installments/[installId]/route.ts` | New | PATCH (mark paid) |
| `app/api/coaches/[orgSlug]/teams/[teamId]/expenses/route.ts` | New | GET + POST |
| `app/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]/route.ts` | New | PATCH |
| `app/api/coaches/[orgSlug]/teams/[teamId]/allocations/route.ts` | New | GET |
| `app/api/coaches/[orgSlug]/teams/[teamId]/allocations/[splitId]/installments/[installId]/route.ts` | New | PATCH (mark paid) |
| `app/api/coaches/[orgSlug]/teams/[teamId]/documents/templates/route.ts` | New | GET + POST (coach uploads team template) |
| `app/api/coaches/[orgSlug]/teams/[teamId]/roster/route.ts` | New | GET (coach read-only view) |
| `app/[orgSlug]/teams/[teamSlug]/page.tsx` | New | Team public landing page |
| `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx` | New | Tryout landing page (public) |
| `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/register/page.tsx` | New | Tryout registration form (public, no auth) |
| `app/[orgSlug]/coaches/layout.tsx` | New | Coaches portal auth guard + shell |
| `app/[orgSlug]/coaches/page.tsx` | New | Coaches dashboard |
| `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` | New | Team overview (coaches portal) |
| `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` | New | Team calendar (coaches portal) |
| `app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx` | New | Roster read-only view (coaches portal) |
| `app/[orgSlug]/coaches/teams/[teamId]/documents/page.tsx` | New | Templates download page (coaches portal) |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx` | New | Budget overview (coaches portal) |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx` | New | Player dues management |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/page.tsx` | New | Expenses + tournament payables |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/allocations/page.tsx` | New | Org allocations view |
| `app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx` | New | Past program years (coaches portal) |
| `app/[orgSlug]/admin/rep-teams/layout.tsx` | New | Minimal passthrough layout (Layer 5) |
| `app/[orgSlug]/admin/rep-teams/page.tsx` | New | Team list overview (Layer 2) |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx` | New | Team detail + program years |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/page.tsx` | New | Program year overview |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/page.tsx` | New | Coach assignment management |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx` | New | Tryout approval queue |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/page.tsx` | New | Roster management |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/[playerId]/page.tsx` | New | Player detail + document uploads |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/schedule/page.tsx` | New | Team calendar (admin view) |
| `app/[orgSlug]/admin/rep-teams/documents/page.tsx` | New | Document template management |
| `app/[orgSlug]/admin/rep-teams/allocations/page.tsx` | New | Cost allocation overview + reminder trigger |
| `app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx` | New | Create allocation wizard |
| `app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx` | New | Allocation detail + installment tracking |
| `app/[orgSlug]/admin/rep-teams/past/page.tsx` | New | Past program years (all teams) |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/page.tsx` | New | Per-team program year history |
| `app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx` | New | Past year read-only detail |
| `components/coaches/CoachesSidebar.tsx` | New | Coaches portal navigation component |
| `components/coaches/CoachesProvider.tsx` | New | Context provider for coaching assignments |
| `app/[orgSlug]/admin/page.tsx` | Modified | Add Rep Teams hub tile (Layer 4) |
| `components/admin/AdminSidebar.tsx` | Modified | Add `isRepTeams` detection + rep teams nav + `!isRepTeams` guard (Layer 3) |
| `lib/types.ts` | Modified | `OrgRole` union + all new types |
| `lib/roles.ts` | Modified | `ROLE_DEFAULTS['coach']` |
| `components/admin/ManageModal.tsx` | Modified | Add `coach` to role selector |

---

## Build Order

1. **Storage bucket** — Create `rep-team-documents` bucket in Supabase Dashboard before any uploads.
2. **Migration 021** — Run in Supabase before any API or page testing.
3. **C2 role expansion** — `lib/types.ts` + `lib/roles.ts` + `ManageModal.tsx` (`coach` role).
4. **6B** — TypeScript types and DB helpers (prerequisite for all routes).
5. **6C** — Module shell: sidebar, hub tile, layout passthrough (validate shell before pages).
6. **6D** — Team + program year management (admin API + pages) — foundational entity management.
7. **6E** — Public tryout registration form + public API + confirmation emails.
8. **6F** — Tryout approval queue (admin) + offer/accept/decline email flows.
9. **6G** — Roster management (admin page + manual add).
10. **6H** — Player documents: upload API, signed URL API, template management, player detail page document section.
11. **6I** — Coaches portal foundation: layout + auth guard + dashboard + team overview.
12. **6J** — Coaches portal team calendar (admin calendar view can be built in parallel).
13. **6K** — Accounting: org cost allocation (admin UI + coaches allocation view).
14. **6L** — Accounting: coach-managed budget (dues, expenses, tournament payables).
15. **6M** — Accounting: automated payment reminder route + admin trigger button.
16. **6N** — Past program years (admin + coaches portal history pages).
17. **Module gating test** — Full five-layer verification + coach role scope test.

---

## Deferred Items

| Item | Deferred to |
|---|---|
| Multi-role architecture (a user holding two OrgRoles simultaneously) | Post-Phase 6 C2 follow-on decision |
| C3 — `module_communications` consolidation with coach/guardian audiences | Post-Phase 6 once both modules are shipped |
| AWS EventBridge Scheduler setup for automated dues reminders | Infrastructure deployment phase — route is implemented and ready |
| Coach-picks draft room variant for rep teams tryout placement | Post-Phase 6 enhancement |
| Parent/guardian portal (families log in to view player documents, dues, schedule) | Post-roadmap; requires a new authenticated role + route tree |
| Jersey number conflict detection (two players with same number) | Polish pass; `playerNumber` is a free text field today |
| Tryout waitlist (register for tryout when spots are full) | Not in scope for Phase 6; tryout queue is unbounded |
| Roster export to CSV | Post-Phase 6 polish |
| Supabase Storage RLS (additional bucket-level policy layer) | Hardening pass; API-level auth is the enforcement layer in Phase 6 |
| Public team schedule/standings page | After first live season of data exists |
| Integration with `module_public_site` (show team info on org public page) | Cross-module integration, post both Phase 3 and Phase 6 |
