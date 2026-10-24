# Revenue readiness — discovery evidence and briefing packages

> **Prepared:** 2026-10-23 · **Scope:** repository review and read-only Stripe configuration inventory.
> **Roadmap:** [project plan](REVENUE_ACCOUNTING_READINESS_PLAN.md) · **Tracking:** [progress register](REVENUE_ACCOUNTING_PROGRESS.json) · **Review:** [web artifact](REVENUE_ACCOUNTING_REVIEW.html#index).

> **Scope update, 2026-10-23:** the latest owner direction is Canada-wide CAD subscriptions AND registration payments. U.S./USD, premium family/fan products and incorporation are deferred. The original international questions below remain historical preparation; use the focused [Canadian rollout packet](REVENUE_ACCOUNTING_CANADA_ROLLOUT.md) for the current engagement. Preparing a brief does not establish professional answers or change live configuration.

## 1. What was verified

The audit used the repository's live and sandbox Stripe credentials from their respective local environment files. Credentials stayed inside the process. Only account, active-price/product, tax-settings, tax-registration, webhook and billing-portal **retrieve/list** APIs were requested. No Stripe setting or customer/payment record was changed; the inventory does not query customers or transaction history.

- [Live configuration evidence](revenue-accounting-evidence/stripe-live-2026-10-23.json)
- [Sandbox configuration evidence](revenue-accounting-evidence/stripe-sandbox-2026-10-23.json)
- Reusable manual inventory: `node scripts/audit-revenue-readiness.mjs --env <environment file> --mode live|sandbox --date YYYY-MM-DD --out docs/projects/active/revenue-accounting-evidence/<report>.json`.

Both inventories completed all six sections without API errors. Each active-price inventory returned a complete list of 14 prices. Currency options were explicitly expanded; none contained USD.

The existing `scripts/audit-stripe-billing.mjs` remains unchanged. Its fixed price expectations include retired catalog assumptions, so this discovery did not treat its pass/fail totals as the current revenue-readiness standard.

## 2. Current findings

| ID | Verified observation | Implication and next work |
|---|---|---|
| R01 | Live and sandbox each have 14 active prices; default and expanded currency options are CAD only. | USD subscription pricing needs approved amounts, Stripe prices and app catalog support. No USD price was created. |
| R02 | Live Tax settings status is `active`, with a default tax code and country present, but the tax-registration list is empty. | Active settings are not evidence of tax registrations. Confirm the proprietor's actual registrations/effective dates and add the required registrations before affected taxable sales. This audit does not determine legal registration obligations. |
| R03 | Sandbox Tax settings status is `pending`, with `head_office` missing; its registration list is empty. | Set up a deliberate sandbox tax configuration and fixtures before tax acceptance testing. |
| R04 | All 14 live prices have `tax_behavior=unspecified`; sandbox prices have `exclusive`. | Approve the tax-inclusive/exclusive policy and remove ambiguity/environment drift before launch. Do not infer an actual mischarge from this setting alone. |
| R05 | Live product tax codes are consistent; sandbox has two products using a different code from the other twelve. | Verify the intended product classifications with the accountant, then align fixtures. A configured tax code is not an accountant-approved classification. |
| R06 | Live and sandbox subscription webhooks are enabled on their expected application hosts using the repository's pinned API version. Sandbox additionally subscribes to `invoice.payment_action_required`. | Reconcile event coverage against actual handlers and planned payment methods; do not treat the endpoint existing as financial-event completeness. |
| R07 | Both default portals show invoices and permit customer updates; subscription cancellation and subscription changes are disabled. Live permits `tax_id` updates; sandbox does not. | Preserve app-owned plan/cancellation flows unless deliberately changed. Test billing-detail/tax-ID changes and keep environment policies intentional. |
| R08 | The live account is Canadian, business type `individual`, default currency CAD, with charges and payouts enabled. | Confirms existing account configuration only. It does not verify bank ownership, USD settlement capability or the future corporation migration path. |
| R09 | Owner confirmed 2026-10-23 that accountant selection is required and no separate business bank account exists yet. | Add named accountant-selection and banking/settlement stages before financial launch readiness. A Stripe `payouts_enabled` flag does not establish a separate business-bank setup. |

## 3. Repository audit

| Surface | Evidence | Required change/design |
|---|---|---|
| Price identity | `lib/stripe-prices.ts` resolves plan + cycle + environment, without currency. | Add explicit currency/market resolution and preserve historical reverse mappings. |
| Price validation | `lib/stripe-price-validation.ts` rejects non-CAD prices. | Extend the existing validator rather than bypassing it. |
| Organization checkout | `app/api/billing/create-checkout/route.ts`, real Checkout builder near line 331. | Integrate verified location/currency, address collection, tax activation and customer updates. |
| Coach checkout | `app/api/billing/create-team-checkout/route.ts`, builder near line 322. | Apply the same policy while preserving coach/workspace identity and ownership. |
| Future-season/card setup | `lib/next-season-choice.ts` and `lib/billing-setup.ts`. | Include deferred first-charge and setup-only paths; preserve the current runtime promotional dates and promise not to charge early. |
| Paid plan moves | `lib/plan-move.ts`, target-price resolution near line 164. | Resolve target prices in the subscription's currency and test proration/tax at preview and confirmation. |
| Webhook handling | `app/api/billing/webhook/route.ts` verifies signatures and returns early for event objects without a customer. Event IDs are used for notification sources. | Connect/payout/balance events need account-aware handling; separately prove durable financial deduplication and replay. Notification IDs alone do not prove that journal. |
| Marketing | `components/PricingSection.tsx` emits CAD labels; `app/pricing/page.tsx` promises CAD-only billing. | One approved CAD/USD catalog must drive the marketing-to-renewal experience. |
| Readiness checks | `app/api/dev/team-checkout-readiness/route.ts` checks CAD prices. The legacy audit contains historical fixed price expectations. | Extend readiness to currency, tax and current catalog facts in the implementation phase. This discovery leaves shared checks unchanged. |
| Connect/tax integration | Targeted application/library searches did not find Connect fee/account wiring or explicit automatic-tax/address/tax-ID collection settings. | These are implementation gaps, not features that a Dashboard switch alone completes. |

This is an inspected-path audit, not a full code/security review. Full database/live price mapping, customer history, deployed environment settings, accounting reconciliation and actual charge behaviour remain separate work items. The absence of a webhook secret from a local production environment file would not prove it is missing from the deployed application.

## 4. Accountant selection and briefing package — prepared, answers pending

### Engagement brief

FieldLogicHQ is an Ontario sole proprietorship providing sports-organization software. Web subscription customers can be organizations, individual coaches and later adult household/fan purchasers across Canada and the United States. Stable CAD/USD subscription prices are decided; USD amounts remain open. The owner intends GST/HST registration, requires accountant selection, and has no separate business bank account as of 2026-10-23.

A second model uses organizer-owned Stripe Connect accounts and direct registration charges, with FieldLogicHQ receiving an application fee. Existing commercial direction is family-pays, paid organization tiers and rail-specific pricing. The contractual recipient of the platform service needs confirmation; family payment and application-fee transfer mechanics alone do not establish the taxable supply. Do not assume all organizer proceeds are proprietor revenue.

### Required expertise and evaluation

Seek an accountant who can demonstrate Canadian SaaS GST/HST/provincial-tax experience, U.S. sales-tax/nexus and marketplace coordination, CAD/USD bookkeeping, Stripe/Connect reconciliation, and sole-proprietor-to-corporation transitions. Ask what is handled directly versus referred to U.S. or legal specialists. Compare engagement scope, turnaround, ongoing filing/close responsibility, backup cover and recurring cost; the owner selects the firm.

### Questions / requested deliverables

1. Confirm actual GST/HST effective date, prior revenue and any other proprietor businesses; identify any historical corrective work.
2. Produce a jurisdiction/product workbook for Canadian provinces/territories and U.S. states/DC, plus an explicit territories decision, covering organization/individual software subscriptions and later registration/fee supplies.
3. Document classification, location evidence, export/zero-rating and exemption requirements; registration thresholds and effective dates; required returns including nil returns; and collector/filer/remitter ownership.
4. Resolve the transaction fee's supplier/customer and invoicing under family-pays and any approved organizer-absorb option. Determine fee tax separately from registration tax and any marketplace duties.
5. Draw and approve each supported flow: payer → charge → tax/fee amounts → organizer/platform balances → bank → accounting entries. Explain how any platform-remitted registration tax is funded.
6. Recommend accounting basis, annual-prepayment treatment, CAD FX source/date, tax-control accounts, fee/expense tax recovery, record retention and month-end procedure.
7. Help evaluate accounting systems/connectors using one USD subscription, refund and application-fee reconciliation; nominate the bookkeeper, return filer, remitter and backup.
8. Recommend the necessary business bank/settlement arrangement and a later incorporation cutover approach, coordinated with Stripe rather than assuming an account rename is sufficient.

**Acceptance:** written, reviewable conclusions and operating responsibilities, not a general reassurance that Stripe handles tax. Preparing this brief is complete; selecting/engaging the accountant and receiving these deliverables are open stages. Nothing has been sent to a third party.

## 5. Stripe capability briefing package — prepared, responses pending

Ask Stripe about this specific Canadian platform/account configuration, preserving the direct-charge direction:

1. Can this platform onboard Canadian and U.S. organizers under the intended Express/controller configuration and collect platform application fees on direct charges in each intended currency?
2. Who is configured to pay Stripe fees and bear payment losses? Which controls are available, and how do they affect costs, reporting and tax invoices?
3. Can stable CAD/USD Prices be used consistently across Checkout, renewals, invoice previews and the Customer Portal? Which localization/Adaptive Pricing settings could override the intended promise?
4. What supported CAD/USD settlement bank arrangements are available for this Canadian proprietor, including account-country requirements, conversion/payout charges and refund funding?
5. Which card, Canadian PAD and U.S. bank-payment methods are supported for each account country/currency/charge type? Confirm mandates, availability, returns and dispute obligations.
6. How should registration tax settings, liable account and fee-tax records be configured separately? Demonstrate calculation, recording, reversal and reporting of tax on the platform's fee.
7. Which embedded/Dashboard tax settings are available to the chosen connected accounts? Which event/performance or other taxes are outside coverage?
8. Which connected-account events and account-scoped API/report exports are required for payments, fee refunds, disputes, restrictions, balances and payouts?
9. What filing/reporting services cover an ordinary Ontario domestic registrant and U.S. registrations, and which responsibilities remain with FieldLogicHQ or organizers?
10. How should a later proprietor-to-corporation migration preserve subscriptions/payment methods, Connect relationships and historic refunds/disputes?

Request a capability/configuration matrix and current account-specific pricing, with unsupported combinations called out. A sent question or generic documentation link is not a confirmed capability. No support message has been sent by this assistant.

## 6. Next implementation batch proposal

Prepare the accounting-system/connector comparison, USD pricing and margin proposal, and banking/settlement options once owner budget and accountant input are available. In parallel, design the currency-aware catalog and shared quote contract without changing live prices or tax settings prematurely.

Then implement the shared foundation and subscription Gate A from the approved model. Keep transaction Gate B tied to Club Stage 12 and its existing legal dependencies. The current 6–9-week subscription estimate remains provisional until the accountant/banking/registration dependencies and staffing are resolved.

## 7. Progress evidence rules

Stage completion is recorded in `REVENUE_ACCOUNTING_PROGRESS.json`, with a completion date and evidence link. The artifact is regenerated with `node scripts/build-revenue-review.mjs`. The register is the single source for ticks; the browser does not write progress to local storage or declare legal decisions complete.

Professional brief preparation, professional response, implementation, automated verification, owner browser QA and launch evidence are separate milestones. No whole phase is complete while any of its required stages remains open.
