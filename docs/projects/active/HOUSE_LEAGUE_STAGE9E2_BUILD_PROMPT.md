# House League Stage 9e-2: Rainout (build prompt)

> **Written 2026-11-02**, after 9e-1 landed (`01e3990be`, walk §442 passed 33/33). **Paste this into a new chat on `dev`.**
> **Recommended model: Opus 5.5, one session.** Size M: an all-or-nothing database step, a new route, one window, the family email.
> Reading and searching go to helpers (they stay on Sonnet).
>
> **Binding, do not reopen (plan `HOUSE_LEAGUE_STAGE9_PLAN.md` §0i, owner 2026-11-01):** 9e·10 (a Rainout button on the schedule
> header; **games only**; tonight's practices are named and pointed to where they change), 9e·11 (Postpone is the default, Cancel is a
> choice; no make-up date in the window), 9e·12 ("Email the families now" ticked by default; one email per family **per division**,
> coaches copied; untick holds the changes in Changes to send), 9e·13 ("Put all back" only while held, all-or-nothing; after a send
> no Undo, and the result says emails can't be taken back), 9e·14 (one optional line, 120 characters, near the top of the email and
> the coach copy). Rulings carried from earlier: 9d2·2, 9d2·13 (scores and notes never email), the urgent send never counts toward
> the cap (Q12c), a postponed game keeps its date.
> **Not this build:** 9e-3 coach scores, 9f "Final standings", a make-up-date picker, any change to a practice (the window only
> names them), any new email kind.
> **Words:** `HOUSE_LEAGUE_STAGE9E_COPY.md` **Part C (§10–§12)**, accepted by the owner 2026-11-01 as written, including the
> recommendation on each §14 question (§14.2: the line is kept with the held changes and sent at the later send; the Put-all-back
> banner sits at the top of Changes to send). Build with those strings; keep every string in one place.
> **Drawings:** https://claude.ai/artifact/V9exKafSgmHc3XuFFar5Qo (the **Rainout** tab; source `HOUSE_LEAGUE_STAGE9E_DRAWINGS.html`).
> **It adds one migration.** `ls supabase/migrations` right before you create it: on 2026-11-02 the highest on disk is **426**
> (another session's, untracked), so the next is **427** — peers take numbers the same hour.
>
> Re-verify every lead below before building on it: other sessions share this working copy. Stage explicit paths only, commit only
> your own hunks, check `git diff --cached --name-only` before every commit, **commit only when the owner says**.

## The plan gate (9e·15) — DECIDED 2026-11-02 (owner accepted)

`/strategy` logged it 2026-11-02 (`BUSINESS_DECISIONS.md`, top entry; the Facts doc has the inclusions line). Build to it:

- Standings, coach scores and the Rainout ride **house league as a whole** — League Plus, Club, Club · Association — identically,
  **never an upgrade lever** between League Plus and Club. **No new feature key. No plan, lock, price or upgrade wording anywhere**
  in the window, the result or the email.
- The Rainout route additionally checks the **existing `bulk_reschedule` plan feature** on the server (`hasPlanFeature`), and the
  button is **absent** (not upsold) where it fails. Every paid house-league plan passes it by the rank ladder; only the parked free
  League floor (`plan_id='tournament'`) would fail. Do **not** show `bulk_reschedule`'s own upsell sentence — it names Tournament Plus.

## What a person sees after this build (for the UX summary — present it before any code)

- **A league admin, owner or admin** (not the registrar, treasurer or a coach; not on a finished season) sees a **Rainout** button
  on the Schedule header beside Changes to send. It opens a window: the day (today by default, or another day that still has
  games to play), what happens (Postpone is the default; Cancel is a choice), which games (all places, or one place; each
  published division with its games ticked; a draft division says it is a draft and lists none), an optional line for the email,
  and "Email the families now" ticked. A summary line under the list always says what the press will do ("12 games, 24 teams,
  3 divisions. 214 emails to 208 families, sent as 3, one per division…") and that practices aren't changed here, naming how many
  use the club's time and how many were booked by hand (cancelling a hand-booked one emails no one).
- **Press with the tick on:** the games change, one email per family per division goes out, the teams' coaches get a copy, and a
  result sheet says what went and that emails can't be taken back.
- **Press with the tick off:** nothing is sent; the changes wait in Changes to send, a banner there reads "Rainout on {day}: {12
  games} postponed, waiting to be sent" with **Put all 12 back**. Put-all-back is all-or-nothing and works only until the changes are sent.
- **Families:** the existing "Games changed" email, with the club's own line (if typed) at the top, unedited. A rainout adds no other
  sentence. Postponed games show on the public schedule as before.
- **Role differences:** only the people who can run a live season press it; a registrar sees no button.

## Code facts (checked 2026-11-02 by a helper, the key ones re-read by the writer — re-check before relying)

1. **There is no bulk status writer and no bulk undo.** The one game writer is the PATCH
   `app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts` (stale guard = `body.seen` + `updateLeagueGame(gameId,
   patch, game.updated_at)`, a conditional write; a cancel or postpone skips the booking and placement rechecks). Per-game undo is
   `schedule/[gameId]/undo/route.ts` → RPC `league_game_undo` (mig 409, replaced by 413): restores the earliest held `before`,
   deletes the held rows; refuses `played`, `nothing` (already sent or undone) and `club` (413). **A rainout needs a new route and a
   new all-or-nothing database function** (the press) **and** a bulk put-back — loop-over-`/undo` is not all-or-nothing.
2. **Recording is a trigger.** `league_games_record_change` (mig 409 ~149–208) writes `league_game_changes` rows (kind `postponed` /
   `cancelled` …) **only when the game's division has `schedule_published_at`**; a held change is a row with `sent_at IS NULL`.
   There is **no hold flag**: not sending is the hold. **A draft division records nothing and emails nobody** — which is why the
   drawn window lists no games for a draft (`rain.draft`); a draft division's games are excluded, never postponed.
   A guard test forbids app code from inserting/updating that table or writing `moved_from` — go through SQL functions.
3. **Send.** `sendChangesAndTell({org, season, divisionId, actorId, changeIds})` (`lib/league-schedule-mail.ts` ~363) → SQL
   `league_division_changes_send` (mig 409 ~335–395): advisory lock per division; `p_changes` must be **every** held row of the games
   it names or it answers `changed`; one `games_changed` notice per division; one `league_schedule_emails` row per distinct guardian
   email; coaches' copy via `copyCoaches`; service-mode sender `sendFamilyServiceBatch` with kind `house_league_games_changed`
   (never counted toward a cap). **So one email per family per division is already native, and a family with children in two
   divisions already gets two.** A rainout send is **one call per division**, with that division's affected games' held rows.
   The urgent path in the game PATCH (`sendNow`, ~216–235) is the model: save first, send after, a refused or failed send leaves the
   change held and says so. Reuse these; do **not** add an email sender or an email kind (`family-email-guard.test.ts`).
4. **The 120-character line has no home.** `scheduleEmailWords` (`lib/league-schedule-email.ts` ~74–97) takes no note;
   `league_season_notices` (mig 385) was found to have no text column (re-check). The email body is **rebuilt from the stamped rows at
   send time**, so a held rainout's line must be **stored**, not passed in memory, and read by whichever press finally sends it
   (this window's, or the Changes to send "Send the changes" a day later). Thread it through `sendHeldChanges` → `noticeFacts` →
   `wordsFor`. Put it in the new migration (see Part 1).
5. **The schedule header** is `AdminPageHeader` `actions={…}` in `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx`
   (~1358–1397): health button, Publish, Changes to send (shown when `divHeld > 0`). The page is **division-scoped**
   (`selectedDivId`); the rainout window spans divisions, so it takes its own read of the season's games, not `divGames`.
   Game doors: `gameWindowDoors(status, published)` in `lib/league-season-calendar.ts` (~358). A postponed/cancelled game **keeps its
   `scheduled_at`**; postponed games list under "Needs a new date" (page ~1435).
6. **Practices.** `league_practices` (`team_id`, `status`, `scheduled_at`, `club_schedule_slot_id`); a row with the slot id is the
   club's, refused by the practice cancel with `from_club`. There is no "tonight" lister: filter by the **org-zone day**
   (`lib/timezone.ts` `utcToZonedInputs` / `orgDayKey`; `ORG_TIME_ZONE` America/Toronto). Hand-booked cancel =
   `practices/[practiceId]/route.ts` PATCH. The window **reads and names; it writes nothing to practices**.
7. **Gate.** `houseLeagueRefusal(ctx, 'run')` before loading the season, then `houseLeagueRefusal(ctx, 'run', season)` after
   (`lib/house-league-gate.ts`; a finished season → 423). `run` = owner, admin, league_admin on a live season. The page's
   `canManage` is the client twin. `isScheduleBuilder` is not needed (only status is written).
8. **Guards a new route must satisfy** (`tests/unit/house-league-gate-guard.test.ts` picks up every `route.ts` under
   `app/api/admin/house-league`): `export const POST = withObservability(`, no role literal / `.role` / `hasCapability` /
   `hasModuleEntitlement` / `canOpenModule`, first gate `houseLeagueRefusal(ctx, '<action>'` (not `read` for a non-GET), the variable
   named `season` on the second call. Also `league-game-changes-guard.test.ts` (no direct writes to the changes table; the advisory
   lock pinned in SQL), `house-league-game-window-guard.test.ts`, `league-game-undo-route.test.ts` (uuid validation before the RPC).
   Cross-tenant: `getLeagueSeasonById(seasonId, org.id)`, every posted game id must belong to the season (`.eq('season_id')`),
   division scope via `divisionInSeason` (`lib/league-season-scope.ts`).

## Build decisions the prompt makes (say so in your report; the owner can overrule)

- **Which games are listed:** `scheduled` games (not completed, cancelled or postponed) in **published** divisions, for the chosen
  day (the org-zone day of `scheduled_at`). A day appears in the picker only if it has at least one. Draft divisions: the `rain.draft`
  line, no games.
- **The press is all-or-nothing in one database function:** it takes the game ids with the `updated_at` the window saw, locks the
  affected divisions in a fixed order (sorted ids; as Send does), refuses `changed` if any game moved on (`rain.err.changed`, nothing
  written, ticks kept), writes the status for all of them (the trigger records the changes with source `league`), and stores a
  **rainout record** (day, verb, the optional line, the games and the divisions) so "Put all back" and the banner have a set to act on.
- **Send after the save, per division,** as the urgent path does. Division results: told / failed. All told → `rain.done.*`. Some
  failed → `rain.fail.some` (the failed divisions' changes stay held); all failed → `rain.fail.all`. Pressing again for a division
  already told sends nothing (`rain.fail.again`).
- **Put all back** = a second database function, all-or-nothing: it restores every game of the rainout **only if every change is still
  held and unchanged** since; otherwise refuses (`rain.back.refused`) and the admin undoes one at a time in Changes to send. It calls
  the same logic as `league_game_undo`, not a copy of it. After a send it answers `rain.back.gone`.
- **The banner** sits at the top of Changes to send and persists across days while the rainout's changes are held.
- **The line** is stored on the rainout record and read at send time by **any** press that sends those rows. A line is the club's
  words, delivered verbatim with no review step — `HOUSE_LEAGUE_STAGE9E_COPY.md` §12 "For owner sign-off" #1; say it again in the UX
  step and the owner CONFIRMED 2026-11-02 that an unreviewed line is OK (no preview), so do not build one.
- **Counts in the summary line** ("214 emails to 208 families, sent as 3, 6 get two") come from the same family logic Changes to
  send uses (`familiesFor`, the changes GET route), not a second count.
- **No new email kind, no new sender, no cap change.** The email body is the existing Games changed email plus the optional line.

## Parts (build in this order; stop and update the Progress block after each)

**Part 1 · The database (migration 427, check the number).** Header style of migs 409/412/413 (BEGIN/COMMIT, `IF NOT EXISTS`,
`COMMENT ON`, "Apply BEFORE promoting the code that reads it", a Verify block). A rainout record table (service-role only, RLS on, no
anon read — `league_teams` is anon-readable; put nothing new there) with the line; the press function; the put-all-back function;
the line made readable by the send. Apply to **dev only**; prod is the owner's step before a promote (follow what migs 409/413 did
about `MANUAL_PROD_STEPS.json`; `check:migrations` is the gate). Dictionary: new table + columns + the new functions' meaning
(`npm run check:dictionary`); `npm run refresh:snapshots`. Prove it on dev with a rolled-back SQL fixture before any screen.

**Part 2 · The pure planning function.** `lib/league-rainout.ts` (or the nearest sibling's style): from the season's games, divisions,
practices and a day → the day picker's options, the divisions/games list, the summary counts, the practice lines (club vs hand
booked, today vs another day). Words in one place (`RAIN_WORDS`). Unit tests: 12 games across 3 divisions; one division; a draft
division; a day with none left; a game already postponed/cancelled/completed excluded; a family with children in two divisions
(counted twice); no families; practices today / another day / none; singular forms.

**Part 3 · The routes.** (a) A read for the window (days, games, counts, practices) behind `houseLeagueRefusal(ctx,'run')`;
(b) the press (POST: verb, game ids with `seen` stamps, the line ≤120 characters, `emailNow`); (c) put-all-back (POST). Server
validates: the verb, the length, every game in the season and `scheduled`, division published, `bulk_reschedule` present. Tests:
the gate guard picks them up; add a route test in the style of `league-game-undo-route.test.ts` (uuid validation, 409 `changed`,
refusals, the line's limit, a draft division's game refused).

**Part 4 · The send and the line.** Thread the line through the send (`sendHeldChanges` → notice facts → `wordsFor`) so the family
email and the coach copy carry it (`rainMail.line`, `rainMail.line.coach`; nothing added when empty). Pure-logic tests for the email
words with and without the line, held-then-sent-later, and a second send of the same rows reading the same line.

**Part 5 · The window and the result.** Header button, the window (desk and phone per the drawing), the live summary under the list,
the practice lines, the line field with its counter, the tick, the three results (told, partly failed, held), the banner and the
Put-all-back confirm in Changes to send. Wear the shipped kit/dialog components the neighbouring schedule windows use — no inline
styles, no pills for a choice that is a switch; check the new CSS against the repo's token/selector baselines.

**Part 6 · Checks, help, hand-off.** Run `/docs` (the rainout recipe + the keywords in COPY §15) rather than hand-writing. Focused
tests; `npm run verify:changed`; `npm run typecheck` (shared modules; the 8 GB heap). `check:spelling` by eye on COPY §16 ("cancelled"
two Ls, "families" not "households", `formatTime()` for every clock, no plan name or price). Restart the dev server before handing
off (new files, a migration). Then `/simplify`, then `/review` (the database function, the send, the public data). Browser testing is
the owner's: write the walk as a checkable Artifact (one purpose), fixture with a published division with games today, a second
published division, a draft division, a family with children in two divisions, a hand-booked practice and a club-slot practice;
add it to the Owner QA Ledger (never sort the § numbers) and the TODO line.

## Shared-file traps

- `lib/db.ts`, `lib/types.ts`, `lib/league-schedule-mail.ts`, `lib/league-season-calendar.ts`, the schedule `page.tsx` and the
  dictionary are shared and often carry other sessions' hunks: edit narrowly, commit hunk-by-hunk from a hand-built blob (a `-U0`
  partial commit misplaces insertions).
- The game PATCH's `sendNow` and Changes to send already exist: extend them, do not fork them.
- A page with many divisions and hundreds of games: read the season once; division is a client scope.
- Dev has no house-league time and few families: prove the counts with a rolled-back SQL fixture, as 11b Part 4 did.

## ▶ Progress (read first when resuming)

- **UX step done 2026-11-02:** owner confirmed the plan gate as recommended (button absent where `bulk_reschedule` fails, no
  upgrade wording) and the line sent as typed, no preview.
- **Part 1 DONE 2026-11-02:** mig **427** `427_a_rainout_calls_off_a_day_in_one_press.sql` (table `league_rainouts`; functions
  `league_rainout_press`, `league_rainout_refusal`, `league_rainout_put_back`, `league_rainouts_waiting`). Applied to dev;
  proof `scripts/house-league-9e2-rainout-check.sql` T1–T12 pass (rolled back). Dictionary + MANUAL_PROD_STEPS entry written.
  ⚖ Deviation from the prompt: Put all back is **not** Undo's logic — Undo would also throw away an older held change on the
  same game; Put all back restores each game's status from its rainout row only (identical to Undo when the rainout is the
  game's only held change). ⚖ The line is found at send time through `change_ids` (no change to the send function or the notice
  table): the mail code reads `league_rainouts` overlapping the sent rows.
