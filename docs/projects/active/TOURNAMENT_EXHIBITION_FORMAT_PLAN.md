# Exhibition — a third tournament style, no playoffs — Implementation Plan

> **Status:** BUILT on dev 2026-09-13 (uncommitted at the time of writing — the hub's stage strip
> carries the anchor once it lands). Owner ruled **D1 (the name is "Exhibition")** and **D2 (no
> fourth format — the existing Hide Standings switch covers a scrimmage day)** in chat before the
> plan was written, and accepted **D3 (keep the clear-the-schedule rule)** and **D4 (no demo
> change)** as recommended the same day. **No migration.** `/simplify` (4 lenses) found and fixed
> a duplicated format-write block across the two wizards, two dead default props, and a fragile
> literal-comparison ternary in Event settings. `/review` (high-risk, 5 lenses + a gap-fill pass
> after the initial diff extraction missed 3 new files) found and fixed one real Medium/Critical
> defect: the public bracket-visibility check had no Exhibition case, so it could show a real or
> stale playoff bracket on an event that must never have one — closed with a `hasPlayoffs` guard
> and a direct regression test; also fixed a tautological test assertion. `/docs` added the third
> style to help search coverage (it existed in prose but not in `keywords`/`searchText`) and
> extended one FAQ's "exceptions" sentence to cover Exhibition symmetrically with bracket-only.
> 23 unit tests across two files (`tests/unit/tournament-format.test.ts`,
> `tests/unit/public-bracket-visibility.test.ts`); 3,869/3,869 full suite; typecheck, focused lint
> (0 errors), spelling / CSS-purity / selector / token gates, help structural tests and
> `verify-changed`/`check:demos` all clean after every pass. QA walk on the hub's QA Walk tab,
> ledger §184. Awaiting commit.
> **Created:** 2026-09-13
> **Branch:** dev
> **PM brief:** `TOURNAMENT_EXHIBITION_FORMAT_PM_BRIEF.md` (same folder)
> **Project hub (mockup · brief · plan · decisions, one URL):** https://claude.ai/code/artifact/1ec04652-246a-4c18-a6a4-bfd308a7dfd9 —
> source `TOURNAMENT_EXHIBITION_FORMAT_HUB.html` (republish the same path every round)
> **Origin:** the owner, on the setup wizard's "Tournament style" step in `uat-standalone`
> (2026-09-13): *"should we have a tournament style for just 'exhibition no playoffs', especially
> for the stand alone coaches portal? so they can schedule a day of scrimmages and not have to
> worry about including any playoff brackets?"* This plan argues from what the code does.

## Goal

A coach (or any organizer) can pick **Exhibition** as the tournament's style and never be shown a
bracket they are not going to build — not on the schedule, not on the dashboard, not on the public
page — and the dashboard tells them they are done the moment the last score is in.

## What the code does today (verified 2026-09-13)

### Where the format lives
- `tournaments.settings.format` — a key in the JSONB settings column, **not a column of its own**.
  `TournamentFormat = 'round_robin_playoffs' | 'playoff_only'` (`lib/types.ts:26`); absent = round
  robin + playoffs. No CHECK constraint, no migration for a new value.
- API allow-list: `FORMAT_VALUES` in `app/api/admin/tournaments/route.ts:604` — any other string is
  silently dropped from a `patch-settings` write.
- Helpers: `getTournamentFormat()` / `isPlayoffOnly()` in `lib/tournament-phase.ts`. **Eleven
  consumers** of `isPlayoffOnly`: the admin preview layout, `BracketEditor`, the admin schedule
  page, `PlayoffWizard`, the public tournament layout, `components/public/ScheduleContent.tsx`,
  `lib/public-pages.ts` (three call sites), and the unit test
  `tests/unit/public-bracket-visibility.test.ts`.

### The three pickers
- **Setup wizard** (`components/admin/TournamentSetupWizard.tsx:1522-1548`): two cards in a
  `1fr 1fr` grid under "Tournament style". Line 970: the setting is written **only when the choice
  is `playoff_only`** ("default round-robin needs no write") — a third value must be written too.
- **Org onboarding wizard** (`app/[orgSlug]/admin/onboarding/page.tsx:2103`, write at 1432): the
  same two cards and the same write rule.
