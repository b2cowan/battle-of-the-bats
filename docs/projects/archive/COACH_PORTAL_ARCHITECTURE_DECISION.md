# Decision Record — Free vs Paid Coaches Portal: keep separate models (do NOT unify onto shared tables now)

**Date:** 2026-06-19 · **Status:** DECIDED (owner-confirmed) · **Decision type:** architecture / data model

**Context:** During the Coach Premium Upgrade project, the owner asked whether the free and paid Coaches Portals should share one set of tables and gate functionality by tier — the way Tournament (free) and Tournament Plus do — instead of two separate data models that require a data **migration** on upgrade. The hypothesis: shared-tables + tier-gating is more efficient and simpler to maintain. Evaluated 2026-06-19 via a 9-agent investigation (both portals' real architecture, the tournament precedent, both directions' cost) with three independent adversarial reviews.

## Decision
**Keep the current two-model design and finish the upgrade flow (parity + per-upgrade data migration). Do NOT unify now.** Keep unification as a **deliberate future option** to revisit as the free base grows; do not foreclose it. Enforce **"Premium ≥ Free" on every new free-tier feature** so the gap stops widening.

## Why (grounded findings)
- **The tournament analogy is structurally invalid.** Tournament free → Plus is two entitlement levels on the **same** organization row, sharing all tables — upgrade is a one-column flag flip, nothing moves. The free **Basic** Coaches Portal is deliberately **org-less** (no org/tenant, no subscription; a free team = 2 inserts, instant) while Premium is a full org-scoped, season-spined workspace (~9 rows across 6 tables to provision). There is **no shared account row to flip** — which is exactly why the upgrade must move data. (The free **League** tier *is* done the tournament way, because an org already exists there.)
- **Unifying would tax the wrong cohort.** It would force every free coach (most never pay) through the heavy account setup the free tier exists to avoid, to spare the minority who upgrade a one-time data move.
- **Unifying is XL + risky and doesn't remove migration.** Either make the tenant key nullable across ~14 tables + rewrite ~28 access policies (high cross-tenant-leak risk), or provision an account per free coach (tenant sprawl). Either way a **one-time backfill** of existing free teams is still required — unification changes *when* migration runs, not *whether*.
- **The drift tax is real but bounded + planned.** Confirmed instances: cancelled-events (closed, mig 135) and announcements (Phase 3b, next). The "Premium ≥ Free" principle closes each gap before migration runs.

## Adversarial review outcome
All three skeptics (pro-unify, pro-status-quo, pragmatist) independently concluded **the tactical call stands (ship the migration on the current model)**. Refinements they surfaced are folded into the build plan below. The pro-unification lens's fair point: the **lighter "account-per-free-coach" variant** is cheaper than the worst-case refactor and gets more attractive over time — hence "keep as a future option," not "rule out."

## Revisit conditions (when to reconsider unification)
- The free coach base grows large enough that dual-maintenance + per-upgrade migration cost clearly exceeds the one-time "account-per-free-coach" refactor; OR
- Premium feature velocity makes "build it twice / reconcile on upgrade" the dominant cost; OR
- A second carry-over trigger (e.g. the org-join import path, currently unbuilt) forces a third migration variant.

## Build refinements folded into the Coach Premium Upgrade plan (from the review)
1. **Announcements (3b) is effectively on the critical path** — the free coaches most likely to upgrade are the ones using announcements; their data can't fully carry over until Premium has announcements. Build 3b **before** Phase 4 (owner-confirmed).
2. **Idempotency must be race-safe at the DB level** — both Stripe events reach the provisioner; a plain app-layer "not yet upgraded" check has a partial-failure / concurrent-fire window. Gate with a DB-atomic guard before any migration writes.
3. **"Accept incomplete records" (3c) must land in prod BEFORE Phase 4 runs in prod** — else migrated players with missing guardian info hit not-null violations; audit dues-reminder null-safety in the same change.
4. **Partial-failure repair path** — webhook-safe (never throw) must not leave a coach in a half-populated portal with no retry; add detection + a re-run/repair path.
5. **Multi-year free data collapses into one synthetic first season** — surface this in the post-upgrade "check these" summary (semantic loss, not data loss).

## Out of scope of this decision
Whole-account multi-team unification; the org-join import carry-over path (separately tracked, currently an unbuilt/false public promise to fix or qualify).
