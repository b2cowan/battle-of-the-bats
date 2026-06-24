# Club Repackaging (Capacity Bands + Whole-Staff Portals) — Implementation Plan

> **Status:** ✅ **COMPLETE — LIVE on prod 2026-06-24** (migs 144/145/146 applied; live Stripe prices wired for both bands). Post-launch 13-agent verification done (core solid); the two deferred items — operator custom-cap UI + the transfer/un-archive cap guards — shipped to `dev` (commit `1bbb891`), pending the next prod promotion. **ARCHIVED 2026-06-24.** See **Build status** below.
> **Created:** 2026-06-22
> **Branch:** dev
> **Source of truth:** `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-06-22 ratified decisions)

## Build status (2026-06-22, dev / local-unpushed)

**Done + typecheck-clean:**
- **Phase 1** — `club_large` plan key + `teamLimit` across the typed plan maps; Club repriced $219/$2,190; `PLAN_RANK` consolidated (3 copies → 1); migration **144** (widen `plan_gating` + `platform_plan_module_entitlements` CHECKs + seed `club_large`) applied dev.
- **Phase 2** — per-team "$19/team" meter fully retired: charge sites + `lib/stripe-sync.ts` (deleted) + `billing-preview` route (deleted) + the org_team_addon billing-takeover flow (both link routes return 410, takeover UI removed) + the "save by upgrading" nudge. team-org-billing.ts + webhook arms left inert with RETIRING notes (0 live subs).
- **Phase 3** — migration **145** (`organizations.team_limit`) applied dev; `Organization.teamLimit` (effective) wired through all 3 org mappers; **capacity enforced at rep-team create** (blocks the cap+1 team with an upgrade/contact-us prompt); customer-facing "X of N teams" readout on the rep-teams page.
- **Phase 3.5** — operator-console sweep complete: `club_large` added to every hardcoded plan list/label/order + all 4 API write-path allowlists; retired add-on rows marked "(Retired)" in internal price views; **custom-cap backend** (org plan PATCH accepts `teamLimit` → writes `organizations.team_limit`, audit-logged).
- **Docs** — `PLAN_PRICING_FACTS.md` + `DATA_DICTIONARY.md` (team_limit, CHECK widenings, rep_team_subscription_item_id retiring) updated; dev+prod snapshots refreshed (watermark #145, dictionary coverage OK).

**Owner steps (not auto-done):**
- Apply migs **144 + 145 + 146 to prod** (`apply-migration-api.mjs --prod`) before promoting code to master. *(146 = the Club · Association Stripe price slots — added 2026-06-23 when the price-entry UI showed "no slots"; the UI edits seeded rows, it can't create them.)*
- Create Stripe **live** products/prices for repriced `club` + new `club_large` (monthly/annual, sandbox + live) and insert `stripe_prices` rows.
- The gating flip to `live` stays owned by the Early-Access Readiness plan (Phase 5).

**Deferred (small follow-ups; flagged, not blocking):**
- **Phase 3.5-C/D UI widgets** — the custom-cap **input field** + "X of N teams" readout in the platform-admin org-detail page. The *backend* is complete (API + column + effective-limit), so a >30 custom cap is fully settable via the org plan PATCH today; only the convenience UI on the 1900-line `OrgDetailClient` is deferred.
- **Cap check on the team-org link / ownership-transfer path** — enforcement is on the common self-serve rep-team-create path; the rare, platform-assisted "transfer an external team into the club" path does not yet re-check the cap. *(The /review-fixed ownership-transfer module check now correctly recognises `club_large` — transfers INTO a club_large org work; only the cap re-check is deferred.)*
- **Stale custom-cap on a Stripe-driven plan change** *(from /review; cannot trigger today)* — the Stripe webhook + mock-apply write `plan_id` + `tournament_limit` but not `team_limit`, so a per-org custom cap override would survive a plan change (e.g. a club_large org with a 40-team override downgrading to Club would keep 40 instead of 15). **Cannot occur in the current state** (Club is early-access = no self-serve plan changes; zero custom-cap overrides exist). Fast-follow: clear `team_limit` when the webhook changes `plan_id`. For now, the operator re-sets the cap when changing a custom-cap org's plan.
- **Phase 4 (/marketing copy)** — customer-facing pricing cards/comparison/`/for-clubs` + coach-bridge rewrite; interim in-app billing copy is in place.

## Goal

Replace Club's "$179 flat + $19/team-beyond-3" structure with **two flat capacity bands** whose price includes the **whole coaching staff's** Premium portals — retiring the per-team meter entirely. One product serves a 5-team club and a 30-team association; all team types (rep, select, development) count equally toward the band; the standalone $29 Coaches Portal is untouched. This is a single unit of work spanning four ratified decisions (band structure, meter retirement, reprice, no-select-discount).

## PM Brief
See `CLUB_REPACKAGING_PM_BRIEF.md` (paired). Summary:
- **What changes for the buyer:** Club is priced in two predictable bands by club size — **Club** (up to 15 teams, ~$219/mo) and **Club Large / Association** (15–30 teams, ~$379/mo; custom above 30). Every coach on staff gets the full Premium portal at no per-team charge. The "$19 per extra team" line disappears.
- **Why:** ~85–90% of Club buyers run more than 3 teams (median ~10), so the old structure quietly inflated the real price to ~$270–350 and taxed the coach adoption that drives in-org stickiness.
- **Who benefits:** Club-tier orgs (clubs + associations) and their coaching staff. No change to Tournament / Tournament Plus / League / standalone Coaches Portal buyers.

## Current-state facts (grounded in code, 2026-06-22)

- `lib/plan-config.ts` `PLAN_CONFIG` is the single source for plan price/limits/gating. `club` = $179 / $1,790, `gatingStatus: 'early_access'`, no team-count concept. There is **no `teamLimit` field** today.
- The "extra team" charge is a **separate per-team Stripe subscription**, `plan_id = 'org_team_addon'`, implemented in `lib/team-org-billing.ts` via `team_org_links` + `team_workspaces.billing_mode = 'org_team_addon'` + `team_entitlements (source='org_team_addon')`. Retiring the meter = decoupling team entitlement from this per-team charge for Club orgs.
- A rep-team's paid access derives from `team_entitlements` (sources: `team_plan` standalone $29, `org_team_addon` $19). Under the new model, a Club org must entitle its rep-team workspaces **up to the band cap** by virtue of the org's Club subscription.
- `OrgPlan` type lives in `lib/types.ts`; Stripe price IDs live in the `stripe_prices` table keyed by `plan_id` + `billing_cycle` + `environment` (`lib/stripe-prices.ts`).
- **Platform-admin hardcodes the plan set in several internal-operator surfaces** (org list filter/labels, Plans & Pricing workspace, Stripe Prices view, change-requests labels, the plan-gating + per-plan-limit override APIs, and a shared `PLAN_ORDER`). The org plan-set dropdown and org-detail plan badge are already `PLAN_CONFIG`-driven and pick up a new band for free; the rest need the new band added to render/filter/select it and to keep the retired per-team meter from lingering in internal pricing views. See Phase 3.5.
- **DBA review outcome (2026-06-22, Finding #26 in `DB_ARCHITECTURE_REVIEW.md`):** verify-zero **confirmed against live dev+prod** — prod is greenfield (0 Club orgs, 0 rep_teams, 0 `org_team_addon`), so **no data migration / no grandfather risk**. Two access concepts already coexist: a Club org's **own** rep teams are entitled by the plan-tier module `module_rep_teams` (read-time, **no per-team rows**), while `team_entitlements` gates only the standalone Coaches Portal product. `club_included` is **already** a valid enum in the live CHECK constraints (mig 065) and is used by the ownership-transfer path (mig 067). **Binding seam:** enforce the cap as a **write-time gate**; do NOT materialize per-team entitlement rows for org-owned teams. **Migration count (corrected by the debt scan 2026-06-22):** adding `club_large` needs **three small additive migrations** — widen the `plan_gating` and `platform_plan_module_entitlements` CHECK constraints (both live-verified locked to the 5 plans in dev+prod) + seed rows (Phase 1), and the nullable `organizations.team_limit` column (Phase 3.5-D). (`organizations.plan_id` / `stripe_prices.plan_id` carry no CHECK; those two platform tables do.) My earlier "zero migrations for Phases 1–2" was an undercount — corrected in `DB_ARCHITECTURE_REVIEW.md` Finding #26.
- **Naming reconciliation (no code change):** `PLAN_CONFIG.league.label = 'League Plus'` is **correct** — the $89 paid house-league tier *is* "League Plus" per the ratified **2026-06-22 League naming decision** (`BUSINESS_DECISIONS.md`), which explicitly supersedes the earlier "League Plus is a typo → rename to League" framing. The free "League" floor is a *separate* held tier (internal `free_floor='league_starter'`). **Do not change the `league` label.** Earlier drafts of this plan carried a "League Plus → League" label fix in the copy phase — that was based on superseded framing and is **removed** below. (Drift reconciled to `PLAN_PRICING_FACTS.md`; no `/strategy` escalation needed — the Facts doc already reflects the ratified name.)

## Architectural Decisions

- **D1 — Second band = new plan key `club_large`** (not a sub-field on `club`). **Rationale:** Stripe prices, gating, checkout, and entitlement all key off `plan_id`/`OrgPlan` already; a sibling plan reuses every existing path and keeps `club` semantics intact. Both bands share identical `moduleEntitlements`; they differ only in `teamLimit` and price.
- **D2 — Add `teamLimit` to `PlanConfig`.** `club` = 15, `club_large` = 30, all others = effectively unlimited (9999). Enforce at rep-team provisioning/link time. **Rationale:** capacity is now a first-class plan property, mirroring `tournamentLimit`.
- **D3 — Club entitles its teams; retire `org_team_addon` as the funding mechanism.** A Club/`club_large` org grants Premium entitlement to all its rep-team workspaces up to `teamLimit` via the org subscription — no per-team Stripe charge. Keep the team↔org **visibility** plumbing; remove the **billing takeover/charge** path for Club orgs. **Rationale:** this is the literal meaning of "whole staff included."
- **D4 — Reprice + new Stripe prices.** `club` → $219 / $2,190; new `club_large` → $379 / $3,790 (≈ 2 months free, consistent with the annual convention). `/billing` owns Stripe product/price creation + `stripe_prices` rows (dev + live). The flat-$179 founding lock is **dormant** (no founding $179 clubs exist) — no grandfather path to build.
- **D5 — "Custom above 30" = manual quote + platform-admin override for V1**, not a third self-serve price. **Rationale:** above-30 associations are low-volume and want a conversation anyway; a stored per-org team-cap override covers it.

## Phases

### Phase 1 — Pricing model + config (no customer exposure; both bands stay early-access)
- [ ] Add `club_large` to `OrgPlan` (`lib/types.ts`) — shared module, triggers dev-server restart.
- [ ] Add `teamLimit` to `PlanConfig` and set per-plan values; add `club_large` entry to `PLAN_CONFIG` (`lib/plan-config.ts`).
- [ ] Reprice `club` to 219 / 2190 in `PLAN_CONFIG`.
- [ ] **MIGRATION (corrected by debt scan 2026-06-22 — two CHECK constraints reject `club_large`):** widen `plan_gating_plan_key_check` (`plan_gating.plan_key`) AND `platform_plan_module_entitlements_plan_check` (`platform_plan_module_entitlements.plan_id`) to include `'club_large'` (DROP + ADD the explicitly-named constraints; both currently locked to the 5 plans in **dev AND prod**, verified live). Seed `plan_gating('club_large','early_access')` and the 7 `club_large` module rows (mirror `club`). Without this, the feature-matrix publish path errors and the gating toggle silently no-ops for the new band. **Same unit of work:** `DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev+prod).
- [ ] **Consolidate `PLAN_RANK` (debt scan):** `lib/plan-features.ts` exports the canonical rank, but `app/api/billing/webhook/route.ts` and `app/api/billing/mock-apply/route.ts` keep private copies. Make both import the canonical one and add `club_large` (rank above `club`). Leaving copies un-synced silently breaks up/downgrade detection (`undefined < number` → false).
- [ ] **Handoff → /billing:** create Stripe products/prices for repriced `club` + new `club_large` (monthly/annual, sandbox + live); insert `stripe_prices` rows. Verify `getStripePriceId` resolves both.
- [ ] Typecheck (shared-type change) + focused lint.

