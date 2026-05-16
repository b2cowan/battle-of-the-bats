# Tournament Signup Experience Fixes

Status: Phases 1-4 implemented; pending browser verification
Created: 2026-05-13
Scope: Improving the experience for a new organization signing up to run its first tournament.

## Implementation Log

### 2026-05-13 - Phase 1

Implemented:
- Fixed tournament dashboard quick links to target `/admin/tournaments/...`.
- Hid draft/archived tournaments from public tournament routes.
- Blocked public registration unless the tournament status is `active` and divisions exist.
- Added server-side registration guards for tournament status, division ownership, and closed divisions.
- Replaced demo-specific signup, tournament setup, public page, rules, and email copy with neutral FieldLogicHQ language.
- Hid seed/test controls unless `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`; the setup API also ignores seed requests unless that flag is enabled.
- Fixed pool setup so a division with `poolCount: 0` no longer creates a default pool.

Still pending:
- Browser verification of the full signup-to-public-registration path.

### 2026-05-13 - Phase 2

Implemented:
- Added first-tournament setup presets for youth, adult, and custom division structures.
- Made custom division creation possible directly in the new tournament flow.
- Clarified that pools are optional and kept pool controls hidden unless enabled per division.
- Added inline tournament URL availability checks in the setup modal.
- Added server-side slug validation and duplicate guards for tournament create/update.
- Added a database migration for unique non-archived tournament slugs per organization.
- Added a setup-oriented success state with next actions after tournament creation.
- Made onboarding tournament-first so a solo organizer can complete setup after creating a tournament.

### 2026-05-13 - Phase 3

Implemented:
- Centralized public tournament homepage rendering so live pages and admin previews share the same availability logic.
- Added public registration status messaging for open, waitlist, closed, not-open, and completed states.
- Updated public hero and footer CTAs to avoid showing registration as the primary action when registration is unavailable.
- Added an authenticated admin draft preview route for draft tournaments.
- Added preview actions from the tournament management table.
- Added activation readiness checks for tournament dates, divisions, contact email, and open divisions.
- Added matching server-side activation guards in the admin tournament API.

### 2026-05-13 - Hardening Pass

Verified:
- Cleared stale `.next` generated route/type cache after adding the admin preview route.
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- `npm.cmd run build` passes after allowing network access for Google Font fetching.
- Focused ESLint passes for the tournament signup, setup, preview, public page, and registration API files when ignoring existing repo-wide legacy strict-rule debt.
- Reviewed slug uniqueness migration. Before applying it in production, run the included duplicate-slug preflight query and resolve any returned rows.

Known remaining verification:
- Full repo lint is still blocked by existing unrelated strict-rule debt across legacy files.
- Browser verification of the full signup-to-public-registration path remains pending.

### 2026-05-13 - Phase 4

Implemented:
- Changed onboarding "View plans" to open an in-page plan chooser instead of navigating to the full Billing page.
- Changed new signup redirect so plan selection is the first post-signup screen.
- Kept new organizations provisioned immediately on the free Tournament plan in the database, while requiring an explicit UI plan choice before showing setup steps.
- Defaulted plan selection to monthly pricing.
- Expanded plan card feature lists so higher tiers can re-state their value during onboarding.
- Made onboarding steps plan-aware so Tournament plans focus on tournament setup, while League and Club plans show module-specific setup steps.
- Removed the invite-member step from first-run onboarding.
- Removed the modules upgrade prompt from first-run onboarding.
- Updated paid plan checkout so signup/onboarding plan selection returns to onboarding instead of Billing.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for signup, onboarding, and checkout route changes.
- `npm.cmd run build` passes with network access for Google Font fetching.

### 2026-05-13 - Walkthrough Blocker Fix

Finding:
- After creating an organization, the owner could land on `/{orgSlug}/admin/onboarding?choosePlan=1` with a blank main screen and browser 403 errors instead of seeing the plan chooser.

Implemented:
- Added a server-backed `/api/org-context` route so client org context no longer depends on direct browser reads from `organization_members` and `organizations` during first-run onboarding.
- Seeded the org admin `OrgProvider` from the authenticated server layout with the current organization, role, and capabilities.
- Kept the onboarding plan chooser as the first post-signup screen while making the org context resilient to browser Supabase RLS/table-grant failures.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for `app/api/org-context/route.ts`, `lib/org-context.tsx`, and `app/[orgSlug]/admin/layout.tsx`.

### 2026-05-13 - Walkthrough Onboarding Flow Polish

Findings:
- The first tournament management page showed too much explanatory text before the empty state.
- The onboarding "Create your first tournament" action sent owners to the tournaments list instead of opening the create modal.
- After tournament creation, onboarding needed useful optional setup steps beyond the binary "tournament exists" completion state.

Implemented:
- Replaced the long lifecycle help card with a compact lifecycle strip.
- Replaced the empty first-run help callout with a tighter empty prompt and direct create button.
- Changed onboarding's create-tournament CTA to `/{orgSlug}/admin/org/tournaments?create=1`.
- Added support for the tournaments page to auto-open the New Tournament modal when `?create=1` is present.
- Added optional post-tournament onboarding steps for reviewing divisions/registration, adding venues, adding contacts, previewing/activating, and inviting staff when helpful.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint remains blocked by existing strict-rule debt in touched legacy files: pre-existing `any` usage in the tournament management page and a pre-existing `react-hooks/set-state-in-effect` issue in onboarding.

### 2026-05-13 - Walkthrough Create-Modal And Console Cleanup

Findings:
- `?create=1` opened the New Tournament modal after the tournaments page first rendered, causing a visible page-then-modal transition.
- The tournament management page logged Supabase 401/`42501` errors because it queried `tournament_archives` directly from the browser.

Implemented:
- Changed the tournaments page so `?create=1` initializes the New Tournament modal and default form state on first render instead of using a post-render effect.
- Added an authenticated `/api/admin/tournament-archives` route backed by the server admin client.
- Updated admin tournament management and admin archives pages to fetch archive data through the new admin API route.
- Removed explicit `any` usage in touched tournament/archive handlers so focused lint can pass.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for `app/api/admin/tournament-archives/route.ts`, `app/[orgSlug]/admin/org/tournaments/page.tsx`, and `app/[orgSlug]/admin/tournaments/archives/page.tsx`.

### 2026-05-13 - Walkthrough First-Run Create Flow Cleanup

Findings:
- The create tournament flow still briefly showed the tournaments page before the modal because the page was reading query params through `useSearchParams()`.
- Recommended launch steps were only visible after a tournament existed, so a new owner still saw only "plan selected" and "create first tournament."
- The create tournament modal exposed "migrate past tournament" and "seed random data" controls that are not relevant for a first-time organization owner.
- Supabase could show a dev warning about multiple browser clients sharing the same storage key.

Implemented:
- Changed the tournament management page to read the route `searchParams` prop with React `use()`, so `?create=1` is part of initial modal state.
- Made recommended tournament launch steps visible before tournament creation as locked upcoming steps, then actionable after the first tournament exists.
- Removed migration/copy and seed/test sections from the New Tournament modal.
- Kept future copy-structure work out of the first-run modal; it can be added later as a second-plus tournament workflow.
- Made the Supabase browser client a singleton and reused it from the shared public client export to reduce duplicate-client storage warnings.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for `app/[orgSlug]/admin/org/tournaments/page.tsx`, `app/[orgSlug]/admin/onboarding/page.tsx`, `lib/supabase-browser.ts`, and `lib/supabase.ts`.

