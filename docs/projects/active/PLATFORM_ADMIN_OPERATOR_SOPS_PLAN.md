# Platform-Admin Operator SOPs + Day-One Orientation (F4) — Implementation Plan

> **Status:** Scoped 2026-06-13. **Priority: P2.** Spun out of the [Platform-Admin Employee Audit](../archive/platform-admin-audit/SYNTHESIS.md) Themes D + E.
> **Companion:** [PLATFORM_ADMIN_OPERATOR_SOPS_PM_BRIEF.md](PLATFORM_ADMIN_OPERATOR_SOPS_PM_BRIEF.md)
> **Branch:** feat/free-tier-coaches (or a dedicated docs branch — no schema changes; all edits are TSX/content files)
> **Verification standard:** findings pulled first-hand from role walk reports PA1–PA5; gap table cross-referenced against `lib/help-content/platform-admin.tsx` live content.

---

## Problem

Every platform-admin role came back with a "No" day-one verdict. Two of the three root causes belong to this project:

1. **Zero SOP coverage on the six net-new surfaces** (Feedback, Observability, Change Requests, Email Templates, Email batch, Early Access). The `lib/help-content/platform-admin.tsx` file has 14 SOP sections organised into five groups (Orientation, Support SOP, Billing SOP, Product SOP, Investigation SOP). None of those sections covers any of the six surfaces added in the past two development cycles. The Growth role has no SOP content at all — not even a role-path card on the Help Hub landing.

2. **No day-one orientation / first-login moment.** The Overview page already detects a first visit (`previousVisit === null` emits "First tracked visit"), but renders nothing that orients a new hire. No "start here," no role-contextual framing of which surfaces are theirs, and the Action Queue surfaces cross-domain alerts (expired overrides, trial expiries) that non-billing roles cannot action — with no explanation.

The F1 and F2 fix projects address API guards and silent dead-ends. This project fills the procedural and orientation gap that makes the *remaining* "why?" questions unanswerable without tribal knowledge.

Source findings:
- **PAS-008** — no Feedback/Observability SOP in Help Hub (support role, Medium)
- **PAP-010** — Product role has one SOP section for seven write surfaces; no role-path card (product role, Medium)
- **PAG-001** — no SOP or role-path for the growth role (growth role, High)
- **PA0-007** — no first-login orientation banner despite `previousVisit` hook being available (super_admin, Medium)
- **PA0-010** — zero mention of Observability or Feedback in Help Hub quick links or role-paths (super_admin, Low)
- **PAP-006** — no Change Requests SOP (product role, Medium)
- **PAP-008** — no Email Templates SOP, no risk-awareness copy (product role, Medium)
- **PAP-009** — no Email batch send SOP, no "who can approve a send" guidance (product role, Medium)
- **PAG-001** (overlap) — no Early Access pipeline SOP (growth role, High)

---

## SOP gap table

| Surface | Current SOP section? | Roles that need it | Net-new section(s) to add |
|---------|---------------------|--------------------|--------------------------|
| Feedback triage | **None** | support (view + potential write), product (write), super_admin | "How to triage customer feedback" |
| Observability / error group lifecycle | **None** | support (view), product (write), super_admin | "How to use the observability dashboard and resolve error groups" |
| Change Requests workflow | **None** | product (write), super_admin | "How to review and action change requests" |
| Email Templates editing | **None** | product (write), super_admin | "How to edit email templates safely" |
| Email batch send | **None** | growth (write), product (write — both can trigger), super_admin | "How to send a batch marketing email" |
| Early Access pipeline | **None** | growth (write), super_admin | "How to manage the early-access lead pipeline" |
| Plans & Pricing (risk ladder) | Exists — 4 bullets (section `plans-pricing`) | product (write), super_admin | **Expand existing section** (not a new one) |
| Bulk Operations — product side | Exists — covers all types (section `bulk-operations`) | product (write), super_admin | Add inline role-scoping note |

**6 net-new SOP sections + 1 existing section expansion = 7 writing tasks in `lib/help-content/platform-admin.tsx`.**

---

## Orientation feature

### 1 — First-login banner on the Overview page

**File:** `app/platform-admin/page.tsx`

The page already calls `getPreviousPlatformAdminVisit(user.id)` and derives `previousVisit`. When `previousVisit === null`, render a dismissible orientation callout above the Action Queue. Content is role-aware:

