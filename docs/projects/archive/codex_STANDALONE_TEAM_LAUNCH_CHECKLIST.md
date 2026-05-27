# Standalone Team Launch Checklist

## Purpose

Use this checklist before opening the standalone Team product to external customers. It keeps the owner-facing Stripe work, platform readiness checks, and final manual smokes in one place.

## Stripe Dashboard Setup

- [ ] In Stripe sandbox, create or confirm direct Team recurring prices:
  - Team monthly: CAD $29.00 every month.
  - Team annual/seasonal: CAD $290.00 every year.
- [ ] In Stripe live mode, create or confirm the same direct Team prices.
- [ ] In Stripe sandbox, create or confirm org Team add-on recurring prices:
  - Org Team add-on monthly: CAD $29.00 every month.
  - Org Team add-on annual/seasonal: CAD $290.00 every year.
- [ ] In Stripe live mode, create or confirm the same org Team add-on prices.
- [ ] In Stripe sandbox, create new Club extra rep team recurring prices:
  - Club extra rep team monthly: CAD $19.00 every month.
  - Club extra rep team annual: CAD $190.00 every year.
- [ ] In Stripe live mode, create or confirm the same Club extra rep team prices.
- [ ] Do not reuse old CAD $20/$200 Club extra-team price IDs. Stripe prices are effectively immutable; create new prices and update FieldLogicHQ to use the new IDs.

## FieldLogicHQ Price Rows

- [ ] In Platform Admin, open Stripe Prices or Plans & Pricing.
- [ ] Enter sandbox and live price IDs for `team` monthly and annual.
- [ ] Enter sandbox and live price IDs for `org_team_addon` monthly and annual.
- [ ] Enter sandbox and live price IDs for `rep_team` monthly and annual.
- [ ] Run Platform Admin > Dev Tools > Team checkout readiness.
- [ ] Confirm the readiness check passes for app URL, webhook secret, Team availability, Stripe environment, and Team price metadata.

## Manual Sandbox Smoke

- [ ] Direct Team checkout provisions a `team_direct` workspace and active Team entitlement.
- [ ] Tournament claim checkout provisions the Team workspace, records source tournament/team IDs, and consumes the claim.
- [ ] Team workspace can create one non-archived free-tier tournament and is blocked from a second active tournament.
- [ ] Org Team add-on checkout moves a linked Team to `org_team_addon` billing without expanding Basic sharing.
- [ ] Club extra-team billing preview and Stripe quantity reflect the new CAD $19/$190 extra-team pricing.
- [ ] Direct Team cancellation and payment-failure simulation update workspace subscription status and entitlement state as expected.
- [ ] Mobile public pricing, Team signup, coach overview, schedule attendance, and lineup flows receive visual sign-off.

## Customer-Facing Documentation

- [ ] Coach help explains what Team includes.
- [ ] Coach help explains season rollover and preserved history.
- [ ] Coach and org help explain the included one-slot free-tier local tournament capability and Tournament Plus boundary.
- [ ] Coach and org help explain Basic org linking, org billing transfer, and platform-assisted ownership transfer.
- [ ] Org help explains Team add-ons versus Club.
- [ ] Platform-admin help includes Team launch readiness and ownership transfer SOPs.

## Release Notes

- Team is a coach-first workspace for one competitive team at CAD $29 monthly or CAD $290 seasonal/annual.
- Org Team add-ons let a linked organization pay for a coach-operated Team without taking roster, document, accounting, billing, ownership, or org-wide rep-team admin access.
- Club remains the multi-team operating layer. It includes the first three active rep teams and uses lower extra-team pricing for additional org-owned rep teams.
- Team workspaces include one free-tier local tournament slot for simple round robins, scrimmages, or exhibition weekends. Tournament Plus features remain gated to Tournament Plus or higher org plans.
