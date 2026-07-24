# Codebase Cleanup — Deep Investigation Prompt

> **How to use:** paste this whole prompt into a NEW chat. It launches an
> investigation-only audit of the entire codebase + database for legacy code,
> duplication, hardcoded styling, and dead schema. It produces analysis + plan +
> PM brief documents — it does NOT delete or refactor anything itself. Run with
> multi-agent orchestration (say "use a workflow" / enable ultracode) — the
> sweep is far too broad for one context.

---

## Mission

FieldLogicHQ has grown fast across many parallel sessions. We just found and
removed a whole family of orphaned pre-multi-tenant pages (top-level
/news /results /rules /schedule /teams — deleted 2026-07-24) that nothing had
linked to for months. Assume there is more of this. Perform a **deep, evidence-based
investigation** of what can be removed, consolidated, or simplified so the
codebase runs clean and efficient — then hand the owner a risk-classified plan.

**Investigation only.** No production code changes, no deletions, no migrations.
Output = documents (see Deliverables). The owner ratifies tranches before any
execution chat touches code.

## Ground rules (binding)

- Read `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`, `memory/MEMORY.md` first.
  This repo runs Next.js 16 (`proxy.ts` convention — read
  `node_modules/next/dist/docs/` before asserting anything about routing).
- ONE shared `dev` branch; other chats work in this same tree concurrently —
  **never revert or sweep foreign uncommitted files**, never `git add -A`.
- **Database truth = live snapshots / information_schema, NEVER migration files**
  (the DB is drifted; migrations mislead). Dev project + prod
  (`qcttcboqysynwcdyghil`) both matter; prod is BEHIND dev (several migrations
  prod-pending — see memory index ⚠ markers). Any proposed drop must be checked
  against BOTH.
- A "nothing references this" claim is only real after adversarial verification
  (see the traps list below). Findings ship with evidence (the greps/reads that
  prove it), not vibes.
- No commits without explicit per-action owner OK. `pnpm-workspace.yaml` must
  never be committed (Amplify pnpm gotcha).

## Workstreams

**A. Dead routes, pages, components, exports.** Unreferenced page routes, API
routes nothing fetches, components with zero importers, lib exports with zero
consumers, unreachable branches behind retired flags. Known leads:
`LegacyInstallBanner` (near-zero installed base, duplicate of
`InstallAppPrompt`), the legacy `/home` context-switcher (Unified Home absorbs
it per the ratified IA), `/my/*` legacy join flow, `/auth/select-org`
compatibility redirect, retired `NEXT_PUBLIC_COACH_WARM_PREVIEW` references
(`lib/coach-warm-preview.ts` marker is now unconditional — is the module still
earning its name?).

**B. Duplicate / near-duplicate code.** Parallel sessions built similar things
twice: date/time formatting (must funnel through `lib/timezone.ts`), fetch/error
wrappers, modal/sheet/card primitives, badge/chip patterns, empty-state blocks,
CSV/export helpers, Supabase client construction. Also altitude problems: logic
living in pages that belongs in lib, copy-pasted API-route boilerplate vs
`withObservability`. Known lead: `teamInk()` in `lib/team-color.ts` is
purpose-built and used in exactly one file while every consumer monogram tile
hardcodes `#fff` on team colors.

