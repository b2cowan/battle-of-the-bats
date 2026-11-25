# Every tournament game on a real venue — Implementation Plan

> **Created:** 2026-11-19 · **Branch:** dev · **PM brief:** [TOURNAMENT_REAL_VENUES_ONLY_PM_BRIEF.md](TOURNAMENT_REAL_VENUES_ONLY_PM_BRIEF.md)
> **Status:** on the board (`real-venues`), never here.
> **Supersedes, in part:** [GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md](GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md) Phase 2's "free text survives as an
> explicit 'off-site' choice" and its "import must keep accepting text". Everything else in that plan stands (location stays a
> server-written display cache; no database constraint — its Phase 5 stays deferred, for the reason it gives).

## 0 · How this came up (2026-11-19)

The Stage 9 walk's fixture gave its 15 games a date, a time and a TYPED field name, and every one sat in the Timeline's
"Unscheduled" tray: the Timeline places a game only by its linked venue/facility (`ScheduleTimeline.tsx` `facilityOf`,
`unplacedGames`). The owner asked whether that can happen on production. It can, and more easily than the old plan assumed:

- **The game window's typed text is the DEFAULT again.** Game-location Phase 2 (2026-08-08) made picking a field the default and
  typing the explicit "Somewhere else (type it)" choice. Tournament admin redesign Stage 3 retired that picker
  (`docs/projects/archive/TOURNAMENT_ADMIN_REDESIGN_PLAN.md:1453`) for the shared Club 6a `WhereField`, where typed words are an
  ordinary result: `GameWindow.tsx:616-628` → `WhereField.tsx:206-221` → `lib/where-field.ts` `typeVenue` (source `'typed'`) →
  `lib/tournament-where.ts` `placeOfWhere` (no ids, the text as `location`). Typing a venue's exact name and not clicking the row
  still saves text. Verified in the code 2026-11-19.
- The phone move sheet (`MoveSheet.tsx:76, 108-119`) uses the same field.
- The bracket builder still offers "Somewhere else (type it)" (`BracketBuilder.tsx:285-298` → `BracketEditor.tsx:362-368, 421`).
- The spreadsheet import keeps unmatched and ambiguous names as text and lists them (`lib/import/tournament-schedule.ts:562-585,
  785-820`; `ImportSheet.tsx:289-293`; commit `lib/import/tournament-schedule-commit.ts:440, 456`).
- The server accepts text alone from every caller (`lib/tournament-venue-selection.ts:48-51` `resolveVenueSelectionFromCatalog`;
  `app/api/admin/games/route.ts` `resolvedVenueColumns :67-85` for bulk-save, create, save-bracket and both generators; the
  bare-location update `:1383-1389`).
- A typed game is never clash-checked against a real diamond, never on the Timeline grid (it sits in "Unscheduled" with a time),
  and the Timeline's red out-of-order block never shows for it.

## 1 · Owner rulings (2026-11-19) — BINDING

- ✅ **R1 — Require a real venue wherever a person picks a field.** No new typed field names. If the place isn't there, the
  organizer adds it as a venue from where they are.
- ✅ **R2 — The spreadsheet import matches and creates; it saves no more text.** A name the file carries that isn't one of the
  tournament's diamonds is matched to one or created at the review step, before anything is saved.
- ✅ **R3 — A small project of its own**, after the Stage 9 walk.
- ⏳ **R4 — REQUESTED 2026-11-24, not yet scoped or ruled: every schedule, not only tournaments.** The owner, ruling Club
  Website Stage 0 ask A6 (`CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` §7): *"we already are working on stopping this from happening
  in tournaments, can we ensure that all schedules that enter locations populate official venues? not necessarily in this
  project but something to work on separately so we don't have to worry about exceptions like this."* What it reopens:
  §2's "the coach and house-league Where box is untouched" line below. That line rests on Club Tier Ask 13 (2026-10-08),
  which ruled ONE shape for every Where field and kept typed words "that say they aren't checked"; it did not rule that
  typed words must stay. The shape questions the drawing has to answer before anyone builds: (1) a rep coach's away game
  at another club's park, or a standalone coach with no club, becomes a **team place** added from where they are, not a
  club venue; (2) a tryout day at a school, the same; (3) a coach cannot add a club venue, so who may; (4) the old typed
  house league and rep games, listed once to link (A6's "link both" is the interim). Club Website's A6 = A stays the
  answer until this ships.

## 2 · What stays as it is (decided in this plan, from the reasons in the old one)

- **The generator's temporary fields** ("Field 2" before venues exist) — a placeholder that is linked to a real diamond later,
  through its own resolve. Not a typed name. Unchanged.
- **Games already typed on live tournaments** keep their text. The "typed by hand" banner and the Review panel stay as their way
  out. Editing such a game's time or teams does not force a field choice (refusing that would block a rain-delay fix over a
  label); the field box shows the old name as "not linked" and offers the match.
