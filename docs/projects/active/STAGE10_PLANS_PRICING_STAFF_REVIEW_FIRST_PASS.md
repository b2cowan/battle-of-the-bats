# For the owner — revised after the second pass (Claude, 2026-10-30)

*Codex's first-pass owner page is kept below, unchanged, for provenance. This revision keeps its findings and adds what a
second reader found. The drawings that go with it are `STAGE10_PLANS_PRICING_STAFF_DRAWINGS.html` (published as an Artifact: https://claude.ai/artifact/MiNmwvyFX75jwmJoa2rdNm). It
passed the `/design` review on 2026-10-30; the Dark frames were not part of that review.*

**Where staff stand today.** Product and Super admin can change what is for sale (price links, on/off switches, trial
length). Billing can look at the catalogue but not change it; Billing owns customer money (refunds, free time, cancel).
Customers can already move between paid plans themselves. There is no tool to move *existing* customers to a new price, to
edit a running trial, to pause or end-at-renewal, or to produce an invoice document. The Plans & pricing screen shows **no
dollar amounts at all**, only whether a price link exists.

**Three problems that matter** (all confirmed in the code by a second reader):
1. **Swapping a price link makes existing subscribers unrecognised, silently.** The billing system answers "ok" and simply
   stops updating their plan, status and renewal date. Nothing warns anyone.
2. **A customer's Plan & billing page shows the catalogue price, not what they pay.** Any price change makes that page
   wrong for every existing customer.
3. **"Approved" does not mean "done".** The Approval queue applies a change the moment it is approved (the same person can
   ask and approve), a stored effective date is ignored, and Promotions are recorded but do nothing at checkout.

**What I would change in Codex's approach:**
- **The Approval queue is already a one-person step.** With no second approver it is ceremony. Money-moving changes should
  become a **Change** with a preview, a reason and a history; the queue stays only for planning records.
- **Do not rewrite the role table now.** There is one admin. No new roles; reuse the existing money power for
  per-customer actions; one new Super-admin-only power for moving many customers at once.
- **Keeping amounts in code leaves two switches** (the release that changes the shown amount, and the price link that
  changes the charge). Safe only if checkout closes itself when they disagree. This is the real cost of that option, and it
  is the owner's call (decision 1 below).
- **Build last what is needed least.** Nobody pays today, so the many-customer migration is the highest-risk, lowest-value
  piece. Decide its policy now; build it last.
- **Four small fixes come before any workflow:** the billing page's amount, the lost old price links, the "None" next-charge
  reading (it cannot tell a failed read from no charge, and sees only the first twenty subscriptions), and making the change
  log strict (a strict variant already exists for refunds).

**Five paths** (drawn in the Artifact): *new-customer price* → choose, verify, preview, publish · *existing-customer price* →
audience, notice, schedule, watch or stop · *trial* → future purchases or one customer's first-charge date · *refund* →
customer, Money, charge, existing refund · *invoice* → customer, document, payment or date range.

**Decisions, in order** (recommendations are mine, none is made for you): (1) where new-customer prices live: amounts stay in
code with the console checking them, or a dated price book; (2) what existing customers keep and when a change reaches them;
(3) notice length and wording (your adviser; I assert no law); (4) the Approval queue becomes Changes; (5) roles; (6)
Promotions stay record-only; (7) create prices in Stripe from the console or guided paste; (8) the invoice document's name
and tax lines (adviser). The asks tab of the drawings holds each with its picture.

**Still unknown:** the real customer and price cohorts in production (this review read the dev database screens only), live
Stripe grants, notice and tax wording, how Founding holders are treated, and whether a date means the first changed renewal
or a charge on that exact day.

---

# Codex's first-pass owner page (kept as written)

Staff can inspect plans and record changes today, but the controls do not yet form a dependable price-change journey. [A] Product can change catalogue settings; Billing can inspect them and handle customer money, so the person answering a billing question cannot necessarily change the setting behind it. [A] The Money tab already reads payments and supports refunds, and customers already have working paid-plan moves. [A] Promotions mostly record intentions rather than apply offers at checkout. [A] Trial settings affect future eligible purchases, while free time grants access and does not stop an existing Stripe subscription charging. [A] The largest missing piece is a change record that connects the intended price, the exact customers, their notice, the eventual charge, and recovery when only part succeeds. [A]

**The three biggest problems:** replacing a price link can leave older subscriptions unrecognised; displayed catalogue prices can differ from what an existing customer actually pays; and a recorded or approved change is not reliable proof that the intended billing change happened. [A]

**Five simple paths to consider:** new-customer price → choose plan and cycle → verify a new price → preview → publish; existing-customer price → choose audience and policy → review amounts and notices → schedule → monitor or stop; trial → choose future purchases or one existing subscription → review the end date → confirm; refund → customer → Money → charge → existing refund action; invoice → customer → Invoices → payment or date range → generate our document from the recorded facts. These are proposals, not approved designs. [A]

**Five decisions, in order:** (1) subscription billing first, with family payments kept separate — recommended; (2) what existing customers retain and when changes reach them — recommend renewal after adequate notice, subject to your adviser; (3) where prices live — recommend preserving code and the facts record for the first read-only work, then choosing dated price data only if console-managed publication is required; (4) who may act — recommend Billing for individual money work, Product for catalogue preparation, Super admin for bulk live changes and role grants; (5) what counts as a successful notice and a correct invoice — recommend your own recorded notices and payment-based documents, with failed or uncertain delivery stopping the affected migration. [A]

Still unknown: actual customer and price cohorts, live settings and permissions, required notice and tax wording, the treatment of Founding holders, and whether a date means the first changed renewal or a charge on that exact date. Please check Canadian consumer and tax requirements with your adviser; this review makes no legal conclusion. [A]

---

Review date: 2026-10-30. This is a source review and a set of recommendations, not authority to build or a record of owner decisions. [A]

Evidence key: **[V path:line]** = source opened in this review; **[D file]** = documentary lead not established in runtime code; **[S]** = public Stripe documentation read this session, linked beside the claim; **[A]** = inference, proposal, or explicitly unverified possibility. The owner page above uses [A] for its plain-language synthesis so that it contains no implementation paths; the supporting evidence follows. [A]

Only this document is written. Source files and public Stripe documentation were read; no Stripe API, database, email, audit script, dev server, browser walk, build, or test was executed. Public documentation reading is the express documentation allowance in the assignment, not access to a Stripe account. [A]

## Part A · Verified map of what exists

The console combines live settings, planning records, and a published feature mirror; those have different effects. [V app/platform-admin/plans-pricing/page.tsx:164] [V lib/plan-module-entitlements.ts:123]
The main financial controls are narrower than their labels suggest, and several claims in the drawings brief need correction. [A]
No conclusion below establishes live database contents, paying customer counts, deployment state, or successful production operation. [A]

### A1 · Screens, actions, access, effects, and records

| Surface / action today | Who may use it | What actually happens next; what is recorded |
|---|---|---|
| `/platform-admin/plans-pricing`; old `/plans` and `/stripe-prices` links | Super admin, Product, Billing open; Super admin and Product have `catalog` writes. [V lib/platform-areas.ts:109] [V lib/platform-areas.ts:181] | Old pages redirect here. The page reads gates, plan/status counts, config overrides, slots, versions, add-ons, change requests, promotions, matrix and drift. [V app/platform-admin/plans/page.tsx:5] [V app/platform-admin/stripe-prices/page.tsx:5] [V app/platform-admin/plans-pricing/page.tsx:164] |
| Plan impact counts | Same readers. [V lib/platform-areas.ts:181] | Groups organization rows by stored plan and status, not by historical Stripe price or verified paying subscription. These counts cannot be a bulk billing preview. [V app/platform-admin/plans-pricing/page.tsx:107] [V app/platform-admin/plans-pricing/page.tsx:166] [A] |
| Gate change → request → Approval queue → Approve | Super admin or Product; same person can request and approve. [V app/api/platform-admin/product-catalog/change-requests/route.ts:604] [V app/api/platform-admin/product-catalog/change-requests/route.ts:665] | Supported proposal writes the gate immediately, then marks implemented. Runtime gate precedence is development cookie, environment override, DB, code fallback. It is an acquisition control, not subscription cancellation. [V app/api/platform-admin/product-catalog/change-requests/route.ts:693] [V lib/plan-gating-server.ts:21] [A] |
| Edit price ID → request → Approve | Super admin or Product. [V lib/platform-areas.ts:109] | Replaces or clears `stripe_prices.price_id`; checks expected previous value and slot identity, validates when matching Stripe key exists, writes updater/time/note, audit/application records and request status separately. It creates no plan price in Stripe and preserves no historical ID in the resolver. [V app/api/platform-admin/product-catalog/change-requests/route.ts:220] [V app/api/platform-admin/product-catalog/change-requests/route.ts:267] [V app/api/platform-admin/product-catalog/change-requests/route.ts:293] [V lib/stripe-prices.ts:50] |
| Price check | Catalogue actors; approval API repeats the check. [V app/api/platform-admin/product-catalog/change-requests/route.ts:274] | Missing price, inactive, nonrecurring, wrong interval, currency or mode block when checked. Amount, reuse and peer-product mismatch warn. A missing/wrong-mode server key skips external validation without blocking; warnings need no server-side acknowledgement. `Configured` on the list only means an ID exists. [V lib/stripe-price-validation.ts:99] [V lib/stripe-price-validation.ts:114] [V lib/stripe-price-validation.ts:141] [V lib/stripe-price-validation.ts:167] [V app/api/platform-admin/product-catalog/change-requests/route.ts:281] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:1290] |
| Limits/trials → request → Approve | Super admin or Product. [V lib/platform-areas.ts:109] | Stores tournament limit, seat limit and trial days; null restores code defaults. Generated trial-only request is executable. Checkout consumes merged trial days, and operator moves onto Club can grant a local trial. Seat and tournament enforcement inspected still uses code/per-club values; a saved global override is not proof those limits changed. [V lib/plan-config-db.ts:44] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:592] [V app/api/billing/create-checkout/route.ts:343] [V lib/operator-plan-change.ts:203] [V app/api/admin/members/invite/route.ts:68] [V lib/plan-config.ts:236] |
| Feature matrix → draft/request → approval → separate Publish | Super admin or Product; Publish requires a note and approved matrix request. [V app/api/platform-admin/product-catalog/feature-matrix/publish/route.ts:62] | Publishes DB matrix metadata, records before/after and reason, marks request implemented. Runtime module access still follows code; the screen computes published/live differences. Publication alone changes no customer entitlement. [V app/api/platform-admin/product-catalog/feature-matrix/publish/route.ts:110] [V lib/plan-module-entitlements.ts:123] [V lib/plan-module-entitlements.ts:147] |
| Add-on catalogue and versions | Read on Plans & pricing; catalogue requests can describe planned changes. [V app/platform-admin/plans-pricing/page.tsx:169] [V app/api/platform-admin/product-catalog/change-requests/route.ts:19] | Add-on records already have amount/effective-date fields. Display can use those amounts, while core plan display uses config. This is not a general create-and-bill add-on workflow. Retired add-on slots remain in the list. [V app/platform-admin/plans-pricing/page.tsx:45] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:198] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:1072] [A] |
| Promotions → create / change status | Super admin or Product (`catalog`), not Growth's `growth` power. [V app/api/platform-admin/product-catalog/campaigns/route.ts:40] [V lib/platform-areas.ts:109] | Direct table insert/update, not request/approve. Stores target plans, dates, coupon text, discount summary and trial days. Audit records actor and values but no required why. No reviewed checkout consumes this table. [V app/api/platform-admin/product-catalog/campaigns/route.ts:74] [V app/api/platform-admin/product-catalog/campaigns/route.ts:100] [V app/api/platform-admin/product-catalog/campaigns/route.ts:155] [A] |
| Club/portal record → Money → charge → Refund | Super admin, Billing, Support read Stripe; only Super admin and Billing refund. [V lib/platform-areas.ts:114] [V lib/platform-areas.ts:115] | Live uncached read, older charge windows, subscription comparison and refund flow. Refund writes a durable started record with actor/role/reason/mode/amount before Stripe, uses that ID as idempotency key, rechecks remainder and recovers unknown results by listing refunds. Ordinary audit failure is separately reported. [V app/api/platform-admin/orgs/[id]/money/route.ts:12] [V lib/console-money-stripe.ts:368] [V lib/console-money-stripe.ts:383] [V lib/console-money-stripe.ts:404] [V lib/console-money-stripe.ts:422] [V lib/console-money-stripe.ts:443] |
| Free time: club record Access / person record Coaches Portal | Club: Super admin/Billing; portal: those plus Support. [V lib/platform-areas.ts:101] [V lib/platform-areas.ts:118] | Timed access grant, reason and actor; expiry read on access without an expiry job. Club cap: Billing six months, Super admin twelve. Portal: Support/Billing ninety days, Super admin six months from first give; repeat and volume restrictions apply. Paying portals are refused. It does not modify Stripe trial dates or stop collection. [V lib/free-time.ts:17] [V lib/free-time.ts:52] [V lib/free-time-writes.ts:121] [V lib/portal-free-time.ts:26] [V lib/portal-free-time.ts:66] [V lib/portal-free-time.ts:363] |
| Staff Cancel subscription | Super admin/Billing (`club_billing`). [V lib/platform-areas.ts:101] | Immediate path: local cancellation/public-site suspension and audit precede Stripe cancellation. Stripe failure leaves local suspension and returns a warning; do not equate local status with confirmed stopped charges. [V app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts:240] [V app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts:271] |
| Customer Plan & billing → Move / Keep current plan | Existing customer mechanism, distinct from staff catalogue work. [V components/billing/BillingBody.tsx:232] | Up-move previews prorations and updates one existing subscription; down-move schedules next renewal, no transition proration; Keep releases the pending schedule. Current code can release/rewrite an existing schedule, a future campaign conflict. [V lib/plan-move.ts:190] [V lib/plan-move.ts:275] [V lib/plan-move.ts:322] [V lib/plan-move.ts:390] |

**Request types, without trusting their names:** the seven accepted labels are `plan_version`, `feature_matrix`, `addon`, `pricing`, `grandfathering`, `campaign`, `trial`. [V app/api/platform-admin/product-catalog/change-requests/route.ts:19] A generated `stripe_price_update`, `plan_gating_update` or `plan_config_update` applies when approved, regardless of the business label; generic requests without those kinds are tracking records, and matrix publishing has its own endpoint. [V app/api/platform-admin/product-catalog/change-requests/route.ts:693] [V app/api/platform-admin/product-catalog/feature-matrix/publish/route.ts:77] `effective_at` is stored, but this approval branch does not wait for it. A future-dated request must not be presented as a scheduled billing instruction. [V app/api/platform-admin/product-catalog/change-requests/route.ts:633] [V app/api/platform-admin/product-catalog/change-requests/route.ts:696] [A]

**Audit limit:** the ordinary audit helper logs errors and returns, and the catalogue-application helper does likewise. Generated proposal change notes can be null. The current mechanism does not guarantee the owner's new who/what/when/why requirement. [V lib/platform-audit.ts:25] [V lib/platform-catalog-approval.ts:75] [V app/api/platform-admin/product-catalog/change-requests/route.ts:124] [A] The first-go rule permits an authorised actor to act alone; it does not authorise unlogged changes or settle which roles get new powers. [V docs/agents/strategy/BUSINESS_DECISIONS.md:63] [V docs/agents/strategy/BUSINESS_DECISIONS.md:65]

