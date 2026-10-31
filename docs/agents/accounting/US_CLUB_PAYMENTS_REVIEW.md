# US clubs taking online payments through FieldLogicHQ — review
**Last verified:** 2026-10-31
**Re-verify by:** before the first US club takes a payment; when Stripe answers the cross-border question; if the Connect
set-up (who pays Stripe's fees) changes
**Depends on facts:** Canadian sole proprietor, no US entity or EIN; Canadian Stripe platform; club payments are direct
charges on the club's own account with FieldLogicHQ collecting Stripe's fees (platform controls pricing); card fee
3.5% + $1.50, bank debit 2.5% + $1.00, added on top for the family by default ("family pays"). Owner ruled 2026-10-31
(GST_HST_COLLECTION_PLAN T1) that US clubs are sold plans only once they can take payments.

## Question(s) this answers
- What stands between a US club and its first online payment?
- Who files US 1099-K forms, and what would that take?
- Is FieldLogicHQ a US money transmitter or marketplace facilitator?
- Can the fee be added on top for US families?

## Finding
**Blockers**
1. **Stripe cross-border confirmation.** Direct charges settle in the connected account's country (a US club gets USD in a
   US bank) and no page restricts them by region — but no page states a Canadian platform can hold US direct-charge
   accounts in this set-up. Get it in writing from Stripe, with the Connect fees and currency that apply. The application
   fee converts to the platform's currency (CAD); the conversion cost on it isn't stated.
2. **1099-K filer.** Stripe files only when the connected account pays Stripe's fees itself. In FieldLogicHQ's set-up
   (platform pays Stripe's fees) **the platform is the filer**. Filing needs a **US EIN** (IRS e-file rejects issuers
   without one; FIRE retires 2026-12-31, IRIS only from tax year 2026), plus some state payer IDs. Federal threshold
   > US$20,000 and > 200 transactions, but states go lower: MA, VT, MD, VA, DC, MT US$600; IL US$1,000 + 4 transactions;
   NJ US$1,000; AR US$2,500. Penalties per form for 2026 filings: US$60 / 130 / 340 (late tiers), US$680 intentional.
   Stripe's filing product costs US$2.99 per IRS e-file, US$1.49 per state; whether it accepts a foreign payer is
   unconfirmed. Stripe onboarding collects the club's TIN and pauses payouts if it's unverified by US$600.
3. **Fee on top = card surcharge risk.** Stripe caps surcharges at **3% in the US (credit cards only)** and **2.4% in
   Canada (credit only)**; debit and prepaid can't be surcharged; must be disclosed before paying and on the receipt, and
   refunded pro rata. Visa caps at 3% and needs 30 days' notice; several states ban or cap surcharges (Stripe lists CA, CO,
   CT, FL, KS, ME, MA, NY, OK, TX; CT, ME, MA named as prohibited). A 3.5% + $1.50 card fee added on top likely breaches
   the caps if it's a surcharge. **The same question is already owed to counsel for Canada** (Club Stage 12, A14), where
   "club pays" is the documented way round it.

**Lower risk, still for counsel**
- **Money transmission:** FinCEN's payment-processor exemption fits a platform that never holds funds; with direct
  charges money goes club ← Stripe, never through FieldLogicHQ. No FinCEN guidance on Connect SaaS platforms; states'
  "agent of the payee" exemptions vary (no explicit one reported in FL, NJ, NM, OK, OR, RI, UT, WY, DC).
- **Marketplace facilitator** (youth registration fees, likely first states): lowest risk CA, IL, NY (laws cover goods
  only / participation untaxed); to clear with counsel WA, MN, MI, PA, OH, FL, TX (laws reach services or fees may be
  taxable; MN and PA count facilitated sales toward the facilitator's own threshold). Many cells unconfirmed.
- **Clubs' own sales tax:** Stripe Tax "for software platforms" lets each club collect its own tax (0.5% or per-call,
  billed to the platform in this set-up); needs a club tax-settings screen. Most youth registration isn't taxed.
