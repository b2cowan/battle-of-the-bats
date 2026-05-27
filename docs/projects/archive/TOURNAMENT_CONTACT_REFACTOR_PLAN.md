# Tournament Contact Model Refactor — Implementation Plan

**Status:** COMPLETE — all phases shipped; migrations 088–090 applied to dev + prod  
**Branch:** dev  
**Related PM brief:** `docs/projects/active/TOURNAMENT_CONTACT_REFACTOR_PM_BRIEF.md`

---

## Background

The existing `contacts` table is a parallel identity system that duplicates work already done in Staff & Access. Contacts are arbitrary email addresses with no system access, yet the only meaningful things they do — receive registration notification emails, appear as a public contact on coach-facing emails — both implicitly require the recipient to have admin access. The table will be retired and replaced with direct references to `organization_members`.

This refactor also:
- Promotes Event Settings to a first-class sidebar nav item (removes it from the card hub)
- Collapses the standalone Contacts nav item
- Adds a notification routing mode to tournaments (owner sees all vs. delegates to division contacts)
- Adds a `title` field to `organization_members` as a foundation for per-context identity

The user has also approved pulling the future **Multi-Org User Home / Context Switcher** work into active scope. Codex will take on that body of work as a separate but related workstream because the contact refactor's per-membership identity model and the Coaches Portal unification both depend on users understanding which context they are entering after sign-in.

---

## Goals

1. Remove the `contacts` table and all references to it
2. Replace `age_groups.contact_id` (FK → contacts) with `age_groups.contact_member_id` (FK → organization_members)
3. Replace `tournaments.contact_email` (plain text) with `tournaments.default_contact_member_id` (FK → organization_members), deriving the email from the membership record
4. Add `tournaments.notify_mode` ('all' | 'assigned') to control whether owners/admins always receive registration notifications or only receive them when they are the assigned division contact
5. Add a `title` field to `organization_members` (scoped per org/tournament context)
6. Surface "Event Settings" as a direct sidebar link under Setup — removing the Settings card hub detour
7. Remove the standalone "Contacts" sidebar link and page
8. Add a staff member impact warning to the member removal confirmation modal

---

## Codex-Owned Workstream — Unified Sign-In Home / Context Switcher

### Scope

Codex will pull the roadmap item below into implementation planning and take on the sign-in/navigation body of work. The contact data migration remains its own workstream; this workstream focuses on the authenticated user experience once a person has signed in with one email address.

### Product Rules

1. A user signs in once using their email and password.
2. If the user has exactly one obvious destination, the app may continue to route them directly there.
3. If the user belongs to multiple areas, the app routes them to a clean platform-level home/context switcher.
4. Contexts are not just organizations. A user may have org owner/admin/staff access, tournament official access, Coaches Portal Basic tournament records, Coaches Portal Premium access, and rep-team coach assignments.
5. Coaches Portal links inside an organization dashboard are scoped to the current organization only.
6. If a user is an org admin in one org and a coach in another org, the Coaches Portal shortcut must not appear inside the first org unless they also have a coach assignment in that same org.
7. Tournament official access should be represented as a distinct context when it is scoped to tournament operations rather than broad org administration.
8. Per-context labels should use `organization_members.title` where available once the contact refactor adds it.

### Existing Surfaces To Reuse

This workstream should compose and refactor the surfaces already in place rather than building a duplicate dashboard.

- `/auth/select-org` already acts as the post-login workspace chooser for users with multiple org memberships and includes a global `Tournament Registrations` entry when the signed-in email matches coach registrations.
- `/{orgSlug}/admin/tournaments/dashboard` is the selected-tournament operating dashboard and should stay the primary tournament admin landing page.
- `/{orgSlug}/admin/org/tournaments` is the org-level tournament management/list surface and should remain the place to create, edit, archive, or select tournaments at the org level.
- `AdminSidebar` and `AdminBottomNav` already provide in-org tournament switching through the shared tournament context.
- Example: `owner@dev.local` has access to two tournaments today; after sign-in they should continue through the existing org/tournament admin flow and switch tournaments with the current controls, not through a new duplicate tournament dashboard.

