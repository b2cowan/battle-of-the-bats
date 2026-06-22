# Inline Tiered Bracket Editing — Implementation Plan

**Status:** Phases 0 + 1 + 3 BUILT on `dev` 2026-06-19 (typecheck/dictionary/snapshot green; awaiting browser verification). Phase 2 (manual "split into tiers") is the next checkpoint. A first hotfix shipped earlier — see "Already done".

## Build progress (2026-06-19)
- **Phase 0 — DONE.** Migration 137 `games.bracket_label` applied to dev; threaded through the type, the admin games API (read + bulk-save + create + save-bracket), the shared `lib/db.ts` mappers, and the generator (writes the tier name for tiered/per-pool brackets). Data Dictionary + snapshots refreshed (watermark #137).
- **Phase 1 — DONE (save side).** The inline editor preserves each existing game's own bracket id **and** tier name on save, so edits no longer collapse or un-name tiers. The editor's in-canvas *visual* tier split is deferred to Phase 2 (it needs round-alignment handling shared with the manual-create flow).
- **Phase 3 — DONE.** Public schedule + admin bracket view now split a division's playoff games into separate, titled bracket sections by bracket group (shared `groupGamesByBracketId`), so tiers render as distinct brackets instead of one merged tree. PDF export split is a follow-up (not yet done).
- **Phase 2 — BUILT on `dev` (dev-only, awaiting browser verification).** (2A) The inline editor now loads an existing multi-bracket division as separate, titled tier sections and edits them in place (rank-ordered so different-sized tiers lay out correctly; feed-order + seed dropdowns scoped per tier). (2B) A new "Split into tiers" control in build mode lets any plan seed N tiered brackets from the overall standings (reuses the generator's tier helpers); save assigns each tier its own bracket + name. **Not yet done:** writing `crossover:'tiers'`/`tierConfigs` to `divisions.playoff_config` (games are self-describing — bracket id + label + global seeds — so advancement + diagrams work without it; deferred as a consistency nicety).

**Bracket PDF tier split — BUILT on `dev` (commit c0821fb, awaiting browser check).** The printable bracket now groups by bracket id and prints each tier on its own page (tier name + that tier's champion in the header); a single bracket is unchanged. Plus a **column-layout fix (deployed to prod)**: the bracket diagram engine lays columns by distance-to-final for wired games, so a play-in-fed semifinal sits beside its seeds-only peer instead of a column left (fixes editor + public/admin diagrams + PDF at once).

**Status note:** Planned (Phase 2 remains). A first hotfix has already shipped on `dev` — see "Already done" below.
**Owner agent:** /plan → implementation on `dev`
**Created:** 2026-06-19
**Related:** [PLAYOFF_BRACKET_BUILDER_UX_PLAN.md](./PLAYOFF_BRACKET_BUILDER_UX_PLAN.md), [BRACKET_GRAPH_LAYOUT_PLAN.md](./BRACKET_GRAPH_LAYOUT_PLAN.md), unified bracket engine (`lib/playoff-bracket.ts`)

---

## Problem

"Tiers" (splitting one division's overall standings into N independent brackets — Gold/Silver, Tier 1/Tier 2) can only be created in the **Plus auto-generator** (`PlayoffWizard`). The single manual **inline editor** (`BracketEditor` + `BracketBuilder`) is a single-bracket surface, which causes two reported defects:

1. **Editing a tiered bracket inline collapses the tiers.** Tiers exist only as *distinct `bracket_id`s* on the games (the tiers deliberately reuse the same `bracket_code`s — `R1-1`, `FIN`, … — so the `bracket_id` is the only thing separating them, and the only key `advancePlayoffs` uses to resolve `Winner FIN` within the right tier). The inline editor loads **all** of a division's playoff games into one canvas and, on save, stamps **one** `bracket_id` onto every game → the two-bracket structure is destroyed, codes collide inside one bracket, and advancement cross-wires.

2. **Tiers can't be built by hand.** `BracketEditor` hard-codes `crossover="reseed"`, and the loader `gamesToBracketPreview` drops the per-tier grouping (its rows carry no tier/bracket field). So manual building is single-bracket only.

### Latent gap found during investigation

The **read-only bracket diagrams** (public `components/public/ScheduleContent.tsx`, admin `PlayoffBracketView` in `schedule/page.tsx`) only enter split mode when `pools.length >= 2` **and** placeholders name a pool. Tiered brackets have **no division pools** and use `Seed #N` placeholders, so they fall through to a single merged `LogicSyncBracket`/`buildBracketColumns` over all games. Because `buildColumns`/`computeBracketColumns` group purely by round code (ignoring `bracket_id`), two tiers sharing codes merge/dedupe by code → **auto-generated tiers may already render merged in the diagrams.** This plan fixes that too.

---

## Already done (hotfix on `dev`, 2026-06-19)

`BracketEditor.save()` now preserves each existing game's **own** `bracket_id` (a per-game lookup), so only genuinely-new rows fall back to the single computed id. This stops the destructive collapse for the reported flow (editing existing tiered games — e.g. adding a venue — keeps the tiers). It does **not** make the editor tier-aware (canvas still shows tiers merged while editing) and does **not** add manual tier creation. This plan supersedes/extends it.

---

## Locked decisions (owner, 2026-06-19)

1. **Manual tier building is FREE for everyone.** Manual bracket building is already free (`playoff_manual`); manual tier-splitting joins it. The auto-generate-the-whole-thing convenience stays the Plus upsell (`playoff_generator` / `auto_schedule`). → Verify no Plus gate blocks a free org from writing `crossover:'tiers'` to `divisions.playoff_config`.
2. **Scope = editor AND read-only diagrams.** Fix the inline editor *and* make the public + admin diagrams split tiers into separate titled sections.
3. **Persist the tier name on the games.** Add a per-game `bracket_label` so a tier's display name ("Gold", "Tier 1") survives saves and the diagrams can group + title by it. One migration.

---

## Data model

Tiers/per-pool brackets remain structurally keyed by `games.bracket_id` (one id per tier). We add a **display** field only:

- **New column** `games.bracket_label text NULL` — the display name of the bracket/tier this game belongs to (e.g. `Gold`, `Tier 1`). `NULL` = ungrouped single bracket. Set per-tier for tiered brackets; optionally set to the pool name for no-crossover per-pool brackets (bonus, same mechanism).
- `divisions.playoff_config` keeps `crossover` + `tierConfigs` as the authoritative tier definition. The manual save path will also **write** `crossover:'tiers'` + `tierConfigs` so re-opening the auto-generator and any standings/seed resolution stay consistent with a hand-built split.

`bracket_id` stays the structural/advancement key; `bracket_label` is purely presentational + round-trips through the editor so the grouping is not lost.

---

## Phases

### Phase 0 — Foundation (data model + plumbing)
- Migration `1XX_games_bracket_label.sql` (confirm next number at build time; `136_tournaments_sport.sql` is newest): `ALTER TABLE games ADD COLUMN bracket_label text;`
- `lib/types.ts`: `Game.bracketLabel?: string | null`.
- `app/api/admin/games/route.ts`: read maps include `bracketLabel: g.bracket_label`; `save-bracket` `common` + `bulk-save` insert write `bracket_label`.
- `PlayoffWizard.executeCreate`: write `bracketLabel = p.pool` for tiered (and no-crossover) rows so newly auto-generated tiers carry their name.
- **Schema = dictionary, same unit of work:** update `docs/agents/db/DATA_DICTIONARY.md`, run `npm run refresh:snapshots`, `npm run check:dictionary`.
- Migration is **prod-pending** until release (gated by `check:migrations`).

### Phase 1 — Tier-aware LOAD + DISPLAY in the inline editor
- `lib/playoff-bracket.ts` `gamesToBracketPreview`: emit `pool` (= `bracket_label`) **and** `bracketId` per row; extend `BracketPreviewRow`.
- `BracketEditor` `PreviewRow`: add `pool?`, `bracketId?`.
- `BracketEditor`: detect a multi-bracket division (≥2 distinct `bracket_id`, or any non-null `bracket_label`). When grouped, pass `crossover="tiers"` + `groupOptions` (each tier's global `Seed #N` range, derived from the games' seed placeholders) to `BracketBuilder`, which already renders split brackets by `pool`.
- `BracketEditor.save()`: build a `pool → bracket_id` map (existing games keep their id; new rows in a group inherit that group's id) and carry `bracketLabel` through. Generalises the shipped hotfix from "by source id" to "by group".

### Phase 2 — MANUAL tier creation (build mode)
- Add a "Split into tiers" control to the build-mode starter (currently just *Teams in first round / Seed first round / Start empty*). Reuse the wizard's helpers: `suggestDefaultTiers`, `validateTierRanges`, `addTier`/`updateTier`/`removeTier`.
- On apply: seed each tier (global `Seed #` remap via `remapTierSeed`), tag rows with `pool = tier.name` + a fresh `bracket_id` per tier; render split.
- On save: per-tier `bracket_id` + `bracket_label`; **also** persist `crossover:'tiers'` + `tierConfigs` to `divisions.playoff_config` (divisions API) so the rest of the system + the auto-generator reflect the manual split.
- **Free for all** (no plan gate) per locked decision #1.

### Phase 3 — Read-only DIAGRAM split by tier (public + admin)
- `components/public/ScheduleContent.tsx`: add a bracket-group split path — when there are ≥2 distinct bracket groups (`bracket_label`/`bracket_id`) and it isn't already pool-split, render one `LogicSyncBracket` per group with its `bracket_label` as the section header.
- Admin `PlayoffBracketView` (`schedule/page.tsx`): same — split by bracket group, not only pools.
- Fixes the latent "auto-generated tiers render merged in the diagram" gap.

### Phase 4 — QA / verification (owner browser-tests)
Test matrix:
- Round-robin **and** playoff-only tournaments.
- 2 tiers and 3 tiers.
- Auto-generate tiers → inline-edit a venue/time → tiers survive + advancement still resolves within each tier.
- Build tiers **by hand** from scratch (free org) → saves, displays, advances.
- **Regressions:** single (ungrouped) bracket edits unchanged; no-crossover per-pool brackets unchanged (and, if labelled, split correctly).
- Public + admin diagrams show separate titled tier sections.
- PDF/export bracket output (if it renders brackets) reflects tiers.

---

## Risks & notes
- **Code collisions while editing merged tiers** exist only until Phase 1 splits the canvas; the shipped hotfix already prevents *data* loss in the meantime.
- **Seed-range derivation for `groupOptions`** must read the per-tier global `Seed #N` span from the games; verify for playoff-only (seeded list) vs round-robin (standings) paths.
- **Divisions config write** for `crossover:'tiers'` must not be Plus-gated (decision #1) — verify the divisions API guard.
- **Help-docs sync:** tiers becoming manually creatable + free is a user-facing flow change → run `/docs` for the Schedule/Playoffs guides at build time.
- Single shared `dev` branch; explicit pathspecs on commit.

## Touch list (anticipated)
`supabase/migrations/1XX_games_bracket_label.sql` · `lib/types.ts` · `app/api/admin/games/route.ts` · `lib/playoff-bracket.ts` · `app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx` · `app/[orgSlug]/admin/tournaments/schedule/components/BracketBuilder.tsx` (minor) · `app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx` · `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`PlayoffBracketView`) · `components/public/ScheduleContent.tsx` · `docs/agents/db/DATA_DICTIONARY.md` + snapshots
