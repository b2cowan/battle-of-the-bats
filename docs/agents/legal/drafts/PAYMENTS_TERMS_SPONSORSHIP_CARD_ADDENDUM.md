# DRAFT — Payments Terms: the sponsorship card payment addendum

| | |
|---|---|
| **Version** | 0.1 (an addendum to the published Payments Terms version 2026-11-24; becomes a whole new frozen text, see "How this publishes") |
| **Status** | draft. Not owner-approved. Not reviewed by a lawyer. The live Payments Terms page and every version constant are untouched. |
| **Effective date** | none yet (a new dated version: the day it is promoted or later; never reuse 2026-11-24) |
| **Last reviewed** | 2026-11-23 (`/legal`, against the code on dev, Board Ready Stage 6 Part 3b) |
| **Seller** | the owner, trading as FieldLogicHQ, Ontario (`docs/agents/accounting/ACCOUNTING_FACTS.md`) |

**Change log**
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
- **Only a card payment carries a fee.** A sponsorship paid by cheque, e-transfer or cash carries no processing fee.
- **This setting is not the tax on our fee.** The GST/HST on a processing fee the business pays is your organization's own charge to the business (§8). Any tax on our fee stays included in our fee (above).
- A change to the sponsorship setting applies to card pages opened after the change; a payment already made stays as it was.

(The existing bullets "Neither part is refunded…", "How it is paid" and "Changes to our rates" apply to a sponsorship card payment unchanged. The one exception in "Neither part is refunded" is for bank debits only; a sponsorship is card only, so it never applies.)

## §6. Refunds (adds a block under the existing bullets)

- **A sponsor's card payment is refunded from the deal.** Your organization decides each refund of a sponsorship and makes it from the deal in FieldLogicHQ, for all of what can go back or for part of it, with a reason. We do not decide refunds or make them on your behalf. Anyone at your organization who can open Sponsorships can make one.
- **A refund of a sponsorship never includes the processing fee**, including a processing fee that the business paid, or the GST/HST on that fee. Neither part of the processing fee comes back (§4). Whether your organization makes the business whole for a fee it paid is between your organization and the business, and is not done through the refund FieldLogicHQ makes.
- **What we send.** When a refund reaches the card, we email the business a notice of it, with your reason, and, when the invoice carried GST/HST, a credit note for that refund, in your organization's name. Refunding everything that was paid ends the deal.
- **How long it takes.** A refund goes back to the card the business paid with. When it appears on the business's statement is up to the card company and its bank. We cannot say when.
- **No refund while the card is disputed.** We will not make a refund of a card payment while the business's card company is disputing it (§7).
- **A refund made in your own Stripe account** is not recorded by FieldLogicHQ. We remind your organization to record it in its own books; we do not record it for you.
- **A payment the deal cannot take.** If a card payment arrives for a deal that has been withdrawn, or that was invoiced another way in the meantime, we do not record it, and the money stays in your organization's Stripe account. Your organization refunds it in Stripe. We remind your organization that it is there.

## §7. Disputes and returned bank debits (adds one bullet)

- **A dispute of a sponsor's card payment is handled in Stripe, and only there.** For a sponsorship payment, FieldLogicHQ does not record the dispute, does not raise a notice about it, does not gather its facts, and does not book the amount Stripe takes back; the deal stays marked as paid. Stripe tells your organization under its own agreement with Stripe. Your organization decides whether to answer it in Stripe, and corrects the deal and its books itself if the dispute is lost. Neither part of the processing fee is returned (§4); Stripe's dispute fees come out of your organization's Stripe balance (§5).

(The existing first bullet "FieldLogicHQ can gather the facts of the payment for you to copy" is true of registrations, team fees and tournament entries only. Change it to end "…FieldLogicHQ can, for payments other than a sponsorship, gather the facts of the payment for you to copy, but cannot answer a dispute for you.")

## §9. Your organization's responsibilities (replaces the second bullet, adds two)

Your organization agrees to:
- take payments only for your own organization's registrations, programs, team fees, tournament entries and sponsorships;
- for a sponsorship, bill only a sponsorship the business has agreed to, and give the business the information that the law and the card networks expect you to give it, including your refund policy (which shows beside the card button) and, for a sponsor who is a person, your own privacy notice;
- follow the law and the card networks' rules for what you charge payers, **including the GST/HST on a sponsorship invoice and on any processing fee that a business pays**. **If you choose to have the business pay the processing fee, that is your organization's own charge to the business, and your organization is responsible for it being allowed.** It is a card payment's fee, and the card networks limit extra charges for paying by credit card.

## §10. Switching online payments off, and ending (replaces two sentences)

- **Replaces** "Refunds and disputes of payments already made keep working in FieldLogicHQ." **with** "Refunds of payments already made keep working in FieldLogicHQ, and so do disputes of payments other than a sponsorship. A dispute of a sponsorship payment is only in Stripe (§7)."
- **Replaces** "We will not delete an organization while money is still in motion: an open dispute, or a bank debit still clearing." **with** "We will not delete an organization while money is still in motion that we can see: an open dispute of a registration, team or tournament payment, or a bank debit still clearing. We cannot see a dispute of a sponsorship payment, so it does not hold up a deletion."

## §11. Information about payers (adds one sentence)

