# Every tournament game on a real venue — PM Brief

> Plan: [TOURNAMENT_REAL_VENUES_ONLY_PLAN.md](TOURNAMENT_REAL_VENUES_ONLY_PLAN.md) · Status: on the board, never here · Created 2026-11-19

## What changes
An organizer can no longer type a field name for a tournament game. They pick one of the tournament's diamonds; if the place
isn't there, the list offers **"Add '<name>' as a venue"**, which creates it and links the game in one step. The bracket
builder works the same way. The spreadsheet import stops at its review step for any field name it doesn't recognise, and the
organizer matches it to a diamond or creates it, once per name, before the file imports.

## Why it matters
A typed field name is invisible to the schedule's safety checks: two games typed onto the same park at once are never caught
against a real diamond, and the Timeline can't place the game, so it sits in "Unscheduled" even though it has a time. The
game window quietly went back to saving typed names by default when it was redesigned; this closes that for good.

## Customer impact
- Organizers: one extra step the first time they schedule at a new park; in return every game is checked and on the Timeline.
- Families and teams: the public schedule names a real venue, consistently spelled.
- Games already typed on live tournaments are untouched and keep the "typed by hand" Review panel to link them.
- Coaches and house league: no change.

## Priority
Small, quality goal. After the Stage 9 walk; drawing first, then build.

## Success criteria
- No door in the tournament admin saves a new typed field name (game window, phone move sheet, bracket builder, import).
- A tournament imported from a spreadsheet has zero "typed by hand" games.
- Old typed games still edit, move and score normally.