- **Part 2 DONE:** `lib/league-rainout.ts` (plan + `RAIN_WORDS`, every Part C string) + `tests/unit/league-rainout.test.ts` (17).
  ⚖ Days = today and later only (an earlier unscored game is a missing score, not a rainout).
- **Part 3 DONE:** `schedule/rainout/route.ts` (GET read, POST press) + `schedule/rainout/[rainoutId]/route.ts` (POST
  `back` | `send`); `lib/league-rainout-server.ts` (source read, line lookup, waiting list), `lib/league-rainout-send.ts`
  (one `sendChangesAndTell` per division); the changes GET gains `rainouts` (the banner). Test
  `tests/unit/league-rainout-route.test.ts`; gate/changes/family-email guards pass. ⚖ The held sheet's "Send the changes"
  sends the rainout (action `send`) rather than opening Changes to send.
- **Part 4 DONE:** the line threads `noticeFacts` → `wordsFor` → `scheduleEmailWords({ note })` → `paragraphs` →
  `leagueScheduleNoticeHtml({ paragraphs })`; the coaches' copy body and `changesSample` carry it. ⚖ The line lookup NEVER
  throws (rain news without the line beats rain news that waits); same for the banner read. Tests in
  `league-schedule-email.test.ts`; SQL T13 proves held / sent-later / second send read the same line.
