# Tournament Signup Experience - Phase 4 PM Brief

Status: Implemented; pending browser verification
Created: 2026-05-13
Scope: Keep new organizations in a guided, plan-aware onboarding flow after signup.

## Product Summary

Phase 4 improves the first screen a new owner sees after creating an organization. Instead of sending the owner from onboarding into the full billing/admin section when they click "View plans," the signup flow now sends them directly to plan selection.

The organization is still provisioned safely in the database as a free Tournament workspace first, but the UI does not present that as a completed customer choice. The owner must actively select a starting plan before the setup checklist appears. They can continue free, or choose a paid plan. If they choose a paid plan, checkout returns them to onboarding instead of dropping them into Billing.

## Why This Matters

A new customer is still deciding whether FieldLogicHQ feels clear and trustworthy. Sending them into the complete company admin billing page too early creates unnecessary friction and makes the guided setup feel interrupted.

The onboarding screen should answer one question at a time:

1. What plan am I starting with?
2. What should I set up first for that plan?
3. When am I ready to enter the full admin dashboard?

## Functionality Changes

- "View plans" now opens an onboarding plan modal instead of navigating to Billing.
- New signup now lands on plan selection before the setup checklist.
- The backend still provisions a safe free workspace, but the UI requires an explicit plan choice.
- Monthly pricing is shown by default.
- Plan cards include richer feature lists to reinforce higher-tier value.
- The onboarding checklist changes based on the selected plan:
  - Tournament and Tournament Plus: create the first tournament.
  - League: create a house league season and set up the public organization page.
  - Club: show broader club setup steps such as public site, house league, accounting, and rep teams.
- The invite-member step was removed from first-run onboarding.
- The modules upsell prompt was removed from first-run onboarding.
- Paid plan checkout now supports returning to onboarding after success or cancellation.

## Customer Impact

New tournament operators stay inside the step-by-step setup path. League and club customers are not pushed through a tournament-first setup that may not match why they signed up.

## Success Criteria

- Clicking "View plans" from onboarding opens a modal, not Billing.
- New signup first sees plan selection, not a pre-selected plan card.
- A free-tier tournament operator can continue setup without choosing a paid plan.
- Monthly pricing appears before annual pricing.
- Selecting a paid plan returns the owner to onboarding after checkout or local dev mock upgrade.
- Invite-member and module-upgrade prompts no longer appear on the initial onboarding page.
- The visible setup steps match the current plan.
