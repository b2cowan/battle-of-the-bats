# Platform-Admin Employee Experience Audit — Implementation Plan

> **Status:** SCOPED — awaiting owner approval to execute. No walk has run yet.
> **Created:** 2026-06-13
> **Branch:** TBD (docs/reports only; **no product code changes** in this project) — confirm with owner
> **Companion:** [PLATFORM_ADMIN_EMPLOYEE_AUDIT_PM_BRIEF.md](PLATFORM_ADMIN_EMPLOYEE_AUDIT_PM_BRIEF.md)
> **Supersedes/refreshes:** [archive/PLATFORM_ADMIN_UX_EVAL.md](../archive/PLATFORM_ADMIN_UX_EVAL.md) (2026-06-04; H1–H7 shipped, H8→TIMED_ENTITLEMENTS) — that eval is the **baseline**, not a re-litigation target.
> **Sibling (do not merge):** [USER_JOURNEY_AUDIT_PLAN.md](USER_JOURNEY_AUDIT_PLAN.md) owns the **customer** perspective; this project owns the **employee/operator** perspective.

## Goal

Evaluate the internal `/platform-admin/` console **as a FieldLogicHQ employee/operator** — not as a customer. Answer the owner's four questions, per platform role:

1. **Navigability** — how easy is it to move around the console and find the thing you need?
2. **Day-one learnability** — can a brand-new hire, with zero tribal knowledge, orient and become productive on their first shift? (cross-cutting lens on every role)
3. **Set-up-for-success** — are permissions clear, are actions discoverable, are SOPs/help present where the work happens, and are there no silent dead-ends?
4. **Per-role fit** — for each *real* platform role, what can they do, is it discoverable, and can a new hire scoped to that role accomplish their job without asking a colleague?

This is an **evaluation project**: it produces (a) one report per role, (b) a deduplicated cross-role operator findings backlog, and (c) a prioritized fix list. **No product code changes.** Fix work spins out as separate scoped projects after owner review.

## The console as it exists today (verified from code, 2026-06-13)

**Real roles** — [lib/platform-auth.ts:10](../../../lib/platform-auth.ts) `PlatformRole`: `super_admin` · `support` · `billing` · `product` · `growth` · `read_only`. The bootstrap admin (`PLATFORM_ADMIN_EMAILS` env, e.g. `fieldlogichq@gmail.com`) resolves to `super_admin`. Role→permission map in `ROLE_PERMISSIONS`; note `billing` also holds `manage_support`, `product` also holds `manage_growth`.

**Real areas** — [lib/platform-areas.ts](../../../lib/platform-areas.ts) `PlatformArea` (15): `overview`, `organizations`, `customer_users`, `retention`, `early_access`, `email`, `change_requests`, `plans_pricing`, `bulk_operations`, `platform_users`, `audit`, `observability`, `email_templates`, `help`, `dev_tools`. The hidden/read/write matrix is the **single source of truth** for nav + page guards (`requirePlatformAreaView()`) + in-context messaging (added by H4, 2026-06-04). Nav **is now role-gated** (drops un-viewable areas, marks view-only with an eye icon — [PlatformAdminNav.tsx:66-113](../../../app/platform-admin/PlatformAdminNav.tsx)).

**Critical seam fact:** the **Feedback** nav item maps to the **`observability`** area, not a dedicated area — so feedback inherits observability gating: `viewRoles: [super_admin, product, support]`, `writeRoles: [super_admin, product]`. **A support rep can VIEW feedback + observability but cannot WRITE either.** Whether a support rep can actually *close the loop* (act, not just read) is a primary hypothesis to test, not an assumption.

**~31 page surfaces** (`app/platform-admin/**/page.tsx`) grouped into the live 5-group nav: Command Center · Customers · Growth · Billing & Product · System.

## Personas — the six real roles, each under a day-one lens

One persona per real role. Every persona is walked twice-over: (a) **role-fit** (can this role do its job?) and (b) **day-one** (could a new hire scoped to this role, with zero tribal knowledge, get oriented and productive?).

