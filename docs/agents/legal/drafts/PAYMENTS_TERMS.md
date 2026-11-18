# DRAFT — FieldLogicHQ Payments Terms

| | |
|---|---|
| **Version** | 0.2 |
| **Status** | **v0.2 owner-approved 2026-11-18 (O4)**; v0.1 (approved 2026-11-17) is superseded, never to be published; not published; not reviewed by a lawyer |
| **Effective date** | — (set when published; the published version is named by its date) |
| **Last reviewed** | 2026-11-18 |
| **Backlog item** | L3 (`LEGAL_INDEX.md`) |
| **Plan** | `docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` |

**Change log**
- **0.1 (2026-11-17)** — first draft. Written from the Stage 12 rulings (§0b, §0c, the 12d-1 rounds 1 to 3 and rulings 5
  and 6) and a code census of what the product does today (read 2026-11-17; the census answers are summarized in the
  NOTE blocks where a sentence rests on them). Fits under the published Terms of Service, version 2026-11-17.
- **0.1, amended 2026-11-17 (owner, after approval, before publication)** — §6: payers "can read" the refund policy beside
  the Pay button (was "see"), matching the built link. No other wording changed.
- **0.2 (2026-11-18, Stripe-owned pricing Stage 5)** — rewritten for Stripe-owned pricing (owner rulings R3 and rate
  design A, 2026-11-17; Stages 2 and 4 built, `142ef12d6`, `6dc9c6119`). Stripe charges the club for its own processing
  and its extras from the club's balance; our fee is only our part; we bill nothing else. §4 rewritten (two parts, the
  club's net in each payer mode, tax included, neither part refunded, our fee back on a returned debit); §5 replaced by
  "Stripe charges your organization directly" (Stripe's agreement and prices, the event fees, the club's net varies, a
  negative balance, price changes); §3, §6, §7, §10 and §12 follow. Needs the owner's approval again (O4).

**How to read this draft.** Customer text is everything after the first `---` line, up to "Before this can be
published". Owner notes are in blockquotes that start `> NOTE`; they are not part of the terms. The shape follows the
dev-preview rules in `LEGAL_INDEX.md` § "Drafts the dev preview reads", so the product can preview it unchanged.

---

## 1. What these Payments Terms cover

These Payments Terms are added to our [Terms of Service](/legal/terms) for an organization that takes payments online
through FieldLogicHQ. They apply from the moment an owner of your organization ticks "I agree to the FieldLogicHQ
payments terms" before setting up payouts. Words that the Terms of Service define, such as "you", "we" and "Customer
Data", mean the same here. Where these Payments Terms and the Terms of Service say different things about online
payments, these Payments Terms apply.

"**Payer**" means a family, team or person who pays your organization online through FieldLogicHQ.

## 2. Who sells, who runs the software, and who processes the payment

- **Your organization is the seller.** When a payer pays online, they are paying your organization for your
  registration, program, team fee or tournament entry. The sale is between your organization and the payer. Receipts and
  the payer's card or bank statement show your organization's name.
- **FieldLogicHQ provides the software.** We build the pay page, send the receipt in your name, and record the payment in
  your books. We are not a party to the sale, we do not sell anything to the payer, and we do not receive or hold the
  payment.
- **Stripe processes the payment.** To take payments online, your organization opens its own Stripe account through
  FieldLogicHQ and accepts Stripe's own agreements, which are between your organization and Stripe. Stripe checks your
  organization's identity and bank account; we do not. Stripe may ask for more information, pause payments, hold a payout
  or close your Stripe account under its agreements, and we cannot override its decisions.

> NOTE — Census 2026-11-17: Stripe Accounts v2 with the Express Dashboard, direct charges on the club's own account, no
> transfers; the code never sets a statement descriptor, so Stripe uses the club's. Stripe's hosted onboarding presents
> Stripe's Connected Account Agreement; our own screens neither show nor link it. Stripe's agreement calls the contract
> between a platform and its connected account the "Platform Provider Agreement" and stays out of it: this document is
> that agreement.

## 3. Where the money goes

- Each payment goes into your organization's Stripe account. Stripe pays it out to your bank account on Stripe's
  schedule. **FieldLogicHQ never holds the payment.**
- At the moment of each payment, Stripe takes its own fee for processing it, and takes our fee out of it and pays it to
  us (§4). What is left is your organization's.
