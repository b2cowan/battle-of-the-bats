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

---

# PM Brief — Phase 3: In-App Feedback Widget & Triage Queue

**Added:** 2026-06-10 · **Status:** Proposed (awaiting owner go-ahead) · **Priority:** High · **Est:** 1.5–2 days
**Depends on:** Phase 1 (capture core — BUILT; provides the `error_groups`/`error_events` a bug report can deep-link to). **Independent of Phase 4** — the two phases don't depend on each other.
**Owner decisions locked 2026-06-10:** best-effort requestId auto-link (header from the single server mint site + a tiny client stash) · **text-only** (screenshots deferred) · mount on **authenticated app surfaces only** (admin + coach + scorekeeper/check-in; public deferred) · confirmation email to a signed-in submitter + an **awaited** admin-notify · **1 submission/user/hr** (+ IP throttle for the anonymous path) · six route-defaulted categories. **No database migration** — the table already exists.

## In one sentence

Phases 1–2 let *us* see and triage the errors the app catches; Phase 3 is the **customer-facing half** — a one-tap **"Send feedback"** button so org admins, coaches, and scorekeepers can report a bug or request a feature without leaving the app, plus a **platform-admin queue** to triage what they send (with bug reports auto-linking to the underlying captured error wherever we can).

## What end users see and do differently (surface by surface)

Today there is **no in-app feedback mechanism anywhere** — a help-surfaces audit found none, and coaches don't even have a Help link. After Phase 3:

### 1. The "Send feedback" launcher
A small **"Send feedback"** control appears on the surfaces people already use:
- **Admin** — in the desktop sidebar footer next to the existing **Help** link, and in the mobile bottom-nav **"More"** menu.
- **Coach portal** — the coach portal gains **both** its first-ever **Help** link *and* the feedback control (it has neither today).
- **Scorekeeper & check-in** — a lightweight feedback button in the header, beside Sign Out.

### 2. The feedback dialog
Clicking the launcher opens a small dialog in our standard modal look (the same dark "HUD" shell as our other dialogs):
- **Type** — three pills: **Bug** / **Feature** / **Feedback**.
- **Category** — a dropdown (Tournaments / Coaches / Registrations / Accounting / Billing / Other), **pre-selected from the page they're on** (e.g. opening it inside a tournament defaults to "Tournaments").
- **Title** — a one-line summary.
- **Description** — the only required field; everything else can be left as-is.
- Submit → an on-screen **"Thanks — we've got it"** confirmation. A signed-in user also gets a confirmation email.

### 3. What's captured automatically (no user effort)
The report quietly attaches the **page/route** they were on, their **role**, the **app version**, and — when available — the **ID of the exact server error they just hit**, so a "this is broken" report can jump straight to the captured stack trace in our dashboard. Personal data is **scrubbed before anything is stored**.

## What WE (platform-admin) see and do differently

A new **"Feedback"** item appears in the platform-admin left-nav **System** group (a speech-bubble icon, next to Observability). It opens a **triage queue**:
- A **filterable, paginated table** of every submission — a **type** badge (bug/feature/feedback), the **category**, a **status** badge, the originating **org** (a link, or "Platform / anonymous" for org-less/public), the **title**, and the **date**.
- **Filters** for type, category, and status, plus **CSV/XLSX export** of the filtered set (same export pattern as the Audit Log).
- Each row moves through a **status lifecycle: New → Triaged → Acknowledged → Resolved** (deliberately distinct from the error-issue lifecycle). Changing status stamps who triaged it and when, and writes a **platform audit-log** entry — the same accountability as every other platform-admin action.
- A bug submission that carries a linked error shows a **"View related issue"** button that deep-links into the Observability issue detail.

## Why it matters

- **We finally hear from customers in-product.** Today bugs/requests arrive by email or not at all; Phase 3 funnels them into one triage queue with full context attached.
- **Bug reports become actionable instantly.** "X is broken" can arrive pre-linked to the captured error and stack trace — no back-and-forth to reproduce.
- **Coaches get a Help link for the first time** — closing a known gap in the coach portal.
- **A product signal.** Aggregated, categorized, exportable feature requests tell us what customers actually want next.

