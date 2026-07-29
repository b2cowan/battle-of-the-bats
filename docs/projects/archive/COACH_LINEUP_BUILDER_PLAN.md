# Coach Lineup Builder — Enhancement Plan

**Status:** Phases 1–4 BUILT (dev) 2026-06-28 — feature complete (mig 159 prod-pending). Part of
the Premium Coaches Portal walkthrough (Schedule → event slide-over → Lineup tab).
**Companion brief:** `COACH_LINEUP_BUILDER_PM_BRIEF.md`

## Problem
Today the Lineup tab is a players-×-innings grid where every cell is a position
dropdown. It is **slow** (≈35 manual dropdowns for 5 players × 7 innings), **error-prone**
(nothing stops two players in the same position/inning), and it doesn't help with the
real coaching goal: a **fair, legal rotation** that's fast to build and easy to post in
the dugout.

## Sport-neutral guardrail
Innings count, position vocabulary, and any sport rules route through the Sport Pack
(`lib/sports.ts` — `getSportPack`, `DEFAULT_SPORT`). Default inning count comes from the
pack (softball 7, baseball 9). Positions already come from the pack's `positions`.

## Core semantics: blank vs bench (applies everywhere)
- **Blank** = *undecided* — prints as an empty box on the dugout PDF; not counted as a sit.
- **Bench / Out** = a *deliberate* sit — a real cell value, counted in the fair-play tally.
This makes "set the first two innings, leave the rest open" honest, and the pen-fill PDF correct.

---

## Phase 1 — Checks, fair-play tally, foundations (NO migration) — ✅ BUILT (dev) 2026-06-28
Pure `lib/lineup-analysis.ts` (conflicts / per-inning fill / fair-play tally, with BENCH vs
blank distinction). Wired into the Schedule lineup tab: position-clash warnings + red ⚠ on
clashing inning headers, "Sits N / back-to-back" per player, uneven-bench-time warning,
batting-order hint linking to the Roster, default innings from the Sport Pack, and a Clear
button. **Batting order is now DRAG-AND-DROP** (auto-numbered by position — duplicate slot
numbers impossible; replaces the typed number inputs), defaulting to roster order. Lineup tab
opens in a **wide panel so all innings fit on desktop** (no horizontal scroll); Clear / Lineup
PDF restyled as real buttons (not muted text). /review-passed (score change) in the same
session. Below = original scope, all delivered:
- **Conflict detection:** flag when two players hold the same fielding position in the same
  inning (highlight the clashing cells).
- **Per-inning completeness:** show "8 / 9 filled" (9-player) or count of fielders set.
- **Fair-play tally (per player):** innings on field vs. benched; **flag back-to-back sits**
  and uneven bench counts.
- **Default inning count from the sport** (Sport Pack), still overridable.
- **Batting order defaults to roster display order**, with a visible hint:
  "Batting order follows your roster order — change it on the **Roster** page (drag to reorder)."
  (Links to Roster.) Reuses the existing roster drag-order.
- **Clear button** (clear all cells → all blank; confirm if there are unsaved edits).
- Pure, testable analysis module (`lib/lineup-analysis.ts`): given entries + innings, returns
  conflicts, per-inning fill, per-player on-field/bench counts, consecutive-sit flags.

## Phase 2 — Auto-generate (NO migration) — ✅ BUILT (dev) 2026-06-28
Pure `lib/lineup-generator.ts` (deterministic greedy). "Auto-fill ▾" menu in the lineup
controls: position policy (Competitive / Balanced / Development) + fill mode (Fill empty only /
Regenerate all, with a no-silent-overwrite confirm). Even bench rotation + no back-to-back sits
always applied. 9-player mode benches non-starters every inning and fields the 9 starters.
Writes into the editable grid (unsaved). Player position subtext removed from the lineup name
cell (cleaner; generator still reads the stored primary/secondary).
**Enhanced 2026-06-28:** (a) randomized tie-breaks so the bench rotation varies (no rigid
roster-order blocks) while fairness stays a hard guarantee; (b) **best-of-N** — Auto-fill now
runs ~16 randomized passes and keeps the highest-scoring one (mirrors the tournament scheduler's
candidate-and-score model), re-roll still varies; (c) **collapsible "Playing-time summary"**
table below the grid — per player: Sits + count at each position used (pitch/infield/outfield/
etc.), live as the coach edits, back-to-back sits flagged amber. Original scope below:
Pure generator module (`lib/lineup-generator.ts`). Inputs: roster (primary/secondary),
innings, **position policy**, **fill mode**, existing assignments. Output: assignments the
coach can then tweak (written into the editable, unsaved grid — **never a silent overwrite**;
regenerating a saved lineup confirms first).

- **Position policy:**
  - **Competitive** — players only in their **primary** position.
  - **Balanced** — **primary + secondary** used to spread people around.
  - **Development** — rotate through many positions regardless of preference.
