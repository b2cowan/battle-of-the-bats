# FieldLogicHQ — Database Architecture Review

> **Maintained by:** `/dba` agent  
> **Last reviewed:** 2026-05-23 (priority Q&A + migration 070 review)  
> **Schema source:** `memory/reference_db_schema.md` (captured 2026-05-11 from `fieldlogichq-dev`)  
> **Tables reviewed:** 43 across 5 modules (tournament, league, rep teams, accounting, platform)

---

## Review Summary

| Severity | Open | Addressed | Accepted Risk |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 0 | 3 | 1 |
| Medium | 0 | 3 | 1 |
| Low | 0 | 0 | 3 |
| Advisory | 4 | 0 | 0 |

---

## Open Findings

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
| 13 | Missing `org_id` index on `rep_team_lineups` | High | Migration 071 — dev + prod (2026-05-23) |
| 14 | No write RLS policies on lineup tables | High | Migration 071 — dev + prod (2026-05-23) |

---

## Trigger checklist — when to re-run `/dba`

- [ ] Before merging any migration that adds a new table
- [ ] Before the Stripe billing migration ships
- [ ] Before slot-first roster Phase 2 ships
- [ ] Before coaching standalone tables ship
- [ ] Quarterly health check (next: 2026-08-01)