## Role-based access (who can submit vs. who can triage)

- **Submit:** any org admin, coach, or scorekeeper (and, when later enabled, anonymous/public visitors). Submitting is open and additive.
- **See the triage queue:** **platform-admins only** — the `feedback_submissions` table is platform-admin-only (RLS-enabled, no policies; never exposed to org users). Feedback **reuses the existing `observability` access area** (no new permission): **view** = super_admin / product / support; **change status** = super_admin / product; **support is view-only** (the status control is locked and the API rejects their writes), exactly like the Observability dashboard.

## What this phase deliberately does NOT do

- **No screenshots/attachments** — text-only (bug/feature/feedback). Image upload needs a Storage bucket + signed URLs + an image-PII review; deferred to a later phase.
- **No org-scoped feedback view** — there is one platform-admin queue, not a per-org inbox (locked decision); org admins don't see others' or even their own submissions listed.
- **No public/fan-site mounting yet** — authenticated app surfaces only in v1 (the table already allows anonymous rows, so public surfaces can be added later with no schema change).
- **No new database table or migration** — `feedback_submissions` already exists (shipped in migration 118, Phase 1).
- **No in-app notification bell** — the admin-notify is an email to `ADMIN_EMAIL`; the org-less platform-admin bell remains Phase 5.

## Decisions — ✅ locked 2026-06-10 (owner)

