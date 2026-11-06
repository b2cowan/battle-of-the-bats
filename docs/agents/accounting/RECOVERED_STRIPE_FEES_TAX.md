# GST/HST on Stripe fees FieldLogicHQ recovers from a club
**Last verified:** 2026-11-05
**Re-verify by:** 2027-11-05, or when counsel or a professional answers D1 (is the payment service a taxable supply or an
exempt financial service), when the Stripe fee payer changes (Stripe billing the club's own account instead of the platform),
or when online payments are switched on in production
**Depends on facts:** registered for GST/HST (2026-10-31); the payment model in `PLATFORM_FEE_TAX_TREATMENT.md`; Stripe bills
these fees to **FieldLogicHQ's platform account** and FieldLogicHQ bills the club "only what Stripe charged us" (owner ruling,
Club Tier 12d-1); owner ruling T2 (plan) taxes the payment fee on top; Stage 2 Ask 3 (2026-11-05) taxes the recovered fees on top

## Question(s) this answers
- When FieldLogicHQ re-bills a club for a Stripe fee its online payments caused (a returned or reversed debit, a dispute, the
  foreign-card extra), is that amount consideration for FieldLogicHQ's own supply (taxed) or a disbursement (not taxed)?
- At what rate, on which invoice, and what does a credit note have to do?

## Finding
- **The test is agency.** A reimbursement is outside GST/HST only when the supplier paid the third party **as the recipient's
  agent**, for a supply the third party made **to the recipient** (P-182R; GI-012; P-209R "incurred as agent" vs "not incurred
  as agent"; GI-197). An expense the supplier incurs **for itself** and bills on is part of the consideration for the
  supplier's own supply, taxed at that supply's rate, and the supplier claims the ITC on any tax it paid.
- **Here the fee is FieldLogicHQ's own cost.** Stripe charges the platform account under FieldLogicHQ's contract with Stripe;
  the club is not Stripe's customer for that fee and FieldLogicHQ does not act as its agent. So the recovery is **consideration
  for FieldLogicHQ's payment service to the club**, and it takes **the same tax status as the online-payment fee**: taxable at
  the club's province rate if that service is taxable (the plan's T2 position), exempt with it if the service is ever held to be
  an exempt financial service (D1, still open in `PLATFORM_FEE_TAX_TREATMENT.md`). The two must never diverge.
- **The base is Stripe's fee before any tax Stripe charged us.** If Stripe's invoice to FieldLogicHQ carries GST/HST, FieldLogicHQ
  claims it as an ITC and re-bills the pre-tax fee, then charges its own tax on top. Re-billing a tax-included amount and taxing
  it again would tax the tax.
- **Place of supply** follows the club (the person liable to pay, Memo 3-3-6) — the address on the club's Stripe customer,
  the same as its subscription. A US club: zero-rated, as its subscription.
- **Credit notes:** a credit for a returned answering fee reduces consideration already taxed, so the tax is reversed with it,
  and the document the club receives must be a credit note showing the tax adjusted (ETA s.232). In Stripe, a credit note against
  the invoice line reverses that line's tax; a refund linked to a credit note keeps the tax reduction even if the refund fails;
  an unlinked refund's reduction holds only if the refund succeeds.
- **A fee that waits unbilled is not tax-free while it waits** (added 2026-11-05, Stage 2 Part 2b). Tax is payable when
  consideration becomes due (ETA s.168(1)), and s.152(1) makes it due on the EARLIEST of (a) the invoice's issue date or date,
  **(b) "the day the supplier would have, but for an undue delay, issued an invoice"**, and (c) the day a written agreement
  requires payment. A club's fees held back because it has no billing address (the `NO_ADDRESS` wait) would have gone on that
  month's fee invoice, so a long wait risks (b): the tax counts as owing in the period the invoice would have gone out, at a
  province we cannot yet name. Once the payments terms say when fees are due, (c) bites the same way. Part 2b makes this an
  edge case (every connect now needs the address; production had 0 payout accounts on 2026-11-05) — it is the reason the wait
  must stay short, not a reason to bill untaxed.

