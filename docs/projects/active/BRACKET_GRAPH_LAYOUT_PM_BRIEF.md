# Bracket Graph-Layout — PM Brief

**Status:** Proposed (awaiting go-ahead) · Created 2026-06-18
**Plan:** `BRACKET_GRAPH_LAYOUT_PLAN.md`

## What we're changing (plain language)

Today a playoff bracket figures out its left-to-right shape by reading a hidden short
code on each game. If that code is a standard one, the bracket draws correctly. If it's
non-standard — a code an organizer renamed, or one from an older tournament built before
our recent changes — the bracket scrambles: a game ends up in its own column in the wrong
place, even though the teams still advance correctly.

We're switching the bracket to **lay itself out by how games actually feed each other**
(this game's winner plays in that game) instead of by reading the code. After this, the
code becomes a harmless label: an organizer can rename it and the bracket still draws as a
clean tree.

## Why it matters

- **Organizers can't break the bracket picture anymore.** Renaming a game's tag is safe.
- **Old/imported brackets just work.** The production bracket that's currently scrambled
  would render correctly with no data surgery once this ships everywhere.
- **It removes a whole class of "my bracket looks wrong" support issues** at the root,
  instead of fixing them one at a time.

## What the customer sees

- **Organizers (admin):** the Build/Edit bracket screen and the saved bracket view always
  show a correct tree, regardless of what the game tags say. No workflow change — they
  still wire games by picking "Winner of …".
- **Fans (public bracket + PDF):** the public bracket and the printable/PDF bracket draw
  correctly for any bracket shape, including older ones — Phase 2.
- No change to how anyone builds or scores a bracket; this is purely how it's *drawn*.

## Scope & tradeoffs

This touches several screens that each draw a bracket (organizer view, public fan view,
standings, PDF export, the editor). The organizer side is the cheaper half because it
already follows the real wiring. The public fan view and PDF currently draw their connector
lines by *position* (a shortcut that only looks right for tidy standard brackets), so making
them correct for any shape is the larger part of the work.

Because of that, we'll ship in two phases:

- **Phase 1** — every screen places games in the correct columns; the organizer view, saved
  view, wizard preview, and editor are fully correct. Public/PDF columns become correct;
  their connector lines stay as they are today (fine for standard brackets, interim for
  unusual ones — no worse than current).
- **Phase 2** — the public fan view and PDF draw their connector lines from the real wiring,
  so every bracket shape (including the old production one) renders perfectly there too.

## Priority & success criteria

- **Priority:** Medium. It's the durable fix behind a real production bug and a recurring
  support seam; not blocking day-to-day use.
- **Success:** a bracket with renamed/legacy codes renders as a correct, ordered tree on the
  organizer view, the public bracket, and the PDF; standard and double-elimination brackets
  are visually unchanged; the production legacy bracket no longer needs a data repair.

## Risk

The main risk is the double-elimination bracket's two-tier (winners/losers/grand-final)
layout, which is the most complex drawing. We protect it by leaving standard
generator-built brackets on their existing, proven drawing path and only applying the new
graph-based layout to the simpler single-bracket shapes (which is exactly where the breakage
happens). Each phase gets an adversarial review and browser testing on all bracket types.
