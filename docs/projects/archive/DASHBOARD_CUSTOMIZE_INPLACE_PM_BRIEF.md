# PM Brief — Dashboard Customize: In-Place Edit Mode

**Created:** 2026-06-01 · **Status:** Planned · **Priority:** Medium (UX polish on a daily-use surface)
**Plan:** [DASHBOARD_CUSTOMIZE_INPLACE_PLAN.md](DASHBOARD_CUSTOMIZE_INPLACE_PLAN.md)

## Proposed functionality

Replace the dashboard's separate "Customize" panel with a direct, in-place edit mode. When an admin
clicks **Customize**, the real dashboard becomes editable:

- **Drag** cards and panels by a grip handle to reorder them where they sit.
- **×** on each card to remove it.
- **+ Add** tile at the end of each row to bring removed cards back.
- **Click a stat card** to change its icon.
- **Done** returns to a clean dashboard.

## Why it matters

The current panel makes you edit an abstract *list* and mentally map it onto the layout below —
slow and confusing. Reordering takes multiple arrow clicks. Direct manipulation is what users
expect, and it already exists in **Rules & Resources**, so this makes the admin experience
consistent across the product.

## Expected customer impact

- Faster, more intuitive dashboard personalization (one drag instead of several clicks).
- Lower confusion — what you edit is what you see.
- Consistency with the drag-and-drop admins already know from Rules.

## Access / roles

No change. Same admins and staff who already see the dashboard (active and completed tournaments).
Layout still saves per-org to the browser. Coaches and the public are unaffected.

## Success criteria

- Reorder, remove, add, and icon change all happen on the live dashboard with no separate list.
- Cards hidden by tournament phase (e.g. Completed before games are played) are clearly explained in
  the Add menu rather than silently missing.
- Keyboard and touch users can still reorder (no accessibility regression).
- Existing saved layouts continue to load unchanged.
