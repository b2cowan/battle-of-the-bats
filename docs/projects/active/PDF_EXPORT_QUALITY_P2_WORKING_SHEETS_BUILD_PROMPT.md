# Session prompt — PDF Export Quality, Phase 2: the WORKING SHEETS pass

**A BUILD session. Open in a fresh chat. Written 2026-08-23, after the Rosters pass shipped
(committed `201d9b6b`, dev; Owner QA Ledger §86).**

This is **pass 4 of 6**. Phase 2 works the six document groups one pass per session; this prompt is
the **Working sheets** group only — the **practice sheet** and the **tryout check-in sheet**. The
remaining two (Schedules, Posters/cards/brackets) each get their own prompt after this pass has
owner sign-off. **Do not reach into them on the way past.**

**⚠ This group's definition of good is *"works in a coach's hand, in weather"*.** Not "survives
being emailed" (Registers), not "the club's face" (Statements), not "safe pinned to a wall"
(Rosters). These two documents are **used while something is happening** — one on a field at
6pm with a whistle in the other hand, one on a table while thirty families arrive at once. They are
read in glances, in bad light, possibly damp. Density, ordering and what falls where the thumb
goes matter more here than elegance.

**⚠⚠ This pass is different from the three before it in one important way: the practice sheet's
form is ALREADY DECIDED and its spec is approved.** You are not choosing a structure — you are
building one the owner picked from rendered exhibits on 2026-08-22. Checkpoint 1 for this pass is
therefore much smaller than the last three, and is mostly about the CHECK-IN sheet plus the handful
of judgement calls the run-sheet spec deliberately left open.

**Read first, in order:**
1. **`docs/projects/active/PRACTICE_SHEET_STRUCTURE_PLAN.md`** — the approved run-sheet spec, and
   **the gallery it links is the visual spec** (candidate A). Read the rejected candidates too; the
   owner has already said no to station cards and the glance strip, and re-proposing either is a
   waste of a checkpoint. ⚠ **The plan's §2 build note matters:** the mockup hard-coded the
   rotation→block association; the real build associates a rotation with the block it was
   configured on.
2. `docs/projects/active/PDF_EXPORT_QUALITY_PLAN.md` — §2 decisions (esp. 3, 5, 9), the §4 Working
   sheets bullet, §5 rejected-on-purpose.
3. Owner QA Ledger **§79** (what Phase 1 guarantees), **§82** (engine rules), **§84** (drawn-document
   plumbing + the shared logo slot), **§86** (the newest engine rules and the lessons below).
4. Auto-memory `project-pdf-export-quality` and `reference-pdf-exhibit-harness`.
5. The built galleries — Registers, Statements, Rosters — linked from the plan and the ledger.

---

## The owner's standing method for every Phase 2 pass (unchanged, four passes running)

**Each document is judged one at a time, on rendered paper**, with **two owner checkpoints**:

- **Before code:** a short PM-language summary of what changes per document, plus **rendered
  options** for anything without an approved visual. **Every decision arrives with a marked
  recommendation and the honest case against it**, presented as a short list of questions the owner
  can answer one by one, each option carrying what the coach actually sees differently — not
  engineering trade-offs. A decision list without a recommendation is not checkpoint-ready; neither
  is a recommendation whose alternatives were strawmanned.
  - **⚠ The practice sheet's STRUCTURE is not a checkpoint-1 question.** It is decided. Bring only
    what the spec genuinely leaves open (see scope §1) — and if building it reveals the spec is
    wrong about something, say so plainly rather than quietly deviating.
- **Before "done":** re-render every document this pass touched through the real code and present
  before/after as an artifact gallery, per document.

**The eye on the PNG is the acceptance test.** Across four passes it has caught every defect that
every static gate and the whole unit-test suite missed — including three that the approved mockups
themselves missed, found only when the real code rendered them.

---

## Scope — Working sheets, nothing else

### 1 · BUILD the practice run sheet (decision 9, spec approved 2026-08-22)

Build to `PRACTICE_SHEET_STRUCTURE_PLAN.md` §2 and its gallery. The sheet **leaves the table
engine** for a drawn layout (the tryout board summary and the family dues statement are the two
in-repo precedents) but **stays on the shared identity / footer / page-count plumbing** — team-layer
identity with team-name fallback, true page totals, the shared aspect-fit logo slot. **No second
print pipeline, and not a renderer fork of the table engine** (plan §5 still forbids that).

**What the spec leaves genuinely open — these are your checkpoint-1 questions:**
- **A rotation with no owning block.** The spec says fall back to "after the timeline". Render it
  and check that reads sensibly, or propose better.
- **The heavy night's page break.** The spec says blocks are atomic and a sentence never splits.
  Decide what a block that is *itself* taller than a page does — it cannot move whole to a page it
  still won't fit. Render the pathological case; do not discover it in production.
- **The compact identity header on continuation pages** ("Practice plan — {date} (continued)") —
  §86 made continuation-page identity universal for TABLE documents. Decide whether this drawn
  sheet uses that same band or its own line, and make sure it does not end up with both.

