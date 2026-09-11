# Coaches portal: development lifecycle assessment and proposed plan

**11 September 2026 · Source-based assessment · Implementation proposed · Round 2 code walk the same day (§15)**  
Owner direction: support **a mix of measurable tests and coach-observed skills**.  
Read first: [product brief](COACH_DEVELOPMENT_LIFECYCLE_PM_BRIEF.md). See the experience: the [project hub](COACH_DEVELOPMENT_LIFECYCLE_HUB.html) — mockup, brief, plan, decisions and (later) the QA walk on one artifact.

## 1. Assessment

**The portal is stronger at keeping development records than at helping a coach use them.** There are useful building blocks: a team test library, whole-roster assessment sessions, player focus areas, individual readings, previous-season records, a coverage report, and a printable summary. They already share the same underlying records. A replacement system would discard good work.

The missing connection is **define → observe → interpret → choose an action → review it**. Today a coach can enter “8.42 seconds” and “first-step quickness,” but the product knows little about the test method, the meaning of improvement, the evidence behind a goal, or when that goal should be revisited. Insights mostly answers whether records exist. It does not yet offer a strong answer to “How is this player progressing?”

The answer to the owner's concern about stacking is **yes, in specific places**. Skills & Goals renders sessions, a group of destination links, the editable test library and a practice pointer as a vertical sequence. Its first-use sequence changes after the first test is added. Within the player’s Development section, continuity prompts, a tryout snapshot, goals, measurements, previous seasons, context and printing accumulate. Insights’ Development panel stacks coverage, focus-tag gaps and practice recaps. These are related features, but they are different reasons to visit.

There has already been useful navigation work. Insights has addressable report tabs, and the player profile has task-based tabs. The proposal builds on those decisions instead of adding another global dashboard or restoring a side rail.

## 2. Scope, method and confidence

I walked the implementation as a head coach preparing a season, assessing a roster, setting individual goals, returning after practices, discussing progress, and starting the next season. I inspected page and component rendering, forms and mutation handlers, reporting calculations, API gates, database helpers, the checked-in development schema snapshot, help copy, previous owner rulings, and the existing `public/marketing/coach/coach-development.png` image.

**This was not a signed-in browser test or user study.** Interaction paths are inferred from code. No claim below establishes that real users are confused, how fast a page renders, or that a particular control fails on a real phone. The screenshot is illustrative evidence of an existing design, not proof of today's rendered application. The working tree contained concurrent edits, including the team board and Insights shell; this assessment used their current contents and did not modify them.

Three kinds of findings appear below:

- **Code finding:** a behaviour follows directly from the inspected implementation.
- **UX hypothesis:** the current design creates a plausible usability problem that needs observation with coaches.
- **Proposal:** a future capability or interaction, not something claimed to exist now.

The documentation and mockups are the deliverables for this task. No application feature, schema, account, external message or live record was changed.

## 3. Walkthrough as the head coach

| Stage and question I bring | What exists today | Where I get stuck | Proposed experience |
|---|---|---|---|
| Preseason: “What should we track?” | Your test list accepts a name and unit. Help distinguishes tests from focus areas. | No method, expected direction, precision or example result. Observed skills have no dedicated repeatable definition. | Metrics distinguishes measured tests and observed skills. Each definition explains what to record. |
| Set up my own test | Create it from the hub, player logging form or session. Rename, change unit, retire or restore it. | “Rename” also changes units. Later changes can alter the meaning of a series. | Quick setup with a live example; definitions with history preserve the method and unit under which each result was recorded. |
| Baseline assessment: “I have the team at practice.” | New session is created immediately. Select one active test and work down the roster; blur or Enter saves a result. | No planned set of tests or participant scope. All active tests appear. Blank can mean several things. | Set date, optional practice, chosen tests/skills and participating players; then enter one metric at a time. |
| Observe a technique | Add a free-text focus area or record a general player note. | There is no structured, dated skill observation linked to a goal and its definition. Typing “4 / 5” as a measurable would give a judgment the appearance of a physical test. | Record an observation with optional coach-defined descriptors and a short example of what happened. |
| Make a player plan | Add focus text and one note; tap the status to cycle Working → Achieved → Parked. | No success criterion, review date, linked evidence or sequence of check-ins. The status button changes immediately rather than offering a choice. | Keep the coach’s free-text goal; optionally add success, review date and evidence. Use an explicit Review goal action. |
| Return two weeks later | Player summary shows latest result, date and a small sparkline; click the test name for all readings. | No axis, elapsed-time spacing, meaningful delta, source session link or visible method. Goals retain current state rather than the conversation over time. | A selected test opens a dated chart plus records. A goal opens its review history and next coaching action. |
| Review the whole team | Team board shows goals and the most-used tests; Insights shows coverage. | Prominent test columns are chosen automatically. A recent “Last eval” may be one fresh test beside several old readings. | Let the coach choose a metric; show that metric’s date per row. Coverage remains about recording/planning, with roster order preserved. |
| Decide next practice | Practice plans and focus tags already connect to coverage; recaps can be revisited. | The goal form does not expose its supported grouping tag. The report offers a broad workbench link rather than a precise handoff. | Add the optional existing focus tag in the goal editor; open the relevant player or practice with context retained. |
| Talk to player/family | Download a current-season PDF containing focus areas and the dated test log. | No content preview or choice of what matters in this conversation; all notes in those records travel. | Preview a short handout with selected records and a coach-written next step. Optional appendix holds the full log. |
| Next season | Confirm identity; view prior seasons in place; explicitly carry working focus areas forward. | History is useful but buried. Carry is all working goals or a fresh start; test definitions remain team-wide. | Keep archived records clearly separate; make prior records easier to find and optionally choose which focus areas to bring forward. |

## 4. Findings that should precede richer analytics

### F01 — A sparkline can join incompatible units · P0 · Code finding

The type editor allows a unit change. Each reading correctly preserves its own unit, which is good. But `PlayerDevelopmentSection` groups by test ID and passes **only the numeric values** to `Sparkline`; it does not split by recorded unit. If “Throw speed” changes from mph to km/h, 50 and 80 can become one apparently rising line. No conversion is performed. The text log remains unit-labelled, but the line does not preserve that distinction.

**First fix:** suppress or separate a series when units differ, show why, and keep all readings accessible. A later definition model should preserve unit, method and interpretation as versions. Name changes that alter the test’s meaning also need a new version or a new test, not a silent rewrite of the old series. Historical method/direction must remain “not recorded” when unknown; adding a method today does not prove it applied to old readings. [Evidence E1–E3]

### F02 — Retained records can disappear from the session view · P0 · Code finding

