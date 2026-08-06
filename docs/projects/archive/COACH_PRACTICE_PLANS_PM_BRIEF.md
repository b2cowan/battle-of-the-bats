# Practice Plans — PM Brief

> Companion to [COACH_PRACTICE_PLANS_PLAN.md](COACH_PRACTICE_PLANS_PLAN.md) · **PLANNED 2026-07-31,
> ✅ ALL 30 DECISIONS + ALL 5 MOCKUP ROUNDS ACCEPTED 2026-07-31.**
> 🔨 **PHASE 1a ("Write it") BUILT 2026-08-01 — awaiting owner QA. UNCOMMITTED, NOT on prod.**
>
> **What a coach can do now:** open any practice on their Schedule and write the plan for it —
> tonight's goal and what to bring, then timed blocks (a number, a range like "25 to 35", or one
> "rest of practice"), each with a description, a goal, who's running it, who's in it, and what to
> watch for. A block can instead be a **rotation**: name the stations, set how long it runs and how
> often groups move, and the product works out and shows **who is at which station in every round**.
> Groups can be picked by hand or **drawn at random** (choose how many groups, or how many players
> per group, and re-draw as often as you like) — only players who've replied yes are drawn, and
> anyone left out is named rather than quietly dropped. Beside all of it sits **the roster with what
> each player is currently working on**. Last week's plan can be copied forward in one tap, and the
> whole thing prints as a **one-page sheet** — including the rotation grid — for whoever's running
> the tee station.
>
> **Also landed:** evaluation sessions now have an **editable date** and can be **linked to the
> practice they were taken at** (with a confirmation that says exactly how many readings will move
> if the date changes), the practice shows a **"Recorded here"** line back, and the Development page
> now points at the Schedule instead of saying "coming in a later phase".
>
> **Still to come (not built, by design):** the at-the-field run screen and "My station" (1b), the
> drill library (2), the plan library and "how it went" (3), and Helpers (4, gated on a privacy
> sign-off).
>
> ⚠ **Release note:** a database change must reach production **before** this code does, or saving
> any practice or game on the schedule will fail for paying customers.
> Roadmap **Phase 4 of Player Development** (Phases 3A–3D shipped 2026-07-17).
> **Mockups round 1 (ACCEPTED 2026-07-31):** https://claude.ai/code/artifact/34f5affe-162d-4b2c-8fb0-bb83e715d48e
> **Mockups round 2 (awaiting acceptance):** https://claude.ai/code/artifact/1a76bcf4-22f3-4b8f-90e9-387180742363
> **Mockups round 3 (awaiting acceptance) — drills & stations close up:** https://claude.ai/code/artifact/161e903c-0f82-45bf-868c-635789252d7e
> **Mockups round 4 (awaiting acceptance) — groups & the rotation carousel:** https://claude.ai/code/artifact/79105552-11b2-4498-b810-fddc88730cac
> **Mockups round 5 (awaiting acceptance) — my station & helper access:** https://claude.ai/code/artifact/58319358-e3dd-48a6-942b-05ed4d1701df
> Premium Coaches Portal only — no new plan, no new price, no new gate.

## The question this answers

A volunteer coach has ninety minutes on a field on Tuesday night and twelve kids each working on
something different. **What do we hand them that a Google Doc doesn't?**

We took that seriously, and the honest answer made V1 **smaller than the roadmap implied**.

## What a coach does differently

**Monday night, on the couch, four minutes.** They open Tuesday's practice — the one that already
knows the time, the field, the arrival time and who's replied that they're coming — and write four
or five timed blocks: *Warm-up 10 · Infield rotation 25 · Live BP 30 · Situational 20 · Wrap 5.*
Beside the blocks sits **the roster with what each player is currently working on**, so putting three
kids on the infield station is a glance rather than a memory test. If last Tuesday was fine, they
copy it forward and change one block.

**Tuesday, 6:25, on a field in the sun.** They hit **Run**. One block fills the screen in large
type, with the minutes remaining and a single line saying what's next. A thumb-sized button advances
it. Nothing to read, nothing to type, no sound, no buzzing. If an assistant is running a station,
they either have the same screen on their own phone or the one-page sheet the head coach printed on
the way out.

