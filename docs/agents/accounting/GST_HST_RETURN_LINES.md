# GST/HST return lines (regular method): what feeds each line, ITC rules, foreign suppliers, currency, tax point
**Last verified:** 2026-11-06
**Re-verify by:** 2027-11-06; or before the first return is filed; or if the owner elects the quick method; or if CRA changes the GST34 / electronic return; or the first US club signs (line 101 / currency rows)
**Depends on facts:** registered for GST/HST (owner 2026-10-31, effective date and filing frequency NOT on file); sole proprietor, Ontario; nothing sold yet; Stripe Tax computes tax on our invoices; owner Bookkeeping records expenses (CAD charged, original currency, business-use %, supplier). Adds no facts to ACCOUNTING_FACTS.md.

## Question(s) this answers
- Which return lines does a regular-method filer use, what goes in each for FieldLogicHQ, and what are the CRA's words for them (so a drawing can use real labels)?
- Do zero-rated US sales go in line 101 / line 103? Where do bad debts, recovered bad debts and credit notes land?
- Can we use the quick method; should the worksheet assume it?
- How much of an expense's GST/HST is an ITC (business-use %, receipt tiers, PST/QST)?
- Is tax charged by a foreign vendor (AWS, Google, Anthropic, GitHub...) claimable? What must the expense form capture?
- Which CAD figure for a USD sale; which date is the tax point?

## Finding

### 1. The lines (electronic return / NETFILE / My Business Account; paper GST34-2 differs only where noted)
Verbatim fragments below are CRA's instruction text ("Instructions for preparing a GST/HST return"). The short captions in the label column are the form's own headings as I remember them and are **UNCONFIRMED verbatim** — the fetched page gave instruction text, not the caption strings; check against the live return before the drawing's labels are final.

| Line | Caption (UNCONFIRMED verbatim) | CRA instruction wording (verbatim) | For FieldLogicHQ |
|---|---|---|---|
| 90 / 91 / 102 | (electronic, optional) | 90: "Enter the total of your taxable sales including zero-rated supplies (other than zero-rated exports) made in Canada". 91: "Enter the total of your exempt supplies, zero-rated exports, and other sales and revenue for this reporting period." 102: associates' taxable sales | Optional split of line 101. If used, line 101 is filled from 90 + 91 and **US zero-rated sales go on 91**. The worksheet may ignore these and show one 101 total. |
| 101 | Sales and other revenue | "Enter the total amount of revenue from supplies of property and services, including zero-rated and exempt supplies, and other revenue for the reporting period." Excludes provincial sales tax, GST, HST and "amounts already reported on a previous return"; "Round off the amount to the nearest dollar. Enter "0" if you have no revenue to report." | Sum of invoice amounts **before tax** for invoices issued in the period: Canadian taxable + US zero-rated, in CAD. Whole dollars. |
| 103 | GST/HST collected or collectible | "Enter all GST/HST you were required to collect as well as all amounts of GST/HST collected on your supplies" (RC4022: includes tax on unpaid invoices) | Sum of GST/HST on invoices issued in the period (HST + GST, all provinces). **Gross**: credit notes and bad debts do NOT reduce it. Zero-rated US sales contribute 0. PST / QST are not on this return. |
| 104 | Adjustments to be added to net tax | "Complete this line only if you have to make adjustments to increase the amount of your net tax for the reporting period." RC4022: put the GST/HST part of a **recovered bad debt** here; Memo 12.2 ¶26: a **recipient's** add-back of tax a vendor credited/refunded to us after we claimed its ITC | Recovered bad debt (a written-off invoice later paid); ITC add-back when a vendor refunds/credits tax we already claimed; the once-a-year meals add-back if meals ITCs were claimed at 100% (see §3). Usually 0. |
| 105 | Total GST/HST and adjustments | "add line 103 and line 104" (calculated on electronic returns) | 103 + 104. |
| 106 | Input tax credits (ITCs) | "Enter the total of all ITCs for the reporting period." Include "any ITCs you did not claim in an earlier reporting period, provided the time limit for claiming the ITCs has not expired." | Sum of claimable GST/HST on expenses (business-use % applied, simplified-registrant tax excluded, pre-registration services excluded) — §3, §4. |
| 107 | Adjustments to be deducted (shown "Adjustments to be deducted when determining the net tax" in RC4022) | "Complete this line if you have adjustments that decrease the amount of your net tax for the reporting period." RC4022: **bad debt** tax "as a tax adjustment on line 107"; Memo 12.2 ¶24: "should be recorded as an adjustment on line 107" for a **s.232 refund/credit/adjustment** (credit note) | Tax fraction of credit notes issued (Stripe credit notes); tax fraction of invoices written off as bad debts. NOT ITCs. |
| 108 | Total ITCs and adjustments | "add" 106 and 107 (calculated electronically) | 106 + 107. |
| 109 | Net tax | Subtract 108 from 105 (calculated electronically). Negative = ITCs and adjustments exceed tax | 105 - 108. **Expect negative (a refund) until sales start.** |
| 110 | Instalments and other annual filer payments | "Enter the total amount of the quarterly instalments you paid in the year." "Do not use this line to report the ITCs or refunds you expect to receive." | Only if instalments are required (RC4022: none if net tax is under $3,000). Worksheet: leave to owner. |
| 111 | Rebates | "Enter the total amount of the rebate(s) you are claiming." | None expected. |
| 112, 113A, 113B, 113C | (paper only) | 112 = 110 + 111; 113A = 109 - 112; 113B = 205 + 405; 113C = 113A + 113B. "This line does not appear on an electronic return." | Not drawn; mention only if the worksheet mimics paper. |
| 114 | Refund claimed | "If the amount on line 113 C is negative, enter this amount on line 114 to claim your refund." | Negative net tax. |
| 115 | Amount owing | "If the amount on line 113 C is positive, enter this amount on line 115." | Positive net tax. |
| 205 | GST/HST on purchase of real property or emission allowances | — | **Not relevant** (no real property purchases). |
| 405 | Other GST/HST to be self-assessed | applies e.g. to a registrant that "has to self-assess the provincial part of the HST on property or services" | **Edge only** — see §4 (imported services, under 90% commercial use; quick-method filers). Not computed by the worksheet. |

