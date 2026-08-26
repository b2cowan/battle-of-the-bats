# Session prompt — PDF Export Quality, Phase 2: the SCHEDULES pass

**A BUILD session. Open in a fresh chat. Written 2026-08-24, after the Working-sheets pass shipped
(Owner QA Ledger §91, its /review corrections §99).**

This is **pass 5 of 6**. Phase 2 works the six document groups one pass per session; this prompt is
the **Schedules** group. The last group (Posters, cards & brackets) gets its own prompt after this
one has owner sign-off. **Do not reach into it on the way past** — in particular the bracket's
squashed crest and its vertical centring are deliberately ITS pass's work, not yours.

**⚠ This group's definition of good is *"the whole weekend, at a glance, on a wall"*.** A schedule
is the one document in the product that a stranger reads without being handed it — pinned by a
diamond, taped to a rink door, photographed by a parent. Nobody reads it top to bottom; they hunt
for one row. Findability beats completeness.

---

## ⚠⚠ THE PLAN IS WRONG ABOUT THIS GROUP, AND I CHECKED BEFORE WRITING THIS

`PDF_EXPORT_QUALITY_PLAN.md` §4 says of Schedules: *"already the model; verify against the gallery,
nothing structural."* **That sentence is from the 2026-08-21 planning session and nobody had looked
since.** Rendered through the real exporter on 2026-08-24, the tournament schedule is indeed
structurally sound — landscape, compact, all seven columns, no shredded headings, true page totals —
**and it carries three of the exact defects other passes killed elsewhere.** Every one of the four
previous passes found the plan understated its group. Assume the same here.

**Do not open with "verify".** Open by rendering it and looking at it.

---

## What rendering it already turned up — your checkpoint-1 starting material

These are findings, not decisions. Bring each to the owner with a recommendation and the honest case
against it, per the standing method below.

1. **The Status column prints raw database words, in lower case** — `completed`, `scheduled`. Every
   other document in this programme speaks the coach's language ("Active · 11", "Offers extended").
   This is the system's vocabulary leaking onto a customer's wall.
2. **The Status column arguably repeats itself.** A schedule printed before the weekend is
   `scheduled` in every row; printed after, `completed` in every row. That is the same shape as the
   club Budget-vs-Actual's Category column, which the Registers pass DELETED because *"each section
   heading is the category"* — and the same shape as the practice sheet's "Round" column. ⚠ It is
   NOT identical: a schedule read mid-tournament genuinely mixes both, which is the case that might
   save the column. Render that case before recommending anything.
3. **No grouping, so the Date column repeats "Fri, Jul 10" fifteen times.** Every register in this
   programme groups (one division to a page, standings with counts). A day heading would kill the
   repetition and give a wall reader something to aim at. ⚠ Consider what the right grouping IS —
   by DAY is the obvious one, but a parent hunting their own team may want by DIVISION, and the
   tournament schedule already has a division column. Render both.

**⚠ And the question that is bigger than all three:**