For a sponsorship payment, the payer is a business. Its card brand, last four digits and country come to us as described above; we also keep the email address the business typed on its sponsorship page, Stripe's reference numbers for the payment and for each refund, the receipt number, the amounts, and the reason your organization gives for a refund. They are part of your organization's Customer Data, handled as the Terms of Service (§4) and our Privacy Policy describe.

## §13. Changes to these Payments Terms (no text change)

Left as published. See "How this publishes" for what the new version asks of a club that has already agreed.

---

## Before this can be published

> NOTE — Owner material from here to the end; the preview and the page drop it.

**How this publishes (owner decision O-S1).** The product's Payments Terms are one frozen file per version (`lib/legal-documents/payments/<date>.md`, registered in `PAYMENTS_TERMS_VERSIONS` with its sha256; `PAYMENTS_TERMS_VERSION` in `lib/online-payment-words.ts` must equal the newest). The addendum is applied to a copy of the whole 2026-11-24 text and frozen as a new dated version; 2026-11-24 stays served at its own address (the card's "Read the terms" opens the version an owner agreed to). **Never edit the 2026-11-24 file** (the build fails).

**A new version is needed, and it is not just "clarifying".** The 2026-11-24 text names the seller's sale as "registration, program, team fee or tournament entry" (§2), limits what a club may take payments for to the same list (§9), and says the fee setting is "for the whole organization" (§4). A sponsor's card payment is outside all three. Moving `PAYMENTS_TERMS_VERSION` asks every connected club to agree again and emails its owners (the daily job), minor or not (`lib/online-payment-owner-notices.ts`, `lib/payments-terms-agreement.ts`).

**The ordering that costs nothing:** publish this version **before the first production club connects**. On 2026-11-23 production holds 0 payout accounts and 0 agreements, so nobody is asked twice and nobody agreed to a text that leaves sponsorships out. If it publishes after clubs have agreed to 2026-11-24, treat it as a change that adds a new default cost (our fee on sponsor card payments, the club paying by default) and widens what the club may do, so under §13 it needs **30 days' email notice**, not "when we post". The reason is in the code: there is no separate sponsorship switch. A connected club whose account takes payments, with the launch switch on and a refund policy, gets the sponsor's card button on every deal without any step of its own (`lib/sponsor-card-server.ts` `sponsorCardFacts`).

**The Privacy version moves with it** (the index records that the build refuses a Privacy version older than the Payments Terms in force). The Privacy text owes the same publish: §5 a sponsors bullet, §6 the Stripe row ("the payer's email, card, what is being paid for and the player names" and "the payment is between the family and the club" both leave out a business payer), §9 the retention sentence, §12 the sponsorship-offer unsubscribe sentence (`BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md` §5). Terms and Data Terms: no change needed; "sponsors" can join the Customer Data list at the next Terms version (it says "including").

**Who accepts.** The club's owner, at the Payouts card (the "Before you set up payouts" tick, or the "new payments terms" window), as for 2026-11-24. **The business that pays by card accepts none of our terms**, and should not be shown them: FieldLogicHQ is not the seller, and a link to our terms on the club's page would suggest it is. The business sees the club's own refund policy and, if the club set one, the club's own privacy link (`components/public/SponsorDealContent.tsx` `RefundPolicy`, `Foot`); Stripe's page carries Stripe's own notice.

**Owner decisions.**
- O-S1. Publish this as a new Payments Terms version before switch-on (recommended), with the Privacy version.
- O-S2. The §7 sponsorship-dispute bullet says what the product does (nothing). If you would rather the product raised a notice for a sponsor's dispute, that is a build for `/plan`, and the bullet then changes. Either is honest; the silent version is the ruled design.
- O-S3. §6 "We cannot say when" (a recommendation: the product's current "5 to 10 business days" is a card-network time, not a promise we can keep; see the topic file `BOARD_READY_STAGE6_PART3B_CARD_REVIEW.md` §4).
- O-S4. §10 narrows two published sentences for sponsorships only. They are narrowings of a promise, which only helps the customer's expectations; no notice owed beyond the new version's.

## For a lawyer's eye

- **§7, the dispute bullet and §10's narrowed deletion sentence.** The product stays silent on a sponsor's chargeback by design. The terms say so rather than promise a notice. A lawyer could read whether a club that never reads Stripe's emails can say it was not told by us; the text says we do not tell it.
- **§4 and §9, the business-pays fee.** A processing fee passed to a business is the club's charge, and the card rate can exceed the card networks' surcharge ceiling if it is read as a surcharge (2.4%, no more than the cost of acceptance, none in Québec); GST/HST is charged on it. Whether it is a surcharge or a service fee is unsettled (`CARD_SURCHARGE_PAYER_FEE.md`). The default is "the club pays", which keeps it out of the common case.
- **§6, no fee refund.** A business that paid a fee on a deal that is then fully refunded gets everything back but the fee, and the card page does not say so before it pays (it says so in the refund email). The exposure sits with the club (its own representation to its sponsor), not with us; whether the page should say it first is O-S5 in the topic file.
- **§2 and §6, an individual sponsor.** If the payer is a person, a family or a sole proprietor rather than a business, consumer rules for internet agreements may apply to the club (`ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md`, backlog L17). The club's obligations, not ours; the draft puts the information duty on the club in §9.
- **§12 (unchanged), the cost-cover clause** now reaches claims by a sponsor about a sponsorship's refunds and the fee passed to it. Same language, wider cases.
- **Money-services status** is unchanged by this change (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`): a direct charge on the club's account, our fee taken at the payment, nothing held.
