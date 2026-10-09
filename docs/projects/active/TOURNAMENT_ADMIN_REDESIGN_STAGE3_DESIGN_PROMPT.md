# Tournament admin redesign · Stage 3 drawn — The schedule

> Paste into a fresh session on `dev`. Written 2026-10-09, after Stage 6 (the volunteers) was built and walked
> (§282 ✅). **Design only: no product code until the owner rules.** Read "Working beside the other sessions" before
> touching the dev server or a shared file.
>
> **Why now, and why before the club's scheduler.** Two things changed on 2026-10-08:
> - **Club Tier Stage 6 was ratified and its first half (6a) built:** one venue book and one clash check that every
>   schedule writer in three programs runs, tournaments included. Stage 3 waited for exactly that (plan §7, "two
>   orderings are load-bearing"). It can draw now.
> - **The owner added Club Tier Stage 11, a club scheduler,** and asked that it work *"like tournament admins can"*:
>   parameters, a generated draft, adjusted by hand, finalized and sent. That is this stage's screen. The club's
>   joint Stage 10 + 11 mockup session will read **your** rulings, so the tournament generator it copies is the
>   redesigned one, not today's. Draw the tournament's schedule; do not draw the club's scheduler.

## Read first

- `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`:
  - §1: evidence. Label every guess as a guess ("a guess — a first director would tell us").
  - §2: the rulings not reopened. Note the Club Tier paragraph: **Stages 3 and 5 draw against the club hub's
    Stage 6 specimens 4 and 7** and wire to 6a's check and shared field.
  - §3 **"The schedule"**, F19–F24, plus any game-day or after-the-event finding that lands on a schedule screen.
  - §4: the nine rules across the stations. Rules 3 (a row opens its own record), 4 (open on what needs you),
    6 (the control you use most is the biggest) and 8 (one name per tool) are this stage's.
  - §5: the ladder, row 3. **Both widths:** a director builds a schedule at a desk and fixes it from a phone.
  - §6 G8 and its as-built note: the board's **"Running late?"** door opens the schedule's rain-delay tool. That door
    is where Storm Mode's "Declare a delay" will land.
  - **§6f Stage 6, as drawn and as built.** The newest record; yours (§6c) follows its shape.
  - §7: A2 (one event identity), A4 (Storm Mode and the Big Board stay their own projects, with a place left), A5
    (the Club seams), A6 (plan gating on redesigned screens), A7 (one word per game state).
  - §8: build order against the foundation's cleanup (Part B skips the screens a redesign replaces).
  - §11: the formatting check. Run it before the owner sees anything.
- `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 **Stage 6** (the ratification and **"6a BUILT"** records) and
  **Stage 11**. From Stage 6, these are yours:
  - **Ask 13's one Venue field.** "The tournament's forms take it in Tournament Stages 3 and 5": the game window
    and the schedule's inline edit are Stage 3's; Venues & Facilities is Stage 5's.
  - **S6-03:** the tournament's own same-event refusal runs in the browser only, and four writers skip it.
  - **6a's "Found, not fixed" F1:** the dashboard's "playing now" window assumes 60 minutes; the scheduler assumes 90
    for the same game. One game length should mean one thing.
  - **The owner's ruling: a DRAFT tournament's games count as bookings** (a club's coaches see the planned
    tournament before booking over it).
  - Stage 11's "Read first (the code)" paragraph describes today's tournament generator as the precedent. Read it
    as the club's view of your screen.
- The club hub (read only; never publish it): https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups →
  Stage 6, **specimen 4** (`#s6-tourn`, `#s6-tourn-a`: the amber line under the field on Add Game, the drop, the
  shift, the generator, the import) and **specimen 7** (`#s6-where`, `#s6-where-a`: Venue, then the sport's word, on
  every form). Also `#s6-calendar` / `#s6-cal-week`, the club calendar's week: see Ask 9.
