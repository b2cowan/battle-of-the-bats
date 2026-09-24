# Prompt — Practice plans on a phone · Stage 2 design phase (stations inside a block)

> Paste everything below the line into a fresh Claude Code session on `dev`. Written 2026-09-24 at the
> close of the §227 walk. **Design only: no product code until the owner rules.**

---

You are picking up **stage 2 of "Practice plans on a phone"**: the DESIGN phase for **stations inside a
block** on a phone. Your deliverable is a set of true-size drawings and a short list of decisions for the
owner to rule on. You do not build anything in this session.

## Read first (in this order, and only these)

1. `docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PLAN.md`: §2 findings (station D), §5 the stage
   ladder (row 2), §6.6 and §6b (what the §227 walk changed), §6c (the Groups room, ruled G1–G3 = A; another
   session is building it now), §6d (the rotation table, BUILT and walked as §229, so it's not yours).
2. The project hub, one artifact for the whole project: https://claude.ai/artifact/73DbeziBqDjMr4QEhRWTvp
   (source `docs/projects/active/COACH_PRACTICE_PLANS_PHONE_HUB.html`). Read the tabs "What the walk
   found", "1b · Read first, edit on purpose" and "QA walk · 1", and match the visual identity of the stage
   1 and 1b drawings.
3. `docs/projects/active/OWNER_QA_LEDGER.md` §227 and §229 (both walked and passed 2026-09-24).
4. The editor: `app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx`. Read the station
   parts: the station columns/rows inside an open block, `StationModal`, the "Add a station" sheet
   (`DrillSheet` and its "Write one" tab), and the station reorder controls.

## What stage 2 is about (the finding it answers)

Measured 2026-09-23 at 390×844, inside the block's own screen:
- Each station is a **115–138px card** with its own ◀ ▶ reorder pair and an "Open ›" link.
- "+ Add a station / a drill, or write one" wraps to **67px**.
- **A new station's first field is four taps in.** "+ Add a station" → the "Write one" tab → a **31px** lime
  "Write a station" button that **adds a blank station card and opens nothing** → that card's "Open ›".

The station **form** itself already fits a phone. Since the walk it shares one layout with the block
sheet: the header reads ← · "Station 1 of 3 · Skills circuit" · 🗑 · ✎/✓, the name comes first, and the
foot is ‹ 1 of 3 › and Done. Keep it.

## Rulings made during the walk that stage 2 must build ON, not reopen

- **Read first, edit on purpose (1b, R1–R5 = A).** A plan opens to read for everyone. Edit/Done editing
  sits on the toolbar, and ✎/✓ sits on every block and station screen. So every station drawing needs a
  **reading** face and an **editing** face.
- **One layout for a block and a station**, with glyphs only on a phone and no borders on header glyphs.
- **Reordering blocks = a ⠿ grip under the start time at every width**: drag it to a gap, or tap/click it for
  a Move up · Move down menu. The computer's ▲▼ pair was retired (owner, 2026-09-24). **Stations still
  use ◀ ▶ arrows.** Whether stations follow the grip is a decision you must put to the owner, with a
  recommendation.
- **Every delete asks first** (a block and a station; phone and computer), because a delete autosaves
  with no undo.
- **Fields are paper-tone on a white screen** (the portal convention on the warm theme).
- **The next stop is named in full at the end of a screen** (a "Next station" row); the foot is compact.
- Standing rulings (plan §4) are not reopened: "+ Stations makes two", drag as an addition with buttons
  everywhere, the rotation grid as a starting point.

## What to produce

1. **Measure before drawing.** Write a Playwright probe in the gitignored `.probe/` folder (never
   `test-results/`; a plain `npm test` wipes it), signed in with `tests/uat/.auth/coach.json`, at
   **390×844 and 360×780**. Target the UAT probe practice (see the probes already in `.probe/`, e.g.
   `pp-1b.mjs`, for the URL and selectors). ⚠ The plan **opens to read**: press the toolbar's Edit
   (`data-testid="edit-the-plan"`) before measuring any editing screen. ⚠ The plan **autosaves ~0.9s
   after a change**: if a probe adds anything, wait for "Saved", undo it, reload and re-count before
   reporting. The fixture is shared with the owner's own walks. Record: each station row's height, the
   add-a-station path tap by tap, the reorder controls' sizes, and the read face.
2. **Draw on the SAME hub**, as a new tab "2 · Stations inside a block". True size (390px frames that do
   not reflow), a **whole-screen before/after** of the block's screen with its stations, the add-a-station
   path as a sequence, reading and editing faces, and every annotation clickable. Red dots mark measured
   problems, green dots mark what the drawing answers.
3. **Decisions**, each with options, a recommendation and its tradeoff, plus a paste-back box. At minimum:
   - **S1 · the station row.** What a station reads as inside the block (e.g. one 56px row: name · who runs
     it · tonight's note, the whole row opening the form), reading and editing.
   - **S2 · adding a station.** "Write one" creates the station and opens its form in one motion (four
     taps → two); where the drill path sits.
   - **S3 · reordering stations.** Stay with ◀ ▶, or adopt the block's grip + menu. The owner has
     consistently asked for one pattern everywhere, but argue it on its merits.
   - Anything the measurement shows that this list misses: say so, don't force-fit.
4. **Update the plan** (a stage 2 section with measurements and the decisions) and the **PM brief**.

## Working rules for this owner

- **Push back out loud** when a premise is wrong, and argue from what the code does, not from what a plan
  says. Don't manufacture disagreement.
- **Product-owner voice** in every reply: what a coach sees and does differently, and the tradeoffs.
  Keep file paths and code out of the chat. They belong in the plan.
- **The hub is shared with other sessions.** Before every publish, read the live version, merge, then
  publish from your file. Never overwrite a newer version.
- **Stage only your own files**, on `dev`, in a private index. Other sessions have uncommitted work in
  the same working copy (the stylesheet, the ledger, the help content). Don't commit without the owner's
  say-so.
- **Don't launch a full layout sweep.** The owner tests on the shared dev server. Scope it with
  `--only=` (with the equals sign).
- **No code** until the owner pastes back the rulings.
