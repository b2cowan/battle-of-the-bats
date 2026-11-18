# How the GST/HST on the online-payment fee is collected — at payment time vs a monthly statement

> **⚠ SUPERSEDED 2026-11-17 by owner ruling R1 — read "The R1 method" section just below first.** The recommendation
> further down ((b), a monthly tax statement billed on top of the fee) is **not the method any more**. It is kept as
> history and for the reasoning that still holds: the tax base is the fee we charge, there is no ITC on Stripe's exempt
> processing fee, the tax must reach lines 101/103, and a valid invoice must exist on request. The "tax point is the
> catch" bullet and its December boundary question are mostly gone under R1 (see below). Plan of record:
> [STRIPE_OWNED_PRICING_PLAN.md](../../projects/active/STRIPE_OWNED_PRICING_PLAN.md).

## The R1 method (added 2026-11-17, Stripe-owned pricing Stage 1 step 5)

**Rulings this rests on (owner, 2026-11-17):** R1 the GST/HST is **included in our fee**, paid out of our share, no tax line
at checkout, no tax bill to clubs. T3 stands: the fee is FieldLogicHQ's charge **to the club**. R2: whether the fee is taxable
at all (D1) goes to the accountant before online payments switch on. Rate design A: our application fee is the family-facing
fee less Stripe's standard Canadian cost. Under Stripe-owned pricing Stripe charges the club's own account for processing,
disputes, returned debits and foreign cards; nothing of Stripe's passes through our books.

- **Tax base: our application fee only** (the money Stripe moves to our balance on each payment). Stripe's processing fee is
  a supply from Stripe to the club, not part of what the club pays us. This is cleaner than today: nothing is re-billed, so
  the agency question in `RECOVERED_STRIPE_FEES_TAX.md` does not arise.
- **Tax is inside the fee.** Tax in the fee = fee x rate / (100 + rate), by the club's billing-address province: 13/113
  (Ontario), 14/114 (Nova Scotia), 15/115 (NB, NL, PEI), 5/105 (AB, BC, SK, MB, territories, and the GST part in Québec).
  A US club: 0%, the whole fee is zero-rated (evidence in `ZERO_RATED_SALES_TO_US_CUSTOMERS.md`). Store the rounded tax per
  fee, in cents, with the rate and the province used. Family and club never see a tax line.
- **Tax point: when the fee is taken** (the charge). The fee is paid the moment Stripe withholds it, and tax is payable on
  the earlier of payment and due date (ETA s.152, s.168; RC4022). There is no invoice and no wait, so the old "withheld in
  December, invoiced in January" question disappears. One small edge stays: a bank debit's fee shows on our balance when the
  debit is started, days before the money settles, and a returned debit reverses it. Count it at the charge date and let
  the reversal be an adjustment in its own period.
- **What each fee feeds** (regular method, annual filer): the fee **less** its tax goes to line 101, the tax inside it to line
  103, by the date of the charge. A US club's fee goes to 101 in full, tax 0. Stripe Tax does not see application fees
  (`https://docs.stripe.com/tax/monitoring`), so **our own per-fee record is the only source**: the return worksheet must be
  fed from it. Bookkeeping records the fee as revenue net of the tax inside it.
- **Refunds of our fee (the one real rule).** A returned bank debit auto-refunds our application fee to the club (probe
  evidence). That is a reduction of consideration (s.232). We may take the tax back out of net tax **only if a credit note
  or equivalent record exists** showing the fee refunded and the tax reduced (Memo 12.2; see `CREDIT_NOTES_ON_REFUNDS.md`).
  Without one, claim no adjustment (we simply pay a few cents more). A refund the club ticks on its own sale does **not**
  refund our fee, so the fee and its tax stay as they were. A dispute lost does not debit our fee either.
- **Records and returns.** Keep, per fee: charge date, club, province and rate used, fee, tax inside, and any refund of the
  fee with its date. Keep six years (`RECORDS_RETENTION_AND_LOCATION.md`). A monthly **information statement** to the club
  (the plan's Stage 5) is a courtesy and a copy of the record, not a tax bill.
- **Still open, for the accountant** (`STRIPE_OWNED_PRICING_ACCOUNTANT_QUESTIONS.md`): D1 itself; what document lets a
  GST-registered club claim the tax inside a fee Stripe withheld with no invoice; US evidence.
- **Needs the club's province before the first payment.** With the tax inside every fee at the moment it is taken, we cannot
  wait to learn the province. The billing-address-before-payouts step must stay (owner ask 3 in the plan; recommended yes).

### Stage 2 review (2026-11-18): what GST/HST Stage 5 must still store per fee

Stage 2 stores `online_payments.application_fee_amount` (mig 498, frozen). It is the **amount** only; it is not yet a tax record.

- **It is written when the Checkout OPENS**, so an `open`, `expired` or `returned` row carries a figure for a fee never kept.
  The return source is only rows that are paid (`paid_at` set; statuses paid, partly_refunded, refunded, reversed) **and
  `livemode = true`** (dev and test payments must never reach a return).
- **Dates:** use `paid_at` (timestamptz) converted to the Toronto day for the period. **Never `paid_on`**: it is clamped to
  today and moved forward inside a closed club fiscal year, so it can fall in the wrong GST period. A bank debit's `paid_at`
  is the settlement, days after the fee reached our balance (`clearing_at`); which date is the tax point is the accountant's
  question already listed (Q2), and both are stored.
- **Province and rate are NOT stored per payment.** The club's address is one editable `billing_locations` row; a move
  changes every past payment's province if it is read live. Stage 5 must snapshot, at the moment the fee is taken (or at
  the first paid-landing), the province or country used, the rate used (rates change) and the tax inside the fee in cents.
  Older rows (dev only; production has no payout account) need no backfill.
- **Refunds of our fee:** a club-ticked refund never refunds it (the refund calls do not pass `refund_application_fee`), and a
  lost dispute leaves it. So the only reversal is a returned debit, which has `clearing_at` and `returned_at`; the amount is
  `application_fee_amount`. Stage 5's credit record needs its own date (it can land in a later period than the fee) and must
  say the fee and tax it reverses; nothing more needs storing now.

### Stage 5 review (2026-11-18)

Payments Terms v0.2 §4 matches this method: tax included in OUR part only, by the club's billing address, nothing added on top,
neither part refunded on a club's refund or a lost dispute, a returned debit gives both back. The terms are D1-neutral ("any
sales tax that applies ... is included"). Still not built: the per-fee tax record, the credit record for a returned debit, and
the fee statement (GST/HST Stage 5). Stripe's fee is never inside the taxable amount, so no wording may say "the processing
fee includes GST/HST".

**Everything below is the earlier (2026-11-05 to 2026-11-17) analysis, kept for history.**

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
