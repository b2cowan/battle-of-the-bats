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
3. **12b · House league — built 2026-10-25, walked 2026-10-26 (every card step passed; the email steps wait for the one end-to-end test).** Pay now appears on the sign-up confirmation, the status page,
   and the sign-up, approval and waitlist emails; brothers and sisters pay in one checkout, and the pay link opens the
   family's page without a password. Convenors see "Online, card" beside "by hand", email the pay link, and refund to
   the card from the ending or the price correction, all of it or part. Part-refunds for tournament teams come in 12c.
4. **Tournaments, built with 12a** (moved forward 2026-10-25 so 12a can be tried end to end). Once the organizer
   accepts a team, it pays its deposit or full entry by card from the acceptance email, and pays the balance from the
   reminder email.
5. **12c · Bank debit,** for house league and tournaments at once. **Also (owner, 2026-10-26): a refund you can see.**
   A refunded child shows the amount, date, status and Stripe's reference on the registration, with the full detail in
   the window that opens from the row, so the club can tell a parent "we refunded you $X on Y, here is the reference".
   A refund made in Stripe's own dashboard is recorded without anyone typing it, and the family gets a refund email in
   the club's name (today two of the four ways a house-league refund happens send nothing). **Also in 12c (owner, 2026-10-26):** a family's record shows "Paid
   online · card · receipt", the registration's menu gets "View the payment", and a club can refund part of a tournament
   team's card payment. Before any of 12c is built, its screens are drawn and ruled by the owner first: the refund
   visibility, the tournament part-refund, and a re-check of the bank-debit drawings.
   **Refund visibility drawn 2026-10-26, asks open** (https://claude.ai/artifact/RsE8QFyhsi72wjoKqn9VJR). What changes,
   by person: the **registrar** reads every card refund on the child's row (the amount that went to the card, the date, and
   "pending" or an amber "didn't reach the card" when it isn't finished) and the full detail with a copyable Stripe
   reference in the child's record; a refund the card sent back no longer says "refunded". The **club admin** who
   refunds in Stripe's dashboard sees it recorded on the row and in the book within a minute, and is asked only "whose
   was it?" or "what now?" when the product can't tell. The **family** gets one refund email in the club's name for
   every refund, naming the card, the date and a reference, and none for a refund that didn't happen. Correction from
   the code: house-league families already get a refund sentence in the ending email and an email for a price
   correction; the two silent cases are the "couldn't go on this registration" refund and a refund made in Stripe.
   **Built 2026-10-26; both walks done 2026-10-26 (ledger §389 refunds 44 of 44, §390 bank debit 32 of 32; held steps wait for the Amplify dev pass).** What a person sees now: a **family**
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
   Each returned or reversed debit costs the club what Stripe charged for it (nothing when Stripe charges nothing), billed
   on its next FieldLogicHQ invoice, every club included (owner 2026-10-26 and 2026-10-27). Success: a walk where every debit state reads right without a phone call.
6. **12d · Hardening.** Disputes, matching payouts to the bank, the tax display, and help articles.
   **Drawn 2026-10-26, ruled 2026-10-26/27, worded 2026-10-27; built in two parts, 12d-1 then 12d-2**
   (https://claude.ai/artifact/WutBgX8o56jBWN2zXXvZvg). What changes, by person: a
   **registrar** sees a disputed card payment on the child's row and record (quietly, with who answers it), is told when a
   dispute is lost, and is warned before recording a payment while a family's pay page is open; a **club owner** is told
   and emailed when a dispute opens and before it's due, answers it in Stripe, sees who agreed to the payments terms, and is
   told what's still owing or clearing before disconnecting, downgrading, cancelling or asking to delete; a **treasurer**
   matches each Stripe payout on the bank statement to names and receipts in Accounting › Payouts; the **platform team**
   gets a read-only Online payments view per club and one list across clubs of disputes, failed Stripe messages and
   closed accounts. Found first: a tournament team can be charged twice today without anyone being told. **Decided:**
   no GST/HST on the fee for now. A comp covers the subscription only, so every Stripe fee a club's payments cause is
   billed to the club, free and comped clubs included: card disputes, a returned bank debit, and a card issued outside
   the club's country. A club without a subscription invoice gets its own invoice. The family is never charged more,
   and the terms will say these charges are possible. Success: no payment moves in Stripe that the club can't see and
   act on in the product, and no Stripe fee is left for FieldLogicHQ to absorb.
   **12d-1 built and committed 2026-10-27** (disputes, paid twice, every club pays its Stripe fees), with its help and two
   owner walks: paid twice (https://claude.ai/artifact/GmV1oKgXPb1RmVRNSeHw2i) and disputes and fees
   (https://claude.ai/artifact/RKnhTRAFymveVggrXCUTnG). The five follow-up rulings of 2026-10-27 are **built and
   committed (Part 5b)**: a cancelled club still sees its fee list, a returned debit is billed only what Stripe charged, a
   single pay-link email after a lost dispute asks first, a stranded fee moves to the club's own invoice, and a returned
   answering fee goes back against the invoice that charged it (taken off what is owed, or refunded to the card). The
   disputes walk gained their steps.
   **12d-2 built and committed 2026-10-27, so Stage 12's build is complete.** A treasurer matches each Stripe payout on
   the bank statement to the families and teams inside it in Accounting › Payouts (Find by the amount the bank shows,
   Export); a club without Accounting finds the same list on the owner's Payouts card. Leaving online payments never
   strands money or a family: Disconnect, a downgrade, a cancel and a deletion request each say what is still owed,
   open and clearing, close any pay page left open, and keep the Stripe account connected so refunds, disputes and
   payouts finish; a club moved to a plan without online payments keeps its refunds and its card ("Online payments
   off"), and a cancelled club's families can't start a new payment. An ending the owner didn't choose (free time
   running out, a failed subscription payment) is warned on the card, as an item and by email. The payments terms read
   out who agreed, when and to which version; when they change, the owner is told (notice, item, email, reminder),
   payments stay on, and the new terms are needed to set up again, reconnect or change who pays the fee; Agree appears
   only once the box is ticked. The platform team reads each club's online payments on a new tab, read only, and one
   Health list across clubs shows what needs a look. Left for later: counsel's terms text, and one held owner question
   (the "How to pay is empty" line on Disconnect).

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
