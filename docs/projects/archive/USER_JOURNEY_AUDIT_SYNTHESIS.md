# Platform-Wide User Journey Audit — Phase 5 Cross-Persona Synthesis

> **Status:** DRAFT — deliverables 1–3 complete (dedupe map · master backlog · fix-project breakdown). **Deliverable 4 (spin-out + archive) is owner-gated — awaiting approval.**
> **Produced:** 2026-06-13 | **Source of truth:** the 10 `journeys/JOURNEY_*.md` reports (500 findings, 0 refuted). This file is the cross-cutting view; the reports remain the detailed record and are cited by ID.
> **Companion:** [USER_JOURNEY_AUDIT_PLAN.md](USER_JOURNEY_AUDIT_PLAN.md) · [USER_JOURNEY_AUDIT_PM_BRIEF.md](USER_JOURNEY_AUDIT_PM_BRIEF.md)

## How to read this file

The audit produced 500 verified findings across 10 personas. ~145 of them were **already routed into in-flight plans** during Phases 1–4 (they stay there — this synthesis references them, it does not re-home them). The remaining ~355 are **unowned** and are the subject of the proposed fix-project breakdown (§4). Two archived plans (PUBLIC_VISUAL_REDESIGN, STRIPE_INTEGRATION) own findings but are closed, so their routed items roll into named successor projects.

- **§1 — Dedupe map:** the shared surfaces and cross-journey finding clusters, collapsed to a canonical owner.
- **§2 — Theme taxonomy:** 12 themes proposed from the data.
- **§3 — Master backlog:** the Blocker/fix-now set in full; then per-theme rollups (owned → plan vs unowned → fix project), severity-ranked.
- **§4 — Proposed fix-project breakdown:** 7 scoped successor/new projects covering the unowned remainder.

---

## §1 — Dedupe map (shared surfaces + cross-journey clusters)

Many findings collide on the five shared surfaces (marketing/pricing, `/start`, auth, `/home`, emails) and on a handful of shared *roots* that surface differently per persona. Each cluster below is collapsed to a **canonical owner**; the siblings cross-reference it rather than being fixed independently.

### Shared-surface collisions

| # | Cluster | Canonical | Siblings (fold / cross-ref) | Disposition |
|---|---------|-----------|------------------------------|-------------|
| D1 | Banned "Tournament Management Platform" descriptor | **J1-026** (login) | J2-012, J10-009, J10-025 | One auth-pages copy pass (login + accept-invite + round-trip). |
| D2 | Footer brand voice ("FIELDLOGIC / compete seriously", drops "HQ") | **J1-003** | J3-003 | Platform-wide footer line + wordmark. |
| D3 | Mobile pricing compare table renders one plan column | **J1-008** | J3-005 (+ J1-007 grid orphan) | Single responsive-pricing fix. Owned via FTS for the league-price half (J3-004). |
| D4 | Marketing never links the live `/start` free product; "Get Started" mints an org | **J2-001/J2-002** (FTS Phase 8) | J1-024, J1-023, J2-007 | Owned — FREE_TIER_STRATEGY Phase 8 marketing flip. |
| D5 | Landing/marketing shows zero product proof | **J1-004** | J3-001 (AP, FTS) | Tournament side backlog; league side owned by FTS. |
| D6 | `/home` switcher speaks operator, not user; tournament-first copy; extra hops | **J3-017** | J4-049, J5-019, J8-020, J2-012 | Org-context & IA theme (T7). |

### Cross-journey root clusters

