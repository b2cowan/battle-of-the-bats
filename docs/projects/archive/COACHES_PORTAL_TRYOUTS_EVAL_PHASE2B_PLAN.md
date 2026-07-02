# Coaches Portal — Tryouts & Evaluation · PHASE 2B — Implementation Plan

> **Status:** PLANNED, not started. Scoped 2026-07-01, grounded in the Phase 2A tryout workspace (built) + DB_ARCHITECTURE_REVIEW Finding #30 (2B tables pre-confirmed) + the logged design decisions (2026-06-30 tryout-day UI direction).
> **Created:** 2026-07-01
> **Branch:** dev
> **Parent plan:** `COACHES_PORTAL_TRYOUTS_EVAL_PLAN.md` (Phase 2B); Phase 2A is complete.
> **Surface:** Premium Coaches Portal (`app/[orgSlug]/coaches/teams/[teamId]/tryouts/**`) + a NEW no-account evaluator scoring surface (token page). Coach-scoped, same access model as 2A.

## Goal
Turn the checked-in candidate pool into a **scored, ranked, decided roster**: build an evaluation rubric, let multiple coaches score on their phones (no extra logins) with a live composite, rank candidates, drag them into Offer / Waitlist / Not-this-season, and accept a player onto the roster with fees in one step — plus branded offer/release emails and the one-way "reveal names".

## PM Brief
**What it does:** Adds player evaluation + roster decisions to the tryout workspace — a configurable scorecard, multi-evaluator mobile scoring with a live combined score, a ranked drag-to-decide board, one-tap accept-to-roster-with-fees, and offer/release emails.
**Why it matters:** This is the half of tryouts that competitors charge per-player for; it's the "analyst-on-staff" value and the reason a rep coach switches. It closes the loop from "kids showed up" to "here's the team."
**Who benefits:** Premium head coach (runs it) + assistant/co-coach evaluators (score via no-login links) + candidate families (branded offer/release emails — no new logins).
**Expected impact:** A coach evaluates 30 kids fairly, sees a data-backed ranking, and builds the roster in one sitting instead of paper + spreadsheet + a whiteboard meeting.
**Priority:** High — the flagship value of the whole project; larger than 2A.
**Success criteria:** Multiple coaches score independently on phones; the composite + bias flag are trustworthy; ranking → offer/accept → roster+fees works in one flow; blind stays fair until a deliberate reveal; nothing leaks a candidate's PII to an evaluator who shouldn't see it.

## Confirmed data model (DBA Finding #30 — all anchor on `rep_tryouts.id`)
- **`rep_tryout_rubrics`** — the scorecard: skill categories (JSONB: label, weight, per-category instructions), scale (1–5 / 1–10), clone-for-reuse. Softball/baseball starter templates seeded from the Sport Pack.
- **`rep_tryout_evaluator_sessions`** — no-account co-coach links: `token_hash`, evaluator name, `expires_at` (≤48h), `revoked_at` (checked server-side on every write), single-use-per-evaluator.
- **`rep_tryout_scores`** — one score per (evaluator_session, candidate, category): **`UNIQUE(evaluator_session_id, registration_id, category_key)`** (upsert, no dup rows). ⚠ **DECISION CHANGE (mig 167, 2026-07-01): the live dashboard POLLS (6s) instead of using Realtime** — the Coaches Portal uses no client Realtime, and keeping these tables off Realtime avoids exposing minors' scores to any client RLS-SELECT path. So **NO REPLICA IDENTITY FULL / no realtime publication** is needed here (the mig-132 gotcha does not apply). Both mig-167 tables are RLS-enabled-no-policies (service-role only).
- **Rankings = derived** (read-time from scores × weights); **offer/waitlist/cut reuses the existing `rep_tryout_registrations.status`** machine (pending_review→offered→accepted→declined/withdrawn). Score lock uses the reserved `rep_tryouts.scores_locked_at/by`.

