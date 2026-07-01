# Coaches Portal Tryouts & Evaluation — Phase 2B.4: One-Click Accept-to-Roster + Fee Setup — Implementation Plan

> **Status:** ✅ BUILT on `dev` 2026-07-01 (uncommitted) — all phases done; adversarial `/review` folded in (4 fixes); gates green; mig 169 dev-applied/prod-pending; dev-server restart + owner browser-test pending. OQ1/OQ3/OQ4/OQ5 resolved (see Open Questions).
> **Created:** 2026-07-01
> **Branch:** dev
> **Parent:** docs/projects/active/COACHES_PORTAL_TRYOUTS_EVAL_PHASE2B_PLAN.md (2B.4)
> **Predecessors BUILT + committed:** 2B.1/2B.2 (`91c0f1ae`), 2B.3 (`47f52d38`)

## Goal
Turn an accepted tryout applicant into a fully set-up roster player in one confirm: carry over the identity/guardian data already on file, optionally apply the team's standard fee schedule so the player lands with dues ready, and do the whole thing **atomically** (roster row + status + dues, all-or-nothing). This also **hardens the pre-existing admin accept**, which today runs as two separate writes that can half-complete. Delivered on both surfaces: the **standalone head coach** finalizes in the Premium Coaches Portal; the **club admin** finalizes in the org Rep Teams area — sharing one atomic accept path.

## PM Brief
See `COACHES_PORTAL_TRYOUTS_EVAL_PHASE2B4_PM_BRIEF.md` (paired). One-line: accept becomes "add them + set their fees" in one atomic step, instead of a bare roster row plus separate manual dues entry.

## What the code investigation found (grounding — verified 2026-07-01)
- **Accept is ADMIN-ONLY today.** `acceptTryoutAndAddToRoster` (`lib/db.ts:4464`) runs **two sequential, non-transactional writes**: insert `rep_roster_players` (`source='tryout'`, links `tryout_registration_id`), then set `rep_tryout_registrations.status='accepted'`. If the 2nd fails, the roster row exists but the status is stale. **No idempotency guard inside the function** — the only guard is the admin route's `VALID_TRANSITIONS` (`offered → accepted` only; `accepted → accepted` is 422).
- **Accept copies only identity + guardian** (name/DOB/guardian). `player_number`, `primary_position`, `jersey_size`, medical, emergency contact are left NULL — even though `createRepRosterPlayer` already accepts those params.
- **Accepting creates NO dues today.** Dues are set up separately via the coach dues page (`POST /api/coaches/[orgSlug]/teams/[teamId]/dues` → `upsertRepPlayerDuesSchedule`, `lib/db.ts:6501`), which create/updates `rep_player_dues_schedules` (header, `total_amount numeric(10,2)`) + replaces `rep_player_dues_installments` (dated obligations). **Amounts are dollars, not cents. Dues are a ledger of what's owed — NO card charge** (marking paid just writes an income ledger entry).
- **⚠ There is NO fee-template anywhere in the schema** — no per-team/per-program-year default dues amount or installment plan. `rep_cost_allocations`/`rep_allocation_splits` are org-admin *team-budget* splitting, not per-player dues. So "apply the team's standard fee schedule" **has nothing to read from today** — this is the key net-new (see OQ1). Closest existing pattern: `budget-plan/generate-installments` (bulk per-player schedule from a shared installment plan) and season-rollover (carries prior-year schedules forward).
- **Atomicity convention = Tier-2 Postgres RPC.** Integrity-critical multi-table writes use a `plpgsql` function in a migration called via `supabaseAdmin.rpc()` — `create_accounting_transfer` (mig 016), `complete_team_workspace_ownership_transfer` (mig 067), `claim_next_slot` (mig 043). Lower-stakes flows use sequential awaits + best-effort compensating delete (season-rollover deletes an orphan schedule if installments fail). Accept-with-money is integrity-critical → RPC.