| # | Cluster | Canonical / root | Members | Disposition |
|---|---------|------------------|---------|-------------|
| D7 | Active in-progress season vanishes from public nav when next season opens | **J3-067** (escalate High→Blocker) | J7-001 (Blocker, parent-side) | One render fix, two files. **Fix-now.** |
| D8 | Org-context resolved from caller's FIRST membership (78 files / 121 sites) | **J3-012** (fix-now) | J4-012 (36 coach-API sites; consequence) | Fail-closed sweep. **Fix-now.** |
| D9 | Login page has no already-authenticated forward → infinite loop | (shared root) | J8-018 (cross-org volunteer), J10-019 (suspended member) | Distinct from D8; one login-forward fix serves both. |
| D10 | Anonymous / lateral data exposure (PII + access maps) | (security cluster) | J6-001 (fan API), J3-069 (child oracle), J9-003 (member over-grant), J10-002 (members API), J4-005 (coach lateral), J5-035 (metadata) | Theme T1; multiple mechanisms, one project. |
| D11 | Authorization holes (write/delete reachable past the contract) | (security cluster) | J4-003 (events side-door), J4-004 (4 ungated routes), J4-021 (org write on team ledgers), J3-068 (league sub-pages skip gating) | Theme T1. |
| D12 | Timezone correctness | **J3-047** (league server-naive, fix-now) + **J5/J6 UTC-today family** (owned phase5) | J5-025, J5-039, J6-056, J5-018, J5-031 (display/logic); J7 cross-ref | Two distinct roots, one theme (T2). League half fix-now & unowned; coach/fan half owned. |
| D13 | "Live" game-state defined by score-submission, not game time; surfaces disagree | **J6-013** | J6-022, J6-019, J6-039, J6-016; cross-ref J5-039 | One `isGameLive` helper + status precedence. |
| D14 | Bracket math can crown the wrong team | **J1-083** (tied playoff advances away) | J1-084 (coin toss no re-seed), J1-091 (forfeit), J1-076 (publish unreachable in playoff stage) | Correctness; fix-now-worthy (T2). |
| D15 | Payment instructions absent for league registrations (no field, no render) | **J3-072** | J7-008, J7-026 (auto-promote fee gap) | Owned via FTS §16 (J7-008); league-trust project carries the render. |
| D16 | No reply-path; platform Gmail surfaced as org contact | (email cluster) | J1-065, J5-057, J3-060, J7-012, J9-004, J2-026 | Theme T5 (email voice). |
| D17 | User-input interpolated unescaped in emails | **J3-065 / J7-025** (escalated High) | J5-062 (tournament side, owned 5e) | Theme T5. |
| D18 | Mark-paid is one irreversible click and/or writes an inconsistent data shape | **J5-026** (data shape) | J4-013 (alloc), J2-035 (dues), J8-016 (gate) | Theme T8 (destructive) + T12 (money). |
| D19 | Lifecycle/forward-only actions fire unconfirmed | (cluster) | J3-028, J3-051, J10-018, J1-079, J8-010 | Theme T8. |
| D20 | Member removal hard-deletes multi-org accounts platform-wide | **J5-012** (coach orphan) | J4-036 (rep-side analog) | Fix together. **Fix-now.** |
| D21 | Champion never crowned / finale fizzles | **J6-052** | J6-025, J1-112, J1-100, J5-049, J9-009, J7-023 | Theme T11; split across PVR-successor + organizer + coaches plans. |
| D22 | No notification on a lifecycle event | (cluster) | J2-025 (assignment), J5-058 (game-day), J9-013 (rainout), J3-062/064 (placement/rainout), J7-016 (team reveal), J10-020 (capability change), J6-049 (Final push) | Theme T4 (lifecycle silence). |
| D23 | "Carries over automatically" is an unbuilt promise for the org-join path | **J2-024** | cross-ref J5-053 | Owned — FTS §16. |
| D24 | Practices invisible to non-admins (coach/parent/public) | **J3-052** | J9-012, J7 fold | League-trust project + coaches-eval. |
| D25 | Schedule rows never say WHERE | **J3-071** (league) | J1-056 (tournament public), J6-014 (fan), J9-001 (coach), J7 fold | Per-surface; T9/T11. |
| D26 | Cancelled vanish / postponed render as live | **J3-070** | J6-055 ("TBD — Final"), J9-001 | League-trust + fan projects. |
| D27 | Tournament-first IA on league/club orgs | (cluster) | J4-041, J4-043, J4-045, J4-049, J3-016, J3-078, J7-002 | Theme T7. |

---

## §2 — Theme taxonomy (proposed from the data)