The session API returns retired types and existing entries, but its UI uses only `types.filter(t => t.isActive)` for selection and display. Retire a test after a session and that test’s saved results lose their route through the session screen. The API also returns only currently active roster players, so a recorded participant who later becomes inactive disappears from the rendered roster. The data is retained; its review surface changes beneath it.

**First fix:** distinguish new-entry choices from historical display. Session review must show every test and participant represented by its saved records, with retired/inactive labels and appropriate read-only behaviour. Future sessions still start from current eligible players. A session’s expected-participant count needs an explicit definition before it can claim completeness. [E4–E5]

### F03 — “Practices you’ve run” can include a future plan · P0 · Code finding

The report uses `getRepTeamPracticesWithPlanOrRecap`, which excludes cancelled practices but includes any practice with a plan **or** recap. It has no past-date/completed-state filter, and the panel renders that list without another check. A future planned practice can therefore appear under a heading claiming it happened. Even a past plan alone does not prove it was run.

**First fix:** label the broad list “Practice review” and distinguish Upcoming plan, Past plan with no recap, and Recap recorded. Only confirmed completion evidence should support language about activity having happened. Keep planned coverage separately labelled. [E6–E7]

### F04 — Archive write protection differs between create and edit/delete · P0 · Source-level integrity gap

New goals and readings reject a player whose season differs from the current assignment. The goal PATCH/DELETE handler and reading DELETE handler check organization, team, player and head-coach permission, but do not apply that same season comparison. They call scoped database mutations using the admin client. On the inspected path, a current head coach with an old same-team player/record ID can reach mutations against historical records.

This is **not a claim of a live exploit or cross-team exposure**. The missing guard is visible in code; an authorized fixture should demonstrate its behaviour before implementation. Match the create boundary across edit/delete and test the old-season requests directly. History is only credible if “read-only” is enforced beyond navigation. [E8]

### F05 — Partial report failures can masquerade as absence · P1 · Code finding

The board API catches failures loading practices or tags and substitutes empty results. The UI does not identify those sections as unavailable. The practice query also defaults to a 200-record limit without a completeness notice or pagination in this report. A large season or failed query could make coverage look absent or incomplete without explaining why.

**Fix:** a report carries separate data states for available, empty, incomplete and failed. Never derive a gap finding from an unavailable or truncated input. Load the full intended reporting scope, or show the scope and continuation explicitly. [E6–E7]

## 5. Product and interaction findings

### F06 — The concepts are explained in help, but not enough at the decision point · P1

The help article usefully defines focus areas and repeatable tests. The test manager’s empty state explains objective measurements. However, once the library has entries, creation still consists of “New test name” and “Unit.” The UI alternates among Your test list, Test types, Tests, Measurables and Readings. “Goal” appears in navigation while “focus area” is the action. These labels are learnable, but they require more translation than necessary.

**Proposal:** use **metric** as the library umbrella only. Its two choices are **Measured test** (“a number you record using a repeatable method”) and **Observed skill** (“what you saw a player do, in a stated context”). Elsewhere use the concrete words: Record result, Record observation and Add goal. Explain that a goal is the focus the player is working toward; it may use either kind of evidence and can remain entirely narrative. Changes to visible labels require a help, search-keyword, demo and export copy pass together. [E1, E9]

### F07 — Observed skills need their own record type · P1

The current development schema has numerical readings and free-text goals; it has no distinct skill-observation log. A generic player note can hold the words, but does not give a reusable skill definition, dated criterion, link to a goal or an observation-specific report.

**Proposal:** start with dated narrative observations, optionally using descriptions written by the coach. Example: “Sets feet before throwing,” observed “with a reminder,” with the note “Used the routine after one cue during the partner drill.” Keep the context and author. “Not observed” is an evidence state, never the lowest proficiency level. Do not average descriptors, produce a skill score, or import tryout ratings into the observation timeline. [E2, E10]

### F08 — Goals are a current list rather than a reviewable journey · P1

Goals store focus text, note and status, with create/update timestamps. Updating a note replaces it. Updating status does not create a goal review event, evidence link or meaningful achieved date. The status pill cycles immediately. A coach cannot reliably reconstruct what changed, why it changed, or what was reviewed.

**Proposal:** retain lightweight focus creation. Offer optional “What would success look like?” and “Review on.” A review records a date, short observation, evidence links and a chosen status. Keep previous reviews. A measurable target is optional; crossing it invites a coach review, never automatically marks achievement. Existing `updated_at` must not be reinterpreted as “last reviewed” or “achieved on.” [E10–E11]

### F09 — The navigation paths stop short of the work they promise · P1

The hub’s team-board copy says to set focus areas and log results, but the board itself is read-only and links to the general player profile. From the profile, the user must locate Development on the “This season” tab. Player tabs are local state rather than an addressable development destination. The report’s general Skills & Goals link drops player/metric context. The current team board also chooses three or four test columns by usage, so the coach cannot directly select a less-used test there. [E12–E14]

*Round 2 correction (§15.1): the first draft said a collapse preference can leave the section shut. There is no persisted preference — the section opens by default — and a `?section=development` link already opens, scrolls to and highlights it. The exact address this plan asks for extends that link; it is not a missing mechanism.*

**Proposal:** keep one player record home, but support a precise URL selecting its Development content, metric/goal and originating report. The report and team workspace open that same destination. Back returns to the prior report and its filter. “Next player” follows roster order with the metric preserved. Avoid making a new player record inside Insights.

### F10 — Logging is efficient but save/recovery behaviour needs to be explicit · P1

The session supports one test at a time, decimal input, a saved checkmark, per-player saving state and empty rows that do not become zero. Those are sound choices. However, Enter blurs the field rather than visibly advancing, errors appear in one shared message, there is no whole-session pending/failed count, and the correction path removes the reading before re-entry. Drafts live in component state. No durable offline workflow was found. [E4]

**Proposal:** retain one-metric entry on phones. Make “Saved,” “Saving,” “Not saved—retry,” and “Not recorded” explicit. Keep failures beside the affected row, preserve failed drafts, and offer correction with a record of the change. Show “Next player” on touch devices and a clear keyboard sequence on desktop. Offer optional “Not assessed” with a neutral reason; do not infer absence from an empty row. A blank is neither zero nor a failed test.

Sessions should have an intentionally chosen scope. “4 recorded · 1 not assessed · 1 not recorded” can describe six selected players truthfully. Existing sessions without a saved intended scope cannot retroactively claim “complete.” A Review session step confirms what is recorded and what remains; it is not an approval ceremony before every entry.

### F11 — Tag-supported coaching connections are hard to establish from a goal · P1

The goal API and schema support an optional focus tag, and planning/coverage use it. The main player goal form sends focus text and note only; it neither displays nor edits the tag. This leaves an important connection unavailable where many goals originate. A tag on a practice can support “this topic appeared in a plan”; it cannot establish that a specific player’s goal was worked on or achieved. [E10–E11, E6]

