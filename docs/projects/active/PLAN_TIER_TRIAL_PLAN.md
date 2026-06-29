# Plan / Tier Trial — Implementation Plan

> **Status:** Planning (Proposed / deferred — NOT scheduled, no build)
> **Created:** 2026-06-29
> **Branch:** dev
> **Strategy origin:** `docs/agents/strategy/BUSINESS_DECISIONS.md` → "2026-06-29 — Plan / Tier Trial capability" (Proposed)
> **Builds on (does NOT duplicate):** `docs/projects/active/TIMED_ENTITLEMENTS_PLAN.md` — the timed-grant engine already exists; this completes its explicitly-deferred `plan_tier` slice.

## Goal
Give a platform operator a way to grant an org a **whole higher plan/tier for a time window**, after which access **auto-reverts** to the org's base plan. Access-only — it never creates or mutates a Stripe subscription. It reuses the existing timed-grant engine (active-window + auto-revert + audit + the Active Overrides surface) rather than introducing a parallel mechanism. This is the build-out of the long-deferred `plan_tier` grant type.

## PM Brief
**What it does:** Lets a platform operator put an org onto a higher plan for a set window (e.g. "give this club League Plus for 14 days"); the org experiences the full higher tier and access automatically drops back to their real plan at expiry. No billing is touched.
**Why it matters:** Operators can only grant one section at a time or force a subscription status today — there's no risk-free, time-boxed "try a whole plan." That's a natural sales/conversion lever for the managed League/Club early-access motion and removes manual cleanup + double-billing risk.
**Who benefits:** Platform operators (sales/support) and the orgs they're courting. No customer self-serve surface. Access-only.
**Expected impact:** Operator grants a tier trial from the same Active Overrides surface; the org sees the higher tier's features for the window; reverts cleanly on expiry with a full audit trail.
**Priority:** Low / deferred (Proposed). Owner relabelled the existing surgical grant for now and deferred this build.
**Success criteria:** Grant "trial League Plus, expires in 14 days" on a Tournament-plan org → org gains League-Plus-gated features immediately → at expiry access reverts to Tournament (no cron) → every step audit-logged → no Stripe object created or modified.

## Background — why this is non-trivial
The existing engine (`lib/entitlement-grants.ts`) folds two grant types onto an org at request time:
- `module_addon` — unions specific sections into `enabledAddons` (the surgical "Feature Access Trial").
- `subscription_status` — forces the effective `subscriptionStatus` for the window.

