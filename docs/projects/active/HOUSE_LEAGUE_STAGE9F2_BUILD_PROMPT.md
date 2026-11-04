# House League Stage 9f-2: Start next season (build prompt)

> **Written 2026-11-03**, after the owner's walk §449 passed 26/26 (9f-1, committed `9e6795518`). **Paste this into a new chat on `dev`.**
> Size **M**. **One migration expected (next free number; 431 was taken by another session on 2026-11-03, so 432 or higher)** (a small provenance column; see Part 2 and the push-back below). `ls supabase/migrations`
> first: the highest on 2026-11-03 was **431** (`431_one_waiting_plan_change_per_account`).
>
> **Binding, do not reopen:** rulings **9f·8 through 9f·15** (plan `HOUSE_LEAGUE_STAGE9_PLAN.md` §0j lines 396–409), **9f·17**
> (CLAUDE.md: house-league seasons read in place under Q16; do **not** add a one-page closed season, a season dial or a
> coaches-portal branch), and the accepted words in `HOUSE_LEAGUE_STAGE9F_COPY.md` **Part B (§7–§12) and §14.1**, with all 16 answers
> in §15. **Not this build:** **9f·16, the plan gate, is `Proposed`, not ruled: build NO gate and write NO plan or upgrade words.**
> Returning-family pre-fill is Stage 14 / signed-in accounts, not here. Nothing is stored about a "frozen" table (9f·2).
>
> **Read first, in this order:** (1) plan §0j (lines 367–424) and the 2026-11-04 status line; (2) copy doc Part B (lines 199–312),
> §13 (what changed from the drawings) and §14.1 (the binding word list, lines 363–378); (3) the drawings
> https://claude.ai/artifact/UN6Su7DsmAU8tcLyAu1d4Z (source `HOUSE_LEAGUE_STAGE9F_DRAWINGS.html`): **tab 5 "Start next season"** =
> pane `next`, lines 1100–1243 (s13 desk window, s14 phone sheet, s15 how dates and born years move, s16 the new season's Overview,
> s17 the copy list), tab 2 s1 (the rare door, lines 789–862), **tab 6 "Edges" 1, 3, 4, 5, 6, 7** (lines 1245–1268); (4) the two
> models: `startNextRepSeason` (`lib/rep-season-rollover.ts:107`, with the pure decision module `lib/season-carry.ts` and
> `tests/unit/season-carry-forward.test.ts`) and `cloneTournament` (`lib/db.ts:221`, `lib/tournament-setup-copy.ts`); (5) the
> shipped create window and route: `components/admin/kit/club/CreateLeagueSeasonDialog.tsx`,
> `app/api/admin/house-league/seasons/route.ts`; (6) `docs/agents/db/DATA_DICTIONARY.md` for `league_seasons` (line ~6703),
> `league_divisions` (~6801), `league_teams` (~7047), `league_team_coaches` (~7096), `league_practice_time` (~1751).
>
> Re-verify every lead below before building on it: other sessions share this working copy and a helper's summary is a lead, not
> evidence. Stage **explicit paths only**, commit only your own hunks, check `git diff --cached --name-only` before every commit,
> **commit only when the owner says**, on `dev`.
>
> **Recommended model: Opus 5.5, one session** (split at the end of Part 3 if context is deep; the Progress block lets the next
> chat resume). Before any code, present the Product-Manager UX summary and a task list (the repo's rules make that a blocking
> step). Update the Progress block after each Part. Reading and searching go to helpers (Sonnet).

## ▶ Progress (read first when resuming)

- **2026-11-03 · Not started.** Facts below were read from the code on 2026-11-03 (a helper's survey; the create route, the
  Overview page's door code and the dialog's field list were opened and confirmed by the author of this prompt). Re-check line
  numbers; they drift.
- **2026-11-03 · Part 0 done.** Owner answered all four push-backs **as recommended** (store `started_from`; sequential with
  delete-on-failure; free floor sees no field; door on every season except Getting ready). Two corrections taken without asking:
  a year in the name always goes up by **at least one** (a Jan 1 start lands Dec 31 of the same year), and **Coaches depend on
  Team names** (unticking teams unticks and disables coaches). The settings line uses the ruled fallback "the schedule rules": the
  Schedule page's two labels are sentences ("A team can play twice in a day", "Home and away can differ by"), not list nouns.
