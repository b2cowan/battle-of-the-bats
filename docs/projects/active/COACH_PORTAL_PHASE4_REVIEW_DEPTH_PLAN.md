# Coaches Portal — Phase 4: Review Depth (Implementation Plan)

> **Part of:** the [Coaches Portal IA/UX Review](COACH_PORTAL_IA_UX_REVIEW_PLAN.md) (§8, Phase 4). Phases 0, 1, and 3 are BUILT + reviewed on `dev` (Phase 3 committed `3b0dabc1`, 2026-07-06). Phase 2 (Standings) was **CUT**. This is the "rich, resonant data" half of the review.
> **PM brief:** [COACH_PORTAL_PHASE4_REVIEW_DEPTH_PM_BRIEF.md](COACH_PORTAL_PHASE4_REVIEW_DEPTH_PM_BRIEF.md)
> **Status:** **CONTENT-COMPLETE (2026-07-07).** F1–F3 BUILT + adversarially reviewed + committed on `dev` (F1 `5b8194a7`, F2 `6296fd4a`, F3 `f2c68a53`); each shipped with `/docs` sync. **F4 CUT** (owner decision 2026-07-07 — same FieldLogicHQ-hosted-only data limitation that cut Phase 2 Standings; never render a placement we can't back). Unpushed; owner browser-test + Phase 5 permission sweep still pending.
> **Migration:** NONE. Phase 4 is new read-only views + endpoints over data the portal already collects. (Matches the review's binding "no phase needs a migration" constraint.)

---

## 1. Goal

Phase 3 made the portal *findable*. Phase 4 makes it *insightful*: turn the data already captured (game results, attendance, dues, past seasons) into decision-useful, emotionally-resonant views — the "robust metrics at your fingertips" half of the paid promise. Everything reuses existing data and existing engines; nothing new is collected.

## 2. Scope — four features, priority order

### F1 — "Who hasn't paid at all" actionable list *(BUILD FIRST — highest utility-per-effort)*
- **Today:** the Overview shows a *count* ("N unpaid" = players who owe dues but have recorded zero payments — the existing `duesUnpaidCount` logic). The Money/dues area lists everyone but doesn't segment the never-paid.
- **Phase 4:** a **named list** of the zero-paid players (owe dues, no payment recorded) with a **one-tap reminder** action per player (or "remind all"), living in the Money area (a segment/filter on the dues view, or a focused "Needs chasing" panel). Reuse the existing dues data (`/dues`) and the existing reminder mechanism (auto-reminders + any manual send in `accounting-settings`/dues).
- **Definition of "hasn't paid":** owes dues (has installments OR `outstanding > 0`) AND no `installments[].paidAt` — identical to the Overview's `duesUnpaidCount` so the number and the list always agree.
- **Gating:** money capability (`caps.money !== 'off'`); reminders may require `money === 'write'`. Honor the tri-state.
- **Effort:** S–M (data + reminder already exist; this is a view + wiring).

### F2 — Season-over-season comparison
- **Today:** Phase 3 shipped a small **"Last season" tile** (record · dues · expenses → Season Review). Season Review lists past years as cards.
- **Phase 4:** a **comparison view** (in Season Review, or its own tab): this season vs prior season(s) side-by-side — win/loss/tie trend, dues collected, expenses, roster size, (optional) tryout acceptance. Reuse the existing history endpoint (`/history` returns per-year record + accounting).
- **Framing:** "are we better than last year?" — trend arrows, not a wall of numbers. Money rows gated on `caps.money`.
- **Effort:** M (data exists; mostly a comparison UI).

### F3 — Per-player attendance reliability
- **Today:** attendance is recorded per event (In/Late/Out/No-reply) and drives lineups; there's no season roll-up.
- **Phase 4:** a season-long **per-player attendance rate** (e.g. "attended 8/10 games, 12/15 practices") — a roster-adjacent view or a Roster column, computed from existing attendance records across the season's events.
- **Framing:** SUPPORTIVE, not a leaderboard/shaming board — helps fair playing-time conversations and spotting a kid drifting away. Careful copy + neutral visual treatment.
- **PII note:** attendance is not PII-gated the way contacts are, but keep the treatment respectful; respect the `roster` capability.
- **Effort:** M–L (needs an aggregation endpoint over all events' attendance; watch query cost).

### F4 — Tournament placement card *(CUT 2026-07-07)*
> **CUT.** Owner chose to drop it rather than build hosted-only. Placement is only truthful for a FieldLogicHQ-hosted tournament (the platform holds every team's games); most tournaments run off-platform, so a card would be blank/misleading for the majority — the identical data-honesty reason that cut Phase 2 Standings. Not built. If ever revisited, build hosted-only (silent otherwise), never a hollow card.
- **Today:** the standings/placement engine exists (wired to admin/public), not to a coach route.
- **Phase 4:** show how the team **finished** a tournament (e.g. "2nd, Pool B") by wiring the existing placement function to a coach route/card.
- **⚠ BINDING DATA CAVEAT (same reason Standings was cut):** placement is only truthful for a **FieldLogicHQ-hosted** tournament (the only context where the platform holds every team's games). Most tournaments run off-platform → a placement card would be blank/misleading for the majority.
- **Decision required (see §4):** build **hosted-only** (card appears solely for FieldLogicHQ-hosted tournaments, silent otherwise) **or CUT**. Do NOT imply a placement we can't back with data.
- **Effort:** S if hosted-only (engine exists); the risk is product-honesty, not code.

## 3. Constraints (inherit the review's binding rules — §9 of the umbrella plan)
- **No migration.** New read-only endpoints only.
- **Assistant-capability + PIPEDA gating** on every new view: money views gated on `caps.money` (tri-state); guardian PII stays behind the per-coach `rosterPii` grant (never a module gate); reuse `lib/coach-nav-visibility.ts` if any new nav item is added.
- **Premium ≥ Free**, no regressions to the free/basic portal.
- **Sport-neutral** vocabulary via the Sport Pack (no hard-coded "runs/innings").
- **Coach warmth dialect** + **CP-1** (one lime action per surface); mobile breakpoints 900/640; touch ≥40px; lime = fills only.
- **Reuse, don't rebuild:** dues data, history endpoint, attendance records, standings engine all exist — design around them.
- **Placement honesty:** never render a placement/standing without real data behind it (the Standings-cut principle).

## 4. Owner decisions (RESOLVED 2026-07-07)
1. **F4 tournament placement:** **CUT** (data-honesty; see F4 above).
2. **F1 reminder scope:** **per-player reminder + "Remind all"** (both shipped).
3. **F3 placement:** **dedicated compact view reached by a link from Roster** (not a column, no new top-level nav item).
4. **F2 comparison:** **this season vs last only** (not multi-year); **split gating** — record/roster/tryout open to any assigned coach, dues & expenses money-gated (page + nav).
5. **Build order:** F1 → F2 → F3, each built → reviewed → docs → committed. F4 cut.

## 5. Phasing / build order
- **P4a — Who hasn't paid (F1)** — ship first; smallest, most useful.
- **P4b — Season-over-season (F2)** — builds on the shipped Last-season tile.
- **P4c — Attendance reliability (F3)** — supportive framing pass with /design.
- **P4d — Placement (F4)** — only if owner picks "hosted-only"; otherwise cut.
- Each sub-phase: PM UX summary → build whole sub-phase → focused verify (typecheck + lint) → adversarial `/review` → `/docs` if a user-facing flow/term changes → owner browser test.

## 6. Success criteria
- A coach can answer "who hasn't paid anything?" as a named list + reminder, not a count they cross-check by hand — and the list count always matches the Overview badge.
- A coach can answer "how does this season compare to last?" without leaving the portal.
- Attendance reliability is visible per player and reads as supportive.
- Placement only ever appears where the data is real; never a hollow card.
- No migrations; assistant-permission gating intact; no free-portal regression.

## 7. First steps for the build session (do these before writing code)
1. **Re-verify current committed state** of the Money/dues area + the dues API shape (contested coach surface — check the live tree, not this plan). Confirm the `duesUnpaidCount` definition and the existing reminder mechanism (auto-reminders toggle + any manual send).
2. Present the **PM UX summary** for F1 (blocking, per AGENCY_RULES).
3. Get owner answers on the §4 decisions (at minimum F4 hosted-only vs cut, and F1 reminder scope).
4. Build F1 in one pass; stage explicit pathspecs only (coach files are hot); no commit without explicit OK.
