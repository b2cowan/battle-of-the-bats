# PA2 — Support Rep Operator Report
> Walked: 2026-06-13 | Method: code-walk (Stage B) | Status: draft | Verify: risk-targeted (High/bug findings)

---

## The operator at a glance

A support rep in this role arrives for a shift knowing that customer tickets about login problems, score-saving errors, or account access will land in their queue. They have one meaningful write surface — Customer Users — and view-only access to Observability and Feedback. Their nav is tighter than any other functional role: no Growth group, no Billing & Product group, no Platform Users or Email Templates.

The console feels purposeful from a navigation standpoint. The nav drops everything they cannot touch, and the items they can reach are labelled clearly. The eye-icon convention on Retention, Observability, and Feedback correctly signals "you can look but not act." In that narrow sense, the least-privilege posture is communicated.

The experience breaks down the moment a customer submits a "scores won't save" bug report. The support rep can read the feedback item and follow the "View related issue" link to the error group detail. They can see the stack trace, the org slug, the user email. They can even see the Resolve/Ignore/Snooze buttons — those buttons are rendered but disabled, with a "View-only for your role" note. So far, so good. What happens next is where the loop collapses: **the rep cannot change the feedback status from `new` to `triaged` or `resolved`**. The status column on Feedback renders a plain badge, not a dropdown, for their role. The API route requires `manage_product`. The rep has no mechanism to record "I handled this" on the observability side, and no mechanism on the feedback side either.

Their only actual "close the loop" affordance is the **Notes** action on the Customer Users row: they can document what they did in a per-user note. That's the only write that persists a record of support activity tied to the incident. It doesn't touch the feedback item. The ticket state and the operator action are permanently unlinked.

---

## Role × area access map (as rendered)

| Area | This role | Guard correctly enforced? | Notes |
|------|-----------|--------------------------|-------|
| overview | 👁 (all-roles read) | benign — no `requirePlatformAreaView`, but ALL_ROLES so no restriction bypassed | Renders full dashboard metrics including League-Starter §13 panel |
| organizations | 👁 (all-roles read) | benign — no page guard | Full org list with attention filters visible |
| customer_users | ✅ WRITE | benign — no page guard; API routes enforce `manage_support` | All actions (reset/ban/unban/confirm/edit/notes/delete) available |
| retention | 👁 VIEW-ONLY | ✅ `requirePlatformAreaView('retention')` | Can see table and "Process expiry" + "Extend" buttons; **API for extend requires `manage_billing` → 403 if clicked** |
| observability | 👁 VIEW-ONLY | ✅ `requirePlatformAreaView('observability')` | Can see all issue data, stack traces, affected orgs; Resolve/Ignore/Snooze buttons present but disabled |
| feedback | 👁 VIEW-ONLY | ✅ guard on `observability` area | Status column renders static badge, not dropdown; "View related issue" link works; export available |
| audit | 👁 (all-roles read) | benign — no page guard | Full audit log visible; no write capability here (by design) |
| help | 👁 (all-roles read) | benign — no page guard | Full Help Hub visible including employee-only SOP guide |
| bulk_operations | — HIDDEN | ✅ filtered from nav | Correctly absent |
| plans_pricing | — HIDDEN | ✅ filtered from nav | Correctly absent |
| change_requests | — HIDDEN | ✅ filtered from nav | Correctly absent |
| email_templates | — HIDDEN | nav filtered; **[key] editor unguarded (PF-1)** | Direct URL `/platform-admin/email-templates/anything` is reachable |
| early_access | — HIDDEN | ✅ filtered from nav | Correctly absent |
| email | — HIDDEN | ✅ filtered from nav | Correctly absent |
| platform_users | — HIDDEN | ✅ filtered from nav | Correctly absent |
| dev_tools | — HIDDEN | **PF-2: no role guard on page** | If `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`, reachable by direct URL |

---

## Cluster-by-cluster scorecard

