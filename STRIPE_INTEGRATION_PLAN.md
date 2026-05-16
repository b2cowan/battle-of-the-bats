# Stripe Integration Plan
## End-to-End Billing & Subscription Infrastructure for FieldLogicHQ

---

## PM Brief

**What this is:**
A complete Stripe integration covering test environment setup, production setup, in-app checkout, subscription lifecycle management, and per-team add-on billing for Club orgs. Today the platform enforces plan tiers in code but has no payment infrastructure — no org can actually pay for a plan. This closes that gap end-to-end.

**What changes for users:**
- **New orgs on a paid plan** (Tournament Plus, League, Club) go through a Stripe Checkout flow at signup — card on file, subscription starts in trial, and the first payment is collected automatically when the trial ends
- **Existing free orgs upgrading** see an "Upgrade Plan" flow in their billing settings page that takes them to Stripe Checkout
- **All paid orgs** get a self-serve Customer Portal link to change payment method and view invoices. Downgrades and cancellations are handled by a FieldLogicHQ review flow because they can affect active org data, modules, and public pages
- **Club orgs adding a 4th+ rep team** see a billing preview modal showing the prorated charge and new recurring amount before confirming

**What doesn't change for free users:** Nothing. Tournament plan orgs never see a payment screen. Feature gates already exist and show upgrade prompts rather than blocking pages.

**Role differences:** Only the `owner` role can access billing settings or initiate plan changes. Platform admins can see retention-risk queues, extend retention windows for support cases, and assist with exports/restores.

**Success criteria:** An org owner can sign up, choose Tournament Plus, enter a card, and be on a paid plan — with subscription status reflected live in the app — without any manual steps from us.

---

## Open Decisions

These questions must be resolved before implementation begins. They affect architecture choices that are expensive to change later.

### 1. Checkout approach
**Option A — Stripe-hosted Checkout (redirect):** User leaves the app, pays on Stripe's hosted page, returns via success/cancel URL. Simpler to ship, handles all edge cases (SCA, 3DS, card updates) automatically. Less control over visual design.

**Option B — Embedded Payment Element:** Stripe's checkout UI renders inside the app in a modal or inline section. Stays in-app, more polished. Requires client-side Stripe.js, more implementation surface area.

*Recommendation: start with hosted Checkout (A). Switch to embedded later if conversion data suggests it's worth it.*

### 2. Currency
**Option A — CAD only:** Single currency, simpler Stripe setup, correct for the current user base (Canadian sports orgs). Any non-Canadian org pays in CAD.

**Option B — CAD + USD:** Requires separate Stripe prices in each currency, currency detection/selection in the checkout flow, and potentially separate Stripe products. Significantly more complexity.

*Recommendation: CAD only for V1. USD can be added as a separate price set when there is evidence of US demand.*

### 3. Stripe account structure
**Option A — Single platform account:** FieldLogicHQ collects subscription fees directly. Orgs pay us. We pay our own costs. No marketplace complexity. Correct for a pure SaaS model.

**Option B — Stripe Connect:** Orgs could eventually collect registration fees (team entry fees) through their own Stripe account, with the platform taking a cut. Requires Connect onboarding per org, significantly more architecture. Not needed for subscription billing.

*Recommendation: single platform account (A) now. Connect is a separate project if/when we add registration fee collection.*

### 4. Plan changes, downgrades, and cancellations
**Decision:** upgrades are self-serve through Stripe Checkout. Payment methods and invoices are self-serve through the Stripe Customer Portal. Downgrades and cancellations are not generic Stripe Portal actions; they run through a FieldLogicHQ review flow first.

**Downgrade:** moving to a lower active plan keeps the account running, but the owner must resolve anything above the new plan limits before the change is confirmed. For example, Tournament Plus to Tournament requires choosing the single tournament that remains active.

**Cancellation:** cancellation is a separate full-account suspension action, not a downgrade to free. At the effective cancellation date, all modules and public pages shut down and the account enters a 90-day retention/restore window.

**Retention:** over-limit or canceled-account data is soft-retained for 90 days before purge. Platform admins can extend retention for support cases and can see data approaching purge.

---

## Plan Tiers & Pricing Reference

