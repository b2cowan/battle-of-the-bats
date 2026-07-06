# PM Brief — Manual Pool Assignment

**One-liner:** Let organizers put teams into specific pools by hand, and make the
pools visible even when empty — instead of the current "random shuffle only."

## Why it matters
Pools are a core tournament-setup step. Today, when an organizer turns pools on
but doesn't let teams self-select, the only tool is a **Randomize** button — there
is no way to deliberately place a team (seeding, geography, keeping rivals apart).
Worse, empty pools are hidden on the Teams page, so the pools look like they don't
exist until something is assigned. A real customer (the owner) got stuck here.

## What changes for the user
- **Pools always show.** In the Teams "Pools" view, every pool appears (even empty),
  so it's obvious where teams go.
- **Assign by hand.** A small pool dropdown on each team row moves it into any pool
  in one click.
- **Bulk assign.** Using "Select Many," an organizer can move a batch of teams into
  a pool at once.
- **Randomize stays** as the quick "do it for me" option.
- **No-pools nudge.** If pools aren't enabled yet, the page points them to Divisions.

## Customer impact
Removes a genuine dead-end in tournament setup. Deliberate pool placement is table
stakes for organizers who seed or balance pools; this makes the Divisions screen's
existing promise ("assign pools yourself from the Registrations page") actually true.

## Priority
High-ish — small, self-contained, unblocks a workflow a paying organizer already
tried and couldn't complete. No new plan gating; available wherever pools are.

## Success criteria
- An organizer can move any team into any pool (or back to Unassigned) without
  Randomize.
- Empty pools are visible with their names and a "no teams yet" hint.
- Bulk move works for a multi-select.
- Slot-board (Tournament Plus) divisions are unaffected.
- Public standings/schedule pool grouping still correct after manual moves.