- **super_admin:** "Welcome — you have access to every area of the console. Read the [Platform Admin Operations SOP](/platform-admin/help/platform-admin) before making account or billing changes."
- **support:** "Welcome — your job surface is Customer Users, Feedback, Observability, and Audit. Start with [Platform Support SOP](/platform-admin/help/platform-admin#reset-password)."
- **billing:** "Welcome — your primary surfaces are Organizations (Billing & Access), Retention, and Bulk Operations. Start with [Billing & Product SOP](/platform-admin/help/platform-admin#billing-overrides)."
- **product:** "Welcome — you have write access to Change Requests, Email Templates, Email, Plans & Pricing, and Observability. Start with [Product Operator SOP](/platform-admin/help/platform-admin#change-requests)."
- **growth:** "Welcome — your surfaces are Early Access and Email. Start with [Growth Operator SOP](/platform-admin/help/platform-admin#early-access-pipeline)."
- **read_only:** "Welcome — this console is read-only for your role. The Action Queue and org details are visible but no changes can be made."

Dismissal should persist in `localStorage` (key: `pa_orientation_dismissed`) so the banner does not re-appear after the employee first clicks away. The `previousVisit` remains the trigger — this is not a recurring prompt.

### 2 — Role-path cards on the Help Hub landing

**File:** `app/platform-admin/help/page.tsx`

Add two missing role-path cards to the `rolePaths` array:

**"Product Operator"** (currently absent; only "Billing and Product Admin" exists, which is billing-weighted):
- Triage Feedback and find related error groups → `#feedback-triage`
- Review and action change requests → `#change-requests`
- Edit an email template safely → `#email-templates`
- Send a batch marketing email → `#email-batch-send`
- Work with plans, pricing, and feature matrix → `#plans-pricing`

**"Growth Operator"** (currently absent):
- Manage the early-access lead pipeline → `#early-access-pipeline`
- Send a batch marketing email → `#email-batch-send`
- Understand the Overview Growth tab → `/platform-admin` (external link, no anchor needed)

### 3 — Action Queue role-context note on the Overview

**File:** `app/platform-admin/page.tsx`

When a non-billing role (support, product, growth, read_only) views the Action Queue and it contains "Trials ending soon" or "Expired overrides" items, render a one-line note beneath those items:

> "These items require billing access — contact the billing team to action them."

This is a conditional inline note, not a structural change to the queue data. The check uses the existing `canManageBilling` flag already computed on the Overview page server component.

### 4 — Help Hub quick links for the net-new surfaces

**File:** `app/platform-admin/help/page.tsx`

Add to the `quickLinks` array:
- "Triage customer feedback and find error groups" → `#feedback-triage`
- "Review and approve a change request" → `#change-requests`
- "Edit an email template safely" → `#email-templates`
- "Send a batch marketing email" → `#email-batch-send`
- "Manage the early-access lead pipeline" → `#early-access-pipeline`

---

## Task list

### A — SOP content (`lib/help-content/platform-admin.tsx`)

- [ ] **A1 — Add "How to triage customer feedback" SOP** (group: "Support SOP", id: `feedback-triage`)
  - Cover: navigating to Feedback, the status lifecycle (new → triaged → acknowledged → resolved), using the "View related issue →" link to pivot to the error group, what to do when no `requestId` was captured (manual org slug correlation), audit-log note (status transitions are recorded with your email and timestamp), and the permission boundary (support: view-only; product/super_admin: write — if support cannot change status, they should flag the item for product via out-of-band escalation until F3 lands a formal escalation path).

- [ ] **A2 — Add "How to use the observability dashboard and resolve error groups" SOP** (group: "Support SOP", id: `observability-triage`)
  - Cover: what the dashboard shows (error rate, groups, freshness chip), how to read an error group detail (route, stack trace, sample events, first/last seen, occurrence count), the four status transitions (open → resolved / ignored / snoozed), when to resolve vs snooze vs ignore, and the permission boundary (support: view-only — Resolve/Ignore/Snooze are disabled; product/super_admin: write).
  - Note the "View-only for your role" message on the StatusControls as the expected UX for read-only access.

- [ ] **A3 — Add "How to review and action change requests" SOP** (group: "Product SOP", id: `change-requests`)
  - Cover: where requests originate (Plans & Pricing catalog flow, or billing-initiated), the draft → needs_review → approved → implemented lifecycle, which request types auto-apply on approval vs. require a manual Stripe action, the safe-harbour checklist for price changes ("verify Stripe ID before applying"), and a note that Change Requests also appear as a tab inside Plans & Pricing.

