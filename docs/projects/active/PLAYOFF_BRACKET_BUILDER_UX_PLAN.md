# Playoff Bracket Builder — Discoverability + Add Game wiring (UX follow-on)

**Status:** BUILT 2026-06-12 on `feat/free-tier-coaches` · dev only · **no migration** · awaiting browser verification.
Typecheck + lint (0 errors) clean; 69 playoff-bracket unit tests pass (4 new for `buildPlaceholderOptions`).
A 3-dimension adversarial review (correctness / gating-UX / reuse) with per-finding verification ran;
6 confirmed findings folded (null team-ids, the 64-seed cap, first-game `bracketId` minting, lock-state
gating on the new entry points, preset survival across in-wizard division switch, prop rename). The
"not-real" findings (the `ph:` prefix, the `isPlayoff` condition, the `autoScheduled` gate, the
BracketBuilder dup) were left as-is.
**Follows:** [PLAYOFF_MANUAL_AND_TIERS_PLAN.md](PLAYOFF_MANUAL_AND_TIERS_PLAN.md) — that project shipped the
*capability* (free `playoff_manual`, three-state server gate, tiered split). This is the
*surfacing + completion* layer it explicitly left open.

## Problem

The free manual bracket builder already exists and is already free — but two things make it
effectively undiscoverable, so organizers fall into a broken manual path instead:

1. **It is hidden behind "Auto."** The only entry to the builder
   ([PlayoffWizard.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx)) is the
   **"Auto ▾"** dropdown ([page.tsx:2595](../../../app/[orgSlug]/admin/tournaments/schedule/page.tsx),
   `ScheduleToolsMenu`), labeled with a Sparkles icon and the subtitle *"Build playoff brackets by
   seed."* Everything about that placement signals "paid automation," so free organizers never open
   it. The gate is actually `playoff_manual` (free for all tournament tiers,
   [page.tsx:167](../../../app/[orgSlug]/admin/tournaments/schedule/page.tsx)).
2. **"Add Game" is a dead end for brackets.** In playoff mode the Add/Edit Game modal
   ([page.tsx:1680-1699](../../../app/[orgSlug]/admin/tournaments/schedule/page.tsx)) only exposes a
   3-char **Abbreviation** (the bracket code) + Notes. There is **no field to set a participant to
   "Winner SF1" / "Seed #5."** So a bracket built game-by-game has no dependencies wired — exactly the
   disconnected "G1…G7 in a row that don't make sense" symptom organizers hit.

Everything needed to fix this already exists: the builder's add-round / add-matchup / auto-linking
canvas ([BracketBuilder.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/components/BracketBuilder.tsx)),
baseline `1 v 8 / 2 v 7` seeding (`seedOrder()` /`generateBracket()` in
[lib/playoff-bracket.ts:79](../../../lib/playoff-bracket.ts)), placeholder columns
(`bracket_code` / `home_placeholder` / `away_placeholder` / `bracket_id`), advancement
(`advancePlayoffs` in [lib/db.ts](../../../lib/db.ts)), and connector rendering
([BracketConnectors.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/components/BracketConnectors.tsx)).
This is an IA reframe + one real Add Game fix, **not** a new builder.

## ⟳ Redirect 2026-06-12 — manual canvas for free; auto-generator → Plus

Owner pushed back: the free "Build Bracket" was opening the full **auto-generator**
(format/crossover/teams-advancing → generate the whole bracket). That's the automation,
not the manual flow. Re-ruled:

- **Free = a true manual builder** — new `components/ManualBracketBuilder.tsx` (reuses the
  existing `BracketBuilder` canvas): **"Seed first round" (top-N → 1 v 8, 2 v 7 …) or "Start
  empty"**, then add rounds/matchups by hand; each slot picks **Seed / Winner-of / Loser-of**,
  and any reference **already wired into another game is hidden** (single-use). Lines draw as you
  wire. Saves as `playoff_manual` (free, `autoScheduled:false`).