## Architectural Decisions
- **Decision: Atomic accept via a new Postgres RPC.** **Rationale:** a half-complete accept (roster row w/ stale status, or roster+status w/o dues, or dues w/o roster) is an unrecoverable integrity problem involving money; the codebase's established convention for exactly this is a `plpgsql` function (Tier-2). One function does roster-insert + status-update + optional dues-schedule + installments in a single transaction. This simultaneously fixes the pre-existing non-transactional admin accept.
- **Decision (RATIFIED 2026-07-01 — OQ1): No new fee-template table in V1; derive the "standard" from the team's prevailing dues.** **Rationale:** no default exists today, and teams bill everyone the same amount, so the team's most-common existing player schedule IS the de-facto standard. Deriving it (then pre-filling an editable drawer) delivers "apply the standard fee schedule" with zero schema churn and no plan-gate implications. Fallbacks: the team's budget-plan installment structure; else a blank/manual schedule. An explicit stored template is a clean future upgrade if owners want it.
- **Decision (Proposed): Fees are a TOGGLE.** A coach/admin can accept a player onto the roster **without** attaching fees (fees added later on the existing dues page). Default: toggle ON when a standard can be derived, OFF when it can't.
- **Decision: Dues record what's owed only — no automatic card charge** (consistent with all existing dues).
- **Decision: One shared atomic accept path, two entry surfaces.** The admin route is upgraded to pass roster fields + optional dues; a net-new coach-scoped endpoint calls the same RPC/helper. No duplicated accept logic.

## Phases

### Phase 1 — Atomic accept foundation + admin fee setup
- [ ] **Migration (first task): `supabase/migrations/169_accept_tryout_atomic.sql`** — `create or replace function accept_tryout_and_create_dues(p_reg_id uuid, p_roster jsonb, p_dues jsonb)` that, in one transaction: (a) re-reads the registration `FOR UPDATE` and asserts `status = 'offered'` (raise on violation → maps to a 409/422); (b) inserts `rep_roster_players` (identity/guardian from the registration + optional `player_number`/`primary_position`/`jersey_size` from `p_roster`, `source='tryout'`, `tryout_registration_id=p_reg_id`); (c) `update rep_tryout_registrations set status='accepted'`; (d) if `p_dues is not null`, insert `rep_player_dues_schedules` + N `rep_player_dues_installments`. Returns the new `player_id` + registration. Model on `create_accounting_transfer` (mig 016) / ownership-transfer (mig 067). Idempotent-safe via the `FOR UPDATE` + status assertion.
- [ ] **Schema=dictionary same unit of work:** function-only migration adds **no new columns/tables** → `check:dictionary` unaffected, but run `npm run refresh:snapshots` (dev+prod) and note the new function in the DB architecture log; apply mig 169 to **dev** (`node scripts/apply-migration-api.mjs …`), keep prod-pending with 164–168.
- [ ] **Refactor `acceptTryoutAndAddToRoster` (`lib/db.ts`) to call the RPC** with `p_dues = null` by default — fixes the existing non-transactional gap for the current admin accept with **zero behavior change** when no dues are supplied. Add an `acceptTryoutWithDues(...)` variant (or an optional dues arg) for the new flow.
- [ ] **Derive-standard-schedule helper** (`lib/tryout-fees.ts` or similar): given `programYearId`/`teamId`, return a suggested `{ totalAmount, installments: [{ number, amount, dueDate }] } | null` from the team's **prevailing** roster dues (the most-common `total_amount` + installment plan), else the budget-plan installment structure, else `null`. Pure read; no writes.
- [ ] **Admin accept route** (`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/[regId]/route.ts`): accept optional roster fields + optional dues (`{ roster?, dues? }`) in the PATCH body for the `accepted` transition; call the upgraded accept; keep the fire-and-forget welcome email. Owner/admin + `module_rep_teams` gate unchanged.
- [ ] **Admin accept drawer UI** (org Rep Teams applicant page slide-over): replace the one-shot "Accept → Add to Roster" button with a drawer — pre-fill identity/guardian (read-only), optional jersey/position/number inputs, a **fees toggle** + editable derived schedule (total + installment rows preview), confirm → atomic accept. Reuse existing dues input patterns from the coach dues page.

