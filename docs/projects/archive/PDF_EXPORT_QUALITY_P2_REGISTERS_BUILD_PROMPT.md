# Session prompt — PDF Export Quality, Phase 2: the REGISTERS pass

**A BUILD session. Open in a fresh chat. Written 2026-08-23, after Phase 1 shipped
(committed `d2b1e469`, dev; Owner QA Ledger §79).**

Phase 2 works through the six document groups **one pass per session, worst first** — this
prompt is the FIRST pass only: **Registers** (the documents someone reconciles against —
both of the planning session's unreadable documents lived here). The later passes
(Statements & handouts, Rosters, Working sheets, Schedules, Posters/cards/brackets) each get
their own prompt after this pass has owner sign-off. Do not reach into them on the way past.

Every structural decision is already made (owner, 2026-08-21, against rendered evidence).
**Do not re-open decisions; build them.** If the code contradicts something below, say so
before building (AGENCY_RULES: disagree out loud, before the work).

**Read first, in order:**
1. `docs/projects/active/PDF_EXPORT_QUALITY_PLAN.md` — §2 decisions (esp. 1–6), §4 Phase 2
   Registers bullet, §5 rejected-on-purpose list.
2. Owner QA Ledger **§79** — what Phase 1 already guarantees (identity, true counts, declared
   shape, the fit contract). This pass builds ON that plumbing, never around it.
3. Auto-memory `project-pdf-export-quality` — the P1 build facts that bite (the engine's
   report contract, the fit floors, where the exhibit harness lives) and
   `reference-pdf-exhibit-harness` for the headless-render gotchas.
4. The galleries: the approved "before" (planning session) and the Phase 1 "after"
   (https://claude.ai/code/artifact/364bc2d1-1d52-4406-b418-790247ca9943) — the visual
   baseline this pass improves on.

---

## The owner's standing method ruling for every Phase 2 pass (2026-08-23)

**Each document is judged one at a time, on rendered paper.** The owner asked for exactly
this: standards are shared, but every report has nuances its own data forces, so each
document in the pass is evaluated individually against the group's definition of good.
Concretely, that means this session has TWO owner checkpoints:

- **Before code:** a short PM-language summary of what changes per document (this prompt is
  most of it — confirm, don't re-plan), plus a mockup/rendered draft for anything that does
  not already have an approved visual (the two NEW register PDFs below).
- **Before "done":** re-render every document this pass touched through the real code
  (the harness) and present them as an artifact gallery — before/after per document — for
  per-document sign-off. The owner's eye on the PNG is the acceptance test; it caught
  defects in P1 that every static gate missed.

**The Registers definition of good:** *complete, reconcilable, survives being emailed to a
treasurer.* A register may run long — completeness beats one-page pretension here.

## Scope — the Registers pass, nothing else

**1 · Tournament Results — the audit-column diet (decision 5).** The PDF drops
"Submitted By / Submitted At / Submission Source" permanently — they are working data, and
they stay in the xlsx/csv exports (true up the catalog note + help copy if either implies
otherwise). With three fewer columns the report must fit landscape at the fit floors with NO
"didn't fit" note — after this diet, Results is a fixed-column report, and the standing rule
applies: **a fixed-column report showing the note is a bug.** Verify by rendering.

**2 · Coach Budget by month — the PDF button produces the CATEGORY STATEMENT (decision 4).**
The month grid stops pretending to be a PDF: the month view's PDF option renders the same
one-page category-shaped statement the category view produces (whole-season figures, the
document a treasurer actually reads); the month-by-month detail stays in the spreadsheet
formats the same menu already offers — label the menu so the coach understands the swap
(e.g. the PDF row says what it produces; never a silent substitution). Landscape-month-grid
is REJECTED on evidence (plan §5) — do not relitigate. Phase 1's drop-and-note rendering of
the month grid dies with this change.

**3 · Tryout full detail — the column diet, decided IN-PASS with the owner.** The org's
rubric is customer-shaped, so this is the one Registers document where the fit contract's
note may legitimately remain. The pass presents the owner 2–3 rendered options (e.g. current
all-categories landscape vs. a composite-plus-decision compact form vs. category initials)
and implements the pick. Decision and Player survive any paper (already declared in code).

**4 · BUILD the two register PDFs whose lying buttons Phase 1 removed (decision 2):**
- **House League → Season Registrations PDF** (league-gated, as its xlsx is).
- **Rep Teams → Tryout applicants PDF** (club-gated, as its xlsx is).
Both through the shared engine + report contract (declared shape, identity, fit priorities)
— **a per-report renderer fork is still forbidden** (plan §5). Both are new-looking
documents with no approved visual: render drafts with realistic fictional data and get the
owner's eye BEFORE wiring the menus. Then: menu formats restored, catalog entries updated,
help-guide availability table + FAQ trued up in the same unit of work (the help table has
gone stale against menus TWICE now — grep it every time a format list changes).

**5 · Verify the two Budget-vs-Actual registers against the gallery** (admin + coach
category shape). Both were judged structurally sound; this is a look-and-confirm, not a
rebuild — note the confirmation in the ledger entry.

**Out of scope:** every other group's content calls (per-family dues statement, check-in
branding, roster diet, logos on drawn documents) · the practice sheet in ANY form (its
run-sheet build belongs to the Working-sheets pass, plan:
`docs/projects/active/PRACTICE_SHEET_STRUCTURE_PLAN.md`) · the Phase 3 CI check (but leave
the harness in a state it can be productionised from).

## Build notes that will save you time

- The engine's report contract is `identity` / `shape` / `fit` on the export call — the two
  new PDFs and the diets are all expressible through it; if you feel the need to fork the
  renderer, the design is wrong (plan §5).
- The exhibit harness (hooks + generator mirroring real call contracts + Chromium
  rasterizer) lives in the P1 session's scratchpad `gen-pdfs/` — copy it forward, extend it
  with the two new registers and the changed documents, and keep fixtures fictional
  (Riverdale worlds). Stock-logo SVGs stroke white; jspdf's node default export is not the
  class — the memory file has the full gotcha list.
- Registrations/results-style division grouping shares ONE fit across groups (engine
  behaviour) — new registers with division groups get consistent columns and a single
  honest note for free.
- Fixed-column reports must fit by construction: declare the shape (and diet) so they do.
  The note is reserved for customer-shaped tables only.

## Verification & process

- AGENCY_RULES in full: PM summary before code · `dev` branch · explicit pathspecs · no
  commit without the owner's OK.
- `npm run verify:changed`; `npm run typecheck` if shared modules move; extend
  `tests/unit/pdf-export-contract.test.ts` where the contract grows.
- Help-docs sync (`/docs`) for the restored PDF menus + any copy that names formats; ask the
  demo question (CLAUDE.md) — the coach demo's money story is exactly the surface the
  month-grid swap touches, so re-read its dock/tour sentences.
- Owner QA Ledger entry for the pass; TODO.md stays high-level.

## What done looks like (owner-visible)

A treasurer can be emailed any register without apology: Results is complete and fits with
no fine print; the month view's PDF button produces the statement a board actually reads
and says so; House League registrations and tryout applicants print real, branded,
division-grouped registers from the menus that used to apologise; and the owner has seen
every changed document — rendered, side by side with its "before" — and signed off on each.
