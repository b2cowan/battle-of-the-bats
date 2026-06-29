# FieldLogicHQ — Database Architecture Review

> **Maintained by:** `/dba` agent  
> **Last reviewed:** 2026-06-22 (Finding #26: Club Repackaging entitlement decoupling reviewed pre-build — reuse `club_included`, cap via a new `organizations.team_limit` column NOT `org_overrides`, no per-team rows for org-owned teams; verify-zero confirmed against live dev+prod.) — prev 2026-06-08 (Finding #25: full dev+prod re-snapshot via new `scripts/refresh-db-snapshots.mjs`; 50 dev/prod divergences catalogued in `schema-snapshots/DRIFT_dev_vs_prod.md`. Schema now **103 tables** both envs.) — prev 2026-06-04 (H8 Findings #22–24: extend `org_overrides` not a new table, embed-not-flag hot path, reuse billing-suspension columns).  
> **Schema source (authoritative):** `docs/agents/db/schema-snapshots/*.json` — regenerated for **dev AND prod** by `node scripts/refresh-db-snapshots.mjs` (run after every migration). It also emits `DRIFT_dev_vs_prod.md` and refreshes `memory/reference_db_schema.md`. **Decide column existence from these snapshots / live `information_schema`, never from migrations** (see `docs/agents/db/DATA_DICTIONARY.md` rules).  
> **Tables reviewed:** 85 across 9 modules (tournament, league, rep teams, standalone team workspace, accounting, stripe, org/platform core, platform admin, CRM)  
> **Validation:** `docs/validate_db_state.sql` — checks 17–18 added (pools); check 19 added (games FK duplicates). Will FAIL on prod until migrations 081 Part B and 082 applied.

---

## Review Summary

| Severity | Open | Addressed | Accepted Risk |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 1 | 7 | 1 |
| Medium | 0 | 4 | 2 |
| Low | 0 | 4 | 3 |
| Advisory | 8 | 1 | 0 |

> **Newest (2026-06-28):** #27 rep game scoring should be team-relative (`team_score`/`opponent_score`) not home/away-assumed — **High, fix now while pre-launch/cheap**; #28 lineup/stats analytics readiness — model sound, keep future stats in own leaf tables (Advisory); #29 Phase-4 lineup templates → new dedicated table, not the event-bound `rep_team_lineups` (Advisory).

---

## Open Findings

---

### [2026-06-28] — Finding #27: rep game scoring is home/away-labelled but team-relative in practice — adopt explicit team-relative scoring (`team_score`/`opponent_score`)

**Severity:** High (data integrity + future analytics; pre-implementation decision)
**Finding:** `rep_team_events` stores `home_score`/`away_score` (int) + a separate `home_away` tag (CHECK `home|away|neutral`), but nothing binds the scores to the coach's team. The app derives `result` as `home_score > away_score → win` (`handleScoreSave` / `handleScoreSave` in the schedule page), i.e. it **assumes the coach's team is always the home side**, and the score-entry UI labels the two boxes "Home"/"Away" with **no link to `home_away`**. Consequences: (1) **away games can be recorded backwards** — if a coach enters the literal home team's runs in the "Home" box for an away game, a win is stored as a loss; (2) **future "home record vs away record" splits are unreliable** because we can't trust which score is the coach's team; (3) the column names actively mislead any future direct SQL / stats module. The DATA_DICTIONARY already hedges this (`home_score`/`away_score`: *"The coach UI labels them 'Home'/'Away'; no code binds `home_score` to the rep team specifically."*).
**Tables affected:** `rep_team_events`
**Recommendation:**
- **Store team-relative:** add `team_score` + `opponent_score` (int, nullable). `result` derives unambiguously (`team_score > opponent_score → win`). Keep `home_away` as the independent context tag — that is what enables clean home/away record splits later (`GROUP BY home_away` over `result`).
- **Scoreboard presentation stays correct** by deriving from `home_away` at render (if `home_away='away'`, show `team_score` on the away side), instead of storing literal home/away.
- **Backfill is 1:1 and safe** precisely because the current code already treats home = the coach's team: `team_score := home_score`, `opponent_score := away_score`. **Pre-check (read-only, live dev+prod) the count of rep game rows with a non-null score before migrating** — the Premium coach portal is effectively pre-launch (test data only), so this is almost certainly ~0 real rows and a trivial/no-op backfill. Do it **now while cheap.**
- Keep old columns for one release (additive add + backfill), drop in a follow-up after code is cut over; or drop immediately if the live pre-check shows 0 real rows. Update `result` derivation to remove the home-assumption.
- **DATA_DICTIONARY + dev/prod snapshots in the same unit of work**; this is exactly the kind of CHECK/semantic change `check-prod-migration-drift.mjs` is blind to — verify live.
**Status:** Addressed (dev) 2026-06-28 — owner chose team-relative. **Mig 158** RENAMEs `home_score→team_score`, `away_score→opponent_score` on `rep_team_events` (dev-applied; ⚠ **PROD-PENDING** — apply at release, then drop the transitional `home_score`/`away_score` anchors in DATA_DICTIONARY). Code cut over: type `RepTeamEvent`, db mapper + `updateRepTeamEvent`, events PATCH route, coach schedule (score entry relabelled "Your team / Opponent", result derives `team>opp`), admin rep history + schedule views. `home_away` retained as independent context tag. Snapshots refreshed; `check:dictionary` green. Tournament `games` + `league_games` untouched (true home/away).

---

### [2026-06-28] — Finding #28: Lineup/stats analytics readiness — model is sound; keep future game-stats in their own leaf tables, do NOT overload lineup data

**Severity:** Advisory (future-readiness; no action required now)
**Finding:** Reviewed whether the rep-team model can later answer "W/L with this lineup" / "W/L when player X starts at pitcher" and support a real game-stats module. **It can, with no rebuild.** Everything is ID-linked: `rep_team_events` (result/score/event_type/home_away, `year_idx`) ⇄ `rep_team_lineups` (1:1 per event, `rep_team_lineups_event_id_key`) ⇄ `rep_team_lineup_entries` (`player_id` FK, `batting_order`, `starter`, `inning_positions` jsonb; `player_idx`, `lineup_idx`, unique `(lineup_id, player_id)`) ⇄ `rep_team_event_attendance`. The example questions are plain joins; "started at pitcher" = `inning_positions->>'1' = 'P'`.
**Tables affected:** `rep_team_lineup_entries`, `rep_team_events` (+ future stats tables)
**Recommendation:**
- **`inning_positions` JSONB is the only soft spot** — fine for the app and light queries. At **team scale** (tens of games, ~15 players per season) even full scans are negligible; **no index needed now**. If a query ever proves slow, add an **expression index** (`(inning_positions->>'1')`) or a GIN index — additive, deferrable. Do **not** normalize the per-inning map into rows just for the app's sake.
- **Plan vs actual — confirmed:** a lineup is the *planned* assignment. A real stats module must live in **its own normalized leaf tables keyed by `(event_id, player_id)`** with denormalized `org_id`/`team_id`/`program_year_id` (mirror the established rep_* leaf pattern — Findings #5/#6). Do **not** add stat columns to lineup/entries or to `rep_team_events`.
- **Recommended future shape (do NOT pre-build):** `rep_player_game_stats(event_id, player_id, org_id, team_id, program_year_id, …, UNIQUE(event_id, player_id))` for the box-score line; optionally `rep_game_position_appearances(event_id, player_id, inning, position, …)` for actual (vs planned) per-inning play — which is also where a **derived read-model** from the lineup JSONB would live if planned positions ever need to be queried relationally at scale.
- **Sport-neutrality:** stat vocab differs by sport (baseball vs basketball). When the stats module is scoped, decide between a typed-per-sport table and a `stats jsonb` bag keyed by **Sport-Pack-defined** stat codes (`lib/sports.ts`). Flag as a design decision for that project, not now.
- **Results already structured on the event** (score + `result`) — keep them there (see Finding #27 for the score-semantics fix that makes these analytics trustworthy).
**Status:** Open (informational) — no migration now; revisit when a game-stats module is scoped.

---

### [2026-06-28] — Finding #29: Phase-4 named lineup templates — new dedicated table(s), do NOT overload the event-bound `rep_team_lineups`

**Severity:** Advisory (pre-implementation decision)
**Finding:** The lineup builder plan (`docs/projects/active/COACH_LINEUP_BUILDER_PLAN.md`, Phase 4) adds **named, reusable lineup templates** ("Gold medal game"). Reusing `rep_team_lineups` with a nullable `event_id` + `name` is a poor fit: that table has **`event_id NOT NULL` + unique `rep_team_lineups_event_id_key`** (one lineup per event) and its entries are **full-replace-on-save, 1:1 with an event** — templates are not event-bound, so this would muddy the event-lineup invariants.
**Tables affected:** `rep_team_lineups` (avoid), new `rep_team_lineup_templates` (+ optional entries)
**Recommendation:**
- **New dedicated store**, `rep_*` prefixed, scoped by `team_id` + `program_year_id` + `org_id` (NOT NULL, **indexed** — don't repeat the Finding #13 missed-index miss), with `name`, `lineup_mode`, `inning_count`. Two clean options:
  1. **Header + entries pair** (`rep_team_lineup_templates` + `rep_team_lineup_template_entries`, mirroring the lineups/entries shape, entries keyed by `player_id`) — most consistent with existing conventions.
  2. **Single table with `entries jsonb`** — acceptable and lighter **because templates are a convenience snapshot, not an analytics surface** (unlike live lineups). Avoids a fourth lineup-shaped table.
  Recommend option 2 for footprint unless we expect to query across templates; either is fine — the key point is **not** reusing the event-bound table.
- **Scope to `program_year_id` for V1.** Template entries key on `player_id`, and the season rollover creates **new** roster rows (new `player_id`s), so a template can't transparently carry across seasons — note this caveat; cross-season reuse (map by jersey/name) is a future concern.
- **On load:** map to the current active roster, **silently skip players no longer rostered** (report how many were skipped). Loads into the editable (unsaved) grid — no silent overwrite (matches the plan).
- **RLS:** add write policies mirroring **migration 071** (coaches on their assigned teams via `rep_team_coaches` + org-admin), with `WITH CHECK`. Service-role app paths still work, but write policies should exist before any client-side access.
- Migration + DATA_DICTIONARY + dev/prod snapshots in the same unit of work (this is the one phase of the lineup plan that needs a migration).
**Status:** Open — recommendation issued 2026-06-28; applies when Phase 4 is built.

---

### [2026-06-22] — Finding #26: Club Repackaging entitlement decoupling — reuse `club_included`, cap via `organizations.team_limit` (NOT `org_overrides`), no per-team rows for org-owned teams

**Severity:** High (pre-implementation architecture decision)
**Finding:** Club Repackaging (`docs/projects/active/CLUB_REPACKAGING_PLAN.md`) retires the `org_team_addon` per-team meter and entitles a Club / `club_large` org's rep teams up to a per-plan cap (15 / 30). **Verify-zero (read-only, live, 2026-06-22):** prod (`qcttcboqysynwcdyghil`) has **0 Club orgs, 0 rep_teams, 0 `org_team_addon`** across `team_workspaces.billing_mode` / `team_entitlements.source` / `team_org_links.billing_mode_after_approval`; dev (`npgnrxaitgbtbtvvykto`) has **0 `org_team_addon`**, 2 (test) Club orgs, 6 rep_teams, 0 `club_included`. **Greenfield — nothing to migrate, no access-loss / grandfather risk.**
Two access concepts already coexist and are mostly disjoint: (1) **module access** `module_rep_teams`, derived at read time from `PLAN_CONFIG[planId].moduleEntitlements` (Club already includes it) — covers a Club org's OWN rep teams with **no** `team_entitlements` rows; (2) **team-scoped** `team_entitlements` (`getTeamScopedRepTeamAccess`), which gates the standalone Coaches Portal product (`planId='team'`, deliberately lacking `module_rep_teams`). `club_included` is **already** a valid value in the live CHECK constraints (mig 065) for `team_workspaces.billing_mode`, `team_entitlements.source`, and `team_org_links.billing_mode_after_approval`, and is already written by the ownership-transfer RPC (mig 067).
**Tables affected:** `organizations`, `team_entitlements`, `team_workspaces`, `team_org_links`, `rep_teams` (+ plan config in code).
**Recommendation:**
- **Do NOT materialize per-team `club_included` entitlement rows for a Club org's own rep teams** — they are entitled by `module_rep_teams` at read time. Per-team rows would be redundant + drift-prone (every create/archive needs sync). Enforce the cap as a **write-time gate** at rep-team create/link; keep access plan-tier-derived.
- Reserve `source='club_included'` rows for the existing **external-workspace link/takeover** path only (extend it to write `club_included` instead of `org_team_addon`, capped). Reuse the existing cancel-then-insert discipline + honor the `team_entitlements_active_source_unique` partial index.
- **Per-plan `teamLimit` = plan-config only, NO DB** (mirror `tournamentLimit`).
- **Per-org custom cap (">30"): add nullable `organizations.team_limit integer`; `getEffectiveTeamLimit(planId, storedLimit)` mirrors `getEffectiveTournamentLimit`. Do NOT reuse `org_overrides`** — its `type` CHECK (`subscription_status|comp_period|module_addon|plan_tier`) would need DROP+ADD anyway, AND its grant reader is **inert by default** (`ENTITLEMENT_GRANTS_ENABLED` off) and only handles `module_addon`+`subscription_status`, so a `team_cap` type would never be read without a bespoke reader. The `organizations.tournament_limit` column is the proven per-org capacity-override pattern; `team_limit` should follow it exactly. **(This supersedes the plan's Phase 3.5-D "reuse org_overrides" proposal.)**
- **Cap count = `rep_teams WHERE org_id=? AND is_archived=false`.** `rep_teams` has no team-subtype/billing-class column (`division` is free text, `group_id` is display grouping) — all teams count equally (matches the "no separate select pricing" decision). `league_teams` and tournament `teams` are different modules and must not count.
- **Retiring `org_team_addon` is code-only** (remove checkout/takeover fns + the `$19` UI + `getStripePriceId('org_team_addon')`); zero rows to migrate. RLS unchanged — `team_entitlements`/`team_org_links`/`team_workspaces` are service-role-only by design (do not add client policies). No realtime dependency on entitlements.
**Migrations required:** **Three small additive migrations** (corrected 2026-06-22 by the Club Repackaging debt scan — my initial "zero migrations for Phases 1–2" was an undercount). `organizations.plan_id` and `stripe_prices.plan_id` carry **no DB CHECK**, but **two other plan-keyed tables do** and were missed:
1. **`plan_gating.plan_key`** — `plan_gating_plan_key_check` is live-locked to the 5 plans (verified in `schema_dumps.json`, **dev block + prod block**). Widen to add `'club_large'` + seed a `('club_large','early_access')` row (the route does UPDATE-only, so a missing row silently no-ops the gating toggle).
2. **`platform_plan_module_entitlements.plan_id`** — `platform_plan_module_entitlements_plan_check` is live-locked to the 5 plans (dev+prod). Widen to add `'club_large'`; the feature-matrix publish path will attempt `club_large` rows once it's in `PLAN_ORDER` and would otherwise hit the CHECK. Seed the 7 module rows mirroring `club`.
3. **`organizations.team_limit`** (nullable integer) — Phase 3.5-D per-org custom cap, mirrors `tournament_limit`.

All three are additive/idempotent (DROP+ADD the explicitly-named CHECK constraints; existing rows unaffected) and ride the same unit of work: update `DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev+prod); `check:dictionary` + the snapshot refresh gate them. **Note for future:** these two CHECK constraints are exactly the kind the column-only drift gate (`check-prod-migration-drift.mjs`) is BLIND to — widen them deliberately, don't assume the gate will catch a miss.
**Status:** Open — **GO for Phase 1** (with the corrected 3-migration set above). Recommendation issued 2026-06-22; migration count corrected same day post-debt-scan.

---

### [2026-06-08] — Finding #25: Dev/prod structural drift re-baselined (50 divergences); snapshots now regenerable for BOTH envs

**Severity:** Low (drift is mostly legacy/cosmetic) + Advisory (tooling)
**Finding:** The committed `schema-snapshots/*.json` were badly stale (82–85 vs 103 live tables — they predated the `age_groups→divisions` rename, the `org_id` rename, `tournaments.settings`, the contact refactor, per-game length (112), `teams.seed` (113), the `teams.players` drop, the roster split, and the `basic_coach_*` tables). New `scripts/refresh-db-snapshots.mjs` regenerated **dev + prod** from live `information_schema`/`pg_catalog` (structure only). Both envs are now **103 tables**, but `DRIFT_dev_vs_prod.md` catalogues **50 structural divergences**. Material items:
- **Dev MISSING `created_at`** on `resources`, `rule_items`, `rules` (present in prod) — same dev-behind-prod class as Finding #20 (`pools.created_at`).
- **`tournaments.status`** — dev: default `'draft'`, **no** CHECK; prod: default `'completed'` **with** `tournaments_status_check`. Prod constrains the enum and defaults differently. (App code always sets `status` explicitly on insert, so the default rarely bites — but the missing dev CHECK + default mismatch is real.)
- **Legacy tournament tables** (`announcements`, `diamonds`, `games`, `teams`, `rules`, `rule_items`, `resources`) carry widespread nullability/default drift, plus `id` default-fn drift (`gen_random_uuid()` dev vs `uuid_generate_v4()` prod). These predate the migration system — same accepted-risk basis as Findings #17/#18.
- **`league_practices` index-NAME drift** (`*_season_idx` dev vs `*_season_id_idx` prod, etc.) — functionally equivalent, cosmetic.
- **FK naming** (`*_tournament_id_fkey` dev vs `fk_*_tournament` prod) — **known/intentional** per Findings #11/#21, not new.

**Tables affected:** `resources`, `rule_items`, `rules`, `tournaments`, `announcements`, `diamonds`, `games`, `teams`, `league_practices`
**Recommendation:** Low priority. (1) If any code reads `created_at` on `resources`/`rules`/`rule_items`, add the column to dev (dev-only migration) to match prod. (2) Consider a parity migration adding `tournaments_status_check` + aligning the default to dev. (3) Treat the legacy nullability/default drift as accepted risk unless a write path depends on it. (4) **Re-run `node scripts/refresh-db-snapshots.mjs` after every migration (dev + prod)** to keep `DRIFT_dev_vs_prod.md` current — this is now the standing drift-watch. Cross-reference the field-level meaning in `DATA_DICTIONARY.md` (Phase 1+).
**Status:** Open (informational) — drift catalogued 2026-06-08; no corrective migration written yet. Tooling established (`scripts/refresh-db-snapshots.mjs` + `check-dictionary-coverage.mjs`).

---

### [2026-06-04] — Finding #22: Timed Entitlement Grants (H8) — **extend `org_overrides`, do not create a parallel `platform_entitlement_grants` table**

**Severity:** High (pre-implementation architecture decision)
**Finding:** The H8 plan ([TIMED_ENTITLEMENTS_PLAN.md](../../projects/active/TIMED_ENTITLEMENTS_PLAN.md)) proposes a new `platform_entitlement_grants` table to drive time-boxed comps/trials. A near-identical table already exists and is endorsed in this log: **`org_overrides`** (`org_id`, `type` CHECK, `value`, `expires_at`, `reason`, `created_by`, `created_at`, soft-revoke via `revoked_at`/`revoked_by`; index `idx_org_overrides_org`). The 2026-05-23 advisory note says explicitly: *"This pattern should be followed for any future override or feature-flag tables."* A second parallel table would (a) duplicate the exact override/expiry/soft-revoke shape, (b) collide conceptually with the **existing `team_entitlements`** table (team-workspace entitlements with `source`/`status`/`starts_at`/`ends_at`), and (c) force the plan's awkward "migrate founding comps vs. dual-read" decision — because founding-season `comp_period` rows **already live in `org_overrides`**.
**Tables affected:** `org_overrides`, `organizations`
**Recommendation:**
- **Extend `org_overrides`** with additive, backward-compatible columns: `target jsonb` (e.g. `{"addons":["module_house_league"]}` / `{"plan":"league"}` / `{"status":"active"}`), `starts_at timestamptz NOT NULL DEFAULT now()`, `suppress_billing boolean NOT NULL DEFAULT false`. Widen the `type` CHECK to add `module_addon` and `plan_tier` (drop + re-add the explicitly-named constraint; existing rows unaffected).
- This **eliminates the founding-season migration/dual-read question** (Finding addresses plan §Phase 1): the entitlement layer reads one table and simply ignores `comp_period` rows for *module access* (founding comp is a billing concern, not an access grant).
- If a separate table is insisted upon despite the above, name it **`org_entitlement_grants`** (parallel to `org_overrides`/`org_internal_notes`/`org_audit_log`), **not** `platform_entitlement_grants`, and never bare "entitlements" (reserved for `team_entitlements`).
- Add a partial index **`idx_org_overrides_org_active ON org_overrides(org_id) WHERE revoked_at IS NULL`** to keep the active-grant lookup tight as the table grows.
- Keep reads **service-role only** (org_overrides has no client RLS policies today — consistent; do not expose comp reasons to customers).
**Status:** Open — recommendation issued 2026-06-04; pending implementation.

---

### [2026-06-04] — Finding #23: H8 hot-path enforcement — use a PostgREST embed, **drop the `has_active_grants` flag**

**Severity:** Medium
**Finding:** The plan adds a denormalized `has_active_grants boolean` on `organizations` to short-circuit the entitlement hot path (the 4 org loaders run on nearly every authenticated request). Two problems: (1) it's **drift-prone** — a grant *expiring* fires no DB write, so the flag goes stale (true forever) and the short-circuit erodes; (2) during the current **founding-season** GTM push most orgs already carry an `org_overrides` row, so a naive flag is true for most orgs and saves nothing.
**Tables affected:** `organizations`, `org_overrides`
**Recommendation:** Don't add the column. Instead fetch active overrides **in the same query** via a PostgREST embed — the loaders already use nested selects (e.g. [user-contexts.ts](../../../lib/user-contexts.ts) does `organizations(...)`). Embed `org_overrides(type,value,target,expires_at,starts_at,revoked_at)` on the org select and filter "active" in JS (per-org row count is tiny). This is **one round-trip, always correct, no denormalization, no reconciliation burden**. Only revisit a cached flag if profiling shows the embed is a measurable cost. Note: `hasModuleEntitlement()` checks `subscriptionStatus === 'canceled'` *first* — compute effective `subscriptionStatus` (status grants) **before** that guard, or a status grant on a canceled org won't take effect.
**Status:** Open — recommendation issued 2026-06-04; pending implementation.

---

### [2026-06-04] — Finding #24: Scenario A billing should reuse existing `organizations.billing_suspended_at` / `billing_suspension_reason`

**Severity:** Advisory
**Finding:** `organizations` already has `billing_suspended_at` and `billing_suspension_reason` columns. The plan's Scenario A (`suppress_billing` comps) should relate to / reuse these rather than inventing a parallel billing-state representation, to avoid two sources of truth for "is this org currently being billed." This is primarily a `/billing` concern but flagged here so the schema isn't duplicated.
**Tables affected:** `organizations`, `org_overrides`
**Recommendation:** During Scenario A design (`/billing`), decide whether a `suppress_billing` grant *sets* `billing_suspended_at` (single source of truth) or whether billing suspension is derived from active grants at read time. Do not store overlapping billing-suspension state in two places without a documented owner.
**Status:** Open — flag for `/billing` review (plan Phase 4).

---

### [2026-05-23] — Finding #10: `league_practices` exists in prod but not dev

**Severity:** High  
**Finding:** The `league_practices` table (`id`, `season_id`, `division_id`, `team_id`, `scheduled_at`, `ends_at`, `location`, `notes`, `status`, `recurrence_group_id`, `created_at`, `updated_at`) exists in production but does not exist in the dev database. A migration was applied to prod but skipped dev. This means dev is behind, any code referencing `league_practices` will fail on dev, and any future dev migration that touches league tables must account for the missing table to avoid conflicts.  
**Tables affected:** `league_practices`  
**Recommendation:** Write and apply a corrective migration to dev that creates `league_practices` matching the prod definition. Verify column types, nullability, and any indexes or RLS policies are in sync. Once applied, add to migration numbering sequence so it doesn't conflict. If `league_practices` is intentionally a prod-only experiment (not yet built in the UI), document why and suppress dev drift warnings.  
**Status:** Addressed — migration 077 applied to dev 2026-05-24. Migration 078 added `org_id` (NOT NULL, backfilled from `league_seasons`, indexed, RLS policy simplified to direct lookup) to both dev and prod 2026-05-24. `AgentPlaybook.tsx` note updated. `league_practices` is now fully consistent with the league module schema pattern.

---

### [2026-05-23] — Finding #11: Duplicate FK constraints on tournament tables in prod

**Severity:** Medium  
**Finding:** The prod database has duplicate FK constraints on several tournament sub-tables: e.g. `games` has both `fk_games_tournament` AND `games_tournament_id_fkey` pointing to the same column. Similar duplicates exist on `divisions`, `contacts`, `diamonds`, `announcements`, and `teams`. Duplicate constraints mean Postgres enforces the same referential integrity check twice on every INSERT/UPDATE, adds overhead to `pg_constraint` lookups, and creates confusion in schema introspection tools.  
**Tables affected:** `games`, `divisions`, `contacts`, `diamonds`, `announcements`, `teams` (prod only)  
**Recommendation:** In a cleanup migration, `ALTER TABLE … DROP CONSTRAINT` the auto-named `*_fkey` duplicates, keeping only the explicitly-named `fk_*` constraints. Run against prod only (dev doesn't have the duplicates). Wrap in a transaction. Test that the surviving named constraints still block orphan inserts before merging.  
**Status:** Addressed — migration 080 applied to prod 2026-05-24. All 6 `*_tournament_id_fkey` duplicates dropped. All 6 `fk_*_tournament` constraints retained. Verified via `validate_db_state.sql` — 16/16 checks passing.

---

### [2026-05-23] — Finding #15: `team_entitlements` — dual nullable owner FKs with no NOT NULL guard

**Severity:** Medium  
**Finding:** `team_entitlements` has `org_id` (FK → organizations.id, nullable) and `rep_team_id` (FK → rep_teams.id, nullable). Both are nullable. A row with both NULL is a dangling entitlement — no org owns it, no team owns it — and the RLS system cannot scope it to any tenant. There is no visible CHECK constraint requiring at least one to be non-null.  
**Tables affected:** `team_entitlements`  
**Recommendation:** Add `CHECK (org_id IS NOT NULL OR rep_team_id IS NOT NULL)` to `team_entitlements`. Also verify that RLS SELECT policies are defined and reference at least one of these columns (not just `team_workspace_id`) so entitlement reads stay tenant-scoped even when a row has only one of the two.  
**Status:** Closed — Incorrect finding (2026-05-24). Migration 065 source reviewed directly: `org_id` is defined as `uuid NOT NULL` and `rep_team_id` is defined as `uuid NOT NULL`. The dangling-row scenario is structurally impossible. The schema snapshot that generated this finding was incorrect. No migration needed. The related RLS concern (no client policies) is captured separately as an Advisory finding.

---

### [2026-05-23] — Finding #16: `team_org_links` has no direct `org_id` — 2-hop chain via `team_workspaces`

**Severity:** Medium  
**Finding:** `team_org_links` carries `team_workspace_id` but no direct org tenancy column. The primary org context is `team_workspace_id → team_workspaces.workspace_org_id` — a 2-hop join. Any RLS policy or cross-org lookup on link records requires traversing through `team_workspaces`.  
**Tables affected:** `team_org_links`  
**Recommendation:** Evaluate adding `workspace_org_id` (denormalized from `team_workspaces`) to `team_org_links` — the same pattern used for `league_games`, `rep_allocation_installments`, and `rep_player_dues_installments`. If the table is low-traffic (org setup, not scorekeeper-hot-path), accepted risk may be reasonable; document the decision explicitly.  
**Status:** Accepted Risk — Decision 2026-05-24. Two mitigating factors: (1) `team_org_links` already has a direct `linked_org_id NOT NULL` column — for a parent org's admin looking up links they're party to, this is a direct FK with an index. The 2-hop only applies to lookups from the team side (workspace_org_id context), which are service-role mediated (no direct client RLS needed). (2) The table is low-traffic (one-time setup/link events, not a hot write path). Adding a denormalized `workspace_org_id` column introduces write overhead and a new drift failure mode without meaningful RLS or query benefit at current volume. Flag before adding any client-side RLS policy to this table.

---

### [2026-05-23] — Finding #17: `games.game_time` type mismatch — `text` in dev, `time without time zone` in prod

**Severity:** High  
**Finding:** The `games` table predates the migration system; its column types were set manually and differ between environments. Dev has `game_time text`; prod has `game_time time without time zone`. Two confirmed impacts: (1) `ORDER BY game_time` is lexicographic in dev and temporal in prod — the seeder writes `'9:00'` (no leading zero) which sorts *after* `'10:00'` as a string but *before* as a time. Schedules display in wrong order in dev. (2) Any non-`HH:MM` string would be silently accepted in dev but rejected by prod's stricter type. Code audit confirms all write paths produce valid `HH:MM` time literals — prod type is correct.  
**Tables affected:** `games`  
**Recommendation:** Apply migration 076 to dev only: `ALTER TABLE games ALTER COLUMN game_time TYPE time without time zone USING game_time::time;`. All existing dev values cast cleanly. Do not touch prod — it is already correct.  
**Status:** Addressed — migration 076 applied to dev 2026-05-24. `game_time` is now `time without time zone` in both environments. Sort order corrected.

---

### [2026-05-23] — Finding #18: `games.bracket_id` type mismatch — `text` in dev, `uuid` in prod

**Severity:** High  
**Finding:** `games.bracket_id` is `text` in dev and `uuid` in prod. Code audit confirms the only write source is `crypto.randomUUID()` in `PlayoffWizard.tsx` — values are always UUID or NULL. The `'default'` string seen in `GameList.tsx` is a UI-only fallback for grouping, never stored. Prod's `uuid` type is correct; dev silently accepts any string without format validation.  
**Tables affected:** `games`  
**Recommendation:** Include in migration 076 (dev only): verify `SELECT COUNT(*) FROM games WHERE bracket_id IS NOT NULL AND bracket_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'` returns 0, then `ALTER TABLE games ALTER COLUMN bracket_id TYPE uuid USING bracket_id::uuid;`. Do not touch prod.  
**Status:** Addressed — migration 076 applied to dev 2026-05-24. `bracket_id` is now `uuid` in both environments.

---

### [2026-05-23] — Finding #19: `league_seasons.draft_state` column exists in prod only

**Severity:** ~~Medium~~ → **High** (severity upgraded after code audit)  
**Finding:** A `draft_state jsonb` column exists on `league_seasons` in prod but has no corresponding migration in the codebase. It was added directly to the prod database as part of Phase 5G (Team Placement + Draft Tools) implementation. App code fully depends on it: `lib/types.ts` (`LeagueSeason.draftState`), `lib/db.ts` mapper, `draft/route.ts` (`loadDraft()` / `saveDraft()`), and `placement/route.ts` (clears on finalization). Without this column, any dev test of the draft/placement feature fails with "column draft_state does not exist".  
**Tables affected:** `league_seasons`  
**Recommendation:** Migration 079 (dev only): `ALTER TABLE league_seasons ADD COLUMN IF NOT EXISTS draft_state jsonb;`  
**Status:** Addressed — migration 079 applied to dev 2026-05-24.

---

### [2026-05-23] — Finding #20: `pools` column drift — `created_at` missing from dev; `display_order` nullable in prod

**Severity:** Low  
**Finding:** Direct schema inspection (2026-05-24) revealed the original finding was incorrect. Actual drift:  
- `pools.created_at` — EXISTS in prod (`timestamptz NOT NULL DEFAULT now()`), **completely missing from dev**. Any dev code or test that reads `created_at` from `pools` will fail with "column does not exist".  
- `pools.display_order` — `NOT NULL` in dev, **nullable in prod** (default 0). Inverse drift; low practical risk since all app writes provide this value and the default is 0.  
- `pools.division_id` — originally claimed nullable in prod; **actually NOT NULL in both environments**. The original schema snapshot was wrong.  

**Tables affected:** `pools`  
**Recommendation:** Two-part migration 081 (`supabase/migrations/081_pools_nullability_prod.sql`):  
- Part A (dev only): `ALTER TABLE pools ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();`  
- Part B (prod only, optional): backfill NULLs then tighten `display_order` — run pre-check first: `SELECT COUNT(*) FROM pools WHERE display_order IS NULL;`  
**Status:** Addressed — Migration 081 Part A applied to dev 2026-05-24 (added `created_at`). Migration 081 Part B applied to prod 2026-05-24 (tightened `display_order` NOT NULL). Both environments verified clean via `validate_db_state.sql` — 19/19 checks passing on prod, 18/19 on dev (check 19 expected FAIL on dev — no duplicates, just auto-named constraints).

---

### [2026-05-24] — Finding #21: Residual duplicate FK constraints on `games.division_id` and `games.away_team_id` (prod only)

**Severity:** Low  
**Finding:** Migration 080 cleaned up `*_tournament_id_fkey` duplicates on six tournament sub-tables, but missed two additional duplicate FKs on `games` pointing to non-tournament tables. Live schema inspection confirms prod has both constraints on each column:  
- `games.division_id` → `games_division_id_fkey` (auto-named) AND `fk_games_division` (explicit) — both point to `divisions.id`  
- `games.away_team_id` → `games_away_team_id_fkey` (auto-named) AND `fk_games_away_team` (explicit) — both point to `teams.id`  

Dev has only the auto-named versions (`games_*_fkey`), which is correct for dev. Prod should keep only the explicit `fk_*` names to match its convention. `games.diamond_id` does NOT have this problem — prod has only `fk_games_diamond`.  
**Tables affected:** `games` (prod only)  
**Recommendation:** Migration 082 (prod only): `DROP CONSTRAINT IF EXISTS games_division_id_fkey` and `DROP CONSTRAINT IF EXISTS games_away_team_id_fkey`. Keep `fk_games_division` and `fk_games_away_team`.  
**Status:** Addressed — Migration 082 applied to prod 2026-05-24. `games_division_id_fkey` and `games_away_team_id_fkey` dropped. `fk_games_division` and `fk_games_away_team` retained. Run `validate_db_state.sql` check 19 to confirm.

---

### [2026-05-23] — Finding #12: Duplicate indexes on `org_audit_log` in prod

**Severity:** Low  
**Finding:** Prod has two indexes on `org_audit_log(org_id, created_at DESC)`: `idx_audit_log_org` and `idx_audit_org`. Both index identical columns with identical sort. The duplicate adds write overhead on every audit event insert (which fires frequently during platform admin operations) and wastes storage.  
**Tables affected:** `org_audit_log` (prod only)  
**Recommendation:** Drop the auto-named or older duplicate (`idx_audit_org` or whichever was created first) in a cleanup migration applied to prod only. Confirm the remaining index satisfies all existing query plans before dropping.  
**Status:** Addressed — migration 080 applied to prod 2026-05-24. `idx_audit_org` dropped, `idx_audit_log_org` retained. Verified via `validate_db_state.sql`.

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
**Finding:** Tables `divisions`, `games`, `teams`, `diamonds`, `pools`, `contacts`, `resources`, `rules`, `rule_items`, and `announcements` all scope to a tournament via `tournament_id` but carry no `org_id` column. Multi-tenant isolation depends entirely on a 2-hop join: `table → tournaments → organizations`. RLS policies on these tables must join through `tournaments` to enforce org scoping — if any policy is misconfigured, cross-org data leakage is possible. Query performance also suffers on org-wide lookups.  
**Tables affected:** `divisions`, `games`, `teams`, `diamonds`, `pools`, `contacts`, `resources`, `rules`, `rule_items`, `announcements`  
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

### [2026-05-24] — Advisory: `team_entitlements`, `team_org_links`, `team_workspace_claims` — RLS-enabled but no client policies defined

**Severity:** Advisory  
**Finding:** All three team workspace foundation tables (`team_entitlements`, `team_org_links`, `team_workspace_claims`) have RLS enabled but zero client-facing policies. Access is intentionally service-role-mediated — all app routes use the service role client, so the RLS enforcement layer is bypassed entirely. Migration 065 documents this explicitly: *"Keep new foundation tables service-role/API mediated until product routes are built."* The standalone Team workspace has now shipped and this pattern is confirmed correct for the current implementation. No RLS failures have been observed.  
**Tables affected:** `team_entitlements`, `team_org_links`, `team_workspace_claims`  
**Recommendation:** These tables must never be queried from a client-side Supabase instance (`createClientComponentClient`, `createServerActionClient`, etc.) — only service role. Before adding any coach portal, team owner, or org admin direct DB access to these tables, write explicit RLS SELECT/INSERT/UPDATE/DELETE policies first and run `/dba` to review them. Pattern reference: migration 071 (lineup tables) shows how to write coach + org admin write policies with `WITH CHECK` clauses.  
**Status:** Advisory — Deliberate design, confirmed correct for current implementation. Flag before any client-side direct DB access is added to these tables.

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
| 17 | `games.game_time` — text in dev, time in prod (sort bug) | High | Migration 076 — dev only (2026-05-24) |
| 18 | `games.bracket_id` — text in dev, uuid in prod | High | Migration 076 — dev only (2026-05-24) |
| 10 | `league_practices` missing from dev | High | Migrations 077+078 — dev+prod (2026-05-24) |
| 11 | Duplicate FK constraints on tournament sub-tables (prod) | Medium | Migration 080 — prod only (2026-05-24) |
| 12 | Duplicate indexes on `org_audit_log` (prod) | Low | Migration 080 — prod only (2026-05-24) |
| 19 | `league_seasons.draft_state` missing from dev | High | Migration 079 — dev only (2026-05-24) |
| 21 | Residual duplicate FK constraints on `games.division_id` and `games.away_team_id` (prod) | Low | Migration 082 — prod only (2026-05-24) |
| 15 | `team_entitlements` dual nullable FKs | Medium | Closed — Incorrect finding (2026-05-24). Migration 065 already enforces NOT NULL on both `org_id` and `rep_team_id`. Schema snapshot was wrong. |
| 16 | `team_org_links` no direct `org_id` — 2-hop | Medium | Accepted Risk (2026-05-24) — `linked_org_id` direct FK covers parent org lookups; team-side lookups are service-role mediated |

---

## Trigger checklist — when to re-run `/dba`

- [ ] Before merging any migration that adds a new table
- [ ] Before the Stripe billing migration ships — billing retention tables ✅ clean; `stripe_prices` ✅ clean; remaining Stripe tables not yet written
- [ ] Before slot-first roster Phase 2 ships
- [ ] Before coaching standalone tables ship
- [x] Findings #17+#18 (`games` type mismatches) — migration 076 applied to dev 2026-05-24 ✅
- [x] Finding #19 (`league_seasons.draft_state`) — migration 079 applied to dev 2026-05-24 ✅
- [x] Finding #10 (`league_practices` dev sync) — migration 077 applied to dev 2026-05-24 ✅
- [x] `league_practices` org_id — migration 078 applied to dev + prod 2026-05-24 ✅
- [x] Findings #11 + #12 (prod constraint + index cleanup) — migration 080 applied to prod 2026-05-24 ✅
- [ ] Quarterly health check (next: 2026-08-01)
