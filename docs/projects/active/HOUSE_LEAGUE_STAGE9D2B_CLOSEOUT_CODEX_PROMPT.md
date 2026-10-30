# House League 9d-2b close-out: apply the settled words, run the lifecycle check, check the layout (build prompt, one session, for Codex)

> Written 2026-10-29, after the §422 walk (17 of 18, F1 is a setup step) and the `/marketing` pass. **Paste into a new Codex chat on
> `dev`.** One session; no `/clear` needed. This is **not a feature**: 9d-2b Parts 1 to 7 are built and walked (§418, §420,
> §421, §422). It closes the stage: the owner's accepted words go into the product, a runtime check that was written and never run
> gets run, and the changed screens get a layout check.
> You are Codex. Read `AGENTS.md`, `AGENCY_RULES.md` and `CLAUDE.md` first (this repo's Next.js is not the one you know; one
> shared branch `dev`; stage explicit paths only; **commit only when the owner says**). Then read **sections 2, 3 and 4 only** of
> `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`: they are rules every Codex session here starts from (the billing parts
> of that file are not yours). `/review`, `/simplify`, `/docs`, `/design` and `/marketing` are Claude Code commands you do not
> have: Part 4 says what to do instead.
> **Every file name and line number below is a lead, not a fact: re-open the lines before you build on them.** The leads came
> from a helper's read and from me opening a few of them; a plan has been wrong in this repo before.

## What the owner sees after this

- A club owner who sends a change that **only moves house-league games** no longer reads "Send to 0 people". The window says
  **Send to league admins**, the heading says who is told, the confirmation says the league admins are told, and the hint says
  families hear when a league admin sends them. Today the window tells that owner nobody is told, which is false.
- The statement at the top of the Send window says, in every mix of rep teams, house-league teams and games, **who is really
  told**. Two of its three mixes are wrong today (they leave the league admins out).
- A games row whose time the club took back reads "time taken back", not "taken back" (which reads as a cancelled game).
- The league admins' bell tells them what their next step is ("Families hear once you send them.") and its game lines stop
  carrying two colons in a row.
- A family's "games changed" email says "New date:" where it said "Date set:", and "…will tell you the new date."
- Nothing else on any screen changes. A reviewer who sees another visible change has found a mistake.

## Part 1 · Apply the words (the settled list is `HOUSE_LEAGUE_STAGE9D2B_COPY.md`: read it whole, it is 13 rows)

The words are **ruled and accepted** (owner, 2026-10-29: "all as proposed"). Do not rewrite, shorten or improve them; if a
word cannot be built as written, say why in the hand-off and stop on that row. Rows 1 to 4, 6 and 7 are logic, not string swaps.

| Row | Where the lead points | What the build does |
|---|---|---|
| 1, 2, 3 | `components/admin/kit/club/schedules/SendWindow.tsx` ~152 to 157 (button and heading) and ~139 (the confirmation); `lib/club-schedule-words.ts` ~844 to 872 (`whoChanges`, `sendToPeople`, `sentNotice`) | Add the "games-only" words as **new keys** beside the old ones; do not edit what the other kinds read. **Games-only is** `kind === 'changes'`, no rep team ticked, no house-league team ticked, and at least one house-league game in the preview. Compute it **once, before the send**, and use that same value for the heading, the button and the confirmation; do not infer it from the response (a send whose emails all failed has `people === 0` too, and must keep its failure wording). Every other send is byte-for-byte what it is today. |
| 4 | `SendWindow.tsx` ~265 to 267; `lib/club-schedule-words.ts` ~850 to 854 | Games-only: show **only** the new hint sentence (today `changesHint`, "Each team's coaches get one email…", prints first and is untrue there). Not games-only: unchanged, **except** that `changesHintLeague` (it ends with the old sentence, line ~852) takes the same last sentence so the two stay in step. That one edit is derived, not listed by the owner: say so in the hand-off. |
| 5, 6, 7 | `lib/club-schedule-words.ts` `changesStatement` ~54 to 65; called at `lib/club-schedule-send.ts` ~772 | Truth table below. Keep the `; X handed its slot back itself` clause and the closing "Nothing else on the schedule moves." exactly as they are. |
| 8 | `lib/club-schedule-league-words.ts` ~68 (`leagueGamesLine`) | `…: time taken back`. Its comment above it says "taken back" is `[marketing]`: replace that tag with "settled 2026-10-29, `HOUSE_LEAGUE_STAGE9D2B_COPY.md`". |
| 9, 10 | `lib/league-schedule-words.ts` ~160 to 161 (`SCHEDULE_EMAIL_WORDS.dated / undated`) | As written. Keep `endSentence` on `dated`. |
| 11 | `lib/league-schedule-words.ts` ~101 (`undoClub`) | As written. |
| 12, 13 | `lib/club-schedule-league-words.ts` ~206 to 216 (`LEAGUE_ADMIN_NOTICE.body`); `lib/club-schedule-send.ts` ~993 (`gameLines`) | 12: append the sentence **only inside the `gamesWaiting > 0` branch**. 13: build `${g.divisionName} · ${g.line}`; fix the doc comment that shows the old form. |

