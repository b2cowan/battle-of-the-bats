# PDF Export Quality — plan

**Status:** proposed, not started · **Raised:** owner, 2026-08-21, on seeing the Budget vs. Actual PDF
**PM brief:** `PDF_EXPORT_QUALITY_PM_BRIEF.md`

---

## ⚠ The framing changed once the code was read, and it makes this project SMALLER

The project was raised as *"evaluate our PDF exports one by one, given they have separate formatting
for each."* **That premise is only true for a minority of them.**

| | count | how they are built |
|---|---|---|
| **Tabular PDFs** | **9** | **ONE shared renderer.** Same header, footer, accent bar, density, orientation. |
| **Bespoke documents** | **6** | Genuinely their own layout — practice sheet, development summary, tryout board summary, lineup poster, batting-order card, tournament bracket. |

The nine sharing a renderer: Tournament Registrations · Tournament Schedule · Tournament Results &
Scoring · House League Season Registrations · Tryout Report · Team Roster · Player Dues ·
**Budget vs. Actual** · Rep Teams Roster.

**So the work splits in two, and the halves are not the same size:**
1. **Fix the shared renderer once and nine exports improve at once.** This is where the ugliness the
   owner saw actually lives.
2. **Then walk the six bespoke documents one at a time**, which is the project as originally
   described — and correctly so, for those six.

⚠ **Doing it "one by one" across all fifteen would mean discovering the same two shared defects nine
times and fixing them in the wrong place.**

## Two defects are already confirmed, and they explain the screenshot

**D1 · Every PDF prints its own title twice, by default.** The page header prints the org's custom
header line — falling back to **the report title** when that line is blank — and then the title block
below prints the title again. The custom line is **empty in the default settings**, so any
organization that has not customised its exports gets the title stamped twice on every PDF, in two
different sizes. Cheap to fix and it is on all nine.

**D2 · Orientation is an org-wide preference, not a property of the report.** It defaults to
portrait, and nothing considers how many columns a table actually has. Budget vs. Actual in the
Months view carries **17 columns** (a label, fifteen months, a total) squeezed into portrait letter —
roughly 11mm per column, which is why every heading wraps to one character per line and the document
runs to six pages of confetti. **A month grid is landscape by nature and the renderer has no way to
say so.**

Neither is a Budget-vs-Actual defect. Budget vs. Actual is simply the widest table we ship, so it is
where a shared weakness became visible first.

## Proposed shape

**Phase 1 — the shared renderer (one unit of work, nine exports).**
- Kill the duplicated title.
- Let a report declare its own orientation, and/or choose it from the column count, rather than
  inheriting one org-wide setting. The org preference should remain a preference, not a straitjacket.
- Decide what a table too wide for any orientation does: scale the type, split columns across pages
  with the label column repeated, or refuse and say so. **Silently unreadable is the one option that
  is not allowed.**
- ⚠ **Judge it on the widest real table we ship, not a tidy one.** A five-column roster looks fine
  today and proves nothing.

**Phase 2 — the six bespoke documents, one at a time**, as originally proposed. These are posters and
sheets people physically hand out, so they earn individual attention.

**Phase 3 — decide the floor.** Twenty catalog exports offer no PDF at all, including
Transactions & Payables and the Budget Plan. That may be right (a ledger is a spreadsheet, not a
handout) — but it should be a decision, not an accident.

## Open questions for the planning session

1. **Who is each PDF for?** A roster PDF is pinned to a wall; a Budget vs. Actual PDF is emailed to a
   club treasurer. That changes the answer to "what do we do when it does not fit."
2. **Is a wide month grid even the right thing to hand someone as a PDF**, or should the PDF be the
   statement shape and the spreadsheet carry the months?
3. **Should the org's PDF settings be per-report overridable**, and where would a coach set that?
4. **What proves a PDF is acceptable?** Today nothing renders one in a check. A page-count and
   column-width assertion on the widest table would have caught this before an owner saw it.

## What must not happen

- Fixing Budget vs. Actual alone. The other eight share its renderer and its defects.
- A per-report formatting fork, which is how nine exports become nine formats to maintain.
