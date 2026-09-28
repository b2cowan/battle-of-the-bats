# Groups at every level of a practice — plan

**Plan · 28 September 2026 · DRAWN on the hub (7 screens, findings F01–F04, decisions G1–G8) · RULED 2026-09-28 (G1–G8 as drawn) · BUILT ON DEV 2026-09-28, both stages (§8) · owner walk §247 on the hub's QA Walk tab**

Hub (mockup · brief · plan · decisions, one artifact): `docs/projects/active/COACH_PRACTICE_GROUPS_HUB.html`
→ https://claude.ai/artifact/Jkd7EmKs6tjwechsDk2N5t · PM brief: [COACH_PRACTICE_GROUPS_PM_BRIEF.md](COACH_PRACTICE_GROUPS_PM_BRIEF.md)

## 1. The ask

Owner, 2026-09-28: *"we need a way to split the team into groups outside of the stations, for instance
we might want players paired up during warm ups or for pitcher/catcher practice that does not
necessarily necessitate stations. how can we make it efficient so we have the options of applying
groups at the stations level, block level, or practice level and make it easy for the coach to
understand this?"*

The reframe given in chat before drawing: **not three group editors at three levels** (a coach cannot
tell which one wins), but **one set of groups per practice that any "who" line can use**. Nothing on
screen says "level".

## 2. What the code does today (read from the model and the editor)

- **F01 — groups live only inside a rotating block.** `PracticeGroup[]` is stored on
  `PracticePlanBlock.rotation.groups`; a rotation exists only while `blockRotates(block)` (2+ stations,
  "Groups rotate" pressed). `PracticeGroupsRoom` opens only from the rotation board. A block with no
  stations has `playerIds` only.
- **F02 — every rotating block draws its own groups.** Two circuits = two independent sets.
- **F03 — D21's third option was ruled and never built.** D21 (31 Jul) = by hand · at random · *same
  groups as last practice*. `PracticeGroupSource` still carries `'previous'`; nothing sets it. The only
  reuse path is `copyPracticePlanForReuse` (a whole plan).
- **F04 — a separate station cannot be split.** `PracticeStation.playerIds` is a flat list, visible
  only inside the station dialog (the column shows name · staff · tonight · description).

The standing law this must keep: **people live at exactly ONE level** (owner 2026-08-01, enforced by
`settleBlockPeople`), and **people MOVE when the level moves, never vanish** (D8, 2026-09-15).

## 3. Proposal (as drawn)

1. **The practice owns a list of named sets** ("Groups" fold under the goal line; a quiet
   "+ Groups for tonight" line before any exist — G7). Each row: name · shape · names · "Used in …" ·
   Edit.
2. **Any Players line can use a set.** A block with no stations and a separate station gain
   "Split into groups…" beside "Choose players…" (G2). A menu: *use tonight's sets* · New groups… ·
   From another practice…. The line reads the set back ("Throwing partners · 5 pairs · Change…", one
   quiet line of names, the not-replied line, "Edit pairs › · also used in Warm-up").
3. **Linked, not copied (G1).** Editing a set changes every block using it; the room's foot says so
   and offers "Make a separate copy for this block".
4. **A circuit uses a set from the same list (G3).** A rotating station gets no pairs of its own —
   the tonight note carries "pair up" (G4).
5. **Pairs read as pairs (G5):** "5 pairs", "Pair 1", "Avery & Gray", "Not in a pair"; a no-station
   block opens the draw on *Players per group: 2*.
6. **From another practice… (G6)** copies a set from any earlier practice this season (D7: a plan
   belongs to one practice — copy, never link). Players off the roster are left behind; not-replied
   players stay placed, dashed, and are named.
7. **Field and paper (G8):** run screen and My station list the pairs; the helper home follows; the
   printed sheet prints names under the FIRST block that uses a set; the staff email follows the sheet.

