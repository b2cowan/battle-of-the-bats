# PM brief — The Register (money redesign, Phase 3)

**Plan:** [COACH_MONEY_REGISTER_P3_PLAN.md](COACH_MONEY_REGISTER_P3_PLAN.md) ·
umbrella [COACH_MONEY_TAB_REDESIGN_PLAN.md](COACH_MONEY_TAB_REDESIGN_PLAN.md) §4
**Priority:** high — it is the centre of the Money redesign, and it carries a live money fix.

## What a coach gets

**One dated book of the team's money, read like a bank app.** Today at the top, every dollar in date
order underneath, two amount columns (out and in), and a running balance beside each row. The last
row's balance is the team's cash — and now it genuinely is.

The book is not limited to what the coach typed on this screen. Dues arriving, fundraiser proceeds,
sponsor money, money handed back to families and everything settled with the club all appear on it,
each with a chip naming where it came from and a tap that takes them there to act. Nothing is
created here; it is a place to read.

A filter strip replaces the old sub-tabs: All, Expenses, Income, Refunds, from Dues, from
Fundraising, from Club — plus category/item and a **scheduled** switch. With scheduled on (the
default) the book runs past today into what is coming: bills due, dues installments, sponsor
pledges, club amounts. Those rows are drawn as projections, and money-out ones offer **Mark paid**.

**One name finally retires.** The arrivals list has been called "Money in" since it held income and
refunds together — a heading the screen's own help contradicted. The register separates them into
two filters, so the word is true of the rows under it and the old name goes.

## Why it matters

A coach doing a team's books has never been able to ask *"where did the money go, in order?"* The
answer was spread over four lists that each knew one kind of money, and the one figure that tried to
summarise it — **Cash on hand** — was quietly wrong.

**The fix inside this release:** money a coach recorded as arriving was not counted as cash at all.
Record $500 of sponsor income and the team's cash figure did not move; it showed up in the budget
report and nowhere else. The same gap meant the **end-of-season sheet understated the pot**, so
families were being offered smaller refunds than the team could actually pay. Both are corrected
here, from one definition, so the register's balance and every figure that quotes cash now agree.

**Club money gets a season.** Money the club approved for the team carried no season at all, so a
team in its second year was reading last year's club money into this year's cash. It now belongs to
the year it happened in — which also means club money can finally be counted in the end-of-season
sheet, instead of being excluded with an apology printed on the card.

## What changes for whom

- **Head coaches and assistants with money access** — the Transactions tab becomes the register.
  Everything they could do before they can still do; the two old lists are two filters now.
- **Assistants without money access** — unchanged; the tab is still unreachable.
- **Read-only money access** — reads the whole book, with no Add, no Mark paid, no pencil.
- **Every coach with a team** — Cash on hand may go **up** the first time they look, by whatever
  income and refunds they had recorded. This is a correction, not a new number.
- **Teams closing out a season** — refund amounts may rise. The sheet was under-counting.

## Tradeoffs taken

- **An out-of-pocket cost sits on the book but does not move the balance.** A family paid the vendor
  direct, so no team cash moved. The row carries a chip saying exactly that and the balance stands
  still beside it — the alternative was hiding a real expense from the book.
- **Fundraising rows are dated by when the coach recorded them**, because a fundraiser entry has no
  date of its own. Said on the row rather than guessed at.
- **A filtered book hides its balance column.** A running balance over some of the rows is a number
  that looks like cash and isn't.

## Success criteria

1. The balance on the last settled row **equals Cash on hand**, on a team carrying dues, fundraising
   and club money — proved on the screen, not in the code.
2. A coach can answer "what happened to our money, in order?" in one read, and reach the workspace
   behind any row in one tap.
3. Turning the scheduled overlay on answers "what's coming?" without the two halves ever being
   confusable.
4. No family's dues change, on any of it.
