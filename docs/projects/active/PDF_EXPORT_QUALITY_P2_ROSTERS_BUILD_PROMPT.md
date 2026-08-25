# Session prompt — PDF Export Quality, Phase 2: the ROSTERS pass

**A BUILD session. Open in a fresh chat. Written 2026-08-23, after the Statements & handouts pass
shipped (committed `bdcd3c40`, dev; Owner QA Ledger §84).**

This is **pass 3 of 6**. Phase 2 works the six document groups one pass per session; this prompt
is the **Rosters** group only — the team roster the coaches portal prints, and the rep
program-year roster whose "coming soon" button Phase 1 removed. The remaining three (Working
sheets, Schedules, Posters/cards/brackets) each get their own prompt after this pass has owner
sign-off. **Do not reach into them on the way past** — the practice sheet and check-in sheet will
tempt you (see "Debt you are inheriting").

**⚠ This group's definition of good is *"readable pinned to a wall; privacy-aware"* — and those
two halves are in tension, which is what checkpoint 1 exists to settle.** A roster is the one
document in this product that gets PINNED somewhere many people walk past: a dugout, a rink
board, a tournament check-in table. Today's team roster prints guardian names, guardian emails,
guardian phones and every child's date of birth. The same document is also what the catalog
describes as a *"travel/insurance sheet"* — a reader who NEEDS exactly those columns. One
document may be serving two readers who must not see the same page. Every judgement in this pass
starts from *who is standing in front of this paper*.

**Read first, in order:**
1. `docs/projects/active/PDF_EXPORT_QUALITY_PLAN.md` — §2 decisions (esp. 1, 2, 3), the §4
   Rosters bullet, §5 rejected-on-purpose.
2. Owner QA Ledger **§79** (what Phase 1 guarantees), **§82** (the engine rules you inherit, and
   why the roster prints compact today), **§84** (what the Statements pass just added — the
   drawn-document plumbing and the shared logo slot).
3. Auto-memory `project-pdf-export-quality` — the build facts that bite, and
   `reference-pdf-exhibit-harness` for the headless-render gotchas.
4. The galleries: approved "before" (planning), the Registers built set, and the Statements
   built set — https://claude.ai/code/artifact/dc3a8252-41bd-4050-9e2a-c6417426d557

---

## The owner's standing method for every Phase 2 pass (2026-08-23, unchanged)

**Each document is judged one at a time, on rendered paper**, with **two owner checkpoints**:

- **Before code:** a short PM-language summary of what changes per document, plus **rendered
  options** for anything without an approved visual. The tryout diet (Registers) and the
  statement's form (Statements) were both decided from rendered variants; the owner picked one
  and the build followed it. Do the same here. **The owner has asked for mockups before
  execution, explicitly, on every pass.**
  - **Every decision arrives with a marked recommendation and the honest case against it** —
    the Statements checkpoint put a "Recommended" chip on one option per question and named
    each option's real weakness on its own rendered page ("2 pages", "loses the schedule"),
    and the owner picked from that. A decision list without a recommendation is not
    checkpoint-ready; neither is a recommendation whose alternatives were strawmanned.
  - **Present the decisions as a short list of questions the owner can answer one by one**
    (delivery/doors/form was three questions last pass), each option carrying what the family
    or club actually sees differently — not engineering trade-offs.
- **Before "done":** re-render every document this pass touched through the real code and present
  before/after as an artifact gallery, per document.

**The eye on the PNG is the acceptance test.** Across three passes it has caught every defect
that every static gate and the whole unit-test suite missed — including three the approved
mockups themselves missed, found only when the real code rendered them.

---

## Scope — Rosters, nothing else

### 1 · The team roster's REAL diet (the pass's decision work)

The roster prints **compact today as a REGRESSION GUARD, not a design** — §82's heading fix
(bold, uncapped) pushed it past landscape and it started dropping its Status column, so it
declared compact to restore exactly the columns it had. The plan's decided call
(§4): *"roster declares landscape (or the wall copy sheds guardian columns — decide in-pass with
the fit contract's per-column priorities)."* That decision is this pass's, from rendered options.