| ID | Theme | What it is | Lead journeys |
|----|-------|-----------|---------------|
| **T1** | Data exposure & authorization | Anonymous/lateral PII leaks, ungated routes, the org-context first-membership bug, side-door writes/deletes. | J6, J3, J4, J9, J10 |
| **T2** | Data integrity & correctness | Ledger corruption, 17 dead Next-16 pages, timezone-naive times, bracket math, "live" definition, multi-org account deletion. | J4, J1, J3, J6, J5 |
| **T3** | The wrong-door / dead-end class | 404s, infinite login loops, unreachable surfaces, blank hubs, tabs that dead-end. | J1, J8, J10, J4, J5 |
| **T4** | Lifecycle silence | No notification on assignment, placement, rainout, suspension, capability change, result. | J2, J9, J3, J5, J7, J10 |
| **T5** | Email voice & deliverability | Banned/placeholder copy, platform-Gmail contact, no reply-to, unescaped input, lying delivery counts, fire-and-forget sends. | J1, J5, J3, J7, J9, J2 |
| **T6** | First-run emptiness & orientation | Zero-states, no role orientation, claim wall, "coming soon" teasers for owned modules, list-view team home. | J1, J3, J10, J4, J2, J5 |
| **T7** | Org-context & multi-module IA | Tournament-first skew on league/club orgs, plan-aware nav, the multi-org identity/switcher tension. | J4, J3, J7, J8, J10 |
| **T8** | Destructive & irreversible actions | Unconfirmed one-click, no undo, one-way mark-paid, destructive roster replace. | J3, J4, J8, J10, J1, J2 |
| **T9** | Mobile & field ergonomics | Mobile-hostile tables/boards, invisible score inputs, no thumb steppers, off-canvas actions. | J1, J3, J4, J8, J7 |
| **T10** | Franchise voice ≠ mechanics | Coach owns the write but UI says "wait for admin"; read-only contract leaks; carries-over promise undelivered. | J2, J4, J9 |
| **T11** | The trophy moment & wow gaps | Champion never crowned, afterglow flat, share/follow loops broken, team-reveal silent. | J6, J1, J5, J7, J9 |
| **T12** | Money truthfulness | Paid-vs-owed disagreement, payment instructions absent, non-reconciling rollups, over-budget unanswerable. | J5, J3, J7, J4 |

---

## §3 — Master backlog

**Totals:** 500 findings · 5 Blocker · 124 High · 235 Medium · 79 Low (per-journey: J1 118 · J5 65 · J6 57 · J3 80 · J4 50 · J7 26 · J2 38 · J8 23 · J9 16 · J10 27). 0 refuted.
**Owned (route into in-flight plans, ~145):** DASHBOARD_SUMMARY_IA (11) · FREE_TIER_STRATEGY §16 (28) · COACHES_EXPERIENCE_EVAL (20) · FREE_TIER_COACHES_UNIFIED (12) · FREE_TIER_COACHES_PHASE_5_BUILD (~56) · ADMIN_ROLE_PARITY (8) · USER_MANAGEMENT_TOURNAMENT_UX (3) · coaches-a-e from J5 (7). **These are NOT re-homed.**
**Unowned remainder (~355):** organized by theme below and carved into fix projects in §4. Includes the 32 J6 findings routed to the now-archived PUBLIC_VISUAL_REDESIGN and the 2 J4 findings routed to the now-archived STRIPE_INTEGRATION — both roll into named successors.

### 3.1 — Tier 0: Blockers + fix-now (owner attention, ship before any promotion)

The high-blast-radius set. Every item here is trust-catastrophic or gates a module's public promotion.

