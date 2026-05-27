# Billing Downgrade and Data Retention PM Brief

## Proposed Functionality

Owners should manage payment methods and invoices through Stripe, but downgrades and cancellations should happen through a FieldLogicHQ review flow before billing changes take effect. The flow should show what the customer is moving from, what the target plan allows, which data exceeds the new limit, and what action is required before confirmation.

## Why It Matters

Downgrades can remove access to active operational data. A generic subscription portal cannot explain FieldLogicHQ-specific limits well enough, especially for organizations with multiple active tournaments, league seasons, rep teams, accounting records, or public-site content.

## Customer Impact

Customers get a clear, calm path to reduce cost without accidentally losing important tournament data. If they move from Tournament Plus to Tournament, they choose the one tournament that remains active. Extra tournaments are retained in a restricted state for 90 days before permanent deletion.

Cancellation is presented separately from downgrade. A cancellation suspends the full account at the effective date, including all modules and public pages, while keeping data restorable during the retention window.

## Recommended Policy

Use soft retention first and hard deletion later. On downgrade, over-limit records should become inactive and excluded from plan usage, with public pages, registrations, communications, and edits disabled. Keep them restorable for 90 days, then hard-delete after warnings or explicit owner confirmation.

Retained tournament data should be exportable from tournament archives and through platform support. Billing should describe what happened and point users to the right operational area, but it should not become a tournament export center.

## Priority

High before live self-serve billing. It affects trust, churn recovery, support load, and data-loss risk.

## Success Criteria

- Owners cannot reach internal billing test screens.
- Owners can see the exact impact before downgrading or canceling.
- Over-limit data is never hard-deleted immediately by surprise.
- FieldLogicHQ can restore retained data if the owner re-upgrades within the retention window.
- Billing state, access state, and audit history stay consistent.
- Platform admins can see upcoming purges and extend retention periods with an audit-logged reason.