- The June organizer journey (J1, *Dana*): `docs/projects/archive/journeys/`, its schedule rows (J1-079 the drag,
  J1-090 the coin toss, and the rest). Re-verify each against today's code; tag it open, fixed (with its commit) or
  partly.
- The hub (ONE artifact; republish the SAME path): `docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_HUB.html` =
  https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM. **Walk tab, the schedule station**; the Stage 1, 2, 4 and 6 tabs
  for the drawing method.
- Memory: `project_tournament_admin_redesign`, `project_club_tier_readiness`, `feedback_portal_is_the_formatting_benchmark`,
  `feedback_build_to_approved_mockups`, `feedback_clickable_design_annotations`, `feedback_mockups_as_claude_artifacts`,
  `decision_one_toolbar_rare_tools_behind_tools`, `decision_record_reads_first_edits_whole`,
  `decision_edit_autosaves_create_asks`, `decision_export_is_one_button`, `decision_waiting_count_is_amber_pill`,
  `reference_hub_script_parse_trap`.

## The rulings your drawings follow (in-repo `memory/design_decisions.md`)

- **One toolbar in every view; rare tools behind Tools** (2026-10-01). A Tools menu names its groups only when there
  is something to tell apart (2026-10-09).
- **A record reads first and edits whole** (2026-10-01): a game's window reads, and its pencil flips the whole
  record.
- **Edit autosaves, create asks** (2026-09-24). A timeline drop is an edit, so the question is what makes it safe to
  take back: see Ask 4.
- **Export is one button** (2026-10-01). **A waiting count is the amber pill** (2026-10-01).
- **2026-10-07:** a filter is quiet until it filters; the olive pill chooses what is read; a close × is a plain glyph.
- **Phone sheets are one frame with two layers: a form covers the bar, a menu sits on top of it** (2026-10-05).
- **From Stage 1:** one word per game state; a row's worded action is olive and lime is one main action per screen
  (A12); a row that opens, opens from anywhere.
- **Control height:** 34px on a computer (2026-10-03); at touch widths the admin's 38px height exception (K-18) stands,
  and it never excuses width.
