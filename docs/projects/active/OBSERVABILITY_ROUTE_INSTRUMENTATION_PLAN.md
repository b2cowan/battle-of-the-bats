# Observability Route-Instrumentation Rollout — Implementation Plan

**Status:** Proposed (awaiting owner go-ahead) — no code yet
**Branch when built:** `feat/free-tier-coaches` (dev default; no master without explicit request)
**Owner:** Platform / Observability
**Created:** 2026-06-10
**PM brief:** [OBSERVABILITY_ROUTE_INSTRUMENTATION_PM_BRIEF.md](OBSERVABILITY_ROUTE_INSTRUMENTATION_PM_BRIEF.md)
**Parent feature:** [OBSERVABILITY_ERROR_TRACKING_PLAN.md](OBSERVABILITY_ERROR_TRACKING_PLAN.md) — this formalizes that plan's incremental-wrapping intent (§4 "hottest routes first, codemod the rest", §10 Phase 5 "codemod-assisted sweep + track coverage %", §12 "wrap by traffic priority", and the "proxy.ts-level fallback" idea). It is the engine that makes Phase 1's metrics chart meaningful and lifts Phase 3's bug→error deep-link from best-effort to broad.

---

## 1. Goal

Move observability from **near-zero per-route coverage** to **meaningful, tracked coverage** — so that (a) the platform-admin "calls vs errors" chart has a real denominator, (b) Phase 3 bug reports deep-link to the captured error on most routes (not just 2), and (c) every server route's request carries an `x-request-id` for support. Do it **incrementally and low-risk**, with a visible coverage metric, never a single big-bang PR.

## 2. Current state (measured 2026-06-10)

- **279 route files / 400 handler exports** (`GET|POST|PATCH|PUT|DELETE`) under `app/api/`.
- **2 files wrapped** with `withObservability` — `app/api/org-context/route.ts`, `app/api/notifications/route.ts` (~0.7%).
- **5 files call `captureError`** directly in catch blocks — `register`, `org/create`, `admin/teams`, `admin/games`, and the public `client/error-capture`.
- **`instrumentation.ts onRequestError`** is the global net — already captures *uncaught* throws / RSC errors on every route with `statusCode 500`.

**Consequence today:** the dashboard's "total calls" denominator reflects basically 2 routes; a 5xx the user hits almost never carries a client-visible `requestId`; and a route that **catches its own error and returns a 500 JSON** (never rethrows) is invisible to `onRequestError` and stores no error detail.

## 3. The three coverage gaps (and the right fix for each)

| Gap | Best mechanism | Covered today |
|---|---|---|
| Capture an **uncaught** throw (rich detail) | `onRequestError` (global) | ~100% — done |
| Surface **`requestId`** to the client (Phase 3 deep-link + support) | a **global response-header stamp** (Mechanism A) | ~0.7% |
| **Per-route call/error metrics** (chart denominator) + ALS context for any nested `captureError` | per-route **`withObservability`** wrapping (Mechanism B) | ~0.7% |
| Rich detail for a **self-handled** 500 (route catches → returns 500, never rethrows) | explicit **`captureError` in the catch** (Mechanism C) | ~5 routes |

The leverage insight: only Mechanism B is a 279-file slog. A is one global change; C is a small surgical pass. Don't gate A or Phase 3 on the B sweep.

## Verified facts this plan rests on (read live 2026-06-10)

- **`lib/observability/with-observability.ts`:** `withObservability<T>(handler, { route }): T` mints `requestId = randomUUID()`, seeds AsyncLocalStorage via `runWithRequestContext({ requestId, route, method, source:'server' })`, calls `recordRequest(opts.route, status >= 500)` on both the success and throw paths, and **returns the handler's `res` unchanged**. **It does NOT call `captureError`** — by design, so it never double-counts with `onRequestError` (documented in the file header). The generic preserves the exact `(req, { params })` signature, so Next's route-type validator is unaffected.
- **`captureError` reads `requestId` only from ALS** (`getRequestContext()`), never from a header or options. So a `captureError` in an **un**wrapped route currently records `request_id = null`. Wrapping the 5 capture routes immediately improves their attribution.
- **`proxy.ts`** already clones request headers into a mutable `requestHeaders` and forwards them via `NextResponse.next({ request: { headers } })` — but it also does a Supabase `auth.getUser()` round-trip on **every matched request**, and its `matcher` covers only `/api/admin/*`, `/api/scorekeeper/*`, `/api/registrations`, `/api/org-context`, `/api/dev/*` (most `/api/*` is NOT matched). Naively expanding the matcher to all `/api/*` would add a Supabase auth round-trip to every API call — unacceptable. The stamp therefore needs a **cheap fast-path** (see §4).

## 4. Mechanism A — global `requestId` stamp (the high-leverage move)

