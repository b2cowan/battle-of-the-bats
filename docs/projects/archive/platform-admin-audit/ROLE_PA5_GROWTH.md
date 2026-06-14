# PA5 — Growth Marketer Operator Report
> Walked: 2026-06-13 | Method: code-walk (Stage B) | Status: draft | Verify: risk-targeted (High/bug findings)

---

## The operator at a glance

A growth marketer in this role arrives knowing two things: they own the early-access pipeline (finding, qualifying, and converting League/Club leads into paying customers) and they send the platform's marketing emails. That is the entire job surface. Every other area of the console — billing, retention, observability, plans, email templates, change requests, platform users — is invisible to them. The nav renders exactly six items: Overview, Organizations, Customer Users (👁), Early Access, Email, Audit, Help. The Growth group is the only place where they have a write affordance.

The first impression is lean and purposeful. The nav doesn't lie — it shows exactly what growth can do. Early Access is a genuinely capable workspace: a lead table with five filter dimensions, a conversion-by-plan and conversion-by-feature breakdown dashboard, an outreach template copy-paste flow, a lead detail panel with full pipeline fields, and CSV/XLSX export. A growth hire landing on Early Access on day one would quickly understand they're looking at a CRM-lite for inbound interest.

Email is a one-mode broadcast dashboard for founding-season outreach. It shows recipient counts, opt-out lists, a scheduled-email registry (10 emails, all built), and a send-history table with per-batch recipient drilldown. The safety gate (explicit confirm-send modal with recipient count visible) is solid. But the scope is almost entirely hardcoded: the audience is always the founding-season cohort, the templates are fixed in code (not editable by growth), and there is no ad-hoc targeting. For a founding-season moment this is workable. As a general growth email tool it is narrow.

The central tension: growth has two write surfaces but zero visibility into the metrics most relevant to their job — conversion rates from free-floor to paid, §13 funnel behavior, downgrade/churn signals, or per-org upgrade intent. All of that lives on the Overview "Subscription" and "Growth" tabs, which they can see — but navigating there reveals an overview built for operational triage, not growth analysis. The "Growth" tab contains the most relevant panel (Early Access by status, new accounts by plan, League Starter funnel), but growth has no way to drill into it, filter it, or act on its signals from the overview. The Action Queue presents "trials ending soon" and "retention records" alerts they cannot act on. The net effect: growth can work their two write surfaces in isolation, but cannot build a picture of what is driving the business.

---

## Role × area access map (as rendered)

| Area | This role | Guard correctly enforced? | Notes |
|------|-----------|--------------------------|-------|
| overview | 👁 (all-roles read) | benign — no `requirePlatformAreaView`, but ALL_ROLES so no restriction bypassed | Full dashboard including Subscription/Growth/Usage/Metric Notes tabs; no write affordances |
| organizations | 👁 (all-roles read) | benign — no page guard | Org list with filters visible; no action buttons for growth |
| customer_users | 👁 VIEW-ONLY | benign — no page guard; API routes gate writes on `manage_support` | Growth can see user list but no action buttons render (only support/billing/super can write) |
| early_access | ✅ WRITE | ✅ `requirePlatformAreaView('early_access')` | Write confirmed: `hasPlatformPermission(auth.role, 'manage_growth')` = true for growth; all pipeline actions active |
| email | ✅ WRITE | ✅ `requirePlatformAreaView('email')` | Send, resubscribe, batch drilldown all available; send guard = `getPlatformAdminContext()` (any session role), see PAG-006 |
| audit | 👁 (all-roles read) | benign — no page guard | Read-only; full audit log visible |
| help | 👁 (all-roles read) | benign — no page guard | All Help Hub content visible, including employee-only platform-admin ops guide |
| retention | — HIDDEN | ✅ filtered from nav | Correctly absent |
| bulk_operations | — HIDDEN | ✅ filtered from nav | Correctly absent |
| plans_pricing | — HIDDEN | ✅ filtered from nav | Correctly absent |
| change_requests | — HIDDEN | ✅ filtered from nav | Correctly absent |
| email_templates | — HIDDEN | nav filtered; **PF-1 applies** (unguarded `[key]` editor) | Direct URL still reachable for session-holding growth user |
| observability | — HIDDEN | ✅ filtered from nav | Correctly absent |
| platform_users | — HIDDEN | ✅ filtered from nav | Correctly absent |
| dev_tools | — HIDDEN | **PF-2 applies** (no role guard on page) | If `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`, reachable by direct URL |

