# Build prompt — Phase 3: resolve the existing typed names (admin-reviewed, reversible)

**For:** a new chat. Build Phase 3 of `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md`.
**Status:** planned, **not built**. Phases 1 ✅ (`f8ac4503`), 4 ✅ (`240e8fbf`, house league) and
**2 ✅ (`dffce9df` + docs `baf22a82`, 2026-08-10)** are committed on dev.
**No migration.** Phases 1–3 are schema-free by design — see §5 for the one place this bites.

---

## 1 · Read these first

- `docs/projects/active/GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md` — the whole plan. §2 "Phase 3" is
  your checklist; the Phase 1/2/4 sections record what already exists so you don't rebuild it.
  **§0 corrects premises that look true and are not** — trust it over any earlier framing.
- `docs/projects/active/GAME_LOCATION_SOURCE_OF_TRUTH_PM_BRIEF.md` — owner framing + all rulings.
- `lib/venue-identity.ts` — the ONLY answer to "same surface?". Its header explains why typed text
  never matches a structured reference silently — **deciding that a string names a record is
  exactly this phase's admin-reviewed job.**
- `lib/tournament-venue.ts` + `lib/tournament-venue-selection.ts` — Phase 2's rail: the ONLY way a
  venue reference gets onto a tournament game. **Every conversion this phase makes goes through
  it** (it validates tenancy and derives the display string, so venue + surface + text always land
  together — plan §2's "never introduce mixed granularity" requirement is free if you use it).
- Commit `dffce9df` — Phase 2, for the patterns you are extending. Especially:
  `buildLocationTokenIndex` / `resolveLocationCell` in `lib/import/tournament-schedule.ts` (the
  exact-match token index: trim + case-fold via `normalizeToken`, punctuation flattened so legacy
  hyphen labels equal live em-dash labels, ambiguity = no match, placeholders = no candidate).
  Phase 3's matcher is the same rule over EXISTING rows — extract/share, don't reinvent.

## 2 · What Phase 3 is, in one breath

Phases 1–2 made typed names *checked* and stopped new ones being *created*. Phase 3 cleans up the
ones that already exist: a per-tournament review screen that says **"9 games say 'Diamond 1' — is
that [Diamond 1 ▾]?"**, where an admin confirms each distinct string → field match (or creates the
field from the string, or leaves it as text). Nothing is ever auto-applied. After a pass, the
tournament's `venue_unchecked` count and health coverage visibly improve — that is the point and
the QA signal.

## 3 · The work (from the plan, with what Phases 1–2 learned added)

