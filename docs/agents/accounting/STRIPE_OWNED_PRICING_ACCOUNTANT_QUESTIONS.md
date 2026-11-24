# Questions for the owner's accountant — the online-payment fee under Stripe-owned pricing
**Prepared:** 2026-11-17 (owner ruling R2: these go to the accountant before online payments switch on in production)
**Re-verify by:** when the accountant answers; or if the fee design changes
**Depends on facts:** registered for GST/HST, annual filer, regular method (owner, 2026-10-31 / 2026-11-06); R1 (GST/HST is
**included** in our fee, no tax line to clubs); T3 (the fee is FieldLogicHQ's charge to the club); rate design A; Stripe-owned
pricing ([plan](../../projects/active/STRIPE_OWNED_PRICING_PLAN.md))

This is research and a question list. It is not a tax opinion. Nothing here blocks building; the owner decides what waits for
an answer.

## The facts to hand over (same for every question)
- A club (a minor-sports organization) takes registrations and fees online through FieldLogicHQ. The payment is a **direct
  charge on the club's own Stripe account**. The club is Stripe's customer and is the merchant. Stripe charges the club
  directly for processing (card 2.9% + $0.30; bank debit 1% + $0.40, capped at $5), for disputes, returned debits and
  foreign cards. Stripe says its own processing fees are tax exempt.
- FieldLogicHQ takes an **application fee** on each payment. Stripe withholds it at the moment of the charge and moves it to
  our balance. We do not move the club's money, hold it, or process the card. The fee is our charge to the club for the
  platform (registration, payments set-up, records), set as the family-facing fee (card 3.5% + $1.50, bank debit 2.5% + $1.00)
  less Stripe's standard cost. So it is roughly 0.6% + $1.20 on a card payment, and more on a bank debit.
- The family sees one fee line. It does not see tax. The club's own books show our fee as a line on each payment.
- The club's province decides the rate (HST 13/14/15% or GST 5%); a US club is 0%.
- A returned bank debit automatically refunds our fee to the club. A refund the club gives on its own sale does not refund our
  fee.
- We issue **no invoice per fee**. Stripe's payout report and the club's Stripe dashboard list each application fee. We could
  produce a monthly statement.
- **Added 2026-11-18 (Stage 4 built):** we also issue **no other fee document**. The monthly invoice of Stripe's extras (disputes,
  returned debits, foreign cards) is gone, because Stripe now charges those to the club's own account. So the application fee is the
  only fee we charge a club on a payment, and Question 2c is the only place a fee document is in question. Production never
  issued a fee invoice (0 on 2026-11-18); there is nothing from the old design for the accountant to review.
- Stripe does not calculate or report tax on application fees. Our own records are the source for the return.
- **Added 2026-11-18 (Payments Terms v0.2 §4, for Question 1):** the customer-facing terms call the family-facing amount a
  "processing fee" made of two parts, Stripe's fee and **our fee**, which they describe as our charge for the pay page, receipts
  in the club's name and recording each payment, set so the two parts equal the processing fee at Stripe's standard prices.
  Show the accountant this wording: calling our part a share of a "processing fee" is a fact that bears on D1. The terms say
  only that any sales tax that applies is included in our fee, so they hold whichever way D1 is answered.
  **Published 2026-11-23 as Payments Terms version 2026-11-24** (`lib/legal-documents/payments/2026-11-24.md`), §4 and §5
  word for word as v0.2; `/accounting` re-read the fee sentences that day against the R1 method: consistent, nothing to change.
  The terms promise no tax receipt or fee statement, so Question 2c's answer is not a promise we could break. D1 is still a
  before-switch-on item, not a publishing gate.

## Question 1 (first): taxable or exempt? (D1)
Is our application fee a **taxable supply** of a platform service to the club, or an **exempt financial service** (arranging for
a payment, para (l) of "financial service" in ETA s.123(1)), or something else?

Facts that bear on it:
- Stripe, not us, does the payment processing, and Stripe treats its own processing as exempt.
- We take a percentage of the payment, which looks like a financial fee, but we do not process, hold or move funds; the fee
  pays for the registration platform and the connection to Stripe. Under Stripe-owned pricing no Stripe cost is bundled in, so
  the fee is margin on the platform only.
