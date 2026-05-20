# Platform Admin — Merged Improvements Plan

**Sources:** `claude_PLATFORM_ADMIN_REVIEW.md` + `codex_platform_admin_review.md` + `merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md`
**Status:** Planning — not yet scheduled for implementation

---

## PM Brief

FieldLogicHQ's platform admin should become the internal control plane for support, billing, product operations, and growth tracking. The current foundation is strong: organizations can be reviewed, plans can be adjusted, overrides and modules can be managed, early-access leads can be worked, retention records can be reviewed, and audit logs exist. The next step is to organize these tools around real operator workflows and add the missing support, metrics, and safety layers.

After this work, internal staff should be able to answer common questions without going to Supabase or Stripe first: who owns this org, what plan are they on, what changed recently, who is blocked, why did billing change, which users need help, how many orgs are on each plan, and what impact will a pricing or entitlement change have.

**Expected customer impact:** faster support responses, fewer manual database edits, safer billing changes, clearer account history, and better product decisions from plan, churn, growth, and usage metrics.

**Success criteria:**
- Platform admin navigation is grouped by operator workflow
- Support can search users across orgs and resolve common account issues without leaving the app
- Org detail shows billing, ownership, recent activity, and support context in one place
- Overview includes subscription health, growth, usage, and actionable alerts
- Plan and pricing changes show subscriber impact and are fully audit-logged
- High-risk actions are permissioned, reasoned, and traceable

---

## Product Manager UX Summary

Platform admins will see a more organized admin area with labeled sections for support, growth, billing/product, and system controls. The overview becomes a command center with meaningful health indicators instead of only total counts. Organization detail becomes a support console with billing status, owner contact, member context, recent changes, and common support actions in one place.

Support users can search across all customer users, generate password reset links, inspect org memberships, and open the relevant org without ever leaving FieldLogicHQ. Billing/product users can see how many orgs are on each plan before changing availability, pricing IDs, trials, or limits. Super admins still manage platform staff and sensitive system controls, but lower-risk support workflows don't require broad access to every setting.

**Role differences after this work:**
- **Support:** customer/org lookup, internal notes, reset links, support timeline, owner contact
- **Billing:** billing snapshot, retention, subscription/override review, Stripe links, comp periods
- **Product:** plan availability, limits, feature matrix, add-on catalog, pricing impact previews
- **Growth:** early-access pipeline, conversion tracking, marketing/source metrics
- **Security / Super Admin:** platform users, role assignment, audit log, dev tools, live config approvals

---

## Current Strengths — Preserve These

- Organization list with plan/status filters and inline plan edits
- Per-org subscription overrides, module toggles, and internal notes
- Platform audit log with filtering and pagination
- Retention queue with extension controls
- Early Access pipeline with notes and CSV export
- Plans & Pricing with Availability / Limits & Trials / Stripe Prices tabs
- Company Users invite/deactivate flow

---

## Core Principles

