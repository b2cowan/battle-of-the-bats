# House League Stage 9e-3: Coach scores — finish (simplify, review, commit)

> **Written 2026-11-03** by the session that built 9e-3 Parts 1–5 and its `/docs` pass (build prompt
> [HOUSE_LEAGUE_STAGE9E3_BUILD_PROMPT.md](HOUSE_LEAGUE_STAGE9E3_BUILD_PROMPT.md) — **read its ▶ Progress block first**; every
> build decision, the owner's four answers and the check results are there). **Paste this into a new chat on `dev`.**
> Recommended model: Opus 5.5, one session. Reading and searching go to helpers.
>
> **This session does three things, in order: `/simplify`, then `/review`, then the commit — and commits only when the owner
> says so.** It does not rebuild, redraw or reopen anything ruled. The owner walk is §447
> (https://claude.ai/artifact/GaS5fuhi4FRjpcXCBYGd4Q, source `HOUSE_LEAGUE_STAGE9E3_WALK.html`); it may run before, during or
> after this session — if the owner pastes walk results, fix what they report first (that is the one thing that comes before
> step 1), and re-run the focused tests.

## What was built (for orientation; the code is the truth)

- **Mig 428** `supabase/migrations/428_the_home_coach_enters_the_score.sql`: table `league_game_scores` (service role only — never
  columns on the anon-readable `league_games`) + `league_game_coach_score`, `league_game_score_report`, `league_game_score_keep`,
  `league_game_club_write`. Applied to DEV only; proof `scripts/house-league-9e3-scores-check.sql` (T1–T16 pass, rolled back).
- **Pure logic** `lib/league-coach-scores.ts` (`SCORE_WORDS`, `coachScoreView`, `clubScoreLines`, `scoresToCheck`, `refusalOf`).
- **Server** `lib/league-coach-scores-server.ts` (record reads, rpcs, `staffName`), `lib/league-coach-score-press.ts` (the coach
  routes' preamble: own seat, live season, the game is this team's).
- **Routes** coach `app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/games/[gameId]/score` + `/report`; club
  `app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/keep`. The game PATCH writes a score through
  `league_game_club_write` (`leagueGameRow` split out of `updateLeagueGame` in `lib/db.ts`); the schedule GET returns `scores`.
- **Coach page** `readTeamScores` in `lib/house-league-coach.ts` (LIVE rows), `CoachScores.tsx` + `CoachScoreWindows.tsx` (+ two
  CSS modules) in `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/`; `When` exported from `CoachSchedule.tsx`.
- **Club** `GameWindow.tsx` (tag, lines, Keep · Correct, ✓-with-no-change = Keep), `ScoresToCheckFold` in
  `SeasonScheduleViews.tsx`, wired in the schedule `page.tsx`.
- **Tests** `league-coach-scores.test.ts` (21), `league-coach-scores-route.test.ts` (22), `league-coach-scores-guard.test.ts` (4);
  edited `house-league-game-window-guard.test.ts` (the stale-write assertion) and `team-move-coverage.test.ts` (+ the table).
- **Help** `recipe-record-house-league-scores` in `lib/help-content/house-league.tsx` (three sub-topics, keywords, searchText).
- **Docs** dictionary section `league_game_scores`, MANUAL_PROD_STEPS 428 entry, ledger §447, TODO 9e line, build prompt Progress.

## Step 1 · `/simplify`

Run the built-in `/simplify` skill on **9e-3's files only** (the list above). Leads worth its attention (verify each against
the code; do not take them as findings):
- `lib/league-coach-score-press.ts` was split out of the server module late to break an import cycle (house-league-coach ↔
  scores-server); its layout and the `UUID` export may want tidying. **Keep the split** — the cycle is real.
- `placeNamer` was factored out of `readGamesAsSent` in `lib/house-league-coach.ts`; `readTeamScores` duplicates some of
  `readGamesAsSent`'s read shape on purpose (LIVE rows vs as-last-sent) — do not merge the two reads (the build prompt's fact 1).
- `GameWindow.tsx`'s `keep()` repeats the shape of its `write()`; a shared helper is fine if it keeps `write()`'s error paths.
- The coach windows (`CoachScoreWindows.tsx`) wear the portal stylesheet the way `CalendarSubscribeWindow` does — keep that;
  check the two new CSS modules against the token/selector baselines (`npm run check:tokens`, `npm run check:css-selectors`).
- ⚠ Do not touch the 9e-1 ranking call, the rainout (9e-2, committed `4528b4a2d`), or any other session's hunks.

## Step 2 · `/review`

Run `/review` (`.claude/commands/review.md`, the token-tiered funnel) on 9e-3's diff. It is **high-risk**: say so to the funnel
so it runs its full lenses. Where to look hardest:
1. **The four SQL functions** — the lock and `updated_at` order, every refusal path (the proof covers T1–T16; look for what it
   doesn't: a NULL `p_seen`, a game moved to another division, `league_game_club_write`'s jsonb casts on a key sent as JSON null,
   a coach score on a game whose status the club changed in the same second).
