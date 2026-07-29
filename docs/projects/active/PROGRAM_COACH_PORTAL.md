# Program — Coaches Portal (free + premium)

> **Consolidated 2026-07-28.** Replaces 32 separate coach-portal plan/brief files (listed in §5).
> **Scope of this doc:** outstanding work only. Shipped work appears as one-line reference in §4.
> **NOT in this doc:** the three in-flight coach projects — `FREE_COACH_PORTAL_EXPERIENCE_PLAN.md`,
> `COACH_PORTAL_LAUNCH_BATCH1_PLAN.md`, `COACH_PORTAL_LAUNCH_BATCH2_PLAN.md`. Those are current and
> stay as their own files. This doc holds everything *they don't cover*.

---

## 0. Ground truth (verified 2026-07-28)

`origin/master` is at `6afa1429` (2026-07-27); `dev` is **8 commits ahead**, all dated 07-27/07-28.
Therefore **every coach-portal build recorded as "BUILT on dev" before 2026-07-27 is live in
production.** Migration watermark is **205**; all `⚠ prod-pending mig NNN` markers in the retired
source files (135–198) were resolved and are applied to prod.

Practical consequence: the large "awaiting owner browser verification" tail across the June coach
plans is **not blocking work** — it shipped and has been in customers' hands for weeks. It is
folded into §3 as a single verification-debt item, not carried as N separate open projects.

---

## 1. Outstanding work

### 1.1 Premium portal — readiness P0s not yet batched
Owned by the 18-agent readiness review (`docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md`).
Batches 1 and 2 cover P0 #3–#8. **Still open:**

| # | Item | Why it matters |
|---|------|----------------|
| P0 #1 | **Season-end lockout** — a coach hitting season end loses access to their own team's data | Highest-severity trust failure in the paid product |
| P0 #2 | **Tournament games have no lineup/attendance tools** — the premium coach's tournament games are second-class vs league games | The paid pitch is "run your team"; tournaments are where they need it most |

### 1.2 Premium portal — walkthrough findings left open
From the owner-driven premium walkthrough (2026-06-26 → 06-28). These were explicitly deferred, not fixed:

- **Premium-specific getting-started help.** The coach guide's getting-started describes the FREE "Explore" model, which misleads paying coaches. → route through `/docs`.
- **Assistant-coach first-run.** Team Overview shows head-coach rail/checklist to assistants who can't action it. → belongs with the assistant-capabilities work.
- **Inline roster quick-edit.** Every jersey/position/contact change requires opening the full player profile — slow for first-time setup. Larger interaction change; deliberately deferred.

### 1.3 Mobile pass — unfinished tail
Conventions are LOCKED (2026-06-29, logged in `memory/design_decisions.md`). Overview, Roster,
Schedule, and the Accounting **Dues** exemplar are done. **Remaining:** convert the other accounting
tables to the shared card pattern — **expenses, allocations, budget-vs-actual, fundraiser detail**.
Mechanical, follows the Dues exemplar exactly.

### 1.4 Get the guardian model right — NOT BUILT
The only fully unbuilt item in this program. Free portal stores player + guardian as a **single name
box**; Premium stores **first and last separately**. On upgrade we have to guess where the first name
ends. Owner-decided in principle 2026-06-24; never built. **Decisions still open — see §2.**

**Scope widened 2026-07-28 (owner raised it at Batch 2 QA): a player can hold only ONE parent/guardian.**
Separated parents, two working parents, a grandparent doing the driving — all common, none supported.
The emergency contact is the only second person we store and it's name + phone, never messaged.
**Do this WITH the name split, not as its own project:** both reshape the same guardian fields, and
every surface they touch is the same one — the add-player form, bulk-import columns, the spreadsheet
template, exports, the PDF, the player profile, and the announcement / dues-reminder recipient logic.
Shipping them apart means disturbing all of that twice, including two rounds of owner QA.
Also fold in the readiness review's P1 *"clarify what guardian fields actually do"* (today they're
contact-only — no parent login or account link — and support fields the question); one piece of work
that makes the guardian model correct, consistent, plural, and honestly described.
⚠ **The decision that gates it is a money decision, not a UI one — see CP-7.**
Note: CP-3 ("guardian optional on the Premium add form") is effectively satisfied — Batch 2 collapsed
guardian contact behind a disclosure, so it no longer reads as required.

