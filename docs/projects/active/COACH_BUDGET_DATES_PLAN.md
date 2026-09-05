# Budget dates, and the "to date" reading

**Status:** owner-ruled and mockup-approved 2026-09-04 — BUILDING
**Owner QA:** ledger **§145** (§144 was claimed by a concurrent session mid-build — the tail is the only truth)
**Build brief:** `COACH_BUDGET_DATES_BUILD_PROMPT.md`
**Proposal artifact (the four rulings):** https://claude.ai/code/artifact/9bc53080-ba3c-4856-891e-aef63e51bd7d
**Mockup gate (approved 2026-09-04):** https://claude.ai/code/artifact/91368ba1-0e89-4f30-a7e9-422b782976e3
**Runs AFTER:** `COACH_BVA_REVENUE_RECONCILE_PLAN.md` (`77fa11ae`) — the basis sits over its rows.

---

## 1. The one line

**Every budget line answers "when does this money move?" in MONTHS, with "No date yet" as a real
third answer — and the Budget vs Actual report gains a second comparison basis, "To date", that the
answer makes possible.**

These ship together. The date requirement has almost no payoff alone: the reason to ask a coach for
a month is so a report can compare like with like.

## 2. Why it is worth doing, in one number

On the UAT test team on 2026-09-04, the report says the season is **$8,690.02 under budget**. That
reads as an achievement. It is an unfinished season: a whole-season plan set against five months of
actuals. Under **To date** the same team reads **$1,690.02 under**, which is the answer to *"are we
on track right now?"*

---

## 3. Owner rulings — settled, do not re-open

| Ruling | Where | The reasoning, which matters more than the rule |
|---|---|---|
| **Ask for a MONTH, never a day.** | 9bc53080, confirmed 2026-09-04 | A coach in January knows the tournament is in July but not that it is due the 14th. A guessed day is indistinguishable from a known one, so forcing precision makes the report *confidently wrong* instead of honestly incomplete. A day stays available inside the split editor; it is never required. |
| **"No date yet" is an explicit answer, not a blank.** | 9bc53080 | It is what lets a report tell an unknown apart from an oversight. |
| **It blocks the save**, exactly as Category & Item already do. | 9bc53080 | One rule, three parts: a line says what it is and when it happens. |
| **⚠ Nothing is pre-selected, and no month is pre-filled.** | owner, 2026-09-04 (amendment) | The first mockup opened with *One month* chosen and April highlighted. That makes a plausible-looking date the fastest way out of the form — reintroducing, one level up, the exact failure the month grain exists to avoid. **"No date yet" must be an explicit exception, never the path of least resistance** — but the nudge comes from ordering and prominence, never from pre-filling. |
| **⚠ No explanatory sub-lines under the three answers.** | owner, 2026-09-04 | "A day is never asked for" was the form defending a design decision to the coach. Three bold labels and a dropdown say all of it. The **one** consequence line under *No date yet* survives and is now the only prose in the group. |
| **The month is a DROPDOWN, not a chip row.** | owner, 2026-09-04 | House rule (form selects are dropdowns) **and** the split editor already picks a month with exactly this control — a select grouped by year offering the season year *and the next*, i.e. **24 options**. Twenty-four chips is a wall, and a second way to answer one question inside a form that already holds the first. |
| **The basis is a DROPDOWN beside View** — never a pill row. | 9bc53080 | The report already wears this shape for View and Showing. |
| **The disclosure sentence CHANGES with the basis.** | 9bc53080 | Whole season *counts* undated money in full, so there it reads "…sits in the season total but in no month". Only **To date** can exclude it, so only there is "not compared" honest. |
| **Whole season stays the DEFAULT.** | 9bc53080 | Headroom is quoted on five surfaces and pinned by a build gate. Flipping the default is its own decision, taken after the owner has seen To date working. |
| **⚠ The closing row is renamed under To date: "Net to date".** | owner, 2026-09-04 | See §7. Under this basis Season net is a cash-timing figure wearing a profitability name. |
| **One spelling: "No date yet", everywhere.** | owner, 2026-09-04 | The form's answer, the plan list's chip and the month grid's column are one word. The grid's word wins because it is the wider one — it also holds pledges and club asks. |
| **Compare appears on Statement AND By activity, never on Months.** | owner, 2026-09-04 | The two report shapes are one set of rows read two ways and close on the same net; a basis on one and not the other lets one report end on two numbers. Months' columns already are the time axis. |
| **Under To date, budgeted dues = instalments due on or before today.** | owner, 2026-09-04 | Dues are not budget lines and this build does not date them — but their instalments already carry due dates. It is the one revenue row that can answer the question honestly. |
| **The unknowns are reached by a FILTER, not a sort.** | owner, 2026-09-04 | Month names have no useful sort order. |

