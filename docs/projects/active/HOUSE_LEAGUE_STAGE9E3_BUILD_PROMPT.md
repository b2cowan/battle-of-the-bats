# House League Stage 9e-3: Coach scores (build prompt)

> **Written 2026-11-02, while 9e-2 (rainout) is being BUILT in another chat on the same working copy** (its Part 1, mig 427, was
> done when this was written). By dependency 9e-3 needs only 9e-1 (`01e3990be`, the counted-game rule) — the rainout depends on
> neither — so the owner chose to run the two side by side. **Read "Running beside 9e-2" below before you touch a shared file.**
> **Paste this into a new chat on `dev`.** **Recommended model: Opus 5.5, one session.** Size M: one migration, two coach routes,
> one club route, the coach Scores section, the club game window's states, the "Scores to check" fold.
> Reading and searching go to helpers (they stay on Sonnet).
>
> **Binding, do not reopen (plan `HOUSE_LEAGUE_STAGE9_PLAN.md` §0i, owner 2026-11-01):** 9e·7 (the **home** team's coach enters the
> score, from the game's start time), 9e·8 (it counts at once; the club sees who entered it and a count of scores to check), 9e·9
> (the other coach can report it; the score stands; the entering side can change it until it is reported or the club touches it;
> the league admin corrects). Carried: Q7 / 9c·1 (a coach sees their own team only), 9d2·2 + 9d2·13 (**scores and notes never
> email**), Q16 (a finished season is locked), the both-or-neither score rule (9e-1), 9e·5 (standings off → the standings words
> are absent), 9e·15 (**no gate of its own**: coach scores ride house league as a whole; no plan, lock, price or upgrade wording).
> **Not this build:** 9e-2 rainout, 9f "Final standings", the away coach entering a different score (deliberately not drawn), a
> reporter withdrawing a report, any email or notification about a score.
> **Words:** `HOUSE_LEAGUE_STAGE9E_COPY.md` **Part B (§5–§9)**, accepted by the owner 2026-11-01 as written, incl. §14.1 (a coach may
> clear both boxes; `cs.win.clear` is the only guard). Build with those strings; keep every string in one place (a `SCORE_WORDS`
> object in the new module, not in `lib/league-season-calendar.ts` — see the shared-file section).
> **Drawings:** https://claude.ai/artifact/V9exKafSgmHc3XuFFar5Qo, the **Scores** tab (source `HOUSE_LEAGUE_STAGE9E_DRAWINGS.html`
> ~929–1108: c1 coach Scores section, c2 Enter the score, c3 Report this score, c4 the club's game window states + the fold,
> c5 what changes on save, c6 edge states).
> **It adds one migration.** `ls supabase/migrations` right before you create it: 9e-2 holds **427**, so expect **428** — peers take
> numbers the same hour.
>
> Re-verify every lead below before building on it. Stage explicit paths only, commit only your own hunks, check
> `git diff --cached --name-only` before every commit, **commit only when the owner says**.
>
> Before any code, present the Product-Manager UX summary the repo's rules require and the task list, **and put the three owner
> questions below to the owner** (they block Part 4's words, not Parts 1–3).

## ▶ Progress (read first when resuming)

- **Owner answers 2026-11-03 (all four as recommended):** Q1 Keep closes both coaches' doors, both read "The league admin
  checked this score."; Q2 no Report on a club score, coaches read "The league admin entered this score." (a correction keeps
  `cs.by.club`); Q3 keep "Sent to the league admin", no notification; **Q4 (added by the builder): "Keep {7–4}" shows on a
  Coach-entered score too**, not only on a Reported one (pencil → ✓ with no change also keeps).
- **Build decisions taken:** a club CLEAR deletes the record (the home coach can enter again); a draft division has no Scores
  list (server refuses `notFound`); a finished season lists its scores with no doors; a postponed/cancelled game (held or
  sent) is not listed in Scores; club-side lines always carry the date ("Jun 17 at 8:12 p.m."); a score write moves the
  game's `updated_at`, and (changed in /review 2026-11-03) so does a report, so a Keep can't pass an unseen report; report note ≤ 280.
