# PA6 — Read-Only Observer Operator Report
> Walked: 2026-06-13 | Method: code-walk (Stage B) | Status: draft | Verify: risk-targeted (High/bug findings)

---

## The operator at a glance

The read-only observer arrives at the platform-admin console with exactly one permission: `view_platform_admin`. This covers executives reviewing business metrics, external auditors inspecting platform governance, or contractors granted temporary read visibility. They have no write permissions anywhere — not even the small writes that support or billing roles take for granted (notes, status changes, feedback triage).

Their nav is the most stripped-back of any role: **Overview, Organizations, Customer Users (👁 view-only), Audit Log, and Help**. Five items across three of the five nav groups; the Growth and Billing & Product groups disappear entirely. On first login the experience looks clean and purposeful. The kicker comes as the observer starts clicking.

The Overview dashboard is rich and data-dense. A senior executive can scan MRR, organization counts, plan mix, lifecycle events, and the League Starter instrumentation panel in a single view. The Action Queue is the first moment of friction: every alert card is rendered as a **clickable link** (`<Link href=...>`) pointing at nav areas the read_only role can see (orgs, customer-users) or areas that are silently inaccessible (early-access, retention, change-requests). Clicking an inaccessible link doesn't 404 — it redirects to Overview or returns an auth error depending on the page. The observer has no way to know which links are dead-ends.

On the organization detail page the story worsens. The observer can reach any org's detail (no guard). The five workflow tabs all render. But the "Support" tab contains writable form fields (Internal Notes textarea, Organization Identity form, Account Ownership transfer controls, Coaches Portal completion form) — every one of which evaluates `canManageSupport=false` for read_only and therefore shows the correctly gated **read-only note** for those sections. The "Billing & Access" and "Entitlements" tabs also correctly disable or omit write controls when `canManageBilling=false` / `canManageProduct=false`. **On the org detail page, the role-gate pattern holds.** The observer sees read-only views of notes, override history, member list, tournaments, and activity — all legitimate and useful.

The Customer Users page is the most significant failure point. **The full Actions menu renders for every row without any role check.** Read_only holds only `view_platform_admin`, which is not `manage_support` — yet the "Actions" button is live, the menu opens, and all options (Notes, Edit Info, Reset Password, Confirm Email, Revoke Sessions, Ban User, Delete User) are visible and clickable. Every one of those API calls will return 403, but the UI gives no indication of that. For a pure observer — perhaps an auditor reviewing account data — every row looks fully interactive.

The MetricSnapshotButton on the Overview dashboard is also silently actionable: it calls `POST /api/platform-admin/metrics/snapshot` which is guarded by `requirePlatformAdmin()` (any authenticated platform user passes), meaning **read_only can successfully write a metric snapshot** — a minor data mutation but the only write this role can actually complete.

On balance, this is a partially clean view-only experience. The nav suppression is correct. The org detail tab gating is correct. The Audit Log is a natural home for an observer and is well-suited to this role. But the Customer Users Actions menu is a Blocker-class dead-end infestation, the Action Queue has dead navigation links, and the Help Hub has no read-only role-path whatsoever.

---

## Role × area access map (as rendered)

| Area | This role | Guard correctly enforced? | Notes |
|------|-----------|--------------------------|-------|
| overview | 👁 (all-roles read) | benign — `getPlatformAuthContext()` only, no `requirePlatformAreaView` | Full dashboard metrics render; MetricSnapshotButton is present and **functional** (PAR-006) |
| organizations | 👁 (all-roles read) | benign — no page guard | Full org list + attention filter chips + free-floor column visible; all read-only display |
| orgs/[id] | 👁 (all-roles read) | benign — `getPlatformAdminContext()` for auth, not a guard | All 5 tabs render; write controls gated on `canManageSupport / canManageBilling / canManageProduct = false` — gating pattern holds (see PAR-002 for one subtlety) |
| customer_users | 👁 VIEW-ONLY (in matrix) | **no guard + no role prop passed to client** | Page renders; Actions menu exposes all write verbs — **PAR-001 Blocker** |
| audit | 👁 (all-roles read) | benign — no page guard | Full audit log with filters and export visible; no write capability (correct) |
| help | 👁 (all-roles read) | benign — no page guard | Help Hub visible with all 9 guide cards + SOPs; no read-only role-path — PAR-004 |
| retention | — HIDDEN | ✅ filtered from nav | Direct URL `requirePlatformAreaView('retention')` → redirect |
| early_access | — HIDDEN | ✅ filtered from nav | Correctly absent |
| email | — HIDDEN | ✅ filtered from nav | Correctly absent |
| change_requests | — HIDDEN | ✅ filtered from nav | Correctly absent |
| plans_pricing | — HIDDEN | ✅ filtered from nav | Correctly absent |
| bulk_operations | — HIDDEN | ✅ filtered from nav | Correctly absent |
| email_templates | — HIDDEN | nav filtered; **PF-1: [key] editor unguarded** | Direct URL `/platform-admin/email-templates/anything` is reachable |
| observability | — HIDDEN | ✅ filtered from nav | Correctly absent; `requirePlatformAreaView('observability')` blocks |
| platform_users | — HIDDEN | ✅ filtered from nav | Correctly absent |
| dev_tools | — HIDDEN | **PF-2: no role guard on page** | If `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`, reachable by direct URL |

