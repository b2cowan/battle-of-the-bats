# Tournament Experience Excellence Plan

> Status: Phase H responsive hardening code pass complete; final browser sign-off pending
> Created: 2026-05-22
> Branch: dev

## Purpose

Make the Tournament and Tournament Plus experience excellent across design, functionality, and usability on desktop and mobile.

This project is the top-level experience spine for tournament work. It connects product positioning, user journeys, admin page cleanup, public tournament polish, mobile tournament-day usability, plan gates, and verification into one coordinated effort.

Archived detailed plans in this project record:

- `docs/projects/archive/TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md` defines shared tournament-admin UI primitives and page-level reformat details.
- `docs/projects/archive/TOURNAMENT_SECTION_REVIEW_PLAN.md` is the archived admin page sweep for bugs, design consistency, plan gates, Plus polish, and mobile verification.

This project completed with those child plans archived and future scorekeeper/public-mobile work split into new planning prompts.

Phase 1 journey audit findings live in `docs/projects/archive/TOURNAMENT_EXPERIENCE_PHASE_1_JOURNEY_AUDIT.md`.

## Product Manager UX Summary

Tournament organizers should feel that FieldLogicHQ gets them to the work quickly. A free Tournament owner can run one starter event with basic registration, selected-row registration updates, waitlist collection, scheduling, scores, public pages, and communication without needing training. A Tournament Plus owner sees paid capabilities presented as serious operating tools inside the workflows where they matter: custom registration control, exports, payment reminders, waitlist promotion, targeted communication, branding, cloning, and post-event reporting.

On mobile, tournament-day workflows should feel intentional, not like squeezed desktop pages. Staff should be able to check teams, update scores, review schedules, send important communication, and navigate event information without horizontal scrolling or stacked panels blocking the task.

The project should not change role access by default. Owners, admins, staff, coaches, scorekeepers, and public visitors keep their current permissions while the interface becomes clearer, faster, and more consistent.

## Experience Promise

### Free Tournament

Free Tournament should feel like:

> I can run one credible starter event without learning a complex system.

The experience should emphasize:

- Fast setup.
- Basic team registration.
- Basic selected-row registration updates and waitlist collection.
- Clear divisions, venues, schedule, scores, standings, and public pages.
- Basic all-team communication.
- FieldLogicHQ default presentation.
- Compact upgrade prompts only when the user reaches serious operations needs.

### Tournament Plus

Tournament Plus should feel like:

> I can operate a serious tournament with the tools, staff workflows, controls, branding, reports, and repeat-event support I need.

The experience should emphasize:

- Registration control.
- Custom questions and private file collection.
- Waitlist promotion and queue management.
- Payment-readiness tracking and reminders.
- Targeted communication.
- Full branding and public presentation control.
- Cloning, post-event summary, results notification, and renewal loop.

## Audience And Journey Map

### Owner / Lead Organizer

- Chooses Tournament or Tournament Plus.
- Creates the first tournament.
- Configures divisions, dates, fees, venues, registration rules, branding, staff, and public visibility.
- Reviews registrations and payment state.
- Publishes schedule and results.
- Completes, summarizes, archives, and possibly clones the event.

### Tournament Staff

- Works inside assigned tournament operations.
- Reviews registrations, teams, contacts, schedule, results, communication, and rules.
- Needs role-appropriate access and clear page context.

### Scorekeeper / Day-Of Operator

- Uses mobile or a small laptop.
- Needs quick access to schedule, game status, score entry, standings/results, and urgent communication paths.

### Coach / Team Contact

- Registers a team.
- Receives confirmation, schedule, rules, payment instructions, announcements, and results.
- May become a Team workspace or future tournament lead.

### Public Visitor

- Finds tournament status, schedule, standings, teams, rules, news, and registration.
- Should trust the public page quickly and understand the tournament is powered by FieldLogicHQ without feeling interrupted.

## Design Principles

- Records first: list-heavy pages should show the first record or useful empty state immediately after a compact header and toolbar.
- Workflow first: page structure follows what the user came to do, not the order features were built.
- Mobile is an operating mode: tournament-day mobile flows get purpose-built compression and touch targets.
- Plus value is contextual: locked features appear at the moment of need, not as broad page-blocking upsells.
- Settings are scannable: settings pages can be more detailed, but should still lead with current configuration before creation forms and marketing copy.
- Public pages build trust: public tournament pages should be clear, readable, current, and easy to navigate.
- Consistency beats decoration: shared headers, toolbars, status chips, empty states, drawers, and compact upsells should carry the experience.
- Access boundaries stay explicit: role and plan behavior should be visible and enforceable.

