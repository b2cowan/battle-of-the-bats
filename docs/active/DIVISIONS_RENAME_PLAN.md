# Divisions Rename — Implementation Plan

> **Status:** Complete
> **Created:** 2026-05-25
> **Completed:** 2026-05-25
> **Branch:** dev
> **Migration:** 093

## Goal

Rename every reference to "age group / age groups" across the full stack — database, TypeScript, API routes, file names, and UI copy — to "division / divisions". This is a terminology correction: divisions in FieldLogicHQ tournaments are not strictly age-based, and "division" is the standard term used across Canadian softball, hockey, and soccer tournament management.

---

## PM Brief

**What it does:** Renames every reference to "Age Group / Age Groups" across the platform to "Division / Divisions" — database table, column names, API routes, file names, TypeScript types, and all UI labels.

**Why it matters:** "Age Group" implies groupings are age-based, but tournament organizers already use divisions for gender, skill level, and format categories — not just age. The current label confuses organizers and coaches and doesn't match how the sports community talks about their events.

**Who benefits:** All roles — tournament organizers (admin), registering coaches (coaches portal), and public visitors. No plan-tier restrictions.

**Expected impact:** Every screen uses "Division" consistently. No functional behaviour changes.

**Priority:** Medium — important for product polish; recommended before any external marketing push.

**Success criteria:** Zero instances of "Age Group" visible in any live UI; all identifiers use `division`; DB table is `divisions` with `division_id` FKs; historical migration SQL files annotated only, not modified.

---

## Architectural Decisions

- **Decision:** Keep the browser cookie key `fl_agpref_${orgSlug}` unchanged. **Rationale:** Changing the cookie name would silently reset every existing user's division-filter preference. The key is an internal implementation detail — only renamed the file (`division-cookie.ts`) and function names (`getDivisionPref`, `setDivisionPref`).
- **Decision:** Used Postgres `RENAME` statements (not add/copy/drop). **Rationale:** Column/table renames are atomic DDL in Postgres. No data moved, no downtime, no backfill needed.
- **Decision:** Did NOT modify historical migration SQL files. **Rationale:** Migrations are an append-only audit trail. Migration 093 explains the rename with a header comment.
- **Decision:** `registrations.age_group` text column renamed to `registrations.division`. **Rationale:** Free-text label copied from the selected `divisions.name` at registration time. Renamed for consistency.
- **Decision:** `rep_teams.age_group` and `league_seasons.age_group` text columns also renamed to `division`. **Rationale:** Same terminology cleanup; done in a single migration to avoid a second pass.
- **Decision:** The API path `/api/admin/age-groups` became `/api/admin/divisions`. No redirect/alias needed. **Rationale:** Internal admin API consumed only by the app — no external clients.
- **Decision:** Duplicate FK constraints on `games.age_group_id` (both `games_age_group_id_fkey` and `fk_games_age_group` existed). **Rationale:** Dropped the duplicate in migration 093 when renaming the column.
- **Decision:** `feeScheduleMode: 'age_group'` value persisted in `tournaments.fee_schedule_mode` column. **Rationale:** Added `UPDATE tournaments SET fee_schedule_mode = 'division' WHERE fee_schedule_mode = 'age_group'` to migration 093.
- **Decision:** Supabase join hint `age_groups!teams_division_id_fkey` simplified to `divisions` (no hint). **Rationale:** Only one FK from teams to divisions — no disambiguation needed.
- **Decision:** Function bodies for `is_org_member_for_age_group`, `can_access_tournament_for_pool`, and `claim_next_slot` recreated with updated table/column references. **Rationale:** SQL/PL/pgSQL function bodies are stored as text and do not auto-update on table/column rename.

---

## Work Completed

### Phase 0 — DB Migration (migration 093)
- [x] `supabase/migrations/093_divisions_rename.sql` created
- [x] Drop duplicate FK constraint `fk_games_age_group` on games
- [x] Rename table: `age_groups` → `divisions`
- [x] Rename FK columns: `age_group_id` → `division_id` on `pools`, `teams`, `pool_slots`, `games`
- [x] Rename array columns: `age_group_ids` → `division_ids` on `announcements`, `rules`
- [x] Rename text columns: `age_group` → `division` on `league_seasons`, `rep_teams`
- [x] Recreate `is_org_member_for_age_group` function body (references `divisions` table)
- [x] Recreate `can_access_tournament_for_pool` function body (references `divisions` table)
- [x] Recreate `claim_next_slot` function body (references `division_id` column)
- [x] `UPDATE tournaments SET fee_schedule_mode = 'division' WHERE fee_schedule_mode = 'age_group'`
- [ ] **Apply migration to dev DB** ← next step for user
- [ ] **Apply migration to prod DB** ← after dev verified

