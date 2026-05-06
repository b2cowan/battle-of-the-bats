# User Role Architecture — Audit & Plan

**Status:** Phase 2 complete — Phase 3 (capability overrides UI) pending  
**Branch:** dev  
**Date:** 2026-05-06

---

## 1. Current State Audit

### 1.1 Schema: `organization_members`

```sql
CREATE TABLE organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'admin',  -- 'owner' | 'admin' | 'staff' | 'official'
  invited_at       timestamptz NOT NULL DEFAULT now(),
  accepted_at      timestamptz,                    -- null = pending; set on first login
  UNIQUE (organization_id, user_id)
);
```

**No tournament-scoped columns exist.** Membership is org-level only.

TypeScript type in `lib/types.ts`:
```typescript
export type OrgRole = 'owner' | 'admin' | 'staff' | 'official';
```

---

### 1.2 Role Check Inventory

#### Middleware (`middleware.ts`)
| Route pattern | Check | Roles allowed | Behavior on fail |
|---|---|---|---|
| `/[orgSlug]/admin/*` | `user` present | Any authenticated user | Redirect → `/auth/login` |
| `/platform-admin/*` | `user.email` in env allowlist | Platform operator only | 403 Forbidden |

**No role check in middleware at all.** Any authenticated org member reaches every admin page.

#### `lib/api-auth.ts`
| Function | Returns | Used by |
|---|---|---|
| `getAuthContext()` | `{ user, org }` | All API routes (auth check only) |
| `getAuthContextWithRole()` | `{ user, org, role }` | Official scorekeeper layout only |

Role fetch is done inline in each API route that needs it rather than centrally.

#### API Route Role Matrix (current state)

| Endpoint | Method | Role check | Roles allowed |
|---|---|---|---|
| `/api/admin/members` | GET | None | All |
| `/api/admin/members/invite` | POST | `role !== 'owner'` | owner |
| `/api/admin/members/[memberId]` | DELETE | `role !== 'owner'` | owner |
| `/api/admin/members/[memberId]` | PATCH | `role !== 'owner'` | owner |
| `/api/admin/org-settings` | GET | None | All |
| `/api/admin/org-settings` | PATCH | `role !== 'owner'` | owner |
| `/api/admin/org-logo` | POST/DELETE | `role !== 'owner'` | owner |
| `/api/admin/org-hero-banner` | POST/DELETE | `role !== 'owner'` | owner |
| `/api/admin/org-logo-stock` | POST | `role !== 'owner'` | owner |
| `/api/admin/seal-tournament` | POST | `!['admin','owner'].includes(role)` | owner, admin |
| `/api/admin/setup-tournament` | POST | **None** | All — **SECURITY GAP** |
| `/api/admin/tournaments` | GET/PATCH/DELETE | None | All |
| `/api/admin/age-groups` | * | None | All |
| `/api/admin/games` | * | None | All |
| `/api/admin/teams` | * | None | All |

`/api/admin/seal-tournament` is the only route that meaningfully distinguishes admin from staff. Every tournament CRUD endpoint has no role check at all.

#### Admin Page Role Matrix (current state, UI-level)

| Page | Role check | Roles allowed |
|---|---|---|
| `admin/layout.tsx` | Auth only | All authenticated org members |
| `admin/members/page.tsx` | `userRole !== 'owner'` | owner (soft gate, no redirect) |
| `admin/settings/page.tsx` | `userRole !== 'owner'` | owner (soft gate, no redirect) |
| All other admin pages | **None** | All roles |
| `official/layout.tsx` | Role-based routing | official only |

#### Supabase RLS Status

All RLS policies in `supabase/migrations/001_multi_tenant.sql` are **commented out**. The system relies entirely on application-level checks. The only isolation in place is the `organization_id` filter in every application query. TODO.md says RLS is complete — this is outdated; the policies do not exist.

---

### 1.3 `lib/tournament-context.tsx`

- Fetches **all tournaments for the org** with no role or assignment filter.
- Stores selected tournament in localStorage.
- Carries no role information.
- Any authenticated org member sees all tournaments.

---

## 2. Question 1 — Admin vs Staff: Architect vs Operator

### Conceptual model

The clearest real-world distinction maps to **when** each role is active:

**Admin = tournament architect** — does the structural work in the weeks before an event: creates tournaments, defines age groups, sets up bracket structures, accepts/rejects/waitlists registrations, manages the contacts/diamonds database, writes rules documents, sends email communications to registrants. These are things you do once and they define the shape of the tournament.