**Proposal:** expose the existing optional focus tag in the goal editor using the existing tag picker. Add explicit observation-to-goal and plan-block-to-goal links only where needed; a tag match remains a topic match. Offer “Use in a practice” through the existing planner, preselecting context and asking the coach to place it. Do not silently rewrite a saved practice.

### F12 — The report reads as a checklist, while “development” suggests change over time · P1

Insights → Development contains no player progress chart today. Its table shows active-focus count, optional planned inclusion, latest measurable date and returning-player link. The player profile offers a 52-by-16 sparkline over the last ten numeric values. The sparkline spaces readings evenly by index, rescales each series to its own min/max and has no accessible interpretation; expanding the test shows exact records. It is useful as a cue but insufficient as the main analysis. [E3, E6, E12]

A single “Last eval” also overstates what is fresh. One recent sprint result does not refresh an older throwing result. Coverage is evidence that something was recorded or planned, not proof a child received adequate attention or improved.

**Proposal:** keep coverage as one report, add a player-progress report with labelled dates and a table, and offer practice review separately. Use per-metric dates and scope labels. Phrase findings as “No result recorded for this test in the selected period”; avoid “neglected,” “falling behind,” “on track” or any judgment unsupported by an explicit coaching criterion.

### F13 — The PDF is useful, but it is mainly a log · P2

The export already exists and uses shared PDF infrastructure and plainer family-facing labels, “Test results” and “Result.” It includes all current goals and readings passed by the player section, including notes. Tryout baseline data is correctly omitted. There is no development-report export control in the Insights panel, and no content preview before the player summary download. [E15]

**Proposal:** show a family handout preview containing selected goals, a short coach-written next step and selected dated results. Keep numbers and dates on the first page, with a full log appendix when requested; long content must paginate rather than shrink to illegibility. Preserve the current boundary: no peer figures, no tryout evaluation, no automatic delivery and no public link. An internal record export can carry more technical provenance under its own audience label.

## 6. Proposed information architecture

| Existing destination | Proposed organization | Main task and what is removed from the default view |
|---|---|---|
| Skills & Goals | **Sessions · Players · Metrics** | Sessions is the normal landing view; library editing moves to Metrics. A first-use invitation lives inside the selected view rather than rearranging the page. |
| Skills & Goals → Sessions | Session list and one primary Start session action | Recent sessions are records to resume/review. Their full history is searchable or paginated rather than an unbounded list above setup. |
| Skills & Goals → Players | The existing team-board job becomes a roster list with an optional metric selector | See focus wording or selected results with their dates; open the actual player record. No ranked sorting. |
| Skills & Goals → Metrics | Measured tests and observed skills, including retired definitions | Define and maintain the tools once. Editing happens here or in a focused contextual editor. |
| Player profile → Development | A directly addressable focus on **Goals · Results · Observations · Previous seasons** — INSIDE the existing Development section on the “This season” tab, as one segmented control | One selected body at a time; the profile’s three tabs (owner ruling 26 Aug: “three tabs, not nine drawers”) are untouched. Related attendance/playing time remains on the profile and leaves this section. The continuity prompt and carry-forward offer sit above the views; the tryout snapshot sits at the top of Goals. |
| Insights → Development | Report selector: **Coverage · Player progress · Practice review** | The existing seven-tab Insights navigation stays. Each report has its own scope and one main output, rather than three reports stacked. |
| Practice planner | Keep existing schedule/practice home, drill and template libraries | Skill/goal context flows into planning; development results remain records rather than being duplicated into plans. |

The workspace’s three choices can use the established coach tab pattern. Inside Insights, use a labelled **Report** selector, not a third row of tabs below the seven report tabs. On small screens, report and player selectors wrap as labelled full-width controls; preserve the active choice in the URL. The player record may initially retain its existing outer tabs and focus Development through a link; redesigning the rest of the profile is not required.

Drill and practice-template doors remain reachable as secondary links from Skills & Goals and the planner. Do not move or remove their canonical rooms during this project. The mockup intentionally draws only the relevant portion of the existing shell; it is not a global navigation redesign.

This layout changes previously agreed local arrangements. **Treat it as a proposed amendment**, with owner review of the mockup before a build, not an instruction to silently override the old design.

## 7. Definitions and recording contracts

| Concept | Minimum useful fields | Optional depth | Interpretation rule |
|---|---|---|---|
| Measured test | Name, unit, repeatable method, interpretation: lower/higher/within a range (with From and To in the unit)/record only, **attempts per session and which attempt is the headline** (ruled 11 Sep, §16) | Precision, plausible input bounds, grouping tag | A number only means what its recorded method and unit support. No age norms are invented. |
| Observed skill | Name and what the coach should look for | Coach-written descriptors, example behaviour, context prompts | Narrative evidence or named descriptors; never an averaged numerical score. |
| Result | Player, test definition version, value/unit, observation date, author, **attempt number within its session** | Session, event, context note | Date observed differs from time entered. Every attempt is its own record; best, average and spread are computed from them, never stored as facts. |
| Observation | Player, skill definition/version or free-text observation, date, author, observed description | Goal, session/event, descriptor | “Not observed” is separate from a descriptor. Conditions and observer matter. |
| Goal | Player, coach’s own focus statement, status | Success statement, review date, focus tag, linked test/skill, target with unit | Free text remains sufficient to begin. A goal can be valuable without a target number. |
| Goal review | Goal, review date, author, decision and note | Result/observation evidence references, next action/date | Append a dated event; do not overwrite the previous coaching conversation. |
| Session scope | Intended metrics, intended participants, date, optional event | Review state; neutral not-assessed reasons | Counts apply to its saved scope. Legacy sessions only claim what was actually recorded. |

Keep creation short: choose type, give it a name, describe the measurement/observation, see one example. Reveal unit/direction for tests and descriptor choices for observations. Advanced options stay under “More options.” Sport-specific suggestions may be offered later as editable examples deliberately chosen by a coach. Existing team libraries remain team-authored; no silent seeded defaults or universal benchmarks.

**Repeated tests — ruled 11 September (owner, §16): every attempt is recorded.** A test says how many attempts a session takes (one, two, three, up to five) and which attempt is the headline — best in the direction of the aim by default, average or last. The session grid takes one field per attempt; a blank attempt was not run. The rule that allows one reading per player per test per session becomes one per attempt. ⚠ **Everything that today counts readings as players must be re-derived per player** — the session’s “N of M entered”, the board’s latest-per-type, the coverage counts, the demo check’s N-of-M, the export’s rows — or three sprints will read as three players (the 10 September lesson from fundraising: when a uniqueness rule goes, find everything counting rows as people).

## 8. Reports and visualizations

