# Observability, Error Tracking & In-App Feedback — Implementation Plan

**Status:** **Phases 1 + 2 BUILT 2026-06-09** (on branch `feat/free-tier-coaches`, awaiting browser verification) · Phases 3–5 proposed
**Branch when built:** built on `feat/free-tier-coaches` (current working branch); commit/PR per branch policy
**Owner:** Platform / DBA + Platform-admin
**Created:** 2026-06-09
**PM brief:** [OBSERVABILITY_ERROR_TRACKING_PM_BRIEF.md](OBSERVABILITY_ERROR_TRACKING_PM_BRIEF.md)

> ### Phase 1 build log (2026-06-09)
> **Built & verified** (in-house, decision locked): migration **118** applied to **dev + prod** (RLS-enabled-no-policies, leak-verified) — 6 tables + `record_error_event` RPC + `obs_severity_rank` + partial index `idx_error_events_group_org`; `lib/observability/{env,request-context,fingerprint,redact,metrics,capture,with-observability,client,index}.ts`; `instrumentation.ts onRequestError` (global server-error safety net); `app/global-error.tsx` + `app/error.tsx` wired to a public IP-rate-limited `/api/client/error-capture`; `org-context` + `notifications` wrapped with `withObservability` (metrics), and `register`/`org/create`/`admin/teams`/`admin/games` call `captureError` in their catch blocks. **Verified:** typecheck clean · lint 0 errors · 13 unit tests pass · dictionary ratchet green (113 tables, new "Observability & Feedback" domain) · dev server restarted (login 200, no EACCES) · end-to-end capture + grouping (occurrence_count bump) + email-value scrubbing confirmed against the live dev DB.
> **Adversarial review (17-agent) fixes folded in:** rate limiter uses LRU eviction (not `.clear()`) + a spoofing-proof global cap; `distinct_org_count` recomputed only on stored events behind the partial index; metrics flush re-merges its snapshot on failure and advances `lastFlush` only after the attempt (no data-loss + lockout); email VALUES scrubbed from messages/stacks; sampling expression clarified to "every Kth after the cap".
> **Deploy gate — CLEARED:** migration 118 applied to **dev AND prod** 2026-06-09 (RLS-enabled, leak-verified: anon/authenticated see 0 rows). `OBSERVABILITY_ENV` set in Amplify (All branches=production + dev-branch override=dev). The code can now ship to `master` safely — it writes to tables that already exist in prod. **Pre-prod security catch folded in:** the tables were switched from RLS-disabled → RLS-enabled-no-policies after a check found prod grants `anon` the default `SELECT` on public tables (so RLS-disabled would have exposed `error_events` PII via the public REST API).
> **Known best-effort limitations (accepted for Phase 1):** request metrics are buffered in-process and flushed opportunistically — a flush failure re-merges and retries, but a hard container freeze can drop the final unflushed window (coarse metrics, acceptable); route-wrapping coverage is incremental (uncaught throws on un-wrapped routes are still caught globally by `onRequestError`, but per-route call counts only exist for wrapped routes).

