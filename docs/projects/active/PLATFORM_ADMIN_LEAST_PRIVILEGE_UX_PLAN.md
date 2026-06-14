# Platform-Admin Least-Privilege UX Consistency (F2) — Implementation Plan

> **Status:** Scoped 2026-06-13. **Priority: P1.** Spun out of the [Platform-Admin Employee Audit](../archive/platform-admin-audit/SYNTHESIS.md) Theme B.
> **Companion:** [PLATFORM_ADMIN_LEAST_PRIVILEGE_UX_PM_BRIEF.md](PLATFORM_ADMIN_LEAST_PRIVILEGE_UX_PM_BRIEF.md)
> **Coordinate with F1:** [PLATFORM_ADMIN_API_HARDENING_PLAN.md](PLATFORM_ADMIN_API_HARDENING_PLAN.md) owns all API route guards. F2 owns every client-side button/control that is hidden, disabled, or annotated. The delete-user verb (F1 #7) is a shared seam: F1 elevates the API guard, F2 hides or disables the button in `CustomerUsersClient` for ineligible roles.
> **Branch:** feat/free-tier-coaches (current) or a dedicated branch per owner preference.

---

## Problem

The H4 least-privilege matrix (`lib/platform-areas.ts`) correctly gates nav items and pages, but the **controls inside those pages render in an enabled state for roles that cannot use them.** When a staff member clicks an enabled button and the API 403s, nothing explains why. "I'm not allowed" looks identical to "this is broken." This is the #1 day-one blocker confirmed across four of six audited roles.

The only place the correct pattern is applied today is the Observability `StatusControls` component, which renders a "View-only for your role" inline note when `readOnly=true`. That note exists in exactly one place. The fix is a systematic gate-and-message pass across every surface where the pattern is absent, backed by a shared reusable affordance component.

---

## Verified gap table (first-hand citations from the audit)

| Finding | Role(s) | Surface / File | Line evidence | Symptom |
|---------|---------|----------------|---------------|---------|
| **PAR-001** (Blocker) | read_only | `app/platform-admin/customer-users/CustomerUsersClient.tsx:517-591` + `page.tsx:130-149` | No role prop passed; no `canWrite` guard before rendering Actions button or any menu verb | Full Actions menu (Notes / Edit / Reset / Confirm / Revoke / Ban / Delete) renders for a pure observer — every call 403s silently |
| **PAP-003** (High) | product | Same `CustomerUsersClient.tsx:541-590` | Same root cause — no role prop | Product sees same full Actions menu; product lacks `manage_support`; all write verbs fail silently |
| **PAS-002** (High) | support | `app/platform-admin/retention/RetentionQueueClient.tsx:56-79,84-110` + `retention/[recordId]/extend/route.ts:23` | No `canManage*` guard in the client before rendering "+30 days" and "Process expiry" buttons | Support clicks Retention actions, submits, gets a silent 403; no disabled state, no tooltip |
| **PAS-003** (High) | support | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:488-510` (props) + `page.tsx:492-496` | Entitlements tab addon checkboxes and Billing & Access override form render to support with no guard; API for both is `manage_billing`/`manage_product`-gated | Support submits, gets a 403; contrast: the Identity/Ownership sections correctly show "Requires support access" — that pattern is not applied here |
| **PAB-003** (High) | support, read_only | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:1493-1517` | Cancel-subscription section is `undefined` (conditionally omitted) when `canManageBilling=false` | No stub copy; support lands on Billing & Access tab and cannot tell if Cancel exists somewhere else or requires a different role |
| **PAB-004** (High) | billing | `app/platform-admin/change-requests/ChangeRequestsClient.tsx:118-123` + `canManageProduct` prop | Guard is applied to the create form but the Approve/Apply/Reject/Update per-row buttons are potentially not gated by `canManageProduct` | Billing clicks action buttons on existing requests → silent 403; no "review-only" note in the list header |
| **PAR-003** (High) | read_only | `app/platform-admin/page.tsx:149-158` | `AlertItem` components rendered with `href` for areas the read_only role cannot reach (early-access, retention, change-requests); no role check strips the link | Clicking "4 Trials ending soon" redirects to Overview silently — looks broken |

**The gold standard (already exists — copy it everywhere):**
`app/platform-admin/observability/[groupId]/page.tsx` → `StatusControls` renders with `readOnly=true` for support → shows inline "View-only for your role" note. This is the design target for all gaps above.

---

## Recommended approach

### 1. Add a `RequiresAccess` note component

Create a lightweight, reusable component at `components/platform-admin/RequiresAccess.tsx`. It renders an inline muted note that reads:

> "Requires [permission label] — contact the [role name] team."

Props: `permission: string` (human label, e.g. `"billing access"`), `role?: string` (e.g. `"billing"`). The component should match the visual style of the existing "View-only for your role" note in `StatusControls` so that the pattern is visually uniform across all surfaces. This component is the single source of truth for the "not allowed" message — no inline string literals.

### 2. Add a `canWrite` (or `canManageUsers`) prop to `CustomerUsersClient`

This is the single highest-leverage fix (resolves PAR-001 + PAP-003 in one change):

- In `app/platform-admin/customer-users/page.tsx` (server component), compute:
  ```ts
  const canManageUsers = hasPlatformPermission(auth.role, 'manage_support')
  ```
- Pass `canManageUsers` to `CustomerUsersClient`.
- In `CustomerUsersClient`, gate the Actions button and all menu items on `canManageUsers`. When `false`, either suppress the Actions column entirely or replace it with a view-only indicator using `RequiresAccess`.
- Also coordinate with F1 #7: once F1 decides the delete-user verb elevation, F2 must hide/disable the Delete User menu item for roles that are not in the elevated guard (i.e. if the API moves to `requireSuperAdmin()`, hide Delete from non-super-admin roles by passing a separate `canDelete` boolean).

### 3. Systematic gate-and-message pass across remaining surfaces

Apply `disabled` + `RequiresAccess` (or suppress the section with a stub) at each gap:

**Retention Queue (`RetentionQueueClient.tsx`):**
- Pass `canManageBilling` from the server page (already computed at `retention/page.tsx`).
- When `false`, set `disabled` on the "+30 days" and "Process expiry" buttons and render a `<RequiresAccess permission="billing access" role="billing" />` note adjacent to them. Do NOT hide the buttons — support legitimately navigates here to view the queue; they just cannot act on it.

**Org Detail — Entitlements + Billing & Access override form (`OrgDetailClient.tsx`):**
- The Identity/Ownership sections already use a "Requires support access" pattern. Apply the same pattern to the Entitlements addon checkboxes and the Billing & Access override form: disable form fields and add `<RequiresAccess permission="billing access" />` or `<RequiresAccess permission="product access" />` as appropriate. This makes the pattern consistent across all sections in the same file.

**Org Detail — Cancel Subscription stub (`OrgDetailClient.tsx:1493-1517`):**
- When `canManageBilling=false` AND the subscription is active, render the Cancel Subscription section as a stub matching the existing Delete Organization stub pattern (line ~1199): a collapsed card with copy reading "Cancellation requires billing access — contact the billing team." This closes the "does cancel exist?" discovery gap for support and read_only without giving them a live form that 403s.

**Change Requests — Approve/Apply/Reject buttons (`ChangeRequestsClient.tsx`):**
- Audit every per-row write-action button to confirm whether `canManageProduct` already gates each one. Add `disabled` + a `title="Requires product access"` tooltip to any button not already gated.
- Add a `<RequiresAccess permission="product access" role="product" />` note in the list header section when `canManageProduct=false`, so a billing specialist sees immediately that the list is review-only.

**Overview Action Queue dead links (`page.tsx:149-158`):**
- Pass the caller's role (already available via `getPlatformAuthContext()`) to the component that renders `AlertItem` entries.
- For `AlertItem` entries that point to areas the role cannot reach (retention, early-access, change-requests) or perform (billing-domain filters for non-billing roles), strip the `href` when the role lacks access, and add a `title` tooltip: "Requires billing access" / "Requires product access." Functional roles (billing, product, super_admin) receive live links as today.

### 4. Add a page-level view-only banner to Customer Users

Even after PAR-001 is resolved (Actions button suppressed), add a `HelpCallout` variant above the Customer Users table when `canManageUsers=false`. Suggested copy: "View-only access — search and review user records. Contact the support team to take any action." This proactively explains the constraint before a user tries anything, matching the existing Observability readOnly note pattern.

### 5. Fix the Feedback Status column "why no dropdown?" gap (`PAS-012` / `PAS-001` adjacent)

This is a UX scope item that is in scope for F2 (not F3). Even before the F3 permission decision, the Feedback list page should explain to support why the Status column is static. Add a view-only note to the `HelpCallout` on `feedback/page.tsx`: "Status changes require product access — contact a product operator to triage or resolve items." This closes the "is it broken?" vs. "I'm not allowed" ambiguity for support today regardless of how F3 resolves the permission design.

---

## Task list

- [ ] **T1** Create `components/platform-admin/RequiresAccess.tsx` — shared inline note component with `permission` and optional `role` props; style matches the existing observability "View-only for your role" note.

- [ ] **T2** `CustomerUsersClient` role prop (PAR-001 + PAP-003):
  - [ ] T2a — Compute `canManageUsers = hasPlatformPermission(auth.role, 'manage_support')` in `customer-users/page.tsx` and pass to `CustomerUsersClient`.
  - [ ] T2b — Gate the Actions button and all menu items in `CustomerUsersClient` on `canManageUsers`. When false, render view-only indicator or suppress the column.
  - [ ] T2c — Add page-level view-only `HelpCallout` when `canManageUsers=false` (PAR-006).
  - [ ] T2d — Coordinate with F1 #7 (**RESOLVED 2026-06-13: F1 elevated the delete-user API to `requireSuperAdmin()`**). Add a `canDelete = auth.role === 'super_admin'` prop (separate from `canManageUsers`) and hide the Delete User menu item for non-super roles. ⚠ **Now a live regression:** F1's elevation means `support`/`billing` (who previously held `manage_support` and could delete) now see a Delete button that 403s — a new silent dead-end until this task ships.

- [ ] **T3** Retention Queue gate (PAS-002):
  - [ ] Confirm `canManageBilling` is available from `retention/page.tsx` (or compute via `hasPlatformPermission`).
  - [ ] Pass to `RetentionQueueClient`; disable "+30 days" and "Process expiry" when false + render `<RequiresAccess permission="billing access" />`.

- [ ] **T4** Org Detail — Entitlements + Billing & Access override form (PAS-003):
  - [ ] Locate the Entitlements addon checkbox block and Billing & Access override form sections in `OrgDetailClient.tsx`.
  - [ ] Apply the same disabled + `<RequiresAccess>` pattern already used for Identity/Ownership sections in the same file.

- [ ] **T5** Org Detail — Cancel Subscription stub (PAB-003):
  - [ ] When `canManageBilling=false` AND the subscription is active (not already `canceled`), render a stub card that reads "Cancellation requires billing access — contact the billing team," matching the Delete Organization stub pattern (~line 1199 of `OrgDetailClient.tsx`).

- [ ] **T6** Change Requests — per-row button audit (PAB-004):
  - [ ] Read `ChangeRequestsClient.tsx` end-to-end; confirm whether Approve/Apply/Reject/Update buttons are already gated by `canManageProduct`.
  - [ ] If any per-row button is not gated: add `disabled={!canManageProduct}` + `title="Requires product access"`.
  - [ ] Add `<RequiresAccess permission="product access" role="product" />` header note when `canManageProduct=false`.

- [ ] **T7** Overview Action Queue role-aware links (PAR-003):
  - [ ] In `page.tsx`, confirm the role is already available from `getPlatformAuthContext()`.
  - [ ] For each `AlertItem` that links to a role-gated area or implies a billing/product action: conditionally strip `href` when the caller lacks the required permission. Add `title` tooltip.

- [ ] **T8** Feedback list view-only note (PAS-012 / PAS-001 adjacent):
  - [ ] In `feedback/page.tsx`, when `readOnly=true` for support, add a sentence to the existing `HelpCallout`: "Status changes require product access — contact a product operator to triage or resolve items."

- [ ] **T9** Typecheck — `npm run typecheck` (touches shared `lib/platform-auth.ts` indirectly and multiple server pages; run before browser QA).

- [ ] **T10** Dev server restart — required because multiple page server components are edited. Stop, clear `.next`, restart per the `AGENTS.md` restart rule.

---

## Open decisions for owner

1. **Delete-user button scope (T2d):** What permission level should gate the Delete User menu item in `CustomerUsersClient`? This is the UX counterpart to F1 #7. Options: `super_admin` only (most conservative), `manage_billing`, or keep as `manage_support`. F2 will hide/disable the button to match whatever F1 sets on the API. Owner should decide this alongside F1 #7 so both ship together.

2. **Action Queue read_only links (T7):** Should the inaccessible alert tiles be (a) stripped to plain non-clickable count tiles, or (b) kept as links but with a `title` tooltip explaining the required access? Option (a) is the cleaner UX; option (b) preserves the count as informational. Default recommendation: strip `href`, keep the tile visible with a muted style so the observer can see the numbers without a dead navigation path.

---

## Out of scope

- **API route guards** — owned entirely by F1 (PLATFORM_ADMIN_API_HARDENING_PLAN.md). F2 only hides or disables client-side controls; it does not touch server route files.
- **The feedback-status permission question** — whether support should be able to write feedback status (adding `manage_support` to the route) is owned by **F3** (Support Seam / Feedback Triage). F2 only adds the explanatory note to the Feedback page for the current state.
- **SOPs and help-content expansion** — owned by F4 (Operator SOPs + Day-One Orientation).
- **Billing workflow polish** (PAB-002 expired-override filter, PAB-007/PAB-008 retention drill-through and tab URL, PAB-009 Stripe deep-link) — backlog, F5.
- **MetricSnapshotButton write leak (PAR-005)** — minor; can be addressed as a fast follow or batched with F1 if the owner wants it hardened at the API level.
