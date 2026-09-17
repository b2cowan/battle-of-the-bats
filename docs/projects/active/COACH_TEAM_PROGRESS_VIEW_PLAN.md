# Coaches portal: a team-level progress view for Skills & Goals — assessment and proposed plan

**16 September 2026 · Source-based assessment on the UAT fixture · Ruled T1–T8 "Build as drawn" ("I agree with your mockups") and BUILT on dev the same day · Owner QA walk §196 owed · commit on the owner's say-so**
Read first: [product brief](COACH_TEAM_PROGRESS_VIEW_PM_BRIEF.md). See it: the [project hub](COACH_TEAM_PROGRESS_VIEW_HUB.html) — artifact `1omqXRfxFi8UsrCKXCcjN6` (mockup · decisions T1–T8 with a paste-back · brief · plan; the QA walk tab is appended when a build lands).
Origin: the Development lifecycle re-evaluation's **D8** ("Build = not now", stage 0, `docs/projects/archive/COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` §17) and **G7** (the refusals are a principle; "D8's team-trend tile stays deferred on its own terms", §21; Business Decisions Log 2026-09-16). Neither is a spec; both are why this project exists.

## 1. Assessment

The re-evaluation closed with two things parked on their own terms — the shared-stylings close-out (S6) and D8, team-level progress. D8 was deferred first because the refusals question (S5) was open, and kept deferred once G7 answered it: *a team figure on one metric, naming no child, is analysis, and stage 0 builds none.* Two standing rulings therefore pull on this project — **the Overview is state, not analysis (D7)** and **there is no leaderboard, ever (G7)** — and the question that leaves is narrower than "build a team-trend tile": *what team-level fact is neither a ranking nor analysis on the Overview?*

Walked source-based on the UAT fixture, one fact survives: **counts of direction per metric with the denominator stated** — "60-yd sprint · 4 of 12 players have a result · 3 have two or more · since their first: 2 lower, 1 higher · lower is the aim · last recorded 15 Sept". It names nobody, sorts nobody, and its rows are metrics rather than players, so it cannot become a ranking by construction. It belongs on **Insights → Development** as a fourth report beside Coverage, Player progress and Practice review — where the other team-level reads (Results, Attendance, Playing Time) already live — and **the Overview does not change**.

The team *average* stage 0 sketched ("best-of average 8.41 → 8.30 since May") fails on the fixture's own records before the ranking question is reached: the population differs between sessions, and the figure moves when the sample changes (§4, F03). That is the plan's §9 denominator rule broken in one number.

"Nothing" is a legitimate outcome and is weighed as one (T1). The recommendation is to build, because the gap is a screen the other Insights tabs already have and the counts cost no new read — but the report will read thin on a young season, and the plan says so.

## 2. Scope, method and confidence

**Read:** `app/[orgSlug]/coaches/teams/[teamId]/history/development/panel.tsx` (Coverage · Player progress · Practice review on one Report selector), `app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx` (the Skills & Goals Overview), `app/api/coaches/[orgSlug]/teams/[teamId]/development/board/route.ts` (the read both share), `lib/development-report.ts`, `lib/measurable-series.ts`, `lib/development-address.ts`, `lib/insight-findings.ts`, the Insights hub page's development summary, the archived plan's §8 (report rules, the not-prioritised list), §9 (denominators), §17 (D7/D8) and §21 (G1/G7 and the read-from-the-code section), and the Business Decisions Log's G7 entry in its own words.

**Probed (read-only):** the fixture's development rows — roster, definitions, every result, observation, not-assessed mark, goal and session — grouped per session exactly as `groupBySession` groups them, to see what each candidate team figure would actually say. The probe was a scratch script; it wrote nothing.

**This was not a signed-in browser test or user study.** Interaction paths are inferred from code; the "before" frames were drawn from rendered screenshots of the fixture as the head coach. Every figure on the mockup is one the fixture produces on 2026-09-16 (§9 below).

Findings are tagged as the lifecycle assessment tagged them: **Code finding** (follows directly from the implementation), **UX hypothesis** (a plausible problem needing observation), **Proposal** (a future capability, not something claimed to exist).

## 3. Walkthrough as the head coach — "how is my team doing this season, overall?"