Every report should answer a named question, state its player/team and current-season date scope, show its evidence coverage, and provide a route to the underlying records. A chart comes with readable text and a data table. These recommendations follow the [W3C guidance for complex images](https://www.w3.org/WAI/tutorials/images/complex/), which pairs summaries with detailed alternatives, and [ONS guidance on axes](https://service-manual.ons.gov.uk/data-visualisation/guidance/axes-and-gridlines), which makes time and scale explicit.

| Report / visual | Coaching question | Design and data needed | Priority |
|---|---|---|---|
| **Coverage checklist** | “What have I recorded or planned?” | Roster order, selected metric, dated result/observation presence; planned inclusion remains a flag. Team-level counts with named denominator and period. No performance heat colouring. | P1; build largely from current records, richer selection needs API work. |
| **Player test history** | “What changed in this test?” | Actual-date x-axis, labelled unit, visible point markers, selected comparable series and table. The line follows the headline per session; every attempt is a quiet mark at its own value and a row in the table. Latest vs selected earlier record stated in units. Optional explicit target line. | P1 after unit/comparability fix. |
| **Attempt summary** | “How did this player’s attempts compare within a session?” | Per session: every attempt, best, average and the spread between best and worst, all in the unit. Player-vs-self only; no team average beside a child. | P1 with attempts. |
| **Before-and-latest comparison** | “How do these two assessments differ?” | Two labelled points for one player and test, or two textual values. State both dates and conditions. Use “change,” not “trend,” with only two results. | P1; simpler alternative to a large chart. |
| **Observation timeline** | “What did I see, and in what setting?” | Dated entries with criterion/descriptor, coach attribution and context. No continuous line connecting ordinal labels or numerical composite. | P1 after observation records exist. |
| **Goal review timeline** | “What did we try and what did we decide?” | Goal created → observations/results → review decisions; next review and next action. Evidence links open their records. | P1 after review-event records exist. |
| **Assessment coverage matrix** | “Which planned checks are recorded?” | Roster rows, selected session/metric columns, neutral Recorded / Not assessed / Not recorded states. This is recording coverage only; no per-player percentage or severity sorting. Accessible list on phones. | P2; do not overload first release with a large grid. |
| **Practice review by topic** | “What did we plan, and what did we write afterwards?” | Plans and recaps filtered by date/topic; clear upcoming/past/recap state. Topic matching never claims goal completion or causal effect. | P1; fix existing source semantics first. |
| **Single-player review pack** | “What should this player and I discuss?” | Narrative, selected current-season records, readable print preview, optional log appendix. A full internal log may be downloaded separately. | P2. |
| **Same-player small multiples** | “How have several tests changed?” | Separate charts, each with its own labelled units and method; no shared composite score or mixed-unit axis. | P2 once single-test chart is understood. |

**Chart rules:**

1. One player, one comparable test definition and unit per series. Different versions are separate panels/series with explicit breaks, not an implied conversion. Unknown legacy methods should be labelled, with neutral presentation and no confident improvement claim.
2. Plot elapsed calendar time, not observation index. An interval with no planned assessment is simply time between readings. A scheduled but unrecorded assessment is explicitly missing; never impute zero or smooth through it as measured evidence.
3. Show no fabricated baseline. One reading is one point. Two support a difference, not a stable trajectory. More readings still do not prove causation or long-term change.
4. Direction is stated in words. “8.40 → 8.05 seconds; 0.35 seconds lower” is arithmetic. “Faster in this test” is appropriate only when the method is comparable and lower is the configured intent. “Better athlete” is unsupported.
5. Line-chart scale may be narrowed with clearly labelled ticks; avoid filling the area under a truncated axis. Avoid independently autoscaled miniatures that make tiny noise look like a dramatic change. Keep the scale stable while comparing the same test/window.
6. Targets come from the coach and show the chosen review date. No automatic “on track,” projected achievement date, age percentile or unexplained progress percentage.
7. Colour is secondary. Exact values, descriptors, dates and status words carry the meaning. Keyboard users can reach evidence details; a table remains available without hover.
8. Report/export calculations have one source. Changing filters changes the chart, summary and downloaded records together. Any omitted evidence is explained.
9. With attempts, the line plots the headline per session and every attempt is drawn as a small mark at its own value and listed in the table. Average and spread are arithmetic in the unit, shown on request, never a rating or a “consistency score.”
10. A range test (aim: within From–To) shades the band on the chart, fills the marks that landed in it, and draws the average per session as a dashed line. Its headline is attempts in range or the average — never “best”, because faster and slower both miss. The read-back says “moved into the range” or “2 mph above the range”; it never says faster, slower or better.

**Options I would not prioritize:** radar/spider profiles, player leaderboards, team-average comparisons next to children, goal-completion percentages, attendance-versus-improvement scatterplots, or AI-generated diagnoses of a player’s weaknesses. They add interpretation the current records do not justify and conflict with the product’s supportive, non-ranking direction. Descriptive summaries and direct evidence links are more valuable first.

Use disclosure for methods, provenance and full logs, while keeping the question and answer visible. This is consistent with [Nielsen Norman Group’s progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/); it does not mean hiding routine recording actions in a succession of accordions.

## 9. Other gaps and decisions

**Who writes — ruled 11 September (owner, §16): one “Development” grant on the staff card.** All development writes required the head coach (the 17 July rule). The owner replaced that with a single delegable grant: always on for the head coach, off by default for an assistant, switched on per assistant from the staff card, covering every development write — defining and retiring tests, starting sessions, recording results and attempts, goals, observations and reviews. Every record names who wrote it. Reading is unchanged: goals and observations ride the notes grant, results ride record access; attendance or notes access never implies write authority. The grant is a staff-card capability with presets, so it is coordinated with the staff-access project and built here because this release needs it.

**Data ownership and audience.** Tests are team-scoped and carry across seasons; player records are season-specific. Observations should inherit the stricter notes visibility. Exports must apply the same data gates as screens, and family previews must omit tryout and internal-only material. No new external sharing channel is proposed.

**Corrections and provenance.** Keep who entered a record, when it was observed, when it was entered and why it was corrected. Historical edit/delete guards come first. A correction mechanism should preserve the original without showing two active measurements. Existing hard-deleted records or overwritten goal notes cannot be reconstructed by a migration.

**Season continuity.** Preserve confirmed identity matching, no automatic merge, no cross-season progress calculation, and no tryout-baseline trend. Improve access to the existing archive and consider selected goal carry-forward. Never carry last season’s numerical readings into a fresh season to create an artificial baseline. Insights remains live-season scoped; archives remain in their established record surfaces.

**Offline use.** The current session depends on network writes. First improve visible failures, retry and navigation protection. Durable device drafts or offline queues need an explicit storage lifetime, team/player isolation, sign-out cleanup and conflict policy; they are a separate engineering increment. Do not label an unsent draft “Saved.”

**Reporting completeness.** A newly rostered player, an inactive player and a participant in a past session are different populations. Each report needs an explicit denominator. Do not compare “4 of 6” from a session against the current 8-player roster or use a lifetime latest-result date as the age of every metric.

**Maintenance and retrieval.** A library needs search and retired-state filtering once it grows. Session lists need date search and bounded loading. Reuse/copy tools should preserve original method and provenance, not multiply subtly different tests under the same name.

## 10. Implementation sequence

These are ordered work packages, not calendar estimates; effort depends particularly on definition versioning, correction records and observation permissions. Each build phase should have a product walkthrough before moving to the next.

| Phase | Scope | Exit condition |
|---|---|---|
| **0 — Trust in existing records** | Reproduce and fix F01–F05. Split incompatible units, expose retired/inactive session history, correct practice truth labels, enforce archive mutation guards, distinguish failed/truncated inputs. Write the first unit tests for the development routes (F21) — a failing test per finding before the fix. | Source-driven tests cover the boundary cases; owner walks the non-empty histories and report failure states. No new analytics claims yet. |
| **1 — Find and define** | Three-view Skills & Goals workspace; exact player/report links; selected-metric board; existing goal tag picker; definition editor with method/direction and a versioning strategy. | Coach can define a test, find a less-used metric and reach a named player without losing context. Legacy records retain honest metadata. |
| **2 — Record and review both kinds of development** | Observed-skill definitions and dated observations; attempts per test with a per-attempt session grid and a headline choice (§16), every player count re-derived from rows; session scope and save feedback; explicit goal review events; optional success/review/target fields; correction workflow. Same unit of work: the demo seed gains one observed skill and one goal review, the “Find the two blanks” tour sentence is re-narrated, the marketing-shot harness follows the profile’s new button label (F20), and the seventeen help articles get their label pass (§15.3). | Session and player entry feed the same records. Goals retain dated evidence and chosen status. Partial saves/retries and role access work. The demo check and the marketing-shot check are green with the new story, not the old one. |
| **3 — Explain progress** | Insights report selector; player test chart/table; observation and goal timelines; practice review; export preview. | Every conclusion opens its source, chart/table/summary agree, and a coach can explain the report in their own words. |
| **4 — Add depth where adoption warrants it** | Coverage matrix, same-player small multiples, team-authored reusable definitions, structured import, selective carry, optional durable drafts; delegated recording only after a separate ruling. | Each option has a demonstrated task, explicit data contract and a measured benefit. |

Some Phase 1 navigation and Phase 3 practice-review presentation can ship with Phase 0; the dependency is **data correctness before conclusions**, not a rigid large-bang release.

Technical planning constraints:

- Preserve the current canonical player and session records. Add observation/review records; do not fork a second dataset for Insights.
- Define migration rules from the actual schema snapshots/live dictionary, not old migration prose. Schema changes update the data dictionary and refreshed snapshots in the same implementation unit.
- Snapshot versioned method/unit/descriptor meaning. Existing history remains readable and no unknown meaning is backfilled as fact.
- Scope all reads/writes by organization, team, current membership and season as applicable. Recheck permissions server-side for reports, links and exports. Follow the current staff-access model rather than older comments. Every development write checks the Development grant (§16); the head coach always holds it.
- Keep current-season reports separate from archive access. No `?year=` addition to the Insights hub.
- Use established coach table, tab, dialog, export and tag controls. Match both warm and dark themes, number/header alignment and the touch target standard.
- Address report/player/metric state in URLs with safe, internal return destinations. Integrate with Next.js 16 navigation; preserve `proxy.ts`. The local linking/navigation guide was read for this plan.
- Invalidate affected mounted Insights panels after development mutations; tab retention must not leave successful new records invisible until a hard refresh. Handle team changes and stale requests.
- Publish no new full-season findings from a silently capped or failed read. Avoid fetching detailed history for all players just to draw a selected-player chart.
- Preserve session-date semantics: observed date and linked event are separate; moving an event does not silently move recorded results. Session re-dating and entry updates need consistent, transactional behaviour.
- New files/shared modules in implementation require the project's dev-server restart near browser handoff. This planning-only task adds no runtime modules and does not start or restart a server.

## 11. Validation plan and success measures

**Static and data tests during implementation:** mixed units under one test; method changes without unit changes; legacy unknown metadata; one/two/many readings; irregular dates; same-day results; retired test in a saved session; inactive participant; a new roster member; future/past/cancelled practices; plan without recap; recap without plan; unavailable tags; more than 200 practices; no goals; all goals parked; no active metrics; one, two and three attempts; a blank middle attempt; an average over fewer attempts than the test asks for; the headline switched per test; every N-of-M count with three rows per player; duplicate save/retry; correction and undo; archived create/edit/delete refusal; observations denied without notes access; cross-team IDs rejected; head-coach/assistant/money-only access; long PDF notes and multiple pages. Test producer-to-report/export agreement with the same fixture, not independently typed expected headers.

**Owner browser walkthrough after a build:**

1. Begin with an empty team library. Explain the two metric types and create one of each without the help drawer.
2. Start a session for selected metrics and players. Enter four results, deliberately leave one blank and mark one not assessed. Verify each count and save state.
3. Force a failed save, navigate between metrics and retry. Verify the failed value survives and no duplicate active record appears.
4. Record an observation and create a free-text goal with a success statement, focus tag and review date. Return later and review it using linked evidence.
5. Open Insights → Development → Player progress, select a player/test and date window, open the source record and return. Confirm player, report, metric and window are preserved.
6. Rename a test, change its unit/method, and retire it. Reopen the old session and player history; no records disappear and no incompatible line is drawn.
7. Make a participant inactive; their old session evidence remains reviewable. Add a player; old-session completeness does not silently change.
8. Review a future practice, a past plan with no recap and a recorded recap. Check that each title says only what the records support.
9. Open prior seasons and test the same record IDs through update/delete APIs. Historical records remain read-only. Carry only intended goals into the new season.
10. Preview and download a handout; verify exact values and selected notes, omitted tryout material, page breaks, legibility and identity on continuation pages.
11. Repeat core entry/navigation on 390px phone, 768px tablet and desktop, keyboard only and both themes. Check long names, 200% zoom, chart descriptions, focus return and controls near the mobile keyboard.
12. Verify the same scenarios as each relevant staff role and after membership removal. No button, report payload or export should widen that role's records.

**Usability targets, proposed rather than measured:** four of five coaches distinguish the concepts and create a valid definition unaided; four of five correctly explain a result change and a “not recorded” state; no user loses their selected player/report when returning from evidence; core recording time improves against a measured current-flow baseline without increasing correction errors. Track completion of the create → record → revisit → review loop rather than raw metric counts or goal-achievement rates. A team choosing fewer meaningful metrics is not a failure.

## 12. Mockup guide and decisions to review

Open the [project hub](COACH_DEVELOPMENT_LIFECYCLE_HUB.html) — its Mockup tab is round 2 of the design. It uses fictional players and results and performs no app/database writes. Every element carries a NEW / RESTYLED / UNCHANGED tag; every finding flag (red) and fix chip (green) is clickable and explains what it refers to — today’s behaviour, where you are looking, what the proposal does, and a jump to the finding here — and the walk is:

0. **Today** — five surfaces as built, drawn from the code, with the findings flagged where they show. The before to judge every proposal against.
1. Sessions as the everyday workspace, with Players (the team board, with a metric selector) and Metrics alongside it.
2. A metric editor switching between measured tests and observed skills, with the rule for changing a definition later.
3. A focused session keeping today’s date, “Taken at” and note controls, adding scope, row-level save states, “Not assessed” on blank rows and a review step.
4. The existing player record with four views inside its Development section: a goal list and the selected goal’s review history, results with the single-reading path, observations, previous seasons.
5. Insights Development with a Report selector: Coverage (every existing column kept, plus the metric), Player progress with a dated chart and exact-value table, Practice review with truth labels.
6. A concise handout preview with optional full-log detail.

The hub also offers a phone-width toggle for the embedded frame. This is a design illustration, not a verified responsive build of the real portal; the existing application shell remains outside its scope.

**Recommended decisions for the next build:** adopt the three-view workspace; support narrative observations with optional coach-defined descriptors; add optional goal criteria/review dates and explicit review events; keep development writes head-coach-only for the first release; add player progress inside the existing Insights Development tab; preserve the conservative family-export and season boundaries. The owner’s requested mixture of tests and observations is already recorded. The nine open calls from the round 2 walk are listed in §15.5 and on the hub’s Decisions tab, each with a recommendation.

## 13. Evidence index

Line anchors describe the inspected 11 September working tree; concurrent edits may move them. Code behaviour takes precedence over comments and archived plans.

| ID | Source | Relevant evidence |
|---|---|---|
| E1 | [TestTypesManager](../../../components/coaches/TestTypesManager.tsx) | `NewTypeFields`, name/unit editor, rename/retire/restore. |
| E2 | [types](../../../lib/types.ts) around 1857 and 1998; [development column snapshot](../../../docs/agents/db/schema-snapshots/schema-dump-columns-dev.json) | Definition, measurable, session and goal fields; unit snapshot; no development observation/review tables in this model. |
| E3 | [PlayerDevelopmentSection](../../../components/coaches/PlayerDevelopmentSection.tsx) around 481–494 and 689–730; [Sparkline](../../../components/charts/Sparkline.tsx) | Groups by type; last ten numeric values; equal index spacing, local min/max, hidden SVG. |
| E4 | [Session UI](../../../app/[orgSlug]/coaches/teams/[teamId]/development/sessions/[sessionId]/page.tsx) around 124–180 and 412–488 | Active-only selector; immediate entry/save states; current roster grid; remove then re-enter. |
| E5 | [Session API](../../../app/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/[sessionId]/route.ts) around 67–105 | Retired types included; current active roster filtered; saved entries included. |
| E6 | [Development report](../../../app/[orgSlug]/coaches/teams/[teamId]/history/development/panel.tsx); [board API](../../../app/api/coaches/[orgSlug]/teams/[teamId]/development/board/route.ts) | Coverage, focus-topic gaps and practice recaps; swallowed partial failures; latest-by-type summaries. |
| E7 | [database helpers](../../../lib/db.ts) around 8031 | Practice plan OR recap; cancelled excluded; no past/completed filter; default 200 limit. |
| E8 | [goal create](../../../app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/route.ts), [goal edit/delete](../../../app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]/route.ts), [reading create](../../../app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/measurables/route.ts), [reading delete](../../../app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/measurables/[entryId]/route.ts) | Create season comparisons; absent corresponding comparisons in inspected edit/delete handlers. |
| E9 | [coach help](../../../lib/help-content/coaches.tsx) around 3830–3907 | Definitions, current layout, retirement promises and head-coach-only writes. |
| E10 | [PlayerDevelopmentSection](../../../components/coaches/PlayerDevelopmentSection.tsx) around 197–258 and 591–669 | Goal form sends focus/note; status cycles; no tag editor or review history. |
| E11 | [goal input](../../../lib/development-goal-input.ts), [goal PATCH](../../../app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]/route.ts), [database helpers](../../../lib/db.ts) around 7496–7577 | Supported optional focus tag, current-state updates, timestamps. |
| E12 | [team board](../../../app/[orgSlug]/coaches/teams/[teamId]/development/board/page.tsx) around 136–229 | Usage-selected columns; general player-profile links; one overall last date. |
| E13 | [Skills & Goals hub](../../../app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx) around 360–460 | Board-copy promise; sessions/doors/library sequence; automatic first-use reorder. |
| E14 | [player profile](../../../app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx) around 151, 406 and 713; [Insights hub](../../../app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx) | Local player tabs, collapsible development, existing URL-addressed Insights tabs and retained panels. |
| E15 | [PDF exporter](../../../lib/export/pdf.ts) around 1565–1618; [player export caller](../../../components/coaches/PlayerDevelopmentSection.tsx) around 420–455 | Current-season goal/result tables, notes, existing PDF infrastructure; no tryout baseline passed. |
| E16 | [capabilities](../../../lib/coach-capabilities.ts) around 274–279; [player development read](../../../app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/route.ts) | Notes vs measurable visibility, head-coach writes, confirmed prior-chain archive and tryout gate. |
| E17 | [original development decisions](../archive/COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md), [Insights decisions](COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md), [Insights memory](../../../memory/project_coach_insights_reports_portal.md) | Existing player home, no ranking/cross-season deltas, head-coach write rule, live-season Insights and naming. Used as constraints, not proof of implementation. |