- Your Stripe account belongs to your organization. Your owners can open it from the Payouts card, and your payouts are
  listed in FieldLogicHQ for the people who read your organization's money.

> NOTE — "Never holds the payment" is exact: only our fee lands in FieldLogicHQ's Stripe balance (under Stripe-owned
> pricing Stripe charges the club, not us, for processing; Stage 1 probe 2026-11-17); the payment itself never passes
> through us. The product's own sentence ("FieldLogicHQ never holds it.") means
> the same thing. This is also the fact the money-services question (L4) turns on.

## 4. The processing fee, and our fee

- **What it is.** Each online payment carries a processing fee, at the rates shown on your Payouts card and in "Before
  you set up payouts": one rate for a card payment and another for a bank debit. The processing fee is made of two
  parts:
  - **Stripe's fee** for processing the payment, which Stripe charges your organization directly, under your
    organization's agreement with Stripe and at Stripe's prices (§5); and
  - **our fee**, which is **our charge to your organization** for FieldLogicHQ's online payment features: the pay page,
    receipts in your name, and recording each payment in your books.

  We set our fee so that, at Stripe's standard Canadian prices, the two parts together equal the processing fee. Where
  Stripe charges more than its standard Canadian price, for example for a card issued outside Canada (§5), the two parts
  together come to more than the processing fee.
- **How it is paid.** Stripe takes both parts out of each payment as it is made: its own fee for itself, and our fee for
  us. Your organization receives the rest.
- **Who pays it in the end is your choice.** On the Payouts card, your owners choose one of two settings for the whole
  organization:
  - **the payer pays it:** your organization adds the processing fee to what the payer owes, as your own charge, shown
    as "Processing fee" at checkout and on the receipt. Your organization receives the full amount it asked for; or
  - **your organization pays it:** the payer pays only what you asked for, and your organization receives that amount
    less the processing fee.

  Either way, our fee is our charge to your organization, taken from each payment, and Stripe's fee is your
  organization's to pay Stripe. On a payment where Stripe charges more than its standard Canadian price, your
  organization receives that much less (§5). When the payer pays the processing fee, your organization is passing its own cost on as its own charge to the payer, and §9 applies to that
  charge. A change to this setting applies to payments started after the change; anything already paid stays as it was.
- **Sales tax.** Any sales tax that applies to our fee, such as GST/HST, is **included in our fee**, worked out from your
  organization's billing address. Nothing is added on top.
- **Neither part is refunded** when you refund a payment or when a payer wins a dispute: we keep our fee, and Stripe
  keeps its own under its pricing. So a processing fee your organization gives back in a refund is your organization's
  cost. The one exception: when a bank debit is returned unpaid, our fee on that payment comes back to your organization
  automatically. Stripe returns or keeps its own fee under its pricing, and may charge a separate fee for the returned
  debit (§5).
- **Changes to our rates.** We will email your organization's owners **at least 30 days before** a rate goes up. The new
  rate applies to payments started on or after the date in the email. A lower rate can apply straight away.

