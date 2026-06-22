# PM Brief — Volunteer Day-of Experience

> **Created:** 2026-06-13 · **Companion plan:** [VOLUNTEER_DAYOF_EXPERIENCE_PLAN.md](VOLUNTEER_DAYOF_EXPERIENCE_PLAN.md) · **Source:** User Journey Audit Phase 5 (FP-3), new project (no plan previously owned the volunteer shells)

**What it does:** Fixes the two surfaces a tournament hands to its least-trained helpers on its most stressful day — the scorekeeper app at the scoring table and the gate check-in board — so a parent handed a phone for the first time can do the job and get out without getting stuck.

**Why it matters:** Nobody owns these surfaces, and the audit found that the moment the day deviates from "one trained volunteer doing one job," the volunteer is stranded. Sign Out is a dead 404 on both shells, so on a borrowed phone there's no way to log out — a privacy hole. A session that expires mid-shift leaves no way to sign back in. A volunteer from another club who opens the URL gets caught in an endless login loop. The score inputs are nearly invisible with no plus/minus buttons. And the gate's "edit roster" button silently deletes the whole team roster and rewrites a coach's verified data when a volunteer just wanted to fix one jersey number. These are the least-trained users hitting the sharpest edges.

**Who benefits:** Scorekeepers and gate volunteers (and the organizers who recruit them) — and the coaches whose roster data stops getting silently overwritten at the gate.

**Expected impact:** Working sign-out and session recovery on both shells; no more login loops; one-thumb score entry with visible inputs and steppers; a gate roster edit that can't wipe a coach's data; and each volunteer role landing on a surface it can actually use instead of a blank hub or the full admin dashboard.

**Priority:** High — contains a Blocker (the dead Sign Out) and the highest concentration of "stranded with no exit" failures in the whole audit, on the surface with the least-trained users.

**Success criteria:**
1. A volunteer can sign out and recover an expired session on a borrowed phone.
2. The cross-org URL no longer loops forever.
3. Score entry is genuinely one-thumb.
4. Fixing one jersey number can't wipe a coach's roster.
5. Each volunteer role lands somewhere it can act, not a dead end.
