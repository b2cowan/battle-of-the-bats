# Coach Money — the list reports become one surface

**Status:** approved on mockup, not built.
**Owner ruling:** 2026-09-05, mockup artifact `dde45c3f-7faf-4d5c-869f-627c0c52fb8b`
(round 1 capped the table width; round 2 spans it — the owner rejected the cap on sight,
*"this format looks odd to me when the rest of the screen fits the width"*).
**Mockup source:** `docs/projects/active/COACH_MONEY_REPORT_ONE_SURFACE_MOCKUP.html`
**PM brief:** `COACH_MONEY_ONE_SURFACE_PM_BRIEF.md`

---

## 1. What this is

The owner asked for a fresh look at the three list-shaped money reports — Budget vs. Actual's
**Statement** and **By activity**, and the Budget tab's **List** — measured against the **Months**
grid, which he named the best reading experience in the product:

> *"I am not a fan of the design of this by activity report, there is so much space and the row
> colors do not make it at all clear how these are grouped… the way the monthly view fits everything
> so well on the screen still is the best viewing experience that I have had."*

He explicitly released the standing rulings on these surfaces for this pass: *"do not worry about
any old 'rules' that we have logged regarding these."* Where this plan reverses a logged ruling it
**says so and cites it**, because those rulings are written into code comments that will otherwise
argue with the next contributor.

## 2. The diagnosis

The Money hub draws one structure — categories holding lines holding periods, a figure at every
level — through **two recipes**:

| | Recipe | Adopters |
|---|---|---|
| **Outline** | a bordered, rounded card per category, sitting on the paper ground, 12px gaps between | BvA Statement + By activity; Budget List |
| **Grid** | one white table, hairline rows, tints for structure only | BvA Months; Budget By-period; the Dues installment table |

Months works because it is the grid. Everything in the owner's note traces to the outline:

1. **Two recipes for one hub.** Nothing about these reports needs a card.
2. **The row colour is a status pretending to be a structure.** Amber = "nobody planned this". On
   By activity a planned line sits bare on the paper and an unplanned one is amber, so the colour
   *splits* a group rather than holding it together. Add the tan dues card and the white section
   band: four grounds, none meaning "these belong together".
   ⚠ The code's own note at `.unplannedRow` already conceded this — *"the tint stopped reading as a
   STATUS and started reading as a GROUPING"* — and kept the tint anyway. This pass removes it.
3. **A name and its figures are a screen-width apart with nothing to walk across.** The distance is
   not the defect: Months has the same distance from a line name to its Total column and nobody
   notices, because **a hairline under every row carries the eye across**. Outline rows have no rule
   under them, so the eye has nothing to follow and falls back on the row colours for grouping.
4. **The two shapes put their totals in different places.** The Statement carries a category's total
   on the category row (as Months does); By activity carries it in a closing "netted" row under a
   band, two inner labels and its lines — three extra rows per activity, which is where the height
   goes.

## 3. The change

Move the three list reports onto the **grid recipe**. Nothing the reports *say* changes; only how
the same rows are drawn.

| # | Change | Applies to |
|---|---|---|
| 1 | **One surface.** A single white table with a hairline between rows. No per-category frames, radii or gaps. | all three |
| 2 | **Tints mean structure only.** Olive for a band heading (Revenue / Expenses), tan for a category row. Nothing else gets a ground. | all three |
| 3 | **Status stops wearing a row colour.** An unplanned line shows an **amber dash** in the Plan column and nothing else. | Statement, By activity |
| 4 | **Full width.** The table spans the page as the summary band, the toolbar and Months do. | all three |
| 5 | **Months' rhythm and headings.** Condensed uppercase column headings, 36–38px rows, tabular figures, sticky heading row. | all three |
| 6 | **An activity is a category row carrying its own net.** The "netted" closing row goes; Revenue / Costs become quiet sub-labels inside the block. | By activity |
| 7 | **Player dues is an ordinary category row**, caption under the name. No card of its own. | Statement, By activity |
| 8 | **The Budget List takes the same recipe.** The When column and the pencil stay exactly where they are. | Budget List |

### 3.1 What explicitly does not change

- Every figure that opens a panel still opens it (budget figure → plan lines, actual → payments).
- A **report** row still folds on tap; a **plan** row still opens its editor. The two screens keep
  their different jobs — see the long note at the BvA row, which is correct and stays.