- Keep support workflows in FieldLogicHQ instead of requiring direct Supabase or Stripe access
- Make high-risk billing/product changes visible, explainable, and reversible where possible
- Separate "billing truth" (what Stripe says) from "temporary access override" (what we've manually set)
- Prefer readable operational dashboards before complex charting; start with live queries, add event durability later
- Group platform admin navigation by job-to-be-done, not database object

---

## Proposed Navigation

Reorganize the flat sidebar into workflow zones with section label dividers. Implementation is CSS/JSX only in `PlatformAdminNav.tsx` — no routing changes required.

```
COMMAND CENTER
  Overview

CUSTOMERS
  Organizations
  Customer Users        ← new (Phase 2d)
  Support Cases         ← new (Phase 2e, if built)
  Retention Queue

GROWTH & METRICS
  Early Access
  Funnel Metrics        ← new (Phase 3, stretch)
  Marketing / Sources   ← new (Phase 3, stretch)

BILLING & PRODUCT
  Plans & Pricing
  Add-ons               ← new (Phase 6, if built)
  Feature Gates         ← new (Phase 6, if built)
  Promo Campaigns       ← new (Phase 6, if built)

SYSTEM & SECURITY
  Audit Log
  Staff Users           ← renamed from "Company Users"
  Dev Tools
  Help
```

**Rename:** "Company Users" → "Staff Users" to distinguish internal platform admins from customer/org users. Move to `/platform-admin/staff`; free `/platform-admin/users` for the new cross-org customer user search.

---

## Phase 1 — Immediate Fixes + Nav Grouping
*Estimated effort: 2–3 days. No architectural changes.*

### 1a. Fix Retention Queue native browser dialogs
The Retention Queue uses `window.prompt()` for extension reason input and `window.alert()` for process-expiry results. These break the design system and can be accidentally dismissed.

**Fix:**
- Replace `window.prompt()` with an inline reason input that expands on "Extend" click — same pattern as the org overrides form in `OrgDetailClient.tsx`
- Replace `window.alert()` on process-expiry with a dismissible styled callout rendered inline below the action button

**File:** `app/platform-admin/retention/RetentionQueueClient.tsx`

### 1b. Surface the existing password reset API
A password reset route already exists at `app/api/platform-admin/users/[id]/reset/route.ts` but is not connected to any UI. Free support capability.

**Fix:** Add a "Send reset link" button to the Members table on the org detail page. POST to the existing route; show a confirmation inline on success.

**File:** `app/platform-admin/orgs/[id]/OrgDetailClient.tsx`

### 1c. Add missing billing fields to org detail
`organizations` stores `current_period_end`, `subscription_period`, and `stripe_customer_id` but none are surfaced on the org detail page.

**Fix:** Add a read-only "Billing Snapshot" section to the server component output:
- Stripe customer ID (monospace) with a "View in Stripe" deep-link to `https://dashboard.stripe.com/customers/{id}`
- Subscription period end date
- Billing interval (monthly / annual)
- Stripe subscription ID

**Files:** `app/platform-admin/orgs/[id]/page.tsx`, `app/platform-admin/orgs/[id]/OrgDetailClient.tsx`

### 1d. Fix help page inconsistency
The Help page states there is no self-serve platform user invite flow. The UI now has "Add User" and the API creates platform users. Update the copy.

**File:** `app/platform-admin/help/page.tsx`

### 1e. Add nav section labels
Add visual group label dividers to the sidebar — the lowest-effort structural improvement. Labels are display-only; no route changes.

**File:** `app/platform-admin/PlatformAdminNav.tsx`

### Acceptance Criteria — Phase 1
- Retention extension uses an inline form; process-expiry result renders inline
- Members table has a "Send reset link" button that shows a success/error state
- Org detail billing section shows Stripe customer ID with deep-link, period end date, and billing interval
- Help page accurately describes the current invite flow
- Nav shows labeled section groups

---

## Phase 2 — Support Foundation
*Estimated effort: 1–2 weeks.*

### 2a. Org Support Summary panel
Expand org detail into a full support console. The server component should pass and the client should render a dedicated support summary at the top of the page.

**Fields:**
- Organization name and slug
- Owner name and email
- Billing contact (if different from owner)
- Plan, subscription status, subscription period, current period end
- Stripe customer ID and subscription ID
- Active modules and enabled add-ons
- Onboarding / setup state
- Latest internal note excerpt
- Active overrides with expiry
- Count of recent audit events with link to full timeline

### 2b. Org rename / re-slug panel
Common support request that currently requires a direct DB edit.

**Spec:**
- Collapsible "Organization Identity" panel on org detail
- Fields: Display Name, Slug
- Slug edit shows warning: "Changing the slug breaks all existing public links and bookmarks for this org"
- On save: writes `organizations.name` and `organizations.slug`, writes to `platform_audit_log`
- API: new `PATCH /api/platform-admin/orgs/[id]/identity`

### 2c. Owner quick-contact button
**Spec:**
- "Contact owner" mailto link in the support summary or members section header
- Pulls owner email from members where `role = 'owner'`
- Opens the user's email client with address pre-filled

### 2d. Org activity timeline
Chronological feed of key events for a specific org — replaces manually filtering the audit log.

**Spec:**
- Collapsible section on org detail: "Activity Timeline"
- Sources (merged, sorted by timestamp):
  - `platform_audit_log` filtered to this `org_id`
  - `subscription_events` if Phase 3b exists; otherwise inferred from audit log entries
- Display: timestamp, actor email, event label, changed values
- Last 50 events; "View full audit log →" link filters audit log to this org
- Requires `org_id` filter param added to the audit log query (see Phase 7c)

### 2e. Cross-org customer user search (new page)
No way to look up a user by email across all orgs without opening Supabase Auth directly.

**Spec:**
- New page: `/platform-admin/users`
- Search by email or display name across `org_members` joined to Supabase auth users
- Results: email, display name, orgs + role in each, last sign-in, auth account status
- Actions: send password reset (existing route), copy user ID, link to each org
- Read-only except for the reset link action
- Note: Supabase auth user list has a fixed page size cap — paginated search strategy needed as user base grows

### 2f. Support tags on orgs *(lower priority)*
Lightweight tagging for workflow triage.

**Spec:**
- Add `support_tags text[]` column to `organizations` (migration required)
- Predefined values: `onboarding_issue`, `billing_issue`, `churn_risk`, `data_restore`, `product_feedback`, `comp_granted`, `vip`
- Tag chips on org detail above internal notes textarea
- Tag filter dropdown on org list; tag indicator dot on list rows
- API: include tags in the existing org PATCH or a new dedicated route

### 2g. Guarded support access / "view as org admin" *(lower priority)*
The "↗ Admin" link navigates to `/{slug}/admin` under the platform admin's own session, which has no org access. No way to view the org's admin area in a support context.

**Spec:**
- Replace with a "Support Access" button that:
  1. Shows an inline reason form (not `window.prompt()`)
  2. On submit: sets a short-lived `platform_support_context` cookie (org_id + expiry)
  3. Redirects to `/{slug}/admin` where a visible banner renders: "Viewing as support — [org name] — expires in 30 min — End session"
  4. Writes to `platform_audit_log` on entry and on "End session"
- All write operations in support context blocked or require additional confirmation
- Cookie auto-expires after 30 minutes
- The org admin layout reads the cookie and renders the banner

### Acceptance Criteria — Phase 2
- Support can find any customer user by email without opening Supabase
- Support can send a password reset link from within the platform admin
- Org detail shows owner/contact/billing context without requiring Stripe
- Org rename and slug changes are audit-logged and guarded by a confirmation
- Org timeline shows last 50 events with a link to the full scoped audit log

---

## Phase 3 — Metrics Command Center
*Estimated effort: 1–2 weeks for live-query metrics; 3–5 additional days for durable event infrastructure.*

Expand Overview from 4 stat cards + 2 health items into an operating dashboard.

**Data strategy:** Ship Phase 3a with live aggregate queries first — this is immediately useful with zero migration work. Phase 3b (durable event log) is a follow-on that unlocks historical trend lines, churn windows, and cohort analysis. Metrics that require event history are clearly marked below.

### Phase 3a — Live metrics (no migration required)

**Subscription Health**

| Metric | Query source |
|---|---|
| Orgs per plan | `GROUP BY plan_id` on `organizations` |
| Active / trialing / past due / canceled per plan | Same + `subscription_status` |
| Estimated MRR | Plan prices × active paid org count per plan (no Stripe query) |
| Trialing orgs | `subscription_status = 'trialing'` |
| Trials ending within 7 days | `subscription_status = 'trialing'` AND `current_period_end <= now() + 7 days` |
| Past due orgs | Already exists — promote to more prominent position |
| Inactive orgs (no owner sign-in 60+ days) | Join `org_members` to Supabase auth last-seen |

**Growth**

| Metric | Query source |
|---|---|
| New orgs (7 / 30 / 90 days) | `organizations.created_at` range queries |
| Activation rate | Orgs with `onboarding_completed_at` vs. total created |
| Early access → conversion (current) | Count early access records with `converted_at` set (requires Phase 6a) |

**Platform Activity**

| Metric | Query source |
|---|---|
| Active vs. archived tournaments | `tournaments.status` |
| Tournaments created (30 days) | `tournaments.created_at` range |
| Module adoption | `COUNT orgs with each enabled_addons value` |
| Active rep teams | `rep_teams` count for Club plan orgs |

**Alerts (rendered at top of Overview)**
- New past-due orgs since last admin visit
- New early-access leads in queue
- Retention records within 14 days of purge
- Expired overrides still showing as active
- Trials ending within 7 days

### Phase 3b — Durable event infrastructure *(follow-on)*

Computing churn, conversion windows, and cohort metrics from current row state is lossy. A separate event log preserves history.

**Migration:** New table `subscription_events`
```sql
create table subscription_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id),
  event_type  text not null,
  -- plan_changed | status_changed | trial_started | trial_converted
  -- canceled | reactivated | downgraded | upgraded
  from_value  text,
  to_value    text not null,
  source      text not null, -- stripe_webhook | platform_admin | self_serve
  actor_email text,
  created_at  timestamptz not null default now()
);
create index on subscription_events (org_id, created_at desc);
create index on subscription_events (event_type, created_at desc);
```

**Writers to update:**
- `app/api/billing/webhook/route.ts` — on `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- `app/api/platform-admin/orgs/[id]/plan/route.ts`
- Downgrade / cancel confirm routes (once D4 Stripe gap is resolved)

**Metrics unlocked by event log:**
- Trial conversion rate (30-day): `trial_converted` events ÷ `trial_started` events in window
- Cancellations (7 / 30 / 90 days): `canceled` events in each window
- Downgrades: `plan_changed` events where `to_value` is a lower tier
- Past due recovery rate: status `past_due` → `active` transitions
- Cohort view: orgs created by month with current plan status per cohort

**Phase 3c — Daily metric snapshots *(optional stretch)*:**
A daily cron snapshots `organizations GROUP BY plan_id, subscription_status` into `metric_snapshots`. Enables sparkline charts without complex event replay.

### Acceptance Criteria — Phase 3
- Overview shows plan mix, subscription health, growth, activity, and action alerts
- Metrics are filterable by date window where relevant
- Counts don't rely solely on current row state once Phase 3b is implemented
- Alerts are actionable and link to the relevant page

---

## Phase 4 — Billing & Product Safety
*Estimated effort: 1–1.5 weeks.*

### 4a. Plans & Pricing — Subscriber counts
Add a `subscribers` column to the Availability tab showing active org count per plan. Makes the impact of a gating change immediately visible before applying it.

**Implementation:** `subscriberCounts: Record<string, number>` prop on `PlansPricingClient`, queried in the server component alongside existing fetches.

### 4b. Plans & Pricing — Active/trialing/past-due breakdown
Expand subscriber count to show status breakdown per plan (active | trialing | past due | canceled). Rendered as a compact stat group in the Availability tab row.

### 4c. Plans & Pricing — Impact preview callout
When editing trial days or limits, show contextual info: *"X orgs are currently trialing Tournament Plus. Changing the trial from 14 to 30 days affects all new checkouts — existing trials are unaffected."*

**Implementation:** Server-rendered counts passed as props; displayed as a static info callout adjacent to each row's edit state in the Limits & Trials tab.

### 4d. Plans & Pricing — Show live/sandbox environment clearly
The Stripe Prices tab already detects sandbox vs. live from the key prefix. Make this more prominent: a persistent environment badge at the top of the Stripe Prices tab, not just in the column header.

### 4e. Plans & Pricing — Change notes on Limits saves
Add an optional `note` field to the Limits & Trials edit form. Store in a new `change_note` column on `plan_config_overrides`. Render as a tooltip on the last-updated timestamp.

**Migration:** Add `change_note text` column to `plan_config_overrides`.

### 4f. Plans & Pricing — Scheduled / effective-date changes
Right now any config change takes effect immediately. Add an optional `effective_at` field so changes can be staged.

**Migration:** Add `effective_at timestamptz` to `plan_config_overrides`.

**Checkout route change:** `getPlanConfigOverride()` selects the most recent row where `effective_at IS NULL OR effective_at <= now()`.

### 4g. Plans & Pricing — Stripe price validation
Before saving a price ID, validate it against Stripe to confirm it exists in the correct environment and that product name, currency, and interval match expectations.

**Implementation:** On save, call `stripe.prices.retrieve(priceId)` server-side; return a validation summary (product name, currency, interval) as a confirmation step before committing to DB.

### 4h. Audit logging coverage expansion
The following actions currently write no audit log entries and should be added:

- [ ] Plan gating changes (`plan_gating` table writes)
- [ ] Plan config override saves (`plan_config_overrides` writes)
- [ ] Stripe price ID changes
- [ ] Platform user invite, deactivate, remove
- [ ] Org rename / slug changes (Phase 2b)
- [ ] Customer password reset link generation (Phase 1b / 2e)
- [ ] Support access / view-as session start and end (Phase 2g)

All of these should use the existing `writePlatformAuditLog` helper.

### 4i. Override semantics fix *(architectural)*
**Current problem:** Overrides in `org_overrides` write directly to `organizations.subscription_status`. Revoking an override marks it revoked but does not restore the Stripe-derived status. The org is left with whatever was manually set.

**Recommended fix:** Split into two fields:
- `billing_subscription_status` — written only by the Stripe webhook handler; reflects Stripe's state
- `subscription_status` becomes the effective/cached field, computed from billing truth + active overrides

**Migration:** Add `billing_subscription_status` column; backfill from current `subscription_status`; update webhook to write to `billing_subscription_status`; add `getEffectiveStatus(org)` helper; update all read paths. This should be done before the permissions model is finalized, as it affects what billing-role users can safely edit.

### Acceptance Criteria — Phase 4
- Plans & Pricing shows subscriber count and status breakdown before any gating change
- Pricing admins see subscriber impact before changing limits or trial days
- Sandbox vs. live environment is unambiguous on the Stripe Prices tab
- All plan, pricing, and platform-user changes appear in the audit log with actor + reason
- Revoking an override falls back to Stripe-derived status, not stale manually-set state

---

## Phase 5 — Platform Admin Permissions
*Estimated effort: 1 week design + 1 week implementation.*

The current auth model is binary: active `platform_users` row or bootstrap admin email. As higher-risk actions are added (Stripe pricing changes, bulk org operations, support access), a single tier is insufficient.

### Proposed roles

| Role | Access |
|---|---|
| **Support** | Read all orgs/users, write internal notes and support tags, send reset links, support access (view-as) |
| **Billing** | All Support + apply overrides, comp periods, extend retention, view Stripe IDs |
| **Product** | Read-only Plans & Pricing, metrics dashboard, impact previews |
| **Growth** | Early Access pipeline, metrics dashboard, promo campaign management |
| **Security** | Read-only audit log + export, platform user management |
| **Super Admin** | All permissions including Plans & Pricing writes, role assignment, platform user management |

### Guarded actions
The following actions require role check + confirmation + audit-logged reason:

- Plan changes (org-level)
- Subscription / access overrides
- Bulk org operations
- Org slug changes
- Live Stripe price ID edits
- Plan config override saves
- Support access / view-as sessions
- Platform user removal
- Approval workflow for plan gating changes *(stretch — needs two Super Admins)*

### Implementation
- Add `role text` column to `platform_users` (migration)
- `getPlatformAuthContext()` returns `role` alongside the user
- Each sensitive API route checks the required role; returns 403 if insufficient
- Nav shows only sections accessible to the current role
- Role shown in Staff Users table; Super Admins can change roles

### Acceptance Criteria — Phase 5
- A platform user can be restricted to support-only or growth-only workflows
- Billing/product/security actions are not available to every platform user by default
- Sensitive actions require a stated reason and produce an audit log entry

---

## Phase 6 — Growth & Product Catalog
*Estimated effort: 2–4 weeks depending on scope selected.*

### 6a. Early Access — Conversion tracking
- Add `converted_at timestamptz` and `converted_org_id uuid` to the early access table
- Add "Mark as converted" action in `EarlyAccessClient` with org ID picker
- Link converted lead to the organization record
- Show conversion metrics: qualified → pilot → converted counts and rates per plan interest
- Optional: follow-up due date / next action field for pipeline management

### 6b. Product catalog — Feature matrix editor *(stretch)*
Rather than only numeric limits per plan, expose a visual feature matrix editor showing which modules and capabilities are included per plan tier. Currently this is hardcoded in plan config.

### 6c. Add-on catalog *(stretch)*
Platform admin management page for add-on products: public site, accounting, rep teams, extra rep teams, support packages. Ties into the Billing & Product nav zone.

### 6d. Grandfathering rules *(low priority)*
When a plan's included limits are reduced, existing orgs should not be retroactively capped. Add `grandfathered_until timestamptz` to `organizations` and a platform admin control to set it per org.

### 6e. Promo / trial campaigns *(medium priority)*
Enable time-limited extended trials or discounted first months for marketing campaigns.

**Spec:**
- New table `promo_campaigns` (code, plan_id, trial_days_override, discount_percent, valid_from, valid_until, max_redemptions, redeemed_count)
- Checkout route accepts optional `?promo=CODE`; validates and applies the override
- Platform admin management page under Billing & Product nav zone

### 6f. Bulk org operations *(after permissions are solid)*
- Bulk override status
- Bulk comp-period grant
- Bulk plan change
- Bulk module / add-on enablement
- All bulk actions: role-gated, previewed (show affected orgs), reason required, audit-logged

### Acceptance Criteria — Phase 6
- Growth can track early access → org conversion with dates and plan interest
- Product can stage future pricing changes before publishing
- Bulk actions require confirmation, a stated reason, and produce audit entries

---

## Phase 7 — Audit Log & Dev Tools
*Estimated effort: 1 week.*

### 7a. CSV export
Server-side export route applying the same filters as the current page.

**Route:** `GET /api/platform-admin/audit/export?q=...&from=...&to=...&action=...`

**UI:** "Export CSV" button in the filter bar.

### 7b. Full value viewer
Values truncated at 80 chars. Complex JSON (e.g., `enabled_addons` arrays, config objects) not inspectable.

**Fix:** Replace truncated `<span>` with an expandable row — click to expand a pre-formatted JSON block beneath the row.

### 7c. Org-scoped filter param
Add `org_id` as a direct filter param to the audit log query (alongside existing text search). Enables the activity timeline deep-link from Phase 2d to pre-scope the log to one org.

### 7d. Action descriptions
Raw action names (`plan_change`, `override_applied`, `addon_toggled`) are opaque. Add a static lookup map: action → human-readable label shown as a tooltip on the action cell.

### 7e. Dev Tools additions
- **Env var checker:** Required env vars (Stripe keys, Resend key, webhook secret) with ✓/✗ for presence — no values revealed
- **Test email sender:** Send a template preview (trial ending, payment failed, etc.) to a specified address via Resend
- **Stripe webhook replay:** Trigger a Stripe test event (`checkout.session.completed`, `invoice.payment_failed`) for end-to-end testing without Stripe CLI

---

## Implementation Order

1. Nav section label dividers and "Company Users" → "Staff Users" rename
2. Retention Queue inline forms (replace `window.prompt` / `window.alert`)
3. Surface existing reset link API in org detail members table
4. Add billing snapshot fields to org detail (Stripe ID, period end, interval)
5. Fix help page copy
6. Org support summary panel (owner, billing contact, active overrides, modules)
7. Org rename/re-slug panel with audit log write
8. Owner quick-contact button
9. Org activity timeline (sourced from audit log)
10. Customer Users search page (`/platform-admin/users`)
11. Overview metrics dashboard — live aggregate queries (Phase 3a)
12. Plans & Pricing subscriber counts and impact previews (Phase 4a–c)
13. Audit logging coverage expansion for plan/pricing/user actions (Phase 4h)
14. Override semantics refactor (Phase 4i)
15. Subscription event log migration + writers (Phase 3b)
16. Metrics — event-sourced churn and conversion windows
17. Audit log CSV export + full value viewer + org filter param
18. Platform admin role model (Phase 5)
19. Early Access conversion tracking (Phase 6a)
20. Remaining Phase 6 items as prioritized (campaigns, bulk ops, catalog)

---

## Key Technical Notes

- Do **not** add a root `middleware.ts` — update `proxy.ts` and its exported `proxy()` function per project convention
- Keep all platform admin APIs under `app/api/platform-admin/`
- Use the existing `writePlatformAuditLog` helper throughout; extend its usage before introducing new audit abstractions
- Stripe deep-links must not expose secrets — display IDs only and link to Stripe dashboard URLs, restricted to Billing/Super Admin roles
- Supabase auth user listing uses a fixed page size; the current `listUsers({ page: 1, perPage: 1000 })` call in Overview and Org Detail will become inaccurate as user base grows — a paginated search strategy is needed for the Customer Users page
- Any "view as org admin" feature must show a persistent support banner, require a reason, expire automatically, and write audit logs on both entry and exit
- The metrics dashboard should use live queries initially; add `subscription_events` and daily snapshots as a follow-on rather than blocking the dashboard on migration work

---

## Verification Plan

**Non-browser (can be done by the agent):**
- TypeScript typecheck passes after each phase
- Lint passes
- API routes return correct status codes and shapes for valid and invalid inputs
- Audit log writes verified for each newly-covered action
- DB migration SQL reviewed for correctness before applying

**Browser (performed by the user per project rules):**
- Nav section labels and active states render correctly
- Retention Queue inline extension form and process-expiry result callout
- Reset link button in org detail members table (success and error states)
- Org detail billing snapshot with Stripe deep-link
- Customer Users search results and reset link action
- Org activity timeline events and "View full audit log" link
- Overview dashboard stat counts and alert callouts
- Plans & Pricing subscriber counts, status breakdowns, and impact preview callouts
- Audit log CSV download and full value expansion

---

## Open Questions

1. **Support access / view-as:** Implement full guarded session (Phase 2g), or keep the plain `↗ Admin` deep-link as the only support path for now?
2. **Override semantics timing:** Should the `billing_subscription_status` / `effective_subscription_status` split happen before permissions (makes Phase 5 safer) or after (avoids blocking the permissions work)?
3. **Metrics snapshot cadence:** Daily snapshots only, or should key billing events also be written immediately to `subscription_events`? (Both is ideal but more work.)
4. **Role model scope at launch:** Which roles ship first? Suggestion: Super Admin + Support + Billing as the MVP set, with Product/Growth/Security added as the relevant features are built.
5. **Org rename / slug availability:** Should slug changes be restricted to Super Admin only, or also available to Billing or Support roles?
6. **Supabase user lookup strategy:** Paginated search via `supabaseAdmin.auth.admin.listUsers` works up to ~10k users — at what point do we need a dedicated `users` cache table?

---

## Consolidated Priority Table

| Priority | Phase | Item | Effort |
|---|---|---|---|
| **Immediate** | 1 | Retention Queue dialog fix | 1–2 days |
| **Immediate** | 1 | Surface existing reset link | < 1 day |
| **Immediate** | 1 | Billing fields on org detail | 1 day |
| **Immediate** | 1 | Nav section labels | < 1 day |
| **Immediate** | 1 | Fix help page copy | < 1 day |
| **High** | 2 | Org support summary panel | 1–2 days |
| **High** | 2 | Org rename / re-slug | 1–2 days |
| **High** | 2 | Owner quick-contact | < 1 day |
| **High** | 2 | Org activity timeline | 2–3 days |
| **High** | 2 | Customer Users search page | 3–4 days |
| **High** | 3a | Metrics dashboard (live queries) | 1–1.5 weeks |
| **High** | 4 | Plans & Pricing subscriber counts + impact preview | 2–3 days |
| **High** | 4h | Audit logging coverage expansion | 2–3 days |
| **Medium** | 3b | Subscription event log (migration + writers) | 3–5 days |
| **Medium** | 4d–g | Plans & Pricing: env badge, change notes, scheduled changes, Stripe validation | 1 week |
| **Medium** | 4i | Override semantics refactor | 3–5 days |
| **Medium** | 5 | Role-based platform permissions | 2 weeks |
| **Medium** | 7a–d | Audit log: CSV export, full value viewer, org filter, action labels | 1 week |
| **Low** | 2f | Support tags on orgs | 2–3 days |
| **Low** | 2g | Guarded support access / view-as | 3–5 days |
| **Low** | 6a | Early Access conversion tracking | 2–3 days |
| **Low** | 6e | Promo / trial campaigns | 1–2 weeks |
| **Low** | 6f | Bulk org operations | 1 week |
| **Low** | 7e | Dev Tools improvements | 2–3 days |
| **Low** | 6b–d | Feature matrix, add-on catalog, grandfathering | 2–4 weeks |