- **Club Tier Stage 6:** one Venue field (the venue, then the sport's word for the surface: Diamond, Court, Field);
  one amber line for a clash with another program, which never blocks; a program's own refusal stays its own (house
  league keeps its refusal; draw where the tournament's sits, Ask 5).

## Verify before drawing

**A starting map (read from the code 2026-10-09; re-read each line before you rely on it).** `S/` below means
`app/[orgSlug]/admin/tournaments/schedule/`.

- **One route, one very large page:** `S/page.tsx` (about 3,500 lines; the tournament comes from context or
  `?tournamentId=`).
  - It restores the last stage (Round Robin / Playoffs) and view (List / Timeline / Bracket) per device, opens on the
    first division, and filters to `scheduled` games only. That filter is F19's empty list.
  - The List has no day scope. The Timeline opens on today when today is a tournament day (else the first day), with
    previous/next arrows only.
  - Header: the Export menu (Excel, CSV, PDF, plus a bracket PDF and a blank bracket) and Add Game / Build Bracket.
    Toolbar: Division · Stage · View, then Publish and the Tools menu; a second row (search, venue filter, status chips)
    that the Timeline hides.
  - Its parts: `GameList` (a row expands into an inline edit), `ScheduleTimeline`, `PlayoffBracketView` →
    `components/BracketColumns.tsx`, `BracketEditor` + `BracketBuilder`, the Add/Edit Game window,
    `PublishScheduleModal`, `ScheduleHealthPanel` (collapsed by default), `ResolveLocationsModal`, `ZeroVenuePrompt`,
    and the `Generator`, `PlayoffWizard` and `ShiftDayModal` windows.
  - **No game opens a game of its own.** A row expands in place; nothing on the schedule opens Results' game
    (`?gameId=`).
  - The schedule import is not here: it lives in Data tools (`components/admin/import/TournamentScheduleImportDialog.tsx`).
  - The old look: the page and nine of its parts are on the old-look baseline (the page alone carries 55 legacy
    halves; the three stylesheets carry hundreds of kit-scope rules). Several parts aren't on it at all. Plan §6's
    Stage 1 record leaves "GameList's planning half and the game list's kit block" to Stage 3.
- **Two generators and about a dozen names (F21 is wider than two).**
  - Round robin, `S/Generator.tsx`:
    - the mode (team- or slot-based), Replace all / Build from current, the division, games per team;
    - date rows (date, start, end), game length, turnover;
    - presets (Balanced, Rest-friendly, Compact, Facility-friendly, Younger earlier) and the advanced settings;
    - facilities, or temporary lanes.
    - It offers three ranked drafts (Best overall, Fewest moves, Best rest), "Another set", then deletes in scope and
      saves.
  - Playoffs, `S/PlayoffWizard.tsx` (tiered brackets, seeding by drag or Randomize, "Auto-schedule dates & times").
  - The names: "Round-Robin Generator", "Schedule Generator", "Generate Round Robin Draft", "Commit Schedule",
    "Confirm & Save", "Auto-Generate Bracket", "Playoff Bracket Builder" (which clashes with the free "Build Bracket"),
    "Generate Playoff Bracket", "Auto-generate instead", and the dashboard's "Build schedule →". Grep for more before
    you count.
  - **Plan gates** (`lib/plan-features.ts`): Tournament Plus holds `auto_schedule`, `playoff_generator`,
    `bulk_reschedule` (the rain delay) and `schedule_notification`; the free plan holds `playoff_manual`. ⚠ The page
    gates the playoff wizard on `auto_schedule`, not `playoff_generator`: an A6 finding.
- **By hand:**
  - A timeline drag is an optimistic move saved at once. The drop's preview colours an overlap but **does not refuse
    it**; only the bracket's order refuses.
  - On a phone (768 and below) a game is moved by tap → a bottom sheet ("Reschedule / Place game"). Its Save isn't
    refused on a conflict, and the sheet is A29's (Stage 6 ruled it onto the shared frame).
  - **Undo exists nowhere** for a drag, an edit, the generator or the rain delay. The only undo is the "Resolve
    locations" window's, scoped to the session: the precedent to read.
  - The Add/Edit Game window and the inline edit **refuse** an overlap (a buffer only warns). So inside one tournament
    the same overlap is refused by two doors, allowed by two (the drag, the phone sheet), and refused by no server
    (S6-03).
  - The generator's "Keep / Release" lock exists. Swapping two games does not exist.
- **The rain delay** (`S/ShiftDayModal.tsx`, titled "Rain delay"):
  - It opens on today or the next day with games, offers 30, 60 or 120 minutes or a custom shift, can cancel games,
    and ends with an announcement step.
  - The Tools menu shows it only while games are still to come. `?tool=rain-delay` is the target of the board's
    "Running late?" door (G8, built), so re-measure F24 before drawing it: it may be partly fixed.
  - Storm Mode: no code; only planned in `PROGRAM_TOURNAMENTS.md`.
- **Publishing** is per division (`PublishScheduleModal` → `app/api/admin/schedule-publish/route.ts`), with unpublish
  for one division or all.
  - "Your game moved" notices (`lib/schedule-change-notices.ts`) apply to published divisions only, batched with a
    quiet window.
  - Published games reach linked coach teams through `lib/rep-tournament-game-mirror.ts`; the coach reads "From
    {tournament} · organizer's schedule".
  - ⚠ **Help says the opposite:** the tournaments help article says "there is no separate schedule publish step"
    (`lib/help-content/tournaments.tsx`), and its FAQ still says "Auto-Generate". Record both as findings for
    `/docs`; don't edit help.
- **Clash checks:**
  - `lib/schedule-conflict.ts` (same tournament: an overlap refuses, a buffer warns), used by the window, the inline
    edit, the timeline's colours and the import.
  - `lib/schedule-metrics.ts` feeds the health panel's conflicts.
  - **6a's cross-program check** (`clashReportForTournamentGames`, `lib/venue-clash-lookup.ts`) runs on every
    tournament writer: add, edit, drop, un-cancel, the rain-delay shift, lanes, the location resolver and its undo,
    and the import. It runs only for an org with a venue library and only on library-linked venues; it warns and never
    refuses, and its answer comes back as `crossProgram`.
  - ⚠ **No tournament screen reads that answer yet,** and the tournament has no pre-save check like house league's.
    The shared parts to use: `WhereLine` and the Venue field (`components/venue/WhereField.tsx`), `useClashCheck`, and
    the words in `lib/venue-clash-words.ts`.
- **The bracket:** the admin's `BracketColumns` shows placeholders, date, time and field, with no score and no winner
  (F20). **The public bracket already shows both** (`components/bracket/LogicSyncBracket.tsx`, `TieredBracket.tsx`).
  Seeds fill from standings as games finish.
- **The coin toss:**
  - "Coin Toss" is a tie-breaker (`lib/tie-breakers.ts`), not in the default order, edited in Event settings and per
    division.
  - The toss is recorded only by `components/admin/CoinTossRecorder.tsx`, switched on in the **organizer's preview**
    of the public standings, which then re-seeds.
  - The dashboard's "Coin toss required" nudge links there. Nothing on the schedule or the bracket says a toss is
    pending (F23).
- **The phone:** everything switches at 768.
  - Stage buttons sit on screen. Publish and a phone Tools menu sit beside search.
  - A settings pill opens a "View settings" sheet.
  - The game list stays rows (status and conflict tags in the date cell), not cards.
  - The Timeline becomes a one-field pager with swipe and tap-to-place.
  - There is no day picker beyond the arrows.
  - F37: the schedule has 19 controls under 44px at 390. F38: the free plan's Tools shows the generators behind a bare
    padlock.
- **Layout sweep ids** (`scripts/layout-screens.mjs`): `admin-t-schedule`, `-schedule-health`, `-timeline`,
  `-playoff-timeline`, `-bracket`, `-bracket-editor`, `-generator`, `-playoff-wizard`, `-add-game`,
  `-schedule-rain-delay`, `admin-t-preview-schedule`, `admin-t-data-tools-import-schedule`.
- **The demo tour** (`data-sandbox-tour`, `lib/sandbox-chrome.ts`):
  - Step 4, "Try to break the schedule", points at `schedule-health` on `ScheduleHealthPanel`, which is collapsed by
    default; the same id is on the dashboard and the game-day board.
  - Step 2 points at `playoff-bracket` on the public standings.
  - Name each one's home if your drawings move it.
- **This project's hub:** tabs are `<button data-hub="…">` → `<section id="hub-…">` (walk, s1, s2, tb, s4, s6, brief,
  plan, decisions, qa). Add `s3`. The Walk tab's schedule station is `#st8`, and its Q 8.1 ("Should the schedule open
  on the whole day, played games included?", recommended: Reshape) is this stage's founding question.

