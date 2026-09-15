# Kickoff prompt — Practices re-evaluation: Stage 2 (The block)

*(paste into a fresh chat)*

**Pick up the Practices re-evaluation at stage 2 — "The block" — and only that.** The stage is
**ruled (2026-09-15, D1–D11 all "Build as drawn")** and drawn at true size on the hub; your job is
(a) commit stage 1 first (it is walked and still uncommitted), (b) build stage 2 exactly as drawn,
(c) walk it, and (d) open the stage 3 tab ("Stations and the rotation") on the same artifact — mockups
only, no stage 3 code. Where this prompt and the drawn frames disagree, the frames win; where the
plan's §5.0 rulings and the frames disagree, the rulings win — and you redraw before you build.

**Already ruled by the owner, do not re-litigate:** the practice room is the hub for practices,
templates and drills (stage 0); the plan page is a document — a sheet with a time gutter, blocks as
rows that open in place, one at a time (stage 1); a practice needs an end time (stage 1, D9); people
live at exactly ONE level (2026-08-01); a drill is an identity claim — a drill-backed station is
read-only and loses its provenance the moment it is edited (D20 — do not soften it); reorder with
buttons, never drag (until S.4 is ruled at stage 4); "planned", never "done"; roster order everywhere.

---

## 1. Read first, in this order

1. **The plan — the spec:** `docs/projects/active/COACH_PRACTICES_REEVALUATION_PLAN.md` — §1 the
   ladder, then **§5 in full**: §5.0 the eleven rulings, §5.1 what the walk saw and what the code says
   (the arguments — argue from the same evidence), §5.2 what a coach sees, §5.3 the decisions with
   what rides on each, §5.4 the constraints, **§5.5 the build design**, §5.6 the hand-off to stage 3,
   §5.7 what the readers read afterwards, §5.8 verification, §5.9 the frames and their measured
   heights. Then §4.1 (stage 1's rulings and its ten build calls — the page you are building INTO;
   binding) and §4.5 (stage 1's build record — the gate wobble and the layout gate's blind spot inside
   a shut block, which this stage must fix).
2. **The artifact — the drawings:** https://claude.ai/code/artifact/5c3d2f1b-5159-4d99-bad7-c48b2820da28
   Tab **"2 · The block"**: ten frames at true size (the written warm-up before/after at 1440; a block
   just added; a drill-placed block before/after; the shut rows; the clock row in four states; the
   phone at 390 ×3; the tablet at 768; the template room) with **thirty clickable markers** — each
   popover is the ruling for that element — and **D1–D11** with their notes. Every drawn block wears
   its measured height; §5.9 lists them. Source file
   `docs/projects/active/COACH_PRACTICES_REEVALUATION.html` — **republish the SAME path** (or pass its
   `url`) so the version history threads; a new path mints a new artifact.
3. **Memory** (auto-loaded): `project_coach_practices_reevaluation` (this walk — stage 1's build,
   the traps, the shared-working-copy discipline), `project_coach_practice_plans` (what the maker is
   and every ruling it carries), `decision_no_line_count_on_a_row` (why "Coaching points: N" leaves
   the row), `project_coach_tablet_band`, `feedback_clickable_design_annotations`,
   `reference_coach_money_check_then_act`.
