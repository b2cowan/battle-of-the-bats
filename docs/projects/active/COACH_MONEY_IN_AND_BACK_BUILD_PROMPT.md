# Kickoff prompt — money in, money out, money back (paste into a fresh chat)

Build `docs/projects/active/COACH_MONEY_IN_TAXONOMY_PLAN.md`. It is **approved by the owner**
(2026-08-16) and its mockup is binding:
https://claude.ai/code/artifact/ee76cc79-ef74-4b78-8b03-5cf28a7f4d37

**This is ONE release covering TWO plan files.** The money-in plan absorbed
`COACH_MONEY_BACK_ON_A_COST_PLAN.md`, which remains the binding detail for how a refund behaves.
Neither is built. **Do not build either half alone** — they share the form, the picker, the record
shape and the report arithmetic.

---

## ⚠⚠ CHECK THIS BEFORE WRITING ANY CODE

**This rides on the category+item work, which is on `dev` and NOT on production.** Migrations
238/240/241/242 are dev-only and owner QA ledger **§29 is outstanding**.

Ask the owner which they want before starting:
- **Safest:** wait for §29 to pass and those migrations to reach prod. You build on a settled base.
- **Faster:** build on dev anyway, accepting that a §29 defect in the picker or the rollup moves
  ground under you.

**Do not decide this silently.** If you proceed, say so in your first message and note the risk.

⚠ Also confirm the next migration number at the moment you write it — **242 is the latest as of
2026-08-16, so yours is 243** — other chats are active in this working copy.

---

## Read first, in this order

1. `docs/projects/active/COACH_MONEY_IN_TAXONOMY_PLAN.md` — the whole thing.
   **§6 and §8 are dead designs recorded so nobody rebuilds them. Read them; do not build them.**
   §1 and §3 are the build; §4 is the correctness rules.
2. `docs/projects/active/COACH_MONEY_BACK_ON_A_COST_PLAN.md` — ⚠ **§2 is the single most dangerous
   thing in this release** (money back vs paid out of pocket). §3 is the settled decision log; §4.3
   and §6 are the refund rules, inherited whole.
3. `docs/projects/active/COACH_MONEY_IN_TAXONOMY_PM_BRIEF.md` — the coach-facing story.
4. The mockup above — §1 is the defect being fixed, §2 the form, §3 both report shapes.
5. `lib/coach-budget-rollup.ts` + `tests/unit/coach-budget-rollup.test.ts` — **the rule module this
   release extends.** Two levels, item names the row, two lines on one item SUM, an item with
   spending and no line is its own flagged row. ⚠ **Extend it; do not write a second rollup.**
6. `lib/coach-budget-items.ts` + `tests/unit/coach-budget-item-tiers.test.ts` — the three ownership
   tiers and the sport rail. Income items reuse this **unchanged**.
7. `lib/coach-budget-totals.ts` — `FUNDING_LINE_KINDS`, `isFundingKind()`,
   `normalizeBudgetLineKind()`, `computeBudgetTotals()`.

Pull `memory/` topic files only as the diff needs them.

---

## The state of the code you are extending

**The money form is ONE modal** (`app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx`)
with a kind switch, and the same modal does Edit. `budgetItemField()` renders the category + item
selects. **One call site — do not re-split the forms.**

**A budget line has three kinds:** `cost`, `funding`, `sponsorship`. The last two are money IN.
⚠ `tests/unit/budget-line-kind-guard.test.ts` **enforces over the whole source tree** that nothing
compares these literally — everything goes through `isFundingKind()` / `normalizeBudgetLineKind()`.
It will fail your build if you write `=== 'funding'`, and it has caught this twice already. It also
trips on the table name appearing in new files; if a legitimate new reader needs adding to
`KIND_AGNOSTIC`, add it **with a reason**.

**The report route** (`app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts`) currently
**filters funding lines out of the cost machinery at the top** (`lines` vs `fundingLines`) and
handles them in §9 as a single derived total: realised fundraiser entries, team share, **receipts
only**. That §9 comment explains why a funding line must never enter the cost path — read it before
you merge the two.

**The report panel** has a segmented control, `categories | months`, persisted in the URL
(`?view=`). ⚠ **`?view=categories` must keep working** — layout screens address these URLs.
Recommendation: `categories` becomes **Statement** (shape A) and **By activity** (shape B) joins as
a third segment, with the old value still resolving. Confirm by reading the built control.

