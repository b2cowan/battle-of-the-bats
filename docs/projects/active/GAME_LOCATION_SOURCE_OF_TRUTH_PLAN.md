# Game location — one source of truth — Implementation Plan

> **Status:** Planning — nothing built
> **Created:** 2026-08-07
> **Branch:** dev
> **Prompt:** `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN_PROMPT.md` (owner, 2026-08-07)
> **PM brief:** `GAME_LOCATION_SOURCE_OF_TRUTH_PM_BRIEF.md`

## Goal

Make "where is this game played?" a fact the product can act on. Concretely: a double-booked field
is **always** detected, or the product names the games it cannot check and why. The data-model
cleanup (a game references a field; the display string is derived from it) is the means, not the end
— and the evidence below says the cleanup is the *third* priority, not the first.

---

## 0 · Findings that change the prompt's premise

Re-measured against the **live dev and prod databases, 2026-08-07**, per prompt §2.

### 0.1 Production is clean — the 39% is dev fixture data

| | dev | **prod** |
|---|---|---|
| Total games | 410 | **83** |
| Venue reference (`diamond_id`) | 191 | **83 (100%)** |
| Surface reference (`venue_facility_id`) | 189 | **83 (100%)** |
| Temporary lane | 21 | **0** |
| **Typed location, no reference** | **159 (39%)** | **0** |
| No location at all | 60 | **0** |
| Missing a division | 0 | 0 |

The 159 text-only rows are **not spread across the product** — they are four seeded fixtures:

| Tournament | Org | Text-only games | Venues configured |
|---|---|---|---|
| Battle of the Bats | milton-softball-organization | 108 | 1 venue / 4 surfaces |
| Bye Demo — 11 Teams | dev-test-org | 21 | **0** |
| Free Cup | free-test-org | 18 | **0** |
| Crimson Cup (Branded · Light) | dev-test-org | 12 | 1 venue / 2 surfaces |

…and they use only **nine distinct strings** in the entire database, each confined to one tournament:
`Diamond 1` (39), `Diamond 2` (27), `Diamond 3` (22), `Diamond 4` (20), `Community Park` (15),
`Playoff Facility 1` (13), `Field 1` (12), `Playoff Facility 2` (8), `TBD` (3).

**Consequence for the plan:** prompt §4.2's central fear — "a backfill that silently guesses wrong
puts games on the wrong field" — currently has **no real customer data to damage**. Nine strings,
scoped per tournament, is a reviewable list, not a fuzzy-match problem. The backfill drops from
"dangerous migration" to "admin-reviewed tidy-up", and it drops down the priority order.

### 0.2 The reported symptom is a different defect — do not fold it in

The tournament the volunteer was on (`qa-lab-summer-showdown`, org `qa-cancel-lab`) has **two games,
both carrying a real `diamond_id`**, and **both venue records exist**:

| location | diamond_id | venue name | facility |
|---|---|---|---|
| `Lab Field 1` | `aa014334…` | Lab Field 1 | *(none)* |
| `Lab Field 2` | `b999140d…` | Lab Field 2 | *(none)* |

The scorekeeper's "All fields" list is populated from `diamonds` scoped to the scorekeeper's
assigned tournaments (`app/api/official/[orgSlug]/score/get-score.ts`), **not** from free text and
**not** from facilities. Those rows exist, so free-text drift does not explain an empty dropdown.
The fixture seeder (`scripts/seed-qa-day-fixtures.mjs:431-458`) has created the venues and set
`diamond_id` since commit `96c8e346`, and the scorekeeper page's venue wiring is unmodified in the
working tree.

Most likely: the fixture was viewed **before** that seeder run (the payload returns `venues: []`
whenever the day has no games at all — `emptyPayload()`), or the seed partially failed at the time.

> ⚠ **This plan does not fix the empty dropdown.** It must be reproduced and tracked on its own
> (Phase 0). Shipping this plan and declaring the volunteer's bug fixed would be wrong.

### 0.3 There are FOUR representations, not three

Prompt §1 collapses the venue hierarchy. The real shape:

| Representation | Column | Meaning |
|---|---|---|
| Free text | `games.location` | display string; read by ~40 files |
| **Venue** | `games.diamond_id` → `diamonds` | the park/complex (table is `diamonds` — softball legacy, there is no `venues` table) |
| **Surface** | `games.venue_facility_id` → `venue_facilities` | the specific diamond/court — **preferred** for conflict matching |
| Lane | `games.schedule_facility_lane_id` | temporary generator lane, resolved later |

A game can hold a venue **without** a surface (the QA-lab games do), which is its own hazard — see §0.5.

### 0.4 ⚠ The live bug: two conflict engines that disagree

This is the finding that should drive the work, and the prompt does not contain it.

**`lib/schedule-metrics.ts`** (the schedule-health panel) normalizes free text and **does** detect
those clashes — `getVenueKey()` at line 894 falls back to `` `location:${trim().toLowerCase()}` ``.

**`lib/schedule-conflict.ts`** (the save-time blocker and the GameList conflict badges) **skips them
entirely** — `checkVenueConflict()` returns `null` at line 155 unless a structured reference exists,
and `buildConflictMap()` `continue`s at line 277.

So on any tournament using typed field names:

- the **health panel** says "1 overlapping slot found";
- the **schedule editor** shows no badge and **saves the double-booking without a word**.

Same data, two verdicts, and the silent one is the one attached to the Save button. This is live on
dev today and needs **no schema change** to fix.

### 0.5 Latent hole: mixed granularity never compares

`sameVenueConflictScope()` (metrics, line 775) and the `candidates` filter (conflict, line 169):
if game A pins a **surface** and game B carries only the parent **venue**, the two are never
compared — A demands an exact facility match, B demands `!g.venueFacilityId`. Two games genuinely on
the same diamond therefore pass each other unseen.

Measured today: **zero tournaments have this mix**, so it is latent, not live. But the QA-lab
tournament is one facility-creation away from it, and Phase 3 backfilling could introduce it
wholesale. Worth a guard, not a headline.

### 0.6 Scope is wider than `games` — six tables carry free text

| Table | `location` | Structured ref? | dev rows | **prod rows** |
|---|---|---|---|---|
| `games` | ✅ | ✅ venue + surface + lane | 410 | 83 |
| `league_games` | ✅ | ❌ **none** | 12 | **0** |
| `league_practices` | ✅ | ❌ **none** | 2 | **0** |
| `rep_team_events` | ✅ + `field_number` | ❌ none | 168 | 115 |
| `rep_tryout_sessions` | ✅ + `field_number` | ❌ none | 3 | 3 |
| `basic_coach_team_events` | ✅ | ❌ none | 6 | **0** |

**House league has no venue structure at all**, so it has **zero** double-booking detection — for a
league running all season across shared diamonds, that is a weekly risk, not a tournament-weekend
one. It has **zero production rows**, which means the model can be decided *before* it has data to
migrate. That is a rare and closing window (prompt §4 did not raise house league at all).

### 0.7 The derived-display pattern already exists — copy it

