# PM Brief — Venue Conflict Prevention & Game Timing Settings

**Created:** 2026-05-26  
**Status:** Planned — not started  
**Full plan:** `docs/projects/active/VENUE_CONFLICT_PLAN.md`

---

## What this is

When a tournament organizer manually schedules games, there is currently nothing stopping them from double-booking a diamond. Two games can be placed at the same venue at the same time, across any two divisions, with zero warning. This feature fixes that.

It also introduces proper tournament-wide game timing settings (how long games run, how much gap is required between them) — which today are hardcoded inside the auto-generator and forgotten after each run.

---

## What changes for admins

**New Event Settings controls:**  
Tournament admins set default game duration (e.g., 90 minutes) and the minimum buffer between games at the same venue (e.g., 15 minutes) once on the Event Settings page. These apply to every division in the event automatically.

**Division-level overrides:**  
For events where one division plays shorter games than another (e.g., U10 plays 70-minute games while U18 plays 90-minute games on the same diamonds), each division can override the tournament default independently. The division setting shows the currently inherited values so admins don't need to navigate away to check.

**Conflict detection when scheduling:**  
When an admin picks a venue, date, and time for a new or edited game, the system instantly checks against every other game in the tournament — across all divisions — and shows one of two responses:

- **Hard block (red):** The proposed game physically overlaps another game still on the field. The Save button is disabled. A "Use [suggested time]" button snaps to the next available slot in one click.
- **Soft warning (amber):** The proposed game starts before the buffer between games has elapsed, but after the prior game ends. Save is allowed — the admin can override intentionally (e.g., back-to-back scheduling with a deliberate tight gap). The suggested next clean slot is shown.

**Conflict badges on the schedule list:**  
Any game already in the schedule with a detected conflict shows a small colour-coded indicator in its time slot. Admins can audit the full schedule at a glance after a bulk edit session without opening each game individually.

**Generator improvement:**  
The auto-generator's game length and buffer fields will now pre-populate from the tournament settings instead of always defaulting to 90/15, saving a manual correction step every time.

---

## Why this matters

Tournament directors scheduling large multi-division events (50–100+ games across 4–6 diamonds) currently have no safeguard against scheduling errors. A double-booked diamond discovered on game day requires scrambling re-scheduling and creates bad experiences for teams. This is a table-stakes reliability feature for any serious tournament management tool.

---

## Technical note (for context)

The feature also introduces a `settings` JSONB column on the `divisions` table (and `pools`, `venue_facilities`), matching the pattern already established on the `tournaments` table. This gives us a flexible configuration bag on those entities for future settings — scoring format, tiebreaker rules, pool advancement logic — without requiring schema changes each time.

---

## Priority

**High** — operational reliability feature; affects every active tournament admin.

## Success criteria

- Admins cannot accidentally save a game that overlaps an existing game's play window without a clear block
- Buffer-zone conflicts are surfaced and the recommended slot is offered in one click
- Tournament game timing settings are configurable and persist across sessions
- Zero regression on existing schedule CRUD
