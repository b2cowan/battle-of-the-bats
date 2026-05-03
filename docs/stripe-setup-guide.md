# Stripe Billing Setup Guide
## Battle of the Bats — Tournament Platform

This guide covers three stages:
1. **Dev** — no Stripe at all, mock mode in your local environment
2. **Test** — real Stripe checkout with fake cards, no real money, deployed to your staging/test environment
3. **Live** — production Stripe with real customers and real payments

---

## Stage 1: Dev (Mock Mode)

No Stripe account required. The billing system detects that `STRIPE_SECRET_KEY` is absent and switches to a local simulation automatically.

### What you need in `.env.local`

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

That's it. Do not add any Stripe keys.

### What mock mode does

| Action | Behaviour |
|--------|-----------|
| Click "Upgrade to Pro" or "Upgrade to Elite" | Instantly upgrades your org in the database, redirects to `?success=1` with a success banner |
| Click "Manage Subscription" | Opens a local mock portal page at `/admin/billing/mock-portal` |
| Mock portal | Lets you freely switch plan (Starter / Pro / Elite) and subscription status (Active / Trialing / Past Due / Canceled) — applies directly to the database |
| `/api/billing/mock-apply` | Blocked with a 403 if `STRIPE_SECRET_KEY` is ever present, so it cannot be called in production |

Use mock mode for all day-to-day development and UI work. Switch to Test mode (Stage 2) only when you need to verify the real Stripe checkout flow end-to-end.

---

## Stage 2: Test Mode (Real Stripe, No Real Money)

This uses a real Stripe account but with test keys and fake card numbers. Nothing is ever charged. This is the right mode to run in your deployed test/staging environment before going live.

### Step 1 — Create a Stripe account