| ID | Sev | Finding | Theme | Lands in |
|----|-----|---------|-------|----------|
| **J6-001** | Blocker-class (filed High) | Anonymous `/api/public/tournament-data` + public pages serve every coach email, paymentStatus, adminNotes. One public team sanitizer. | T1 | FP-1 |
| **J3-069** | **Blocker** | Unauthenticated child-disclosure oracle on league status lookup (works on private orgs via J3-068). Require email + reference code. | T1 | FP-1 |
| **J4-020** | **Blocker** | "+ Add Ledger" plants a NULL-entity ledger → snowballing duplicate Generals → real postings scattered. Data corruption from a first-class button. | T2 | FP-1 |
| **J3-067 / J7-001** | **Blocker** (escalate) | The in-progress season vanishes from all public nav when next season opens. Two-file render fix. | T3 | FP-4 |
| **J8-001** | **Blocker** | Sign Out is a dead `/auth/logout` 404 on BOTH volunteer shells — session stays live on a borrowed phone. | T3 | FP-3 |
| **J3-012** | High (fix-now) | Org-context resolved from caller's first membership; 78 files / 121 sites; wrong-org reads **and writes** for multi-org users. Fail closed on orgSlug. | T1 | FP-1 |
| **J4-001** | High (fix-now) | 17 pages dead on Next 16 (program-year oversight + entire premium coach money suite). Mechanical `use(params)` migration + lint guard. *(Uncommitted fix already in this tree.)* | T2 | FP-1 |
| **J4-003** | High (fix-now) | Admin events API retains full PATCH+DELETE on coach-owned events (remnant of hardening commit 0406d42). | T1 | FP-1 |
| **J4-004** | High (fix-now) | Four admin rep-teams routes missing owner\|admin gate — coach-role member can delete medical files / spam every guardian. | T1 | FP-1 |
| **J3-047** | High (fix-now) | Game & practice times stored timezone-naive → wrong wall-clock on UTC prod. Before any League org goes live. | T2 | FP-1 |
| **J3-068** | High (fix-now) | League public sub-pages + register API skip the org gating the index enforces (companion to J3-069). | T1 | FP-1 |
| **J6-035** | High (fix-now) | Register page + `/api/register` ignore event lifecycle — mid-tournament submission mints a junk reg + coach account. | T2 | FP-2 |
| **J6-010** | High (fix-now) | Team-profile Follow uses drifted helpers that never fire `fl-follow-change` → the flagship dock never appears. One-file fix. | T11 | FP-2 |
| **J4-032** | High (fix-now) | Billing lifecycle incoherent: confirmed charge never fires, real charge lands later, archived teams bill forever, consent skippable. | T12 | FP-6 |
| **J5-012 / J4-036** | High (fix-now) | Member/coach removal hard-deletes multi-org accounts platform-wide; orphan basic teams become unclaimable limbo. Fix together. | T1/T2 | FP-1 |
| **J5-026** | High (fix-now) | Organizer "Mark Paid" writes `payment_status` without `total_paid`; resolver ignores it → organizer says paid, coach says OWED. | T12 | FP-1 |
| **J10-002** | High | `GET /api/admin/members` ungated — any member reads every email + capabilities map. | T1 | FP-1 |
| **J9-003** | High | Module-cap override (the only coach onboarding workaround) leaks ALL guardian PII. | T1 | FP-1 |
| **J1-083 / J1-084** | High | Tied playoff score silently advances the away team; recording a coin toss doesn't re-seed a filled bracket. Can crown the wrong champion. | T2 | FP-5 |
| **J7-025** | High | All six league email templates interpolate user input unescaped — unauthenticated phishing vector from the verified domain; no rate limit. | T5 | FP-4 |

### 3.2 — Per-theme rollup (unowned remainder, severity-ranked)

Each theme lists its unowned findings (the ones a fix project must own). Owned findings are noted as `→ plan` and not enumerated. IDs are ordered Blocker → High → Med → Low.

**T1 — Data exposure & authorization** → **FP-1**
J6-001, J3-069, J3-012, J4-003, J4-004, J3-068, J5-012/J4-036, J10-002, J9-003, J4-005, J4-021, J5-035. (J4-012 owned → coaches-a-e but roots here.)

**T2 — Data integrity & correctness** → **FP-1** (core) + **FP-5** (bracket) + **FP-2** (live)
J4-020, J4-001, J3-047, J1-083, J1-084, J1-091, J1-076, J6-013, J6-022, J6-019, J6-039, J6-016, J6-049, J1-109, J6-053, J6-055, J5-018. (UTC-today family J5-025/039, J6-056 → owned phase5.)

**T3 — Wrong-door / dead-end** → spread (**FP-1/2/3/4/5**)
J8-001, J8-018, J8-002, J8-019, J10-014, J1-001, J1-043, J1-076, J3-054, J3-076, J4-007, J4-042, J4-047, J5-015→owned, J2-013→owned, J6-057, J7-003, J7-022, J10-007, J10-008, J10-012, J8-022, J5-022→owned. (J10-003 audit-404 owned → USER_MGMT.)

