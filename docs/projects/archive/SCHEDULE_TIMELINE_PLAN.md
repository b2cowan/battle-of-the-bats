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

> **Control IA consolidated + hierarchical scope (SHIPPED 2026-06-04).** The three overlapping
> toggles (List/Timeline + Round Robin/Playoffs + List/Bracket) were collapsed into a clean
> hierarchy: **Stage** (Round Robin | Playoffs) → **View** (stage-dependent: RR→List/Timeline,
> Playoffs→List/Bracket/Timeline; unified `layout` state replacing `layoutMode`+`scheduleView`).
> The **Flat/Pools toggle was removed** — grouping is automatic. The Division dropdown was replaced
> by a **`ScopePicker`** — a **division** multi-select ("All" + any subset; tri-state checkbox;
> `singleSelect` radio mode for Bracket, which auto-snaps to the first division). **Pools are not
> selectable** — they're conveyed as **color on the timeline cards** (derived from teams' `poolId`).
> `selection: Set<divisionId> | null` (null = all) drives visibility; `filterGroup` is *derived*
> ('all' unless exactly one division is in scope) so the ~20 per-division features still work. Scope
> resets on stage change; the Timeline day snaps to the new stage's first date. Timeline is now
> **stage-scoped**, blocks are **pool-colored**, and the
> **Search/Venue/Status filter row is hidden in Timeline**. *(new ScopePicker.tsx; schedule/page.tsx
> + ScheduleTimeline.tsx.)* **Large blind refactor — needs thorough browser verification.**

### 1. How it hangs off the existing view toggle
Today the page has `viewMode` (Round Robin ↔ Playoffs, division-scoped) + `layoutMode`
(List ↔ Bracket). The timeline is **cross-division and spans both round-robin and playoff
games**, so it doesn't sit cleanly under `viewMode`.

