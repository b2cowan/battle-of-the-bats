# Platform-Admin Operator Polish (F5) — Backlog Plan

> **Status:** Scoped 2026-06-13. **Priority: P3 — opportunistic polish backlog.** **Batch 1 (Groups B + C + D) BUILT + COMMITTED 2026-06-14 (1ea63ec, not pushed).** **Batch 2 (Group E, all 7 billing items PAB-005/006/009/010/012/013/014) BUILT + COMMITTED 2026-06-14 (546f683, not pushed).** Both pending owner browser smoke-test. **Note:** PAG-004 (Group F, Action-Queue non-billing note) was already shipped as part of F4 (43f8cde) — drop it from F5 scope. **Group A ✅ verified already-done (no-op, 2026-06-14).** **Group F (growth) BUILT + COMMITTED 2026-06-14 (e599520, not pushed) — all 7 items (PAG-005/006/007/008/009/010/011); PAG-004 was F4. ⚠ touches shared lib/email-sender.ts → dev-server restart needed. Reviewed via /review.** **Remaining: Groups G, H, I.**
> **Companion:** [PLATFORM_ADMIN_OPERATOR_POLISH_PM_BRIEF.md](PLATFORM_ADMIN_OPERATOR_POLISH_PM_BRIEF.md)
> **Spun out of:** [Platform-Admin Employee Audit — SYNTHESIS.md](../archive/platform-admin-audit/SYNTHESIS.md) Theme F + unclaimed Low/Medium findings from PA1–PA6.

## What this is

A grouped backlog of lower-impact consistency fixes and per-role nits from the platform-admin audit. None of these are blockers or security issues — those are in F1–F3. These items can be picked off opportunistically (one at a time during a related feature session) or batched into a single polish sprint. Tackle them alongside or after the higher-priority F2–F4 work.

**Out of scope:** anything in F1 (API guards), F2 (least-privilege UX consistency pass), F3 (support seam / feedback triage), or F4 (SOPs + day-one orientation). Items that touch those themes are routed there, not here.

---

## Backlog table

Items are grouped by theme. Finding ID · surface · file reference (where available) · one-line fix direction · rough effort.

### Group A — Action Queue dead links (Overview)

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PAR-003 (partial) ✅ | Overview — Action Queue | `app/platform-admin/page.tsx` | **ALREADY DONE (verified 2026-06-14).** The "Expired overrides" tile already links to `?filter=expired_overrides` (page.tsx:212). No work needed. (Non-billing dead-link suppression = F2 ✅; F4 added the "requires billing access" note beneath the tile.) | XS |
| PAB-002 ✅ | Overview → Orgs list | `app/platform-admin/orgs/page.tsx`, `OrgsClient.tsx` | **ALREADY DONE (verified 2026-06-14).** Orgs server page computes `expiredOverrideOrgIds`/`expiredOverride` (page.tsx:72,104); client supports the `expired_overrides` attention filter, reads it from the URL, filters on it, and renders a dismissible "Expired overrides ✕" chip (OrgsClient.tsx:51,58,118,276). Live drill-through already works. No work needed. | S |

> **Group A status:** ✅ **No-op — already fully implemented before this batch (verified 2026-06-14).** Stale findings; the drill-through shipped between the audit and F5. Nothing built.

### Group B — Customer Users menu ordering

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PAS-010 / PAB-011 ✅ | Customer Users — Actions menu | `app/platform-admin/customer-users/CustomerUsersClient.tsx` | **DONE (1ea63ec).** Reordered to triage sequence: Reset Password → Confirm Email → Revoke Sessions → [divider] → Edit Info → Notes → [divider] → Ban/Unban/Delete. Confirmed for both support (PAS-010) and billing (PAB-011). | XS |

