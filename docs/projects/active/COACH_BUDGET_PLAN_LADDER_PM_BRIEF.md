# PM brief — the Budget plan adds up on the page

**Plan:** `COACH_BUDGET_PLAN_LADDER_PLAN.md` · **Mockup of record:** artifact
`e94d05d9-2f07-455d-8cd9-93ea7b1c3f48` round 2 · **Priority:** high (a treasurer's core screen) ·
**Owner-approved** 2026-09-08 · committed `e1aa4b6e` on `dev` 2026-09-08 · no migration.

## What a coach sees differently
- The Budget plan's table is split into two groups with headings, **Costs** and **Funding**, and
  each group ends on a subtotal: **Planned costs** and **Planned funding**. Those are the same two
  names as the tiles above the table, so the tiles are now the table's headline.
- The bottom of the table reads as a ladder: **Costs less funding** (what installments have to
  cover), **Player installments** with its Scheduled tag, then **Short of covering the plan** or
  **Planned buffer**. Before dues are set, that block is one line, **Player installments (Estimated)**,
  saying where the figure came from and what it means per player.
- If a season estimate is set and the lines don't match it, the gap is shown as rows under the
  costs ("Lines so far", "Still to itemize" or "Over your estimate") instead of only in a tile caption.
- The By period grid gets the same two headings and two subtotal rows, column by column.
- The word **"Expected"** is gone from the plan. Money-in rows read Fundraising, Sponsorship, Other
  income; the aggregate reads Planned funding everywhere it appears, including the set-dues window.

## Why it matters
A coach could not check the plan's closing number without adding up rows by hand. Now every
intermediate number is on the page, and the same three names carry from the tiles to the table to
the export and to the set-dues window.

## Trade-offs
- The list is about five rows taller (roughly 220px on a typical plan). The table is what the tab
  exists for, so the height was judged worth it; the "subtotals only" variant was drawn and rejected
  because a green row still read as a category until you passed it.
- Under the "No date yet" filter the season's closing lines step aside, since a slice of the plan
  has no shortfall; the tiles keep saying it.

## Roles
No change. Read-only money assistants see the same rows without the set-dues and Edit doors.

## How to test
Coaches portal → Money → Budget. Read the table top to bottom with the arithmetic sheet on the
mockup; switch View to By period; filter When to "No date yet"; open the Export; open the same tab
on a phone. Then Player Dues → Set dues for all players and read the arithmetic line under "Split
the budget evenly".

## Success
A coach can confirm the closing figure from the rows above it without a calculator, on desktop, on
a phone, and in the exported file; help search for "planned funding" finds the plan article.