| Cluster | Q1 Purpose | Q2 Sequence | Q3 Visual | Q4 Friction | Q5 Scan | Q6 Effective | Tribal knowledge? | Notes |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|-------|
| Feedback + Observability (support seam) | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | **YES** | Purpose clear; sequence breaks at "now what?"; no write affordance → loop dead-ends |
| Customer Users | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓ | partial | Actions menu is comprehensive; SOP exists; delete is exposed to support (see PAS-007) |
| Organizations list + detail | ✓ | ✓ | ✓ | ⚠ | ✓ | ✓ | partial | Support tab on org detail works well; retention-extend and override buttons silent-fail for support |
| Retention Queue | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | **YES** | Can see queue, but "Process expiry" and "+30 days" send `manage_billing`-gated API calls → silent 403 |
| Audit Log | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | no | Self-explanatory read-only tool; strong |
| Help Hub | ✓ | ✓ | ✓ | ⚠ | ✓ | ⚠ | partial | Support role-path present; feedback/observability SOP absent; no "what to do when you see a bug report" guide |

---

## Findings

| ID | Cluster | Severity | Type | Q | Tags | Evidence | Finding | Suggested direction | Route |
|----|---------|----------|------|---|------|----------|---------|---------------------|-------|
| **PAS-001** | Feedback / Observability | **Blocker** | missing-feature | Q6 | support-seam, day-one | `app/platform-admin/feedback/page.tsx:116-117`; `app/api/platform-admin/feedback/[id]/status/route.ts:19` | **Support cannot change feedback status.** The page detects `readOnly=true` for the support role and renders a static badge in the Status column. The mutation API requires `manage_product`. A support rep cannot move a ticket from `new` → `triaged` → `acknowledged` → `resolved`. The feedback loop dead-ends — support can read every item but cannot record having handled it. | Add `manage_support` (or a new dedicated `manage_feedback`) to the feedback status route's permission check, and grant support write access on the `observability` area in `lib/platform-areas.ts`. Decouple feedback write from observability write if error-group triage must stay product-only. | backlog |
| **PAS-002** | Retention Queue | **High** | role-gating | Q4, Q6 | support-seam, least-privilege, day-one | `app/platform-admin/retention/RetentionQueueClient.tsx:56-79,84-110`; `app/api/platform-admin/retention/[recordId]/extend/route.ts:23` | **Retention actions are silent dead-ends for support.** The "Process expiry" and "+30 days" buttons are rendered and enabled in the UI for support (no `canManage*` guard in the client), but both API calls require `manage_billing` → 403. A support rep investigating a purge-risk case clicks "+30 days", enters a reason, submits — and gets a silent API error. No tooltip, no disabled state, no "requires billing access" copy explains why. | Disable or hide the action buttons for roles without `manage_billing`. At minimum, add a `title` tooltip ("Requires billing access") and set `disabled` on the buttons when the role cannot complete the action, matching the pattern used elsewhere (e.g. `StatusControls` read-only note). | backlog |
| **PAS-003** | Organizations — Org Detail | **High** | role-gating | Q4, Q6 | support-seam, least-privilege | `app/platform-admin/orgs/[id]/OrgDetailClient.tsx:488-510` (props passed); `app/platform-admin/orgs/[id]/page.tsx:492-496` | **Org detail "Billing & Access" tab override and status-change controls are rendered but silently fail for support.** `canManageBilling=false` for support, so the billing tab form fields are hidden — good. But the **Entitlements** tab addon checkboxes and the **Billing & Access** override form are *also* rendered to support with no explicit guard. The addon API (`/api/platform-admin/orgs/[id]/addons`) and override API (`/api/platform-admin/orgs/[id]/overrides`) are `manage_billing`/`manage_product`-gated. Support can interact with the form, submit, and receive a 403. The "Organization Identity" and "Account Ownership" sections correctly gate on `canManageSupport` with a legible "Requires support access" fallback — that pattern is not consistently applied to other writable sections. | Apply the same gate pattern used for the Identity/Ownership sections to the Entitlements and Billing & Access tabs — either hide/disable the form when the role cannot write, or show a consistent "Requires billing access" note. | backlog |
| **PAS-004** | Customer Users | **High** | role-gating | Q4, Q6 | least-privilege | `app/platform-admin/customer-users/CustomerUsersClient.tsx:583-590`; `app/api/platform-admin/users/[id]/delete/route.ts:9` | **Delete User is exposed to the support role.** The delete action (hard-permanent, requires typing email to confirm, calls Supabase auth.admin.deleteUser) is gated at the API with `manage_support`. The support role holds `manage_support`. A support rep can permanently delete a customer auth account. This is a destructive, irreversible action that arguably should require `manage_billing` or `super_admin` — the baseline eval flagged similar over-broad grants. Confirm whether permanent user deletion is an intended support-rep capability, or whether it should be elevated. | Tighten the delete API route to `requireSuperAdmin()` (matching the org-delete pattern) or at minimum `manage_billing`, and remove Delete User from the Actions menu for the `support` role. Add a `canDelete` prop to `CustomerUsersClient` gated on the actual role, or use a separate permission check passed from the server page. | backlog |
| **PAS-005** | Feedback / Observability | **High** | missing-feature | Q4, Q6 | support-seam | `app/platform-admin/feedback/page.tsx:182-226`; `app/platform-admin/observability/[groupId]/page.tsx:107-190` | **No escalation / assignment path exists.** When support finds a bug report that requires engineering action, there is no in-console mechanism to assign it, escalate it, or notify the product role. The only option is out-of-band (Slack, email). The "View related issue →" link on the feedback list correctly leads to the error group — but that's where support's journey ends. There is no "flag for product" button, no "create change request" link, no comment thread. | Add an "Escalate" or "Flag for product" affordance on the feedback item or error group that creates a change-request or sends an internal notification. This could be a simple API write (e.g. set a `needs_product_review` flag and post to an internal webhook) scoped so support can write it. | backlog |
| **PAS-006** | Feedback — list page | **Medium** | ia-sequence | Q2, Q4 | support-seam, day-one | `app/platform-admin/feedback/page.tsx:133-166` | **No status-based default filter.** The feedback list opens showing all statuses (new + triaged + acknowledged + resolved), sorted newest-first. For a support rep doing triage work, the useful default view is `status=new`. The page has no saved or default filter, and page reload loses any filter state. A busy shift starts with a mixed list requiring immediate re-filtering. | Default to `?status=new` when no filter is set, or persist filter state in `localStorage` / URL for the session. | backlog |
| **PAS-007** | Feedback / Observability | **Medium** | missing-feature | Q5 | support-seam | `app/platform-admin/feedback/page.tsx:208-212`; `app/platform-admin/observability/page.tsx` | **Feedback → Observability link is one-directional and coverage-dependent.** The "View related issue →" link from a feedback item to its error group is computed by matching `context.requestId` → `error_events.group_id`. If the feedback widget captured no `requestId` (e.g. the user typed feedback from memory, not during the error), or the event was purged, the link is absent with no explanation. The observability side has no "related feedback" back-link. A rep has to manually correlate by org slug + timestamp. | (a) Show a "No related error captured" note when `requestId` is absent, so the rep knows to search manually. (b) Add a "Related feedback" column or panel on the error group detail page that reverse-queries `feedback_submissions` by `context.requestId`. | backlog |
| **PAS-008** | Help Hub / SOPs | **Medium** | missing-sop | Q1, Q6 | support-seam, day-one | `app/platform-admin/help/platform-admin/page.tsx`; `lib/help-content/platform-admin.tsx` | **No SOP for the Feedback + Observability workflow.** The Platform Admin Operations guide has well-formed SOPs for password reset, ban/unban, email confirm, notes, and audit investigation. It has nothing about Feedback or Observability: no "how to read the feedback queue," no "how to find the error group for a customer bug report," no "what to do when you cannot resolve an issue yourself." A new support rep on shift one will not know these surfaces exist or how to use them. | Add a "How to triage customer feedback and find related errors" SOP section to `lib/help-content/platform-admin.tsx`, linked from the Help Hub quick links and the Support role-path. | backlog |
| **PAS-009** | Organizations — Org Detail | **Medium** | missing-feature | Q6 | support-seam | `app/platform-admin/orgs/[id]/page.tsx:336-510` | **No per-org League-Starter / free-floor signal on the org detail page.** The overview dashboard (§13 instrumentation panel) and the org list (free-floor column) flag League-Starter orgs, but the org detail page shows no such badge. A rep looking at a specific org's detail has no quick indication of whether the org is on the League Starter free floor. They must return to the org list, scan the row, or read the plan name and guess. Pre-finding PF-4 confirmed. | Add a League Starter badge (mirroring the org list's `isFreeFloor` flag) to the org detail hero/badges area, alongside the existing plan label and subscription status badges. | backlog |
| **PAS-010** | Customer Users | **Medium** | ia-sequence | Q2 | day-one | `app/platform-admin/customer-users/CustomerUsersClient.tsx:541-543` | **"Notes" is the first item in the Actions menu**, above "Edit Info" and "Reset Password". Per the SOP, a rep should confirm identity (email/org memberships) before acting. The most common first action is lookup/diagnosis or password reset, not note-taking. Menu order implies Notes > Edit > Reset > Confirm > Revoke > Ban/Unban/Delete, which is not the natural triage sequence. | Reorder: Reset Password → Confirm Email → Revoke Sessions → [divider] → Edit Info → Notes → [divider] → Ban/Unban/Delete. | backlog |
| **PAS-011** | Overview dashboard | **Low** | design-visual | Q5 | day-one | `app/platform-admin/page.tsx` (no `requirePlatformAreaView` call) | **Overview renders a "Metric Snapshot" button** that calls `getPlatformMetrics()`. The snapshot API permission is not visible from the page file — confirm it is not restricted to super_admin only and that support can safely call it. Minor: the dashboard's "Action Queue" includes "Trials ending soon" and "Expired overrides" — items a support rep cannot act on (billing/product domain). No role-contextual guidance explains "these items need billing team attention." | Add a one-line "Contact the billing team for expiring trials and override review" note in the Action Queue for non-billing roles. | backlog |
| **PAS-012** | Feedback — list page | **Low** | copy | Q1 | day-one | `app/platform-admin/feedback/page.tsx:142-145` | **HelpCallout body says "Feedback is retained indefinitely."** This is useful operational info, but it does not say anything about the support rep's role: that they can read and export but cannot change status. A new rep staring at the grey static badges in the Status column (and an Actions-less page) will not know why the dropdown is absent. | Add a view-only note to the HelpCallout body, e.g. "Status changes require product access — contact a product operator to triage or resolve items." This closes the "is it broken?" vs "I'm not allowed" ambiguity. | backlog |

