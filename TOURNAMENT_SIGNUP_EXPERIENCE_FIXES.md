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
