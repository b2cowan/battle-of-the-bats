# Sign-up Invite Guard — Implementation Plan

> **Status:** BUILT on `dev` (2026-07-06) — Phases 1–3 complete; typecheck + focused lint clean.
> Pending: `/review` (high-risk) + owner browser verification. No migration. Decisions locked to the
> recommended defaults (submit-time detection only; escape hatch → "use a different email", no
> org-clobbering override).
> **Created:** 2026-07-06
> **Branch:** dev
> **Risk tier:** HIGH (auth / signup / membership critical paths)
> **Origin:** `/helpdesk` production ticket 2026-07-06 — `bryan.doucette@live.com` invited as staff to
> Milton Softball Organization, reached the generic sign-up and was prompted to "Create Your
> Organization"; ended up stuck PENDING. Chained through `/ux` (flow) and `/design` (visual spec).
> **PM brief:** [SIGNUP_INVITE_GUARD_PM_BRIEF.md](SIGNUP_INVITE_GUARD_PM_BRIEF.md)

## Goal

Catch an already-invited (or already-registered) person at the sign-up screen instead of walking
them into creating their own organization. Deliver it as (1) a **server-side guard** in the owner
sign-up path that refuses to create a stray org / tamper with an invited account, and (2) an
**adaptive sign-up UI** that recognizes the email and routes them to accept their invitation. Reuse
the already-shipped invite-reconciliation infrastructure end to end. **No migration.**

## PM Brief

> **What it does:** When someone already invited to a tournament lands on the "Create your
> organization" sign-up screen (instead of clicking their invite email link), the screen recognizes
> their email and offers to send them straight to their invitation instead of walking them into
> starting their own organization. Behind the scenes, sign-up also refuses to spin up a throwaway
> org for an already-invited or already-registered email.
>
> **Why it matters:** Invited staff/admins who take the wrong door get confused, end up stuck as
> PENDING, and sometimes create a stray org that then blocks their real accept. Recurring support
> seam (real customer hit it). Also closes a data-integrity hole: the owner-signup path has no
> "account already exists" check, so an already-invited email can be clobbered + a stray org created.
>
> **Who benefits:** Anyone invited as staff/admin/scorekeeper (all plans); org owners; support. No
> plan gating.
>
> **Expected impact:** Invited users self-rescue (recognize → one button → link → land in the right
> place). Fewer stray orgs / stuck PENDING rows. Genuine new organizers unaffected.
>
> **Priority:** High. Small, low-risk (reuses shipped mig-128 infra; no migration).
>
> **Success criteria:** invited email offered the accept path not org creation; signup with an
> invited/existing email never creates a stray org or alters the invited account; "email me my link"
> works end to end; new-org happy path unchanged; no enumeration regression.

## Relationship to prior work (don't rebuild)

The invite-reconciliation project ([INVITE_RECONCILIATION_PLAN.md](INVITE_RECONCILIATION_PLAN.md))
already **shipped** the healing half and the infra this plan reuses:

- `organization_members.invited_email` + partial `lower(invited_email) WHERE status='invited'` index
  — **mig 128, applied to prod.** Written on invite + reinvite. **No new migration needed here.**
- `lib/invite-reconciliation.ts` — `reconcilePendingInvitesForUser({id,email,emailConfirmedAt})` +
  `listPendingInvitesForUser(userId)`. Idempotent, session-email-keyed.
- `/home` `PendingInvitationsCard` + `getAuthDestination` route a pending-invite-only user to the card.
- Single-org policy helpers — `lib/org-membership-policy.ts` (`userBelongsToOtherRealOrg`).
- Resend link generation — `app/api/admin/members/[memberId]/reinvite/route.ts` (magic-link for a
  **confirmed** auth user, invite-link otherwise) → both redirect to `/auth/accept-invite`.