**Staff = tournament operator** — works within that structure during the event: updates game times and diamond assignments as the day progresses, submits scores, posts public-facing announcements. Cannot create or delete structural items; can only move the pieces that already exist.

This maps cleanly to how orgs actually staff events: admins are co-organizers (weeks of work); staff are day-of helpers (scorekeeper, scheduler on duty).

### Updated capability matrix

| Capability | Owner | Admin | Staff | Official |
|---|---|---|---|---|
| Create / delete tournaments | ✓ | ✓ | ✗ | ✗ |
| Define / edit age groups | ✓ | ✓ | ✗ | ✗ |
| Manage registrations (accept / reject / waitlist) | ✓ | ✓ | ✗ | ✗ |
| Build initial schedule & brackets | ✓ | ✓ | ✗ | ✗ |
| Update game times & diamond assignments | ✓ | ✓ | ✓ | ✗ |
| Submit & finalize scores | ✓ | ✓ | ✓ | ✓ |
| Manage contacts & diamonds | ✓ | ✓ | ✗ | ✗ |
| Post announcements | ✓ | ✓ | ✓ | ✗ |
| Post / edit rules documents | ✓ | ✓ | ✗ | ✗ |
| Send email communications | ✓ | ✓ | ✗ | ✗ |
| Seal tournament (archive) | ✓ | ✓ | ✗ | ✗ |
| Manage members (invite / promote / remove) | ✓ | ✓ | ✗ | ✗ |
| Org settings & branding | ✓ | ✗ | ✗ | ✗ |
| Billing & subscription | ✓ | ✗ | ✗ | ✗ |

**Admin now has manage_members** — see Q2 answer below.

### The "schedule update" split

The key nuance is that `games` and `schedule` endpoints are currently write-all. Under this model they need to be split by operation type:
- **Creating or deleting bracket/schedule structure** → admin only
- **Patching game fields** (diamond, start_time, status) → admin + staff

This may require separate endpoints or a field-level permission check on PATCH. The simplest implementation: PATCH allows `['owner', 'admin', 'staff']`; POST and DELETE require `['owner', 'admin']`.

---

## 3. Question 2 — Granular Permissions: Hybrid Approach

### Recommendation: Roles + optional capability overrides

Keep `role` as the primary axis (Owner / Admin / Staff / Official). Add a nullable `capabilities` JSONB column to `organization_members` that can override role defaults per user.

**Schema addition:**
```sql
ALTER TABLE organization_members
  ADD COLUMN capabilities jsonb;
```

**`lib/roles.ts` (new file):**
```typescript
export type Capability =
  | 'create_tournaments'
  | 'manage_registrations'
  | 'manage_schedule_structure'   // create/delete bracket/schedule
  | 'update_schedule'             // patch game times/diamonds
  | 'submit_scores'
  | 'manage_contacts'
  | 'post_announcements'
  | 'post_rules'
  | 'send_communications'
  | 'seal_tournaments'
  | 'manage_members'
  | 'org_settings'
  | 'billing';

export const ROLE_DEFAULTS: Record<OrgRole, Set<Capability>> = {
  owner:    new Set(['all']),   // bypass; checked separately
  admin:    new Set([
    'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
    'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
    'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
  ]),
  staff:    new Set([
    'update_schedule', 'submit_scores', 'post_announcements',
  ]),
  official: new Set(['submit_scores']),
};

export function hasCapability(
  role: OrgRole,
  capabilities: Record<string, boolean> | null,
  cap: Capability
): boolean {
  if (role === 'owner') return true;
  const override = capabilities?.[cap];
  if (override !== undefined) return override;
  return ROLE_DEFAULTS[role].has(cap);
}
```

A user's effective capabilities = role defaults merged with any explicit overrides stored in the `capabilities` column. This means an owner can grant a specific staff member `send_communications` without changing their role.

### Member promotion (Q2 answer)

Admin role now includes `manage_members`. The member management UI and API routes should allow any user with `manage_members` capability to:
- Invite new members (admin, staff, official roles only — never owner)
- Promote/demote between admin, staff, official
- Remove members (but not other owners)

Owner remains the only role that can: modify org settings, manage billing, or promote to/from owner.

**API change required:**  
`/api/admin/members/invite` and `/api/admin/members/[memberId]` PATCH/DELETE — change `role !== 'owner'` check to `!hasCapability(role, capabilities, 'manage_members')`.

The official promotion restriction (`official` cannot be promoted inline) should be **removed** — it was an artifact of the old owner-only gate. Any user with `manage_members` should be able to change an official's role.

