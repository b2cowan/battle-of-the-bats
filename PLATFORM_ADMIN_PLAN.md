# Platform Admin Super-Admin Area — Implementation Plan

## Status
**PENDING USER APPROVAL** — Do not implement until approved.

---

## Auth Strategy: Option A — Email Allowlist via Environment Variable

**Chosen:** `PLATFORM_ADMIN_EMAILS=b2cowan@gmail.com` (comma-separated for future additions)

**Rationale:**
- Zero DB migrations or schema changes required.
- Consistent with how other privileged secrets are managed (`SUPABASE_SERVICE_ROLE_KEY`).
- Trivially revocable: remove the email from the env var and redeploy.
- Right-sized for a single-operator platform. If multi-seat platform admin is ever needed, migrate to a `platform_admins` table at that time.

---

## isPlatformAdmin Helper

**File:** `lib/platform-auth.ts` (new file)

```ts
import type { User } from '@supabase/supabase-js';

export function isPlatformAdmin(user: User | null): boolean {
  if (!user?.email) return false;
  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(user.email.toLowerCase());
}
```

Also export a server-only helper for API route guards:

```ts
export async function getPlatformAuthContext(): Promise<User | null> {
  // Uses cookies() + anon client to get the current user, same pattern as getAuthContext()
  // Returns the User if isPlatformAdmin, null otherwise
}
```

---

## Middleware Changes

**File:** `middleware.ts`

Add `/platform-admin/:path*` to the matcher config:

```ts
export const config = {
  matcher: ['/:slug/admin/:path*', '/auth/:path*', '/platform-admin/:path*'],
};
```

Add a guard block inside `middleware()`:

```ts
const isPlatformAdminRoute = pathname.startsWith('/platform-admin');
if (isPlatformAdminRoute) {
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (!isPlatformAdmin(user)) {
    // Authenticated but not a platform admin — return 403
    return new NextResponse('Forbidden', { status: 403 });
  }
}
```

> **Note:** `isPlatformAdmin` can be imported into middleware because it only reads from `process.env` and `user.email` — no DB calls, no `cookies()` usage. Safe in the Edge runtime.

---

## Complete File List

| File | Action | Notes |
|------|--------|-------|
| `lib/platform-auth.ts` | **Create** | `isPlatformAdmin()` helper + `getPlatformAuthContext()` for API routes |
| `middleware.ts` | **Edit** | Add `/platform-admin/:path*` matcher and guard block |
| `app/platform-admin/layout.tsx` | **Create** | Server component: auth gate + amber-accented sidebar nav |
| `app/platform-admin/page.tsx` | **Create** | Global Stats dashboard (total orgs, users, tournaments, teams) |
| `app/platform-admin/orgs/page.tsx` | **Create** | Org list table + inline plan override |
| `app/platform-admin/users/page.tsx` | **Create** | Supabase Auth user list + password reset link generator |
| `app/api/platform-admin/orgs/[id]/plan/route.ts` | **Create** | PATCH: update `plan_id` + `tournament_limit` |
| `app/api/platform-admin/users/[id]/reset/route.ts` | **Create** | POST: generate Supabase recovery link |
| `TODO.md` | **Edit** | Add one-line summary linking to this file |

---

## Feature Details

### Global Stats Page (`/platform-admin`)

Fetches via `supabaseAdmin` (bypasses RLS):
- Total organizations
- Total users (from `supabaseAdmin.auth.admin.listUsers()` — returns paginated list; use `count` from response)
- Total tournaments
- Total teams

Displayed as stat cards in the same grid pattern as the org admin dashboard, but with amber accents instead of blueprint-blue.

### Org Management Page (`/platform-admin/orgs`)

Table columns: Name | Slug | Plan | Tournament Limit | Status | Created At | Actions

**Plan Override UX — Inline row edit (no modal):**

Each row has a `<select>` for `plan_id` (starter / pro / elite) and a number input for `tournament_limit`. Defaults auto-fill when the plan select changes:
- `starter` → 1
- `pro` → 3
- `elite` → 10

