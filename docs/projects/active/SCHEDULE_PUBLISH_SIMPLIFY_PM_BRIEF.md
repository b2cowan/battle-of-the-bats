# Schedule Publishing Simplification — PM Brief

> **Status:** Planning
> **Created:** 2026-06-15
> **Related plan:** `docs/projects/active/SCHEDULE_PUBLISH_SIMPLIFY_PLAN.md`

**What it does:** Removes the confusing "publish the schedule with placeholder team names (Team 1, Team 2…) while registration stays open" option. Publishing a schedule becomes one clear action: when the organizer is ready, they close the division's registration and publish — and the public always sees real team names.

**Why it matters:** Coaches told us that publishing a schedule *without* real teams is not a real-world use case — nobody wants to see "Pool A Team 1" on a public schedule. The middle "generic names" mode added a decision the organizer had to make on every publish, with a wrong-choice trap that silently hid the team names they expected to appear. It also forced every public surface, the coach portal, and the notification emails to carry extra "are names hidden?" branching.

**Who benefits:**
- **Org admins / staff (Tournament tier and up):** one publish action, no name-mode decision. Less chance of accidentally hiding team names.
- **Coaches & parents (public):** the published schedule always shows the real matchups it implies — no "placeholders until later" confusion.
- No plan-tier change. Email notification on publish stays a Tournament Plus feature exactly as today.

**Expected impact:**
- The publish modal loses its "Placeholder names vs Real team names" radio. Publishing always uses real names and closes any still-open selected divisions (the existing combined "Close Registration & Publish" confirm step is kept).
- Reopening registration on a published division now unpublishes its schedule (with a reworded confirm), keeping "published" honest — a published schedule always reflects a closed, finalized field.
- The Generator's internal "slot mode" (sketching a bracket from placeholder slots before teams exist) stays available to organizers as a **draft/admin-only** planning tool — it just never appears on the public schedule.

**Priority:** Medium. Direct coach feedback, low technical risk (a net simplification — removing a branch, not adding behavior), and it cleans up logic shared across many surfaces. Not a blocker for the active FP-1…FP-7 audit family, but a good standalone quality win.

**Success criteria:**
1. The publish modal has no name-mode choice; publishing always shows real names and closes selected open divisions.
2. The public schedule, game-detail page, OG image, and coach portal never render placeholder team names for a *published* division (placeholders remain only for genuinely unseeded bracket slots / byes).
3. Reopening registration on a published division unpublishes it, with a clear confirm.
4. No existing division silently exposes previously-hidden team names: any division that was in the old "generic" mode reverts to unpublished and must be re-published intentionally.
5. `npm run check:dictionary` and `npm run check:migrations` pass; the data dictionary and DB snapshots reflect the tightened set of allowed values.
