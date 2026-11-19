# Bracket game-order rule — a game cannot start before the games it depends on

**Status:** on the board (Owner Morning Brief).
**History (not kept current):** RULED 2026-10-29 (owner), not started. Parked until the weekly usage refreshes (weekend of 2026-11-01); nothing built, nothing investigated beyond the trigger below.

**Drawn and ruled 2026-11-18:** investigation in *Findings* at the bottom; drawings
https://claude.ai/artifact/E1VdDfwpmfEiiR3Re3pPQM (source `BRACKET_GAME_ORDER_RULE_DRAWINGS.html`, round 1 after
`/design`); **all twelve asks RULED as recommended** (*Rulings, drawing round 1* below). Nothing built.

## The rule (owner, 2026-10-29)
> It must be **impossible** in real life to schedule a game before a game it depends on. The admin schedule editor **blocks the save**.

Blocks, not warns. This is a decision, not a draft to re-open.

## Where it came from
On the public Schedule (phone), the Championship (2:15 p.m.) sat between two Semifinals (11:25 a.m. and 3:12 p.m.). The public sort was correct — it orders by date then time. The cause was test data: the Stage 3 fixture seed moved one Semifinal to "now" and left the Final's time alone. The seed is fixed (it now keeps the Final three hours after the Semifinals and restores it on undo). That fixed the fixture only; **a real organizer can still make the same mistake in the admin tournament schedule editor**, and the public page would then show it.

## What to investigate first (not yet read)
1. **How a game "depends on" another.** The fixture uses bracket codes (`SF1`, `SF2`, `FIN`) and winner placeholders ("Semifinal 2 winner"). Find out whether the dependency is stored (a source-game link) or only implied by the code/label — the rule needs a reliable answer, per bracket shape (single elimination, pools → playoffs, anything with a third-place game or a loser feed).
2. **Every door that sets a game's time or date.** The schedule editor save, the bracket editor, drag-and-drop on a grid, bulk shift / reschedule, auto-generate / auto-schedule, import, and any API route behind them. The rule belongs **on the server** (the one route/library they all share), with the editor showing the reason — a UI-only block is not "impossible".
3. **Pool play → playoffs.** Playoff games depend on the pool results too. Decide whether the rule includes "no playoff game before the last pool game of its division" or stays at game-to-game dependencies. Needs the owner's call if it is not obvious from the code.

## Open design questions (owner call at build time)
- **Equal times:** the same start time for a game and its dependency — block (recommended: a winner cannot be known at the moment the game starts) or allow back-to-back with a minimum gap?
- **Minimum gap:** does the dependent game need the earlier game's length (or a buffer) to finish, or is "later start" enough?
- **Moving a Semifinal later:** block, or offer "also move the Final"? Owner said block; the second is a convenience to price separately, not assumed.
- **Existing bad data:** tournaments already saved out of order — show the problem on open, but do not lock the organizer out of fixing it.
- **Auto-scheduling and published schedules:** what happens when the generator itself would produce an out-of-order pair, and what happens to a schedule that is already published/live.

## What the organizer should see (to be confirmed in the UX summary before any code)
- Moving or saving a game before a game it depends on is refused with a plain sentence naming both games: "The Championship can't start before Semifinal 2 (3:12 p.m.)."
- The same sentence wherever the time can be changed — drag, edit window, bulk move, generator.
- No change for tournaments with no dependent games (round-robin only).

## Tests when built
- A save with a dependent game earlier than its source is refused by the **server**, from every door above.
- Equal-time and just-after cases behave per the ruling on the open questions.
- A round-robin-only tournament is unaffected.
- The Stage 3 fixture still passes its own ordering check.

## Process notes
- Per AGENCY_RULES: PM UX summary presented in the conversation before any code; PM brief at `BRACKET_GAME_ORDER_RULE_PM_BRIEF.md`.
- Offer `/review` after the build; `/docs` if the editor's behavior is user-visible in the help guides.

---

## Findings (investigation, 2026-11-18)

Read-only investigation (Stage 9 of the public tournament pages project). Nothing built, no code changed, no
production rows read. Every claim below was opened at the cited lines; paths are from the repo root.

