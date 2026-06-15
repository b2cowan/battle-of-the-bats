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

### Phase 1 — Exits & recovery (the "stranded with no exit" cluster) — **DONE 99e06b2**
- [x] **J8-001 (Blocker) — Sign Out is a dead 404 on both shells.** → *A volunteer on a borrowed/shared phone can finally end their session.* — **DONE.** Shared client `components/volunteer/ShellSignOutButton.tsx` (uses `signOut()` → `/auth/login`, styled to match the header link); dead `<Link href="/auth/logout">` removed from both shells.
- [x] **J8-002 — Session-expiry mid-shift dead-ends with no sign-in control.** → *A lapsed session offers a clear way back in.* — **DONE.** Scorekeeper `Notice` gains an optional `action` CTA; the 401 on BOTH the games fetch and the score-save PATCH now shows a "Sign in" button → `/auth/login?next=/<org>/scorekeeper` (forwards back after auth via FP-1's login fix); new `.noticeAction` tap target.

### Phase 2 — Gate roster safety — **DONE a1eafe3**
- [x] **J8-010 — Gate roster Edit is a destructive delete-all + re-insert.** → *Editing at the gate no longer wipes what the coach submitted.* — **DONE.** `save_gate_roster` now diffs: id'd rows update in place (source/source_player_id preserved), id-less rows insert as `source='gate'`, only explicitly-removed rows delete (team-bounded, IDOR-safe). Client sends row ids.
- [x] **J8-011 — "Add roster at the gate" looked like a faint label.** → *The destructive action looks like one.* — **DONE.** `.addRosterBtn` given a distinct field-grade affordance (solid lime fill, ≥44px tap target) vs the neutral Edit.

### Phase 3 — Score-entry ergonomics — **DONE 70ce26c**
- [x] **J8-006 — No "now" signal; all To-Score cards identical.** → *The current game is obvious at a glance.* — **DONE.** First un-scored card gets an "Up next" lime chip + left stripe (`nowCardId`).
- [x] **J8-007 — Score inputs invisible, tiny, no steppers.** → *Usable without training.* — **DONE.** Each input wrapped in a −/+ thumb stepper (≥48px) + brighter input border.
- [x] **J8-008 — Policy-consequence note is skippable grey body text.** → *The "needs admin review" note is visible.* — **DONE.** Iconed, bordered, consequence-toned callout (amber review / lime final).

### Phase 4 — Gate honesty — **DONE 01243f5**
- [x] **J8-014 — Completed event dims the board with no read-only banner.** — **DONE.** Volunteer page shows a banner (completed read-only / draft not-yet-open) + locks the board for any non-active status.
- [x] **J8-015 — Picker never shows tournament status; default can land on a DRAFT.** — **DONE.** Picker/label append `(status)`; default still prefers active.
- [x] **J8-016 — Mark paid is irreversible from the gate.** — **DONE.** "Un-pay" restores PRIOR amounts (owner ruling): sheet snapshots payment state on Mark-paid, replays on undo; server `unmark_paid` + GET exposes deposit_paid/total_paid.
- [x] **J8-017 (Low) — Empty-board copy assumed admin agency.** — **DONE.** "Teams appear here once an admin accepts their registration."

### Phase 5 — Right-door wayfinding (shell half; FP-7 owns org-routing) — **DONE e567124**
- [x] **J8-003 — "Assigned games/fields" copy promises a model that doesn't exist.** — **DONE.** Dropped game-level "assigned" from the 4 false touchpoints (added-user email, 2 role descriptions, scorekeeper empty state → "No games today"). Tournament-scope wording kept (it's real).
- [x] **J8-019 — `official` → blank admin hub dead-end.** — **DONE.** Admin layout redirects an `official` to `/{org}/scorekeeper`.
- [ ] **J8-020 (Med) — `/home` gives the official no gate path** + **J8-021 (Med) — `staff` gate volunteer → full admin dashboard.** → **DEFERRED to FP-7** per the coordination seam (org-level role→surface routing is FP-7's; FP-3 owns the shell dead-end, fixed above). These need capability-aware `/home` destination logic + the role-mapping decision FP-7 owns.

### Phase 6 — Polish — **DONE 9762a2e**
- [x] **J8-004 — PWA install lands on `/home`, not the field surface.** — **DONE.** New per-org scorekeeper manifest route (`start_url` scoped to `/{org}/scorekeeper`); layout references it.
- [x] **J8-005 — "list self-updates" no-ops — `games` not in `supabase_realtime`.** — **DONE.** Migration 130 adds `games` to the publication (idempotent, dev-applied, watermark #130; RLS-disabled table so anon realtime can read). **⚠ DEPLOY GATE: mig 130 dev-only — apply `--prod` before promoting.**

> **FP-3 COMPLETE 2026-06-15** (Blocker + 14 findings; J8-018 was done in FP-1; **J8-020/J8-021 deferred to FP-7** per the wrong-door seam). **Pending:** real-device browser verification + migration-130 prod-apply. Branch `fix/fp3-volunteer-dayof` (off origin/master) — collision-free.

## Verification
`npm run typecheck` (shared-module touches), `npm run lint:focused -- <files>` per phase. Migration (J8-005) dev-first + dictionary + snapshots. Restart dev server after shared/new/proxy changes. Browser/field testing = user (real-device ergonomics).

## Success criteria
A volunteer on a borrowed phone can sign out; a lapsed session recovers; gate roster edits preserve coach data; score entry is usable untrained; each volunteer role reaches the right screen with honest copy.