---

## Cluster-by-cluster scorecard

| Cluster | Q1 Purpose | Q2 Sequence | Q3 Visual | Q4 Friction | Q5 Scan | Q6 Effective | Tribal knowledge? | Notes |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|-------|
| Overview dashboard | ✓ | ⚠ | ✓ | ⚠ | ✓ | ✓ | partial | Data legible; Action Queue links dead for inaccessible areas (early-access, retention, change-requests); MetricSnapshotButton active |
| Organizations list | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | no | Clean read-only list with attention filters; all display only; no write affordances surface |
| Organizations — Org Detail | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓ | partial | Tab gating is well-executed; `canManageBilling` correctly disables plan form; one coaching-portal write leak (PAR-002) |
| Customer Users | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | **YES** | Table readable; Actions menu fully rendered without role check — Blocker dead-end |
| Audit Log | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | no | Self-explanatory; filters + export; ideal for an auditor. Strong |
| Help Hub | ✓ | ⚠ | ✓ | ⚠ | ✓ | ⚠ | **YES** | No read-only / exec role-path; quick links all point to write-domain SOPs irrelevant to observer |

---

## Findings

| ID | Cluster | Severity | Type | Q | Tags | Evidence | Finding | Suggested direction | Route |
|----|---------|----------|------|---|------|----------|---------|---------------------|-------|
| **PAR-001** | Customer Users | **Blocker** | role-gating | Q4, Q6 | least-privilege, day-one | `app/platform-admin/customer-users/CustomerUsersClient.tsx:517-591`; `app/platform-admin/customer-users/page.tsx:130-149` | **Full Actions menu renders for read_only with no role check.** `CustomerUsersClient` receives no role prop and applies no `canWrite`/`canManage*` guard before rendering the "Actions" button and menu. The menu exposes Notes, Edit Info, Reset Password, Confirm Email, Revoke Sessions, Ban User, and Delete User — all of which call `manage_support`-gated APIs that return 403 for read_only. The observer sees a fully interactive-looking user management console with zero ability to act. | Pass a `canWrite` (or `canManageUsers`) boolean prop from `CustomerUsersPage` to `CustomerUsersClient`, computed from `hasPlatformPermission(auth.role, 'manage_support')`. When false, suppress the Actions button entirely and replace the actions column with a view-only indicator (or nothing). | backlog |
| **PAR-002** | Org Detail — Support tab | **High** | role-gating | Q4 | least-privilege | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:1028-1056` | **Coaches Portal ownership transfer form renders and is submittable for read_only.** The gate on the "Complete Transfer" button is `canManageSupport || canManageBilling`. For read_only, both are false, so the `<p class="emptyNote">` fallback renders correctly. **However**, the textarea (`ownershipReasons[transfer.linkId]`) is rendered unconditionally for all transfers, even though the button itself is gated. A read_only observer can type a reason into the textarea (it accepts input), but the "Complete Transfer" button is absent. This creates a confusing half-interactive form: you can fill in a field but the submit action is gone. Low user impact, but inconsistent with the pattern elsewhere. | Wrap the entire `canManageSupport || canManageBilling` block so neither the textarea nor the fallback `<p>` renders the textarea for unauthorized roles. The read-only fallback note is correct — it just should not include an interactive textarea above it. | backlog |
| **PAR-003** | Overview — Action Queue | **High** | ia-sequence | Q2, Q4 | least-privilege, day-one | `app/platform-admin/page.tsx:149-158` | **Action Queue contains links to areas hidden from read_only, with no indication they are dead-ends.** Six of the nine Action Queue alert items link to areas this role cannot reach: `early-access`, `retention`, and `change-requests` (redirected by area guard), and `orgs?filter=trial_ending`, `orgs?filter=expired_overrides`, `orgs?filter=no_owner` (these orgs links do load, but the filter implies an action). For an exec or auditor the queue implies "these things need attention" — clicking "4 Trials ending soon" redirects to the Overview, which appears broken. The observer has no way to act on these items or understand why the link redirected. | For each `<AlertItem>` that links to an area or filter the read_only role cannot meaningfully use, either (a) strip the `href` so it renders as a plain `<div>` count (non-clickable), or (b) add a `title`/tooltip reading "Requires billing/product access to act." Super-admin and functional roles should still receive the live links. | backlog |
| **PAR-004** | Help Hub | **Medium** | missing-sop | Q1, Q6 | least-privilege, day-one | `app/platform-admin/help/page.tsx:97-188` | **No read-only / observer role-path in the Help Hub.** The Help Hub has a "Platform Support" role-path and a "Billing and Product Admin" role-path, but nothing for read_only. An exec or auditor arriving on shift has no guided orientation: no "what you can see," no "how to read the audit log," no "how to use the Overview dashboard." The quick links all point to support/billing SOPs (password reset, override, comp period) that read_only cannot perform. | Add a "Read-Only Observer" role-path with steps: Overview metrics orientation, searching organizations, using the audit log for governance review, and a note explaining what to escalate (any action needed → contact support/billing team). | backlog |
| **PAR-005** | Overview — Notes tab | **Medium** | role-gating | Q4 | least-privilege | `app/platform-admin/page.tsx:378-400`; `app/platform-admin/MetricSnapshotButton.tsx:11-18`; `app/api/platform-admin/metrics/snapshot/route.ts:8` | **MetricSnapshotButton is live and functional for read_only.** The "Save Today Snapshot" button in the Overview's "Notes" tab is rendered without a role check and calls `POST /api/platform-admin/metrics/snapshot`. That API uses `requirePlatformAdmin()` (any authenticated platform user), not a tighter permission. Read_only can therefore **write a metric snapshot record** — the only data mutation this role can successfully complete. This is minor in impact (it's an append to a metrics table) but violates the role's pure-observer contract. | Guard `MetricSnapshotButton` with a `canWrite` prop computed from `hasPlatformPermission(auth.role, 'manage_product')` or similar, and either hide the button or disable it for read_only. Alternatively, tighten the API route to `requirePlatformPermission('manage_product')`. | backlog |
| **PAR-006** | Customer Users | **Medium** | copy | Q1 | least-privilege, day-one | `app/platform-admin/customer-users/CustomerUsersClient.tsx:418-420` | **No view-only banner or context note on the Customer Users page.** When a role with view-only access to customer_users (read_only, product, growth) lands here, there is no "You have view access only — no changes can be made" callout. The header reads "Customer Support / Customer Users" — which implies a write-capable support surface, not a view-only context. A read-only observer landing here has no signal that the Actions buttons they see are dead-ends before they click one. | Add a `HelpCallout` or role-contextual banner above the table when the viewing role is view-only on `customer_users`. e.g. "View-only access — search and review user records. Contact the support team to take any action." | backlog |
| **PAR-007** | Org Detail — Billing tab | **Low** | design-visual | Q3, Q5 | least-privilege | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:1213-1219` | **Billing & Access tab shows a generic "View-only" warning but the form fields are rendered (disabled) rather than hidden.** When `!canManageBilling`, the page shows a warning note at the top of the tab and disables the Plan select and Tournament Limit input. The Reason textarea also renders (disabled). An observer sees a form that appears editable but isn't. The "Review Change" submit button is absent (correctly gated by `canManageBilling`). The pattern is internally consistent but produces a visually confusing dense form for a pure viewer who has no need to see blank disabled fields. This is a low-severity display issue, not a security gap. | Consider collapsing the Plan/Limit form to a read-only summary (`<dl>` grid) when `!canManageBilling`, keeping only the plan label, current limit, and tournament count as display fields. Reserve the form layout for roles that can submit it. | backlog |
| **PAR-008** | Org Detail — Customer Users cross-link | **Low** | ia-sequence | Q2 | least-privilege | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:1600-1607` | **People tab renders "User record" links pointing to Customer Users for every member.** These links work for read_only (customer_users is viewable). However, they open Customer Users with the Actions menu fully rendered (PAR-001). The cross-link itself is fine, but combined with PAR-001 it deepens the dead-end experience — the observer follows a link from an org to a user's record, sees Actions, clicks one, and gets a 403. The org-to-user journey amplifies PAR-001. | Resolve via PAR-001 fix. No separate change needed here, but note the cross-link as a multiplier when prioritizing PAR-001. | backlog |

---

## Day-one verdict

**No — but barely, and for a different reason than other roles.**

A read-only observer can orient quickly on Overview and Org List — the data density is excellent and the information is relevant for an exec or auditor. The Audit Log is the best surface for this persona and requires zero tribal knowledge. Org detail is informative and the gating is mostly well-executed.

The stumbling block is Customer Users. On day one, the observer is handed what looks like a full user-management console (Actions button, all verbs visible) and then silently denied every action. Without any hint that the page is view-only, the observer will assume something is broken. This is the kind of confusion that triggers a support request or erodes trust in the console before the observer has had a chance to understand their access scope.

The second stumbling block is the Action Queue on the Overview dashboard. Six of nine alert cards appear to be navigation items but redirect to Overview (or load inaccessible filters) when clicked. The observer has no way to learn that "4 trials ending soon" is not actionable for their role.

A confident "yes" verdict requires two changes: suppress the Actions menu on Customer Users for view-only roles, and add a read-only observer role-path to the Help Hub. Everything else is polish.

---

## Clean view-only or dead-ends everywhere?

**Partially clean — two clusters are dead-end heavy; three clusters are genuinely clean.**

**Clean:**
- Org List (no write affordances surface; attention filters work as read-only drill-downs)
- Org Detail tabs (write controls correctly gated on `canManageSupport/Billing/Product`; observer sees notes history, override history, member list, audit trail — all useful)
- Audit Log (ideal for this role; self-explanatory, no write capability)

**Dead-end heavy:**
- **Customer Users** — the Actions button is fully rendered and responsive; every click ends in a 403 that the UI does not surface. This is the worst least-privilege failure for this role.
- **Overview Action Queue** — 6 of 9 items link to either nav areas the role cannot reach or filter states that imply actions the role cannot perform.

**Minor dead-ends:**
- MetricSnapshotButton is the inverse: a write that accidentally succeeds (read_only can write one type of record).
- Coaching Portal transfer textarea in org detail renders as an interactive field with no submit button.

---

## Top 5 moves

1. **Suppress Customer Users Actions menu for view-only roles (PAR-001 — Blocker).** Pass a `canManageUsers` prop from `CustomerUsersPage` to `CustomerUsersClient` and hide the Actions button when false. One-line server-side gate + one conditional in the client. Eliminates the most jarring dead-end experience for this role (and for product/growth who also have view-only customer_users access).

2. **Strip or tooltip dead-links in the Action Queue (PAR-003 — High).** For action queue items that point to areas the role cannot reach, render as non-clickable count tiles. Simplest fix: pass the role to `PlatformOverviewPage` (already fetches `getPlatformAuthContext()`) and conditionally remove the `href` prop from `AlertItem` for inaccessible targets. This removes the "why did clicking 'trials ending soon' take me back here?" confusion.

3. **Add a read-only observer role-path to the Help Hub (PAR-004 — Medium).** A four-step observer path (overview orientation → searching orgs → using the audit log → what to escalate) takes 30 minutes to write and closes the entire day-one orientation gap for this role.

4. **Add view-only context banner to Customer Users (PAR-006 — Medium).** Even if PAR-001 is resolved (button hidden), add a `HelpCallout` that explains this is a view-only surface when the role is not `manage_support`. Makes the constraint explicit and pre-empts confusion.

5. **Guard MetricSnapshotButton (PAR-005 — Medium).** Either pass a `canSnapshot` prop (false for read_only) or tighten the API to `requirePlatformPermission('manage_product')`. Closes the only accidental write channel this role has.

---

## Screenshots index

*(Stage C — live desktop screenshots, 1440×900, not yet captured; names reserved for when the live pass runs)*

| Filename | What it shows |
|----------|---------------|
| `pa6-s01-nav-read-only.png` | Nav as rendered for read_only — 5 items (Overview, Organizations, Customer Users 👁, Audit Log, Help); Growth and Billing & Product groups absent |
| `pa6-s02-overview-dashboard.png` | Overview dashboard — full metric grid, Action Queue with 9 alert items all appearing clickable |
| `pa6-s03-action-queue-dead-link.png` | Clicking "Trials ending soon" → redirect back to Overview; no error, no explanation |
| `pa6-s04-customer-users-actions-live.png` | Customer Users — Actions menu open showing all verbs (Notes, Edit, Reset, Ban, Delete) for read_only |
| `pa6-s05-org-detail-support-tab.png` | Org detail Support tab — Internal Notes read-only with "Requires support access" note; Identity section correctly collapsed |
| `pa6-s06-org-detail-billing-tab.png` | Org detail Billing tab — disabled form fields + "View-only" warning; submit button absent |
| `pa6-s07-org-detail-entitlements-tab.png` | Org detail Entitlements tab — module toggles disabled; "Requires product access" note |
| `pa6-s08-audit-log.png` | Audit Log — full table with filters; Export button; no write affordances |
| `pa6-s09-help-hub-no-read-only-path.png` | Help Hub — role paths showing Support and Billing/Product, no Read-Only Observer path |
| `pa6-s10-metric-snapshot-button.png` | Overview Notes tab — "Save Today Snapshot" button active for read_only; POST succeeds |