`app/api/admin/schedule-facility-lanes/route.ts:238-260` already does exactly the target behaviour
when a lane is resolved: it **derives** the string from the records and writes all three columns:

```
location = facility ? `${venue.name} - ${facility.name}` : venue.name
→ games.diamond_id, games.venue_facility_id, games.location   (all back-filled together)
```

**Architectural consequence:** `location` should be **demoted from authored to derived**, not
deleted. It stays a server-written display cache. The ~40 files that read it (public schedule, ICS
feed, opengraph images, coach schedule, scorekeeper cards, follow feed, mirrors) change **not at
all**. This answers prompt §4.1 with far less blast radius than removing the column — and it avoids
re-creating the migration-202 `NOT NULL` class of failure warned about in prompt §5.

---

## 1 · Answers to the prompt's seven questions

| # | Question | Answer this plan proposes |
|---|---|---|
| 1 | Does `location` stop being authored? | **Yes — authored becomes derived, but the column stays.** Server writes it from the venue+surface records (§0.7). Free text survives only as an explicit "off-site / not a configured field" choice, never as the easy default. |
| 2 | The 159 existing rows | Nine strings, per-tournament, **zero on prod** (§0.1). Admin-reviewed **propose-and-confirm**, never auto-guess. Unmatched strings stay text and are *labelled* unchecked, not silently converted. |
| 3 | Where authoring changes | Schedule builder, game editor, bulk import, generator lane resolution. Lane resolution **already** produces a reference (§0.7). Import must keep accepting text (it parses third-party files) but should resolve-on-match and report what it couldn't. |
| 4 | Does the lane layer survive? | **Yes.** It solves a real ordering problem (generate before venues exist) and it is already the best-behaved writer in the codebase. No change. |
| 5 | The coach-side twin | **Out of scope for Phases 1-3, decided in Phase 4.** Coach events are genuinely off-site-heavy (115 prod rows, 7 strings). `rep_team_events` honestly *is* text. **House league is the real omission** (§0.6) and takes its place. |
| 6 | What conflict detection should do | Say it out loud. New schedule-health finding: *"N games have no field set — they are not being checked for clashes."* Prompt §4.6 guessed this "may be worth more than the migration" — the evidence agrees, and it is Phase 1. |
| 7 | Sequencing | **Yes — and it is bigger than expected.** Phase 1 removes most of the harm with **no schema change at all**, because the checking gap (§0.4) is a pure-function bug, not a data bug. |

---

## 2 · Phases

Phases 1-3 require **no migration**. This is deliberate: prompt §5 warns that `games.location` has a
production history of a `NOT NULL` failure (migration 202), and §0.1 shows prod has nothing to
backfill. A constraint is explicitly deferred to Phase 5 and is **not** proposed for approval here.

### Phase 0 — Reproduce the volunteer's empty dropdown (separate defect)
- [ ] Re-run `node scripts/seed-qa-day-fixtures.mjs`; confirm the two `diamonds` rows and both `games.diamond_id` values land (§0.2)
- [ ] Load `/qa-cancel-lab/scorekeeper` on 2026-08-07 and confirm "All fields" lists *Lab Field 1* and *Lab Field 2*
- [ ] If it reproduces, file it against the day-of volunteer work — **do not** attach it to this plan
- [ ] If it does not reproduce, record it as fixture-timing and close it with that note

> Guard against the failure this plan is most likely to cause: declaring the reported bug fixed by
> a change that never touched it.