- **Part 1 done** — mig 428 applied to DEV 2026-11-03; `scripts/house-league-9e3-scores-check.sql` T1–T16 pass; dictionary +
  MANUAL_PROD_STEPS entries; snapshots refreshed by the hook.
- **Part 2 done** — `lib/league-coach-scores.ts` (`SCORE_WORDS`, `coachScoreView`, `clubScoreLines`, `scoresToCheck`), 21 tests.
- **Part 3 done** — `lib/league-coach-scores-server.ts` (records, rpcs, `staffName`), `lib/league-coach-score-press.ts` (the
  coach preamble), coach `…/games/[gameId]/score` + `/report`, club `…/schedule/[gameId]/keep`; the game PATCH writes a score
  through `league_game_club_write` (`leagueGameRow` split out of `updateLeagueGame` in lib/db.ts); the schedule GET returns
  `scores`. 22 route tests; guards green.
- **Part 4 done** — the coach page's Scores section (`CoachScores.tsx` island + `CoachScoreWindows.tsx`, KitDialog `form`:
  520 at a desk (the house width, not 480), full screen on a phone with its foot in view); `readTeamScores` in
  lib/house-league-coach.ts reads the LIVE rows (a held rainout's game is not listed); toast fades; the page re-reads.
- **Part 5 done** — GameWindow: the tag (RepChip), the lines, the note, Keep · Correct (canRun), ✓-with-no-change = Keep;
  "Scores to check" fold (`ScoresToCheckFold`) beside "Needs a new date", above every view (as that fold is), division-scoped,
  its help as a line inside the fold (not a hover). Export: the house-league schedule export carries no scores — nothing to add.
- **Checks (2026-11-03):** typecheck clean; league/coach/window tests 3857 pass after fixing `house-league-game-window-guard`
  (pinned the old write line) and `team-move-coverage` (+ league_game_scores); new `league-coach-scores-guard.test.ts` (two
  readers of the record). The full `npm test` has 6 FOREIGN failures (billing free time, Stage 6 owner-walk summary, Stripe
  key prefix, platform-admin bookkeeping foot sentence). verify:changed's later checks: failures all foreign (admin old look,
  admin type, index coverage, org-slug callers, css selectors, export catalog, root files); schema parity lists
  league_game_scores only-dev (prod apply owed, as 427). ⚠ ESLint itself cannot start (react-hooks plugin missing in config) —
  focused lint NOT run.
- **Part 6 so far:** /docs done on `recipe-record-house-league-scores` (three new sub-topics `-t-coach`, `-t-report`,
  `-t-check`, COPY §15 keywords + searchText; spelling + help tests green). `lint:focused` on every changed file: 0 errors
  (warnings are db.ts's old `any`s). TODO line updated. 9e-2's commit `4528b4a2d` carried none of 9e-3's hunks; it left
  the schema snapshots for THIS build's commit to carry (they describe both 427 and 428).
- **Walk written 2026-11-03:** §447, https://claude.ai/artifact/GaS5fuhi4FRjpcXCBYGd4Q (source `HOUSE_LEAGUE_STAGE9E3_WALK.html`),
  35 steps A–F; fixture `.probe/9e3-walk/fixture.mjs` (ran clean on dev 2026-11-03). Owed by the owner.
- **/simplify done 2026-11-03** (finish-prompt Step 1): shared `isUuid`; one refusal table (`refusalResponse(r, names)`);
  `keep()` goes through the window's `write()`; parallel reads in the press, the schedule GET and Keep; the unread record
  fields (`enteredForTeam`, `reportedByName`, `reportedForTeam`) no longer ship to the browser; dead word keys removed.
- **/review done 2026-11-03** (high-risk, six lenses; none Critical/High). Applied: **a report now moves the game's
  `updated_at`** (mig 428 `league_game_score_report`, re-applied to DEV, proof T6b2) so a Keep or a coach's Change from a
  window older than the report is refused `changed`; scores are bounded 0–999 (`MAX_SCORE`) and `seen` must be a timestamp
  (a 400, not a 500); the coach window refreshes on `closed` and its Save is off when nothing changed; the club's Correct
  form shows the report text; the coach seat lookup also matches the user; `staffName` survives a failed name read; the
  privacy guard reads the bare table name; the "What a coach sees" help article now describes Scores. Left, with reasons:
  see the review report in the session summary (Undo race in mig 413, home-team swap on a scored game, the shared public-form
  throttle bucket, focus return after a save).
- **Committed `5e09022ee` 2026-11-03** (46 files; mig 428 applied to DEV only, prod `pending`, apply BEFORE the promote, after 423
  and 427; the schema snapshots in it describe 427 and 428). The owner's walk §447 ran before the review's changes and was marked
  WALKED, COMPLETE 2026-11-03 on the owner's word (Part D had no ticks; its eight steps are closed by that word). The dev-server restart (new files and
  a changed database function) is still owed, asked first because 9e-2's walk may be using it. The dev-server restart
  (new files + mig) is still owed before the walk: ask first, 9e-2's walk §445 may be running on it.