**Proposal:** a top-level **`scheduleView`** selection of **List · Timeline** (and Bracket stays for
playoffs), persisted to localStorage like `layoutMode`. Selecting **Timeline** switches into
the cross-division day grid and relaxes the division hard-scope (Division picker becomes a
highlight/filter — see #2). List/Bracket behave exactly as today.

### 2. Division scope — two modes (RESOLVED 2026-06-04)
The Division picker drives two modes:

**A. All divisions (default).** Every facility column + every division's games on the grid. The
picker acts as a **highlight/filter** — selecting nothing shows all; focusing a division dims the
others while keeping them visible, so cross-division clashes stay on screen.

**B. Single division (honed-in).** Pick one division → the grid shows **only that division's
games** AND **collapses the facility columns to just the facilities that division actually uses**
(derived from its games' `venue_facility_id`s). On a 10+ small-division tournament this removes
the 9+ irrelevant facility columns and the other divisions' blocks, so you see only "this division
on its 1–2 fields."

> **Scope is the shared top Division picker (consolidated 2026-06-04).** Rather than a second
> scope control on the timeline, the top Division picker gained an **"All divisions"** option
> (single-select) and now drives every view: the Timeline reads it (the timeline's own select was
> removed), the **List view** supports "All divisions" too (games **grouped by division header**),
> and **Playoff Bracket** excludes "All" (brackets are per-division → a "pick a division" prompt).
> Publish controls are hidden in "All" (publishing is per-division). *Known: in "All", the
> per-division Schedule Health panel + conflict filter/jump are hidden (per-division concepts);
> cross-division conflict detection remains a Timeline strength — the List sections detect within
> their own division, same as single-division List today.* Multi-select was considered and
> rejected (List/Bracket are single-division; a subset filter is better as a timeline-only
> follow-up).

**Cross-division conflicts are still detected in single-division mode** — the key rule. Conflict
detection always runs over the **full** games set (`buildConflictMap` over all games), so if the
focused division's game clashes with a *foreign* division's game on one of the shown facilities,
it's surfaced: the focused block gets the red/amber conflict treatment, and the foreign game is
drawn as a **faded "ghost" block** (labeled with its division) so you can see exactly what you're
colliding with — even though that division is otherwise hidden.

- **Columns** = facilities (`venue_facility` + temporary `schedule_facility_lanes`); in mode B,
  only the focused division's facilities. **Rows** = time.
- **Division color/tag** on each block (reuse team/division color).
- **Day selector** chooses the date; default = today if within event dates, else day 1.
- **TBD tray**: games with no venue/time sit beside the grid; drag onto a cell to schedule.

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

- ✅ **D2.1 — Read-only timeline (desktop). SHIPPED 2026-06-04.** `ScheduleTimeline.tsx`
  (+ `.module.css`): venue×time grid for a chosen day; **All-divisions** (scope select =
  "All divisions") and **Single-division** (scope = a division → only its games + only its
  facility columns) modes incl. **cross-division ghost blocks** (the conflicting foreign-division
  game renders faded/dashed); blocks positioned by start time + sized by `resolveGameTiming`
  duration; overlap (red outline + tint) / buffer (amber) shading via `buildConflictMap` over ALL
  games; day prev/next selector (days derived from games, defaults to today-if-in-range);
  derived time axis (padded to the hour); sticky time gutter; "N games not yet placed" note for
  TBD. Wired as a desktop **List ↔ Timeline** toggle (`ToolbarSegmentedControl`, `desktopModeControl`
  — mobile toggle waits for D2.3). *Known D2.1 limits: read-only (no drag yet = D2.2); the
  full drag-in TBD **tray** is D2.2 (D2.1 shows a count note); the stage/grouping toolbar controls
  still show in Timeline mode (inert — consolidation is a polish item); mobile = horizontal scroll
  for now.* *(schedule/page.tsx, new ScheduleTimeline component.)*
- ✅ **D2.2 — Drag-to-move (desktop). SHIPPED 2026-06-04.** `@dnd-kit` `DndContext` over the grid;
  each block is a `useDraggable` (`TimelineBlock`), each facility column body a `useDroppable`
  (`DroppableCol`). On drop: new **time** = original start + drag `delta.y / PX_PER_MIN` snapped to
  **15 min**; new **field** = the column dropped on (`over.id`). `onMove(gameId, {time, venueId,
  venueFacilityId})` → page `handleMoveGame` updates `games` **optimistically**, then persists +
  re-syncs via `handleSaveGame` (refetch reverts on failure). Drop-target column highlights while
  dragging; `isLocked` ⇒ read-only (no `onMove`). *Deferred to D2.4: a live conflict preview during
  the drag (for now the dropped block just shows the existing red/amber conflict styling — warn-and-
  allow). Mobile drag is D2.3.* *(ScheduleTimeline.tsx + .module.css, schedule/page.tsx.)*
- ✅ **D2.2b — Unscheduled tray + drag-to-place + add-field column. SHIPPED 2026-06-04.** Replaces
  the old "X games not yet placed" count note. A horizontal **Unscheduled** strip above the grid
  shows draggable cards (`TrayCard`) for in-scope games with no field, scoped to the viewed day
  (date-less games always shown). The grid's last column is a **"+ Field"** menu (`AddFieldMenu`):
  add any unused facility as an **empty column**, or **Create venue…** (opens the existing venue
  dialog via `onCreateVenue`). Dragging a tray card onto a column cell assigns its **field + time
  (drop position, snapped 15 min) + date (viewed day)** through the same `onMove`/`handleMoveGame`
  optimistic write-back (`onMove` signature gained `date`). Grid + tray now share **one
  `DndContext`** (rect-based drop math so tray cards land correctly). The empty state only shows
  when there are no columns **and** no unscheduled games; with unscheduled games present the grid
  renders so a field can always be added. *(ScheduleTimeline.tsx + .module.css, schedule/page.tsx.)*
- ✅ **D2.2c — Venue-occupancy ("busy") view + Conflicts toggle + wider axis. SHIPPED 2026-06-04.**
  Three fixes after first browser test: (1) **Axis widened** to a fixed 8 AM–8 PM minimum (expands
  only for games outside it) + the grid now **scrolls vertically** within a 70vh panel with sticky
  column heads & time gutter + dnd-kit autoscroll — so you can place a game at any time without
  having to drag to discover the row. (2) **Conflicts toggle** (toolbar pill, default ON, live
  count) shows/hides clash styling. (3) **Ghost blocks now show the venue's FULL occupancy**, not
  just current clashes: in single-division scope, with Conflicts on, *every* other-division game
  already booked on a shown field renders as a faded "busy" ghost (Outlook scheduling-assistant
  style) so you can see free slots before dragging. Adding a field via **+ Field** pulls in that
  field's existing bookings too. *(ScheduleTimeline.tsx + .module.css, schedule/page.tsx.)*
- ✅ **D2.2d — Severity-correct conflict cues + buffer messaging. SHIPPED 2026-06-04.** The data model
  already split `overlap` (hard, red) from `buffer` (back-to-back within the travel buffer, soft, amber),
  but the ⚠ icon + count badge + toggle pill were hardcoded red, so a buffer warning read as danger. Now
  every cue is severity-aware: ⚠ icon colours by `data-conflict` (overlap→danger, buffer→warning), the
  count badge + Conflicts pill tint by the worst severity present, block tooltips explain the clash
  ("Starts within the N-min travel buffer after the previous game (tournament setting)" / "Overlaps another
  booking"), and a **colour legend** appears under the toolbar when clashes are visible, naming the
  tournament travel-buffer minutes (`resolveGameTiming(null, tournament).bufferMinutes`). Adjacency is now
  amber + explained, not red. *(ScheduleTimeline.tsx + .module.css.)*
- ✅ **D2.3 — Mobile timeline. SHIPPED 2026-06-04.** At ≤768px (`useIsMobile` matchMedia hook) the
  grid switches to a **single field per screen**: a `fieldPager` header (‹ venue · facility · i/N ›
  + AddFieldMenu) over one full-width column, **swipe** left/right (touch) or chevrons to page fields.
  Drag is replaced by **tap-to-edit**: tapping a game (or an Unscheduled tray card, now a tap button)
  opens a `RescheduleSheet` on the shared `BottomSheet` — a 15-min − / + **time stepper**, a **field
  picker** (all facilities), and a **live conflict status** (`checkVenueConflict`: ✓ free / ⚠ buffer /
  ✕ overlap) with a one-tap **"Use next free slot (HH:MM)"** shortcut; Save → `onMove` (warn-and-allow,
  Save always enabled). Conflicts toggle, busy-ghost occupancy, severity colours, legend, and the
  8 AM–8 PM axis all carry over. Locked schedule (`!onMove`) → read-only (no tap-to-edit). Desktop
  (>768px) drag grid untouched. *(ScheduleTimeline.tsx + .module.css; reuses components/admin/BottomSheet.)*
- **D2.3-followups (optional).** Per-field "done/total" chip in the pager; remember last field across day nav.
- ✅ **D2.4 — Polish. SHIPPED 2026-06-04.** (1) **Live drop preview** — desktop `DndContext`
  `onDragMove` computes the prospective slot (same rect math as drop) + runs `checkVenueConflict`,
  rendering a colour band (`.dropPreview` green/amber/red + target-time chip) in the hovered column,
  cleared on drop/cancel. So the verdict shows *before* releasing (Outlook-style, now on desktop too).
  (2) **"Now" line** — per-minute `nowMin` tick; a lime line across each column + a "now" pill in the
  gutter, shown only when viewing today and within the axis (desktop + mobile). Rendered before blocks
  so games paint over it. (3) **Keyboard a11y** — game blocks are focusable (dnd-kit role/tabIndex on
  desktop; explicit on mobile) and **Enter/Space opens the reschedule sheet** (reuses the D2.3
  `RescheduleSheet` at any width) — schedule is editable without a pointer. Click≠drag preserved
  (no onClick on draggable desktop blocks). Reduced-motion-safe (static cues). *(ScheduleTimeline.tsx
  + .module.css.)*

**D2 (Schedule Timeline) COMPLETE** — D2.1 grid → D2.2 drag → D2.2b tray/+Field → D2.2c occupancy →
D2.2d severity/buffer → D2.3 mobile → D2.4 polish. Remaining = optional follow-ups only (per-field
done/total chip, remember-last-field, sheet-migration of legacy schedule sheets).

## Resolved decisions (2026-06-04)

1. **Plus-gating:** ✅ **Tournament-Plus** (consistent with generator/wizard).
2. **Conflict on drop:** ✅ **warn-and-allow** (matches C5/modal).
3. **Division scope:** ✅ **two modes** — All divisions (picker as highlight) + Single division
   (only that division's games + only its facilities), with cross-division conflict detection +
   faded ghost blocks **always on** (see §2).
4. **Time-of-day axis:** ✅ **derived from the day's games** (earliest start → latest end +
   buffer, padded). *(Separate from the date-range idea below.)*
5. **Grid snap:** ✅ **15-minute snap.** ("Snap" = the granularity a dragged block lands on the
   time axis — a drop near 10:07 lands on 10:00 or 10:15, not 10:07. 15 min gives fine control and
   matches typical start times.)
6. **Mobile cross-facility move:** ✅ **tap → "Move to…" sheet.**

## Deferred enhancement — date-range filter (possibly cross-view)
Beyond the per-day grid, add a **date-range selector that defaults to the whole tournament and
lets you narrow it** — useful when a tournament spans many days/events. The timeline still renders
**one day at a time** (a time grid can't show multiple days), so the range would constrain the day
selector / pre-filter the navigable days. Worth considering as a **shared filter across List +
Bracket + Timeline** (raised by user 2026-06-04 — the List especially benefits with lots of
events). Deferred — not part of the initial D2 build.

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
