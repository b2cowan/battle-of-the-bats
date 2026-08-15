# Kickoff prompt — Budget vs. Actual shows one category's money under every line in it (paste into a fresh chat)

A **confirmed reporting defect** in the coach portal's Money hub. This is a small, isolated
correctness fix — **no migration, no new field, and no work on the Expenses & Payables screen.**

## The defect

`app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts` builds each budget line's
period actuals with `buildPeriodActuals(key, …)` where **`key` is the CATEGORY key**. Every budget
line inside a category is therefore handed the *same category-wide* spending, mapped onto that
line's own periods.

The line row itself is honest — `panel.tsx` prints `—` for a line's actual and variance, because no
per-line figure exists. **But expand a line and its period sub-rows show money, in green, with a
variance** (`panel.tsx` ~L775-801), and that money is the category's.

**Failure scenario.** Facilities holds two lines: *Dome rental* (Nov–Apr) and *Field rental*
(May–Aug). One $340 dome invoice is paid in November. Expanding *Dome rental* shows November: $340 ✓.
Expanding *Field rental* also shows $340 against one of its periods, in green, with a favourable
variance — against a line with no spending at all. Three lines in a category and the same dollar is
reported three times.

It only manifests when a category holds **more than one line**, which is the normal shape of a real
budget (Facilities: dome + field + storage).

## Why this is its own change

The proper fix is for spending to record **which budget line** it was against — planned in
`docs/projects/active/COACH_BUDGET_LINE_ALIGNMENT_PLAN.md`, which needs a migration and touches the
money forms. That work is queued behind other in-flight changes on the Expenses & Payables screen.

**This change stops the wrong number now**, with nothing that collides. Read that plan for context
(§2 is this defect) — but **do not implement any of it here**.

## Read first

1. `docs/projects/active/COACH_BUDGET_LINE_ALIGNMENT_PLAN.md` — §2 (this defect) and §6.3 (where the
   real fix lands). Context only.
2. The route above — the whole of `buildPeriodActuals` and its call site inside `categoryResults`.
3. `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx` — how a line and its
   periods render, and the comment near L383 recording that only the BUDGET is known per line.

## The work

### 1. Make the per-line period actuals honest

**Recommended behaviour — verify it before building it:**

- **A category holding exactly ONE line:** the category's spending *is* that line's spending, so the
  figure is correct and useful. **Keep showing it.**
- **A category holding TWO OR MORE lines:** no per-line figure can be known. **Show nothing** —
  `—` for the period's actual and variance, matching what the line row above it already does.

Suppressing everywhere would be simpler but would throw away a correct number on single-line
categories, which are common. If reading the code shows the single-line case is *not* reliably
correct, say so and suppress everywhere instead — but show the reasoning.

### 2. Say why the number is missing

A dash with no explanation invites a bug report. Where actuals are suppressed, the category needs one
quiet line in the coach's language — something to the effect of *"Facilities has 3 budget lines, so
spending is shown for the category as a whole."* Write it in the portal's voice; do not over-explain
and do not promise a future feature.

### 3. Sweep for the same figure elsewhere — **I have not verified these**

Check each and report what you find:

- The **"Budget by month"** lens / `buildMonthGrid` in `lib/coach-budget-months.ts` — does it
  distribute category actuals across lines the same way?
- The **export** (`lib/coach-money-exports.ts` + the panel's export builder around L383) — its
  comment says line actuals are deliberately blank; confirm no false per-line actual reaches a file.
- The Money hub Overview / `MoneyNextThirtyDays` / `OverviewDashboard` — any per-line actual there.

Fix what carries the same defect. If a surface is clean, say so explicitly.

### 4. Regression test

The case that is wrong today: **a category with three lines and one paid expense** — the linked
category totals correctly, and **no line reports the money**. Plus a single-line category still
reporting its actual (if you keep behaviour 1).

## Scope boundaries — important

- ⛔ **Do not touch `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx`.** Another
  chat is actively working on that screen (Edit/Delete for rows, and a single Add button with an
  Expense/Payable switch). Editing it here will collide.
- ⛔ **No migration, no schema change, no new columns.** The link between spending and a budget line
  is the *other* plan's job.
- ⛔ Do not add the budget-line picker, and do not change either money form.
- ✅ Budget vs. Actual (route + panel), the month-grid helper, and the export are in scope.

## Finishing

- `npm run verify:changed`; `npm run typecheck` if you touch anything shared.
- **Help docs:** this changes what a coach sees on a report — offer `/docs` and check whether any
  budget guide describes per-line actuals.
- **Demo:** Riverdale Ridge has a budget plan and seeded spending, so its Budget vs. Actual will look
  different. Run `npm run check:demos` and confirm the demo still shows a sensible report.
- Update `docs/projects/active/COACH_BUDGET_LINE_ALIGNMENT_PLAN.md` §2 to record that the display
  half is fixed and what remains (real per-line actuals, which need the link).
- Add an owner QA entry to `docs/projects/active/OWNER_QA_LEDGER.md` — the multi-line category case
  is the one that matters.
- Offer `/review` when done. `/simplify` is probably not warranted — no new abstraction.

## Working rules

- Branch is **`dev`** — check before committing; another chat may have moved it.
- Stage **explicit pathspecs only**, never `git add -A`. Confirm with `git show --stat HEAD` that
  only your files landed.
- **Do not commit or push without explicit confirmation from the owner.**