| The moment, and the question | What exists today | Where the coach stops | Proposed |
|---|---|---|---|
| **Mid-season, a Tuesday.** "Is the sprint work landing across the group?" | Coverage: one metric at a time, each player's *latest* result and date, roster order. Player progress: one player's change. The Overview: players measured (4 of 12). | Nothing reads the roster as a whole on a metric. Counting how many have moved on the 60-yd sprint means opening Player progress per player — 12 views for one test, 60 for the five active metrics (F01). | **Team progress** — one row per metric: players with a result, two or more, and of those how many sit lower or higher than their first, in the unit with the aim stated. Nobody named. *Proposal.* |
| **Before a parent conversation.** "What do I tell Devon's family?" | The development handout: one player, current season, a coach-written next step, nothing stored. | The coach does not stop — the paper is the instrument. What must not happen is a team figure reaching it. | Nothing changes; the new report never feeds the handout, the recap or any family surface (T8). *Code finding:* the handout reads one player's records and the printing rule; there is no team read for it to pick up. |
| **Planning Thursday's practice.** "What haven't we measured since June?" | Coverage's date column, one metric at a time; the Overview's Sessions card names the last session's date; Needs attention lists players with no result at all. | "When did we last take a throw-speed result?" has no answer short of switching Show per metric and reading down the column (F05). | The same report's **Last recorded** column — a date the coach reads by eye; no "stale" threshold (the S4 refusal holds). *Proposal.* |
| **Standing back.** "Where does a team read belong?" | Results reads the record; Attendance a team %; Playing Time the bench balance. Development: Coverage, Player progress, Practice review. | Development is the one Insights tab with no team-level read (F04). The owner named the Overview as the home of team-level progress, then ruled it state (F06). | Team progress joins the Report selector; the Overview is untouched except that its rail's "Reports in Insights" count is computed and reads 4. *Proposal.* |
| **The honest alternative.** "Should anything be built?" | D8 is parked; the product is complete without it. | On a young season the report reads thin — on the fixture four of five active metrics say "none has two results yet". True, and useful ("run a session"), but not a trend. | Weighed in T1. Recommendation: build — the counts cost no new read (F02) and the gap is a screen the other tabs have. "Not now" is a legitimate ruling. |

## 4. Findings

