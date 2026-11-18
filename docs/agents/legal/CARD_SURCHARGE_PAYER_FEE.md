# The passed-on processing fee and the credit-card surcharge rules
**Last verified:** 2026-11-17
**Re-verify by:** 2027-11-17, or a trigger: the card networks change the Canadian cap; the product's rates or the
"who pays" default change; the first Québec club; Stripe answers the classification question below
**Depends on facts:** `LEGAL_FACTS.md` § Where data lives (Payments: direct charges, the club is merchant of record);
`PLAN_PRICING_FACTS.md` (the online-payment rates, card and bank debit)

## Question(s) this answers
When a club chooses "Families and teams pay it" (the default, ruling A14), the product adds FieldLogicHQ's processing fee
to what the payer owes, at a higher rate for a card than for a bank debit. Is that a credit-card surcharge, and if so does
it break the rules? Who carries the exposure? Raised as the open counsel question in the Stage 12 plan (P:967-969) and
`BUSINESS_DECISIONS.md` (~L1221-1224); answered here as far as primary sources reach.

## Finding
- **The rule (Financial Consumer Agency of Canada, merchants' page):** a merchant may add a surcharge to a credit-card
  transaction "(except in Quebec)", with "a maximum surcharge cap of 2.4%", and not "higher than your actual cost to
  accept the credit card". It must be disclosed "before a transaction is completed", the cardholder must be able to cancel
  without penalty, and it must show "at the point of sale, both in store and online" and "on every receipt". Some
  networks require advance written notice to the acquirer and/or the network. Mastercard's Canadian rules set that notice
  at **no less than 30 days** before the merchant starts. Debit and prepaid surcharging is restricted by some networks.
- **The distinction that decides it:** the FCAC page says networks "allow eligible merchants to charge a service or
  convenience fee for certain types of transactions", and that merchants who charge those fees "are not allowed to
  surcharge"; it does not say when a fee for paying online is one or the other, and sends merchants to their processor.
- **The product's facts (census 2026-11-17):** the payer-pays fee is added as a "Processing fee" line at checkout and on
  the receipt (so disclosure before payment and on the receipt is met); it is charged on card **and** bank debit, but at
  different rates (card higher); our card rate is above 2.4%; no Québec check on payouts; nothing tells the networks or
  Stripe that a club surcharges.
- **Who carries it:** the club. It is the merchant, so a breach of network rules is a breach of its merchant agreement
  with Stripe. FieldLogicHQ's exposure is indirect but real: the product's default places every club in this position
  unless the owner changes it.
- **Not settled:** whether a fee charged for using an online payment service, on every method, is a "surcharge" at all.
  The argument that it is not: it is charged for paying online, not for paying by card. The argument that it is: its
  card amount is higher than its bank-debit amount, so part of it is charged because the payer chose a card.

## What the product does today
- Fee added on top when the payer pays: `app/api/pay/team/[token]/route.ts:110-114`; checkout line "Includes a {fee}
  processing fee." (`lib/online-payment-words.ts:688`); receipt line "Processing fee · {fee}" (`:287`).
- Default `fee_payer = 'family'` (census item 4); rates `ONLINE_PAYMENT_RATES` (`lib/plan-config.ts:565-568`).
- No Québec or surcharge handling; a Québec address does not stop payouts (`lib/billing-location-server.ts:277-280`).

## Owner ruling (2026-11-17)
**Ruled:** our concern is our fee, which we charge the club; what a club passes on to payers is the club's own charge and its
responsibility (Payments Terms §9). No question to Stripe: "I am sure Stripe has done their due diligence on how they set up
their business in Canada ... they do business with many merchants here." The default ("Families and teams pay it") was not
ruled on and is unchanged. The recommendation below was given before the ruling and is kept as the record of it.

## Recommendation (before the ruling)
Decide this before online payments are switched on. It changes the product, not just the wording. The options, best first:

1. **Ask Stripe, then decide (recommended, and cheap).** Stripe is the acquirer. Ask its support, in writing, whether a
   platform's application fee that the connected account passes on to the payer, charged on cards and on pre-authorized
   debits at different rates, is a surcharge under the networks' Canadian rules. The full payout test is a week away, so
   the answer can arrive before the switch-on. Meanwhile:
2. **Make "The club pays it" the default.** No club is put in the surcharge position without choosing it, and the terms
   can then state the responsibility plainly for a club that chooses to pass the fee on. This revisits ruling A14's
   default. A14 was ruled before this question was answered (the counsel question was left open beside it), so it is a
   new fact, not a re-litigation.
3. **If Stripe says it is a surcharge:** either take away the passed-on choice for cards (bank debit can stay, since no
   card network is involved), or cap the card part the payer pays at the networks' limit with the club paying the rest.
   Either way, add the Québec block on payouts.
4. **Keep it as built and put the responsibility on the club in the terms.** Not recommended. A treasurer cannot judge
   this, and the product's default chose it for them.

## Sources
- [Merchant surcharges, service and convenience fees, and discounts — Financial Consumer Agency of Canada](https://www.canada.ca/en/financial-consumer-agency/services/merchants/credit-fees-merchant.html) — accessed 2026-11-17 (page details: 2025-10-20)
- [Merchant surcharge rules — Mastercard Canada](https://www.mastercard.com/ca/en/business/support/merchant-surcharge-rules.html) — pointer for the 30-day notice; read via search summary, accessed 2026-11-17
- Visa's Canadian rules: behind a login; not read. The 2.4% cap is from the FCAC page above.
- [Stripe Connected Account Agreement](https://stripe.com/en-ca/legal/connect-account) — accessed 2026-11-17 (the platform's own agreement with the connected account is a "Platform Provider Agreement"; Stripe "does not control and is not responsible for fees imposed by a Stripe Connect Platform")

## Stripe-owned pricing sharpens the cost point (2026-11-18, flag)
Under rate design A (owner 2026-11-17, built in Stripe-owned pricing Stage 2) the family-facing fee is unchanged, but it is
now, by the payments terms' own account (v0.2 §4), **Stripe's real cost plus FieldLogicHQ's margin**. A domestic card on
a $100 base: the payer pays $105.00, Stripe charges the club $3.35, we take $1.65 (Stage 1 probe). The FCAC rule caps a
surcharge at the merchant's "actual cost to accept the credit card"; whether our margin, a software fee the club pays
only when it accepts a payment online, counts toward that cost is now a live question rather than an assumed one. Under
the O2 ruling it stays the club's charge and the club's responsibility; nothing here reopens it. **For a lawyer's eye**
with the question below. The card rate above 2.4% was already the sharper exposure.

## Lawyer's eye needed?
Yes — whether a passed-on platform fee is a surcharge or a service fee under each network's rules, and Québec's
Consumer Protection Act on any extra charge for the method of payment. Only after Stripe's answer, and only if the owner
keeps a passed-on card fee.