- **ACH (US bank debit):** US bank account and USD required; settles in ~4 days; 60-day consumer return window; the
  dispute fee falls on whoever pays Stripe's fees (FieldLogicHQ today). Card-only for Canadian families paying US clubs.

## Recommendation
1. Ask Stripe (support ticket, free): US direct-charge accounts on a Canadian platform — supported? Connect fees and
   currency? Can Stripe file 1099-Ks for a foreign platform?
2. For US clubs, **let the club pay Stripe's fees directly** — Stripe then files the 1099-Ks and carries the US filing
   duty; FieldLogicHQ keeps only its own fee. This needs a separate US fee (margin-only, since Stripe's cost is no longer
   inside it) → `/strategy`.
3. For US clubs, **no fee added on top for families** — the club pays the fee (or builds it into its registration price).
   Reconcile with the counsel answer to A14 for Canada.
4. One **US payments-counsel** review before the first US payment: money transmission, marketplace status in the launch
   states, surcharge characterization, and whether any US filing remains.

## Sources
- [Stripe — Connect charges](https://docs.stripe.com/connect/charges) · [Connect accounts](https://docs.stripe.com/connect/accounts) · [FX quotes / application fee currency](https://docs.stripe.com/connect/currencies/fx-quotes-api) · [Fee-payer behaviour, direct charges](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior) — accessed 2026-10-31
- [Stripe — Connect tax reporting](https://docs.stripe.com/connect/tax-reporting) · [1099-K state table](https://docs.stripe.com/connect/1099-k) · [1099 pricing](https://stripe.com/connect/1099) · [2026 tax season (IRIS, EIN)](https://support.stripe.com/questions/whats-new-for-the-2026-tax-season) · [TIN verification](https://docs.stripe.com/connect/required-verification-information-taxes) — accessed 2026-10-31
- [IRS — information return penalties](https://www.irs.gov/payments/information-return-penalties) — accessed 2026-10-31
- [Stripe — Collect surcharges (caps by country)](https://docs.stripe.com/payments/cards/surcharge) — opened and confirmed 2026-10-31 · [Surcharge fees guide](https://stripe.com/resources/more/surcharge-fees) · [Convenience fees](https://stripe.com/resources/more/convenience-fees)
- [FinCEN — payment processor ruling](https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business) · [CSBS MTMA](https://www.csbs.org/csbs-money-transmission-modernization-act-mtma) — accessed 2026-10-31
- State pages: [NY marketplace](https://www.tax.ny.gov/pubs_and_bulls/publications/sales/marketplace.htm) · [CA MPF Act](https://cdtfa.ca.gov/industry/MPFAct.htm) · [IL FAQ](https://tax.illinois.gov/research/taxinformation/sales/frequently-asked-questions-faqs-for-marketplace-facilitators-marketplace-sellers-and-remote-retailers.html) · [MN marketplace](https://www.revenue.state.mn.us/sales-tax-marketplace-providers) · [MN admissions](https://www.revenue.state.mn.us/guide/admissions-and-entry-fees) · [WA sports leagues](https://dor.wa.gov/education/industry-guides/recreational-and-fitness-services/sports-leagues) · [MI RAB 2021-22](https://www.michigan.gov/taxes/rep-legal/rab/rabhtml/2021/revenue-administrative-bulletin-2021-22) · [PA online retailers](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/tax-obligations-for-online-retailers) · [TX youth sports](https://comptroller.texas.gov/taxes/exempt/youth-sports.php) — accessed 2026-10-31 (most as search summaries; confirm)
- [Stripe — Tax for software platforms](https://docs.stripe.com/tax/tax-for-platforms) · [ACH Direct Debit](https://docs.stripe.com/payments/ach-direct-debit) — accessed 2026-10-31

## Professional sign-off needed?
Recommended once before the first US payment; **owner ruled NO on 2026-10-31 (U5)**: U1 (Stripe files the 1099-Ks) and U2
(no fee on top for US families) remove the per-form and surcharge exposure, so a lawyer is brought in only when US sales
grow — a state-tracker alert, a Stripe/regulator enquiry, or if Stripe cannot file the 1099-Ks (then a US CPA is needed
before the first US payment).