**T4 — Lifecycle silence** → **FP-4** (league) + **FP-7-as-cross-cut**; coach side owned
J3-062, J3-064, J9-013, J9-004, J10-020, J6-049, J7-016→owned-FTS. (J2-025, J5-058 → owned unified/phase5.)

**T5 — Email voice & deliverability** → **FP-4** (league) + **FP-1** (auth copy) + owned (tournament-coach 5e)
J1-065, J3-058, J3-059, J3-060, J7-025, J7-011, J7-026, J3-065, J9-004, J7-012, J7-013, J7-021, J7-014, J1-075, J1-022, J1-018, J1-017. (J5-056/057/060/062/063/064 → owned 5e; J2-026 → owned unified.)

**T6 — First-run emptiness & orientation** → spread; mostly owned, some FP
J1-021, J3-014, J3-015, J3-022, J3-023, J3-025, J4-041, J4-006, J5-013→owned, J1-029. (J10-015, J10-016 → owned ADMIN_ROLE_PARITY; J2-019/015 → owned coaches/unified.)

**T7 — Org-context & multi-module IA** → **FP-8** (or fold to FP-4/FP-5)
J4-041, J4-043, J4-044, J4-045, J4-048, J4-049, J3-016, J3-078, J7-002, J3-017, J4-029, J3-063, J3-076, J8-019, J8-020, J8-021, J10-001→owned. J3-079 (reserved-slug).

**T8 — Destructive & irreversible actions** → spread (**FP-1/3/4/5/6**)
J4-013, J8-010, J3-028, J3-051, J10-018, J1-079, J8-016, J3-048, J4-023, J4-030, J3-031. (J2-035 → owned phase5.)

**T9 — Mobile & field ergonomics** → spread (**FP-3/4/5** + design-debt cross-cut)
J8-006, J8-007, J8-008, J8-011, J8-012, J8-013, J1-071, J1-073, J1-092, J1-093, J1-094, J3-033, J3-038, J4-018, J7-007, J7-018, J9-005, J1-031, J1-035, J4-050, J1-105→owned, J3-056.

**T10 — Franchise voice ≠ mechanics** → mostly owned (coaches plans); J4 side in FP-1/FP-6
J4-021, J4-005, J4-035, J4-034→owned, J2-033→owned. (J2-024 → owned FTS.)

**T11 — Trophy moment & wow gaps** → **FP-2** (fan) + **FP-5** (organizer) + owned (coach)
J6-052, J6-025, J6-028, J6-029, J6-033, J6-040, J6-048, J1-112, J1-100, J1-085, J9-009→owned, J7-023→owned, J6-012, J6-008, J6-021, J6-042. (J5-049 → owned 5m.)

**T12 — Money truthfulness** → **FP-1** (J5-026 root) + **FP-6** (J4 accounting) + **FP-4** (league fees)
J5-026, J4-010, J4-011, J4-024, J4-025, J4-026, J4-027, J4-028, J4-017, J4-014, J4-015, J4-016, J4-022, J3-072→owned-FTS, J3-034, J3-077, J7-008→owned. (J2-037/038, J2-034 → owned phase5.)

---

## §4 — Proposed fix-project breakdown

The unowned remainder carves into **7 scoped projects**. Each gets a `_PLAN.md` + `_PM_BRIEF.md` pair in `docs/projects/active/` and a one-line TODO.md link (created on approval — §4 is owner-gated). Findings already in in-flight plans stay there; these projects cover only the unowned remainder + the two archived-plan successors.

### FP-1 — Trust & Integrity Hardening **(FIX-NOW headline)**
**Successor to:** none (new). **Owner attention: highest.**
**Scope:** the cross-app security + correctness roots that gate every module's public promotion. This is the single most important spin-out.
**Key findings:** J3-012 (org-context fail-closed, 78 files + J4-012 coach sweep) · J6-001 (public PII sanitizer) · J3-069 + J3-068 (league child-oracle + sub-page gating) · authorization sweep J4-003/J4-004/J4-005/J4-021 + J10-002 + J9-003 · J4-020 (ledger-corruption Blocker) · J4-001 (17 dead Next-16 pages) · J5-012 + J4-036 (multi-org account deletion) · J3-047 (league timezone-naive times) · J5-026 (mark-paid data shape) · D9 login-loop forward (J8-018/J10-019).
**Why its own project:** every item is fix-now or Blocker-class, cross-cuts personas, and several share a single sweep (the J3-012 + J4-012 org-context pass; the J4-003/004/005/021 authorization pass). Sequencing these together prevents one-off patches.
**Severity span:** 2 Blocker · ~15 High. **~25 findings.**