> ### Phase 2 build log (2026-06-09)
> **Built & verified** (owner-approved scope: 24h default window + the §6 breakdowns + CSV export): the **platform-admin Observability dashboard** is live. New `'observability'` area in `lib/platform-areas.ts` (view: super_admin/product/support; write: super_admin/product) + `AlertTriangle` nav item in the System group. New server data module `lib/observability/dashboard.ts` (service-role reads via `supabaseAdmin`, `import 'server-only'` guard) powers: `app/platform-admin/observability/page.tsx` (env toggle defaulting **production** + Dev; 24h/7d/30d window; 4 MetricCards = Errors/Error-rate/Open-issues/Affected-orgs; **`CallsVsErrorsChart` pure-SVG cloned from `CumulativeChart`, NO recharts**; "last rollup" freshness chip that degrades to "Rollup not yet enabled (Phase 4)"; **§6 breakdowns** = top error routes, status-code distribution, client-vs-server split, all-time MTTR; filterable+paginated `error_groups` list with severity/status/env/route/org/search + full-dataset CSV/XLSX export route). `app/platform-admin/observability/[groupId]/page.tsx` detail (header, 14-day occurrence sparkline, sampled `error_events` in `CollapsibleCard` rows → redacted stack + context, **Resolve/Ignore/Snooze/Reopen** via the client `StatusControls`). `app/api/platform-admin/observability/[groupId]/status/route.ts` (`requirePlatformPermission('manage_product')` → mutate status + resolved_at/resolved_by/snooze_until → `writePlatformAuditLog('update_error_group_status')`); plus a read-gated CSV/XLSX export route `…/observability/issues/export`. Shared `MetricCard` extracted to `components/platform-admin/MetricCard.tsx` (Overview page now imports it — no duplication). **Verified:** `npm run typecheck` clean · `npm run lint:focused` clean · dev server restarted (login 200, no EACCES) · smoke: dashboard/detail 307-redirect when unauthenticated, status + export APIs return 403 unauthenticated. **Browser visual pass = owner's** (toggle env→**Dev** to see localhost-captured rows, since dev-project localhost data is tagged `dev`).
> **Adversarial review (14-agent) — 8 of 9 findings folded in:** sparkline day-bucketing off-by-one fixed (today's column was always empty + every day mislabeled); CSV export changed from current-page-only → **full filtered set** via a server export route; expired snoozes now count toward the "Open issues" KPI (nothing auto-reopens them until Phase 4) + an "expired" tag on the list/detail; MTTR relabelled "all-time" + ordered `resolved_at desc` before the 2000 cap; Affected-orgs "sampled" disclosure when the 5,000-event cap is hit; `import 'server-only'` guard added to the data module. (1 finding — sampled-sparkline magnitude — already disclosed in the chart title, no change.) `Date.now()`-in-render purity errors fixed by computing the snooze-expired flag in the data layer.

> This plan was produced from a 12-agent codebase investigation + build-vs-buy design pass. Every "VERIFIED" claim below was checked against live files/grep, not assumed. Decide column existence from live snapshots / `information_schema`, **never** from migration files (binding rule).

---

## 1. Goal

A **production + dev error-tracking and feedback "notification center"** surfaced in **platform-admin** that lets us:

- Capture API/server (and later client) errors with full attribution: **which org, who triggered it, which route, severity, env (prod vs dev)**.
- **Categorize / group / fingerprint** errors so a flood of identical failures collapses into one actionable "issue."
- Show **graphs of total calls vs errors over time** plus error rate, affected-orgs, top issues, MTTR, and more.
- Let platform admins **triage and act fast** (resolve / ignore / snooze), and get **alerted on new critical errors**.
- Give end users (org admin, coach, scorekeeper, public) an in-app **bug report + feature request** flow that deep-links a report to the underlying captured error.

## 2. Recommended architecture (build in-house, in our own Postgres)

**Decision: in-house Postgres + platform-admin UI — zero third-party error-SaaS at launch.** This is an "ownership-layer-only" build: capture, fingerprint/group, metrics, triage, alerting, and feedback all live in our own Supabase + platform-admin, reusing existing conventions verbatim.

### Why not Sentry / a SaaS (the runner-up)

1. **Amplify build fragility is documented.** A stray `pnpm-workspace.yaml` broke both dev+prod builds (commit `ad9dc66`, 2026-06-08); the build runs on pnpm@9. `@sentry/nextjs` adds `withSentryConfig()` to `next.config.ts` + build-time source-map upload + `SENTRY_AUTH_TOKEN` — a new moving part in exactly the pipeline that has already broken. The in-house path adds **zero build-time tooling and zero new runtime deps**.
2. **Data residency / PII.** FieldLogicHQ serves Canadian sports orgs and holds consent-gated **minor data** (`basic_coach_team_players` DOB). Shipping user email + org identifiers to a US error-SaaS is a net-new sub-processor relationship requiring privacy-disclosure work. Keeping everything in the org's own Supabase is the lower-risk default.
3. **Every layer has an exact in-repo precedent** (see §3–§8). New-primitive count and review surface are minimal.
4. **No edge-runtime tax.** VERIFIED: zero routes use `runtime='edge'`; Next API routes default to nodejs, so AsyncLocalStorage + `supabaseAdmin` work on every route.
5. **It fixes a real bug.** VERIFIED: `app/error.tsx` tells users "Event has been logged automatically" but the boundary logs nothing. This wire-up makes that true.

**The design is a deliberate clean subset of the Hybrid/Sentry approach** — same fingerprint/group model, same Postgres ownership tables. If client-side source-mapped stacks or session replay become must-haves later, swapping a Sentry capture SDK in behind `lib/observability/capture.ts` is **additive, not a rewrite** (Phase 5).

---

## 3. Data model (migration `118_observability.sql`)

> Next migration number is **118** (VERIFIED: max existing = 117). Re-confirm against the live `supabase/migrations/` folder at implementation time. All six tables: **RLS disabled, service-role only** (`supabaseAdmin`), matching the `email_sends` (100) / `platform_events` (053) posture. Each table carries the mandated COMMENT: *"Platform-admin only; RLS disabled intentionally — writes via supabaseAdmin; rows auto-purged, see DATA_DICTIONARY.md #retention-policy."*

| Table | Purpose | Key columns |
|---|---|---|
| **`error_groups`** | One row per distinct issue (fingerprint). The list/triage/drilldown unit. Status + severity live here so a "resolved" decision survives raw-event purge. Models `platform_events` low-cardinality shape. | `id` uuid pk, `fingerprint` text UNIQUE NOT NULL, `title`, `error_name`, `route`, `http_method`, `severity` CHECK(critical\|error\|warning\|info) default error, `status` CHECK(open\|resolved\|ignored\|snoozed) default open, `env` CHECK(production\|dev) default production, `first_seen_at`, `last_seen_at`, `occurrence_count` bigint default 0, `distinct_org_count` int default 0, `resolved_at`, `resolved_by`, `snooze_until`, `sample_stack` (redacted), `sample_context` jsonb |
| **`error_events`** | High-volume append-only log, one row per occurrence. Mirrors `email_sends` exactly. Raw rows auto-purged after 30d; sampled-after-cap when a single fingerprint floods. | `id` uuid pk, `group_id` uuid FK→error_groups ON DELETE CASCADE, `occurred_at`, `env`, `route`, `http_method`, `status_code`, `error_name`, `error_message`, `stack_trace` (redacted), `org_id` uuid FK→organizations ON DELETE SET NULL (nullable), `org_slug` (denormalized snapshot), `user_id`, `user_email`, `user_role`, `request_id`, `ip_address`, `user_agent`, `request_context` jsonb (redacted) |
| **`request_metrics_rollup`** | Coarse calls-vs-errors counters — the chart source. NOT one row per request. 5-min buckets, optional per-route/per-org (NULL = aggregate). Populated by pg_cron from staging. O(buckets). | `bucket_start` timestamptz, `env`, `route` (nullable=all), `org_id` (nullable=platform-wide), `call_count` bigint, `error_count` bigint, UNIQUE(bucket_start, env, coalesce(route,''), coalesce(org_id, zero-uuid)) |
| **`request_metrics_raw`** | Thin staging for periodic in-process call/error tally flushes (so we never insert a row per HTTP call). pg_cron folds → rollup every 5 min, then truncates. Candidate **UNLOGGED** to reduce WAL pressure. | `id` uuid pk, `flushed_at`, `env`, `route`, `org_id` (nullable), `call_count`, `error_count` |
| **`feedback_submissions`** | In-app bug/feature/feedback from org admin, coach, scorekeeper, public. `org_id` nullable (org-less Basic coaches + public allowed). Auto-attaches context so a bug report deep-links to the captured error. | `id` uuid pk, `org_id` uuid FK→organizations ON DELETE SET NULL (nullable), `user_id`, `user_email`, `submitter_name`, `type` CHECK(bug\|feature\|feedback), `category`, `title`, `body` NOT NULL, `status` CHECK(new\|triaged\|acknowledged\|resolved) default new, `severity` (admin-set, nullable), `context` jsonb (route/role/help_section/app_version/linked fingerprint+request_id), `created_at`, `updated_at`, `triaged_by`, `triaged_at` |
| **`observability_cron_heartbeat`** | Single-row freshness sentinel updated on every pg_cron run, so the dashboard can show "last rollup N min ago" and detect a silently-failed job (the #1 risk). | `job_name` text pk, `last_run_at` timestamptz, `rows_folded`, `rows_purged`, `status` (ok\|error), `error_detail` |

Plus an RPC: **`bump_error_group(fingerprint, severity, sample_stack, sample_context)`** — `INSERT … ON CONFLICT(fingerprint) DO UPDATE SET last_seen_at=now(), occurrence_count=occurrence_count+1`, and **re-opens** status if `resolved` + aged past a window (regression resurfacing — implemented in the RPC, not a trigger, to stay explicit and testable).

**Indexes:** `(env, last_seen_at desc)` and `(status, severity)` on groups; `(group_id, occurred_at desc)`, `(org_id, occurred_at desc)`, `(occurred_at)` on events — mirrors `email_sends` composite-time-desc convention.

---

## 4. Ingestion flow

### Server capture — `lib/observability/with-observability.ts`
`withObservability(handler, { route })` wraps exported `GET/POST/PATCH/DELETE` (**opt-in, hottest routes first**; a codemod can wrap the rest later). On entry it mints `requestId` (`crypto.randomUUID()`) and seeds **Node AsyncLocalStorage** (`lib/observability/request-context.ts`) with `{requestId, route, orgId?, userId?, orgSlug?, role?}` from the ctx the handler already resolves via `getAuthContextWithScope`/`getAuthContext` (VERIFIED these expose `user.id/email`, `org.id/slug`, `role`). Deeply-nested `lib/db.ts` calls can then `captureError()` without threading ctx.

On exit/throw, **two fire-and-forget writes via `supabaseAdmin`, neither awaited in the response path**:
- (a) increment an in-process per-worker counter, periodically flush call/error tallies into `request_metrics_raw` — **no row per HTTP call**.
- (b) on error/5xx only: `captureError()` → compute fingerprint → RPC `bump_error_group(...)` → INSERT one `error_events` row with redacted stack + context + denormalized `org_slug`.

Only true 5xx / unexpected throws become issues. The existing `unauthorized()`/`forbidden()` 4xx helpers are **not** touched, so auth/validation noise never pollutes the issue table.

> **Safety discipline:** all capture is wrapped in its own try/catch and never awaited — identical to `notify()` (VERIFIED swallow at `lib/notify.ts:271`) and `writePlatformEvent()`. A unit test asserts a throwing `capture()` never affects the wrapped handler's response.

### Client capture
`app/error.tsx` + a NEW `app/global-error.tsx` + a `window` error/unhandledrejection listener POST to **`/api/client/error-capture`** (public, IP-rate-limited ~1/sec/IP, body-size capped, `env='production'`, `org_id` from cookie if present, `source='client'`). Closes the "logged automatically" lie and adds client telemetry. `captureError()` also `console.error`s, so CloudWatch keeps working.

### Feedback
`FeedbackWidget` POST → **`/api/feedback`**. Validates via `getAuthContext` when present (org/user/role), or runs unauthed on public surfaces with IP throttle; rate-limited 1/user/hr. INSERT `feedback_submissions`, then fire-and-forget confirmation email to submitter + notification to `ADMIN_EMAIL` (fieldlogichq@gmail.com) via `lib/email.ts` `wrap()`/`sendEmail()` (VERIFIED exports present).

### Volume control
1. Keep 100% of errors but only flush call-count **tallies** in 5-min aggregates.
2. Per-fingerprint event cap — once a group exceeds N raw events in a window, keep bumping `occurrence_count` but store only every Kth raw row as a sample.
3. Staging→rollup fold runs in pg_cron every 5 min, then truncates `request_metrics_raw`.

---

## 5. Categorization (two-level: group + event)

- **Fingerprint** = `sha256(route + errorName + topNormalizedStackFrames)`, with numbers/UUIDs/numeric IDs stripped by a normalization regex, truncated to a stable 16-char hex (`lib/observability/fingerprint.ts`). Grouping/dedup happens **at write time, in Postgres**, via `UNIQUE(fingerprint)` + the `bump_error_group` RPC — no separate rate-limiter table.
- **Severity ladder** (on the group, CHECK): `critical | error | warning | info`. Default `error`; 5xx → error/critical (critical reserved for auth/payment/data-integrity routes via an allowlist in capture); client unhandled rejections → warning unless they crash render. Severity drives badge colour (existing `badge-*` classes) and the alert threshold.
- **Status lifecycle** (on the group, CHECK): `open → resolved | ignored | snoozed`. Lives on the group so it survives the 30-day raw purge. Resolved issues that recur after a window **re-open** (regressions resurface).
- **Attribution** columns enable filter-by-org / route / user / severity / env in the list (served from indexed `error_groups` + `error_events`, no joins thanks to denormalized `org_slug`). `distinct_org_count` answers "how many tenants are hit by this issue."
- **Fingerprint-tuning risk** is acknowledged: a unit-test fixture pins the normalization regex before the route-wrapping sweep.

---

## 6. Metrics surfaced

- **Total calls vs total errors** over a selectable window (5-min/hour/day buckets) — primary line chart, served from `request_metrics_rollup` (O(buckets)).
- **Error rate %** over time + current-window headline `MetricCard`.
- **Open issues** by severity (severity strip).
- **Affected orgs** — `distinct_org_count` across open issues + top-N most-affected (Link → `/platform-admin/orgs/[id]`).
- **New issues** last 24h / 7d.
- **Top issues** by `occurrence_count` and by recency.
- **Errors by route** and by **HTTP status_code** distribution.
- **Client vs server** error split (env + source).
- **Mean time to resolve** (resolved_at − first_seen_at) — triage health.
- **Feedback volume** by type/category over time + open-feedback backlog.
- **Cron freshness** — "last rollup N min ago" (catches a silently-failed job).

---

## 7. Platform-admin UI

- **Register area** in `lib/platform-areas.ts`: add `'observability'` to the `PlatformArea` union + `PLATFORM_AREAS` record `{ viewRoles: ['super_admin','product','support'], writeRoles: ['super_admin','product'] }`. Feedback shares the same area to keep the matrix lean.
- **Nav** under the **System** group in `PlatformAdminNav.tsx`: `Observability` (Icon: AlertTriangle) + `Feedback` (Icon: MessageSquare).
- **`app/platform-admin/observability/page.tsx`** — server component, `requirePlatformAreaView('observability')`, reads via `supabaseAdmin`. Top: **calls-vs-errors SVG line chart** (clone `CumulativeChart` from `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/page.tsx` — **NO recharts**, VERIFIED the SVG precedent exists) over a selectable window + `MetricCard`s + a "last rollup" freshness chip.
- Below: **filterable issue list** (`error_groups`) using the `audit/page.tsx` form-GET + searchParams + server-pagination pattern; filter chips for severity/status (`badge-*` + `filter-chip` CSS), inline filters for org/route/user/env. Each row → detail.
- **`app/platform-admin/observability/[groupId]/page.tsx`** — group header, per-day occurrence sparkline (hand-rolled SVG), recent `error_events` samples in `CollapsibleCard` rows (expand → `<pre>` redacted stack + context JSON), and **resolve/ignore/snooze** buttons → `POST /api/platform-admin/observability/[groupId]/status` (`requirePlatformPermission` → mutate → `writePlatformAuditLog`).
- **`app/platform-admin/feedback/page.tsx`** — triage table (type/category badges, org Link, title, date, status dropdown), status filters, `ExportMenu` CSV. A bug submission with a linked `request_id` renders a **"View related issue"** Link into the error_group detail.
- Styling stays in `platform-admin.module.css` conventions; reuse `MetricCard` + `HelpCallout`. Read-only roles see the dashboard with status controls locked per `isPlatformAreaReadOnly` — no new permission plumbing.

---

## 8. In-app feedback widget

The existing `components/FeedbackModal.tsx` is **confirmation/status only** (no form fields) — extend its visual shell into a real input form (`FeedbackWidget`), reuse its success display.

- **Fields:** Type pills (Bug / Feature Request / General Feedback); Category dropdown (Tournaments / Coaches / Registrations / Accounting / Billing / Other, context-defaulted from path); Title; Body (required); optional screenshot (Phase 3+, Supabase storage + signed URL).
- **Auto-captured (no user action):** current route, role, `help_section` if mounted from a help page, `app_version`, and **the last `requestId` the client saw from a 5xx** — so "report a bug" links straight to the captured `error_group`.
- **Mount points** (the help-surfaces audit found **no feedback mechanism exists**): a "Send feedback" control in `AdminChrome` near the Help link (`AdminSidebar` ~lines 168–173) + bottom-nav More; the `CoachPortalShell` nav gets **both** a Help link and the feedback control; scorekeeper/check-in get a lightweight feedback button. All three personas hit the same `/api/feedback` handler.

---

## 9. Privacy, isolation, retention

- **PII redaction** (`lib/observability/redact.ts`, runs BEFORE every write): strip Authorization/cookie/token headers, password-ish keys, and any DOB/contact fields by key name; truncate request bodies; keep only IDs + minimal email. Client-error bodies size-capped. **No raw secrets land in Postgres.**
- **Multi-tenant isolation:** `org_id` FK + denormalized `org_slug` snapshot (point-in-time forensic attribution; FK still resolves the live org). All six tables **RLS ENABLED with no policies** — `supabaseAdmin` (service_role) bypasses RLS; `anon`/`authenticated` get zero rows. **(Build note: the plan originally said "RLS disabled" to match `email_sends`; a pre-prod check found prod grants `anon` the default `SELECT` on public tables, so RLS-disabled would have leaked `error_events` via the public REST API — `email_sends` is safe only because it actually has RLS *enabled* live, contradicting its migration comment. Fixed to RLS-enabled + verified anon sees 0 rows on prod.)** Errors are **never** exposed to org users, only platform-admin. org-less/public/client errors store `org_id=NULL` → render as "Platform / anonymous."
- **Dev vs prod separation:** every row carries `env`. Belt-and-suspenders — data physically lives in separate Supabase projects (dev `fieldlogichq-dev` vs prod `qcttcboqysynwcdyghil`) **and** is tagged by `env`. Dashboard defaults to `production` with a toggle.
- **Retention** (pg_cron, documented in `DATA_DICTIONARY.md #retention-policy` + each table COMMENT): raw `error_events` purged after **30 days**; `error_groups` kept until resolved AND aged >90 days; `request_metrics_rollup` trimmed >1 year; `request_metrics_raw` truncated every 5 min; `feedback_submissions` kept indefinitely. The retention job updates `observability_cron_heartbeat`; a manual `/api/platform-admin/observability/sweep` fallback (super_admin-gated, idempotent) runs the same purge if pg_cron is unavailable on the tier.

---

## 10. Phased delivery (each phase independently shippable)

### Phase 1 — Capture core + schema (errors start being recorded) — *1–2 days* ✅ BUILT 2026-06-09
- ✅ `supabase/migrations/118_observability.sql` — 6 tables + `record_error_event` RPC (the actual name; supersedes the planning name `bump_error_group`) + `obs_severity_rank` + partial index, **RLS-enabled no-policies** + mandated COMMENTs; **applied to dev + prod** via `scripts/apply-migration-api.mjs`.
- ✅ `npm run refresh:snapshots` + `DATA_DICTIONARY.md` "Observability & Feedback" domain (6 `dict:table` anchors) + ratchet `'Observability & Feedback'` taxonomy entry + `npm run check:dictionary` green.
- ✅ `lib/observability/{env,request-context,fingerprint,redact,metrics,capture,with-observability,client,index}.ts`.
- ✅ `app/global-error.tsx` (new) + `app/error.tsx` wired + `/api/client/error-capture` (public, IP-rate-limited + global cap).
- ✅ `instrumentation.ts onRequestError` (Next-16-native global safety net — captures uncaught throws/RSC errors with zero route churn). Wrapped `org-context` + `notifications` with `withObservability`; `register`/`org/create`/`admin/teams`/`admin/games` call `captureError` in their catch blocks. (Broad route-wrapping for full metrics coverage = incremental fast-follow.)
- ✅ Unit tests (`tests/unit/observability.test.ts`, 13 cases — fingerprint grouping/normalization + redaction/email-scrub). Restarted dev server.

### Phase 2 — Platform-admin observability dashboard (triage UI live) — *2–3 days* ✅ BUILT 2026-06-09
- ✅ Registered `observability` area (`lib/platform-areas.ts`) + System-group nav item (`AlertTriangle`). NOTE: the Feedback nav item + triage page stay in Phase 3 — NOT built here.
- ✅ `observability/page.tsx` — SVG calls-vs-errors chart (`CallsVsErrorsChart`, cloned `CumulativeChart`, no recharts) + 4 `MetricCard`s + freshness chip + **§6 breakdowns** (errors-by-route, status-code distribution, client-vs-server split, all-time MTTR) + filterable+paginated `error_groups` list + full-dataset CSV/XLSX export.
- ✅ `observability/[groupId]/page.tsx` — detail, 14-day occurrence sparkline, sampled events in `CollapsibleCard` (redacted stack + context), Resolve/Ignore/Snooze/Reopen (`StatusControls`).
- ✅ `api/platform-admin/observability/[groupId]/status/route.ts` — `requirePlatformPermission('manage_product')`, mutate status (+ resolved_at/resolved_by/snooze_until), `writePlatformAuditLog`. Plus `…/observability/issues/export` read-gated CSV/XLSX route.
- ✅ Env toggle (production default) + 24h/7d/30d window + "last rollup" freshness chip (degrades gracefully pre-Phase-4). Shared `MetricCard` extracted to `components/platform-admin/`. Static checks + smoke verified; 14-agent adversarial review folded in.
- **Phase-2 follow-ups deferred to Phase 4 (cron):** auto-reopen of expired snoozes on recurrence (Phase 2 only counts them as open at read-time + flags them); exact (non-sampled) Affected-orgs/breakdown counts once `request_metrics_rollup` is folded.

### Phase 3 — In-app feedback (end users can submit bugs/features) — *1.5–2 days*
- `FeedbackWidget` modal (extends FeedbackModal shell, auto-context incl. last `requestId`).
- `POST /api/feedback` (org/coach/public variants share one handler, rate-limit 1/user/hr) → `feedback_submissions` + confirmation email + `ADMIN_EMAIL` notify.
- Mount points: AdminChrome/AdminSidebar + bottom-nav More, `CoachPortalShell` (+ add Help link), scorekeeper/check-in.
- `platform-admin/feedback/page.tsx` triage table + `/feedback/[id]/status` route (`writePlatformAuditLog`) + `ExportMenu` CSV.
- Deep-link a feedback bug submission to its related `error_group`.

### Phase 4 — Rollup, retention, alerting (chart populates + critical alerts fire) — *0.5–1 day*
- pg_cron enable + job 1 (*/5 min fold raw→rollup, truncate staging) + job 2 (nightly purge >30d, age out resolved >90d, trim rollups >1y) — dev then prod.
- `observability_cron_heartbeat` row each run + dashboard freshness chip.
- `/api/platform-admin/observability/sweep` manual fallback (super_admin-gated, idempotent).
- **Critical-error alerting:** on FIRST occurrence of a critical-severity fingerprint, fire-and-forget email to `ADMIN_EMAIL` via `lib/email.ts` (de-noised by unique-fingerprint upsert) — **NOT** the org-scoped bell (VERIFIED `notifications.user_id` is hard-bound to `auth.users` + `org_id NOT NULL`; platform_users are service-role rows outside `auth.users`).

### Phase 5 — DEFERRED / optional: in-bell platform-admin alerts + coverage sweep — *2–3 days (only if pursued)*
- `admin_notifications` (org-less) + `platform_admin_push_subscriptions` tables (migration 119+).
- `lib/admin-notify.ts` + `PlatformNotificationBell` org-less variant in the platform-admin shell.
- Codemod-assisted sweep wrapping remaining API routes; track wrapped-route coverage %.
- Optional Sentry-capture swap behind `lib/observability/capture.ts` if source-mapped client stacks / replay become required (additive, since this design is a clean subset).

---

## 11. Open decisions

**DECIDED 2026-06-09 (owner):**
- ✅ **Build in-house Postgres**, zero error-SaaS at launch (§2). Sentry remains a clean, additive future option (Phase 5).
- ✅ **Feedback is platform-admin-only** — one triage queue; not surfaced org-scoped to org admins. (`feedback_submissions` stays service-role/no-RLS like the rest.)

**Still open (resolve before the phase that depends on them):**
1. **Severity → critical allowlist** *(before Phase 4 alerting)* — which routes/error types are "critical" (auth, payments, data-integrity?). Needed before alerting fires, or critical alerts spam/miss.
2. **Write-storm caps** *(Phase 1)* — per-fingerprint event cap N (default ~50/hr) and sample-every-Kth K (default ~10); tune from real volume.
3. **Raw-event retention window** *(Phase 1/4)* — 30 days proposed; confirm against any incident-forensics/compliance need for Canadian sports orgs.
4. **`request_metrics_raw` UNLOGGED?** *(Phase 1)* — less WAL/IO on the shared primary, lost on crash (acceptable for a 5-min-flush staging table?).
5. **pg_cron availability on the current Supabase plan (dev + prod)** *(Phase 4)* — never used in this repo before (VERIFIED zero migrations reference it). If a tier lacks it, the manual `/sweep` becomes primary + needs an external scheduler.
6. **Screenshot attachments** *(Phase 3 vs later)* — needs a Supabase storage bucket + signed-URL flow + PII review of uploaded images.
7. **Critical-alert recipients** *(Phase 4)* — `ADMIN_EMAIL` only, or a configurable `platform_users` distribution? Start single.
8. **Canonical env signal** *(Phase 1)* — Amplify branch env var vs `NODE_ENV` vs explicit `OBSERVABILITY_ENV`. Pick one.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| pg_cron not enabled / silently fails → rollups stale, `error_events` unbounded | Enable in migration 118; heartbeat row each run; freshness chip on dashboard; manual `/sweep` fallback |
| Capture writes share the customer-serving primary; an error storm adds write/IO pressure | Per-fingerprint cap + sample-every-Kth; aggregate-only call counting via staging; UNLOGGED staging option |
| Capture-on-hot-path regression (an await leaks / wrapper throws) | Strictly fire-and-forget in its own try/catch (same as notify()); unit test asserts a throwing capture doesn't affect the response |
| PII / minor-data leakage into traces, bodies, IPs, emails | Redaction allowlist before write; 30-day raw retention; platform-admin-only/no-RLS; key-name DOB/contact scrubbing |
| Opt-in wrapping → incremental coverage; un-wrapped 5xx still only hit console.error | Wrap by traffic priority; track coverage %; consider a proxy.ts-level 5xx fallback later |
| Fingerprint mis-grouping; status-resurface rule could swallow regressions | Unit-test the normalization regex + ON CONFLICT behavior before the route sweep |
| Dictionary ratchet blocks the commit if snapshots+dict not updated together | Follow migration→snapshot→dictionary→check sequence; decide column existence from live snapshots, never migration files |
| Denormalized `org_slug` goes stale on org rename | Acceptable point-in-time forensic snapshot; FK still resolves live org; document intent |
| Public `/api/client/error-capture` + anon `/api/feedback` are unauthenticated write paths | IP rate-limit (~1/sec/IP errors, 1/user-or-IP/hr feedback), body-size caps, no PII echo |
| In-house build is ongoing engineering a paid tool amortizes | Accepted for zero SaaS spend, zero new build-time tooling (Amplify pnpm sensitivity), in-Canada data residency |

---

## 13. Conventions this plan reuses (do not duplicate)

- Auth/context: `lib/api-auth.ts` `getAuthContext(WithScope/WithRole)`, `unauthorized()`, `forbidden()`.
- Event/log table shape: `email_sends` (100), `platform_events` (053), `platform_audit_log` (018).
- Platform-admin: `lib/platform-auth.ts` `requirePlatformAreaView`/`requirePlatformPermission`, `lib/platform-areas.ts` matrix, `PlatformAdminNav.tsx`, `platform-admin.module.css`, `MetricCard`, `HelpCallout`.
- UI: `CollapsibleCard`, `ExportMenu`, `badge-*`/`filter-chip`/`btn-*` tokens in `globals.css`, `CumulativeChart` SVG pattern (NO recharts).
- Email: `lib/email.ts` `sendEmail()`/`wrap()`, `ADMIN_EMAIL`.
- Audit: `lib/platform-audit.ts` `writePlatformAuditLog()`.
- Migration flow: `scripts/apply-migration-api.mjs` (`--dev`/`--prod`) → `npm run refresh:snapshots` → `DATA_DICTIONARY.md` anchors → `npm run check:dictionary`, all in one commit.
