# PM Brief — Budget Plan: one clear total, fundraising in the plan, months across

**Status:** approved from mockup 2026-08-12, not yet built
**Plan:** `COACH_BUDGET_TOTALS_FUNDING_PLAN.md` · **Mockup:**
https://claude.ai/code/artifact/30812492-368e-4d2a-93e8-e78601ad5d17
**Who it affects:** every coach on a paid team who plans a season budget (and the assistant coaches
they've given money access to). Read-only money assistants see all of it and can change none of it.

---

## What a coach sees differently

**The top of the page stops being a row of tiles and becomes a short calculation.** Today five tiles
sit side by side — Total Planned Budget, Season Total, a buffer, Per Player, Roster Size — each needing
a caption to explain how it relates to the one beside it, and the headline number is quietly whichever
of the two totals is larger. After this it reads downward, the way the coach would work it out on
paper:

> Line items **$8,000** · plus the $2,000 of your estimate you haven't itemized · **Total planned
> budget $10,000** · less expected funding **−$4,000** · **$600 per player**, $6,000 ÷ 10 on the roster.

Rows that don't apply don't appear. A team with no estimate and no fundraising sees three lines.

**"Season Total" becomes "Estimated total", and it says what it's for.** It's optional, it's set and
cleared in one place, and the gap between it and the real lines is shown as its own row — positive
while the coach still has budget to allocate, red when their lines have outgrown it. Nothing is
blocked and, unlike today, nothing typed is silently ignored.

**Fundraising and sponsorship can be budgeted, and they lower dues.** A coach can add a line for money
coming *in* — "Fundraising (estimated) $3,000", "Sponsorship — Rink Auto $1,000" — and the page tells
them what players actually need to cover. On an $8,000 season with $4,000 of expected funding, per
player drops from $800 to $400, and the installment generator proposes the lower figure. This is the
headline customer benefit: it's how coaches actually budget, and today the product forces them to
either charge the full amount or do the subtraction in their head.

**The plan gets month and quarter columns.** A `List / By period` toggle above the plan, using the
period splits coaches already enter on each line. Lines with no dates gather in an "Unscheduled" column
rather than vanishing.

**One duplicate link removed** from the foot of the page.

## Why it matters

- A budget screen that shows two totals and explains neither is a trust problem on the one page where
  a coach is deciding what to charge families.
- Fundraising is the main reason a team's dues aren't simply "costs ÷ players". Not being able to
  express it is the gap between our budget tool and the spreadsheet it replaces.
- The month view already existed but was on another tab mixed with actuals — so coaches concluded it
  wasn't there. Same capability, put where the job is.

## Trade-offs made deliberately

- **When a coach's lines run over their estimate, dues follow the estimate** — the number they set is
  the number that counts. The red row is what stops that being a silent shortfall, and the installment
  generator repeats it. The alternative (always follow the higher figure) was considered and rejected
  as reintroducing the ambiguity we're removing.
- **Expected funding is one estimated total, not a link to each campaign.** Simpler to enter, and a
  campaign doesn't have to exist before a coach can budget for it. In Budget vs. Actual it's compared
  against the team's share of what was actually raised — money rebated back to the player who raised it
  isn't team funding, it's a change in where that player's own contribution came from, and counting it
  would lower the same dues twice.
- **The un-itemized difference is calculated, never typed.** It can't drift out of step with the
  estimate, can't be deleted by accident, and shrinks on its own as lines are added.

## Success criteria

1. A coach can state a season estimate, itemize against it, and at no point see two numbers whose
   relationship isn't on screen.
2. A coach who expects $4,000 of fundraising can generate dues for the net amount without doing
   arithmetic themselves.
3. Budget vs. Actual answers "did our fundraising hit the number we budgeted?" for the first time.
4. A coach looking for their budget by month finds it on the budget page.
5. No existing team's numbers change without the change being visible and explained on screen.

## Priority

**High** for the fundraising piece — it's a functional gap, not a polish item, and it's the reason a
coach keeps a parallel spreadsheet. **Medium** for the totals rework (a clarity fix on a screen owners
have already reported confusion on) and the period columns (a capability re-homed, not a new one).

## Testing notes for the owner

Reachable at Coaches → Money → Budget Plan. Worth walking: a brand-new team (three-line ladder), a team
with an estimate above its lines, a team with an estimate *below* its lines (the red row), a team with
funding lines (per player halves), then Budget vs. Actual to see funding measured against the team's
share. Then the List / By period toggle in both Months and Quarters, including a line with no dates.