| Plan | plan_id value | Monthly | Annual | Trial | Notes |
|------|--------------|---------|--------|-------|-------|
| Tournament | `tournament` | Free | Free | n/a | Default for all new orgs |
| Tournament Plus | `tournament_plus` | $39 CAD | $390 CAD | 14 days | |
| League | `league` | $89 CAD | $890 CAD | 30 days | |
| Club | `club` | $179 CAD | $1,790 CAD | 90 days | Early-adopter onboarding period |
| Additional Rep Team | (add-on) | $20 CAD | $200 CAD | n/a | Club only; first 3 free |

Annual pricing = ~2 months free vs. monthly.

---

## Database State

The `organizations` table already has the following Stripe columns (no migration needed for these):
- `stripe_customer_id` — Stripe customer ID
- `stripe_subscription_id` — active subscription ID
- `subscription_status` — mirrors Stripe status (`active`, `past_due`, `canceled`, etc.)
- `plan_id` — current plan tier (`tournament`, `tournament_plus`, `league`, `club`)

**Migration needed** — add the following to `organizations`:
```sql
ALTER TABLE organizations
  ADD COLUMN subscription_period text CHECK (subscription_period IN ('monthly', 'annual')),
  ADD COLUMN current_period_end  timestamptz,
  ADD COLUMN rep_team_subscription_item_id text;  -- Stripe subscription item ID for the per-team add-on
```

---

## Environment Variables

All env vars needed in `.env.local` (dev) and Amplify console (prod). Use separate values for test and prod environments.

```
# Stripe keys
STRIPE_SECRET_KEY=sk_test_...            # sk_live_... in prod
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   # pk_live_... in prod
STRIPE_WEBHOOK_SECRET=whsec_...          # separate value for test vs prod

# Plan price IDs (test)
STRIPE_PRICE_TOURNAMENT_PLUS_MONTHLY=price_...
STRIPE_PRICE_TOURNAMENT_PLUS_ANNUAL=price_...
STRIPE_PRICE_LEAGUE_MONTHLY=price_...
STRIPE_PRICE_LEAGUE_ANNUAL=price_...
STRIPE_PRICE_CLUB_MONTHLY=price_...
STRIPE_PRICE_CLUB_ANNUAL=price_...

# Rep team add-on price IDs (test)
STRIPE_REP_TEAM_PRICE_MONTHLY_ID=price_...
STRIPE_REP_TEAM_PRICE_ANNUAL_ID=price_...
```

---

## Phase A — Stripe Dashboard Setup (Manual)

All steps performed in the Stripe dashboard — no code. Do test environment first, prod later (Phase G).

### A1 — Products & Prices

Create one product per paid plan. Each product gets two prices (monthly recurring + annual recurring).

| Product name | Monthly price | Annual price | Currency |
|---|---|---|---|
| FieldLogicHQ — Tournament Plus | $39.00 | $390.00 | CAD |
| FieldLogicHQ — League | $89.00 | $890.00 | CAD |
| FieldLogicHQ — Club | $179.00 | $1,790.00 | CAD |
| Additional Rep Team (Club) | $20.00 | $200.00 | CAD |

The rep team product uses quantity-based billing. When creating prices, mark it as "Usage is metered" → No (quantity per subscription, not usage-based).

Record all price IDs and add to `.env.local`.

Trial lengths are configured in the FieldLogicHQ checkout request, not as a static Stripe price setting:
- Tournament Plus: 14 days
- League: 30 days
- Club: 90 days during the launch/early-adopter period

Checkout should collect payment details during the trial. Do not set `payment_method_collection=if_required`; the first payment should run automatically when the trial expires.

### A2 — Webhook Endpoint

In Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://[your-dev-domain]/api/webhooks/stripe` (and prod URL later)
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `invoice.payment_action_required`
  - `customer.subscription.trial_will_end`

Record the webhook signing secret (`whsec_...`) and add to env vars.

For local dev, use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### A3 — Customer Portal Configuration