**Outcome:** every server route response carries `x-request-id`, and Phase 3's client stash captures it regardless of whether the route is wrapped.

1. **`proxy.ts` API fast-path (new, at the very top of `proxy()` before the Supabase client is built):** if `pathname.startsWith('/api/')`, generate `const rid = crypto.randomUUID()`, set it on the forwarded `requestHeaders` (`x-request-id`) **and** on a `NextResponse.next(...)` response, and `return` immediately — **no `getUser()` round-trip**. This stamps the id cheaply on every API request+response without touching the existing auth flow. (Non-API matched paths keep the current behaviour.)
2. **Expand the `matcher`** to include `/api/:path*` (in addition to the existing entries). Because the fast-path early-returns for API routes, this adds the stamp without adding session work to API calls.
3. **`withObservability` adopts the incoming id** (one-line change): `const requestId = (req?.headers?.get?.('x-request-id')) ?? randomUUID();` — so wrapped routes reuse the proxy-minted id instead of minting a second, non-matching one. **One id end-to-end** → the client-stashed value always equals the stored `error_events.request_id`. This is the critical correctness rule: never have two mint sites producing different ids for the same request.
4. **Phase-3 client stash** (`lib/observability/client-request-id.ts` + the `window.fetch` wrapper, already in the Phase 3 plan §15.2) then captures `x-request-id` from *any* API response — universal, not best-effort.

