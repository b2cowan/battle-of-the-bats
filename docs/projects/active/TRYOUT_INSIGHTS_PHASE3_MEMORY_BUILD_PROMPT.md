# Build prompt — Tryout Insights Phase 3: Year-over-Year Candidate Memory (fresh chat)

> Single-use build prompt. Archive on completion per the standing prompts rule.
> Recommended order: run AFTER Phase 2 lands (not required — no hard dependency).

## What you are building

The **memory strip** on the decision board: a confirmed returning candidate shows last season's
tryout snapshot beside this season's, with a delta chip only when the two scorecards share a scale
— plus the report's "returning candidates improved" aggregate line.

**Read first, in order:**
1. `docs/projects/active/COACH_TRYOUT_INSIGHTS_PLAN.md` — §2 (rulings), §6 (this phase's spec,
   work items C1–C6, access mechanics).
2. `memory/design_decisions.md` — 2026-08-02 "Tryout Insights" entry. **R6, R7, R8** govern here.
3. **Mockups v1 = binding** (owner-approved): frames **06** (three states: same-scale delta ·
   different-scales side-by-side no arithmetic · unconfirmed match shows NOTHING; plus the phone
   stack) and **07** (the blind scorer unchanged — absence is the spec):
   https://claude.ai/code/artifact/3b8bf1f9-c1c5-407c-9fa6-376a5bf8fee2

## Phase 1 landed these — build ON them

- **`lib/tryout-report.ts`** — snapshot shapes + the single averaging path (via
  `rankTryoutCandidates`). Prior-season snapshots are RECOMPUTED from prior-year scores the same
  way `tryout-history` recomputes averages — extend/reuse, never a second formula.
- Continuity: `getRepTeamContinuityLinks(teamId)` (lib/db) returns every link; **CONFIRMED only**
  (Phase 1's roster-composition code in `buildTryoutReport` shows the filtering idiom, incl.
  matching via either `currentRosterId` or `currentRegistrationId`). Prior candidates who were
  never rostered DO get memory — prior side may be `priorRegistrationId`.
- Decision board: `components/rep-teams/TryoutDecisionBoard.tsx` (the strip lives inside the
  existing candidate card, adjacent to the "↩ returning · {season}" chip and the
  ContinuityCompareCard verify flow — verify-first stands; unconfirmed shows no scores, ever).

## Binding rules for this phase

- **R6 — memory never breaks the blindfold.** Prior-year evaluation data renders ONLY on the
  decision board post-reveal (and the report aggregate). Never on `TryoutScorerSurface`,
  `TryoutScoreboardCard`, or `TryoutCheckIn` (its identity-only returning marker is UNCHANGED).
  Work item **C5**: probes assert the ABSENCE at the DOM.
- **R7 — present, don't judge.** Side-by-side always; a delta ONLY when `scaleMax` matches;
  category-level comparison only on matched category keys; incomparable pairs render both cards +
  "different scorecards — shown side by side", no arithmetic. Report aggregate ("returning
  candidates improved +X on average") only at **≥3 comparable pairs**, else ABSENT.
- **R8 — the archive read is authorized, and the allow-list edit is the decision point.** The new
  read route (recommended: a dedicated `tryout-memory` season-aware endpoint via
  `resolveCoachSeasonRead`, NOT a `?year=` on the six live tryout instruments — see the
  tryout-history header comment for why) joins `APPROVED_SEASON_AWARE_ROUTES` in
  `tests/unit/coach-season-write-guard.test.ts` **with an entry comment citing R8 + the plan**.
  NO new archive door; nav untouched. Capability posture mirrors tryout-history (the historic
  season's own assignment row).

## Verification + handoff

`npm test` green (extend `tests/unit/tryout-report.test.ts` for the comparability rules + aggregate
threshold), typecheck, lint:focused, `verify:changed` (register any new CSS module in the operator
token scope). No migration expected. New files ⇒ dev-server restart before owner QA. Update plan
status + TODO line + auto-memory (`project_tryout_insights.md`); this phase COMPLETES the project —
move plan/brief/prompts to `docs/projects/archive/` only after owner QA passes and the owner OKs.
Offer `/simplify` → `/review` (high-risk lens: the season-read wiring) → `/docs`. **Standing rules:
dev branch only, explicit pathspecs, NO commit without per-action owner OK, product-owner voice.**