In Stripe Dashboard → Settings → Customer Portal:
- Allow customers to update payment methods: **Yes**
- Allow customers to view invoice history: **Yes**
- Allow customers to update subscriptions: **No for downgrades/cancellations in V1**. Plan downgrades must start in FieldLogicHQ so the app can preflight usage, collect retention choices, and then schedule/apply the Stripe change.
- Allow customers to cancel subscriptions: **No in Stripe Portal for V1**. Cancellation must start in FieldLogicHQ because it suspends the full account, modules, and public pages.
- Cancellation survey: collect inside the FieldLogicHQ cancellation flow. Stripe Portal cancellation survey can remain disabled unless we later allow Stripe-hosted cancellation for a fully preflighted path.
- Proration behaviour: **Prorate immediately** (charge/credit at time of change)
- Invoice immediately on subscription upgrade: **Yes**

---

## Phase B — App Infrastructure

### B1 — Package Installation

```bash
pnpm add stripe
# Only needed if using embedded Checkout (see Open Decision #1)
# pnpm add @stripe/stripe-js
```

### B2 — Stripe Server Singleton

**File:** `lib/stripe.ts`

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});
```

### B3 — Price ID Map

**File:** `lib/stripe-prices.ts`

Centralised map from plan + period to price ID. Avoids scattering env var lookups across the codebase.

```typescript
export type StripePlan = 'tournament_plus' | 'league' | 'club';
export type BillingPeriod = 'monthly' | 'annual';

export function getPriceId(plan: StripePlan, period: BillingPeriod): string {
  const map: Record<StripePlan, Record<BillingPeriod, string>> = {
    tournament_plus: {
      monthly: process.env.STRIPE_PRICE_TOURNAMENT_PLUS_MONTHLY!,
      annual:  process.env.STRIPE_PRICE_TOURNAMENT_PLUS_ANNUAL!,
    },
    league: {
      monthly: process.env.STRIPE_PRICE_LEAGUE_MONTHLY!,
      annual:  process.env.STRIPE_PRICE_LEAGUE_ANNUAL!,
    },
    club: {
      monthly: process.env.STRIPE_PRICE_CLUB_MONTHLY!,
      annual:  process.env.STRIPE_PRICE_CLUB_ANNUAL!,
    },
  };
  return map[plan][period];
}

export function getRepTeamPriceId(period: BillingPeriod): string {
  return period === 'monthly'
    ? process.env.STRIPE_REP_TEAM_PRICE_MONTHLY_ID!
    : process.env.STRIPE_REP_TEAM_PRICE_ANNUAL_ID!;
}
```

### B4 — DB Migration

**File:** `supabase/migrations/037_stripe_subscription_period.sql`

```sql
ALTER TABLE organizations
  ADD COLUMN subscription_period           text CHECK (subscription_period IN ('monthly', 'annual')),
  ADD COLUMN current_period_end            timestamptz,
  ADD COLUMN rep_team_subscription_item_id text;