**The question under the question — put it to the owner plainly at checkpoint 1:** today's one
roster PDF is trying to be two documents. Verify in code before drawing anything (the catalog's
sentence has not been re-verified against the renderer — check, don't trust):

- **The wall copy.** Big names, numbers, positions — the thing a coach actually pins up. A wall
  copy carrying guardian emails, guardian phones and children's dates of birth is a privacy
  problem *by placement*: the reader is whoever walks past. The engine's
  `includeGuardianContacts` setting already gates the guardian columns; note that **DOB has no
  toggle at all today** (the planning inventory recorded "DOB always") — decide whether a wall
  copy should carry children's birthdates, and say so on paper at checkpoint 1.
- **The travel/insurance sheet.** The catalog describes the roster PDF as exactly this — the
  document a club submits to a provincial association or insurer, where DOB and guardian
  contacts are the *point*. This reader is staff-shaped, not wall-shaped.

Options to render (at minimum): landscape with every column at honest widths · a portrait wall
copy that sheds guardian columns and decides DOB deliberately · the compact status quo (the
honest baseline) · and, if the two-readers framing survives contact with the code, **two content
variants of one document** — a wall copy beside a submission sheet, the way Dues now has a team
sheet beside the family statement. ⚠ **That precedent is a CONTENT variant, not a renderer
fork** — plan §5 still forbids per-report renderer forks; two variants share one engine call
with different columns. Do not let the variant question be decided silently by starting to draw.

**Constraints that are not open:** player names are baseline (owner 2026-08-03) — no roster
variant may replace names with numbers-only. The guardian-privacy toggle keeps meaning what it
means. The roster is TEAM paper (identity = the team, club look inherited, own look when set).

### 2 · BUILD the rep program-year roster PDF (the stub's promise, decision 2)

Phase 1 removed the Rep Teams → Program-year roster's lying PDF button (an info modal promising
"org logo, header, and privacy settings"). Its real PDF builds in this pass, per decision 2 —
**on ADMIN paper** (org identity: org name, org logo, club look — this surface belongs to the
club admin, not a coach). Columns are a checkpoint-1 decision from rendered options; start from
the same privacy floor the Registers pass set for its two new registers (**no DOB, no guardian
contacts, no notes on paper by default** — those stay in the spreadsheet exports) and let the
owner rule whether this document is the wall-shaped or submission-shaped reading. Group with
counts on the group label if it groups (the Registers precedent). Update the export catalog and
the exports guide's availability table in the same unit of work — that table has gone stale
against the menus twice.

### 3 · ⚠ The ungated PII spreadsheet next door (raised §82, still open — now in this yard)

The §82 review raised, and deliberately did not fix: **the rep-teams "Excel with contact
details" export has NO plan check at all — a role check only.** Real guardian PII, a worse gap
than the PDF ever had. This pass builds the PDF beside that button, so the gap is now this
group's to close: **fix it in-pass** (the same plan bar its neighbours carry), or get an explicit
owner ruling that it stays. Do not walk past it a second time — re-verify it first (it may have
been fixed by another session since; the working copy is shared).

### 4 · Verify identity defaults on both, on paper