---

## Day-one verdict

**No.** A brand-new support hire could orient quickly on Customer Users — the SOP is present, the actions menu is clear, and the search/pagination flow is professional. They would struggle the moment they hit the Feedback queue. The static Status badge gives no explanation of why the dropdown is absent. The "View related issue" link works only some of the time; when it doesn't, there is no guidance on manual correlation. The Retention Queue renders active-looking buttons that silently 403. The org detail's Billing & Access and Entitlements tabs have forms that submit and fail invisibly.

Across these surfaces, the "I'm not allowed" signal is inconsistent: Customer Users' Notes section shows a clear "Requires support access" message when support *lacks* a permission (which never actually occurs, since support has it — but the pattern is there); Retention shows no such message; the observability triage controls show a note ("View-only for your role") which is the gold standard; the feedback Status column shows nothing. A new hire cannot reliably distinguish "broken" from "not permitted."

The Help Hub has a good Support role-path and a quality SOP for account-level actions. It has no SOP at all for the feedback/observability workflow, which is the newest and most important surface for the support seam.

---

## Support-seam verdict

**Support cannot close the loop. The seam breaks at step 1 (RECEIVE/TRIAGE).**

Walking the concrete scenario — "a customer emails that scores won't save":

1. **RECEIVE.** Support navigates to Feedback, filters by type=bug. The submission is visible. The Status column shows a static `new` badge — no dropdown. There is no way to change the status. Support cannot acknowledge receipt or mark the item triaged. **Loop breaks here for feedback triage.**

