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

Phase 3 update: Plans & Pricing now gives internal billing/product users subscriber impact before changing availability, limits, trial lengths, or Stripe price IDs. Those changes can carry a short internal note and now write audit records, so future investigations can see not only what changed but why staff made the change.

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

Status: Complete. The Phase 1.5 scope that shipped was the information-architecture audit plus the org detail and Organizations directory cleanup. Broader safety/governance and shared-component work has been moved into later phases below so this phase does not carry hidden unfinished checklist items.

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

Status: Complete.

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

- [x] Add a compact account header with plan, subscription status, owner, member count, tournament count, and direct admin link.
- [x] Add a "Needs attention" strip for inconsistent billing state, expired overrides, missing owner, past-due/canceled status, retained records, or over-limit usage.
- [x] Group org detail into clear workflow zones: Account, Support, Billing, Entitlements, People, Activity.
- [x] Convert lower-priority sections into tabs, accordions, or a two-column master/detail layout so users do not have to scroll through every panel.
- [x] Put common support actions near the top: email owner, reset user path, edit notes, change plan, add override.
- [x] Identify dangerous or uncommon actions that need explicit advanced grouping, reason capture, and confirmation language in Phase 4 governance.
- [x] Make duplicate facts appear once, then link to the detailed section instead of repeating the same status across Support Summary, Billing Snapshot, and Plan & Entitlements.

### Platform Admin Wide Layout Audit

- [x] Review Overview, Organizations, Customer Users, Retention Queue, Plans & Pricing, Early Access, Platform Users, and Audit Log for the same long-stack problem.
- [x] Define the page-level layout pattern for summary strips, action bars, section groups, tabs, and empty states; reusable component extraction is deferred until the final Phase 6 readability QA confirms the pattern is stable.
- [x] Audit section titles for operator intent and capture remaining wording cleanup for Phase 6.
- [x] Audit each page for a clear first action and investigation path, then clean up the highest-impact Organizations directory flow.
- [x] Preserve dense operational table views while identifying remaining mixed edit/log/summary surfaces for Phase 3, Phase 4, and Phase 6 cleanup.

### Phase 1.5 Wide Audit Findings - May 20, 2026

- **Overview**: simple stat wall with two health links; should become the Phase 2 command center with subscription health, growth, usage, and action alerts instead of adding more ad hoc cards now.
- **Organizations**: mixed account search, billing/access triage, inline plan edits, detail links, and support shortcuts in one table. This is the highest-impact Phase 1.5 cleanup because support starts here and risk states need to be visible before row-level edits.
- **Customer Users**: strong first action because search is the page workflow. Later polish should add a small snapshot/result context once the user directory grows beyond the current first-1000 auth lookup.
- **Retention Queue**: improved by Phase 1 inline forms and result callouts. It still borrows audit-log styling; later cleanup should give retention its own page shell with clearer expiry, notice, and extension grouping.
- **Plans & Pricing**: already uses workflow tabs. Phase 3 should add subscriber impact and change notes inside those tabs rather than stacking new panels below them.
- **Early Access**: already has a growth pipeline layout with summary metrics, filters, list, and sticky detail. Phase 5 conversion tracking has a clear home in the detail panel and summary row.
- **Platform Users**: functional but security-sensitive actions still sit in the same table row as routine status. Phase 4 should move removal/deactivation behind guarded action language and role permissions.
- **Audit Log**: dense table is appropriate, but Phase 3 should add action labels, CSV export, filter-to-org, and full JSON value viewing without lengthening the main row.

### Organizations Directory Cleanup

- [x] Add an account snapshot above the directory: total accounts, past-due count, active/trial count, and internal-note count.
- [x] Add a needs-attention strip that jumps directly to past-due or canceled accounts.
- [x] Separate the primary account-finding workflow from the grouped account directory table.
- [x] Add a direct Customer Users shortcut from the account-finding panel.
- [x] Remove inline plan and limit edits from the Organizations directory; billing/product changes belong in org detail workflows with safety context.

### Deferred From Phase 1.5 Into Later Phases

- Phase 3: safer grouped billing workflows for organization plan and limit edits, with impact preview and audit context.
- Phase 4: guarded action language, role checks, reason capture, and confirmations for dangerous or uncommon platform-admin actions.
- Phase 6: reusable component extraction and final wording/layout standardization once the major functional phases are complete.

### Acceptance Criteria

