# DRAFT — FieldLogicHQ Payments Terms

| | |
|---|---|
| **Version** | 0.1 |
| **Status** | owner-approved 2026-11-17 (v0.1); not published; not reviewed by a lawyer |
| **Effective date** | — (set when published; the published version is named by its date) |
| **Last reviewed** | 2026-11-17 |
| **Backlog item** | L3 (`LEGAL_INDEX.md`) |
| **Plan** | `docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` |

**Change log**
- **0.1 (2026-11-17)** — first draft. Written from the Stage 12 rulings (§0b, §0c, the 12d-1 rounds 1 to 3 and rulings 5
  and 6) and a code census of what the product does today (read 2026-11-17; the census answers are summarized in the
  NOTE blocks where a sentence rests on them). Fits under the published Terms of Service, version 2026-11-17.

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
- At the moment of each payment, Stripe takes our processing fee out of it and pays it to us (§4). What is left is your
  organization's.
- Your Stripe account belongs to your organization. Your owners can open it from the Payouts card, and your payouts are
  listed in FieldLogicHQ for the people who read your organization's money.

> NOTE — "Never holds the payment" is exact: only our fee (and Stripe's charges to us) land in FieldLogicHQ's Stripe
> balance; the payment itself never passes through us. The product's own sentence ("FieldLogicHQ never holds it.") means
> the same thing. This is also the fact the money-services question (L4) turns on.

## 4. Our processing fee

- **What it is.** Each online payment carries our processing fee, at the rates shown on your Payouts card and in "Before
  you set up payouts": one rate for a card payment and another for a bank debit. The fee is **our charge to your
  organization** for FieldLogicHQ's online payment features: the pay page, receipts in your name, and recording each
  payment in your books. Out of it, we pay Stripe's own processing fee.
- **How it is paid.** Stripe takes the fee out of each payment as it is made, so your organization receives the payment
  less the fee.
- **Who pays it in the end is your choice.** On the Payouts card, your owners choose one of two settings for the whole
  organization:
  - **the payer pays it:** your organization adds the fee to what the payer owes, as your own charge, shown as "Processing
    fee" at checkout and on the receipt. Your organization receives the full amount it asked for; or
  - **your organization pays it:** the payer pays only what you asked for, and the fee comes out of each payment.

  Either way, the fee is owed to us by your organization. When the payer pays it, your organization is passing its own
  cost on as its own charge to the payer, and §9 applies to that charge. A change to this setting applies to payments
  started after the change; anything already paid stays as it was.
- **Sales tax.** Our fee is plus any sales tax that applies to it, such as GST/HST, worked out from your organization's
  billing address.
- **Our fee is not refunded** when you refund a payment or when a payer wins a dispute. The one exception: when a bank
  debit is returned unpaid, Stripe gives our fee on that payment back to your organization automatically.
- **Changes to our rates.** We will email your organization's owners **at least 30 days before** a rate goes up. The new
  rate applies to payments started on or after the date in the email. A lower rate can apply straight away.

> NOTE — The rates are never written here: they live in `PLAN_PRICING_FACTS.md` and the product prints them. The
> "who pays" labels in the product are "Teams pay it" / "Families and teams pay it" / "The club pays it"; the terms
> describe the choice rather than quote a label that changes by plan.
>
> NOTE — **Sales tax on the fee is not built.** The product charges no tax on the application fee today and sends no
> statement of fees (census item 11). Whether the fee is taxable at all is `/accounting`'s open question D1
> (`PLATFORM_FEE_TAX_TREATMENT.md`). The sentence is written true either way ("any sales tax that applies"), but if the
> fee is taxable, publishing it before the statement exists means we promise tax we are not charging. The board already
> holds this as a switch-on dependency.
>
> NOTE — The returned-debit exception is from the 12d-1 sandbox probe (plan line 194: "Stripe returned our application
> fee to the club by itself"). Re-confirm on the full payout test; if live behaves differently, cut the exception.
>
> NOTE — The 30-day notice of a rate increase is a promise with no procedure yet. It mirrors Terms §8 "Price changes";
> the same steps as `PRICE_CHANGE_NOTICE_PROCEDURE.md` should be written for the online-payment rate before a rate ever
> changes (changing the rate constant applies at once to every new payment).

## 5. Other Stripe fees we bill to your organization

Stripe charges some fees beyond its processing fee. They include fees for:
- a card payment a payer disputes, and for answering a dispute;
- a bank debit that is returned unpaid or disputed; and
- a card issued **outside your organization's country**. This can happen whenever a payer from another country pays you,
  for example a visiting team at your tournament.

**Where Stripe takes one of these fees from your organization's Stripe balance**, that is between your organization and
Stripe, and we do not bill it again. **Where Stripe charges the fee to us**, we bill it to your organization at Stripe's
own figure, or, where Stripe does not report a figure for each payment (as for a card issued outside your country), at
Stripe's published rate. We never bill the same fee twice. If you win a dispute and Stripe returns its answering fee to
us, we credit it to your organization's account.

**How we bill them.** These fees, plus any sales tax on them, go on your organization's next plan invoice. If your
organization has no plan invoice coming, we send its own invoice on the 1st of the month for the month before, due in 30
days. **These fees are billed whatever plan your organization is on**, including a free or discounted plan and a plan
that has ended. Because these invoices carry sales tax, we ask for your organization's billing address before you set up
payouts.

If one of these invoices is still unpaid after it is due, we will remind your owners. An invoice that stays unpaid may
lead us to suspend online payments or your account under §11 of the Terms of Service.

> NOTE — Rulings: round 1 Ask 1, round 2 (comped clubs get no reprieve), round 3 (own invoice), 12d-1 ask 3 (one a month
> on the 1st), ruling 5 (bill only what Stripe charged us; never twice), the "outside your country" wording. The
> foreign-card extra is the published-rate fallback (`FOREIGN_CARD_EXTRA_BPS`), as ruled.
>
> NOTE — **"May lead us to suspend" does not contradict the ruling that nothing switches off by itself.** It is a manual
> right under Terms §11; there is no per-organization online-payments switch, so suspension is the only lever today.
>
> NOTE — Product words to align (for `/accounting`, not this draft): the Before window says FieldLogicHQ "passes them on
> to you on an invoice", while the invoice taxes them as our own supply (`RECOVERED_STRIPE_FEES_TAX.md`). These terms say
> "we bill", which fits the tax treatment.

## 6. Refunds

- **Your organization decides refunds.** You set your own refund policy and decide each refund. We do not decide refunds
  or make them on your behalf.
- **Your refund policy.** Your owners write your refund policy on the Payouts card before online payments start, and
  payers see it beside the Pay button before they pay.
- **Refunds come out of your organization's Stripe balance.** What happens when the balance is too low is set by your
  agreement with Stripe.
- **Our fee stays ours on every refund** (§4). When you include the processing fee in a refund, the whole fee comes out
  of your organization's balance.
- **After you disconnect** (§10), refunds of payments already made are made in Stripe.

> NOTE — **O1 RULED (owner 2026-11-17): the refund policy is required** ("let's make sure we have the refund policy in
> place"). Replaces A9's "optional, absent when blank". **BUILT 2026-11-17 (Club Stage 12, commit `1d15c9cd2`):** the
> policy is written in "Before you set up payouts" beside the tick (Continue absent until both) and can be changed on the
> Payouts card but never cleared; a connected club without one takes no payments (every pay door shows "How to pay").
> ⚠ **One word for the owner (recommended, not applied — approved text):** the payer meets a "Refund policy" **link** beside
> Pay that opens the words; Stripe's checkout shows nothing of it. "payers **see** it" → "payers **can read** it beside the
> Pay button before they pay" is the true sentence. Showing it open on the pay page is the alternative (open question L17).
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
- **If the payer wins,** the disputed amount stays with them and our fee is not returned. Stripe's dispute fees are dealt
  with under §5.
- **If a bank debit is returned unpaid,** the payment is marked returned in your books and the payer owes the amount
  again. Stripe's fee for it is dealt with under §5.
- What happens if your organization's Stripe balance goes below zero is set by your agreement with Stripe.

> NOTE — Census: Stripe covers a connected account's negative balance as against the platform (`losses_collector:
> 'stripe'`, a public-preview setting). Whether Stripe then recovers it from the club is Stripe's agreement with the club;
> these terms promise nothing about it either way.

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
  payments. Payments already made stay in your books, refunds of them are made in Stripe, and fees already owed under §4
  and §5 are still owed. Your Stripe account stays your organization's; to close it, close it with Stripe.
- **When your plan ends or moves to a plan without online payments,** open pay pages close and no new ones open.
  Refunds and disputes of payments already made keep working in FieldLogicHQ.
- **We may stop online payments for your organization** under §11 of the Terms of Service, or if Stripe stops providing
  the service to your organization.
- **If we stop offering online payments altogether,** we will email your owners at least 30 days before, where we can.
- **Deleting your organization.** We will not delete an organization while money is still in motion: an open dispute,
  a bank debit still clearing, or a Stripe fee not yet billed or paid.

> NOTE — Census: every ending closes open pay pages; no ending deletes the Stripe account; the downgrade "wind-down"
> card keeps refunds and disputes working; org deletion is refused while money is in flight. **One finding:** a
> SUSPENDED club's copy says refunds and disputes are "handled in Stripe while you're suspended", but the in-app screens
> are closed to it, so the bullet above says "plan ends or moves", not "suspended". Fine as written.

## 11. Information about payers

Payers enter their card or bank details on Stripe's page. **FieldLogicHQ never sees or stores a full card or bank account
number.** Stripe sends us the details of each payment so we can record it in your books, such as the amount, the method,
the card brand, its last four digits and the country it was issued in. These details are part of your organization's
Customer Data, handled as the Terms of Service (§4) and our [Privacy Policy](/privacy) describe.

> NOTE — The list of fields is from the census (card brand and last four digits are shown; the issuing country drives
> the §5 fee). Check against `DATA_DICTIONARY.md` before publishing, and check that the published Privacy Policy's
> online-payments lines say the same (a Low finding is already on file: players' full names in the payment description).

## 12. Our responsibility, and yours to us

- **The limits in §14 of the Terms of Service apply to online payments.** Our fees and the Stripe fees we bill count as
  amounts your organization paid us.
- **We are not responsible for** Stripe's decisions about your organization's account, payments or payouts; for a card
  issuer's or bank's decision on a dispute; or for your organization's sales, refunds and events.
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
  Approved text, not yet published: publishing waits on the dependencies below.

**Things that must be true first (dependencies, not wording)**
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
   as these terms. Nothing real is held before then (production has no agreement rows).

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
   the club's, but it follows from our default.
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
