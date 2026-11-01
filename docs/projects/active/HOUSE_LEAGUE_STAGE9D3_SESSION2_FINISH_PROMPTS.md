# House League 9d-3 Session 2 — finishing it: five steps, one fresh chat each

> Written 2026-11-01, after Session 2 (Parts 5–7) was built and left uncommitted. The owner runs each step in a NEW chat on
> `dev` (after `/clear`), pasting the step's prompt below. **Each step ends by printing the NEXT step's prompt, verbatim from this
> file, inside one fenced block**, and then stops. Step 5 is the last.
>
> Every step starts the same way: read the **▶ Progress** block of `HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md` (Session 2 lines at
> the bottom of it) and its **Shared-file traps**. Re-verify every lead against the code: other sessions share this working copy.
> Another session's uncommitted hunks sit in `tests/unit/league-practice-tell.test.ts` and `lib/club-schedule-league-mail.ts`
> (a "teams published" filter in `readHouseholds`) — **not ours, never edit or commit them.** Nothing is committed until step 5.

## Session 2's files (the scope of every step)

- **Migrations:** `supabase/migrations/415_families_are_told_their_practice_times.sql` (only the `coaches_copied_at` hunk),
  `supabase/migrations/420_a_house_league_coach_subscribes_to_the_schedule.sql` (new), `supabase/migrations/MANUAL_PROD_STEPS.json`
  (the 420 entry + one sentence on the 415 entry). Both on **dev only**; prod `pending`.
- **Code:** `lib/league-practice-tell.ts` (coach words at the end), `lib/league-practice-coach-copy.ts` (new),
  `lib/league-practice-tell-server.ts` (two `copyCoachesOnFirstTell` calls + import), `lib/house-league-coach.ts` (told line,
  `readGamesAsSent`, `readCoachFeedEvents`, `readCoachFeedTeam`), `lib/league-coach-calendar.ts` (new), `lib/coach-calendar-link.ts`
  (signing domain), `lib/calendar-subscribe-words.ts`, `lib/email-kinds.ts` (one kind), `components/coaches/CoachCalendarSubscribe.tsx`
  (two optional props), `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/` `page.tsx`, `CoachSchedule.tsx`, `CoachSubscribe.tsx`
  (new), `CoachTeam.module.css`, `app/api/calendar/league-coach/[token]/route.ts` (new),
  `app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/calendar-link/route.ts` (new).
