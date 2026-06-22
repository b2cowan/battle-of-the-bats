# Implementation Plan — Identity Model Cleanup ("single-org by default")

**Status:** ✅ **COMPLETE — ALL PHASES BUILT + BROWSER-VERIFIED on `dev` 2026-06-19** (P1·P2·P3·P4; each `/review`-passed, no Critical/High left open). No migrations. ARCHIVED. · **Created:** 2026-06-19 · **Branch:** `dev`
**Decision it implements:** `ONE_TO_ONE_VS_MULTI_ORG_DECISION_ANALYSIS.md` (locked 2026-06-19)
**PM brief:** `IDENTITY_MODEL_CLEANUP_PM_BRIEF.md`
**Resolves the long-open item in:** `INVITE_RECONCILIATION_PLAN.md` ("Cross-org accept guard, UNDECIDED")

## Goal

Make the identity model **coherent and simple by default** without removing the flexibility the owner's answers require. Today the system is an inconsistent hybrid: the database fully allows multi-org, multi-workspace UI is advertised, but the sign-up rules contradict each other (invite blocks a second org, self-serve "add a workspace" allows unlimited, neither accept path checks). After this work:

- The common user (single org) sees a clean, single-workspace experience — no picker, no "add a workspace" nudges.
- One account can belong to more than one org **only by a deliberate invite or a Coaches Portal purchase** — never by idly creating an empty org.
- A coach who owns their own Coaches Portal **and** holds a role in a club uses **one login** (their own portal never counts against them).
- Every entry path agrees on the same rule, and the app has one clear "home org" so future features never have to guess "which org."
- No irreversible one-org database constraint is added.

## Locked policy (the rule every path must follow)

| Path | Rule after this work |
|------|----------------------|
| Self-serve "create another empty org" (signed-in user who already has a real org) | **Removed.** Redirect to home. |
| First org for a brand-new account (zero memberships) | Allowed (unchanged). |
| Invite to a **real** org when the user already has another **real** org | **Soft-blocked** (rare two-real-org-admin → second email). One-line knob to relax later. |
| Invite to any org when the user's only "other org" is their **own Coaches Portal** | **Allowed** — the portal never counts. (This is answer #3.) |
| Buying a Coaches Portal while already a club member | Allowed (portal exempt). |
| Buying a **second** Coaches Portal on the same account | **Blocked** (one paid portal per email). |
| Accept an invite | Enforces the same real-org rule as invite-time (closes the asymmetry). |

"Real org" = an `organization` whose `account_kind` is **not** `team_workspace`. The Coaches Portal stub org (`account_kind='team_workspace'` / `plan_id='team'`) is always exempt from "do you already belong to an org?" counting.

---

## Phase 1 — Single-org by default (UX quieting)

**Status: items 1, 2, 4 BUILT on `dev` 2026-06-19** (typecheck + focused lint clean; no migrations; no shared-module/new-file changes → no dev-server restart needed). **Item 3 moved to Phase 2** — hiding the "All Workspaces" links needs the same workspace-count signal the home-org resolver introduces, so doing it here would mean a throwaway one-off fetch (`AdminSidebar` takes no props; it reads org data from context/hooks).

Make the default experience single-workspace. No data changes; presentation + one redirect.

1. ✅ **Remove the "Start something new" card** from the post-login home launchpad. The workspace picker still lists workspaces a user genuinely has; it just stops advertising creating more.
   - `app/home/page.tsx` — `StartNewCard` removed from the render and the component deleted; comments updated.
2. ✅ **Stop self-serve second-empty-org creation.** A signed-in user who **already has ≥1 active membership** hitting the organizer on-ramp is redirected to `/home` instead of the add-org form. A signed-in user with **zero** memberships still gets the create-first-org form (account-first / invited-then-no-invite case).
   - `app/start/tournament/page.tsx` — active-membership count check before rendering `AddOrgForm`; redirect to `/home` if they already have one.
