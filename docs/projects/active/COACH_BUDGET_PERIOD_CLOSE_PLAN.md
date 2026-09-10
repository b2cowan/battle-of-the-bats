# The By-Period Close — plan

**Status:** approved 2026-09-09 (owner, three mockup rounds).
**Mockup:** `docs/projects/active/COACH_BUDGET_PERIOD_CLOSE_MOCKUP.html`
(Artifact `https://claude.ai/code/artifact/4a8f3335-8621-4b37-8ae5-77b746cbca2f`, rounds 1–3).
**PM brief:** `COACH_BUDGET_PERIOD_CLOSE_PM_BRIEF.md`.

---

## 1. Why

The owner asked two questions of the Budget plan's **By period** grid: why the player-installments
figure the List shows is absent, and why a period that raises more than it spends prints a minus.
Both land on the grid's closing row. Investigating it turned up two live states where that row and
the List print **different numbers under one name**.

## 2. What is wrong today (from the code, not a plan)

| # | Defect | Reachable when |
|---|---|---|
| D1 | The grid stops at *Costs less funding*; the List continues to *Player installments* and *Planned buffer* / *Short of covering the plan*. Two views of one screen close on different ladders, with no signpost. | always |
| D2 | With a season estimate set, the List's *Costs less funding* = estimate − funding; the grid's identically-named row = lines − funding. | an estimate is set and differs from the lines |
| D3 | With funding above costs, the List's row is **floored at zero** (`fundedByPlayers`) and the grid's is signed. $0.00 vs a negative. | planned funding > planned costs |
| D4 | Both money grids print a bare minus while the rest of the portal's money copy uses brackets — the shared `fmt()` in `lib/coach-money-summary.ts` returns `($1,234.00)`. The grids read `fmtCompact`, which does not. | any negative on either grid |