---

## 4. Question 3 — Tournament-Scoped Assignment

### Design

New junction table with **absence-means-unrestricted** semantics: if a user has no rows, they see all tournaments. Owners always bypass the table.

```sql
CREATE TABLE org_member_tournament_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id   uuid NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  tournament_id   uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_member_id, tournament_id)
);
```

### Visibility rule (Q3 answer)

Users with assignments **only see their assigned tournaments** — no read-only access to others. The tournament list, context, and all API responses are filtered to the assigned set. This means staff assigned to U11 and U13 cannot see the U8 bracket at all.

### Auth changes needed

**`lib/api-auth.ts`** — new function:
```typescript
export async function getAuthContextWithScope(): Promise<AuthContextWithScope | null> {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return null;
  if (ctx.role === 'owner') return { ...ctx, assignedTournamentIds: null }; // null = unrestricted

  // Fetch capabilities alongside assignment check
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, capabilities')
    .eq('organization_id', ctx.org.id)
    .eq('user_id', ctx.user.id)
    .single();

  const { data: assignments } = await supabaseAdmin
    .from('org_member_tournament_assignments')
    .select('tournament_id')
    .eq('org_member_id', member.id);

  return {
    ...ctx,
    capabilities: member.capabilities ?? null,
    assignedTournamentIds: assignments?.length ? assignments.map(a => a.tournament_id) : null,
  };
}
```

### Files that need updating

**Migrations:**
- New file: `supabase/migrations/00X_tournament_assignments.sql`

**Auth layer:**
- `lib/api-auth.ts` — add `getAuthContextWithScope()`

**API routes:**
- `app/api/admin/tournaments/route.ts` — filter GET by `assignedTournamentIds`; scope PATCH/DELETE
- `app/api/admin/age-groups/route.ts` — scope by tournament
- `app/api/admin/games/route.ts` — scope by tournament
- `app/api/admin/teams/route.ts` — scope by tournament
- `app/api/admin/seal-tournament/route.ts`
- `app/api/admin/setup-tournament/route.ts` — scoped users cannot create tournaments

**Tournament context:**
- `lib/tournament-context.tsx` — fetch only assigned tournaments when `assignedTournamentIds` is non-null

**Admin UI:**
- `app/[orgSlug]/admin/members/page.tsx` — add "Assigned Tournaments" multi-select per member
- New API: `app/api/admin/members/[memberId]/assignments/route.ts` (GET, PUT)

**Middleware:**
- No changes needed — enforcement belongs at the API/data layer.

---

## 5. Question 4 — RLS Re-activation

The commented-out policies in `supabase/migrations/001_multi_tenant.sql` need to be reactivated in a new migration, expanded to cover the tournament-assignment model, and hardened. The application-level checks remain in place; RLS is a second defense layer.

### RLS policy design

```sql
-- Enable RLS on all relevant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_member_tournament_assignments ENABLE ROW LEVEL SECURITY;
-- (also: age_groups, games, teams, registrations, etc.)

-- Helper: is the calling user a member of this org?
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$;

-- Helper: is the calling user assigned to this tournament (or unrestricted)?
CREATE OR REPLACE FUNCTION can_access_tournament(t_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN tournaments t ON t.organization_id = om.organization_id
    WHERE om.user_id = auth.uid() AND t.id = t_id
    AND (
      -- No assignments = unrestricted
      NOT EXISTS (
        SELECT 1 FROM org_member_tournament_assignments
        WHERE org_member_id = om.id
      )
      OR
      -- Has assignment for this specific tournament
      EXISTS (
        SELECT 1 FROM org_member_tournament_assignments
        WHERE org_member_id = om.id AND tournament_id = t_id
      )
    )
  );
$$;

-- organizations: members read their own org; public read for is_public orgs
CREATE POLICY "org_members_read_own" ON organizations FOR SELECT
  USING (is_org_member(id) OR is_public = true);

-- organization_members: members see their own org's member list
CREATE POLICY "org_members_read_peers" ON organization_members FOR SELECT
  USING (is_org_member(organization_id));

-- tournaments: org members with access to the tournament can read/write
CREATE POLICY "tournaments_org_member_read" ON tournaments FOR SELECT
  USING (can_access_tournament(id) OR (
    SELECT is_public FROM organizations WHERE id = organization_id
  ));

CREATE POLICY "tournaments_org_member_write" ON tournaments FOR ALL
  USING (can_access_tournament(id));

-- Public read of active tournaments (for public org pages)
CREATE POLICY "tournaments_public_active" ON tournaments FOR SELECT
  USING (
    status = 'active'
    AND (SELECT is_public FROM organizations WHERE id = organization_id)
  );
```

