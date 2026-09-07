# App-wide table & list consistency — PM brief

**Status:** built on dev 2026-09-06; `/simplify`, `/review` and `/docs` passed 2026-09-06; owner QA §149 owed; A-08 open; committed `07321b4a` 2026-09-07. Plan: `APP_WIDE_TABLE_CONSISTENCY_PLAN.md`.
Mockups the owner approved: https://claude.ai/code/artifact/0aa319dd-a6eb-4fff-b09b-df8591475fe1

## What changes for a person using the product

Every table and list in the product starts reading as one family. A treasurer moving between the
four money tabs in ten seconds sees the same size of text, the same line under every row, the same
frame around every table and the same chevron in the same place. Today they see three row heights,
two body sizes, a row line that is invisible in the warm skin, and a frame that is tinted on one tab
and plain on the next.

Concretely, after the build:

- **Text in list tables is the size the design system intended** (one pixel smaller than today's
  accidental size) — on the coach lists, the platform console and the pricing comparison.
- **Every row has a visible line under it in both skins.** On the money tabs that line has been
  the colour of the page in the warm skin since it was written.
- **One-line rows get shorter; two-line rows do not.** Player Dues, Fundraising, Club and Bills
  tighten by about 15% where a row is just a name and its figures; a row with a caption keeps its
  height. The whole dues roster now sits under its summary band on a laptop.
- **Hover only happens on rows that open.** A row that does nothing no longer lights up.
- **The platform console's column headings become readable** (8.8px → 12px) and its sixteen
  tables share one look; on a phone its two busiest tables become cards instead of a sideways scroll.
- **Tournament admin's five heading treatments become one.**
- **On a phone, the Months view's figures are as tappable as the Statement's** (26px → 44px).
- **The register (Ledger → Timeline) keeps its tight rows and small type** — that is a documented
  exception, and it is the one place allowed to be tighter than everything else.

Nothing any table *says* changes. No figure, no column, no export.

## Why it matters

Drift here is invisible on one screen and obvious across two, and the product is mostly tables.
The standard plus the register means a future difference between two tables is either written down
with a reason or it is a bug — and a guard fails the build when a table invents a size or names a
colour token that does not exist (which is how the zebra never painted).

## Role and access differences

None. Read-only coaches, assistants and admins see the same recipes; what a role can open is
unchanged, and the hover rule follows the existing "can this row open?" logic.

## Tradeoffs taken

- **Density by content**, not by screen (the owner's A-01). Some one-line rows get shorter than a
  coach is used to; the payoff is a rule that cannot drift.
- **The platform console keeps its mono face** as a shell identity, and everything else about its
  tables aligns.
- **Twelve platform tables do not get their phone card shape in this pass** — the recipe is built
  and applied to the two busiest; the rest are one file each and listed in the plan.
- **The coach portal's div-based row lists (schedule, practice plans, tags…)** are not touched;
  they were not in the approved mockups and get their own session.
- **Club-side admin tables** (Families, Members, Rep teams, Accounting, House League) could not be
  rendered and are not touched; one fixture decision unblocks them.

## How to test it

Sign in as the UAT coach and open Money → Club, then Player Dues, then Budget vs. Actual, then
Ledger. Look for one line under every row, one frame, one chevron column, one text size; hover a
row that opens and one that does not. Switch skins. On a phone, open Budget vs. Actual → Months and
tap a figure. Then open the platform console's Orgs page on a desktop and a phone. The owner QA walk
(claimed at the end of the build) turns this into a checkable Artifact.

## Success criteria

1. The review's own measurement, re-run on the changed surfaces, reads the standard's values back:
   body 14, heading 12, the line token under every row, 40/47/65–69px rows by content, hover only on
   rows that open.
2. `npm test` green with the new table-recipe guard in it, and the guard proven by breaking it.
3. The rendered layout sweep at four widths shows no new findings, and fewer tap-floor findings on
   the Months view.
4. Owner QA passes.