### Verdict in one paragraph

The rule **can** be made impossible from every door an organizer has, and most of the parts already exist: an
ordering check (`findBracketSchedulingViolations`), a server guard that nearly every time-writer already calls
(`tournamentOverlapRefusal`), and a refusal shape the server already returns once (`409 code:'bracket-order'`).
What does not exist is the **server rule on any door but the rain delay**: the game window, drag, Add game, the
bracket editor and the playoff generator all refuse an out-of-order game **in the browser only**, so a second admin,
a stale screen or a direct request saves it. Two things stop it being "impossible" in the strict sense, and both
need a decision, not just code: (1) the dependency is **text, not a link** ("Winner SF1" matched against a bracket
code), which is reliable inside one bracket but ambiguous in a division with several brackets when a game carries
no bracket id; (2) nothing at the **database** level refuses — a script, the demo cron, or a future route that
forgets the guard writes straight past it. The recommended answer to (2) is not a database trigger (see Q2) but a
build-enforced test that every `games` writer calls the guard.

### 1. How a game "depends on" another

**There is no stored link.** No source-game column, no FK, no unique key on `(bracket_id, bracket_code)`.

- A playoff side holds text in `home_placeholder` / `away_placeholder`: `Winner <code>` / `Loser <code>` for a
  bracket feed; `Seed #N` or `Nth Pool X` for a standings feed.
- `bracket_id` is a plain uuid grouping key, not a FK (`supabase/migrations/076_games_column_type_fixes.sql:44-47`,
  dictionary `games` gotcha 2).
- **The advancer** (`lib/db.ts:1108-1172`) fills a downstream side when its placeholder **exactly equals**
  `'Winner ' + bracketCode` / `'Loser ' + bracketCode` (`:1141-1144`) — case-sensitive, no trim — and skips a
  candidate only when **both** games carry a bracket id and they differ (`:1138`). A null bracket id on either side
  makes the match division-wide.
- **The placeholder survives placement.** Advancement and seed fill write team ids only; the text is "never cleared"
  (`lib/db.ts:1141-1147`, `:1180`). So the dependency is still readable after teams are placed.
- **Regeneration:** the playoff generator's save (`replace_division_playoff_games`, mig 327) deletes the replaced
  games and inserts new rows; dependencies are re-expressed as fresh placeholder text, scoped by fresh bracket ids.
  `save-bracket` writes whatever placeholders and codes the editor sends (`app/api/admin/games/route.ts:637-647`).
  The game window's `update` action can rewrite `home_placeholder`, `away_placeholder` and `bracket_code` directly
  (`route.ts:1399-1401`) — i.e. **change what a game depends on without changing its time**.

**Per bracket shape** (codes from `lib/playoff-bracket.ts`; helper-reported lines, sampled):

| Shape | How a source is written | Reliable "depends on" today? |
|---|---|---|
| Single elimination (`QFn`, `SFn`, `FIN`, `Rn-g`) | `Winner <code>`; a bye adds no game, the bye seed's `Seed #N` sits in round 2 | Yes, within one bracket id |
| Third place (`P3`) | `Loser SF1` / `Loser SF2` | Yes |
| Consolation (`CONr-g`), placement (`PLp…`) | `Loser <code>` cascades | Yes |
| Double elimination (`WBr-g`, `LBr-g`, `GF`, `GF2`) | `Winner/Loser WB…`, `Winner LB…`; GF2 = `Winner GF` / `Loser GF` | Edges yes. "If necessary" is not stored; it is the literal code `GF2`, cancelled by the advancer when GF's home side wins (`lib/db.ts:1156-1167`) |
| Pools → one bracket (crossover) | Round 1 `1st Pool Red` etc., then `Winner` refs, one bracket id | Bracket edges yes; pool edges text only (§3) |
| One bracket per pool (no crossover), tiers (Gold/Silver) | **Codes reused** (`SF1`, `FIN` in every bracket), told apart only by bracket id | Yes **only if every game carries its bracket id** |