### 2026-05-13 - Walkthrough Focused Onboarding Chrome

Finding:
- The onboarding workflow still displayed the standard admin sidebar with back-to-site, help, and logout actions.

Implemented:
- Added focused admin chrome for `/admin/onboarding`.
- Hidden during onboarding: left admin sidebar, mobile bottom nav, Dev Plan switcher, and LiveLogic rail.
- Normal admin navigation still appears on every other admin route.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for `app/[orgSlug]/admin/AdminChrome.tsx` and `app/[orgSlug]/admin/layout.tsx`.

### 2026-05-13 - Walkthrough Editable Division Starters

Finding:
- Youth division presets were hardcoded as fixed rows (`U9`, `U11`, `U13`, `U15`, `U17`, `U19`) instead of editable starter suggestions.

Implemented:
- Changed preset divisions into editable rows with stable row state, so owners can rename, uncheck, remove, or add divisions before saving.
- Updated preset copy to describe Youth and Adult options as starter sets rather than fixed structures.
- Added duplicate-name validation before tournament creation.
- Updated setup age defaults so custom youth-style names like `U10` or `12U` infer reasonable age bounds, while non-age labels stay broad.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for `app/[orgSlug]/admin/org/tournaments/page.tsx` and `app/api/admin/setup-tournament/route.ts`.

### 2026-05-13 - Walkthrough Modal-Based Startup Workflow

Findings:
- Onboarding startup steps linked out to admin pages, causing owners to lose the step-by-step workflow context.
- There was no persisted dashboard reminder showing how much startup setup remained after an owner exited or skipped setup.

Implemented:
- Added persisted startup task tracking via `supabase/migrations/026_startup_tasks.sql`.
- Added `/api/admin/org/startup-tasks` to compute saved/skipped startup progress and keep skipped tasks resumable.
- Changed Tournament/Tournament Plus onboarding steps into sequential workflow actions that open modals over onboarding instead of navigating away.
- Kept create-tournament, division review, venue setup, contact setup, activation, and staff invite actions inside onboarding with Save or Skip behavior.
- Enforced sequential unlocks: later steps are disabled until each prior step is saved or skipped.
- Added server-backed admin APIs for onboarding venue/contact writes so first-run setup does not depend on direct browser table writes.
- Added an admin dashboard reminder card such as `4/7 startup tasks complete` linking back to `/admin/onboarding?continueSetup=1`.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for onboarding, admin dashboard, startup task API, diamonds API, contacts API, and age-groups API changes.

### 2026-05-13 - Walkthrough Signup Redirect Render Guard

Finding:
- After creating a new user, the onboarding page could hit a client render fault during the first `?choosePlan=1` load.

Implemented:
- Moved the non-owner redirect out of render and into a client effect so Next's router is not called before initialization.
- Added a runtime plan-id fallback so legacy or malformed org plan values render the Tournament plan chooser instead of breaking onboarding.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for `app/[orgSlug]/admin/onboarding/page.tsx`.

### 2026-05-13 - Walkthrough Division Row Labels And Pool Expansion

Findings:
- The onboarding create-tournament division rows showed a bare `8` without indicating it represented team capacity.
- Checking Pools in onboarding did not reveal pool count, registrant-picks-pool, or pool-name controls.
- The startup task API could return 500 if the `startup_tasks` migration had not been applied yet.
- The startup workflow list emitted a React key warning.

Implemented:
- Added compact column headers for Use, Division, Capacity, Pools, and row actions.
- Added an expanded pool setup panel below each division row when Pools is checked.
- Added pool count, registrant-picks-pool, and pool-name inputs matching the admin create modal behavior.
- Added workflow step keys to clear the React list warning.
- Made `/api/admin/org/startup-tasks` gracefully fall back to computed progress if the `startup_tasks` column is missing, instead of breaking the page with 500s.

Verified:
- `npm.cmd exec -- tsc --noEmit --pretty false` passes.
- Focused ESLint passes for `app/[orgSlug]/admin/onboarding/page.tsx` and `app/api/admin/org/startup-tasks/route.ts`.

### 2026-05-13 - Walkthrough Startup Wizard Modal

Finding:
- The startup workflow still read like a checklist page instead of one guided setup flow, and save/skip actions dropped owners back to the workflow screen.
- After selecting a higher plan during first-run onboarding, the owner could not switch back to the free Tournament plan before setup had actually started.
- Plan selection behaved like a confirmation step instead of step one of the wizard, and owners could not move backward through the wizard to revise earlier choices.

Implemented:
- Changed Tournament/Tournament Plus onboarding into a single modal wizard with a visible step counter and progress bar.
- Added swipe-style step transitions so Next/Skip advances directly into the next setup modal.
- Kept the onboarding page focused as a simple startup launcher/reminder rather than a full checklist.
- Converted tournament setup to a draft-first wizard: Next keeps draft data, Back revises it, Skip removes that step from the draft, and nothing setup-related persists until final review.
- Kept first-run plan selection editable until setup starts, including an owner-only server route to switch back to Tournament before any startup work exists.
- Made plan selection the actual first wizard modal; choosing/continuing with a plan advances directly to the next setup modal.
- Added a bottom-left Back button to every wizard modal so owners can move backward and revise previous steps.
- Reset unsaved workflow draft state when the owner changes plans before saved setup exists.
- Removed the redundant footer Continue action from the plan picker modal and fixed plan-card loading state after mock plan selection.
- Simplified division starter rows by removing the redundant Use checkbox and tightening row spacing to reduce modal scrolling.
- Made tournament end date dependent on start date, with a two-day default and client/server validation against end-before-start ranges.
- Removed per-step database writes so returning to earlier wizard steps edits frontend draft state instead of updating or duplicating saved records.
- Split first-run setup into separate tournament details, division setup, and welcome-message steps.
- Moved full division setup, including pool controls, into the standalone division step.
- Added a welcome-message startup step backed by an admin announcement API that updates the existing Welcome announcement instead of duplicating it.
- Changed "Skip" on the create-tournament step to jump to final review with a clear message that no tournament setup will be created.
- Hid the dashboard setup reminder and redirected direct onboarding access once a first tournament exists.
- Reworked venue setup to use a single structured venue form plus an editable added-venues list, preventing empty rows and formatting address fields into the existing saved address.
- Relaxed venue validation so only the venue name is required; address fields remain optional, and clicking Add venue now shows a clear missing-name message instead of doing nothing.
- Added a final review step where the owner explicitly saves setup; if no tournament is created, the owner can finish without saving setup and return to the wizard later from the dashboard.
- Prevented new tournament start dates from being set before today in onboarding, the admin create modal, and the setup API.
- Removed activation from first-run setup; saving now creates a private draft and reminds owners to review the public page, schedule, divisions, and registration details before activating later.
- Removed staff invites from first-run setup so new owners are not asked to understand org roles during tournament creation; role management remains an admin-settings task, with treasurer treated as an org/accounting role rather than a tournament setup role.
- Replaced "Private draft" status jargon in setup review with public-visibility copy: the tournament is not live yet, registration is closed, and only admins can work on it until activation.
- Redirected Tournament and Tournament Plus workspaces from the generic admin hub into Tournament Management after onboarding, and changed admin hub/sidebar module checks to require plan entitlement as well as role capability.
- Added production email verification to organization signup: production or `REQUIRE_SIGNUP_EMAIL_VERIFICATION=true` sends a verification email and pauses before plan selection; local dev keeps the immediate sign-in path by default.

