# PM Brief — Schedule Timeline (D2)

**One-liner:** A venue-by-time "air-traffic-control" view of the schedule that lets organizers
see field usage at a glance and drag games to a new time/field — added next to the existing
List and Bracket views, not replacing them.

## Proposed functionality
- A new **Timeline** view on the schedule page: facilities across the top, time down the side,
  every game shown as a block in its slot — across **all divisions** for a chosen day.
- **Gaps and double-books are obvious** spatially (two blocks overlapping a field = a clash),
  reinforcing the C5 conflict work.
- **Drag a game** to a different time or field to reschedule it; it saves immediately (with a
  conflict warning if the new slot clashes). An "Unscheduled" tray holds TBD games to drag in.
- List and Bracket are unchanged — Timeline is a third lens on the same games.

## Why it matters
Organizers already think in "fields × time," but today they reconstruct that from a list in their
heads. A first-class timeline matches their mental model, turns conflict-fixing into drag-and-drop,
and is the single most-requested "wish we had it" view for running an event day.

## Expected customer impact
- Faster day-of rescheduling (drag vs. open-a-form-per-game).
- Fewer missed double-books / awkward gaps, because field usage is visible at a glance.
- A visibly premium, broadcast-grade tool that differentiates from spreadsheet-style competitors.

## Priority
**Phase D / optional, sequenced after Phase C.** High desirability, high effort — the largest
single build in the redesign. De-risked by shipping the **read-only grid first** (most of the
value), then drag, then mobile.

## Success criteria
- An organizer can pick a day and see all facilities' games on one grid, with clashes/gaps obvious.
- Dragging a game to a new slot persists and reflects everywhere (list, bracket, public) — one
  source of truth.
- Works on a phone (one facility at a time, swipe between fields).
- No regression to List/Bracket; respects tournament lock + plan gating.

## Decisions (resolved 2026-06-04)
1. **Tournament-Plus** gated (consistent with generator/wizard).
2. Clashing drop: **warn-and-allow**.
3. Division behavior: **two modes** — All divisions (picker as highlight) + Single division (only
   that division's games + only its facilities), with cross-division conflict alerts (incl. faded
   "ghost" blocks for the colliding foreign-division game) **always on**.

**Deferred enhancement:** a **date-range filter** (defaults to whole tournament, narrowable),
possibly shared across List / Bracket / Timeline.

See `SCHEDULE_TIMELINE_PLAN.md` for the technical spec, phases, and reuse map.