## Running beside 9e-2 (the rainout) — the collision points

| Shared thing | 9e-2 does | 9e-3 does | Rule |
|---|---|---|---|
| Migration number | 427 | 428 | `ls` first; never renumber theirs |
| `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` (client, ~1680 lines) | Rainout button in the header (~1358–1397), banner/put-back in Changes to send | the "Scores to check" fold after "Needs a new date" (~1436) | narrow Edits only, re-Read the hunk right before each edit (their lines move); commit hunk-by-hunk |
| `lib/league-season-calendar.ts` | may add words | **do not add here** — words live in the new module | |
| `lib/types.ts` `LeagueGame` / `lib/db.ts` `mapLeagueGame` | likely untouched (separate rainout table) | **untouched** — the score record is its own table (fact 3) | |
| `docs/agents/db/DATA_DICTIONARY.md`, `MANUAL_PROD_STEPS.json`, snapshots | their table + functions | your table + functions | edit your own section; snapshots refresh is shared — re-run after theirs lands |
| `lib/help-content/house-league.tsx` | rainout recipe | `recipe-record-house-league-scores` (9e-1 rewrote it) | different articles, same file: hunk-by-hunk |
| TODO.md, ledger, plan §9 | their lines | your lines | own lines only |
| Game PATCH `schedule/[gameId]/route.ts`, `GameWindow.tsx`, `SeasonScheduleViews.tsx`, the coach page + `lib/house-league-coach.ts` | not touched (they add a sibling rainout route) | yours | if `git diff` shows a foreign hunk there, stop and say so |

**Where the two features meet (build for it, test it):**
- A rainout lists only `scheduled` games, so a game a coach has scored is never rained out. A coach score write must bump
  `league_games.updated_at` so a rainout window opened before the score refuses with its own `changed` (their stale guard).
- **A held rainout is not yet on the coach's schedule** (the coach page reads games *as last sent*). The Scores section must take its
  doors from the **live** row: a game postponed or cancelled, held or sent, has no "Enter the score" door, and the server refuses it
  (`err.calledOff`). Otherwise a coach sees "Enter the score" on a game the club rained out an hour ago.
- "Put all back" restores status `scheduled` on games that never had a score — no interaction with the score record.
- Run both features' focused tests before each commit; a typecheck run picks up the other session's half-built files — read the
  error's path before treating it as yours.

## Owner questions (put them in the UX step; recommendations marked)

1. **What does a coach read after the league admin presses Keep (checked, unchanged)?** The ruling closes the coach's change door
   when "the club touches it", and Keep is a touch — but Part B has no coach-side words for a kept score (`cs.by.me` would then be
   false). **Recommended:** the door closes and both coaches read one new line, "The league admin checked this score." (a `/marketing`
   word, owner to accept); the away coach's Report door also closes once the club has looked.