2. **DIAGNOSE.** If the feedback item has a captured `requestId`, a "View related issue →" link appears inside the row's `<details>` panel. Clicking it opens the error group detail. Support sees the route (`POST /api/…/scores`), the stack trace (redacted), the org slug, and the user email from sample events. This part works well. However, if no `requestId` was captured, the link is absent with no explanation. Manual correlation requires searching Observability by org slug — doable, not guided. **Diagnosis is possible but link coverage is partial.**

3. **ACT.** Support can: open Customer Users, find the org owner's email (from the org detail People tab), generate a password-reset link (if that helps), add a per-user or per-org note, confirm the user's auth status. They cannot reset or override any server-side feature behavior. They cannot add a note directly to the error group or feedback item. **Account-level triage actions work. Product-level or error-level actions are blocked.**

4. **CLOSE THE LOOP.** There is no in-console mechanism to: (a) mark the feedback item resolved, (b) mark the error group resolved, (c) assign the issue to a product operator, (d) create a change request from within the observability/feedback surfaces, or (e) notify the customer from within the platform-admin console. Support can write a per-user or per-org internal note and then handle the customer out-of-band. The feedback item and error group remain in `new`/`open` state indefinitely until a product operator manually triages them. **The loop dead-ends. There is no in-console close-the-loop mechanism for support.**

