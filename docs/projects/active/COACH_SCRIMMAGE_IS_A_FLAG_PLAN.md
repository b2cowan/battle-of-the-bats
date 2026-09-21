# A scrimmage is a flag, not a kind of game — implementation plan

**Owner ask (2026-09-20):** *"Is there any reason why we restrict changing a game between a 'game'
and 'scrimmage'? The details should be the same, no? Can we just have a 'game' as one thing (not
counting tournament) and have a checkbox that 'marks as scrimmage' that will determine if it is
included in certain stats?"* — ruled **"the flag"** the same day, after the two options were laid
out (a per-game flag vs. a cheap League↔Scrimmage type switch on edit).

**Status:** mockup + brief + plan drawn 2026-09-20; **D1–D6 ruled as recommended the same day; BUILT ON DEV
2026-09-20; migration 306 applied to dev and verified (PROD-OWED, WITH the promote); /simplify + /review +
/docs 2026-09-21; COMMITTED `c255abc5` 2026-09-21; owner QA walk §211 owed (hub QA Walk tab).**
Project hub (Mockup · PM Brief · Full Plan · Decisions, QA Walk added once built):
`docs/projects/active/COACH_SCRIMMAGE_IS_A_FLAG_HUB.html` — published as Artifact
`https://claude.ai/artifact/FPcaNdZd7tY9MgBzm48B4x` (round 1, 2026-09-20). PM brief: `COACH_SCRIMMAGE_IS_A_FLAG_PM_BRIEF.md`.

---

## 1. What the code does today (argued from the code, not from a plan)

The coach schedule has **six event kinds**, stored as `rep_team_events.event_type` under a CHECK:
`external_tournament · tournament_game · scrimmage · league_game · practice · team_event`.
Two of them — `scrimmage` and `league_game` — carry **identical fields**: opponent, home/away,
score, result, tags, lineup, attendance, arrival time, uniform, field, links. They differ only in
what reads them.

