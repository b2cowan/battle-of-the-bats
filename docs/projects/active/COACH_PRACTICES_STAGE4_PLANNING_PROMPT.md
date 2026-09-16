# Kickoff — Practices re-evaluation, stage 4 · The library (plan + mockups only; nothing built)

*(paste everything below the line into a fresh chat)*

---

You are picking up the **Practices holistic re-evaluation** at **stage 4 · The library**. Your
deliverable is a **proposal tab on the existing hub artifact** — the analysis, true-size drawings
of before and after in the portal's own materials, and D-numbered decisions with a paste-back
summary for the owner to rule on — plus the matching **plan section (§7 filled in)**. **You are
not building anything in this chat.** No product code changes. The stage is built in a later
session, after the owner rules, from a build prompt you will write at the end of this one.

**Step zero — check one thing before you draw a single frame.** Stage 3 drew a revision after its
build, the **groups board** (plan §6.9 · the hub's stage-3 tab, section "Revision on the build ·
the groups board", decisions **D9–D12**). It was drawn 2026-09-15 and, as of this prompt, **not
ruled**. D10 there asks whether a player chip can be *dragged* between groups; this stage's S.4
asks whether a drill can be dragged onto the page and a block moved by a handle. **Those are one
question at two scales and must share one reason.** Read plan §6.9 and the ledger's §192 tail to
see whether the owner has ruled D9–D12 since. If not, your first message to the owner asks for
that ruling (the stage-3 tab's paste-back collects it) — then draw drag on the library in the
light of it. Do not draw two drag kits, and do not draw drag for drills while people-drag is
undecided. "Reorder with buttons, never drag" stays the rule until it is revised in words.

## 1. Read first, in this order

1. **Memory** (auto-loaded): `project_coach_practices_reevaluation` (the top block is the current
   state), `project_coach_practice_plans` (Phase 2's drill library — D16–D21 — and Phase 3's
   templates and *Start this plan from…*), `feedback_mockups_as_claude_artifacts`,
   `feedback_clickable_design_annotations`, `feedback_build_to_approved_mockups`,
   `feedback_project_hub_single_artifact`, `reference_shared_worktree_stage_race`.
2. **The plan — `docs/projects/active/COACH_PRACTICES_REEVALUATION_PLAN.md`:** §1 (the ladder),
   **§7 in full — the nine inputs carried into this stage; every one needs an answer from the
   code before you draw**, §6.9 (the groups board), §6.10 (the §192 walk's finding), §3.1 D5
   (stage 0 moved the two libraries WHOLE and said "stage 4 redraws the rows"), §4.1 items 2 · 4
   · 5 (*Add a block adds a block*; *Save as template…* asks one question; the description a
   template carries), §5.0 (the block — its doors, D7 "a drill is always a station, never a
   block", D9 Escape on every sheet, D10 points as one field, D11 kit at one level), §6.0–6.3
   (stations; D1 the sole station IS the block; D4 the station modal — the shape a drill now has
   on the plan; D7 points as one field in the drill library).
3. **The artifact — https://claude.ai/artifact/CPdBMaADr4onweuQz8Vp71** (the old
   `/code/artifact/5c3d2f1b…` link opens the same page). Source
   `docs/projects/active/COACH_PRACTICES_REEVALUATION.html` — **republish the SAME path passing
   that `url`**; read it with the Artifact tool first (the tool refuses a publish otherwise) and
   build from the SOURCE FILE, never from a truncated read. Read, on **"The walk"**: **station 6
   (Reuse — drills, templates, and starting from something)** end to end — its "as built", its
   assessment, Q 6.1 and Q 6.2 — then **Standing back S.4** (drag, and the rule against it) and
   the **"Across the walk"** section (the keep-list names *Save to my drills…* as an explicit act
   and *Start this plan from…* as one picker with a provenance line to shorten). Then read the
   **"3 · Stations and the rotation"** tab end to end — it is the template for yours (frames,
   markers, the D-cards, the groups-board section's honest A/B drawing) — and **"QA walk · 3"**'s
   head note (the F2 finding).
4. **The ledger — `docs/projects/active/OWNER_QA_LEDGER.md`:** §186 (stage 0's build — D5, the
   tabs), §188 (stage 1 — the plan page as a document, *Save as template…*), §190 (stage 2),
   §192 (stage 3, and its tail: the walk's finding and what is still open).
5. **The help** — `lib/help-content/coaches.tsx`, sections `premium-drill-library` (headed
   "Drills: write it once, then it's four taps") and `premium-plan-templates`: what the product
   promises a coach today. The walk called the "four taps" promise the problem.

## 2. What stages 0–3 settled that this stage inherits (binding — argue with one only from what the code does, and say so before drawing)

- **Practice plans is the hub**: Practices · Templates · Drills as tabs, Practices the landing, no
  overview, no tile row; the nav label stays "Practice plans". The two libraries moved under it
  **whole** at stage 0 — same rows, same actions — precisely so that this stage could redraw them
  with the rulings in hand. The old addresses redirect.
- **Sorted by NAME, never by use.** "Most used first" is a ranking, and the library must not
  quietly tell a coach which of their own ideas is best. **"In 8 plans" / "Started 8 plans" is the
  one count allowed** — a fact about a drill or a template, never "used 8×" (nothing records what
  was actually run). Zero reads in words ("Not in a plan yet"), never as a score.
- **Nothing is seeded and no tag is supplied** — every drill, template and tag is coach-typed;
  a "Hitting / Fielding / Pitching" list would be one sport talking to a platform serving many.
  That binds placeholders and empty states too.
- **A drill is an identity claim (D20).** A drill placed on the plan is read-only there; *Edit
  just for this practice* keeps every word and drops the link; *Save to my drills…* is explicit,
  never automatic, and asks exactly one optional question (tags). Preview-before-add earns its
  place because the drill arrives read-only. Do not soften any of this.
- **A drill is always a STATION, never a block (stage 2, D7)** — and with one station the station
  IS the block (stage 3, D1), so a drill-placed block reads the drill's words where its own would
  be. **A station opens as a modal (D4)**: Doing · Watching for · Coaching points (one field) ·
  Setup · Equipment · Who runs it · Just for tonight · *Save to my drills…*. That is the shape a
  drill has on the plan today; the library's editor has not caught up (§7 input 6).
- **Coaching points are one field, one per line**, on the block, the station and in the drill
  editor (D7 finished it there). Stored as a capped list — nothing migrates.
- **Templates strip people**; a template carries the description, the tags and the focus-areas
  section; *Save as template…* asks ONE question (the name — the practice's tags travel unasked);
  the Templates room edits a template's tags; the template editor is the same sheet as the plan.
- **Live-season only, no archive door.** The library is an instrument; *Bring one forward from a
  past season* is the import for both drills and templates. A closed season is one page and it
  does not show a library.
- **The plan page is a document (stage 1)**: an 816px sheet inside a 1200px column, a time gutter,
  blocks as rows that open in place (stage 2), one open at a time; the doors at a block's foot;
  "+ Stations" opens the drill sheet directly. Escape closes every sheet on the shared dialog
  floor and hands focus back; Escape never closes an open block.
- **Reorder with buttons, never drag** — until S.4 revises it in words. Station arrows sit on the
  column's foot, block arrows in the gutter (§6.8).
- **The portal's rules**: one lime per screen; touch floors at ≤768 (the tablet band); the quiet
  empty-state rule (one line, absent when it cannot say anything); the shut-row rule (no counts
  on a row — §133); one word one spelling; "8:00 a.m."; player names are baseline; sport-neutral.
- **Defects logged for later stages are not fixed on the way past** — and this stage inherits the
  ones logged FOR it (§7). Stage 5 (paper and the field) and stage 6 (afterwards) keep theirs.

## 3. What this stage covers — the scope, argued from the CODE

The coach's job (walk station 6): *week three — Tuesday should start from last Tuesday, and the
ladder drill written once should be there next time.* Where is the library, and how does a thing
get from it onto the page?

- **The Drills tab** — `app/[orgSlug]/coaches/teams/[teamId]/practice/_DrillsView.tsx` (a VIEW
  the hub mounts; its own header action "New drill ▾" — *Start from blank* · *Bring one forward
  from a past season*; search; tag chips with "All · No tags"; a row = name · "In N plans" ·
  Edit · Retire; the drill dialog — nine fields). Read its header comment: it carries the rulings.
- **The Templates tab** — `_PlanTemplatesView.tsx` (the same shape; "New template"; a row = name ·
  "N blocks" · "Started N plans" · Rename · Retire; the template editor at
  `practice/templates/[templateId]/page.tsx` is the plan sheet without a clock).
- **The hub** — `practice/page.tsx` + `_PracticePlansTabs.tsx` (`?section=`,
  `lib/practice-plans-address.ts`): the room the tabs live in; the past list capped at six.
- **Onto the page** — in `_PracticePlanEditor.tsx`: `DrillPickerSheet` ("From your drills · Write
  one"; Preview → "Add to the practice"; an empty library opens straight on Write one) — reached
  from "+ Add the first block"'s quiet line, a block's "+ Stations", a column's "+ Add a station"
  and "Swap drill"; `PromoteDrillDialog` (*Save to my drills…*, one question) and the gate that
  offers it (`StationFields` — a written station only; **§7 input 1**); `DrillFacts` (the
  read-only face). In `practice/[eventId]/page.tsx`: *Start this plan from…* (one picker, three
  sources — a template · a previous practice · a past season; offered on the blank page only),
  its provenance line, and *Save as template…*.
- **The library's own rules** — `lib/rep-drills.ts` (`stationToDrillInput`, `sortDrillsForPicker`,
  `filterTagged`, `detachStationFromDrill`, the D16–D21 header), `lib/rep-plan-templates.ts`,
  `lib/rep-drill-usage.ts` (the count), the routes under
  `app/api/coaches/[orgSlug]/teams/[teamId]/development/drills` and `…/plan-templates` (each with
  a `past-seasons` import route — read the header comment on `drills/past-seasons/route.ts`: it
  says why a past plan's stations are NOT offered as drills).
- **Drag's precedent** — `app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx`
  (`@dnd-kit`: a sortable list with a keyboard sensor, drag disabled on touch and replaced by
  arrows — read the comment near line 94 on why). If S.4 goes yes, this is the kit; the groups
  board's D10 already names it.
- **Readers that must not change because the library did**: the closed-season reader, the printed
  sheet, the run screen — a plan stores drill ids and snapshotted tag names precisely so that the
  library can change under it.
- **The help** (`premium-drill-library`, `premium-plan-templates`, the drills FAQs) and the demo
  tour — check whether the coach demo's tour stops on either tab (the build fails if a tour
  destination disappears).

Walk it in the browser as the UAT head coach (`tests/uat/.auth/coach.json` is a Playwright storage
state; `UAT_ORG_SLUG` / `UAT_COACH_EMAIL` / `UAT_COACH_PASSWORD` in `.env.local`; the team is
"UAT Test Team · 2026 Season"; the probe practice re-anchors to today; the Tue Oct 27 practice
is the blank one; the library holds **Probe drill** and **Probe plan template · 60 min · 3
blocks** plus the fixture's "New template N" rows) at 1440, 768 and 390 — earlier stages took
screenshots with a small Playwright script run from inside the repo (`scripts/.tmp-*.mjs`,
deleted afterwards) and **measured every drawn frame at true size** (`[data-measure]` + a live
`[data-hpx]` tag — the estimate said 480 and the drawing said 598 once, and that number produced
a ruling). **The dev server is shared with other sessions: do not restart it, never run a full
`check:layout` sweep, and if you run the scoped one use `--only=<screen>` (the equals is
required).** Read-only browsing is fine. Re-read every identity from the screen before you draw
it; the fixture changes under other sessions' hands.

## 4. What the walk already said (your starting point, not your conclusion)

**Station 6 — what works:** one picker, three sources, every hint says the same true thing;
the drill identity rule is right and the product holds it; templates strip people; *Bring one
forward* is a real answer for the second-year coach; preview-before-add pairs with read-only.
**What gets in the way:** the library was in another room (fixed at stage 0); **you cannot
browse it** — a drill row is a name and a count, no minutes, no tags, no first line ("a library of
forty drills would be forty names"); **empty templates are offered as starts** ("New template" at
zero makes a row, listed everywhere including *Start this plan from…* at "0 blocks"); **adding is
a sheet, a search, a row, a button** — no drag, no library beside the page, and the help promises
"four taps"; **the drill editor is the station form again** on its own page. **What the walk
would change:** rows showing minutes · tags · the first line; on desktop the library docked beside
the plan — drag a drill onto the timeline (a new block) or onto a station column (fills it), with
"Add" on every row doing the same for keyboard and phone; a template with no blocks not offered
as a start; the drill editor as the station card, alone. **Q 6.1** (dock + drag — the standing
rule's reason is the field and the phone, and it holds there; a plan is written at a desk) and
**S.4** (drag as an addition on desktop, buttons kept everywhere — "your ask; my recommendation
is yes, as an addition") are the owner's to rule. **Q 6.2** (one library under Practice plans) was
ruled at stage 0.

**§7's inputs go further than the walk did.** Answer each from the code and the screens:

- **Input 1 — the bare written block.** A block with no stations — title, Doing, Watching for,
  points, equipment — is a drill in everything but name, and has no *Save to my drills…*; the door
  is on a written station only (D18, older than D1). Recommend whether the door comes to the block
  (the walk's owner said the two shapes are indistinguishable on screen). What does the promote
  read from a block — everything but Setup? Does the block's title become the drill's name as a
  sole station's would?
- **Input 2 — drag, once.** If D9–D12 are ruled, what did the owner say about people between
  groups, and what follows for drills onto the page and blocks by a handle? If yes: which targets
  (the timeline's gap between rows → a new block; a station column → fills it; a block's "+
  Stations"?), what the keyboard and the phone do instead (the buttons stay), and where the
  rule's wording lands ("buttons everywhere; drag as an addition on desktop"). If no: say what the
  docked panel is still worth without it.
- **Input 3 — the row.** What does a drill row show for a drill with no minutes and no tags (most
  of a new coach's library)? Is "the first line" *What you're doing*? Does a template row show its
  blocks' titles? Keep: sorted by name, the one count in words.
- **Input 4 — empty templates.** Should a template only ever be made FROM a plan (*Save as
  template…*), with no blank "New template" at all — or is an empty template kept and simply not
  offered as a start? Argue from what the template editor is (the plan sheet): a blank one is a
  blank page, which stage 1 already made a good place to start.
- **Input 5 — the docked panel.** The sheet is 816px in a 1200px column at 1440: say what fits
  beside it honestly (the sheet does not shrink — stage 1 ruled its width) and what happens at
  768 (the tablet band) and 390 (the sheet stays the path). Is the panel the library's whole row,
  or a shorter face of it? Does it dock by default or on demand? Is it the same component the
  tabs show?
- **Input 6 — the drill editor.** The station modal (D4) is nine fields on one sheet with the
  block's vocabulary; the drill dialog is the older form. One component, or two faces of one
  field list? What does a drill's "usual minutes" become on the plan (the block's clock row)?
- **Input 7 — the provenance line.** Two sentences → one, without losing the promise ("changes
  here won't change the template").
- **Input 8 — the help.** Whatever the shape, name the articles that change (/docs runs at build
  time, not now).
- **Input 9 — Practice review.** Insights → Development → Practice review is the only whole-season
  list of practices by tag (the hub's past list is capped at six). The Development re-evaluation's
  stage-4 session recommended leaving it under Insights and named the question as this project's:
  a fourth tab on Practice plans, a door from the hub, or nothing? Answer from what the hub already
  shows — do not draw a second list of practices without saying what the first one lacks.

And the questions the inputs do not ask but the screens will: what is the library's empty state
for a brand-new coach (nothing seeded; the walk's rule — quiet, one line, absent when it cannot
say anything)? Does "Write one" survive a docked library? Does the Drills tab keep a page header
and a lime "New drill" when it is also a panel? Where does *Bring one forward from a past season*
live in the new row shape? Should *Start this plan from…* be reachable from a template's row
("Start tonight from this") as well as from the blank page? Does a template's row need its
length ("60 min · 3 blocks") when the sheet's gutter already says it?

## 5. The tab you will add — follow the stage-3 tab's conventions exactly

- Add a tab button **after "QA walk · 3"**: `<button type="button" class="tab" role="tab"
  data-tab="stage4" aria-selected="false" aria-controls="tab-stage4">4 · The library<span
  class="st">drawn — rule it</span><span class="st dim">station 6</span></button>`; add
  `stage4:'tab-stage4'` to the `panels` map in the page script; add `<div class="prop"
  id="tab-stage4" role="tabpanel" hidden>` **after `#tab-qa3`**. Do not add a "QA walk · 4" tab —
  the walk is written after the owner rules and the stage is built.
- Structure, in order (copy the stage-3 tab): header (eyebrow "Stage 4 · The library" + a
  `.status` chip reading "drawn <date> · not ruled · no code", an h1 that is a claim, a lede);
  **What the walk saw, and what the code says**; **What a coach sees and does differently**; the
  frames — **Before** (as built, amber markers) and **After** (the proposal, green `ok` markers)
  for each: the Drills tab, the Templates tab, the docked panel beside the plan at 1440 (and the
  honest alternative if the owner may prefer it — the groups board drew A and B; do the same
  where a call is close), a drag in flight if S.4 is drawn, the drill editor, the phone at 390,
  the 768 band where the panel changes shape; **Where else it touches** (the hub's header
  actions, *Start this plan from…*, the help, the demo tour, the closed-season reader — stated,
  not restyled); **The decisions** — each an `.ask` with `data-q="D1"`… and `data-kind="build"`
  (the tab's own numbering starts at D1; the summary builder is per tab), each with a
  recommendation, **what rides on it** in a `.rides` div, and a measured number where one exists;
  **Not this stage** (stage 5 · 6 items); the paste-back — `#buildSummaryStage4` /
  `#summaryOutStage4`, iterating `#tab-stage4 .ask[data-q]` (copy the stage-3 listener).
- **Input 1 and input 2 are decisions on this tab** (the bare block's door; drag — written so it
  reads with D10's ruling, whichever way it went). Six to nine decisions at most.
- Frames are drawn in the portal's own materials with the existing `.pf` classes (the sheet,
  the open block, the doors line, the station columns, the modal, the tab bar, the list toolbar
  and table). Add new `.pf .x` classes only for what no earlier frame has — the docked panel, a
  library row with its three facts, a drag ghost. Frames sit in `<div class="framewrap"><div
  class="frame">…</div></div>` so the fit/true-size switch applies; `[data-measure]` on every
  after-frame and a live `[data-hpx]` height tag; markers are `<… class="an">…<button
  class="mk [ok] [r]">n</button><div class="pop" hidden><b>title</b>text</div></…>` INSIDE the
  element they explain — never positioned by coordinates; `.mk.r` inside a field so the marker
  never covers its label. Continue the note numbering from where the stage-3 tab left off (its last marker is 53 as of
  this prompt — grep `aria-label="Note` and check; the groups-board section may have grown). **Pin identities, never invent figures**: Probe drill, Probe plan template
  (60 min · 3 blocks), the fixture's tags and staff — re-read from the screen.
- **Build-to-mockup discipline**: the drawing's TONES matter per theme (stage 2 shipped paper on
  paper once) — draw fields white on the block's cream, chips as white pills, the pressed chip
  ink-filled, exactly as the stage-2 and stage-3 frames do.
- Then **fill plan §7** (keep the inputs table; add the analysis, the decisions table with your
  recommendations and what rides on each, the frames' measured heights, the verification list for
  the build session), append a **stage-4 paragraph to the PM brief** (what a coach sees and does
  differently; why; measured), and update the plan's header line, the ladder's row 4 and the
  hub's Plan-tab ladder row to "drawn — rule it".

## 6. Concurrency — read this before you write to any shared file

This working tree is shared with other live sessions (the Development re-evaluation's stage-4
proposal is being drawn in one; the groups-board revision has a session that may still be
editing the hub's stage-3 section and plan §6.9). **Stage 3's product code is still uncommitted
on dev** — the editor, the drills view, the plan module, `RoomShell.tsx`, the new
`PracticeFields.tsx`, `coaches.module.css`, the layout probe and its baseline — and its commit is
owed on the owner's word from a **private index** (the recipe is in
`reference_shared_worktree_stage_race.md`; `TODO.md`, `lib/help-content/coaches.tsx`,
`scripts/layout-screens.mjs`, the dictionary and `lib/types.ts` carry a peer's hunks). You touch
none of that. Before splicing into the hub HTML or the plan: `git status --short` on the file,
`ListAgents`, and `SendMessage` any peer that is editing the same file to say where you are
adding (after `#tab-qa3`; after plan §7's table) — then splice so their lines are untouched.
Draft your panel in the scratchpad first. Never `git add -A`; stage explicit pathspecs; never
commit without the owner's say-so. Republish with the Artifact tool passing the `url`.

## 7. Hand-off

When the tab is published: reply to the owner in product-owner voice — what a coach sees and
does differently, why, the trade-offs, which decisions are close calls, and what to click — and
link the tab. Record the state at the top of `project_coach_practices_reevaluation` ("STAGE 4 ·
THE LIBRARY — DRAWN <date>, D1–Dn, not ruled, no code" with the one-line summary of each
decision and its recommendation) and in `MEMORY.md`'s index line. Do **not** mark anything in
the ledger or TODO as built — those move with the build. Write the build prompt
(`COACH_PRACTICES_STAGE4_BUILD_PROMPT.md`, on the stage-3 prompt's shape) only after the owner
rules; delete this planning prompt with the stage's build commit, as the earlier stages did.
