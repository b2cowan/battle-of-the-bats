# Next.js 16.2.4 → 16.3.0 — Upgrade Plan

**Status:** IN EXECUTION 2026-08-12 — §10 Steps 0–3 DONE: **16.3.0 on dev (`8d0688b6`)**, V1–V6
green, §12 measured both sides; Gate 3 delivered and **D6 executed** (supervisor + heap ceiling +
sweep guards KEPT on the measured verdict; dev.mjs / memory-guard / AGENTS.md reworded to match —
the self-retirement notice now aims at >16.3). Now: Step 4 (V7 prod-build test + 2–3 day V8 soak);
Step 5 promote ⛔ is the owner's.
**Companion:** [NEXT_16_3_UPGRADE_PM_BRIEF.md](NEXT_16_3_UPGRADE_PM_BRIEF.md) (plain-language brief)
**Origin:** [NEXT_16_3_UPGRADE_PROMPT.md](NEXT_16_3_UPGRADE_PROMPT.md) — its 2026-08-11 measurements and claims were
re-verified per its own instruction; the corrections are in §1.
**Method:** 12-agent research workflow (release notes, all skipped patch notes, both upstream issues,
post-release field reports, official docs) + direct inspection of the published `next@16.3.0` tarball
+ two adversarial verification passes. Every load-bearing claim below carries its source.

---

## 0. The one-paragraph verdict

