# Build prompt — Phase 2: stop new drift at the authoring surfaces (tournament side)

**For:** a new chat. Build Phase 2 of `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md`.
**Status:** planned, **not built**. Phases 1 ✅ (`f8ac4503`) and 4 ✅ (`240e8fbf`, house league)
are committed on dev; Phase 3 (resolve existing typed names) deliberately comes AFTER this.
**No migration.** Phase 2 is pure code — if you find yourself wanting a schema change, stop; that
is not this phase.

---

## 1 · Read these first

- `docs/projects/active/GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md` — the whole plan. **§0 corrects two
  premises that look true and are not**; trust it over any earlier framing. Phase 2's checklist is
  §2 "Phase 2"; the Phase 1 and Phase 4 sections record what already exists so you don't rebuild it.
- `docs/projects/active/GAME_LOCATION_SOURCE_OF_TRUTH_PM_BRIEF.md` — owner framing + all rulings.
- `lib/venue-identity.ts` — read the header. It is the ONLY answer to "same surface?". Phase 2
  does not touch it and does not re-derive venue keys anywhere.
- Commit `f8ac4503` (Phase 1 — the checking gap) and `240e8fbf` (Phase 4 — house league) for the
  patterns you are extending, not inventing.

## 2 · What Phase 2 is, in one breath

Phase 1 made the product *say* when a schedule can't be checked. Phase 2 makes typed field names
**stop being created** on the tournament side: picking a real field becomes the default authoring
path everywhere a tournament game gets a location, the display string becomes something the server
derives rather than something a person types, and the surfaces that accept text (import) resolve
what they can and *report* what they couldn't. This is what dries up the `venue_unchecked` count
at its source — Bye Demo's 21 and Free Cup's 18 text-only games exist because those tournaments
have **zero configured fields** and the UI silently accepted typed text anyway.

## 3 · The work (from the plan, with what later phases learned added)

1. **One server-side formatter, write-through everywhere.** Generalize the lane-resolution logic
   (`app/api/admin/schedule-facility-lanes/route.ts:238` — already the best-behaved writer) into a
   single helper that derives the display string from venue+surface and writes it through on every
   write path that sets a venue on `games` (`app/api/admin/games/route.ts` — multiple write sites;
   find them all, don't trust the line numbers in the plan). After this, `games.location` cannot
   disagree with the reference.
   ⚠ **Format decision, already half-made:** Phase 4's league formatter and `lib/venue-label.ts`
   both render `Venue — Facility` (em dash); the lane route writes `Venue - Facility` (hyphen).
   Unify on the em dash and route the lane writer through your new helper — one formatter, one
   string, everywhere.
2. **Picking a field is the default path** in the game editor, schedule builder, timeline and
   bracket builder (`GameList.tsx`, `ScheduleTimeline.tsx`, `BracketBuilder.tsx`, the Add/Edit
   game modal in `schedule/page.tsx`). Free text remains, as the explicit "off-site / not a
   configured field" choice — mirror Phase 4's `FieldPicker` interaction ("Somewhere else (type
   it)"), but build the tournament version against tournament venues (`diamonds` /
   `venue_facilities`), NOT the org library.
3. **Fix the parked defect: a venue cannot be cleared from the inline row editor.** Phase 1's
   review found emptying the venue dropdown in the inline schedule row is a silent no-op (the API
   skips absent fields), and explicitly deferred the fix to Phase 2. Give the inline row a real
   clear path, with explicit-null semantics — Phase 4's PATCH route (`schedule/[gameId]/route.ts`
   on the league side) shows the pattern.
