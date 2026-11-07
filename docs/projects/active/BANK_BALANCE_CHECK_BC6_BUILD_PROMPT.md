> **✅ BC6 DONE 2026-11-06 — BC6b done** (routes, permissions, the history decision, the D1 guard, dev probe
> `BANK_BC6B_PASSED`; `/review` high-risk; plan §9 BC6 has the anchors and the kept edges). **Next BC7** (its own prompt).
>
> **BC6a done 2026-11-06** (rules + reader + tests, `/review` standard with 1 High fixed; plan §9 BC6 has the anchors,
> the three owner rulings are in §0 "O5: season start", "Q1 look-back", "Still waiting across the rollover", and the
> BC6b route notes are under "⚠ For BC6b"). **Next BC6b.** Note for BC6b: `readTeamBank` takes `{ orgId, season,
> today, date }` (the team is the season's).

# Bank balance check BC6: the coach's source and routes, no screen (build prompt, two sessions)

> **Written 2026-11-06**, after BC5 was committed (BC5a `0ec285816`, BC5b `23df998bc`; plan §9 BC5). **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC6_BUILD_PROMPT.md` into a new chat on `dev`.** The first session
> builds **BC6a**; it ends by writing one line at the top of this file ("BC6a done …, next BC6b") and the second session
> starts at BC6b. ⚠ **First check BC5b is committed** (`git log --oneline -8 -- components/admin/kit/club/money/bank/`
> shows a "BC5b" commit). If it isn't, stop and ask the owner.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (the recipe is the auto-memory note `reference_partial_commit_shared_tree`: a private index built on the current
> HEAD, `BASE` recorded at `read-tree`, the pre-commit hook run on that index, a HEAD guard immediately before
> `commit-tree`, a compare-and-swap `update-ref`; files other sessions also edit, such as `TODO.md` and
> `DATA_DICTIONARY.md`, are built as HEAD + your exact edit; BC5b's `.probe/bank-bc5/commit.sh` + `commit.cjs` is a
> working copy of the recipe). ⚠ This repo's shell drops backslashes in heredocs and a backtick inside a `node -e` string
> EXECUTES: write edit scripts with the Write tool, or use the Edit tool.
>
> **Why two sessions:** BC6a is the coach's figure and Find as pure rules and a reader, with tests (the arithmetic and
> the season edge are where the risk is); BC6b is the routes, the permissions, the "a year is a decision" record and a
> dev probe. Neither draws a screen: BC7 does (the Ledger's Bank view, desk and phone).
>
> **Not in BC6:** any screen (BC7); the Money Overview line, the season-close warnings, the team report, the club's
> Teams column and coach help (BC8, after Stage 14); the prod apply of migrations 447, 449 and 450
> (`MANUAL_PROD_STEPS.json`, one promote with the bank code). ⚠ BC8 still owes the owner a question: R0 tab 7 draws a
> club Teams column "Bank checked" that reads each team's bank, against the owner's 2026-11-06 ruling that the club sees
> one cash figure per team and never a view into a coach's books (auto-memory `decision_coach_books_stay_the_teams`).
> **BC6 builds no club read of a team's bank at all.**

## What is already there (read the code, not this list, before acting on a claim)

- **The database supports a team account now.** Mig 447 (`supabase/migrations/447_the_bank_check_is_a_balance.sql`):
  `bank_accounts.owner_kind` `club | team` with `team_id` (`bank_accounts_owner_shape`; "Team: exactly one, belongs to
  the team (not a season)"); `bank_checks.book_ids` is NULL for a team; the save function's team branch (~line 368)
  "counts the season's register, never a club book; it has no starting statement", while `no_start` is the club's only
  (~line 386). Read the whole save function and its arguments before writing a step: what it re-checks under its lock
  for a team, and what the caller must pass (the books figure? the season?). Decide from the live dev schema
  (`docs/agents/db/schema-snapshots/`, or `information_schema`), never from the migration text alone.
- **The engine** (`lib/bank-check.ts`, pure): `figureCheck`, `savedTerms`, `reportTerms`, `startingPoint`,
  `booksNowSay`, `latestBefore`, `suspectsSince`, `findHints`, `stillWaitingOn`, and **`coachBooksOnDate`** (Cash on
  hand's own arithmetic with a cutoff, BC1, tested). The cash figure ("Cash not deposited yet", ask 1) is the engine's
  `cashCents`; the club form never sends it, the coach's will.
- **The club side to copy from, not to share by force:** `lib/bank-club-map.ts` (pure), `lib/bank-club-read.ts` (reads),
  `lib/bank-club-rules.ts` (`savePlan`, `checkView`, `checkedThrough`, refusal codes → statuses),
  `lib/bank-club-steps.ts` (route steps), `lib/bank-check-words.ts` (refusals, one home), routes under
  `app/api/admin/accounting/bank/**`. Where a piece is truly the same for a team (the saved-check shape, `checkView`,
  the refusal words), share it; where it is club-shaped (books placed in accounts, Stripe on its way, the starting
  statement, Waiting at the start), the coach side doesn't have it. ⚠ No Stripe on its way for a coach (P4 is the club's;
  the coach's online money is not in this project).
- **The coach's books:** `lib/coach-register.ts` (`cashOnHandCents` ~297) and `lib/coach-register-book.ts` (the season's
  register rows). P2': "Your books on D" = the season's opening balance + every settled, cash-moving row dated ≤ D. A
  family-paid vendor row is already left out.
- **Coach permissions:** `lib/coach-capabilities.ts` (`canWriteMoney`, `canViewMoney` ~551). B7: money write may check;
  money read sees the checks and the mark. Each check records who and when; no second approver.
- **Coach routes live under** `app/api/coaches/[orgSlug]/teams/[teamId]/…` (look at a money neighbour such as
  `expenses` or `budget-vs-actual` for the auth helper, the live-season gate and the refusal shape).
- **The season rule (CLAUDE.md, binding):** a coach's season is live until closed; a closed season is one page; a year
  parameter is a DECISION (`HISTORY_ENDPOINTS` in `tests/unit/coach-history-endpoint-guard.test.ts`). The bank is an
  INSTRUMENT on the working season (B9, B10: the closed-season page shows nothing of it).

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0 (rulings 1, 3, asks 1–10, **Q1** "a cheque across a coach's rollover", B1, B7,
   B9, B10), §1 P2' and the Q1 disagreement, §4 (the formula, the coach's books line), §5 (the coach rows: "From the
   {2025 Season}", "Statements from this season only, since {date}.", the before-season refusal), §6 (the coach build
   notes: grep "coach" and "K7"), §9 BC6–BC8, "Architectural decisions", and the open question **O5** (the season's start
   date).
2. The drawings: `BANK_BALANCE_CHECK_DRAWINGS.html` (https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN), the coach
   frames (grep "coach" / "K"): what the routes must be able to answer for BC7. Settled words win over drafts.
3. Memory: `decision_coach_books_stay_the_teams` (D1: the club never reads a coach's books), the coaches-portal season
   rule in CLAUDE.md, `feedback_past_decisions_are_reference_not_authority`, `feedback_ruling_record_drift`.
4. Guards: `tests/unit/bank-r2-server-guard.test.ts` (the bank server's rules, incl. "no bank code writes a book line"),
   `tests/unit/coach-history-endpoint-guard.test.ts`, and whatever pins coach money routes (grep `tests/unit` for
   `canWriteMoney`).

---

## BC6a — the coach's figure and Find, as rules and a reader (session 1)

### Ask the owner first (one AskUserQuestion, before the UX summary), only what the code leaves open

Verify each against the code first; drop a question the code or a ruling already answers, and add one the code raises.

1. **O5, the season's start date** ("Statements from this season only, since {date}" and the before-season refusal).
   **Recommend** whatever `rep_program_years` (or the season row the register reads) actually carries: its own start
   field if one exists, else the date the season was created or rolled into. Say which field, with its value on a dev
   team, in the question.
2. **The coach's first check.** Ask 7: "a coach's season opening balance is the start, no question". Confirm what the
   first check's Find covers (ask 3: every line since the last check that matched, so on a first check every line of
   the season) and how Q1's look-back reaches last season (lines dated after last season's last MATCHED check, read by
   the bank route itself, no year parameter from the page, under "From the {2025 Season}"). **Recommend** as ruled; ask
   only if the register's shape makes "after the last matched check of last season" ambiguous (a season with no check
   at all: recommend the last season's final 60 days, as the club's Q2 look-back, and say so).
3. **A team's account across seasons.** Mig 447: one account per team, not per season. **Recommend:** saved checks of
   a closed season stay in the table but every read filters to the working season's dates (B10), and "Books now say" on
   a working-season check re-figures from the working season's register only.

Record the answers in plan §0 as ruled (add nothing they did not rule).

### Before any code: the UX summary (blocking)

`AGENCY_RULES.md`: a plain-language summary for a product manager first. BC6 draws nothing, so say so plainly: what the
coach will be able to do once BC7 draws it, which questions BC6 answers on the server (the books on a date, what's
missing, a cheque from last season), who may check (money write) and who only reads (money read), and that the club
sees nothing of it. Wait for yes.

### The build

1. **Pure rules** (a coach module beside the club's, e.g. `lib/bank-coach-map.ts` / `-rules.ts`; name them by what the
   code already does): the coach's books on D (through `coachBooksOnDate`, never a second copy of Cash on hand's
   arithmetic), the season window (O5), the suspects since the last match with Q1's look-back as a separate list (its
   divider is BC7's), the save plan (the date not before the season's start, not in the future, each Not-in-the-bank-yet
   line one of this team's own register rows in the window, the cash figure ≥ 0), `checkedThrough` for a team.
   Unit tests to the cent, the drawing's coach examples first.
2. **The reader** (`lib/bank-coach-read.ts`): the team's account (none until the first save), its live checks in the
   working season, the figure for a date, "Books now say" re-figured over the working season's register. Bounded reads;
   a failed read throws on the Bank view itself (there the bank IS the page), and any later quiet read is BC8's.
3. **No migration expected.** If the save function's team branch needs one: `/dba` first, the schema = dictionary rule,
   its prod apply parked with 447/449/450.
4. **Checks:** the bank tests, the new coach tests, `npm run typecheck` (`NODE_OPTIONS=--max-old-space-size=8192` if it
   runs out of memory), focused lint, `check:spelling`.
5. **Then** `/review` (standard), records (plan §9 BC6, BC6a's anchors), the "BC6a done" line here, commit on the
   owner's yes, recommend `/clear`.

---

## BC6b — the routes, permissions and the history decision (session 2)

### The build

1. **Routes** `app/api/coaches/[orgSlug]/teams/[teamId]/bank/**`, mirroring the club's where the shape is the same:
   GET the account (+ `?date=` for the figure), POST a check (the account is created at the first save, named "Team bank
   account", no setup question), DELETE a check (one question is BC7's; the route soft-deletes, who and when kept).
   `canWriteMoney` for writes, `canViewMoney` for reads; refusals through `lib/bank-check-words.ts` (new coach codes get
   their sentences there, settled by BC8's `/marketing`, drafted plainly now). A team with no live season: every write
   refused server-side (CLAUDE.md: the season gate is not a client nicety), and reads answer nothing past the gate.
2. **The history decision, written down.** The bank route reads last season's lines for Q1 with no year parameter. Keep
   `HISTORY_ENDPOINTS` unchanged and record, in the plan's BC6 entry and in the route's header, CLAUDE.md's three
   questions: record or instrument (an instrument on the working season; only Q1's look-back reads back, and only lines,
   never a closed season's checks), the whole subtree (BC7's view only), and how the coach tells which season they read
   ("From the {2025 Season}"). If the guard fails, that is the decision point: stop and ask the owner; never widen the
   list on your own.
3. **D1 guard:** a source test that no club route, club reader or club screen imports the coach bank reader or reads a
   team-kind `bank_accounts` row (the club's own reads already filter `owner_kind = 'club'`; pin it).
4. **Checks:** as BC6a, plus `tests/unit/coach-history-endpoint-guard.test.ts`, `bank-r2-server-guard.test.ts`.
5. **Prove on dev:** a probe `.probe/bank-bc6/bc6.mjs` as a uat coach with money write (and one with money read) on a
   live season: the first save creates "Team bank account"; a matching check; an off check with a register row marked
   Not in the bank yet and a cash figure; the figure for a date before the season start refused; a reader's write
   refused; a team with no live season refused; delete what it saved. Find the coach sign-ins under `tests/uat/.auth/`
   (`rep-club-coach.json`; a standalone coach portal one if there is one) and say which team and season it used.
6. **Then** `/simplify` if a shared piece appeared between the club and coach modules, `/review` (high-risk: coaches
   write paths), records (plan §9 BC6, §0 rulings, the TODO line as HEAD + your exact edit, the auto-memory note
   `project_bank_reconciliation.md` and its MEMORY.md line, the PM brief). Mark this prompt done. Commit on the owner's
   yes, then hand off in product-owner voice and say what's next (BC7, the Ledger's Bank view; the BC8 Teams column
   question for the owner).

## Out of BC6

Any screen (BC7), the coach touchpoints, the club's Teams column and coach help (BC8), the prod apply of 447/449/450,
any club-side read of a team's bank, any change to hooks, checks or baselines, a kit component change the owner hasn't
agreed to.
