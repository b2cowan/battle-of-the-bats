# Volunteer Day-of Experience — Implementation Plan

> **Status:** SCOPED 2026-06-13 — spun out of the User Journey Audit (Phase 5, FP-3). **NEW project — no plan previously owned the volunteer shells.** Awaiting owner go-ahead.
> **Branch:** dev. **Companion:** [VOLUNTEER_DAYOF_EXPERIENCE_PM_BRIEF.md](VOLUNTEER_DAYOF_EXPERIENCE_PM_BRIEF.md)
> **Source of truth:** [journeys/JOURNEY_J8_SCOREKEEPER_GATE.md](journeys/JOURNEY_J8_SCOREKEEPER_GATE.md) + [USER_JOURNEY_AUDIT_SYNTHESIS.md](USER_JOURNEY_AUDIT_SYNTHESIS.md) §4 FP-3.

## Goal

The scorekeeper (`/{org}/scorekeeper`) and gate check-in (`/{org}/check-in`) shells serve the two least-trained personas on the most stressful day — a parent handed a phone at the field. The field surfaces are well-built on the happy path, but **no active plan owns them**, and J8 found that every deviation from "one trained volunteer, one job, never logs out" strands the volunteer with no exit. This project gives the volunteer shells the safety rails every other shell already has and makes the field surfaces work for an untrained thumb.

## Scope

The two volunteer shells + their wayfinding. J8 is the source of truth (23 findings, 1 Blocker, 0 refuted). Cross-refs that stay elsewhere: J5-026 (mark-paid data shape → FP-1), J1-077/078 (organizer-side invite path / seat cap → FP-5/FTS), J3-012 (org-context → FP-1, distinct from J8-018's hard loop which is carried here).

### Workstreams (finding IDs)

- **Working exit & re-entry (the safety rails):** J8-001 (**Blocker** — Sign Out is a dead `/auth/logout` 404 on BOTH shells; swap to the `signOut()` client call), J8-002 (session-expiry strands with no sign-in control), J8-018 (cross-org URL = infinite login loop; shares the login-forward root with FP-1's J10-019).
- **Field score entry for an untrained thumb:** J8-007 (invisible inputs, no steppers — port the admin B7 −/+ pattern), J8-008 (the "requires admin review" note is skippable grey text — elevate to an amber banner above the inputs), J8-006 (no "now" signal — LIVE/NEXT stripe + start-time chip), J8-009 (stat-tile hierarchy), J8-005 (realtime publication no-op — verify `public.games` in `supabase_realtime`).
- **Non-destructive gate roster:** J8-010 (Edit deletes the whole roster + rewrites coach provenance + drops DOB/position/notes — make it additive/edit-in-place), J8-011 ("Add roster at the gate" is an invisible link triggering the destructive editor — render as a ghost button), J8-012 (sub-thumb icon action pair), J8-013 (no-show vs check-in false equivalence), J8-016 (mark-paid one-way; reconcile with J5-026).
- **Right-door wayfinding:** J8-019 (official → blank admin hub), J8-020 (/home has no gate path), J8-021 (role mapping backwards: staff gets the full dashboard), J8-022 (public org root no signed-in wayfinding), J8-023 (staff/official indistinguishable), J8-003 (false "assigned games" mental model — align copy or build real scoping), J8-004 (PWA install lands on /home not the field surface).
- **Gate honesty:** J8-014 (completed board dims silently — volunteer-voiced read-only banner), J8-015 (picker can default to a draft/locked event with no status shown), J8-017 (empty-board copy assumes admin agency).

## Phases

- **Phase A — exits + loops (fix-now):** J8-001 (Blocker), J8-002, J8-018. The three ways a volunteer gets permanently stuck on a borrowed phone.
- **Phase B — field score entry:** J8-006/007/008/009 + verify J8-005.
- **Phase C — non-destructive gate roster:** J8-010/011/012/013/016.
- **Phase D — wayfinding + honesty:** J8-003/014/015/017/019/020/021/022/023/004.

## Key decisions

- **J8-001 is fix-now-worthy** (Blocker; a live session left on a shared phone is a privacy hole) — sequence it first, and fix both shells in one pass.
- **The "assigned games" model (J8-003):** lowest-effort honest fix is the copy (officials are unrestricted by design today); real per-field scoping is a larger product decision — flag for the owner.
- **Realtime (J8-005)** is runtime state — verify `public.games` membership in the Supabase publication on dev + prod before deciding the fix.

## Success criteria

1. A volunteer can sign out of both shells and recover from an expired session, on a borrowed phone.
2. The cross-org URL no longer loops; an already-authenticated user is forwarded to a stable destination.
3. Score entry is one-thumb: visible inputs, steppers, and a policy note that's read before saving.
4. Fixing one jersey number can no longer wipe a coach's roster.
5. Each volunteer role lands on a surface it can use, not a blank hub or the full admin dashboard.
