# Tournament Owner/Admin Mobile Implementation Plan

Started: 2026-05-24

## Purpose

Implement the owner/admin mobile improvements identified in `docs/active/codex_TOURNAMENT_OWNER_MOBILE_REVIEW.md`, starting with shared mobile foundations and the highest-risk base Tournament workflows.

## Product Manager UX Summary

After this work, a base Tournament owner using a phone should be able to enter admin reliably, finish tournament setup, manage registrations, build the schedule, enter results, and understand their plan without fighting crowded controls or confusing upgrade locks. Base Tournament remains a complete manual event tool. Tournament Plus is presented as an operations upgrade for automation, exports, advanced branding, cloning, targeted communication, and reporting.

## Method

Use a workflow-first, shared-foundation-first approach:

1. Fix shared mobile foundations that affect multiple pages.
2. Patch the highest expected mobile-use workflows.
3. Improve base setup and subscription clarity.
4. Polish lower-frequency lifecycle and Plus-gated surfaces.

This avoids repeating the same mobile fixes page by page.

## Source Review

- Review document: `docs/active/codex_TOURNAMENT_OWNER_MOBILE_REVIEW.md`
- PM brief: `docs/active/codex_TOURNAMENT_OWNER_MOBILE_PM_BRIEF.md`
- Active design tracker: `docs/active/agent_TOURNAMENT_DESIGN_REVIEW.md`
- Product memory: `memory/tournament-experience-excellence.md`
- Plan gates: `lib/plan-features.ts`

## Phase 0 - P0 Mobile Foundation

Goal: remove the highest-risk mobile blockers before doing page-specific polish.

Tasks:

- [x] Offset shared selected-row action bars above the fixed admin bottom nav on mobile.
- [x] Raise shared mobile admin touch targets to at least 44px for toolbar controls, chips, menu items, and row actions.
- [x] Convert tournament Venues to a mobile-card table pattern and preserve org context in venue API calls.
- [x] Add an actionable fallback for admin entry if startup routing hangs or fails.
- [x] Remove or guard mobile bottom-nav `Set as Live` behind the dashboard/manage activation flow.
- [x] Make locked toolbar menu items tappable so mobile users get a visible Plus explanation.

Acceptance criteria:

- Registration selected-row actions are not covered by the bottom nav at 390x844.
- Shared tournament toolbar controls are comfortable touch targets on mobile.
- Venues has no horizontal table dependency at 390px.
- Multi-org owners keep the visited `orgSlug` when using Venues.
- `/admin` does not leave users stuck on "Opening tournament management..." without a path forward.
- Mobile More no longer performs casual tournament activation.
- Locked toolbar actions provide visible mobile feedback.

## P0 Implementation Status - 2026-05-24

Completed:

- Shared tournament toolbar/mobile controls now have larger mobile touch targets.
- Shared selected-row action bars are offset above the fixed admin bottom nav.
- Locked toolbar menu items remain visibly locked but can trigger the existing mobile-visible upgrade/context action.
- Mobile More now sends inactive tournaments to the dashboard/launch checklist instead of activating directly.
- Tournament-only admin entry now shows a fallback choice set if startup routing fails or stalls.
- Venues now keeps org context in venue API calls and uses a mobile card table pattern at narrow widths.

Verification:

- `git diff --check` passed for touched implementation files.
- `.\node_modules\.bin\tsc.cmd --noEmit --pretty false` passed.
- `npm.cmd run lint -- components/admin/tournament/TournamentAdminUI.tsx components/admin/AdminBottomNav.tsx app/[orgSlug]/admin/AdminHubClient.tsx app/[orgSlug]/admin/org/diamonds/page.tsx` passed.
- Dev server restarted at `http://localhost:3000`.
- `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returned HTTP 200.
- Dev log scan found no Supabase `EACCES` failures.

Browser UAT checklist for this slice:

- At 390x844, select registrations and confirm bulk actions sit above the bottom nav.
- Tap a Plus-locked toolbar action and confirm visible upgrade/context feedback appears.
- Open mobile More for a draft tournament and confirm the CTA opens the dashboard/launch checklist.
- Open Venues at 390x844 and confirm rows are card-like, readable, and action buttons are tappable.
- Visit `/admin` for a Tournament-only org and confirm it either redirects or offers fallback routes if startup status cannot load.

## Phase 1 - Core Mobile Workflows

Goal: make the highest expected mobile-use pages feel operational, not squeezed.

Tasks:

- [ ] Registrations/Teams: verify bulk bar, filters, add team, payment lock, waitlist actions, and workspace invite placement.
- [ ] Schedule: verify toolbar density, publish flow, manual add/edit game modal, and locked automation copy.
- [ ] Results: verify score entry, scorekeeper link, status filters, and score modal touch targets.
- [ ] Dashboard: reframe clone and branding prompts so base tasks stay dominant.
- [ ] Mobile More: group setup, tournament-day, history, and account routes for scanning.

Acceptance criteria:

- First useful record, task, or honest empty state appears without excessive setup/upsell content.
- Page-level horizontal overflow is absent at 375, 390, and 430px.
- Base-plan operations are primary; Plus locks are compact and contextual.

## Phase 2 - Base Setup Completeness

Goal: make base tournament setup findable from mobile.

Tasks:

- [ ] Expand Settings hub or add related setup links for Divisions, Venues, Contacts, Rules, Public Pages, and Announcements.
- [ ] Make Branding/Public Pages copy lead with included public page visibility for base users.
- [ ] Make Contacts, Rules, Announcements, and Divisions pass the browser checklist on mobile.
- [ ] Decide whether Dashboard or Settings owns the complete setup hub role.

Acceptance criteria:

- A base owner can find every setup task without memorizing the More menu.
- Public Pages is clearly included on base Tournament.
- Plus branding is an enhancement, not the main setup story.

## Phase 3 - Plan Gating And Subscription Clarity

Goal: make Tournament Plus gates understandable before interaction.

Tasks:

- [ ] Make locked Settings cards tappable to visible locked-state explanations.
- [ ] Show registration exports as Plus-gated before a base user taps Export.
- [ ] Label, hide, or contextualize Summary for base-plan completed tournaments.
- [ ] Put free archived tournament history before sealed-record Plus value on Archives.
- [ ] Lead the tournament subscription route with Tournament vs Tournament Plus before broader plan comparisons.

Acceptance criteria:

- Base users understand why a feature is locked and what Plus adds.
- Base work is not interrupted by surprise upgrade pages.
- Team is not presented as the primary upgrade path from base Tournament.

## Phase 4 - Browser Verification And Handoff

Goal: prepare a clean mobile sign-off pass.

Tasks:

- [x] Run focused TypeScript/lint checks for touched files.
- [x] Run `git diff --check` for touched files.
- [x] Restart the dev server if required by the repo restart rule.
- [x] Provide user-owned browser verification checklist with direct routes and scenarios.
- [x] Update this plan and TODO with verification status.

Acceptance criteria:

- Non-browser verification passes or known unrelated failures are documented.
- User has a concise mobile UAT checklist for 390x844 and adjacent widths.
- No dev server is left in a broken or stale-cache state.

## Open Decisions

- Should Dashboard or Settings be the complete setup hub?
- Should Summary appear in base mobile navigation with a Plus label, or only as a contextual completed-event upsell?
- Should locked Plus controls open a shared bottom sheet or route to subscription pages?
- Should Workspace Invite move out of the mobile registration selection bar?
- Should Team be hidden entirely from tournament-local subscription comparisons?