## Scope

### In Scope

- Tournament admin desktop and mobile UX.
- Public tournament website pages.
- Public registration and confirmation experience.
- Tournament Plus upgrade and locked-feature presentation.
- Tournament and Tournament Plus plan gate accuracy.
- Staff/settings context problems caused by re-exported org pages.
- Mobile tournament-day verification for core operations.
- Help/documentation updates needed to support the revised experience.
- UAT additions or checklist updates for Tournament and Tournament Plus journeys.

### Out Of Scope

- Online tournament payment processing. This remains a separate research task.
- Major data model changes unless a blocking UX issue requires one.
- Standalone Team implementation, except where tournament surfaces point naturally toward Team activation.
- Full redesign of non-tournament modules.
- New public marketing site redesign beyond tournament/pricing touchpoints needed for this project.

## Relationship To Existing Plans

### Child Plan: Tournament Admin UX Reformat

Use `TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md` for shared UI primitives and records-first admin page reformat guidance. Phase 0 and Registrations are already implemented; remaining phases should be executed or folded into the tournament section review.

### Child Plan: Tournament Section Design, UX & Bug Review

Use `TOURNAMENT_SECTION_REVIEW_PLAN.md` as the page-by-page audit and fix register for tournament admin. It already covers the 20 functional admin surfaces, pre-identified bugs, plan gate review, mobile verification, and final handoff.

### Child Plan: Tournament Help Documentation UX Review

Use the help documentation review after major UX changes land so help content matches the final workflows.

## Build Phases

### Phase 0 - Product Frame And Baseline

Goal: Lock the project definition before implementation spreads.

Tasks:

- [x] Create this top-level project plan.
- [x] Create the PM brief.
- [x] Confirm the "must feel excellent" journeys with the product owner.
- [x] Create a journey-based findings register that links admin pages, public pages, and plan gates.
- [ ] Decide which existing open tournament tasks remain standalone and which are child tasks of this project.
- [x] Identify baseline UAT accounts and seed data needed for free Tournament and Tournament Plus verification; Phase 2C added data-rich seeded Free/Plus tournaments and verified the core admin matrix.

Acceptance criteria:

- Product owner can explain the difference between this project and the child admin page sweep.
- TODO, memory, and active docs all point to the same project spine.

### Phase 1 - Journey Audit

Goal: Build the ground truth across the whole tournament experience.

Status: Complete as a static audit. See `TOURNAMENT_EXPERIENCE_PHASE_1_JOURNEY_AUDIT.md`.

Tasks:

- [x] Audit signup and first tournament setup for free Tournament and Tournament Plus.
- [x] Audit tournament setup: dates, divisions, venues, rules, branding, registration settings, staff, and billing/subscription.
- [x] Audit registration intake: public form, confirmation, admin review, waitlist, payment status, exports, and bulk work.
- [x] Audit schedule and scoring: schedule generation/manual entry, publish controls, mobile viewing, score entry, finalization, standings/results.
- [x] Audit communication: public News, email composer, targeting, recipient preview, and team/contact clarity.
- [x] Audit public pages: home, register, schedule, standings, teams, team profile, rules, news, and archive/summary entry points.
- [x] Audit post-event flow: completion, notification, summary, archive, clone, and renewal prompts.
- [x] Cross-check role and plan behavior throughout.

Acceptance criteria:

- Every major journey has a severity-ranked list of issues.
- Findings distinguish functional bugs, UX friction, design inconsistency, mobile issues, plan gate issues, and future enhancements.

### Phase 2 - Structural Fixes

Goal: Remove confusing or broken foundations before polish work.

Tasks:

- [x] Complete the re-export page decisions from `TOURNAMENT_SECTION_REVIEW_PLAN.md`: venues, staff/access, organization settings, and subscription context.
- [ ] Fix incorrect page titles, breadcrumbs, and route context inside tournament admin.
- [x] Confirm settings hub cards link to expected routes and do not create dead ends.
- [x] Confirm upgrade CTAs route to tournament-local subscription/billing context where appropriate.
- [x] Resolve registration boundary decisions: basic selected-row updates and waitlist collection are free; exports, payment reminders, targeting, custom fields, waitlist promotion, and reporting stay Plus.
- [x] Fix multi-org owner auth context: route-aware admin layouts now resolve the membership for the visited org slug instead of treating multiple memberships as unauthenticated.
- [x] Fix org-scoped tournament context and admin data fetches: multi-org owners now load tournaments, registrations, teams, games, divisions, venues, and pool slots for the visited org/tournament instead of drifting to the first membership.
- [x] Fix critical page wiring and plan gate bugs discovered so far, including Phase G org-scoped Plus/admin API routing.

