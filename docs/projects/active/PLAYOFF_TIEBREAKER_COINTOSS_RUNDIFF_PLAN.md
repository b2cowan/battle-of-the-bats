# Playoff Tie-Breakers — Coin Toss + Max Run-Differential Cap

**Status:** Planned — awaiting build greenlight
**Branch:** `feat/free-tier-coaches` (current)
**Created:** 2026-06-10
**PM brief:** `PLAYOFF_TIEBREAKER_COINTOSS_RUNDIFF_PM_BRIEF.md`

## Goal

Two additions to the tournament round-robin standings / playoff-seeding tie-breaker
system:

1. **Coin Toss** — a 5th tie-breaker option. Because it can't be computed, when teams
   remain tied after every other breaker and Coin Toss is the deciding step, the system
   **flags the tie** and the organizer **records the winner**; the recorded result is
   persisted and feeds standings + playoff seeding.
2. **Max run differential per game** — an optional cap so blowouts don't dominate
   seeding. With a cap of 7, a 14-0 win counts as **+7 Run Diff** for that game.
   **Cap affects the Run Diff (RD) column only** — Runs For / Runs Against stay as real
   totals (so `RF − RA` may not equal the displayed RD when a cap is active). Cap is
   **per-division overridable**, governed by the existing `tie_breaker_scope`.

## Decisions (confirmed with owner 2026-06-10)

- Coin toss → **flag + admin records winner** (persisted, drives seeding). Not auto-random, not label-only.
- Run-diff cap → **cap the RD column only** (RF/RA stay real totals).
- Cap scope → **per-division override**, mirroring tie-breakers (`tie_breaker_scope`).

## Architecture facts (from recon, file:line)

- **Single source of truth:** `getStandings()` in `lib/db.ts:1606-1731`. Per-game loop
  accumulates `rf`/`ra`, sets `rd = rf - ra` (`:1618-1646`); `breakTies()` recursively
  applies breakers (`:1648-1716`). Breaker resolution:
  `config?.tieBreakers || tournamentSettings?.tie_breakers || ['h2h','rd','rf','ra']` (`:1649`).
- **Standings order → playoff seeding is LIVE.** `advancePlayoffs()` (`lib/db.ts:1892-1987`)
  calls `getStandings(...)` (`:1950`) when a round-robin game completes and maps
  `Seed #N` → `standings[N-1].teamId` (`:1956-1974`). So any reorder (coin toss) or
  capped RD **immediately changes seeding** — this is intended.
- **`tournamentSettings` (4th arg) is only passed by ONE of five callers** — `TournamentHomeContent.tsx:64`.
  The other four pass only `config` (= `division.playoffConfig`):
  `public-tournament-data.ts:141`, `app/results/page.tsx:70`, the admin preview page
  (`app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx:78`), and
  `advancePlayoffs` (`lib/db.ts:1950`). **Implication:** tournament-level values only
  reach getStandings where the arg is passed. `config` (`division.playoffConfig`) reaches
  it everywhere → it is the reliable carrier.
- **No DB migration needed.** Tournament settings live in `tournaments.settings` (JSONB);
  per-division config lives in `divisions.playoff_config` (JSONB). New keys only.
- **League / house-league standings are a SEPARATE function** (`computeStandings`,
  `lib/db.ts:3560-3599`) — out of scope, must NOT change.
- **Type + label duplication:** the `TieBreaker` union and `breakerLabels` are defined
  twice (event settings page `:27,:29-34`; divisions page `:20,:254-259`) and validated in
  three places (event page `validBreakers :262`; divisions `normalizeTieBreakers :72-76`;
  API `TIE_BREAKER_VALID_VALUES`, `app/api/admin/tournaments/route.ts:560`).

## Data model (new JSONB keys — no migration)

