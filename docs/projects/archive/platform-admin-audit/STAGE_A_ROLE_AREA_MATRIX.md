# Stage A — Role × Area Matrix + Guard Consistency

> Built 2026-06-13 from code (`lib/platform-areas.ts`, `lib/platform-auth.ts`, `app/platform-admin/PlatformAdminNav.tsx`, and every `app/platform-admin/**/page.tsx`). This is the shared skeleton every role report follows, and it doubles as a guard-vs-matrix consistency check.
> **Pre-findings below are CANDIDATES** surfaced during scoping — to be adversarially verified during the walk per the risk-targeted posture, not asserted as confirmed.

## 1. The access matrix (single source of truth = `lib/platform-areas.ts`)

`✅` = write · `👁` = view-only (in `viewRoles`, not `writeRoles`, area has writes) · `—` = hidden. **super_admin = full access to everything.** Write is additionally enforced at API routes via `requirePlatformPermission`; this governs *view* + nav visibility.

| Area | super_admin | support | billing | product | growth | read_only |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| overview | ✅ | 👁* | 👁* | 👁* | 👁* | 👁* |
| organizations | ✅ | 👁* | 👁* | 👁* | 👁* | 👁* |
| audit | ✅ | 👁* | 👁* | 👁* | 👁* | 👁* |
| help | ✅ | 👁* | 👁* | 👁* | 👁* | 👁* |
| customer_users | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| retention | ✅ | 👁 | ✅ | — | — | — |
| bulk_operations | ✅ | — | ✅ | ✅ | — | — |
| plans_pricing | ✅ | — | 👁 | ✅ | — | — |
| change_requests | ✅ | — | 👁 | ✅ | — | — |
| email_templates | ✅ | — | — | ✅ | — | — |
| early_access | ✅ | — | — | ✅ | ✅ | — |
| email | ✅ | — | — | ✅ | ✅ | — |
| **observability** (+ **feedback**) | ✅ | 👁 | — | ✅ | — | — |
| platform_users | ✅ | — | — | — | — | — |
| dev_tools | ✅ | — | — | — | — | — |

\* These four areas have `writeRoles: []`, so non-super roles are technically "view" but there's nothing to write — they're general/read surfaces, not locked. `read_only` is view-only everywhere it appears.

**Seam-critical row:** `observability` (which the **Feedback** nav item also maps to) — `support` is **👁 view-only**. So a support rep can SEE feedback + error groups but **cannot write/act** (triage, resolve, assign). Confirmed in code: `feedback/page.tsx` guards on `requirePlatformAreaView('observability')`; observability `writeRoles = [super_admin, product]`. **→ Central hypothesis PA2 must test: can support actually close the loop, or only read it?**

## 2. What each role's NAV renders (least-privilege as the employee sees it)