- **Tests:** `tests/unit/house-league-9d3-coach.test.ts` (new).
- **Records:** `docs/agents/db/DATA_DICTIONARY.md` (two hunks: `coaches_copied_at`; the two `league_team_coaches` calendar
  columns), the dev schema snapshots, the build prompt's Progress block, `HOUSE_LEAGUE_STAGE9_PLAN.md` §9 (last entry),
  `HOUSE_LEAGUE_STAGE9_PM_BRIEF.md` (item 7's status), the 9d-3 line in `TODO.md`, this file.

---

## Step 1 — /simplify

```
On dev. House League 9d-3 Session 2 is built and uncommitted. Run Step 1 of
docs/projects/active/HOUSE_LEAGUE_STAGE9D3_SESSION2_FINISH_PROMPTS.md: read that file's header and file list, then the
▶ Progress block and Shared-file traps of docs/projects/active/HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md.

Run /simplify on Session 2's files only (the list in the finish-prompts file). Quality only, NO behaviour change. Look at:
- lib/league-coach-calendar.ts against the rep's link functions in lib/coach-membership.ts and lib/coach-calendar-feed.ts
  (mirrored, not shared — share only where it stays readable and the club-stage6d tests still pass byte-for-byte);
- readCoachFeedTeam vs the team read inside readCoachTeamPage (lib/house-league-coach.ts) — one team read if it is clean;
- lib/league-practice-coach-copy.ts (reads in parallel, the emailHtml import from club-schedule-send.ts and its circular import);
- the coach line rule (coachToldLine) and CoachSchedule's "No practices yet." handling;
- CoachSubscribe.tsx over CoachCalendarSubscribe (the two optional props are the reuse — do not fork the window).
Do not touch the other session's hunks (league-practice-tell.test.ts, readHouseholds). Do not touch shared automation.

After: typecheck (NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .), the related tests
(tests/unit/house-league-9d3-coach.test.ts, league-practice-tell, club-stage6d-*, house-league-coach-read-guard,
family-email-guard, support-console-stage5-guard, the public-form throttle guard), focused lint on the changed files,
check:spelling. Add a "/simplify ✅" line to the Progress block (what changed, what was left and why). Do NOT commit.

Then tell me in product-owner words what changed (one short paragraph), and print Step 2's prompt from the finish-prompts
file verbatim in one fenced block, and stop.
```

## Step 2 — /review

```
On dev. House League 9d-3 Session 2 is built, /simplify done, uncommitted. Run Step 2 of
docs/projects/active/HOUSE_LEAGUE_STAGE9D3_SESSION2_FINISH_PROMPTS.md: read its header and file list, then the ▶ Progress
block and Shared-file traps of docs/projects/active/HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md.

Run /review (the repo's funnel, .claude/commands/review.md) on Session 2's uncommitted hunks only, HIGH risk (new public
feed, a signed credential, a migration with a trigger, email sends). Read each finding against the code before believing it.
Make sure the finders look at:
- the token: a house-league token never verifies as a rep one or the reverse; rep tokens byte-identical;
- the feed's stop rules: removed seat, Reset, a seat's person replaced, never accepted, season not live, team/org mismatch —
  each an EMPTY calendar, only a forged token the counted 404; no plan gate (none is ruled); private cache;
- Reset's compare-and-set; the link route's gate (own live seat, org + season slugs match);
- the coaches' copy: claimed once per team before sending, only a team THIS send told, accepted coaches only, never throws;
  what happens on a resend of an older notice, and on a send that reached nobody;
- the coach line: true in every state (told with nothing listed, changed with nothing listed, never-had);
- readGamesAsSent: the coach PAGE's games are unchanged by the refactor; the feed takes the whole season, games as last sent;
- mig 420: re-runnable, trigger on removed_at AND user_id, function grants; 415's added column + backfill;
- ConfirmProvider on the league page (Reset must ask), and the shared Subscribe window on the club's team-page skin.
Fix what is confirmed (re-apply a migration to dev only if it changed; dictionary + snapshots in the same unit). Carry the
rest as owner calls. Re-run typecheck and the related tests. Add a "/review ✅" line to the Progress block (fixed / cleared /
carried). Do NOT commit.

Then tell me in product-owner words what the review found and fixed, list any owner call it raised (recommended answer
first), print Step 3's prompt from the finish-prompts file verbatim in one fenced block, and stop.
```

## Step 3 — /docs

```
On dev. House League 9d-3 Session 2 is built, /simplify and /review done, uncommitted. Run Step 3 of
docs/projects/active/HOUSE_LEAGUE_STAGE9D3_SESSION2_FINISH_PROMPTS.md: read its header, then the ▶ Progress block of
docs/projects/active/HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md.

Run /docs (.claude/commands/docs.md) for Session 2's user-facing changes, in lib/help-content/house-league.tsx:
- the coach's guide: the line under Schedule (told on a date / not told yet / told different times / no practices yet — who
  sends them: a club admin or league admin), the one copy email on the first send, and Subscribe (their own link, what's in it:
  games once the division's schedule is published and as last sent, practices, cancelled events marked; live season only;
  Reset; a removed coach's calendar empties);
- the convenor's "Telling families their practice times" topic: the team's coaches get one copy the first time.
Words come from the code (lib/league-practice-tell.ts COACH_TOLD_WORDS / coachCopyWords, lib/calendar-subscribe-words.ts) —
never restate them differently. Update keywords / searchText. check:spelling. /marketing only if a product string changes.
Add a "/docs ✅" line to the Progress block. Do NOT commit.

Then tell me in one short paragraph what the help now says, print Step 4's prompt from the finish-prompts file verbatim in
one fenced block, and stop.
```

## Step 4 — walk B

```
On dev. House League 9d-3 Session 2 is built, /simplify, /review and /docs done, uncommitted. Run Step 4 of
docs/projects/active/HOUSE_LEAGUE_STAGE9D3_SESSION2_FINISH_PROMPTS.md: read its header, then the ▶ Progress block of
docs/projects/active/HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md. Walk B is the coach's side; one purpose.

1. Fixture, ADD-ONLY, dev only, never a seed or password reset: .probe/9d3-walkB/fixture.mjs in the style of
   .probe/9d3-walkA/fixture.mjs (same org/season: UAT Rep Club · 2026 Fall House League, U9 Rookie; refuse production).
   Accepted coaches already exist: Morgan Reid on Reds (uat-hl-coach-reds@uat-rep-club.local), Sam Blake on Blues
   (uat-hl-coach-blues@uat-rep-club.local) — check how earlier walks sign them in (e.g. CLUB_TIER_STAGE11B_WALK_3_PRACTICE_TIME.html).
   Modes: (none) print each team's told state and coaches_copied_at; --untold (Reds never told, copy marker cleared);
   --changed (Reds' told snapshot differs from its practices by one upcoming date); --never (a team "Purples" with Morgan's
   accepted seat — same user — and no practices ever); --remove-seat (removes Morgan's Purples seat); --reset (all of it back).
2. Restart the dev server per AGENTS.md (new files + migrations): stop it, then `npm run dev` with network access; verify the
   platform-admin login page answers 200 and no Supabase EACCES.
3. Check the Owner QA Ledger's LAST § right before numbering (walk A was §436; others have landed since). Build the walk as a
   checkable Artifact with paste-back (load the artifact-design skill; follow HOUSE_LEAGUE_STAGE9D3_WALK_A.html's format and
   save the source as docs/projects/active/HOUSE_LEAGUE_STAGE9D3_WALK_B.html). Parts: A the line in each state (told,
   --untold, --changed, --never); B the copy (a first send as the league admin copies the coaches once — the terminal shows who
   would have been emailed; Send again does not copy again; the fixture shows the marker); C Subscribe at a desk (button on the
   Schedule line, the window's words, Copy, the link in a browser gives the season's games and practices); D Reset (asks first,
   "New link made", the old link now an empty calendar); E a phone (the mark alone, the sheet); F who: Sam cannot open Reds'
   link address (404), Morgan's Purples link empties after --remove-seat, a finished season has no Subscribe (unit-pinned if it
   cannot be staged — say so). Plain words, PO voice; every step says who, what to do, what to see.
4. Ledger entry (§N, link, fixture, known-before-the-walk items), Progress block line, TODO line. Do NOT commit.

Give me the walk link and the fixture command, then STOP and wait for my paste-back. When I paste results: record them in
the ledger, Progress block and TODO (fix anything the walk asks for first, then re-walk only that part), then print Step 5's
prompt from the finish-prompts file verbatim in one fenced block, and stop.
```

## Step 5 — commit

```
On dev. House League 9d-3 Session 2 is built, reviewed, documented and walked. Run Step 5 of
docs/projects/active/HOUSE_LEAGUE_STAGE9D3_SESSION2_FINISH_PROMPTS.md: read its header and file list, then the ▶ Progress
block and the Shared-file traps of docs/projects/active/HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md.

I am asking for this commit: commit Session 2 (Parts 5–7, its /simplify, /review, /docs fixes, walk B and the records). Do not
push. Do not apply anything to production.
- `git rev-parse --abbrev-ref HEAD` is dev (switch if not). Stage EXPLICIT pathspecs only — never `git add -A` / `.`.
- Shared files carry other sessions' edits (DATA_DICTIONARY.md, the schema snapshots, MANUAL_PROD_STEPS.json, TODO.md,
  OWNER_QA_LEDGER.md, the Stage 9 plan, email-kinds.ts, migration 415): commit ONLY our hunks — build the staged blob from HEAD
  plus our exact edits (never a -U0 partial), diff it against the working tree so only foreign hunks remain. Leave the other
  session's league-practice-tell.test.ts and readHouseholds hunks out.
- `git diff --cached --name-only` before committing; typecheck the COMMITTED tree in a temporary worktree; run
  tests/unit/house-league-9d3-coach.test.ts there too.
- Message: what a coach now sees (the told line, the one copy email, Subscribe), mig 420 + the 415 column (dev only, prod
  pending, apply before the promote), the build calls; end with the attribution line from this session's system reminder.
- After: `git show --stat HEAD` — only our files. Record "committed <hash> 2026-…" in the Progress block, the TODO line, the
  plan §9 entry, the ledger walk-B entry and the auto-memory note (a second small docs commit is fine).

Then tell me in product-owner words what was committed and what is still owed (applying 415 and 420 to production before the
promote — my call; the schema-parity gate until then; the open items in the Progress block), and stop. This is the last step.
```