Built refund boundaries remain: own-club, demo, wrong-owner, unpaid, disputed and exhausted charges are refused; reason is required. Billing has a five-in-twenty-four-hours threshold and six-month charge-age limit; Super admin handles cases beyond those limits under the existing rule. This review does not propose different caps or a second approver. [V lib/console-money.ts:397] [V lib/console-money.ts:447] [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md:237] The existing configured-price helper checks whether an ID is present, not full runtime Stripe validity. [V lib/stripe-prices.ts:43]

Stage 4b's accepted contract also stays: portal caps run from first give, Premium work is kept rather than copied back to Basic, and Keep Premium charges without carrying unused free days forward. A price campaign cannot change those promises through the effective access plan. [V lib/portal-free-time.ts:26] [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md:640] [V docs/agents/strategy/BUSINESS_DECISIONS.md:81] [V docs/agents/strategy/BUSINESS_DECISIONS.md:83] [A]

### A2 · Existing Stripe call families

This inventory separates code presence from a staff-facing action; it is based on source calls, not account permissions or exercised behaviour. [A]

| Family | Reads / writes already present; purpose |
|---|---|
| Customer, payment method, card setup | Customer create/delete for setup races, retrieve for Money, list by email for own-club checks; webhook updates default method. Payment-method retrieve/list and setup Checkout exist. [V lib/billing-setup.ts:51] [V lib/billing-setup.ts:78] [V lib/billing-setup.ts:258] [V lib/billing-setup.ts:288] [V lib/console-money-stripe.ts:165] [V lib/staff-own-club.ts:42] [V app/api/billing/webhook/route.ts:135] [V lib/billing-setup.ts:113] |
| Checkout / hosted billing | Subscription Checkout for orgs and standalone portals; next-season Checkout; hosted customer-portal session for invoices/payment details. [V app/api/billing/create-checkout/route.ts:349] [V app/api/billing/create-team-checkout/route.ts:333] [V app/api/billing/choose-next-season/route.ts:180] [V app/api/billing/portal/route.ts:53] |
| Subscriptions / schedules | Retrieve/list, existing-item update, immediate cancel, create/update/release schedules. Used by actual customer moves and cancellation, not a bulk repricing console. [V lib/plan-move.ts:105] [V lib/plan-move.ts:289] [V lib/plan-move.ts:325] [V lib/plan-move.ts:330] [V lib/plan-move.ts:373] [V lib/plan-move.ts:395] [V app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts:275] |
| Products / prices | Plan slot validation and move previews retrieve prices. Audit scripts retrieve products, list prices and inspect webhook/portal/account settings; they were not run. No direct subscription-catalogue `products.create` / `prices.create` call found in `app`, `lib`, `scripts`. Connect payment Checkout does supply inline `price_data.product_data`, so the literal assertion that the app never creates any product/price is too broad. [V lib/stripe-price-validation.ts:130] [V lib/plan-move.ts:167] [V scripts/audit-stripe-billing.mjs:229] [V scripts/audit-revenue-readiness.mjs:52] [V lib/stripe-connect.ts:153] [A] |
| Invoice / invoice payment | List/search/retrieve invoices; invoice-payment list connects a payment intent to its invoice; preview upcoming/prorated invoice. Fee billing also lists invoice items/lines, creates/deletes items, creates/finalizes invoices and rereads state. [V lib/console-money-stripe.ts:109] [V lib/console-money-stripe.ts:160] [V lib/console-money-stripe.ts:169] [V lib/console-money-stripe.ts:268] [V lib/platform-stripe-fees.ts:329] [V lib/platform-stripe-fees.ts:448] [V lib/platform-stripe-fees.ts:493] [V lib/platform-stripe-fees.ts:503] [V lib/platform-stripe-fees.ts:707] |
| Charges, intents, refunds, credits | Charge list/retrieve, intent retrieve, refund create/list/recovery; fee-credit reversal lists and creates credit notes. Presence of that fee-credit code does not give Billing a general subscription-credit button. [V lib/console-money-stripe.ts:167] [V lib/console-money-stripe.ts:227] [V lib/console-money-stripe.ts:253] [V lib/console-money-stripe.ts:404] [V lib/console-money-stripe.ts:452] [V lib/platform-stripe-fees.ts:325] [V lib/platform-stripe-fees.ts:346] [A] |
| Connect, separate money flow | Connected account create/update/retrieve, onboarding and Express login links; direct payment Checkout create/retrieve/expire; connected refund create/read/list, dispute retrieve, payout list, payout balance-transaction list and webhook verification. These are families paying their club, not the club's platform subscription. [V lib/stripe-connect.ts:38] [V lib/stripe-connect.ts:65] [V lib/stripe-connect.ts:84] [V lib/stripe-connect.ts:111] [V lib/stripe-connect.ts:117] [V lib/stripe-connect.ts:141] [V lib/stripe-connect.ts:172] [V lib/stripe-connect.ts:180] [V lib/stripe-connect.ts:201] [V lib/stripe-connect.ts:214] [V lib/stripe-connect.ts:226] [V lib/stripe-connect.ts:235] |
| Missing general staff tools | No general pause-collection, existing-subscription trial editor, Stripe coupon creator or receipt-resend action found in the reviewed billing/catalogue paths. This is a bounded source-search finding, not a statement of Stripe capability. [A] |

The shared client uses a server secret and pins `2026-04-22.dahlia`. Connect account creation alone specifies a newer preview version. [V lib/stripe.ts:5] [V lib/stripe-connect.ts:20] This matters because current public trial documentation describes newer APIs as well as the legacy trial parameters the app uses. [S] [Stripe trial offers](https://docs.stripe.com/billing/subscriptions/trials), [free trial periods](https://docs.stripe.com/billing/subscriptions/trials/free-trials).

### A3 · Webhook identity and retained facts

| Event / identity | Actual behaviour and limit |
|---|---|
| Signature / routing | Raw-body signature validation; objects without a customer return 200. Fee invoice metadata routes to a dedicated persisted invoice path before subscription handling. [V app/api/billing/webhook/route.ts:87] [V app/api/billing/webhook/route.ts:101] [V app/api/billing/webhook/route.ts:110] |
| Subscription created/updated | Ordinary handling reads the first subscription item's price ID and searches current `stripe_prices` rows by that ID alone, without mode filter. Plan metadata/product name is not an ordinary fallback. Next-season choice has its own earlier exception. [V app/api/billing/webhook/route.ts:270] [V app/api/billing/webhook/route.ts:282] [V app/api/billing/webhook/route.ts:306] [V lib/stripe-prices.ts:50] |
| Historical ID removed from slot | An unmatched ID skips the normal plan-sync block and returns 200. No immediate downgrade or cancellation is performed by that miss. Stripe may keep charging the old subscription while this branch stops refreshing its plan, status, cycle and period end; the next independently handled invoice/deletion event can still have effects. Exact customer outcome depends on later events, not just the slot edit. [V app/api/billing/webhook/route.ts:306] [V app/api/billing/webhook/route.ts:412] [V app/api/billing/webhook/route.ts:543] [V app/api/billing/webhook/route.ts:923] [A] |
| Recognised org subscription | Writes plan, tournament limit, status, subscription ID, billing cycle and period end. Protects an existing paying record from another subscription taking it over; records growth events and plan-change side effects. [V app/api/billing/webhook/route.ts:403] [V app/api/billing/webhook/route.ts:412] [V app/api/billing/webhook/route.ts:435] [V app/api/billing/webhook/route.ts:454] |
| Club-funded Coaches Portal | Portal subscription handling is separate; the club pays that second subscription on its own Stripe customer. Such a subscription does not make the customer shared between clubs. [V app/api/billing/webhook/route.ts:328] [V lib/console-money-store.ts:45] |
| Invoice success/failure | Success activates/refreshes the recorded subscription state and clears payment attention; failure sets past due and notifies owners, rather than suspending service in that branch. Record-subscription checks protect against another subscription's invoices. [V app/api/billing/webhook/route.ts:802] [V app/api/billing/webhook/route.ts:829] [V app/api/billing/webhook/route.ts:848] |
| Trial reminder / deletion | Trial reminder resolves owner and sends the transactional template. Deletion distinguishes withdrawn future Founding choices from account cancellation, and otherwise applies portal or org cancellation/retention. [V app/api/billing/webhook/route.ts:893] [V app/api/billing/webhook/route.ts:549] [V app/api/billing/webhook/route.ts:570] [V app/api/billing/webhook/route.ts:659] |
| Refund events / receipt dedup | The reviewed switch has no general refund-event branch or whole-handler event-receipt store; selected business events have their own keys. Trial email invocation itself carries no event deduplication key. Do not claim the whole webhook runs exactly once. [V app/api/billing/webhook/route.ts:435] [V app/api/billing/webhook/route.ts:911] [V app/api/billing/webhook/route.ts:921] [A] |
| What is persisted | Subscription state, business events, card-on-file stamps, refund commands and fee invoices already exist. General historical subscription invoice lines, taxes and payments are not retained by these normal invoice branches; Money explicitly reads Stripe without storing the answer. A new facts layer extends existing records rather than pretending nothing is stored. [V lib/billing-setup.ts:263] [V lib/console-money-stripe.ts:369] [V lib/platform-stripe-fees.ts:438] [V app/api/billing/webhook/route.ts:802] [V app/api/platform-admin/orgs/[id]/money/route.ts:12] [A] |

**Money is useful but not yet a complete billing story.** It fetches only the first twenty subscriptions, chooses the first live non-cancelling one for its next-charge preview, and turns preview failure into null; the view labels null `None`. A club-funded portal on the same customer makes identity especially important. Read each recorded subscription explicitly and distinguish unavailable from no charge. [V lib/console-money-stripe.ts:155] [V lib/console-money-stripe.ts:163] [V lib/console-money.ts:388] [V lib/console-money-store.ts:47] [A]

### A4 · Customer-visible amounts and source drift

| Surface | Source / consequence |
|---|---|
| Public pricing cards | Code config for amounts; Club trial sentence uses its default code days, even though checkout can use DB trial override. [V components/PricingSection.tsx:134] [V components/PricingSection.tsx:142] [V app/api/billing/create-checkout/route.ts:343] |
| Public FAQ | Two Premium answers type a real amount directly; matches now, but bypasses central repricing. [V app/pricing/page.tsx:203] [V app/pricing/page.tsx:209] [A] |
| Plan & billing current amount | Reads profile config, not the actual subscribed item amount. New-sales-only changes must not change what this page tells existing subscribers they pay. [V components/billing/BillingBody.tsx:108] [A] |
| Renewal and pending plan move | Current period date and scheduled move/Keep control already shown. General scheduled price-notice line is new work. [V components/billing/BillingBody.tsx:231] [A] |
| Customer invoices today | Words and action open the secure payment portal. Fee list separately shows invoice number/date/payment link. Neither is the requested general branded subscription invoice list. Customer page contract is owner-only. [V lib/plan-billing-words.ts:47] [V lib/plan-billing-words.ts:58] [V components/billing/StripeFeesList.tsx:16] [V lib/plan-billing-data.ts:35] [A] |
| Public card completeness | Association is intentionally a Club band rather than a separate grid card; Premium has its own callout. Adding a plan requires an explicit card or exclusion decision, not automatically one card per config key. [V components/PricingSection.tsx:215] [V lib/plan-config.test.ts:22] |
| Help / annual-savings language | Portal setup help hardcodes current amounts. Savings helper calculates the saving but always describes two free months; a changed annual/monthly ratio could invalidate that sentence. [V lib/help-content/platform-admin.tsx:1185] [V lib/plan-config.ts:545] [A] |

Additional directly checked customer-visible price locations, for a later publication checklist: [A]

| Surface | Evidence / dependency |
|---|---|
| Tournament-organizer and coach persona pages | Config amounts in public offer and annual lines. Coach annual wording says season, which needs an explicit interval-versus-season copy check if cycle policy changes. [V app/for-tournament-organizers/page.tsx:256] [V app/for-coaches/page.tsx:196] [V app/for-coaches/page.tsx:210] [A] |
| Club and League persona pages | Config amounts plus separately typed capacity/savings wording; code amounts alone will not update every surrounding promise. [V app/for-clubs/page.tsx:189] [V app/for-leagues/page.tsx:141] [A] |
| Plan article and plan-move dialog | Article reads config amounts and separately types annual savings framing; move refusal/offer can also display target config amounts. [V components/billing/PlanArticlePanel.tsx:74] [V components/billing/PlanArticlePanel.tsx:103] [V components/billing/PlanMoveDialog.tsx:222] |
| Coach Explore and signup | Explore reads configured portal monthly amount; signup builds both cycle choices through price formatters. [V components/coaches/CoachExploreCatalog.tsx:159] [V app/team/TeamSignupClient.tsx:82] |
| Founding display and emails | Normally-price anchors derive from config in Founding panel, transactional offer email and marketing defaults. Preserve issued promises and do not re-open old offers when changing those anchors. [V components/marketing/FoundingSeasonPanel.tsx:58] [V lib/email.ts:1910] [V lib/marketing-email-defaults.ts:57] [A] |

This is a source-backed surface census, not certification of every amount-bearing string or rendered state. [A] The directly verified config-import census is **141 static importing files** across `app` (51), `components` (18), `lib` (43), `tests` (26), `scripts` (3); 111 are runtime-source files after excluding the config test. This is not 141 amount readers, nor a count of transitive consumers. [A]

Reproduction, read-only; result observed in this session, including optional `.ts` import suffix: [A]

```powershell
$pattern = '^import.*from\s+[\x27\x22][^\x27\x22]*/plan-config(?:\.ts)?[\x27\x22]|^\s*\}\s+from\s+[\x27\x22][^\x27\x22]*/plan-config(?:\.ts)?[\x27\x22]'
$files = @(rg -l $pattern app components lib scripts tests)
$files.Count
```

**Facts reconciliation, report only:** the current six plan entries' names, monthly/annual amounts and Club capacity bands match the canonical main table on this read; no numeric disagreement found there. The free League floor is a separately described profile, not another `OrgPlan` entry. [V docs/agents/strategy/PLAN_PRICING_FACTS.md:28] [V lib/plan-config.ts:38] [A] Availability needs qualification: Facts says Premium is purchasable, but code fallback is `early_access`; DB gates can override it. Live availability was not checked and neither version is silently selected here. [V docs/agents/strategy/PLAN_PRICING_FACTS.md:34] [V lib/plan-config.ts:68] [V lib/plan-gating-server.ts:38]

The Facts checklist's documentary surfaces were inspected, with these discrepancies recorded rather than repaired: [V docs/agents/strategy/PLAN_PRICING_FACTS.md:186]

- Facts' older change log still describes paid-plan moves as not built; actual move code exists. Its old Club card/no-card warning is superseded in the card source. [V docs/agents/strategy/PLAN_PRICING_FACTS.md:163] [V lib/plan-move.ts:289] [V components/PricingSection.tsx:140]
- Brand strategy repeats amounts and uses the older paid League naming in one segment; its own naming table differs. Memory says it is a pointer but repeats amounts and old not-built claims. These violate the pointer discipline even where amounts happen to agree. [V docs/agents/brand/BRAND_STRATEGY.md:124] [V docs/agents/brand/BRAND_STRATEGY.md:171] [V memory/project_pricing_strategy.md:10] [V memory/project_pricing_strategy.md:14] [A]
- README correctly points to Facts. Pricing-copy document explicitly labels its older Founding offer material as history; do not count that history as a current live offer. [V README.md:41] [V docs/agents/brand/PRICING_PAGE_COPY.md:8]
- Public Club trial sentence says card; billing's newer sentence says payment method and accepts eligibility/days. The duration-source difference remains as well. [V lib/plan-config.ts:159] [V lib/plan-billing-words.ts:66] [V components/PricingSection.tsx:142]
- Setup guide has obsolete product names, currency/price settings and a portal-cancel test contradicting its newer portal restriction. Its later fee-invoice/webhook material is newer and should be preserved during a future targeted rewrite. [V docs/agents/ops/stripe-setup-guide.md:54] [V docs/agents/ops/stripe-setup-guide.md:79] [V docs/agents/ops/stripe-setup-guide.md:122] [V docs/agents/ops/stripe-setup-guide.md:147] [V docs/agents/ops/stripe-setup-guide.md:185]

### A5 · Drawings brief §4: every census assertion checked

The source lead for this table is the earlier brief's §4; verdicts below concern present source, not the earlier author's confidence marks. [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE10_DRAWINGS_PROMPT.md:59]

| Lead, split where needed | Verdict | Evidence / correction |
|---|---|---|
| Core amounts, limits, trials in config; DB gates/three overrides/slots | Confirmed | Types and merge identify these sources. [V lib/plan-config.ts:6] [V lib/plan-config-db.ts:7] [V lib/stripe-prices.ts:5] |
| No dollar amounts anywhere else | Refuted | Add-on catalogue already carries monthly/annual values; fee/refund facts also carry amounts. This is not evidence that main plan list prices are DB-controlled. [V app/platform-admin/plans-pricing/page.tsx:45] [V lib/console-money-stripe.ts:370] |
| About 65 config readers; some hardcoded copy | Refuted count; confirmed copy | 141 scoped imports counted above; help/FAQ literals and brand/memory duplication identified. [A] [V lib/help-content/platform-admin.tsx:1185] [V app/pricing/page.tsx:203] |
| IDs pasted per plan/cycle/environment, key prefix chooses mode | Confirmed | `sk_live_` check, independent slot lookup. Restricted-key compatibility is a separate defect risk, not validated here. [V lib/stripe-prices.ts:18] [V lib/stripe-prices.ts:22] [A] |
| Nothing creates a Stripe product/price | Confirmed for subscription catalogue; blanket claim refuted | No direct catalogue creation calls found; Connect uses inline product/price data for one-off payments. [A] [V lib/stripe-connect.ts:153] |
| Pasted ID uses approval and blocks bad active/type/interval; amount only warns | Confirmed, incomplete | Also blocks currency/mode, but wrong product/reuse warn and unavailable matching key skips Stripe checks. [V app/api/platform-admin/product-catalog/change-requests/route.ts:267] [V lib/stripe-price-validation.ts:114] [V lib/stripe-price-validation.ts:141] [V lib/stripe-price-validation.ts:175] |
| Webhook price ID alone; slot swap orphans old subscribers | Confirmed ordinary sync risk | Old ID no longer resolves; 200 with no ordinary subscription sync, not an instant downgrade. Next-season special case and independent invoice/deletion branches remain. [V lib/stripe-prices.ts:50] [V app/api/billing/webhook/route.ts:282] [V app/api/billing/webhook/route.ts:306] [V app/api/billing/webhook/route.ts:923] |
| No runbook; nobody pays today | Could not tell | No preservation workflow found in reviewed catalogue paths; repository-wide runbook absence and live customer counts are not established. [A] |
| Trials apply at checkout only | Refuted universal wording | Operator Club move also stamps a local trial using merged days. [V app/api/billing/create-checkout/route.ts:343] [V lib/operator-plan-change.ts:203] |
| No second trial after subscription history | Confirmed org checkout; not universal | Org history check exists. Portal checkout creates a new customer and uses a different condition; its default is currently zero days. [V app/api/billing/create-checkout/route.ts:339] [V app/api/billing/create-team-checkout/route.ts:317] [V lib/plan-config.ts:64] |
| Trial length changeable by request without deploy | Confirmed | Generated trial request executes config proposal; no update to existing Stripe trials in that path. [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:592] [V app/api/platform-admin/product-catalog/change-requests/route.ts:693] |
| No per-customer/promotion trial | Qualified | No general existing-Stripe-trial editor found; operator local Club trial and access-only free time exist. Promotion trial field is recorded, not enforced by reviewed checkout. [V lib/operator-plan-change.ts:203] [V lib/free-time.ts:17] [V app/api/platform-admin/product-catalog/campaigns/route.ts:84] [A] |
| Stripe ends checkout trials; no local cron; reminder email | Confirmed reminder; expiry inferred | Reminder is explicitly handled. No trial-expiry job found in reviewed path; do not apply this statement to local operator trials without separate expiry review. [V app/api/billing/webhook/route.ts:893] [S] [Stripe free trials](https://docs.stripe.com/billing/subscriptions/trials/free-trials). [A] |
| Promotions do nothing at checkout; no coupon passed | Confirmed bounded search | Table is used by catalogue page/route; checkout construction supplies price and trial parameters, no promotion/coupon. [V app/platform-admin/plans-pricing/page.tsx:183] [V app/api/billing/create-checkout/route.ts:349] [V app/api/billing/create-team-checkout/route.ts:333] [A] |
| No existing-customer price campaign/history/notice | Confirmed in reviewed code | Slot application replaces current ID; request date is metadata. Individual paid-plan movement does exist separately. [V app/api/platform-admin/product-catalog/change-requests/route.ts:293] [V app/api/platform-admin/product-catalog/change-requests/route.ts:633] [V lib/plan-move.ts:264] [A] |
| Pricing, grandfathering, trial requests all labels only | Partly refuted | Supported proposal kind executes; generic tracking-only requests do not. Trial and pricing generators produce executable proposals. [V app/api/platform-admin/product-catalog/change-requests/route.ts:693] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:597] |
| No plan-amount/Facts guard; fee guards only | Confirmed bounded reference search | No main amount comparison found. Partial new-plan/card protection already exists, so not all plan guards are absent. [V lib/plan-config.test.ts:32] [A] |
| Stale setup guide | Confirmed, partly | Old settings and old cancel test, newer webhook guidance coexist. [V docs/agents/ops/stripe-setup-guide.md:122] [V docs/agents/ops/stripe-setup-guide.md:147] [V docs/agents/ops/stripe-setup-guide.md:185] |
| Screen about 2,800 lines, counts/slots/limits/drift/add-ons/promotions | Confirmed functional census | Page data loading establishes these features; exact client length is incidental and volatile. [V app/platform-admin/plans-pricing/page.tsx:164] [A] |
| All writes request then approve | Refuted | Promotions insert/update directly; matrix publish is a separate action. [V app/api/platform-admin/product-catalog/campaigns/route.ts:40] [V app/api/platform-admin/product-catalog/campaigns/route.ts:112] [V app/api/platform-admin/product-catalog/feature-matrix/publish/route.ts:62] |
| Cannot edit price / add plan | Confirmed with wording limit | Cannot edit Stripe amount or define a plan here; can replace the Stripe price ID. [V app/api/platform-admin/product-catalog/change-requests/route.ts:293] [A] |
| S7 catalogue-four scope depends on ask 1 | Resolved | Q1 A ruled: growth only, catalogue four stay as built except placement/name; Promotions name ruled too. [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md:313] [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md:321] |

### A6 · Drawings brief §5: every verify-first row checked

| Original row | Verdict and evidence |
|---|---|
| No products/prices created | Qualified confirmation for subscription catalogue; Connect inline objects make the literal app-wide claim too broad. [V lib/stripe-connect.ts:153] [A] |
| Old subscribers orphaned by replacement | Confirmed loss of ordinary price recognition; branch ignores unmatched subscription update, returns 200, no immediate downgrade. Other event handlers still run independently. [V app/api/billing/webhook/route.ts:306] [V app/api/billing/webhook/route.ts:543] [V app/api/billing/webhook/route.ts:923] |
| Sandbox/live can drift; compare actual rows | Structural possibility confirmed; actual comparison **could not tell** under no-DB instruction. Independent rows and matching-key-only validation do not establish parity. `Configured` is not a live verification result. [V lib/stripe-prices.ts:62] [V lib/stripe-price-validation.ts:114] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:1290] [A] |
| Monthly/annual separate; may one be missing? | Confirmed: requested cycle can independently resolve null; UI shows missing slot. No both-cycles requirement in those paths. [V lib/stripe-prices.ts:22] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:1275] [A] |
| Add-ons and portal own prices / same workflow? | Same slot-request family includes portal and retired add-ons. Add-on display reads its catalogue; canonical validator amount is null for unknown plan keys. Portal second subscription belongs to club's own customer where club-funded. This does not establish every legacy add-on is saleable. [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:198] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:1076] [V lib/stripe-price-validation.ts:73] [V lib/console-money-store.ts:45] [A] |
| Help/Facts/config agree; drift checklist | Current main amounts/names/bands agree on read; availability default discrepancy and stale state/copy/pointer findings listed in A4. Live gate unresolved. Help literal matches now but is a future drift risk. [V docs/agents/strategy/PLAN_PRICING_FACTS.md:28] [V lib/plan-config.ts:38] [V lib/help-content/platform-admin.tsx:1185] [A] |
| Trial change reaches new checkouts only | Existing Stripe trials untouched by config application; checkout-only assertion too narrow because operator local trial exists. [V app/api/platform-admin/product-catalog/change-requests/route.ts:575] [V app/api/billing/create-checkout/route.ts:343] [V lib/operator-plan-change.ts:203] |
| Promotions unread | Literally false: catalogue reads it. No checkout reader found in scoped search. [V app/platform-admin/plans-pricing/page.tsx:183] [A] |

