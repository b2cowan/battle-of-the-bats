# Coach Tags & Player Awards — Implementation Plan

**Status:** P1 game-tagging COMMITTED to `dev` 2026-07-10 (bundled commit `f697d31c`; migration 181 since applied to **both dev and prod**, Data Dictionary + snapshots refreshed). Billing/gating drift check run before build: no new plan gate — rides the existing team-entitlement gate the whole rep_* domain already uses.

`/review` (2026-07-10, 3-lens funnel: correctness/regression, security/multi-tenant, data/contract) — **2 confirmed findings, both fixed in-tree:**
1. **High** — editing tags on a recurring `league_game` and saving via "This & future"/"All events" silently discarded the tag edit (the series-scope PATCH branch returned before ever reading `tagIds`, with no error surfaced to the coach). Fixed: the edited occurrence's tags now apply regardless of which scope was chosen, matching the feature's per-occurrence design intent (shared fields still apply series-wide as before).
2. **Low** — deleting a tag returned a false-success `{ok:true}` even on a cross-team/nonexistent id (harmless — the delete was already correctly scoped and a no-op — but inconsistent with the sibling rename route's 404). Fixed: delete now 404s on a no-op, matching rename.

`/docs` synced 2026-07-10: new "Tags" content + 2 FAQs added to the existing game-day-details coaches guide (autocomplete-or-create flow, the rename/merge/delete manager); no stale "(optional)" wording found to correct (help content never quoted literal UI label text).

**The "record vs tag" report — BUILT on `dev` 2026-07-10 (uncommitted).** It was deliberately deferred pending the Lineups/Insights IA redesign, which shipped as **"Insights V3"** (a scoreboard + plain-language findings ladder + question-titled report pages, replacing the card-grid dashboard this report was originally scoped against). Insights V3 carries a binding rule — *"a new report earns a tile; a new metric never does — it lands inside an existing report or as a finding"* — so rather than a new "Tags" tile, the record now lives inside the existing **"How are we doing?"** results report: a tag filter-chip row (reusing the Lineups page's filter-chip idiom) sits above the game table; selecting a tag filters the table and swaps the season basis line for a "vs {tag}: W-L-T, runs for/against" summary. Chips self-hide per-tag at zero finalized games, and the whole row self-hides at zero team tags. Owner approved an interactive HTML mockup before build. A tag-based **finding** ("You're 6-1 in games tagged Rivalry") is a plausible smaller follow-on once tags see real usage — not built, would need a new per-tag input shape + an explicit new ladder slot per the findings engine's admission test.

`/review` (2026-07-10, standard 2-lens funnel: correctness/logic, regression/UX-edge-case) — **1 confirmed Medium finding, fixed in-tree:** the per-tag runs-for/against total summed every filtered game's score including ones with a result but no score entered, silently folding them in as 0–0 rather than excluding them — divergent from this same page's own `scored` filter, already used for the "close games" stat, which guards against exactly this. Fixed: the tag total now filters to games with both scores present first, matching that precedent. One Low/advisory note accepted with no change (the tag-filter bar's `aria-label` reads "Filter by tag" vs. the Lineups page's "Filter games" on the same shared chip-bar pattern — each is contextually accurate for its own page, not a real inconsistency).

`/docs` synced 2026-07-10: added a new FAQ on the results report ("Can I see my record against just the games I tagged?") + a one-line cross-reference from the original tagging FAQ pointing coaches to this report once they've tagged a few games.
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
- **Report:** the "How are we doing?" Insights results report gains a tag filter-chip row (per tag: game count on the chip; selecting one filters the game table and shows W-L-T + RF/RA above it) with tap-through built in (the table row IS the filtered list). Self-hides per-chip at zero finalized games for that tag, and hides the whole row at zero team tags. Re-scoped from the original "own section" idea to fit Insights V3's tile-cap rule (new metric → existing report, not a new tile). **[x] DONE** (`app/[orgSlug]/coaches/teams/[teamId]/history/results/page.tsx`, 2026-07-10, uncommitted — owner approved an interactive mockup first).
- **API:** team-scoped tag CRUD (`/tags`, `/tags/[tagId]`) + merge endpoint (`/tags/merge`); events GET returns the team's tag library + an event→tags map; events POST/PATCH accept an optional `tagIds` array (validated against the team's library, replace-on-save). **[x] DONE** — the results report above is the first consumer of the events GET's `tags`/`tagsByEventId` fields.

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