Verified:
- Focused ESLint passes for onboarding, admin dashboard, and startup task API changes.
- Focused ESLint passes for signup verification changes.
- Full `npm.cmd exec -- tsc --noEmit --pretty false` is currently blocked by an unrelated nullable `lineInfo` issue in the accounting budget allocation page and duplicate `entries` route implementations in `app/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries/route.ts`.

### 2026-05-13 - Walkthrough Tournament-Only Admin Landing Cleanup

Findings:
- Tournament and Tournament Plus owners could still see the generic org admin hub briefly before being redirected into tournament management.
- The tournament dashboard header showed `LIVE` even when the selected tournament was still a draft.
- The tournament dashboard loaded counts through browser Supabase helpers, producing 403 console errors for age groups, teams, games, and announcements.

Implemented:
- Split the admin hub into a tiny page wrapper plus a client hub component so tournament-only workspaces show only a redirect/loading shell instead of the org hub.
- Sent tournament-only post-onboarding flows directly to the tournament dashboard when a tournament exists, or back to the focused setup wizard when no tournament has been created yet.
- Kept a client redirect fallback for stale in-app navigations.
- Added `/api/admin/tournament-dashboard`, backed by the admin server client and org/tournament scope checks, for dashboard stat counts.
- Updated the tournament dashboard to fetch counts from the new admin API instead of direct browser table reads.
- Changed the dashboard status label to show the selected tournament status, so drafts display as `DRAFT` rather than `LIVE`.

Verified:
- Focused ESLint passes for the admin hub split, sidebar, tournament dashboard, and dashboard stats API.
- Full `npm.cmd exec -- tsc --noEmit --pretty false` is still blocked by unrelated accounting/fundraiser TypeScript issues.

### 2026-05-13 - Walkthrough Subscription And Wizard Resume Polish

Findings:
- The organization plan page defaulted upgrade pricing to annual even though onboarding and public pricing default to monthly.
- The customer-facing account area used "Billing" language where "Subscription" better describes what the owner is managing.
- Tournament-only owners who left first-run setup before creating a tournament could log back in and land in an empty tournament admin state with no clear path back to the wizard.

Implemented:
- Defaulted the org subscription page upgrade toggle to Monthly.
- Renamed visible org-admin "Billing" labels to "Subscription" across the org hub, sidebar, subscription page, mock portal, help content, and role copy while keeping the existing `/billing` route for compatibility.
- Updated login destination logic so Tournament and Tournament Plus orgs without a tournament are sent back to `/admin/onboarding?continueSetup=1` unless the owner explicitly skipped first tournament creation.
- Updated the admin hub fallback to wait for startup progress before redirecting tournament-only orgs, so pending setup resumes the wizard while explicit skips still allow the empty tournament admin state.
- Persisted explicit first-tournament skips into startup task state when the owner finishes the wizard after choosing to skip tournament creation.

Verified:
- Focused ESLint passes for the subscription page, mock portal, admin sidebar, admin hub fallback, onboarding wizard, login destination, onboarding-plan API copy, org hub, admin help page, and org help content.
- Full `npm.cmd exec -- tsc --noEmit --pretty false` is still blocked by unrelated accounting/fundraiser TypeScript issues.

## Product Manager Summary

For a new tournament organizer, the path should feel like:

1. Create an organization.
2. Create a tournament with neutral, reusable defaults.
3. Configure divisions, dates, diamonds, contacts, and registration.
4. Preview the public tournament page.
5. Activate the tournament.
6. Share a registration link confidently.

Today, the architecture supports most of this, but the first-run experience has several rough edges: demo-specific defaults, stale pricing language, public access to draft tournaments, registration availability gaps, and some route mismatches after the admin URL restructure.

The goal of this plan is to make the tournament signup path feel polished, safe, and commercially credible for an external organization.

---

## Priority Phases

### Phase 1 - Trust And Blocking Bugs

Fix issues that can break the flow, expose draft content, or make the product feel like a demo clone.

- Dashboard quick links route mismatch
- Draft tournaments publicly accessible
- Registration accepts submissions before activation
- Hardcoded signup/tournament/default copy
- Hardcoded fallback contact email
- Hide dev/test seed tools from customers

### Phase 2 - First Tournament Setup Polish

Make the "New Tournament" flow feel guided and generic.

- [x] Replace Battle of the Bats defaults
- [x] Add setup-oriented success state
- [x] Improve division/pool behavior
- [x] Validate tournament slug before create
- [x] Make onboarding tournament-first

### Phase 3 - Conversion And Public Experience

Make the public tournament page better at helping organizers share and collect registrations.

- [x] Add hero registration CTA
- [x] Replace sport-specific public copy
- [x] Require contact email before activation opens registration
- [x] Add public registration availability messaging
- [x] Add authenticated admin draft preview path

---

## Findings And Recommended Fixes

### F1 - Tournament Dashboard Quick Links Use Old Routes

Priority: High

Problem:
After the tournament admin URL restructure, the dashboard still creates links like `/{orgSlug}/admin/teams`, `/{orgSlug}/admin/schedule`, and `/{orgSlug}/admin/results`. The current route tree is `/{orgSlug}/admin/tournaments/...`.

User impact:
A new organizer lands on the tournament dashboard, clicks "Manage Teams" or "Schedule Games", and may hit a wrong route or outdated admin surface. This damages confidence immediately after setup.

Recommended fix:
Update all tournament dashboard stat-card and quick-action links to include `/admin/tournaments/`.

Likely files:
- `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`

Implementation notes:
- Change `base` from `/${orgSlug}/admin` to `/${orgSlug}/admin/tournaments`, or keep a separate `tournamentBase`.
- Ensure links for `age-groups`, `teams`, `schedule`, `results`, and `announcements` all resolve to the tournament module route.

Acceptance criteria:
- Clicking every dashboard stat card lands on a valid page.
- Clicking every quick action lands on a valid page.
- No links from the tournament dashboard point to legacy `/admin/{page}` routes.

---

### F2 - Draft Tournaments Are Publicly Reachable

Priority: High

Problem:
`getTournamentBySlug()` excludes archived tournaments but still returns draft tournaments. Public tournament pages can render if someone knows or guesses the URL.

User impact:
An organizer may still be configuring the tournament, but coaches/parents could see incomplete schedules, test announcements, or half-built registration settings.

Recommended fix:
Public tournament routes should only show tournaments with `status = 'active'` or `status = 'completed'`, unless the viewer is an authenticated org admin.

Likely files:
- `lib/db.ts`
- `app/[orgSlug]/[tournamentSlug]/page.tsx`
- `app/[orgSlug]/[tournamentSlug]/layout.tsx`
- Public tournament subroutes under `app/[orgSlug]/[tournamentSlug]/`

Implementation options:
- Add a new helper such as `getPublicTournamentBySlug(orgId, slug)` that filters to active/completed.
- Keep `getTournamentBySlug()` for admin-safe use if needed.
- For admins previewing draft tournaments, use an explicit preview path or server-side auth check.