- **Playing-time fairness (always on, every policy):** rotate the bench evenly; avoid
  sitting the same player two innings in a row.
- **Fill mode:**
  - **Fill empty only** — keep whatever's already set (e.g. pitchers), fill the rest.
  - **Regenerate all** — overwrite (confirm).

## Phase 3 — Dugout-wall PDF (NO migration) — ✅ BUILT (dev) 2026-06-28
The single "Lineup PDF" button is now a **Print ▾** menu with two pen-fillable printouts,
built with jsPDF primitives in `lib/export/pdf.ts` (`downloadLineupPoster` /
`downloadBattingOrderCard`, drawn as a real poster — not the generic report table):
- **Dugout poster** (landscape): team vs opponent + date header, batting order → player (#) →
  one column per inning. **Blank cells print as empty boxes** (pen-fillable); a deliberately
  benched cell prints "BN". Position-abbreviation legend along the bottom (driven by the actual
  lineup-cell vocabulary, incl. EH). 9-player subs trail the order, tagged "(sub)".
- **Batting-order card** (portrait): stripped large-type order for the scorekeeper/dugout, subs
  noted at the foot.
Period word + legend route through the Sport Pack. /review-passed (high-risk funnel; 4 fixes
applied — caption alignment, EH legend, menu-state reset, inning-count guard).

## Phase 4 — Named lineup templates (REQUIRES migration) — ✅ BUILT (dev) 2026-06-28
Save a lineup as a **named template** ("Gold medal game") and load it onto any future game as
an editable starting point. New **Templates ▾** menu in the lineup controls (Save current as… /
Start from a saved template, with per-row delete).
- New store `rep_team_lineup_templates` (**mig 159**, `/dba` Finding #29 option 2 — single table +
  `entries jsonb`, org/team/program-year scoped, case-insensitive unique name, RLS mirroring mig
  071). **DEV-APPLIED; ⚠ PROD-PENDING** (apply to prod at release before promoting code).
  DATA_DICTIONARY + dev/prod snapshots refreshed in the same unit of work (watermark #159).
- Service-role db layer (`getRepTeamLineupTemplates` / `create…` / `delete…`) + two coach-guarded
  API routes (`lineup-templates` GET+POST, `[templateId]` DELETE); per-season cap 50, dup-name 409.
- On load, maps by current roster `player_id`, **silently skips** players no longer rostered
  (notice reports how many), fills the editable grid (unsaved; confirm-before-overwrite).
  /review-passed (high-risk funnel; security/multi-tenant fully clean; 3 doc/copy fixes applied).

## Sequencing rationale
P1–P3 ship value with **no schema change**; the only migration (templates) is last. Each
phase is independently shippable and `/review`-able. P1 (checks/fairness) and P2
(auto-generate) are the biggest coach wins.

## Future stats readiness (owner question 2026-06-28)
Goal: don't foreclose future analytics like "W/L with this lineup" or "W/L when player X
starts at pitcher."
- **Keep it normalized + ID-linked.** Results live as structured columns on `rep_team_events`
  (home/away score, result). Lineups link event → player → positions; attendance links
  event → player. These joins already answer the example questions.
- **Caveat:** per-inning positions are a JSONB map on `rep_team_lineup_entries` — fine for
  app read/write and light queries (add an expression/GIN index if needed). For heavy
  per-inning analytics, add a **derived "appearances" table** (player × event × inning ×
  position) computed from the JSONB — additive, not a rebuild.
- **Plan vs actual:** a lineup is the *planned* assignment. True game stats (at-bats, hits,
  innings actually pitched) belong to a **future stats module** with its own normalized tables
  keyed by event_id + player_id — do NOT overload the lineup data with stats.
- **Phase 4 templates** stay clean/ID-keyed (player_id references), so they don't pollute the
  analytics surface.
- **`/dba` review DONE 2026-06-28** — DB_ARCHITECTURE_REVIEW.md findings #27–29: model is sound,
  no rebuild; lineup JSONB fine at team scale (defer any index); future game-stats go in their
  own `(event_id, player_id)` leaf tables (do NOT overload lineup/event); Phase-4 templates =
  new dedicated table (program-year-scoped V1), not the event-bound `rep_team_lineups`.
- **Related (Finding #27, High):** rep game scoring is home/away-labelled but team-relative in
  practice (away games can record backwards; home/away splits unreliable). Fix to explicit
  `team_score`/`opponent_score` + keep `home_away` as a context tag. Cheap now (pre-launch,
  ~0 real rows). Owner decision pending: do it as a small standalone scoring fix vs. fold into
  the lineup build.

## Out of scope (future toggles)
- Pitcher innings-pitched cap warnings (league-dependent).
- Per-cell "lock" pins (Fill-empty-only already covers the common case).
- Mobile per-inning entry view (handled in the portal-wide mobile pass; PDF covers the
  dugout need in the meantime).