```
tournaments.settings (JSONB) — TournamentSettings (lib/types.ts:59-81)
  + max_run_diff_per_game?: number | null   // tournament default cap; null/0/absent = no cap

divisions.playoff_config (JSONB) — PlayoffConfig (lib/types.ts:324-347)
  + tieBreakers: (...|'coin')[]              // 'coin' added to union
  + maxRunDiffPerGame?: number | null        // per-division override; resolves over tournament default
  + coinTossResults?: Record<string,string[]> // key = tied teamIds sorted joined '|'; value = admin order (teamIds)
```

- **Cap resolution** (in getStandings): `cap = config?.maxRunDiffPerGame ?? tournamentSettings?.max_run_diff_per_game ?? null`; active when `cap && cap > 0`.
- **Coin-toss key is self-invalidating:** keyed by the exact sorted set of tied teamIds.
  If scores change and the tied set changes, the old key no longer matches → the group
  re-flags as "needs coin toss." Clean staleness handling (documented, no audit table for v1).
- **Coin toss is terminal:** any breaker placed after `coin` is moot. UI will pin Coin
  Toss to the end of the list when present (can't be reordered above other breakers).

## Threading decision (important)

To make the cap (and, as a beneficial side effect, tournament-level tie_breakers) apply
to **playoff seeding and all displays** — not just the public home — thread
`tournamentSettings` into the four callers that currently omit it. Division override keeps
priority, so any tournament that already set per-division tie_breakers is unchanged. Only
tournaments relying on a *tournament-level* tie_breaker order (different from the default)
with no per-division override will see corrected seeding — that is the intended/correct
behavior. **Flag in verification.** `advancePlayoffs` will fetch the tournament's settings
(it already has `game.tournamentId`).

## Work breakdown

### A. Shared tie-breaker module + editor component (de-dup, low risk)
- [ ] New `lib/tie-breakers.ts`: export `TieBreaker` union (incl `'coin'`),
      `BREAKER_LABELS`, `DEFAULT_TIE_BREAKERS`, `ALL_TIE_BREAKERS`, and helpers
      `normalizeTieBreakers()`, `clampRunDiffCap()`. Import into both config pages + API.
- [ ] New `components/admin/TieBreakerEditor.tsx`: a reusable **drag-and-drop** active
      list (mirror the @dnd-kit pattern in `components/coaches/RosterEditor.tsx:162-241` —
      `DndContext`+`SortableContext`+`verticalListSortingStrategy`+`useSortable`+`arrayMove`,
      `GripVertical` handle, `PointerSensor{distance:6}`+`KeyboardSensor`). Props:
      `value: TieBreaker[]`, `onChange`, plus the run-diff cap input. Features:
      reorder by drag; **✕ remove** per active row (guard ≥1 remaining); **"+ Add"** chips
      for inactive breakers (incl Coin Toss); inline hint when Coin Toss is present but not
      last ("Coin Toss is final — rules below it are skipped"). Used by BOTH the Event
      Settings page and the per-division editor → removes the existing duplicated
      up/down-button list + `moveTieBreaker`/`moveBreaker`/`breakerLabels` copies.

### B. Types (`lib/types.ts`)
- [ ] Extend `tie_breakers` union → add `'coin'` (`:72`); add `max_run_diff_per_game?: number | null` to `TournamentSettings`.
- [ ] `PlayoffConfig` (`:324-347`): add `'coin'` to `tieBreakers` union; add `maxRunDiffPerGame?: number | null`; add `coinTossResults?: Record<string,string[]>`.

### C. Standings engine (`lib/db.ts` getStandings)
- [ ] Per-game loop: also accumulate `cappedRd += clamp(tScore - oScore, ±cap)` when cap active; else `cappedRd = rf - ra`. Set returned `rd = cappedRd`. Keep `rf`/`ra` raw. Return `rdRaw = rf - ra` too (for any consumer/debug + display note).
- [ ] `breakTies`: handle `breaker === 'coin'` — look up `config.coinTossResults[key]`; if present & covers the exact tied set, order by it; else set `needsCoinToss = true` on each tied team and return stable order. `'rd'` breaker already sorts by `rd` (now capped) — no change beyond using capped value.
- [ ] Resolve `cap` from config → tournamentSettings; resolve `coinTossResults` from `config`.
- [ ] Return `needsCoinToss` + `coinTossGroupKey` on flagged rows.

### D. Thread `tournamentSettings` into remaining getStandings callers
- [ ] `advancePlayoffs` (`lib/db.ts:1950`) — fetch + pass tournament settings (seeding correctness).
- [ ] `public-tournament-data.ts:141`, `app/results/page.tsx:70`, admin preview page `:78` — pass settings.

### E. Tournament-wide config UI — Event Settings page
  (`app/[orgSlug]/admin/tournaments/settings/event/page.tsx`)
- [ ] Replace the up/down-button list (`:1069-1093`) + `moveTieBreaker` (`:565-573`) with
      `<TieBreakerEditor>` (drag-and-drop, add/remove, incl Coin Toss + cap input).
- [ ] Allow the active list to be a **subset** (add/remove) — load/parse keeps stored order,
      no longer force-fills to all 4 (`:259-266`); guard ≥1 on save.
- [ ] Load/parse, saved-state snapshot, and patch-settings payload (`:447-448`) include `max_run_diff_per_game`.

### F. Per-division override UI — Divisions page
  (`app/[orgSlug]/admin/tournaments/divisions/page.tsx`)
- [ ] Replace the per-division up/down list (`:669-690`) + `moveBreaker` (`:261-270`) with the
      same `<TieBreakerEditor>`; update `normalizeTieBreakers :72-76` (allow `'coin'`, allow subset).
- [ ] Per-division **Max run diff per game** rides inside `<TieBreakerEditor>`; load (`:147`) +
      save (`:205-208`) `playoffConfig.maxRunDiffPerGame`.

### G. API validation + persistence
- [ ] `app/api/admin/tournaments/route.ts`: whitelist `max_run_diff_per_game` (`:523-553`); add `'coin'` to `TIE_BREAKER_VALID_VALUES` (`:560`); validate cap as int 0–99.
- [ ] `app/api/admin/divisions/route.ts`: ensure `playoff_config.maxRunDiffPerGame` + `'coin'` persist on save/update (`:171-189`, `:225-242`).
- [ ] **New action `record-coin-toss`** on `/api/admin/divisions` (read-merge-write `playoff_config.coinTossResults`, like the tournaments settings patch pattern `:645-649`). Body: `{ action:'record-coin-toss', id, groupKey, orderedTeamIds }`. Validate teamIds belong to the division.

### H. getDivisions mapping (`lib/db.ts:1146-1180`)
- [ ] Verify/ensure `playoff_config` round-trips `maxRunDiffPerGame` + `coinTossResults` (it spreads playoff_config; confirm no field whitelist drops them).

### I. Coin-toss recorder UI (admin) — BOTH surfaces (confirmed)
- [ ] `components/public/StandingsContent.tsx`: accept optional admin props (`adminCoinToss?: { onRecord(groupKey, orderedTeamIds) }`). When a `needsCoinToss` group exists AND admin prop present, render a "⚠ Coin toss required — Record winner" control (picker for 2-team, drag/select order for 3+). Public render unchanged (prop absent).
- [ ] Wire it in the **admin preview Standings** section (the existing admin surface that renders StandingsContent per division). Save → `record-coin-toss` action → refetch.
- [ ] **Dashboard nudge card:** surface "Coin toss needed in {division}" on the tournament dashboard (mirror the existing worklist/action-card pattern); links to the standings recorder (or opens the same picker modal). Clears once recorded.

### J. Display surfaces (read-only)
- [ ] `StandingsContent.tsx` tie-breaker note (`:508-510`): map `'coin'` → "Coin Toss"; when cap active, add "Run diff capped at ±N/game" note.
- [ ] `app/results/page.tsx:140`: include `'coin'` in the order string.
- [ ] `RaceToPlayoffsView.tsx`, team-profile (`app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx` + `app/api/public/team-profile/route.ts`): confirm RD they show comes from the capped value or is consistent; add cap note if they display RD prominently. **team-profile API computes its own standings (`:55-141`)** — apply the same cap there, or have it reuse getStandings.
- [ ] Defaults in seeds/wizard: `PlayoffWizard.tsx:60` default tieBreakers — leave as-is (no coin by default).

### K. Tests
- [ ] Extend/add unit tests for getStandings: capped RD per game (14-0 cap 7 → rd +7, rf 14, ra 0); coin-toss ordering applied when result present; `needsCoinToss` flag when absent; coin terminal behavior; cap resolution config-over-tournament; league `computeStandings` untouched.

### L. Docs
- [ ] `docs/agents/db/DATA_DICTIONARY.md`: document new JSONB keys (`tournaments.settings.max_run_diff_per_game`, `divisions.playoff_config.maxRunDiffPerGame`, `.coinTossResults`, `'coin'` breaker value). No snapshot refresh (no column change).
- [ ] Update this plan + PM brief on completion; move to `archive/` when verified.
- [ ] `TODO.md` line + completion move.

## Risks / watch-items
- **Seeding behavior change** from threading tournamentSettings — verify existing live tournaments unaffected (division overrides keep priority; default order unchanged).
- **RF − RA ≠ RD when cap active** — intended; must be explained in the UI note so organizers/teams aren't confused.
- **Coin toss for 3+ tied teams** — record a full order, not just a single winner; key by the whole set.
- **Coin toss + H2H interaction** — H2H is auto-skipped for 3+ tied teams already (`:1657`); coin handles the residual.
- **Keep StandingsContent public render pixel-identical** when admin prop absent (token guardrail + design parity).
- **No new plan gate** — coin toss + cap ride at the same tier as existing tie-breaker config.

## Build status — BUILT 2026-06-10 on `feat/free-tier-coaches` (dev only)

All work items A–L implemented. `npm run typecheck` clean; **185 unit tests pass** (23 in
`tests/unit/tie-breakers.test.ts`); lint/`check:dictionary`/`check:tokens` green. No DB
migration (JSONB keys only). Engine extracted to a pure, unit-testable
`computeTournamentStandings` in `lib/tie-breakers.ts` (re-exported from `lib/db.ts`).

**Latent bug fixed (required by coin toss):** an *indecisive* head-to-head used to freeze
the order and never fall through to the next breaker — so coin (or rd/rf/ra) after an
indecisive H2H never ran. Now H2H always either decisively orders a pair or recurses to the
next breaker. Strictly more correct; flag in browser QA.

### Adversarial review (4-dimension fan-out + per-finding verify) — folded
6 findings confirmed and resolved:
1. **(blocker) TS2367** — the H2H fallthrough narrowed `breaker`, making a later
   `breaker === 'h2h'` compare have no overlap → build failed type check. (My interim
   `typecheck` ran *before* that edit.) Fixed: grouping ternary now only handles rf/ra/rd.
2. **(med) Coin-toss clear path** lacked the division-team validation the record path has →
   now both paths validate the `groupKey`'s teams belong to the division.
3. **(med) Hardcoded `['h2h','rd','rf','ra']`** display fallback → now `DEFAULT_TIE_BREAKERS`
   in StandingsContent + results page.
4. **(low) Tests** lacked 3+-team coin scenarios → added (flag-all, recorded 3-order, partial-separation).
5. **(low) `update` action overwrote `playoff_config` wholesale** → record-coin-toss-then-edit
   could clobber `coinTossResults`. Fixed: server-side defensive merge that always preserves
   `coinTossResults` from the DB (the form never owns it).
6. **(low, by-design — acknowledged)** Removing `coin` at the tournament level does NOT
   retro-clear a division's own override (division override wins, as documented). Acceptable
   for v1; a future "sync division overrides" affordance could help. No code change.

## Verification (owner does browser testing)
- Tie-breaker list shows Coin Toss (tournament + per division); cap input saves/reloads.
- Two teams tied → standings flag "coin toss required" (admin) → record winner → order updates + persists → playoff seed reflects it.
- 14-0 game with cap 7 → RD shows +7/−7, RF/RA show 14/0; cap note visible.
- Public standings unchanged for non-admins; league standings unchanged.