## Part B · Staff jobs, walked end to end

Jobs 1–25 follow the assignment; 26–32 address gaps found while tracing them. [A]
Every proposed path and future log below is a recommendation [A], not existing behaviour or an owner-approved permission. [A]
For brevity, **L** means a proposed durable command record: actor ID/role, reason, UTC time, account/mode, target IDs, before/after, preview/audience version, external request/object IDs and outcome; individual steps and notices retain their own times. [A]

### 1 · New-customer-only plan price

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin; Product prepares. [A] | Change future sales. [A] | Code/Facts change plus Stripe dashboard price creation; console slot request → Approval queue → Approve. Slot replacement is real. [V app/api/platform-admin/product-catalog/change-requests/route.ts:293] [A] | Old ID recognition disappears; existing billing card reads new catalogue amount. [V lib/stripe-prices.ts:50] [V components/billing/BillingBody.tsx:108] | 1. Choose plan/cycle/mode. 2. Create/verify new price. 3. Preview new-sales audience and copy. 4. Preserve old mapping. 5. Publish under chosen price-source model. [A] | New purchase quote; existing subscriber's actual price retained. [A] | L; old/new IDs, zero existing-subscription writes. [A] | Completed purchases stay historical facts. [A] | Restore default for future purchases; keep both identities, honour opened quote policy. [A] |

### 2 · Existing customers, dated change with notice

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin; Billing previews. [A] | Owner rules a migration. [A] | Cannot run a bulk price campaign here; request date is metadata. [V app/api/platform-admin/product-catalog/change-requests/route.ts:633] [A] | Plan counts are not affected Stripe subscriptions; no campaign coordination found. [V app/platform-admin/plans-pricing/page.tsx:166] [A] | 1. Select old price/cohort and policy. 2. Review per-customer dates/totals/exclusions. 3. Send versioned notices. 4. Arm verified future schedules beyond the waiting period. 5. Monitor/Stop. [A] | Personal old/new amount, cycle, first affected bill, action/help link. [A] | L, immutable audience, notice delivery and per-subscription schedule/result. [A] | Sent notice; invoices/payments already made. [A] | Stop unapplied members; correct notice and compensate applied mistakes separately. [A] |

### 3 · Rename display text

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Product prepares; Super admin publishes. [A] | Clearer product wording. [A] | Plan label lives in code/Facts; slot `product_name` is metadata, not a Stripe rename control. [V lib/plan-config.ts:7] [V lib/stripe-prices.ts:11] | App and Stripe product text can diverge. [A] | 1. Choose identity, not plan key. 2. Preview all wording. 3. Confirm unchanged commercial terms. 4. Publish app text and optional Stripe product rename. [A] | New display name with same price/access. Past documents retain issue-time wording. [A] | L, before/after labels, copy version and product ID. [A] | Documents/emails already issued cannot be recalled. [A] | Revert display alias; never rename identifiers or reclassify old invoices. [A] |

### 4 · Add, lengthen, shorten or remove future trial

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Product/Super admin today; proposed Billing operational action after owner ruling. [V lib/platform-areas.ts:109] [A] | Trial offer policy changes. [A] | Plans & pricing → limits/trials → request → Approve; zero removes, null restores code default. [V lib/plan-config-db.ts:53] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:592] | Public code-default trial can differ; new portal trial could bypass org history policy. [V components/PricingSection.tsx:142] [V app/api/billing/create-team-checkout/route.ts:324] [A] | 1. Choose future eligible purchases. 2. Set zero/positive/default. 3. Preview public and checkout terms. 4. Confirm reason. [A] | Identical eligibility, days and first-charge explanation on offer/checkout. [A] | L, previous override and eligibility rule version. [A] | Trials already promised are not removed by changing defaults. [A] | Restore default for future purchases; handle existing subscription separately. [A] |

### 5 · One customer needs longer trial or free time

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Club: Billing/Super admin; portal also Support within caps. [V lib/platform-areas.ts:101] [V lib/platform-areas.ts:118] | Courtesy access or trial extension. [A] | Eligible access: record → Give free time → end date/reason. Paying portal blocked; club paying/trialing status constrains grant. [V lib/free-time-writes.ts:81] [V lib/portal-free-time.ts:386] | Grant is not a Stripe trial extension; charging may continue. [A] | 1. Identify access grant versus Stripe trial. 2. Reuse existing free-time door if eligible. 3. Otherwise Billing previews actual subscription trial end. 4. Confirm scoped date/reason. [A] | Existing free-through language, or revised first charge for an explicitly edited Stripe trial. [A] | Existing grant record; L for new Stripe editor. [V lib/free-time-writes.ts:121] [A] | Premium work/copy semantics remain Stage 4b; charges made are history. [V lib/portal-free-time.ts:17] [A] | Existing Change end/End now; subscription edits reread current state. Never replace grant architecture. [A] |

### 6 · Promotion or coupon

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Product records today; Super admin/Billing proposed financial activation. Growth drafts communication only. [V lib/platform-areas.ts:109] [A] | Campaign discount wanted. [A] | Plans & pricing → Promotions → record title/code/trial/date; direct save. [V app/api/platform-admin/product-catalog/campaigns/route.ts:74] | A recorded code does not apply a checkout discount. [A] | 1. Show Record only now. 2. If owner wants real offer, define product/audience/duration/caps/stacking. 3. Preview Stripe discount. 4. Activate with reason. [A] | No advertised discount until implemented; later exact eligible offer. [A] | Current actor/values; future L, coupon/code IDs, redemptions. [V app/api/platform-admin/product-catalog/campaigns/route.ts:100] [A] | Redemptions and sent promises persist. [A] | Disable future redemption; repair existing invoices/discounts individually. [A] |

### 7 · Add add-on or change add-on price

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Product/Super admin; Billing reviews money. [A] | Sell an extra capability. [A] | Catalogue displays records and retired slots; a general saleable add-on builder is not established. [V app/platform-admin/plans-pricing/page.tsx:174] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:198] [A] | Editable ID is mistaken for implemented entitlement/billing; nonplan amount validation lacks canonical expected value. [V lib/stripe-price-validation.ts:73] [A] | 1. Engineering checklist for new capability. 2. Identify active/retired and payer. 3. Verify separate price/cycle. 4. Reuse versioned change for active subscriptions only. [A] | Separate named line only for actual purchase. [A] | L, entitlement and subscription-item identity. [A] | Charged add-on history. [A] | Keep retired items unsaleable; never reuse retired keys or touch club-included portal access. [A] |