2. **Coach-route tenancy (Q7)** — `resolveCoachPress`: the URL's org and season slugs against the team, the game belongs to the
   URL's team, the person's OWN seat, `houseLeagueCoachAccess === 'open'`; "a coach of both teams is the home coach"; nothing
   reads past the coach's own team; never `houseLeagueRefusal` on a coach route.
3. **Nothing private on a public read** — `league_game_scores` read only by the club schedule GET (behind `'read'`) and the coach
   page (team names only, never a person's name, the note, or the reporter); the new guard pins this — check it can't be dodged.
4. **The club PATCH** — a save carrying a score goes through `league_game_club_write` and only then; the trigger still records no
   change for a score; `scoreRuleStatus` still applies; the stale guard still answers 409 `changed`.
5. **The UI** — the ✓-with-no-change Keep in `save()` (does it ever Keep when the admin meant only "done"?), the coach island's
   refresh after a save, the phone report door's accessible name.
Apply what survives verification; re-run the focused tests below after each fix.

## Step 3 · Checks, then the commit (on the owner's word)

**Checks before asking to commit:**
- `node --import ./tests/ts-resolver.mjs --test tests/unit/*league*.test.ts tests/unit/*coach*.test.ts tests/unit/possessive-guard.test.ts tests/unit/team-move-coverage.test.ts`
- `npm run typecheck` (8 GB heap). Foreign errors are other sessions' — name them.
- `npm run lint:focused -- <9e-3 files>` (0 errors last time; `verify:changed`'s own ESLint step could not start — react-hooks
  plugin missing — report it, don't fix shared config).
- Only if Step 2 changed a function: re-apply 428 to dev (`node scripts/apply-migration-api.mjs <file>`), then re-run
  `node scripts/db-query.mjs --dev -f scripts/house-league-9e3-scores-check.sql` (every row `pass`).
- Known FOREIGN failures in the full `npm test` at build time (2026-11-03): billing free time, Stage 6 owner-walk summary, the
  Stripe key-prefix guard, the platform-admin bookkeeping foot sentence. Re-check they are still not 9e-3's.

**The commit (shared working copy — read AGENCY_RULES "Concurrent-work safety"):**
- `git rev-parse --abbrev-ref HEAD` must be `dev`. Stage **explicit paths only**; never `git add -A`.
- **Whole files that are 9e-3's alone:** the migration, the proof script, the three lib modules, the three new route files, the
  coach page's four new files (`CoachScores.tsx`, `CoachScoreWindows.tsx`, two `.module.css`), the three new test files,
  `HOUSE_LEAGUE_STAGE9E3_BUILD_PROMPT.md`, `HOUSE_LEAGUE_STAGE9E3_WALK.html`, this prompt. (`.probe/9e3-walk/` is scratch — not
  committed, like 9e-2's.)
- **Files to commit HUNK BY HUNK from a hand-built blob** (they carry, or may carry, another session's lines — `git diff` each
  first and take only 9e-3's): `lib/db.ts`, `lib/house-league-coach.ts`, the schedule `page.tsx`, `SeasonScheduleViews.tsx`,
  `SeasonSchedule.module.css`, `GameWindow.tsx` + `.module.css`, the schedule GET and game PATCH routes, the coach team
  `page.tsx` and `CoachSchedule.tsx`, `DATA_DICTIONARY.md` (the `league_game_scores` section), `MANUAL_PROD_STEPS.json` (the 428
  entry), `lib/help-content/house-league.tsx` (the scores article only), the two edited tests, `TODO.md` (the 9e line's 9e-3
  clause), `OWNER_QA_LEDGER.md` (§447 only). A `-U0` partial commit misplaces insertions — build the blob (memory
  `reference_partial_commit_shared_tree.md`).
- **The schema snapshots** (`docs/agents/db/schema-snapshots/*`): 9e-2's commit deliberately left them for this one (they
  describe 427 and 428). Run `npm run refresh:snapshots` right before the commit and include them — but if they now also
  describe a THIRD session's uncommitted schema, say so and ask the owner rather than committing someone else's state.
- Message: what a person sees (the home coach enters the score, the away coach can report it, the league admin keeps or
  corrects it, nobody is emailed), then mig 428 dev only (prod pending, apply before the promote, after 423 and 427), then the
  owner's four answers. End with the Co-Authored-By line.
- After: `git show --stat HEAD` — only 9e-3's files; if anything foreign slipped in, `git reset --soft HEAD~1` and redo.
- Then record the commit hash (positive wording, no "uncommitted") in the build prompt Progress, the TODO 9e line and ledger
  §447, in a second small commit, as 9e-1 and 9e-2 did.

## Not this session
- Applying mig 428 to production (the owner's step before a promote, after 423 and 427).
- 9f "Final standings", the away coach entering a different score, a reporter withdrawing a report, any score notification.
- Restarting the dev server while the owner is mid-walk — ask first.
