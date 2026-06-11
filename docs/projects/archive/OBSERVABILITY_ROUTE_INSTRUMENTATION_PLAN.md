# Observability Route-Instrumentation Rollout — Implementation Plan

**Status:** **Mechanism A (global requestId stamp) ✅ BUILT 2026-06-10** as part of Observability Phase 3 (owner-approved decision #1) — `proxy.ts` stamps `x-request-id` on every `/api/*` (cheap fast-path; `/api/admin/*` keeps the full proxy), `withObservability` adopts it, `instrumentation.ts onRequestError` threads it to `captureError`, and a client `window.fetch` wrapper stashes it. **Mechanisms B + C — Tranche 0 (money/identity) ✅ BUILT 2026-06-11** (owner-confirmed scope; proof PR). **Tranche 1 (game-day) ✅ BUILT 2026-06-11.** **Tranche 2 — `api/admin/accounting` ✅ BUILT 2026-06-11** (B only, domain 1 of the CRUD bulk). **Tranche 2 — `api/admin/rep-teams` ✅ BUILT 2026-06-11** (B only, domain 2; codemod-clean + a 4-file type-only hand-fix — see Build Log). **Tranche 2 — `api/admin/house-league` ✅ BUILT 2026-06-11** (B only, domain 3; codemod-clean, no hand-fix). **Tranche 2 — remaining `api/admin/**` ✅ BUILT 2026-06-11** (B only, domain 4; 59 files/82 handlers, 0 codemod-skips + an 11-site `X.response!` type-only hand-fix across 9 tournament import/registration-fields routes + 1 pre-existing `prefer-const` cleanup — see Build Log). **`api/admin/**` is now fully wrapped (198/198).** **Tranche 2 — `api/coaches/**` ✅ BUILT 2026-06-11** (B only, domain 5 / LAST; 54 files/86 handlers, 0 codemod-skips + a 40-file/63-site `resolved.error!` type-only hand-fix; incl. the untracked Free-Tier Phase-5 `coaches/tournaments/**` files — see Build Log). **Tranche 2 COMPLETE.** **Tranche 3 — `api/platform-admin/**` ✅ BUILT 2026-06-11** (B only; 45 files/60 handlers, 0 codemod-skips, no hand-fix). **Tranche 3 — `api/public/**` + `api/notifications` (remaining) + 4 singletons (`early-access`/`feedback`/`plan-gating`/`send-message`) ✅ BUILT 2026-06-11** (B only; 13 files/13 handlers, 0 skips/hand-fixes). **🎉 MECHANISM B ROLLOUT COMPLETE — coverage 0.8% → 100.0% (388/388 wrappable handlers)** (only the 2 permanently-excluded routes remain unwrapped by design: `api/dev/**` + `api/client/error-capture`). Not committed — branch = trunk. See the Build Log below.

### Build Log — Tranche 0 (money/identity), 2026-06-11
- **Tooling (new):** `scripts/wrap-route-observability.mjs` (Mechanism B codemod, **TypeScript compiler API — zero new deps**, not ts-morph/jscodeshift), `scripts/check-observability-coverage.mjs` (Mechanism B coverage tracker), `scripts/observability-route-exclusions.mjs` (single shared exclusion source so codemod + tracker can't drift). Codemod is EOL-preserving (repo is `core.autocrlf=true`), merges `withObservability` into an existing `@/lib/observability` import, skip-and-reports already-wrapped/arrow-const/edge/streaming, and is idempotent.
- **Mechanism B:** wrapped **24 files / 30 handlers** — `api/billing/*` (9), `api/auth/*` (8), `api/register` (1), `api/registrations/*` (3 across 2 files), `api/league/[orgSlug]/[seasonSlug]/register` (1), `api/rep-teams/.../register` (1), `api/org/create` (1), plus the existing-capture routes `api/admin/teams` (3) + `api/admin/games` (3) so their `captureError` gains ALS route/requestId. **`api/client/error-capture` deliberately NOT wrapped** (intentionally minimal + feedback-loop risk; owner Q2 decision 2026-06-11).
- **Mechanism C:** added **9 `void captureError(err, {...})`** to genuine swallowed-500 catch blocks (catch → return 500, no rethrow) on money/identity routes: `registrations` GET, `registrations/[id]` PATCH+GET, `auth/signup`, `auth/team-signup`, `billing/create-team-checkout` (500 branch only, `user` attribution), `billing/cancel/confirm` (×2 Stripe-reconcile, `ctx`), `billing/downgrade/confirm` (`ctx`). Matched the existing `void captureError(...)` convention (register/org-create/admin already used it). Skipped (correct): inline `if(error) return 500` returned-error checks (out of scope — catch blocks only), best-effort email IIFE catches (league/rep register), and routes whose throws bubble to `onRequestError` (webhook/portal/preflights/coach-signup/destination/me/accept-invite).
- **Verification:** `npm run typecheck` exit 0; focused ESLint 0 errors (28 pre-existing `no-explicit-any` warnings unchanged); coverage script confirms 33/385; diffs targeted, EOL uniform CRLF. **Adversarial review (11-agent workflow, 4 dimensions: B-transform / C-correctness / C-completeness / scripts):** 7 findings → 4 confirmed (all minor/nit, **0 blocker/major**) → all folded (shared exclusion module so coverage 100% stays reachable; merged duplicate imports in org-create/register/admin-teams/admin-games; codemod import-merge + dead-ternary fixes). 3 dismissed (2 out-of-scope inline-`if(error)` returned-error checks, 1 unreachable codemod edge case).
- **Open observations (NOT blocking; for owner/future tranches):** (1) `void` vs `await captureError` — the whole codebase uses `void`; on Amplify-Lambda the awaited critical-alert inside `captureError` is best-effort under `void`. Cross-cutting (6 existing sites too) — left as-is; flag for a follow-up if alert delivery proves flaky. (2) Two uncaptured **critical** inline-`if(error) return 500`s the review surfaced — `auth/coach-signup` (createUser) + `register` (teams insert) — are real observability gaps but out of Mechanism C's catch-only scope; consider a tiny follow-up.
### Build Log — Tranche 1 (game-day hot path), 2026-06-11
- **B-only, 6 files / 10 handlers** wrapped via the codemod: `admin/check-in` (GET+POST), `admin/divisions` (GET+POST), `admin/schedule-facility-lanes` (GET+POST), `admin/schedule-publish` (POST), `scorekeeper/[orgSlug]/score` (PATCH), `official/[orgSlug]/score` (GET). No Mechanism C (game-day routes mostly rethrow → `onRequestError` covers them).
- **Special case — `official` ↔ `scorekeeper` shared GET:** `scorekeeper/.../score` re-exported `official`'s GET (`export const GET = getOfficialScore`). Naive wrapping would either mis-attribute scorekeeper GETs to the official route or **double-wrap**. Fix: `official` now exports a raw `getScore` handler (unwrapped) and wraps it for its own route; `scorekeeper` imports the raw `getScore` and wraps it under `/api/scorekeeper/[orgSlug]/score`. One wrap each, correct per-route attribution. (The codemod skip-and-reported the `export const GET =` alias — hand-resolved.)
- **Verified:** typecheck exit 0; ESLint 0 errors (6 pre-existing `no-explicit-any` warnings); coverage **8.6% → 11.1% (43/387)**; smoke — `official`/`scorekeeper` score → 401 + `x-request-id` (refactored pair compiles & runs, no double-wrap), `admin/*` → 307 (proxy redirects unauth before the handler — behaviour-preserving). EOL uniform CRLF, targeted diffs.
### Build Log — Tranche 2 / domain 1 = `api/admin/accounting`, 2026-06-11
- **B-only, 17 files / 25 handlers**, all transformed by the codemod — **ZERO skips/hand-wraps** (clean mechanical sweep; no aliases, arrows, edge, or streaming). Routes: budget-categories (GET+POST), budget-categories/[catId]/items (POST), budget-categories/[catId]/items/[itemId] (PATCH+DELETE), budget-plan (GET), budget-plan/lines (POST), budget-plan/lines/[lineId] (PATCH+DELETE), budget-plan/lines/[lineId]/periods (POST), budget-plan/lines/[lineId]/allocate-to-teams (POST), budget-plan/lines/[lineId]/allocation-preview (GET), budget-vs-actual (GET), categories (GET), ledgers (GET+POST), ledgers/[ledgerId] (GET+PATCH), ledgers/[ledgerId]/entries (GET+POST), ledgers/[ledgerId]/entries/[entryId] (PATCH+DELETE), payees (GET+POST), transfers (POST). No Mechanism C (Tranche-2 is B-only per locked scope; accounting catches that return 500 are out of the money/identity C-scope).
- **Verified:** `npm run typecheck` exit 0; `npx eslint` on the 17 changed files → **0 errors** (57 pre-existing `no-explicit-any` warnings, none introduced by the wrap); codemod idempotent re-run reports 25 already-wrapped / 0 transformed; coverage **11.1% → 17.6% (68/387)**; smoke — changed routes (incl. dynamic `[ledgerId]`) all return **307** redirect to `/auth/login` (unauth `/api/admin/*` is redirected by the proxy auth guard *before* the wrapped handler — behaviour-preserving; the wrap only runs on the authenticated path where `proxy.ts` line 183 stamps `x-request-id`). `git diff --stat` shows targeted per-file changes (17 files, +70/−59), EOL uniform CRLF. `proxy.ts` + `lib/observability/*` untouched by this domain (their working-tree mods are the pre-existing Mechanism A / T0-T1 work).
### Build Log — Tranche 2 / domain 2 = `api/admin/rep-teams`, 2026-06-11
- **B-only, 29 files / 47 handlers**, all transformed by the codemod — **ZERO codemod skips** (no aliases/arrows/edge/streaming). Covers allocations(+splits/installments/send-reminders), billing-preview, bulk-rename-slugs, document-templates(+[templateId]), dues/send-automated-reminders, groups(+[groupId]), past, payment-requests(+[id]), the rep-teams root, teams(+[teamId] +history), players/[playerId]/documents(+[docId]), program-years(+[yearId] +roster +coaches +events(+[eventId]) +tryouts(+[regId])), and upcoming-payables. No Mechanism C (Tranche-2 is B-only).
- **HAND-FIX (verify-stage, NOT a codemod skip) — 4 files / 9 handlers:** `document-templates/[templateId]`, `teams/[teamId]/players/[playerId]/documents`, `…/documents/[docId]`, `teams/[teamId]/program-years/[yearId]/events/[eventId]`. These share a `resolve*()` helper returning `{ error } | { …success }`, consumed via `if ('error' in resolved) return resolved.error;`. TS's `'error' in` narrowing types the *access* `resolved.error` as `NextResponse | undefined` (a known `in`-narrowing looseness), so each handler's inferred return widened to `Promise<Response | undefined>`. As plain `export async function` exports this was invisible (Next's `RouteHandlerConfig` validator tolerates `undefined`/void returns); `withObservability`'s stricter `AnyRouteHandler` (`Promise<Response> | Response`) surfaced it as a typecheck error. **Fix = a type-only non-null assertion `resolved.error!`** on that one access (idiomatic — these files already use `ctx!` pervasively; the success-branch destructure narrows fine, so only the error access needed it). **Behaviour-preserving: type-only, zero runtime change** — `resolved.error` is always a real `Response` in that branch at runtime. The shared `with-observability.ts` was deliberately NOT relaxed (its strictness is correct; relaxing it would mask genuine missing-return bugs). *(Decision rule for later domains: a `Promise<Response | undefined>` typecheck error on a `resolve*`/`'error' in` route is this same looseness → fix with `resolved.error!`, do not touch the wrapper.)*
- **Verified:** `npm run typecheck` exit 0 (the `!` cleared all 9 handler errors + the downstream `.next/dev/types/validator.ts` errors); `npx eslint` on the 29 changed files → **0 errors** (40 pre-existing `no-explicit-any` warnings); codemod idempotent re-run reports 47 already-wrapped / 0 transformed; coverage **17.6% → 29.7% (115/387)**; smoke — root, `teams`, dynamic `document-templates/[templateId]`, and deep `…/program-years/[yearId]/events/[eventId]` all return **307** (proxy auth-guard redirect before the handler — behaviour-preserving). `git diff --stat` targeted (29 files, +163/−200), EOL uniform CRLF on the hand-fixed files too. `proxy.ts` + `lib/observability/*` untouched.
### Build Log — Tranche 2 / domain 3 = `api/admin/house-league`, 2026-06-11
- **B-only, 18 files / 31 handlers**, all transformed by the codemod — **ZERO codemod skips, ZERO hand-fixes** (typecheck passed first try — these routes don't use the `'error' in resolved` helper pattern that needed the rep-teams `resolved.error!` fix). Covers seasons(+[seasonId]) and its sub-resources: divisions(+[divisionId]), draft, email, ledger, placement, practices(+[practiceId]), registrations(+[regId]), schedule(+[gameId] +generate), standings, teams(+[teamId]).
- **Verified:** `npm run typecheck` exit 0 (first pass, no hand-fix); `npx eslint` on the 18 changed files → **0 errors** (7 pre-existing `no-explicit-any` warnings); codemod idempotent re-run reports 31 already-wrapped / 0 transformed; coverage **29.7% → 37.7% (146/387)**; smoke — `seasons`, dynamic `seasons/[seasonId]`, `…/divisions`, and deep `…/schedule/[gameId]` all return **307** (proxy auth-guard redirect before the handler — behaviour-preserving). `git diff --stat` targeted (18 files, +109/−149), EOL uniform CRLF (codemod-only, no hand edits). `proxy.ts` + `lib/observability/*` untouched.
### Build Log — Tranche 2 / domain 4 = remaining `api/admin/**`, 2026-06-11
- **B-only, 59 files / 82 handlers**, all transformed by the codemod — **ZERO codemod skips** (no aliases/arrows/edge/streaming; the export/template/import routes return plain `Response`/`NextResponse`, not `ReadableStream`, so the wrap is safe). This completes `api/admin/**` → **198/198 wrapped**. Domains: attention-summary, communications, email(+resubscribe/send/sends), members(+[memberId](+assignments/reinvite)/audit/count/invite), org-hero-banner, org-logo(+stock), org-settings, org/* (complete-onboarding, founding-season-status, has-tournaments, notification-preferences, onboarding-plan/survey, pdf-settings, request-deletion, startup-tasks, team-links, venues), pool-slots, public-site, seal-tournament, setup-tournament, tournament-activity/-archives/-branding/-dashboard/-hero-banner/-logo/-worklist, and tournaments(+[tournamentId]/(clone, imports/history, notification-preferences, populate-from, registration-fields(+[fieldId]), registrations(+[regId]/resend-access, bulk, export, import/(commit, history, preview, template), payment-reminders), schedule/import/(commit, preview, template), summary)).
- **HAND-FIX 1 (verify-stage) — 9 files / 11 sites, `X.response!`:** the tournament `registration-fields` + `registrations/import` + `schedule/import` routes share guard helpers (`getScopedTournament`, `guardField`, `authorizeTournamentTeamImport`, `authorizeTournamentScheduleImport`) returning `{ response } | { …success }`, consumed via `if ('response' in <var>) return <var>.response;`. Identical `in`-narrowing looseness to the rep-teams `resolved.error!` case (just `.response` instead of `.error`) → handler return widened to `Promise<Response | undefined>`, rejected by the stricter wrapper. Fixed with a type-only `<var>.response!` non-null assertion at each site (vars: `scoped`×2, `guarded`×2, `auth`×7). Behaviour-preserving (type-only; `.response` is always a real `Response` in that branch). Wrapper deliberately NOT relaxed.
- **HAND-FIX 2 (pre-existing lint, folded in) — 1 site:** `org/venues/route.ts:61` had `let facilityByVenue` (never reassigned, only property-mutated) → a pre-existing `prefer-const` ESLint **error** (confirmed present in git HEAD; it only surfaced because the wrap pulled the file into the changed-set). Changed `let`→`const` so the changed-files eslint gate stays at 0 errors. Behaviour-preserving.
- **Verified:** `npm run typecheck` exit 0 (the 11 `.response!` cleared all 9-file handler errors + downstream `.next/dev/types/validator.ts` errors); `npx eslint` on the changed admin files → **0 errors** (172 pre-existing `no-explicit-any` warnings); codemod idempotent re-run reports 198 already-wrapped / 0 transformed across `app/api/admin`; coverage **37.7% → 58.9% (228/387)**; smoke — members, org-settings, tournaments, dynamic `…/registration-fields[/f1]`, hand-fixed `…/registrations/import/template` + `…/schedule/import/preview`, and `org/venues` all return **307** (proxy auth-guard redirect before the handler — behaviour-preserving). EOL uniform CRLF on the hand-fixed files. `proxy.ts` + `lib/observability/*` untouched.
### Build Log — Tranche 2 / domain 5 (LAST) = `api/coaches/**`, 2026-06-11
- **B-only, 54 files / 86 handlers**, all transformed by the codemod — **ZERO codemod skips** (no aliases/arrows/edge/streaming). Completes Tranche 2. **Scope note:** includes the **untracked Free-Tier Phase-5 files under `app/api/coaches/tournaments/**`** (new, not yet committed — this domain is actively developed; owner greenlit wrapping it, accepting a possible rebase). Covers the `coaches/[orgSlug]/**` accounting + team-management surface (budget-items, payees, team-links, and the full `teams/[teamId]/*` tree: accounting-settings, allocations, budget(+plan/lines/periods/installments/preview), budget-vs-actual, documents/templates, dues(+schedules/installments/reminders), events(+attendance/lineup), expenses, fundraisers(+entries), history, payees, payment-requests, players/dues-credits, roster(+documents), season-surplus, upcoming-payables) plus the Phase-5 `tournaments/[teamId]/roster`.
- **HAND-FIX (verify-stage) — 40 files / 63 sites, `resolved.error!`:** the coaches routes uniformly use `resolveCoachContext()`-style guards returning `{ error } | { …success }`, consumed via `if ('error' in resolved) return resolved.error;` — the SAME `in`-narrowing looseness as rep-teams (`.error` flavour). Applied the type-only `resolved.error!` assertion via a small **EOL-safe Node substring-replace** (read utf8 → replace exact `if ('error' in resolved) return resolved.error;` → `…return resolved.error!;` → write utf8; CRLF bytes untouched, idempotent — chosen over 80+ Edit calls). Behaviour-preserving; wrapper untouched. Typecheck then exit 0 (no other undefined sources).
- **Smoke nuance (IMPORTANT, verified pre-existing):** coaches routes are **not** under the `/api/admin` proxy guard, so an unauth request hits the fast-path (x-request-id stamped) and reaches the handler. On a bogus-org/unauth request the `resolveCoachContext` helper **throws**, so Next returns **500** (via `onRequestError`) — NOT a clean 401. Confirmed **pre-existing & behaviour-preserving** by reverting `coaches/[orgSlug]/budget-items` to its unwrapped HEAD version and re-curling: it **also returned 500** (then restored the wrapped version, CRLF intact). The wrap re-throws (never swallows), so the 500 is identical with/without the wrap — now it additionally carries metrics + the stamped `x-request-id`.
- **Verified:** `npm run typecheck` exit 0; `npx eslint` on all 54 coaches route files → **0 errors** (16 pre-existing `no-explicit-any` warnings); codemod idempotent re-run reports 86 already-wrapped / 0 transformed; coverage **58.9% → 81.1% (314/387)**; smoke per above (500 + `x-request-id`, pre-existing). EOL uniform CRLF (codemod + Node fix both preserve it). `proxy.ts` + `lib/observability/*` untouched.
### Build Log — Tranche 3 / domain 1 = `api/platform-admin/**`, 2026-06-11
- **B-only, 45 files / 60 handlers**, all transformed by the codemod — **ZERO codemod skips, ZERO hand-fixes** (typecheck passed first try; platform-admin guards [`requireSuperAdmin`/`requirePlatformPermission`] don't use the `'<key>' in x` resolve-helper shape). Internal/low-volume support surface (orgs, company-users, audit, observability, feedback, bulk-operations, comps/overrides, etc.).
- **EOL note (pre-existing, NOT introduced):** 3 observability files — `observability/[groupId]/status/route.ts`, `observability/issues/export/route.ts`, `observability/sweep/route.ts` — are **uniformly LF** in the working tree AND in git HEAD (authored LF during the observability feature; the rest of the repo is CRLF). The codemod is per-file **EOL-preserving**, so it kept them LF (verified: `sweep` has CRLF:0 / 45 LF lines = uniform, NOT mixed; diff is a clean 5-line wrap, not a full-file flip). Git's `autocrlf=true` emits a cosmetic "LF will be replaced by CRLF" warning on these pre-existing LF files regardless of this change — left as-is (normalizing EOL is out of scope for behaviour-preserving wrapping; flag for a separate `* text=auto`/`.gitattributes` cleanup if desired).
- **Verified:** `npm run typecheck` exit 0 (first pass, no hand-fix); `npx eslint` on the 45 changed files → **0 errors** (2 pre-existing `no-explicit-any` warnings); codemod idempotent re-run reports 60 already-wrapped / 0 transformed; coverage **81.1% → 96.6% (374/387)**; smoke — `audit/export` + `company-users` → **403** (super-admin/permission gate, behaviour-preserving), `bulk-operations`/`sweep` GET → **405** (POST-only routes, no GET handler — unchanged), all carry `x-request-id` (platform-admin API hits the proxy fast-path → handler). `proxy.ts` + `lib/observability/*` untouched.
### Build Log — Tranche 3 / domain 2 (FINAL) = `public` + `notifications` (remaining) + 4 singletons, 2026-06-11
- **B-only, 13 files / 13 handlers**, all transformed by the codemod — **ZERO codemod skips, ZERO hand-fixes** (typecheck passed first try). Buckets: `public/**` (7 — fan-push subscribe/unsubscribe, stats, team-profile, tournament-data, tournament-plus-event, tournaments), `notifications/push/{subscribe,unsubscribe}` (2 — the last unwrapped notifications handlers; `notifications/route.ts` + `org-context` were the original two wrapped routes), and the 4 singletons `early-access`, `feedback`, `plan-gating`, `send-message` (1 each).
- **EOL note:** `feedback/route.ts` is an **untracked** (uncommitted Phase-3) file authored **uniformly LF** — codemod preserved it (verified CRLF:0 / 168 LF = uniform, NOT mixed). All other 13 files CRLF. Batch check across the buckets: **0 mixed-EOL files.** Same pre-existing-LF situation as the platform-admin observability files; left as-is.
- **Verified:** `npm run typecheck` exit 0; `npx eslint` on the changed files → **0 errors** (4 pre-existing `no-explicit-any` warnings); codemod idempotent re-run → 0 transformed across all 6 buckets; **coverage 96.6% → 100.0% (388/388)** — the tracker's "largest unwrapped domains" list is now EMPTY; smoke — `public/tournaments` + `public/stats` + `plan-gating` → **200 OK** (the wrap is fully transparent on the happy path AND stamps `x-request-id` on the mutable NextResponse), `feedback`/`notifications/push/subscribe` GET → **405** (POST-only, unchanged), all carry `x-request-id`. `proxy.ts` + `lib/observability/*` untouched.

---

## ✅ ROLLOUT COMPLETE (2026-06-11)

**Mechanism A** (global `x-request-id` stamp) shipped 2026-06-10. **Mechanism C** (swallowed-500 `captureError`) applied to money/identity (Tranche 0). **Mechanism B** (per-route `withObservability` wrapping) is now at **100.0% (388/388 wrappable handlers)** across Tranches 0–3, leaving only the 2 by-design exclusions (`api/dev/**`, `api/client/error-capture`). The platform-admin calls-vs-errors chart now has a real denominator across the entire API, and every server route carries a `requestId`.

**Per-domain hand-fix ledger (all type-only, behaviour-preserving; the shared `with-observability.ts` was never relaxed):**
- `resolved.error!` — rep-teams (4 files/9), coaches (40 files/63): `resolveCoachContext`/`resolve*` guards returning `{ error } | { …success }`, the `'error' in resolved` access widening to `| undefined`.
- `X.response!` — remaining-admin (9 files/11): tournament `getScopedTournament`/`guardField`/`authorize*Import` guards, the `'response' in X` flavour.
- `prefer-const` cleanup — remaining-admin (1, `org/venues`): pre-existing `let`→`const`.
- **Rule for any future route:** a `Promise<Response | undefined>` typecheck error after wrapping = the `if ('<key>' in x) return x.<key>;` guard-narrowing looseness → assert `x.<key>!`; never relax the wrapper.

**Smoke status reference (behaviour-preserving, all carry `x-request-id`):** `/api/admin/*` unauth → **307** (proxy auth-guard redirects before the handler); orgSlug-scoped (`coaches`) bogus-org unauth → **500** (resolve helper throws → onRequestError — pre-existing, verified by HEAD-revert); platform-admin → **403** (super-admin gate) / **405** (POST-only GET); public → **200** (transparent passthrough). One mint site (proxy fast-path / `proxy.ts` line 183), wrapper adopts.

**Not committed** (branch `feat/free-tier-coaches` = trunk → commit = prod deploy). Per-domain staging lists are in each Build Log / the session report. **Future routes:** the codemod + coverage tracker + shared exclusions remain; run the codemod on any new route folder to keep coverage at 100%.

**Branch when built:** `feat/free-tier-coaches` (dev default; no master without explicit request)
**Owner:** Platform / Observability
**Created:** 2026-06-10
**PM brief:** [OBSERVABILITY_ROUTE_INSTRUMENTATION_PM_BRIEF.md](OBSERVABILITY_ROUTE_INSTRUMENTATION_PM_BRIEF.md)
**Parent feature:** [OBSERVABILITY_ERROR_TRACKING_PLAN.md](../active/OBSERVABILITY_ERROR_TRACKING_PLAN.md) — this formalizes that plan's incremental-wrapping intent (§4 "hottest routes first, codemod the rest", §10 Phase 5 "codemod-assisted sweep + track coverage %", §12 "wrap by traffic priority", and the "proxy.ts-level fallback" idea). It is the engine that makes Phase 1's metrics chart meaningful and lifts Phase 3's bug→error deep-link from best-effort to broad.

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

## 4. Mechanism A — global `requestId` stamp (the high-leverage move) — ✅ BUILT 2026-06-10

**Outcome:** every server route response carries `x-request-id`, and Phase 3's client stash captures it regardless of whether the route is wrapped.

> **As built (2026-06-10, with Observability Phase 3):** items 1–4 below shipped, with one addition the adversarial review surfaced — `instrumentation.ts onRequestError` now reads `x-request-id` off the request and threads it to `captureError` (new `requestId` opt; `opts.requestId ?? reqCtx?.requestId ?? null`), so the proxy id is stored on `error_events.request_id` for the global-capture path (uncaught/RSC errors), not just `withObservability`-wrapped routes. Matcher widened to `/api/:path*`; `/api/admin/*` retains the full session-checked proxy (its unauthenticated→login guard preserved). Verified: typecheck/lint/34 unit tests green.

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

## 7. The codemod (Mechanism B at scale) — ✅ BUILT (`scripts/wrap-route-observability.mjs`)

> **As built (2026-06-11):** uses the **TypeScript compiler API** (already a dep) rather than ts-morph/jscodeshift — zero new install, no `package.json`/Amplify-pnpm risk. EOL-preserving (repo `core.autocrlf=true`). Inserts the import via the barrel `@/lib/observability` (matches the existing wrapped routes + co-locates `captureError`), **merging into an existing same-module import** when present. Default dry-run; `--write` to apply; `--json` for a machine report. Idempotent (a wrapped handler re-reports as already-wrapped). Permanent exclusions live in the shared `scripts/observability-route-exclusions.mjs`.

A script (`scripts/wrap-route-observability.mjs`) that transforms:

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
| **0 — money/identity** ✅ **BUILT 2026-06-11** | `api/billing/*`, `api/auth/*`, `api/register`, `api/registrations/*`, `api/league/**/register`, `api/rep-teams/**/register`, `api/org/create` (+ `api/admin/teams`, `api/admin/games`) | 24 files / 30 handlers + 9 C-catches | B + **C** | Done: wrapped + `captureError` on swallowed-500 catches; existing-capture routes wrapped for ALS attribution. `client/error-capture` excluded. |
| **1 — game-day hot path** ✅ **BUILT 2026-06-11** | `api/scorekeeper/**`, `api/official/**`, `api/admin/check-in`, `api/admin/schedule-facility-lanes`, `api/admin/schedule-publish`, `api/admin/divisions` (`admin/games`+`admin/teams` already done in T0) | 6 files / 10 handlers | B | Done. Live-scoring/check-in surface. Included an `official`↔`scorekeeper` shared-raw-handler refactor (see Build Log). |
| **2 — CRUD bulk** | `api/admin/accounting/**` ✅ **BUILT 2026-06-11** (17 files/25 handlers, 0 skips); `api/admin/rep-teams/**` ✅ **BUILT 2026-06-11** (29 files/47 handlers, 0 codemod-skips + a 4-file `resolved.error!` type-only hand-fix); `api/admin/house-league/**` ✅ **BUILT 2026-06-11** (18 files/31 handlers, 0 skips/hand-fixes); remaining `api/admin/**` ✅ **BUILT 2026-06-11** (59 files/82 handlers, 0 codemod-skips + 11-site `X.response!` hand-fix + 1 `prefer-const` cleanup → **`api/admin` 198/198 wrapped**); `api/coaches/**` ✅ **BUILT 2026-06-11** (54 files/86 handlers, 0 codemod-skips + 40-file/63-site `resolved.error!` hand-fix; incl. untracked Phase-5 `coaches/tournaments/**`) | ~200 | B | Codemod sweep, **one domain folder per PR**. **Tranche 2 COMPLETE** (5 domains; `api/admin/**` + `api/coaches/**` fully wrapped). |
| **3 — platform-admin + misc** | `api/platform-admin/**` ✅ **BUILT** (45 files/60); `api/public/**` + `api/notifications/push/*` + `api/early-access`/`api/feedback`/`api/plan-gating`/`api/send-message` ✅ **BUILT 2026-06-11** (13 files/13, 0 skips/hand-fixes) | ~70 | B | **COMPLETE.** Coverage **100.0% (388/388)**. |
| **Excluded** | `api/dev/**`, `api/dev/seed/**` | — | none | Dev-only; never wrapped. |

Order is deliberate: Tranche 0 protects money/identity (and pairs with Mechanism A so Phase 3's deep-link works on exactly the routes most likely to 5xx); 2 is the bulk and can land over many small PRs at a comfortable pace.

## 9. Coverage tracking — ✅ BUILT (`scripts/check-observability-coverage.mjs`)

> **As built (2026-06-11):** prints `wrapped / total handlers (xx.x%)` + the largest unwrapped domains; `--json` for machine output; always exits 0 (report, not a gate). Shares `scripts/observability-route-exclusions.mjs` with the codemod, so permanently-excluded routes (`api/dev/**`, `api/client/error-capture`) drop from **both** numerator and denominator — 100% stays reachable. Baseline after Tranche 0: **33 / 385 (8.6%)**.

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
