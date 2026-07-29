# Invite Reconciliation & Pending-Invite UX — Implementation Plan

**Status:** Phases 0 + 1 + 2 + 3(minimal) BUILT on `feat/free-tier-coaches`, dev only (typecheck/lint/dictionary/snapshot/token-ratchet green; mig 128 applied dev + backfilled; adversarial review folded — `.ilike`→`.eq` wildcard/index fix, reinvite email-lowercasing, email_confirmed_at guard, swallowed-error + race-on-update hardening). Phases 3–4 PENDING. Browser verification + prod migration apply pending.

**Phase 2 delivered:**
- `GET /api/auth/invitations` — reconcile-by-email then list pending invites for the session user.
- `POST /api/auth/invitations/[memberId]` — accept (status→active) / decline (delete row); always re-scoped to the authed `user_id` + `status='invited'` (no invite-claiming by id).
- `components/home/PendingInvitationsCard.tsx` (+ .module.css) — Accept/Decline card on /home.
- `/home` + `getAuthDestination` now land a pending-invite-only user on /home WITH the card (replacing the old bounce into the bare accept-invite form, J10-026). `findInvitedMembershipSlug` retired from both call sites (still exported, now unused).
**Branch target:** dev (per branch policy)
**Risk tier:** HIGH (auth/signup/membership critical paths)
**Origin:** Production support ticket 2026-06-14 — invited user (Milton Softball Org, staff) self-registered/tried to log in instead of clicking the email link, got "incorrect email or password" and is stuck in UNCONFIRMED/INVITED. Related: [[reference_invite_auth_flow]], audit findings J10-001, J10-006, J10-011, J10-026.

---

## Problem

When a tournament/org admin invites a brand-new person, the flow assumes they click the email setup link. The link runs `/auth/callback` → `/auth/accept-invite`, which sets their password and flips `organization_members.status` `invited`→`active`. The whole flow is bonded to the **`user_id`** Supabase minted via `generateLink({type:'invite'})`.

If the user does the natural thing instead — go to the site and try to sign up / log in — they hit a wall:

1. **Login** with a self-chosen password → `invalid_credentials` (no password was ever set on the invited account).
2. **Self-signup** with the same email → either Supabase rejects (email already exists as the invited auth user) or they authenticate as a *different* identity. Either way, the pending invite (bonded to the original `user_id`) is orphaned — **no query in the codebase looks up invites by email**, only by `user_id`.
3. Even if reconciled, **signup always creates a brand-new org and makes them `owner`** (`/api/auth/signup`), and the **one-org constraint** (no status filter) would reject the real invite because they now "belong to another org."

Net: the user's reasonable behavior is structurally unsupported, and there is **no UI anywhere** that tells a logged-in user "you have a pending invitation — accept it."

## What already exists (don't rebuild)

- **Destination resolver already routes invited users.** `lib/auth-destination.ts:8-41` — if a logged-in user has zero active contexts but a `status='invited'` row, it returns `/auth/accept-invite?org={slug}`. The plumbing is half-built; it just keys on `user_id` and has no UI.
- `findInvitedMembershipSlug(userId)` — `lib/user-contexts.ts:406` — single-row, `user_id`-keyed.
- Accept-invite GET/POST — `app/api/auth/accept-invite/route.ts` — `user_id`-keyed lookup + status flip to active. Reusable once identity is reconciled.
- Accept-invite page — `app/auth/accept-invite/page.tsx` — sets password via `updateUser`, posts name, redirects by role.

## Root-cause schema fact (design fork)

`organization_members` columns: `id, organization_id, user_id (NOT NULL), role, invited_at, accepted_at, capabilities, status, display_name, title`. **There is NO email column.** Reconciliation-by-email therefore needs ONE of:

- **(A)** Join to the Supabase auth user for each pending row to read its email (no migration; N auth lookups), OR
- **(B)** Add `organization_members.invited_email text` (migration; dictionary + snapshots per AGENCY_RULES "schema = dictionary, same unit of work"; lets us match by email with a plain indexed query).

**Recommendation: (B).** A persisted `invited_email` makes reconciliation a single cheap query, survives auth-user churn, and is auditable. (A) is fragile and slow (`listUsers` is already a known scale smell in the invite route).

