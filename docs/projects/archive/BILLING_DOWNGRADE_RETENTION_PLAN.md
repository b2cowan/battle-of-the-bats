# Billing Downgrade and Data Retention Plan

## Goals

- Keep Stripe payment management available without exposing internal billing test tools.
- Replace generic downgrade/cancel behavior with an in-app review flow that understands FieldLogicHQ plan limits.
- Protect customers from accidental data loss while still enforcing limits after a downgrade or cancellation.

## Product Decisions

- Configure Stripe Customer Portal for payment methods and invoices only where possible.
- Route downgrades and cancellations through FieldLogicHQ before changing the Stripe subscription. Stripe subscription scheduling/reconciliation is tracked in [STRIPE_INTEGRATION_PLAN.md](STRIPE_INTEGRATION_PLAN.md).
- Soft-retain over-limit data first; hard-delete only after a retention window, explicit confirmation, or account-deletion policy.
- Treat canceled subscriptions as paid-through until period end, then suspend the full account. Cancellation is not a downgrade to the free Tournament plan.

## Recommended Downgrade Flow

1. Owner chooses a target plan from the Subscription page.
2. App runs a downgrade preflight against active usage: tournaments, seats, and module-specific records.
3. If usage fits, owner confirms the downgrade, normally scheduled for the next billing renewal.
4. If usage exceeds the target plan, owner resolves each limit before confirmation.
5. App records an audit event and applies the FieldLogicHQ access/retention state.
6. Stripe subscription scheduling/reconciliation is handled by the Stripe integration workstream.

## Tournament Limit Handling

For Tournament Plus to Tournament:

- Target limit: 1 non-archived tournament.
- If the org has more than 1 non-archived tournament, show a required picker.
- Owner selects the tournament to keep active.
- Other selected-over-limit tournaments move to a retained inactive state at downgrade effective time.
- Retained tournaments are excluded from active tournament count and cannot accept registration, publish public pages, send communications, schedule games, or edit results.
- Re-upgrading during the retention window restores retained tournaments.

## Soft vs. Hard Delete Recommendation

Use a two-stage lifecycle:

- `active`: normal access and counts toward plan limits.
- `retained_inactive`: hidden from normal admin workflows, excluded from plan limits, read-only/exportable for owners, restorable by re-upgrade.
- `pending_purge`: retention window expired; final warning sent.
- `purged`: hard-deleted or anonymized according to schema and legal requirements.

Retention window: 90 days for billing downgrades and cancellations. Shorter deletion can be offered only as explicit owner-confirmed account deletion.

## Export and Support Access

Retained tournament data should be exportable from tournament archives and by platform support. Billing should explain the retention outcome and link owners back to the relevant archive/export area, but it should not become the place where customers expect to export tournament data.

## Cancellation Handling

Cancellation and downgrade-to-free are separate actions:

- Downgrade keeps the organization active on a lower plan and requires the owner to resolve plan-limit conflicts.
- Cancellation suspends the full account at the effective date.
- Suspended accounts shut down all modules and public pages.
- Canceled-account data remains restorable for 90 days unless the owner explicitly requests earlier account deletion.

## Platform Admin Retention Controls

Platform admins need a retention queue that shows data approaching purge, including org, retained record type, retention deadline, and days remaining. Admins can extend retention periods for support cases, with required reason capture and audit logging.

## Implementation Tasks

- [x] Add a downgrade preflight API that returns current usage, target limits, blockers, and required choices.
- [x] Add a downgrade review UI on the billing page.
- [x] Add storage for downgrade intents, selected retained records, effective date, and retention deadline.
- [x] Add tournament retention state or equivalent archive/deactivation fields.
- [x] Update tournament queries so retained inactive tournaments are not public, editable, or counted against limits.
- [moved] Add Stripe reconciliation for scheduled downgrades/cancellations in [STRIPE_INTEGRATION_PLAN.md](STRIPE_INTEGRATION_PLAN.md).
- [x] Add audit events for downgrade intent creation, confirmation, retention, and retention extension.
- [x] Add notification emails before retention expiry and pending-purge transition.
- [ ] Add hard purge execution and purge audit events after pending-purge review policy is finalized.
- [x] Add archive export surfaces for retained tournament data.
- [x] Add platform-admin retention queue, deadline extension action, and audit logging.

## Implementation Notes

- First implementation slice added migration `038_billing_retention.sql`; applied in dev and production.
- Downgrades currently apply the FieldLogicHQ plan/limit change immediately and move over-limit tournaments to archived retention. Stripe subscription scheduling is tracked in the Stripe integration phase.
- Cancellation currently suspends the account immediately in-app by setting `subscription_status = 'canceled'`, disabling public org visibility, archiving non-archived tournaments into retention, and shutting module entitlements off.
- The Stripe `customer.subscription.deleted` webhook now follows the cancellation/suspension model instead of reverting the org to the free Tournament plan.
- Platform admins can see records due within 30 days at `/platform-admin/retention` and extend a retained record by 30 days with a required reason.
- Retention expiry processing adds a 14-day owner warning, moves expired records into `pending_purge`, sends the pending-purge notice, and keeps hard deletion as a separate follow-up.
- Migration `039_billing_retention_expiry.sql` adds notice and pending-purge timestamps; applied in dev and production.

## Resolved Decisions

- Retained tournament data is exportable from archives and platform support, not billing.
- Cancellation is full account suspension; downgrade-to-free is a separate action.
- Retention window is 90 days.
- Platform admins can extend retention and see data approaching purge.