---

## Cluster-by-cluster scorecard

| Cluster | Q1 Purpose | Q2 Sequence | Q3 Visual | Q4 Friction | Q5 Scan | Q6 Effective | Tribal knowledge? | Notes |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|-------|
| Early Access (pipeline) | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓ | partial | Purpose clear; filters good; outreach templates functional; pagination gap + no date filter; no "due today" default sort |
| Email dashboard | ✓ | ✓ | ✓ | ⚠ | ✓ | ⚠ | **YES** | Permission gap on send route; preview is static HTML + "founding_welcome" shows placeholder tokens; audience hardcoded; no ad-hoc send |
| Overview dashboard | ⚠ | ✗ | ✓ | ✗ | ⚠ | ✗ | **YES** | Growth tab visible but role-unaware; Action Queue shows billing/retention alerts growth cannot act on; §13 panel is read-only; no "what do I do from here" orientation |
| Customer Users (view) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | no | Correctly view-only; no action menu renders for growth; clean and legible |
| Organizations (view) | ✓ | ✓ | ✓ | ⚠ | ✓ | ⚠ | partial | Org list visible; filters available; no link to Early Access pipeline from matched orgs; no conversion signal on org row |
| Audit log | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | no | Self-explanatory; growth can verify their own pipeline actions |
| Help Hub | ⚠ | ✗ | ✓ | ✗ | ✓ | ✗ | **YES** | No growth role-path, no Early Access SOP, no email-send SOP; all SOPs in the guide are support/billing/product workflows; growth arrives with no guided starting point |

---

## Findings

