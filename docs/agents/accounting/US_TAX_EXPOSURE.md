# US tax exposure for a Canadian sole proprietor selling to US clubs
**Last verified:** 2026-10-31
**Re-verify by:** when the first US club signs; when US revenue in any one state passes ~US$50,000; if FieldLogicHQ
incorporates, opens a US office, hires in the US, or the owner works from the US; Texas Rule 3.330 outcome
**Depends on facts:** sole proprietorship (individual); no US entity, office, staff or owned servers; US clubs would get
their own Stripe accounts as merchant of record; club Stripe accounts are set up so **FieldLogicHQ controls pricing**
(fees collected by the platform)

## Question(s) this answers
- Does FieldLogicHQ owe US income tax, state sales tax, or state gross-receipts tax?
- Is FieldLogicHQ a "marketplace facilitator" for US clubs' registrations?
- Who files Form 1099-K for US clubs?
- What forms might a US customer or processor ask for?

## Finding
- **Federal income tax:** Canada–US treaty Art. VII — a Canadian resident's business profits are taxable only in Canada
  unless carried on through a US **permanent establishment** (Art. V: a fixed place of business). Software-use payments
  are exempt at source (Art. XII(3)(b)). Form 1040-NR is required only if engaged in a US trade or business (even if
  treaty-exempt) or if US-source income had tax under-withheld. Services performed in Canada are foreign-source, so likely
  no US filing — **a cross-border CPA should confirm the "US trade or business" test.** Give **Form W-8BEN** (individual)
  when a US payer/processor asks; never sent to the IRS; valid ~3 calendar years; not giving it can trigger withholding.
  US revenue is reported in Canada on T2125 like any other income.
- **State sales tax on SaaS:** physical presence is not required (*Wayfair*, 2018); no state found exempts foreign
  sellers. Thresholds are mostly **US$100,000 of sales into the state** (TX, CA, NY $500,000; AL, MS $250,000); many
  states have dropped the 200-transaction test (IL from 2026-01-01). SaaS is taxable in some states — TX (80% of the
  charge), PA, NY, CT (1% business use), WA and OH (unverified) — and exempt in many.
- **State gross-receipts taxes don't follow the treaty:** WA B&O registration at US$100,000 WA gross receipts (fee and
  commission income counts); TX franchise tax nexus at US$500,000; OH CAT nexus at US$500,000 but no tax below the
  US$6M exclusion (OH figures unconfirmed). P.L. 86-272 protects only sellers of goods, not SaaS.
- **Marketplace facilitator laws — the biggest open US risk.** Facilitators (run the marketplace + collect payment for
  third-party sellers) must collect sales tax on facilitated sales, and in some states (e.g. WA) facilitated sales count
  toward the facilitator's own threshold. Most laws cover retail sales of goods; WA refused to read services in.
  Admissions/participation fees are taxable in some states (MN admissions; KS taxes admissions but exempts under-18
  charity participation fees; TX and WA have youth-nonprofit exemptions). No state source settles a Stripe Connect
  platform where the **club** is merchant of record selling **services**. Stripe Tax by default does not count Connect
  sales toward the platform's thresholds. Texas: a 2026-09-30 executive order directs un-taxing platform/marketplace fees
  (Rule 3.330), not yet final.
- **Form 1099-K:** threshold is back to **> US$20,000 AND > 200 transactions** (One Big Beautiful Bill Act, retroactive;
  IRS FAQ 2025-10-23). Per Stripe, **Stripe files only when the connected account pays Stripe's fees itself; where the
  platform controls pricing (fees collected by the application), the platform must file.** FieldLogicHQ's clubs are set
  up the second way.

## Recommendation
1. Don't build US sales-tax collection for subscriptions now — at $39–$379 a month, a US$100,000 threshold in any one
   state is many hundreds of clubs away. Turn on Stripe Tax monitoring for US states and register when it alerts.
2. **Before any US club takes payments:** (a) decide the 1099-K filer — either set US club accounts up so Stripe files
   (the club pays Stripe's fees, which changes the fee model) or file through Stripe's Connect tax-reporting product as the
   platform; (b) get a marketplace-facilitator opinion for the states the first clubs are in; (c) the clubs' payout
   accounts need to be US accounts in USD (today they are hard-wired to Canada and CAD).
3. Keep a W-8BEN ready; keep everything run from Canada (no US office, staff, or contracts signed by a US agent).

## Sources
- [Canada–US tax convention, consolidated](https://www.canada.ca/en/department-finance/programs/tax-policy/tax-treaties/country/united-states-america-convention-consolidated-1980-1983-1984-1995-1997-2007.html) — accessed 2026-10-31
- [IRS — Instructions for Form W-8BEN](https://www.irs.gov/instructions/iw8ben) · [Instructions for Form 1040-NR](https://www.irs.gov/instructions/i1040nr) — accessed 2026-10-31
- [IRS — 1099-K threshold FAQs (OBBBA)](https://irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000) — accessed 2026-10-31
- [Stripe — Connect tax reporting (who files)](https://docs.stripe.com/connect/tax-reporting) — accessed 2026-10-31
- [Streamlined Sales Tax — marketplace facilitator](https://www.streamlinedsalestax.org/for-businesses/marketplace-facilitator) — accessed 2026-10-31
- [Washington DOR — marketplace facilitators](https://dor.wa.gov/taxes-rates/retail-sales-tax/marketplace-fairness-leveling-playing-field/marketplace-facilitators) · [remote sellers / B&O](https://dor.wa.gov/taxes-rates/retail-sales-tax/marketplace-fairness-leveling-playing-field/remote-sellers) — accessed 2026-10-31
- [Texas Comptroller — remote sellers](https://comptroller.texas.gov/taxes/sales/remote-sellers.php) · [data processing (SaaS 80%)](https://comptroller.texas.gov/taxes/publications/96-259.php) · [youth sports exemption](https://comptroller.texas.gov/taxes/exempt/youth-sports.php) · [2026-09-30 platform-fee order](https://comptroller.texas.gov/about/media-center/news/20260930-comptroller-don-huffines-ends-hidden-double-tax-on-texas-families-and-small-businesses-1790708719803) — accessed 2026-10-31
- [Illinois DOR bulletin FY 2026-12](https://tax.illinois.gov/research/publications/bulletins/fy-2026-12.html) — accessed 2026-10-31
- [Stripe Tax — monitoring](https://docs.stripe.com/tax/monitoring) — accessed 2026-10-31

## Professional sign-off needed?
**Yes** — a US cross-border CPA for (1) the 1099-K filer decision, (2) marketplace-facilitator exposure in the first US
clubs' states, (3) confirming no 1040-NR filing. All before the first US club takes payments; none is needed to sell
subscriptions to US clubs.