### Phase 1 — Close the checking gap ✅ BUILT on dev 2026-08-08 (no migration)
- [x] **New shared module `lib/venue-identity.ts`** — one answer to "same surface?", written module-agnostic per R3 (games / league games / league practices), reused verbatim in Phase 4
- [x] `checkVenueConflict()` and `buildConflictMap()` resolve placement through it, so typed field names are checked at save time and badged in the list (`lib/schedule-conflict.ts`)
- [x] `scanVenueConflicts()` / `sameVenueConflictScope()` route through the same module (`lib/schedule-metrics.ts`) — the two engines can no longer reach different verdicts
- [x] Mixed-granularity blindness fixed in both: comparison happens at the **coarsest granularity both sides specify**, so a surface-pinned game and a venue-only game at that venue now compare (§0.5)
- [x] New `venue_unchecked` finding — *"N scheduled games have no field set, so they are not being checked for double-bookings."* **Pushed first** in `buildIssues()`: the panel renders only the top two and the sort is stable, so a caveat on every other finding must not be the one hidden behind "2 more items"
- [x] **R2:** `TBD` / `TBA` (any casing/punctuation) resolve to *no field set* — counted as unchecked, never clashing with each other
- [x] **R1:** conflict copy now names the partner game, the time **and the field**, and says when the match was on a typed name — inline banner + badge tooltip
- [x] Trim + case-fold only; **no fuzzy matching**; typed text never matches a structured reference (that is Phase 3's reviewed job)
- [x] Every call site now passes `location`, including the ones that were gated off entirely: the **Add/Edit game modal** (`schedule/page.tsx` — the main door free text arrives through), inline row edit (`GameList.tsx`), the timeline board (`ScheduleTimeline.tsx`), and **both import passes** (`lib/import/tournament-schedule.ts` + `-commit.ts`, including the running candidate list so two rows inside ONE upload can clash)
- [x] **R4:** conflicts rating scaled by `venueCheckCoverage` (see the R4 block below)
- [x] Tests: new `tests/unit/venue-identity.test.ts` (24) + new `tests/unit/schedule-conflict.test.ts` (25, none existed before) + 14 added to `tests/unit/schedule-metrics.test.ts`
- [x] **Verified:** 1504/1504 tests ✅ · `npm run typecheck` ✅ · focused lint 0 errors ✅

#### What Phase 1 will look like at QA (measured on live data 2026-08-08)

| | effect |
|---|---|
| **Production** | **Zero new warnings.** All 83 live games carry both a venue and a surface, so nothing newly qualifies. Measured: 0 same-facility overlapping pairs; the 69 "same venue, different surface" pairs are correctly *not* flagged |
| `battle-of-the-bats` (dev) | **~329 overlapping pairs will appear.** This is CORRECT — the seed genuinely has **10 games at 09:00 on "Diamond 1"** on 2026-07-03. The fixture was never realistic; the product simply never said so |
| `free-cup` / `bye-demo` / `branded-light` (dev) | ~30 / ~15 / ~6 pairs, same cause (these three have **no configured fields at all**) |

> ⚠ **Do not read the dev fixtures as a regression.** They are the evidence the check works. The
> equivalent number on production is zero.

#### ✅ R4 — the health score now reflects what was checked (owner decision 2026-08-08)

Owner cleared the impact concern ("no live tournaments now"), so the conflicts rating is
**scaled by coverage** rather than left alone or penalised per game.

- The conflicts rating (15 pts) asserts *"we looked for clashes and found none"* — a claim only
  valid for the games we could locate. It is now multiplied by
  `venueCheckCoverage` = *(scheduled games − unlocatable games) ÷ scheduled games*.
- **Scaled, NOT penalised per unlocated game.** An unchecked game is **unknown**, not **wrong**;
  charging it like a real overlap would treat silence as a defect — the same category error this
  project exists to correct. A test pins the invariant: an unverified schedule can never rate
  below one with confirmed double-bookings.
- Coverage applies **after** the penalties floor at zero, so real conflicts still dominate.

| Situation | Conflicts rating | Total |
|---|---|---|
| All located, no clashes | 15/15 | 100 (unchanged — every prod tournament today) |
| Half located, no clashes | 7.5/15 | ~93 |
| Nothing located | 0/15 | 85 |
| Real overlaps | already penalised | unchanged |

⚠ **Known residual:** a fully-unlocated schedule still lands at **85**, which reads "good" on the
current tone thresholds. Defensible — the other 85 points measure things that WERE verified — but
it means the pinned finding, not the number, carries the message. Revisit tone thresholds only if
QA says 85 reads too generously.

⚠ **Deliberately not scaled: the `movement` rating.** It also silently benefits from missing venue
data (no venues ⇒ no venue changes ⇒ full marks). Same flaw in principle, but venue changes are a
comfort metric rather than a safety one, and scaling two ratings makes the score hard to explain.
Logged, not fixed.

ℹ The breakdown is not rendered anywhere in the UI — only the total and its tone — so the pinned
finding is the sole explanation for a lowered score. That is why it must stay pinned.

#### `/simplify` pass — 2026-08-08 (4 parallel agents: reuse / simplification / efficiency / altitude)

**⚠ Found a real gap, not just cleanliness.** `existingConflictGame()` in
`lib/import/tournament-schedule-commit.ts` was **not** given `location` when its sibling
`proposedConflictGame()` was — so at **commit** time an existing game placed only by typed text was
invisible as a clash partner, while the **preview** pass caught it. The two-engines-disagree bug
this project exists to end, reappearing one file over, inside the fix for it. Now fixed **and
pinned by a test** (`tests/unit/tournament-schedule-import.test.ts` — verified to fail without the
fix, not just pass with it).

Applied:
- **`toConflictGame()`** — one exported mapper in `lib/schedule-conflict.ts` replaces 4 hand-written
  UI object literals. The field list drifting is precisely what caused the gap above; a new call
  site can no longer forget a field. Also now carries `scheduleFacilityLaneLabel`, which no caller
  passed, so draft-lane placements reach parity with the health engine.
- **Caller-side precedence deleted (4 sites).** Each restated "a picked venue wins, else typed
  text" before calling in — a second copy of a rule `resolveVenuePlacement` already owns. Callers
  now pass `location` unconditionally and gate on `hasKnownPlacement()`.
- **Reuse:** the two new field-label ternaries replaced with `resolveGameFieldLabel()` from
  `lib/venue-label.ts` — which declares itself the single source of truth for venue labels and
  handles the venue-not-found fallback the hand-rolled version missed.
- **Efficiency:** placement was being resolved *inside* O(n²) loops in both engines — `checkAgainstPlaced()`
  now takes pre-resolved placements and `buildConflictMap` resolves once per game; `ParticipantGame`
  carries its `placement` so the health pair-loop re-resolves nothing; the two extra `aggregateMetrics`
  traversals folded into one. Placement allocations per pass drop from ~O(n²) to O(n).
- **Dead code:** the `getVenueKey`/`getFacilityKey` pass-through adapters removed (resolution now
  happens once upstream); `hasKnownPlacement` went from unused export to the shared caller gate.

Skipped (judged not worth the churn):
- Making `VenuePlacement` a true discriminated union — readability-only, and the module is small
  and heavily commented.
- Table-driven rewrite of the comparison tests — the current one-assert-per-case form documents
  intent better than a loop would.
- A cross-file mapper for the two import paths — their source row types genuinely differ; a shared
  mapper would paper over real shape differences.

**Re-verified after the pass:** 1505/1505 tests ✅ · typecheck ✅ · focused lint 0 errors ✅

#### `/review` pass — 2026-08-08 (high-risk tier: 4 lenses — correctness / regression / multi-tenant / React state)

**Deterministic gate:** `verify:changed` ✓ except the pre-existing `check:demos` coach-sandbox date
drift (unrelated — reads seeded data, nothing here writes it) · typecheck ✓ · focused lint 0 errors ·
migrations n/a · `check:layout --changed` ran and reported no covered screen affected.

**Multi-tenant: clean.** Every path into the conflict engine was traced to a single-tournament
fetch (`.eq('tournament_id', …)` plus `requireTournamentInOrg`). Text matching cannot reach across
tournaments or orgs. The scorekeeper route — the one surface that loads games for many tournaments
— does not feed the conflict engine at all.

Fixed (4):
- **[High] The inline row editor's warning modelled a save that never happens.** Emptying the venue
  dropdown sends nothing (`data.venueId || undefined`, and the API skips undefined fields), so the
  stored venue survives — but the preview treated the game as unplaced and fell through to its
  stored location text, which could block Save on a placement Save would not produce. The proposed
  game now retains the stored venue when nothing is picked, so the warning describes the actual
  outcome. ⚠ **Underlying product gap, NOT fixed here (Phase 2):** a venue cannot be cleared from
  the inline row at all — it is a no-op. The full editor can.
- **[Medium] The Add/Edit window ignored its own game-length field.** A 3-hour final in a 90-minute
  division was measured at 90 minutes, so the back half of its window was invisible and a real
  overlap saved without a word. Pre-existing, but inside the block being rewritten. Test added.
- **[Medium-High] Uncertain text matches could reject an entire upload.** One blocked row fails the
  whole import. A typed-name overlap now **warns**; only a structured match (same field record)
  blocks. Two unrelated rows both reading "Home Field" must not be able to reject a thousand good
  ones — a false clash blocking legitimate work is the failure this plan explicitly ranks worst.
- **[Medium] Placeholder set widened** to the unambiguous "no venue yet" markers — `TBD`, `TBA`,
  `N/A`, `None`, `Unknown`, `nil`, `null`, and pure punctuation (`-`, `—`, `/`). Previously only
  TBD/TBA, so two unrelated games both marked "N/A" would have registered as double-booked. The
  list stays short by design: nothing goes in it that a field could actually be called.

Accepted as intended (reported, not changed):
- The tournament dashboard's Schedule Health tile can flip from green to amber on an ordinary
  mid-authoring tournament that has dated games without fields yet. That is the owner-ruled R4
  behaviour working — **flagged as the most likely QA surprise.**
- The health panel shows only its top two findings, so pinning `venue_unchecked` first can push a
  real warning behind "N more items". Deliberate: it is a caveat on every other finding.
- Two tournaments sharing one physical field are still never compared (tournament-scoped venue
  records). Pre-existing, unchanged, worth a future decision.
- `clampScore` is `Math.max(0, Math.min(v, v))` — the inner `min` is a no-op, so buckets are never
  capped at their maximum. Harmless today (every formula is max-minus-penalty). Pre-existing.

**Re-verified:** 1507/1507 tests ✅ · typecheck ✅ · focused lint 0 errors ✅

#### Deliberately NOT done in Phase 1 (raised, not silently absorbed)
- **Typed text still never matches a configured field.** A tournament with some games typed "Diamond 1" and others pinned to the facility record *Diamond 1* is only partially checked. Resolving that is Phase 3 (reviewed), and Phase 2 should report it at import time.
- **A tournament with zero configured fields still has no timeline columns.** Authoring concern → Phase 2.

### Phase 2 — Stop new drift at the source ✅ BUILT on dev 2026-08-08 (no migration)

Built to owner-approved mockups (Claude Artifact `phase2-field-authoring-mockups`, rev `venues-naming`).

- [x] **One formatter, one rail.** `formatVenueLocation()` in `lib/venue-label.ts` is now the ONLY
  producer of the `Venue — Facility` string (em dash — the lane route and both import passes wrote
  a plain hyphen and drifted from the live labels). New `lib/tournament-venue-selection.ts` (pure,
  unit-tested) + `lib/tournament-venue.ts` (catalog fetch) mirror Phase 4's league rail: the ONLY
  way a venue reference gets onto a tournament game, deriving `location` server-side so it can
  never disagree with the reference. The league rail now imports the same formatter.
- [x] **Write-through on every games write path**: bulk-save, create, save-bracket (one catalog per
  tournament in the batch), the lane-resolution route, and PATCH update. **Bonus hardening:** the
  catalog is tournament-scoped, so a venue id from another tournament/org now 400s instead of being
  written through (the bare FK never enforced tenancy).
- [x] **PATCH venue semantics are presence-based** (the league pattern): a PRESENT `venueId` — value
  or explicit null — is the venue decision; a bare `location` edit only applies while no reference
  is stored. **This fixes Phase 1's parked defect:** clearing the venue from the inline row (and the
  modal, and a timeline drag — all three ride the same save) was a silent no-op via
  `|| undefined` + undefined-skip; all senders now send explicit nulls. (Also fixed en route: PATCH
  `venueId: ''` used to write a literal empty string into a uuid column.)