### F01 — Motion across the roster is unreadable without a per-player tour · Code finding
`ReportRow.latest` (the board's wire shape) carries each player's latest session headline per metric and nothing earlier; `ProgressReport` reads one player through `/roster/{id}/development`. There is no surface that answers "how many players have a newer result than their first, and which way". The coach's only route is Player progress once per player per metric.

### F02 — The board route already reads every result and drops the earlier ones at the wire · Code finding
`GET …/development/board` fetches every result for every active player (`getRepTeamMeasurablesForPlayers`), buckets them per (player, metric), groups each bucket through `groupBySession` and keeps `latestSessionResult` for the wire. The rows a team count needs are in hand on every load of Coverage and the Overview; a per-metric fold over them is the marginal cost. No new read.

### F03 — A team average per session compares different children · Code finding (from the fixture)
On the fixture's 60-yd sprint, the session averages of headlines are **8.62** (6 May — Devon alone, a bench-side reading), **8.41** (20 May — Devon alone), **8.50** (10 Jun — Avery 8.70, Devon 8.24, Emerson 8.55) and **8.42** (15 Sept — Avery 8.75, Blake 8.33, Devon 8.28, Emerson 8.30). The 10 Jun figure *rises* 0.09 while Devon's own time fell 0.17; Blake's first-ever result lowers the 15 Sept figure by itself (8.44 without him); Avery's time went *up* 0.05. "8.62 → 8.42 since May" reads as the team getting faster, and nothing on the line says the sample changed. On a thin sample the "team" average is one child's number wearing a team label. This is §9 ("each report needs an explicit denominator; do not compare 4 of 6 from a session against the current roster") broken in one figure — before the no-ranking rule is reached.

### F04 — Development is the one Insights tab with no team-level read · Code finding
`TABS` on the Insights hub: Results (the season record), Attendance (a team percentage and per-player rows), Playing Time (bench balance across the roster), Development (three reports: per player on one metric, one player, per practice), Awards, Scouting Book. The Insights Dashboard's only development input is the coverage-nudge summary (`rosterCount`, `withMeasurable`).

### F05 — "When did we last measure X?" has no answer short of a column per metric · Code finding
Coverage's Recorded-on column is per player for the metric Show selects; the Overview's Sessions card names the last session's date only; `lastRecordedOn` on the wire is per player across all metrics. No surface says the last date a result was taken on each metric.

### F06 — The owner named the Overview as the home of team-level progress, and then ruled it state · Context
Both are on the record (ledger §185: "given the analytical nature of metrics… this is where you can see team level progress"; D7: "state, not analysis"). The proposal resolves it by leaving the Overview as ruled on its merits and putting the reading beside the other readings in Insights; the rail's computed report count is the door.

## 5. What "team trend" could mean — the candidates weighed

| Candidate | Names a child? | Honest denominator? | Verdict |
|---|---|---|---|
| A team average (or best-of average) per session, as a line | No — but on a thin sample it *is* one child's figure | No: the population changes between points (F03) | Rejected on the arithmetic first, the posture second |
| A per-player change column on Coverage ("8.62 → 8.28") | Yes — a figure beside every name | Yes | Rejected: a column of changes beside names is a ranking by eye; G1 fixed Coverage's shape |
| A mean or median of paired changes per metric | No | Yes (paired) | Rejected: hides the split (2 lower + 1 higher reads as "−0.18 s") |
| **Counts of direction per metric, rows are metrics** | No | Yes — said in the sentence | **Proposed** |
| A count per skill descriptor | No | Yes | Not proposed (T6): a rating distribution without names |
| A findings-strip sentence on the Insights Dashboard | No | Needs a threshold | Not now (T8): a nudge is a different instrument |
| Nothing — D8 stays parked | — | — | Legitimate; weighed in T1 |

## 6. The proposal

**A fourth report, "Team progress", in the Report field of Insights → Development**, addressed as the other three are (`?section=development&report=team`). The Report field reads Coverage · Team progress · Player progress · Practice review (whole → one). No second field.

**The count line first** (Coverage's rule, G1): "**4 of 12 players have at least one result or observation this season** · counts per metric, never a ranking." The denominator is the active roster — the same rows Coverage, the Overview's Players-measured card and the findings strip count.

**One table on the list recipe**, rows = metrics in library order (active first, retired under a collapsed "Show retired (N)" fold in the quiet ink):

| Metric | Players with a result | Since their first result | Last recorded | |
|---|---|---|---|---|
| 60-yd sprint · *seconds · lower is the aim* | 4 of 12 · 1 not assessed | 3 compared · 2 lower · 1 higher | 15 Sept | Coverage → |
| walk test · *seconds · lower is the aim* | — | — | — | Coverage → |
| Throw speed · *km/h · record only* | 1 of 12 | 1 compared · 1 higher | 3 Jun | Coverage → |
| Changeup speed · *mph · aim: 62–68 mph* | 1 of 12 | 1 compared · 1 moved into the range | 10 Jun | Coverage → |
| Sets feet before throwing · *skill* | 3 of 12 observed | — | 15 Sept | Coverage → |

*(Owner ruling A on the built screen, 2026-09-17: the frame's "Two or more" column — the players with two or more results, the denominator of the next cell — read as a bare number; it is gone, and the change cell says its own denominator first.)*

- **Metric**: the name; the unit and `aimSentence` as the sub-line (the Metrics tab's own words); "skill" for an observed skill.
- **Players with a result**: `N of M`; "· K not assessed" quietly when a session marked players not assessed and no result exists for them (the Coverage cell's own rule — a result always wins).
- **Since their first result**: "N compared" first — the players with two or more session rows on the metric, the only ones a change can be read for — then, for each of those, `statedChange(first, latest)` on the season window, counted by direction in the definition's own words — "lower / higher / unchanged" for a lower/higher/record test; "moved into the range / moved out of the range / in range on both / neither" for a range test. Zero counts are omitted; a metric with nobody at two or more shows a dash.
- **Last recorded**: the latest `recordedOn` any player has on the metric (an observation's `observedOn` for a skill).
- **The row's door**: the name and "Coverage →" open Coverage with Show set to this metric (`metricId`) — the names behind the count, in roster order; from there "Progress →" is one child's chart. The drill path is counts → names → one child, never the reverse.
- **A skill's row**: "N of M observed", the last observation's date, dashes elsewhere (T6).

**Under the table:** one legend — "— nothing recorded this season · Compared: the players with two or more results this season, each against their own first, in the test's unit · a single result is a point, not a change"; one disclaimer (G3's rule) — the sentence Player progress keeps, "A change in a test does not explain why it happened."; Coverage's "Record in Skills & Goals →" door for grant-holders.

**On a phone (≤640):** one card per metric, **two lines tall** — the name, then the counts and the last date beneath it, the chevron to Coverage on that metric. Coverage's one-line card (G4) does not fit: "4 of 12 · 2 lower · 1 higher · 15 Sept" is longer than a 390 line leaves beside a name (the first draft of the frame wrapped the name under the figures). The card is as tall as its words — the practices library's idiom — never a clipped name.

**Empty and thin states:** a team with no data sees Insights → Development's existing "Nothing to cover yet" (the Report field does not render). A metric with no result shows dashes. A metric with nobody at two or more shows a dash in Since-their-first; the legend explains. **No floor** on the direction counts (T4): the denominator says how thin it is.

**Who reads it:** every coach with record access (`canViewMeasurables`, the Insights → Development gate — the same as Coverage); skills ride the notes gate (`showGoals`) as they do on Coverage. **Never** on the handout, the family recap, or any family surface; no findings-strip rule in this version (T8).

**What does not change:** the Overview (T7) — its rail's "Reports in Insights" count is `developmentReports(...).length` and reads 4 for a coach with the schedule grant, 3 without (as today's 3 and 2). Coverage, Player progress, Practice review, the handout, the recap.

## 7. Read from the code — what the build must fit

- **One denominator rule.** Coverage (`coverageDenominator(recorded, rows.length, …)`), the Overview's Players-measured card and the Insights findings summary all count the board's `rows` — active roster players for the working season. Team progress counts the same rows; its count line takes the same sentence shape.
- **One series.** First-to-latest per player is `progressSeries(readings, def, { show: 'headline', compare: 'season' })` → `statedChange(first, latest)`: rows grouped per session through `groupBySession`, the headline per the definition (`headlineLead`), the change by arithmetic. The team count is a fold over that per player — the count of players whose Player-progress answer line says "lower" — so the two screens cannot disagree (the "one reader behind every number" guardrail, §185).
- **Counts on the wire, never per-player firsts.** The board route's wire shape is the no-ranking guarantee (its own comment on `inPlan`). The route gains a per-metric block — `{ withResult, notAssessed, withTwo, lower, higher, unchanged, intoRange, outOfRange, inRangeBoth, lastRecordedOn }` — computed in the existing per-(player, metric) walk and sent as counts. A per-player "first" never reaches the browser; Coverage's rows are untouched.
- **The report list is one list.** `DEVELOPMENT_REPORTS` / `REPORT_LABELS` / `developmentReports()` are read by the panel's Report selector *and* the Overview's rail count; a fourth entry appears in both by construction. `parseInsightsDevelopmentAddress` admits `report=team`; `insightsDevelopmentHref` carries it; the report's address carries nothing else.
- **The gate.** The panel renders behind `canViewMeasurables` (record access); the board route denies without it; skills are sent only with `showGoals`. Same as Coverage — a read must not sit behind the write grant (G1).
- **The vocabulary guard.** `tests/unit/development-vocabulary-guard.test.ts` `SURFACES` gains the new branch's file(s); the words used — "lower", "higher", "moved into the range" — are `statedChange`'s own; no "faster", "better", "on track", "improved".
- **Layout ids.** `scripts/layout-screens.mjs` gains `coach-history-development-team` at 1440 and 390 (the Insights development screens' existing rows are the model).
- **No migration, no new route.**

## 8. Decisions — ruled 2026-09-16, all eight Build as drawn ("I agree with your mockups")

| # | Kind | Decision | Recommendation |
|---|---|---|---|
| T1 | What goes in | Team progress is a fourth report in Insights → Development; the Overview does not change. Alternative: nothing — D8 stays parked. | Build. The gap is a screen the other tabs have; the counts cost no new read; "none has two results yet" is itself the actionable answer. "Not now" is legitimate. |
| T2 | Formatting | Rows are metrics, never players; four columns after ruling A (Metric · Players with a result · Since their first result · Last recorded); the row is a door to Coverage on that metric; retired under a fold; the name "Team progress"; the Report field order Coverage · Team progress · Player progress · Practice review. | As drawn, then A on the built screen (2026-09-17): the "Two or more" column read as a bare number — folded into the change cell as "3 compared · …". A fifth column is where a per-child figure would creep back in. |
| T3 | What goes in | Counts of direction in the aim's own words — never a team average, a mean change, a percentage or a chart. | Counts. F03 is the reason; a paired mean would still hide the split. |
| T4 | What goes in | No floor on the direction counts — the denominator says how thin it is. Alternative: hide the cell under three players with two results. | No floor. A report states its denominator; a nudge needs a bar. |
| T5 | Formatting | The season window — since each player's first result this season; no Compare control. | As drawn. |
| T6 | What goes in | A skill's row is coverage only — no count per descriptor. | As drawn. A distribution across judgment words is a rating table without names. |
| T7 | What goes in | The Overview is unchanged; the rail's report count reads 4 by computation. Recommended against: a Needs-attention line per metric. | Unchanged. |
| T8 | What goes in | Record access reads it (Insights' gate); never the handout, the recap, or the findings strip in this version. | As drawn. |

## 9. Evidence index — the fixture on 2026-09-16 (read-only probe)

- **Roster:** 12 active — Avery #1, Blake #2, Casey #3, Devon #4, Emerson #5, Frankie #6, Gray #7, Harper #8, Indigo #9, Jules #10, Kai #11, Logan #12.
- **Definitions:** 60-yd sprint (seconds · lower · best), walk test (seconds · lower · best, *active, no results*), Throw speed (km/h · record · last), Changeup speed (mph · range 62–68 · in_range), Sets feet before throwing (skill); retired: walk test (2 results), Shuttle run (2 results). The Overview reads "5 active".
- **Sessions:** 27 May (scope 1 metric, 1 player), 10 Jun (4 metrics, 5 players), 15 Sept ×2 (5 metrics/12 players; one empty).
- **60-yd sprint:** Avery 8.70 (10 Jun) → 8.75 (15 Sept) · 0.05 s higher; Blake 8.33 (15 Sept, one result); Casey not assessed (10 Jun); Devon 8.62 (6 May, bench) · 8.41 (20 May, bench) · 8.31/8.24 (10 Jun) · 8.28 (15 Sept) → 0.34 s lower; Emerson 8.55 (10 Jun) → 8.30 (15 Sept) · 0.25 s lower. **4 of 12 · 1 not assessed · 3 with two or more · 2 lower · 1 higher · last 15 Sept.** Session averages of headlines: 8.62 · 8.41 · 8.497 · 8.415 (F03).
- **Throw speed:** Devon 77 (6 May) · 82 (20 May) · 84 (3 Jun), all bench-side → 7 km/h higher. **1 of 12 · 1 · 1 higher · last 3 Jun.**
- **Changeup speed:** Devon 70·60·61 (27 May, 0 of 3) → 64·70·66 (10 Jun, 2 of 3) → moved into the range. **1 of 12 · 1 · 1 moved into the range · last 10 Jun.**
- **walk test (active):** no result. **Retired walk test:** Avery 2, Blake 3 (15 Sept). **Shuttle run (retired):** Avery 10.9, Devon 10.4 (15 Sept).
- **Sets feet before throwing:** Devon (10 Jun, "With a reminder"), Avery and Blake (15 Sept). **3 of 12 observed · last 15 Sept.**
- **Goals:** Devon — "First-step quickness off the bag" (working, review 24 Jun), "test" (working), "Two-strike approach" (parked).
- **Today's Overview** (rendered): Sessions 4 · 2 unfinished; Players measured 4 of 12 · 33%; Goals 2 working · 1 review due; Needs attention 4; rail Metrics 5 · Sessions 4 · Reports 3.

## 10. Built as (2026-09-16) — where the build departed from the frame, and why

| What | Built as | Departure from the frame or the plan, and why |
|---|---|---|
| The counts | `teamMetricCounts` / `teamSkillCounts` in `lib/development-report.ts`, computed in the board route's existing per-(player, metric) walk and sent as `team: Record<metricId, TeamMetricCounts>` — `{ withResult, notAssessed, withTwo, byDirection, lastRecordedOn }`, `byDirection` keyed by `changeDirection`'s own word (`lower · higher · unchanged · into · out · in_both · outside_both`), a key present only when its count is. A skill's counts only with `showGoals`; a test's only with `showMeasurables`. | `/simplify` collapsed the seven direction fields the plan sketched into one map, and `statedChange` was refactored onto the new `changeDirection` so the sentence and the count read one direction (byte-identical output, the review's regression lens confirmed). |
| The address | `report=team`; `DEVELOPMENT_REPORTS = ['coverage', 'team', 'progress', 'practices']`; `REPORT_LABELS.team = 'Team progress'`; a positive `REPORTS_WITH_METRIC` set (`coverage · progress`) replaces the panel's growing exclusion list for which reports carry `metric=`. | The set is the altitude lens's fix: a new report defaults to "no metric" without the panel learning it. |
| The table | `TeamReport` at the end of the panel, on the library's list recipe through the shared `LibraryTable` frame — four columns after ruling A (the change cell reads "3 compared · 2 lower · 1 higher" under "Since their first result"; `teamChangeSummary` prefixes `withTwo`): `tr.rowTappable` (the row is the door → Coverage on the metric), the name a link too, the unit · aim sub-line under the name (`cardDesktopLine`, hidden on the phone), the phone facts line (`cardPhoneLine`), the four figure cells (`cardDesktopCell`), a bare chevron in the corner cell. Retired metrics under the Metrics tab's own `<details>` "Retired (N)". | **Two departures, flagged:** the row's door is the list standard's bare chevron, not the words "Coverage →" (register K-19 — a row with ONE door does not name it); the retired rows sit under the `<details>` fold beneath the table, not a fold-row inside it (the same idiom one tab over). The reuse lenses asked for `LibraryTableRow` itself; its door is a button (`onOpen`), this row's is an href — extending it is left to the shared-stylings session (S6), whose file it is; the lead cell composes `libRowLead` so the phone card's line spacing matches the library's (76px, not 88). |
| The phone | One card per metric, two lines — the name, then "4 of 12 · 2 lower · 1 higher · 15 Sept" — the chevron at 44 × 44. | As the plan §6 says (the one-line card did not fit). |
| The shared stylesheet | `.tableAsCards .cardPhoneLine` (base and ≤640) instead of the bare class; `.cardDesktopLine` added beside it. | **Found on the way:** the bare `.cardPhoneLine { display: none }` lost to `.listRowSub { display: block }` on source order, so the practices library's phone facts line rendered on every desktop row ("20 min · Not in a plan yet" under every drill). Fixed once for both. |
| The Overview | Untouched; the rail reads 4 (3 without the schedule grant). | — |
| Help | "Insights → Development: the four reports" (a Team progress definition), a FAQ "How is my team doing overall — can I see a team average?", the Insights overview's list item, the guide's search terms. | — |
| Layout | `coach-history-development-team` at 361 · 390 · 768 · 1440; four portal-chrome rows baselined with the siblings' reason. | — |

**Verification:** plan §11's criteria all met on the fixture — see ledger §196.

## 10a. Expected at build (as written before the build, kept for the record)

No migration; no new route. The board route computes the per-metric counts in its existing walk; `lib/development-address.ts` and `lib/development-report.ts` gain the fourth report; the panel gains a fourth branch on the existing table chrome and a two-line phone card; the vocabulary guard gains the surface; layout rows at 1440 and 390; unit tests for the fold (direction counts per aim kind, the not-assessed rule, one-result players excluded from Since-their-first, the last-recorded date, a skill's row) beside `coverageDenominator`'s; help — "Insights → Development: the four reports" and the Skills & Goals guide's reports paragraph, via `/docs`; the demo tour has no beat on Insights → Development (no re-seed); `verify:changed` + `typecheck` (shared modules touched); `check:layout --only=` the Insights development screens; `check:demos`. Then `/simplify` → `/review` → `/docs` → the walk written onto this hub's QA tab → a private-index commit on the owner's say-so, deleting the consumed kickoff prompts.

## 11. Validation plan and success measures

- A coach answers "how many of my players have moved on X, and which way" from one screen, without opening a player.
- A coach answers "when did we last record X" from the same screen.
- No development surface — this one included — carries a figure beside one child that another child's figure can be read against; the vocabulary guard stays green; the wire carries counts, never per-player firsts.
- Team progress, Coverage, Player progress and the Overview never disagree on a count: the fixture's sprint row reads 4 of 12 · 3 · 2 lower · 1 higher · 15 Sept, and the three players' Player-progress answer lines read 0.34 s lower · 0.25 s lower · 0.05 s higher.
- The Overview is byte-for-byte unchanged apart from the computed rail count.

## 12. Planning deliverable verification

- Hub artifact `1omqXRfxFi8UsrCKXCcjN6` published from `docs/projects/active/COACH_TEAM_PROGRESS_VIEW_HUB.html`: the walk, two "today" frames (1440 + 390) drawn from rendered screenshots of the fixture, the proposed frame (1440 + 390), the team-average demonstration, the Overview after, decisions T1–T8 with Build as drawn / Change it / Not now controls and a paste-back, the brief and this plan as tabs; every flag, chip and tag clickable.
- This plan, the PM brief, one TODO.md line, and `COACH_TEAM_PROGRESS_VIEW_BUILD_PROMPT.md` (the build kickoff) written 2026-09-16. No product code changed; the two probe scripts were scratch and are deleted.
