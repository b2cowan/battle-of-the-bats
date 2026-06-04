# Schedule Timeline (D2) — Venue × Time visual schedule

**Status:** Spec / not started · **Parent:** ADMIN_VISUAL_REDESIGN_PLAN.md (Phase D, bet #2)
**Owner:** —  · **Last updated:** 2026-06-04

## Summary

A **venue × time** grid view of the schedule: facilities down the columns, time down the
rows, each game a positioned block. Added as a **third schedule view alongside List and
Bracket** — nothing is replaced. It answers the spatial/temporal questions the list and
bracket can't ("what's on Diamond #2 at 10am? where are the gaps/double-books?") and lets
organizers **drag a game to a new time/field** instead of editing a form. Pairs directly
with the C5 conflict work by making clashes spatial.

This is the largest build in Phase C/D: grid layout math + positioned blocks + drag-and-drop
write-back. The **read-only grid (D2.1) delivers most of the value**; drag (D2.2) and the
mobile adaptation (D2.3) layer on top.

## What exists already (reuse, don't rebuild)

- **Data:** the full cross-division `games` array is already loaded on the schedule page
  (`schedule/page.tsx`, from the games API) — not division-scoped, so a cross-division grid
  is feasible without new queries. `venues` (diamonds + `venue_facilities`) and
  `schedule_facility_lanes` (temporary facilities) are loaded too.
- **Block size:** `resolveGameTiming(division, tournament)` → `{ durationMinutes, bufferMinutes }`
  gives block height + buffer shading. Duration is a **division setting, not per-game**, so
  blocks are not individually resizable (see Open Decisions).
- **Conflicts:** `buildConflictMap` / `checkVenueConflict` (lib/schedule-conflict) already
  detect overlap/buffer clashes — reuse for cell highlighting on drag + static shading.
- **Write-back:** `handleSaveGame(gameId, { date, time, venueId, venueFacilityId, notes,
  homeTeamId, awayTeamId })` (schedule/page.tsx) persists a move. A drop sets `time` (row) +
  `venueId`/`venueFacilityId` (column) and preserves the rest.
- **Drag:** `@dnd-kit` is already a dependency (BracketBuilder, dashboard) with pointer +
  touch sensors.
- **Identity:** `lib/team-color.ts` for block tint; division as a color/tag.
- **Lock:** `isLocked` already gates editing across the page — Timeline is read-only when locked.

## The four design questions

### 1. How it hangs off the existing view toggle
Today the page has `viewMode` (Round Robin ↔ Playoffs, division-scoped) + `layoutMode`
(List ↔ Bracket). The timeline is **cross-division and spans both round-robin and playoff
games**, so it doesn't sit cleanly under `viewMode`.

**Proposal:** a top-level **`scheduleView`** selection of **List · Timeline** (and Bracket stays for
playoffs), persisted to localStorage like `layoutMode`. Selecting **Timeline** switches into
the cross-division day grid and relaxes the division hard-scope (Division picker becomes a
highlight/filter — see #2). List/Bracket behave exactly as today.

### 2. Cross-division scope
- Timeline shows **all games at the tournament's facilities for one chosen day**, across
  divisions (a venue clash is cross-division by nature).
- **Columns** = facilities: each `venue_facility` (e.g. "Lions Park · Diamond #1/#2") plus any
  temporary `schedule_facility_lanes`. **Rows** = time.
- **Division** is expressed as the block's color/tag (reuse team/division color). The Division
  picker **dims/filters** non-selected divisions but keeps them visible, so cross-division
  conflicts stay on screen. (Decision: all-divisions default, picker as highlight — not a hard
  "one division only" scope.)
- A **day selector** (tournaments run multiple days) chooses the date; default = today if
  within event dates, else day 1.
- Games with **no venue or no time** (TBD) sit in an **"Unscheduled" tray** beside the grid;
  drag them onto a cell to schedule them.

### 3. Drag-to-move write-back
- Drop on a cell → set **start time** (row) + **facility/venue** (column); call
  `handleSaveGame` with the new `time` + `venueId`/`venueFacilityId`, preserving teams/notes/date.
- **Optimistic**: move the block immediately, persist in the background; on failure revert + toast.
- **Snap** to the grid increment (15 min — see Open Decisions).
- **Conflict feedback on drag**: tint the target cell red if the drop would overlap another game
  on that facility (`checkVenueConflict`), amber for a buffer violation. **Warn-and-allow** on
  drop (consistent with the existing save modal + C5), not a hard block — confirmed default,
  revisit in Open Decisions.
- **No resize**: block height = division duration (`resolveGameTiming`); duration isn't per-game,
  so there's no bottom-edge resize. Changing duration stays a division setting.
- `@dnd-kit` pointer + touch sensors; `isLocked` ⇒ read-only (no drag).

### 4. Mobile (a time grid is wide)
A full venue×time grid doesn't fit a phone. **Proposal:** mobile shows **one facility column at
a time** (vertical time axis), **horizontally swipeable** between facilities — same carousel
pattern as the C1 bracket. Drag **reorders times within** the visible facility; **cross-facility**
moves use a **tap → "Move to facility / time" bottom sheet** (cross-column drag is unreliable on
touch). The TBD tray opens from a button/sheet. 44px targets, reduced-motion honored. Desktop
keeps the full multi-column grid with free drag.

## Build phases

- **D2.1 — Read-only timeline (desktop).** Venue×time grid for a chosen day, all divisions;
  blocks positioned by start time + sized by division duration; static conflict/buffer + gap
  shading; TBD tray; day selector; wired into the view toggle. *Delivers most of the value
  ("see the day's field usage") with no drag risk.*
- **D2.2 — Drag-to-move (desktop).** `@dnd-kit` blocks → cells, snap, optimistic
  `handleSaveGame` write-back, on-drag conflict highlight, revert-on-failure.
- **D2.3 — Mobile timeline.** Single-facility swipeable column + tap-to-move sheet + TBD sheet.
- **D2.4 — Polish.** "Now" line (current-time indicator on game day), keyboard a11y for
  drag, loading/empty states, reduced-motion.

## Open decisions (lock before building)

1. **Division scope:** all-divisions default with picker as highlight/filter *(recommended)* vs
   a hard all-vs-one toggle.
2. **Conflict on drop:** warn-and-allow *(recommended, matches C5/modal)* vs hard-block overlaps.
3. **Time range:** derived from the day's games (earliest start → latest end + buffer, padded)
   *(recommended)* vs a fixed window (e.g. 7am–11pm).
4. **Grid snap:** 15 vs 30 min.
5. **Mobile cross-facility move:** tap → sheet *(recommended)* vs attempt cross-column touch drag.
6. **Plus-gating:** base feature vs Tournament-Plus. The generator + playoff wizard are Plus, and
   the timeline is an editing power-tool — **likely Plus** for consistency (confirm with product).

## Trade-offs / risks

- Largest single component in the redesign (positioning math + drag). Mitigate by shipping D2.1
  read-only first.
- Multiple schedule representations to keep consistent — mitigated: all read the same `games`
  data and write via the same `handleSaveGame` (presentation only, one source of truth).
- Dense grids on big multi-facility days; virtualization may be needed for very large
  tournaments (defer until it's a real problem).

## Files

- **New:** `schedule/components/ScheduleTimeline.tsx` (+ `.module.css`); likely a `TimelineBlock`
  child.
- **Edit:** `schedule/page.tsx` (view toggle + Timeline render + day state + pass
  games/venues/facility-lanes/`handleSaveGame`), `schedule-admin.module.css` (toggle option).
- **Reuse:** `lib/schedule-conflict` (timing + conflicts), `lib/team-color`, `@dnd-kit`.
