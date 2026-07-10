# Coach Tags & Player Awards — Implementation Plan

**Status:** P1 game-tagging BUILT on `dev` 2026-07-09 (uncommitted). Migration 181 (`rep_team_tags` + `rep_team_event_tags` + `merge_rep_team_tags` RPC) applied to **dev only**, Data Dictionary + snapshots refreshed in the same unit of work. Billing/gating drift check run before build: no new plan gate — rides the existing team-entitlement gate the whole rep_* domain already uses. The Season Review "vs tag" report sub-item is **deliberately deferred**: the Lineups/Insights IA redesign (see `COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md`) is also BUILT-but-uncommitted on `dev` right now, and wiring a new Insights section into that page before it's owner-tested + committed would blend two features into one diff. Build the report once Insights lands. Pending: owner browser test of tagging → `/review` → `/docs` → commit.
**Scope:** Premium Coaches Portal (rep_* domain). Sport-neutral by construction (all vocabulary is coach-defined free text).

## Owner decisions (locked 2026-07-09)
1. **Ownership:** tag libraries + award lists are **per-team**, with a later **org-promote** path (org admin can promote a team tag/award to org-wide for League/Club standardization).
2. **Permissions follow capabilities:** game tags require schedule access, money tags require money-write, awards require roster/schedule access; head coach always can. No head-coach-only creation lock.
3. **Awards are internal-only V1** (coach portal surfaces only). Public/parent-facing celebration deferred pending a consent-for-minors conversation.
4. **First shippable slice = game tags + the "record vs tag" report** (proves the tag → report loop end-to-end).

## Design principles
- **Two animals, not one:** *tags* are labels for grouping (games, expenses); *awards* are records (player + award + game/tournament + date). One shared library/curation pattern under the hood; never a generic "custom properties on everything" editor (that's the stacked-junk-drawer disease in data-model form).
- **Invisible until used:** entry points are contextual (a quiet tag affordance on the game/expense edit surface, a "give award" moment post-game). No new nav. Value surfaces in reports (Season Review / Insights hub, money reports).
- **Curation over creation:** rename + **merge** tooling ships in P1 (tag drift — "Top teams" vs "top in province" — is how these systems rot; merging must re-point history). Sane per-kind cap (~50) keeps libraries curated.
- **Insights-hub alignment:** game-tag analytics belong to the planned Insights hub (see COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN §Insights); this project supplies its first differentiated dataset, it does not build a new destination.

## Phases

### P1 — Game tags + "vs tag" report (first slice)
- **Data (migration 181, dev-only):**
  - `rep_team_tags` — id, org_id, team_id (nullable later for org-promoted), kind (`game` | `expense`), name (≤40 chars), created_by, timestamps. UNIQUE (team_id, kind, lower(name)). RLS mirrors `rep_team_lineup_templates` (mig 159): org members read, coaches on assigned teams + org admins write.
  - `rep_team_event_tags` — event_id FK → rep_team_events, tag_id FK → rep_team_tags, composite PK (no id/org_id/team_id — RLS reaches scope through tag_id, mirroring mig 071's `rep_team_lineup_entries` EXISTS pattern).
  - `merge_rep_team_tags(winner, loser)` — `SECURITY DEFINER` Postgres function (first atomic-merge precedent in the codebase, modeled on mig 169's `accept_tryout_and_create_dues`): re-points every event-tag link from loser→winner then deletes the loser, guarded same-team/same-kind. **[x] DONE.**
- **UI:** tag chips on the game edit/detail surface (schedule event form) with autocomplete-or-create (type to filter existing tags, Enter or click to toggle, "+ Create" when no match); a Tags manager modal (rename / merge / delete) reachable via a "Manage tags" link on the same surface. Capability: `capabilities.schedule` gates both applying and managing (no new capability). Read-only tag chips also show on the game detail slide-over. **[x] DONE.**
- **Report:** Season Review gains a "Performance vs tags" section — per tag: W-L-T record, RF/RA, game count, tap-through to the filtered game list. Self-hides with zero tags (honest empty state teaches the feature once). **[ ] DEFERRED** — holding until the in-flight Lineups/Insights IA redesign is owner-verified + committed (see plan status header above), so this doesn't land in the same uncommitted diff as that rework.
- **API:** team-scoped tag CRUD (`/tags`, `/tags/[tagId]`) + merge endpoint (`/tags/merge`); events GET returns the team's tag library + an event→tags map; events POST/PATCH accept an optional `tagIds` array (validated against the team's library, replace-on-save). **[x] DONE** except the season-review aggregation extension (deferred with the report above).

### P2 — Player awards
- **Data:** `rep_team_award_types` (team library: name ≤40, optional emoji/icon, sort) + `rep_player_awards` (player_id, award_type_id, event_id nullable, tournament label nullable, awarded_at, note ≤200, created_by). Deleting an award type keeps history (soft-retire).
- **UI:** "Give an award" moment on the game detail / post-game surface (pick player + award, seeded starter list: MVP, Best Hitter, Hustle Award — editable); player profile section ("2× MVP"); Season Review awards leaderboard. Internal-only (no public surfaces).
- **Capability:** roster/schedule access.

### P3 — Money tags + org promotion
- Expense tags (kind `expense`) applied in the Add/Edit expense flow; expense list + Budget vs. Actual gain filter/group-by-tag. (Note: the "subcategory" ask is largely served today by the existing Category → Item taxonomy incl. coach-created custom items — money tags are the lowest-marginal-value slice, hence last.)
- **Org promotion:** org admin promotes a team tag/award type to org-wide (team_id NULL, org_id set); teams see merged library; org-level cross-team rollups become possible later.

## Guardrails / open items before build
- Gating: bundled in Premium core (no new plan gate) — **confirmed 2026-07-09** via the `/billing` drift check: rep_* tag/event data rides the existing team-entitlement gate (`getTeamScopedRepTeamAccess` / active `team_entitlements`) the whole Coaches Portal already uses, matching how Lineups/Money/Attendance are gated (no per-feature `FEATURE_MIN_PLAN` entry). No `PLAN_PRICING_FACTS.md` change needed.
- PIPEDA: awards attach to minors' names but remain inside the team workspace (same posture as roster data). Any future public surface requires the consent conversation first (logged as deferred).
- Caps: 50 tags per kind per team, 30 award types per team (soft, raise if real usage demands).
- Concurrency: tag merge must be atomic (single RPC or transaction) — re-point links + delete loser.

## Related
- COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md (Insights hub destination for P1's report)
- COACH_MONEY_HUB_REDESIGN_PLAN.md (money surfaces P3 touches)
