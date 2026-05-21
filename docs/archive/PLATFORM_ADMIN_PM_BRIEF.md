# Platform Admin PM Brief

## Current Phase

Platform Admin Phases 1 through 6 are complete for launch scope.

## What Changed In The Early Access Slice

Platform staff can now treat Early Access as a conversion pipeline, not only a lead list. A lead can be linked to the organization it became, marked converted with a durable timestamp, assigned a follow-up due date, and given a short next-action note.

## What Changed In The Product Catalog Slice

Plans & Pricing now has a Product Catalog review tab. Product and billing staff can see catalog versions, planned/live add-ons, and the current module feature matrix in one place before making pricing or entitlement decisions.

## What Changed In The Governance Slice

Product-capable platform admins can now create planned catalog change requests and campaign records. These records capture status, priority, target plan, effective date, impact summary, and campaign offer details without changing live pricing or entitlements.

## What Changed In The Approval Enforcement Slice

Live plan availability, limits/trials, and Stripe price ID changes now require an approved Product Catalog change request. Platform admins select the approved request in Plans & Pricing before applying a live change, and the system records which approved request authorized the change.

## What Changed In The Feature Matrix Draft Slice

Product-capable platform admins can now draft module entitlement changes from the Product Catalog feature matrix. Proposed toggles are saved as Product Catalog change requests, so live entitlements remain unchanged while the team reviews packaging changes.

## What Changed In The Feature Matrix Publishing Slice

Approved Feature Matrix requests can now be selected, previewed, and published into the live product-catalog matrix. Publishing requires a note, marks the request implemented, and records both audit history and the approved request that authorized the change.

## What Changed In The Bulk Operations Slice

Billing-capable platform admins now have a Bulk Operations workspace for selecting accounts, previewing a guarded action, entering a required reason, and confirming the operation. The first supported actions are subscription status overrides, comp-period grants, and base plan changes. Each run creates a batch record and per-organization audit entries.

## What Changed In The Bulk Module/Add-On Slice

Product-capable platform admins can now use the same Bulk Operations workspace to enable or remove organization-specific module add-ons across selected accounts. The workflow shows each selected account's current module state, requires a reason, confirms inline, and records the batch plus per-organization audit entries when an add-on actually changes.

## What Changed In The Phase 6 Shell Cleanup

The shared Platform Admin shell is more usable across screen sizes. On desktop, the sidebar stays available while page content scrolls. On narrower screens, the sidebar becomes a compact top navigation area with horizontal navigation groups, and page content gets tighter padding so tables and workflow panels have more room.

## What Changed In The Phase 6 Label Cleanup

Several Platform Admin sections now name their operating area more clearly: Retention Queue is labeled as customer risk work, Platform Users as system access, and Audit Log as system review. Audit Log also gives readable labels to bulk-operation audit entries so platform staff do not have to parse raw action keys first.

## What Changed In The Plans & Pricing Readability Slice

The Product Catalog tab in Plans & Pricing is now split into three inline workspaces: Planning, Feature Matrix, and Catalog Records. This keeps proposed changes and campaigns separate from entitlement matrix work and baseline catalog records, so product staff can choose the job they are doing instead of scrolling through every catalog surface at once.

## Completion Note

The remaining Phase 6 punch-list items are intentionally deferred to future usage-driven cleanup. They are not launch blockers: Org Detail can be re-scanned after real support use, table-heavy mobile alternatives can wait until mobile platform-admin usage matters, Bulk Operations drill-in can wait until batch history grows, Early Access can be revisited as more growth fields are added, and Retention Queue copy should wait for the final hard-purge policy.

## Why It Matters

This lets FieldLogicHQ answer practical launch questions:

- Which early-access leads became real accounts?
- Which plan interests and feature interests are converting?
- Which leads need a follow-up next?
- Which organization did this lead turn into?
- What is the current product catalog baseline?
- Which modules are included in each plan today?
- Which add-ons are already live versus still planned?
- Which pricing, entitlement, grandfathering, or campaign changes are proposed?
- Which proposed changes are drafts, in review, approved, rejected, or implemented?
- Which approved product decision authorized a live pricing/config change?
- Which module entitlement changes are being proposed before anything live changes?
- Which approved feature-matrix proposal changed the live catalog matrix?
- Which bulk account changes were run, by whom, and which organizations succeeded or failed?
- Which module add-ons were enabled or removed in bulk, and which accounts were already in the requested state?
- Can platform staff review and act from the admin console without the navigation or page chrome crowding the work area?