**Where it breaks:**
1. **A hand-added playoff game in a division with several brackets gets no bracket id**
   (`app/[orgSlug]/admin/tournaments/schedule/page.tsx:500-503`). Its "Winner SF1" then means *any* SF1 in the
   division, to the advancer and to any rule. Legacy rows can be null too (`scripts/repair-legacy-bracket-codes.mjs`).
2. **Hand edits.** The bracket editor's code is free text and its rename rewrites matching `Winner/Loser <old>`
   labels across every matchup it holds (`app/[orgSlug]/admin/tournaments/schedule/components/BracketBuilder.tsx:504-520`) — one builder holds every tier
   (`groupOptions`, `BracketEditor.tsx:596`), so renaming Gold's SF1 plausibly rewrites Silver's references too
   (not exercised). The `update` action rewrites placeholders with no rewrite of dependents.
3. **Helpers disagree with the advancer on matching.** The ordering check and the diagram helpers match
   case-insensitively and trimmed (`lib/playoff-bracket.ts:1034`, `:1054`); the advancer matches exactly. A
   "winner SF1" draws a connector and is ordered by the check, but never advances.
4. **Deleting a source game** nulls its dependents' placeholders (helper-reported, `page.tsx:789-823`): the edge is
   lost rather than refused.

**Existing "sources of X" code, all pure, all browser-side today:** `levelInto` + `feederCode`
(`lib/playoff-generator.ts:286-310`) is the only one keyed correctly by **(bracket, code)**; `findBracketSchedulingViolations`
keys by code alone; `computeBracketColumns`'s internal `deps()` relies on callers pre-grouping by bracket.

### 2. Every door that sets a game's date, time or length

All actions are in `app/api/admin/games/route.ts` unless named; all write with the service role. Browser clients
cannot write `games` at all (mig 310 revokes everything but SELECT; the three game RPCs are service-role only). There
are **no triggers** on `games`. "Guard" = calls `overlapRefused()` → `tournamentOverlapRefusal`
(`lib/tournament-overlap-guard.ts:81`) before writing.