### F01 — The kind is locked after creation, for every kind, with no stated reason
The type picker renders only when adding (`schedule/page.tsx` — *"Type — changeable on add …
fixed once an event exists"*), and the event PATCH route never reads a type from the body, so
nothing on the client or the server can change one. No plan or commit records why. The lock is
**right** for the structurally different kinds (a tournament game belongs to a parent; a
tournament has days and child games; a practice carries a plan and linked sessions; a repeating
series has children) and **wrong** for League game ↔ Scrimmage, where nothing would break. It is
a blanket rule that happened to cover one pair it should not.

### F02 — The Free → Premium upgrade files every game as a scrimmage and promises a fix that does not exist
`lib/coach-upgrade-migration.ts` maps the Free tier's `game` → `scrimmage` with the note *"Free
never tracked a result, so no loss; coach can reclassify."* Because of F01 they cannot. An
upgraded coach's whole game history sits outside the record — Overview tile, masthead, Season
Wrapped, Season's End, the Scouting Book — and the only remedy is delete-and-re-add per game.

### F03 — "Choose whether scrimmages count" is a ghost
`lib/coach-season-record.ts` still exports a per-device preference (`readWltPreference`,
`wltStorageKey`, `WLT_DEFAULT`) and the Overview record tile still reads it, but **nothing has
written it since 2026-09-02**, when `SeasonRecordWidget` (the only control) was deleted as
confirmed-dead code in cleanup tranche 6 (`2b45a735`). Insights V3 (`afc15c25`, 07-10) had already
stopped rendering the checkboxes. Today every surface counts league + tournament and never a
scrimmage — and **four help articles** still tell the coach Insights lets them choose ("Insights
lets you choose whether scrimmages count", "That choice lives in Insights — tick or untick the
game types there", "the coach can toggle each and the choice is remembered per team"). The Overview
tile even has a branch for *"No game types selected — choose them in Insights"* that no coach can
reach.

### F04 — "League Game" is the only counted non-tournament kind, so an exhibition the coach wants counted has to lie
A rep team's non-league friendly that the coach wants in their record has nowhere to go except
"League Game". The importer already treats a bare "Game" as a league game — the product's own
vocabulary knows the word "League" is not load-bearing.

### F05 — Two rows, two shapes, one form (visible in the owner's screenshot)
"Scrimmage vs Brampton Gold" and "Scrimmage · @ Brampton Gold" are the same kind of game entered
twice. The auto-name (`deriveGameName`) writes "{Kind} vs {opponent}" regardless of home/away and
only at create time; an event whose opponent or side was set on edit keeps its bare kind-name and
picks up the display suffix (`opponentSuffix`), which *is* home/away aware.

### F06 — Season's End's headline record counted scrimmages; the masthead above it did not (found while building)
The season-results route tallied `overall` over every decided game "deliberately unlike Insights,
because the coach's count-scrimmages preference lives in their browser" — a preference that no
longer existed (F03). So the closed-season page's Results shelf printed one record and the masthead
an inch above it another. Fixed: `overall`, home/away and the scoring line read the counted games;
the by-competition split lists scrimmages as "not counted"; a source guard pins it.

### F07 — The family portal's record counted scrimmages (found while building)
`lib/family-view.ts` counted `scrimmage` among its result-bearing kinds, so a family read a
different W-L than the coach. Fixed with the flag: the same rule as the coach's record.

### What the `scrimmage` kind actually drives (all of it a property of a game)
| Reader | Behaviour today | Under the flag |
|---|---|---|
| Season record (`WRAPPED_RECORD_EVENT_TYPES` — masthead, Overview tile, Insights scoreboard, Season Wrapped, Season's End, season history, `season-results` route, club-admin rep history) | scrimmage type excluded | `is_scrimmage` excluded |
| Scouting Book (`coach-opponents`, `coach-opponent-insights`, opponent page) | `EXH` badge, not counted, `scrimmageCount` | same, keyed on the flag |
| Lineup builder auto-fill default | scrimmage → **Development** | flag → Development |
| Masthead "Next:" word (`EVENT_WORD`) | "scrimmage" | flag → "scrimmage" |
| Schedule mark | swords icon, blue | game icon + a muted **Scrimmage** chip (D6) |
| Auto-name | "Scrimmage vs X" | "vs X" / "@ X" (D2) |
| Import / export "Event Type" | "Scrimmage" written and read | "Scrimmage" still written for a flagged Game and still read (plus "exhibition", "friendly"); "Game" and legacy "League Game" read as Game |
| Repeat weekly | not offered for scrimmages | offered (it is a Game) — D5 |
| Overview "season winding down" cue | ignores scrimmage-only seasons | ignores flagged-only seasons |
| Free→Premium upgrade | `game` → `scrimmage` | `game` → Game, unflagged (F02 fixed) |
| Add menu / type pills | Tournament › Game (Tournament) · Scrimmage · League Game · Practice · Team Event | Tournament › Game (Tournament) · **Game** · Practice · Team event |

---

## 2. The model

**One kind, one flag.** `league_game` stays the stored key (renaming an enum value is a migration
across every reader for no product value); its **label becomes "Game"** everywhere a coach reads
it (D1). A new column `rep_team_events.is_scrimmage boolean NOT NULL DEFAULT false` carries the
decision. `scrimmage` leaves the type union and the CHECK.

**The flag is on Game only** (D3). A tournament game — hand-entered or mirrored from a FieldLogicHQ
tournament — does not carry it: the organizer scores it, and a private "doesn't count" on the coach's
side would put the tournament's record and the coach's record in disagreement; the export contract
would also need a third word. Deferred, not refused — say if a real case turns up.

**What "scrimmage" means, stated once:** *listed on the schedule and in attendance like any game;
left out of the season record and the Scouting Book's numbers; lineups open on Development.*
That sentence is the help article's definition and the export's meaning. **The checkbox itself is one
line — "This is a scrimmage" — with nothing under it** (owner, 2026-09-20, on the round-1 mockup:
*"we don't need to take up so much space with the explanation"*). Same shape as "Repeat weekly".

**No global "count scrimmages" switch** (D4). The per-game flag is the finer instrument: a game the
coach wants counted is a Game — untick the box. The ghost preference is deleted, the unreachable
Overview branch with it, and the help articles say what the product does.

**Flipping the box is always allowed**, before or after a result, and takes effect immediately —
the game moves in or out of the record, the book and the split the moment it saves. No confirm. (The help article says so.)

---

## 3. Owner rulings owed (the Decisions tab carries these; recommendation first)

- **D1 — "League Game" → "Game"** (label, Add menu, type pill, edit-modal title, export word,
  Season's End / Wrapped split label "Games", Insights caption). **Recommended: yes** — the "one
  game" half of the ask; keeping "League" would leave F04 standing.
- **D2 — The auto-name drops the kind word and learns home/away: "vs Brampton Gold" /
  "@ Brampton Gold".** The contract migration re-derives names that **exactly** match the old
  auto-shape ("League Game vs X", "Scrimmage vs X" with X = the row's opponent); a name a coach
  typed is never touched. An edit that changes opponent or side re-derives a name that still has
  the auto-shape. **Recommended: yes** — fixes F05 and stops old rows reading "League Game vs X"
  beside new rows for the rest of a season. Alternative: "Game vs X" (keeps a kind word, no rewrite).
- **D3 — Game only; tournament games do not carry the flag.** **Recommended: yes** (reasoning
  above). I first suggested the opposite in chat; the organizer-scored case changed my mind.
- **D4 — The "count scrimmages" switch is not rebuilt; the ghost is deleted.** **Recommended:
  yes.** Alternative: rebuild it as a *team* setting (not per device) — a real feature, needs its
  own mockup, and the flag makes it mostly redundant.
- **D5 — A flagged Game can repeat weekly** (a standing Tuesday scrimmage with a partner club).
  Falls out of the model. **Recommended: yes.**
- **D6 — The word on the row is a small muted "Scrimmage" chip in the trail slot, whenever the flag
  is on; the mark is the game's shield in the game's colour; the swords icon and the blue token
  retire.** Month/week cells draw a flagged game **outlined** (unfilled) in the game colour — a
  shape cue, not a colour cue — with "Scrimmage" in the cell's title. **Recommended: yes.**
  Alternative: keep a distinct icon for a flagged game (a second mark for one kind, which is the
  thing being removed).

---

## 4. Build — in order

### 4.1 Migration — ONE file, applied to prod WITH the promote (as built)
- **306** (`306_a_scrimmage_is_a_flag_not_a_kind_of_game.sql`): add `is_scrimmage boolean NOT NULL
  DEFAULT false`; fold every `scrimmage` row → `league_game` + `is_scrimmage = true`; re-derive ONLY
  the names the product wrote ("League Game vs X" / "Scrimmage vs X" / a bare "League Game" or
  "Scrimmage" with an opponent → "vs X" / "@ X"; a bare "League Game" with no opponent → "Game");
  replace `rep_team_events_event_type_check` without `scrimmage`. Idempotent; verification queries
  at its foot. **Applied to dev 2026-09-20 and verified** (0 rows of the old kind, 0 old-shape
  names, 4 scrimmages among 128 games). **Prod counted read-only before writing: 2 scrimmage rows,
  2 auto-shaped names, 0 bare — PROD-OWED, WITH the promote.** Recorded in
  `MANUAL_PROD_STEPS.json` as `pending` (steps 2–3 are data-only and invisible to the drift check).
- **Why one file and not expand/contract (the plan's first draft):** the schema-parity gate on the
  master build compares the committed dev and prod snapshots and SEES the CHECK text, so a contract
  migration applied *after* the promote would leave the master build red until it ran. The
  choreography is therefore unavoidable for the CHECK; splitting the column out buys nothing. Cost:
  applied hours ahead, the OLD code (a) cannot create a scrimmage — the CHECK refuses the kind it
  writes — and (b) reads the folded rows as league games and counts them, bounded by the deploy.
  The row mapper still normalizes a stray `scrimmage` row to Game + box (a row written by old code
  in that window renders correctly under the new code) — delete that branch once prod is folded.
- The parity baseline was re-initialised for the in-flight dev-only column and CHECK (the mig-305
  precedent); the release removes both entries when 306 is on prod.
- **Dictionary + snapshots in the same unit of work** (`DATA_DICTIONARY.md` — new column entry,
  the CHECK entry, a gotcha that the flag is the record rule; `npm run refresh:snapshots` — ⚠ it
  has a composite-FK bug on the books; verify the events table section by hand).

### 4.2 The vocabulary (`lib/coach-schedule-vocab.ts`, `lib/types.ts`)
- `RepEventType` loses `'scrimmage'`; `RepTeamEvent` gains `isScrimmage: boolean`.
- `EVENT_LABELS.league_game = 'Game'`, `EVENT_NAME_PREFIX` drops the kind word for games,
  `EVENT_WORD.league_game = 'game'`; new `eventWord(e)` → `'scrimmage'` when flagged, else the
  kind's word (the masthead, the Overview, any sentence).
- `deriveGameName({ homeAway, opponent })` → `"vs X"` / `"@ X"`; `isAutoShapedName(name, event)`
  recognizes the old and new auto shapes so an edit can re-derive without touching a typed name.
- `parseEventTypeCell` returns `{ type, isScrimmage }`: "Scrimmage" / "exhibition" / "friendly" →
  Game + flag; "Game" / "League Game" / "league" / `league_game` → Game.
- The export's "Event Type" cell writes **"Scrimmage"** for a flagged Game and **"Game"** otherwise
  — one column, two words, round-trips through the importer. The import error copy names the
  words it accepts.
- `EVENT_COLORS` / `EVENT_ICONS` drop `scrimmage`; `--evt-scrimmage` retires from `globals.css`
  (both themes) once no reader remains.

### 4.3 The record rule (`lib/season-wrapped.ts`, `lib/coach-season-record.ts`)
- `WRAPPED_RECORD_EVENT_TYPES` stays (league + tournament + legacy external) and gains its partner
  `countsTowardRecord(e)` = type in the list **and** `!e.isScrimmage`. Every SQL reader adds
  `.eq('is_scrimmage', false)` beside its `.in('event_type', …)`: `lib/db.ts` ×2 (history + the
  team-years tally), `lib/coach-masthead.ts`, the `season-results` route. Every in-memory reader
  calls the predicate: `season-wrapped`, `coach-opponents`, `coach-opponent-insights`,
  `insights-digest`, `history/page.tsx`, `history/results/panel.tsx`, the Overview tile,
  `hasRealFinalizedGame`, the club-admin rep schedule + history pages.
- `WLT_CATEGORIES` becomes `COMPETITIONS` keyed by `competitionOf(e)` → `'game' | 'tournament' |
  'scrimmage'` with labels **Games · Tournament · Scrimmages**; `season-wrapped`'s `byType` becomes
  `byCompetition`; Season's End's split reads "Games 8–4 · Tournament 3–2 · Scrimmages 2–1" with
  the scrimmage line quiet and marked "not counted".
- **Delete** `WLT_DEFAULT`, `readWltPreference`, `wltStorageKey`, the Overview tile's
  `noneCounted` branch and its "choose them in Insights" copy, `history/page.tsx`'s hand-copied
  `WLT_DEFAULT`/`localStorage` read, and the `insights-digest` comment that describes the toggle.
  The Overview tile's sub reads **"Scrimmages left out"**; the Insights scoreboard caption reads
  **"Games + tournaments"**.

### 4.4 Screens
- **Schedule** (`schedule/page.tsx`): Add menu and type pills lose Scrimmage and say Game; the
  **Who** section gains the one-line checkbox (label *"This is a scrimmage"*, no hint — the
  existing `formCheck` row) for `league_game` on add **and** edit, mirrored games excluded by kind; the edit-modal title reads
  "Edit Game"; the drawer's kind pill reads "Game" with the Scrimmage chip beside it when flagged;
  the list row's trail carries the chip before the score; month/week cells draw a flagged game
  outlined; the export writes the two words; `changeEventType` clears the flag when leaving Game.
  The PATCH body carries `isScrimmage`; the recurring POST carries it onto every occurrence.
- **Lineups** (`lineups/[eventId]/page.tsx`): default mode `isScrimmage ? 'development' :
  tournament ? 'competitive' : 'balanced'`; the game header can say "Scrimmage" under the title.
- **Scouting Book**: `EXH` badge and `scrimmageCount` off the flag — behaviour unchanged.
- **Masthead**: `eventWord(e)`.
- **Season's End / Wrapped / Insights / Overview** as §4.3.
- **Club-admin rep pages** (`admin/rep-teams/…/schedule`, `…/history/[yearId]`): their private
  label/colour/icon maps drop `scrimmage` and read the shared vocab; their `league_game && result`
  filters add the flag.
- **Free→Premium** (`coach-upgrade-migration.ts`): `game → league_game`, flag false; the note
  corrected.

### 4.5 Routes
- `events` POST: `VALID_TYPES` drops `scrimmage` (the app-side validator is the belt while the
  CHECK still admits it between 306 and 307); `isScrimmage` accepted, coerced to boolean, **only
  honoured on `league_game`**; `isGame` reads the two remaining game kinds.
- `events/[eventId]` PATCH: accepts `isScrimmage` (same rule); still refuses a type.
- `lineup`, `game-console`, `game-moments`, `season-results`: their game-kind lists drop
  `scrimmage`; `season-results` adds the flag to its record predicate.

### 4.6 Help (offer `/docs` after the build)
Articles to correct: "record does not match" (its premise — Insights vs masthead disagreeing by
scrimmage scope — is gone), the Overview record tile article ("tick or untick the game types"),
the Insights hub `searchText` ("record counts league tournament scrimmage choice lives in
insights"), the Premium schedule article's kind list, the tags article ("league games, tournament
games, scrimmages"), the lineup mode article, the Scouting Book `HelpDef` — all now say: *a game
is a game; tick "This is a scrimmage" to keep it on the schedule but out of your record.*

### 4.7 Tests and fixtures
- Unit: `coach-opponents` (scrimmage fixtures → `isScrimmage`), `season-wrapped`,
  `coach-schedule-intelligence`, `coach-opponent-insights`, `coach-game-moments`, `coach-game-day`,
  `coach-overview`, `coach-masthead-status`, `coach-finished-season-surfaces`, `coach-club-book`,
  `development-record`, the schedule vocab / import tests (new cases: "Scrimmage" cell → Game +
  flag; "League Game" cell → Game; export writes "Scrimmage" for a flagged Game; the auto-name is
  home/away aware; `isAutoShapedName` refuses a typed name).
- New: `countsTowardRecord` pinned both ways; `competitionOf`; the mapper's legacy normalization.
- UAT: `coach-schedule-smoke`, `team-lineup-smoke`, `family-access-boundary` (they create or
  expect scrimmage rows); fixtures `seed-uat-coach-fixture.mjs` (10 sites), `seed-qa-day-fixtures.mjs`.
- Gates: `verify:changed` (spelling — no new variant; dictionary), `typecheck` (shared modules),
  `check:layout` (the schedule is a swept coach surface), the history-endpoint guard (no route
  learns a year), `check:demos` (the coach demo seeds no scrimmage; `check-demo-coach.mjs` filters
  `league_game` and keeps working).

### 4.8 Demo
The `riverdale-ridge` seed creates league games only; nothing in the tour names a scrimmage. The
build's auto-reseed picks up 306/307 on its own. Whether the shop window should *show* a scrimmage
is a `/demos` question for the next release cycle, not this project.

---

## 5. Out of scope (named so it is not built on the way past)
- Tournament games carrying the flag (D3 — deferred).
- A team-level "count scrimmages" setting (D4 — the flag replaces it).
- Changing the kind of an existing event between the remaining kinds (the lock stays; it is
  right for those).
- Renaming the stored key `league_game` (a migration across every reader for no product value).
- Any change to the Basic/Free schedule's three kinds (`practice · game · event`).
- Undoing a rollover, anything that reads a year (`HISTORY_ENDPOINTS` unchanged).

## 6. Verification the owner does (the QA walk, written after the build)
UAT coach on `uat-test-org` / UAT Test Team, `localhost:3000`. Parts: A — Add a Game, tick the
box, see the chip and the "vs/@" name; B — Edit an existing (folded) scrimmage, untick, watch the
Overview tile and masthead record move; C — Import a sheet with "Scrimmage" and "League Game" in
Event Type, export it back and read the two words; D — Lineup builder opens on Development for a
flagged game; E — Scouting Book EXH; F — Season's End split shows "Scrimmages · not counted";
G — the phone: the checkbox in the sheet, the chip on the row; H — the help says what the product
does. Pin identities and relationships, never a date-moving figure.

## 7. Ledger
- 2026-09-20 — owner question in chat; two options presented; **"the flag"** ruled. Plan, PM brief
  and hub drawn the same day. D1–D6 owed.
- 2026-09-20 — round 2: the checkbox loses its hint (**ruled**: one line, "This is a scrimmage").
  Hub republished, same URL.
- 2026-09-20 — **D1–D6 ruled as recommended** ("I agree with your recommendations, go ahead and
  build"). **BUILT ON DEV the same day.** Mig 306 applied to dev + verified; snapshots refreshed;
  dictionary updated; parity re-baselined (in-flight column + CHECK). F06 and F07 found and fixed
  on the way. Verified: typecheck (this change's files clean; one pre-existing syntax error in
  another session's in-flight `coach-first-screen-guard.test.ts`), unit 4,308 + 15 new, focused
  lint 0 errors, spelling · CSS purity · CSS selectors · dictionary · snapshot freshness · demos ·
  export catalog green, check:layout clean on coach-schedule + coach-overview at four widths
  (twelve pre-existing findings on coach-season-end / coach-opponent controls this change did not
  touch — reported, not baselined). Dev server restarted via its supervisor; UAT fixture re-seeded
  with one decided scrimmage (@ Lakeside 2–7). Help: seven spots corrected in
  `lib/help-content/coaches.tsx` (the "record does not match" article rewritten; the stale Lineups
  filter-chip sentences from the 09-18 ruling corrected in passing). **Owner walk §211 owed** (hub
  QA Walk tab, 20 steps, parts A–H). **Commit owed** — private index; the schedule page, Overview,
  stylesheet, help module, TODO and the ledger carry other sessions' hunks.
- 2026-09-21 — **`/simplify`** (4 lenses): the game-kind list was hand-copied in six files after
  the fold made every copy identical to `COACH_GAME_EVENT_TYPES` — all six now import it; the
  legacy-row fold written three times → `readStoredEventKind`; the "a Game only" coercion written
  five times → `scrimmageFlagFor`; the by-competition split written twice → `splitByCompetition`;
  `competitionLabel` (no production caller) deleted; the `'@'/'vs'` word → `sideWord` (shared by the
  auto-name and the display suffix); `SCRIMMAGE_LABEL` replaces five hand-typed "Scrimmage"s; the
  family record reads `countsTowardRecord` instead of restating it; a source guard pins that every
  SQL record query pairs the kind list with `.eq('is_scrimmage', false)`. Also caught: one comment
  line my edit tooling had replaced with the word `undefined` (the tool now refuses a malformed
  edit). Skipped: an 8-pass tally in the season-results route (season-scale rows), the Results
  report's per-render split (pre-existing shape).
- 2026-09-21 — **`/review`** (high-risk tier; 4 finder lenses; main-loop adjudication). **CONFIRMED
  AND FIXED:** (1) **Critical — Season Wrapped and the player season recap built their game inputs
  without the box, so the shareable card would have counted every scrimmage** (the old kind excluded
  them by name; the new predicate read `undefined` as "not a scrimmage"). Both assemblers pass it;
  `WrappedGameInput.isScrimmage` is now REQUIRED so the compiler catches the next builder. (2) Medium
  — mig 306's no-opponent rename handled a bare "League Game" but not a bare "Scrimmage"; folded
  in, verified 0 left on dev. (3) Medium — `isAutoShapedName` accepted "vs X" regardless of side, so
  an untouched edit-save of an away game a coach had named "vs X" flipped it to "@ X"; it now asks
  the side (exactly what `deriveGameName` writes), which also stops a typed "vs X" on a tournament
  game being rewritten. (4) Medium — the Results report's "vs {tag}" record and runs tallied
  scrimmages; they read the record rule now. (5) Medium — the create path coerced the box at the db
  layer but the update paths did not: a new database CHECK
  (`rep_team_events_scrimmage_is_a_game_check`) is the belt under every writer; added to mig 306 and
  re-applied on dev (idempotent). (6) Low — two customer/reader-visible strings still said "League
  Game vs Lady Jays" / "Scrimmage vs Lady Jays". **REFUTED / ACCEPTED:** a typed name that is exactly
  "Game" being treated as product-written (it IS the product's fallback; re-deriving it to "vs X" is
  an improvement, not a loss); `isScrimmage` riding across a series edit (same as opponent and side,
  D5); the mirrored-game PATCH accepting the field silently (coerced false; not an organizer fact —
  left off the refusal list). **OUT OF SCOPE, REPORTED TO THE OWNER:** two findings in another
  session's in-flight edits to the same schedule page (a new date/time model — the Repeat-weekly
  toggle can save a stale date; clearing the Date field resets a custom End time). Deterministic
  gate green; check:layout scoped to nine touched screens — schedule, Overview, team hub, lineups,
  lineup builder clean at four widths; the 18 "new" findings on Season's End / the results shelf /
  the opponent page are on controls this change did not touch ("Share your season", "Switch team",
  "Help", "Remove observation", tag chips) — reported, not baselined. Unit 4,312/4,312.
- 2026-09-21 — **`/docs`**: a new popular FAQ on the Premium schedule article — *"How do I mark a game as
  a scrimmage?"* (the box, what it does and does not change, tick/untick any time, no other setting)
  with its search terms; the Repeat-weekly article says "game" (and that a scrimmage repeats) and its
  count reads "Add 11 games"; the import article names the Event Type words (Game · Scrimmage ·
  Practice · Tournament · Team Event, an old "League Game" still reads as a game). `measure:help`:
  no section this change touched crossed the standard (the two over it — Insights, next season —
  were over before and were not edited in body; a later /docs pass).
- 2026-09-21 — **COMMITTED `c255abc5`** (67 files) through a private index; the committed tree
  typechecks clean in a scratch worktree. Owner walk §211 owed; mig 306 PROD-OWED, WITH the promote.
