# DRAFT — Payments Terms: the sponsorship card payment addendum

| | |
|---|---|
| **Version** | 0.4 (an addendum to the published Payments Terms version 2026-11-24; becomes a whole new frozen text, see "How this publishes") |
| **Status** | draft, awaiting owner approval (0.3 was approved 2026-11-25, approval page, all five calls as recommended); not published. Not reviewed by a lawyer. The live Payments Terms page and every version constant are untouched. |
| **Effective date** | none yet (a new dated version: the day it is promoted or later; never reuse 2026-11-24) |
| **Last reviewed** | 2026-11-26 (`/legal` and `/accounting` on the refund made in the club's Stripe account; §4, §6, §7, §9, §10 and §11 checked against the code on dev) |
| **Seller** | the owner, trading as FieldLogicHQ, Ontario (`docs/agents/accounting/ACCOUNTING_FACTS.md`) |

**Change log**
- 0.4 (2026-11-26): a refund the club makes in its own Stripe account is now recorded (built on dev, migration 542), so §6 is rewritten: the two ways to refund, the processing fee, when the credit note and the email go and when they can't, whether the deal ends, "They still owe it" and no credit note for money still owed (owner 2026-11-26: "Fee first, no note"), the refund after a lost dispute, and saying when the invoice is still owing (owner 2026-11-26: "Yes, say it"). §4's "Only a card payment carries a fee" is qualified for an invoice that is owing again with a processing fee line on it. §11 adds when a Stripe refund was made and Stripe's reason code. §7, §9 and §10 checked: no text change. Drafted on the owner's ruling "Update drafts".
- 0.3 (2026-11-25): the close-out. §6 "How long it takes" now says what the product says since the wording pass (O-S3, answered 2026-11-24). Offer again (Part 4a) touches nothing in these terms. "How this publishes" updated: online payments have been switched on in production since 2026-11-24, with 0 payout accounts and 0 agreements on 2026-11-25.
- 0.2 (2026-11-24): the product now RECORDS a sponsor's dispute (a dispute row, a notice to whoever opens Sponsorships, and on a loss the payment's receipt lines reversed with no credit note and the deal back to owing), so §7's "handled in Stripe, and only there" bullet is rewritten, the two §10 narrowings are dropped (a sponsor's dispute works in FieldLogicHQ and holds up a deletion like any other), O-S2 is answered (built, owner call (b) of walk §564) and O-S4 falls away. §6 gains what we send when a refund does not reach the card (the credit note is cancelled and the business is told). No other text moves.
- 0.1 (2026-11-23): first draft. Adds a business that pays a club's sponsorship deal by card to §1, §2, §4, §6, §7, §9, §10 and §11 of the published 2026-11-24 text. Written from what the code does (`lib/sponsor-card-server.ts`, `lib/online-payment-fee.ts`, `lib/online-payment-landing.ts` `refundSponsorCard` and `applyCardDispute`, `lib/online-payment-endings.ts`), not from the plan.

**How to read this.** Each block below is the text to put in the published Payments Terms, in the Terms' own style. "Replaces" means the sentence in the 2026-11-24 file is changed, not added to. Everything not listed stays word for word. Sections are numbered as in the published file.

---

## §1. What these Payments Terms cover (replaces the definition of Payer)

"**Payer**" means a family, team, person or business that pays your organization online through FieldLogicHQ. A **sponsor** is a business or person that pays your organization for a sponsorship deal.

## §2. Who sells (replaces the first bullet's list)

- **Your organization is the seller.** When a payer pays online, they are paying your organization for your registration, program, team fee, tournament entry or sponsorship. The sale is between your organization and the payer. Receipts and the payer's card or bank statement show your organization's name.

(The second and third bullets stand. "We are not a party to the sale" is true of a sponsorship: the club issues its own invoice in its own name and GST/HST number, `lib/club-sponsor-invoice.ts`.)

