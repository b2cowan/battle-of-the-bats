# Expansion reference — original Canada/U.S. roadmap

> Preserved as an expansion reference on 2026-10-23. The owner's latest decision is a nationwide Canadian/CAD launch with BOTH subscriptions and registration payments. The active [launch plan](REVENUE_ACCOUNTING_READINESS_PLAN.md) supersedes this historical roadmap's scope and estimates. U.S./USD, premium household subscriptions and corporation execution are deferred; Canadian Connect/registration readiness remains required. Do not use this reference to reintroduce international prerequisites or to remove registration payments from launch. Historical decisions and audit evidence remain available here.

# Revenue and accounting readiness — Canada and United States

> **Status:** Charter created 2026-10-21; discovery sprint authorized 2026-10-23. Repository audit, read-only live/sandbox Stripe configuration inventories and professional briefing packages completed 2026-10-23; professional determinations and implementation are tracked stage by stage below.
> **Owner:** FieldLogicHQ proprietor, Ontario, Canada. Future corporation is a separate transition workstream.
> **PM brief:** [REVENUE_ACCOUNTING_READINESS_PM_BRIEF.md](REVENUE_ACCOUNTING_READINESS_PM_BRIEF.md)
> **Interactive review:** [REVENUE_ACCOUNTING_REVIEW.html](REVENUE_ACCOUNTING_REVIEW.html) — executive overview, stages/timing scenarios, decision register and PM brief; local artifact prepared 2026-10-21.
> **Outcome:** Every supported buyer understands what they will pay; the platform charges the intended currency, calculates applicable tax under the correct seller's registrations, records the complete money trail, and produces reconcilable books and filing information with minimal recurring work.

## 0. Project index and completion protocol

