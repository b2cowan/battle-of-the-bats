# Dashboard Game-Status Sections (Now Playing / Up Next / Needs a Score) — Implementation Plan

> **Status:** Planning
> **Created:** 2026-07-04
> **Branch:** dev
> **Migration:** none (all fields already exist: `games.status`, `game_date`, `game_time`, `duration_minutes`)
> **Gating:** none — the tournament admin dashboard is available to every tier that has tournaments (Tournament / Tournament Plus / League / Club). No plan-gated behaviour.

## Goal

Split the tournament admin dashboard's single "Now Playing" board into three honest, mutually-exclusive game-status sections so an organizer always sees the true state of their event and **no game that needs attention is ever hidden**:

1. **Now Playing** — games genuinely on a field right now (already built in the preceding bug-fix).
2. **Up Next** — the next scheduled games that have not started yet.
3. **Needs a Score** — games whose time window has passed but still have no score (the games the old code wrongly kept labelling LIVE forever).

The three buckets are derived from a **single shared classification helper** that the Schedule screen's game rows also use, so the dashboard and the Schedule can never disagree about what's live / next / overdue.

## Background — what already shipped (dev, unpushed)

A preceding bug-fix corrected the existing "Now Playing" panel:

- **Timezone fix.** The API was computing "today"/"now" in **UTC**, so in the morning (Eastern) games that hadn't started showed as LIVE. Now uses a new `tournamentNow()` helper in `lib/timezone.ts` (companion to the existing `tournamentToday()`), returning tournament-local (`America/Toronto`) `{ date, time }`.
- **End-of-window bound.** "Now Playing" now includes a game only if it is being scored (`status === 'submitted'`) **or** scheduled and inside its play window (`start ≤ now < start + duration`, today), using per-game `duration_minutes` with a fallback to `tSettings.game_duration_minutes` (default 60 min). A small `clockToMinutes()` helper and a `defaultDurationMin` were added to the API route.

Source of truth for the current logic:
- API: `app/api/admin/tournament-dashboard/route.ts` — the `allLiveGames` filter → `liveGames` / `liveGamesTotal`, assembled into the `gameDay` object (~line 353).
- Panel: `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` — `renderNowPlayingPanel()` (~line 1453), the `GameDayPanelId` union (~line 204), `DEFAULT_LAYOUT.gameDayPanels` (~line 231), `gameDayPanelNode()` switch (~line 1628), and the data-driven customize UI (`sortedGameDayPanels`, ~line 940 / ~1665).

The **downside of the bug-fix alone**: past-window unscored games and not-yet-started games simply disappear from the board. This plan restores them as their own clearly-labelled sections rather than mislabelling them as LIVE.

## Bucket definitions (canonical)

For each non-cancelled game, in tournament-local time:

| Bucket | Rule |
|---|---|
| **Now Playing** | `status === 'submitted'` (being scored) **OR** (`status === 'scheduled'` AND `start ≤ now < start + duration`) |
| **Up Next** | `status === 'scheduled'` AND `now < start` AND game is **today** (tournament-local), earliest first |
| **Needs a Score** | `status === 'scheduled'` AND `now ≥ start + duration` (window fully elapsed), any day — today's finished-but-unscored games **and** prior days' never-scored games |
| *(not shown)* | future games on a later day (not yet "Up Next" today), completed/forfeit games, cancelled games |

Notes:
- These are **mutually exclusive** for scheduled games; `submitted` always sorts into Now Playing.
- "Needs a Score" is the safety net: it deliberately has **no upper time bound and no today-only restriction** so a game that was never scored days ago still surfaces. This is the "nothing hidden" guarantee.
- "Up Next" is **today-only** by default so a mid-tournament lull doesn't surface next week's games. (See Open Questions for the "no games left today" edge.)

## Architectural Decisions