Acceptance criteria:
- Anonymous users cannot view draft tournament pages.
- Anonymous users can view active tournament pages.
- Anonymous users can view completed tournament pages if that is intended.
- Org admins still have a way to preview draft tournaments before activation.

---

### F3 - Registration Can Open Before Tournament Activation

Priority: High

Problem:
The tournament registration page considers registration available when the tournament exists and has age groups. It does not check `tournament.status`.

User impact:
A draft tournament with divisions configured can receive real registrations before the organizer is ready.

Recommended fix:
Require `tournament.status === 'active'` before showing the public registration form or accepting registration API submissions.

Likely files:
- `app/[orgSlug]/[tournamentSlug]/register/page.tsx`
- `app/api/register/route.ts`
- Possibly `lib/db.ts`

Implementation notes:
- On the page, show a closed/not-open state when the tournament is draft.
- In the API route, fetch tournament status and reject submissions unless active.
- Use org or tournament contact email in the closed state.

Acceptance criteria:
- Draft tournament registration page displays "Registration is not open yet."
- Draft tournament registration API returns 403 or 400 with a clear error.
- Active tournament registration works normally.
- Completed/archived tournaments do not accept new registrations.

---

### F4 - First Tournament Defaults Are Demo-Specific

Priority: High

Problem:
The new tournament modal defaults to "Battle of the Bats", a softball welcome message, U11-U19 divisions, and Milton-style assumptions.

User impact:
A new customer may feel they are editing another organization's app rather than using their own SaaS account.

Recommended fix:
Replace demo-specific defaults with neutral defaults and allow a fast first-run path.

Likely files:
- `app/[orgSlug]/admin/org/tournaments/page.tsx`

Recommended UX:
- Default tournament name: empty, or `${currentYear} Tournament`
- Placeholder: "e.g. Spring Classic 2026"
- Welcome message: neutral and optional
- Division presets:
  - Youth tournament: U9, U11, U13, U15, U17, U19
  - Adult tournament: Open, Competitive, Recreational
  - Custom: organizer adds division names manually

Acceptance criteria:
- No "Battle of the Bats" default appears for a new org.
- No Milton-specific copy appears in the new tournament flow.
- Organizers can create a simple tournament with custom divisions.

---

### F5 - Dev/Test Seed Controls Are Visible In Customer Flow

Priority: High

Problem:
The "Seed Random Data (Testing)" panel appears inside the customer-facing new tournament modal.

User impact:
This makes the product feel unfinished and creates risk that a real organizer seeds fake teams, scores, contacts, or schedules by mistake.

Recommended fix:
Hide seed controls unless dev tools are explicitly enabled.

Likely files:
- `app/[orgSlug]/admin/org/tournaments/page.tsx`

Implementation notes:
- Gate the seed panel behind `process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'`.
- Also ensure the API ignores or rejects seed options in production if possible.

Acceptance criteria:
- Seed controls are hidden in normal production/customer environments.
- Dev environments can still use seed controls when enabled.
- Production API cannot accidentally seed demo data from a crafted request.

---

### F6 - Registration Closed State Uses Hardcoded Personal Email

Priority: Medium

Problem:
The public tournament registration closed/not-open message links to `b2cowan@gmail.com`.

User impact:
External orgs expose the wrong contact email, and parents/coaches may contact the platform owner instead of the tournament organizer.

Recommended fix:
Use tournament contact email first, then org contact email, then a generic "contact the organizer" message.

Likely files:
- `app/[orgSlug]/[tournamentSlug]/register/page.tsx`
- `lib/types.ts` if contact email needs to be surfaced differently
- `lib/db.ts`

Acceptance criteria:
- No hardcoded personal email appears on public registration pages.
- Closed/not-open state shows tournament or org contact when configured.
- If no email exists, the page does not show a broken or misleading contact link.

---

### F7 - Pool Count `0` Still Creates A Pool

Priority: Medium

Problem:
The UI uses `0` to mean no pools, but setup API uses `(g.pool_count || 1)`, causing `0` to become `1`.

User impact:
Organizers who do not use pools may still get pool records, creating confusing downstream registration/schedule behavior.

Recommended fix:
Treat `0` as a valid value and create pools only when `pool_count > 0`.

Likely files:
- `app/api/admin/setup-tournament/route.ts`
- `app/[orgSlug]/admin/org/tournaments/page.tsx`

Implementation notes:
- Replace `(g.pool_count || 1)` with an explicit number check.
- Confirm schedule and registration code can handle divisions with no pool rows.

Acceptance criteria:
- Division with "Use Pools" off creates no pool rows.
- Division with "Use Pools" on creates the requested number of pool rows.
- Registration works for both pooled and non-pooled divisions.

---

### F8 - Tournament Slug Is Not Validated Before Create

Priority: Medium

Problem:
There is a `check-slug` route, but the new tournament wizard does not appear to use it before creation. The combined schema also does not show a unique index for tournament slugs per org.

User impact:
Duplicate slugs can create ambiguous public URLs and make one tournament unreachable.

Recommended fix:
Add server-side uniqueness enforcement and client-side validation.

Likely files:
- `supabase/migrations/024_tournament_slug_unique.sql` or next migration number
- `app/[orgSlug]/admin/org/tournaments/page.tsx`
- `app/api/admin/tournaments/route.ts`
- `app/api/admin/setup-tournament/route.ts`

Implementation notes:
- Add a partial unique index for `(organization_id, slug)` where `status <> 'archived'`.
- Before create, call `check-slug` or validate in the setup API.
- Show inline "URL already in use" copy in the modal.

Acceptance criteria:
- Two non-archived tournaments in the same org cannot share a slug.
- Archived tournaments do not block reusing a slug if that is the intended product behavior.
- Client displays a friendly validation message before submit where possible.

---

### F9 - Signup Copy Still References Starter Plan

Priority: Medium

Problem:
Signup says "Starts on the free Starter plan," but the pricing model now uses "Tournament" as the free plan.

User impact:
Plan naming inconsistency creates purchase confusion and makes the product feel less buttoned-up.

Recommended fix:
Update signup copy to match the current pricing model.

Likely files:
- `app/auth/signup/page.tsx`

Recommended copy:
- Header subcopy: "FieldLogicHQ - Sports organization management"
- Footer note: "Starts on the free Tournament plan. No credit card required."

Acceptance criteria:
- No "Starter" plan copy appears in signup or billing surfaces.
- Signup language matches pricing page plan names.

---

### F10 - Onboarding Requires Inviting A Member Before Completion

Priority: Medium

Problem:
Onboarding only shows "Go to Dashboard" after both `memberDone` and `tournamentDone`. Many tournament directors start solo.

User impact:
A solo organizer may feel blocked or nudged into inviting someone before they are ready.

Recommended fix:
Make "Create your first tournament" the primary completion condition for the free Tournament plan. Treat inviting a team member as recommended but optional.

Likely files:
- `app/[orgSlug]/admin/onboarding/page.tsx`

Implementation notes:
- For Tournament plan, `allDone = tournamentDone`.
- Keep invite member as a checklist item, but do not block completion.
- For paid/club plans, consider module-specific completion rules later.