### Planned Implementation

- [x] Refactor the existing `/auth/select-org` experience into a platform-level authenticated home, `/home`, for users with multiple contexts.
- [x] Add a context aggregation helper that resolves:
  - active `organization_members` rows and their destinations
  - scorekeeper/tournament official destinations
  - current-org rep-team coach assignments
  - Coaches Portal Basic access from tournament registration email matches
  - Coaches Portal Premium/team workspace access from existing entitlement and coach assignment data
- [x] Keep tournament selection inside the current org admin flow by linking context cards into the existing tournament dashboard/list and by reusing the existing tournament switchers.
- [x] Update `getAuthDestination()` so multi-context users land on `/home`, while single-context users can still be routed directly.
- [x] Rework `/auth/select-org` into a compatibility redirect or thin wrapper around the new home.
- [x] Update org admin navigation so the Coaches Portal shortcut only appears when the signed-in user has a coach assignment in the current org.
- [x] Ensure a coach/admin in different orgs sees those as separate context cards rather than a blended org sidebar.
- [ ] Add focused smoke coverage for:
  - one org only
  - multiple org memberships
  - org admin in one org plus coach in another org
  - tournament official context
  - Coaches Portal Basic only
  - Coaches Portal Basic plus org membership

### Out Of Scope For This Workstream

- Dropping the `contacts` table.
- Migrating `age_groups.contact_id` to `contact_member_id`.
- Changing role/capability semantics.
- Building notification preferences by context.
- Renaming internal database tables that still use historical Team workspace terminology.
- Rebuilding the tournament admin dashboard, org tournament list, or in-org tournament switcher.

---

## Data Model Changes

### `organization_members` — add `title`

```sql
ALTER TABLE organization_members
  ADD COLUMN title text,
  ADD CONSTRAINT org_members_title_length CHECK (char_length(title) <= 80);
```

> `display_name` already exists (max 60 chars). `title` is a separate field for role/position, e.g. "Tournament Director", "U13 Convenor". Both are nullable, org-scoped (same person can have different titles across orgs).

---

### `tournaments` — replace `contact_email` with `default_contact_member_id` + `notify_mode`

```sql
ALTER TABLE tournaments
  ADD COLUMN default_contact_member_id uuid REFERENCES organization_members(id) ON DELETE SET NULL,
  ADD COLUMN notify_mode text NOT NULL DEFAULT 'all',
  ADD CONSTRAINT tournaments_notify_mode_check CHECK (notify_mode IN ('all', 'assigned'));
```

`contact_email` is kept until migration is verified (drop in a follow-up migration after smoke testing). During the transition, the app derives `contact_email` from the referenced member at read time — the plain text column becomes a deprecated fallback only.

**Notification routing logic:**

| Division contact assigned | `notify_mode` | Who gets registration notification |
|---|---|---|
| No (defaults to owner) | either | Owner/admins |
| Yes (override member) | `all` | Override member + owner/admins |
| Yes (override member) | `assigned` | Override member only |
| Yes (override member) — but member removed | either | Falls back to owner |

---

### `age_groups` — replace `contact_id` with `contact_member_id`

```sql
ALTER TABLE age_groups
  ADD COLUMN contact_member_id uuid REFERENCES organization_members(id) ON DELETE SET NULL;
```

`contact_id` (FK → contacts) is dropped after data migration is verified.

**Effective contact resolution (app layer):**

```
age_groups.contact_member_id
  → if set: use that member's email + display_name
  → if null: use tournaments.default_contact_member_id
    → if null: use org owner's organization_members record
```

---

## Migration Plan

### Migration 088 — Additive schema changes

