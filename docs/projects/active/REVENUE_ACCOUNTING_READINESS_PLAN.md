# Revenue readiness — Canada-wide CAD launch

> **Status:** Discovery underway. Owner confirmed the current launch scope on 2026-10-23: Canada-wide subscriptions AND registration payments, CAD only, without province-by-province rollout.
> **Review:** [project index](REVENUE_ACCOUNTING_REVIEW.html#index) · [PM brief](REVENUE_ACCOUNTING_READINESS_PM_BRIEF.md)
> **Progress:** [stage register](REVENUE_ACCOUNTING_PROGRESS.json) · [discovery evidence](REVENUE_ACCOUNTING_DISCOVERY.md)
> **Tax (2026-10-31):** FieldLogicHQ is registered for GST/HST and has sold nothing yet. FieldLogicHQ's own sales tax — D01, D05, D07, D08, D13, D17 and the tax part of D22 — is sequenced in [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md), ⚠ **Owner ruled 2026-10-31 (T1): US clubs come into scope** — location plumbing for both countries now, a US club-payments review inside that plan, and US clubs sold plans only once they can take payments. This supersedes the US lines of §1 and §3 below. ⚠ §6/§7 below still call the bookkeeping project archived; it restarted as [BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md).
> **Sequence ruling 7 (owner, 2026-10-31; index https://claude.ai/artifact/Kua6RAqMA7ChA7QBTNE63a):** this plan is brought up
> to date before any build session works from it (GST/HST Stages 1–3 are its Gate A tax work; US lines and the archived
> bookkeeping wording above are superseded). ⚠ **OPEN owner question:** §7 says this launch requires BOTH Gate A (subscriptions)
> and Gate B (registration payments) — i.e. no Canadian subscription is sold until family payments are ready. Does that stand?
> ✅ **RULED 2026-10-31: no — "launch together" is dropped** (see §7 and the Business Decisions Log).
> **Order across the five plans (set by Claude at the owner's request 2026-10-31; the owner may reverse it on the index):** 0 owner desk → 1 Plan & billing 4b
> Part 4 → 2 Plans & pricing Stage 0 → 3 Plans end at renewal Stages 1–3 + GST/HST Stage 1 → **4 tax live (GST/HST Stages 2–3 +
> Terms) — this plan's Gate A tax work** → 5 ONE help pass → **6 Club on sale (it waits for family
> payments through its own plan; Coaches Portal and Tournament Plus are already selling — launch-together ruled out 2026-10-31)** → 7 Plans & pricing program.
> **Expansion reference:** [original Canada/U.S. roadmap](REVENUE_ACCOUNTING_EXPANSION_BACKLOG.md). Its broader requirements and estimates are historical, not the current launch checklist.

## Scope after the 2026-10-31 hand-off (owner ruling)

Owner rulings, 2026-10-31: **(a)** every outstanding piece of work has a home stage in its plan; **(b)** Revenue readiness
**hands off Gate B** — each Gate B piece moves to the plan that builds it (Club Stage 12 for family and registration
payments, the Bookkeeping plan for the books, the GST/HST plan for tax) — and keeps only its own work; **(c)** event-triggered
stages are **standing triggers**: the project counts as complete without them. Where the rest of this document (§3, §7, §8,
§10) or the progress register (`REVENUE_ACCOUNTING_PROGRESS.json`, last updated 2026-10-23 and not yet rewritten) says
otherwise, **this section wins**. The Gate B wording below in §7 stays as history.

**Stays here — three stages:**
- **R1 — Its own decisions and the register rewrite.** NOT STARTED. D06 the CAD payout and bank arrangement and refund
  funding (J 0.9); D18 who owns monthly review, thresholds and filing/remittance deadlines (J 5.2); D24 operating budget,
  support load and minimum fee margin (J 0.11); any subscription-side advisor or Stripe determinations still owed (J 0.8
  arranging tax and terms advice, J 0.12 the subscription-side answers; D07/D08 stay answered by the GST/HST plan). Plus
  **rewriting the stale progress register** — `REVENUE_ACCOUNTING_PROGRESS.json` (updated 2026-10-23) is **superseded where
  it conflicts with this section** (the "stopped bookkeeping" focus line, "launch also requires Gate B" on 2.6, US marked
  deferred on 2.7, Gate B stages 3.x, Phase 1 externals); the JSON itself is rewritten as the R1 work, not by this edit.
- **R2 — Gate A evidence.** NOT STARTED. Waits on GST/HST Stages 1–3 and 6 (tax live, address, Terms). Cross-province
  validation of the subscription path, **including referrals across provinces** (§1, "Referral should work": an Ontario club's
  recommendation leads to the same signup and purchase for a BC or Québec club; also the §9 validation paragraph), saved
  cards, future-season choices, plan moves and failure/replay checks (J 2.2, 2.4); the owner browser walkthrough and support
  readiness (J 2.5); the Gate A evidence pack (J 2.6).
- **R3 — Phase 5 operations: STANDING TRIGGER** (after the first full month with sales). First monthly close and
  reconciliation (J 5.1), proving filing and remittance ownership in practice (J 5.2), margin / provider cost / owner-time
  review (J 5.3). Not needed to close the project.

**Done when** R1 and R2 are complete. **Standing trigger (not needed to close):** R3. **Deferred, never counted:** Phase 4
(J 4.1–4.4 family and fan subscriptions), J 5.4 and 5.5, D19, D21, D25.

**Handed off (no longer tracked here):**
- **To Club Stage 12 ([CLUB_TIER_STAGE12_PAYMENTS_PLAN.md](CLUB_TIER_STAGE12_PAYMENTS_PLAN.md)) — all of Gate B / Phase 3:**
  J 3.1–3.8 (Gate B evidence 3.8 included; the books half of 3.7 goes to the Bookkeeping plan and the fee-tax half of 3.5 to
  GST/HST Stage 5). Decisions about family or registration payments: **D09** price anchors vs real costs, **D10** may
  organizers absorb fees, **D11** fee base / fixed charge / installments / discounts / refunds, **D12** which payment methods
  launch, **D13** who collects and remits registration tax (NOT yet ruled; its platform-reporting question is in the GST/HST
  accountant package), **D14** Connect account and controller settings, **D15** registration exemption evidence, **D16** who
  funds refunds and disputes, **D22** visiting non-Canadian registration payers (the US half is GST/HST). The registration-side
  validation list (pending payments, retries and out-of-order events, partial and full refunds, payouts, ledger
  reconciliation, §9) goes with them.
- **To the Bookkeeping owner-experience plan ([BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md)):**
  Phase 1 externals J 1.4–1.13 (reliable source records and exports, backfill from May 1, subscription import and payout
  reconciliation, Connect fee / tax / refund bookkeeping, reports and accountant package, backup and controls), the **B3.5
  gate** (J 1.13), and **D02** the Stripe-to-books source model (J 1.5, 0.10).
- **To the GST/HST plan ([GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md)):** all tax — D01, D05, D07, D08, D17,
  D20 (Québec language and privacy, its Stage 6), the US halves of D22, **D03/D04** USD prices (its Stage 8b); J 1.1, 1.2, 1.3,
  and the build halves of 2.1–2.4 (its Stages 1–3).
- **Phase 0 other rows:** J 0.13 (lock the A+B build and schedule) is superseded by the hand-off; J 0.1–0.7 and 0.14–0.20 stay
  done history.

## 1. Current owner decisions — authoritative scope

> ⚠ **Brought up to date 2026-10-31 (sequence ruling 7).** Where a line below conflicts with the header's Tax note, the
> rulings in [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §3 win: US clubs are IN scope (T1), prices are
> tax-exclusive "plus applicable taxes" (T4), the accountant is not a launch gate (T6), and FieldLogicHQ is registered for
> GST/HST with nothing sold yet. Each superseded line is marked ⚠ in place; the 2026-10-23 text is kept as history.

The owner's latest clarification, 2026-10-23, supersedes the temporary Ontario-only/subscription-only proposal and the original Canada/U.S. launch scope:

- The launch is available throughout Canada, including Quebec, BC and all territories. Do not create province-specific waitlists or a rolling set of enabled provinces.
- Include existing eligible organization/coach subscriptions and tournament/house-league registration payments. ~~Both subscription and registration-payment readiness must be proven for this launch.~~ ⚠ **Ruled 2026-10-31:** subscription readiness (Gate A) is proven here; registration-payment readiness (Gate B) is proven in Club Stage 12 and does not hold subscriptions.
- Use CAD prices, charges, receipts, refunds and the intended CAD payout arrangements. U.S. paid software subscriptions, USD prices/settlement, premium family/fan subscriptions and incorporation are expansion work. ⚠ **Superseded 2026-10-31 for the US (T1, U1–U5):** US clubs are in scope for every product, opening together once the US tax and payments work in the GST/HST plan (Stage 8) is done; US clubs pay Stripe's fees directly; all 50 states and DC open at once with a platform-admin state tracker. **Still open:** USD list prices (D03/D04) and the US fee amounts. Premium family/fan subscriptions and incorporation remain expansion work.
- Referral should work: an Ontario club's recommendation must lead to the same signup and eligible product-purchase experience for a BC or Quebec club.
- There is no owner-imposed release deadline. Complete the focused Canadian requirements before launch rather than creating an arbitrary geographic exclusion or silently charging zero tax.
- Simplify the business and operations: one country, one charge currency, existing plan catalog, registration fees as the initial facilitated-payment category, straightforward books.
- The owner reports FieldLogicHQ is pre-revenue. Confirm other proprietor activities and actual tax-registration effective dates separately. ⚠ **Updated 2026-10-31:** FieldLogicHQ is now **registered for GST/HST** (number received the week of 2026-10-24) and has sold nothing yet; every taxable sale carries tax from the first one.
- Accountant selection is included, with a focused Canadian scope. Avoid requiring U.S. counsel, a USD bank account, incorporation or an elaborate custom accounting integration before launch. ⚠ **Updated 2026-10-31 (T6, U5):** the accountant is not a launch gate — the question package is prepared and FieldLogicHQ charges what the research supports; no US lawyer before launch.

Existing pricing/packaging, free entitlements, Founding Season commitments and payment tier eligibility remain authoritative in the [pricing facts](../../agents/strategy/PLAN_PRICING_FACTS.md). The payment architecture remains organizer-owned Connect accounts and direct charges, with family-pays as the existing commercial direction. The precise fee supplier/recipient and tax treatment still need confirmation. This document approves no new rate.

Existing [facilitated-payments legal dependencies](FACILITATED_PAYMENTS_SCOPING_PLAN.md) and [Club Stage 12](CLUB_TIER_PRODUCTION_READINESS_PLAN.md) coordination remain relevant because registration payments are in scope. This project does not silently waive other Club release gates.

## 2. Signup, geography and low-friction purchase experience

**Do not restrict a person's account creation because they are in Quebec, BC or another province.** A coach/family's residence or IP address is not necessarily the subscription customer's jurisdiction.

Proposed experience for implementation review:

1. Account creation and ordinary free access follow existing product rules across Canada. Collect only the necessary organization details in normal onboarding.
2. The contracting club/coach's billing country/province, billing address and relevant business/use-location facts support the tax calculation. The card's country, browser language and IP location are secondary signals, not automatic admission tests.
3. A Canadian customer anywhere in Canada gets the same eligible CAD subscription path, clear price/period, applicable tax and final amount before authorizing payment.
4. The registration flow identifies the organizer, registration price, applicable tax, mandatory fee treatment, payment schedule and refund policy. A Canadian participant can pay a Canadian event regardless of provincial borders.
5. Stripe-hosted organizer onboarding collects required identity and bank details once. Reuse completed onboarding across events where supported; explain any statutory verification request plainly. Low friction does not mean bypassing KYC.
6. The service must be ready for the full intended geography before enabling this nationwide paid launch. Incomplete provincial configuration is a release issue, not a provincial waitlist strategy.
7. Do not make Ontario HST the national default. Each tax outcome must reflect the reviewed supply/location/registration facts; zero tax must have a valid reason.
8. Website/contract language and privacy requirements are assessed separately from tax. Free signup is not a blanket exemption from those obligations.

No geographic restriction or new checkout code has been enabled by this planning update.

### Boundary for the deferred U.S. paid-software market

⚠ **Superseded 2026-10-31 (T1).** US clubs are in scope, so this is no longer a boundary to hold. The server-side check below survives as the **US evidence rule (T7)**: a US address, a required declaration and one outside-Canada sign (card country or Stripe-verified payout country) before a US buyer is charged 0%. The wording is kept as history.

Plan a server-side eligibility check on new paid software Checkout, card-backed trials that auto-convert, future subscription choices and privileged/manual purchase paths. A hidden marketing button alone is insufficient. Collect the real contracting customer's country; do not equate a Canadian club using a foreign card with a U.S. software customer.

If the buyer is outside the supported launch market, explain the offer clearly and retain any permitted account/free access. Handle incomplete or conflicting addresses before payment. The precise policy for non-Canadian participants in Canadian tournaments must be decided independently; do not silently block foreign cards or visiting teams as a proxy for a software-market restriction. Preserve existing lawful commitments when designing any change.

## 3. What is in and out

| Launch essentials | Expansion backlog |
|---|---|
| Canada-wide existing eligible subscriptions, CAD | ⚠ U.S. paid software subscriptions now IN scope (T1; GST/HST plan Stage 8); USD catalog still open (D03/D04) |
| Canadian organizer Connect onboarding and direct-charge registrations | Cross-border organizer payout products not needed for this launch |
| Tournament and house-league registration categories | New transaction categories such as merchandise or camps unless explicitly added |
| GST/HST and relevant provincial registration/treatment review | ⚠ Fifty-state U.S. tax/nexus work — now a per-state sales tracker in platform admin, all 50 states and DC open at once (U4; GST/HST plan Stage 8) |
| Separate registration-tax and platform-fee tax logic | Premium household/fan subscriptions |
| Clear signup, pricing, fee, cancellation/refund and privacy terms | Incorporation execution |
| CAD payout eligibility, refunds/disputes and simple accurate books | USD banking/FX infrastructure and unnecessary custom GL automation |

The expansion items are deferred, not completed or deleted. Preserve the stable stage IDs and historical evidence.

## 4. Canadian tax and terms review — bounded deliverable

Produce a focused Canadian subscription/registration/fee matrix rather than the original international workbook. It must cover all 13 provinces/territories, but many rows share federal GST/HST rules. Four provinces need particular separate attention: BC PST, Saskatchewan PST, Manitoba RST and Quebec QST.

For each supply/jurisdiction, record classification, location rule, required current registration or supported no-registration conclusion, threshold/aggregation/window where relevant, effective date, collector/filer/remitter, evidence, filing frequency and software support.

The review must distinguish:

- Software supplied to a club, nonprofit organization or individual coach. Business/nonprofit status is not a universal exemption.
- The organizer's registration supply, including facts supporting any youth/charity/nonprofit exemption.
- FieldLogicHQ's platform service and its actual contractual recipient. A family paying a fee does not alone establish the supplier/customer.
- Any marketplace/distribution-platform obligation that changes who collects/remits registration tax.
- An unregistered small supplier, a zero-rated or exempt supply, and missing Stripe configuration. Those are different explanations for a zero result.

Use the [Canada rollout review](REVENUE_ACCOUNTING_CANADA_ROLLOUT.md) for official sources and questions. It is research/briefing, not a completed tax opinion. Register where actually required; do not unnecessarily register with every provincial authority just because signup is national.

Quebec includes a focused review of applicable French-language/standard-form contract requirements and privacy obligations for this Ontario provider. Do not assume a QST threshold determines those duties.

A Canadian accountant can own the tax/bookkeeping work and identify a bounded legal/payments review for Connect/terms where necessary. No broad U.S. legal/tax engagement is part of launch. ⚠ **2026-10-31:** the accountant reviews at the first tax time and is not a launch gate (T6); the build follows the research in `docs/agents/accounting/` (index `ACCOUNTING_INDEX.md`) and the stages in the GST/HST plan.

## 5. Verified current state and remaining implementation

Completed 2026-10-23: [repository audit and read-only Stripe configuration snapshots](REVENUE_ACCOUNTING_DISCOVERY.md). Each live/sandbox active catalog has 14 CAD prices with CAD-only expanded currency options. That fits the new currency direction; it does not establish tax/payment readiness.

- ⚠ Still true 2026-10-31: the code charges no tax anywhere, and Stripe Tax has no registrations. GST/HST Stage 2 adds the Canada registration (normal GST/HST, origin Ontario) and automatic tax on every checkout path.
- Live Tax settings are active, with zero configured registrations in the inspected list. Sandbox Tax settings are pending. Confirm actual authority registrations and effective dates before configuration.
- Live price tax behaviour is unspecified; sandbox is exclusive. Choose and test an explicit consistent policy.
- Inspected Checkout builders do not explicitly enable automatic tax or require the necessary address/tax-ID collection.
- Existing subscription, saved-card, future-season and plan-change paths need the same Canadian tax/location policy. Respect current comp/trial commitments and first-charge instants.
- The existing application payment stack is subscription-oriented; account-aware Connect onboarding, payment/fee/refund/payout events and financial reconciliation still require implementation.
- Marketing's CAD language is now directionally aligned; review applicable taxes, mandatory fees, availability and legal seller disclosures rather than rewriting the catalog for USD.
- Historical audit documents include the old international brief. Their observations remain evidence; their broad professional engagement scope is superseded by this charter.

## 6. Minimal Canadian financial design

### Subscriptions

Use the existing Canadian Stripe account, existing governed CAD catalog and Stripe Billing. Validate product, amount, interval, currency, price tax behaviour, environment and actual tax configuration. Require necessary customer location evidence and handle subsequent address updates/renewals consistently. Preserve app-owned cancellation/plan-change rules unless deliberately changed.

### Registration payments — required at launch

Keep the existing direct-charge direction and paid-tier eligibility:

- Each organizer owns the connected account and its registration supply, subject to the reviewed legal tax allocation.
- Confirm the intended Canadian account/controller configuration, fee payer and loss responsibility with Stripe.
- Define registration tax and FieldLogicHQ fee tax separately. Application-fee transfers are not automatically tax invoices or fee tax calculations.
- Decide how any tax owed by FieldLogicHQ is funded; do not leave platform-remitted tax stranded in organizer funds.
- Handle deposits/installments, partial payments, discounts, pending debit methods, offline records, refunds, fee refunds, disputes and payout failures.
- Keep offline payments usable; online payment events feed the same registration/team money records without duplicate paid entries.
- Select the launch payment methods from actual supported Canadian/CAD capabilities and economics; do not enable extra rails merely because they are available.
- Confirm the fee supplier/customer, pre-tax fee base, fixed-fee frequency, international-card treatment and refund rules before implementing calculations.
- Complete the existing counsel/payments questions for the actual Canadian model. Direct charges alone do not prove regulatory or marketplace exemption.

### Banking and bookkeeping

One suitable CAD proprietor payout arrangement is sufficient for the platform's launch scope. Confirm bank ownership/name, permitted business use, refund/negative-balance funding and clean record separation. The owner reported no separate business bank account; this requires a practical arrangement, not USD accounts or incorporation. Organizers separately supply their own eligible payout arrangements through Stripe onboarding.

CIBC permitted-use research, 2026-10-23: its published Canadian terms require business accounts for sole proprietorships and restrict personal accounts to personal use. This is the specific reason the owner's existing free unlimited CIBC personal account cannot be assumed suitable. Stripe's proprietor-name ownership rules are a separate check. See the exact bank/Stripe/CRA sources in the [Phase 0 banking explanation](REVENUE_ACCOUNTING_PHASE0_REVIEW.md#5-minimal-cad-banking-recommendation). Avoid framing a business-branded product as a universal sole-proprietor tax requirement. Stripe supplies the sales evidence; expense records and bank reconciliation remain necessary.

⚠ **Superseded 2026-10-31 — the bookkeeping project RESTARTED** as [Owner bookkeeping: easier daily work](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) (six-stage ladder ruled 2026-10-27; Parts 1–6 of Stage 1 built). Its Stage 4 is purchases only; the **sales side of GST/HST** is added by GST/HST plan Stage 4, which must be in place before the first return with sales on it. The paragraphs below describe the archived project and stay as history; the "no active bookkeeping owner/path" statements no longer hold, and D02 now points at that plan.

Owner decision, October 23: start a custom private bookkeeping tool instead of the former Phase 1B vendor-selection strategy. On October 23, the owner stopped and archived that project after B2.5 expense-only readiness. Its [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md) and [tracker](../archive/BOOKKEEPING_PROGRESS.json) preserve completed and incomplete work. Customer club accounting remains separate.

Revenue owns checkout, Canadian tax/fee decisions, Connect and source exports. The earlier bookkeeping project delivered an expense/manual-report core and fixture-only CSV preview, but it did not accept the source model or implement real import/reconciliation. ⚠ **2026-10-31: it restarted as the [Bookkeeping owner-experience plan](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md), which now owns the Stripe-to-books handoff and the source model (D02) — see "Scope after the 2026-10-31 hand-off".** Keep a single versioned handoff and link shared acceptance evidence rather than building duplicate Stripe ingestion.

The archived B0 audit proposes a [versioned CSV v1 movement contract](../archive/BOOKKEEPING_B0_AUDIT_AND_CONTRACT.md#proposed-stripe-csv-v1-handoff) and [synthetic sample](../archive/BOOKKEEPING_SOURCE_CSV_V1_SAMPLE.csv). Revenue still needs to accept or revise source IDs, seller/tax attribution, fee/refund linkage and payout mapping before an exporter/importer posts real money; the archived proposal is not acceptance.

Reconcile gross subscriptions, platform revenue, collected taxes, processor costs, refunds, disputes, organizer money and bank payouts. A net bank deposit is not revenue. Include personally paid business purchases, foreign-currency costs and historical receipts from May 1, while keeping actual GST/HST effective-date decisions separate.

A large accounting-system procurement/custom connector is optional until transaction volume justifies it. Registration volume still needs an auditable source record, deduplication and recovery; simpler bookkeeping does not remove money-integrity requirements.

## 7. Phases, gates and timing

Maintain all six phase groups and their stable stage IDs in the [progress register](REVENUE_ACCOUNTING_PROGRESS.json). The artifact distinguishes current launch stages from deferred expansion stages; future scope is not counted as an unfinished launch prerequisite.

| Phase | Current purpose | Preliminary effort / dependency |
|---|---|---|
| 0 | Confirm Canadian model, registrations, fee/terms facts, CAD banking, product offer and bookkeeping process | 3–5 focused engineering days of discovery/preparation; advisor/Stripe/registration lead time separately tracked |
| 1 | CAD catalog checks, Canadian location/tax policy, basic financial records, event recovery and bookkeeping handoff | 8–12 focused engineering days after dependent decisions |
| Accounting handoff (former linked bookkeeping project) | ⚠ Restarted 2026-10-31 as the Bookkeeping owner-experience plan (its six-stage ladder); HANDED OFF to that plan | Owned there; the sales side of GST/HST is GST/HST Stage 4 |
| 2 | Canada-wide subscription, renewal/plan-change and marketing readiness; Gate A | 8–12 focused engineering days; existing promised comp/trial behaviour preserved |
| 3 | Canadian organizer/registration payments; Club Stage 12 coordination; Gate B | 20–35 focused engineering days; actual legal/provider capabilities and refund/tax funding required |
| 4 | Future family/fan subscription product | Deferred; no launch date or mandatory launch effort |
| 5 | First monthly close, actual margin/exception review; future corporation runbook | Close follows first complete operating month; corporation execution deferred |

These are existing preliminary engineering allowances, not a promised release date or professional quote. Phases 0–3 total about 39–64 focused engineering days if sequential, approximately 8–13 full engineering weeks, plus external waits and wider product-release dependencies. Re-estimate after decisions and actual design. Canada-only scope reduces international work; including registration payments still requires a substantive payments build. No artificial deadline is imposed.

⚠ **2026-10-31:** the bookkeeping project restarted as the owner-experience plan (see §6); the rows and sentences below that call it stopped, archived or ownerless are history. What the gates below need from it is the reviewed Stripe-to-books handoff plus the sales side of GST/HST (GST/HST plan Stage 4).

The former custom bookkeeping project was stopped on 2026-10-23, then restarted 2026-10-31 as the Bookkeeping owner-experience plan, which is the delivery path (no replacement owner is needed). Its B3 handoff and B4 controls/close are carried by that plan's ladder (hand-off ruling 2026-10-31). Link the first full close from revenue Phase 5 only after it is completed.

### Coordinated launch requirements

- **Gate A:** Canadian subscriptions, correct applicable taxes, complete geography, price/terms consistency, renewal/refund verification, ledger/payout proof and owner browser QA.
- **Gate B:** Canadian organizer onboarding, registration/fee tax responsibility, legal/provider capability, payments and allocations, refunds/disputes, payout/tax funding, financial reconciliation and owner QA.
- ~~**This launch requires BOTH A and B.**~~ ⚠ **RULED 2026-10-31 — "launch together" is dropped.** Subscriptions do not wait for family payments. Gate A and Gate B remain separate verification gates, and neither holds the other's sales. Coaches Portal and Tournament Plus are already on sale in production and stay on sale; any tax owed on a sale made before tax is built comes out of the owner's own revenue. A plan that depends on family payments (Club) is held by its own plan. For a plan not yet on sale, correct tax, buyer location and the Terms stay the gate. Logged in the Business Decisions Log, 2026-10-31.
- **Linked bookkeeping gate B3.5 (legacy reference 1.13):** expense/receipt workflow, reviewed imports/reconciliation, report/receipt export, access/backup controls and reviewer ownership are required for A+B. ⚠ **2026-10-31: HANDED OFF** to the Bookkeeping owner-experience plan, which now owns this gate and its delivery path (the earlier project stopped before satisfying it; it restarted). Revenue readiness no longer tracks it.
- Complete focused province/territory checks before opening paid launch nationally; no geographic waitlist is the fallback delivery strategy.
- Any remaining Club release dependencies are coordinated in their canonical release plan.

Useful launch outcomes: first successful subscriptions and registrations, accurate invoices/receipts, organizer reconciliation and a repeatable monthly close. Owner may set a commercial expansion checkpoint such as paying clubs, renewals and demonstrated U.S. demand; no numerical traction threshold is silently decided here.

## 8. Decision register

"Deferred" items are visible expansion questions. They do not hold the Canadian launch. No specific tax determination is completed merely because a question is documented.

| ID | Question / required decision | Owner | Suggested starting position / dependency | Needed before |
|---|---|---|---|---|
| D01 | Current GST/HST registration/effective date and other proprietor taxable activities? | Owner + Canadian accountant / CRA | Owner confirmed October 23: no other self-employed business revenue; not applied, intends to apply within a week, requests May 1, 2026 first-expense date. Backdate is outside usual voluntary 30-day window; actual accepted date remains open. **2026-10-31:** registered (number received the week of 2026-10-24), nothing sold. Owner reply (read as): the date on CRA's letter is **2026-09-26**; a backdate request is with CRA and, with no revenue yet, matters only for rebates on past expenses, not for this project. The GST/HST plan (Stage 0 item 1) tracks it. | Canadian tax configuration (Stage 2 needs the date to add the Stripe Tax registration) |
| D02 | What bookkeeping and source-data handoff meets the owner's reporting and accountant needs? | Owner + engineering + accountant | Custom project stopped and archived October 23 after B2.5; B3/B4 incomplete. ⚠ **2026-10-31: restarted as the owner-experience plan; the owner path is that plan's six-stage ladder, and GST/HST Stage 4 adds the sales side.** ⚠ **HANDED OFF 2026-10-31 to the Bookkeeping plan:** accepting the Stripe/tax source model is its work now. | Shared model and A+B readiness |
| D03 | ⚠ No longer "future only" (T1, 2026-10-31): fixed USD prices or exchange-rate pricing? | Owner (`/strategy`) | US clubs are in scope; USD list prices are an open follow-up in the 2026-10-31 sales-tax decision. Until decided the CAD catalog is unchanged. | Opening US clubs (GST/HST Stage 8) |
| D04 | ⚠ Same: exact USD prices and grandfathering? | Owner (`/strategy`) | Open with D03; also the margin-only US fee schedule (U1). | Opening US clubs |
| D05 | How should national signup and customer-location collection work? | Product + finance | Nationwide Canadian signup/purchase direction confirmed 2026-10-23; collect contracting-customer location in normal onboarding, not an IP-based province block. ⚠ 2026-10-31: sequenced as GST/HST Stage 1 (country, province/state and address on every paying organization or coach, required on every checkout path, saved on our own records), now for both countries. | Signup/checkout design |
| D06 | Which suitable CAD payout/bank arrangement and refund funding will the proprietor use? | Owner + finance + Stripe | Existing free CIBC personal account reported; its published Canadian terms prohibit business use even for sole proprietorships. Compare permitted CIBC/RBC/BMO arrangements; actual choice/funding remains open. Stripe name matching and bank permitted use are separate. | Payout readiness |
| D07 | What GST/HST and provincial tax treatment/registrations apply to the Canadian launch supplies? | Canadian accountant | Focused 13-jurisdiction subscription/registration/fee matrix, not a fifty-state review. ⚠ 2026-10-31: the research is in `docs/agents/accounting/GST_HST_ON_SUBSCRIPTIONS_CANADA.md`; **T6 — the accountant confirms it at tax time and does not gate launch**. Watch BC ($10,000) and Québec ($30,000) first (GST/HST Stage 7). | National launch |
| D08 | Who supplies FieldLogicHQ's family-paid transaction service to whom? | Accountant + counsel + owner | Preserve family-pays direction; document the actual contractual recipient and invoicing. ⚠ **RULED 2026-10-31 (T3, T2):** the fee is always FieldLogicHQ's charge to the club (family-pays means the club passes its own cost on), and GST/HST goes on top of it, charged to the club. The counsel brief gets the exempt-financial-service question. | Registration/fee design |
| D09 | Do current Canadian transaction price anchors cover actual costs and taxes? | Owner + Stripe + finance | Revalidate existing canonical rates; this charter does not reprice them. | Payment launch |
| D10 | May organizers absorb fees and how is a quote honoured after a setting change? | Owner + product | Existing optional-absorption question remains open; choose one clear default. | Registration UX |
| D11 | What fee base, fixed charge, installment, discount and refund rules apply? | Owner + accountant | Explicit CAD examples and versioned policy; no automatic margin guess. | Fee implementation |
| D12 | Which Canadian/CAD payment methods launch and what are their return/settlement rules? | Stripe + owner | Confirm actual capabilities; add only methods justified by the customer experience and economics. | Payment launch |
| D13 | Who collects/remits each registration tax, including any platform obligations? | Accountant + counsel | Review actual Canadian supply/platform facts and remittance funding. ⚠ 2026-10-31: the platform-reporting question (CRA digital-platform rules, due each January 31) is in the accountant package; the fee side is GST/HST Stage 5. The registration-tax allocation itself is NOT ruled. | National payment launch |
| D14 | What Canadian Connect account/controller settings are appropriate? | Stripe + engineering | Preserve direct charges, hosted onboarding and existing risk direction; get account-specific confirmation. | Connect build |
| D15 | Which tournament/house-league registration exemptions need evidence? | Product + accountant | Distinguish SaaS from participant registration and youth/nonprofit/charity facts. | Registration tax design |
| D16 | Who funds refunds/disputes after organizer payout? | Owner + counsel + Stripe | Define a practical escalation/funding policy; no unapproved reserves or holds. | Payment terms |
| D17 | What revenue, tax, refund, fee and source records are needed for simple accurate CAD books? | Accountant | Keep source references and reconciliation; avoid a custom general ledger unless necessary. ⚠ 2026-10-31: the sales-side tax records are GST/HST Stage 4, inside the Bookkeeping ladder. | Financial implementation |
| D18 | Who reviews the monthly records, thresholds and filing/remittance deadlines? | Owner | Assign a practical owner/backup; a full international finance team is not required. | Operating readiness |
| D19 | Future only: family/fan product and adult household ownership? | Owner + product | Deferred; no premium household billing is required for launch. | Personal product |
| D20 | What Quebec language/contract and Canadian privacy/terms requirements apply to this actual model? | Appropriate Canadian advisor + product | Focused review; tax thresholds do not determine every non-tax duty. | Canada-wide offer |
| D21 | Future only: corporation effective date and Stripe/account migration? | Owner + accountant + Stripe | Deferred; preserve entity attribution so a later change is possible. | Incorporation |
| D22 | ⚠ U.S. market policy RULED 2026-10-31 (T1, T7, U1–U5); US territories get their own check later. Treatment of visiting non-Canadian registration payers? | Owner + product + advisors | US clubs are in scope for every product; proof for charging a US buyer 0% is a US address, a required declaration and one outside-Canada sign. Define the visiting-payer case separately without using card issuer country as a customer-geography proxy. | Relevant payment policy |
| D23 | Ontario-only, staged provinces or nationwide Canadian launch? | Owner | Decided 2026-10-23: all of Canada, subscriptions AND registrations, with A+B readiness before launch and no province rollout/waitlists. ⚠ 2026-10-31: "A+B before launch" dropped; Gate B handed to Club Stage 12; no province rollout/waitlists still stands. | Scope confirmed |
| D24 | What operating budget, support load and minimum fee margin are acceptable? | Owner + finance | Canadian/CAD model only; compare simple operations with automation cost. | Vendor/fee decisions |
| D25 | Future only: app-store channels for personal subscriptions? | Owner + product | Deferred alongside the personal product. | Personal product |

## 9. Stage tracking and handoff requirements

The canonical status source is REVENUE_ACCOUNTING_PROGRESS.json. Complete stages only with a completion date and evidence. A finished brief is distinct from receiving an answer; code, automated verification, owner visual QA and launch evidence remain separate.

Each stage is tagged launch, expansion or external. Deferred expansion is never ticked as complete or made an accidental launch blocker. External bookkeeping rows retain historical IDs and link to the canonical B-stages; exclude them from this project's delivery totals while preserving their explicit launch dependencies. Preserve historical completed work when scope changes. Expand stubs when the corresponding work opens.

After updating the register, plan decisions or PM brief, run:

    node scripts/build-revenue-review.mjs

The self-contained artifact embeds the current data and needs no account/backend to review. Progress checkboxes are read-only; agents update them in the same unit of work as verified deliverables. Root TODO retains the overall project until the definition of done is met.

Validation for future implementation must cover all intended Canadian provinces/territories, both subscription and registration supply types, applicable no-tax/exemption reasons, Canadian cross-provincial referrals, pending payments, retries/out-of-order events, partial/full refunds, fees, payouts and ledger reconciliation. Test signup separately from payment eligibility. Owner performs browser/visual verification under AGENCY_RULES.md unless explicitly delegated.

This scope update changes project documentation/artifact only. It does not switch live tax settings, change plans, create geographic blocks or enable Connect.

## 10. Immediate work package

### Phase 0 preparation delivered 2026-10-23

The [Phase 0 review packet](REVENUE_ACCOUNTING_PHASE0_REVIEW.md) now maps suppliers, charge accounts, tax/fee responsibilities, banking/accounting alternatives and the draft build sequence. It includes bounded accountant/legal/Stripe requests, a [52-row tax-response sheet](REVENUE_ACCOUNTING_PHASE0_TAX_REVIEW.csv), and [six synthetic reconciliation fixtures](REVENUE_ACCOUNTING_PHASE0_FIXTURES.csv). The artifact has a dedicated Phase 0 review tab.

New implementation findings: confirm the actual Connect fee-payer/controller configuration before creating organizer accounts; legacy Express behaviour must not be assumed to preserve the full organizer net. Prove registration-tax versus platform-fee-tax support for the actual liability model. Stripe's Canada guidance says domestic threshold monitoring needs separate handling, and its described direct Canadian filing service does not cover this resident proprietor's regular regime. The packet links the current primary sources.

The historical facilitated-payment economics table is not launch margin proof: it uses a percentage different from its later ratified anchor. Current prices/rates remain governed by the canonical pricing facts; no repricing occurred. Real margin proof must include actual processing on gross charged amounts, taxes and fees, Connect/Billing/Tax costs, refunds and losses.

Phase 0 remains open. Owner-reported current proprietor facts are recorded, completing stage 0.5 on October 23; the actual accepted GST/HST effective date, professional/provider conclusions, banking selection, accepted bookkeeping with real Stripe-to-bank proof, commercial riders and resourced schedule remain open. Preparing these deliverables does not complete stages 0.8–0.13.

1. Complete the focused Canadian subscription + registration + platform-fee review and necessary registrations/effective dates; address Quebec's applicable contract/language facts.
2. Confirm one CAD platform payout arrangement and organizer onboarding requirements.
3. Lock the fee supplier/recipient, processor cost/risk allocation, tax funding and refund model with Stripe/advisors.
4. Implement the existing CAD subscription tax/location gaps and minimal reliable financial records.
   ⚠ 2026-10-31: the former separate bookkeeping project restarted as the Bookkeeping owner-experience plan, which now owns the accounting handoff (see "Scope after the 2026-10-31 hand-off").
5. ~~Build Canadian registration payments in coordination with Club Stage 12.~~ **Handed off 2026-10-31 to Club Stage 12.**
6. ~~Verify A+B nationwide before launch~~ — Gate A (subscriptions) is verified here (R2); Gate B belongs to Club Stage 12 and neither holds the other (§7). Prove the first full close afterward (R3, a standing trigger).

Professional scope is now Canadian and task-specific. U.S. sales, USD banking/pricing, premium family/fan products and corporation execution stay in the expansion backlog.

## 11. Source and evidence register

Sources checked 2026-10-23; classification and applicability still require confirmation against the actual facts.

- [Focused Canadian rollout research and questions](REVENUE_ACCOUNTING_CANADA_ROLLOUT.md).
- [Completed repository/Stripe audits and original briefing packages](REVENUE_ACCOUNTING_DISCOVERY.md).
- [CRA place-of-supply guidance](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-place-supply.html).
- [Stripe Tax with Connect](https://docs.stripe.com/tax/connect) and [software-platform tax integration](https://docs.stripe.com/tax/tax-for-platforms).
- [Existing facilitated-payments scope](FACILITATED_PAYMENTS_SCOPING_PLAN.md) and [Club readiness](CLUB_TIER_PRODUCTION_READINESS_PLAN.md).
