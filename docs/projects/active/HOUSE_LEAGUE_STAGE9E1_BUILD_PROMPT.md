# House League Stage 9e-1: standings by the season's sport, and the score rule (build prompt)

> **Written 2026-11-01**, after the owner ruled asks **9e·1–9e·14** (plan `HOUSE_LEAGUE_STAGE9_PLAN.md` §0i, "Rulings" block).
> **Paste this into a new chat on `dev`.** Binding, do not reopen: 9e·1 (three builds; this is the first), **9e·2, 9e·3, 9e·4,
> 9e·5, 9e·6**, and the pencil's both-or-neither rule. **Not this build:** 9e-2 rainout, 9e-3 coach scores (coach entry, Report,
> "Entered by", "scores to check"), 9f "Final standings" / frozen table, and **9e·15 (plan gate) — undecided, so no plan, lock or
> upgrade wording anywhere**. Drawings: https://claude.ai/artifact/V9exKafSgmHc3XuFFar5Qo (the **Standings** tab: public table, phone,
> admin table, the switch, the coach line; source `HOUSE_LEAGUE_STAGE9E_DRAWINGS.html`). Words: **Part A of
> `HOUSE_LEAGUE_STAGE9E_COPY.md`** (§1–§4) — written by `/marketing` 2026-11-01 and **accepted by the owner 2026-11-01**, including
> Option B "Level with". Build with the file's wording; keep every string in one place.
> **It adds one migration.** `ls supabase/migrations` right before you create it: on 2026-11-01 the highest is 422, so the next is
> **423**; peers have taken numbers the same hour before.
>
> Re-verify every lead below before building on it: other sessions share this working copy (on 2026-11-01 the tree carried many
> unrelated edits — signed-in family accounts, tournament routes). Stage explicit paths only, commit only your own hunks, check
> `git diff --cached --name-only` before every commit, **commit only when the owner says**.
>
> **Recommended model: Opus 5.5, one session.** Size S–M. Before any code, present the Product-Manager UX summary the repo's rules
> require (what a family, a coach and a club admin see differently, role differences) and the task list. Update the Progress block
> after each Part. Reading/searching goes to helpers, they stay on Sonnet.

## ▶ Progress (read first when resuming)