1. **A per-tournament resolve screen.** One row per DISTINCT normalized string (not per game),
   with its game count, a field picker pre-suggesting the exact match when one exists, an explicit
   **Leave as text** choice, and **Create "<string>" as a new field** (the honest fix for Bye Demo
   / Free Cup, which have zero venues — creation goes through the existing venues API, which
   Phase 2's review hardened; `add-facility` now derives `tournament_id` from the parent venue).
   Where it lives (schedule page? venues page? a health-panel deep link from the
   `venue_unchecked` finding?) is a design decision — **mockups required, published as a Claude
   Artifact, elements tagged NEW/RESTYLED/UNCHANGED** (house rule; mockups ARE the spec).
2. **Matching is exact only** — trim + case-fold, the `normalizeToken` rule (punctuation
   flattened). Match against venue names, unique facility names, and combined labels. Ambiguous →
   no suggestion, admin picks by hand or leaves text. **No fuzzy, no cross-tournament, no
   auto-apply** (binding, plan §4.2).
3. **Every conversion writes through the Phase 2 rail** (`resolveVenueSelectionFromCatalog` /
   PATCH-equivalent server path), so venue + surface + derived em-dash label land together.
   ⚠ Bulk conversion of N games should be ONE server action per string (not N client PATCHes) —
   but resolve venue columns for the whole batch BEFORE the first write (Phase 2's review caught
   the half-written-batch failure in `save-bracket`; don't repeat it).
4. **Exclusions the screen must respect:**
   - **Placeholders are not candidates** (R2: `TBD`/`TBA`/`N/A`/… mean *no field*). Either leave
     them out entirely or offer only "clear to no field" — they must never convert to a field.
   - **Lane-tethered games are not candidates** — a game with a `schedule_facility_lane_id` and no
     venue belongs to the Resolve Facilities panel, not this screen (Phase 2 made an explicit
     venue pick DETACH the lane; this screen shouldn't silently do that wholesale).
   - **Played/scored games:** decide and state whether they convert (location is display-only for
     them; converting is probably fine and desirable — but say so, don't drift into it).
5. **Reversible — design decision to surface EARLY (with the PM summary).** The plan says "record
   what was converted so a wrong guess can be undone", but Phases 1–3 are migration-free, so there
   is no new audit table to write to. Realistic options: (a) an undo window in the UI backed by
   the session's own record of before-values (cheap, honest, session-scoped); (b) reuse an
   existing structure (the import system's batch/preview records already persist normalized
   before/after rows — check fit before proposing); (c) accept "reversal = re-type the text"
   since the original string IS the suggestion label and conversions are per-string deliberate
   acts. Put the options to the owner with a recommendation; do NOT quietly add a table.
6. **Notifications must stay silent.** Phase 2 made "game moved" judged on structured refs
   (`lib/schedule-change-classify.ts`) — but a conversion CHANGES the refs (none → venue), which
   classifies as a move! **A data-tidying conversion must not message families.** Route the bulk
   conversion through a server path that skips `recordGameScheduleChanges` (the import commit path
   already writes venue columns without notifying — follow that precedent), and pin it with a
   test. This is the single most likely way this phase pages a customer's families by accident.
7. **Re-measure before/after** on live dev (`node scripts/db-query.mjs --dev`): the four fixtures
   (Battle of the Bats 108 rows / 1 venue / 4 surfaces; Bye Demo 21 / zero venues; Free Cup 18 /
   zero venues; Crimson Cup 12 / 1 venue / 2 surfaces; 9 distinct strings total). Run the flow on
   them as the acceptance test. **Prod needs nothing** (83/83 games already referenced) — the
   feature ships for future customers, not for a prod backfill.

## 4 · Binding decisions you inherit (do not re-litigate)

- Exact match only; typed text never silently becomes a reference; admin confirms every match.
- `location` is server-derived from the picked venue — one em-dash formatter
  (`formatVenueLocation`); conversions never hand-write the string.
- A false clash blocking legitimate work is the worst failure; second-worst is silently moving a
  game to the wrong field — which is precisely why nothing here auto-applies.
- R1: no announcements; every screen explains itself to someone seeing it cold.
- R2: placeholder text = no field set (list lives in `venue-identity.ts`).
- Naming: setup-level copy says **"venues"**; the sport noun (via `fieldNounFor()` in
  `lib/sports.ts`) appears wherever an actual playing surface is picked (owner ruling 2026-08-08).

## 5 · Hard constraints

- **No migration, no dictionary change** — including for the reversibility record (§3.5).
- Multi-tenant: the resolve screen and its server action must trace to a single-tournament fetch;
  use the rail's catalog (it 400s foreign ids). Matching never crosses tournaments.
- Concurrent sessions share this tree: re-check the branch before committing, stage **explicit
  pathspecs only** (`[orgSlug]` dirs need `:(literal)`), verify with `git show --stat HEAD`.
  ⚠ At the time of writing, another session owns uncommitted edits to the demo-checker script,
  drift snapshots, UAT scorekeeper specs, and the scorekeeper-mobile plan docs — leave them.
- Demo sandbox: `riverdale-minor-ball` has 30 games, all referenced — the resolve screen will show
  it EMPTY, which is correct; check the tour/dock copy anyway and run `npm run check:demos`.
  ⚠ The coach-sandbox attendance drift in `check:demos` pre-dates all of this and belongs to
  another session — do not chase it.
- `npm run typecheck` (shared modules), full tests, `npm run verify:changed` before handoff.
- Migs 229 (dev-only) and prod promotion remain owner decisions — nothing schema-side.

## 6 · Before you build

Per `AGENCY_RULES.md`, a **plain-language PM summary is a blocking step**, presented and agreed
before code — put §3.5's reversibility options (with a recommendation) in the same message, and
follow with **mockups as a Claude Artifact** for approval before building (build the whole phase
in one pass once approved). Offer `/simplify` then `/review` when done (data-touching bulk write =
high-risk tier), then `/docs` (the new screen + the "not being checked" story changes the
tournament guide — Phase 2 added `#faq-double-booked-field` / `#faq-offsite-game-location`;
extend, don't duplicate). Add the QA notes as a new section in
`docs/projects/active/OWNER_QA_LEDGER.md` (follow Group 2E/§9's shape; check `git status` first —
the ledger may carry other agents' uncommitted edits).

## 7 · What "done" looks like

- An admin can review every distinct typed name in a tournament, confirm matches, create missing
  fields, or deliberately leave text — nothing converts without their click.
- Conversions write venue + surface + derived label together, notify nobody, and are recoverable
  per the agreed reversibility mechanism.
- The four dev fixtures come out clean (or deliberately left as text), and their
  `venue_unchecked` counts / health coverage move accordingly — measured before and after.
- Placeholder and lane-tethered games never appear as convertible.
- Prod is untouched and needs to be.
