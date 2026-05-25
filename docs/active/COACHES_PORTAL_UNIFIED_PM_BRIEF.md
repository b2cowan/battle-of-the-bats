# Coaches Portal Unified Product PM Brief

**Created:** 2026-05-25  
**Status:** Active canonical brief  
**Full plan:** `docs/active/COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md`

## What This Is

FieldLogicHQ should have one Coaches Portal, not separate experiences for tournament participants, standalone team buyers, and Club coaches.

The portal has two entitlement levels:

- **Basic Coaches Portal:** included for tournament team contacts. Coaches can sign in, see every tournament registration tied to them, review current and historical tournament records, check status, see schedules when published, and receive platform-owned upgrade CTAs.
- **Premium Coaches Portal:** the paid one-team product previously called Team, plus org-paid and Club-included coach access. Coaches keep the tournament history view and gain roster, schedule, attendance, lineups, dues, budget, documents, season setup, org linking, and billing tools.

The customer promise is simple: a coach starts with tournament records and upgrades into full team operations without changing accounts or losing history.

## Why It Matters

Tournament participants are one of FieldLogicHQ's warmest acquisition channels. A coach registers a team, experiences the platform, and comes back for schedules, status, and results. That should become the front door to the paid Coaches Portal.

The previous docs described this as two intertwined projects:

- a lightweight tournament coach dashboard
- a standalone Team workspace subscription

Those are now one project. The lightweight tournament experience is the free/basic state of the same Coaches Portal. The paid product is the premium state of that same portal.

## Customer Impact

Coaches get one login and one place to return:

1. Register a team for a tournament.
2. Create an account or sign in.
3. See that tournament in the Coaches Portal.
4. Register for another tournament later and see both events together.
5. Upgrade to the premium Coaches Portal when they want season tools.
6. Keep their tournament records after upgrade.
7. If they cancel the paid subscription, premium tools stop being actively available, premium data is archived for 90 days, and basic tournament access stays available.

Tournament organizers benefit because coaches can self-serve status, schedule, and announcement questions. FieldLogicHQ benefits because upgrade prompts belong to the platform experience instead of relying on organizers to sell another product.

## Role And Access Differences

| User type | Portal access |
| --- | --- |
| Tournament-only coach | Basic Coaches Portal: tournament registrations, statuses, schedules, announcements, historical records, and upgrade CTAs. |
| Paid standalone coach | Premium Coaches Portal for one team, plus all basic tournament history. |
| Org-billed coach | Premium Coaches Portal for the linked team while the org pays; Basic sharing remains unless ownership transfer is approved. |
| Club coach | Premium Coaches Portal through normal Club rep-team assignment and Club entitlement. |
| Canceled paid coach | Returns to Basic Coaches Portal. Premium tools are unavailable, premium data is archived for 90 days, and tournament records remain. |
| Tournament organizer | Resend access links only. Product upgrade CTAs are platform-owned. |

## Priority

High. This is the product bridge between tournament acquisition and paid coach/team operations. It also cleans up naming before public launch: "Team" remains a technical workspace concept where needed, but the public product is Coaches Portal.

## Success Criteria

- One canonical Coaches Portal route and product story replaces separate tournament dashboard and Team subscription stories.
- A tournament coach account can see all current and historical tournament registrations across organizations.
- Premium Coaches Portal upgrade adds functionality in place; it does not create a separate customer experience.
- Cancellation removes active premium functionality, archives premium data for 90 days, and preserves basic tournament history.
- Club and org-billed coach access use the same portal surface as standalone paid coaches.
- Public copy uses Coaches Portal, not Team, except where internal table names or legacy compatibility are unavoidable.
- The shipped Tournament Coach Portal doc remains as implementation history; old standalone Team docs are archived or superseded by the unified plan.