```sql
-- 1. Add title to organization_members
ALTER TABLE organization_members
  ADD COLUMN title text;
ALTER TABLE organization_members
  ADD CONSTRAINT org_members_title_length CHECK (char_length(title) <= 80);

-- 2. Add new tournament contact columns
ALTER TABLE tournaments
  ADD COLUMN default_contact_member_id uuid REFERENCES organization_members(id) ON DELETE SET NULL,
  ADD COLUMN notify_mode text NOT NULL DEFAULT 'all';
ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_notify_mode_check CHECK (notify_mode IN ('all', 'assigned'));

-- 3. Add new age_group contact column
ALTER TABLE age_groups
  ADD COLUMN contact_member_id uuid REFERENCES organization_members(id) ON DELETE SET NULL;
```

---

### Migration 089 — Data migration

```sql
-- Backfill default_contact_member_id from org owner for each tournament
UPDATE tournaments t
SET default_contact_member_id = om.id
FROM organization_members om
WHERE om.organization_id = t.org_id
  AND om.role = 'owner'
  AND t.default_contact_member_id IS NULL;

-- Migrate age_groups.contact_id → contact_member_id
-- Match the old contact's email to a user who is a member of the tournament's org
UPDATE age_groups ag
SET contact_member_id = om.id
FROM contacts c
JOIN tournaments tv ON tv.id = ag.tournament_id
JOIN organization_members om ON om.organization_id = tv.org_id
JOIN auth.users u ON u.id = om.user_id
WHERE ag.contact_id = c.id
  AND lower(u.email) = lower(c.email)
  AND ag.contact_member_id IS NULL;
-- Note: contacts with no matching org member are silently dropped (they had no system access
-- and therefore no functional value). The division will fall back to the org owner contact.
```

---

### Migration 090 — Drop old columns + contacts table

> Apply only after 088/089 are verified in dev, smoke-tested in prod, and all app references to `contacts` table and `contact_id` column are removed.

```sql
-- Remove old FK column from age_groups
ALTER TABLE age_groups DROP COLUMN contact_id;

-- Drop the contacts table
DROP TABLE contacts;

-- Optionally drop contact_email from tournaments once all read paths use member resolution
-- ALTER TABLE tournaments DROP COLUMN contact_email;
-- (defer this until email rendering is confirmed — keep as fallback initially)
```

---

## Phase Breakdown

### Phase 1 — DB: Migrations 088 + 089

- [x] Write and apply migration 088 (additive) to dev
- [x] Write and apply migration 089 (data backfill) to dev
- [x] Verify: every active tournament has `default_contact_member_id` set (4/4 tournaments backfilled)
- [x] Verify: notify_mode distribution — all 4 tournaments default to `'all'`
- [x] Verify: age groups with former contacts have `contact_member_id` set or correctly fall back
- [x] Apply both migrations to prod

---

### Phase 2 — Members: Add display_name + title fields to Staff & Access UI

**Files:** `app/[orgSlug]/admin/org/members/page.tsx`

- [x] Add inline edit for `display_name` and `title` on each member row (owner + admin only)
- [x] Show title as a secondary label on member rows (below role badge)
- [x] Update API route to accept `displayName` and `title` fields on member update
- [x] `GET /api/admin/members` — `title` added to select + response shape
- [x] `PATCH /api/admin/members/[id]` — `title` handled, sliced to 80 chars, null if empty
**Phase 2 COMPLETE**

**UX note:** Keep it inline — no separate modal for this. A pencil edit on the member row that opens a small inline form with display name + title is sufficient.

---

### Phase 3 — Event Settings: Add default contact picker + notify_mode toggle

**Files:** `app/[orgSlug]/admin/tournaments/settings/event/page.tsx`

**Phase 3 COMPLETE**

- [x] Add a new **"Public Contact"** card section to Event Settings page:
  - User picker dropdown: lists all `organization_members` where role IN ('owner', 'admin', 'staff'), ordered by role then display_name
  - Shows selected member's email address as read-only confirmation below the picker
  - Defaults to org owner if `default_contact_member_id` is null
  - Note: "This email appears in coach-facing emails and on the public registration page."