A **tier trial is different**: it must make the org behave as if it were on a *higher plan* without mutating stored `plan_id`. Plan-gating reads two different things in two systems:
1. **Module/section entitlement** — "does this org have module X?" (derived from the plan's `moduleEntitlements` ∪ `enabledAddons`).
2. **Plan-rank / feature gating** — `hasPlanFeature`-style checks that compare the org's plan *rank* (Tournament < Tournament Plus < League < League Plus < Club < Club · Association) to a feature's minimum tier (e.g. tournament limits, communications workflow, capacity bands).

`module_addon` only covers (1). A real tier trial needs an **effective plan rank** threaded through (2) so the trial tier outranks the base plan for the window — without rewriting `plan_id` (which would desync billing and the operator's plan dropdown). This effective-rank plumbing is the deferred work the original Timed Entitlements plan flagged.

## Phases

### Phase 1 — Effective plan rank (the core enabler)
- [ ] Introduce an **effective plan rank** concept distinct from stored `plan_id`: define/confirm a canonical plan-rank ordering and a single resolver that returns an org's *effective* plan for gating (`lib/entitlement-grants.ts` + the plan-feature gating module, e.g. `lib/plan-features.ts` / `lib/plan-gating-server.ts` / `lib/plan-module-entitlements.ts`).
- [ ] Extend `computeEffectiveEntitlements` to fold an active `plan_tier` grant into the effective plan: take the **higher rank** of (base plan, granted tier) for the window; never lower a plan (a trial only ever raises).
- [ ] Thread effective plan through the gating reads so both module entitlement AND rank-gated features honor the trial tier, while stored `plan_id`, the operator plan dropdown, billing, and limits readouts continue to reflect the **base** plan.
- [ ] Decide + implement how trial-tier interacts with plan-derived **limits** (tournament limit / team caps): does a League-Plus trial lift the tournament cap for the window? (Default recommendation: yes — the trial should feel like the tier; document explicitly.)

### Phase 2 — Grant type plumbing (write + compose)
- [ ] Stop rejecting `plan_tier` in the overrides write route (`app/api/platform-admin/orgs/[id]/overrides/route.ts`); accept it with a target plan + validate the target is a real, higher-ranked plan than the org's base.
- [ ] Define composition rules with the other grant types and document them: a `plan_tier` trial + a `module_addon` grant = union of access; a `subscription_status` grant still independently forces status. Newest-active-wins already governs status; specify tier-trial precedence (recommend: highest active tier wins).
- [ ] Persist the target plan on the override `target` (e.g. `target.plan`) — the column already exists from migration 109; **confirm no new migration is required** (expected: none — `org_overrides.target` is already present). If anything schema-level is needed, that becomes task 1 of this phase + a DATA_DICTIONARY update + `npm run refresh:snapshots`.

### Phase 3 — Operator surface
- [ ] Add a **"Plan / Tier Trial (timed)"** type to the Add Override form (`app/platform-admin/orgs/[id]/OrgDetailClient.tsx`): operator picks a target plan (only higher-ranked plans selectable) + expiry + reason.
- [ ] Render an active tier trial in the **Active Overrides** list with a clear label, the trial tier, and the revert date/countdown (reuse the existing expiry/countdown rendering).
- [ ] Make the org-detail readouts honest: show the base plan as the plan-of-record AND surface "Trialing <tier> until <date>" so the operator isn't confused about why the org has extra access (mirror the existing override clarity copy).
- [ ] Audit-log grant + revoke (the engine already audits; confirm the tier trial carries the target plan into the log).

### Phase 4 — Verification (no test runner exists)
- [ ] Manual verification matrix on localhost (the engine is enabled locally via `ENTITLEMENT_GRANTS_ENABLED`): no trial / active trial raises both module + rank gates / expired trial reverts / revoked trial reverts / trial + section grant compose / trial never touches Stripe.
- [ ] `/review` (high-risk: touches shared gating on every authenticated request) before any prod rollout.
- [ ] Prod rollout is a separate gated `/release` step (Amplify `ENTITLEMENT_GRANTS_ENABLED` flag + the prod `org_overrides` partial index already confirmed present) — out of scope until owner schedules.

## Architectural Decisions
- **Decision:** Reuse the existing timed-grant engine; do NOT build a parallel mechanism. **Rationale:** active-window, auto-revert, audit, and the operator surface already exist and are battle-tested; a tier trial is a new *fold rule*, not a new system.
- **Decision:** A tier trial sets an **effective plan rank**, never mutates stored `plan_id`. **Rationale:** stored `plan_id` drives billing, the operator dropdown, and limits-of-record; mutating it would desync Stripe and the "plan change ≠ billing change" guarantees. The trial is access-only and reversible by simply expiring.
- **Decision:** A trial only ever **raises** the effective plan (max of base, trial). **Rationale:** a "trial" that could lower access is nonsensical and risks accidentally degrading a paying org.
- **Decision:** Access-only — no Stripe object is created or modified. **Rationale:** consistent with all other overrides and with the 2026-06-26 "plan change writes access only" decision; the only Stripe-touching operator control remains Cancel Subscription.

## Open Questions
- [ ] Does a tier trial lift plan-derived **limits** (tournament limit, team caps) for the window, or only feature/module gating? (Recommendation: lift them so the trial is faithful; confirm with owner.)
- [ ] If an org has BOTH a higher base plan and a (lower) tier-trial grant left over, confirm max-rank wins and the trial is a no-op rather than a downgrade.
- [ ] Should the operator be allowed to trial a tier the org could not self-serve purchase yet (e.g. an early-access-only plan)? (Likely yes for sales demos — confirm.)
- [ ] Naming: "Plan / Tier Trial" vs "Plan Trial" vs "Tier Trial" in the operator UI (cosmetic; settle at build).

## Not in scope
- Customer-facing self-serve trials (this is operator-granted only).
- Any Stripe/billing change, proration, or subscription creation.
- The separate in-app paid→paid upgrade-with-proration gap (own strategy entry 2026-06-26).