### 1.5 Coach Portal Growth — Phases 2+
Phase 1 (per-page education strip, cross-shell brand continuity) shipped. Open:
- Phases 2–4 — brand-chrome continuity + education depth.
- Phase 5 — **self-serve checkout** (flipping the existing upsell CTAs from "express interest" to real checkout is a *label change*; the infrastructure is already built). Not blocked by 2–4.
- Phase 6 — modal-layer admin inside the coach shell. **Large, deferred.**

### 1.6 Lineup — deferred sport-neutrality gaps
Lineup Intelligence P0–P5 and the Lineup Builder Phases 1–4 are built and live. Known gap carried
forward: parts of the lineup surface assume diamond sports. Benign while only softball/baseball are
offered and Multi-Sport Phase 2 is paused — **must be swept before any non-diamond sport is enabled**.
Cross-reference: `PROGRAM_TOURNAMENT_ENGINE.md` §Multi-Sport.

### 1.7 Free-coach removal safeguard — Phase 4 tail
Phases 1–2 (preserve a free Coaches Portal when removing an org admin who is also a free coach) are
built and live. Phase 4 — the same informed-consent warning on the **platform-admin customer-user
delete** path — was owner-approved 2026-06-27; confirm at pickup whether it landed.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| CP-1 | **Retire the Coach Nav Rebuild plan?** It has 7 unanswered design questions (OQ-1…OQ-7) about the *free* coach shell — but the in-flight Free Coach Portal Experience (A1–A4, B1–B3) rebuilt that shell on a different model (consumer-family chrome). The two plans now contradict each other. | **Retire it.** Carry forward only **OQ-7** (how to persist which team-ops capabilities a coach has activated per team) — that question is still unanswered and still real. |
| CP-2 | **Player/guardian name split — does the coach's own name get the same treatment?** The person registering a team is a coach, not a player/guardian. | Treat separately; don't bundle. |
| CP-3 | **Guardian becomes optional in the Premium add-player form** (to match the free side)? | Yes — "consistent across the board" was the point of the project. |
| CP-4 | **Tournament registration rosters in scope** for the name split? | Yes if they capture a single name field; first build step verifies. |
| CP-5 | **Coach Portal Growth Phase 5 — flip self-serve checkout to live?** Infrastructure is ready; it's a label change. Gated by the Premium-$0-until-2027-01-01 founding decision. | Hold until the January 2027 conversion runbook is scheduled — flipping now sells something you're currently giving away. |
| CP-6 | **Premium getting-started help rewrite** — schedule now or bundle with the next `/docs` sweep? | Bundle with the next `/docs` sweep. |
| CP-7 | **When a player has two guardians, who gets the dues reminder — both, or one nominated payer?** (raised 2026-07-28; gates §1.4's multi-contact scope.) The same question decides whether announcements go to every contact, which changes what the pre-send recipient count means. Getting it wrong means a household is chased twice for one payment, or one parent silently never hears anything. | **Needs an owner ruling before build** — it's a money/messaging call, not a UI one. Leaning: announcements → all contacts; dues → one nominated **billing contact** per player, defaulting to the first, so money has exactly one addressee and no family is double-chased. |

---

## 3. Verification debt (single item, replaces ~14 stale "awaiting browser verification" markers)

The following shipped to production without a recorded owner browser sign-off. They have been live
for 4–8 weeks with no reported defect, so treat this as **cleanup, not risk**: Phase-5 season &
division rollover · premium migration retry · player-profile Wave B · lineup builder · lineup
intelligence P0–P5 · mobile pass (Overview/Roster/Schedule/Dues) · free-coach removal safeguard
P1–P2 · registration form Stage-1 polish · free-tier coach slices 5·0–5j.

**Suggested close-out:** one owner pass through the premium portal on a phone during the Batch 1/2 QA
you already have queued, then strike this section.

---

## 4. Shipped — reference only

- **Unified Coaches Portal** — one portal for tournament-coach records, paid standalone workspaces, org-billed and Club coach access; legacy `/my` routes migrated to `/coaches`.
- **Free (Basic) coach floor** — org-less team route, master roster, standalone coach home, claim-by-email, phase-adaptive Team HQ, live schedule bridge, coach-side roster submit.
- **Premium upgrade flow** — two-screen value → confirm+pay, team pre-filled, roster/schedule/fees carried across with an honest "check this" summary; auto-retry + manual retry on partial carry.
- **Season & division rollover** — head coach starts next season themselves; roster carries, optional fee-template and planned-budget carry, previous season goes read-only.
- **Player profile Wave B** — emergency/medical, handedness, jersey size, dues + attendance at a glance.
- **Lineup builder + lineup intelligence** — Best/Okay/Never position ranking, pitching depth chart + arm-care caps, fairness checks, one-click auto-generate, field-ready printout, team depth-chart board.
- **Assistant coaches** — capability enforcement, head-coach invite/manage, admin oversight (free-side assistants dropped by owner decision).
- **Mobile pass** — Overview, Roster, Schedule, Accounting Dues exemplar.
- **Coach Portal Growth Phase 1** — per-page education strip + cross-shell brand continuity.
- **Free-coach removal safeguard P1–P2** — removing an org admin no longer silently destroys their free Coaches Portal.

---

## 5. Source files consolidated (archive candidates)

`COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md` · `COACHES_PORTAL_UNIFIED_PM_BRIEF.md` ·
`COACHES_EXPERIENCE_EVAL_PLAN.md` · `COACHES_EXPERIENCE_EVAL_PM_BRIEF.md` ·
`COACH_EXPERIENCE_WALKTHROUGH_PLAN.md` · `COACH_EXPERIENCE_WALKTHROUGH_PM_BRIEF.md` ·
`COACH_EXPERIENCE_WALKTHROUGH_TEST_SCRIPT.md` · `PREMIUM_COACHES_PORTAL_WALKTHROUGH_PLAN.md` ·
`PREMIUM_COACHES_PORTAL_WALKTHROUGH_PM_BRIEF.md` · `COACHES_PORTAL_MOBILE_PLAN.md` ·
`COACHES_PORTAL_MOBILE_PM_BRIEF.md` · `COACH_NAV_REBUILD_PLAN.md` · `COACH_NAV_REBUILD_PM_BRIEF.md` ·
`COACH_PORTAL_GROWTH_PLAN.md` · `COACH_PORTAL_GROWTH_PM_BRIEF.md` ·
`COACHES_PORTAL_LINEUP_INTELLIGENCE_PLAN.md` · `COACHES_PORTAL_LINEUP_INTELLIGENCE_PM_BRIEF.md` ·
`COACH_LINEUP_BUILDER_PLAN.md` · `COACH_LINEUP_BUILDER_PM_BRIEF.md` ·
`PREMIUM_COACHES_PORTAL_PLAYER_PROFILE_WAVE_B_PLAN.md` ·
`PREMIUM_COACHES_PORTAL_PLAYER_PROFILE_WAVE_B_PM_BRIEF.md` ·
`COACH_PREMIUM_UPGRADE_FLOW_PLAN.md` · `COACH_PREMIUM_UPGRADE_FLOW_PM_BRIEF.md` ·
`COACH_PREMIUM_PHASE5_SEASON_DIVISION_PLAN.md` · `COACH_PREMIUM_PHASE5_SEASON_DIVISION_PM_BRIEF.md` ·
`COACH_PREMIUM_MIGRATION_RETRY_PLAN.md` · `COACH_PREMIUM_MIGRATION_RETRY_PM_BRIEF.md` ·
`COACH_PREMIUM_RELEASE_CHECKLIST.md` ·
`FREE_COACH_REMOVAL_SAFEGUARD_PLAN.md` · `FREE_COACH_REMOVAL_SAFEGUARD_PM_BRIEF.md` ·
`CONSISTENT_PLAYER_GUARDIAN_NAMES_PLAN.md` · `CONSISTENT_PLAYER_GUARDIAN_NAMES_PM_BRIEF.md` ·
`FREE_TIER_COACHES_UNIFIED_PLAN.md` · `FREE_TIER_COACHES_UNIFIED_PM_BRIEF.md` ·
`FREE_TIER_COACHES_PHASE_5_BUILD.md`