- [x] Add **"Registration Notifications"** card section:
  - Toggle: `notify_mode`
    - **"All registrations"** (default) — owner/admins are notified for all divisions; if a division has a contact override, they are notified too
    - **"Assigned only"** — only the division-assigned contact is notified; owner/admins are not notified for divisions they've delegated
  - Explainer: "Divisions without an assigned contact always notify tournament admins."

- [x] Update `handleSave` to PATCH `default_contact_member_id` and `notify_mode`
- [x] Update `useEffect` load to fetch the new fields

---

### Phase 4 — Divisions modal: Replace contact dropdown with member picker

**Files:** `app/[orgSlug]/admin/tournaments/age-groups/page.tsx`

**Phase 4 COMPLETE**

- [x] Replace the existing `contactId` select (sourced from `contacts`) with a `contactMemberId` select sourced from `organization_members` for the current org, filtered to role IN ('owner', 'admin', 'staff')
- [x] Show selected member's email as confirmation text below the picker (same as Phase 3)
- [x] Default option: "Default (tournament contact)" — null value, resolves to `default_contact_member_id` at runtime
- [x] Update `AgeGroupFormPayload` type: remove `contactId`, add `contactMemberId`
- [x] Update `loadAgeGroupState` to fetch org members instead of contacts
- [x] Update API save/update to write `contact_member_id` instead of `contact_id`
- [x] Remove the contacts API call from `loadAgeGroupState`

---

### Phase 5 — Registration notification routing: Update API + email send logic

**Files:** `app/api/admin/age-groups/route.ts` (or wherever registration notifications are sent), `lib/email.ts`

**Phase 5 COMPLETE**

- [x] Update the registration notification send logic to resolve the effective contact:
  1. Read `age_groups.contact_member_id` → join `organization_members` + `auth.users` to get email
  2. If null, read `tournaments.default_contact_member_id` → same join
  3. If null, fall back to org owner member
- [x] Apply `notify_mode`:
  - `'all'`: send to effective division contact AND all `organization_members` with role IN ('owner', 'admin')
  - `'assigned'`: send to effective division contact only (if none set, still sends to owner/admins as fallback)
- [x] Update `contactEmail` parameter passed to email templates to use resolved member email
- [x] Remove all remaining references to the `contacts` table in API routes