- **Auto-generator → Tournament Plus** — the full `PlayoffWizard` (format/crossover/generate +
  auto-schedule) is now reached only via **"Auto-Generate Bracket"** in the "Auto" menu, gated on
  `canAutoGenerateSchedule` (locked + upsell for free).
- **Entry:** free "Build Bracket" (toolbar + empty-state) → `ManualBracketBuilder`, shown only
  when the division has **no** bracket yet (an existing bracket is managed via Add Game / inline /
  bracket view / cascade-delete). The earlier "Start from standings" baseline preset was removed
  (the builder has its own starter).
- **Single-use filter** added to the Add Game modal + inline-row pickers too (the canvas already
  had `allUsedOptions`). **Fixed** a pre-existing `BracketBuilder` bug surfaced by review:
  `addMatchup` coded by round *name* (`"Round 1"`/`"Round 2"` both → `"RO1"`) → collisions that
  cross-wired advancement; now `R{roundIdx}-{n}`, unique across the bracket.

Verified: typecheck/lint clean (one unrelated error in a concurrent `onboarding/page.tsx` edit),
69 bracket tests, two focused adversarial reviews folded. Files: new `ManualBracketBuilder.tsx`,
`page.tsx`, `GameList.tsx`, `BracketBuilder.tsx`, `PlayoffWizard.tsx` (unchanged behavior).

## Decisions (owner-ruled 2026-06-11)

| Fork | Decision |
| --- | --- |
| Entry point | **CTA + empty-state → existing modal** (reuse the builder; no inline page editor in V1) |
| Add Game in playoff mode | **Add placeholder pickers** (Seed #N / Winner CODE / Loser CODE) so single games wire in |
| Auto features for free | **Locked + upgrade CTA** (keep discoverable upsell; server already blocks) |

## Scope

### Workstream A — Surface the builder (entry point + empty-state)
- **First-class "Build Bracket" button** in the PLAYOFFS + BRACKET view header (not under "Auto").
  Gated by `canBuildPlayoffsManually` (always true on tournament tiers → free). Calls
  `openPlayoffWizard()`. Reads **"Edit Bracket"** when the division already has playoff games.
- **Empty-state** inside `PlayoffBracketView` when the selected division has zero `isPlayoff` games:
  - Title: *"No playoff bracket yet"* + one line explaining a bracket is rounds of games wired by
    winners/losers.
  - Primary CTA **"Build Bracket"** → opens the wizard in manual mode.
  - Secondary CTA **"Start from standings (1 v 8, 2 v 7…)"** → opens the wizard pre-set to single-elim
    baseline seeding (reuses `generateBracket()`), landing the user on a pre-wired first round they can
    edit. Requires a small `initialPreset` prop on `PlayoffWizard`.
- **Remove the "Playoff Bracket Builder" item from the "Auto" menu** (`ScheduleToolsMenu` ~2622-2635
  and `MobileToolsMenu`). The "Auto" menu becomes purely paid automation (Round-Robin Generator,
  locked + upsell for free). Kills the "builder = paid" signal.
- **Naming unification:** modal title "Playoff Bracket **Generator**" → "Playoff Bracket **Builder**";
  reserve "Auto"/"Generator" for the paid scheduling optimizer.

### Workstream B — Fix Add Game for playoffs (placeholder pickers)
- In the Add/Edit Game modal, when `viewMode === 'playoff'`, each side (Home/Away) can be set to a
  **real team** OR a **placeholder**:
  - `Seed #N` (N = 1..teamsQualifying, or 1..accepted-team count)
  - `Winner <code>` / `Loser <code>` for every existing playoff game's `bracketCode` in the division
    (excluding the game being edited).
- Emit **canonical** strings exactly — `Seed #N`, `Winner SF1`, `Loser SF1` (note the required space) —
  so `advancePlayoffs` and `BracketConnectors` resolve them (string-matched).
- Keep the Abbreviation (bracketCode) field; **add a uniqueness check** that warns if the code already
  exists among the division's playoff games (duplicate codes break Winner/Loser resolution — gap noted
  in the codebase map).