---

## Scope (user-approved: Options 1+2+3+4)

### Option 1 — Email-keyed invite reconciliation (CORE)
On authentication, find pending invites whose `invited_email` matches the authed user's email and re-point them to the real `user_id` (or accept). This heals the identity mismatch that orphans invites today.

### Option 2 — Post-login "Pending invitations" UI
A real card on `/home` (or a holding page): "You've been invited to {org} as {role}" + Accept / Decline. Replaces today's context-free bounce into the accept form (J10-026).

### Option 3 — Signup attaches to pending invite instead of forcing a new org
At signup, if the email has a pending invite, route into the accept flow rather than minting a junk org + owner membership.

### Option 4 — Relax the one-org constraint's status filter
The constraint query (`invite/route.ts:99-111`) has no status filter, so a *pending* invite blocks re-invites and a junk self-org blocks the real invite. Exclude `status='invited'`; clean up empty self-created orgs.

---

## Phased implementation

### Phase 0 — Migration & dictionary (foundation)
- Migration `12X_member_invited_email.sql`: add `organization_members.invited_email text` (nullable), partial index on `lower(invited_email) WHERE status='invited'`.
- Backfill existing `status='invited'` rows' `invited_email` from their auth user email (one-time script).
- Update `DATA_DICTIONARY.md` + `npm run refresh:snapshots` + `npm run check:dictionary` (same unit of work).
- Update invite route (`/api/admin/members/invite`) and reinvite route to write `invited_email` on insert.
- **Apply dev only.** Prod apply is a separate gated step (`check:migrations`).

### Phase 1 — Reconciliation core (Option 1)
- New `lib/invite-reconciliation.ts`: `reconcilePendingInvitesForUser({ id, email })` — find `status='invited'` rows by `lower(invited_email)`, re-point `user_id` to the live user (or mark ready-to-accept). Idempotent; safe to call on every login.
- New `findInvitedMembershipsByEmail(email)` in `lib/user-contexts.ts` — returns a **list** (org slug + name + role), for the UI.
- Wire reconciliation into `lib/auth-destination.ts` and `app/home/page.tsx` BEFORE the contexts check, so a self-registered user's invite surfaces.
- Decision to confirm during build: re-point `user_id` vs. delete-orphan-auth-user-and-keep-row. Re-pointing is simpler and avoids deleting an authenticated identity.