The artifact now opens on its [phase/stage index](REVENUE_ACCOUNTING_REVIEW.html#index). [REVENUE_ACCOUNTING_PROGRESS.json](REVENUE_ACCOUNTING_PROGRESS.json) is the canonical completion register: six phases, stable stage IDs, explicit future stage placeholders, status, completion date and evidence links. [Discovery evidence and briefing packages](REVENUE_ACCOUNTING_DISCOVERY.md) contain the first completed sprint deliverables.

**Maintenance requirement for subsequent work:** update the relevant stage in the progress register in the same unit of work as its verified deliverable. A completed stage requires a date and evidence; a whole phase is complete only when all its stages are complete. Keep professional brief preparation, professional response, implementation, automated checks, owner browser QA and launch evidence distinct. Expand a stub into concrete stages when its phase opens without silently deleting unfinished scope.

After updating progress, the PM brief or decision register, run `node scripts/build-revenue-review.mjs` to refresh the self-contained HTML. The generator checks stage IDs, statuses, local evidence files and embedded JavaScript syntax. The index and roadmap derive their counts from that single register; browser checkboxes are read-only and do not create a separate local-storage truth. Update the root TODO summary for material milestones and keep the overall project open until its definition of done is met.

Ticks measure completed named deliverables, not weighted engineering effort or legal compliance. Refresh the artifact and include its link at each stage handoff. Hosted publication is separate from the local artifact; the earlier Sites export rejection remains a historical action, not an authorization to upload future financial evidence.

## 1. Scope and owner decisions

### Confirmed in this conversation, 2026-10-21

- Launch subscription purchasing must support customers throughout Canada and the United States. Do not solve compliance by excluding states or provinces.
- Canadian subscription customers see and pay CAD; U.S. subscription customers see and pay USD.
- **Stable, separately set CAD and USD subscription prices**, rather than prices that fluctuate with exchange rates. The actual USD amounts require a commercial decision.
- FieldLogicHQ is presently an Ontario sole proprietorship. The owner intends to register for GST/HST shortly; registration numbers and effective dates remain to be supplied securely.
- Address all three revenue models: organization/coach subscriptions, potential future personal family/fan subscriptions, and percentage transaction revenue on organizer payments.
- **Separate readiness gates:** Canada/U.S. organization/coach subscriptions can launch independently of facilitated registration payments. Personal family/fan subscriptions have their own gate before their first sale.
- **Accounting system is not selected:** compare options before choosing a system or purchasing an integration.
- Automate calculation, documentation, reconciliation, monitoring and filing where supported; make remaining human responsibilities explicit and assign them.

The owner authorized the discovery sprint on 2026-10-23. The same day, the owner confirmed **accountant selection is included** and **no separate business bank account exists yet**. Both are named stages in Phase 0. Discovery authorization includes the read-only audit and preparation work; live settings, prices, tax registrations and financial transactions need their corresponding implementation decisions and evidence.

### Existing decisions this project must carry forward

Read the current [pricing facts](../../agents/strategy/PLAN_PRICING_FACTS.md), [business decisions](../../agents/strategy/BUSINESS_DECISIONS.md), and [facilitated-payments scope](FACILITATED_PAYMENTS_SCOPING_PLAN.md) before implementation:

- Existing plan names, CAD prices, capacities, promotions and entitlement rules retain their canonical homes. This plan does not reprice or unbundle them.
- Facilitated payments use organizer-owned Stripe Connect accounts and **direct charges** as the decided direction. Express-style hosted onboarding is the existing design direction; validate its current capabilities and controller settings with Stripe rather than silently switching account models.
- The existing transaction commercial anchor is rail-specific, with **family-pays as the default**. Organizer absorption is an open decision. Preserve the decided rates in their canonical record; validate current costs, tax treatment and geography before implementation. Do not replace this with an organizer-only commission model by accident.
- Facilitated payments attach to the paid organization tiers under the existing ruling; this conversation does not extend eligibility to free tiers or standalone coach workspaces.
- Payments are part of **Club readiness Stage 12**, under the 2026-10-19 sequencing ruling. Separate technical readiness gates here do not authorize moving the Club release or changing its dependencies.
- Existing counsel review remains a launch dependency for facilitated payments. Its source is the [facilitated-payments scope, legal/compliance section](FACILITATED_PAYMENTS_SCOPING_PLAN.md) and [counsel brief](FACILITATED_PAYMENTS_COUNSEL_BRIEF.md), not a new approval process introduced by this plan.

### Boundaries

- FieldLogicHQ's books and customers' organization/team accounting are distinct. The in-app club ledger is not the proprietor's general ledger.
- Only FieldLogicHQ's own revenue belongs to the proprietor: subscription sales and earned fees, subject to accountant-confirmed gross/net presentation. Organizer registration proceeds and collected taxes must not be swept into proprietor revenue merely because they appear in payment reports.
- Billing currency, tax jurisdiction, language, card-issuer country, event location, settlement currency and accounting currency are separate facts.
- The future family/fan product needs a compatible billing foundation now, but building premium fan features is outside this project.
- No arbitrary percentage surcharge, new payout hold, reserve, or tax exemption is authorized by this plan.

## 2. Success criteria and customer experience

### Customer outcomes

1. A California buyer sees a stable USD price, its billing period and renewal terms; Checkout, invoice, receipt, billing portal and renewals preserve that currency. Applicable taxes are calculated from reviewed rules and registrations; California is not assumed taxable or tax-free without classification.
2. A Quebec buyer sees CAD, supplies the billing information needed for correct GST/QST handling, and sees a clear final total before payment. A business tax ID is not treated as a universal tax exemption.
3. A coach buying personally can distinguish their subscription from a club subscription; a family can later buy its own product without being represented as an organization.
4. A parent registering for a tournament or league sees the legal organizer, event currency, mandatory fees, taxes, payment schedule and refund terms before authorizing payment.
5. Organizers can explain participant charges and reconcile registrations, taxes, platform fees, refunds and payouts. Offline/manual payments continue to work with a clear source and no duplicated online payment.
6. The proprietor can trace an invoice or fee through Stripe to the books and bank, and can see filing deadlines and exceptions without reconstructing a year of transactions.

### Proposed product behaviour for implementation review

- Country-aware subscription pricing defaults to Canada/CAD or U.S./USD, with a visible market selector. Store the confirmed billing country and currency; IP is a hint, never the final tax fact.
- If verified billing country conflicts with the selected market, explain and re-quote before payment. Never change currency invisibly in a live subscription.
- Store a subscription's agreed price version and currency; a customer's travel, VPN, language setting or new card does not reprice it.
- Registration currency follows the organizer/event, even for a visiting U.S. team paying a Canadian event. Do not apply the subscription-localization rule to every registration.
- Prices state CAD or USD explicitly. Annual prices show the actual annual charge prominently; monthly equivalents never masquerade as monthly billing.
- Show applicable government taxes separately where the approved policy permits; include mandatory non-government fees in advertised totals where required. Apply this to public event pages as well as final Checkout. Canadian drip-pricing guidance and California's hidden-fee guidance make this a launch requirement [S8, S9].
- Avoid promising that card issuers never charge conversion or cross-border fees. FieldLogicHQ can promise its charge currency and amount; issuer charges are outside its control.
- Billing admins manage an organization's subscription; the purchasing coach manages their personal subscription; a household's authorized purchaser manages a personal family/fan subscription. Organization staff cannot view another person's billing details by sharing a login email.
- Platform finance/support access is role-scoped and audited. Support can explain a charge without unrestricted authority to change tax registrations, prices or issue refunds.

### Measurable definition of done

- All Canadian provinces/territories and all 50 U.S. states plus DC have a reviewed subscription treatment row; U.S. territories are explicitly included or assigned a separate decision before purchase there. No silent catch-all rule substitutes for review.
- Every sale has a seller, product classification, customer location evidence, currency, price version, tax outcome/reason and source identifiers.
- All active catalog combinations required for launch are validated in sandbox and live configuration; no wrong-currency fallback is possible.
- Daily ingestion has no unexplained gaps or duplicate postings; exceptions have an owner and aging limit. Suggested targets for approval: alerts within one business day, exceptions assigned within two business days, monthly close within five business days.
- Each payout reconciles exactly in its own currency, with explicit rounding adjustments where necessary. Every tax control balance ties to the corresponding provider report or has an assigned documented exception.
- Recurring returns, including nil returns where required, have a named filer, due date, payment method and retained submission evidence.
- Subscription launch does not require the transaction-payment or personal-fan gates to be complete. Each gate's required evidence is listed in section 12.

## 3. Evidence from the repository

Inspected 2026-10-21; these are working-copy observations, not a live-account audit. Preserve concurrent changes in the shared `dev` branch.

| Area | Observed evidence | Work required |
|---|---|---|
| Catalog lookup | `lib/stripe-prices.ts` resolves plan + cycle + environment, with no currency parameter. The saved dev schema snapshot lists no currency column on `stripe_prices`. | Choose an explicit CAD/USD catalog design, adjust mappings and reverse lookup, and validate environment and currency together. Recheck snapshots/live schema before proposing migrations. |
| Price governance | `lib/stripe-price-validation.ts` hard-fails a price whose currency is not CAD; expected amounts come from one amount per cycle in `PLAN_CONFIG`. | Extend existing governance to market/currency, tax behaviour and versioned price expectations rather than bypassing it for USD. |
| Marketing | `components/PricingSection.tsx` constructs CAD price labels; `app/pricing/page.tsx` promises CAD billing. | Inventory and update marketing, onboarding, billing, emails and structured data together after USD prices are decided. |
| Organization checkout | `app/api/billing/create-checkout/route.ts` creates a subscription session using the catalog price and linked customer. | Add validated billing country/currency, required address collection, tax settings and reliable price resolution. |
| Coach checkout | `app/api/billing/create-team-checkout/route.ts` separately creates a Customer and subscription session. | Bring it under the same pricing/tax policy while preserving coach identity, team workspace ownership and existing customer-link safeguards. |
| Tax activation | Search of application/library TypeScript found no `automatic_tax`, `tax_id_collection`, or `billing_address_collection` integration. | Implement end-to-end tax integration; switching on a Dashboard product alone does not establish coverage. |
| Lifecycle | `lib/billing-setup.ts`, `lib/next-season-choice.ts`, `lib/plan-move.ts` and related routes handle saved cards, future choices, trials and prorated moves. | Include all of these, renewals, portal changes, reactivations, comp periods and cancellations in the tax/currency audit. |
| Webhooks | `app/api/billing/webhook/route.ts` is subscription-oriented, verifies signatures and returns early for objects without a customer. | Audit durable deduplication and replay; use separate account-aware event handling for Connect/balance/payout events that need not carry `customer`. Do not claim notification deduplication is a financial ledger. |
| Connect | Search found no application-fee, transfer-data, Stripe-Account or account-onboarding implementation in application/library TypeScript. | Build Stage 12's foundation under the existing direct-charge direction, including account-scoped reconciliation. |
| Prior planning | Facilitated scope carries direct charges, family-pays, paid-tier eligibility, and counsel dependencies. Its old economics examples mix a prior rate with a later ratified rate. Counsel brief still describes Canada/CAD only and an older launch date. | Recalculate economics from the canonical decision and current Stripe configuration; refresh the counsel pre-read for Canada/U.S., consumer billing and actual launch sequencing. |
| Operations docs | The old Stripe setup guide uses retired plan labels/environment-price instructions. The billing program and smoke-test note include superseded promotional dates. | Replace or amend their relevant guidance at implementation handoff; use current runtime promo constants and pricing canon, never copy historical dates. |

Account access, Dashboard products/prices, tax registrations, settlement capabilities, existing paid customers, volume and historical tax exposure are **verification tasks**, not assumed facts. Never print secrets, tax IDs or bank details in reports.

**Discovery update, 2026-10-23:** [read-only live/sandbox evidence](REVENUE_ACCOUNTING_DISCOVERY.md) now verifies six Stripe configuration areas in each mode. Each catalog has 14 active prices and CAD-only expanded currency options. Live Tax settings are active with zero configured tax registrations; sandbox Tax settings are pending. Live price tax behaviour is unspecified while sandbox is exclusive. Tax classification, legal registration sufficiency, customer history, bank/settlement arrangements and end-to-end charging remain separate determinations. The introductory working-copy table above records the earlier code review; this dated update adds the live evidence without claiming the application is tax-ready.

## 4. Target commercial and financial model

### Three revenue tracks

| Track | Seller and buyer | Proposed billing owner | Main requirements |
|---|---|---|---|
| A. Organization/coach subscription | FieldLogicHQ sells software to the actual contracting organization or individual coach. A coach is not automatically a B2B buyer. | FieldLogicHQ Stripe Billing | Stable CAD/USD catalog; monthly/annual rules; location evidence; correct tax; subscription lifecycle and revenue recognition. |
| B. Future family/fan subscription | FieldLogicHQ sells a personal product to an adult purchaser/household under defined ownership. | FieldLogicHQ Stripe Billing, separate product/entitlement identity | Consumer recurring-payment disclosures, consent, renewal/cancellation rules, family ownership, B2C tax classification and no double purchase for included benefits. |
| C. Facilitated registrations | Organizer supplies the registration; the recipient and nature of FieldLogicHQ's own fee need an explicit contractual ruling. | Organizer Connect direct charge + FieldLogicHQ fee records | Account capabilities, fee payer/supplier, registration vs fee taxes, event location, marketplace rules, refunds/disputes, tax custody and payout reconciliation. |

**Resolve the fee's recipient first.** A family paying an extra checkout amount does not, by itself, tell us whether FieldLogicHQ supplies a service to that family, the organizer recovers a cost, or FieldLogicHQ supplies a service to the organizer. This determines customer location, tax classification, invoicing, gross/net revenue and refund treatment. Obtain an accountant/counsel-approved transaction diagram for each supported model before coding fee-tax logic.

### Currency decisions

- Recommended implementation: explicit CAD and USD price mappings for each product/cycle/environment, with versioned price rows. Stripe also supports multi-currency Prices [S2]; compare both approaches once against existing governance and reverse lookup. Stable amounts are decided; storage design is not.
- Keep automatic FX pricing/localization from overriding the owner's stable price promise. Inspect Adaptive Pricing and every relevant Dashboard setting rather than assume its status.
- Price market and customer tax location must be independent inputs. Record approved policy for moves between countries and currency changes; a new subscription/migration may be required, with credits and no duplicate billing.
- Decide CAD settlement versus supported USD settlement to a compatible USD bank account. Confirm account eligibility, fees, bank country requirements and refund funding with Stripe [S3]. A USD-priced checkout does not imply a USD bank payout.
- Keep original charge, fee and payout currencies plus CAD accounting values and the approved FX source/date. Treat realized/unrealized FX and processor conversion charges distinctly under the accountant's policy.
- Compare economics under adverse exchange rates without changing existing subscriber prices automatically. Set a review cadence and margin threshold for future price versions.

### Commercial decisions required

- Exact USD monthly/annual amounts for each sellable subscription and add-on; grandfathering and price-change notices.
- Tax-exclusive versus inclusive presentation by product and region; government taxes and mandatory service charges must not be confused.
- Transaction fee base: pre-tax registration amount, total payment, or another defined basis; deposits, installment charges, discounts, failed payments, credits and refunds.
- Fee payer/supplier model, organizer-absorb option, per-event setting versus platform default, and who bears processor fees.
- CAD and USD fixed transaction components; domestic/international cards, debit rails, cross-border account costs, disputes, tax-engine/Billing/Connect charges, FX, accounting sync, support and expected losses.
- ACSS/PAD is not a U.S. ACH substitute. Confirm eligible account countries, currencies, settlement delays, return windows and mandates for each offered rail. Cards-first versus bank-debit availability requires a decision and a cost model.
- Minimum viable transaction margin and paid-tier margin; include processing on gross charges including tax/mandatory fees where charged by Stripe. Revalidate previous calculations rather than reuse historical rate tables.

## 5. Tax, registration and legal workstream

### Deliverable: jurisdiction and product treatment workbook

Create one maintained workbook/data source, versioned and owned by finance, covering Canadian federal GST/HST, applicable provincial regimes, U.S. states/DC and any supported territories. Do not embed all tax rates or nexus rules in application code.

Each row must contain:

| Dimension | Required information |
|---|---|
| Applicability | Jurisdiction, entity, product/revenue track, B2B/B2C facts, service or IPP classification, relevant event/performance location. |
| Responsibility | Registration seller, FieldLogicHQ fee supplier/recipient, marketplace-facilitator conclusion, collector, filer, remitter and owner of collected funds. |
| Registration | Required now / monitoring with rationale / registered; physical-presence analysis; economic threshold amount/count, window, included/excluded sales, FX rule, aggregation basis, effective date and filing frequency. |
| Calculation | Product tax code, location evidence, exemption/zero-rating conditions, ID/certificate requirements, inclusive/exclusive policy, treatment of discounts, credits and separate fees. |
| Operations | Authority, filing account, responsible person/provider, deadlines, remittance funding, nil-return requirement, deregistration rule and escalation lead time. |
| Evidence | Official source URL, checked date, advisor conclusion, review date, support boundaries and known provider gaps. |

### Required determinations

- GST/HST registration effective date and historical sales review. Include other taxable activities of the proprietor as appropriate; do not assume a brand gets a fresh threshold.
- SaaS supply classification/place-of-supply rules; tax on platform services; export zero-rating conditions and evidence for U.S. purchasers [S6]. Distinguish a qualifying export from an exempt sale or an unregistered seller.
- QST, BC PST, Saskatchewan PST and Manitoba RST: assess independently of federal small-supplier status. Saskatchewan SaaS collection and Manitoba's 2026 cloud-computing change require particular attention [S13–S16].
- U.S. taxability and physical/economic nexus for FieldLogicHQ's own products and fees. Do not use a universal U.S. dollar threshold or assume businesses/nonprofits never pay tax.
- Canadian and U.S. marketplace/distribution-platform obligations for facilitated registrations. Direct charges and terms assigning tax to organizers do not override statutory liability [S4, S7]. Preserve gross facilitated-sales information separately from own revenue for threshold tests where applicable.
- Event registration, league membership, instruction/camp, spectator admission and merchandise are distinct classifications. Youth, nonprofit/charity and other exemptions require qualifying facts and evidence; a club checkbox is insufficient.
- Determine whether tax on a family-paid fee follows a separate supply or the underlying registration; assess taxable basis and bundled-supply rules. Do not tax a split twice.
- Set exemption approval, verification, expiry/review and revocation procedures. Unsupported exemption claims go to review; staff cannot casually mark a customer globally exempt.
- Existing RPAA/FINTRAC questions, payout control/reserves and terms need review for the actual Canada/U.S. model. Keep a ruling on refund funding and platform loss liability.
- Review provincial/U.S. consumer recurring-payment rules, mandatory-fee advertising, cancellation rights, French-language obligations for Quebec, privacy and cross-border data processing for the products sold. Separate required legal work from optional localization enhancements.
- Assess any Canadian digital-platform reporting, U.S. information-reporting obligations and which party/Stripe is responsible. Do not repeat the old scope's broad reporting exclusions without confirmation.

### No-tax and failure policy

Every zero-tax result needs a recorded reason: supported non-taxability, qualifying export, verified exemption, registration not required under reviewed policy, or other approved reason. **A missing Stripe registration can produce zero tax even when collection was required** [S12]. Unknown classification, invalid address or failed tax calculation must never silently become a tax-free sale.

The product must support all intended regions through approved configurations. If a required registration/capability is incomplete, alert and complete it before enabling the affected sale; do not use tax-free fallback or quietly turn broad signup support into geographic exclusions. Keep signup available while resolving a payment exception where lawful.

## 6. Stripe configuration and integration workstream

### Account configuration inventory

- Verify the Canadian account's legal proprietor, trading name, public identity, statement descriptor, support contact, tax IDs, payout accounts/currencies and access roles. Separate sandbox/live evidence.
- Inventory existing customers/subscriptions, prices, coupons, trials, comp periods, product tax codes, price tax behaviour, tax registrations, portal permissions, invoice templates, receipt settings and recovery emails.
- Verify Stripe API version and SDK behaviour in this repository before implementation. Use current local Next.js 16 guides for any app-code work; preserve `proxy.ts` conventions.
- Configure CAD/USD subscription catalog and validate correct product, amount, interval, currency, environment, tax behaviour and active state. Preserve price history and existing subscribers.
- Decide supported payment methods per country/currency/product; account for delayed payment success, tax/invoice behaviour and customer consent. Never enable a method solely because its logo is available.
- Configure Stripe Tax registrations using actual authority registrations and effective dates. Identify supported categories and calculation/filing gaps; assign alternatives rather than claim Stripe covers all event/amusement taxes.
- Keep branded subscription and organizer receipts recognizable. Supply compliant invoice details and separate platform-fee documentation where needed.
- Configure renewal, trial-ending, failure/retry/dunning and cancellation behaviour without contradicting current owner rulings. Portal settings must not bypass allowed plan moves or expose unsupported cross-currency moves.

### Shared billing implementation

- Centralize a server-authoritative quote/policy service: billing party, country/address, market, product, cycle, price version, currency, applicable promotion and tax policy.
- Require and persist correct billing address and tax IDs, including appropriate Stripe customer updates; collect new consent/details before future off-session billing where needed.
- Enable tax explicitly on all relevant Checkout/subscription/invoice paths, with the correct liable account. Cover initial checkout, coach checkout, saved-card conversion, future-season choice, upgrades/downgrades, reactivation, renewals, prorations and portal changes.
- Preserve owner-decided Founding Season mechanics and first-charge instants from current runtime constants. A setup-mode card save remains a card save; it must not accidentally start billing.
- Audit all plan-ID/price-ID reverse lookups, metadata, entitlement application and readiness checks for multi-currency support. Include database overrides and existing price-change approval flows.
- Prevent duplicate subscriptions and double charges with idempotent requests and durable business keys; verify current customer-link safeguards before extending them.
- Process authoritative Stripe events with signature verification, account/environment scoping, durable event storage, deduplication, retries and replay. A browser redirect never grants paid access by itself.
- Model unpaid, incomplete, delayed and failed events; grant/revoke entitlements according to existing rules, and avoid deleting access on an out-of-order stale event.

### Connect implementation, coordinated with Club Stage 12

- Confirm with Stripe that the Canadian platform's chosen controller/account configuration supports Canadian **and U.S. organizers**, direct charges, intended platform-fee collection, settlement currencies, dashboard/tax settings and rails. Obtain account-specific evidence; generic cross-border payout support is insufficient.
- Record account country, capabilities, onboarding status, requirements due, bank/payout status and restrictions. Use Stripe-hosted onboarding for sensitive verification information.
- Finalize fee-payer/tax diagrams before implementing `application_fee_amount`. The application-fee transfer amount is not automatically a tax invoice or a tax calculation for FieldLogicHQ's supply.
- Calculate organizer registration tax in the correct account context; independently calculate/record FieldLogicHQ fee tax under the approved supplier/recipient model. Use Stripe Tax APIs or another validated approach for fee records [S5, S12].
- If applicable law makes FieldLogicHQ collector/remitter for registrations, design how tax funds reach its tax control account without treating them as fee revenue. Do not assume organizer-held tax is available for platform remittance. Resolve conflicts with the direct-charge/no-funds-control direction before launch.
- Handle connected-account webhook events, disputes, payout failures, restrictions, disconnects, refunds and application-fee refunds with account-scoped identifiers and replay.
- Distinguish authorization, payment processing, payment success, availability and bank payout. Pending debit is not paid registration money.
- Keep online/offline payment source, partial payments, deposits/installments and allocations coherent with existing registration/team ledgers. Never directly set a paid flag and separately create an unlinked duplicate ledger transaction.
- Define full/partial refunds of principal, underlying tax, FieldLogicHQ fee and fee tax, including cases where the fee is retained under lawful terms. Reverse tax records and issue credit documents correctly; processor costs may remain.
- Cancellation after payout, insufficient balances, return/dispute deadlines and platform loss exposure must have a funding owner and escalation runbook. Payout delays/reserves are implemented only after Stripe/counsel confirms capability and terms.
- Organizer offboarding must retain reports and service outstanding refunds/disputes, including access to account-scoped direct-charge records [S11].

## 7. Accounting system selection and money records

### Selection brief: compare before buying

Initial shortlist for investigation: **QuickBooks Online Canada, Xero Canada, and Zoho Books Canada**; the accountant may propose an alternative. These are evaluation candidates, not a feature/pricing endorsement or purchase decision.

Produce a scored comparison using current Canadian editions, official documentation, an accountant discussion and a sandbox proof. Compare native Stripe integration, a managed connector, and a thin custom export/sync where appropriate.

| Criterion | Required proof |
|---|---|
| Accountant fit | Accountant can work in the product; suitable Canadian tax codes, filing workflow and audit exports. |
| CAD/USD | Required plan supports original currencies, CAD reporting, USD bank feed/clearing, refunds and exchange differences. |
| Transaction fidelity | Proper handling of gross sales, taxes, processor fees and their taxes, application fees, credits, disputes and payouts. Verify direct-charge/connected-account visibility rather than assume a platform feed sees everything. |
| Revenue timing | Agreed treatment of annual prepayments, earned subscriptions, trial/comp periods, refunds, chargebacks and deferred revenue where required. Accountant decides reporting basis, not the connector. |
| Controls | Immutable source references, deduplication, historical imports, backfill/replay, close-period protection and exception reports. |
| Scale/cost | Canadian plan cost, connector fees per transaction/account/currency, Tax/Billing costs, support and owner hours at low/base/high volume. No promotional price used as steady-state cost. |
| Exit and transition | Export ownership, retained documents, entity changes, separate books at incorporation and vendor lock-in. |

Decision output: recommendation with reasons, proof of the hardest reconciliation case, total monthly cost at launch/growth, known limitations and an assigned fallback. Do not subscribe to competing paid systems as part of evaluation without the owner's selection.

### Proposed chart-of-accounts requirements, accountant to finalize

- Subscription revenue split by organization/coach and personal family/fan product; transaction platform revenue; contra-revenue/refunds.
- Deferred subscription revenue or other timing accounts as required by the chosen basis.
- Stripe clearing by relevant account/currency, CAD/USD bank accounts, processor fees, Billing/Tax/Connect fees and recoverable/nonrecoverable taxes on expenses.
- Separate sales-tax control accounts by authority/type; tax on FieldLogicHQ's own fees must remain distinguishable from any organizer tax the platform is obliged to remit.
- Organizer funds/payables or other clearing accounts only where the approved money flow/accounting treatment requires them; connected-account gross volume is not booked as proprietor sales by default.
- Disputes/chargebacks, losses/recoveries, FX, explicit rounding adjustments and proprietor drawings/contributions. Owner bank transfers are not another sale.

### Financial subledger and audit trail

Use Stripe as the payment/invoice source, the app as the product/identity/registration source, and the selected accounting package as the general ledger. Define one posting owner for each event; a connector and custom webhook must not both book the same revenue.

Retain, with role-limited access:

- Legal entity/seller and contracting customer, revenue track, organization/household/event references, account/environment and source IDs.
- Subscription, invoice/line, payment/charge, application fee, refund/credit note, tax calculation/transaction/reversal, balance transaction and payout IDs where relevant.
- Currency, integer minor-unit amounts, gross/net/tax breakdown by jurisdiction, price/fee-policy version, discounts, processing costs, transaction and service-period dates.
- Location evidence, exemption/export reason and tax registration context; preserve the evidence used at the time rather than rewrite old invoices after an address update.
- Original amount, settlement amount, accounting CAD value and FX provenance; applied rounding policy and reconciliation links.
- Ingestion/posting status, durable deduplication key, retry history, correction/reversal references and operator audit events.

Avoid building a second general ledger unnecessarily. Prefer a reliable connector plus a minimal source/exception ledger if it proves complete for all three tracks; retain custom records for genuine gaps.

### Minimum reconciliation and close process

1. Ingest finalized sales, receipts, fees, tax records, credits, disputes and payout movements daily with an event-age/gap alarm and scheduled recovery import.
2. Reconcile Stripe activity to Stripe balance and payouts in each currency, including pending/available distinctions and transfers/conversions. A payout is a movement of existing money, not revenue.
3. Reconcile bank deposits to payout records; keep timing differences open with aging and resolution owners.
4. Reconcile tax totals to source invoice/fee records and provider tax reports; confirm that fee records enter threshold reporting exactly once.
5. Reconcile product access and revenue exceptions: successful charge without access, access without an expected payment, duplicate subscription, missing price, unexplained no-tax result.
6. Complete monthly close, tax liability funding and filing calendar review; retain a report bundle and signed/recorded review by the assigned finance owner.
7. Deliver year-end records and supporting evidence to the accountant without requiring reconstruction from net bank deposits. Agree retention, backups, access and destruction with applicable requirements.

## 8. Threshold monitoring and automation boundaries

Stripe documents material monitoring limits: application fees excluded, home-country obligations not monitored, product/location assumptions and limitations on marketplace/performance-location sales [S1]. Tax calculation is not a registration determination, and a zero result can reflect missing configuration [S12].

Build a supplementary **jurisdiction ledger** covering own subscriptions and fees, external sales/imports, and separately measured facilitated volume where law requires it. Configure each authority's approved window, aggregation, exclusions, physical-presence trigger and exchange-rate policy; do not simply total all gross charges everywhere.

- Suggested early warnings at 50%, 75% and 90% of a numerical threshold; these are planning alerts, not legal safe harbours. Handle first-sale/physical-presence duties independently.
- Forecast upcoming invoices and onboarding volume; assign enough lead time for registrations. A daily job should alert immediately when a required registration, tax setting or filing deadline is missing or near.
- Finance reviews monthly and when presence, product, fee structure, entity or event geography changes. Refunds or lower revenue do not automatically end a registration/filing obligation.
- Version source rules and advisor determinations. Reassess on a scheduled cadence and before entering an unreviewed product/jurisdiction.

| Activity | Target automation | Accountable human |
|---|---|---|
| Price/currency consistency | Canonical catalog + environment/currency validation | Owner approves actual prices and notice policy. |
| Tax calculation and receipts | Stripe Tax/Billing or verified category-specific provider | Accountant approves classifications, registrations and exceptions. |
| Registration alerts | Stripe alerts plus supplemental jurisdiction ledger | Finance confirms need and completes registration; do not auto-register everywhere. |
| Data ingestion and bookkeeping | Proven connector/API with deduplication/replay | Bookkeeper resolves exceptions and closes periods. |
| Returns and remittance | Supported filing provider where justified; calendar/reminders elsewhere | Named filer reviews accuracy, authorizes payment and retains submission proof. |
| Refund/dispute workflows | Linked payment/fee/tax reversals and notifications | Authorized support/finance handles policy exceptions and funding. |
| Incorporation | Reusable identity/history and migration tooling | Owner + accountant + Stripe confirm the legal/entity cutover. |

Stripe's direct Canadian filing coverage currently described for eligible simplified nonresident registrations does not cover this ordinary Ontario domestic registration [S10]. Select an accountant or supported filing partner; do not label Canadian GST/HST remittance fully automated until demonstrated for this entity.

## 9. Open questions and decision register

Record answers here with decision date, decision-maker and downstream changes; update the commercial canon for approved pricing/packaging changes. Recommendations are not decisions.

| ID | Question / required decision | Owner | Suggested starting position / dependency | Needed before |
|---|---|---|---|---|
| D01 | Exact legal proprietor/trading name, GST/HST effective date, current/historical taxable sales and any other businesses? | Owner + accountant | Supply securely; assess existing exposure before choosing dates. | Tax setup |
| D02 | Accounting package and integration? | Owner + accountant | **Compare options — confirmed 2026-10-21.** Prove CAD/USD + fees/refunds before purchase. | Accounting build |
| D03 | Fixed prices or FX-driven subscription pricing? | Owner | **Stable CAD/USD prices — decided 2026-10-21.** | Catalog design |
| D04 | Exact USD amounts, annual discount, add-ons, existing customer grandfathering and future price-change notice? | Owner/commercial | Maintain value proposition and contribution margin; existing CAD canon remains authoritative. | USD catalog/marketing |
| D05 | How does billing-country confirmation control market selection, and how are country/currency changes handled? | Product + finance | Suggest country-aligned subscriptions, explicit re-quote on mismatch, no automatic currency migration. | Checkout |
| D06 | CAD conversion versus USD settlement; which bank accounts exist and who covers FX/settlement costs? | Owner + accountant + Stripe | Owner confirmed no separate business bank account on 2026-10-23. Compare eligible business-bank/settlement arrangements and total cost. | Payout configuration |
| D07 | Initial tax registrations/classifications, export evidence and jurisdiction-specific filing owners? | Accountant | Complete workbook in section 5; do not infer from Stripe account country. | Subscription gate |
| D08 | Who contractually buys FieldLogicHQ's transaction service when the family pays the fee? | Accountant + counsel + owner | Preserve family-pays default; establish actual supply/invoice/fee-tax recipient. | Fee architecture |
| D09 | Keep decided rail-specific transaction rates across both countries/currencies, or require a new approved schedule? | Owner + Stripe + finance | Revalidate canonical anchors against current costs; do not silently reprice. | Transaction catalog |
| D10 | Can organizers absorb fees; can they change it mid-event; how are existing quotes honoured? | Owner/product | Optional absorption is currently open. Version policy per transaction. | Transaction UX |
| D11 | Fee base, fixed-fee frequency, deposits/installments, caps, discounts, refunds and retained fees? | Owner + accountant | Explicit formula and examples for each rail/currency. | Fee implementation |
| D12 | Which rails launch in Canada and U.S.; debit mandate/return and payout policies? | Stripe + owner + counsel | Prove capabilities and loss economics; no automatic ACSS-to-ACH assumption. | Transaction gate |
| D13 | Is FieldLogicHQ a marketplace/distribution-platform collector in any intended region; how are those taxes funded? | Accountant/counsel | Review actual features and contracts, not the SaaS label. | Relevant payment gate |
| D14 | What Canadian/U.S. organizer account/controller configuration is supported, including application fees and account tax settings? | Stripe + engineering | Preserve direct charges; validate Express direction and loss responsibility. | Connect build |
| D15 | What registration types, age groups and charity/nonprofit exemptions are supported first, with what evidence? | Product + accountant | Tournament + house league; distinguish participant registration from spectator tickets/camps/merchandise. | Transaction gate |
| D16 | What refund, dispute, cancellation-after-payout and organizer-offboarding policy is promised? | Owner + counsel + Stripe | Assign funding responsibility and staff limits; no unapproved holds/reserves. | Transaction terms |
| D17 | What annual-prepayment/revenue recognition, CAD FX, document-retention and close policy applies? | Accountant | Avoid net-deposit-only books. | Ledger design |
| D18 | Who performs monthly close, threshold reviews, registrations, filing and remittance; who is backup? | Owner | Owner included accountant selection on 2026-10-23. Select the firm and assign finance responsibilities and backup. | Subscription gate |
| D19 | What is the future family/fan product, adult payer/household ownership and relationship to club-included benefits? | Product/owner | Foundation now; sell only after its own gate. | Personal-product build |
| D20 | Which consumer cancellation, renewal-notice, tax and language obligations apply to personal sales, including Quebec? | Counsel + accountant | Review coach personal purchases as well as future families. | Applicable subscription gate |
| D21 | What incorporation timeline, legal/account transfer method and historic refund/tax split is intended? | Owner + accountant + Stripe | Prepare runbook now; execute as a separately scheduled cutover. | Entity transition |
| D22 | How broadly are U.S. territories supported and what if a billing address is outside Canada/U.S.? | Owner + product + advisor | Explicit scope and quote behaviour; no unsupported global automatic expansion. | Subscription gate |
| D23 | Combined launch or independent payment-model gates? | Owner | **Separate readiness gates — decided 2026-10-21.** Align Connect with Club Stage 12. | Sequencing |
| D24 | Monthly provider/operating budget and minimum subscription/transaction margin? | Owner + finance | Compare low/base/high volume including support and losses. | Vendor selection |
| D25 | Is an app-store purchase channel planned for family/fan subscriptions? | Product + advisor | If yes, scope store billing/merchant/tax rules separately; web Stripe rules do not automatically carry over. | Personal-product scope |

## 10. Delivery phases and concrete outputs

Phases can overlap in research/design; dependent implementation waits for the decisions it needs. External advisor/Stripe lead time is tracked separately from engineering effort. No fixed delivery date is claimed until Phase 0 identifies volume, access, available people and release dependencies.

### Provisional effort and timing — added for owner review 2026-10-21

These are engineering planning estimates, not vendor quotes, approved deadlines or tax-registration processing commitments. Assume one implementer with five focused engineering days per week, reuse of current billing, a suitable accounting connector, and sequential implementation. The review artifact can model lower engineering capacity and a hypothetical kickoff; its dates exclude weekends but do not model public holidays or interruptions.

| Phase | Engineering allowance | Calendar/dependency allowance |
|---|---|---|
| 0 — discovery and decisions | 3–5 days | Allow 2–4 calendar weeks for the decision bundle and external responses; actual professional/registration delays can exceed this. |
| 1 — shared foundation | 8–12 days | Follows subscription-critical decisions; some independent design can overlap discovery. |
| 2 — subscription/marketing readiness | 8–12 days | Follows shared foundation; requires effective registrations and Gate A evidence. |
| 3 — facilitated registrations | 20–35 days | Additional 4–7 focused engineering weeks; counsel, account capability and wider Club Stage 12/release dependencies remain separate. |
| 4 — family/fan billing | 5–10 days | 1–2 focused engineering weeks after product/household decisions and shared foundation. Premium product features are excluded. |
| 5 — operation/incorporation preparation | Recurring operations; cutover scoped separately | Validate the first complete operating month and close. No corporation implementation date is assigned. |

Under that baseline, **Gate A is approximately 6–9 weeks from a confirmed kickoff**, including the 2–4-week discovery allowance. **Gate B adds about 4–7 focused weeks** in a sequential subscription-then-registration build. Those estimates are not a Club release forecast, and a payment stream may open only when its actual gate evidence is complete. Premium family/fan delivery and incorporation do not block subscription launch. Phase 0 must replace this preliminary scenario with a resourced schedule and an external-dependency register. First-full-month close is additional operational proof after launch.

### Phase 0 — Evidence, decisions and professional briefs (P0)

- [x] Create this roadmap, PM brief and root TODO project link; record the owner's three planning decisions.
- [x] Add the phase/stage index, stub stages and evidence-backed completion register; refresh the artifact from one source of progress (2026-10-23).
- [x] Complete the inspected-path billing/currency/tax audit and read-only live/sandbox configuration inventory with redacted evidence (2026-10-23; see discovery packet).
- [x] Prepare the accountant selection/tax brief and account-specific Stripe capability questions (2026-10-23; preparing questions does not complete external determinations).
- [ ] Select the accountant and business banking/settlement arrangements; owner confirmed these prerequisites on 2026-10-23.
- [ ] Review current customers, source payment history and other proprietor activity for migration/historical obligations.
- [ ] Obtain the jurisdiction/product treatment workbook and fee-supply diagrams; update the counsel brief for U.S./CAD/USD scope.
- [ ] Produce stable USD price proposal and updated full-cost margin scenarios from current provider quotes.
- [ ] Compare accounting systems/connectors; demonstrate one USD subscription, one refund and one application-fee reconciliation case.
- [ ] Confirm account-specific Connect capabilities and legal dependencies; list accountable people and external lead times.

**Exit:** Decisions D01–D08 and accounting direction are sufficiently resolved for subscription implementation; Connect-specific uncertainties are tracked against its own gate. Full jurisdiction review remains a pre-sale requirement, not a claim completed by this plan.

### Phase 1 — Shared catalog, billing identity and financial foundation (P0)

- [ ] Design/version CAD/USD mappings and billing-party identities compatible with organizations, coaches and future personal products.
- [ ] Define database changes from current snapshots and dictionary, migrate-first when needed, preserve history and recheck dev/prod parity under repository rules.
- [ ] Build canonical quotes and extend admin price validation, environment separation and metadata contracts.
- [ ] Build minimal durable source/exception records and selected accounting integration; demonstrate posting ownership and recovery.
- [ ] Establish registrations, jurisdiction ledger, filing calendar, tax liability accounts and daily exception reporting.

**Exit:** Financial foundation handles currency/identity/tax evidence without duplicating the general ledger; no unsupported price fallback.

### Phase 2 — Organization/coach subscriptions and marketing (P0, Gate A)

- [ ] Implement tax/address/currency handling across all subscription lifecycles and portal actions.
- [ ] Update marketing, pricing cards/comparisons, onboarding, account billing, emails, offers, receipts, help and legal terms from the same approved facts.
- [ ] Preserve Founding Season and existing plan-change/coach-club inclusion rules; create a migration plan for saved cards and subscriptions missing location evidence.
- [ ] Complete sandbox/time-based lifecycle tests, accounting reconciliation and owner browser verification.
- [ ] Complete live configuration evidence and controlled CAD/USD payment/refund smoke tests under the release plan's real-money authorization.

**Exit:** Gate A evidence in section 12; customers throughout the intended Canada/U.S. subscription geography can pay as represented.

### Phase 3 — Facilitated registrations (P0 for transaction launch, Gate B)

- [ ] Coordinate build tasks with Club Stage 12 rather than creating a competing payments engine.
- [ ] Implement country-aware organizer onboarding and the decided direct-charge model.
- [ ] Implement fee, tax and document diagrams, account-context events, registration allocations and refunds.
- [ ] Prove marketplace liability/funding where applicable, loss/dispute response, account restrictions/offboarding and payout reconciliation.
- [ ] Update event/league marketing and registration totals for mandatory-fee disclosure; preserve hybrid offline recording.
- [ ] Complete transaction economics, sandbox negative-path tests, owner walkthroughs and authorized live smoke evidence.

**Exit:** Gate B, existing legal dependencies and Club Stage 12 release requirements are satisfied together.

### Phase 4 — Personal family/fan subscriptions (P1 foundation, Gate C before sales)

- [ ] Define adult payer, individual/household benefits, entitlement ownership and relationship to organization-included benefits.
- [ ] Add versioned CAD/USD product catalog, B2C tax classification, consent/renewal/cancellation rules and standalone purchase history.
- [ ] Prevent duplicate household purchases and overlapping personal/club charges; provide clear cancellation/refund support.
- [ ] Run Gate C tests and reconcile the new revenue stream before opening its checkout.

**Exit:** Gate C; future product functionality is scoped separately from billing readiness.

### Phase 5 — Operate, simplify and prepare incorporation (P1, ongoing)

- [ ] Close the first full month, measure exception volume, owner time, provider costs and actual margin against the model.
- [ ] Remove unnecessary manual steps only after successful reconciliations; schedule tax-rule/provider reviews and export/restore exercises.
- [ ] Complete an incorporation cutover runbook and test the migration path before any legal-entity change.

**Exit:** Repeatable finance operations with named ownership; incorporation remains a separately executed business transition.

## 11. Validation matrix

Engineering validates calculations, API contracts, events and reconciliation. **The owner performs browser/visual verification**, per AGENCY_RULES.md, unless explicitly delegated. These tests are planned; none are represented as executed by this planning task.

| Scenario group | Required cases and evidence |
|---|---|
| Subscription geography | All reviewed Canadian provinces/territories and U.S. states/DC; California/USD and Quebec/CAD explicitly; postal-code validation, mixed-country cards, VPN and travel, unsupported/territory address policy. Expected taxes come from reviewed fixtures, not assumed national rules. |
| Catalog | Every sellable plan/cycle/currency/environment; missing or inactive price, wrong amount/currency/interval/product, price update, promotion and annual-total display. |
| Lifecycle | First sale, trial, comp, setup-only save, future first charge, renewal, card/address update, upgrade proration, downgrade at renewal, cancellation, reactivation, failed invoice, duplicate request, country/currency change. |
| Tax | Required registration, approved no-registration case, qualifying export, valid/invalid/expired exemption, nonprofit evidence, missing location, tax-provider failure and missing registration. Assert reasons as well as totals. |
| Transaction supply | Organizer registration tax vs FieldLogicHQ fee tax; family-pays and any approved organizer-absorb mode; taxable underlying sale with exempt fee or reverse where approved; separate seller/receipt and tax-funding evidence. |
| Registration payments | Tournament and house league; deposits/installments; full/partial/offline payment; discounts; simultaneous attempts; CAD event paid by U.S. family and USD event paid by Canadian family. |
| Bank/debit methods | Only approved rails/currencies/countries; pending success, return/failure after apparent completion, mandate evidence and refund timing. |
| Connect | Canada/U.S. onboarding, incomplete verification, restricted account, negative balance, payout failed, disconnected organizer, account-scoped event replay and correct fee amount/currency. |
| Event reliability | Bad signature, duplicate/delayed/out-of-order event, API timeout after successful charge, dead-letter retry, missed-event backfill and concurrent posting; prove one financial result. |
| Refunds/disputes | Full/partial principal/tax/fee/fee-tax reversal, retained fee, refund after payout, insufficient funding, chargeback won/lost, processor cost retained and correct credit documents. |
| Accounting | CAD subscription, USD settlement, USD-to-CAD conversion, annual prepayment, fees/tax on fees, payout spanning periods, reserve/restricted funds, negative Stripe balance, manual adjustments and closed-period replay. |
| Personal product | Adult payer vs child participant, household purchase ownership, duplicate email with org role, org-included benefits and cancellation; no unauthorized billing-data access. |
| Recovery/operations | Accounting connector down, tax service down, filing deadline missed alert, registration nearing threshold, unknown region/product, missing tax funds, rotated webhook secret and provider outage recovery. |

Use meaningful tests around money and lifecycle risks; avoid tests that only repeat configuration literals without proving outcomes. Run checks appropriate to actual changes: focused lint/verification and typecheck for shared contracts, then relevant accounting/tax/event tests. Do not run whole-product dev layout sweeps. For app work, follow the dev-server escalation/restart requirements in AGENTS.md; a documentation-only planning handoff needs no browser server.

### Reconciliation invariants

- Invoice/charge totals equal their detailed components in integer minor units, under an explicit rounding rule.
- Every platform-fee transfer splits into its approved revenue, tax and cost treatment; collected tax is not profit.
- Every registration receipt can be matched to its allocations, refunds, account-context charge and organizer statement.
- Opening Stripe balance + all balance movements = closing balance in each currency; bank payout movements reconcile separately from revenue.
- Duplicate/replayed events do not duplicate access, money allocations, tax transactions or accounting entries.
- Tax reports and ledger balances reconcile by liable entity/jurisdiction, including reversals. No original transaction is counted again when a periodic paid fee statement is issued.

## 12. Readiness gates and rollout

| Gate | Required evidence | Decision owners |
|---|---|---|
| **A — Canada/U.S. organization/coach subscription sales** | Approved CAD/USD catalog and mandatory-fee copy; jurisdiction/product workbook; required effective registrations; billing identity/address/tax handling across lifecycle; CAD/USD reconciliation proof; filing/remittance owners; support/runbooks; owner browser walkthrough; verified live config and controlled real-money smoke evidence. | Owner, engineering, accountant; counsel for applicable consumer/legal questions. |
| **B — Facilitated tournament/house-league payments** | Gate A shared foundations plus Stripe capability confirmation, legal/counsel dependencies from existing scope, fee supplier/recipient and tax diagrams, marketplace conclusions/tax funding, approved margin, direct-charge/account events, onboarding/offboarding, hybrid allocations, refunds/disputes/payouts and end-to-end organizer/platform books. Coordinate with Club Stage 12. | Owner, engineering, accountant, counsel and Stripe capability confirmation. |
| **C — Personal family/fan subscription sales** | Shared foundation plus approved product/household ownership, B2C treatment, recurring-payment consent/notices/cancellation, benefit overlap prevention, CAD/USD consumer receipts and reconciliation. | Owner/product, engineering, accountant and applicable counsel review. |
| **D — Incorporation cutover** | Legal effective date, new/updated registrations and accounts, Stripe-approved entity/account migration, subscription/token continuity, entity-specific opening balances/close, refunds/disputes split and customer notices. | Owner, accountant, Stripe and counsel as needed. |

Use sandbox fixtures and time-based simulation first, then an explicit limited live verification in each supported currency under the release runbook. Do not create arbitrary live customers, charge a saved card or send customer notices as part of planning. Live financial actions require concrete amounts/accounts and owner authorization.

Rollout must have monitoring and a reversible disable-new-purchases control by product/payment method. Such a control does not stop servicing existing renewals/refunds/disputes. A rollback must not create duplicate subscriptions, lose invoices, reverse valid registration balances or strand organizer tax funds. Retain old price mappings for historical lookup; stop offering a superseded price without erasing its history.

## 13. Incorporation transition

Treat the future corporation as a legal/tax transition, not a display-name edit. CRA notes that legal-status changes can require a new business number and that old program accounts are not automatically attached to the new number [S17]. Stripe must confirm whether an account update or new account/migration applies to this exact case.

The runbook must define the seller-of-record effective instant; old/new registrations and invoice identities; bank and accounting ledgers; subscription/customer/payment-method portability; Connect platform relationships; consent/assignment/notices; historic refunds/disputes and tax corrections; filing of closing/opening periods; access to historic reports; and rollback/contingency. Preserve entity attribution on old transactions. Reassess marketplace/nexus thresholds under advisor guidance rather than automatically resetting counters.

## 14. Risks, dependencies and first work package

| Risk | Mitigation / evidence required |
|---|---|
| Zero tax caused by incomplete Stripe setup | Reviewed jurisdiction register, effective registrations, explicit no-tax reasons and pre-sale checks. |
| Incorrect fee customer/tax location | Signed-off supply diagrams before implementing fee tax. |
| Losing money on U.S./international payments | Current account-specific cost model including FX, tax, all processor fees, support and loss assumptions; approved margin floor. |
| Mandatory fee disclosed too late | Market-wide copy inventory, all-in pricing design and counsel review of advertising/checkout. |
| Missing percentage revenue in threshold alerts | Supplemental own-revenue ledger; separately tracked facilitated volume; no reliance on Stripe monitoring alone. |
| Double revenue/tax postings | Single posting owner, deduplication, original/statement links and controlled backfill. |
| Old plans override new scope | This umbrella records Canada/U.S. and CAD/USD scope; update cross-references at each workstream handoff and preserve current commercial canon. |
| Paid personal product inherits org-only identity | Explicit billing party/product entitlement design, including individual coaches and household purchasers. |
| Tax collected in organizer account but owed by platform | Approved collection/remittance/funding design; resolve any conflict with direct-charge direction before launch. |
| Incorporation strands refunds or history | Versioned entity records and a tested Stripe/accounting cutover runbook. |

**First implementation package:** Phase 0 evidence/decision bundle. Start with redacted Stripe configuration inventory, the accountant's jurisdiction/fee-supply brief, USD price proposal, accounting-system comparison and Connect Canada/U.S. capability questions. Resolve those before committing schema or live configuration to an unverified financial model.

The project is complete when its launched tracks meet their gates and a full close proves the money trail, with the future personal-product and incorporation requirements documented and their execution tracked separately. A plan, a Dashboard toggle or a successful checkout alone does not meet that definition.

## 15. Research and reference register

Primary-source review date: **2026-10-21**. Sources support planning constraints; an advisor must apply them to FieldLogicHQ's actual facts. Recheck applicable rules/provider support at implementation and launch. This is not a completed jurisdiction-by-jurisdiction tax opinion.

- **S1 — [Stripe Tax monitoring](https://docs.stripe.com/tax/monitoring):** application-fee/home-country exclusions and other monitoring assumptions; basis for the supplementary ledger.
- **S2 — [Stripe product/price management](https://docs.stripe.com/products-prices/manage-prices):** product classification, prices and multi-currency catalog options.
- **S3 — [Stripe settlement currencies](https://docs.stripe.com/payments/currencies/settlement-payouts):** presentment, conversion, settlement and bank eligibility need distinct configuration.
- **S4 — [Stripe Tax with Connect](https://docs.stripe.com/tax/connect):** determine legal tax liability before selecting the platform/connected-account tax path.
- **S5 — [Stripe Tax for software platforms](https://docs.stripe.com/tax/tax-for-platforms):** connected-account tax settings/registrations and account-context integration.
- **S6 — [CRA exports of services and intangible personal property](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/4-5-3/exports-services-intangible-personal-property.html):** export relief conditions and evidence require classification.
- **S7 — [Wisconsin marketplace-provider guidance](https://www.revenue.wi.gov/Pages/FAQS/ise-marketplace-providers.aspx):** example demonstrating that facilitating taxable services and indirect payment processing can create marketplace obligations; not a fifty-state conclusion.
- **S8 — [Competition Bureau drip pricing](https://competition-bureau.canada.ca/en/deceptive-marketing-practices/drip-pricing):** avoid unattainable advertised totals and late mandatory fees.
- **S9 — [California Attorney General hidden-fee guidance](https://www.oag.ca.gov/hiddenfees):** required fees generally belong in advertised totals, with stated exceptions; scope to be assessed for actual products.
- **S10 — [Stripe Tax in Canada](https://docs.stripe.com/tax/supported-countries/canada):** provincial differences, configuration and current Canadian filing coverage.
- **S11 — [Stripe direct charges](https://docs.stripe.com/connect/direct-charges.md?platform=web&ui=stripe-hosted):** charge/application-fee ownership and account-scoped visibility.
- **S12 — [Stripe standalone Tax APIs](https://docs.stripe.com/tax/standalone-tax-api):** calculate, record and reverse tax; missing active registrations can yield zero tax.
- **S13 — [BC registration rules](https://www2.gov.bc.ca/gov/content/taxes/tim/pst/parts/pt-8):** distinct software registration and marketplace rules, including prospective revenue considerations.
- **S14 — [Saskatchewan software/SaaS bulletin](https://sets.saskatchewan.ca/rptp/wcm/connect/a1169319-a762-4328-b84c-88d844e8f340/PST.007%2BComputer%2BHardware%2C%2BSoftware%2B%26%2BComputer%2BServices.pdf?MOD=AJPERES):** SaaS taxability and provider collection guidance.
- **S15 — [Manitoba software and online services bulletin](https://www.gov.mb.ca/finance/taxation/pubs/bulletins/033.pdf):** cloud-computing rules effective January 2026.
- **S16 — [Revenu Québec out-of-province supplier registration](https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/special-cases-gsthst-and-qst/suppliers-outside-quebec/qst-registration-for-suppliers-outside-quebec/registration-under-the-specified-system-suppliers-outside-quebec-who-are-registered-under-the-general-gsthst-system/):** specified-system conditions and relevant customer status.
- **S17 — [CRA legal-status changes](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/business-registration/maintain-business/change-legal-status.html):** business-number/program-account consequences of incorporation.
- **S18 — [CRA agent/commission treatment](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-special-cases.html):** principal sales and platform service/commission need separate analysis.
- **S19 — [Stripe U.S. tax guidance](https://docs.stripe.com/tax/supported-countries/united-states):** region-specific nexus, tax collection and filing lifecycle.

## 16. Planning handoff verification

- Created the project roadmap and paired PM brief; linked the project from root TODO.
- Checked billing/catalog/checkout code and the saved dev schema snapshot; recorded observation limits explicitly.
- Recorded the owner's stable-price, accounting-comparison and separate-gate decisions from this conversation.
- Preserved existing payment direction, fee-payer defaults, pricing canon, Club sequencing and counsel dependency; identified historical assumptions that need updating.
- Planning deliverables receive documentation/link/diff checks only. Application tests, browser tests, live Stripe inspection and financial smoke tests belong to the implementation phases above.

### Discovery handoff — 2026-10-23

- Stage progress is now maintained in the linked JSON register and rendered in the artifact index, including future stubs and evidence-backed ticks.
- Live and sandbox configuration inventories completed all six requested sections without API errors. Currency options were explicitly expanded; no USD option was present.
- Repository findings, accountant selection/tax briefing and Stripe capability questions are recorded in the discovery packet. Accountant responses, banking choices, full customer history and tax decisions retain their own open stages.
- Standalone documentation/artifact tooling is separate from the running Next.js application. No application/shared-module changes are part of this discovery handoff.
