# Platform-Admin Employee Experience Audit — PM Brief

> **Companion plan:** [PLATFORM_ADMIN_EMPLOYEE_AUDIT_PLAN.md](PLATFORM_ADMIN_EMPLOYEE_AUDIT_PLAN.md)
> **Status:** Scoped, awaiting owner approval. **Created:** 2026-06-13.

## What this is, in one line

A role-by-role usability review of our **internal employee console** (`/platform-admin/`) — the tool our own support, billing, product, and growth staff use to run the business — answering one question: *can a new FieldLogicHQ hire, scoped to their role, do their job on day one without asking a colleague?*

## Why it matters

The platform-admin console is **internal employee tooling**, not a customer product — so it sits outside the customer-facing User Journey Audit. But it's grown fast: roughly a third of it (the error-tracking console, the customer-feedback center, the free-tier abuse instrumentation) is **brand new since the last review on 2026-06-04** and has never been checked for whether a real employee can actually use it. As we hire support and ops people, "the console is confusing and undocumented" becomes a direct cost in training time, mistakes on customer accounts, and slow support responses.

The one place this internal tool touches customers is the **support seam**: when a customer reports a problem, can a support rep *receive* that feedback, *find* the underlying error, *diagnose* it, *act*, and *close the loop*? That seam is the heart of this audit.

## What we'll learn (the deliverables)

- **One report per platform role** (super-admin, support, billing, product, growth, read-only) — what that employee can see and do, where they get stuck, and whether a day-one hire could be productive.
- A **prioritized fix list** — concrete, ranked improvements (clearer labels, missing how-to docs, surfaces that silently disappear so it's unclear whether you lack permission or something's broken, and any genuine gaps where an employee *can't finish their job*).
- A specific verdict on the **support seam**: can a support rep close the loop on a customer issue end-to-end within their permissions? (Early signal from the code: support can *see* feedback and errors but may not be able to *act* on them — we'll confirm.)

## Proposed functionality / scope

- **In:** every page of the internal console, walked as each of the six real employee roles, with a "brand-new hire, zero tribal knowledge" lens throughout; the employee side of the support seam (feedback + error tracking + change requests).
- **Out:** anything a *customer* sees or does (owned by the User Journey Audit); re-doing fixes already shipped on 2026-06-04; re-planning the timed-comps/trials feature (already has its own plan). **No code changes** — this is an evaluation that produces a backlog; fixes get approved and built as follow-on work.

## Expected customer impact

Indirect but real: a console our staff can navigate confidently means **faster, more accurate support**, fewer account-handling mistakes, and shorter onboarding for new hires — all of which customers feel as quicker, better-informed responses when something goes wrong.

## Priority & success criteria

- **Priority:** Medium-high. Rising as headcount grows and as the net-new support/observability surfaces start carrying real support load.
- **Success =** for each role we can answer "yes, a day-one hire could do this job from the screen alone" — or we have a specific, prioritized list of what's blocking that; **and** a clear yes/no on whether the support seam lets a rep close the loop.

## Rough size

About **3.5–4 working sessions** of multi-agent evaluation. Highest value concentrates on the support rep role and the net-new feedback/error-tracking surfaces. Findings become a ranked fix list for the owner to approve into follow-on projects.
