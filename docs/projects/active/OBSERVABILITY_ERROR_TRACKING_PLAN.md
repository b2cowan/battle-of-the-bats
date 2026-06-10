# Observability, Error Tracking & In-App Feedback — Implementation Plan

**Status:** **Phases 1 + 2 BUILT 2026-06-09 · Phase 4 BUILT 2026-06-10** (on branch `feat/free-tier-coaches`; **mig 122 applied to dev AND prod 2026-06-10** — owner-approved; extension + 2 cron jobs verified live on prod, anon execute denied) · **Phase 3 (feedback widget) detailed build plan in §15 — six decisions locked 2026-06-10, awaiting owner go-ahead** · Phase 5 proposed
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
| **`request_metrics_raw`** | Thin staging for periodic in-process call/error tally flushes (so we never insert a row per HTTP call). pg_cron folds → rollup every 5 min via an **atomic `DELETE … RETURNING` drain (NEVER `TRUNCATE`** — not MVCC-safe; would destroy rows committed after the read; see DATA_DICTIONARY). Stays LOGGED (open-decision 4 closed as built). | `id` uuid pk, `flushed_at`, `env`, `route`, `org_id` (nullable), `call_count`, `error_count` |
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
3. Staging→rollup fold runs in pg_cron every 5 min via an atomic `DELETE … RETURNING` drain of `request_metrics_raw` (never `TRUNCATE` — see DATA_DICTIONARY).

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
- **Retention** (pg_cron, documented in `DATA_DICTIONARY.md` + each table COMMENT): raw `error_events` purged after **30 days**; `error_groups` kept until resolved AND aged >90 days (`ignored` groups kept indefinitely); `request_metrics_rollup` trimmed >1 year; `request_metrics_raw` drained every 5 min via atomic `DELETE … RETURNING` (never `TRUNCATE`); `feedback_submissions` kept indefinitely. The retention job updates `observability_cron_heartbeat`; a manual `/api/platform-admin/observability/sweep` fallback (super_admin-gated, idempotent) runs the same fold+purge.

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
- → **Detailed build plan in §15** (all six product decisions locked 2026-06-10; awaiting owner go-ahead — no code yet).

