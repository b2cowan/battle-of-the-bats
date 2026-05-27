# Tournament Coach Portal — Implementation Plan

**Created:** 2026-05-24  
**Status:** Planning  
**Related PM brief:** `docs/projects/active/TOURNAMENT_COACH_PORTAL_PM_BRIEF.md`

---

## Core Decision: Authenticated Coach Accounts, Not Token Pages

After a coach submits the tournament registration form, they are **immediately redirected** to `/my/join` — the lightweight account creation page — as step 2 of the registration journey. Account creation is not optional; it's the natural completion of the flow. The confirmation email is sent at form submission time regardless, so a coach who closes the browser mid-account-creation still has their registration saved.

The `/my/join` page, when arrived at from registration (via `?registered=1`), leads with confirmation that the registration was submitted before presenting the account creation form. It also has "Already have an account? Sign in" for returning coaches.

Authentication gives coaches:
- Cross-tournament history across all orgs and all years
- Personalized data inaccessible to the public (their schedule only, payment status, etc.)
- A persistent identity the platform can re-engage and build features on top of
- A natural on-ramp to the Coaches Portal and Tournament hosting products

The `/r/[token]` approach and `status_token` DB column from earlier drafts are **not needed**.

---

## Why Not the Existing `/auth/signup`?

The existing `/auth/signup` page creates an **organization** — it collects Organization Name, Public URL slug, email, and password. That's the wrong context for a tournament coach. Sending a coach there would be confusing and would create an unwanted org account.

We need a new lightweight signup page at **`/my/join`** that:
- Collects email and password only (no org)
- Pre-fills email from a `?email=` query param passed from the registration success screen
- Accepts a `?next=` param (defaults to `/my/registrations`)
- Creates a Supabase Auth user with no org membership
- Has an "Already have an account? Sign in" link
- On success: redirects to `?next=`

---

## What the "Workspace Invite" button currently does (and why it's being removed)

The admin Registrations page has a bulk "Workspace Invite" action and a per-row mail icon. When triggered it creates `team_workspace_claims` records and emails coaches a link to `/team/claim/[token]` — the Stripe Team workspace checkout. The registration confirmation email also includes this link automatically.

**Decision:** Remove admin-triggered workspace invite entirely. Tournament organizers should not be pushing FieldLogicHQ products on coaches from other clubs. Upsells are the platform's responsibility, surfaced through the authenticated coach dashboard. The only legitimate admin action is resending a coach their access link if they ask.

The `team_workspace_claims` infrastructure and `/team/claim/[token]` flow stay — they're valid entry points from the coach dashboard CTA and marketing. Only the admin-triggered sending is removed.

---

## Architecture: Email as the Stable Identity Key

A coach's email on their `teams` registration record is their identity key. After account creation, every `teams` record where `email = auth.user.email` belongs to them — no foreign key needed for Phase 1. Email is already lowercased at insert time in `/api/register/route.ts`.

---

## Dependency: Coaches Portal URL Project

There is a planned (but not yet documented) project to change the coaches portal URL from `/{orgSlug}/coaches/` to `/coaches/`. The coach dashboard CTAs in this plan reference `/coaches` as the target URL. **Until that project ships, the Coaches Portal CTA should link to `/team`** (the current path for standalone Team workspace signup/access).

When the coaches portal URL project is completed, update the CTA link in `app/my/registrations/[teamId]/page.tsx` from `/team` to `/coaches`.

---

## Phase 0 — Remove Workspace Invite

Clean deletion before any new work.

### `app/[orgSlug]/admin/tournaments/registrations/page.tsx`

Remove:
- `TeamClaimInviteResult` type
- `claimInviteResults` state and all references
- `sendSingleWorkspaceInvite(team)` function and its per-row Mail icon button (~line 1037)
- `sendTeamClaimInvites()` function
- The bulk "Workspace Invite" button in `SelectionActionBar` (~lines 1406–1413)
- The `claimInviteResults` results panel UI block (~lines 1419–1441)
- The `working === 'team-claims'` disabled guard references on other buttons

### `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css`

Remove: `.claimInvitePanel`, `.claimInviteHeader`, `.claimInviteList`, `.claimInviteItem`, `.claimInviteMore` and all responsive overrides for these classes.

### `lib/email.ts`

