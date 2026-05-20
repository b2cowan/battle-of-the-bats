# Merged Platform Admin Implementation Plan

## PM Brief

FieldLogicHQ's platform admin should become the internal control plane for support, billing, product operations, and growth tracking. The current foundation is strong: organizations can be reviewed, plans can be adjusted, overrides and modules can be managed, early-access leads can be worked, retention records can be reviewed, and audit logs exist. The next step is to organize these tools around real operator workflows and add the missing support, metrics, and safety layers.

After this work, internal staff should be able to answer common questions without going to Supabase or Stripe first: who owns this org, what plan are they on, what changed recently, who is blocked, why did billing change, which users need help, how many orgs are on each plan, and what impact will a pricing or entitlement change have.

Expected customer impact: faster support, fewer manual database edits, safer billing changes, clearer account history, and better product decisions from plan, churn, growth, and usage metrics.

Success criteria:

- Platform admin navigation is grouped by operator workflow.
- Core platform admin pages use consistent information architecture instead of long unstructured stacks.
- Support can search users across orgs and resolve common account issues from the app.
- Org detail shows billing, ownership, recent activity, and support context in one place.
- Overview includes subscription health, growth, usage, and action alerts.
- Plan and pricing changes show subscriber impact and are fully audit-logged.
- High-risk actions are permissioned, reasoned, and traceable.

## Product Manager UX Summary

Platform admins will see a more organized admin area with sections for support, growth, billing/product, and system controls. The overview becomes a command center with meaningful health indicators instead of only total counts. Organization detail becomes a support console with billing status, owner contact, member context, recent changes, and common support actions.

Support users can search across all customer users, generate reset links, inspect org memberships, and open the relevant org without leaving FieldLogicHQ. Billing/product users can see how many orgs are on each plan before changing availability, pricing IDs, trials, or limits. Super admins can still manage platform staff and sensitive system controls, but lower-risk support workflows do not require broad access to every setting.

The platform admin should also feel intentionally organized page by page. Instead of every page becoming a vertical list of unrelated panels, high-use pages should have a clear primary workflow, grouped secondary details, and visible next actions. For example, an organization detail page should read as: "what is this account, is anything wrong, what can support do, what changed recently?" before exposing deeper billing, modules, members, and notes.

Role differences:

- **Support**: customer/org lookup, notes, reset links, support timeline, owner contact.
- **Billing**: billing snapshot, retention, subscription/override review, Stripe links.
- **Product**: plan availability, limits, feature matrix, add-on catalog, pricing impact previews.
- **Growth**: early-access pipeline, conversion tracking, marketing/source metrics.
- **Security/Super Admin**: platform users, permissions, audit log, dev tools, live config approvals.

## Source Review

This plan merges recommendations from:

- `claude_PLATFORM_ADMIN_REVIEW.md`
- `codex_platform_admin_review.md`

The Claude review contributes concrete near-term implementation items and UX polish. The Codex review contributes the long-term operating model, governance, permissions, event durability, and product catalog direction.

## Current Strengths

- Organization list with plan/status filters and inline plan edits.
- Organization detail with members, tournaments, overrides, module toggles, and internal notes.
- Platform audit log with filters and pagination.
- Retention queue for billing-retained records.
- Plans & Pricing page with plan availability, limits/trials, and Stripe price IDs.
- Early Access pipeline with filtering, detail workflow, notes, templates, and CSV export.
- Company/platform user management.

## Core Principles

- Keep support workflows in FieldLogicHQ instead of requiring direct Supabase or Stripe access.
- Make high-risk billing/product changes visible, explainable, and reversible where possible.
- Separate "billing truth" from "temporary access override" semantics.
- Prefer readable operational dashboards before complex charting.
- Start with live queries where practical, but design metrics around durable events and snapshots.
- Group platform admin navigation by job-to-be-done, not database object.

## Proposed Navigation

Add sidebar group labels or collapsible zones:

### Command Center

- Overview
- Alerts / Action Queue
- Recent Activity

### Customers

- Organizations
- Customer Users
- Support Cases
- Retention Queue

### Growth & Metrics

- Early Access
- Funnel Metrics
- Marketing / Sources

### Billing & Product

- Plans & Pricing
- Add-ons
- Feature Gates
- Stripe Prices

### System & Security

- Platform Users
- Audit Log
- Dev Tools
- Help