**Files to audit for `contacts` table references:**
- `app/api/admin/contacts/route.ts` — delete this route file entirely
- `app/[orgSlug]/admin/tournaments/contacts/page.tsx` — delete this page
- `lib/public-tournament-data.ts` — remove contacts fetch from `'register'` section (contacts no longer need to be fetched; use tournament's resolved contact email instead)
- `app/[orgSlug]/[tournamentSlug]/register/page.tsx` — update contact email resolution

---

### Phase 6 — Staff & Access: Member removal impact warning

**Files:** `app/[orgSlug]/admin/org/members/page.tsx`

**Phase 6 COMPLETE**

- [x] Before rendering the "Remove member" confirmation modal, query:
  - `tournaments WHERE default_contact_member_id = memberId` — list affected tournaments
  - `age_groups WHERE contact_member_id = memberId` — list affected divisions (join to get tournament name)
- [x] If any results, render an impact section in the modal (count-based ⚠ warning: "This member is the contact for N tournaments and M divisions. Those will reset to the tournament default on removal.")
- [x] The reversion happens automatically via `ON DELETE SET NULL` on the FK columns (no explicit update needed)

---

### Phase 7 — Navigation: Promote Event Settings, remove Contacts link

**Files:** `components/admin/AdminSidebar.tsx`, `app/[orgSlug]/admin/tournaments/settings/page.tsx`

**Phase 7 COMPLETE**

- [x] **Sidebar:** Add `{ key: 'settings/event', icon: Settings2, label: 'Event Settings' }` to the `setup` group in `TOUR_GROUPS`, positioned first
- [x] **Sidebar:** Remove `contacts` from the `setup` group items
- [x] **Settings card hub (`settings/page.tsx`):** No "Event settings" card present — already clean
- [x] **Dead page cleanup:** `app/[orgSlug]/admin/tournaments/contacts/page.tsx` — deleted

---

### Phase 8 — Migration 090: Drop old columns + contacts table

> Do after Phase 5–7 are deployed and verified in dev + prod.

**Phase 8 COMPLETE**

- [x] Confirm zero app references to `contacts` table or `age_groups.contact_id` (grepped clean)
- [x] Write migration 090 (`supabase/migrations/090_contact_model_cleanup.sql`)
- [x] App code cleanup: deleted `contacts` page + API route; removed all `contacts` table queries from `lib/db.ts`, communications routes, register page, public-tournament-data, seal-tournament, setup-tournament, clone route, wizard
- [x] Apply migration 090 to dev — verification script passed (all checks PASS)
- [x] Apply migration 090 to prod — verification script passed (all checks PASS)
- [ ] Optionally drop `tournaments.contact_email` in a future migration (090 left it as a soft fallback — deferred until email rendering fully confirmed)

---

## Build Order

```
Migration 088 (dev)
  → Phase 2 (member title UI)
  → Phase 3 (Event Settings contact + notify_mode)
  → Phase 4 (Divisions member picker)
Migration 089 (dev)
  → Phase 5 (notification routing logic)
  → Phase 6 (removal impact modal)
  → Phase 7 (sidebar nav changes)
Smoke test dev
Migration 088 + 089 (prod)
Deploy
Phase 8 (Migration 090) after verification window
```

---

## Types to Update

- `lib/types.ts` — `AgeGroup`: remove `contactId`, add `contactMemberId?: string`
- `lib/types.ts` — `Tournament`: add `defaultContactMemberId?: string`, `notifyMode?: 'all' | 'assigned'`
- `lib/types.ts` — `Member` (or wherever org member is typed): add `title?: string`
- Remove `Contact` type from `lib/types.ts` once all references are cleared

---

## Moved Into Active Scope: Multi-Org User Home / Context Switcher

This was originally captured as a future roadmap item. It is now an active Codex-owned workstream in this plan; see **Codex-Owned Workstream — Unified Sign-In Home / Context Switcher** above for the implementation checklist.

### Problem

A user who is president of one org, admin at a tournament org, and official at a second tournament currently has no platform-level home. They land somewhere after login and must manually switch orgs. There is no single view that says "here are all the orgs and tournaments you belong to and your role in each."

### Proposed solution

A **cross-org identity home** — a lightweight authenticated page (e.g. `/home` or `/dashboard`) that:

- Lists every `organization_members` record for the logged-in user, grouped by org
- Shows role + title per membership
- Provides a direct "Go to [Org Name] admin" link for each
- Handles the common case of a single org transparently (auto-redirects to that org's admin)
- Handles multi-org users with a proper chooser, not a forced pick

### Why `title` on `organization_members` is the right foundation

The same user is "Tournament Director" in one context and "President" in another. The per-membership `title` field (added in this refactor) is the data model this feature needs. Building the context switcher later becomes a UI problem, not a schema problem.

### Related considerations

- **Mobile:** the switcher should be reachable from mobile-first, since day-of volunteers (officials) often only use the platform on a phone at the field
- **Notification routing:** a user's notification preferences may eventually differ by membership (e.g. "only notify me for the Milton Bats tournaments, not the Spring league")
- **Coach portal:** coaches already have a cross-tournament view at `/coaches/tournaments` — this roadmap item is the admin-side equivalent

No separate `MULTI_ORG_USER_HOME_PLAN.md` is needed unless the work expands beyond the scope above.