Acceptance criteria:
- A new owner can complete onboarding after creating a tournament.
- Invite-member step remains visible and useful.
- Skipping onboarding still works.

---

### F11 - Public Tournament Hero Lacks Registration CTA

Priority: Medium

Problem:
The public tournament homepage hero emphasizes schedule and announcements. Registration exists in the navbar, but the most important organizer action is not a primary hero CTA.

User impact:
Organizers sharing a tournament page want teams to register. Coaches landing on the page should see that action immediately.

Recommended fix:
Add a prominent "Register Team" CTA to the tournament hero when the tournament is active and at least one division is open.

Likely files:
- `app/[orgSlug]/[tournamentSlug]/page.tsx`
- Possibly helper for registration availability

Implementation notes:
- Primary CTA: "Register Team"
- Secondary CTA: "View Schedule" once schedule exists
- If registration is closed, show "Registration Closed" or "Join Waitlist" when applicable.

Acceptance criteria:
- Active tournament page shows a clear registration CTA.
- Draft tournament page is not public.
- Closed/completed tournament page does not invite new registrations.

---

### F12 - Public Tournament Copy Is Too Sport-Specific

Priority: Medium

Problem:
The public tournament hero says "premier youth softball tournament", "single pitch", and defaults the age range to U11-U19.

User impact:
Organizations running hockey, soccer, adult leagues, baseball, or non-youth tournaments see mismatched copy.

Recommended fix:
Make public tournament copy generic or configurable.

Likely files:
- `app/[orgSlug]/[tournamentSlug]/page.tsx`
- Future: tournament settings fields for description/tagline

Recommended short-term copy:
- "Hosted by {org.name}. View schedules, results, teams, and tournament rules in one place."
- Avoid sport-specific words unless the tournament has a configured sport.

Acceptance criteria:
- No softball-specific public copy appears unless configured.
- Empty age group fallback is generic, such as "Divisions TBA."
- Public page works for multiple sports.

---

### F13 - Signup Does Not Collect Org Contact Email

Priority: Enhancement

Problem:
New org signup collects organization name, email, and password, but not an organization contact email. The auth email may be the owner, but public pages and registration flows need an organizer-facing contact.

User impact:
Public registration, closed-state messaging, email footers, and support flows lack reliable org contact data.

Recommended fix:
Add contact email to signup or onboarding. Prefer onboarding if signup needs to remain minimal.

Likely files:
- `app/auth/signup/page.tsx`
- `app/api/auth/signup/route.ts`
- `app/[orgSlug]/admin/onboarding/page.tsx`
- `app/[orgSlug]/admin/org/settings/page.tsx`
- `lib/db.ts`

Implementation options:
- Option A: Add optional "Public contact email" during signup.
- Option B: Add onboarding step "Set public contact email."
- Option C: Default org contact email to owner email, then prompt for confirmation in onboarding.

Acceptance criteria:
- New orgs have a usable contact email by the time registration is opened.
- Public pages never need a hardcoded fallback email.
- Owners can update the email from org settings.

---

### F14 - Post-Signup Onboarding Plan Screen Blanks With 403 Errors

Priority: Blocker

Category:
- Technical bug
- Data/auth
- Onboarding logic
- Billing/plan selection

Problem:
After creating a new organization, the owner is redirected to `/{orgSlug}/admin/onboarding?choosePlan=1`, but the admin shell can render with a blank main area while browser Supabase requests return 403. The plan chooser never appears.

User impact:
This blocks the first-time owner at the first required post-signup step. The user cannot choose Tournament, Tournament Plus, League, or Club and may assume account creation failed.

Root cause:
The server admin layout can authenticate the owner, but the client `OrgProvider` was loading organization context by directly querying `organization_members` with the browser Supabase client. If that browser read is denied by RLS/table grants, `currentOrg` stays null and the onboarding page returns no UI.

Recommended fix:
Load org context through a same-origin server route that uses the existing authenticated server context, and seed `OrgProvider` from the org admin layout so onboarding can render immediately after signup.

Implemented fix:
- Added `app/api/org-context/route.ts`.
- Updated `lib/org-context.tsx` to load context from `/api/org-context`.
- Updated `app/[orgSlug]/admin/layout.tsx` to pass initial org, role, and capabilities into `OrgProvider`.

Acceptance criteria:
- A new owner lands on the plan chooser after signup.
- The plan chooser renders even if direct browser Supabase membership reads would fail.
- The owner role is available on first render, so owner-only onboarding does not redirect or blank.
- Monthly pricing remains the default.

---

### F15 - Tournament Management Page Help Text Is Too Heavy

Priority: Medium

Category:
- UX copy
- Visual design
- Product flow

Problem:
The first tournament management page stacked a long lifecycle explanation and a second help callout above the empty table. For a first-time owner coming from onboarding, this created a help-wall moment before the actual action.

User impact:
The owner has already chosen a plan and clicked "Create your first tournament." Too much explanatory text slows the setup flow and makes the page feel more like documentation than a task surface.

Recommended fix:
Compress lifecycle education into a short, scannable status strip and use the empty state to drive the next action.

Implemented fix:
- Replaced the long lifecycle paragraph with a compact strip: Draft private, Active public, Completed frees slot, Archive/Seal after the event.
- Replaced the first-run help callout with a concise empty prompt and direct "Create Tournament" button.

Acceptance criteria:
- First-run tournaments page has one compact lifecycle explanation.
- Empty state clearly points to creating a tournament.
- The primary action remains visible without competing with long help text.

---

### F16 - Onboarding Create Tournament CTA Lands One Step Too Early

Priority: High

Category:
- Product flow
- Onboarding logic

Problem:
The onboarding "Create your first tournament" CTA sent the owner to the tournaments list page, requiring another click on "New Tournament."

User impact:
The owner experiences a dead-stop between onboarding intent and the actual create form. This is small friction, but it happens at the most important setup step.

Recommended fix:
Route onboarding to the tournament management page with an intent parameter and auto-open the New Tournament modal.

Implemented fix:
- Onboarding now links to `/{orgSlug}/admin/org/tournaments?create=1`.
- The tournaments page reads `create=1` and opens the New Tournament modal once.

Acceptance criteria:
- Clicking "Create a tournament" from onboarding opens the create modal.
- Closing the modal does not repeatedly reopen it.
- The regular tournaments page still works normally without the query parameter.

---

### F17 - Post-Tournament Onboarding Needs Optional Launch Steps

Priority: Medium

Category:
- Product flow
- Onboarding logic
- UX copy

Problem:
Once the first tournament exists, onboarding previously considered the tournament path complete. That is technically true, but it misses the next customer question: "What should I configure before sharing this?"

User impact:
A new owner may create a draft tournament and then jump into the dashboard without setting venues, contacts, registration readiness, preview, or activation.

Recommended fix:
After a tournament is created, show optional "recommended launch steps" while still allowing the owner to go to the dashboard or skip setup.

Implemented fix:
- Added optional onboarding actions:
  - Review divisions and registration
  - Add venues
  - Add public contacts
  - Preview and activate
  - Invite staff when helpful

Acceptance criteria:
- Creating a tournament still completes the required Tournament-plan onboarding condition.
- Recommended steps are visible after the first tournament exists.
- Invite users is optional, not a blocker.
- Owners can choose steps in any order or go to the dashboard.

---

