# Families pay online — Club Tier Stage 12 (PM brief)

> Drawn 2026-10-24; every ask ruled as recommended 2026-10-25. Plan: `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md`. Drawings: the Club Payments Drawings artifact.
>
> **2026-10-25 · switching to Stripe's current account setup.** The first test of 12a stopped at "Set up payouts".
> Stripe no longer creates club accounts the way 12a was built, and it refuses that method for new platforms. The owner
> chose to rebuild on Stripe's current method rather than switch the old one back on. A sandbox test confirmed that the
> new method works for a Canadian club and keeps every decision as made: the simple Stripe dashboard, FieldLogicHQ
> paying the processing fee, Stripe covering losses, and Stripe doing identity checks. Clubs and families see nothing
> different. Only the behind-the-scenes connection changes. Rebuild brief: `CLUB_TIER_STAGE12A_V2_REWORK_PROMPT.md`.
>
> **2026-10-25 · rebuilt.** Set up payouts now opens Stripe's sign-up. The card's five states mean exactly what they
> did. Stripe now sends news about a club's account on its own channel, so testing needs two Stripe listen windows
> locally and two webhook destinations on staging (the setup guide has the lines). The 12a test walk is next.

## What this is

Today, clubs collect fees by e-Transfer, cheque or cash, and a volunteer marks each one paid by hand. Stage 12 lets a
family pay on their phone the moment their child is accepted, and lets a tournament team pay its entry once the
organizer accepts it. The money goes straight to the club's own bank account. By default the family pays the processing fee, so the club
receives every fee in full; a club can choose to pay the fee itself instead. The payment appears in the club's books without anyone typing it.

## What we found

- **Money is recorded four different ways today**, one per program. Online payment has to land in the same place each
  program already records a payment by hand, or the books will disagree with themselves.
- **House league records the least.** Its "paid" tick has no amount, date or payment method, so there is nowhere yet to
  write "paid online by card". Stage 9 already plans to fix this, and Stage 12 depends on it.
- **The settings page is the owner's alone**, and Tournament Plus organizations can't reach it at all, so we have to
  decide who connects payouts and where.

## What changes

1. **12a · Connect payouts.** One card on the settings page: set up, setting up, taking payments, needs attention, or
   disconnected. Setup happens on Stripe's own secure pages. Until a club is taking payments, families see exactly what
   they see today.
2. **One checkout for everything.** Every program uses the same pay block. Card is the main button and bank debit sits
   beside it, and each shows its fee and total before paying. Stripe's own secure page takes the payment, then a receipt
   arrives in the club's name. Paying by e-Transfer is still offered underneath.
3. **12b · House league — built 2026-10-25, walk owed.** Pay now appears on the sign-up confirmation, the status page,
   and the sign-up, approval and waitlist emails; brothers and sisters pay in one checkout, and the pay link opens the
   family's page without a password. Convenors see "Online, card" beside "by hand", email the pay link, and refund to
   the card from the ending or the price correction, all of it or part. Part-refunds for tournament teams come in 12c.
4. **Tournaments, built with 12a** (moved forward 2026-10-25 so 12a can be tried end to end). Once the organizer
   accepts a team, it pays its deposit or full entry by card from the acceptance email, and pays the balance from the
   reminder email.
5. **12c · Bank debit,** for house league and tournaments at once.
   **Built 2026-10-26, two walks owed (ledger §389 refunds, §390 bank debit).** What a person sees now: a **family**
   can pay by bank debit as well as by card once the club's Stripe account is approved for it. The debit takes days to
   clear, the child's spot is held meanwhile, and the family can't pay twice. If the bank sends it back, the family is
   emailed a way to pay. The **registrar** sees "clearing" on the row, and a fourth figure, Clearing, on the Money band.
   Mark received and the pay-link email stay away until the debit clears. Declining a child while a debit clears asks one
   question: send it back or keep it when it clears. A debit the bank reverses after it cleared comes off the book beside its
   receipt and raises an item that clears itself. A **tournament organizer** gets the same for a team, and can refund part
   of a team's card payment: the entry is lowered by that amount everywhere it is read. The **treasurer** reads all of it
   and gets no refund or collection button. **Every refund can be seen:** on the row, in the record with Stripe's
   reference, and in a refund email to the family. A refund made in Stripe's own dashboard records itself. The family's
   record shows "Paid online · card (or bank debit) · receipt", and "View the payment" opens the registration at its fee.
   Each returned or reversed debit costs the club $5, billed on its next FieldLogicHQ invoice; a free or comped club is
   not billed. Success: a walk where every debit state reads right without a phone call.
6. **12d · Hardening.** Disputes, matching payouts to the bank, the tax display, and help articles.

## Who sees what

- **Owner:** connects payouts, chooses who pays the processing fee, and writes the refund policy.
- **Treasurer:** sees whether payouts are working and gets an alert if Stripe needs something. Logs the accounting; does
  not refund (owner, 2026-10-26).
- **Convenor / registrar:** sees each payment's status and refunds from the window they already use.
- **Families and team contacts:** see Pay now only when the club is taking payments; nothing looks broken otherwise.

## Why it matters

Chasing payments is the volunteer job clubs complain about most, and every payment marked by hand is a chance for the
books to drift. Online payment also earns us a small fee on each payment, at no cost to the club.

## Priority and dependencies

Stage 12 is inside the Club release. 12b needs Stage 9's money work (9b-2) built first. **No live charge happens before
counsel signs off.** Building and test mode are not gated.

## Success criteria

- When families pay the fee, the club receives the full fee on every online payment.
- Every online payment shows in the club's books with nobody typing it, beside the cash ones.
- A refund works from the screen where the registration ends.
- Marking a payment received by hand still works.
- A family never sees a dead Pay button.
- Counsel's sign-off is recorded before the first live charge.