---

## 4. Load-bearing facts — get these wrong and the build is wrong

- **⚠⚠ THE UNDATED BUCKET CAN NEVER BE ELIMINATED.** A coach who sets a season *estimated total*
  before itemising anything has plan money with **no lines underneath it** — nothing to attach a
  month to. It is counted in full under Whole season and can never join a To-date comparison.
  Consequences: the disclosure sentence outlives the date requirement, the excluded figure under
  **To date** can never reach zero, and "No date yet" must stay legitimate rather than nagged at.
  *(The UAT team has no estimate — `budget_amount` is null — so its excluded figure really is only
  undated lines. Do not mistake that for the general case.)*
- **⚠ REVENUE PLAN IS MOSTLY NOT BUDGET LINES.** What a season plans to collect in dues is its
  **dues instalment schedule**, set on the Player Dues tab. A date requirement on budget lines does
  not touch dues. Fundraising / sponsorship / other-income lines **are** budget lines and **are** in
  scope.
- **⚠ THE "No date yet" COLUMN ALSO HOLDS THINGS THIS BUILD MUST NOT TOUCH.** A sponsor's **pledge**
  and a **club ask** live entirely in that column, in the Total and in no month (owner ruling
  2026-08-23). They are Scheduled/actual money, not plan.
- **No customer coach teams exist on production** (owner, 2026-09-04) — no data to migrate, no
  back-compat burden. **But the public coach demo (`riverdale-ridge`) is on prod and most of its
  budget lines are undated**, and the UAT fixture's eight lines are five-eighths undated. Both need
  dating in the same unit of work.
- **The month grid's "No date yet" cell** is the existing route out of undated budget. The **When**
  column becomes a second, better one. Do not remove the first.

---

## 5. What is already on the screen (verified in code 2026-09-04, not from a plan)

Three findings from the mockup gate that change what gets built:

1. **The "When" column already exists — it is called `Schedule`** (Budget Tab Revamp P3). It prints
   `—`, `Jan–Mar · 3 chunks`, `Mar · 2 chunks`, `3 chunks · no dates`. **This build rewrites that
   column; it does not add one.** Adding a second column answering the same question beside it would
   be the defect.
2. **That column is `display:none` below 640px.** The plan list drops to three tracks and the
   schedule cell leaves the grid, so today a phone shows nothing about dates at all.
3. **`Showing` never renders on the Statement** (`view === 'months'` only). The brief expected a
   three-selector crush; the Statement's row is `View · Collapse all · Export` and gains one pill.
   Measured at 361 / 641 / 768: two lines today, two lines after; one line in the tablet band.
   **No fix needed and none is proposed.**

Also load-bearing for the column's rewrite: **`Mar · 2 chunks` is a lie.** The UAT team's Jersey
order is a $500 deposit dated March plus a **$1,000 balance with no date**, and the column reads as
a fully dated line. That row, not the rename, is why the column needs rewriting.

---

## 6. Storage — no new column, and the reason

**A line's answer IS its periods.** `One month` → one period dated to the 1st of that month.
`Split across months` → many. `No date yet` → none.

The alternative considered and rejected: a column recording *which answer the coach picked*, so a
report could tell "answered: no date yet" from "never asked".

