# Platform-Admin Operator SOPs + Day-One Orientation (F4) — PM Brief

> **Priority:** P2 | **Size:** Small–Medium (content authoring + light UI; no schema changes, no API routes) | **Status:** Scoped 2026-06-13

---

## What is the problem?

A new platform-admin hire — regardless of their role — cannot run a productive shift on day one from the screens alone.

The FieldLogicHQ platform console has grown significantly. Six major surfaces were added in the last two development cycles: the Feedback triage queue, the Observability / error tracking dashboard, the Change Requests approval workflow, the Email Templates editor, the marketing Email dashboard, and the Early Access lead pipeline. These are the newest and most-used tools in the console. None of them have a how-to guide.

At the same time, there is no "start here" moment when someone logs in for the first time. The dashboard shows a cross-role Action Queue — alerts for expiring trials and billing overrides — even when the logged-in employee has no billing access and cannot act on any of them. There is nothing on screen telling a new support rep, growth marketer, or product operator what their job surface is or where to begin.

The net effect: a support rep staring at the Feedback queue for the first time has no guide explaining what the statuses mean or what to do next. A product operator on their first shift has write access to email templates, change requests, and pricing changes — with no documented procedure for any of them. A growth marketer has zero SOP content for the two surfaces they were hired to manage (Early Access and Email). Every role leaves day one dependent on someone else explaining the tool.

The Help Hub is well-designed and genuinely useful — but it documents the old surfaces (password resets, billing overrides, org ownership transfers) thoroughly and the new ones not at all.

---

## What changes?

### New how-to guides for every net-new surface

Six new SOP sections are added to the internal Platform Admin Operations guide:

1. **How to triage customer feedback** — how to read the queue, move items through the status lifecycle, follow the link from a feedback report to the related error group, and what to do when the link is missing.
2. **How to use the observability dashboard** — how to read an error group (stack trace, affected orgs, occurrence count), when to resolve vs. snooze vs. ignore, and the permission boundaries between read-only (support) and write (product/super_admin).
3. **How to review and action change requests** — where requests come from, the approval lifecycle, which types auto-apply vs. require a Stripe action, and a safety checklist for price changes.
4. **How to edit email templates safely** — template categories (transactional vs. marketing), variable token syntax, the test-send discipline, and the approval expectation for customer-facing copy changes.
5. **How to send a batch marketing email** — who has authority to send, pre-send review steps, the irreversibility of a sent email, and what to do if a send partially fails.
6. **How to manage the early-access lead pipeline** — the lead lifecycle, how to update status and outreach notes, converting a lead to a customer, and pipeline export for reporting.

One existing section (Plans & Pricing) is expanded with a risk ladder and a step-by-step approval sequence, since it is the highest-stakes surface and currently has only four bullet points.

### New role-path cards on the Help Hub

Two role-path cards are added to the Help Hub landing page — the page employees see when they click Help:

- **Product Operator card** — maps the five core SOP sections a product hire needs in the order they would use them on a real shift.
- **Growth Operator card** — maps the Early Access pipeline and Email batch send SOPs, plus a link to the Overview's Growth tab for signal review.

Five new quick links are added alongside the existing shortcuts for common tasks: one each for the new SOPs.

### First-login orientation banner

When an employee logs into the platform admin console for the first time, a brief dismissible banner appears above the Action Queue. It is role-aware:

- Super admin sees a pointer to the full Platform Admin Operations SOP.
- Support sees a pointer to the Support SOP path.
- Product sees a pointer to the new Product Operator path.
- Growth sees a pointer to the new Growth Operator path.
- Billing sees a pointer to the Billing & Product SOP path.

The banner only appears once. After the employee dismisses it, it does not re-appear.

### Action Queue signposting for non-billing roles

When support, product, or growth employees see Action Queue items they cannot action (expiring trials, expired billing overrides), a one-line note appears: "These items require billing access — contact the billing team to action them." This removes the "am I supposed to handle this?" confusion a non-billing hire experiences today.

---

## Who benefits?

**New platform-admin hires** get a first-shift guide that did not exist before. They can understand their role surface, follow a procedure for each tool, and not mistake missing permissions for broken features.

**Existing operators** benefit from a searchable reference for the new tools. The Help Hub is already the go-to for account-level SOPs; it now covers the full console.

**The business** reduces onboarding time and the risk of consequential mistakes on high-stakes surfaces (email template edits that break transactional emails; batch sends to wrong audiences; pricing changes without verifying subscriber impact).

---

## What success looks like

- A new support hire can locate the Feedback triage SOP within their first five minutes and follow it without asking anyone.
- A new product hire arriving for a shift knows which five surfaces are theirs and has a procedure for each.
- A new growth hire sees a role-path card on the Help Hub that describes their job in the console before they even open Early Access.
- The Action Queue no longer shows unexplained alerts that non-billing roles cannot act on.

---

## What this is not

This project does not change permissions, fix silent API failures, or build new features. Those are F1 (API Hardening), F2 (Least-Privilege UX), and F3 (Support Seam). This project is documentation and a small first-login UI touch — the content layer that makes the rest of the console usable for people who are not yet experts.

---

## Size and risk

**Small–Medium.** All work is content authoring in `lib/help-content/platform-admin.tsx` (TSX content file, no schema) plus additions to two existing pages (`app/platform-admin/help/page.tsx` and `app/platform-admin/page.tsx`). No database migrations. No new API routes. No risk of breaking existing behaviour. The first-login banner uses a `localStorage` flag and an existing `previousVisit` hook — both are already in the page.

Estimated effort: one focused writing session for the six SOP sections (~1 day), plus a short coding session for the banner and quick-link additions (~half day).
