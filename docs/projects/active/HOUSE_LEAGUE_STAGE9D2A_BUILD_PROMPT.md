# House League Stage 9d-2a: the season's schedule, rebuilt (build prompt)

> **Written 2026-10-27**, after Stage 11b's walks §399–§403 passed. **Paste this into a new chat on `dev`.** It builds the
> first half of 9d-2 from `HOUSE_LEAGUE_STAGE9_PLAN.md` §0h (rulings 9d2·1–16, binding, do not reopen) and the drawings
> (https://claude.ai/artifact/TdXm5jmTEJ9qPvR3T5H9qU, version 4; source `HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html`). **No
> migration.** 9d-2b (Publish schedule, Changes to send, the families' game emails, the coach page's games) is a separate
> prompt, written after this one lands.
>
> Re-verify every lead before building on it: other sessions share this working copy (bookkeeping, Stage 12, the support
> console). Stage explicit paths only, commit only your own hunks, check `git diff --cached --name-only` before every commit.
>
> **Recommended model: Opus 5.5.** A 1,900-line client screen rebuilt onto shared calendar parts, a rewritten generator, a new
> health mapper, and a public page whose data query changes. Helpers stay on Sonnet for reading.

## ▶ Progress (read first when resuming)

- **2026-10-27, session 1:** the three owner questions answered (all as recommended) plus three the words raised —
  rulings **9d2a·A–F** in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0h (a Save is live; free-plan branch untouched; See the permit in;
  **no "Moved" in 9d-2a**; "Put it back on"; "Families aren't emailed."). `/marketing` ran; the words are the copy file's
  "Stage 9d-2a" section (it wins over the drawings). The UX summary was presented. **Step 1 is BUILT** (the generator, the
  season bookings, the league health; 33 tests; plan §9 entry of 2026-10-27). **Resume at step 2 (the public page).** The
  blocking steps below are DONE; do not re-ask them.
- **2026-10-27, session 2: Step 2 is BUILT and committed** (the public page: every status read, Cancelled struck in its
  week, Postponed under "Needs a new date", place on every game, opens on this week with earlier weeks folded; checked on
  Dev House League 2026 and a rolled-back fixture). Its pure parts (`seasonWeeks`, `todayLineAt`) live in
  `lib/league-season-calendar.ts` beside step 1's. One word chosen by the build, not by /marketing: **"Date to come"** for a
  game saved with no date at all (the admin can save one; it is not postponed, so it has no "Was"). **Resume at step 3.**
- **2026-10-27, session 3: Step 3 is BUILT and committed `58ecf0ee6`** (List · Week · Month, games and practices together,
  Division · switch · dates · Show · Export · Add · Tools; plan §9 entry). The page now reads the whole season once; the
  game window is still today's `GameModal` (opened from every view), Generate is in Tools, and the old health strip still
  sits above the views — steps 4, 5 and 6 replace them. Two drawn shapes were not built, argued from the recipe (C5: List
  is the row list; C13: the phone's Week is the stacked week, not a day pager) — tell the owner at the walk. **Resume at
  step 4 (the game window, b4).**
- **2026-10-27, session 4: Step 4 is BUILT** (the game window, read first; plan §9 entry). The Status dropdown is gone (a
  state is a door), ✓ saves and sends only what changed, the score is the pencil's, Delete stays on every state until
  9d-2b, "Time from" reads the season's game slots (past ones too) on the page's schedule read. The window's permit line
  and "See the permit" are step 7's. **Owner ask raised:** moving a game is not limited to the division's time (plan §9:
  recommended with 9d-2b's slot link). **Resume at step 5 (Generate games, c1–c4).**
- **2026-10-27, session 5: Step 5 is BUILT and committed `ed6c34db3`** (Generate games: step 1 from House league's time,
  k3 gives a row of time not given yet, k4 names who can; step 2 Once / Twice; the check passing / warning / blocking; a
  stale Save refused; plan §9 entry). The free League plan keeps its old generator (the branch is the club's schedule).
  Step 4's leftover tidy went in first as `8dbc2dc01`. **Tell the owner at the walk:** a club with the club's schedule and no
  house-league time can no longer generate (k4, as ruled); two league admins saving at the same moment could both insert
  (a lock needs 9d-2b's migrations). The check's "See the permit" is step 7's. **Resume at step 6 (Schedule health, d1–d4)**
  — the old health strip above the views is still there.
- **2026-10-27, session 6: Step 6 is BUILT and committed `c9a03a4bc`** (Schedule health: the header button, the league's window on the tournament's
  frame, tiles and rows, worked out from the season the page already reads; the old strip and its route are gone; plan §9
  entry). **Owner ruled the owed ask:** the foot says the rules in words, no "Adjust the rules" door until 9d-2b. **Resume
  at step 7 (Permit links).**
- **2026-10-27, session 7: Step 7 is BUILT and committed `7c2f0c0d2`** ("See the permit" from the game window, read and
  form, and Generate's permit warning; the permit window opens raised over them; plan §9 entry). **Owner ruled a build
  ask, 9d2a·H:** the "the permit ended {date}" line is in the ONE permit rule, on every surface (the coach's Where form
  and the club calendar included — say it at the walk and in `/docs`). The season read sends each game's permit answer
  only to whoever runs the season. **Step 8 committed `f63d0cbd0`** (the two pages' colour baselines shrink; the old-look
  entry is what still runs: the free plan's generator and the practice forms). **All eight build steps are done. Resume
  at "Checks and done":** `/review` (high) over steps 1–8, then `/simplify`, then `/docs` (say 9d2a·H's coach-side change
  and step 5's k4 behaviour change), the PM brief, TODO, and the walk in `OWNER_QA_LEDGER.md` (one purpose per part).
- **Facts found that the steps below must respect:** the club's cross-program clash rule never compares two house-league
  bookings (`comparable`: same owner) — house league's own clashes are `lib/league-schedule-conflict.ts`; a postponed game
  keeps its `scheduled_at`; `league_games.status` is scheduled|completed|cancelled|postponed only; `houseLeagueSlotRows`
  reads slots still to come only (a past game's "Time from" needs a read without the `now` filter, or says nothing).

## Before any code (AGENCY_RULES, blocking)

1. **The product-manager UX summary**, in the conversation: what a convenor, a league admin and a family see differently.
2. **Words.** Only Generate games step 1 has settled words (`HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` ~47–58). Every other 9d-2a
   string is unsettled: the three views' empty states, the Show filter, the game window's labels, the check results, the
   health issue sentences, "Needs a new date", "Give it a new date", the public state words, "See the permit". **Run
   `/marketing` once, before code**, and append the result to that copy file. House rules: "8:00 a.m.", `possessive()`,
   `pluralize()`, sport-neutral, "league admin", `check:spelling`.
3. **Ask the owner these three** (the drawings assume 9d-2b's publish state, which does not exist yet):
   - **A Save is live.** There is no publish mark until 9d-2b, so a saved game shows on the public page at once, as it does
     today. Frames b1, c3 and e1 say "Published …" and "Saved as a draft. Families see nothing until you publish." Those
     lines are 9d-2b's. Recommended: 9d-2a drops them and says what is true; **9d-2a is not promoted to production without
     9d-2b** (a generator that publishes 45 games to families unannounced is the thing 9d2·1 exists to prevent). Ask whether
     that is how he wants it sequenced.
   - **The free League plan branch** (9d2·14, parked). The generate route and the page still branch on `isFreeFloorLeague`.
     Recommended: leave that branch exactly as it is, untouched and unrebuilt, and say so in the plan; 9d2·14 says it is
     "decided again if the plan is unparked".
   - **Whether "See the permit" is in this build.** It needs the permit's id added to the wire shape (see Permit links).
     Recommended yes; it is small, and frames b4, c3 and i draw it.

## What is already built (re-read it; line numbers drift)

- **The screen today:** `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx`, one client file (~1,900
  lines): `GameModal` (~345, greyed for a reader), `GenerateModal` (~522), `PracticeModal` (~665), `CancelPracticeModal`
  (~818), `SchedulePage` (~887). `viewMode` is `'week' | 'list' | 'practices'` and the toolbar is the old
  `styles.viewToggleBtn` pills (~1460–1472) — **the pills are not a design to keep** (owner, round 3). Part 3 added the Tools
  menu and `HouseLeagueTimeLine` (~1439). It already mounts `HouseLeagueTimeWindow`, `PracticeTimeWindow`, `PracticeWindow`.
  Its permit helpers (`permitLine`, `permitAfterSave`, `permitSeriesLine`, `useClashCheck`, `WhereField`) are reusable.
- **The nearest model to copy:** `app/[orgSlug]/admin/calendar/page.tsx` (~265 lines; the club's calendar). Its toolbar is
  `CoachToolbarMenu variant="glyph" drawerOnPhone drawerTitle="View"` (~195), `MultiSelectDropdown restQuiet` for Show (~222),
  `CalendarViewSwitch` (~236), `PHONE_VIEWS = ['week','month']`. The views are `components/admin/kit/club/ClubCalendarViews.tsx`
  (`WeekView`, `ListView`, `MonthView`, `BookingWindow`), generic over `CalendarBooking` (`lib/club-calendar-view.ts`).
  `lib/club-calendar.ts` already reads house-league games and practices into bookings (`leagueBooking`) with the quiet permit
  line. **Argue, in the plan, whether the season page feeds that same booking shape** (recommended: yes; do not write a fourth
  calendar). The recipe is `docs/agents/design/TABLE_AND_LIST_STANDARD.md` §11.1, C1–C13.
- **11b's time:** `lib/league-time.ts`, `lib/league-time-server.ts` (`readLeagueTime`), `lib/league-practice-time.ts` (the
  planner; `fromCard` = "From {schedule}"), `components/admin/kit/club/league/time/*` (House league's time window, the time
  line, Practice time), `components/admin/kit/club/league/practices/PracticeWindow.tsx` (h2, **already one component for
  these views — mount it, do not copy it**). `league_slot_uses` holds a division's game time and a team's practice time
  (migs 392/394/397/400). `league_games` has **no slot link** (mig 392's header says 9d-2b adds it).
- **Generate today:** `app/api/admin/house-league/seasons/[seasonId]/schedule/generate/route.ts` (~208 lines): one division,
  one start date, `gamesPerWeek`, one `gameTime`, one venue, a circle-method round robin; every game in a round shares a date,
  time and place. **That is the SECOND MODEL OF THE CLUB'S TIME that the club's schedule forbids** (plan §0h, 9d2·3). It is
  rebuilt, not extended.
- **Health today:** `schedule/health/route.ts` (~95): clashes and an unchecked-booking count, no score, no engine. The
  tournament's button/window/engine: `components/admin/tournament/HealthButton.tsx`, `ScheduleHealthWindow.tsx` +
  `ScheduleHealthPanel.tsx`, `useScheduleHealthRules.ts`, `lib/schedule-metrics.ts` (`buildEventScheduleHealth` ~227,
  `scheduleMetricGameFromRow` ~249 — typed `Required` on purpose: a field the engine learns to read fails the build until
  its callers pass it). **No league mapper or league rule set exists.** `.probe/hl/h9d2.mts` runs the unchanged engine on Dev
  House League 2026 and scores it 97, Healthy (it has no idea a cancelled game wasn't replayed or a postponed one is undated).
- **Public page:** `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx` (server, ~239 lines) reads `getGamesForSeason`
  (`lib/db.ts` ~2706), which does `.neq('status','cancelled')`. So **a cancelled game vanishes and a postponed one reads as
  on** (defect C6-04/S06). Grep every caller of `getGamesForSeason` before changing it (add a sibling that returns all
  statuses; do not silently change a function other screens rely on).
- **Permit links:** `lib/permit-words.ts` (`permitLine`, `permitCalendarLine`, `permitSeriesLine`, `permitAfterSave`),
  `lib/permit-lookup.ts` (`checkClubPermits`, `namePermitOutside` — **drops the permit id**; `PermitOutsideIds` is in
  `lib/permit-time.ts` ~137), `components/admin/kit/club/PermitWindows.tsx` (`PermitWindow`, takes `permitId`, `q`, `orgSlug`,
  `orgName`; used today only by Organization › Venues). "See the permit" strings do not exist yet.

## The drawings: what 9d-2a builds (tab, frame, source line in the drawings file)

Read each frame whole; **the copy file's words win over the drawings' where they differ** (c1's foot: "Each game is 90 minutes,
the length of a slot").

- **`list` tab:** **b1** (~707) the desk List — games and practices together by week, opens on this week with a Today line;
  toolbar = division scope · view switch · Show · Export · Add; a night of practices folds into one row; a line under the title
  says the division's time comes from the club's schedule, with a door. **b2** (~759) Month: one chip per booking, time first, a
  "+N more" door, a cancelled chip struck with no pill, the health button leads the header. **b3** (~824) phone: one frame per
  day with a pager, Week and Month only, the view glyph opens a "View" drawer, a "Postponed · needs a new date" fold with an
  amber count, 44 px controls. **b4** (~862) the game window **read first** (C12): a reader gets no foot and no pencil; an
  editor gets the pencil, "Postpone this game" and "Cancel this game" at the end of the body, a "Time from {schedule}" line, the
  permit line with "See the permit".
- **`gen` tab:** **c1** (~893) step 1 shows the division's game time from House league's time, door "Change it in House
  league's time" (the "empty, give it some here" variant is **superseded by k3**; a convenor with none sees the club hasn't
  given time, and who can). **c2** (~927) step 2: Once or Twice (a dropdown), byes and home/away balanced, "45 games in 65
  slots". **c3** (~938) the check in four states — passing; warning (outside the permit, a booking outside the club's schedule at
  the place, a team twice in a day, byes back to back); blocking ("90 games need 90 slots"); re-run ("Replace 45 draft
  games?" — replaces only games with no scores) — plus Checking…, a failed check keeps the choices, and the line after Save.
  **c4** (~969) phone.
- **`health` tab:** **d1** (~1001) the button, the "—" state for no timed games. **d2** (~1009) the window with a **league rule
  set**: Games on plan, Home/away, Byes spread, Clashes (games **and** practices); issues carry doors ("Show them", "Give it a
  date"). **d3** (~1049) what carries over from the tournament engine, and "Adjust the rules" (games per team, twice in a day
  allowed = no, home/away tolerance = 1). **d4** phone. **The drawing's weights ("provisional points", −5/−3/−1) are
  placeholders; the build picks real ones and says why in the plan.**
- **`public` tab:** **g1** (~1253) place on every game, Cancelled struck, Postponed in words, a "Needs a new date" section,
  opens on this week, "Times in Eastern time." once, games only. **g2**'s *this-week* phone frame only (its "schedule is
  coming" and half-published variants are 9d-2b).
- **`edges` tab (~1591–1642):** **i** the permit line in its three cases · **j** who-can-do-what · the edge cases (two
  divisions neither scheduled; a closed venue; a typed place; a finished season has no screen). **h2** (~1496) is already built.
- **Not built here (9d-2b):** e1, e2 (publish), f1–f5 (editing a published game, Changes to send, the family email, the sent
  history's rows, urgent cancel), g3 and ask 9d2·7 (the coach page's games), the "Published … · N families told" and "Draft ·
  45 games" sub-lines. Do not add a publish column, a game slot link, or a notice kind. The rulings that govern the *shape* of
  what 9d-2b will do (9d2·1, ·2, ·9, ·13) are not 9d-2a's to build; the ones 9d-2a owns are ·3, ·4, ·5 (reading half), ·8–·12,
  ·15, ·16 (reading half).

## Build, in this order, each committed after its checks

**1 · Pure, tested first.**
- *Bookings for the season page:* games + practices → the calendar's booking shape, incl. cancelled (struck), postponed (own
  state, leaves its week for "Needs a new date"), a night of practices folded in List, "Time from {schedule}" on a game derived
  from the division's `league_slot_uses` game time (there is no link on the game; **argue the rule when a game sits outside every
  use**: say nothing, never guess).
- *The generator:* match-ups only. Input = the division's game slots from the club's schedule, once or twice through, byes
  and home/away balanced, game length = the slot's. Output = games on those slots, or a block ("90 games need 90 slots") or
  warnings (outside the permit, outside the club's schedule at the place, a team twice in a day, byes back to back). Never
  picks a day, time or place the club did not allocate (owner amendment, binding). Reuse `clashReportForLeagueRows` /
  `lib/league-schedule-conflict.ts` for the clash half.
- *The health mapper:* a league mapper beside `scheduleMetricGameFromRow` (typed `Required`), a **league rule set**, the
  clash pool = games + practices, **a postponed game must not count as played** and a cancelled one must not count as owed.
  Prove against Dev House League 2026 (`.probe/hl/h9d2.mts` as the starting oracle; the unchanged engine said 97 — say what the
  league rule set says and why it differs).

**2 · The public page.** A new all-status read; Cancelled struck, Postponed in words, "Needs a new date", place on every game,
the zone sentence once, opens on this week. Games only; practices are never public. Update `club-stage6c-screens-guard` if the
page now wears the calendar recipe.

**3 · The admin screen.** Replace the pills with `CalendarViewSwitch` (List · Week · Month; Week and Month on a phone via the
`CoachToolbarMenu` View drawer), Show as `MultiSelectDropdown restQuiet`, ScheduleDateNav, the shared views. Games and practices
together. Retire the "Practices" third view: a practice is a booking in the same views and opens the existing `PracticeWindow`.
A hand-made practice becomes editable (it was insert-only); a club practice stays read-only. A reader is read-only everywhere.

**4 · The game window, read first (b4).** Read first, edit whole (pencil ↔ ✓), **Postpone** and **Cancel** at the end of the
body, **Delete before the games are published and Cancel after** (9d2·9 — until 9d-2b there is no published state, so Delete
stays what it is today; say that in the plan). Postponed → "Needs a new date" and "Give it a new date" (9d2·10), then it reads
Moved. `house-league-game-window-guard` pins the old window; it changes with the reason in the commit.

**5 · Generate games (c1–c4).** The new two-step window on the generator above; a division with games already is not listed for
Generate and adds games one at a time (9d2·11 — *until 9d-2b there is no "published"; recommended: "has any games"*). Keep the
parked free-floor branch as it is.

**6 · Health (d1–d4)** on the tournament's button and window, fed by step 1's mapper; the issues' doors scroll to or open the
game or the clash.

**7 · Permit links.** Carry the permit id through `namePermitOutside` (and the wire shape that reaches the page), and open
`PermitWindow` from "See the permit" in b4, c3, i. Permits live under Organization › Venues; check a league admin can open
the window (or does not see the door) — argue it.

**8 · Retire the old look.** The old schedule page and public page leave `scripts/.admin-old-look-baseline.json`,
`.admin-restyled-baseline.json`, `.admin-type-baseline.json`, `.tsx-token-baseline.json` as they stop earning entries (baselines
only shrink).

## Checks and done

- Unit tests for the three pure parts; a dev end-to-end on a **rolled-back** fixture. **Dev holds no house-league time**, so
  build the fixture (the 11b pattern: `.probe/11b4/e2e.ts`; the 11b walk fixture on UAT Rep Club, `.probe/11b-walk/fixture.mjs`
  — Reds/Blues coaches and a league admin). *Draft Test 2027* (1 division, 10 teams, 101 families) is the real generator case.
  Fixture games store 10:00 UTC (they read 6:00 a.m.): say so rather than "fixing" it.
- Guards that will move (read each, change with the reason): `club-stage6c-screens-guard` (~234, the exact `CalendarViewSwitch`
  and `ScheduleDateNav` assertions; zone sentence), `club-stage6b-screens-guard`, `club-scheduler-screens-guard`,
  `club-stage6a-guard` (~65–68 `clashReportForLeagueRows(` in the schedule, `[gameId]`, practices and generate routes; ~147
  `WEARS_THE_FIELD`; ~246 `sport={season?.sport}`), `house-league-game-window-guard`, `league-season-scope-guard` (a new
  route needs a line), `admin-overlay-guard` (~80), `schedule-health-one-number`, `schedule-metrics`,
  `league-practice-time`, `league-time`, `league-schedule-conflict`.
- `npm run verify:changed`; `npm run typecheck` (shared modules touched); `npm run lint:focused -- <files>`;
  `npm run check:spelling`. A failure in a file you did not touch is another session's: confirm before blaming yourself.
- `check:layout --changed` on the screens you touched, on dev — **never a whole-product sweep on the dev server**.
- **Prod order:** this reads `league_slot_uses` and the practice link, so migs 392–394, 397, 400 reach production first
  (`supabase/migrations/MANUAL_PROD_STEPS.json`); 385 is 9d-2b's. 9d-2a itself adds no migration.
- `/review` (high: a rewritten generator, a public query, a health score a convenor will trust), then `/simplify` (a new
  mapper and a calendar fed by a new source is the duplication shape), then **`/docs`** — Part 6's help says in so many words
  that it does not describe 9d-2a.
- Records: `HOUSE_LEAGUE_STAGE9_PLAN.md` §9, the PM brief, `TODO.md`, memory `project_club_stage9_house_league.md`. A walk
  (the next § in `OWNER_QA_LEDGER.md`; check the last number) of one purpose per part: the views · the game window ·
  Generate games · health · the public page.
- New files → the dev server needs a restart before the owner tests; ask first.

## Do not

- Do not offer "Practice time"/"House league's time" a second home or a duplicate window; they are 11b's and already mounted.
- Do not let a house-league screen choose a day, time or place the club has not allocated (amendment to 9d2·3 and ·5).
- Do not add a publish state, a game slot link, a notice kind or a migration (9d-2b). Do not unpublish, ever (9d2·1).
- Do not redesign scheduling as a whole. The owner reviews house league + rep + games + practices together after Stage 11 and
  has asked for **no relabel or redesign before then**; this build implements ruled drawings and nothing wider.
- Do not reopen rulings 9d2·1–16; ask only the three questions above.