## 14. Planning deliverable verification

The report, brief and standalone mockup were checked for internal links, fictional-data arithmetic, local-only interaction scope and JavaScript syntax. No production code tests or full application sweeps are warranted by a documentation-only change. Signed-in interaction and visual verification remain part of the owner walkthrough above. See the task entry in [TODO](../../../TODO.md) for the completed assessment and the proposed implementation follow-up.

## 15. Round 2 — the code walk, and what round 1 missed

*Second session, 11 September 2026.* Every finding above was re-read against the working tree in the files the evidence index names, plus the surfaces around them that the first pass did not open: the demo seed and guided tour, the help articles, navigation, the season gate and the closed-season page, staff access, the schema snapshot, the player profile and the Insights hub. This section records what held, what was wrong, and what was missed. The mockup was revised in the same session; the hub carries the revised screens with NEW / RESTYLED / UNCHANGED tags and a “Today” screen drawn from the code.

### 15.1 Findings re-verified

| Finding | Verdict on the code | Correction |
|---|---|---|
| F01 units in one sparkline | Confirmed. The profile passes numeric values only; the rename dialog edits name and unit together; a unit edit affects future entries only, so a mixed series is ordinary. | — |
| F02 retired test / inactive player vanish from a session | Confirmed. The session API returns retired types and every saved entry; the screen filters to active types and the current active roster before drawing anything. | The help article promises that after retiring a test “every session you’ve already run stays right where it was and stays open.” True of the session; not of the retired test’s rows inside it. The help copy needs the same fix. |
| F03 future practice under “Practices you’ve run” | Confirmed. The query excludes cancelled practices and nothing else; the panel renders the list as returned. | — |
| F04 archive guards differ | Confirmed for goals and readings: create refuses a past-season roster row; edit/delete do not. Sessions are already safe — their resolver looks the session up inside the active season. | Narrower than the first wording: goal edit/delete and reading delete only. |
| F05 swallowed failures | Confirmed. Practice and tag reads fall back to empty on error; the practice read is capped at 200 with no notice. | — |
| F09 navigation stops short | **Partly wrong.** The Development section carries no persisted collapse preference (a page comment claims one; the component has none), and a `?section=development` link already opens, scrolls to and highlights the section. What holds: the profile’s tabs are local state, the hub’s board copy promises editing the board does not offer, and the board picks its columns by usage. | Drop the collapse-preference claim. The existing deep link is the base for the exact player/metric/goal address, not a gap. |
| F11 tag never exposed | Confirmed and sharper: the only screen that sets a goal’s tag today is the tryout “Start development from tryouts” card. Every goal added from the profile is untagged, so it is invisible to the practice planner’s focus-rail dimming and to the coverage report’s “haven’t appeared in a plan” list. | — |
| F10, F12, F13 | Confirmed as written. | — |

