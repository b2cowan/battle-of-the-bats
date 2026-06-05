# Timed Entitlement Grants — Implementation Plan

**Status:** **Scenario B + A1 slice BUILT 2026-06-04** (behind the `ENTITLEMENT_GRANTS_ENABLED` env flag, default OFF). /dba (#22–24) + /billing reviews complete and folded in. H8 follow-up from the [Platform Admin UX Evaluation](PLATFORM_ADMIN_UX_EVAL.md) §7; see the [PM brief](TIMED_ENTITLEMENTS_PM_BRIEF.md).

## Build status (2026-06-04)

**Shipped (lint + typecheck clean):**
- **Migration 109** `org_overrides_timed_grants.sql` — adds `target jsonb`, `starts_at`, `suppress_billing`; widens `type` CHECK to add `module_addon`/`plan_tier`; partial index `idx_org_overrides_org_active`. ⚠️ **Must be applied to dev before the overrides UI is used** — the overrides POST now writes the new columns, so creating *any* override before the migration breaks.
- **`lib/entitlement-grants.ts`** — `isOverrideActive`, pure `computeEffectiveEntitlements` (module_addon → effective addons; subscription_status → effective status, newest active wins), and `applyEntitlementGrants(org)` gated by `ENTITLEMENT_GRANTS_ENABLED` (default off; non-public env var so always false in the browser).
- **Loaders wired** (all behind the flag): `api-auth.getAuthContext` (covers WithRole/WithScope), `server-organizations.getOrganizationBySlugForServer`, `db.ts` `getOrganizationBySlug` + `getOrganizationByUserId`.
- **Admin surface:** overrides API accepts `module_addon` (validated `target.addons` against the 4 reserved modules) + `starts_at`/`suppress_billing`; `OrgDetailClient` Active Overrides form gains a **Module Trial (timed)** type with module checkboxes, and the active list shows module labels + a **"reverts {date} (Nd left)"** countdown.

**Deferred (next slices):**
- `plan_tier` grants (effective plan-rank for `hasPlanFeature` — see Phase 2) — schema-valid but the overrides POST **blocks** creating them until enforcement lands.
- Scenario **A2** (Stripe `pause_collection` for comping an active paid subscriber).
- `comp_period` stays billing-only (founding season), ignored for access.
- Optimize the loader fetch to a PostgREST embed (currently a guarded separate query when the flag is on — DBA #23).
- Unit tests for `computeEffectiveEntitlements` when a test runner is added.

**Enable checklist:** apply migration 109 to dev → `node scripts/refresh-db-schema.mjs` → restart dev server (new file + shared-module changes) → set `ENTITLEMENT_GRANTS_ENABLED=true` → verify a module grant unlocks then auto-reverts past expiry.

## Context

**The problem (verified in code, eval §7).** Platform staff can *record* comps/overrides, but the request-time entitlement layer never reads them: access is gated directly off `organizations.subscription_status` and `organizations.enabled_addons` via [hasModuleEntitlement()](../../../lib/module-entitlements.ts) and the four org loaders ([api-auth.ts](../../../lib/api-auth.ts), [server-organizations.ts](../../../lib/server-organizations.ts), [user-contexts.ts](../../../lib/user-contexts.ts), [db.ts](../../../lib/db.ts)). `org_overrides` is consumed only by founding-season logic, dashboard metrics, and the override UI. Module add-ons have **no expiry** and **nothing auto-reverts** — expiry just raises a manual "revoke or extend" alert.

**Two business needs:**
- **A — Extended free comp:** give an org free access until a set date, then resume normal billing.
- **B — Tier/add-on trial on a paid base:** a Tournament Plus customer trials League for a window while still paying for Tournament Plus; if they don't convert, access **auto-reverts to Tournament Plus only**.

**Goal:** a timed-entitlement-grant model the entitlement layer honors, so access turns on for a window and **reverts automatically at expiry** — with billing coordination for the "free comp" case.

## Locked decisions (from H8 triage 2026-06-04)
- **Ship Scenario B first** (access-only, request-time, no cron/Stripe).
- **New `platform_entitlement_grants` table** (don't overload `org_overrides`).
- **Request-time enforcement** — the entitlement layer merges active, non-expired grants; revert is automatic.
- **Scenario A billing** → prefer **Stripe-native** trial/pause-resume over building an app cron.

## Phase 1 — Data model

> **DBA review 2026-06-04 (DB_ARCHITECTURE_REVIEW.md #22–24): extend `org_overrides`, do NOT create a new table.** It already is the endorsed time-bounded override pattern, founding-season comps already live in it (so no migration/dual-read question), and a new `*_entitlement_grants` table would collide with the existing `team_entitlements`. Decision adopted below.

**Migration (next available number; current highest is 107):** additive, backward-compatible changes to **`org_overrides`**:
- Add `target jsonb` — e.g. `{"addons":["module_house_league"]}`, `{"plan":"league"}`, `{"status":"active"}`. (New grant types use this; legacy `subscription_status` rows keep using the existing `value` column.)
- Add `starts_at timestamptz NOT NULL DEFAULT now()` (supports scheduled-future grants; default = active now).
- Add `suppress_billing boolean NOT NULL DEFAULT false` (Scenario A — see Phase 4 / Finding #24 for how this relates to existing `organizations.billing_suspended_at`).
- **Widen the `type` CHECK** to add `module_addon` and `plan_tier` (drop + re-add the explicitly-named constraint; existing `subscription_status`/`comp_period` rows unaffected).
- Add partial index `idx_org_overrides_org_active ON org_overrides(org_id) WHERE revoked_at IS NULL`.
- Reads stay **service-role only** (org_overrides has no client RLS today — keep comp reasons off the customer surface).

Semantics:
- **Active override** ≡ `revoked_at IS NULL AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())`.
- **Revert is implicit:** when an override stops being active, effective entitlement falls back to the org's base plan/addons — no explicit revert target needed.
- **Founding season: no migration, no dual-read.** Founding `comp_period` rows already live in `org_overrides`; the entitlement layer reads the one table and ignores `comp_period` for *module access* (founding comp is a billing concern, not an access grant).

## Phase 2 — Enforcement (request-time) — the high-risk core

Add `lib/entitlement-grants.ts`:
- `getActiveEntitlementGrants(orgId)` → active grants.
- `computeEffectiveEntitlements(baseOrg, grants)` → `{ enabledAddons, subscriptionStatus }` (and, where modeled, extra modules).

Wire it into the org loaders so the `Organization` object reflects effective entitlements:
- **B (module_addon):** `effectiveAddons = union(org.enabledAddons, active module grants)`. [hasModuleEntitlement()](../../../lib/module-entitlements.ts) already checks `enabledAddons`, so feeding it the effective set is enough.
- **B (plan_tier trial):** ⚠️ **Billing review 2026-06-04 — there are TWO gating systems, and a tier trial must satisfy both:**
  1. **Module entitlements** ([hasModuleEntitlement()](../../../lib/module-entitlements.ts)) — reads `org.enabledAddons` (reserved modules: house_league, rep_teams, accounting, public_site).
  2. **Plan-rank features** ([hasPlanFeature()](../../../lib/plan-features.ts)) — reads `PLAN_RANK[plan_id]` (auto_schedule, exports, fan_score_alerts, etc.).
  Modeling "try League" as *delta modules only* unlocks the modules but **NOT** the rank-gated features. So a tier grant (`target:{"plan":"league"}`) must compute an **effective plan rank** consumed by `hasPlanFeature`. Keep this **separate from the billed `organizations.plan_id`** (which stays the base tier) — e.g. expose `org.effectivePlanId = max(basePlan, active plan grants)` for gating while `org.planId` remains what they're billed. Decide whether the trial also raises plan-derived **limits** (`tournament_limit`/`seat_limit`) — recommend yes for a true trial, scoped to the grant window.
- **A (comp/status):** effective `subscriptionStatus` forced (e.g. `active`/`trialing`) while a grant is active; `suppress_billing` handled in Phase 4.

**Performance (hot path) — DBA decision 2026-06-04 (#23): use a PostgREST embed, NOT a denormalized flag.** The loaders already use nested selects (e.g. [user-contexts.ts](../../../lib/user-contexts.ts) does `organizations(...)`), so embed `org_overrides(type,value,target,starts_at,expires_at,revoked_at)` on the org select and filter "active" in JS (per-org row count is tiny). One round-trip, always correct, no drift. A `has_active_grants` flag was rejected (expiry fires no write → stale flag; and during founding season most orgs already have an override row, so a flag saves nothing). Only revisit a cached flag if profiling shows the embed is a measurable cost. **Order-of-operations:** compute effective `subscriptionStatus` (status grants) *before* `hasModuleEntitlement()`'s `=== 'canceled'` guard, or a status grant on a canceled org won't apply.

**Auto-revert:** falls out of the "active grant" predicate (`expires_at > now`). **No cron needed for access.**

**Rollout:** put the grant-merge behind a feature flag; add unit tests on `computeEffectiveEntitlements` before enabling, since this touches every authenticated request.

## Phase 3 — Admin UI (completes Scenario B)

- In [OrgDetailClient.tsx](../../../app/platform-admin/orgs/[id]/OrgDetailClient.tsx) (Billing & Access or Entitlements tab): a **"Timed grants / trials"** section — create a grant (type, target, expiry, reason, `suppress_billing`), list active grants **with a countdown** ("reverts in 12 days"), and revoke. Reuse the existing override form + confirm-modal patterns.
- New API: `app/api/platform-admin/orgs/[id]/grants/route.ts` (GET/POST) + `[grantId]/route.ts` (DELETE). Gate by `manage_billing` and/or `manage_product` depending on `grant_type`; audit-log via [platform-audit](../../../lib/platform-audit.ts). Mirror [overrides/route.ts](../../../app/api/platform-admin/orgs/[id]/overrides/route.ts).

**→ Phases 1–3 deliver Scenario B in full: time-boxed add-on/tier trials that auto-revert, no external dependencies.**

## Phase 4 — Scenario A billing — **billing review 2026-06-04**

> **Correction:** Stripe is **already built** — Phases A–F complete (checkout, full-lifecycle webhook, portal, billing UI, per-team billing). Only **Phase G (live-account cutover)** remains. So Scenario A's Stripe work can be built/tested in sandbox now; only live charging waits on Phase G. (The plan previously said "Stripe not built" — incorrect.)

**Scenario A splits in two by whether an active paid Stripe subscription exists:**
- **A1 — org has NO active paid subscription** (free Tournament tier, or never subscribed; the common comp case). Reuse the proven **founding-season pattern** but via the grant model: grant effective tier access through the override, **leave stored `plan_id` and Stripe fields untouched**, `suppress_billing` is effectively a no-op (nothing to charge). At expiry, access reverts (Scenario B mechanics). **No Stripe call, no cron.** Ships with B.
- **A2 — org HAS an active paid subscription you want to comp temporarily.** Use Stripe **`pause_collection` with `resumes_at`** (auto-resumes billing at the date, keeps the subscription `active`, **no app cron**) — or extend `trial_end` if "trialing" semantics are preferred. The existing webhook already reconciles `customer.subscription.updated`; confirm pause/resume events update `subscription_status`.

### A2 — value assessment & deferral (decision 2026-06-04)

**Deferred.** Worth building eventually, but not now.

- **Value:** A2 is a strong **off-season retention / churn-save** lever for seasonal Canadian sports orgs — *"pause your billing over the off-season, keep all your data, billing resumes in spring."* Also covers goodwill credits after a bad experience and comps during a Club migration/onboarding. Its incremental value over the manual fallback is **in-platform + audit-logged + reasoned + visible on the org + auto-resuming** (governance/UX) — not a net-new capability.
- **Why deferred:** (1) a manual fallback already exists — staff can pause/refund directly via the org detail **"Open Stripe"** link; (2) **there are no subjects yet** — during the 2026 founding season Tournament Plus is comped *in-app with no Stripe subscription*, and live Stripe billing (Phase G) isn't cut over, so the population of active paid Stripe subscribers to pause is ~zero. A2 becomes actionable **only after Phase G + real paying subscribers**, ideally built just ahead of the first off-season churn window. (Can be built shelf-ready in sandbox earlier if desired.)
- **Work when picked up (≈1–2 days, sandbox-testable; no pause helper exists today):**
  1. `lib/` Stripe helpers: `pauseSubscriptionCollection(subId, resumesAt)` → `subscriptions.update(subId, { pause_collection: { behavior: 'void', resumes_at } })`, plus `resumeSubscriptionCollection(subId)` to clear it.
  2. Extend the existing `customer.subscription.updated` webhook handler ([webhook/route.ts](../../../app/api/billing/webhook/route.ts) line ~134) to read `pause_collection` and reflect a "paused until {date}" state (clear on resume).
  3. One source of truth for "paused for comp": Stripe `pause_collection` + an `org_overrides` comp row (`suppress_billing=true`, `expires_at` = resume date). **Do not** reuse `billing_suspended_at` (dunning) — DBA #24.
  4. Admin UI on Billing & Access (only when an active subscription exists): **"Pause billing (comp)"** (date + reason) + **"Resume now"**; show "Billing paused until {date} — resumes automatically." Separate control from Cancel Subscription.
  5. Edge cases: customer cancels or changes plan during the pause; resume date in the past; what the customer sees on their own billing page. Verify with a **Stripe test clock**.
  6. **Dependency:** Phase G (live Stripe cutover) for prod use.

**Billing-state source of truth (DBA #24):** before reusing `organizations.billing_suspended_at`, **confirm its current meaning** (likely dunning/past-due). Do **not** conflate dunning-suspension with comp-suspension. Prefer: derive "comp pause" from the active `suppress_billing` override (A1) or the Stripe subscription state (A2); leave `billing_suspended_at` for its existing purpose unless an audit shows it's generic.

**Invariant safety (migration 050):** "Tournament plan ⇒ `active`, no Stripe subscription" must hold. The grant model satisfies this for free: it computes *effective* plan/entitlement at read time and **never mutates stored `plan_id` or Stripe fields**, so free-tier comps don't trip the invariant. (Contrast the founding-season upgrade, which *does* mutate `plan_id` — that flow predates the grant model and should not be the template here.)

**Cron:** not needed — A1 reverts at read time; A2 resume is Stripe-driven. A daily reconciliation (Phase 5) is optional bookkeeping only.

## Phase 5 — Reconciliation & audit

- Access revert is automatic (Phase 2); billing resume via Stripe (Phase 4).
- Optional daily reconciliation: audit-log expirations, clear stale `has_active_grants` flags, optional internal notice. Cron decision deferred with Notifications Phase F.
- Update the org-detail "expired override" attention semantics for grants (an expired grant has *already* auto-reverted — it's informational, not an action item).

## Files

- **New:** `supabase/migrations/NNN_org_overrides_timed_grants.sql` (ALTER `org_overrides`: add `target`/`starts_at`/`suppress_billing`, widen `type` CHECK, partial index); `lib/entitlement-grants.ts` (active-override fetch + `computeEffectiveEntitlements`). For the admin write surface, **extend the existing [overrides API](../../../app/api/platform-admin/orgs/[id]/overrides/route.ts) + UI** rather than adding parallel `/grants` routes (Phase 3 decision).
- **Changed:** [lib/module-entitlements.ts](../../../lib/module-entitlements.ts), [lib/server-organizations.ts](../../../lib/server-organizations.ts), [lib/db.ts](../../../lib/db.ts), [lib/api-auth.ts](../../../lib/api-auth.ts), [lib/user-contexts.ts](../../../lib/user-contexts.ts) (fetch + apply grants), [OrgDetailClient.tsx](../../../app/platform-admin/orgs/[id]/OrgDetailClient.tsx) (UI), possibly [lib/plan-config.ts](../../../lib/plan-config.ts) (tier→module delta). Phase 4 adds Stripe/billing lib + routes.

## Open decisions / required reviews
- **/dba:** ✅ **Resolved 2026-06-04** (DB_ARCHITECTURE_REVIEW.md #22–24) — extend `org_overrides` (no new table); PostgREST embed on the hot path (no `has_active_grants` flag); founding-season needs no migration/dual-read; reuse `organizations.billing_suspended_at` for Scenario A.
- **/billing:** ✅ **Reviewed 2026-06-04** — Stripe is built (only Phase G remains); Scenario A splits A1 (no sub → reuse founding pattern via grants, no Stripe/cron) vs A2 (`pause_collection`+`resumes_at`, no cron). **Key correctness finding:** there are two gating systems — tier trials must raise an **effective plan rank** for `hasPlanFeature`, not just grant modules (see Phase 2). Don't mutate stored `plan_id` (keeps invariant 050). Audit `billing_suspended_at`'s current meaning before reuse (#24).
- **Stale canon to fix:** the `/billing` agent guide claims an `org_overrides type:'plan'` enforced by `lib/plan-gating-server.ts` — that is **not** true (CHECK is `subscription_status|comp_period`; plan-gating-server only reads the `plan_gating` table). Confirms H8's premise that overrides aren't enforced today; update that guide.
- **Product:** does a tier trial grant only the delta *modules* (recommended), or also the higher tier's limits/seats? Does it ever change what the customer is billed? (No, by design.)

## Verification
- Unit tests for `computeEffectiveEntitlements` (none / active / expired / revoked / multiple grants).
- Entitlement-path test: Tournament Plus org + active League module grant → League modules accessible; past `expires_at` → access gone with **no DB write**.
- Regression: founding-season comp still works; orgs with no grants are unaffected (verify the `has_active_grants` fast path).
- Seed a grant in dev (`/dev-test-org/...`), verify in browser as the customer (module appears, then disappears past expiry).
- `npm run typecheck` + focused lint; **restart dev server after the migration + shared-module changes** before browser testing.

## Sequencing
1. **Scenario B (ship first):** Phase 1 + 2 + 3 — access-only timed trials with auto-revert. No cron, no Stripe.
2. **Scenario A:** Phase 4 + 5 — free comp with billing pause/resume (gated on Stripe + cron decisions).