Remove: `teamWorkspaceClaimInviteHtml()` export (only consumed by the now-deleted API route).

### `app/api/register/route.ts`

Remove:
- Import of `createTournamentTeamWorkspaceClaim` and `buildTeamWorkspaceClaimUrl`
- The workspace claim creation block (the `if (!isWaitlist && data?.id)` block ~lines 441–455)
- The `teamWorkspaceClaimUrl` variable and argument from `registrationConfirmationHtml()`

Note: `registrationConfirmationHtml` now temporarily has no status/dashboard link. This is corrected in Phase C when confirmation emails get the new dashboard CTA.

### `app/[orgSlug]/[tournamentSlug]/register/page.tsx`

**Replace the `setStep('success')` call** with an immediate redirect to `/my/join`:

```typescript
// On successful API response, instead of setStep('success'):
const joinUrl = new URL('/my/join', window.location.origin);
joinUrl.searchParams.set('email', form.email);
joinUrl.searchParams.set('next', '/my/registrations');
joinUrl.searchParams.set('registered', '1'); // signals to /my/join that this is post-registration
router.push(joinUrl.toString());
```

The existing `step === 'success'` UI block can be removed entirely. Keep `step === 'error'` and `step === 'submitting'` unchanged.

Remove the `<RegistrationConfirmationCta />` import — it is no longer used on this page.

### Delete

`app/api/admin/tournaments/[tournamentId]/team-claims/route.ts` — entire file.

### Leave untouched