- [x] **Picking a field is the default path.** New shared `TournamentFieldPicker` (modal + inline
  row): venue optgroups with "Any {noun} at {venue}", a working "— No {noun} —" clear, and typed
  text demoted to the explicit **"Somewhere else (type it)"** choice, mirroring the league
  FieldPicker. The modal's type-first autocomplete is gone, and so is its `required` venue — the
  honest "no field yet" beats coerced junk text (what R2 exists to mop up). The bracket builder's
  select gains the same "Somewhere else" escape (sticky via local text-mode state). The inline
  conflict preview now models the real save semantics (cleared means cleared).
- [x] **Zero-venue prompt** (`ZeroVenuePrompt`): a tournament with no venues gets *"No venues set up
  yet — games without a real venue can't be checked for double-bookings"* + **[Create venues]**
  (opens the add-venue modal in place) in the game modal and on the empty timeline, instead of a
  silent text box; "type a location anyway" stays as a deliberate link. **Owner ruling 2026-08-08:
  League/Club orgs are offered [Import from your Venue Library] FIRST** (deep link
  `venues?import=library` auto-opens the existing import modal; Tournament tiers have no library →
  plain create). **Naming ruling (owner 2026-08-08): setup-level copy says "venues"** — the
  container created on the Venues page — while the sport noun stays wherever an actual playing
  surface is picked.
- [x] **Import resolves the bare `Location` cell on exact match** (trim + case-fold via
  `normalizeToken`, which flattens punctuation so legacy hyphen labels and live em-dash labels read
  the same) against venue names, unique facility names, and combined labels — the ONE sanctioned
  auto-resolution. Ambiguous names warn and stay text; unmatched names stay text and are **named in
  a new `unmatchedLocations` report** on the preview (aggregated by name with game counts, rendered
  in the import dialog). Nothing unmatched blocks the file. Explicit Venue/Facility columns are
  never second-guessed.
- [x] **Scorekeeper "All fields" filter reflects the day**: only venues today's games are actually
  on, plus one `text:` entry per typed-only location (matched client-side with the same
  `normalizeLocationText`), so an unused venue no longer pads the list and a typed-only game is no
  longer invisible to the filter. Placeholder text gets no entry (R2). ⚠ The volunteer's empty
  "All fields" dropdown remains a SEPARATE defect (§0.2 / Phase 0) — not claimed here.
- [x] **Sport-neutral throughout**: modal label, picker options, inline row, and the import dialog's
  unmatched-copy all take the noun from `getSportPack(...).defaultFacilityType` →
  `FACILITY_TYPE_LABELS`.
- [x] Tests: new `tests/unit/tournament-venue-selection.test.ts` (10) + 7 added to
  `tests/unit/tournament-schedule-import.test.ts` (location-cell resolution, ambiguity, aggregation,
  R2, column precedence) + 2 existing expectations updated for the deliberate em-dash unification.
  **Verified:** 1545/1545 ✅ · typecheck ✅ · `verify:changed` ✅ except `check:demos`' coach-sandbox
  attendance drift (pre-existing, seeded coach data — Phase 1's review hit the identical failure;
  the TOURNAMENT sandbox passes and its tour copy about the schedule screens was re-read and stays
  true — no demo sentence mentions the venue box).

#### `/simplify` pass — 2026-08-10 (4 parallel agents: reuse / simplification / efficiency / altitude)

