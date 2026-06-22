# Bracket Graph-Layout — Implementation Plan

**Status:** ✅ **COMPLETE — DEPLOYED to production** (`origin/master`, 2026-06-19; owner-verified). Column placement follows the Winner/Loser feed graph across admin view, public SVG/HTML, and PDF; legacy/renamed (`G#`) codes render correctly with no data repair. Migration 134 (custom round names) applied to dev + prod. · Created 2026-06-18
**PM brief:** `BRACKET_GRAPH_LAYOUT_PM_BRIEF.md`

## Problem

A playoff game's `bracket_code` does double duty: it drives **wiring** (advancement —
`advancePlayoffs` matches `Winner <code>`/`Loser <code>` placeholders against codes) AND
it is the key every renderer parses to decide which **round column** a game sits in
(`bracketRoundInfo(code)` → `{key,title,rank}`).

Because layout is parsed from the code text, a code that doesn't encode a known round —
a user-renamed `test`, or a legacy `G1..G7` bracket — falls through to a rank-1000
"own column" and the bracket tree scrambles (feeder rendered to the right of the game it
feeds). Wiring still works (the rename cascades the placeholder), but the picture breaks.

Goal: **column placement should follow the Winner/Loser FEED GRAPH (who-feeds-whom),
not the code string.** Then codes become free-text wiring/reference tags; renaming one is
cosmetic and never breaks layout, and legacy `G#` brackets render correctly with no data
repair.

## Current consumers (from the render map)

The grouping loop is **duplicated across 5 surfaces**, all calling the shared
`bracketRoundInfo(code)` per game, plus `gamesToBracketPreview` for the editor:

| Surface | Builder | Fork (WB/LB/GF tiers)? | Single-elim connectors |
|---|---|---|---|
| `BracketColumns.tsx` (admin view + wizard preview) | `buildBracketColumns` (exported) | Yes (CSS fork) | **placeholder-driven** ✓ |
| `LogicSyncBracket.tsx` (public SVG; schedule + standings) | `buildColumns` | Yes (SVG fork) | positional halving |
| `PublicBracketView.tsx` (public HTML) | `buildRounds` | No (flat) | positional halving |
| `bracket-pdf.ts` (PDF export) | `buildColumns` | Yes (paper fork) | positional halving |
| `app/schedule/page.tsx` (internal viewer) | `buildBracketColumns` (local) | No (flat) | decorative stub |
| `gamesToBracketPreview` (editor load) | in `lib/playoff-bracket.ts` | n/a | n/a |

Two distinct mechanisms must change:
1. **Column placement** — parsed from code today → must come from the feed graph.
2. **Public/PDF connectors** — positional `Math.floor(i/2)` halving today → must follow
   the Winner/Loser placeholders (the admin view + all double-elim paths already do this).

Central regression risk: the double-elim **fork** is detected by code sniffing
(`/^LB/`, `/^WB/`). Non-standard codes would silently collapse the fork to a flat row.

## Design

### New shared primitive (pure, testable) — `lib/playoff-bracket.ts`

`computeBracketColumns(games)` → returns, per game id, `{ columnKey, columnTitle, columnRank }`
plus a `layoutMode: 'sections' | 'graph'` flag.

- **`sections` mode** when the bracket contains any recognized multi-section code
  (`WB`/`LB`/`GF`/`CON`/`PL`): return the existing `bracketRoundInfo`-based assignment
  **unchanged**. Double-elim / consolation / placement keep today's exact behavior and
  fork. Zero regression for generator-produced brackets.
- **`graph` mode** otherwise (single-elimination shape, including renamed/legacy codes):
  - Compute each game's **depth** in the feed graph (reuse the fixpoint from
    `nextManualBracketCode`: seeds/teams-only = depth 1; `Winner/Loser` of depth-r games
    = r+1; unresolved/cyclic → depth-1 floor).
  - `columnRank = depth`; group games by depth.
  - `columnTitle` derived by **position from the final**: deepest column with 1 game →
    "Finals"; the column feeding it with 2 games → "Semifinals"; 4 games → "Quarterfinals";
    otherwise "Round {depth}". (Mirrors `bracketRoundLabel`, but from structure not code.)

Connectors are unaffected by mode — they always follow placeholders (once Phase 2 lands).

### Phase 1 — graph-based column placement (admin fully correct)

1. Add `computeBracketColumns` + unit tests (depth, titles, sections passthrough, legacy
   `G#`, renamed `test`, byes, cycles).
2. Refactor the 5 duplicated builders to consume `computeBracketColumns` for key/title/rank
   instead of calling `bracketRoundInfo` per game. Keep each surface's fork-render code; it
   still keys off the same column assignment (and `sections` mode preserves WB/LB keys).
3. Point `gamesToBracketPreview` at the same assignment so the editor loads legacy/renamed
   brackets into the right rounds.
