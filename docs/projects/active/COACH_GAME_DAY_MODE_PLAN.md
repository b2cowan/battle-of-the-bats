# Coach Game-Day Mode — Implementation Plan

**Status:** ✅ **P1 BUILT on dev 2026-08-04, UNCOMMITTED** — owner QA = `OWNER_QA_LEDGER.md`
§1.15. Mockups rev 3 signed off same day (rev 2 added the scouting-handoff frames; rev 3
applied the playing-time vocabulary ruling — "Playing time — season report", never "Is playing
time fair?"). Built exactly per `COACH_GAME_DAY_MODE_P1_BUILD_PROMPT.md`: P1 scope + the
Opponent Scouting Book handoff rider; no migration; console route on the LIVE rail
(`resolveLiveCoachTeamContext`), joining neither archive allow-list. §3.4's quiet flag +
server-side result derivation landed on the existing events PATCH. P2 (moments) and P3
(playing-time polish — renamed from "fairness polish" per the 2026-08-04 vocabulary ruling)
remain unbuilt.
**Date:** 2026-08-03 (proposed) · 2026-08-04 (approved)
**Tier:** Premium coaches portal only (`rep_*` workspace teams — Basic teams have no scores/lineups/attendance by construction)
**PM brief:** `COACH_GAME_DAY_MODE_PM_BRIEF.md`
**Mockup:** Claude Artifact "Game-Day Mode — bench console" (see PM brief)

---

## 1. What this is

A phone-first bench console a head coach opens at the field for a game: tonight's lineup with a
live period cursor, tap-to-substitute, running score, one-tap attendance corrections, and an
end-of-game wrap-up that finalizes the score and notifies families once. It is the game-side
sibling of the practice **run** screen (`practice/[eventId]/run`), and it deliberately reuses that
screen's chrome, clock idioms, and "who drives" rules.

### The central design decision — reckoning with D4

D4 ("nothing is written at the field", `COACH_PRACTICE_PLANS_PLAN.md` decision table) killed live
writes on the practice run screen because a second, half-finished record of "what we did" poisons
every downstream coverage surface. Game-Day Mode does **not** reopen D4 by adding a parallel live
log. Instead:

> **The saved lineup grid IS the playing-time record today** (`rep_team_lineup_entries.inning_positions`,
> consumed by `lib/lineup-analysis.ts` → season analytics → playing-time report → player recaps).
> Game-Day Mode is a *live editor of that same grid*, plus the two writes D4 already concedes
> coaches reliably finish: **attendance** and **the score**.

Consequences:
- **No new playing-time table. No shift log.** A substitution at the bench edits
  `inning_positions` for the affected periods of the one lineup row that already exists. A coach
  who never opens Game-Day Mode produces exactly the data they produce today; a coach who does
  produces the same *shape* of data, just more accurate. Nothing downstream changes or bifurcates.
- **Abandonment is harmless.** If the coach stops tapping in the 4th period, the grid simply
  retains the pre-game plan for the rest — indistinguishable from today's behavior, poisoning
  nothing. This is the property D4 exists to protect, achieved by construction rather than by
  prohibition.
- The practice-run bans stay: **no swipe/drag/long-press, no sound/vibration, no auto-advance.**
  (Wake-lock is an owner question — see §9.)

---

## 2. Existing foundations (verified 2026-08-03)

| Piece | Where | Reuse |
|---|---|---|
| Practice run screen | `app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/run/page.tsx` + `lib/rep-practice-plan.ts` | Chrome, ≥56px touch targets, `sessionStorage` UI prefs, `canAdvance` "who drives" pattern, attendance `<details>` fold |
| Lineup builder + API | `lineups/[eventId]` + `events/[eventId]/lineup` route (GET/PUT full replace) | The grid, `VALID_POSITIONS`, 0.9s debounced auto-save + aria-live "Saved" pill + undo stack |
| Playing-time derivation | `lib/lineup-analysis.ts`, `lib/lineup-season-analytics.ts`, `lib/team-season-analytics.ts` | Untouched — keeps consuming the same grid; live arm-care/bench warnings call `analyzeLineup` client-side |
| Events model | `rep_team_events` — `opponent`, `home_away`, `arrival_time`, `field_number`, `uniform`, `team_score`/`opponent_score` (team-relative, mig 158), `result`, `status ∈ scheduled\|cancelled` | Header card; score writes land here. **No new status value** — "live" is a time window, never a stored state (sandbox precedent) |
| Attendance | `rep_team_event_attendance` (`unknown\|attending\|absent\|late`), batch PATCH | One-tap corrections reuse the schedule tab's `ATTENDANCE_OPTIONS` vocabulary verbatim |
| Sport Pack | `lib/sports.ts` — `periodLabel`/`periodLabelPlural`/`defaultPeriodCount`, `positions`, `pitcherPosition`, `startVerb` | All vocabulary. No clock primitive exists; the console's period cursor is coach-advanced, not clocked |
| Mirrored tournament games | `source_tournament_game_id` — organizer owns score/result/opponent/time; coach PATCH of those fields → 409 | Console renders organizer-owned fields read-only with a "scored by the tournament" note |
| Capabilities | `lib/coach-capabilities.ts` — `attendance`, `lineups`, `scheduleManage`; head coach = full; Helper preset = schedule-only | See §6 |

---

## 3. UX specification

### 3.1 Entry points ("live" = time window, not status)

- **Schedule page + lineups hub:** game rows (`GAME_EVENT_TYPES`) grow a `Game day` action when
  `now ∈ [min(arrival_time, starts_at − 2h), (ends_at ?? starts_at + 4h) + 3h]` and the event is
  not cancelled. Outside the window the action is absent (not disabled).
- **Masthead:** on a game day, the existing masthead status line links to the console.
- Deep link: `/{orgSlug}/coaches/teams/{teamId}/game/{eventId}`. Visiting outside the window
  shows the same screen in review mode (§3.6) rather than 404ing.

### 3.2 Screen anatomy (one screen, three zones)

1. **Header strip (sticky):** opponent + home/away, field/uniform/arrival chips (Tier-2 fields),
   score `US 4 — 2 THEM` in `--font-data`, period cursor chip ("Inning 3 of 7" via Sport Pack
   vocabulary). Tap score → score sheet (§3.4). Tap period chip → advance/back controls, mirroring
   the practice run's two big buttons (`Back` / `Next inning`). Period cursor is **client-side
   only** (sessionStorage, like the practice station pick) — it drives which grid column the
   console highlights; it is never persisted server-side.
2. **The bench board (main zone):** the roster as large rows grouped **On field / Bench** for the
   current period, driven by the lineup grid column. Each row: jersey number, name, position chip
   for this period, and (from `analyzeLineup`, computed client-side on every edit) the two
   fairness cues that already exist in the report: consecutive-bench warning and pitcher-cap
   warning (`pitcherPosition` teams only). Tap a bench player → tap an on-field player (or empty
   position) to swap **from the current period onward** (remaining columns of the grid, matching
   how coaches think: "Maya goes in for Ava now"). A second tap path `This period only` covers
   one-off swaps. Every edit auto-saves the lineup via the existing PUT (0.9s debounce, same
   "Saving…/Saved/Couldn't save · Retry" pill, same undo stack).
3. **Footer (sticky, safe-area-aware `.stickyActionBar`):** `Who's here` (opens attendance sheet,
   §3.5), `Note` (phase 2, §3.7), `End game` (§3.6).

No-lineup fallback: if the game has no saved lineup, the board offers `Start from template` /
`Everyone plays` (auto-fill) / `Skip lineup — just score & attendance`, so the console never
dead-ends. The third option runs the console in score+attendance-only shape.

### 3.3 Live substitution rules

- Edits write the same `inning_positions` jsonb the builder writes; `VALID_POSITIONS` unchanged.
- Past periods are editable via the grid peek (a collapsed `Full grid` fold showing the familiar
  builder table) for corrections, but the primary tap flow only touches current-onward — keeps
  the field-time interaction to one decision.
- Batting order is **not** re-editable in the console v1 (it's set pre-game; mid-game order edits
  are rare and the builder is one tap away). `lineup_mode`/`inning_count` likewise builder-only.

### 3.4 Score

- Score sheet: big `+1` per side (long side buttons, whole-column tap targets), minus-correction,
  and direct numeric entry. Sport-neutral: increments by 1 `score.unit`; no per-period score
  breakdown stored in v1 (no schema for it; candidate for later, see §9).
- Writes: PATCH to the existing events route **with a new `quiet: true` body flag** — during the
  live window the console saves score debounced (10s) with family notifications suppressed;
  `notifyFamiliesOfGameUpdate` currently fires whenever a score value change lands, which would
  spam families a notification per run scored. The quiet flag is only honored for score fields
  and only within the live window (server-checked), so it cannot become a general
  notification-bypass. Final notification fires once at End game.
- Mirrored tournament games: score zone is read-only ("Scored by the tournament — standings update
  automatically"), because the organizer owns those fields (409 contract). Everything else
  (subs, attendance, notes) still works — the coach-owned field set is unchanged.
- `result` derivation moves server-side on the finalize call (§3.6) — fixes the existing gap where
  API-set scores leave `result` NULL (client-only derivation in `schedule/page.tsx` today).

### 3.5 Attendance corrections

The `Who's here` sheet reuses the schedule tab's per-player status rows (`ATTENDANCE_OPTIONS`
icons + `ATTENDANCE_WORD` labels, identical vocabulary — a hard requirement, they must never
drift) with one-tap toggles and the existing batch PATCH. Pre-game it's "mark the car ride
no-shows"; this is the one write D4 explicitly blesses. A player marked `absent` while on the
board triggers the same swap flow ("Ava is out — who covers CF?").

### 3.6 End game & review mode

- `End game` → confirm sheet: final score (editable), derived result badge, headline count of
  changes made tonight ("3 substitutions · attendance updated"). Confirm →
  - final score + server-derived `result` PATCHed (non-quiet → the one family notification),
  - console flips to **review mode**: same screen, read-only, with a `Playing time tonight`
    summary (per-player field/bench periods from `analyzeLineup`) and links to the playing-time
    report and (phase 2) the recap note composer.
- Nothing else is finalized — no status change on the event, no lock on the lineup (the builder
  stays editable afterwards exactly as today).
- Review mode is also what the deep link renders outside the live window, and what assistants
  without drive see during it.

### 3.7 Phase 2 — moments

A timestamped, append-only quick-note ("Maya's first triple", tagged optional player), stored in a
new small table (§4), surfaced in: the end-game wrap, the player recap composer (`roster/[playerId]/recap`
already exists), and season Wrapped. Explicitly optional flavor — never feeds analytics, so a
half-used log poisons nothing (the D4 test). Kept out of phase 1 to keep the field-time surface to
decisions a coach must make anyway.

---

## 4. Data model changes

Phase 1: **none.** Every phase-1 write lands in existing tables (`rep_team_lineups`,
`rep_team_lineup_entries`, `rep_team_event_attendance`, `rep_team_events.team_score/opponent_score/result`).
This is the point of the design.

Phase 2 (one migration + DATA_DICTIONARY + snapshot refresh, same unit of work):

```
rep_team_game_moments
  id uuid PK
  team_season_id / event_id FKs (event must be a game type)
  player_id FK nullable
  body text ≤280 (app-enforced)
  happened_at timestamptz default now()
  created_by uuid
  -- append-only: UPDATE disallowed at app layer; DELETE allowed (coach removes a mistake)
```

## 5. API surface

- `GET .../events/[eventId]/game-console` — one aggregated read (event, lineup+entries, roster,
  attendance, capabilities, isMirrored, sportPack-relevant vocab), mirroring the practice-plan
  read's shape. Season-scoped via `resolveCoachSeasonRead` **read path only**; this route does
  NOT join the archive allow-lists — Game-Day Mode is a live-season instrument (CLAUDE.md test
  #1: it runs a game → live-season-only). Archived seasons never show the entry point.
- Writes reuse existing routes: lineup PUT, attendance PATCH, events PATCH (+ `quiet` flag +
  server-side `result` derivation on finalize). Phase 2 adds `POST/GET/DELETE .../game-moments`.

## 6. Capabilities & who drives

- Console access: `attendance` OR `lineups` grant (each zone individually gated by its own
  capability — a lineup-less attendance helper gets score-view + attendance only).
- Score writes: `scheduleManage` (same field-ownership as the schedule score form today).
- **Drive:** subs/score/period cursor and End game belong to coaches whose grants include the
  respective capability; the Helper preset (schedule-only) gets a read-only console with the
  practice-run sentence pattern ("Your coach runs the bench."). No new capability key in v1;
  revisit only if owners ask for a dedicated game-day grant.

## 7. Build phases

- **P1 — Console core** (the feature): route + aggregated read, header/board/footer, live subs
  onto the lineup grid, score sheet + quiet writes, attendance sheet, end-game wrap + server
  result derivation, review mode, entry points (schedule/lineups/masthead), mirrored-game
  read-only contract, warm-theme + dark styling, mobile-first (900/640 system).
- **P2 — Moments + recap bridge:** moments table/API/UI, end-game → recap composer handoff,
  Wrapped ingestion.
- **P3 — Live fairness polish:** bench-warning sort (longest-benched first), pitcher-cap live
  countdown chip, "Playing time tonight" deltas vs season averages.

## 8. QA / verification

- Unit: swap-from-period-N grid math (pure function, table-driven); quiet-flag server guard
  (rejected outside window / non-score fields); result derivation (win/loss/tie/null cases);
  mirrored-game write rejection unchanged (existing 409 tests must stay green).
- `npm run verify:changed`; `npm run typecheck` (shared modules touched: lineup route, events route).
- Owner QA via ledger: bench swap on a phone at ≤640, abandonment mid-game (grid keeps plan),
  attendance vocabulary identical to schedule tab, no family notification until End game,
  archived season shows no entry point.
- **Not** added to `APPROVED_ARCHIVE_DOORS` / `APPROVED_SEASON_AWARE_ROUTES` — deliberate.

## 9. Open questions (owner)

1. **Wake lock:** practice run bans it; a bench console arguably wants the screen to stay on.
   Recommend: follow the ban in P1, revisit with real-field feedback.
2. **Per-period score breakdown** (line score): defer until a sport pack needs it? (Softball
   coaches may ask early.)
3. Should `End game` nudge the coach toward the recap composer immediately (P2), or is that
   pushy at 9pm at a diamond?