**The statement's truth table** (`told` clause; inputs: `changedTeams` = rep teams, `leagueTeams` = house-league teams,
`leagueDivisions` = divisions whose games are in the send; `D` = "division’s" when `leagueDivisions === 1`, else "divisions’",
built through `possessive()`, never by hand):

| rep teams | HL teams | games | `told` |
|---|---|---|---|
| any | 0 | 0 | `Only those teams’ coaches are told` (unchanged) |
| >0 | 0 | >0 | `Those teams’ coaches are told, and so are the D league admins` |
| 0 | 0 | >0 | `Their league admins are told, and families hear from them` |
| any | >0 | 0 | `Their coaches are told, and so are the house-league team’s families` (singular / plural as today; unchanged) |
| any | >0 | >0 | the row above, then ` and the D league admins` (so: `…families and the divisions’ league admins`) |

Add a unit test with **one assertion per row above** (and the singular / plural of `D`). The reach clause ("The changes reach …")
does not change.

**Tests that pin the old words** (`tests/unit/league-schedule-email.test.ts` ~36 to 38, `tests/unit/club-schedule-league-plan.test.ts`
~284): edit them to the new words; do not loosen them. Add a test for the league admins' bell body (the new sentence present
when games wait, absent when only drafts moved) and one for the game-line separator.
⚠ `lib/club-schedule-league-words.ts` and `tests/unit/club-schedule-league-plan.test.ts` **already carry uncommitted edits from
another session**. Read `git diff` on them first, leave those hunks exactly as they are, and when you stage, stage only your
own (if you cannot separate them, do not commit that file: list it in the hand-off).

**Other places that may quote the old words** (grep each, change only a quotation of a string in the table; leave unrelated
uses of "taken back"): `lib/help-content/house-league.tsx`, `lib/house-league-coach.ts`, `lib/league-schedule-health.ts`,
`lib/league-season-calendar.ts`, the demo files, and anything under `docs/agents/`. Help content is `/docs`'s job: if an article
quotes a changed word, change that quotation and say so; if an article *describes* a flow that changed (the games-only send),
list it as owed to `/docs` rather than rewriting it.

## Part 2 · Run the lifecycle check that was never run

`.probe/9d2b-p7/routes.mjs` (written in Part 7, **never run**) walks a division's schedule through the real routes: draft, publish,
edit, undo, send, urgent cancel, refusals. It builds a throwaway division, **always deletes it and restores the season's rules**
in `finally`, and refuses to run against production.

