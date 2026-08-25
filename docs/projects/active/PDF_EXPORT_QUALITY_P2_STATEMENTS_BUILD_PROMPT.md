# Session prompt — PDF Export Quality, Phase 2: the STATEMENTS & HANDOUTS pass

**A BUILD session. Open in a fresh chat. Written 2026-08-23, after the Registers pass shipped
(committed `b09e0671`, dev; Owner QA Ledger §82).**

This is **pass 2 of 6**. Phase 2 works the six document groups one pass per session; this prompt
is the **Statements & handouts** group only — the documents a club HANDS TO SOMEBODY. The
remaining four (Rosters, Working sheets, Schedules, Posters/cards/brackets) each get their own
prompt after this pass has owner sign-off. **Do not reach into them on the way past** — and see
"Debt you are inheriting" below for two documents that will tempt you.

**⚠ This group is different from the last one in the way that matters most: its reader is not
staff.** Registers were read by a treasurer or a registrar — people who work for the customer.
These documents go to **a parent, a board, a family at pickup**. The group's definition of good
says so: *the club's face; one page; a stranger would think well of the club.* Every judgement in
this pass is made from that chair, not from the coach's.

**Read first, in order:**
1. `docs/projects/active/PDF_EXPORT_QUALITY_PLAN.md` — §2 decisions (esp. 1, 5, 7), the §4
   Phase 2 Statements bullet, §5 rejected-on-purpose.
2. Owner QA Ledger **§79** (what Phase 1 guarantees) and **§82** (what the Registers pass just
   changed, including two engine rules you now inherit).
3. Auto-memory `project-pdf-export-quality` — the build facts that bite, and
   `reference-pdf-exhibit-harness` for the headless-render gotchas.
4. The galleries: approved "before" (planning), the Phase 1 "after", and the Registers pass's
   built set — https://claude.ai/code/artifact/c370b8a3-41f7-4eae-9071-7ecd1a40f6fb

---

## The owner's standing method for every Phase 2 pass (2026-08-23, unchanged)

**Each document is judged one at a time, on rendered paper**, with **two owner checkpoints**:

- **Before code:** a short PM-language summary of what changes per document, plus **rendered
  options** for anything without an approved visual. In the Registers pass the tryout column diet
  was decided from four rendered variants; the owner picked one and the build followed it. Do the
  same here. **The owner has asked for mockups before execution, explicitly, on every pass.**
- **Before "done":** re-render every document this pass touched through the real code and present
  before/after as an artifact gallery, per document.

**The eye on the PNG is the acceptance test.** It has now caught, across two passes, every defect
that every static gate and the whole unit-test suite missed.

---

## Scope — Statements & handouts, nothing else

### 1 · BUILD the per-family dues statement (decision 5) — the pass's real work

The plan's decided call is one line: *"Dues gains a **per-family statement** variant beside the
team sheet."* Everything else about it is open, and that is what checkpoint 1 exists to settle.

**Why it is needed, stated plainly:** the Player Dues PDF that exists today is a TEAM SHEET —
every player, every balance, every "Past due" on one page. It is a good document for a coach and
it is **un-handable to a parent by construction**: a coach who wants to tell one family they owe
$945 has nothing to send that doesn't also disclose that another family is $1,070 behind. There is
**no per-family dues document in the product today** (verified 2026-08-23).

