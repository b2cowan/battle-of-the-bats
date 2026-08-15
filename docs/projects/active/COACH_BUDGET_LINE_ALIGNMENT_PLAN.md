# Coach Money — spending points at a budget line, not just a category

**Status:** planned 2026-08-15 · **not built** · awaiting owner approval
**Raised by:** the owner, 2026-08-15 — *"in the create expense/payable, it looks like we can only
select a category but not an item, don't we need the item to align with the budget? this should be
available when creating an expense as well"*
**Mockup:** https://claude.ai/code/artifact/dffa11b7-14a1-4182-afb7-e327985d7443
(source: `COACH_BUDGET_LINE_ALIGNMENT_MOCKUP.html`)
**PM brief:** [COACH_BUDGET_LINE_ALIGNMENT_PM_BRIEF.md](COACH_BUDGET_LINE_ALIGNMENT_PM_BRIEF.md)
**Sibling plan:** [COACH_RECURRING_PAYABLES_PLAN.md](COACH_RECURRING_PAYABLES_PLAN.md) — independent;
either may ship first.
**Migration:** one — two nullable link columns on the expense row.

---

## 1. The observation, and what it turned out to be

The owner is right, and the gap is one level deeper than the form.

**The budget speaks in category + item. Spending speaks only in category — as free text.**

- A budget line (`rep_budget_lines`) carries `category_id` **and** `item_id`, and the Add Line form
  uses `BudgetItemPicker` to capture both.
- An expense or payable (`rep_team_expenses`) carries **`category` — a text column**. No
  `category_id`, no `item_id`, no link to the line it pays for. The form's picker is populated from
  the org's whole taxonomy (`/budget-items`), not from the team's plan.
- Budget vs. Actual therefore matches actuals to budget **by category name, case-insensitively** —
  which its own header comment states plainly.

Category-level totals are correct. Everything finer than a category is either blank or wrong.

## 2. ⚠ The defect this surfaced — per-line period actuals were the whole category's

**The display half is BUILT on `dev` 2026-08-15**, ahead of and independent of this plan. ⚠ It is
in the working copy and **not yet in a commit** — verified against `git log`, which has no entry for
any of its files; replace this line with `committed <hash> <date>` the moment it lands, per the
status-wording rule. What follows records what was wrong, what the fix does, and what is still owed
here.

### What was wrong

In `app/api/coaches/.../budget-vs-actual/route.ts`, the per-line period actuals were built with
`buildPeriodActuals(key, …)` where `key` is the **category** key. Every budget line inside a
category was handed the *same category-wide* spending, mapped onto that line's own periods.

The line row itself was honest — it prints `—` for actual and variance. But **expanding a line
showed money in its period rows, in green, with a variance** — and that money was the category's.

**Failure scenario.** Facilities holds two lines: *Dome rental* (Nov–Apr, $4,000) and *Field rental*
(May–Aug, $1,200). The coach pays the $340 November dome invoice. Expanding *Dome rental* shows
November: actual $340 ✓. Expanding *Field rental* also showed $340 against one of its periods, in
green, with a favourable variance — money that has nothing to do with field rental. With three lines
in a category, the same dollar was reported three times.

It only manifested when a category held **more than one line**, which is the normal shape of a real
budget.

### What the fix does (2026-08-15)

The rule now lives in one pure module, `lib/coach-budget-line-actuals.ts`:

- **A category holding exactly ONE line** → the category's spending *is* that line's spending; there
  is nothing else it could belong to. The period figures are correct and are **kept**.
- **TWO OR MORE lines** → the periods report `null`, and the screen prints `—` for actual and
  variance, matching what the line row above already said. `null` is deliberately not `0`: "nobody
  can say" and "nothing was spent" are different facts.
- The category says why, once, under its lines: *"Facilities has 3 budget lines, so spending is
  matched to the category, not to a line."* A bare dash reads as a number the product lost.

Regression test: `tests/unit/coach-budget-line-actuals.test.ts` — three lines and one paid expense,
**no line reports the money**; a single-line category still does. A second bug was fixed in the same
move: the old routine mapped its answer back to display order by *label + date*, so two
identically-named periods on one line collapsed onto a single slot.

**Swept and found clean** (no other surface carried the same defect): the *Budget by month* view and
`lib/coach-budget-months.ts` (line rows carry budget only, and the grid already says why); all three
export formats, category view and month view (`lib/coach-money-exports.ts` writes blank line
actuals); the Money hub Overview, the 30-day strip and `money-summary` (no per-line figure at all);
and the club-side Budget vs. Actual (its period sub-table shows Estimated only).

### What is still owed here

**Real per-line actuals** — the `—` in a multi-line category can only become a number once spending
records *which line* it was against, which is §6.1's migration and §6.3's server work. §6.3's
sentence *"`buildPeriodActuals` takes the line's spending when the line has linked rows"* is the
remaining work; the "otherwise report `—`" half is done. When it lands, `lineActualsKnowable()` is
the single predicate that changes — not the arithmetic under it — and the category's explanatory
sentence retires with it.

## 3. What to link to — the line, not the item

Two candidates. The line wins.

| | Link to **category + item** | Link to the **budget line** ✅ |
|---|---|---|
| Matches how the budget is built | Yes — same pair the line stores | Yes — the line *is* that pair, plus the team's own description and amount |
| Two lines that share a pair | **Ambiguous.** "Tournament entry" under Tournaments, twice, for two different tournaments — a real and common shape. Actuals can't be split. | Unambiguous |
| Gives a per-line actual | Only when the pair is unique | Always |
| What the coach is actually saying | "this is that kind of cost" | **"this is against that row of my budget"** |

