# Money by Month — the plan panel narrows to the cell you tapped

**Status:** BUILT on dev 2026-09-21, uncommitted. No migration. Typecheck clean; `bva-figure-doors-guard`
and `month-grid-reconcile-guard` unit suites green (both scan this file). Owner QA walk owed.

## The problem

On the Budget vs. Actual report's Months view, tapping a category's or an item's planned figure in
ANY month opened the identical whole-season list of budget lines, no matter which month was
tapped. A coach tapping "Team Gear · February · $400" saw all seven of the category's items — six
of them dated for entirely different months — with nothing on screen distinguishing which one was
actually February's money. The same defect existed one level down: an item standing for two
budget lines showed both regardless of which one's month was tapped.

Owner conversation, 2026-09-21: reported live off a screenshot, walked through in two mockup
rounds, and reframed by the owner from "filter the category panel" to the wider, correct question
— a category figure and an item figure are both just aggregates one level apart, so they should
open the same way.

## The rule (owner-approved, both mockup rounds)

- **A month (or "no date yet") cell** opens only the budget lines actually scheduled there —
  decided from each line's own dates, at both the category level (which items) and the item level
  (which of an item's own budget lines).
- **Total** becomes the escape hatch — tappable for the first time under the Budget/Difference
  lenses, opening every line unfiltered, always reading as the season's planned money regardless
  of lens (same "the word follows the cell, not the lens" rule the "no date yet" column already
  keeps).
- A narrowed panel that leaves lines out says so — "N more lines are budgeted this season → tap
  Total to see them" — so the escape hatch is discoverable once the other lines stop rendering.
  An earlier mockup round showed those lines ghosted in place; the owner asked for them not to
  render at all, matching how tapping a single item's own figure already worked, and this line
  replaces that affordance.

## What did NOT change

- Each line still shows its own whole-season total, never a fabricated monthly share. No payload
  change was needed or made — filtering reads a line's own `dates`, which the payload already
  carried; the report route's per-line `lineDates` map already existed for the "which line's
  dates?" chooser.
- The Actual/Scheduled/Spending lenses' drill-in panels are untouched — those are already keyed
  per month server-side (`cellDetails` is keyed `<lens>|<category>|<month>`) and never had this
  defect. Total stays inert for those lenses, same as before.
- Read-only vs. write access: unchanged. Both roles see the same narrower list; only a writer's
  lines render as links into the budget form.

## Mockup

Two published rounds, approved: https://claude.ai/artifact/W8NJxoY3CyisAmjirZQD39 — source file
`docs/projects/active/COACH_BVA_MONTH_PANEL_FILTER_MOCKUP.html`.

## Verification

- `npx tsc --noEmit --pretty false` — clean.
- `npx eslint components/coaches/MoneyMonthGrid.tsx components/coaches/MoneyMonthGrid.module.css` — clean.
- `tests/unit/bva-figure-doors-guard.test.ts` (15/15) and `tests/unit/month-grid-reconcile-guard.test.ts`
  (7/7) — both scan this file's source text for standing owner rulings; neither broke.
- Owner browser QA walk still owed.
