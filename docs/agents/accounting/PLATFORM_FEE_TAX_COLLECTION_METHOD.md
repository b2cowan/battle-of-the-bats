# How the GST/HST on the online-payment fee is collected — at payment time vs a monthly statement

> **⚠ Owner ruling 2026-11-17 (R1) overtakes the recommendation below.** The tax is **included in our fee** and paid out of
> our share: neither (a) nor (b). The finding still applies: the tax base is the whole fee we charge, there is no ITC on
> Stripe's exempt processing fee, and the tax must reach lines 101/103 with a valid invoice available on request. Under R1
> the December tax-point question goes away, because the tax is counted when the fee is taken. Re-verify when the fee
> becomes margin only ([STRIPE_OWNED_PRICING_PLAN.md](../../projects/active/STRIPE_OWNED_PRICING_PLAN.md)).
**Last verified:** 2026-11-17
**Re-verify by:** 2027-11-17, or when D1 is answered (taxable vs exempt), when Stripe Tax starts to tax application fees, when
the first US club connects a payout account, or when online payments are switched on in production
**Depends on facts:** registered for GST/HST (2026-10-31), **annual filer** (2026-11-06), regular method; owner rulings T2
(tax on top of the fee, billed to the club; US club 0%; stops if the fee is ruled exempt) and T3 (the fee is always
FieldLogicHQ's charge to the club); the model in `PLATFORM_FEE_TAX_TREATMENT.md`; the monthly fee invoice already built
(`RECOVERED_STRIPE_FEES_TAX.md`, tax code `txcd_90050001`); Stripe Tax does not tax application fees

## Question(s) this answers
- (a) Add the tax to the application fee at payment time, or (b) bill it monthly on a statement (a line on the existing
  monthly Stripe-fees invoice)?
- What does a valid invoice for it need, and how does each choice land in Bookkeeping and the return (Stage 4)?
- When does the tax become payable if the fee is taken before the statement exists?

## Finding
- **(a) has no document and no rate engine.** An application fee is a single amount Stripe moves; Stripe Tax does not tax it
  and issues nothing for it. Adding tax at payment time means FieldLogicHQ hand-rolls the club-province rate per payment (a
  second source of rates beside Stripe Tax's, which taxes the subscription and recovered fees), mixes tax into a number Stripe
  and the club's payout report call "fee", and still owes the club a document. Refunds then need a per-payment tax reversal
  and a credit note by hand. Its one real advantage: the tax is collected up front (no collection risk).
- **(b) uses one rate engine and one document.** The fee line goes on the same Stripe invoice as the recovered fees, with
  automatic tax and the **same tax code** (`txcd_90050001`), so "the two must never diverge" holds by one constant, a US club
  is 0% by its address, the invoice carries our number and the club's name, credit notes reverse tax through Stripe, and the
  return worksheet already reads Stripe invoices by issue date (line 101 amount, 103 tax). A D1 "exempt" answer switches off one
  code path.
- **A valid invoice** (ETA s.232 / Input Tax Credit Information Regulations, tiers in `GST_HST_RETURN_LINES.md`): under $100
  supplier name, date, total; $100-$499.99 add the GST/HST charged (or "included") and **our registration number**; $500+ add the
  **club's name** (the legal name on the Stripe customer), a description and **payment terms**. Print all of them on every
  statement regardless of total (the tier is by the statement's total, which varies month to month). One invoice may cover many
  supplies, so one monthly statement is enough; tax shown by rate (Stripe prints the rate name). Per-payment detail is a
  schedule for the club's benefit, not what makes the invoice valid.
- **The tax point is the catch.** RC4022: tax is payable on the **earlier of payment and due date**, due generally the invoice
  date. The fee itself is *paid* when Stripe withholds it, so the tax on the fee can count in the period the fee was taken,
  not the month the statement issues. Immaterial month to month for an annual filer; it matters **at the December 31 boundary**
  (December fees on a statement dated January 1). Whether the worksheet should count that tax in the fee's own year, or the
  statement's, is the one point to put to the accountant; until then the safe reading is the earlier one.
- **Collection risk under (b):** the tax is billed after the fee is gone, so an unpaid statement is a receivable. Tax is still
  owed to CRA on issue; relief is the bad-debt route in `UNPAID_SUBSCRIPTION_INVOICES.md`. Small amounts (tax on a ~3% fee is
  about 0.4% of the payment), and the existing invoice-alert and ride-the-plan-invoice machinery already chases it.
- **Who bears it:** with T2/T3 the tax is billed to the **club**, not shown to families. In "family pays" mode the family's
  added line is the club's own pass-on of its cost, so the club carries the tax unless the pass-on is grossed up. Most youth
  clubs are exempt or unregistered and cannot claim an ITC, so it is a real cost to them. A pricing question, not a tax one.

## Recommendation
1. **Choose (b): a monthly statement per club on the existing Stripe invoice**, the online-payment fee as its own line above the
   recovered-fee lines, one automatic-tax invoice, tax code `txcd_90050001`, `tax_behavior: exclusive`, our GST/HST number and
   the club's legal name printed, due in 30 days. Same switch for fee and recoveries.
2. **Statement wording:** title it for what it is ("Online-payment fees and Stripe costs billed to you"), no "passed on / at
   cost / no markup" language next to a taxed line (the known mismatch in `RECOVERED_STRIPE_FEES_TAX.md` item 5): the club is
   paying for our payment service plus costs we bill under our payments terms, plus tax. Copy goes to /marketing.
3. **Bookkeeping:** keep the payment-fee line and the recovered-fee line as separate kinds (REVENUE_REPORT_DEFINITIONS §3).
   The statement is invoice date for both amount (101) and tax (103), in CAD by the BoC invoice-date rate for any USD line.
4. **Date the December statement so the tax lands in December** if the accountant agrees the fee's payment date is the tax
   point (run the last statement of the year as of Dec 31, or note it for the accountant). Unresolved; do not build the
   timing until answered, and say so.
5. **Pricing owner call to /strategy:** does the family-added fee gross up for the tax, or does the club absorb it?
6. Show "plus GST/HST" wherever the fee rate is quoted to the club; do not show families a tax line (T3).

## Sources
- [CRA RC4022, General Information for GST/HST Registrants (tax point, invoices)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html) — accessed 2026-11-06 (via `GST_HST_RETURN_LINES.md` §6)
- [Excise Tax Act s.152 — when consideration becomes due](https://laws-lois.justice.gc.ca/eng/acts/E-15/section-152.html) — accessed 2026-11-05 (via `RECOVERED_STRIPE_FEES_TAX.md`)
- [Stripe Tax — obligations monitoring (application fees don't count)](https://docs.stripe.com/tax/monitoring) — accessed 2026-10-31
- [Stripe — Refunds and credit notes (Stripe Tax)](https://docs.stripe.com/tax/invoicing/refunds) — accessed 2026-11-05
- No fresh web research this session: this applies the topic files above to the (a)/(b) choice.

## Professional sign-off needed?
**Yes, for one point:** the tax point of a fee withheld in one period and invoiced in the next (the December boundary), and
D1 as before. Everything else here is an application of rules already on file.