3. → **Moved to Phase 2.** Hide the "All Workspaces" entry points (admin sidebar footer, coach portal rail + mobile sheet) for single-workspace users — gate on the workspace-count the home-org resolver computes.
4. ✅ **Soften the "add more later" copy** on the start picker (`app/start/page.tsx`) so first-time signup doesn't promise a multi-workspace product. (Copy-only.)

**Verification (owner browser test):** a single-org owner logs in → lands directly in their workspace, no picker, no "Start something new" card. Visiting the organizer on-ramp while already having an org → redirected home, no "create another org" form. A brand-new account with no org still reaches the create-first-org form.

---

## Phase 2 — Consistent rules + a clear home org

**Status: BUILT on `dev` 2026-06-19** (typecheck + focused lint clean; no migrations; `/review` high-risk pass — no Critical/High; review fixes applied: gates aligned on **active-only**, policy gate logs + fails-open on DB read error, home-org pick made type-safe). ⚠ **Dev-server restart required before browser testing** (new shared modules + a shared-auth change). Items below all landed; Phase 1 item 3 (hide "All Workspaces") landed here.

The structural coherence pass. This is the load-bearing phase.

1. **Introduce a single "home org" resolver** — one function that returns a user's deterministic home organization. V1 derives it (no migration): if exactly one real-org membership, that's home; if several, pick deterministically (earliest active real-org membership); the Coaches Portal is a workspace they also have, not the default home unless it's their only one. Route post-login defaulting through it.
   - New helper in `lib/user-contexts.ts` (or `lib/api-auth.ts`); reuse the existing active-membership fetch.
   - **Optional future:** an explicit `is_primary` flag on membership if users ever need to choose — out of scope for V1.
2. **Add the real-org exemption helper** — "does this user already belong to another **real** org?" that ignores `team_workspace` orgs. Use it everywhere the one-org rule is enforced.
3. **Make all entry paths enforce the same rule:**
   - **org-create** (`app/api/org/create/route.ts`): block when the user already has a real-org membership (matches the Phase 1 UX redirect at the API layer — defense in depth).
   - **invite** (`app/api/admin/members/invite/route.ts:111-127`): change the existing block to use the real-org exemption (so a standalone coach with only their portal can be invited into a club).
   - **accept** (`app/api/auth/accept-invite/route.ts` and `app/api/auth/invitations/[memberId]/route.ts`): add the same real-org check at accept time — **resolves the long-open "cross-org accept guard."**
4. **Provisioner stays open for the portal purchase** (`lib/team-workspace-provisioning.ts`) — buying a Coaches Portal while in a club is allowed; no change needed beyond the per-email guard in Phase 3.
5. **Hide the "All Workspaces" entry points for single-workspace users** (moved from Phase 1). Pass the workspace-count (from the home-org resolver) into the admin shell and coach portal shell; show the "All Workspaces" links only when the user has 2+ workspaces.
   - `components/admin/AdminSidebar.tsx`, `components/coaches/CoachPortalShell.tsx` — gate the `/home?pick=1` links on a "has multiple workspaces" flag fed from the layout/context.

**Verification:** ① a club admin invited to a second club is blocked; ② a standalone Coaches Portal owner invited to a club is **accepted** and sees both with one login; ③ a signed-in existing owner cannot create a second empty org via the on-ramp or the API; ④ a single-workspace admin/coach sees no "All Workspaces" link, a 2-workspace one still does.

---

## Phase 3 — One paid Coaches Portal per email

**Status: BUILT on `dev` 2026-06-19** (typecheck + focused lint clean; no migrations; `/review` high-risk pass — security/regression clean across 9 checks; one High-severity reactivation gap found + fixed: a user with a live portal could reactivate a second one — the guard now runs for reactivation too). Closes the "one account could buy two portals" gap **before** Coaches Portal checkout ungates (gated today, so not yet exploitable).

