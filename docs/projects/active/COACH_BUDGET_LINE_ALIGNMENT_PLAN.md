# Coach Money — spending points at a budget line, not just a category

**Status:** **BUILT on dev 2026-08-15** · owner QA = ledger **§29**
**Migration:** **238** applied to **dev 2026-08-15**. ⚠ It must reach production before this code
does — that step, and where each thing stands, live in the Owner QA Ledger and the release history,
not here.
**Commit anchor:** _stamped when this is committed; the owner's confirmation is the gate._
**Raised by:** the owner, 2026-08-15 — *"in the create expense/payable, it looks like we can only
select a category but not an item, don't we need the item to align with the budget? this should be
available when creating an expense as well"*
**Mockup:** https://claude.ai/code/artifact/dffa11b7-14a1-4182-afb7-e327985d7443
(source: `COACH_BUDGET_LINE_ALIGNMENT_MOCKUP.html`)
**⚠ Read §9 before reading §6** — three things were built differently from the plan below, and the
third changes what a dash on the report MEANS.

> ## ⚠⚠ SUPERSEDED IN PART — read this first (2026-08-15, same day)
>
> The owner ruled hours after this shipped to dev that **a budget groups two levels only, category
> then item; the item names the row; and two lines on one item SUM into one row.** That last clause
> dissolves §3's entire argument for linking spending to a LINE rather than to a category+item pair —
> the argument was that two lines sharing a pair are ambiguous, and summed lines are not ambiguous.
>
> So **the expense→line link, its picker, the "Not in the budget" choice and migration 238 are
> retired** in favour of category + item on the expense, planned. What survives untouched: §2's
> per-line double-count fix and its honesty rule, the report/export plumbing, the ownership check,
> and the demo's linked seeding — all of which change key, not shape.
>
> **Nothing here has reached production**, so this is a dev-only reversal.
> ⛔ **Do not release this plan on its own.** See
> [COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md](COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md) §2 and §8.
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

**The display half is BUILT on `dev` 2026-08-15**, ahead of and independent of this plan. Its rule
module + tests are **committed `ee41a269`**; the two screens that call it (the report route and its
panel) are still in the working copy, because those same two files carry another chat's in-flight
`CoachPageHeader` variant change and a money-in filter change, and neither could be separated
without breaking the commit or sweeping up work that is not this one's. They land with that chat.
What follows records what was wrong, what the fix does, and what is still owed here.

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

**"What is this against?"** — the team's budget lines, by name, grouped by category:

```
FACILITIES
  Dome rental
  Field rental
TOURNAMENTS
  Spring classic entry
  ──────────────────────────────────────────────
  Not in the budget            → then pick a category, as today
```

- **Choosing a line fills the category automatically.** One decision instead of two, and it cannot
  disagree with the plan.
- **It is the FIRST question on the form, above Description — and it fills that in too** (owner,
  2026-08-15). The line's own name arrives in Description, ready to be typed over, so the field a
  coach used to have to compose is usually already answered. See §9.7 for why Description stays
  required rather than becoming optional.
