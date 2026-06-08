# Architecture Hardening — Implementation Plan

> **Status:** Implementation complete (2026-06-01) — pending dev-server restart + browser verification; not committed
> **Note:** All four phases implemented on `dev`, `tsc --noEmit` clean. Phase 3b was a verified no-op (surfaces already client-side gated). Restart-required handoff (proxy.ts + org layout + shared modules) is outstanding before browser testing.
> **Created:** 2026-06-01
> **Branch:** dev
> **Source:** Full architecture evaluation (findings table, per-dimension health, feature→tier map) — see the evaluation report retained in the session plan file. PM brief below.

## Goal

Convert the architecture evaluation's top-10 findings into staged, verifiable work: fix the one confirmed critical cross-org write, then replace scattered/fallible per-page tier checks with structural boundaries, then improve entitlement UX/maintainability, then clear low-risk hygiene items.

## PM Brief — Architecture Hardening

**What it does:** Closes a confirmed cross-organization data-write hole and tightens the platform's tier boundaries so a paid feature or another org's data can never be reached by a customer who shouldn't have it — structurally, not just by hiding buttons.

**Why it matters:** One verified bug lets an organization owner modify another org's tournament data if they know its IDs. Separately, tournament-tier customers can reach org-level admin/billing screens they were never meant to see. Both undercut the multi-tenant trust model the SaaS billing tiers depend on.

**Who benefits:** Every org (data isolation), tournament-tier customers (correct, non-confusing surface), and the business (entitlement integrity ahead of Stripe go-live). No new plan tier; this is correctness work across all tiers.

**Expected impact:** After this ships, cross-org writes are impossible at the API layer, tournament-tier users are structurally blocked from `/admin/org/`, paid-feature boundaries are enforced at the trust boundary (API) with clear client-side upgrade states, and a few public-site/config hygiene issues are resolved.

**Priority:** High — Phase 1 is a security correctness fix; Phases 2–3 remove the "one missed check = silent hole" fragility before more growth and before billing goes live.

**Success criteria:** (a) A user from Org A cannot create/update/delete/publish any Org B tournament resource — verified by a negative test. (b) A tournament-tier user hitting any `/admin/org/*` URL is redirected to `/admin/tournaments`. (c) Org-level data APIs reject callers without the module entitlement. (d) Free-tier users see upgrade states (not broken forms) on Plus admin pages. (e) No `NEXT_PUBLIC_PLAN_GATES=live` in production.

## Phases

### Phase 1 — Cross-org authorization (focused hotfix + audit) ✅ COMPLETE (2026-06-01, type-check clean)
*Closes findings #1, #2. Owner decision: focused hotfix first.*
- [x] Added shared guard `requireTournamentInOrg(ctx, tournamentId): Promise<Response | null>` to `lib/api-auth.ts`, mirroring the verified-correct check at `app/api/admin/tournaments/[tournamentId]/registrations/bulk/route.ts:208` (fetch `tournaments.org_id`, return `forbidden()` if `!= ctx.org.id`).
- [x] Applied it after `scopeGuard` in the 3 known routes: `schedule-publish` (incl. GET), `divisions` (GET + save/update/set-visibility×2/delete), `communications` (GET + all 5 actions).
- [x] **Audit sweep complete.** Scanned all 25 `scopeGuard` / 29 `getAuthContextWithScope` routes under `app/api/`. **Fixed 6 more** that were `scopeGuard`-only with `supabaseAdmin`/service-role access keyed by client-supplied ids:
  - `app/api/admin/games/route.ts` (GET, POST bulk-save + per-game loop + 2 delete-division branches, PATCH)
  - `app/api/admin/pool-slots/route.ts` (GET + ensure/sync-capacity/assign/unassign/swap/rename)
  - `app/api/admin/teams/route.ts` (GET, promote-from-waitlist, swap-slots, create-team, **+ unconditional org checks on bulk-update and bulk-delete which previously skipped all scope checks for owners**)
  - `app/api/admin/venues/route.ts` (GET + all 11 actions, incl. `update-facility`/`delete-facility` which had **no scope check at all**, and the `import-from-past` source-venue copy)
  - `app/api/admin/tournament-activity/route.ts` (GET cross-org read leak)
  - `app/api/scorekeeper/[orgSlug]/score/route.ts` (POST score submit)
  - **Verified already-safe (no change):** `tournaments/route.ts`, `clone`, `populate-from`, `summary`, `registration-fields` (+`[fieldId]`), `registrations/{bulk,export,payment-reminders,resend-access}`, `tournament-branding`, `tournament-logo`, `tournament-hero-banner`, `send-message`, `seal-tournament`, `tournament-dashboard`, `notification-preferences` (orgSlug-from-tournament + membership gate), `official/[orgSlug]/score` — all scope mutations by `.eq('org_id', ctx.org.id)` or an explicit `org_id` guard.
- [ ] Add a negative regression check (documented manual check at minimum): Org A owner attempting each mutation against an Org B tournament UUID receives 403. *(deferred — recommend a small integration test; needs two seeded orgs)*