**Constraints that are not open:** vocabulary is **PLANNED, never DONE** — no tick box, no blank
"did it" column, no wording implying anything happened. The sheet is **hand-carried, never a
shareable link** (it names children beside a date, a time and an address). "What everyone's working
on" prints only when focus areas exist — **absent, not redacted-looking**.

### 2 · The check-in sheet — verified in code, and it is worse than the plan says

The plan's one-line summary is "branded + tick-box column widened". Reading the actual builder
(`components/rep-teams/TryoutCheckIn.tsx`, `printSheet`) it is a longer list, and **you should
verify every item below yourself rather than trust this prompt**:

- **It passes NO settings at all** to the renderer — so it falls back to defaults: no club logo, no
  accent, no footer. It is the **only document in the product that has never fetched branding**
  (its comment says "org-branded settings are a later polish").
- **It passes NO identity either** — so Phase 1's D1 layered identity never reaches it and the
  header band has **no name on it whatsoever**. This is the first paper a trying-out family ever
  sees, and it does not say which club produced it.
- **It passes NO subtitle** — so the sheet carries **no session, no date and no location**. Two
  tryout sessions on one weekend print identical paper.
- **The tick-box column is the narrowest on the sheet.** The heading is `In` — two characters — so
  the fit contract's measured floor gives it almost nothing, while `Notes` (five characters, and
  always empty) gets more. The column a volunteer actually marks is the hardest one to mark.
- **It declares no shape**, so it inherits the org-wide orientation default.
- **It is absent from the export catalog entirely.** Decide whether it belongs there (it is a
  printed document a customer produces) and add it if so.
- It is **blind-evaluation aware** (`isAnonymous` drops the Player column). Whatever you change must
  keep working in both states — and the blind sheet is the one most likely to need the bib number
  large.

⚠ **This component is `embedded` in the Tryouts one-room page (§81, built 2026-08-23).** Re-read
that ledger entry before touching it, and check `git log`/`git diff` for concurrent work on the
tryouts surface.

### 3 · Resolve the practice sheet's compact regression guard — it is YOURS

The practice sheet declares `density: 'compact'` as a **regression guard, not a design**: §82's
heading fix cost a renamed rotation group a whole station column, and compact restored the exact
column count. The guard's own comment points at the run-sheet spec and says so. **When the run sheet
ships, that guard goes with it** — the rotation grids live inside their owning blocks now and set
their own widths. Do not leave a leftover.

### 4 · Verify identity defaults on both, on paper