### FP-2 — Public Fan Experience
**Successor to:** PUBLIC_VISUAL_REDESIGN (archived — its 32 J6-routed findings reopen here). **Source of truth: J6.**
**Scope:** the tournament public/fan surface — make "live" mean one thing, give the follow loop a front door, finish the finale, fix the alerts promise, and stop the register-lifecycle bypass.
**Key findings:** J6-013 (one `isGameLive` + status precedence) + J6-022/019/039/016 · J6-010 (follow-helper drift, fix-now) + J6-011/028/029/012/040 (follow loop) · J6-035 (register lifecycle bypass, fix-now) + J6-036/037 · J6-052/025/053/054/055 (finale) · J6-048/049/050 (alerts) · J6-002/003/004/014/023/027 (live-day home) · J6-044 (offline shell, AP) + the 32 PVR-routed design items.
**Why its own project:** PVR is archived; three verifiers flagged no open plan owns public-surface work. Chartering a "fan truthfulness + finale" successor is itself the action item J6 named.
**Severity span:** ~9 High · ~30 Med · ~18 Low. **~57 findings** (24 J6 backlog + 32 PVR-routed + cross-ref).

### FP-3 — Volunteer Day-of Experience
**Successor to:** none (NEW). **Source of truth: J8** (no active plan owns `/{org}/scorekeeper` + `/{org}/check-in`).
**Scope:** the two least-trained personas on the most stressful day — working exits, a non-destructive gate roster, field-grade score entry, right-door wayfinding.
**Key findings:** J8-001 (Sign Out 404 Blocker) + J8-002 (session-expiry) + J8-018 (cross-org loop, shares D9 with FP-1) · J8-010 (destructive gate-roster replace) + J8-011 · J8-006/007/008 (field score-entry ergonomics) · J8-003 (false "assigned" model) · J8-014/015/016/017 (gate honesty) · J8-019/020/021 (wrong-door / role mapping) · J8-004/005 (PWA/realtime).
**Why its own project:** the volunteer shells are owned by no plan, are the least-resourced surface, and carry a Blocker + the highest count of "stranded with no exit" failures. J8 explicitly seeds this.
**Severity span:** 1 Blocker · 10 High · 9 Med · 3 Low. **23 findings.**

### FP-4 — House-League In-Season Trust
**Successor to:** none (new); coordinates with FREE_TIER_STRATEGY (which owns league *acquisition*, not in-season trust).
**Scope:** the league public face + comms spine that J3/J7/J9 hammered — the surfaces that decide whether a volunteer admin keeps her league's trust.
**Key findings:** J3-067/J7-001 (vanishing season, Blocker, fix-now) · J3-070/J3-071 (cancelled/postponed/venue honesty) + J6-style schedule truth · J3-072/J7-008/J7-026 (payment instructions — render half; FTS owns the field) · comms spine J3-058 (0-delivered) / J3-059 (lying counts) / J3-060 (reply path) / J3-062 (rainout notify) / J3-064 (placement) · J7-025 (email injection, fix-now) + J3-065 · J3-074 (public stub branding) + J7-002 · J3-052/J9-012 (practices public) · J3-045/046/048 (generator produces a schedule) · J9-013 (rainout notify) · J7-012 (dead contact column).
**Why its own project:** J3 routed 72 findings to backlog and J7 routed its in-season half across backlog/FTS; the in-season trust package is unowned and is the league module's "ship-before-promotion" gate (parallel to FP-1 for tournaments). FTS §16 owns the *acquisition* seam — this project owns the *operate* seam. Document the boundary explicitly.
**Severity span:** 1 Blocker · ~12 High · ~rest Med/Low. **~50 findings** (J3 league backlog + J7 in-season + J9 public).

