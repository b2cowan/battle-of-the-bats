# Team Payments List — PM Brief

**Priority:** high for any club on Accounting (the ledger is wrong in a way the treasurer sees today); medium for everyone else.
**Plan:** `TEAM_PAYMENTS_LIST_PLAN.md` · **Drawing:** `TEAM_PAYMENTS_LIST_MOCKUP.html` (Claude Artifact).

## What an organizer sees after the change

In the Team window, the Payment section stops asking for two running totals. It shows what has been received, one row per payment with its
date, and what is still due. To record money, press **Record** next to the deposit or the balance (or **+ Record a different amount**), check
the amount and the date, and confirm. **Mark paid** still takes one tap. A mistaken payment is removed or corrected, one line at a time.

## Why it matters

- **The ledger becomes trustworthy.** One payment is one ledger line, dated the day the money arrived. Today a single typed deposit can make three
  lines, all dated "today".
- **It matches how people think.** You type what came in, not a sum you have to work out first.
- **Dashboard and ledger finally agree** on how much has been collected.
- **The coach sees a real "Paid · date".**
- **Nothing posts while you type.** Money is recorded when you press Record.

## Who is affected

- Tournament organizers and club treasurers (Teams window, check-in, bulk actions, imports, Record one payment).
- Coaches see the same amounts and a correct paid date; nothing else on their side changes.
- Every plan gets the list. Clubs without Accounting keep the payment history on the team and post nothing to a ledger. Plans that can only read
  payments see the list without Record buttons, as today.

## Trade-offs

- It is a bigger change than a quick fix because paid money is written in about nine places, and they all have to move together. The cheaper
  fix (hold the typed figures until ✓) would stop the three-line problem but not the missing dates or the two-totals confusion.
- Money already recorded appears as one undated **Earlier payment** per team. Totals do not change.
- Refunds are not part of this. Removing a payment is the only way down for now.

## Success looks like

- Recording one payment, however it is entered, produces exactly one ledger line with the date chosen.
- For every team, payments add up to the figure the team had before the change, and the dashboard's collected number equals the ledger's.
- No organizer needs to type a running total again.
- No change to anything a coach or family receives, other than a correct paid date.

## Decisions needed from the owner

1. How to show money already recorded: one undated Earlier payment per team (recommended).
2. Dates: any date up to today; a closed fiscal year is refused with a sentence (recommended).
3. Spreadsheet import: a higher figure adds a payment for the difference; a lower one is skipped (recommended).
4. Changing a recorded payment asks first (a Save change button) instead of saving as you type (recommended): a change re-posts a ledger line.