1. Start the dev server **only** with `npm run dev`, with network access (Supabase calls fail with `EACCES` in a sandbox).
   Confirm `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200 and the log has no `EACCES`.
   New files from Part 1 mean the server restarts once, near the end (see Part 4); migrations 410 to 413 are dev-applied
   (check the dev snapshot, do not assume), and **you apply nothing to production**.
2. Run `node --env-file=.env.local .probe/9d2b-p7/routes.mjs`. The previous attempt stopped because the probe's sign-in
   (`uat-club-owner@uat-rep-club.local` with `devpass123`) did not work on dev. The §422 walk signs in as that owner with
   **`UATPassword2026!`**, so try that password first; the file is a probe, so changing the password constant in it is fine.
   A seeded account's password is never reset by you (resetting one signs everyone out).
3. A failure is a finding. **Report it with the output; do not edit the probe to make it pass.** Fix it only if the cause is a
   small defect in 9d-2b's own code (then add a test that fails without the fix and say so); anything larger, or anything in
   shared automation, is reported, not changed.

## Part 3 · The layout check

Run `npm run check:layout -- --changed` for the screens Part 1 touched (the Send window and the league admins' tray are the
leads; confirm which screens the script picks up). **No whole-product sweep on the dev server** and no baseline refresh: those
run on staging. Report what it checked, and anything it flagged on a screen you changed.

## Part 4 · Cleanup, self-review, the hand-off (in place of `/simplify` and `/review`)

1. `npm run verify:changed`, then `npm run typecheck` (shared word files changed). One at a time. Report a failure with its
   output. Known and not yours: `verify:changed`'s ESLint step has crashed on the shared react-hooks config; if it does, say so
   and run `npm run lint:focused -- <your files>` instead.
2. Self-review your diff against these, and say what you found: a string built in two places that should be one; the games-only
   boolean computed more than once; a "0 people" path still reachable from a games-only send; `check:spelling` clean ("league
   admin" and "league admins" are the product's words; grep any word with a known variant before using it); no second spelling of
   "Needs a new date"; `possessive()` used for every possessive.
3. Records, same unit of work: in `HOUSE_LEAGUE_STAGE9D2B_BUILD_PROMPT.md`, update the Progress block's `▶ NEXT` line to say the
   close-out is done (or what is left) and add the `/review` / `/simplify` / `/docs` owed list; in `HOUSE_LEAGUE_STAGE9D2B_COPY.md`
   add "built, <date>, <commit if the owner has committed>" under the title. Do **not** write to the in-repo `memory/` folder and
   do not touch `TODO.md` beyond ticking a line you were asked to.
4. Restart the dev server once, at the end, and say you did (new files and shared word files changed).
5. **Hand-off, in this order:** (1) what each role now sees, in plain words; (2) the files changed, grouped, and which of them
   already carried another session's edits; (3) every check run with its result, and every check skipped with why; (4) the
   lifecycle probe's output, step by step; (5) owed: `/review`, `/simplify` only if you added a shared abstraction, `/docs` for
   any article that describes the games-only send, and the owner's browser check of the games-only Send window; (6) anything you
   decided that this prompt did not rule.

## Not in this close-out (say so, and stop, if a step drifts toward one)

- Any new or changed word beyond the 13 rows. If you think a word is wrong, say so in the hand-off; do not fix it.
- 9d-3 (a team's first practice notice and house-league calendars) and 9e (game day): neither is drawn or ruled. Do not start
  them, and do not "prepare" for them.
- Applying any migration to production, running the demo reseed, editing `.claude/settings*.json` or any hook or script a hook
  runs, or the database checks and gates (`WATCHED_PATHS` in `scripts/check-agent-automation.mjs`).
- The "Owner calls open" listed under §421 and §422 in `OWNER_QA_LEDGER.md` (a club change has no Undo; Games per team is per division; the rules door sits at the window's foot). They are the owner's, still open.
- Restating a plan name, price or gate (`docs/agents/strategy/PLAN_PRICING_FACTS.md` is canonical).

## Definition of done

Every row of the settled list is in the product, or the hand-off says exactly which row could not be and why. The games-only send
no longer says "0 people" in its heading, button, confirmation or hint, and every other send reads as it did. The statement's five
cases each have a test. The lifecycle probe has been run and its output is in the hand-off. `verify:changed` and `typecheck` are
reported with their results. The owner can commit the work in one or two commits from your file list without separating anyone else's edits.
