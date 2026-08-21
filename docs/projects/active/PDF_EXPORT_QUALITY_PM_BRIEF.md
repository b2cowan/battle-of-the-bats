# PM Brief — PDF Export Quality

**Plan:** `PDF_EXPORT_QUALITY_PLAN.md` · **Status:** proposed, not started
**Raised:** owner, 2026-08-21 · **Priority:** medium — nothing is broken, but what customers hand to
other people looks amateur

## The problem in one sentence

The documents our customers print and email are the parts of the product we have never looked at.

## What a customer sees today

Exporting **Budget vs. Actual** by month produces a six-page PDF in which every column heading is
printed one letter per line, stacked vertically, and the report's own title appears twice at the top.
It is legible only in the sense that the characters are present.

That document is not for the coach — it is what a coach sends to a club treasurer or a board. It is
one of the few artefacts of ours that a stranger sees, and it is the worst-looking thing we produce.

## What changed about the plan once the code was read

It was raised as *"review the PDFs one by one, they each have their own formatting."* **Nine of them
share one renderer.** Only six are genuinely bespoke — the practice sheet, development summary,
tryout board summary, lineup poster, batting-order card and tournament bracket.

**That makes this cheaper than it looked.** Two defects in the one shared renderer explain what the
owner saw, and fixing them improves nine exports in a single change:

- **The title is printed twice** on any organization that has not customised its export header —
  which is the default.
- **Page orientation is an organization-wide setting, and no report can say it needs landscape.**
  Budget vs. Actual's month grid is seventeen columns wide and gets portrait letter regardless.

Budget vs. Actual is not specially broken. It is the widest table we ship, so it is where a shared
weakness showed up first.

## Why it matters

- **It is seen by people who are not customers** — treasurers, boards, parents. It is a sales surface
  we do not control the impression of.
- **It undercuts a paid feature.** Exports sit behind the Export button on nine screens and are part
  of what a club is paying for.
- **Nothing tests it.** No check renders a PDF, so this got worse invisibly and was found by an owner
  looking at a file.

## Proposed sequencing

1. **The shared renderer** — one unit of work, nine exports better. Includes deciding what a table
   too wide for the page should do, since "silently unreadable" is the current answer.
2. **The six bespoke documents, one at a time** — as originally proposed. These are handed out
   physically and deserve individual attention.
3. **Decide which screens should offer a PDF at all.** Twenty exports offer none today, including
   Transactions and the Budget Plan — possibly right, but currently unexamined.

## Success criteria

- No PDF prints its own title twice.
- The widest table we ship is readable on the page, and a coach can hand it to a treasurer without
  apologising for it.
- A report can declare the shape it needs; the organization's preference stays a preference.
- A check renders the widest export and fails if headings wrap or the page count explodes — so this
  cannot rot unseen again.

## Open questions the planning session must answer

- Who is each PDF actually for, and does that change what "does not fit" should do?
- Should a wide month grid be a PDF at all, or should the PDF carry the statement shape and the
  spreadsheet carry the months?
- Can a coach override the organization's PDF settings for one report, and where?