### Phase 1 — TypeScript Types + DB Helpers
- [x] `lib/types.ts` — `AgeGroup` → `Division`; all `ageGroupId` → `divisionId`, `ageGroupIds` → `divisionIds`, `ageGroups` → `divisions`; `feeScheduleMode 'age_group'` → `'division'`; `LeagueSeason.ageGroup` → `division`; `RepTeam.ageGroup` → `division`; `RepPastProgramYear.teamAgeGroup` → `teamDivision`
- [x] `lib/db.ts` — all `.from('age_groups')` → `.from('divisions')`, all column references updated
- [x] `lib/public-tournament-data.ts` — updated
- [x] `lib/team-workspace-provisioning.ts`, `lib/team-workspace-claims.ts`, `lib/team-registration-duplicates.ts`, `lib/team-org-links.ts`, `lib/team-checkout.ts`, `lib/email.ts`, `lib/basic-coach-teams.ts` — all updated
- [x] `lib/division-cookie.ts` — renamed from `age-group-cookie.ts`; functions renamed to `getDivisionPref`/`setDivisionPref`; cookie key preserved as `fl_agpref_*`

### Phase 2 — API Routes
- [x] `app/api/admin/age-groups/route.ts` → `app/api/admin/divisions/route.ts` (directory renamed)
- [x] All callers updated to `/api/admin/divisions`
- [x] All other API routes updated: `age_group_id` → `division_id` in queries, `age_groups` table refs → `divisions`, Supabase join hints corrected
- [x] `tournament-activity/route.ts` — `age_groups(name)` join → `divisions(name)`; variable refs updated

### Phase 3 — File and Folder Renames
- [x] `app/[orgSlug]/admin/tournaments/age-groups/` → `divisions/`
- [x] `lib/age-group-cookie.ts` → `lib/division-cookie.ts`
- [x] All cookie file imports updated in `DivisionFilterBar.tsx`, schedule/standings/teams pages

### Phase 4 — UI Copy and CSS
- [x] Admin sidebar nav key: `age-groups` → `divisions`
- [x] Admin bottom nav key: `tournaments/age-groups` → `tournaments/divisions`
- [x] `AdminTitleManager.tsx` route regex updated
- [x] `divisions/page.tsx` — HTML IDs updated: `age-group-add-btn` → `division-add-btn`, etc.
- [x] Dashboard hrefs: `../age-groups` → `../divisions`
- [x] All UI labels across 100+ files updated from "Age Group(s)" to "Division(s)"
- [x] `age_group_name` aliased fields renamed to `division_name` in registrations and teams pages

### Phase 5 — Docs, Memory, and Tests
- [x] `docs/active/*.md` — inline updates
- [x] `AGENT_PLAYBOOK.md` — updated
- [x] `lib/help-content/tournaments.tsx` — hrefs updated
- [x] UAT test files — selectors and labels updated
- [ ] `memory/reference_db_schema.md` — update column/table names after migration confirmed
- [ ] Archive docs — add terminology annotation block

---

## Rollback SQL (if needed before app code deployed)

```sql
ALTER TABLE divisions RENAME TO age_groups;
ALTER TABLE games RENAME COLUMN division_id TO age_group_id;
ALTER TABLE pool_slots RENAME COLUMN division_id TO age_group_id;
ALTER TABLE pools RENAME COLUMN division_id TO age_group_id;
ALTER TABLE teams RENAME COLUMN division_id TO age_group_id;
ALTER TABLE announcements RENAME COLUMN division_ids TO age_group_ids;
ALTER TABLE rules RENAME COLUMN division_ids TO age_group_ids;
ALTER TABLE league_seasons RENAME COLUMN division TO age_group;
ALTER TABLE rep_teams RENAME COLUMN division TO age_group;
UPDATE tournaments SET fee_schedule_mode = 'age_group' WHERE fee_schedule_mode = 'division';
```