## §4. The processing fee, and our fee (replaces one sentence, adds a block)

**Replaces** "your owners choose one of two settings for the whole organization:" **with** "your owners choose one of two settings for registrations, team fees and tournament entries (sponsorships have their own setting, below):".

**Adds, after the "Who pays it in the end is your choice" block:**

- **Sponsorships have their own setting.** If your organization uses Sponsorships, the Payouts card has a second row, "Processing fee on sponsorships". Your owners choose one of two settings, separate from the one above:
  - **your organization pays it** (the default): the business pays exactly what its invoice says, and the processing fee comes out of the payment as your organization's cost; or
  - **the business pays it:** your organization adds the processing fee to what the business pays by card, as its own charge, shown as "Processing fee", with GST/HST on it when the invoice carries tax. Your organization receives the full amount of the invoice.
- **When the business pays it, the setting counts only before an invoice exists.** On an invoice that has already been issued, your organization always pays the processing fee, whatever the setting says, and an issued invoice never gains a fee line. §9 applies to a processing fee that the business pays, in the same way as to a payer's.
- **Only a card payment adds a fee.** No processing fee is added to a sponsorship paid by cheque, e-transfer or cash. One case to know: if an invoice that already has a processing fee line becomes owing again (after a refund in your Stripe account, §6, or a lost dispute, §7), the line stays on the invoice, so the amount owing includes it however the business pays. If the business then pays by card, your organization pays the processing fee on that new payment.
- **This setting is not the tax on our fee.** The GST/HST on a processing fee the business pays is your organization's own charge to the business (§8). Any tax on our fee stays included in our fee (above).
- A change to the sponsorship setting applies to card pages opened after the change; a payment already made stays as it was.

(The existing bullets "Neither part is refunded…", "How it is paid" and "Changes to our rates" apply to a sponsorship card payment unchanged. The one exception in "Neither part is refunded" is for bank debits only; a sponsorship is card only, so it never applies.)

## §6. Refunds (adds a block under the existing bullets)

- **Refunding a sponsor.** Your organization decides each refund of a sponsorship, and makes it from the deal in FieldLogicHQ, with a reason, or in its own Stripe account. From the deal, you can refund all of what can go back or part of it. We do not decide refunds or make them on your behalf. Anyone at your organization who can open Sponsorships can refund from the deal, and can finish a refund made in Stripe.
- **The processing fee.** A refund from the deal never includes the processing fee or its GST/HST, including a fee that the business paid. A refund in your Stripe account can include it, after all of the sponsorship: what you refund there counts as sponsorship money first, and as the fee only once all of that payment's sponsorship money has gone back. Either way, neither part comes back to your organization (§4). Whether your organization returns a fee the business paid is between your organization and the business.
- **A refund made in your Stripe account.** A Stripe refund is recorded on the deal and in your books when Stripe confirms it. While Stripe is still sending it, the deal already shows it as on its way, and it counts against what you can refund from the deal. The credit note and the business's email wait until you finish the refund on the deal, with a reason. The business's sponsorship page lists the refund even before you finish it.
- **Whether the deal ends.** A refund from the deal that gives back the last of the deal's sponsorship money ends the deal. When a refund made in your Stripe account gives back the last of it, you choose as you finish it: "It has ended" or "They still owe it". If another payment on the deal still stands, the deal does not end. When all of one payment's sponsorship money has been refunded and the other payments no longer cover the invoice, the deal reads as owing again.
- **When you can choose "They still owe it".** Only once everything the business paid on that payment, the processing fee included, has been refunded, and only if no earlier refund on that payment has a credit note.
- **No credit note for money still owed.** When you finish a refund made in your Stripe account and it leaves the money owing again, because you chose "They still owe it" or because the remaining payments no longer cover the invoice, no credit note is issued for that refund, or for any later refund of that payment. The price of the sponsorship has not changed.
- **A refund after the bank has taken the payment back.** If you refund, in Stripe, a payment that the business's bank has already taken back through a dispute you lost (§7), we do not put the refund in your books and no credit note is issued, because that money is already out of them. We tell your organization that the business has been paid back twice. If you later win the dispute, we record the refund then, for you to finish.
- **What we send.** We email the business a notice of a refund, with your reason: for a refund from the deal, when it reaches the card; for a refund made in Stripe, when you finish it. When the invoice carried GST/HST, we also issue a credit note for the refund, in your organization's name, except as set out above. We can send the email only if your organization has a mailing address and a contact email for sponsors (the one in your sponsorship settings, or your public contact email) and the business has an email address on file. If the email cannot go, telling the business is up to your organization. When a refund leaves the invoice owing, the email and the business's sponsorship page say that it is still owing, and how much.
- **If a refund does not reach the card.** If the card company sends back a refund that is already in your books, we take it out of your organization's books and tell your organization in its notifications. A credit note issued for that refund is marked cancelled (its number is kept and never used again). If we had emailed the business about the refund, we also email it (on the same conditions as above) that the refund did not reach its card, and that the credit note is cancelled if there was one. A Stripe refund that fails before it reaches your books changes nothing in them. Your organization decides what to do next: refund again, or send the money another way and record it.
- **How long it takes.** A refund goes back to the card the business paid with. It can take 5 to 10 business days to appear, depending on the card company; we cannot say exactly when.
- **No refund while the card is disputed.** We will not make a refund of a card payment while the business's card company is disputing it (§7).
- **A payment the deal cannot take.** If a card payment arrives for a deal that has been withdrawn, or that was invoiced another way in the meantime, we do not record it, and the money stays in your organization's Stripe account. Your organization refunds it in Stripe. We remind your organization that it is there.