### 8 · Retire a plan

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin; Product prepares. [A] | Close acquisition. [A] | Gate can be set closed via request; no full retirement journey found. [V lib/plan-gating-server.ts:45] [A] | Closing checkout does not settle subscriber migration or compatibility. [A] | 1. Preview existing subscriptions/quotes. 2. Close new sales. 3. Keep plan and old-price recognition. 4. Offer owner-ruled migration separately. [A] | Current paid service and explicit future options. [A] | L, closure reason and exception cohort. [A] | Notice/actual cancellation or charges already executed. [A] | Reopen acquisition; never delete identity while subscribers/history depend on it. [A] |

### 9 · Add new plan through code and checklist

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Product specifies; engineer implements; Super admin opens sale. [A] | New package approved. [A] | Code change required; a partial card/exclusion guard exists. [V lib/plan-config.test.ts:32] | New key may miss runtime lists, prices, billing profile or content. [A] | 1. Owner rules package with /strategy. 2. Engineer completes E6 checklist. 3. Build checks manifest consistency. 4. Verify both environments later. 5. Open gate deliberately. [A] | Complete offer and supported lifecycle. [A] | Reviewed package decision, code revision, check evidence, L for gate. [A] | Purchases and promises after launch. [A] | Keep gate closed on incomplete readiness; roll forward compatible history. No builder. [A] |

### 10 · Monthly and annual prices

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin/Product today. [V lib/platform-areas.ts:109] | Configure or change one/both cycles. [A] | Separate slots and independent null result. [V lib/stripe-prices.ts:22] | One cycle missing; annual copy assumes savings ratio. [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:1275] [V lib/plan-config.ts:545] | 1. Choose each offered cycle. 2. Verify product/currency/interval count. 3. Show separate cohorts/dates. 4. Publish only verified offered choices. [A] | Actual annual total and monthly amount; no unsupported cycle. [A] | L per cycle, offered-cycle manifest. [A] | Completed annual purchase. [A] | Restore selection availability; treat cycle switch/proration as another preview. [A] |

### 11 · What will I be charged on the first, and why?

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Support/Super admin. [V lib/platform-areas.ts:114] | Customer asks. [A] | Record → Money → next charge and comparison. [V lib/console-money-stripe.ts:147] | First live subscription may be portal; preview failure appears None. [V lib/console-money-stripe.ts:158] [V lib/console-money.ts:390] | 1. Open billing story. 2. Select exact subscription. 3. Read current preview and pending fees/credits. 4. Explain estimate/date and freshness. [A] | Same actual next-charge basis; distinguish estimate from issued bill. [A] | Read/access trail; refreshed-at and source, no fictional change reason. [A] | No financial write in this job. [A] | Unavailable state instead of zero; reread and escalate mismatch. [A] |

### 12 · Failed card

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Support/Billing/Super admin. [V lib/platform-areas.ts:114] | Past due queue. [A] | Today → Past due → record/Money; webhook alerts owners. [V lib/platform-waiting.ts:68] [V app/api/billing/webhook/route.ts:848] | No unified retry history or reliable exact next attempt in current story. [A] | 1. Open failure. 2. Read invoice/attempt/retry facts. 3. Direct owner to secure payment method. 4. Monitor recovery. [A] | Access continues in grace; update-payment path. [V lib/plan-billing-words.ts:60] | Provider event/attempt, staff contact; L only for an authorised new write. [A] | Failed attempt/contact already happened. [A] | Do not mark active as a substitute for collecting money; no new win-back promise. [A] |

### 13 · Refund or credit

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin; Support reads. [V lib/platform-areas.ts:115] | Overcharge or correction. [A] | Money → charge → existing refund; durable command/recovery. General credit-note action absent from reviewed staff UI. [V lib/console-money-stripe.ts:352] [A] | Refund and invoice credit are different outcomes; fee-specific credit code is not general tooling. [V lib/platform-stripe-fees.ts:331] [A] | 1. Choose charge refund or invoice correction. 2. Keep built refund route. 3. Preview credit disposition if needed. 4. Confirm reason. [A] | Money returned versus reduced debt/future balance, stated explicitly. [A] | Existing refund record; L and invoice/credit-note links for new credit. [A] | Issued refund cannot be taken back as an undo operation. [A] | Remaining-amount guard and unknown recovery; offset future credit only by separate reviewed correction. [A] |

### 14 · Mid-period upgrade or downgrade

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Customer owner acts; Billing/Support explain. [A] | Needs larger/smaller paid package. [A] | Plan & billing → Move → preview/confirm; up immediate, down at renewal, Keep stops pending down. [V lib/plan-move.ts:190] [V lib/plan-move.ts:289] [V lib/plan-move.ts:330] [V components/billing/BillingBody.tsx:232] | Existing schedule can be released/overwritten; error text can say nothing changed after external success. [V lib/plan-move.ts:280] [V lib/plan-move.ts:313] [V lib/plan-move.ts:354] | 1. Reuse current customer flow. 2. Detect campaign conflict. 3. Preview combined future bill. 4. Confirm once and track external/local outcome separately. [A] | Immediate charge preview or dated renewal move. [A] | L/correlation to existing growth event and schedule. [A] | Charged proration is historical. [A] | Refuse incompatible pending change; separate refund/compensating move for completed action. [A] |

### 15 · Find everyone on a price or plan

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin; Product aggregate view. [A] | Support or migration census. [A] | Plans & pricing gives stored plan/status totals. [V app/platform-admin/plans-pricing/page.tsx:107] | Cannot infer old-price cohort or paid counts from those totals. [A] | 1. Filter plan or exact price/version/mode. 2. Inspect paginated subscriptions. 3. Separate paying/trial/past-due/free-time/Founding. 4. Save audience snapshot for action. [A] | No direct change. [A] | Read/export trail and snapshot ID, freshness/cutoff. [A] | Exported private data cannot be recalled. [A] | Scope by subscription and tenant; reconcile totals before action. [A] |

### 16 · Renewals this month and trials ending

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Support/Super admin; Product aggregate results. [A] | Daily operations. [A] | Today already has fourteen-day trial/free-time queues. [V lib/platform-waiting.ts:65] [V lib/platform-waiting.ts:72] | No verified complete renewal-value report; local dates may drift. [A] | 1. Open Renewals/trials. 2. Choose range/zone. 3. Separate paid renewals, trial ends and free-time ends. 4. Follow customer billing story. [A] | Existing reminders; any new outreach separately authorised. [A] | Read cutoff and definition; contacts linked to customer. [A] | No money write inherent. [A] | Mark missing/stale values; converted definition must match S7 paid facts. [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md:315] [A] |

### 17 · Stripe and our record disagree

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin; Support identifies. [A] | Dashboard edit or missed event. [A] | Record → Money comparison; extra unexplained subscription points to Stripe. [V lib/console-money.ts:329] [V lib/console-money.ts:359] | Configuration audit is not account reconciliation; local cancel may precede failed Stripe cancel. [V scripts/audit-stripe-billing.mjs:197] [V app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts:271] [A] | 1. Open difference. 2. Reread exact subscription. 3. Explain authoritative external fact versus access grant. 4. Preview repair. 5. Confirm reason and reconcile. [A] | Corrected bill/status, no unexplained access loss. [A] | L, observed facts, repair choice and event lineage. [A] | Money already charged cannot disappear from history. [A] | Never blind overwrite; unresolved identity blocks writes; owner chooses drift-run cadence. [A] |

### 18 · Test dated change without waiting

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin/engineering in sandbox. [A] | Prove schedule, trial, cancellation. [A] | No test-clock console path found in reviewed source. [A] | Real-date waiting misses boundary and recovery cases. [A] | 1. Create sandbox fixture/clock. 2. Rehearse candidate change. 3. Advance before/through boundary. 4. Check webhook, notice and local time separately. [A] | Test recipient only, never real customer. [A] | Fixture/run ID, clock states, assertions and local simulated time. [A] | Advancing test timeline is not a rewind. [A] | New fixture for reversal; deny live mode at server; cleanup isolated data. [A] |

### 19 · Branded invoice for payment or date range

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Customer owner; Billing/Super admin help; Support permission to settle. [V lib/plan-billing-data.ts:35] [A] | Expense/tax documentation. [A] | Payment method & invoices opens Stripe; fee list has limited invoice links. [V lib/plan-billing-words.ts:58] [V components/billing/StripeFeesList.tsx:19] | No general own-brand subscription document list. [A] | 1. Open Invoices. 2. Choose payment or range. 3. Inspect facts/corrections. 4. Generate view/PDF or range statement. [A] | Our branding and issue-time facts; range summary links originals rather than inventing a new charge. [A] | Generation/access record, source invoice/payment IDs, template/fact version, delivery if requested. [A] | Delivered document; historical number/issue details. [A] | Missing facts block final issue; version corrections, never silently rewrite paid history. [A] |

### 20 · Stop before a scheduled price change applies

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin; proposed Billing emergency stop. [A] | Wrong cohort/amount or policy withdrawn. [A] | No campaign Stop; customer Keep only releases an individual down-move. [V lib/plan-move.ts:390] [A] | Changing queue status cannot retract a future Stripe write. [A] | 1. Open change. 2. Stop. 3. Prevent further arming. 4. Verify every unapplied schedule removed/restored and correction notice queued. [A] | Explicit stopped/corrected terms, no new charge for stopped items. [A] | L plus stop-requested, stopping, stopped/partly-applied and per-target results. [A] | Already delivered notice or transitioned member. [A] | Reconcile boundary race; never claim all stopped until confirmed; applied members go to job 21. [A] |

### 21 · Undo after a price change applies

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin; Billing prepares correction. [A] | Wrong charge discovered. [A] | Refund exists; no campaign rollback found. [V lib/console-money-stripe.ts:352] [A] | Swapping slot back neither moves existing subscriptions nor refunds past money. [V app/api/platform-admin/product-catalog/change-requests/route.ts:293] [A] | 1. Freeze remaining targets. 2. Classify not-applied/changed/invoiced/paid. 3. Preview compensating price move and refund/credit separately. 4. Confirm correction/notice. [A] | Correct future price and explicit treatment of incorrect payment. [A] | New L linked to original; before/after balances and notice version. [A] | Original notice, invoices and external transfers. [A] | No destructive rollback; reuse old mapped price only if valid and preserve both histories. [A] |

### 22 · Wrong price ID pasted

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin/Product today. [V lib/platform-areas.ts:109] | Manual slot edit. [A] | Request → validation → approval; product/reuse/amount only warn, unmatched key skips. [V lib/stripe-price-validation.ts:99] [V lib/stripe-price-validation.ts:114] [V lib/stripe-price-validation.ts:175] | Same interval/amount is not proof of correct product; interval count not checked in inspected validator. [V lib/stripe-price-validation.ts:151] [A] | 1. Identify approved product/plan/mode. 2. Retrieve and compare full price shape. 3. Block mismatch/unverified. 4. Publish new default with old mapping preserved. [A] | No broken or wrong-plan checkout offered. [A] | L and validation facts/key mode/time. [A] | Checkout already completed on wrong ID. [A] | Reread before apply; runtime guard; repair purchased subscriptions rather than hiding ID. [A] |

### 23 · New staff member doing pricing work

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin grants existing role. [V lib/platform-areas.ts:112] | Hiring or delegation. [A] | Staff role controls powers; Product has broad catalogue, Billing reads it. [V lib/platform-areas.ts:109] [V lib/platform-areas.ts:181] | Role names do not reveal money impact of slots/gates. [A] | 1. Choose job. 2. Show role powers in plain words. 3. Preview live writes granted. 4. Grant with reason and bounded operational training. [A] | No direct billing change. [A] | Role grant before/after, actor, recipient and reason in future requirement. [A] | Staff may already have read/exported private facts. [A] | Server revocation/recheck before every write; no new role implied. [A] |

### 24 · Owner away

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Existing Billing, Support, Product staff if assigned. [A] | Continuity of service. [A] | Billing handles refunds/club billing, Support portal grants/Stripe reads; Product can approve catalogue settings. [V lib/platform-areas.ts:101] [V lib/platform-areas.ts:109] [V lib/platform-areas.ts:114] [V lib/platform-areas.ts:118] | Owner absence does not create authority; Product could still change live slot/gate. [A] | 1. Open role's work list. 2. Resolve permitted individual cases. 3. Stop suspect campaign if granted. 4. Leave new bulk activation to Super admin unless owner delegates it explicitly. [A] | Routine support continues; no surprise mass repricing. [A] | L on changes; handoff notes on blocked requests. [A] | Permitted refund/contact already made. [A] | No second approver queue; unsupported authority stays refused with named next step. [A] |

### 25 · Accountant asks paid what, when

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin; no new accountant platform role. [A] | Reconciliation request. [A] | Money reads charges and refunds with older windows. [V lib/console-money-stripe.ts:147] | Paid invoice, actual payment and refunded amount need separate facts; no certified general export established. [A] | 1. Filter customer/date/currency. 2. Select payments/refunds/credits. 3. Export source-linked facts. 4. Hand to bookkeeping work with cutoff. [A] | Same payment history as documents. [A] | Read/export actor, scope, cutoff and checksum/version. [A] | Exported data disclosure. [A] | Include pending/failed states separately; no invented revenue/tax/journal policy. [A] |

### 26 · Customer is mid-checkout when price publishes

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin. [A] | Old session completes after publish. [A] | Checkout captures specific price ID when created. [V app/api/billing/create-checkout/route.ts:352] | Removed mapping can fail later recognition; quote-expiry policy is unsettled. [V lib/stripe-prices.ts:50] [A] | 1. Snapshot quote/version at checkout. 2. Honour or expire under ruled policy. 3. Keep mapping for completed old quote. 4. Show exact confirmed bill. [A] | No amount silently changes after confirmation. [A] | L/quote/session IDs, creation and completion, policy version. [A] | Completed purchase. [A] | Never infer version from current slot; owner rules open-quote treatment. [A] |

### 27 · Free time, Founding or future choice intersects repricing

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin/Billing. [A] | Campaign finds exceptional cohort. [A] | Billing reads own plan; Founding future choice has special webhook handling. [V lib/free-time.ts:30] [V app/api/billing/webhook/route.ts:282] | Effective access plan gives wrong audience; already chosen future price is a separate commitment. [A] | 1. Split own paid plan, grant, Founding and future choice. 2. Exclude unresolved cases. 3. Ask owner /strategy how dormant lock and existing promises are treated. 4. Preview only ruled targets. [A] | Existing free-time dates/access untouched; future price explained only once ruled. [A] | L, exclusion reason and policy provenance. [A] | Promises already made. [A] | No campaign writes grants or Founding dates; unknown cases remain held. [A] |

### 28 · Pending downgrade collides with price campaign

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin. [A] | Subscription has schedule already. [A] | Current move code releases or reuses schedule. [V lib/plan-move.ts:280] [V lib/plan-move.ts:322] | New campaign could erase agreed downgrade, or customer's upgrade erase campaign. [A] | 1. Detect schedule owner/version. 2. Show both intentions. 3. Refuse conflict initially. 4. Later compose a single reviewed timeline if owner wants it. [A] | One understandable next plan/price/date. [A] | L, schedule baseline and conflict resolution. [A] | Transition already happened. [A] | Compare-and-set against fresh state; no unconditional release of foreign campaign. [A] |

