# Player dues join the Budget vs Actual Statement — and "Funded by players" is deleted

**Status:** built on `dev` 2026-09-04 · Owner QA §142 owed
**Owner rulings:** 2026-09-04 (the design session), amended twice the same day after the mockup gate
**Design session:** `https://claude.ai/code/artifact/245b6498-b7ff-412f-8062-a47eec82e8fa`
**Approved mockups (the gate):** `https://claude.ai/code/artifact/b77eece5-228c-45f2-aa3d-d705c6c5b5d1`
**Build brief:** `COACH_BVA_REVENUE_RECONCILE_BUILD_PROMPT.md`
**Owner QA walkthrough:** `https://claude.ai/code/artifact/343a8566-04c4-4a55-9354-56e0aa0d0f86`
**Runs BEFORE:** `COACH_BUDGET_DATES_BUILD_PROMPT.md` (the "To date" basis edits the same rows)

---

## 1. The problem

One report, two views, two answers to "what is revenue?", **$11,308.30 apart**, with nothing on
either screen explaining the gap:

| | Total revenue (budgeted) |
|---|---|
| Months · Budget | **$13,258.30** — dues $11,308.30 + fundraising $1,800 + other income $150 |
| Statement | **$1,950.00** — dues excluded entirely |

Two facts were hiding behind that disagreement, and both matter more than the label:

* **The plan needs $11,650.00 from families; dues actually bill $11,308.30 — a $341.70 shortfall
  that appeared on no screen.** The Statement showed the plan figure, Months showed the billed
  figure, and nothing subtracted one from the other.
* **Season net ignored the largest money movement of the season** — reading ($11,650.00) budgeted,
  a season apparently deep under water, because dues were absent from the revenue half while every
  cost sat in the other.

---

## 2. The two owner amendments that override the design session

### ⚠ CHANGE 1 — "Funded by players" is DELETED, not rewritten

The design session kept the row and rewrote it into a three-part sentence. The owner's read, and
the arithmetic agrees, is that **once dues sit in the revenue band the shortfall and the budgeted
Season net are the same number with opposite signs — always, not on this team alone.**

Let **D** = dues billed, **F** = other income budgeted, **E** = the effective spending plan.

```
plan needs from families   = E − F                    (floored at zero)
the shortfall the row said = (E − F) − D
budgeted Season net        = (D + F) − E  =  −((E − F) − D)
```

They are one identity. The row's **Actual** column becomes the negative of Season net's Actual for
the same reason: it was "spending less money in", and money in now includes dues.

So the row goes — **from both report shapes, from the download, and from the PDF's opening block**
(that block quoted the same two figures; deleting the row and leaving its figures in the file's
header would have been the deletion in name only). The $341.70 still ships: **it IS the budgeted
Season net**, printed in the report's own closing chain.

**The one exception, and it is where the identity genuinely breaks:** a season whose other income
exceeds the whole plan needs nothing from families, so "plan needs" floors at zero and
`(E − F) − D` stops equalling `−netBudget`. See §5.3 — this is the state the mockups did not draw
and it needed a decision.

### ⚠ CHANGE 2 — the explanation is a sentence under the table, second in the stack

Not a row. It joins the explanatory stack beneath the table, in the same quiet type as the variance
key, and sits **second**: the key tells you how to read the columns, this tells you what the bottom
line means, then the undated-plan line, then the cash bridge.

Approved wording, verbatim, four states:

| State | Sentence |
|---|---|
| **Short** | "This plan needs **$11,650.00** from families and dues bill **$11,308.30** — the **$341.70** gap is the budgeted Season net above. Both columns compare a whole season's plan against what has moved so far, so they run short until the season is finished." |
| **Over-billed** | "…and dues bill **$12,000.00** — a **$350.00** buffer above the plan, which is the budgeted Season net above. Both columns…" |
| **Exactly covered** | "…and dues bill exactly that. Both columns…" |
| **Not set yet** | "…and no dues are set yet, which is the whole of the budgeted Season net above." + a **Set player dues** link. (No trailing "Both columns…" sentence — there is no Actual column story to tell.) |

"Buffer" and "short" are the **Budget plan page's own words** (*Planned buffer* / *Short of covering
the plan*), so the two screens that both answer "do dues cover the plan?" answer it in one
vocabulary. **No colour on the sentence in any state** — it is prose, and on this report colour
belongs to the variance column.

---

## 3. Rulings taken before the build — do not re-open

