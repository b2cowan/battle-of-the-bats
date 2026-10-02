# Save over a practice template, a drill or a circuit — plan

**Status:** drawn 2026-10-02 · D1–D4 ruled by the owner · **D5–D12 ruled as drawn 2026-10-02** ("looks good, go ahead with your recommendations") · built on dev 2026-10-02 (§9) · /simplify and /review run 2026-10-02 · owner QA §260.
**Hub (mockup · brief · plan · decisions · QA):** https://claude.ai/artifact/119bRyzRrt4MKxBDJ82WnE (source `COACH_PRACTICE_SAVE_OVER_HUB.html`).
**PM brief:** `COACH_PRACTICE_SAVE_OVER_PM_BRIEF.md`.
**Sibling:** the lineup builder's save-over (`COACH_LINEUP_COPY_FROM_GAME_PLAN.md` §10–§11, D13–D15, committed `0646ba2b`). This applies that design to practice plans.

## 1. Problem

The owner asked for the lineup builder's save-over on practice plans, drills and circuits. Today each of the three practice saves only creates. A name you already have is refused after the coach presses Save. A drill improved during a practice can only be saved back by retyping it on the Drills tab, and even then no practice that already uses it changes.

## 2. Findings (code as of 2026-10-02)

- **F01 — Save as template refuses a name you already have, after the press.** `SaveAsTemplateDialog` in `practice/[eventId]/page.tsx` POSTs a new template. The partial unique index `rep_team_plan_templates_name_uniq` (`lower(btrim(name))`, active only) refuses it with "You already have a template called …". There is no route to save over it.
- **F02 — Save to my drills refuses a name you already have.** After *Edit just for this practice* (`detachStationFromDrill`), the station keeps the drill's name, so promoting it back hits `rep_team_drills_team_name_uniq` → 409. The only edit path is the Drills tab's `DrillSheet`.
- **F03 — A block placed from a circuit has no save door.** `promoteDoor` in `_PracticePlanEditor.tsx` returns `null` when `block.circuitId` is set ("placed from a circuit — it is one already").
- **F04 — Bug 1: an untitled block cannot be saved as a circuit.** `PromoteDialog` shows the stand-in "Block N" in its title, but `promoteToCircuit` sends `name: block.title.trim()`, which is `''`, and `validateCircuitInput` answers "Give the circuit a name." With the tick on, the drills were already created. A retry fails identically.
- **F05 — Bug 2: the circuit is checked only after its drills are made.** `promoteToCircuit` creates the ticked stations' drills first, then POSTs the circuit. A clash (`rep_team_circuits_name_uniq`) or the 60-circuit cap (`MAX_CIRCUITS_PER_TEAM`) refuses the circuit after the drills exist. The designed retry links them (rows re-open as "already in your drills"), but a coach who gives up keeps drills from a "failed" save.
- **F06 — A drill update never reaches a practice.** Rule 3 in `lib/rep-drills.ts` (owner ruling 2026-08-01): "THE DRILL'S WORDS ARE COPIED, NEVER LINKED." `drillToStation` copies every word and keeps `drillId` as provenance only. **Revised by the owner 2026-10-02 (D3) for practices that have not started.**

## 3. What the coach sees