4. **A tournament with zero configured fields gets prompted to create them** instead of silently
   accepting text — this is the Bye Demo / Free Cup failure. Also: such a tournament currently has
   no timeline columns at all (noted in Phase 1's "deliberately not done").
   ⚠ **Open question to put to the owner early (plan §4, "still open"), with new context:** the
   org venue library (`org_venues`) is now load-bearing — Phase 4 made it house league's one field
   source, and tournaments already carry import-from-library provenance columns. For **League/Club
   orgs**, should the "create your fields" prompt lead with *import from your Venue Library*?
   (Tournament-tier orgs don't have the library — plan-gated — so they get plain create.)
   Recommend yes; get the ruling before building that prompt.
5. **Bulk import keeps accepting text** (it parses third-party files), but resolves on **exact
   match** (trim + case-fold, nothing fuzzier — ruling) against the tournament's fields and
   **reports** unresolved names in the import summary. Both import passes
   (`lib/import/tournament-schedule.ts` + `-commit.ts`) — Phase 1's `/simplify` found these two
   drifting apart once already; whatever you add, add through shared code.
6. **Scorekeeper field filter** lists the fields the day's games are actually on — so an unused
   venue doesn't pad the list and a typed-only game isn't invisible
   (`app/api/official/[orgSlug]/score/get-score.ts`).
   ✅ CLOSED 2026-08-10 as fixture timing (the seeder had no venues until the day of the report), so
   this was never a defect. Kept for the record. Related but SEPARATE: the volunteer's empty "All fields" dropdown is a **different defect**
   (plan §0.2 / Phase 0) — do not claim this fixes it.
7. **Sport-neutral labels throughout** — the surface noun comes from the Sport Pack
   (`getSportPack(...).defaultFacilityType` → `FACILITY_TYPE_LABELS`), never hard-coded. Phase 4's
   page shows the pattern.

## 4 · Binding decisions you inherit (do not re-litigate)

- `location` stays a column, demoted from authored to **server-derived** (plan §0.7 / §3).
- Trim + case-fold only; **no fuzzy matching**; typed text never silently becomes a reference —
  converting existing strings is Phase 3's admin-reviewed job. Import's resolve-on-exact-match is
  the ONE sanctioned auto-resolution, and it must be exact.
- A false clash blocking legitimate work is the worst failure — every blocking behavior you add
  must be justified against that.
- R1: no announcements; every new warning must explain itself to someone seeing it cold.
- R2: TBD/TBA/placeholder text = no field set (the placeholder list lives in `venue-identity.ts`).

## 5 · Hard constraints

- **No migration, no dictionary change.** Phases 1–3 are schema-free by design.
- Multi-tenant: anything you add to the conflict/resolution paths must trace to a
  single-tournament fetch — Phase 1's review proved every current caller does; keep it true.
- Demo sandboxes: `riverdale-minor-ball` (30 games, all referenced) runs the REAL product —
  Phase 2 changes a tournament authoring flow, so re-read the demo's tour/dock copy about the
  schedule screens, adjust in the same unit of work if needed, and run `npm run check:demos`.
- One shared `dev` branch; explicit pathspecs only; `[orgSlug]`/bracket dirs need `:(literal)`.
- `npm run typecheck` (shared modules), full tests, `npm run verify:changed` before handoff.
- ⚠ Migration 229 was applied to **dev only** when this prompt was written; it **reached prod 2026-08-10** (verified live). At the time it was
  mig 226 is applied nowhere. Neither concerns Phase 2 — but do not "helpfully" apply or widen
  anything schema-side.

## 6 · Before you build

Per `AGENCY_RULES.md`, a **plain-language PM summary is a blocking step** — what a tournament
organizer sees and does differently — presented and agreed before code. Then build the whole phase
in one pass. Resolve §3.4's owner question early, in the same message as the PM summary.

Offer `/review` when done (shared scheduling logic + import = high-risk tier), then `/docs`
(the tournament help guides describe scheduling and import flows — they will drift), and log the
QA notes as a new section in `docs/projects/active/OWNER_QA_LEDGER.md` (Phase 4 added Group 2D/§8
on 2026-08-08 — follow that shape; ⚠ the ledger may carry other agents' uncommitted edits, check
`git status` before writing).

## 7 · What "done" looks like

- Authoring a tournament game without a real field takes a deliberate extra choice, everywhere.
- A tournament with no fields is asked to create them (League/Club: offered its library, if ruled
  yes) the first time someone schedules.
- The inline row can genuinely clear a venue.
- An import tells the organizer exactly which field names it couldn't match, and nothing it
  couldn't match blocks the file.
- The scorekeeper's filter reflects the day's reality.
- The `venue_unchecked` count on a NEW tournament, authored normally, is **zero** — because the
  path of least resistance now produces references.