## §7. Disputes and returned bank debits (adds one bullet)

- **A dispute of a sponsor's card payment is answered in Stripe, and recorded in FieldLogicHQ.** For a sponsorship payment, FieldLogicHQ records the dispute and tells whoever at your organization opens Sponsorships when it opens and when it is decided. Your organization answers it in Stripe, under its agreement with Stripe; we cannot answer it for you. **If your organization loses it,** the amount Stripe takes back comes out of your organization's books in the same way as the payment went in, the deal returns to owing, and no credit note is issued, because your organization did not refund anyone and the business still owes the invoice. **If your organization wins it** after that, the payment is put back. We do not decide for your organization whether to ask the business to pay again or to withdraw the deal, and we do not adjust the GST/HST on an invoice that has been issued; your organization (with its accountant) decides how to treat the tax on an amount it does not recover. Neither part of the processing fee is returned (§4); Stripe's dispute fees come out of your organization's Stripe balance (§5). A dispute that covers only part of a payment, or a payment that was never recorded here, is not booked by us: we tell your organization so that it can record it.

(The existing first bullet "FieldLogicHQ can gather the facts of the payment for you to copy" is still true of registrations, team fees and tournament entries only: no sponsorship screen gathers the facts. Change it to end "…FieldLogicHQ can, for payments other than a sponsorship, gather the facts of the payment for you to copy, but cannot answer a dispute for you.")

## §9. Your organization's responsibilities (replaces the second bullet, adds two)

Your organization agrees to:
- take payments only for your own organization's registrations, programs, team fees, tournament entries and sponsorships;
- for a sponsorship, bill only a sponsorship the business has agreed to, and give the business the information that the law and the card networks expect you to give it, including your refund policy (which shows beside the card button) and, for a sponsor who is a person, your own privacy notice;
- follow the law and the card networks' rules for what you charge payers, **including the GST/HST on a sponsorship invoice and on any processing fee that a business pays**. **If you choose to have the business pay the processing fee, that is your organization's own charge to the business, and your organization is responsible for it being allowed.** It is a card payment's fee, and the card networks limit extra charges for paying by credit card.