### F18 - Create Tournament Intent Shows Page Before Modal

Priority: Medium

Category:
- Product flow
- Visual design
- Onboarding logic

Problem:
The onboarding "Create a tournament" action routed to `/{orgSlug}/admin/org/tournaments?create=1`, but the tournaments page first rendered normally and then opened the modal from a client effect.

User impact:
The owner sees a jarring intermediate page state before the modal appears. It makes the onboarding action feel less direct than promised.

Recommended fix:
Use the query parameter to initialize modal state and default tournament form state during first render, not after first render.

Implemented fix:
- `?create=1` now sets the initial modal state to `add`.
- The default tournament name, year, slug, and date fields are initialized before the modal renders.
- The post-render `openAdd()` effect was removed.

Acceptance criteria:
- Clicking "Create a tournament" from onboarding lands directly in the New Tournament modal.
- The form is populated with default year/name/slug on first modal render.
- Closing the modal does not reopen it automatically.

---

### F19 - Admin Tournament Page Logs Supabase Archive Permission Errors

Priority: High

Category:
- Technical bug
- Data/auth

Problem:
The admin tournament management page called `getArchivesByOrg()` from the browser. That helper queries `tournament_archives` directly through the browser Supabase client. In the current dev database, PostgREST denies that table read with 401/`42501 permission denied for table tournament_archives`.

User impact:
The page may still appear usable, but the console shows red errors during a first-time setup walkthrough. This undermines trust and can hide real product issues.

Recommended fix:
Admin archive reads should go through an authenticated admin API route that uses the server-side admin client and the current user's org context.

Implemented fix:
- Added `/api/admin/tournament-archives`.
- Updated admin tournament management and admin archives pages to use the new API route.

Acceptance criteria:
- Loading `/{orgSlug}/admin/org/tournaments?create=1` does not make direct browser requests to `tournament_archives`.
- The red Supabase 401/`42501` archive errors disappear from this admin page.
- Sealed/archive status still works for admin tournament lists.

---

### F20 - Create Tournament Modal Still Flashes After Page Render

Priority: High

Category:
- Product flow
- Visual design
- Technical bug

Problem:
Even after adding `?create=1`, the page could still visibly render the tournaments screen before opening the modal.

User impact:
The onboarding CTA promises "Create a tournament," but the visible transition still feels like the user landed on a list page and then something happened.

Recommended fix:
Read the route `searchParams` prop at the page boundary and initialize modal state from that value.

Implemented fix:
- Replaced `useSearchParams()` with the page `searchParams` prop read via React `use()`.
- Initialized `modal` and default form state from `create=1`.

Acceptance criteria:
- The first visible destination after onboarding is the New Tournament modal.
- The underlying tournaments page does not visibly flash before the modal.

---

### F21 - Launch Checklist Is Hidden Before First Tournament Exists

Priority: Medium

Category:
- Product flow
- Onboarding logic
- UX copy

Problem:
The recommended launch checklist only appeared after a tournament existed. Before creation, the owner still saw only "Tournament plan selected" and "Create your first tournament."

User impact:
The onboarding flow does not preview what comes next, so setup feels shorter but less informative.

Recommended fix:
Show the next launch steps as locked upcoming steps until the first tournament is created, then unlock them.

Implemented fix:
- Recommended launch steps now show before creation with disabled actions.
- After tournament creation, the same items become links.

Acceptance criteria:
- New owners can see the full first-run setup path immediately.
- Tournament-specific actions are disabled until a tournament exists.
- The workflow remains skippable.

---

### F22 - Create Tournament Modal Shows Migration And Seed Controls

Priority: High

Category:
- Product flow
- UX copy
- Technical bug

Problem:
The first-run create tournament modal showed "Migrate data from past tournament" and dev seed controls. A brand-new organization has nothing to migrate, and seed data is an internal testing concept.

User impact:
The modal feels like an internal admin/testing surface instead of a customer onboarding flow.

Recommended fix:
Remove migration and seed controls from the first-run create modal. Later, add a separate "copy structure" workflow for second-plus tournaments if useful.

Implemented fix:
- Removed migration UI from the New Tournament modal.
- Removed seed/test UI from the New Tournament modal.
- Setup API payload now sends no migration and no seed data from this flow.

Acceptance criteria:
- First-run create tournament modal contains tournament details, division setup, and optional welcome announcement only.
- No seed/test controls are visible.
- No migration controls are visible.

---

### F23 - Supabase Browser Client Storage Warning

Priority: Low

Category:
- Technical bug
- Developer experience

Problem:
Supabase can warn when multiple browser clients use the same storage key concurrently.

User impact:
The warning appears in DevTools and adds noise during product walkthroughs.

Recommended fix:
Use a singleton browser Supabase client and reuse it from the shared public client export in browser contexts.

Implemented fix:
- `lib/supabase-browser.ts` now returns a singleton browser client.
- `lib/supabase.ts` reuses that singleton in the browser.

Acceptance criteria:
- Normal admin pages should not create competing Supabase browser clients.
- DevTools warning noise should be reduced.

---

### F24 - Onboarding Shows Normal Admin Navigation

Priority: Medium

Category:
- Product flow
- Visual design
- Onboarding logic

Problem:
The onboarding workflow rendered inside the normal admin shell, including back-to-site, help, logout, module navigation, and development controls.

User impact:
For a first-time organization owner, there is no public site to return to yet, and logout/help/navigation distracts from the setup workflow.

Recommended fix:
Render onboarding in focused admin chrome while preserving the normal shell for all other admin pages.

Implemented fix:
- Added `app/[orgSlug]/admin/AdminChrome.tsx`.
- `AdminChrome` uses the current pathname to hide admin sidebar, bottom nav, Dev Plan switcher, and LiveLogic rail on `/admin/onboarding`.
- The main workflow canvas remains full-width and centered.

Acceptance criteria:
- `/admin/onboarding` has no admin side panel.
- `/admin/onboarding` has no bottom nav on mobile.
- Other admin routes still show normal navigation.

---

### F25 - Youth Division Preset Is Too Hardcoded

Priority: Medium

Category:
- Product flow
- Onboarding logic
- UX copy

Problem:
The first-run create tournament modal showed Youth divisions as fixed checkbox rows (`U9`, `U11`, `U13`, `U15`, `U17`, `U19`). Many youth tournaments use `U##` or `##U` labels, but not always the exact same divisions.

User impact:
Owners may feel forced into FieldLogicHQ's starter structure or switch to Custom, losing the useful prefilled starting point.

Recommended fix:
Keep Youth and Adult as starter presets, but render the rows as editable suggestions. Let owners rename, uncheck, remove, or add divisions before saving.

Implemented fix:
- Replaced name-keyed division selection state with editable division rows.
- Made preset division names editable text inputs.
- Added an always-visible add-division input.
- Added duplicate division-name validation.
- Added setup support for custom youth-style names like `U10` and `12U`.

Acceptance criteria:
- Youth preset prepopulates common divisions but each name can be changed.
- Owners can add or remove divisions from any preset.
- Saving creates divisions with the owner's edited names.
- Duplicate enabled division names are blocked before create.

---

### F26 - Startup Workflow Steps Navigate Away From Onboarding

Priority: High

Category:
- Product flow
- Onboarding logic
- Visual design

