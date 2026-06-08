# Unified Bracket Engine + Playoff-Only Tournaments — Implementation Plan

> **Status:** Planning
> **Created:** 2026-06-04 · **Re-scoped:** 2026-06-04 (unified engine directive)
> **Branch:** dev
> **Plan tier:** Tournament Plus (consistent with existing `playoff_generator` gating)

## Goal

Build **one bracket engine** that every tournament uses — full (round-robin) tournaments and bracket-only tournaments alike. The engine supports **any number of teams (with byes)**, **single elimination (1-game)**, **single elimination + consolation (2-game guarantee)**, and **double elimination**. The **builder UI, look, and feel are identical** for all tournament types.

**The only difference between the two tournament types is the seeding source:**
- **Round-robin tournament** → seeds come from standings (resolve after pool play, as today).
- **Playoff-only tournament** → no round robin; the organizer seeds teams **manually or by randomize**, resolved at bracket creation.

Everything downstream — bracket structure, byes, winner/loser advancement, auto-scheduling, public bracket view, share/OG cards — is shared.

---

## Design principle: separate *seeding source* from *bracket structure*

The whole project hinges on this split:

```
Seeding source  ─┐
 (standings OR    ├─►  ordered seed list [seed1..seedN]  ─►  Bracket structure generator  ─►  games
  manual/random) ─┘        (+ labels)                          lib/playoff-bracket.ts
```

- **Seeding source** produces an ordered list of N seeds (+ display labels). Round-robin uses `getStandings` (+ crossover label mapping); playoff-only uses a manual/random order. This is the *only* branch between the two tournament types.
- **Bracket structure generator** (`lib/playoff-bracket.ts`, new, pure, tested) is **seeding-agnostic**. Given `N`, `format`, and options it emits matchups with `bracketCode` and `home/away` references (`Seed #k` / `Winner X` / `Loser X`), with byes on top seeds.
- **Resolver** maps seed references → real `teamId`s — at creation for playoff-only, via `advancePlayoffs` after pools for round-robin.

This is what lets one UI + one generator serve both, exactly as the directive requires.

---

## What already exists (verified 2026-06-04)

| Capability | Where | Status for unified engine |
|---|---|---|
| Winner/Loser auto-advance by placeholder string | `advancePlayoffs()` `lib/db.ts` (~L1884) | ✅ Mechanic already works → **drives double-elim too** (Loser routing) |
| `winnersTo` / `losersTo` matchup fields | `lib/types.ts` `BracketMatchup` (L260–261) | ✅ Already defined |
| Bracket builder UI (rounds, drag, connectors, manual edit) | `BracketBuilder.tsx` | ✅ Reuse for ALL types |
| Playoff wizard (config → preview → auto-schedule → save) | `PlayoffWizard.tsx` | ⚠️ Refactor `generatePreview()` to call the new generator + add seeding-source branch |
| Hardcoded 2/4/8 pool templates | `PlayoffWizard.generatePreview()` | ❌ **Replaced** by `lib/playoff-bracket.ts` (any-N + byes + double-elim) |
| Initial seed resolution gated on "all pool games done" | `advancePlayoffs()` `lib/db.ts:1914` | ⚠️ Stays for round-robin; **playoff-only resolves at creation instead** |
| Auto-schedule (scored slotting, rest, byes-aware timing) | `lib/schedule-generator.ts` | ✅ Reuse for all |
| Public bracket render + pool/playoff stage toggle | `LogicSyncBracket.tsx`, `PublicBracketView.tsx`, `ScheduleContent.tsx` | ✅ Reuse; hide pool stage when playoff-only; render LB/GF |
| Per-tournament settings JSONB + whitelist patch | `TournamentSettings`, `tournaments.settings`, `patch-settings` | ✅ Store `format` flag — **no migration** |
| Plan gating | `lib/plan-features.ts` (`playoff_generator`) | ✅ Reuse |

**Two real gaps to close:**
1. **Any-N + byes + double-elim generation** — current templates only do 2/4/8 single-elim off pools. New pure generator covers all formats and sizes for *every* tournament.
2. **Seed-at-creation path** for playoff-only (engine currently only fills seeds after round robin completes).

Plus one genuinely new advancement rule: the double-elim **"if-necessary" grand final** (a deciding reset game that only matters if the losers-bracket team wins the first grand final).

---

## PM Brief

See `PLAYOFF_ONLY_TOURNAMENT_PM_BRIEF.md`.

---

## Architectural Decisions

