# Public tournament pages — Stage 9, the game-order rule (build prompt, three sessions)

> Written 2026-11-18 (Claude), the day the drawing was ruled. Plan row: `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §9
> Stage 9. **The plan of record is `BRACKET_GAME_ORDER_RULE_PLAN.md`**: its *Findings (investigation, 2026-11-18)* are
> the census of what the code does today (every door, with lines), and its *Rulings, drawing round 1* are the owner's
> answers. **The drawing is the spec:** `BRACKET_GAME_ORDER_RULE_DRAWINGS.html`
> (https://claude.ai/artifact/E1VdDfwpmfEiiR3Re3pPQM, version 3 "Ruled 2026-11-18"); tabs 1–5 are the true-size
> specimens, tab 6 every sentence, tab 7 the twelve asks, **all ruled as recommended 2026-11-18**.
>
> Read `AGENTS.md` and `AGENCY_RULES.md` first. This is admin-side work: no public page changes, no preview switch.
> It reaches customers on its own release.

## What Stage 9 is (one paragraph, so every part shares it)

A tournament game can't be saved to start before a game it waits for has **ended**: a Final before its Semifinals
end, a 3rd Place game before the Semifinal whose loser it takes, a later bracket round before its feeders, and any
playoff game before its division's last pool game ends. **The server refuses it**, in one check every door that sets
a game's day, time, length, sources or status passes through, so a second admin, a stale screen or a direct request is
refused too. The refusal names both games and the way out, in the same sentence at every door. A schedule **already**
out of order is shown, never locked: only a save that **creates** a new problem is refused. On screen, both games of an
out-of-order pair wear a red "Out of order" chip drawn like a double-booked pair; the timeline refuses a bad spot while
dragging; the game window puts the red line under the field that is wrong.

## How this runs: three sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| 1 | The rule: one pure module (sources, end times, pool play, before/after), the server check every writer calls, the refusal sentences, the build check that keeps every writer behind it; the browser's three old copies moved onto it | Unit tests green; every door refused on dev by a direct request; commit on the owner's word |
| 2 | The screens: the chip on both games, the health issue, the Filter row, the drag refusal, the red lines, the read view, the bracket pickers and editor, the rain delay, the window foot and the notice's error face; layout check entries; `/docs` | The screens built to the drawing; the owner checks them on dev |
| 3 | `/simplify`, `/review`, the QA walk, the records | Walk published; plan §9 row, board line, ledger updated |

**Every part:** the `dev` branch only; stage explicit pathspecs (the board, TODO, the ledger and the design log usually
carry other sessions' hunks: commit only yours); a product-owner summary before any code; the owner does browser
testing. **Token discipline:** broad reads go to a helper; read the hunk you are about to edit, not the whole file.
The Findings already list every door with its lines; re-open the lines you build on, don't re-run the census.

### Rulings this stage stands on (do not re-open them; cite them)

Owner 2026-10-29: **block, not warn**, on the server, from every door. The drawing's asks, all **a**, owner 2026-11-18:
- **A1** "After" = after the earlier game **ends**: its start + its length (the game's own, else the division's, else the
  event's: the one length chain, `gameLengthMinutes` in `lib/booking-length.ts`). Equal starts are refused as a result.
  A start exactly at the end is allowed. A start inside the rest time stays the bracket health panel's warning.
- **A2** Already out of order: shown on open. A save is refused **only when it creates a new problem**; a save that
  fixes one, or leaves it as it was, goes through.
- **A3** The bracket editor follows A2: only a problem this edit makes stops Save; old ones list under "Already saved
  this way".
- **A4** The timeline refuses while dragging, like a taken field: the spot turns red with the reason, nothing lands.
- **A5** Both games of a pair wear the chip; each game's window says what is wrong from its own side.
- **A6** The chip's word: "Out of order" (stored sentence case; the shared chip renders capitals, as it does today).
- **A7** Pool play is in, **division-wide**: no playoff game starts before the division's last pool game ends.
- **A8** A changed division or event default game length is refused the same way, on the line beside that window's Save.
- **A9** The source pickers name the bracket ("Gold · Semifinal 1 winner") and a hand-added game joins that bracket.
  Until a game has a bracket, the rule treats an ambiguous source as **every** game it could mean.
- **A10** The words as drawn (tab 6): the fact that blocks it, then the way out. No em dashes.
- **A11** Scripts, the dev seed and the demo's own refresh are not held. **A build check** fails when a new screen or
  route writes game times without the rule.
- **A12** A game both double-booked and out of order shows **Double-booked**; its window shows both red lines.

Settled in the drawing (ratified with the asks): moving a Semifinal later is blocked; "also move the Final" is **not**
in this stage; the generator's fresh draft is never refused (it already drafts after feeder end + rest); a refusal is
before any write, so no change notice goes out. Design log entry 2026-11-18 ("An out-of-order playoff pair is drawn
like a double-booked pair") holds the look. Standing: One Window (2026-10-18: no notice windows, a refusal line beside
the button in every window); "a conflict is a chip" (2026-10-12); the one disabled face; `formatTime()` ("3:00 p.m.");
round names from `bracketGameLabel` ("Final", "Semifinal 2", "3rd Place").

## The technical choices, settled here

1. **One module, pure:** `lib/game-order.ts` (and its words in `lib/game-order-words.ts`, the way
   `lib/tournament-overlap.ts` holds the overlap's). It is the only place that answers "what does this game wait for".
   - **A source edge** is a `Winner <code>` / `Loser <code>` side, resolved within the same **division** and the same
     **bracket id**. Matching is case-insensitive and trimmed (the reading the diagram and the old checks use), which
     is a superset of what the advancer matches, so the rule never misses a real edge. A side whose game has no
     bracket id, in a division with more than one bracket id, resolves to **every** game in the division with that
     code (A9). A code that resolves to nothing is no edge.
   - **A pool edge** (A7): every playoff game of a division that has pool games waits for the **latest-ending**
     non-playoff, non-cancelled game of that division. Playoffs-only divisions have no pool edge.
   - **Cancelled games** are neither sources nor dependents (a cancelled GF2 is not played). Reinstating one re-judges
     it (status is already a placing column).
   - **A game with no day or time** is skipped on either side (a structure-only bracket still saves).
   - **End** = start + `gameLengthMinutes`, compared in calendar minutes (`minutesAt` style: a clocks-change day keeps
     24 h). Refused when the dependent's start is earlier than the source's end.
   - **Before / after:** the rule takes the stored games and the proposed rows (merged exactly as the overlap guard
     merges them) and returns the pairs present **after** that were not present **before**, keyed by the two game ids
     (A2). It reuses no code-keyed map: the old `findBracketSchedulingViolations` keyed by code alone, last one wins,
     which is the scoping defect in the Findings.
2. **The server check** lives beside the overlap guard: `tournamentOverlapRefusal` already reads every game of the
   tournament, the division and event lengths, and merges proposed rows (`lib/tournament-overlap-guard.ts`). Make it
   (or a sibling that `overlapRefused()` also calls, sharing the one read) judge order too, returning
   `409 { error, code: 'game-order', gameId, otherGameId }` with the drawn sentence in `error` (the screens show `error`
   only, through `readRefusal`). Widen what triggers a judgement: placeholders, `bracket_code`, `bracket_id`,
   `is_playoff` and `division_id` join `PLACING_COLUMNS` / `changesPlacement`, and the `update` action's `placesAGame`
   gate. An overlap refusal wins when a save makes both (A12's order).
3. **Every door** in the Findings' table calls it. Specifically new: the CSV import commit route (it has its own venue
   check and never called the guard; pool games only, so A7's edge); the division and event settings writes of
   `game_duration_minutes` (A8: judged with the proposed length applied to every game without its own); the rain
   delay's own check is **replaced** by the shared one (fixing its tournament-wide, code-keyed scope); `bulk-restore`
   and `revert-to-scheduled` are judged like any other write. The playoff and round-robin generator saves already call
   the guard: they gain the order judgement for free.
4. **The build check (A11):** a unit test in the shape of `tests/unit/coach-history-endpoint-guard.test.ts` that lists
   every `.from('games')` insert / update / upsert and every call of the three game RPCs under `app/` and `lib/`, and
   fails unless each is in a route that calls the guard first, or on an allowlist with its reason (demo reconcile, dev
   seed, the score service's score-only writes, advancement's team-only writes). Check `WATCHED_PATHS` in
   `scripts/check-agent-automation.mjs` first: if the new test lands on a watched path, that is the owner's call
   (AGENCY_RULES, shared automation).
5. **The browser** stops having its own rule: the schedule page's `bracketOrderProblem`, the bracket editor's
   `violations` and `planBulkReschedule`'s check all move onto `lib/game-order.ts`, so the screen refuses exactly what
   the server refuses (scoped per division and bracket, end not start).
6. **No migration** is expected. If the build finds it needs one (for example a stored source link), stop and ask: that
   is a different stage.

## Part 1 · The rule on the server

0. Product-owner summary of Part 1 (what an organizer sees: nothing new yet on screen, but every door now refuses on
   the server). No code before it.
1. **`lib/game-order.ts`** per choice 1. Unit-test it with a case table, at minimum: single elimination; a 3rd Place
   game on `Loser`; consolation and placement cascades; double elimination with a cancelled GF2; Gold and Silver tiers
   reusing `SF1`; one bracket per pool reusing codes; two divisions both with `SF1`; a hand-added game with no bracket
   id in a tiered division (waits for both SF1s); pool play (A7) with a cancelled pool game, and a playoffs-only
   division; equal starts (refused); a start exactly at the source's end (allowed); a source on a later day; a game
   with its own length vs the division's vs the event's; no date on either side; before/after (an old pair passes, a
   moved game making a new pair is refused, a fix passes).
2. **The words** (`lib/game-order-words.ts`): every sentence in the drawing's tab 6, built from the pair, the round
   names and `formatTime()`; both games' sides for the read view (A5). Unit-test the words for each case, including two
   sources ("The semifinals end at 1:00 p.m.") and the pool edge ("U13 Boys pool play ends at 5:15 p.m.").
3. **The server check** per choice 2, then **every door** per choice 3. For each door, prove the refusal on dev with a
   direct request (a stale screen's save), in a `.probe/` script with setup and undo: game window `update` (time,
   length, a source picker, a bracket code), `create`, `save-bracket`, both generator replaces (a stale draft),
   `bulk-reschedule` and `bulk-restore`, `revert-to-scheduled`, the import commit, the division and event length.
4. **The build check** per choice 4.
5. **Move the browser's copies** per choice 5; the old tests of `findBracketSchedulingViolations` and `planBulkReschedule`
   move to the new module's cases (keep their intent; the rule they pinned changed: start → end, code → bracket).
6. `npm run verify:changed`, `npm run typecheck` (shared modules and a route contract change). Product-owner summary;
   commit on the owner's word.

## Part 2 · The screens

Build to the drawing; name the shipped component in each step and reuse it.
1. **Tab 1, on open:** the red "Out of order" chip on **both** games (`chip bad`, in the chip's one place on the
   timeline block, the desk Day / All games table and the phone row), the double-booked outline and tint on the block;
   A12's precedence; the health window's issue row "Playoff games out of order" with "Show them ›" (filters to the two
   games); the score's deduction weighed like an overlap (the exact number is this build's to choose and record); the
   Filter's Conflicts group gains "Out of order". No legend, no new fill.
2. **Tab 2, moving:** the refused-drop band and its reason chip for an order problem while dragging (A4), at the same
   moment the taken-field band appears today; the phone move sheet's red line under Day and Start with Move held.
3. **Tab 3, the game window:** the red line (`WhereLine tone="refuse"`, Ban, bold lead) under Day and Start, Length, or
   Away and Home, whichever is wrong; ✓ held and the save pill's held words ("Not saved: Semifinal 2 isn’t over by
   then"); Add game's refusal moves from the grey foot line to the red line, Add game held; the read view's line under
   When, from each game's own side; the pickers name the bracket in a division with several (A9), and a hand-added
   game takes the picked source's bracket id.
4. **Tab 4, the bracket editor:** the banner in round names and times; "Fix this to save" vs "Already saved this way"
   (A3); Save held only by the first.
5. **Tab 5, the rain delay:** the callout's named sentence; rows marked by the shared rule.
6. **Tab 6, windows and the notice:** the line beside Save in the division / event length window (A8), the playoff
   generator's stale draft, putting a cancelled game back; a server-refused move snaps back and the move notice takes
   its error face (red, no Undo, a close button, stays until closed).
7. **Layout check:** entries for the timeline with an out-of-order pair, the game window with the line, the move sheet,
   the bracket editor banner; `check:layout --changed` on dev at 361, 768 and 1440 (no sideways scroll, no tap under
   44 px on a phone).
8. **`/docs`:** the schedule help guides gain the rule (what "Out of order" means, how to fix it, that pool play counts).
9. Product-owner summary; the owner checks it on dev; commit on the owner's word.

## Part 3 · Review, the walk, the records

1. `/simplify`, then `/review` (four lenses). Ask the review to try the side doors: a second admin's change between
   screen and save; a direct request to every route in Part 1 step 3; reused codes across tiers and divisions; a game
   with no bracket id; the default length; the import; reinstating a cancelled game; the rain delay's Undo after
   another move; a placeholder typed in lower case; the build check against a new route that skips the guard.
2. **The QA walk:** a checkable Artifact, 20–50 steps, one action each. Cover: a schedule out of order on open (desk and
   phone, chip on both, health, Filter); dragging a Final too early and a Semifinal too late; the move sheet; the game
   window's three lines and its read view from both sides; Add game in a tiered division; the bracket editor's two
   lists; the rain delay; the default length; pool play (a Quarterfinal before pool play ends); a fix always saves.
   Fixtures with setup and undo scripts in `.probe/`.
3. **Records:** plan §9 row 9 (built, commits, the walk), the board's Public tournament line in the same commit, the
   ledger section. `/release` carries it as its own release (or with the next promote). No migration, no switch.

## Not in Stage 9 (say so if a step drifts toward one)

- "Also move the Final" (a separately priced convenience; plan).
- A database-level rule, or holding scripts and the demo's refresh (A11).
- A stored source-game link or any migration (choice 6).
- The Findings' wider items, each its own `/plan` item: re-scoring a played Semifinal rewriting the Final's team; the
  advancer's exact-case match; `save-bracket` not being one transaction; a cancelled pool game holding seeding forever.
- Any public page change (the public Schedule already sorts by time; it simply stops receiving out-of-order data).
- House league, club and coach schedules (they share none of this code).