- Org detail can be scanned above the fold for account status, owner, plan, and urgent issues.
- Support, billing, entitlement, people, and activity concerns are visually separated.
- Repeated billing/status fields are reduced or intentionally cross-linked.
- Platform admin pages share a recognizable layout system.
- Future Phase 2-5 functionality has a place to live without making pages feel longer and less coherent.

## Phase 2 - Metrics Command Center

Status: Complete. Durable event-backed lifecycle metrics, dashboard browser verification, daily snapshot infrastructure, and "since last admin visit" metrics implemented; migration 054 applied in dev and production.

Goal: turn Overview into an operating dashboard.

Review note - May 20, 2026: the current `/platform-admin` Overview implementation was checked against the Phase 2 checklist. Live-query additions, durable billing lifecycle events, snapshot infrastructure, and last-visit alert state are now implemented.

### Subscription Health Metrics

- [x] Organizations by plan.
- [x] Organizations by subscription status.
- [x] Active/trialing/past due/canceled per plan.
- [x] Estimated MRR/ARR from plan prices and active paid orgs.
- [x] Trials ending soon.
- [x] Cancellations in last 7/30/90 days.
- [x] Downgrades in last 7/30/90 days.
- [x] Past-due recovery count/rate where data supports it.

### Growth Metrics

- [x] New organizations in 7/30/90 days.
- [x] New organizations by plan.
- [x] Early-access leads by status.
- [x] Qualified, contacted, pilot, converted counts.
- [x] Conversion rate from early access to org/customer.
- [x] Source path / marketing source summary.

### Product Usage Metrics

- [x] Active and non-archived tournaments.
- [x] Tournaments created in last 30 days.
- [x] Tournament teams and active league registrations.
- [x] House-league seasons and active registrations.
- [x] Rep teams and active program years.
- [x] Public-site enabled orgs.
- [x] Accounting enabled orgs and ledger activity counts.

### Alerts

- [x] Current past-due orgs.
- [x] New early-access leads waiting for review.
- [x] Retention records approaching purge.
- [x] Expired overrides still active.
- [x] Trials ending soon.
- [x] Orgs with no active owner.
- [x] New past-due orgs since last admin visit.
- [x] Orgs with no owner sign-in recently.

### Data Strategy

Initial implementation may use live aggregate queries for speed. Longer term, add:

- `platform_events` for durable lifecycle events.
- Daily metric snapshots for trend lines.
- Plan transition events for churn/downgrade/upgrade history.
- Marketing/source attribution fields where available.

### Initial Dashboard Slice - May 20, 2026

- [x] Replaced the simple Overview counter page with a command-center dashboard.
- [x] Added live totals for organizations, auth users, tournaments, teams, and estimated MRR/ARR.
- [x] Added action queue for past-due orgs, trials ending soon, new early-access leads, retention records, expired overrides, and orgs without active owners.
- [x] Added plan mix, subscription status, and status-by-plan breakdowns.
- [x] Added growth panels for new orgs and early-access pipeline status.
- [x] Added product usage panels for tournaments, teams, house league, rep teams, accounting activity, and enabled module counts.
- [x] Added live-query additions for new organizations by plan, early-access conversion rate, top source paths, owner inactivity, and tournaments created in the last 30 days.
- [x] Apply migration 052 in dev and production so tournament-created metrics have reliable `tournaments.created_at` data.
- [x] Added `platform_events` foundation for durable cancellation, downgrade, past-due, and recovery metrics.
- [x] Backfilled cancellation/downgrade events from applied billing retention intents.
- [x] Overview now shows event-backed cancellation, downgrade, recovery, and 30-day recovery-rate metrics.
- [x] Apply migration 053 in dev and production so lifecycle events are stored and historical applied billing intents are backfilled.
- [x] Grouped lower Overview metric panels into Subscription, Growth, Usage, and Metric Notes tabs so the dashboard is easier to navigate without a long scroll.
- [x] Browser-verify the expanded Overview dashboard metrics and layout.
- [x] Added daily metric snapshot storage plus an authenticated snapshot endpoint/button for manual or scheduled snapshot creation.
- [x] Added platform-admin visit tracking and a new Action Queue alert for past-due events since the previous platform-admin visit.
- [x] Apply migration 054 in dev and production so snapshots, visits, and structured org notes are stored.
- [x] Browser-verify snapshot/visit flows and newest Overview action links.

### Acceptance Criteria

- Overview answers current plan mix, account health, growth, churn, and action items.
- Metrics are filterable by date window where relevant.
- Counts do not rely only on current row state when historical accuracy matters.

## Phase 3 - Billing & Product Safety