- **No database constraint.** Old Phase 5's reason holds (a NOT NULL that differed between dev and prod broke venue delete on
  production only).
- **The coach and house-league "Where" box is untouched.** Typed words there are a separate, ruled club-side decision (Club Tier
  Ask 13). This change is tournament-only — the shared field gets a tournament mode, it is not changed for everyone.
- **"Not placed yet" stays legal.** A game can save with no field at all; it just can't save with an unlinked typed name.

## 3 · Stages

### S0 — Drawing (owner mockup before build)
One page, whole-screen before/after at true size: the game window's field box (picking, the "Add '<name>' as a venue" row, the
zero-venue state, an old typed game's "not linked" state), the phone move sheet, and the import's review step with its
match/create rows. Run `/design` on it before hand-off. Open questions to put on the drawing:
- **Q1** — Add as a venue: one step (name → a venue with one diamond of that name) or a small form (venue name + how many
  diamonds)? Recommend one step with the sport word, renameable in Venues.
- **Q2** — League/Club orgs: should the field's list also show the club's Venue library venues not yet in the tournament
  (picking one copies it in, the way the zero-venue prompt already offers the library first)? Recommend yes.
- **Q3** — The Review panel's "Leave as typed text" for OLD games: keep (recommended — it only names what's already there) or
  remove so every old name must be linked?

### S1 — The game window and the phone move sheet
- Tournament mode for the Where field: the list is the tournament's venues/diamonds (and, per Q2, the library); typing filters;
  no typed result. Last row "Add '<text>' as a venue" creates the venue (through the existing venue-create path, so the copy
  rules and the sport word hold) and links the game.
- Zero venues: the box says so and offers Add a venue (and the library first on League/Club, per the 2026-08-08 ruling).
- An old typed game opens showing its name as not linked, with the exact match offered when there is one.
- **Server:** create, bulk-save and update refuse a NEW typed `location` without a venue id for tournament games; an unchanged
  stored text passes (§2). The refusal sentence names what to do ("Pick a diamond, or add it as a venue").

### S2 — The bracket builder
"Somewhere else (type it)" becomes the same "Add as a venue". save-bracket refuses new typed text (same server rule).

### S3 — The spreadsheet import
- The review step lists each name the file carries that isn't an exact match: **Match to** (a diamond picker; ambiguous names
  pre-list their candidates) or **Create** (a venue/diamond from the name). Import stays disabled until every name has one.
- Exact matches link as today. Commit writes ids only; nothing lands as text.
- Keep "nothing unmatched blocks the file" in spirit: one name covers all its rows, so a 40-row file with one unknown diamond is
  one decision, not 40.

### S4 — Leftovers and help
- Timeline tray: a game with a time but only an old typed name reads "No diamond picked" with a Review link, not "Unscheduled".
- Help: fix `#faq-offsite-game-location` (it describes a "typed name at the foot of the list" row that doesn't exist) and every
  article that says a venue can be typed (`lib/help-content/tournaments.tsx` ~1501-1514, 1602-1683) — run `/docs`.
- Tests: retire or invert the typed-allowed assertions (`tournament-venue-selection.test.ts:66-67`, `game-window.test.ts`,
  `tournament-schedule-import.test.ts:423, 538, 558`); keep the overlap/conflict tests for old typed games.

### S5 — Review and walk
`/review`, then a short QA walk (one purpose: no new typed name gets in, and old ones still work) in the QA ledger.

## 4 · Risks
- **Rain-day speed.** An organizer moving a game to a park that isn't set up now takes one extra step. Mitigated by the inline add.
- **Venue clutter.** One-off away fields add venues. Accepted (a real venue is clash-checked and on the Timeline).
- **Shared field.** The Where field is shared with the club side; the tournament mode must not change the coach/house-league box
  (a unit test pins both modes).
- **Demo sandboxes.** Check the tournament demo seed writes no typed locations (the build re-seeds on change).
