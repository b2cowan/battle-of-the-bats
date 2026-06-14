# PM Brief — Platform-Admin Support Seam / Feedback Triage (F3)

> Plain-language brief for the product owner. Written for a non-engineer audience.
> Priority: P1 | Effort: Medium | Spun out of the Platform-Admin Employee Audit (Theme C).

---

## The problem in one sentence

Today, when a customer reports a bug or submits feedback, the support team — the people who actually talk to customers — can read that report but cannot do anything with it. The only way the issue gets resolved is if a product team member happens to find it independently.

---

## What is happening right now

When a customer clicks "Submit Feedback" or reports a problem, the submission lands in the **Feedback queue** inside the platform-admin console. If the error happened during a tracked user session, it is also linked to an entry in the **Observability** (error tracking) dashboard.

Support reps log in, find the feedback item, read the customer's description, and then hit a wall. The status field — which would let them mark the item as "triaged," "acknowledged," or "resolved" — is locked for their role. They cannot touch it. There is no button to assign the issue to someone on the product team. There is no way to flag that they have looked at it. The only thing a support rep can record is a note on the customer's user account, which is completely separate from the feedback item. The feedback item stays stuck at "new" indefinitely.

A product operator can resolve the loop — they have the necessary permissions — but they have no visibility into whether support has already looked at the item, and there is no in-console way for support to tell them about it. The result: items stay unactioned, work gets duplicated, and customer issues fall through the gap between two teams that have no in-console handoff mechanism.

On top of that, even product operators face unnecessary friction: every shift starts with a full mixed-status list instead of the "new items needing attention" view, and there is no reverse link from an error group back to the customer feedback that reported it — so looking up whether a customer complained about a specific error requires manually cross-referencing two separate pages.

---

## What changes after this project

### Support can actually triage

Support reps gain write access to feedback status. When a customer reports an issue, support can move it from "new" to "triaged" to mark that it has been acknowledged, and eventually to "resolved" when the issue is handled. Every status change is audit-logged with the rep's name and timestamp — there is a full record of who acted and when.

### Support can escalate to product

A new "Escalate" action on each feedback item lets a support rep flag the item for the product team when the issue needs engineering investigation. The item gets an "Escalated" badge on the list, and product operators can filter for escalated items specifically so nothing slips through.

### Product sees the full picture without switching tabs

The error group detail page gains a "Related feedback" panel showing any customer feedback submissions linked to that error. Instead of navigating to the Feedback page to search by org and timestamp, product can see at a glance whether customers have reported a specific error and how many.

### Both teams start on the right view

The Feedback page defaults to showing new (unactioned) items instead of everything at once. The Observability page defaults to showing open (unresolved) error groups. Both teams start their shifts on the view that tells them what needs attention, rather than having to re-filter on every login.

### Clearer signals when a link is missing

When a piece of feedback was not submitted during a tracked error session (so there is no automatic link to an error group), the feedback item now shows a clear note: "No error event linked — search Observability manually." The rep knows the link is not missing because something is broken; it was simply not captured.

---

## Why this matters for customers

Faster issue resolution. Right now a customer who reports a bug has no guarantee it will be seen by anyone who can act on it. After this project, the support team — who are responding to customer emails and tickets — can mark the issue as received and in progress, escalate to engineering when needed, and track it to resolution, all inside the same tool. The risk of an issue falling between teams is structurally removed.

---

## Who this affects inside the console

| Role | Before | After |
|------|--------|-------|
| Support rep | Can read feedback, cannot act on it | Can triage, escalate, and track feedback to resolution |
| Product operator | Can close the loop but starts with noisy lists; no visibility into what support has seen | Starts on actionable-only view; sees escalated items in one click; sees related feedback from any error group |
| All roles | Feedback → error link is one-directional | Reverse link added: error group → related feedback |

---

## Priority and success criteria

**Priority: P1.** The permission gap is a Blocker-severity finding — the support role cannot perform its primary function on the feedback surface. The friction items (default filter, reverse link) are medium-severity but high daily-frequency.

**Success looks like:**
- A support rep can complete a feedback triage cycle (new → triaged → escalated → resolved) entirely in the console without out-of-band workarounds.
- Escalated items are visible to product operators as a distinct filtered view.
- Product operators can navigate from an error group to related customer feedback in one click when a link exists.
- Both Feedback and Observability default to the actionable view on every page load.

**Key decision before work starts:** there is one policy question the owner must answer before any code is written — should "feedback triage" be a separate permission from "observability / error-group triage," or should support simply be added to the existing observability write permission? The plan recommends keeping them separate (so support can triage customer feedback but product stays the gatekeeper for resolving engineering error groups). The owner should confirm this before development begins.

---

## Size

Medium. The core permission fix is surgical (one route, one area definition, one page flag). The default filters are small. The reverse back-link requires a database query on an existing table. The escalation affordance is the largest piece — it adds two nullable columns, one API route, and UI in the feedback list. Total estimate: 1–2 focused development sessions for Phases 1–4; Phase 5 (copy) is under an hour; Phase 6 (optional customer-notification mailto) is a half-day at most.