### FP-5 — Tournament Organizer Experience
**Successor to:** none (new); coordinates with DASHBOARD_SUMMARY_IA (which owns the completed/summary IA).
**Scope:** the J1 backlog remainder — bracket-math trust, the false-strings trust cluster, the day-one mental model, and making game day actually live.
**Key findings:** J1-083/084/091/076 (bracket trust — could ride FP-1 as correctness; decision flagged) · J1-043/065/045/103/087 (the five false strings) · J1-028/029/030/032 (wizard mental model + Event Settings wall) · J1-085/086/047/097 (live game day) · J1-066/067/068/069 (registrations) · J1-077/078/080 (volunteer staffing) · J1-001/002/003/004 (discovery) · J1-100/112 (champion) + the J1 design-visual mobile set.
**Why its own project:** J1 produced 118 findings and routed 103 to backlog — the single largest unowned block, coherent to one persona and one module.
**Severity span:** ~18 High · rest Med/Low. **~90 findings** (route J1-083/084 to FP-1 if the owner prefers correctness-first batching).

### FP-6 — Billing & Accounting Coherence
**Successor to:** STRIPE_INTEGRATION (archived — its 2 J4-routed findings reopen here).
**Scope:** the club-tier money cockpit — bill-what-you-confirm, true board-facing numbers, reversible money actions.
**Key findings:** J4-032 (billing lifecycle, fix-now) + J4-033 (comped-org create block) · J4-013 (mark-paid irreversible) + J4-023 (one-sided void) + J4-030 (unconfirmed reminder waves) · J4-010/011/024/025/026/027/028 (numbers that can lie; whole-club rollup) · J4-014/015/016/017/022 (allocation coherence) · J4-031 (payee management).
**Why its own project:** STRIPE_INTEGRATION is archived; J4-032/033 have no owner. The accounting-truth cluster (J4-010..028) is the Club tier's whole sales pitch and is unowned. Pairs naturally with the billing lifecycle.
**Severity span:** 1 Blocker (J4-020 — or route to FP-1) · ~8 High · rest Med. **~20 findings.**

### FP-7 — Admin IA & Multi-Module Navigation
**Successor to:** none (new); coordinates with ADMIN_ROLE_PARITY (orientation) and the design system.
**Scope:** the org-level tournament-first skew on league/club orgs, plan-aware nav, and the multi-org identity tension — the cross-persona "this product still thinks it's a tournament tool" findings.
**Key findings:** J4-041/043/044/045/048/049 + J3-016/078 + J7-002 (tournament-first IA) · J3-017 (operator-speak switcher) + /home copy · J4-029/J3-063/J3-076 (buried nav) · J3-079 (reserved-slug) · J8-019/020/021 (volunteer wrong-door, shared with FP-3) · the design-system debt cross-cut (J4-050, J3-038).
**Why its own project:** the tournament-first skew reproduced as cross-refs in 4 club variants + 3 league variants — it is a coherent platform-IA theme no single-module project owns. (Could be folded into FP-4/FP-5/FP-6 per surface if the owner prefers fewer projects.)
**Severity span:** ~5 High · rest Med/Low. **~20 findings.**

### Cross-cutting threads (not standalone projects)
- **Email voice & deliverability (T5)** threads through FP-1 (auth copy D1), FP-4 (league email spine), and the owned 5e work. If the owner wants a single email-stack pass, it could be carved out — flagged as an option, not a default.
- **Lifecycle silence (T4)** threads through FP-2/FP-3/FP-4 and owned plans (J2-025, J5-058). The `notify()` `userIds` wiring is the shared primitive.
- **Mobile & design-system debt (T9)** threads through every surface project; best handled as a `/design` conventions pass per surface rather than one mega-project.

### Routing recap

| Disposition | Findings (approx) |
|---|---|
| Owned — stay in in-flight plans (NOT re-homed) | ~145 |
| FP-1 Trust & Integrity Hardening | ~25 |
| FP-2 Public Fan Experience (PVR successor) | ~57 |
| FP-3 Volunteer Day-of Experience (new) | 23 |
| FP-4 House-League In-Season Trust (new) | ~50 |
| FP-5 Tournament Organizer Experience (new) | ~90 |
| FP-6 Billing & Accounting Coherence (Stripe successor) | ~20 |
| FP-7 Admin IA & Multi-Module Navigation (new) | ~20 |
| Cross-cutting threads (fold into the above) | remainder |