### 15.2 New findings

**F14 — The player record has a standing three-tab ruling the proposal must fit inside · P1 · Design constraint.** The profile is “three tabs, not nine drawers” (owner, 26 August): This season · Details · Family & paperwork, with Development as a collapsible section on the first. The proposed Goals · Results · Observations · Previous seasons views live *inside* that section as one segmented control — one section, one view at a time — never a fourth top-level tab and never four more drawers. The mockup now draws the outer tabs unchanged and says so.

**F15 — Existing session controls were undrawn · P1 · Mockup gap.** A session already has an editable date, an optional “Taken at” event whose choice pre-fills the date but never owns it, a session note that doubles as its title, and a re-stamp rule that moves readings with the session date after confirming the count. Round 1 drew the date as static text. Round 2 draws all three as UNCHANGED so a build cannot drop them, and the scope step joins them.

**F16 — The proposed player views omitted four built features · P1 · Mockup gap.** The continuity compare/confirm card, the one-time carry-forward offer, the frozen tryout snapshot, and the Context lines (depth chart, innings, attendance). Round 2 places the prompts above the views (they are prompts, not records), the snapshot at the top of Goals (it is what goals were chosen from, per the tryout-insights ruling), and retires the Context lines from this section: attendance and playing time have their own homes on the profile and were quoted here, never owned.