4. **The code you will change** (read each header comment first — they carry the rulings):
   - `app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx` — `BlockCard` is the
     whole of stage 2 (its open body, its closed row's `rowMeta`, the doors, the clock row);
     `CoachingPoints` (D10 on the BLOCK only); the three sheets (`DrillPickerSheet`,
     `PromoteDrillDialog`, the roster picker) take the dialog floor (D9). `StationCard`,
     `RotationPanel` and `DrillFacts` are **untouched** (stage 3).
   - `lib/rep-practice-plan.ts` — `sanitizeBlock` learns `equipmentTagIds` on a block and the D11
     MOVE rule; `restrictTagIds`, `collectPracticePlanTagIds`, `repointPracticePlanTags`,
     `resolvePracticePlanTagNames` add the block level; a new predicate `blockAsksForTeaching` beside
     `blockRotates`; `resolveStationTeaching` **unchanged**. `lib/types.ts` — one optional field on
     `PracticePlanBlock` with its reasoning comment. `PRACTICE_PLAN_VERSION` stays 1.
   - `app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx` — the start-from picker and
     the save-as-template dialog take the floor (D9); `handlePrint`'s block line: `Goal:` →
     `Watch for:` and `Equipment: …` on a block (D3, D11); the About summary derives the bag (D11).
     ⚠ A peer (the S&G Session session) has a one-line vocabulary edit in this file's "Recorded here"
     block — pull/merge before you touch it.
   - `app/[orgSlug]/coaches/teams/[teamId]/practice/templates/[templateId]/page.tsx` — the same
     editor; confirm `planToTemplateShape` / `templateToPlan` carry block equipment (shape).
   - `components/coaches/useDialogFloor.ts` — the floor you adopt (read its header: stacked overlays,
     `escapeOwnership.ts`, the busy gate). `components/coaches/PracticeTagPicker.tsx` — the picker the
     block's Equipment door mounts (the same one a station has).
   - `app/[orgSlug]/coaches/coaches.module.css` — the `pp*` block rules (around `.ppBlockBody` /
     `.ppDuration` / `.ppTl*`) and the 768/640 blocks. ⚠ A peer appends at the END of this file; edit
     in place, never re-order.
   - `lib/export/pdf.ts` — read `buildPracticeRunSheetDoc` only to confirm nothing there changes (the
     caller's `notes` string is the only thing that moves).
   - `app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/run/page.tsx` and
     `_PracticeStationView.tsx` — readers; read to confirm §5.7 (no change; the block's kit on the
     field screen is stage 5's).
   - Guards and gates: `tests/unit/rep-practice-plan.test.ts` (extend for the move rule and the
     predicate), `tests/unit/development-vocabulary-guard.test.ts` (the idiom for the new
     practice-vocabulary guard), `tests/unit/escape-owner-guard.test.ts` (already covers the
     comboboxes), `scripts/layout-screens.mjs` (the plan page needs an interaction step that OPENS a
     block before measuring — the blind spot §4.5 recorded), `scripts/.layout-baseline.json`
     (`--prune --only=` the two screens only), `tests/uat/scenarios/practice-plan-save.spec.ts`.
   - Help: `lib/help-content/coaches.tsx` — the Practice plans article's block paragraph ("description,
     goal", "how many coaching points it carries"), the stations paragraph's equipment sentence, search
     terms. Run `/docs` after the build.

## 2. Step zero: commit stage 1 (on the owner's word)

Stage 1 is walked (§188 complete) and **uncommitted** on the shared working copy. Confirm the owner
wants it committed first, then build the commit in a **private index** from HEAD plus stage 1's hunks
only — never `git add -A`, never `git stash` (it yanks peers' files). The stage 1 files: the practice
page, the template page, the schedule page, `_PracticePlanEditor.tsx`, `lib/practice-state.ts`,
`lib/rep-practice-plan.ts`, `lib/types.ts`, `lib/export/pdf.ts`, `lib/use-minute-clock.ts` (new),
`components/coaches/SaveStatusPill.tsx` (new), `coaches.module.css`, `globals.css`, the chat module
css + `ChatPanel.tsx` (the pill's callers), `CoachHostedTournamentsSection.tsx` and the tournaments
page (check `git diff` — some of these may be a peer's), `lib/help-content/coaches.tsx`, the unit and
UAT tests, `scripts/layout-screens.mjs`, `.layout-baseline.json`, the plan, brief, hub HTML, the
ledger, TODO. ⚠ `git status` at the start of this chat is the truth, not this list: peers' hunks in
the shared files (the ledger's tail, TODO, the css file's end, the help file's Skills & Goals guide)
are NOT yours — stage them by hunk. `git show --stat HEAD` afterwards; if a foreign file landed,
`git reset --soft HEAD~1` and redo.

## 3. The eleven, as ruled (one line each — §5.0 and the tab are the full text)

- **D1** A block opens to **title · the clock row · What you're doing · What you're watching for ·
  Players** (reading **Whole team** until names are chosen; clearing them returns it; never a number).
  Doors at the foot: **+ Coaching points · + Staff · + Equipment (while no stations) · + Stations**. A
  field with content always shows. Players is absent with stations and on a template.
- **D2** Two fields, not one — no notes-area merge, no shape change.
- **D3** *What you're doing · What you're watching for · Coaching points* on the block; the sheet's
  block prefix "Goal:" → "Watch for:"; the stored keys are identifiers and do not change; a
  vocabulary guard over the editor's block labels.
- **D4** The open block repeats nothing of the start; the clock row ends with "ends 7:15 p.m." (the
  rest block: "runs to 8:30 p.m."; a template: nothing). The gutter is not re-opened.
- **D5** Chips 5 · 10 · 15 · 20 · 30, then the minutes box, then *Rest of practice* as a chip —
  **absent** (not disabled) while another block holds it; un-pressing Rest → 15, never null.
- **D6** The shut row: title (+ Rotation tag) · first line (resolved through a sole station) · "3
  stations" when it has them · **Whole team** or "6 players" · nothing else. No points count.
- **D7** With exactly one station and no words of its own, the block asks for no teaching and opens
  onto the station's read-only text + provenance; title and minutes stay the block's; the station
  card is drawn as today (stage 3 rules whether it flattens).
- **D8** 390 and 641–768: no new arrangement; the clock row and doors wrap; the 44px floor.
- **D9** `useDialogFloor` on all five sheets; Escape never closes an open block.
- **D10** Coaching points as **one field, one per line** on the block (split on newlines into the
  same capped list; the station and the drill library keep their rows until stage 3).
- **D11** **Kit lives at exactly one level — the activity's** (the block while it has no stations;
  each station once it has them). The block's kit **moves** when its first station arrives (onto a
  written first station; up into the practice's list when the first station is a drill) — it never
  vanishes. The practice's list is the **bag**: the union of every activity's kit plus extras; derived
  items are shown at the top and removed where they came from (the tags precedent). The sheet prints
  the bag at its head and each activity's kit beside it. No quantities.

**Two calls that stand without a decision:** the doors sit in ONE quiet line at the block's foot (not
a "+" beside each label); the title placeholder "What are we doing?" stays.

## 4. Rules that bite (from the code, not from plans)

- **Emptiness discards nothing.** A block, a station and a just-opened door survive autosave; only an
  empty STRING in a list is dropped (today's behaviour). A door opened and left empty is a door again
  on reload — say so in the code, do not "fix" it.
- **The move rule replaces a silent delete.** `sanitizeBlock` today deletes `block.playerIds` when
  stations exist; D11 asks kit to MOVE, not vanish — implement the move in the sanitiser (idempotent:
  a second pass finds nothing to move) and leave the players rule exactly as it is (not this stage's).
- **One predicate for "does this block ask for teaching?"** — `blockAsksForTeaching(block)` =
  `(block.stations?.length ?? 0) !== 1 || hasOwnTeaching(block)`, in `lib/rep-practice-plan.ts`,
  read by BOTH the closed row and the open body so they cannot disagree.
- **The bag is derived, never written down.** The About summary and the sheet's head compute the
  union at read time from the plan's own `equipmentTagIds` ∪ blocks' ∪ stations'; the plan's stored
  list stays the coach's extras. A pre-existing top-level list is untouched — nothing migrates down.
- **`DEFAULT_BLOCK_MINUTES` is the one 15** (the ghost row's promise and D5's un-press).
- **The clock walk is the one arithmetic.** "ends …" is `clock.endLabel`, already on `BlockCard`'s
  props; no second walk, no hand-built label (`formatTime()` / `formatInOrgZone` only — "7:15 p.m.").
- **One spelling.** "Coaching points", "What you're watching for" (curly apostrophe as rendered),
  "Rest of practice", "Whole team"; `check:spelling` runs on the editor. Grep for a variant before
  adding a word.
- **The lime is the ghost row's.** A pressed chip is a selected state; the doors are quiet links
  (`.ppTlQuietLink`); nothing in the block is lime.
- **Every `.modalOverlay` on this page takes the floor**, including the page's own two; the tag
  comboboxes already claim Escape while open — do not add a second mechanism.
- **Roster order everywhere**; the Players line renders names in roster order (already so).
- **Live-season only** — no route learns a year (`HISTORY_ENDPOINTS`).
- **Nothing on the station card, the rotation panel, the drill sheet's contents, the run screen or the
  sheet's drawing changes.** The reader changes are exactly: the sheet's block line prefix and its
  "Equipment: …", and the About summary. If a change seems necessary elsewhere, it is a question.

## 5. Process gates (blocking, in order)

1. **PM UX summary in chat before code** — what a coach sees and does differently, per decision, in
   the owner's voice (no file paths).
2. **Stage 1 committed** (§2) — or the owner's explicit word to build on top uncommitted.
3. **Build to the frames.** Every drawn state exists: the four clock-row states, the drill-placed
   block, the template's block, the phone's wrapping. Measure the built warm-up against §5.9 (691 →
   579 drawn) and report the real numbers.
4. **`/simplify`** (a new predicate, a new shared "kit at one level" walk and a derived bag — three
   candidates for reuse; run it), then **`/review`** (high-risk: the sanitiser and the shared
   stylesheet; five lenses), then **`/docs`**.
5. **Gates:** `npm run verify:changed` · `npm run typecheck` · the unit suite (the new vocabulary
   guard, the move rule, the predicate) · `npm run check:layout -- --only=coach-practice-plan,
   coach-development-template` **with the open-block interaction step added to the sweep** (the
   §4.5 blind spot) at 1440 · 768 · 390 · `check:demos`. Report anything skipped and why.
6. **QA walk as a tab on the same artifact** — "QA walk · 2": checkboxes in `localStorage`, progress,
   per-part verdict, notes, paste-back, the **Sign in as** card (localhost:3000 ·
   `uat-coach@uat-test-org.local` · the dev password from `.env.local` · UAT Test Team). Pin
   IDENTITIES, never as-of-today figures. Steps for: the warm-up open before/after heights; a new
   block's face; each clock-row state; the rows; a drill-placed block; Escape on each of the five
   sheets with focus returning; kit moving when a station is added (both cases); the bag deriving; a
   template's block; the phone and the tablet. Ledger section at the **next free § at the tail** of
   `OWNER_QA_LEDGER.md` (a peer is adding §189 — never re-sort).
7. **Then open the stage 3 tab** — "3 · Stations and the rotation": stations as columns under their
   block on desktop (the grid's columns are the same columns), the rotation strip between the row
   and the columns, a station card that shows name · who runs it · tonight's note and opens for the
   rest, the draw as one control — and **first, the question stage 2 sends it:** does a block's SOLE
   station flatten into the block or keep its card? Before/after at true size, 1440 and 390 (and 768
   where the columns matter), clickable markers, decisions with Build-as-drawn / Change-it / Not-now
   and a paste-back. Mockups before any code — no stage 3 code in this chat.
8. **Commit only on the owner's word**, on `dev`, explicit pathspecs, private index if peers have
   staged work, `git show --stat HEAD` after. Update memory (`project_coach_practices_reevaluation`).

## 6. Fixture, and how to look

- UAT: `uat-test-org` · UAT Test Team `3127a094-458f-4b78-8726-17342a8e37a6` · head coach
  `uat-coach@uat-test-org.local`. Practices: Team practice 1 (May 5, blank — the stage 1 walk's
  fixture; restore it to blank after a probe), Practice review — written up (May 14, one block +
  recap), UAT probe practice `773afff0-5777-447f-87bd-7686ec4bc6b1` (Sep 13 — three blocks: Warm-up ·
  Skills circuit with three stations rotating · Small-sided game; ⚠ it re-anchors to NOW, so the hub
  card's run state and two schedule rows drift under the layout gate — re-baseline scoped, with the
  recorded reason), Practice review — next week (Sep 20). Library: one drill (Probe drill), sixteen
  templates (fifteen empty).
- The dev server is shared and may be running under a peer's session: `npm run dev` only; restart
  after new files or shared-module changes (`lib/types.ts`, `lib/rep-practice-plan.ts` — both change
  here); stop it BEFORE deleting `.next`; a peer's restart shows as Jest-worker 500s in your probe —
  wait and re-run. Do not launch a sweep against a server someone else is using.
- Screens: Playwright with `storageState: tests/uat/.auth/coach.json`; element screenshots (smooth
  scroll blanks `scrollIntoView` shots); the plan page's ready marker is
  `[data-room="practice-plan"][data-room-state="loaded"]`; open a block by clicking its row button
  (`aria-expanded="false"`, the row's name is its content behind an sr-only "Open").

## 7. Artifact mechanics (so you edit it without breaking it)

- One assembled HTML file; tabs are `.tab[data-tab]` buttons over `#tab-*` panels; the script's
  `panels` map decides which ids exist — add `qa2` and `stage3` there. State in `localStorage` under
  `reeval-practices-v1`. Never the artifact runtime capability for tick state.
- Frames: `.framewrap > .frame > .pf` (portal facsimile; `.pf.narrow > .cardonly > .doc` for
  "the document only"; phone = `.pf.ph.tall` with `.bar` and `.fold`; tablet = `.pf.t768`). The
  stage 2 block pieces are `.ob / .obh / .obb / .crow / .qc / .doorline / .who / .rowb`; markers sit
  INSIDE the element they explain (`.an` + `.mk` / `.mk.ok` + `.pop`; `.mk.r` right-anchored — use
  `r` inside a block or the marker covers the field label); every marker carries `data-d` naming its
  decision so the tab cross-links it. `[data-measure]` blocks wear a live `[data-hpx]` height
  (offsetHeight, measured when the tab shows). The QA-walk tabs are wired by `setupWalk(tabId,
  prefix, btnId, outId, title)` — copy the "QA walk · 1" panel's shape and register a new prefix.
- Traps: `.pf .doors` is stage 0's door-tile GRID — never reuse the name; note numbers are global
  across tabs (stage 2 used 1–30; continue from 31); the `.u` override; the rail reads
  `#tab-walk section[data-title]`.

## 8. Do not

- Do not redraw stations, the rotation panel, the groups grid or the draw (stage 3); the drill
  library, the docked panel, drag or the Add-a-block dialog's future (stage 4); the run screen or the
  sheet's layout (stage 5); "How it went" or the record's face (stage 6).
- Do not soften the drill rule (D20), add a migration, bump the plan version, or rename a stored key.
- Do not make Escape close an open block, a chip a lime, or a door a button.
- Do not change the players-at-one-level rule or its silent delete — flag it beside the kit move
  (it is a stage 3 candidate), do not fix it on the way past.
- Do not fix the plan page's other logged defects "while you are there" (the walk's "Across the walk").
- Do not commit without the owner's word; do not `git stash`; do not `git add -A`.
