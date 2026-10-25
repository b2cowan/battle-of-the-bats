# Club Tier Stage 12a: move the club's Stripe account to Accounts v2 (rework prompt)

> **Written 2026-10-25.** Paste this into a new chat on `dev`. Recommended model: **Opus 5.5** (money, Stripe, a
> webhook, a migration). Other sessions share this working copy: stage explicit paths only and commit only your own
> hunks. Re-verify every lead below in the code first. The leads come from a census plus my own reads, and this prompt
> names files, not lines.

## Why this exists

The owner's first 12a walk stopped at **Set up payouts → Continue to Stripe → 500**. The cause, from `error_events` on
dev: Stripe refuses `POST /v1/accounts` for new platforms ("Stripe no longer recommends Accounts v1 for new Connect
integrations. Create connected accounts with POST /v2/core/accounts instead…"). **The owner ruled: build it the way
Stripe wants it now, on Accounts v2. Do NOT use the "Accounts v1 support" dashboard toggle; it stays off.**

**Read first: `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` §0d.** It holds the ruling, Stripe's v1→v2 property map, the
sandbox probe results, and the list of what changes and what doesn't. Then read §0c (the four account rulings) and the
original `CLUB_TIER_STAGE12A_BUILD_PROMPT.md` for 12a's shape. That prompt's v1 wording (Express account, Account Links,
`account.updated`) is superseded by §0d.

## What stays exactly as it is (owner rulings, do not re-open)

- Each club gets its own connected account. Payments are direct charges on it, and FieldLogicHQ never holds the money.
- **Express Dashboard** (`dashboard: 'express'`).
- **FieldLogicHQ pays Stripe's processing fee** (`fees_collector: 'application'`). The application fee is the whole
  all-in fee.
- **Stripe covers losses** (`losses_collector: 'stripe'`, Managed Risk), with Stripe collecting KYC (derived).
- Test mode only. Production keeps the feature switched off.
- Every screen, word and state of the Payouts card as drawn and approved. **This is a plumbing change. The owner should
  see nothing new except that Set up payouts now works.**

## The work

1. **Account creation.** `v2.core.accounts.create` with the `2026-09-30.preview` API version (Stripe requires the
   preview for Express + Stripe-covered losses):
   - `identity.country: 'ca'`, `defaults.currency: 'cad'`, `dashboard: 'express'`;
   - `defaults.responsibilities { fees_collector: 'application', losses_collector: 'stripe' }`;
   - `configuration.merchant.capabilities.card_payments.requested: true`;
   - contact email, display name and metadata `org_id`.

   Keep the idempotency key. The probe showed that exact request succeeds for a Canadian account. **Use the preview
   version only here.** Every other call stays on the repo's pinned `2026-04-22.dahlia`, because the two versions
   disagree on the account-link body (below).
2. **Onboarding.** `v2.core.accountLinks.create` on the pinned version:
   `use_case: { type: 'account_onboarding', account_onboarding: { configurations: ['merchant'], refresh_url, return_url } }`.
   On the preview version `configurations` is rejected as unknown; on dahlia it is required. Probe-verified both ways.
3. **Readiness and the five Payouts states.** Re-derive from the v2 account
   (`retrieve` with `include: ['configuration.merchant', 'requirements', …]`):
   - "Taking payments" = `configuration.merchant.capabilities.card_payments.status === 'active'`;
   - "Needs attention" / "Setting up" come from the capability `status_details` and `requirements` (entries and
     `summary.minimum_deadline`). Read the v2 object's real shape from the installed SDK types
     (`node_modules/stripe/cjs/resources/V2/Core/Accounts.d.ts`) and from one live sandbox retrieve. Don't guess it.
   - Drop the hard-coded v1 `disabled_reason` strings. Keep the states' meanings exactly as drawn.
4. **Account events.** v2 accounts send **thin** events to an **event destination** whose scope is *Your account*:
   - subscribe to `v2.core.account[requirements].updated`,
     `v2.core.account[configuration.merchant].capability_status_updated` and `v2.core.account.closed` (closed replaces
     `account.application.deauthorized`);
   - on receipt, fetch the account and sync it, as today;
   - give it its own signing secret and env var;
   - keep the `stripe_connect_events` idempotency;
   - checkout and refund events stay on the existing Connect snapshot endpoint, unchanged.

   Stripe's event list also has thin `v1.checkout.session.*` / `v1.refund.*` events. **Test** whether one thin
   destination could carry everything before choosing two; choose on evidence and write down why.
5. **The database.** Reshape `org_payment_accounts`' v1 mirror columns for v2 facts in a new migration. 358/359 are
   dev-only and prod-pending, but never edit an applied migration. Update `DATA_DICTIONARY.md` in the same unit, fix its
   `payouts_enabled` drift, and refresh the snapshots. The dev test club has no account row yet: the 500 happened before
   the insert, so check that.
6. **Tests.** Rewrite the five-states fixtures to v2 shapes. Update the guard test's v1 method regex so the "only
   `lib/stripe-connect.ts` talks to Connect" rule covers the v2 calls.
7. **The local and staging owner steps**, written for the owner in plain words:
   - the new `stripe listen` line(s) for both scopes (the owner's CLI requires `--events` / `--all-thin` /
     `--all-snapshot`; read `stripe listen --help` rather than the docs page, which is older than the CLI);
   - the staging event destinations.

   Earlier instructions given to the owner for a single staging webhook are **withdrawn**. Say so.

## Unchanged, do not touch

Checkout Sessions on the connected account (`Stripe-Account` header + `application_fee_amount`), refunds (no
`refund_application_fee`), the fee arithmetic, the pay pages, the receipt, the Express login link (still v1 by Stripe's
design, only after onboarding), and the SaaS billing integration.

**Out of scope:** upgrading the repo to `2026-09-30.endive` (Stripe's newest major). It also touches SaaS billing and is
its own task.

## Done means

- `verify:changed` and `typecheck` pass (the change touches a shared module), and the migration is applied to dev with
  the dictionary and snapshots updated.
- `/review` has been offered. Commit in parts, each after its own checks, then confirm with the owner before committing.
- The owner's walk passes:
  1. Set up payouts → "Before you set up payouts" → Stripe's sign-up, using Stripe's test data;
  2. back on the card → Taking payments;
  3. the listen window shows the account events arriving;
  4. a tournament team pays by card (the rest of the original 12a walk);
  5. check whether `acss_debit_payments` reached `active` after onboarding. Record it for 12c; it decides nothing in
     12a.
- Plan §0d gets a "built" line with commit hashes. TODO and the PM brief are updated with positive facts, never
  "uncommitted" or "not on prod".