| ID | Persona | Role | Job-to-be-done | Areas they can WRITE | Areas read-only | Hidden from them |
|----|---------|------|----------------|----------------------|-----------------|------------------|
| **PA1** | Founder-operator / super admin | `super_admin` (bootstrap) | Run everything; the baseline "does the whole console cohere" pass | all | — | — |
| **PA2** | Support rep ⭐ (the seam) | `support` | Receive customer feedback → find the error → diagnose → act → close the loop; reset passwords; org/account triage | customer_users | retention, observability/feedback | bulk_ops, plans_pricing, change_requests, email_templates, early_access, email, platform_users, dev_tools |
| **PA3** | Billing specialist | `billing` | Cancellations, retention queue, overrides, comps, account access, bulk ops | customer_users, retention, bulk_operations | plans_pricing, change_requests | early_access, email, email_templates, observability, platform_users, dev_tools |
| **PA4** | Product operator | `product` | Plans/pricing, change-request approvals, email templates, error triage, growth surfaces | plans_pricing, change_requests, email_templates, bulk_operations, early_access, email, observability | — (broadest non-super) | retention, platform_users, dev_tools |
| **PA5** | Growth marketer | `growth` | Early-access pipeline, marketing email | early_access, email | — | everything else (narrowest meaningful role) |
| **PA6** | Read-only observer | `read_only` | View-only audit/oversight (e.g. exec, contractor) | — | customer_users + the all-roles areas | everything with write |

⭐ **PA2 is the priority persona** — it owns the in-scope support seam and exercises the most net-new surface.

> **Day-one lens (applied to all six):** first-login orientation, "where do I start," is the visible surface self-explanatory without the SOP hub, do silent role-gates read as "not allowed" vs "broken," is the right SOP reachable from where the work happens.

## Method — reuse the journey-audit pipeline, adapted to the operator

Same proven Stage A–E shape as the [User Journey Audit](USER_JOURNEY_AUDIT_PLAN.md), with operator adaptations. Evaluation only; multi-agent workflow per role.

**The six-question rubric, operator-adapted** (scored on every cluster, every role):

1. **Purpose** — does this employee know what this surface and these controls are *for*?
2. **Sequence** — is the task flow logical; are key actions buried or out of order?
3. **Visual appeal** — is the console legible and professional at desktop density?
4. **Friction** — what would make this operator task faster/safer (fewer clicks, fewer dead-ends, better guard rails)?
5. **Scanability** — is information organized so purpose is clear at first glance?
6. **Effectiveness** — can the operator actually *complete the job end-to-end* in their role (incl. close-the-loop for the support seam)?

Plus two cross-cutting overlays carried as **tags**, not extra questions: `day-one` (learnability for a zero-knowledge new hire) and `least-privilege` (does the role-gate read correctly — clear "requires X access" vs silent absence?).

**Stage A — Role×Area route map.** One agent builds, from code, a matrix per role: for every area, what the nav renders (visible / view-only eye / hidden), what the page guard does (`requirePlatformAreaView`), and what the write-gate allows. This is the skeleton each role report follows, and it doubles as a guard-vs-matrix consistency check (does the rendered surface match `platform-areas.ts`?).

**Stage B — Role-walkers (parallel).** Per role, agents walk each *visible* cluster goal-first as that employee (e.g. PA2: "a customer reports scores won't save — receive the feedback, find the error group, diagnose, act, close the loop"). Score the six questions; produce candidate findings with `path:line` refs and a **tribal-knowledge-required?** flag.

**Stage C — Live pass (desktop-primary).** Operator console = desktop tool; screenshot signature screens at **1440×900** (dark default). Mobile (390×844) only where a role genuinely works on a phone (none expected to be mobile-primary — note if so). A design-lens agent reviews screenshots for Q3/Q5.

