# Build prompt — Tryout Insights Phase 2: Development Baseline (fresh chat)

> Single-use build prompt. Archive on completion per the standing prompts rule.

## What you are building

The **development baseline seeding flow**: after acceptances, the coach walks player-by-player
through their tryout snapshot, confirms or edits suggested focus areas, and each new roster player's
development page opens the season with a clearly labeled "Tryout snapshot" context card.

**Read first, in order:**
1. `docs/projects/active/COACH_TRYOUT_INSIGHTS_PLAN.md` — §2 (rulings R1–R8, owner-ratified
   2026-08-02), §3 (snapshot spine), §5 (this phase's spec + work items B1–B6 + edge cases).
2. `memory/design_decisions.md` — the 2026-08-02 "Tryout Insights" entry. R3/R4/R5 are the walls.
3. **Mockups v1 = binding visual spec** (owner-approved 2026-08-02, incl. the OQ-2 suggestion rule
   drawn in frame 04): https://claude.ai/code/artifact/3b8bf1f9-c1c5-407c-9fa6-376a5bf8fee2 —
   frames **04** (seeding walkthrough) and **05** (snapshot card, dashed-border context treatment,
   coach-eyes-only line rendered on the card).
4. `docs/projects/active/COACH_TRYOUT_INSIGHTS_PM_BRIEF.md` for the product frame.

## Phase 1 landed these — build ON them, don't re-derive

- **`lib/tryout-report.ts`** — the snapshot math and shapes (`TryoutReportCandidateRow`:
  composite + `categoryAverages` keyed by rubric category key + `evaluatorCount`). The stored
  baseline's jsonb should be assembled from this module's outputs plus the rubric's
  `{scaleMax, categories:[{key,label}]}` — do NOT invent a second averaging path
  (`rankTryoutCandidates` in `lib/tryout-scoring.ts` is the single source).
- **`app/api/coaches/[orgSlug]/teams/[teamId]/tryout-report/route.ts`** — resolver idiom (auth →
  team → assignment → `denyUnless(capabilities.tryouts)` → active program year; `getRepTryout`,
  never getOrCreate, for reads).
- **`components/rep-teams/TryoutReportCard.tsx`** on the Build stage — the seeding entry card
  ("Start development from tryouts — {N} players") mounts on the same stage, below the report.
  Unit tests: `tests/unit/tryout-report.test.ts`.

## Binding rules for this phase

- **R4:** the baseline is stored ONCE at seed time (a later rubric/score edit never rewrites it),
  renders as a context artifact (frame 05's dashed border), and NEVER enters measurables/trends.
- **R3:** coach-eyes-only, stated on the card itself. Work item **B5** makes it testable: a unit
  guard asserting the family recap/keepsake payload builders (see `lib/player-season-recap` and the
  Chunk D slice-3 surfaces) never include baseline/tryout-evaluation fields.
- **R5:** suggestions (categories strictly below the scale midpoint, lowest first, **max 2** —
  ratified via frame 04) resolve through a coach-confirmed picker against the team's existing focus
  vocabulary (see the focus-tags API under `app/api/coaches/[orgSlug]/teams/[teamId]/focus-tags/`
  and how development goals mint on `roster/[playerId]/development`). "Don't add" is a first-class
  answer; nothing is ever created silently.
- Only ROSTERED players seed; one-time per player per season; re-entry shows "✓ baseline set" and
  skips by default; a player with no scores gets "no snapshot — set focus manually" and never blocks.

## Migration (work item B1)

New table (recommended `rep_player_tryout_baselines`): roster_player_id FK, program_year_id,
team_id, org_id, `snapshot` jsonb, seeded_by, seeded_at; UNIQUE per roster player per program year.
Confirm the final shape with `/db`.

**Ride-along in the same migration (queued by the Phase-1 /simplify altitude finding):** a sticky
`first_offered_at` on `rep_tryout_registrations`, set when an offer is first extended and NEVER
cleared by `clearTryoutOffer` — today a coach re-deciding an offered candidate erases the offer's
trace, so the report's "Offered" funnel number can only claim current standing, not offers
extended (documented on `TryoutReportFunnel.offered` in `lib/tryout-report.ts`). Once the column
exists, switch that funnel stat to count `first_offered_at IS NOT NULL` and restore the
"ever offered" claim honestly. Standing rules that have bitten before:
- **Check `ls supabase/migrations/` immediately before picking a number** (another session took a
  number mid-build once; current watermark at Phase-1 time: 221).
- Same unit of work: `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots`.
- Migration is DEV-first and joins the existing dev-only queue (214–221 at time of writing) that
  must reach prod before any of this promotes. `check:schema-parity` currently fails on that known
  queue — do not "fix" the baseline for it.

## Verification + handoff

`npm test` (full unit suite green), `npm run typecheck` (shared modules touched), lint:focused on
changed files, `verify:changed` (token guardrail: register any new CSS module in
`scripts/check-public-tokens.mjs` operator scope, next to TryoutReportCard.module.css). New files ⇒
dev-server restart before owner QA. Update the plan status + `TODO.md` line +
`memory` auto-memory (`project_tryout_insights.md`). Offer `/simplify` then `/review` then `/docs`
(tryouts guide + development guide both change). **Standing rules: dev branch only, explicit
pathspecs, NO commit without per-action owner OK, product-owner voice in chat.**
