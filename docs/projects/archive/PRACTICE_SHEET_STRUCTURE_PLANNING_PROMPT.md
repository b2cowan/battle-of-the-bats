# Session prompt — the practice sheet's structure

**A PLANNING session. Owner-called 2026-08-21, split out of the PDF deep dive. Open in a fresh chat.**

You are not restyling a document in this session. You are deciding, with the owner, **what shape a
printed practice plan should be** — and the table it currently is has already been judged wrong.

**Read first:** `PDF_EXPORT_QUALITY_PLAN.md` — decision 9 is this session's charter, and decisions
3/7/8 (per-report shape, two-layer branding) are settled context this session inherits, not
questions to reopen. The evidence gallery linked at the top of that plan shows the current sheet as
exhibit; the session that produced it archived its method at
`docs/projects/archive/PDF_EXPORT_QUALITY_PLANNING_PROMPT.md` — reuse the method: **rendered pages,
not descriptions; the owner picks from things they can look at.**

---

## 1 · The owner's ruling that opened this

> *"I don't like the chart form as there are a lot of sentences, point form notes, etc. in a
> practice plan and logging these charts removes and disorients a lot of that data."* — 2026-08-21

That is the whole problem statement. A practice plan is the one document whose payload is mostly
**prose**: block notes ("Live reads off front toss — start runners on first, contact swings only"),
station instructions, the rotation's honest-arithmetic sentences ("Group C won't reach Live BP
tonight"), per-player focus areas. The current sheet pours all of it into the shared report table,
which chops sentences into cells, imposes a grid rhythm on content that reads top-to-bottom like a
run sheet, and makes the notes — the part the coach actually wrote — the hardest part to read.

## 2 · What a practice plan actually contains (inventory, from the code)

Two line-item kinds and five sections; note which are genuinely tabular and which are prose:

- **The header facts** — team, date, start/arrive times, location, goal, practice types, equipment.
  One dense line + short lists. Not a table.
- **The blocks** — time, title, duration, staff, players, **and a notes sentence per block**. This
  is a *run sheet*: the spine is chronological, the notes are the content.
- **The rotations** — a groups × rounds grid **plus its plain statements**. ⚠ The grid part is
  genuinely a grid — the failure mode is everything *around* it becoming one too.
- **The groups** — who is in Group A/B/C. A list.
- **Focus areas** — player → prose. Printed only when the person generating can see focus areas; an
  assistant without that grant gets the section **absent, not redacted-looking** (standing rule).

## 3 · Constraints that BIND (do not relitigate)

- **The vocabulary is PLANNED, never DONE.** Nothing on the sheet — no tick box, no blank "did it"
  column, no wording — may suggest anything happened. Easiest to breach on paper; it survives any
  redesign.
- **Hand-carried, never a shareable link.** The sheet names children beside a date, a start time
  and a street address.
- **Two readers:** the head coach running the night, and an assistant running ONE station who must
  find *their* piece at a glance, outdoors, possibly in weather.
- **Identity and footer come from the shared plumbing** (PDF plan decisions 7/8 — team look, true
  page counts). This session owns **form**, not branding.
- The sheet **may leave the table engine** for a drawn layout — the tryout board summary is the
  in-repo precedent that a drawn one-pager can be the product's best document.

## 4 · Method

1. Generate the **current** sheet with a deliberately content-heavy fixture — long block notes,
   two rotations, six focus areas — so the failure the owner named is visible, not asserted. (The
   rendering harness from the PDF session is documented in auto-memory `reference_pdf_exhibit_harness`.)
2. Design **two or three competing structures** and render them as real pages. Candidates to
   explore, not conclusions: a **run-sheet spine** (timeline down the left, prose blocks beside
   it); **station cards** (one card per block, notes intact, cuttable); a **hybrid** (compact
   schedule strip up top, prose sections beneath, rotation grid kept small). Consider where the
   one-page ambition survives and where it should be allowed to break to two pages honestly.
3. Publish the exhibits as a Claude Artifact; **the owner picks from rendered pages**. The approved
   mockup becomes the spec.
4. Record the decision: a short `PRACTICE_SHEET_STRUCTURE_PLAN.md` + PM brief, a TODO line, and
   flip decision 9's hold in `PDF_EXPORT_QUALITY_PLAN.md` to point at the decided structure.

## 5 · What must not happen

- Restyling the sheet inside the generic Phase 2 passes — the hold exists so this session decides.
- A second print pipeline grown casually: if the sheet leaves the table engine, it still rides the
  shared identity/footer/page-count plumbing.
- Solving it by *shortening the prose*. The sentences are the coach's content; the layout serves
  them, never the reverse.