- **Decision:** One pure module `lib/playoff-bracket.ts` is the single bracket structure generator for **all** tournaments (round-robin and playoff-only). **Rationale:** the directive — same engine, same look/feel; only seeding differs. Removes the 2/4/8 pool-specific templates.
- **Decision:** Support **three bracket formats everywhere**: `single` (1-game), `consolation` (2-game guarantee — R1 losers get one more game), `double` (double elimination). **Rationale:** explicit directive to support double-elim and 2-game guarantee in all playoffs. These are independent of seeding source.
- **Decision:** **Byes for any N** (non-power-of-two) in all formats and both seeding sources, assigned to top seeds, auto-advanced to round 2. **Rationale:** directive — odd numbers must work for full tournaments too, not just playoff-only. `BracketSlot.isBye` already exists.
- **Decision:** Tournament `format` (`'round_robin_playoffs' | 'playoff_only'`, default the former) stored in `tournaments.settings` JSONB; whitelisted in `patch-settings`. **Rationale:** no migration; single flag drives the seeding-source branch + display/lifecycle.
- **Decision:** Double-elim and consolation **reuse the existing `advancePlayoffs` Winner/Loser string-matching** — the generator emits the extra losers-bracket / consolation matchups with `Loser X` placeholders. **Rationale:** the advancement mechanic already exists; only the generated structure is new (plus the GF-reset rule).
- **Decision:** Playoff-only resolves seeds → `teamId` **at creation**; round-robin keeps post-pool resolution. **Rationale:** the single, contained branch between the two types; no new seed-map table (resolved teamId on the game row is the record).
- **Decision:** Keep the round-robin **crossover options** (standard / reseed / none) as a *seeding-source concern only* — they shape the seed ordering/labels fed into the generator, not the structure. **Rationale:** preserves existing pool semantics without leaking into the shared generator.

---

## Phases

### Phase 1 — Unified bracket structure generator (pure, tested) — *foundation for everything* ✅ DONE 2026-06-04
- [x] New `lib/playoff-bracket.ts`, seeding-agnostic (`generateBracket(seedCount, { format, thirdPlace, grandFinalReset })`):
  - [x] `nextPow2` + `seedOrder` (standard separation seeding) + bye math (byes on top seeds).
  - [x] single elimination (any N, byes), optional 3rd-place game.
  - [x] consolation (2-game guarantee) — first-game losers feed a consolation bracket; guarantee = no team eliminated after one game (N≥4 → everyone ≥2).
  - [x] double elimination — winners + generalized losers bracket (minor/major alternation, bye-safe) + grand final + optional if-necessary reset (`GF2`, `ifNecessary`).
  - [x] Output: `GeneratedMatchup[]` with `code`/`round`/`roundIndex`/`section`/`home`/`away` using `Seed #N` / `Winner <code>` / `Loser <code>` refs — the shape the wizard/builder already consume.
- [x] Unit tests `tests/unit/playoff-bracket.test.ts` (run: `node --test tests/unit/playoff-bracket.test.ts`): N = 2,3,4,5,6,7,8,11,16 across all three formats — reference validity (no dangling/duplicate codes), all teams present, single-elim game count = N−1, one terminal, **simulated** game-count guarantees in both outcome extremes, one GF + one if-necessary reset. **32/32 pass; lint clean.**
- *Note:* full `tsc` sweep deferred to Phase 2 (module is pure + unconsumed; ES2017 target validates the `Set` spread).

### Phase 2 — Wire the generator into the existing wizard (round-robin path first) ✅ DONE 2026-06-04
- [x] Extend `PlayoffConfig` (`lib/types.ts`) → optional `format: 'single' | 'consolation' | 'double'` + `grandFinalReset?` (kept legacy `type`, non-breaking).
- [x] Refactor `PlayoffWizard.generatePreview()`: the standard-crossover + reseed branches now build an ordered **seed-label list** (`buildSeedLabels` — interleaved pool labels for standard, `Seed #N` for reseed) and call `generateBracket(teamsQualifying, { format, thirdPlace, grandFinalReset })`, remapping `Seed #k` → label (`remapSeedRef`). The inline 2/4/8 templates are gone. **Standard-crossover-4 is reproduced exactly**; standard-8 is a valid (more correctly separated) bracket.
- [x] **Format selector** in the wizard config UI (Single / Consolation / Double) with format hint; double swaps the 3rd-place checkbox for an "if-necessary grand final (reset)" toggle.
- [x] `baseOptions` (reseed) now caps at `teamsQualifying` so the "missing teams" validation doesn't false-flag seeds beyond the bracket size.
- [x] GF2 reset references `Winner GF`/`Loser GF` so the auto-scheduler orders it after the grand final.
- [x] Verified: lint clean, `tsc` exit 0 / 0 errors, full unit suite 60/60.
- **Deferred (follow-up):** the **no-crossover / split-pool** mode still uses its existing per-pool single-elim template — it does not yet offer consolation/double (the format selector is intentionally hidden for `crossover === 'none'`). Extending split pools to the new formats is a later refinement.
- ⚠️ **Before browser testing:** new file (`lib/playoff-bracket.ts`) + shared-module changes (`lib/types.ts`) → **dev server restart required**.

