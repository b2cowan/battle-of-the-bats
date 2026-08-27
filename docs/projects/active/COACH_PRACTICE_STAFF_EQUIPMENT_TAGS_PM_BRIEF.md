# PM Brief — Staff & Equipment Libraries for Practice Plans

## What changes for the coach

Today, when a coach builds a practice plan, "who's running this station" and "what to bring" are
both plain typing boxes — every keystroke is remembered as its own separate word, with no shared
list behind it. Type "Cones (12)" tonight and "cones x12" next week, and the app now thinks those are
two different pieces of equipment forever.

After this change, both fields work the way "What this practice is about" already does: start
typing, and the coach picks from a real, growing list of names the team has used before (staff or
equipment), or — if it's genuinely new — presses an explicit "+ Add" to put it on that list for
good. This applies everywhere staff/equipment show up on a plan: the top-of-plan equipment list,
each block's staff, and each station's staff and equipment.

The payoff that matters most: because the list is now a real, shared thing (not just typed words),
**a name only has to be typed correctly once.** A trainer whose name gets typed slightly differently
by two different coaches won't silently split into two people on the roster of names to pick from
going forward.

## What does NOT change

- Nothing about a plan already saved changes on its own — old plans keep showing exactly what was
  typed into them before. The new picker only applies going forward, the next time a coach actually
  edits that plan.
- There's no new screen to manage this list (rename, delete, merge duplicates) in this first pass —
  just the picker itself. If that's wanted later, it's a small add-on since the underlying capability
  already exists once the library is built.
- This does not touch drill or template screens — they don't currently ask for staff/equipment at
  all.

## Why it matters

This closes a gap the tag system was specifically built to prevent (a real defect that already
happened once with "what this practice is about," before it became a tag). Staff and equipment carry
the same risk today, just unnoticed so far because nothing downstream reads them for filtering or
reporting — they were always going to accumulate quiet duplicates.

## Role differences

Same access rules as the existing tag pickers on this screen: anyone who can see the schedule can
pick from the list; adding a brand-new name/item to the shared list is a scheduling action (same
people who can already edit the practice plan itself).

## Priority / effort

Meaningfully larger than it looks from the screen — it's not just a UI swap, it's a new shared list
per team (with its own small database change) plus wiring it into four different spots on the plan.
See the paired technical plan for the full breakdown:
`docs/projects/active/COACH_PRACTICE_STAFF_EQUIPMENT_TAGS_PLAN.md`.

## Success criteria

- Typing a name/item that's a near-duplicate of one already on the team's list reuses the existing
  one instead of creating a lookalike.
- The same staff name or equipment item, once added, is selectable from the same list on every block,
  station, and the plan header — not just the field it was first typed into.
- Printed run sheets keep showing the right names for both old and newly-edited plans.
