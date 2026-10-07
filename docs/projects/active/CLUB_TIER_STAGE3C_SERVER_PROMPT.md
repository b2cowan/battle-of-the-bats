# Club Tier Stage 3c · session 1 — the server half (the club's fiscal year: its months, its close, its lock, its carry)

> Paste into a fresh session on `dev`. Written 2026-10-07, the day Stage 3c's drawings were **ratified** (hub
> version 46): the owner agreed with **every recommendation, Asks 1 to 7 and 8a to 8d**, and with **Ask 9**, asked
> after the drawings: **the club's year is called its "fiscal year"** (the club side only). **S3C-11**, found writing
> this prompt, was ruled the same day (call 1 below).
>
> **Stage 3c runs as two sessions** (3a's and 3b's precedent):
> 1. **This one:** every migration, read, write, refusal and gate. No club screen is rebuilt here, and the coach's
>    screens do not change here (the coach's Club tab gains its earlier-season bills in session 2; this session
>    supplies the read).
> 2. `CLUB_TIER_STAGE3C_SCREENS_PROMPT.md`: every 3c screen, built to the hub. It starts after this session's
>    commit and reads this session's call list.
>
> **Read first:**
> - Plan `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`: §4C **C10** and **C17**; §5 **D2** (a club
>   year with a label and a start month, a year-end; **no fiscal periods, no closing entries** in the first
>   release); **§6 Stage 3, the "⚙ 3c DRAWN" and "⚖ 3c RATIFIED" blockquotes** (every place the year is read, the C10
>   re-read, how a season meets the year, findings S3C-01…10, the asks, the Not-drawn list, the corrections). 3b's
>   session-1 record and call list in the same section are what exists today.
> - **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 3c**.
>   - **"Where the year stands"** (`#s3c-status`) is this session's reading list: its table tags every place the
>     year is read today as *moves* / *stays* / *both*, with the file and line.
>   - **"Not drawn"** (`#s3c-build`) is this session's list. Every tag note on specimens 1–8 that names server work
>     is a requirement too; open each one.
>   - The Decisions tab's twelve Stage 3c rows are the rulings, in full.
> - `CLAUDE.md`, "A SEASON IS LIVE UNTIL IT IS CLOSED" — the coach's rules. **They stand.** Ask 1 departs from
>   them for the club's money tabs only (below); nothing here changes the coach's season model.
> - Memory: `project_club_tier_readiness`, `reference_coach_money_check_then_act`,
>   `reference_cascade_collisions_coach_budget`, `project_coach_budget_one_word_one_line`,
>   `reference_code_gotchas_index` (the club's day, never UTC; `formatStoredDate` / `formatTime` only),
>   `reference_server_meaning_change_breaks_live_screen`, `reference_prod_release_history` (a DROP-COLUMN
>   migration goes on LAST).

## The rulings this builds (owner, 2026-10-07: "agree with this recommendation and also all recommendations on the mockup")

- **Ask 9 · the word.** The club's period is its **fiscal year**: one spelling everywhere a club person reads it,
  never "financial year", never on the coach's side. It names the period and promises nothing D2 left out. Reads
  and exports return the year's **name** ("2025–26"), never a hand-built label.
- **Ask 1 · a closed fiscal year is read in place**, on the tabs that already read a year (Budget, Budget vs.
  Actual, the Overview), locked: every write **absent**. The server answers "can write: no" for a closed year,
  the answer the Budget already reads for a reader, so no screen grows a read-only branch.
- **Ask 2 · closing warns, never blocks.** It locks **every line dated in the year on every book the club owns**
  (the club's, a tournament's, the house league's) and the year's plan; it carries the closing balance; it never
  touches a team's own book. The question lists four kinds of open money, each counted, totalled and a door:
  installments still owed by the teams (late, and sent but not confirmed), requests waiting on the club, lines not
  filed under a budget word, cheques not cleared.
- **Ask 3 · Reopen:** whoever holds the club's accounting, the **latest closed year only**, with a **reason** that
  is recorded. The next year's opening follows the books again until the year is re-closed.
- **Ask 4 · the carry:** the closing balance becomes the next year's opening, **locked**; the plan carries only
  through "Start from" (exists); unpaid installments and waiting requests **stay in their year** and are listed on
  the open year's Overview until settled; money from them lands in the year it arrives, and Budget vs. Actual names
  it ("last year's bills, paid this year", Budgeted blank).
- **Ask 5 · setting the year:** Budget › Tools › the fiscal year's window, for `canMoveClubMoney`; anyone who opens
  Accounting reads it. The first month can change **until the first close**; after that only an **open** year's name.
  **A year that has begun keeps its months; the NEXT year is the short one** (never a long year). Planned lines
  dated past the short year's end move to the next year's plan with their dates; a line whose dates cross the new
  end is split by its dates, one line per year under the same word; **ledger lines never move**. A club whose year
  holds nothing simply starts on the new month.
- **Ask 6 · New allocation in the line's window** (session 2 draws it): one form for both doors; the split and the
  payment schedule chosen **once per bill** (Evenly · By amount · By percentage · By sessions; One payment or
  Installments with dates), a team's row may carry its own installments; **only open seasons**; the pasted
  ledger-entry id leaves.
- **Ask 7 · the payee window reads first** with the shared-payee report inside it; the report page retires; the
  report's **Export is dropped**.
- **Ask 8a** · "ledgers archive at year-end" is struck: **nothing archives a book**; archiving a finished
  tournament's book is Stage 7's.
- **Ask 8b** · **an unpaid club bill on an earlier season stays on the coach's Club tab**, under a band naming its
  season, until it is paid. No year or season parameter (the read is "still owed").
- **Ask 8c** · Budget vs. Actual's Compare gains **"Against last year"** (the club's only — the **seventh named
  difference** from the coach's).
- **Ask 8d** · **Undo, Reverse and Void are refused on a line dated in a closed year**, pointing at Reopen; a
  closed year's pending cheque **clears on the day it clears, in the open year**.

## Before code

- **Present the product-manager UX summary** (AGENCY_RULES). Short: the drawings are ratified. What a treasurer and
  a president will be able to do once session 2 lands, and the one change a head coach sees (the earlier-season
  band, from session 2).
- **Four calls. Call 1 is RULED (build it); calls 2–4 this session makes and states in that summary.**
  1. **⚖ S3C-11 · whose books a late payment of an old season's club bill lands in — RULED 2026-10-07 as
     recommended below.** Owner: *"I agree with your recommendation on the payment counting in the season that's
     running when the money actually moved. If a user wants to adjust the past books, they can open a past season and
     backdate the transaction."* What that means in the build:
     - The carrying season is the team's season **running when the payment is RECORDED** (the coach's "We've sent
       it", or the club's received / confirmed), **whatever date is typed** on it; the typed date stays the line's date
       inside that season.
     - **Adjusting a past season** = reopening it and recording the payment there with its real date. That is possible
       only while the team has **no** running season (the 2026-08-18 ruling; a club team's Reopen is the club's door);
       once the next season has started, a late payment always counts in the running season. **Do not build an undo of
       a rollover or a "file into a closed season" path** (season-close plan §3.4).
     - **The one edge left to you:** the CLUB records a payment while the team is **between seasons** (closed, the next
       not started). Recommended: the team's next season carries it when it starts, and until then the closed season's
       page and the club's "at close" figure do not move. State what you build.
     - **The finding, as found 2026-10-07, and the build:** the coach's register files every club bill's payment in
     **the bill's season** (`lib/coach-register-book.ts` reads `rep_allocation_splits` by `program_year_id`, then
     dates each installment by `clubInstallmentLeftTeamOn`). So when a bill made on a season is paid **after that
     season is closed** — the coach says "We've sent it" (Ask 8b now offers it) or the club records it received
     (3a, possible today) — the money lands in the **closed** season's book: its Cash on hand at close moves, the
     coach's closed-season page moves, and the club's 3b "held by the team · at close" figure moves. A September
     fiscal year makes it ordinary (fall bills land on the season that is ending). That breaks the binding rule
     that a closed season is a record. **Ruled:** the season whose books carry a club-bill payment is **the
     team's working season at the moment the payment is recorded**, stamped on the installment when it is sent or received
     (`carried_by_program_year_id`, or the session's better name), and the register and every Cash-on-hand read key
     a club payment's cash on that, while the bill itself (what was billed) stays on its own season. Backfill every
     existing row with its split's season, so **no figure moves at migration** (prove it with `check:register` and
     `check:money-report` before and after). The coach's closed season then never moves after its close, and the
     club's rule (money lands in the year it arrives) has its coach-side twin. A reopened season that is running again
     carries what is recorded while it runs, by the same rule — that is the owner's "open a past season and backdate".
  2. **The lock's mechanism.** Recommended: **one rule in the database**, so every writer is covered (3a's
     routes, the house league's fee lines, any future tournament line): a trigger on `accounting_entries` for
     club-owned books refuses an insert, update or delete whose entry date, old or new, falls in a closed fiscal
     year, with exactly one exception — a **pending** line dated in a closed year may become posted **re-dated to
     its clearing day in an open year** (it counted nowhere in the closed year; keep the day it was written, decide
     where). The plan's rows (`org_budget_lines`, `org_budget_periods`) and an allocation counting in a closed year
     are locked the same way. Routes pre-check, so the refusal is said in words before the database refuses; the
     trigger is the floor. State the choice if you differ, and why.
  3. **The fiscal year's key (S3C-08).** A first-month change makes two years share a number however a year is
     numbered (a short January–August "2027" and the "2027–28" after it). Recommended: a row per fiscal year with a
     stable id; the plan's lines key on it (replacing `org_budget_lines.season_year` and the partial unique index
     `org_budget_lines_one_line_per_item` with their fiscal-year twins); the Year pill and `?year=` carry a key that
     survives a rename and is never the name. Old `?year=2026` links on a January club keep landing (a number
     resolves to the January–December year it names). **Leave `season_year` in place this stage**: dropping a column
     is a separate migration that goes on prod LAST, after the code that stops reading it.
  4. **Where a request counts for the close question and the carry.** An allocation counts in its line's fiscal year
     (else its first due date's); a request has no line. Recommended: a waiting request belongs to the fiscal year
     it was filed in (in the club's day). Mirror whatever 3a's Overview already counts; don't invent a third rule.
- **Prod reads need the owner's go.** Read-only, once: the number of club budget lines and allocations on prod (mig
  317's verification found none on 2026-10-07) and any org with more than one plan year. Record the counts in the
  plan. If prod holds no club money, the backfill is a dev concern only; say so.
- **Git.** `git status` first: other sessions' hunks sit in this tree. Commit from a **private index** with explicit
  pathspecs (`git show --stat HEAD` after). **Commit only when the owner says.**
- **The dev server and the browser may be shared.** Ask before a restart, a sweep, a probe or `auth-setup` (**one
  browser tester at a time**).

## Preconditions

1. **The migration number.** 317 is the latest today. Take the next free number at the moment you write the file
   (`ls supabase/migrations`), and read `MANUAL_PROD_STEPS.json` for anything still owed.
2. **Decide what exists from the snapshots** (`docs/agents/db/schema-snapshots/`, live `information_schema`), never
   from migration files. As read on 2026-10-07: no first month anywhere on `organizations`; `org_budget_lines.season_year`
   is an integer; `accounting_ledgers` has `entity_type` (the club-owned kinds are `CLUB_OWNED_BOOK_KINDS`) and an
   `is_archived` nothing writes (`getClubOwnedLedgers` ignores it — leave it alone, Ask 8a); `rep_program_years`
   stores `year`, `name`, `status` and **no dates** (S3C-04; nothing here asks a season for its dates);
   `rep_allocation_installments` carries `sent_at`, `sent_on`, `paid_at`, `paid_on` and their methods/references;
   `rep_cost_allocations.source_entry_id` (the pasted id) and `source_budget_line_id`.
3. **Mig 317's functions take a year today** (`club_budget_roll_year`, `club_budget_line_add`, `club_budget_line_save`,
   `club_allocation_create`, `club_book_totals`, `club_budget_periods_refusal`). Each learns the fiscal year; read
   each before changing it, and keep its EXECUTE grants (service role only).
4. **The one-definition guard** (`tests/unit/club-money-one-definition-guard.test.ts`): read it before §2.

## What to build

### 1. The fiscal year (Asks 5, 9; S3C-08)

- **The migration** (dictionary + both snapshots in the same change): the club's **first month**; a **row per fiscal
  year** (the org, its name, first day, last day; its close: who, when, the closing balance it locked; its
  reopenings: who, when, why — a history, not one overwritten field). Invariants enforced in the database: per org,
  years never overlap and never leave a gap; a year is twelve months except the one short transition year; two
  years never share a name; a closed year's name and span can't change.
- **The one way to find a year:** "the fiscal year a day falls in" for any day, past or future, from the first month
  and the rows (a January club with no rows reads calendar years exactly as today — prove it: every 3b figure on the
  fixture is unchanged until a first month is set).
- **The name rule:** the year's number when it runs January–December; "2027–28" (en dash) when it crosses a New
  Year; an open year's name can be changed (unique per org). Exports write the en dash as a hyphen in a **file
  name** only.
- **Changing the first month (Ask 5), one database step:** refused after the first close. A year that has begun
  keeps its months; the next year is the short one, ending the month before the new first month; every later year
  runs the new twelve months. Planned lines and their periods dated after the short year's end move to the next
  year's plan with their dates; a line whose periods cross the new end is split by its periods into one line per
  year under the same word (one word, one line, per year); allocations keep their line; **ledger lines never move**.
  A club whose current year holds nothing (no plan line, no ledger line) just starts on the new month: no short year.
  The response says what moved (counts), because the window shows the consequence **before** the save — so also
  supply a **preview** read that answers the same counts without writing.
- **Who:** writes answer `canMoveClubMoney` (group scope where a team is named); reads, anyone who opens Accounting.
- **Fix with the year work:** "Start from last year's plan" copies a one-month line's stored label ("September 2026")
  unchanged while moving its date a year on — the copy writes the label from the moved date.

### 2. One definition of the year (S3C-01, S3C-02, S3C-03)

- `clubYearSpan`, `clubYearOf` and `allocationYear` (`lib/club-money-figures.ts`) take the org's fiscal years; the
  doc comments say so ("Until 3c…" goes). `readYearParam` (`lib/club-money-route.ts`) stops assuming four digits
  2020–2099 (call 3).
- **Every read returns the fiscal year it read** (key, name, first day, last day, closed or open, and whether the
  reader can write it), so no page works a year out again.
- **The server-side readings** move onto the one definition now: the checklist's budget step
  (`lib/club-checklist.ts`), the payee report's active teams (`lib/club-payee-report.ts`: a team is active in a fiscal
  year when it has a season numbered for either calendar year the fiscal year touches — S3C-03), the club's
  **quarters** (they start at the first month and are named by their months; the coach's `quarterKeyOf` and the
  coach's quarters are **unchanged**), the Scheduled lens's "this year only" test, the Months window (twelve months
  from the first month; a short year shows its own months), the Ledger doors' date range, and the two UTC readings
  (Allocations' "This year" from `createdAt`, the payee page's first year from `sharedAt`) — the club's day, never
  UTC.
- **The guard learns the rule:** extend the one-definition guard to refuse a by-hand year in the club's money files
  (a date's `.slice(0, 4)`, a literal `-01-01` / `-12-31`, `getUTCFullYear`). The **page files** that still compute a
  year by hand go on its `NOT_YET` list with their line numbers, for session 2 to empty (the list only shrinks). The
  hub's status table names them: Budget vs. Actual `page.tsx` (the current-year test, the Ledger doors) and
  `StatementBehindWindow.tsx`, the Overview's `accounting/page.tsx`, `LedgerWindows.tsx` (the Filed under hint),
  `allocations/page.tsx`, `payees/[payeeId]/page.tsx`.

### 3. Close, Reopen and the carry (Asks 1–4)

- **Close, one database step:** refused unless the year has ended (the club's day is after its last day), refused if
  already closed, and **years close oldest first** (an older open year that has ended must close first). Records who
  and when and the **closing balance**: every club-owned book, posted lines through the last day (`club_book_totals`;
  pending and void count nowhere). Re-checked after the write, as 3a's moves are.
- **The close question's read:** the four kinds of open money (Ask 2), each with its count, its total and the target
  its row opens (the allocation's team bill, the request, the Ledger narrowed to the unfiled lines, the Ledger
  narrowed to the pending lines); what it locks (counts of lines and books); the balance it will carry. A re-close
  after a reopen also says what changed since the first close (from the reopen history).
- **Reopen, one database step:** the latest closed year only, a reason required (non-blank), appended to the history;
  the year's stored closing stops being authoritative until it is re-closed.
- **The carry:** a year whose predecessor is closed opens on that stored closing, **locked**; otherwise the opening is
  worked out from the books as 3b does. The arithmetic gate proves opening(next) = closing(closed) to the cent.
- **The Overview's reads:** "a year has ended and isn't closed" (the oldest such year; its name and last day; shown
  to `canMoveClubMoney` only); **"From 2025–26, still open"** — the closed years' unpaid installments and waiting
  requests, until settled; a closed year's band reads its **closing** (Cash on hand at its last day), never today's.
- **Budget vs. Actual:** under From the teams, receipts in the year against allocations counting in an **earlier**
  fiscal year form their own line ("last year's bills, paid this year" — the words are /marketing's), **Budgeted
  blank** (planned, in its own year; never the off-plan amber dash).
- **No notification.** Closing a year is the club's own act; nothing in it is news to a coach.

### 4. The lock (Asks 1, 8d; S3C-07)

- **Call 2's rule**, plus the routes' words: a write dated into a closed year is refused before it is made, by every
  route that writes a line on a club-owned book — an entry (add, edit, void), a transfer (create, void both halves),
  an installment received or confirmed, **Undo** a received payment, an approval and its **Reverse**, a plan line or
  its periods, Start from into a closed year, an allocation from a closed year's line, and the house league's fee
  lines. One refusal code (for example `year_closed`) carrying the year's name and whether Reopen is open to the
  caller, so the screen can say both ways out.
- **What stays allowed:** receiving or confirming an **old year's installment** (it writes a line dated today, in the
  open year — a bill still owed is the team's debt whichever year it counts in); the coach's "sent" and take-back on
  it; a pending line from a closed year clearing (call 2). **A team's own book is never refused for the club's year.**
- **Every read that offers a write says whether it may:** the Budget's plan read, the line's read, the Ledger's book
  read (a per-line "locked" for a line dated in a closed year: no edit, void, undo or reverse offered), the
  allocation's read (no edit of an allocation counting in a closed year; its installments still receivable). This is
  how session 2 drops writes without a read-only branch.

### 5. New allocation (Ask 6; S3C-09; C17)

- **The team list** (`team-options`): each team's **open season** only (draft or active — the coach's live season),
  worded as the season's name, and the reason a team has none ("no season running"). Today it returns every season
  with the database's status word (`team-options/route.ts` 48–51).
- **The create** (`club_allocation_create` and 3a's POST): refuses a **closed season** in the same step (today the
  server checks only that the season is the team's — `lib/club-budget-writes.ts` 351–366), refuses a line in a closed
  year, keeps 3b's "never above what is left". It takes the split and the schedule **once per bill** with a per-team
  override of installments, and the new **Evenly** split (today's three methods plus it). The amounts are cents; the
  closing row's sum must equal the amount — say the difference in the refusal.
- **"Bill from" for the door from Allocations:** a read of the open year's cost lines with something left (each with
  what is left), plus "an off-plan bill" (no line; it counts in the year its first payment falls due).
- **The pasted ledger-entry id leaves** (C17): the POST stops accepting `source_entry_id`; old rows keep theirs; no
  screen reads it.

### 6. The payee window and its report (Ask 7; S3C-03, S3C-10)

- The report read stays 3b's definition (both share stamps, out-of-pocket payments count, "Nothing recorded"), with
  the fiscal year and S3C-03's team rule; it also returns **which fiscal years hold records** for this payee, so the
  window shows a Year control only when there is more than one.
- **Export of the report is dropped:** its route branch goes on the retire list. The rename still autosaves; merge and
  delete are unchanged.

### 7. Against last year, and the year-end report (Ask 8c; specimen 5)

- **Compare › Against last year** on the Statement read, offered when the year before has books: this year's Actual,
  last year's Actual, the Change. On a **closed** year, two whole years; on the **open** year, to the same day last
  year; against a **short** year, the same months of the year before (the response names the span compared). The
  coach's Statement shapes are reused; the coach's Compare gains nothing.
- **The year-end report:** on a closed year the Overview's one Export is the **Year-end report** (Excel first, then
  PDF), read only from locked figures: the year's span and who closed it, the year at a glance, the Statement against
  budget and against last year, the club's books at both ends, the teams' standing with the club (billed, collected,
  still owed at the close), what carried, and **one line instead of the teams' cash** (the club never stores it, so it
  can't be stated at the year's end). On an open year the Export is 3b's board report, unchanged. A money PDF with
  seven or more columns needs a landscape `REPORT_SHAPES` entry.

### 8. The coach's Club tab (Ask 8b; S3C-05; call 1)

- **The read:** the Club tab's bills (`app/api/coaches/[orgSlug]/teams/[teamId]/allocations/route.ts`, through
  `getRepAllocationSplitsForTeam`, today the working season only) gain the team's **earlier seasons' bills that are
  still owed**, each with its season's name. **No year or season parameter** — the read is "still owed", the same read
  the Overview's `upcoming-payables` lane already makes; `coach-history-endpoint-guard` stays green. A paid or settled
  old bill leaves the tab and lives with its season, as today.