### Phase 2 — Pending-invite UI (Option 2)
- New API `GET /api/auth/invitations` — list pending invites for the session user (by reconciled membership rows).
- New API `POST /api/auth/invitations/[id]/accept` and `.../decline`. Accept reuses the status→active flip (factor out of accept-invite POST). Decline sets a terminal state (need: does `status` CHECK allow a 'declined' value? Today it's `invited|active|suspended` — either add 'declined' to the CHECK in Phase 0, or delete the row on decline. **Decline = delete row** is simplest and avoids a CHECK change; confirm during build).
- New component: `PendingInvitationsCard` on `/home`. Lists org/role, Accept/Decline. On accept → land in org (reuse `getDestinationForMembership`, fixing the J10-011 redirect bypass too).

### Phase 3 — Signup attaches to invite (Option 3) — MINIMAL VERSION SUPERSEDED & REMOVED
**⚠ UPDATE (2026-06-15):** the minimal Phase 3 described below was **superseded and DELETED from the codebase** by the signup/org-decoupling project (`SIGNUP_ORG_DECOUPLING_PLAN.md`, built same day). The `invitePending`/`createOwnOrg` interstitial plumbing no longer exists in `/api/auth/signup` or the signup page. The invite-vs-create-your-own choice now happens naturally at `/home` (account-only signup → verify → reconcile + `PendingInvitationsCard`). The text below is retained for historical record only — do not treat it as live behavior. NOTE: the decoupling kept **create-org→plan-select** ordering (not the build-prompt's plan-first sketch) because paid plans need an existing org/slug for Stripe checkout.

**Decision (2026-06-15):** the user chose option B (offer a choice, not silent skip) and noted the *fuller* fix is to decouple org creation from signup entirely. We split it:
- **Minimal Phase 3 (BUILT here):** `/api/auth/signup` checks for a pending invite by `invited_email` BEFORE creating an org (only when `createOwnOrg` is not set). If found, it creates NOTHING and returns `{ invitePending: true, orgName }`. The signup page shows a **B interstitial**: "You've been invited to {org} — Accept invitation" (→ `/auth/login?email=…`, where reconciliation + the Phase-2 card take over) **or** "Create my own organization instead" (re-submits with `createOwnOrg: true`, which leaves the pending invite untouched). Check runs behind the signup action (not a pre-auth lookup) so it's not an email-enumeration oracle.
- **Full decoupling (SEPARATE PROJECT, next chat):** signup → verify email → check invites → select plan → create org, as distinct steps; a user can exist with zero orgs; `/start` becomes the post-verify hub. Build-prompt written to `docs/projects/active/SIGNUP_ORG_DECOUPLING_BUILD_PROMPT.md`. The minimal Phase 3 above is superseded by this when it ships.

### Phase 4 — One-org constraint cleanup (Option 4) — DECOMPOSED (2026-06-15)
Phase 4 was always three unrelated things. After the signup/org-decoupling decision they split as:
- **4a — false-block fix (BUILT 2026-06-15):** `invite/route.ts` existing-user one-org query now has `.neq('status', 'invited')` so a *pending* invite elsewhere no longer false-blocks a legit invite (J10-001). Only active/suspended memberships count as "belongs to another org." typecheck/lint clean, dev only.
- **4b — prevent NEW junk orgs:** ABSORBED by the decoupling project's branch-on-intent (invited users no longer forced to create an org). No work here.
- **4b — clean up EXISTING/ongoing junk orgs:** becomes the **platform-admin empty-org surface** in `SIGNUP_ORG_DECOUPLING_BUILD_PROMPT.md` (org-create stays pre-verify by decision, so unverified/empty orgs keep being produced and support needs to find+remove them). Tracked there, not here.
- **Cross-org accept guard (NEW, from Phase 2 review, UNDECIDED):** neither accept path (card `POST /api/auth/invitations/[id]` nor `accept-invite` POST) checks for a pre-existing *active* membership in another org, so accept can create a 2nd active membership. Not a regression (pre-existing parity). Decision deferred to the decoupling chat (enforce one-org at accept/org-create, or formally allow multi-org?).

---

## Test matrix (manual, browser — user-run per AGENCY_RULES)

1. Invited new user → clicks email link → accept → active (regression: existing happy path still works).
2. Invited new user → ignores email → self-registers same email → lands on /home → sees pending-invite card → Accept → in org.
3. Invited new user → ignores email → tries login with made-up password → still blocked (expected) but footer hint guides them (already shipped).
4. Existing single-org user invited to a 2nd org → one-org behavior intact / correct message.
5. User invited to org A AND org B → both appear in card; accepting one doesn't break the other.
6. Decline → invite removed, no orphan, admin sees member gone/declined.
7. Reinvite after reconciliation → no duplicate rows.
8. Expired link (24h) user → self-register path now rescues them.

## Risks & guards

- **Auth-critical surface (Phase 3).** Full adversarial `/review` before commit; never push to master without explicit request.
- **Idempotency.** Reconciliation runs on every login — must be safe to call repeatedly (no duplicate rows, no thrash).
- **Email case/whitespace.** Normalize `lower(trim(email))` everywhere — invite route already lowercases; match must too.
- **Security — invite enumeration.** Reconciliation/listing must key on the *authenticated session email*, never a client-supplied email, to avoid "claim someone else's invite." Critical.
- **One-org integrity (Phase 4).** Loosening the constraint must not allow a user to accumulate memberships across multiple real orgs — only resolve pending/junk cases.
- **Migration discipline.** Dev-only first; prod apply gated and manual.

## Open decisions (resolve during build, not blocking the plan)
- Reconcile by re-pointing `user_id` vs. deleting the orphan invited auth user. (Lean: re-point.)
- Decline = delete row vs. add 'declined' to status CHECK. (Lean: delete.)
- Definition of "empty junk org" eligible for cleanup in Phase 4.

## Sequencing
Phase 0 → 1 → 2 deliver the user-visible win (self-register → see invite → accept). Phase 3 → 4 close the signup/constraint traps. Ship 0–2 first; 3–4 as a fast follow.
