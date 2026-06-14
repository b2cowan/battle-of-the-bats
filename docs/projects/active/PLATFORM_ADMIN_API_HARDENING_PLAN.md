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

## Tasks — BUILT 2026-06-13 (dev-only, uncommitted on feat/free-tier-coaches; typecheck + lint:focused clean)

- [x] Added `requirePlatformAreaApi(area, access)` to `lib/platform-auth.ts` (reuses `canViewPlatformArea`/`canWritePlatformArea`).
- [x] **#1** email-templates list GET + `[key]` GET → `('email_templates','view')`; `[key]` PUT/DELETE + test-send → `('email_templates','write')`; guarded the `[key]` **page** with `requirePlatformAreaView('email_templates')`.
- [x] **#2** `admin/email/send` + resubscribe → `('email','write')`; `admin/email` GET + `sends` GET → `('email','view')`.
- [x] **#3** `early-access` GET + export → `('early_access','view')`.
- [x] **#4/#5 — were FALSE POSITIVES.** `feedback/export` (line 50) and `observability/issues/export` (line 24) **already** gated on `canViewPlatformArea(role,'observability')` after the session check — the walkers flagged the first guard line and missed the second. Not leaky. **Refactored onto the helper anyway** (single source of truth, removes the two-line foot-gun) — no behavior change.
- [x] **#6** dev-tools: added a `super_admin` redirect to `dev-tools/layout.tsx` (now async) + tightened `requireDevToolPlatformAdmin` to require `super_admin`. (`requireDevToolUserAuth` left as-is — it intentionally allows any auth'd user for the signup-flow seed/wipe testing.)
- [x] **#7** delete-user → `requireSuperAdmin()` (owner-approved default; matches org-delete). The button-removal in `CustomerUsersClient` for ineligible roles is left to **F2** (UI consistency).
- [x] Grep-sweep done: the genuinely-leaky routes are the email-templates (4) + admin/email (4) + early-access (2) groups. Left session-only **by design** (correct): `audit/export` (audit = ALL_ROLES view), `me`, `visits`, `metrics/snapshot`, `users/notes`, `orgs/[id]/notes`. **Documented follow-ups (lower-risk reads, not in this pass):** `stripe-prices` GET, `plan-config` GET, `plan-gating` GET use session-only for their GET (config visible to all roles) — consider `plans_pricing` view in a later sweep.
- [x] `npm run typecheck` clean + `npm run lint:focused` clean on all 15 changed files.

## Decisions taken (owner-approved 2026-06-13)

1. **Delete-user (#7):** elevated to `super_admin` (matches org-delete). Reversible to `manage_billing` if preferred.
2. **Dev-tools (#6):** tightened to `super_admin` (page + API helper); env-flag kept as belt-and-suspenders.

## ⚠ Handoff note
Shared `lib/platform-auth.ts` changed → **restart the dev server before browser QA** (AGENTS.md). Not committed. Suggested verification: log in as `support@`/`billing@`/`growth@`/`readonly@dev.local` (devpass123) and confirm the email-template editor, mass-email send, and lead/feedback/error exports now return 403 for the wrong role while `product@`/bootstrap still work.

## Out of scope
- UX consistency of the now-correctly-403'ing buttons → owned by **F2** (Least-Privilege UX Consistency).
- The feedback-status permission question (should support write?) → owned by **F3** (Support Seam).
- This is the **internal-console** authorization layer; the customer-facing authorization sweep is the separate [Trust & Integrity Hardening](TRUST_INTEGRITY_HARDENING_PLAN.md) project.
