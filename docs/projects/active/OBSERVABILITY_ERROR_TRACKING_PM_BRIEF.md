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

## Key decisions

**Decided 2026-06-09 (owner):** ✅ build **in-house** (no Sentry now); ✅ feedback is **platform-admin-only**.

**Still to confirm before the dependent phase:**
1. **Which errors count as "critical"** (drives who gets alerted) — e.g. auth, payments, data-integrity. *(before alerting, Phase 4)*
2. **pg_cron availability** on our Supabase plan (dev + prod), else use the manual sweep fallback. *(Phase 4)*
3. Retention window (30d proposed), write-storm caps, and the canonical dev/prod env signal. *(Phase 1)*

**Status: plan under owner review — no code to be written until the plan is approved.**

---

# PM Brief — Phase 2: Platform-Admin Observability Dashboard

**Added:** 2026-06-09 · **Status:** ✅ BUILT 2026-06-09 (awaiting owner browser verification) · **Priority:** High · **Est:** 2–3 days
**Depends on:** Phase 1 (capture core — BUILT 2026-06-09, errors are recording live on dev + prod).
**Owner decisions at sign-off:** 24-hour default chart window · **added the §6 breakdowns** (errors-by-route, status-code distribution, client-vs-server split, MTTR) · **included CSV/XLSX export**. Adversarial review (14 agents) folded into the build; the export was upgraded from current-page-only to the **full filtered set**.

## In one sentence

Phase 1 made the app **record** every server failure with full context. Phase 2 gives us the **place to look at and act on those failures** — a new "Observability" screen inside platform-admin where we can see how healthy production is, find the worst issues, read a scrubbed error detail, and mark an issue resolved / ignored / snoozed.

## What the platform admin sees and does differently (screen by screen)

Today there is **no screen at all** for production errors — the data is being captured into the database but no human-facing view exists. After Phase 2, a platform admin signs into platform-admin and sees a new **"Observability"** item in the left-nav **System** group (a warning-triangle icon, sitting near Audit Log). Clicking it opens:

