# Coach Budget Plan — the plan adds up on the page (the ladder)

**Status:** owner-approved on mockup round 2, 2026-09-08 (artifact
`e94d05d9-2f07-455d-8cd9-93ea7b1c3f48`, source `COACH_BUDGET_PLAN_LADDER_MOCKUP.html`). Built and
committed `e1aa4b6e` on `dev` 2026-09-08 after `/review` (§6). No migration.
**✅ OWNER QA §156 PASSED 2026-09-09 — 40 of 43 walked, zero defects, nothing flagged.** Both
build-time calls accepted as built (the subtotals always render; under the When filter the close
steps aside and the subtotals read *Costs shown / Funding shown*). ⚠ **Part I's three states were
NOT walked** — the pre-dues close and the two season-estimate cases need a team with no dues and an
estimate that differs from its lines, which the UAT fixture is not; they stand on the export unit
tests alone, so no human has read either on a screen. Archived 2026-09-09.
**PM brief:** `COACH_BUDGET_PLAN_LADDER_PM_BRIEF.md`.
**Decision record:** `docs/agents/strategy/BUSINESS_DECISIONS.md` 2026-09-08 ("expected" leaves the
plan) · `memory/design_decisions.md` 2026-09-08 (bands, subtotals and the ladder).

## 1. The problem, in the owner's words

> "with no grouping or subtotals it doesn't read like … x + y = plan expected over/under … users are
> left to mentally sum up lots of rows to validate the figures."

The Budget plan's List view put four cost categories, two money-in sections and the installments
line at ONE level, and closed on a residual with nothing on screen showing the number it was
subtracted from. The By-period grid closed on "Costs less funding" with no cost subtotal above it.
The tiles above the table named three numbers (Planned costs · Expected funding · Player
installments) that appeared nowhere in the table beneath them.

