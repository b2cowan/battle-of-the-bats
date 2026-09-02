# PM Brief — Budget vs Actual: Two Truths

**Status:** planned (owner decisions recorded 2026-09-02, nothing built).
**Plan:** `COACH_BVA_TWO_TRUTHS_PLAN.md` · **Mockups:** deep-dive artifact `b9951b82`.

## What's changing, in one paragraph

The Budget vs Actual tab — the treasurer's primary report — quietly runs two ways of counting
money: *what the season spent* (the Statement and the Headroom banner) and *what the cash did*
(the monthly grid). Both are correct; the product just never showed the first one month by month,
which is why a tournament fee a parent fronted "disappeared" from the monthly report. After this
work the monthly view offers both readings by name — **Cash** and **Season spending** — the
fronted fee shows up in its category in its month, and the monthly total finally matches the
banner above it to the cent.

## What a coach sees and does differently

- **A new choice on the Months view: "Season spending."** Every cost in its category, in the month
  it happened, whoever paid it — family-paid costs included and tagged. The total equals the
  banner's "spent". No double-counting is possible: each reading is complete on its own terms, and
  repayment cheques (settlement, not spending) stay on the Cash reading.
- **"Actual" becomes "Cash"** on that menu (pending final confirmation at the mockup gate), so the
  two readings name themselves. The Statement's columns keep "Actual".
- **The table comes first.** The big cumulative chart moves below the table as a collapsed
  "Spending trend" shelf — and its clipped last month label gets fixed.
- **A forward look on the banner:** where the season lands counting money still owed and dues
  still committed — with sponsor pledges shown separately as "possible", never silently banked.
- **Eleven small clarity fixes:** a key for the variance column, visible "not planned" wording,
  the off-plan total on the banner, dates on the family-paid list, a promoted "why cash differs"
  sentence, "refund only" instead of a blank dash, a per-view explainer line, a total-cash-out
  row, an opening-balance provenance note, a chart flatline annotation, and a rename that stops
  "Not itemized yet" colliding with "Not itemized".
- **Exports catch up to the screen:** the board PDF opens with a proper header, carries the
  cash-vs-spending reconciliation, and the "never budgeted" figure appears on screen as well as
  in the file.

## Why it matters

The owner named this tab "the primary source for user reporting." The deep dive confirmed the
math is sound and guarded — the problem is visibility: the right numbers exist but hide in
footnotes, collapsed panels, and export files. This work makes the report self-explaining for a
treasurer and readable for an assistant coach with no accounting background.

## Not in this work (deliberate)

- **Player dues on the Statement** — approved separately; needs its own mockup session because it
  changes what the report's closing rows mean.
- Routing a family repayment back to a category — ruled impossible (pooled credits), settled.
- Per-family statements (Player Dues tab's job) and the season settlement shelf (season-close
  plan's job).

## Success criteria

- The fronted-fee scenario reads correctly end to end on both readings, and a coach can explain
  it from the screen alone.
- Monthly Season-spending total == Headroom "spent", on screen and in every export, to the cent.
- Owner QA walk passes; help articles and the coach-demo money narration move in the same unit
  (that narration is flagged as three releases stale — this work clears it).
