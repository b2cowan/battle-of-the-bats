# Bracket Builder — Inline Edit Mode (manual editing on the main screen)

**Status:** PLANNED 2026-06-12 · `feat/free-tier-coaches` · supersedes the modal-based manual builder.
**Roadmap parent:** [BRACKET_BUILDER_TIER_UX_PLAN.md](BRACKET_BUILDER_TIER_UX_PLAN.md) (this is its headline initiative).

## The redirect
Move **manual bracket editing out of the modal and onto the main Schedule screen.** The modal exists **only** for
**auto-generation (Tournament Plus)** — it shows all config options + an **uneditable preview** and generates. After
that, *all* editing — free or post-auto-generate — happens in **one inline canvas editor** on the main screen.

## Target UX (decided)

### Two modes on the playoff content area
- **View mode (default):** the existing read-only renderers — **Bracket** (`PlayoffBracketView`/`BracketColumns`),
  **List** (`GameList`), **Timeline**. Game cards keep **delete** (quick) + **edit** (pencil → enters Edit mode). A
  prominent **"Edit Bracket"** button is the primary entry. The top **"Add Game" button is HIDDEN in playoffs** (it is
  the buggy single-add path) — games are added in the editor.
- **Edit mode:** the **canvas (`BracketBuilder`) rendered INLINE** (not a modal), loaded with the current bracket. A
  sticky edit bar: `Editing bracket · <live health> · [Cancel] [Save bracket]`. Add/remove rounds & games, wire
  Seed/Winner/Loser (single-use), set dates/times/teams/venues — all **draft/local** until Save.

### Saving = draft + explicit Save/Cancel, persisted as a DIFF
- Edits accumulate in canvas state (`preview`); nothing persists until **Save**.
- **Save** → validate whole bracket (ordering via `findBracketSchedulingViolations`, single-use already enforced) →
  **diff-persist**: games matched by `sourceGameId` are **updated** (preserves id + scores of completed games), new
  matchups are **created**, removed matchups are **deleted** (only if replaceable — scheduled/non-locked). Atomic.
- **Cancel** discards. An **unsaved-changes guard** intercepts view-switch / division-switch / navigation.
- Rationale: brackets have cross-game dependencies + whole-bracket validation; mid-edit states are normal and must not
  persist or error. One commit point = build freely, validate once, save atomically, back out cleanly. (Autosave
  rejected for those reasons.)

### One editor for all views
- List / Timeline / Bracket are **view-only**. **Edit** from any of them → the **same inline canvas** (the single best
  surface to see structure + wiring + per-game scheduling). Save/Cancel returns to the originating view. While editing,
  the view toggle is replaced by an "Editing" indicator.

### Auto-generate (Plus) modal
- Keeps all config (format/crossover/teams-advancing/auto-schedule) + a **read-only preview** (reuse `BracketColumns`,
  not the editable canvas). **Generate** creates the bracket → closes → View mode. Post-generate tweaks → "Edit
  Bracket" → the inline canvas. The modal no longer edits.

## What's required (architecture)