- **Decision:** Extract a shared, shape-agnostic window classifier into `lib/game-live-state.ts`. **Rationale:** The Schedule screen (`GameList.tsx`) already computes `LiveState = 'live' | 'overdue' | 'next'` with the same start/end/duration math (`parseGameStart` + `resolveGameTiming`). Two independent copies of "is this game live?" will drift. A shared helper is the single definition both surfaces call.
- **Decision:** The shared helper takes **millisecond timestamps** (`startMs`, `durationMinutes`, `nowMs`) and returns a per-game window state; each caller does its own local-time conversion and its own "pick the next one" selection. **Rationale:** The two callers acquire time differently (Schedule uses the browser clock + local parse; the API uses `zonedWallClockToUtc()` / `tournamentNow()`), and "Up Next" is a *selection across the set*, not a per-game property. Keeping the shared primitive to the pure window test avoids forcing one caller's time model onto the other.
- **Decision:** The dashboard API should convert `game_date + game_time` to a real UTC instant via the existing `zonedWallClockToUtc()` (already in `lib/timezone.ts`) and compare against `Date.now()` in the shared helper. **Rationale:** DST-correct, handles games that cross midnight, and removes the same-day-string limitation of the current minutes-of-day comparison.
- **Decision:** All three buckets are computed in **one O(n) pass** over the already-loaded `activeGames` (the API already does `select('*')`). **Rationale:** The dashboard polls every ~30s; no new query, negligible cost.
- **Decision:** Add `upNext` and `needsScore` as **first-class entries in the customizable game-day panel registry** (union + `DEFAULT_LAYOUT.gameDayPanels` + switch), not hardcoded panels. **Rationale:** The board is user-customizable (show/hide/reorder, per-browser localStorage); new panels must participate.
- **Decision:** Bump the saved-layout `version` (2 → 3) and migrate existing saved layouts to **insert `upNext` and `needsScore` immediately after `nowPlaying`** with a clean re-number. **Rationale:** `loadLayout`'s `mergeBy` overlays *saved* order onto defaults, so simply appending new default ids at order 1/2 would collide with existing customizers' saved orders (their `gamesProgress`/`checkIn` are already 1/2). A one-time migration gives everyone a sensible default position while preserving their prior show/hide choices.
- **Decision:** Keep the existing Now Playing **"+N more → Results"** overflow tile for genuinely-live overflow only; "Needs a Score" is a *separate* panel, not the overflow target. **Rationale:** Overflow of live games and the "unscored backlog" are different ideas; conflating them is what produced the original confusion.

## Phases

Each phase is independently shippable. Phase 1 is API-additive (old client ignores the new fields); Phases 2–3 add one panel each; Phase 4 is a pure refactor.

### Phase 1 — Shared classifier + API buckets (data only, no UI)
- [ ] Create `lib/game-live-state.ts`: `export type ScheduledWindowState = 'live' | 'overdue' | 'future'` and `scheduledWindowState(startMs, durationMinutes, nowMs): ScheduledWindowState` (NaN/untimed `start` → `'future'`, i.e. treated as not-started/safe). Add a short unit-style doc comment tying it to the bucket table above.
- [ ] In `app/api/admin/tournament-dashboard/route.ts`, resolve each scheduled game's start instant via `zonedWallClockToUtc(g.game_date, g.game_time)` → ms, duration via `g.duration_minutes ?? defaultDurationMin`, and classify with `scheduledWindowState(...)` against `Date.now()`.
- [ ] Re-express the existing `allLiveGames`/`liveGames` in terms of the classifier (`submitted` OR `'live'`) — behaviour-preserving vs the just-shipped fix, but now via the shared helper.
- [ ] Add `upNextGames` (`'future'` AND today, ascending, capped at 8) + `upNextTotal`, and `needsScoreGames` (`'overdue'`, oldest-first, capped at 8) + `needsScoreTotal` to the `gameDay` object.
- [ ] Extract a single `toGameStat(g)` mapper (reuse the current `liveGames.map` shape — `LiveGameStat`) for all three arrays to avoid duplication.
- [ ] `npm run typecheck` (shared module `lib/timezone.ts`/new `lib/game-live-state.ts` + API contract).