## User Impact

Internal growth/product users get clearer pipeline state and fewer note-only workflows. Support and read-only users can still see the pipeline according to platform-admin access, but conversion mutations are reserved for roles with growth/product permissions.

The catalog slice is intentionally read-only for now. It improves launch review and packaging clarity without introducing risky live publishing controls before approval workflow, grandfathering, and campaign tracking are designed.

The governance slice is still non-destructive. It creates the review trail that future live-publishing controls can enforce.

The approval enforcement slice turns that review trail into a guardrail. Product and billing staff can still work quickly, but risky changes now need an approved request selected first.

The feature matrix draft slice keeps entitlement planning inside the same governed workflow. It is intentionally proposal-only until approved feature-matrix publishing is implemented.

The feature matrix publishing slice closes that loop for product-catalog planning. It does not use browser prompts; product admins review an inline preview, add a note, and confirm the publish action from the Platform Admin UI.

The bulk operations slice is intentionally guarded. It is designed for repeatable platform maintenance work without turning the Organizations directory into an editing surface.

The bulk module/add-on slice keeps product packaging changes in a controlled workspace. Billing users keep billing actions, product users get module add-on actions, and read-only users can review history without applying changes.

The Phase 6 shell cleanup benefits every platform-admin role. It does not change permissions or workflows; it makes the same support, billing, growth, product, and system pages easier to scan on desktop and smaller screens.

The Phase 6 label cleanup is small but useful for orientation. It helps a new internal staff member understand whether they are doing customer support, customer-risk, system-access, or system-review work.

The Plans & Pricing readability slice reduces catalog overload without changing permissions or behavior. Product-capable admins still manage the same records and publishing flow, but the page presents one work area at a time.

## Success Criteria

- Converted leads are linked to organizations and timestamped.
- The Early Access page shows conversion rates by plan and feature interest.
- Follow-up dates and next actions are visible in the lead detail workflow.
- CSV export includes conversion and follow-up fields.
- All conversion changes are audit logged.
- Product Catalog tab shows version records, add-on records, and the plan/module feature matrix.
- Migration 058 is applied in dev and production.
- Browser verification confirms the Product Catalog tab is readable and non-mutating.
- Catalog change requests and campaigns can be created by product-capable admins.
- Change-request and campaign status changes are audit logged.
- Migration 059 is applied in dev and production.
- Browser verification confirms planned changes and campaigns are readable and role-gated.
- Live pricing/config changes are blocked until an approved catalog change request is selected.
- Approved-request applications are logged for audit review.
- Migration 060 is applied in dev and production.
- Browser verification confirms approval enforcement on plan availability, limits/trials, and Stripe price ID changes.
- Product-capable admins can draft feature matrix changes as Product Catalog change requests.
- Browser verification confirms the draft editor saves proposals without changing live entitlements.
- Migration 062 is applied in dev and production.
- Product-capable admins can publish approved Feature Matrix requests into the live catalog matrix.
- Browser verification confirms the publish preview, required note, implemented status, and refreshed live matrix.
- Migration 063 is applied in dev and production.
- Billing-capable admins can run bulk status overrides, comp-period grants, and plan changes with required reasons.
- Browser verification confirms selection, preview, confirmation, batch logging, and per-org audit entries.
- Migration 064 is applied in dev and production.
- Product-capable admins can bulk enable or remove organization-specific module add-ons with required reasons.
- Browser verification confirms module add-on preview, confirmation, batch logging, and per-org audit entries.
- Platform Admin navigation remains usable at desktop, tablet, and mobile widths.
- Each major Platform Admin section gets a final readability review and any remaining issues are either fixed or captured in the Phase 6 punch list.
- Bulk-operation audit entries have human-readable labels in Audit Log.
- Plans & Pricing Product Catalog work is grouped into Planning, Feature Matrix, and Catalog Records, with browser review confirming the sub-workspaces are easier to scan.