- **Event settings → Schedule Rules** (`app/[orgSlug]/admin/tournaments/settings/event/page.tsx`):
  a two-segment control (1651-1668), locked once the tournament leaves Draft (`formatLocked`,
  line 667), a description per format (1670-1673), the card's summary line (813), and a
  confirm-then-delete-the-whole-schedule flow when games exist (`requestFormatChange` /
  `confirmFormatChange`, 675-716; dialog copy at 1890). ⚠ **Line 239 parses the stored value as
  `=== 'playoff_only' ? 'playoff_only' : 'round_robin_playoffs'`** — any third value would be read
  back as round robin + playoffs by this page unless the parse is widened. This is the trap the
  two-predicate refactor (P1) exists to remove.

### Plan reality for the standalone coach
- The Premium Coaches Portal is plan `team`, `PLAN_RANK` 0 — the same rank as the free Tournament
  floor (`lib/plan-features.ts:76-77`). `auto_schedule` (the Round-Robin Generator) and
  `playoff_generator` need `tournament_plus`; `playoff_manual` is on `tournament`, so a standalone
  coach **adds every game by hand** and could hand-build a bracket. They were never going to
  touch one on a scrimmage day.

### What already tolerates a tournament with no bracket (nothing to change)
- **Public overview** — three finished paths, and path 3 is explicitly "a no-bracket (round-robin)
  event has played out — every game terminal and the end date has passed"
  (`components/public/TournamentHomeContent.tsx:117-145`).
- **Playoffs tab** — appears only when a division carries a playoff config
  (`app/[orgSlug]/[tournamentSlug]/layout.tsx:231-233`, `lib/tournament-page-tabs.ts:55-69`).
- **Playoff Picture, "First playoff game in…" countdown, "See the bracket"** — all behind
  `playoffsSet` / `hasPlayoffGames` on the overview.
- **Champions** — derived from a decided bracket final only (`lib/champions.ts`); the admin
  summary's champions band is guarded on a champion existing (`summary/page.tsx:455`).
- **Standings "Top N advance" caption** — empty when `teamsQualifying` is 0
  (`components/public/StandingsContent.tsx:246-253`).
- **Fan push "Playoffs are set"** — fires on bracket materialization only (`lib/fan-notify.ts:318`).
- **Coach side** — `lib/coach-tournament-phase.ts` has no bracket assumption;
  `CoachTournamentRecord` reads `is_playoff` per game and tags a playoff game, nothing more.
- **Activation / completion** — neither the activate flow nor `status: completed` requires a
  bracket (`app/api/admin/tournaments/route.ts` has no bracket check).

### Copy already promising the exhibition weekend
- `app/for-coaches/page.tsx:314-315`: "…for your round-robin, **exhibition weekend**, or local
  event."
- `components/coaches/CoachHostedTournamentsSection.tsx:104`: "A quick round robin or
  **exhibition weekend**, set up from here."