Nav drops un-viewable areas and marks view-only with an eye icon ([PlatformAdminNav.tsx:66-113](../../../../app/platform-admin/PlatformAdminNav.tsx#L66)). Approx. nav item counts per role:

- **super_admin:** all groups, all items (+ Dev Tools when `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`).
- **support:** Overview · Organizations · Customer Users · Retention(👁) · Observability(👁) · Feedback(👁) · Audit · Help. (No Growth, Billing&Product groups, no Platform Users/Email Templates.)
- **billing:** Overview · Organizations · Customer Users · Retention · Change Requests(👁) · Plans&Pricing(👁) · Bulk Operations · Audit · Help.
- **product:** Overview · Organizations · Customer Users(👁) · Early Access · Email · Change Requests · Plans&Pricing · Bulk Operations · Observability · Feedback · Audit · Email Templates · Help. (Broadest non-super.)
- **growth:** Overview · Organizations · Customer Users(👁) · Early Access · Email · Audit · Help. (Narrowest meaningful role.)
- **read_only:** Overview · Organizations · Customer Users(👁) · Audit · Help. (Pure observer.)

## 3. Guard-vs-matrix consistency check (per page)

Layout [app/platform-admin/layout.tsx](../../../../app/platform-admin/layout.tsx) does a **session-only** check for every non-login path (redirects if unauthenticated) — but it does **not** enforce per-area access. Per-area enforcement must come from each page calling `requirePlatformAreaView('<area>')`.

| Route | Page guard | Area | Status |
|-------|-----------|------|--------|
| `/platform-admin` (overview) | `getPlatformAuthContext()` (not an area guard) | — | benign* |
| `/platform-admin/orgs` | none | — | benign* |
| `/platform-admin/orgs/[id]` | `getPlatformAdminContext()` for UI, not a guard | — | benign* (see PF-3) |
| `/platform-admin/customer-users` | none | — | benign* |
| `/platform-admin/retention` | `requirePlatformAreaView('retention')` | retention | ✅ |
| `/platform-admin/early-access` | `requirePlatformAreaView('early_access')` | early_access | ✅ |
| `/platform-admin/email` | `requirePlatformAreaView('email')` | email | ✅ |
| `/platform-admin/change-requests` | `requirePlatformAreaView('change_requests')` | change_requests | ✅ |
| `/platform-admin/plans-pricing` | `requirePlatformAreaView('plans_pricing')` | plans_pricing | ✅ |
| `/platform-admin/plans` | `redirect → plans-pricing` (tombstone) | — | ✅ |
| `/platform-admin/stripe-prices` | `redirect → plans-pricing` (tombstone) | — | ✅ |
| `/platform-admin/bulk-operations` | `requirePlatformAreaView('bulk_operations')` | bulk_operations | ✅ |
| `/platform-admin/users` | `requirePlatformAreaView('platform_users')` | platform_users | ✅ |
| `/platform-admin/audit` | none | — | benign* |
| `/platform-admin/observability` | `requirePlatformAreaView('observability')` | observability | ✅ |
| `/platform-admin/observability/[groupId]` | `requirePlatformAreaView('observability')` | observability | ✅ |
| `/platform-admin/feedback` | `requirePlatformAreaView('observability')` | observability | ✅ (intentional — no `feedback` area) |
| `/platform-admin/email-templates` | `requirePlatformAreaView('email_templates')` | email_templates | ✅ |
| `/platform-admin/email-templates/[key]` | **none** | — | **⚠ PF-1** |
| `/platform-admin/dev-tools` | client component; layout has env-flag redirect only, no role guard | — | **⚠ PF-2** |
| `/platform-admin/help/*` (10 pages) | none (layout session check only) | — | benign (help = ALL_ROLES) |

\* **benign today** = the area is `viewRoles: ALL_ROLES`, so missing the explicit page guard bypasses no role restriction *currently* — but the pattern inconsistency means a future tightening of the matrix won't be enforced on these pages.

## 4. Candidate pre-findings (verify during the walk)

| ID | Sev | Type | Tags | Finding | Evidence |
|----|-----|------|------|---------|----------|
| **PF-1** | High | bug, role-gating | least-privilege | `email-templates/[key]` editor has **no guard** — the list page gates on `email_templates` (super_admin+product only) but the per-template editor is reachable by direct URL for any session-holding role (billing/support/growth/read_only). | `app/platform-admin/email-templates/[key]/page.tsx` (9-line wrapper, no `requirePlatformAreaView`) |
| **PF-2** | High | bug, role-gating | least-privilege | `dev-tools` page is `'use client'`; the only protection is the layout env-flag redirect — **no role guard**. When `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`, any authenticated non-super_admin can reach dev tools (matrix says super_admin-only). | `app/platform-admin/dev-tools/page.tsx` + `dev-tools/layout.tsx:4` |
| **PF-3** | Med | ia-sequence, role-gating | least-privilege | `orgs/[id]`, `orgs/`, `customer-users/`, `audit/`, overview dashboard fetch context but call **no `requirePlatformAreaView`**. Zero impact today (all ALL_ROLES) but breaks the H4 single-source-of-truth pattern; a matrix change won't be enforced. | respective `page.tsx` files |
| **PF-4** | Low | design-visual | support-seam, day-one | The **League-Starter §13 instrumentation** surface lives ONLY on the **overview dashboard** ([page.tsx:325-335](../../../../app/platform-admin/page.tsx#L325), data from `lib/platform-metrics.ts`) and a free-floor annotation on the orgs list — there is **no abuse/instrumentation badge on the org detail page**, so a rep investigating a specific suspect org has no per-org signal. Confirm whether that's the intended placement. | `app/platform-admin/page.tsx:325`, `app/platform-admin/orgs/page.tsx:101` |

**Note on PF-1/PF-2 routing:** these are least-privilege *bugs*, not pure UX — if verified, they route to a security/hardening fix project (or the next platform-admin hardening pass), not the UX backlog.