- On save: `isPlayoff: true`, `autoScheduled: false` → routes through the `playoff_manual` (free) server
  gate at [games/route.ts:145-158](../../../app/api/admin/games/route.ts). `bracket_id`: if the division
  has exactly one existing playoff `bracket_id`, inherit it so the new game joins that bracket and
  connectors resolve; otherwise leave null (single-bracket case). Multi-bracket/tiered single-game add =
  follow-up (see Non-goals).
- **Share one helper** between the builder and Add Game: extract
  `buildPlaceholderOptions(divisionPlayoffGames, teamsQualifying)` (from `BracketBuilder.optionsForRound()`)
  so both produce identical option sets and identical string formats.

### Workstream C — Keep Auto locked + upsell (no functional change)
- Round-Robin Generator stays in the "Auto" menu, locked with upsell for free (unchanged).
- The in-modal "Auto-schedule dates & times" toggle stays locked + upsell (unchanged).
- The new "Build Bracket" button is **not** gated (free).
- No server changes — the three-state gate is already correct. Verify a hand-added placeholder game
  (`autoScheduled:false`) is accepted as `playoff_manual` for a free org.

## Non-goals (V1)
- Inline editable bracket directly on the page (owner chose modal reuse).
- Wiring a hand-added single game into a **tiered/multi-bracket** division (tiered stays a Plus wizard
  flow; manual single-game add targets single-bracket divisions first).
- Any new auto/optimizer capability for free.

## Key files
- [schedule/page.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/page.tsx) — empty-state +
  Build/Edit Bracket button in `PlayoffBracketView`; remove playoff item from `ScheduleToolsMenu` /
  `MobileToolsMenu`; Add/Edit modal placeholder pickers + code-uniqueness warning; baseline-start entry.
- [PlayoffWizard.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx) — optional
  `initialPreset` (baseline single-elim) for the secondary CTA; title rename.
- [BracketBuilder.tsx](../../../app/[orgSlug]/admin/tournaments/schedule/components/BracketBuilder.tsx) —
  source `buildPlaceholderOptions` helper for reuse.
- [lib/playoff-bracket.ts](../../../lib/playoff-bracket.ts) — `generateBracket` / `seedOrder` (reused, no
  change expected).

## Schema / migration
**None.** `games.bracket_code` / `home_placeholder` / `away_placeholder` / `bracket_id` / `is_playoff`
and `divisions.playoff_config` all already exist (confirmed against
`docs/agents/db/schema-snapshots/schema-dump-columns-prod.json`). No dictionary or snapshot change.

## Risks / gotchas
- **Canonical placeholder strings** — pickers must emit exact `Winner <code>` (with space) / `Seed #N`,
  never free text, or advancement silently never fires.
- **Duplicate bracket codes** break resolution → enforce the uniqueness warning in Add Game.
- **bracket_id inheritance** for hand-added games differs single-bracket vs multi-bracket; V1 scopes to
  single-bracket.
- **Empty-state is division-scoped** (respects the DIVISION dropdown) and must behave for both
  playoff-only events (Seed #N resolves at save) and round-robin → playoff events (Seed #N defers to
  standings via `advancePlayoffs`).
- **Restart rule** (AGENTS.md): if a new shared lib/helper file is added, restart the dev server before
  browser testing; batch and restart once at handoff.

## Verification
- `npm run verify:changed` + `npm run typecheck` (touches the shared schedule page + a new helper).
- `node --test tests/unit/playoff-bracket.test.ts` stays green.
- Browser (owner): free org sees the empty-state + Build Bracket (opens free); baseline-start pre-wires
  1 v 8 / 2 v 7; Add Game placeholder pickers create a connected game (connector line draws; advancement
  fires when the source game completes); the "Auto" menu shows Round-Robin Generator locked + upsell;
  duplicate-code warning appears.