**What that project explicitly left open (this plan closes it):** its old "Phase 3 — signup attaches
to invite" was *superseded and deleted* by the signup/org-decoupling work, which only catches invitees
who self-select the "I was invited" tile at `/start`. **The owner-signup door has no guard.** That is
the exact gap `/helpdesk` found. Phase 4b ("prevent NEW junk orgs") was marked "absorbed by
branch-on-intent" — true only for users who take the invited tile, **not** the owner door.

## Root-cause detail (the integrity hole)

`app/api/auth/signup/route.ts`:
- The **account-only branch** already guards: `authUserExistsForEmail()` → neutral 409 "An account
  already exists for this email. Please sign in instead."
- The **owner branch has NO such guard and no pending-invite check.** Submitting owner-signup with an
  already-invited email calls `generateLink({type:'signup'})` on the existing invite-stub auth user —
  **rotating its password + confirmation token (account-state tampering)** — and then creates a new org
  with that identity as `owner` (the stray org). The stray real-org membership then makes
  `userBelongsToOtherRealOrg` true, so the person's genuine accept is rejected.

## Phases

### Phase 1 — Server guard + structured branch (the real fix; closes the hole)
Authoritative, runs on the sign-up **submit** — needs **no new endpoint** (reuses the POST the client
already sends). Fixes the integrity hole even if the client UI is bypassed.

- [ ] In the **owner branch** of `app/api/auth/signup/route.ts`, BEFORE creating any auth user / org:
  - [ ] Look up a pending invite for the normalized email (reuse the `status='invited'` +
        `lower(invited_email)` query used by reconciliation). If found → **create nothing** and return a
        structured `{ inviteBranch: 'invited', orgName, role }` (HTTP 200, not an error — the client
        renders the "You've been invited" state).
  - [ ] Else, mirror the account-only branch's `authUserExistsForEmail()` guard: if an auth user
        already exists → return `{ inviteBranch: 'account_exists' }` (neutral; parity with the existing
        account-only 409 copy). Create nothing.
  - [ ] Else → unchanged: proceed to create the org (genuine new organizer — protect this path).
- [ ] Honor an explicit `createOwnOrg: true` override (set only by the confirmed escape hatch) — but
      **never clobber an existing auth user**: if the email already has an auth user, the override must
      still refuse the destructive `generateLink({type:'signup'})` path (see Open Decision 2 for the
      escape-hatch resolution). Genuine new emails with `createOwnOrg` behave exactly as today.
- [ ] Keep all responses email-enumeration-neutral in tone; rely on the existing signup rate limiter.
- [ ] Unit-level reasoning / manual check: an invited email submitted here creates 0 orgs, 0 new auth
      users, and leaves the invited stub's credentials untouched.

### Phase 2 — Adaptive sign-up UI + self-serve resend
Consumes Phase 1's structured response; adds the invitee-facing "email me my link" path. Visual spec is
locked in `memory/design_decisions.md` (2026-07-06 "Sign-up screen 'You've been invited' branch") — no
new tokens; new classes live in `app/auth/auth.module.css`.

