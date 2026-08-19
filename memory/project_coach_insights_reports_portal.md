# Coach Insights → Reports & Analytics Portal

**Plan:** `docs/projects/active/COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md` · PM brief beside it.
**Mockups:** `claude.ai/code/artifact/7d02e402-fd59-4b11-8d88-33fe95fffd8c` (owner-approved 2026-08-18).

- **P1** (the tab shell) — dev `0ebd0ffa` 2026-08-18, owner QA **§58 PASSED**.
- **P2** (the drill-ins) — dev 2026-08-19, owner QA **§61 owed**.
- **P3** (charts) — not started.

## The shape

Insights is ONE page at `/history`, seven tabs addressed `?section=` (Dashboard · Results ·
Attendance · Playing Time · Development · Awards · Scouting Book), Money-hub mechanics: panels in
`./{tab}/panel.tsx`, lazily mounted, then **kept mounted** (`display:none`). The six legacy report
routes are permanent redirects. `CoachTabBar` is shared with the Money hub.

- **NO MONEY ANYWHERE** (owner ruling). Structural, not a render branch: the hub never fetches dues,
  which is what every money rule in the findings engine gates on. ⚠ Those rules survive on purpose
  for the Sunday digest, which is a notification, not this screen.
- **Live-season only, structurally.** `CoachTeamSeasonGate` sends a team with no live season to its
  closed-season page. No panel and no route reads `?year=`
  (`tests/unit/coach-history-endpoint-guard.test.ts` fails the build if one learns to).
- Nav gate is `hasNonMoneyRecordAccess` — a money-only treasurer has no door here.

## ⚠⚠ P2's three owner decisions (2026-08-19) — two REVERSE the approved mockup

Mockups are the spec in this repo, so a mockup contradicting a standing rule is a contradiction to
**escalate**, never one to settle by reading the newer artefact. Recorded in
`memory/design_decisions.md`.

1. **The attendance table does NOT sort, and no player is badged.** The mockup drew it sortable with
   an amber *"Missed most practices"* chip on a named child. The panel already carried the opposite
   as a standing ruling. Same family as [[decision_playing_time_vocabulary]] and the Development
   report's "checklist, never a ranking" — **three surfaces, one rule: a coach tool may show what
   happened; it may not rank children by it.** Replaced by a receipts drill-in on **every** row (a
   chevron only where absences exist would be the badge wearing an affordance).
   ⚠ **Guarded in SOURCE**, not behaviour — "worst first" is one `.sort()` in a pure module whose
   unit tests would all still pass (`tests/unit/coach-attendance-receipts.test.ts`).
2. **Arm care shows no innings budget, because the product has none.** The mockup drew
   "16 of 18 · 2 left" filling toward *this week's cap*. **There is no weekly and no season
   ceiling** — every cap stored is PER GAME and is a number the coach set; `lib/coach-arm-care.ts`
   refuses to invent one in as many words. (The mockup also compared a *season* innings total to a
   *per-game* cap.) Redrawn as workload + rest + the coach's own cap. **A real weekly cap is its own
   project:** it needs a setting, and `lib/lineup-caps.ts` + the game-day console's chip must move
   with it, or three surfaces quote a child different ceilings.
3. **"RSVP reply rate" → "Recorded".** Nobody replies — RSVP is a status the **coach** sets, with no
   family reply channel and no reply timestamp anywhere. Same arithmetic (`known / recorded`),
   honest name. ⚠ General form: **before naming a rate after an actor, check the actor performs the
   act** — a plausible label over real arithmetic is harder to catch than a wrong number.

## What P2 actually built, and what the plan got wrong

- **Attendance:** four season figures (Season / Games / Practices / Recorded) reusing the hub's
  `insightsBand` recipe, and a per-player receipts drill-in — every session the player was marked
  **absent**, newest first, **games AND practices** (the row states a fraction for each; a
  practices-only list would visibly fail to add up), plus a "these all fall on a {weekday}" note
  when it is true of every absence. New pure module `lib/coach-attendance-receipts.ts`.
- **Playing Time:** position-recency matrix + arm-care panel, both fed by
  `computeTeamSeasonLineupAnalytics({ positionRecency: true })` behind `?recency=1` on the existing
  `lineup-analytics` route (opt-in, because the Overview's game-day card shares that helper).
- ⚠ **The plan said both P2 sections "ride the existing route" and that the arm-care data "already
  exists". Both false.** `lib/coach-position-recency.ts` survived P1 but its only feeder was the
  `/ask` route P1 deleted — live and unreachable for a day. The assembly (cancelled games excluded,
  innings from `analyzeLineup`, oldest→newest with a start-time tie-break, active players only) was
  recovered from `0ebd0ffa^`.
- ⚠ **`lib/coach-practice-misses.ts` is now orphaned except `weekdayOfDay`** — its windowed
  *ranking* was the retired Ask answer, and decision 1 is what retires ranking. Deleting it is a
  small separate call.
- **The drill-in is addressed by `?player=`, not `useState`** — shareable, survives reload, and
  ⚠ **a drill-in that arrives CLOSED is invisible to `check:layout`** (it opens URLs; it cannot
  click). `scripts/layout-screens.mjs` gains `coach-attendance-receipts`, pointed at the one fixture
  player seeded with absences.

## ⚠⚠ Fixture bugs found on the way (both hid features behind a green check)

- **The UAT seeder re-inserted all six finished games on EVERY run.** The guard used
  `.maybeSingle()` on `vs Ridgeview` — a name seeded TWICE on purpose (league + tournament, so the
  per-type breakdown has two rows). Two rows makes `.maybeSingle()` **error**; the error was
  discarded; the guard read null. A fixture reseeded four times claimed 3-2-1 and held 24 games.
  Fixed to `.limit(1)`. **A helper that ERRORS on the shape you gave it looks exactly like a helper
  that found nothing.**
- **The live season had ONE saved lineup and attendance on two events.** Both new reports would have
  swept near-empty and reported green. Seeder now adds six games' lineups (four players
  position-restricted, so "never played here" dashes exist), five practices (four a week apart + one
  off-cycle, so the weekday note is provably true for one player and false for another), no-replies
  (so "Recorded" is under 100%) and arm-care caps (season default 2, one per-player override of 1 so
  the over-cap flag renders).
- **The coach demo seeded all six mid-season lineups from ONE authored grid**, so the recency matrix
  rendered *one number repeated* — every screen perfect, the feature invisible. `midseasonLineupGrid`
  rotates field positions per game; **bench seats and both pitchers are untouched**, so the
  playing-time outlier and the arm-care story hold by construction, as do the two health-check
  assertions over that grid. Tour step 6 gained a clause for the two new sections.

## Standing rules for anything that touches this portal

- **A year parameter is a DECISION** — `HISTORY_ENDPOINTS` in the guard test is the whole look-back
  layer. Playing time is live-season-only **permanently** (its figures are RECOMPUTED, so a finished
  season would show what today's code makes of that year's lineups, not what the coach read).
- **Panels stay mounted**, so every write keyed on a team must be guarded against a superseded run —
  a stranded panel has no unmount to recover it (`coach-insights-portal.test.ts` pins this).
- **Position recency may only claim what a saved lineup records.** A player who has never played a
  position is ABSENT from the answer, never shown with a season-long gap. Do not "improve" it by
  reading a roster's primary-position field: **an intention is not a record.**
- **A green `check:layout` over an empty fixture is not evidence** (§58's lesson, paid twice here).
