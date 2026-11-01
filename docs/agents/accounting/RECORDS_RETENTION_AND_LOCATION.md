# Keeping the business's books and records: how long, and where
**Last verified:** 2026-11-01
**Re-verify by:** 2027-11-01, or if the business incorporates, or if CRA grants (or refuses) permission to keep records outside Canada
**Depends on facts:** sole proprietorship, calendar tax year, GST/HST registered (ACCOUNTING_FACTS.md)

## Question(s) this answers
- How long must FieldLogicHQ keep its books, invoices and payment records (income tax and GST/HST)?
- Does it matter that the records sit with Stripe, Supabase or AWS, on servers outside Canada?
- Are the app's own billing logs (event log, change log, daily Stripe comparison) the "books"?

## Finding
- **Six years from the end of the last tax year the records relate to** (calendar year for an individual). A late-filed
  return restarts the six years from its filing date. For GST/HST the period runs from the last year a record may be
  needed for GST/HST reporting.
- **Where:** records must generally be kept at the place of business or residence **in Canada**, unless CRA gives
  written permission otherwise. Records held outside Canada and only reached electronically from Canada are **"not
  considered to be records kept in Canada."** If they are kept outside Canada, the business must be able to access them
  and hand CRA officials the electronic records in a format CRA software can read (IC05-1 covers electronic records).
- The source documents for FieldLogicHQ's own sales are **Stripe's** invoices, charges, refunds and disputes (and, from
  the GST/HST plan's Stage 2, Stripe's tax-bearing invoices). The app's own logs (`stripe_billing_events`, the platform
  change log, `stripe_billing_drift_checks`) are operational controls: useful evidence, not the books.

## Recommendation
- Once a year (after December 31) export the year's Stripe invoices, charges, refunds, disputes and payouts, plus the
  owner's Bookkeeping, to storage **in Canada** (the owner's own machine/drive in Ontario is enough), and keep each
  year's export for six full years after that year ends.
- Do not prune the app's billing event log or change log on a schedule shorter than six years without asking this agent.
- Ask the accountant one question: is a yearly in-Canada export enough, or should FieldLogicHQ ask CRA for written
  permission to keep records outside Canada (Stripe; the Bookkeeping store chosen 2026-10-23 is AWS us-east-2)?

## Sources
- [CRA — Where to keep your records, for how long and how to request permission to destroy them early](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/keeping-records/where-keep-your-records-long-request-permission-destroy-them-early.html) — accessed 2026-11-01

## Professional sign-off needed?
Yes, for one thing only: whether the yearly in-Canada export satisfies the "kept in Canada" rule for records held by
Stripe and AWS us-east-2, or whether written CRA permission should be requested. Not a launch gate (owner ruling
2026-10-31).
