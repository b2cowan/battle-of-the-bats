# One-User-One-Org Enforcement Plan

**Status:** Backend complete. One UI gap remaining.
**Date:** 2026-05-11

---

## Product Owner Summary

**What problem are we solving?**

FieldLogicHQ is designed so that each person has exactly one account belonging to exactly one organization. Without enforcement, an edge case exists where a user whose account was removed from one org could still be invited into another — or where a member could theoretically appear in two orgs simultaneously.

**What already works (backend is done):**

- **Removing a member is permanent.** When an admin clicks "Remove" on a member, that person's login account is deleted from the platform entirely — not just hidden from the org. If they need to return, they must be re-invited and will complete a fresh account setup.
- **Cross-org invites are blocked.** If an admin tries to invite someone whose email is already active in another organization, the invite is rejected with a clear message: *"This user already belongs to another organization. They must be removed from their current organization before being invited here."*

**What's missing:**

The removal confirmation UI is too casual. An admin sees inline "Remove / Cancel" buttons — but nothing communicates that this deletes the person's account, not just revokes their access to this org. This is a meaningful difference, and the admin should understand it before confirming.

**What changes for the admin after this work:**

- The removal confirmation will clearly state that the user's account will be permanently deleted and they will need to be re-invited to access any org in the future.
- The confirmation step becomes a proper modal (or a clearly worded inline warning) — not just an unlabelled button pair.
- No change to behavior: the delete already happens. This is about making the consequence legible.

**Who is affected:**

- **Org owners and admins** — they now see a warning before confirming member removal that makes the consequence explicit.
- **No change for the person being removed** — the backend behavior is the same.

---

## Current State Audit

### Backend — Complete ✅

| Feature | File | Status |
|---|---|---|
| Auth user deletion on member removal | `app/api/admin/members/[memberId]/route.ts:62` | Done — `supabaseAdmin.auth.admin.deleteUser()` fires on every DELETE |
| Cross-org invite guard | `app/api/admin/members/invite/route.ts:95–107` | Done — 409 returned if email belongs to any other org |
| Same-org duplicate invite guard | `app/api/admin/members/invite/route.ts:83–93` | Done — 409 returned if already a member |

### UI — Gap Identified ❌

| Component | File | Gap |
|---|---|---|
| Member removal confirmation | `app/[orgSlug]/admin/org/members/page.tsx:470–487` | Inline "Remove / Cancel" — no indication that this permanently deletes the user account |

---

## Implementation Plan

### Phase A — Member Removal Confirmation UI

**Goal:** Replace the bare inline confirmation with a clearly-worded warning that communicates permanent account deletion before the admin commits.

**Scope:**
- No API changes
- No schema changes
- UI-only: member removal flow in `app/[orgSlug]/admin/org/members/page.tsx`

**Task checklist:**

- [ ] **A1 — Replace inline confirmation with a warning variant**
  - File: `app/[orgSlug]/admin/org/members/page.tsx`
  - Where: lines 470–487 (the `confirmRemoveId === m.id` branch)
  - Change: wrap the inline confirm block in a small warning panel (styled like the existing `btn-danger` pattern) that includes a sentence such as: *"This will permanently delete their account. They must be re-invited to regain access."*
  - Keep the two buttons (`Remove` / `Cancel`) — just add the explanatory line above them
  - Style: use the existing `styles.inlineConfirmRow` layout; add a `styles.removeWarning` line of text in a muted danger color (small font, `color: var(--color-danger)` or similar)

- [ ] **A2 — Verify cross-org invite error surfaces correctly in the invite modal**
  - The API already returns a 409 with a clear human-readable message
  - Confirm the invite form's `showError()` call (in the invite submit handler) renders this message visibly
  - No code change expected — this is a verification-only step

- [ ] **A3 — Update TODO.md**
  - Mark item complete once A1 is verified in the browser

---

## Out of Scope

- **Re-invite flow** — when a removed member needs to return, they are simply re-invited through the normal invite flow. No dedicated "reinvite removed user" UI needed.
- **Soft delete / deactivation** — the platform intentionally uses hard deletion. No change to this model.
- **Platform admin** — superusers can delete auth users directly through Supabase and do not need this guard.
- **Coach accounts** — coaches authenticate under a separate portal. If/when coach-specific removal flows are built, this constraint should be applied there too, but it is out of scope here.
