# Multi-Sport Tournaments — Implementation Plan

**Status:** Phase 0 + Phase 1 **BUILT + DEPLOYED to production** (2026-06-19) — a *silent anchor* (sport stored + threaded end-to-end; migrations 135/136/137 applied to dev + prod; **no organizer-facing change yet**). **Phase 2 is next** (reveal the sport picker + sport-aware labels). Phase log: `memory/project_multisport_tournaments.md`.
**Priority:** High (unblocks non-softball orgs + aligns tournaments with the coach "select your sport" model)
**Tier:** All tiers (core capability; plan-gating TBD — see Open Decisions)
**First non-softball pack:** Basketball
**Origin:** Owner-requested review (2026-06-18) — "ensure tournaments are multi-sport." Backed by an 8-dimension adversarial audit (25 agents, 68 findings, 17 architectural findings verified). Findings summarized in `memory/project_multisport_tournaments.md`.

---

## TL;DR

The tournament engine is **far closer to multi-sport than it looks**. Scores are already stored as generic home/away integers; standings already rank on win/loss/**tie** and score-difference; venues already support court/rink/gym/field/diamond. What is softball-specific is **(a) the absence of any sport field on tournaments, (b) "Runs" vocabulary hard-coded across ~10 surfaces, and (c) a few genuine rule differences** (mercy/run-diff cap, the fixed 2-points-per-win formula, default tie-breaker order, rules templates).

The recommended architecture is a **single `sport` field on the tournament + a per-sport "Sport Pack" registry** that supplies every difference (score word, default tie-breakers, points-per-win, whether a diff-cap applies, default surface, period label, event-start verb). Every screen reads labels/rules from the pack instead of hard-coding "Runs." This converts ~10 scattered fixes into one source of truth and makes **adding sport #3, #4 a data change, not a code hunt.**

No architectural blocker exists. Verifiers consistently rated the work **medium effort** — breadth of label surfaces, not depth.

---

## What is already sport-agnostic (no work)

- **Score storage & display** — `games.home_score` / `away_score` are plain integers; public surfaces render a generic final home–away pair (no innings line-score). Soccer goals / basketball points / hockey goals already display correctly.
- **Standings math** — `computeTournamentStandings` (in `lib/tie-breakers.ts`) compares `homeScore`/`awayScore` numerically; **ties are already tracked** (`t` column, `pts = wins*2 + ties`). H2H and coin-toss breakers reference no sport concept. Playoff seeding is rank-based.
- **Facilities** — `FacilityType = 'diamond' | 'field' | 'court' | 'rink' | 'gym' | 'other'`; add-facility default is already `'other'`.
- **Game lifecycle, scheduling, divisions, pools, registration fields, fees, roster requirements, contacts, branding** — all sport-neutral.
- **Precedent already exists** — `league_seasons.sport`, `rep_teams.sport`, `basic_coach_teams.sport` are first-class fields (the first two `NOT NULL DEFAULT 'softball'`). Tournaments are the only event entity without one.

---

## Verified coupling (what makes tournaments softball-only today)

### Architectural / structural

| # | Coupling | Where | Fix |
|---|---|---|---|
| A1 | **No `sport` field on tournaments** — nothing downstream can branch | `tournaments` table; `Tournament`/`TournamentSettings` types; `mapTournament`; `saveTournament`/setup-tournament insert; update whitelist; clone; populate-from | Add `tournaments.sport TEXT NOT NULL DEFAULT 'softball'`; thread end-to-end |
| A2 | **Sport dropped at the tournament boundary** — a coach's chosen sport is discarded on registration | `saveTeam`, `createBasicCoachTeamForRegistration` (omits `sport` even though `basic_coach_teams.sport` exists) | Carry sport via the tournament (all teams in a tournament share its sport); backfill coach-team sport from `tournaments.sport` |
| A3 | **Fixed points-per-win = `wins*2 + ties`** — soccer (3-1-0) would compute **wrong standings**; basketball ranks by win %, not points | `lib/tie-breakers.ts` (`computeTournamentStandings`), `lib/db.ts` (`computeStandings`), archive page — **3 hard-coded sites** | Add `pointsPerWin`/`pointsPerDraw` + `standingsPrimary` to the pack/settings; replace the literal |
| A4 | **Tie-breaker vocab + default order are softball** — `rf/ra/rd` keys labeled "Runs For/Against/Diff"; `DEFAULT_TIE_BREAKERS` is a single softball constant | `lib/tie-breakers.ts` (BREAKER_LABELS/DESCRIPTIONS, DEFAULT_TIE_BREAKERS) | **Keep keys** (they're opaque generic identifiers — no DB rename); make labels + default order sport-keyed via the pack |

> **Decision: do NOT rename the stored `rf/ra/rd` identifiers.** They are persisted inside `settings.tie_breakers` JSON. They are already just numeric score-for/against/diff under a label. Renaming them is a needless migration risk. We change **display labels only**, driven by the pack.

### Moderate (sport-aware branch / new field)

- **Mercy / run-diff cap** (`max_run_diff_per_game`, `maxRunDiffPerGame`) — meaningless for basketball/soccer. Keep the storage; **hide the input** when `pack.hasDiffCap === false`; relabel ("Max point/goal differential") otherwise.
- **Sport picker is fragmented** — four screens (`TeamSignupClient`, admin rep-teams, house-league, onboarding) each declare their own list with inconsistent casing/length, plus scattered `'softball'` fallbacks. Centralize into one shared list.
- **`LeagueStandingsRow` field names** (`runsFor/runsAgainst/runDifferential`) — house-league path; relabel display, optionally alias fields.

### Cosmetic (label/copy, driven by the pack once it exists)

Public standings legend + cap footnote; team-profile "RUNS FOR/AGAINST/RUN DIFF" tiles; results & archive page column headers; `RaceToPlayoffsView` `rd` label; dashboard launch-checklist tie-breaker sub-label (× 2); help-content tie-breaker prose; countdown `"First pitch in…"`; `"Field Shortcuts"` heading; schedule-generator `"fields/diamonds"` copy (× 3); venue/facility placeholders; division-name `"U13"` placeholder; rules-samples mercy/innings text; coach-signup "baseball/softball lineups" bullet.

### Out of tournament scope (flagged, deferred)

- **Rep-team coach lineup tool** is hard baseball (`inning_count`, `inning_positions`, `LINEUP_POSITIONS` P/C/1B…, `lineup_mode`). Lives in Rep Teams, not tournaments. Needs a **sport guard** (hide for non-baseball/softball) — Phase 4. `CoachingAssignment` doesn't currently carry `sport`, so the guard needs that threaded first.
- **DB table literally named `diamonds`** backs the generic `Venue` entity (50+ `.from('diamonds')` calls). Invisible to users. Optional rename → Phase 4.

### Pre-existing bug to fix alongside (sport-agnostic, but compounds multi-sport)

- **Clone & populate-from silently drop the entire `settings` JSONB** (tie-breakers, timing, roster rules, email toggles, format). `cloneTournament` and `populateTournamentFrom` build explicit column lists and never copy `settings`. This already hurts the softball "clone last year's event" flow and would silently lose sport-specific config. **Fix in Phase 0.**

---

## Architecture: the Sport Pack

New module `lib/sports.ts` — the single source of truth.

```ts
export type SportId =
  | 'softball' | 'baseball' | 'basketball' | 'soccer'
  | 'hockey' | 'volleyball' | 'lacrosse' | 'other';

// Replaces the 4 copy-pasted dropdown lists.
export const SPORT_OPTIONS: { id: SportId; label: string }[] = [ ... ];

export interface SportPack {
  id: SportId;
  label: string;                      // "Basketball"
  scoreUnit: string;                  // "Point"  (singular)
  scoreUnitPlural: string;            // "Points"
  scoreLabels: {                      // standings columns / tiles
    for: string; against: string; diff: string;       // "Points For" / "Against" / "Point Diff"
    forAbbr: string; againstAbbr: string; diffAbbr: string; // "PF" / "PA" / "PD"
  };
  defaultTieBreakers: TieBreaker[];   // basketball: ['h2h','rd','rf']  (rd=point diff)
  pointsPerWin: number;               // softball/hockey 2, soccer 3
  pointsPerDraw: number;              // 1 (0 where draws impossible)
  usesDraws: boolean;                 // basketball false (OT resolves)
  standingsPrimary: 'points' | 'winPct'; // basketball 'winPct'
  hasDiffCap: boolean;                // softball true, basketball/soccer false
  diffCapLabel: string;               // "Max run differential per game"
  defaultFacilityType: FacilityType;  // basketball 'court'
  periodLabel: string;                // "Quarter"  (softball "Inning", soccer "Half")
  defaultPeriodCount: number;         // basketball 4, softball 7, soccer 2
  startVerb: string;                  // "Tip-off"  (softball "First pitch", soccer "Kickoff")
}

export function getSportPack(sport: SportId | string | null | undefined): SportPack; // fallback → softball
```

V1 ships **two tailored packs (softball, basketball)**; every other `SportId` resolves to a **neutral generic pack** (scoreUnit "Point"/"Score", no diff cap, draws on, points 2-1-0) so the picker can list them without bespoke work. Tailoring more sports later = adding a pack object.

### Basketball pack (the V1 proof)

| Field | Value | Rationale |
|---|---|---|
| scoreLabels | Points For / Against, Point Diff (PF/PA/PD) | points, not runs |
| defaultTieBreakers | H2H → Point Diff → Points For | standard basketball seeding |
| pointsPerWin / Draw | 2 / 0 | ranking proxy; draws impossible |
| usesDraws | false | OT resolves every game |
| standingsPrimary | **winPct** | basketball standings are W-L record / win %, displayed as "PCT" — **not** a points total |
| hasDiffCap | false | no mercy/diff cap → hide the cap input |
| defaultFacilityType | court | |
| periodLabel / count | Quarter / 4 | |
| startVerb | Tip-off | countdown reads "Tip-off in…" |

---

## Phases

### Phase 0 — Foundations & cleanup (zero visible change)
1. **`lib/sports.ts`** — `SportId`, shared `SPORT_OPTIONS`, `SportPack` interface, `getSportPack`, softball + basketball + generic packs. Repoint the 4 existing sport dropdowns + `'softball'` fallbacks to the shared list (no behavior change; softball stays default).
2. **Fix clone/populate-from settings drop** — include `settings: source.settings ?? {}` in `cloneTournament` and `populateTournamentFrom`. (Pre-existing bug; verify with a clone smoke test.)
- **Verification:** `npm run typecheck` (shared module touch). Softball behaves identically.

### Phase 1 — Anchor sport on the tournament (INVISIBLE — picker held to Phase 2 per owner decision 2026-06-19)
**Decision:** the organizer-facing picker stays hidden until the wording (Phase 2) is ready, so the first basketball tournament reads correctly end-to-end. Phase 1 is therefore the silent data anchor only — every new/existing tournament is recorded as softball via the column default, no UI.
1. **Migration**: `ALTER TABLE tournaments ADD COLUMN sport TEXT NOT NULL DEFAULT 'softball'`. Update `DATA_DICTIONARY.md` + `npm run refresh:snapshots` (schema = same unit of work).
2. Thread `sport` through `Tournament` type (required `string`), `mapTournament`, `saveTournament`, **and carry it on clone + populate-from**. Create path (`setup-tournament`) is NOT touched — the column default makes every new tournament softball.
3. *(Moved to Phase 2)* Creation sport picker (pre-filled from org's `league_seasons.sport`) + Event Settings sport field.
- **Verification:** `npm run typecheck`; dictionary + snapshot ratchets; clone/populate carry sport. Dev-server restart (shared modules + new column).

### Phase 2 — Reveal the picker + sport-aware vocabulary (the "Basketball lights up" release)
0. **Creation sport picker** (from `TOURNAMENT_SPORT_OPTIONS` = softball + basketball + Other) — **default from the org's existing `league_seasons.sport`** when known, else softball; include `sport` in the setup-tournament body + the update whitelist. **Event Settings** sport field in "Tournament Overview", editable post-creation.
1. `breakerLabels(pack)` / `breakerDescriptions(pack)` helpers replace the static `BREAKER_LABELS`/`BREAKER_DESCRIPTIONS` at every consumer (TieBreakerEditor, divisions, dashboard checklist, public standings legend + footnote, help-content prose).
2. Team-profile tiles, results & archive headers, `RaceToPlayoffsView` → pack labels.
3. **Hide the diff-cap** input/footnote when `pack.hasDiffCap === false`; relabel via `pack.diffCapLabel` otherwise.
4. Countdown `startVerb`; `"Field Shortcuts"`→ neutral; schedule-generator + venue placeholder copy neutral/pack-driven.
- **Verification:** browser pass on a basketball tournament — standings read "Points For / PF / Point Diff", no run-diff cap shown, countdown "Tip-off in…". Softball unchanged.

### Phase 3 — Sport-correct rules & defaults
1. **Configurable standings** — add `pointsPerWin`/`pointsPerDraw` + `standingsPrimary` to settings (seeded from pack at creation). `computeTournamentStandings`, `computeStandings`, archive page read them. Basketball → `winPct` primary column ("PCT"), Pts hidden; softball/hockey unchanged (2-1-0 points).
2. **Sport-keyed default tie-breakers** at creation (from `pack.defaultTieBreakers`).
3. **Sport-keyed rules templates** (`rules-samples.ts`) + **default facility type** from the pack; division-name placeholder broadened.
4. Wire the **basketball pack** fully; QA a full basketball tournament end-to-end.
- **Verification:** unit tests for the configurable points formula (soccer 3-1-0 + basketball win% as fixtures, even pre-launch); browser pass.

### Phase 4 — Deeper / optional (post-V1)
- Rep-team **lineup sport guard** (thread `sport` into `CoachingAssignment`; hide innings/batting grid for non-baseball/softball).
- Generic **period/inning structure** + per-sport live scorekeeper.
- `diamonds` → `venues` **table rename** migration.
- Backfill `basic_coach_teams.sport` from `tournaments.sport`; tighten to `NOT NULL`.

---

## Migrations
- **Phase 1:** add `tournaments.sport` (one column, additive, safe default). Update dictionary + snapshots; `npm run check:dictionary` must pass.
- **Phase 4 (optional):** `diamonds`→`venues` rename; `basic_coach_teams.sport` backfill + NOT NULL.
- Apply to dev first; prod manually at release (`apply-migration-api.mjs --prod`); `check:migrations` gates.

## Risk
- **Low–medium.** Storage already generic; changes are additive (one nullable-with-default column) + label indirection. The only correctness-sensitive piece is the configurable points formula (Phase 3) — covered by unit tests. The clone/populate fix (Phase 0) is a net bug-fix.
- Touch breadth is the main cost: ~10 label surfaces in Phase 2. A shared `breakerLabels(pack)` helper keeps it to one change per surface.
- Each substantive phase should run the `/review` adversarial funnel (shared-module + engine edits) and `/docs` (Phase 1–3 change user-facing flows).

## Decisions (LOCKED 2026-06-18, owner-approved)
1. **Existing tournaments** stay softball (`DEFAULT 'softball'`). ✅
2. **Basketball standings** rank by **win % (a "PCT" column)**, not a points total. Drives `standingsPrimary: 'winPct'` in the basketball pack. ✅
3. **Sport is editable after games exist**, but show a **warning when results already exist AND the new sport changes the ranking math** (points-per-win/standings primary), since that can re-order a live table. Pure-label sport changes need no warning. ✅
4. **Picker contents** — the TOURNAMENT picker offers **only tailored sports (softball + basketball) + "Other"** (neutral fallback), growing as packs are added. *(Reversed from the original "list all" lean — listing an un-built sport over-promises and the generic fallback would be wrong for it, e.g. soccer's 3-1-0.)* Encoded as `TAILORED_SPORT_IDS` + `TOURNAMENT_SPORT_OPTIONS` in `lib/sports.ts`. ✅
5. **Multi-sport is core — NOT plan-gated.** The sport *choice* is free on all tiers; monetization stays on capabilities (auto-scheduling, etc.), which remain plan-gated independent of sport. ✅

## Build status
- **Phase 0 — BUILT 2026-06-18 (dev, on `dev` branch), not yet browser-verified.** Shipped: `lib/sports.ts` (SportId, canonical `SPORT_OPTIONS`, `TOURNAMENT_SPORT_OPTIONS`, `SportPack` registry with softball + basketball + generic packs, `getSportPack`/`normalizeSportId`/`sportLabel`); the 4 sport dropdowns (coach signup, rep-teams, house-league, onboarding league-season) now source from `SPORT_OPTIONS` (coach keeps its Title-case stored value; the 3 admin dropdowns keep lowercase ids — **no stored-value change**, they just gain volleyball/lacrosse and a canonical order); and the **clone + populate-from settings-drop bug is fixed** (both now copy the `settings` JSONB). `npm run typecheck` clean; lint 0 errors. ⚠ New file + shared-module (`lib/db.ts`) change → **dev server must be restarted** before browser testing. Not committed yet.
  - **Post-build `/review` (high-risk funnel) + hardenings, 2026-06-19.** Verified the settings-copy is **reference-safe** (every `settings` key is an enum/boolean/number/string — no cross-entity ids, so copying across tournaments can't dangle). Folded 3 follow-ups: (1) clone now **respects the include-fee / include-rules toggles** for settings-resident keys (strips `fee_scope`/`payment_instructions`/`show_fees_on_register`/`payment_instructions_on_form` when fees excluded, `rulesLayout`/`resourcesLayout` when rules excluded); (2) a **defensive guard** (`toSettingsObject`) so a malformed `settings` value can't propagate through clone/populate; (3) switched the leftover `'softball'` literals to the shared **`DEFAULT_SPORT`** across the league-season / rep-team / coach-checkout / workspace-provisioning create paths (behaviour-identical). The clone carrying the coach-email-pause state forward was reviewed and **confirmed intended** (config carry-forward; the draft is reviewable). typecheck + focused lint still clean.
  - *Casing follow-up (deferred):* coach signup still stores Title-case sport while admin stores lowercase ids — a latent mismatch. Full reconciliation (lowercase everywhere + backfill of existing rows) is a later, clearly-scoped cleanup, intentionally out of Phase 0 to avoid a data migration.
- **Phase 1 — BUILT 2026-06-19 (dev, on `dev` branch), not browser-verified, not committed.** The silent data anchor: **migration 136** adds `tournaments.sport TEXT NOT NULL DEFAULT 'softball'` — **applied to DEV, ⚠ PROD-PENDING** (apply with the rest of the multi-sport phases at release). `sport` is now a required field on the `Tournament` type, populated by `mapTournament` (+ the two other row-mappers — `tournament-context`, org/tournaments page — which typecheck surfaced), defaulted in `saveTournament`, and **carried on clone + populate-from**. Create path untouched (column default → softball). DATA_DICTIONARY updated + snapshots refreshed (watermark #136); `check:dictionary` + `check:snapshots` green; typecheck clean; lint 0 errors. **No organizer-facing change** — picker held to Phase 2. ⚠ shared-module + new-column change → dev-server restart before browser testing.
- **Phases 2–4 — not started.**

## Success criteria
- A basketball tournament created from scratch shows Points/PF/PA/PD, win-% standings, court default, "Tip-off" countdown, and **no** run-diff cap — with **zero** "Runs"/"innings"/"diamond" wording on any organizer or fan screen.
- An existing softball tournament is **pixel-identical** to today.
- Clone & populate-from carry all settings **and** sport.
- Adding a third tailored sport later requires only a new pack object — no new code paths.