The admin Supabase client (service role key) bypasses RLS. These policies apply to the **browser Supabase client** only — which is used by `OrgProvider`/`useOrg()` and any direct client-side queries. API routes using `supabaseAdmin` are unaffected.

**Important:** Before activating RLS, audit every client-side query that uses the browser Supabase client to confirm it passes the correct `auth.uid()` context. A misconfigured policy will surface as empty results, not 403 errors.

---

## 6. Question 5 — Score Finalization Enforcement

`organizations.require_score_finalization` is stored but not enforced anywhere in the API. When this flag is `true`, official score submissions should transition the game to `'submitted'` (not `'completed'`), and a separate admin action should be required to move it to `'completed'`.

### What needs to change

**Find the score submission endpoint** (likely `app/api/admin/games/route.ts` or `app/api/official/score/route.ts`) and add:

```typescript
const finalStatus = org.require_score_finalization
  && (ctx.role === 'official' || ctx.role === 'staff')
    ? 'submitted'
    : 'completed';
```

**Add a finalization action** — a PATCH endpoint (or extend the existing games PATCH) that allows `owner | admin` to move a game from `'submitted'` to `'completed'`.

**Results page** (`app/[orgSlug]/admin/results/page.tsx`) — add a "Pending Review" filter/indicator when `require_score_finalization` is enabled for the org, surfacing games in `'submitted'` state for admin review.

This is already partially scaffolded in the UI (per the TODO.md completed items note about "Pending Review / Completed legend when finalization is enabled") — only the API enforcement is missing.

---

## 7. Implementation Order

### ✅ Phase 0 — Security hardening + finalization (no schema change) — COMPLETE

**A. Add role enforcement helper** ✅
- Created `lib/roles.ts` with `ROLE_DEFAULTS`, `Capability` type, `hasCapability()`.
- Added `forbidden()` and `requireCapability(ctx, cap)` helpers to `lib/api-auth.ts`.

**B. Fix unprotected API routes** ✅
| Endpoint | Method | Required capability |
|---|---|---|
| `/api/admin/setup-tournament` | POST | `create_tournaments` |
| `/api/admin/tournaments` | PATCH, DELETE | `create_tournaments` |
| `/api/admin/age-groups` | POST, PATCH, DELETE | `create_tournaments` |
| `/api/admin/games` | POST, DELETE | `manage_schedule_structure` |
| `/api/admin/games` | PATCH (time/diamond) | `update_schedule` |
| `/api/admin/teams` | POST, PATCH, DELETE | `create_tournaments` |
| `/api/admin/members/invite` | POST | `manage_members` |
| `/api/admin/members/[memberId]` | PATCH, DELETE | `manage_members` |

**C. Remove official promotion restriction** ✅
Removed from `app/api/admin/members/[memberId]/route.ts`. Any user with `manage_members` can now change any non-owner role including official.

**D. Score finalization enforcement** ✅
Official score page now routes through `PATCH /api/admin/games` with `action: 'submit-score'`. Server reads `org.require_score_finalization` and sets status to `'submitted'` (official/staff) or `'completed'` (owner/admin). Admin finalization PATCH action (`action: 'finalize'`) added, requires `seal_tournaments` capability.

> **Note:** `requireCapability` currently selects only `role` (not `capabilities`) because the capabilities column does not exist until Phase 1. Both query sites are marked with a comment for the Phase 1 update.

---

### ✅ Phase 1 — Schema: capabilities column + tournament assignments — COMPLETE

**A. Migration** ✅
- `supabase/migrations/008_role_capabilities_and_tournament_assignments.sql`
- `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS capabilities jsonb`
- Created `org_member_tournament_assignments` junction table with indexes

**B. Auth layer** ✅
- `lib/api-auth.ts` — `requireCapability` now reads `capabilities` column (was `null` placeholder)
- Added `AuthContextWithScope` interface with `{ role, capabilities, assignedTournamentIds }`
- Added `getAuthContextWithScope()` — 3 DB queries; owners short-circuit before assignments query
- Added `scopeGuard(ctx, tournamentId)` — returns 403 if `tournamentId` not in `assignedTournamentIds`
- Updated `getAuthContextWithRole` to also return `capabilities`

