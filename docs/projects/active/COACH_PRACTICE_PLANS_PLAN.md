# Practice Plans — Implementation Plan (Player Development, roadmap Phase 4)

> ### ✅ PHASE 3 — "the visible half" BUILT 2026-08-02, UNCOMMITTED on `dev`, owner QA pending
>
> The foundation (migration **221**, the shared `kind='focus'` tag vocabulary) was committed
> separately as `18f05650`; **everything a coach can SEE is this build.** Mockups
> `claude.ai/code/artifact/7ac29440-1e16-4b0e-a22b-9e0093470107` (12 frames), signed off 2026-08-01.
> ⚠ **Migrations 213, 218 and 221 are ALL DEV-ONLY** and every one must reach prod before any of
> this promotes.
>
> **What shipped:**
> · **The plan-template room** (`…/development/templates`) — one flat list narrowed by tag chips,
>   rename / retire / restore, "Add from a past season", and its empty state offering all three
>   routes · **its own full block-and-station editor** (`…/templates/[templateId]`), which is
>   frame 03's accepted cost: "New template" is offered at zero, and a template built from scratch
>   has no practice to inherit a shape from.
> · **"Save as template…"** on a plan — one optional question, copies, changes nothing about tonight.
> · **"Start this plan from…"** — 1a's copy-from-a-previous-practice control WIDENED to two tabs
>   (a template *or* a previous practice), plus the D14 provenance line.
> · **"How it went"** (D17) — one recap per practice, `rep_team_events.practice_recap`.
> · **The plan's own tags** — the free-text "Kind of practice" control is RETIRED and replaced by
>   the shared picker writing `rep_team_event_tags`. Legacy `plan.practiceTypes` is still READ (so
>   old plans keep matching the focus rail) and rendered as "Also tagged"; nothing writes it.
> · **Three new Development-report sections** — coverage ("In a plan"), the focus-area tags no plan
>   was about, and the tag-filtered "Practices you've run". The report is now season-aware.
> · **⚠ THE NEW ARCHIVE DOOR** — `…/history/development/practices/[eventId]`, one read-only past
>   plan reached only from that list, served by a GET-only route
>   (`events/[eventId]/practice-plan/read`) now in `APPROVED_SEASON_AWARE_ROUTES`.
> · **Tag management** (frame 11) — the existing `TagManagerModal` pointed at new
>   `focus-tags/[tagId]` + `focus-tags/merge` routes.
>
> **Also done, and asked for:** the `/simplify` TODO on `focus-tags/route.ts` is **discharged** —
> the three near-identical tag route groups collapsed into `lib/coach-tag-routes.ts`, which now
> serves all FIVE (game, expense, focus × collection/item/merge). ⚠ Its `seasonAwareRead` flag makes
> each library's archive posture a declared decision, and the write-guard test was taught to read
> that flag so collapsing the routes could not blind the guard.
>
> **Verification:** typecheck ✓ · lint 0 errors · **913 unit tests ✓** · all colour baselines still
> ZERO · date-correctness ZERO · dictionary ✓ · org-context ✓ · **18/18 Playwright computed-style
> probes green at 361 / 390 / desktop** (`tests/uat/scenarios/plan-templates-layout.spec.ts`) ·
> clean dev restart. ⚠ Schema-parity fails as it did before this build — migs 213–221 are dev-only.
>
> **Two deliberate probe decisions, recorded so they are not re-litigated:** `.ppSuggestChip` is a
> SHARED primitive shipped in Phase 2 at ~21px and is deliberately NOT in the tap-floor selector —
> widening it would change four committed surfaces. And a `present: false` coverage column is a
> PASS, not a skip: on a team with too few plans the column is *supposed* to be absent.
>
> **Status:** ✅ **PHASE 1a COMPLETE — owner QA PASSED 2026-08-01, committed on `dev` (`c0ecebe2`).**
> ✅ **PHASE 1b ("Run it") BUILT 2026-08-01 — UNCOMMITTED on `dev`, owner QA pending. NOT on prod.**
> ⚠ Migration 213 is dev-only and must reach prod before either is promoted. **1b adds no storage.**
>
> **What shipped in 1b:** the field run screen at `…/practice/[eventId]/run` — one block filling the
> phone, the countdown, the "Up next" line, a ≥56px **Next block** / **Rotate now** pair · the
> rotation carousel (group → station → who's running it, with an amber "Rotation due" state that
> waits) · **"My station"** + the station picker (D28) · **"Who's here tonight"** folded shut and
> `attendance`-gated (D8) · a `practice_plans` Basic-coach interest option · a new
> **`premium-practice-run`** help section. **Nothing is written at the field (D4); nothing beeps,
> buzzes or auto-advances (D26).**
>
> **Also closed in 1b — the §11.1 archive dead-end (owner-approved 2026-08-01):** the schedule
> slide-over's practice-plan section is **absent in a completed season**, so neither "Open the plan"
> nor the new "Run practice" can dead-end. Option chosen: *hide both doors*, per the binding
> "the archive is OPT-IN" ruling. Making plans genuinely readable in history remains available as a
> later decision — the work is listed in §11.1 and is gated on the two build-enforced allow-lists.
>
> **⚠ The UAT probe harness is FIXED (2026-08-01).** Two sessions blamed an "orphaned `rep_teams`
> row"; both were wrong. The real cause was **one missing `organization_members` row** for the UAT
> coach — the portal resolves org context before coaching assignments, so an assigned coach who is
> not an org member resolves no org and every team lookup comes back empty. Repaired idempotently by
> **`scripts/seed-uat-coach-fixture.mjs`**, which also seeds a probe practice shaped to exercise the
> whole surface. **This unblocks Playwright probes for the entire coaches portal, not just this
> feature.** ⚠ A secondary lesson recorded in that script: an unchecked supabase-js `select` with a
> wrong column name returns an error, not rows — which is how "the coach has no assignment" was
> mis-diagnosed. Always check `error` before believing an empty result.
>
> **Verification (1b):** `/simplify` (9 cleanups — the heaviest was a rotation grid being recomputed
> every second) → `/review` high-risk, 5 lenses (**6 findings confirmed and fixed**, 0 refuted; the
> security lens found none) → `/docs` (a new run section + 2 FAQs, and three stale-1a corrections
> the owner-QA revisions had left behind) → probes. typecheck ✓ · lint 0 errors · **786 unit tests ✓**
> · all colour baselines still ZERO · date-correctness ZERO.
>
> **Next: Phase 2 — the drill library.** The 1b build prompt
> ([`COACH_PRACTICE_PLANS_PHASE1B_BUILD_PROMPT.md`](COACH_PRACTICE_PLANS_PHASE1B_BUILD_PROMPT.md))
> is now spent.
> Planning complete and all 30 decisions (D1–D30) owner-accepted 2026-07-31; all five mockup rounds
> accepted and binding. Final phase ladder in §9.2. The overdue release was promoted first
> (prod moved to the 2026-07-31 changelog commit) before the build started.
>
> **What shipped in 1a:** the plan on the practice event (goal + kit · blocks with
> description/goal/flexible duration/staff/players/coaching points · stations · groups incl. the
> random draw · rotation blocks with the computed group×round grid) · the focus rail ·
> copy-from-a-previous-practice · the one-page printed sheet incl. the rotation grid · D10 (the
> evaluation-session editable date, the event link, the re-stamp confirm, and the practice's
> "Recorded here" section) · the Development hub pointer line (D9) · the schedule slide-over summary.
>
> **Migration 213** (`rep_team_events.practice_plan` + `rep_team_evaluation_sessions.event_id`)
> is **APPLIED TO DEV ONLY**. ⚠ **It must be applied to PROD before this code is promoted** — see
> the §7 release rider. The schema-parity gate currently reports the expected 4-row divergence.
>
> **Two deviations from the letter of the plan, both deliberate — see §10.3.**
>
> **Verification:** `/simplify` (12 cleanups, 2 of them real defects) → `/review` high-risk, 5 lenses
> (14 findings confirmed and fixed, 1 refuted) → `/docs` (a new `premium-practice-plans` guide section,
> a `faq-session-change-date` FAQ, and in-context help on the builder). typecheck ✓ · lint 0 errors ·
> 40 practice-plan unit tests ✓ · dictionary + snapshots refreshed ✓ · clean dev restart ✓.
> ⚠ **The Playwright computed-style probes (361/390/desktop) are WRITTEN but could NOT run** —
> `tests/uat/scenarios/practice-plan-layout.spec.ts`, needs `PROBE_EVENT_ID`. The UAT coach fixture is
> **orphaned**: `rep_teams` row `3127a094…` points at an `org_id` that no longer exists in
> `organizations`, so no coach resolves an assignment there and every probe lands on "Not assigned to
> any teams". **Pre-existing UAT environment breakage, unrelated to this feature.** Repair the fixture
> (or point the spec at a live team) and the probes run unchanged. Layout therefore rests on owner QA
> for this slice.
>
> **NOT built (correctly out of scope):** the field run screen and "My station" (1b) · the drill
> library (Phase 2) · the plan library, "how it went", the coverage answer (Phase 3) · Helpers
> (Phase 4, gated).
> **⚠ SCOPE ADDED AFTER PLANNING (2026-07-31): D10 — the evaluation-session date + practice link.**
> The owner deferred it into this project rather than shipping it standalone, so the practice↔development
> seam is designed once. It is **NOT in the round-1 mockups — a round 2 is required before build.**
> Read **§10.1** before touching the mockups or the data model; it contains a trap (readings are
> date-stamped at entry time) that a date field cannot ship without handling.
> **Branch:** `dev` (single shared branch).
> **PM brief:** [COACH_PRACTICE_PLANS_PM_BRIEF.md](COACH_PRACTICE_PLANS_PM_BRIEF.md)
> **Mockups (round 1, AWAITING OWNER ACCEPTANCE; does NOT cover D10):** https://claude.ai/code/artifact/34f5affe-162d-4b2c-8fb0-bb83e715d48e
> — every open decision drawn, recommendation beside the viable alternative (D1 options a/b/c · the
> couch builder + focus rail + first-run state · D2 links coexistence · D3 assistant with/without
> notes access · D4 read-only field screen vs tick-boxes · D5 copy-picker · D7 one-night-only plan ·
> the printed sheet · D9 pointer line). **Once accepted, the mockups ARE the binding visual spec.**
> **Mockups (round 2, AWAITING ACCEPTANCE — covers D10 + D11–D17):** https://claude.ai/code/artifact/1a76bcf4-22f3-4b8f-90e9-387180742363
> — block ▸ station ▸ pair anatomy drawn from the owner's real U13 White plan · staff tags incl.
> non-portal guests · flexible durations · template load semantics · the plan library room with usage
> history + "how it went" · the drill picker · the type-filtered focus rail · D10's date + practice
> link + re-stamp confirm + the practice's "Recorded here" return section · the revised field screen
> with station cards · the four-release ladder.
> **Mockups (round 3, AWAITING ACCEPTANCE — covers D18–D22):** https://claude.ai/code/artifact/161e903c-0f82-45bf-868c-635789252d7e
> — the four doors a coach meets a drill through (pick · write · promote · manage), the drill preview
> before adding, the full drill record incl. **coaching points**, the rejected auto-save library, the
> complete station editor (name · count · kit · staff · players · rotation · note), the grouping
> control with its attendance-aware contingency, and coaching points on the field screen.
> **Mockups (round 4, AWAITING ACCEPTANCE — revises D21/D22, adds D23–D26):** https://claude.ai/code/artifact/79105552-11b2-4498-b810-fddc88730cac
> — groups of any size drawn at random (N groups / N per group, reshuffle, uneven splits stated), and
> **the station-rotation carousel round 3 could not model**: the rotation block builder, the computed
> group×round grid, the field screen mid-round and rotation-due, and the printed rotation grid.
> ⚠ **Round 4 found a real gap in round 3** — see §9.1.
> **Mockups (round 5, AWAITING ACCEPTANCE — adds D27–D30):** https://claude.ai/code/artifact/58319358-e3dd-48a6-942b-05ed4d1701df
> — the full station field list with **where each field comes from** (drill = shape + teaching;
> practice = people, timing, tonight's note), a new **Setup** line on the drill, the **"My station"
> view** (the assistant's run screen), the station picker, and **helper access** — the rejected
> shareable link drawn as the risk it is, versus an invited "Helper" preset. See §8.1.
> **Kickoff:** [COACH_PRACTICE_PLANS_KICKOFF_PROMPT.md](COACH_PRACTICE_PLANS_KICKOFF_PROMPT.md)
> **Parent project:** [COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md](../archive/COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md)
> (Phases 3A–3D shipped 2026-07-17; every constraint in that plan is still binding here.)
> **Surface:** Premium Coaches Portal → Schedule → a practice event. Gate = the Premium Coaches
> Portal entitlement per `docs/agents/strategy/PLAN_PRICING_FACTS.md`. **No new gate, no new SKU,
> no price change** — confirm against the Facts doc at build, never restate a price here.

---

## 0 · What the repo says that the kickoff brief didn't (trust the repo)

Four things were verified against the code and the decision log and differ from, or add to, the brief:

1. **The Development hub restructure has no plan file yet.** `docs/projects/active/COACH_DEVELOPMENT_HUB_RESTRUCTURE_PLAN.md` **does not exist**. The restructure lives only as the owner-approved mockup artifact `f84317a8-3596-4fc0-b1fa-76d81bb9a750` (dated 31 Jul 2026, marked *"Awaiting owner approval"* in its own masthead), and there is **no `design_decisions.md` entry for it**. The live code still renders the dashed **"Practice plans — coming"** placeholder card (`app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx`, the `devSlotCard` block). **Implication:** the retirement of the reserved slot is real but *not yet built or logged*. This plan is written to be correct either way — see D1 — and the practice-plans line at the foot of the restructured page becomes a **live pointer**, not a "coming soon" note.
2. **The IA rubric named in the brief ("Dashboard / Manage / Operate / Review / Admin") is not the portal's literal nav taxonomy.** The real groups in `CoachesSidebar` / `CoachesBottomNav` are **Overview · Squad · Season · Money · Communication · Team admin**, with four phone primaries (**Overview · Schedule · Chat · Roster**) plus More. The anchor decision in §3 is argued against the *actual* groups; the rubric's spirit (one room per job-shape, no new top-level doors) is honoured.
3. **The touch floor is 44px, not 40px.** `--tap-min: 44px` is the single settled floor (Chunk C); the brief's "≥40px (≥36px in dense grids)" is the older 2026-06-29 convention. **44px binds**, and the field view raises its own primary control well above it (§5).
4. **Parent-facing practice visibility is *not* permanently closed** — `BUSINESS_DECISIONS.md` 2026-07-11 (G3/G4) narrowly reopened the deferral for **verified family links + team chat + practice-schedule visibility**, gated at Premium and blocked behind a PIPEDA/CASL review. That decision covers the practice *schedule*, not a practice *plan*. **This project stays strictly coach-facing** (binding constraint), but the data shape in §7 is deliberately not hostile to a future family-visible read — no design work, no surface, no promise. Flagged so a build session doesn't "discover" G3 and widen scope.

---

## 1 · The honest question

> *A volunteer coach has ninety minutes on a field on Tuesday night and twelve kids each working on
> something different. What does this product hand them that a Google Doc doesn't?*

**Where the Doc genuinely wins, and we should not fight it:**

| | Doc | Us |
|---|---|---|
| Free-form authoring on a couch | **Wins** — infinitely forgiving, zero learning curve, already open | Structured fields are slower to type into |
| Formatting, diagrams, pasted images | **Wins** | Out of scope forever |
| Sharing with assistants | **Wins** — one link, no accounts | We need them on staff with the right capability |
| Works when the app is down / no login | **Wins** | Requires the portal |

**Where the Doc cannot compete:**

| | Doc | Us |
|---|---|---|
| Knows who is on the roster | No | Yes |
| Knows who replied "coming" to Tuesday | No | Yes (attendance, per event) |
| Knows what each of the twelve is working on | No | **Yes — focus areas, per player, live** |
| Sits on the event beside arrival time, field #, map link | No | Yes |
| Readable at arm's length in sun, one hand, gloves | **Genuinely bad** | Yes (the run view) |
| Can answer "whose focus area has never appeared in a plan?" | Never | Yes, afterwards, in roster order |

**Conclusion — and it sets the scope:** the authoring half is a *tie at best*. The value is concentrated at the two ends — **writing the plan next to the development data**, and **reading it at the field** — plus one after-the-fact question no document can answer. V1 buys exactly those three things and nothing else. Everything cut in §11 was cut because it is "a text editor with our logo on it."

---

## 2 · The practice job map

| Stage | Primary job | What they need in front of them | Device / conditions | What they do today | Opportunity |
|---|---|---|---|---|---|
| **The week before** | "What is this team working on this month?" | Focus areas across the roster; who hasn't been looked at | Desktop or phone, at home, unhurried | Carry it in their head | **LOW — already shipped.** The Team board + the `/history/development` coverage report answer this. Do not rebuild. |
| **The night before** | "What are we doing Tuesday?" | Last week's plan · the twelve focus areas · who's coming · how long we have | **Phone, on the couch, TV on, ~4 minutes of attention** | Notes app / Google Doc / laminated card / wing it | **HIGH — but only because of the join.** A blank structured form is *worse* than Notes. A form with the roster and their focus areas beside it is better. |
| **At the field** | "What's next, who's at which station, how long left?" | One block at a time, big, no reading | **Phone, one hand, direct sun, possibly gloves, twelve kids** | Pinch-zoom a doc in a browser tab, or memory | **HIGHEST value per unit of build.** The Doc is genuinely bad here and the constraints are harsh — this is where we win outright. |
| **After** | "Did it happen, and is anyone quietly getting missed?" | Honest record of what was *planned*; coverage across recent practices | Phone, in the car, 30 seconds | Nothing | **MEDIUM — and the honesty risk lives here.** A plan proves what was *planned*, never what was *done*. §4 holds that line with language rules. |

**The design consequence:** V1 is two screens and a sheet of paper — a **couch screen** and a **field screen** — plus a quiet coverage answer. Stage 1 is already built; stage 4 is one honest sentence, not a dashboard.

---

## 3 · The anchor decision (D1)

The reserved hub slot is being retired. The anchor is decided on merits, against the portal's *actual* groups.

### (a) In Development (the originally reserved home)
- **For:** adjacent to focus areas and the test list; the hub is already the "team-wide development work" room.
- **Against — decisive:** a practice is a **date**, and Development owns no calendar. The coach's Monday-night question is *"what are we doing Tuesday"*, and Tuesday only exists in Schedule. Development is also gated on `notes || roster` — an assistant granted **schedule only** (a normal, common grant) would never see the hub, so the station-running assistant is locked out by construction. And the hub is being restructured *precisely because it read as an unordered mosaic*; adding a fifth thing to it re-creates the disease the restructure cures.
- **Verdict: rejected.**

### (b) On the practice event in Schedule — **RECOMMENDED**
- **For:** it is where the coach already is when they think about Tuesday. Schedule is a **phone bottom-nav primary** (one tap, no More menu). The event already owns date, arrival time, field/diamond, location + map, notes, resource links, recurrence, and **attendance** — a practice plan is plainly *another thing about that practice*, not a parallel calendar. Assistants see it through the `schedule` capability they already have. It costs **zero new navigation**, which the binding rule requires.
- **Against:** far from the development data.
- **The mitigation is the whole product idea:** the join travels *to* the plan. The focus areas come to the builder as a reference rail (§4); the plan does not travel to Development.
- **Verdict: ship this.**

### (c) Split — reusable library in Development, attached from Schedule
- **For:** the right long-term shape if reuse demand is real.
- **Against:** the library is the only part needing a new table, and it is the part with the **least evidence of demand**. The actual observed coach behaviour is *"same as last Tuesday, minus one block"* — which is served far more cheaply by **"Copy from a previous practice"** (a picker over this team's own past practice plans, no new storage). A curated library is a librarian's feature sold to someone with four minutes and a TV on.
- **Verdict: not V1. Phase 3, only on demand** — the V1 data shape makes it an additive change, not a rebuild.

### What Development keeps
One line at the foot of the restructured hub — replacing the retired dashed card and the "coming in a later phase" copy — pointing at the real destination:

> Practice plans live on each practice in your **Schedule** →

That is a pointer, not a room. It satisfies "the feature is findable from where it was promised" without minting a second home for one job (the single-home rule, 2026-07-14).

---

## 4 · The development join — the differentiator, and how it avoids ranking children

### What the product knows
Active focus areas per player with status (Working on it / Achieved / Parked) · a coach-defined test list · dated readings + last-evaluated date · attendance per event · roster order · the shipped coverage report.

### What it can legitimately offer — three things, all of them *reference*, none of them *judgment*

1. **The focus rail, while writing (the couch screen).** Beside the block list, the roster **in roster order**, each player with their active focus areas, quoted verbatim from the existing development records — never recomputed, never scored, never re-ordered. Tapping a player's chip adds them to the block being edited. *This single panel is the product.* It turns "who should be at the infield station" from a memory test into a glance.
2. **Explicit player attachment to a block.** The coach chooses. Multi-select, roster order, optional — a plan with no names attached is a completely valid plan and must never be nagged about.
3. **A coverage answer, afterwards (V2).** Across this season's practice plans: which players have never been named in any block, and which active focus areas have never appeared. **Roster order, checklist framing, count-honest** — the exact shape of the shipped `/history/development` report, which already lists every player by name in roster order with no sort affordance.

### Why grouping is *not* offered
Focus areas are free text. "hitting", "swing path", "contact point" and "stay back on the curve" do not cluster, and any automatic grouping would be a confident lie. **No auto-grouping, no suggested stations, no generated plans.** If a coach wants groups, they tap names.

### The no-ranking guarantee — explicit, and a `/review` checklist item

**Forbidden by construction, everywhere in this feature:**
- Any list of players ordered by anything except **roster order** (or alphabetical where roster order is undefined). No "needs most attention first", no "least covered", no sort affordance of any kind.
- Any per-player count, score, percentage or streak rendered **beside another child's** as a comparable figure. Coverage renders as a **flag or a blank**, never a number to compare (`— not in a plan yet` vs nothing).
- Any team average, percentile, distribution or "N% of the roster" line placed next to an individual child's row.
- Any language of deficit about a child ("needs work", "behind", "weakest"). The vocabulary is coverage of the *coach's attention*, not assessment of the *player*: "hasn't appeared in a plan yet" is a statement about the plan.
- Any auto-generated "these four kids should…" recommendation. The findings rule in V2 is **count-only and nameless** — the shipped precedent (`lib/insight-findings.ts`) already does exactly this and stays silent until real usage exists.

**And the honesty line:** a plan records what was **planned**. Nothing in V1 records what was **done**. Every coverage surface says *"appeared in a plan"* / *"planned"* — never *"worked on"*, *"completed"* or *"did"*. This is a hard copy rule, not a preference, and it is why §5 declines to log at the field (logging would be the only thing that could honestly promote "planned" to "done", and it isn't affordable in that moment).

---

## 5 · The field artifact (D4)

### 5.1 The phone run view — a drill-in, not a tab
Route mirrors the established drill-in idiom (`…/lineups/[eventId]`): **`…/coaches/teams/[teamId]/practice/[eventId]`** (the builder) and **`…/practice/[eventId]/run`** (the field view), each carrying its own `← Back` link (the coach breadcrumb is globally hidden).

**Run view spec — designed against sun, gloves, one hand, twelve kids:**
- **One block fills the screen.** Block title in large bold ink (the page's largest type, ~28–32px), the elapsed/remaining minutes as large `--font-data` tabular numerals below it, and the block's note in body size. Nothing else competes.
- **"Up next: {title} · {n} min"** as a single quiet line at the foot. That one line is what a coach actually reads mid-drill.
- **Primary control ≥ 56px** (well above the 44px `--tap-min` floor) — a full-width **Next block** button, with a smaller **Back** beside it. **No swipe, no drag, no long-press** — gloves defeat all three, and swipe collides with the browser's back gesture.
- **Contrast:** solid ink on paper, bold weight. **Lime is not used as text here** — it fails in sunlight and is reserved for conversion anyway (2026-07-30). The one filled control is the ink chip (the primary action on a screen the user is already using).
- **Timer is a clock, not an alarm.** It counts within the block and shows overrun as a plain "+3" — **no sound, no vibration, no auto-advance.** A practice that runs long is normal; a phone that buzzes at twelve kids is not.
- **"Who's here tonight" (D8):** the attendance list for this event, read-only, collapsed by default, gated on the `attendance` capability. It is already recorded and already the truth; re-asking for it at the field would be the second field-time write this design refuses.
- **Screen-wake:** there is **no Wake Lock precedent anywhere in the codebase**. Not V1 — listed as a fast-follow so nobody quietly adds a browser API under time pressure.

### 5.2 The print / PDF sheet
One page, generated through the **existing PDF pipeline** (`lib/export/pdf.ts` — `buildTablePDF` / `downloadPDF`, org PDF settings, `buildFilename`), the same machinery behind the dugout-wall lineup poster and the per-player development summary. **No second print pipeline.**

- **Header:** team · date · start time · arrival time · location + field/diamond.
- **Body:** the blocks as a table — running time window, block title, minutes, who's attached, note.
- **Foot:** the roster in roster order with active focus areas — **printed only when the person generating it can see focus areas** (`canViewDevelopmentGoals`, i.e. `notes`). An assistant without notes access gets the same sheet with that section absent, not redacted-looking.
- Coach-generated, hand-carried. **Never a shareable link** (binding).

### 5.3 Read-only at the field — the call, and why
**Nothing is written during practice in V1.** Considered and rejected: per-block "✓ ran it / skipped" ticks.

Rationale: a coach with twelve kids has exactly one field-time write they reliably complete, and it is **attendance** — which is built, live, and already the honest record of who was there. A second competing write would be started and abandoned, and half-ticked plans would then poison every coverage surface downstream with data that *looks* like "what we did" but isn't. Read-only keeps the vocabulary honest ("planned") and keeps the run screen at zero cognitive cost, which is the entire reason it beats a Doc.

**Reopen it when, not if:** if coaches ask for it in real use, V2 can add per-block ticks *and* promote the coverage vocabulary from "planned" to "done" in the same unit of work — never one without the other.

---

## 6 · Reuse inventory — the do-not-rebuild list

| Existing thing | Where | How this feature sits on it |
|---|---|---|
| **Practice as a scheduled event** | `rep_team_events` (`eventType: 'practice'`), the Schedule page + slide-over | The anchor. **No new calendar, no new event concept.** |
| **Per-event attendance** | Schedule slide-over Attendance tab, `RepTeamEventAttendance` | Read-only "who's here" in the run view + optional print column. **No second attendance model.** |
| **Event resource links** | `lib/rep-event-resources.ts`, `rep_team_events.resources` | **Left completely alone** — the escape hatch (D2). Not migrated, not hidden, not deprecated. |
| **Development records** | `rep_player_development_goals` (focus areas + status), board GET | Read-only source for the focus rail + coverage. **Never a second copy.** |
| **The coverage report** | `/history/development` + `lib/insight-findings.ts` | V2 adds a practice section to the *existing* report. **No new report page, no seventh Insights tile** (the sixth was an owner-logged ceiling exception; a seventh needs its own decision). |
| **PDF engine** | `lib/export/pdf.ts` (+ org PDF settings) | The practice sheet is a new options shape on the shared engine. **No second print path.** |
| **Empty-state primitive** | `components/coaches/CoachEmptyState` (`compact` / `quiet`, headline/description/payoff/blocker/secondaryAction) | Every empty state here. The `blocker` slot carries capability honesty verbatim. |
| **Drill-in + back-link idiom** | `…/lineups/[eventId]`, `…/development/sessions/[sessionId]`, `.lineupBackLink` | Both new routes. |
| **Session run screen conventions** | `development/sessions/[sessionId]` | The closest living relative of the run view — reuse its operating-tool posture (no hero header, own back link, quiet autosave). |
| **Sheet-on-mobile / sticky action bar / `tableAsCards` / `CoachScrollX`** | `coaches.module.css` primitives | The builder's editing affordances. **Check the primitives header before writing any new rule** — the portal has one tap floor and two breakpoints (900 shell / 640 content). |
| **Confirm + unsaved-guard** | `ConfirmProvider` / `useConfirm`, `UnsavedChangesGuard` | Deleting a block, leaving a dirty plan. |
| **Capability model** | `lib/coach-capabilities.ts`, `denyUnless`, `lib/coach-nav-visibility.ts` | §8. **No new capability key.** |
| **Help system** | `lib/help-content/coaches.tsx` (+ hub arrays) | Ships with the build (`/docs`), keywords indexed — search matches keywords, not body. |
| **Basic-coach interest capture** | `lib/basic-coach-interest.ts` + `ScopeShelf`/`ScopeCeilingInterest` | A `practice_plans` interest option for FREE coaches, mirroring the 3A precedent. |

**Genuinely new, and why nothing existing fits:**
1. **The block list itself.** No ordered, timed, sub-event structure exists anywhere in the portal. The nearest relative is the lineup's inning grid, which is a 2-D player×period matrix — wrong shape.
2. **The run view's one-thing-at-a-time presentation.** No full-screen sequential operating view exists; the session run screen is a roster grid. It reuses that screen's *posture*, not its layout.
3. **One additive column** (§7) — because a structured plan needs somewhere to live.

---

## 7 · Data model (D6)

**V1 adds exactly one thing:**

| Change | Shape | Notes |
|---|---|---|
| `rep_team_events.practice_plan` | **additive, nullable `jsonb`** — `{ version, blocks: [{ id, title, minutes, note?, playerIds?[] }] }` | Exact precedent: **mig 162** added `rep_team_events.resources` the same way. App-layer validation + caps in a new `lib/rep-practice-plan.ts` (block cap, title/note length, minutes range, playerIds must be current roster ids) applied on **every** write path — the resources sanitiser is the model to copy. |

**Why not zero-migration.** Two zero-migration options were considered and rejected:
- *Type the plan into the event's existing `description` field* — that is a text box. It cannot drive the run view, cannot attach players, cannot answer coverage. It is the Google Doc with extra steps, and shipping it would fail the "demonstrably better than what they do today" bar.
- *Reuse the `resources` jsonb with a new `type`* — that field is a typed link/file list with its own sanitiser and a reserved `'file'` V2. Overloading it would corrupt a shipped contract to save one nullable column.

**Deferred to Phase 3 (only on demand):** `rep_team_practice_plan_templates` — named, program-year-scoped, mirroring `rep_team_lineup_templates` exactly. The V1 shape lifts into it unchanged.

**Discipline (binding, same unit of work):** `DATA_DICTIONARY.md` + `npm run refresh:snapshots` + `npm run check:dictionary`. Decide current schema from the **live snapshots**, never migration files. Migration number = next available at build time (dev was at ~211; **verify then**).

**⚠ Release rider — learned twice already (migs 160, 162):** reads degrade safely pre-migration (`undefined → null`), but **event create/edit writes will 500 on prod until the column exists**. The migration must be applied to prod **before** the commit that ships this is promoted.

---

## 8 · Capability & gating model (D3)

| Action | Gate | Rationale |
|---|---|---|
| **See** a practice plan (builder read + run view + print) | `schedule` (`canManageSchedule`) | It is content about an event. An assistant who can already open Tuesday's practice can read its plan — this is what makes "assistants run stations" work with **no new capability key**. |
| **See the focus rail / per-player focus chips / the print's focus section** | `notes` (`canViewDevelopmentGoals`) | Coach-judgment content about a minor — the same class as player notes, gated exactly as Development gates it today. An assistant without `notes` sees the blocks and the names, never the focus text. |
| **See "who's here tonight"** | `attendance` | Mirrors the existing attendance gate. |
| **Write** (create/edit/delete blocks, copy-forward) | **Head coach only** (`canWriteDevelopment`) in V1 | Matches the binding constraint and the Development precedent. |

**⚠ Constraint tension, surfaced not silently resolved (this is D3).** The binding rule says *"head-coach-only writes by default, matching the development precedent"*. But a practice plan attached to an event is *also* schedule content, and an assistant granted `schedule` can already **create the practice itself** — yet under the recommendation could not write its plan. Both readings are defensible:
- **Constrained (recommended):** head-only writes. Safest, matches the constraint, and matches reality — the head coach writes the plan on the couch. Assistants read + run + print, which is the job they actually have.
- **Unconstrained:** plan writes ride `schedule`, so an assistant who can create the practice can plan it. More coherent with the event model, but it silently widens "development writes are head-only" and it is a one-line change to make later if coaches ask. **Not recommended for V1.**

**Server + client parity is a `/review` checklist item** (this leak class has bitten three chunks running): every gate above must exist on the API route via `denyUnless` *and* on the surface. Probe as the read-only assistant.

**Nav visibility:** nothing changes. No new nav item, no new More entry, no change to `lib/coach-nav-visibility.ts`. The only navigational change in the whole feature is one pointer line at the foot of the Development hub (§3).

## 8.1 · Helpers who aren't coaches (D29/D30, round 5)

**Owner ask:** *"we might want to think about adding users that aren't coaches (helpers) to be able to
see these practice plans like how we share google docs with each other."*

**⚠ The Google-Docs mechanism specifically is the one thing this project cannot copy.** An
unauthenticated share link to a practice plan is a **public page naming ten children alongside a date,
a start time and a street address.** Forwarded once, it is public permanently. This is exactly the
artifact the platform-wide *"never a shareable link"* rule exists for — the practice plan is the most
sensitive document in the coaching product, more so than the development records, because it combines
minors' names with a location and a time. **Do not soften this into "a link with a hard-to-guess URL".**

**Recommendation: an invited "Helper" who signs in.** The outcome the owner wants (a parent volunteer
or outside instructor opens the plan and their station on their own phone) is reachable with the
machinery already shipped:

- **No new permission model.** "Helper" is a **named preset** of the existing per-assistant capability
  grants — schedule visibility on, everything else off, all writes off. `CoachStaffPanel` already
  renders grouped capability controls with sensitive-grant confirms; this adds a friendly preset beside
  "Assistant coach" on the invite path, not a third `coach_role`.
- **Focus areas stay `notes`-gated**, so a parent volunteer never reads coaching notes about other
  people's children — the same gate that already governs the focus rail (§8).
- **The printed sheet remains the no-account option** for a helper who won't accept an invitation.

**Two gates before build — neither is a screen:**

1. **A privacy sign-off.** A non-coach adult reading minors' first names is a new category of access.
   This is the same class of gate that Player Development's D2 had to clear (existing tryout consent
   accepted for coach-authored records, logged in `BUSINESS_DECISIONS.md`) — route via `/strategy`.
2. **Reconcile against the verified-family decision** (`BUSINESS_DECISIONS.md` 2026-07-11 G3/G4:
   verified family links + **practice-schedule visibility** at Premium, blocked on PIPEDA/CASL). A
   parent volunteer sits directly on that seam. ⚠ **The platform must not end up with two different
   doors by which a parent reaches a team's practice.**

**Sequencing (D30):** the screens are genuinely small because the permission machinery exists; the
decisions are not. **Plan it as the CLOSING PHASE of this project, with the sign-off as a gate that
clears before the build starts** — in scope, but not shipping on momentum.

---

## 9 · Phasing

> **REVISED 2026-07-31 (owner, round 2).** The owner expanded the vision after seeing round 1 and
> supplied a real Google Doc practice plan as the reference artifact (see §9.0). Four releases now,
> and **the ordering changed: the drill library comes BEFORE the plan library.** Rationale — a library
> of hand-typed plans is a filing cabinet; a library assembled from reusable drills is a system, and
> the drills are what hand us the categories the focus rail needs to filter by practice type.

### 9.0 — What the owner's real plan taught (the reference artifact)

The U13 White plan (Bat Cave, 18 Jan 2026) is the binding shape reference. Seven findings, two of
which were **defects in round 1's design**:

1. **A block contains stations, and stations contain pairs** — three levels. Round 1 drew one.
2. **Staff are named per station, and some are not portal users** ("Instructor: Adam and Craig", "PD
   coaches: Alim"). A picker limited to team coaches fails on the very first real plan → **D12**.
3. **Coach names were hand-highlighted in blue** — a person doing manually what a field should do.
4. **⚠ Durations are ranges and conditionals** — "25–35 minutes, depending on how everyone is feeling"
   and "Remaining time, target 30 minutes". **Round 1's fixed-minute running clock would have forced
   the coach to type a number they don't mean** → **D13**.
5. **⚠ Pairings carry attendance contingencies** — *"Will move Jocelyn to a group of three if Aslyn
   doesn't show."* A coach hand-writing a fallback because the document can't react. This is the
   single highest-value opportunity in the whole feature and nobody else builds it.
6. **Every block repeats one substructure** — Description → Goals → Logistics. Recommendation: **two
   fields (Description + Goal)**; logistics folds into description. Three boxes is a form.
7. **The session has a theme and a type** — an overall goal, and the whole ninety minutes is a
   *hitting* practice. That type is the hook the focus-rail filter hangs on → **D16**.

Two smaller steals: a **practice-level goal line**, and an **equipment list with an owner**
("provided by Craig"). And one line where the product already beats the Doc: *"Player Attendees: All
but Aslyn maybe"* is a guess typed the night before — in the portal that is live attendance data,
which is precisely what makes finding #5 solvable instead of hand-written.

### 9.1 — ⚠ The rotation gap (found round 4, 2026-07-31)

**Owner question:** *"How would it work if we have separate drills run at the same time on different
parts of the diamond that we rotate — 3 groups rotating between 3 drills every 15 minutes over 45?"*

**Honest answer: rounds 1–3 did not handle it.** Round 3 modelled rotation as **free text on a
station** (D22 original), which covers an informal "rotate halfway" and **fails completely** on a real
carousel: it cannot say who is where at 8:30, cannot print a rotation, and hands the coach back the
mental bookkeeping the field screen exists to remove. Every station would show all ten players or none.

**The fix (D23):** a block gains a **second shape** — *one activity* **or** *a rotation*. A rotation
carries **stations** (each optionally a library drill with its own kit, staff and coaching points),
**groups** (block-level, not per-station — this differs from round 3), and **a clock**. The product
computes the **group × round grid**; groups move forward one station per round, coaches stay put.

**Why this matters beyond the feature request:** the computed grid is the single artifact in this
whole project that a Google Doc most obviously cannot produce, it is what makes the field screen
answer its one question without reading, and it prints as a fence-pinnable page. ⚠ **It is a strong
argument for pulling stations + rotations into V1 and letting the plan library wait** — the open
sequencing question in §10.

### 9.2 — FINAL LADDER (settled 2026-07-31 after round 5; owner accepted D1–D30)

> **This supersedes the earlier V1–V5 ordering.** Two changes from the round-2 ladder, both driven by
> what rounds 4–5 found:
> 1. **Stations and rotations move INTO Phase 1.** The owner's own reference plan is station-shaped
>    with a rotation carousel; a first release without them would model a practice their reference team
>    doesn't run. And the computed rotation grid is the single artifact a Google Doc most obviously
>    cannot produce (§9.1) — shipping the feature without it ships the weakest half first.
> 2. **The coverage answer ("did everyone get a turn") moves OUT of an early phase and into Phase 3.**
>    It counts plans. With no plans yet it can only render an empty state, so shipping it early ships a
>    blank screen. It belongs with the history surfaces that share its "looking back" job.

| Phase | Name | Contains | Storage |
|---|---|---|---|
| **1a** | **Write it** | The plan on the practice — practice goal + kit · blocks (description/goal/duration D13) · staff tags (D12) · **stations** (D27) · **groups incl. the random draw** (D21) · **rotation blocks + computed grid** (D22–D26) · the focus rail · copy-from-a-previous-practice · the **printed sheet incl. the rotation grid** · **D10** (session date + practice link + "Recorded here") | One additive column (D6) |
| **1b** | **Run it** | The field screen — block by block · rotation rounds + "Rotate now" · station cards · **"My station"** (D28) · coaching-points display | None |
| **2** ✅ | **The drill library** — **BUILT on `dev` 2026-08-01, uncommitted, owner QA pending (§10.7)** | Drills w/ categories, coaching points, setup · the picker + preview · promotion (D18) · **the focus-rail filter** (D16) · **+ the club's shared drill set** and **"Add from a past season"** (owner rulings, §10.7). ⚠ "default stations" is retired — **a drill is ONE activity**, and two in a block is what makes a rotation. | `rep_team_drills` (mig 218, DEV ONLY) + `rep_player_development_goals.category` |
| **3** ✅ | **The plan library & looking back** — foundation COMMITTED (`18f05650`); **the visible half BUILT on `dev` 2026-08-02, uncommitted, owner QA pending (§10.8)** | The template room as **ONE FLAT LIST filtered by tag chips** (⚠ NOT "grouped by category" — several tags per item would print one template under two headings) · its **own full editor** (frame 03's cost) · "Save as template…" · **ONE picker, two sources** · usage as **"Started 8 plans"** · **"how it went"** (D17) · **the coverage answer + uncovered focus tags + "Practices you've run"** folded into the existing development report · ⚠ **one NEW archive door**: a past plan, read-only, reached only from that list | `rep_team_plan_templates` + `rep_team_plan_template_tags` + `rep_team_events.practice_recap` (mig 221, DEV ONLY) |
| **4** | **Helpers** ⚠ **GATED** | The "Helper" invite preset + their one-screen portal (D29/D30 · §8.1) | None |

**Why 1a and 1b are one phase in two slices, not two phases:** 1a alone is already usable — a coach
can author a plan and **print it**, which is a real artifact on a real Tuesday. 1b is the
differentiator. Shipping 1a first gets the owner QA'ing a real plan against a real practice before the
field screen is built on top of assumptions. **Both ship before Phase 2 starts.**

**Phase 1 is the largest single chunk this portal has attempted.** That is deliberate — the alternative
is a first release that doesn't fit the reference practice — but it means the two slices, the mockup
gate, and owner QA between them are not optional.

### Phase 1a — write it *(one additive column · usable alone via the printed sheet)*
**D10 rides here** — it is the same seam pointing the other way and it is small.

**The builder**
- A **Practice plan** section on the practice event: in the slide-over (a summary + "Open plan"), full editing on the `…/practice/[eventId]` drill-in.
- **Practice-level header:** an overall **goal** line + an **equipment/kit** line with a free-text owner ("balls, bases, tees — Craig"). Both straight from the reference artifact; both cheap.
- Blocks: **title · Description · Goal · duration (D13) · staff tags (D12) · optional players** (roster-order multi-select). Reorder via **up/down buttons, not drag** (the Roster touch-drag lesson). Add / edit / delete with the shared confirm.
- **Duration model (D13):** a number, an optional "to" upper bound, or exactly one **"rest of practice"** block per plan. The field clock counts the floor, then continues in amber to the ceiling — no fake precision.
- **Staff tags (D12):** reuse the existing coach **tag** control (`rep_tag_kind` family — a `staff` kind, mirroring game/expense tags). Team coaches are offered automatically; anyone else is created on the spot and reusable. **No accounts, no invitations, no capability implications** — a tag is a label, never a grant.
- Running time column derived from the event's start time — the coach types minutes, the product does the clock arithmetic (via `lib/timezone.ts`; **never raw UTC date math** — binding guardrail).
- **The focus rail** — roster order, active focus areas quoted from development records, tap-to-attach (gated on `notes`).
- **"Copy from a previous practice"** — a picker over this team's own past practice plans, newest first. This *is* the reuse story for V1.
- Honest empty state (`CoachEmptyState`): what a plan is · what it unlocks · what's blocking (no roster / not head coach).
- **The links section is untouched** and stays visible on the same event (D2).

- **Stations (D27)** and **groups (D21)** and **rotation blocks (D22–D26)** per the sections above — the anatomy is exposed in the builder from the start, not deferred.
- **The one-page printed sheet (§5.2)** ships in 1a, not 1b: it is what makes this slice usable on its own, and it carries the rotation grid + groups + coaching points.
- **D10** — the evaluation-session date, the practice link, the re-stamp confirm, and the practice's "Recorded here" section (§10.2).

**What the coach gains after 1a:** a plan written in ~4 minutes next to the twelve answers, with the rotation worked out for them, printable for the assistant running the tee station.

### Phase 1b — run it *(no storage change)*
- The field run screen (§5.1): block by block, **rotation rounds + "Rotate now"** (D26), station cards, the flexible-duration clock.
- **"My station"** (D28) + the station picker.
- **Coaching points** rendered at glance size while a drill runs (D19 — the drill record itself arrives in Phase 2; in 1b the points come from whatever the coach typed into the block).
- Help content + a Basic-coach interest option, in the same unit of work.

**What the coach gains after 1b:** the ninety minutes read one block at a time in the sun, and whoever is on tees opens their own station and knows what they're watching for.

### Phase 2 — The drill library *(new table)* — **AHEAD OF THE PLAN LIBRARY**
- A per-team **drill library**: name, coach-defined **category**, usual duration (D13 shape), description, optional **goal**, **coaching points** (D19 — a short numbered list), default stations + kit, equipment. Rename/**retire** mirroring the measurable-type library idiom (retire keeps history and every plan the drill is already in).
- **Four doors to a drill** (round 3): pick from the library · write a one-off block in place · **promote a block to a drill** later (D18 — explicit, never automatic) · manage the library directly in Development.
- A **drill picker** in the block-add sheet ("From your drills" / "Write one"), searchable, category-chipped, showing each drill's use count — and a **preview before adding** (description, coaching points, the stations it sets up), because a drill you can't read is a drill you add and then undo.
- **A picked drill brings the SHAPE, empty of people** (D20): station cards appear already named and kitted, asking to be staffed. Everything stays editable in the plan under the same provenance rule as templates.
- **Coaching points surface on the field screen** while the drill is running — three phrases at glance size, above the station cards.
- **Categories arrive here, and they pay for the focus-rail filter (D16).** A practice's type is *derived* from the drills in it — never another field a coach fills in on a couch.
- **Focus-rail filter:** relevant focus areas lead, non-matching ones **dim rather than disappear** (a coach may still grab that player for five minutes, and hiding a child from a coverage list is exactly the wrong instinct). Uncategorised focus areas and "nothing set yet" always show. **Still roster order, still no sort control.** Requires focus areas to carry an optional category — the one genuinely new thing on the development side.
- ⚠ **Sport-neutrality:** the library ships **empty**. Category vocabulary ("Hitting / Fielding / Pitching / Baserunning" is softball-shaped) routes through the Sport Pack or is coach-typed. Seeded starter drills stay a fast-follow.
- **What the coach gains:** stops retyping the warm-up. A plan becomes four taps.

### Phase 3 — The plan library &amp; looking back *(new table)*
- Named **templates** grouped by category, living in **their own room inside Development** (D15) — this revises D9: the pointer line becomes a real door once there is something to browse.
- **Usage history:** "Used 8× · last Aug 4", with a per-use list linking to each practice's plan as it was run.
- **"How it went" (D17):** one free-text recap per use, written afterwards. ⚠ **Guardrail: it is a note about the practice, never about a child** — "tees were too crowded, run four next time" is the whole value; per-player commentary would drift into behavioural profiling on minors. A practice with no recap says so honestly rather than rendering blank.
- **Template semantics (D14, owner-ruled):** load a template **or** pull from a previous practice through one picker with two sources. Once loaded, **every change is that practice's** — a quiet provenance line says so before the coach edits anything. The template's use count increments; its contents never move. Saving over a template or creating a new one is a separate, explicit act ("Save as template…"), exactly as lineup templates already behave.
- **The coverage answer, moved here from the old V2:** a "planned, never done" coverage line on the plan + a **practice section inside the existing** `/history/development` report (roster order, no new page, **no seventh Insights tile**) + one conservative **count-only, nameless** findings rule, silent until real usage. **It lives here because it counts plans** — shipped earlier it could only render an empty state.
- **What the coach gains:** "my standard Tuesday", once — an honest record of how it actually went the last eight times — and an answer to "am I missing anyone", without ranking children.

### Phase 4 (closing) — Helpers *(D29/D30 · §8.1)* — **GATED, not automatic**
- A **"Helper"** preset on the staff invite path (schedule visibility on, everything else and all writes off) + the helper's one-screen portal: the practice, their station, the group in front of them.
- ⚠ **Two gates clear BEFORE the build starts:** a privacy sign-off via `/strategy`, and a reconcile against the 2026-07-11 verified-family / practice-schedule-visibility decision.
- **What the coach gains:** the parent volunteer running the tee station opens it on their own phone — without the plan becoming a public document.

### Fast-follows — explicitly never Phase 1
Sport-Pack-seeded starter blocks (must route through `lib/sports.ts`, never a baseball-shaped default) · per-block ✓ran ticks *(with the vocabulary promotion in the same change)* · screen wake-lock · a plan on a **team event** or a pre-game warm-up · family-visible practice plans (**blocked** on the G3/G4 PIPEDA/CASL work — out of scope, do not scope it here).

---

## 10 · Owner decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | **Where does a practice plan live**, now the reserved hub slot is retired? | (a) Development · (b) on the practice event in Schedule · (c) split | **(b).** Zero new nav, one tap from the phone bottom bar, sits on the object that already owns the date, place, attendance and links. Development keeps **one pointer line**, replacing the retired placeholder card. Trade-off: far from the development data — paid for by bringing the focus rail *to* the builder. |
| **D2** | **The existing event resource link** — replace, complement, or leave? | Replace / complement / leave as the escape hatch | **Complement, and leave it fully intact.** Some coaches will keep their Doc forever and that is a legitimate outcome; the link field was shipped naming practice plans as a use case. Never nag, never migrate, never hide. Help copy names the choice plainly. |
| **D3** | **Can assistants see and run a plan — and does it need a new capability?** | New key / ride `schedule` (read) + head-only (write) / ride `schedule` for both | **Ride `schedule` for read+run+print; writes head-coach-only; focus text gated on `notes`. No new key.** ⚠ This is the constraint tension in §8 — the alternative (assistant writes ride `schedule`) is coherent but widens the head-only rule. |
| **D4** | **Is anything logged at the field?** | Read-only / per-block ticks / free-text notes | **Read-only.** Attendance is the one field-time write coaches complete; a second one gets half-done and makes every downstream coverage number dishonest. Trade-off: "did we do it" stays unanswered in V1 — deliberately, and the vocabulary stays "planned". |
| **D5** | **Is a reusable plan library V1?** | V1 / fast-follow / never | **Fast-follow (V3), on demand.** V1 ships **"copy from a previous practice"**, which matches what coaches actually do (repeat last Tuesday) and needs no new table. |
| **D6** | **Does V1 accept one additive column, or must it be zero-migration?** | One nullable `jsonb` column / zero-migration text box | **One column.** The zero-migration version is a text box, i.e. the Doc with extra steps — it would fail the "better than today" bar. Trade-off: a prod migration must precede the release (§7 rider). |
| **D7** | **Does a plan belong to one practice, or to a recurring series?** | Occurrence-only / series-scoped / both (This / This-and-future / All) | **Occurrence-only.** The whole premise is that *this* Tuesday differs from last Tuesday. Series-scoped plans would inherit the recurrence edit-scope chooser and quietly overwrite eleven weeks of thinking. Repetition is served by copy-from-previous. ⚠ **A build session must not "helpfully" wire this into the existing This/This-and-future/All machinery.** |
| **D8** | **Does attendance appear in the run view?** | Yes read-only / no / editable | **Yes, read-only, collapsed, `attendance`-gated.** It is the cheapest true win in the feature (already recorded, already true) and it is what turns "who's at which station" from guesswork into a glance. Editing it there would be the second field-time write D4 refuses. |
| **D9** | **Does the retired hub slot become a pointer line, or nothing at all?** | Pointer line / nothing / keep a card | **Pointer line** ("Practice plans live on each practice in your Schedule →"). ⚠ Depends on the hub restructure, which is **approved as a mockup but not built or logged** (§0.1) — sequence this after it, or land the pointer with it. |
| **D10** | **Does an evaluation session get an editable date and/or a link to the practice it happened at?** — ADDED 2026-07-31 after this plan was written; see §10.1 + the rulings in §10.2 | Date only / date + event link / neither | **Both, and they belong here** — the event link is the same seam D1 just chose. ✅ **Drawn in round 2.** Rides V1. |
| **D11** | **How deep does the block anatomy go, and how much ships in V1?** — added round 2 | Block only / block + stations / block + stations + pairs | **All three levels are built into the container in V1; the builder exposes block-level in V1 and stations + pairs in V4.** Rationale: pairs are only worth typing if regrouping is cheap, and regrouping is only useful once it knows who replied — shipping pairs before that is the Doc's problem with our logo on it. ⚠ **Owner may prefer stations in V1** — flagged on the round-2 artifact. |
| **D12** | **How is staff assigned to a block/station, given some staff aren't portal users?** — added round 2 | Picker over team coaches / tags (create-on-the-spot) / free text | **Tags — OWNER-RULED 2026-07-31.** Team coaches offered automatically; anyone else (outside instructor, PD coach) created on the spot and reusable. Reuses the existing coach tag control. ⚠ **A tag is a label, never a grant** — no accounts, no capability implications. |
| **D13** | **Duration model** — added round 2 | Fixed minutes / fixed + optional range / + "rest of practice" | **All three.** A number, an optional "to", and exactly one "rest of practice" block per plan. The field clock counts the floor then continues in amber to the ceiling. **Round 1's fixed-minutes-only model was a defect** — the reference artifact says "25–35 depending on how everyone is feeling" and "remaining time, target 30". |
| **D14** | **Does editing a loaded template write back to the library?** — added round 2 | Write back / copy-on-load / prompt each time | **Copy-on-load — OWNER-RULED 2026-07-31.** One picker, two sources (templates + previous practices). Once loaded, all edits are that practice's; a quiet provenance line says so up front. Use count increments; contents never move. Saving over / creating a template is a separate explicit act. Matches the shipped lineup-template ruling — **do not invent a second answer**. |
| **D15** | **Where does the plan library live?** — added round 2; **revises D9** | Its own room in Development / on the practice only / a new nav item | **Its own room inside Development** (beside the team board and test list) — a library is browsed, grouped and read back, which is a different animal from the plan *editor* that D1 correctly kept off that page. **Still no new top-level nav.** D9's pointer line becomes a real door at V3; until then it points at the practice as accepted. |
| **D16** | **Drill library — before or after the plan library? And where do categories come from?** — added round 2 | Plans first / drills first | **Drills first.** It is what makes authoring fast, and it hands us the categories for free, so a practice's type is *derived* rather than being another field. ⚠ Requires focus areas to carry an optional category — the one genuinely new thing on the development side. Uncategorised focus areas are **dimmed, never hidden**. |
| **D17** | **"How it went" — what shape, and when?** — added round 2 | None / one free-text line / structured recap | **One free-text line, written afterwards — OWNER-RULED 2026-07-31.** ⚠ **Guardrail: about the practice, never about a child.** This does NOT reopen D4 — an unhurried, deliberate, coach-authored note at home is a different act from an abandoned tick-box mid-drill. |
| **D18** | **Does a block written in place become a drill automatically?** — added round 3 | Auto-save every block / explicit promotion / never | **Explicit promotion.** A block written in the "Write one" tab stays a one-off; "Save to my drills…" promotes it later and asks exactly one question (category). Auto-save fills the library with five near-identical "Wrap" rows within a season and makes the picker slower than typing — **drawn as the rejected option on the round-3 artifact.** Same idiom as saving a plan template: one rule, two places. |
| **D19** | **Does a drill carry coaching points?** — added round 3 | No / a short numbered list / free-form only | **Yes — a short numbered list**, taken directly from the reference artifact's nested teaching points ("choking up · widening the stance · shorter stride"). They **lead on the field screen while the drill runs** — that is the payoff for typing them once, and it is a thing no shared Doc delivers at arm's length. |
| **D20** | **What does a drill NOT carry?** — added round 3 | Everything incl. people / shape only | **Shape only — no coaches, no players.** A drill holds stations, counts, kit, description, goal, points; a practice supplies the people. This split is what keeps one drill working in April with twelve and July with nine, and it stops the library going stale when the roster changes. |
| **D21** ↻ | **Grouping** — added round 3, **REVISED round 4 (owner: "groups will not always be pairs… would be good if we could randomly assign based on N")** | Manual only / pairs / N groups / N per group | **Three options: (1) pick them myself (default), (2) DRAW AT RANDOM with a toggle between "how many groups" and "players per group" plus a "draw again" reshuffle, (3) same groups as last practice.** Only players who replied yes enter the draw; absent players are named, not silently dropped. Uneven splits are stated up front ("3 groups from 10 — two of 3, one of 4"). ⚠ **Hard guardrail unchanged: random is deliberately dumber than clever. No balancing by ability, no grouping by focus area** — "draw again" re-draws, it never optimises. A `/review` checklist item. |
| **D22** ↻ | **Station rotation** — added round 3, **REVISED round 4: the original answer was wrong** | Free text only / a real rotation structure | **A real structure** (see §9.1). Free text remains for informal cases ("rotate halfway"); a genuine carousel gets rounds, an interval, and a **computed grid**. ⚠ **The round-3 free-text-only model could not answer "where is Group B at 8:30?"** — a real gap against the owner's actual practice shape. |
| **D23** | **Block shapes** — added round 4 | One shape / one activity ⊕ a rotation | **Two shapes behind one toggle.** A rotation keeps everything a block has (name, goal, notes, staff) and adds stations + groups + a clock. **Each station may be a library drill**, with its own kit and coaching points — that is the answer to "separate drills at the same time on different parts of the diamond". ⚠ **Groups are block-level in a rotation, not per-station** (differs from round 3's station-level players). |
| **D24** | **Rotation timing — which numbers does the coach type?** — added round 4 | total + interval / rounds + interval / all three | **Total + interval; rounds and per-round times are computed** ("45 and every 15" → "3 rounds of 15 · everyone does everything"). Uneven division is **stated, never silently rounded** ("3 rounds of 15, with 5 minutes spare"). |
| **D25** | **What if groups ≠ stations?** — added round 4 | Block it / auto-fix / allow and state it | **Allow, and say it plainly** — "Group C won't reach Front/side toss"; more groups than stations means two share, and the grid says so. **Never invent a round or drop a station to tidy the arithmetic** — that is the honest-data rule applied to a schedule. |
| **D26** | **How does a rotation advance at the field?** — added round 4 | Auto-advance / timer alarm / manual tap | **A manual tap ("Rotate now"), the same class of action as "Next block".** No auto-advance, no sound, no vibration; overrun goes amber and waits. **Records nothing** — D4's read-only ruling holds, and the rotation is a stretch of the same one-thing-at-a-time run, not a mode the coach must exit. |
| **D27** | **How much detail does a station hold, and where does each field come from?** — added round 5 | Minimal / full, split by source | **Full, and split by source: the DRILL supplies the shape + the teaching** (name, count, description, goal, coaching points, equipment, **new: Setup** — "3 tees down the third-base line, 20 feet apart"); **the PRACTICE supplies the people and the moment** (staff tags, who's at it, rotation timing, a one-off note for tonight that is never saved back to the drill). Attendance and focus areas are already known and are never typed. ⚠ **Photos/diagrams stay cut** — images of a practice will contain children, with no consent path and no moderation; revisiting needs a privacy review, not a file picker. |
| **D28** | **Does a station get its own view for whoever is running it?** — added round 5 (owner: *"a coach shows up assigned to a station but might not know what they need to do or what they are focussing on"*) | No / a station view | **Yes — "My station", the assistant's version of the run screen.** Their station is pre-selected because they're tagged on it; they can still view the others. Shows: with-you-now group + countdown · what you're doing · **what you're watching for** (the goal — the direct answer to the owner's question) · coaching points · setup · tonight's note (attributed) · who's coming next. **Read-only**, per D4. Cheap: every field already exists for the plan. |
| **D29** | **How does a non-coach helper get access?** — added round 5; see §8.1 | Shareable link / invited sign-in / paper only | **An invitation and a sign-in. NEVER a shareable link.** ⚠ A link to a practice plan is a public page naming ten children with a time and an address. The printed sheet stays the no-account option. |
| **D30** | **What is a "Helper", and when is it built?** — added round 5 | New role / a preset of existing permissions · now / later / closing phase | **A named preset of the capability grants that already exist** (schedule visibility on, everything else and all writes off) — no third `coach_role`, no new permission model. **Built as the CLOSING PHASE of this project**, gated on (a) a privacy sign-off via `/strategy` and (b) a reconcile against the 2026-07-11 verified-family/practice-visibility decision, so a parent never gets two different doors into a team's practice. |

---

## 10.1 · D10 in detail — the evaluation-session date + event link

> **Added 2026-07-31, after this plan's planning session completed.** The owner raised it against the
> restructured Development hub, was offered it as a standalone change, and **deliberately deferred it
> into this project** so the practice↔development seam gets designed once instead of twice.
> **This decision is NOT covered by the round-1 mockup artifact** (`34f5affe`) — it needs a round 2.

**What the owner asked.** *"When I go to an evaluation session, can I enter a date (default to today)
and/or link to an event if it occurred during a practice? Some coaches might write things down during
a practice and type it in later."*

**What exists today** (verified in code 2026-07-31, do not re-derive):

- An evaluation session **already stores a date and already defaults to today**, and the session PATCH
  endpoint **already accepts and validates a `sessionDate` change**. The run screen simply never
  exposes it — the date renders as static text under the title. Exposing it is a UI-only change.
- There is **no link of any kind between an evaluation session and a scheduled event.** That needs an
  additive column, which this plan is already paying for once (D6).

**⚠ The trap — read before designing anything.** Each reading is stamped with the session's date **at
the moment it is typed** (the entry write copies `session.sessionDate` into `recordedOn`). Today that
is invisible because the date cannot change. The moment it can, the realistic order of events is:
open a session → start typing Tuesday's numbers → notice the header says today → correct it. **If the
date change only moves the header, every reading already entered keeps the wrong day** — the session
then disagrees with its own contents and the per-player trend lines plot on the wrong date, which is
precisely the failure this feature exists to prevent.

So a date change **must re-stamp every reading collected in that session**. That is safe and honest:
a session's readings are by definition all from that one session. Readings logged individually from a
player profile carry no session and must never be touched. Setting the date back moves them back, so
the operation is reversible.

**Why it belongs in this project rather than as a bolt-on.** D1 put the practice plan **on the practice
event**. "What got measured at this practice" is the same seam, pointing the other way — and it is one
of the few things this product knows that a Google Doc does not (§1). Linking a session to a practice
also makes the date problem disappear for the common case: pick Tuesday's practice, the date fills
itself in, and the session reads as *"at Tuesday's practice"* so it is still identifiable in March.
Designing the plan→practice and session→practice links together is the whole reason this was deferred.

**What a round-2 mockup must show:**

1. The **editable date** on the evaluation session (default today, head-coach only), and the moment a
   coach changes it with readings already entered — what they are told, if anything.
2. The **event picker**: which events qualify (practices only, or any event in the season?), how it is
   defaulted, and the empty state for a team with no practices scheduled.
3. The **linked state** on the session, and whether the practice shows anything in return on the
   Schedule side (e.g. "evaluation session recorded") — and if so, whether that sits with, or apart
   from, the practice plan the rest of this project puts there.
4. What happens when a linked event is **moved to another date** (does the session follow?) or
   **deleted** (does the session survive as an unlinked session — it must, by the same
   grouping-artifact-is-not-the-record rule that governs session delete today).

**Open sub-questions for the planning/mockup round** — do not resolve these silently:

- Does linking a session to an event make the date **derived** (read-only, owned by the event) or merely
  **pre-filled** (still editable, and free to diverge)? Derived is cleaner; pre-filled survives a coach
  who tested before the practice officially started.
- Should the date be constrained to the **current program year**? A valid date outside the season would
  otherwise be accepted, stranding a session outside its own season's reporting.
- If the plan gains a "what got measured here" line on the practice, does that conflict with **D4**
  (nothing is logged at the field)? It should not — the reading was logged in the session, not in the
  plan — but the vocabulary rule in §4 ("planned", never "done") must not be quietly breached by it.

**Constraint check:** no new nav, no new capability (writes stay head-coach-only per D3), no parent
surface, sport-neutral, and the re-stamp rule keeps the data honest rather than convenient.

## 10.2 · D10's four open sub-questions — RULED (round 2, 2026-07-31; drawn on artifact `1a76bcf4`)

1. **Derived or pre-filled? → PRE-FILLED, and both stay editable.** Picking a practice fills the date
   in; the link and the date remain two separate facts — *which practice this belongs to* and *when
   the readings were actually taken*. **A rescheduled practice must NOT move the session's date**
   (and therefore must not re-stamp readings): the measurements happened when they happened. A derived
   date would rewrite history to keep a foreign key tidy — the exact dishonesty §10.1's trap warns
   about, arriving through a different door. The "tested at 5:35 before a 6:00 practice" case is also
   real and stays expressible.
2. **Which events qualify? → ANY event in the season, practices listed first and defaulted**, ordered
   by proximity to the session's current date. Restricting to practices creates a dead end for the
   coach who tested at a Saturday scrimmage warm-up, and the link is descriptive, not structural.
3. **Constrain the date to the program year? → YES, refused with a plain reason** ("Sessions belong
   to the 2026 season"). Accepting an out-of-season date strands the session outside its own season's
   reporting — a silent, confusing loss. Where a program year has no bounded dates, accept anything.
4. **Re-stamp UX → an explicit confirm naming the count**, using the shared confirm primitive: *"Move
   this session to Tue, Aug 4? The 9 readings already entered here move with it."* **With zero readings
   entered, no dialog at all** — the date simply changes. Deleting a linked event leaves the session
   alive as an ordinary dated session (same rule that already governs session delete).

**And the return surface (§10.1 point 3):** the practice gains a second, separate section —
**"Recorded here"** — beside "Practice plan". Two sections, two truth statuses, deliberately: the plan
is *what you intended*; the session line is *what actually got measured*. It is the one thing on that
screen allowed to say it happened, and it earns that because a coach typed real numbers. **This does
not breach §4's "planned, never done" rule** — the wording keeps them apart, and a `/review` checklist
item verifies it.

---

## 10.4 · Owner QA revisions (2026-08-01) — BINDING, they supersede the earlier wording

Seven corrections from the owner's first pass over the built screen. All are implemented.

1. **ONE kind of block, not two.** "Add a block" / "Add a rotation" collapsed into a single
   **Add a block**; whether its stations rotate is a **toggle inside the block, defaulting to
   rotate**. ⚠ The toggle only appears at **two or more stations** — one station with groups queued
   behind it is a queue, not a rotation. `blockRotates()` is the single answer, shared by the
   sanitiser, the builder, the grid and the printed sheet. This **retires D23's "two shapes"
   framing**: the shape was never the coach's decision to make before typing anything.
2. **"Bring / kit" → "Equipment", as reusable tags**, suggested from what the team has used before —
   the same control as staff names. Station equipment became tags too. Legacy free-text `kit` is
   read forward into the first tag.
3. **⚠ PEOPLE LIVE AT EXACTLY ONE LEVEL.** A block with no stations owns its player list; add a
   station and the list moves to the stations; make it rotate and the people live only in the
   groups. Enforced in the sanitiser, not just hidden in the UI, so no payload can produce two
   disagreeing answers to "who is at this station?". **This generalises D23** from rotations to
   every block.
4. **A rotating station shows which group STARTS there** ("Starts with Group A"), so a station card
   answers "who do I begin with?" without reading the grid. Where more groups than stations share a
   start, **both are named** — never one silently winning.
5. **The optional "to" minutes is refused below the floor** — `min` on the control plus a spoken
   correction. The sanitiser already dropped such a range; the coach could previously type "30 to
   20", see it accepted, and find it gone on reload.
6. **A station IS the drill** (owner-confirmed). No change needed — D27's drill/practice split
   already draws that line, which is what Phase 2 lifts the library out of.
7. **Practice type — a LABEL now, filtering in Phase 2.** A multi-select **"Kind of practice"** on
   the plan, shown on screen and on the printed sheet. ⚠ **Coach-typed tags, never a fixed list**:
   "Hitting / Fielding / Pitching" is one sport talking, and the sport-neutrality rule binds here
   even though these are labels rather than seeded data.
   **It does NOT filter the focus rail yet, deliberately.** Focus areas are free text a coach typed
   ("stay back on the curve"), so nothing knows which are "fielding" — filtering needs focus areas
   to carry a category, which the drill library pays for in **Phase 2 (D16)**. Doing it now would
   mean either categorising every existing focus area by hand or guessing from keywords, and §4
   forbids the guess ("free text doesn't cluster; the grouping would be a confident lie").
   **⚠ And when filtering does land, non-matching areas DIM, never hide** (owner ruling, confirming
   D16 and §4) — a player whose only focus areas are off-type must never vanish from a coverage
   list, because that is precisely the child most likely to be overlooked.

---

## 10.5 · Saving model — AUTOSAVE CONFIRMED (owner, 2026-08-01)

The owner asked whether a screen this data-heavy should have an explicit **Save** button pinned to
the bottom instead of saving on every change. **Ruled: keep autosave**, for two reasons:

1. **Consistency.** Every other coach surface saves itself — the lineup builder, evaluation
   sessions, attendance. A Save button here would be the only one in the product.
2. **Interruption is the use case.** §2 describes a coach with "~4 minutes of attention" on a phone
   on a couch. Phones evict background tabs aggressively; an explicit-save model loses a
   half-written plan to a phone call. `UnsavedChangesGuard` catches deliberate navigation only —
   not tab eviction, not a flat battery.

**Two real defects surfaced by the question, both fixed:**

- **⚠ The status pill was lying.** It read "Saving…" whenever `saving || dirty`, so a coach could
  not tell *working* from *stuck*, and the word was frequently untrue. Now three honest states:
  **Saving…** only while a request is genuinely open · **Unsaved changes** · **Saved**. The save is
  also **bounded (15s)** — a request that never returns becomes a visible failure with Retry rather
  than an eternal spinner.
- **⚠ Autosave was deleting half-built rows.** The sanitiser discarded any block or station with
  nothing typed in it. Autosave fires ~1s after typing stops, so adding three stations and naming
  one meant the other two were gone on reload — and the screen still looked right, because the
  response isn't applied to local state. **Emptiness no longer discards anything**: a row exists
  because the coach pressed "Add", and that press is the intent. Only junk that was never a row
  (a string, a null, a number in the array) is refused. Abandoned rows are the coach's to delete,
  and each carries a visible bin.

⚠ **The interaction between "autosave" and "discard incomplete data" is the thing to watch** in any
future slice: a rule that is safe on an explicit save becomes data loss under autosave.

---

## 10.3 · Deviations taken at build time (2026-08-01) — deliberate, and why

Two places where the build delivered the **decision's outcome** by a different mechanism than the
decision's wording named. Both are recorded here so a later session doesn't "restore" them.

### 1. D12 staff — reusable NAMES, not `rep_team_tags` rows

**D12 ruled "tags", naming the existing coach tag control.** The build stores staff as plain
**names** on the plan, with the reusable vocabulary assembled from (a) the team's own coaching staff
and (b) every staff name already used on this team's previous practice plans
(`collectStaffSuggestions`). The behaviour D12 specified is fully delivered: team coaches are
offered automatically, anyone else is created on the spot by typing them, and the name is reusable
on every later plan.

**Why the mechanism changed:**
- A plan lives in a **jsonb column**, so a tag reference would be an id embedded in JSON — not the
  join-table linkage every other tag kind uses. `merge_rep_team_tags` re-points
  `rep_team_event_tags` and `rep_team_expense_tags`; it **cannot** re-point ids inside jsonb, so
  merging two staff tags would silently orphan every practice plan referencing the loser. That is a
  data-corruption path introduced purely to reuse a control.
- It would also have required widening the `rep_team_tags.kind` CHECK constraint (a shared,
  cross-feature constraint) and adding a `kind` parameter to the coach tags route.
- **A past plan naming "Adam" should keep saying "Adam"** — it is the historical record of who ran
  that station. A rename-everywhere function is arguably wrong for this artifact.
- The suggestion list **self-heals**: a typo stops being offered as soon as no plan uses it, which
  is better than a 50-tag library a coach must curate by hand.

**Net:** same coach-visible behaviour, no CHECK-constraint change, no new route, no dangling ids,
no merge-corruption path. ⚠ If the owner wants a *managed* staff list (rename, retire, merge), that
is a real feature — raise it rather than quietly swapping the storage back.

### 2. §10.2 ruling 3 — the program-year date bound is NOT enforced

Ruling 3 said to refuse an out-of-season session date "with a plain reason", **with an explicit
escape clause: "where a program year has no bounded dates, accept anything."** Verified at build
time: `rep_program_years` carries **no start/end dates** — only a `year` integer and a status. There
is nothing to bound against.

Deriving a bound from the calendar year would be **wrong**, not merely incomplete: a "2026" season
that runs September 2026 → March 2027 would have its own March practices refused. So the escape
clause applies and the existing sanity bounds (`isValidRecordDate`: a real date, year 2000 …
next year) are the only guard. **If season date bounds are ever added to `rep_program_years`, this
becomes a two-line change** — that is the trigger to revisit, not a defect to fix now.

---

## 10.6 · Slice 1b deviations + the two rulings taken at build time (2026-08-01)

**Two owner rulings, taken at the recommendations before any code was written:**

1. **The field clock RE-ANCHORS on every tap.** Opening the run screen lands the coach on the block
   the *planned* clock says is running, with the true time left — the reason to pull a phone out
   mid-practice at all. **The moment they tap Next block or Rotate now, that stop re-anchors to now
   and gets its full planned length.** A practice that starts eight minutes late therefore does not
   spend the rest of the night declaring every remaining block overdue. *Anchor to the plan for
   ORIENTATION, to the tap for DURATION.* ⚠ Nothing about position or elapsed time is stored — the
   anchor is React state, derived fresh on every render (D4 intact).
2. **The archived-season dead-end (§11.1) closes by HIDING the door** — see §11.1, now CLOSED.

**Two deviations from the letter of the round-5 mockup, both deliberate:**

1. **"My station" carries the advance control the mockup omitted.** That frame drew no buttons at
   all. But the person this screen exists for is standing at a station, and without it they must
   back out to the station list, tap, and come back in — three gloved taps, three times a practice.
   It is the same tap as "Rotate now" on the block screen, driven by the same handler, and it
   records nothing, so D4 and D26 are untouched.
2. **Tonight's note is NOT attributed.** The mockup drew *"Note from Brett"*; the model stores the
   note and not who typed it, and inventing an author on the one line a coach is most likely to act
   on would be a fabrication. It reads **"Note for tonight"**. ⚠ Attribution is a model change, not
   a label change — raise it as one.

**One structural call taken during `/docs`:** the field-screen half of the practice-plans guide
became its own section, **`premium-practice-run`**, because the original had grown to sixteen
paragraphs spanning two different jobs (writing on a couch, running in the sun) and the run screen
needs its own deep-link anchor for in-context help. The two sections cross-link.

**Three stale-1a corrections the owner-QA revisions had left in the guide**, found and fixed in the
same pass: the guide still described duration **ranges** (removed §10.5), still called equipment
**"kit"** (renamed §10.4 item 2), and still told coaches to *"make a block a rotation"* as though it
were a block type to add (collapsed into the rotate toggle, §10.4 item 1) — the last of which would
have sent a coach hunting for a button that no longer exists. The **"people live at exactly one
level"** rule (§10.4 item 3) was undocumented entirely and now has a paragraph and an FAQ.

---

## 10.7 · Phase 2 — the owner rulings and the build record (2026-08-01) — BINDING

**Status: BUILT on `dev`, UNCOMMITTED, owner QA pending.** Migration **218** applied to **dev only**.

### The two gate rulings, taken before any code was written

1. **GATE 2 — the drill library ships PER-TEAM *and* CLUB-WIDE together.** The owner was offered
   per-team-now (with club-wide as a cheap, precedented later widening) and chose **both**. Logged in
   `BUSINESS_DECISIONS.md` 2026-08-01. A club-wide library is the first artifact where a club's
   *coaching method* becomes an org-level asset, which is a real reason Club sits above League.
   ⚠ **Known cost, accepted:** the shared set has nobody to author it on day one, because the library
   ships empty by design. **No pricing, plan, band, SKU or gate moved** — drift check run.
2. **THE ARCHIVE — the library is LIVE-SEASON ONLY, and a coach pulls their own history forward.**
   Its door is hidden in a completed season (a drill library is a reusable *instrument*, not a record
   of a season). ⚠ **Discovered while designing this and it made the ruling cheaper than expected: a
   TEAM IS PERMANENT — only its program year turns over — so a team-scoped drill library survives a
   season rollover with no import at all.** What genuinely *is* season-locked is the practice PLANS,
   so **"Add drills from a past season"** reads those and copies them forward. That route is the
   **single deliberate cross-season read in the whole feature**; it writes nothing into a finished
   season, and `tests/unit/coach-season-write-guard.test.ts` now asserts the library stays OFF the
   season-read rail so a later session cannot assume the question was already answered.

### The three build-time rulings the owner took on the mockups

3. **A DRILL IS ONE ACTIVITY — one station's worth.** Confirms §10.4 item 6 ("a station IS the
   drill") and **supersedes the older "default stations" wording**: a drill carries no nested station
   list. Picking one drill while adding a block gives a block with that activity in it; picking a
   **second into the same block produces two stations, which is exactly when `blockRotates` turns
   true**. The carousel is assembled by picking — still no second kind of block anywhere.
4. **THERE IS NO "how many of it" COUNT.** It would be 1 almost every time, and three of something is
   three adds or a line in "just for tonight". ⚠ This also **RETIRED the station-level `count` that
   slice 1a shipped** — a live removal, not just a mockup change.
5. **⚠ A LOADED DRILL'S OWN WORDS ARE READ-ONLY** (owner: *"if I load a drill and completely change
   everything about it, then I didn't run the same drill"*). A drill is an **identity claim**, so the
   count has to mean the same thing eight times. **This OVERRIDES the D14 copy-on-load precedent,
   which was cited in favour of editable and does not bind here** — a plan template is scaffolding
   for a practice; a drill is a named thing you claim to have run.
   - Locked: the drill's `description`, `goal`, `coachingPoints`, `setup`, `equipment`, name.
     Rendered as **text, not disabled inputs** — a stack of greyed boxes reads as broken on a phone,
     and text makes a drill-backed station visibly a shorter, different shape.
   - Editable: everything the PRACTICE owns — who runs it, who's at it, the block's length, and
     **"Just for tonight"**, which absorbs most one-word-different cases with no detaching at all.
   - **"Edit just for this practice" DETACHES** (proposed at build time, owner approved): keeps every
     word, drops the provenance, stops counting toward the drill. **The edit breaking the link is
     what keeps the count honest** — detaching is the honest act, not a workaround. "Swap drill"
     falls out of the same shape for free.

### Deviations + corrections taken during the build

- **Vocabulary, found by the planned-vs-done audit and fixed:** "Used 8×" / "Ran 6×" were **claims
  the data cannot support** — nothing records what was actually run (D4), and a coach may have
  planned a drill and skipped it in the rain. Now **"In 8 plans" / "Not in a plan yet" / "last
  planned"**, and the field is named `planCount`, so the honest word is in the type as well as on
  screen.
- **A label collision fixed:** the builder called coaching points *"What to watch for"* while the
  field screen called the GOAL *"What you're watching for"* — two fields, near-identical names, one
  screen apart. Now: the goal is **"What you're watching for"** everywhere, the numbered list is
  **"Coaching points"** everywhere.
- **The Drills door is gated on `schedule` as well as on the season** (found by review). Development
  is reachable by an assistant granted `notes` alone, who would otherwise be shown a door that
  answers "you do not have access to the schedule" — the same dead-end bug the archive rule forbids,
  wearing a different wall.
- **The printed sheet's station lines were already stale** and are fixed in passing: they said "Kit"
  (renamed at §10.4) and interpolated the equipment ARRAY, printing "Screen,Balls,Net" with no
  spaces.
- **The probes earned their keep twice:** they caught a wrong relative path on the new page's CSS
  import (which TypeScript cannot see, so the room rendered a build error) and three controls under
  the tap floor. ⚠ A first version of the tap probe asserted a blanket 44px across the document and
  failed on the portal's own shell — **the team nav renders 38.5px and the shared button primitives
  31–41px product-wide.** That baseline is pre-existing and was NOT changed to make a test pass; the
  probe was narrowed to the controls this feature adds, and those were raised locally.

### What Phase 2 did NOT change

No new capability key (reads ride `schedule`, writes stay head-coach-only) · no new top-level nav ·
no pricing/packaging/gate change · no change to how a plan is saved · **no migration of old plans,
and none is wanted** — a station falls back to its block's teaching, so every plan written before the
library keeps reading correctly for ever.

---

## 10.8 · Phase 3 — the owner rulings taken at sign-off (2026-08-01) — BINDING

**Status: mockups signed off** (`claude.ai/code/artifact/7ac29440-1e16-4b0e-a22b-9e0093470107`,
12 frames). Migration **221**. These rulings SUPERSEDE §9.2 wherever they disagree.

### 1. The archive — templates and looking-back get DIFFERENT answers, as anticipated

- **Plan templates are an INSTRUMENT — live-season only**, door hidden in a finished season, exactly
  as the drill library. ⚠ **Scoped to the TEAM, not the program year** — so like drills they cross a
  season rollover with nothing to import. **Deliberately NOT the `rep_team_lineup_templates` shape
  (mig 159), which is year-keyed**; copying that precedent would strand a coach's templates every
  autumn. §7's "the V1 shape lifts in unchanged" is overridden on this one point.
- **Looking back is a RECORD**, and it opens further than first ruled: **a past plan is readable
  READ-ONLY in any season**, reached *only* from the looking-back list. ⚠ **This is a NEW ARCHIVE
  DOOR and was ruled explicitly** — the build-enforced allow-lists are what forced the decision, which
  is what they are for. **The schedule's practice-plan section stays hidden in a completed season**
  (1b's §11.1 ruling is NOT reversed) — the new door is narrow and one-way.

### 2. Categories became TAGS (owner ruling — supersedes Phase 2's free-text category)

**One shared tag vocabulary across drills, plan templates, plans and players' focus areas**, joining
the tag system the product already runs (`rep_team_tags`, mig 181 + 184) as a **new `kind`** rather
than a second system. What that buys, in the owner's order of interest: **several per item**,
**rename**, and above all **`merge_rep_team_tags`, which atomically re-points history** — the reason
tags beat free text here.

⚠ **This retires the `category` column mig 218 shipped on both `rep_team_drills` and
`rep_player_development_goals`.** Zero customer impact: 218 is DEV-ONLY and the drill library has
never been on prod, so there is no real data to migrate. **This change was only cheap today.**

- **Uniqueness is case-insensitive per team+kind**, which makes the "Hitting" vs "hitting" drift
  **structurally impossible**. ⚠ **It was a live defect in committed Phase 2**: `collectDrillCategories`
  de-duped case-insensitively while `filterDrills` matched exactly, so a case-variant category showed
  one chip, under-counted it, and left the other drills reachable by **no chip at all**. Fixed here by
  construction rather than by patching the comparison.
- **A new tag is only minted on an explicit "+ New tag"** — typing searches existing tags. Deliberate
  friction: the list must grow by decision, not by typo.
- ⚠ **A FOCUS AREA IS FREE TEXT FIRST, TAGGED SECOND** (owner, explicitly). `focusArea` stays the
  coach's own specific words — *"loading their back hip"*, *"changeup accuracy"* — because that is what
  a coach coaches from. **The tag never replaces it**; it carries **ONE optional tag** purely so the
  rail can tell it belongs to tonight's practice. **A focus area is deliberately MORE SPECIFIC than a
  plan tag** — flattening the two would lose the coaching. Hence the asymmetry: drills/templates/plans
  carry SEVERAL tags (join tables), a focus area carries ONE (nullable FK).
- **Focus-rail matching:** an area stays at full strength if its tag matches anything planned tonight.
  ⚠ Carried unchanged from Phase 2: **dim, never hide, never reorder**, and **an UNTAGGED area stays
  at FULL strength** — absence of data must not read as absence of need.
- **The template room is ONE FLAT LIST filtered by tag chips, not category groups** — several tags per
  item would print the same template under two headings. "No tags" is always offered when it applies.

### 3. Plans carry tags, and that is what makes the recap worth writing (owner's own insight)

A coach about to plan a hitting practice **filters past practices to "Hitting" and gets every one they
have run, what was in it, and what they said afterwards.** This reframes D17: the recap is not a diary
(which a coach stops writing by June) but **a body of experience they mine before planning** — and it
is the first surface in this project that gets *better* the longer the product is used.

**Reuse:** a plan's tags are rows in the existing `rep_team_event_tags`, distinguished by the tag's
`kind`. No new join table for plans.

### 4. "New template" is offered at ZERO as well as at one (owner ruling)

The empty state offers all three routes — build one, import from a past season, or save one from a
practice. ⚠ **Consequence, accepted:** refusing at zero while allowing at one is an arbitrary rule, not
a principle — so **the template room owns a FULL block-and-station editor**, not a rename box. A
template built from scratch has no practice to inherit a shape from.

### 5. Vocabulary — carried forward unchanged

**"Started 8 plans" / "Not started a plan yet"**, never "used". Same rule as Phase 2's "In 8 plans".
The coverage answer still says **"In a plan"** — never "worked on", "covered" or "did" — and a recap
existing on some practices does not license the report to claim the plan happened.

### What did NOT change

No new capability key (templates ride `schedule` to read + head-coach-only to write; the coverage
answer rides `notes`) · no seventh Insights tile · no new report page · the drill read-only rule ·
the no-ranking rules on the coverage table · **club-wide TEMPLATES were never asked for and are NOT
built** — templates are team-scoped only. ⚠ If that question is raised, **route it, don't decide it**;
the club-wide drill precedent (`BUSINESS_DECISIONS.md` 2026-08-01) and mig 184's nullable-`team_id`
widening are the cheap path if the owner ever says yes.

---

## 10.9 · Phase 3 — build record and the deviations taken (2026-08-02)

**Built in one pass, uncommitted on `dev`.** Frames 01–12 all implemented; nothing was redrawn.

### The five decisions taken at build time that were NOT in the frames

1. **"Kind of practice" (free text) is RETIRED, replaced by the shared tag picker.** The frames
   never draw that control, but rulings 2 and 3 require a plan to carry tags from the ONE
   vocabulary, and the focus rail to match on them. Leaving the free-text box beside the picker
   would have been a second vocabulary that could never match the first — exactly the drift the tag
   work removed. ⚠ **`plan.practiceTypes` is still READ** (so a plan written in 1a keeps softening
   the rail on its own words) and renders read-only as **"Also tagged"**; nothing writes it, and its
   suggestion pipeline was deleted rather than left dangling.
2. **The read-only past plan lives under `history/development/practices/[eventId]`**, inside the
   report's own subtree, so *"reached only from the looking-back list"* is structural rather than a
   promise. Its API is a **separate GET-only route** (`…/practice-plan/read`), NOT the season rail
   bolted onto the live editor's GET — that route also holds the PUT and the PATCH, and one file
   carrying both postures is how a write eventually reaches an archive.
3. **The three report sections ride `development/board?plans=1`** rather than a new route. All three
   answers come from ONE walk of the season's plans, and a second copy of that walk is how two
   sections start disagreeing. ⚠ The section is gated on `schedule` INDEPENDENTLY of the board's
   own roster gate: an assistant who cannot open Tuesday's practice must not read its blocks here.
4. **Tag management opens from the drills and template rooms**, not as a third Development door.
   The frame draws the screen but not its entry point.
5. **`setRepTeamEventTagsOfKind` was added.** The existing writer replaces EVERY tag on an event,
   which was complete when game tags were the only kind — saving a plan's tags through it would
   have silently deleted the game tags on the same practice.

### The `/simplify` TODO, discharged

`lib/coach-tag-routes.ts` collapses what were three hand-copied route groups into one, now serving
**five** (game, expense, focus). ⚠ **`seasonAwareRead` is the load-bearing field**: it is `true` for
game and expense (approved in Chunk F) and **`false` for focus BY DECISION** — a vocabulary is an
INSTRUMENT, and a past plan renders from tag names snapshotted into it. The write-guard test now
reads that flag, because a source scan that only looked for a `resolveCoachSeasonRead(` CALL would
have gone blind to two routes the moment they were collapsed.

### `/simplify` pass (2026-08-02) — 14 fixes, and it caught two REAL defects

⚠ **The two that mattered were both quiet failures of the safety nets this codebase leans on
hardest**, each introduced by an otherwise-good refactor that didn't carry its predecessor's
protection all the way through:

1. **The write-side archive guard went BLIND on all nine tag routes.** Collapsing them into a
   factory removed the literal text `export const POST` from every file, so
   `coach-season-write-guard.test.ts`'s two write-side rules found no body to inspect and silently
   `continue`d — **still reporting green**. I had fixed the READ side of exactly this problem and
   missed the write side. The guard now FOLLOWS delegation (`DELEGATED_HANDLERS`), and a new test
   fails if any exported write verb resolves to no inspectable body — proven to bite by removing a
   delegation entry and watching it name the three routes it could no longer see.
   **A vacuous pass is worse than a failure.**
2. **Migration 222** — the plan-template write policies did NOT gate on `coach_role = 'head_coach'`
   the way their drill sibling (mig 218) does, while the route comment asserted "RLS mirrors both".
   Any assigned assistant could have written templates directly from their own session, including
   an unstripped `plan` carrying people. Applied to dev and verified against `pg_policies`.
   ⚠ Policy-only, so `check:migrations` is a KNOWN FALSE GREEN for it — verify from `pg_policies`.

Also fixed: the template read path now re-strips people (two layers, not one) · the coverage read
was awaiting AFTER the board route's existing batch despite depending on none of it — a serial
round trip on every report load, now inside the batch · a single-template GET was scanning up to
400 plans to produce one integer, now a targeted count · `collectTags` and `totalPlannedMinutes`
reused instead of re-implemented · the coach-team auth prefix extracted to
`lib/coach-route-context.ts` (three copies, one already drifted) · the focus-tag vocabulary
collapsed to one hook (`components/coaches/use-focus-tags.ts`, four client copies → one) ·
disjoint tag delete/insert parallelised · two nested ternaries flattened · a stale PDF comment.

**Skipped, with reasons:** the tag-filter-chip row is hand-copied three times, but only two call
sites are in this diff — the third is the committed drill library, and extracting a shared
component for two while leaving the third is half a job. Same for adopting the new tag hook there.
Both are the next session's cheap win.

### `/review` pass (2026-08-02, high-risk tier, 5 lenses) — 8 confirmed, all fixed

Lenses: correctness · security/multi-tenant · capability parity · product-rule & vocabulary ·
regression/blast-radius. **1 Critical, 2 High, 3 Medium, 2 Low. Zero refuted findings survived
unfixed.** Every Critical/High was adjudicated in the main loop against the actual code, not taken
on a subagent's word.

**⚠ CRITICAL — the live practice-plan GET leaked every child's name and number to a coach with
`roster: 'off'`.** `roster` is an INDEPENDENT grant from `schedule`, so an assistant trusted to run
a station but not to hold the team list would still receive the full roster: the handler gated only
on `schedule`, and `redactRoster` nulls PII/notes FIELDS without ever consulting `caps.roster` — a
no-op on a `{id, name, number}` projection. **Pre-existing since slice 1a**, but in scope: this
phase edited that exact handler and shipped a correctly-gated sibling (`…/practice-plan/read`)
beside it. Now gated at the SOURCE — the list is never fetched, so no client mistake can surface it.

**⚠ HIGH — a CANCELLED practice appeared under "Practices you've run".** Cancelling only flips
`status`; it never clears the plan or the recap. So a rained-off practice rendered under the one
heading licensed to assert something happened — the "planned quietly becomes done" trap §4 exists
to prevent, and the same shape an earlier `/review` had already fixed for cancelled games in this
very file. Excluded from the list AND 404'd on the archive door, so a kept link cannot open it.

**⚠ HIGH — "focus areas that haven't appeared in a plan" skipped the thin-data gate its two
neighbours use.** With one plan in the season it confidently named a gap the other two sections
were refusing to claim. Worse: the practices read is deliberately non-fatal, so a SWALLOWED READ
FAILURE would have listed EVERY active focus tag as uncovered — a confident wrong answer
manufactured out of an error. Gated on `planCount` (not `answerable`: naming players is optional
and this question is about tags, not people). Three unit tests pin it.

**Medium ×3:** "Who ran it" / "Who was at it" on the read-only past plan asserted execution and
attendance the product has never recorded (D4) — now "Who was assigned", matching the live editor;
my defending comment conflated *the writing happened in the past* with *the plan was followed* ·
the events routes still used an UNSCOPED tag writer that deletes every tag on an event regardless
of kind — dormant only because one form happens not to send tags for a practice, so **the unscoped
writer has been deleted outright** rather than left as a footgun · the tag picker saves on every
click with no debounce, so two fast taps raced into a primary-key conflict that failed the WHOLE
insert (dropping the second tag) with no client rollback — now an idempotent upsert, and the
optimistic UI reverts on failure.

**Low ×2:** template tag validation proved org but not TEAM, unlike `isTeamFocusTag` one screen
over — a coach who once held another team in the org could have linked its word into this team's
library · the unified cap message dropped "Delete or" on two committed surfaces where deleting
still works.

**Not defects, recorded so they are not mistaken for drift:** malformed JSON on three tag POSTs now
answers 400 instead of 500 (an improvement from the factory's shared body parse) · the report
sections gate on `schedule` rather than `notes` — a documented, strictly-more-conservative
deviation (§10.9) · the archive door, the RLS posture after mig 222, and the nine tag routes'
capability gates were all diffed against `HEAD` and confirmed unchanged.

### Two probe decisions worth not re-litigating

- **`.ppSuggestChip` is excluded from the tap-floor selector.** It is a SHARED primitive that
  shipped in Phase 2 at ~21px, used by the drill library's chips, the plan editor's suggestions and
  the tag picker. This phase reuses it correctly; failing on it would force a widening that four
  committed surfaces depend on. Phase 2's own probe excluded it for the same reason.
- **An absent "In a plan" column is a PASS.** On a team with fewer than three plans, or none that
  name anyone, the column is *supposed* to be missing. A probe that demanded it exist would push the
  product into the confident lie it refuses.

---

## 11 · Cut list — judged out, do not quietly re-add

Auto-generated plans from focus areas (free text doesn't cluster; the suggestion would be a confident lie) · **a drill library in V1** *(revised round 2: a coach-authored drill library is now **V2** — what stays cut is drill **videos**, hosted drill **content**, and any seeded sport-specific drills)* · **player grouping by ability or need** *(explicit coach-chosen pairs are V4; automatic grouping by level stays cut forever)* · any "these N kids need the most work" surface · parent/player/guardian visibility of a plan · timer sounds, vibration, notifications, or auto-advance · plan sharing links · simultaneous multi-station timers · importing an existing Google Doc · a plan on the Overview screen (Chunk I: the Overview shows **one** anchor by an ordered rule — a practice plan does not get to jump that queue) · a seventh Insights tile · **per-child commentary in the "how it went" recap** (D17 guardrail — practice-level only).

---

## 11.1 · ✅ CLOSED — what a practice plan does in an ARCHIVED season (raised by the Chunk F session; RULED by the owner 2026-08-01, built in slice 1b)

> **✅ RULING: HIDE THE ENTRY POINT.** The owner was offered the three options below and chose the
> cheapest correct one. **The schedule slide-over's practice-plan section now renders only when the
> season is live** (`!page.isReadOnly`), so in a completed season neither *"Open the plan →"* (which
> errored) nor *"Run practice →"* (which would have inherited the same break) exists to dead-end on.
> One condition, no new plumbing — and it CLOSED an existing defect rather than doubling it, which
> is why it was worth doing inside 1b rather than deferring to project close.
>
> **This is the "archive is OPT-IN" ruling applied to its first new feature since that ruling was
> made.** The server already failed closed by construction: the practice-plan route resolves the
> team's ACTIVE program year and is correctly absent from `APPROVED_SEASON_AWARE_ROUTES`.
>
> **The door remains re-openable.** If the owner later decides practice plans SHOULD be readable in
> history — a defensible ask, and the same instinct that put tryout history in scope — the four
> steps below are still the work, and both build-enforced allow-lists still fail the build until
> the decision is made explicitly. Nothing in 1b forecloses it.

⚠ *Original brief, kept for the reasoning:* Chunk F (the frozen past season) shipped
while this build was in flight, so the two never met.

**Where it stands today, verified 2026-08-01 — the data is safe, the door is not:**
- ✅ **No data risk.** The plan lives on the practice EVENT, and events are season-keyed, so a 2025
  plan is permanently attached to 2025. Nothing can leak between seasons or be lost.
- ❌ **The archive dead-ends.** `events/[eventId]/practice-plan` resolves `getActiveRepProgramYear`
  and then requires `event.programYearId === programYear.id`. From a past season that is never true,
  so **"Open the plan →" errors** — and on a team with no live season it errors for every plan, which
  is exactly the coach most likely to be looking back.
- ❌ **It invites a write into a finished season.** The schedule slide-over's practice block sits
  OUTSIDE the actions block Chunk F gated, so an archived practice with no plan still offers
  **"Plan this practice →"**.

**The owner ruling that governs the answer (2026-08-01, binding — `memory/design_decisions.md`):**
**the archive is OPT-IN.** New coach-portal functionality is *not* viewable in past seasons unless
someone decides it should be. So the default, and the cheapest correct close-out, is:

> **Hide the practice-plan entry point when the season being viewed is a record** — the schedule
> slide-over's practice block renders only when the season is writable. One condition, no new
> plumbing, and nothing dead-ends.

**If the owner instead decides practice plans SHOULD be readable in history** (a defensible ask —
"what did we work on last spring" is the same instinct that put tryout history in scope), the work is
small and the pattern is already built and proven on the roster-player and lineup-detail pages:
1. Route → `resolveCoachSeasonRead` (`lib/coach-season-read.ts`), event matched against the RESOLVED
   season, capabilities from that season's assignment row.
2. Page → `useCoachSeasonPage`, `CoachSeasonChip` beside the title, every write control through
   `page.canWrite()`.
3. The schedule link carries `page.query`.
4. Add `events/[eventId]/practice-plan` to `APPROVED_SEASON_AWARE_ROUTES` and the page to the
   archive sweep in `tests/uat/scenarios/coach-frozen-season-smoke.spec.ts` — **both lists fail the
   build until you do, which is the point.**

---

## 12 · Risks & mitigations

| Risk | Mitigation |
|---|---|
| **The Doc is genuinely good enough for some coaches** — we build it and they don't switch | Accepted openly (D2). The link field stays; no nagging, no "you haven't made a plan" prompts anywhere. Success is measured on the coaches who *do* run the field view, not on adoption of the builder. |
| **Authoring on a phone is slower than Notes** | Three fields per block, defaults everywhere, copy-from-previous as the fastest path, no drag on touch. If the mockup round shows the builder still feels heavy, cut the block `note` field before cutting the focus rail. |
| **"Planned" quietly becomes "done"** in copy or in a later phase | Hard vocabulary rule in §4; a `/review` checklist item; D4 keeps the only path that could honestly promote it explicitly closed. |
| **Recurrence trap** — a plan silently applied across a weekly series | D7. Explicit non-goal in the plan and a review checklist item. |
| **Capability leak** — an assistant without `notes` seeing focus text via the plan, the print, or the run view | §8 parity rule; probe as the read-only assistant across **all three** surfaces (builder, run, PDF) — the PDF path is the one most likely to be forgotten. |
| **Prod 500s on event edit** if the column ships before the migration | §7 release rider; `/release` applies the migration before promoting. |
| **Sport coupling** | No hard-coded drills, station names, period vocabulary or durations. Anything sport-shaped routes through `lib/sports.ts`. Seeded content is a fast-follow, never V1. |
| **Scope drift into a drill library** | §11 cut list. |

---

## 13 · Process, verification & gates

- **Mockups before code (owner-mandated, non-negotiable).** Route the surface design through `/design`; label every region **NEW / RESTYLED / UNCHANGED**; owner approval makes them the binding visual spec. Minimum frames: builder (desktop + 390px), builder empty state, the focus rail, the run view (**shown at 361px**), the print sheet, the slide-over summary, the Development hub pointer line.
- **Ratify D1–D9** before build.
- **Then:** build the whole approved scope in one pass → `/simplify` → `/review` → `/docs` → probes → clean dev restart → owner QA → commit on `dev` with explicit per-action OK.
- **Static checks:** `npm run typecheck` (shared modules touched — `lib/types.ts`), `lint:focused`, `npm test`, `check:dictionary` + `refresh:snapshots` (schema change), `check:org-context`, all colour/token baselines **unchanged at zero**.
- **Playwright computed-style verification** (binding — never screenshots) at **361 / 390 / desktop**: run-view primary control ≥56px, block title type scale, no horizontal overflow, the builder's composed layout at more than one scroll position.
- **`/review` checklist additions specific to this feature:** the no-ranking audit (no sort affordance, no comparable per-player figure) · the planned-vs-done vocabulary audit **including the PDF** · client/server capability parity across builder + run + print · the recurrence non-application (D7) · timezone-correct block clock arithmetic via `lib/timezone.ts`.
- **`/docs`** ships with the build: a Practice plans guide in `lib/help-content/coaches.tsx` indexed by keywords (search matches keywords, not body), plus the help entry on both new routes.
- **`/strategy`:** no pricing or packaging change — confirm the Premium gate against `PLAN_PRICING_FACTS.md` at build and run the drift check if anything about the gate turns out to differ. **No business decision to log unless the owner changes the parent-facing posture** (§0.4).
- **No commits/pushes without explicit per-action owner OK.** Stage explicit `:(literal)` pathspecs (bracketed route dirs are glob-hostile); audit `git show --stat HEAD`.