**Zero-rated US sales:** CONFIRMED in line 101's wording ("including zero-rated and exempt supplies") — they go in 101 (or 91 if the split is used) and contribute nothing to 103 (no tax is collectible). The existing ZERO_RATED_SALES_TO_US_CUSTOMERS.md covers whether a sale qualifies.
**Line 101 for annual filers / thresholds:** the instructions give no filer-type exception — "Enter "0" if you have no revenue" — so 101 is completed on every return. The only threshold text is "Reporting these sales will help us to properly calculate your reporting period threshold amount" (about lines 90/91). No dollar threshold for completing 101 was found. Filing frequency is UNCONFIRMED; an annual sole proprietor with a Dec 31 year end generally files by June 15 and pays by April 30 (RC4022).
**Bad debt (CONFIRMED):** write-off claimed on **line 107**, on a return filed "within four years of the due date" of the return for the period the debt was written off (RC4022); only if the sale was reported and the tax remitted. A **recovery** is added on **line 104** in the period recovered. (The line-instructions page paraphrases the limit as "4 years of the write-off period" — use RC4022's wording.) Detail: UNPAID_SUBSCRIPTION_INVOICES.md.
**Credit notes / refunds (CONFIRMED):** a supplier's s.232 deduction is an **adjustment on line 107**, only once a credit note is issued, and only to the extent the tax was in net tax of that or an earlier period (Memo 12.2 ¶22-24, dated April 2008; RC4022 "After the sale" example: "include the $73 as an adjustment to its net tax on line 107"). It does **not** reduce line 103. A price cut that does not refund the tax needs no adjustment.

### 2. Quick method
RC4022: eligible if revenue from taxable supplies (including associates', zero-rated included) "is no more than $400,000 (including the GST/HST) in any four consecutive fiscal quarters", and a permanent establishment in Canada is required. Excluded types (legal, accounting, bookkeeping/tax consultants, financial institutions, charities...) do not include a software seller, so **we would be eligible**. But under it you "cannot claim ITCs for your operating expenses" (line 106 instruction), line 101 changes to taxable revenue **including** GST/HST, line 103 becomes line 101 x remittance rate, and quick-method filers must self-assess the provincial part of HST on imports even when used wholly commercially (see §4). Making it is an election (Form GST74 — UNCONFIRMED here). **Recommendation: the worksheet shows the regular method only, with a one-line header "Regular method"; the owner should confirm he did not elect the quick method when registering (not on file).**

### 3. ITCs
- **Eligibility:** only to the extent purchases are "for consumption, use, or supply in your commercial activities"; never for personal consumption (CRA "Input tax credits", modified 2026-10-14).
- **Business-use rules (CRA "ITC eligibility percentage", modified 2026-02-03). This differs from the "10% / 90% for property vs services" shorthand:**
  - **Operating expenses (services, non-capital goods):** 90% or more commercial use = **100%** ITC; over 10% and under 90% = **ITC equals the percentage of use**; 10% or less = **none**. If use can't be reasonably allocated, a fair, consistent method.
  - **Capital personal property (a laptop, a monitor; not passenger vehicles):** individuals — **100% above 50% commercial use, nothing at 50% or less. There is no proportional ITC** (the income-tax claim for the same item is still prorated, so ITC % and expense % can differ).
  - **Meals and entertainment** (reasonable amounts): 50% ITC.
  - Passenger vehicles and capital real property: other tables; not relevant (UNCONFIRMED that we never buy a vehicle).
  - So the worksheet's ITC is **not** simply tax x business-use %: it needs a per-expense "kind" (operating / capital / meals).
- **Documentation tiers (current; CRA "Input tax credits" 2026-10-14 and RC4022; the 2021 change from $30/$100):** invoice total **under $100**: supplier name, invoice date, total paid. **$100 to $499.99**: add the GST/HST charged (or that the price includes it) and the **supplier's (or intermediary's) GST/HST registration number**. **$500 or more**: add the buyer's name (or agent's), a brief description, and the terms of payment. Tier is by invoice total.
- **Time limit:** claim by the due date of the return for the last reporting period ending within **four years** of the period the ITC could first be claimed (two years for listed financial institutions and some businesses over $6 million — not us).
- **Before registration (Memo 8-5, June 2026, ¶13, 20-22):** property (inventory / capital personal property) held for commercial use at registration earns a deemed-paid ITC (basic tax content, must be documentable); **tax on services consumed before registration is not claimable** (¶20-22: tax on services supplied after registration may be claimed in the first period ending after registration, only to the extent used in commercial activities after that time), and prepaid services are apportioned by date (¶19, Example 4). The worksheet must not claim ITCs on charges dated before the effective date of registration (UNCONFIRMED: the owner's effective date — in his CRA letter). Start-up costs tied to establishing the commercial activity may qualify (¶29).
- **PST / QST:** not ITCs on this return. This return carries GST/HST only; BC PST, Manitoba RST, Saskatchewan PST, and QST are separate taxes (CRA line 103/106 wording is GST/HST). QST would be a Revenu Québec return; per ACCOUNTING_FACTS.md we hold no provincial registration. UNCONFIRMED by a CRA page: the explicit sentence that PST is not creditable — it follows from lines 103/106 being GST/HST lines; Revenu Québec pages were not fetchable (see GST_HST_ON_SUBSCRIPTIONS_CANADA.md).

### 4. Tax charged by foreign suppliers (the "foreign supplier charged tax" flag)
- **CONFIRMED (CRA "Confirming a simplified GST/HST account number", registry list updated 2026-11-03; CRA "Input tax credits", 2026-10-14):** "If you are a business registered for the normal GST/HST ... purchasing goods or services from a business listed in this registry ... you must provide that other business with evidence that you are registered for GST/HST in order not to be charged the tax. Otherwise, you will be charged the tax and cannot claim input tax credits or claim a rebate for the GST/HST you paid on those purchases." So **no ITC and no GST189 rebate** — this contradicts the "GST189 under certain conditions" idea. The only recovery is a **refund or credit from the vendor**; CRA's rebate for tax paid in error (reason code 1C, GST189, within two years) says to ask the supplier first and CRA's registry text says no rebate here.
- **Is the number on the invoice the test? No.** A number printed on an invoice satisfies the ≥$100 documentation rule, but the test is **which regime the vendor is registered under**: simplified (digital-economy, on CRA's simplified registry) vs the normal regime (searchable on the normal GST/HST registry). Registry numbers shown mostly end "RT9999" but CRA does not state that as a rule — don't use the suffix as a test (UNCONFIRMED).
- **Which vendors:** I did not check AWS, Google, Anthropic, GitHub (or any other vendor) against the registry. Some bill through a Canadian affiliate under the normal regime (claimable). Owner looks each up in the registry once; the result is a property of the **supplier**, not the expense.
- **Fix at source:** give the simplified-registered vendor our GST/HST number in their billing settings so they stop charging; ask for a refund/credit of tax already charged. A vendor credit of tax never claimed needs no line 104 add-back; a credit of tax already claimed does (Memo 12.2 ¶25-26).
- **Recommended capture:** a **per-supplier** field "Registered with CRA under: Normal / Simplified / Not registered / Not checked" plus the number as printed. The per-expense **flag "foreign supplier charged tax" = "the tax on this expense was charged by a simplified-registered vendor; excluded from line 106 and listed as 'tax paid, not claimable' (still part of the expense cost for income tax)"**. Derive it from the supplier, with a per-expense override. Do not offer a way to claim it.
- **No tax charged by an unregistered foreign vendor:** no ITC, nothing on the return — **except** the self-assessment edge: a registrant need not self-assess when the use is 90% or more commercial; below that, or if on the quick method, the provincial part of HST (and federal tax on imported taxable supplies) can be payable (line 405 / Division IV; CRA RC4027 and Memo B-079 search results — UNCONFIRMED in detail). The worksheet should only **warn** ("foreign vendor, no tax charged, business use under 90%: ask your accountant"), never compute.

### 5. Revenue currency (USD sales on line 101)
GST/HST Memo 3-6 (memo dated July 2018, page modified 2019-04-15; ETA s.159): consideration in foreign currency is valued in CAD on **"the day the GST/HST is payable"** (the earlier of payment and when consideration is due — for us the invoice date) or another day acceptable to the Minister; acceptable alternatives: the payment day, the day the currency was acquired, or the **monthly average for the month tax became payable**. Rate source (¶13): the source actually used for the conversion, the source the person typically uses, a Canadian chartered bank, the **Bank of Canada**, or the CBSA rate; a database that doesn't buy or sell currency is not acceptable. Use the chosen day and source consistently for a reasonable period (such as one year), keep documentation, weekend/holiday = prior business day.
**Is Stripe's own CAD figure acceptable?** Stripe Tax exports carry `filing_exchange_rate` / `filing_total_sales` (rate "at the time of the transaction", Stripe's rate), **but the filing columns may be empty for `not_collecting` / `not_subject_to_tax` rows** — which may be exactly the US zero-rated rows — and the rate source isn't one of Memo 3-6's named sources unless it is the one used for the actual conversion (UNCONFIRMED). A balance-transaction CAD amount is a payment-day figure and doesn't exist for unpaid invoices that still belong on line 101.
**Recommendation (one rule):** for each USD invoice, convert the pre-tax amount at the **Bank of Canada daily rate for the invoice date** (prior business day if none), store USD amount, rate and date on the sale, and use the same rule for any USD tax figure. Use no other method in the same year. Stripe's figures are a cross-check only.
Expenses: the GST/HST on a foreign vendor's invoice is normally stated in CAD; use that figure. If ever stated in a foreign currency, convert the same way (Memo 3-6 applies to payments too).

### 6. Tax point
CONFIRMED (RC4022): "You are liable for the GST/HST you charge ... on the **earlier** of" the payment date and the due date; payment is generally treated as due on the **invoice date** or the agreement date, whichever is first; "If you issue an invoice before you receive the payment, include the GST/HST charged on this invoice" in the period covering the invoice date, even if unpaid. For subscription invoices the worksheet reads the **invoice issue (finalization) date**, which is also when Stripe Tax records the transaction ("effective on the date they finalize"). Open point (already in UNPAID_SUBSCRIPTION_INVOICES.md): ETA s.152(2) licence rule — whether it changes the date for SaaS — is unresolved. Credit notes: the period the credit note is issued; bad debts: the period of the write-off or later.

### 7. What goes where for FieldLogicHQ
| Our record | Return line | Notes |
|---|---|---|
| Invoice issued to a Canadian club (amount before tax) | 101 | by invoice date, CAD, whole dollars |
| Invoice issued to a US club, zero-rated (CAD at BoC invoice-date rate) | 101 (or 91) | tax 0; never in 103 |
| GST/HST on invoices issued | 103 | gross, paid or not |
| Recovered bad debt (written-off invoice paid later) | 104 | tax fraction |
| Vendor refund/credit of tax we already claimed | 104 | |
| Meals ITC claimed above 50% (if ever) | 104 | once a year |
| Total of 103 + 104 | 105 | calculated |
| ITC on expenses: claimable GST/HST x ITC % (operating / capital / meals rule) | 106 | not tax x business-use % for capital; exclude simplified-vendor tax; exclude pre-registration services; documentation tier met |
| Stripe credit notes issued (tax fraction) | 107 | line 103 stays gross |
| Bad-debt write-off (tax fraction, within four years) | 107 | uncollectible invoices written off |
| Total of 106 + 107 | 108 | calculated |
| Net tax (105 - 108) | 109 | negative = refund |
| Quarterly instalments | 110 | only if required |
| Rebates | 111 | none expected |
| Negative / positive result | 114 / 115 | |
| Real property purchase; emission allowances | 205 | not relevant |
| Self-assessed provincial HST on imports | 405 | edge only; warn, don't compute |
| Tax charged by a simplified-registered foreign vendor | none | "not claimable" list, excluded from 106 |
| PST / QST charged on an expense | none | outside this return |

## Recommendation
1. Draw the worksheet as **regular method only**, lines 101, 103, 104, 105, 106, 107, 108, 109 (and 110-115 as optional read-only outcomes); keep credit notes and bad debts on 107, recoveries on 104, USD zero-rated sales in 101 only.
2. Expense form capture: per-expense GST/HST by type (GST / HST), supplier GST/HST number as printed, supplier registry status (Normal / Simplified / Not registered / Not checked), expense kind (operating / capital / meals), business-use %, invoice total (for the documentation tier), and the foreign-supplier flag with the meaning in §4. Exclude charges dated before the registration effective date unless they are capital property still held.
3. Sales: store the USD amount, the BoC rate and its date for every USD invoice.
4. Label the worksheet an aid, not the return: the owner reads the first return against CRA's own screens.
5. Facts to fill in: registration effective date, filing frequency, and that no quick-method election was made.

## Sources
- [CRA, Instructions for preparing a GST/HST return](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/complete-file-instructions.html) — accessed 2026-11-06 (page details show 2021-04-27)
- [CRA RC4022, General Information for GST/HST Registrants](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html) — accessed 2026-11-06 (bad debts, line 107/104, credit-note example, tax point, quick method, ITC receipt tiers, 90% rule)
- [CRA, Input tax credits](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html) — accessed 2026-11-06 (modified 2026-10-14)
- [CRA, ITC eligibility percentage](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit/calculate-eligibility-percentage.html) — accessed 2026-11-06 (modified 2026-02-03)
- [CRA, Confirming a simplified GST/HST account number](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy-gsthst/confirming-simplified-gst-hst-account-number.html) — accessed 2026-11-06
- [CRA Memo 12.2, s.232 refunds, adjustments, credits](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/12-2/refund-adjustment-credit-gst-hst-under-section-232-excise-tax-act.html) — accessed 2026-11-06 (¶22-26)
- [CRA Memo 3-6, Conversion of foreign currency](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/3-6/conversion-foreign-currency.html) — accessed 2026-11-06
- [CRA Memo 8-5, Becoming and ceasing to be a registrant](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/8-5/becoming-and-ceasing-to-be-a-registrant.html) — accessed 2026-11-06 (June 2026)
- [CRA RC4033, General application for GST/HST rebates (reason code 1C)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4033/general-application-gst-hst-rebates.html) — accessed 2026-11-06
- [Stripe, Tax reporting](https://docs.stripe.com/tax/reports) — accessed 2026-11-06
- Secondary pointers only (self-assessment on imports, not cited as findings): CRA RC4027 and Memo B-079 search results, 2026-11-06

## Professional sign-off needed?
Yes, before the first filed return: (a) the first returns will be refund claims (net tax negative) and may be reviewed, so the ITC documentation and pre-registration cut-off should be checked; (b) the ITC % for capital items vs the income-tax claim; (c) any foreign-vendor self-assessment (§4 edge); (d) the currency method. The worksheet design itself needs none.
