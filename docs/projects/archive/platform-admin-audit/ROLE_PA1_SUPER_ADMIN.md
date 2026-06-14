# PA1 — Super Admin (Founder-Operator) Report
> Walked: 2026-06-13 | Method: code-walk (Stage B) | Status: draft | Verify: risk-targeted (PF-1, PF-2)

---

## The operator at a glance

The super_admin is the platform's bootstrap founder — `fieldlogichq@gmail.com` in `PLATFORM_ADMIN_EMAILS` — and the person most likely to return cold after weeks away. On a normal operational shift they might: check the Action Queue, triage two new feedback submissions, scan the observability dashboard for fresh errors, review a pending change request, confirm a League Starter abuse flag, and reply to an early-access lead. They are also the only role that can delete an org, manage platform users, and access dev tools.

As the baseline cohesion pass the question is not "does every feature work" but "does the console hold together as a single coherent tool?" The answer is: mostly yes, with three sharp problems and several lower-friction gaps. The nav is disciplined, the action queue on the overview gives a clear morning pulse, and the per-org workflow tabs are well organized. What the console still lacks is a clear first-minute orientation for a new super_admin hire, and three net-new surfaces (email-template editor, dev tools, the support loop) have guard or naming problems that undermine the coherence story.

The day-one bar is set high here: can a new super_admin hire who has never been briefed on tribal knowledge look at the console and understand how the pieces fit? Mostly yes on navigation and area purpose — the nav groups are labeled, the area heading kickers are consistent, and the help hub is reachable one click away. It fails on two counts: (1) there is no "start here" orientation message on first login (the `previousVisit` hook exists but only changes the "last visit" timestamp label — it does not show first-login copy), and (2) the two guard holes (PF-1, PF-2) mean a new hire could accidentally reach surfaces that are supposed to be restricted to their role if they knew the URL.

---

## Role × area access map (as rendered)

| Area | PA1 access | Rendered correctly? | Notes |
|------|-----------|---------------------|-------|
| overview | ✅ write | ✅ — session guard only (benign: ALL_ROLES) | |
| organizations | ✅ write | ✅ — session guard only (benign: ALL_ROLES) | |
| customer_users | ✅ write | ✅ — session guard only (benign: ALL_ROLES) | |
| retention | ✅ write | ✅ `requirePlatformAreaView('retention')` | |
| early_access | ✅ write | ✅ `requirePlatformAreaView('early_access')` | |
| email | ✅ write | ✅ `requirePlatformAreaView('email')` | |
| change_requests | ✅ write | ✅ `requirePlatformAreaView('change_requests')` | |
| plans_pricing | ✅ write | ✅ `requirePlatformAreaView('plans_pricing')` | |
| bulk_operations | ✅ write | ✅ `requirePlatformAreaView('bulk_operations')` | |
| platform_users | ✅ write | ✅ `requirePlatformAreaView('platform_users')` | |
| observability | ✅ write | ✅ `requirePlatformAreaView('observability')` | |
| feedback | ✅ write | ✅ maps to `observability` area guard — intentional | |
| email_templates (list) | ✅ write | ✅ `requirePlatformAreaView('email_templates')` | |
| email_templates/[key] | ✅ write | ⚠ **NO server-side guard** — `page.tsx` is a 10-line pass-through to `EmailTemplateEditor` ('use client'); no `requirePlatformAreaView` call | **PF-1 confirmed** |
| dev_tools | ✅ write | ⚠ **NO role guard** — `dev-tools/layout.tsx:4` only checks env flag, not role; any authenticated platform session can reach it when `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` | **PF-2 confirmed** |
| audit | ✅ write | ✅ — session guard only (benign: ALL_ROLES) | |
| help | ✅ write | ✅ — session guard only (benign: ALL_ROLES) | |

---

## Cluster-by-cluster scorecard

