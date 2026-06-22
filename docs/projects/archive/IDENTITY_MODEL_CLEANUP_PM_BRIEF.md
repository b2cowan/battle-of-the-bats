# PM Brief — Identity Model Cleanup: how the UX changes

**Date:** 2026-06-19 · **Status:** PLANNED → building Phase 1 + Phase 4 first
**Plan:** `IDENTITY_MODEL_CLEANUP_PLAN.md` · **Decision:** `ONE_TO_ONE_VS_MULTI_ORG_DECISION_ANALYSIS.md` (locked 2026-06-19)

## The one-sentence change
The app stops treating every user as a potential multi-organization power-user. The common person — a single coach, a league president, a tournament admin — gets a **clean, single-workspace experience** with no "which organization?" clutter, while the rare person who genuinely wears two hats keeps **one login** that quietly shows them both.

## Why we're doing it
Today the product quietly advertises a "run several organizations from one account" capability that almost no one needs, and our sign-up rules contradict each other about whether that's even allowed. That adds clutter for the 98% and confusion for support. This work makes the experience match reality: **one org by default, more only when you deliberately choose it.**

---

## Before → after, by where the user actually sees it

### 1. Signing in (the home/landing moment)
- **Before:** After login, a user with one workspace is dropped into it — but the launchpad they can reach still shows a prominent **"Start something new"** card inviting them to spin up another organization. The whole frame implies "you probably run several things."
- **After:** A single-workspace user lands straight in their workspace, full stop. The "Start something new" / add-another-organization invitation is **gone**. There is no nudge to create a second org and nothing that looks like a "choose your organization" screen.
- **Who notices:** essentially everyone at sign-in. It simply feels like *their* app, not a multi-tenant console.

### 2. The "add another workspace" path
- **Before:** An already-signed-in user can walk through the organizer on-ramp again and create a **second empty organization** against their account — with no guard. This is the main way confusing, half-set-up duplicate orgs get created.
- **After:** That self-serve "create another empty org" door is **closed**. If someone who already has an organization lands on the on-ramp, we send them home instead. (A brand-new account with no org yet still creates its first one normally — nothing about first-time signup changes.)
- **Who notices:** only people who would have created a duplicate — which is exactly the confusion we want to prevent.

### 3. The "All Workspaces" links (admin sidebar + coach portal)
- **Before:** A persistent "All Workspaces" link appears in the admin sidebar and the coach portal (desktop and mobile) for **everyone**, even users who only have one.
- **After:** Those links appear **only for users who actually have more than one workspace.** A single-workspace user never sees a control whose only purpose is switching between workspaces they don't have.
- **Who notices:** single-org admins and coaches — one less meaningless control.

### 4. The coach who also works in a club (the important exception)
- **Before:** A standalone coach with their own Coaches Portal who tried to also join a club could be **blocked** ("you already belong to another organization") — or pushed toward a second email.
- **After:** That coach is **welcomed with one login.** Their own Coaches Portal never counts against them, so they can hold their portal *and* a club role on a single account and switch between the two. This is the one place we deliberately keep multi-workspace — because it's a real, sensible person, not an edge case.
- **Who notices:** standalone coaches who are also active in a club — they get a seamless single identity instead of a fragmented one.

### 5. Buying a Coaches Portal (guard for later)
- **Before:** Nothing stops one account from buying **two** Coaches Portals. (Not currently reachable because that checkout is switched off — but it's a gap waiting for launch.)
- **After:** One paid Coaches Portal per account; wanting a second = a different email. A clear "you already have one" path instead of an accidental duplicate subscription.
- **Who notices:** future standalone-coach customers — prevents a billing mess before it can happen.

### 6. Removing a teammate (safety fixes)
- **Before:** In a couple of edge cases, removing a member could leave a coach's team stranded and unreachable, or error out if that person had two pending invitations.
- **After:** Member removal is safer and quieter — no orphaned teams, invitations accept cleanly even in unusual cases, and no leftover "ghost" references after someone is removed.
- **Who notices:** admins managing their roster — fewer weird states and support tickets.

---

## What does *not* change
- **First-time signup** is untouched — new users still pick what they're starting and create their first organization.
- **Wearing multiple hats inside one org** is untouched — one person can still be the owner, run tournaments, and be a coach in the *same* organization. That never required multiple organizations and still doesn't.
- **The connected coach/president network vision** stays fully open — it's built on coaches messaging each other across organizations, which doesn't depend on any of this.
- **No existing user is disrupted** — there's nothing to migrate, and we add no permanent "one org forever" rule, so we keep the freedom to go stricter or looser later.

## What we're shipping first
- **Phase 1 — DONE on dev (2026-06-19):** the visible simplification — the "Start something new" / add-a-workspace card is gone, an existing user can no longer self-create a second empty org, and the signup copy no longer promises multiple workspaces.
- **Phase 4 — DONE on dev (2026-06-19):** the three safety fixes (no orphaned coach teams on deletion, clean invite acceptance even with two pending invites, no leftover references after a kept-account removal).
- *Note:* hiding the small "All Workspaces" link for single-workspace users moved into Phase 2, because it relies on the same "how many workspaces does this person have?" signal that phase introduces. Until then it's a harmless link, not a picker — single-org users still aren't shown a chooser.
- **Phase 2 (next, after your review):** the behind-the-scenes rule alignment + the "one home organization" concept (the one-login coach+club case, hiding the All-Workspaces link, and making sign-up/invite/accept agree). This one changes sign-up/invite behavior, so it gets the closer review pass before it goes back to you for testing.
- **Phase 3 (before Coaches Portal goes on sale):** the one-portal-per-email guard.

## How you'll test it (once Phase 1 lands)
- Sign in as a normal single-org account → you land in your workspace with **no** "start something new" card and **no** "All Workspaces" link.
- Try to reach the organizer on-ramp while already signed in with an org → you're sent home, not into a "create another org" form.
- (Seeded) a 2-workspace account still sees the picker and the "All Workspaces" links — so the rare case still works.

## Success criteria
A single-org user never encounters a "choose / add organization" affordance; duplicate empty orgs can no longer be self-created; the one-login coach-plus-club case works; and member removal no longer produces stranded teams or errors.
