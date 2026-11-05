# Accounting Research Index

Every topic the Accounting Agent (`/accounting`) has researched for FieldLogicHQ's own accounting,
so a repeat question costs reading one row + one file, not re-researching. Read this file (and
`ACCOUNTING_FACTS.md`) on activation. **Do not open the topic files themselves until a question
actually needs one** — that's the whole point of the index.

Every topic below assumes FieldLogicHQ is **registered for GST/HST** (owner confirmed 2026-10-31, nothing sold yet).
The implementation plan built from these topics: `docs/projects/active/GST_HST_COLLECTION_PLAN.md`.

| Topic | File | Last verified | Re-verify trigger |
|---|---|---|---|
| GST/HST + provincial tax on subscriptions to Canadian clubs; small-supplier threshold; rates; place of supply; invoices | [GST_HST_ON_SUBSCRIPTIONS_CANADA.md](GST_HST_ON_SUBSCRIPTIONS_CANADA.md) | 2026-10-31 | 12 months; registration status change; a provincial rate change |
| Zero-rating sales to US clubs; evidence of non-residence | [ZERO_RATED_SALES_TO_US_CUSTOMERS.md](ZERO_RATED_SALES_TO_US_CUSTOMERS.md) | 2026-10-31 | First US club signs |
| Tax on the online-payment (platform) fee; the four Canada/US scenarios; digital-platform GST rules | [PLATFORM_FEE_TAX_TREATMENT.md](PLATFORM_FEE_TAX_TREATMENT.md) | 2026-10-31 | Online payments switched on in prod; counsel answers D1; first US club payout account |
| US exposure: income tax/treaty, W-8BEN, state sales tax, marketplace facilitators, gross-receipts taxes, 1099-K | [US_TAX_EXPOSURE.md](US_TAX_EXPOSURE.md) | 2026-10-31 | First US club; ~US$50K in one state; incorporation or any US presence |
| US clubs taking payments: Stripe cross-border, 1099-K filer, surcharge caps, money transmission, marketplace states | [US_CLUB_PAYMENTS_REVIEW.md](US_CLUB_PAYMENTS_REVIEW.md) | 2026-10-31 | Before the first US club payment; Stripe's answer; a change to who pays Stripe's fees |
| Stripe configuration for FieldLogicHQ's own sales tax | [STRIPE_TAX_SETUP.md](STRIPE_TAX_SETUP.md) | 2026-10-31 | 12 months; before the first taxed invoice |
| How long and where the business keeps its books (6 years; "kept in Canada"); app logs vs the books | [RECORDS_RETENTION_AND_LOCATION.md](RECORDS_RETENTION_AND_LOCATION.md) | 2026-11-01 | 12 months; incorporation; a CRA permission answer |
| CRA digital-platform seller reporting (Part XX); foreign-currency conversion | [PLATFORM_REPORTING_AND_CURRENCY.md](PLATFORM_REPORTING_AND_CURRENCY.md) | 2026-10-31 | Online payments live in prod; clubs sell merchandise |
| Stripe fees recovered from a club (returned debits, disputes, foreign-card extra): consideration, not a disbursement; same tax as the payment fee; net of Stripe's tax; credit notes reverse tax | [RECOVERED_STRIPE_FEES_TAX.md](RECOVERED_STRIPE_FEES_TAX.md) | 2026-11-05 | 12 months; D1 answered; Stripe bills the club's own account instead of the platform; online payments live in prod |