**F17 — Two everyday actions were missing from the proposed player views · P1 · Mockup gap.** A player can hold several goals and the profile adds one in two fields; round 1 drew a single goal card with no “Add”. Single readings from a notebook (today’s “Log a measurable”, with its own date and note) are a real path beside sessions; round 1’s Results view offered no way to record one. Both are back: a goal list with “Add goal” whose extra fields sit under “More”, and “Record a result”.

**F18 — The Coverage report dropped built, ruled columns · P1 · Mockup gap.** “In a plan”, the count-only finding line, “Focus areas that haven’t appeared in a plan” and “Returning player” are owner-ruled parts of the report (Practice Plans Phase 3; D4 Option B). Round 2 keeps them and adds the metric selector beside them.

**F19 — Requiring prose to change a goal’s status is a regression in disguise · P2 · UX.** Round 1’s review dialog made the observation text mandatory. Today a status change is one tap. Round 2 makes the status the required choice and the note optional; a review is still a dated event that never overwrites the previous one.

**F20 — Renaming “Log a measurable” breaks a build gate · P1 · Code finding.** The marketing-screenshot harness waits for that exact button text on the demo player’s Development section before it captures the coach-development shot, and that check runs inside the changed-files verification. Any label change on the profile ships with the harness change in the same unit of work.

**F21 — No unit tests cover the development routes · P2 · Test gap.** Nothing exercises the measurable-type routes, the goal routes, the session PATCH and its re-stamp, or the type manager; the only development assertions are nav gating, season-scoped lookups and family-payload boundaries. Phase 0 adds them before any behaviour changes — a failing test per finding first.

### 15.3 Surfaces the first pass did not look at

**Demo sandbox.** The coach demo’s off-season team is seeded with three tests, two dated testing sessions (“Fall baseline”, unlinked; “Post-holiday testing”, linked to a practice), readings with a deliberate improvement, and four goals with one achieved. Guided-tour step 2, “Find the two blanks”, lands on the Skills & Goals sessions card and says the players who missed “show a dash, not a zero.” The nightly reconcile restates session dates and their readings together, matching sessions by note. The prod demo check asserts the goal count, an achieved goal, two sessions on different days, one linked and one unlinked, the N-of-M tested shape, and that the showcase player got faster. Consequences for this project: the seed’s one-reading-per-session shape and the check’s N-of-M assertion must count players, not rows, once attempts exist (seed the showcase player with three sprints); the tour anchor on the sessions card must survive the tab restructure; the step’s sentence changes when blank rows read “Not recorded / Not assessed” and a session has a scope; the seed should gain one observed skill and one goal review so the demo shows what the release adds (the 10 September lesson — a headline moment absent from the shop window); and the mid-season team carries goals only, so the Players tab and Coverage must read honestly with no results at all. These are Phase 2 work items, not follow-ups.

**Help.** Seventeen articles describe this area. Labels to re-check when the build lands: “Your test list” → “Metrics”; “Test types” (still the profile’s label — a live split the help keywords already work around on purpose); “Log a measurable” → “Record a result”; the layout article that narrates the band stack and “Then go look”; the “who can do what” article; and the retire promise named under F02. One existing drift is unrelated to this project and worth a separate fix: the evaluation-sessions FAQ’s search text says “Development” where its rendered answer says “Skills & Goals.”