**C. CSS + design-token debt.** (1) Literal hex/rgba outside the ratchets'
scopes — the public ratchet does NOT scan `app/(consumer)/`, `components/chat/`,
`components/home/`, `components/InstallAppPrompt.module.css`; the operator
ratchet does NOT scan `components/accounting/`. Propose extending scopes +
re-freezing baselines. (2) Dead CSS: selectors whose class names no TSX
references (3 already flagged in the P3 tranche), the `--fl-surface` ghost
token, `--on-lime` value drift (#0b0f14 / #0a0c12 / #000 siblings), duplicate
brand-rgba tuples. (3) Stale lime literals: `rgba(163,230,53,…)` sites are
copies of an OLD brand lime (current `--logic-lime` = #D9F99D) — inventory and
propose token swaps. (4) Warm-gate re-declaration debt: any `:root` alias of a
gate-remapped token (see design_decisions 2026-07-23 frozen-alias rule).

**D. Database schema.** Cross-reference every live table/column/index/function/
policy (dev + prod snapshots, `docs/agents/db/DATA_DICTIONARY.md`) against
actual code usage: tables no query touches, columns no select/insert references,
indexes on dead columns, stale CHECK constraints (the forfeit-source precedent),
RLS posture on service-role tables (read from live `pg_class`, not migrations),
duplicate/overlapping columns from superseded features. Classify: drop-candidate
/ keep-dormant-by-design (e.g. mig 137 `bracket_label`) / needs-owner-decision.
Remember: schema changes are execution-phase work with dictionary + snapshot
refresh in the same unit — this investigation only proposes.

**E. Dependencies, flags, config.** Unused npm packages (verify against dynamic
imports + scripts/), oversized deps with lighter equivalents, dead env vars in
code vs `.env` docs, dead script files in `scripts/`, tailwind config entries no
class uses.

**F. Assets + PWA.** Unused `public/` images/icons/fonts; `sw.js` cache lists vs
routes that still exist (the denylist MUST keep covering every authed top-level
route — flag drift either way); manifest icons.

**G. Docs + task hygiene.** `docs/projects/active/` plans that are actually
complete → propose archive moves; `TODO.md` truth-up; memory-index ⚠ markers
that are resolved.

## Adversarial verification — the traps list

A finding is CONFIRMED only after a second, independent agent tries to refute it
checking at minimum: dynamic/string-built imports; Next.js convention files
(layouts, error/not-found/loading, route handlers, `proxy.ts`, metadata,
sitemap/robots); server actions; `sw.js` and offline precache; scheduled jobs +
cron routes (Vault-wired); email templates (`lib/email*`) and their deep links;
platform-admin tools; seed/utility scripts (`scripts/`, `seed-live-tournament`);
UAT specs (`tests/uat/`); DB triggers/functions referencing tables; anything
referenced only from PROD (feature live on prod but reworked on dev — check the
prod release watermark in memory). For DB items: check both dev AND prod live
schemas plus `information_schema` usage stats where available.

## Method (suggested shape)

Phase 1 — parallel inventory agents per workstream (A–G), each returning a
structured findings list with evidence. Phase 2 — dedup, then adversarial
verify every removal candidate (traps list). Phase 3 — risk-classify:
`safe-mechanical` (zero-reference, zero-runtime-risk) / `judgment` (needs a
decision or has plausible dormant value) / `owner-decision` (product-visible or
irreversible, e.g. any DB drop). Phase 4 — write the tranche plan: mechanical
tranche first, judgment tranche second (the operator-token-debt P2/P3 precedent
worked well), DB tranche last and separately gated.

## Deliverables

1. `docs/projects/active/CODEBASE_CLEANUP_ANALYSIS.md` — the verified findings
   inventory: item, evidence, risk class, estimated LOC/tables removed.
2. `docs/projects/active/CODEBASE_CLEANUP_PLAN.md` — tranches with explicit
   file lists and verification steps per tranche (`verify:changed`, typecheck,
   ratchet re-freeze where scopes extend, dev-server restart rule).
3. `docs/projects/active/CODEBASE_CLEANUP_PM_BRIEF.md` — plain-language: what
   gets removed, why it's safe, what the owner must decide, expected payoff
   (build time, bundle size, fewer drift surfaces).
4. One summary line in `TODO.md` linking the plan.
5. A memory topic file (`memory/` auto-memory) so future sessions know the
   audit's state.

## Explicitly OUT of scope

- Executing any removal (separate ratified chats per tranche).
- Anything touching billing/pricing facts (`PLAN_PRICING_FACTS.md` is
  canonical — flag drift to `/strategy`, don't edit).
- Rewriting working features "more elegantly" — this is subtraction and
  consolidation, not redesign.