**C. Tournament context scoping** ✅
- `lib/tournament-context.tsx` — replaced `getTournaments()` (db.ts, unscoped) with `fetch('/api/admin/tournaments')` (server-filtered by org + assignments); maps rows inline

**D. API route scope enforcement** ✅
- `app/api/admin/tournaments/route.ts` — added GET with org+scope filter; POST now uses `getAuthContextWithScope` once for all actions
- `app/api/admin/age-groups/route.ts` — switched to `supabaseAdmin`; scope-guards all mutations
- `app/api/admin/games/route.ts` — capabilities column read; scope-guards POST (per-game tournament check) and PATCH (game tournament lookup)
- `app/api/admin/teams/route.ts` — switched to `supabaseAdmin`; scope-guards POST and DELETE
- `app/api/admin/seal-tournament/route.ts` — replaced inline role string check with `hasCapability`; added `scopeGuard`

**E. Members API and UI** ✅
- `app/api/admin/members/route.ts` — GET now includes `capabilities` and `assignedTournamentIds` per member
- New: `app/api/admin/members/[memberId]/assignments/route.ts` — GET returns assignment list; PUT replaces full set with org-validation
- `app/[orgSlug]/admin/members/page.tsx` — gate changed to `owner || admin`; role matrix and descriptions updated to reflect actual capability split; added Tournaments column with tag badges and Tag-button assignment modal; officials now show in same table with role-change select (admin/staff/official)

---

### ✅ Phase 2 — RLS activation — COMPLETE

**A. Migration** ✅
- `supabase/migrations/009_rls_policies.sql`
- Helper functions: `get_my_org_ids()`, `is_org_member()`, `is_org_owner()`, `can_access_tournament()` (absence-means-unrestricted), `can_access_tournament_for_pool()`, `can_access_tournament_for_rule_item()`
- Legacy helpers (`is_org_member_for_tournament`, `is_org_member_for_age_group`) repointed to `can_access_tournament` for backwards compatibility
- RLS enabled on all 15 tables (idempotent; safe if 002/003 were previously applied)
- Existing policies from migrations 002/003 dropped via `DROP POLICY IF EXISTS`
- Policy design: anon SELECT (true) on all tournament-data tables for public pages; org-member writes gated on `can_access_tournament()`; teams INSERT open (true) for public registration

**B. Client-side query audit** ✅
- `lib/db.ts` — all ~35 mutation functions switched from `supabase` (anon, no JWT) to `authClient()` (sends session cookie → enables `auth.uid()` in RLS policies when logged in)
- `authClient()` on server falls back to anon client — safe because all server writes go through `supabaseAdmin` which bypasses RLS
- `lib/org-context.tsx` — uses `createBrowserClient` (JWT cookie) → passes `org_members_read_peers` + `org_read` policies ✓
- `lib/tournament-context.tsx` — uses `fetch('/api/admin/tournaments')` (supabaseAdmin) → bypasses RLS ✓
- All `/api/admin/*` routes — use `supabaseAdmin` → bypass RLS ✓
- `setup-tournament/route.ts` — creates inline service-role client → bypasses RLS ✓
- Public registration (`saveTeam` anon) — covered by `teams_anon_insert WITH CHECK (true)` ✓
- Public page reads (db.ts anon client) — covered by `*_anon_read USING (true)` ✓

**C. Migration applied** ✅
`009_rls_policies.sql` executed in Supabase SQL Editor — RLS and all policies are live.

**D. Testing** ✅
Verified complete — RLS policies confirmed live, browser testing signed off.

---

### Phase 3 — Capability overrides UI

Once Phases 0–2 are stable, expose a per-user capability editor in the members page for owner-level users. This is additive — the `capabilities` column exists from Phase 1; only the UI needs building.

---

## 8. Open Decisions (resolved)

| # | Question | Decision |
|---|---|---|
| 1 | Staff role semantics | Staff = operator (update schedule, submit scores, post announcements). Admin = architect (create/delete structure, manage registrations, communications, contacts). |
| 2 | Official promotion | Any user with `manage_members` capability (owner or admin) can promote/demote any non-owner role including official. |
| 3 | Scoped user visibility | Scoped users see only assigned tournaments — no read-only access to others. |
| 4 | RLS | Reactivate with tournament-assignment-aware policies in a new migration. Browser client gets RLS; API routes using service role key are unaffected. |
| 5 | Score finalization | Enforce `require_score_finalization` flag in score submission endpoint. Official/staff submissions → `'submitted'` when flag is on; admin finalization PATCH moves to `'completed'`. |