1. ✅ **Pre-checkout guard (primary):** a new `getActiveOwnedTeamWorkspace(userId)` check rejects starting a second Coaches Portal when the account already has a LIVE one (active/trialing/past_due) — returns 409 with a link to their existing portal. Runs for new purchases AND reactivations (a canceled portal isn't "live", so legitimate reactivation still works). A canceled-only account can still buy fresh / reactivate.
   - `app/api/billing/create-team-checkout/route.ts` + new helper in `lib/team-workspace-entitlements.ts`.
2. ✅ **Provisioner defense-in-depth:** `provisionTeamWorkspaceFromCheckoutMetadata` re-checks owner ownership before creating a new workspace (catches a webhook double-pay race that slips past the stripe-subscription idempotency check).
3. Wanting a second portal = a different email (intended).

**Verification (owner browser test, after checkout is ungated in a test env):** attempting a second Coaches Portal on the same account is blocked with a clear "you already have one" path; a first-time buyer / per-team upgrade / tournament claim / reactivation-of-only-portal all still work.

**Follow-ups noted by `/review` (not blocking; relevant only once self-serve checkout ungates):** (a) decide whether an *org-billed* coach (billing-owner but not primary-owner of a club-paid workspace) may also buy a standalone portal — `getActiveOwnedTeamWorkspace` keys on `primary_owner_user_id`; (b) cancel/refund the duplicate Stripe subscription if a double-pay race ever creates one.

---

## Phase 4 — Incidental correctness fixes (independent of the decision)

**Status: BUILT on `dev` 2026-06-19** (typecheck + focused lint clean; no migrations; `/review` passed — no Critical/High defects). Two real bugs fixed; a third candidate was reviewed and dropped as a non-bug (see item 3).

1. ✅ **Org-admin member deletion can orphan a coach team.** The org-admin "remove member → permanently delete account" path now runs the same orphan-team cleanup the platform-admin delete path does, before the account is deleted (best-effort, logged).
   - `app/api/admin/members/[memberId]/route.ts` (sole-membership hard-delete branch) — calls `cleanupBasicCoachTeamsForUserDeletion`.
2. ✅ **Accepting an invite errors when a user has two pending invites.** The accept lookup now orders by oldest invite + `.limit(1)` so `.maybeSingle()` can't error on >1 row; the already-accepted fallback query is likewise capped.
   - `app/api/auth/accept-invite/route.ts`.
3. ⛔ **DROPPED — not a real bug.** The `/review` pass confirmed `tournaments.default_contact_member_id` and `divisions(age_groups).contact_member_id` both FK `organization_members(id)` **ON DELETE SET NULL** (mig 088). Deleting the member row on the membership-only path already auto-nulls those refs via the cascade — the dossier's "stale references" concern was unfounded. The brief explicit null-out was added then reverted; a clarifying comment was left in its place.

**Verification (owner browser test):** delete a sole-membership coach who owns a basic team → team is cleaned up, not orphaned; a user with two pending invites can accept without error.

---

## Sequencing & risk

- **Phase 1** is safe and shippable on its own (presentation + one redirect) — delivers the visible "simpler" win immediately.
- **Phase 2** is the structural heart; it touches auth/sign-up paths, so it warrants the `/review` adversarial gate and a dev-server restart before browser testing (shared-module changes).
- **Phase 3** must land before Coaches Portal checkout ungates; otherwise no urgency (gated today).
- **Phase 4** is independent and can land anytime; #1 (orphan-team) is the most user-affecting.
- **No migrations** are required for V1 (home org is derived; no one-org DB constraint by design). If we later add an explicit `is_primary` flag, that's a separate, optional migration.
- **Reversibility preserved:** nothing here is a one-way door. We can later harden toward strict 1:1 (the population stays single-org by default) or relax the second-real-org block (one knob) without rework.

## Out of scope / deferred

- Strict one-org **database** enforcement (deliberately not done; revisit only if the owner later wants strictly siloed tenants).
- Explicit user-chosen primary org (V1 derives it).
- Cross-org coach chat (separate plan; unblocked by this and does not depend on it).