1. ✅ **Bug→error auto-link:** best-effort now — emit `x-request-id` from the single server mint site, a tiny client helper stashes the last-seen id, the widget attaches it. Coverage is limited to instrumented routes today and grows as more are wrapped; the widget works fully when no id is present.
2. ✅ **Screenshots:** deferred — text-only v1.
3. ✅ **Mount surfaces:** authenticated app surfaces only (admin sidebar + bottom-nav More · coach portal + new Help link · scorekeeper/check-in); public deferred.
4. ✅ **Emails:** confirmation to a signed-in submitter (fire-and-forget) + admin-notify to `ADMIN_EMAIL` (**awaited**, so serverless can't drop it).
5. ✅ **Rate limit:** 1 submission/user/hr signed-in; IP throttle (cloned from the Phase-1 error-capture route) for the anonymous path; body-size capped.
6. ✅ **Categories:** Tournaments / Coaches / Registrations / Accounting / Billing / Other, defaulted from the current route.

## Success criteria (Phase 3 is "done" when)

1. A signed-in coach/admin/scorekeeper can open "Send feedback" on each mounted surface, submit a bug/feature/feedback in under ~30 seconds, and see a success confirmation.
2. The submission lands in `feedback_submissions` with route/role/app_version context attached and PII scrubbed.
3. A bug submitted right after hitting a captured 5xx (on an instrumented route) carries the requestId, and its triage row shows a working "View related issue" deep-link to the matching Observability issue.
4. A platform admin opens **/platform-admin/feedback**, filters by type/category/status, exports CSV/XLSX, and moves an item New→Triaged→Acknowledged→Resolved — each change audit-logged.
5. A **support** user sees the queue but the status control is disabled and a direct status API call as support is rejected (403).
6. The unauthenticated path is rate-limited + size-capped + PII-scrubbed and can't be abused; `ADMIN_EMAIL` is notified on submit; a signed-in submitter gets a confirmation email.
7. Static checks pass (typecheck + focused lint), unit tests cover the `/api/feedback` validation + rate-limit gate, the dev server restarts clean (login 200, no Supabase EACCES), and the diff passes an adversarial review before hand-off.

**Status: Proposed — awaiting owner go-ahead. No code until approved. All six product decisions locked 2026-06-10; no migration needed (table sealed in 118); reuses the existing `observability` platform area. Detailed build plan = §15 of the implementation plan.**

---

# PM Brief — Phase 4: Rollup, Retention & Critical-Error Alerts

**Added:** 2026-06-10 · **Status:** ✅ BUILT & LIVE 2026-06-10 (four decisions locked by owner; **mig 122 applied to dev AND prod**; per-branch `OBSERVABILITY_ENV` console vars set by owner; awaiting owner browser pass) · **Priority:** High · **Est:** 0.5–1 day
**Depends on:** Phase 1 (capture — BUILT) + Phase 2 (dashboard — BUILT, commit `962c0cd`). Phase 3 (feedback widget) is independent and not blocked by this.
**Pre-build design review:** a 3-agent adversarial verification pass (live database probes, official-docs fact-check, repo integration check) ran on this design *before* sign-off; 1 blocking + 7 should-fix findings are already folded into the scope below. The scheduler's availability was confirmed live on both databases — it is a fact, not an assumption.

## In one sentence

Phases 1–2 record every failure and give us a screen to triage them; Phase 4 makes the system **self-maintaining and proactive** — the database now cleans up after itself on a schedule, the dashboard chart gets its proper fast data feed, and a brand-new critical failure **emails us the moment it first happens** instead of waiting for someone to open the dashboard.

## What changes operationally (plain language)

1. **The database starts doing housekeeping on a schedule.** Two automatic jobs run inside our own Postgres (no new external service):
   - **Every 5 minutes:** the raw traffic tallies are folded into the compact chart table the dashboard was designed to read. The "Calls vs Errors" chart gets faster and stays fast forever, because it now reads a small pre-aggregated table instead of recomputing from staging rows.
   - **Every night (~3–4 am Eastern):** old data is swept out — raw error occurrences older than 30 days are deleted (the grouped *issue* rows survive, so triage history is never lost), issues resolved more than 90 days ago are removed, chart data older than 1 year is trimmed, and **snoozed issues whose snooze expired are actually re-opened** (today they're only *displayed* as expired; nothing flips them back).
   - Each run stamps a heartbeat. The dashboard's freshness chip — which today says "Rollup not yet enabled (Phase 4)" — automatically switches to "**Last rollup N min ago**" and turns amber if a job silently stops **or keeps failing** (the pre-build design review caught that the original chip would have stayed green while a job ran-but-failed; fixed in scope). The "orgs affected" number on an issue also stays consistent when old raw events are purged, instead of silently pointing at deleted rows.
2. **A manual "Run sweep now" backstop.** A super-admin-only API endpoint runs the exact same fold + cleanup on demand — useful if a scheduled job ever misbehaves, and it's audit-logged like every other consequential platform-admin action. *(We verified the scheduler **is available** on both our dev and prod databases, so this is a backstop, not the primary path.)*
3. **Critical errors now page us by email.** The **first time** a new critical-severity failure appears (payments, billing webhooks, login/signup, registration, org creation), an email goes to **fieldlogichq@gmail.com** with the error name, the route, which org was affected, and a direct link to the issue's detail page in platform-admin. It is deliberately **de-noised**: roughly one email per *distinct* issue — a thousand repeats of the same failure produce **one** email, not a thousand. We also email when an existing issue **escalates** to critical for the first time, and when a previously-resolved critical issue **comes back** (a regression). De-noising caveat (locked): across one resolve-then-recur cycle a regression can produce **at most two** emails — one for an in-week recurrence and one if it's still recurring after the 7-day auto-reopen window — never per-occurrence. Alerts fire only for **production** errors and only for **server-side** captures, and only when the production environment flag is **explicitly** set (so a dev-site deploy fails closed) — local dev noise and the public browser-error endpoint can never spam the inbox.
4. **One plumbing fix rides along (found by the pre-build design review).** The environment label our *deployed* branches stamp on captured errors was never actually passed through the build — so the dev-site deployment labels its errors "production" today and would have triggered production alerts. Phase 4 fixes the build config so only the real production site can page us. Visible side-effect: errors from the dev-site deployment will finally show under the dashboard's **Dev** toggle instead of Production.

## Who is alerted, and about what

- **Recipient:** fieldlogichq@gmail.com (the existing `ADMIN_EMAIL` used for admin notifications today). Expandable later; starting with one inbox keeps it dead simple.
- **What qualifies as "critical" (locked):** failures on payment/billing/webhook/checkout routes, auth (login/signup), tournament registration (`/api/register`), and **organization creation (`/api/org/create`)** — the routes where a silent failure costs money or strands/loses a customer.
- **What can never alert:** dev-environment errors, client/browser-reported errors (the public capture endpoint), and anything below critical severity. A per-hour safety cap also bounds worst-case email volume (e.g. a bad deploy creating many new critical issues at once).

## Why it matters

- **The dashboard becomes trustworthy long-term.** Without retention, the raw events table grows forever on the same database that serves customers. After Phase 4, storage is bounded and the chart is O(small) to render no matter how much traffic we get.
- **We find out about the worst failures in minutes, not days.** Today a critical production failure sits silently in the dashboard until someone looks. After Phase 4, the first occurrence of any new payments/auth/registration failure lands in the inbox with a one-click link to the full scrubbed detail.
- **Snooze finally means what it says.** "Snooze for 7 days" now actually re-opens the issue on day 7 instead of just being labelled "expired."

## What this phase deliberately does NOT do

- **No customer-facing change at all.** Org admins, coaches, scorekeepers, and the public see nothing different.
- **No new external services.** The scheduler is Postgres's own (`pg_cron`, confirmed available on both our databases); alerts use our existing Resend email stack.
- The §6 breakdown tiles (top routes / status codes / affected orgs) keep their existing "sampled beyond 5,000 events" behaviour — the sampling disclosure stays. Making those exact needs richer rollup dimensions and is a Phase 5 candidate, not Phase 4. (The headline **chart + error rate** do become rollup-backed and exact.)
- Feedback widget + triage page remain **Phase 3** (next after this, or before — they don't depend on each other).

## Decisions needed from the owner (recommended defaults in bold)

1. **Critical-route allowlist** — **keep the current three patterns (payments/billing/webhooks/checkout · auth/login/signup · /api/register) and add org-creation (`/api/org/create`)**, since a failed org signup is a lost customer. Or: keep exactly as-is / payments-only / custom list.
2. **Alert triggers** — **first-seen critical + first escalation to critical + a resolved critical coming back (regression)**, production + server-side only. Or: first-seen only.
3. **Recipients** — **fieldlogichq@gmail.com only** (current `ADMIN_EMAIL`). Or: an env-var list for multiple recipients.
4. **Retention windows** — **raw error occurrences 30 days · resolved issues 90 days after resolution · chart rollups 1 year · ignored issues + feedback kept indefinitely**; nightly sweep ~3–4 am Eastern. Confirm or adjust.

## Success criteria (Phase 4 is "done" when)

1. Within ~5 minutes of the migration landing on dev, the dashboard freshness chip reads "Last rollup N min ago" on its own, and the staging table is empty after each fold (chart totals unchanged before vs after — no double-counting, no gaps).
2. The nightly sweep provably deletes only out-of-window rows, re-opens expired snoozes, and stamps its heartbeat; a silently-failing job turns the chip amber within 15 minutes.
3. Forcing a brand-new critical error on a payments-pattern route produces **exactly one** email to ADMIN_EMAIL with a working deep-link to the issue detail; repeating the same error produces **zero** additional emails.
4. The manual sweep endpoint: super-admin runs it successfully (audit-logged); a support-role call is rejected.
5. A throwing alert/cron path can never break a customer request (same fire-and-forget discipline as Phase 1, unit-tested).
6. Static checks green; migration applied to **dev** with snapshots + data dictionary updated in the same commit; **prod apply only on explicit owner approval** — and flagged clearly: this migration adds no new tables, so the automatic prod-drift gate **cannot** detect it; the prod apply must be done deliberately before the code promotes to master.

**Status: ✅ BUILT & LIVE 2026-06-10 — all four decisions locked by the owner and implemented; mig 122 applied to dev AND prod (extension + cron jobs verified live on prod, anon execute denied); per-branch `OBSERVABILITY_ENV` console vars set in Amplify (prod=production, dev=dev), taking effect on next deploy. The code also fails closed if the var is unset, so a missing var cannot cause dev-deploy alert spam. Remaining: owner browser pass of the dashboard freshness chip.**
