# PM Brief — Fundraising credits, money out, and the refund sheet

**Status:** approved from mockups 2026-08-14 · not built
**Plan:** [COACH_SEASON_REFUND_REVAMP_PLAN.md](COACH_SEASON_REFUND_REVAMP_PLAN.md)
**Binding mockups:** `claude.ai/code/artifact/eae663d0-56e5-46e9-a2e2-9f7220468be2`
(source `COACH_CREDIT_APPLICATION_MOCKUP.html`)

---

## What we're building, in one sentence

Money the team owes a family stops being a number in a balance column and becomes something the
product can actually settle — by lowering that family's remaining bills, by paying them out in
cash, or by handing it back at season's end from a sheet that shows its own arithmetic.

## Why it matters

Three real problems, one root cause. Today a credit (a fundraising rebate, an overpayment, a
coach's contribution) only ever reduces a *total*. No bill knows about it.

1. **Families are asked for money they've already earned.** A player raises $1,000, earns a $500
   rebate, and still gets a reminder for the full $800 installment. The balance column was right;
   the bill the family actually pays was not.
2. **The team can't hand money back.** There is no way to record paying a family — not a rebate in
   cash, not a season-end refund. The books have an inbox and no outbox.
3. **The season-end refund was guesswork on top of a typed number.** The coach typed a pot figure
   nothing checked, and the sheet paid out every credit whether or not it had already done its
   work — so a family whose rebate had already lowered their dues could be refunded it a second
   time.

## What a coach sees differently

**During the season**

- A fundraising rebate lands on the player's remaining installments — **last bill first** by
  default — so the amount their family is asked to send drops as soon as the money is earned. The
  bill still reads $800; underneath it says "$500 covered by fundraising · $300 to send."
- Reminder emails quote what's genuinely left and say why it dropped: *"Riley's fundraising has
  earned $500 toward dues — thank you."* A fully covered bill is never chased at all.
- A team that would rather keep dues and fundraising completely separate can say so — one setting,
  three choices: reduce the **last** payment first, the **next** payment first, or **don't** and
  settle everything at season's end.
- The coach can **pay a family out in cash** at any time instead. Recording it puts the money out
  in the team's books and puts that family's bills back up — no silent double benefit.
- An expense can be marked **paid by a family out of pocket** (the parent who bought the pizza).
  The cost still counts in the budget, no team cash moves, and the family is owed the money back
  on exactly the same footing as a fundraising rebate.

**At season's end**

- The Calculate button and the typed pot are gone. In their place, a section at the foot of Player
  Dues that always shows **what the team owes each family**, working from the books:
  money in, money out, cash held, owed to families, surplus to share.
- Each family's refund is their **own money owed back** plus an **even share** of the surplus. A
  row opens to show where its number came from. Every row is payable from that screen, and
  siblings are paid once.
- Because it's derived, it's honest all year — a family holding an unapplied rebate in October is
  shown as owed in October, not just in April.

## The decisions behind it (owner-ruled, 2026-08-13/14)

| Decision | Ruling |
|---|---|
| Does a credit lower a bill, or rewrite it? | **Cover it** — the bill keeps its face amount, the credit is shown paying it down |
| Which bill first? | **Last first** by default; team-wide setting offers next-first or keep-separate |
| Do all credit kinds behave alike? | **Yes** — fundraising, contribution, reimbursement |
| Do families hear why their bill dropped? | **Yes**, named in the reminder |
| Is a parent's out-of-pocket cost a credit? | **Yes** — same mechanism, no parallel system |
| Does money-out ride with this? | **Yes** — the refund is just the bulk version of it |
| Does a family that still owes get a share? | **Yes, and their debt counts as money coming in** — the pot grows by it, every share rises, and their share cancels most of what they owe |
| Who's in the even split? | Owed-back follows **whoever earned it**; the even share goes to the **season's-end roster**. Anyone left out raises everyone else's share |
| What if the team can't cover what it owes? | **Say so plainly. Share nothing. Never silently pro-rate** a family's earned rebate |
| Forgiving a balance / setting an amount by hand | Both offered — a settled amount **counts as that family's share, already received**; whatever's left splits among the rest |

## Customer impact

- **Families** stop being chased for money they've already raised, and finally get told what their
  fundraising did. This is the single most visible fairness fix in the money product — reminders
  are the only dues figure a family ever sees.
- **Coaches and treasurers** get an outbox: rebates paid in cash, parents reimbursed, refunds
  issued, all in the team's books with dates and methods.
- **Clubs** get a season-end number they can defend to a parent, because it shows its work.

## Priority

High. It closes the last open thread of the payment-record project, and the refund screen is
currently capable of promising money that doesn't exist — the one place in the coach product where
wrong arithmetic reaches a family's wallet.

## Success criteria

1. A family with an unapplied rebate is never asked for the gross amount in any reminder.
2. Every dollar of credit is in exactly one state — applied to a bill, paid out, or owed back —
   and the three always sum to the credits issued.
3. The refund sheet's rows always add up to the derived pot, to the cent, with no typed input.
4. Recording a payout puts bills back up; removing one puts them back down. Nothing is stamped,
   everything re-derives.
5. A coach can settle a season without a spreadsheet, and can explain any single number on the
   sheet by opening one row.

## Deliberately out of scope

Org-level allocations and payment requests (different money domain, no payment record), the free
Basic coach fee ledger, and anything in an archived season — refunds move money, so nothing here
opens in a finished season.
