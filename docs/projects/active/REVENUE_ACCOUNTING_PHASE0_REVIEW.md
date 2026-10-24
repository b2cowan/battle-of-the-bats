# Phase 0 — Canadian money flows and launch decisions

> Prepared 2026-10-23. Canada-wide, CAD subscriptions AND tournament/house-league registrations. Preparation is complete; tax conclusions, provider responses, banking selection and launch authorization remain separate.
> [Project index](REVENUE_ACCOUNTING_REVIEW.html#index) · [Plan](REVENUE_ACCOUNTING_READINESS_PLAN.md) · [Canadian worksheet](REVENUE_ACCOUNTING_CANADA_ROLLOUT.md)

## 1. Recommended operating model

Use the existing Canadian proprietor Stripe account for software subscriptions and the platform's own application-fee receipts. Organizers receive registration payments through their own Canadian connected accounts and their own bank arrangements. Keep CAD throughout. Do not route organizer registration proceeds through the proprietor's bank account.

Preserve the decided direct-charge, family-pays and paid-organization-tier directions. The actual connected-account configuration, taxable fee recipient and documents must be settled before implementing organizer onboarding. Hosted onboarding describes the experience; it does not settle processing-fee or loss responsibility.

Start with one separate, eligible CAD operating account, Stripe source exports and simple accountant-reviewed books. Compare bookkeeping options below; purchase no connector until its coverage is proven. Keep an explicit tax reserve and refund/chargeback funding allowance in cash planning; a second bank account is optional, not an assumed launch requirement.

Banking clarification after the owner's question, 2026-10-23: a separate business account is not presented as a universal consequence of sole-proprietor status. Stripe permits proprietor/representative name matching, while the bank's permitted-use terms remain decisive. CIBC's published Canadian terms expressly require businesses, including sole proprietorships, to use a business account. The existing free personal account is therefore not an assumed launch payout solution. Evidence and the accounting distinction appear in section 5.

The customer experience remains national: a BC or Quebec club follows the same signup and eligible purchase flow as an Ontario club. Necessary location and organizer tax details are collected in ordinary onboarding. A family registration payer does not need a premium family subscription.

## 2. Supplier, collector and responsibility map

These are the intended flows, with the unresolved legal/tax allocation labelled. Physical movement of money does not establish the supplier or statutory remitter.

| Flow | Seller and contractual customer | Charge and receipt | Revenue and tax responsibility |
|---|---|---|---|
| Club/organization software subscription | Proprietor supplies software to the contracting organization | Platform Stripe Billing; FieldLogicHQ/proprietor legal seller shown | Platform subscription revenue; proprietor collects/files/remits its applicable taxes from actual effective dates |
| Coach software subscription | Proprietor supplies software to the actual contracting coach/business | Platform Stripe Billing; workspace ownership preserved | Same platform policy, with the correct customer/location classification |
| Tournament registration or deposit | Organizer supplies the actual entry/service to the team/customer | Intended connected-account direct charge; organizer identified on registration document | Organizer proceeds and tax unless an applicable platform rule changes liability; actual supply/exemption requires review |
| House-league registration | Organizer supplies the actual program/membership to the purchaser | Same connected-account model; allocate one payment across registrations when supported | Separate program classification; do not copy the tournament or software tax result |
| Platform transaction service | FieldLogicHQ supplies a service; actual recipient remains P03 | Application fee moves funds to platform; invoice/receipt model remains open | Platform service revenue and any fee tax; never assume application-fee transfer alone creates a compliant invoice |
| Processor/Connect services | Stripe supplies services to the configured fee payer | Stripe balance transactions and billing documents | Costs allocated once to the actual payer; these are distinct from the platform's selling fee |
| Future premium family/fan product | Future platform software supply | Deferred | No launch dependency; registration payment alone does not create this subscription |

Refunds need two decisions: the organizer's registration/refund policy and FieldLogicHQ's fee/fee-tax policy. The app must issue the corresponding payment and tax adjustments, preserve evidence, and show who funded any unrecovered processor cost. Payout timing does not eliminate refund or dispute risk.

## 3. Verified facts, directions and unresolved items

The [tax-response sheet](REVENUE_ACCOUNTING_PHASE0_TAX_REVIEW.csv) has 52 pending review rows: four supply categories across all 13 provinces/territories. A jurisdiction row identifies a review area, not an instruction to use the buyer's billing province for every supply. It records reviewer, authority/evidence, location rule, taxability, registration decision, effective date and remitter separately. No row contains an approved tax determination.

**Owner directions:** Ontario sole proprietor; FieldLogicHQ pre-revenue; Canada-wide CAD launch; both revenue streams; no geographic waitlists; no fixed release date; no separate business account reported; accountant selection included. On 2026-10-23 the owner confirmed GST/HST registration has not been applied for, intends to apply within the following week, and wants May 1, 2026 (the reported first business expense) as the effective date. That is an owner request, not a CRA-approved registration date. The owner also confirmed no other self-employed business revenue. The owner currently banks personally with CIBC and is open to another business provider if worthwhile.

**Repository and inventory evidence:** the dated discovery packet records CAD-only active prices, no configured live tax registrations, sandbox tax setup differences, and subscription builders without explicit automatic-tax/location collection. Focused reinspection on 2026-10-23 confirms those builders and the webhook's early return for objects without a customer. This is not a new live transaction-history or deployment audit.

**Existing commercial decisions:** use the canonical pricing facts for actual amounts, rail-specific take rates, Founding Season commitments and tier eligibility. No prices are restated or repriced here. The scoping plan's older economics table uses a different percentage from its subsequently ratified anchor, so it must not be copied as launch margin proof. See [canonical pricing facts](../../agents/strategy/PLAN_PRICING_FACTS.md) and [historical scoping/economics](FACILITATED_PAYMENTS_SCOPING_PLAN.md).

| ID | Decision/evidence needed | Responsible party | Current state and acceptance evidence |
|---|---|---|---|
| P01 | Current proprietor activity, GST/HST application and effective date | Owner + accountant / CRA | Not applied as of October 23; intends to apply within a week and request May 1, 2026. No other self-employed business revenue confirmed. CRA acceptance and earlier-expense treatment remain open before tax activation |
| P02 | Canadian software, registration and fee tax matrix | Canadian indirect-tax accountant | Worksheet prepared for all 13 jurisdictions; classification, actual registrations/no-registration reasons, effective dates, thresholds/windows and remitters still open |
| P03 | Platform fee's actual supplier/recipient and gross-versus-net presentation | Accountant + counsel + owner | Family-pays direction confirmed; contractual recipient, taxable fee base and invoicing are not established by payment routing |
| P04 | Exact Canadian Connect configuration | Stripe + engineering | Confirm API/account version, dashboard/onboarding access, fee payer, loss bearer, country/currency, application fees and reports with a sandbox proof |
| P05 | Registration-tax and platform-fee-tax collection in the intended checkout | Stripe + accountant + engineering | Prove support for the reviewed liability model. Do not assume one connected-account automatic-tax switch handles two suppliers/remitters |
| P06 | Canadian payments/legal posture and contracts | Focused Canadian counsel | Existing counsel brief remains gating; actual direct-charge flow, RPAA/FINTRAC, applicable Quebec terms/language and privacy conclusions recorded |
| P07 | Refunds, fixed/percentage fees, deposits, PAD and foreign cards | Owner + Stripe + accountant | Preserve current pricing direction; decide precise policy and run examples. PAD remains a decided rail, with actual Canadian capability/timing proof required |
| P08 | CAD platform bank and funding | Owner + bank + Stripe | Personal bank is CIBC; open to alternatives. Compare actual transaction costs and convenience below; selection/eligibility remains open |
| P09 | Bookkeeping tool and first reconciliation | Owner + accountant | Compare below; synthetic proof prepared, actual tool/process and Stripe-to-bank proof still open |
| P10 | Filings, remittances and domestic threshold monitoring | Owner + accountant | Assign actual people and deadlines from real registrations; Stripe automation does not replace this responsibility |
| P11 | House-league purchase timing and allocation | Owner + product | Coordinate Club Stage 9: acceptance/waitlist, division fees, early-bird rules, two registrations/one payment and offline coexistence |
| P12 | Canadian visitor/foreign-card policy | Owner + Stripe + counsel | Separate U.S. software sales from foreign cards or visiting teams in Canadian events; no blanket card-country block proposed |
| P13 | Canadian marketing and mandatory-fee presentation | Product + counsel + accountant | CAD totals, tax disclosure and mandatory fees shown correctly; any rail-specific presentation reviewed before public copy |
| P14 | Advisor engagement, budget and build sequence | Owner + engineering | Prepared bounded request and draft sequence; no external message, engagement or price approval has occurred |

### Registration effective date and May 1 expenses

CRA's current [registration guidance](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-account/register-account.html) says voluntary small-supplier registration usually starts on the request date and may start up to 30 days earlier. A May 1 date requested in late October is outside that usual window; the first business expense does not automatically establish that GST/HST effective date. Confirm the acceptable date with CRA/accountant before relying on the requested backdate or configuring Stripe. Preserve the actual CRA confirmation and filing periods.

Review earlier purchases separately. CRA's [new-registrant guidance](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html) allows potential credits for eligible property still held and qualifying prepaid future services/periods, subject to its conditions. Services supplied before registration generally do not qualify for an ITC. Separate expense/income-tax treatment from GST/HST recovery. Keep invoices from May 1 onward, tax actually charged, supplier details, business-use share, service dates and whether property is still held; no blanket recovery of all earlier expenses is assumed.

## 4. Stripe findings that change implementation choices

Direct charges put payment objects on the connected account. Reporting/recovery must use that account's context. Application fees require explicit treatment during refunds. An existing platform-only subscription webhook/export is insufficient for organizer reconciliation. See [Stripe direct charges](https://docs.stripe.com/connect/direct-charges.md?platform=web&ui=stripe-hosted).

Stripe distinguishes the processing-fee payer from the charge type. Its current documentation describes a platform fee-payer configuration and different legacy Express behaviour, and says the fee payer is selected at account creation. Confirm the supported Canadian configuration rather than blindly creating legacy Express accounts or switching to destination charges. See [fee-payer behaviour](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior).

Tax liability must be determined before integration. Connected-account tax settings/registrations are separate from platform settings; express-style users may need an embedded tax setup interface or API-supported configuration. An unregistered or legitimately exempt organizer needs its reviewed no-tax reason, not a fabricated registration to satisfy a software setting. See [Connect tax responsibility](https://docs.stripe.com/tax/connect) and [connected-account tax setup](https://docs.stripe.com/tax/tax-for-platforms).

Stripe says its threshold monitoring only covers sales outside the business's home country. It also describes direct Canadian filing support for eligible nonresident simplified GST/HST registrants, not this resident Ontario proprietor's regular regime. Maintain Canadian monitoring and confirmed filing ownership separately; evaluate a filing partner only if warranted. See [Stripe Canada tax support](https://docs.stripe.com/tax/supported-countries/canada).

The Bank of Canada's marketplace policy examines the actual payment chain and funds owned/controlled. Preserve the intended no-custody structure, and have counsel apply it to our exact configuration; this packet is not a legal conclusion or a reason to redesign into pooled funds. See [Bank of Canada policy](https://www.bankofcanada.ca/2025/12/supervisory-policy-for-online-marketplaces/).

## 5. Minimal CAD banking recommendation

CIBC is now the known personal bank. Keeping business banking there is a reasonable convenience-first choice if its actual transaction costs are acceptable. A different bank can offer more predictable digital pricing. In either case, use a separate eligible CAD business account; the bank's identity does not change the need for separate records. These product snapshots were checked 2026-10-23 and do not establish Stripe eligibility or open any account.

**Why not simply use the free personal account?** The owner reports free unlimited personal chequing and expects all business revenue through Stripe. That could simplify identification of incoming business payouts, but it does not change CIBC's permitted-use rule. CIBC's Canadian [personal-account terms on its service-fees page](https://www.cibc.com/en/personal-banking/bank-accounts/additional-service-fees.html) explicitly require a business account for businesses including sole proprietorships; [Personal Account Agreement section 3](https://www.cibc.com/content/dam/personal_banking/bank_accounts/pdfs/personal-account-agreement-en.pdf) prohibits use for a business the customer owns or has an interest in. This is a specific bank condition, not a claim that incorporation or GST/HST registration universally requires a business-branded account. No bank-specific exception has been confirmed.

Separately, [Stripe's ownership guidance](https://support.stripe.com/questions/verify-your-bank-account-ownership?locale=en-GB) permits sole-proprietor bank ownership in the business/DBA/representative name. Passing Stripe's ownership check does not override CIBC's use restriction. CRA describes a sole proprietorship as having no separate legal status from its owner and separately mentions an account for cheques payable to a business name; it does not establish a blanket Stripe-payout account rule. See [CRA sole proprietorship](https://www.canada.ca/en/revenue-agency/services/tax/businesses/small-businesses-self-employed-income/setting-your-business/sole-proprietorship.html).

The accounting preference is narrower than the bank condition: Stripe source records can identify business sales, fees, taxes, refunds and payouts, but cannot alone substantiate purchases paid outside Stripe, business-use shares or personal withdrawals. Maintain an expense/receipt register and reconcile Stripe payouts to the receiving bank even if one provider processes all sales. Separation is an aid to that process; a second bank brand or expensive accounting stack is not required. If another bank expressly permits proprietor business use of an account in the owner's name, assess that arrangement on its actual terms rather than insisting on a product label.

| Option | Published baseline | Practical assessment |
|---|---|---|
| CIBC Basic Business Operating Account | CAD $6/month plus $1 per self-service or $1.25 per full-service transaction; deposits pay per use | Familiar bank; obtain the complete cost for Stripe credits, debits, supplier bills, owner transfers and tax payments, including any relationship offer |
| BMO Essential Business Account | CAD $5/month, with electronic/ATM transactions and limits/extra fees detailed by BMO | Plausible digital-only shortlist; verify Stripe credits/debits and bill/tax-payment fees. Do not rely on old no-fee eBusiness references |
| RBC Digital Choice Business Account | CAD $6/month, with electronic credits/debits and other features detailed by RBC | Plausible alternative, especially for an existing RBC customer; verify payout/debit classification and tax-payment costs |

Sources: [CIBC business accounts](https://www.cibc.com/en/business/accounts.html), [BMO Essential](https://www.bmo.com/en-ca/main/business/accounts/essential-business-account/) and [RBC Digital Choice](https://www.rbcroyalbank.com/business/accounts/digital-choice-business-account.html). Promotions are excluded from the recommendation. Account opening documents, balance requirements, transaction exclusions and current fees must be checked at selection.

Staying with CIBC: a familiar institution and existing relationship can make support and owner funding easier; ask whether business access can be linked conveniently and whether fees can be reduced. The tradeoff is variable per-use costs and deposit charges on the Basic account. Do not tie up a large minimum balance solely to waive fees at this pre-revenue stage.

Using RBC/BMO: their published included electronic transactions can make ordinary digital costs more predictable, and a different institution creates a visible mental boundary for business funds. The tradeoff is another application/login and interbank owner-funding transfers. A different bank provides no inherent bookkeeping or tax advantage over a properly separate CIBC account. Check exports, bookkeeper access, recovery debits and tax-payment fees whichever bank is chosen.

Illustration, not a quote: ten chargeable self-service transactions on CIBC Basic would mean $16 in monthly/base transaction fees, before any deposit or other charges. RBC/BMO's $6/$5 base plans may be cheaper if those same transactions are included. One organizer registration is not one transaction in the proprietor's bank: organizer money stays in the organizer's account, and platform fees can be paid out in batches. Compare expected platform bank activity, not total registration count.

Recommendation: ask CIBC for its all-in cost at the expected activity and any existing-customer concession. If the difference is only a few dollars monthly, convenience is a good reason to stay. If standard Basic per-use pricing materially increases the cost, RBC Digital Choice is a strong comparison because it expressly includes electronic credits/debits; BMO Essential is also worth comparing at a slightly lower base fee, with Stripe-credit classification confirmed. No provider is selected until the checklist below passes.

Bank acceptance checklist: permitted proprietor/trade-name ownership; CAD Stripe payouts; authorized debit/negative-balance recovery if required; downloadable statements/CSV; predictable monthly/EFT/tax-payment fees; appropriate access protection; initial refund funding; one small authorized payout/debit proof at the relevant release gate. Organizers use their own accounts; no platform bank product is selected for them.

## 6. Custom bookkeeping decision and parallel delivery

Owner decision, 2026-10-23: start a small private bookkeeping tool instead of the former Phase 1B vendor-selection recommendation. The owner stopped and archived it later that day after B2.5; see the [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md). B3 revenue imports and B4 hardening/close were not completed.

The archived [project index](../archive/BOOKKEEPING_REVIEW.html#index), [tracker](../archive/BOOKKEEPING_PROGRESS.json) and [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md) preserve its status and evidence. The previous Wave/QuickBooks comparison was preparation, not a product selection or a requirement to buy software. The former 1-3-day vendor configuration allowance is retired. A replacement owner/delivery path for accepted bookkeeping and reconciliation proof has not been selected.

Revenue owns charging, Connect, tax decisions and source export. The archived project delivered private expenses, receipts, reports and a fixture-only importer preview, but no real Stripe import or reconciliation. Accepted source handoff and accounting proof remain required before national A+B launch. One shared source handoff and acceptance proof prevents duplicate ingest work.

The earlier money-control and accountant-delivery requirements still apply. Organizer registration gross is not automatically proprietor revenue; Stripe payouts are transfers rather than new sales. Existing-product selection is no longer an open launch decision.

## 7. Reconciliation proof and retained records

The [synthetic reconciliation fixtures](REVENUE_ACCOUNTING_PHASE0_FIXTURES.csv) use fictional CAD amounts, tax amounts and costs. They demonstrate money conservation and expose configuration failures; they are not actual prices, tax rates, Stripe settlement promises or approved journal entries. They assume the example service is earned in the same period. Annual subscription timing/deferred revenue needs the accountant's policy.

| Synthetic case | Family/customer cash less refunds | Organizer net | Platform net after example cost | What it proves |
|---|---|---|---|---|
| Software: 100 revenue + 10 tax; 3 processing cost | 110.00 | 0.00 | 107.00 | Bank payout is not revenue; 10 remains tax liability and 3 is cost |
| Registration: 100 + 10 organizer tax + 5 fee + 0.50 fee tax; platform pays 3 cost | 115.50 | 110.00 | 2.50 | Organizer retains its registration and tax; platform has 5 fee revenue, 0.50 liability, 3 cost |
| Same registration fully refunded; fee also refunded; cost retained by processor | 0.00 | 0.00 | -3.00 | Someone funds unrecovered processing; fee/tax credits and refunds must be linked |
| Same registration half refunded, including half fee/tax | 57.75 | 55.00 | -0.25 | Partial refunds can erase margin even if the initial sale was positive |
| Wrong configuration: organizer pays cost and platform takes the full gross fee | 115.50 | 107.00 | 5.50 | Cash balances but the organizer is short 3; conservation alone is insufficient |
| Same organizer payout fails or remains pending | 115.50 | 110.00 still due/in Stripe | 2.50 | Stripe balance is not a bank receipt; track payout state separately |

No Canadian tax obligation is established by the fictional split of registration and fee taxes. P03/P05 determine whether and how the production split can be charged, invoiced and remitted. Additional Connect, Tax, Billing, dispute and payout charges must be included in actual margin proof.

Operational source record proposal: environment, connected/platform account, internal organization/customer, registration allocations, quote/policy version, supplier/recipient, currency, gross/net/tax by jurisdiction, zero-tax reason, Stripe invoice/payment/fee/refund/dispute/balance-transaction/payout identifiers, status, timestamps and evidence links. Keep retry/event identity separate from financial object/posting identity so different events do not double-post one payment. Store only necessary personal data; card and bank details stay with Stripe.

Monthly routine: reconcile each platform and organizer Stripe balance from opening to closing; match gross receipts, fees, taxes, refunds/disputes and transfers; reconcile completed payouts to bank; keep pending/failed payouts as exceptions; tie registration allocations to the club books; compare platform revenue/tax totals to bookkeeping; review zero-tax reasons and thresholds; reserve/remit amounts on the confirmed calendar. Never clear unexplained differences to revenue.

Retain readable source exports, invoices/credit notes, registration/exemption support, relevant contracts and filed returns. CRA generally requires GST/HST records for six years after the relevant year; confirm longer exceptions and Canadian record-location/access requirements for chosen storage. See [CRA records](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/gst-hst-records-keep.html) and [electronic records](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/15-2/electronic-records.html).

## 8. Focused professional requests — drafts only

Accountant scope: request a fixed-scope quote for an Ontario sole proprietor selling Canadian CAD software plus facilitating Canadian sports registrations through direct-charge Connect. Deliver P01–P03, P05 tax allocation, P09/P10, and the 13-jurisdiction worksheet; distinguish proprietor obligations from each organizer's. Cover actual registration/exemption facts, provincial thresholds, Canadian platform obligations, fee invoicing, tax-inclusive/exclusive treatment, credits/returns, startup expenses and a sample close. State what requires legal referral and the ongoing filing cost. No U.S. tax review, incorporation engagement or mandatory automation retainer is requested.

Selection criteria: demonstrated Canadian SaaS/provincial-tax and payment-platform work; clear written conclusions and boundaries; ability to review connected-account sample records; named preparer/reviewer and filing owner; predictable setup/recurring costs. A general tax-return preparer without provincial software/fee expertise may need a specialist. Compare two scoped quotes when practical; the owner chooses and engages the advisor.

Legal scope: use the existing [counsel brief](FACILITATED_PAYMENTS_COUNSEL_BRIEF.md), narrowed to the actual Canadian launch and P03/P06/P12/P13. Ask for conclusions tied to the real payment chain and contracts, including any changes needed for Quebec. Preserve the Club release's existing counsel/broker dependencies; a question pack is not sign-off or an insurance quote.

Stripe request: confirm the following for our Canadian platform account and intended Canadian organizers. Ask for current account-specific documentation/support confirmation, then reproduce the required behaviour in sandbox. No external request has been sent.

- Which supported account/controller/API configuration preserves direct charges and hosted onboarding while assigning the intended processing fees and losses? How does it differ from legacy Express? Confirm restrictions before account creation.
- Can cards AND CAD ACSS/PAD use this configuration, application fees and the intended registration checkout? What are settlement, return, mandate, refund and dispute behaviours and costs?
- Can the reviewed registration-tax/fee-tax model operate in one intended checkout? Which entity's registrations/Tax settings and invoices are used? If unsupported, identify an explicit supported alternative before code is committed to the design.
- How are organizer tax settings collected/maintained without a full dashboard, including valid unregistered or exempt cases?
- Which fee, application-fee refund, balance and payout reports expose both platform and organizer records? Confirm data access, connected-account event destinations and account context.
- Confirm full costs: processing on tax/fees, Connect account/payout fees, Billing/Tax, foreign cards, refunds, failures and disputes. Confirm refund and negative-balance funding and platform versus organizer tax documents.

## 9. First implementation package — draft sequence

This is a dependency-based handoff, not a tax opinion or authorization to switch live settings. No schema is proposed before consulting the current database dictionary/snapshots at build time.

| Batch | Concrete change | Start/exit evidence |
|---|---|---|
| B0: safe preparation | Expand national test cases, confirm current subscription entry points and payment write seams, draft owner checkout/onboarding/refund mockups | Can proceed with labelled fictional fixtures; no live money/tax change. Club Stage 12 requires its owner mockup session before build |
| B1: Canadian subscription foundation | Real contracting-customer location; CAD catalog validation; approved price tax behaviour and actual effective registrations; deliberate sandbox setup | P01/P02 and relevant terms/location policy. Preserve existing CAD validation instead of adding a USD catalog |
| B2: subscription lifecycle + records | Organization/coach Checkout, setup-only and delayed first-charge paths, renewals, plan-move previews/confirmation, invoices and durable financial recovery | Apply one reviewed policy across paths; preserve comps/Founding Season dates and workspace ownership. Wrong/missing location and non-Canadian paid-software paths fail clearly before charge |
| B3: Connect configuration spike | One synthetic Canadian organizer; supported onboarding/controller configuration; card and PAD; fee/tax/refund/report proof | P03–P07. Sandbox evidence must prove organizer net, fee/tax funding and no duplicate allocation. No legacy Express assumptions or destination-charge fallback by accident |
| B4: registration integration | House league and tournaments write through existing payment/club-book seams; offline remains; connected-account event recovery | Club Stage 9 and current tournament-fee implementation dependencies verified. Stage 7a's former decision wait is recorded as resolved in the Club plan; do not reopen it from an older Stage 12 note |
| B5: nationwide launch proof | All 13 jurisdictions; correct supply/exemption reasons, legal/price wording, refunds/disputes, payout/bookkeeping proof and owner browser QA | Both A+B plus canonical Club release dependencies, actual cash/funding and filing owners. No provincial release ladder |

Rechecked entry points: `app/api/billing/create-checkout/route.ts`, `app/api/billing/create-team-checkout/route.ts`, `lib/billing-setup.ts`, `lib/next-season-choice.ts`, `lib/plan-move.ts`, `lib/stripe-prices.ts`, `lib/stripe-price-validation.ts`, and `app/api/billing/webhook/route.ts`. Confirm their current contents at build time. A separate account-aware Connect event path should not inherit the subscription handler's customer-required early return.

Do not expand into rep-team dues, sibling discounts, assistance, household credits or new payment plans by implication. Tournament deposits/partial records and the existing house-league two-registration/one-payment requirement remain the actual starting scope; other money policies need explicit product decisions.

## 10. Phase 0 exit and progress

Completed here: operating/responsibility map; focused decision and professional-request pack; banking/accounting comparison; synthetic reconciliation fixtures; draft first build sequence. These are preparation deliverables with local evidence.

Still required for Phase 0 exit: advisor engagement and conclusions; actual required registration effective dates; exact supported Connect configuration and fee/tax model; bank selection/eligibility; accepted bookkeeping and actual reconciliation; commercial riders and budget; resourced build sequence. Phase 0 remains open. No live Stripe changes, bank opening, professional engagement or external messages occurred.

Verification performed 2026-10-23: all six fixture cash-conservation checks pass, and the intended organizer-net check correctly identifies the deliberately wrong-payer case. The tax-response sheet contains 52 unique pending rows across 13 jurisdictions and four supplies. Artifact syntax, six-tab rendering in a simulated DOM, six rendered tables, progress counts, decision filters, print restoration, timing calculations, local file links and deterministic regeneration pass. This does not constitute browser/visual QA, a real Stripe transaction or professional approval.