- Compare (Whole season / To date), Expand all, the exports and the footnote stack are untouched.
- Months is the reference and is **not** redrawn.
- Variance still says the word ("under" / "over"); colour never carries meaning alone.
- The screen-reader sentences for an unplanned row **stay** — only the visible ground goes.
- Exports (PDF / XLSX / CSV) are a separate path and are not touched by this pass.

## 4. ⚠ What the build actually is — read this before starting

**This is not "restyle two panels". It is "retire the outline recipe."**

Verified by grep, 2026-09-05: the shared `.ledger*` family has **exactly two adopters** — the BvA
panel (48 references) and the Budget panel (45). Both are converted here. Three other files match
the string `ledger` but read **their own local classes** with coincidentally similar names, not the
shared recipe:

- `accounting/dues/panel.tsx` — already renders real tables (and already shares `gridColNow` with
  the month grid)
- `accounting/MoneyNextThirtyDays.tsx` — local `styles.ledger*`
- `admin/accounting/ledger/[ledgerId]/page.tsx` — a different portal, local classes

**Consequences the build must handle deliberately:**

1. **The shared `.ledger*` family becomes dead CSS.** `check:css-selectors` is a real gate inside
   `verify:changed`, so the family must actually be **deleted**, not orphaned. That is ~15 classes
   plus their media blocks in `coaches.module.css`.
2. **`tests/unit/money-hierarchy-type-scale.test.ts` loses its subject.** It exists to stop the
   outline and the grid drifting apart, and it asserts the outline's rules *exist* ("the class was
   renamed or removed. Update this test WITH the rename; do not delete it"). With one recipe left
   there is nothing to keep in sync. Retire it **explicitly**, with a tombstone comment naming this
   ruling — do not let it fail and get patched around. Its surviving relational assertion (a
   category reads larger than its lines) should move onto the grid family.
3. **The five type-scale variables on `.coachesShell` stay** — the grid reads them too.
4. **Phone pinning gets simpler, not harder.** The outline pins a grid cell (`.scrollXStickyCell`
   plus the `--scrollx-pin-gutter` hand-off, written to stop a label lurching on the first swipe);
   a real table pins `th/td:first-child` through the older, better-tested primitive. The gutter
   mechanics and the per-row `padding-left` dance go away with the outline.

**Net effect: the hub goes from two styling systems to one.** That is a simplification, and it is
the strongest argument for doing this now rather than adding a third variation later.

## 5. Guards that bind this change

| Guard | What it demands |
|---|---|
| `check:css-selectors` | no orphaned CSS — the ledger family must be deleted, not left behind |
| `check:css-module-purity` | any new shared rule needs a local class (a `:global(:root)` rule passes dev and **fails the production build**) |
| `bva-figure-doors-guard` | every figure stays a door; no "N lines" caption returns |
| `check:layout` | 361 / 390 / 768 / 1440 — no document-level sideways scroll, tap floors held |
| `check:contrast` / `check:text-contrast` | the amber dash on white, and every ink on the new grounds |
| `money-hierarchy-type-scale` | must be retired deliberately (see §4.2) |
| `coach-money-exports-*` | untouched — proves the exports did not move |

## 6. Sequence

1. **A — the grid recipe absorbs a fourth column set.** Months is 15+ columns; these reports are 3–4.
   Confirm the shared grid rules carry a narrow column set without change, and add only what is
   genuinely new (the Statement's band heading already exists on the month grid).
2. **B — Statement.** The simplest conversion: it already puts the total on the category row.
3. **C — By activity.** Includes the structural change (§3 item 6): the block's net moves onto the
   category row, Revenue / Costs become sub-labels.
4. **D — Budget List.** Same recipe plus the When column and the pencil track.
5. **E — retire the outline.** Delete the `.ledger*` family, retire the type-scale test with a
   tombstone, run the full gate set.
6. **F — rendered check** at 361 / 390 / 768 / 1440, then the owner QA walk.

**Do A–E as one unit.** Converting one screen and leaving the other on the outline recreates the
exact "two recipes in one hub" defect this pass exists to remove — which is how the hub got here.

## 7. Open question for the owner

**Does an unplanned line keep any cue beyond the dash?** The mockup keeps the dash in **amber**.
Dropping the colour and leaving a plain dash is also defensible, since the Off-plan tile at the top
already totals what nobody budgeted. What is settled: the **row ground goes**.

## 8. Owner QA

New ledger section, to be numbered when the walk is written. The walk must pin identities, not
as-of-today figures.