- **Part 5 DONE:** `components/admin/kit/club/league/schedule/RainoutWindow.tsx` (+ `Rainout.module.css`, tokens only):
  Day select, Postpone/Cancel as `SendRows` radios, games in the shared `FormTable` with a box per division (mixed when
  some), the closing row = `rain.sum`, the mail line in `Statement`, practices line, `CheckChoice` email tick, the line
  field + counter; results told / some failed / all failed / held, Put all back confirm. Banner = `Callout` at the top of
  `ChangesToSendWindow` + its own confirm. Page: `btn-outline` Rainout button (word kept on a phone), `canRainout` =
  runner + a published division + `hasPlanFeature(bulk_reschedule)`; `NeedsDateFold` gains `startOpen` for "Give them new
  dates". Drawing deviations (say in the walk): the phone has no "4 of 4 ›" drill-in (the form table's phone bands list
  every game); no desk collapse ("4 more, all ticked"); places are the white-track switch (≤ 2 places) or a dropdown,
  never pills; "Practices" is not a link (hand-booked practices live on this schedule); the button counts FAMILIES.
  typecheck clean; lint clean on new code; `team-move-coverage` gains `league_rainouts` (STAYS). Other failing tests in
  `npm test` belong to other sessions' uncommitted work (support console foot, billing free time, Stage 6 walk, stripe-mode
  prefix in an untracked seed script).