---

## Build order

**1 — The rollup learns direction and shape.** Extend `lib/coach-budget-rollup.ts` so a row carries
its direction and a refund nets into the row it repaid. Produce **both** shapes from one grouping
pass — statement (Revenue / Expenses / Net) and by-activity (per category: revenue, costs, net).
⚠ **Write the tests first here.** This module is the whole release; everything else renders it.

**2 — The record.** A money-in actual, and a money-back record. ⚠ Money back is **its own kind, not a
negative expense** (money-back plan §6.4), so no list of expenses ever shows a negative amount and
every existing sum keeps its sign. ⚠ **`ON DELETE SET NULL`** on the plan link — deleting a plan row
must never delete a record of money.

**3 — The form.** Three answers replacing the two-way switch. Payable stays a timing attribute on the
cost side — **say why in the code**. "Money back on something" points at any item (a cost item
reduces the cost; an income item reduces the income) — that is deliberate, and cheap.

**4 — The report.** Both shapes, joined to the existing lens control. ⚠ Variance polarity per
section; wording differs by design (revenue up/down, costs over/under). ⚠ Colour never carries it
alone.

**5 — The library.** Eight items, plan §3.6, into existing categories. Direction is a **picker hint
that sorts**, never a constraint; coach-created items are untagged; categories are never tagged.

**6 — The guards.** Plan §4, every one.

---

## ⚠⚠ Traps, in the order they will bite

1. **"Money back" is NOT "paid out of pocket."** A coach says "a parent paid me back" for both. One
   returns money the team spent; the other means the team **owes that family a credit**. Merging them
   credits a family twice or loses a credit — real money, real family. **Test one of each on the same
   item.**
2. **Two sources for one row.** Fundraisers and sponsors already derive their own actuals and player
   rebates depend on them. A category whose actual is derived **must not accept a typed one**, and
   the screen must say so.
3. **Never both.** An arrival is income **or** money back. Counted twice, $325 makes a season look
   $650 better.
4. **Nothing changes anyone's dues.** The funding ladder already subtracts expected funding from what
   players cover and it is a short step into the dues screen. **Do not take it.**
5. **The kind guard will fail your build.** See above.
6. **A negative must not render as "under budget."** Items and category subtotals can both go
   negative. Brackets, never a minus sign — `lib/coach-budget-import.ts` already *reads* `(450)` as
   negative, so the notation exists. ⚠ Assert the **computed** value, not the class
   (`memory/reference_cascade_collisions_coach_budget.md` — an outranked class is a silent no-op).
7. **No backfill, anywhere.** Existing money-in lines keep working in the *No category / Not
   itemized* bucket. Guessing a category is confident-and-wrong data.
8. **Empty fixtures lie.** A green sweep over an empty fixture is not evidence
   (`memory/project_layout_invariant_sweep.md`). Seed a team with income, costs and a refund in one
   category before believing any report screen.
9. **Money dates.** `formatStoredDate()` only — a money row mixes `date` and `timestamptz` and
   hand-rolled formatting has printed garbage on three screens
   (`memory/reference_stored_date_formatting.md`).

---

## Verification

- `npm run verify:changed`, `npm run typecheck`, `npm run check:migrations`,
  `npm run check:dictionary` — the migration must update `docs/agents/db/DATA_DICTIONARY.md` and
  refresh snapshots **in the same unit of work**.
- `npm run check:layout -- --changed` **with a dev server up and the UAT fixture seeded**. This
  release reshapes a table and adds a form — it is exactly what that check exists for. ⚠ If you skip
  it, say so; a silent skip reads as a pass.
- Unit tests on the rollup are the deliverable, not an afterthought.

## Follow-through in the same unit of work

- **Help docs** (`/docs`) — the Money guide describes two kinds on the form and needs the third; the
  FAQ distinguishing *money back* from *paid out of pocket* is the one most worth writing. Budget vs.
  Actual needs both shapes.
- **Demo sandboxes** (`/demos` judgement, `npm run check:demos`) — the coach sandbox needs at least
  one income entry and one refund, or a prospect never meets the feature. A cancelled tournament
  entry reads well. **Assert both** in `scripts/check-demo-coach.mjs`.
- **Owner QA ledger** — new section on completion.
- **TODO.md** — update the entry, don't write a new one.

## Offer at the end

`/simplify` first (this adds a rule module extension and a new record shape — real overcomplication
risk), then `/review`.
