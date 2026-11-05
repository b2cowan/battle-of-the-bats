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

## Recommendation (for Stage 2 Part 2)
1. Give every recovered-fee invoice item an explicit `tax_behavior: 'exclusive'` and an explicit Stripe tax code for a general
   service (verify the code in Stripe's list; do not rely on the account's SaaS preset, which describes the subscription, not a
   fee recovery). On a subscription invoice it is then taxed with it; the club's own monthly fee invoice turns on automatic tax.
2. Record the fee **net of any tax Stripe charged FieldLogicHQ** (check one Stripe fee invoice in test and live: does Stripe
   charge GST/HST on dispute and debit-return fees?).
3. Credits: credit the original invoice line (never a free-standing negative amount) so Stripe reverses its tax; the club's credit
   is the fee plus its tax.
4. Keep the fee and the recoveries on one switch: if D1 is ever answered "exempt", both lose tax together.

## Sources
- [CRA P-182R — Agency](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/p-182r/agency.html) — accessed 2026-11-05
- [CRA GI-012 — Agents](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-012/agents.html) — accessed 2026-11-05
- [CRA P-209R — Lawyers' disbursements](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/p-209r/lawyers-disbursements.html) — accessed 2026-11-05
- [CRA GI-197 — Out-of-pocket expenses](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-197/out-of-pocket-expenses.html) — accessed 2026-11-05
- [Stripe — Refunds and credit notes (Stripe Tax)](https://docs.stripe.com/tax/invoicing/refunds) — accessed 2026-11-05

## Professional sign-off needed?
Yes, but no new question: it rides on D1 (taxable vs exempt payment service). The agency finding itself is a straightforward
application of CRA's published test to the fact that Stripe bills FieldLogicHQ.