COMMENT ON COLUMN organizations.subscription_period IS 'monthly or annual — set from Stripe subscription';
COMMENT ON COLUMN organizations.current_period_end IS 'Stripe current_period_end — used for renewal display and grace period logic';
COMMENT ON COLUMN organizations.rep_team_subscription_item_id IS 'Stripe subscription item ID for the per-team add-on; set when first team exceeds free threshold';
```

Apply to dev first, then prod during Phase G.

### B5 — DB Helper Updates

**File:** `lib/db.ts` — add/update:

```typescript
// Update org Stripe state (called from webhook handler)
export async function updateOrgSubscription(orgId: string, fields: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  planId?: string;
  subscriptionPeriod?: string;
  currentPeriodEnd?: string;
  repTeamSubscriptionItemId?: string;
}): Promise<void>
```

---

## Phase C — Webhook Handler

**File:** `app/api/webhooks/stripe/route.ts`

Critical: the route must receive the **raw request body** (not parsed JSON) for signature verification. In Next.js App Router:

```typescript
export const runtime = 'nodejs'; // required — edge runtime doesn't support raw body
```

Use `req.text()` to get the raw body, then `stripe.webhooks.constructEvent()` to verify.

### Event handlers

**`checkout.session.completed`**
- Extract `metadata.orgId` (set when creating the session)
- Set `stripe_customer_id` on the org if not already set
- The subscription will be handled by `customer.subscription.created` which fires alongside this

**`customer.subscription.created` / `customer.subscription.updated`**
- Extract price ID from `subscription.items.data[0].price.id`
- Reverse-map price ID → `plan_id` and `subscription_period` using the price ID map
- Update org: `plan_id`, `subscription_status`, `subscription_period`, `stripe_subscription_id`, `current_period_end`
- If the subscription has a rep team add-on item, also update `rep_team_subscription_item_id`

**`customer.subscription.deleted`**
- Treat as account cancellation/suspension, not a downgrade to free
- Set `subscription_status = 'canceled'`
- Clear `stripe_subscription_id`, `subscription_period = null`, `current_period_end = null`
- Disable all modules and public pages according to the cancellation retention state
- Start or reconcile the 90-day retention window if a cancellation intent does not already exist

**`invoice.payment_failed`**
- Set `subscription_status = 'past_due'` on the org
- Send email to org owner (via existing Resend integration): subject "Action required: payment failed for [Org name]"

**`invoice.payment_succeeded`**
- Set `subscription_status = 'active'`
- Update `current_period_end` from the new invoice period

**`customer.subscription.trial_will_end`**
- Send a reminder to the org owner that the trial is ending and the first payment will be collected automatically from the payment method on file.
- Include a link to the Subscription page or Stripe billing portal for payment-method changes.

**Reverse price ID map** (needed in webhook handler to identify plan from price ID):

```typescript
function planFromPriceId(priceId: string): { planId: string; period: string } | null {
  const map: Record<string, { planId: string; period: string }> = {
    [process.env.STRIPE_PRICE_TOURNAMENT_PLUS_MONTHLY!]: { planId: 'tournament_plus', period: 'monthly' },
    [process.env.STRIPE_PRICE_TOURNAMENT_PLUS_ANNUAL!]:  { planId: 'tournament_plus', period: 'annual'  },
    [process.env.STRIPE_PRICE_LEAGUE_MONTHLY!]:          { planId: 'league',           period: 'monthly' },
    [process.env.STRIPE_PRICE_LEAGUE_ANNUAL!]:           { planId: 'league',           period: 'annual'  },
    [process.env.STRIPE_PRICE_CLUB_MONTHLY!]:            { planId: 'club',             period: 'monthly' },
    [process.env.STRIPE_PRICE_CLUB_ANNUAL!]:             { planId: 'club',             period: 'annual'  },
  };
  return map[priceId] ?? null;
}
```

---

## Phase D — Checkout & Billing UI

### D1 — Create Checkout Session API

**File:** `app/api/billing/create-checkout-session/route.ts`

- Auth: owner only
- Body: `{ planId: StripePlan, period: BillingPeriod }`
- Creates or reuses the org's Stripe customer (`stripe.customers.create` if `stripe_customer_id` is null)
- Creates a `checkout.session` with:
  - `mode: 'subscription'`
  - `customer`: org's Stripe customer ID
  - `line_items`: price ID for the selected plan + period
  - `subscription_data.trial_period_days`: plan-specific trial length from `PLAN_CONFIG`
  - `subscription_data.metadata.orgId`: org ID (mirrors Checkout Session metadata for webhook reconciliation)
  - `metadata.orgId`: org ID (used in webhook to find the org)
  - `success_url`: `/{orgSlug}/admin/org/billing?checkout=success`
  - `cancel_url`: `/{orgSlug}/admin/org/billing`
  - `allow_promotion_codes: true`
- Returns `{ url }` — client redirects to this URL

### D2 — Create Portal Session API

**File:** `app/api/billing/create-portal-session/route.ts`

- Auth: owner only
- Requires `stripe_customer_id` on org (org must have gone through checkout at least once)
- Calls `stripe.billingPortal.sessions.create({ customer, return_url })`
- Returns `{ url }` — client redirects

### D3 — Billing Settings Page

**File:** `app/[orgSlug]/admin/org/billing/page.tsx` (update or create)

Layout:
- **Current plan card** — plan name, status badge (`active` / `past_due` / `canceled`), next renewal date (`current_period_end`), billing period (monthly / annual)
- **Upgrade section** — shown if on Tournament (free); plan comparison cards with "Upgrade" CTAs that POST to `create-checkout-session`
- **Manage billing button** — shown if `stripe_customer_id` is set; POSTs to `create-portal-session` and redirects for payment methods and invoices
- **Downgrade plan action** — starts the FieldLogicHQ downgrade review flow, not Stripe Portal
- **Cancel account action** — starts the FieldLogicHQ cancellation/suspension flow, with module/public-page shutdown and 90-day retention messaging
- **Payment issue banner** — shown if `subscription_status === 'past_due'`; prompts to update payment method via portal
- **Trial messaging** - show the plan-specific trial length and make clear that payment details are collected in Stripe, with the first payment after the trial
- **Invoice history** — optional: call `stripe.invoices.list({ customer })` and render a table of past invoices with download links

Access: owner role only. Non-owners see "Contact your org owner to manage billing."

### D4 — Downgrade and Cancellation Review

See [BILLING_DOWNGRADE_RETENTION_PLAN.md](BILLING_DOWNGRADE_RETENTION_PLAN.md) for the full data-retention workflow.

- Downgrades keep the account active on a lower plan after required choices are made.
- Confirmed downgrade intents must schedule/apply the matching Stripe subscription change and reconcile the final Stripe state back to FieldLogicHQ.
- Cancellation suspends the whole account, all modules, and all public pages at the effective date.
- Confirmed cancellation intents must schedule/apply the matching Stripe cancellation and reconcile `customer.subscription.deleted` without reverting the org to the free plan.
- Canceled-account data is retained for 90 days before purge.
- Retained tournament data should be exportable from tournament archives and by platform support, not from the billing screen.
- Platform admins can extend retention windows and see records approaching purge.

---

## Phase E — Per-Team Billing (Club Add-on)

*Incorporates Rep Teams Phase 3 from REP_TEAMS_ENHANCEMENTS_PLAN.md*

### E1 — Active Team Count Logic

Active team = rep team with at least one program year in `draft` or `active` status.
Billable quantity = `max(0, active_count - 3)` (first 3 free on Club plan).

**File:** `lib/db.ts`
```typescript
export async function getActiveRepTeamCount(orgId: string): Promise<number>
```

### E2 — Billing Sync Helper

**File:** `lib/stripe-sync.ts`

```typescript
export async function syncRepTeamBilling(orgId: string): Promise<void>
```

Logic:
1. Get `active_count` from `getActiveRepTeamCount(orgId)`
2. Get org's `subscription_period`, `stripe_subscription_id`, `rep_team_subscription_item_id`
3. Quantity = `max(0, active_count - 3)`
4. If `rep_team_subscription_item_id` exists: call `stripe.subscriptionItems.update(itemId, { quantity })`
5. If item doesn't exist and quantity > 0: call `stripe.subscriptionItems.create({ subscription, price, quantity })`, save new item ID to org
6. If quantity === 0 and item exists: call `stripe.subscriptionItems.delete(itemId)`, clear `rep_team_subscription_item_id` from org

### E3 — Billing Preview API

**File:** `app/api/admin/rep-teams/billing-preview/route.ts`

- Auth: owner or admin
- Query: `?proposedCount=N`
- Only relevant for Club plan orgs
- Calls `stripe.invoices.createPreview` with the updated quantity
- Returns: `{ currentCount, newCount, billableNow, immediateCharge, newRecurring, billingPeriod, nextRenewal }`

### E4 — Team Creation Billing Modal

In the team creation form / API flow:
- Before submitting, if org is on Club plan and `active_count >= 3`: fetch billing preview
- Show modal:
  - Monthly: *"Adding this team adds $X to your current bill today (prorated), and $20/month going forward."*
  - Annual: *"Adding this team adds $X to your current bill today (prorated), and $200/year going forward."*
- Cancel or Confirm → proceed with team creation
- On team creation success: call `syncRepTeamBilling(orgId)`

### E5 — Program Year Status Hook

In `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/route.ts` (PATCH handler):
- When `status` changes to `completed` or `archived`: call `syncRepTeamBilling(orgId)`

### E6 — Billing Page Add-on Section

On the billing page (`/admin/org/billing`): if org is on Club and has `rep_team_subscription_item_id`:
- Show "Add-ons" section: "Additional rep teams (N active above threshold) — $X/period"
- Show total line

---

## Phase F — Upsell Surfaces

### F1 — Upgrade Gate Component

**File:** `components/billing/UpgradeGate.tsx`

Props: `requiredPlan: StripePlan`, `feature: string`, `children: ReactNode`

Renders children if org has the required plan. Otherwise renders a locked state card with:
- Feature name
- "Available on [Plan Name] and above"
- "Upgrade" CTA → links to `/admin/org/billing`

Use this to wrap features currently hidden by `hasModuleEntitlement()` so users see what they're missing rather than a blank section.

### F2 — Plan Selection → Checkout

In the onboarding plan selection step (`/[orgSlug]/admin/onboarding`):
- If user selects a paid plan, redirect to Stripe Checkout instead of proceeding in-app
- On checkout success (return to `?checkout=success`), resume onboarding
- Free plan selection continues as today

### F3 — Soft Upsell Prompts

Key locations to add upgrade nudges for Tournament plan orgs:
- Tournament limit reached (1 active tournament) → "Unlimited tournaments available on Tournament Plus"
- Attempting to access accounting/rep teams → UpgradeGate wrapping the section entry point

### F4 - Trial Checkpoints and Reminders

Use the longer League and Club trials as a guided onboarding window, not a passive waiting period:
- League: day 7 setup check, day 21 registration/season readiness check, trial-ending reminder before day 30.
- Club: day 7 workspace setup check, day 30 accounting/rep-team adoption check, day 60 integration review, day 80 renewal/payment reminder.
- Trial-ending reminders should confirm the plan, renewal amount, billing period, and payment method path.

---

## Phase G — Production Cutover

Manual steps performed once all test phases are verified end-to-end.

### G1 — Stripe Prod Account Setup
- Repeat Phase A steps in **live mode** (not test mode)
- Create same products and prices; record live price IDs
- Configure Customer Portal (same settings as test: payment methods and invoices only; no direct cancellation/downgrade until the FieldLogicHQ review flow is ready)
- Add prod webhook endpoint: `https://[prod-domain]/api/webhooks/stripe`
- Record live webhook signing secret

