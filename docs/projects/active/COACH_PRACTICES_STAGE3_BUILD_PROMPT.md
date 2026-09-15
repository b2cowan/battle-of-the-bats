# Kickoff prompt — Practices re-evaluation: Stage 3 (Stations and the rotation)

*(paste into a fresh chat)*

**Pick up the Practices re-evaluation at stage 3 — "Stations and the rotation" — and only that.**
The stage is **ruled (2026-09-15, D1–D3 · D5–D8 "Build as drawn", D4 "Build as REVISED")** and
drawn at true size on the hub. Your job is (a) build stage 3 exactly as ruled — **note that D4 is
NOT the frame originally drawn; build the revision**, (b) walk it, (c) commit on the owner's word.
Where this prompt and the drawn frames disagree, the frames win; where the plan's §6 rulings and
the frames disagree, the rulings win (this applies to D4 specifically: the frame captioned
"superseded" is history, not the target).

**Already ruled by the owner, do not re-litigate:** the practice room is the hub for practices,
templates and drills (stage 0); the plan page is a document — a sheet with a time gutter, blocks
as rows that open in place, one at a time (stage 1); a block opens to title · clock row · *What
you're doing* · *What you're watching for* · Players, with everything else as doors at the foot
(stage 2); a drill is an identity claim — a drill-backed station is read-only and loses its
provenance the moment it is edited (D20 — do not soften it); coaching points are one field, one
per line, on the block (stage 2, D10 — this stage finishes the same idiom on the station and the
drill library); kit lives at exactly one level, the activity's, and MOVES rather than vanishing
when a station arrives (stage 2, D11); reorder with buttons, never drag (until S.4 is ruled at
stage 4); "planned", never "done"; roster order everywhere.

---

## 1. Read first, in this order

1. **The plan — the spec:** `docs/projects/active/COACH_PRACTICES_REEVALUATION_PLAN.md` — **§6 in
   full**: §6.0 the eight rulings, §6.1 what the walk saw and what the code says, §6.2 what a coach
   sees, §6.3 the decisions with what rides on each, **§6.4 — read this one twice — the reasoning
   for why D4 was revised mid-review and exactly what changed**, §6.5 verification, §6.6 the
   frames. Then §5 in full (stage 2 — the page you are building into; binding, especially §5.11's
   three owner revisions, which are already live on dev).
2. **The artifact — the drawings:** https://claude.ai/artifact/CPdBMaADr4onweuQz8Vp71 — Tab
   **"3 · Stations and the rotation"**: eleven frames at true size with clickable markers 31–43
   (31–42 the original 15 Sep draw, **43 the D4 revision — read its popover, it carries the
   argument**) and D1–D8 with their notes, **the D4 card explicitly reading "Build as REVISED, not
   as first drawn."** The frame captioned "open inline — the 15 Sep draw, revised below" is the
   superseded shape; build the one captioned "opens as a modal, with a stepper" instead. Source
   file `docs/projects/active/COACH_PRACTICES_REEVALUATION.html` — **republish the SAME path** (or
   pass its `url`) so the version history threads; a new path mints a new artifact.
3. **Memory** (auto-loaded): `project_coach_practices_reevaluation`, `project_coach_practice_plans`,
   `feedback_clickable_design_annotations`, `reference_coach_money_check_then_act`,
   `feedback_shared_component_over_shared_class`.
