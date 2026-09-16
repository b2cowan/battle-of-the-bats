# Kickoff prompt — Development lifecycle: Phase 2 (record and review both kinds of development)

*(paste into a fresh chat)*

**Build Phase 2 of `COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` — record and review both kinds of
development (mockup screens 3 and 4) — and only that.** Everything before it is **closed and on
`dev`**: Phase 0 (`340dca2a` + `ea2de010` + `6f3422ea` + `b5f37207`, walk §172 ✅ 14/14), the
Development grant (`87b94167`) and Phase 1 — find and define (`0c3a62ee`), walked together as
**§178 ✅ 22/22 on 2026-09-13** with five rulings (below). Phase 3 (Insights reports, the handout) is
a later chat. Phase 4 is out of scope.

The mockup was approved on 2026-09-11 and every ruling on the hub's Decisions tab stands verbatim.
Do not re-litigate the model. Where this prompt and the mockup disagree, the mockup wins.

---

## 1. Read first, in this order

1. **The binding hub:** https://claude.ai/code/artifact/23bbc89a-f0b5-46e3-b5e5-1b7f9268517c —
   **Mockup tab, screen 3 (Record) and screen 4 (Player & goals) are the spec**; screens 1 and 2
   are BUILT (compare them to the product, not to the mockup, when you need the "before"). Every
   element carries NEW / RESTYLED / UNCHANGED and the tag is the scope. The Decisions tab carries
   the rulings; the QA Walk tab has Parts A–C — **you add Part D**.