**Wednesday, later.** Nothing was recorded during practice on purpose — attendance is the one thing
a coach with twelve kids reliably records, and that already works. What the product can now say,
quietly and afterwards, is something no document ever could: *over the last four practices, these
players' focus areas have never appeared in a plan.* In roster order, as a checklist, never as a
ranking of children.

## Where we honestly don't win

For **writing**, a Notes app is fast and forgiving and some coaches will never switch. We're not
going to beat it and we shouldn't pretend otherwise — the "paste a link to your plan" field already
on every practice **stays exactly where it is**, for exactly those coaches, with no nagging.

We win decisively at the two ends: writing next to the development data, and reading at the field.
Those are the two moments a Doc is bad at, and they're what V1 buys.

## Why it matters

- **It closes the arc.** Tryouts → roster → lineups → development → **the practice where development
  actually happens** → next tryout. Until now the product knew what each kid was working on and had
  nothing to say about the ninety minutes where that work would happen.
- **It's the retention moment.** A coach who runs practice off their phone is using us on a Tuesday
  night, not just on registration day.
- **It's cheap.** One new field on the practice record; everything else reuses machinery that
  already shipped — the print engine behind the dugout poster, the empty-state pattern, the
  capability model, the attendance data, the development records.

## Where it lives — and the one thing that changed under us

Player Development reserved a "Practice plans — coming" tile in the Development hub so this phase
would fill existing room. **That tile is being retired** — a 31 July review found the hub read as an
unordered mosaic and the approved fix demotes the placeholder to one muted line.

So we chose the home on merits instead of inheriting it: **a practice plan lives on the practice**,
in Schedule. That's where the coach already is on Monday night, it's one tap from the phone's bottom
bar, it's the object that already owns the date, place, attendance and links, and it costs **zero
new navigation**. Development keeps a single pointer line — *"Practice plans live on each practice
in your Schedule →"* — instead of a room.

*(Worth knowing: the hub restructure exists as an approved mockup but hasn't been built or logged
yet, so this pointer line needs to be sequenced with it.)*

## Guardrails locked into the design

**Supportive, never ranking.** Every roster list stays in roster order with no way to sort it. No
per-player number sits beside another child's as something to compare. No "these four need the most
work" surface — the vocabulary is about coverage of the *coach's attention*, never assessment of the
*player*. **Honest data:** a plan records what was **planned**, and every surface says so — never
"worked on" or "done". **Coach-only:** no parent, player or guardian ever sees a plan; the printout
is coach-generated and hand-carried, never a link. **Sport-neutral:** no built-in drills, station
names or durations. **Mobile-first** with a field-grade contrast and touch standard.

## Decisions needed from you (10)

Full trade-offs in the plan; the load-bearing ones:

1. **Where it lives** — recommend: on the practice event, with a pointer line in Development.
2. **The existing "paste a link" field** — recommend: leave it completely alone as the escape hatch.
3. **Assistant coaches** — recommend: they can see, run and print a plan (using access they already
   have); only the head coach writes one; focus-area text stays behind the same permission it does
   today. *This one has a genuine tension worth your ruling — an assistant who can already create
   Tuesday's practice couldn't write its plan.*
4. **Anything logged at the field?** — recommend: no. Read-only.
5. **A reusable plan library?** — recommend: not V1. "Copy from last Tuesday" is what coaches
   actually do.
6. **One small database change?** — recommend: yes. The zero-change version is a text box, which is
   the Google Doc with extra steps.
7. **Recurring practices** — recommend: a plan belongs to *one* Tuesday, never the whole series.
8. **Show who's coming inside the run screen?** — recommend: yes, read-only.
9. **What replaces the retired tile** — recommend: one pointer line.
10. **Dating an evaluation session, and linking it to the practice it happened at** — *added after
    this brief was first written, at your request.* Today a coach who ran tests on Tuesday and types
    them in on Thursday has no way to say so: the session shows the day they typed it, and every
    reading lands on the wrong day of the trend line. Recommend: yes to both — make the date
    editable, and let a session point at the practice it belongs to, so picking "Tuesday's practice"
    fills the date in for you and the session is still identifiable in March. *This is the same seam
    as decision 1, pointing the other way — which is why it was held for this project instead of
    being bolted onto the Development page on its own.* **It isn't drawn in the mockups yet; it needs
    a second round before anything gets built.**