| Cluster | Q1 Purpose | Q2 Sequence | Q3 Visual | Q4 Friction | Q5 Scan | Q6 Effective | Tribal knowledge? | Notes |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|-------|
| 1. Overview & orientation | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓ | Moderate | Action Queue is excellent; "last visit" label helpful; first-login orientation absent; §13 panel only in Growth tab, not at top of page |
| 2. Orgs & entitlements | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓ | Low | Org detail 5-tab workflow is well-labeled; no per-org League Starter abuse signal on org detail page; PF-4 confirmed |
| 3. Customer Users | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Low | Clean; employee-vs-customer exclusion is invisible but correct |
| 4. Support loop (Feedback + Observability + Change Requests) | ⚠ | ⚠ | ✓ | ⚠ | ✓ | ⚠ | High | Feedback and Observability live in the "System" nav group but are operationally support surfaces; the two have no cross-link from feedback row → org detail; change-requests lacks a "what is this for" orientation kicker |
| 5. Billing & plans | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓ | Moderate | Plans & Pricing is broad and comprehensive; "Plans & Pricing" nav label does not signal the depth (catalog versioning, campaigns, feature matrix, change requests); change-requests appear both in their own nav item AND as a tab inside Plans & Pricing — potential confusion |
| 6. Email & templates | ⚠ | ⚠ | ✓ | ⚠ | ✓ | ⚠ | High | Email Templates list page has a good description; the editor ([key]) has no guard and no breadcrumb role attribution; Email nav item (marketing batch) and Email Templates nav item (product copy) are very different things sitting in different nav groups with similar names — divergent audiences, no distinction in the label |
| 7. Comms / bulk-ops | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Low | Clear purpose, gated correctly, recent-ops history is a good pattern |
| 8. System & governance | ⚠ | ✓ | ✓ | ⚠ | ✓ | ⚠ | High | Observability + Feedback + Audit + Email Templates + Platform Users + Dev Tools all live in "System" — the group is overloaded; dev-tools guard hole (PF-2); Platform Users page header says nothing about bootstrap admins until you see the synthesized list |
| 9. Help / SOP hub | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | None | Excellent hub landing — role-path cards, quick links, searchable; per-module SOPs are readable; no SOP for observability/feedback triage (net-new surfaces) |

---

## Findings

