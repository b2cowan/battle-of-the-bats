# Bracket Builder — Free vs Paid Tier UX Improvements

**Status:** PLANNED 2026-06-12 · roadmap (nothing built yet) · `feat/free-tier-coaches`.
**Builds on:** [PLAYOFF_BRACKET_BUILDER_UX_PLAN.md](PLAYOFF_BRACKET_BUILDER_UX_PLAN.md) (the manual-vs-auto split that
shipped). This plan is the forward-looking UX polish for the two tier experiences.

## Where we are

- **Free (all tournament tiers)** — `ManualBracketBuilder` modal: *Seed first round (top N)* or *Start empty* → a
  canvas to add rounds/matchups by hand; each side picks **Seed #N / Winner-of / Loser-of** an earlier game
  (single-use — a wired ref disappears from other dropdowns); connector **lines** draw as you wire; new games start
  **unscheduled**; Save is blocked if a dependent game sits on/before its feeder. Existing brackets are managed via
  per-game edit/delete + a **Clear Bracket** toolbar button.
- **Paid (Tournament Plus+)** — `PlayoffWizard` **Auto-Generate Bracket**: pick a format (single/double/consolation/
  placement) + crossover + teams-advancing → generates the whole bracket; optional **auto-schedule optimizer** +
  Bracket Health panel. Locked + upsell for free.

The tier split itself (manual = free, auto-generate + auto-schedule = Plus) is **decided and out of scope** here.

> **★ Lead initiative (owner-directed 2026-06-12): move manual editing onto the main screen.** Manual bracket editing
> leaves the modal and becomes an inline **View ⇄ Edit** mode on the Schedule screen; the modal exists **only** for the
> Plus auto-generator (config + uneditable preview). One inline canvas editor serves all views (List/Bracket/Timeline);
> Save is a score-preserving **diff**. This supersedes/absorbs P0 #1 (Edit Bracket reload) and reshapes #4 (tier
> labels). Full design + architecture: **[BRACKET_BUILDER_INLINE_EDIT_PLAN.md](BRACKET_BUILDER_INLINE_EDIT_PLAN.md)**
> (+ `_PM_BRIEF`). The remaining P0s below (optional venue/TBD, read-only violation badges, live free health) ride
> along with it.

## P0 — ship-soon, highest leverage

| # | Improvement | Tier | Effort | Why |
| - | --- | --- | --- | --- |
| 1 | **"Edit Bracket"** — reopen the canvas pre-loaded with the existing bracket (add/remove rounds, reseed) and atomically replace on save, instead of forcing Clear + rebuild | Free | M | Unblocks iteration — today you can only tweak one game at a time or nuke the whole thing |
| 2 | **Optional venue / TBD** — drop the hard-required Venue flag for playoff games; save with no venue; show **TBD** in list/bracket views (matches date/time TBD) | Free | S | Removes the structure-first blocker the owner hit; unscheduled games don't conflict anyway |
| 3 | **Badge ordering violations in the read-only bracket view** — `findBracketSchedulingViolations` already exists; render a non-blocking ⚠ on any game scheduled before its feeder | Free | M | Prevents silently publishing a broken bracket (save-time block only catches it in the builder) |
| 4 | **Honest tier labelling** — rename "Build Bracket" → **"Build Bracket Manually"**; show **"Auto-Generate (Tournament Plus)"** as a distinct, pre-announced action; in-context scope hint ("single/double/consolation + crossover, auto-schedule") | Both | S–M | Makes the split legible so free users aren't confused and the paid value is obvious |
| 5 | **Live "Bracket Health" in the free builder** — a lightweight panel under the canvas: unscheduled count, missing/circular feeders, ordering violations, updating as you edit (structural only — no rest/conflict metrics, which stay Plus) | Free | M | Real-time feedback + teaches best practice; no save-time surprises |

## Themes & full item list

### Theme A — Free manual builder: complete & discoverable
Make the free builder feel like a *full* feature, not a lite version of paid.
- **P0** Edit Bracket reload (item 1 above).
- **P0** Optional venue / TBD (item 2).
- **P1** Live Bracket Health panel (item 5).
- **P1** Clarify free vs Plus entry points (item 4; shared with Theme B).
- **P2** Inline single-use feedback — show "already wired" / an "N refs" badge on a game card so the single-use model is visible.
- **P2** Resolve **Seed #N → team name** on playoff-only events (the `labelFor` prop already supports it; extend to the canvas card + Add Game pickers).

