# Tournament Coach Portal — Implementation Plan

**Created:** 2026-05-24  
**Status:** ✅ Complete — all phases shipped 2026-05-25  
**PM Brief:** `docs/active/TOURNAMENT_COACH_PORTAL_PM_BRIEF.md`

**Unified routing update:** This completed implementation is the shipped foundation for Basic Coaches Portal, but customer-facing routes now migrate into `/coaches`. Use `/coaches/join` for the account step, `/coaches/tournaments` for tournament records, and `/coaches/start` for paid Coaches Portal signup. Current `/my` routes should remain only as redirects or compatibility aliases.

**Next product direction:** Basic Coaches Portal should become team-centric. The shipped implementation finds tournament registrations by coach email; the next unified Coaches Portal phase should create or link a persistent Basic coach team profile when a coach creates/signs into their account after registration. Returning coaches should sign in during registration and select an existing team so that team's tournament history accumulates in one portal and can later upgrade into paid Coaches Portal tools.

---

## Core Decision

After a coach submits the tournament registration form, they are redirected to the lightweight Coaches Portal account creation page as step 2 of the registration journey. Creating an account is not optional; it is the next step. The shipped route is `/my/join`; the unified route target is `/coaches/join`.

---

## Phase 0 — Remove Workspace Invite ✅

**Goal:** Clean deletion before any new work. Remove all workspace claim infrastructure that was admin-triggered.

### Files changed

**`app/[orgSlug]/admin/tournaments/registrations/page.tsx`**
- Removed `TeamClaimInviteResult` type
- Removed `claimInviteResults` state
- Removed `sendSingleWorkspaceInvite()` function → replaced with `resendAccessLink()` (ExternalLink icon, per-row, any team with email)
- Removed `sendTeamClaimInvites()` function
- Removed bulk "Workspace Invite" button from `SelectionActionBar`
- Removed `claimInviteResults` results panel from JSX
- Added `ExternalLink` icon import

**`app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css`**
- Removed `.claimInvitePanel`, `.claimInviteHeader`, `.claimInviteList`, `.claimInviteItem`, `.claimInviteMore` and responsive overrides

**`app/api/admin/tournaments/[tournamentId]/team-claims/route.ts`**
- **Deleted entirely** — no longer needed

**`app/api/register/route.ts`**
- Removed `createTournamentTeamWorkspaceClaim` / `buildTeamWorkspaceClaimUrl` imports
- Removed workspace claim creation block (lines ~441-455)
- Changed `registrationConfirmationHtml` call: replaced `teamWorkspaceClaimUrl` param with `coachEmail: email`

**`app/[orgSlug]/[tournamentSlug]/register/page.tsx`**
- Removed `RegistrationConfirmationCta` import
- Removed success step UI block entirely
- Changed `Step` type: removed `'success'`
- After successful API response, redirects to `/my/join?email=...&next=/my/registrations&registered=1`

**`lib/email.ts`**
- `registrationConfirmationHtml`: replaced `teamWorkspaceClaimUrl` param with `coachEmail`; builds `/my/join?email=...` link in email
- `acceptanceHtml`: replaced hard-coded `/teams/[teamId]` link with `dashboardUrl` param (defaults to `/my/registrations`)
- Removed `teamWorkspaceClaimInviteHtml()` entirely
- Added `coachAccessReminderHtml()` — used by the resend-access admin action

---

## Phase A - Lightweight Join Page Complete

**Goal:** Lightweight account creation page for tournament coaches.

### Files created/changed

**`app/my/join/page.tsx`**
- Two header layouts controlled by `?registered=1` param
- Email pre-filled from `?email=` (editable)
- Password field (min 8 chars)
- On submit: POST to `/api/auth/coach-signup`
- On `409` response (email exists): redirect to `/auth/login?next=...&email=...`
- On success: sign in via `signIn()` and push to `?next` destination
- "Already have an account? Sign in instead →" footer link

**`app/api/auth/coach-signup/route.ts`**
- POST `{ email, password }`
- Calls `supabaseAdmin.auth.admin.createUser({ email_confirm: true })`
- Returns `409 { error: 'email_exists' }` if Supabase reports duplicate
- Returns `400` for missing/invalid inputs