- **Part 6 so far (2026-11-02/03):** `/docs` → new sub-topic `recipe-generate-house-league-schedule-t-rainout` + FAQ
  `faq-house-league-rainout-undo` + COPY §15 keywords/searchText (`lib/help-content/house-league.tsx`). `/simplify`
  applied: SQL press checks the DAY too; `league_rainouts_waiting(org, season, division?)` returns `division_ids` (one
  call); the send reads its rows once (`sentChanges` → `sentNets` + `rainoutLinesFor` in parallel; `rainoutLinesOfNotice`
  gone); `familiesFor`/`teamsHearing` reused; `RainoutParts.tsx` (`PutBackQuestion`, `rainoutAction`) shared by both
  windows; `RainSendDivision`/`WaitingRainout` in the pure module; memoized lists; "Give them new dates" picks the division.
  `/review` (high-risk, 4 lenses, nothing Critical/High) fixed: undelivered emails now say "Reached N of M families"
  (`missed`); 409 re-read keeps only ticks still listed and falls back to an open day; press recounts games after its row
  locks (a game deleted while waiting → `changed`); 40P01 → 409; malformed entries/stamps → 400; a past day → 409;
  put-back re-read scoped + NOT FOUND; both waiting signatures dropped (re-runnable); "0 postponements" fallback; send of
  a put-back rainout says so. SQL proof T1–T14 pass. **Not fixed, by design / disclosed:** the line rides the whole
  division's email when a held rainout is sent with unrelated changes (told to the owner at the UX step); Put all back
  skips the booking re-check (as Undo does); the banner is not plan-gated (no customer loses the feature).
- **Part 6 DONE 2026-11-03:** dev server restarted (login 200). After `/review`, the told result counts the families the
  send WROTE (Changes to send's "Sent to N"), not those delivered (dev has no email key; delivery failures show as
  "Reached N of M families"). Walk published https://claude.ai/artifact/3CrozfbYHrPAwYqwQF5b9F (source
  `HOUSE_LEAGUE_STAGE9E2_WALK.html`, 38 steps, fixture `.probe/9e2-walk/fixture.mjs`, left built for 2026-11-03); ledger
  §445; TODO line updated. **Committed `4528b4a2d` 2026-11-03** (own hunks only; the schema snapshots are not in it —
  the working copy's refresh also carried the 9e-3 session's mig 428, so they ride with that session's next refresh).
  **Owed:** the owner's walk, then mig 427 on prod before the promote.
