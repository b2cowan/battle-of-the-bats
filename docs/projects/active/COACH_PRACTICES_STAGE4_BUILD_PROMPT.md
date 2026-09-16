# Kickoff prompt — Practices re-evaluation: Stage 4 (The library)

*(paste into a fresh chat)*

**Pick up the Practices re-evaluation at stage 4 — "The library" — and only that.** The stage is
**ruled (2026-09-16, owner in chat: "so this mockup looks great, I approve everything as designed
thus far" — L1–L8 "Build as drawn"; L9 · Circuits added on the ruling and ruled in words the same
day)** and drawn at true size on the hub. Your job is (a) build it exactly as ruled, (b) walk it,
(c) commit on the owner's word. Where this prompt and the drawn frames disagree, the frames win;
where the plan's §7.0 rulings and the frames disagree, the rulings win. **The decisions are L1–L9
on the hub (the letter keeps their state from colliding with earlier tabs' D1…); the plan calls
them the same; the paste-back prints them as D1–D9 — one set, three spellings, no ninth mystery.**

**Already ruled by the owner, do not re-litigate:** the practice room is the hub for practices,
templates, drills — and now circuits — as tabs (stage 0, D5, revised by L9); the plan page is a
document, blocks as rows that open in place (stage 1); the block's anatomy and doors (stage 2);
stations as columns, the station modal with its stepper, one field for points, people move like
kit (stage 3); **D13 — "+ Stations" on a written block makes TWO stations, the block's words
moving into station 1** and **D14 — the rotation grid is a hand-arrangeable starting point** (both
ruled 2026-09-16 and built in another session — check they are on dev before you start); the
groups room (D9–D12, built); a drill is an identity claim (D20 — read-only on the plan, detaches
on edit, promotion copies — do not soften it); a template is scaffolding (fully editable, provenance
kept); nothing seeded, no tag supplied; live-season only, no archive door; "planned", never
"done"; one lime per screen; the tablet band's touch floor at 768; the quiet empty-state rule; one
word one spelling; "8:00 a.m.".

---

## 1. Read first, in this order

1. **The plan — the spec:** `docs/projects/active/COACH_PRACTICES_REEVALUATION_PLAN.md` — **§7 in
   full**: §7.0 the rulings, §7.1 step zero (why drag was drawn only after D10), §7.2 what the code
   says (the nine inputs answered — read the measured facts: the sheet is 960 in a 1,156 column;
   every library row is 267px on a phone; the promote and the import both miss the bare block),
   §7.3 the decisions with what rides on each, §7.4 the frames' measured heights, §7.5 where else
   it touches, §7.6 verification, **§7.7 Circuits — the build design for L9, including the stage's
   one migration**. Then §6.11 (D13 · D14 — the shape rules your drop targets follow) and §6.9 (the
   groups room — its drag kit is the one you reuse).
2. **The artifact — https://claude.ai/artifact/CPdBMaADr4onweuQz8Vp71**, tab **"4 · The library"**:
   every frame, every marker (54–79, 86–90), the nine asks. Build to the AFTER frames; the tones
   matter (fields white on the block's cream, chips as white pills, the pressed chip ink-filled,
   the table on the list recipe). The before frames are the record of what you are replacing.
   Read it with the Artifact tool first (the tool refuses a later publish otherwise) and build the
   QA tab from the SOURCE FILE `docs/projects/active/COACH_PRACTICES_REEVALUATION.html`,
   republishing the SAME path with that `url`.
3. **Memory** (auto-loaded): `project_coach_practices_reevaluation` (the top block is this stage's
   record), `project_coach_practice_plans` (Phase 2's drill library D16–D21; Phase 3's templates —
   ⚠ "template = scaffolding vs drill = identity — do NOT unify"; a circuit is a template one
   size down), `reference_shared_worktree_stage_race` (the private-index commit recipe),
   `feedback_build_to_approved_mockups`.
4. **The code you are changing:** `app/[orgSlug]/coaches/teams/[teamId]/practice/_DrillsView.tsx`
   and `_PlanTemplatesView.tsx` (the rows, the sheet, Retire), `_PracticePlansTabs.tsx` (the fourth
   tab; revise its "no fourth tab" comment), `page.tsx` (the hub — the fourth section, the past
   list's cap), `_PracticePlanEditor.tsx` (`DrillPickerSheet`, `PromoteDrillDialog`, `StationFields`'s
   promote gate, `BlockCard`'s doors line, `addBlockFromDrill`/`addStationFromDrill`, the sheets),
   `practice/[eventId]/page.tsx` (the column, the toolbar, `renderPickList`, the provenance line),
   `practice/templates/[templateId]/page.tsx` (the model for the circuit editor page),
   `components/coaches/PracticeFields.tsx` (grows to the five teaching fields), `lib/rep-drills.ts`
   (`stationToDrillInput` — add the block reader beside it), `lib/rep-plan-templates.ts` (the
   model for `lib/rep-circuits.ts`), `lib/rep-drill-usage.ts` (`collectImportableDrills` — walk
   blocks too), `lib/rep-practice-plan.ts` (two optional keys on a block: `circuitId`,
   `circuitName` — whitelisted, no version bump), the routes under
   `app/api/coaches/[orgSlug]/teams/[teamId]/development/drills` and `…/plan-templates` (the model
   for `…/circuits`), `lib/coach-tournament-games.ts` (`splitUpcomingAndRecent`'s cap),
   `app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx` (the drag kit: `@dnd-kit`,
   PointerSensor distance 6, KeyboardSensor, a grip, arrows kept) and the groups room's use of it,
   `app/[orgSlug]/coaches/coaches.module.css` (`.ppDrillRowMain { flex: 1 1 12rem }` — the 267px
   phone row; the ≤640 rule), `lib/help-content/coaches.tsx` (`premium-drill-library`,
   `premium-plan-templates`).

## 2. Step zero

- **Stage 3 and the groups room are UNCOMMITTED on dev as of this prompt** (the §192 walk is
  complete; the groups room's part J and D13/D14 are being built in the ab session). Confirm with
  `git log --oneline -6` and `git status --short` what is committed before you build on it. If
  stage 3 / the groups room / D13–D14 are still uncommitted, **do not build stage 4 on top of an
  uncommitted base without saying so** — ask the owner whether to commit those first (private
  index; peers' hunks in TODO/help/layout-screens/dictionary/types) or to proceed and commit
  together. A clean checkout of `dev` must typecheck before and after you.
- **D13 must be on dev before L2's drop targets are built** — the drop onto a written block's
  stations follows D13's rule (words → station 1, the drill → station 2). If it is not, build L1,
  L3–L9 first and L2's block target last.
- Re-read plan §7 and the tab right before building: the owner may have ruled more since.

## 3. The nine, as ruled (one line each — §7.0 / §7.3 / §7.7 and the tab are the full text)

- **L1** *Save to my drills…* at the foot of a written block with no stations (beside its doors;
  never on a drill-placed block); one optional question; the drill takes title · words · points ·
  kit · **the block's minutes as "usually"**; a copy. The past-season import offers bare blocks too.
- **L2** Drag as an addition on desktop, with a MOUSE: a drill row from the docked panel into a
  gap (a new block at that index, titled by the drill, its usual minutes or 15, shut) or onto the
  open block's stations (following D13 — a written block's words become station 1 and the drill
  station 2; a wordless block takes it as its sole station; a circuit gains a column); **never a
  filled column, never a shut block**; a block by its gutter (the pair of arrows stays); on touch
  nothing lifts. Buttons everywhere. The rule reworded once for the groups room, the grid and the
  library: *"buttons everywhere; drag as an addition on desktop, with a mouse — never the only way."*
- **L3** Both tabs as tables on the list recipe — Drill (name · tags · the first line of *what
  you're doing*, clamped, absent when unwritten) · Usually · Plans (in words) · ›; Template (name ·
  tags · the blocks' titles) · Length · Started · ›; sorted by name, club first; the row is the
  door; Edit/Retire leave the row (Retire in the sheet's foot; the template editor gains a header
  "Retire this template"); "Show retired" under the table. **The 267px phone row is fixed**
  (`flex-basis: auto` where the card stacks); one card serves the tab at 390, the picker's rows
  and the panel.
- **L4** "Start from blank" stays; an empty template is NOT offered in *Start this plan from…* and
  reads "Nothing in it yet" on its row.
- **L5** The docked pair (A): docked, the sheet is 816 and the panel 320 (= the 1,156 working
  column at 1440); on demand — the ghost row's "a drill from your library" docks it on a wide
  desktop and opens the sheet elsewhere; a quiet *Library* toggle in the toolbar once blocks
  exist; remembered per browser; **absent, not disabled, below a 1,156 working column**; the panel
  = the card list (search · chips · grip · Add · a row opens in place as the Preview · "+ New
  drill"); with L9 its head switches **Drills · Circuits**; no templates in it. The picker sheet
  stays whole ("+ Stations", "Swap drill", every narrow width).
- **L6** The drill sheet = the station modal's shape: the name in the head, Tags · Usually first,
  the five teaching fields from the shared field module (grown from two to five; the station modal
  reads the same module), *Retire this drill* in the foot (Restore on a retired one), Cancel · Save.
- **L7** "Started from **X** — edit anything here; the template won't change."
- **L8** No fourth tab for Practice review; "Every practice this season ›" under Recent practices
  uncaps the hub's list in place (words, never a count; absent at six or fewer).
- **L9 · Circuits** (§7.7): the block's foot door reads by shape — *Save to my circuits…* on a
  block with stations; two optional questions (tags · "also save its N written stations as
  drills" — ticked, the drills are created first and the saved circuit's stations point at them;
  tonight's block untouched); a fourth tab **Practices · Templates · Circuits · Drills** on the
  same table (Circuit · Usually · "Started N plans" · ›; the stations' names as the line); the
  panel's Drills · Circuits switch; a circuit drags into a **gap only** and lands as a whole,
  editable block with `circuitId`/`circuitName` provenance and empty groups; "Add a block" gains a
  *From your circuits* tab; an editor page (the block alone on a sheet, no clock, no people,
  Retire in the header); "New circuit ▾" = Start from blank · Bring one forward from a past
  season. **The stage's one migration** — `rep_team_circuits` shaped like the templates table;
  dictionary + snapshots in the same unit of work.

## 4. Rules that bite (from the code, not from plans)

- **The sheet is not 816px.** The plan page's column is `.page`'s 960 since 2026-09-15 (alignment
  with the header). Docked, the pair must fill the same column the header does (816 + 20 + 320 =
  1,156 at 1440) — do not restore a centred 816 sheet with gaps beside it; that was the owner's
  catch. Measure the pair against the header's edges and report the numbers.
- **The 267px row is a flex basis, not a height.** `.ppDrillRowMain { flex: 1 1 12rem }` reads as
  a height once `.ppDrillCard` goes `flex-direction: column` at ≤640. Fix it in the card's phone
  rule; measure the row at 390 afterwards (the picker's rows share the class).
- **Two gates read the old meaning of "written".** `StationFields`'s promote gate (D18) and
  `collectImportableDrills` (stations only) both predate D1/D13. Add the block reader beside
  `stationToDrillInput` (title → name, `duration.minutes` → `usualMinutes`, kit resolved to names
  as the station's promote does) and walk blocks in the collector — dedup by name against the
  stations, never merging two texts.
- **Promotion copies; the tick creates, then points.** L9's "also save its written stations as
  drills" must create the drills through the existing create route BEFORE the circuit row is
  stored, rewrite the saved shape's station `drillId`s, and leave tonight's block exactly as it
  was — nothing on the page becomes read-only. A same-name active drill is not duplicated; the
  tick's label names how many it would add.
- **A circuit is scaffolding, one level down from a template.** `blockToCircuitShape` runs the
  plan sanitiser on a one-block plan and strips the same fields `stationForTemplate`/`blockForTemplate`
  strip (staff, staffTagIds, playerIds, note, rotationNote, groups — and any D14 arrangement);
  `drillId`/`drillTags`/equipment SURVIVE. `circuitToBlock` mints fresh ids, empties groups, and
  stamps `circuitId` + `circuitName` (the name snapshotted, as `templateName` is). Do not build a
  circuit as a read-only drill-like thing.
- **Drop targets are exact.** Gaps between rows and under the last row → a new block at that
  index; the OPEN block's stations area → a station by D13's rule; a circuit → gaps only. A filled
  column is never a target (no silent swap); a shut block is never a target. A drop anywhere else
  snaps back and changes nothing. Only the drop mutates the plan — never hover.
- **One drag context, one kit.** The lineup builder's `@dnd-kit` set-up (PointerSensor distance
  6, KeyboardSensor) and the groups room's mouse/touch sensors are the precedent; restrict the
  library's and gutter's drag to a mouse sensor — touch keeps the sheet and the arrows. The gutter
  cell is the block's handle; its ▲ ▼ pair stays exactly where §6.8 put it and keeps working.
- **The docked state is a width decision, made once.** Derive "can dock" from the working column
  (≥ 1,156px), not the viewport; below it the toggle is absent and the ghost link opens the sheet.
  Remember the choice in localStorage; render correctly with none.
- **The library keeps its rules:** sorted by name, never by use; club drills first; the one count
  in words ("In 8 plans" · "Started 8 plans" · "Not in a plan yet"); nothing seeded, no tag
  supplied; the same search-and-filter predicate for every list; retired never deleted.
- **Readers do not change.** The closed-season reader, the printed sheet and the run screen read
  a plan's stored words; a block placed from a circuit is a block. Do not touch them.
- **The help changes with the shape** (§7.5): "four taps" leaves the article heading, the Drills
  empty state and the picker's hint (keep it as a keyword); the templates article gains the size
  ladder and "an empty template isn't offered as a start"; a circuits sub-topic. `/docs` at build
  time, not by hand.

## 5. Process gates (blocking, in order)

1. **PM UX summary in chat before code** — what a coach sees and does differently per decision,
   in the owner's voice (no file paths). Say explicitly that L9 is the one migration and that L2's
   block target follows D13.
2. **Step zero confirmed** (§2) — including whether D13 is on dev.
3. **Build to the frames.** Measure the built table rows, the docked pair against the header's
   edges, the drill sheet and the phone card, and report the real numbers against §7.4.
4. **`/simplify`** (candidates: one row component with two faces for tab/picker/panel; one
   block-or-station → drill reader; the templates' shape/strip/load trio reused for circuits — do
   not write a second copy), then **`/review`** (high-risk: the drop handlers mutating the plan
   under autosave, the tick's create-then-point ordering, the circuit strip missing a people
   field, the dock width decision; at least 3 lenses), then **`/docs`**.
5. **Gates:** `npm run verify:changed` · `npm run typecheck` · the unit suite (the block→drill
   reader; the collector walking blocks; the picker's template filter; the circuit shape/load pair;
   the count; the tick's plan) · `npm run check:layout --only=coach-practice-plan,coach-practice-station,<the Drills/Templates/Circuits tab screens>`
   at 361/390/768/1440 **with a docked-state interaction step at 1440** · `check:spelling` on the
   new copy · `check:dictionary` + `refresh:snapshots` for the migration · `check:demos`. Report
   anything skipped and why.
6. **A Playwright probe on the fixture** (read-only where possible; restore both plans afterwards):
   drag a panel row into a gap (the block lands shut at the right index; clocks recompute); drag
   onto the open circuit's "+ Add a station" (a fourth column); a drop on a filled column does
   nothing; Add on a row appends at the end; *Save to my drills…* on the bare Warm-up block (the
   row reads "10 min"); *Save to my circuits…* on Skills circuit with and without the tick; place
   the circuit by drag and by Add; Escape and focus on both sheets; the past-season imports
   offering a bare block and a multi-station block.
7. **QA walk as a tab on the same artifact** — "QA walk · 4": the tables at three widths (the
   phone row content-tall); the row as the door; Retire in the sheet; the empty template not
   offered; the dock at 1440 and its absence at 1280; drag into a gap, onto the open block
   (written / wordless / circuit), onto a filled column (nothing), on touch (nothing); the bare
   block's door and the drill's "10 min"; the circuit's door, the tick, the tab, the panel switch,
   the placed circuit's face and its provenance line; the provenance sentence; the uncapped past
   list. Ledger section at the **next free § at the tail** of `OWNER_QA_LEDGER.md` (check for a
   peer's uncommitted entry first — never re-sort; the file is CRLF).
8. **Commit only on the owner's word**, on `dev`, explicit pathspecs, private index if peers have
   staged work, `git show --stat HEAD` after. Update memory
   (`project_coach_practices_reevaluation`), plan §7 (append §7.8 the build record), the brief, TODO
   line 136, and **delete `COACH_PRACTICES_STAGE4_PLANNING_PROMPT.md` and this file with the commit**,
   as the earlier stages did.

## 6. Fixture, and how to look

UAT Test Team · 2026 Season, signed in as the UAT head coach (`tests/uat/.auth/coach.json`;
`UAT_COACH_EMAIL` / `UAT_COACH_PASSWORD` in `.env.local`). The library holds **Probe drill** (20 min ·
"Two lines, cones five metres apart…" · no tags) and **Probe plan template** (60 min · 3 blocks) plus
nineteen empty "New template N" rows; the probe practice re-anchors to today and holds **Warm-up**
(10 min, six players), **Skills circuit** (Footwork ladder · Close control · Finishing, every 15
min — all three stations written, none from a drill) and **Small-sided game**; the Tue Oct 27
practice is no longer blank (a "skills" block, "Power hitting"). The frames were drawn from these;
re-read every identity from the screen before you assert it — the fixture drifts under other
sessions' hands. The dev server is shared: `npm run dev` only; restart after new files or
shared-module changes (this stage adds files and a migration — restart before the owner's walk);
never a full `check:layout` sweep against a server in use — scope with `--only=` (the equals is
required).

## 7. Do not

- Do not make a circuit read-only like a drill, or a drill editable like a template — the seam is
  the design (plan §7.7; memory `project_coach_practice_plans`).
- Do not save anything to the library automatically — every save is a press, and the tick is a
  press too.
- Do not drop onto a filled station column, a shut block, or anything on touch.
- Do not restore a centred 816 sheet with empty margins — the pair fills the header's column.
- Do not put templates in the docked panel, add a tag filter or a truth label to the hub's past
  list, or move Practice review out of Insights.
- Do not touch the run screen, the printed sheet or the closed-season reader (stages 5–6).
- Do not bump the plan version or rename a stored key; the two new block keys are optional and
  whitelisted. The one migration is the circuits table.
- Do not commit without the owner's word; do not `git stash`; do not `git add -A`.
