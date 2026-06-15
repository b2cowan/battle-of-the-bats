# Build Prompt — Decouple Org Creation from Signup

> **ARCHIVED 2026-06-15** — this spec was executed; the decoupling was built on `feat/free-tier-coaches` (dev). Live status: `docs/projects/active/SIGNUP_ORG_DECOUPLING_PLAN.md` + `INVITE_RECONCILIATION_PLAN.md`. NOTE: the build chose **create-org→plan-select** (not this prompt's "plan before org-create") because paid plans need an existing org/slug for Stripe checkout. Kept for historical record only.

> **How to use this:** open a fresh Claude Code chat in this repo and paste the "Prompt" section below (or point it at this file). It is written to be self-contained. Follow the repo's planning-first rules: produce the PM UX summary + Implementation Plan BEFORE writing code, and offer `/review` after substantive changes.

---

## Decisions locked (owner-confirmed 2026-06-15 — build to these, not the generic sketch)

1. **Branch hard on intent at `/start`.** Do NOT make everyone walk a single account→verify→invite→plan→org sequence. Split early: "I run an organization" vs "I'm joining a team / was invited." Each role sees only its own path — no universal interstitial. The decoupling is about the **data model** (an account can exist with zero orgs); the **owner UX should stay one tight flow**, not visibly chopped into four gated screens.
2. **Keep org creation BEFORE email verification (as today).** The owner builds their org and verifies after — preserves the "you have something immediately" feel and avoids a high-abandonment "go check your email" gate mid-funnel. The account-only path (invited users) is what defers org creation. Do not move org-create behind the verify gate.
3. **Protect the owner funnel = the priority.** Owners are the revenue; the common new-org path must not regress (count the steps — flag if it gets worse than today's single form). Invited users get the clean account-only branch (the urgent fix is already shipped via minimal Phase 3, so optimize this for funnel quality, not speed).
4. **Platform-admin cleanup surface for unverified users / empty orgs (in scope).** Support must be able to find and clean up accounts/orgs left unverified or empty.
   - **Already exists (reuse, don't rebuild):** `app/platform-admin/customer-users/` already computes `authStatusFor` → `unconfirmed`, shows an `unconfirmed` warning badge, and has unconfirmed-specific per-user actions (`CustomerUsersClient.tsx` ~line 560). 
   - **Gaps to add (small, focused):** (a) a **filter** on Customer Users to isolate `authStatus = unconfirmed` in bulk (badge exists; bulk filter likely does not — verify); (b) an **empty-org indicator/filter** on `app/platform-admin/orgs/` so support can spot orgs created but never populated (no tournaments/leagues/teams/members beyond the owner) — the classic "unverified owner → junk org" residue. Keep it read-surfacing + existing delete actions; don't auto-delete.

---

## Prompt

We are restructuring the FieldLogicHQ signup front door so that **creating a user account is decoupled from creating an organization**. Today `/api/auth/signup` does account-create + org-create + owner-membership in one shot and the verification email lands the user on `/{slug}/admin/onboarding?choosePlan=1`. We want this flow instead:

1. **Create user + verify email** (no org yet).
2. **After verify, check for pending invites.** If any, show the user a choice (Accept the invite, or create their own organization). This is the "B interstitial" already prototyped in the minimal Phase 3 (see below) — but now it's a first-class step, not a guard bolted onto org-creating signup.
3. **If no invite (or they choose "create my own") → select plan.**
4. **Create org** (with the chosen plan applied at creation).

Plan-select BEFORE org-create is deliberate (the plan shapes the org at creation: free-floor vs paid, enabled modules) — do not swap.

Start by reading `docs/projects/active/INVITE_RECONCILIATION_PLAN.md` (this is the parent project; Phases 0–2 + minimal Phase 3 are already built and on `feat/free-tier-coaches`) and the memory file `memory/project_invite_reconciliation.md`. Then produce a plan + PM brief per AGENCY_RULES, get sign-off, and build.

---

## Why (context)

A user who is invited to an org and tries to self-register currently creates a **junk org** (empty org they own) because signup forces org creation. Minimal Phase 3 (already built) intercepts this at submit and offers a choice, but it can't cleanly let them "just make an account and accept" because the existing flow has no concept of an account without an org. Decoupling fixes that root cause and also gives us a proper "account-first" front door that the `/home` + `/start` architecture already assumes exists (a user can have zero orgs).

## What already exists (don't rebuild — reuse)

- **`/home`** (`app/home/page.tsx`) already renders for users with zero active contexts **if** they have a pending invite (Phase 2), via `components/home/PendingInvitationsCard.tsx`. Users with zero contexts AND zero invites redirect to `/start`.
- **`/start`** is the existing "account-first front door" (asks the user their job, then routes to org-creation). This is the natural home for steps 3–4 (plan-select → org-create).
- **Invite reconciliation** (`lib/invite-reconciliation.ts`) — `reconcilePendingInvitesForUser({id,email,emailConfirmedAt})` re-points orphaned invites by email; runs in `getAuthDestination` + `/home` before contexts resolve. SECURITY: keys on the authenticated session email only.
- **Pending-invite card + accept/decline API** — `app/api/auth/invitations/route.ts` (GET list) and `app/api/auth/invitations/[memberId]/route.ts` (POST accept/decline). Reuse these for step 2.
- **Org creation helpers** — `createOrganization`, `createOrganizationMember`, `generateUniqueOrgSlug` in `lib/db.ts`. The current owner membership is created with `status='active'`, `accepted_at` now.
- **Plan-select / onboarding** — currently at `/{slug}/admin/onboarding?choosePlan=1`. The decoupled flow needs plan-select to happen *before* a slug exists, so this likely moves to `/start` (or a new `/start/plan` step) and the org is created with the plan already chosen.

## The core architectural changes

1. **`/api/auth/signup` becomes account-only.** Stop requiring `orgName`; stop creating an org/owner membership. Create the auth user (+ verification email in prod) and return. The verification `redirectTo` can no longer be `/{slug}/...` (no slug yet) — point it at `/auth/callback?next=/start` (or `/home`, which will route to `/start` when there are zero contexts/invites, or to the invite card when there's an invite).
2. **The signup page** drops the "Organization Name" field (or moves it to the post-verify org-create step). Title changes from "Create Your Organization" to something account-first ("Create your account").
3. **Post-verify routing** lands on `/home` → which already: reconciles invites, shows the card if any, else falls to `/start`. So step 2 (check invites) is *already handled by `/home`* — verify this works end-to-end and that `/start` hosts steps 3–4.
4. **`/start` (or a new step) hosts plan-select → org-create.** Org creation moves here, taking the chosen plan as input so the org is created correctly (free-floor vs paid). Reuse the org-create helpers; apply the plan at creation, not via a follow-up patch.
5. **Retire the minimal Phase 3 interstitial** in `app/auth/signup/page.tsx` + the `invitePending`/`createOwnOrg` branch in `app/api/auth/signup/route.ts` once the decoupled flow covers the same case (the invite choice now happens naturally at `/home` post-verify). Confirm parity before deleting.

## Watch-outs / risks (auth-critical — high-risk tier, full /review required)

- **Email assumptions:** the welcome/upsell/founding-season emails and platform-admin support views assume an org exists at signup. Audit `lib/email.ts` (signupVerificationHtml, welcome/upsell templates) and any code that fires on org-create. Decoupling means "account created" and "org created" are now separate events — emails may need to split or move.
- **Existing-email collision:** an invited user's email already exists as an invited auth user. Account-only signup with that email must not collide — ideally it routes them to login/accept (reconciliation handles the rest). Test this explicitly.
- **One-org constraint:** accepting an invite (card) and creating an org both make a user "active" somewhere. Today neither accept path checks for a pre-existing active membership in another org (parity gap noted in the parent project, deferred to Phase 4). Decide whether the decoupled flow enforces one-org at org-create / accept.
- **Verification redirect:** must work in dev (verification may be off — `shouldRequireEmailVerification()`) and prod (on). In dev, the user is auto-confirmed; ensure both land correctly on the new account-first destination.
- **`/start` content gating:** `/start` currently assumes it can create an org. Confirm it (or the new step) cleanly accepts a chosen plan and creates the org with it.
- **Regression:** the normal "new customer, no invite" path must remain smooth: account → verify → /home → /start → pick plan → org created → onboarding. Don't add friction for the common case.

## Test matrix (manual, browser — user-run)

1. New customer, no invite: signup → verify → /home → /start → pick plan → org created → lands in admin/onboarding. No regression vs today's experience (count the steps; flag if it got worse).
2. Invited user self-registers (decoupled): account-only signup → verify → /home → sees pending-invite card → Accept → in org. No junk org created.
3. Invited user chooses "create my own" at /home: declines/ignores card, goes to /start, creates own org; invite stays pending and still shows later.
4. Dev (verification off) vs prod (on): both land on the correct account-first destination.
5. Plan applied at creation: free-floor and a paid plan each produce a correctly-configured org (modules/limits) without a follow-up patch.
6. Email collision: invited email entered at signup → routed to login/accept, no crash, no duplicate.

## Done when

- Signup creates an account without an org; org creation lives in the post-verify plan-select step.
- All six test-matrix cases pass in the browser.
- Minimal Phase 3 interstitial code removed (parity confirmed first).
- `npm run typecheck` + `lint:focused` + `verify:changed` green; `/review` (high-risk) folded.
- Plan + PM brief written; memory `project_invite_reconciliation.md` updated to mark decoupling shipped + minimal P3 retired.