Applied (9): ONE plan-gate predicate `hasOrgVenueLibrary()` in `lib/plan-features.ts` (was inlined in
6 files — all converted); ONE sport-noun helper `fieldNounFor()` in `lib/sports.ts` (4 sites);
`typedLocationKey()` in `lib/venue-identity.ts` shared by the scorekeeper server + client (the two
sides literally share the key builder now); the last 3 hand-built venue labels routed through
`formatVenueLocation` (page/GameList/PlayoffWizard); the lane-resolve route's hand-rolled
venue/tenancy validation replaced with the catalog rail (one behavior delta: a venue+facility
mismatch now 400s instead of the facility's parent silently winning); GameList's edit-state defaults
collapsed to one `editDefaultsFor()` seeded from `fieldPickerValueForGame` (un-deadening it); the
import's Location index built once per upload (O(rows×catalog) → O(rows+catalog)); multi-tournament
batch catalogs load in parallel; the venues-page deep link reads `useSearchParams`.
Skipped (4, noted): BracketBuilder/TournamentFieldPicker merge (lane option + compact labels =
genuinely different UI); per-save catalog cache (not a hot path); reusing gameRow for the
bare-location check (it doesn't carry `diamond_id` — verified); field-name rename symmetry (churn).

#### `/review` pass — 2026-08-10 (high-risk tier: 5 lenses — correctness / multi-tenant / data-contract / regression / concurrency)

**Deterministic gate:** typecheck ✓ · lint 0 errors · migrations n/a · `verify:changed` ✓ except the
pre-existing coach-sandbox demo drift (foreign to this diff) · `check:layout` SKIPPED (no dev
server; covered-screen list is coach-portal-only). 23 raw findings → 15 after triage → **8
confirmed + fixed**, 7 accepted-with-note.

Fixed (8):
- **[High] Spurious "game moved" family notices.** Every save now rewrites `location` to the
  canonical string, and `classify()` diffed the raw string — a notes-only edit on a
  legacy-hyphen game would have buzzed families with a move. Venue change is now judged on the
  STRUCTURED refs when the snapshot carries them (extracted to pure
  `lib/schedule-change-classify.ts` + 7 pinning tests; the string diff still applies for
  ref-less callers like the bulk shift and for text-vs-text placements).
- **[High] A picked venue now detaches the generator lane.** Repointing a lane-tethered game to a
  real field left `schedule_facility_lane_id` behind; a later lane-resolve pass snapped the game
  back to the lane's venue, silently discarding the manual pick (modal, inline row, and timeline
  drag all rode the same PATCH). An explicit lane key in the body still wins; clearing/typing
  leaves a lane alone so an untouched save can't evict a lane game.
- **[High, pre-existing — hardened in passing] `import-from-org` copied ANY org's private venue
  library by UUID** (no `org_id` ownership check, no plan gate — reachable on any tier) — now
  404s foreign ids and requires the library plan. Siblings fixed with it: org-library
  `update-facility`/`delete-facility` mutated by raw id with zero ownership check (cross-org
  rename/delete); tournament `add-facility` trusted the client's `tournamentId` instead of
  deriving it from the parent venue (tenant-scoped facility reads poisoned by a mismatch).
- **[Medium] `save-bracket` resolves every game's venue BEFORE the first write** — a resolver
  refusal mid-loop used to leave the bracket half-saved behind a 400.
- **[Medium] Scorekeeper field filter resets when a date change empties it** (the list is
  day-scoped now, so a stale `text:` filter guaranteed a silently empty board).
- **[Medium] BracketBuilder clears abandoned typed text when a matchup returns to its lane**
  (it used to ride the next save as a live text placement and invite bogus typed-name warnings).
- **[Medium] `handleVenueSaved` only auto-selects the new venue when the game modal is open** —
  the create-venue door is shared by six call sites, and an inline-row create was staging the
  venue into the (closed) modal's form.
- **[Low] A batch row with no `tournamentId` fails as a clean 400** instead of a TypeError 500.

Accepted (7, reported not changed): re-import of legacy-hyphen files reclassifies rows as
'update' with a Location change line (one-time canonicalization, nothing blocked); lane games
present in the pickers as "Somewhere else" with the lane label (display gap — harmless now the
clobber is fixed; the resolve-facilities panel remains the lane surface); `save-bracket` still
never writes lane membership (canvas doesn't surface lanes); the bare-location PATCH branch is
unreachable from current callers (kept — it guards the desync invariant); naive `+'s'`
pluralization (correct for all six current facility labels); two narrow pre-existing races
(venue-deleted-mid-request FK window → 500; bare-text TOCTOU on an unreachable branch).

**Re-verified:** 1552/1552 tests ✅ · typecheck ✅ · focused lint 0 errors ✅

#### `/docs` pass — 2026-08-10

Tournament guide (`lib/help-content/tournaments.tsx`): venues section rewritten for pick-first +
the zero-venue prompt + the League/Club library lead; schedule section gains the double-booking
paragraph + 2 new FAQs (`#faq-double-booked-field`, `#faq-offsite-game-location`) — Phase 1's
warnings had never been documented; Data Tools section documents Location-column auto-matching +
the unmatched-names report; the scorekeeper FAQ notes the day-scoped field filter. Search
keywords/searchText updated everywhere (search doesn't read rendered prose). ⚠ Noted, not done:
the ORG guide has no Venue Library section at all (pre-existing gap — future docs pass).

#### What Phase 2 changes at QA (expected surprises)
- Existing games whose stored label used the hyphen form ("Lions Park - Diamond 1") get rewritten to
  the em dash the next time anything saves through them (including an import update, where
  "Location" now appears as a change line). One-time, cosmetic, deliberate.
- The Add/Edit game window no longer *requires* a location — "— No diamond —" is a legitimate save
  and lands in the `venue_unchecked` count, which is the honest outcome.
- An import file whose Location column exactly names your fields now links those games to the real
  records (previously they stayed typed text even when the spelling matched).

### Phase 3 — Resolve the existing strings ✅ BUILT on dev 2026-08-10 (no migration)

Built to owner-approved mockups (Claude Artifact *Phase 3 — Matching typed locations to real
fields*). Owner decisions taken 2026-08-10: **banner on the schedule page** (option A), **Undo now
+ re-point forever** (option 1), **completed games do convert**.

- [x] **Per-tournament review panel** on the schedule page — a banner mirroring the existing
  "temporary facilities unresolved" one, opening a modal with **one row per distinct NAME** (not per
  game), its game count, an exact-match suggestion pre-filled where one exists, and three explicit
  outcomes: confirm / **create the field from the name** / **leave as typed text**. Each row states
  the derived string it will write ("Games will read *Lions Sports Field — Diamond 1*") — the admin
  never types it, so without that line they would be applying an unseen result to N games
- [x] **The matcher is now SHARED, not re-implemented** — Phase 2's `Location`-cell rule moved out
  of `lib/import/tournament-schedule.ts` into new pure `lib/venue-name-match.ts`, consumed verbatim
  by the importer and the resolve screen. Exact + trim + case-fold + punctuation-flattening only;
  ambiguous = no suggestion; placeholders = no candidate. **The importer's private copy is gone**,
  so the two callers cannot drift — the failure mode this whole project exists to end
- [x] New pure `lib/tournament-location-resolve.ts` builds the review model (typed groups, linked
  groups, exclusion counts) — 20 unit tests, and it is the only place the two exclusions live
- [x] **Every conversion writes through the Phase 2 rail** (`resolveVenueSelectionFromCatalog`), so
  venue + surface + derived em-dash label land together and mixed granularity (§0.5) is never
  introduced. One server statement per NAME, not per game
- [x] **Ordered so a refusal cannot half-convert a schedule** (the `save-bracket` lesson from Phase
  2's review): validate every target → create the venues/fields the decisions call for → resolve
  EVERY assignment to its final columns → only then touch a game
- [x] **⚠ Notification-silent, pinned by a source-level test.** A conversion changes the venue ref
  from none → real, which `lib/schedule-change-classify.ts` correctly reads as a MOVE. The route
  writes via `supabaseAdmin` and never calls `recordGameScheduleChanges`;
  `tests/unit/tournament-location-resolve.test.ts` fails the build if the route gains any notifier
  import (comments stripped first, so the paragraph explaining the rule survives).
  **Verified to fail on a real violation, not just to pass** — an injected notifier import was
  confirmed to break it
- [x] **Reversibility (owner option 1):** the apply response carries the exact **per-game**
  before-state (a group's members do not always share one spelling), held in component state →
  **Undo** restores it precisely. Session-scoped and honestly labelled as such. The durable half is
  the **"Already linked to a {noun}"** list: any group can be re-pointed in one action at any time,
  so a wrong pick noticed tomorrow is still a one-click fix — only the original wording is lost
- [x] **Exclusions enforced in the pure module, not the UI:** placeholder text is never convertible
  (R2) but IS counted and explained; **lane-tethered games never appear** (Phase 2 made an explicit
  pick detach the lane — doing that wholesale would dismantle a draft schedule)
- [x] **Refuses to manufacture the problem it fixes:** "create *Diamond 1* here" is hidden — and
  refused server-side — for a venue that already owns that name under the matcher's normalization
  (so "Diamond #1" cannot sneak past "diamond 1"). A second same-named surface in one park would
  make the name permanently ambiguous
- [x] Multi-tenant: affected game ids come from the **server's** own plan, never the client; the
  catalog is tournament-scoped (foreign venue → 400); undo is trusted for values but every id is
  re-checked against the tournament. `update_schedule` capability required; a **completed
  tournament is locked** exactly as the lane route is
- [x] Sport-neutral throughout (`fieldNounFor`); banner dismissal is keyed to the exact set of
  names, so a newly typed one re-raises it — the honest substitute for a "left as text" flag that
  cannot be stored without a migration
- [x] Tests: new `tests/unit/venue-name-match.test.ts` (13) + new
  `tests/unit/tournament-location-resolve.test.ts` (20). **Verified:** 1585/1585 ✅ · typecheck ✅ ·
  focused lint 0 errors ✅ · `verify:changed` ✅ including **`check:demos` — 2 presentable** (the
  coach-sandbox drift that dogged Phases 1–2 is no longer failing) and the org-context guard
  passing over the new route

#### ⚠ Three premise corrections found by measuring first (2026-08-10)

The build prompt's framing was wrong in three places. Recorded so nobody re-derives it:

1. **Six names, not nine — and Bye Demo shows NOTHING.** After the exclusions the prompt itself
   requires, the real screen is: Battle of the Bats 4 names / 108 games · Crimson Cup 1 / 12 ·
   Free Cup 1 / 15 · **Bye Demo 0** (all 21 of its typed games are lane-tethered). Bye Demo was
   named in the prompt as a headline "create the field" case; it is correctly empty.
2. **`venue_unchecked` cannot move, so it is NOT the QA signal.** `uncheckedVenueCount` counts games
   with **no placement at all**; typed text already resolves to `kind: 'text'`, which `isPlaced()`
   accepts. Measured: converting every name on all four fixtures moves that number by **exactly
   zero** (fixture counts are Bats 0 · Bye Demo 0 · Free Cup 0 · Crimson Cup 6, and the 6 are
   games with no location at all).
3. **The real payoff is bigger and measurable: 22 invisible double-bookings.** Battle of the Bats
   holds 108 typed games AND 25 pinned to real facilities. Phase 1 deliberately refuses to match
   text against a record, so the two populations are blind to each other. Measured on live dev:
   **17 overlapping pairs on Diamond 1 + 5 on Diamond 2 = 22 genuinely double-booked pairs that no
   engine can currently see.** Resolving reveals all 22. That is the before/after to test against —
   and it closes precisely the gap Phase 1 logged as "deliberately NOT done".

#### Validated against live dev data, not just unit tests

The plan builder was run over the four fixtures' real rows (2026-08-10). Output matched the
predicted table exactly, including the two cases nobody would have invented: **"Diamond 4" matches
nothing** (there are only Diamonds 1–3), and Battle of the Bats has a **facility named after its own
venue** ("Lions Sports Field"), so that string is correctly reported as ambiguous with 2 candidates.
Both demo-sandbox tournaments have **zero typed-only games**, so the banner never renders there —
as predicted, and `check:demos` passes.

⚠ **Residual risk, stated:** the WRITE path was never exercised over HTTP (no dev server/auth in the
build session). Read side validated against the live database, write logic unit-tested and
typechecked, but the owner's first Apply is the first real one — the QA section says so and asks for
an immediate Undo to prove the round trip.

⚠ **Battle of the Bats is `status = 'completed'`**, so the panel's button is disabled there until
the status is set to Active. Deliberate: a completed tournament is read-only platform-wide and this
screen does not carve an exception. The QA section carries the workaround.

#### `/simplify` pass — 2026-08-10 (4 parallel agents: reuse / simplification / efficiency / altitude)

**⚠ Found a real bug, not just cleanliness — the same class the project exists to end.** The plan
grouped typed names with `normalizeLocationText` (no punctuation flattening) while MATCHING them
with `normalizeToken` (flattens). So "Diamond-1" and "Diamond 1" became **two rows offering the same
exact-match suggestion** — resolve one and the other stayed behind forever. Two normalizations
inside one human-reviewed job, which is precisely the drift `venue-identity.ts` was written to
prevent. Now grouped by the matcher's rule throughout, with the reason stated at the branch, and
**pinned by a test**.

Applied (9): **the plan is now derived CLIENT-side** from games + venues the schedule page already
holds — the GET route is gone entirely, removing 3 queries and a round trip from *every* schedule
refresh for a panel most tournaments never open (and with it the double-fetch after each apply);
`resolveVenuePlacement` from `venue-identity.ts` now does the classification instead of a bespoke
decision tree (its header asks new callers to do exactly that, and Phase 3 was the third caller);
**`normalizeToken` moved to new `lib/normalize-token.ts`** so domain identity no longer depends on
the file-import subsystem (`lib/import/tabular.ts` re-exports it, all existing importers unchanged);
**`buildVenueNameIndex` made generic over the caller's record types**, which deleted the adapter the
importer had grown to re-look-up records the matcher already held; **`requireWritableTournament`
extracted to `lib/api-auth.ts`** (it was about to become the *sixth* hand-copied lock check — the
lanes route now shares it, one query instead of two); **`createTournamentVenue`/`createTournamentFacility`
added to the venue rail** so creation isn't a second copy of the venues route's inserts; one-pass
apply (the mutate-then-reloop and its defensive re-check are gone); `ChoiceOutcome` consumes the
decoded choice instead of re-parsing the encoded string a second time; the CSS twin of
`.facilityResolveBanner` deleted in favour of reusing it; explicit CSS classes replaced element
selectors so the chip and the count can't fight over font-size.

Skipped (5, noted): merging the modal's picker with `TournamentFieldPicker` (different option sets —
prop-plumbing would cost more than the ~15 lines saved); composing `.resolveLocationRow` from
`.resolveFacilityRow` (the twin carries descendant selectors that would leak into this markup —
the composes trap is real here even though the memory's *chained*-composes caveat doesn't apply);
migrating the venues route's five inline inserts to the new helpers (outside the diff — logged as
future drift risk); `pickSpelling`'s most-frequent tie-break (alphabetical-first would surface a
typo over the wording 38 games used); forcing the typed-row and linked-row JSX into one component.

**Re-verified:** output over the four live fixtures byte-identical before and after (so the cleanup
changed no behaviour) · 1586/1586 ✅ · typecheck ✅ · lint 0 errors ✅ · `verify:changed` ✅.

#### `/review` pass — 2026-08-10 (high-risk tier: 5 lenses — correctness / security+multi-tenant / data-contract / concurrency / regression)

**Deterministic gate:** `verify:changed` ✓ (incl. `check:demos` 2 presentable) · typecheck ✓ ·
lint 0 errors · migrations n/a · `check:layout` **SKIPPED — no dev server** (its covered-screen list
is coach-portal-only; the skip is stated rather than read as a pass). 30 raw → 18 after triage →
**9 confirmed + fixed**, 9 refuted, 3 accepted-with-note. Both Highs adjudicated in the main loop.

Fixed (9):
- **[High] A stale field target was validated only AFTER earlier creations in the batch had
  committed.** Reachable by leaving the panel open while someone deletes a venue elsewhere: the
  batch 400s and no game moves, but an **orphaned empty venue/field is left behind** — the file's
  own "a refusal must not leave things half-done" guarantee protected the schedule and not the
  venue library. Every target now resolves through the rail during validation, before the first
  insert, so the guarantee is true rather than aspirational.
- **[High] Applying wiped an explicit "Leave as typed text".** Clearing every selection after a
  successful apply dropped rows that were never submitted back to their pre-filled suggestion — so
  a later Apply for an unrelated row would sweep in and convert a name the admin had **twice**
  declined. Only the submitted selections are forgotten now.
- **[Medium] The refusal path looped on its own advice.** The 409 says "reopen the panel to see the
  current locations", but nothing refreshed, so reopening re-rendered the same stale rows and
  resubmitted the identical doomed request indefinitely. Games now reload on failure too.
- **[Medium] Undo could silently trample a colleague's edit.** Undo now carries what the apply
  wrote and skips any game that no longer holds it, reporting the count back ("3 games were changed
  by someone else since, so they were left alone"). Silently reverting a deliberate edit is the same
  category of harm as silently moving a game.
- **[Medium] Creating a field was not retry-safe** — a retry or double-click could produce two
  same-named venues, making that name **permanently ambiguous** to the matcher, i.e. the screen
  manufacturing the defect it exists to clear up. An existing same-named venue is now reused.
- **[Medium] A responsive rule stretched the Review button** across the row it now shares with the
  dismiss control (481–768px), because the shared banner's `:global(.btn) { width: 100% }` was
  written when the banner had exactly one child button.
- **[Low ×3]** `display_order` counted every facility in the tournament rather than the venue's own
  (contradicting the dictionary's "within the venue"); a swallowed read error could stamp a new
  diamond as `'other'`; `facilityType` was typed `string` rather than `FacilityType`.
- **[Advisory]** Undo's copy promised the text back "exactly" when the rail trims it, and the
  route's own comment overstated what `revert` enforces — both corrected to what the code does.

Refuted (9, dropped): cross-tenant writes via undo, spoofable create gating, client-nominated game
ids, information disclosure in error messages, RLS posture, the shared lock helper being weaker than
the copies it replaced, the importer's preview contract, the token-function move, and both exclusion
rules (placeholder and lane-tethered proved **structurally** unreachable via `resolveVenuePlacement`'s
precedence, not merely conventional).

Accepted (3, reported not changed): undo does not delete a venue it created (deleting on undo is
more dangerous than an unused record); the venues route still has its own inline inserts; a
one-frame banner flash after load on a dismissed tournament (fixing it needs a render-time storage
read, which trades a flicker for a hydration bug).

⚠ **Neither High fix is unit-testable here** — the harness runs pure modules only (no React, no
request tests). Both are covered by explicit QA steps in ledger §9b instead, and that limit is
stated there rather than left implicit.

**Re-verified:** 1586/1586 ✅ · typecheck ✅ · lint 0 errors ✅ · `verify:changed` ✅.

#### `/docs` pass — 2026-08-10

Tournament guide (`lib/help-content/tournaments.tsx`): the schedule section gains a paragraph on the
review panel (one row per name, the three outcomes, exact-match-only, nothing notified, and the two
exclusions); **new FAQ `#faq-resolve-typed-locations`** ("My games have field names typed in as
text…") covering undo, the already-linked list, the Completed-tournament lock and the dismissal;
`#faq-double-booked-field` now admits the gap it used to leave silent — a typed name is not compared
against a real field — and points at the fix; `#faq-offsite-game-location` and the Data Tools
import section both gained a pointer so someone who typed or imported text isn't left thinking it is
permanent; the venues section covers setting venues up late. Search keywords/`searchText` updated in
all four places (search does not read rendered prose). **No anchor renamed or removed** — only added,
so no `href` needed updating (verified by grep).

### Phase 4 — House league gets the same field model ✅ BUILT on dev 2026-08-08 (the only phase with a migration)
- [x] **DECIDED (R3, 2026-08-08): house league uses the same venue + surface model as tournaments.** Zero prod rows (§0.6) means this is a schema decision made before there is data to migrate — that window closes the moment a customer schedules a league game, so this phase should not drift to the end. **Prod re-measured 2026-08-08 before building: still 0 games / 0 practices** — the window was open
- [x] **DECIDED (owner, 2026-08-08): league fields come from the ORG venue library** (`org_venues` / `org_venue_facilities`), referenced **directly** — no per-season copies. A league is org-level and season-long; direct references make clash detection work across seasons/divisions automatically and give the (previously 0-row) library its first consumer. Known accepted gap: tournament games use per-event copies, so a tournament and a league game on the same physical field still never compare (pre-existing, logged in Phase 1's review notes)
- [x] **DECIDED (owner, 2026-08-08): ONE booking pool — practices and games block each other.** A practice occupying a surface blocks a game on it and vice versa
- [x] Migration **229** (`229_league_venue_refs.sql`, **applied to dev only** — prod is an owner decision): `org_venue_id` + `org_venue_facility_id` (both ON DELETE **SET NULL** — the anti-migration-202 choice) on both tables, + **`league_games.ends_at`** (build decision: one pool with practices needs comparable windows; engine falls back to 90 min when null), + 4 FK indexes. Schema-parity baseline re-initialized to accept the dev-only divergence
- [x] **Same unit of work:** `DATA_DICTIONARY.md` updated + `refresh:snapshots` run (dev + prod) — `check:dictionary` green
- [x] **`lib/venue-identity.ts` reused VERBATIM** (zero edits) via new pure module `lib/league-schedule-conflict.ts` (ms-window overlap over `LeagueBooking`s; no buffer severity — league has no turnaround config; cancelled AND postponed vacate the slot) + server rail `lib/league-venue.ts` (`resolveLeagueVenueSelection` = the only venue writer, derives the `Venue — Facility` display string so `location` is demoted to a cache exactly like Phase 1's model; `checkLeagueBookings` = org-wide save-time check, games+practices, all seasons, `.eq('org_id')` on every pool query)
- [x] Authoring picks a field like tournaments: `FieldPicker` (venue/surface dropdown from the library + explicit "Somewhere else (type it)" escape) on the game modal, the practice modal and the generator; empty library degrades to free text + a "set up your fields once" link to the library page. Game modal gains optional **End time**
- [x] Block-vs-warn: single game/practice save with a **structured** clash → 409 with a message naming both bookings, the time and the field; **typed-text** clash → saves with a warning (false clash must not block legitimate work). **Generator saves never block** (a generated round intentionally stacks games at one default time) — clashes incl. intra-batch sibling pairs come back as warnings
- [x] `venue_unchecked` twin: season-wide health endpoint (`schedule/health`) scans games+practices in one pool → amber conflict strip (named pairs) + "N scheduled bookings have no field set — not being checked" line + per-card/row Double-booked badges
- [x] Sport-neutral: the surface noun everywhere comes from `getSportPack(season.sport).defaultFacilityType` → `FACILITY_TYPE_LABELS` — never hard-coded
- [x] **Hardening picked up in the same routes** (pre-existing gaps adjacent to the new pool): practices GET/POST now verify season→org and team→season ownership (previously ANY authed league admin could read/write against foreign ids), gained the missing `hasModuleEntitlement` gate (dictionary gotcha 5), and the game-create route got the org-zone wall-clock fix its PATCH sibling already had (dictionary gotcha 5 for `league_games`)
- [x] **Coach events RULED out of scope** (`rep_team_events` + `field_number`, `rep_tryout_sessions`, `basic_coach_team_events`): they stay free text — frequently off-site (a school gym, a rented field), 115 prod rows across 7 strings; text is the honest representation. **This is a decision, not an omission** (prompt §4.5 / R3 companion ruling)
- [x] Tests: new `tests/unit/league-schedule-conflict.test.ts` (19) pinning one-pool, block-vs-warn, R2 placeholders, postponed-vacates, mixed granularity. **Verified:** 1526/1526 ✅ · typecheck ✅ · `verify:changed` ✅

> ⚠ Dev fixtures: the 12 dev league games / 2 practices keep their typed strings ("Maple Grove Park — Diamond 1" etc.) — they are checked text-vs-text and reported honestly; nothing was backfilled (3 distinct strings, nothing worth converting ahead of Phase 3's reviewed flow).

### Phase 5 — DEFERRED, not proposed
- [ ] A database-level constraint requiring a venue reference. **Not recommended now.** Prompt §5's migration-202 warning is precisely this failure mode: prod was `NOT NULL` while dev was nullable and deleting a venue failed *in production only*. Revisit only after Phases 1-4 have held through a real season, and only with dev/prod parity verified from live `information_schema`

---

## 3 · Architectural decisions

- **Decision:** `location` stays as a column; it is demoted from *authored* to *server-derived*.
  **Rationale:** ~40 files read it (public schedule, ICS, opengraph, coach views, follow feed,
  mirrors). Deriving-and-keeping gets the single source of truth with zero reader churn and no
  nullability migration (§0.7).
- **Decision:** One shared venue-key helper; the two engines must not each own their own copy.
  **Rationale:** §0.4 is a *drift* bug. Fixing both engines separately re-creates it in six months.
- **Decision:** Phase 1 ships before any data work. **Rationale:** the checking gap is a
  pure-function bug affecting real behaviour today; the data problem is 159 fixture rows and zero
  prod rows.
- **Decision:** Trim + case-fold, never fuzzy. **Rationale:** a false clash blocking a legitimate
  save is worse than a missed clash; and a wrong auto-match moves a real game (prompt §4.2).
- **Decision:** The scheduling-lane layer survives unchanged. **Rationale:** it solves a genuine
  ordering problem and already implements the target pattern (prompt §4.4).
- **Decision:** No plan-tier gating. **Rationale:** double-booking detection is correctness, not a
  premium feature. Applies to Tournament, Tournament Plus, League, and Club alike.

## 4 · Owner rulings (2026-08-08) — BINDING

- ✅ **R1 — Ship Phase 1 quietly.** No pre-announcement, no one-time notice. The warning explains
  itself when it fires. **Consequence:** the conflict message must stand on its own for an organizer
  who has never seen it before — it names both games and the field, and says what to do. No "new!"
  badge, no changelog interstitial.
- ✅ **R2 — Placeholder text counts as "no field set".** `TBD` is not a field name. It is grouped
  with the genuinely-unlocatable games and reported in the `venue_unchecked` finding, and it never
  produces a clash. **Assumption to confirm at build:** `TBA` is treated the same way (obvious
  sibling); matching is case-insensitive and trim-tolerant. Anything else stays a real field name.
- ✅ **R3 — House league gets the SAME field model as tournaments.** Venue + surface reference, same
  derived display string, same clash detection. **Consequences:** (a) Phase 4 **will** need a
  migration (league games and practices currently have no reference columns at all), so it is the
  only phase that does; (b) Phase 4 rises in priority — the zero-prod-rows window is the entire
  reason this is cheap, and it closes the moment a customer schedules a league game; (c) the shared
  venue-key helper from Phase 1 must be written module-agnostic from the start, not
  tournament-shaped and generalized later.

### Still open (not blocking)

- [x] ~~Should `venue_unchecked` dock the health score?~~ **DECIDED R4 (2026-08-08): yes — scaled by coverage.** See the R4 block in Phase 1.
- [x] ~~Does the org venue library belong in Phase 2's "create the fields first" prompt?~~
  **DECIDED (owner, 2026-08-08): yes — League/Club orgs are offered "Import from your Venue
  Library" FIRST in the zero-venue prompt** (Tournament tiers get plain create — no library on
  those plans). Companion naming ruling the same day: the setup prompt says **"venues"**, the sport
  noun (diamond/court/rink) stays wherever a game's actual playing surface is picked.

## 5 · Verification

- `npm run verify:changed` on every phase; `npm run typecheck` for Phases 1-2 (shared modules)
- New `tests/unit/schedule-conflict.test.ts`; extend `tests/unit/schedule-metrics.test.ts`
- Phase 3 is data-touching: re-measure with `node scripts/db-query.mjs --dev` before and after
- **Owner browser QA** per AGENCY_RULES.md — agents do not browser-test
- **Demo sandboxes:** `riverdale-minor-ball` has 30 games, all referenced, 0 text-only — Phase 2's
  authoring change alters a tournament flow, so re-check the sandbox copy and run `npm run check:demos`
- Offer `/docs` after Phase 2 (organizer-facing flow change) and `/review` after Phase 1 (shared
  scheduling logic)

## 6 · Out of scope (per prompt §6)

- The day-of volunteer bottom bars (`DAY_OF_VOLUNTEER_BOTTOM_BARS_PLAN.md`) — Phase 0 hands the
  empty-dropdown defect back to that work rather than absorbing it
- Venue/facility admin UX beyond the authoring-flow changes in Phase 2
- Time-conflict logic that is not about identifying the surface