- **"Not in the budget"** keeps today's category picker and today's honest warning ("this will show
  as Unbudgeted in Budget vs. Actual"). Deliberately not hidden — unbudgeted spending is a real
  category of thing, not a mistake to be designed out.
- **No budget plan yet?** The field degrades to exactly today's category picker. Nothing gets worse
  for a team that hasn't built a plan.

> ⚠ **REVISED BY THE OWNER 2026-08-15, after seeing it built.** This section originally put
> *"$4,000 planned · $1,190 left"* on every option, and called remaining-on-the-line "the quiet
> win". **The options carry names only.** The owner's reading is the correct one: a coach on this
> form is **logging money already spent or already promised, not deciding whether to incur it** — so
> the figures cannot change the decision being made, and they are noise in the one control that has
> to be read to file the cost correctly (and long option strings scan badly on a phone, where this
> form is most often opened). Budget vs. Actual is where overspending is reported, and after this
> plan it reports it line by line, which is what the link was for. See §9.6.

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
  wrong today. **Written up as ledger §29**, whose Part C walks exactly that category.

## 9. As built — where this differs from the plan above (2026-08-15)

Three deliberate departures. The first two make the work smaller; the third changes a rule.

### 9.1 One field, not a new component

§6.2 called for a `BudgetLinePicker` beside `BudgetItemPicker`. It was built as a function inside
the expenses panel instead, because **the two Add modals merged into one form on 2026-08-15**
(`cfb66a84`) after this plan was written. Replacing the single `categoryField` call site gave the
field to expenses, payables, and every edit of either, at once. A component with one call site is an
abstraction built for a caller that does not exist — the recurring-payables group that would be the
second is a separate, unstarted plan, and the code says to extract it when that arrives.

### 9.2 The picker offers COST lines only

This plan predates sponsorships (migration 237). A `funding` or `sponsorship` line is money coming
**in**, and one sitting in the cost machinery would absorb a real expense and inflate the very budget
it exists to offset — the warning Budget vs. Actual already carries in its own words. The picker
filters them out; the server refuses one with a sentence the coach can act on ("that line is money
coming IN … pick a cost line"); and `tests/unit/coach-budget-line-link.test.ts` states it for **both**
money-in kinds, which is the shape migration 237 broke nineteen readers with.

### 9.3 ⚠ The dash rule got sharper — a line with nothing against it reports $0.00

§6.5's first case says the two unlinked lines "report nothing". As built they report **$0.00**, and
only when **nothing in their category is unattributed**. The rule is now:

| | Reported |
|---|---|
| One line in the category | everything the category holds, linked or not |
| The coach pointed spending at this line | that spending, and only that |
| Nothing points here, **and nothing in the category is unattributed** | **$0.00** — every dollar has been claimed by another line |
| Otherwise | `—` |

**Why this is better, and not merely different.** A dash now means exactly one thing: *there is
money in this category that names no line, and some of it could be yours.* So **every dash on the
report has a sentence under the category explaining it, in dollars** — *"$200 of Facilities spending
isn't against a budget line, so it counts in the category total only"* — and that sentence is also
the instruction: re-file those costs and the dashes fill in on their own. Under the plan's literal
reading, a fully re-filed category would still have shown unexplained dashes on the lines nothing
was spent against, which is the "a bare dash reads as a number the product lost" failure this
codebase has a standing rule against.

The invariant the plan actually cares about is untouched and tested: **no line ever shows another
line's money.** The §2 regression (three lines, one unlinked invoice, all `—`) passes unchanged.
One assertion in `coach-budget-line-actuals.test.ts` changed with the rule and says so in place.

### 9.4 The budget line is NOT locked on a paid record

Deliberate, and the opposite of the amount beside it. Re-filing a past cost against the right line
moves no money, posts nothing and touches no ledger entry — migration 236's links are to the
**amount**, not to the classification. Locking it would leave a coach who mis-filed a paid invoice
with only delete-and-re-enter, which reverses and re-posts real money to correct a label.
`lockedFields` is unchanged for exactly that reason: this is not a figure.

### 9.5 The demo links are load-bearing, not decoration

§8 asked for seeded links so Budget vs. Actual shows real per-line actuals — and unlinked, the
report a prospect is most likely to open (the 12U's, on a season 18 games old) shows **a dash beside
every single budget line**, which reads as a product that cannot answer its own headline question.
`check-demo-coach.mjs` now asserts every budgeted demo cost carries its link — and that the 14U's
deliberately-unbudgeted one does not.

### 9.6 ⚠ The picker shows NAMES ONLY — owner ruling, reversing §4

Built with "$4,000 planned · $1,190 left" on every option, per §4 and the mockup. **Removed the same
day at the owner's direction**, and the reasoning is worth keeping because it is a rule about this
form, not a preference about this control:

> A coach on Add Expense / Add Payable is **recording money that is already spent or already
> promised**. They are not deciding whether to incur it. Budget information cannot change the
> decision in front of them, so it is noise in the one control they have to read to file the cost
> correctly.

Two supporting facts: long option strings scan badly on a phone, where this form is most used; and
Budget vs. Actual now reports the overspend **line by line**, which is where that news belongs and
what this whole plan was for.

⛔ **Do not re-add it here without a new ruling.** If a "you are about to overrun this line" warning
is ever wanted, its home is the **recurring-payables commit callout** — the one place in Money where
a coach genuinely *is* deciding, because it creates a run of costs in a single action. That sibling
plan already sketches exactly such a sentence.

### 9.7 The line is asked FIRST, and it names the record (owner, 2026-08-15)

The owner asked why Description is required — *"that seems more like a note that should be
optional"*. It is not the note (that field exists, is optional, and lives under Details). It is the
record's **name**, and four things depend on it:

1. **It is written onto the team's books** as the ledger entry's description when the cost is marked
   paid (`— Deposit` / `— Balance` for a payable's halves).
2. **It is how a delete finds the entry to reverse** on anything paid before 2026-08-15. Those rows
   store no entry id and are matched on description + amount + type; an ambiguous match **refuses**
   rather than voiding an arbitrary entry, so two blank descriptions could make a paid record
   impossible to reverse cleanly. (Migration 236's own comment predicted this.)
3. **It is the only thing naming the row** in the Expenses list, the Payables list, the Payment
   schedule, all three exports and the delete confirmation.
4. **The payables importer matches look-alikes on it**, which is how a re-import avoids
   double-committing a season.

`rep_team_expenses.description` is `NOT NULL` in the database for the same reasons.

**So the answer to the typing is a pre-fill, not an optional field.** The budget-line control moved
**above** Description, and choosing a line puts that line's name into it, ready to be typed over —
most costs are named after the line they are against, so the common case is now zero typing in that
field. ⚠ **The pre-fill never overwrites a coach's own words**: it lands only on an empty
description, or on one still holding the name of the line being switched *away* from — text this
control put there and nobody has touched. Switching to "Not in the budget" clears an untouched
pre-fill for the same reason: it is the abandoned line's name, not theirs.
