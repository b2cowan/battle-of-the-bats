# Program — Accounts, Access & Invitations

> **Consolidated 2026-07-28.** Replaces 9 account/invite/follow plan-brief files (§5).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §4.

---

## 0. Ground truth (verified 2026-07-28)

The strategic question here is **settled**: "Verified Network" was ratified 2026-07-24 and logged in
`docs/agents/strategy/BUSINESS_DECISIONS.md` (it amends the 2026-06-19 identity decision). The
do-now hardening bundle from that decision was built, committed to `dev`, and its plan already
archived. `dev` is 8 commits ahead of `origin/master`, so that hardening is **live in production**.

What remains is the **phased build-out** of Verified Network plus two smaller unfinished threads.

---

## 1. Outstanding work

### 1.1 Verified Network — the phased build-out
The ratified shape: **open the cheap membership axis** (join or coach across organizations —
unlimited and free) and **gate the expensive ownership axis** (a second org subscription, a second
Premium Coaches Portal) behind light verification.

Built and live: the do-now hardening bundle — support-security reset-email-only, Complete-Transfer
confirmation, portal-coach first-org front door, billing cancel/downgrade org-scoping, one-org leak
fixes on the league / reinstate / head-coach paths, reactivation race fixes.

**Not built:**
- The **verification step itself** — the "tell us you actually run more than one organization" gate on
  owning a second paid thing. During the free period this is just a form; nothing is blocked yet.
- **~~`/api/league/create` has no one-org guard~~ — ✅ FIXED and IN PRODUCTION.** ⚠ *Corrected
  2026-07-28: the account-model analysis said this route was ungated, and this doc repeated it. That
  was true when the analysis was written and was closed days later by the hardening bundle
  (`c36ac94c`, 2026-07-24, confirmed on `origin/master`). League creation now runs the same
  membership check as organization creation.*
- **The one real gap left is smaller: league creation doesn't check for a pending invitation.**
  Organization creation does — if you've been invited somewhere and haven't accepted yet, it stops you
  and sends you to accept first. League creation has no equivalent, so an invited person can spin up a
  league, and that league then blocks the invitation they were actually there to accept. Same
  stray-org trap the sign-up guard was built to prevent, just via a different door.
- **Scorekeeper / official cross-org exemption** — officials are blocked like admins, so a person can't
  officiate in two orgs at once. Named in the analysis as a real gap; no decision taken.

### 1.2 Invite reconciliation — Phases 2–4 tail
Phases 0–3 are built and live (reconcile pending invites by email; "you've been invited to {org}" card
on `/home` with Accept/Decline; signup no longer mints a junk org when a pending invite exists; the
one-org constraint's missing status filter relaxed).

**Open:**
- **Cross-org accept guard (UNDECIDED).** Neither accept path checks for a pre-existing *active*
  membership elsewhere. Surfaced by the Phase 2 review and never ruled on.
- **Junk-org cleanup (Phase 4)** — no agreed definition of an "empty junk org" eligible for cleanup,
  so the cleanup was never built. Stray orgs continue to accumulate.

### 1.3 Multi-org creation for existing users — NOT BUILT
A logged-in user still cannot self-serve a second organization; `/auth/signup` creates user + org
together and rejects existing emails. Needs a `/create-org` page for authenticated users, a route that
creates an org and links the existing `user_id` as owner (no new auth user), and an entry point.
**This is the visible half of the Verified Network ownership axis** — build them together.

### 1.4 Follow ownership & session partition — Phases 2–4
Phase 1 (account-seeded pins clear on sign-out) is applied. Phases 2–4 are **not started**: signed-in
surfaces should show only the account's follows, anonymous device follows should be parked for the
session, and sign-out should clear every follow that existed only because of that session. No migration.
The remaining leak is the "she sees 11" bleed on tournament pages when a device is shared.

### 1.5 Sign-up invite guard — close-out
Built and live; all three open decisions were resolved 2026-07-06 at the owner-approved
recommendations (submit-time detection only, never create-or-clobber an invited email, copy sign-off
non-blocking). **Nothing outstanding beyond confirming the `/review` pass ran.**

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| AA-1 | **Add the pending-invitation check to league creation before League launches?** The one-org guard is already live; this is the remaining half-day of parity work. | Yes — it's small, and without it an invited person can lock themselves out of the org that invited them. |
| AA-2 | **Cross-org accept guard** — should accepting an invite be refused (or warned) when the user already has an active membership elsewhere? | Warn, don't refuse. Verified Network deliberately opens the membership axis. |
| AA-3 | **What counts as an "empty junk org" eligible for cleanup?** Blocks invite-reconciliation Phase 4. | No tournaments, no seasons, no members beyond the creating owner, no activity for 90 days. |
| AA-4 | **Scorekeeper / official cross-org exemption** — should an official be able to work in two orgs? | Yes. Officials are the most obviously cross-org role in amateur sport. |
| AA-5 | **When does the verification gate actually turn on?** It's a no-op during the free period, so it can be built now and armed later — or deferred entirely. | Build it with the multi-org creation page; arm it at the January 2027 conversion. |
| AA-6 | **Follow ownership Phases 2–4 priority** — the shared-device follow bleed is a real privacy-shaped bug but affects few users today. | Do it with the next consumer-layer touch, not standalone. |

---

## 3. Shipped — reference only

- **Verified Network hardening bundle** — support-security reset-email-only, Complete-Transfer confirmation, portal-coach first-org front door, billing cancel/downgrade org-scoping, one-org leak fixes (league / reinstate / head-coach), reactivation race fixes.
- **Auth-email origin fix** — auth-email link hosts resolve through a trusted-origin helper rather than the raw request Origin, closing an account-takeover vector across all five auth/access email routes.
- **Invite reconciliation P0–P3** — reconcile-by-email, pending-invite card on `/home`, signup no longer mints a junk org over a pending invite, one-org constraint status filter fixed.
- **Sign-up invite guard** — an already-invited person is caught at the owner sign-up screen instead of being walked into "Create Your Organization"; a server guard prevents minting a stray org or clobbering the invited stub's credentials; "Email me my invitation link" reuses the shared invite-link sender.
- **Follow ownership Phase 1** — account-seeded pins clear on sign-out.

---

## 4. Source files consolidated (archive candidates)

`ACCOUNT_MODEL_FREEDOM_ANALYSIS.md` · `ACCOUNT_MODEL_FREEDOM_PM_BRIEF.md` ·
`ACCOUNT_MODEL_FREEDOM_EXPLORATION_PROMPT.md` · `INVITE_RECONCILIATION_PLAN.md` ·
`INVITE_RECONCILIATION_PM_BRIEF.md` · `SIGNUP_INVITE_GUARD_PLAN.md` · `SIGNUP_INVITE_GUARD_PM_BRIEF.md` ·
`FOLLOW_OWNERSHIP_SESSION_PARTITION_PLAN.md` · `FOLLOW_OWNERSHIP_SESSION_PARTITION_PM_BRIEF.md`

> **Keep active:** `ACCOUNT_MODEL_FREEDOM_ANALYSIS.md` — it is the reference behind a ratified business
> decision and the phased build-out isn't done. Consider moving it to `docs/agents/strategy/` instead of
> archiving, since it's a living reference rather than a project with an end date.
