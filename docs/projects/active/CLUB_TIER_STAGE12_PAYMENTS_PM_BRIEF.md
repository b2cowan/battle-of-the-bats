# Families pay online — Club Tier Stage 12 (PM brief)

> Drawn 2026-10-24; every ask ruled as recommended 2026-10-25. Plan: `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md`. Drawings: the Club Payments Drawings artifact.

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
3. **12b · House league.** Pay now appears on the sign-up confirmation, the status page, and the acceptance and
   waitlist emails. Convenors see "paid online" beside "paid by hand". Ending a registration refunds the card.
4. **12c · Tournaments.** Once the organizer accepts a team, it pays its deposit or full entry from the acceptance
   email, and pays the balance from the reminder email.
5. **12d · Hardening.** Disputes, matching payouts to the bank, the tax display, and help articles.

## Who sees what

- **Owner:** connects payouts, chooses who pays the processing fee, and writes the refund policy.
- **Treasurer:** sees whether payouts are working and gets an alert if Stripe needs something; can refund to a card.
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
