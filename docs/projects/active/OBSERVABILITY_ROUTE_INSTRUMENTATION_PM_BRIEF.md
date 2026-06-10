# PM Brief — Observability Route-Instrumentation Rollout

**Plan:** [OBSERVABILITY_ROUTE_INSTRUMENTATION_PLAN.md](OBSERVABILITY_ROUTE_INSTRUMENTATION_PLAN.md)
**Created:** 2026-06-10 · **Status:** Proposed (awaiting go-ahead) · **Priority:** Medium-High · **Est:** Mechanism A ~0.5 day · Mechanism B ~spread over many small PRs · Mechanism C ~0.5 day
**Parent:** [OBSERVABILITY_ERROR_TRACKING_PM_BRIEF.md](OBSERVABILITY_ERROR_TRACKING_PM_BRIEF.md)

## In one sentence

Our error-tracking *engine* is built, but it's only switched on for **2 of 279 API routes** — this is the plan to switch it on across the app, gradually and safely, so the health dashboard actually reflects the whole product and bug reports can point at the real error.

## Why this exists (the problem)

Phase 1 built the machinery to count traffic, group errors, and attribute them to an org/user/route. But "turning it on" for a route is a per-route step, and so far only 2 routes are instrumented. Three concrete consequences today:

- **The dashboard chart is misleading.** "Total calls vs errors" is computed from ~2 routes, so the denominator is almost empty — we can't yet trust the error-rate number for the product as a whole.
- **Bug reports can't link to the error.** Phase 3's "this is broken → jump to the stack trace" only works when the route the user hit was instrumented — today, almost never.
- **Some failures leave no trace.** A route that catches its own error and returns a generic 500 (without re-throwing) is invisible to our global safety net and stores nothing to debug from.

## What changes (operationally — there is NO customer-facing change)

Three independent pieces, each shippable on its own:

1. **A one-time global change** so **every** API response carries a request ID. This is the cheap, high-leverage piece: it makes Phase 3's bug→error link work across the app instead of on 2 routes, and gives support a request ID to quote for any failure — without instrumenting 279 files. (~half a day, one careful change to our request-routing layer.)
2. **A gradual sweep** that instruments the remaining routes for traffic/error counting, **in priority order, a few at a time** — money & login routes first, then the game-day scoring path, then the long tail of admin/coach screens. Each batch is a small, verified pull request. As batches land, the dashboard's numbers get more complete.
3. **A small targeted fix** on the money/identity routes so a swallowed failure actually records its detail (instead of vanishing).

A **coverage number** ("X of Y routes instrumented") is tracked the whole way, so progress is visible and we're never guessing how much is covered.

## Why it matters

- **Trustworthy health metrics.** Once the sweep progresses, "what's our production error rate?" becomes a real, whole-product answer instead of a 2-route sample.
- **Phase 3 pays off fully.** The global request-ID change flips the feedback widget's bug→error deep-link from "best-effort on 2 routes" to "works on most routes" — for a half-day of work.
- **Faster support.** Every failure carries a request ID a customer can quote and we can look up.
- **No surprises, no risk to customers.** Instrumentation is behaviour-preserving (it can't change a response or add latency), ships in small batches, and the existing global safety net keeps catching uncaught errors throughout.

## Who is affected

- **Platform admins (us):** progressively more complete dashboard data; a coverage % to watch.
- **Customers (org admins, coaches, scorekeepers, public):** **nothing visible changes.** They benefit indirectly — better request IDs for support and, via Phase 3, working bug-report links.

## What this deliberately does NOT do

- **No customer-facing feature** — pure internal instrumentation.
- **No new database tables or migrations** — reuses the Phase-1 schema.
- **No big-bang rewrite** — explicitly tranche-by-tranche; the dev/seed-only routes are excluded entirely.
- **No error-capture in the request-routing layer** — that layer can only stamp the request ID; catching errors stays with the existing per-route and global mechanisms.

## Decisions needed from the owner (recommended defaults in bold)

1. **Do the global request-ID change now**, as a fast-follow to Phase 3? **Yes** (cheap, and it's what makes Phase 3's deep-link broad). Or: defer and rely on per-route coverage only.
2. **Sweep pace** — **gradual, money/login first, then game-day, then the long tail** (small PRs). Or: one large automated PR (more risk).
3. **Swallowed-500 detail fix** — **money/identity routes only** for now. Or: every such route (large) / none (rely on the global net).
4. **Permanently exclude dev/seed routes** from instrumentation? **Yes.**

## Success criteria

1. After the global change, **any** API response carries a request ID, and Phase 3's feedback widget captures it on routes that weren't individually instrumented.
2. The dashboard's "calls vs errors" denominator visibly rises as tranches land, and the coverage script reports a climbing % (target: money/identity + game-day paths instrumented first).
3. A swallowed 500 on a money/identity route now records a debuggable error (it didn't before).
4. Each tranche ships as a small PR that passes typecheck + focused lint + a smoke pass, with **zero** change to any route's response behaviour or latency.
5. No customer-visible change; no new tables/migrations.

**Status: Proposed — awaiting owner go-ahead. Independent of the Phase 3 go/no-go, but Mechanism A is the recommended fast-follow that makes Phase 3's bug→error link broad.**