> NOTE — The rates are never written here: they live in `PLAN_PRICING_FACTS.md` and the product prints them. The
> "who pays" labels in the product are "Teams pay it" / "Families and teams pay it" / "The club pays it"; the terms
> describe the choice rather than quote a label that changes by plan.
>
> NOTE — **v0.2 (Stripe-owned pricing, 2026-11-18).** Rate design A (owner 2026-11-17): the family-facing rates are
> unchanged and our application fee is the processing fee less Stripe's standard Canadian cost (card 2.9% + $0.30 on the
> whole charge; PAD 1% + $0.40 capped at $5), stored per payment (`online_payments.application_fee_amount`, mig 498;
> `lib/online-payment-fee.ts`). The net in each mode is the code's (`onlineFee().clubReceivesCents`, domestic): payer pays →
> the base; club pays → the base less the fee. Stage 1 probe ($100 base, card): Stripe charged the club $3.35, we took
> $1.65, the club netted $100.00. **"At Stripe's standard Canadian prices" is deliberate:** our fee is computed from a
> constant (`STRIPE_STANDARD_COST`), so if Stripe changes its price the two parts no longer add up until we change the
> constant, and the terms promise no particular response. "Under its pricing" for Stripe keeping its fee on a refund
> describes Stripe; we promise only our own fee. v0.1's "Out of it, we pay Stripe's own processing fee" is gone: it was
> the old model, and `/legal`'s Stage 2 warning stands (Before list item 0).
>
> NOTE — **Sales tax on the fee is not built,** and whether our fee is taxable at all is `/accounting`'s open question
> D1 (`STRIPE_OWNED_PRICING_ACCOUNTANT_QUESTIONS.md`). R1 (owner 2026-11-17) puts any tax INSIDE the fee, so "any sales
> tax that applies … is included" is true either way: if the fee is exempt, there is none to include; if taxable, it is
> paid out of our share, by the club's billing address (`/accounting`'s method, plan Stage 5 review: 13/113 ON, 14/114
> NS, 15/115 NB/NL/PE, 5/105 elsewhere). The record per paid fee and the fee statement are GST/HST Stage 5. Tax is inside
> OUR part only, never inside Stripe's: words that say "the processing fee includes GST/HST" would overstate it.
>
> NOTE — The returned-debit exception: the Stage 1 probe (2026-11-17) returned Stripe's fee and auto-refunded our fee
> to the club (the club netted $0). The text promises only OUR fee back (`/legal` Stage 5 review: test mode only, and we
> promise nothing of Stripe's); the build prompt's "a returned debit gives both fees back" is the probe's result, not a
> term. Stripe's Canadian pricing page (read 2026-11-18) lists "+ CA$5.00" for a failed or
> disputed PAD; the test-mode probe charged no failure fee. Re-confirm both on the full payout test (on/after
> 2026-11-25); if live behaves differently, cut the exception. `/accounting`: our fee coming back needs a credit record
> for its tax (s.232), GST/HST Stage 5.
>
> NOTE — The 30-day notice of a rate increase is a promise with no procedure yet. It mirrors Terms §8 "Price changes";
> the same steps as `PRICE_CHANGE_NOTICE_PROCEDURE.md` should be written for the online-payment rate before a rate ever
> changes (changing the rate constant applies at once to every new payment).

## 5. Stripe charges your organization directly

Stripe's fees for your organization's online payments are **charged by Stripe to your organization**, under your
organization's agreement with Stripe and at Stripe's prices, and they come out of your organization's Stripe balance.
**FieldLogicHQ does not bill them, and we bill your organization nothing for online payments beyond our fee (§4).**

Besides its fee for processing each payment, Stripe charges fees for some payments and events. They include fees for:
- **a dispute:** a fee when a payer disputes a card payment, and a further fee if your organization answers it. Winning
  the dispute does not return the first fee; whether the answering fee comes back is set by Stripe's pricing;
- **a bank debit** that is returned unpaid or disputed; and
- **a card issued outside Canada**, and **a currency conversion** where one is needed. This can happen whenever a payer
  from another country pays you, for example a visiting team at your tournament.

**What your organization receives can vary.** On a payment that carries one of these fees, and on any payment where
Stripe charges more than its standard Canadian price, your organization receives less than the amounts in §4. Stripe
publishes its current prices on its website.

**Stripe can change its fees** under its agreement with your organization. We do not set them and cannot change them.

**If your organization's Stripe balance goes below zero,** for example after a refund or a lost dispute once the money
has been paid out, **your organization owes the difference to Stripe.** Stripe may take it from later payments or
debit your organization's bank account, under its agreement with your organization. FieldLogicHQ does not cover it.

> NOTE — **v0.2 replaces v0.1's "Other Stripe fees we bill to your organization"** (the monthly fee invoice, retired by
> Stripe-owned pricing Stage 4, `6dc9c6119`, 2026-11-18). Its rulings (round 1 Ask 1, rounds 2 and 3, 12d-1 ask 3,
> ruling 5, the published-rate fallback) and the "may lead us to suspend" lever went with the machinery: there is no
> bill left to be unpaid.
>
> NOTE — **Figures are deliberately not quoted.** Stripe's Canadian pricing page (read 2026-11-18): dispute CA$15 per
> dispute received; "dispute countered" CA$15 per dispute answered, **returned for won disputes**, kept on a loss; PAD
> failures and disputes + CA$5; international cards + 0.8%; currency conversion + 2%. Stage 1 probe (2026-11-17): the $15
> dispute fee was not returned on a win. So the build prompt's "a win does not return them" holds for the first fee only,
> and the text says so without promising the second either way. A figure in these terms would go stale the day Stripe
> changes it, which this same section says it can.
>
> NOTE — **The negative balance.** Stage 1 probe: the club's balance read −$240 then −$500 and the platform was never
> debited. Stripe's pages: the club owes its own negative balance first (`debit_negative_balances: true`, Stripe may
> debit its bank); if it cannot pay, Stripe absorbs it (`losses_collector: 'stripe'`). The text states the club's
> obligation and says we don't cover it; it promises nothing about Stripe's backstop (`/legal` Stage 2: never promise
> it, it is Stripe's to give and a preview setting).
>
> NOTE — "Outside Canada" (was "outside your organization's country"): §14 offers payments to Canadian organizations
> only, and Stripe's page says "international cards".

## 6. Refunds

- **Your organization decides refunds.** You set your own refund policy and decide each refund. We do not decide refunds
  or make them on your behalf.
- **Your refund policy.** Your owners write your refund policy on the Payouts card before online payments start, and
  payers can read it beside the Pay button before they pay.
- **Refunds come out of your organization's Stripe balance.** What happens when the balance is too low is set by your
  agreement with Stripe.
- **Neither part of the processing fee comes back on a refund** (§4). When you include the processing fee in a refund,
  the whole of it comes out of your organization's balance.
- **After you disconnect** (§10), refunds of payments already made are made in Stripe.

> NOTE — **O1 RULED (owner 2026-11-17): the refund policy is required** ("let's make sure we have the refund policy in
> place"). Replaces A9's "optional, absent when blank". **BUILT 2026-11-17 (Club Stage 12, commit `1d15c9cd2`):** the
> policy is written in "Before you set up payouts" beside the tick (Continue absent until both) and can be changed on the
> Payouts card but never cleared; a connected club without one takes no payments (every pay door shows "How to pay").
> **RULED and APPLIED (owner 2026-11-17, "go ahead"): "payers see it" → "payers can read it"** beside the Pay button,
> because the payer meets a "Refund policy" **link** beside Pay that opens the words, and Stripe's checkout shows nothing
> of it. An amendment to the approved v0.1 text, made by the owner before publication (change log). Whether the policy
> should instead show open on the pay page stays open question L17 (not researched; the club's consumer-law exposure).
> Also: the first sentence names the Payouts card; since this build the policy is first written in the Before window
> (the card edits it) — still true as "on the Payouts card", since that window opens from it.
>
> NOTE — Census: in-app refunds are refused while a dispute is open; partial refunds never include the fee; there is no
> time limit and no rule for a refund after a payout. Nothing here promises one.

## 7. Disputes and returned bank debits

- **A payer can dispute a payment** with their card issuer or bank. While it is decided, Stripe takes the disputed amount
  from your organization's Stripe balance.
- **Your organization answers it, in Stripe.** The person who set up payouts signs in to Stripe to send the evidence.
  FieldLogicHQ can gather the facts of the payment for you to copy, but cannot answer a dispute for you. The card issuer
  or bank decides the outcome.
- **If the payer wins,** the disputed amount stays with them and neither part of the processing fee is returned (§4).
  Stripe's dispute fees come out of your organization's Stripe balance (§5).
- **If a bank debit is returned unpaid,** the payment is marked returned in your books and the payer owes the amount
  again. Our fee on it comes back (§4); any fee Stripe charges for the returned debit comes out of your organization's
  Stripe balance (§5).
- If your organization's Stripe balance goes below zero, §5 applies.

> NOTE — v0.2: the negative balance moved to §5 and now states the club's obligation (Stage 1 probe and Stripe's pages,
> §5 note). The platform's position is unchanged: `losses_collector: 'stripe'` (a public-preview setting) means the
> platform is never debited; nothing here promises what Stripe does if the club cannot pay.

## 8. What your organization owes payers

Your organization is responsible to payers for what it sells. That includes:
- running the program, event or entry the payer paid for;
- refunding under your refund policy and the law when an event is cancelled, changed or not delivered;
- answering payers' questions and complaints (receipts send them to you); and
- any tax that applies to what you sell.

If you cancel an event after the money has been paid out to your bank account, refunds still come out of your Stripe
balance, so make sure it has enough, or add funds through Stripe.

## 9. Your organization's responsibilities

Your organization agrees to:
- give Stripe true information and keep your Stripe account in good standing;
- take payments only for your own organization's registrations, programs, team fees and tournament entries;
- follow the law and the card networks' rules for what you charge payers. **If you choose to have the payer pay the
  processing fee, that is your organization's own charge to the payer, and your organization is responsible for it being
  allowed.** It is higher for a card payment than for a bank debit, and the card networks limit extra charges for paying
  by credit card; and
- keep the information about payers that FieldLogicHQ holds for you as Customer Data, under the Terms of Service (§4).

> NOTE — **O2 RULED (owner 2026-11-17):** our concern is our fee, which we charge the club; what the club passes on to
> payers is the club's own charge and its responsibility. No question to Stripe ("Stripe has done their due diligence";
> it does business with many Canadian merchants). The default setting is unchanged (not ruled). `/legal` stated the
> disagreement once before the ruling (`CARD_SURCHARGE_PAYER_FEE.md`: the passed-on line is built by our software and on by
> default, and the card rate is above the 2.4% cap); recorded, not reopened.

## 10. Switching online payments off, and ending

- **Disconnecting.** Your owners can disconnect payouts at any time from the Payouts card. Pay pages stop opening for new
  payments. Payments already made stay in your books, refunds of them are made in Stripe, and Stripe's fees on them are
  still owed to Stripe under your agreement with Stripe. Your Stripe account stays your organization's; to close it, close it with Stripe.
- **When your plan ends or moves to a plan without online payments,** open pay pages close and no new ones open.
  Refunds and disputes of payments already made keep working in FieldLogicHQ.
- **We may stop online payments for your organization** under §11 of the Terms of Service, or if Stripe stops providing
  the service to your organization.
- **If we stop offering online payments altogether,** we will email your owners at least 30 days before, where we can.
- **Deleting your organization.** We will not delete an organization while money is still in motion: an open dispute,
  or a bank debit still clearing.

> NOTE — v0.2: "or a Stripe fee not yet billed or paid" cut. Stage 4 retired the fee billing, and the deletion check
> (`lib/online-payment-endings.ts`, money in flight) counts only open disputes and clearing debits (read 2026-11-18).
>
> NOTE — Census: every ending closes open pay pages; no ending deletes the Stripe account; the downgrade "wind-down"
> card keeps refunds and disputes working; org deletion is refused while money is in flight. **One finding:** a
> SUSPENDED club's copy says refunds and disputes are "handled in Stripe while you're suspended", but the in-app screens
> are closed to it, so the bullet above says "plan ends or moves", not "suspended". Fine as written.

## 11. Information about payers

Payers enter their card or bank details on Stripe's page. **FieldLogicHQ never sees or stores a full card or bank account
number.** Stripe sends us the details of each payment so we can record it in your books, such as the amount, the method,
the card brand, its last four digits and the country it was issued in. These details are part of your organization's
Customer Data, handled as the Terms of Service (§4) and our [Privacy Policy](/privacy) describe.

> NOTE — The list of fields is from the census (card brand and last four digits are shown; the issuing country drove
> v0.1's billed foreign-card fee, retired in Stage 4, and is still recorded on the payment; re-check it is still stored
> before publishing, or cut "and the country it was issued in"). Check against `DATA_DICTIONARY.md` before publishing, and check that the published Privacy Policy's
> online-payments lines say the same (a Low finding is already on file: players' full names in the payment description).

## 12. Our responsibility, and yours to us

- **The limits in §14 of the Terms of Service apply to online payments.** Our fees count as amounts your organization
  paid us; Stripe's fees are paid to Stripe, not to us.
- **We are not responsible for** Stripe's decisions about your organization's account, payments or payouts; Stripe's
  fees and prices; a card issuer's or bank's decision on a dispute; or your organization's sales, refunds and events.
- **Your organization covers our reasonable costs** (including legal fees) arising from a claim against us by a payer, a
  card network, Stripe or a regulator about your organization's sales, refunds, events, or the charges your organization
  adds to what payers pay. This adds to §15 of the Terms of Service.

## 13. Changes to these Payments Terms

We may update these Payments Terms. Each version is published at its own address with its date. We will **email your
owners at least 30 days before a change that reduces your organization's rights or increases what it pays**. Smaller
changes take effect when we post them.

When a new version is published, your Payouts card asks your owners to agree to it. Online payments stay on in the
meantime, but you will need to agree to the new version before setting up payouts again, reconnecting, or changing who
pays the processing fee. **If your organization keeps taking online payments after a new version takes effect, it
accepts that version.** If you do not agree, disconnect before it takes effect.

> NOTE — Matches ruling round 2 ask 6 (a notice and an owner item; payments stay on; the new version needed to set up
> again, reconnect or change who pays) and the built words (`TERMS_WORDS`). Acceptance by continuing is the honest
> description of what the product does once payments stay on; it is weaker than a tick for a material change (lawyer's
> eye, item 4).

## 14. Where online payments are offered

Online payments are offered to organizations in **Canada**, in **Canadian dollars**. Like the rest of FieldLogicHQ (Terms
of Service §17), they are **not currently offered in Québec**.

> NOTE — **Product finding:** setting up payouts does not check for a Québec billing address (census item 4,
> `lib/billing-location-server.ts:277-280`). A club can only reach payouts with a plan, and a new plan is refused in
> Québec, so the gap is an organization that already had a Québec address. Low; route to `/plan` with the surcharge
> decision, since Québec is also where a passed-on card fee is banned outright.
> **BUILT 2026-11-17 (Club Stage 12, commit `1d15c9cd2`; owner ruled the same day: refuse new setups, §14 over GST/HST
> Q6's "payouts untouched"):** setting up payouts, and reconnecting, refuse a Québec billing address on file (409
> `billing_region_closed`: "We're not offering online payments in Québec yet, so we can't set up payouts with a billing
> address there. …"). A club already taking payments is not touched, as Terms §17 keeps a Québec account's plan.

## 15. How your organization accepts these Payments Terms

An owner of your organization accepts these Payments Terms for it by ticking the box in "Before you set up payouts". We
record who agreed, when, and to which version, and keep that record for at least six years after your account closes.

> NOTE — Census: the record is version, agreed-by (account and email), time, plus an audit-log row; no IP address, which
> matches the Terms of Service record. The six years mirrors Terms §20. **Product finding, verified 2026-11-17: the
> sentence is not true today, twice over.** The agreement lives on the club's one payouts row (mig 358:50-53), which is
> deleted with the organization (`ON DELETE CASCADE`, mig 358:61); and agreeing to a new version overwrites the earlier
> one on that row, so only the latest agreement is kept (the audit-log row is the only history). The Terms of Service
> acceptance is an append-only record; the payments one should be too. Route to `/plan`: an append-only payments-terms
> agreement record that outlives the organization, or cut the sentence to what is true.
> **BUILT 2026-11-17 (Club Stage 12, mig 497, commit `1d15c9cd2`): the sentence is now true.** Every tick is kept in
> `payments_terms_agreements`: the organization's id and name as text, the account's id and email as text, the version
> shown (the server refuses any other), the exact sentence ticked, the action (set up · reconnect · agree again; earlier
> standings copied in as backfill), the time. No IP. No foreign key, so deleting the organization or the account leaves
> it; append-only (no edit, delete or truncate). No purge exists; the six-year end needs a named exception, built with
> the Terms and tax records' retention step. Agreeing again happens in the card's new-terms window (§13), not "Before you
> set up payouts" — the record keeps both; §15's first sentence describes the first agreement, which is fine.

## Before this can be published

**Owner decisions**
- **O1** — RULED 2026-11-17: the refund policy is required (§6 note).
- **O2** — RULED 2026-11-17: the passed-on fee is the club's own charge and responsibility; no Stripe question (§9 note).
- **O3** — APPROVED by the owner 2026-11-17 ("I approve"), as v0.1 with the O1/O2 rulings and the L4 wording in §4.
  **Superseded by v0.2: v0.1 is never published** (item 0 below).
- **O4** — APPROVED by the owner 2026-11-18 ("i approve"), as **v0.2** (Stripe-owned pricing Stage 5): §4 and §5
  rewritten, §3, §6, §7, §10 and §12 touched (change log), with `/legal`'s and `/accounting`'s Stage 5 fixes applied.
  Approved text, not yet published: publishing waits on the dependencies below.
- **O5** — the default payer setting (`/legal` Stage 5 review, owner question (b)): left for before switch-on (owner
  2026-11-18, "you can leave club pays it"); the default stays "Teams pay it" / "Families and teams pay it" until then.

**Things that must be true first (dependencies, not wording)**
0. **Never publish v0.1's §4/§5** (`/legal`, Stripe-owned pricing Stage 2 review, 2026-11-18): "out of it, we pay
   Stripe's own processing fee" and "other Stripe fees we bill to your organization" describe a model that Stages 2 and 4
   retired (`142ef12d6`, `6dc9c6119`). v0.2 rewrites them for Stripe-owned pricing; it publishes only once the owner
   re-approves (O4).
1. **Tax on our fee** decided and, if taxable, charged and shown (§4) — `/accounting` D1; already on the board.
2. **The money-services question (L4)** — RESEARCHED 2026-11-17 (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`): likely not a
   PSP and likely not an MSB as built, moderately confident; no registration recommended. It holds only while the shape
   holds (§3 "never holds the payment"; no reserve, no payout schedule of ours, Stripe-hosted checkout). §4 now names the
   fee as a charge for our software's payment features, to match. Owner: rely on it, or apply to the Bank for certainty.
3. ✅ **DONE 2026-11-17, commit `1d15c9cd2`.** ~~**The six-year record** keeps every version agreed to and survives an
   organization's deletion, or §15 changes (§15 note; `/plan`).~~ Mig 497 (§15 note); prod apply rides the release.
4. **A rate-change notice procedure** exists before the rate ever changes (§4 note).
5. ✅ **DONE 2026-11-17, commit `1d15c9cd2`.** ~~**The refund policy is required by the product** (O1): no pay page
   opens until the club has written one. Club Stage 12.~~ (§6 note; one word for the owner there.)
6. **The Terms of Service's next version** (`drafts/TERMS_OF_SERVICE.md`, drafted 2026-11-17) publishes the same day.
7. **The privacy policy's next version names this record** (found at the 2026-11-17 light review): its retention row
   names only the Terms of Service and privacy acceptances, while the payments-terms record keeps an owner's email for
   six years after the account closes. Add "and the Payments Terms" to that row, a minor change, publishing the same day
   as these terms, and **is live before the first Payments Terms agreement is recorded on production** (`/legal` Stage 5
   review: the tick already writes those rows). Nothing real is held before then (production has no agreement rows).
   **DRAFTED 2026-11-18**
   (`drafts/PRIVACY_POLICY.md`, Stripe-owned pricing Stage 5, with the fee-invoice corrections); publishes the same day
   as these terms (owner call (b)).

**Publishing steps (for the build)**
1. Freeze the approved text as the product's dated version and replace `TERMS_PLACEHOLDER` and
   `PAYMENTS_TERMS_VERSION` (a date, so every club that agreed "to the draft" is asked again); write the short "What
   changed" summary only if a club has agreed before.
2. **Terms of Service minor version:** drafted (`drafts/TERMS_OF_SERVICE.md`): the §1 sentence, §13 and §19 "Whole
   agreement" name these Payments Terms. Under Terms §18 this is a smaller change. Add the `/legal/payments` route.
3. Delete this draft and point the index at the product's copy.

## For a lawyer's eye

1. **The passed-on card fee (§9, O2)** — the card networks' surcharge cap, the advance-notice rule, Québec's ban, and
   whether a fee charged on both cards and bank debits at different rates is a surcharge or a service fee. The exposure is
   the club's, but it follows from our default. **Sharper under v0.2 (2026-11-18):** the processing fee a payer is
   charged is now, by the terms' own account (§4), Stripe's real cost plus our margin, so whether our margin counts toward the club's "cost of
   acceptance" (the networks' "no more than the cost" rule) is a live question (`CARD_SURCHARGE_PAYER_FEE.md`).
2. **Money-services status (L4)** — researched (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`, likely out); a lawyer's read of
   whether our Stripe API calls are "initiation" and whether the per-payment fee is a distinct payment service.
3. **The indemnity (§12)** — its reach over regulator and card-network claims, from a club that may be a volunteer
   non-profit; and how it sits with the §14 cap.
4. **Acceptance by continuing (§13)** — whether keeping payments on after a material change binds an organization that
   never ticked the new version.
5. **"Not a party to the sale" (§2) with receipts we send in the club's name** — that the receipt, the pay page and the
   §2 wording together make the club, not us, the seller to a consumer payer under Ontario's consumer protection law.
6. **Children's information on the pay page** — a parent pays for a child; the payment description names the player
   (the Low finding on file).