`lib/team-workspace-claims.ts`, `app/team/claim/[token]/page.tsx`, `app/team/TeamSignupClient.tsx`, `components/marketing/RegistrationConfirmationCta.tsx` (the component file itself can stay — it's just removed from the registration success screen import).

---

## Phase A — Lightweight Coach Account Signup Page

### New file: `app/my/join/page.tsx`

Simple email + password form. No org fields. Two distinct layouts depending on `?registered=1`.

**When `?registered=1` (arriving from tournament registration):**
```
┌────────────────────────────────────────┐
│  ✓  Registration submitted!            │
│  Check your email for a confirmation.  │
│                                        │
│  Create your account to track it       │
│  ─────────────────────────────────     │
│  Email *                               │
│  [pre-filled from ?email=, editable]   │
│                                        │
│  Password *  (min 8 characters)        │
│  [_________________________________]   │
│                                        │
│  [Create account →]                    │
│                                        │
│  Already have an account? Sign in      │
└────────────────────────────────────────┘
```

**When arriving directly (no `?registered=1`):**
```
┌────────────────────────────────────────┐
│  🏆  FieldLogicHQ                      │
│                                        │
│  Create your account                   │
│  Track your registrations, schedule,   │
│  and tournament history in one place.  │
│                                        │
│  Email *                               │
│  [pre-filled from ?email= if present]  │
│                                        │
│  Password *  (min 8 characters)        │
│  [_________________________________]   │
│                                        │
│  [Create account →]                    │
│                                        │
│  Already have an account? Sign in      │
└────────────────────────────────────────┘
```

**Behaviour:**
- On submit: POST to `/api/auth/coach-signup` (new route below)
- On success: sign in the new user client-side, then redirect to `?next=` param (default `/my/registrations`)
- On "email already registered" error: show inline message — "An account with this email already exists." with a [Sign in instead →] link to `/auth/login?next=[next]`
- Uses existing `auth.module.css` styles — no new CSS needed

**Query params accepted:**
- `?email=` — pre-fills the email field (URL-decoded); field remains editable so a coach can use a different account email than their registration contact email
- `?next=` — redirect destination after signup (validated against an allowlist of internal paths; defaults to `/my/registrations`)
- `?registered=1` — shows the "Registration submitted! ✓" confirmation header

### New file: `app/api/auth/coach-signup/route.ts`

```typescript
// POST { email, password }
// Creates a Supabase Auth user with no org membership.
// email_confirm: true — skips email verification (intent confirmed by registration).
// Returns: { ok: true } on success, { error: string } on failure.

const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: email.trim().toLowerCase(),
  password,
  email_confirm: true,
});
```

Error handling:
- `User already registered` / `email_exists` → return `{ error: 'email_exists' }` with 409
- Password too short → return `{ error: 'password_too_short' }` with 400
- Other → return `{ error: 'signup_failed' }` with 500

The client page handles `email_exists` by showing the "sign in instead" prompt inline. No additional email verification email is sent.

---

## Phase B — Coach Dashboard: `/my/registrations`

### New route tree

```
app/my/layout.tsx                          — auth guard: redirects to /auth/login?next=/my/registrations
app/my/registrations/page.tsx              — server component: all registrations for this coach
app/my/registrations/[teamId]/page.tsx     — server component: registration detail view
app/my/registrations/my-registrations.module.css
```

**Note on `/my/` route name:** Chosen over `/coach/` because this section is identity-first, not role-first. A user who is both a tournament coach and a rep team coach has one `/my/` section. It can expand to "my schedule", "my documents" etc. later.

### `app/my/layout.tsx`

```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect(`/auth/login?next=${encodeURIComponent(pathname)}`);
```

### `app/my/registrations/page.tsx` — data query

```typescript
// All tournament registrations tied to this coach's email
const { data: registrations } = await supabaseAdmin
  .from('teams')
  .select(`
    id, name, coach, email, status, payment_status, registered_at, waitlist_position,
    age_groups!age_group_id(id, name),
    tournaments!tournament_id(
      id, name, slug, start_date, end_date, location, status,
      organizations!org_id(id, name, slug)
    )
  `)
  .eq('email', user.email.toLowerCase())
  .order('registered_at', { ascending: false });
```

### Dashboard layout

**Active registrations** (tournaments not archived, ordered by start_date ascending — soonest first):

```
┌─────────────────────────────────────────────────────────┐
│  Milton Invitational Softball 2026          ● ACCEPTED  │
│  Eagles U11 · U11 Division · Jun 14–15, Milton ON       │
│                              [View registration →]      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Durham Summer Classic                      ○ PENDING   │
│  Hawks U13 · U13 Division · Jul 7–8, Oshawa ON          │
│                              [View registration →]      │
└─────────────────────────────────────────────────────────┘
```

**Past registrations** — collapsed section, expandable. Shows completed/archived tournament entries.

**Empty state:** "No tournament registrations yet. Register your team for an upcoming tournament to get started."

### `app/my/registrations/[teamId]/page.tsx` — registration detail

Auth guard: verify `teams.email = user.email` before rendering. If mismatch → 404 (never expose another coach's data).

**Page sections in order:**

1. **Status card** — large status badge + contextual copy:
   - `pending` → "Your registration is under review. The organizer will be in touch soon."
   - `accepted` → "You're in! Your schedule will appear below once the organizer publishes it."
   - `waitlist` → "You're on the waitlist at position #N. You'll be notified if a spot opens up."
   - `rejected` → "Your registration was not accepted for this tournament. Contact the organizer with any questions."

2. **Registration details** — team name, coach name, division, tournament name, dates, location, registered date, payment status (if not pending)

3. **Schedule** — games where `home_team_id = team.id OR away_team_id = team.id`, ordered by date/time:
   ```sql
   SELECT g.id, g.game_date, g.game_time, g.status, g.score_finalized,
          g.home_score, g.away_score, g.home_team_id, g.away_team_id,
          ht.name AS home_team_name, at.name AS away_team_name, d.name AS diamond_name
   FROM games g
   JOIN teams ht ON g.home_team_id = ht.id
   JOIN teams at ON g.away_team_id = at.id
   LEFT JOIN diamonds d ON g.diamond_id = d.id
   WHERE (g.home_team_id = $teamId OR g.away_team_id = $teamId)
     AND g.tournament_id = $tournamentId
   ORDER BY g.game_date ASC, g.game_time ASC;
   ```
   Empty state: "Schedule not published yet. Check back closer to the tournament."

4. **Announcements** — `announcements WHERE tournament_id = tournament.id`, pinned first, newest after. Empty state: no section rendered (not shown at all when there are no announcements).

5. **CTAs** — see Phase C below.

6. **Footer** — tournament contact email + link to public tournament page `/{orgSlug}/{tournamentSlug}`

---

## Phase C — Coach Dashboard CTAs

Two CTAs placed at the bottom of the detail view, after announcements. Also appear as smaller chips in the listing card.

### CTA 1 — Coaches Portal

> **Take your season further than the tournament**  
> Roster management, game-day lineups, player dues, budget tracking, attendance, and team documents — all in a coach-owned workspace that's yours year-round.  
> **[Explore the Coaches Portal →]**

**Link target:**
- **Until coaches portal URL project ships:** `/team`
- **After coaches portal URL project ships:** `/coaches`

**Display rule:** Show when registration `status = 'accepted'`. Suppress if the coach already has an active Team workspace or org-assigned coach role (query `organization_members WHERE user_id = auth.user.id LIMIT 1` — if any result, they're already in the system).

**Visual weight:** Primary CTA — prominent card or highlighted block.

### CTA 2 — Tournament Hosting

> **Ready to run your own tournament?**  
> FieldLogicHQ gives organizers a complete platform — registration, pool play, brackets, scorekeeping, schedule builder, and team communications.  
> **[See what's included →]**

**Link target:** `/for-tournament-organizers` when that landing page ships; `/pricing` until then.

**Display rule:** Always shown, regardless of status. Lower visual weight than CTA 1.

**Suppress if:** The user already has an org with a tournament plan (they're an organizer already). Check `organization_members` same as CTA 1.

### In the listing view

Each registration card shows micro-CTAs below the status line:
- Accepted + no workspace: small "Coaches Portal ↗" chip
- Any status: small "Run a tournament? ↗" text link

---

## Phase D — Auth Destination Routing

`lib/auth-destination.ts` → `getAuthDestination()` currently sends users with no org memberships to `/auth/signup` (which creates an org — wrong for tournament coaches).

**Add:** Check for tournament registrations before sending to `/auth/signup`.

```typescript
// In getAuthDestination(), after members.length === 0 check:
if (!members || members.length === 0) {
  const hasTournamentRegs = await checkHasTournamentRegistrations(user.email);
  if (hasTournamentRegs) return '/my/registrations';
  return '/auth/signup';
}

async function checkHasTournamentRegistrations(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const { count } = await supabaseAdmin
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.toLowerCase())
    .limit(1);
  return (count ?? 0) > 0;
}
```

**`app/auth/select-org/page.tsx`:** If a user has org memberships AND tournament registrations, add a "Tournament Registrations" entry alongside org cards pointing to `/my/registrations`.

---

## Phase E — Email Updates

### Registration confirmation email (`lib/email.ts`)

Replace the `teamWorkspaceClaimUrl` param (removed in Phase 0) with a `dashboardUrl` pointing to `/my/join?email=[email]&next=/my/registrations` for new coaches (always), and `/my/registrations` as the sign-in destination.

New email layout:
```
[Registration received heading — existing]
[Registration details block — existing]
[Dashboard CTA block — NEW]
  "Track your registration status, see your schedule once it's published,
   and get tournament announcements in your FieldLogicHQ dashboard."
  [Create your free account →]   → /my/join?email=[email]&next=/my/registrations
  [Already have an account? Sign in →]  → /auth/login?next=/my/registrations
[Payment note — existing]
```

Parameter change:
```typescript
export function registrationConfirmationHtml(p: {
  teamName: string;
  coachName: string;
  ageGroupName: string;
  tournamentName: string;
  coachEmail: string;          // NEW — used to build ?email= param
  contactEmail?: string;
  // teamWorkspaceClaimUrl removed
})
```

### Acceptance email (`lib/email.ts`)

`acceptanceHtml` currently sends coaches to `/teams/[teamId]` (public team profile — not coach-specific).

**Update:** Replace "View Team Profile" → `/teams/[id]` with "View your registration" → `/my/registrations` (or `/auth/login?next=/my/registrations` if not authenticated — the login page handles the redirect).

```typescript
export function acceptanceHtml(p: {
  teamName: string;
  coachName: string;
  ageGroupName: string;
  tournamentName: string;
  dashboardUrl: string;   // replaces teamId/profileUrl — use /my/registrations or /auth/login?next=/my/registrations
  contactEmail?: string;
})
```

### Admin "Resend access link" (replaces per-row workspace invite icon)

New email template: `coachAccessReminderHtml({ teamName, coachName, tournamentName, joinUrl, loginUrl })`

New API: `app/api/admin/tournaments/[tournamentId]/registrations/[regId]/resend-access/route.ts`
- POST only, per-registration (no bulk)
- Auth: org admin or tournament manager
- Sends the reminder email to `teams.email`
- `joinUrl` = `/my/join?email=[email]&next=/my/registrations`
- `loginUrl` = `/auth/login?next=/my/registrations`

Admin UI: Replace per-row workspace invite Mail icon with "Resend access link" icon button (same position, `Link` icon, tooltip "Resend dashboard access link").

---

## Complete File Map

### Files to delete

| File | Reason |
|---|---|
| `app/api/admin/tournaments/[tournamentId]/team-claims/route.ts` | Admin workspace invite API — removed entirely |

### Files to create

| File | Phase | Purpose |
|---|---|---|
| `app/my/join/page.tsx` | A | Lightweight coach signup (email + password, no org) |
| `app/api/auth/coach-signup/route.ts` | A | Creates Supabase Auth user without org, email_confirm: true |
| `app/my/layout.tsx` | B | Auth guard for /my/ route tree |
| `app/my/registrations/page.tsx` | B | Coach dashboard — all tournament registrations |
| `app/my/registrations/[teamId]/page.tsx` | B | Registration detail view |
| `app/my/registrations/my-registrations.module.css` | B | Scoped styles |
| `app/api/admin/tournaments/[tournamentId]/registrations/[regId]/resend-access/route.ts` | E | Resend access link to coach |

### Files to modify

| File | Phase | Change |
|---|---|---|
| `app/[orgSlug]/admin/tournaments/registrations/page.tsx` | 0, E | Remove all workspace invite UI; add resend-access per-row button |
| `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css` | 0 | Remove claimInvite* CSS classes |
| `lib/email.ts` | 0, E | Remove `teamWorkspaceClaimInviteHtml`; update `registrationConfirmationHtml` (add coachEmail param) and `acceptanceHtml` (add dashboardUrl param); add `coachAccessReminderHtml` |
| `app/api/register/route.ts` | 0, E | Remove workspace claim creation; pass `coachEmail` to confirmation email |
| `app/[orgSlug]/[tournamentSlug]/register/page.tsx` | 0 | Remove `RegistrationConfirmationCta`; add account creation + sign-in CTAs on success screen |
| `lib/auth-destination.ts` | D | Handle no-org case with tournament registration check |
| `app/auth/select-org/page.tsx` | D | Add "Tournament Registrations" option for multi-identity users |
| `app/api/dev/seed/status/route.ts` | 0 | Remove any team-claims references |

---

## Build Order

1. **Phase 0** — Remove workspace invite (bulk UI, per-row icon, API route, email template, workspace claim in registration API, success screen CTA)
2. **Phase A** — `/my/join` page + `coach-signup` API
3. **Phase B** — `/my/` layout + `/my/registrations` dashboard + `[teamId]` detail view
4. **Phase C** — CTAs on detail view and listing cards (link to `/team` until coaches URL project ships, then update to `/coaches`)
5. **Phase D** — Auth destination routing fix + select-org page update
6. **Phase E** — Email template updates + resend-access admin action
7. **Smoke test** — Register test team → success screen shows account CTAs → `/my/join?email=...` pre-fills email → account created → redirect to `/my/registrations` → registration visible → acceptance email links to dashboard → admin resend-access sends correct email

---

## Open Decisions Before Build

1. **`/my/` or `/coach/` route?** — `/my/` recommended (identity-first, not role-specific; expandable); confirm before starting Phase B
2. **Tournament Hosting CTA link** — `/for-tournament-organizers` (not built) or `/pricing` until landing page ships?
3. **Coaches Portal CTA suppression** — query `organization_members` server-side on each detail view load, or add a top-level `hasOrgAccess` boolean to the `/my/` layout and pass down?
4. **`/my/join` email field** — allow editing after pre-fill? (Recommended: yes — coach may want to use a different email for their account than they put on the registration)

---

## Out of Scope (this plan)

- Inline password collection during tournament registration
- Magic link / passwordless auth for coaches
- `coach_user_id` FK on `teams` table (email match is sufficient for Phase 1)
- House league coach accounts
- Score entry or write actions from the coach dashboard
- Push notifications or in-app messaging to coaches
- Coaches portal URL change project (tracked separately; update CTA link when it ships)
