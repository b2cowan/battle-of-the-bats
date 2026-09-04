# PM brief — the season report finally counts the money families pay

**Plan:** `COACH_BVA_REVENUE_RECONCILE_PLAN.md` · **Priority:** high · **Owner QA:** §142
**Status:** built on `dev` 2026-09-04, awaiting the owner's walk

---

## The one-sentence version

Budget vs. Actual's Statement was leaving player dues — usually the biggest money a team takes in
all year — off the revenue side, which made the season look thousands of dollars underwater when it
wasn't. Dues now sit on the report, and one new sentence under the table tells a coach whether what
they are billing families actually covers the plan.

## What a coach sees differently

**A Player dues row, first in the Revenue band.** What families are billed for the season, and how
much has come in. Before this, the report's two views disagreed about what "revenue" meant by
$11,308 on our test team, and neither view said why.

**A season net a coach can act on.** It read **($11,650.00)** — a season apparently deep under
water — because every cost was counted and the largest source of income was not. It now reads
**($341.70)**, which is the real answer: the plan is $341.70 short of what dues will bring in.

**A sentence under the table that no screen has ever said:**

> "This plan needs $11,650.00 from families and dues bill $11,308.30 — the $341.70 gap is the
> budgeted Season net above. Both columns compare a whole season's plan against what has moved so
> far, so they run short until the season is finished."

That second half matters as much as the first. Mid-season, this report compares a *whole season's*
plan against money that has moved *so far*, so every figure in the Actual column runs behind and
nobody has done anything wrong. Nothing on the screen said so until now.

**A team on day one is told, not shown a zero.** A team with costs in its budget and no dues
schedule sees the row with a dash and a **Set player dues** link, not `$0.00` — because "nothing
owed" and "not set up yet" are different facts and a treasurer acts on them differently.

**A team that asks families for nothing is left alone.** A season whose fundraising and sponsorship
cover the whole plan gets no dues row and no sentence. A permanent "not set yet" prompt would be
nagging a coach to fix something that isn't broken.

## What went away

**The "Funded by players" row is deleted** — from both report shapes, from the Excel/CSV/PDF
download, and from the PDF's summary header.

This is not a loss of information. Once dues are counted as revenue, that row's figure is the
budgeted Season net with the sign flipped — the same fact, printed twice on one screen, one copy
upside down. The number a coach cares about ($341.70) still ships; it ships as the report's own
closing figure, with the new sentence naming the two halves that made it.

The figure keeps its home on the **Budget plan page**, which is the screen that owns "what the plan
needs from families". Nothing there changed.

## Who this affects

Every coach on a premium team who opens Budget vs. Actual — no role differences, no new
permissions, no plan gating. Read-only coaches see exactly the same report; the one new link ("Set
player dues") goes to a screen they already could or could not open on their existing access.

## Tradeoffs taken

**A board reading the downloaded spreadsheet alone loses the phrase "the plan needs $11,650 from
families."** A file has no footnotes, and the alternative — a note row carrying the sentence as
text — puts a string in a money column, which this file has twice been cleaned up to stop doing.
The Budget plan file owns that figure and already prints it, and the statement file keeps every
figure a board needs to reach the same conclusion.

**The dues row's figures don't open a drill-in**, unlike every other figure on this report. There is
nothing of this report's kind behind them — dues are a schedule, not budget lines, and the payments
are another screen's book. The row's caption names that screen instead. Worth the owner's eye on the
walk.

## Why now

This is the last of three things that made the money report disagree with itself, and it was the
biggest. It also has to land **before** the "To date" comparison basis project, which adds a new way
of reading these rows — building that first would mean building it over rows whose meaning was about
to change.

## Success criteria

1. The Statement's Total revenue equals the Months view's Budgeted revenue **to the cent**, on every
   team, proved by an automated check on every build.
2. A coach can answer "do dues cover my plan?" without leaving Budget vs. Actual.
3. Season net is a number a coach would act on rather than one they'd dismiss.
4. "Funded by players" appears nowhere on this report, its download or its PDF.
5. Owner QA §142 passes.