| ID | Cluster | Severity | Type | Q | Tags | Evidence | Finding | Suggested direction | Route |
|----|---------|----------|------|---|------|----------|---------|---------------------|-------|
| **PAG-001** | Help Hub | **High** | missing-sop | Q1, Q6 | day-one | `lib/help-content/platform-admin.tsx` — no section mentioning Early Access, email send, growth pipeline, or a growth role-path | **No SOP or role-path for growth.** The Platform Admin Operations guide has 14 well-formed SOP sections covering support, billing, and product workflows. It has zero content for growth: no "how to manage the early-access pipeline," no "how to update a lead status and mark contacted," no "how to trigger a marketing email send," and no role-path card describing what growth is responsible for. A new growth hire opening Help sees a guide organized entirely around customer support and billing actions. They would not know what their own console surfaces are for without out-of-band onboarding. | Add a "Growth role-path" quickstart card and two SOP sections: (1) "How to manage the early-access pipeline" (filters, status workflow, outreach templates, export, mark-converted flow), (2) "How to send a founding-season marketing email" (schedule review, preview, confirm-send modal, opt-out list). Link both from the Help Hub quick links. | backlog |
| **PAG-002** | Email | **High** | role-gating | Q4, Q6 | least-privilege | `app/api/admin/email/send/route.ts:217-219`; `app/api/admin/email/resubscribe/route.ts:15-17`; `app/api/admin/email/route.ts:57-59`; `app/api/admin/email/sends/route.ts:13-15` | **Email send, resubscribe, and batch-data API routes check only `getPlatformAdminContext()` — any active platform session can call them.** The page guard (`requirePlatformAreaView('email')`) correctly limits who can navigate to the Email page. But the three destructive/sensitive API routes — `POST /api/admin/email/send` (sends real emails to all founding-season recipients), `POST /api/admin/email/resubscribe` (clears an org's opt-out), and `GET /api/admin/email/sends` (exposes recipient email addresses per batch) — use only `getPlatformAdminContext()`, which passes for any authenticated platform-admin role including `read_only` and `support`. A support rep or read-only observer who knows the route can trigger a mass email blast by calling the API directly without navigating through the page. Only the `manage_growth` permission should gate the send and resubscribe routes; the sends data route is less critical but should at minimum gate on `email` area view. | Add `requirePlatformPermission('manage_growth')` (or `requireAnyPlatformPermission(['manage_growth', 'manage_product'])`) to the `POST /api/admin/email/send` and `POST /api/admin/email/resubscribe` handlers. Apply `requirePlatformAreaView('email')` or equivalent area check to `GET /api/admin/email` and `GET /api/admin/email/sends`. | backlog |
| **PAG-003** | Early Access | **High** | role-gating | Q4, Q6 | least-privilege | `app/api/platform-admin/early-access/route.ts:12`; `app/api/platform-admin/early-access/export/route.ts:36` | **Early-access list and export routes use `requirePlatformAdmin()` (any active session) rather than a permission or area guard.** The PATCH route (`/api/platform-admin/early-access/[leadId]`) correctly gates on `requireAnyPlatformPermission(['manage_growth', 'manage_product'])`. But the GET (list) route and the export route both use the session-only `requirePlatformAdmin()` check. Any authenticated platform-admin role — including `support`, `billing`, and `read_only` — can directly call `/api/platform-admin/early-access?limit=500` or the export endpoint and download all lead data (names, emails, organization names, internal notes, outreach history). The page guard on `early-access/page.tsx` filters nav visibility, but the raw API is open to all roles. | Change `requirePlatformAdmin()` to `requireAnyPlatformPermission(['manage_growth', 'manage_product'])` on both the GET list route and the GET export route, matching the PATCH route's access posture. | backlog |
| **PAG-004** | Overview | **Medium** | ia-sequence | Q2, Q4 | day-one | `app/platform-admin/page.tsx:143-158` (Action Queue) | **The Action Queue on the overview dashboard shows actionable alerts that growth cannot act on.** "Trials ending soon" links to `/platform-admin/orgs?filter=trial_ending`; "Price approvals" links to `/platform-admin/change-requests`; "Retention records" links to `/platform-admin/retention`. None of these routes are accessible to growth. Clicking the alert items from the Overview takes growth to pages that either redirect them back to Overview (change-requests, retention) or open a page with no action affordances. A new hire sees these as tasks they should be doing — they are not. No contextual note explains which alerts require a different role. | Either (a) filter the Action Queue alert items client-side by the session role (hide items whose target route is inaccessible) or (b) add a role-awareness note, e.g. "Requires billing access — contact the billing team." Match the pattern used by the nav (drop or label items the role cannot act on). | backlog |
| **PAG-005** | Email | **Medium** | missing-feature | Q1, Q5 | day-one | `app/platform-admin/email/EmailDashboardClient.tsx:21-102` (SCHEDULED_EMAILS); `app/platform-admin/email/EmailDashboardClient.tsx:208-251` (PreviewModal) | **The Email preview is static hardcoded HTML, not a live render; the founding_welcome preview shows unreplaced placeholder tokens (`[First Name]`, `[Org Name]`).** The preview modal comment at line 218-221 acknowledges this: "In this phase we just show the template structure since we'd need a server roundtrip to render the full HTML." For `founding_welcome`, the static preview (line 805) displays `[First Name]` and `[Org Name]` as literal text, not sample values. A growth hire reviewing an email before sending it cannot see what a real recipient would receive. Beyond `founding_welcome`, the other nine templates have working static previews with demo data. Inconsistency. | For `founding_welcome`, replace the placeholder tokens in the static preview with representative sample text (e.g., "Hi Sarah," / "Demo Org") to match the other previews. Longer term, add a preview-render API endpoint that accepts a `emailKey` + sample org data and returns live HTML as the modal comment describes as future work. | backlog |
| **PAG-006** | Email | **Medium** | missing-feature | Q1, Q5 | day-one | `app/platform-admin/email/EmailDashboardClient.tsx:454-465` (Audience column for non-transactional) | **Email send table shows a single shared recipient count for all non-transactional emails regardless of actual audience.** The server page loads `recipientCount` = founding-season orgs not opted out. All nine non-transactional scheduled emails display this same count in the Recipients column. But the audience definition is NOT the same: `spotlight_coaches_coach` sends to coach accounts (different count); `spotlight_club_last` excludes orgs already on Club (smaller count). The client uses `recipientCount` for both the table display and the confirm-send modal copy. Growth clicking "Send now" on `spotlight_club_last` sees a recipient count in the confirm modal that includes orgs who are already on Club and will actually be suppressed — misleading pre-send verification. | Fix the server page and client to pass per-email-key recipient counts (the refresh route at `/api/admin/email` already returns a `recipientCounts` object with per-key values, but `EmailDashboardPage` uses only its own single `recipientCount`). Wire the per-key count from `recipientCounts` through to the confirm-send modal and table display. | backlog |
| **PAG-007** | Early Access | **Medium** | missing-feature | Q4 | — | `app/platform-admin/early-access/EarlyAccessClient.tsx:362-408` (filterBar); no date-range filter in the filter bar | **Early Access has no date-range filter in the UI despite the API supporting it.** The API (`/api/platform-admin/early-access`) accepts `dateFrom` and `dateTo` params and the server-side filter parser handles them (`lib/early-access-admin.ts:83`). The filter bar in the client renders five controls (search, plan, feature, status, consent) but no date filter. A growth marketer trying to review leads that came in "this quarter" or "since the last outreach" has no way to filter by date except through the exported file. The summary metrics (New, Pilot, etc.) also show numbers for the currently loaded page (up to 100 rows, not the full total) without a date-scoped view. | Add a date-range filter (two date inputs or a preset select: "Last 7 days / 30 days / 90 days / Custom") to the filter bar, passing `dateFrom`/`dateTo` to the API. Labels on the summary metric strip should clarify that they reflect the loaded page only (or switch them to query-total values). | backlog |
| **PAG-008** | Early Access | **Medium** | ia-sequence | Q2 | day-one | `app/platform-admin/early-access/EarlyAccessClient.tsx:130-136` (filter state defaults); no default status filter | **The Early Access list opens on all statuses, not `new`.** Like the Feedback list finding (PAS-006), the growth marketer's primary daily task is working the new/uncontacted leads. Opening the pipeline and seeing converted, not-a-fit, do-not-contact, and new rows mixed together requires an immediate re-filter. The summary strip above the table provides counts by status, but the default list view shows everything. | Default the status filter to `new` when no URL param is set (or preserve the last-used filter in `localStorage`). A second useful default: sort the list by `follow_up_due_at` ascending so overdue follow-ups surface first. | backlog |
| **PAG-009** | Early Access | **Low** | missing-feature | Q4 | — | `app/platform-admin/early-access/EarlyAccessClient.tsx:434-489` (table); hard limit of 100 rows loaded | **The pipeline table loads at most 100 leads with no pagination UI.** The list call sets `limit=100` (line 93 of the client). If the pipeline has more than 100 leads, the excess rows are simply not shown. The header shows "total" from the API but there is no "Load more" or page navigation. A growth marketer who has accrued 150+ leads over the founding season sees only the first 100 sorted by newest-first. The summary strip (New leads count, Pilot count, etc.) is computed from the loaded slice, not the full total — so it will misrepresent the pipeline when over 100 leads exist. | Add a "Load more" button (infinite scroll or page buttons) wired to the `offset` param the API already supports. Update the summary metrics to compute from the API total counts (`total` from the response), not from `leads.length`. | backlog |
| **PAG-010** | Email | **Low** | copy | Q1 | day-one | `app/platform-admin/email/EmailDashboardClient.tsx:396-430` (stats row); no description of what "Active Recipients" means | **The Email stats row ("Founding Season Orgs / Active Recipients / Opted Out") does not explain the founding-season audience scope.** A new growth hire seeing "47 Active Recipients" does not know whether that is all customers, all paying customers, founding-season customers, or something else. The stat cards have no subtitle or tooltip. The page title is "Email Dashboard" with no description of who the email system serves. If the org base grows beyond the founding season, this ambiguity will become a real pre-send error risk. | Add a subtitle below the stats row, e.g. "Founding season organizations with active marketing email consent." Add a `title` tooltip on the stat cards explaining the filter criteria. | backlog |
| **PAG-011** | Overview | **Low** | design-visual | Q5 | day-one | `app/platform-admin/page.tsx:249-341` (Growth tab in OverviewTabs); `app/platform-admin/OverviewTabs.tsx:16-18` | **The Overview opens on the "Subscription" tab, not "Growth" — the tab most relevant to the growth role.** The four tabs (Subscription, Growth, Usage, Metric Notes) are role-agnostic. For growth, the Subscription tab (plan mix, status-by-plan, billing lifecycle events) is interesting background but not their primary use. The Growth tab (New Accounts, Early Access, League Starter funnel) is their principal signal source. Yet the page always opens on Subscription. There is no mechanism for the Overview to remember the last-viewed tab or select a role-appropriate default. | Either (a) remember the active tab in `localStorage` per session, or (b) pass the current role to `OverviewTabs` and default to the "Growth" tab for the `growth` role. | backlog |

---

## Day-one verdict

**No — but closer than PA2 support.**

A growth hire would quickly orient on Early Access: the pipeline UI is well-designed, the lead detail panel is comprehensive, the outreach templates are ready-to-use, and the export flow works. Within 30 minutes of first login, they could be filtering leads, copying an outreach template, and marking a lead contacted. That part is genuinely day-one usable with minimal tribal knowledge.

The Email surface would stall them. The page looks functional, but a new hire would not know what "Founding Season Orgs" means as an audience scope, would see a `[First Name] / [Org Name]` placeholder in the founding_welcome preview and wonder if the template is broken, and would not know whether it is safe to click "Send now" (is this going to email 47 real people right now, or is this a staging environment?). The confirm-send modal shows the recipient count and a warning — that part is good — but the framing and the audience explanation are absent from the page context.

The Overview is nearly unusable as a day-one surface for growth. The default tab is Subscription (billing-oriented), the Action Queue shows alerts they cannot action, and the Growth tab while visible has no link back to their own pipeline surfaces from the growth-relevant panels. The Help Hub has zero growth-specific content.

The critical blocker is the complete absence of a growth role-path or SOP in Help. Every other page has its purpose visible — the empty Help is what makes the experience "not day-one ready" rather than "close enough."

---

## Is this role COHERENT and COMPLETE?

**Coherent, yes. Complete, no.**

The role is coherent: Early Access and Email are a logical pair for a growth marketer. The lead pipeline covers the full lifecycle from new → qualified → pilot → converted, and the email surface covers broadcast outreach to the active customer base. These two surfaces together cover the founding-season growth playbook.

It is not complete in two ways:

1. **No growth analytics.** The marketer's job is to improve conversion from lead → trial → paid and to understand why orgs upgrade or don't. The metrics that would drive those decisions (§13 free-floor funnel, plan upgrade rates per cohort, churn by segment, which early-access leads converted vs. which went cold) are scattered across the Overview dashboard tabs and not actionable from the growth role. The overview Growth tab shows the pipeline status counts and the League Starter funnel, but growth cannot filter it, drill into it, or link it to specific orgs or leads. The conversion rate shown on the Early Access page (computed from the loaded 100 rows) is not a reliable overall metric.

2. **Email is founding-season-only.** There is no general-purpose marketing email capability. The audience is always "founding season orgs via comp_period override," the templates are hardcoded in the client and the API registry, and growth cannot create a new email, change the audience, or schedule a send. If/when the platform moves past the founding cohort, the Email surface as built will need significant rework before growth can use it for ongoing campaigns.

For the current founding-season moment, a growth hire can be productive with some onboarding. For a mature growth operation, the role is thin.

---

## Top 5 moves

1. **Add growth SOP and role-path to Help Hub (PAG-001 — High).** A "Growth role-path" card + two SOP sections (Early Access pipeline and Email send) in `lib/help-content/platform-admin.tsx` is the highest ROI day-one improvement. A growth hire who knows what to do on their first shift doesn't need to ask anyone.

2. **Gate the email send/resubscribe API routes on `manage_growth` (PAG-002 — High).** The mass-email send route currently accepts any platform session. Adding `requireAnyPlatformPermission(['manage_growth', 'manage_product'])` to `POST /api/admin/email/send` and `POST /api/admin/email/resubscribe` is a two-line security fix that prevents a read-only observer or support rep from triggering an accidental blast.

3. **Gate the early-access list and export routes on `manage_growth` (PAG-003 — High).** Changing `requirePlatformAdmin()` to `requireAnyPlatformPermission(['manage_growth', 'manage_product'])` on the GET list and export routes prevents all other roles from pulling the full lead database (including internal notes and outreach history) directly from the API.

4. **Fix per-email recipient counts in the Email dashboard confirm-send modal (PAG-006 — Medium).** The server already fetches `recipientCounts` per key; the client ignores it and uses the founding-season total for all emails. Wiring the correct count through the confirm-send modal prevents growth from approving a send based on a misleading recipient number.

5. **Default Early Access to `status=new` and add a date-range filter (PAG-007 + PAG-008 — Medium).** These two filter improvements together make the daily pipeline workflow faster: open the page, see today's actionable leads sorted by follow-up due date, narrow by submission window. Both improvements need only client-side filter-bar additions since the API already supports date params.

---

## Screenshots index

*(Stage C — live desktop screenshots, 1440×900, not yet captured; names reserved for when the live pass runs)*

| Filename | What it shows |
|----------|---------------|
| `pa5-s01-nav-growth.png` | Growth nav as rendered — Early Access + Email in the Growth group; Customer Users with eye icon; hidden groups absent |
| `pa5-s02-early-access-pipeline.png` | Early Access — full page: summary strip, conversion breakdown panels, filter bar, lead table |
| `pa5-s03-lead-detail-panel.png` | Early Access — lead detail panel open: fields, status dropdown, outreach templates section |
| `pa5-s04-email-dashboard-overview.png` | Email — stats row + Scheduled Sends table with status badges and actions column |
| `pa5-s05-email-confirm-modal.png` | Email — confirm-send modal showing recipient count, subject, and warning text |
| `pa5-s06-email-preview-founding-welcome.png` | Email — preview modal for founding_welcome showing `[First Name]` / `[Org Name]` placeholders |
| `pa5-s07-overview-growth-tab.png` | Overview — Growth tab active: New Accounts, Early Access, League Starter panels |
| `pa5-s08-overview-action-queue.png` | Overview — Action Queue showing "Trials ending soon" / "Price approvals" alerts growth cannot act on |
| `pa5-s09-help-hub-no-growth-path.png` | Help Hub — absence of any Growth role-path or Early Access/Email SOP sections |
| `pa5-s10-customer-users-view-only.png` | Customer Users — list visible for growth; no Actions menu rendered (correct view-only behaviour) |