Both fields are independently editable before the user clicks "Save." A single "Save" button per row sends a `PATCH` to `/api/platform-admin/orgs/[id]/plan` with `{ planId, tournamentLimit }`. On success the row updates in place; on error a red inline message appears.

The `subscription_status` column is read-only in this view (Stripe manages it; override is a plan/limit concern only).

### User Management Page (`/platform-admin/users`)

Uses `supabaseAdmin.auth.admin.listUsers()` with pagination (100 per page).

Table columns: Email | Created At | Last Sign In | Actions

**Password Reset Flow — Generate link, display in modal:**

Clicking "Reset Password" on a row calls `POST /api/platform-admin/users/[id]/reset`, which calls:

```ts
const { data } = await supabaseAdmin.auth.admin.generateLink({
  type: 'recovery',
  email: user.email,
});
// data.properties.action_link is the reset URL
```

The API returns the `action_link`. The UI displays it in an inline modal/drawer with a "Copy Link" button. The operator can then send it to the user via any channel (email, Slack, etc.). This avoids accidental email sends and gives the operator full control.

### API Route Guards

Both API routes use `getPlatformAuthContext()` from `lib/platform-auth.ts` before any mutation:

```ts
const user = await getPlatformAuthContext();
if (!user) return new Response('Forbidden', { status: 403 });
```

---

## Visual Design

- **Accent color:** Amber/orange (`text-amber-400`, `border-amber-500/40`) instead of blueprint-blue
- **Header label:** "PLATFORM NODE" instead of "System Node" — makes it unmistakable that you're in the operator area
- **Sidebar:** Three nav links: Overview · Organizations · Users
- **Layout:** Desktop-only; no mobile optimization. Fixed sidebar, scrollable main content.
- Otherwise matches the HUD aesthetic (`hud-label`, `font-mono`, `card` classes) from the existing design system.

---

## Build Order

1. `lib/platform-auth.ts` — helper functions (no deps)
2. `middleware.ts` — extend matcher and guard (depends on #1)
3. `app/platform-admin/layout.tsx` — server component auth gate + nav
4. `app/platform-admin/page.tsx` — global stats (simple reads)
5. `app/api/platform-admin/orgs/[id]/plan/route.ts` — needed by orgs page
6. `app/platform-admin/orgs/page.tsx` — org table + inline edit (depends on #5)
7. `app/api/platform-admin/users/[id]/reset/route.ts` — needed by users page
8. `app/platform-admin/users/page.tsx` — user table + reset (depends on #7)

---

## Environment Variable Required

Add to `.env.local` for development:
```
PLATFORM_ADMIN_EMAILS=b2cowan@gmail.com
```

Add to Amplify environment variables for production (same key/value).

---

## Test Cases for User Verification

1. **Unauthenticated access** — Visit `/platform-admin` while logged out → should redirect to `/auth/login?next=/platform-admin`
2. **Non-admin authenticated access** — Log in as a regular org user, visit `/platform-admin` → should get 403 Forbidden
3. **Platform admin access** — Log in as `b2cowan@gmail.com`, visit `/platform-admin` → stats dashboard loads
4. **Org sub-pages** — Navigate sidebar to Organizations and Users → both tables load data
5. **Plan override** — Change an org's plan from the Organizations page → select a plan, verify tournament_limit auto-fills, click Save → verify the DB row is updated (check Supabase dashboard)
6. **Custom tournament_limit** — Change plan, then manually edit the limit before saving → verify the custom value is persisted, not the plan default
7. **Password reset link** — Click Reset Password on a user → modal appears with a valid-looking link (starts with Supabase project URL)
8. **API direct access** — Hit `PATCH /api/platform-admin/orgs/[id]/plan` without a session (or with a non-admin session) → 403 response
9. **Wrong email in env** — Temporarily set `PLATFORM_ADMIN_EMAILS` to a different email → confirm your own account is locked out (then restore)
