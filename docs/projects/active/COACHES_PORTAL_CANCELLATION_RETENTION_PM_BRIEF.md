# PM brief — a cancelled Coaches Portal is kept for a year, and the email says so

**Priority:** High (it's a billing/trust surface, and every paying coach who leaves sees it). **Status:** built 2026-09-24, walk owed.
Plan: [COACHES_PORTAL_CANCELLATION_RETENTION_PLAN.md](COACHES_PORTAL_CANCELLATION_RETENTION_PLAN.md)

## What changes for the coach

- The cancellation email names the team once ("Your **Hawks** Coaches Portal has been cancelled") and
  gives a date: "Your team is kept until September 24, 2027."
- **Resubscribe** brings back the same team. It used to open the signup for a brand-new portal, so a
  coach could have paid for a second, empty one.
- A cancelled team is kept for **a year**, not 90 days. The coach gets a reminder **30 days** before the deadline.
- One email per cancellation. An in-app cancel used to send two.
- A subscription that ends on Stripe's side (a card that fails for good, a cancel in Stripe) now gets
  the same deadline and reminder. Before, it got no deadline at all.

## Why

Coaching runs on seasons. A coach cancels when the season ends and comes back for next year's
tryouts, 6 to 8 months later. At 90 days we'd flag their team for removal over the winter, before
they return, and throw away the season-to-season history that's the main reason to come back.

## Who is affected

Standalone Coaches Portal owners only. Club, league and tournament accounts keep 90 days and a 14-day warning.

## Success looks like

- Every cancelled Coaches Portal has exactly one deadline, one year out, however it ended.
- Coaches who resubscribe land on reactivation, not a new portal. No duplicate portals.
