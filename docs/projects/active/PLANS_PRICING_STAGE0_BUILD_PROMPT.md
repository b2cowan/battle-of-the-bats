# Plans & pricing · Stage 0: the 12 fixes (build prompt)

> **Written 2026-11-01.** Plan of record: `STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md` ("Stage list of record", item 0). Reasons and the
> original evidence: `STAGE10_PLANS_PRICING_THIRD_PASS_GAPS.md` §3 (S5–S11) and §2 G7/G8, and
> `STAGE10_PLANS_PRICING_STAFF_REVIEW_FIRST_PASS.md` (A3, A4, I2). **Paste this into a new chat on `dev`.**
> Binding inputs, do not reopen: the owner's 2026-10-31 rulings (all 19 round-2 asks as recommended, Stage 0 is twelve fixes and
> comes first, Stage 0 no longer waits on Plan & billing Stage 5, the sequence rulings: **S5 lands first, then S8; portal
> settings live in our code**). Plan & billing Stage 4b Part 4 is committed (`c5112e55f`), so nothing upstream is open.
> **It adds migrations.** `ls supabase/migrations` right before you create one: on 2026-11-01 the highest is 415 (house league,
> dev-only, unrelated), so the first free number is 416; another session may take it the same hour.
>
> Re-verify every lead below before building on it: other sessions share this working copy. Lines marked **[V]** were opened by
> the author of this prompt on 2026-11-01; lines marked **[H]** came from a helper's search and were not opened. Stage explicit
> paths only, commit only your own hunks, check `git diff --cached --name-only` before every commit, **commit only when the
> owner says**. Read "Shared-file traps" at the bottom first.
>
> **Recommended model: Opus 5.5, three sessions.** Each ends at a point that can ship alone.
> Session 1 = Parts 1–3 (the webhook's footing and the portal: **this is what Plans end at renewal Stage 1 is waiting on**).
> Session 2 = Parts 4–7 (disputes, old prices, the paid amount, one customer per buyer).
> Session 3 = Parts 8–12 (the staff-side reads and writes, the daily comparison, closeout). Update the Progress block after each
> Part. Helpers stay on Sonnet for reading.

## ▶ Progress (read first when resuming)

- Fill this in as each Part lands: Part, date, commit (or "uncommitted"), migration number and whether it is on
  dev only, tests run, anything the Part did differently from this prompt and why.
- **Part 1 — built 2026-11-01, awaiting the owner's commit go.** The one rule lives in a new leaf module `lib/stripe-mode.ts`
  (`stripeKeyIsLive`, `stripeKeyIsTest`, `stripeEnvironment`; no imports, so the `.mjs` scripts load it directly under node 24);
  `lib/online-payments-switch.ts` re-exports the two helpers so no caller changed its import. Every prefix site in the prompt's list
  now asks it (stripe-prices, stripe-price-validation, platform-stripe-fees, dev team-checkout-readiness, both Connect webhooks, the
  club record's dashboard link, and the three scripts). **Differences:** `stripeKeyIsTest` now also accepts `rk_test_` (a restricted
  TEST key was read as "not test", which turned family payments off in test mode); empty key → `sandbox` everywhere a mode is chosen,
  while the price validator and the dev readiness route keep "no key configured" as their own diagnostic (a fact about the key, not a
  mode). `onlinePaymentsOn` stays on `sk_live_` alone, commented and pinned. Tests: `tests/unit/stripe-mode.test.ts` (helper + guard
  that no file in app/lib/components/scripts tests a prefix outside the allow-list).
- **Part 2 — built 2026-11-01, awaiting commit go. Migration 416 applied to DEV only** (MANUAL_PROD_STEPS `pending`; **prod must get it
  BEFORE the code**, or every billing event answers 500 until it does). Table `stripe_billing_events` + atomic
  `stripe_billing_event_claim` (proved by `scripts/stripe-billing-events-check.sql`, STRIPE_BILLING_EVENTS_PASSED). The pipeline is
  `receiveBillingEvent` in `lib/stripe-billing-events.ts`; **THE SEAM is `runVerifiedBillingEvent(event, customerId)` in
  `app/api/billing/webhook/route.ts`.** It stayed in the route file on purpose: twelve guard tests read that file's text. ⚠ A replay
  route (Stage 2) cannot import from a route file (Next refuses non-route exports), so Stage 2's first step is moving that function
  into a lib module and repointing those guards. **Differences:** a `claimed_at` column (the claim needs a lease to say `busy`; five
  minutes), an `ignored_reason` CHECK (`wrong_mode`, `no_customer`); the fee-invoice short-circuit is marked processed with no reason.
  Ordering rules live in `lib/stripe-billing-state.ts` (`subscriptionEventIsStale`, `statusAfterInvoicePaid`,
  `invoiceFailureIsCurrent`): the subscription arm writes from `stripe.subscriptions.retrieve` and skips a late event about a
  subscription that has since ENDED (its deletion speaks for it and has already cleared the record); a paid invoice writes the
  subscription's current paying status (a $0 trial invoice now writes `trialing`, not `active`) or nothing; a failed invoice is
  ignored once the subscription recovered or ended; the payment-failed notice is not cleared while the subscription is still past
  due. An invoice that names no subscription (a one-off made in Stripe's dashboard) keeps the old "set active" rule — not touched
  here, flagged for Stage 2. Tests: `tests/unit/stripe-billing-events.test.ts` (17).
- **Part 3 — built 2026-11-01, awaiting commit go.** Settings in `lib/stripe-portal-settings.ts` (leaf, so the audit script loads
  it), find-or-create in `lib/stripe-portal-config.ts` (metadata key `fieldlogichq_portal_version`, version `1`, cached per mode per
  process, an older version deactivated, never edited), the portal route passes `configuration` and answers "not configured" when it
  cannot be found or made. **Cancel: ON, at period end, no proration**, per the owner's sequence ruling (1) of 2026-10-31, which names
  it; that ruling supersedes the audit's old "cancel enabled = WARN". Plan switching off; pause is not a portal feature in this API
  version (off by omission, the audit still checks it). `auditPortal` now asserts OUR configuration (WARN when it does not exist yet
  in a mode; read in sandbox 2026-11-01: not created yet). ⚖ The first live portal open creates it in the live Stripe account: owner
  to confirm before the release. Tests: `tests/unit/stripe-portal-config.test.ts`; `plan-billing-admin-host.test.ts` now mocks the
  module and asserts the session names it.
- **Part 4 — built 2026-11-01, awaiting commit go.** `lib/stripe-subscription-charges.ts` (`handleSubscriptionChargeEvent`, deps
  injected; the route builds them in `subscriptionChargeDeps()`), called from THE SEAM **before** the customer-less return. Resolution:
  charge re-read (refunds expanded) → `invoicePayments.list` by its payment intent → the invoice's subscription → organization on that
  subscription, else the Coaches Portal on it (its paying club, else its workspace), else the ONE organization holding the customer
  (after a cancellation the record no longer names the subscription). No subscription invoice → `not_ours` (new `ignored_reason`,
  **folded into mig 416 itself** since it has not reached prod; re-applied to dev, DATA_DICTIONARY + MANUAL_PROD_STEPS note updated).
  Platform events `subscription_charge_disputed` / `subscription_dispute_updated` / `subscription_dispute_closed` /
  `subscription_charge_refunded` (free text, no migration), deduped on `{event.id}:{type}`. Owner email (new kind
  `subscription_charge_alert`, inbox) on opened, closed and refunded, **not** on an update; once-only key = the event id.
  **Differences:** (a) helper verified family payments are DIRECT charges on connected accounts (`lib/stripe-connect.ts`), so their disputes
  never reach this endpoint; (b) Today has no event list (queues only), so the dispute lands on the club's **Story** (money-power only,
  opened + closed), not Today — a Today queue would be a new drawn element; (c) refunds are NOT added to the Story: Stripe's refunds
  already join it from the Money tab's live read, the event is still written and emailed; (d) the alert is NOT gated to explicit
  production like the error alert (rare, and the owner tests in test mode) and a failed send is logged, not a 500. ⚖ Dispute policy
  (flag/suspend) not built: owner's call. Tests: `tests/unit/stripe-subscription-charges.test.ts` (14). Pre-existing unrelated failure
  seen: `support-console-stage3-guard` §12 on `app/platform-admin/bookkeeping/ExpenseFormWindow.tsx` (not this stage's file).
- **Part 5 — built 2026-11-01, awaiting commit go. Migration 417 applied to DEV only** (MANUAL_PROD_STEPS `pending`; **prod before the
  code**: the lookup reads the table and a missing table is a thrown lookup, i.e. every subscription event answers 500). Table
  `stripe_price_ids_retired` (append-only: service role SELECT only, the trigger the one writer), trigger `stripe_prices_record_retired_id` (AFTER UPDATE OF
  price_id OR DELETE; a non-null id replaced, cleared or deleted is recorded; first retirement wins), backfill from the audit log
  (dev: 2 rows, both `rep_team` sandbox). Writers of `stripe_prices.price_id` found: only `product-catalog/change-requests` (the
  trigger covers any future one). `getPlanFromPriceId` → `{planId, billingCycle, retired} | null`, current slots first, then retired,
  **filtered to the key's mode**, **throws** on a failed read (webhook → 500 retry; downgrade-confirm → its error path instead of
  silently assuming monthly). `priceMap()` reads both, current wins (no mode filter there, as before: an id is unique to its mode).
  The silent miss: webhook `else if (priceId)` → platform event `unrecognised_price` + owner email (kind `unrecognised_price_alert`),
  both keyed `{sub}:unrecognised_price:{UTC day}` (the event dedupes on it; the mail service's once-only key holds 24 hours).
  Tests: `tests/unit/stripe-price-retired.test.ts` (7, real module over a fake client), SQL `scripts/stripe-price-retired-check.sql`
  (STRIPE_PRICE_RETIRED_PASSED). The grants guard asked for the table's write grants; it carries the guard's
  `no-service-role-grant` exception instead (append-only on purpose).
- **Part 6 — built 2026-11-01, awaiting commit go. Migration 418 applied to DEV only** (MANUAL_PROD_STEPS `pending`; prod before the
  code). `organizations.subscription_amount_cents` / `subscription_currency` (nullable, CHECKed), from `subscriptionAmount(sub)`
  (`lib/stripe-billing-state.ts`: first item's price `unit_amount`, `currency`; non-flat price → null). Written in the club arm's update
  (so the second-subscription rule already gates it), by `recordSubscriptionAmount(sub)` after the Coaches Portal path and the
  standalone-team checkout (matched on `stripe_subscription_id = sub.id`, so a club-paid portal's record, which holds none, is never
  written), and cleared beside `subscription_period: null` in the three deletion arms. `BillingBody.tsx` prints `W.plan.paidPrice` when
  the shown plan is the org's own and the currency is `cad`; otherwise the list price exactly as before. **Difference, found on the way:**
  `getAuthContext` (`lib/api-auth.ts`) copied the org's fields by hand and **never copied `subscription_period`**, so Plan & billing
  printed every yearly plan as "/ month" at the monthly list price, and PlanMoveDialog defaulted yearly customers to monthly. Now
  copied, with the two new fields. **No backfill** (per the prompt); ⚖ owner's choice of a one-off read-only backfill if production has
  paying subscriptions (not checked: a production read was refused to this session). Tests: `tests/unit/plan-billing-paid-amount.test.ts`
  (10).
- **Part 7 — built 2026-11-01, awaiting commit go. No migration.** `lib/team-checkout-customer.ts` (`buyerStripeCustomer`, deps
  injected). Order used: (1) the customer on a Coaches Portal the person is **billing owner** of (`team_workspaces.billing_owner_user_id`;
  not `org_team_addon`, not `workspace_state = 'org_owned'`, whose customer is the club's), newest first; (2) `customers.search` on
  `metadata['ownerUserId']` (every customer this checkout creates already carries it, so nothing new needed storing); (3) create. A
  failed search is reported and falls through to create (never refuses the checkout; ⚠ Stripe search lags about a minute, so two clicks
  within it can still make two). Trial: `!keepPortal && trialDays > 0 && !(source !== 'created' && await hadSubscriptionBefore(customerId))`
  (a brand-new customer skips the Stripe call). The club guard tests were untouched (they pin create-checkout, not this route); a new
  guard pins the team checkout; the workspace-flip census (`workspace-flip-guard.test.ts`) lists the route as `tombstone-aware`.
  Tests: `tests/unit/team-checkout-customer.test.ts` (8).
- **Session 2 closed 2026-11-01.** Typecheck clean; lint clean on every file this session touched; spelling clean; dictionary coverage
  OK. Full unit run: 12,935 pass / 5 fail, all five in other work (support-console §12 on the bookkeeping ExpenseFormWindow;
  plan-billing-usage free-time route returning 503 under its mocks; three tests of a Stage 6 owner-walk HTML). Next: Session 3
  (Parts 8–12); `/accounting` runs at Part 12's closeout for the whole stage, as this prompt places it.

## What the owner sees after this build (present a version of this as the PM summary BEFORE any code)

Stage 0 is a foundation stage. **Almost nothing looks different, on purpose;** the point is that every later screen and every
price change stands on facts that are true. In plain terms:

- **A customer's Plan & billing page says what that customer actually pays,** not what the price list says today. Until a price
  ever changes the two are the same number, so nobody sees a change yet. After a price change it stops being a lie.
- **Staff opening a club's Money tab:** "Next charge: None" is only shown when there really is no next charge. If Stripe could not
  be asked, it says so. A customer with more than 20 subscriptions is no longer silently cut off.
- **A staff member who starts a many-customer money action, or switches a live price, is asked to sign in again first,** and the
  owner gets an email saying it happened ("You scheduled 9 price moves at 9:14 a.m."). With one admin and no second approver, that
  email is the alarm. Words and frames are in the round-2 drawings, tab 4 and tab 7, ask 12.
- **Staff changes are written to the change log first or not at all** (who, what, when, why), the way refunds already are.
- **The owner is emailed when a customer disputes a subscription charge or a subscription charge is refunded.** Nothing is
  suspended automatically (not ruled; see Part 4).
- **Behind the scenes, no customer sees it:** the billing webhook keeps a record of every event, ignores a replay, ignores
  an event from the wrong mode, and acts on Stripe's current answer rather than a stale event; an old price link keeps being
  recognised after a price is replaced; our own Stripe customer-portal settings replace whatever the Stripe dashboard happens to
  be set to; a daily read-only comparison tells the owner if our records and Stripe disagree; a coach cannot collect a second
  free trial by starting a fresh checkout.
- Who can do what is unchanged, except the sign-in-again step on the two actions above.

## Before any code (AGENCY_RULES, blocking)

1. **The product-manager UX summary**, in the conversation (above is the raw material).
2. **Ask the owner nothing up front.** Every default below is a recommendation to REPORT, not a question. The three that are
   genuinely his, to be surfaced when the Part that needs them is built, are marked **⚖ report**: dispute handling (Part 4),
   the sign-in-again window (Part 10), and live-mode first creation of the portal settings (Part 3).
3. **Watched automation.** Part 11 adds something that runs by itself (a daily job). `AGENCY_RULES.md` says that needs the
   owner's explicit go in the current conversation and **its own commit** whose message says what behavior changes. Build Part 11
   last, behind that go. The rest of Stage 0 touches no hook, no `WATCHED_PATHS` entry (`scripts/check-agent-automation.mjs`) and no
   database check. **Do not add the comparison to `scripts/stack-health.mjs`** (it is watched); use a route plus a schedule
   migration (mig 408 pattern).
4. **Schema = dictionary, same unit of work** for every migration: `docs/agents/db/DATA_DICTIONARY.md`, `npm run refresh:snapshots`,
   `npm run check:dictionary`, a `supabase/migrations/MANUAL_PROD_STEPS.json` entry (prod `pending`, applied before the code
   ships). Apply to **dev only**. ⚠ **The Coaches Portal and Tournament Plus are already on sale in production** (owner,
   2026-10-31), so real subscriptions can exist: every migration here must be safe to apply to a database that has live rows,
   and the prod order (migration before code) matters.
5. **Copy.** Any string a customer or staff member reads goes through the spelling gate (`npm run check:spelling`): "installment",
   the clock via `formatTime()`, no em dashes in customer-facing words. Build words as the drawings have them; where a string
   is new, put it in the words file of the surface, not inline.

## What the code does today (verified or flagged; re-read every line)

**The two corrections that matter.** Both are things the plan's one-line item text hides.

- **Fix 1 is the CUSTOMER's Plan & billing page, not a staff screen.** [V] `components/billing/BillingBody.tsx:111–112` builds
  the displayed price from `profile.config.monthlyPrice` / `annualPrice` (the price list in `lib/plan-config.ts`), never from
  the subscription. (A helper looked only at platform admin and said the claim half-held: the staff Money tab already reads the
  subscription item's `unit_amount`, [H] `lib/console-money-stripe.ts:40–56`; the dashboard's "estimated MRR at list price" is
  honestly labelled and is NOT part of this fix.)
- **Fix 3 is narrower than the plan says.** [V] A failed Money read is already distinct at the tab level ([H] `orgs/[id]/money/route.ts:36–41`
  returns `unreachable`; `MoneyTab.tsx:136` words it). What collapses to "None" is only the next-charge preview:
  `lib/console-money-stripe.ts:166–176` ends in `.catch(() => null)` and the comment says so; [H] `lib/console-money.ts:388–394`
  renders `None` / "no live subscription". The 20 cap is real [V]: `stripe.subscriptions.list({ …, limit: 20 })` at `:168`, no
  `has_more`, no paging. [H] Charges and invoices already page through `listAll` (`:143–153`).

**The webhook (S5, S9).** [V] `app/api/billing/webhook/route.ts`: signature check `:92–100`; **an event with no customer returns 200
and is dropped at `:107–109`**, before any switch; fee invoices short-circuit `:114–117`; the switch handles only
`checkout.session.completed`, `payment_method.attached/detached`, `customer.subscription.created/updated/deleted/trial_will_end`,
`invoice.payment_succeeded/failed` [H]. No `event.id` store, no `livemode` reference, no re-read of the subscription before it
writes `plan_id`/status/period from the payload (`:268–548` [H]). `invoice.payment_succeeded` [V `:795–811`] sets
`subscription_status: 'active'` and the period end unconditionally once `isTheRecordsSubscription` passes (same-subscription check,
**not** an ordering check): a late event can overwrite a newer status. Idempotency exists only in `writePlatformEvent` /
`writeGrowthEvent` ([H] `source_event_id` dedupe, `lib/platform-events.ts:82–104`).
**The pattern to copy** [V] `app/api/payments/connect-webhook/route.ts:39–46, 90–96`: mode check (`event.livemode !== liveKey` → ignore),
an event table read by id (`processed_at` set → `{duplicate:true}`), attempts bumped on a retry, the error stored and a 500 returned on
failure so Stripe retries, `processed_at` set on success. Its landing functions re-read from Stripe ([H] `lib/online-payment-landing.ts`,
"they state no order"). Table `stripe_connect_events` [H] mig 358:206. It is select-then-insert, so two simultaneous deliveries can
both pass; the billing version should claim atomically (see Part 2).

**Disputes carry no customer.** [A: from Stripe's object shapes; verify against the installed SDK types before building] A
`charge.dispute.*` event's object has a `charge`, not a `customer`, and a `refund.*` object has a `charge` / `payment_intent`. So even
if the billing endpoint were subscribed to them, today's early return at `:107–109` would drop them. `charge.refunded` does carry a
customer. [H] The Connect webhook's dispute/refund handling (`:62–86`, landing functions `applyCardDispute` `:488`, `applyRefundEvent`
`:1525`) is for connected clubs' family payments and is the model for re-reading, not for the subscription side. [H]
`scripts/audit-stripe-billing.mjs:71–79` lists the billing endpoint's expected events and omits disputes/refunds, so the production
endpoint is probably not subscribed to them.

**Live/test mode (S7).** [V] `lib/stripe-prices.ts:19` `getStripeEnvironment()` is `startsWith('sk_live_')` only. [V] A shared helper
already exists: `lib/online-payments-switch.ts:28` `stripeKeyIsLive()` accepts `/^(sk|rk)_live_/`, used by the Money routes and
the refund route [H]. Remaining `sk_live_`-only sites [H, grep and confirm]: `lib/stripe-price-validation.ts:69`,
`lib/platform-stripe-fees.ts:34`, `app/api/dev/team-checkout-readiness/route.ts:27`, `app/api/payments/connect-webhook/route.ts:40` [V],
`app/api/payments/connect-account-events/route.ts:51`, `app/platform-admin/orgs/[id]/page.tsx:39` (a dashboard link),
`lib/online-payments-switch.ts:36` (`onlinePaymentsOn`, deliberately strict, see Part 1), `scripts/backfill-card-on-file.mjs:67`,
`scripts/audit-stripe-billing.mjs:58–60, 188–189` (refuses a live audit unless `sk_live_`), `scripts/audit-revenue-readiness.mjs:27`.
[H] Two helpers disagree on an empty key (the lookup says sandbox, the validator returns no mode, I2.2 in the first pass).

**Old price links (fix 2).** [V] `lib/stripe-prices.ts:50–60` `getPlanFromPriceId` reads `stripe_prices` where `price_id = x` with
`.maybeSingle()` and **no environment filter**; a replaced id returns null, and a query error is also null. [V] The webhook then does
nothing at all: `if (matchedPlan) {` at `:307–308` has no `else` in that arm, so a renewal on an old price changes nothing in our record
and logs nothing [H: the `if` runs to ~`:546`]. [H] A slot's id is overwritten in place by `product-catalog/change-requests/route.ts:293–303`
(audit row `update_stripe_price_id` at `:312–335`, old id kept only in `platform_audit_log.old_value`); there is no price history.
[H] The Money tab's `priceMap()` (`lib/console-money-store.ts:75–81`) has the same limit, so an old id reads "A price we do not
know" (`lib/console-money.ts:297`) and the plan row is flagged "differs". [H] `getPlanFromPriceId` is also called by
`app/api/billing/downgrade/confirm/route.ts:192`. [H] `lib/stripe-price-validation.ts:100–112` only warns when one id is used by two slots.

**The portal (S8).** [V] `app/api/billing/portal/route.ts:52–56` calls `stripe.billingPortal.sessions.create({ customer, return_url })` with
**no `configuration`**, so Stripe's dashboard default applies. [H] `scripts/audit-stripe-billing.mjs:376–430` (`auditPortal`) reads the
default configuration and WARNs if subscription update, cancel or pause is enabled.
⚠ **The documents disagree on cancel; settle it from the code, report it.** The audit script warns on cancel enabled. The owner's
sequence ruling (1) says the pinned portal is "cancel at period end, no plan switching", and `PLAN_ENDS_AT_RENEWAL_PLAN.md` G13 /
line 9–11 say its check "asserts on OUR configuration" and that a portal cancel must end at period end (the app's own cancel flow
and `customer.subscription.deleted` retention arm exist: [H] webhook `:550–793`). `GST_HST_COLLECTION_PLAN.md` Stage 2 (line ~185)
needs the portal to keep **address and tax ID editable**. Read those three, then build the configuration to satisfy all three: payment
method update on, invoice history on, customer update (name, email, address, tax ID) on, **plan switching off, pause off**, cancel
at period end if the app's own cancel flow is not the only door, otherwise off. State which you chose and why.

**The billing page's neighbours.** [H] `getPlanFromPriceId`, `stripe_prices` (mig 048; columns in `lib/stripe-prices.ts:5–16`).

**Checkout (S10).** [V] `app/api/billing/create-team-checkout/route.ts:324–331` calls `stripe.customers.create` unconditionally on every
click, and `:339` sets `trial_period_days` from the plan's `trialDays` with no prior-subscription check. [H] The club checkout
(`app/api/billing/create-checkout/route.ts:371–379`) is the rule to copy: `ensureStripeCustomer(org, email)` then
`hadSubscriptionBefore(customerId)` ([H] `lib/plan-move.ts:461–467`, pages `limit:100`, true for any non-incomplete subscription that is not a
Founding next-season choice). The Coaches Portal trial is 0 today, so nothing leaks yet. ⚠ Reusing the customer is the harder half:
a coach's checkout begins before a team workspace org exists, so `ensureStripeCustomer`'s org-based shape does not fit as is.
[H] Source-text guard tests pin the club rule: `tests/unit/club-stage1-server-guard.test.ts:220, 286–290`,
`tests/unit/workspace-move-money.test.ts:561` — a change to those lines must update the guard deliberately, never delete it.

**The log (fix 4).** [V] `lib/platform-audit.ts`: `writePlatformAuditLog` is best-effort (a failed write is logged, never blocks);
`writePlatformAuditLogStrict` throws; the reason column exists (mig 380:26) and the reason rule has a guard test
(`tests/unit/platform-audit-reason-guard.test.ts`). [H] Strict writers today: the refund store (`lib/console-money-store.ts:41`),
`online-payments/player/route.ts:30`, `lib/lead-writes.ts:208, 221`. [H] The refund command pattern to copy
(`lib/console-money-stripe.ts:305–482`, table `platform_refunds` mig 380:38–102): write the "started" record first (if it fails Stripe is never
called), re-read the object from Stripe, one Stripe call with an idempotency key equal to the record id, complete the record, write the
strict audit. [H] Plan/limit/status changes (`lib/operator-plan-change.ts:265–331`), cancel (`orgs/[id]/cancel-subscription/route.ts:256–288`,
audit written **before** the Stripe cancel; a failure is a second row), bulk (`bulk-operations/route.ts:234, 303, 361`), and the
price-slot change (`change-requests/route.ts:312`) all write the best-effort log.

**Staff sign-in (fix 12).** [H] None. `lib/platform-auth.ts:59–86` `getPlatformAdminContext` calls `auth.getUser()` per request and requires
`email_confirmed_at`; the context is `{user, role, isBootstrapAdmin}` with no session age. `proxy.ts:70–74` fast-paths `/api/*` with no
auth, so each route authorizes itself. Sign-in is Supabase email and password (`lib/auth.ts:22–31`; login page
`app/platform-admin/login/page.tsx:37`). [H] The only route that acts on more than one customer's money today is
`app/api/platform-admin/bulk-operations/route.ts` (gate `requireAnyPlatformPower(['bulk_plan_status','bulk_sections'])`, `MAX_TARGETS = 100`,
reason required, one audit row per org plus a run row; no email, no fresh sign-in). The other "switching a live price" door is the
price-slot change (`product-catalog/change-requests/route.ts`, power `catalog`). [H] The owner's inbox constant is
`ADMIN_EMAIL = 'fieldlogichq@gmail.com'` (`lib/email.ts:41`, exported ~`:201`), with `sendEmail(to, subject, html, opts)` at `:102` and the ops-alert
precedent in `lib/observability/alerts.ts:156–162` (gated to explicit production, rate-limited). Emails need a kind in `lib/email-kinds.ts`.

**Tax (fix 11).** [H] `app/` and `lib/` contain no `tax_rates`, `automatic_tax`, `tax_id`, `tax_behavior` in checkout or subscription
creation. This is **not built here**: it is met by `GST_HST_COLLECTION_PLAN.md` Stage 2 ("Subscriptions charge the right tax", Stripe Tax,
ruled T5), which builds on its Stage 1 and needs the portal pinned by Part 3 below.

## Build, in this order, each committed (when the owner says) after its checks

### Session 1 — the footing and the portal (unblocks Plans end at renewal Stage 1)

#### Part 1 — one live/test decision (S7)
- Make `stripeKeyIsLive()` / `stripeKeyIsTest()` in `lib/online-payments-switch.ts` (or a lower-level module it imports, if a cycle
  appears) the only place that reads a key's prefix, and replace every other prefix test listed above (grep `sk_live_`, `sk_test_`,
  `rk_live_` across `app/ lib/ scripts/ tests/` and confirm the list). `getStripeEnvironment()` becomes `stripeKeyIsLive() ? 'live' : 'sandbox'`.
- ⚠ **`onlinePaymentsOn` (`:33–37`) stays strict on purpose** ("`LIVE_PAYMENTS_ALLOWED && startsWith('sk_live_')`"): it is a safety
  switch for family payments, `LIVE_PAYMENTS_ALLOWED` is `false`, and widening it to `rk_live_` is a different decision. Leave it, say
  so in a comment, and have a test pin it.
- Decide the empty-key rule once (the two helpers disagree; recommend "sandbox", as the lookup does) and test it.
- `scripts/audit-stripe-billing.mjs` and `scripts/audit-revenue-readiness.mjs` are scripts, not watched automation: bring them in line,
  but a restricted live key is not authorized here — do not change any key or Stripe setting.
- Tests: the helper over `sk_live_`, `rk_live_`, `sk_test_`, `rk_test_`, empty and undefined; a source guard that no file outside the
  helper tests a key prefix (allow-list the intentional `onlinePaymentsOn` line).

#### Part 2 — the billing webhook keeps a record, ignores replays, ignores the wrong mode, reads Stripe's current answer (S5)
- **Migration 416** (or the next free): table `stripe_billing_events` (`id` text primary key = Stripe's event id, `type`, `livemode`,
  `customer_id`, `subscription_id` nullable, `object_id` nullable, `received_at`, `processed_at`, `attempts`, `error`, `ignored_reason`
  nullable). **Do not store the payload** (it carries customer details and Stripe keeps it; the Stage 2 replay re-fetches by id).
  Service-role only (RLS on, no policies, grants revoked from `anon`/`authenticated`, as 358 did for `stripe_connect_events`; read how it did).
  Add an **atomic claim function** (model: `league_schedule_emails_claim` migs 409/410, or the `league_practice_emails_claim` in mig 415)
  returning `new | retry | duplicate | busy`, so two simultaneous deliveries cannot both run. A `busy` event returns 500 so Stripe retries later
  rather than running twice. Advisory locks, not row locks, inside any trigger.
- **Webhook order:** verify signature → **mode check** (`event.livemode` against `stripeKeyIsLive()`; a mismatch is recorded with
  `ignored_reason = 'wrong_mode'` and returns 200, never processed) → **claim** (a `duplicate` returns `{duplicate:true}` 200) → the existing
  customer-less early return and fee-invoice short-circuit (now AFTER the claim, so the table is a true record of what arrived and Stage 2's
  "last event per endpoint" has data; mark those rows processed) → the switch. Errors store `error` and return 500 (Stripe retries);
  success sets `processed_at`. Keep `withObservability`.
- **Ordering guard: act on Stripe's current answer, not the event's payload.** For `customer.subscription.created/updated` and
  `invoice.payment_succeeded/failed`, re-read the subscription from Stripe (`stripe.subscriptions.retrieve`) and write from that object, so a
  late event cannot overwrite a newer status or price. `invoice.payment_succeeded` must not set `active` when the re-read subscription is no
  longer in a paying state (the `stripeStillBills` / `isTheRecordsSubscription` helpers in `lib/stripe-billing-state.ts` [H] are the existing
  vocabulary). A failed re-read is an error → 500 → retry, never a guess from the payload. Keep the one-subscription-per-record rule intact
  (`tests/unit/billing-one-subscription-record.test.ts` must still pass; read it first). Do not touch the next-season-choice arm's rule
  that the plan does not move while trialing (D2).
- Stage 2's replay and Plans end at renewal Stage 1's webhook rewrite both build on this table; **leave a clear seam** (one function that
  runs a verified event) and say in the Progress block what it is called.
- Tests: duplicate (second delivery does nothing), wrong mode (nothing written, row says why), out-of-order (an old `payment_succeeded`
  after a newer cancelled subscription does not reactivate), failed re-read (500, row has the error, retry succeeds), concurrent claim
  (SQL check script in the style of `scripts/house-league-9d3-check.sql`: claim twice → second refused).

#### Part 3 — our own pinned portal settings (S8)  ⚖ report
- The app **creates and pins its own portal configuration**, per mode, and `app/api/billing/portal/route.ts` passes `configuration`. A
  dashboard toggle can then no longer change product behavior. Settings: see "The portal" above (decide and report cancel; plan switching
  and pause off; address, tax ID, payment method, invoice history on).
- Shape (recommended, change it if the code points elsewhere): the desired configuration is one constant in code with a `version` in its
  `metadata`; a small module finds our active configuration for the current mode by that metadata (`billingPortal.configurations.list`) and
  creates it when missing, caching the id for the life of the process. A version bump creates a new configuration; the old one is
  deactivated, never edited in place. If creation fails, the portal route answers the existing "not configured" style error, **never**
  falls back to the dashboard default (that fallback is the bug being fixed).
- ⚖ **Report to the owner, do not decide for him:** the first time anyone opens the portal in **live** mode, the app creates the
  configuration in his live Stripe account. That is a Stripe write on production by the app itself. Say so plainly in the hand-off and
  ask him to confirm before the release, or offer a one-time owner-run script instead (a script that runs against production is
  watched territory: if you build one, it needs his go and its own commit).
- Update `scripts/audit-stripe-billing.mjs` `auditPortal` to assert OUR configuration (found by the same metadata), so the audit and
  Plans end at renewal G13 read the same thing. Test the module with a mocked Stripe (list returns none → create; list returns ours →
  reuse; wrong version → create new, deactivate old); a guard that the portal route always passes `configuration`.
- Test mode first; nothing in live is exercised by the build.

### Session 2 — disputes, old prices, the paid amount, one customer per buyer

#### Part 4 — disputes and refunds on subscription charges (S9)  ⚖ report
- Handle `charge.dispute.created` / `updated` / `closed` and `charge.refunded` on the billing webhook. Because a dispute has no customer, resolve
  it by re-reading the charge (and its invoice/subscription → `stripe_customer_id` → organization); a dispute on a charge that is not
  ours or not a subscription charge is recorded and ignored. Place these cases so the early customer-less return cannot drop them.
- **What happens:** a platform event for the club's record (use `writePlatformEvent`; read how Today and the customer's Money tab surface
  events and put it where "Today" already looks), an email to the owner (`ADMIN_EMAIL`, new kind in `lib/email-kinds.ts`, ops-alert style), and the Money
  tab keeps showing `disputed` ([H] `lib/console-money-stripe.ts:112`). Dedupe on `source_event_id`.
- ⚖ **Report, do not decide:** whether a dispute should suspend or flag the account. **Not ruled; build nothing automatic** — record and tell.
  Say in the hand-off that this is the owner's call.
- **Owner step in the Stripe dashboard (give him the exact list):** add `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`,
  `charge.refunded` to the **billing** endpoint, test mode and then live. Update `scripts/audit-stripe-billing.mjs`'s expected-event list to match
  so the audit flags a missing subscription. The Connect endpoint is separate and unchanged.
- Tests: a dispute on a subscription charge reaches the right club and emails once; a replayed event does nothing (Part 2's table);
  a Connect-style or foreign charge is ignored; `charge.refunded` is recorded.

#### Part 5 — an old price link stays recognised (fix 2)
- **Append-only price history.** New table (e.g. `stripe_price_ids_retired`: `price_id` primary key, `plan_id`, `billing_cycle`, `environment`,
  `retired_at`, `retired_by_email`; service-role only; no update or delete grants). Fill it with a **trigger on `stripe_prices`** whenever
  `price_id` changes from a non-null value, so every path that replaces an id records it (grep for other writers of `stripe_prices.price_id`;
  [H] `change-requests/route.ts` is the only one under `app/api/platform-admin`, confirm elsewhere, including seed and scripts). Backfill from
  `platform_audit_log` rows with `action = 'update_stripe_price_id'` (`old_value`) if there are any; if the table is empty on dev, say so.
- `getPlanFromPriceId` looks at the current slots first, then the retired list; **filter by `environment`** (the current key's mode); and tell
  "no such price" apart from "the lookup failed" (a failed lookup throws or returns an error the caller handles, never `null`).
  `priceMap()` in `lib/console-money-store.ts` and the downgrade-confirm caller get the same recognition.
- **The silent miss gets a voice** without changing behavior: in the webhook, when a subscription's price is unknown even after the
  retired list, write a platform event (`unrecognised_price`, the price id, the subscription, the club) and an owner email at most once per
  subscription per day. Do not suspend, downgrade or otherwise act on it.
- Tests: a replaced id still resolves to the plan and cycle; an unknown id returns "no such price"; a lookup error is not "no such
  price"; the trigger records on replace and not on an unrelated column update.

#### Part 6 — the billing page shows what the customer actually pays (fix 1)
- **Record the amount the subscription charges** when the webhook sees it: from the recalled subscription item (`price.unit_amount`,
  `currency`, `recurring.interval`) per Part 2's re-read, onto the organization alongside the existing plan, cycle and period end
  (a new nullable column pair, migration in this Part; read how `subscription_period`/`current_period_end` are written at webhook `:403–425` [H]
  and follow it, including the portal workspace path and the "second subscription" rules).
- `BillingBody.tsx:111–112` shows the recorded amount when there is one; otherwise today's price-list amount (an org with no subscription
  yet, a comped or Founding org, or one that predates this change until its next webhook). Keep every existing branch (free, founding,
  staff free time) exactly as it is. Read how the page gets its org (`lib/plan-billing-data.ts` has no price today) and widen the
  one read, not a second fetch.
- ⚠ This is the price, not the invoice total: a discount, a quantity above one and (later) tax are not in it. Say so in a code comment;
  the page's wording is unchanged (tax wording is `/marketing` and the GST/HST plan). ⚠ An org can hold a club subscription and a
  Coaches Portal one: record the one the billing page is about, per the existing "record follows the subscription" rule
  (`lib/stripe-billing-state.ts`).
- Tests: a subscription at a price that is not the current list price displays its own amount; a customer with none recorded displays the
  list price; annual vs monthly; comped and Founding branches unchanged. **Stage 0 does not backfill existing rows** (nobody pays on
  production in volume; say so) — but give the owner the choice of a one-off read-only backfill if production has any paying subscription.

#### Part 7 — one Stripe customer per buyer, and no second trial (S10)
- `create-team-checkout/route.ts:324–331`: look for the buyer's existing Stripe customer before creating one. Order to try (report the one you
  use): the customer on an existing team-workspace or portal organization the same user owns; else a customer whose metadata carries the same
  `ownerUserId` (`customers.search`); else create. Store enough that the next click finds it.
- Apply the club's rule at `:339`: `trialDays > 0 && !(await hadSubscriptionBefore(customerId))`; Keep Premium (`keepPortal`) still
  gets no trial. Portal trial is 0 today, so this changes nothing visible; the point is that the Trials tab drawn for Stage 2 says "people
  who have had a subscription before do not get a second trial", which would be false without it.
- Update the source-text guard tests deliberately (see above) and add one that pins the team checkout to the same rule.

### Session 3 — staff-side reads and writes, the daily comparison, closeout

#### Part 8 — "None" is told apart from "could not be read", and the 20 cap goes (fix 3)
- `lib/console-money-stripe.ts:168`: page the subscription list (the way `lib/plan-move.ts:461–467` does, or `listAll` with a ceiling) and report
  `more` when the ceiling is hit, in the same style as charges and invoices.
- The next-charge preview's `.catch(() => null)` becomes a three-way answer in `MoneyRead['nextCharge']`: a charge (amount, date), **none**
  (no live subscription, or it ends at the period end: the existing notes), and **could not be read**. `lib/console-money.ts:388–394` words
  the third state in a plain sentence ("Stripe could not be asked for the next charge. Read again.") with the existing Read again door. Check
  `tests/unit/support-console-stage3-guard.test.ts` and the Money tab tests first; add the missing state to the card, not a new screen.
- Pick the live subscription across all pages, and keep the "second live subscription" sentence working.

#### Part 9 — the change log is strict where money moves (fix 4)
- Decide the list by reading, and report it: every staff action that moves money or changes what a customer is charged (plan/limit/status
  change in `lib/operator-plan-change.ts`, cancel, bulk operations, the price-slot change, portal free time, retention extend) writes the
  strict audit row **with its reason before the change**, in the refund pattern (record first; if the record cannot be written, the change
  is not made). ⚠ Cancel already writes before Stripe and adds a failure row: keep that order; only the strictness changes. ⚠ A bulk run
  writes one row per org plus a run row: the **run row** is strict and first; per-org rows keep their current failure handling or become strict —
  report which and why.
- Do not widen the reason rule's allow-list (`platform-audit-reason-guard.test.ts`); extend the guard so a listed action cannot go back to
  the best-effort writer. Do not add columns unless the refund pattern truly needs them (it does not for plain audit rows).
- Append-only: [H] no trigger or RLS stops an UPDATE/DELETE of `platform_audit_log` today. Add the guard (revoke update/delete from
  non-owner roles, or a trigger refusing them) if the table is only ever inserted to (grep first); a migration, with the usual unit of work.

#### Part 10 — sign in again before many-customer money actions, and an email to the owner (fix 12)  ⚖ report
- **Freshness.** Platform-admin context gains "signed in within N minutes" from the Supabase user's `last_sign_in_at` (it changes on password
  sign-in, not on token refresh; **verify that on the installed Supabase version before relying on it**). A new gate (e.g. `requireFreshSignIn()`
  beside `requirePlatformPower` in `lib/platform-auth.ts`) refuses with a typed error the UI can recognise. ⚖ **Working default: 10 minutes.
  Report it; he may change the number.**
- **Which actions.** The many-customer money action (`bulk-operations`: all three actions) and switching a live price (`product-catalog/change-requests`
  when it changes a live slot). Single-customer refunds and plan changes are unchanged. Later stages add their own doors to the same gate.
- **The step.** The refusal opens a small "sign in again" dialog (password only) which calls the sign-in and retries once. Words, wording of the
  email and where the dialog sits are in the round-2 drawings (`STAGE10_PLANS_PRICING_STAFF_DRAWINGS.html`, ask 12, tab 4 line ~397 / ~472 and tab 7
  line ~503; the artifact is https://claude.ai/artifact/MiNmwvyFX75jwmJoa2rdNm). **Read the frame; build to it; do not redesign it.** If the frame is
  not drawn for the bulk-operations screen, stop and report rather than inventing a screen (house rule: owner design session for every screen).
- **The email.** After the action, an email to `ADMIN_EMAIL` ("You scheduled 9 price moves at 9:14 a.m."; clock via `formatTime()`), new kind
  in `lib/email-kinds.ts`. A failed send does not undo the action: write a second audit row saying the alert could not be sent. State this choice in
  the hand-off (recommended: the log is the record, the email is the alarm).
- **Touches auth:** run `/review` on this Part and wait for the owner's go before commit.
- Tests: a stale session is refused with the typed error; a fresh one passes; a wrong password does not open it; the email is sent once per
  action; every listed route is behind the gate (a source guard, like the other platform-admin guards).

#### Part 11 — a daily read-only comparison with Stripe (S6)  ⚠ watched automation: needs the owner's explicit go, its own commit
- **Do this Part last, and only after the owner says go in the current conversation.** Parts 1–10 do not depend on it.
- A route `app/api/platform-admin/billing-drift-daily/route.ts` (auth: `x-cron-secret` or the `run_jobs` power, exactly as
  `stripe-fees-daily/route.ts:32,41` [H]) that **reads** Stripe's subscriptions (paged, one pass, matched by id; not one call per club) and our
  `organizations`/portal records, and compares status, plan (through Part 5's recognition), cycle and period end. **It reports and never repairs.**
  Results go to a small table (service-role only) and, when anything differs, one email to `ADMIN_EMAIL` (ops-alert style, rate-limited).
  Stage 2's "Watching Stripe" tab will read the table; build no screen here.
- A schedule migration in the mig 408 / mig 395 pattern (`cron.schedule(..., '15 12 * * *', … app_cron_http_tick(...))`; the wrapper is
  `public.app_cron_http_tick` from mig 183 [H]). Prod activation is a `MANUAL_PROD_STEPS.json` entry. Commit message says what behavior changes
  ("adds a daily read-only job that emails the owner when Stripe and our records disagree").
- Tests: equal → no mail; each kind of difference → named in the result; a Stripe failure → recorded as "could not compare", not as a difference.

#### Part 12 — closeout
- **Fix 11 (tax) is carried, not built:** add one line to this plan's Progress/the Stripe plan saying item 11 is met when the GST/HST plan's Stage 2
  is built, and that Parts 3 (portal) and 6 (amount is the price, not the total) were built to receive it. Change nothing about tax in code.
- **Exit check (recommended, not ruled):** the owner re-runs `STRIPE_E2E_WALK_6_WEBHOOK_HARDENING.html` (it was skipped unwalked on 2026-10-31,
  so replayed and out-of-order events were never proven). Update that walk file only where Parts 2/4 changed what it should expect, add-only.
  Write a short **Stage 0 walk** as a checkable Artifact (feedback rule: one purpose per walk): sign-in-again, the Money tab states, an old price
  still recognised, the portal opens on our settings, a replayed event ignored. Test-mode only.
- Docs: `/docs` for the customer-visible bit (Plan & billing amount) and the staff help for sign-in-again; `/accounting` review before handing off
  (this stage touches what FieldLogicHQ records about charges and what it alerts on; per CLAUDE.md it runs before hand-off, not as an extra);
  `npm run check:spelling`; DATA_DICTIONARY + `npm run refresh:snapshots` current; `MANUAL_PROD_STEPS.json` entries for every migration.
- **Offer `/review`** (substantive: auth, webhook, migrations, money) and `/simplify` (the event-claim and strict-log patterns are new
  abstractions) after Session 3, in that order, as CLAUDE.md asks. Offer `/docs`. Update `TODO.md` (one line, link to this file; **the working copy has
  another session's uncommitted `TODO.md` edit: add only your line**) and the plan's Stage 0 line to the real state, with anchors (commit hash, date),
  never "uncommitted" or "dev only" as a negative.
- Release note for the owner, one line each: migrations to apply to production **before** the code (list them), the Stripe dashboard steps he
  must do (Part 4's four events on the billing endpoint, test then live), the first-live-portal-open note (Part 3), the dispute policy question (Part 4).

## Not in this stage (stay out)

- Any price change, notice, dated move, plan rename or price-book work (Stages 3–8). Any new staff screen (Stage 2). Customer invoices (Stages 5–6).
- Any Stripe **setting** change in the dashboard, any key change, any restricted-key switch.
- Tax in code (GST/HST plan). Any change to the Connect (family payments) webhook beyond Part 1's prefix helper.
- Automatic suspension on a dispute; "Billing may stop a move"; Founding holders' treatment (all open, not ruled).
- Edits to hooks, `.claude/settings*.json`, or any `WATCHED_PATHS` file. If Part 11's job needs one, stop and ask.

## Shared-file traps

- `TODO.md` and `docs/projects/active/OWNER_QA_LEDGER.md` carry other sessions' uncommitted edits (2026-11-01): stage only your own hunks (temp-index
  method in the memory note "Partial commit out of shared files").
- `lib/email.ts` and `lib/email-kinds.ts` are touched by the house-league sessions: re-read before editing, add only your kind.
- The billing webhook and `lib/plan-move.ts` are also edited by Plans end at renewal and Plan & billing work: `git log -5 -- <file>` before you start,
  and re-read the file at the moment you edit it.
- Typecheck needs the 8 GB heap on this repo (the default 4 GB runs out). `verify:changed` may stop on other sessions' failures; report them, do not fix them.
- Dev server: new files and migrations mean a restart before the owner's browser testing (AGENTS.md); do not delete `.next` while it runs.
- Never put a backtick or `$` in a shell string while writing files; use the Write/Edit tools.