Acceptance criteria:

- Tournament admins never land on a page that feels like the wrong module without context.
- No known broken re-export or incorrect route context remains in the tournament section.

### Phase 3 - Core Operations UX

Goal: Make daily tournament operations fast and records-first.

Tasks:

- [x] Complete Registrations browser visual verification after the Phase 1 reformat; Phase 2C data-rich QA passed for Free/Plus at 1440px and 390px.
- [x] Reformat Schedule so games or the useful empty state appear immediately after a compact toolbar; Phase 2C verified seeded games render without duplicate pool labels or page-level overflow.
- [x] Reformat Results so scoreable games appear quickly and status explanations live in a legend/popover; Phase 2C verified seeded games and score modal entry on desktop and mobile.
- [x] Reformat Communication so message composition remains primary and recipient editing is compact.
- [x] Reformat Dashboard so tournament state, blockers, and next action are visible in the first screen.
- [x] Reformat Manage Tournaments and Archives so lifecycle education does not permanently push records down.

Acceptance criteria:

- Primary operation pages show the first record or useful empty state without unnecessary scrolling on desktop.
- Mobile toolbars fit without horizontal overflow.
- Bulk actions appear only when relevant.
- Plus tools remain discoverable without occupying prime task space for free users.

### Phase 4 - Setup, Settings, And Plus Value Polish

Goal: Make setup and paid features easier to understand and use.

Tasks:

- [x] Rework Branding/Public Site settings into clearer sections with compact locked states for non-Plus users.
- [x] Rework Registration Questions so existing questions appear before the creation workflow.
- [ ] Review Event Settings for copy, grouping, saved-state clarity, and Plus results notification gate.
- [ ] Review Staff & Access for tournament-specific role context.
- [x] Review Venues, Rules, Contacts, Announcements, and Divisions for shared header/action patterns.
- [x] Confirm all touched Plus locked states use compact upsells or equivalent locked menu items instead of large repeated blocks.
- [x] Normalize design token usage, card depth, borders, and empty-state structure across the touched tournament admin settings/supporting surfaces.

Acceptance criteria:

- Settings pages are scannable and do not bury current configuration under creation forms.
- Free users understand what is locked and why, without losing access to core starter-event tools.
- Plus users can find paid tools in the settings and workflows where they naturally belong.

### Phase 5 - Public And Participant Experience

Goal: Polish the public-facing tournament path.

Tasks:

- [ ] Review public tournament homepage for trust, navigation, event status, CTA clarity, and responsive layout.
- [ ] Review public registration form, closed/not-open states, confirmation page, and coach acquisition CTA.
- [ ] Review public schedule, standings/results, teams list, team profile, rules, news, and archive pages.
- [ ] Confirm FieldLogicHQ attribution and acquisition banners are subtle and do not interrupt registration or score-entry flows.
- [ ] Confirm public pages respect free vs. Plus branding rules.
- [ ] Identify where Team workspace activation should be cross-linked later without overloading the tournament flow.

Acceptance criteria:

- Public visitors can understand tournament status and navigate to the right page quickly.
- Team contacts can register and find follow-up information without confusion.
- Public pages work cleanly on mobile.

### Phase 6 - Mobile Tournament-Day Pass

Goal: Treat mobile as a first-class operating surface for tournament day.

Tasks:

- [ ] Verify dashboard, registrations, schedule, results, communication, teams, rules, and public schedule/results at 390x844. Phase 2C verified registrations, schedule, and results for both Free and Plus.
- [ ] Confirm no horizontal overflow on primary pages. Phase 2C confirmed no page-level horizontal overflow for registrations, schedule, and results at 390x844.
- [ ] Confirm touch targets are at least 44px for primary actions.
- [ ] Confirm sticky bars, bottom nav, modals, drawers, and menus do not overlap.
- [ ] Confirm important status labels fit inside their containers.
- [ ] Log mobile-specific issues in the findings register.

