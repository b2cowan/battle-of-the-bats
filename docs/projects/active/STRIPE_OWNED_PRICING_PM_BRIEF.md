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
1. Prove it in test mode and settle the pricing (no product code).
2. New club accounts and our margin-only fee.
3. The club's books record Stripe's fee.
4. Retire the monthly Stripe-fee invoicing.
5. Words, help, terms; owner walk. Then the tax on our fee (GST/HST Stage 5) builds on the final shape.
