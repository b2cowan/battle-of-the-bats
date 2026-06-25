# PM Brief — FP-3 Volunteer Day-of Experience

> Wave-2 fix-project from the User Journey Audit. Branch `fix/fp3-volunteer-dayof`.
> Plan: [FP3_VOLUNTEER_DAYOF_PLAN.md](FP3_VOLUNTEER_DAYOF_PLAN.md) · Source: [JOURNEY_J8_SCOREKEEPER_GATE.md](journeys/JOURNEY_J8_SCOREKEEPER_GATE.md)

## What this is
The day-of experience for the two least-trained people at an event: a parent handed a phone at the scoring table (scorekeeper) and a parent handed a phone at the gate (gate volunteer). Invited yesterday, one email, never seen the product.

## Why it matters
The field screens work on the happy path, but the moment the day deviates — a borrowed phone, an idle session, a roster edit, a completed event — the volunteer is stranded with no exit or shown admin-only language. The headline is a **privacy/security Blocker**: the "Sign Out" button on both volunteer screens is a dead link that 404s, so a volunteer can't end their session on a shared phone — their access stays live for whoever picks it up next.

## Expected customer impact
- Volunteers can sign out (borrowed-phone safety) and recover from an expired session.
- Editing a roster at the gate no longer wipes what the coach submitted.
- Score entry is usable under pressure (visible inputs, thumb steppers, a clear "now" game, a visible review note).
- "Mark paid" at the gate is undoable like every other gate action.
- Each volunteer role lands on the right screen with copy written for them, not for an admin.

## Priority
**Fix-now / Blocker-led.** Smallest of the Wave-2 projects (23 findings: 1 Blocker · 10 High · 9 Med · 3 Low). The volunteer shells are owned by no other plan and carry the highest count of "stranded with no exit" failures.

## Success criteria
A volunteer on a borrowed phone can sign out; a lapsed session recovers; gate roster edits preserve coach data; score entry is usable without training; each volunteer role reaches the right screen with honest copy. Most of this is "a trust-breaking dead-end stops happening," not new features.

## Out of scope
The org-level routing decision for wrong-door volunteers (FP-7 owns it; FP-3 owns the shell half). League/tournament acquisition, admin surfaces, billing.