**Stage D — Risk-targeted adversarial verify.** Skeptic agents re-derive only **High-severity**, **`bug`-type**, and **routed** findings (real? already fixed/owned? duplicate? severity inflated?). Screenshot-backed design/copy findings skip verification — the screenshot is the evidence. (Matches the journey audit's locked J2–J10 posture.)

**Stage E — Synthesis.** Per-role report (template below) + a cross-role operator backlog + a prioritized fix list. Fixes spin out as separate projects post-review.

## Finding taxonomy

- **ID:** `PA<role-initial>-<seq>` (e.g. `PAS-007` support, `PAB-003` billing, `PAP-…` product, `PAG-…` growth, `PAR-…` read-only, `PA0-…` super-admin/global).
- **Severity:** `Blocker` (role cannot do its core job) / `High` (major friction, misleading, or silent dead-end) / `Medium` / `Low`.
- **Type:** `bug` / `copy` / `ia-sequence` / `design-visual` / `role-gating` / `missing-sop` / `missing-feature` / `wow`.
- **Rubric question failed:** Q1–Q6.
- **Tags:** `day-one`, `least-privilege`, `support-seam` (any combination).
- **Evidence:** `path:line` and/or screenshot filename.
- **Suggested direction:** one or two sentences, not a spec.
- **Route:** `backlog` / `existing:<plan>` (e.g. timed-entitlements is OWNED — route, don't re-scope).

## Report template (one file per role)

Created during execution at `docs/projects/active/platform-admin-audit/ROLE_<ID>_<ROLE>.md`:

```markdown
# PA<id> — <Role> Operator Report
> Walked: <date> | Method: code-walk + live desktop | Status: draft

## The operator at a glance
[Who they are, what their shift looks like, what the console feels like for them. 2–4 paragraphs.]

## Role×area access map (as rendered)
[Per area: visible/view-only/hidden — and whether the rendered surface matches platform-areas.ts]

## Cluster-by-cluster scorecard
| Cluster | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Tribal knowledge? | Notes |

## Findings
[Full findings table per the taxonomy]

## Day-one verdict
[Could a zero-knowledge new hire in this role be productive on shift one? What blocks it?]

## Top 5 moves
## Screenshots index
```

## Area / cluster map — the ~31 pages, NET-NEW flagged

Grouped into walkable clusters. **🆕 = net-new or never role-fit-reviewed since the 2026-06-04 eval → highest priority.** Net-new clusters are where the audit's value concentrates.

| Cluster | Pages | Status vs 2026-06-04 |
|---------|-------|----------------------|
| **Overview & orientation** | `page.tsx` (dashboard), `help/page.tsx` (hub landing) | Refresh (dashboard reviewed; re-check day-one orientation, M8 never built) |
| **Orgs & entitlements** | `orgs/`, `orgs/[id]/` (5 tabs), `retention/` | Refresh — **but 🆕 the League-Starter abuse badge + §13 instrumentation panel (2026-06-13)** on the org/dashboard surface have had NO review |
| **Customer Users & account actions** | `customer-users/` | Refresh (H3/H5 shipped; re-verify SOPs now exist) |
| **Support loop (the seam)** ⭐ | 🆕 `feedback/`, 🆕 `observability/` + 🆕 `observability/[groupId]`, `change-requests/` | **Mostly NET-NEW** (feedback + observability live 2026-06-10). change-requests had a known SOP gap (old L6). This is the project's center of gravity. |
| **Billing & plans** | `plans-pricing/`, 🆕 `plans/`, 🆕 `stripe-prices/`, `retention/` | `plans/` vs `plans-pricing/` duplication + `stripe-prices/` never reviewed (disambiguation/naming-drift candidate) |
| **Email & templates** | 🆕 `email-templates/` + 🆕 `email-templates/[key]/`, `email/`, `early-access/` | Template editor net-new; `email`/`early-access` flagged "maybe out of scope" in baseline — now in scope as growth/product surfaces |
| **Comms / bulk-ops** | `bulk-operations/`, `email/` | Refresh (reviewed at client level in baseline) |
| **System & governance** | `users/` (Platform Users), `audit/`, `dev-tools/` | Platform Users + dev-tools = super-admin-only; audit reviewed in baseline |
| **Help / SOP hub** | 🆕 `help/*` — `platform-admin`, `coaches`, `accounting`, `exports`, `house-league`, `org`, `registrations`, `rep-teams`, `tournaments` (10 pages) | Baseline deep-read ONLY `help-content/platform-admin.tsx`; the per-module SOP pages have had no operator role-fit review |

## Support-seam scope statement (explicit)

The **feedback center + observability + change-requests** are walked **from the EMPLOYEE side only**: receive → triage → diagnose → act → **close the loop**. The end-to-end test for PA2/PA4: *a customer submits feedback about a broken action; can the operator find the matching error group in observability, diagnose it, take the right action, and mark the loop closed — within their role's write permissions?* The **known seam tension** (support can *view* but not *write* observability/feedback) is a hypothesis to confirm and, if real, route as a finding.

**The customer side of this seam is OUT** — the in-app feedback widget, customer-facing error UX, and how a customer experiences raising an issue are owned by the [User Journey Audit](USER_JOURNEY_AUDIT_PLAN.md).

## Explicitly OUT of scope

- **Any customer-perspective walkthrough** — owned by the User Journey Audit (10 personas, customer-facing).
- **Subscription/billing experienced as a customer** — customer billing journeys are J3/J4/J7 in the journey audit.
- **Re-litigating shipped H1–H7** — treated as baseline; only re-flag if a fix regressed or a net-new surface reintroduces the same problem.
- **Re-scoping timed-entitlements (H8)** — owned by [TIMED_ENTITLEMENTS_PLAN.md](TIMED_ENTITLEMENTS_PLAN.md); findings touching comps/trials *route* there, never re-scope.
- **Product code changes** — this project produces reports + a backlog only.

## Staging needs

- **Bootstrap super-admin login** — `fieldlogichq@gmail.com` via `PLATFORM_ADMIN_EMAILS` (PA1). *(Never surface `b2cowan@gmail.com` in app/docs — it is personal/git-only.)*
- **Five scoped-role test accounts** — one `platform_users` row each for `support`, `billing`, `product`, `growth`, `read_only` (e.g. `support@dev.local` … `readonly@dev.local`, `is_active=true`). Required to walk least-privilege as each role *actually sees it* (nav + guards), not just as super-admin reading the matrix. Insert via dev-tools platform-user seeding or service-role; confirm `platform_users` columns from the live dev snapshot before seeding.
- **Seeded support-loop data** — real rows to walk the seam against: feedback submissions (varied status), observability error groups (`platform_events`/error-tracking tables), at least one open change-request, and orgs carrying the League-Starter abuse/§13 instrumentation flags. Reuse existing dev seeds where possible; document any gap.
- **Dev server with network access** (Supabase/EACCES caveat per AGENTS.md). Desktop screenshots only; reuse `journey-shots.mjs` driver with a per-role spec + platform-admin storage state.

## Phases

### Phase 0 — Harness & staging
- [x] Create `docs/projects/active/platform-admin-audit/` + role report template → [`_TEMPLATE.md`](platform-admin-audit/_TEMPLATE.md) (2026-06-13).
- [x] Build Stage-A role×area matrix (all 6 roles) + guard-vs-matrix consistency check → [`STAGE_A_ROLE_AREA_MATRIX.md`](platform-admin-audit/STAGE_A_ROLE_AREA_MATRIX.md). **Surfaced 4 candidate pre-findings** (PF-1 unguarded `email-templates/[key]` editor · PF-2 unguarded `dev-tools` page · PF-3 pattern-gap on ALL_ROLES pages · PF-4 §13 panel only on dashboard) — to verify during the walk.
- [x] Confirm `platform_users` + support-loop table schemas from the **live dev snapshot**; staging recipe + gaps → [`STAGING_RUNBOOK.md`](platform-admin-audit/STAGING_RUNBOOK.md) (2026-06-13). All five target tables confirmed in `schema-dump-columns-dev.json`.
- [ ] **(execution-time)** Seed the five scoped-role accounts (recommend a small `seed-platform-staff.mjs` — runbook §4 gap) + support-loop data (feedback, error groups, a change-request; reuse an existing free-floor org for §13).
- [ ] **(execution-time)** Per-role screenshot specs for `journey-shots.mjs`.

### Phase 1 — PA1 super-admin baseline + PA2 support seam ⭐ (+ CHECKPOINT)
- [x] Staging executed 2026-06-13: `scripts/seed-platform-staff.mjs` (5 scoped-role accounts, devpass123) + `scripts/seed-support-loop.mjs` (4 feedback incl. one matching an error group, 3 error groups, 2 change-requests). Dev server up (login 200); dev-tools + LEAGUE_STARTER_BETA flags on.
- [x] PA1 super-admin walk (Stage B code-walk) → [`ROLE_PA1_SUPER_ADMIN.md`](platform-admin-audit/ROLE_PA1_SUPER_ADMIN.md). **14 findings (2 High · 5 Med · 7 Low).** Day-one = No (borderline). Confirmed PF-1 + PF-2 as real High bugs.
- [x] PA2 support rep walk (Stage B code-walk) → [`ROLE_PA2_SUPPORT.md`](platform-admin-audit/ROLE_PA2_SUPPORT.md). **12 findings (1 Blocker · 3 High · 5 Med · 3 Low).** **SUPPORT-SEAM VERDICT = NO, support cannot close the loop** (feedback/observability status writes require `manage_product`; support has only `manage_support`). Day-one = No.
- [x] **Stage D verify** of the High/Blocker bug cluster — verified FIRST-HAND against the route files (stronger than subagent re-derivation): PF-1/PAP-001, PAG-002, PAG-003, PAS-001, PAS-004 all CONFIRMED + 2 more session-only export leaks found (feedback/export, observability/issues/export).
- [ ] **Stage C live screenshot pass** — DEFERRED (not blocking for triage; screens enumerated in each report's index; add if F2 visual work wants reference shots).
- [x] **⛔ Owner checkpoint PASSED 2026-06-13** — "Approved, continue as-is."

### Phase 2 — PA3 billing + PA4 product
- [x] PA3 billing → [`ROLE_PA3_BILLING.md`](platform-admin-audit/ROLE_PA3_BILLING.md). 12 findings (3H·5M·4L). Day-one borderline. Headline: Change-Requests buttons 403 silently; no expired-overrides queue.
- [x] PA4 product → [`ROLE_PA4_PRODUCT.md`](platform-admin-audit/ROLE_PA4_PRODUCT.md). 11 findings (3H·5M·3L). **Support-seam = YES, product CAN close the loop** (with friction). Broadest role, almost no SOPs.

### Phase 3 — PA5 growth + PA6 read-only (light)
- [x] PA5 growth → [`ROLE_PA5_GROWTH.md`](platform-admin-audit/ROLE_PA5_GROWTH.md). 11 findings (3H·5M·3L). Role coherent not complete; mass-email + lead-export reachable by any role via API.
- [x] PA6 read-only → [`ROLE_PA6_READ_ONLY.md`](platform-admin-audit/ROLE_PA6_READ_ONLY.md). 8 findings (1 Blocker·2H·3M·2L). Full Customer Users Actions menu renders + 403s for a pure-view role.

### Phase 4 — Cross-role synthesis & triage
- [x] [`SYNTHESIS.md`](platform-admin-audit/SYNTHESIS.md) — 68 findings (2 Blocker·16 High·28 Med·22 Low) across 6 roles; 6 cross-cutting themes; **0/6 roles pass day-one**; support-seam NO(support)/YES(product). Prioritized into 5 spin-out fix projects (F1 API Hardening = P0 fast-track/security; F2 least-privilege UX consistency; F3 support seam; F4 SOPs+orientation; F5 polish).
- [ ] **⛔ Owner review of the F1–F5 breakdown** (esp. fast-track F1) → spin out approved fix projects → archive this plan + reports.

## Effort estimate (rough)

Lighter per-persona than the journey audit (operator console is smaller, desktop-only, no marketing/signup arc), but six roles + a guard-consistency dimension. Rough order:

- **Phase 0:** ~half a session (staging + Stage-A matrix).
- **Phase 1 (PA1+PA2):** ~1 session — the richest, carries the net-new support seam + checkpoint.
- **Phase 2 (PA3+PA4):** ~1 session.
- **Phase 3 (PA5+PA6):** ~half a session (both light).
- **Phase 4 synthesis:** ~half a session.

≈ **3.5–4 working sessions**, **~6–10M subagent tokens** total (Sonnet subagents per cost-tiering; Opus reserved for high-stakes verify). Comparable per-role cost to a *light* journey (J8/J9/J10 ≈ 16–27 findings each); expect a richer yield on PA1/PA2/PA4 and the net-new clusters.

## Architectural decisions

- **One umbrella project, six role reports** — shared method/taxonomy, cross-role dedupe of shared surfaces; fix work spins out post-triage. (Mirrors the journey audit's umbrella decision.)
- **Standalone from the journey audit** — internal employee tooling, not subscription-based, doesn't cross customer roles except the support seam (walked employee-side only). Not numbered as a Jx journey.
- **Findings on owned surfaces route, never re-scope** — timed-entitlements (H8) especially.
- **Reports are the only commit artifacts; screenshots stay out of git** (gitignored harness output, cited by filename).
- **Decide role/area/column existence from live code + dev snapshot, never from memory or migrations.**

## Open questions (for owner at approval)

- [ ] **Branch** for this docs-only work — current `feat/free-tier-coaches` carries an uncommitted J4-001 fix that must not be disturbed.
- [ ] Are `email`/`early-access` (growth) genuinely in scope, or thin enough to fold into a single "growth surfaces" note? (Lean: in scope, light.)
- [ ] Is `plans/` legacy vs `plans-pricing/`? (Likely a naming-drift finding — confirm during the walk.)
