# Stripe Setup Guide
## FieldLogicHQ — plan subscriptions and online payments

> Rewritten 2026-11-03 against the code (Plans & pricing Stage 1 Part 4). The subscription half used to describe an
> earlier product ("Battle of the Bats", Starter / Pro / Elite in USD, price IDs in environment variables); none of
> that is true any more. The Stripe Connect half (online payments) was already current and is unchanged.

**Who this is for:** the owner, setting up Stripe for a site and checking that test and live agree (the test ↔ live
reconciliation, item R of `docs/projects/active/STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md`) and making the first live purchase.
Every step here is a dashboard or hosting setting, so it is the owner's: **a build session describes what to set and never
changes Stripe settings or keys itself.**

**Prices are not in this guide.** Plan names and amounts live in one place,
[`docs/agents/strategy/PLAN_PRICING_FACTS.md`](../strategy/PLAN_PRICING_FACTS.md) ("Plans at a glance"), and the test run
(`npm test`, and so `verify:changed`) fails if the product disagrees with it. The hosted build does not run it. All prices are **CAD**, monthly and annual.

This guide covers three stages:
1. **Dev** — no Stripe at all, mock mode on your own computer
2. **Test** — real Stripe checkout with fake cards and no real money (Stripe calls this the sandbox)
3. **Live** — production Stripe with real customers and real payments

### What the product reads, and where (read this once)

| Thing | Where it comes from | What you do |
|---|---|---|
| The secret key | `STRIPE_SECRET_KEY`. Its prefix decides the mode: `sk_live_` / `rk_live_` = live, `sk_test_` / `rk_test_` = test, anything else or none = test | Set it per site in Amplify (or `.env.local`) |
| The billing webhook's signing secret | `STRIPE_WEBHOOK_SECRET` | Copy it from the webhook endpoint |
| Each plan's Stripe price | The price slots in **Platform admin → Plans & pricing**, one per plan, billing period and mode (Test or Production). **No price ID is an environment variable any more** | Paste each `price_…` ID into its slot |
| The customer portal's settings | Pinned in our code; the app creates the portal configuration itself | Nothing (see Stage 2, Step 5) |
| Trial length | The plan config (Club and Club · Association 90 days, Tournament Plus 14, League Plus 30, Premium Coaches Portal and the free plan none). A customer who had a subscription before gets no second trial | Nothing. **Never put a free trial on a Stripe price** |
| The two Connect secrets | `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET` | See "Online payments — Stripe Connect" below |

The build copies all four `STRIPE_*` values into the production bundle (`amplify.yml`), so a change in Amplify needs a
redeploy.

---

## Stage 1: Dev (Mock Mode)

No Stripe account required.