**Caveats to validate in the spike (~half a day):** middleware response-header mechanics on the `NextResponse.next` path; confirming the fast-path runs before any redirect branches for `/api/*`; edge-runtime `crypto.randomUUID()` availability (it is, in the middleware runtime); and that error-capture still relies on `onRequestError`/`captureError` (middleware can't see route throws). Mechanism A gives **requestId + nothing else** — no metrics, no capture.

## 5. Mechanism B — per-route `withObservability` wrapping (metrics + ALS)

**Outcome:** the calls-vs-errors chart denominator becomes real, and any nested `captureError` gets full route/requestId/org attribution from ALS.

This is the incremental slog. Wrapping is mechanical and behaviour-preserving (`withObservability` returns the response untouched, records metrics fire-and-forget, never adds latency on the happy path). Rolled out by **tranche** (§8), one domain per PR, each typecheck + smoke verified.

## 6. Mechanism C — `captureError` in swallowed-500 catch blocks (surgical, secondary)

**Outcome:** routes that catch their own error and `return NextResponse.json({error}, {status:500})` without rethrowing get rich captured detail (today they're invisible to `onRequestError`).

This is **not** automatable safely (it's a judgment call about which catch blocks represent real 5xx vs expected validation). Scope it to a **surgical pass on the money/identity routes only** (Tranche 0) — add `captureError(err, { … })` to catch blocks that return a 500. Everywhere else, `onRequestError` remains the safety net; revisit from real dashboard data.

## 7. The codemod (Mechanism B at scale)

A script (e.g. `scripts/wrap-route-observability.mjs`, ts-morph or jscodeshift) that transforms:

```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { …body… }
// →
export const POST = withObservability(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => { …body… },
  { route: '/api/<derived>' },
);
```

- **Route string** derived from the file path: `app/api/foo/[id]/route.ts` → `/api/foo/[id]` (keep `[param]` literal — it's a grouping key, not a value).
- **Insert the import** `import { withObservability } from '@/lib/observability/with-observability';` if absent.
- **Per file, transform each exported method** (`GET/POST/PATCH/PUT/DELETE`).
- **Skip + report** (do NOT auto-transform) these classes — flag for hand review:
  - already wrapped (`= withObservability(`),
  - handlers returning a **stream / non-`NextResponse`** body, or using `new Response(...)` with a `ReadableStream`,
  - `export const GET = …` arrow forms (already a const — wrap the initializer instead),
  - files with `export const runtime = 'edge'` (none today, but assert),
  - the public `client/error-capture` (intentionally minimal).
- **Output a report**: transformed / skipped-with-reason / total, so each tranche PR documents exactly what changed.

The codemod is a convenience, not a trust boundary — **typecheck + smoke gate every tranche** (§10).

## 8. Tranche plan (risk × traffic order)

| Tranche | Scope (globs) | ~Handlers | Mechanisms | Notes |
|---|---|---|---|---|
| **0 — money/identity** | `api/billing/*`, `api/auth/*`, `api/register`, `api/registrations/*`, `api/league/**/register`, `api/rep-teams/**/register`, `api/org/create` | ~25–35 | B + **C** | Already drive critical alerting; wrap **and** add `captureError` to swallowed-500 catches. Also wrap the existing 5 `captureError` routes so their attribution gains requestId/route. |
| **1 — game-day hot path** | `api/scorekeeper/**`, `api/official/**`, `api/admin/games`, `api/admin/check-in`, `api/admin/schedule*`, `api/admin/teams`, `api/admin/divisions` | ~20 | B | The live-scoring/check-in surface; highest call volume on event days. |
| **2 — CRUD bulk** | `api/admin/accounting/**`, `api/admin/rep-teams/**`, `api/admin/house-league/**`, `api/coaches/**`, remaining `api/admin/**` | ~200 | B | Codemod sweep, **one domain folder per PR**. The long tail. |
| **3 — platform-admin + misc** | `api/platform-admin/**`, `api/public/**`, `api/plan-gating`, etc. | ~70 | B | Low priority (platform-admin is internal/low-volume; public routes are read-heavy). |
| **Excluded** | `api/dev/**`, `api/dev/seed/**` | — | none | Dev-only; never wrapped. |

Order is deliberate: Tranche 0 protects money/identity (and pairs with Mechanism A so Phase 3's deep-link works on exactly the routes most likely to 5xx); 2 is the bulk and can land over many small PRs at a comfortable pace.

## 9. Coverage tracking

`scripts/check-observability-coverage.mjs` — counts wrapped handlers / total handlers (and lists the largest unwrapped domains), printed in CI or on demand. The parent plan already commits to "track coverage %"; this makes the number real and lets each tranche move it visibly. Optional: surface the % as a small chip on the observability dashboard later.

## 10. Verification (per tranche — every tranche is its own PR)

1. `npm run typecheck` (wrapping touches many files; the generic preserves signatures, so type errors surface real transform mistakes).
2. `npm run lint:focused -- <changed files>`.
3. **Smoke the changed routes** — at least one method per changed file returns its expected status (200/4xx as before); spot-check a dynamic `[param]` route and a route that sets its own headers (the wrap must not clobber them).
4. **Metrics check (dev):** after a tranche, confirm `request_metrics_raw` receives rows for the newly wrapped routes and the dashboard chart's denominator rises.
5. Dev-server restart only if a tranche touches shared modules (`with-observability.ts`, `proxy.ts`) — Mechanism A's PR does; pure wrapping PRs do not (hot-reload is fine).
6. Adversarial review on the **Mechanism A** PR specifically (it touches `proxy.ts` + the mint-site rule — the one place a mistake is global). Wrapping PRs are mechanical; a normal review suffices.

## 11. Guardrails / non-goals

- **Behaviour-preserving only.** `withObservability` returns the response unchanged; metrics are fire-and-forget; the header-set is `try/catch`. A wrap can never change response semantics or add latency.
- **One requestId mint site.** After Mechanism A, proxy mints; `withObservability` adopts. Never reintroduce a second mint.
- **No edge-runtime capture.** Middleware can't see route throws — `onRequestError` + `captureError` remain the capture path. Mechanism A is requestId-only.
- **No customer-facing change.** This is pure internal instrumentation.
- **No new tables/migrations.** Uses the Phase-1 observability schema as-is.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Matcher expansion adds latency to every API call | Cheap fast-path early-returns before `getUser()`; measured in the spike |
| Two requestId mint sites → client stash never matches stored id | The `withObservability` adopt-incoming-header rule (§4.3); a unit test asserts the adopted id flows to `recordRequest`/ALS |
| Codemod mangles a streaming/redirect/header-setting route | Skip-and-report those classes; typecheck + smoke every tranche; one domain per PR |
| Metrics write pressure as coverage grows | Already aggregate-only (5-min staging flush, not per-request rows); Phase-1 design absorbs this |
| Big-bang temptation | Hard rule: one tranche/domain per PR, coverage script shows progress without rushing |

## 13. Open decisions (owner)

1. **Adopt Mechanism A (global requestId stamp) now** as a Phase-3 fast-follow? *(Recommended: yes — it's the cheap half-day that makes Phase 3's deep-link broad instead of 2-route best-effort.)*
2. **Pace of Mechanism B** — tranche-by-tranche over time (recommended) vs one large codemod PR (not recommended).
3. **Mechanism C scope** — surgical pass on Tranche-0 money/identity routes only (recommended) vs every swallowed-500 catch (large) vs none (rely on `onRequestError`).
4. **Exclude `api/dev/**` permanently** from wrapping? *(Recommended: yes.)*

## 14. Relationship to the Observability feature

- **Phase 1** built the engine (`withObservability`, metrics, capture). This plan *feeds* it.
- **Phase 3** (feedback widget, §15 of the parent plan) ships best-effort now and **automatically improves** as Mechanism A lands (universal requestId) and Tranche 0/1 wrap (more deep-links resolve).
- **Phase 5** (parent plan §10) named the "codemod-assisted sweep + coverage %" — this document **is** that, pulled forward and made concrete; when this completes, mark that Phase-5 bullet done and reference this plan.
