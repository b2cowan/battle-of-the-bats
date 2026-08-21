# PDF Export Quality — plan

**Status:** PARKED 2026-08-21 by the owner, pending a lengthy planning session — scope WIDENED, see the bottom of this file before reading anything above it · **Raised:** owner, 2026-08-21, on seeing the Budget vs. Actual PDF
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

---

## ⚠⚠ SCOPE WIDENED BY THE OWNER 2026-08-21 — and it partly contradicts the section above. Read both.

**The owner, parking this project until it can be done properly:** *"I want to do a deep dive of
these reports and their formats so we can evaluate anything missing, whether we have logos, color
schemes, how the data fits, portrait vs landscape, etc., so it will need a pretty lengthy planning
session and also needs to be relative to each pdf, or at least grouped to similar types of pdf
outputs."*

**Reconciling that with "the project got SMALLER" above — they are about two different axes, and
whoever picks this up must not let one cancel the other:**

| | What it is | Shared or per-document? |
|---|---|---|
| **The two confirmed defects** (D1 title twice, D2 orientation) | Broken plumbing | **Shared** — fix once, nine improve |
| **The owner's deep dive** | Is each document any GOOD? | **Per document, or per group** |

The section above is right that hunting D1 and D2 fifteen times would be waste. **It is wrong if it
is read as "there is nothing per-document to do."** Whether a roster PDF carries the club's logo,
whether a month grid fits the page, whether the colour scheme survives printing, whether the
document is even *missing* something a reader needs — none of that is answerable from the renderer.
It is answerable only by looking at each output.

**So the shape is three phases, not two:**
1. **Fix the shared plumbing** (D1, D2) so the deep dive is not distracted by faults every document
   has.
2. **The deep dive — the owner's lengthy planning session.** Group the fifteen by what they are for
   (a register, a roster, a schedule, a poster, a board) rather than by which renderer built them,
   and evaluate each group: content completeness, branding, colour, data fit, orientation.
3. **The six bespoke documents**, one at a time, as originally described.

⚠ **Do not start phase 2 as an engineering task.** The owner has asked for a planning session with
their involvement, in the same shape as the money-centralization one. Grouping the fifteen is itself
the first question to put to them.