| Door (what the organizer does) | Route / action | Writes how | Bulk | Guard | Order check today |
|---|---|---|---|---|---|
| Game window save (day, start, length; also its "plays" source pickers) | PATCH `update` `:1338` | own `.update()` `:1415` | no | yes `:1411`, **only if a placing column changed** — placeholders/code are not placing columns (`overlap-guard.ts:40-43`) | **browser only** (`page.tsx:638-646`) |
| Drag on the timeline; phone move sheet | `moveGame` `page.tsx:584` → PATCH `update` | same | no | same | browser only |
| Undo of a single move | `putBack` `page.tsx:560` → PATCH `update` | same | no | same | browser only |
| Add game (pool or playoff) | POST `create` `:499` | own `.insert()` `:541` | array (UI sends 1) | yes `:538` | browser only (`page.tsx:504`) |
| Bracket editor save | POST `save-bracket` `:579` | per-game `.update()` loop `:664` + `.insert()` `:681` — **not one transaction** | yes | yes `:618` | browser only (`BracketEditor.tsx:335`) |
| Playoff generator save | POST `replace-division-playoffs` `:793` | RPC `replace_division_playoff_games` (mig 327) | yes | yes `:836` | none on server; the draft is built in order (feeder **end + rest**, `lib/schedule-generator.ts:223-232`; no slot before pool play ends, `lib/playoff-scheduling-guard.ts`) |
| Round-robin generator save | POST `replace-division-round-robin` `:707` | RPC `replace_division_round_robin_games` (mig 320) | yes | yes `:752` | none (pool games only) |
| Rain delay / shift the day | PATCH `bulk-reschedule` `:1041` | RPC `bulk_reschedule_games` (mig 178) | yes | yes `:1123` | **SERVER**, new violations only (`route.ts:1104-1114`, `lib/schedule-shift.ts:152-168`) |
| Rain delay Undo | PATCH `bulk-restore` `:1233` | same RPC `:1283` | yes | yes `:1277` | **none** (mig 178:9's comment says the check runs before every call; it runs before the shift only) |
| Reinstate a cancelled game | PATCH `revert-to-scheduled` `:1433` | `.update({status})` | no | yes `:1437` (status is a placing column) | none — can bring back a cancelled out-of-order game |
| Legacy generator save | POST `bulk-save` `:402` | own `.insert()` `:480` | yes | yes `:477` | none; no caller found outside unit tests |
| "Kept as cancelled" copies on replace | `tellTheReplace` `:264` | own `.insert()` copying old times, status `cancelled` | yes | no | n/a (cancelled) |
| CSV schedule import | `app/api/admin/tournaments/[tournamentId]/schedule/import/commit/route.ts:71, :78` | own insert/update | yes | **no** — its own venue check (`lib/import/tournament-schedule-commit.ts:401`) | none; **refuses playoff targets** and inserts pool games only, so it matters only if a pool-play rule is adopted (§3) |
| New-event wizard seeded schedule | `app/api/admin/setup-tournament/route.ts:599` | own insert | yes | no | none; dev-tools flag only (`:173-174`) |
| Division / event default game length | `divisions` route `:305`; `tournaments` settings `:690, :733` | writes settings, **not `games`** | every game with no length of its own | no | none — changes when games *end* without touching a game |
| Not customer doors | demo cron (`lib/demo-reconcile-core.ts`), dev seed route, ~20 `scripts/*.mjs` | direct service-role writes | — | no | — |

Checked and found **not** to write a time: cancel, deletes, venue clearing, typed-locations resolver and Undo,
facility-lanes finalize, scoring (`lib/tournament-scoring-service.ts`), scorekeeper, official (GET only),
advancement (teams/status only), clone/populate-from. `updateGame` in `lib/db.ts:983` can map a time but no caller
passes one; `saveGame` has no callers.

**Is there one shared write path?** No. Two small ones converge (PATCH `update` for window/drag/sheet/undo; the
reschedule RPC for rain delay + undo); every other door writes on its own. **The one shared *checkpoint* already
exists:** `tournamentOverlapRefusal`, called by every product writer except the CSV import and the dev wizard. It
already loads every game in the tournament (with `is_playoff`, `bracket_code`, both placeholders — `:45`), the
division and tournament lengths, and merges each proposed row over the stored one (`:115-123`). **That is where the
rule should live** — as a sibling pure rule judged on the same merged picture, so one load serves both. It would need:
- placeholders, `bracket_code` and `bracket_id` treated as triggers (today `placesAGame` / `changesPlacement` skip a
  write that only re-wires a game), and `bracket_id` added to the columns it reads;
- a **before/after** comparison (refuse only what the write creates — the rain delay's existing pattern), so data
  already out of order never locks the organizer out (see "Already out of order" below);
- the rain delay's own check folded into it (and its scoping bug fixed — Wider findings 1);
- the CSV import calling it, if a pool-play rule is adopted;
- a build-enforced test listing every `.from('games')` writer and requiring the guard (the pattern of
  `tests/unit/coach-history-endpoint-guard.test.ts`), so a new door cannot skip it. That test is what makes the rule
  "one place" in practice.

**Why not a database trigger:** it is the only true catch-all, but (a) the bracket editor's save is a per-row
update loop, not one transaction, so a row trigger would judge half-saved brackets and refuse a legitimate reorder
mid-save; (b) the dependency grammar would have to be written a second time in SQL and kept in step with the
TypeScript advancer — two homes for one rule. A deferred constraint trigger plus making `save-bracket` atomic would
remove (a); (b) remains. Not recommended unless the owner wants scripts and the demo cron held too.

### 3. Pool play into playoffs

**Implied, not stored.** Games carry no pool id; a playoff side's `Seed #N` / `1st Pool A` text plus the division's
`playoff_config` are the only link. What the code already *does* with it:
- Seeds fill only when **every** non-playoff game of the **division** is completed or forfeited
  (`lib/db.ts:1197-1199`) — division-wide, any pool. (A cancelled pool game counts as not done, so it holds seeding
  forever.)
- The playoff generator offers no slot that starts before the division's round robin **ends**
  (`lib/playoff-scheduling-guard.ts:8-41`, used at `PlayoffGenerator.tsx:214, 268`) — browser only.
- Standings, hence pool ranks, are computed over every non-playoff game in the division.

**Options and their cost (owner's call):**

| Option | What it needs that does not exist | Cost |
|---|---|---|
| **A. Game-to-game only** (no pool rule) | Nothing | None. A Quarterfinal can still be saved at 10 a.m. while pool play runs to 2 p.m.; it would start with no teams, because seeding waits for pool play. |
| **B. Division-wide: no playoff game starts before the division's last pool game ends** | The same guard learning a second family of edges (derivable: `is_playoff=false`, same division, not cancelled); five more doors become refusal points: round-robin generator save, Add pool game, CSV import (must start calling the guard), rain delay, game window on a pool game | Small to medium. Mirrors what seeding and the playoff generator already assume. New cases to rule: a pool game moved *later* than a scheduled playoff (refused under B — the "move a Semifinal later" question again, one level up); playoffs-only divisions are unaffected; whether a cancelled pool game counts. |
| **C. Per pool: `1st Pool A` waits only on Pool A's games** | Pool membership for each game (from team pool ids), cross-pool games, crossover brackets that read every pool | High, and it disagrees with the code: standings and seeding are division-wide, so a Pool A rank is not known until the whole division is done. |

### 4. What already exists that touches this

| Existing | What it does | Where it runs | Block / warn |
|---|---|---|---|
| `findBracketSchedulingViolations` (`lib/playoff-bracket.ts:1052-1080`) | Dependent on an earlier day, or same day with start **≤** source start | pure | — |
| Schedule page `bracketOrderProblem` (`page.tsx:443-458`) | the above, scoped by **division** | browser | blocks |
| Bracket editor (`BracketEditor.tsx:202-212, 335-338`) | the above, scoped per tier/pool; blocks Save on **any** violation, old or new; chip + banner | browser | blocks |
| `planBulkReschedule` (`lib/schedule-shift.ts:123-169`) | before/after; refuses **new** violations | **server** (rain delay) + browser | blocks |
| Bracket health metrics (`lib/bracket-schedule-metrics.ts`) | dependent start vs source **end** (impossible) and end + rest (tight) | browser (bracket editor, generator) | warns |
| Playoff generator (`lib/schedule-generator.ts:223-232`) | source **end + rest** is a hard constraint while drafting | browser | n/a |
| Field/team overlap (`lib/schedule-conflict.ts`, `lib/tournament-overlap*.ts`) | surface overlap; no ordering | browser + server | overlap blocks |
| Schedule health number (`lib/schedule-metrics.ts`) | no order issue at all | browser + dashboard | — |
| Umpire / official conflicts | **do not exist** | — | — |
| Tests | the pure check, the shift, the metrics, the generator are unit-tested; **no test** covers a server refusal on `update` or `save-bracket` | | |

**The Stage 3 fixture seed** (`scripts/seed-public-stage3-fixtures.mjs:32-48`): finds the Final by
`bracket_code === 'FIN'`, writes it at the moved Semifinal's instant + 3 h, saves the original row once for undo
(`:34-39`), then asserts each `SF*` starts before `FIN` (`:45-47`) — tournament-wide, by hard-coded codes, after
the write. **Not reusable**; it should keep passing under any rule (3 h clears any game length the fixture uses).

**How the editor shows a refusal today** (reuse these; no new pattern needed):
- the page's message window (`setFeedback` → `KitDialog`, `page.tsx:1849-1903`), titled "Could not save game"
  (`lib/schedule-words.ts:554-555`); a refused drag or move-sheet move snaps back (`page.tsx:597-601`);
- the game window's red line under the field (`WhereLine tone="refuse"`, `useOverlapLine.tsx:66-68`) and its save
  pill with Retry — the natural home for "can't start before Semifinal 2 (3:12 p.m.)";
- the rain delay's `Callout tone="bad"` (`ShiftDayModal.tsx:390`, words `lib/schedule-words.ts:762`);
- the bracket editor's "Fix the bracket order first" window plus chip and banner.
- **Server shapes:** overlap = `409 {error, code:'overlap', gameId, otherGameId}`; order (rain delay only) =
  `409 {error, code:'bracket-order', violations:[{game, feeder, reason}]}`. `readRefusal`
  (`lib/schedule-words.ts:592-595`) reads `error` only, so the sentence the server writes is what the organizer
  sees — the server must write the named sentence ("The Championship can't start before Semifinal 2 (3:12 p.m.)"),
  not the generic one the rain delay sends today.

### Also reported

**Already out of order.** On open, nothing flags it: the health number has no order issue and the timeline badges
show field conflicts only; it appears only inside the bracket editor ("N impossible"), which then refuses to save
**anything** until every pair is fixed. The game window refuses any time edit to a game that is still in a broken
pair after the edit (`page.tsx:447-448`), so fixing two tangled pairs must be done in the right order. The public
Schedule sorts by date and time (`lib/public-schedule.ts:86-87`), so a misplaced Final reads between Semifinals (the
original report); the public bracket orders by round, not time (`lib/public-playoffs.ts:41-61`), but its "Up next"
pick walks the time list (`:92-107`), so it can name the Final before a Semifinal. A before/after server rule never
locks the organizer out: a save that leaves an old broken pair as it was, or fixes it, passes; only a newly created
pair is refused.

**Published and live schedules.** The gate is `divisions.schedule_visibility` (`lib/public-games.ts`). A move of a
still-to-play game in a published division already asks the organizer once (`page.tsx:587`, `askMove`) and queues
change notices after the write (`lib/schedule-change-notices.ts:78-120`; batched, sooner within 6 h of the game). A
server refusal happens **before** any write, so a refused move tells nobody — no new interaction. A Final whose teams
are still "Winner SF1" tells nobody anyway (notices go to real team ids only). The rain delay's announcement step
runs after its order check, so the same holds there.

**Outside tournaments (out of scope, noted only).** House league writes its own `league_games`; club schedule and
permits their own tables; the coach portal reads tournament games and never writes them. None shares the tournament
time-setting code or guard.

### Wider findings (not asked; evidence was wider than the question)

1. **The one server check that exists is scoped wrong.** The rain delay loads every game in the tournament and drops
   the division (`route.ts:1086-1102`); the check keys sources by code alone, last one wins (`playoff-bracket.ts:1054`).
   Two divisions (or two tiers) that both have an `SF1` compare the wrong games: false refusals and missed ones.
   The game window's browser check scopes by division but not by bracket, so tiers and per-pool brackets in one
   division collide the same way. Only the bracket editor and the generator scope per bracket.
2. **Three definitions of "in order" disagree:** start after start (the block, today); start after source end (the
   health read-out's "impossible"); start after source end + rest (the generator). Today the block allows a Final
   ten minutes after its Semifinal starts — which the product's own health panel calls impossible.
3. **Re-scoring a Semifinal after the Final was played rewrites the Final's team.** The advancer has no status guard
   on the downstream game (`lib/db.ts:1131-1148`, contrast the seed fill's guard at `:1213`). An ordering defect of
   a different kind (results, not times) — its own item, for `/plan`.
4. **The advancer's exact match vs everyone else's loose match** (Q1 break 3): a mistyped placeholder looks wired
   and ordered but never advances.
5. **`save-bracket` is not atomic** (per-row loop `route.ts:664`): a failure mid-save leaves a half-saved bracket.
6. **A cancelled pool game holds playoff seeding forever** (`lib/db.ts:1198`).

### Open questions this changes or answers

- **Equal times** — answered by the code: every existing check already treats equal starts as out of order
  (`ys <= xs`, `playoff-bracket.ts:1071`). Keep it.
- **Minimum gap** — *changed*: the question is not "later start or a buffer" but "which of the three definitions".
  Recommendation: block a start before the source game **ends** (its start + its length, by the one length chain
  `lib/booking-length.ts`); a start inside the rest buffer stays the health panel's warning. New sub-question this
  raises: changing a division's or event's default game length can make a pair impossible without touching a game
  (Q2 table, last product row) — refuse that settings save, or only show it?
- **Moving a Semifinal later** — unchanged: block (the refusal names the Final and its time). "Also move the Final"
  stays a separately priced convenience; the rain delay's forward shift of a whole day already moves both together.
- **Existing bad data** — answered: refuse only pairs a save creates (the rain delay's before/after pattern, already
  built); add an order issue to the schedule health number and to the game's badge so the problem shows on open.
  The bracket editor's "fix everything before saving" should move to the same rule, or a broken old pair in one
  tier blocks saving an unrelated tier.
- **Auto-scheduling** — answered for playoffs: the generator cannot draft out of order (end + rest), so a server
  re-check never fires on a fresh draft; it would fire only on a stale one (the schedule changed under it), where a
  refusal is right. Round-robin generator and import matter only under pool-play option B.
- **Published schedules** — answered: no interaction (refusal is before any write or notice).
- **New: a game with no bracket id in a division with several brackets** ("Winner SF1" names more than one game).
  Recommendation: the rule treats it as depending on **every** game it could mean (the safe reading of
  "impossible"), and the Add-game path is fixed to give a hand-added game its bracket — its own small change.
- **New: pool play into playoffs** — options A/B/C above, owner's call.
- **New: who else is held** — scripts and the demo cron bypass any route-level rule. Accept (recommended) or
  ask for database enforcement (Q2, "Why not a database trigger").

---

## Rulings, drawing round 1 (owner, 2026-11-18, paste-back)

All twelve asks of the drawings (https://claude.ai/artifact/E1VdDfwpmfEiiR3Re3pPQM, version 2) **as recommended**,
no notes. Verbatim in substance; the drawing's tab 6 holds every sentence.

- **A1 · How late is "after":** after the earlier game **ends** — its start plus its length (the game's own length,
  else the division's, else the event's). Equal starts are refused as a result. A start inside the rest time stays
  the health panel's warning, not a block.
- **A2 · Schedules already out of order:** shown on open. A save is refused only when it creates a new problem; a
  save that fixes one, or leaves it as it was, always goes through.
- **A3 · The bracket editor's save:** the same rule as everywhere — only a problem this edit makes stops the save.
  Old ones are listed under "Already saved this way".
- **A4 · Refusing a drag:** while dragging, like a taken field — the spot turns red with the reason, and nothing lands.
- **A5 · Which games wear the chip:** both games, as for a double-booked pair. Each game's window says what is wrong
  from its own side.
- **A6 · The chip's words:** "Out of order".
- **A7 · Pool play into the playoffs:** included, division-wide — no playoff game starts before the division's last
  pool game ends. Five more doors refuse it (the round-robin generator, Add pool game, import, the rain delay, a pool
  game's time).
- **A8 · Changing a default game length:** refused like any other door, naming the pair, on the line beside the
  window's Save.
- **A9 · A division with several brackets:** the pickers name the bracket ("Gold · Semifinal 1 winner") and the new
  game joins it. Until a game has a bracket, the rule treats it as waiting for every game it could mean.
- **A10 · The words:** as drawn — the fact that blocks it, then the way out.
- **A11 · Scripts and the demo's own refresh:** not held by the rule, accepted. A build check fails if a new screen or
  route writes game times without the rule.
- **A12 · A game with two problems:** the chip says Double-booked; the game's window shows both red lines; the Filter
  finds the game under both rows.

**The open design questions above are now answered** by A1 (equal times, minimum gap), A2 + A3 (existing bad data),
A7 (pool play) and the drawing's settled list (moving a Semifinal later = block, "also move the Final" priced
separately; auto-scheduling and published schedules: no change needed). The drawing's other choices, ratified with
them: the red line under the field that is wrong, ✓ / Move / Add game held by the one disabled face while it stands;
a refusal in a window with no field sits beside its button; a server refusal of a move snaps the game back and the
move notice turns red and stays until closed; the health window gains a "Playoff games out of order" issue with
"Show them ›"; the Filter's Conflicts group gains "Out of order"; the bracket editor and rain delay name games by
round, not code.

**Not ruled (the build's to settle, or a later item):** the health score's deduction (drawn "as much as an
overlap"); the Wider findings 3–6 (re-scoring a played Semifinal, the advancer's exact match, `save-bracket`
atomicity, a cancelled pool game holding seeding) remain their own items for `/plan`.
