# Coach Premium — Automatic Retry for a Partial Data Migration (scoping)

**Status:** ✅ BUILT on `dev` (2026-06-22), adversarially reviewed, gates green; NOT pushed. Parent: [COACH_PREMIUM_UPGRADE_FLOW_PLAN.md](COACH_PREMIUM_UPGRADE_FLOW_PLAN.md) · PM brief: [COACH_PREMIUM_MIGRATION_RETRY_PM_BRIEF.md](COACH_PREMIUM_MIGRATION_RETRY_PM_BRIEF.md).

**Build:** all four owner-approved defaults shipped — auto-retry on overview load (cap 3) + manual "Try again" button; provenance tags on roster + schedule (mig **143**, dev-applied ⚠ prod-pending) with partial-unique indexes; fees idempotent via the existing per-player key. The copy was rewritten to **reconcile to full state** each run (idempotent: fills only what's missing, converges to `ok:true`). A 4-lens adversarial review (money/dues · idempotency · concurrency · auth) was folded in — two Criticals fixed (silent paid-state failure → now surfaced + retried; orphan-schedule detection + re-create + paid_at re-stamp on the reconcile path). Accepted non-blockers (rare, self-healing, no data corruption): non-atomic retry-count under a two-tab race; a coach-pre-created dues schedule shadows that player's fee count; any assigned coach (not just head) can press "Try again". Owner browser-test on dev pending.

---

## Problem

When a free coach upgrades, we copy their roster/schedule/fees into the new Premium season **synchronously at provisioning**, best-effort + per-entity resilient (never throws out of the payment path). If a step hits a transient error, that entity's `failed` count is non-zero, the stored summary is `ok:false`, and the overview banner says *"some items hit a problem — double-check your roster, schedule, and fees."* Today the coach (or support) fixes the gap by hand — **there is no retry**.

We want the system to **automatically re-attempt the failed parts** so a transient hiccup self-heals, without the coach noticing — and crucially **without duplicating** what already landed.

## Why a naive retry is unsafe today (the crux)

The migration runs **exactly once** (an atomic claim on the free team's workspace link), and migrated rows carry **no link back to the free-team row they came from**. So a blind re-run would:
- **Duplicate the roster** — roster rows have no uniqueness and no source link; every player would be copied again.
- **Duplicate the schedule** — events are a single all-or-nothing bulk insert (so they're either fully there or not at all — the one *safe-to-redo* case), but still have no source link.
- **Partially collide on fees** — dues are one schedule per player with a uniqueness guard, so a re-run would error per player rather than duplicate, but a player whose schedule landed with **incomplete installments** stays broken (the guard blocks re-creating it).
- **Lose the player mapping** — the old→new player map is built in memory during the run and discarded, yet the fee copy depends on it.

So **safe retry needs per-entity idempotency** (the property the parent plan called out): a way to know what already landed and copy only what's missing, never clobbering coach edits.

## What retry should — and should not — do

**In scope (re-attempt):** only the entities with a non-zero **`failed`** count (transient errors). Fill the gaps idempotently.

**Out of scope (never touch):**
- Intentionally **`skipped`** items — $0 fees, fees with no/unmapped player, blank-guardian players surfaced for review. These are by-design non-migrations; retry must not "fix" them.
- **Coach edits** — anything the coach already changed/added in Premium after upgrade. Retry fills gaps; it never overwrites.
- **New free-team data added after upgrade** — the free team becomes read-only history at upgrade; the migration is a point-in-time snapshot, not an ongoing sync.

## Design

### A. Idempotency enabler — row-level provenance (the load-bearing decision)

Add a nullable "where this came from" reference to migrated rows so a (re)run can skip what's already there and rebuild the player map:
- **Roster — required.** A `source` reference to the free-team player. This both prevents duplicate players and lets a repair rebuild the old→new player map (which the fee copy needs).
- **Schedule — recommended (low-risk).** Events are all-or-nothing, so a redo is already safe when 0 landed; a source reference makes it robust and consistent.
- **Fees — not strictly needed.** The existing one-schedule-per-player uniqueness *is* the idempotency key once the player map is stable; the repair upserts each player's dues (ensures the schedule + its installments match) rather than blindly inserting.

Rejected alternatives: **delete-partial-and-redo** (can't tell migrated rows from coach edits → would destroy fixes) and **name/DOB heuristic matching** (fragile with duplicate/edited names). A lighter no-migration variant — store the old→new id map inside the summary JSON — works but is more fragile and bloats the summary; provenance columns are cleaner, queryable, durable, and unlock future re-sync/repair scenarios.

> **Timing is ideal:** the Premium gate isn't open in production yet, so there are **zero existing prod upgrades to back-fill** — adding provenance now means **every** real upgrade is retry-safe from day one. (Pre-provenance partials, of which there are none in prod, simply wouldn't be auto-retryable.)

### B. The repair routine

A single, idempotent "fill the gaps" pass that:
1. Loads the free team (still linked via the workspace) and the current Premium season.
2. Rebuilds the old→new player map from existing provenance.
3. For each entity with prior failures: copies only the missing rows (skip-if-source-exists for roster/events; upsert-by-player for dues, repairing incomplete installment sets).
4. Re-uses the existing best-effort, never-throw, per-entity-resilient style; updates the stored summary (new counts + `retryCount` + `lastRetryAt`).
- **Single-flight:** guarded so two concurrent triggers can't both run (reuse the atomic-claim/lock pattern already used for the first migration).

### C. Trigger — automatic, bounded, with a manual fallback

- **Automatic (primary):** when the coach opens the Premium overview and the stored summary is `ok:false`, unacknowledged, not currently running, and under the attempt cap, the overview kicks the repair server-side (non-blocking, like the banner's own fetch). The banner then reflects the new state ("we finished bringing the rest over" or the residual "couldn't bring over X").
- **Bounded:** cap automatic attempts (recommend **3**) so a genuinely-stuck item doesn't thrash on every page load. After the cap, the banner switches to a final "we couldn't bring over X — add it manually / contact support."
- **Manual fallback:** a **"Try again now"** button on the banner so the coach can force a retry regardless of the auto-cap.

This satisfies "automatic retry" while staying safe (idempotent + single-flight + bounded) and keeping a human escape hatch.

## Effort & shape (estimate)

| Piece | Size |
|---|---|
| Migration: nullable provenance column(s) (roster required; schedule optional) — dev-only | S |
| Stamp provenance in the existing copy path | S |
| Make the copy idempotent (skip-if-source / dues upsert) + rebuild map from provenance | M |
| Repair entrypoint (re-run + single-flight guard + bounded attempts + summary update) | M |
| Trigger + banner ("Try again now" + post-retry messaging + final-give-up state) | S–M |
| Adversarial `/review` (money/dues + idempotency = high-risk) | — |

**Rough total: ~2–4 days.** Small–medium. One dev-only migration (joins the prod-pending set; must be applied to prod before the retry code ships — standard discipline).

## Risks

- **Idempotency bugs duplicate roster/fees** — the exact failure we're preventing. The provenance guard is essential; this change must go through adversarial review with a money/dues lens.
- **Auto-run on page load** — needs the single-flight guard (concurrent tabs) and non-blocking execution (no overview latency hit); the attempt cap prevents thrash.
- **Persistent (non-transient) failures** — retry won't fix a genuinely bad row; the bounded cap + final manual-guidance state is the backstop so the coach isn't left in a silent loop.

## Open decisions for the owner

1. **Trigger:** automatic-on-load **plus** a manual "Try again" button (recommended), vs. manual-only, vs. automatic-only.
2. **Attempt cap** before giving up and showing manual guidance (recommend **3**).
3. **Provenance scope:** roster-only (minimum), or roster + schedule + fees (recommended for consistency/robustness).
4. **Confirm** adding the provenance column(s) now, pre-launch, so every future upgrade is retry-safe with no back-fill.