2. **`COACH_DEVELOPMENT_LIFECYCLE_BUILD_PROMPT.md`** (the original Phases 0–3 prompt) §4 Phase 2,
   §5 (data), §6 (rules that bite), §8 (do not); then **`_PHASE1_BUILD_PROMPT.md`** §4 (the paid
   lessons — every one still applies; §4 below adds Phase 1's own).
3. **The plan:** §7 (the recording contracts — Result, Observation, Goal, Goal review, Session
   scope; **every attempt is its own record; best, average and spread are computed, never
   stored**), §8 chart rules 9–10 (Phase 2 shows read-backs in ROWS, not charts — but the rows must
   say what the chart will later say), §9 (corrections and provenance; who writes), §10 the Phase 2
   row (its exit condition is your exit), §11 (the test list), §15.3 (demo, help, closed seasons —
   what this phase owes each), §16 (attempts · the grant · the range aim, ruled).
4. **Ledger §178** (`docs/projects/active/OWNER_QA_LEDGER.md`) — what Phase 1 shipped and the
   sixteen `/review` fixes, so you do not undo them. The ones you will touch: the successor step is
   a definer FUNCTION (`replace_rep_team_measurable_type`, mig 294 — service_role only); erasing a
   written method forks, writing one onto a legacy test keeps the series; the Insights tag filter
   reads `?tag=` every render; the profile page parses the arrival address ONCE and the section
   flashes the row then calls `onArrived`; `startSession` locks with a `finally`; a range
   definition without edges reads "set From and To" rather than lying.
5. **Phase 1's modules, as they are** — read before designing, because Phase 2 extends them rather
   than adding parallel ones: `lib/measurable-definition.ts` (kind · aim · headline vocabulary,
   `isMeasuredTest`, `headlineOptionsFor`, `definitionChange`), **`lib/measurable-series.ts` —
   `sessionHeadline` / `describeHeadline` / `attemptAgainstRange` are THE ONE HOME for the headline;
   the session grid, the Results rows, the Players tab and (later) the chart and handout all read
   them; never re-derive**; `lib/development-input.ts` (the readers — extend, do not re-type
   validation in routes); `lib/development-address.ts` (`?section=development&view=&metric=&goal=
   &return=` — `view` accepts `goals|results` today; you add `observations|archive`); `lib/
   development-session-view.ts` (Phase 0's `sessionRows` / `sessionEnteredCount` — they count
   PLAYERS, not rows; keep them counting players when a player has three rows); the session page
   `development/sessions/[sessionId]/page.tsx` and its route; `components/coaches/
   PlayerDevelopmentSection.tsx` (~1,030 lines — Goals, Measurables, Previous seasons, Context, the
   tryout snapshot and the continuity banner all live here); `MetricDefinitionEditor.tsx` (the
   preview already renders `describeHeadline` for a sample session — your grid must agree with it).
6. **Staff access as committed:** `lib/coach-capabilities.ts` — `canWriteDevelopment` (the grant),
   `canWriteDevelopmentGoals` (grant AND notes), `canViewDevelopmentGoals` (notes), `canViewMeasurables`
   (any record duty), `development` is the eighth record duty. Observations and goal reviews are a
   coach's written judgement about a child: **read on notes, write on the grant AND notes** — the
   goals predicate, reused, not a new one.
7. `memory/design_decisions.md` entries 2026-07-17, 2026-07-31, 2026-08-26 (three tabs, not nine
   drawers), 2026-09-11, 2026-09-13.

---

## 2. Rulings this build inherits (owner; verbatim on the hub)

- **Every attempt is recorded** (2026-09-11). A test says how many attempts a session takes
  (1–5, `attemptsPerSession`) and which one leads (`headline`: best in the aim's direction ·
  average · last · attempts-in-range for a range test). Best/average/spread are arithmetic in the
  unit, shown on request, **never a rating, never a "consistency score"**.
- **The range aim, drawn properly**: each attempt reads "in", "+2" or "−3" against From–To; the
  headline is attempts in range or the average — never best; the read-back says "moved into the
  range", never faster or slower.
- **One Development grant covers every write**; goals, observations and reviews also need Internal
  notes (ruled as built, §178). **Every record names who wrote it** — "entered by" on a reading,
  "written by" on a goal, observation and review. `created_by` is already stored everywhere; Phase 2
  puts it on the screen.
- **A coach without the grant still opens Skills & Goals and a session, read-only, and no
  read-only line is added** (owner, 2026-09-13). Do not reopen it.
- **Open calls carried at their recommendation into this build** (Decisions tab, "Open"): a goal
  review requires a **status, never prose** (F19); **"Not assessed" is a link on blank rows only**,
  not a control on every row; **the four views live INSIDE the Development section on "This season"
  as one segmented control** — the profile's three tabs are untouched (F14); the demo tour's "Find
  the two blanks" beat is **re-narrated in this unit of work**.
- **"Record a result" replaces "Log a measurable"** on the profile — WITH the marketing-shot
  harness change in the same commit (F20: `lib/marketing-shots.ts` ~466 `readyAfterPrepare` waits
  on the old label; `npm run check:marketing-shots` must pass, and the coach-development shot is
  re-taken because the button changed).

---

## 3. Build — four checkpoints, in this order, each a tree the owner can OK on its own

### A. The records (one migration, `/dba` before it touches dev)

Decide columns from `schema-dump-columns-dev.json`, never from migration prose. Today:
`rep_player_measurables` (id, org_id, team_id, player_id, measurable_type_id, value, unit,
recorded_on, note, created_by, session_id; unique index `rep_player_measurables_session_entry_uniq`
= one reading per player per type per session); `rep_team_evaluation_sessions` (session_date, note,
event_id, program_year_id, created_by); `rep_player_development_goals` (focus_area, note, status
`working|achieved|parked`, tag_id, created_by).

- **Attempts:** `attempt_no` on `rep_player_measurables` (1..attemptsPerSession, default 1 so every
  existing row is attempt 1); the unique index becomes per (session, player, type, attempt). Single
  readings ("Record a result", `session_id` null) stay one row. **Legacy rows are attempt 1 of 1 —
  nothing is backfilled.**
- **Session scope:** what the session was FOR — intended metric ids and intended participant ids
  (+ a review state). A session with no saved scope (every existing one) claims only what was
  recorded: "N of M entered" against the active roster, as Phase 0 made it. A scoped session
  counts against its scope: "4 recorded · 1 not assessed · 1 not recorded — of 6 in scope".
  "Not assessed" is a per-player, per-metric state with a neutral reason, never a value.
- **Observations:** a new table — player, skill definition (kind `skill` only — a CHECK or a
  trigger, not just a route rule), observed_on, author, what was seen (text), optional descriptor
  (one of the definition's, or free text — decide with `/dba`), optional goal, optional
  session/event. Read on notes, write on the grant AND notes; **RLS copies mig 292's predicate**.
  "Not observed" is an evidence state, never a rung.
- **Goal reviews:** a new append-only table — goal, reviewed_on, author, status chosen, note
  (optional), next review date (optional), evidence references (result / observation ids,
  optional). A review NEVER overwrites the previous one; the goal's `status` is the LATEST review's
  status (write both in one step). Goals gain `success` (what success looks like) and `review_on`.
  `updated_at` is never read as "last reviewed" (F08).
- **Corrections (plan §9):** editing a saved reading keeps the original value in the record and
  never shows two active readings. The smallest honest shape: a `corrected_from` value + timestamp
  on the row. If `/dba` wants a history table, defer it with a Decisions row rather than half-build.
- Dictionary + `npm run refresh:snapshots` + `MANUAL_PROD_STEPS.json` for anything the drift gates
  cannot see (a policy, a function, a trigger, a data step) in the same commit. Migration numbers:
  **the tail on 2026-09-13 was 294** — `ls supabase/migrations | tail` and tell the peers which
  numbers you take. Never apply to prod; say in the hand-off which are order-critical.

### B. Record (mockup screen 3) — the session

- **"+ Start session" asks for the scope first** (date, "Taken at", which metrics — tests AND
  skills — and who is here, everyone active pre-ticked); it creates the session with its scope and
  opens the grid. **Keep** Date, "Taken at" and the note exactly as they are (UNCHANGED tags; the
  re-stamp rule and the event pre-fill are Phase 0/Practice Plans rulings).
- **One field per attempt**, as many as the definition says; Enter moves to the next attempt, then
  the next player; a blank attempt was not run — never a zero. The headline updates as attempts are
  typed (`sessionHeadline`); a range test shows each attempt against the band and "k of N in range".
- **Per-row states:** Saved · Saving · Not saved — retry · Not recorded · Not assessed, with Edit
  and Retry on the row; a failed value survives on screen; errors stay beside the row; "Mark not
  assessed" appears on blank rows only. **Entered by** on every saved row.
- **A skill chip records an observation** (descriptor + what was seen, dated by the session): a
  recorder without Internal notes sees the chip held back with the reason; the head coach and a
  notes-holding grant-holder record.
- **"Review session →"** counts what was recorded against the scope, never invents a zero, never
  marks the session complete; offers "Back to Sessions". Legacy sessions review against the roster.
- Retired tests and departed players keep Phase 0's read-only rows; a scope can never re-admit
  them.

### C. Player & goals (mockup screen 4) — inside the Development section

- **Four views on `?view=goals|results|observations|archive`** as one segmented control inside the
  section (the address module and the flash-on-arrival already exist — extend them). The
  continuity banner and the carry-forward offer sit ABOVE the views; the tryout snapshot sits at
  the top of Goals; **the Context lines (depth chart, innings, attendance) leave the section** —
  they are quoted from other homes, never owned here.
- **Goals:** a list with statuses and origin (set with the player · carried from last season ·
  seeded from the tryout); **+ Add goal** = focus + note, with success · review on · focus tag under
  "More"; the selected goal's **review timeline** (set → observed → reviewed, dated, author, never
  overwritten); **Review goal** (status required; note, next review, evidence optional); Edit
  wording. **Written by** on the goal and each review.
- **Results:** rows lead with the headline and list every attempt per session with best and
  average; a range test's row reads "2 of 3 in range · avg"; a retired test's readings stay listed;
  a mixed-unit series stays split (F01). **"Record a result"** (was "Log a measurable") — the
  single dated reading, no session, feeds the same rows.
- **Observations:** a timeline per skill (descriptor, what was seen, setting, author; "Evidence
  for: <goal>" when linked); **Record an observation** from here and from a goal. Notes-gated read.
- **Previous seasons:** the existing scrapbook, unchanged, as a view.
- The PDF ("Print summary") is Phase 3's handout — leave its shape, but it must not read three
  attempts as three sessions: one row per session with the headline and the attempts listed.

### D. Every count is per player — and the shop window

- **Every place that counts readings as players is re-derived per player** before attempts ship
  (plan §7 ⚠; fundraising's 2026-09-10 lesson): the session's "N of M" (`sessionEnteredCount` —
  keep), the Players tab's latest-per-type (the HEADLINE of the latest session, not the last row),
  Insights → Development's "last measurable" and count-only finding, the PDF's rows, the demo
  check's `tested` (distinct `player_id` already — keep), the export shape.
- **Demo (plan §15.3):** seed the showcase player with **three sprints on each testing day** and
  the world with **one observed skill and one goal review**; the mid-season team stays goals-only
  and its Players tab / Coverage must read honestly with no results. Re-narrate the tour beat
  `lib/sandbox-chrome.ts` ~519 ("Find the two blanks": rows now read Not recorded / Not assessed, a
  session has a scope, and the attempts are worth a clause); keep `data-sandbox-tour="development-
  sessions"` alive; `scripts/check-demo-coach.mjs` ~450 counts distinct players (keep) and must
  gain an attempts assertion and a headline-based "got faster". `npm run check:demos` on dev; the
  prod re-seed is OWED from Phase 1 already — say so, do not run it.
- **Help (`/docs`):** Record a result, Record an observation, attempts and the headline, Not
  assessed, goal reviews, the four views, who can do what (observations and reviews ride notes +
  the grant); every old term stays a keyword ("log a measurable", "focus area", "team board").
- **Guards:** `coach-page-actions-guard.test.ts` (any new header action — the scope dialog's
  opener is the existing Start session action), `coach-read-gates-guard.test.ts`, `layout-
  screens.mjs` (the observations view via `?view=`; the scope dialog is a modal on the hub),
  `check:marketing-shots`, `check:demos`, `HISTORY_ENDPOINTS` (no year anywhere).
- **The layout baseline's DEFERRED rows for the session grid's remove button and the profile's
  measurable row were deferred TO THIS PHASE** (`scripts/.layout-baseline.json`, reason "TOUCH DEBT
  ON CONTROLS THAT PRE-DATE THE DEVELOPMENT LIFECYCLE BUILD") — rebuilding those rows clears them;
  do not carry them forward with a new reason.

**Exit (plan §10):** a session and a player's own entry feed the same records; a goal keeps its
dated evidence and chosen status; partial saves and retries work and a failed value never
disappears; a recorder with and without notes / with and without the grant gets exactly the
screens ruled; the demo check and the marketing-shot check are green with the NEW story, not the
old one; three sprints never read as three players anywhere.

---

## 4. ⚠ Verify before building — every Phase 1 lesson, plus Phase 1's own

- **Six peer sessions work in this tree** (2026-09-13). `ListAgents` first. Never `git add -A`.
  **Build every commit in a PRIVATE index**; for a file a peer also holds edits in, derive HEAD +
  your hunks with a script. The usual shared files now: TODO.md, OWNER_QA_LEDGER.md,
  lib/help-content/coaches.tsx, coaches.module.css, lib/db.ts, lib/types.ts, lib/demo-coach.ts,
  scripts/seed-demo-coach.mjs, components/coaches/CoachPageHeader.tsx, DATA_DICTIONARY.md,
  MANUAL_PROD_STEPS.json, the schema snapshots, memory/reference_db_schema.md and **scripts/
  .layout-baseline.json** (commit ONLY your screens' entries — merge HEAD's entries with yours by
  screen id; a peer's uncommitted refinements are theirs).
- ⚠ **HEAD can move BETWEEN your HEAD-based reconstruction and your staging** (it did, twice, on
  2026-09-13). Stage the commit OBJECT first (`git commit-tree`, ref untouched), then `git log
  <staged-parent>..HEAD` — if it is non-empty, rebuild the shared files from the new HEAD before the
  compare-and-swap `git update-ref refs/heads/dev <commit> <expected-parent>`. Then `git reset -q --
  <your paths>` so the shared index reads HEAD, and TELL the peers which shared files moved.
- **Verify each commit's tree ALONE before moving the ref:** `git worktree add --detach <scratch>/wt
  <commit>`, a node_modules JUNCTION (`New-Item -ItemType Junction`), copy `.env.local`, `npx next
  typegen` then `npx tsc --noEmit`, `npm test`, the static gates. ⚠ Remove the junction with `cmd /c
  rmdir` (link only) BEFORE `git worktree remove` — `rm -rf` would follow it into the real
  node_modules. As of 2026-09-13 eight unit tests are red AT HEAD and are peers' (bva-no-dates-guard
  ×6, marketing-campaign-registry ×2); compare against the parent, never assume.
- Bracket directories need `:(literal)` pathspecs. Several files are CRLF and some are MIXED — an
  edit script must try the file's dominant EOL, then LF, then CRLF. **Write every edit script to the
  scratchpad with the Write tool as a `.cjs`** — Bash heredocs and `node -e` mangle `\b`, `$`,
  backticks and backslashes. ⚠ In a JS replacement string `$'` means "the text after the match" —
  use a function replacer. ⚠ Two edit specs anchored on the SAME line (e.g. "the line after gotcha
  5") land in the wrong order when applied one after the other — anchor on the line you insert
  AFTER, and re-read the result.
- `git rm --cached` on the shared index stages a deletion for EVERYONE — express a delete in the
  private index only.
- **Guards that will bite:** the page-actions guard derives a COMPONENT header's help host from the
  pages that import it (all must agree); the read-gates guard wants `CoachNotGranted` on the page a
  hidden nav door lands on; `check-manual-prod-migrations` now sees `create/drop/alter policy`
  (register functions, triggers and data steps yourself); `.layout-baseline.json --init --only=`
  keeps out-of-scope entries — write reasons ONLY on new keys; a row link in a card-reflowed cell
  is `display:inline-block` with VERTICAL padding only (a sideways negative margin overflows at
  361px); a new component's 44px floor lives in its OWN module; `npx next typegen` before
  typecheck after adding routes; the demo seeder needs `node --env-file=.env.local`.
- Probes (`tests/uat/scenarios/`): the back arrow by `getByRole('link', { name: 'Back to …' })`
  (the sidebar has a link with the same text); hard-DELETE probe rows in `afterAll` (a retired probe
  definition pollutes the walk); `innerText` applies `text-transform` — lower-case both sides; a
  cold server can time out the auth setup — re-run before reading it as a failure.
- **The UAT fixture (`scripts/seed-uat-coach-fixture.mjs` §16)** carries: 60-yd sprint DEFINED
  (lower · two attempts · method), Throw speed LEGACY on purpose (record only, no method), Shuttle
  run retired with rows, Changeup speed RANGE 62–68 mph (no readings), "Sets feet before throwing"
  SKILL with three descriptors, Devon Test's readings incl. a unit change, "Morgan Left" departed,
  "Avery Prior" prior-season, personas `uat-asst-development` (grant + notes) and `uat-asst-nomoney`.
  Extend it: a scoped session with a Not-assessed row and a failed-save-shaped row if you can seed
  one, three attempts for one player, one observation, one goal with a review. `scripts/uat-
  fixture-context.mjs` exposes `measurableTypeId`; add what the new screens need. **A green
  `check:layout` over an empty fixture proves nothing** — populate, then sweep with `--only=<ids>`.
- **Dev server:** shared; `npm run dev` only; restart (stop → `rm -rf .next` → start) only after new
  files / shared modules, and message the peers first. If every route 500s, read `.next/dev/logs/
  next-development.log` before touching `.next`.
- **`npm run verify:changed` once BEFORE you change anything** and note what is already red.

---

## 5. Funnel, gates and hand-off — per checkpoint

1. **Present the PM-facing UX summary before any code** (AGENCY_RULES) — what the coach sees and
   does differently at each checkpoint; the hub's brief covers the why.
2. Unit tests first for every rule (the attempt reader, scope counting, the review append, the
   observation gate, the per-player counts), then the change, then `npm run typecheck`, `npm run
   lint:focused`, the `verify:changed` gates individually, `check:layout --only=` on every touched
   screen at 361/390/768/1440, `check:demos`, `check:marketing-shots`, `check:dictionary`,
   `check:snapshots`. Cold-restart the dev server before the browser hand-off; login 200; EACCES 0.
3. **Owner browser pass** (hub → QA Walk → **Part D**, new; pin identities not figures; one option
   per ruling step; leave the fixture as you found it), then `/simplify` (the headline has ONE home;
   the per-row state machine has ONE home; no second attempt reader), then `/review` (high-risk:
   the new RLS, the append-only review, the scope counts, the attempt uniqueness, the correction
   record, the notes gate on observations reached through a session), then `/docs`.
4. **Commit only on the owner's OK**, private index, one checkpoint per commit if the owner wants
   it that way (ask), `git show --stat HEAD` to confirm the file set. Never `master`.
5. **Hub bookkeeping in the same commit:** stage strip (Build → the anchored fact), Decisions rows
   for any mid-build call, **QA Walk tab: add Part D** (`QA_PARTS`; A–C stay), re-embed the two
   `.md` files if they changed, republish with the Artifact tool **passing the hub URL as `url`**
   (read the live version first). Ledger: next § — **a peer claimed §179 in the working tree on 2026-09-13**; take the
   next free number, checking the working tree AND HEAD; never renumber. TODO line, memory file `project_coach_development_lifecycle` — anchored facts, never
   "uncommitted"; keep the MEMORY.md index line under ~200 characters.
6. Hand-off in the owner's voice: what changed on screen, what is prod-owed (migration numbers,
   order-critical or schema-invisible, plus the prod coach-demo re-seed that Phase 1 already owes),
   and the walk link.

---

## 6. Do not

- Do not build the Insights report selector, the progress chart, the coverage matrix or the handout
  preview (Phase 3). The PDF keeps its shape; it only stops mis-counting attempts.
- Do not add a development shelf to the season-end page or a year parameter anywhere.
- Do not seed sport packs, benchmarks or default tests; do not backfill a method, an aim, a scope
  or a review as fact; legacy rows are attempt 1 of 1 with no scope.
- Do not average descriptors, score a skill, rank players, show a team average beside a child, or
  compute a "consistency score" — spread is a number in the unit, on request.
- Do not build durable offline drafts (plan §9) — visible failure + retry is the whole of it.
- Do not touch `canWritePracticePlans`, the drill/template rooms, the practice planner or the
  tryout scorecard; do not change the Insights hub's seven tabs, the profile's three tabs, the
  sidebar's "Skills & Goals" or the report's "Development".
- Do not reopen the read-only door (ruled 2026-09-13) or the successor rule (ruled 2026-09-13).
