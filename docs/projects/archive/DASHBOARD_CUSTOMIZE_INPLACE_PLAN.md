# Dashboard Customize — In-Place Edit Mode

**Status:** Planned (not started) · Created 2026-06-01
**Owner surface:** Tournament admin dashboard (`/{orgSlug}/admin/tournaments/dashboard`)
**PM brief:** [DASHBOARD_CUSTOMIZE_INPLACE_PM_BRIEF.md](DASHBOARD_CUSTOMIZE_INPLACE_PM_BRIEF.md)

## Problem

Customizing the dashboard today opens a **separate panel** (`renderCustomizePanel`,
[dashboard/page.tsx:898-1039](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx)) that
renders an abstract *list* of the stat cards and analytics panels. Users reorder rows with
◀ ▶ arrow buttons (`moveCard` / `movePanel`, one swap per click), toggle visibility with an
`Eye`/`EyeOff` button, and change icons via an inline picker grid — all while looking *down* at
the real dashboard to see the effect.

Three flow problems:
1. **Proxy editing** — you manipulate a mirror of the dashboard, not the dashboard itself; high mental-mapping cost.
2. **Arrow reorder is slow and indirect** — last→first is 3 clicks with eyes bouncing between list and layout.
3. **Add/remove is buried** behind an eye-toggle inside the panel.

## Decision (confirmed with product 2026-06-01)

- **Fully in-place edit mode.** Remove the separate customize panel. The `Customize` toggle puts
  the *real* dashboard into edit mode with drag handles + × on the live cards/panels.
- **Click a stat card to edit its icon** (keep the 14-icon picker, surfaced as a popover off the card).

## Established pattern to reuse

`@dnd-kit` is already a dependency and is wired in **Rules & Resources**
([RulesAdmin.tsx:709-838](../../../app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx)):
`DndContext` + `SortableContext` + `useSortable` + `GripVertical` handle + `arrayMove` + `useSensors`
(`closestCenter`). Copy this pattern; no new dependency, consistent handle language.

## Data model — unchanged

Keep `DashboardLayout` / localStorage exactly as-is
([dashboard/page.tsx:159-204](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx)):
- `statCards[]` and `panels[]` each carry `{ order, visible, ... }`.
- **Remove** = set `visible:false`. **Add** = set `visible:true`. **Reorder** = `arrayMove` then renumber `order`.
- `loadLayout` / `saveLayout` / `layoutKey` / `updateLayout` untouched. Still per-org, browser-local.

## Implementation outline

### 1. Edit-mode shell
- Reuse existing `isCustomizing` state + the header `Customize`/`Close` toggle
  ([dashboard/page.tsx:1057-1066](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx)).
