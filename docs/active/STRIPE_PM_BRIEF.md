# Stripe Integration — Product Manager Brief

**Project:** FieldLogicHQ End-to-End Billing & Subscriptions
**Plan reference:** [STRIPE_INTEGRATION_PLAN.md](STRIPE_INTEGRATION_PLAN.md)
**Status:** Implementation in progress (see checklist in STRIPE_INTEGRATION_PLAN.md)

---

## Current state vs. documented baseline

The codebase is further along than the plan's original "Phase D not started" baseline. As of the start of this implementation session:

**Already fully built:**
- `lib/stripe.ts` — lazy Stripe singleton
- `app/api/billing/create-checkout/route.ts` — full checkout session creation with customer create/reuse, trial days, mock dev path, and gating enforcement
- `app/api/billing/portal/route.ts` — Stripe Customer Portal session creation
- `app/api/billing/webhook/route.ts` — webhook handler with signature verification and core event handlers
- `app/[orgSlug]/admin/org/billing/page.tsx` — billing settings page with upgrade cards, usage meters, downgrade/cancel review

**Completed:**
- ✅ Migration 047 — `subscription_period`, `current_period_end`, `rep_team_subscription_item_id` added to `organizations` — applied dev + prod
- ✅ Webhook additions — `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.trial_will_end`, `runtime = 'nodejs'`, new columns written on subscription events, `subscription.deleted` dedup guard

**Still needed:**
1. Stripe reconciliation on downgrade/cancel confirm routes — **current gap: these routes write to DB but never call Stripe, meaning Stripe continues charging the old amount**
2. Phase A — Stripe dashboard setup (manual): products, prices, portal config, webhook endpoint, env vars in Amplify dev branch
3. Phase E — per-team billing (Club add-on)
4. Phase F — UpgradeGate component, soft upsell prompts, onboarding plan → Stripe redirect

---

## What org owners experience at each touchpoint

### Signup / new org creation
No change. New orgs land on the free Tournament plan and run through the existing onboarding wizard.

### Onboarding plan selection (`/admin/onboarding`)
When an owner picks Tournament Plus, they are sent to Stripe Checkout. They enter a card and start a 14-day free trial. After checkout they return to the app with their plan active and onboarding continues. If they cancel checkout, they stay on the free plan. League and Club show as "Coming Soon" — no checkout available.

### Billing settings page (`/admin/org/billing`)
Already built. The owner sees:
- Current plan with status badge (Active / Trialing / Past Due / Canceled)
- Tournament slot and seat usage meters
- Upgrade cards — Tournament Plus is the only actionable upgrade; League and Club show as "coming soon"
- For paid orgs: "Payment method & invoices" button opening the Stripe Customer Portal
- For owners: downgrade review and cancel review flows

### Trial experience
Owner enters card at Stripe Checkout, gets 14 days free. The first charge happens automatically when the trial ends. A reminder email is sent to the org owner before the trial ends via the `customer.subscription.trial_will_end` webhook.

### Payment failure
Stripe fires `invoice.payment_failed` → webhook sets org to `past_due` → billing page shows a banner prompting the owner to update their card via the portal. Plan access continues during the grace period.

### Upgrade flow (existing free orgs)
Owner clicks "Upgrade to Tournament Plus" → Stripe Checkout → enters card → returns on `?success=1` → plan updated, success modal shown.

### Downgrade / cancellation
Already built (review flows in-app). Owner goes through a preflight review showing what changes before confirming. **Gap:** the confirm routes currently write to DB but don't yet call Stripe to update/cancel the subscription. This is a known open item (D4 in the plan).

### What stays the same for free users
Nothing changes. Free Tournament plan orgs never see a payment screen. Upgrade cards show Tournament Plus as available; League/Club as coming soon.

---

## Scope for this implementation

Self-serve checkout is live for **Tournament Plus only**. League and Club remain gated by the `plan_gating` table (both rows are `early_access`). The infrastructure supports all plans; only the UI surface needs to work for Tournament Plus now. When League and Club are ready, toggling `gating_status` to `live` in `plan_gating` is the only change needed.

---

## The three environments

| Environment | Stripe keys | Plan toggling | "Done" means |
|---|---|---|---|
| **Local dev** | None needed | `NEXT_PUBLIC_PLAN_GATES=live` or dev cookie toggle | Dev mock path works; plan changes write directly to DB |
| **Dev/staging** (Amplify dev + dev Supabase) | Test keys (`sk_test_...`, `pk_test_...`) | Real Stripe test checkout | End-to-end: owner completes test checkout, subscription status reflects in app, webhook events processed |
| **Production** (Amplify master + prod Supabase) | Live keys (`sk_live_...`, `pk_live_...`) | Real Stripe live | Smoke test checklist passed; all Phase G steps complete |

---

## Manual Stripe Dashboard setup (Phase A — your action items before dev/staging testing)

### ~~A1 — Create a Stripe account~~ ✅

Go to stripe.com and create an account. Select **Canada** as your country and complete business verification. Set your statement descriptor to `FIELDLOGICHQ` (full) and `FLHQ` (shortened). Link a bank account for payouts. If you don't have a registered business yet, Sole proprietor linked to a personal account is fine to start.