## Design direction (logged 2026-06-30)
Reuse the Coaches Portal system; mobile field-side (≥48px targets, one-player-at-a-time cards, auto-save per score, optimistic + offline-tolerant). Blind = names-hidden mode; **reveal names is a deliberate, confirmed, irreversible action** (ConfirmProvider). **Do NOT build the "coachability flag" UI** (parent-dispute liability — a private overall note is fine, a highlighted low attitude score in the ranking is not). Bias indicator is neutral, not alarmist.

## Phases (each an independently shippable slice — likely split into sub-projects)

### 2B.0 — Pre-work (carry-overs from 2A + reveal)
- [x] **Bib uniqueness** ✅ (mig 166): partial unique index `(program_year_id, bib_number) WHERE NOT NULL` (dedup-first so it can't fail on existing data); `getRepTryoutCheckinList` bib auto-assign now **tolerant of the constraint** (a concurrent conflict is caught + re-read, no 500). Closes the 2A duplicate-bib finding. (Full "move assign off GET" not needed once the constraint prevents dups.)
- [~] **Sport-neutrality** — rubric starter routed through a sport-configurable module (`lib/tryout-rubric-templates.ts`, diamond set for softball/baseball V1). ⚠ Broader threading of `team.sport` into roster/lineup (`getSportPack(DEFAULT_SPORT)` default) STILL PENDING — touches shared/possibly-concurrent files; do when clean.
- [ ] **Reveal names** — STILL PENDING (deferred to **2B.3**). 2B.2 scoring + scoreboard already **respect** blind mode (bib-only end-to-end), but the deliberate one-way un-blind action (ConfirmProvider) isn't built yet — it pairs naturally with the decision board + score-lock.

### 2B.1 — Configurable evaluation rubric ✅ BUILT (dev)
- [x] **Data foundation**: `rep_tryout_rubrics` (1 per tryout, `categories` JSONB, `scale_max` 5/10, RLS-enabled-no-policies, mig 166) + types + `getRepTryoutRubric`/`upsertRepTryoutRubric` + coach-scoped **rubric API** (GET returns rubric + sport starter + scale options; PUT normalizes categories — stable keys, weights, dedupe — and upserts). Assigned-coach + active-PY auth; org-context clean.
- [x] **Rubric builder UI** (`TryoutRubricCard` on the Tryouts page, reuses the Tryout Day card styling): empty-state "Set up scorecard" seeds from the starter; builder = name + scale (1–5 / 1–10) + category list (label · weight · optional evaluator note, add/remove) → Save; read-only summary + "Edit scorecard" once set. lint 0-err, typecheck clean.
- Note: reorder categories + clone-from-a-prior-tryout deferred (add/remove covers V1). **This slice is testable now** (set up a scorecard on the Tryouts tab).

### 2B.2 — Multi-evaluator mobile scoring + live aggregation + bias flag (the big one) ✅ BUILT (dev)
- [x] **Data foundation** (mig 167): `rep_tryout_evaluator_sessions` + `rep_tryout_scores` (both RLS-enabled-no-policies, dictionary-synced) + types + `lib/tryout-evaluator-token.ts` (SHA-256, raw token never stored — `team_workspace_claims` posture) + db fns (create/list/revoke session, `getByTokenHash`, upsert/get scores).
- [x] **No-account evaluator session links** — head coach generates in `TryoutEvaluatorsCard` (name → mint link, raw token shown **once**, copy-to-share); 48h expiry; revoke ("turn off"). Coach-scoped API (`tryout-evaluators` + `[evaluatorId]`) with IDOR guard on revoke.
- [x] **Evaluator scoring flow** — no-account mobile page `/tryout-score/[token]` (token IS the auth; server re-checks revoked/expired/locked + IDOR on every write): player list (bib-first when blind) → tap → per-category 1–N tap-to-score, optimistic + revert-on-error, completeness checks. Big tap targets, safe-area, sunlight contrast. (Per-category **note** column reserved but not surfaced in V1 — ratings-only for field speed.)
- [x] **Head-coach live dashboard** (`TryoutScoreboardCard`, **polls 6s**): weight-normalized composite per candidate, ranked; per-category averages; **evaluator-bias indicator** (runs-hot/cold vs consensus mean, fires only at ≥3 candidates scored + ≥15%-of-scale deviation to suppress small-panel false positives). Respects blind mode (bib-only until reveal).
- Note: **score-lock UI** (freeze scoring via `rep_tryouts.scores_locked_at/by`) enforced server-side (POST returns `locked`) but the head-coach **lock button is deferred** to 2B.3/decision board; **swipe-to-advance** not built (tap-back-to-list is the V1 nav). lint 0-err, typecheck/org-context/tokens clean.
- [x] **Adversarial /review pass (2026-07-01)** — high-risk tier, 5 finder lenses → 18 findings → 13 confirmed / 5 refuted. **All confirmed fixed + gate re-green:**
  - *High:* (1) mobile scoring revert-on-error clobbered other categories tapped in parallel → now per-category in-flight tracking + per-category revert. (2) no-account evaluator GET triggered bib-assignment **writes** just by loading → token path now uses a read-only candidate list (`getRepTryoutCheckinListReadOnly`); bib assignment stays coach-authenticated (check-in + scoreboard).
  - *Medium:* declined/withdrawn candidates could still be scored via the token POST → status added to the IDOR guard; bias "consensus" was volume-weighted (a high-volume scorer masked their own bias) → now mean-of-evaluator-means; deleting a **scored** scorecard category silently orphaned scores → PUT now 409s on removal of a scored key (rename/weight edits still allowed); `score` had no DB range guard → **CHECK 1–10** added to mig 167 (re-applied to dev; prod-pending) + dictionary synced.
  - *Low/Advisory:* category-key collision suffix fixed (incrementing counter); polling/refetch thrash fixed (`onError` stabilised behind a ref in all 3 cards); token length guard tightened to exact 43 chars.
  - *Accepted (documented):* revoked (403) vs invalid (404) link responses — kept for the legitimate evaluator's benefit ("turned off" vs "expired"); review rated the info-disclosure negligible (only a prior token-holder can observe it; 256-bit tokens unguessable).
  - *Refuted (no change):* token_hash NOT-NULL present; program-year↔team & ↔tryout IDOR both structurally enforced by unique indexes; evaluator-list token-leak blocked by the mapper allowlist.

### 2B.3 — Ranked decision board + reveal + score-lock ✅ BUILT (dev)
- [x] **Decision board** (`TryoutDecisionBoard`): candidates ranked by weighted composite (via the shared `rankTryoutCandidates`), each with a **tap-to-choose** Offer / Waitlist / Not this season (mobile 3-way, NOT drag — field ergonomics) + a live tally. Coach-scoped API (`tryout-decisions` GET ranked+status+counts, POST decide) maps offer→offered/waitlist→waitlisted/cut→declined via the existing status workflow; POST IDOR-guards to the program year and blocks accepted/withdrawn. (No coachability flag.)
- [x] **Waitlist = new status** (mig 168 adds `'waitlisted'` to the CHECK; type + dictionary synced): distinct from pending so 2B.5 can auto-promote. Threaded through the admin applicant page (tab/label/badge/count **+ Extend Offer / Decline action buttons + Mark Withdrawn** — review-added) and the admin `VALID_TRANSITIONS`.
- [x] **Reveal names — one-way + confirmed** (replaces the 2A two-way blind toggle): server rejects re-blinding (409); `ConfirmProvider` gate on the client. Once revealed, names flow to the check-in screen, scoreboard, and decision board.
- [x] **Score-lock — reversible** (Lock scoring / Reopen on the scoreboard, stamps `scores_locked_at/by`): freezes evaluator input (the token endpoint already rejects writes when locked); live pulse hides when closed.
- [x] **Adversarial /review (2026-07-01):** high-risk, 5 lenses → 15 findings → 12 confirmed / 3 refuted. **All confirmed fixed + gate re-green:** *High* admin waitlist dead-end (added action buttons); *Medium* shared-helper type contract (added `evaluatorSessionId` to the Pick), scoreboard lock↔poll race (generation guard + optimistic flip); *Low* decision buttons disabled during any save, admin waitlist success toast; *deferred-with-note* waitlist guardian email → 2B.5. Refuted: reveal double-submit (ConfirmProvider single-resolver), decision-vs-scoreboard rank universes (intentional — board keeps declined for re-decide), reveal 409 "dead code" (both branches reachable).
- Deferred to 2B.5: waitlist guardian email + auto-promote-on-lapse. score-lock has no separate "reopen after reveal" coupling (independent, intended).

### 2B.4 — One-click accept-to-roster + fee setup
- [ ] Accept drawer pre-filled from the registration (name/DOB/jersey/position); one "apply standard fee schedule" option; **single transaction** creating the roster row (`source='tryout'`, links `tryoutRegistrationId`) + the dues schedule. Also **wrap the pre-existing non-transactional accept** (roster-insert-then-status) in a transaction.

### 2B.5 — Offer / release emails + waitlist auto-promote
- [ ] Org-branded offer email (Accept/Decline via a token-authenticated response page), dignified release copy, **waitlist auto-promote** on lapse + deadline tracking. Email only, reuses the Resend stack. (Copy → `/marketing` before ship.)

## Decisions LOCKED
- Bundled in the Premium Coaches Portal (no per-player fee) — already logged.
- Blind default-ON; reveal one-way + confirmed; no coachability-flag UI.
- Offer/release **emails proceed** (coach→guardian email, NO new accounts) — NOT blocked by the parent-users deferral (which is about parent/athlete *logins*, not email).

## Decisions OPEN (owner / routed agent)
- **No-account evaluator link security posture** — confirm acceptable (token ≤48h, single-use-per-evaluator, `revoked_at` enforced, blind = bib-only exposure). → security review at build.
- **Rubric defaults** — scale (1–5 vs 1–10) default + the seeded Canadian starter categories → confirm with owner / a rep coach.
- **Gate ratification** — Premium-core; confirm via `/billing` + `PLAN_PRICING_FACTS.md` before build.
- **Bias-flag threshold** — at what evaluator count / deviation does it fire (avoid false positives at small panels).

## Guardrails (binding)
- **No-account evaluator links:** cryptographically-random token, ≤48h expiry, per-evaluator (non-shareable), **explicit `revoked_at` checked server-side on every score write**, all links invalid once scoring closes. In blind mode an evaluator sees **bib numbers only** (no candidate PII).
- **Realtime scores table:** `REPLICA IDENTITY FULL` + the unique constraint (upsert not dup) — the mig-132 lesson.
- **PIPEDA:** scores are about minors — coach-only until any (future, separate) parent-transparency decision; never expose raw evaluator scores/names to families.
- **Sport-neutral:** all rubric/score vocab via the Sport Pack (see 2B.0).
- **Schema = dictionary** same unit of work; plan-gate keys land in the Facts doc + `lib/plan-config.ts` together.
- **Mobile field-side:** the 2A check-in standards apply to scoring (big targets, auto-save, offline tolerance, sunlight contrast).

## Sequencing / splitting
Recommend shipping as sub-slices in order: **2B.0 → 2B.1 rubric → 2B.2 scoring → 2B.3 ranking → 2B.4 accept-to-roster → 2B.5 emails**, each browser-verified + `/review`'d. 2B.2 (realtime multi-evaluator) is the largest and highest-risk; consider it its own sub-project. `/docs` when the coach-facing flow lands; `/design` for the scoring-card + ranking-board visual direction (new surfaces).
