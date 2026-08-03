# Practice Plans — Kickoff Prompt (planning only)

> Paste the whole of this file as the opening message of a fresh chat. It is written to be
> self-contained: a session that has never seen this project should be able to act on it.

---

You are a senior product designer and IA strategist working on **FieldLogicHQ**, a multi-tenant Canadian sports club and league management platform. This is a **planning-only kickoff** — no code changes, no migrations, no UI edits. Your job is to produce a real plan document and PM brief that a build session can execute from.

---

## YOUR MISSION

Design **Practice Plans** for the Premium Coaches Portal — roadmap **Phase 4 of Player Development**, the piece that was deliberately deferred when Phases 3A–3D shipped on 2026-07-17.

The organizing question is: **a volunteer coach has ninety minutes on a field on Tuesday night and twelve kids who are each working on something different — what does this product hand them that a Google Doc doesn't?**

That question is the whole brief. If the honest answer turns out to be "less than we assumed," say so and scope V1 accordingly — a small true thing beats a large plausible one. **Concluding that V1 is smaller than the roadmap implies is an acceptable and welcome outcome**, provided you show your reasoning.

---

## MANDATORY PROCESS STEPS (do these in order)

**Step 1 — Read before planning.** Read these in the repo. Skip gracefully with a note if any is absent.