| Ruling | Why |
|---|---|
| **Budgeted dues = what is BILLED, specifically the dues INSTALMENTS** — the feed the Months view plots — never the plan residual. | "Total revenue equals Months to the cent" is then true *by construction* rather than by luck. Showing the residual would report money nobody has been asked for. |
| The Budget plan page's own source (Σ schedule **totals**) agrees today and **can** drift from Σ instalments. **If they ever differ, surface it.** | Two screens quoting one fact from two columns. Handled in §6: the guard holds them equal and fails loudly if they part. |
| **The row renders when the season has a dues schedule OR the plan needs money from families.** Figures in the first case; an em-dash and a "Set player dues" door in the second. **Never $0.00.** | Every team is in the second state on day one. A `$0.00` dues row reads "nothing owed"; the truth is "not set yet", and a treasurer acts on those differently. The download already writes a blank rather than a 0 for the same reason. |
| **The download loses "the plan needs $X from families".** | The Budget plan file owns that figure and already prints it. The alternative — a trailing note row — puts a string in a money column, which this file has twice been cleaned up to stop doing. |
| **Do NOT restore the Dues Collection card** deleted 2026-08-26. | This build adds one row to a band that already exists. That ruling's own closing line already accepted dues belong on this report's income side. |
| **Dues are NOT budget lines.** No synthetic budget line. | It would double-count the moment anyone totals the planner. |
| **Season net survives and keeps its name.** | Under this change it finally earns it. |

---

## 4. What changes on screen

### 4.1 The Statement (shape A)

```
REVENUE
  Player dues            11,308.30    3,075.00   −8,233.30    ← new, first in the band
    12 families · set on Player Dues
  Fundraising             1,800.00      778.60   −1,021.40
  Other income              150.00        0.00     −150.00
  …two unplanned income rows…    —    2,485.75   +2,485.75
  Total revenue          13,258.30    6,339.35   −6,918.95    ← now equals Months to the cent
EXPENSES
  …
  Total expenses         13,600.00    4,909.98   8,690.02 under
  Season net               (341.70)    1,429.37   +1,771.07    ← the report ends here now
```

Below the table, in order: the variance key · **the new sentence** · the undated-plan line · the
cash bridge · the Spending trend shelf.

### 4.2 By activity (shape B)

Gets a **Player dues** block of its own, revenue-only, at the head. Without it the blocks would no
longer sum to the Season net both shapes share — the dues row would be money in the closing figure
and in no block above it.

### 4.3 The dues row is not a door, and that is deliberate

Every other figure on this report opens what is behind it (QA §132 round three). The dues row's
figures do not, because there is nothing of this report's kind behind them: no budget lines (dues
are a schedule), and the payment records are a *different* screen's book. Its caption names that
screen instead — and in the not-set state the caption *is* the door. This follows the mockup as
drawn; the alternative (opening an empty panel) is the exact defect `slimCategory` caused on
2026-09-04.

### 4.4 The empty state

| Team | Row | Sentence |
|---|---|---|
| Dues set | figures | yes |
| No dues, plan needs money from families | **Player dues — Not set yet · Set player dues**, em-dashes in all three money columns | yes, the "not set yet" wording, with the same door |
| No dues, plan needs nothing from families | no row | no sentence |
| Nothing on the report at all | unchanged — the report's own empty state | — |

---

## 5. How it is built

### 5.1 The dues row is a synthetic revenue category, keyed the way Months keys it

The rollup groups by category + item and has no home for a dues schedule — **that is the actual
work of this build.** The row is built as a `CategoryRow` carrying the id
`revenueCategoryId('dues')` (`revenue:dues`) — **the same key the Months revenue band already uses
for its dues group** — and injected into `report.revenue.categories` and `report.activities` after
the rollup runs.

* It carries **no items**, so the export emits one row rather than a category and a duplicate item
  beneath it, and there is no empty drill-in to open.
* The section totals and `report.net` are bumped with it, so Total revenue and Season net move
  together and every existing reader (screen, export, PDF) follows without knowing anything new.
* The panel recognises the sentinel id and renders its own row — the same pattern
  `isPayoutCategory` established for the payouts band.

**Nothing is written to the budget planner.** The synthetic category exists only in the assembled
report payload.

### 5.2 The figures come from the streams that feed Months

* **Budgeted** = Σ of the dues-group events already built for the Months revenue band — literally
  the same array, so the two views cannot drift.
* **Actual** = Σ of the dues-group events on the Months revenue band's actual stream — the cash
  strip's own dues arrivals.
* **Plan needs from families** = `budgetTotals.fundedByPlayers`, the shared derivation the Budget
  plan page and the Money hub both read. **The shared derivation is not touched.**

### 5.3 ⚠ The state the mockups did not draw

A season whose other income exceeds the whole plan **and which has a dues schedule anyway.**
`planNeeds` floors at zero, so the identity `gap = −netBudget` is false — but the row must still
render, or Total revenue stops equalling Months and real billed money leaves the report.

**Decision: the row renders; the sentence does not.** The sentence exists to explain the identity,
and with no shortfall to explain, silence is right — the row is self-explanatory on its own. The
guard asserts the suppression rather than trusting it, so this cannot regress into a false proof
printed on screen.

