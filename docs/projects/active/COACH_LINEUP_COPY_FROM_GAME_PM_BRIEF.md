# Copy a lineup from another game — PM brief

**Plan:** `docs/projects/active/COACH_LINEUP_COPY_FROM_GAME_PLAN.md` · **Hub:** https://claude.ai/artifact/1MsdQnRrdVz63UrWztuEDK

## What changes for the coach

The lineup builder gets a **Tools ⋯** menu holding three things: **Copy from**, **Print** and **Save
as template**. The tools a coach uses while building (Call up, Undo, Redo, Clear) stay on screen.

**Copy from** opens a panel with a **Games / Templates** switch. Games lists the season's earlier games
that have a lineup, newest first, in month bands. A coach picks one (or a template) and chooses what to
bring across:

- **Batting order**: the same order as that game. Positions already on this game stay put.
- **Order and positions**: the whole lineup as it was, pitcher included. The coach sees who played
  where last game and moves players from there ("Frances had three innings at third, so give her
  some outfield").

The copy lands in one step and one Undo takes it back. A player marked Out still comes across, and
today's warning flags them. A call-up in the copied lineup comes across too, called up for this game.
Templates offer the same two choices. On a phone, Copy from fills the screen above the bottom nav.
Nothing prompts the coach on a blank lineup.

## Why it matters

Tournament weekends are when coaches reuse a lineup most. Today the only way to reuse Saturday's
lineup on Sunday is to save it as a template first, which takes four screens and leaves a throwaway
template behind every weekend. The fix puts "same as last game" two taps from the grid.

## Customer impact

Every coach on the lineups feature, at least once per tournament weekend and often between
back-to-back league games. The toolbar also gets calmer: four editing tools and one menu instead of
six squares. The cost is one extra tap to print.

## Priority

Small and contained. It reuses the builder's save path and warnings and the portal's existing Tools
menu, and touches no data model. It also retires a known small defect: answering "Keep current"
bounced the coach out of the Templates drawer.

## Open for the owner

- A ruling of "as drawn" on round 3: the Tools menu, the Games / Templates switch, earlier games
  only, and Print one tap deeper.

## Success criteria

- A coach copies Saturday's lineup to Sunday's game from the builder without making a template.
- Fewer single-use templates get created around tournament weekends.
- No support question about a missing call-up, a vanished player, or where Print went.