### Phase 2 — Coach-portal accept
- [ ] **New coach-scoped accept endpoint** (`app/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions/accept/route.ts` or a POST action on the decisions route): assigned-coach + active-program-year + IDOR (registration in this program year) + `status='offered'` guard; calls the same RPC + derive-standard helper. Fee-setup access per **OQ3**.
- [ ] **Coach accept drawer on the decision board** (`TryoutDecisionBoard`): offered candidates get an **"Accept → add to roster"** affordance opening the drawer (same shape as admin). On success the candidate flips to the board's existing read-only **"Accepted"** chip and leaves the decidable set.
- [ ] **Mobile field-side drawer** — ≥44px targets, safe-area, one-column; consistent with the 2A/2B check-in + scoring styling. (`/design` direction if the drawer is non-trivial.)

### Phase 3 — Docs + verify + review
- [ ] **Help docs** (`/docs`): extend the coaches tryout recipe + the admin rep-teams guide with the accept-to-roster + fees step (both surfaces); searchable keywords (accept, roster, fees, dues, add to team).
- [ ] **Verify gate:** `typecheck` (shared modules + RPC contract) · `lint:focused` · `check:org-context` · `check:tokens` · `check:dictionary` · `check:migrations` (169 prod-pending expected).
- [ ] **Adversarial `/review`** (high-risk: money + auth + new atomic write + two surfaces) → apply confirmed fixes → **commit** as the 2B.4 checkpoint.

## Build order
P1 (RPC + admin — also hardens the existing accept) → P2 (coach surface) → P3 (docs/review/commit). P1 delivers value + the reliability fix on its own; P2 adds the coach-portal entry.

## Relationship to 2B.5
2B.4 builds the **internal finalize machinery**. 2B.5's guardian-facing offer email + token accept/decline response page will call **this same accept endpoint/RPC** when a family accepts an offer — so the accept path must be reusable by a token-authenticated (no-account) caller, not only a logged-in coach/admin. Keep the RPC caller-agnostic; the endpoint auth wraps it.

## Open Questions (ratify before / during build)
- [x] **OQ1 (KEY) — where the "standard fee schedule" comes from.** ✅ **RATIFIED 2026-07-01: derive from the team's prevailing player dues** (no new schema; budget-plan total as an undated fallback hint; else blank). Built in `lib/tryout-fees.ts:deriveStandardDuesSchedule`.
- [x] **OQ2 — atomicity approach.** ✅ **Tier-2 `plpgsql` RPC** (`accept_tryout_and_create_dues`, mig 169) — matches `create_accounting_transfer`/`complete_team_workspace_ownership_transfer`.
- [x] **OQ3 — club-team accept + fee rights.** ✅ **Assigned coach can accept AND set fees** — mirrors the coach dues page (any assigned coach can POST dues today); no extra gate beyond team assignment. Consistent across standalone + club.
- [x] **OQ4 — gate.** ✅ **No new gate key** — roster + dues already Premium; confirmed against `PLAN_PRICING_FACTS.md` (Premium Coaches Portal + Club include it). Coach route lives inside the Premium portal.
- [x] **OQ5 — pre-fill scope.** ✅ Identity/DOB/guardian **pre-fill (read-only)**; number/position/jersey size are **optional blank inputs** in the drawer.

## Guardrails honored
- **Schema=dictionary same unit of work** + refresh snapshots (function-only mig → no column change, but snapshots refreshed + noted).
- **No new plan-gate key** without `/billing` + Facts doc (OQ4 — expected no change).
- **PIPEDA:** minors' data stays coach/admin-facing; no new family-facing exposure (2B.5 owns family email). Dues records don't expose scores.
- **Mobile field-side** usability for the coach drawer.
- **Migrations** applied to dev, kept prod-pending, promoted with the rest of the tryout initiative at release.