| ID | Cluster | Severity | Type | Q | Tags | Evidence | Finding | Suggested direction | Route |
|----|---------|----------|------|---|------|----------|---------|---------------------|-------|
| PA0-001 | 6 — Email & templates | **High** | bug, role-gating | Q6 | least-privilege | `app/platform-admin/email-templates/[key]/page.tsx` (9 lines, no guard); `app/platform-admin/email-templates/[key]/EmailTemplateEditor.tsx` is `'use client'` | The per-template editor page has no `requirePlatformAreaView` call and no server-side session-plus-role check. The list page correctly guards on `email_templates` (super_admin + product only), but a billing, support, growth, or read_only user who knows the URL can reach the full editor. The `EmailTemplateEditor` component calls `PUT /api/platform-admin/email-templates/[key]` directly — whether the API route enforces role gating independently determines the actual write risk. | Add `await requirePlatformAreaView('email_templates')` as the first call in the `page.tsx` server component, mirroring the list page pattern. Then verify the API route also enforces `manage_product`. | backlog |
| PA0-002 | 8 — System & governance | **High** | bug, role-gating | Q6 | least-privilege | `app/platform-admin/dev-tools/layout.tsx:4` (env-flag redirect only); `app/platform-admin/dev-tools/page.tsx:1` (`'use client'`, no role check) | Dev Tools layout only checks `NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true'` and redirects to `/platform-admin`. When the flag IS true, any authenticated platform session (support, billing, growth, read_only) can reach the seed dashboard — which includes "Wipe Everything" and per-org wipe destructive actions. The matrix designates `dev_tools` as `super_admin`-only. | Add a server-side layout that calls `requirePlatformAreaView('dev_tools')` before rendering children, complementing the env-flag check. | backlog |
| PA0-003 | 4 — Support loop | **High** | ia-sequence, missing-sop | Q2, Q6 | day-one, support-seam | `app/platform-admin/feedback/page.tsx:116–117`; `app/platform-admin/observability/[groupId]/page.tsx`; `app/platform-admin/PlatformAdminNav.tsx:44–53` | Feedback and Observability sit together in the "System" nav group alongside Audit Log, Email Templates, and Platform Users. Operationally, Feedback + Observability are a customer support surface, not a system management surface. A new hire following the flow "customer reports a bug → I go to System → I see six items" must guess where to start. There is also no SOP in the Help hub for the feedback → observability triage loop (what is an issue, how do I move it through statuses, when do I route to engineering vs close). | Move Feedback and Observability into a dedicated "Support" nav group or place them under "Customers." Add a short SOP section in `lib/help-content/platform-admin.tsx` covering the feedback triage workflow and the observability status lifecycle. | backlog |
| PA0-004 | 2 — Orgs & entitlements | **Med** | missing-feature | Q5 | support-seam, day-one | `app/platform-admin/orgs/[id]/page.tsx` (no `free_floor` or §13 instrumentation data fetched or rendered); `app/platform-admin/page.tsx:316–340` (§13 panel lives only in the Growth tab of the dashboard) | When a support rep or super_admin investigates a specific suspect org (navigates to `/platform-admin/orgs/[id]`), there is no League Starter / free-floor badge, no §13 abuse signal, and no scope-wall hit count anywhere on the org detail page. The only place these signals appear is the overview dashboard's Growth tab (for global totals) and as a badge on the org *list*. An operator who arrives at the org detail page from an alert, a user complaint, or an internal note has no abuse context in view. | Fetch `free_floor` on the org detail and add a visible badge in the account hero section if the org is a League Starter floor; add per-org scope-wall hit count from `platform_events` as a callout in the Entitlements tab. | backlog |
| PA0-005 | 8 — System / nav IA | **Med** | ia-sequence | Q1, Q5 | day-one | `app/platform-admin/PlatformAdminNav.tsx:44–53` | The "System" nav group contains six items: Platform Users, Observability, Feedback, Audit Log, Email Templates, Help. This is an incoherent grouping — Platform Users and Dev Tools are admin governance, Observability/Feedback are support diagnostics, Audit Log is compliance, Email Templates is product content, and Help is employee onboarding. A new hire scanning "System" cannot predict what any of these areas do from the group label alone. | Restructure the System group into at least two groups: "Support & Diagnostics" (Feedback, Observability) and "Governance" (Platform Users, Audit Log) — or hoist Feedback/Observability to "Customers." Email Templates could move to "Billing & Product." | backlog |
| PA0-006 | 6 — Email & templates | **Med** | copy, ia-sequence | Q1 | day-one | `app/platform-admin/PlatformAdminNav.tsx:35–38` (Email, in Growth group) vs `:50` (Email Templates, in System group) | "Email" (bulk marketing batches to customers) and "Email Templates" (product transactional copy editor) are very different surfaces serving different roles (growth vs product) but their names differ only by one word. They sit in different nav groups with no additional label disambiguation. A new super_admin hire will predictably confuse these on day one, and a support rep who accidentally bookmarks the wrong one will hit an unguarded editor. | Rename to distinguish intent: e.g. "Marketing Email" (batch comms) vs "Transactional Templates" (product copy); or add a subtitle/kicker to each page header that immediately explains the audience and scope. | backlog |
| PA0-007 | 1 — Overview | **Med** | missing-feature | Q1 | day-one | `app/platform-admin/page.tsx:103–104` (`previousVisit` branch exists) | The overview page fetches `getPreviousPlatformAdminVisit` and shows `lastVisitLabel` (either "Last visit …" or "First tracked visit"). On a confirmed first visit the label reads "First tracked visit" — but there is no first-login orientation copy, no "here's where to start," and no prompt to read the Help hub SOP. A brand new super_admin hire returning from briefing has no screen-level orientation. | When `previousVisit` is null, render a short orientation banner or callout above the Action Queue: something like "Welcome — read the [Platform Admin SOP](/platform-admin/help/platform-admin) before making account changes." This requires a single conditional in the existing template, no new data fetch. | backlog |
| PA0-008 | 5 — Billing & plans | **Med** | ia-sequence | Q2, Q5 | day-one | `app/platform-admin/change-requests/page.tsx:9`; `app/platform-admin/plans-pricing/` (change requests also appear as a tab in PlansPricingClient) | Change Requests appears as a standalone nav item in the "Billing & Product" group AND as a tab inside Plans & Pricing. The standalone page is the triage queue; the Plans & Pricing tab shows related requests in context of the catalog. A new hire might not discover the standalone queue if they start from Plans & Pricing, or might not understand why the same items appear in two places. | Add a HelpCallout on the change-requests page explaining its relationship to Plans & Pricing ("Requests that touch plan or Stripe pricing also appear in the Plans & Pricing catalog view"). Alternatively, make the nav item label "Change Requests" more specific: "Approval Queue." | backlog |
| PA0-009 | 3 — Customer Users | **Low** | missing-sop | Q1 | day-one | `app/platform-admin/customer-users/page.tsx` (no page-level help callout); `app/platform-admin/help/platform-admin` (SOP section exists and is thorough) | The Customer Users page has no inline HelpCallout explaining its scope and exclusions (platform employees are excluded from the list). A new hire looking for `fieldlogichq@gmail.com` in this list will find nothing and may conclude the list is broken. The SOP in the Help hub documents the exclusion but the page itself does not hint at it. | Add a brief HelpCallout to the Customer Users page: "Platform employees are excluded from this list. To manage platform staff access, use Platform Users." One sentence, no new route needed. | backlog |
| PA0-010 | 9 — Help / SOP hub | **Low** | missing-sop | Q6 | day-one, support-seam | `app/platform-admin/help/page.tsx` (quickLinks and rolePaths arrays); `lib/help-content/platform-admin.tsx` | The Help hub has zero mention of Observability or Feedback in any quick link, role-path, or card. The "Platform Support" role-path (lines 98–112 of help/page.tsx) lists password resets, member access, notes, and audit — but not feedback triage or observability. These are the two biggest net-new surfaces added since the last help review. | Add a "Triage customer feedback" quick link pointing to `/platform-admin/feedback`; add a step to the Platform Support role-path for "Review and triage in-app feedback." Add a short SOP section in `lib/help-content/platform-admin.tsx` for the feedback → observability issue lifecycle. | backlog |
| PA0-011 | 4 — Support loop | **Low** | design-visual | Q5 | support-seam | `app/platform-admin/feedback/page.tsx:139` (header shows "System" as the breadcrumb kicker) | Both Feedback (`headerLabel: 'System'`) and Observability (`headerLabel: 'System'`) use "System" as the page-level kicker label. If these surfaces move to a better nav group (PA0-003), the kickers will be stale. Minor, but the breadcrumb is the operator's visual anchor for "where am I." | When the nav group is resolved (PA0-003), update the `headerLabel` kicker on both pages to match. | backlog |
| PA0-012 | 2 — Orgs & entitlements | **Low** | ia-sequence | Q2 | day-one | `app/platform-admin/orgs/[id]/page.tsx:487–509` (OrgDetailClient call with `isSuperAdmin` prop) | The org detail page passes `isSuperAdmin` to the client to show the "Delete Organization" section. Non-super roles see a locked stub ("super admin only"). The flow is correct, but the "Delete Organization" card lives inside the "Support" tab (the first and default tab) — a new hire loading the org detail for a support call sees a dangerous destructive action card immediately, even though it is guarded. It could alarm an inexperienced user or become a muscle-memory risk for a rushed super_admin. | Consider moving "Delete Organization" to a dedicated "Admin" or "Danger" tab in the workflow, or at least place it at the very bottom of the Support tab with a visual separator, so it is not the first card a support operator's eye lands on. | backlog |
| PA0-013 | 6 — Email & templates | **Low** | design-visual | Q3 | — | `app/platform-admin/email-templates/page.tsx:53` (header kicker reads "Platform Admin") | The Email Templates list page uses "Platform Admin" as its `headerLabel` kicker, while every other System-group page uses "System." This is a naming inconsistency — minor but breaks the visual scanning pattern a new hire builds up. | Change the kicker to "System" (or whatever the resolved group label becomes per PA0-005). | backlog |
| PA0-014 | 8 — System & governance (PF-3 carry) | **Low** | role-gating | Q6 | least-privilege | `app/platform-admin/orgs/page.tsx` (no area guard), `app/platform-admin/orgs/[id]/page.tsx` (no area guard), `app/platform-admin/customer-users/page.tsx` (no area guard), `app/platform-admin/audit/page.tsx` (no area guard) | Four ALL_ROLES pages call no `requirePlatformAreaView`. Zero impact today because the matrix designates them ALL_ROLES (view-only writes don't exist). However, if the matrix is ever tightened — e.g. restricting `organizations` to exclude `read_only` — those pages will silently fail to enforce the restriction because the guard pattern is absent. | Add `requirePlatformAreaView('organizations')`, `requirePlatformAreaView('customer_users')`, and `requirePlatformAreaView('audit')` at the top of each respective server page. Cost: 3 lines each, prevents future guard misses. | backlog |

---

## Day-one verdict

**No — not quite, but close.**

A zero-knowledge new super_admin hire can orient within about 10 minutes of exploring: the nav groups are labeled, the overview Action Queue gives an immediate operational pulse, the Help hub is one click away and excellent. Where day-one fails:

1. **No first-login welcome/orientation message.** The code already knows it's a first visit (`previousVisit === null`) but only emits "First tracked visit" as a timestamp label. There is no nudge to read the SOP, no "here's where to start" moment.
2. **Two guard holes (PA0-001, PA0-002)** mean a new super_admin hire who has been granted the bootstrap role but not yet briefed could stumble into the email-template editor or dev tools without knowing these are sensitive.
3. **Nav group "System" overloading (PA0-005)** means a new hire scanning for the customer feedback surface must open multiple items to find it, and does not immediately see that Feedback/Observability are operational (not administrative) surfaces.
4. **No SOP for the two highest-value net-new surfaces** (feedback triage, observability issue lifecycle) — a new hire using these for the first time has no in-console guidance beyond a brief HelpCallout.

---

## Top 5 moves

1. **PA0-001 — Fix the email-template editor guard** (High bug): add `requirePlatformAreaView('email_templates')` to `email-templates/[key]/page.tsx`. Highest-priority because it is a real least-privilege hole on a write surface.

2. **PA0-002 — Fix the dev-tools role guard** (High bug): add a server-side `requirePlatformAreaView('dev_tools')` check to the dev-tools layout so the env flag alone does not grant access to all roles. Wipe-all is in there.

3. **PA0-003 / PA0-005 — Restructure the "System" nav group** (Med ia-sequence): move Feedback and Observability to a "Support & Diagnostics" group; add a Help hub SOP for the feedback → observability triage loop. This directly benefits day-one learnability and the PA2 support seam.

4. **PA0-007 — Add first-login orientation** (Med missing-feature): when `previousVisit` is null, render a one-sentence orientation banner pointing to the Help SOP. Zero new data fetching required.

5. **PA0-004 — Add League Starter abuse signal to org detail** (Med missing-feature): fetch `free_floor` and per-org `scope_wall_hit` count on the org detail page so an operator investigating a specific suspected free-tier abuser has the signal in context, not just on the global dashboard.

---

## Screenshots index

The following screens are the signature captures for this role walk. Capture at 1440×900, dark theme.

| Filename | What it shows |
|----------|---------------|
| `pa1-01-overview-action-queue.png` | Overview dashboard, Action Queue section — confirms warning-tone alert items and "last visit" label |
| `pa1-02-overview-league-starter-panel.png` | Overview dashboard → Growth tab → League Starter panel (§13 instrumentation) |
| `pa1-03-orgs-list-league-starter-badge.png` | Organizations list with "League Starter" badge in the org row and the free-floor filter checkbox |
| `pa1-04-org-detail-support-tab.png` | Org detail → Support tab, showing "Delete Organization" card position relative to Internal Notes — illustrates PA0-012 |
| `pa1-05-org-detail-billing-tab.png` | Org detail → Billing & Access tab — overrides form and cancel subscription section |
| `pa1-06-feedback-page.png` | Feedback triage list — type/category/status filters, "View related issue" link in an expanded body |
| `pa1-07-observability-dashboard.png` | Observability dashboard — headline metrics, calls vs errors chart, freshness chip |
| `pa1-08-observability-issue-detail.png` | Error group detail — sparkline, event samples with CollapsibleCard, StatusControls, back-link to Observability |
| `pa1-09-email-templates-list.png` | Email Templates list — category groups, Customised/Default badges, Edit links |
| `pa1-10-email-template-editor.png` | Email template editor — subject/body fields, test-send, reset-to-default; illustrates the unguarded entry point (PA0-001) |
| `pa1-11-dev-tools.png` | Dev Tools seed dashboard — shows access is gated only by env flag, not role (PA0-002); Wipe Everything danger zone visible |
| `pa1-12-help-hub.png` | Help Center hub landing — role-path cards, quick links, search bar |
| `pa1-13-plans-pricing.png` | Plans & Pricing — plan impact table, catalog versions, feature matrix; illustrates breadth and the duplicate change-requests appearance (PA0-008) |
| `pa1-14-nav-system-group.png` | Nav sidebar with "System" group expanded — all six items visible, illustrating the overloaded group (PA0-005) |