Rename the existing `/platform-admin/users` surface to **Platform Users** or **Company Users**. Add a separate **Customer Users** page for org/member lookup.

## Phase 1 - Support Console Foundation

Status: Implementation complete; browser verification pending.

Goal: make the platform admin immediately more useful for everyday support.

### Tasks

- [x] Reorganize platform admin nav with labeled sections.
- [x] Rename current `Users` nav item to `Platform Users` or `Company Users`.
- [x] Add new `Customer Users` page.
- [x] Implement global customer-user search across org memberships and Supabase auth users.
- [x] Show customer user email, display name, org memberships, role per org, member status, auth status, and last sign-in.
- [x] Surface password reset link generation in the customer-user UI.
- [x] Add org detail **Support Summary** panel.
- [x] Add org owner and billing contact display.
- [x] Add "email owner" mailto shortcut.
- [x] Add org rename/re-slug panel with warning about public link impact.
- [x] Add org activity timeline sourced from `platform_audit_log`.
- [x] Replace Retention Queue `window.prompt()` and `window.alert()` with inline forms and dismissible result callouts.

### Org Detail Support Summary Fields

- Organization name and slug.
- Owner name/email.
- Billing contact if available.
- Plan, subscription status, subscription period, current period end.
- Stripe customer id and subscription id.
- Active modules and add-ons.
- Onboarding/setup state.
- Latest platform admin note.
- Active overrides and expired overrides.
- Recent audit events.

### Acceptance Criteria

- Support can find a customer by email and identify their org/role without Supabase.
- Support can generate a reset link from platform admin.
- Org detail shows owner/contact/billing context without requiring Stripe first.
- Retention extension flow uses app-native UI.
- Org rename and slug changes are audit-logged and guarded by confirmation.

## Phase 1.5 - Information Architecture And Layout Pass

Goal: make platform admin pages easier to understand before adding more metrics, billing tools, and product controls.

### Why This Phase Exists

Phase 1 added useful support context, but the org detail page now exposes too many sections in a long vertical stack. That creates a comprehension problem: the user can see many facts, but not the logic of what to do first, what is informational, what is risky, and what is a support action. This same pattern can spread to Overview, Plans & Pricing, Audit Log, Retention Queue, Early Access, and Platform Users as more functionality is added.

### Page Architecture Pattern

Each platform admin page should follow a consistent structure:

- **Snapshot**: the few facts needed to orient the operator.
- **Needs Attention**: warnings, inconsistent state, overdue action, or blocked workflows.
- **Primary Actions**: the small set of things this page is mainly for.
- **Grouped Detail**: related information organized by support, billing, product, users, or activity.
- **History / Evidence**: notes, audit events, previous actions, and logs.

### Organization Detail Restructure

- [ ] Add a compact account header with plan, subscription status, owner, member count, tournament count, and direct admin link.
- [ ] Add a "Needs attention" strip for inconsistent billing state, expired overrides, missing owner, past-due/canceled status, retained records, or over-limit usage.
- [ ] Group org detail into clear workflow zones: Account, Support, Billing, Entitlements, People, Activity.
- [ ] Convert lower-priority sections into tabs, accordions, or a two-column master/detail layout so users do not have to scroll through every panel.
- [ ] Put common support actions near the top: email owner, reset user path, edit notes, change plan, add override.
- [ ] Move dangerous or uncommon actions behind explicit "Advanced" grouping with reason/confirmation language.
- [ ] Make duplicate facts appear once, then link to the detailed section instead of repeating the same status across Support Summary, Billing Snapshot, and Plan & Entitlements.

### Platform Admin Wide Layout Audit

- [ ] Review Overview, Organizations, Customer Users, Retention Queue, Plans & Pricing, Early Access, Platform Users, and Audit Log for the same long-stack problem.
- [ ] Define reusable page-level components or CSS patterns for summary strips, action bars, section groups, tabs, and empty states.
- [ ] Standardize section titles around operator intent, not database names.
- [ ] Ensure each page has a clear first action and a clear investigation path.
- [ ] Preserve dense operational views for tables, but avoid mixing edit forms, logs, and summaries without grouping.

### Acceptance Criteria

- Org detail can be scanned above the fold for account status, owner, plan, and urgent issues.
- Support, billing, entitlement, people, and activity concerns are visually separated.
- Repeated billing/status fields are reduced or intentionally cross-linked.
- Platform admin pages share a recognizable layout system.
- Future Phase 2-5 functionality has a place to live without making pages feel longer and less coherent.

