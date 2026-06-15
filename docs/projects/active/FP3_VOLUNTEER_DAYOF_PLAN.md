# FP-3 — Volunteer Day-of Experience — Implementation Plan

> **Status:** BUILDING 2026-06-15. **Branch:** `fix/fp3-volunteer-dayof` (off `origin/master`).
> **Source:** [USER_JOURNEY_AUDIT_SYNTHESIS.md](USER_JOURNEY_AUDIT_SYNTHESIS.md) §FP-3 + [JOURNEY_J8_SCOREKEEPER_GATE.md](journeys/JOURNEY_J8_SCOREKEEPER_GATE.md).
> **Companion:** [FP3_VOLUNTEER_DAYOF_PM_BRIEF.md](FP3_VOLUNTEER_DAYOF_PM_BRIEF.md)

## Goal
Fix the two least-trained personas' day-of surfaces (`app/[orgSlug]/scorekeeper/**`, `app/[orgSlug]/check-in/**`) — owned by no existing plan. The field surfaces work on the happy path; this project fixes every place the day deviates from "one trained volunteer, one job, never logs out" and the person is stranded with no exit, no signpost, or copy written for an admin.

## Scope
23 findings — **1 Blocker · 10 High · 9 Med · 3 Low**. Scorekeeper + gate-volunteer shells only.

**Already done (FP-1) — do NOT redo:** J8-018 (cross-org login loop — `getAuthDestination` + login already-auth guard + `/auth/suspended`); J8-016 reconcile builds on `lib/mark-paid.ts` (FP-3 adds the *undo* affordance only).

**Coordination seam:** volunteer wrong-door — FP-3 owns the shell half (J8-019/020/021); **FP-7 owns the org-level routing decision** (don't build that here).

## Phases (one reviewable commit per group; lead with the Blocker)

### Phase 1 — Exits & recovery (the "stranded with no exit" cluster)
- [ ] **J8-001 (Blocker) — Sign Out is a dead 404 on both shells.** Both headers render `<Link href="/auth/logout">` but no such route exists; every other shell uses the `signOut()` client call (`lib/auth.ts:40-43`). → *A volunteer on a borrowed/shared phone can finally end their session.* Refs: `scorekeeper/layout.tsx:110-123`, `check-in/layout.tsx:85-90`. **Fix:** shared client `SignOutButton` (signOut → `/auth/login`), drop the dead Link in both shells.
- [ ] **J8-002 — Session-expiry mid-shift dead-ends with no sign-in control.** Idle phone → games fetch + score PATCH 401 → "Sign in required" with no link/button/redirect. → *A lapsed session offers a clear way back in.* **Fix:** the 401/"sign in required" state renders a sign-in link/redirect to `/auth/login?next=<this shell>`.

### Phase 2 — Gate roster safety
- [ ] **J8-010 — Gate roster Edit is a destructive delete-all + re-insert** that rewrites coach provenance (`source='gate'`) and drops data. → *Editing at the gate no longer wipes what the coach submitted.* **Fix:** non-destructive upsert preserving coach-sourced rows / provenance.
- [ ] **J8-011 — "+ Add roster at the gate" is a faint text link** that looks like a label, not the destructive action it triggers. → *The destructive action looks like one.* **Fix:** real button affordance.

### Phase 3 — Score-entry ergonomics
- [ ] **J8-006 — No "now" signal; all To-Score cards identical.** → *The current game is obvious at a glance.* **Fix:** now-stripe / time-left chip on the soonest/current game.
- [ ] **J8-007 — Score inputs invisible, tiny, no steppers.** → *Usable without training.* **Fix:** high-contrast inputs + −/+ thumb steppers (reuse the admin GameList stepper pattern).
- [ ] **J8-008 — Policy-consequence note is skippable grey body text.** → *The "needs admin review" note is visible.* **Fix:** colour/icon/separation on the finalization note.

### Phase 4 — Gate honesty
- [ ] **J8-014 — Completed event dims the board with no read-only banner.** **Fix:** status banner when `locked` (mirror the admin board's completed/read-only treatment).
- [ ] **J8-015 — Picker never shows tournament status; default can land on a DRAFT.** **Fix:** show status in the picker/label; prefer active.
- [ ] **J8-016 — Mark paid is irreversible from the gate** while every other gate action is undoable. **Fix:** un-pay/undo affordance (reuses FP-1 `lib/mark-paid.ts`).
- [ ] **J8-017 (Low) — Empty-board copy tells the volunteer to "accept registrations"** — agency they lack. **Fix:** volunteer-appropriate empty copy.

### Phase 5 — Right-door wayfinding (shell half; FP-7 owns org-routing)
- [ ] **J8-003 — "Assigned games/fields" copy promises a model that doesn't exist** (5 touchpoints; an unassigned official is UNRESTRICTED). **Fix:** drop/correct the "assigned" language.
- [ ] **J8-019/020/021 — Role→surface mapping is backwards** (`official` → blank admin hub dead-end; `staff` gate volunteer → full admin dashboard; `/home` gives the official no gate path). **Fix (shell half):** right-door routing for the volunteer roles; honest `/home` destinations.

### Phase 6 — Polish
- [ ] **J8-004 — PWA install lands on `/home`, not the field surface** (`start_url`). **Fix:** field-scoped start_url / scope.
- [ ] **J8-005 — "list self-updates" no-ops — `games` not in `supabase_realtime` publication.** **Fix:** migration adds `games` to the publication (+ DATA_DICTIONARY + snapshots).

## Verification
`npm run typecheck` (shared-module touches), `npm run lint:focused -- <files>` per phase. Migration (J8-005) dev-first + dictionary + snapshots. Restart dev server after shared/new/proxy changes. Browser/field testing = user (real-device ergonomics).

## Success criteria
A volunteer on a borrowed phone can sign out; a lapsed session recovers; gate roster edits preserve coach data; score entry is usable untrained; each volunteer role reaches the right screen with honest copy.
