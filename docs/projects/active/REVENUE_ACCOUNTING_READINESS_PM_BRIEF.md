# Revenue and accounting readiness — PM brief

> **Created:** 2026-10-21 · **Priority:** P0 for paid launch readiness
> **Detailed plan:** [REVENUE_ACCOUNTING_READINESS_PLAN.md](REVENUE_ACCOUNTING_READINESS_PLAN.md)
> **Interactive review:** [REVENUE_ACCOUNTING_REVIEW.html](REVENUE_ACCOUNTING_REVIEW.html)
> **Stage:** Project defined; implementation and live-account verification follow the roadmap.

## Outcome

FieldLogicHQ can sell to customers across Canada and the United States with clear prices, correct currencies and applicable taxes, while the Ontario proprietor receives reliable books, reconciled deposits and timely tax-filing information. The process is designed to minimize monthly manual work and support a future corporation without losing history.

## What customers will experience

- Canadian subscription buyers see and pay CAD; U.S. subscription buyers see and pay USD. The owner has chosen **stable prices in each currency**, with actual USD amounts still to decide.
- The advertised billing period, Checkout total, invoice, portal and renewal agree. Government taxes and mandatory fees are presented according to reviewed rules; no surprise fee appears only at the last step.
- Organization billing belongs to its authorized billing admins. A coach buying personally and a future family/fan purchaser manage their own subscriptions and do not expose personal billing details to unrelated organization staff.
- For registration payments, the organizer and event currency are clear. A visiting U.S. family can still pay a Canadian event in CAD. Registration currency is not silently changed to match the payer's country.
- Organizers get a breakdown they can reconcile: registrations, taxes, fees, refunds and payouts. The existing manual/offline payment option remains part of the experience.

## What the business will gain

- One governed CAD/USD catalog and billing policy across marketing and every subscription lifecycle.
- A reviewed tax-treatment register for each supported product and location, with registration thresholds, filing owners and evidence.
- Separate tracking of subscription revenue, platform fees, organizer proceeds, collected taxes, processor costs and exchange differences.
- Automated ingestion, receipts, reconciliation and exception alerts where supported, with a named person for remaining reviews and filings.
- An accounting-system recommendation based on a practical CAD/USD/Stripe reconciliation proof before purchase.
- A future incorporation runbook that preserves entity ownership, subscriptions, historic invoices and refund obligations.

## Scope and delivery order

1. **Discovery and decisions:** verify current live configuration, commission the accountant's tax/fee analysis, confirm Stripe capabilities, propose USD prices and compare accounting options.
2. **Shared foundation:** catalog, billing identities, tax evidence, accounting integration and threshold reporting.
3. **Gate A — organization/coach subscriptions:** Canada/U.S. marketing and all subscription paths ready together.
4. **Gate B — tournament/house-league transactions:** direct-charge Connect payments, fees, registration taxes, refunds and payouts, coordinated with Club Stage 12 and its existing counsel dependency.
5. **Gate C — future personal family/fan subscriptions:** consumer billing and household ownership ready before the product is sold.
6. **Operations and Gate D:** repeatable month-end close and a separately scheduled corporation transition.

The owner has confirmed **separate readiness gates**. Subscription work need not wait for the registration-payment build, and planning for family/fan billing does not launch a premium family product.

## Provisional timing for review

At five focused engineering days per week with one implementer, allow approximately **6–9 weeks to organization/coach subscription readiness**, including a 2–4-week discovery/external-response allowance. Facilitated registrations add approximately **4–7 focused engineering weeks** in a sequential build and retain their counsel, Stripe and wider Club release dependencies. Future family/fan billing is approximately **1–2 focused weeks after product definition**, excluding premium product features. Incorporation is a separate business transition with no target date set.

These are planning estimates added 2026-10-21, not agreed dates. External registration/advisor delays can exceed the allowance; Phase 0 establishes the resourced schedule. The first complete operating month and close provide additional proof after launch.

## Decisions already made

- Canadian and U.S. subscription customers are in scope.
- Stable, separately set CAD/USD prices.
- Compare accounting systems before choosing one.
- Separate payment-model readiness gates.
- Existing plan/pricing canon, direct-charge payment direction, family-pays transaction default and paid-tier eligibility remain the starting decisions. No new price or fee rate is approved by this plan.

## Questions to resolve first

- What exact USD prices preserve customer value and margin?
- Which accounting system/connector handles the accountant's workflow, CAD/USD, taxes, platform fees and refunds at an acceptable recurring cost?
- What tax registrations and effective dates are required at launch, and who owns ongoing filing/remittance?
- When a family pays a transaction fee, who legally supplies that service to whom? That answer controls tax and invoice design.
- Does the chosen Canadian Stripe Connect configuration support U.S. organizers, the intended fees, currencies and payment methods?
- Who pays processing/FX costs, handles losses and funds refunds after organizer payout?

The detailed plan contains the full 25-item decision register, implementation tasks, validation matrix, primary-source references and gate evidence.

## Risks that change the plan

Current code assumes CAD, and inspected Checkout routes do not enable automatic tax or require billing addresses. Existing planning assumes a narrower Canada/CAD payment model and includes historical promotional dates. These need explicit implementation review.

Stripe's threshold monitoring excludes platform application fees and home-country obligations; it cannot be the only early-warning system. Mandatory service-fee disclosure and marketplace-tax responsibility also require review of the actual transaction structure. Tax-engine availability alone does not establish legal compliance.

## Success criteria

- California/USD and Quebec/CAD examples work from price display through renewal and bank/accounting reconciliation; all intended subscription jurisdictions have reviewed treatment.
- Every charged amount has an understandable price/fee/tax breakdown, and each no-tax result has a reason.
- No duplicate subscriptions, postings or tax transactions after event retries or recovery.
- Finance can reconcile every payout and tax control balance and complete a monthly close without reconstructing transactions manually.
- Every filing, remittance and exception has an accountable owner; automation gaps are visible.
- The first full close proves the process for the launched tracks before the project is considered complete.
