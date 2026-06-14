# Platform-Admin API Hardening (F1) — Implementation Plan

> **Status:** Scoped 2026-06-13, fast-track. **Priority: P0 (security).** Spun out of the [Platform-Admin Employee Audit](archive/platform-admin-audit/SYNTHESIS.md) Theme A.
> **Companion:** [PLATFORM_ADMIN_API_HARDENING_PM_BRIEF.md](PLATFORM_ADMIN_API_HARDENING_PM_BRIEF.md)
> **Branch:** TBD with owner (this one DOES change product code — server route guards).
> **Verification standard:** every claim below was checked **first-hand against the route files** during the audit, not via subagent re-derivation.

## Problem

The H4 least-privilege model (`lib/platform-areas.ts`) is enforced on **pages** (`requirePlatformAreaView`) but several **API routes gate only on "is there a platform session,"** not on the role's permission. Any logged-in platform employee of *any* role (e.g. a growth contractor, a read-only auditor) can call these directly and bypass the matrix. This is privilege-escalation-within-staff, and the email/export/template routes are **live in production**.

## The verified gap (first-hand citations)

| # | Route | Current guard | Should be | Effect today |
|---|-------|---------------|-----------|--------------|
| 1 | `app/api/platform-admin/email-templates/[key]/route.ts:9,25` (GET, PUT) + the reset/`test-send` siblings | `getPlatformAuthContext()` (session-only) | `email_templates` write = `manage_product` | **Any role can read AND overwrite production transactional email copy** |
| 1b | `app/platform-admin/email-templates/[key]/page.tsx` | none | `requirePlatformAreaView('email_templates')` | Editor page reachable by direct URL (PF-1) |
| 2 | `app/api/admin/email/send/route.ts:218` (+ resubscribe sibling) | `getPlatformAdminContext()` (session-only) | `email` write = `manage_growth` OR `manage_product` | **Any role can trigger a real mass-email blast** |
| 3 | `app/api/platform-admin/early-access/route.ts:13` (GET list) + `early-access/export/route.ts:37` | `requirePlatformAdmin()` (session-only) | `early_access` view = `manage_growth` OR `manage_product` | **Any role can read/export the full lead DB incl. internal notes** (the per-lead `[leadId]` route is already correctly gated — copy that) |
| 4 | `app/api/platform-admin/feedback/export/route.ts:49` | `getPlatformAdminContext()` (session-only) | `observability` view = `manage_product` OR `manage_support` | Any role can export all customer feedback |
| 5 | `app/api/platform-admin/observability/issues/export/route.ts:22` | `requirePlatformAdmin()` (session-only) | `observability` view = `manage_product` OR `manage_support` | Any role can export error data |
| 6 | `app/platform-admin/dev-tools/*` + `app/api/dev/seed/*` (`requireDevToolPlatformAdmin`/`requireDevToolUserAuth`) | env-flag + any-platform-admin (or any user) | `dev_tools` = `super_admin` only | Any role reaches Dev Tools incl. "Wipe Everything" **when the flag is on. Prod-mitigated (flag off in prod) → lower urgency** |
| 7 | `app/api/platform-admin/users/[id]/delete/route.ts:9` | `requirePlatformPermission('manage_support')` | **policy decision** — elevate to `requireSuperAdmin()` or `manage_billing`? | **Support can permanently delete customer auth accounts** |

## Recommended approach — one helper, not seven patches

Add an **API-side counterpart to `requirePlatformAreaView`** so route guards read from the same single source of truth as pages and the bug class can't recur:

```ts
// lib/platform-auth.ts — mirrors requirePlatformAreaView but for API routes (returns 403 NextResponse)
export async function requirePlatformAreaApi(area: PlatformArea, access: 'view' | 'write')
```

- `view` → caller's role must be in `PLATFORM_AREAS[area].viewRoles` (or super_admin).
- `write` → must be in `writeRoles` (or super_admin).
- Returns the `{ user, role, response }` shape the other guards use.

Then replace each session-only check above with the right `requirePlatformAreaApi(area, access)` call. This makes the API layer self-consistent with the nav + page guards and the matrix.

## Tasks

- [ ] Add `requirePlatformAreaApi(area, access)` to `lib/platform-auth.ts` (+ unit-level reasoning; reuse `canViewPlatformArea`/`canWritePlatformArea`).
- [ ] **#1** email-templates `[key]` GET/PUT/reset/test-send → `requirePlatformAreaApi('email_templates','write')`; guard the `[key]` page with `requirePlatformAreaView('email_templates')`.
- [ ] **#2** `admin/email/send` + resubscribe → `requirePlatformAreaApi('email','write')`.
- [ ] **#3** `early-access` GET + export → `requirePlatformAreaApi('early_access','view')` (match the already-correct `[leadId]` route).
- [ ] **#4/#5** `feedback/export` + `observability/issues/export` → `requirePlatformAreaApi('observability','view')`.
- [ ] **#6** dev-tools: add a `super_admin` check to the page/layout + tighten `requireDevToolPlatformAdmin` to require `super_admin` (keep the env-flag belt-and-suspenders). *(Lower urgency — prod-gated.)*
- [ ] **#7 (owner policy)** decide delete-user elevation → apply `requireSuperAdmin()` or `manage_billing` to `users/[id]/delete` and drop the verb from `CustomerUsersClient` for ineligible roles (coordinate with F2).
- [ ] Grep-sweep for any other platform-admin API route using bare `getPlatformAdminContext()`/`getPlatformAuthContext()`/`requirePlatformAdmin()` as its only gate; bring each onto the helper or document why session-only is correct.
- [ ] `npm run typecheck` (touches shared `lib/platform-auth.ts` — restart dev server before browser QA).

## Open decisions for owner

1. **Delete-user (#7):** is permanent customer-account deletion a support-rep capability, or should it require `super_admin` (matching org-delete) / `manage_billing`?
2. **Dev-tools (#6):** tighten to `super_admin`, or accept the prod env-flag as sufficient and just document it?

## Out of scope
- UX consistency of the now-correctly-403'ing buttons → owned by **F2** (Least-Privilege UX Consistency).
- The feedback-status permission question (should support write?) → owned by **F3** (Support Seam).
- This is the **internal-console** authorization layer; the customer-facing authorization sweep is the separate [Trust & Integrity Hardening](TRUST_INTEGRITY_HARDENING_PLAN.md) project.