### Phase 2 — Entitlement decoupling (retire the per-team meter)
- [ ] Define the Club→team entitlement rule: an org on `club`/`club_large` entitles its active rep-team workspaces up to `teamLimit` (extend the org loaders / `lib/module-entitlements.ts` / team-entitlement resolution).
- [ ] Decommission the `org_team_addon` charge path for Club orgs in `lib/team-org-billing.ts` (keep visibility links; billing takeover becomes "included").
- [ ] **Old "$19/team beyond 3" meter removal (debt scan found these beyond team-org-billing.ts — must all go together):**
  - [ ] `lib/stripe-sync.ts` `syncRepTeamBilling` — computes `quantity = max(0, activeCount - 3)` rep-team Stripe items; retire (and its callers in rep-team create / program-year status routes — touch in Phase 3).
  - [ ] `app/api/admin/rep-teams/billing-preview/route.ts` — hardcodes the same `- 3` threshold; delete or repurpose to show cap utilization. **Audit + retire its customer-facing caller (the team-creation billing-preview modal)** so the UI doesn't call a removed endpoint.
  - [ ] `shouldShowClubValueNudge` (+ its 3 call sites) — fires at "3+ org-billed teams, lower extra-team pricing"; copy is now false. Retire or rewrite to the included-up-to-cap framing.
  - [ ] `organizations.rep_team_subscription_item_id` usages (`lib/db.ts`, `lib/stripe-sync.ts`) + the `rep_team` Stripe price rows — vestigial; mark "retiring" in the dictionary, no new writes.
  - [ ] Two `org_team_addon` webhook arms (`app/api/billing/webhook/route.ts`) + the mock branch in `startOrgTeamAddonCheckout` — add `// RETIRING` notes; safe to leave inert (0 live subs) and remove post-cutover.
