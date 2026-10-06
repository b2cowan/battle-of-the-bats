# Club Tier Stage 3b · session 2 — the Budget, Budget vs. Actual, the board summary and every 3b screen (built to hub version 38)

> Paste into a fresh session on `dev` **after session 1 (`CLUB_TIER_STAGE3B_SERVER_PROMPT.md`) is committed**.
> Its call list (routes, shapes, refusal codes, the definitions module, the month-grid feed, the retire list) is
> in plan §6 Stage 3. Written 2026-10-06, the day the drawings were **ratified**: all nine asks as recommended,
> "including the 2 fixes" (the coach's month grids).
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 3b**.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED and
>   UNCHANGED tag note is a requirement; open each one. The flags name the finding each drawing answers.
> - **"Formatting check"** is your checklist, every row, including its **"Design pass, 2026-10-05"** list (the
>   places the first drawings drifted from the coach's screens, already redrawn) and the drift list (the two
>   coach fixes are now ruled).
> - Where you must depart, say so at build time and record why; never silently.
>
> **Read first:** plan §6 Stage 3's 3b blockquotes and session 1's call list; §6 "Across every stage —
> formatting". Memory: `project_club_tier_readiness`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_build_to_approved_mockups`, `decision_record_reads_first_edits_whole`,
> `decision_edit_autosaves_create_asks`, `decision_autosave_word_is_transient`,
> `decision_one_toolbar_rare_tools_behind_tools`, `decision_export_is_one_button`,
> `decision_waiting_count_is_amber_pill`, `decision_bva_band_collected_spent_cash`,
> `project_coach_category_is_the_shelf`, `project_coach_bva_records_behind`, `feedback_mobile_icon_only_actions`,
> `feedback_shared_component_over_shared_class`. The in-repo `memory/design_decisions.md` entries from
> 2026-09-02 on (the money grammar, the plan ladder, revenue first, the category is the shelf, figure doors,
> report disclaimers' spacing, both Ledgers' rulings, one control height).

## ⚠ The lesson this stage already paid for

The first 3b drawings were made from memory of the coach's Budget and Budget vs. Actual and broke about a
dozen of the owner's own rulings (an "N lines" caption, a "Not in the plan" chip, revenue not grouped by
category, a card-per-line phone). **The coach's screens are the benchmark, and their rulings live in their
code comments.** Before you build any club money surface, read the coach component it mirrors:
`accounting/budget/panel.tsx` (List, By period), `accounting/budget-vs-actual/panel.tsx` (Statement, Months),
`components/coaches/MoneyMonthGrid.tsx`, `MoneySummaryBand`, `lib/coach-money-report-notes.ts`, and
`tests/unit/bva-figure-doors-guard.test.ts`.

## Preconditions (check before code)

1. **Session 1 is committed.** Read its call list, and the two calls it made (which word a request paid to a
   team files under; where an overdue installment sits under Scheduled).
2. **The UX summary for the owner comes first** (AGENCY_RULES). Short: what a treasurer, a president, a club
   admin and a head coach each see differently, and any departure.