Acceptance criteria:

- Core tournament-day tasks can be completed on a mobile viewport without layout breakage.
- Remaining mobile issues are either fixed or explicitly deferred with rationale.

### Phase 7 - Plan Gates, Analytics, And Help

Goal: Make the product line visible, enforceable, and explainable.

Tasks:

- [x] Cross-check tournament `hasPlanFeature()` and module entitlement gates touched by the Phase G pass against current plan definitions.
- [x] Confirm server-side gates and org-scoped auth exist for the touched Plus-only actions.
- [ ] Confirm locked-feature impressions and upgrade clicks are tracked where useful.
- [ ] Review billing/subscription copy for Tournament and Tournament Plus consistency.
- [ ] Update tournament help content after final UX changes.
- [ ] Ensure help content does not imply online payment processing exists.

Acceptance criteria:

- Plan gates are accurate, consistent, and enforced.
- Help and billing copy match the final experience.
- Platform can measure meaningful upgrade and acquisition surfaces.

### Phase 8 - Verification And Handoff

Goal: Finish with a usable, testable, and documented tournament experience.

Tasks:

- [ ] Run static checks required by the changed code paths.
- [ ] Run targeted UAT for free Tournament owner, Tournament Plus owner, tournament staff, coach/team contact, and public visitor.
- [ ] Restart the dev server after significant shared-module or file-structure changes before user browser testing.
- [ ] Confirm user browser sign-off for desktop and mobile on the key journeys.
- [ ] Update `TODO.md` and memory with completed status and deferred follow-ups.
- [ ] Archive child plans when they are complete or superseded.

Acceptance criteria:

- Free and Plus tournament journeys are verified end to end.
- Remaining issues are known, prioritized, and not hidden inside stale plans.
- The user has a clear handoff checklist for browser verification.

## Verification Matrix

### Phase 2C Core Admin Data-Rich QA

Completed on 2026-05-22 using seeded Free and Tournament Plus UAT tournaments with divisions, teams, registrations, games, venues, pool slots, and Plus custom registration answers.

- Free and Plus Registrations, Schedule, and Results returned HTTP 200 on desktop (1440px) and mobile (390x844).
- Seeded records rendered on all 12 page/plan/viewport combinations.
- No page-level horizontal overflow, no duplicate "POOL POOL" labels, no false "No tournament selected" state, and no lingering loading state.
- Results score modals opened on Free and Plus at desktop and mobile widths.
- Browser console and request-failure checks were clean.
- Final report: `test-results/tournament-phase2c/phase2c-final-check.json`.

### Phase G Plus Gate And Org-Scope Code Pass

Completed on 2026-05-22 after the Phase 2C multi-org UAT findings exposed remaining first-membership risks in Plus/admin flows.

- Tournament admin APIs for branding, schedule publish, announcements, games, teams, registration fields, exports, reminders, summary, clone/populate, setup/seal/archive, venues, divisions, contacts, dashboard, activity, and PDF settings now resolve auth against the visited `orgSlug`.
- Client calls across the tournament admin pages now pass `orgSlug` with the selected `tournamentId` where relevant, keeping Tournament and Tournament Plus users inside the org they are managing.
- Branding/Public Site now uses compact locked controls for advanced Tournament Plus features instead of a broad repeated upgrade gate.
- Verification: `pnpm.cmd tsc --noEmit`, focused ESLint on touched tournament admin/API files, `git diff --check`, dev-server restart, and `GET /platform-admin/login?next=%2Fplatform-admin` HTTP 200 with no Supabase `EACCES`.

### Phase F Design Consistency Pass

Completed on 2026-05-22.

- Added missing global aliases for the design tokens already referenced by tournament admin CSS, including surface depth, inset/raised backgrounds, subtle borders, text hierarchy, radius aliases, and common alpha tokens.
- Normalized repeated card, divider, and inset-panel styling across shared tournament admin primitives, Branding/Public Site, Event Settings, Registration Questions, Communication, Rules, Schedule generator/bracket surfaces, and Archives.
- Upgraded Archives empty states to use icons, titles, and explanatory copy instead of one muted line of text.
- Verification: `pnpm.cmd tsc --noEmit`, focused ESLint on touched TSX files, whitespace check, dev-server restart after clearing `.next`, and `GET /platform-admin/login?next=%2Fplatform-admin` passed; existing lint warnings remain.