D2's root cause is that the grid renames the row *above* the close (`Planned costs` → `Lines so
far`, `estimateDiffers`) but left the close itself wearing the List's name over a different figure.

## 3. Decisions (owner, rounds 1–3)

| Ref | Decision |
|-----|----------|
| **A** | The subtraction keeps its direction. **No** "Funding less costs" — it would make the season total negative for every team that charges dues. |
| **B** | Negatives in **brackets**, portal-wide convention, replacing the bare minus on **both** money grids. A bracketed figure on a *plan closing row* is painted the funding green (money leaning in); a bracketed figure on a *balance* row stays red (the account below zero). |
| **C** | The estimate case is fixed by **showing the missing money**, not renaming: the grid gains *Lines so far* and *Still to itemize* rows inside the Costs band, copied word-for-word from the List, and the subtotal returns to *Planned costs*. Owner explicitly rejected a "Lines less funding" close. |
| **D** | The List's *Costs less funding* row shows the bracketed negative. The zero-floor stays on the figures that **derive dues** (the tile's estimated installments, per player) and comes off the row that states an arithmetic result. |
| **E** | **Player installments are spread onto the grid** (owner overruled the round-1 recommendation): "the monthly view in budget seems like a partial report that makes me need to look elsewhere". Balances/carry-forward explicitly deferred. |
| **F** | The final row uses a **paired header naming both directions** (owner's proposal, standard accounting line form). |
| **G** | The words are **`Shortfall (Buffer)`** — the owner's pattern with *Surplus* swapped out, because *Surplus to share* on the Player Dues tab is spendable season-end cash and this row is a timing artifact of a plan. |
| **H** | Before dues are set, the two new rows **do not render**; a note under the table offers *Set dues for all players*. |

## 4. The screen after

Costs band → categories → (*Lines so far* → *Still to itemize* when an estimate differs) →
**Planned costs** · Funding band → kinds → **Planned funding** · then three closing rows:

```
Costs less funding      171   5,100   3,500     315   1,290    (63)   10,313
Player installments [Scheduled]  —   3,769   3,770   3,769      —       —   11,308
Shortfall (Buffer)      171   1,331   (270) (3,454)   1,290    (63)    (995)
```

Notes under the table:
1. *No date yet* — existing, **reworded** to say it also holds dues not yet on a schedule.
2. **New:** "A figure in brackets on a closing row is a period where the money lands ahead of the
   bills — it goes toward the rest of the season."
3. The estimate note ("Your season estimate has no dates…") is **deleted** — C makes it untrue.

## 5. Build order

**P1 — brackets (both grids).**
`fmtCompact` gains a bracket form, or a sibling; the two grids' cell formatters adopt it. The
budget grid's `fmtCell` currently does `fmtCompact(n)?.replace('-', '−')` — that hand-rolled
typographic minus goes. Tone rules differ by row and are stated where each grid draws them.

**P2 — the estimate rows (C).**
`buildPeriodView` returns the two extra cost rows when `estimateDiffers`; `Still to itemize` lands
in the `UNSCHEDULED` column. `costTotals` becomes the **estimate** and the subtotal label reverts
to `plannedCosts` unconditionally; `estimateDiffers` survives only if something still needs it.
⚠ `Over your estimate` is the List's other branch (lines above the estimate) — the grid must
handle both, not just the friendly one.

**P3 — the List's floor (D).**
`fundedByPlayers` stays floored (it feeds per player and the tile). The List's ladder row reads a
new signed sibling. ⚠ The screen's `fmt()` is absolute-with-brackets, so the row must pass the
signed value, not `Math.abs`.

**P4 — installments on the grid (E/F/G).**
- Route: `budget-plan` gains the dated installments (`due_date`, `amount`) alongside the existing
  `duesAssessed`. ⚠ `duesAssessed` is **Σ schedule totals**, deliberately not Σ installments
  (credits/partial payments must not move the plan). Any schedule amount not covered by dated
  installments lands in **No date yet**, so the row's Total always equals the List's figure.
- `buildPeriodView` gains `duesTotals` and `closeTotals`; both rows render only when dues exist.
- `Shortfall (Buffer)` = costs − funding − dues, per column and in Total; the Total equals the
  List's buffer/short figure with the sign convention inverted (a bracket is a buffer).

**P5 — the export.** `budgetPeriodGridRows` mirrors all three additions. The by-period grid ships
in Excel/CSV only (the PDF is the whole-season statement), so the PDF is untouched.

**P6 — help + demo.** The budget-plan help article's plan-table paragraph learns the three rows and
the bracket notation. The coach sandbox's dock/tour copy is re-read against the new close (this
surface has gone stale across three consecutive releases — see CLAUDE.md).

**P7 — vocabulary gate.** `Shortfall` and `Buffer` are now customer-visible on this row; check for
competing spellings before shipping (the List says *Short of covering the plan* / *Planned buffer*
— shortened forms on a column header, deliberate, recorded here).

## 6. Tests

- `coach-budget-periods-view.test.ts` — the two estimate rows (both branches), the dues row, the
  close, the undated remainder, and the invariant that **every column still adds up**.
- `coach-money-exports-budget-plan.test.ts` — the same three rows in the file.
- `coach-budget-totals.test.ts` — the floor stays on `fundedByPlayers`; the new signed sibling.
- A guard that the two grids format negatives identically, so the next change to one finds the twin.

## 7. Deliberately NOT built

- **Balances / carry-forward on the plan grid.** Owner deferred; the three closing rows are shaped
  so an opening/closing balance could sit under them later without rework.
- **Retiring *Lines so far*.** The two new rows copy the List verbatim; if that wording is to
  change it changes on both views in its own unit of work, never by this grid inventing a third
  vocabulary.
- **A paired header on *Costs less funding*.** Its brackets mean something different (funding ahead
  of bills, not dues ahead of the plan), so it keeps the footnote instead.

## 8. What shipped, and where it differed from the plan

Built on dev 2026-09-09. All seven parts landed. Three notes:

1. **The twin grid needed no code of its own.** Budget vs. Actual's Months view reads the same
   shared compact formatter, so bracketing it was one edit in one place — and its balance rows
   already carried the red-on-negative emphasis, so the colour split (green on the plan, red on a
   balance) fell out correctly with nothing added. Its hand-rolled typographic-minus swap was
   deleted with a headstone.
2. **The estimate rows copy the List exactly** — *Lines so far* then *Still to itemize* / *Over
   your estimate* — rather than inventing a grid-only wording. The owner disliked "lines"; the
   flag is that these two rows are already on the List in these words, so matching is the point.
   Retiring that wording is a separate change to both views.
3. **`estimateDiffers` was deleted, not kept.** Both its readers were the hedge this work removed
   (the renamed subtotal and the apologetic note), leaving a flag nothing asked. `estimateRows`
   being null answers the same question on the thing that answers it.

## 9. Residual risk

The Q3 column in the mockup reads `(3,454)` — dues arrive, no bills fall due, and the money carries
into Q4, but this grid cannot say "carries forward". **Five of six columns can read as a swing
rather than a state.** Accepted by the owner on the reasoning that a partial report sending a coach
to another tab is worse. This is the thing to watch in QA.