### Phase 4 — Rollup, retention, alerting (chart populates + critical alerts fire) — *0.5–1 day* ✅ BUILT 2026-06-10
- ✅ pg_cron (mig **122**, applied **dev + prod 2026-06-10**) + job 1 (*/5 min fold raw→rollup via atomic `DELETE … RETURNING` drain) + job 2 (nightly 08:15 UTC: reopen expired snoozes, purge events >30d + recompute `distinct_org_count`, age out resolved groups >90d, trim rollups >1y, prune `cron.job_run_details` >7d). See §14 for the full build + adversarial-review fold-ins.
- ✅ `observability_cron_heartbeat` row each run (success-only `last_run_at`) + dashboard freshness chip (fold-staleness >15m, sweep-staleness >26h, `status='error'` amber).
- ✅ `/api/platform-admin/observability/sweep` manual fallback (super_admin-gated via the promoted `requireSuperAdmin`, idempotent, audit-logged).
- ✅ **Critical-error alerting:** `lib/observability/alerts.ts` emails `ADMIN_EMAIL` on first-seen / escalation / regression of a critical fingerprint (de-noised by the RPC's atomic transition flags), **server-source + explicit-production only** (fail-closed), **awaited** (not detached — Lambda-freeze-safe), per-worker hourly cap. **NOT** the org-scoped bell (`notifications.user_id` hard-bound to `auth.users` + `org_id NOT NULL`; platform_users live outside `auth.users`).

### Phase 5 — DEFERRED / optional: in-bell platform-admin alerts + coverage sweep — *2–3 days (only if pursued)*
- `admin_notifications` (org-less) + `platform_admin_push_subscriptions` tables (migration 119+).
- `lib/admin-notify.ts` + `PlatformNotificationBell` org-less variant in the platform-admin shell.
- Codemod-assisted sweep wrapping remaining API routes; track wrapped-route coverage %. **→ Pulled forward + formalized as its own plan: [OBSERVABILITY_ROUTE_INSTRUMENTATION_PLAN.md](OBSERVABILITY_ROUTE_INSTRUMENTATION_PLAN.md)** (measured 2026-06-10: only 2 of 279 routes wrapped; 3 mechanisms = global requestId stamp + tranche wrapping + swallowed-500 capture). When that completes, mark this bullet done.
- Optional Sentry-capture swap behind `lib/observability/capture.ts` if source-mapped client stacks / replay become required (additive, since this design is a clean subset).

---

## 11. Open decisions

**DECIDED 2026-06-09 (owner):**
- ✅ **Build in-house Postgres**, zero error-SaaS at launch (§2). Sentry remains a clean, additive future option (Phase 5).
- ✅ **Feedback is platform-admin-only** — one triage queue; not surfaced org-scoped to org admins. (`feedback_submissions` stays service-role/no-RLS like the rest.)

**DECIDED 2026-06-10 (owner — Phase 4):**
- ✅ **Critical allowlist** = payments/billing/webhook/checkout · auth/login/signup · `/api/register` · `/api/org/create` (item 1).
- ✅ **Alert triggers** = first-seen critical + escalation-to-critical + critical regression (regressed/reopened flags) — production + server-source only (was item 7's sibling).
- ✅ **Recipients** = `ADMIN_EMAIL` (fieldlogichq@gmail.com) only, expandable later (item 7).
- ✅ **Retention** = raw events 30d · resolved groups 90d · rollups 1y · ignored groups + feedback indefinite · nightly 08:15 UTC (item 3).
- ✅ **Canonical env signal** = explicit `OBSERVABILITY_ENV` (NODE_ENV fallback for tagging only; **alerting fails closed unless OBSERVABILITY_ENV is explicitly `production`**, plumbed through `amplify.yml`) (item 8).
- ✅ **`request_metrics_raw` stays LOGGED** — emptied every 5 min, UNLOGGED's crash-loss isn't worth it (item 4).

**Still open (later phases):**
2. **Write-storm caps** — per-fingerprint event cap 50 + sample-every-10th shipped in Phase 1; tune from real volume.
6. **Screenshot attachments** *(Phase 3 vs later)* — needs a Supabase storage bucket + signed-URL flow + PII review of uploaded images.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| pg_cron not enabled / silently fails → rollups stale, `error_events` unbounded | Enabled in migration **122**; success-only heartbeat row each run; freshness chip (fold >15m / sweep >26h / `status='error'` → amber); manual `/sweep` fallback |
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

---

## 14. Phase 4 detailed build plan — ✅ BUILT 2026-06-10 (owner-approved; mig 122 applied dev + prod)

**PM brief:** Phase 4 section in [OBSERVABILITY_ERROR_TRACKING_PM_BRIEF.md](OBSERVABILITY_ERROR_TRACKING_PM_BRIEF.md). **Next migration number: 122** (verified max existing = 121).

> **Pre-build adversarial design review (2026-06-10):** a 3-agent verification workflow (hostile PG-17 SQL reviewer with live-dev probes · Supabase/pg_cron web fact-checker · repo integration-claims skeptic) produced 27 findings — 1 blocking + 7 should-fix, **all folded into the design below**; the remainder empirically CONFIRMED the core mechanics (ON CONFLICT arbiter against the expression index, data-modifying-CTE fold + `SELECT … INTO`, exception-handler heartbeat survival, single-transaction Management-API apply, `cron.schedule` named upsert, jobs-run-as-postgres + BYPASSRLS, GMT schedules, no plan gating, no-self-overlap of a job). Key folded fixes are marked **[review]** below.

### Verified facts this design rests on (probed live 2026-06-10)

- **pg_cron 1.6.4 is available on BOTH dev and prod** (PG 17.6; `installed_version` null on both — `create extension` needed). `pg_net` also available (not needed).
- **`postgres` has `rolbypassrls = true` on both projects and owns the observability tables** (`error_groups` owner = `postgres`, no FORCE RLS) → cron jobs scheduled as `postgres` bypass the RLS-enabled-no-policies posture; the `/sweep` route calls the same functions as `service_role` (also BYPASSRLS). No policies needed.
- Dashboard chart (`lib/observability/dashboard.ts` `getDashboardData`) already **sums `request_metrics_rollup` (by `bucket_start`) + `request_metrics_raw` (by `flushed_at`)** into the same client-side buckets → an atomic fold-and-delete leaves zero overlap, no dashboard change needed.
- Freshness chip (`observability/page.tsx`) reads ALL `observability_cron_heartbeat` rows, shows the most recent, **amber when > 15 min** — two job rows (5-min fold + nightly sweep) work as-is; the fold row dominates "most recent."
- `lib/email.ts` exports `sendEmail(to, subject, html)`, `ADMIN_EMAIL` ('fieldlogichq@gmail.com'), `SITE_URL` — the alert email needs nothing new.
- Metrics staging flushes ~every 60 s / 200 calls per worker (`lib/observability/metrics.ts`); dev has live pending raw rows, prod staging is empty (Phase-1 code not yet on master) → prod cron jobs no-op harmlessly until promote.
- `record_error_event` currently `returns uuid`; insert path sets `occurrence_count = 1`, conflict path always increments → **`v_count = 1` ⟺ brand-new group** (no schema change needed to detect first-seen).

### 14.1 Migration `122_observability_phase4.sql` (applied **dev + prod 2026-06-10**)

1. `create extension if not exists pg_cron;` + **[review]** the two grants Supabase's own install doc ships (`grant usage on schema cron to postgres; grant all privileges on all tables in schema cron to postgres;` — idempotent, required for the non-superuser `postgres` role; don't assume the dashboard toggle ran them). The extension pins itself to `pg_catalog`; job objects land in the `cron` schema either way.
2. **`public.obs_fold_metrics() returns jsonb`** — single atomic statement: `WITH moved AS (DELETE FROM request_metrics_raw RETURNING …), agg AS (SELECT to_timestamp(floor(extract(epoch from flushed_at)/300)*300) AS bucket_start, env, **coalesce(route,'') AS route, coalesce(org_id,'0000…0000'::uuid) AS org_id**, sum(call_count), sum(error_count) … GROUP BY 1,2,3,4), ins AS (INSERT INTO request_metrics_rollup … SELECT … FROM agg ON CONFLICT (bucket_start, env, coalesce(route,''), coalesce(org_id,'0000…0000'::uuid)) DO UPDATE SET call_count = rollup.call_count + excluded.call_count, error_count = … RETURNING 1) SELECT counts INTO …`. The ON CONFLICT arbiter matches the existing expression unique index `idx_request_metrics_rollup_bucket` exactly (live-verified on dev, both insert + update paths). **[review] The agg keys are pre-normalized with the same `coalesce` as the index** — without this, a NULL route next to an `''` route in one bucket raises SQLSTATE 21000, the exception handler rolls the DELETE back, and the same poison rows re-fail every run forever (empirically reproduced); normalizing eliminates the class. The **cron command** (not a function-level GUC, which can't bound the already-started outer statement) prefixes `SET statement_timeout = '120s';` so a hung scheduled run can't hold its pg_cron slot indefinitely — note the manual `/sweep` route therefore runs without that bound (rare super-admin action, accepted). **[review] Heartbeat semantics: `last_run_at` is bumped ONLY on success** — the exception handler upserts `status='error'` + `error_detail` *without* touching `last_run_at`, so persistent failures surface as chip staleness (>15 min) instead of a false-fresh green chip; never raises.
3. **`public.obs_retention_sweep() returns jsonb`** — in order: (a) **reopen expired snoozes**: `UPDATE error_groups SET status='open', snooze_until=null WHERE status='snoozed' AND snooze_until < now()` (closes Phase-2 deferred item *a*); (b) purge `error_events` older than **30 d** — **[review] via `DELETE … RETURNING group_id` in a CTE, then recompute `distinct_org_count` for exactly the affected groups in the same statement** (the `idx_error_events_group_org` partial index keeps it cheap) so the count is never stale-high against deleted rows; its meaning is now consistently "distinct orgs among retained events" (dictionary + UI label updated to match); (c) delete `error_groups` with `status='resolved' AND resolved_at < now() - interval '90 days'` (FK cascades their events; **ignored groups are kept indefinitely** — they are deliberate decisions); (d) trim `request_metrics_rollup` older than **1 year**; (e) **[review]** purge `cron.job_run_details` older than **7 d** (pg_cron never auto-cleans it — unbounded growth otherwise). Heartbeat `job_name='retention_sweep'` (rows_purged = total), same success-only `last_run_at` + exception discipline.
4. **Schedule** (idempotent — `cron.schedule(name, …)` is a documented named upsert; caveat: it does NOT re-activate a job deactivated via `cron.alter_job(active:=false)`): `observability-metrics-fold` `*/5 * * * *` → `select public.obs_fold_metrics()`; `observability-retention-sweep` `15 8 * * *` (08:15 UTC ≈ 3–4 am Eastern; pg_cron schedules are GMT on Supabase, not user-changeable) → `select public.obs_retention_sweep()`. pg_cron never self-overlaps a job (queues a due run behind a running one). After apply, verify `select jobname, username, database from cron.job;` → 2 rows as `postgres`.
5. **`record_error_event` return change** for alerting: `DROP FUNCTION` (full 20-param signature; `CREATE OR REPLACE` cannot change a return type — DB-side clean: zero other dependents, default ACL only, PostgREST schema-reload event triggers verified present) → recreate `returns jsonb` = `{group_id, is_new, became_critical, regressed, reopened, severity, status}`. **[review] OLD values come from a pre-`SELECT` of the group by fingerprint; NEW values MUST come from the upsert's own `RETURNING id, occurrence_count, severity, status`** (a pre-SELECT alone can never observe the post-transition values — implemented literally it would leave `became_critical`/`reopened` always-false). Flags: `is_new` = `occurrence_count` returned 1 (live-verified ⟺ brand-new group; nothing ever resets the counter) · `became_critical` = new severity 'critical' AND old wasn't · `reopened` = old status 'resolved' → new 'open' (the >7 d auto-reopen) · **[review] `regressed`** = old status 'resolved' AND `old.last_seen_at <= old.resolved_at` (first recurrence since the resolve — fires once per resolution cycle, covering the silent ≤7 d window where 118 keeps the group 'resolved'). Pre-SELECT race window accepted (worst case = a duplicate alert email; the DB-level `is_new` from atomic ON CONFLICT stays exact). **Backward-compatible:** the deployed Phase-1 `capture.ts` destructures only `{ error }`, so the migration can land before the code everywhere.

**⚠️ Drift-gate blind spot:** migration 122 adds **no tables/columns**, so `npm run check:migrations` CANNOT detect prod missing it — which is why the prod apply was a deliberate manual step. ✅ **DONE 2026-06-10: applied to prod** (extension + 2 jobs + `record_error_event`→jsonb verified live; anon execute denied 42501; `check:migrations` green). **[review]** Belt-and-suspenders in code: `capture.ts` only enters the alert path when the RPC result is a non-null *object* — if prod code ever outruns the migration, the old uuid-string return silently skips alerting instead of throwing (capture itself keeps working).

### 14.2 Critical-error alerting (code)

- **🚨 [review — BLOCKING prerequisite] `OBSERVABILITY_ENV` is not actually plumbed:** `amplify.yml` echoes only seven server env vars into `.env.production` at build, and `OBSERVABILITY_ENV` is **not** among them — so despite the console var being set (All branches=production, dev override=dev), `observabilityEnv()` falls back to `NODE_ENV` and **both Amplify branches tag `env='production'`** (dev-branch deploys would both mis-tag their rows AND fire production alerts). **Fix ships in this phase:** add `- echo "OBSERVABILITY_ENV=$OBSERVABILITY_ENV" >> .env.production` to `amplify.yml` (and confirm the branch-scoped console vars at next deploy). Localhost is unaffected (`NODE_ENV=development` → `dev`). Side-effect to flag for the owner: after this lands, **dev-branch-deployed errors finally tag `dev`** — the Phase-2 brief's "dev-branch rows show under Production" note inverts.
- **New `lib/observability/alerts.ts`:** `maybeSendCriticalAlert(flags, details)` — fires when **severity = critical AND source = 'server' AND env = 'production'** AND (`is_new` OR `became_critical` OR `regressed` OR `reopened`, per owner decision). Composes a compact email (severity, title, route/method, org slug, scrubbed message excerpt, request id, deep-link `${SITE_URL}/platform-admin/observability/${group_id}` — `SITE_URL` = branch-scoped `NEXT_PUBLIC_APP_URL`, verified plumbed) → `sendEmail(ADMIN_EMAIL, …)`. **Fire-and-forget in its own try/catch** — **[review]** mandatory, not just discipline: `sendEmail`'s `fetch` is un-caught and a network failure REJECTS (provider errors return `{status:'provider_error'}` but transport errors throw); also log the `'skipped'` status (unset `RESEND_API_KEY`) rather than assuming delivery. **In-process hourly cap** (~5/hr, logged when suppressing) — **[review] per-instance, NOT a global cap** (Amplify runs many workers); accepted because the DB-level `is_new`/transition flags are the real dedup — the cap only bounds a worst-case storm per worker.
- **`lib/observability/capture.ts`:** read the RPC's new jsonb result (**only when it's a non-null object** — see drift-gate note); `void maybeSendCriticalAlert(…)` after a successful record. The pure decision function (`shouldAlert(flags, severity, source, env)`) is exported for unit tests.
- **Why email, not the bell** (re-confirmed): `notifications.user_id` is hard-bound to `auth.users` + `org_id NOT NULL`; platform admins live outside both. Org-less bell = Phase 5.
- **Why client errors can never alert** (verified twice over): `/api/client/error-capture` hardcodes `severity:'warning'` + `source:'client'` server-side (the payload can't influence either, and explicit severity bypasses the route-pattern classifier), and the alert gate requires `source='server'` + `severity='critical'`. All server paths resolve `source='server'` (instrumentation explicit, withObservability seeds ALS, capture defaults, RPC coalesces).

### 14.3 Manual sweep fallback (code)

- **[review] There is NO existing super_admin-only helper in `lib/platform-auth.ts`** — the only explicit role-gate is a local, non-exported `requireSuperAdmin(req)` inside `app/api/platform-admin/orgs/[id]/delete/route.ts`. **Promote it into `lib/platform-auth.ts` as an exported helper** (and switch the orgs-delete route to import it — one source of truth); do NOT gate the sweep on `manage_platform_users` (functionally super-admin-only but semantically user-management).
- **`app/api/platform-admin/observability/sweep/route.ts`** — POST, **super_admin-gated** via the promoted helper (stricter than the status route's `manage_product` because it deletes data), idempotent: `rpc('obs_fold_metrics')` + `rpc('obs_retention_sweep')`, returns both heartbeat summaries, `writePlatformAuditLog('observability_sweep')`. No UI button this phase (callable via fetch/curl; chip already surfaces staleness).

### 14.4 What Phase 4 does NOT change (and one small chip enhancement)

- **Dashboard chart + freshness chip were pre-wired in Phase 2 and self-activate** (chip needs a non-null `last_run_at`, so heartbeat rows are written only by the jobs themselves — never pre-seeded null). **[review] One small enhancement ships:** the chip currently ignores the heartbeat `status` column — it turns amber when **any** heartbeat row has `status='error'`, in addition to the existing >15 min staleness rule (success-only `last_run_at` bumping makes staleness catch persistent fold failures; the status check catches a failing nightly sweep that staleness alone would mask for up to a day).
- **[review] Accepted cosmetic transient:** the dashboard reads rollup + raw as two separate queries (two snapshots), so a fold committing between them can double/under-count once per render, and folding floors a row's timestamp to its 5-min bucket (can shift one display bucket at the window edge); both self-heal on the next poll — platform-admin-only chart, not worth a unioning RPC now.
- §6 breakdowns / affected-orgs keep their **sampled (5,000-event cap, disclosed)** behaviour — rollup rows carry no status-code/org dimensions, so "exact breakdowns" is a Phase-5 candidate, not silently claimed here (honest scoping of Phase-2 deferred item *b*; item *a* — snooze sweep — IS closed).
- `request_metrics_raw` stays LOGGED (open decision 4 closed as built — staging is emptied every 5 min; UNLOGGED's crash-loss trade isn't worth revisiting).

### 14.5 Verification plan

1. `npm run typecheck` (shared modules touched) + `npm run lint:focused -- <files>` + unit tests (alert gate: severity/source/env/flags matrix + hourly cap; fingerprint tests still green).
2. Apply 122 `--dev` → `npm run refresh:snapshots` → DATA_DICTIONARY (function-return change, cron jobs, retention semantics incl. the `distinct_org_count` "retained events" meaning, heartbeat now live) → `npm run check:dictionary` — one commit.
3. **Live-dev checks:** `select jobname, username from cron.job` → 2 rows as `postgres`; within 5 min heartbeat `metrics_fold` row appears, `request_metrics_raw` empties, rollup rows appear, chart totals unchanged pre/post fold; force-run via the sweep route → snooze-reopen + heartbeat + `distinct_org_count` recompute verified (seed a synthetic expired-snooze group + an out-of-window event); trigger a brand-new critical via a one-off script (env temporarily `production`-tagged, rows cleaned up after) → exactly ONE email to ADMIN_EMAIL with a working deep-link, repeat occurrence → zero further emails; sweep route as support-role → 403.
4. Dev-server restart (stop → `rm -rf .next` → `npm run dev`, login 200, no EACCES) before owner browser pass (chip reads "Last rollup Nm ago").
5. Adversarial multi-agent review of the finished diff (as Phases 1 & 2), findings folded in.
6. **Prod:** ✅ applied 122 `--prod` 2026-06-10 (owner-approved). Verified live: extension installed, 2 cron jobs scheduled as `postgres` (both active), `record_error_event` returns jsonb, fold ran + stamped heartbeat, anon execute denied (42501); `check:migrations` reports prod in sync. **Amplify:** branch-scoped `OBSERVABILITY_ENV` console vars set by owner (prod=production / dev=dev) — takes effect on next deploy; code fails closed if unset.

### 14.6 Owner decisions — ✅ LOCKED 2026-06-10 (all four; built as below)

1. ✅ **Critical allowlist:** current 3 patterns + `/api/org/create` (payments/billing/webhook/checkout · auth/login/signup · /api/register · org-create) — `CRITICAL_ROUTE_PATTERNS` in `capture.ts`.
2. ✅ **Alert triggers:** first-seen critical + escalation-to-critical + critical regression — production + server only. **Note (review correction):** within one resolution cycle the de-noising is "**at most two** alerts" — the first in-window recurrence (`regressed`) AND the >7-day auto-reopen (`reopened`) can each fire once; not strictly one. Acceptable (still de-noised vs per-occurrence).
3. ✅ **Recipients:** `ADMIN_EMAIL` (fieldlogichq@gmail.com) only. (Future: `OBSERVABILITY_ALERT_EMAILS` list.)
4. ✅ **Retention:** raw events 30 d · resolved groups 90 d · rollups 1 y · ignored groups + feedback indefinite · nightly 08:15 UTC.

### 14.7 Files touched (as built)

- `supabase/migrations/122_observability_phase4.sql` (new) · `lib/observability/alerts.ts` (new — `shouldAlert`, `explicitProductionEnv` fail-closed guard, per-worker hourly cap, `maybeSendCriticalAlert`) · `lib/observability/capture.ts` (org-create critical pattern; reads RPC jsonb; **`await`** maybeSendCriticalAlert) · `lib/platform-auth.ts` (+exported `requireSuperAdmin`) · `app/api/platform-admin/orgs/[id]/delete/route.ts` (uses the promoted helper) · `app/api/platform-admin/observability/sweep/route.ts` (new) · `app/platform-admin/observability/page.tsx` (chip: fold-staleness >15m / sweep-staleness >26h / `status='error'` amber; "Rollup has not run yet" empty copy) · `amplify.yml` (OBSERVABILITY_ENV echo) · `tests/unit/observability.test.ts` (alert-gate + explicit-env + never-rejects cases, 24 pass) · `docs/agents/db/DATA_DICTIONARY.md` + snapshots · TODO.md + memory.

### 14.8 Adversarial review (6-dimension fan-out + 3-lens verify, 2026-06-10) — fold-ins
- **[should-fix] Detached alert promise** → `await maybeSendCriticalAlert` (Lambda freeze would drop the first-occurrence email; the fn never rejects so awaiting is safe).
- **[should-fix] OBSERVABILITY_ENV fail-OPEN** (deployed dev branch → NODE_ENV='production' → would page from dev) → `explicitProductionEnv()` fail-closed gate: alerting requires OBSERVABILITY_ENV explicitly set to production. Still also set the per-branch console var (operational).
- **[minor] Empty-heartbeat chip** copy → state-neutral "Rollup has not run yet"; **sweep-staleness (>26h)** added so an un-run nightly sweep is actually observed (makes the dictionary claim honest).
- **[docs] truncate→DELETE-drain**, Phase-4 status/decisions marked built, org-create added to the PM brief alert list, "once per resolution"→"at most two" correction, heartbeat-visibility softened. All folded above.
- **Accepted (not changed):** `WHEN OTHERS` doesn't trap `statement_timeout` (57014) → a fold timeout writes no error heartbeat but rolls back cleanly (raw retried) and is caught by fold-staleness; the pre-SELECT transition race can send duplicate emails under heavy concurrency (bounded by the per-worker cap + rarity); manual-sweep-vs-cron-fold deadlock is self-healing (one txn retries). The manual sweep route runs without the cron command's `statement_timeout` (rare super-admin action).

---

## 15. Phase 3 detailed build plan — Proposed (awaiting owner go-ahead 2026-06-10)

**PM brief:** Phase 3 section in [OBSERVABILITY_ERROR_TRACKING_PM_BRIEF.md](OBSERVABILITY_ERROR_TRACKING_PM_BRIEF.md). **No migration needed** — `feedback_submissions` was sealed in migration **118** (Phase 1, applied dev + prod 2026-06-09); confirmed via live snapshot that no later migration alters it. Phase 3 is **independent of Phase 4**.

> **Pre-build research (6-agent codebase investigation, 2026-06-10):** a parallel read across the plan/brief, the requestId/capture path, the platform-admin triage patterns, the auth/email helpers, the mount surfaces, and the live table schema. It produced the verified facts below and three correction-class findings now folded in: (1) the requestId is **never surfaced to the browser today** (net-new plumbing, not a read); (2) `withObservability` wraps only **2 routes**, so any header-based auto-link is honest **best-effort** today; (3) `lib/email.ts` `wrap()`/`escapeHtml()` are module-private (must export or inline) and `sendEmail`'s `fetch` can reject on transport failure (admin-notify must be try/caught + awaited). Findings carried into the design are marked **[verified]**.

### Verified facts this design rests on (probed live 2026-06-10)

- **`feedback_submissions` exists live** (mig 118), 16 columns, **RLS-enabled-no-policies** → service-role (`supabaseAdmin`) only; anon/authenticated get 0 rows. **No `request_id`/`error_group_id` typed column** — the error link lives inside the `context` jsonb. `body` is the only NOT NULL user field; `title` is **nullable**; `severity` is admin-set/nullable; **`updated_at` has no trigger** (set in app code on update). Indexes: `(status, created_at desc)`, `(org_id, created_at desc)`, `(type)`.
- **Status lifecycle is `new | triaged | acknowledged | resolved`** — DISTINCT from the error_group `open|resolved|ignored|snoozed`. Needs its own `VALID_STATUSES` + badge map + status route (do NOT reuse observability's).
- **The `'observability'` platform area already exists** (Phase 2, `lib/platform-areas.ts:63`; view super_admin/product/support, write super_admin/product). §7 says feedback shares it → **no new area, no migration to platform-areas.ts**. Guards: `requirePlatformAreaView('observability')` (page) + `requirePlatformPermission('manage_product')` (status route) + `isPlatformAreaReadOnly` (lock the control for support).
- **[verified] requestId is NOT surfaced to the browser today** (`grep x-request-id` = 0 hits). It's minted once in `withObservability` (`randomUUID()`), seeded into AsyncLocalStorage, and read only from ALS by `captureError` (`p_request_id`) — never written to a response header/body. `lib/observability/client.ts` posts via `sendBeacon` and never reads a response. So surfacing it is net-new plumbing.
- **[verified] `withObservability` currently wraps only 2 routes** (`org-context`, `notifications`) → emitting the header there is the single mismatch-proof site but yields **narrow coverage today**; the widget must work with no id. `instrumentation.ts onRequestError` gets no response object (can't set a header); `proxy.ts` matcher doesn't cover most `/api/*` (and minting there would create a second, non-matching id since `captureError` reads requestId only from ALS).
- **`lib/api-auth.ts`:** `getAuthContext`/`getAuthContextWithRole`/`getAuthContextWithScope` all return `{user, org, …}` or **`null`** (null = anonymous; there is no boolean). `getAuthenticatedUser()` gives the user without forcing an org match. For "all personas," **null must mean anonymous-but-accepted, not 401** (the table's `org_id/user_id/user_email` are all nullable on purpose).
- **[verified] `lib/email.ts`:** `sendEmail(to, subject, html)` returns `{status:'sent'|'skipped'|'provider_error'}` and never throws for provider/skip — **but its underlying `fetch` REJECTS on transport failure**, so the admin-notify must be in its own try/catch. `ADMIN_EMAIL='fieldlogichq@gmail.com'` + `SITE_URL` exported. **`wrap()` and `escapeHtml()` are module-private** — export `wrap` (one-liner) or use a small inline template; must HTML-escape the user body either way.
- **`app/api/client/error-capture/route.ts`** is the rate-limit pattern to clone: module-level `Map<ip,ts>` + global 1s/50-accept backstop + per-IP 1/s, LRU-evict at 5000 entries (never `.clear()`), 16KB body cap, throttle returns **202** (soft-success). Use a **FRESH module-level map** for feedback (don't share — per-Lambda-instance, best-effort by design).
- **`components/FeedbackModal.tsx` is a generic confirm/alert dialog** (default export, ~31 callers) — do NOT touch. Build a new `FeedbackWidget` reusing the **GLOBAL** `modal-overlay`/`modal`/`modal-header`/`modal-footer` classes (`app/globals.css`) + `btn btn-lime/btn-ghost btn-data`.
- **`app/platform-admin/audit/page.tsx`** is the list template (server component, `await searchParams`, `.range()` offset pagination, GET-form filters, org `<Link>`, `AuditExportClient` → server export route with ExcelJS/CSV, `EXPORT_LIMIT 2000`). **`app/api/platform-admin/observability/[groupId]/status/route.ts` + `StatusControls.tsx`** are the triage-mutation template (`await ctx.params`, UUID validate, allowlist status, `writePlatformAuditLog`, `router.refresh()`).
- **Mount surfaces located:** `AdminSidebar.tsx` footer (next to Help, ~L574–609); `AdminBottomNav.tsx` "More" dropdown (~L210–296, needs a lucide icon import); `AdminChrome.tsx` is the once-per-app client shell; `CoachPortalShell.tsx` railFooter (no Help today); `scorekeeper/layout.tsx` + `check-in/layout.tsx` are **SERVER** components with inline-styled headers → drop a `'use client'` launcher beside Sign Out (same pattern as the `InstallAppPrompt` they already render).

### 15.1 No migration — build against the sealed table

Phase 3 adds **no tables/columns** — `feedback_submissions` is live (mig 118). The migration→snapshot→dictionary→`check:dictionary` flow and the `check:migrations` drift gate **do not apply** (nothing to drift); the DATA_DICTIONARY entry already documents the table. If — and only if — screenshot columns are ever added, that becomes migration 123 with the full dictionary unit-of-work; **not this phase.** (Binding rule still honored: column existence decided from the live snapshot, never a migration file.)

### 15.2 requestId surfacing (best-effort, single mint site)

- **`lib/observability/with-observability.ts`:** after the handler returns `res`, set the header at the one mint site — `try { res.headers?.set('x-request-id', requestId); } catch {}` (guarded; the wrapper must never throw, and a plain `Response` could have immutable headers). Because this is the same `requestId` `captureError` stores as `error_events.request_id`, the client-stashed value is **guaranteed to match** — no mismatch class. **Do NOT** also mint in `proxy.ts`.
- **New `lib/observability/client-request-id.ts`** (client-safe): a module `let lastRequestId` + `recordFromResponse(res)` (reads `res.headers.get('x-request-id')`, stores last non-null, mirrors to `sessionStorage`) + `getLastRequestId()`.
- **A one-time `window.fetch` wrapper** installed by a tiny client provider mounted in the authenticated shells (admin + coach + scorekeeper/check-in), so any app fetch that returns the header is captured transparently — no call-site changes. Guard against double-install.
- **Coverage is honest best-effort:** only instrumented (wrapped) routes emit the header today; the widget attaches the id when present and works normally when absent. Broad route-wrapping stays a separate fast-follow. The triage deep-link also degrades gracefully — `error_events` purge at 30 days, so an old feedback item's link can dangle; resolve `context.requestId → error_events.request_id → group_id` **at read time** and no-op the link when the event row is gone.

### 15.3 `FeedbackWidget` + launcher (client components)

- **`components/feedback/FeedbackWidget.tsx`** (`'use client'`) — brand-new (NOT a repurpose of `FeedbackModal`). Reuses the global modal classes for an identical look. Fields: type pills (Bug/Feature/Feedback → `bug|feature|feedback`), category `<select>` (the six, defaulted from `usePathname()` → route classifier), title input, body textarea (required, maxlength enforced client-side too). On submit, POST `/api/feedback` with `{type, category, title, body, context:{route, help_section?, app_version, requestId: getLastRequestId()}}`; show the success state on 200/202; inline error otherwise. **Role + org are resolved server-side from the session** (never trusted from the client payload).
- **`components/feedback/FeedbackLauncher.tsx`** (`'use client'`) — the "Send feedback" button that owns open/close state and renders the widget; the single thing each surface mounts. A `route→category` mapping helper keeps the default sensible per surface.
- **`components/feedback/FeedbackRequestIdProvider.tsx`** (`'use client'`) — installs the one-time `window.fetch` wrapper from §15.2; mounted once per authenticated shell.

### 15.4 `POST /api/feedback` (one handler, all personas)

- **`app/api/feedback/route.ts`**, `export const runtime = 'nodejs'`. Flow:
  1. **Rate limit / throttle** — clone the `error-capture` block (fresh module-level map): signed-in → 1/user/hr keyed by user id; anonymous → IP throttle + global backstop; over-limit returns **202 soft-success** (no enumeration).
  2. **Resolve persona** — `getAuthContextWithRole()` (falls back to `getAuthenticatedUser`); `null` = anonymous-but-accepted → `org_id/user_id/user_email` null. **Never 401 the public path.**
  3. **Validate** — `type ∈ {bug,feature,feedback}`; `body` non-empty; length caps on title/body; `category` against the six (fallback 'Other'). 400 on hard-invalid (missing body / bad type).
  4. **[verified] Redact before write** — run `context` through `redactContext`; run free-text `title`/`body` through `scrubEmails` (imported **directly from `./redact`** — NOT re-exported from the barrel) with the route-level length cap (avoid `redactValue`'s silent 2000-char truncation on the body). No raw secrets/PII to Postgres.
  5. **Insert** via `supabaseAdmin` into `feedback_submissions` (status defaults `new`; `context` valid jsonb).
  6. **Emails** — **await** the admin-notify to `ADMIN_EMAIL` in its own try/catch (serverless can drop a detached promise; `sendEmail`'s fetch can reject); fire-and-forget the submitter confirmation **only when a `user_email` exists**. **HTML-escape the user body** (export the private `escapeHtml` or replicate). Email never blocks/breaks the response.
  7. Return `{ ok: true }`.
- Validation + throttle extracted as **pure functions** the route imports, for unit tests.

### 15.5 Platform-admin triage page + status route + nav

- **Nav** — `PlatformAdminNav.tsx`: add `MessageSquare` to the lucide import and `{ href:'/platform-admin/feedback', label:'Feedback', Icon: MessageSquare, area:'observability' }` to the **System** group (right after Observability). Visibility/read-only derive automatically from the area (this is the item explicitly deferred from Phase 2 — §10 line "NOT built here").
- **`app/platform-admin/feedback/page.tsx`** — server component, `requirePlatformAreaView('observability')` + `isPlatformAreaReadOnly`. Mirror `audit/page.tsx`: `await searchParams`, `.range()` offset pagination (PAGE_SIZE 100), GET-form filters for type/category/status applied **DB-side via `.eq`** (NOT post-fetch JS, so they span all rows), org `<Link>` (or "Platform / anonymous" when `org_id` null), type/status/severity badges (`badge-*`: new→warning, triaged/acknowledged→info, resolved→success; bug/feature/feedback type chips; null-safe severity), and a `FeedbackExportClient` → `/api/platform-admin/feedback/export` (clone `AuditExportClient` + the audit export route). Each row shows the body in a `<details>`; a bug whose `context.requestId` resolves to an `error_group` renders a **"View related issue"** `<Link href={`/platform-admin/observability/${groupId}`}>`.
- **`app/platform-admin/feedback/[id]/StatusControls.tsx`** (`'use client'`) — clone the observability `StatusControls`; POST to the status route; `router.refresh()` on success; disabled when `readOnly||busy`; "View-only for your role" note for support.
- **`app/api/platform-admin/feedback/[id]/status/route.ts`** (POST) — `requirePlatformPermission('manage_product')` (support → 403, defense-in-depth with the locked control); `await ctx.params`; UUID-validate id; validate `status ∈ {new,triaged,acknowledged,resolved}`; fetch current; update status (+ `triaged_by`/`triaged_at` when moving off `new`, optional admin `severity`, **explicit `updated_at = now()`** — no trigger); `writePlatformAuditLog(actor, org_id, 'update_feedback_status', 'status', old, {status:new})` + an `ACTION_LABELS` entry in the audit page; return `{ ok:true, status }`.
- **`app/api/platform-admin/feedback/export/route.ts`** — clone `app/api/platform-admin/audit/export/route.ts` (ExcelJS xlsx + manual CSV escaper, `EXPORT_LIMIT 2000`), guarded read-only.

### 15.6 Mount points

- **Admin** — `AdminSidebar.tsx` footer: a `FeedbackLauncher` beside the existing Help link. `AdminBottomNav.tsx` "More" dropdown: a feedback `<button className={styles.dropItem}>` (add the lucide icon import). Mount `FeedbackRequestIdProvider` once in `AdminChrome.tsx`.
- **Coach** — `CoachPortalShell.tsx` railFooter: add a **Help** link (new) + the `FeedbackLauncher`; mount the requestId provider in the shell.
- **Scorekeeper / check-in** — drop a `'use client'` `FeedbackLauncher` into each server-component header beside Sign Out (same pattern as `InstallAppPrompt`); these surfaces use `getAuthContextWithRole`, so the POST resolves role server-side.
- Verify the global modal tokens (`--hud-surface`, `--blueprint-blue-rgb`) resolve acceptably on the coach/lighter surfaces (owner's visual pass).

### 15.7 What Phase 3 does NOT change

- No new table/column/migration (table sealed in 118); no `check:dictionary`/drift-gate involvement.
- No new platform area or permission — reuses `observability`.
- `components/FeedbackModal.tsx` untouched (generic dialog, ~31 callers).
- No screenshots/Storage, no public/fan mounts, no org-scoped feedback view, no in-app bell (all deferred).
- requestId coverage stays narrow until broad route-wrapping (separate fast-follow) — explicitly best-effort, not claimed as universal.

### 15.8 Verification plan

1. `npm run typecheck` (shared modules touched: `with-observability`, nav, shells) + `npm run lint:focused -- <files>`.
2. **Unit tests** (extend `tests/unit/observability.test.ts` or new `feedback.test.ts`): `/api/feedback` validation matrix (missing body, bad type, category fallback), the rate-limit/throttle gate (per-user + IP + global backstop, 202 soft-success), redaction applied before write, and that an email failure never breaks the response.
3. **Smoke (unauthenticated):** `/platform-admin/feedback` 307-redirects; feedback status + export APIs 403/redirect unauthenticated; `POST /api/feedback` accepts an anonymous body and throttles a burst to 202.
4. Dev-server restart (stop → `rm -rf .next` → `npm run dev`, login 200, no EACCES) before the owner browser pass — **required** because Phase 3 adds files + touches shared modules (`with-observability`, nav, shells). (Windows: stop the server BEFORE deleting `.next`.)
5. Adversarial multi-agent review of the finished diff (as Phases 1/2/4); fold findings in.
6. **No prod migration step** (none needed). Ship on `feat/free-tier-coaches` per branch policy; **no master push without explicit owner request.**

### 15.9 Owner decisions — ✅ LOCKED 2026-06-10

1. ✅ **Bug→error auto-link:** best-effort `x-request-id` from the single mint site + client stash + widget attach; narrow coverage today, grows with route-wrapping; widget works without it.
2. ✅ **Screenshots:** deferred (text-only v1).
3. ✅ **Mount surfaces:** authenticated app only (admin sidebar + bottom-nav More · coach portal + new Help link · scorekeeper/check-in); public deferred.
4. ✅ **Emails:** confirmation to signed-in submitter (fire-and-forget) + admin-notify to `ADMIN_EMAIL` (**awaited**).
5. ✅ **Rate limit:** 1/user/hr signed-in + IP throttle (cloned error-capture) anon + body-size cap.
6. ✅ **Categories:** Tournaments / Coaches / Registrations / Accounting / Billing / Other, route-defaulted.

### 15.10 Files to touch (planned)

`components/feedback/FeedbackWidget.tsx` (new) · `components/feedback/FeedbackLauncher.tsx` (new) · `components/feedback/FeedbackRequestIdProvider.tsx` (new) · `lib/observability/client-request-id.ts` (new) · `lib/observability/with-observability.ts` (set `x-request-id`) · `app/api/feedback/route.ts` (new) · `app/platform-admin/feedback/page.tsx` (new) · `app/platform-admin/feedback/FeedbackExportClient.tsx` (new) · `app/platform-admin/feedback/[id]/StatusControls.tsx` (new) · `app/api/platform-admin/feedback/[id]/status/route.ts` (new) · `app/api/platform-admin/feedback/export/route.ts` (new) · `app/platform-admin/PlatformAdminNav.tsx` (+MessageSquare nav item) · `app/[orgSlug]/admin/AdminChrome.tsx` + `components/admin/AdminSidebar.tsx` + `components/admin/AdminBottomNav.tsx` (mount) · `components/coaches/CoachPortalShell.tsx` (+Help link + launcher + provider) · `app/[orgSlug]/scorekeeper/layout.tsx` + `app/[orgSlug]/check-in/layout.tsx` (launcher) · `lib/email.ts` (export `wrap`/`escapeHtml` if reused) · `app/platform-admin/audit/page.tsx` (ACTION_LABELS entry) · `tests/unit/*` · TODO.md + memory. **No migration / no DATA_DICTIONARY change.**

### 15.11 Open risks carried into the build

- **requestId coverage is the headline-feature risk** — narrow until routes are wrapped; mitigated by honest best-effort framing + graceful widget/link degradation. Owner accepted (decision 1).
- **Unauthenticated write path** — IP throttle + global backstop + size cap + 202 soft-success + redaction; per-instance map is best-effort (acceptable, matches error-capture).
- **Feedback body PII** — `scrubEmails` + length cap on free-text; full `redactContext` on the structured context blob.
- **Modal tokens on lighter surfaces** — owner visual pass on coach/scorekeeper.
- **Email reliability** — admin-notify awaited; transport-reject guarded.