**⚠⚠ IT IS PER-FAMILY, NOT PER-PLAYER, AND THAT IS NOT A WORDING DETAIL.** A family with two
children on the team gets **one** statement covering both — otherwise the product sends the
Marchand household two separate demands for money in the same envelope. The plan says "per-family"
and means it. **The grouping and naming logic already exists, fully built and unit-tested, and has
no caller**: `lib/coach-family-dues.ts` (`computeFamilyDues`, `familyLabel`, `familyPlural`)
collapses siblings by guardian email, names the household ("the Marchands" / "Maya and Sam's
family") and rolls up unpaid installments. It was written for the Ask-the-Front-Office bar, which
was deleted in `0ebd0ffa`; only `familyLabel` survives, reused by the season settlement sheet.
**Read it first and reuse it** — but note the ruling that deleted its old caller was *"no money in
the Insights hub, and the way it stays gone is structural."* That ruling is about the reports hub;
a statement reached from the Dues tab does not offend it. Do not resurrect the old surface.

**Three questions the mockup session must answer, in this order — the first changes what you
build, so settle it before drawing anything:**

1. **How does it get sent?** Two facts constrain this, both verified 2026-08-23:
   - **The family portal is not an option.** The guardian tier is built but switched off pending
     legal counsel (PIPEDA/CASL/Law 25), and dues and fees are *structurally excluded* from the
     guardian payload — absent from the shape, not filtered by a UI check. There is no
     money-visibility setting for families anywhere in the schema.
   - **Email already exists and already carries the detail.** Three dues-reminder senders share
     one template that lists each unpaid installment (player, amount still to send, due date,
     "Installment N of M"), credit earned through fundraising, and thanks for a partial payment.
     It ends: *"To view your full payment schedule, contact your coach directly."* **That sentence
     is the gap this document fills.**
   So the real options are (a) a PDF the coach downloads and sends however they already talk to
   that family, or (b) the statement attaches to the existing reminder path. **⚠ (b) is a
   materially bigger build** — it touches the email stack and must honour the family
   email-suppression rules (auto-memory `project-family-email-suppression`: ten senders, three
   honoured an unsubscribe). Do not let this be decided implicitly by starting to draw.
2. **How does a coach get one?** The **development summary is the shape of the precedent** — a
   one-page family handout reached from a player's own screen — but it is per-PLAYER, so do not
   copy its unit. Options: from the family's row on the Dues tab, a batch for every family at
   once, or both. Say what happens with fourteen families and three sets of siblings.
3. **What is on it?** At minimum: what this household was billed, what they have paid and when,
   any credit from fundraising, what is left, and when the next payment falls due. The data is
   there — the dues screen carries installments (with dates, amounts, credit applied), real
   payments (amount, date, method, note), credits with their provenance, and payouts handed back —
   but **the "next due" figure is derived in the browser for one lens only, not served**. Check
   every figure before drawing it; this whole project exists because documents were built from
   assumptions about their own data.

**Constraints that are not open:**
- **One household's children, and nobody else's.** No other family's name, balance or status may
  appear. This is the first document in the project where that is a privacy rule, not a taste call.
- **One addressee.** The product is single-guardian-per-player for billing and messaging
  (decision CP-7, 2026-07-30, in `PROGRAM_COACH_PORTAL.md`). ⚠ `ACTIVE_PROJECTS_INDEX.md` may
  still list CP-7 as an open decision — that looks stale against the newer ruling; confirm which
  is current rather than assuming either.
- **The family is the reader.** Brand voice applies (`memory/marketing_brand_voice.md`) — plain
  language, no jargon, nothing that reads like a collections notice. A statement that makes a
  parent feel chased is a failed document however accurate it is.
- Through the shared engine and its report contract. **A per-report renderer fork is still
  forbidden** (plan §5) — though note the board summary and practice sheet are *drawn* documents,
  so if the statement wants a drawn layout rather than a table, that is a legitimate shape to
  propose at checkpoint 1 (with a rendered draft), not something to decide silently in code.

### 2 · The tryout board summary draws the club's logo

The plan's own inventory records it: the board summary is *"the standard-setter … never draws the
logo."* Confirmed by rendering on 2026-08-23 — a club with a logo gets its name on this document
and no crest, while every table document beside it prints one. Decision 5 says the drawn documents
draw the logo now that Phase 1 made logos real. **The board summary is in THIS group** (decision
1), so its logo is this pass's; the posters, cards and brackets keep theirs for their own pass.

This is the document a coach hands to a club board. It should look like the club's.

### 3 · Verify identity defaults on all three, on paper

Player dues (team sheet), development summary, tryout board summary — confirm each carries the
right name for its layer (team paper falls back to the team's name, admin paper to the org's),
the club's look where the team has set none, and the team's own look where it has. This is a
look-and-confirm; **note the confirmation in the ledger entry** the way the Registers pass did.
If it turns up a defect, say so — that is what happened last pass to the club's Budget vs. Actual.

**Out of scope:** every other group's content calls · the practice sheet in any form (Working
sheets) · the rep roster PDF (Rosters) · the Phase 3 CI check (but leave the harness
productionisable).

