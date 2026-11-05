# Club Tier Stage 14 · S3 finish run: /simplify → /review → /docs → owner walk → commit (kick-off prompt)

> **Written 2026-11-04**, at the end of the session that built S3 (the past-player picker and "Same child?"). Paste
> `execute @docs/projects/active/CLUB_TIER_STAGE14_S3_FINISH_PROMPT.md` into a fresh chat on `dev`. One session, five steps,
> in order. **Commit only at step 5 and only when the owner says so.**
>
> **Read first:** the S3 entry in the **Progress** block of `docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md` (what
> landed, the owner's two Part 0 rulings, the twelve defaults taken, the found-not-fixed list). Then the S3 section of the same
> file (~"### S3"). The drawings: https://claude.ai/artifact/YRZjgsXZwkeNPnGmpPAapN (version 2; tabs 3, 4 and 8 are S3's).
> The binding rulings are in that prompt's "Decisions already made" — do not reopen them.
>
> **Owner rulings in S3's Part 0 (2026-11-04), binding:** "yes on the lock" (the one-child-per-season unique index, mig 438)
> and "go ahead with your recommendations" (the defaults listed in the Progress block). Do not reverse either in review; if
> review finds one is wrong, raise it as an owner question.

## The work under review (uncommitted on `dev`; verify with `git status` — other sessions share this tree)

**New files (all S3's):** `supabase/migrations/438_a_no_is_remembered_and_a_child_plays_once_a_season.sql` ·
`lib/past-player-words.ts` · `lib/past-player-rules.ts` · `lib/past-players.ts` ·
`app/api/coaches/[orgSlug]/teams/[teamId]/roster/past-players/route.ts` · `components/coaches/PastPlayersPicker.tsx` ·
`tests/unit/past-players.test.ts` · `tests/sql/child-match-rejections-fixture.sql` · this file.

**Edited (S3's hunks; ⚠ some files also carry OTHER sessions' uncommitted hunks — commit only S3's, see step 5):**
`lib/db.ts` (`getRepTeamRosterEntriesAllSeasons`, tryout-registration `childId` in the mapper, `TryoutAcceptError`
`already_on_roster` + its 23505 mapping) · `lib/types.ts` (`RepTryoutRegistration.childId`) · `lib/continuity-match.ts`
(`normName` exported) · `lib/rep-season-rollover.ts` (the roll copies through `carriedEntryFields`) · `lib/season-roll-path.ts`
(`PAST_PLAYER_PICKER_BUILT = true`) · coach routes `roster`, `roster/bulk`, `tryout-decisions/accept`,
`development/continuity/[linkId]` · the club accept route `admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/[regId]` ·
`app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx` · `.../tryouts/page.tsx` · `components/coaches/RosterBulkAddSheet.tsx` ·
`components/rep-teams/TryoutDecisionBoard.tsx` · `app/[orgSlug]/coaches/coaches.module.css` (blocks appended at the END:
"Bring back a past player · Same child?" and `.addDoorLinks`) · tests `coach-history-endpoint-guard` (the
`roster/past-players` entry in `CROSS_SEASON_READERS`), `season-roll-path` (flag test flipped), `tryout-report` (fixture
`childId`) · `scripts/layout-screens.mjs` (two entries: `coach-roster-add-player`, `coach-roster-past-players`) ·
`scripts/.layout-baseline.json` (six `coach-roster-add-player` entries with a reason) · `docs/agents/db/DATA_DICTIONARY.md`
(the `child_match_rejections` entry, the ⚠ unique-index paragraph under `rep_roster_players.child_id`, one sentence in
`org_children` gotcha 3) · `supabase/migrations/MANUAL_PROD_STEPS.json` (the `438_…` entry ONLY — the `436_bank_checks` and
`437_the_team_move…` entries are the bank-reconciliation session's) · the dev schema snapshots · `TODO.md` (the Stage 14
line) · `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` (the 14b status line) · the build prompt's Progress block.

**State already proved (do not re-run unless you change the thing):** typecheck clean; `past-players.test.ts` 35/35; affected
suites 300/300; full unit run 13,936/13,943 — the 7 failures are other sessions' (practice plans phone, billing free time,
tournament Stage 6 walk, series dates, support-console foot note); dev fixtures `child-match-rejections-fixture.sql` 4/4 and
`org-children-fixture.sql` 15/15 (`node .probe/s2-child/q.mjs --file <path>`); `check:dictionary`, `check:spelling` OK; lint 0
errors on touched files; layout clean on the two new screens at 361/390/768/1440 except the six recorded toggle entries.

## Step 1 · `/simplify`

Run the built-in `/simplify` on the S3 diff. Candidates the author already sees — judge them on merit, do not just apply:
- `lib/past-players.ts` re-exports all of `lib/past-player-rules.ts` (`export *`) so routes import one module; consider
  whether routes should import the rules directly instead.
- Two "latest earlier entry per child" loops: `partitionEntries` (rules) and `returningCaptions` (server) — likely one helper.
- The Add Player question state on the roster page (`sameChild`, `notSame`, `serverAsk`, `asking`) and the paste sheet's
  `matchOf` / `answers` are two shapes of one idea; the tryout board has a third. Worth one small shared hook only if it
  stays readable.
- `bringBackChild`'s `pick()` override helper (string-vs-null rules) — check it is not cleverer than it needs to be.
- The S3 CSS block in `coaches.module.css`: reuse existing chip/badge classes where one already fits (`.badge*`,
  `.chipQuiet`) rather than new `.pastChip*` if the look is the same.
Re-run the tests that cover what you changed, and `npx tsc --noEmit --pretty false` (needs
`NODE_OPTIONS=--max-old-space-size=8192` here or it runs out of heap).

## Step 2 · `/review` at **high** (`.claude/commands/review.md`)

High-risk because: a migration with a unique index that REFUSES writes, a re-created SECURITY DEFINER function
(`org_children_join`), three add doors and two accept routes that decide identity, and a cross-season read. Lenses worth
giving their own reviewer:
1. **The index and every writer** — can any path still put one child on one season twice (`createRepRosterPlayer` callers
   outside S3: the house-league/club paths, the free→Premium upgrade copy, the seeds, `move_team_into_club`, the roll)?
   Does each 23505 surface the drawn words, not a 500? Is `isChildAlreadyOnSeason` matching on the index name robust?
2. **The accept decision** (`decideAcceptWith` + `confirmReturningAtAccept` + `rejectAtAccept`) — order of the three
   branches, the stored "no" lookup, a "yes" when the sign-up already has ANOTHER confirmed link (the one-confirmed-per-current
   index), the board/window agreeing afterwards, nothing written before the answer is unambiguous.
3. **Privacy (Ask 9)** — the picker GET and the `needs_answer` candidates: nothing beyond names/number/season/status without
   `rosterPii`; dues only with money access too; this team's seasons only; the birth-year warning never leaks a year.
4. **The migration** — 438 re-creates `org_children_join` from 435 exactly plus the carry-over (diff it against 435's final
   body); the stored-"no" table has no `org_id` on purpose (team-move gate); the lock/timeout; the prod pre-check is right.
5. **Screens** — the question's disabled buttons + foot reason on all three doors, a typed name changing after "Yes", the
   paste sheet's per-row answers surviving edits/removals, phone vs desk lines.
Fix what is confirmed (Critical/High always; Medium when cheap); record the rest in the Progress block under S3 as
"Review outcome". If a fix touches mig 438, apply the final file to dev again (`node scripts/apply-migration-api.mjs <file>`)
and re-run both SQL fixtures.

## Step 3 · `/docs` (`.claude/commands/docs.md`)

Help that names these flows (change nothing by hand; let `/docs` do it): `lib/help-content/coaches.tsx` —
`recipe-add-player`, `premium-bulk-roster`, `recipe-run-tryouts`, `recipe-start-next-season` (its "bring anyone back from the
Roster" line is now true), `premium-portal-tour` if it lists roster actions; `lib/help-content/rep-teams.tsx` —
`recipe-accept-player-to-roster` (the club's accept now refuses a child already on the roster). Words to use are the drawn
ones in `lib/past-player-words.ts`. Do not promise S4's documents or S5's child page.

## Step 4 · The owner walk — "a returning child is picked, never retyped"

- **Restart the dev server first** (S3 added files and changed `lib/db.ts` / `lib/types.ts`): stop it, then `npm run dev`
  (AGENTS.md; with network access); clear `.next` only if it serves stale pages (S1 needed that once).
- **A fixture is needed**: a standalone coach team with an earlier CLOSED season holding (a) an inactive player who did not
  roll ("Jonah"), (b) a player from two seasons back with dues owing ("Priya"), (c) one born outside the working season's
  birth years ("Sam"), (d) a call-up, plus a working season with an "Ella" already on it, an offered tryout sign-up named
  like (b) and one named "Ella". Model it on `.probe/s1-walk/fixture.mjs` (dev only, `--reset`, `--destroy`); the layout
  fixture team has no earlier season, so the sweep only measured the picker's empty state — the walk measures the list.
- **The walk is a checkable Artifact** (house layout: sticky tabs, minimal scroll; paste-back result; one purpose). Next
  ledger number: check `OWNER_QA_LEDGER.md` (highest was **§454** on 2026-11-04 → likely §455), and add the § entry there.
  Outline: A the picker door on Add Player (desk + phone) · B the picker list: rows, chips, search, the phone lines, an
  assistant without the roster-details grant · C bring back two — they arrive active, with "Back from the … Season" · D
  single add "Same child?": Yes (boxes filled, Change), No (remembered: type the name again in a new window — not asked) ·
  E paste a list: a matched row, Same child | New player, Add waits, the count · F tryout accept: confirmed → straight in;
  unconfirmed → the question; Ella → the refusal + "Open Ella's entry"; same name, other record → "add anyway" · G the
  board's confirm that would put one child on the roster twice → the Ask 11 words · H last season's close window now says
  "Bring Jonah back from Roster any time" · I a phone pass.
- **Calls to put to the owner in the walk** (each "Keep as built" or a change): the twelve defaults in the Progress block,
  most of all (9) "A different child — add anyway", (10) who gets the "Back from…" caption, (11) a pasted same-season name
  is still added; and the found-not-fixed shared toggle at 37px (fix it once in the shared control, or leave it).

## Step 5 · Commit (only when the owner says so)

- `git rev-parse --abbrev-ref HEAD` must be `dev`. Stage **explicit paths only**. For files that also hold other sessions'
  hunks (`MANUAL_PROD_STEPS.json`, `DATA_DICTIONARY.md`, the snapshots, `TODO.md`, the plan, possibly `coaches.module.css`,
  `lib/db.ts`, `scripts/layout-screens.mjs`), check `git diff <file>` and commit only S3's hunks — the temp-index method in
  the auto-memory note "Partial commit out of shared files". `git diff --cached --name-only` before committing;
  `git show --stat HEAD` after.
- Message: "Club Tier Stage 14 S3: bring back a past player and 'Same child?' — …" naming the behaviour, and the migration;
  end with the attribution lines the session's system reminder gives.
- Then record the commit hash in the Progress block, the plan's 14b line and the TODO line (positive facts with anchors —
  "committed `<hash>` <date>"); prod mig 438 stays `pending` in MANUAL_PROD_STEPS (owner's step; pre-check in its note;
  after 435, and number order with the bank session's 436/437).
- Offer `/release`? No — releases are the owner's call; just say prod steps owed: migs 435 → 438.

**Next after this run:** S4 (documents and the health check, 14c) — its own session from the build prompt.