4. **The code you will change** (read each header comment first — they carry the rulings):
   - `app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx` — `StationCard` and
     `RotationPanel` are the whole of stage 3's screen; `DrillFacts` renders a drill-backed
     station's read-only text and is read by both the flattened sole-station case (D1) and an
     ordinary station's card. The sole-station flatten (D1) touches `BlockCard`'s own body — the
     "Stations · 1" head and its numbered card come out of the render path when `stationCount ===
     1`, folding the station's fields into the block's own lines. **D4's modal is new**: it needs
     the same dialog floor stage 2 already uses (`useDialogFloor`) plus a stepper that moves
     between the block's own `stations` array — build it as its own small component, not a
     variant of the existing sheets, since its close/step semantics differ (Escape closes it the
     same way, but the stepper's prev/next are a new interaction with wrap-at-the-ends behaviour
     to decide — check the fundraiser drive drawer's own stepper for the precedent before
     inventing a new one).
   - `lib/rep-practice-plan.ts` — `computeRotation` and `drawGroups` are **unchanged** (D5, D6:
     same arithmetic, re-laid and re-oriented, not recomputed); `sanitizeBlock`'s
     `if (stations.length > 0) delete block.playerIds;` (around line 387) is the ONE silent delete
     D8 turns into a move — mirror the kit-move pattern (stage 2, D11) exactly: idempotent, a
     second pass finds nothing to move, the block's players land on the first station (or become
     the first draw's pool if rotating is on). `resolveStationTeaching` — confirm it already
     covers what D1's flatten needs (it answers the run screen's "single station IS the block"
     question today; D1 asks the same of the editor).
   - `components/coaches/useDialogFloor.ts` — the floor the new station modal adopts; read its
     header (stacked overlays, `escapeOwnership.ts`, the busy gate) before wiring a sixth sheet
     onto this page's shared floor.
   - `components/coaches/PracticeTagPicker.tsx` — the picker a station's Equipment and Staff
     fields mount (same one the block's own doors use); confirm the modal's layout doesn't need a
     new picker shape.
   - `app/[orgSlug]/coaches/coaches.module.css` — the `.ppStn*` / rotation-panel rules; a new
     `.ppStationModal*` (or equivalent) family for D4. ⚠ Shared, heavily-edited file — check
     `git status` before you start; stage by hunk if a peer has uncommitted work here.
   - `app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/run/page.tsx` and
     `_PracticeStationView.tsx` — readers only; confirm §6's "not this stage" line holds (the run
     screen's own station view is stage 5's) and nothing here needs to change just because the
     editor's station shape did.
   - `lib/export/pdf.ts` — read `buildPracticeRunSheetDoc` only to confirm the rotation grid's
     printed shape is untouched (D6 changes the SCREEN's orientation, not the sheet's — check this
     explicitly, it is the one place "the same cells, turned" could accidentally leak into print).
   - Guards and gates: `tests/unit/rep-practice-plan.test.ts` (extend for the people-move rule and
     any `computeRotation`/`drawGroups` call-shape changes from D5/D6's re-lay), `scripts/
     layout-screens.mjs` (the plan page's interaction step needs to also open a STATION, not just
     a block, to reach the new modal), `scripts/.layout-baseline.json` (`--prune --only=` the
     affected screens only), `tests/uat/scenarios/practice-plan-save.spec.ts`.
   - Help: `lib/help-content/coaches.tsx` — the Practice plans article's stations paragraph and
     rotation paragraph need the modal + stepper described; the "one field, one per line" coaching
     points language (already updated for the block, §190) extends to the station and the drill
     library. Run `/docs` after the build.

## 2. Step zero

Stage 2 (including the §190 walk's nine revisions) is **already committed** (`d52085a2`,
2026-09-15) — there is no prior-stage commit to do first this time. Confirm `git status` matches
that before you start; if it doesn't, stop and reconcile rather than building on an unexpected
base.

## 3. The eight, as ruled (one line each — §6.0 and the tab are the full text)

- **D1** A block with exactly one station flattens into the block — no head, no numbered card, no
  second trash. A second station un-flattens it.
- **D2** Stations as columns on desktop (name · who runs it · tonight's note · first line), rows on
  a phone; three columns ≈230px, four ≈170px on the 816px sheet; five+ wrap to a second row.
- **D3** The rotation is ONE line: a pressed "Groups rotate" chip, *every N min* once, the computed
  rounds stated honestly, and the draw — between the block's words and the columns.
- **D4 — REVISED** A station opens as a **modal**, not an inline-widening column. Footer stepper:
  "‹ N of M stations · Next station's name ›" — the fundraiser drive drawer's own pattern, reused.
  Read §6.4 before writing a line of this one.
- **D5** The draw is ONE control — count, pool, button, together; press again to re-draw.
- **D6** The grid's columns are the station columns (rounds as rows); a station's "Starts with" is
  the grid's own first row, not repeated.
- **D7** Coaching points on a station and in the drill library become one field, one per line.
- **D8** A block's people MOVE onto its first station when one arrives, the same as kit already
  does (stage 2, D11) — never the silent delete that runs today.

## 4. Rules that bite (from the code, not from plans)

- **D4 is a genuine mid-review reversal, not a refinement.** The artifact's own marker 40 (the
  original draw) is left in place and relabelled "superseded" rather than deleted — that is
  deliberate, so the record shows what changed. Do not build marker 40's shape.
- **The people-move rule is the kit-move rule, one field over.** `sanitizeBlock`'s
  `delete block.playerIds` (≈line 387) becomes a move exactly the way kit's did at stage 2 — same
  idempotency requirement, same "never vanishes" guarantee. Do not invent a second pattern.
- **`computeRotation` and `drawGroups` are untouched.** D5 and D6 are presentation — one control
  instead of three, one grid orientation instead of another — not new arithmetic. If either change
  seems to need the pure functions to change shape, that is a sign the presentation change has
  drifted into a model change; stop and re-read §6.3's "rides" line for that decision.
- **The stepper is not a new modal pattern — it is the second use of an existing one.** Before
  designing its interaction from scratch, read how the fundraiser drive drawer's own prev/next
  control behaves (wrap-around at the ends, what's disabled vs. hidden at an edge) and match it
  unless there's a concrete reason a station's stepper needs to differ.
- **One spelling.** "Coaching points", "What you're watching for", "Starts with", "Groups rotate" —
  `check:spelling` runs on the editor. Grep for a variant before adding a word.
- **Nothing on the run screen, the printed sheet, the drill library's own rows, or the docked panel
  changes.** If a change there seems necessary, it is a question, not a stage-3 build item.

## 5. Process gates (blocking, in order)

1. **PM UX summary in chat before code** — what a coach sees and does differently, per decision, in
   the owner's voice (no file paths). Say explicitly that D4 is being built as revised, not as
   originally drawn, and why in one sentence.
2. **Step zero confirmed** (§2).
3. **Build to the frames** — including the D4 revision's frame, not the superseded one. Measure the
   built modal and station columns against §6's description and report the real numbers.
4. **`/simplify`** (the people-move pass and the kit-move pass at stage 2 are now near-identical —
   a real candidate for one shared helper; check before writing a second copy), then **`/review`**
   (the sanitiser's people-move rule and the new modal's dialog-floor wiring are the high-risk
   surfaces; at least 3 lenses), then **`/docs`**.
5. **Gates:** `npm run verify:changed` · `npm run typecheck` · the unit suite (the people-move
   rule, any `computeRotation`/`drawGroups` shape changes) · `npm run check:layout --
   only=coach-practice-plan,coach-development-template` **with an open-station interaction step
   added to the sweep** (the new modal is a surface this page's layout check has not measured
   before) at 1440 · 768 · 390 · `check:demos`. Report anything skipped and why.
6. **QA walk as a tab on the same artifact** — "QA walk · 3": the sole-station flatten and
   un-flatten; the columns at three widths; the rotation strip's honest-arithmetic statements; the
   draw and re-draw; **the modal — open, step forward, step back, step past both ends, Escape,
   focus return**; the grid's new orientation read against the printed sheet's (unchanged)
   orientation; people moving onto a station (both the written-first-station and rotating cases).
   Ledger section at the **next free § at the tail** of `OWNER_QA_LEDGER.md` (check for a peer's
   uncommitted entry first — never re-sort).
7. **Commit only on the owner's word**, on `dev`, explicit pathspecs, private index if peers have
   staged work, `git show --stat HEAD` after. Update memory
   (`project_coach_practices_reevaluation`) and plan §6.7 (the build record, currently a stub
   pointing at this file).

## 6. Fixture, and how to look

Same fixture as stage 2 — UAT Test Team, UAT probe practice's **Skills circuit** block (three
stations rotating every 15 min: Footwork ladder / Close control / Finishing) is the one this
stage's frames were drawn from. The dev server is shared; `npm run dev` only; restart after new
files or shared-module changes; do not launch a full `check:layout` sweep against a server someone
else is using — scope with `--only=`.

## 7. Do not

- Do not build D4 as the frame originally drawn (the widening inline column) — that shape is
  superseded; build the modal with the stepper.
- Do not touch the run screen's station view, the printed sheet's rotation grid, the drill
  library's rows or its docked panel, or drag (all later stages).
- Do not soften the drill rule (D20), add a migration, bump the plan version, or rename a stored
  key — nothing in §6 asks for a shape change to the plan JSON.
- Do not change `computeRotation`'s or `drawGroups`' actual arithmetic — D5/D6 are presentation.
- Do not commit without the owner's word; do not `git stash`; do not `git add -A`.
