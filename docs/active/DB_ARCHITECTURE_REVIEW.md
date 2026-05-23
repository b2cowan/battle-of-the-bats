# FieldLogicHQ — Database Architecture Review

> **Maintained by:** `/dba` agent  
> **Last reviewed:** 2026-05-23 (standalone team workspace module + dev/prod divergence audit)  
> **Schema source:** `memory/reference_db_schema.md` (captured 2026-05-23 from dev + prod)  
> **Tables reviewed:** ~82 across 9 modules (tournament, league, rep teams, standalone team workspace, accounting, stripe, org/platform core, platform admin, CRM)

---

## Review Summary

| Severity | Open | Addressed | Accepted Risk |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 3 | 3 | 1 |
| Medium | 3 | 3 | 1 |
| Low | 2 | 0 | 3 |
| Advisory | 5 | 1 | 0 |

---

## Open Findings

---

### [2026-05-23] — Finding #10: `league_practices` exists in prod but not dev

**Severity:** High  
**Finding:** The `league_practices` table (`id`, `season_id`, `division_id`, `team_id`, `scheduled_at`, `ends_at`, `location`, `notes`, `status`, `recurrence_group_id`, `created_at`, `updated_at`) exists in production but does not exist in the dev database. A migration was applied to prod but skipped dev. This means dev is behind, any code referencing `league_practices` will fail on dev, and any future dev migration that touches league tables must account for the missing table to avoid conflicts.  
**Tables affected:** `league_practices`  
**Recommendation:** Write and apply a corrective migration to dev that creates `league_practices` matching the prod definition. Verify column types, nullability, and any indexes or RLS policies are in sync. Once applied, add to migration numbering sequence so it doesn't conflict. If `league_practices` is intentionally a prod-only experiment (not yet built in the UI), document why and suppress dev drift warnings.  
**Status:** Open

---

### [2026-05-23] — Finding #11: Duplicate FK constraints on tournament tables in prod

