# PM Brief — Opponent Picker

**Status:** ruled 2026-09-21 (D1–D7 as drawn on the hub; D5 in, D6 held) · built on dev the same day · owner QA walk owed
**Hub:** https://claude.ai/artifact/7BJir7hhGj6C39eVrXGXcn · plan `COACH_OPPONENT_PICKER_PLAN.md`

## What a coach sees differently

- **The Opponent field on Add Game / Edit Game finds the team for you.** Start typing and it lists the
  opponents in your Scouting Book, most recently met first, each with your record against them and the
  last meeting. Pick one and the game takes the book's spelling; the record sits under the name.
- **A team you haven't met yet still just types in.** The list says it's new and the game saves as typed —
  the book gives them a page afterwards, exactly as today. No extra step, no sheet.
- **For a club team that shares its book:** the list also offers the spellings your club's other teams
  have notes under, so the club's notes on an opponent light up the first time you meet them rather than
  after someone spots the mismatch.
- Everything else reads as it does now — the schedule's record chips, the dugout printout, family emails,
  the calendar export, the Scouting Book itself. League imports and tournament games arrive unchanged.

## Why it matters

The Scouting Book groups games by the opponent's spelling, and merges spellings only when a coach says so —
a deliberate rule, so two real teams are never folded together by a guess. That left one gap: the form
where the spelling is typed offered no help, so "Oakville Thunder" in June and "Thunder 12U" in August
became two opponents with a split record until someone noticed and merged. This closes the gap where the
drift is born, by showing the coach the names the book already holds before they can retype one.

## Who it affects, and what happens if we do nothing

Every rep-team coach who enters games by hand — the only one of the three ways an opponent's name reaches
the schedule that a coach actually types into. Do nothing and the book keeps splitting, quietly;
club-sharing teams miss each other's notes with no signal; and the merge tool stays the fix for a problem
the form keeps creating.

## Priority

Small and adjacent: the Location field got this exact treatment on the same form the same morning, so the
pattern, the list and the phone behaviour all exist. This is the second single-value field to use it. No
schema, no migration, no change to how a game is stored.

## Success criteria

- A coach typing the first three letters of an opponent they have met sees that opponent at the top of
  the list, with the same record chip the book shows.
- New opponent pages in the book stop appearing for teams the book already holds — measured across a
  season as a count of merges made, which should fall toward zero.
- On a sharing club team, meeting an opponent a sibling team has notes on shows the club's notes on the
  first meeting.
- Nothing on the Add Game form moves; the field is the same height at rest; the phone sheet is the
  Location field's.

## Deliberately not doing

- Not a tag library. An opponent is one value naming a record — the book — with its own page and merge.
- No link from a game to an opponent record. Two of the three authors (importer, tournament organizer)
  can only supply a name, and the book already resolves names.
- No "Manage…" row in the list and no "Add an opponent" sheet — nothing is minted on the form, and
  merging lives on the opponent's page.
- No guess-and-ask nudge for now (D6, held — revisit with a season's merge count).