- [ ] **A4 — Add "How to edit email templates safely" SOP** (group: "Product SOP", id: `email-templates`)
  - Cover: template categories (auth/billing/tournament = transactional triggered on customer action; system = internal; marketing = growth-owned), variable token syntax (`{{variable_name}}`) and the consequence of breaking a token (the email renders the literal `{{variable_name}}` instead of the value), the test-send-before-save discipline (use the Test Send button and verify the email in an inbox before saving), an approval note ("copy changes to transactional templates that go directly to customers should be reviewed with the product owner before saving"), and how to reset to the built-in default.

- [ ] **A5 — Add "How to send a batch marketing email" SOP** (group: "Growth SOP", id: `email-batch-send`)
  - Cover: who has authority to trigger a send (growth role and product role; billing and support do not), pre-send review steps (confirm the audience scope shown in "Founding Season Orgs / Active Recipients", verify the correct per-email recipient count not the total, preview the email before sending), the irreversibility of a send (emails cannot be recalled once triggered), using the confirm-send modal (recipient count, subject line, warning — read these before confirming), and what to do if a send partially fails (check Send History for per-batch delivery data).

- [ ] **A6 — Add "How to manage the early-access lead pipeline" SOP** (group: "Growth SOP", id: `early-access-pipeline`)
  - Cover: the lead lifecycle (new → contacted → qualified → pilot → converted / not-a-fit / do-not-contact), how to update a lead's status and add outreach notes from the lead detail panel, the outreach copy templates (how to copy and personalise the built-in templates), marking a lead converted (and what that does: links the lead to an org, records the conversion event), date-range filtering and export for pipeline reporting, and a note on the 100-lead display cap (export for full pipeline view when the list exceeds 100).

- [ ] **A7 — Expand "How to work with plans, pricing, and feature matrix changes"** (existing section `plans-pricing`)
  - Add a risk ladder: gating status → config limits (tournament/seat caps, trial days) → Stripe price IDs → feature matrix, in order of increasing customer impact and reversibility.
  - Add the recommended sequence: verify subscriber impact → create a change request → get approval → apply.
  - Add a Stripe price change checklist: confirm the price ID is from the correct Stripe environment (sandbox vs. live), check that no org is actively on a Stripe-managed subscription that would be broken by the swap before applying.
  - Add a "when to use which tool" matrix: Plans & Pricing (global changes) vs. Bulk Operations (multi-org exceptions) vs. org-level Entitlements override (single-org exception).

### B — Help Hub hub page (`app/platform-admin/help/page.tsx`)

- [ ] **B1 — Add "Product Operator" role-path card** to `rolePaths` array (see orientation section above for steps).
- [ ] **B2 — Add "Growth Operator" role-path card** to `rolePaths` array (see orientation section above for steps).
- [ ] **B3 — Add five net-new quick links** to `quickLinks` array (Feedback triage, Change Requests, Email Templates, Email batch send, Early Access pipeline — see orientation section for exact labels and anchors).
- [ ] **B4 — Update internalCards description** for "Platform Admin Operations" to mention the new surface SOPs: include "feedback triage, observability, change requests, email templates, early-access pipeline" in the card's `keywords` array and brief `desc`.

### C — Overview page (`app/platform-admin/page.tsx`)

- [ ] **C1 — Add first-login orientation banner** when `previousVisit === null`. Role-aware copy as per orientation section above. Dismissible via `localStorage`. Render above the Action Queue.
- [ ] **C2 — Add Action Queue role-context note** for non-billing roles when trial-ending or expired-override items are present. One conditional inline note: "These items require billing access — contact the billing team to action them."

---

## Files to edit

| File | Changes |
|------|---------|
| `lib/help-content/platform-admin.tsx` | Add 6 SOP sections (A1–A6), expand 1 existing section (A7) |
| `app/platform-admin/help/page.tsx` | Add 2 role-path cards (B1–B2), 5 quick links (B3), update internalCards desc (B4) |
| `app/platform-admin/page.tsx` | First-login orientation banner (C1), Action Queue role-context note (C2) |

No new files. No schema changes. No API routes.

---

## Out of scope

- **Permission changes for the support role** (whether support should get feedback-status write access) → owned by **F3 Support Seam / Feedback Triage**.
- **Silent-fail UX fixes** (disabled states, "requires X access" notes on controls) → owned by **F2 Least-Privilege UX Consistency**.
- **Escalation / assignment path** from support to product → owned by **F3**.
- **Growth analytics** (conversion rates, §13 funnel drill-down) → backlog (Theme F, THEME F Polish).
- **Nav IA restructure** ("System" group overloading, PA0-005) → backlog.
- **Email campaign generalisation** (beyond founding-season cohort) → product roadmap.
- **Plans & Pricing UI improvements** (Bulk Operations default action type, action-type hiding) → owned by **F2**.
