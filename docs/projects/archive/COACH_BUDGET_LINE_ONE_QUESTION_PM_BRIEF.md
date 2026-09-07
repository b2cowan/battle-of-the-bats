# PM brief — A budget line asks one question, not two

**Plan:** `COACH_BUDGET_LINE_ONE_QUESTION_PLAN.md` · **Raised:** owner, 2026-09-07 · **Status:** ✅ built 2026-09-07

## What a coach does differently

Adding a line to the season budget currently asks two questions. First *"This line is…"* — Expense,
Expected fundraising, Expected sponsorship, or Expected other income. Then *"Category & Item"* — a
searchable list of everything.

After this change there is **one** question — *is this money going out, or coming in?* — and then the
category and item. The product works out the rest.

## Why it matters

**The two questions can disagree with each other, and the form lets them.** A coach can pick
*Expected sponsorship* and then *Tournaments → Concession revenue*, which is nonsense on its face.

It is also worse than nonsense. That first answer quietly decides **where the row's actual figure
comes from** — a sponsorship line takes its numbers from sponsor cheques automatically, and refuses
a figure the coach types, so the same money is never counted twice. So a coach who makes that pairing
ends up with a budget line **they can never record their concession takings against**, and nothing on
screen tells them why.

**And nobody has ever needed the second question.** Across every money-in budget line in the
database, all of them already use the obvious pairing — fundraising with a fundraising drive,
sponsorship with team sponsorship, other income with interest. The question has never carried
information. It has only carried the chance to get it wrong.

## What it is not

It is not removing the distinction between money a drive reports, money a sponsor reports, and money
a coach types in. **That distinction is load-bearing** — player rebates and the report's income
figures depend on it, and an earlier ruling kept it deliberately. This change keeps it and simply
stops asking the coach about it: the item they pick already knows.

No figure on any screen changes. No existing budget line needs re-filing.

## The thing it surfaced, and what we decided

⚠ Answered on the day it was built: **a grant is sponsorship.** It keeps its Fundraising shelf on
the report — moving that is a separate, smaller call — but its actual now comes from sponsor
cheques, which is what the product's own words have always said it is.


**"Grant" is filed under Fundraising, but the product's own description of sponsorship says a grant
is a sponsorship** — *"a business sponsor, a grant, anything given directly rather than raised by
selling."*

Today a coach budgeting a grant has to choose which way to be wrong: file it as fundraising and its
actual gets looked for in bottle-drive receipts, or file it as sponsorship and it reads as
fundraising on the report. Once the item decides, the contradiction can't be passed to the coach any
more. **Recommendation: a grant is sponsorship** — it arrives as a cheque and the sponsor machinery
already models exactly that.

## Priority and sequencing

**Independent.** Nothing in the coach-money credits work depends on this, and it depends on nothing
there. It can be built whenever, by whoever, without waiting.

## Success criteria

- One question where there were two, and the impossible pairing can no longer be created.
- Every figure on the plan, the ladder, the month grid and both report shapes is unchanged.
- Every existing budget line opens and saves unchanged.
- A category or item a coach invents themselves works, and its actuals are theirs to record.