Practice sheet on team paper (default / inherited club look / team's own look); check-in sheet on
whatever layer you decide it belongs to — **decide that deliberately**: it is produced inside a
coach's portal but a club runs the tryout, and the Rosters pass showed that "which layer" is a real
question with a real answer. Note the confirmation in the ledger entry the way §82, §84 and §86 did.

**Out of scope:** the schedule · posters, cards and brackets (including the bracket's own squashed
logo draw and its vertical centring — that group's fix) · the Phase 3 CI check (leave the harness
productionisable) · anything about rosters, dues or registers (shipped: §82, §84, §86).

## Engine rules you now inherit (§82 + §84 + §86)

- **A column heading is measured in the BOLD face it prints in, and is never capped.** If the floors
  cannot fit, a whole column yields and the document says so. A heading broken mid-word is a bug.
- **A fixed-column report must fit by construction** — the "didn't fit this page" line is reserved
  for customer-shaped tables. Seeing it on a fixed-column report is a bug. ⚠ A rotation grid's
  headings ARE customer-shaped (they are the coach's own group names) — that is exactly what bit
  the practice sheet in §82.
- **Cells may wrap at a space; headings may not shred.** A phone number wrapping at its own space
  was reviewed and accepted in §86 — do not "fix" that class by widening the floor rule, which
  would move column widths on every table in the product.
- **`drawLogoSlot` is the ONE aspect-fit crest helper.** A drawn document must not reinvent the
  slot. The board summary and the family statement both draw through it; so must the run sheet.
- **Continuation pages carry the identity band** — §86 made this universal for the table engine via
  a per-page hook plus a reserved top margin. **A drawn document does its own paging**, so the run
  sheet must handle this itself. §84's family statement is the worked example.
- **The scanner flags the family-statements batch file `FOOTER✗` BY DESIGN** — page numbers restart
  per family on purpose. It is the one expected red line in a full-corpus scan; do not "fix" it, and
  do not let it mask a real footer failure on YOUR documents.

## Lessons from §86 that will save you a defect

- ⚠⚠ **A guarantee checked only on the first rendered page is not checked.** Phase 1's "every PDF
  knows whose paper it is" was true of page 1 and false of every page after it, on every
  multi-page document in the product, for months. **Render page 2. Always.**
- ⚠ **Adding an export to a screen re-severities every pre-existing race on that screen.** A stale
  load is a flicker until it is persisted to a file, at which point it is a wrong document with the
  right title. The check-in sheet sits inside a LIVE, polling, mid-tryout surface — audit what
  feeds `candidates` before you widen what the sheet prints.
- ⚠ **Test a promise against the PRODUCTION value or not at all.** A privacy assertion checking the
  test's own copy of a column list passed while production could have regressed freely. If this
  pass makes a promise ("no tick box", "never DONE vocabulary"), assert it against the real thing.
- ⚠ **Prove any shared-engine change is free by diffing full-corpus scans** — render the whole
  corpus with `HEAD`'s renderer and with yours and diff the scanner output. §86 did this and got a
  byte-identical result, which is the only reason a change touching every document was safe to ship.

## Build notes that will save you time

- The exhibit harness lives in the Rosters session's scratchpad `gen-pdfs/` (session
  `4be2c1e2-dbda-4d2b-9b86-967b87692edb`) — copy it forward. `gen.mjs` renders the current corpus,
  `after-rosters.mjs` shows the shape of a checkpoint-2 script, `drafts-rosters.mjs` the shape of a
  checkpoint-1 option script, `render-browser.mjs` rasterizes in Chromium, and **`scan.mjs` +
  `scan-viewer.html` read the finished PDFs back as text**. ⚠ Copying the harness means copying
  `pdfjs-dist/build/{pdf,pdf.worker}.mjs` with it.
- **The run sheet's own dimensional reference** is the planning session's `practice-sheet/candidates.mjs`
  (candidate A), named in the structure plan §4.
- Keep every fixture fictional (the Riverdale worlds). Stock-logo SVGs stroke white.
- Node ≥23 + the harness's resolver hooks run the repo's TS renderers headless; jsPDF must resolve
  to the browser build (the hooks do this — don't fight it).

## Verification & process

- AGENCY_RULES in full: PM summary before code · `dev` branch · explicit pathspecs · no commit
  without the owner's OK.
- ⚠⚠ **Other sessions share this working copy, and it bit the Rosters pass TWICE at commit time.**
  A concurrent session took **§87** in the ledger *while that pass was writing §86*, and its first
  staging attempt swept §87 into the commit; and two strategy files held a prior session's
  uncommitted 2026-08-21 work that had to be excluded line by line. **Build the index version of
  every shared file explicitly (HEAD + only your block), stage that, then restore the working
  copy** — and run `git show --stat HEAD` after committing to confirm only your files landed.
  **Re-check what §number the ledger actually ends on at write time** (§88 or later).
- Bracket-path directories (`[orgSlug]`, `[teamId]`) stage NOTHING via plain glob pathspecs — use
  `:(literal)` magic.
- `npm run verify:changed` (schema parity is RED for pre-existing dev-only migrations — not yours
  unless you add one); `npm run typecheck`; extend `tests/unit/pdf-export-contract.test.ts` where
  the contract grows. `check:layout --changed` needs a dev server and **scopes with `--only=<id>`
  (with the `=`)** — it widens to all ~59 screens when a shared stylesheet is touched by anyone,
  and an aborted sweep is a FAILURE, not a pass. Attribute before you fix.
- **Help-docs sync (`/docs`)** — the exports guide's availability table and the practice-plan and
  tryout guides describe whatever ships; grep every format list.
- **Ask the demo question (CLAUDE.md) and record the decision either way.** §82, §84 and §86 all
  answered "no moment owed" because the sandbox narration never mentions exports. ⚠ **This pass is
  the closest yet to the demo's story** — the coach sandbox has practice plans, and a coach printing
  the night's run sheet is a plausible beat. **Actually look at the dock lines and tour steps; do
  not inherit the previous answer.**
- Owner QA Ledger entry · TODO.md stays high-level · update the PDF plan AND the PM brief AND
  `PRACTICE_SHEET_STRUCTURE_PLAN.md` (mark it built) in the same unit of work.
- Offer `/review` when the code is done. It has earned its cost four passes running — it caught a
  cross-team PII leak in the Rosters pass that every gate and the whole test suite missed.

## Found while writing this prompt — NOT yours, decide whether to carry it

The **Tournament Registrations** catalog entry still says *"(PDF coming in Phase F3)"* in its help
summary while its `formats` already includes `pdf` and the document demonstrably ships. That is a
Registers-group document, so it is not this pass's — but it is the same class of stale claim this
whole programme exists to kill. Fix it in passing or log it; do not let it evaporate.

## What done looks like (owner-visible)

A coach can print the night's plan and actually run practice from it — times down the side, their
own sentences at full width instead of chopped into a ribbon, each rotation grid sitting inside the
block it belongs to with its group lists underneath, and nothing on the page implying the practice
already happened. A club's first piece of paper to a trying-out family carries the club's name, its
crest and the date of the session, and the box a volunteer ticks is the easiest box on the sheet.
Both documents have been looked at in every identity state, on a typical night and a heavy one,
side by side with what they printed before, and signed off one at a time.
