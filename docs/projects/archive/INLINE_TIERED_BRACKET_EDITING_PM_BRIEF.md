# PM Brief — Inline Tiered Bracket Editing

**Status:** Planned. A hotfix is already live on `dev`; the full feature is scoped below.
**Priority:** High — current behaviour silently destroys an organizer's bracket setup.
**Created:** 2026-06-19

## What's broken today
A "tiered" playoff bracket splits one division's standings into two or more independent brackets — think **Gold / Silver** or **Tier 1 / Tier 2**. Today these can only be created by the Tournament Plus auto-generator. The hand-editing screen on the Schedule page doesn't understand tiers, so:

- **Editing a tiered bracket wipes the tiers.** An organizer who just wants to add a venue or change a time to a tiered bracket loses the entire tier split the moment they hit Save — the two brackets merge into one.
- **You can't build tiers by hand at all.** The manual builder only makes one bracket.

## What changes for the organizer
- **Editing keeps your tiers.** (Already fixed.) Touching a tiered bracket to tweak a venue, date, or time no longer collapses it.
- **The editor shows tiers as tiers.** Open a tiered bracket inline and you see Gold and Silver as separate, clearly-labelled sections — not one jumbled bracket.
- **Anyone can split a bracket into tiers by hand.** A new "Split into tiers" option in the manual builder lets an organizer define the tier ranges (e.g. seeds 1–4 in Gold, 5–8 in Silver) and wire each tier themselves — **free on every plan**.
- **Tiers finally display correctly everywhere.** Investigation turned up that the public schedule and the admin bracket view don't currently separate tiers into their own sections (they only do this for pool-based brackets). This fix makes tiers show as distinct, titled brackets for fans and admins alike.

## Why it matters
Tiered playoffs are a common format (championship bracket + consolation bracket so every team keeps playing). Right now the platform can generate them but can't safely *maintain* them — a routine edit destroys the organizer's work with no warning. That's a trust problem on game-day. Making tiers durable, hand-editable, and free removes a sharp edge and turns a Plus-only convenience into a capability every organizer can rely on.

## Plan-tier impact
- **Free:** can now build and edit tiered brackets by hand.
- **Tournament Plus:** still gets the one-click auto-generator (seeding + auto-scheduling) as the convenience upsell.

## Tradeoffs / scope notes
- Requires one small database change so each game remembers which tier it belongs to (its tier name) — this is what lets the name survive saves and power the new tier sections in every view.
- Adding a brand-new game to a tiered bracket in the manual editor is handled in the full build; the shipped hotfix already covers the common "edit an existing tiered bracket" case.

## Success criteria
- Editing any field on a tiered bracket never merges or loses tiers.
- An organizer on the free plan can split a bracket into tiers, save, and see them hold.
- Fans (public schedule) and admins (bracket view) see tiers as separate, named sections.
- Single-bracket and pool-based brackets behave exactly as before (no regressions).