### ~~A2 — Create Products & Prices~~ ✅

Create 4 products in the Stripe Sandbox (**Product catalog → Add product**), each with a monthly and annual CAD price:

| Product name | Monthly | Annual | Notes |
|---|---|---|---|
| FieldLogicHQ — Tournament Plus | $39.00 | $390.00 | 14-day trial set in app |
| FieldLogicHQ — League | $89.00 | $890.00 | 30-day trial |
| FieldLogicHQ — Club | $179.00 | $1,790.00 | 90-day trial |
| Additional Rep Team (Club) | $20.00 | $200.00 | Per unit, not metered |

**Product descriptions (copy into Stripe):**

- **Tournament Plus:** Automated scheduling, playoff bracket generation, permanent sealed archives, advanced tournament branding, 3 tournament slots, and 5 staff seats with free official seats.
- **League:** Everything in Tournament Plus, plus a branded public organization page, House League management with registrations, divisions, and standings, and 10 staff seats.
- **Club:** The complete platform — full accounting with ledgers and invoicing, rep team management with tryouts and rosters, coaches portal, and unlimited staff seats.
- **Additional Rep Team:** Per-team add-on for Club plan organizations. First 3 active rep teams are included; each additional active team is billed at this rate.

**Product category:** Software as a service (SaaS) — select this for all four products.

For each price: Recurring billing, Monthly or Yearly, CAD. Rep Team product: **Flat rate** billing model (not metered/usage-based). Trial periods are set in app code, not in Stripe.

After creating, copy all `price_xxxxxxxx` IDs — 8 total (2 prices × 4 products).

### ~~A3 — Configure the Customer Portal~~ ✅

In Stripe Dashboard → **Settings → Customer Portal** (or Billing → Customer portal settings):

| Setting | Value | Reason |
|---|---|---|
| Payment methods | **On** | Customers can update their card on file |
| Invoice history | **On** | Customers can view and download past invoices |
| Cancellations | **Off** | Handled in-app via FieldLogicHQ guided review flow |
| Subscription updates / plan switching | **Off** | Upgrades and downgrades handled in-app |

Leave business information fields (name, privacy policy, terms URL) blank for now — add before going to production (Phase G).

### ~~A4 — Set up the Webhook Endpoint (dev/staging)~~ ✅

In Stripe Sandbox → **Workbench → Webhooks → Add destination → Webhook endpoint**:
- **Event destination scope:** Your account
- **API version:** `2026-04-22.dahlia`
- **Endpoint URL:** `https://dev.fieldlogichq.ca/api/billing/webhook`
- **Destination name:** `FieldLogicHQ Dev — Billing Webhook`
- **Events (8 total):** `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.payment_action_required`, `customer.subscription.trial_will_end`
- After creating: Reveal signing secret → copy `whsec_...`

### ~~A5 — Record all test-mode credentials and configure prices~~ ✅

**API keys → Amplify** (from `Developers → API keys` in test mode):
- Publishable key: `pk_test_...` → Amplify dev branch env var `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Secret key: `sk_test_...` → Amplify dev branch env var `STRIPE_SECRET_KEY`
- Webhook secret: `whsec_...` (from A4) → Amplify dev branch env var `STRIPE_WEBHOOK_SECRET`

**Never commit any keys to the repo.**

**Price IDs → Platform Admin** (not env vars):
After adding the API keys to Amplify and triggering a deploy, go to **Platform Admin → Stripe Prices**. Enter the 8 sandbox price IDs from A2 into the Sandbox rows (one per plan + cycle). The app detects the sandbox environment automatically from the `sk_test_` key prefix. Price IDs can be updated any time without a redeploy.

### A6 — Production (after dev is verified end-to-end)
Switch to Live mode in the Stripe dashboard and repeat A2–A5 with live keys. Live keys go to Amplify production branch env vars only.

---

## Why downgrades and cancellations go through FieldLogicHQ (not Stripe Portal)

**For the user:**
- Guided experience showing exactly what will change before confirming
- Active choices — e.g., "which of my 3 tournaments do I keep active?" on a downgrade
- No surprise data loss; a clear 90-day retention window with explict messaging

**For us:**
- Churn signal — we collect a reason at the point of action
- Usage preflight — we can't blindly apply a downgrade without resolving over-limit data
- Retention window ownership — platform admins can extend windows; Stripe has no concept of this
- Audit trail — everything flows through `billing_retention_intents`

**Manual Stripe work:** None, as long as the confirm routes call Stripe automatically. This is the current gap — both confirm routes write to DB but don't yet call `stripe.subscriptions.update()` (for downgrades between paid plans) or `stripe.subscriptions.cancel()` (for cancellations). Until this is wired up, any confirmed downgrade or cancellation in the app leaves the Stripe subscription still charging the old amount.

---

## Success criteria

An org owner (on dev/staging with test Stripe keys) can:
1. Open the billing page, click "Upgrade to Tournament Plus"
2. Complete Stripe test checkout with card `4242 4242 4242 4242`
3. Return to the app and see plan as Tournament Plus / Trialing — with no manual DB intervention

A payment failure simulation (test card `4000 0000 0000 0341`) sets the org to `past_due` and the billing page shows the warning banner.

