# Game-Day Board Customization (Implementation Plan)

**Branch:** `dev` (single shared branch). **Status:** Awaiting sign-off before build.
**Origin:** Surfaced during FP-5 Cluster 3 QA — the dashboard "Customize" affordance is hidden on game day, and the game-day board panels aren't part of the existing drag-and-drop system. Owner asked to make the live board customizable too.

---

## Problem / current state

The tournament admin dashboard has a **Customize** mode (drag to reorder, ✕ to hide, +Add to restore) powered by:
- `DashboardLayout` (`statCards[]` + `panels[]`), persisted in `localStorage` under `fl_dash_v1_{orgSlug}` ([page.tsx:196-245]).
- `panelNode(id)` registry mapping each `PanelId` → its render fn ([page.tsx:1240]).
- `renderPanelZone()` which, in customize mode, wraps panels in `SortablePanel` + an `AddTile` ([page.tsx:1248]).

**But that system only runs in the PRE/POST-event view** (`{!isGameDay && renderMetricStrip()}` / `renderPanelZone()`). The **game-day board** (line ~1478, `{isGameDay ? (<div className={styles.analyticsGrid}>…fixed panels…)`) is hand-written, fixed markup — Now Playing, Games Progress, Team Check-in, Schedule Health, By Division. None of it is draggable/hideable, and the Customize button is gated off on game day (`(isActive && !isGameDay) || isCompleted` at line 1303) precisely because there's nothing there to customize.

So enabling the button without this refactor = a dead-end (customize mode with nothing customizable).

---

## Goal

Make the **game-day board** customizable with the same affordances as the pre-event board: reorder, hide, and re-add its panels, persisted per org. Without entangling the two layouts (a hidden "Payments" panel pre-event must not hide the live "Now Playing" panel, and vice-versa).

## Design — a separate game-day panel set

1. **New panel id union for game day:** `GameDayPanelId = 'nowPlaying' | 'gamesProgress' | 'checkIn' | 'scheduleHealth' | 'byDivision'`.
2. **Extend `DashboardLayout`** with a `gameDayPanels: GameDayPanelConfig[]` array (same `{id,label,visible,order}` shape), with its own `DEFAULT_LAYOUT.gameDayPanels`. Bump the persisted layout `version` to 2 and migrate (unknown → default), so existing saved layouts don't break.
3. **Extract each game-day panel into a render fn** and add a `gameDayPanelNode(id)` registry, mirroring `panelNode`. (Now Playing + By Division become functions like the existing `renderScheduleHealthPanel()`; Games Progress and Check-in lift out of the inline grid.)
4. **Route the game-day board through a sortable zone** — a `renderGameDayZone()` that mirrors `renderPanelZone()`: non-customize = plain grid of visible panels in order; customize = `DndContext`/`SortableContext` with `SortablePanel` + `AddTile` for hidden ones. Reuses the existing `SortablePanel`, `AddTile`, `sensors`, `onPanelDragEnd` patterns (add `onGameDayPanelDragEnd` + `toggleGameDayPanelVisible`).
5. **Unhide Customize on game day:** change the gate at line 1303 to `(isActive || isCompleted)`. Customize now drives whichever zone is showing (game-day zone when `isGameDay`, panel zone otherwise).
6. **Guardrails:** "Now Playing" only renders when there are live games regardless of layout (a visible-but-empty Now Playing panel still shows nothing) — keep that conditional inside its render fn. Don't let a user hide *everything* into an empty board with no escape — the existing "All panels hidden… click Customize to restore" empty state covers this; replicate it for the game-day zone.

## Out of scope

- No new panels/metrics — this is purely making the existing live panels customizable.
- No server-side persistence — stays `localStorage` per org, like today.
- No change to stat cards or the pre-event panel set beyond the `version: 2` migration.

## Files touched

- `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` — types, `DEFAULT_LAYOUT`, load/migrate, registry, render fns, the game-day zone, the Customize gate.
- `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css` — none expected (reuses analyticsGrid/SortablePanel styles); add only if a wrapper needs it.

## Verification

- `npm run typecheck` (shared dashboard component + layout type change).
- `npm run lint:focused` on the page.
- `npm run check:tokens` (CSS guardrail) if any CSS added.
- Manual (owner): on a game-day tournament — Customize appears; reorder/hide/re-add each live panel; reload → layout persists; hide-all shows the restore hint; a pre-existing saved layout still loads (migration). Mobile: board still single-column and fits.

## Risk

- **Medium.** Touches the dashboard's core layout/persistence. Main risks: the `version` migration (mitigated by default-merge fallback), and accidentally coupling the two panel sets (mitigated by a separate `gameDayPanels` array + registry). Behind no flag, but localStorage-only and reversible (clearing the key resets).

## Rollback

Revert the commit; saved layouts with `version: 2` fall back to default on load under the older `version: 1` check (graceful).