The recorded reasons for the old shape all explain why there is no **Revenue** band (dues are the
plan's answer, not an input; polarity wording is a Budget vs. Actual problem). None of them explains
why there was no **subtotal**. That was the gap.

## 2. What is built

### 2.1 One rule
**The three tiles are the table's three subtotals, with the same names verbatim.** Planned costs ·
Planned funding · Player installments. The tiles read as the headline of the table rather than as a
second summary.

### 2.2 The List view (specimen 02 / 03 on the mockup)

```
[band] COSTS
  > Facilities …                          (category rows, UNCHANGED)
  Lines so far / Still to itemize          (ONLY when a season estimate is set and differs)
Planned costs                    13,621.00   (subtotal — the shared closing-total recipe)
[band] FUNDING
  > Fundraising …                          (kind sections, UNCHANGED apart from the word)
  > Other income …
Planned funding                   1,950.00   (subtotal, green)
Costs less funding               11,671.00   (ladder row, 2px cap, sub-line "What player installments need to cover")
Player installments  [Scheduled] 11,308.30   (ladder row — RESTYLED: no category tint, ordinary ink, the tile's tag)
Short of covering the plan          362.70   (close — UNCHANGED, amber; "Planned buffer" plain; no row when equal)
```

Before dues are set the third block is ONE row, the close: **Player installments [Estimated]** with
the sub-line "Costs less funding, until dues are set · ≈ $X per player ÷ N · set dues for all
players" (mirrors the tile caption). With no funding lines the sub-line says "Planned costs, until
dues are set" and the Funding band and the Costs-less-funding row do not render.

**Season estimate set and different from the lines** (specimen 07): two line-weight rows under the
last category — *Lines so far* (itemized) and either *Still to itemize* (estimate − lines) or *Over
your estimate* (in the red the tile already uses) — then *Planned costs* = the estimate. "Planned
costs" stays the number the plan actually uses, exactly as the tile does today.

**The When filter.** A filtered list adds up to its own subtotals (Planned costs / Planned funding
sum the SHOWN lines). The season's close — Costs less funding, Player installments, Short/buffer —
belongs to the whole plan, so it does not render while a filter is on; the tiles above still carry
it. (Today the close rendered season figures under a filtered list, which was the exact mismatch
this project removes.)

### 2.3 The By-period grid (specimen 05)
Same two bands, same two subtotals per column (Planned costs · Planned funding), closing on the
existing **Costs less funding** row. With no funding groups, *Planned costs* IS the closing row and
the old "Total planned budget" footer retires. Player installments are deliberately NOT spread into
the grid — that is Budget vs. Actual → Months' job with real arrivals, and a separate decision.

### 2.4 The words (owner 2026-09-08, round 2)
- Bands are bare nouns: **Costs**, **Funding**.
- Kind rows are bare: **Fundraising**, **Sponsorship**, **Other income** (the cost categories never
  carried a prefix either).
- The one qualifier sits on the number that is the plan's figure, the same on both sides:
  **Planned costs**, **Planned funding**. Tiles carry the same words.
- **"Expected" leaves the plan's vocabulary.** Everything on the screen is planned; a second
  qualifier only implied a distinction (control over the money) the plan does nothing with.
- Reach: both plan views, both exports, the three tiles, the set-dues window's arithmetic line
  ("− $1,950.00 planned funding"), the line form's per-kind consequence sentences, the report notes
  a PDF prints, five help articles + their keywords, the demo world's check script, and the tests
  that assert these labels. Sponsorship keeps its own row (Budget vs. Actual reports it apart).
- **Not touched:** the form's direction dropdown ("Money the team spends" / "Money coming in"),
  Budget vs. Actual's Revenue / Expenses bands. ⚠ The hub now uses three pairs of words for
  direction across three rooms; flagged in §5, not fixed here.

### 2.5 Exports follow the screen (QA §146 F2 rule)
The statement file gains the two `section` rows (UPPERCASE, the statement export's own band
convention), the two subtotals, the estimate rows when present, and the Costs-less-funding row; the
period file gains the two `section` rows and the two subtotal rows. Row kinds: bands `section`,
subtotals/ladder `total`, estimate rows **`plain`** (level 0 — an `item` row is hidden inside the
category above it in Excel). **The file is always the whole plan**, whatever the When filter shows.
The importer skips every ladder word by construction (`DERIVED_ROW_LABELS` reads `PLAN_LADDER_LABEL`).

## 3. Files

| Area | File | Change |
|---|---|---|
| Words | `lib/coach-budget-totals.ts` | `LINE_KIND_SECTION` bare nouns; new `PLAN_LADDER_LABEL` record (every label the list, grid, exports and tiles share) |
| Grid maths | `lib/coach-budget-periods-view.ts` | `PeriodView.costTotals` + `fundingTotals` (per-column subtotals), computed in the same pass |
| Exports | `lib/coach-money-exports.ts` | statement + period rows mirror the new shape; `BudgetPlanExportSource.totals` widened to the fields the ladder reads |
| Screen | `accounting/budget/panel.tsx` | List: bands, subtotals, estimate rows, ladder; grid: bands + subtotal rows; tile label; kind hints |
| Styles | `accounting/budget/budget.module.css` | `.ladderRow`, `.ladderGap`, `.estimateRow`, `.estimateOver`, phone rule for the tag |
| Dues window | `accounting/GenerateInstallmentsModal.tsx` | "planned funding" in the arithmetic line |
| Report notes | `lib/coach-money-report-notes.ts` | "your planned funding" |
| Help | `lib/help-content/coaches.tsx` | five articles + keyword/searchText arrays |
| Demo | `scripts/check-demo-coach.mjs` | check message wording |
| Tests | `tests/unit/coach-budget-periods-view.test.ts`, `tests/unit/coach-money-exports-budget-plan.test.ts` | new rows/labels asserted; subtotals executed, not eyeballed |

## 4. Verification
- `npm run verify:changed` (lint-focused, spelling gate, dictionary gate, demo check).
- Unit: the two files above run the pure builders — the subtotals are asserted as numbers.
- Owner QA §156 walk artifact (checkable): both states of the list, the estimate case, the filter,
  the grid, the phone, both exports.

## 5. Decisions taken in the build (owner can overturn in QA)
1. **Subtotals always render** when their band renders, even over a single row — the shape is
   stable and the tile's name is always in the table.
2. **The close steps aside under the When filter** (see 2.2), and the filtered subtotals read
   **Costs shown / Funding shown** — a slice may not borrow the tiles' names. The tiles keep the
   season answer.
3. **Three direction vocabularies** across the hub (form / plan / statement) are flagged for a
   separate `/strategy` question, not changed.

## 6. What `/review` found (2026-09-08, high-risk tier, four lenses) — all fixed
| # | Finding | Fix |
|---|---|---|
| 1 | Estimate rows exported as indented `item` rows — hidden inside the last category's collapsed Excel group | New level-0 `plain` row kind |
| 2 | Re-importing the plan's own export fabricated two budget lines from the estimate rows | Importer's derived-row set reads `PLAN_LADDER_LABEL`; round-trip unit test |
| 3 | List's Planned funding subtotal lost its green (specificity (0,2,0) < (0,2,3)) | `.fundingRow` on the row |
| 4 | "Planned costs" meant two numbers: grid = itemized, List = estimate | Grid reads **Lines so far** when an estimate differs (`view.estimateDiffers`), plus a footnote |
| 5 | Filtered export mixed season subtotals with filtered category rows | Export is always the whole plan |
| 6 | Filtered on-screen subtotals borrowed the tiles' names | **Costs shown / Funding shown** |
| 7 | Costs less funding signed in the file, absolute on screen | Both print `fundedByPlayers` (floored) |
| 8 | PDF exhibit fixture passed the old three-field totals (untyped `.mjs`) | Fixture carries the full shape |
| 9 | Band rows: dash in the PDF money column, lower-case in the file | UPPERCASE band labels (REVENUE/EXPENSES convention), blank money cell |
| 10 | Rendered check: grid heading's inert sticky rule exposed once the grid grew taller than a phone | Cancelled like the List's (`top: auto`, non-pin cells static) |