### Phase H Responsive Hardening Code Pass

Completed on 2026-05-22.

- Manage Tournaments, Divisions, Contacts, and Archives now switch simple admin tables into labeled mobile-card rows instead of requiring horizontal table scanning.
- Mobile dialogs and action rows now have stronger viewport fit and 44px touch-target behavior.
- Communication recipient controls, Announcements cards/callouts, Branding/Event shared controls, Rules add/resource sections, Post-Event Summary actions, and shared admin header actions received responsive stacking polish.
- Verification: `pnpm.cmd tsc --noEmit`, focused ESLint on touched TSX files with zero errors, `git diff --check`, dev-server restart after clearing `.next`, and `GET /platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 with no Supabase `EACCES`; existing lint warnings remain. User browser sign-off remains pending by project workflow.

### Final Browser Sign-Off Package

Prepared on 2026-05-22.

- Primary checklist lives in `TOURNAMENT_SECTION_REVIEW_PLAN.md` under Phase H.
- Recommended orgs: `uat-test-org` for Free Tournament and `uat-plus-org` for Tournament Plus.
- Recommended viewports: desktop around `1440x1000`, mobile around `390x844`.
- Required route set: Dashboard, Manage Tournaments, Registrations, Schedule, Results, Communication, Divisions, Contacts, Announcements, Archives, Branding, Settings Hub, Event Settings, Registration Questions, Rules & Resources, and Post-Event Summary.
- Browser pass should record only material issues: horizontal overflow, unreachable actions, stuck loading/wrong-org data, broken modals, confusing Plus locks, or core content buried below excessive controls.

| Persona | Plan | Desktop | Mobile | Key Journey |
| --- | --- | --- | --- | --- |
| Owner | Tournament | Yes | Yes | Create starter tournament, register teams, publish schedule, enter results |
| Owner | Tournament Plus | Yes | Yes | Use custom fields, exports, payment reminders, waitlist promotion, targeted communication, branding, summary |
| Staff | Tournament Plus | Yes | Yes | Assigned tournament operations without unrelated org confusion |
| Scorekeeper | Both | Optional | Yes | Find games, enter scores, review results |
| Coach/contact | Both | Yes | Yes | Register team, receive confirmation, find schedule/results |
| Public visitor | Both | Yes | Yes | Navigate public tournament pages and understand status |

## Success Metrics

Product metrics to watch after launch:

- Free Tournament setup completion rate.
- Free-to-Plus upgrade clicks from locked features.
- Plus feature usage: custom fields, exports, payment reminders, waitlist promotion, targeted communication, clone, summary.
- Public registration completion rate.
- Mobile tournament admin usage and support issues.
- Public "run your own tournament" CTA clicks.
- Post-event summary views, prints, shares, and clone-next-year starts.

Qualitative signals:

- Fewer support questions about where tournament settings live.
- Fewer complaints about mobile usability on event day.
- Owners can describe the Free vs. Plus difference in workflow terms, not just slots and branding.

## Files Likely Touched In Implementation

Planning and tracking:

- `docs/projects/archive/TOURNAMENT_SECTION_REVIEW_PLAN.md`
- `docs/projects/archive/TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md`
- `TODO.md`
- `memory/`

Admin routes:

- `app/[orgSlug]/admin/tournaments/**`
- `app/[orgSlug]/admin/org/tournaments/page.tsx`
- `components/admin/tournament/**`

Public routes:

- `app/[orgSlug]/[tournamentSlug]/**`
- `components/marketing/**`

Shared product and gate helpers:

- `lib/plan-features.ts`
- `lib/plan-gating-server.ts`
- `lib/plan-module-entitlements.ts`
- `lib/help-content/tournaments.tsx`
- `lib/help-content/registrations.tsx`

Tests and UAT:

- `tests/uat/scenarios/tournament-admin.spec.ts`
- Future UAT additions for public tournament, plan gates, and mobile smoke flows.

## Open Decisions

- Should this project absorb the current `Tournament admin UX reformat` TODO line once the section review becomes the active implementation tracker?
- Which mobile browser widths should be treated as release-blocking beyond 390x844?
- Should scorekeeper flows get a dedicated lightweight mobile route, or can the existing tournament admin/results UI be made good enough?
- Should public tournament page polish happen before or after the admin section sweep?
- How much of the future Team workspace activation CTA should be introduced during this project versus the standalone Team launch work?
