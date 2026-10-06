# Club Tier Stage 3b · session 1 — the server half (the budget, Budget vs. Actual, the board summary: one definition per figure)

> Paste into a fresh session on `dev`. Written 2026-10-06, the day Stage 3b's drawings were **ratified**
> (hub version 38): the owner agreed with **every recommendation, all nine asks, "including the 2 fixes"**
> (the coach's month grids: a register row for their figures, and opening on this month on a phone).
>
> **Stage 3b runs as two sessions** (3a's precedent):
> 1. **This one:** every read, write, migration and gate. No club screen is rebuilt here, and the coach's
>    portal does not change here.
> 2. `CLUB_TIER_STAGE3B_SCREENS_PROMPT.md`: every 3b screen, built to the hub. It starts after this session's
>    commit and reads this session's call list.
>
> **Read first:**
> - Plan `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`: §4C (C04, C05, C09, C10, C11, C14,
>   C15 with anchors), §5 **D1** (the coach's records are the truth for team money; the club reads them,
>   labelled, never summed) and **D2** (the club's year is 3c's), and **§6 Stage 3, every 3b blockquote**: drawn,
>   the `/design` pass, Ask 5, the ratification. **"The 3b shared-payee report, defined"** (2026-10-02) is the
>   payee report's spec, word for word. 3a's call list (in the same section) is what already exists.
> - **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 3b**.
>   - **"One definition per figure"** is this session's contract. Every figure there goes into the club's money
>     definitions module with exactly that sentence.
>   - **"Not drawn"** is this session's list. Every tag note on specimens 1–6 that names server work is a
>     requirement too.
>   - The Decisions tab's nine Stage 3b rows are the rulings, in full.
> - Memory: `project_club_tier_readiness`, `project_coach_budget_one_word_one_line` (mig 286 — the join this
>   session repeats for the club), `project_coach_category_is_the_shelf`, `decision_bva_band_collected_spent_cash`,
>   `reference_coach_money_check_then_act`, `reference_cascade_collisions_coach_budget`,
>   `reference_code_gotchas_index` (the club's day, never UTC; `formatStoredDate` / `formatTime` only).

## The rulings this builds (owner, 2026-10-06: "I agree with your recommendations, including the 2 fixes")

- **Ask 1** · the board summary IS the Overview tab. Its four figures across every book (C04, J4-028) retire.
- **Ask 2** · the club's Budget and Budget vs. Actual read like the coach's, with **six named differences**:
  the plan bills teams (Allocated, Collected, an allocatable remainder; "From the teams" read from the
  allocations); the year is the unit and its opening is read from the books; the club's Cash on hand is its
  own books; how each team is paying lives on the Overview; two of the coach's three report shapes
  (Statement, Months); a club line reads first. **"Collected" carries two scopes on purpose** — two functions
  with two names, never one function with a flag.
- **Ask 3** · the shared-payee report lists the club's **active teams in the year**, rows whose payment date
  falls in the year, any year selectable; the share stamps apply whatever the year.
- **Ask 4a** · club spending meets the plan **by budget word** (category + item), the coach's rule. **Not by
  line** — this supersedes the plan's J4-024 "entries carry a budget line".
- **Ask 4b** · the club's plan gets a **Revenue band**.
- **Ask 4c** · the coach is told what the club reads (the screens session's line; this session supplies nothing
  new for it).
- **Ask 4d** · the Budget's writes answer **3a's one money rule** (`canMoveClubMoney`).
- **Ask 4e** · the teams' cash is its own labelled column and total, never in a club figure (a read here; the
  table part is the screens session's).
- **Ask 5** · Budget vs. Actual gets the coach's **Months** view with **four lenses** (Budget · Scheduled ·
  Cash · Difference; Season spending is dropped), and the Budget's **By period**. **The opening balance is
  worked out from the books**, and the month grid's balance covers **every book** with one **"The club's other
  books"** row.

## Before code

- **Present the product-manager UX summary** (AGENCY_RULES). Short, because the drawings are ratified: what a
  treasurer will be able to do once session 2 lands, and the one change a coach sees (none from this session).
- **Two calls this session must make and state in that summary** (the drawings assumed them; verify in code):
  1. **Which word a request paid to a team files under.** The drawing files it under "Team support › Paid to
     teams on request". Check the budget library (`budget_categories` / `budget_items`, mig 246's direction):
     if no word fits, **recommend** a club-scoped money-out word created on first use, never a platform
     standard word (a coach's picker must not offer "Paid to teams on request"). Never a free-text category.
  2. **Where an overdue installment sits under the Scheduled lens.** Mirror whatever the coach's Scheduled lens
     does with an overdue dues installment; don't invent a third rule.
- **Prod reads need the owner's go.** The one-word-one-line join (§2) needs a twin count on **dev and prod**
  before the migration is written. Ask once, read-only, and record the counts in the plan.
- **Git.** `git status` first: other sessions' hunks sit in this tree. Commit from a **private index** with
  explicit pathspecs (memory `reference_shared_worktree_stage_race`); `git show --stat HEAD` after.
- **The dev server may be shared.** Ask before a sweep or a restart.

## Preconditions

1. **The migration number.** 316 is the latest today. Take the next free number at the moment you write the
   file (`ls supabase/migrations`), and read `MANUAL_PROD_STEPS.json` for anything still owed.
2. **Decide what exists from the snapshots** (`docs/agents/db/schema-snapshots/`, live `information_schema`),
   never from migration files: `accounting_entries` (only a free-text `category` today), `org_budget_lines`
   (it already has `category_id` / `item_id` and a `total_amount > 0` CHECK), `org_budget_periods` (full-replace
   writes, sum never reconciled), `rep_cost_allocations.source_budget_line_id`,
   `rep_team_payment_requests.budget_line_id`, `org_payees.shared_with_teams` / `shared_at` (mig 316).
   ⚠ **The dual budget-line trap** (dictionary): `org_budget_lines` is keyed by integer `season_year`;
   `rep_budget_lines` is the team's, keyed by uuid. Check every FK's target before a join.
3. **The one-definition guard's `NOT_YET` list** (`tests/unit/club-money-one-definition-guard.test.ts`) names
   the budget-plan and Budget vs. Actual routes. Both must leave it in this session (the list only shrinks).

## What to build

### 1. An entry carries a budget word (Ask 4a, S3B-01, C09, J4-024, C14)

- **The migration:** `accounting_entries` gains the coach's two columns, a budget category and a budget item
  (the shapes `rep_team_expenses` already has — copy its FK targets and ON DELETE). **No backfill**: old lines
  keep their free-text `category` and read **Not filed**. Dictionary + both snapshots in the same change.
- **Writes:** the club's entry create and edit take the word (category + item from the one budget library, the
  direction matching the entry's In / Out). **The free-text category stops being written** for new lines; the
  Ledger's Category filter (3a's book read) lists the budget's categories, the club's own and the product's,
  never a team's words. A team's book is untouched (read-only, D1).
- **The money loop's own lines are never matched by a word.** An allocation received, money received on
  request and a request paid to a team are **sourced lines** (3a). Budget vs. Actual counts them from the loop's
  records, not from the ledger, so nothing is counted twice: From the teams = installments received (3a's
  Collected); "From the teams, on request" = To-club requests approved; a request paid to a team files under
  the word decided in "Before code" (1).

### 2. One word, one line on the club's plan (Ask 4a; the coach's mig 286 rule)

- **Count the twins first, on dev and prod** (owner's go): `org_budget_lines` rows sharing
  (`org_id`, `season_year`, `item_id`) with `item_id` set. Record the counts in the plan.
- **Join them, then add the partial unique index.** Read every FK that points at a line and its ON DELETE
  before writing the join (a join is destructive in two directions — `reference_cascade_collisions_coach_budget`):
  re-point allocations and requests to the line that survives, sum the totals, merge the periods. Planning a
  word already on a year's plan adds to its line, in the write as well as the index.

### 3. The plan's arithmetic (C11, C10, J4-026)

- **Many allocations per line.** Drop the "already allocated" refusal. The plan read adds up **every**
  allocation drawn from a line (today's read keeps one per line in a Map). An allocation's total is **its teams'
  shares**, never the line's total.
- **The allocation and its link to the line are one database step** (3a's pattern: a function that writes the
  allocation, its splits, its installments and `source_budget_line_id` together, and refuses an amount above
  what is left on the line, computed inside the transaction). The New allocation POST (3a's, on
  `rep-teams/allocations`) takes the source line; `allocate-to-teams` goes on the **retire list** with the old
  Allocate page.
- **A line's total is refused below what is allocated**, with the figure in the refusal (`below_allocated`,
  carrying the allocated amount the window's save pill quotes).
- **Periods are editable at any time and every save is checked:** the periods sum to the line's total within
  $0.02 (the coach's `rep_budget_periods` rule), each period's amount is positive, and a full replace is one
  transaction.
- **The year list (C10's planning half):** every year with a line, plus **always the next year**. A line in any
  year allocates from its own year (today's allocate read is this calendar year only).
- **Start from last year's plan:** one write that copies a year's lines and periods to the next year, dates
  moved a year on, nothing billed or collected carried; refused if the target year already has lines.

### 4. Revenue on the club's plan (Ask 4b, S3B-02)

- The add-line write accepts **money-in words** (mig 246's direction); the plan read returns a Revenue band
  grouped **by category** (the category is the shelf, 2026-09-09) and an Expenses band.
- **"From the teams" is never stored:** the plan read derives it from the allocations drawn from the year's
  cost lines, spread by their installments' due dates (the By period read), and lists its allocations.

### 5. The Budget's writes answer one rule (Ask 4d, S3B-03)

- Lines, periods, start-from-last-year and allocate all ask `canMoveClubMoney` (owner, treasurer, an admin with
  Accounting) with group scope where a team is named. Today lines and periods check owner/treasurer **by name**.

### 6. One definition per figure (the hub's table; C05)

- **Into the definitions module** (`lib/club-money-figures.ts`, 3a's), each with the hub's sentence as its doc
  comment: Planned · Allocated · Not allocated · Actual · Spent · Off-plan · **one** Headroom · the club's Cash
  on hand · Owed by the teams · Waiting on you · Cash on hand held by the team · Net for the year · **Opening
  balance** · **Closing balance** · **The club's other books** · the year rule. Collected stays two functions
  (allocation Collected, 3a's; the band's Collected = Total revenue's Actual).
- **The scopes, exactly as defined:** Actual, Spent and Off-plan read the **Club books** (the General ledger and
  any book the club opened by name), posted only (pending and void count nowhere), a transfer between the
  club's own books is not spending. A tournament's and the house league's books stay out until Stages 7 and 9.
  Cash on hand and the balance rows read **every book the club owns** (Club, Tournament, House league), never a
  team's.
- **The opening balance is worked out, never typed:** every club book's posted lines dated before the year's
  first day, added up. Until 3c, the year is the calendar year.

### 7. The Budget vs. Actual read (C09, C05, J4-024, J4-025, S3B-05)

- **The Statement:** Revenue → categories → lines → Total revenue; Expenses → the same → Total expenses; Net.
  Budgeted · Actual · Variance (the variance's word and its colour's sign are the coach's). **Off-plan rows:** a
  word spent with no line on the year's plan, and one **Not filed** row for lines with no word. **Compare:**
  Whole year and To date (the plan's periods dated up to today). Every figure carries the records behind it
  (the coach's "behind the figure" panels: the plan's line on Budgeted; the ledger lines, or the allocations and
  requests for a sourced figure, on Actual).
- **No row cap.** Today's read takes the newest fifty expense lines (C05/J4-025). Page through every line, or
  sum in SQL (§10).
- **The band:** Collected · Spent · Off-plan · Cash on hand, each by the one definition.
- **Team health leaves this read** (S3B-05): no per-team figures here; the summary owns them.
- **Months (Ask 5):** feed **the coach's own month-grid shapes** so the screens session renders the coach's
  `MoneyMonthGrid` unchanged. Four lenses:
  - **Budget:** the plan by month — each line's periods (a line without periods sits under No date yet); From
    the teams by its installments' due dates.
  - **Scheduled:** what is still to come from today, from **today's cash**: the teams' installments not yet
    received, by due date (overdue as decided in "Before code" (2)); cheques written and not yet cleared
    (pending lines) by their date; waiting requests under No date yet, counted as possible. It carries **no**
    planned cost (the club records no bill before paying it); the note says so.
  - **Cash:** what moved, by month.
  - **Difference:** plan against actual, months that have happened.
  - **The balance rows:** opening (the worked-out opening), each month's net, each month's closing, **every
    book**; one row, **The club's other books**: what a tournament's or house league's book took in or paid on
    its own that month, transfers excluded. Under Cash, this month's closing equals Cash on hand to the cent.
  - The twelve-month window and the pager behave as the coach's (a 3c year may start in any month).
- **Exports:** Excel, CSV and PDF in the shape on screen, the notes carried (the coach's rule).

### 8. The board summary read (Ask 1, C04, C15, Ask 4e)

- **Where the club stands today:** Cash on hand (every club book, all-time; its caption names a pending cheque),
  Owed by the teams (Outstanding across every team; its caption: overdue, sent and waiting), Waiting on you
  (requests waiting, count and total, both directions; how many hold up a payout — 3a's `closeOutBlockers`,
  shared).
- **The year against the budget:** read from §7's report, **never computed twice**: Revenue (From the teams on
  allocations; on request), Expenses (paid to teams on request; Off-plan), Net, Headroom, to date.
- **The teams:** per team, in the club's groups: allocated, collected, outstanding (with overdue / sent), waiting
  requests (and whether one holds up a payout), and **the team's cash held by the team** (§9). The teams' cash
  total is returned separately and never added into a club figure.
- **The club's books:** each book's balance and kind; their sum is Cash on hand.
- **The board report export:** Excel and PDF, the club's masthead and logo, the teams' cash labelled exactly as
  on screen ("held by the team"; its total worded as not the club's).

### 9. The per-team read of a team's cash (D1, C15)

- Read **the coach's own Cash on hand** for each team's live season through the coach's own function
  (`cashOnHandCents` in `lib/coach-register.ts`; a team between seasons shows its last closed season's closing
  figure, `seasonClosingCashCents` in `lib/coach-register-book.ts`, with that season's close date). **Never a
  year parameter into a coach route** (CLAUDE.md's look-back rule; `coach-history-endpoint-guard`). Never stored
  by the club. Group scope applies. **`check:register` and `check:money-report` stay green**: the club must read
  exactly the figure the coach's Money shows.
- A team's account (3a's read) gains the same figure for its fourth card.

### 10. The rest of the list

- **The shared-payee report read** (S3B-06): the plan's definition word for word (both stamps on or after
  `shared_at`; rows are `rep_payable_payments` against a commitment naming the payee; out-of-pocket payments
  count), Ask 3's team list and year, "Nothing recorded (n)". **Nothing on the Payees list changes** (its
  entries stay the club's own, mig 316).
- **The ledger summary as one SQL sum** (C14; 3a kept the paged walk for 3b). One function per book set, posted
  only, used by every balance.
- **The Overview's four figures retire** (C04): their read goes on the retire list.
- **No new notification.** Planning, reading and reporting tell nobody anything.

## Not in this session

- Every screen (session 2): the Budget's List, By period and line window; New allocation from a line; the
  Budget vs. Actual Statement and Months; the summary; the team account's card; the Rep Teams board's
  Outstanding column; the payee report page; the coach's Club tab line; the coach's month grids opening on this
  month; the old look's retirement; help.
- **3c:** the year's name and first month, the year-end lock (it fixes a closed year's opening), this year
  against last, year-end statements, New allocation offering only open seasons.
- **Stage 7:** tournament fees reaching the books (C18), a tournament's book joining the budget, By activity.
- **Bank reconciliation:** its own project, both portals (owner, 2026-10-06; TODO).

## Gates

- **Watched automation first.** Read `WATCHED_PATHS` in `scripts/check-agent-automation.mjs`. If a gate's wiring
  touches a watched path, **ask the owner in this session** before wiring it; give it its own commit and say
  what behaviour changes.
- **`check:club-money-arithmetic` grows:** the plan (every line's Allocated is the sum of its allocations; Not
  allocated never below zero; periods sum to the total), Budget vs. Actual (Statement totals; Total revenue's
  Actual = the band's Collected; Total expenses' Actual = Spent; Off-plan = the off-plan rows + Not filed),
  **every Months column's opening + net = closing**, the Cash lens's closing for this month = Cash on hand, and
  the summary's figures equal the report's. Recomputed from rows in a pure module.
- **The one-definition guard:** the budget-plan and Budget vs. Actual routes leave `NOT_YET`; extend its
  hand-rolled patterns to a hand-summed Allocated or a re-derived Headroom.
- **Unit tests:** word matching (a word with no line is off-plan; a sourced line is never word-matched; a pending
  or void line counts nowhere); many allocations per line; the line-total floor; periods reconciliation; the
  one-word-one-line join (twins summed, FKs re-pointed); the year list offers next year; start-from-last-year
  refuses a non-empty year; the opening balance from the books; the other-books row excludes transfers; the
  per-team cash equals the coach's figure (closed season included); the payee report's two stamps and Ask 3's
  team list; the role rule on every Budget write. Mutation-test the refusals.
- **Existing guards stay green:** `check:register`, `check:money-report`, `coach-history-endpoint-guard`,
  `budget-line-kind-guard` (a new `rep_budget_lines` count needs its KIND_AGNOSTIC entry — not expected here),
  `check:org-slug-callers`, `check:spelling`, `check:dictionary` with `refresh:snapshots`.
- `npm run verify:changed`, `npm run typecheck`, the targeted unit files. A full unit run wipes `test-results/`;
  run it only when no peer is sweeping.
- Then `/simplify`, then `/review` at the **high-risk** tier (money, a destructive join, a migration).

## Hand-off

- **An owner-voice summary:** what a treasurer can do once session 2 lands, the two calls from "Before code",
  and the twin counts.
- **A call list for session 2**, written into plan §6 Stage 3 (3a's format): every route with its request and
  response shape and refusal codes; the definitions module's new exports; the month-grid feed's shape (which
  coach type it fills); the board report's columns; the **retire list** (the old Allocate page and
  `allocate-to-teams`, the Overview's four figures and their read, Budget vs. Actual's team health and its
  "Coming Soon", the free-text category writes).
- **Migrations are prod-owed.** Record each in the plan and `MANUAL_PROD_STEPS.json`, with its verification and
  its order against the promote (the join runs before the index; the code that writes the word ships after the
  column).
- The plan record, memory, and the TODO line. **Commit only when the owner says**, from a private index with
  this session's files only.