### Phase 2 — Structural tier boundary ✅ COMPLETE (2026-06-01, type-check clean) — owner chose layout + proxy.ts
*Closes findings #3, #4, #5, #8.*
- [x] Added server-side tier guard to `app/[orgSlug]/admin/org/layout.tsx` (was an empty pass-through): resolves auth; tournament-tier → `redirect(/{orgSlug}/admin/tournaments)`. Authoritative boundary; fixes org-billing leak (#4).
- [x] Added earliest-possible redirect in `proxy.ts`: for `/[orgSlug]/admin/org/*`, looks up the org's `plan_id` (anon client, public-read RLS) and bounces tournament-tier to `/admin/tournaments` before render.
- [x] Added the League/Club tier gate to `app/api/admin/org/venues/route.ts` (GET + POST), matching the page-level gate. Swept sibling `app/api/admin/org/**`: the rest (onboarding, pdf-settings, founding-season, notification-preferences, request-deletion, startup-tasks, team-links) are org-scoped utilities legitimately available to all tiers — no extra gate needed.
- [x] Made `components/admin/AdminSidebar.tsx` `isOrgAdmin` tier-aware (`&& !isTournamentTier(planId)`) — defense-in-depth behind the layout guard (#8).
- [ ] **Restart-required handoff:** proxy.ts + layout + shared module changes — stop server, `rm -rf .next`, `npm run dev` before browser testing.

### Phase 3 — Entitlement UX & maintainability ✅ COMPLETE (2026-06-01, type-check clean) — owner chose platform-wide migration
*Closes findings #6, #7, #9.*
- [x] Refactored `components/billing/UpgradeGate.tsx` to take a **`feature` key** (+ `label`); minimum plan and copy now resolve from `FEATURE_MIN_PLAN` / `requiresPlanCopy` (single source of truth). **Migration was trivial — the component had ZERO call sites** (only its own def + AgentPlaybook doc strings), so no callers needed updating.
- [x] **Client-side Plus gates — verified already present (no-op, #6 over-reported).** Branding (`canUseAdvancedBranding` + `CompactUpsell`, every advanced section conditionally rendered), cloning (`canClone` + `cloneUpgradeCopy` in sidebar), and custom registration fields / export / payment tools / waitlist (all `hasPlanFeature`-gated in the registrations page) are already gated. Adding `UpgradeGate` on top would be redundant/regressive — left as-is.
- [x] Added `NotifyOptions.requiredFeature?: PlanFeature` to `lib/notify.ts`: when set, `notify()` looks up the org plan and skips the entire dispatch if the feature isn't included — defense-in-depth so a forgetful call site can't leak a Plus notification. Call-site gates remain primary.

### Phase 4 — Hygiene ✅ COMPLETE (2026-06-01, type-check clean)
*Closes findings #10, #11, #12, #13.*
- [x] `.env*` is git-ignored (verified in `.gitignore`), so #10's local-leak risk is covered. **Owner action remaining:** confirm production Amplify env has no `NEXT_PUBLIC_PLAN_GATES=live` before Stripe Phase G — can't be checked from the repo.
- [x] Made founding-season expiry overridable via `NEXT_PUBLIC_FOUNDING_SEASON_END` env var (default still `2027-01-01`) in `lib/plan-config.ts` — interim so the date changes via Amplify config, not a code PR. A platform-admin-editable setting remains the eventual home (deferred — needs schema + admin UI).
- [x] Public-site consistency: added `!org.isPublic` + canceled-subscription 404 gates to `app/[orgSlug]/league/page.tsx`, mirroring the org home page. The `results`→`standings` route (#13) is an intentional backward-compat redirect, not dead code — left as-is. The "all public pages hidden" admin warning is deferred as a minor UX nicety.

## Architectural Decisions
- **Fix #1 with a focused hotfix to the 3 known routes first, then audit the class.** Rationale: owner decision — stop the confirmed bleed immediately; the shared helper makes the subsequent audit a mechanical apply.
- **Enforce the tournament-tier boundary at the `/admin/org/` layout, not only in pages/nav.** Rationale: converts ~a dozen fallible per-page checks into one provably-correct boundary; the empty pass-through layout is the root cause of #3/#4/#8.
- **Treat the API (not the page) as the entitlement trust boundary.** Rationale: pages already gate; the open endpoints (#5) are the real exposure.
- **Coach Portal `team` plan scope is intended as-is** (core modules incl. running tournaments). Rationale: owner confirmed; no change.

## Open Questions
- [ ] **Tier boundary placement (Phase 2):** layout guard only, or layout guard **plus** a `proxy.ts` middleware check for earliest rejection? (Middleware is more robust but touches the shared `proxy.ts` → restart-required.)
- [ ] **UpgradeGate refactor blast radius (Phase 3):** platform-wide migration of all call sites now, or refactor the component and migrate opportunistically?

## Verification (end-to-end)
- **Phase 1:** With two seeded orgs, confirm Org A owner gets 403 on schedule-publish / division mutate / communications-save against Org B's tournament; confirm normal same-org operations still succeed.
- **Phase 2:** As a tournament-tier user, hitting `/{slug}/admin/org/billing` (and other `/admin/org/*`) redirects to `/admin/tournaments`; `GET /api/admin/org/venues` returns 403 for a tournament-tier org.
- **Phase 3:** Free-tier user sees upgrade state on a Plus admin page; `UpgradeGate` copy reflects the plan resolved from `FEATURE_MIN_PLAN` after a feature's min-tier is changed in config.
- **Phase 4:** Production env audit shows no plan-gate override; founding-season date editable without deploy; public house-league page 404s for a non-public org.
- Browser-based verification is the user's responsibility per `AGENCY_RULES.md`.
