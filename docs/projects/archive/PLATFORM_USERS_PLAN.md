# Platform Company Users — Implementation Plan

## Goal
Replace the `PLATFORM_ADMIN_EMAILS` env-var allowlist with a managed `platform_users` DB table, with a UI inside platform admin to invite/deactivate/remove FieldLogicHQ staff. One bootstrap email stays in the env var as a permanent fallback.

## Build Order

### Step 1 — DB migration (run in Supabase SQL editor)
Migration 022: `platform_users` table

### Step 2 — Types + DB helpers
- `PlatformUser` type in `lib/types.ts`
- CRUD helpers in `lib/db.ts`

### Step 3 — Auth layer
- Update `lib/platform-auth.ts`: `getPlatformAuthContext()` checks env var OR active DB row

### Step 4 — Login redirect
- New `GET /api/auth/destination` — returns correct post-login URL based on user context
- Update `app/auth/login/page.tsx` to call it instead of hardcoding `/admin`

### Step 5 — API routes
- `POST /api/platform-admin/company-users` — create auth user + platform_users row + send password reset email
- `PATCH /api/platform-admin/company-users/[id]` — toggle is_active
- `DELETE /api/platform-admin/company-users/[id]` — delete auth user + platform_users row

### Step 6 — UI
- Rewrite `app/platform-admin/users/page.tsx` + `UsersClient.tsx`
  - List from platform_users table
  - Invite modal (name + email)
  - Deactivate / Remove per row
  - Bootstrap user shown as non-removable

## Migration SQL (run manually in dev then prod)

```sql
CREATE TABLE IF NOT EXISTS platform_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role         TEXT NOT NULL DEFAULT 'admin',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  invited_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Key Decisions
- Env var `PLATFORM_ADMIN_EMAILS` stays as permanent bootstrap (can never be locked out via UI)
- Platform users have no org — login page calls `/api/auth/destination` to get the right redirect
- Deactivation is soft (is_active = false); auth account stays so password/2FA is preserved
- Invite flow: `supabaseAdmin.auth.admin.createUser` (email_confirm: true) + `generateLink` for password setup email
- Cannot remove the last active platform user via UI