- **⚠ The Stripe tax code decides the place of supply Stripe uses, and "General - Services" gets it wrong** (added 2026-11-05,
  Stage 2 Part 6, test mode). Stripe Tax sources `txcd_20030000` ("General - Services") by **origin** in Canada: every club is
  charged our head office's Ontario HST 13% — an Alberta/BC/Saskatchewan/Québec club 13% instead of 5% GST, a Nova Scotia club
  13% instead of 14%, New Brunswick 13% instead of 15%, and a US club 13% instead of zero-rated
  (`.probe/gst2/part6-fee-code-run1.txt`, `part6-fee-code-2-run1.txt`; through the product's own billing code
  `part6-fees-run1.txt`, `part6-fees-sk-run1.txt`). That contradicts the place-of-supply finding above (the club's address).
  `txcd_90050001` ("Platform Fee": "a fee charged by an online marketplace or platform operator to businesses for facilitating
  the distribution, discovery, or sale of the seller's goods, services…"), `txcd_10000000` (General - Electronically Supplied
  Services) and `txcd_20060051` (Credit Card Processing Services) are all **destination**-sourced and standard-rated: 5 / 13 /
  14 / 15 by the club's province, GST only in Québec, US 0 (not collecting).

- **Stripe does not charge GST/HST on its payment-processing fees** (added 2026-11-05, Stage 2 Part 6): "Payment processing fees
  charged to you by Stripe will be tax exempt"; GST/HST is charged on its SaaS products (Billing, Radar, Tax, Sigma) and Terminal
  hardware, on a monthly tax invoice under Settings → Plans and fees → Invoice history, by the 10th of the next month
  ([Stripe](https://support.stripe.com/questions/taxes-on-stripe-fees-for-businesses-based-in-canada), accessed 2026-11-05). So the
  dispute, returned-debit and foreign-card fees we recover carry no Stripe tax: the "net of Stripe's tax" base is the fee itself
  (item 2 below holds, with nothing to strip). ⚠ Bears on **D1**: Stripe treats its own processing as an exempt financial service —
  a professional should weigh that before confirming our payment service is taxable (T2). The owner's live-account check (are there
  tax invoices, for which fees) is still owed.

## Recommendation (for Stage 2 Part 2)
1. Give every recovered-fee invoice item an explicit `tax_behavior: 'exclusive'` and an explicit Stripe tax code (do not rely on
   the account's SaaS preset, which describes the subscription, not a fee recovery). On a subscription invoice it is then taxed
   with it; the club's own monthly fee invoice turns on automatic tax. **Corrected 2026-11-05 (Part 6): the code is
   `txcd_90050001` "Platform Fee", NOT `txcd_20030000` "General - Services"** (origin-sourced; see the finding). "Platform Fee"
   describes what the club is paying for (FieldLogicHQ's payment service as the platform), is destination-sourced like the
   subscription, and is the code the **online-payment fee itself** should carry when it is taxed, so T2's "never diverge" holds
   by one constant. Not "Credit Card Processing Services": it names a financial service and would pre-judge D1.
2. Record the fee **net of any tax Stripe charged FieldLogicHQ** (check one Stripe fee invoice in test and live: does Stripe
   charge GST/HST on dispute and debit-return fees?).
3. Credits: credit the original invoice line (never a free-standing negative amount) so Stripe reverses its tax; the club's credit
   is the fee plus its tax.
4. Keep the fee and the recoveries on one switch: if D1 is ever answered "exempt", both lose tax together.

5. **Display wording (reviewed 2026-11-06, Fee invoice alerts Part 5).** The banner and page line quote the invoice **total, tax
   included** — the same figure the Pay invoice button collects — so no screen shows a number that differs from the payment. The
   list shows tax as its own line under the fees, in Stripe's own rate name, with a neutral "Tax" fallback; no screen names a
   rate that could be wrong in another province. ⚠ One tension, pre-existing and not changed by the alerts: the list's lead
   ("Stripe charges these fees… FieldLogicHQ passes them on") is pass-through language, while this file's finding is that the
   recovery is consideration for our own service, taxed on top. A club's accountant may ask why tax sits under a "passed on"
   fee. It rides D1; reword the lead (to /marketing) if D1 is answered "taxable", leave it if "exempt".

## Sources
- [Excise Tax Act s.152 — when consideration becomes due](https://laws-lois.justice.gc.ca/eng/acts/E-15/section-152.html) — accessed 2026-11-05
- [CRA P-182R — Agency](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/p-182r/agency.html) — accessed 2026-11-05
- [CRA GI-012 — Agents](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-012/agents.html) — accessed 2026-11-05
- [CRA P-209R — Lawyers' disbursements](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/p-209r/lawyers-disbursements.html) — accessed 2026-11-05
- [CRA GI-197 — Out-of-pocket expenses](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-197/out-of-pocket-expenses.html) — accessed 2026-11-05
- [Stripe — Refunds and credit notes (Stripe Tax)](https://docs.stripe.com/tax/invoicing/refunds) — accessed 2026-11-05

## Professional sign-off needed?
Yes, but no new question: it rides on D1 (taxable vs exempt payment service). The agency finding itself is a straightforward
application of CRA's published test to the fact that Stripe bills FieldLogicHQ.