### Phase 2 — "Up Next" panel + registry plumbing for both new panels
- [ ] Extend `GameDayStats` (in `page.tsx`) with `upNextGames`, `upNextTotal`, `needsScoreGames`, `needsScoreTotal`; extend `EMPTY_GAME_DAY`.
- [ ] Add `'upNext'` and `'needsScore'` to the `GameDayPanelId` union.
- [ ] Add both to `DEFAULT_LAYOUT.gameDayPanels` in order: `nowPlaying`(0), `upNext`(1), `needsScore`(2), `gamesProgress`(3), `checkIn`(4), `gdScheduleHealth`(5), `byDivision`(6).
- [ ] Bump `DashboardLayout.version` to 3; in `loadLayout`, migrate v1/v2 → v3 by inserting `upNext`/`needsScore` right after `nowPlaying` and renumbering, preserving each existing panel's `visible` flag.
- [ ] Implement `renderUpNextPanel()` — hidden (`return null`) when `upNextGames.length === 0`; header "Up Next" with a **"View schedule →"** link to `${base}/schedule`; compact list reusing the live-strip styling (team matchup + start time + location/division; no score); "+N more → Schedule" when `upNextTotal` exceeds shown.
- [ ] Wire `case 'upNext':` in `gameDayPanelNode()`.
- [ ] `renderNeedsScorePanel` not yet implemented → `gameDayPanelNode('needsScore')` falls through to `default: return null` (harmless; panel is registered but renders nothing until Phase 3).
- [ ] Focused lint + typecheck.

### Phase 3 — "Needs a Score" panel
- [ ] Implement `renderNeedsScorePanel()` — hidden (`return null`) when `needsScoreGames.length === 0`; header "Needs a Score" (⚠/warning accent) with **"Enter scores →"** link to `${base}/results`; list of overdue games (matchup + scheduled time + location/division); "+N more → Results" overflow.
- [ ] Wire `case 'needsScore':` in `gameDayPanelNode()`.
- [ ] Confirm the Now Playing "+N more" tile still overflows **live** games only (unchanged); no double-counting between panels.
- [ ] Focused lint + typecheck.

### Phase 4 — Fold Schedule (`GameList.tsx`) onto the shared classifier (drift-prevention)
- [ ] Refactor `GameList.tsx` `liveStates` memo to call `scheduledWindowState(...)` for the per-game `live`/`overdue` decision (keeping its existing local `parseGameStart`/`resolveGameTiming` inputs and its own "earliest future today = `next`" selection). Pure refactor — no visible behaviour change.
- [ ] Verify Schedule row badges (NOW / NEXT / overdue) still match before/after on a seeded game day.
- [ ] `npm run typecheck`.

## Empty states (summary)
- **Now Playing** — hidden when nothing live (unchanged).
- **Up Next** — hidden when no not-yet-started games remain today (naturally hidden before game day and after the last game starts).
- **Needs a Score** — hidden when zero overdue-unscored games. (Optional future nicety: a positive "All games scored ✓" confirmation on game day — deferred; not required for the "nothing hidden" goal.)

## Caps + overflow (summary)
- **Now Playing** — existing measured one-row fit + "+N more → Results".
- **Up Next** — API loads up to 8; panel shows a sensible few; "+N more → Schedule".
- **Needs a Score** — API loads up to 8; "+N more → Results".

## Open Questions
- [ ] **Up Next when nothing is left today.** Default = show nothing (panel hidden). Alternative = fall back to the next scheduled day's first games (labelled with the date). Recommend shipping today-only first; revisit if organizers ask.
- [ ] **"Up Next" horizon.** Show the next *slot/round* only, or a flat next-N regardless of round? Recommend flat next-N (simpler, matches "next few games scheduled"); cap N (default 6 shown).
- [ ] **Needs a Score styling weight.** Confirm whether this should read as a gentle nudge (neutral) or an alert (warning accent). Recommend warning accent since it is an action bucket.

## Verification checklist (per phase, before owner hand-off)
- [ ] `npm run typecheck` (Phases 1 & 4 touch shared modules / API contract).
- [ ] `npm run lint:focused -- <changed files>` (Phases 2 & 3).
- [ ] Dev-server **restart** before browser test (Phase 1 adds a shared module `lib/game-live-state.ts`; Phase 4 edits a shared component) — per the restart rule for new/shared modules.
- [ ] Offer `/review` on the API + classifier changes (Phase 1) and `/docs` if any organizer-facing terminology needs a help-content note.
