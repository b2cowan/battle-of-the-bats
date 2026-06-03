# Stripe Production Smoke Test TODO

**Priority:** High

**Status:** Deferred until FieldLogicHQ is closer to live paid subscriptions.

**Why deferred:** Production Stripe is configured and the automated audit passes, but FieldLogicHQ is focused on free Tournament / Tournament Plus rollout through the founding season. Running a live card smoke test now would create a small non-refundable Stripe processing fee and likely a temporary negative Stripe balance with no near-term paid revenue to offset it.

**Must complete before:** Enabling any paid self-serve subscription in production, collecting payment methods for founding-season conversion, or charging founding-season organizations after December 31, 2026.

## Expected Cost

Use the monthly Coaches Portal Premium price only.

- Temporary card charge: `$29.00 CAD`
- Expected non-refundable Stripe fee on a Canadian domestic card: about `$1.14 CAD`
- Full refund to the card: `$29.00 CAD`
- Expected Stripe balance after refund: about `-$1.14 CAD`

Do not run the smoke test against the annual price unless intentionally accepting a higher fee.

## Pre-Flight

- [ ] Confirm production Amplify has the live billing env vars deployed:
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
  - `NEXT_PUBLIC_APP_URL=https://fieldlogichq.ca`
- [ ] If any live webhook secret was exposed in a screenshot or chat, rotate the webhook signing secret in Stripe, update Amplify, redeploy production, and then continue.
- [ ] Run the production billing audit:

  ```powershell
  node scripts\audit-stripe-billing.mjs --env .env.production.local
  ```

- [ ] Confirm the audit result is `0 fail, 0 warn`.
- [ ] Use Stripe Live mode, not Test mode.
- [ ] Use a Canadian domestic card if possible to keep the smoke-test fee minimal.
- [ ] Prepare a disposable signup identity, for example:
  - Team name: `FieldLogicHQ Billing Smoke Test`
  - Email: `your+stripe-smoke@yourdomain.com`
  - Billing cycle: `Monthly`
- [ ] Confirm Coaches Portal / Team self-serve availability:
  - Visit `https://fieldlogichq.ca/coaches/start?billing=monthly` in an incognito browser.
  - If it is gated, temporarily set Coaches Portal / Team to `Live` in Platform Admin -> Plans & Pricing.
  - If temporarily ungated, record that it must be set back to `Early Access` during cleanup.

## Live Checkout

- [ ] In an incognito browser, open:

  ```text
  https://fieldlogichq.ca/coaches/start?billing=monthly
  ```

- [ ] Create the disposable Coaches Portal Premium signup.
- [ ] Complete Stripe Checkout using the real card.
- [ ] Confirm the browser redirects through:

  ```text
  /coaches/checkout/complete
  ```

- [ ] Confirm the final app URL is:

  ```text
  /{new-org-slug}/coaches?success=1
  ```

- [ ] Wait 30-60 seconds for Stripe webhooks to deliver.

## Stripe Verification

- [ ] In Stripe Live mode -> Customers, confirm the smoke-test customer exists.
- [ ] Confirm the customer has an active subscription.
- [ ] Confirm the subscription uses Coaches Portal Premium monthly at `$29 CAD / month`.
- [ ] Confirm the first invoice/payment succeeded.
- [ ] Open Developers / Workbench -> Webhooks -> production billing webhook.
- [ ] Confirm recent deliveries to `https://fieldlogichq.ca/api/billing/webhook` are HTTP `200`.
- [ ] Confirm relevant events delivered, especially:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `invoice.payment_succeeded`

## FieldLogicHQ Verification

- [ ] Confirm the new Coaches Portal workspace loads in the app.
- [ ] Confirm premium team tools are available.
- [ ] Open:

  ```text
  https://fieldlogichq.ca/{new-org-slug}/admin/org/billing
  ```

- [ ] Confirm the billing page shows an active Coaches Portal Premium subscription.
- [ ] In Platform Admin, confirm the smoke-test org/customer shows:
  - Plan/account kind: Coaches Portal / `team`
  - Subscription status: `active`
  - Stripe customer ID starts with `cus_`
  - Stripe subscription ID starts with `sub_`
  - Billing period is `monthly`

## Customer Portal Verification

- [ ] From the smoke-test billing page, click **Payment method & invoices**.
- [ ] Confirm the Stripe Customer Portal opens.
- [ ] Confirm payment method update and invoice history are available.
- [ ] Confirm subscription cancellation is not available in the Stripe portal, so FieldLogicHQ keeps the guided cancellation/retention flow.

## Cleanup

- [ ] Cancel the smoke-test subscription through FieldLogicHQ's cancellation flow if visible.
- [ ] If the app cancellation flow is not available, cancel the subscription manually in Stripe and verify the webhook updates FieldLogicHQ state.
- [ ] Confirm Stripe shows the subscription as canceled.
- [ ] Confirm webhook delivery for cancellation is HTTP `200`.
- [ ] Confirm FieldLogicHQ shows the workspace/subscription as canceled or inactive.
- [ ] Refund the full `$29.00 CAD` payment in Stripe.
- [ ] Confirm the refund is recorded.
- [ ] Expect Stripe balance to be negative by roughly the original processing fee.
- [ ] If Coaches Portal / Team was temporarily ungated, set it back to `Early Access` in Platform Admin -> Plans & Pricing.
- [ ] Run the audit again:

  ```powershell
  node scripts\audit-stripe-billing.mjs --env .env.production.local
  ```

- [ ] Confirm the audit remains `0 fail, 0 warn`.
- [ ] Record the smoke-test date, tester, Stripe customer ID, subscription ID, refund ID, and outcome in `TODO.md`.
- [ ] Mark the Stripe production smoke-test TODO complete.