Upgrade — and with more urgency than the memory story alone would justify. Re-verification found
something the original prompt did not know: **staying on 16.2.4 is a confirmed exposure to 21
published security advisories (11 High severity), several of them bypasses of the proxy layer this
app uses as its auth and demo-sandbox chokepoint** (§2). Separately, the dev-memory fix in 16.3.0 is
real but **not proven to cover the exact per-request leak measured here on 2026-08-11** — upstream
fixed a different (larger) leak class, and neither cited issue contains our fingerprint (§3). So this
plan treats the local before/after measurement as the deciding gate for the mitigation scaffolding,
not the release notes. Adversarial verification (§11) went further: the per-request leak is likely
[vercel/next.js#85666](https://github.com/vercel/next.js/issues/85666) — root-caused upstream on
2026-08-12 to React's dev-only promise-tracking instrumentation in the exact runtime file our
profiler blamed, still OPEN, **not** claimed fixed by 16.3.0. Expectation set accordingly: the
upgrade very likely fixes the per-compile memory hold (the larger half of the dev pain, and the
whole sweep problem) and may leave the per-request drip — which the retained supervisor contains.
One regression that shipped in 16.3.0 sits near our architecture (stale request headers in the
proxy, vercel/next.js#97049), but our code uses a different, likely-unaffected pattern, and its
upstream fix has NOT shipped in any release or canary yet — so waiting for 16.3.1 buys little.
Recommended shape: ship the pending 20-commit feature pile first, land the upgrade on dev
immediately behind local verification, soak 2–3 days, promote as its own isolated release (§10).

## 1. Verified current state (2026-08-12)

| Fact | Value | How verified |
|---|---|---|
| Installed + declared `next` | 16.2.4 (both) | `node_modules/next/package.json` + `package.json` |
| `eslint-config-next` | 16.2.4, exact pin | `package.json` |
| Lockfiles | **BOTH tracked, both at 16.2.4** — `pnpm-lock.yaml` (Amplify's source of truth via `pnpm install`) and `package-lock.json` (local npm) | `git ls-files` + content grep |
| npm `latest` | **16.3.0**, published 2026-08-03 (9 days old) | `npm view next dist-tags` / `time` |
| Stable 16.3.1 | Does not exist; `16.3.1-canary.0`–`.13` cut daily since 08-04 | `npm view` + GitHub tags |
| Skipped patches | 16.2.5 (05-06), 16.2.6 (05-07), 16.2.7 (06-01), 16.2.8/16.2.9 (06-10), 16.2.10 (07-01), 16.2.11 (07-21), 16.2.12 (07-25) | npm registry timestamps |
| React | 19.2.4 satisfies 16.3.0 peers (`^18.2.0 \|\| ^19.0.0`) | 16.3.0 tarball `package.json` |
| Node floor | `>=20.9.0` — **identical to 16.2.4**, so Amplify's current build image already satisfies it; local is v24.16.0 | both `engines` fields |
| `next build --webpack` | Still supported in 16.3.0 — CLI option definition byte-identical | tarball `dist/bin/next` diff |
| Heap-ceiling mechanism | `getMaxOldSpaceSize()` **byte-identical** in 16.3.0 — still reads only the `NODE_OPTIONS` env var | tarball `dist/server/lib/utils.js` diff |

**Corrections to the 2026-08-11 prompt** (it asked to be re-verified; these are the deltas):

1. **Only one of the two cited issues was fixed.** #81161 was closed 2026-08-06 by a core
   maintainer as "solved in 16.3". **#91396 remains OPEN** with no comment crediting 16.3
   ([#91396](https://github.com/vercel/next.js/issues/91396)).
2. **The "up to 90%" claim is real but scoped.** Official source: the Next.js blog
   ([next-16-3](https://nextjs.org/blog/next-16-3#less-memory-usage-in-dev),
   [next-16-3-turbopack](https://nextjs.org/blog/next-16-3-turbopack#reducing-memory-usage-in-dev-mode)).
   It describes **long-dev-session route-graph cache memory** (Vercel's own apps: 21.5 GB → 2 GB;
   4.6 GB → 840 MB), with the explicit caveat "no single reduction percentage … applies to every
   application."
3. **Neither issue matches our fingerprint.** A keyword sweep of both full comment threads found
   zero occurrences of per-request linear growth, `arrayBuffers`, or
   `app-page-turbo.runtime.dev.js` as a leak locus. Upstream describes memory growth per **route
   compile** and with **persistent-cache size** — not ~2.7 MB per request against an
   already-compiled page. Our leak may be a third, unreported bug. **"Our leak is fixed in 16.3.0"
   is therefore UNPROVEN until re-measured locally** — which this plan makes the central gate (§8 V4).
4. The prompt's "fixed in 16.3.0, reported reductions up to 90%" framing conflated those two
   things; the plan below keeps them separate throughout.

## 2. Why now — the security exposure (new finding, changes the urgency)

Verified against the GitHub Security Advisory API's `vulnerable_version_range` for every advisory
patched in 16.2.5, 16.2.6 and 16.2.11 — all include 16.2.4. **21 advisories: 11 High, 7 Moderate,
2 Low.** The Highs:

| Advisory | CVE | Class | Applies to this app? |
|---|---|---|---|
| GHSA-267c-6grr-h53f | CVE-2026-44575 | **Proxy/middleware bypass** (segment prefetch) | Yes — App Router, proxy-gated |
| GHSA-26hh-7cqf-hhc6 | CVE-2026-45109 | **Proxy bypass** (incomplete-fix follow-up) | Yes |
| GHSA-492v-c6pp-mqqv | CVE-2026-44574 | **Proxy bypass** (dynamic route param injection) | Yes — dynamic `[orgSlug]` routes everywhere |
| GHSA-c4j6-fc7j-m34r | CVE-2026-44578 | SSRF via WebSocket upgrades | Plausible |
| GHSA-p9j2-gv94-2wf4 | CVE-2026-64645 | SSRF in rewrites w/ attacker-controlled hostname | Must-assume-yes (host-matched redirects exist) |
| GHSA-89xv-2m56-2m9x | CVE-2026-64649 | SSRF in Server Actions on custom servers | No (no custom server) |
| GHSA-8h8q-6873-q5fj | (none) | DoS w/ Server Components | Yes |
| GHSA-mg66-mrh9-m8jx | CVE-2026-44579 | DoS, connection exhaustion w/ Cache Components | No (`cacheComponents` unused) |
| GHSA-m99w-x7hq-7vfj | CVE-2026-64641 | DoS in App Router Server Actions | Yes (Server Actions in use) |
| GHSA-36qx-fr4f-26g5 | CVE-2026-44573 | Proxy bypass, Pages Router i18n | **No** (no Pages Router, no i18n) |
| GHSA-6gpp-xcg3-4w24 | CVE-2026-64642 | Proxy bypass, Turbopack build + single locale | **No** (prod builds with webpack) |

Why the bypass cluster matters *here specifically*: `proxy.ts` is the single chokepoint for the
demo-sandbox write block, the admin/platform-admin auth gates, and org-context header forwarding. A
proxy bypass is not an abstract CVE for this app — it is "writes reach the public demo orgs" and
"auth checks can be routed around."

Consequences for the plan:
- The upgrade stopped being quality-of-life the day these published. **Production is on 16.2.4.**
- **The rollback floor is 16.2.12** (fully patched line-mate) — never roll back past it (§9).
- If the 16.3.x promote were to slip beyond ~a week, promoting a minimal 16.2.12 bump to prod first
  becomes a legitimate emergency rung (owner decision D2, §5).

## 3. What 16.3.0 actually is (and what it is not)

**The memory fix, mechanically.** Two defaults now combine in dev: the Turbopack FileSystem cache
(default-on for dev since 16.1, at `.next/dev/cache/turbopack`) and **new memory eviction**
(`experimental.turbopackMemoryEviction`, default `'auto'`, 16.3.0) — after Turbopack persists a
snapshot to disk it evicts the in-memory copies and reloads on demand, plus "small incremental wins:
compressing data structures and avoiding storing data longer than was necessary" (maintainer
mischnic: "16.3 … drops data from memory when/after it was written to the FS cache"). This directly
targets our **per-route-compile** cost (~70–100 MB public / ~240 MB coach pages held forever) and the
"a swept server is a spent server" behavior. It does **not** describe a per-request retention fix —
hence §8 V4 measures both dimensions separately. Community pre-release datapoints trend the right
way (4 GB→1.5 GB; 20 GB→5 GB; "16.3 prevented the linear 16.2.10 growth"), all long-session/cache
scenarios.

**Also in the box (fitted to this repo):**
- Native Node streams in App Router SSR — up to 22% more requests under load, prod-facing, zero code
  change (PR #94311). Free win.
- Faster builds via Turbopack build FS-cache default — **irrelevant**: prod builds pin `--webpack`.
- Faster type-checking (TS 7 in `next build`) — **irrelevant**: build-time typecheck is deliberately
  disabled here (`ignoreBuildErrors`, typecheck runs pre-push instead).
- Opt-in features we are NOT adopting in this upgrade: `cacheComponents`/`partialPrefetching`
  (Instant Navigations), `import.meta.glob` (Turbopack-only anyway), `next/root-params`,
  `catchError`, `useOffline`, Rust React Compiler. Zero config drift: repo has no `experimental`
  block today.
- **`next dev` now auto-writes an `AGENTS.md` block** when it detects an AI coding agent (verified in
  tarball: `generate-agent-files.js`, managed block delimited by `<!-- BEGIN:nextjs-agent-rules -->`;
  opt-out `agentRules: false` exists in the config schema). Our `AGENTS.md` is hand-authored and
  load-bearing → decision D4.
- Deprecations with **zero surface here** (all verified by grep, not assumption): edge runtime
  (all ~39 `export const runtime` are `'nodejs'`; no `middleware.ts` exists), `revalidateTag`
  single-arg (zero uses), `unstable_*` APIs (zero uses), `next/legacy/image` + `images.domains`
  (zero uses, no `images` block), parallel-route `default.js` (no `@slot` dirs), custom server
  methods (no custom server), `serverRuntimeConfig`/`publicRuntimeConfig` (zero uses), ESLint
  flat-config default (already on `eslint.config.mjs`), smooth-scroll opt-in (already set via
  `data-scroll-behavior` in `app/layout.tsx`).

**Field state, 9 days post-release** (relevance-ranked; full list in the research transcript):

| Issue | What | Relevance here |
|---|---|---|
| [#97049](https://github.com/vercel/next.js/issues/97049) | **`headers()` returns stale request headers in Proxy after mutation — regression in 16.3.0** (root cause traced to PR #95116: `headers()` became a frozen copy instead of a live view). ⚠ Its fix has **NOT shipped**: contributor fix PR #97145 was closed **unmerged** 2026-08-12, and no 16.3.1 canary through `.13` carries a headers/proxy fix (an earlier report of "fix PR #97166 merged" did not survive verification) | **MEDIUM here.** The regression hits code that calls `headers()` *inside* the proxy — our proxy never does; it mutates plain `Headers` and forwards via `NextResponse.next({request:{headers}})`, a different code path the deep-dive judged likely unaffected. Probe V5 settles it empirically; a future refactor that calls `headers()` inside `proxy.ts` would walk into it |
| [#85666](https://github.com/vercel/next.js/issues/85666) | **OPEN: "Memory leak on async calls in dev server" — root-caused 2026-08-12** to React's dev-only async-debug instrumentation (`async_hooks` promise tracking) in `app-page-turbo.runtime.dev.js`: every promise gets a WeakRef + record, chains outlive collection under sustained request load; controlled A/B (disabling the instrumentation) eliminated the growth; "production builds unaffected." Reporter tested 16.1.6; no 16.3.0 retest on record | **HIGH — this is very likely OUR per-request leak** (same file, dev-only, request-volume-driven, matches the 2026-08-11 fingerprint better than either issue the prompt cited). NOT claimed fixed by 16.3.0 → V4a measures; if it persists, this is the issue to contribute our repro to |
| [#96705](https://github.com/vercel/next.js/issues/96705) | Dev: server-side HMR permanently stops applying once a browser connects; restart-only recovery; workaround `experimental.turbopackServerFastRefresh: false` | MEDIUM (dev QoL only) — explicit soak watch item |
| [#96982](https://github.com/vercel/next.js/issues/96982) | Windows: **polling** file-watcher drops edits | LOW — only with `watchOptions.pollIntervalMs`; we use native watching |
| [#97231](https://github.com/vercel/next.js/issues/97231) | webpack build + i18n + Pages Router dynamic API routes 404 | N/A — no i18n, no Pages Router |
| [#96626](https://github.com/vercel/next.js/issues/96626) | Turbopack **build** EISDIR panic on symlinked dirs (pnpm) | N/A — prod builds with webpack |
| [#96747](https://github.com/vercel/next.js/issues/96747) | Silent dependency-tracing gaps → prod 500s with `output: standalone` (predates 16.3.0) | N/A — no `standalone` |
| [#96594](https://github.com/vercel/next.js/issues/96594) | PPR caching regression via `htmlLimitedBots` | N/A — no such config |

Also checked and ruled out for this profile: #96646 (`output: standalone` ENOENT on Vercel — no
`output` field here, and the failing hook is Vercel-proprietary, absent on Amplify), #97015
(tsconfig paths dropped under `--webpack` — trigger is `typescript` aliased to
`@typescript/typescript6`; we pin plain `^5`), #96650 (Vercel `/opt/rust/bytecode.js` module-load
failures — Vercel-proprietary runtime, twice bot-closed without repro), #96975 (Safari
infinite-reload in Turbopack dev — needs WebKit), #96619/#96976 (Turbopack **build** regressions —
we build with webpack).

**16.3.1 outlook:** imminent-but-unscheduled (14 canaries in 8 days) — but verified canary notes
`.0`–`.13` do **not** carry the #97049 proxy-headers fix, so waiting for 16.3.1 does not buy the one
fix that would matter most here. The team does cherry-pick fast when repros land (#96594 was fixed
in canary.2 the day after report).

## 4. The change, file by file

One commit (the bump), one optional follow-up commit (mitigation retirement, gated on measurement):

| File | Change | Why |
|---|---|---|
| `package.json` | `next` 16.2.4→16.3.0; `eslint-config-next` 16.2.4→16.3.0 (lockstep); **`sharp` `^0.34.5`→`^0.35.3`** | eslint config is version-paired; sharp: 16.3.0's own optional dep moved to `^0.35.3` — a range `^0.34.5` does not satisfy, so bumping next alone risks **two sharp copies** (two native binaries) in the Amplify artifact vs the 220 MB SSR cap. Sharp is a *runtime* dependency here (`lib/pwa-icon.tsx` renders icons per request), so the versions must converge |
| `pnpm-lock.yaml` + `package-lock.json` | regenerate both | both are tracked; Amplify installs from pnpm, local from npm — a one-lockfile bump ships a split-brain |
| `next.config.ts` | add `agentRules: false` (D4) | keep `AGENTS.md` fully hand-authored; without it, the first `next dev` under an AI agent appends a managed block |
| `scripts/dev.mjs` | **no change in the bump commit** | its self-retirement notice fires automatically at ≥16.3.0 (already built in); heap-ceiling mechanism verified still correct; supervisor retirement is a *measured* decision (§6), not a bump side-effect |
| `AGENTS.md`, `scripts/memory-guard.mjs` doc-comments | follow-up commit only | the "never gives memory back" premise softens only if eviction is *proven here* (V4b) — reword with evidence, per the anti-drift rule |

Everything else: verified zero-surface (§3 deprecations list). No app-code changes required anywhere
— no file under `app/`, `lib/`, or `components/` needs touching for this upgrade.

## 5. Decisions for the owner (the approval gates)

- **D1 — Sequencing.** Recommend: promote the pending 20 feature commits first (already QA-passed),
  then the upgrade as its own isolated promote. Cost of this order: upgrade reaches prod ~3–4 days
  later. Benefit: a prod incident after either promote has exactly one candidate cause. (§10)
- **D2 — Go now vs wait for 16.3.1.** Recommend: **upgrade dev now, promote after soak** — do not
  block on 16.3.1. If 16.3.1 lands during the soak window, take it (small re-verify V1/V4a/V5). If
  soak finds a blocker AND 16.3.1 is still absent AND prod urgency is high, the emergency rung is a
  minimal 16.2.12 promote (clears every CVE, changes nothing else, leak stays — mitigations already
  contain it on dev).
- **D3 — sharp bump in the same commit.** Recommend yes (rationale in §4). The alternative —
  deferring sharp — invites the double-binary artifact problem and tests a pairing (next 16.3 +
  sharp 0.34) that upstream doesn't ship.
- **D4 — `agentRules: false`.** Recommend yes: `AGENTS.md` here is a governed convention document;
  silent framework appends violate the repo's own doc-drift rules. The block's *content* (pointing
  agents at `node_modules/next/dist/docs/`) is already hand-written into our `AGENTS.md`.
- **D5 — Measurement script becomes permanent.** Recommend yes: commit `scripts/measure-dev-memory.mjs`
  (method in §8 V4), runnable on demand — **not** wired into `verify:changed` (needs a live dev
  server and minutes of runtime; as a CI gate it would be flaky and resource-hostile, exactly what
  the verification-workflow rules say to avoid). Why permanent at all: the 2026-08-11 scripts were
  throwaway, and the before/after comparison this plan depends on must be method-identical; future
  Next bumps get the same yardstick for free, and any regression re-measures in minutes.
- **D6 — Mitigation fate** — see §6 table; executed as its own commit after V4, never bundled into
  the bump.

## 6. Fate of the 2026-08-11 mitigations (D6)

| Mitigation | Verdict | Why |
|---|---|---|
| `scripts/dev.mjs` — heap ceiling via `NODE_OPTIONS` | **KEEP permanently** | Verified byte-identical lookup in 16.3.0: Next still substitutes **half of installed RAM** absent the env var. The ceiling bounds *any* future runaway, not just this leak. This is insurance, not scaffolding |
| `scripts/dev.mjs` — supervisor (auto-restart on OOM) | **KEEP until V4 verdict → MEASURED 2026-08-12: KEPT** | V4a: 2.00 MB/req, linear, no plateau — the drip survives 16.3.0 exactly as §11 predicted (#85666). Supervisor comment rewritten to the measured reality; self-retirement notice re-aimed at >16.3 so the next bump re-asks the question; OOM banner no longer blames a "fixed" bug. Owed: contribute the repro to [#85666](https://github.com/vercel/next.js/issues/85666) |
| `scripts/memory-guard.mjs` — sweep preflight/watchdog | **KEEP permanently** | Guards a different risk: total-system free-memory exhaustion during ~29-route cold sweeps. Eviction is probabilistic ('auto' = OS memory-pressure heuristics, explicitly "experimental and under active development") and does not bound Turbopack's native Rust memory. An abort-before-baseline guard stays correct even on a healthy framework |
| `AGENTS.md` memory rules ("swept server is spent", restart-after-sweep) | **REWORD after V4b → REWORDED 2026-08-12** | V4b evidence: full walk ends at 11% of ceiling, RSS returns on idle → restart-after-sweep no longer mandatory on 16.3+; restart moves to "after sustained heavy browsing" (the drip) and "after any aborted sweep". Kept verbatim: don't-sweep-a-used-server, npm-run-dev-only + inert-flag warning, memory-guard abort-is-a-failure. memory-guard.mjs header carries the same 16.3 note; the numbers stay in dev.mjs (single home) |

## 7. Risk assessment — how each failure would surface

**Fails loud** (a gate catches it): type errors (typecheck), lint-rule drift (full lint), broken
pages (unit tests, `check:layout` renders every guarded page), demo drift (`check:demos`), build
breakage (local `next build --webpack` before any promote), artifact bloat (explicit size check).

**Fails quiet** (needs a designed probe — these are the ones that reach customers):

1. **#97049-class header staleness.** If `headers()` served stale values under our proxy, org-scoped
   Server Components could render the *wrong org's* chrome — pages still 200, sweeps still green.
   Probe V5 asserts org-identity end-to-end on two different orgs plus the sandbox write-block.
2. **Supabase session cookie write-through.** A dropped `setAll` during token refresh = users
   silently logged out hours later. No 16.3-specific report exists (verified: no known
   incompatibility for `@supabase/ssr` 0.10.2 — absence of evidence, not vendor confirmation);
   V3 smoke + V8 soak cover it behaviorally.
3. **sharp at runtime.** PWA icons render per-request through sharp; a binary/API mismatch breaks
   icons only. V7 exercises the icon route against the prod build.
4. **Amplify artifact vs 220 MB SSR cap.** Build succeeds, deploy fails. V7 checks size locally
   before any promote.
5. **`AGENTS.md` silent append.** Neutralized by D4 (`agentRules: false`) + V3 diffs the file after
   first dev boot regardless.

**Production exposure honesty:** prod loads the webpack-built `app-page.runtime.prod.js` — one whole
bundler family away from the leaking Turbopack dev runtime, both upstream issues are metadata-scoped
to `next dev`, and the only direct user datum says "production builds seem to work fine." Adversarial
verification still returns **UNPROVEN** (no first-party statement that prod was tested for this) —
V7's measured prod-build test is what finally closes it, on this machine, with numbers.

## 8. Verification plan (pass criteria attached)

- **V0 — Baseline BEFORE the bump.** Run the new committed measurement script (D5) on 16.2.4:
  per-request slope on one already-compiled coach page (expect ≈2.7 MB/req) + per-compile cost walk
  (expect ≈240 MB/coach page). These are the "before" numbers; the 2026-08-11 ones were taken with
  throwaway scripts and stay as corroboration only.
- **V1 — Static gates.** `npm run typecheck` (0 errors) · **full** `npm run lint` (0 new — this is
  the probe for the undetermined eslint-config-next 16.3 rule diff) · unit tests (all pass;
  currently ~1431).
- **V2 — `npm run verify:changed`** green (includes demos, dictionary, parity, contrast, dates).
- **V3 — Dev boot + smoke.** `npm run dev` → Ready; platform-admin login page 200 with no Supabase
  `EACCES`; log in; one org admin page, one coaches page, one API route. Diff `AGENTS.md` (must be
  untouched). Confirm the dev.mjs self-retirement notice prints (it should — that's the mechanism
  working).
- **V4 — THE gate: memory re-measurement** (method-identical to 2026-08-11: V8 inspector, forced GC
  before every reading, never working-set):
  - **V4a per-request:** 200+ requests against one already-compiled coach page, tracking GC'd heap
    AND `arrayBuffers`. **Gates D6, not the promote** — adversarial verification says this leak is
    likely #85666 (React dev-only promise instrumentation), unclaimed by 16.3.0, so expect it may
    persist. Slope < 0.3 MB/request with a plateau → supervisor retires per its own notice. Slope
    ≥ 1 MB/request → supervisor stays AND we contribute our repro to
    [#85666](https://github.com/vercel/next.js/issues/85666) (the 2026-08-12 root-cause comment
    there includes a heap-snapshot method — WeakRef/constructor counts — worth replicating to
    confirm it is the same mechanism).
  - **V4b per-compile/eviction:** walk ~15 coach routes, then idle; forced-GC reading after idle.
    **Pass:** post-sweep heap returns to < 2× cold-boot (eviction observed working on Windows), or
    at minimum stops growing linearly with route count. Windows-specific behavior of the 'auto'
    heuristic is an open question upstream — this answers it for us.
  - Record all numbers in §12 of this file.
- **V5 — Proxy-header + sandbox probe** (the #97049 quiet-failure class): on the running 16.3.0 dev
  server, fetch pages for two different orgs and assert each renders its own org identity (stale
  header bleed would cross them); POST a write to both demo orgs and assert the sandbox rejection
  envelope; confirm `x-request-id` appears on responses.
- **V6 — Sweeps.** Fresh dev server → `npm run check:layout` (baseline unchanged) + `npm run
  check:demos`. (Also doubles as a live trial of the memory guards under 16.3.0.)
- **V7 — Production build, locally.** `npm run build` (webpack) completes; measure `.next` size
  against the 220 MB context; `npm run start` → smoke the PWA icon route (sharp at runtime) + 200
  requests against one page with inspector attached — the **prod-leak question closes here with a
  number**, not an assumption. ⚠ Method (learned executing V0, 2026-08-12): the *measurable* start
  run needs a build made with `.env.production.local` set aside — `NEXT_PUBLIC_*` values bake into
  the server bundle at build time, and `lib/supabase-safety` (correctly) refuses a local runtime
  whose baked URL is the prod project. So V7 = one normal build (artifact size + that the build
  completes) + one dev-env build for the authed 200-request measurement; restore the env file after.
- **V8 — Soak.** 2–3 days of ordinary dev-branch work on 16.3.0 before any promote. Metrics: dev.mjs
  restart counter (goal: zero), the #96705 stale-SSR symptom (edit a server file after a browser has
  connected; confirm the change applies), general feel vs the ~21-page death march.
- **V9 — Post-promote.** Amplify job build memory + duration vs job 251/252; live smoke: login, an
  org page, both demo doors, PWA icon; observability dashboard quiet.

## 9. Rollback story (three rungs, fastest first)

1. **Amplify console redeploy** of the last good job — minutes, no git surgery, the standard
   prod-emergency move. Because the upgrade ships as its own promote (D1), the previous job is
   exactly "everything except the upgrade."
2. **`git revert` of the bump commit** on dev → promote. Clean single-commit revert (the bump
   touches only manifests + config + lockfiles).
3. **If 16.3.x is fundamentally unusable but prod must keep the security fixes:** pin **16.2.12**
   (fully patched line-mate, tiny diff from 16.2.4, no new features). Cost: the dev leak returns —
   acceptable because the mitigations (heap ceiling, supervisor, sweep guards) are kept until V4
   passes *and* remain in git history after.
   **Floor: never roll back below 16.2.12** — every version under it carries the §2 High CVEs.

## 10. Recommended sequence (approval gates marked ⛔)

| Step | What | Produces / proves |
|---|---|---|
| 0 ⛔ | Commit the currently-**uncommitted** mitigation scripts (`scripts/dev.mjs`, `scripts/memory-guard.mjs`, sweep-guard edits, `AGENTS.md` rule, `package.json` dev script) + this plan pair. ⚠ Another session was still editing `dev.mjs` today 08:38 — coordinate before committing | ✅ DONE 2026-08-12 — mitigations committed `c16931d9`; the plan-pair docs ride the Step 2 housekeeping commit |
| 1 ⛔ | Promote the pending 20 feature commits as their own release (normal `/release` flow) | ✅ DONE 2026-08-12 — promoted to prod; dev == origin/master at execution start |
| 2 | On dev: V0 baseline → bump commit (`next` + `eslint-config-next` + `sharp` + `agentRules:false` + both lockfiles) → V1–V6 | The upgrade exists on dev, fully verified locally; before/after memory numbers exist |
| 3 ⛔ | Report V4 verdict to owner → D6 retirement decision → follow-up commit (supervisor removal and/or doc rewording, only as measured) | ✅ DONE 2026-08-12 — verdict reported; owner ruled "go ahead"; supervisor/guards KEPT, docs reworded (this commit) |
| 4 | V7 prod-build test + V8 soak (2–3 days). If 16.3.1 stable lands: bump to it, re-run V1/V4a/V5 | Confidence for the promote; prod-leak question closed with numbers |
| 5 ⛔ | Promote the upgrade **alone** → V9 → post-release truth-up per `.claude/commands/release.md` Phase 2b | 16.3.x live; security exposure closed; records updated |

Elapsed: dev-side work is a same-day affair; the promote lands ~3–4 days after approval, soak
permitting. If anything in V1–V7 fails in a way that can't be resolved same-day, stop and report —
the fallback ladder (§9) and the D2 emergency rung exist for exactly that.

## 11. What could not be determined (and how each gets settled)

- **Whether OUR per-request leak is fixed** — by design unanswerable from research (fingerprint
  matches no known issue). Settled by V4a.
- **Whether our header-forwarding pattern triggers #97049** — our clone-and-forward differs from the
  issue's direct-mutation repro; couldn't be settled statically. Settled by V5.
- **eslint-config-next 16.2.4→16.3.0 rule diff** — no changelog found. Settled by V1's full lint.
- **Amplify peak build-memory delta** — no upstream data for webpack builds (the 16.3 memory work is
  dev/Turbopack-scoped). Expect unchanged; settled by watching the promote job (V9); heap stays 7168.
- **`@supabase/ssr` official 16.3 compatibility** — no vendor statement either way; only absence of
  reported issues. Settled behaviorally by V3/V5/V8.
- **Windows behavior of the 'auto' eviction heuristic** — upstream numbers are from
  Linux/macOS-heavy environments. Settled by V4b.

**Adversarial verdicts (both completed 2026-08-12, full transcripts in the session task files):**

- *"16.3.0 fixes our per-request leak"* → **UNPROVEN, leaning refuted.** 16.3.0's verified fix scope
  is compile/disk-cache eviction; no upstream test or claim covers repeated requests against an
  already-compiled route. The widely-shared `run_once` fix tweet predates 16.3.0 by ~11 months
  (merged 2025-09) and is unrelated. The best mechanistic match for our fingerprint is **open**
  issue #85666 (React dev-only `async_hooks` promise instrumentation in
  `app-page-turbo.runtime.dev.js`; "production builds unaffected"), root-caused 2026-08-12, tested
  on 16.1.6, no 16.3.0 retest on record. V4a is the settling test — by design.
- *"16.3.0 has no regressions hitting our profile"* → **REFUTED as stated**, but every found
  regression was then checked against this repo's actual code and config: #97049 (proxy `headers()`
  staleness) is real and **unfixed in any release/canary**, but our proxy uses a different,
  likely-unaffected pattern (V5 probes); #96646/#96650 are Vercel-platform-specific (we deploy to
  Amplify); #97015 requires a TypeScript alias we don't use; #96619/#96626/#96976 are
  Turbopack-build-only (we build with webpack); #96975 needs Safari. Net: no *confirmed* blocker for
  this profile, several designed probes required — which §8 carries.
- *"Production is unaffected by the leak"* → **UNPROVEN** (no first-party statement), with the
  mechanistic case strengthened: both upstream issues are metadata-scoped to `next dev`; our prod
  runtime is the webpack `.prod` build (a whole bundler family away from the Turbopack dev runtime);
  and #85666's root-cause analysis states production builds don't load the leaking instrumentation.
  V7 closes it with a measured number anyway.

## 12. Measurement results (filled during execution)

Instrument: `scripts/measure-dev-memory.mjs` (D5) — forced-GC readings over the V8 inspector on the
`next-server` worker, sequential authenticated GETs as the UAT coach. **Method note (2026-08-12):
phases run on SEPARATE fresh servers** — measured on 16.2.4, request-phase + compile-walk on one
server is not survivable (220 requests retain ~755 MB and the next heavy compile blows the ceiling),
so V0a (`--requests=220 --routes=0`), V0b (`--requests=0 --routes=15`) and V0c (idle) each got a
fresh server; V4 repeats the same split.

| Reading | 16.2.4 (V0, measured 2026-08-12) | 16.3.0 (V4 measured 2026-08-12; V7 = soak window) | Pass? |
|---|---|---|---|
| Per-request slope, compiled coach page (MB/req) | **2.06** (two full 220-req runs: 2.05/2.06; heap 299→755 MB; arrayBuffers +36.5 MB) | **2.00** (220 req; last-third 1.93; arrayBuffers +38.5 MB — unchanged) | **Leak persists as predicted (#85666, unclaimed by 16.3.0)** → D6: supervisor + heap ceiling STAY; contribute repro upstream |
| Plateau observed? | **NO — dead linear through req 220** (last-third slope 2.05) | **NO — same linearity** | — |
| Per-compile cost, coach route (MB) | **coach-overview 261–264** (3 runs); siblings 6–13 once portal chrome is compiled (team-hub 12.5, notifications 6.1) | **coach-overview 72–82 (−70%)**; siblings 4–22; **coach-help 456 settled — IT COMPILES AND THE SERVER LIVES** (was a 3/3-deterministic V8 fatal on 16.2.4) | **PASS — the compile-memory fix is real here** |
| Post-sweep heap vs cold boot (V4b) | **No eviction:** 180 s idle returned 1.3 MB (317.8→316.5, 8.3× cold boot; walk truncated — see fatality below) | Full 15-route walk **completes** at 692 MB heap (11% of ceiling); idle +180 s: heap 717 (11.1× cold — strict heap-shrink criterion NOT met) but **RSS 2987→1181 MB (−1.8 GB returned to the OS)**; linear-growth-per-route is broken | **PASS on the alternative criterion** — eviction works at process level, not V8-heap level; "swept = spent" softens accordingly |
| Prod build (`next start`) slope, 200 req | **0.00 MB/req, plateau YES** (heap 89→101 MB total over 200 req; rss ~180 MB) — **prod does NOT leak; the §7/§11 "UNPROVEN" is now closed on this machine** | — (V7, during soak) | — |
| `.next` artifact size | server 70.4 MB · static 14.7 MB · **~175 MB** incl. root manifests/types (excl. the 3.5 GB `.next/dev` Turbopack cache, which never deploys) — vs the 220 MB context | — (V7, during soak) | — |

**V1–V6 battery on 16.3.0 (all run 2026-08-12):** V1 typecheck 0 errors (against fresh `next typegen`
output — note: BUILD-generated `.next/types` stubs reject the Money-hub pages' extra named exports on
*both* versions; dev/typegen stubs don't — latent pre-existing quirk, not a bump issue) · full lint 0
errors after one scoped disable (`eslint-plugin-react-hooks` 7 via eslint-config-next 16.3.0 flags
Playwright's `use()` fixture continuation as a React hook — false positive, disabled file-scoped in
`tests/uat/helpers/fixtures.ts`) · tests 1595/1595 · V2 `verify:changed` fully green · V3 Ready in
359 ms, dev.mjs self-retirement notice fired as designed, platform-admin login 200, no EACCES,
`AGENTS.md` byte-identical after boot (D4 works under a live AI-agent session) · V5 probe 17/17
(both sandbox write-blocks with their own copy, both doors route correctly, `headers()` consumer
fresh, x-request-id present+unique, no org bleed; coach-demo public root 404 verified as
matching-prod behavior, not a regression) · V6 `check:layout` **completes** (the sweep was
unfinishable on 16.2.4 under this ceiling), low-water 3282 MB free; its 7 NEW tap-floor findings
belong to the 2026-08-11/12 page-header rework (5 of 7 sit on that rework's header elements; the
baseline was last written by that very commit, `8e3014b3`) — routed to the header Pass-2 thread,
deliberately NOT absorbed into the baseline and NOT fixed inside this upgrade · `check:demos` green.
Also fixed in passing: pnpm ≥10 ignores the `.npmrc` build-approval list — approvals now live in the
local gitignored `pnpm-workspace.yaml` (`allowBuilds`), with `core-js` added to `.npmrc` for
Amplify's older pnpm.

**V0 finding beyond the plan's expectations — `coach-help` cannot compile on 16.2.4 under the
6144 MB ceiling at all.** Deterministic, 3/3 runs, including on a FRESH server with only 316 MB
settled heap: compiling `/[orgSlug]/coaches/help` transiently allocates >5.8 GB (Mark-Compact at
death reclaims ~2 MB of 6.1 GB live), V8 fatal-errors, and the supervisor restarts the server. The
15-route walk is therefore **not completable** on 16.2.4 — historical sweeps only survived because
the pre-2026-08-11 heap cap was inert (Next's half-RAM default, 10.9 GB, was the real roof).
Consequences: (a) `check:layout` on 16.2.4 under the current ceiling would die at `coach-help`
every time — V6's sweep comparison runs on 16.3.0 against the recorded baseline file, there is no
16.2.4-current-ceiling counterpart; (b) `coach-help` is the acid test for 16.3.0's compile-memory
work: if the walk clears it under the same ceiling, the eviction fix is real *here*.
