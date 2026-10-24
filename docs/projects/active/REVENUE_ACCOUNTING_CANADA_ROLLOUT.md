# Canada-wide launch — geography, taxes and focused review

> **Owner decision, 2026-10-23:** launch across all of Canada, in CAD, with subscriptions AND registration payments. No province-by-province rollout or referral waitlists. Release when ready; no artificial date.
> **Active charter:** [project plan](REVENUE_ACCOUNTING_READINESS_PLAN.md) · **Review:** [artifact](REVENUE_ACCOUNTING_REVIEW.html#index).

## 1. Recommendation and its limits

A Canadian/CAD business is a coherent launch scope. It avoids U.S. state tax/nexus and USD pricing/settlement work while retaining a national market. The same federal regime and currency help, but they do not eliminate separate provincial tax, contract, language or privacy questions.

The owner explicitly includes registration payments. Therefore Connect onboarding, the fee supply, registration versus platform-fee tax, refunds/disputes and payout funding remain launch essentials. They cannot be deferred on the assumption this is subscription-only SaaS.

Use a bounded Canadian review, not a fifty-state engagement or premature corporation/FX project. Keep the bookkeeping process simple while proving its ability to distinguish proprietor revenue, organizer money and taxes.

## 2. Signup and payment are distinct

- Keep the Canadian referral/signup path available nationwide under existing product eligibility. A person's province is not a reason to stop creating an account.
- Collect the actual contracting customer's country/province/address and relevant organization/use-location facts during ordinary onboarding and checkout.
- Do not use IP, language, email domain, card country or the event location alone to classify every software subscription. Those facts describe different things.
- Canadian customers receive the same eligible CAD subscription paths; Canadian organizers have the same supported Connect onboarding.
- Canadian teams/participants can pay Canadian events across provincial borders. Registration location/tax rules are assessed for the actual registration product, not copied from SaaS rules.
- Test an Ontario club referring a BC club, Quebec club signup, a parent from another province paying an Ontario event, and a coach travelling outside the province. A travel signal must not become a geographic lockout.
- Do not treat free access as removing non-tax privacy/contract/language duties.
- Finish national readiness before the coordinated paid launch. Incomplete provincial setup is a task to resolve before launch, not a new waitlist feature.

No runtime signup or paid-checkout restriction has been implemented by this document.

## 3. Provincial review worksheet

This is a checklist for application to the actual supply, not an approved tax matrix. All rows require evidence before the national launch; several share the same federal analysis. Register only where the reviewed facts require registration.

| Province/territory | Main review for software subscriptions | Registration/fee review |
|---|---|---|
| Ontario | GST/HST status, effective date and place of supply | Registration classification, exemptions, platform fee and remitter |
| New Brunswick | GST/HST rate/place-of-supply treatment | Same distinct registration/fee determination |
| Newfoundland and Labrador | GST/HST rate/place-of-supply treatment | Same distinct registration/fee determination |
| Nova Scotia | GST/HST rate/place-of-supply treatment; current rate from provider | Same distinct registration/fee determination |
| Prince Edward Island | GST/HST rate/place-of-supply treatment | Same distinct registration/fee determination |
| Alberta | Federal GST status/place of supply | Same distinct registration/fee determination |
| British Columbia | Federal GST + software PST registration/use-location rules | Separate applicability of provincial tax and fee treatment |
| Saskatchewan | Federal GST + SaaS PST/provider collection rules | Separate applicability to registration and platform services |
| Manitoba | Federal GST + software/cloud-computing RST and registration rules | Separate applicability to registration and platform services |
| Quebec | Federal GST + QST system/customer/registration conditions | Registration exemptions, fee supply and any platform responsibility |
| Northwest Territories | Federal GST status/place of supply | Actual supply/event classification and remitter |
| Nunavut | Federal GST status/place of supply | Actual supply/event classification and remitter |
| Yukon | Federal GST status/place of supply | Actual supply/event classification and remitter |

For each row/supply, record: registration required now versus supported no-registration conclusion; effective date; product code/classification; location evidence; exemptions and supporting records; collector/filer/remitter; periodic return deadlines; threshold basis where applicable; and Stripe/provider coverage or a documented alternative. Store current rates in the tax provider/configuration rather than this prose.

## 4. Specific official-source findings

### Federal GST/HST

One federal registration framework does not mean every province has the same rate. CRA's place-of-supply rules determine the applicable GST/HST treatment. The owner's small-supplier/voluntary registration decision must account for actual facts, including other proprietor activities. Once registered, the applicable obligations follow the effective date.

Sources: [CRA place of supply](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-place-supply.html), [voluntary registration](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/account-register-voluntarily.html).

### Quebec

For an out-of-Quebec supplier registered under the general GST/HST system, the specified QST regime has conditions including qualifying supplies to specified Quebec consumers and a threshold exceeding $30,000 over 12 months. That is not a universal exemption for all Quebec business or platform sales; customer registration status and any platform rules need the correct analysis.

Separately, OQLF guidance addresses standard-form contracts and circumstances for using another language. Confirm applicability to this Ontario provider and its actual contract/service model. A QST registration threshold does not settle language or privacy obligations.

Sources: [Revenu Québec specified-system conditions](https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/special-cases-gsthst-and-qst/suppliers-outside-quebec/qst-registration-for-suppliers-outside-quebec/registration-under-the-specified-system-suppliers-outside-quebec-who-are-registered-under-the-general-gsthst-system/), [OQLF standard-form contracts](https://www.oqlf.gouv.qc.ca/francisation/entreprises/contrats-adhesion.html).

### British Columbia

Software/SaaS has specific PST treatment. Relevant out-of-province software registration rules include the BC revenue threshold and prospective revenue estimates. The general software rules consider where devices are ordinarily situated, not billing address alone in every case.

Sources: [BC software guidance](https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/publications/software), [registration rules, including section 172.2](https://www2.gov.bc.ca/gov/content/taxes/tim/pst/parts/pt-8).

### Saskatchewan

The official software bulletin expressly covers hosted SaaS and resident/nonresident provider collection. Do not apply the federal small-supplier allowance as a blanket provincial software allowance. Review our exact supply and any relevant exceptions.

Source: [Saskatchewan software/SaaS bulletin](https://sets.saskatchewan.ca/rptp/wcm/connect/a1169319-a762-4328-b84c-88d844e8f340/PST.007%2BComputer%2BHardware%2C%2BSoftware%2B%26%2BComputer%2BServices.pdf?MOD=AJPERES).

### Manitoba

The January 2026 software/online-services bulletin covers cloud computing from January 1, 2026, including software/use-location and apportionment issues. Determine seller registration obligations separately; the bulletin's taxability statement alone is not a full registration opinion.

Source: [Manitoba RST 033](https://www.gov.mb.ca/finance/taxation/pubs/bulletins/033.pdf).

## 5. Focused accountant / legal / Stripe package

The old international briefing in the [discovery packet](REVENUE_ACCOUNTING_DISCOVERY.md) remains historical preparation. The current requested work is:

1. Confirm current GST/HST facts and the Canadian-only worksheet above for software, organizer registrations and platform fees.
2. Resolve the fee supplier/recipient and invoice/tax model under the existing family-pays direction. Separately identify who holds/remits each tax amount.
3. Confirm any applicable Canadian platform/reporting/payment-regulatory duties for the chosen direct-charge model. Use the existing counsel brief as a question list, updating its old scope/assumptions.
4. Review the actual Canadian terms, Quebec language/contract applicability and privacy handling required for national signup and registrations. Keep the engagement bounded to actual launch products.
5. Confirm Canadian Connect configuration, organizer identity/bank onboarding, payment methods, fee payer/loss responsibility, refunds and payout/negative-balance funding with Stripe.
6. Set up one eligible CAD platform payout arrangement plus reliable tax/fee/refund records. Choose a simple ledger/export process first if it can reconcile the full model.
7. Assign actual filing, remittance and monthly review duties. A configured tax engine is not a completed return or a registration determination.

U.S. software customers, USD settlement, premium household products and corporation execution are not part of this engagement. Nothing in this packet has been sent externally by the assistant.

## 6. Readiness and next evidence

The [Phase 0 review packet](REVENUE_ACCOUNTING_PHASE0_REVIEW.md) expands this brief into explicit supply/collector decisions, bank/accounting comparisons and professional-request drafts. Use the [52-row response sheet](REVENUE_ACCOUNTING_PHASE0_TAX_REVIEW.csv) to record actual conclusions across the four supply categories and 13 jurisdictions; all rows begin pending. It is not a tax-rate lookup table.

Complete the Canadian worksheet, actual required registrations, account-specific provider answers, fee/refund/terms policy, and end-to-end national tests before paid launch. The owner accepts the necessary lead time and does not want staged provinces. Mark research/preparation complete separately from professional conclusions and implementation.
