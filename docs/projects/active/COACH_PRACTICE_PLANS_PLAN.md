# Practice Plans — Implementation Plan (Player Development, roadmap Phase 4)

> **Status:** ✅ **PLANNING COMPLETE — ALL 30 DECISIONS (D1–D30) OWNER-ACCEPTED 2026-07-31, and all
> five mockup rounds accepted. The mockups ARE the binding visual spec.** Final phase ladder in §9.2.
> **Next step = the Phase 1a build session, in a FRESH chat** (`COACH_PRACTICE_PLANS_PHASE1_BUILD_PROMPT.md`).
> ⚠ **A release is overdue and is the higher priority** — see the TODO ledger. Planning-only session
> 2026-07-31 — no source edits, no migrations. A build session follows owner approval **and an
> approved mockup round** (owner-mandated: mockups before code).
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
| **2** | **The drill library** | Drills w/ categories, coaching points, setup, default stations · the picker + preview · promotion (D18) · **the focus-rail filter** (D16) | New table + an optional category on focus areas |
| **3** | **The plan library & looking back** | Templates grouped by category (D14/D15) · usage history · **"how it went"** (D17) · **the coverage answer** folded into the existing development report | New table |
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

## 11 · Cut list — judged out, do not quietly re-add

Auto-generated plans from focus areas (free text doesn't cluster; the suggestion would be a confident lie) · **a drill library in V1** *(revised round 2: a coach-authored drill library is now **V2** — what stays cut is drill **videos**, hosted drill **content**, and any seeded sport-specific drills)* · **player grouping by ability or need** *(explicit coach-chosen pairs are V4; automatic grouping by level stays cut forever)* · any "these N kids need the most work" surface · parent/player/guardian visibility of a plan · timer sounds, vibration, notifications, or auto-advance · plan sharing links · simultaneous multi-station timers · importing an existing Google Doc · a plan on the Overview screen (Chunk I: the Overview shows **one** anchor by an ordered rule — a practice plan does not get to jump that queue) · a seventh Insights tile · **per-child commentary in the "how it went" recap** (D17 guardrail — practice-level only).

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
