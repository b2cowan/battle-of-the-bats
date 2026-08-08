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

### Phase 2 — Stop new drift at the source (no migration)
- [ ] One server-side helper that derives the display string from venue+surface, generalizing the lane-resolution logic (`app/api/admin/schedule-facility-lanes/route.ts:238`) — single formatter, one definition of the string
- [ ] Call it on every write path that sets a venue: `app/api/admin/games/route.ts` (lines 317, 377, 457, 929), so `location` is written *through* and can no longer disagree with the reference
- [ ] Game editor + schedule builder: picking a field is the default path; free text becomes an explicit "off-site / not a configured field" choice (`GameList.tsx:649`, `ScheduleTimeline.tsx`, `BracketBuilder.tsx:211`)
- [ ] When a tournament has **no** fields configured, prompt to create them instead of silently accepting text (this is what produced Bye Demo's 21 and Free Cup's 18 — §0.1)
- [ ] Bulk import keeps accepting text, but resolves-on-exact-match and **reports** unresolved names in the import summary (`lib/import/tournament-schedule.ts`, `app/api/admin/tournaments/[tournamentId]/schedule/import/shared.ts`)
- [ ] Scorekeeper filter: list the fields the day's games are actually on, so a venue that exists but is unused doesn't pad the list and a typed-only game isn't invisible (`app/api/official/[orgSlug]/score/get-score.ts:335`)
- [ ] Sport-neutral labels throughout — "field" comes from the Sport Pack (`lib/sports.ts`), never hard-coded

### Phase 3 — Resolve the existing strings (data, reversible, admin-reviewed)
- [ ] Per-tournament screen: "9 games say *Diamond 1* — is that **[Diamond 1 ▾]**?" with an explicit **Leave as text** option
- [ ] Exact + trim + case-fold matching only. No fuzzy matching, no cross-tournament matching, no auto-apply (prompt §4.2)
- [ ] Offer "create this field from the typed name" per distinct string — the honest fix for Bye Demo / Free Cup, which have no venues at all
- [ ] Every conversion writes venue + surface + derived text **together** via the Phase 2 helper, so mixed granularity (§0.5) is never introduced
- [ ] Reversible: record what was converted so a wrong guess can be undone
- [ ] Multi-tenant: matching is scoped to the tournament's own fields — nothing crosses an org (prompt §5)
- [ ] Run it on the four dev fixtures; **prod needs nothing** (§0.1)

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
- [ ] Does the org-level venue library (`org_venues` / `org_venue_facilities`, League/Club only — **0 rows on both dev and prod**) belong in Phase 2's "create the fields first" prompt, or is it dead weight to leave alone? Becomes more pressing under R3, since a league's fields are org-level by nature.

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