**Root cause (code-confirmed):**
- `feedback/[id]/status/route.ts:19` — `requirePlatformPermission('manage_product')` blocks support.
- `observability/[groupId]/status/route.ts:21` — same gate.
- `isPlatformAreaReadOnly(auth.role, 'observability')` in both page files evaluates to `true` for support → `readOnly=true` → status controls disabled.
- No escalation path, no feedback→change-request link, no assignee field.

---

## Top 5 moves

1. **Grant support feedback-status write (PAS-001 — Blocker).** Add `manage_support` permission to `/api/platform-admin/feedback/[id]/status` and update `platform-areas.ts` to put support in `observability.writeRoles` for feedback mutations only, or add a dedicated `feedback` area with separate write gating. This is the single change that unblocks the entire support seam.

2. **Add feedback/observability SOP to the Help Hub (PAS-008 — Medium).** A "How to triage customer feedback and find related error groups" section in `lib/help-content/platform-admin.tsx`, linked from the Support role-path, closes the day-one knowledge gap for the most important support workflow.

3. **Fix silent dead-ends on Retention and Org Detail (PAS-002, PAS-003 — High).** Apply the `disabled` + `title="Requires billing access"` pattern to the Retention "+30 days" and "Process expiry" buttons, and to the Entitlements/Billing & Access forms on Org Detail. Eliminates the most jarring "I clicked it and nothing happened" moments.

4. **Add escalation/assignment affordance on feedback and error groups (PAS-005 — High).** Even a minimal "Flag for product" button that sets a flag or posts to an internal webhook would give support a path forward on issues they cannot resolve unilaterally.

5. **Default Feedback list to `status=new` (PAS-006 — Medium).** Lowest-effort, highest daily-workflow impact — new hires and experienced reps alike start on the useful view instead of having to re-filter every time.

---

## Screenshots index

*(Stage C — live desktop screenshots, 1440×900, not yet captured; names reserved for when the live pass runs)*

| Filename | What it shows |
|----------|---------------|
| `pa2-s01-nav-support.png` | Support nav as rendered — Observability + Feedback with eye icon; hidden groups absent |
| `pa2-s02-feedback-list-view-only.png` | Feedback list — static `new` badge in Status column for support; no dropdown |
| `pa2-s03-feedback-related-issue-link.png` | Feedback row expanded — "View related issue →" link inside details panel |
| `pa2-s04-error-group-view-only.png` | Error group detail — Resolve/Ignore/Snooze buttons disabled; "View-only for your role" note |
| `pa2-s05-customer-users-actions-menu.png` | Customer Users — Actions menu open showing all verbs including Delete User |
| `pa2-s06-retention-queue-unsaved-attempt.png` | Retention Queue — "+30 days" button active (no visual disable) for support role |
| `pa2-s07-org-detail-support-tab.png` | Org detail — Support tab with Internal Notes (writable) and Identity (writable) |
| `pa2-s08-org-detail-billing-tab.png` | Org detail — Billing & Access tab with override form rendered for support (silent-fail) |
| `pa2-s09-help-hub-support-path.png` | Help Hub — Platform Support role-path card |
| `pa2-s10-help-sop-gap.png` | Platform Admin Operations SOP — absence of any Feedback/Observability section |
