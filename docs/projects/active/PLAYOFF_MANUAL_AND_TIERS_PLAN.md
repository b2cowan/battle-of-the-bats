# Playoffs: Free-Tier Manual Brackets + Tiered Auto-Split

**Status:** BUILT on `feat/free-tier-coaches` (2026-06-09), awaiting browser verification.
**Branch:** `feat/free-tier-coaches` · dev only (no migration — see below).

## Problem

1. Free-tier organizers had no real way to build a playoff bracket. The Playoff
   Bracket Generator was entirely Plus-gated (`playoff_generator`); "create game"
   only makes round-robin games, and manual single-game add never sets
   `is_playoff`, so advancement never fired.
2. The auto-wizard could not split one round robin into tiered playoffs — a 9-team
   round robin could only produce a single bracket, leaving lower seeds without a
   meaningful championship.

## What shipped

### Feature 1 — Free-tier manual brackets
- New plan feature **`playoff_manual`** (min `tournament`) separates *building a
  bracket* (free, all formats, manual date/time/venue entry) from *auto-scheduling
  it* (Plus). Defined in [lib/plan-features.ts](../../../lib/plan-features.ts).
- Server [games route](../../../app/api/admin/games/route.ts) `bulk-save` is now
  three-state: playoff + not-auto-scheduled → `playoff_manual`; playoff +
  auto-scheduled → `playoff_generator`; round-robin → `auto_schedule`. The client
  sends an `autoScheduled` flag. Both playoff-delete actions lowered to
  `playoff_manual` so free tier can replace its own brackets.
- The Playoff Bracket Builder opens on all tournament plans. Inside the wizard,
  the **Auto-schedule dates & times** toggle is locked (with upsell) for orgs
  without `auto_schedule`; free tier defaults to "Bracket structure only" and sets
  times by hand in the `BracketBuilder`.

### Feature 2 — Tiered auto-split (Plus)
- New `crossover: 'tiers'` + `tierConfigs[]` on `PlayoffConfig`
  ([lib/types.ts](../../../lib/types.ts)).
- Mirrors the existing per-pool (`crossover:'none'`) machinery, looped over
  **seed ranges** instead of pools: each tier calls `generateBracket(size)`, its
  `Seed #k` refs are rewritten to **global** `Seed #(fromSeed-1+k)` via
  `remapTierSeed`, and each tier gets its own `bracket_id`.
- **`advancePlayoffs` is unchanged** — Phase 2 resolves global `Seed #N` from
  overall standings; Phase 1 scopes `Winner/Loser` by per-tier `bracket_id`, so
  identical codes never collide. The play-in (e.g. 4 v 5 in a 5-seed tier) is the
  bracket's natural bye structure.
- Tier-setup UI: any number of tiers, adjustable cut-points, per-tier format +
  3rd-place, auto-suggested default split (two equal-ish tiers). `validateTierRanges`
  enforces contiguous-from-1, unique names, ≥2 seeds/tier, and `maxToSeed ≤`
  accepted teams — wired into preview + save.
- `BracketBuilder` now groups by the preview's `pool` field (tier name) and scopes
  each tier's matchup dropdowns to its global seeds via a `groupOptions` map.

## Key files
- [lib/types.ts](../../../lib/types.ts) — `PlayoffConfig.crossover` + `PlayoffTierConfig`.
- [lib/plan-features.ts](../../../lib/plan-features.ts) — `playoff_manual`.
- [lib/playoff-bracket.ts](../../../lib/playoff-bracket.ts) — `remapTierSeed`, `suggestDefaultTiers`, `validateTierRanges`.
- [app/api/admin/games/route.ts](../../../app/api/admin/games/route.ts) — gating.
- [PlayoffWizard.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx) — optimizer gate + tier generation + tier UI.
- [BracketBuilder.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/components/BracketBuilder.tsx) — group-by-pool + per-group options.
- [schedule/page.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/page.tsx) — `canBuildPlayoffsManually` + copy.

## Schema / migration
**None.** `divisions.playoff_config` is existing JSONB; this is a value-shape change.
Dictionary note added under `divisions.playoff_config`.

## Verification
- `npm run typecheck` ✓ · `node --test tests/unit/playoff-bracket.test.ts` (65 pass, incl. new tier tests) ✓.
- Browser (pending): free-tier manual build + locked optimizer; free-tier 403 on
  forged `autoScheduled:true`; Plus 9-team tiered split (1–5 / 6–9, play-in 4v5,
  grouped builder, distinct bracket_ids, Seed #6–9 resolve to ranks 6–9); tier
  validation rejects gaps/overlaps/dup-names/size-1/over-count.
