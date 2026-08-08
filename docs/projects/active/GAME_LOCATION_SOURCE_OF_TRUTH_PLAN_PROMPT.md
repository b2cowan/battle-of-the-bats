# Plan prompt — "where is this game?" needs one source of truth

**For:** `/plan` (produce `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md` + `_PM_BRIEF.md`)
**Raised by:** owner, 2026-08-07, during day-of volunteer QA
**Status:** prompt only — no plan written, nothing built

---

## 1 · What was found

A volunteer opened the scorekeeper's **"All fields"** filter and it was empty, on a tournament
whose game cards clearly read "LAB FIELD 1" and "LAB FIELD 2".

Both were true at once, because a game answers "where is this played?" in **three unrelated ways**:

| Representation | What it is | Who reads it |
|---|---|---|
| `games.location` | free text typed onto the game | the card, the ICS feed, every public schedule |
| `games.diamond_id` | a reference to a configured field | the field filter, **conflict detection**, venue admin |
| scheduling lanes | temporary "Field 1/2" labels the auto-scheduler builds against before real venues exist, later *resolved* into a venue and back-filled | the generator only |

Nothing forces them to agree, and two of the three can be absent.

**Divisions are the counter-example, and the shape to copy.** A game references a real division;
there is no typed division string to drift from. Measured on dev: **0 of 410 games** lack a
division. The name on the card is read from the record. That is the target state for fields.

## 2 · Evidence (measured on the dev database, 2026-08-07 — re-measure before planning)

| | games |
|---|---|
| Total | 410 |
| With a real field reference | 191 |
| **Typed location, no field record** | **159 (39%)** |
| No location at all | 60 |
| Missing a division | **0** |

Configured field records across all tournaments: 24.

## 3 · Why this matters more than a dead dropdown

**Double-booking detection silently does not run for 39% of games.** `lib/schedule-conflict.ts`
states it in its own header: *"Free-text location (no venueId) → no check performed."* The data
dictionary agrees on `games.location`: *"free-text venue display fallback when no structured venue
is set (then conflict detection skips — nothing to clash on)."*

So an organiser who types field names onto games instead of configuring fields first gets:

- a schedule that **cannot** warn them they have put two games on one field at one time;
- a field filter that lists nothing, on the screen where it matters most — a volunteer working one
  field of eight on a Saturday;
- no way to ask "what is happening on Diamond 3 today?" anywhere in the product.

None of it announces itself. Every screen renders. The organiser finds out at the field.

**This is a data-integrity problem the owner has explicitly asked to pursue** (2026-08-07): one
source of truth per fact, wherever the product can reasonably get there.

## 4 · What the plan must decide

1. **Does `location` stop being authored?** The obvious end state is that a game references a
   field, and the display string is *derived* from it. Decide whether free text survives at all —
   and if it does (an off-site game at a school with no record), how the product stops that being
   the easy default.
2. **The 159 existing rows.** How many typed strings resolve unambiguously to an existing field
   record by name? What happens to the rest — auto-create a field per distinct string per
   tournament, or leave them and mark them? A backfill that silently guesses wrong puts games on
   the wrong field, which is worse than the current state.
3. **Where authoring changes.** The schedule builder, the game editor, bulk import, and the
   auto-scheduler's lane resolution all write this. Which of them can be made to produce a
   reference, and which must keep accepting text?
4. **Does the scheduling-lane layer survive?** It exists because the generator runs before venues
   are configured. If fields become required, is the lane still needed or does it collapse into
   "create the fields first"?
5. **The coach-side twin.** `rep_team_events.field_number` is free text with no reference, and the
   dictionary notes it deliberately *"mirrors `location`'s no-FK stance"*. Decide whether it is in
   scope or explicitly out — coach events are frequently off-site and may honestly be text.
6. **What conflict detection should do about unresolvable locations.** Silently skipping is what
   made this invisible. Should schedule health say "3 games have no field set, so they are not
   being checked"? That single sentence may be worth more than the migration.
7. **Sequencing.** Is there a first phase that costs little and removes most of the harm — e.g.
   surfacing the gap and defaulting new games to a field — before any schema change?

## 5 · Constraints the plan must respect

- **Schema = dictionary, same unit of work.** Any migration updates `DATA_DICTIONARY.md` and
  refreshes both snapshots. Decide whether a column exists from the snapshots or live
  `information_schema` — **never from migration files** (they mislead in a drifted DB).
- **Migrations are never auto-applied to production.** Dev and prod are schema-identical as of
  2026-08-06 except migration 226; do not widen that gap without saying so.
- ⚠ **`games.location` has a live production history.** Prod was `NOT NULL` while dev was nullable,
  which made deleting a venue fail on production. Migration 202 loosened it (applied to both,
  2026-07-27). Anything that touches this column must not re-create that class of failure.
- Multi-tenant: fields belong to a tournament; nothing may leak across orgs.
- Sport-neutral vocabulary — "field" is the Sport Pack's word here, not a hard-code.
- One shared `dev` branch; no per-feature branches.

## 6 · Explicitly out of scope

- The day-of volunteer bottom bars (`DAY_OF_VOLUNTEER_BOTTOM_BARS_PLAN.md`) — the empty dropdown
  was *found* there but is not caused by it, and that work should not wait on this.
- Venue/facility **admin** UX, unless the plan finds the authoring flow is the root cause.
- Anything about *time* conflicts that is not about identifying the surface.

## 7 · What "done" looks like

- Two games on the same field at the same time are **always** detected, or the product says out
  loud which games it cannot check and why.
- The field filter on the scorekeeper lists every field the day's games are actually on.
- A game's field is stated once and read everywhere, the way its division already is.
- Existing tournaments are migrated without a single game being silently moved to the wrong field.

## 8 · A note on framing for the PM brief

The customer-visible story is not "data model cleanup". It is: **"the schedule can now tell you
you've double-booked a diamond — before Saturday, not on it."** That is the outcome; the single
source of truth is how it is achieved.