4. **THREE schedules exist in this product and only ONE prints.** The catalog carries
   `tournament-schedule` (xlsx/csv/ics/**pdf**), `coaches-schedule` (xlsx/csv/ics), and
   `house-league-season-schedule` (xlsx/csv/ics). Plan decision 6's standing floor rule is *"a
   document that is read, handed, or pinned gets a PDF; data someone works in stays a spreadsheet"*
   — and the same decision asserts the ~20 spreadsheet-only exports "all pass this test today;
   **nothing new is owed**."
   **A coach's team season schedule, and a house-league season schedule, are the textbook case of a
   document that is pinned.** Those two sentences cannot both be right about them. Either the floor
   rule owes these a PDF, or the calendar (.ics) is the real answer for a schedule and the rule
   needs an explicit carve-out saying so. **This is the pass's headline decision. Do not settle it
   by yourself, and do not settle it from the plan — the plan is one of the two things in tension.**
   Bring rendered pages of what a coach's team schedule would look like as paper.

---

## The owner's standing method for every Phase 2 pass (unchanged, five passes running)

**Each document is judged one at a time, on rendered paper**, with **two owner checkpoints**:

- **Before code:** a short PM-language summary of what changes per document, plus **rendered
  options** for anything without an approved visual. **Every decision arrives with a marked
  recommendation and the honest case against it**, as a short list of questions the owner can answer
  one by one, each option carrying what the reader actually sees differently — never engineering
  trade-offs. A decision list without a recommendation is not checkpoint-ready; neither is a
  recommendation whose alternatives were strawmanned.
- **Before "done":** re-render every document this pass touched through the real code and present
  before/after as an artifact gallery, per document.

**⚠ The owner's copy ruling, 2026-08-24, applies to everything you write:** *"we really don't need
to overexplain everything… too much text on these screens."* It was made about a dialog and it is
general. On paper it means: a column heading is a heading, not a sentence; a legend earns its place
or comes off.

**The eye on the PNG is the acceptance test.** Across five passes it has caught every defect that
every static gate and the whole unit-test suite missed.

---

## Scope — Schedules, nothing else

**In:** the tournament schedule PDF, and the decision above about whether the coaches' and house
league schedules owe one. **Out:** posters, cards and brackets (including the bracket's squashed
logo and vertical centring — that group's fix); the Phase 3 CI check (leave the harness
productionisable); anything about registers, statements, rosters or working sheets (shipped: §82,
§84, §86, §91, §99).

⚠ **If the answer to question 4 is "yes, build them", say so at checkpoint 1 and let the owner
decide whether they belong in THIS pass or their own.** Two new documents is a pass's worth of work
on its own, and quietly absorbing them is how a scoped pass stops being scoped.

---

## Engine rules you now inherit (§82 + §84 + §86 + §91)

- **A column heading is measured in the BOLD face it prints in, and is never capped.** If the floors
  cannot fit, a whole column yields and the document says so. A heading broken mid-word is a bug.
- **A fixed-column report must fit by construction** — the "didn't fit this page" line is reserved
  for customer-shaped tables. Seeing it on a fixed-column report is a bug. The tournament schedule
  is FIXED-COLUMN.
- **Cells may wrap at a space; headings may not shred.** Do not "fix" a wrapping cell by widening
  the floor rule — it moves column widths on every table in the product.
- **`drawLogoSlot` is the ONE aspect-fit crest helper**, and **`drawIdentityBand` is the ONE header
  band** (extracted in §91; the table engine and all three drawn documents share it). A new document
  must not reinvent either.
- **Continuation pages carry the identity band** — universal for the table engine via a per-page
  hook plus a reserved top margin. A DRAWN document does its own; §84's family statement and §91's
  run sheet are the worked examples.
- **A report may declare `penColumns`** — columns the reader fills in by hand print an empty box
  (§91). Opt-in; it does nothing for a document that does not ask.
- **The scanner flags the family-statements batch file `FOOTER✗` BY DESIGN** — page numbers restart
  per family. It is the one expected red line in a full-corpus scan; do not "fix" it, and do not let
  it mask a real footer failure on YOUR documents.

## Lessons from §91 and its /review (§99) that will save you a defect

- ⚠⚠ **AN EXHIBIT BUILT FROM A FIXTURE YOU WROTE IS EVIDENCE ABOUT YOUR FIXTURE.** The run sheet's
  checkpoint galleries used hand-written times like "6:00"; production formats "6:00 p.m.–6:10 p.m."
  and the clock ran straight through the block title. Found only by seeding a REAL practice and
  printing it. **Seed real data into the QA lab and print that.**
- ⚠⚠ **A TEST THAT CANNOT FAIL IS NOT COVERAGE.** Two regression tests written for §99 passed with
  the bugs reintroduced, because the test double splits on newlines and never wraps. Verify a new
  test by breaking production and watching it go red — every time.
- ⚠ **Measure and draw must share one source.** The run sheet's page-overflow defect was two copies
  of the same arithmetic disagreeing.
- ⚠ **Adding an export to a screen re-severities every pre-existing race on that screen** — and
  closing the obvious door is not enough: §99 found a second one where an in-flight request from the
  previous team re-opened a dialog after the reset. Sequence-token anything that produces a file.
- ⚠ **Prove any shared-engine change is free by diffing full-corpus scans** — render the whole
  corpus with `HEAD`'s renderer and with yours and diff the scanner output. §86 and §91 both did
  this and got identical results, which is the only reason a change touching every document shipped.

## Build notes that will save you time

- The exhibit harness lives in the Working-sheets session's scratchpad `gen-pdfs/` (session
  `6ce7a6d2-4734-410e-869c-2dcd8cb78150`) — copy it forward. `gen.mjs` renders the current corpus
  (its section 02 is the tournament schedule), `after-working.mjs` shows the shape of a
  checkpoint-2 script, `render-browser.mjs` rasterizes in Chromium, `build-artifact.mjs` inlines
  PNGs into a gallery, and **`scan.mjs` + `scan-viewer.html` read finished PDFs back as text**.
  ⚠ Copying the harness means copying `pdfjs-dist/build/{pdf,pdf.worker}.mjs` with it.
- `qa-fixture-check.mjs` in the same folder shows how to render REAL seeded data through the repo's
  own helpers — that pattern is what caught the two §91 defects the hand-written exhibits missed.
- `node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs --practice` seeds the QA lab
  (`qa-money-lab`, team **QA Money U13**). There is no schedule fixture yet — **add one**, and make
  it adversarial: a tournament spanning a month boundary, a division with one game, a game with no
  time yet, long team names.
- Keep every fixture fictional (the Riverdale worlds). Stock-logo SVGs stroke white.
- Node ≥23 + the harness's resolver hooks run the repo's TS renderers headless; jsPDF must resolve
  to the browser build (the hooks do this — don't fight it).

## Verification & process

- AGENCY_RULES in full: PM summary before code · `dev` branch · explicit pathspecs · **no commit
  without the owner's explicit OK**.
- ⚠⚠ **OTHER SESSIONS SHARE THIS WORKING COPY, AND ON 2026-08-24 IT COST REAL TIME.** A concurrent
  session **committed this pass's work without being asked and rewrote history to do it**, folding
  it across two commits; the Owner QA Ledger collided on section numbers **five times** in one day;
  and `npm run typecheck` was red for an hour from another session's mid-edit file. **Check
  `git log` and `git status` before you start and again before you commit, build the index version
  of every shared file explicitly (HEAD + only your block), and run `git show --stat HEAD` after
  committing.** Re-check what §number the ledger actually ends on AT WRITE TIME — it was §99 when
  this was written and it will not be by the time you finish.
- Bracket-path directories (`[orgSlug]`, `[teamId]`) stage NOTHING via plain glob pathspecs — use
  `:(literal)` magic. The same applies to `git log`/`git status` on those paths.
- `npm run verify:changed` (schema parity is RED for pre-existing dev-only migrations — not yours
  unless you add one); `npm run typecheck`; extend `tests/unit/pdf-export-contract.test.ts` where
  the contract grows. `check:layout --changed` needs a dev server and **scopes with `--only=<id>`
  (with the `=`)**; a shared stylesheet widens it to all 59 screens, and an aborted sweep is a
  FAILURE, not a pass. Attribute before you fix.
- **Help-docs sync (`/docs`)** — the exports guide's availability table gained rows in §91; if the
  schedule's formats change, that table and the schedule guide both describe whatever ships.
- **Ask the demo question (CLAUDE.md) and record the decision either way.** §82, §84, §86 and §91
  all answered "no moment owed" — the coach sandbox's dock lines and tour narration never mention
  exports or printing, re-read each time rather than inherited. ⚠ **Do it again.** The tournament
  sandbox is the one with a public schedule, and this is the first pass whose document a PROSPECT
  might plausibly see.
- Owner QA Ledger entry · TODO.md stays high-level · update the PDF plan AND the PM brief in the
  same unit of work. ⚠ **Correct the plan's "already the model, nothing structural" sentence** — it
  is now known to be wrong, and leaving it is exactly the stale-claim class this programme exists
  to kill.
- Offer `/review` when the code is done. It has earned its cost five passes running — on the last
  one it found a page-overflow defect that printed a coach's roster over the footer, and a
  cross-team file race, neither of which any gate or test saw.

## What done looks like (owner-visible)

A parent standing at a diamond finds their kid's game in one look: the weekend reads as days, not as
a hundred rows with the date repeated down the side; the words on it are the words a coach would
say, not the ones the database stores; and every column on it earns its width. If a coach can pin
their own team's season on the fridge, that decision was made deliberately and out loud rather than
inherited from a sentence in a plan.
