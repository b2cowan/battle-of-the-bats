# Staging Runbook — Platform-Admin Employee Audit

> Built 2026-06-13. Schema verified against the **live dev snapshot** (`docs/agents/db/schema-snapshots/schema-dump-columns-dev.json`), per the project rule (never decide column existence from migrations). Roles verified from `lib/platform-auth.ts` (code is authoritative).
> **Prerequisite:** `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`, dev server running with network access (Supabase EACCES caveat — see AGENTS.md), local/dev Supabase reachable.

## What we're staging and why

To walk least-privilege *as each role actually sees it* (nav + guards), we need a real login per role — not just super-admin reading the matrix. To walk the support seam against real data, we need feedback rows, observability error groups, and a change-request. All five target tables are confirmed present in the dev snapshot.

## 1. Roles — verified

`PlatformRole` (lib/platform-auth.ts:10): `super_admin · support · billing · product · growth · read_only`. Bootstrap admin (`PLATFORM_ADMIN_EMAILS` env) → `super_admin`. The DB `platform_users.role` CHECK accepts exactly these six (constraint last set in migration 057; the legacy value `'admin'` is normalized → `super_admin` at read time by `normalizePlatformRole`).

## 2. `platform_users` — verified columns (dev snapshot)

`id` uuid PK · `email` text NOT NULL (unique) · `display_name` text · `role` text NOT NULL default `'support'` · `is_active` boolean NOT NULL default `true` · `invited_by` text · `created_at` / `updated_at` timestamptz. **RLS enabled, no policies → service-role writes only.**

## 3. Login model (what each test persona needs)

`getPlatformAdminContext()` resolves role by: (1) bootstrap-email match → super_admin, else (2) `platform_users` row where `email = $email AND is_active = true`. Login itself is **standard Supabase email+password** (`signIn` on `/platform-admin/login`). So each scoped persona needs BOTH:
- a real `auth.users` row with a **confirmed email + a password** (so we can log in), AND
- a matching active `platform_users` row with the target role.

## 4. Seed the five scoped-role accounts

**Two paths — Path B is the real one; the gap is that it sets no password.**

- **Bootstrap super_admin:** `POST /api/dev/seed/platform-user` (no body) → creates `platform@dev.local` / `devpass123` (auth user + platform_users row, effective super_admin). Gate: `requireDevToolPlatformAdmin`. This is the only account that can then mint the others.
- **Scoped roles (Path B):** logged in as super_admin, `POST /api/platform-admin/company-users` once per role (gate: `requirePlatformPermission('manage_platform_users')` = super_admin only). Body: `{ "email", "displayName", "role" }`. Creates an auth user with **email_confirm but NO password** + the platform_users row, and returns a `setupLink` recovery URL.

  | email | role |
  |-------|------|
  | support@dev.local | support |
  | billing@dev.local | billing |
  | product@dev.local | product |
  | growth@dev.local | growth |
  | readonly@dev.local | read_only |

  Then set each password to `devpass123` via the returned `setupLink`, OR `supabaseAdmin.auth.admin.updateUserById(id, { password: 'devpass123' })`.

> **⚠ Staging gap → recommend a small dev seed script.** No existing script creates *scoped-role* platform users with a usable dev password (the bootstrap script only does super_admin; Path B leaves them passwordless). Cheapest fix at execution time: a dev-only `scripts/seed-platform-staff.mjs` (service-role) that, per role, `createUser({ email, password:'devpass123', email_confirm:true })` + upserts the `platform_users` row. ~30 lines, mirrors `app/api/dev/seed/org`. **Decide at Phase-0 execution; not built yet.**

## 5. Support-loop seed data

| Surface | Table (dev-confirmed) | Cheapest seed | Auth |
|---------|----------------------|---------------|------|
| **Feedback** | `feedback_submissions` | `POST /api/feedback` `{ "type":"bug","category":"Tournaments","body":"…" }` | none (anon OK; rate-limited 1/5min anon, 1/hr per user) |
| **Observability errors** | `error_groups` + `error_events` (also `request_metrics_rollup` for charts) | `POST /api/client/error-capture` `{ "name","message","stack","route" }` (public) — call several times w/ varied name/route for distinct groups | none |
| **Change requests** | `platform_catalog_change_requests` | `POST /api/platform-admin/product-catalog/change-requests` `{ "request_type":"pricing","title":"…","priority":"high" }` | super_admin or product session |
| **League-Starter §13** | `platform_events` (existing free-floor org) | reuse an existing free-floor org from prior free-tier seeds; events already written by `lib/platform-events.ts`. Surface = overview dashboard panel. | n/a |

Valid feedback `type`: bug/feature/feedback. Valid `category`: Tournaments/Coaches/Registrations/Accounting/Billing/Other. Valid change-request `request_type`: plan_version/feature_matrix/addon/pricing/grandfathering/campaign/trial.

> **Staging gaps (all minor):** no bulk seed script for feedback, observability, or change-requests — use the endpoints above (rate-limit the anon ones by spacing calls) or a one-off service-role insert. `request_metrics_rollup` (the observability charts) has no public writer — insert via service-role or run `POST /api/platform-admin/observability/sweep` (super_admin) after seeding `request_metrics_raw`, only if chart realism matters for the walk.

## 6. Screenshots

Desktop-primary (1440×900, dark default). Reuse `scripts/journey-shots.mjs` with one storage-state per role (log in once per persona) + a per-role spec `scripts/journeys/pa-<role>-shots.json` listing each role's signature screens. Mobile (390×844) only if a role proves mobile-relevant (none expected).

## 7. Execution order (at Phase-0 go)

1. Confirm `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` + dev server up (network access).
2. Bootstrap super_admin (`/api/dev/seed/platform-user`).
3. Mint the 5 scoped roles (Path B or the recommended seed script) + set passwords.
4. Seed feedback ×3, observability errors ×3+, change-requests ×2; confirm a free-floor org exists for the §13 panel.
5. Build per-role screenshot specs.
6. **→ Pause for owner, then begin Phase 1 (PA1 + PA2).**