- The fee is charged on every payment but is not available without our software. Stripe's own tax code for it is "Platform Fee"
  (taxed like a digital service, by the club's address).
- The 2023 change to "financial service" para (r.6) takes only card-network services out of it, and says nothing about
  platforms. No CRA document we found speaks to a SaaS platform's percentage fee.
- We already charge GST/HST on the subscription, which is plainly taxable.
- The practical stake: if exempt, we charge no tax on the fee and claim no ITCs related to it; if taxable, the 13/113 (etc.)
  comes out of our margin (about 11.5% of the fee at 13%).

What we need back: taxable, exempt, or "ask CRA", and if you would ask CRA (GST/HST Rulings), whether to do so before
launch.

## Question 2: remittance, tax point and documents for a fee withheld at payment
Because the tax is **included** and Stripe withholds the fee at the charge, there is no invoice.
a. **Tax point.** We plan to count the tax in the period the fee is taken (the charge date), on lines 101 (fee less tax) and
   103 (tax). Is that right, including for a bank debit whose fee appears on our balance when the debit starts and settles days
   later (a December 30 debit settling January 3)? Our reading: the fee is paid when Stripe withholds it (ETA s.152, s.168).
b. **Calculation.** We compute the tax per fee as fee x 13/113 (or 14/114, 15/115, 5/105), rounded to the cent, and add
   them. Is rounding per fee acceptable, or should the period total be computed once?
c. **The document.** A GST-registered club may want to claim an input tax credit on the tax inside our fee. What document or
   record satisfies the Input Tax Credit Information Regulations when we issue no invoice per fee? The tiers we know: under
   $100, supplier name, date, total; $100 to $499.99 add the tax (or that the price includes it) and our registration number;
   $500 and over add the club's name, a description and payment terms. Does a **monthly statement** we issue to the club,
   listing each fee with its date, amount, the tax included and our number, satisfy it? Does the Stripe payout report or
   dashboard line, together with the statement, count? Most youth clubs are exempt or unregistered, so this will be rare, but
   a registered club will ask.
d. **Refunds of our fee.** When a returned debit refunds our fee, we plan to reverse the fee and its tax by a credit line on
   that statement and in our records, and to reduce net tax only when that record exists (ETA s.232). Is a statement credit line
   enough, or must it be a credit note in a particular form?
e. **Missing province.** If a payment arrived before we knew the club's province, what rate applies? (We plan to require the
   billing address before a club can take its first payment, so this should not happen.)

## Question 3: US club zero-rating
A US club (US billing address, US payout account verified by Stripe) pays the same fee. We plan to charge it 0% (ETA Sch. VI
Pt V s.7, services to a non-resident).
- Is our three-part evidence rule enough, recorded with a date: (1) a US business address, (2) a tick-box that the
  organization is managed and controlled outside Canada and is not registered for GST/HST, (3) the country Stripe verified on the
  payout account? (This is the same rule as for the subscription in `ZERO_RATED_SALES_TO_US_CUSTOMERS.md`.)
- A US club's fee would be in US dollars: confirm the Bank of Canada rate on the **charge date** for lines 101.
- Does the zero-rating hold when the **payers** are Canadian families or Canadian teams (we treat the club as the recipient, T3)?
- Any difference if a US club's event takes place in Canada?

## Also, if you have time
- **Québec and the PST provinces.** Our fee to a Québec club: GST only, or QST too (we hold no QST registration)? Does BC, SK
  or MB retail sales tax reach the fee or the subscription?
- **Registration threshold.** The fee counts as revenue toward the $30,000 small-supplier amount, but we are registered
  already; confirm nothing else changes.

## Sources
- [Excise Tax Act s.123(1) "financial service"](https://laws-lois.justice.gc.ca/eng/acts/e-15/section-123.html), [s.152](https://laws-lois.justice.gc.ca/eng/acts/E-15/section-152.html) — accessed 2026-11-05
- [CRA RC4022, General Information for GST/HST Registrants](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html) (tax point, invoice tiers, tax fractions) — accessed 2026-11-17
- [Stripe, taxes on Stripe fees for businesses in Canada](https://support.stripe.com/questions/taxes-on-stripe-fees-for-businesses-based-in-canada) — accessed 2026-11-05
- Related files: `PLATFORM_FEE_TAX_TREATMENT.md` (D1 background), `PLATFORM_FEE_TAX_COLLECTION_METHOD.md` (the R1 method),
  `ZERO_RATED_SALES_TO_US_CUSTOMERS.md`, `CREDIT_NOTES_ON_REFUNDS.md`, `GST_HST_RETURN_LINES.md`.

## Professional sign-off needed?
**Yes, this is the sign-off.** D1 first. Questions 2 and 3 apply our own earlier research and are lower risk, but the
document question (2c) and the US evidence rule (3) have not been seen by a professional.
