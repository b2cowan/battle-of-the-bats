# Unpaid subscription invoices: GST/HST timing, bad debts, void vs uncollectible, Stripe settings
**Last verified:** 2026-11-05
**Re-verify by:** 2026-11-05 + 12 months; or before the first GST/HST return that includes a bad-debt adjustment; or if Stripe Tax becomes the filing source; or the owner's Bookkeeping starts recording Stripe income
**Depends on facts:** registered for GST/HST (ACCOUNTING_FACTS.md); sole proprietor reporting business income on T2125 (accrual); sales are SaaS subscriptions billed through Stripe Billing, Stripe Tax planned

## Question(s) this answers
- A renewal invoice is issued, the card fails, Stripe's retries fail and the plan ends: do we owe GST/HST on an invoice nobody paid?
- Should such an invoice be voided, or marked uncollectible (a bad debt)? What does each mean for GST/HST, income tax and Stripe Tax's report?
- What should Stripe do when all retries fail, and with the open invoice when the subscription ends?

## Finding
- **Tax is owed when the invoice is issued, paid or not.** GST/HST is payable on the earlier of payment and the day consideration becomes due (ETA s.168(1)); consideration becomes due on the earliest of the invoice's issue date, its date, or the date a written agreement requires payment (s.152(1)). CRA (RC4022): if you issue an invoice before you are paid, include its GST/HST in the period that includes the invoice date, "even if you have not yet collected the tax". (s.152(2) has a separate rule for leases/licences under a written agreement — whether a SaaS subscription is one is not settled by CRA text; it changes timing, not whether tax is owed.)
- **Bad-debt relief (ETA s.231):** for a taxable supply to an arm's-length customer, once the debt is established as bad AND written off in the books, the supplier deducts the tax fraction (tax × amount written off ÷ total including tax) on line 107 of the return for the write-off period or a later one, **within four years** of the due date of the return for the period of the write-off. The tax must have been reported and remitted in the first place (s.231(1.1)). Anything later recovered is added back (s.231(3), line 104).
- **A credit note (ETA s.232) is the tool when the price is reduced or the invoice cancelled** — e.g. the supply was not made. It must say it is a credit note and carry the supplier's name and business number, the customer's name, the date, and the amount of the adjustment (or a statement that the total includes the tax adjustment and the rate) — CRA Memorandum 12.2. CRA text does not address "cancel an unpaid invoice" head-on; the split below is a reading of s.231 vs s.232.
- **Income tax:** the amount is income in the year it is billed (ITA 12(1)(b)); a bad debt is deducted in the year it is established as bad (ITA 20(1)(p)); a reserve for doubtful debts is allowed (20(1)(l)) and added back next year (12(1)(d)). A voided/credited invoice reverses the income instead.
- **Stripe:** after the final retry the subscription can be cancelled, marked unpaid, left past due, or paused (Billing › Revenue recovery › Retries). Cancelling a subscription does NOT close its open invoices: they stay `open` with automatic collection switched off. A separate invoice setting can mark a past-due invoice uncollectible after 30, 60 or 90 days, or leave it. `void` = treated as zero, can never be paid again; `uncollectible` = Stripe's "bad debt" state, can still later be paid. Sandbox (test) settings are separate from live once created.
- **Stripe Tax records tax when an invoice finalizes** and reduces its reported tax when the invoice is voided, marked uncollectible or credited. That does not match the ETA's order (tax in the invoice period; relief only on a write-off, on line 107), and Stripe says its reports are not a filing tool for credits — so its summary cannot be copied straight onto a return.

## Recommendation
1. **Keep "cancel the subscription" after the final retry in live Stripe** — it is what the product is built for and rehearsed against (Plans end at renewal, Stage 3 case 5: the ending applies once, dated by Stripe's end). Do not use "mark unpaid" / "leave past due" without a product change.
2. **Set the live invoice rule to "mark uncollectible" at 30 days past due**, so no unpaid invoice sits open for ever; a late payment can still settle an uncollectible invoice.
3. **Treat each uncollectible invoice as a bad debt in the books**: record the write-off, then claim the tax fraction on line 107 of that period's return (four-year limit). Report line 103 on ALL invoices issued (gross) — do not take Stripe Tax's net "tax payable", which has already subtracted the uncollectible tax, or the relief is counted twice.
4. **Void with a credit note only when the supply was not made** (an invoice issued in error, or a decision to forgive a period the club never used). A product-wide "a plan that ends for non-payment owes nothing" rule is a pricing/policy decision for `/strategy`, not a tax one; if taken, use Stripe credit notes (the documented s.232 record), not a bare void.
5. **Owner Bookkeeping:** nothing to change today (it records no income yet). Its future "Stripe income" stage must record income on the invoice date and carry uncollectible / void / credit-note events as a bad-debt or reversal line, with the GST/HST split.

## Sources
- [Excise Tax Act s.168](https://laws-lois.justice.gc.ca/eng/acts/E-15/section-168.html) — accessed 2026-11-05
- [Excise Tax Act s.152](https://laws-lois.justice.gc.ca/eng/acts/E-15/section-152.html) — accessed 2026-11-05
- [Excise Tax Act s.231 (bad debts)](https://laws-lois.justice.gc.ca/eng/acts/E-15/section-231.html) — accessed 2026-11-05
- [Excise Tax Act s.232 (credit notes)](https://laws-lois.justice.gc.ca/eng/acts/E-15/section-232.html) — accessed 2026-11-05
- [CRA RC4022, General information for GST/HST registrants (timing; bad debt adjustments, line 107)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html) — accessed 2026-11-05
- [CRA GST/HST Memorandum 12.2 (s.232 adjustments, credit note contents)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/12-2/refund-adjustment-credit-gst-hst-under-section-232-excise-tax-act.html) — accessed 2026-11-05
- [Income Tax Act s.12](https://laws-lois.justice.gc.ca/eng/acts/I-3.3/section-12.html) and [s.20](https://laws-lois.justice.gc.ca/eng/acts/I-3.3/section-20.html) — accessed 2026-11-05
- [Stripe: Smart Retries / revenue recovery](https://docs.stripe.com/billing/revenue-recovery/smart-retries), [Automatic collection (invoice status after past due)](https://docs.stripe.com/invoicing/automatic-collection), [Cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel), [Invoice statuses](https://docs.stripe.com/invoicing/overview), [Stripe Tax reports](https://docs.stripe.com/tax/reports) — accessed 2026-11-05

## Professional sign-off needed?
Yes — before the first GST/HST return that includes a bad-debt adjustment: confirm (a) reporting line 103 gross with bad debts on line 107 rather than Stripe Tax's net figure, (b) whether a renewal the club used only for a few days (cut off when retries failed) is a bad debt (s.231) or a reduction (s.232), and (c) whether s.152(2)'s licence rule changes the timing for these subscriptions.