Team roster on team paper (default / inherited club look / team's own look); rep roster on admin
paper (untouched org / branded org). Note the confirmation in the ledger entry the way §82 and
§84 did. If it turns up a defect, say so — that is what happened to the club's Budget vs. Actual
in the Registers pass.

**Out of scope:** the check-in sheet and practice sheet (Working sheets — their compact guards
stay untouched) · the schedule · posters, cards and brackets (including the bracket's own
squashed logo draw — recorded §84, that group's fix) · the Phase 3 CI check (leave the harness
productionisable) · anything about dues or statements (shipped, §84).

## Debt you are inheriting — guards, and what is yours vs. not

- **The team roster's compact guard is YOURS TO RESOLVE** — it exists precisely so this pass
  could decide the real diet. When the decided form ships, the guard comment goes with it;
  whatever shape wins must be a decision, not a leftover.
- **The practice sheet's compact guard is NOT yours** — it belongs to the Working-sheets pass
  and its approved run-sheet spec (`PRACTICE_SHEET_STRUCTURE_PLAN.md`). If this pass makes you
  want to touch it, you have drifted out of the group.

## Engine rules you now inherit (§82 + §84)

- **A column heading is measured in the BOLD face it prints in, and is never capped.** If the
  floors cannot fit, a whole column yields and the document says so. A heading broken mid-word
  is a bug, not a trade-off.
- **A fixed-column report must fit by construction** — the "didn't fit this page" line is
  reserved for customer-shaped tables. Seeing it on a fixed-column report is a bug to fix.
- **`abbreviateHeadings()`** exists for customer-named columns; the tool of last resort before
  dropping a column.
- **Do not print a column that repeats its own group heading.**
- **`drawLogoSlot` is the ONE aspect-fit crest helper** (§84) — the table engine, board summary
  and family statement all draw through it. A drawn document must not reinvent the slot.
- **The scanner flags the family-statements batch file `FOOTER✗` BY DESIGN** — page numbers
  restart per family on purpose. It is the one expected red line in a full-corpus scan; do not
  "fix" it, and do not let it mask a real footer failure on YOUR documents.

## Build notes that will save you time

- The exhibit harness lives in the Statements session's scratchpad `gen-pdfs/` (session
  `635111f8-db58-435b-9d73-2846affc17be`) — copy it forward. `gen.mjs` renders the corpus,
  `after-statements.mjs` shows the shape of a checkpoint-2 script, `render-browser.mjs`
  rasterizes in Chromium, and **`scan.mjs` + `scan-viewer.html` read the finished PDFs back as
  text** — run the scanner over the whole set before and after; it is how the last two passes
  proved they degraded nothing. ⚠ Copying the harness means copying
  `pdfjs-dist/build/{pdf,pdf.worker}.mjs` with it.
- Keep every fixture fictional (the Riverdale worlds). Stock-logo SVGs stroke white.
- Node ≥23 + the harness's resolver hooks run the repo's TS renderers headless; jsPDF must
  resolve to the browser build (the hooks do this — don't fight it).

## Verification & process

- AGENCY_RULES in full: PM summary before code · `dev` branch · explicit pathspecs · no commit
  without the owner's OK. ⚠ **Other sessions share this working copy, and it is not
  hypothetical:** the Statements pass had to split FOUR files hunk-by-hunk at commit time
  (`git apply --cached` with content-marker selection) because a concurrent session's uncommitted
  work sat in the same files — including the QA ledger, where a concurrent session took §83
  mid-pass. Check `git diff` per file before you stage, and **re-check what §number the ledger
  actually ends on at write time** (§85 or later).
- Bracket-path directories (`[orgSlug]`, `[teamId]`) stage NOTHING via plain glob pathspecs —
  use `:(literal)` magic (learned the hard way, in memory).
- `npm run verify:changed` (schema parity is RED for pre-existing dev-only migrations — not
  yours unless you add one); `npm run typecheck`; extend
  `tests/unit/pdf-export-contract.test.ts` where the contract grows. `check:layout --changed`
  needs the dev server; if it widens to the full sweep because a concurrent session touched a
  shared stylesheet, the findings inventory is the standing baseline — attribute before you fix.
- **Help-docs sync (`/docs`)** — the exports guide's availability table gains the rep roster
  PDF row and the roster guide describes whatever diet ships; grep every format list.
- **Ask the demo question (CLAUDE.md)** and record the decision either way. (§82 and §84 both
  answered "no moment owed" — the money narration never mentions exports. A roster is nearer
  the demo's story than a register was; actually look.)
- Owner QA Ledger entry · TODO.md stays high-level · update the plan AND the PM brief in the
  same unit of work.
- Offer `/review` when the code is done. It has earned its cost three passes running (four
  lenses, high-risk tier — the shared export libs make every one of these passes high-risk).

## What done looks like (owner-visible)

A coach can pin the roster the product prints without publishing guardian phone numbers and
children's birthdates to everyone who walks past — and whatever the club still needs to submit
to an association is either deliberately on that same page or deliberately its own reading,
by owner ruling on rendered paper, never by accident. The rep program-year roster PDF exists,
on the club's paper, keeping the privacy floor its sibling registers set. The ungated
contact-details spreadsheet next door is gated or explicitly ruled. Both documents have been
looked at in every identity state, side by side with what they printed before, and signed off
one at a time.
