# Fee invoice alerts — product manager brief

Plan: `FEE_INVOICE_ALERTS_PLAN.md`. Drawings: https://claude.ai/artifact/4dmPojUsg4EspaphPVxSEc

## What changes for a club owner

- **Plan & billing shows an invoice, not a pile of fees.** One row for the invoice: its number, when it is due, the total (tax included)
  and a single "Pay invoice" button. The fees it covers sit underneath, with the tax as its own line, so the numbers add up.
  Paid invoices fold away.
- **The owner is told when they owe something.** A small count on the "Plan & billing" door in the menu (and on "More" on a phone):
  amber while an invoice is open, red once it is overdue. While an invoice is open and not yet due, one line at the top of Plan &
  billing says so. Nothing appears anywhere else.
- **When an invoice is overdue,** a banner on every admin page names the invoice, the amount and how late it is, with a Pay button.
  It cannot be dismissed and goes away when the invoice is paid. It scrolls with the page, so it never costs a phone screen.
- **A failed plan payment gets the same treatment:** the count on the door, and the red line on Plan & billing gains a button.
- **Only the owner sees any of it,** because only the owner can pay. Other admins see nothing new.
- **Also shipped now:** a billing address typed all in lower case or all in capitals is tidied ("123 fake st" becomes "123 Fake St").
  Anything with mixed capitals is left exactly as typed.

## Why it matters

Today an owner learns about a fee invoice from an email and a list on a page they may never open, and the page shows "Pay the invoice"
beside a $1.25 line when the invoice is really $4.24. Fee invoices never suspend a club, so a visible, honest signal in the app is the
only lever there is. It stays quiet until money is due and loud only when it is late.

## Customer impact

Fewer unpaid fee invoices and fewer "what is this charge" questions; the owner can see and pay in one place. Little added noise: nothing
shows for a club that owes nothing, and an invoice that is merely open costs one pill and one line.

## Priority

Medium. Not blocking a launch; it fixes a real gap in a feature that already bills clubs, and the confusing "pay" button is live on the dev site.

## Success criteria

- An owner with an open fee invoice sees the pill and the line, and nothing on other pages.
- The same owner, once it is past due, sees the red pill and the banner on every admin page, and the banner disappears the day it is paid.
- The invoice row's total equals the fee lines plus tax, and matches what Stripe will charge.
- A club with nothing owed sees no change at all. A non-owner admin sees no change at all.
- On a phone every button is 44 px tall and the banner is one row.

## Still to decide

Where the banner sits on a desktop (above the rail, as drawn, or at the top of the page beside the rail, which is simpler and looks the
same once you scroll), whether a cancelled club also sees it, and the exact words (going to `/marketing`).