### 5.4 The `funding` payload block is replaced by a `dues` block

`funding` existed to feed the deleted row. Its `fundedByPlayers` half is still needed for the
sentence — but the sentence must also render for a team with **no revenue categories at all**, and
`funding` was null in exactly that case. Keeping it would have meant a field that is half dead and
wrong at the edge. It is replaced by a `dues` block carrying what the row and the sentence need.

`Season net` in the export was gated on `funding` and is now unconditional, matching the screen.

---

## 6. `check:money-report` — two new claims, and neither may skip quietly

1. **The Statement's budgeted revenue equals the Months view's budgeted revenue, to the cent.**
   The identity this whole change exists to earn.
   ⚠ **Scoped to the BUDGETED column, deliberately.** The two Actual columns are two *bases* —
   Months is cash (gross, team-cash only, money back as revenue), the Statement is what the season
   earned — and they legitimately differ. Claiming both would fail on every team that has ever been
   refunded a dollar, which is the mistake the grid-equals-statement claim was deleted for.
2. **The dues row's own budgeted figure equals the Months dues group's**, so a compensating error
   in two groups cannot pass claim 1.
3. **The sentence's gap really is the budgeted Season net** — the sentence makes a proof on screen,
   so it is checked rather than trusted. And when `planNeeds` is floored, that the sentence is
   **suppressed**.
4. **The two "billed" sources agree** — Σ dues instalments (this report) against Σ schedule totals
   (the Budget plan page). They can drift; if they do, that is a real defect to find rather than a
   difference to paper over.

**A season too long to draw fails loudly.** The Months band truncates its columns; its total is
then incomplete and the identity would be compared against a partial figure. The run reports the
claim as UNPROVEN and exits non-zero. A skipped claim must never read as a pass.

**And the fixture must be able to fail it:** a team with no dues schedule cannot break claims 1–3,
so the fixture's dues schedule is named on every run and its absence exits non-zero — the same rule
this script already applies to refunds and split commitments.

---

## 7. Help, and the demos

**Help** (`lib/help-content/coaches.tsx`, "Budget vs. Actual: the two report shapes") taught
"Funded by players" by name and said it sat under both shapes. Rewritten in the same unit of work,
with the article's `keywords` and `searchText`, to teach the dues row, the empty state and the
sentence instead.

**Demos** — both questions asked:

* *Are the coach demo's existing sentences about this screen still true?* **Yes, and two got
  truer.** Tour step 4 ("Seven in ten dollars of dues are in") and the off-season dock line ("dues
  two payments in — and one family behind") both land a prospect on Budget vs. Actual and both make
  a claim about dues — which, until this change, that screen did not show at all. Neither names the
  report's totals, Season net, or the deleted row, so nothing went stale.
* *Should a demo moment show this?* **No new stop.** The `ea8ddd14` cap holds every step at a hook
  plus one proof point, and the seeded worlds render the new shape by themselves. Recorded as a
  dated re-read note beside the narration, per the standing convention.

---

## 8. Out of scope

* The **"To date" comparison basis** and required budget dates — its own project, and it comes
  after this one.
* **Restoring the Dues Collection card.**
* **Changing the Months view.** It was already right; the Statement moved toward it.

---

## 8b. Verified on the live fixture, 2026-09-04

Read off the rendered screen, not from the payload: the row states `$11,308.30 / $3,075.00 /
−$8,233.30` under the caption "12 families · set on Player Dues"; Total revenue `$13,258.30`;
Season net `($341.70) / $1,429.37 / +$1,771.07`; the sentence renders verbatim, second in the
stack. The download, built through the real export builder from the live payload, carries
`Player dues 11308.30` in REVENUE and **ends on Season net**.

`check:money-report` green with all four new claims printing, and **all four adversarially verified
to fail on demand** — a one-cent drift in the billed figure trips claims 8, 8b and 10; only a broken
identity trips claim 9, which is the correct shape (the others are structural). `npm test` 2904/2904.
`npx tsc --noEmit` clean. `check:layout --only=coach-budget-vs-actual` reports no new findings at
361 / 390 / 768 / 1440.

⚠ **The empty state has no fixture.** Every UAT team either carries a dues schedule or is a closed
season (one page, not this report). It is covered by five unit assertions and by the mockup, and by
nothing the owner can look at — seeding a team for it means adding to the shared UAT fixture, which
re-keys the layout baseline other sessions are working against. Raised at QA §142 Part H rather than
done unasked.

---

## 9. Done means

* The Statement's Total revenue equals the Months view's Budgeted revenue to the cent, proved by
  `check:money-report` on every run.
* A coach reads, under the table, what their plan needs from families, what dues bill, and which
  way the gap runs — a sentence that existed on no screen before.
* "Funded by players" appears nowhere on this report, its download, or its PDF.
* Owner QA **§142** walked and passed.