**Severity:** Medium  
**Finding:** The prod database has duplicate FK constraints on several tournament sub-tables: e.g. `games` has both `fk_games_tournament` AND `games_tournament_id_fkey` pointing to the same column. Similar duplicates exist on `age_groups`, `contacts`, `diamonds`, `announcements`, and `teams`. Duplicate constraints mean Postgres enforces the same referential integrity check twice on every INSERT/UPDATE, adds overhead to `pg_constraint` lookups, and creates confusion in schema introspection tools.  
**Tables affected:** `games`, `age_groups`, `contacts`, `diamonds`, `announcements`, `teams` (prod only)  
**Recommendation:** In a cleanup migration, `ALTER TABLE … DROP CONSTRAINT` the auto-named `*_fkey` duplicates, keeping only the explicitly-named `fk_*` constraints. Run against prod only (dev doesn't have the duplicates). Wrap in a transaction. Test that the surviving named constraints still block orphan inserts before merging.  
**Status:** Open

---

### [2026-05-23] — Finding #15: `team_entitlements` — dual nullable owner FKs with no NOT NULL guard

**Severity:** Medium  
**Finding:** `team_entitlements` has `org_id` (FK → organizations.id, nullable) and `rep_team_id` (FK → rep_teams.id, nullable). Both are nullable. A row with both NULL is a dangling entitlement — no org owns it, no team owns it — and the RLS system cannot scope it to any tenant. There is no visible CHECK constraint requiring at least one to be non-null.  
**Tables affected:** `team_entitlements`  
**Recommendation:** Add `CHECK (org_id IS NOT NULL OR rep_team_id IS NOT NULL)` to `team_entitlements`. Also verify that RLS SELECT policies are defined and reference at least one of these columns (not just `team_workspace_id`) so entitlement reads stay tenant-scoped even when a row has only one of the two.  
**Status:** Open

---

### [2026-05-23] — Finding #16: `team_org_links` has no direct `org_id` — 2-hop chain via `team_workspaces`

**Severity:** Medium  
**Finding:** `team_org_links` carries `team_workspace_id` but no direct org tenancy column. The primary org context is `team_workspace_id → team_workspaces.workspace_org_id` — a 2-hop join. Any RLS policy or cross-org lookup on link records requires traversing through `team_workspaces`.  
**Tables affected:** `team_org_links`  
**Recommendation:** Evaluate adding `workspace_org_id` (denormalized from `team_workspaces`) to `team_org_links` — the same pattern used for `league_games`, `rep_allocation_installments`, and `rep_player_dues_installments`. If the table is low-traffic (org setup, not scorekeeper-hot-path), accepted risk may be reasonable; document the decision explicitly.  
**Status:** Open

---

### [2026-05-23] — Finding #17: `games.game_time` type mismatch — `text` in dev, `time without time zone` in prod

**Severity:** High  
**Finding:** The `games` table predates the migration system; its column types were set manually and differ between environments. Dev has `game_time text`; prod has `game_time time without time zone`. This matters for two reasons: (1) any time string the app stores that is not a valid PostgreSQL time literal (e.g. `"2:30 PM"`, `""`, `"TBD"`) will be accepted silently in dev but fail with a cast error in prod; (2) `ORDER BY game_time` is lexicographic in dev and temporal in prod — dev test results will not match prod sort order for times like `"9:00"` vs `"10:00"` (string sort puts `"9"` after `"10"`).  
**Tables affected:** `games`  
**Recommendation:** Audit what values the app actually stores in `game_time`. If all stored values are valid time literals (`HH:MM` or `HH:MM:SS`), apply a migration to dev to `ALTER COLUMN game_time TYPE time using game_time::time` to match prod. If the app ever stores non-time strings, apply the opposite migration in prod (`ALTER COLUMN game_time TYPE text`) to match dev. Do not leave the types inconsistent — dev testing will not reflect prod behavior.  
**Status:** Open

---

### [2026-05-23] — Finding #18: `games.bracket_id` type mismatch — `text` in dev, `uuid` in prod

**Severity:** High  
**Finding:** `games.bracket_id` is `text` in dev and `uuid` in prod. Same pre-migration origin as Finding #17. Any code path that passes a non-UUID value (empty string, `"none"`, auto-incremented integers used in bracket logic) will succeed in dev but throw a type error in prod. Implicit casts from `text` → `uuid` in query parameters will also behave differently. This is an active production risk for any bracket feature.  
**Tables affected:** `games`  
**Recommendation:** Determine the canonical type. If `bracket_id` is always a UUID (FK to a bracket record), standardize to `uuid` in both environments. If it can hold non-UUID sentinel values, standardize to `text` in both. Apply a single corrective migration to whichever environment is wrong. The migration must be wrapped in a transaction with a `BEGIN/COMMIT` block. Do not include this in the same migration as any data-change — type coercion on a live table should be isolated.  
**Status:** Open

---

### [2026-05-23] — Finding #19: `league_seasons.draft_state` column exists in prod only

**Severity:** Medium  
**Finding:** A `draft_state jsonb` column exists on `league_seasons` in prod but has no corresponding migration in the codebase (migrations 001–075 don't add it). It was added directly to the prod database. If any UI or API code reads or writes `draft_state`, it will fail in dev with "column does not exist". Dev cannot be used to test any draft/placement feature that uses this column.  
**Tables affected:** `league_seasons`  
**Recommendation:** If this column is actively used, write a migration to add it to dev: `ALTER TABLE league_seasons ADD COLUMN IF NOT EXISTS draft_state jsonb;` — then apply. If it was experimental and is not referenced by any app code, drop it from prod and document the decision. Either way, eliminate the divergence before the next league feature ships.  
**Status:** Open

---

### [2026-05-23] — Finding #20: `pools` nullability drift — `age_group_id` and `created_at` nullable in prod, NOT NULL in dev

**Severity:** Low  
**Finding:** `pools.age_group_id` and `pools.created_at` are `NOT NULL` in dev but nullable in prod. This is the inverse of the typical drift pattern (prod is usually stricter). New inserts from app code that always provide these values will succeed in both environments. The risk is: (1) prod silently accepts incomplete rows that dev would reject; (2) any future query that assumes `age_group_id IS NOT NULL` may behave unexpectedly on prod rows with nulls.  
**Tables affected:** `pools`  
**Recommendation:** Apply a constraint-tightening migration to prod: check for any existing NULL rows first (`SELECT COUNT(*) FROM pools WHERE age_group_id IS NULL OR created_at IS NULL`), then `ALTER TABLE pools ALTER COLUMN age_group_id SET NOT NULL; ALTER TABLE pools ALTER COLUMN created_at SET NOT NULL DEFAULT now();`. Only proceed if no NULL rows exist. If NULL rows are found, investigate and backfill before tightening.  
**Status:** Open

---

### [2026-05-23] — Finding #12: Duplicate indexes on `org_audit_log` in prod

**Severity:** Low  
**Finding:** Prod has two indexes on `org_audit_log(org_id, created_at DESC)`: `idx_audit_log_org` and `idx_audit_org`. Both index identical columns with identical sort. The duplicate adds write overhead on every audit event insert (which fires frequently during platform admin operations) and wastes storage.  
**Tables affected:** `org_audit_log` (prod only)  
**Recommendation:** Drop the auto-named or older duplicate (`idx_audit_org` or whichever was created first) in a cleanup migration applied to prod only. Confirm the remaining index satisfies all existing query plans before dropping.  
**Status:** Open

---

### [2026-05-23] — Inconsistent FK naming: `organization_id` vs `org_id`

**Severity:** High  
**Finding:** The `tournaments` table uses `organization_id` as the FK to `organizations.id`. Every other module uses `org_id`. This inconsistency means any code that dynamically resolves tenancy must special-case the tournaments module, and it increases the risk of a missed filter.  
**Tables affected:** `tournaments`  
**Recommendation:** Add a migration that renames `tournaments.organization_id` → `tournaments.org_id` (add column, backfill, update all queries, drop old column in a follow-up migration after confirming no code references it). Update RLS policies and indexes at the same time.  
**Status:** Addressed — Fully complete as of 2026-05-23 (dev and prod). Migration 072 added `org_id`, backfilled, constrained NOT NULL, indexed, updated `can_access_tournament()` RLS helper, and recreated INSERT policy. Migration 073 dropped the legacy `organization_id` column. All ~37 app code call sites updated. `tournaments` now uses `org_id` consistently with all other modules.

---

### [2026-05-23] — Tournament sub-tables have no direct `org_id` — 2-hop RLS chain

**Severity:** High  
**Finding:** Tables `age_groups`, `games`, `teams`, `diamonds`, `pools`, `contacts`, `resources`, `rules`, `rule_items`, and `announcements` all scope to a tournament via `tournament_id` but carry no `org_id` column. Multi-tenant isolation depends entirely on a 2-hop join: `table → tournaments → organizations`. RLS policies on these tables must join through `tournaments` to enforce org scoping — if any policy is misconfigured, cross-org data leakage is possible. Query performance also suffers on org-wide lookups.  
**Tables affected:** `age_groups`, `games`, `teams`, `diamonds`, `pools`, `contacts`, `resources`, `rules`, `rule_items`, `announcements`  
**Recommendation:** Evaluate adding a denormalized `org_id` column to at minimum `games` and `teams` (the highest-traffic tables). For lower-traffic tables, document the explicit RLS join requirement and add a comment to each table's migration file. Do not add `org_id` unless a query actually needs it — but audit each RLS policy to confirm the join is present.  
**Status:** Accepted Risk — Decision 2026-05-23. The `tournaments` table is tiny (5–20 rows per org, ever) and the join cost is negligible — structurally different from the financial/league findings we fixed. The `can_access_tournament()` SECURITY DEFINER function (updated in migration 072) already collapses the RLS chain to a single function call for all sub-tables. Adding `org_id` to `games` (the highest-write table — scorekeeper updates fire constantly during tournaments) would introduce permanent write overhead and a new drift failure mode with no meaningful RLS or query benefit. All platform-admin cross-org queries use `supabaseAdmin` (service role, bypasses RLS) anyway. The Low findings #7–9 (`contacts`, `announcements`, `resources`) are closed on the same basis.

---

### [2026-05-23] — `teams.players` column — likely untyped denormalization

**Severity:** Medium  
**Finding:** The `teams` table has a `players` column. From the schema snapshot alone the type is unknown. If this is an integer (player count), it may become stale vs actual roster data. If it is a JSON array or text list of player names, it will become a maintenance liability as roster features grow.  
**Tables affected:** `teams`  
**Recommendation:** Confirm column type. If it is a player count, rename to `player_count` and document that it is a cached value (add a trigger or app-layer update rule). If it is a JSON player list, plan to deprecate it in favour of a proper `tournament_roster_players` table before any roster feature ships.  
**Status:** Accepted Risk — Investigated 2026-05-23. Column is `jsonb NOT NULL DEFAULT '[]'` — typed as `Player[]` (`{id, name, number, position}`) in `lib/types.ts`. **The column is vestigial:** no registration form writes to it, every insert path uses `players: []`, no admin or public UI reads or displays the data. The coaches portal `.players` references are for `rep_roster_players` via a separate API — unrelated. Risk level: Low in practice. **Do not build any new feature on this column.** Before shipping any tournament player-roster feature, drop this column and introduce a proper `tournament_roster_players` table. No migration needed now.

---

### [2026-05-23] — `league_games` has no `org_id` — 2-hop chain via `season_id`

**Severity:** Medium  
**Finding:** `league_games` scopes to `league_seasons` via `season_id`. `league_seasons` holds `org_id`. This is a 2-hop chain, same pattern as tournament sub-tables. For a query like "all games for org X in date range Y" the planner must join through `league_seasons`. As season and game counts grow this becomes a performance concern.  
**Tables affected:** `league_games`  
**Recommendation:** Add `org_id` to `league_games` with a backfill migration (derive from `league_seasons`). Index it. Update RLS policy.  
**Status:** Addressed — `org_id` (NOT NULL) added in migration 075 (`supabase/migrations/075_league_games_org_id.sql`), applied to dev and prod 2026-05-23. Backfilled from `league_seasons`. Index `league_games_org_idx` added. Org-member SELECT policy simplified to direct column lookup. Public "active seasons" policy left unchanged (status-based, not org-scoped).

---

### [2026-05-23] — `rep_player_dues_installments` has no `org_id` — 3-hop chain

**Severity:** Medium  
**Finding:** `rep_player_dues_installments` → `rep_player_dues_schedules` (via `schedule_id`) → `org_id`. This is a 3-hop chain. Any platform-admin or cross-org query on installments requires two joins before reaching tenancy context.  
**Tables affected:** `rep_player_dues_installments`  
**Recommendation:** Add `org_id` (and `player_id`, `team_id` if not already present) to `rep_player_dues_installments` as denormalized filter columns. Derive values from the schedule row at insert time. This makes direct RLS possible and speeds up common queries.  
**Status:** Addressed — `org_id` (NOT NULL) and `team_id` (nullable) added in migration 074 (`supabase/migrations/074_rep_installments_org_id.sql`), applied to dev and prod 2026-05-23. Backfilled from `rep_player_dues_schedules`. Indexes `rep_player_dues_installments_org_idx` and `_team_idx` added. SELECT policies simplified to direct column lookups (no more 3-hop join).

---

### [2026-05-23] — `rep_allocation_installments` has no `org_id` — 2-hop chain

**Severity:** Medium  
**Finding:** `rep_allocation_installments` → `rep_allocation_splits` (via `split_id`) → then `org_id` is on `rep_allocation_splits`. Similar to the dues installments issue above.  
**Tables affected:** `rep_allocation_installments`  
**Recommendation:** Same as dues installments — add denormalized `org_id` at the installment level.  
**Status:** Addressed — `org_id` (NOT NULL) and `team_id` (nullable) added in migration 074 (`supabase/migrations/074_rep_installments_org_id.sql`), applied to dev and prod 2026-05-23. Backfilled from `rep_allocation_splits`. Indexes `rep_allocation_installments_org_idx` and `_team_idx` added. SELECT policies simplified to direct column lookups (no more 2-hop join).

---

### [2026-05-23] — `contacts` table is tournament-scoped only — no league or rep equivalent

**Severity:** Low  
**Finding:** The `contacts` table has a `tournament_id` column, making it tournament-module-specific. The league and rep team modules likely store contact info inline (e.g. `league_registrations.guardian_email`, `rep_roster_players.guardian_email`). As the platform grows, a shared `org_contacts` or `people` table may be needed to avoid duplicate contact records across modules.  
**Tables affected:** `contacts`, `league_registrations`, `rep_roster_players`, `rep_tryout_registrations`  
**Recommendation:** No immediate action needed. Monitor: if guardian/contact deduplication becomes a user request, plan a shared contacts table. Flag this before building any cross-module communication or CRM feature.  
**Status:** Accepted Risk — Same basis as Finding #2. These are intentional module boundaries, not scoping bugs. Revisit if/when a cross-module CRM or contacts feature is planned.

---

### [2026-05-23] — `announcements` is tournament-scoped only — no league equivalent

**Severity:** Low  
**Finding:** `announcements` is scoped to `tournament_id`. The league module has a `league_notification_log` but no `announcements` equivalent. If the platform adds a league announcements feature, a new table will be needed — or `announcements` should be refactored to support multiple entity types (tournament, league, org-wide).  
**Tables affected:** `announcements`  
**Recommendation:** Before building league announcements, decide: (a) add a `league_id` nullable column to `announcements` and make `tournament_id` nullable, or (b) create `league_announcements` as a separate table mirroring the structure. Option (b) is simpler and lower risk.  
**Status:** Accepted Risk — No league announcements feature planned. Flag this finding when it hits the roadmap; option (b) is the preferred approach.

---

### [2026-05-23] — `resources` is tournament-scoped — no shared resource pattern

**Severity:** Low  
**Finding:** `resources` (label, url, display_order) is scoped to `tournament_id`. If the platform ever adds org-level or league-level resource links, the table will need extension.  
**Tables affected:** `resources`  
**Recommendation:** No action now. Note for future: a `resource_type` + polymorphic `entity_id` column could generalize it. Flag before building any non-tournament document/link feature.  
**Status:** Accepted Risk — No non-tournament resource feature planned. Flag before building one.

---

## Advisory Notes

---

### [2026-05-23] — Good: `org_overrides` design

The `org_overrides` table (type, value, expires_at, revoked_at) is well-structured for time-bounded platform admin overrides. The soft-revoke pattern (`revoked_at`) is preferable to hard deletes for audit purposes. This pattern should be followed for any future override or feature-flag tables.

---

### [2026-05-23] — Good: dual audit log pattern

`org_audit_log` (org-scoped actions) and `platform_audit_log` (platform admin actions) are correctly separated. This avoids org admins seeing platform-level operations and keeps audit trail queries efficient per scope. Maintain this separation for all new audit events.

---

### [2026-05-23] — Good: rep financial table normalization

The three-level rep financial structure — `rep_cost_allocations` → `rep_allocation_splits` → `rep_allocation_installments` — and the parallel `rep_player_dues_schedules` → `rep_player_dues_installments` — is well-normalized for complex payment flows. The `org_id` denormalization gap (Findings #5 and #6) has been addressed in migration 074.

---

### [2026-05-23] — Watch: Stripe billing tables not yet reviewed

`organizations` has `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`. The Stripe integration plan (see `memory/project_stripe_plan.md`) will add additional tables. When those migrations are written, run `/dba` to review before merging.

---

### [2026-05-23] — Advisory: `team_workspaces` dual org FK naming — justified exception, requires documentation

`team_workspaces` has two FKs to `organizations.id`: `workspace_org_id` (the team's primary tenant org) and `billing_owner_org_id` (who pays — may differ). Convention says FK to `organizations.id` should be `org_id`, but a table cannot have two columns with the same name. The descriptive naming here is the correct approach for this case. **`workspace_org_id` must be the RLS tenancy anchor** — all policies on `team_workspaces` and its child tables (`team_org_links`, `team_workspace_claims`, `team_entitlements`) should scope via this column. Confirm RLS policies enforce this. Add a migration comment noting the naming exception.

---

### [2026-05-23] — Advisory: `team_workspace_claims` — no direct `org_id`, 2-hop via `team_workspaces`

`team_workspace_claims` chains to tenancy via `team_workspace_id → team_workspaces.workspace_org_id`. This is a 2-hop chain (same as pre-fix league_games). The table is low-traffic (claim tokens, one-time setup events) so accepted risk is reasonable — but confirm an RLS SELECT policy exists and joins correctly through `team_workspaces` before this module goes to production.

---

### [2026-05-23] — Good: `billing_retained_records` + `billing_retention_intents` — fully audited, clean

**Status: Addressed (advisory)**  
Both tables are defined in migrations 038 + 039. Both have direct `org_id NOT NULL` (FK → organizations.id). Both have RLS enabled with SELECT policies scoped to `org_id` (restricted to org owners). Index coverage is complete: `(org_id, created_at DESC)` on intents, `(org_id, retained_state, retention_until)` on records, plus purpose-specific partial indexes for expiry processing. The `billing_retained_records` unique partial index (`record_type, record_id WHERE retained_state IN ('retained_inactive','pending_purge')`) correctly prevents duplicate active retention entries per record. No findings.

---

---

### [2026-05-23] — Migration 070: missing `org_id` index on `rep_team_lineups`

**Severity:** High  
**Finding:** Migration 070 introduces `rep_team_lineups` with a direct `org_id` column (correct pattern) but does not create an index on it. The column is used in RLS policy `USING` clauses and in tenant-scoped `WHERE` conditions. Without an index, every RLS check and every org-scoped select does a full table scan.  
**Tables affected:** `rep_team_lineups`  
**Recommendation:** Add `CREATE INDEX IF NOT EXISTS rep_team_lineups_org_idx ON public.rep_team_lineups(org_id);` to migration 070 before applying.  
**Status:** Addressed — `rep_team_lineups_org_idx` added in migration 071 (`supabase/migrations/071_rep_team_lineups_rls_fix.sql`), applied to **dev and prod** 2026-05-23.

---

### [2026-05-23] — Migration 070: no write (INSERT/UPDATE/DELETE) RLS policies

**Severity:** High  
**Finding:** Migration 070 creates only `FOR SELECT` policies on both `rep_team_lineups` and `rep_team_lineup_entries`. There are no `INSERT`, `UPDATE`, or `DELETE` policies. Any coach or org-member write via the Supabase client will be denied. The lineup feature will be read-only through the app until write policies are added.  
**Tables affected:** `rep_team_lineups`, `rep_team_lineup_entries`  
**Recommendation:** Add `FOR ALL` (or explicit `FOR INSERT / FOR UPDATE / FOR DELETE`) policies scoped to coaches on their assigned teams, and an admin write policy for org-admin-level access. Pattern: `USING (team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())) WITH CHECK (same)`.  
**Status:** Addressed — Six write policies added per table (INSERT/UPDATE/DELETE × coaches + org admins) in migration 071 (`supabase/migrations/071_rep_team_lineups_rls_fix.sql`), applied to **dev and prod** 2026-05-23. `WITH CHECK` on INSERT/UPDATE prevents out-of-scope writes. Org admin policies scoped to `role = 'admin'` in `organization_members`.

---

## Priority Q&A Notes — 2026-05-23

### Q1: `organization_id → org_id` rename timing

**Decision: Do now, before Stripe ships.**  
Stripe tables will reference `organizations.id` directly — no dependency on `tournaments.organization_id`. Delaying the rename only grows the reference surface. Scope confirmed: ~15 call sites in application code + RLS policies in migrations 009 and 024. Use a two-step migration: (1) add + backfill + update code + update RLS; (2) drop old column after prod verification.

### Q2: Medium findings — proactive vs. accepted risk

**Priority order:**
1. **Fix now:** Finding #5 (`rep_player_dues_installments` — 3-hop) and Finding #6 (`rep_allocation_installments` — 2-hop) — financial tables; same migration; RLS correctness risk.
2. **Fix before next league feature:** Finding #4 (`league_games` — 2-hop).
3. **Investigate first:** Finding #3 (`teams.players` type) — run a schema query before deciding; if JSON, escalate to Medium-High.

**Not accepted risk:** 3-hop chains on financial tables do not qualify for accepted risk.

### Q3: Migration order

```
Migration N   — tournaments.org_id rename (Finding #1)
Migration N+1 — rep_player_dues_installments + rep_allocation_installments org_id (Findings #5, #6)
Migration N+2 — league_games org_id (Finding #4)
Migration N+3 — DROP tournaments.organization_id (after N verified in prod)
```

---

## Addressed / Accepted Risk

| # | Short title | Severity | Addressed in |
|---|---|---|---|
| 1 | `organization_id → org_id` rename on `tournaments` | High | Migrations 072+073 — dev + prod (2026-05-23) |
| 2 | Tournament sub-tables: 2-hop RLS chain | High | Accepted Risk (2026-05-23) — `can_access_tournament()` SECURITY DEFINER fn collapses chain |
| 3 | `teams.players` vestigial jsonb column | Medium | Accepted Risk (2026-05-23) — never written, never read; drop before any roster feature |
| 4 | `league_games` no `org_id` — 2-hop chain | Medium | Migration 075 — dev + prod (2026-05-23) |
| 5 | `rep_player_dues_installments` no `org_id` — 3-hop | Medium | Migration 074 — dev + prod (2026-05-23) |
| 6 | `rep_allocation_installments` no `org_id` — 2-hop | Medium | Migration 074 — dev + prod (2026-05-23) |
| 7 | `contacts` tournament-only — no cross-module pattern | Low | Accepted Risk (2026-05-23) — revisit if CRM planned |
| 8 | `announcements` tournament-only | Low | Accepted Risk (2026-05-23) — prefer new table if league feature ships |
| 9 | `resources` tournament-only | Low | Accepted Risk (2026-05-23) — flag before non-tournament doc feature |
| 13 | Missing `org_id` index on `rep_team_lineups` | High | Migration 071 — dev + prod (2026-05-23) |
| 14 | No write RLS policies on lineup tables | High | Migration 071 — dev + prod (2026-05-23) |

---

## Trigger checklist — when to re-run `/dba`

- [ ] Before merging any migration that adds a new table
- [ ] Before the Stripe billing migration ships — billing retention tables ✅ clean; `stripe_prices` ✅ clean; remaining Stripe tables not yet written
- [ ] Before slot-first roster Phase 2 ships
- [ ] Before coaching standalone tables ship
- [ ] After Findings #17+#18 (`games` type mismatches) are resolved — code audit required first
- [ ] After Finding #19 (`league_seasons.draft_state` drift) is resolved
- [ ] After Finding #10 (`league_practices` dev/prod sync) is resolved
- [ ] After Finding #11 (duplicate FK constraints in prod) is cleaned up
- [ ] Quarterly health check (next: 2026-08-01)