## §10. Switching online payments off, and ending (replaces two sentences)

No text change (0.2; checked again for 0.4). A sponsor's dispute is recorded, so "Refunds and disputes of payments already made keep working in FieldLogicHQ" and "We will not delete an organization while money is still in motion: an open dispute…" are both true of a sponsorship, as published. (0.1 narrowed both; that is withdrawn.)

## §11. Information about payers (adds one sentence)

For a sponsorship payment, the payer is a business. Its card brand, last four digits and country come to us as described above; we also keep the email address the business typed on its sponsorship page, Stripe's reference numbers for the payment and for each refund, the receipt number, the amounts, and the reason your organization gives for a refund. For a refund made in your own Stripe account, we also keep when it was made and Stripe's reason code (we show the reason code to your organization only). They are part of your organization's Customer Data, handled as the Terms of Service (§4) and our Privacy Policy describe.

## §13. Changes to these Payments Terms (no text change)

Left as published. See "How this publishes" for what the new version asks of a club that has already agreed.

---

## Before this can be published

> NOTE — Owner material from here to the end; the preview and the page drop it.

**Before it publishes, 0.4 needs the owner's approval, and it goes only with the release that carries the refund made in the club's Stripe account** (migration 542, on dev): §6, §4's card-fee bullet and §11's last sentence about a Stripe refund describe that build. Released without it, they would be untrue.

**How this publishes (owner decision O-S1).** The product's Payments Terms are one frozen file per version (`lib/legal-documents/payments/<date>.md`, registered in `PAYMENTS_TERMS_VERSIONS` with its sha256; `PAYMENTS_TERMS_VERSION` in `lib/online-payment-words.ts` must equal the newest). The addendum is applied to a copy of the whole 2026-11-24 text and frozen as a new dated version; 2026-11-24 stays served at its own address (the card's "Read the terms" opens the version an owner agreed to). **Never edit the 2026-11-24 file** (the build fails).

**A new version is needed, and it is not just "clarifying".** The 2026-11-24 text names the seller's sale as "registration, program, team fee or tournament entry" (§2), limits what a club may take payments for to the same list (§9), and says the fee setting is "for the whole organization" (§4). A sponsor's card payment is outside all three. Moving `PAYMENTS_TERMS_VERSION` asks every connected club to agree again and emails its owners (the daily job), minor or not (`lib/online-payment-owner-notices.ts`, `lib/payments-terms-agreement.ts`).

**The ordering that costs nothing:** publish this version **before the first production club connects**, in the release that carries the sponsor's card payment. Online payments have been switched on in production since 2026-11-24, so a club can connect on any day; on 2026-11-25 production holds 0 payout accounts and 0 agreements (counts only), so today nobody would be asked twice and nobody has agreed to a text that leaves sponsorships out. **Count both again on release day.** If it publishes after clubs have agreed to 2026-11-24, treat it as a change that adds a new default cost (our fee on sponsor card payments, the club paying by default) and widens what the club may do, so under §13 it needs **30 days' email notice**, not "when we post". The reason is in the code: there is no separate sponsorship switch. A connected club whose account takes payments, with the launch switch on and a refund policy, gets the sponsor's card button on every deal without any step of its own (`lib/sponsor-card-server.ts` `sponsorCardFacts`).

**The Privacy and Terms versions move with it** (the build refuses a Privacy version older than the Payments Terms in force). Their drafts: `PRIVACY_POLICY_SPONSORSHIP_ADDENDUM.md` and `TERMS_SPONSORSHIP_ADDENDUM.md` (Terms §4 plus one Data Terms §11 bullet). **§3 of these terms needs no change:** the list of what a club sells is in §2 as published.