### Phase 3 — Double-elim + consolation advancement & display ✅ DONE 2026-06-04
- [x] `advancePlayoffs()` (`lib/db.ts`): Winner/Loser routing already fills LB & consolation games; added the **GF-reset rule** — when `GF` completes, cancel `GF2` if the winners-bracket side (GF home) won, keep it scheduled if the losers-bracket side won. Re-runs on re-scoring; scoped by `bracketId`; won't clobber a played reset.
- [x] Shared `bracketRoundInfo(code)` in `lib/playoff-bracket.ts` (+ tests) — maps any code to a column key/title/rank. Single source of truth for grouping across renderers.
- [x] Public `LogicSyncBracket`: round-grouped columns via `bracketRoundInfo` (also fixes large 16/32-team single-elim that previously rendered one-column-per-game), champion spotlight from `GF2`→`GF`→`FIN`, and the single-elim halving connectors are skipped for multi-section (double/consolation) brackets to avoid misleading lines.
- [x] Admin `buildBracketColumns` (schedule `page.tsx`): same round grouping. Admin connectors (`BracketConnectors`) infer from `Winner/Loser` placeholders, so they already follow the double-elim structure.
- [x] List-view ordering (`ScheduleContent` `bracketPriority`) delegates to the shared rank.
- [x] Verified: lint 0 errors, `tsc` 0 errors, 34/34 unit tests.
- **Deferred to Phase 6 polish:** the standings mini-bracket (`PublicBracketView`) + legacy `app/schedule/page.tsx` still group by raw code (won't break — just less tidy for double-elim); and a pixel-perfect losers-bracket tree topology with cross-section connectors in the public SVG (currently shows clean round columns without the halving lines).

### Phase 4 — Tournament `format` flag + playoff-only seeding source ✅ DONE 2026-06-05 (minimal usable slice)
- [x] Added `format?: TournamentFormat` (`'round_robin_playoffs' | 'playoff_only'`) to `TournamentSettings` (`lib/types.ts`); whitelisted + validated in `patch-settings` (`app/api/admin/tournaments/route.ts`); helpers `getTournamentFormat` / `isPlayoffOnly` in `lib/tournament-phase.ts`.
- [x] **Format control** added to **Event Settings → Competition Rules** ("Round robin + playoffs" vs "Bracket only"), wired through the page's saved-diff/auto-save pattern. *(Create-flow choice in the setup wizard deferred — lower-risk to set in settings for V1.)*
- [x] **Seed Teams** step in the playoff wizard, shown only when `isPlayoffOnly`: drag-reorder list of the division's accepted teams (`@dnd-kit`), **Randomize** (Fisher–Yates), bye preview ("top N seeds get a first-round bye"); Crossover + Qualified-Teams controls hidden; Bracket Format selector reused. `teamsQualifying` is forced to the seeded count and `crossover` to `reseed`.
- [x] Resolve seeds → `homeTeamId/awayTeamId` **at creation** (`resolveSeedTeamId` parses `Seed #N` → seeded team id; byed seeds resolve in round 2). Reuses the same generator + builder + auto-schedule + advancement.
- [x] Round-robin-completion guards confirmed no-op when there are no pool games (`getRoundRobinCompletion([])` → null).
- [x] Verified: lint 0 errors, `tsc` 0 errors, 48/48 unit tests.
- **Deferred:** "protect top N seeds" randomize variant; create-flow format choice; showing real team names (not `Seed #N`) inside the admin builder canvas (the Seed Teams list shows the mapping; created games + public bracket already show real names because ids resolve at creation).

#### Phase 4 — format-switch safety guards ✅ DONE 2026-06-05
- [x] **Format change is Draft-only.** In Event Settings the format toggle is **disabled once the tournament leaves Draft** (active/completed/archived) with an explanatory note ("set status back to Draft to change it"). Switching format mid-event is otherwise destructive/incoherent.
- [x] **Switching format clears the existing schedule (with confirmation).** Because round-robin and bracket schedules are structurally different, changing the format when games exist opens a warning modal ("permanently delete this tournament's existing schedule (N games)") and, on confirm, wipes the tournament's games before applying the new format. If no games exist, it switches silently.
- [x] New API action `delete-tournament-games` (`app/api/admin/games/route.ts`) — scope/org-checked + **Draft-only on the server** (defense in depth, rejects on live tournaments). Save uses an explicit `formatOverride` (the auto-save trigger doesn't track format), mirroring the status-change pattern. lint/tsc clean.
- [x] **Latent bug fixed (⚠ prod-affecting — deploy):** removed a write to a non-existent `schedule_facility_lane_label` column on the `games` table in `app/api/admin/games/route.ts` (~L186). It surfaced when generating a bracket against temp facility lanes, but the same path runs in prod for any temp-facility schedule generation — flag for the next deploy.

### Phase 5 — Display & lifecycle (hide round robin for playoff-only) ✅ DONE 2026-06-05
- [x] **Generator/Playoff-builder division-picker parity** (2026-06-04) — the Playoff Bracket Builder no longer blocks with a "Choose a division first" modal when multiple divisions are selected. It now opens like the round-robin generator with an **in-modal division selector** (`PlayoffWizard` takes `divisions[]` + `defaultDivisionId`, derives the active division from internal state, resets config/preview on switch). Both generators default smartly: round robin → first division **without a round-robin schedule**; playoffs → first division **without a playoff bracket** (a single selected division still wins). lint/tsc clean.
- [x] **Public schedule** (`ScheduleContent`): for playoff-only it defaults to the Playoffs stage + bracket layout, never sits on the empty pool stage, and the **pool/playoff stage toggle is hidden** (mobile + desktop). Derives `isPlayoffOnly` from `selectedTournament.settings.format`.
- [x] **Admin schedule** (`schedule/page.tsx`): stage forced to Playoffs, the **Round-Robin / Playoffs stage toggle is hidden** (mobile + desktop), the **Round-Robin Generator entry is suppressed** in both tools menus (and `openGenerator` early-returns), and the empty-state prompt points to the Playoff Bracket Builder.
- [x] **Standings hidden** for playoff-only (no round-robin table): `isPublicPageEnabled`/`visiblePublicPages` (`lib/public-pages.ts`) return false for `standings` when `isPlayoffOnly`, and the public layout folds `standings` into `hiddenPages` so the nav tab + page guard both drop it.
- [x] Verified: lint 0 errors, `tsc` 0 errors, 34/34 bracket tests.
- [x] Browser-verified 2026-06-07.
- **Not needed / deferred:** the admin dashboard shows schedule **health/metrics** (which already work over bracket games), not a literal "generate round robin" checklist step, so no swap was required. A tournament-level format **badge** ("Double elimination" / "2-game guarantee") is deferred — the elimination format is per-division (`playoffConfig`), so a single tournament-level badge is ambiguous; revisit in Phase 6.
### Phase 6 — Optional / later

**Tier 1 (quick wins) ✅ DONE 2026-06-05** (lint/tsc clean, 34/34 tests):
- [x] **Real team names in the admin bracket canvas** — `BracketBuilder` gained an optional `labelFor?: (raw) => string` display map (default identity); `PlayoffWizard` passes a `Seed #N` → team-name map for playoff-only so the canvas + colour dots show real names while the underlying value stays `Seed #N` (resolution unaffected).
- [x] **Tidied the last two bracket renderers** — `components/public/PublicBracketView.tsx` (standings mini-bracket) and the legacy `app/schedule/page.tsx` now group via the shared `bracketRoundInfo`, so double-elim / consolation render as ordered round columns (not one-per-game); champion spotlight + `bracketPriority` updated for `GF2`/`GF`. `PublicBracketView` keeps its separate 3rd-place sub-section.
- [x] **"Protect top N seeds" randomize** — `PlayoffWizard` Seed Teams step has a "Protect top N" stepper (shown at ≥3 teams); Randomize keeps the top N fixed and shuffles the rest.

**Tier 2 ✅ DONE 2026-06-05** (lint/tsc clean, 44/44 tests):
- [x] **Printable bracket PDF** — new `lib/export/bracket-pdf.ts` (`downloadBracketPDF`) draws round-column matchup boxes via shared `bracketRoundInfo`: played games show scores (winner bolded) + champion line, un-played show a blank fill-in line; single-elim gets connector lines, double-elim/consolation render as columns. Branded header/footer reuse `OrgPdfSettings`. **Surfaced as a single, context-aware PDF in the existing `ExportMenu`** (per feedback): there is **one** "PDF" item whose output follows the on-screen `layout` toggle — Bracket view → `downloadBracketPDF` (item reads "Bracket PDF"), List/Timeline → the schedule game-table `downloadPDF` ("PDF report"). `ExportMenu` gained `pdfLabel`/`pdfHint` overrides; `handleExportPDF` routes on `layout`.
- [x] **Removed the iCal (calendar) export from the admin schedule** (per feedback — low value for organizers; the Timeline venue×time view + notifications cover in-app calendar needs). Dropped `ics` from the schedule `ExportMenu` formats + removed `handleExportICS`/`downloadICS` import. **The public fan-facing "Add to Calendar" is intentionally kept** (a parent adding their team's games is a distinct, valuable use case).
- [x] **Format badge on public** — per-division badge on the schedule Playoffs stage ("Single Elimination" / "2-Game Guarantee" / "Double Elimination") from `division.playoffConfig.format`. Per-division placement sidesteps the tournament-level "mixed" ambiguity; legacy brackets with no `format` show nothing.
- [x] **Format choice at tournament creation** — added a "Tournament style" choice (Round robin + playoffs / Bracket only) to the `tournament` step of **both** create flows (`TournamentSetupWizard` + onboarding `page.tsx`); on create, `playoff_only` is persisted via `patch-settings` (default round-robin writes nothing; failure is non-fatal — still settable in Event Settings).

**Tier 3 (in progress):**
- [x] **Full placement bracket** ✅ DONE 2026-06-05 — new `'placement'` format: every team plays to a final ranking. Recursive `buildPlacement`/`rankInto` in `lib/playoff-bracket.ts` — the winners path is the championship bracket (1st–2nd, 3rd–4th), each round's losers cascade into a classification bracket for the next band (5th–6th, 7th–8th, …). Any N with byes. Codes: championship `FIN`/`SF`/`QF`/`R{n}`; deciding place games `PL{place}` (e.g. `PL5` = 5th-place game); classification rounds `PL{place}R{r}-{g}`. `bracketRoundInfo` + the format selector ("Full Placement (every team ranked)") + badge ("Full Placement") + multi-section connector skip (LogicSyncBracket + PDF) updated. **Tests:** `terminalRefs` resolve to exactly seeds 1..N under simulation (both outcome extremes) → proves a unique, complete ranking for N=2..16. lint/tsc clean.
- [x] **Placement final-standings table** ✅ DONE 2026-06-05 — `placementPlaces(n)` (exported from `lib/playoff-bracket.ts`) maps each terminal landing ref → its place (the source of truth, handles byes/sole-leaf places); `computePlacementStandings(games, teams)` (`lib/playoff-standings.ts`) derives N from the terminal count, then resolves each place to a team via real results (TBD until the deciding game is final). A **"Final Standings"** panel on the public schedule Playoffs view lists the ranking 1..N (top-3 + champion highlighted) once results come in. 45/45 tests (incl. `placementPlaces` = exactly N places 1..N, refs point at real codes).
- [x] **Playoff game-length override (scheduling + conflict validation)** ✅ DONE 2026-06-05 — playoff games can run longer than pool games; the conflict detector + schedule-health metrics now honour a playoff-specific length instead of forcing the tournament default. New `TournamentSettings.playoff_game_duration_minutes` / `playoff_buffer_minutes`; whitelisted + validated in the `patch-settings` route. `resolveGameTiming(division, tournament, isPlayoff)` (`lib/schedule-conflict.ts`) and `resolveDuration(...)` (`lib/schedule-metrics.ts`) prefer the override for playoff games. `ConflictGame.isPlayoff` threads through `GameList` + `ScheduleTimeline` (inline conflicts, drag checks, all `checkVenueConflict` timing). The Playoff Wizard's Game Duration **is** the override: it defaults from the saved override and **persists it via `patch-settings` on generate**, with a field hint ("…overrides the tournament default"). So an explicit playoff length is no longer flagged as a conflict against the default. lint/tsc clean. *(Separately flagged: the auto-scheduler doesn't yet respect the double-elim dependency graph — it can place GF before its feeders; see Remaining.)*
- [x] **Admin double-elim bracket = fork layout + winner/loser connectors** ✅ DONE 2026-06-05 (awaiting browser verification) — per feedback that the losers bracket reading to the *right* of winners implied a single linear path, **and** that the seed round belongs *before* the split so every feed flows forward. The read-view bracket (`PlayoffBracketView`/`BracketColumns` in schedule `page.tsx`) now renders double-elim as a **fork**: a shared **Seed Round** (round 1 = `WB1`) column on the left → **Winners Bracket** (top) + **Losers Bracket** (bottom) in the middle → **Grand Final** on the far right; seed + grand-final columns are vertically centred between the two branches, so no connector runs backward under the seed games. Single/consolation/placement stay flat. `buildBracketColumns` now carries the round `key`; `BracketColumns` splits columns into seed (`WB1`) / winners (`WB≥2`) / losers (`LB*`) / finals. The **"if necessary" reset (`GF2`) is its own column** to the right of the Grand Final, titled "Grand Final Game 2 (If Necessary)" (split out in `buildBracketColumns`, admin-only — shared `bracketRoundInfo` untouched so public renderers are unaffected); the Finals section highlights both GF + GF2. Branches share the canvas's horizontal scroll on desktop (sticky tier labels) so connectors stay aligned; on mobile the fork stacks vertically and each round row scroll-snaps (connectors already hidden). **Connectors are colour-coded** (`BracketConnectors`): lime = winner advances, amber **dashed** = loser drops down; a **legend** renders above any bracket with a loser path. (Also fixed a pre-existing "ref write during render" lint error in `BracketConnectors`.) lint/tsc clean.

**Remaining Phase 6:**
- [x] **Auto-scheduler double-elim dependency graph** — VERIFIED CORRECT 2026-06-07 (no fix needed). The playoff auto-schedule already builds the dependency graph: `PlayoffWizard.autoSchedulePreviewRows` derives `dependsOnMatchupIds` from `extractDependencyCodes(row.home/away)` (regex `[A-Za-z0-9_-]+` covers WB1-1 / LB2-1 / GF / GF2 feeders), and `generateScoredSchedule` hard-blocks placement (`scoreAssignment` returns `POSITIVE_INFINITY`) when any dependency is unplaced or would start before the dependency ends + `dependencyMinRestMinutes`. Proven by `tests/unit/schedule-generator.test.ts` ("schedules dependent final after its sources" -> FIN lands at 12:00 after both SFs; "keeps dependent playoff rounds after fixed protected source games"). The earlier "can place GF before feeders" note was outdated.
- [x] **Public bracket fork + winner/loser connectors + GF2 column** ✅ DONE 2026-06-05 (awaiting browser verification) — ported the admin treatment to the fan-facing `components/bracket/LogicSyncBracket.tsx` (the SVG bracket on the public schedule Playoffs view). It already had winners-top/losers-bottom bands + data-driven connectors; added: (1) the shared **Seed Round** column on the left with the winners/losers bands forked off it (round-1 `WB` pulled out, the rest shifted right one `ROUND_WIDTH`, grand-final band re-centred on the fork mid); (2) **colour-coded connectors** — `ConnectorPath` now takes a `kind` and strokes winner feeds green (`--success`) / loser feeds amber-dashed (`--warning`), falling back to org `--primary` for single-elim (uses org/semantic tokens, not FieldLogic brand tokens, per the component's theming rule); (3) **GF2 as its own column** (same `buildColumns` override, local — shared `bracketRoundInfo` still untouched). Champion spotlight unchanged. lint/tsc clean.
- [x] **Standings-page bracket consolidated onto `LogicSyncBracket`** ✅ DONE 2026-06-05 (awaiting browser verification) — the public **Standings** page rendered a *second*, divergent bracket (`components/public/PublicBracketView.tsx`, a flat CSS-grid tree with pair-based single-elim connectors — couldn't show the data-driven coloured winner/loser lines), which is what the user was actually looking at ("not seeing the changes"). Rather than maintain two renderers, `StandingsContent` now uses the same `LogicSyncBracket` as the Schedule view (passing playoff-only games + `tournamentId`), so the fork/colours/GF2 apply on both surfaces. **`LogicSyncBracket` made theme-safe in the process** — its hardcoded dark-only `rgba(255,255,255,x)` text + `#4ade80`/`#fbbf24` status colours were swapped for the theme-adaptive `--white-XX` / `--success` / `--warning` tokens (the app inverts `--white` to near-black on light themes), fixing a latent white-on-white bug on branded-light public pages (affected the Schedule bracket too). `PublicBracketView.tsx` is now unused (left in place; safe to delete later). lint/tsc clean.
- [x] **Bracket PDF matches the fork layout + better fit** ✅ DONE 2026-06-05 (awaiting browser verification) — `lib/export/bracket-pdf.ts` double-elim body re-laid-out to the same fork as the screen: **Seed Round** column left (spread over the full page height, filling the dead space) → **Winners** band top / **Losers** band bottom → **Grand Final** centred right. Dropping the losers into their own band cuts the columns-per-row (≈6 vs the old 8 flat), so each box is wider and names stop truncating; per-band headers (losers labels sit above the losers band). Added **data-driven, colour-coded connectors** (green = winner advances, amber-dashed = loser drops; segments route through the column gaps so they never cross a box) and white box fills so nothing bleeds through. Single-elim / consolation / placement keep the flat one-row layout (now via the shared placement/header pass). lint/tsc clean.
- [x] **Bracket PDF page-splitting for large brackets** ✅ DONE 2026-06-05 (awaiting browser verification) — refactored `bracket-pdf.ts` so the header/footer render per page and a reusable `drawSection(cols, mode, headerBottom, connectors)` lays out either the fork or a flat row. Decision: if the fork's column width would drop below a legibility floor (`MIN_COL_W` ≈ 33mm — triggers around 16+ teams), the bracket splits onto **two pages — Winners (seed + winners + grand final) then Losers** — each using full page width so names stay readable; on the split pages connectors only draw when both endpoints are on that page (cross-band refs become labels). Over-wide flat brackets paginate by round (`Rounds N–M` suffix). 8-team and smaller still render on one fork page. lint/tsc clean.
- [x] **Seed-round relabel + winners renumber + findable PDF codes** ✅ DONE 2026-06-05 (awaiting browser verification) — once round 1 became the standalone "Seed Round", labelling its games `WB1-x` was misleading **and** the winners bracket proper read as starting at WB2. Display-only helpers in `lib/playoff-bracket.ts`: `displayBracketRefs(text)` rewrites WB round tokens in any string (code or `Winner/Loser WB2-1` placeholder) — `WB1-x → SR-x`, `WB{n}-x → WB{n-1}-x` (so the winners bracket reads SR → WB1 → WB2 …; `WB10-/WB11-` safe via the trailing dash); `displayRoundTitle(title)` matches for column headers (`Winners Round 1 → Seed Round`, `Winners Round 2 → Winners Round 1`, others unchanged). Underlying `bracketCode` is untouched, so advancement still matches the real codes. Applied to admin badge + placeholders + **column titles**, public `LogicSyncBracket` badge/names/titles, and the PDF placeholders/titles. The **PDF also prints each box's code** (small grey label) so every reference is findable. **Also fixed a stale-title bug**: the admin column headers were editable `<input>`s keyed by index with a once-initialised state, so a previously-viewed single-elim bracket's `Semifinals`/`Finals` names bled into this bracket's first columns — replaced with static derived titles (`displayRoundTitle(col.title)`) and removed the `titles` state + the now-redundant "Seed Round"/"Finals" section labels (per-column titles carry them). 5 new unit tests (50/50). lint/tsc clean. Dev server restarted (shared lib).
- [x] **Pixel-perfect double-elim tree connectors** ✅ DONE 2026-06-07 (awaiting browser verification) — replaced right-angle L-shape routing in LogicSyncBracket with cubic bezier curves. Cross-band connectors (WB loser → LB) exit the bottom-center of the WB node (dropDown=true), curve reads as "loser falls". Within-band connectors use horizontal S-curve matching admin BracketConnectors. isCrossBand = kind === 'loser' && /^WB\d/i; CONNECTOR_STUB removed. tsc clean, 50/50 unit tests.
- [x] **Draw-day reveal** ✅ DONE 2026-06-07 (browser-verified 2026-06-07 — owner OK'd, restrained by design) — one-time staggered entrance on the public `LogicSyncBracket`: when a fan first opens a **seeded, pre-play** bracket this browser session, round columns + cards fade/settle in left→right, top→bottom and connectors fade in just after their endpoints land. New `LogicSyncBracket.module.css` (keyframes + reduced-motion guard, no colours). Gated so it **never re-fires** on realtime score updates (`revealEvaluated` ref, evaluated once on first node build) and plays **once per tournament** across Schedule + Standings (`sessionStorage` key). Skips entirely when any game has started/scored, when the bracket is all-TBD, or under `prefers-reduced-motion`. Public-facing only (admin read-view untouched). Per-node delay = `min(colRank*120 + rowIdx*50, 900)ms`; total ≈1.5s. tsc clean, lint 0 errors, 50/50 bracket tests, route smoke 200.
- [x] **Double-elim / consolation / placement for split-pool (no-crossover) mode** BUILT 2026-06-07 (awaiting browser verification) — the `crossover='none'` branch in `PlayoffWizard.generatePreview` no longer uses hardcoded 2/4/8 single-elim templates; each pool now runs through the unified `generateBracket(qTeams, {format, thirdPlace, grandFinalReset})` with `Seed #k` remapped to `"Nth Pool X"` labels, so ALL formats (single/consolation/double/placement) are available per pool. The **Bracket Format** selector is surfaced for 'none' (one format applied to every pool; per-pool qualifying count stays; per-pool 3rd-place hidden for double/placement). **Bug fix (also fixed latent single-elim split-pool bug):** `advancePlayoffs` (`lib/db.ts`) Winner/Loser advancement now scopes by `bracketId` — identical codes (WB1-1/SF1) across pools no longer cross-contaminate. Public render needed NO change (`ScheduleContent` already renders one `LogicSyncBracket` per pool via `inferPool`). No migration. tsc + lint 0 errors.
- [x] **Bracket-aware schedule health** BUILT 2026-06-07 (awaiting browser verification) — replaced the round-robin per-team health table in the Playoff Wizard (which mis-modelled bracket placeholders as teams → phantom negative rest / back-to-backs, esp. across split pools) with edge-based metrics. New pure `lib/bracket-schedule-metrics.ts` builds the advancement-edge graph (Winner/Loser refs, scoped by pool) and reports tightest turnaround, feasibility violations, worst-case games/day, and longest run to the title; new `BracketHealthPanel` renders it. Rationale: a bracket's participants are seeds flowing through the tree, so rest is a property of edges (deterministic from slots), not of placeholder "teams". 16 unit tests; tsc + lint clean; applies to all playoff brackets.
- [x] **Seeding source — seed-by-number (admin)** ✅ DONE 2026-06-06 (awaiting browser verification) — organizers assign a seed per team in the **Teams admin** (edit modal "Seed" field; migration **113** adds `teams.seed`, nullable). The Playoff Builder's Seed Teams step gains a **"By Seed #"** button (shown only when ≥1 team is seeded) that orders teams by `seed` (unseeded last, by name) and feeds the existing `generateBracket`/`seedOrder` path; the step also **initialises in seed order** when seeds exist. Plumbing: `Team.seed`, `getTeams` mapper, teams API update (validates `seed` int 1–999 or null) + GET mapping, `lib/db.ts`. Registration-form capture **intentionally dropped** (self-ranking is confusing; broader registration questions cover it). Migration applied dev + prod 2026-06-06. lint/tsc clean.
- [ ] **Seeding source — seed by prior-event results** (import a previous tournament's final standings → populate `teams.seed`). Foundation (`teams.seed`) now exists; the import/matching UI is the remaining work.
- [ ] **Pot/group draw** (avoid same-club Round 1; seeded pots).
- [ ] **Printable blank bracket PDF** (existing export/PDF infra).
- [ ] Confirm share/OG bracket images render with pre-seeded teams.

---

## UX improvement insights

1. **Real team names from the start** (playoff-only resolves at creation) — broadcast-ready bracket from game one, not placeholders.
2. **Randomize with guardrails** — protect top seeds, avoid same-club Round 1, pot-based draw.
3. **Bye transparency** — show which seeds get byes and why; now valuable for full tournaments too (odd team counts).
4. **Format clarity badges** — "2-game guarantee" / "Double elimination" on public pages.
5. **Placement games option** — "play to a final ranking" so no team's day ends after one loss.
6. **Re-seed/swap before play, lock after first game.**
7. **Reuse the auto-scheduler** — every format gets scored facility/time assignment, rest rules, conflict viz for free.
8. **Mobile seeding** — pair with the admin redesign bottom-sheet primitives for thumb-friendly drag seeding at the field.

---

## Decisions Locked (2026-06-04)

- ✅ **Double-elim grand final** — include the **"if-necessary" reset** deciding game (true double elimination), exposed as a per-bracket **toggle, default ON**. `PlayoffConfig.grandFinalReset` defaults true.
- ✅ **V1 format menu** — ship **all three**: Single elimination (1-game) / 2-game guarantee (consolation) / Double elimination — available to every tournament.
- ✅ **Placement** — V1 = **champion + optional 3rd-place game** only. Full placement bracket (5th/7th, play-to-rank) stays **Phase 6**.
- ✅ **Plan tier** — **Tournament Plus only** (consistent with existing `playoff_generator` gating).

## Open Questions

- [ ] **Migration of existing brackets** — existing 2/4/8 round-robin brackets are data-compatible (same game rows); confirm no backfill needed, just the generator swap going forward. (Assumed yes; verify during Phase 2.)

## Cross-references

- Reuses scheduling from **No-Cost Automated Schedule Generator** + **Schedule Timeline (venue × time)**.
- Bracket visuals overlap **Tournament Admin Visual Redesign** Phase C (bracket carousel / connectors / champion spotlight) and **Standings Page Remodel** (live bracket) — reuse, don't fork.
