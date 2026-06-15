# Platform-Admin Operator Polish (F5) — PM Brief

**Priority:** P3 — low urgency, pick up opportunistically alongside F2–F4
**Companion plan:** [PLATFORM_ADMIN_OPERATOR_POLISH_PLAN.md](PLATFORM_ADMIN_OPERATOR_POLISH_PLAN.md)

---

## What this is

A grab-bag of smaller console refinements — each one shaves a small amount of friction from an operator's daily workflow, but none is a blocker. The audit found 68 findings across six roles; F1–F4 handle the security issues, the structural day-one failures, and the support-loop break. What's left is a list of "while I was in there" polish items: a menu in the wrong order, a number that doesn't link anywhere useful, a badge that exists on the list page but not the detail page, a date format that's inconsistent across surfaces.

## What operators will notice

- **Billing team:** The "Expired Overrides" count on the overview dashboard will actually drill through to a filtered orgs list instead of going nowhere. The Retention Queue gets urgency color-coding (red for past-deadline, amber for 3-day warning). Org detail tabs will be URL-addressable, so a link from Retention goes straight to the Billing tab instead of landing on Support. A Stripe deep-link appears next to the subscription ID.
- **All roles:** The Customer Users Actions menu is reordered to match the natural triage sequence (Reset Password first, Notes buried, destructive actions last). The §13 / League Starter badge that appears on the org list will also appear on the org detail page hero — so operators investigating a specific org don't have to go back to the list to check.
- **Growth:** The Early Access pipeline defaults to the `new` leads view. The founding_welcome email preview shows real sample names instead of `[First Name]` placeholders. The per-email recipient count in the confirm-send modal will be accurate instead of showing the global total for every email.
- **Super admin:** The "System" nav group gets restructured into "Support & Diagnostics" and "Governance" so the two diagnostic surfaces (Feedback, Observability) aren't buried alongside audit logs and email templates. "Email" and "Email Templates" get clearer names to avoid the one-word confusion.
- **Read-only observers:** The MetricSnapshotButton is hidden (it's the only accidental write this role could complete). The Billing tab collapses to a read-only summary instead of showing a form full of disabled fields.
- **Everyone:** Date format drift across the console is cleaned up — absolute dates for older records, relative for recent ones, applied consistently.

## Why it's P3 and not higher

None of these individually block a role from doing their job. They are friction reducers, not unlocks. The real day-one blockers (silent 403s, no SOPs, broken support loop) are in F1–F4. These items improve the experience for people already using the console — not for people who can't use it at all.

## How to approach it

Pick items off opportunistically when touching a related file. Most items are under an hour. A handful (nav IA restructure, date-format sweep) are a few hours each and are better batched. The plan groups items by theme and labels each by effort (XS/S/M). There is no dependency between groups except: URL-addressable org tabs (Group D) should land before the Retention Queue deep-link (also Group D), and the nav group restructure (Group G) should land before the header-kicker updates that depend on it.

## Out of scope for this project

- Growth analytics / conversion funnel dashboard — noted in the plan as a future project, not built here.
- Anything owned by F1 (API guards), F2 (UX consistency / role gating), F3 (support seam), or F4 (SOPs + orientation).