**Two prior decisions that touch this pass — read them before you contradict either:**
- **A per-installment EXPORT sheet was deliberately not built** (`DUES_BY_INSTALLMENT_PLAN.md`:
  *"Export is unchanged (season-shape rows). A per-installment export sheet was deliberately NOT
  added — revisit only if asked."*). That was about a spreadsheet of the whole roster by
  installment. A one-household statement is a different document with a different reader, so this
  pass does not overturn it — but say so in the ledger rather than letting it look like drift.
- **Marketing already promises this.** `/platform/rep-teams` advertises *"Player dues statements
  formatted for parent distribution — one click from the coaches portal"* on a page flagged
  "Coming soon". Building it closes a claim we are already making; when it ships, check whether
  that page should stop saying "coming soon" (`/marketing`).

---

## Debt you are inheriting — two documents that are guarded, not decided

The Registers pass changed a shared measurement (see below) and, to stop it degrading two
documents outside its scope, gave each a **regression guard**. Neither is a design decision, and
**neither is yours to settle** — they belong to the Rosters and Working-sheets passes:

- **Team roster** prints compact. Its real diet (should the wall copy shed the guardian columns?)
  is the Rosters pass's call.
- **Practice sheet** prints compact. Its rebuild as the decided run sheet is the Working-sheets
  pass's, to `PRACTICE_SHEET_STRUCTURE_PLAN.md`.

If this pass makes you want to touch either, that is a signal you have drifted out of the group.

## Engine rules you now inherit (Registers pass, §82)

- **A column heading is measured in the BOLD face it prints in, and is never capped.** Cells keep
  their token cap. If the floors cannot fit, a whole column yields and the document says so.
  A heading that breaks mid-word is a bug, not a trade-off.
- **A fixed-column report must fit by construction.** The "didn't fit this page" line is reserved
  for customer-shaped tables. Seeing it on a fixed-column report is a bug to fix, never to accept.
- **Subtitles wrap** to the content width. A caller may pass a second line.
- **`abbreviateHeadings()`** exists for customer-named columns that will not fit — initials for
  multi-word names, first four letters for one word, a legend for what it shortened. It is the
  tool of last resort before dropping a column.
- **Do not print a column that repeats its own group heading.** Two documents shipped one.

## Build notes that will save you time

- The exhibit harness lives in the Registers session's scratchpad `gen-pdfs/` — copy it forward.
  `gen.mjs` renders what ships today, `after.mjs` the contracts you are building,
  `render-browser.mjs` rasterizes in Chromium, and **`scan.mjs` + `scan-viewer.html` read the
  finished PDFs back as text** and report page count, true "Page X of Y" footers and which columns
  the fit contract dropped. **Run the scanner over the whole set before and after** — it is how
  the Registers pass proved it had degraded nothing, and how it caught the one document it had.
  ⚠ Copying the harness means copying `pdfjs-dist/build/{pdf,pdf.worker}.mjs` with it.
- Keep every fixture fictional (the Riverdale worlds). Stock-logo SVGs stroke white.

## Verification & process

- AGENCY_RULES in full: PM summary before code · `dev` branch · explicit pathspecs · no commit
  without the owner's OK. ⚠ **Other sessions share this working copy** — the Registers pass had to
  stage three files hunk-by-hunk because a concurrent session was editing them. Check before you
  stage, and never `git add -A`.
- `npm run verify:changed` (schema parity is RED for pre-existing dev-only migrations — not yours
  unless you add one); `npm run typecheck`; extend `tests/unit/pdf-export-contract.test.ts` where
  the contract grows.
- **Help-docs sync (`/docs`)** — a new family-facing document almost certainly needs the exports
  guide's availability table and the coach money guide updating. That table has gone stale against
  the menus twice; grep every format list.
- **Ask the demo question (CLAUDE.md).** A per-family dues statement is exactly the sort of thing
  the coach sandbox's money story might want to show a prospect — and its dock and tour sentences
  are the surface that goes quietly stale. Decide deliberately, and record the decision either way.
- Owner QA Ledger entry (§83 or later — **check what the ledger already holds**, another session
  has been numbering entries concurrently). TODO.md stays high-level; update the plan AND the PM
  brief in the same unit of work.
- Offer `/review` when the code is done. It earned its cost on the Registers pass: five lenses,
  four real defects, one of which was a document claiming completeness it did not have.

## What done looks like (owner-visible)

A coach can hand one family a statement of what they owe without showing them anybody else's
business, and would be happy for that page to be the first thing a parent sees with the club's
name on it. The board summary carries the club's crest. All three handouts have been looked at on
paper, side by side with what they printed before, and signed off one at a time.