## Phase 2 - Metrics Command Center

Goal: turn Overview into an operating dashboard.

### Subscription Health Metrics

- [ ] Organizations by plan.
- [ ] Organizations by subscription status.
- [ ] Active/trialing/past due/canceled per plan.
- [ ] Estimated MRR/ARR from plan prices and active paid orgs.
- [ ] Trials ending soon.
- [ ] Cancellations in last 7/30/90 days.
- [ ] Downgrades in last 7/30/90 days.
- [ ] Past-due recovery count/rate where data supports it.

### Growth Metrics

- [ ] New organizations in 7/30/90 days.
- [ ] New organizations by plan.
- [ ] Early-access leads by status.
- [ ] Qualified, contacted, pilot, converted counts.
- [ ] Conversion rate from early access to org/customer.
- [ ] Source path / marketing source summary.

### Product Usage Metrics

- [ ] Active and archived tournaments.
- [ ] Tournaments created in last 30 days.
- [ ] Teams and registrations by module.
- [ ] House-league seasons and active registrations.
- [ ] Rep teams and active program years.
- [ ] Public-site enabled orgs.
- [ ] Accounting enabled orgs and ledger activity counts.

### Alerts

- [ ] New past-due orgs since last admin visit.
- [ ] New early-access leads waiting for review.
- [ ] Retention records approaching purge.
- [ ] Expired overrides still active.
- [ ] Trials ending soon.
- [ ] Orgs with no owner sign-in recently.

### Data Strategy

Initial implementation may use live aggregate queries for speed. Longer term, add:

- `platform_events` for durable lifecycle events.
- Daily metric snapshots for trend lines.
- Plan transition events for churn/downgrade/upgrade history.
- Marketing/source attribution fields where available.

### Acceptance Criteria

- Overview answers current plan mix, account health, growth, churn, and action items.
- Metrics are filterable by date window where relevant.
- Counts do not rely only on current row state when historical accuracy matters.

## Phase 3 - Billing & Product Safety

Goal: make pricing, plan, and subscription changes safer before expanding functionality.

### Plans & Pricing

- [ ] Add subscriber count per plan to the Availability tab.
- [ ] Add active/trialing/past-due/canceled breakdown per plan.
- [ ] Add impact preview before changing trial days, limits, or availability.
- [ ] Add optional change note on config updates.
- [ ] Surface last changed by, last changed at, and note in the UI.
- [ ] Validate Stripe price IDs against Stripe when possible.
- [ ] Show live/sandbox environment clearly.

### Audit Logging

Add platform audit logging for:

- [ ] Plan gating changes.
- [ ] Plan config overrides.
- [ ] Stripe price ID changes.
- [ ] Platform user invite/deactivate/remove.
- [ ] Org rename/slug changes.
- [ ] Customer password reset link generation.
- [ ] Support access/view-as sessions if implemented.

### Override Semantics

Current behavior appears to write subscription-status overrides directly to `organizations.subscription_status`. This should be made safer.

Recommended model:

- Keep Stripe/billing-derived status as the billing truth.
- Store temporary access changes in an override table.
- Compute effective access status from billing truth plus active overrides.
- When an override expires or is revoked, effective access falls back to billing truth.

Potential schema direction:

- `organizations.billing_subscription_status`
- `organizations.subscription_status` as effective/cache field, or compute through helper
- `org_overrides` remains the source of temporary access decisions

### Audit Log UX

- [ ] Add CSV export for current filters.
- [ ] Add full value viewer for large JSON values.
- [ ] Add "filter to this org" action.
- [ ] Add action label/description map for human-readable audit entries.

### Acceptance Criteria

- High-risk billing/product changes are traceable with actor, time, old value, new value, and reason/note.
- Pricing admins can see subscriber impact before changing availability or limits.
- Revoking or expiring an access override does not leave stale billing state behind.
- Audit log is useful for investigation, not only recordkeeping.

## Phase 4 - Permissions And Governance

Goal: prevent the platform admin from becoming an all-or-nothing superuser surface.

### Platform Admin Roles

Add role-based permissions for platform admins:

- **Support**: customer lookup, org detail, notes, reset links, support timeline.
- **Billing**: billing snapshot, retention, subscription/override actions, Stripe links.
- **Product**: plans, pricing, feature gates, add-ons.
- **Growth**: early-access pipeline, conversion reporting, marketing/source metrics.
- **Security**: audit log, platform users, auth-sensitive operations.
- **Super Admin**: all platform admin actions.

### Guarded Actions

Require role, confirmation, and reason/note for:

- Plan changes.
- Subscription/access overrides.
- Bulk org operations.
- Org slug changes.
- Live Stripe price edits.
- Support access/view-as sessions.
- Platform user removal.

### Acceptance Criteria

- A platform user can be limited to support-only or growth-only work.
- Billing/product/security actions are not available to every platform user by default.
- Sensitive actions are reasoned and audit-logged.

## Phase 5 - Growth And Product Catalog

Goal: support product planning, launch management, add-ons, and conversion analysis.

### Early Access

- [ ] Add `converted_at`.
- [ ] Add "Mark as converted" action.
- [ ] Link converted lead to organization id.
- [ ] Show conversion metrics by plan interest and feature interest.
- [ ] Add follow-up due date / next action if useful.

### Product Catalog

- [ ] Plan versions with draft/published status.
- [ ] Optional effective dates for future plan config changes.
- [ ] Feature matrix editor for module entitlements.
- [ ] Add-on catalog for public site, accounting, rep teams, extra teams, support packages.
- [ ] Grandfathering rules for existing organizations.
- [ ] Coupon, promo, and trial campaign tracking.
- [ ] Approval workflow for live pricing changes.

### Bulk Operations

Add only after permissions and audit logging are solid:

- [ ] Bulk subscription/status override.
- [ ] Bulk comp-period grant.
- [ ] Bulk plan change.
- [ ] Bulk module/add-on enablement.

### Acceptance Criteria

- Growth can track early-access outcomes.
- Product can plan future pricing/entitlement changes before publishing.
- Bulk actions are role-gated, reasoned, previewed, and audit-logged.

## Implementation Order

1. Navigation grouping and rename current Users to Platform Users.
2. Customer Users page with search and reset link action.
3. Org detail support summary, billing snapshot, owner contact, timeline.
4. Retention Queue UI cleanup.
5. Platform admin information architecture and layout pass, starting with org detail.
6. Overview metrics dashboard with subscription health, growth, usage, and alerts.
7. Plans & Pricing subscriber counts and impact previews.
8. Audit coverage expansion for plan/pricing/platform-user actions.
9. Audit log export and full value viewer.
10. Override semantics refactor.
11. Platform admin roles and guarded action permissions.
12. Early Access conversion tracking.
13. Product catalog, effective dates, add-ons, campaigns, and approvals.
14. Bulk operations.

## Key Technical Notes

- Use existing Next.js 16 conventions. Do not add root `middleware.ts`; update `proxy.ts` if request interception changes are needed.
- Keep platform admin APIs under `app/api/platform-admin`.
- Prefer existing `writePlatformAuditLog` helper, extending its usage before introducing new audit abstractions.
- Avoid direct Supabase auth pagination assumptions for long-term user counts and user lookup. A true user directory or paginated search strategy is needed as the user base grows.
- Stripe deep links should not expose secrets; display ids and link to dashboard URLs only for authorized billing/product roles.
- Any "view as org admin" feature must show a visible support banner, require a reason, expire automatically, and write audit logs.

## Verification Plan

Non-browser verification:

- Typecheck.
- Lint.
- API route unit or integration checks where existing patterns allow.
- Manual DB query review for aggregate counts.
- Audit-log writes verified for changed actions.

Browser verification, performed by the user per project rules:

- Platform admin nav grouping and active states.
- Customer Users search and reset link flow.
- Org detail support summary and timeline.
- Org detail layout scanability, grouped workflows, and reduced long-scroll confusion.
- Retention Queue inline extension flow.
- Overview dashboard counts and alerts.
- Plans & Pricing impact previews.
- Audit export and full value viewer.

## Open Questions

- Should support access/view-as be implemented, or should deep links into org admin remain the only support path for now?
- Should effective subscription status be computed at request time or cached on `organizations`?
- Should metrics snapshots be daily only, or should key billing/product events also be written immediately to a `platform_events` table?
- Which platform roles should exist at launch, and who should be allowed to manage those roles?
- Should org rename/re-slug be available to Support, Billing, or Super Admin only?