- **F19–F24 and every J1 schedule row.** Tag each on the hub: open, fixed (with its commit) or partly. Draw only what
  is open.
- **Every writer that moves a tournament game,** and what each does today on a same-event overlap (S6-03) and on a
  cross-program clash (6a). A writer that refuses in the browser but not on the server is a finding.
- **Every name the product uses for generating a schedule** (F21), on every door, heading and button.
- **Plan gating (A6):** which of the schedule's tools are Tournament, which Tournament Plus (the generator's drafts,
  the rain-delay tool, tiered brackets, manual brackets). Draw the locked state where a free organizer meets it.
- **The Exhibition format:** no playoffs, no bracket. Say what its schedule shows, and draw it if it differs.
- **Storm Mode and the Big Board:** confirm nothing of either is built. The rain-delay tool is drawn as the
  tool it is today, in its new home; Storm Mode's place is left, not designed.

## What Stage 3 draws (both widths; the desk first for building, the phone first for fixing)

1. **The schedule, opening on the day (F19).** Today's games, played or not, in every division; one tap to the rest.
   Before the event, it opens on the first day; after it, on the last. Whole screen, desk and phone, before and after.
2. **A game opens that game.** The game's window reads first (teams, time, Venue and surface, status, score), its
   pencil edits the whole record, and its Venue field is Ask 13's. The clash line sits under the field, as in the club
   hub's specimen 4.