Status: Complete. Plans & Pricing safety, structured org notes, Stripe price validation, safer org plan/limit workflow, non-mutating override semantics, expanded audit logging, and audit investigation tools are implemented and browser-verified; migration 054 is applied in dev and production.

Goal: make pricing, plan, and subscription changes safer before expanding functionality.

### Plans & Pricing

- [x] Add subscriber count per plan to the Availability tab.
- [x] Add active/trialing/past-due/canceled breakdown per plan.
- [x] Add impact preview before changing trial days, limits, or availability.
- [x] Add optional change note on config updates.
- [x] Surface last changed by, last changed at, and note in the UI.
- [x] Validate Stripe price IDs against Stripe when possible.
- [x] Show live/sandbox environment clearly.

### Initial Plans & Pricing Safety Slice - May 20, 2026

- [x] Added subscriber impact summary to Plans & Pricing so platform admins can see total accounts, paid-plan accounts, and risk-state accounts before editing product/billing configuration.
- [x] Added per-plan active/trialing/past-due/canceled breakdowns across Availability and Limits & Trials.
- [x] Added customer impact context to Stripe price rows for paid plans, while labeling rep-team rows as per-team add-ons.
- [x] Added last-change notes for plan availability, plan config overrides, and Stripe price ID slots.
- [x] Added API support for optional change notes on plan availability, limits/trials, and Stripe price ID changes.
- [x] Added platform audit entries for plan availability, plan config override, and Stripe price ID updates with old/new payloads and change notes.
- [x] Added schema support for latest change note visibility on the plan/pricing configuration tables.
- [x] Apply the new migration in dev and production.
- [x] Browser-verify Plans & Pricing layout, change-note flows, and action links.
- [x] Add Stripe API validation for price IDs where environment credentials allow it.

### Audit Logging

Add platform audit logging for:

- [x] Plan gating changes.
- [x] Plan config overrides.
- [x] Stripe price ID changes.
- [x] Platform user invite/deactivate/remove.
- [x] Org rename/slug changes.
- [x] Customer password reset link generation.
- [ ] Support access/view-as sessions if implemented.

### Structured Org Notes

The current org support notes are stored as one mutable `organizations.internal_notes` text field. Replace this with a timestamped note history so support context is durable and reviewable.

- [x] Add `org_internal_notes` table with org id, note body, created by/at, updated by/at, and soft-delete fields.
- [x] Backfill existing `organizations.internal_notes` into one initial note per org where present.
- [x] Update org detail Support tab to add, edit, and delete/archive individual notes.
- [x] Use app-native confirmation UI for deleting notes instead of browser dialogs.
- [x] Show author and timestamps for each note, with most recent notes first.
- [x] Keep note presence visible in the Organizations directory where useful.
- [x] Audit-log create, update, and delete/archive note actions.
- [x] Keep `organizations.internal_notes` as a deprecated legacy field for now; new writes go to `org_internal_notes`.
- [x] Apply migration 054 in dev and production.
- [x] Browser-verify structured note add, edit, and delete/archive flows.

### Override Semantics

Current behavior appears to write subscription-status overrides directly to `organizations.subscription_status`. This should be made safer.

Recommended model:

- [x] Keep Stripe/billing-derived status as the billing truth for new override writes.
- [x] Store temporary access changes in an override table.
- Compute effective access status from billing truth plus active overrides.
- When an override expires or is revoked, effective access falls back to billing truth.

Potential schema direction:

- `organizations.billing_subscription_status`
- `organizations.subscription_status` as effective/cache field, or compute through helper
- `org_overrides` remains the source of temporary access decisions

### Audit Log UX

- [x] Add CSV export for current filters.
- [x] Add full value viewer for large JSON values.
- [x] Add "filter to this org" action.
- [x] Add action label/description map for human-readable audit entries.
- [x] Browser-verify newest org billing workflow and Audit Log investigation tools.

### Acceptance Criteria

- High-risk billing/product changes are traceable with actor, time, old value, new value, and reason/note.
- Pricing admins can see subscriber impact before changing availability or limits.
- Revoking or expiring an access override does not leave stale billing state behind.
- Audit log is useful for investigation, not only recordkeeping.

## Phase 4 - Permissions And Governance

Status: Complete. Initial role and permission slice implemented and browser-verified; migration 055 applied in dev and production.

Goal: prevent the platform admin from becoming an all-or-nothing superuser surface.

### Platform Admin Roles

Add role-based permissions for platform admins:

- **Support**: customer lookup, org detail, notes, reset links, support timeline.
- **Billing**: billing snapshot, retention, subscription/override actions, Stripe links.
- **Product**: plans, pricing, feature gates, add-ons.
- **Growth**: early-access pipeline, conversion reporting, marketing/source metrics.
- **Security**: audit log, platform users, auth-sensitive operations.
- **Super Admin**: all platform admin actions.

Implementation slice - May 20, 2026:

- [x] Add `super_admin`, `support`, `billing`, `product`, and `read_only` platform role model in application code.
- [x] Add migration 055 to normalize legacy `admin` roles to `super_admin`, default new database rows to `support`, and constrain valid role values.
- [x] Gate platform user invite/update/remove behind `manage_platform_users`.
- [x] Gate org plan/limit changes, billing retention processing, retention extension, and access override create/revoke behind `manage_billing`.
- [x] Gate plan config, plan availability, Stripe price edits, and org add-ons behind product/billing permissions as appropriate.
- [x] Gate org identity edits, internal note mutations, and customer reset-link generation behind `manage_support`.
- [x] Hide or disable org-detail and platform-user controls when the current platform role lacks the needed permission.
- [x] Apply migration 055 in dev and production.
- [x] Browser-verify role-scoped platform admin controls.

### Guarded Actions

Require role, confirmation, and reason/note for:

- Plan changes.
- Subscription/access overrides.
- Bulk org operations.
- Org slug changes.
- Live Stripe price edits.
- Support access/view-as sessions.
- Platform user removal.

Implementation slice - May 20, 2026:

- [x] Org plan/limit changes now require a reason and app-native confirmation.
- [x] Org slug/name changes already require a reason and are permission-gated.
- [x] Platform user removal uses an app-native confirmation modal and is permission-gated.
- [x] Stripe price edits validate against Stripe when the configured secret key matches the price environment.

### Acceptance Criteria

- A platform user can be limited to support-only or growth-only work.
- Billing/product/security actions are not available to every platform user by default.
- Sensitive actions are reasoned and audit-logged.

## Phase 5 - Growth And Product Catalog

Status: Complete for launch scope. Early Access conversion tracking, Product Catalog foundation/governance, approval enforcement, Feature Matrix draft/publish, and Bulk Operations are implemented and browser-verified; migrations 057, 058, 059, 060, 062, 063, and 064 are applied in dev and production. Grandfathering remains intentionally deferred until active/paying users exist.

Goal: support product planning, launch management, add-ons, and conversion analysis.

### Early Access

- [x] Add `converted_at`.
- [x] Add "Mark as converted" action.
- [x] Link converted lead to organization id.
- [x] Show conversion metrics by plan interest and feature interest.
- [x] Add follow-up due date / next action if useful.
- [x] Add growth role support for early-access pipeline ownership.
- [x] Add conversion/follow-up fields to Early Access CSV export.
- [x] Apply migration 057 in dev and production.
- [x] Browser-verify conversion link, mark converted, follow-up due date, next action, and CSV export flows.

### Product Catalog

- [x] Plan versions with draft/published/scheduled/archived status.
- [x] Optional effective dates for future plan config changes.
- [x] Read-only feature matrix view for module entitlements.
- [x] Read-only add-on catalog for public site, accounting, rep teams, extra teams, and support packages.
- [x] Add Product Catalog tab to Plans & Pricing for plan versions, add-ons, and entitlement review.
- [x] Apply migration 058 in dev and production.
- [x] Browser-verify Plans & Pricing Product Catalog tab.
- [x] Catalog change-request tracking for pricing, plan-version, entitlement, add-on, grandfathering, campaign, and trial proposals.
- [x] Approval/status workflow records for draft, review, approved, rejected, implemented, and canceled catalog changes.
- [x] Coupon, promo, trial, launch, and retention campaign tracking records.
- [x] Apply migration 059 in dev and production.
- [x] Browser-verify Product Catalog planned changes and campaign tracking.
- [x] Enforce approved catalog change request selection before live plan availability, limits/trials, or Stripe price ID changes.
- [x] Log approved catalog change applications for live pricing/config changes.
- [x] Apply migration 060 in dev and production.
- [x] Browser-verify approved-request enforcement on live pricing/config changes.
- [x] Draft feature matrix editor for module entitlement proposals.
- [x] Browser-verify Feature Matrix draft editor.
- [x] Live product-catalog entitlement matrix publishing implementation from approved feature-matrix proposals.
- [x] Apply migration 062 in dev and production.
- [x] Browser-verify approved Feature Matrix publishing.
- [ ] Grandfathering rules for existing organizations. Deferred until active/paying users exist.