**`app/auth/login/page.tsx`**
- Updated to pre-fill email from `?email=` query param

---

## Phase B — /my/registrations Dashboard ✅

**Goal:** Coach's personal dashboard showing all registrations by email.

### Files created/changed

**`proxy.ts`**
- Added `/my` and `/my/:path*` to the config `matcher`
- Added guard: `segments[0] === 'my' && segments[1] !== 'join' && !user` → redirect to `/auth/login?next=pathname`
- `/my/join` stays public (no auth required)

**`app/my/registrations/page.tsx`** (Server Component)
- Auth check via `createClient().auth.getUser()`
- Queries `teams WHERE email ILIKE user.email ORDER BY registered_at DESC`
- Fetches tournaments + orgs in parallel
- Splits into active/upcoming vs past sections
- Empty state with helpful message
- CTAs: Coaches Portal (`/coaches/start`) + Tournament Hosting (`/pricing`)

**`app/my/registrations/registrations.module.css`**

**`app/my/registrations/[teamId]/page.tsx`** (Server Component)
- Verifies `team.email ILIKE user.email` — 404 if mismatch
- Parallel fetches: tournament, division, announcements, games
- Shows: status card with contextual description, registration details, schedule (if `schedule_visibility` is published), announcements (filtered by `division_ids`), CTAs
- Acceptance email CTA button links to `/my/registrations`

**`app/my/registrations/[teamId]/detail.module.css`**

---

## Phase C — CTAs ✅

Embedded directly in the registrations pages:

| CTA | Target | Shown when |
|---|---|---|
| Coaches Portal | `/coaches/start` | Always (registrations list) or accepted (detail) |
| Host a Tournament | `/pricing` | Always |

> **Note:** The unified route target is `/coaches/start`.

---

## Phase D — Auth Destination Routing ✅

**`lib/auth-destination.ts`**
- Added `checkHasTournamentRegistrations(email)` helper: queries `teams` by email
- `getAuthDestination()`: when user has no org memberships, checks tournament registrations before falling back to `/auth/signup`
  - current shipped destination: `/my/registrations`
  - unified destination: `/coaches/tournaments`
  - no regs → `/auth/signup` (existing behavior)

**`app/auth/select-org/page.tsx`**
- Added tournament registration check for users who have both org memberships AND coach registrations
- Shows "Tournament Registrations" entry at the top of the workspace list when applicable

---

## Phase E — Email + Resend Access ✅

**`app/api/admin/tournaments/[tournamentId]/registrations/[regId]/resend-access/route.ts`**
- POST route; per-registration only (not bulk)
- Auth guard: `manage_registrations` OR `create_tournaments` capability
- Scope guard: tournament must belong to the admin's org; team must belong to the tournament
- Sends `coachAccessReminderHtml` with:
  - current shipped `joinUrl`: `/my/join?email=...&next=/my/registrations`
  - unified `joinUrl`: `/coaches/join?email=...&next=/coaches/tournaments`
  - unified `loginUrl`: `/auth/login?next=/coaches/tournaments`

---

## What did NOT change

- `lib/team-workspace-claims.ts` — kept intact for the existing paid claim flow until it is migrated into `/coaches`
- `components/marketing/RegistrationConfirmationCta.tsx` — orphaned but kept; safe to delete in a future cleanup
- Tournament registration form fields — unchanged
- Registration API response — unchanged (`{ ok, id, status }`)
- All admin registration capabilities (accept/reject/waitlist/bulk) — unchanged

---

## Follow-on tasks

- [x] Move or wrap `/my/join` at `/coaches/join`; keep `/my/join` only as a redirect or compatibility alias.
- [x] Move or wrap `/my/registrations` at `/coaches/tournaments`; keep `/my/registrations` only as a redirect or compatibility alias.
- [x] Update all Coaches Portal CTA URLs to `/coaches/start`.
- [x] Add `not-found.tsx` under the registration detail route for cleaner 404 UX.
- [x] Add a `/my/` index redirect to `/coaches/tournaments`.
- [ ] Supersede email-only registration lookup with persistent Basic coach team profiles and explicit user/team/registration links, tracked as Phase 2B in `docs/active/COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md`.