- **Still to pay the club** counts them; **Settled this season** stays this season's (session 2 draws the caption).
- **The installment route** already checks the split's team and org, not its season (verify): "We've sent it" and
  Take it back work on an old season's bill without a change — and then **call 1** decides which season's books carry
  the money.
- The Overview lane's door then lands on a tab that shows the bill.

### 9. The fixture

- `scripts/seed-club-fixture.mjs` (owner's go before `--reset`; a reset ends the club sign-ins — `auth-setup` after,
  with the owner's go). The walks need: **UAT Rep Club on a September fiscal year** with a **closed 2025–26** (its
  locked closing; at the close, unpaid installments, one waiting request, an unfiled line and a pending cheque, so the
  open year's Overview lists them); an **open 2026–27**; a team whose bill was made on its 2026 Season and is still owed
  after the team started its 2027 Season (call 1, Ask 8b); a cost line with something left (the New allocation walk
  creates from it and reads it back); a shared payee with records in two fiscal years. **A second, empty club, or a
  re-runnable step**, for walking the first-time set-up and the transition (a club on January with a plan, moving to
  September). Name new rows outside existing name prefixes (a lookup by name prefix re-aims when a second row shares
  it).

## Not in this session

- Every screen (session 2): the fiscal year's window, the named year on every page and export, the Overview's
  ended-year line, the close question, the closed year read in place, the refusals' words, Reopen, the open year's
  "still open" section, Against last year, the year-end report's layout, New allocation in the window and its form
  table, the payee window, the coach's earlier-season band, the old look's retirement, help, walks.
- **Not 3c's:** fiscal periods and closing entries (D2), bank reconciliation (its own project, both portals),
  tournament fees and a tournament book's archive (Stage 7), families' money (Stage 5), the server-calendar "more than a
  year ahead" check (recorded).

## Gates

- **Watched automation first.** Read `WATCHED_PATHS` in `scripts/check-agent-automation.mjs`. If a gate's wiring
  touches a watched path, **ask the owner in this session** before wiring it; give it its own commit and say what
  behaviour changes.
- **`check:club-money-arithmetic` re-proved on a September fiscal year:** every figure of 3b's set; a short year;
  the club's quarters; the Months window from the first month; **the opening of a year whose predecessor is closed
  equals that stored closing**; a closed year's Statement and band can't move after a later line is written; the
  Against-last-year columns; the year-end report's figures equal the closed year's.
- **The atomicity check** (`check:club-money-atomicity -- --mutate`): Close, Reopen and the first-month change each
  one step; the lock refuses each writer (mutation-proven); the pending-clears exception admits only itself.
- **Unit tests:** the fiscal year a day falls in (January club unchanged; September; the short transition year; a day
  on each boundary); the name rule; the first-month change (lines moved, a crossing line split, ledger untouched, a
  club with nothing just starting); close order and refusals; reopen latest only, reason required; the carry to the
  cent; the four kinds of open money; S3C-03's team rule; New allocation refusing a closed season and a closed year's
  line; the pasted id refused; the earlier-season read (no season parameter); **call 1: a payment after its season
  closed moves the working season's Cash on hand and leaves the closed season's unchanged; a backdated date doesn't
  change which season carries it; a reopened season carries what is recorded while it runs**, and the backfill moves
  nothing. Mutation-test the refusals.
- **Existing guards stay green:** `check:register`, `check:money-report`, `coach-history-endpoint-guard`,
  `club-money-one-definition-guard` (extended), `budget-line-kind-guard`, `check:org-slug-callers`, `check:spelling`,
  `check:dictionary` with `npm run refresh:snapshots`.
- `npm run verify:changed`, `npm run typecheck`, the targeted unit files. A full unit run wipes `test-results/`; run it
  only when no peer is sweeping.
- Then `/simplify`, then `/review` at the **high-risk** tier (money, a lock on every writer, migrations, the coach's
  register).

## Hand-off

- **An owner-voice summary:** what a treasurer can do once session 2 lands, the four calls, and the prod counts.
- **A call list for session 2**, written into plan §6 Stage 3 (3a's and 3b's format): every route with its request and
  response shape and refusal codes; the fiscal year's shape in every read; the preview read for a first-month change;
  the close question's read; the lock's refusal and the per-line "locked"; New allocation's create body and "Bill
  from"; the payee report's years; the year-end report's columns; the coach's earlier-season read; the `NOT_YET` page
  list; the **retire list** (the pasted entry id, the payee report's Export, the payee report page's read if only it
  used it, the old New allocation page's reads).
- **Migrations are prod-owed.** Record each in the plan and `MANUAL_PROD_STEPS.json`, with its verification and its
  **order against the promote** (the fiscal-year tables and the plan's new key before the code that reads them; the
  installment's carrying season and its backfill before the register reads it; `season_year` is NOT dropped here).
- The plan record, memory, and the TODO line. **Commit only when the owner says**, from a private index with this
  session's files only.
