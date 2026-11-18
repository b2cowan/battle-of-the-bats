# PM brief — Stripe charges the club for processing; we keep only our margin

**Plan:** [STRIPE_OWNED_PRICING_PLAN.md](STRIPE_OWNED_PRICING_PLAN.md) · **Part of:** Families pay online · **Priority:**
before online payments switch on (production has no club payment accounts yet, so it is cheapest now).

## What changes
Today FieldLogicHQ pays Stripe out of our 3.5% + $1.50 fee, pays Stripe's payout and account charges, and bills each club
monthly for disputes, returned debits and foreign cards. After this, Stripe takes its own processing fee (and those extras)
straight from the club's Stripe balance, and we take only our margin.

## Why it matters
- **We stop losing money on large card payments.** With the GST/HST included in our fee (owner ruling, 2026-11-17), a
  $1,000 card payment in Ontario nets us about −$0.56 today; under this model about +$5.43 (estimates; the trial confirms).
- **No "you owe us more" bills.** The monthly Stripe-fee invoice, its reminders and overdue banner go away.
- **Less for us to run.** No fee invoices to chase, no tax on recovered costs, simpler books.

## Customer impact
- **Families:** nothing changes if we keep the same fee number at checkout.
- **Clubs:** Stripe's fees come out of their payouts automatically; their books show Stripe's fee on each payment. A rare
  foreign card or currency conversion lowers what reaches them slightly, instead of arriving later as our invoice.

## Success criteria
- A test-mode trial shows Stripe charges the club's account, not ours, for processing, disputes and debits, and our margin
  arrives as our fee.
- Card payments are profitable at every size after the tax.
- No club ever receives a Stripe-fee invoice from us.
- The club's books match its Stripe payouts, including Stripe's fee.

## Phases
1. Prove it in test mode and settle the pricing (no product code). **Done 2026-11-17.**
2. New club accounts and our margin-only fee. **Built 2026-11-18.** Families see the same fee; on a $100 card payment we
   now take $1.65 and Stripe takes $3.35 from the club, which still nets $100. Each payment keeps what we took (the only
   record our tax return can use). The club's Payouts card and set-up window now say Stripe's extras (a foreign card, a
   currency conversion, a dispute, a returned debit) come out of its Stripe balance, with no invoice from us. The three
   dev test clubs' old accounts take no new payments and are re-created through "Set up payouts again"; UAT Rep Club only
   after the payout test's payout steps (owner, 2026-11-18).
3. The club's books record Stripe's fee. **Code built on dev 2026-11-18** (owner rulings that day: fix only what is off;
   dispute fees booked; Stripe's later fees matched to their payment once a day). Canadian card and bank payments read
   exactly as before: Stripe's fee matched our figure to the cent in every test. What now reaches the books, as costs
   under Payment processing: a foreign card's extra ("Stripe’s extra", about 0.8%), a dispute's fee ($15 card, $5 debit),
   Stripe's later $5 for a debit that bounces before it clears and $15 for answering a dispute, and, when families pay the
   fee, the fee Stripe takes back on a lost dispute. The bank check's "on its way" now meets the payout on these. Old dev
   accounts are untouched. Found on the way: a debit returned after it clears is a dispute at Stripe and our fee stays
   with us, so the payments terms narrow (owner, 2026-11-18). Still to do: the help and words, the terms sentence, the
   reviews, then the owner walk.
4. Retire the monthly Stripe-fee invoicing. **Built on dev 2026-11-18** (before Stage 3, owner). A club no longer gets a
   Stripe-fee invoice or its reminder, and Plan & billing loses its Stripe fees list, the "you owe" line and the red banner
   (its menu pill keeps "Plan payment didn't go through"). Platform admin loses the fee card, its Retry and the two Health
   rows; Delete waits only for open disputes and clearing debits. The billing address stays required before payouts (owner
   call a: the tax inside our fee needs the province). The two fee tables are dropped (owner call b; production after this
   code ships); Bookkeeping keeps its "Fees billed back to clubs" row for history (owner call c). Dev's one open October
   test invoice was voided in Stripe. Reviews: /accounting nothing to fix; /legal: the privacy policy still names the fee
   invoice, acceptable while payments are off, fixed in Stage 5's new version.
5. Words, help, terms; owner walk. Then the tax on our fee (GST/HST Stage 5) builds on the final shape. **Done
   2026-11-18 except what waits for Stage 3** (the help about the club's books, then the owner walk and the close). The
   payments terms are rewritten as v0.2: the processing fee is Stripe's part plus ours; Stripe charges the club directly
   for its fee and its extras (disputes, returned debits, foreign cards, conversion) and can change them; neither part
   comes back on a refund or a lost dispute, our fee comes back on a returned bank debit; a negative balance is the club's to cover; we bill
   nothing else. **v0.2 was approved by the owner 2026-11-18** and stays unpublished until the switch-on dependencies are
   met. The next privacy policy is drafted without the retired fee invoice, to publish with the terms. "Before you set up
   payouts" gains one line (Stripe's own terms and prices; a negative balance is the club's), and the help says the same.