- Replace `renderCustomizePanel()` usage with a slim **edit toolbar** strip (keeps "Saved to your
  browser" hint + **Reset to defaults** + Done). No second list of cards.
- When `isCustomizing`, the live stat-card row and panels grid render with edit affordances; otherwise normal.

### 2. Two sortable zones
- **Stat-card row** — `SortableContext` with `horizontalListSortingStrategy` (or `rectSortingStrategy`).
- **Analytics panels grid** — `SortableContext` with `rectSortingStrategy` (2-col grid, stacks to 1 on mobile).
- Separate contexts so a stat card can't be dropped into the panels area (different shape/data).
- Drag handle = `GripVertical` in a corner; `×` remove button in the opposite corner. Both only render in edit mode.
- Include `KeyboardSensor` + `TouchSensor` in `useSensors` so keyboard reorder (today's arrows give this) and touch are not regressed.

### 3. Per-zone "+ Add" affordance
- A dashed `+ Add` ghost tile at the end of each zone.
- Click → popover listing items in that zone with `visible:false`. Selecting one sets `visible:true` (appended to end).
- **Context-hidden note:** for stat cards suppressed by tournament phase (`contextHidden`:
  `completed` pre-event, `days` during/after — [dashboard/page.tsx:598-603](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx)),
  show a note in the Add popover ("appears once games are played" / "hidden during the event") so an
  added-but-invisible card isn't mistaken for a bug. Preserve today's `not shown pre-event` badge meaning.

### 4. Icon editing (stat cards only)
- In edit mode, clicking the card body (not the handle/×) opens the icon-picker popover (reuse `ICON_MAP` / `AVAILABLE_ICONS` / `iconPickerGrid`).
- Panels keep fixed icons tied to their data — no icon edit.

### 5. Empty states
- A zone with zero visible items renders only the `+ Add` tile with a short prompt — never blank space.

## Edge cases / flow checklist

- **Happy path** — drag reorder, ×-remove, +Add, click-to-edit-icon, Done all complete in-place.
- **Empty** — all cards removed → Add prompt visible.
- **Context-hidden** — phase-suppressed cards explained in Add popover; not silently missing.
- **Recovery** — Reset to defaults restores `DEFAULT_LAYOUT`; layout autosaves on each change.
- **A11y** — keyboard + touch sensors retain non-mouse reordering.
- **Role/plan** — unchanged; same admins/staff on active/completed tournaments; coaches/public unaffected.

## Files

- `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` — edit-mode shell, sortable zones, +Add popover, icon popover; delete `renderCustomizePanel` arrow/eye UI (keep helpers only if still used).
- `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css` — handle/×/ghost-tile/edit-toolbar styles; retire `customizePanel*` styles.
- Possible new files: `SortableStatCard.tsx` / `SortablePanel.tsx` if extraction reads cleaner.
  **If new files are added, restart the dev server before browser testing** (per AGENTS.md restart rule).

## Out of scope

- Server-side / cross-device layout persistence (stays browser-local).
- Dragging items between the two zones.
- Any change to what the cards/panels display.

---

## Visual Design Spec (from /design, 2026-06-01)

Grounding: flat terminal aesthetic (stat cards `border-radius: 0`, `--hud-surface`, blueprint-blue
border, `--glow-blue`). Per binding decision [2026-05-29], **containers stay blueprint-blue; lime is
the active-accent layer** — edit containers never turn lime, but active affordances (grip grabbing,
drop target, Add-tile hover) use `--logic-lime`, matching the Rules drag handle. No color-only
signals. No new design tokens.

### Edit toolbar strip
- Entry = header `.customizeToggleBtn`; **hide it while editing**, exit via the strip's Done.
- Sticky strip under page header: `1px solid rgba(var(--blueprint-blue-rgb),0.35)`, bg
  `rgba(var(--blueprint-blue-rgb),0.04)`, `border-radius: 0`, `position: sticky; top: 0; z-index: 5`.
- Left: `Settings` icon (lime) + **EDIT LAYOUT** (`--font-data` 0.7rem 700 uppercase lime) + "Saved to
  your browser" (`--data-gray` 0.62rem). Right: **Reset to defaults** (`btn btn-ghost btn-data` +
  `RotateCcw`), **Done** (`btn btn-lime btn-data`). ≤480px: hint hides, actions wrap.

### Stat-card affordances (3 bounded zones)
- `.statCard` edit modifier: `position: relative`, suppress lime hover, `box-shadow: none`, not an `<a>`.
- **Grip** `.cardGrip` abs top-left (inset 4px, 22px, `GripVertical` 14px) — carries dnd listeners.
  Rest `--white-30` → card-hover `--white-45` → `:active` `--logic-lime` + `cursor: grabbing`.
- **Remove** `.cardRemove` abs top-right (radius 2px, `X` 13px). Rest `--white-30` → hover `--danger`
  + `rgba(var(--danger-rgb),0.12)` bg. `stopPropagation`.
- **Icon edit trigger = the 44px `.statIcon` box** (not the whole body): edit-mode `cursor:pointer`,
  hover lime border + tiny `Pencil` 10px badge → opens icon popover. Rest of body inert.

### Panel affordances
- **Grip** `.panelGrip` prepended as first child of `.panelHeader` (same states as `.cardGrip`).
- **Remove** `.panelRemove` at header far-right; **hide `.panelLink`** in edit mode, show `X` instead.
- Panel body `pointer-events: none` in edit mode (kills internal row links); grip + × stay live.
- No icon picker for panels (icons are data-bound).

### "+ Add" ghost tile + add menu
- `.addTile` = last grid cell of each zone, shown when ≥1 item in that zone is hidden; doubles as the
  empty state. `1px dashed rgba(var(--blueprint-blue-rgb),0.4)`, bg `--white-03`, `border-radius:0`,
  sized to the zone cell. Centered `Plus` + "Add card" / "Add panel" (`--font-data` 0.62rem uppercase
  `--data-gray`). Hover → lime border/text + `rgba(var(--logic-lime-rgb),0.04)` bg.
- `.addMenu` popover: `--hud-surface`, `1px solid rgba(var(--blueprint-blue-rgb),0.5)`, `--shadow`,
  radius 2px. Rows = icon + label; select sets `visible:true` (append) and closes.
- **Phase-hidden note** `.addMenuNote` (replaces `.ctxHiddenBadge`): for addable ids in `contextHidden`,
  sub-line `--font-data` 0.58rem `--data-gray` + `Clock` 11px — "Appears once games are played"
  (`completed`) / "Hidden during the event" (`days`). Row stays selectable.

### Icon popover
- Click `.statIcon` → `.iconPopover` (same chrome as `.addMenu`); **reuse `.iconPickerGrid` /
  `.iconPickerBtn` / `.iconPickerBtnActive`**. Keep `expandedIconPicker` state; drop the inline row.

### Drag states (Rules baseline)
- `useSortable` style: `transform`, `transition`, `zIndex: isDragging?100:1`, `opacity: isDragging?0.5:1`.
- Lifted item adds `1px solid var(--logic-lime)` + `--glow-sm`. Neighbors shift via dnd transform.
- **`rectSortingStrategy` for BOTH zones** (they wrap — not `horizontalListSortingStrategy`),
  `closestCenter` collision. `<DragOverlay>` is optional polish, skip for v1.

### Sensors (no a11y/touch regression)
- `PointerSensor` {distance:4}, `TouchSensor` {delay:200, tolerance:8}, `KeyboardSensor`
  (`sortableKeyboardCoordinates`). KeyboardSensor preserves the reordering the old arrows gave.

### WYSIWYG / context-hidden rule
- Edit mode renders exactly the live dashboard (respects `contextHidden`; does not surface
  phase-suppressed cards inline). Phase-hidden management lives only in the Add-menu note.

### Class ledger
- **Add:** `.editToolbar(+Label/Hint/Actions)`, `.cardGrip`, `.cardRemove`, `.panelGrip`,
  `.panelRemove`, `.addTile(+Label)`, `.addMenu(+Row/Icon/Label/Note/Empty)`, `.iconPopover`,
  edit modifiers on `.statCard`/`.analyticsPanel`.
- **Retire:** `.customizePanel*`, `.customizeBody`, `.customizeSection(Label)`, `.customizeList`,
  `.customizeRow(Hidden/Main)`, `.customizeArrows`, `.customizeArrow`, `.customizeIconBtn(Active)`,
  `.customizeCardLabel`, `.customizeVisBtn`, `.customizeDoneBtn`, `.ctxHiddenBadge`. Replace
  `moveCard`/`movePanel` with `arrayMove`.
- **Keep:** `.customizeToggleBtn` (entry), `.iconPickerGrid/Btn/BtnActive`, `.resetBtn` (restyle into toolbar).