### Bulk Operations

Add only after permissions and audit logging are solid:

- [x] Bulk operations foundation page with account filtering, selection, preview, required reason, and in-app confirmation.
- [x] Bulk subscription/status override implementation.
- [x] Bulk comp-period grant implementation.
- [x] Bulk plan change implementation.
- [x] Batch records and per-org audit logging for implemented bulk operations.
- [x] Apply migration 063 in dev and production.
- [x] Browser-verify bulk status override, comp-period grant, and plan change workflows.
- [x] Bulk module/add-on enablement implementation.
- [x] Apply migration 064 in dev and production.
- [x] Browser-verify bulk module add-on enable/remove workflows.

### Acceptance Criteria

- Growth can track early-access outcomes.
- Product can plan future pricing/entitlement changes before publishing.
- Bulk actions are role-gated, reasoned, previewed, and audit-logged.

## Phase 6 - Platform Admin Readability QA

Status: Complete. Initial shared shell responsiveness cleanup, header/action-label consistency pass, and Plans & Pricing Product Catalog density cleanup are implemented and browser-verified. Remaining watch items are deferred as future usage-driven cleanup.

Goal: review the whole platform admin after the major functional phases are implemented, so each section remains readable, task-oriented, and user friendly.

### Tasks

- [x] Review every platform admin section end to end: Overview, Organizations, org detail, Customer Users, Retention Queue, Plans & Pricing, Early Access, Platform Users, Audit Log, and any new Phase 2-5 pages.
- [x] Confirm each page has a clear primary job, obvious first action, and grouped secondary information.
- [x] Remove or consolidate duplicated fields that appeared across phases where launch-impacting issues were found.
- [x] Check that support, billing, growth, product, and security workflows are visually distinct.
- [x] Standardize section headers, empty states, warning language, action placement, and table density where launch-impacting issues were found.
- [x] Confirm mobile and desktop layouts avoid awkward horizontal overflow, overlapping controls, or excessively long ungrouped scroll for the shared shell and reviewed sections.
- [x] Produce a short final punch list for any remaining UX cleanup before platform admin is considered complete.

### Initial Cleanup Slice

- [x] Make the shared Platform Admin sidebar sticky and independently scrollable on desktop.
- [x] Stack the shared shell on narrower screens so the sidebar becomes a top navigation band instead of competing with page content.
- [x] Add horizontal scrolling for grouped platform-admin navigation on tablet/mobile widths.
- [x] Reduce Platform Admin main content padding on narrower screens for better scanability.
- [x] Browser-verify the shared Platform Admin shell at desktop and mobile widths.
- [x] Rename generic page headers so Retention Queue, Platform Users, and Audit Log identify their job area instead of repeating the product name.
- [x] Add human-readable Audit Log labels for bulk operation audit actions.
- [x] Split Plans & Pricing Product Catalog into inline Planning, Feature Matrix, and Catalog Records workspaces to reduce long-scroll density.
- [x] Browser-verify Plans & Pricing Product Catalog sub-workspaces.
- [x] Capture remaining section-specific readability issues in a final punch list.

### Final Readability Punch List

- [x] Plans & Pricing remains the densest platform-admin surface. Product Catalog has been split into Planning, Feature Matrix, and Catalog Records workspaces and browser-verified.
- [x] Deferred: Org Detail is structurally improved with tabs, but each tab should get one final scan after real support use to remove duplicate billing/status facts.
- [x] Deferred: Customer Users and Audit Log are intentionally table-heavy. If mobile usage matters for platform staff, consider a card-style mobile row presentation instead of horizontal table scrolling.
- [x] Deferred: Bulk Operations is workflow-clear, but recent operation result details may need a drill-in view once batch history grows beyond the latest eight rows.
- [x] Deferred: Early Access has the right pipeline model; future cleanup should focus on keeping lead detail actions visually separate from read-only context as more growth fields are added.
- [x] Deferred: Retention Queue is functional but policy-heavy. Revisit copy once the hard-purge policy is finalized so the page describes exact operator responsibility.

### Acceptance Criteria

- Platform admin feels like one coherent internal product, not a collection of unrelated admin pages.
- Each section can be scanned quickly by a new internal staff member.
- High-risk actions are easy to find when needed but visually separated from routine support work.
- The final punch list is either completed or intentionally deferred with rationale.

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
15. Final platform admin readability QA across every section.

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
