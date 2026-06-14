# Schedule Health Rules — Implementation Plan

> Status: **BUILT 2026-06-12 on `feat/free-tier-coaches` (== dev), uncommitted — awaiting browser verification.** No migration (tournament `settings` JSONB). typecheck clean · eslint 0 errors · schedule-metrics unit tests 7/7 · dev server restarted (login 200, no EACCES).
> PM brief: `SCHEDULE_HEALTH_RULES_PM_BRIEF.md`

## Problem

The Schedule Health panel rates schedules against hardcoded thresholds:
- "Heavy same-day loads" fires when a team plays **more than 2** games in a day (`DEFAULT_MAX_GAMES_PER_DAY = 2`).
- "Back-to-back" fires when a team's consecutive games are **≤ 15 min** apart (the venue `buffer_minutes`, default 15).
- No game-count target is rated by default.

These thresholds are invisible and unchangeable. Different events have legitimately different norms (a one-day 8-team blitz vs a 3-day league-style event). Organizers asked to define "healthy" themselves, edited **from the panel** so the rating reacts live.

## Decisions (ruled with owner)

1. **Persisted, per tournament** — stored in `tournaments.settings` JSONB under `schedule_health_rules`. Edited inline from the panel with a live preview; Save persists. Not an ephemeral sandbox.
2. **Scope = tournament-level for v1.** Per-division override is a fast-follow.
3. **Generator-unified** — the saved `maxGamesPerDay` seeds the auto-Generator's default. Only `maxGamesPerDay` is unified (same semantics in both); the Generator's `minRestMinutes` is a *target* (default 60), conceptually different from the health back-to-back *threshold* (default 15), so it is **not** force-mapped.

## Exposed levers (v1)

| Rule | Default | Drives |
|---|---|---|
| `maxGamesPerDay` | 2 | "Heavy same-day loads" issue + `dayLoad` score + MAX/DAY KPI tone |
| `minRestMinutes` | 15 | "Back-to-back" issue + `rest` score |
| `targetGamesPerTeam` | null (no target) | under/over-target issues + `gameBalance` score |

Travel buffers already configurable elsewhere — left as-is. "Ideal start window" (early/late cutoffs) deferred.

## Data model

`lib/types.ts`:
```ts
export interface ScheduleHealthRules {
  maxGamesPerDay?: number;        // flag a team with more than this on one day (default 2)
  minRestMinutes?: number;        // consecutive games closer than this = back-to-back (default 15)
  targetGamesPerTeam?: number | null; // teams under/over flagged; null = no target
}
// TournamentSettings.schedule_health_rules?: ScheduleHealthRules
```

## Engine (`lib/schedule-metrics.ts`)

- `export function getScheduleHealthRules(tournament): { maxGamesPerDay; minRestMinutes; targetGamesPerTeam }` — pure read of `settings.schedule_health_rules` with hard defaults (used by the panel editor for initial values).
- Inside `buildScheduleMetrics`, resolve effective thresholds with **option precedence** (backward compatible):
  - `maxGamesPerDay = options.maxGamesPerDay ?? saved.maxGamesPerDay`
  - back-to-back threshold `= options.minRestMinutes ?? options.bufferMinutes ?? saved.minRestMinutes` (so the Generator/dashboard that pass `bufferMinutes` keep current behavior unless a rule is set)
  - `expectedGamesPerParticipant = options.expectedGamesPerParticipant ?? saved.targetGamesPerTeam`
- Add `minRestMinutes?` to `BuildScheduleMetricsOptions`; pass the resolved back-to-back threshold into `buildTeamMetrics` (replacing the internal `bufferMinutes` fallback).
- Add `maxGamesPerDay` (and `minRestThresholdMinutes`) to the `ScheduleMetrics` interface so the panel can read them for the KPI tone.

## Persistence (`app/api/admin/tournaments/route.ts`, `patch-settings`)

- Add `schedule_health_rules` to `ALLOWED_SETTINGS_KEYS`.
- Sanitizer: object only; `maxGamesPerDay` int 1–10; `minRestMinutes` int 0–600; `targetGamesPerTeam` null or int 1–99. `null` clears.

## Dashboard (`app/api/admin/tournament-dashboard/route.ts` + `dashboard/page.tsx`)

- Route: pass `maxGamesPerDay`/`minRestMinutes`/`expectedGamesPerParticipant` from saved rules into `buildScheduleMetrics`; add `maxGamesPerDay: scheduleMetrics.maxGamesPerDay` to the `scheduleHealth` stats.
- Page: add `maxGamesPerDay` to `ScheduleHealthDashboardStats` + `EMPTY_STATS`; change the MAX/DAY mini-card tone from `> 2` to `> (health.maxGamesPerDay ?? 2)`.

## UI (`ScheduleHealthPanel.tsx` + `schedule/page.tsx`)

- Panel gains optional props: `rules`, `defaultRules`, `dirty`, `saving`, `canEditRules`, `onRuleChange`, `onSaveRules`, `onResetRules`, `onRestoreDefaults`. Gear button in the summary header toggles an inline editor (3 number inputs + Save / Discard / Restore defaults). Optional props → other callers unaffected.
- MAX/DAY KPI tone: `metrics.maxGamesInDay > metrics.maxGamesPerDay`.
- Page: `healthRules` draft state + `savedHealthRules` baseline (seeded via `getScheduleHealthRules`, re-seeded on tournament change). `savedScheduleMetrics` passes the draft rules → live preview. Save → POST `patch-settings` → update baseline. `isLocked` hides editing.

## Generator (`Generator.tsx`)

- Initialize `priorities.maxGamesPerDay` from `tournament.settings.schedule_health_rules.maxGamesPerDay`; start `selectedPresetId` at `'custom'` when it diverges from the Balanced default.

## Out of scope / fast-follow

- Per-division rule overrides.
- "Ideal start window" (early/late) lever.
- Surfacing travel buffers inside the same editor.