**Who accepts.** The club's owner, at the Payouts card (the "Before you set up payouts" tick, or the "new payments terms" window), as for 2026-11-24. **The business that pays by card accepts none of our terms**, and should not be shown them: FieldLogicHQ is not the seller, and a link to our terms on the club's page would suggest it is. The business sees the club's own refund policy and, if the club set one, the club's own privacy link (`components/public/SponsorDealContent.tsx` `RefundPolicy`, `Foot`); Stripe's page carries Stripe's own notice.

**Owner decisions.**
- O-S1. ANSWERED 2026-11-25: publish in the release that carries sponsor card payments and Offer again, with the Privacy, Terms and Data Terms versions on one date. Count connected clubs that day; if one has agreed to 2026-11-24, stop (30 days' email notice).
- O-S2. ANSWERED 2026-11-24 (owner, walk §564 call (b): "build a notice and the books reversal first"): the product records a sponsor's dispute, raises a notice, and books a loss; §7 now says so (0.2).
- O-S3. ANSWERED 2026-11-24 (owner: "do the O-S7 wording pass"): the product says "It can take 5 to 10 business days to appear, depending on the card company."; §6 says the same (0.3).
- O-S4. FALLS AWAY (0.2): §10 is no longer narrowed.

## For a lawyer's eye

- **§7, the dispute bullet (0.2).** The product now tells the club of a sponsor's dispute, and books a lost one, but does not promise to catch every case (a part dispute, an unrecorded payment): the bullet says so. A lawyer could read whether "we tell whoever at your organization opens Sponsorships" is a promise stronger than the product can keep when nobody holds that seat, and the GST/HST sentence ("we do not adjust the GST/HST on an invoice that has been issued") is a statement about the club's tax that the club's accountant owns.
- **§6, a refund that does not reach the card (0.2).** The cancelled credit note: the product keeps the note, marks it cancelled, never reuses its number, and tells the business. Whether that is the right way to withdraw a credit note that reduced GST/HST is for the club's accountant (see the topic file's 2026-11-24 addendum).
- **§4 and §9, the business-pays fee.** A processing fee passed to a business is the club's charge, and the card rate can exceed the card networks' surcharge ceiling if it is read as a surcharge (2.4%, no more than the cost of acceptance, none in Québec); GST/HST is charged on it. Whether it is a surcharge or a service fee is unsettled (`CARD_SURCHARGE_PAYER_FEE.md`). The default is "the club pays", which keeps it out of the common case.
- **§6, asking for refunded money again (0.4).** "They still owe it" follows a refund of everything the business paid on a payment, and then asks it for the invoice again, with no credit note. The product says so in the refund email and on the business's page. A lawyer could read whether the club may ask again for money it chose to refund, and what it must tell the business.
- **§4, a processing fee line on an invoice owing again (0.4).** The line stays and can be paid by cheque or e-transfer, so the club would collect a "Processing fee" on a payment with no card cost (a product question for `/plan`; `/accounting` flags it too).
- **§6, a refund from the deal beside another payment (0.4).** When one payment is refunded in full from the deal and what remains no longer covers the invoice, the deal reads owing again and a credit note is still issued. This is the opposite of the Stripe-account rule; an open follow-up for `/plan` (accounting topic file, 2026-11-26).
- **§6, no fee refund.** A business that paid a fee on a deal that is then fully refunded from the deal gets everything back but the fee (the club can include it only by refunding in its Stripe account), and the card page does not say so before it pays (it says so in the refund email). The exposure sits with the club (its own representation to its sponsor), not with us; whether the page should say it first is O-S5 in the topic file.
- **§2 and §6, an individual sponsor.** If the payer is a person, a family or a sole proprietor rather than a business, consumer rules for internet agreements may apply to the club (`ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md`, backlog L17). The club's obligations, not ours; the draft puts the information duty on the club in §9.
- **§12 (unchanged), the cost-cover clause** now reaches claims by a sponsor about a sponsorship's refunds and the fee passed to it. Same language, wider cases.
- **Money-services status** is unchanged by this change (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`): a direct charge on the club's account, our fee taken at the payment, nothing held.