3. **Git and the dev server:** private index, explicit pathspecs; ask before a sweep or a restart; **one browser
   tester at a time** — ask the owner before any capture or `auth-setup`.

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md`:** Ask 4e's shared part, **a column a screen reads but
  doesn't own** — a lock and the owner's name in its heading, the table's closing row blank under it, its total
  in its own band worded as not the screen's. Shared with the tournament redesign (a team's figure read from
  its coach is the same case).
- **`TABLE_EXCEPTION_REGISTER.md`:** a row for **the month grids' notation** (fix 1) — the coach's Months and
  By period grids, and the club's: whole dollars, no sign, brackets below zero (red where a balance is
  meant), a dash for nothing, because a twelve-column grid needs the room. Cite the money-cell rule it departs
  from.
- **`memory/design_decisions.md`**, newest first, and its line in `memory/MEMORY.md` in the same change:
  1. the club's Budget and Budget vs. Actual read like the coach's, with the **six named differences** (Ask 2);
  2. the teams' cash: the shared table part, never summed into a club figure (Ask 4e, D1);
  3. **a month grid opens on this month on a phone, in both portals** (fix 2), and its notation (fix 1);
  4. the coach is told what the club reads, in one line at the foot of the Club tab (Ask 4c).

## What to build

### 1. The Budget tab (specimen 1; Asks 2, 4b, 4d, 5)

- **Toolbar:** Year · View (List · By period) · When (List only, while a line has no date) · Export · Tools ·
  the one lime **Add line**. Tools holds Categories and the teams' own words, each a window. On a phone: Year,
  View, a 44px Tools and a 44px lime +.
- **The band:** Total revenue (green) · Total expenses · **Closing balance** (red only below zero).
- **List:** Revenue first, **one section per category** (the category is the shelf), money in green, **From the
  teams** first (counts its allocations, no Collected, opens its allocations); Expenses by category; columns
  When · Planned · Allocated · Collected (blank on a line the club pays itself, and on the revenue band); a
  partly billed line says "$X not allocated" under its name; **no "N lines" caption anywhere**; the close is
  **Opening balance · Jan 1 · Net for 2026 · Closing balance**. The name is the row's door; one chevron; no
  control in a cell.
- **By period:** the coach's period grid (promote it; see "Shared, not copied"). Columns pill (Months ·
  Quarters), No date yet first, Total last, the three balance rows, the coach's notes.
- **A line's window** reads first (head pencil ↔ ✓ flips the whole record; edits autosave with the floating
  pill; a held edit says why in the pill and the field takes the red edge — the line-total floor). Its
  allocations are a section; **Allocate $X** (white) opens **New allocation as a page**, filled in from the
  line, Back to the Budget, no "Org Ledger Entry ID" box.
- **The Year pill and next year:** every year with lines plus next year; an empty year's state offers **Start
  from 2026's plan** (lime) and Add a line.
- **Phone:** the band two-up, then the coach's scrolling table under pinned names, categories kept as rows.

### 2. Budget vs. Actual (specimen 2; Asks 2, 4a, 5)

- **Band:** Collected · Spent · Off-plan · Cash on hand (the coach's words and colours).
- **Toolbar:** Year · View (Statement · Months) · then **Compare** (Whole year · To date) and Collapse all on the
  Statement, **Showing** (Budget · Scheduled · Cash · Difference) on Months · Export. On a phone: two lines.
- **Statement:** the coach's statement (promote it). Off-plan rows show the **amber dash** in Budgeted — no chip,
  no word, a screen-reader sentence; one **Not filed** row; every Variance coloured; From the teams' allocations
  are ordinary lines; rows open nothing and **the two figures are the doors** (the coach's "behind the figure"
  panel, at most two doors); the pending cheque is a note under the table, in the shared disclaimer stack.
- **Months:** **the coach's `MoneyMonthGrid`, fed session 1's club figures — never a second grid.** Categories
  folded at open, today's column tinted, the year band, the balance block with **The club's other books** above
  it, the notes. The view opens on Budget, as the coach's does.
- **Gone:** the four figure cards, Org Headroom, the Org Ledger Expenses panel, **team health** (S3B-05), the dead
  "Coming Soon" window and the "future update" sentence.
- **Add an entry / a line's window on the Ledger** (3a's): Category becomes **Filed under** (the shared budget
  word picker, money-out words for money out, money-in for money in), with the hint whether the word is on the
  year's plan; a sourced line shows its word read-only. The Ledger's Category filter lists budget categories.

### 3. The Overview tab is the board summary (specimen 3; Asks 1, 4e)

- Year pill + Export (the board report). "Where the club stands · today": Cash on hand · Owed by the teams ·
  Waiting on you (amber). "2026 against the budget": the planned / so-far table, Headroom said once with its
  arithmetic, the olive "Budget vs. Actual" door. "The teams": groups as bands, Allocated · Collected ·
  Outstanding (overdue / sent captions) · Requests (the amber count; a red "holding up a payout" caption) ·
  **Cash on hand · held by the team** (lock in the heading; a closed season's figure says "at close, {date}"),
  a blank cell under it in the closing row, and the **held-by-the-teams band** under the table. "The club's
  books" with Add ledger and its Cash on hand total. **Gone:** Income, Expenses, Net position, Pending and the
  From/To pair.
- **Phone:** the band two-up; the year as one row opening Budget vs. Actual; the teams needing the club first,
  each row's cash labelled "Held by the team"; the teams' total on its own line.

### 4. A team's money (specimen 4; Ask 4c)

- **A team's account:** the fourth card, **Cash on hand** with the lock and "Held by the team · the coaches'
  figure today", the blue edge; the callout reworded (words by `/marketing`).
- **Rep Teams board:** an **Outstanding** column (late as a red caption), shown only to someone who can open
  Accounting. The team page's **What the club sees** gains two lines (the team's cash on hand; what it recorded
  paying the payees you share).

### 5. The shared-payee report (specimen 5; Ask 3)

- A shared payee's window gains one door row ("What the teams recorded paying it", count and total for the
  year). The report is a page one level down: back to Payees, the trail, Year + Export, the blue "held"
  callout (`/marketing`'s words), a row per team that **folds** to its payments (right ↔ down chevron before the
  name, no row-end chevron — nothing opens a page), the total row, **Nothing recorded (n)**. Phone: the desk's
  order, folding the same way.

### 6. The coach's side (specimen 6; Ask 4c and the two fixes)

- **Money › Club:** one quiet line at the foot of the tab, after the bills, with the building icon (words by
  `/marketing`): what the club reads, and what it never reads. A team in a club only. Fix the empty tab's stale
  lines in the same change ("mark each installment paid" → the "We've sent it" flow; "owner or treasurer" →
  includes an admin with Accounting).
- **Fix 2, both portals:** on a phone (the touch widths), **Budget vs. Actual › Months and the Budget's By period
  open scrolled to this month**, coach and club. Desk unchanged. `check:layout` proves the coach's screens
  otherwise didn't move.

### 7. Shared, not copied

- The coach's **Statement rows** (`CategoryGroup`, `ItemRows`, `CatFoldRow` and their panels, inside the coach's
  BvA panel today) and its **period grid** (inside the coach's Budget panel) become shared components that both
  portals render — **promote, don't copy** (3a promoted `CoachTabBar` → `HubTabBar` the same way). The coach's
  screens must be **byte-equivalent** after the move: `check:layout` (both themes), `check:money-report`,
  `check:register` and `bva-figure-doors-guard` prove it.
- **The old look's retirement:** the Budget page and `budget.module.css`, the old Allocate page, the Budget vs.
  Actual page and `bva.module.css`, the Coming Soon window, the Overview's four figures; session 1's retire
  list (`allocate-to-teams`). `npm run check:old-look:report` before; lock each drop with `--init` in the same
  change.

## Help, words, walks

- **`/docs`:** the Accounting guide's Budget, Budget vs. Actual (Months and its four lenses, the opening
  balance), the board summary, a team's cash on its account, What the club sees, the payee report, and the
  coach's Club tab line.
- **`/marketing`:** every tagged sentence (the summary's captions, "held by the team", the payee report's
  callout, the coach's line, the team account's callout). Draft them, tagged; don't ship placeholders.
- **Walks §F** on the hub's QA tab: checkable walks, **one purpose each**, pinned to identities not figures
  (memory `feedback_qa_walkthroughs_as_checkable_artifacts`). Take the next Owner QA ledger § **at the moment
  you write it** (grep the ledger first; sessions collide on numbers). The UAT club fixture needs a sponsor line,
  a grant line, two allocations from one line, a pending cheque, a tournament book with its own money, a shared
  payee with team payments, and a team between seasons — extend `scripts/seed-club-fixture.mjs` (owner's go
  before `--reset`).

## Gates

- `npm run verify:changed`, `npm run typecheck`, the targeted unit files, `check:club-money-arithmetic`,
  `check:spelling`, `check:css-selectors`, `check:public-tokens`, contrast checks, `check:old-look`.
- **`check:layout`, both themes,** on every touched screen, club and coach (ask the owner first; one screen at
  a time if memory is tight; baseline new entries with reasons, retire what no longer reproduces).
- A guard test for the screens (3a's `club-stage3a-screens-guard` pattern): no "N lines" caption, no "Not in the
  plan" chip, the held-by column never summed into a club total, the month grids opening on this month.
- Then `/simplify`, `/review` at the **high-risk** tier, and a `/design` review of the built screens against the
  hub at 1440 and 390.

## Hand-off

- An owner-voice summary, the walks to run, departures from the drawings, and anything found and not fixed.
- The plan record, memory, TODO line, and the hub's QA tab republished (the same address; read it fresh first).
- **Commit only when the owner says**, from a private index with this session's files only; Part 0 is its own
  commit.