### G2 — Amplify Environment Variables
Set all production env vars in AWS Amplify console (under the production branch environment):
- `STRIPE_SECRET_KEY` (sk_live_...)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_live_...)
- `STRIPE_WEBHOOK_SECRET` (prod whsec_...)
- All price IDs (live versions)

### G3 — Apply DB Migration to Production
Run migration `037_stripe_subscription_period.sql` against the production Supabase instance.

### G4 — End-to-End Smoke Test Checklist
- [ ] New org signup → choose Tournament Plus monthly → Stripe Checkout → subscription active → plan shown correctly in billing page
- [ ] New org signup → choose League monthly → Stripe Checkout creates a 30-day trial with payment method collected
- [ ] New org signup → choose Club monthly → Stripe Checkout creates a 90-day trial with payment method collected
- [ ] Webhook received and org `plan_id` updated (check Stripe dashboard event log)
- [ ] Customer Portal: change payment method
- [ ] FieldLogicHQ upgrade flow: upgrade to Club through Stripe Checkout
- [ ] FieldLogicHQ downgrade review: downgrade back to Tournament Plus after usage preflight
- [ ] FieldLogicHQ cancellation flow: cancel paid account, verify modules/public pages shut down at effective date and 90-day retention starts
- [ ] Club org: add 4th rep team → billing preview modal appears with correct amounts
- [ ] Club org: archive program year → billing quantity decrements
- [ ] Payment failure simulation (use Stripe test card 4000 0000 0000 0341 in test mode, then verify prod behaviour)

---

## Build Order

| Phase | Description | Blocks |
|---|---|---|
| A | Stripe dashboard setup (manual) | B, C |
| B | App infrastructure: SDK, lib/stripe.ts, price map, migration | C, D, E |
| C | Webhook handler | D |
| D | Checkout + Customer Portal APIs + billing page | F |
| E | Per-team billing sync + preview modal | — |
| F | Upsell gate component + plan selection flow | — |
| G | Production cutover | All of above verified in test |

A and B can proceed in parallel (A is manual dashboard work; B is code with no Stripe dependency until keys are ready).
