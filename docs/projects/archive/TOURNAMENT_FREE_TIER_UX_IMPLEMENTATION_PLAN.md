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

### Product Decision

The free Tournament plan should remain a complete manual tournament operations product. Tournament Plus should unlock capacity, automation, premium presentation, and durable history. League and Club plans should inherit all Tournament Plus tournament features.

### Feature Treatment Matrix

| Feature | Free Tournament treatment | Tournament Plus, League, Club treatment |
| --- | --- | --- |
| Manual tournament scheduling | Visible and usable | Visible and usable |
| Automated schedule generation | Visible and locked at the point of need | Visible and usable |
| Manual playoff/bracket games and public bracket views | Visible and usable | Visible and usable |
| Playoff/bracket generator wizard | Visible and locked at the point of need | Visible and usable |
| Registration, score entry, standings, venues, rules/resources | Visible and usable | Visible and usable |
| Public news posts | Visible and usable | Visible and usable |
| Basic Communication Hub email to registered teams/contacts | Visible and usable | Visible and usable |
| Future advanced communication features such as templates, saved segments, attachments, delivery history, or larger bulk tools | Hidden until built, then visible and locked where useful | Visible and usable |
| Basic archive/close flow needed to free the single tournament slot | Visible and usable | Visible and usable |
| Permanent/sealed tournament archives and durable history | Visible and locked at the point of need | Visible and usable |
| Advanced tournament branding and premium stock logos | Visible and locked where already presented in branding/settings | Visible and usable according to each feature's minimum plan |
| Extra tournament slots and seat/official capacity benefits | Visible through usage meters and upgrade prompts | Visible as included plan capacity |

### Implementation Tasks

- [x] Add a central tournament feature entitlement helper, likely in `lib/plan-features.ts` or `lib/plan-config.ts`, with plan ranking instead of direct `planId === 'tournament_plus'` checks.
  - [x] Define `PLAN_RANK` for `tournament`, `tournament_plus`, `league`, and `club`.
  - [x] Define feature minimums for `auto_schedule`, `playoff_generator`, `sealed_archives`, and `advanced_tournament_branding`.
  - [x] Add `hasPlanFeature(planId, feature)` so `league` and `club` automatically satisfy `minPlan: 'tournament_plus'`.
- [x] Replace existing ad hoc Tournament Plus checks, including advanced tournament branding, with the central helper where practical.
- [x] Gate automated tournament scheduling:
  - [x] Keep manual schedule creation/editing available to free Tournament orgs.
  - [x] Lock generator entry points in `app/[orgSlug]/admin/tournaments/schedule/page.tsx` and related generator components.
  - [x] Enforce the same gate server-side on any generation/save API that creates generated schedules.
- [x] Gate playoff/bracket generation:
  - [x] Keep manual playoff games, score entry, and public bracket display available to free Tournament orgs.
  - [x] Lock the playoff/bracket generator wizard and any API routes that auto-create bracket structures.
- [x] Gate sealed/permanent archives:
  - [x] Keep the basic close/archive lifecycle available so a free Tournament org can free its single tournament slot.
  - [x] Lock seal/permanent-history actions and their API routes for base Tournament orgs.
- [x] Keep current Communication Hub basic sending available on free Tournament.
  - [x] Update pricing copy so basic email communication is not advertised as Plus-only.
  - [x] Reserve future advanced email features for Plus-and-above if/when built.
- [x] Update public pricing and plan comparison copy:
  - [x] Free Tournament: manual scheduling, registrations, scoring/standings, public news posts, basic team/contact email, one active tournament slot.
  - [x] Tournament Plus: automated scheduling, bracket generator, permanent sealed archives, advanced branding, three tournament slots, higher admin capacity, officials not counted toward seats.
  - [x] League and Club: make clear they include Tournament Plus tournament capabilities in addition to their league/club modules.
- [x] Keep free-plan navigation clean:
  - [x] Do not add locked-only sidebar destinations for base Tournament orgs.
  - [x] Place upgrade prompts beside useful locked actions inside Schedule, Playoffs/Brackets, Archives/Past Tournaments, Branding, and Billing/usage surfaces.
- [ ] Add focused tests for the plan helper and any server-side gates so UI locks cannot be bypassed by direct API calls.

## Verification Checklist

- [ ] New production-style signup path reaches email verification, callback, plan chooser, onboarding wizard, and admin landing without dead ends.
- [ ] First tournament wizard creates a private draft with divisions and optional venues/contact.
- [ ] Desktop and mobile publish actions enforce the same blockers.
- [ ] Public tournament pages remain unavailable for draft tournaments and available for active/completed tournaments.
- [x] Free Tournament plan allows one non-archived tournament and communicates the limit before creation or lifecycle failure.
- [x] Plus-positioned features are either available everywhere as free features or visibly locked with upgrade copy.

## PM Brief

See `TOURNAMENT_FREE_TIER_UX_PM_BRIEF.md` for the plain-language product summary, customer impact, priority, and success criteria.