**Not proposed:** position-aware pitcher/catcher pairing (sport-specific; the draw stays a shuffle and
a deal — D21's guardrail); a team-level saved-groups library; named pairs per round inside a rotating
station. **Later idea:** circuit groups built from whole pairs.

## 4. Model (to confirm at build)

- `PracticePlan.groupings?: { id, name, groups: PracticeGroup[], groupSource }[]`.
- A pointer (`groupingId`) on a no-station block, on a separate station, and on the rotation — **in
  place of**, never beside, a player list. The one-level law gains one clause per level ("its list OR
  its set"); `settleBlockPeople` becomes plan-aware.
- **Lift on read:** the sanitiser moves each `rotation.groups` onto `plan.groupings` with an id derived
  from the block id (deterministic + idempotent — the sanitiser runs on every read and write), named
  "<block title> groups". `PRACTICE_PLAN_VERSION` bumps.
- **No DB migration expected** — the plan is `rep_team_events.practice_plan` jsonb. Confirm against
  the live snapshots, not migration files.
- An unused set is kept. Deleting a used set confirms, names the blocks, and hands each block the
  set's players as a plain list. A change to a set drops a circuit's hand arrangement through the
  existing fit check (D14), stated in the editor.
- Consumers: the editor, rotation grid/board (`rotationShape`, `computeRotation`, `arrangementFits`),
  run screen / My station / helper home, printed sheet, staff email, templates (`withoutPeople` keeps
  the shape, no players), `copyPracticePlanForReuse` + template/past-season copy (fresh ids, roster
  check via `restrictToRoster`), the finished-season reader (renders the sheet), coverage ("In a plan"
  counts a set's players), in-app help.

## 5. Stages

1. **Groups on the practice** — model + lift + fold + block door/menu/read-back + room name/foot/copy +
   pairs wording + the circuit using a set + field/paper reading sets (nothing written that cannot be
   read).
2. **Stations and other practices** — the separate station's door and column line; From another
   practice….

One pass is fine if the owner prefers; the split only shortens the first walk.

## 6. Rollout

No migration expected. Coach demo sandbox: its circuit groups lift to sets on read; the master build
re-seeds itself; no tour anchor targets the groups board today (the build fails if one does).
/simplify → /review → /docs → owner QA walk on the hub.

## 7. Rulings

**RULED 2026-09-28 — owner, in chat on the drawings: "looks good, go ahead".** G1–G8 all as
recommended and drawn; both stages built in one pass (the owner's standing "build the whole phase
first pass").

| # | Ruling |
|---|---|
| G1 | Linked — one set per practice, shared by every block that uses it; "Make a separate copy" in the room |
| G2 | The door is on the Players line ("Split into groups…") |
| G3 | A circuit takes its groups from the same list; older plans' circuit groups lift onto it on read |
| G4 | A separate station splits the same way; a rotating station gets no pairs of its own |
| G5 | Groups of two read as pairs everywhere; a no-station block's draw opens on 2 per group |
| G6 | From another practice… — copies, never links |
| G7 | A quiet "+ Groups for tonight" line before any set exists |
| G8 | Run screen, My station, helper home, printed sheet and staff email name the pairs |
| G9 | **Ruled on trying the build (owner, 2026-09-28: "if I update one by removing or changing its pairs and a group is no longer linked to a block, why does it stay on the practice plan?" → "yes make both changes").** A set lasts as long as something uses it — its last use leaving takes it off the list; a set made from the Groups list itself (`standing`) stands unused until picked, then is ordinary; the menu warns before a last use is left |
| G10 | **Same ruling.** A set made as pairs keeps saying pairs when uneven and states it ("3 pairs · one of 3, one of 1"); the set's shape (`draw`) is saved the moment it is chosen in the room |

## 8. Build record (2026-09-28)

Built on dev in one pass, both stages, the day of the ruling. **No migration.** Verified: `tsc` clean ·
eslint clean on every changed file · the full unit suite (5,085, incl. 26 new in
`tests/unit/practice-groups.test.ts`) · `check:layout --only` on the plan, circuit, station, groups,
record, templates and run screens at 361/390/768/1440 — no new findings · a Playwright walk at 1440 and
390 on the UAT probe practice with writes stubbed (`.probe/pg-groups-smoke.mjs`, `.probe/pg-run-smoke.mjs`).

**The model (lib/rep-practice-plan.ts · lib/types.ts).** `PracticePlan.groupings[]` (`PracticeGrouping`:
id · name · groups · groupSource · `forPlayerIds?` · `draw?`); `groupingId` on a no-station block, on a
station, on a rotation. `PracticeRotation.groups/groupSource` REMOVED from the type; the sanitiser lifts
a stored `rotation.groups` into a set `<blockId>-groups` named "<title> groups" (idempotent). The
one-level law now reads "names OR a set" (`cleanHolding`: a dangling pointer drops, a set wins over a
list); `settleBlockPeople` moves pointers with the level (a block's set → the first station, or whole to
a new circuit; the last station goes → the set comes home) and **dissolves a plan-dealt `…-groups` set
back to names when its circuit ends and nothing else uses it** (keeps S4: an abandoned "+ Stations"
leaves nothing). Arithmetic takes `RotationInput` (`rotationInput(groupings, block)`);
`buildRunSteps(blocks, groupings)`. New readers: `groupingUses`, `isPairSet`, `groupingWords`,
`groupingShape`, `groupNames`, `unplacedInSet`, `copyGrouping`, `groupingShapeOnly`,
`groupingsFromPractices`; `drawGroups` names a two-a-group draw "Pair N".

**Surfaces.** Editor: `GroupsMenu` (the portal action menu, drawer on a phone) · `SetReadBack` ·
`PeopleLine` (block + station) · `GroupsFold` (+ the G7 invitation) · `GroupsFromPracticeSheet`;
station columns of a non-rotating block show who is there; the circuit board reads its set with
"Choose groups…"; a new set closed with nobody placed puts the place back. Room: set-based, name box,
"Used in … A change here changes both", "Make a separate copy for …", "Delete …" (asks; blocks keep
their players as names, a circuit goes back to no groups), pairs wording, `forPlayerIds` draws.
Run screen: `FieldSet` lists a block's pairs; My station names a separate station's set. Sheet: a set
prints under the first block using it. Staff email: the set's word and name, no child. Templates keep
a set's shape (empty groups + `draw`); circuits keep no pointers. Coverage counts members of USED sets.
Page: `groupingsElsewhere` from the season's other practices. `DATA_DICTIONARY.md` updated.

**Deviations from the drawings (all stated on the hub's Full Plan tab, to confirm on the walk):**
1. No countdown on the run screen — the drawing's was a mistake (P10, the field has no clock).
2. The staff email names no child (ruling K) — "In pairs · Throwing partners" only.
3. The set's name leads the room's BODY (the sheets' shared anatomy), not the head row.
4. The run list keeps who RUNS a block first, as before; the set is on the block's stop.
5. Names inside a drawn pair in roster order (§4).
6. A plan-dealt circuit set dissolves when the circuit goes (above).
7. The template room shows sets read-only (made on a practice).
8. The sheet prints a set's names once, under its first block.

**Not done here (offer, not built):** in-app help (`/docs`); `/simplify` + `/review`. The demo seed
and `check-demo-coach.mjs` still write/read the old rotation shape — reading is lifted, so both keep
working; the checker's raw-jsonb test would stop matching only once a demo plan is SAVED through the new
editor (report-only; seeds are automation this session did not change).

### 8.1 Revision on trying it — G9 · G10 (2026-09-28, same day)

- **G9.** `settleBlockPeople` ends with a prune: a set nothing points at leaves `plan.groupings` unless
  `standing` (new optional flag — made from the Groups list: `newSet(null)`, and "From another
  practice…" from the fold); a used `standing` set loses the flag. The sanitiser's lifted-unused filter
  went (the prune covers it). The groups menu shows a note at its top when THIS place is a non-standing
  set's only use. A whole-plan copy keeps `standing`. Consequence worth knowing: rotating a circuit off
  lands its groups on the stations as names and the set, now unused, leaves too.
- **G10.** `isPairSet` reads the set's `draw` first (content only when a set has none — a lifted
  one); `groupingShape` appends the uneven sizes for pairs. New sets carry their `draw` from the start
  (`defaultDrawFor`); the room saves the draw choice on change, not only on Draw.
- Verified: `tsc` clean · eslint clean · the unit suite 5,088/5,088 (3 new) · `check:layout --only`
  plan/groups/circuit — no new findings · the smoke probe (the owner's saved "Throwing partners" reads
  "3 pairs · one of 3, one of 1"; the leftover copy was already gone on load; a shared set warns
  nothing; a set used only here warns and leaves the list on Whole team).
