# A live Premium Coaches Portal follows Stripe again: pre-handoff review
**Last verified:** 2026-11-27
**Re-verify by:** an edit to the portal sync, the yearly renewal reminder's candidate read, or the monthly estimate; the first live yearly Premium portal.
**Depends on facts:** GST/HST registered; production has no active self-paid portal (counts, 2026-11-27).

## Question this answers
Does storing a live portal's status, billing cycle, renewal date and item change anything FieldLogicHQ charges, collects, invoices, records for tax or reports?

## Finding
- **Charges, invoices, tax records, Sales by month, Bookkeeping:** unchanged. Checkout, price, tax and refund code are untouched, and the tax-record, purchase-email and revenue readers do not read the stored cycle.
- **Yearly renewal reminder:** a yearly portal now stores `annual`, so it is a candidate for the whole 37-day window. Before, its cycle was blank and it was picked up only 31 to 37 days out: a daily job that missed those days sent nothing. This supports the Terms' 30-day notice for yearly plans. Monthly portals stay excluded; once per charge date as before; a short trial already told by the purchase email is still skipped.
- **Cancel and keep emails, plan card:** a yearly coach's price now reads per year.
- **Platform numbers:** "pays now" counts a portal whose trial became a payment; the daily Stripe comparison stops reporting an unrecorded cycle; past-due and recovered events are still written once per turn (two events arriving at the same instant could write two, as on the club path). The monthly estimate still prices each active portal at the monthly list price.
- **Not changed:** a first payment that never completes leaves the record as the first purchase wrote it, so the monthly estimate would still count it (as before this build).

## Recommendation
Nothing to fix before hand-off. No record on production needs a correction for tax or the books: its one self-paid portal is cancelled and no tax record reads these fields.

## Sources
- Our code and Terms §8 as quoted in `lib/renewal-reminder.ts`. No new rule researched.

## Professional sign-off needed?
No.