### 1. The dashboard (top of the Observability page)
- **A "Calls vs. Errors over time" line chart** — two lines over a selectable time window (e.g. last 24 hours / 7 days), so we can see at a glance whether errors are spiking. *(Same hand-built chart style as the coaches' Budget-vs-Actual chart — no new charting library.)*
- **Four headline metric cards:** **Total errors**, **Error rate %**, **Open issues**, and **Affected orgs** — the "how bad is it right now" summary, reusing the existing platform-admin metric-card look.
- **A small "data freshness" chip** — e.g. "Last rollup 3 min ago." Until Phase 4 turns on the automatic 5-minute aggregation job, this chip will read "rollup not yet enabled," and the chart will compute its numbers live from the raw metrics instead. This is expected and handled gracefully — no broken/empty screen.
- **An environment toggle (Production / Dev), defaulting to Production** — so day-to-day we only see real customer-facing errors, but we can flip to Dev to inspect things captured from local/dev work.

### 2. The issue list (below the dashboard)
- A **filterable, paginated table of "issues."** An *issue* is one unique kind of error (e.g. "TypeError in /api/register") — a thousand repeats of the same failure collapse into one row with an occurrence count, instead of a thousand lines of noise.
- Each row shows: a **severity badge** (critical/error/warning/info, colour-coded), the **status** (open/resolved/ignored/snoozed), the **issue title**, the **route**, **how many times it's happened**, **how many orgs are affected**, and **when it was last seen**.
- **Filters** across the top (a simple "Filter" form like the existing Audit Log): severity, status, environment, route, org, and a free-text search. So we can answer "show me all open *critical* issues in production" in a couple of clicks.
- Clicking a row opens that issue's detail page.

### 3. The issue detail page
- A **header** summarising the issue: title, severity, status, first seen, last seen, total occurrences, affected-org count, route/method.
- A **small per-day occurrence sparkline** — a quick "is this getting worse or trailing off?" shape.
- A list of **recent real occurrences** (samples), each in an expandable card. Expanding one shows the **PII-scrubbed stack trace** and the **request context** (which org, which user role, request ID, status code, etc.) — enough to actually debug, with no raw secrets or personal data.
- **Triage action buttons: Resolve / Ignore / Snooze.**

### 4. The triage actions (what the buttons do)
- **Resolve** — marks the issue fixed; it drops out of the default "open" view. (If the same error recurs more than a week later, Phase 1's logic automatically re-opens it, so a regression won't stay silently "resolved.")
- **Ignore** — known-noise issues we've decided not to act on; hidden from the default view but not claimed as fixed.
- **Snooze** — "don't show me this until later" (a fixed duration, e.g. 24 hours or 7 days); it reappears in the open list when the snooze expires.
- Every one of these actions is **written to the platform audit log** (who did it, what changed), so triage decisions are accountable — same audit trail as every other consequential platform-admin action.

## Why it matters (customer & operational impact)

- **We can finally act on what Phase 1 captures.** Right now the data lands in a table nobody can see. Phase 2 is the difference between "we technically log errors" and "we actually run on-call."
- **Faster, prioritised fixes.** "What is the worst production issue right now and how many orgs does it hit?" becomes a one-screen answer, ranked — not a CloudWatch grep or a wait for a support ticket.
- **Less noise, more signal.** Grouping + resolve/ignore/snooze means a flood of one repeating bug is one triable row, and our list reflects *only what still needs attention*.
- **Accountable triage.** Resolve/ignore/snooze decisions are audit-logged, so there's a record of who decided an issue was handled.
- **Customer-invisible, by design.** This is an internal operations tool. Nothing changes for org admins, coaches, scorekeepers, or the public in Phase 2 — they benefit indirectly from faster fixes. (The customer-facing "Send feedback" widget is **Phase 3**, not this phase.)

## Role-based access (who can view vs. who can act)

A new **"observability" access area** is added to the platform-admin permission matrix:
- **View (can open the dashboard, list, and detail):** super_admin, **product**, **support**.
- **Act (can resolve/ignore/snooze):** super_admin, **product**.
- **Support is view-only** — they can investigate and read error detail to help a customer, but the triage buttons are **locked** for them (the existing "view-only for your role" treatment), and the action API rejects their writes server-side. No new permission plumbing — this reuses the exact same area/role mechanism every other platform-admin section uses.
- Roles **not** in the view list (billing, growth, read_only) don't see the nav item and are redirected away from the page — identical to how every other restricted area behaves.

## Priority & measurable success criteria

**Priority: High** — it's the payoff phase for Phase 1; without it the captured data is invisible.

Phase 2 is "done" when:
1. A permitted admin can open **/platform-admin/observability** and see the calls-vs-errors chart, the four metric cards, and the freshness chip render without error — including the graceful "rollup not yet enabled" state before Phase 4.
2. The issue list shows real captured issues and can be **filtered** by severity, status, env, route, org, and search, with working pagination.
3. Clicking an issue opens a detail page showing the header, occurrence sparkline, and **scrubbed** sample events (stack + context) — with no raw PII/secrets visible.
4. A product/super_admin can **resolve, ignore, and snooze** an issue; the list reflects the new status; and each action writes a **platform audit-log** entry.
5. A **support** user sees the same dashboard/list/detail but the triage controls are **disabled**, and a direct API call to change status as support is **rejected (403)**.
6. The **environment toggle** works and **defaults to Production**.
7. Static checks pass (typecheck + focused lint), the dev server restarts clean (login 200, no Supabase EACCES), and the change is reviewed (adversarial pass like Phase 1) before hand-off.

## Open product decisions (need the owner's call — recommended defaults in **bold**)

These are small and all have a sensible default; flagging them so the UX matches your intent:

1. **Default chart window** — **24 hours** (with 7-day and maybe 30-day options), or default to 7 days? *Recommend 24h default.*
2. **Snooze options** — fixed presets only (**24h / 3d / 7d**), or also a custom date picker? *Recommend fixed presets for Phase 2; add a picker later if wanted.*
3. **CSV export of the issue list** — include the existing platform-admin Export menu on the list now, or defer? *Recommend include (it's a cheap reuse), but happy to defer to keep Phase 2 lean.*
4. **Dashboard depth for Phase 2** — keep it to the four cards + one chart + issue list as scoped, or also add the richer breakdowns the plan's §6 lists (errors-by-route, status-code distribution, client-vs-server split, MTTR) now? *Recommend ship the scoped lean version first; add §6 breakdowns as a fast follow once we see real volume.*
5. **Feedback metrics on this dashboard** — the plan's §6 mentions feedback volume, but the feedback **feature** is Phase 3. *Recommend no feedback widgets on the Phase-2 dashboard; they arrive with Phase 3.*

**Nothing here blocks starting the build** — if you're happy with the bold defaults, Phase 2 can proceed on sign-off; otherwise tell me which to change.

## Verification note for the owner (testing on dev)

Errors are already being captured on dev. Because the dev Supabase project tags **localhost-captured** rows as `dev` and **dev-branch-deployed** rows as `production`, when you test locally you'll want to flip the dashboard's **environment toggle to "Dev"** to see the errors you generate on your machine. The Production default is correct for real operations; it just means localhost data hides under the Dev toggle. Final visual verification is yours to do in the browser.