### What you need in `.env.local`

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Leave `STRIPE_SECRET_KEY` out. To get the mock customer portal as well, add `ENABLE_BILLING_MOCK_PORTAL=true` (a platform
admin can also switch mock billing on and off for the running server in Platform admin's dev tools).

### What mock mode does

| Action | Behaviour |
|--------|-----------|
| Choose a paid plan on Plan & billing, with no Stripe key | The plan is written straight to the database and you come back with the success message. No Stripe page opens |
| Open the customer portal in mock mode | A local mock portal at `/{org}/admin/org/billing/mock-portal` lets you set any plan and subscription status (active, trialing, past due, canceled) directly |
| `/api/billing/mock-apply` | Answers 404 unless mock mode is on |

**Mock mode is always off in production**, whatever the settings say, and production with no key answers "Stripe checkout
is not configured" rather than giving a plan away.

Use mock mode for day-to-day work. Use Stage 2 when you need the real Stripe checkout end to end.

---

## Stage 2: Test Mode (Real Stripe, No Real Money)

A real Stripe account with test keys and fake cards. Nothing is ever charged. This is the mode for local Stripe testing
and the dev/staging site.

### Step 1 — Create a Stripe account

Go to [stripe.com](https://stripe.com) and sign up. Test mode works on any account without activating it.

### Step 2 — Switch to Test mode in the dashboard

Open [dashboard.stripe.com](https://dashboard.stripe.com) and switch to **Test mode** (sandbox). Everything you create
here (products, prices, customers, webhooks, the portal configuration) is separate from Live mode, so you repeat these
steps in Stage 3.

### Step 3 — Create one product per plan, with a monthly and an annual price

Go to **Product catalog → Add product**. For each paid plan in the Facts doc's table (today: Tournament Plus, League
Plus, Club, Club · Association, Premium Coaches Portal; the free plan has no price):

1. Name the product after the plan's public name.
2. Add a **recurring monthly** price and a **recurring annual** price on that **same product**, in **CAD**, at the Facts
   doc's amounts.
3. **Do not set a free trial on either price.** The app sets the trial at checkout from the plan config.
4. Copy each **Price ID** (`price_…`).

Plans & pricing also lists two add-on slots, the org team add-on and the extra rep team. Both are marked **Retired**
there, and the extra rep team's slot is read by nothing. Leave them empty.

### Step 4 — Paste each price into Plans & pricing (Test)

In **Platform admin → Plans & pricing**, set the Stripe mode picker to **Test / Sandbox Mode**, find each plan's monthly
and annual slot, and paste its Price ID. You need the catalogue power to do this.

Before saving, the app reads the price from Stripe and checks it against the slot:

- **Refused:** a price that does not exist, is archived, is one-time rather than recurring, bills on the wrong interval,
  is not in CAD, or belongs to the other mode.
- **Warned, and you must confirm:** the amount differs from the plan config, the price is already in another slot, or the
  plan's two prices are on different Stripe products.

A Test slot can only be checked from a site running a test key (your local server with a test key, or dev/staging).

### Step 5 — The customer portal: nothing to switch on, one thing to check

**The app owns the portal's settings** (owner sequence ruling, 2026-10-31: "portal settings live in our code"). The first
time anyone opens the portal in a mode, the app creates a portal configuration named **"FieldLogicHQ portal v2"** in that
mode and uses it for every portal visit after that. It offers exactly:

- updating the payment method
- invoice history
- updating name, email and tax ID. **Not the billing address** (v2, owner ruling 2026-11-04, GST/HST Stage 1 Part 3): it
  changes only on the app's own Plan & billing window, which copies it onto the Stripe customer. v1 offered the address;
  the first portal open after v2 ships creates v2 and switches v1 off, in each mode.
- **cancelling at the end of the period**, with no refund for the unused part (the owner's ruling: a plan runs to its
  renewal date, and the app ends it then)
- **no** plan switching: plan moves happen only on the app's own Plan & billing page

> ⚠ This replaces the 2026-10-29 instruction to keep cancelling off in the dashboard. The dashboard's default portal
> settings are no longer used at all, so changing them does nothing. **Do not edit "FieldLogicHQ portal v2" in the
> dashboard either:** a change to what the portal offers is a code change, which creates the next version and switches
> the old one off.

The one dashboard check: if Stripe refuses to create the portal, look at the account's **public business details**
under Settings and fill them in (once per mode). The code sends none of them, so this is Stripe's own requirement and
is not verified here.

### Step 6 — The billing webhook

When Stripe processes a subscription event it posts to `/api/billing/webhook`. The webhook:

- refuses an event whose signature does not match `STRIPE_WEBHOOK_SECRET` (answers 400);
- **ignores an event from the other mode** (a test event at a live site, or the reverse) and records that it did;
- keeps a record of every event it receives, so a repeat delivery is recognised and not run twice;
- re-reads the subscription, the charge and the platform-fee invoice from Stripe before acting, so the order events
  arrive in does not matter. A dispute is the exception: it is taken from the event itself.

**Locally**, install the [Stripe CLI](https://stripe.com/docs/stripe-cli), run `stripe login`, then leave this running:

```
stripe listen --forward-to localhost:3000/api/billing/webhook
```

It prints a signing secret (`whsec_…`); put it in `.env.local` as `STRIPE_WEBHOOK_SECRET` and restart the dev server.
(On this PC the CLI's path is in "Local — two listen windows" below.)

**For a deployed test site**, create an event destination in the dashboard (test mode) instead, pointing at
`https://<site address>/api/billing/webhook`, with the event list in Stage 3, Step 5. Copy its signing secret.

### Step 7 — Set your test environment variables

```
STRIPE_SECRET_KEY      = sk_test_...      ← Developers → API keys → Secret key (Test mode)
STRIPE_WEBHOOK_SECRET  = whsec_...        ← from stripe listen (local) or the event destination (deployed)
NEXT_PUBLIC_APP_URL    = https://<site address>   (http://localhost:3000 locally; no trailing slash)
```

### Step 8 — Test card numbers

Any future expiry and any 3-digit CVC.

| Scenario | Card number |
|----------|-------------|
| Successful subscription | `4242 4242 4242 4242` |
| Card declined | `4000 0000 0000 0002` |
| Requires 3D Secure authentication | `4000 0025 0000 3155` |
| Card fails after trial ends | `4000 0000 0000 0341` |

### Step 9 — Verify the full flow

- [ ] On **Plan & billing**, choose a paid plan → the Stripe checkout page opens → pay with `4242 4242 4242 4242` → you
      come back with the success message.
- [ ] Plan & billing shows the new plan, trialing if the plan has a trial.
- [ ] Open the customer portal → it offers payment method, invoices and your details; cancelling says it takes effect at
      the end of the period; there is no plan switching.
- [ ] Cancel in the portal → the plan keeps running to its renewal date; nothing ends today.
- [ ] The listen window (or the destination's recent deliveries) shows each event answered 200.
- [ ] Run the read-only audit against the test account:
      `node scripts/audit-stripe-billing.mjs --env .env.local --environment sandbox --allow-test`

---

## Stage 3: Go Live (Real Payments)

### Step 1 — Activate your Stripe account

In the dashboard, **Activate your account** (Settings → Account details): business details, the bank account for payouts,
identity if asked. Live keys do not work until this is done.

### Step 2 — Switch to Live mode in the dashboard

Turn Test mode off.

### Step 3 — Create the products and prices again in Live mode

Live mode knows nothing about test products. Repeat Stage 2, Step 3 in Live mode, at the Facts doc's amounts, CAD,
monthly and annual on one product per plan, no trial on the price.

### Step 4 — Paste the live prices into Plans & pricing (Production)

Set the Stripe mode picker to **Production / Live Mode** and paste each live Price ID into its slot. A Production slot
asks you to **sign in again** and to give a **reason**, which goes in the audit log. The same checks as Stage 2, Step 4
run, but Stripe can only be asked from a site holding the live key: **paste live prices from production's own Plans &
pricing.** From dev, a Production slot is saved without being checked against Stripe (the screen says so).

A slot you replace is not forgotten: a subscription already on the old price is still recognised as that plan.

### Step 5 — Create the production webhook endpoint

**Workbench → Webhooks → Create an event destination** (older dashboards: Developers → Webhooks), in **Live mode**:

- **Endpoint URL:** `https://www.fieldlogichq.ca/api/billing/webhook` — **with `www`**. The bare domain redirects to
  `www`, and Stripe does not follow redirects, so an endpoint without it never delivers.
- **API version:** `2026-04-22.dahlia` (the version the app is built for; the audit warns on any other).
- **Events** (every event the billing webhook acts on, re-checked against the code 2026-11-03):
  - `checkout.session.completed`
  - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
    `customer.subscription.trial_will_end`
  - `invoice.payment_succeeded`, `invoice.payment_failed`
  - `payment_method.attached`, `payment_method.detached`
  - `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.refunded` — a disputed or
    refunded **subscription** payment (Plans & pricing Stage 0; the owner added these to test mode 2026-11-03, and the
    live endpoint gets them in the reconciliation)
  - `invoice.paid`, `invoice.voided`, `invoice.marked_uncollectible`, `invoice.finalized` — a club's own **Stripe-fees
    invoice** (Club Tier Stage 12d-1). The webhook sends every `invoice.*` event that carries the fee-invoice marker to
    that invoice's own record and nothing else, and re-reads the invoice from Stripe.

> **Stripe-fees invoices (Club Tier Stage 12d-1).** A club with no subscription invoice to carry its Stripe fees (a
> comped or free club, or a discounted subscription) gets its own monthly invoice on the 1st, raised on the **platform**
> account, so its events arrive here, not at the Connect webhook. The product raises it to be paid on Stripe's hosted page
> (`send_invoice`), with auto-advance off and Stripe's own invoice email never sent; FieldLogicHQ sends the email. A daily
> job also re-reads every open fee invoice, so a missed event is caught the next morning.

Save, then reveal the destination's **signing secret** (`whsec_…`) and copy it.

### Step 6 — The live API key

**Developers → API keys** in Live mode: copy the **Secret key** (`sk_live_…`).

The mode check also accepts a restricted key (`rk_live_…`), but **production keeps the full secret key**: the support
console refunds and cancels, and Stripe grants refunds only together with charge writes, so a restricted key would need
nearly everything anyway (owner ruling T23, `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`). Family online payments also open
only on a full `sk_live_` key. No permission list for a restricted key has been worked out; do not switch to one without
a decision.

### Step 7 — Update the production environment variables

In Amplify → production → Environment variables:

```
STRIPE_SECRET_KEY      = sk_live_...      ← the live secret key
STRIPE_WEBHOOK_SECRET  = whsec_...        ← the live destination's signing secret
NEXT_PUBLIC_APP_URL    = https://www.fieldlogichq.ca
```

Redeploy after saving. (The two Connect secrets stay unset while production keeps online payments switched off.)

### Step 8 — The daily billing comparison

Every day at 12:15 GMT the app compares every Stripe subscription that is not cancelled with our own records: whether it
still exists, its status, plan, billing period, renewal date and price, and whether we are following it. It **never
repairs anything**. It keeps each day's result and emails the owner (once a day per outcome) when anything differs or
Stripe could not be read; a day it could not read is reported as "could not compare", never as a difference. A platform
admin can also run it by hand.

It is switched on for production as a release step, after the code that serves it is live (see the release's manual
production steps), not before.

### Step 9 — Reconcile test and live (item R)

Before the first live sale, check each of these in both modes:

- [ ] Every paid plan has a monthly and an annual price slot filled in Plans & pricing, for Production and for Test.
- [ ] The billing webhook destination exists in both modes with the full event list in Step 5 (the four dispute and
      refund events are the ones most likely missing in Live).
- [ ] Each site uses the key you think it does: production a live key, dev/staging a test key.
- [ ] Run the read-only audit against production:
      `node scripts/audit-stripe-billing.mjs --env .env.production.local`.
      ⚠ **Known gap (found 2026-11-03, not yet fixed):** the audit's own list of expected price slots still has Club at
      its old price and has no Club · Association slot, so it will flag Club even when Plans & pricing is right. Trust
      Plans & pricing's own check for Club until the audit is updated.

### Step 10 — The first live purchase

Make one real purchase, on the day of the release, to confirm end to end:

- [ ] As an organization owner, choose a paid plan on Plan & billing and pay with a real card.
- [ ] The success message appears and Plan & billing shows the plan.
- [ ] Open the customer portal. **This first live open creates the live "FieldLogicHQ portal v2"** (and switches off a live v1 if one exists). Check it offers what
      Stage 2, Step 5 lists.
- [ ] Stripe dashboard → **Customers** shows the customer.
- [ ] The live destination's recent deliveries show 200s.
- [ ] Cancel or refund it the way you intend to handle a real customer (the support console can refund it).

### Step 11 — Keep test mode for future work

Test products, prices and customers stay in Stripe untouched. Dev keeps mock mode or a test key; repeat Stage 2 with the
same test prices whenever a billing change needs checking.

---

## Online payments — Stripe Connect (Club Tier Stage 12a, test mode only)

Clubs connect their **own** Stripe account (Accounts v2, owner ruling 2026-10-25 — plan
`CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` §0d). Stripe sends two kinds of news, and each has its own door and its own
signing secret, separate from billing's:

| What Stripe reports | Where it goes | Secret |
|---|---|---|
| A payment or a refund on a club's account (v1 snapshot events) | `/api/payments/connect-webhook` | `STRIPE_CONNECT_WEBHOOK_SECRET` |
| A change to a club's account itself (v2 thin events) | `/api/payments/connect-account-events` | `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET` |

⚠ **Leave "Accounts v1 support" OFF** in the Stripe dashboard (owner ruling). The product creates v2 accounts.

> **Withdrawn (2026-10-25):** the earlier instructions for a **single** staging Connect webhook (with `account.updated`
> and `account.application.deauthorized`). Those events no longer drive anything. Use the two destinations below.

### Local — two listen windows

The Stripe CLI refuses to send both kinds to one listen ("cannot forward both snapshot and thin events to the same
destination"), so run **two** windows beside the dev server (and beside your billing listen, if it is running). On this
PC the CLI is not on the PATH; it lives at
`C:\Users\b2cow\AppData\Local\Microsoft\WinGet\Packages\Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe\stripe.exe`
(or `C:\tools\stripe\stripe.exe`). Both are version 1.55.1. Keep the quotes around each `--events` list and around `'@accounts'` / `'@self'` (PowerShell drops an unquoted `@word` entirely):
PowerShell splits an unquoted comma list into separate words, and the CLI then refuses with "`stripe listen`
does not take any positional arguments".

Window 1 — payments and refunds on the clubs' accounts:

```
stripe listen --events-from '@accounts' --events "checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.dispute.created,charge.dispute.updated,charge.dispute.closed,charge.dispute.funds_withdrawn,charge.dispute.funds_reinstated,refund.created,refund.updated,refund.failed" --forward-to localhost:3000/api/payments/connect-webhook
```

Window 2 — the clubs' accounts themselves:

```
stripe listen --events-from '@self' --events "v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account.closed" --forward-to localhost:3000/api/payments/connect-account-events
```

Both windows print the **same** signing secret (`stripe listen --print-secret` shows it). Locally, both
`STRIPE_CONNECT_WEBHOOK_SECRET` and `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET` in `.env.local` hold that one value. Restart the
dev server after changing either one. Checked 2026-10-25: window 2 forwarded a real `v2.core.account[requirements].updated`
from the sandbox and the app answered `[200]`.

### Staging — two event destinations

In the Stripe dashboard (test mode) → **Workbench → Webhooks → Create an event destination** (older dashboards:
Developers → Webhooks), create two. The form first asks where events come from (**Connected accounts** or
**Your account**), then the payload style:

1. **Connected accounts**, payload **Snapshot**, API version **2026-04-22.dahlia**. Events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`,
   `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, `refund.created`, `refund.updated`,
   `refund.failed`. Endpoint: `https://<staging address>/api/payments/connect-webhook`.
   Copy its signing secret into Amplify's `STRIPE_CONNECT_WEBHOOK_SECRET`.
2. **Your account**, payload **Thin**. Events: `v2.core.account[requirements].updated`,
   `v2.core.account[configuration.merchant].capability_status_updated`, `v2.core.account.closed`. Endpoint:
   `https://<staging address>/api/payments/connect-account-events`. Copy its signing secret into Amplify's
   `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET`.

Then redeploy. The build copies both secrets in (`amplify.yml`). Production keeps online payments switched off, so it
needs neither yet.

### ⚑ Owner's step — the events Stages 12c and 12d-1 added (one list)

These are dashboard settings, so they are the owner's to change; no build session touches them. If the staging
destinations were made before 12c, add all of these at once:

| Destination | Add | Why |
|---|---|---|
| Connected accounts (`/api/payments/connect-webhook`) | `checkout.session.async_payment_failed` | 12c: a bank debit that comes back before it settles |
| Connected accounts | `charge.dispute.created` | 12c: a bank debit the bank reverses after it cleared; 12d-1: a card dispute opens |
| Connected accounts | `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated` | 12d-1: a card dispute moves (answered, won, lost), and Stripe's dispute fee is taken or returned. Without `closed`, a dispute never shows as won or lost |
| Platform billing (`/api/billing/webhook`) | `invoice.paid`, `invoice.voided`, `invoice.marked_uncollectible`, `invoice.finalized` — plus `invoice.payment_succeeded` / `invoice.payment_failed` if the destination lacks them | 12d-1: a club's own Stripe-fees invoice turns paid, void or written off in platform admin |

The webhook re-reads each dispute and each fee invoice from Stripe on every event, so the order the events arrive in
does not matter, and an extra event costs one read.

Why two and not one thin destination (probe 2026-10-25): Stripe accepts one thin destination carrying both, but the
payments half would then need hand-parsed events and an extra Stripe read on every payment. That would rewrite the money
path to save one secret.

---

## Environment Reference

| Environment | STRIPE_SECRET_KEY | Behaviour |
|-------------|-------------------|-----------|
| Local dev | Not set | Mock mode — direct database writes, local mock portal |
| Local / dev / staging with Stripe | `sk_test_...` (or `rk_test_...`) | Real Stripe pages, fake cards, test price slots |
| Production | `sk_live_...` | Real Stripe, real payments, live price slots. Production never runs mock mode |

---

## Troubleshooting

**Checkout says "checkout is not configured for {plan} yet"**
That plan's price slot is empty for this site's mode. Paste the price in Platform admin → Plans & pricing (Test for a
test key, Production for a live key).

**Checkout redirects back immediately without completing**
`NEXT_PUBLIC_APP_URL` is likely wrong or missing. It must match the address Stripe sends people back to exactly, with no
trailing slash.

**Webhook events are not updating the database**
Watch the listen window or the destination's recent deliveries. A 400 means the signing secret does not match
`STRIPE_WEBHOOK_SECRET`. A 200 that says `ignored: wrong_mode` means the event came from the other mode: the site's key
and the destination are in different modes. A 200 that says `duplicate` is a repeat delivery the webhook already handled.

**The portal says it is not configured**
The app could not find or create its portal configuration in this mode. The usual cause is missing public business
details in Stripe's settings (Stage 2, Step 5). The app never falls back to the dashboard's default portal.

**Customer Portal returns "This link has expired"**
Portal sessions expire after a few minutes. Open the portal from the app each time; never store or reuse the address.

**Plan does not update after a successful checkout**
The webhook, not the return page, is what records the plan. Check the destination's recent deliveries for
`customer.subscription.created` and the answer the site gave.

**Going live: "Your account cannot currently make live charges"**
The Stripe account is not activated yet. Complete Settings → Account details.