Problem:
The recommended startup steps used links to full admin pages. When the owner clicked Create Tournament, Add Venues, Add Contacts, Preview/Activate, or Invite Users, they left onboarding and lost the step-by-step context.

User impact:
The workflow stopped feeling guided. Owners had to remember where they were, how to get back, and which setup tasks were still pending.

Recommended fix:
Keep the owner on `/admin/onboarding` and open workflow-specific modals for each step. Each step should offer Save or Skip. Saving marks the step complete; skipping unlocks the next step without counting as completed setup.

Implemented fix:
- Tournament/Tournament Plus onboarding steps now open modals over the workflow.
- The create tournament modal saves through `/api/admin/setup-tournament` without navigating to the tournament admin page.
- Division review, venue setup, contact setup, activation, and staff invite are handled inline through modal actions.
- Steps below the current pending step are disabled until earlier steps are saved or skipped.

Acceptance criteria:
- Clicking Create Tournament from onboarding opens a modal over onboarding.
- Clicking Add Venues, Add Contacts, Preview/Activate, or Invite Staff opens a modal over onboarding.
- Saving a step marks it complete.
- Skipping a step unlocks the next step but does not increase the completed count.
- The owner can finish or leave setup without losing the workflow state.

---

### F27 - Dashboard Does Not Remind Owners About Incomplete Startup Tasks

Priority: Medium

Category:
- Product flow
- Onboarding logic
- UX copy

Problem:
After an owner skipped or exited onboarding, the admin dashboard had no persistent reminder of remaining startup tasks.

User impact:
Important launch tasks such as venues, contacts, activation, and staff invites could be forgotten after the owner reached the dashboard.

Recommended fix:
Persist startup task statuses and show a dashboard reminder while any tasks remain unsaved.

Implemented fix:
- Added `organizations.startup_tasks` JSONB storage.
- Added `/api/admin/org/startup-tasks` to track complete/skipped/pending steps.
- Added an admin dashboard reminder card showing saved startup progress, for example `4/7 startup tasks complete`.
- The reminder links back to onboarding with `?continueSetup=1` so completed onboarding does not redirect the owner away.

Acceptance criteria:
- Dashboard shows remaining startup progress when any startup tasks are incomplete or skipped.
- Clicking the reminder returns to the focused onboarding workflow.
- Completed saved tasks count toward progress; skipped tasks do not count as complete.

---

### F28 - New Signup Can Hit Onboarding Render Fault

Priority: Blocker

Category:
- Technical bug
- Onboarding logic
- Data/auth

Problem:
After signup, the owner can land on `/{orgSlug}/admin/onboarding?choosePlan=1` and see an internal render error instead of the plan chooser.

User impact:
This blocks the first screen after account creation and makes a successful signup look broken.

Likely root cause:
The onboarding page still had a render-time redirect for non-owner users. During the first auth/org-context hydration after signup, that can dispatch a Next router action before the client router is initialized. The page also assumed the org plan ID always matched the current plan config.

Recommended fix:
Move redirects into effects and guard plan lookup with a runtime fallback.

Implemented fix:
- Moved the non-owner redirect into `useEffect`.
- Render returns `null` while role is unknown or redirecting.
- Added a `normalizePlanId()` guard that falls back to `tournament` for unexpected plan values.

Acceptance criteria:
- New signup redirect renders the plan chooser.
- No router action is dispatched during render.
- Legacy org plan IDs cannot crash the onboarding page.

---

### F29 - Onboarding Division Rows Lack Labels And Pool Expansion

Priority: High

Category:
- UX copy
- Product flow
- Technical bug

Problem:
The onboarding create-tournament modal displayed capacity as a bare number and showed a Pools checkbox without expanding pool setup controls. The page also emitted a React key warning and the startup-progress API could return 500 before the startup task migration was applied.

User impact:
Owners may not know that `8` means team capacity, cannot configure pool names during the guided flow, and see noisy console errors during first-run setup.

Recommended fix:
Add compact row headers, expand pool controls inline when Pools is checked, fix the list keys, and make startup progress tolerant of a missing migration during dev walkthroughs.

Implemented fix:
- Added Use / Division / Capacity / Pools headers.
- Added pool count, registrant-picks-pool, and pool-name fields under checked division rows.
- Added keys to generated startup workflow steps.
- Startup task API now returns computed progress when `organizations.startup_tasks` is unavailable.

Acceptance criteria:
- Capacity column is labeled.
- Checking Pools reveals pool configuration controls.
- Pool count and pool names are saved with the tournament setup payload.
- Console no longer shows the React key warning from onboarding.
- Missing `026_startup_tasks.sql` no longer causes onboarding startup progress GETs to 500.

---

### F30 - Subscription Plan Cards Drift From Onboarding Plan Chooser

Priority: Low

Category:
- Visual design
- Billing/plan selection

Problem:
The Subscription upgrade cards kept an older promotional format: Club had a `Most Popular` badge and featured card treatment, while upgrade buttons mixed outline and primary styles. This no longer matched the cleaner plan chooser in first-run onboarding.

User impact:
Owners see two different plan-selection patterns in the same product, which makes the subscription page feel less trustworthy and can imply that Club is being recommended when the wizard intentionally avoids that nudge.

Recommended fix:
Use the same neutral plan-card treatment and the same primary CTA style for every upgrade option. Remove the `Most Popular` badge.

Implemented fix:
- Removed the Club-only featured treatment and `Most Popular` badge.
- Updated all upgrade CTAs to use the same primary button style.
- Tightened card typography and spacing to match the onboarding plan chooser more closely.

Acceptance criteria:
- Subscription upgrade cards use consistent visual hierarchy across Tournament Plus, League, and Club.
- All upgrade buttons use the same style.
- No plan is marked as `Most Popular`.

---

### F31 - Subscription Page Suggests Ad Hoc Module Purchases

Priority: Medium

Category:
- Billing/plan selection
- Product flow
- UX copy

Problem:
The Subscription page still showed a separate Modules section with module-level upgrade/request actions, even though modules are now bundled by plan rather than sold or enabled ad hoc.

User impact:
Owners may think they can buy or request individual modules outside the plan structure, which conflicts with the current packaging model and adds unnecessary decision noise.

Recommended fix:
Remove the Modules section from Subscription and keep plan upgrades as the single path for unlocking bundled capabilities.

Implemented fix:
- Removed the module explainer callout and module list from the Subscription page.
- Removed module-specific upgrade UI and related styles.
- Updated the Subscription page subtitle to reference plan and payment method only.

Acceptance criteria:
- Subscription page no longer shows a standalone Modules section.
- Users upgrade via plan cards, not module rows.
- Subscription copy does not imply ad hoc module activation.

---

### F32 - Tournament Setup Save Flashes Obsolete Get Started Page

Priority: High

Category:
- Product flow
- Onboarding logic
- Technical bug

Problem:
After saving the tournament setup wizard, the onboarding route briefly rendered the old “get started” shell before redirecting to tournament admin. That shell also still offered a manual `Start setup` entry point even though tournament onboarding now lives inside the step-by-step modal workflow.

User impact:
Owners can think the wizard restarted or failed after saving. The flash also undermines the expectation that the final review is the last onboarding screen before entering tournament admin.

Recommended fix:
Keep the wizard mounted until the final route transition begins, use `router.replace` for the post-save transition, and remove the obsolete tournament get-started screen from the render path.

