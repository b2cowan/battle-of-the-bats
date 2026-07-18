# Manual Pool Assignment — Implementation Plan

**Status:** Active — building 2026-07-05
**Area:** Tournaments → Teams (registrations) page
**Migration:** none (backend already supports `poolId` updates via `/api/admin/teams`)

## Problem

When a division has pools enabled but **self-select pool is OFF**, the Divisions
screen promises "you assign pools yourself from the Registrations page" — but no
such manual control was ever built. Consequences the owner hit directly:

1. The only way to get teams into pools is the **Randomize** button (random
   distribution of accepted teams). There is no way to place a specific team in a
   specific pool — no dropdown, no drag-and-drop, no pool field in the Edit modal.
2. In the Teams "Pools" view, **empty pool sections are hidden**
   (`if (teamsInPool.length === 0) return null`), so before any assignment the
   organizer sees only an "Unassigned" bucket and no sign the pools exist — it
   looks like the feature is missing.

## Scope (all client-side UI on the Teams page; no schema/API change)

The teams endpoint already converts `poolId` → `pool_id` (null clears). `patch()`
and the bulk `{ ids, updates }` form both already work. So every part below is UI.

### 1. Always show pool sections in Pools view
- Render every real pool (Pool A/B/C…) even when empty, with a subtle
  "No teams yet" hint and its `(0)` count.
- Keep the **Unassigned** section shown only when it has teams.
- When the division has **no pools at all**, show an inline empty-state pointing to
  Divisions ("No pools yet — enable pools in Divisions") — closes the original
  discoverability trap.

### 2. Inline per-team pool picker (the core ask)
- In Pools view, under each team's name, a compact `<select>` bound to the team's
  current pool: options = Unassigned + each pool.
- `onChange` → `patch(team.id, { poolId: value || '' })` (optimistic; `patch`
  already updates local state and reloads on failure).
- Gated: division has pools (`selectedGroup.pools.length > 0`) **and** not a
  fixed slot-board division (`!slotConfigured`). Slot divisions keep the existing
  slot-board place/swap flow untouched.

### 3. Bulk "Move to pool" via Select Many
- In the `SelectionActionBar`, add a "Move to pool ▾" control (only when the
  selected division has pools and `!slotConfigured`).
- Assigns all selected teams to the chosen pool (or Unassigned) in one call:
  `POST /api/admin/teams { ids: [...selected], updates: { poolId } }`.
- Fast path for many teams; reuses existing selection plumbing.

### 4. Keep Randomize
- Unchanged; remains the "just distribute them for me" shortcut.

## Deliberately out of scope (V1)
- **Drag-and-drop between pool sections** — nicer on desktop, but fiddly on touch
  and higher risk against the responsive row grid. Dropdown + bulk covers the need
  reliably. Revisit as a V2 delight if requested.
- Any change to the fixed slot-board flow (Tournament Plus slot divisions).

## Files
- `app/[orgSlug]/admin/tournaments/registrations/page.tsx` — pool-section render
  (always show pools), inline per-team picker in `renderFlatRow`, bulk move control
  in the selection bar, small empty-states.
- `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css` — styles
  for the inline picker and empty pool hint.

## Verification
- `npm run verify:changed` + `npm run lint:focused` on the two files.
- Backend untouched; no typecheck-of-shared-modules trigger, but run `typecheck`
  since the page imports shared types.
- Owner browser test: enable pools (self-select off), confirm empty pools show,
  move a team via the inline picker, bulk-move a selection, randomize still works,
  and public/standings pool grouping still reads correctly.

## Follow-ups
- `/docs` — Divisions & Pools help section may need a line about assigning
  teams manually (the promise the copy already makes is now true).