### Group C — League Starter / §13 badge on org detail (PF-4)

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PAS-009 / PA0-004 ✅ | Org detail — hero badges area | `app/platform-admin/orgs/[id]/page.tsx`, `OrgDetailClient.tsx`, `orgDetail.module.css` | **DONE (1ea63ec).** Server page now selects `free_floor` (`=== 'league_starter'`) and renders a `.leagueStarterBadge` in the hero; per-org all-time `scope_wall_hit` count (head/count query, only run when free-floor) shown read-only in the Entitlements tab with a HelpTooltip. | S |

### Group D — Org detail tab: URL-addressable

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PAB-008 ✅ | Org detail | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx`, `page.tsx` | **DONE (1ea63ec).** `?tab=<tabId>` URL param; initial tab read from `useSearchParams()`, `selectTab()` does `router.replace(scroll:false)`. Client wrapped in `<Suspense>` in the server page (useSearchParams requirement). | S |
| PAB-007 ✅ | Retention Queue → Org detail | `app/platform-admin/retention/RetentionQueueClient.tsx` | **DONE (1ea63ec).** Retention org link now targets `/platform-admin/orgs/${id}?tab=billing`. | XS |

### Group E — Billing surface polish

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PAB-009 ✅ | Org detail — Billing & Access | `app/platform-admin/orgs/[id]/page.tsx`, `orgDetail.module.css` | **DONE (546f683).** Stripe subscription deep-link on the Account Context Stripe Subscription field (new `stripeSubscriptionUrl` helper; mode from secret-key prefix like `stripeCustomerUrl` — NOT the `sub_test_` ID prefix, which doesn't exist; `(Sandbox)` tag in test mode). New `.inlineLink`/`.sandboxTag`. | XS |
| PAB-006 ✅ | Retention Queue | `app/platform-admin/retention/RetentionQueueClient.tsx` | **DONE (546f683).** Urgency badges in the Days column (`<=0` → PAST DEADLINE `badge-danger`, `<=3` → URGENT `badge-warning`, global badge classes). Empty state → `tip` HelpCallout ("Nothing approaching purge"); table hidden when empty. (HelpCallout has no `success` variant — used `tip`.) | XS |
| PAB-010 ✅ | Bulk Operations — Recent Batches | `app/platform-admin/bulk-operations/BulkOperationsClient.tsx`, `bulk-operations.module.css` | **DONE (546f683).** "View all bulk operations in Audit Log →" footer link (`?action=run_bulk_operation`, the real audit action) + new `.panelFooterLink`. | XS |
| PAB-012 ✅ | Org detail — override list | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx` | **DONE (546f683).** `OVERRIDE_TYPE_LABELS` map (Subscription Status / Comp Period / Module Add-on); applied to both the active + history override lists; fallback `.replace(/_/g,' ')`. | XS |
| PAB-005 ✅ | Bulk Operations — action type dropdown | `app/platform-admin/bulk-operations/BulkOperationsClient.tsx` | **DONE (546f683).** Module Add-On Enablement `<option>` disabled + `(requires product access)` label suffix when `!canManageProduct`. | XS |
| PAB-014 ✅ | Org detail — override form copy | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx` | **DONE (546f683).** Expiry copy now: "An expiry is strongly recommended — without one, access remains permanently until manually revoked." (Auto-revert feature itself still routes to `existing:TIMED_ENTITLEMENTS_PLAN`.) | XS |
| PAB-013 ✅ | Help Hub | `app/platform-admin/help/page.tsx` | **DONE (546f683).** "Billing Specialist" role-path card linking the 4 existing Billing SOPs (overrides/cancel/retention/bulk-ops). **Note:** card lives in `help/page.tsx` `rolePaths`, not `lib/help-content/platform-admin.tsx` as the plan guessed. | XS |

### Group F — Growth surface polish

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PAG-004 ✅ | Overview — Action Queue | `app/platform-admin/page.tsx` | **ALREADY DONE in F4 (43f8cde).** The non-billing Action-Queue note ("Trials ending soon and expired overrides require billing access…") ships for all non-billing-action roles incl. growth. No further work. | XS |
| PAG-005 ✅ | Email — preview modal | `app/platform-admin/email/EmailDashboardClient.tsx` | **DONE (e599520).** `founding_welcome` preview now uses "Hi Demo User," / "Demo Org" (matches the other nine). Still resolves via the `?? FOUNDING_WELCOME_PREVIEW` fallback — left the PREVIEW_MAP omission as-is. | XS |
| PAG-006 ✅ | Email — confirm-send modal + table | `lib/email-sender.ts`, `app/platform-admin/email/page.tsx`, `EmailDashboardClient.tsx` | **DONE (e599520).** Plan was wrong — server did NOT compute per-email counts (only one global). Built it: shared `getMarketingAudienceCounts()` + `MARKETING_EMAIL_AUDIENCE` in lib/email-sender.ts mirroring the send route's 3 segments (founding / not-on-club / coaches; coaches deduped by user_id). Server flattens to a per-key `recipientCounts` map → table column + confirm modal show true audience size. ⚠ shared module → restart. Counts are org-level (like the existing global count) — can be slightly higher than the send if an org is ownerless. **Reviewed via /review.** | S→M |
| PAG-007 ✅ | Early Access — filter bar | `app/platform-admin/early-access/EarlyAccessClient.tsx` | **DONE (e599520).** Date-range preset select (Any / 7 / 30 / 90 / Custom); custom reveals two date inputs; wired to dateFrom/dateTo (API already accepted them). | S |
| PAG-008 ✅ | Early Access — default filter | `EarlyAccessClient.tsx`, `app/api/platform-admin/early-access/route.ts` | **DONE (e599520).** Default status = `new`; API adds `.order('follow_up_due_at', asc, nullsFirst:false)` before created_at desc. | XS |
| PAG-009 ✅ | Early Access — pagination | `EarlyAccessClient.tsx`, `early-access.module.css` | **DONE (e599520).** Previous/Next pagination via `offset` (PAGE_SIZE 100) + "X–Y of total" indicator; export uses filters-without-offset. Summary cluster relabeled **"In view"** (page-scoped) with a tooltip; header still shows true `total`. (Did NOT add per-status API totals — would need 5 extra count queries; scope-creep for a polish item. Honest "In view" framing instead.) | S |
| PAG-010 ✅ | Email — stats row | `EmailDashboardClient.tsx`, `email.module.css` | **DONE (e599520).** `.statsSubtitle` ("Founding season organizations with active marketing email consent…") + per-card `title` tooltips explaining each scope. | XS |
| PAG-011 ✅ | Overview — tab default | `OverviewTabs.tsx`, `app/platform-admin/page.tsx` | **DONE (e599520).** New `defaultTab` prop; server passes `growth` for the growth role, else `subscription`. (Chose role-default over localStorage — deterministic, no hydration-mismatch risk.) | XS |

### Group G — Super-admin / nav IA polish

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PA0-005 | Nav — System group | `app/platform-admin/PlatformAdminNav.tsx:44–53` | Restructure "System" nav group into "Support & Diagnostics" (Feedback, Observability) + "Governance" (Platform Users, Audit Log). "Email Templates" could move to "Billing & Product." This is an IA polish item; the functional guard fix for Feedback/Observability nav group is F4. | M |
| PA0-006 | Nav — Email vs Email Templates naming | `app/platform-admin/PlatformAdminNav.tsx:35–38, 50` | Rename to distinguish: e.g. "Marketing Email" (batch) vs "Transactional Templates" (product copy); or add a subtitle/kicker to each page header explaining audience and scope. | XS |
| PA0-008 | Change Requests — dual appearance | `app/platform-admin/change-requests/page.tsx:9` | Add a HelpCallout on the Change Requests page explaining its relationship to Plans & Pricing. Consider renaming the standalone nav item to "Approval Queue." | XS |
| PA0-011 | Feedback / Observability — header kicker | `app/platform-admin/feedback/page.tsx:139`; observability page header | Update `headerLabel` kicker on both Feedback and Observability pages once the nav group is resolved (PA0-005). Depends on PA0-005. | XS |
| PA0-012 | Org detail — Delete Organization position | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:1028–1056` | Move "Delete Organization" card to a dedicated "Danger" section at the bottom of the Support tab with a visual separator, or to its own "Admin" sub-tab, so it is not the first card seen on load. | XS |
| PA0-013 | Email Templates — header kicker | `app/platform-admin/email-templates/page.tsx:53` | Change `headerLabel` kicker from "Platform Admin" to "System" (or the resolved group label) to match all other System-group pages. | XS |
| PA0-014 | ALL_ROLES pages — defensive guards | `app/platform-admin/orgs/page.tsx`, `orgs/[id]/page.tsx`, `customer-users/page.tsx`, `audit/page.tsx` | Add `requirePlatformAreaView('organizations')`, `customer_users`, `audit` guards to the four ALL_ROLES pages as a defensive pattern, preventing future matrix-tightening from silently missing enforcement. Zero current impact. | XS |
| PA0-009 | Customer Users — employee exclusion note | `app/platform-admin/customer-users/page.tsx` (no inline callout) | Add a brief HelpCallout: "Platform employees are excluded from this list. To manage platform staff, use Platform Users." Prevents "is my account missing?" confusion. | XS |