**Rejected because nothing reads it.** The save is blocked, so no new line can be unanswered; there
is no customer data, so no existing line is unanswered either once the demo and fixture are dated.
And the two surfaces that name undated money — the plan list's fix-it bar and the statement's
disclosure sentence — must count it **the same either way**, because their job is "here is what a
To date reading leaves out", not "here is what you forgot". A column recording a fact no screen
reads is exactly what `/simplify` exists to catch.

**Carry and import need no new field.** Both already write periods with dates (`rep-budget-carry.ts`
shifts them a year; the importer writes `${month}-01`), so both produce lines whose When is whatever
their dates say.

**One detail this creates:** a `One month` line now has exactly one period, so the plan list would
grow an expander revealing one sub-row that restates the row it hangs under. **Suppress the expander
at exactly one period** — the When chip already names the month, and the §133 walk removed a caption
for less.

---

## 7. ⚠ Season net under To date — the ruling and why it was needed

Run on the real fixture, To date fixes the expense side exactly as promised. The revenue side is
where it goes strange, and **the cause is not a bug**:

| | Plan · whole season | Plan · to date | Actual | Variance to date |
|---|---|---|---|---|
| Player dues | 11,308.30 | 0.00 | 3,075.00 | +3,075.00 |
| Fundraising | 1,800.00 | 0.00 | 778.60 | +778.60 |
| Other income | 150.00 | 0.00 | 0.00 | 0.00 |
| Unplanned income | — | — | 2,485.75 | +2,485.75 |
| **Total revenue** | 13,258.30 | 0.00 | 6,339.35 | +6,339.35 |
| **Total expenses** | 13,600.00 | 6,600.00 | 4,909.98 | 1,690.02 under |
| **Season net** | (341.70) | **(6,600.00)** | 1,429.37 | +8,029.37 |

Every dues instalment on this team is due 2026-10-01 → 2027-03-01; fundraising and other income are
undated lines. So the honest to-date revenue plan is **$0.00**, and the closing row reads
**($6,600.00)** on a season whose actual position is +$1,429.37.

The variance column says the right thing. The Budget column does not: under this basis that figure
is a **cash-timing** statement wearing a **profitability** name, and dating every budget line cannot
move it, because the dues schedule genuinely starts in October.

**Ruled:** keep the arithmetic exactly as drawn — both sides re-cut, nothing special-cased — and
**rename the closing row under this basis only**: `Season net` under Whole season, **`Net to date`**
under To date. Rejected alternative: re-cutting only the expense side, which would set a whole
season's revenue plan against part-year actuals — the exact defect this project removes.

**⚠ Excluded money has TWO causes and only one of them is a gap.** Money with **no date** is
excludable and the coach can fix it. Money dated **after today** (the UAT team's $300 Q4 umpire
chunk) is correctly not yet compared — that is the basis working. **The disclosure sentence names
only the undated part.** Conflating them would be a defect.

---

## 8. The five screens

### 8.1 Money › Budget › the line form

- New required question **"When does this money move? *"**, after Amount.
- Three answers, a radio group, in this order: **One month · Split across months · No date yet**.
- **Nothing pre-selected. Save disabled until one is chosen.** No month pre-filled.
- **No sub-lines.** Bold label only.
- `One month` reveals a **month select** — the split editor's own control, grouped by year,
  offering the season year and the next, options reading `Apr 2026`.
- `Split across months` opens the existing split editor unchanged; each chunk answers the same
  question via the controls it already has.
- `No date yet` reveals **one consequence line**, stated once, never repeated:
  > This **$3,200.00** counts in your season total and in no month, and a **To date** comparison
  > leaves it out. You can give it a month any time from the plan's **When** column.
- **⚰ The `Split by period` checkbox beside Amount is DELETED.** Splitting stops being an optional
  extra and becomes one of three answers. The form loses a control and gains a decision.
- Applies in **both directions** — a fundraising line answers it too.
- Edit reopens on the answer the line already has.

### 8.2 Money › Budget › the plan list