| Piece | Detail |
| --- | --- |
| **Inline `BracketEditor`** | Extract `ManualBracketBuilder`'s body (starter controls when empty + `BracketBuilder` canvas + Save/Cancel + live health) into an inline panel rendered in the page content area when `editingBracket` is true (replaces the view renderers). |
| **Load existing → canvas** | New `gamesToCanvasPreview(divisionPlayoffGames)`: group via the shared `buildBracketColumns`/`bracketRoundInfo`, emit `templatePreview` rows `{ round, code, home, away, date, time, venueId, venueFacilityId, sourceGameId: game.id }`. The canvas already threads `sourceGameId`. |
| **Diff save (server)** | New **free** `save-bracket` POST action on `/api/admin/games`: body = `{ divisionId, tournamentId, games:[{ sourceGameId?, ... }] }`. Server diffs: `sourceGameId` present → UPDATE (keeps scores); absent → INSERT; existing division playoff game whose id ∉ submitted sourceGameIds → DELETE only if scheduled/non-locked (`validateReplaceablePlayoffRows`), else keep + warn. Gated `playoff_manual` (free). Atomic. (Service-role — client can't write `games` directly; see [[project_playoff_bracket_builder_ux]].) |
| **Page state + toolbar** | `editingBracket` bool + `returnView`. "Edit Bracket" enters; Save/Cancel exits to `returnView`. Hide top "Add Game" when `viewMode==='playoff'`. Hide the List/Bracket/Timeline toggle while editing (show Editing + Save/Cancel). Unsaved-changes guard. |
| **Retire the manual modal** | `ManualBracketBuilder` modal removed; its logic lives in the inline `BracketEditor`. The free "Build Bracket" (empty) and "Edit Bracket" (existing) both enter the inline editor — Build seeds a starter round, Edit loads existing. |
| **Wizard → preview-only** | `PlayoffWizard`: swap the editable `BracketBuilder` for a read-only `BracketColumns` preview; drop in-modal editing; keep config + `executeCreate`; `onComplete` lands in View (not edit). |
| **Round-naming fix** | Manual `R{n}-{m}` codes render as "Round of {n}" via `bracketRoundInfo` (the "ROUND OF 2 / ROUND OF 1" oddity). Add a sequential-round interpretation (e.g. "Round 1/2/3" or auto SF/FIN by depth) so View ↔ canvas agree. |

## Phases
> **Status:** P1 + P2 + P3 **BUILT 2026-06-13** on `feat/free-tier-coaches` (dev only, no migration; typecheck clean, 91 bracket unit tests, two adversarial reviews folded). P2 + P3 **browser-verified**. Initiative complete pending final sign-off.

1. **P1 — inline editor core.** ✅ BUILT `BracketEditor` inline; `gamesToCanvasPreview` load; `save-bracket` diff action; Save/Cancel + unsaved guard; hide playoff "Add Game"; "Edit Bracket" + "Build Bracket" entries; per-game **edit** pencil → edit mode, **delete** → quick delete. (Free; the heart of the redirect.)
2. **P2 — wizard preview-only (Plus).** ✅ BUILT — extracted `buildBracketColumns`/`BracketColumns` into shared `components/BracketColumns.tsx` (`readOnly` prop hides edit/delete); wizard renders the read-only preview (split-pool/tiered grouped) instead of the editable canvas; in-modal add round/matchup + slot dropdowns gone; a `useEffect` mirrors `templatePreview`→`preview` so `executeCreate` save is unchanged; post-generate lands in View (page `onComplete` never enters edit mode). `BracketBuilder.tsx` retained (still used by the inline `BracketEditor`).
3. **P3 — polish.** ✅ BUILT — live `BracketHealthPanel` in the inline editor (min-rest from the org's `healthRules`); List-view playoff rows gain an "Edit in bracket" entry (collapsed-row icon + expanded-footer button) that opens the canvas via `enterBracketEditor(gameId, divisionId)` → `BracketEditor.focusGameId` → `BracketBuilder.focusSourceGameId` (opens + scrolls that matchup). Mobile canvas touch polish. **Round-naming was already fixed in P1** (`bracketRoundInfo` `R{n}-` interpretation). **Timeline deliberately stays drag-to-reschedule** — its canvas entry is the toolbar "Edit Bracket"; inline List quick-edit (date/time/venue) is preserved (the canvas path is additive, non-regressing).

## Risks / decisions
- **Score preservation is the crux** — the diff save must UPDATE completed/locked games in place (never delete+recreate) and only DELETE removed *scheduled/non-locked* games. The `save-bracket` action owns this; reuse `validateReplaceablePlayoffRows`.
- **Loading direct-team games** (no placeholder) into the canvas — represent the team as the slot label; keep `sourceGameId` so it round-trips.
- **Unsaved-changes guard** scope: view toggle, division dropdown, tournament switch, route nav.
- **No migration.** All columns exist; new behavior is an API action + UI.
- Open product decisions tracked in the roadmap's "Open questions" (esp. venue/date optionality, which folds in here as "TBD games are valid drafts").

## Verification (when built)
typecheck/lint, the playoff-bracket unit tests, plus browser: build → save → edit (load) → add/remove/retime → save preserves a completed game's score → cancel discards → auto-generate (Plus) shows read-only preview → post-gen Edit works. Free-tier login `free-owner@dev.local` / `devpass123`.