2. **Can the away coach report a score the league admin entered?** Not drawn. **Recommended: no** — Report is for a coach-entered
   score the club hasn't looked at; once the club has entered, kept or corrected a score, the coaches read the club line and ask the
   league admin directly.
3. **"Sent to the league admin" (`rep.win.foot`) with no email or notification.** Scores never email (9d2·13), so a report reaches the
   league admin only as the "Scores to check" fold, listed first. **Recommended:** keep the words (the report does land in front of
   them) and build no notification; say it in the UX step so the owner can object.

## What a person sees after this build (for the UX summary)

- **The home team's coach:** the Scores section on their team page (replacing "The club enters scores for now.") lists the team's
  started games, newest first: a game with no score yet has **Enter the score** (from its start time, even when it was yesterday's);
  a scored game reads **Final 9–3** with who entered it. Saving counts it in the standings at once (or shows on the schedule, when
  the division's standings are off). They can change or clear it until the away coach reports it or the league admin looks at it.
- **The away team's coach:** sees the same games; "Twins’ coach enters the score." until there is one; then the score with
  **Report this score** (an optional note, "What should it be?"). The score stands; they read that the league admin will look.
- **A coach of both teams** counts as the home coach (no Report door on their own score).
- **League admin / owner / admin:** the game window shows **Coach entered** or **Reported** with who and when (and the note);
  **Keep 7–4** or **Correct the score**; pressing ✓ with no change marks it checked. The schedule List gains a **Scores to check**
  fold (reported first), absent at zero. A score the club enters or corrects closes the coaches' doors. A registrar sees the tags and
  the fold read-only (they can read the schedule today) and no Keep / Correct.
- **Families:** nothing new arrives. The public schedule and standings show the score as soon as it is entered; who entered it and
  any report are never public.
- **A finished season:** no doors anywhere (Q16).

## Code facts (checked 2026-11-02 by helpers, the key ones re-read by the writer — re-check before relying)

1. **Coach page.** `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx` is a server component; the Scores section is ~99–111
   (9e-1's standing line, then the stub `<p className={kit.sub}>The club enters scores for now.</p>` ~110). `readCoachTeamPage`
   (`lib/house-league-coach.ts` ~187–238) reads `league_team_coaches` for this user + team first, then games only when the view is
   `open` and the division is published. **`readTeamGames` (~267–280) keeps only games from the start of today (plus postponed and
   undated), each as last SENT — the started games a score needs are dropped.** Add a second, separate read for the Scores section
   (every started game of the team's season, LIVE row + its score record); do not widen the Schedule's read.
2. **Coach access.** `houseLeagueCoachAccess` (`lib/house-league-access.ts` ~149–161) → `none | gone | open | finished | ended`
   (needs `accepted_at`; `removed_at` → `gone`; finished season → `finished` then `ended`). A coach is not an org member:
   **never `houseLeagueRefusal` on a coach route.** The model coach route is
   `app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/calendar-link/route.ts`: uuid check, `getAuthenticatedUser`, the user's own
   link + the team read, org/season slug match, `houseLeagueCoachAccess(...) === 'open'` else 404, and its POST calls
   `throttlePublicForm(req)` first. The coach page's Subscribe window is the model for a client window on a server page.
3. **`league_games` is anon-readable, every column** (mig 020 ~229, policy "public can read games of active seasons", never dropped).
   So **who entered a score, the reporter, and the note must NOT be columns on `league_games`** — they go in a new service-role-only
   table (RLS on, no policies), as 9d-3's `league_team_practices_told` did. Scores stay where they are (`home_score`, `away_score`,
   `status`).
4. **Today's score write.** Club only: the game PATCH `app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts`
   (`'run'` twice ~48/54; `invalidGamePatch` ~62; stale guard `body.seen` ~68–71; scores ~129–130; `scoreRuleStatus` ~134–138; write
   `updateLeagueGame(gameId, patch, game.updated_at)` ~212, a compare-and-set). `lib/league-game-patch.ts` (`scoreRuleStatus` ~23,
   `invalidGamePatch` ~40). **Reuse the same rule for the coach path** (both-or-neither, whole numbers, both empty → back to
   scheduled); do not write a second copy.
5. **No change is recorded for a score.** `league_games_record_change` (mig 409 ~149–217) returns early unless when/where/public
   state changes, and `scheduled`/`completed` both map to public state `on`. So a score never lands in Changes to send and never
   emails — keep it that way (the guard test forbids app writes to `league_game_changes`).
6. **Club window + fold.** `components/admin/kit/club/league/schedule/GameWindow.tsx` (local `scoredGame` ~268, score inputs
   ~368–376, `seen` ~209/243); `lib/league-season-calendar.ts` (`resultWords` ~88, `needsDate` ~132–183, `gameWindowDoors` ~358,
   `asksScores` ~377 — started or completed, reuse for "from the start time", `scoresToSave` ~385, `GAME_WINDOW_WORDS` ~393).
   `NeedsDateFold` in `SeasonScheduleViews.tsx` ~245–261 is the recipe for "Scores to check". The page loads games via the admin
   schedule GET (`schedule/route.ts` selects `*`; the registrar can read it) — return the score records beside the games from that
   read or a sibling GET under the same `'read'` gate; Keep / Correct are `'run'`.
7. **Guards a new route meets.** Coach routes go under `app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/…`, **never
   `app/api/coaches`** (`house-league-coach-read-guard.test.ts` forbids `league_team_coaches` there; it also pins
   `readCoachTeamPage`'s read order — update it, don't delete it). `league-season-scope-guard.test.ts` ~186–200: every POST under
   `app/api/league/[orgSlug]` calls `throttlePublicForm(req)` before its first await. `house-league-place-guard.test.ts` scans
   `app/api/league`. The club route goes under `app/api/admin/house-league/…` and meets `house-league-gate-guard.test.ts`
   (`withObservability`, no role literal, first gate `houseLeagueRefusal(ctx, 'run'`, second with `season`).
8. **Precedent only:** the tournament's score submission (mig 068 `games.score_submitted_by_*`, `'submitted'` status) — borrow the
   column naming, nothing else.

## Build decisions the prompt makes (say so in your report; the owner can overrule)

- **One record per game** in a new table (name it in the house style, e.g. `league_game_scores`): who entered (user id **and the name
  as it read then**, so a removed coach's entries keep their name), when, the side (`coach` / `club`), the team the coach entered for;
  reported by (user, name, team), when, the note (≤ 280 characters; COPY §14.3 has no limit — if you add a counter, reuse the
  rainout's "{n} left"); checked by / when; corrected by / when. No row = a score the club entered before this build, or none.
- **"The entering side" is the home team's coaches**, not one person (drawn edge: two coaches on one team, the later change wins
  while unreported; the stale guard protects a stale window).
- **All-or-nothing in one database function per action** (coach enter/change/clear, coach report, club keep), each locking the game
  row, checking the `updated_at` the window saw, writing the game and the record together, and setting `updated_at = now()`. The club's
  existing PATCH stamps "entered/corrected by the club" when the scores change — make that stamp land with the game write (a function
  the route calls in place of the plain update when scores are in the patch, or an equivalent), never as a best-effort second write.
- **The Scores section lists every started game of the team's live season, newest first** (house-league seasons are small), with the
  live status deciding the door. Not started → not listed (it is on the Schedule).
- **No notification of any kind** (owner question 3).

## Parts (build in this order; stop and update the Progress block after each)

**Part 1 · The database (migration 428, check the number).** Header style of migs 409/412/413/415. The record table (RLS on, no
policies, FK to `league_games` ON DELETE CASCADE, one row per game); the functions above; `COMMENT ON` each. Apply to **dev only**
(prod is the owner's step before a promote, after 423 and 427; follow 409/413 on `MANUAL_PROD_STEPS.json`; `check:migrations`).
Dictionary entries (`npm run check:dictionary`); `npm run refresh:snapshots`. Prove each function on dev with a rolled-back SQL
fixture: home coach enters; away coach refused; before start refused; postponed refused; stale refused; report then change refused;
club keep then change refused; both empty → scheduled; a coach of both teams.

**Part 2 · The pure logic.** `lib/league-coach-scores.ts`: from a game, its record, the viewer (home coach / away coach / both) and
now → the row's state and door (`not started | enter | entered-mine | entered-theirs | reported-mine | reported-theirs | checked |
corrected | club-entered`), the club's tag (`Coach entered | Reported | none`), and the fold's list (reported first, then coach
entered, oldest first within each). `SCORE_WORDS` holds every Part B string. Unit tests over every state, the date-or-today time
rule ("Entered by Twins’ coach, Jun 17 at 8:12 p.m."), standings on/off variants, `possessive()`.

**Part 3 · The routes.** Coach: `…/team/[teamId]/games/[gameId]/score` (POST: `{homeScore, awayScore, seen}`) and
`…/games/[gameId]/report` (POST: `{note, seen}`), each: throttle, uuid checks, signed-in user, own coach link, `open`, the game in this
team's season and this team is home (score) / away (report), then the function; refusals map to COPY §9. Club: Keep under
`app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/` (`'run'`); the ✓-with-no-change in the game window calls the same
Keep. Route tests in the style of `league-game-undo-route.test.ts` (uuid first, 401/404, 409 `changed`, each refusal).

**Part 4 · The coach's screens.** The Scores section (server read + a small client island for the windows), the Enter/Change window
(desk window 480 wide, phone full-screen sheet with a foot that stays in view, 44 px controls), the Report window/sheet (phone: the
flag mark alone with its aria-label), toasts, the states. Wear the shipped kit dialog/sheet components the coach page's Subscribe
window uses — no inline styles; check new CSS against the token/selector baselines. After a save, the page re-reads (the standing
line moves too).

**Part 5 · The club's screens.** GameWindow: the tag + entered-by line, the Reported note, Keep / Correct, the checked / corrected /
entered lines; Correct uses the existing score boxes and save. The "Scores to check" fold on the List (desk + phone row) after
"Needs a new date". Registrar: read-only. Export: if the schedule export carries scores, decide whether "Entered by" joins it (say so).

**Part 6 · Checks, help, hand-off.** `/docs` on `recipe-record-house-league-scores` (COPY §15 keywords) rather than hand-writing.
Focused tests; `npm run verify:changed`; `npm run typecheck` (8 GB heap; foreign errors from the 9e-2 session are theirs — name them).
`check:spelling` by eye on COPY §16. Restart the dev server before the hand-off (new files, a migration) — **tell the 9e-2 session's
owner first if it is mid-walk**. Then `/simplify`, then `/review` (the functions, the coach routes' tenancy, nothing private on the
public read). Walk as a checkable Artifact, one purpose, with a fixture: a published division with a game started today (home coach
Morgan Reid on Reds, away Sam Blake on Blues — accepted dev coaches; `uat-hl-coach-*@uat-rep-club.local`), a game from last week with
no score, a game not yet started, a postponed game, a division with standings off. Add it to the Owner QA Ledger (never sort the §
numbers) and the TODO line.

## Shared-file traps

- `lib/db.ts`, the schedule `page.tsx`, the dictionary, the help file and the coach guard tests carry other sessions' hunks (9e-2 at
  least): edit narrowly, commit hunk-by-hunk from a hand-built blob (a `-U0` partial commit misplaces insertions).
- A coach page and a coach route must never read past the coach's own team (Q7): every query is keyed by the team the user's own
  link names, and the game must belong to that team.
- Do not touch the 9e-1 ranking call (a team with no counted game) — it is the owner's open question, not this build's.