- `Schedule` heading → **`When`**.
- The value stops counting chunks and names months: `Apr` · `Jan · Feb · Mar` ·
  `Mar · $1,000 no date` · `No date yet`. **A count is not an answer to "when"** — and §133 has
  already ruled counts off rows elsewhere.
- Chips: dated = olive, `No date yet` = gold, partly-dated = olive with the undated half in gold.
- **≤640px the answer moves under the line's name**, into the slot the note already uses — the
  three tracks are untouched and no column is squeezed in. A fourth track at 329px would take room
  from the name (which already ellipses) or the money.
- New **`When` filter** beside View: `All · No date yet · Dated`. A filter, not a sort.
- **Fix-it bar** above the list when anything is undated: **"N lines have no date. Show just those →"**
  — one tap sets the filter. Renders only when there is something to fix, so a finished plan is quiet.
- A category group head's When cell stays **empty** — a group of two different months has no single
  answer to summarise.

### 8.3 Money › Budget vs Actual › Months

- No new work; **verify** the "No date yet" column still renders correctly when it holds *only*
  pledges and club asks, and that dating budget lines does not sweep those up.

### 8.4 Money › Budget vs Actual › Statement and By activity

- New **`Compare`** dropdown beside View: `Whole season` (default) · `To date`. Remembered per
  device, like View/Showing/trend.
- Under To date the plan column counts only plan money dated on or before today, on **both** sides.
- The plan column's heading becomes **`Plan to date`**.
- The closing row becomes **`Net to date`** (§7).
- Dues budgeted becomes instalments due on or before today.

### 8.5 The footnote stack

Order is unchanged: variance key · dues sentence · undated-plan line · cash bridge.

| | Whole season | To date |
|---|---|---|
| **Dues sentence tail** | "Both columns compare a whole season's plan against what has moved so far. **Compare to date** sets the plan against the same span." | **deleted** — under this basis it is false, and the column heading already says *Plan to date* |
| **Undated-plan line** | "$8,650.00 of this plan — money in and money out — has no date on it, so it sits in the season total but in no month. *See it in the months view*" | "$8,650.00 … has **no date**, so it is **not compared here**. Give it a month to include it. *See it in the months view*" |

The clause is **deleted, not reworded**, under To date. Two sentences, one topic each, and neither
contradicts the other — which was the whole instruction.

---

## 9. Explicitly OUT of scope

- **Flipping the default basis.** Add To date; leave Whole season selected.
- **Dating the dues schedule.** Dues are not budget lines.
- Reopening the family-paid or plan-panel rulings from the §132 walk.
- The Months/Statement revenue disagreement — **closed** by `77fa11ae`, not by this build.

---

## 10. Also required (repo process)

- Seed data: **date the UAT fixture and the coach demo** in the same unit of work, or both worlds
  demonstrate the problem rather than the fix.
- **Help is code-time:** `lib/help-content/coaches.tsx` teaches the Months readings and the
  statement. A new basis and a new required question both belong there, `searchText` included.
- **Demo narration:** ask both questions — should a demo moment show this, and are the demo's
  existing sentences about these screens still true? This surface has gone stale three releases
  running.
- **One spelling gate:** "No date yet" everywhere; grep for "Not yet known" and "Unscheduled" before
  adding a third.
- Verification: `npm test` · `npx tsc --noEmit` · `npm run check:money-report` ·
  `npm run verify:changed` · `npm run check:layout -- --changed` with a dev server up and the
  fixture seeded. **A skipped rendered check must be stated, never left to read as a pass.**
- `check:money-report` gains the basis claims: to-date plan ≤ whole-season plan on both sides, the
  undated figure equals the two grids' "No date yet" totals, and Net to date ties to its own columns.

## 11. Working-copy note (2026-09-04)

Built on top of an uncommitted tranche left by a concurrent session (§143's month-grid work, plus
styling). `budget/panel.tsx`, `budget-vs-actual/panel.tsx`, the month grid and the coach stylesheet
each carry two features' edits and **must be split by hunk at commit time** — the precedent is the
2026-09-04 A1 landing, which split two shared files the same way.