- **2026-11-03 · Part 1 done.** `lib/house-league-start-from.ts` + `tests/unit/house-league-start-from.test.ts` (29 pass). Calls
  made: when the first day is edited off whole weeks, the dates sentence and the mark follow the real gap ("366 days after…",
  "Moved 53 weeks") rather than claim a weekday; the banner list is joined with "and" (the product's list style).
- **2026-11-03 · Part 2 done.** Mig **432** `432_a_season_remembers_where_it_started.sql` (`league_seasons.started_from jsonb`),
  applied to **dev** 2026-11-03; `MANUAL_PROD_STEPS.json` entry `pending`; dictionary: the column, gotcha 6 + the slug line
  (server-made), and the three "written only by" lines now also name the copy. `check:dictionary` passes.
- **2026-11-03 · Part 3 done.** `lib/house-league-start-from-server.ts` (read the source by `id` + `org_id`; pre-made ids;
  season row with `started_from` in the one insert; then divisions, teams, practice time, coaches; `deleteDraftLeagueSeason` on
  any later failure). The create POST takes `startFrom` after the cap check; free floor → plain 403; 404 for another club's id;
  same 409 words. Season GET gained `coachCount` per division and `clubTime: { given } | null` (null without the club's
  schedule). The window reads the source's divisions and **the same `money.owing` the Overview tile reads** from the season GET.
- **2026-11-03 · Part 4 done.** `CreateLeagueSeasonDialog` gains Start from (desk: `SublinedChoice`, which gained an optional
  `closedSub` so the closed field reads "{season} · {pill}"; phone: a `SheetFrame` menu titled Start from), the statement and
  owing clause, the moved name/dates (the last day follows the first until touched), Bring with it (dependants disabled), the
  live-source chips, always-empty line and the foot. `startFromId` prop; the home needs no change (the window opens on the
  newest season itself). `admin-overlay-guard` names the window's drawer as a MENU.
- **2026-11-03 · Part 5 done.** Overview: door order Complete · Start next season · Reopen, every season but Getting ready, never
  the free floor; banner + marks on a copied Getting-ready season (marks are clickable: "From …" opens the source season,
  "Moved N weeks" opens the registration dates); `mk.ageLine` desk-only; the club-time note on any live season the club has not
  given time to (owner/admin second sentence from `access.placeAnywhere`, the league admin's otherwise).
- **2026-11-03 · Part 6 checks.** Typecheck passes; focused tests 312/312 + 67/67; full `npm test` 13531/13543, the 12 failures
  all other sessions' (billing_locations mig 433, plan-ending walk, platform bookkeeping foot, stripe prefix). `verify-changed`'s
  ESLint step fails on the repo's eslint config (react-hooks plugin not found for another file); direct ESLint on every 9f-2 file
  is clean. `check:layout` on `admin-house-league` + `admin-hl-season` (4 widths): the only finding (season page scrolls sideways
  88px/59px at 361/390, the page strip) **reproduces with the committed page.tsx**, so it predates 9f-2 — reported, not fixed.
  The window itself has no layout screen. Dev server: restart owed before the walk (new files, `lib/types.ts`, `lib/db.ts`).

- **2026-11-04 · /simplify done** (four reviewers: reuse, simplification, efficiency, altitude; 9f-2 files only). APPLIED: the copy
  takes its five dates from the pure module's `movedDates` (three hand-copied `shiftStamp` lines gone) and reads and writes birth
  years through `bornYearsOf` / `bornColumns`; it reads only what is brought (teams, practice time, coaches) and the coach read
  joined the one `Promise.all`; the season GET's club-time count is skipped for a finished season; the create route's 409 sentence
  is one const; the Overview's door list, mark and no-time bits are shorter; `moveBornYears` is typed `BornYears`; the door-order
  assertion in `house-league-season-page.test.ts` follows the new shape. SKIPPED, each with its reason: the window's state
  refactors (`baseline`, `chosen`, `pickRef`: browser-only risk, no test would catch a slip); props that skip the window's two
  fetches, a slim "start-preview" read, a dynamic import of the window, an opt-in coach count (real but larger than this commit;
  the extra reads are one per open of the window); hoisting the free-floor refusal above the cap block (it would read `startFrom`
  ahead of the cap check, against the ruled order); parallel child inserts (foreign-key order, and a sibling still in flight when
  the cleanup runs); un-exporting test-only helpers; dropping `StartedFrom.live` and `brought.practice` (stored record, kept for a
  later stage); `rareDoors` / `startFromOffered` / `markChip` helpers and a `SublinedChoice` sheet mode (altitude moves, none a
  defect); sharing `dayOf` and the FNV hash (no exported helper to call without a behaviour change).
- **2026-11-04 · /review done** (high-risk; four lenses: security and tenant, data and copy, window and Overview, regression and
  concurrency). Gate: ESLint clean on the 9f-2 files; typecheck clean on them (the full run stops on another session's syntax error
  in `tests/unit/billing-location-checkout-guard.test.ts`; tsc reports no semantic errors at all while any syntax error exists, so an
  earlier "clean" filter proved nothing, redone with that file excluded); `check:migrations` lists `started_from` as dev-only
  (expected until the prod apply); `check:layout` not run (the window has no layout screen; the season page's sideways scroll at
  361/390 predates 9f-2); `verify:changed` not run (its ESLint step fails on the repo's config for another file). The seven asked
  checks all HELD: the source is read by `id` AND `org_id` and nothing else reaches the child reads; the free floor is refused with
  the plain 403 before any read, and a malformed `startFrom` is a 400; `startFrom` is read after the cap check (the body as a whole was
  already read before it, because the name makes the slug, and that is unchanged); any failure after the season insert deletes the
  draft (`deleteDraftLeagueSeason`, FK cascades checked in the dev constraints dump); a copied coach row carries no invite column and
  nothing in the path sends mail or writes a notice; live and finished sources behave as ruled (dates, birth years, chosen age
  groups, ids from another season ignored); both sides of every checklist mark use one fingerprint function over the same stored
  values. No Critical, High or Medium finding. FIXED (Low): the stored "Moved N weeks" followed the typed dates, so a source with
  no dates recorded 364 days (never shown; now `datesMoved(source, shift)`); a non-id `seasonId` reached Postgres and answered 500
  (now `isUuid`, 400); the year count in the Age groups line printed "2 years" where the accepted copy says "two years" (spelled
  one to three, digits after); from a season's own door a failed season list opened a blank window without a word (now says "We
  couldn’t load the season."); a cleanup that deleted nothing was silent (now logged); the prod-step note named the wrong reason.
  SKIPPED (Low, recorded): `started_from` is readable through the public non-draft season policy and in the admin JSON (same class
  as the waiver text; it holds the source's name and id and hashes; the page shows it only to runners); the team, coach and
  practice reads have no paging, so a source over 1000 teams or coaches would be cut short at PostgREST's default; a child-insert
  `23505` would read as "name taken" (no realistic child collision); no retry after a failed detail fetch (pick another season and
  back); `Moved N weeks` has no direction when the first day is set earlier; a "From" link to a source later deleted lands on
  "We couldn't find this season"; an untouched Team names tick returns when Age groups is ticked again; a "no time yet" note on a
  live season from before the club schedule existed (prod has no house-league clubs).
- **2026-11-04 · /docs done.** `lib/help-content/house-league.tsx`: two new topics under "Creating and configuring a season" (Start
  next season from an earlier one; What comes across, and what the new season shows), a Start from step in "Create a season", and
  one line each in the lifecycle, who-can-do-what, closing-out and club-time topics; keywords and search text carry the new terms.
  Both topics are under the 350-word line (`measure:help`); `check:spelling` and `check:help-shots` pass. One clause names the free
  League plan (the field is not there); no upgrade or plan-gate words. If the owner would rather the help say nothing about
  plans while 9f·16 is open, strike that clause.
- **2026-11-04 · COMMITTED `d907b02b7`** (20 files: the build, mig 432's prod-step entry, the dictionary entries, the help). Left out and
  why: the schema snapshots (they also carry another session's mig 433 `billing_locations`; refresh them when 433 is
  committed); other sessions' hunks in `lib/house-league-season.ts`, `lib/help-content/house-league.tsx`, `DATA_DICTIONARY.md` and
  `MANUAL_PROD_STEPS.json` (433). Verified: 683 house-league and help unit tests pass; `check:dictionary` and `check:spelling`
  pass. Known failures that are NOT 9f-2: mig 433 billing grants, plan-ending, the bookkeeping expense window, the billing-location
  census, `check-css-selectors`, `check-admin-old-look`, `check-demos`, schema parity (`started_from` dev-only until the prod apply).
- **2026-11-04 · Walk §450 WRITTEN:** https://claude.ai/artifact/RNbdUmMsWZMuGRr1PUyw7m (`HOUSE_LEAGUE_STAGE9F2_WALK.html`, 60 steps in parts A–K, one purpose). Fixture `.probe/9f2-walk/fixture.mjs` (dev only; two throwaway clubs, five sign-ins, `--reset`) and `.probe/9f2-walk/look.mjs` (a no-browser probe of the real routes: the copy gave 4 age groups, 22 teams, 0 coaches / 31 when ticked with none invited, dates +364 days, birth years +1, the live source with chosen age groups, the free plan and a registrar refused, another club's season 404, a malformed id 400, a duplicate name 409; the source unchanged). The dev server was running and had restarted after the build (7:33 a.m.).
- **2026-11-04 · Walk §450 PASSED 60/60** (A–K all clear, no change asked); its four owner calls (the banner's "and", the "53 weeks" gap sentence, the door on a running season, the help's free-League-plan clause) were closed 2026-11-04, all left as built.
- **STILL OWED:** apply mig 432 to prod before the promote that ships 9f-2.

## What the owner gets (the PM summary you will present, in this shape)

A club that runs house league every year stops retyping its season. In the existing **Create a house-league season** window the
first field is **Start from**: it opens on the club's most recent season, and the window says at once that the old season is left
exactly as it was. Name arrives bumped ("Draft Test 2027" → "Draft Test 2028"), the dates arrive 52 weeks later on the same
weekdays, and a **Bring with it** list (settings, age groups, team names and colours, practice settings ticked; coaches
unticked) decides what comes across. Families, payments, ratings, games, practices, emails and the club's time never do. The new
season lands as **Getting ready** with a banner "Started from Draft Test 2027: …", small marks ("From Draft Test 2027", "Moved 52
weeks") on the lines to check, and Open registration offered at once (it still asks in its own window). A rare door at the end of
each season's Overview, "Running it again? Start next season from this one…", opens the same window preset. League runners only
(owner, club admin, league admin). Nobody is emailed. A running season can be copied too (an age group's own calendar, Q19); its
dates then arrive empty. Phone: the same window as a full-screen sheet.

## Facts read from the code (verify, then build on them)

1. **There is no shared "create a house-league season" function.** The only inserts are the POST at
   `app/api/admin/house-league/seasons/route.ts:73–95` (inline) and the dev seed. Creation is **one plain insert**; no budget
   line, no checklist row, no ledger (the checklist is computed on read; the season's accounting book is made lazily and removed
   by `deleteDraftLeagueSeason`). That POST **ignores** `howToPay`, `earlyBirdUntil`, `owingAmberDays`, `askEmailConsent`,
   `twiceInADayAllowed` and `homeAwayTolerance`. A copy needs a second write for those, or a direct insert of the whole row.
2. **Who may create:** `houseLeagueRefusal(ctx, 'run')` (`route.ts:27`); the runner roles are owner, admin, league_admin
   (`lib/house-league-access.ts`). Registrar and treasurer cannot. `tests/unit/house-league-gate-guard.test.ts` forbids role literals
   in any route under `app/api/admin/house-league/**` and requires the first gate call to be `houseLeagueRefusal(ctx, '<action>'…)`;
   any new route there is scanned automatically (a season-less POST is on its `NOT_SEASON_SCOPED` list).
3. **The free-floor cap runs first** (`route.ts:42–59`): `houseLeagueSeasonCap` + `readSlotHolders` (live seasons only, since 9f-1).
   Free-floor limits of **1 age group** (`divisions/route.ts`, `houseLeagueDivisionCap`) and **8 teams** (`teams/route.ts`,
   `houseLeagueTeamCap`) are enforced by those routes; a bulk copy skips them unless you handle them.
4. **The slug is made from the name** (`seasonSlugFrom`, `lib/house-league-season.ts:221`) and the collision is on the slug, not the
   exact name ("Summer 2027" and "summer-2027" collide; unique `(org_id, slug)`, refusal 409 "You already have a season with this
   name…"). "Reserved" means a format check only (`seasonSlugRefusal`, `:226`). `DATA_DICTIONARY.md` gotcha 6 (~line 6714) says the
   slug is "client-supplied": stale, fix it in the same unit of work.
5. **What a copy takes** (columns, from the dictionary; confirm against the live snapshot, never a migration file):
   - `league_seasons`: `sport`, `description`, `registration_fee`, `how_to_pay`, `waiver_text`, `ask_email_consent`,
     `owing_amber_days`, `auto_approve_under_capacity`, `auto_promote_waitlist`, `twice_in_a_day_allowed`, `home_away_tolerance`.
     **Five dates move:** `season_start_date`, `season_end_date`, `registration_open_at`, `registration_close_at` (timestamptz stored
     with a literal `Z` as the club's wall clock: shift the DATE part, keep the time suffix, never re-zone), `early_bird_until`.
     **Never:** `status` (defaults to draft), `registration_closed_at`, `finished_at`, `draft_state`, `auto_generate_fees` (dead),
     `division` (dropped), ids and timestamps.
   - `league_divisions` (FK `season_id`, cascade): `name`, `capacity`, `sort_order`, `born_from_year`, `born_to_year`, `price`,
     `early_price`, `note`, `show_standings`, `games_per_team`. **Never** `teams_published_at/_by`, `schedule_published_at/_by` (there
     is no unpublish, so a copy starts unpublished). Born years go through `rollBornYears` (`lib/born-years.ts:244`) and must pass
     `checkBornBody` for the target year.
   - `league_teams`: `name`, `color`, `sort_order`, with `division_id` remapped to the new divisions. Not `coach_name` (legacy).
   - `league_practice_time` (PK `season_id, division_id`): `practice_minutes`, `teams_at_once`, division remapped. Not
     `league_practices`, `league_slot_uses` or anything tied to the club's dated slots.
   - `league_team_coaches` (only when ticked): `name`, `first_name`, `last_name`, `email`, `created_by`, skipping rows with
     `removed_at`; **never** the invite state (`user_id`, `token_hash`, `invited_at`, `expires_at`, `invited_by`,
     `invite_failed_at`, `accepted_at`, `calendar_*`). A null `invited_at` reads "Invited when you publish"; invites go out only at
     Publish teams. Mirror the add-coach route's insert shape (`teams/[teamId]/coaches/route.ts:118–148`).
   - **Never copied:** registrations, payments and refunds, ratings, games, scores, changes, rainouts, practices, slot uses, notices,
     email logs, invites, club time, the budget seed.
6. **Writers that live elsewhere:** `home_away_tolerance`, `twice_in_a_day_allowed` and each division's `games_per_team` are written
   only by the SQL function `league_season_rules_save` (mig 412); `league_practice_time` only by `league_practices_hand_out`. Direct
   inserts from the service role work, **but first grep `tests/unit/*guard*` and `scripts/` for a check that forbids a direct write to
   those columns/tables** (the search the author ran found none, but only in files named `*guard*`).
7. **No house-league copy exists.** Models are sequential with best-effort cleanup, not SQL transactions: `cloneTournament`
   (insert the draft, `copySetupRows`, on any error delete the new row and let the cascade clean up, `lib/db.ts:343–347`) and
   `startNextRepSeason` (insert, project staff, `cleanupNewSeason`). The pure decision logic sits in its own module so it can be
   tested (`lib/season-carry.ts`). **Copy that split.**
8. **Helpers that exist:** `addCalendarDays(date, days)` (`lib/timezone.ts:329`, pure YYYY-MM-DD; 52 weeks = 364 days keeps the
   weekday), `daysBetweenDateStrings` (`:427`), `rollBornYears`, `seasonSlugFrom`, `seasonState`/`seasonGroup`/`newerSeasons`/
   `orderSeasons`/`isPastItsEnd` (`lib/house-league-season.ts`), `pluralize`, `possessive`, `formatStoredDate`. No "weeks" helper.
9. **The Overview page** (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx`): the rare doors are
   `rare = canMove ? ['complete','reopen'].filter(…) : []` (`:189`), rendered at `:311–320` as `<p className={s.rareDoor}>` with an
   `inlineLink` button; the words come from `rareDoor()` in `lib/house-league-status-words.ts`. `canMove = access.changeStatus`
   (`:145`) is true for the league runners (Reopen shows on a finished season through it); `canRun` is false on a finished season,
   so **do not gate the new door on `canRun`**. `tests/unit/house-league-season-page.test.ts:175` asserts the doors' markup.
10. **The dialog** (`CreateLeagueSeasonDialog.tsx`): fields name (required), sport, two `DateInput`s; `ready = !!name.trim()`; POSTs
    name, sport, seasonStartDate, seasonEndDate; stays busy on success while the caller navigates
    (`app/[orgSlug]/admin/house-league/page.tsx:173–180`); a 403 `capHit` opens `LeagueCapUpgradeModal`. It uses the shared
    `KitDialog` (`kind="form"`), which fills the screen on a phone: the "phone sheet" needs no separate component. The page's
    launcher is icon-only on a phone (`page.tsx:67`) and the empty state has a second launcher (`:125`).
11. **The checklist** (`seasonChecklist`, `lib/house-league-season.ts:327`): five steps (`ageGroups`, `prices`, `dates`, `pay`,
    `waiver`); `pay` only when the season charges; a copied season with divisions (born year + capacity), a price range and both
    registration dates arrives ticked. `openRegistrationRefusal` (`:396`) reads the same function.

## Push-back, before you build (say it in the PM summary)

1. **The "From {season}" marks that disappear when a line is edited need the new season to remember where it came from.** The
   plan says "nothing is stored" (9f·2), which is true of the standings table, but the accepted copy (`mk.from`, `mk.moved`,
   `mk.line`, row `s16`) needs the new season to know its source, what was brought, and whether each line has been touched since.
   **Recommended: one nullable `jsonb` column `league_seasons.started_from`** (a new migration, 432 or higher) holding the source's id (no FK),
   its name as it was, the ticked parts with their counts, whether the dates moved, and a **fingerprint per checklist line**
   (ageGroups, prices, pay, waiver, registration dates) taken at copy time. A mark shows while the line's current fingerprint equals
   the stored one, so editing a line clears its mark **with no hook in any save route**. The banner shows while the season is
   Getting ready. Additive, nullable, no backfill; prod apply is safe in either order (record it in `MANUAL_PROD_STEPS.json`
   as `pending`). If you find a cheaper way to keep the promise, present it; do not drop the marks silently.
2. **"One save" (drawn edge 6) versus the repo's own two models.** A SQL function would make the season plus everything under it
   atomic, but it would duplicate `rollBornYears` and the caps in SQL. The tournament clone and the rep rollover are sequential with
   delete-on-failure, and the owner has lived with that. **Recommended: sequential, all-or-nothing in effect (delete the new season on
   any later failure; the cascade removes the rest), no SQL function.** A half-built draft that survives a crash between steps is
   visible, deletable (`deleteDraftLeagueSeason`) and never emailed. Say so; if the owner wants atomicity, it is a SQL function in
   the same migration and a bigger Part 3.
3. **Born years shift by the difference of the two first days' YEAR NUMBERS**, not by elapsed time. The drawing's s15 says "(here,
   one)" for May 1 2027 → Apr 29 2028, which is 363 days: elapsed whole years would be zero. Use the year-number difference, pin
   it with the s15 table as a test, and call it out.
4. **Free-floor clubs: the field is absent** (the window is today's). 9f·16 excludes the parked free floor and §15.16 ruled that no
   free-floor words are written; a bulk copy would also walk past the 1-age-group / 8-team caps. This is the safe default; confirm it
   in the PM summary. If 9f·16 is ruled the other way later, the window needs one line saying what the cap leaves out.
5. **The rare door on a Getting-ready season reads oddly** ("Running it again?" on a season that has not run). The drawing says "each
   season's Overview". **Recommended: show it on every season except Getting ready.** Small call; ask in the PM summary.

## Decisions already made (build as written, do not ask)

- **Defaults and order.** The picker lists every season of the club, **newest first**, with a second line: `{pill word} · {n age
  groups} · {n teams}` (pill = `seasonState`, so "Finished", "Playing now", "Ended Aug 28"). **"A blank season"** is the first item
  and gives exactly today's window (sub-line "Name, sport and dates only."); no group heading (§15.3). It opens on the most recent
  season, or on the season whose rare door was pressed. A club with no season yet sees no Start from at all. Our own picker (each
  item carries a second line, so not a browser select), a drawer titled "Start from" on a phone.
- **The statement** under the field, plain text, not amber: `sf.left` for every source. For a **finished** source with money owing,
  add `sf.owes` ("{3 players} still owe {$525} there. That stays on its Money tab."; "1 player still owes $175 there."), formatted
  as the Overview's "Still owing" tile shows it; **never** for a live source; the drawn "still running" sentence is omitted
  (§15.11). A warning, never a block.
- **Dates.** From a **finished** source: new first day = source first day + 364 days; the five dates all move by
  `newFirstDay − sourceFirstDay` days (so if the person edits the first day, the other four keep their gap); the window shows only
  the first and last day, the other three follow and are checked on the Overview. `sf.dates.desk` / `.phone` under the dates. From a
  **live** source: **all five arrive empty** and `sf.dates.live` says so; birth years then stay as they are (§15.13) and the Age
  groups line is `bw.ageGroups.live` ("Choose which age groups come across.", chips for each group, **all on** by default; the
  drawing's one-chip caption conflict is settled by the ruled copy). A source with no dates gives empty dates and no "Moved"
  mark.
- **Name.** Exactly one standalone four-digit year (`\b(19|20)\d{2}\b`) in the source's name goes up by the same year-number
  difference; none or more than one → the field arrives empty with the **source's name as its placeholder**. A live source: empty
  (there is no basis for a year). The name is prefilled once at pick; later edits to the dates never rewrite what was typed. A taken
  name is refused with today's words and the window stays open.
- **Bring with it** (§10): settings, age groups, team names and colours, practice length and teams at once **ticked**; coaches
  **unticked**; counts beside age groups, teams and coaches. "Team names and colours" and "Practice settings" depend on age groups
  (they cannot exist without them): **unticking Age groups unticks and disables both** (the drawing shows no behaviour here; this is
  the only coherent one, say so in the summary). "Settings" is independent. The settings line lists the Schedule page's labels for
  the two schedule switches in their order, "the schedule rules" as fallback (§15.12). The always-empty line (`sf.empty`) and the
  foot sentence **Families are not emailed.** (`sf.foot`, at the left of the foot beside Cancel and Create season) are as §10.1.
- **After create:** the caller navigates to the new season's Overview exactly as today. Open registration is offered at once when
  every line is ticked, and still asks in its own window (9a·4).
- **No club time yet note** (`mk.noTime`): shown on **any** season with no club time, copied or not (check what `lib/league-time.ts`
  already says on the Overview before adding a second note; one phrase in both places; a league admin sees the
  `noneGivenLeagueAdmin` second sentence).
- **No gate, no plan words, no demo work.** The demos follow the product (CLAUDE.md); do not touch them. This build moves no money
  and changes nothing we charge or invoice, so no `/accounting` pass.

## Parts

**Part 0: PM summary and task list** (blocking). Present the summary above, the five push-backs, and the task list. Wait for the
owner's answers to push-backs 1, 2, 4 and 5 before Part 2 (3 is a correction, not a question). If the owner is not reachable in the
chat, build the recommended defaults and list them under "Defaults taken" in the Progress block.

**Part 1: the pure module and its tests.** `lib/house-league-start-from.ts` (no I/O), after `lib/season-carry.ts`: the year-bump
of a name; the date shift for all five dates (date part only, time suffix kept, nulls stay null); the born-year delta; the option
lines; the "what came across" line (`mk.line`: names only what was ticked, practice settings never listed, "settings, 4 age groups,
22 team names and 31 coaches"); the per-line fingerprints; the live-source rules. Tests pin: the s15 table (all five dates, all four
born-year pairs), a year-number-versus-elapsed case, a leap-year source, a name with zero/one/two years, an edited first day, a
live source, a source with no dates, plurals (`pluralize`), the possessive in the dates sentence, every string in §14.1 verbatim.

**Part 2: the migration (432 or higher) and the dictionary.** `league_seasons.started_from jsonb null` (name it better if the dictionary asks).
Update `DATA_DICTIONARY.md` (the column, and gotcha 6's stale slug line), run `npm run refresh:snapshots`, add the prod step to
`MANUAL_PROD_STEPS.json`, run `npm run check:dictionary`. Dev only; prod is the owner's step.

**Part 3: the server.** (a) A read for the picker: the club's seasons with age-group and team counts (extend the list GET or add a
route under the gate guard's first-call rule), and for a picked **finished** source the owing count and amount (the same figure the
Overview's "Still owing" tile reads; find it, do not recompute). (b) `startFrom` on the create POST (or a sibling route with the same
gate): validate the source belongs to this org and the caller is a league runner (`'run'` gate, then the source's `org_id`); run the
existing cap check first; build the season row with every copied column; insert; then divisions (remapping ids), teams, practice
settings and, if ticked, coaches; **on any failure delete the new season and return the error**; write `started_from`. Obey the
free-floor division and team caps if the floor is ever on (field absent in the UI, but the server must not be the only thing
holding that line: refuse a `startFrom` for a free-floor org with the plain 403 the other routes use). A direct request must not be
able to copy another club's season. Same slug and 409 words as today. The platform event for the free floor stays as it is.

**Part 4: the window.** Desk (640 wide) and phone sheet per s13/s14, in the order: Start from, statement, Name and Sport, Season
dates and hint, Bring with it, Always starts empty, foot. The dialog gains a `startFromId` prop (the rare door presets it) and the
house-league home passes the most recent season when it opens from its own button. The phone shortenings (shorter hint, shorter
checklist sub-lines, shorter always-empty line, foot sentence above the buttons) are in §10 and §14.1. Every date through
`formatStoredDate`; every possessive through `possessive()`; the clock "8:00 a.m." through `formatTime()` if one ever shows. Run
`npm run check:layout` on the window at 360, 390 and 768 (changed screens only, on the dev server).

**Part 5: the Overview.** (a) The rare door `door.start` on every season except Getting ready, gated like Reopen (`canMove`), ordered
**Start next season** then **Reopen**; a past-its-end running season shows it below the Next step card (edge 5). (b) On a copied
season while Getting ready: the banner `mk.line` (phone shortened), the marks `mk.from` and `mk.moved` on the lines whose
fingerprint still matches (`mk.moved` only when the dates moved and the registration-dates fingerprint matches; `mk.ageLine`
desk-only), and the no-club-time note. A registrar or treasurer sees none of the door. A season not started from anything shows
nothing new.

**Part 6: checks and finish.** Focused tests; `npm run typecheck` (shared lib, route and schema changes); `npm run verify:changed`.
Update the existing assertions that read the doors and the dialog (`house-league-season-page.test.ts:175`,
`house-league-home.test.ts`, `house-league-season-delete.test.ts:89`, `league-season-slot.test.ts`) rather than loosening them.
Then offer, once each and in this order: `/simplify` (a new pure module plus a route extension is the shape), `/review`
(high-risk: new route logic, a migration, a cross-org read), `/docs` (the house-league help: Create a season, Start next season, the
marks, who sees the door), and `/strategy` only if the owner rules 9f·16. Do not commit until the owner says. Write the walk
(ledger §450, one purpose, with a fixture that gives a throwaway club a finished season with four age groups, 22 teams, coaches and
an owing family, plus a running one) and the prod-step list.

## Walk outline (for the walk-writing step)

A the door and the window open (Create season; the rare door on a finished, running and Getting-ready season; absent for registrar
and treasurer) · B the picker (order, second lines, blank season, phone drawer) · C the statement and the owing clause (finished vs
running source) · D dates and name (52 weeks, weekday, edited first day, name with no year, taken name) · E Bring with it
(defaults, counts, unticking age groups, coaches off) · F the new season (Getting ready, banner, marks, tick states, club-time note,
Open registration still asks, nothing emailed) · G what did not come (no families, payments, ratings, games, practices; the source
unchanged) · H a running source (dates empty, chips) · I the coaches ticked case (nobody invited until Publish teams) · J a phone ·
K put back.

## Files you will touch (verify; do not trust)

`lib/house-league-start-from.ts` (new) · its test · `supabase/migrations/<next>_*.sql` · `docs/agents/db/DATA_DICTIONARY.md` ·
`supabase/migrations/MANUAL_PROD_STEPS.json` · `app/api/admin/house-league/seasons/route.ts` (+ a read) ·
`components/admin/kit/club/CreateLeagueSeasonDialog.tsx` · `app/[orgSlug]/admin/house-league/page.tsx` ·
`app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx` · `lib/house-league-status-words.ts` (the door and the window's
strings) · `lib/house-league-season.ts` (types for `started_from` and the fingerprints, if they live there) · `lib/types.ts` ·
`lib/help-content/house-league.tsx` · TODO.md, plan §0j, this file's Progress block, ledger §450.