---

## §5 — Owner decisions (RESOLVED 2026-06-13)

1. **7-project breakdown approved as proposed** (no carve changes).
2. **Bracket math (J1-083/084) stays in FP-5** (organizer).
3. **FP-1 fix-now tranche ships first**, ahead of the experience projects.
4. **Spun out 2026-06-13:** the 7 `_PLAN.md` + `_PM_BRIEF.md` pairs created in `docs/projects/active/`, TODO.md links added, and `USER_JOURNEY_AUDIT_PLAN.md` + `_PM_BRIEF.md` moved to `docs/projects/archive/` (journey reports + this synthesis stay in `active/` — cited by the spun-out plans).

## §6 — Sequencing & dependencies

The 7 projects are **not a serial chain.** The shape is **one short serial gate (FP-1's roots) → a wide parallel fan-out (FP-2…FP-7).** Technical dependencies between the experience projects are near-zero; the limiter on parallelism is how many tracks you choose to run, not the code.

### Wave 1 (serial-ish) — FP-1 root tranche ships first

A handful of FP-1 roots are foundations the other projects build **on top of** — refactor them after the fact and you ship insecure/wrong-org surfaces or rework the dependents. Land these before the dependents' surfaces are promoted:

| FP-1 root | Gates / underlies |
|---|---|
| **J3-012 + J4-012** org-context fail-closed (78 + 36 files) | FP-4, FP-6, FP-7 (all touch admin/coach APIs) — build on fixed auth or re-thread later |
| **J6-001** public PII sanitizer | FP-2 — public surfaces must not be promoted while the leak exists |
| **J3-047** league timezone | FP-4 (schedule honesty renders the times) |
| **J5-026** mark-paid data shape | FP-6 (money) + FP-3 (J8-016 gate mark-paid reconcile) |
| **J4-001** 17 dead Next-16 pages *(already uncommitted in tree)* | FP-6 (premium accounting suite is dead without it) |

The rest of FP-1 (authorization sweep J4-003/004/005/021/J10-002/J9-003, ledger Blocker J4-020, account deletion J5-012/J4-036, login loops J8-018/J10-019) can run alongside Wave 2 — they don't gate other projects, they just need to land before their own surfaces are promoted.

### Wave 2 (parallel) — FP-2 … FP-7

After the Wave-1 roots land, all six open concurrently. They are persona/module-scoped and touch mostly disjoint files (the shared hotspots — `lib/api-auth.ts`, `lib/db.ts`, `proxy.ts`, email templates — are concentrated in FP-1), so merge-conflict risk is low. Each starts with its own fix-now/Blocker phase (FP-3 Sign-Out 404, FP-4 vanishing season, etc.). FP-7 is foldable into FP-4/5/6 if fewer parallel tracks are preferred.

### Coordination seams (assign each shared surface to ONE owner — "land it once")

Not sequencing blockers; just shared surfaces two projects could both touch:

- **Register-during-closed-event:** FP-2 (J6-035) ⟂ FP-5 (J1-048) → **FP-2 owns it.**
- **Champion on completed standings:** FP-2 (J6-052) ⟂ FP-5 (J1-112) → **FP-2 owns the public render.**
- **"Live" day-boundary:** FP-2's `isGameLive` coordinates with the owned UTC family (J5-039/J6-056, phase5).
- **Volunteer wrong-door:** FP-3 owns the shell half (J8-019/020/021); FP-7 owns the org-level routing decision.
- **Franchise health / oversight rollup:** FP-6 (J4-006/028) ⟂ FP-7 → pick one owner.
- **FP-4 ↔ FREE_TIER_STRATEGY:** FTS = acquisition, FP-4 = in-season operate (boundary already drawn per finding).
- **Day-one orientation:** owned by ADMIN_ROLE_PARITY (J10-015/016), not FP-7 — FP-7 owns the navigation half.

### Recommended cadence

1. **Wave 1:** FP-1 root tranche (org-context, PII, timezone, mark-paid, dead-pages, + the Blockers). The audit's headline; unblocks everything.
2. **Wave 2:** FP-2–FP-7 in parallel, each leading with its fix-now/Blocker phase. Width is a staffing choice, not a technical one.
