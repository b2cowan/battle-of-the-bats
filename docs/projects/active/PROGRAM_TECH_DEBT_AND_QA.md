# Program — Technical Debt & QA Infrastructure

> **Consolidated 2026-07-28.** Replaces 9 debt/cleanup files (§4).
> **Scope:** outstanding work only.
> **Related current docs (NOT consolidated here):** `CODEBASE_CLEANUP_PLAN.md` and
> `CODEBASE_CLEANUP_ANALYSIS.md` are live tranche-execution documents and stay as their own files.
> `DATE_CORRECTNESS_DEBT.md` is current and stays.

---

## 0. Ground truth (verified 2026-07-28)

Migration watermark is **205**; dev↔prod schema parity is green (the FK-action drift baseline is
empty). All CSS colour-token baselines are at **ZERO** across all six scopes. Codebase-cleanup
tranches **T0 (security), T1 (dead code), T2 (docs/memory truth-up) and T3 (colour guardrail) are
executed**. The debt that remains is bounded and well-catalogued.

---

## 1. Outstanding work

### 1.1 Codebase cleanup — Tranches 4 and 5
Ratified tranche-by-tranche by you. T0–T3 done; **T4 and T5 remain**, covering the residual ~428
lower-tier findings. Owner-decision leftovers noted in the plan:
- `app/platform/*` pre-rename SEO pages — add `/platform/* → /for-*` redirects in `next.config`, then
  delete the four pages and the vestigial navbar entry.
- A new `consumer` colour-token scope was proposed (adds `app/(consumer)`, `components/consumer` and
  three stray module CSS files to the guardrail).

### 1.2 Inline-TSX colour debt — 52 defects, plan written, awaiting your go
The CSS-module colour guardrail is at zero everywhere, but a residual scope was deliberately excluded:
inline `style={{…}}` and string colours inside `.tsx` files. **52 catalogued defects**, plan written,
never started. This is the last gap in the colour-token guardrail — while it's open, the guardrail
does not actually guarantee what it claims.

### 1.3 Prod build pinned to webpack — revisit Turbopack
The production build is pinned to `next build --webpack` (plus a heap bump in `amplify.yml`) so
`sharp`'s native dependencies bundle into the Amplify Lambda. Next 16's default Turbopack drops
`detect-libc` and 500'd the branding / logo / PWA-icon routes. Webpack is deprecated and CI builds are
**~10–15 minutes instead of ~2**. Revisit when the upstream issue resolves.

### 1.4 QA infrastructure — NOT STARTED
A layered automated test suite (unit / integration / E2E smoke) with a test catalog, plan-gate matrix,
post-release update workflow, CI integration and process documentation. A starting brief exists from
2026-05-21. Currently there are 411 unit tests and no integration or E2E layer.

### 1.5 UAT agent — Batches 2 and 3
The Playwright UAT agent and `/uat` command exist with ~19 specs across auth, plan-gating,
tournament-admin, platform-admin and coaches. **Batches 2 and 3 of the spec build-out are open.**
Note that Batch 1's Playwright probes for the coach-portal mobile overlay work were also skipped and
flagged as a `/uat` candidate.

### 1.6 Chart library decision — outstanding
Budget-vs-actual and dashboard screens still have no charting library. Evaluate recharts / chart.js /
@nivo against bundle size, SSR compatibility and dark-theme support before adding a dependency.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| TD-1 | **Green-light the inline-TSX colour sweep (52 defects)?** Until it runs, "all baselines at zero" overstates the guardrail's coverage. | Yes — it's mechanical, catalogued, and it closes the last hole in a guardrail you already paid for. |
| TD-2 | **Execute Tranches 4 and 5, or stop cleanup at T3?** T0–T3 captured the security and high-value findings; T4–T5 are the long tail. | Stop at T3 for now. Re-open T4/T5 only if a specific file starts causing friction. |
| TD-3 | **The `app/platform/*` SEO page deletion + redirects** — do it, or leave the pages? | Do it. Duplicate pre-rename SEO pages actively compete with `/for-*` in search. |
| TD-4 | **QA infrastructure — invest now or after early access?** | After early access. Build the E2E layer against real customer flows, not hypothetical ones. |
| TD-5 | **UAT Batches 2–3 — continue, or fold UAT specs into feature work as they ship?** | Fold into feature work. A standalone spec-writing batch goes stale before it's useful. |

---

## 3. Standing guardrails (informational — no action)

- **Schema = dictionary, same unit of work.** Any migration or field-meaning change updates `DATA_DICTIONARY.md` and refreshes dev + prod snapshots. `npm run check:dictionary` fails otherwise.
- **Colour tokens.** All CSS module baselines at zero across six scopes; a token-exempt escape hatch exists for deliberate cases.
- **Date correctness.** Calendar logic must route through the timezone helpers — production runs UTC while orgs run Toronto. Guardrail baseline at zero since 2026-07-26.
- **Migration parity.** `check:migrations` gates releases; dev↔prod FK-action parity baseline is empty.

---

## 4. Source files consolidated (archive candidates)

`CODEBASE_CLEANUP_PM_BRIEF.md` · `CODEBASE_CLEANUP_INVESTIGATION_PROMPT.md` ·
`INLINE_TSX_TOKEN_DEBT.md` · `SHARED_VISUAL_TOKEN_DEBT.md` · `MARKETING_VISUAL_TOKEN_DEBT.md` ·
`CONSUMER_VISUAL_TOKEN_DEBT.md` · `OPERATOR_VISUAL_TOKEN_DEBT.md` · `PUBLIC_VISUAL_REDESIGN_TOKEN_DEBT.md`

> **Keep active:** `INLINE_TSX_TOKEN_DEBT.md` — it is the itemised 52-defect worklist the sweep will
> execute against, not a historical record. The five `*_VISUAL_TOKEN_DEBT.md` files are each under 1 KB
> and record baselines already at zero; they are pure archive.