### Theme B — Tier boundary: honest & teachable
Surface the split at the right moments without nagging.
- **P0** Pre-announce auto-generate scope on the "Auto-generate instead" button/tooltip ("Tournament Plus — single/double/consolation + crossover").
- **P1** **Post-Clear upsell** — after Clear Bracket, a toast: "Bracket cleared. Rebuild fast with Auto-Generate (Plus)".
- **P2** **"Games on canvas: N"** counter; at N≥4 a gentle "save time with Auto-Generate?" nudge (also an upgrade-intent analytics signal).
- **P2** Free-tier completeness subheading in the builder header ("Free · manual structure, scheduling & wiring — no auto-generation").

### Theme C — Read-only bracket view: surface issues & quick fixes
- **P0** Badge scheduling-order violations (item 3).
- **P2** Distinct **UNSCHEDULED** styling/badge for games with no date/time/venue (draw the eye to incomplete games).
- **P2** **Bracket status** chip in the toolbar ("3 rounds · 7 games · 0 errors", warning if violations).

### Theme D — Plus: post-generation flexibility
Plus organizers who auto-generate usually want to tweak.
- **P1** **Edit an auto-generated bracket on the canvas** — open `BracketBuilder` pre-loaded (games carry `sourceGameId`); a "lock structure & re-run auto-schedule only" toggle; (later) partial regen of one round.
- **P1** **"Keep this game" lock affordance** — a visible Lock toggle on game cards so locked games are excluded from re-optimization; show the locked count in the health panel.
- **P1** **Regenerate vs Build preview** — before committing a regen, a clear two-column "replace all (deletes Y) vs build-from-current (adds Z, keeps locked)" confirmation to prevent accidental overwrites.

### Theme E — Mobile & canvas UX
- **P1** Verify the canvas on iOS/Android — pinch-zoom, pan vs long-press drag-reorder conflicts (dnd-kit sensors), dropdown tap/scroll; add platform hints.
- **P2** Larger drag handles, native `<select>` on mobile, auto-scroll-into-view when editing edge games.

### Theme F — Workflow & lifecycle polish
- **P2** Success toast after save ("Bracket saved — 8 games created").
- **P2** Extra **starter templates** (8-team single-elim, 4-team + 3rd place, 16-team + consolation stub) — structure-only, skips repetitive round creation.
- **P2** Group Winner/Loser dropdown options **by round** as brackets grow.
- **P2** Live seeding hint under the "teams in first round" stepper ("8 teams → 1 v 8 …, 2 byes").

## Open questions (owner decisions)

1. **Edit Bracket reload** — build the reopen-loaded-canvas flow (P0 #1), or is per-game edit + Clear/rebuild enough for v1?
2. **Venue/date optionality** — fully optional for all playoff games, or optional-with-a-soft-"unscheduled"-warning? (UX friction vs data quality.)
3. **Upsell aggressiveness** — surface the auto-generate upsell at every friction point (Clear, 4+ games, etc.) or only at major transitions?
4. **Auto-gen → canvas editing (Plus)** — make generated brackets immediately editable on the canvas, or require an explicit "Edit" to avoid accidental changes?
5. **Free health depth** — keep free Bracket Health purely structural, or tease the Plus rest/feasibility metrics (read-only) as an upsell?
6. **Mobile dropdowns** — native `<select>` on phones (simpler, a11y) vs tuning dnd-kit touch sensors so drag + pan + dropdowns coexist?

## Suggested first slice (Phase 1 = the P0 set)
Items 1–5 above (Edit Bracket, optional venue/TBD, read-only violation badges, honest tier labels, live free Bracket
Health). All build on existing pieces (`findBracketSchedulingViolations`, the canvas, the service-role games API) — no
migration. Pending owner rulings on the open questions, especially #1 and #2.

_Source: 4-lens UX brainstorm (free journey / plus journey / tier boundary / mechanics-lifecycle) → synthesis,
2026-06-12. 46 raw ideas → these themes._