- `docs/projects/archive/COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md` — **the parent project.** Read the "Scope decisions locked (owner, 2026-07-17)" block, the "Hard constraints" block, and §3B where the practice-plans slot was reserved. Every constraint in that plan is still binding on this one.
- `docs/projects/archive/COACHES_PORTAL_PLAYER_DEVELOPMENT_PM_BRIEF.md` — the plain-language framing of what development is for.
- `docs/projects/archive/SCHEDULE_EVENT_UX_PLAN.md` — how events (including practices) are built: per-type forms, recurrence, arrival/call time, field/diamond, and the **event resources link field** (see Current State below — this one matters a lot).
- `docs/projects/active/COACH_DEVELOPMENT_HUB_RESTRUCTURE_PLAN.md` — the in-flight hub restructure that **removes the room this feature was supposed to move into.** If this file does not exist yet, read the approved mockups instead: `claude.ai/code/artifact/f84317a8-3596-4fc0-b1fa-76d81bb9a750` (owner-approved 2026-07-31).
- `memory/design_decisions.md` — the **2026-07-17** Player Development entry (hub layout, CP-1 one-lime rule, session run screen, team board) and the **2026-06-29** Coaches Portal mobile conventions entry.
- `memory/MEMORY.md` — read `project_coaches_portal_architecture`, `feedback_sport_neutral_no_debt`, `feedback_decouple_structure_from_identity`, `reference_coach_portal_arch_decision`.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` — canonical plan names and gating. **Never restate a price from memory.**
- `docs/agents/strategy/BUSINESS_DECISIONS.md` — check for anything binding on parent-facing surfaces and on operations-first sequencing.

**Step 2 — Present a plain-language PM UX summary FIRST.** Before any plan structure, write the plain-language summary (Deliverable 1) for a product owner, not an engineer: what a coach sees and does differently on a Tuesday night after this ships. Put it at the top of your response behind a horizontal rule. **Then continue straight through the remaining deliverables — do not pause for confirmation.**

**Step 3 — Follow the method sequence** in the METHOD section (A → F).

**Step 4 — Produce ALL deliverables.** Create `docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md` + `..._PM_BRIEF.md`, and add one summary line to `TODO.md` linking to both. Log any durable business decision via `/strategy`; route the surface design through `/design` before a build session starts.

---

## WHO THE USER IS

The primary user is a **volunteer rep-team head coach**. Full-time job, coaches evenings and weekends, season is 3–4 months. Their phone is their computer. They plan Tuesday's practice on Monday night on the couch with the TV on, and they read that plan on Tuesday standing on a field — one hand on the phone, one eye on twelve kids, possibly in direct sun, possibly wearing gloves.

**They do not retain software knowledge between seasons.** Anything that depends on remembering where a feature lives will fail.

**What they do today, without us:** a note on their phone, a Google Doc, a laminated card, or nothing — they wing it. Whatever we build competes with those, and the Google Doc is genuinely good at some of this. Be honest about where it wins.

**Their assistant coaches** run stations. A practice plan that only the head coach can see is half a feature — but assistant access is capability-gated and must respect that model.

---

## CURRENT STATE — WHAT ALREADY EXISTS

This is the most important section. **A great deal of the machinery is already built.** The main failure mode for this project is rebuilding something that shipped.

### Practices are already first-class scheduled events
The Schedule owns a `practice` event type alongside games and team events. Practices already support: **weekly recurrence** with This / This-and-future / All edit scoping, arrival/call time, field/diamond number, location name + address with a Maps link, and per-event **attendance** (a redesigned compact row UI with status chips and per-player notes). There is also a schedule-import template kind for practices.

**Implication:** a practice already exists as an object with a date, a place, a time and a known set of attendees. A practice plan is almost certainly *something attached to that*, not a new parallel calendar.

### Events already carry labelled resource links
Every event has a "Links" section — labelled web links with per-type hints, tappable rows opening in a new tab, capped and sanitised. When that shipped, **"practice plans" was named as one of the intended V1 use cases**, alongside YouTube drills and rules pages.

**Implication — confront this directly:** a coach can already paste a link to their Google Doc onto Tuesday's practice. Your plan must answer whether we are replacing that, complementing it, or admitting it is sufficient for some coaches. Do not pretend the field isn't there.

### Development already knows what each player is working on
Phases 3A–3D shipped: per-player focus areas with status, a coach-defined test list, whole-roster evaluation sessions, a team board showing every player's active focus and latest readings, and a per-player coverage report answering "is everyone getting attention?".

**Implication:** the join between "what this player is working on" and "what we do at practice" is the only thing here a Google Doc cannot do. That join *is* the product. Everything else is a text editor.

### The portal already has a "save a reusable configuration" idiom
The lineup builder shipped **named lineup templates** ("Gold medal game") and a **printable dugout-wall poster PDF**. Both are directly analogous to what a practice plan library and a field-side printout would need.

**Implication:** reuse the idiom and the print pipeline. Do not invent a second one.

### The Development hub is being restructured right now — and the reserved room is going away
The 2026-07-17 owner decision reserved a dashed **"Practice plans — coming"** slot in the Development hub card grid, explicitly so that Phase 4 would fill existing room rather than mint new navigation later.

**That slot is being retired.** A UX review on 2026-07-31 found the hub read as an unordered mosaic; the owner approved a restructure into a single top-to-bottom sequence (work → exits → your test list), in which the practice-plans placeholder is demoted from a card to **one muted sentence at the foot of the page**.

**Implication — this is Owner Decision #1 for you.** The room this feature was promised is gone, and that is deliberate: a placeholder card was the wrong way to hold space. You must now decide where a practice plan actually lives, on its merits, and justify it against the IA rubric — not inherit a slot.

---

## METHOD — HOW TO CONDUCT THIS PLANNING

### Step A — Map the practice, not the feature
Before proposing anything, map the coach's practice cycle as job stages with a named goal each: **the week before** (what are we working on this month?) → **the night before** (what are we doing Tuesday?) → **at the field** (what's next, who's at which station?) → **after** (did we do it, and did anything get logged?). For each stage: primary job, what they need in front of them, what device they're on, what they do today without us, and where the highest-value opportunity sits.

Pay particular attention to **at the field**. That is the stage where a Google Doc is genuinely bad and where we can win — and it is also the stage with the harshest constraints (sun, gloves, one hand, no time to read).

### Step B — Decide the anchor
Answer, with a recommendation and stated trade-offs, where a practice plan lives. At minimum evaluate:
- **(a) In Development** — the originally reserved home. Close to focus areas; far from the calendar.
- **(b) On the practice event in Schedule** — where the coach already is when they think about Tuesday, and where attendance and the resource links already live. Far from the development data.
- **(c) Split** — a reusable plan library in Development, attached to an event from Schedule.

Test each against the IA rubric already in use in this portal (**Dashboard / Manage / Operate / Review / Admin**) and against the binding "no new top-level nav" rule. Say plainly which one you'd ship and why.

### Step C — Define the development join — this is the differentiator
Work out loud: what does the product know that lets it help plan a practice? Focus areas per player, coverage gaps, last-evaluated dates, attendance patterns, the test list. What can it legitimately offer — a suggestion, a grouping, a reminder, a coverage check afterwards?

**Hold the supportive-not-ranking constraint with teeth here.** "These four kids need the most work" is exactly the surface this platform has repeatedly refused to build. Find the version that helps a coach cover everyone without ranking children against each other, and state explicitly how your design avoids it.

### Step D — Define the field artifact
What is the coach actually holding at 6:30pm on Tuesday? Specify the phone view (glanceable, ≥40px targets, no reading required) and the print/PDF form (the dugout-poster precedent). Decide whether anything gets *logged* at the field or whether the plan is read-only once practice starts — and justify it against how much a coach can realistically do with twelve kids in front of them.

### Step E — Reuse audit
Produce an explicit **do-not-rebuild list**: every existing surface, primitive, or data structure this feature must sit on top of rather than duplicate. Name the shared empty-state primitive, the collapsible card, the table-to-cards reflow, the print pipeline, the event resources field, the attendance model, the development records. If your design needs something genuinely new, say why nothing existing fits.

### Step F — Phase it
V1 must be shippable on its own and demonstrably better for a coach than what they do today. State for each phase what the coach gains. Note explicitly which phases need a schema change and which don't — and prefer a V1 that doesn't.

---

## CONSTRAINTS — ALL BINDING

Carried forward from the Player Development plan and portal-wide precedent. Do not re-litigate any of these.

- **Supportive, never ranking.** No cross-player leaderboards. Roster-wide lists render in roster or alphabetical order — never "needs most attention first." No team averages or percentiles beside a child's number.
- **No parent, player, or guardian-facing surfaces.** Any printable output is coach-generated and hand-delivered. Never a shareable link.
- **PIPEDA / data minimisation.** Free-text stays skill- and goal-oriented. No behavioural-profiling fields. No second copy of guardian PII anywhere.
- **Honest data.** Empty states are a plain sentence plus one call to action — never a zeroed chart or a fabricated placeholder plan.
- **Sport-neutral.** No hard-coded drills, positions, station names, or period vocabulary. Anything sport-specific routes through the Sport Pack. A coach-defined library is fine; a baseball-shaped one is not. Sport-seeded starter content, if proposed, is a fast-follow and never V1.
- **No new top-level nav.** The IA rubric holds. Development entered the Squad group as a sanctioned consolidating exception; that exception is spent.
- **Head-coach-only writes by default**, matching the development precedent, with assistant visibility governed by the existing per-capability model. An assistant with a capability off never sees the tab. Design for assistants running stations without breaking that model.
- **Mobile-first.** Phone is the primary operating mode, not a squeezed desktop. Touch targets ≥40px (≥36px in dense grids). The lime accent is weak as small text in sunlight — high-contrast labels, solid fills, bold weight for primary state.
- **One lime action per surface (CP-1).** Every other action is ghost or outline.
- **Warm coach dialect.** The coach portal is the warm/rounded dialect; admin is the dense cockpit. Do not unify.
- **Reuse, don't rebuild.** See Step E. The shell, empty-state primitive, collapsible card, table-reflow, print pipeline, attendance model and development records are built.
- **Plan naming and gating come from the Facts doc.** Never restate a price or plan name from memory. This is a Premium Coaches Portal surface; confirm the gate against the canonical source.
- **Documentation conventions.** Detailed plan → `docs/projects/active/`; PM brief alongside; one summary line in `TODO.md`. See `AGENCY_RULES.md`.
- **Planning-only this session.** No source edits, no migrations. A separate build session follows owner approval.
- **Conflict protocol.** If a design you want conflicts with a binding constraint, do **not** silently resolve it. Flag it as an owner decision, name the constraint, and present the constrained and unconstrained options side by side.

---

## DELIVERABLES (produce all — do not stop at partial delivery)

1. **Plain-language PM UX summary (first, then continue).** 3–5 paragraphs for the product owner: what a coach does differently on a Tuesday night, what they can do that they couldn't, and honestly how it compares to the note-on-a-phone they use today.
2. **Practice job map.** The four stages from Step A, with goal, need, device, current workaround, and opportunity per stage.
3. **The anchor decision.** Options (a)/(b)/(c) evaluated against the IA rubric, with a clear recommendation and the trade-off named.
4. **The development join.** Exactly what the product contributes that a document cannot — and the explicit statement of how it avoids ranking children.
5. **The field artifact.** Phone view and print form specified; the read-only-vs-logging call made and justified.
6. **Reuse inventory / do-not-rebuild list.** Every existing thing this sits on, plus justification for anything genuinely new.
7. **Owner decisions list.** Each a clear choice with the trade-off named. Seed set — surface more as you find them:
   - **#1** Where does a practice plan live, now that the reserved hub slot has been retired?
   - **#2** Do we replace the existing event resource link, complement it, or leave it as the escape hatch for coaches who keep plans elsewhere?
   - **#3** Can assistant coaches see and run a plan, and does that need a new capability or does an existing one cover it?
   - **#4** Does anything get logged at the field during practice, or is the plan read-only once it starts?
   - **#5** Is a reusable plan library V1 or a fast-follow?
   - **#6** (added 2026-07-31 by owner request) Does an **evaluation session** get an editable date, and/or a link to the practice it happened at? A coach who runs tests on Tuesday and types them in on Thursday currently has no way to say so. The session already stores a date and the server already accepts a change to it — only the screen withholds it; the event link needs the additive column this project is already paying for. **⚠ Readings are date-stamped at the moment they are typed, so a date change must re-stamp that session's readings or the session disagrees with its own contents.** This is the same practice↔development seam as decision #1 pointing the other way, which is why the owner deferred it into this project rather than shipping it standalone. Full write-up lives in §10.1 of the plan if one already exists.
8. **Phasing.** V1 shippable and honestly better than the status quo; per-phase "what the coach gains"; migration needs flagged per phase.
9. **Plan document + PM brief.** `docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md` and `..._PM_BRIEF.md`, plus one linking summary line in `TODO.md`.

---

## STARTING INSTRUCTION

Begin by reading the files under Step 1. Say explicitly when you have finished reading and are starting the summary. Then present the plain-language PM UX summary as a clearly delineated section at the top of your response, and continue through the remaining deliverables without pausing for confirmation.

If your reading turns up something that contradicts this brief — particularly around the Development hub restructure, which is in flight as of 2026-07-31 — trust the repo over this document and say what changed.
