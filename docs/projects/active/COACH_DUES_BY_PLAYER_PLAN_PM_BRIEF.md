# PM brief — Player dues opens into the players

**Plan:** `COACH_DUES_BY_PLAYER_PLAN.md` · **Raised:** owner, QA §146, 2026-09-06 · **Status:** step 1 shipped + walked 28/28 · **step 2 DELETED 2026-09-07** — superseded by the credits-and-paybacks project (see below)

## What a coach can do that they cannot do today

On Budget vs. Actual, **Player dues** is the biggest single figure on the revenue side of a season —
and it is the only row on the report a coach cannot open. Every other row opens: a category opens
into its lines, a line opens into its payment schedule, and each figure opens the records behind it.

After this change, `Player dues` opens the same way, into **one row per family**, showing what that
family was scheduled to pay, what has arrived, and the difference — in the same four columns as the
row above it. It works on the Statement, on By activity, on Months, and on the Budget tab's plan.

## Why it matters

**The report currently drills into one side of its own comparison.** On the Months view, opening the
dues figure already lists every family's payment by name. The planned side opens nothing. So a coach
who asks *"who is behind?"* can see what arrived but not what was expected — on the screen built to
put those two numbers beside each other.

The information already exists. The Dues tab shows exactly this comparison per player today. What is
missing is the ability to ask the question **where the coach is already standing** — mid-report,
looking at the shortfall, without leaving for another screen and losing the context.

## What it is not

It is not a second dues screen. Budget vs. Actual keeps answering *what was planned, what arrived*.
The Dues tab remains where a coach manages schedules, sees credit arithmetic and chases families.

## What changes on the report itself — approve this knowingly

Today the report says families still owe **$8,233.30** in dues. That figure is wrong, and a coach
acting on it would chase money nobody is going to be asked for: **$2,349.63 of it has already been
covered by credits from somewhere other than the family**. A family billed $970.83 with $900 credited owes $70.83, and the
report reads them as $970.83 short.

So the planned dues figure becomes **what families are actually asked to send**, with a note on each
row saying what covered the rest. The consequence is visible on the face of the report:

| | today | after |
|---|---|---|
| Player dues, planned | $11,308.30 | **$8,958.67** |
| Dues shortfall | −$8,233.30 | **−$5,883.67** |
| Total revenue | $13,258.30 | **$10,908.67** |

The new numbers are the true ones — the fundraising that produced those credits is already counted
in its own row, so the old figure expected the same money twice. But **Total revenue is a number the
owner has looked at many times, and it should not move under him by accident.** This ships as its
own change, before the fold, so the movement is visible as one thing.

## A correction worth recording

The first version of this plan claimed $850 of dues money belonged to no player, and proposed a row
to absorb it. **That was wrong.** It was inferred from two totals disagreeing rather than read from
the records. Every dues payment carries a player; the $850 was **overpayment** — two families sent
more than they were billed, and the Dues tab hides that by capping its Paid column at the amount
billed.

The owner caught it by asking for a circumstance that would justify the row. There wasn't one. The
design is simpler as a result: no absorbing row, no new concept.

It did surface a real question: **the report counts what arrived, the Dues tab caps at what was
billed, and this feature puts the two one click apart.** Recommending the report keeps counting what
arrived and the Dues tab stops capping — the second half being a change on another screen that needs
its own approval.

## Priority

**Medium for the fold. HIGHER for the credit netting**, which is not a feature — the report
overstates what families owe by $2,349.63 today, and a coach chasing that figure is chasing money
nobody will be asked for. The fold itself is not blocking the §146 walk, and is worth doing while
the money surfaces are fresh and all three reports share one recipe.

## Success criteria

- A coach can answer *"which families are behind, and by how much?"* without leaving the report.
- The rows inside the fold **add up to the dues row above them**, on every basis and every view.
- The report is no harder to read for a coach who never opens the fold.
- Nobody sees a family's dues detail who cannot already see it on the Dues tab.

## Where this stands, 2026-09-07 — step 1 shipped, step 2 has been deleted

**Step 1 shipped and passed its walk 28/28.** On Player Dues, a family's own money now sits in
**Paid** and **Credits** means money from someone else. The dues ladder followed it, so the screen
reads left to right: **Dues · Fundraising · Other credits · Paid · Handed back**.

**Step 2 — netting outside money off each family's planned dues — is not being built.**

It was meant to fix a real complaint: a family whose dues are mostly covered by other people's money
reads as badly behind. Kai is billed $970.83, owes $70.83, and the report showed the full $970.83
against them with nothing arriving.

Two things came out of working through it. First, netting the plan would have moved the season's
headline figure by $2,349.63 — from ($341.70) to ($2,691.33) — with nothing having happened in the
real world. Second, and more important, **a live reporting defect turned up underneath it**: when a
family pays a team bill out of their own pocket, the report counts the cost and forgets that the
family just settled part of their dues. The season reads $1,379.98 worse than it is.

Fixing that defect fixes Kai's row too — from the *actual* side, with every budget figure left
alone. So there is nothing left to net, and step 2 disappears rather than being built and argued
about. That work is now its own project:
`COACH_MONEY_CREDITS_AND_PAYBACKS_PLAN.md` + `_PM_BRIEF.md`.

**The fold itself is unaffected and still wanted.** Opening Player dues into one row per family is
the whole point of this project and none of the above touches it — it just needs to open onto
figures that are already right, so it follows the credits work rather than leading it.

**Decision mockup, with the math on the real fixture:**
https://claude.ai/code/artifact/0f08e331-7dda-456a-9836-c608f8a72eae
