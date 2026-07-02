# Coaches Portal — Lineup Intelligence (enriched player profile + smart auto-fill)

**Status:** PLANNED (design locked 2026-07-01; adversarially reviewed against the codebase 2026-07-01, blockers folded in). Not started.
**Owner decisions:** captured 2026-07-01 (see "Locked decisions").
**Scope:** Premium Coaches Portal, org-scoped rep teams. Sport-neutral (softball/baseball today).
**Related:** builds on the Lineup Builder shipped ~2026-06-29 (migs 070/159). Key files: `lib/lineup-generator.ts`, `lib/lineup-analysis.ts`, `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`, `lib/db.ts`, `lib/types.ts`, `lib/sports.ts`.

---

## 1. Problem

Today the auto-fill knows only two things about a player: their **Primary** and **Secondary** position (two free-text columns, mig 070). Everything else is generic fairness (spread bench time evenly, avoid back-to-back sits). None of the six coach intentions we want are expressible:

1. Positions a player should **never** play.
2. **Pitching separated** from regular fielding (arm care, depth chart).
3. **More than two** ranked positions a player can play.
4. **Max innings** per position (rotation rule) and per pitcher (arm care).
5. An **A-squad** for competitive "gold-medal" games — who plays and where.
6. **Ranked pitchers** (ace / #2 / #3) used differently in competitive vs balanced games.

The builder already knows the event type (league_game / tournament_game / scrimmage) but never uses it to pick a strategy.

## 2. Design principle — traits vs. intent

- **Player traits** (roster, set once): ranked positions, never-play, pitcher flag + rank + arm-care cap, A-squad membership.
- **Team/season rules** (set once per season): position-rotation innings cap, pitching cap default, minimum innings per player.
- **Game intent** (chosen when building a lineup): Competitive / Balanced / Development + competitive sub-dials — pre-selected from event type, always overridable.

The **game-mode switch is the master dial**; most asks are "in competitive do X, in balanced do Y" over the same player data.

## 3. Locked decisions (2026-07-01)

- **D1 — Full build, phased delivery.** All six capabilities, sequenced (see §8).
- **D2 — Two management surfaces.** Per-player detail page **and** a team depth-chart board.
- **D3 — Competitive = mode + two independent dials:**
  - *A-squad emphasis:* `balanced_sits` (A-squad gets key innings/best spots; bench time still spread evenly) vs `prioritized` (A-squad barely sits; weaker players absorb sits).
  - *No back-to-back sits:* independent boolean; when on, even `prioritized` rotates who sits among the non-A-squad so nobody sits all game.
- **D4 — Caps are two separate things:**
  - **Position-rotation cap** — one season-level number: max innings any player may play at a single field position (forces rotation). Applies to all field positions **except P**. Optional (off = no cap).
  - **Pitching cap** — separate, arm-care. Per-player value with an optional season default. Governs P only.
- **D5 — Hard vs soft:** "Never" positions and both caps are **hard constraints** in every mode (including Development). Preference ranking, A-squad priority, and pitcher rank are **soft** (best-effort within fairness + hard constraints).

### Assumptions (flip if wrong)
- **A1:** Position-rotation cap is **season-level** (age-group/league rule); pitching cap is **per-player** with an optional season default.
- **A2:** V1 caps are per-game hard constraints derived from season settings; a per-game override in the auto-fill popover is a later enhancement, not V1.
- **A3:** Minimum-innings-per-player floor is a season-level setting; when set, it is the **highest-priority** bench rule — respected even in `prioritized` competitive mode (protects league min-play rules). Off by default.

## 4. Data model

### 4.1 Player profile — `rep_roster_players.lineup_profile jsonb` (nullable, additive)
Single JSONB blob (matches platform pattern: `pdf_settings`/`resources` jsonb; app-validated, no DB CHECK so vocabulary can evolve without ALTER TABLE). **The legacy `primary_position` / `secondary_position` columns stay as the authoritative store for the top-two "Best" positions** — the profile carries only the *additional* richness.

```jsonc
{
  "morePreferred": ["3B"],          // "Best" ranks 3+ (primary=rank1, secondary=rank2 stay in their columns)
  "canPlay":       ["1B"],          // "Okay" — fill in if needed (unordered)
  "never":         ["P", "C"],      // hard exclusions (ask #1)
  "pitcher":       { "rank": 1, "maxInnings": 2 },  // null/absent = not a pitcher (asks #2/#4/#6)
  "aSquad":        true             // gold-medal starter (ask #5)
}
```
- The generator derives the full ordered `preferred` list as `[primary_position, secondary_position, ...morePreferred].filter(Boolean)`; `canPlay` / `never` / `pitcher` / `aSquad` come from the profile.
- Positions validated against the team's sport pack (see §7); a position appears in at most one bucket.
- `pitcher.maxInnings` = per-player arm-care override; falls back to the season default.
- **aSquadPosition override is CUT from V1** — A-squad players use `preferred[0]` (their Best #1) as the competitive-game position. Revisit post-P5 if requested. (§ V1 scope cuts.)

### 4.1.1 Source-of-truth & write rules (resolves the "stale legacy readers" blocker)
The base positions live in `primary_position`/`secondary_position`; the profile is *additive*. This keeps all existing readers/writers of the legacy columns correct with **zero changes to them** (roster list display, missing-position nudge, positioned-count stat, CSV export, quick-add modal, tryout-accept drawer, season rollover):

- **Reading:** any consumer that wants the full picture merges legacy columns + profile. A player created by a legacy path (quick-add / tryout-accept / rollover) that sets only `primary_position` has `lineup_profile = NULL` and is read as `preferred = [primary, secondary]`, `never = []`, not a pitcher, not A-squad — a valid minimal profile, never "positionless."
- **Writing (rich picker only):** when the coach uses the new Best/Okay/Never picker or depth-chart board, we write **both** — `primary_position = preferred[0] ?? null`, `secondary_position = preferred[1] ?? null`, and `lineup_profile = { morePreferred, canPlay, never, pitcher, aSquad }`. This dual-write lives in exactly **one** editor path (via `lib/db.ts`), not spread across readers.
- **db.ts threading (P1):** add `lineupProfile?: LineupProfile | null` to `createRepRosterPlayer` and `updateRepRosterPlayer` signatures + patch guard; add a typed `LineupProfile` interface to `lib/types.ts` next to `RepRosterPlayer`; add it to `mapRepRosterPlayer` with `?? null`. Extend `GeneratorPlayer` in `lib/lineup-generator.ts` with `preferred`, `canPlay`, `never`, `pitcher` and update the call site in `schedule/page.tsx` to pass them from loaded player data — in the same P1 change so `npm run typecheck` catches any omission.
- **No migration/backfill of legacy columns is needed** — they remain in place and authoritative for the top two. This is deliberately *not* a "migrate primary/secondary into JSONB then deprecate" plan; a future consolidation is optional and out of scope.

### 4.2 Season-DEFAULT rules — `rep_program_years.lineup_settings jsonb` (nullable, additive)
Placed on the **program year**, not the team — every other per-season control (attendance, dues, roster) is program-year scoped, and the schedule page already has `programYearId` in context (no extra join). Avoids caps bleeding across seasons. **These are defaults; any game can override them at lineup time (§4.4).**
```jsonc
{
  "maxInningsPerPosition": 3,        // rotation cap (all field positions except P); null = off
  "pitcherMaxInningsDefault": 2,     // season default arm-care cap; per-player overrides win
  "minInningsPerPlayer": 1           // min-play floor (A3); null = off
}
```
Season rollover (`lib/rep-season-rollover.ts`) copies `lineup_settings` to the new program year (or prompts the coach to re-confirm) — P3 delivery note.

### 4.3 Generation-time intent (TypeScript only — not persisted)
Passed into `generateBestLineup()` from the auto-fill popover:
```ts
type LineupMode = 'competitive' | 'balanced' | 'development';
interface GenerateIntent {
  mode: LineupMode;
  aSquadEmphasis?: 'balanced_sits' | 'prioritized'; // competitive only
  noBackToBackSits?: boolean;                         // independent dial
}
```
Mode/dials are **not** persisted in V1 (chosen per generation, pre-selected from event type — see V1 scope cuts).

### 4.4 Per-game rule OVERRIDE — `rep_team_lineups.rules_override jsonb` (nullable, additive)
The one piece of per-game config we DO persist, because a coach sets it deliberately for a specific game (e.g. a tournament with different innings/pitching rules) and it must survive regenerate, reload, and revisits. Any subset may be present; a missing/null key means "use the season default" for that rule.
```jsonc
{
  "maxInningsPerPosition": 4,   // this game only; null/absent => season default
  "pitcherMaxInnings": 3,       // this game's team-wide pitching ceiling; per-player arm-care caps still apply on top
  "minInningsPerPlayer": 0      // e.g. a tournament with no min-play; null/absent => season default
}
```
The auto-fill popover surfaces each as a value defaulting to **"Season default (N)"** with an inline override; overriding writes `rules_override` onto that game's lineup. Clearing an override reverts to the season default. See §6.3.

## 5. Algorithm changes — `lib/lineup-generator.ts` / `lib/lineup-analysis.ts`

Replace the current 3-policy branch with a constraint-layered model. **Preserve the existing structure: the bench/fairness sort runs FIRST each inning, then positions are assigned only to the on-field pool.** Do not move any selection ahead of the bench sort.

**Hard constraints (all modes), applied as eligibility filters inside the existing loop:**
- `never` positions: player removed from the candidate pool for that position. Always.
- `maxInningsPerPosition`: a player at their cap for a field position (not P) is ineligible there this inning.
- Pitching cap: a player at their effective pitching cap cannot be assigned P.
- Existing: one player per singular position per inning; active roster only.

**Effective caps (per-game override → season default → per-player):** for any rule, the effective value = `rules_override[rule] ?? season default[rule]` (a per-game override, else the season default; absent both = off). Then **cap precedence (resolves double-counting):** for **P**, effective cap = `min(pitcher.maxInnings, effective pitching ceiling)` — the individual kid's arm-care cap AND the game's team-wide pitching ceiling both apply, stricter wins. `maxInningsPerPosition` (effective) is **not** applied to P — arm-care governs the mound; rotation governs every other field position. One predicate: `isEligibleAt(player, pos, inning)`. The `minInningsPerPlayer` floor used by the bench model is likewise the effective (override-or-season) value.

**Pitching (ask #2/#6) — a preference, not a pre-bench pass:** the pitcher is chosen from the **already-decided on-field pool** by treating `pitcher.rank` as a high-weight preference for the P slot within the normal assignment loop. Competitive leads with the lowest-rank (ace) eligible pitcher; balanced spreads P innings down the ranked list (least-pitched-first among eligible); development rotates P among eligible pitchers ignoring rank. This keeps the even-bench and back-to-back guarantees intact.

**Field assignment (ask #3):** replace primary/secondary matching with the ranked `preferred` list, then `canPlay`, then least-played fallback — rank-weighted in competitive/balanced, least-played-first in development.

**Bench / fairness model (ask #5 + D3) — with an explicit conflict-resolution priority:**
- *Balanced / Development:* today's behavior — even bench distribution + back-to-back avoidance; A-squad ignored.
- *Competitive:* A-squad get their `preferred[0]` spot and priority to stay on field; the rest fills around them. Bench distribution among non-A-squad follows the emphasis dial:
  - `balanced_sits`: sits spread evenly across everyone who sits.
  - `prioritized`: sits concentrated on non-A-squad, ordered by (not A-squad) then least-benched.
- **Conflict-resolution priority (when rules collide):**
  1. `minInningsPerPlayer` floor **wins over everything** — any player below the floor is force-played, even over A-squad protection.
  2. `noBackToBackSits` **wins over A-squad protection** — a non-A-squad player who sat last inning is skipped for sitting again even if that means an A-squad player must sit.
  3. A-squad protection is best-effort within (1) and (2).
  - If the non-A-squad pool is too small to absorb all sits under (1)+(2), spill sits onto A-squad and emit a warning (below) — a preflight calculation, not a silent runtime fallback.

**Infeasibility handling (resolves silent blank cells):** before each inning's assignment, compute eligible-candidate counts per field position after `never` + cap filters. If any mandatory position has zero eligible candidates, emit a named `analyzeLineup` warning (new `unfillable_position` conflict type, e.g. *"P can't be filled in inning 3 — pitcher cap reached, no eligible backup"*) and leave that one cell blank while still filling the rest. In the position loop, replace the `pool.length === 0` **break** with **continue** so one unfillable slot never aborts the remaining positions for that inning.

**Scoring — phased with the delivery phases (don't reference data that doesn't exist yet):**
- P1: rank-weighted preference reward (ranked `preferred` replaces primary/secondary matching).
- P2: pitcher-rank reward (only when pitcher data is present on `GeneratorPlayer`).
- P3: cap-violation disqualify guard.
- P4: A-squad-on-field reward in competitive mode.

**Mode auto-select:** the builder pre-selects `mode` from event type (tournament_game → competitive, scrimmage → development, league_game → balanced). Coach can override.

## 6. UX surfaces (D2)

### 6.1 Per-player detail page (`roster/[playerId]/page.tsx`)
- Replace the two position dropdowns with a **Best / Okay / Never picker**: the sport's assignable **field positions** as chips (the 9 the auto-fill uses — NOT the generic OF catch-all or DH, which the generator never assigns, so rating them would be inert/confusing); tap cycles Not set → Best → Okay → Never; Best chips reorderable (arrows) to set ranking. Legend names all four states incl. "Not set". A `?` tooltip explains how each state feeds auto-fill. The picker also renders any already-set value not in the offered list (legacy OF/DH, custom) so nothing is orphaned; it self-cleans when cleared. (Writes primary/secondary + profile per §4.1.1.) Built as `components/coaches/PositionProfileEditor.tsx`. Quick-add dropdowns likewise offer field positions (PositionSelect keeps a Custom… escape). DH remains a **manual-only** per-game lineup choice (grid dropdown), never auto-assigned.
- New **Pitching** mini-section: "Is a pitcher?" toggle → reveals Rank (Ace / #2 / #3 …) and Max innings/game.
  - **When the pitcher toggle is ON, P is removed from the Best/Okay/Never chips** and managed only in the Pitching section — a player cannot hold P in preferred/canPlay/never while flagged a pitcher (enforced client-side). Caption under the chips: *"Pitching rotation is managed separately above."* (If a player is *not* a pitcher and P is in their `never`, that's honored normally.)
- **A-squad** toggle. (No per-player competitive-position override in V1.)
- Quick-add modal stays minimal (name/number) — rich profile lives on the detail page.

### 6.2 Team depth-chart board (new surface under `roster/`)
- One screen: players (rows) × positions (columns) from the sport pack.
- Cell shows each player's rating at that position (Best rank badge / Okay dot / Never blocked); tap to change — writes the same data as §4.1.1.
- A **Pitchers** strip: drag pitchers into rank order; per-pitcher arm-care cap inline.
- An **A-squad** toggle column.
- Season rules (rotation cap, pitching default, min-play floor) live in the board header.
- Must be usable on mobile (coaches are mobile-heavy) — likely a horizontally-scrollable grid with a sticky player column, or a per-position accordion on small screens. Mobile layout is an explicit design task in P5, run through `/design`.

### 6.3 Auto-fill popover (`schedule/page.tsx`)
- Existing Fill mode (empty / regenerate) unchanged.
- **Game rules** group (P3): a compact, collapsed-by-default section showing the three caps, each as **"Season default (N)"** with an inline override for this game. Untouched = season behavior; overriding persists to the game (§4.4). A subtle "Overridden for this game — reset to season default" affordance appears when changed. Labels: *"Max innings at one position," "Max innings pitched," "Minimum innings per player."*

### 6.3.1 Progressive disclosure (keeps it coach-legible)
- **P1–P2 add ZERO new popover controls** — the smarter generator works behind the existing 3-option Positions dropdown; players just get better auto-fills.
- **P3** adds the collapsed **Game rules** override group (above). Defaults mean a coach who ignores it gets season behavior; it only matters when a tournament differs.
- **P4** adds the **Mode** segmented control (Competitive / Balanced / Development), pre-selected from event type. The competitive sub-dials appear **only when Competitive is selected**, defaulted to *balanced-sits* + *back-to-back ON* so zero configuration is needed for a good result.
- **Human labels** (internal enum values unchanged): `balanced_sits` → **"A-squad plays key spots — bench still rotates evenly"**; `prioritized` → **"A-squad stays on field — others cover bench time"**; back-to-back toggle → **"Rotate bench so nobody sits two innings in a row."**

### 6.4 Analysis + PDF
- `analyzeLineup()`: new warnings — unfillable position, cap reached, A-squad benched in competitive.
- Playing-time tab: pitching innings per pitcher + cap headroom.
- PDFs: no structural change / no pitcher-rank annotation in V1.

### Known deferred sport-neutrality gaps (pre-existing; benign while only diamond sports are offered)
Surfaced by the P1 review 2026-07-02; left as-is because both offered sports are diamond and multi-sport is PAUSED (owner). Address in a dedicated sweep before enabling any non-diamond sport:
- `schedule/page.tsx` `LINEUP_POSITIONS` / `POSITION_ORDER` (the manual per-cell dropdown, playing-time summary columns, and PDF legend) are hard-coded diamond — should route through `sportPack.positions` / `sportPack.fieldPositions`.
- `lib/lineup-analysis.ts` `SINGULAR_POSITIONS` (conflict detector) is a hard-coded diamond set.
- `lineupInningCount` initial `useState` uses the (pre-load) default pack's `defaultPeriodCount`; a brand-new lineup on a non-default sport could show the wrong period count until a stored value loads.

## 7. Sport-neutrality (P0 pre-fix — see §8)
- All position vocab from `getSportPack(teamSport).positions`. No inlined codes.
- The generator's hard-coded `FIELD_POSITIONS` becomes a `positions: string[]` passed in `GenerateOptions`, derived from the sport pack.
- Pitching concept keys off the `P` code present in the pack; sports without a `P` (basketball) hide the Pitching section and pitching logic degrades cleanly.

## 8. Phasing (delivery order)

- **P0 — Sport-neutrality pre-fix (required before P1; no migration).** Add `sport` to `CoachingAssignment` + the `rep_teams` select in `getCoachingAssignmentsForUser`; replace the three `getSportPack(DEFAULT_SPORT)` module constants in the coach portal pages with the team's actual sport; make `lib/lineup-generator.ts` accept `positions: string[]` instead of hard-coded `FIELD_POSITIONS`. (Also unblocks the tryouts track's noted sport-neutrality pre-work — assign to whichever ships next.)
- **P1 — Position profile core.** `lineup_profile` column + `LineupProfile` type + db.ts threading + dual-write rules (§4.1.1); per-player Best/Okay/Never ranked picker; generator honors `never` (hard) + ranked preference + infeasibility warning. *Immediate lineup-quality win, no new popover controls.*
- **P2 — Pitching depth chart.** Pitcher flag/rank/cap on the player page; generator pitching-as-preference + arm-care cap enforcement.
- **P3 — Caps + per-game override.** Season defaults on `rep_program_years.lineup_settings` (with a lightweight season-defaults settings UI so caps are usable now, not blocked on P5's board) + per-game `rep_team_lineups.rules_override` + the popover **Game rules** override group; position-rotation cap + pitching ceiling + min-play floor enforced via effective-cap resolution; rollover copies season settings.
- **P4 — A-squad + competitive overhaul.** A-squad flag; competitive mode with the two dials + conflict-resolution priority; Mode auto-select + progressive-disclosure popover with human labels.
- **P5 — Team depth-chart board.** Whole-team management surface (mobile design via `/design`).
- **P6 — Analysis/PDF polish + help docs.** Warnings, playing-time additions, `/docs` update for the coach-facing flow.

(P1–P4 each ship a smarter lineup on their own. Batch DB-schema/shared-module changes and restart the dev server once near each handoff.)

## 8.1 V1 scope cuts (explicit)
- No `GenerateIntent` (mode/dials) persistence — chosen per generation. (Per-game **cap** overrides ARE persisted on `rep_team_lineups.rules_override` — that is in scope, §4.4.)
- No PDF annotation of pitcher rank / cap.
- No per-player `aSquadPosition` override (A-squad uses `preferred[0]`).
- No consolidation/removal of `primary_position`/`secondary_position` (they stay authoritative for the top two).

## 9. Migration & verification

- **Pre-condition (blocker):** migs **164–170 must be applied to prod and `npm run check:migrations` GREEN before this track's migration promotes.** Prod watermark is #163; P1's migration is **171** (`rep_roster_players.lineup_profile` — renumbered from an initial 170 that collided with the concurrent tryouts track's `170_tryout_offer_response.sql`). So the whole 164–171 chain (both tracks) must clear prod in order to avoid a gap. Applied to DEV only so far.
- Additive, reversible migrations only (`ADD COLUMN IF NOT EXISTS ... jsonb`, nullable), mig-157 pattern. Update `DATA_DICTIONARY.md` + refresh snapshots in the same unit of work (`npm run refresh:snapshots`, `npm run check:dictionary`).
- App-side validation (no DB CHECK) so position/rank vocab can evolve.
- `npm run typecheck` after generator + shared-type changes (P0/P1 especially); `/review` after each substantive phase; `/docs` at P6.

## 10. Success criteria
- A coach can set, per player: ranked positions, never-play positions, pitcher rank + arm-care cap, and A-squad membership — from either the player page or the depth-chart board.
- Auto-fill never assigns a "Never" position or exceeds a cap, in any mode; when a position genuinely can't be filled, the coach gets a clear named warning, not a silent blank.
- Competitive mode with each dial combination produces visibly different, sensible bench/pitching distributions, with min-play respected as the top priority.
- Legacy rosters and every existing roster reader keep working with no coach action and no data drift.
- No sport-specific strings leak outside the sport pack.