3. **The generator, one name (F21).** The parameters, the drafts, choosing one, and what "replace" versus "build"
   says before it acts. Clashes with the club's other programs appear in the drafts (specimen 4). Mark which parts of
   this flow are generic (parameters → drafts → adjust → publish) and which are the tournament's own: see Ask 8.
4. **Moving a game by hand (F22).** The timeline drop at a desk and the move sheet on a phone, their undo, the
   same-event refusal (Ask 5), the published-game case (who is told, and when), and the clash line after a move.
5. **The rain-delay tool, in its home (F24).** Today's shift-a-day, reached from the board's "Running late?" door and
   from the schedule, three taps or fewer. Leave Storm Mode's "Declare a delay" a visible place; don't design it.
6. **The bracket (F20).** Scores and winners in the live bracket; the champion where the bracket ends.
7. **The coin toss where seeding happens (F23).** A pending toss said on the playoff view, the bracket builder and
   Results; recorded there, not on the public preview alone.
8. **Publishing.** What a director sees before and after publishing a division: who is told, and what reaches the
   linked coach teams' schedules ("From {tournament}").

**Not drawn. List these on the hub as the build's work:**
- **the page split first:** one 3,500-line page is the riskiest ground in the stage, so its build starts by splitting
  it, measured identical before any redesign lands (the coach schedule deep dive's stage 1 did the same);
- the old look's retirement in every file Stage 3 rebuilds, held by `npm run check:old-look` and the strict admin
  colour gate;
- the server-side same-event refusal for every writer and a tournament pre-save check for the amber line (S6-03,
  Ask 5);
- the game-length answer (6a's F1), if Ask 7 rules it;
- the playoff wizard's gate read from the right plan feature (A6).

**Found, routed, not drawn:** the help article's "no separate schedule publish step" and its FAQ's "Auto-Generate"
(→ `/docs`).

**Out of scope here:** Venues & Facilities, the setup wizard and Event settings (Stage 5, which also takes the
clone's lost facilities, 6a's F2); the club's scheduler (Club Stage 11); Storm Mode and the Big Board (their own
projects); the public pages (a door only).

## Method (Stage 4's and Stage 6's)

1. **Measure before you draw.**
   - Put the probe in `.probe/`, never in `test-results/`.
   - Use the organizer accounts on the Plus and the free test clubs (`uat-plus-org`, `uat-test-org`), and the club
     fixture's tournament for a cross-program clash (6a seeded club venues with `--club-venues`; check whether that
     tournament's venues are linked to the library before relying on it).
   - Measure at 390×844, 360×780, 768×1024 and 1440×900, in Warm and Dark, reading numbers from the browser's
     geometry.
   - Record: what the schedule opens on; taps to today's games; taps from a game row to its score; taps to move a
     game and to take the move back; taps to the rain-delay tool from the board; taps to see who won a bracket game;
     every control under 38px at touch widths; every sideways spill.
   - ⚠ **Probes write nothing.** Refuse every non-GET. A drop, a generate, a shift or a publish is a write: do it only
     on the owner's word, then undo it and read the undo back.
   - The fixture's events are in the past (June 2026), so "today" may never show. **Seed, move or add nothing without
     asking.** Where real data is missing, draw the "before" from the code and say so on the drawing.
2. **Draw on a new "Stage 3" tab.**
   - True size: the whole screen before (today's captures) and after, at both widths.
   - Every flag and fix chip is clickable, with its `data-here` sentence.
   - Every element is tagged NEW, RESTYLED or UNCHANGED, with its own note. Tag the club's shared parts (the Venue
     field, the clash line) "shared, Club Stage 6": drawn as built, not redrawn.
   - Put the 44px block beside every phone frame.
3. **Run the formatting check before the owner sees anything.** Put it on the tab's last section, as the other
   stages did.
4. **Write the asks.** Each one gets options, a recommendation, the tradeoff, and a checkbox per option on the
   paste-back.
5. **Taps to beat.** Record today's and the drawing's for:
   - today's games, from the board;
   - a game's score, from the schedule;
   - moving a game, and taking it back;
   - a round robin generated and chosen;
   - a rained-out afternoon shifted;
   - a bracket game's winner, read.

## The asks (each with a recommendation; Decisions rows, `open`)

1. **What the schedule opens on (F19).** Recommended: the day (today during the event, the first day before it, the
   last after it), every division, played and unplayed; the filters quiet until used.
2. **One name per generator (F21).** There are two generators (round robin, playoffs) and about a dozen names.
   Recommended: one verb for the act on every door ("Generate…"), one name per generator ("Round-robin generator",
   "Playoff generator"), and the free plan's hand-built bracket keeps "Build bracket" so it never reads as the paid
   tool. Tag every word `/marketing`.
3. **A game opens that game.** Today a row expands into an inline edit, and a separate window adds and edits.
   Recommended: one game window (it reads first and its pencil edits the whole game), opened from the list, the
   timeline and the bracket; the inline edit retires; the Venue field is the club's one field; a score is entered
   where Stage 1 enters it (one door, not two).
4. **A drop and its undo (F22).** There is no undo anywhere in the schedule today. Options: an undo notice after every
   move (drag, phone sheet, window); a draft of moves that publishes together; or both (an unpublished game moves at
   once with undo, a published one asks first because families and linked coaches are told). Recommended: **both**.
   The rain delay's shift gets the same undo.
5. **One refusal for a same-event overlap (S6-03).** Today two doors refuse it (the window, the inline edit), two allow
   it (the drag, the phone sheet), and the server allows it. Recommended: every door and the server refuse an overlap
   inside the tournament (a buffer still warns), and a clash with the club's other programs stays an amber line that
   never refuses. Draw the two side by side so the difference reads. The tournament needs a pre-save check, like house
   league's, for the line to show before Save; name it as the build's work.
6. **The bracket shows scores and winners (F20).** The public bracket already does. Recommended: the organizer's
   bracket reads the same way as the public one (one bracket, two places), with the winner in plain ink and a mark
   (the winner-green question goes to the exception register) and the champion at the end.
7. **One game length.** The dashboard's "playing now" assumes 60 minutes, the club's clash check 90, and a
   tournament game carries its own length. Recommended: one answer, the tournament's own game length wherever it is
   set, and the shared 90 only where nothing is set. Ask; don't assume.
8. **The generator as a pattern for the club's scheduler.** Recommended: draw it for the tournament only, but name
   the generic flow (parameters → drafts → adjust → publish) and tag those parts "shared candidate, Club Stage 11",
   so the club's joint Stage 10 + 11 session starts from them. The tradeoff: naming a pattern now shapes a screen
   that isn't drawn yet. Say so.
9. **The day and week views against the club calendar.** The club calendar (6b) draws a week of the club's
   bookings. Recommended: where the two answer the same question (what is on, when, where), they share a shape; the
   tournament's timeline of venues across time stays its own, because placing games on surfaces is a different job.
10. **The rain-delay tool's home (F24).** G8's "Running late?" door already opens it from the board. Recommended: keep
    that door and one row in the schedule's Tools, three taps or fewer, the shift with Ask 4's undo, and Storm Mode's
    place left beside it.
11. **The coin toss (F23).** It is recorded only in the organizer's preview of the public standings. Recommended: a
    pending toss shows as the amber waiting pill on the playoff view, the bracket and Results, and is recorded there
    (the same recorder, moved); the dashboard's nudge opens it there.
12. **The phone (F37, F38, A29).** Recommended: the 19 controls under 44px brought to the admin's 38px height and full
    width where they are the daily job; the free plan's locked generators say what they are and which plan has them,
    in words, not a bare padlock; the move sheet on the shared frame (A29, ruled with Stage 6).
13. **Anything the measuring finds** that F19–F24 and J1 miss. Say so; don't force-fit it.

## Working beside the other sessions

- **Club Tier Stage 6b's build** (the club calendar and the Venue library) may run at the same time. It shares no
  screen with this stage and no hub, but it shares the dev server, the test clubs, the browser and the owner's time.
  Its calendar is Ask 9's reference: read its drawings, never its uncommitted code.
- **Other sessions may be mid-change on shared parts** (on 2026-10-09: the portal's Back step). Check `git status`
  before relying on how a shared part behaves.
- **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another session
  is measuring. A second runner rotates the shared UAT sessions and signs the other one out mid-run. **Never reset a
  test club** without asking.
- **A new shared pattern is an ask, not an invention.** The Venue field and the clash line are Club Stage 6's, built.
  The sheets have one frame and rows have one recipe. A change to any of them is drawn as an ask tagged "shared".
- **No code, no help, no gates.** Your files:
  - this project's hub: the Stage 3 tab, and its FINDINGS / INTENTS / Decisions additions;
  - the plan's §5 row 3 and a §6-style Stage 3 section (`§6c`);
  - the PM brief, your TODO line, and memory.

  Read the hub fresh before every edit. **Parse its scripts before every publish**, because one bad apostrophe kills
  every tab. Never `force` a refused publish. **Never publish the club hub.**
- **Git:** use a private index and explicit pathspecs. Build a shared file as HEAD plus your own hunks, and re-read
  HEAD immediately before committing: on 2026-10-08 another session's commit dropped a just-committed TODO line. After
  committing, run `git reset -q -- <paths>` on the shared index. Commit only when the owner says.

## Hand-off

- Write in product-owner voice.
- Lead with what a tournament director sees and does differently: on the Saturday morning from a phone (today's
  games, a game moved and taken back, a rained-out afternoon), and at a desk the week before (generating, adjusting,
  publishing).
- Give the measured "before" and the drawn "after" (taps, the first screen).
- Say what a club's coaches see (the clash line on their side, unchanged from 6a) and what the club's scheduler
  session will take from these rulings (Ask 8).
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each.
- Offer `/design` for a review pass if the session has budget.
- **Don't write the Stage 3 build prompt until Stage 3 is ruled.** Its definition of done will include:
  - the page split, measured identical;
  - the old-look retirement;
  - every writer's server refusal and the pre-save check (Ask 5);
  - the undo on every move (Ask 4);
  - the demo's tour anchors kept, each with its home named;
  - a note to Club Tier that Stages 10 + 11 can draw against these rulings.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Draw the club's scheduler, Storm Mode or the Big Board.
- Redraw the Venue field or the clash line (Club Stage 6 built them; a change is an ask), the admin frame or
  navigation, or the public pages (the preview only as a door).
- Draw Venues & Facilities, the setup wizard or Event settings (Stage 5).
- Change a price, a plan name or a gate. Write no customer copy: draw the placement and tag it `/marketing`.
- Remove a demo tour anchor without naming its new home.
- Mint a second artifact. The hub is the only one.