### Group H — Read-only observer polish

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PAR-007 | Org detail — Billing tab | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:1213–1219` | Collapse the Plan/Limit form to a read-only `<dl>` summary when `!canManageBilling`, rather than rendering disabled fields. Low visual clutter for pure observers. | S |
| PAR-005 | Overview — MetricSnapshotButton | `app/platform-admin/MetricSnapshotButton.tsx:11–18`; `app/api/platform-admin/metrics/snapshot/route.ts:8` | Hide the button (or pass `canSnapshot=false`) for read_only. Tighten the API to `requirePlatformPermission('manage_product')` to close the accidental-write channel. Straddles F2 and F5; assign here since it is low-risk and small. | XS |
| PAR-002 | Org detail — Coaches Portal textarea | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:1028–1056` | Wrap the ownership-transfer textarea so it does not render for roles where `!canManageSupport && !canManageBilling`. Remove the interactive field from the read-only fallback block. | XS |

### Group I — Date-format drift (cross-surface)

| ID | Surface | File / Line | Fix direction | Effort |
|----|---------|-------------|---------------|--------|
| PF-5 (2026-06-04 eval carry) | All platform-admin surfaces | Various — mix of relative ("3 days ago") and absolute ("Jun 4, 2026") dates across the console | Establish a consistent date display rule: absolute dates for anything more than 7 days old; relative for within 7 days. Apply consistently to the Retention Queue, override timestamps, audit log event dates, feedback submission timestamps, and org detail activity fields. Audit surfaces for drift and align. | M |

### Group J — Growth analytics (future consideration, not built here)

> Note: growth currently lacks in-console conversion/churn analytics (§13 funnel drill-through, per-cohort upgrade rates, churn by segment). These signals are locked behind product/billing surfaces that growth cannot access. This is a meaningful capability gap but is scoped as a **future growth-analytics feature**, not a polish fix. Flag for a dedicated Growth Analytics project when the founding-season moment matures. Not built in F5.

---

## Effort legend

| Label | Meaning |
|-------|---------|
| XS | < 1 hour; one file, one component, copy/prop change |
| S | 1–3 hours; multi-file but contained, no new data fetch |
| M | 3–6 hours; structural change (nav IA, date audit sweep) |

---

## Recommended order of attack

If batching: tackle Group B (menu ordering, XS) and Group C (§13 badge, S) first — highest cross-role friction per effort. Group D (URL-addressable tabs, S) unblocks Group E's Retention deep-link. Groups F and G can be done in a single session once F4 SOP work has established the nav group resolution.

If picking off opportunistically: any XS item is safe to grab when touching the relevant file for another reason.