### 29 · One step succeeds, connection dies

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin. [A] | Timeout, crash, duplicate click. [A] | Refund has unknown/recovery; ordinary move catch can say nothing changed after successful Stripe update. [V lib/console-money-stripe.ts:412] [V lib/console-money-stripe.ts:443] [V lib/plan-move.ts:354] | Retry could duplicate notice or overwrite changed subscription. [A] | 1. Show Checking outcome. 2. Read durable command. 3. Reconcile external IDs. 4. Resume unfinished step only. [A] | Honest pending/result state. [A] | L per step, unknown distinct from refused/done. [A] | External accepted operation. [A] | No new command on blind retry; stable key plus external read-back recovery. [A] |

### 30 · Pause collection or cancel at period end

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin proposed. [A] | Temporary hardship / no renewal. [A] | Staff cancel path is immediate; no general pause editor found. [V app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts:275] [A] | Access grant is mistaken for billing pause; cancellation may suspend locally before external success. [A] | 1. Choose pause collection or end renewal. 2. Preview invoices/access/date. 3. Confirm reason. 4. Reconcile and offer permitted resume/keep. [A] | Exact service and invoice consequences. [A] | L including invoice disposition, cancellation flag and outcome. [A] | Issued invoices, already ended subscription. [A] | Do not implement until owner rules access treatment; preserve existing cancellation/retention semantics. [A] |

### 31 · Resend receipt or deliver document again

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Billing/Super admin proposed; Support sends only if granted. [A] | Missing email. [A] | No general receipt-resend action found; invoice portal available. [V lib/plan-billing-words.ts:58] [A] | Invoice email is not proof of payment receipt. [A] | 1. Open payment/document. 2. Verify recipient ownership and document type. 3. Preview. 4. Send recorded existing document/link. [A] | Receipt for paid money, invoice for obligation, statement for range. [A] | Delivery actor/reason, recipient and template/document version. [A] | Sent disclosure cannot be recalled. [A] | Recipient confirmation, no silent customer-email mutation; unknown send state reconciled. [A] |

### 32 · Sandbox/live readiness before opening sales

| Who (role) | Trigger | Today | What goes wrong today | Proposed path | Customer sees | Logged | Cannot undo | Stop / reverse mistake |
|---|---|---|---|---|---|---|---|---|
| Super admin/Product; engineering assists. [A] | Launch or new cycle. [A] | Slot mode selection; config audit exists but was not run. [V lib/stripe-prices.ts:18] [V scripts/audit-stripe-billing.mjs:188] | Wrong-mode validation can skip; Configured does not mean verified. [V lib/stripe-price-validation.ts:114] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:1290] | 1. Compare environment manifests. 2. Verify each environment with its own key. 3. Check offered cycles/products/API/webhook. 4. Open sale only after later authorised readiness checks. [A] | Supported checkout only. [A] | Verification actor/time/environment/facts and L for gate. [A] | Real checkout after launch. [A] | Explicit test/live separation, expired checks become unknown; no environment fallback for writes. [A] |

## Part C · Simple paths by role

There are exactly six roles in the rulebook; this review proposes no new role. [V lib/platform-areas.ts:89]
Today, Product's catalogue power reaches live billing configuration while Billing's catalogue access is read-only. [V lib/platform-areas.ts:109] [V lib/platform-areas.ts:181]
Proposed permissions below require an owner ruling and changes to the same rulebook; they are not existing authorisations. [A]

### C1 · Role × job matrix

Each cell is **today → proposed**: **M** may act, **R** reads only, **N** may not access/act, **—** no complete tool today. M is always within existing refusals/caps for the built action; R means scoped permitted facts, not unrestricted financial data. Mixed jobs are split in the row label. [A] Today's sources are the power/area tables, immediate proposal application, Money route and customer move code. [V lib/platform-areas.ts:96] [V lib/platform-areas.ts:161] [V app/api/platform-admin/product-catalog/change-requests/route.ts:693] [V app/api/platform-admin/orgs/[id]/money/route.ts:23] [V lib/plan-move.ts:264]

| Job / case IDs | Super admin | Billing | Support | Product | Growth | Read only |
|---|---|---|---|---|---|---|
| Read catalogue / verified readiness summary (10,22,32) | R → R | R → R | N → R | R → R | N → R aggregate | N → R aggregate |
| Prepare commercial catalogue specification (1–4,6–10) | M → M | R → R | N → R relevant terms | M → M | N → R relevant offer | N → R |
| Activate new-price/default, name or sale-availability change (1,3,7,8,10,22,26,32) | Slot/gate M; rename — → M | R → R | N → N | Slot/gate M; rename — → N for live money publication | N → N | N → N |
| Change future trial default (4) | M → M | R → M | N → R | M → R operational setting | N → N | N → R policy |
| Arm bulk price campaign / corrective campaign (2,21,27,28) | — → M | — → R / prepare facts | N → R customer outcome | — → R aggregate | N → N | N → R aggregate |
| Emergency stop of pending price campaign (20,28,29) | — → M | — → M | N → N | — → N | N → N | N → N |
| Actual customer Stripe story / payment facts (11,12,15,16,17,25) | R → R | R → R | R → R | N → R aggregate only | N → N | N → N |
| Built charge refund (13,21) | M → M | M → M | R → R / handoff | N → N | N → N | N → N |
| General credit / real Stripe trial extension (5,13) | — → M | — → M | — → R / handoff | N → N | N → N | N → N |
| Club free time (5,27) | M → M | M → M | R → R | R → R | N → N | N → N |
| Portal free time (5,27) | M → M | M → M | M → M | R → R | R record only → R | R record only → R |
| Promotion tracking / copy preparation (6) | M → M | R → R | N → R relevant terms | M → M | N catalogue → M copy draft only | N → R |
| Coupon financial activation (6) | — → M | — → M if owner rules bounded offers | N → N | — → N | N → N | N → N |
| Staff-assisted paid move / drift repair (14,17,28,29) | Customer path only / — → M scoped repair | Customer path only / — → M scoped repair | R → R | N → N | N → N | N → N |
| Read renewal/trial cohorts / export financial facts (15,16,25) | Partial R → M export | Partial R → M export | Partial R → R; no bulk export | R local/aggregate → R aggregate | N → N | N → N |
| Generate / deliver branded document or receipt (19,31) | — → M | — → M | — → R document availability; delivery ask | N → N | N → N | N → N |
| Pause / cancel / keep renewal (30) | Immediate cancel M → M distinct choices | Immediate cancel M → M distinct choices | R → R | N → N | N → N | N → N |
| Test clocks / sandbox rehearsal (18,32) | — → M sandbox | — → R rehearsal result | N → N | — → R rehearsal result | N → N | N → N |
| Assign staff role (23,24) | M → M | N → N | N → N | N → N | N → N | N → N |
| Add actual plan definition (9) | Code work outside console → checklist visibility | R checklist | R terms | Specification/checklist | R approved copy | R checklist |

The right side is a recommendation [A]. In particular, proposing narrower Product activation rights is not a claim that its current power is unauthorised; the risk is that one broad `catalog` power bundles editing planning records with replacing live price IDs. [V lib/platform-areas.ts:47] [V lib/platform-areas.ts:109] [A] Billing's inability to change a future trial default is the converse gap; Support's inability to read the catalogue slows explaining terms, even though it can read Stripe facts on a customer. [V lib/platform-areas.ts:114] [V lib/platform-areas.ts:181] [A]

**No second approver:** an actor with a financial action's power can draft, preview and execute that action alone. Product preparation is optional work, not a mandatory request awaiting another person's approval; Super admin can perform the whole campaign. Existing safety refusals such as own-club and grant caps remain. [V docs/agents/strategy/BUSINESS_DECISIONS.md:63] [A] No backup role or authority is invented while the owner is away. Whether Billing may initiate a bulk campaign, rather than only prepare/stop one, is an owner question; this pass recommends Super admin only initially. [A]

### C2 · Three to six shortest useful paths for each role

All future screen names here describe destinations, not new route commitments or visual designs. [A]

| Role | Frequent job → shortest justified path |
|---|---|
| Super admin | 1. New sales price → Plans & pricing → plan/cycle → Change → verify/preview → publish. 2. Existing customers → Changes → exact cohort → notice/preview → arm. 3. Trouble → Changes → Stop → per-target result. 4. Refund → customer → Money → charge → built refund. 5. New plan → readiness checklist → engineering evidence → open gate. 6. Staff → job/powers preview → grant. Current limits of these paths are in A1. [A] |
| Billing | 1. Charge question → customer → Money/story → exact subscription. 2. Refund → charge → amount/reason → confirm. 3. Courtesy access → record → existing free-time door. 4. Actual trial extension → story → trial date → preview/confirm (new). 5. Invoice → story → document → generate/deliver (new). 6. Suspect campaign → Change → Stop (new). No good catalogue-write path today. [V lib/platform-areas.ts:181] [A] |
| Support | 1. Card failure → Today/Past due → customer → Money → owner payment link. 2. Coach wants Premium time → People → Coaches Portal → Give, within caps. 3. Explain price/date → customer → scoped story; unavailable preview stays unavailable. 4. Refund/credit request → charge → handoff with context. 5. Explain offer → catalogue read (new). No refund power is granted by having Stripe-read access. [V lib/platform-areas.ts:114] [V lib/platform-areas.ts:115] [V lib/platform-areas.ts:118] [A] |
| Product | 1. See packaging → Plans & pricing → live-versus-published difference. 2. Specify rename/offer → draft wording/terms. 3. New plan → checklist → engineering handoff. 4. Promotion record → Promotions → explicitly record-only save. 5. Adoption/trials → aggregate definition/cutoff. Today Product can apply live settings; proposed financial publication restriction needs owner agreement. [V lib/platform-areas.ts:109] [A] |
| Growth | 1. Read approved offer terms → published offer summary (new). 2. Draft customer-facing explanation → copy preview (new, no recipient access implied). 3. Measure promotion → aggregate redemption/conversion report if built. Current catalogue access is absent; marketing Campaigns is a different area. Growth must not send contractual price notices simply by selecting a marketing audience. [V lib/platform-areas.ts:181] [V lib/platform-areas.ts:190] [A] |
| Read only | 1. Inspect customer record's permitted local facts → record. 2. Understand sold package → published catalogue summary (new). 3. Inspect non-sensitive change outcome → change summary (new). No Stripe reads, money actions, recipient exports or confidential refund reasons should be inferred from the name Read only. [V lib/platform-areas.ts:114] [V lib/platform-areas.ts:115] [A] |

## Part D · Stripe capability map

Public Stripe documentation was reachable and read in this session; links support [S] claims below. No authenticated Stripe call was made. [A]
API possibility does not establish support in this app, the pinned SDK/API, a particular account, or a safe staff workflow. [A]
The newest trial-offer API differs from this app's legacy trial parameters; do not silently migrate versions to satisfy a design assumption. [V lib/stripe.ts:11] [S] [Trial offers](https://docs.stripe.com/billing/subscriptions/trials).

