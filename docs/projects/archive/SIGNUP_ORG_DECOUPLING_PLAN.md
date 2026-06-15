# Signup / Org Decoupling — Implementation Plan

**Status:** BUILT + /review (HIGH) folded + BROWSER-VERIFIED 2026-06-15 on `feat/free-tier-coaches` (dev only). Mig 128 (parent dependency) APPLIED TO PROD + verified + snapshots refreshed. Generic Get-Started CTAs repointed to the /start fork (Navbar + 3 homepage heroes). Remaining = code deploy to master. ARCHIVED on build completion. Continuation of the Invite Reconciliation project (Phases 0–2 + minimal Phase 3 shipped there).
**Branch:** `feat/free-tier-coaches` (per branch policy / continuation; never master).
**Risk tier:** HIGH (auth / signup / membership critical paths). Full `/review` before commit.
**Parent:** [[INVITE_RECONCILIATION_PLAN]] · memory `project_invite_reconciliation`. Build prompt: `SIGNUP_ORG_DECOUPLING_BUILD_PROMPT.md`.

---

## Goal

Decouple **user-account creation** from **organization creation** in the FieldLogicHQ signup front door, so an invited user can make an account *without* being forced to mint a junk org. Fixes the root cause behind the minimal Phase 3 interstitial (which this retires).

## Decisions locked

From the build prompt (owner-confirmed 2026-06-15):
1. **Branch hard on intent at `/start`.** Owners vs invited users see different paths; no universal interstitial; owner flow stays ONE tight flow.
2. **Org creation stays BEFORE email verification** (owner builds org, verifies after).
3. **Protect the owner funnel** — the common new-org path must not regress (no extra steps).
4. **Platform-admin cleanup surface** for unverified users / empty orgs — reuse `customer-users/`, add a bulk-unconfirmed filter + an empty-org indicator/filter on `orgs/`.

Resolved this session (the two open items the build prompt flagged):
- **(a) Cross-org accept guard → FORMALLY ALLOW MULTI-ORG.** The `/home` switcher + "Start something new" already assume a user can hold multiple workspaces (an owner can also be invited as staff elsewhere). No new guard added at accept (`POST /api/auth/invitations/[id]`, accept-invite POST) or org-create. The admin **invite-side** one-org block (`invite/route.ts`) is a separate concern and stays as-is. Documented, not coded.
- **(b) Phase 4a `.neq('status','invited')` → ALREADY DONE.** `app/api/admin/members/invite/route.ts:103-108` already excludes pending invites from the one-org block with the J10-001 comment. Verified, no work.
- **Plan timing → KEEP `create-org → plan-select`.** The build-prompt sketch ("select plan before org-create") only works for the FREE plan: paid plans run through Stripe `create-checkout`, which requires an existing org/slug (`orgSlug` + `returnTo: /{slug}/admin/onboarding`) and a webhook that attaches the subscription to an org. Today's flow (org created on free `tournament`, plan chosen at onboarding, paid → Stripe → webhook upgrades) is already correct for paid and preserves the one-tight-flow owner UX. **Decoupling therefore applies ONLY to the invited / account-first branch.**
- **Invited entry point → new `/start` option + account-only signup.** A "joining a team / was invited" choice on `/start` routes to signup in account-only mode (no org field), then → verify → `/home` → `PendingInvitationsCard`.

## What already exists (reuse, don't rebuild)

- **`/api/org/create`** — creates an org + owner membership + founding comp for an *already signed-in* user (the "add another workspace" path). The decoupled invited branch does NOT need a new org-create primitive; it needs signup to be able to NOT create one.
- **`/home`** (`app/home/page.tsx`) — reconciles invites, renders `PendingInvitationsCard`, and redirects zero-context/zero-invite users to `/start`.
- **`lib/invite-reconciliation.ts`** — `reconcilePendingInvitesForUser` (re-points by `lower(invited_email)`, verified-email only) + `listPendingInvitesForUser`. Runs in `getAuthDestination` + `/home`.
- **`/api/auth/invitations` + `[memberId]`** — list / accept / decline, re-scoped to the session user_id.
- **`/start`** (`app/start/page.tsx`) — the intent picker (organizer / coach / league / club). Add the invited option here.
- **Customer Users** (`app/platform-admin/customer-users/`) — `authStatusFor` → `unconfirmed` badge + per-user actions already present.
- **Orgs page** (`app/platform-admin/orgs/`) — already computes per-org attention sets (`missingOwner`, `ownerInactive`, …); add `emptyOrg`.