- [ ] **Runbook (→ /billing + /dba):** identify any live `org_team_addon` subscriptions (**confirmed 0 dev+prod 2026-06-22** — no migration), so this is code removal only. **No silent data loss.**
- [ ] **Migration check:** per-plan `teamLimit` (15/30/unlimited) is **plan-config only — no DB change** (mirrors `tournamentLimit`). The only optional schema change is the per-org custom cap for ">30" (Phase 3.5-D). **DBA ruling (Finding #26): use a nullable `organizations.team_limit` column — NOT `org_overrides`.** If added → **same unit of work: update `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev+prod)**; `check:dictionary` gates it.

### Phase 3 — Capacity enforcement + band UX
- [ ] Enforce `teamLimit` when a Club org creates/links the (cap+1)th rep-team workspace: block + prompt "upgrade to Club Large / Association" (or "contact us" at >30). Locate at rep-team provisioning + team-org link approval.
- [ ] Admin-facing band/usage indicator ("X of 15 teams").
- [ ] **Handoff → /design** for the upgrade-prompt + usage surfaces if non-trivial.

### Phase 3.5 — Platform-Admin operator surfaces (internal tooling; no customer exposure)

Goal: the new band is fully visible/selectable in the operator console, the retired per-team meter is cleaned out of internal pricing views, and operators can see team usage + lift the cap for >30 clubs. None of this is customer-facing. Grounded in a platform-admin sweep (2026-06-22).

**A — "Show the new band everywhere" sweep (mechanical; add `club_large` to hardcoded plan sets):**
- [ ] Orgs list plan filter + label map (`app/platform-admin/orgs/OrgsClient.tsx` — `PLANS`, `PLAN_LABELS`; also feeds CSV/XLSX export).
- [ ] Plans & Pricing workspace (`app/platform-admin/plans-pricing/PlansPricingClient.tsx` — `PLAN_ORDER`, `PLAN_META`, `PRICE_PLAN_LABELS`, `PRICE_PLAN_ORDER`; feature-matrix draft iterates `PLAN_ORDER`).
- [ ] Stripe Prices view (`app/platform-admin/stripe-prices/StripePricesClient.tsx` — `PLAN_LABELS`, `PLAN_ORDER`).
- [ ] Change-requests label map (`app/platform-admin/change-requests/ChangeRequestsClient.tsx` — `PLAN_LABELS`).
- [ ] Plan-gating toggle allowlist (`app/api/platform-admin/plan-gating/route.ts` — `validKeys`).
- [ ] Per-plan limit-override allowlist (`app/api/platform-admin/plan-config/route.ts` — `VALID_PLANS`).
- [ ] Shared `PLAN_ORDER` (`lib/plan-module-entitlements.ts`).
- [ ] **Additional lib + API plan-key lists the debt scan found (the original ~9 was an undercount — these would silently drop/reject `club_large`):**
  - [ ] `lib/billing-retention.ts` (`PLAN_ORDER` — `normalizePlan` returns null for unlisted plans → downgrade API **400s** for `club_large` orgs), `lib/plan-config-db.ts`, `lib/plan-gating-server.ts` (`ALL_PLANS`), `lib/platform-metrics.ts`.
  - [ ] API write-path allowlists that **reject or silently strip** `club_large`: `app/api/platform-admin/product-catalog/change-requests/route.ts` (two copies), `app/api/platform-admin/product-catalog/campaigns/route.ts` (Set filter), `app/platform-admin/bulk-operations/BulkOperationsClient.tsx` (`PLANS` + `PLAN_LABELS`).
  - [ ] Customer/admin display maps: `app/[orgSlug]/admin/org/billing/page.tsx` (`PLAN_META_COPY` — `Record<OrgPlan,…>`, will compile-error until `club_large` added — useful guard), onboarding + mock-portal plan lists.
- [ ] Dead-page hygiene: `app/platform-admin/plans/PlansClient.tsx` (redirected; update its `PLAN_META`/`ORDER` or leave a note).
- [ ] **Already free** (no change, `PLAN_CONFIG`-driven; verify in browser): org plan-set dropdown + API validation (`app/api/platform-admin/orgs/[id]/plan/route.ts`), org-detail plan badge.

**B — Retire the per-team meter from internal pricing views:**
- [ ] Remove/retire `org_team_addon` from the Stripe-prices + Plans & Pricing surfaces (label maps, order arrays, the `selectedPlanId === 'club'` add-on-group splicing, `ADDON_CATALOG_KEY_BY_PRICE_PLAN`). **Decision (Open Q below):** hard-remove vs. retain rows marked "Retired" for historical legibility.

**C — Team-usage visibility (net-new):**
- [ ] Add a rep-team-count vs. `teamLimit` readout to the org-detail Account Snapshot (mirrors the existing tournament-count vs. `tournamentLimit`).
- [ ] Add an over-cap **attention item** so operators see when an org exceeds its band cap.

**D — Custom team-cap override (net-new; the ">30" path from D5):**
- [ ] **Revised per DBA Finding #26 — use a nullable `organizations.team_limit integer` column (NOT `org_overrides`).** Rationale: `org_overrides.type` CHECK would need a DROP+ADD anyway, and its grant reader is inert by default + only handles `module_addon`/`subscription_status`, so a `team_cap` type would never be read without a bespoke reader. `organizations.tournament_limit` is the proven per-org capacity-override pattern — mirror it.
- [ ] Add `getEffectiveTeamLimit(planId, storedLimit)` mirroring `getEffectiveTournamentLimit`; effective cap = `organizations.team_limit ?? plan.teamLimit`. Platform-admin sets `team_limit` for a >30 org via the org plan form (same place it sets `tournament_limit`).
- [ ] **Same unit of work (this is the one migration in the build):** `ALTER TABLE organizations ADD COLUMN team_limit integer` (nullable; null = plan default) → update `docs/agents/db/DATA_DICTIONARY.md` (document next to `tournament_limit`) + `npm run refresh:snapshots` (dev+prod); `check:dictionary` gates it.

### Phase 4 — Copy + pricing surfaces (handoff, not built here)
- [ ] **Handoff → /marketing:** Club card (banded, whole-staff included), comparison table (remove the per-team add-on row, add the band row), `/for-clubs` "what you pay," the coach pricing-bridge rewrite, and the `BRAND_STRATEGY.md` §7 tier table. Apply the already-approved Club-band copy in `docs/agents/brand/PRICING_PAGE_COPY.md` (2026-06-22 amendment).
- [ ] **Note — do NOT touch the "League Plus" label.** It is correct per the ratified League naming decision (see Naming reconciliation in Current-state facts). The earlier "League Plus → League" item is removed.

### Phase 5 — Go-live coordination
- [ ] Gating flip (`gatingStatus` → `live`) is **owned by the League + Club Early-Access Readiness plan** — do not flip here. This plan ends "ready to price"; that plan decides "ready to sell."

## Open Questions
- [x] ~~Confirm rep-team data has no excluded "select/development" subtype~~ — **RESOLVED (DBA Finding #26):** `rep_teams` has no team-subtype/billing-class column (`division` is free text, `group_id` is display grouping only). All rep teams count equally; cap count = `rep_teams WHERE org_id=? AND is_archived=false`. `league_teams` / tournament `teams` are different modules and must not count.
- [ ] Mid-cycle band changes (club ⇄ club_large): proration + upgrade/downgrade path — **/billing** to define.
- [ ] `club_large` annual = $3,790 — confirm with /strategy before Stripe price creation.
- [x] ~~Verify live `org_team_addon` subscriber count before Phase 2 cutover.~~ — **RESOLVED 2026-06-22:** confirmed **0** in dev AND prod (all three carrier columns). Prod is greenfield (0 Club orgs, 0 rep_teams). No cutover migration.
- [ ] **Phase 3.5-B:** when retiring `org_team_addon` from internal pricing views, hard-remove vs. retain rows marked "Retired"? Recommend **retain + mark Retired** so historical price rows / any legacy records stay legible to operators.
- [x] ~~**Phase 3.5-D:** org_overrides vs new column?~~ — **RESOLVED (DBA Finding #26):** use a nullable `organizations.team_limit` column (mirrors `tournament_limit`); do NOT reuse `org_overrides`. (One of **three** small migrations — see corrected Phase 1.)

## Debt scan (2026-06-22) — log-later backlog (NOT this build)

A focused, adversarially-verified debt scan of the blast radius ran 2026-06-22 (51 findings; 18 folded into the phases above, 33 logged here). The fold-now items are captured inline in Phases 1/2/3.5 above. The genuinely separate cleanups, deliberately **out of scope** for this build:

- **[Structural — the maintainability headline] Centralize the ~15+ scattered plan-key lists/labels/orders/ranks.** Adding any future plan currently means editing ~15 hand-maintained copies (`PLAN_ORDER`/`PLAN_RANK`/`PLANS`/`PLAN_LABELS`/`PLAN_META` across `lib/` + platform-admin). Derive them from `PLAN_CONFIG` (+ a client-safe label helper, + import the canonical `PLAN_ORDER`/`PLAN_RANK`). This is the duplication that makes the area brittle. **This build ADDS `club_large` to all of them (required); this item is the deeper de-duplication refactor** — a standalone, separately-tested pass. **Owner decision pending:** do it as part of this build vs. a dedicated follow-up.
- Minor display drift (low priority): `'league'` label shows `'League'` on the plans-pricing admin page vs. `'League Plus'` everywhere else (do NOT change the canonical label — fix the local copy); `'team'` plan = `'Coaches Portal'` in config but `'Team'` in operator UIs (add a clarifying note); dead `PlansClient.tsx` constants; `EARLY_ACCESS_PLAN_LABELS` gaps.
- `organizations.plan_id` has **no DB CHECK** (app-layer `isOrgPlan` is the only guard) — optional hardening migration, not required.
- Dormant `entitlement-grants` pipeline (off by default): add a UI signpost on the `comp_period` override + verify an `org_overrides(org_id, revoked_at)` index exists **before** `ENTITLEMENT_GRANTS_ENABLED` is ever turned on. Unrelated to this build; the team cap correctly does NOT use this system.
- Minor hot-path nit: `getCoachingAssignmentsForUser` re-fetches `account_kind`/`plan_id` already held by the caller — quick standalone perf fix.