- **2026-11-01, Parts 1–6 BUILT (one session), uncommitted.** Bad rows counted first: completed games with a missing score,
  **dev 0 / prod 0** (dev 3 completed, all scored; prod has no league games) — nothing to repair.
  - Part 1: mig **423** `423_a_division_can_hide_its_standings.sql` applied to **dev only** (prod is the owner's step before a
    promote); type, mapper, `updateDivision`, the division PATCH (`showStandings`, boolean), the switch in the division window
    (saves on press, the payee-switch pattern; toast in the window's corner; read row "Show standings · On/Off"). Dictionary:
    the column, the `league_seasons.sport` line, `league_games` gotchas 2–4 and the score columns corrected; snapshots refreshed
    by the hook.
  - Part 2: `lib/league-standings.ts` (`rankStandings`, `gameCounts`, `coachStandingLine`, `STANDINGS_WORDS` — every string in one
    place); `computeStandings(divisionId, sport)` is a thin read; `LeagueStandingsRow` moved out of `lib/types.ts`. 21 tests in
    `tests/unit/league-standings.test.ts`.
  - Part 3: `scoreRuleStatus` in `lib/league-game-patch.ts`, run by the game PATCH on stored row + patch (the route now reads
    `home_score, away_score`); 5 new cases in `league-game-patch.test.ts`. A notes-only patch on an old completed-no-score row is
    NOT refused (build decision). The window's wording is untouched, so COPY `rule.hint` / `rule.clearedSaid` are not shown.
  - Part 4: the public page rewritten on `league-column.module.css` (inline styles moved; token baseline not re-initialised — the
    file only went down); desk and phone tables are two renderings of one ranking.
  - Part 5: the route returns `{ standings, division: { name, published, showStandings } }`; the admin page adds Level with,
    the notes, the box, sport-led export columns (catalog help line updated). The admin phone recipe (record column) is NOT built:
    the kit table scrolls. Old-look baseline lowered for the page (kx 7 → 6), its new CSS written kit-only.
  - Part 6: the coach read joins `show_standings` and the season's `sport`; the line + "See the standings" on the team page.
  - Part 7: help recipe `recipe-record-house-league-scores` rewritten by a `/docs` helper (three sub-topics, keywords + searchText;
    one sentence corrected after). Typecheck clean; 396 focused tests pass; `verify:changed`'s own failures are all in other
    sessions' files (listed in the hand-off). Dev server restarted, login 200. Walk **§442** published
    (https://claude.ai/artifact/P7Sd78n2t6Jc49HPoQmwv1, fixture `.probe/9e1-walk/fixture.mjs`), ledger + TODO updated.
    The copy file was marked ACCEPTED 2026-11-01 (incl. "Level with") after this prompt was written; only the switch's
    read words "On / Off" are the build's own.
- **2026-11-01, `/simplify` + `/review` DONE, committed (the commit that carries this line).** Simplify: the "Level with" list uses
  the shared `joinWithAnd`; the rank cell is one `<td>`; the admin export's two handlers share one builder. Skipped on purpose:
  a `familiesSeeTable` helper (each surface needs the two flags apart to pick its message), dropping the admin page's
  per-division read (it is the fresher answer), the `kind` field on the coach line. Review (4 lenses; security/tenancy found
  nothing): fixed three real defects — (1) the Show standings switch could land a slow answer on the NEXT division when the
  stepper moved mid-save; (2) the admin standings page could show division A's table under division B (no stale-answer guard)
  and spun forever on a failed read; (3) a switch-only save was refused with the early-bird price message on a division
  holding an old odd price pair (the check now runs only when a price is in the save). Wording fixed: dictionary gotcha 4
  (clearing scores resets only a COMPLETED game), the help sentence about the club's own page. **OPEN FOR THE OWNER (not
  changed — a ranking-rule question):** a team with NO counted game in a division where others have played ranks above a team
  that lost (both 0 points, run differential 0 beats a minus) and shares a place ("T-2"); its coach line reads "Tied for 2nd of
  4 · 0-0-0 · 0 points". 9e·4 only covers the all-zero division. Option: teams with no counted game sit below every team that
  has one, A–Z, no place, coach line "Standings start with the first score." **Also noted, not changed:** the refusal text
  says "Enter both scores, or neither" even when the call was status-only (direct calls only); a game between a team and
  itself would count (needs an already-corrupt row); the "Standings" link on the season home ignores the switch (a build
  decision keeps it; the page explains itself); GameWindow's `scoredGame`, `resultWords` and the schedule export's check
  (`schedule/page.tsx` ~1124, tests only the home score) still hold their own copy of "completed with both scores" —
  candidates for `gameCounts`. **Not run:** `check:layout` (no signed-in test session on this machine). **Still owed:** the
  walk §442, mig 423 on PROD **strictly before** a promote (the coach team card and the admin standings read name the
  column, so code without the column fails), and the TODO / ledger / snapshot records, which share files with other
  sessions and were left for their own commit.
- **2026-11-02, walk §442 PASSED 33/33 (walked 2026-11-01), no changes asked.** The four open owner calls stand as built; the ranking call above (a team with no counted game) is still the owner's. Still owed: mig 423 on PROD before a promote.

## What a person sees after this build (for the UX summary)

- **Families / anyone with the link:** the standings page now shows a division's table only once its schedule is published; before
  the first score the teams are listed A–Z with dashes and no rank. Column heads and the "How the table is ranked" box come from
  the season's sport (RF / RA / RD for ball). Teams that stay level share a place ("T-3"). A division the club turned off says so
  and points to the Schedule. No draft division shows a table of zeros any more.
- **Club admins:** the same ranking, plus a "Show standings" switch on each division (on by default), a "Level with" column that
  names who a shared place is shared with, and a note when families can't see a table yet. The admin table is always visible.
- **Coaches:** one quiet line on their team page — "1st of 6 · 4-1-0 · 8 points" with "See the standings" — only when the
  division's schedule is published and its switch is on.
- **Everyone who enters scores:** a game counts once **both** scores are in. Today a direct save can mark a game finished with no
  scores and the table counts it as 0–0; that stops.

## Facts checked in the code on 2026-11-01 (a helper's map, then re-read by the writer — re-check before relying)

1. **One standings function.** `computeStandings(divisionId)` in `lib/db.ts` (~2940–2979). Counts any `status === 'completed'` game and
   turns a null score into 0 (`?? 0`), so a completed game with empty scores is a 0–0 tie. Points are hard-coded `wins*2 + ties`.
   Sorts points → run differential → runs for, then team order; no head-to-head, no shared place; **every team gets a row, even with
   no games**. Row type `LeagueStandingsRow` in `lib/types.ts` (~1123): no place or tied field. Only two callers: the public
   standings page and the admin standings route. (`app/[orgSlug]/archives/[archiveId]/page.tsx` has its own tournament-snapshot copy —
   **leave it alone**.)
2. **The sport is stored (`league_seasons.sport`, text, default 'softball') and no standings code reads it.** It *is* read elsewhere
   (birth-year cut-offs, field nouns), so the dictionary's "no code branches on it" is stale — fix that line when you touch it. Read
   it only through `getSportPack(value)` (`lib/sports.ts`, ~342): the PATCH stores any string. Softball and baseball packs give
   `score.forAbbr/againstAbbr/diffAbbr` RF/RA/RD, `pointsPerWin` 2, `pointsPerDraw` 1. The pack's `defaultTieBreakers` is
   `['h2h','rd','rf','ra']` — **the ruling stops at runs for (then a shared place); do not add `ra` and do not use `hasDiffCap` or
   `standingsPrimary` in this build.** No league code calls `getSportPack` today.
3. **Public page** `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx`: 404s only a draft *season*; does **not** check the
   division's `schedulePublishedAt`; headers `#,Team,GP,W,L,T,Pts,GF,GA,Diff` and the footnote "Pts: W=2, T=1, L=0 · Tiebreaker…"
   are typed in; rank is `i+1`; its "No games have been completed yet" branch only fires for a division with no teams. Inline
   styles (it is in the token/selector baselines). The sibling Schedule page is the model for the published rule
   (`publicSeasonGames`, `lib/league-game-changes-server.ts` ~143, and its "coming" tab word).
4. **Admin page** `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx` (client) fetches
   `/api/admin/house-league/seasons/[seasonId]/standings?divisionId=`; same typed headers/footnote and an export column list (GF/GA/Diff).
   The route (`houseLeagueRefusal(ctx,'read')`, `divisionInSeason`) returns raw rows only. Export is in `lib/export/catalog.ts`
   (~763–776) with a help line naming "GF, and GA" — `check:export-catalog` covers it.
5. **Division flag.** `league_divisions.schedule_published_at` (mig 409, never cleared). No boolean per-division switch exists yet.
   Wiring a new one touches: `LeagueDivision` (types ~986), `mapLeagueDivision` (db ~2339), `updateDivision` (db ~2568), the division
   PATCH `app/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]/route.ts` (field-by-field, `'note' in body` is the model),
   `SeasonDivision`/`Draft`/`changes()` in `components/admin/kit/club/league/DivisionsBlock.tsx` (autosaves ~0.9 s after a change;
   the season GET spreads `...d`, so the new field flows through), and the dictionary (`<!-- dict:col:league_divisions.* -->`
   anchors ~6831).
6. **The score rule.** `invalidGamePatch` (`lib/league-game-patch.ts` 16–28) refuses one score alone and non-whole numbers, but
   **allows both null**. The game PATCH (`app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts`, ~126–134) then
   auto-sets `status='completed'` whenever both score keys are present — **so `{homeScore:null, awayScore:null}` marks a game
   completed with no scores** — and `{status:'completed'}` alone also passes. The window's "both empty = back to scheduled" lives
   only in `scoresToSave` (`lib/league-season-calendar.ts` ~385). No database constraint ties status to scores. The route already
   builds an "effective state" (stored row + patch) for the clash check (~144–153): enforce here, not in the body check, because a
   status-only patch needs the stored scores.
7. **Coach team page** `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx` ← `readCoachTeamPage` in
   `lib/house-league-coach.ts` (~181–228; `TEAM_SELECT` ~126 already joins the division's `schedule_published_at`; `view` is
   gone/ended/finished/open). The 9d-3 practice line is the model for a quiet line: a pure builder returning a small object or null
   (`lib/league-practice-tell.ts` `coachToldLine`), a words helper, a `kit.sub` paragraph. A "Scores" stub already says "The club
   enters scores for now." — leave its wording for 9e-3. Guards pinning the coach read: `tests/unit/house-league-coach-read-guard.test.ts`,
   `house-league-9d3-coach.test.ts` — they may need the new columns allow-listed.
8. **No unit test covers `computeStandings`.** Closest: `league-game-patch.test.ts`, `house-league-game-window-guard.test.ts`,
   `league-season-calendar.test.ts`. No house-league demo exists, so no demo sentence quotes a standing.
9. **Help** `lib/help-content/house-league.tsx` ~763–781 (`recipe-record-house-league-scores`) says "a tie 1, … broken by score
   differential, then by total scored (the GF/GA columns)" — false after this build; its keywords/searchText mention GF GA.
   `lib/league-season-calendar.ts` ~447 (`deleteSays`) stays true.

## Build decisions the prompt makes (say so in your report; the owner can overrule)

- **"Counted" = completed AND both scores present.** One definition, used by the table, the coach line and the server rule.
- **Group by points first.** Teams with equal points form a level group. A group of **exactly two** is split by the games
  *between those two* (counted games only; more wins in them ranks first; equal or none played = undecided). Groups of three or more
  skip the game-between step. Then run differential, then runs for. Still equal = a shared place; the next team takes the place
  after the group ("T-3, T-3, 5"). Pure function, no DB, no coin.
- **No-games state.** A division with no counted game: the teams A–Z, dashes in every stat cell, no place, no "T-".
- **Keep the links to the standings page** (season page button, `publicSeasonLinks`): the page now explains itself in each state;
  nothing 404s except a draft season, as today.
- **Division tabs on the public page:** a division with its switch off has no tab (a direct link shows `stand.off`); an unpublished
  division keeps its tab and shows `stand.unpub`, as the Schedule page does with its coming-tab word.
- **Existing rows:** after this build, a game stored as completed with null scores stops counting. Before building, count them on
  dev and prod (read-only SQL via the usual probe route) and report the numbers; do not repair them.

## Parts (build in this order; stop and update Progress after each)

**Part 1 · The switch (migration 423).** `league_divisions.show_standings boolean NOT NULL DEFAULT true`, in the style of mig 412 /
420 (BEGIN/COMMIT, `ADD COLUMN IF NOT EXISTS`, `COMMENT ON COLUMN`, header naming ruling 9e·5 and this prompt, "Apply BEFORE
promoting the code that reads it", a Verify block). Apply to **dev only**; prod is the owner's step before a promote (a plain
column needs no `MANUAL_PROD_STEPS.json` entry — `check:migrations` is the gate). Then the type, mapper, `updateDivision`, the
division PATCH (boolean validation, same error style as its neighbours), the switch in `DivisionsBlock` with `switch.label`,
`switch.help` and the two toasts from COPY §3. Dictionary: add the column anchor and the stale `league_seasons.sport` line;
refresh snapshots (`npm run refresh:snapshots`). Also correct the stale `league_games` Gotchas 2 and 3 (postpone is a door not a
dropdown; DELETE hard-deletes a draft division's game and refuses a published one) — the plan says they are stale; verify first.

**Part 2 · The ranking, as one pure function.** A new `lib/league-standings.ts`: input teams, games, sport pack; output ranked rows
with `place`, `tied`, `counted`, `levelWith`, the sport's labels, and the ranking-box rules as data (the points and the three steps),
so the box's words and the sort cannot disagree. `computeStandings` becomes a thin DB read around it (keep its callers working).
Unit tests (new file) cover: 2/1/0 points; a clear order; two level, decided by the game between them; two level, game between
them tied or not played; three level (no game-between step); run differential; runs for; a shared place and the next place after
it ("T-3, T-3, 5"); null-score completed game not counted; a division with no counted game (A–Z, dashes, no place); both offered
sports.

**Part 3 · The score rule on the server.** In the game PATCH, after merging stored row and patch: both scores empty and no
explicit status → `scheduled` (the window's rule, now for a direct call too); a resulting `completed` state without both scores →
400 with a plain sentence (use COPY §1.4 / §9 wording; reuse `GAME_WINDOW_WORDS.bothScores` where it fits); both present and no
status → `completed`, as today. Do not change `invalidGamePatch`'s one-alone and whole-number rules; add the cases to
`league-game-patch.test.ts` / a route-guard test. Do not touch cancelled/postponed behaviour or the window's wording.

**Part 4 · The public page.** Gate by the division's published schedule and `show_standings`; render from Part 2 with the pack's
column words (tooltips COPY §1.1), `T-n`, dashes, the ranking box (`rank.*`), the four states of COPY §1.3, the phone's record
column and the phone ranking line as drawn. Use the shared kit/CSS-module patterns the neighbouring pages use; the old inline
styles may be moved onto CSS modules (refresh the token/selector baselines only if you move them, and say so).

**Part 5 · The admin page and export.** The route returns the ranked result, the pack's labels, and the division's published and
switch state; the page shows the same table and box, the "Level with" column (COPY §2 Option B), and `adminStand.noteUnpub` /
`noteOff` / `adminStand.rules` / `adminStand.empty`. Export columns follow the sport's abbreviations; update the catalog's help line
(`check:export-catalog`).

**Part 6 · The coach's standing line.** Add the sport and the division's switch to the coach read (allow-list guards updated). A
pure builder + words (`coachStand.*`, COPY §4): ranked, tied ("Tied for 3rd of 6"), one point, none yet; no line when the switch is
off, the schedule isn't published, or the view isn't `open`. Heading reads "Scores and standings" only when the line shows, else
"Scores". "See the standings" links to the public page for that division.

**Part 7 · Checks, help, hand-off.** Update the help recipe (ranking, the switch, the published rule) and its keywords
(COPY §15) — run `/docs` rather than hand-writing. `npm run verify:changed`; focused tests; `npm run typecheck` (shared modules
changed; the 8 GB heap, the default 4 GB runs out). `check:spelling` by eye on COPY §16. Restart the dev server before handing off
(new files, a shared module). Then offer `/simplify` (new shared module), then `/review` (server rule + public data), then `/docs`
if not already run. Browser testing is the owner's: write the walk as a checkable Artifact (one purpose per walk), with a fixture
that has: a published and an unpublished division, one level pair, one level trio, a game with scores cleared, a division with the
switch off, a coach login on a team. Add the walk to the Owner QA Ledger (never sort the § numbers) and the TODO line.

## Shared-file traps

- `lib/db.ts`, `lib/types.ts`, `lib/house-league-coach.ts`, `components/admin/kit/club/league/DivisionsBlock.tsx` and the
  dictionary are shared and often carry other sessions' hunks: edit narrowly, commit hunk-by-hunk.
- Reads of `league_teams` are anon-readable for active seasons (mig 020): put nothing new on that table.
- Never restate a standings number in a demo or a help sentence unless it is computed; there is no house-league demo today.
- The tournament's tie-breaker engine (`lib/tie-breakers.ts`) is not reused: it includes a coin and is pool-shaped. Borrow its
  head-to-head idea only.
