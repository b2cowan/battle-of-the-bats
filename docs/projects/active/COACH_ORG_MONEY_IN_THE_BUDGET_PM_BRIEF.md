# PM brief — Club money belongs in the team's plan

**Plan:** `COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md` · **Status:** ⚙ **BUILT ON DEV 2026-08-30
(migration 271) — owner walk owed (ledger §126)**; approved 2026-08-15, re-validated 2026-08-28,
all five decisions ratified 2026-08-30 · **Priority:** high — it was a report quietly misreading
club contributions

## What a coach gets, now it is built

**One new question, asked once.** Making a request *from* the club now asks **"New money, or money
back?"** before anything else — a grant, or the club paying you back. It is required, so nothing is
ever assumed on your behalf, and it decides which list of your own words you file it under: your
income words for new money, your spending words for a repayment.

**The report finally tells the two apart.** A grant becomes its own revenue row under the name you
gave it, with a dash where a budget would be — nothing is added to your plan, the row appears
because the money did. A repayment behaves exactly as it always has: it comes off the cost it
repaid. The season's bottom line is the same either way; what changes is which line is honest.
Measured on our QA team: answering "new money" on a $325 arrival moves it out of a cost line and
into revenue with the season net unchanged to the cent.

**You can change your mind, even after the club has answered.** Every request row now says what it
is and what it files under, with **File it** or **Change** beside it. The record itself stays
locked — it is what the club acted on — but your own label never does. Changing it moves no money.

**Two numbers that disagreed became one.** The Money hub's budget card was blind to club money and
to refunds; the report one click away was not. On our QA team they read $1,980 and $1,555. They now
both read $1,555, and the card says what it counts whenever there is a difference to explain.

**The forward view stopped under-quoting.** Unpaid instalments of your club's bill now appear in
the month they fall due, alongside your own bills — $1,570 on our QA team that the Scheduled column
simply did not show, while the payment schedule beside it did.

**Nothing here touches anyone's dues.** Neither answer, ever.

### What is not done yet

Migration 271 is on **dev only** — it rides the release queue behind four other owed migrations, so
none of this is on production until the next promote. The owner's walk is still owed.

## Where this stands after re-validation

When this was approved, club money appeared nowhere in the budget report. Since then the Club tab
merge shipped the connection: club bills and requests can be filed under the team's own budget
words, and Budget vs. Actual now counts every settled dollar of club money. The original complaint
is half fixed by other hands. Three real gaps remain, and one of them is a design being silently
decided against the owner's ruling.

## The problem left, in one sentence

When the club sends a team money, the product **decides for the coach** that it was a repayment —
so a genuine club grant disappears into a cost line it was never about, and the fact the club
contributed at all is invisible on the report.

## Why it matters

A grant and a repayment arrive as the same transaction and mean opposite things. Read a repaid
permit as a grant and next season plans off an inflated cost line; read a grant as a repayment and
the club's contribution vanishes. Only the coach knows which one happened — that was the owner's
ruling in August, and the product as shipped answers the question itself instead of asking.

On our QA team today: the club has billed $2,120 and sent $325 back. The report reads that $325 as
a repayment with no one ever being asked. Meanwhile the Money hub's budget card says there is
**$1,980** of headroom while the report itself says **$1,555** — two answers to "can we afford
this?" one click apart, because the hub card still ignores club money entirely.

## What changes for the coach

- **One new question, asked at the right moment.** When a coach asks the club for money, the form
  asks: **new money, or money back?** Money back keeps exactly today's behavior — it shrinks the
  cost it repaid. New money becomes its own revenue row on the report, with a dash in the Budget
  column when nothing was planned — the same way an unplanned cost already shows.
- **The answer stays correctable.** Even after the club approves, the coach can change what it was
  filed as — re-filing moves no money, ever. (The request itself still locks once the club has
  acted on it.)
- **The headroom card stops lying** — it adopts the report's arithmetic, so the hub and the report
  agree about club money.
- **The forward view tells the whole truth** — unpaid club installments join the "Scheduled"
  column of the month grid, quoting what's still owed, matching the Payment schedule beside it.
- **Neither choice moves anybody's dues.** Standing rule, unchanged: extra money arriving never
  quietly lowers what families pay.

## What deliberately does *not* change

- Everything that already shipped: the Club tab, filing bills under the team's own words, unfiled
  money counting under "Not itemized", pending requests showing as "Asked of the club" in the
  forward view, the season-close rule about unanswered requests.
- Old records are never re-read: everything the club sent before this ships keeps the reading it
  reports under today until a coach deliberately changes it. No report restates itself overnight.
- The club still controls what it bills; the coach still only labels their own side of it.

## Decisions the owner is being asked to walk (see plan §7)

1. **Confirm the ruling stands**: build the ask, or deliberately re-rule that club money in is
   always settlement (the shipped behavior). The plan recommends building the ask.
2. **Named "Club costs / Club funding" report rows, or the generic "Not itemized" bucket that
   shipped?** The plan recommends keeping the shipped bucket; the mockups draw both.
3. Confirm the classification staying editable after approval squares with the "locked once
   answered" rule.
4. Confirm the month grid's wording for new club money.
5. Whether the headroom-card fix ships in this build (recommended) or on its own.

## Success criteria

1. A coach can record a club grant as new money and a club repayment as money back, and the report
   tells each story correctly — and neither moves a family's dues.
2. The hub's budget card and the report agree about club money on a club-run team.
3. Every dollar the club has billed appears on Budget vs. Actual or its Scheduled column without
   the coach doing anything first.

## Risks

- **Changing a shipped reading.** The product already reports club arrivals one way; the fix must
  not restate existing seasons (old records keep their reading — only new ones are asked).
- **Double counting** — an arrival read as both funding and a repayment would make a season look
  twice as healthy. The ask is strictly either/or, as it is today by construction.
- **Help and demo drift** — the in-app guide currently teaches the shipped behavior as the design,
  and the coach demo's club money is unfiled and unnarrated. Both are in-scope work for the build,
  not follow-ups.