Implemented fix:
- Added an explicit tournament-workflow redirect state.
- Switched final wizard exits to `router.replace`.
- Routed skipped tournament setup to Tournament Management instead of back to onboarding.
- Removed the tournament `Start setup` shell and its unused styles.
- Tournament-plan onboarding now renders only the wizard overlay or a brief “Opening tournament admin” transition state.

Acceptance criteria:
- Saving setup does not flash the old get-started page.
- Tournament and Tournament Plus owners do not see the org admin hub as a transient destination.
- Closing or finishing tournament onboarding leaves the onboarding route without showing a stale setup launcher.

---

### F33 - Tournament Admin Needs Admin-Only Site Preview

Priority: Medium

Category:
- Product flow
- Visual design
- Onboarding logic

Problem:
Tournament admin still showed a generic `Back to Site` footer link, which sends owners toward the public organization URL rather than helping them review the tournament page they are preparing. Active tournament preview links could also point at the public-facing URL instead of an admin preview URL.

User impact:
Draft tournament owners need a safe way to review what the tournament page will look like before activation. Sending them to the public site is confusing for draft tournaments and risky as a habit for content review.

Recommended fix:
Replace `Back to Site` in tournament admin with `Preview Site`, open it in a new window, and route both draft and active previews through an authenticated admin preview URL.

Implemented fix:
- Tournament admin sidebar now shows `Preview Site` instead of `Back to Site`.
- Preview opens in a new window at `/admin/tournaments/preview/[tournamentSlug]`.
- The mobile tournament menu includes the same preview action.
- Tournament Records preview links now use the admin preview URL for both draft and active tournaments.
- Admin chrome is hidden on preview routes so the new window reads like a tournament site preview while remaining admin-gated.
- Preview banner copy now works for both draft and active tournaments.
- Admin preview slug lookup now uses the server-side service client after auth succeeds, so draft tournaments do not 404 due to public/RLS filtering.

Acceptance criteria:
- Tournament admin pages do not show `Back to Site`.
- `Preview Site` opens an admin preview in a new window.
- Draft and active tournaments both preview from an admin URL.
- Draft preview remains accessible only to authenticated admins with tournament access.
- Preview route resolves draft tournaments owned by the current org.

---

### F34 - Admin Preview Uses Public Reads And Missing Preview Chrome

Priority: High

Category:
- Technical bug
- Visual design
- Product flow

Problem:
The authenticated tournament preview rendered the shared public tournament homepage, but the page's supporting reads for announcements, games, teams, divisions, and diamonds still used the anonymous client. Draft previews could therefore show console permission errors. The preview also lacked a tournament navbar, and the admin preview banner appeared beside the countdown badge instead of above it.

User impact:
Owners reviewing a draft see noisy errors and a page that does not fully resemble the tournament site they are preparing to launch.

Recommended fix:
Keep public pages on public reads, but let the authenticated admin preview pass an admin-read option to the shared homepage data loaders. Add preview navigation and center the admin preview notice above the tournament date/countdown badge.

Implemented fix:
- Added an admin-read option to the shared tournament read helpers used by the preview.
- Updated the shared tournament homepage to use admin reads only when `isPreview` is true.
- Added a tournament preview navbar to the authenticated preview route.
- Forced the admin preview banner to render as its own centered row above the countdown/date badge.

Acceptance criteria:
- Admin previews of draft tournaments do not log anonymous permission errors for tournament child data.
- Public tournament pages still use normal public reads.
- Preview pages include tournament navigation.
- The admin preview banner is centered above the countdown/date badge.

---

### F35 - Division Age Limits Are Inferred From Division Names

Priority: Medium

Category:
- UX copy
- Data/auth
- Onboarding logic

Problem:
Setup inferred age ranges from labels like `U9` or defaulted adult divisions to broad numeric ranges. That fails for real-world naming patterns and does not let an owner express open-ended ranges like under 9 or 18+.

User impact:
Owners can save divisions with misleading age ranges, and public registration can show confusing labels such as `Ages 7-9` when the organizer only intended `U9`.

Recommended fix:
Add explicit optional min/max age fields wherever divisions are configured. Prefill sensible starter values, but let either side stay blank for open-ended ranges.

Implemented fix:
- Added optional From Age and To Age fields to the startup wizard division step.
- Prefilled youth starters with blank minimum and their upper age, and adult starters with `18+`.
- Sent explicit nullable min/max ages through the setup API instead of guessing from division names.
- Updated age-group admin forms to allow blank min/max ages.
- Updated registration labels to handle open-ended or blank age ranges cleanly.

Acceptance criteria:
- Owners can create `U9` as an under-9-style division without a forced lower bound.
- Owners can create `18+` by setting only a minimum age.
- Blank min/max values are stored as null, not guessed from the division name.
- Public registration does not display `null-null` or misleading age ranges.

---

### F36 - Tournament-Level Site Customization Is Missing

Priority: High

Category:
- Product flow
- Visual design
- Onboarding logic

Problem:
Site customization currently appears to be organization-scoped. There is no clear tournament-admin surface for per-tournament public-site theme, hero, copy, or page settings.

User impact:
An organization cannot brand each tournament independently. A red organization site, purple tournament, and blue tournament should be possible without forcing every tournament to inherit the same public presentation.

Recommended fix:
Add a tournament-level Site Settings area in tournament admin. Store tournament-specific theme and content overrides separately from organization theme fields, and have the tournament public page resolve tournament overrides first, then fall back to org defaults.

Status:
- Tracked as a follow-up feature. This likely needs a schema migration, admin UI, preview integration, and public-page theme resolution work.

Acceptance criteria:
- Tournament admin has a visible Customize Site or Site Settings entry.
- Each tournament can define its own theme preset/custom colors, hero/banner treatment, and tournament homepage copy.
- Public and admin preview tournament pages use tournament overrides when present.
- Organization public-site customization remains separate.

---

## Suggested Build Order

1. Fix dashboard quick links.
2. Gate public tournament pages and registration by tournament status.
3. Remove hardcoded emails and stale Starter copy.
4. Hide seed controls from production/customer flow.
5. Replace Battle of the Bats defaults with neutral first-run setup.
6. Fix pool count behavior.
7. Add tournament slug validation and unique index.
8. Adjust onboarding completion logic.
9. Improve public tournament hero CTA and sport-neutral copy.
10. Add org contact email collection/prompt.

---

## Verification Checklist

Use a fresh org account on the free Tournament plan.

- Signup copy says Tournament plan, not Starter.
- Onboarding sends owner toward first tournament setup.
- New tournament modal has no demo-specific copy.
- Seed/test controls are hidden.
- Creating a tournament creates expected divisions and no unexpected pool rows.
- Draft tournament public URL is not visible to anonymous users.
- Draft tournament registration cannot submit.
- Activating tournament makes the public page visible.
- Active tournament public page has a Register Team CTA.
- Registration closed/not-open state uses org/tournament contact email.
- Dashboard stat cards and quick actions route correctly.
- Duplicate tournament slugs are blocked with a friendly message.

---

## Out Of Scope For This Plan

- Payment collection for tournament registrations
- Full public site redesign
- Custom domain support
- Calendar sync
- Bulk registration operations
- Multi-sport rules engine
- Stripe annual billing implementation