Go to [stripe.com](https://stripe.com) and sign up. You do not need to activate your account (i.e. submit your bank details) to use Test mode — test mode works immediately on any account.

### Step 2 — Switch to Test mode in the dashboard

Open [dashboard.stripe.com](https://dashboard.stripe.com). In the top-left corner there is a toggle that says **Test mode**. Make sure it is **on**. The dashboard header will turn orange as a reminder that you are in test mode.

> **Important:** Everything you create while in Test mode — products, prices, customers, webhooks — is completely separate from Live mode. You will repeat some of these steps later when you go live.

### Step 3 — Create your products and prices

Go to **Product catalog** in the left sidebar, then click **Add product**.

**Pro Plan**
- Name: `Pro`
- Pricing model: Standard pricing
- Price: `29.00` USD
- Billing period: Monthly
- Click **Save product**
- After saving, find the price row, click the `...` menu → **Edit**
- Scroll to **Free trial** → set `14` days → Save
- Copy the **Price ID** (starts with `price_`) — you will need this for `STRIPE_PRICE_PRO_MONTHLY`

**Elite Plan**
- Name: `Elite`
- Same steps as above with price `79.00` USD, 14-day trial
- Copy the Price ID → `STRIPE_PRICE_ELITE_MONTHLY`

### Step 4 — Configure the Customer Portal

The Customer Portal is the Stripe-hosted page where subscribers manage their own billing. You must configure it before it will work.

Go to **Settings → Billing → Customer Portal** (or visit `dashboard.stripe.com/settings/billing/portal` directly).

Turn on the following:
- ✅ Allow customers to cancel subscriptions
- ✅ Allow customers to update subscriptions (plan changes)
- ✅ Allow customers to update payment methods
- ✅ Show invoices

Under **Business information**, fill in your business name and support URL — Stripe requires this before the portal will activate.

Click **Save**.

> This configuration is shared between Test and Live mode. You only need to do this once.

### Step 5 — Set up the webhook for local testing

When Stripe processes a subscription event (trial started, payment failed, subscription cancelled) it sends a webhook POST to your server. In local development you need the Stripe CLI to forward those events to your laptop.

**Install the Stripe CLI**

Download the Windows installer from [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli) and run it. After installation, open a terminal and run:

```
stripe login
```

Follow the browser prompt to authenticate.

**Start the local webhook listener**

In a terminal (leave it running while you test):

```
stripe listen --forward-to localhost:3000/api/billing/webhook
```

The CLI will print a **webhook signing secret** that looks like `whsec_...`. Copy it — this is your `STRIPE_WEBHOOK_SECRET` for local testing.

### Step 6 — Set your test environment variables

In your deployed test environment (Amplify test branch, or a separate `.env.local` if testing locally with Stripe):

```
STRIPE_SECRET_KEY          = sk_test_...      ← Developers → API keys → Secret key (Test mode)
STRIPE_WEBHOOK_SECRET      = whsec_...        ← from stripe listen output (local) or Stripe dashboard (deployed)
STRIPE_PRICE_PRO_MONTHLY   = price_...        ← Pro price ID you copied in Step 3
STRIPE_PRICE_ELITE_MONTHLY = price_...        ← Elite price ID you copied in Step 3
NEXT_PUBLIC_APP_URL        = https://your-test-domain.com
```

> If you are testing against a deployed URL (not localhost), skip the Stripe CLI and instead create a webhook endpoint in the Stripe dashboard pointing at `https://your-test-domain.com/api/billing/webhook` (same steps as Step 1 of Stage 3 below, but while still in Test mode).

### Step 7 — Test card numbers

On the Stripe-hosted checkout page, enter these fake card numbers. Use any future expiry date and any 3-digit CVC.

| Scenario | Card number |
|----------|-------------|
| Successful subscription | `4242 4242 4242 4242` |
| Card declined | `4000 0000 0000 0002` |
| Requires 3D Secure authentication | `4000 0025 0000 3155` |
| Card fails after trial ends | `4000 0000 0000 0341` |

### Step 8 — Verify the full flow

Work through this checklist before considering the integration ready:

- [ ] Click **Upgrade to Pro** → Stripe checkout page loads → enter test card `4242 4242 4242 4242` → completes → redirected back with success banner
- [ ] Billing page shows **Pro** plan and **Trialing** status
- [ ] Click **Manage Subscription** → Stripe Customer Portal opens → can update payment method, view invoice
- [ ] Cancel the subscription in the portal → returns to billing page → status updates to **Canceled**, plan reverts to **Starter**
- [ ] The Stripe CLI terminal shows the webhook events being received and forwarded
- [ ] Check your Supabase `organizations` table — `plan_id`, `subscription_status`, `stripe_subscription_id`, `stripe_customer_id` all update correctly

---

## Stage 3: Go Live (Real Payments)

When you are satisfied with testing, follow these steps to switch to live keys. This is the only time real money will be involved.

### Step 1 — Activate your Stripe account

Before live keys will work, Stripe requires you to verify your business. In the Stripe dashboard, click **Activate your account** in the top banner (or go to **Settings → Account details**) and complete:

- Business type and details
- Bank account for payouts
- Identity verification if prompted

Activation typically takes a few minutes to a few hours.

### Step 2 — Switch to Live mode in the dashboard

Click the **Test mode** toggle in the top-left to turn it off. The orange header goes away.

### Step 3 — Recreate your products and prices in Live mode

Live mode has no knowledge of your test products. Repeat Step 3 from Stage 2 while in Live mode.

**Pro Plan** — $29.00/mo, 14-day trial → copy the new Live Price ID  
**Elite Plan** — $79.00/mo, 14-day trial → copy the new Live Price ID

> The Customer Portal settings from Step 4 of Stage 2 carry over to Live mode — you do not need to redo them.

### Step 4 — Create the production webhook endpoint

Go to **Developers → Webhooks → Add endpoint**.

- **Endpoint URL:** `https://yourdomain.com/api/billing/webhook`
- **Events to listen to:**
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Click **Add endpoint**. On the next screen, click **Reveal** under **Signing secret** to see your live `whsec_...`. Copy it.

### Step 5 — Get your live API keys

Go to **Developers → API keys** (while still in Live mode).

- Copy the **Secret key** (`sk_live_...`)
- Copy the **Publishable key** (`pk_live_...`) for future reference

### Step 6 — Update your production environment variables

In Amplify → your production environment → Environment variables, replace the test values:

```
STRIPE_SECRET_KEY          = sk_live_...      ← live secret key
STRIPE_WEBHOOK_SECRET      = whsec_...        ← live webhook signing secret
STRIPE_PRICE_PRO_MONTHLY   = price_...        ← live Pro price ID
STRIPE_PRICE_ELITE_MONTHLY = price_...        ← live Elite price ID
NEXT_PUBLIC_APP_URL        = https://yourdomain.com
```

Redeploy the production environment after saving.

### Step 7 — Smoke test with a real card

Make one real purchase to confirm end-to-end:

- [ ] Go to the billing page as an owner-role account
- [ ] Upgrade to Pro using a real card
- [ ] Confirm the Supabase `organizations` row updates
- [ ] Confirm the success banner appears
- [ ] Open the Customer Portal and verify it loads correctly
- [ ] Check the Stripe dashboard → **Customers** — your customer record should appear
- [ ] Check **Developers → Webhooks → your endpoint** → recent deliveries should show successful 200 responses

If everything looks good, you are live.

### Step 8 — Keep test mode available for future development

Your test products, prices, and customers remain untouched in Stripe. Your dev environment still uses mock mode (no keys). If you ever want to test a billing change before deploying it, repeat Stage 2 using your existing test keys and prices — they never expire.

---

## Environment Reference

| Environment | STRIPE_SECRET_KEY | Behaviour |
|-------------|-------------------|-----------|
| Local dev | Not set | Mock mode — direct DB writes, local mock portal |
| Test / staging | `sk_test_...` | Real Stripe UI, fake cards, no real money |
| Production | `sk_live_...` | Real Stripe, real payments |

---

## Troubleshooting

**Checkout redirects back immediately without completing**  
The `NEXT_PUBLIC_APP_URL` env var is likely wrong or missing. It must match the domain Stripe redirects back to exactly — no trailing slash.

**Webhook events are not updating the database**  
Run `stripe listen --forward-to localhost:3000/api/billing/webhook` and watch the terminal. If you see a 400 response, the signing secret does not match — double-check `STRIPE_WEBHOOK_SECRET`. If you see a 401, the auth cookie is not being read (webhooks are unauthenticated by design — the route should not call `getAuthContext`).

**Customer Portal returns "This link has expired"**  
Portal sessions expire after a few minutes. The user must click the Manage Subscription button each time to get a fresh session link — do not store or reuse the URL.

**Plan does not update after a successful checkout**  
The webhook is the source of truth for plan updates, not the checkout success redirect. Check the Stripe dashboard → Webhooks → your endpoint → recent deliveries to see if the `customer.subscription.created` event was delivered and what response your server returned.

**Going live: "Your account cannot currently make live charges"**  
Your Stripe account is not yet activated. Complete the business verification in Settings → Account details.