| Owner question | API: yes/no/partly; objects/calls | Already in app | New work / risk |
|---|---|---|---|
| Rename plan/product | **Yes** for Product display name: `products.update(id, {name})`. Price nickname is not a plan identity or commercial repricing. [S] [Manage products](https://docs.stripe.com/products-prices/manage-prices#edit-product). | App labels live in code; no subscription product-rename staff control found. [V lib/plan-config.ts:7] [A] | App-copy/version work plus optional server Product update. Medium risk: wrong product changes checkout text; preserve immutable plan keys and issued-document wording. [A] |
| Change an existing price amount | **No in-place amount edit.** Create a new Price and choose it for new sales / replace subscription item price for existing billing. [S] [Manage prices](https://docs.stripe.com/products-prices/manage-prices#edit-price). | Retrieves/configures IDs and updates subscription items for paid moves. [V lib/stripe-price-validation.ts:130] [V lib/plan-move.ts:289] | Historical recognition, price creation/verification and policy-aware publication; highest risk at bulk scope. [A] |
| Apply on a date | **Yes for scheduled subscription transitions**, through subscription schedules/phases. A transition date is not automatically a payment date; proration and billing anchors matter. [S] [Schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules), [subscription update](https://docs.stripe.com/api/subscriptions/update?api-version=2026-04-22.dahlia). | Create/update/release already used by down-moves. [V lib/plan-move.ts:325] [V lib/plan-move.ts:330] [V lib/plan-move.ts:395] | Bulk orchestration, notice, collision checks, cohort policy, per-target verification. Date semantics must be chosen before promising exact charges. [A] |
| Update a running trial | **Yes** using legacy `subscriptions.update` with `trial_end` timestamp or `now`; changing it can affect billing timing. [S] [Free trial periods](https://docs.stripe.com/billing/subscriptions/trials/free-trials), [subscription update](https://docs.stripe.com/api/subscriptions/update?api-version=2026-04-22.dahlia). New trial offers require newer API/flexible billing and have different extension limitations. [S] [Trial offers](https://docs.stripe.com/billing/subscriptions/trials). | Future checkout trial parameters and local operator Club trial exist; no general running-subscription trial editor found. [V app/api/billing/create-checkout/route.ts:354] [V lib/operator-plan-change.ts:203] [A] | Preview exact first bill/access effect; no silent end-now charge or conversion of access grant into billing trial. Verify pinned API in later sandbox walk. [A] |
| Pull invoice facts | **Yes**: Invoices, paginated lines, invoice payments/charges, credits and refunds. Invoice has amounts, currency, issue/status dates, customer snapshots and tax/discount totals; a paid flag alone is not a complete payment ledger. [S] [Invoice object](https://docs.stripe.com/api/invoices/object). | Money already reads invoices/payments; fee system stores its own invoice facts. [V lib/console-money-stripe.ts:109] [V lib/console-money-stripe.ts:169] [V lib/platform-stripe-fees.ts:504] | Local historical facts, backfill/corrections, access controls and own branded documents; avoid inventing a new Stripe invoice for a document download. [A] |
| Credit/refund/coupon | **Yes, different tools.** `refunds.create` returns money on an actual charge/intent; `creditNotes.create` adjusts a finalized invoice and can allocate refund/balance credit; Coupons/PromotionCodes apply discounts. [S] [Refunds](https://docs.stripe.com/api/refunds/create), [credit notes](https://docs.stripe.com/api/credit_notes/create), [coupons](https://docs.stripe.com/billing/subscriptions/coupons). | Built charge refunds; fee-specific credits; promotion records are not Stripe discounts. [V lib/console-money-stripe.ts:404] [V lib/platform-stripe-fees.ts:346] [V app/api/platform-admin/product-catalog/campaigns/route.ts:82] | General credit workflow and real offer integration only if ruled. Risks: double compensation, wrong invoice, stacking, wrong recipient/product. [A] |
| Pause | **Partly**, because collection pause and stopping access are different operations. `subscriptions.update` with `pause_collection` chooses draft/void/uncollectible treatment; existing invoices and schedules need separate consideration. [S] [Pause payment collection](https://docs.stripe.com/billing/subscriptions/pause-payment). | No general pause action found; current free time is access only. [V lib/free-time.ts:17] [A] | Owner must rule service/access/invoice behaviour; high risk of hidden debt or continued billing. [A] |
| Cancel at period end | **Yes**: update `cancel_at_period_end`; unset before the end to keep renewing. Already ended subscriptions require a different recovery path. [S] [Cancellation](https://docs.stripe.com/billing/subscriptions/cancel#cancel-at-the-end-of-the-current-billing-period). | Staff cancel currently calls immediate cancellation. Customer down-move schedule is not a generic staff cancellation tool. [V app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts:275] [V lib/plan-move.ts:330] | Distinct explicit action and access/retention timeline; never reuse immediate local suspension for an end-of-period promise. [A] |
| Resend receipt | **Partly.** Stripe documents manual Dashboard resend and Charge `receipt_email` update sending a new receipt when updated. Whether same-address replay covers every desired resend/refund type is not established here. `invoices.sendInvoice` sends an invoice; paid-invoice email omits payment reference, so it is not a universal receipt resend. [S] [Receipts](https://docs.stripe.com/receipts), [update charge](https://docs.stripe.com/api/charges/update), [send invoice](https://docs.stripe.com/api/invoices/send). | No generic resend found. Built refund relies on Stripe receipt setting per owner ruling, not our new email. [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md:240] [A] | Prefer delivering our already-generated payment document or secure link with recorded consent/recipient. Never change customer email as a side effect of a resend. Native same-address/refund receipt resend remains a sandbox verification item. [A] |

Stripe's public product guidance allows archiving without ending existing subscriptions. This review still follows the stricter task constraint of retaining old plan/price identity for every existing holder; do not let Stripe archival become deletion of our historical mapping. [S] [Archive products](https://docs.stripe.com/products-prices/manage-prices#archive-product). [A]

## Part E · Foundation options and their costs

The commercial source, historical recognition, billing-facts copy and command history solve different problems; one table cannot substitute for all four. [A]
Options below are recommendations with costs, not decisions; prices-as-data is explicitly still open. [V docs/agents/strategy/BUSINESS_DECISIONS.md:66]
No option assumes a newly authorised scheduled job, new shared automation, live key change or production migration. [A]

### E1 · Where amounts live

| Option | What it buys | Cost / limit | Recommendation |
|---|---|---|---|
| **Code + Facts remain canonical** | Preserves present pricing discipline and static deployment review. Add a durable historical Price→plan/cycle/mode registry and command history without moving authoritative list amounts. [V lib/plan-config.ts:38] [V docs/agents/strategy/PLAN_PRICING_FACTS.md:3] [A] | New default amount/display name still needs a code/Facts release. Exact unattended future acquisition publication cannot be promised merely by scheduling existing subscriptions. UI would show/verify, not edit authoritative amounts. [A] | Recommend for initial facts/invoice work. Honest first delivery costs less than pretending console-only repricing exists. [A] |
| **Dated database price book** | Proposed immutable plan-price versions, currency/cycle, effective selection, environment-specific Stripe IDs and explicit sales/publication state; enables console-managed future offers. [A] | Resolver/cache/error-state migration across amount consumers; versioned public/billing/checkout reads; backfill; admin validation; Facts/code contract must be explicitly re-ruled with /strategy. More operational write risk. [A] | Recommend only if the owner requires the complete future console publication workflow. Make code hold structural package definitions, with one selected commercial source and a generated/checked human mirror, rather than two independently editable prices. This changes the present rule and needs a ruling. [A] |

The verified 141-import census overstates amount consumers but refutes the earlier estimate of about 65. Audit field use, not just imports: amounts, names, capacities, module entitlements, trial eligibility, date helpers and type-only imports have different migration costs. No numerical effort estimate is defensible from import count alone. [A] Code-owned prices can coexist with dated subscription migrations; the earlier assertion that dates necessarily require moving all list prices into DB is not established. [A]

**Historical identity is required in either option:** append new price identities, never overwrite the only reverse mapping. A sales-default pointer may move while all previously used IDs still resolve to original plan/cycle/mode. Detect duplicate mappings, preserve quantity/item identity, and flag unknown prices for repair. This recommendation directly addresses the current resolver's current-slot-only lookup. [V lib/stripe-prices.ts:50] [A]

### E2 · Local copy of billing facts

| Option | Cost / benefit |
|---|---|
| Continue live Stripe reads | Least schema work; already implemented for Money. Availability/rate limits/freshness remain tied to Stripe, with current incomplete subscription pagination/preview-state issues. On-demand invoice generation possible as a narrower option, but historical reproducibility must still be designed. [V app/api/platform-admin/orgs/[id]/money/route.ts:12] [V lib/console-money-stripe.ts:155] [A] |
| Webhook-fed local facts, plus explicit refresh/backfill | Proposed subscription/item/price snapshots, invoice header/lines/tax/discount/customer-at-issue, actual payments and allocation, refunds/credit notes, attempts and expected renewal. Powers invoices, customer story, price cohorts, renewals, drift and accountant export. More schema, backfill, event/replay and privacy work; webhooks alone do not recover history. [A] |
| Hybrid local history + live preview | Local issued facts for reproducible history; on-demand Stripe read for exact current subscription/next invoice before financial action, labelled with freshness. Recommend this rather than describing stored renewal estimates as guaranteed bills. [A] |

Proposed controls: environment/account/object uniqueness; signed event receipt saved before projection; idempotent projections; stale/out-of-order events trigger authoritative object refresh rather than overwriting newer state; bounded retries and visible failed receipts; read permissions and source lineage; corrections append or version historical facts. Stripe warns that delivery order is not guaranteed and duplicate events can occur. [S] [Webhook handling](https://docs.stripe.com/webhooks#event-ordering). [A]

Backfill is a later explicitly authorised operation, scoped by account/mode/customer and paginated invoice lines/payments, then reconciled to totals. Never fabricate unavailable historic tax/identity details from today's customer or plan record. Projections must represent zero-amount, partial, failed, voided, uncollectible and refunded invoices, and distinguish payment date, service period and issue date. [A] General one-off invoices must not activate subscription access: the present guard permits absent subscription ID, so audit that boundary before broadening invoice handling. [V lib/stripe-billing-state.ts:43] [V app/api/billing/webhook/route.ts:802] [A]

An initial read-only refresh can be operator-invoked. **Question for owner:** is periodic reconciliation wanted, and through which separately authorised automation change? The existing audit script checks configuration, not every customer's subscription. This pass does not add a daily job or silently extend health automation. [V scripts/audit-stripe-billing.mjs:197] [V scripts/audit-stripe-billing.mjs:268] [A]

### E3 · Dated changes: timing, preview, wait, stop, recovery

**First settle the meaning of the date:** (a) earliest renewal eligible for new amount after notice; (b) a price transition on a common instant while retaining individual billing anchors; (c) common charge date/anchor with prorations. These are different commercial outcomes. Recommend (a) initially, because preserving a paid period is simpler to explain; exact common-date charges remain an owner choice. [A] Stripe supports scheduled phase transitions, but billing/proration configuration determines the invoice effect. [S] [Schedules and prorations](https://docs.stripe.com/billing/subscriptions/subscription-schedules#proration-behavior), [subscription updates](https://docs.stripe.com/api/subscriptions/update?api-version=2026-04-22.dahlia).

| Approach | Cost / practical limitation |
|---|---|
| Guided manual cohort run at due time | Lowest coordinator work, but depends on operator attendance and progress tracking. Cannot claim the owner can schedule and forget an exact date. Requires preserved mappings and notices even if prices remain in code. [A] |
| Arm Stripe schedule per eligible subscription | Recommended candidate for existing-customer effective dates. Stripe executes its phase timing; our command tracks arming, notices, conflicts and results. A batch is many independent subscriptions, so partial arming/applying/stopping is an expected state, not a transaction. [S] [Subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules). [A] |
| App executor wakes at effective date | Requires a new or changed background execution mechanism, operational retries and runtime capacity. Ask owner about automation explicitly; not assumed here. A browser tab left open is not a scheduler. [A] |

Proposed workflow, after policy decisions: [A]

1. **Draft:** immutable change/version references old and new identity, cycle, mode/account, policy, timezone and date semantics, notice rules, stop authority and reason. Select actual subscription items and snapshot audience; never use effective access plan for billing. [V lib/free-time.ts:30] [A]
2. **Preview:** show subscriptions versus unique customers, statuses, excluded/unresolved rows and reasons, old/new recurring amounts, annual and monthly totals separately, discounts, taxes where known, proration/one-off fees, and earliest/latest first affected bill. Example only: **10 example monthly subscriptions × an example CA$5 difference = example CA$50/month** before discounts/tax; this is not a real plan price or guaranteed collection. Annual amounts are not silently counted as monthly cash. Each subscriber has a before/after preview and baseline hash. [A]
3. **Notice and wait:** owner chooses lead time; no number is settled here. Send approved own-email now when scheduling if no later notice executor is authorised. A customer not successfully notified stays held. A future Stripe phase may be armed ahead of time once the required notice milestone is known, provided its transition is beyond the minimum waiting period; the subscription waits in its current phase, so this does not require an app job to wake at that date. Freeze/version content and audience; changed amount/date/policy/audience invalidates the prior preview and, where required, starts a corrected notice/wait. [A]
4. **Arm:** reread each exact subscription, customer, account/mode, item, current price, quantity, discount/tax and existing schedule against baseline. Decline incompatible schedules initially. Preserve unrelated items/attributes and payment settings. Persist command/step before Stripe; stable idempotency key; read-back and record schedule/phase result. Do not batch by customer ID alone: a club can pay for a portal as a second subscription. [V lib/console-money-store.ts:47] [A]
5. **Monitor/stop:** clear draft/notified/held/partly-armed/armed/applying/applied/stop-requested/stopping/stopped/needs-repair states. One-click Stop stops further arming and initiates reversal of unapplied phases only; it cannot honestly promise synchronous all-target success. Verify every target at the boundary; expose applied exceptions and correction work. [A]

Stripe schedule **release** leaves the underlying subscription in place; do not substitute schedule **cancel**, which is a different operation. For a schedule containing only our pending change, release may be the right stop; a shared timeline needs a carefully reviewed phase edit instead. [S] [Release schedule](https://docs.stripe.com/api/subscription_schedules/release). [A] The app's existing up-move currently releases any schedule and down-move rewrites it. A new campaign cannot safely ship until both directions detect the new schedule ownership/version and either compose or refuse the conflict. [V lib/plan-move.ts:279] [V lib/plan-move.ts:322] [A]

**Audit instead of second approval:** save actor/why and command baseline durably before any external write, then step-level accepted/refused/unknown/applied outcomes, exact Stripe IDs/request IDs, timestamps and corrective parent command. Database transaction for intent plus local change where possible; external writes require a recovery protocol rather than a fictitious DB/Stripe transaction. Financial outcome remains visible if logging/final projection fails. Refund's started-record/read-back pattern is a useful precedent, not permission to copy every implementation detail. [V lib/console-money-stripe.ts:368] [V lib/console-money-stripe.ts:422] [A]

### E4 · Test clocks

Stripe Test Clocks provide test-mode frozen time, advance operations and ready/failure events; documented simulation limits mean scenario sizes/time jumps must be checked, not assumed unlimited. [S] [Test Clock API](https://docs.stripe.com/api/test_clocks), [billing simulation limits](https://docs.stripe.com/billing/testing).

Option 1: an engineering sandbox harness with fixture/run IDs and recorded results; lowest UI cost. Option 2: Super admin sandbox rehearsal console; more lifecycle, permissions, cleanup and misuse protection. Recommend harness first and a later console only if the owner needs to run scenarios regularly. Neither was run now. [A]

Prove monthly and annual renewal, old-ID recognition, trial boundary, past-due recovery, stop just before/at/after boundary, conflicting downgrade, partial arming, duplicate/out-of-order events and delayed local writes. Test clocks move Stripe time, not automatically our date helpers, email queue or public-page clock; pair with injected local time/test recipients and await clock-ready plus webhook processing. Do not infer notice delivery from a simulated Stripe event. [A]

### E5 · Stripe key and safe browser-driven writes

Today there is one lazy server Stripe client. Stage 3's record says the full key was retained because refunds and charge writes are bundled; that history is not evidence of the current live key's grants. [V lib/stripe.ts:5] [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md:957] Restricted keys are server secrets with resource-scoped permissions; Stripe recommends restricting server privileges. [S] [API key types](https://docs.stripe.com/keys#key-types).

| Capability desired | Proposed minimum resource family; exact grant needs later verification |
|---|---|
| Billing story / readiness | Customer/subscription/item/price/product/invoice/payment/charge/refund/credit-note reads; read-only account/webhook configuration only where actually used. [A] |
| Routine writes | Refund-associated grants; subscription update/cancel; schedules create/update/release; invoice credit notes if ruled; product rename/price creation if chosen; coupon/promotion-code writes only if chosen. No new broad account deletion or Connect write authority for these jobs. [A] |
| Test clocks | Test-helper grants in sandbox only; no live endpoint or live token accepted by rehearsal service. [A] |

Option A retains shared full server key behind narrow action handlers: lowest integration change, largest compromise blast radius. Option B isolates a console billing client/key with verified restricted grants: smaller potential blast radius, added secret rotation, environment routing and compatibility work. Option C isolates financial commands in a dedicated execution boundary: strongest separation, highest operational cost. Recommend B where Stripe's actual permission granularity permits, preserving Stage 3 refund capability rather than assuming refund-only grants exist. [A]

**Compatibility trap:** mode selection currently recognises `sk_live_`, not `rk_live_`, in price lookup/validation, and audit explicitly insists on `sk_live_`. Merely swapping a restricted live key could route lookups as sandbox or break checks. Any future key split requires explicit mode/account context and coordinated validation; change no settings/check scripts in this pass. [V lib/stripe-prices.ts:18] [V lib/stripe-price-validation.ts:69] [V scripts/audit-stripe-billing.mjs:188] [A]

The browser submits an action identifier and reviewed command version, never a Stripe key or arbitrary Stripe endpoint/body. Server reauthenticates role, authorises object ownership and mode/account, checks cross-site request protection/recent authentication for live bulk writes, validates allowed parameters, rereads baseline and saves intent before executing. Show live mode persistently and bind mode to server credentials, not a browser toggle. Rate-limit writes, avoid sensitive metadata/raw provider error storage, reconcile unknown outcomes, and expose a permissioned Stop path. These are proposed controls, not assertions that current catalogue handlers implement them. [A]

### E6 · New-plan checklist and future build check

No plan builder; code implementation and owner-ruled packaging remain mandatory. [V docs/agents/strategy/BUSINESS_DECISIONS.md:64] Existing card/exclusion tests are a useful partial guard. [V lib/plan-config.test.ts:32] A full checklist/build check is requested but not implemented here; changing build/shared automation later must be explicit owner-authorised work. [A]

| Required item | What build can verify offline | What it cannot establish offline |
|---|---|---|
| Config, `OrgPlan` type, all plan-key registries | Key-set parity, required fields, valid numeric types, unique identities and explicit retired state. [A] | Commercial correctness without owner decision. [A] |
| Feature/module/rank/access semantics | All keys covered; required module/feature cases, billing uses own plan, lifecycle/limits and negative-role tests. [V lib/plan-features.ts:93] [A] | Whether a package should contain a feature. [A] |
| Gating row + fallback | Migration/manifest seed present, explicit acquisition state, missing-data failure strategy. [A] | Actual applied rows/gates in either database. [A] |
| Both-environment monthly/annual slots | Expected slot manifest for offered cycles and historic mappings; no duplicate ID assignment; readiness artefact shape/age. [A] | Price exists, matches product/amount, is active in Stripe, or migration applied. These require a later authorised environment check. [A] |
| Facts mirror and business ruling | Machine-readable compared amounts/names/bands/gates, deliberate decided-vs-built distinctions, reference to owner decision. [A] | Whether unstructured prose has no semantic contradiction. [A] |
| Pricing card / explicit exclusion | Existing partial test already forces this decision. Extend a real shared manifest rather than another copied key list. [V lib/plan-config.test.ts:22] [A] | Readability or visual quality. [A] |
| Billing profile, article, move/checkout/cancel paths | Registry coverage, nonempty help/article variants, return routes, supported cycles and trial eligibility, historic-price display. [A] | End-to-end Stripe success from static presence alone. [A] |
| Help, offer wording, signup/persona surfaces | Required article/keywords keys, no disallowed fresh amount literals in designated surfaces, helper coverage, declared exclusions. [A] | Quality and truth of every sentence. [A] |
| Demo | Declared plan/fixture valid and existing tour/anchor rules pass. Demo content follows product and does not become a release gate or manual reseed demand. [V CLAUDE.md:100] [A] | Owner acceptance of demo story. [A] |
| Tests / readiness evidence | Required lifecycle, boundary, role/refusal, retry and catalogue-source assertions registered; test-clock evidence referenced for financial behaviour. [A] | Runtime account permissions and later live configuration. [A] |

Suggested future failure message: `Plan <key> is incomplete: annual live slot not declared; billing profile missing; Facts mirror differs. Keep sales closed. See plan-readiness checklist.` It must distinguish an intentionally unoffered cycle from an accidental missing slot, and a declaration from verified live readiness. [A]

### E7 · Customer notice: sender, timing, audience, duplication

Existing marketing sender checks opt-outs, adds footer unless skipped, records queued/sent/failed outcomes and provider ID, and can pass a scheduled timestamp. Its reviewed send has no provider idempotency header; logging a queue row alone does not prove duplicate suppression after a crash. The skip-opt-out flag also removes the footer, so it is not a ready-made policy for a price notice. [V lib/email-sender.ts:119] [V lib/email-sender.ts:152] [V lib/email-sender.ts:158] [V lib/email-sender.ts:174] [V lib/email-sender.ts:187] [V lib/email-sender.ts:202] [A]

Recommend a billing-notice action inside the change record, sent by the permitted financial actor through our email transport, with /marketing-approved wording. Growth may draft words, but audience comes from the reviewed subscriptions and authorised billing contacts, not a marketing segment. Whether a delegated billing person may receive documents/notices is still an owner decision; today's customer billing contract is owner-only. [V lib/plan-billing-data.ts:35] [A]

Required notice facts: account/product and cycle; actual current and new amounts/currency; tax treatment where established; first affected bill and date/timezone; whether existing paid time, discount or trial is retained; any customer choice/deadline; how to cancel/contact us; correction identifier if replacing an earlier notice. Founding-specific promises remain held for owner policy, not inferred from today's default price. /strategy and the owner's adviser settle policy/classification, /marketing writes words. [A]

Proposed send safety: immutable per-change content version + audience snapshot; one unique notice command per subscription/change/version/contact; explicit rule for combining several subscriptions into one customer email; preview recipient names/addresses and exclusions; verify ownership again at send and financial arming. Provider request identifier and deduplication capability must be verified in later implementation. Unknown send outcomes are held for investigation, not blindly retried. Persist bounce/failure/confirmed-send evidence separately; a successful API submission is not proof of receipt or legally sufficient notice. [A]

No silent future audience expansion. A late joiner, changed owner address or changed subscription gets explicit revalidation and a new version/notice decision. Stop records whether a queued provider send can actually be cancelled; already sent notices need correction. Waiting begins at the owner/adviser-defined notice event, never at draft creation by convenience. [A]

Two operational options: send notice immediately when scheduling a future change, using Stripe to execute future billing; or schedule notice delivery later, which needs durable coordination and explicit authorisation of any new execution/automation. Recommend immediate recorded notice for the first workflow if acceptable, with per-target held states when notification fails. Never assert a new scheduled job as already authorised. [A]

## Part F · Owner questions, in dependency order

These are choices for the owner, with one recommendation each; none is answered on the owner's behalf. [A]
Commercial policy questions are explicitly for **/strategy** once ruled, so the binding decision is logged once. [V CLAUDE.md:118]
Before fixing notice or invoice/tax policy, ask the person advising the owner about Canadian consumer and tax requirements; this review asserts no law. [A]

| Order | Decision to make | Recommendation and reason |
|---|---|---|
| 1 | Scope of first delivery: platform subscriptions only, portal subscriptions too, or family payments/documents as well? | Read platform plans and portal subscriptions together, preserve their separate payer/subscription identities; deliver subscription invoices first. Keep family Connect documents separate unless explicitly included, because the merchant/money flow differs. [V lib/console-money-store.ts:47] [V lib/stripe-connect.ts:12] [A] |
| 2 · /strategy | Existing-customer policy: keep old price, renewal migration, or common-date transition/charge? What counts as the chosen effective date? | Recommend first eligible renewal after adequate notice, preserving paid time. Ask separately about exact-date charges/proration. Do not infer notice length. [A] |
| 3 · /strategy | How do Founding holders, dormant lock-in, existing discounts/trials and already-chosen future subscriptions participate? | Exclude unresolved commitments; rule each cohort explicitly before it is eligible. Keep free-time dates/access unchanged. This asks about treatment, not reopening Founding terms. [A] |
| 4 · /strategy | Notice lead time, required wording/event, recipient, failed/uncertain delivery treatment and correction policy? | Recommend individual billing notices from our app, versioned audience/content, held migration for failed/unknown notice; adviser checks classification and sufficiency. /marketing writes the approved words. [A] |
| 5 · /strategy | Keep amounts in code/Facts, or authorise dated commercial data and change the one-source contract? | Keep present source for initial read-only/invoice work; if full console-only scheduled offer publication is mandatory, choose a dated price book explicitly with one verified mirror. Historical recognition is mandatory either way. [A] |
| 6 | Which existing roles may create prices, publish defaults, change trials, activate coupons, migrate, stop, correct and deliver documents? | Recommend C1: individual money work Billing/Super admin, current capped portal help Support, Product prepares catalogue, bulk activation Super admin initially, emergency stop Billing too. Each authorised actor acts alone; no second approver. [A] |
| 7 · /strategy where commercial | Rename scope; trial eligibility/defaults versus actual subscription extensions; promotions wanted now and stacking policy? | Recommend app display rename with optional Stripe Product rename; retain separate future-trial versus customer-trial actions; keep Promotions explicitly record-only until a concrete offer/eligibility/stacking rule is approved. [A] |
| 8 | Guided Stripe creation/paste or creation inside admin? | For early read-only readiness, guided paste/verify is lower effort. For the owner's final stay-in-app price workflow, recommend narrow server-side Price creation after sandbox proof; generic product/plan builder remains excluded. [A] |
| 9 · adviser / bookkeeping, /strategy for commercial policy | Invoice/receipt/statement names, tax fields/registration treatment, customer identity, numbering, issue date, range format, corrections and history depth; owner-only or delegated access? | Recommend one source-linked document per issued invoice/payment as appropriate, plus a distinct range statement; downloadable view/PDF, immutable issue facts, owner-only initial access. Confirm required contents with adviser/bookkeeping work; do not design journals or invent taxes. [A] |
| 10 | Local facts/backfill and freshness; who runs drift checks and when? | Recommend hybrid local issued facts plus live preview/verification. Operator refresh first; ask explicitly before extending automation or adding a job, even if a daily health mechanism exists. [A] |
| 11 | Waiting/arming/Stop semantics; can one change coexist with another schedule? | Recommend visible waiting period, per-target state, one-click stop request, conflict refusal first. No promise of atomic bulk undo or automatic composition. Ask whether stop may be used by Billing during owner absence. [A] |
| 12 | Separate restricted execution key/service; sandbox test-clock harness versus console? | Recommend restricted console client if later grant tests confirm compatibility, plus engineering test-clock harness before extra UI. No keys or settings changed now. [A] |
| 13 | What must adding a plan block at build versus later environment readiness? | Recommend E6 offline manifest/parity checks, explicit card exclusions, actual Stripe verification separately. Owner authorises future shared build-check work expressly. [A] |
| 14 | Stale docs and current-risk fixes: include them before feature build, and who owns them? | Recommend targeted correction of setup instructions, displayed-price source, preview-unavailable state, audit guarantees and schedule conflicts before live campaign activation. Log scope with the later build; repair none in this document-only pass. [A] |

The settled gates remain: design now; building waits for Stripe walks 1–9 and Plan & billing Stages 3–5. No full plan builder; no second approver. [V docs/agents/strategy/BUSINESS_DECISIONS.md:62] [V docs/agents/strategy/BUSINESS_DECISIONS.md:63] [V docs/agents/strategy/BUSINESS_DECISIONS.md:64]

## Part G · Risks, threats and tests

Financial harm and irreversible communication lead this list; UI convenience does not override identity or recovery. [A]
These controls/tests describe future implementation acceptance, not checks run or existing guarantees. [A]
The built refund/free-time controls remain the baseline, with defects reported rather than silently redesigned. [V lib/console-money-stripe.ts:352] [V lib/free-time-writes.ts:110] [A]

| Harm order / threat | Proposed stopping control | What a meaningful test looks like |
|---|---|---|
| 1. Live Stripe write from wrong environment/browser or stolen role session | Server-only keys, explicit credential-bound account/mode, action allowlist, role/object checks, recent authentication for live bulk money, cross-site request protection and durable intent. No arbitrary Stripe proxy. [A] | Submit live target under sandbox command; forge browser mode, foreign customer/item and unsupported endpoint; stale/revoked session and cross-site write all denied before provider call. Verify restricted live-key prefix handling. [A] |
| 2. Wrong/duplicate customer notice or invoice disclosure | Snapshot ownership/audience/content, scoped recipients, unique command keys, provider dedup where supported, unknown-state hold, permissioned delivery. [A] | Crash after provider accepts before local result; replay twice; change owner/address mid-wait; one club funds two subscriptions; foreign invoice ID. No duplicate automatic send or foreign disclosure; unknown remains visible. [A] |
| 3. Removed historical price mapping leaves old subscribers unrecognised | Append-only historical registry independent from sales default; environment/account uniqueness; unknown-price alert and no silent success classification. [A] | Publish new-sales default, replay old-price created/updated/renewal events, verify both old and new recognise correct plan. Use same-shaped wrong product and duplicate mapping; refuse invalid configuration. [A] |
| 4. Mistaken bulk price/proration/currency change | Exact subscription-item cohort, full per-target monetary preview, immutable baseline, explicit exclusions, wait and one-click Stop. [A] | Annual/monthly mixed cohort, discounts, trial, past due, tax, quantities, multiple items, Founding choice and free-time club. Aggregate totals reconcile to target details; excluded cohort receives no action. [A] |
| 5. Scheduled downgrade erased or duplicate charging | Schedule ownership/version and conflict refusal; never open second checkout for an existing paying subscription. [A] | Campaign pending then customer moves up/down/keeps; dashboard changes schedule between preview/apply. No schedule overwritten without explicit reviewed resolution; one intended subscription persists. [A] |
| 6. Stop race / partial failure reported as success | Per-target state and read-back; stop blocks new arming; distinguish stopped, applied, unknown, needs repair; compensating correction after apply. [A] | Stop exactly at phase boundary, timeout on one of several schedules, DB failure after Stripe success. Result reports partial state; no claim of global rollback; compensation does not refund twice. [A] |
| 7. Role makes forbidden change / grants self benefit | Same rulebook checked server-side, separated powers where ruled, own-club refusals preserved; no new role implied. [A] | Every role × endpoint positive/negative table; hidden-button direct POST; own-club aliases/email/team ties; Product cannot call proposed money activation; Billing cannot assign staff. [A] |
| 8. Local copy contradicts Stripe or confuses fee invoice with subscription | Event receipts, idempotent projections, out-of-order refresh, source IDs/freshness, manual reconciliation; separate invoice purpose and subscription association. [A] | Duplicate and reversed events, missed event/backfill, zero/partial/refunded invoice, unrelated one-off and fee invoice success/failure. No unrelated access activation or status demotion. [A] |
| 9. Action has no durable who/what/when/why record | Intent record must save before external financial write; local effects transactional where possible; outcome repair independent of audit display. Ordinary best-effort helper is insufficient. [V lib/platform-audit.ts:25] [A] | Fail command insert → no provider write. Fail outcome/audit after provider success → durable pending command and repair visibility. Blank reason, oversized/private sensitive reason refused appropriately. [A] |
| 10. Wrong next charge or historical branded document | Per-subscription preview, unknown versus no charge, immutable issued facts, line/payment pagination and correction links. [A] | Preview times out; first list item is club-funded portal; more than twenty subscriptions; historic amount differs from current catalogue; refund after document generated. No false None, changed past amount or truncated certificate of completeness. [A] |
| 11. Trial/free-time mistake charges or exposes access unexpectedly | Separate access and billing actions; preserve Stage 4/4b caps/first-give semantics and own-plan rule; existing trial edit previews timing. [A] | Paying/trialing Stripe customer refused inappropriate grant; repeated portal give cannot extend cap; config trial change leaves running trial untouched; actual trial edit changes only selected subscription. [A] |
| 12. Incomplete plan or false launch readiness | E6 manifest/build parity plus separate verified environment readiness; explicit unavailable cycles and fallback semantics. [A] | Missing billing profile, Facts mismatch, absent live slot, same product with wrong interval count, unavailable validation, intentional card exclusion. Offline pass does not falsely certify Stripe/live DB. [A] |

Stripe idempotency is not permanent deduplication: API v1 keys may be pruned after at least twenty-four hours. Recovery must use durable command identity and external object read-back rather than reissuing an old write on a fresh key. [S] [Idempotent requests](https://docs.stripe.com/api/idempotent_requests). The built refund recovery already lists by charge and matches our metadata instead of posting again. [V lib/console-money-stripe.ts:443]

## Part H · Coverage and honesty

All five owner examples and all twenty-five required jobs have an explicit path or an explicit gap above. [A]
Proposals are cross-referenced below; coverage is not implementation, policy acceptance or live verification. [A]
The highest uncertainty is the exact commercial date/notice model and safe composition with existing subscription schedules. [A]

### H1 · Proposal coverage

Owner asks: **O1** rename; **O2** new price + effective date + own email + apply to affected subscribers; **O3** trial updates; **O4** invoice facts / branded invoice list; **O5** routine Stripe jobs inside admin. These labels paraphrase the recorded asks. [V docs/projects/active/STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md:31] [V docs/projects/active/STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md:40]

| Proposal | Owner asks served | Required jobs / added jobs served | What remains unserved or conditional |
|---|---|---|---|
| E1 canonical source decision + historical price registry | O1,O2 | 1,2,3,7,8,9,10,15,22; 26,27,32 | Code-source option cannot fully publish future sales prices without a release/manual action. DB option needs /strategy rule change. [A] |
| E2 hybrid billing facts, exact-subscription story | O4,O5 | 11,12,13,15,16,17,19,25; 27,29,31 | Backfill limits, freshness, taxpayer/document requirements and access are open. No bookkeeping journal design. [A] |
| E3 preview/wait/notice/schedules/Stop/compensation | O2,O5 | 1,2,7,8,10,14,15,17,20,21,22; 26,27,28,29 | Exact-date charging, grandfathering, Founding treatment and conflict composition not decided. No atomic bulk undo. [A] |
| Trial controls + existing grant doors, jobs 4–5 | O3,O5 | 4,5,16; 27,30 | Existing free time cannot extend a Stripe trial or stop payments; new editor needs scope/version proof. [A] |
| Honest promotion record or real bounded coupon workflow | O5 | 6,7; 27 | Real redemption/stacking/offer strategy not authorised; tracking-only path does not deliver discounts. [A] |
| E4 sandbox harness | O2,O3,O5 | 18; 28,29,32 | Account/API-specific limitations and local-clock integration need later sandbox proof. [A] |
| E5 key/execution boundary + C1 role rules | O5; safety for O1–O4 | 13,17,22,23,24; 20,29,30,31,32 | Live key grants not inspected; role expansion/narrowing requires owner ruling. [A] |
| E6 plan checklist/build check | O1,O2 as package safety | 7,8,9,10,22,23; 32 | New automation/build work separately authorised; static checks cannot verify live Stripe rows. [A] |
| E7 own billing notice workflow | O2,O5 | 2,3,4,6,8,11,20,21; 26,27,31 | Adviser-approved notice policy/classification and transport recovery remain open. [A] |
| Own document renderer and source-linked payment/range list | O4,O5 | 11,13,19,25; 31 | Invoice/receipt/statement naming, tax fields, range semantics, history depth and delegated access await decisions. Family documents excluded from recommendation, not ruled out by owner. [A] |
| Existing paid moves/refunds/free time retained, missing pause/cancel choices made explicit | O3,O5 | 5,11,12,13,14,17,24; 28,29,30 | No general credit/pause/resend tool today. Native same-recipient receipt resend remains partly verified. [A] |

Individual required-job check: **1→E1/E3; 2→E3/E7; 3→E1/D; 4→trial workflow; 5→built grants + explicit editor gap; 6→honest promotion/optional coupon; 7→E1/E6; 8→E1/E3; 9→E6; 10→E1/E3; 11→E2; 12→E2; 13→built refund/optional credit; 14→existing move + E3 conflict guard; 15→E2/E3; 16→E2; 17→E2/E5; 18→E4; 19→document renderer/E2; 20→E3; 21→E3 plus refund/credit; 22→E1/E5/E6; 23→C1/E5; 24→C1/E5; 25→E2 export boundary.** None silently dropped. [A]

The Stage 10 findings' twelve additional concerns are also accounted for: notice/adviser (E7/F4), mode parity (A6/job32), monthly/annual (job10), moves (job14), failed payment/win-back (job12; no new win-back offer without /strategy), add-ons/portal (job7/A3/F1), coupons (job6), dormant Founding lock (job27/F3), Facts build guard (E6), trial-end outcomes using S7 definition (job16/E2), stale guide (A4/F14), rollback/history (jobs20–21/E3). The earlier list is a proposal list, not settled scope. [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md:1112] [A]

### H2 · Where I disagree with the earlier documents

These disagreements concern source claims and unsettled reasoning, not the owner's settled rulings. The main ones were raised during the source review before drafting this document. [A]

1. **“Prices have to become data” is too categorical.** The owner record leaves the source choice open. Dated migration of existing subscriptions can retain code-owned default list prices while preserving historical mappings and command records. Fully console-managed future sale publication is the stronger requirement that favours a dated price book. [V docs/projects/active/STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md:78] [V docs/agents/strategy/BUSINESS_DECISIONS.md:66] [A]
2. **“Labels only” is wrong for all trial/pricing requests.** Generated supported proposal kinds apply real writes. Conversely, an effective date or implemented status is not proof of a scheduled or executed financial operation. [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:592] [V app/api/platform-admin/product-catalog/change-requests/route.ts:633] [V app/api/platform-admin/product-catalog/change-requests/route.ts:693]
3. **“Every write request then approve” is false.** Promotions save directly. Adding another approver is neither needed nor allowed by this program's ruling; reliable intent/why/outcome recording is the missing control. [V app/api/platform-admin/product-catalog/campaigns/route.ts:40] [V docs/agents/strategy/BUSINESS_DECISIONS.md:63] [V lib/platform-audit.ts:25] [A]
4. **“Checkout-only trials” and “the free-time door answers longer trial” are incomplete.** Operator Club local trials exist, and paying/trialing customers can be ineligible for access grants. A real Stripe trial extension is a different action. Portal checkout does not demonstrate the same subscription-history rule as org checkout. [V lib/operator-plan-change.ts:203] [V lib/free-time-writes.ts:81] [V lib/portal-free-time.ts:386] [V app/api/billing/create-team-checkout/route.ts:324]
5. **The historical paid-upgrade gap is no longer the code state.** Existing-subscription moves and prorated previews are built. Rebuilding them as a generic pricing feature would introduce a competing path; protect the existing schedule lifecycle instead. [V docs/agents/strategy/PLAN_PRICING_FACTS.md:163] [V lib/plan-move.ts:190] [V lib/plan-move.ts:289] [A]
6. **“No stored billing facts” is too broad now.** Refund commands, card stamps and fee-invoice records exist. The missing part is complete general subscription invoice/payment history; do not fork the existing fee facts into contradictory copies. [V lib/console-money-stripe.ts:369] [V lib/billing-setup.ts:263] [V lib/platform-stripe-fees.ts:438] [V app/api/platform-admin/orgs/[id]/money/route.ts:12] [A]
7. **“Nobody pays” and actual live parity cannot be carried forward as facts.** They are leads in earlier documents, not verified by this source-only pass. Policy must be designed safely even if a cohort is small or currently empty. [D docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE10_DRAWINGS_PROMPT.md] [A]
8. **The old census underestimates the dependency surface and overstates some controls.** Current import census is 141; limits override storage does not prove limit enforcement; a Configured chip does not certify a live Stripe price; wrong-product checks only warn. [A] [V lib/plan-config-db.ts:53] [V app/api/admin/members/invite/route.ts:68] [V app/platform-admin/plans-pricing/PlansPricingClient.tsx:1290] [V lib/stripe-price-validation.ts:175]
9. **An “orphaned subscriber” is not automatically downgraded.** Loss of price recognition skips ordinary subscription sync and returns 200, while other event branches may continue. That silent partial sync is precisely why it is dangerous. [V app/api/billing/webhook/route.ts:306] [V app/api/billing/webhook/route.ts:543] [V app/api/billing/webhook/route.ts:923] [A]
10. **Earlier drawing/second-approval instructions are superseded for this pass.** No Artifact, mockups or build prompt was made. Design/build dependencies and no-second-approver ruling govern; the older drawings brief is evidence to verify, not this task's output instruction. [V docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE10_CODEX_FIRST_PASS_PROMPT.md:193] [V docs/agents/strategy/BUSINESS_DECISIONS.md:62] [V docs/agents/strategy/BUSINESS_DECISIONS.md:63] [A]

### H3 · What I could not verify

- Actual dev/prod gates, environment price rows, active customer/subscription counts, historical price cohorts and deployment state: databases/account probes were prohibited. Source dates and old assertions are not substitutes. [A]
- Stripe account's live API grants, dashboard retry/email/tax settings, real products/prices and subscriptions: no authenticated calls were allowed. The Stage 3 full-key explanation is a recorded decision, not a current key inspection. [D docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md] [A]
- API-specific behaviour under the pinned version for every proposed schedule/trial/pause/credit/receipt combination: public docs were read, but no sandbox run occurred. Current trial-offer docs describe newer versions and cannot be applied wholesale to the pinned app. [V lib/stripe.ts:11] [S] [Trial offers](https://docs.stripe.com/billing/subscriptions/trials). [A]
- A general same-address native Stripe receipt resend, especially refund receipts: the Charge API documents sending when the address is updated, not every intended replay case. Invoice send is not equivalent. [S] [Update charge](https://docs.stripe.com/api/charges/update), [send invoice](https://docs.stripe.com/api/invoices/send). [A]
- Every customer-visible amount/name/gate/string and every transitive config consumer: the static import count and cited surfaces are a bounded census, not a rendered whole-product proof. No browser check was permitted. [A]
- Full historical runbook absence, all operator-local trial-expiry behaviour and every retired add-on billing path: reviewed sources establish the cited gaps, not exhaustive repository-wide absence or a current saleable legacy product. Those need targeted follow-up. [A]
- Legal notice classification/lead time, invoice/tax requirements and bookkeeping policy: these are owner/adviser decisions, not conclusions from application code. [A]
- Later prerequisites' completion/release state and future owners of each proposed tool: this pass preserves the dependency rulings but does not certify their completion. [V docs/agents/strategy/BUSINESS_DECISIONS.md:62] [A]
- Email transport deduplication/cancellation/delivery guarantees: the code inspected shows queued/sent/failed logging but does not establish provider-wide recovery semantics or legally sufficient notice. No email was sent. [V lib/email-sender.ts:158] [V lib/email-sender.ts:174] [A]

### H4 · Where I am least confident — attack these first

1. **Commercial timeline versus Stripe timeline.** Renewal eligibility, transition date, anchor/proration and the event that starts notice waiting remain unsettled. Stress-test annual customers, active trials and already-chosen Founding future prices before any screen commits to one meaning. [A]
2. **Schedule composition and stop recovery.** Existing moves release/rewrite schedules; retaining discounts/tax/extra items while stopping only our future change needs pinned-version sandbox proof, including a boundary race and partial arming. [V lib/plan-move.ts:279] [V lib/plan-move.ts:322] [A]
3. **Complete invoice/payment model and document semantics.** Multiple/partial payments, refunds versus credit notes, fee invoices, issue-time identity and corrected history need a sharper model with the owner's bookkeeping adviser. The proposed facts list is a starting inventory, not a schema design. [A]
4. **Permission granularity and dependable notice/audit delivery.** Current Product/Billing asymmetry, full/shared key, mode-prefix assumptions and best-effort audit are concrete constraints. Exact restricted grants, step recovery and transport unknown-state handling need adversarial review. [V lib/platform-areas.ts:109] [V lib/stripe-prices.ts:18] [V lib/platform-audit.ts:25] [A]
5. **Completeness of source reconciliation.** Main current amounts agree, but old narrative status and hardcoded public/help words persist. Re-run the documented drift census with exact source/field classification before changing the commercial source; do not treat an import count as a migration plan. [V lib/help-content/platform-admin.tsx:1185] [V app/pricing/page.tsx:203] [A]

## Part I · Second pass (Claude, 2026-10-30)

Tags: **[V]** opened by me this session; **[V2]** read by a delegated second reader whose cited lines matched Codex's, not
opened by me (a lead, not my own evidence). **[C]** = captured from the running dev console this session (the dev database, so
counts and prices there say nothing about production).

### I1 · What I checked

Verdict on the load-bearing claims: **no claim refuted; the direction is right.** Re-read, all CONFIRMED: reverse lookup by
current price ID only with no environment filter and no history [V lib/stripe-prices.ts:50]; an unmatched price skips the
whole sync block and the handler still answers 200 [V app/api/billing/webhook/route.ts:306] [V2 :543 :923]; the billing page
shows the config amount, not the subscribed price [V components/billing/BillingBody.tsx:108]; the power table (`catalog` =
Super admin + Product; `club_billing` and `refund` = Super admin + Billing; Billing opens Plans & pricing read-only) [V
lib/platform-areas.ts:96-121,181]; approval applies a generated price/gate/config change inline, ignores `effective_at`, and
nothing stops the requester approving [V2 app/api/platform-admin/product-catalog/change-requests/route.ts:664-739]; nothing at
checkout reads promotions or passes a coupon [V2 app/api/billing/create-checkout/route.ts; campaigns route]; an up-move
releases any schedule and a down-move rewrites any schedule with no ownership check, while Keep only releases a schedule our
code tagged [V2 lib/plan-move.ts:276-346,383]; Money lists twenty subscriptions, previews the first live one and turns a
failed preview into null shown as "None" [V2 lib/console-money-stripe.ts:155-163] [V2 lib/console-money.ts:388]; mode is the
`sk_live_` prefix only [V lib/stripe-prices.ts:19]; the plan-impact counts group by stored plan and status only [V2
app/platform-admin/plans-pricing/page.tsx:166]; the Facts doc says Premium is purchasable while the code default is
`early_access` [V2 docs/agents/strategy/PLAN_PRICING_FACTS.md:34, lib/plan-config.ts:68].

### I2 · Corrections and additions to the first pass

1. **A strict audit write already exists.** `writePlatformAuditLogStrict` throws on failure and is used for refunds; the
   audit table already carries a required `reason` on staff changes, and refund commands and free-time grants have their own
   reason columns [V2 lib/platform-audit.ts:26-53]. Part G row 9 ("ordinary helper is insufficient") is right, but the
   remedy is to reuse the strict variant and the refund command pattern, not design a new log.
2. **The empty-key mode rule differs between two helpers**: the lookup treats an empty key as sandbox, the validator returns
   no mode [V2 lib/stripe-price-validation.ts:69]. Minor, but it belongs in the `rk_live_` compatibility work (E5).
3. **Keep current plan is safer than Codex's wording implied**: it only releases schedules our code tagged; the unsafe paths
   are the up-move and down-move [V2 lib/plan-move.ts:383].
4. **The Plans & pricing screen shows no dollar amounts and no Stripe price amounts**; its pricing column reads "Live 0/2 ·
   Test 2/2" (slots filled) [C]. "Configured" (A1) is therefore the only price signal staff have, and it is not a check.
5. **The Approval queue's own banner says approving a generated price, gate or config change "applies it immediately"** and the
   dev queue holds 25 requests, 15 implemented, 10 of them price changes [C]. It is already a single-person apply step.
6. **The Money tab already compares our record with Stripe** ("Stripe and our record agree") and reads on open with a "Read
   again" door [C]. Keep that design; the gap is the single "Next charge: None" figure for a club whose record says Active [C].

### I3 · Where I disagree with Codex

1. **The Approval queue should become Changes, not stay a queue (E3 and C1 only imply it).** Request-then-approve by the same
   person is ceremony the page itself admits. Money-moving work gets one record: preview, reason, apply, history. The queue
   remains for planning records and the feature matrix. [A]
2. **The 17-row role matrix over-designs for one admin.** Recommend: no new role; per-customer money actions reuse
   `club_billing`; refunds and credits reuse `refund`; keep `catalog` as is; one new Super-admin-only power covers moving many
   customers and (owner's call) Billing may stop one. Defer the finer split until a second staff member exists. [A]
3. **"Code stays canonical" (E1) has a cost Codex under-weights: two switches.** A release changes the amount shown; the slot
   flip changes the amount charged. Between them the app can show one amount and charge another, which is the drift this
   program exists to remove. It is safe only if (a) the console refuses to publish unless the Stripe price amount equals the
   app amount for that cycle and (b) checkout for that plan and cycle closes itself while they differ (the existing price
   guard extended). With that, I still recommend code-canonical now: price changes are rare, nobody pays, and a dated price
   book touches ~111 runtime files by import count. It is the owner's call, and it means the ask "change a new-customer price
   in the app on a date" is **not** met; the existing-customer half is. [A]
4. **Build order: the many-customer migration last, its policy first.** The owner says nobody pays yet (not verified in
   production by this review). A first real price change with few subscribers can run as the same preview-and-notice flow
   without a heavy stop-and-reconcile machine; Stop stays one honest control (release the unapplied schedules). [A]
5. **Four prerequisite fixes before any workflow** (billing-page amount; append-only price recognition; "None" versus
   failed read and the twenty-subscription cap; strict log). They are small, they are defects today, and every later path
   stands on them. Codex lists them as risks (A3, A4, G); I would sequence them as Stage 0. [A]
6. **The owner page was too dense to rule from.** Rewritten above; the decisions are 14 here, 8 in the drawings (the rest
   are defaults I recommend and list). [A]

### I4 · Not verified by me

Production data and live Stripe grants (as Codex); every [V2] line above was not opened by me; whether the production Plans &
pricing screen matches the dev capture; legal notice and tax requirements; the real plan amounts (the drawings use labelled
example figures only).
