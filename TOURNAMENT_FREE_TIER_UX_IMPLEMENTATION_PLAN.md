# Tournament Free Tier UX Implementation Plan

## Goal

Improve the first-time Tournament-plan experience for a softball/baseball organizer from signup through first usable tournament. This plan is based on the source review of signup, onboarding, tournament creation, tournament admin, public tournament pages, plan configuration, and pricing copy.

## Product Outcomes

- A new organizer understands that they can start free and what the free plan includes.
- First tournament setup uses plain language and produces a clear draft-to-publish path.
- Core tournament operations either work end to end or are clearly labelled as not yet available.
- Free-tier limits and Plus upgrades are consistent across pricing, onboarding, navigation, and feature gates.

## Phase 1 - Trust, Safety, and Broken-Path Fixes

- [x] Replace the standalone tournament manager create modal with a reusable tournament setup wizard based on the onboarding wizard.
- [x] In the wizard venue step, show existing venues/diamonds that can be applied to the new tournament, while still allowing new venues to be created.
- [x] Expose tournament venues inside the tournament admin at `/admin/tournaments/venues` and keep the old org-level page as a compatibility path.
- [x] Route mobile tournament activation in `components/admin/AdminBottomNav.tsx` through the same server activation path used by desktop.
- [x] Ensure lifecycle checks always use `app/api/admin/tournaments/route.ts` for date, division, contact email, open division, and tournament-slot limit validation.
  - [x] Server-side creation and lifecycle checks count every non-archived tournament against the free-plan slot limit.
  - [x] Mobile activation routes through the same API path as desktop.
- [x] Add authentication, authorization, and org/tournament recipient validation to `app/api/send-message/route.ts`.
- [x] Map `contact_email` to `contactEmail` in `lib/tournament-context.tsx` so the active notification contact displays correctly.

## Phase 2 - Signup and Onboarding Clarity

- [x] Update signup verification copy in `app/auth/signup/page.tsx` to explain that the organization is created but onboarding requires email confirmation in production.
- [x] Simplify the confirmation handoff in `app/auth/signup-confirm/page.tsx` so the user does not feel like they must verify twice.
- [x] Revise first-run plan chooser copy in `app/[orgSlug]/admin/onboarding/page.tsx` to say the organizer starts on the free Tournament plan and only upgrades for more capacity or automation.
- [x] Replace technical onboarding labels in `app/[orgSlug]/admin/onboarding/page.tsx`: "URL slug" -> "Public link", "Capacity" -> "Max teams", and "Pools" -> "Pools or groups".
- [x] Add short helper text to division setup explaining age groups, team caps, and pool selection in organizer language.

## Phase 3 - Draft-to-Publish Checklist

- [x] Add a draft checklist panel to `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`.
- [x] Reuse the existing publish blockers from `app/api/admin/tournaments/route.ts`: dates, at least one division, tournament contact email, and at least one open division.
- [x] Show the free-plan tournament-slot limit near creation and publish controls in `app/[orgSlug]/admin/org/tournaments/page.tsx`.
- [x] Keep draft tournaments private, but replace generic public-site placeholder messaging with tournament-specific guidance in `app/[orgSlug]/page.tsx`.
- [x] Make the public preview link explain whether the page is private draft, active, or completed.

## Phase 4 - Core Operations Cleanup

- [x] Registration: show external payment expectations from the existing fee schedule and remove payment-link language in `app/[orgSlug]/[tournamentSlug]/register/page.tsx`.
- [x] Registration: make admin payment status respect tournament-wide vs. per-division fee mode in `app/[orgSlug]/admin/tournaments/teams/page.tsx`.
- [x] Score entry: make `app/[orgSlug]/admin/tournaments/results/page.tsx` submit scores through `app/api/admin/games/route.ts` so finalization rules are respected.
- [x] Announcements: add a "post only" vs "post and notify" distinction, or wire notification delivery into the announcement flow.
- [x] Communication: complete division/team recipient targeting in `app/[orgSlug]/admin/tournaments/communication/page.tsx`, or hide incomplete filters.
- [x] Mobile nav: add Rules & Resources, Communication, and Past Tournaments to `components/admin/AdminBottomNav.tsx`.
- [x] Tournament-tier IA: expose tournament-critical org admin tools from the tournament workspace, including members/staff, subscription, and score/settings controls where appropriate.

## Phase 5 - Plan Guardrails and Upgrade Consistency

- [ ] Decide whether automated scheduling, playoff bracket generation, email communication, and archives belong in free Tournament or Tournament Plus.
- [ ] Align `app/pricing/page.tsx`, `components/PricingSection.tsx`, `lib/plan-config.ts`, and `components/admin/AdminSidebar.tsx` with that decision.
- [ ] If these features are Plus-only, add explicit feature-level gates instead of relying only on module entitlements.
- [ ] Add upgrade prompts at the point of need for locked Plus features, linking to `app/[orgSlug]/admin/org/billing/page.tsx`.
- [ ] Keep paid non-tournament modules hidden for Tournament-plan orgs unless a clear upgrade entry point is added.

## Verification Checklist

- [ ] New production-style signup path reaches email verification, callback, plan chooser, onboarding wizard, and admin landing without dead ends.
- [ ] First tournament wizard creates a private draft with divisions and optional venues/contact.
- [ ] Desktop and mobile publish actions enforce the same blockers.
- [ ] Public tournament pages remain unavailable for draft tournaments and available for active/completed tournaments.
- [x] Free Tournament plan allows one non-archived tournament and communicates the limit before creation or lifecycle failure.
- [ ] Plus-positioned features are either available everywhere as free features or visibly locked with upgrade copy.

## PM Brief

See `TOURNAMENT_FREE_TIER_UX_PM_BRIEF.md` for the plain-language product summary, customer impact, priority, and success criteria.
