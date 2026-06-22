# Club Repackaging (Capacity Bands + Whole-Staff Portals) — Implementation Plan

> **Status:** Planning
> **Created:** 2026-06-22
> **Branch:** dev
> **Source of truth:** `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-06-22 ratified decisions)

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
- **Incidental drift to fix here:** `PLAN_CONFIG.league.label` is `'League Plus'` — canonical name is **League**. Strategy flagged this; fold the label fix into the copy phase.

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
- [ ] **Handoff → /billing:** create Stripe products/prices for repriced `club` + new `club_large` (monthly/annual, sandbox + live); insert `stripe_prices` rows. Verify `getStripePriceId` resolves both.
- [ ] Typecheck (shared-type change) + focused lint.

### Phase 2 — Entitlement decoupling (retire the per-team meter)
- [ ] Define the Club→team entitlement rule: an org on `club`/`club_large` entitles its active rep-team workspaces up to `teamLimit` (extend the org loaders / `lib/module-entitlements.ts` / team-entitlement resolution).
- [ ] Decommission the `org_team_addon` charge path for Club orgs in `lib/team-org-billing.ts` (keep visibility links; billing takeover becomes "included").
- [ ] **Runbook (→ /billing + /dba):** identify any live `org_team_addon` subscriptions (expected ~0), cancel + fold into Club without losing team access. **No silent data loss.**
- [ ] **Migration check:** if a stored per-org team-cap override is needed for "custom >30," add it (reuse `org_overrides` pattern) → **same unit of work: update `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev+prod)**. If derivable from plan config alone, no migration.

### Phase 3 — Capacity enforcement + band UX
- [ ] Enforce `teamLimit` when a Club org creates/links the (cap+1)th rep-team workspace: block + prompt "upgrade to Club Large / Association" (or "contact us" at >30). Locate at rep-team provisioning + team-org link approval.
- [ ] Admin-facing band/usage indicator ("X of 15 teams").
- [ ] **Handoff → /design** for the upgrade-prompt + usage surfaces if non-trivial.

### Phase 4 — Copy + pricing surfaces (handoff, not built here)
- [ ] **Handoff → /marketing:** Club card (banded, whole-staff included), comparison table (remove the per-team add-on row, add the band row), `/for-clubs` "what you pay," the coach pricing-bridge rewrite, the `BRAND_STRATEGY.md` §7 tier table, and the **"League Plus" → "League"** label fix (incl. `PLAN_CONFIG.league.label`).

### Phase 5 — Go-live coordination
- [ ] Gating flip (`gatingStatus` → `live`) is **owned by the League + Club Early-Access Readiness plan** — do not flip here. This plan ends "ready to price"; that plan decides "ready to sell."

## Open Questions
- [ ] Confirm rep-team data has no excluded "select/development" subtype — all team levels must count toward `teamLimit` (verify there's no team-level/type field that would slip teams past the cap).
- [ ] Mid-cycle band changes (club ⇄ club_large): proration + upgrade/downgrade path — **/billing** to define.
- [ ] `club_large` annual = $3,790 — confirm with /strategy before Stripe price creation.
- [ ] Verify live `org_team_addon` subscriber count before Phase 2 cutover.
