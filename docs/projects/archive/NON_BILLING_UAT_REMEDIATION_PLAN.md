# Non-Billing UAT Remediation Plan

## Summary

This work addresses the UAT findings that are not part of the payment, billing, or Stripe project. The current product builds successfully, but a few user journeys still have confusing failure modes or inconsistent access behavior: duplicate organization signup, public tournament data loading, official scorekeeper assignments, legacy admin routes, the Next.js proxy convention, and the lint quality gate.

The goal is to make these flows predictable before broader customer testing. Users should either reach the right workspace immediately or receive a clear, actionable message when something blocks them.

## Why It Matters

UAT should test the product experience, not force testers to interpret technical failures. Generic errors, empty public pages, mismatched role access, and duplicate admin paths make the platform feel less reliable than it is. Tightening these areas improves trust for new organizers, staff, officials, and public visitors.

## Scope

Included:

- Signup and organization URL collision handling.
- Public tournament and registration data reliability.
- Official scorekeeper assignment scoping.
- Legacy `/admin` route behavior.
- Next.js 16 `middleware` to `proxy` migration.
- Lint stabilization planning.

Excluded:

- Payment collection, subscription changes, Stripe checkout, Stripe portal, downgrade/cancel flows, and pricing-gate behavior.

## Phase 1 - Signup and Route Clarity

### 1. [x] Handle duplicate organization URLs before auth user creation

Problem: Signup derives the public organization URL from the organization name. If the generated URL is already taken, organization creation can fail after the auth user has already been created. The user may only see a generic "unexpected error" message, and the account may be left in a confusing partial state.

Proposed solution: Check whether the generated organization slug is available before creating the auth user. If unavailable, return a clear validation error and ask the user to adjust the organization name or public URL. Where possible, reserve rollback handling for any failures that happen after auth creation.

Expected outcome: New organizers immediately understand when their preferred public URL is unavailable and can correct it without contacting support or getting stuck with a partially created account.

### 2. [x] Retire or redirect the legacy `/admin` shell

Problem: The product now uses organization-scoped admin routes at `/{orgSlug}/admin`, but the older `/admin` route tree is still present. It is not protected by the same org-admin route middleware and can render a confusing admin shell that does not represent the current multi-tenant product path.

Proposed solution: Replace the legacy `/admin` entry points with a redirect into the normal auth destination flow. Authenticated users should land in their organization admin area, and unauthenticated users should land on sign-in with an appropriate return path. Any old static admin pages that are no longer reachable should be removed in a later cleanup pass.

Expected outcome: Users no longer encounter two different admin experiences. Bookmarked or mistyped `/admin` links recover gracefully and send people to the correct organization workspace.

## Phase 2 - Public Data Reliability

### 3. [x] Make public tournament reads deterministic

Problem: The build logged a Supabase permission error while reading the `tournaments` table. Several public and client-side helpers rely on the anon Supabase client returning organization and tournament records. In environments with stricter Data API grants, those helpers can silently return empty data, making public pages look unconfigured even when data exists.

Proposed solution: Move public organization and tournament reads behind server-side helpers or route handlers that use controlled service-role access and explicit public visibility checks. Keep write operations and private admin data protected by existing auth and scope guards.

Expected outcome: Public tournament pages, selectors, schedules, teams, rules, and registration forms load consistently across local, dev, and production environments.

### 4. [x] Harden public registration submission reads

Problem: The registration API validates tournament and division availability through anon Supabase reads before inserting the team record. If anon grants are missing or inconsistent, registration can fail for technical reasons instead of real business rules.

Proposed solution: Use server-side service-role reads for registration validation, then enforce public rules in the route: tournament must be active, the division must belong to that tournament, and the division must not be closed. Keep the existing slot claiming and waitlist logic, but ensure errors are business-facing and actionable.

Expected outcome: Teams attempting to register see clear messages such as "registration is closed" or "division is full," not generic database failures.

## Phase 3 - Role and Assignment Consistency

### 5. [x] Scope the official scorekeeper view to assigned tournaments

Problem: The official scorekeeper page currently chooses the active or first tournament for the organization and loads that tournament's games. The score submission API later enforces tournament assignment scope. This can produce a mismatch where officials see games they cannot submit, or do not see the tournament they were actually assigned to.

Proposed solution: Load official scorekeeper games through a scoped API that uses the authenticated user's assignment context. The page should show only games from tournaments the official can access. If an official has no assigned games for today, the empty state should say that directly.

Expected outcome: Officials see the right games the first time, and score submission succeeds whenever the visible game is editable. Tournament staff no longer have to explain why an official's score page shows the wrong schedule.

### 6. [x] Clarify official empty and blocked states

Problem: When an official has no games, no assigned tournaments, or only completed games, the UI can collapse these cases into a generic "no games" or "unable to load" state.

Proposed solution: Add distinct states for no assignment, no games today, filtered-out completed games, and access denied. Keep the page simple for field use, but make the reason obvious.

Expected outcome: Officials can self-diagnose whether they are waiting for assignments, looking on a no-game day, or need help from an admin.

## Phase 4 - Framework Compatibility and Quality Gates

### 7. [x] Migrate Next.js 16 middleware convention to proxy

Problem: The production build passes, but Next.js 16 warns that the `middleware` file convention is deprecated and should now use `proxy`. The bundled Next.js documentation says Proxy is the current convention and keeps the same request-interception role.

Proposed solution: Move the current middleware logic into the supported `proxy.ts` convention, preserving matchers, Supabase session refresh behavior, redirects, and request headers. Verify that org admin and platform admin redirects still behave the same.

Expected outcome: The app aligns with the installed Next.js version and avoids carrying a framework deprecation into future releases.

### 8. [x] Create a focused lint stabilization pass

Problem: `npm run lint` currently fails with hundreds of errors. Many are broad rule-adoption issues rather than direct UAT bugs, including explicit `any`, new React effect rules, and JSX escaping. Treating all lint failures as one emergency would distract from higher-value user fixes.

Proposed solution: Split lint cleanup into a dedicated pass. First decide which strict rules are intentional for this project. Then fix touched files opportunistically and address shared hotspots in batches, starting with files changed by the UAT remediation work.

Expected outcome: The lint gate becomes useful again without blocking urgent user-facing fixes. Future changes can rely on static checks instead of ignoring a permanently red quality signal.

## Customer Impact

- New organizers receive clear signup guidance when their public URL is unavailable.
- Public visitors and registering teams see reliable tournament information instead of empty or broken pages.
- Officials see only the games they are meant to score.
- Admin users always land in the correct organization workspace.
- The app stays aligned with the installed Next.js version.
- Developers regain confidence in lint output as a meaningful signal.

## Priority

High for Phase 1 and Phase 3 because they affect onboarding and operational trust during UAT. Phase 2 is also high if the current deployment continues showing Supabase permission warnings. Phase 4 is medium priority: important for maintainability, but less urgent than broken or confusing user journeys.

## Success Criteria

- Duplicate organization signup returns a specific, recoverable error before creating a stranded user.
- Visiting `/admin` no longer displays a separate legacy admin shell.
- Public tournament pages and registration forms load from reliable server-controlled reads.
- Registration validation errors reflect business rules, not database permission failures.
- Officials only see games from tournaments they are allowed to score.
- Next.js build no longer warns about the deprecated middleware convention.
- A follow-up lint pass has a clear rule strategy and an incremental cleanup path.