1. **Save as template… (practice).** The same window, plus "Your templates · tap one to replace it" under the field (active templates, newest first: blocks · minutes · saved date). A matching name shows "You already have a template called this. Saving replaces it." and the button becomes red **Replace "Hitting night"…**. The in-window question: "Replace "Hitting night"?", "Its blocks, stations, timings, what it's about and its tags become this practice's.", Now / After (blocks · minutes · tags · saved date), "Practices already started from it keep theirs.", "This can't be undone.", then **Replace template** · **Keep it**. Back returns to the field. Afterwards the window closes, as a template save does today.
2. **Save to my drills… / Save to my circuits…** gain a **Name** field above the tags, filled with the station's name or the block's title (D5). The titles become "Save to my drills" / "Save to my circuits". A name matching one of *your* drills or circuits shows "You already have a drill called this. Saving updates it.", picks that item's tags if the coach hasn't touched the tags (D6), and turns the button into red **Update "Partner throwing"…**.
3. **The drill question:** "Update "Partner throwing"?", "Its words, coaching points, equipment and tags become tonight's.", Now / After (first line of what you're doing · coaching points · equipment · tags), then **Upcoming practices pick it up** listing them (date · name), plus templates and circuits holding it (D7). It ends "Past practices keep the version they ran." With none: "No upcoming practice uses it yet." Then "This can't be undone.", **Update drill** · **Keep it**.
4. **After Update**, tonight's station rejoins the drill (D9): "From your drills" with *Edit just for this practice*, read-only like any placed drill.
5. **A block placed from a circuit** shows **Save to my circuits…** beside its provenance line (D11). The question: "Update "Skills circuit"?", Now / After (stations · minutes · tags), "Practices that already used it keep theirs. The next time you place it, it's this version." (D10), then **Update circuit** · **Keep it**.
6. **The Drills tab's drill sheet** says beside Save: "Saving updates the N upcoming practices that use it. Past practices keep theirs." It is absent at zero (D8). The sheet keeps its explicit Save.
7. **Limits** are stated in the window before anything is pressed. Templates: 60. Circuits: 60, with "You keep 60 circuits, the most a team can. Update one of yours, or retire one on the Circuits tab." Drills: 200. Save is off at the limit, and Replace / Update still work because they add nothing.
8. **Phone:** all three are forms, so they are drawers that cover the nav (2026-09-23 ruling). The question replaces the form inside the drawer.

## 4. The rules

### 4.1 The name decides
The match is the database's own rule: `lower(trim(name))` against the team's **active** templates, drills or circuits. A drill name that matches only a **club** drill (`teamId === null`) saves a new team drill, as today. A coach cannot update the club's set (D12).

### 4.2 What a save-over replaces

| Saved thing | Replaced | Kept |
|---|---|---|
| Practice template | Plan shape (`planToTemplateShape`) and tags, which become the practice's `planTagIds` (D2) | Name (its own spelling), retired state, usage |
| Drill, from a station | description, goal, coaching points, setup, equipment (names + ids), tags as picked (D2, D6) | Name; **`usualMinutes`** (a station has none) |
| Drill, from a bare block | The same, plus `usualMinutes` from the block's minutes (as `blockToDrillInput` does today) | Name |
| Circuit | `block` (`blockToCircuitShape`, people emptied) and tags as picked | Name |

### 4.3 What an updated drill reaches (D3, D7)
- **Upcoming practices:** this team's `rep_team_events` with `event_type = 'practice'`, `starts_at > now()`, and a `practice_plan`. In each, every station with `drillId = <this drill>` gets the drill half again (name, `drillTags`, description, goal, coaching points, setup, equipment, `equipmentTagIds`). It keeps `id`, staff, players, groups and `note`. A linked station's drill half is read-only in the editor, so nothing the coach did is lost.
- **Not touched:** practices that have started (any season); detached stations (no `drillId`); retire / restore.
- **Templates and circuits holding the drill (D7, recommended):** refreshed the same way. They are where the next practices come from.

### 4.4 Circuits and templates do not reach placed copies (D10)
A placed circuit or started template is edited freely in place, and nothing records which parts are the coach's. Only the next placement or start gets the new version. Drill-linked stations inside those copies still follow 4.3.

## 5. The two bugs (D4)
- **Bug 1:** the Name field replaces the stand-in title. An untitled block opens it empty ("What would you call this circuit?"), and Save is off until a name is typed.
- **Bug 2:** before any drill is created, the window has already resolved the three checks: the name is not empty; a clash has already made the button Update; a new circuit at the limit is stopped. Only then are the ticked drills created and the circuit saved. A later failure (connection) keeps today's retry-links design.

## 6. Out of scope
- Pushing a circuit or template update into practices already started from it (D10).
- A club admin's edit to a club drill reaching every team's upcoming practices (D12). It is a fair question under D3, but it writes across teams from the admin side, so it is its own step after this one is walked.
- Linking a station to a **new** drill saved from it (today's promote copies and stays).
- Undo for Update / Replace.

## 7. Build notes
- **Practice templates:** `PATCH …/development/plan-templates/[templateId]` already takes `plan` + `tagIds`. The practice-plan GET adds `updatedAt` to each template for the list and the facts.
- **Drills:** `PATCH …/development/drills/[drillId]` validates a whole drill (`validateDrillInput`), so Update sends the full `DrillInput`. A new **GET** on that route answers the question's list: upcoming practices (id, date, name) plus template and circuit counts. It is fetched when the question opens and sequence-guarded.
- **The walk:** a pure `refreshStationsFromDrill(plan, drill)` in the plan module (no `server-only`, unit-testable, the `repointPracticePlanTags` precedent). A server module, on the pattern of `lib/rep-practice-plan-tag-repoint.ts`, runs it over the team's upcoming practices (and templates and circuits, D7) in the same request as the drill PATCH. It is best-effort per row and writes only rows that changed. Retire-only PATCHes skip it.
- **The open page converges:** after Update, the page relinks tonight's station (D9), runs the same refresh over its in-memory plan, and marks it dirty. The next autosave then writes the new words even if an older PUT was in flight during the walk. **Residual risk, named and not fixed:** a second tab open on another upcoming practice can write old words back on its next edit. The plan PUT is last-write-wins, and the staff/equipment tag repoint lives with the same risk.
- **Circuits:** `PATCH …/development/circuits/[circuitId]` (`block`, `tagIds`). The door on a placed block is the existing `promoteDoor` with its `circuitId` guard removed.
- **Shared confirm view:** the lineup's replace window and these three share one confirm shape (Back, question, Now / After, warning, red confirm + Keep it). Extract one small component rather than four copies (offer `/simplify`).
- **Dictionary:** `rep_team_events.practice_plan` says "Written **only** by `updateRepTeamEventPracticePlan`". That is already untrue (the tag repoint writes it) and becomes less true. Name both walks. Revise rule 3 in `lib/rep-drills.ts`'s header, and the "copies" comments on `createDrill` / `createTemplate` / `createCircuit` / `promoteToCircuit`, to the D3 wording.
- **Checks:** `verify:changed`; unit tests for the refresh walk (kept fields, unlinked untouched, past untouched, templates/circuits) and the name match; the layout sweep on the practice plan screen; the spelling gate. **Help:** the practice-plan articles learn save over, Update, and the upcoming-practices rule (offer `/docs`).

## 8. Decisions

| # | Question | State |
|---|---|---|
| D1 | Save over templates, drills and circuits, with the are-you-sure inside the window | Owner ask 2026-10-02 ("can you see about doing the same…") — **ruled as drawn 2026-10-02** |
| D2 | Tags on save-over | **Ruled 2026-10-02:** replaced by the ones being saved ("you replace the tags with the updated ones") |
| D3 | Do practices using a drill pick up its update? | **Ruled 2026-10-02:** upcoming yes, past no ("existing plans should pickup the updated drill but not past ones") |
| D4 | Fix the two circuit-save bugs | **Ruled 2026-10-02:** fix both |
| D5 | Name field in the drill and circuit windows | **Ruled as drawn 2026-10-02:** yes |
| D6 | Tags start as the matched item's own | **Ruled as drawn 2026-10-02:** yes |
| D7 | Templates and circuits holding the drill pick it up too | **Ruled as drawn 2026-10-02:** yes |
| D8 | A Drills-tab edit reaches upcoming practices the same way | **Ruled as drawn 2026-10-02:** yes |
| D9 | Tonight's station rejoins the drill after Update | **Ruled as drawn 2026-10-02:** yes |
| D10 | Circuit / template updates do not reach placed copies | **Ruled as drawn 2026-10-02:** no reach |
| D11 | A placed circuit block gets the Save to my circuits… door | **Ruled as drawn 2026-10-02:** yes |
| D12 | Club drills: not updatable from a team; admin-edit reach is a later step | **Ruled as drawn 2026-10-02:** not now |

## 9. Build record (2026-10-02)

Built on dev 2026-10-02 to the drawings (hub v2), ruled as drawn. No migration.

**What changed, by surface**
- **Practice page — Save as template** (`practice/[eventId]/page.tsx`): `SaveAsTemplateDialog` gains the team's templates newest first under the field (`SaveOverList` + `CoachRowList inset`; each row: minutes · blocks · tags · saved date), the name match (`libraryNameMatch`), the red "Replace “X”…", the in-window question (`SaveOverQuestion`) with its Back step, and the 60-template limit line. `saveTemplate(name, replace)` PATCHes `plan-templates/[id]` with `{ tagIds: planTagIds, plan }` (D2) or POSTs as before. The practice-plan GET adds each template's `updatedAt`.
- **Plan editor — Save to my drills / circuits** (`_PracticePlanEditor.tsx`): `PromoteDialog` gains a Name field (D5), the match against the team's OWN active drills (club drills never, D12) or active circuits, tags that start as the match's own until touched (D6), the limit line (drills 200 / circuits 60) that turns Save off for a NEW one (D4), and the question with — for a drill — `DrillReachNote` ("Upcoming practices pick it up", read when the question opens; six shown, then "and N more"). `promoteToDrill` / `promoteToCircuit` take the name and the target; an update keeps the item's own spelling and, from a station, the drill's own "usually". `followDrill` relinks the saved station (D9) and, while the practice hasn't started, refreshes the plan's other linked copies — and skips the autosave when nothing changed. The circuit door shows on a placed block (D11). The circuit create sends the window's name (bug 1).
- **Shared:** `components/coaches/SaveOverQuestion.tsx` (+ module) — the question, the match line and the list's head and well; the lineup builder's `LineupSaveTemplate` now draws from it (no visible change; its module keeps only the well's bleed).
- **Server:** `lib/rep-drills.ts` — `refreshStationFromDrill` (drill half replaced wholesale, practice half kept, id kept), `refreshBlockFromDrill` (follows a rename into a sole-station block still titled the old way), `refreshPlanFromDrill`, `blockUsesDrill`, `libraryNameMatch`, the `DrillReach` type; rule 3 of the header rewritten to D3. `lib/rep-drill-refresh.ts` (server-only) — `refreshDrillAcrossTeam` (the live season's practices with `starts_at > now()`, every team template and circuit, retired included; writes only changed rows) and `getDrillReach` (cancelled practices left out of what is named; active library only). `PATCH …/drills/[drillId]` reads the name, updates, then walks — never on a retire/restore; a walk that falls short answers 500 with the saved drill and "Save it again to finish" (idempotent), reported to the error tracker. New `GET …/drills/[drillId]` answers the reach (schedule access; a club drill 404s).
- **Drills tab** (`_DrillsView.tsx`, `DrillSheet.tsx`): the sheet's foot says "Saving updates the N upcoming practices that use it. Past practices keep theirs." (D8) — a `saveNote` prop on its own row above the buttons (`.modalFooterNoted` / `.modalFooterNote`).
- **Records:** DATA_DICTIONARY — `rep_team_events.practice_plan` now names its three writers; `rep_team_drills` gotcha 2, `rep_team_plan_templates.plan` and `rep_team_circuits.block` name the refresh. `lib/types.ts` `PracticeStation.drillId` note rewritten.
- **Help** (`lib/help-content/coaches.tsx`): Drills — *Wrote something good in the plan instead?* gains "Improved one of your drills tonight?" and the read-only FAQ names Update; new FAQ *I improved a drill during a practice. Can I save it back over the drill?*; Circuits — the name, and "Made a circuit better tonight?"; Templates — Replace in the Save as template definition; keywords and search text for update / save over / replace.

**Departures from the drawing:** the question keeps the window's title in its head and puts ‹ Back at the top of the body (the lineup window's shape) — the drawing put Back in the head; the drill sheet's line counts practices only (templates and circuits are refreshed but not counted there).

**Verified** (`.probe/practice-saveover-check.mjs`, 1440 and 390, every write intercepted, a sample team drill and circuit and two sample blocks injected into the plan read): Save as template lists the team's template and asks before Replace, Back returns with the name; a bare block named after a team drill reads Update with the question listing two upcoming practices and a template, and Update PATCHes the drill and causes no autosave; a station saved back over the drill rejoins it ("From your drills"); the untitled block's circuit window opens empty with Save off; a placed circuit block has its door and PATCHes the circuit after the question. Typecheck clean; lint clean on every changed file (three earlier warnings unchanged); unit suite **5,545 / 5,545** (16 new refresh-and-match tests in `rep-drill-refresh.test.ts`; a 10-test wiring guard in `practice-save-over-guard.test.ts`); `verify:changed` green; layout sweep of coach-practice-plan, coach-practice-circuit, coach-practice-drills and coach-lineup-builder: no new findings; `measure:help`: every touched section under the rule.

**Found, not fixed:** a rotating block's "No groups yet · Choose groups…" line puts the groups menu (a `<div>`) inside a `<p>` — React logs invalid nesting in the console (the Next.js badge's "Issues"). Predates this work.

**/simplify (four lenses) and /review (high-risk tier, five lenses), 2026-10-02.** Simplify: the "you keep N …" limit line is one sentence for all three windows (`libraryLimitLine`); the lineup window uses the shared name match; the server walk reads each row through the sanitiser its table's readers use (`sanitizePracticePlan` / `planToTemplateShape` / `blockToCircuitShape`); tag names through `tagNamesById`; a circuit's Now/After through the library card's shape line (`circuitCardFacts`); the walk's change check compares the drill half only; the Drills tab asks what an edit reaches only once the coach has edited (it used to read on every open). Review — seven fixed: (1) the × on the drill/circuit window and the template window waits while a save is in flight (closed mid-save, the editor was editable again and the follow-up could lay the plan as it was before those edits back over them); (2) one save at a time in the drill/circuit window; (3) tags picked against one matched item never ride along when the name is retyped to match another; (4) an Update from a bare block carries the block's kit as ids as well as names (it left the drill with a name snapshot only); (5) the Drills tab shows the saved drill in its list when a save's walk falls short (the sheet stays open saying "Save it again to finish"); (6) "has this practice started" uses the shared `practiceStarted` rule; (7) the reach list's keys can't collide. Kept, on purpose: the walk leaves `updated_at` alone (a drill save is not the coach saving the template — "saved Sep 20" stays the coach's date; noted in the module); the reach GET needs schedule edit, like the sibling circuit and template reads; a walk that falls short answers 500 with the saved drill, because saving again is the fix and the windows say so. Security lens: clean (every read and write is scoped to the caller's team, a club drill cannot be pushed into a team's plans). Unit suite **5,548 / 5,548**; the guard grew two pins (tags per match, × waits).

**Owed:** a dev-server restart before the walk (new files); owner QA §260 (hub tab **QA Walk** — W1 replace a template, W2 update a drill, W3 circuits and the two bugs; 27 steps).