4. Result: **admin builder + saved view + wizard preview + editor** render any bracket
   (renamed, legacy) as a clean tree. Public/PDF **columns** become correct; their
   single-elim **connectors** stay positional (interim — correct for standard brackets,
   imperfect for irregular ones, i.e. no worse than today).

### Phase 2 — placeholder-driven connectors on public + PDF — BUILT dev 2026-06-18

- **Live public fan bracket** (`LogicSyncBracket`, used by public schedule + standings): the
  single-elim connector branch now follows the Winner/Loser placeholders (the same lookup the
  double-elim branch already uses, via the uppercase `nodeByCode`) instead of round-to-round
  halving — so renamed/legacy/irregular single-elim brackets trace correctly. Neutral colour
  preserved (no `kind`), so standard brackets look identical; only accuracy changes. The
  `!hasMultiBracket` guard is kept, so consolation/placement still draw no connectors (unchanged),
  and the double-elim fork branch is untouched.
- **PDF** (`bracket-pdf`): single-elim flips from positional `'halving'` to the existing
  placeholder-driven `'data'` mode; the now-dead `'halving'` branch + type member removed. (Single-
  elim PDF connector lines therefore become green=winner / amber=loser like the double-elim PDF
  already is — a deliberate, minor visual change in the export.)
- **`PublicBracketView`**: dead (no imports) — skipped.
- Verification is visual (connector rendering is JSX/coordinate-coupled — no unit test). typecheck +
  lint clean.

### Phase 2 (original detail) — placeholder-driven connectors on public + PDF

5. Replace the positional-halving connector logic in `PublicBracketView`, the
   `LogicSyncBracket` single-elim path, and `bracket-pdf` halving mode with the
   placeholder-driven approach the double-elim paths already use (look up the feeder by the
   `Winner/Loser <code>` reference, draw to it). 
6. Result: the original prod legacy bracket and any renamed bracket render perfectly on the
   **public fan view and the PDF** too — no data repair needed.

### Out of scope / decisions

- The builder's editable code box **stays** — it's now a cosmetic wiring/reference tag;
  renaming cascades the placeholder (already does) and no longer affects layout.
- `nextManualBracketCode` still assigns canonical `R{n}-` codes to new games, so default
  titles stay pretty; graph mode only kicks in for non-standard codes.
- Double-elim with a hand-renamed WB/LB code is an accepted edge (stays on `sections` path
  by code; a renamed section code could collapse the fork — we keep the code box on
  generator brackets but do not specially guard this rare case in v1).

## Risk register

- **Double-elim fork regression** — mitigated: `sections` mode keeps the exact code path.
- **Public connector rewrite** (Phase 2) — fan-facing; needs adversarial review + browser
  test of single-elim, double-elim, consolation, 3rd-place, and a legacy `G#` bracket.
- **Title edge cases** (byes, odd counts, 3rd-place game) — covered by unit tests.
- **Six call sites, two of them public + one PDF** — stage Phase 1/2, review each.

## Verification

- Unit tests for `computeBracketColumns` (node:test, alongside the 86 existing).
- `npm run typecheck` (shared module) + focused lint.
- Browser: admin Build/Edit + saved view, public schedule bracket, public standings
  bracket, PDF export — each on single-elim, double-elim, and a renamed/legacy bracket.
- Adversarial `/review` after each phase.

## Phase 2a — Custom round (column) names — BUILT dev 2026-06-18

Owner asked: the bracket builder lets you type a column/round name, but it was a dead-end
(canvas-local, discarded on save; the saved view re-derives the name). Now persisted.

- **Storage:** new `games.round_label` (text, nullable) — **migration 134, applied DEV, ⚠ PROD-PENDING**
  (`check:migrations` correctly flags it until applied to prod at release; data dictionary +
  snapshots refreshed, watermark #134). Every game in a column carries the same label, written
  together by the `save-bracket` diff; null = auto-derived name.
- **Render:** `computeBracketColumns` applies `round_label` as a TITLE override (key + rank stay
  structural) — so the custom name shows on the admin saved view, public bracket (LogicSyncBracket
  + PublicBracketView), and PDF automatically (all consume `getGames`, which now maps `roundLabel`).
- **Save:** `BracketEditor` persists a label only when the organizer CUSTOMIZED it (differs from the
  auto-derived title via `computeBracketColumns`) — so untouched rounds stay auto and never freeze.
- **Round-trip:** `gamesToBracketPreview` reads the override via `computeBracketColumns`, so re-opening
  the editor shows the custom name in the (still-editable) round header.
- Single-game create/inline-update leave `round_label` null (auto). Tests: 95 bracket unit tests pass.

## Rollout

Phase 1 first (admin value + columns everywhere), review + browser-verify, then Phase 2.
Phase 2a (custom round names) shipped alongside — needs **migration 134 applied to prod at release**
(`apply-migration-api.mjs … --prod`) BEFORE promoting this code to master, else prod 500s on the
missing column. Once Phase 2 ships, the prod legacy-bracket repair tool becomes optional.
