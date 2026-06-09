# PM Brief — Observability, Error Tracking & In-App Feedback

**Plan:** [OBSERVABILITY_ERROR_TRACKING_PLAN.md](OBSERVABILITY_ERROR_TRACKING_PLAN.md)
**Created:** 2026-06-09 · **Status:** Proposed (awaiting go-ahead) · **Priority:** High

## What we're building (plain language)

A **production health & feedback center inside platform-admin**. Today, when something breaks in the app, we find out only if a customer complains or if we manually grep CloudWatch logs — and errors carry no context about *who* hit them or *which org* they belong to. This adds three things:

1. **Automatic error capture.** Every server failure is recorded with the org it happened in, who triggered it, the page/endpoint, how severe it is, and whether it's prod or dev. Identical errors are grouped into one "issue" with a count, instead of a thousand separate noise lines.
2. **A platform-admin dashboard.** A "Total calls vs errors over time" chart, an error-rate gauge, how many orgs are affected, the top/newest issues, and a list we can filter by org, route, user, severity, and environment. We click an issue, read the (PII-scrubbed) detail, and mark it **resolved / ignored / snoozed**. New *critical* errors email us automatically.
3. **An in-app "Send feedback" button** for org admins, coaches, and scorekeepers to report **bugs and feature requests** without leaving the app. When a user reports a bug right after an error, the report is auto-linked to that exact captured error — so we can jump from "customer says X is broken" to the stack trace in one click.

## Why it matters

- **Faster, proactive fixes.** We see real production bugs as they happen, ranked by how many orgs are hit — not days later from a support ticket. Today there is *zero* error tracking.
- **Better support.** Every error gets a request ID a customer can quote; feedback and bugs land in one triage queue instead of email.
- **It fixes a live lie.** Our error screen currently tells users "this event has been logged automatically" — it logs nothing. This makes that true.
- **A product signal.** Aggregated feature requests tell us what customers actually want next.

## Customer / user impact

- **Platform admins (us):** a new Observability + Feedback section in platform-admin. View-only roles see it without edit controls.
- **Org admins, coaches, scorekeepers:** a new "Send feedback" entry point; coaches also finally get a Help link. Nothing they do breaks; the widget is additive.
- **End users in general:** more reliable app over time, and friendlier error handling. Error data is **never** visible to orgs — platform-admin only.
- **Privacy:** all data stays in our own Canadian Supabase (no new US error-vendor), with PII/minor-data scrubbed before storage. No new build-time tooling that could destabilize the Amplify pipeline.

## Build vs buy

Recommended **build in-house** (our own Postgres + platform-admin) rather than adding Sentry/a SaaS, because: (a) our Amplify build has already broken once from added tooling and Sentry adds build-time machinery to the same fragile spot; (b) data residency + consent-gated minor data make a US sub-processor a real privacy cost; (c) every piece has an existing in-repo pattern to copy. The design is intentionally a clean subset of the Sentry approach, so we can bolt Sentry on later for client-side stack maps/replay **without a rewrite** if we ever need it.

## Scope & sequencing

| Phase | Outcome | Effort |
|---|---|---|
| 1 | Errors start being captured + attributed; error screen actually logs | 1–2 d |
| 2 | Platform-admin dashboard: chart, metrics, filterable issues, triage | 2–3 d |
| 3 | In-app bug/feature feedback widget + triage queue | 1.5–2 d |
| 4 | Auto rollup chart data, retention purge, critical-error email alerts | 0.5–1 d |
| 5 (optional, deferred) | In-app admin notification bell + full route coverage + optional Sentry capture | 2–3 d |

**Total core (Phases 1–4): ~5–8 days.** Each phase ships independently.

## Success criteria

- 100% of wrapped-route 5xx errors are captured, grouped, and attributed to org/user/route within seconds.
- A platform admin can answer "what's the worst production issue right now and how many orgs does it hit?" in one screen.
- New critical errors trigger an email on first occurrence (de-noised — one alert per distinct issue, not per occurrence).
- Org admins / coaches / scorekeepers can submit a bug or feature request in-app; bug reports deep-link to the underlying error.
- No measurable latency added to API responses (capture is fire-and-forget); a throwing capture path can never break a user request.
- No PII or minor data (DOB) stored unredacted; nothing exposed to org-level users.

## Key decisions needed before build

1. **Confirm in-house vs Sentry** (recommended in-house).
2. **Which errors count as "critical"** (drives who gets alerted) — e.g. auth, payments, data-integrity.
3. **Feedback visibility** — platform-admin-only, or also let org admins see their own org's submissions?
4. **pg_cron availability** on our Supabase plan (dev + prod), else use the manual sweep fallback.