- `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-09-13 delegation ruling): *"run the
  exhibition weekend"*.
- The one help mention of the format (`lib/help-content/tournaments.tsx:1551`) describes
  bracket-only as "the exception"; the wizard's "Tournament style" step is not documented anywhere
  in help.

## Findings

### F01 — The style picker offers two shapes and both end in a bracket
Wizard, onboarding and Event settings all offer *Round robin + playoffs* or *Bracket only*. The
product's own marketing page, the coach portal's set-up card and the owner's delegation ruling all
describe an exhibition weekend. The picker is the only surface that contradicts them.

### F02 — The admin schedule shows a Playoffs stage and a bracket callout on a tournament that has no bracket
`schedule/page.tsx:1436-1462`: the Stage toggle (phone row and desktop segmented control) renders
whenever `!isPlayoffOnly`; the Playoffs side offers a *Build Bracket* primary (1401-1417) and the
empty-state callout (1753-1761) ends "For playoffs, use the Playoff Bracket Builder." A coach
adding four scrimmages reads a promise they must ignore twice.

### F03 — "Ready to finalize" requires a bracket, so an exhibition never gets the finalize prompt on the day
`dashboard/page.tsx:1043`: `readyToFinalize = isActive && allGamesResolved && gd.playoffGamesTotal
> 0`. The guard is deliberate — decision #2 of `DASHBOARD_COMPLETION_GUIDANCE_PLAN`, so a round
robin whose bracket is not built yet never trips it early — and it is exactly right for the two
formats that end in a bracket. For an exhibition it means the rail stays on the *live* card after
the last score, the status pill reads *Live* all day, and the close-out prompt waits for the
calendar (`resolveGuidanceStage`, `lib/tournament-guidance.ts:79-88`: `post` needs `daysUntil <=
0` and `!isGameDay`, so on a one-day event it arrives the next day).

### F04 — The dashboard's shortcuts name a bracket before and during the event
`lib/tournament-guidance.ts:294-303`: the *pre* list carries "Set up a playoff bracket" and the
*live* list "View the playoff bracket". Neither has a format-aware alternative.

### F05 — The public schedule shows a Pool Play | Playoffs toggle whose Playoffs side reads "No playoff games yet"
`components/public/ScheduleContent.tsx:1180-1200` (phone) and `1267-1290` (desktop) render the
stage control whenever `!isPlayoffOnly`; the Playoffs stage's empty state is at 1553. A parent
reads "Playoffs" as a stage that is coming.

### F06 — The ready-stage copy says "Your champions are decided"
`lib/tournament-guidance.ts:194-196`. True for both formats that have a bracket; false for an
exhibition, which crowns nobody by construction.

## Proposal (recommended)

- **P1 — A third value, and two predicates instead of one.** `TournamentFormat` gains
  `'exhibition'`. `lib/tournament-phase.ts` exports `hasRoundRobin(t)` (`format !== 'playoff_only'`)
  and `hasPlayoffs(t)` (`format !== 'exhibition'`); **`isPlayoffOnly` is retired** and its eleven
  call sites re-pointed to whichever question they were actually asking (the standings/preview/
  public-pages sites ask *hasRoundRobin*; the schedule/bracket/wizard sites ask *hasPlayoffs* or
  the seeding case). A fourth format then never needs a sweep, and the settings page's
  "everything else is round robin" parse (F01's trap) is replaced by a validated parse of all
  three. The API allow-list gains the value. **No migration** — a JSONB key.
- **P2 — Three cards, one segmented control.** Wizard and onboarding: three cards,
  `repeat(3, 1fr)` on desktop, one column under the 700px container — titles *Round robin +
  playoffs* · *Bracket only* · *Exhibition*; the Exhibition card reads **"Games and standings, no
  playoff bracket — for a scrimmage day or an exhibition weekend."** The wizard/onboarding write
  the setting whenever it is not the default. Event settings: a third segment, a third description
  (**"No playoffs — every game is a stand-alone game. Standings still run; hide the Standings page
  in Public pages if you don't want a table."**), the summary line reads *Exhibition · 60m games*,
  the lock note is unchanged, and the confirm dialog names whichever format is being switched to.
- **P3 — The admin schedule under Exhibition.** No Stage toggle (phone row and desktop control),
  `viewMode` pinned to `'pool'` (mirror of the existing bracket-only pin, line 373), the View
  control offers List | Timeline only, *Add Game* stays the header primary, the Playoff Bracket
  Builder launcher and the Bracket PDF export item never render, the empty-state callout reads
  **"Add your games by hand — a day of scrimmages is a handful of rows. The Round-Robin Generator
  can build them from your teams with Tournament Plus."** (the Plus half only when the plan lacks
  `auto_schedule`), and the Schedule Health subtitle reads *Saved games* rather than *Saved round
  robin*.
- **P4 — The dashboard knows the format.** `readyToFinalize = isActive && allGamesResolved &&
  (hasPlayoffs ? gd.playoffGamesTotal > 0 : true)`, extracted into a pure helper beside
  `resolveGuidanceStage` so it gets a unit test. `GuidanceContext` gains `hasPlayoffs`; the *pre*
  shortcut becomes **"Add your games"** (→ `recipe-build-tournament-schedule`) and the *live*
  shortcut **"Print today's schedule"** (→ `exports`) when there are no playoffs; the *ready*
  context reads **"Every score is final. Mark the tournament complete to lock in your results and
  standings."** for an exhibition and keeps the champions sentence otherwise. The status pill then
  reads *Ready to finalize* the moment the last game is scored. The By-Division playoffs footer and
  the "Playoff games" sub-stat are already conditional on playoff games existing.
- **P5 — The public schedule under Exhibition.** The stage control (both renderings) is behind
  `hasPlayoffs`; the layout control loses *Bracket*; the playoff-day auto-stage effect is a no-op.
  Nothing else on the public site changes: the Standings tab stays and honours the organizer's Hide
  Standings choice (D2); the overview already finishes a no-bracket event on its own (path 3).
- **P6 — Words.** Help: the public-pages paragraph gains one sentence for Exhibition ("An
  Exhibition event has no bracket, so there is never a Playoffs tab"), and the setup / schedule
  articles get a line each for the third style (run `/docs`); a changelog entry; the spelling gate
  sees one word — *Exhibition* — everywhere a customer reads it. Demos: unchanged (D4).

**The alternative (not recommended):** no new format — instead detect "no playoff config on any
division" at render time and hide the same things. Cheaper by a picker, but it makes the promise
disappear only after the organizer has *not* done something, so every surface flickers between
the two shapes as the tournament is set up, and the dashboard could never safely fire *Ready to
finalize* early (the whole reason F03's guard exists). A format is a decision the organizer makes
once; the surfaces should follow the decision, not guess it.

## Owner forks (rule on the hub's Decisions tab)

| # | Question | Recommendation | State |
|---|---|---|---|
| D1 | What is the third style called? | **Exhibition** — the word already in the marketing page, the coach set-up card and the delegation ruling. "Scrimmage" is a coach-schedule event type and stays out of this picker. | **Accepted 2026-09-13** |
| D2 | Does a scrimmage day need a fourth, standings-less format? | **No** — the existing *Hide Standings* public-page switch already gives that. | **Accepted 2026-09-13** |
| D3 | Switching format when games exist deletes the whole schedule today. Exhibition and round robin + playoffs share identical round-robin games. Keep the blanket rule for v1? | **Keep it.** The format is only changeable in Draft, and a draft with typed games that then changes shape is rare; a smarter "delete only the playoff games" rule is a separate small project if it is ever asked for. | Open |
| D4 | Should a demo world show an Exhibition tournament? | **Not now.** Both demos run round robin + playoffs and their narration is already owed a truing-up; adding a third shape to the coach sandbox is a re-seed decision for the next coach-demo change, not this one. | Open |

## Phases

### Phase 0 — Mockup ratified (this hub)
Owner reads the Mockup tab (the three-card picker on desktop and phone, the admin schedule before
and after, the dashboard's game-day card, the public schedule, Event settings) and rules D3/D4.
No code before this.

### Phase 1 — The value and the pickers
`lib/types.ts` (`TournamentFormat`, the settings doc comment); `lib/tournament-phase.ts`
(`hasRoundRobin`, `hasPlayoffs`, `isPlayoffOnly` retired); the API allow-list; the eleven call
sites re-pointed; the wizard, onboarding and Event settings pickers (P2) including the settings
page's parse at line 239, the summary label, the description and the confirm copy; the write rule
in the two wizards.

### Phase 2 — The surfaces
Admin schedule (P3) — stage controls, view options, header primary, the Bracket Builder launcher,
the export item, the callout, the health subtitle. Dashboard (P4) — the finalize predicate
extracted and tested, `GuidanceContext.hasPlayoffs`, the three copy branches. Public schedule
(P5) — the two stage renderings and the layout control. Preview layout — unchanged (it hides
Standings for bracket-only only; exhibition keeps Standings).

### Phase 3 — Words
`/docs` for the three help touch-points and their search keywords; changelog entry; spelling gate.
Demos untouched per D4 (`check:demos` must stay green — both worlds keep their format).

### Phase 4 — Verify and hand off
`npm run typecheck` (a shared type changes); `verify:changed`; **tests**:
`tests/unit/public-bracket-visibility.test.ts` gains an `exhibition` fixture (Standings visible,
no Playoffs tab, bracket not visible), and a new `tests/unit/tournament-finalize.test.ts` pins the
extracted predicate for all three formats (round robin with an unbuilt bracket must still NOT be
ready — F03's original guard survives). A rendered layout check of the three-card grid at phone /
641–768 / desktop (44px floor on the cards). Then `/simplify` (two new helpers replacing one — the
altitude pass should confirm no call site still asks the old question), `/review`, `/docs`,
commit in a private index, and the owner QA walk added to this hub as its QA Walk tab (fixture:
`uat-standalone` — the standalone-coach org, rebuilt with `seed-uat-standalone-coach.mjs` if it is
stale; steps pin identities, never figures the calendar moves). Ledger § assigned when the walk is
written.

## Out of scope
- A smarter format switch that keeps the round-robin games (D3 keeps the blanket rule).
- A standings-less format (D2).
- Any change to the plan gates — the Round-Robin Generator stays Tournament Plus.
- Linking the coach schedule's *Scrimmage* event type to hosted exhibition games (they mirror as
  tournament games today and keep doing so).
- The history look-back layer — no route or page learns a year (`HISTORY_ENDPOINTS` untouched).

## Standing rulings this plan honours
- **One word everywhere a customer reads it** — *Exhibition*; no "exhibition-only", "scrimmage
  day" or "no playoffs" as a *name* anywhere (they may appear in a description sentence).
- **Disagree out loud** — the alternative (render-time detection) is argued and rejected above,
  from what the code does.
- **Every highlight is clickable** — every F-flag and NEW/RESTYLED/UNCHANGED tag on the hub opens
  its explanation.
- **Mockups as Artifacts; one hub per project** — this hub, republished on the same path.
- **A season is live until closed** — nothing here touches the coach portal's season model.
- **The demo shop window** — considered (D4); no change in this unit of work.

## Verification plan + residual risk
- **The parse trap.** After Phase 1, a grep for the two old literal values outside `lib/types.ts`,
  `lib/tournament-phase.ts`, the pickers, the API allow-list and the tests should return nothing —
  any remaining literal is a place that will read an exhibition as one of the other two. This is
  the check `/simplify`'s altitude pass is asked to make.
- **The finalize guard.** The unit test must include the case that motivated the original guard
  (round robin + playoffs, all pool games resolved, no bracket built → NOT ready).
- **Residual:** a tournament whose `settings.format` was written by old code during a deploy
  window carries one of the two old values — both still valid, nothing to migrate. A settings
  write with `'exhibition'` against a not-yet-deployed API is dropped by the allow-list (the
  wizard already treats that write as non-fatal), so the picker on stale code degrades to round
  robin + playoffs, which is the behaviour today.

## Build log
- 2026-09-13 — assessment in chat; owner ruled D1 + D2; plan, brief and hub written and published.
- 2026-09-13 — owner accepted D3 + D4; built on dev in the same session. What landed, by phase:
  - **Phase 1** — `TournamentFormat` gains `'exhibition'`; `lib/tournament-phase.ts` gains
    `TOURNAMENT_FORMAT_OPTIONS` / `TOURNAMENT_FORMAT_VALUES` / `isTournamentFormat` /
    `tournamentFormatLabel` (the one list the pickers, the API allow-list and the confirm dialog
    read), a validating `getTournamentFormat`, the two predicates `hasRoundRobin` / `hasPlayoffs`,
    and `isReadyToFinalize`; **`isPlayoffOnly` is gone** (eleven call sites re-pointed — the
    bracket editors keep a local `isPlayoffOnly` boolean derived from `!hasRoundRobin`). The API
    allow-list reads `TOURNAMENT_FORMAT_VALUES`. **New shared component**
    `components/admin/TournamentStyleCards.tsx` (+ module CSS: three across, stacked ≤768px,
    44px floor) replaces the two identical inline card lists in the setup wizard and the org
    sign-up wizard; both write the setting whenever it is not the default. Event settings: the
    parse at line 239 goes through `getTournamentFormat`, the segmented control maps the options
    list, a third description, the summary and confirm copy use `tournamentFormatLabel`.
  - **Phase 2** — admin schedule: `hasRoundRobinStage` / `hasPlayoffStage` / `showStageToggle`
    replace the single boolean; both stage controls render only when both stages exist; a second
    pin keeps an Exhibition on the round-robin stage; the tools menus gain `showAutoGenerate` /
    `showAutoBracket` so an item that does not apply is **absent, not locked** (this also fixes
    the pre-existing bracket-only case, which showed the Round-Robin Generator locked with a Plus
    hint); the empty-state callout and the health subtitle branch on format. Dashboard:
    `readyToFinalize` comes from `isReadyToFinalize` with `hasPlayoffs(currentTournament)`;
    `GuidanceContext.hasPlayoffs` feeds the two shortcut swaps and the ready-stage sentence; the
    help drawer passes the same flag. Public schedule: the stage control (both renderings) is
    behind `showStageToggle`; the initial-stage and bracket-layout initializers read
    `hasRoundRobin`; a second pin keeps an Exhibition off the playoff stage.
  - **Phase 3** — help: the "Build a playoff bracket" intro, the schedule recipe's Add Game step
    and "Tournament workflow at a glance" step 1 name the third style. Release notes are appended
    by `/release` at promote time, not here. Demos untouched (D4) — `check:demos` green.
  - **Phase 4** — tests as above; `npm test` 3,867/3,867; `npm run typecheck` clean; focused lint
    0 errors (the `react-hooks/set-state-in-effect` warning on the public schedule's stage pins
    is the pre-existing pattern that file already used for the bracket-only pin); the layout
    check of the three-card grid at phone / tablet / desktop is left to the owner's walk (Part A,
    step 2) — no Playwright pass was run.
- 2026-09-13 — owner said "go ahead with simplify, review, docs and commit"; ran all three, in
  that order, scoped explicitly to this project's own files (the working tree carries several
  other sessions' unrelated uncommitted work).
  - **`/simplify`** — 4 parallel lenses (reuse, simplification, efficiency, altitude) against the
    scoped diff. Two lenses independently flagged the same thing: the "write the chosen format
    after create" block had been copy-pasted into both wizards (the exact class of drift the new
    shared card list was built to prevent). Fixed with one exported helper,
    `tournamentFormatCreatePatch()`, that both wizards call — the decision of "what counts as
    non-default, and what to write" now lives in one place. Also fixed: two dead `= true` default
    props on the schedule page's tools-menu components (both call sites always passed both
    explicitly — made required instead); and, from the altitude lens, Event settings' format
    description was still a three-way `===` ternary chain rather than a lookup through the shared
    options list — replaced with a `Record<TournamentFormat, string>` (`tournamentFormatSettingsDescription()`),
    which makes a future fourth format a compile error here instead of a silent fall-through.
    Efficiency lens flagged one negligible double-derivation (calling `hasRoundRobin`/`hasPlayoffs`
    back-to-back re-derives the format twice) — skipped: the suggested fix would either inline a
    raw literal comparison at the call site (the exact anti-pattern this project exists to remove)
    or add a new API surface for a cost too small to matter.
  - **`/review`** — high-risk tier, 4 parallel lenses (correctness, security/multi-tenant,
    data/contract, regression/blast-radius) plus a 5th gap-fill lens after the diff-extraction
    step was found (by the data/contract lens) to have silently dropped 3 brand-new untracked
    files — corrected mid-review, and a dedicated pass run over exactly those 3 files.
    **One real defect, independently found by three lenses from three different angles and fixed:**
    the public bracket-visibility check (`isPublicBracketVisible`) had no case for a format with
    no playoffs at all, so it fell through to the same branch as a normal round-robin event and
    read `true` whenever Standings was public — the default state. Concretely: the direct-URL
    Playoffs page would render "the bracket isn't set yet" on a format that will never set one,
    and — the sharper case the regression lens traced end-to-end — switching a Draft tournament to
    Exhibition after a bracket had already been built only deletes the games, never the division's
    playoff configuration, so a real (if empty) bracket and its nav tab could resurface on the
    public site. Fixed with a `hasPlayoffs` guard as the function's first check, plus a direct
    regression test (`tests/unit/public-bracket-visibility.test.ts`) asserting the bracket is
    never visible for an Exhibition tournament, hidden Standings or not. The gap-fill lens
    separately found one test-quality defect: an assertion comparing `TOURNAMENT_FORMAT_VALUES`
    against a fresh call to the exact expression that defines it, which cannot fail under any
    real regression — replaced with a comparison against a literal ground-truth array. Two
    Advisory-only findings (a picker component's dead-code literal default; a pre-existing,
    unrelated quirk in the settings API's generic sanitizer) were confirmed but left as-is.
  - **`/docs`** — the three prose edits made while building (the bracket-builder intro, the
    schedule-recipe step, the setup-order list) existed only in rendered copy, not in any
    section's `keywords`/`searchText` — a search for "exhibition" would have found nothing.
    Added search coverage to all three sections plus a fourth, `public-site-preview` (the fan
    navigation FAQ), whose "bracket-only is the exception" sentence about the Playoffs tab was
    widened to name Exhibition as the opposite exception (never shows the tab at all) for the
    same symmetry the rest of this project draws between the two non-default formats.
  - **Verification after all three:** 23 unit tests across the two format-specific files (2 new:
    the added regression test and the split-out literal-ground-truth test); 3,869/3,869 full
    suite; typecheck clean; focused lint 0 errors; spelling, CSS-module-purity, CSS-selector,
    public-token, help-structural and `check:demos` gates all green. Awaiting commit.