## Build steps

### 1. `/api/auth/signup` → support account-only mode (CORE)
- Make `orgName` **optional**. Branch:
  - **orgName present (owner path):** unchanged — create org on free `tournament`, owner membership, founding comp, verification `redirectTo` → `/{slug}/admin/onboarding?choosePlan=1`. **Zero regression.**
  - **orgName absent (account-only):** create auth user (+ verification email in prod / auto-confirm in dev), verification `redirectTo` → `/auth/callback?next=/home`. Create **no org, no membership**. Return `{ success, requiresEmailVerification, email, accountOnly: true }`.
- The verification email template (`signupVerificationHtml`) currently requires `orgName` — make it optional (neutral copy when account-only). Audit confirms only the verification email fires at signup; welcome/upsell/founding emails fire at plan-select, so no org-assuming email regresses.
- Keep all rollback + observability paths.

### 2. Signup page (`app/auth/signup/page.tsx`) — account-only mode
- Owner path stays as-is (org-name field, "Create Your Organization", → onboarding).
- Add account-only mode (e.g. reached with `?account=1` from the new `/start` option): hide the org-name field, retitle "Create your account", success → land on `/home` (verify gate then `/home` in prod). The org-name validation is skipped in this mode.

### 3. `/start` — invited intent option
- Add an "I was invited / joining a team" card that links to signup in account-only mode. Copy: account-first, "make an account and accept your invite."

### 4. Retire minimal Phase 3 interstitial — AFTER parity check
- **Parity gate:** confirm account-only → verify → `/home` → card → Accept covers the interstitial's case (test case 2) before deleting.
- Remove the `invitePending`/`createOwnOrg` branch in `signup/route.ts` (the pending-invite pre-check + early return) and the `invitePending` UI branch + `submitSignup(createOwnOrg)` plumbing in `signup/page.tsx`.

### 5. Platform-admin cleanup surface
- **Customer Users:** add a bulk filter to isolate `authStatus === 'unconfirmed'` (badge + per-user actions already exist; add the list-level filter).
- **Orgs:** compute an `emptyOrg` flag (no tournaments / league seasons / rep teams / members beyond the single owner) and add an indicator + filter. Read-surfacing only; existing delete actions unchanged. Do NOT auto-delete.

### 6. Multi-org documentation (item a)
- No guard. Note the "multi-org allowed" decision in this plan + memory so it's an explicit call.

## Verification
- `npm run typecheck` (API/auth/shared touched) + `npm run lint:focused -- <files>` + `npm run verify:changed`.
- Offer `/review` (HIGH-risk tier) after the substantive auth changes.
- User runs the browser test matrix below.

## Test matrix (manual, browser — user-run)
1. **New customer, no invite (owner):** `/start` → organizer → signup (org name) → verify → org on free → onboarding plan-select. No step-count regression vs today.
2. **Invited user, account-only:** `/start` → "joining a team" → account-only signup → verify → `/home` → invite card → Accept → in org. **No junk org.**
3. **Invited user chooses own org:** ignores card on `/home` → "Start something new" → `/start` → organizer → own org; invite stays pending and still shows.
4. **Dev (verify off) vs prod (on):** both land correctly (account-only → `/home`; owner → onboarding).
5. **Owner plan applied:** free + a paid plan each produce a correct org (modules/limits) — unchanged from today.
6. **Email collision:** invited email entered in account-only signup → no crash/dupe; reconciliation + card take over after they confirm/log in.

## Done when
- Signup can create an account without an org; invited branch never mints a junk org.
- Owner funnel unchanged (no extra steps).
- Minimal Phase 3 interstitial removed (parity confirmed first).
- Platform-admin unconfirmed-user filter + empty-org indicator/filter shipped.
- typecheck + lint:focused + verify:changed green; `/review` folded.
- Memory `project_invite_reconciliation` updated (decoupling shipped, minimal P3 retired).
