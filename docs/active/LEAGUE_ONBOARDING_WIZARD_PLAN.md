# League Onboarding Wizard Plan

## Goal

Create a first-run League and Club onboarding flow that guides owners through the house league setup path before they land in the general admin workspace. The experience should mirror the tournament onboarding wizard where that pattern helps: draft-first setup, step-by-step modal progress, save at final review, and a remaining-steps dashboard.

## UX Direction

- League and Club owners are guided into creating a draft house league season.
- The wizard collects season basics, divisions, registration settings, and an optional tournament setup choice.
- Saving the wizard creates the league season as a draft and keeps registration closed until the admin explicitly opens it.
- The onboarding page remains useful after dismissing the wizard by showing remaining setup steps and direct CTAs.
- Tournament setup is optional from league onboarding and opens the existing tournament setup wizard from Manage Tournaments.
- The normal House League create-season modal should expose the same registration settings as onboarding so both entry points feel consistent.

## Task Checklist

- [x] Extend startup task tracking for league setup tasks.
- [x] Add a League/Club first-run wizard to `app/[orgSlug]/admin/onboarding/page.tsx`.
- [x] Add house league dashboard CTAs and optional tournament setup entry.
- [x] Align the regular House League create-season modal with onboarding registration fields.
- [ ] Browser verification: League signup to season creation, optional tournament branch, and House League create-season modal.

## Notes

- League onboarding intentionally saves the season as `draft`; opening registration remains an explicit lifecycle action on the season page.
- Divisions are created after the season is saved, using the existing House League divisions API.
- The optional tournament branch routes to `/{orgSlug}/admin/tournaments/manage?create=1`, which opens the reusable tournament setup wizard.