So: an expense or payable optionally points at **one budget line**, and its category is derived from
that line. The free-text category stays as the fallback for teams with no budget plan, for spending
that is genuinely unbudgeted, and for every row already in the database.

## 4. What a coach sees

One field replaces the category picker on **both** the Add Expense and the Add Payable form (and
their Edit forms, once those land):

**"What is this against?"** — the team's budget lines, grouped by category, each showing what is
left on it:

```
FACILITIES
  Dome rental                  $4,000 planned · $1,190 left
  Field rental                 $1,200 planned · $1,200 left
TOURNAMENTS
  Spring classic entry           $850 planned · $0 left ⚠
  ──────────────────────────────────────────────
  Not in the budget            → then pick a category, as today
```

- **Choosing a line fills the category automatically.** One decision instead of two, and it cannot
  disagree with the plan.
- **"Not in the budget"** keeps today's category picker and today's honest warning ("this will show
  as Unbudgeted in Budget vs. Actual"). Deliberately not hidden — unbudgeted spending is a real
  category of thing, not a mistake to be designed out.
- **No budget plan yet?** The field degrades to exactly today's category picker. Nothing gets worse
  for a team that hasn't built a plan.
- **Remaining-on-the-line is shown at the moment of choosing.** This is the quiet win: the coach
  learns they're about to overspend a line *while recording the cost*, not next month on a report.

## 5. What it fixes downstream

- **Budget vs. Actual gets a real per-line actual and variance** — the `—` columns fill in. (§2's
  double-count is already gone; what this adds is the number that replaces the dash.)
- **The export gains line actuals.** Its code comment currently records the limitation as a fact of
  life: *"Only the BUDGET is known per line — actuals and commitments are matched to a category."*
- **"Unbudgeted" becomes meaningful.** Today it means "category name didn't match"; after this it
  means "the coach said this wasn't in the plan".

## 6. Build

### 6.1 Migration

`rep_team_expenses` gains **`budget_line_id`** (nullable, FK → `rep_budget_lines`, **ON DELETE SET
NULL**) and **`budget_category_id`** (nullable, FK → `budget_categories`).

- `ON DELETE SET NULL` is load-bearing: deleting a budget line must never delete or orphan a record
  of money. The row falls back to its text category, which is still populated.
- The existing `category` text column **stays and stays populated** — it is what every historic row
  has, what the importer writes, and the fallback for unbudgeted spending. This adds a better link
  beside it; it does not migrate the old one away.
- **No backfill.** Guessing which line a historic expense belonged to is exactly the kind of
  confident-and-wrong data the dictionary rules exist to prevent. Existing rows keep matching by
  category name, as they do today.
- Same unit of work: `DATA_DICTIONARY.md` + `npm run refresh:snapshots`.

### 6.2 Client

- A new picker component (working name `BudgetLinePicker`) — sibling of `BudgetItemPicker`, sourced
  from the team's plan rather than the org taxonomy, showing remaining-on-line, with the
  "Not in the budget" escape and the existing unbudgeted warning underneath.
- Used by the Add Expense form, the Add Payable form, and the recurring-payables group (where the
  chosen line applies to every occurrence — one more entry for the "applies to all N" line).
- The expenses panel already fetches the budget plan on load (it uses it for the budgeted-category
  warning), so the lines are **already in hand** — no new request.

### 6.3 Server

- The expenses POST accepts `budgetLineId` / `budgetCategoryId`, **validates the line belongs to
  this team and this program year** (the same ownership check `budget-plan/lines` already performs
  on category and item — its comment records that this was a pre-existing gap hardened during the
  Chunk G review), and derives the text `category` from the line so the two can never disagree.
- Budget vs. Actual: a line's actual is the sum of expenses linked to it; a category's actual stays
  the sum of everything in that category (linked or matched by name), so the two levels still
  reconcile during the long tail where both kinds of row coexist.
- **§2's fix:** `buildPeriodActuals` takes the *line's* spending when the line has linked rows, and
  otherwise reports `—` rather than the category's money. **A line with no linked spending must show
  nothing, not the category's total** — that is the whole defect.

### 6.4 The importer

Out of scope for v1: the payables template has a category column, so imported rows land at category
level exactly as they do now. Honest, unchanged, and flagged as the obvious follow-up — the template
gaining a "budget line" column is a self-contained next step.

### 6.5 Tests

- A category holding three lines, one linked expense: the linked line reports it; **the other two
  report nothing**. (The "other two report nothing" half already has its test — see §2. What this
  phase adds is the *first* clause: the linked line reporting it.)
- A line deleted out from under a linked expense: the expense survives, keeps its text category, and
  the report treats it as unbudgeted.
- A `budgetLineId` from another team or another season: refused.

## 7. Sequencing and risk

Independent of the recurring-payables plan — either can ship first. If both land, the recurring
group inherits the picker for free.

The only real risk is the coexistence window: for one season, some rows are linked and some are
matched by name. §6.3 is written so both roll up to the same category totals throughout, which is
what makes it safe to ship without a backfill.

## 8. Follow-through

- **Help docs** (`/docs`): the budget and expenses guides both describe category-level matching.
- **Demo sandbox** (`riverdale-ridge`): the seeded world has a budget plan **and** seeded expenses —
  once linking exists, the demo's Budget vs. Actual should show real per-line actuals rather than
  dashes, which is the screen a prospect is most likely to open. This is the case CLAUDE.md warns
  about: the product gains something and the demo does not follow unless someone decides it should.
- **Owner QA:** the multi-line category case above is the test that matters; it is the one that is
  wrong today.
