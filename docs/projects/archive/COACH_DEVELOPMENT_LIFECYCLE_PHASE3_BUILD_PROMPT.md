# Kickoff prompt — Development lifecycle: Phase 3 (explain progress)

*(paste into a fresh chat)*

**Build Phase 3 of `COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` — explain progress (mockup screens 5 and
6: the Insights report selector, the player progress chart, the observation and goal timelines as
reports, the practice review's labels, and the handout preview) — and only that.** Everything
before it is **closed and on `dev`**: Phase 0 (`340dca2a` …, walk §172 ✅ 14/14), the Development
grant (`87b94167`) and Phase 1 (`0c3a62ee`, walk §178 ✅ 22/22), and **Phase 2 — record and review
both kinds (`b03721d6` + `11fd1ce1`, 2026-09-13; /simplify + /review run, 8 fixes; ledger §180)**.
Phase 4 is out of scope.

**⚠ Phase 2 was NOT walked.** Its Part D walk was PAUSED by the owner ("I need to re-evaluate this
whole workflow … more wholistically rather than fixing these small items"), and the owner then
ruled the sequencing (2026-09-13): **build Phase 3 first, then re-evaluate the whole lifecycle
with everything in front of them.** So: Phase 3 builds ON Phase 2's records and screens exactly as
committed; it does **not** reshape the scope step, the per-attempt grid, corrections, the review
dialog or the four profile views — that is what the re-evaluation is for. Fix a bug you hit in
them; do not redesign them. Your exit is a walkable Part E *plus* the material the re-evaluation
needs (§5.6 below).

The mockup was approved on 2026-09-11 and every ruling on the hub's Decisions tab stands verbatim.
Do not re-litigate the model. Where this prompt and the mockup disagree, the mockup wins.

---

## 1. Read first, in this order

1. **The binding hub:** https://claude.ai/code/artifact/23bbc89a-f0b5-46e3-b5e5-1b7f9268517c —
   **Mockup tab, screen 5 (Insights) and screen 6 (Handout) are the spec**; screens 1–4 are BUILT
   (compare them to the product when you need the "before"). Every element carries NEW / RESTYLED /
   UNCHANGED and the tag is the scope; hover each tag — the note is the ruling. The Decisions tab
   carries the rulings; the QA Walk tab has Parts A–D — **you add Part E**. Part D stays as
   written and unwalked.
2. **`COACH_DEVELOPMENT_LIFECYCLE_BUILD_PROMPT.md`** (the original Phases 0–3 prompt) §4 Phase 3,
   §6 (rules that bite), §8 (do not); then **`_PHASE1_BUILD_PROMPT.md`** §4 and
   **`_PHASE2_BUILD_PROMPT.md`** §4 — every paid lesson still applies; §4 below adds Phase 2's own.
3. **The plan:** **§8 (reports and visualizations — the table is your feature list and the ten
   chart rules are binding)**, §6 (Insights → Development is a *Report selector*, not a third row of
   tabs), §7 (the recording contracts you READ — never re-derive a headline), §9 (data ownership:
   exports apply the same gates as screens; family previews omit tryout and internal-only
   material; every report needs an explicit denominator), §10 the Phase 3 row (its exit condition
   is your exit), §11 (the test list), F05 / F12 / F13 (the findings this phase closes), §15.3
   (demo, help, closed seasons — what this phase owes each), §16 (the range aim DRAWN: band shaded,
   marks in it filled, dashed average; "moved into the range", never faster).
4. **Ledger §180** (`docs/projects/active/OWNER_QA_LEDGER.md`) — what Phase 2 shipped, its six build
   calls (unruled), and the eight `/review` fixes, so you do not undo them: a 409 on an attempt
   RE-READS the row; Edit keeps an attempt still saving; `headlineMethod` is the one home for the
   "how it was read" half; the profile's reload is sequenced; "not assessed" and a value never
   coexist; a review's evidence ids are proven to be the player's own; the grid never hides an
   attempt the row already holds; a same-value edit is not a correction.
5. **Phase 2's modules, as they are** — Phase 3 READS them; it adds no second reader:
   - **`lib/measurable-series.ts`** — `groupBySession` (ONE row per session, attempts in order,
     `headline` / `average` / `values` / `readBack`), `latestSessionResult`, `headlineLabel`,
     `headlineMethod`, `describeAttempts`, `sessionHeadline`, `attemptAgainstRange`, plus Phase 0's
     `splitSeriesByUnit` / `drawableSegment` / `unitSplitNote` (a mixed-unit series stays split —
     F01). **The chart's line is `groupBySession(...).headline` per session (switchable to
     `average`); every attempt is `values[]` drawn as a quiet mark. Nothing else computes a point.**
   - `lib/development-goal-history.ts` — `goalTimeline(goal, reviews, observations)` and
     `originSentence` — the goal review timeline is THIS, rendered in a report.
   - `lib/development-session-view.ts` — `sessionRows` / `sessionScopeCounts` / `rowState` (the
     Recorded · Not assessed · Not recorded vocabulary a coverage cell may quote).
   - `lib/development-address.ts` — `?section=development&view=goals|results|observations|archive
     &metric=&goal=&return=` and `safeReturnPath` (refuses anything outside the team root and any
     `year=`); `insightsDevelopmentHref(base, {tag})` — you extend it with the report's own
     parameters (below), you do not add a mechanism.
   - The board route `development/board/route.ts` (`?history=1`; `latest` = the HEADLINE of the
     latest session per metric with `attempts` and `inRange`; `latestObservation` for skills;
     `lastRecordedOn`) — Coverage's "Selected metric" column reads THIS, per metric, with that
     metric's own date (F12).
   - The player development GET `roster/[playerId]/development/route.ts` (measurables, goals,
     observations, reviews, authors, `canWrite` / `canWriteGoals`) — the handout and the progress
     chart for ONE player read this, bounded to one player.
   - `app/[orgSlug]/coaches/teams/[teamId]/history/development/panel.tsx` (446 lines — today's
     Coverage table, the count-only finding line, the uncovered-tags section, and Practice review
     with `?tag=` read every render; `sectionState` available · empty · incomplete · failed from
     Phase 0 — F05 — keep it: a failed read is a STATE, never an empty list) and `history/page.tsx`
     (the seven-tab hub, panels stay MOUNTED, `?section=` addressing, `helpAnchor:
     'premium-development'`).
   - `components/coaches/PlayerDevelopmentSection.tsx` — `printSummary()` (~609) builds today's
     PDF from `groupBySession` rows + goals via `lib/export/pdf.ts` and `buildFilename(...,
     'development')`; the "Print summary (PDF)" button (~1256). The handout preview REPLACES this
     door (RESTYLED, screen 6).
   - `components/charts/` — `SeasonTrendChart.tsx` + `CoachChart.module.css` are the portal's
     chart idiom (viewBox 720, aria-label sentence, empty state via `CoachEmptyState`, caption
     hidden under ~420px); `Sparkline.tsx` is the 52×16 cue on the profile row (keep it as a cue).
     Build the progress chart as a sibling there, in the same chrome — not inside the panel.
   - `lib/export/pdf.ts`, `lib/export/catalog.ts` (`check:export-catalog` — a new PDF dataset must
     be registered) and `resolve-pdf-settings.ts` (org letterhead, family-facing labels).
6. **Staff access as committed:** `lib/coach-capabilities.ts` — `canViewMeasurables` (any record
   duty) opens Insights → Development; **goals, observations and reviews read on Internal notes
   (`canViewDevelopmentGoals`)** — a Coverage cell or a timeline that quotes them is gated the
   same way, and so is every line of the handout. Nothing in Phase 3 writes a development record
   except the handout's chosen items if you store them (§3.C).
7. **What a peer is doing to the player page** — `project_coach_roster_player_page_review` /
   session "tournament-website-e8" (2026-09-13): the player page is moving to FIVE tabs
   (Details · This season · Skills & Goals · Notes · Family & paperwork); the Development section
   becomes the "Skills & Goals" tab carrying Phase 2's four-view switch unchanged, and the peer
   MAPS `?section=development&view=` onto it so every deep link keeps working. `ListAgents` first;
   if that rebuild has landed, the handout door and "Open <player>'s development →" go where the
   Development section now lives — through the address module, never a hand-typed path.
8. `memory/design_decisions.md` entries 2026-07-31 (a sixth Insights door, a dedicated report
   page), 2026-09-11, 2026-09-13.

---

## 2. Rulings this build inherits (owner; verbatim on the hub)

- **Supportive, not scoreboard** (inherited): no sort by result anywhere, no cross-season deltas,
  no composite scores, no team average beside a child; a single reading is not a trend. Every
  report and chart is drawn inside that rule.
- **Where analytics live** (2026-07-31): the sixth Insights door, "Development", is the home for
  player-vs-self analytics. **The Report selector builds inside that page** — one labelled
  selector under the seven tabs (Coverage · Player progress · Practice review), **not a third row
  of tabs and not a seventh Insights tab.**
- **A finished season is one page; no year parameter reaches the Insights hub.** Insights is
  live-season scoped. The open call "Is a finished season's development record in scope?" is
  recommended OUT (a fifth shelf needs its own mockup session) — leave it on the Decisions tab,
  do not build a shelf, do not add `year=`. `HISTORY_ENDPOINTS` fails the build if you do.
- **Every attempt is recorded; the headline is chosen per test** (best in the aim's direction ·
  average · last · attempts-in-range). Best/average/spread are arithmetic in the unit, on request,
  **never a rating, never a "consistency score"**. The chart follows the headline per session
  (switchable to average) and draws every attempt as a quiet mark.
- **The range aim, drawn properly** (§16): the band shaded, the marks that landed in it filled,
  the average per session as a dashed line; the headline "2 of 3 in range" or the average, never
  best; the read-back "moved into the range" / "2 mph above the range" — never faster, slower,
  better.
- **Who reads what**: results on any record duty; goals, observations, reviews on Internal notes;
  the handout applies the SAME gates as the screens (plan §9) and keeps the existing PDF's
  boundary — **no tryout material, no peer figures, no internal notes, no automatic delivery, no
  public link**.
- **Attribution**: "entered by" / "written by" already sit on every record; a report that quotes a
  recap or a review shows who wrote it (screen 5: "Written by Coach Jordan").
- **The Context lines left the Development section in Phase 2** (depth chart, innings,
  attendance have their own homes). A report may LINK to them; it never re-quotes them beside a
  child's results.

---

## 3. Build — four checkpoints, in this order, each a tree the owner can OK on its own

### A. The reading model — one module, bounded reads, no new tables

Phase 3 should need **no migration**. Everything a report shows is already recorded (attempts,
headline choice, observations, reviews, session scope, practice recaps). If you find you need one
(e.g. the handout's chosen items, §C), take it to `/dba` first and log a Decisions row; do not
half-build.

- **`lib/development-report.ts` (new, pure, tested first):** the report vocabulary and the
  derivations every surface shares —
  - `progressSeries(readings, def, { show: 'headline' | 'average' })` → the per-session points
    (from `groupBySession`), every attempt as a mark, the unit split honoured (`splitSeriesByUnit`
    — a changed unit is a **separate panel/series with an explicit break**, never an implied
    conversion; an unknown legacy method is labelled neutral: "method not recorded");
  - `statedChange(first, latest, def)` → **words, not a verdict**: "8.40 → 8.05 seconds; 0.35
    seconds lower since 4 Aug" is arithmetic; "faster in this test" only when the method is
    comparable AND lower is the configured aim; a range test says "moved into the range" / "2 mph
    above the range"; two points are a *change*, never a *trend*; one point is one point (no
    fabricated baseline);
  - `compareWindow('season' | 'last-two')` — the two comparison choices on screen 5;
  - `coverageCell(player, metric, latest)` → Recorded on <date> · "No result recorded for this
    test this season" · Not assessed (when a session marked it) — **per metric, that metric's own
    date, never one "last eval" for everything (F12)**; and the explicit denominator sentence:
    "4 of 6 players have a sprint result recorded this season. This describes the records that
    exist. It does not assess the attention a player received.";
  - the axis helper: **actual calendar time on x** (an interval with no assessment is simply
    time), a **narrowed y with labelled ticks and no fill beneath** (chart rule 5), a stable scale
    while the same test/window is compared.
- **Reads stay bounded (plan §10 constraint):** the progress chart reads ONE player's development
  GET; Coverage reads the board route once (it already carries `latest` per metric); never fetch
  every player's full history to draw one chart. Every Insights read carries `sectionState`
  (available · empty · incomplete · failed) — **a capped or failed read publishes no finding**
  (F05).
- **Addressing:** extend `lib/development-address.ts` with the report's state on the hub's
  existing `?section=development` address: `report=coverage|progress|practices`,
  `player=<id>`, `metric=<id>`, `show=headline|average`, `compare=season|last-two`, plus the
  existing `tag=`. Changing the player keeps the report, metric and window (screen 5's note).
  Back/Forward and a fresh link must move the selectors (the panel stays mounted — read the
  address every render, as `?tag=` already does). `safeReturnPath` rules apply to every link out.

### B. Insights → Development (mockup screen 5) — the Report selector

- **One labelled "Report" selector** (Coverage · Player progress · Practice review) under the
  seven tabs, in the toolbar row; on a phone the selectors wrap as labelled full-width controls
  (plan §6). Not tabs. The active choice rides the address.
- **Coverage (RESTYLED):** today's table with the "Selected metric" column — a **Metric**
  dropdown (tests, observed skills and range tests together) changes the column and its date;
  "In a plan" (Practice Plans Phase 3 ruling) and "Returning player" stay; the count-only finding
  line ("2 players don't have a measurable yet this season — one session covers everyone") stays
  UNCHANGED; the uncovered-tags section stays UNCHANGED; roster order, no performance sorting,
  the denominator sentence above the table; "Set goals and record in Skills & Goals →" stays the
  door to act. An observed skill's cell quotes the latest observation's descriptor and date; a
  range test's cell reads "2 of 3 in range · <date>".
- **Player progress (NEW):** **Player** dropdown (roster order — a dropdown like the rest of the
  row, never a "choose player" link), **Metric** dropdown, **Show** (Best attempt · Average of
  attempts — the two the mockup draws; "Last" only if the test's headline is `last`), **Compare**
  (This season · Last two records). Then:
  - the **answer line** in words: "8.05 seconds on 8 Sep · 0.35 seconds lower since 4 Aug" and
    the scope line "4 recorded results · same course and timing method · lower is the aim";
  - the **chart** (`components/charts/DevelopmentProgressChart.tsx`, CoachChart chrome): actual
    dates, the line on the headline (or average) per session, every attempt a quiet grey mark at
    its own value, visible point markers, a narrowed labelled axis with no fill, the unit on the
    axis, an optional coach target line only when the goal carries one (never automatic), the
    aria-label sentence; **a range test shades the band, fills the in-band marks and dashes the
    average**; a unit change is a break with a note; one reading is a single point with no line;
  - **"Records behind the chart"** — the table beneath (every session row with every attempt,
    best, average; the `readBack`), always available without hover; **the chart, the answer line
    and the table come from ONE series object** (chart rule 8);
  - the caption "A change in this test does not explain why it happened." and **"Open
    <player>'s development →"** carrying `return`;
  - **an observed skill selected as the metric shows the observation timeline** (dated entries,
    descriptor, what was seen, setting, written by) — **no line joins descriptors, ever**; a goal
    review timeline shows when the player has a goal linked to the selected skill (reuse
    `goalTimeline`) — evidence links open their records.
- **Practice review (RESTYLED):** today's list with its tag chips, labelled by what the records
  support — **Upcoming plan · Past plan · no recap · Recap recorded** (Phase 0 built the truth
  labels; verify they render here as screen 5 draws them, with "Written by" on a recap and
  "Open plan and recap →"); the disclaimer "A topic appearing in a plan does not prove that a
  specific player worked on or achieved a goal." stays.
- Empty and failed states per report: `CoachEmptyState` for "no results for this metric yet"
  with the door to record; the failed state says the read failed (F05), never "nothing here".
- Every player link out of a report carries `?return=` back to the report WITH its state.

### C. The handout preview (mockup screen 6) — "A conversation with the player"

- **"Preview development handout" replaces "Print summary (PDF)"** on the player's Development
  section (RESTYLED — the marketing-shot harness does not wait on this label; check anyway). It
  opens a **preview page** (`roster/[playerId]/development/handout`, addressable, with the back
  arrow following `return`) — not a modal; it paginates.
- The coach **chooses what belongs in this conversation**: the goals to include ("What we're
  working on" — focus + the goal's own success sentence), **a recent observation** (one or more,
  dated, descriptor + what was seen), **selected test results** (the headline per session with
  the attempts behind it in the line beneath — "Best of three attempts that day (8.12 · 8.05 ·
  8.20). Standing start on the same marked course." — and the method quoted from the definition),
  a **coach-written "Next step"** (free text, with the next review date from the goal when set),
  and the toggle **"Include the full dated result log"** (appendix: one line per session —
  "8 Sep · best 8.05 of 3 (8.12 · 8.05 · 8.20)"). **Numbers and dates on the first page; the log
  is an appendix; long content paginates, never shrinks** (F13).
- Letterhead and family-facing labels from `resolve-pdf-settings`; "Prepared <date> · <coach>";
  footer "For this player's development conversation · A record of this season's coaching".
- **Boundary (plan §9, F13, unchanged from today's PDF):** current season only; no tryout
  evaluation, no peer figures, no internal notes, no ranking language; the observation and goal
  lines are gated on Internal notes exactly as the screen is (a coach without notes sees results
  only and the handout says nothing about goals); no automatic delivery, no public link — **Print
  / Save as PDF** via `lib/export/pdf.ts`, dataset registered in the export catalog.
- **Build call to carry at its recommendation (log a Decisions row):** the chosen items and the
  "Next step" text are **not stored** — the handout is a print of the record as of today, prepared
  fresh each time; storing a "handout version" is Phase 4's review-pack territory. If the owner
  wants the next step kept, that is a goal review (Phase 2's record) — offer "Save this next step
  as a review" as a link, not a second store.
- The old one-tap PDF goes; today's `printSummary()` becomes the preview's print path (one PDF
  builder, not two).

### D. The shop window, help and guards

- **Demo (plan §15.3):** the coach demo's mid-season team is goals-only and its Coverage must read
  honestly with no results (it did after Phase 2 — keep it); the off-season team's showcase player
  has three sprints on each testing day and a range-free library — **check whether the progress
  chart has a moment worth a tour beat** (the tour has no Insights → Development beat today;
  `data-sandbox-tour="playing-time"` is the Insights beat). Add one only if `/marketing` agrees
  the sentence; otherwise leave the tour alone and say so. `npm run check:demos` on dev; the prod
  re-seed is OWED from Phase 1 and carries Phase 2's moments — say so, do not run it.
- **Marketing shots:** `lib/marketing-shots.ts` `coach-development` waits on "Record a result" on
  the profile — the door you are changing sits on the same screen; `npm run check:marketing-shots`
  must pass and the shot is re-taken if the section's chrome moved. A new shot of the progress
  chart only if `/marketing` asks for it.
- **Help (`/docs`):** the Report selector and its three reports; how to read the chart (dates,
  headline vs average, the attempt marks, the range band, "change" not "trend"); the handout
  preview and its boundary; who can read what. `helpAnchor: 'premium-development'` on the hub's
  Development tab — keep the anchor id. Every old term stays a keyword ("Print summary", "player
  summary PDF", "coverage").
- **Guards:** `coach-page-actions-guard.test.ts` (the handout preview page's header actions),
  `coach-read-gates-guard.test.ts` (a report that quotes goals/observations is gated on notes;
  `CoachNotGranted` where a hidden door lands), `coach-history-endpoint-guard.test.ts`
  (`HISTORY_ENDPOINTS` — no year, anywhere), `check:export-catalog` (the handout dataset),
  `scripts/layout-screens.mjs` (`coach-history-development` with `report=progress&player=&metric=`
  for a test, a range test and a skill; the handout preview page; 361/390/768/1440),
  `check:layout --only=` on each; `check:text-contrast` on the chart's marks and the band.
- **The UAT fixture** (`scripts/seed-uat-coach-fixture.mjs` §16) already carries: the sprint
  DEFINED (two attempts), Throw speed LEGACY, Shuttle run retired, Changeup speed RANGE 62–68 (no
  readings), "Sets feet before throwing" SKILL, the scoped "Phase 2 probe" session, three
  attempts for one player, one observation, one goal with a review, Devon Test's unit change.
  Extend it with **readings on the range test** (so the band draws) and a recap on a past
  practice; `scripts/uat-fixture-context.mjs` exposes the ids the screens need. **A green sweep
  over an empty report proves nothing** — populate, then sweep.

**Exit (plan §10):** every conclusion opens its source; chart, table and summary agree because
they are one object; a coach can explain the report in their own words; a capped or failed read
publishes no finding; the handout keeps the PDF's boundary and paginates; nothing anywhere ranks,
scores, projects or compares a child to the team.

---

## 4. ⚠ Verify before building — every earlier lesson, plus Phase 2's own

- **Seven peer sessions worked in this tree on 2026-09-13.** `ListAgents` first. Never `git add
  -A`. **Build every commit in a PRIVATE index**; for a file a peer also holds edits in, derive
  HEAD + your hunks with a script and PROVE the split (rebuilt-vs-HEAD shows only your hunks;
  rebuilt-vs-working shows only theirs). The usual shared files: TODO.md, OWNER_QA_LEDGER.md,
  lib/help-content/coaches.tsx, coaches.module.css, lib/db.ts, lib/types.ts, lib/demo-coach.ts,
  scripts/seed-demo-coach.mjs, lib/marketing-shots.ts, lib/sandbox-chrome.ts, lib/export/catalog.ts,
  scripts/layout-screens.mjs and **scripts/.layout-baseline.json** (commit ONLY your screens'
  entries).
- **Stage the commit OBJECT first (`git commit-tree`), check `git log <parent>..HEAD` is empty,
  then the compare-and-swap `git update-ref refs/heads/dev <commit> <parent>`, then `git reset -q
  -- <every path you committed>`** (the shared index otherwise shows your files as staged
  deletions / double-modified to everyone) — and TELL the peers which shared files moved.
- **Verify each commit's tree ALONE before moving the ref:** `git archive <tree> | tar -x` into
  the scratchpad, a node_modules JUNCTION (`cmd /c mklink /J`), copy `.env.local`, `npx next
  typegen` then `npx tsc --noEmit`, `npm test`, the static gates. ⚠ Remove the junction with
  `cmd /c rmdir` BEFORE deleting the folder. ⚠ `git archive` honours `core.autocrlf=true`, so the
  extracted tree is CRLF: a peer's source-guard test that splits on bare `\n` and looks for a
  line that is exactly `}` (bva-no-dates-guard ×6) goes red THERE and green in the working tree —
  compare against the parent, never assume. `check:root` and `check:register` cannot run outside
  a git checkout / without the UAT auth state; run those in the working tree.
- ⚠ **`DATA_DICTIONARY.md` is `-text` to git** (binary-detected: one very long line) — git never
  normalises it. A CRLF rewrite of the working copy made every one of its 7,858 lines a diff
  in Phase 2; normalise to LF (a node script) before staging, and check `git diff --stat` reads
  as your hunks, not the whole file.
- ⚠ **Bash heredocs (`cat <<'EOF'`) STILL eat one level of backslash** — `\\(` arrived as `\(`
  inside a template literal and the regex lost its escape. `node -e` mangles backticks. **Write
  every edit script to the scratchpad with the Write tool as a `.cjs`, use `String.raw`, and
  anchor on the file's own EOL** (an EOL-aware `edit()` helper is in every Phase 2 script).
- **The source guards accept the shared resolver as the proof of a gate**
  (`development-grant.test.ts`, `development-trust.test.ts`: a per-player route proves itself
  either inline or by calling `resolveDevelopmentPlayerContext(…, 'results'|'goals')`, and the
  resolver file is itself asserted). A new per-player WRITE route must be added to
  `DEVELOPMENT_WRITE_ROUTES` (and `GOAL_WRITE_ROUTES` if it touches a coach's judgement). Phase 3
  should add none — if the handout stores something, that is the moment to reconsider §3.C.
- **Dialogs stand on `components/coaches/QuestionShell`** (overlay, floor, header, Escape, focus
  restore, busy-gated close) — Phase 2's four were moved onto it by `/simplify`; do not hand-roll
  a fifth. The report page's selectors are form controls, not dialogs.
- **A 409 from a write means READ AGAIN, never re-send** (Phase 2's Critical /review finding) —
  the same rule for any optimistic control you add.
- **The headline and its method have ONE home each** (`headlineLabel` / `headlineMethod`) — the
  range-test row read "2 of 3 in range · 2 of 3 in range" when two surfaces glued the same
  sentence twice. The chart's answer line and the handout's result line read those, not
  `readBack.split(...)`.
- **A reload that can race must be sequenced** (`loadSeqRef` — the session screen and the
  profile section both do it); the report panel changing player/metric quickly is the same shape.
- Bracket directories need `:(literal)` pathspecs. Several files are CRLF and some MIXED. `git rm
  --cached` on the shared index stages a deletion for EVERYONE. `npx next typegen` before typecheck
  after adding routes. The demo seeder needs `node --env-file=.env.local`. The layout sweep needs
  `--only=<ids>` with the EQUALS.
- **Migration numbers: the tail on 2026-09-13 was 296** (a peer's) — `ls supabase/migrations |
  tail`, and you should not need one. **Ledger: §181 is taken** (a peer's, working tree) — take
  the next free number, checking the working tree AND HEAD; never renumber.
- **Dev server:** shared; `npm run dev` only; restart (stop → `rm -rf .next` → start) only after
  new files / shared modules, and message the peers first.
- **`npm run verify:changed` once BEFORE you change anything** and note what is already red
  (schema parity is red on the dev-only migrations 288–296; that is not yours).

---

## 5. Funnel, gates and hand-off — per checkpoint

1. **Present the PM-facing UX summary before any code** (AGENCY_RULES) — what the coach sees and
   does differently at each checkpoint.
2. Unit tests first for every rule in `lib/development-report.ts` (the stated change in words for
   lower / higher / range / record-only / mixed-unit / one point / two points; the coverage cell per
   metric; the compare window; the axis helper), then the change, then `npm run typecheck`, `npm
   run lint:focused`, the `verify:changed` gates individually, `check:layout --only=` on every
   touched screen at 361/390/768/1440, `check:demos`, `check:marketing-shots`,
   `check:export-catalog`, `check:text-contrast`. Cold-restart the dev server before the browser
   hand-off; login 200; EACCES 0.
3. **Owner browser pass** (hub → QA Walk → **Part E**, new; pin identities not figures; one option
   per ruling step; leave the fixture as you found it), then `/simplify` (one series object; one
   reading module; no second headline; the chart in the charts folder), then `/review` (standard →
   high-risk if any route or gate changes: the notes gate on every quoted goal/observation/review
   line, the handout's boundary, bounded reads, `return` safety, the failed-read state), then
   `/docs`.
4. **Commit only on the owner's OK**, private index, one checkpoint per commit if the owner wants
   it that way (ask), `git show --stat HEAD` to confirm the file set. Never `master`.
5. **Hub bookkeeping in the same commit:** stage strip (Build → the anchored fact), Decisions rows
   for any mid-build call (the handout's "not stored" call at least), **QA Walk tab: add Part E**
   (`QA_PARTS`; A–D stay, D unwalked), re-embed the two `.md` files if they changed, republish with
   the Artifact tool **passing the hub URL as `url`** (read the live version first — it is
   byte-identical to the committed HTML plus the publish wrapper). Ledger next §; TODO line;
   memory `project_coach_development_lifecycle` — anchored facts, never "uncommitted".
6. **Then prepare the holistic re-evaluation the owner asked for (2026-09-13), as the closing
   deliverable of this chat:** ONE artifact (its own URL, linked from the hub) that walks the whole
   lifecycle end to end as the head coach would — define → start a session with a scope → record
   attempts, corrections, not-assessed, an observation → review the session → the player's four
   views → review a goal → the three reports → the handout — screen by screen with the real
   product (fixture identities), every screen paired with the question the owner should be asking
   of it and the build calls that sit under it (Phase 2's six unruled calls, Phase 3's). Not a
   checklist of defects; a reading of the workflow. The owner rules on the SHAPE first; item
   rulings (Part D, Part E) follow the shape. Do not fix Phase 2 items on the way past.
7. Hand-off in the owner's voice: what changed on screen, what is prod-owed (migrations 292–296
   already pending, order-critical; plus the prod coach-demo re-seed), the Part E walk link and
   the re-evaluation artifact link.

---

## 6. Do not

- Do not build Phase 4: the coverage matrix (roster × session grid), same-player small multiples,
  team-authored reusable definitions, structured import, selective carry, durable drafts, a stored
  review pack, or delegated recording beyond the grant.
- Do not add a development shelf to the season-end page, a year parameter anywhere, a seventh
  Insights tab, or a third row of tabs under the seven.
- Do not rank, sort by result, show a team average or a peer figure beside a child, draw a
  percentile, an "on track", a projected date, a progress percentage, a consistency score, a
  radar profile, a leaderboard, a goal-completion percentage, an attendance-vs-improvement
  scatter, or an AI narrative of a player's weaknesses (plan §8 — "options I would not
  prioritize" is a ruling here).
- Do not join descriptors with a line, average them, or score a skill; do not plot readings by
  index, autoscale miniatures independently, fill under a truncated axis, or smooth through a
  missing assessment; do not imply a conversion across a unit change.
- Do not reshape Phase 2's scope step, grid, corrections, review dialog or four views — the
  holistic re-evaluation follows this phase by the owner's sequencing; fix a bug, do not redesign.
- Do not send, publish or link the handout anywhere; do not include tryout material, internal
  notes or peer figures in it; do not store a "handout version" without a ruling.
- Do not touch `canWritePracticePlans`, the drill/template rooms, the practice planner, the tryout
  scorecard, the Insights hub's seven tabs, the profile's tabs (the peer's rebuild owns them), the
  sidebar's "Skills & Goals" or the report's "Development".
- Do not reopen the read-only door, the successor rule, the range aim, the four-views ruling or
  the "not stored" scope (all ruled or recommended on the Decisions tab).