- [ ] New endpoint `POST /api/auth/resend-invite` (`app/api/auth/resend-invite/route.ts`):
  - [ ] Unauthenticated, rate-limited (reuse `FixedWindowRateLimiter` + `clientIpFrom`, as
        `/api/auth/signup` does), **neutral response always** ("If you have a pending invitation, we've
        emailed your link") — mirrors forgot-password posture so it isn't an invite oracle.
  - [ ] Re-derive the pending invite by `lower(invited_email)`; if present, send the correct link
        (magic-link if the auth user is `email_confirmed_at`, invite-link otherwise), both redirecting to
        `/auth/accept-invite?org={slug}` via `/auth/callback`.
  - [ ] **Extract the link-generation + email-send from the reinvite route into a shared helper**
        (e.g. `lib/invite-links.ts` `sendInviteLinkForPendingMember(...)`) and call it from BOTH the
        admin reinvite route and this new route, so the confirmed/unconfirmed link logic is single-sourced.
- [ ] `app/auth/signup/page.tsx` adaptive states (owner mode only; `account=1` mode unchanged):
  - [ ] On submit, branch on Phase 1's `inviteBranch`.
  - [ ] **Invited state:** collapse org-name + credentials + CTA; render the `.invitePanel` card
        ("You've been invited to {Org}", role pill, reassurance copy); header icon → `MailCheck` (lime),
        title → "You've Been Invited". Primary CTA "Email me my invitation link" → calls resend →
        `.inviteSent` success box ("Check your inbox…"); "Sending…" disabled state.
  - [ ] **Escape hatch:** grey `.linkMuted` "Not you? Create a new organization instead" → inline
        `.confirmBox` confirm → resolves per Open Decision 2.
  - [ ] **Existing-account state:** field-level `.inlineNotice` under the email input ("An account
        already exists — Sign in instead"); disable Create while shown (user may fix a typo).
  - [ ] **(Optional, gated on Open Decision 1)** on-blur pre-check via new read-only
        `POST /api/auth/invite-check` + the `.checkingSpinner` `Loader2` affordance in the password-eye
        slot. If the enumeration decision says "submit-time only," skip this endpoint and reveal the
        invited card on submit only (Phase 1 already delivers that).
- [ ] Add the new CSS classes to `app/auth/auth.module.css` exactly as enumerated in the design decision
      (`.invitePanel`, `.inviteOrg`, `.inviteRole`, `.inviteBody`, `.inviteSent`, `.inlineNotice`,
      `.linkMuted`, `.btnGhost`, `.confirmBox`, `.confirmActions`, `.emailField`, `.checkingSpinner`,
      `.spin`). Reuse `.submitBtn` / `.footerLink` for CTAs.

### Phase 3 — Secondary leaks & nudges
Lower frequency; same class of problem (other doors into org creation).

- [ ] `/start` chooser (`app/start/page.tsx`): give the "I was invited" tile visual parity / move it up
      so invitees self-select before reaching the owner path. (Design nicety — coordinate with `/design`
      if restyling.)
- [ ] Signed-in add-org path: `app/start/tournament/page.tsx` gate + `/api/org/create` — treat a
      **pending invite** as "you already have somewhere to go" and route to `/home` (pending-invite card)
      instead of creating a stray org. (A signed-in user with a pending invite but no *active* membership
      currently passes the `activeMemberships > 0` gate and can mint a stray org.)

## Architectural Decisions

- **Server guard is authoritative; UI is enhancement.** The signup POST is the security/integrity
  boundary and needs no new endpoint. Rationale: closes the stray-org + credential-tampering hole even
  if the client is bypassed; delivers the invited branch on submit with zero new pre-auth surface.
- **Resend is a new, neutral, rate-limited, unauthenticated endpoint** — the invitee can't call the
  admin-only reinvite route. Neutral "if you have an invite we emailed you" response mirrors
  forgot-password and avoids an invite-existence oracle. Reuses the reinvite route's confirmed/
  unconfirmed link logic via a shared helper (single source of truth).
- **No migration.** All lookups reuse mig-128's `invited_email` + index and existing helpers. Confirmed:
  no schema change, so no DATA_DICTIONARY / snapshot task.
- **Positive, not error.** Visual language is the lime "recognized you" branch panel (design decision
  2026-07-06), not a red error — an invited person is a good-news case.

## Security — email-enumeration reconciliation (explicit)

The prior project deliberately ran its invite check *behind the signup action* (not a pre-auth lookup)
"so it's not an email-enumeration oracle." This plan preserves that by default:

- **Submit-time detection (Phase 1) — CORRECTED by /review 2026-07-06.** The original claim here ("adds
  no new leak") was inaccurate: returning `{inviteBranch:'invited', orgName, role}` to an unauthenticated
  caller who submits a full signup body *is* a new disclosure beyond the pre-existing account-exists
  signal. **Fix applied:** the response now returns **orgName only, NOT role** — role (admin vs staff) is
  the escalation-useful bit and the UX doesn't need it; org name is commonly public and carries the
  "You've been invited to {Org}" copy. The invited-vs-account distinction remains (it's the feature's
  core), but it sits behind the signup rate limiter (6/IP/hr · 40 global/5min) so it is not a fast bulk
  oracle. Owner can tighten further to fully-generic copy if maximum privacy is wanted.
- **On-blur pre-check NOT built** (Decision 1) — no pre-auth lookup surface at all.
- **Resend endpoint** always returns neutral + is rate-limited by IP, global, AND per-target-email
  (3/email/hr, added by /review) so it can neither act as an oracle nor spam one invitee's inbox.

## Open Decisions — RESOLVED 2026-07-06 (owner approved recommendations)

1. **On-blur pre-check? → RESOLVED: submit-time only.** Detection runs only on the sign-up submit (no
   pre-auth lookup endpoint, no in-field spinner affordance). No enumeration oracle beyond the
   account-exists signal signup already discloses. `POST /api/auth/invite-check` was **not built**, and
   the `.emailField`/`.checkingSpinner`/`.spin` classes were **not added**.
2. **Escape hatch for an already-invited email → RESOLVED: never create/clobber.** The escape hatch
   reveals an inline explanation and offers only **"Use a different email"** (clears the email, returns to
   the form) — a genuinely separate org is created under a different address. No `createOwnOrg` override
   was plumbed; the server never runs `generateLink({type:'signup'})` on an email that already has an auth
   user. Multi-org for the invited person stays reachable *after* they accept (authenticated add-org path).
3. Copy sign-off on the invited-panel + existing-account lines — low-stakes transactional copy; optional
   `/marketing` tone pass, not blocking.

## Build notes (2026-07-06)

- **P1 (server guard):** `findPendingInviteByEmail()` added to `lib/invite-reconciliation.ts`; owner
  branch of `app/api/auth/signup/route.ts` returns `{inviteBranch:'invited', orgName, role}` or
  `{inviteBranch:'account_exists'}` before creating anything.
- **P2 (UI + resend):** `app/auth/signup/page.tsx` renders the three states; the design-spec classes were
  added to `app/auth/auth.module.css` (minus the dropped on-blur affordance). New
  `POST /api/auth/resend-invite` (unauth, rate-limited, always neutral). Link generation extracted to
  `lib/invite-links.ts` (`sendPendingInviteLink`) and shared by BOTH the admin reinvite route and the
  self-serve resend route (single source of truth).
- **P3 (secondary doors):** `/api/org/create` + `app/start/tournament/page.tsx` route a signed-in user
  with a pending invite to `/home` instead of minting a stray org; the `/start` "I was invited" tile moved
  up to second position.
- **Verification:** typecheck + focused lint clean. Owner browser test + `/review` pending. No migration.

## Testing (manual, browser — owner-run per AGENCY_RULES)

1. Invited new user → owner sign-up screen → enters invited email → sees "You've been invited to {Org}"
   → "Email me my invitation link" → email arrives → accept → lands in the tournament, member ACTIVE.
   **0 stray orgs created.**
2. Invited new user → owner sign-up → submit → server creates no org, invited stub credentials
   untouched (their later email-link accept still works).
3. Already-registered email (no invite) → owner sign-up → field-level "account already exists — sign in";
   Create disabled.
4. Genuine brand-new organizer → owner sign-up → org created exactly as today (regression guard).
5. Escape hatch → per Open Decision 2 resolution (no clobber; lands somewhere sane).
6. Resend endpoint hit for an email with no invite → neutral response, no email, no disclosure.
7. Confirmed-account invitee (already set a password elsewhere) → resend sends a **magic link** (not an
   invite link) and still reaches accept-invite.
8. Secondary (Phase 3): signed-in user with a pending invite but no active org → add-org path routes to
   `/home` card, not a stray org.

## Review & release

- **`/review` (high-risk funnel) before commit** — touches auth/signup + adds two endpoints. Yes.
- Branch: `dev`. No migration ⇒ no prod-migration gating; standard code deploy at release time.
- Residual risk: the enumeration tradeoff (Open Decision 1) — call it out at review.