## What changed after you saw round 1

You supplied a real practice plan — the U13 White Google Doc — and it's the best spec in this project.
It showed us seven things, two of which were **defects in the first design**: durations aren't numbers
("25–35 minutes, depending on how everyone is feeling about their approach"), and the pairings carry
contingencies a document can't act on ("*will move Jocelyn to a group of three if Aslyn doesn't
show*"). It also showed that a block isn't a block — it's a block containing **stations** containing
**pairs**, with staff named at every level, some of whom aren't in our product at all.

That expanded the ambition in the right direction. This stops being a structured text box and becomes
a small system: **drills → plans → practices → history.** Four releases now, and **one reordering that
matters: the drill library comes before the plan library.** A library of hand-typed plans is a filing
cabinet; one assembled from reusable drills is a system — and the drills are what let the product
finally know a hitting practice from a fielding one without asking.

It also revised one earlier answer: **the plan library earns its own room in Development.** Round 1
correctly kept the plan *editor* off that page (a practice is a date, and Development has no
calendar), but a *library* is something you browse and read back, which is a different animal. Start
from the practice is unchanged; the library is the second door to the same content.

## Sequencing & success — FINAL (settled 2026-07-31, all 30 decisions accepted)

Two things changed once we'd drawn the real practice shape. **Stations and the rotation carousel moved
into the first release** — the reference practice you gave us is station-shaped, and a first release
without them would model a practice your own team doesn't run. And **the "is anyone getting missed"
answer moved later** — it counts practice plans, so shipping it early would ship a blank screen.

**Phase 1a — Write it.** The plan on the practice: the practice goal and kit list, blocks with
flexible durations, staff tags, stations, groups (including the random draw), rotation blocks with the
computed grid, the focus rail, copy-from-a-previous-practice, and the printed sheet. Plus dating an
evaluation session and linking it to the practice it happened at. *Usable on its own — a coach can
author a plan and print it.*
**Phase 1b — Run it.** The field screen, the rotation rounds, and "my station" for whoever is running
one. *This is the differentiator; it ships before anything else starts.*
**Phase 2 — The drill library.** Stop retyping the warm-up; categories arrive and the focus rail
starts filtering to the kind of practice you're running.
**Phase 3 — The plan library and looking back.** Templates grouped by type, usage history, "how it
went", and the coverage answer folded into the report that already exists.
**Phase 4 — Helpers.** Gated on a privacy sign-off and a reconcile against the verified-family work.

*Phase 1 is the largest single chunk this portal has attempted — deliberately, because the alternative
is a first release that doesn't fit a real practice. The two slices, the mockup gate and owner QA
between them are not optional.*

## Original sequencing note (superseded by the ladder above)

**V1 — "Tuesday, on the phone"**: the plan on the practice — blocks, staff tags, the practice goal
and kit list, the focus rail, copy-from-a-previous-practice, the field screen, the printed sheet.
Decision 10 rides here too. *Coach gains: a plan written in four minutes, readable in the sun.*
**V2 — the drill library**: stop retyping the warm-up; categories arrive and the focus rail starts
filtering to the kind of practice you're running. *Coach gains: a plan in four taps.*
**V3 — the plan library**: named templates grouped by type, with usage history and the after-practice
recap. *Coach gains: "my standard Tuesday", once — and an honest record of how it went the last eight
times.*
**V4 — stations, pairs and regrouping**: the contingency you hand-wrote in the Doc becomes the
product — absent players flagged, regroup in a tap, before practice starts.

*The full anatomy is built into V1 even where the screen doesn't show it yet — that's what keeps V4
an addition instead of a rebuild.*

**Success looks like:** a coach opens the run screen on a field without being told how; assistants
stop asking "what's next?"; a plan gets copied forward more often than it gets written from scratch;
and at least one coach tells us the focus rail changed who they put at a station. **Not** a target
for how many coaches abandon their Google Doc — some won't, and that's a fine outcome.