**Closed seasons.** A finished season is one page with four shelves (results, roster, practices, money) and nothing else renders; the only development door it carries is the read-only past-plan page. A player’s goals and results from a finished season are reachable *only* through a confirmed continuity link from a later season’s profile. A team that closes with no successor loses every read on its development record. This is a real gap and it is out of this project’s scope by rule — a fifth shelf needs its own mockup session — so it is named on the Decisions tab rather than lost.

**Staff access.** Pass 1 (built 10 September) gates the team board on record access with a plain “not granted” state. Pass 2 moves practice-plan, drill and template writes off the development write rule and leaves goals, readings, sessions, continuity and carry head-coach-only; its two new presets (manager, treasurer) cannot see goals. Nothing there changes who writes development, and the observation record inherits the notes gate exactly as the brief says.

**Navigation and addressing.** The sidebar item is “Skills & Goals” in the Progress group, gated on record access, and unit tests pin the name; Insights’ tab stays “Development.” Insights is addressed by `?section=` with panels that stay mounted, so a Report selector’s state and the selected player/metric ride the same convention. The profile answers `?section=development`; the exact address this plan asks for extends that, not a new mechanism.

### 15.4 What changed in the mockup between rounds

1. A **Today** screen: five surfaces drawn from the code (hub, session, team board, player Development section, Insights report), with the findings flagged where they show — the whole-screen before that the mockup rule requires.
2. **NEW / RESTYLED / UNCHANGED** tags on every screen.
3. **Workspace:** the library tab is “Metrics” (ruled); the Players tab gains the metric selector the plan promised; the drills, templates and practice-plan doors are drawn as the quiet links they are; session rows read “date — note” as today.
4. **Define:** a “changing a definition later” rule — rename keeps the series; a new unit or method starts a new definition and retires the old one with its history — in place of an undecided versioning strategy.
5. **Record:** date, “Taken at”, session note and the metric chips drawn UNCHANGED; a visible scope line; “Not assessed” as a link on blank rows only; Edit and Retry on a row; the review dialog offers “Back to Sessions.”
6. **Player:** the outer three tabs and the continuity/carry banner drawn UNCHANGED; the tryout snapshot inside Goals; a goal list with statuses and “Add goal”; the goal’s focus tag shown; the selected goal’s history names its origin (set with the player, carried from last season, seeded from the tryout); “Record a result”; a retired test’s readings still listed; the Context lines retired.
7. **Goal review:** status required, note optional.
8. **Insights Coverage:** “In a plan”, the finding line, uncovered tags and “Returning player” kept; Practice review keeps the tag filter and gains the three truth labels.

### 15.5 Open calls for the owner

Each is on the hub’s Decisions tab with a recommendation: the tab amendment to the 31 July hub ruling; the headline attempt’s default; the “no your” rule applied to the existing “Your drills” door; no version table for definitions; status-only goal reviews; “Not assessed” as a per-blank-row link; closed-season development out of scope, named; the demo tour re-narration in Phase 2; and the four views inside the Development section against the 26 August three-tab profile ruling.

## 16. Owner rulings during the round 2 review (11 September)

Two calls were made while reading the hub, and both change what round 2 drew.

**“Metrics”, not “Your metrics”.** Everything on the Skills & Goals screen is already the coach’s own — their sessions, their players — so “your” said it twice. The tab, the editor’s back link and every note now read Metrics. The concrete words elsewhere are unchanged: Record a result, Record an observation, Add goal. The existing “Your drills” door on the same screen says “your” for the same reason; applying the rule there is an open call, recommended yes in the same label pass.

**Every attempt is recorded.** A player who runs the 60-yd sprint three times in a session gets three numbers, kept individually, so best, average and spread can be computed later and any other analysis can be added without re-collecting data. What this changes:

- **Define.** A measured test gains *Attempts per session* (one, two, three, up to five) and *Headline result* (best in the aim’s direction, average, or last). The preview shows the headline with the attempts behind it.
- **Record.** The session grid takes one field per attempt; Enter moves to the next attempt, then the next player; the headline updates as attempts are typed; a blank attempt was not run. A player with fewer attempts than the test asks for is recorded with fewer — nothing is filled in, and the review step says so.
- **Player record and Insights.** Results lead with the headline and list every attempt with best and average per session. The progress chart follows the headline per session (switchable to average) and draws every attempt as a quiet mark at its own value, so spread is visible without a score. The handout names the headline and, in the log, the attempts behind it.
- **Records.** A result carries an attempt number within its session, and the current one-reading-per-player-per-test-per-session rule becomes one per attempt. Best, average and spread are computed, never stored.
- **Counting.** Every place that counts readings as players must be re-derived per player before attempts ship: the session’s “N of M entered”, the board’s latest-per-type, the coverage counts and finding, the demo check’s N-of-M and “got faster” assertions, the export’s rows. This is the same class of defect fundraising hit on 10 September when its uniqueness rule went.
- **Attribution.** “Entered by” on every reading and “written by” on every goal, observation and review, since a delegated assistant can now write any of them.
- **Demo.** Seed the showcase player with three sprints on each testing day so the shop window shows the feature; the tour sentence for “Find the two blanks” already changes for the state labels and can name the attempts in the same edit.
- **Boundaries unchanged.** Roster order, no ranking, no team average beside a child, no “consistency score”: spread is a number in the unit, shown on request.

**One “Development” grant covers every write (owner, superseding the same day’s results-only widening).** “Make an access option to write to development and have that cover all of the writes — metrics, notes, goals, etc. — so that when this is released, if a head coach wants to delegate this they can. Read can stay with all coaches.” The staff card gains a Development toggle beside attendance, lineups, notes, money, documents, tryouts and schedule; the head coach holds it always and cannot remove it from themselves; an assistant has it off until the head coach switches it on. On, it covers defining and retiring tests, starting sessions, recording results and attempts, goals, observations and reviews; off, the assistant reads what their other duties allow, as today. Every record names who wrote it, on the row and in the record. The build adds the capability and its presets (coordinated with staff-access pass 2, whose four presets carry it off), and rewrites the development write policies — head-coach-only from birth — to check the grant.

**The range aim, kept and drawn (owner, over a recommendation to drop it).** Lower, Higher and Record only cover the sprint and the throw; a range is for a test where the target is a band, such as a changeup that only works between 62 and 68 mph. Choosing it reveals From and To in the test’s unit. Capture does not change — the coach types each attempt — but each attempt reads “in”, “+2” or “−3” against the band; the headline is attempts in range or the average, never best; the player’s results and the handout say “2 of 3 in range”; the progress chart shades the band, fills the marks inside it and dashes the average; and the read-back says “moved into the range”, never faster or slower. Cost: a third summary shape in every place a headline appears (rows, chart, handout, export), which is why it was recommended for later.
