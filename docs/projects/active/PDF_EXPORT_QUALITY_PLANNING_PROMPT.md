# Session prompt — the PDF deep dive

**A PLANNING session. Owner-called. Written 2026-08-21, to be opened in a fresh chat.**

You are not fixing PDFs in this session. You are looking at **every document this product hands a
human being**, deciding with the owner which of them are any good, and writing down what should
change. The output is a plan the owner has agreed to.

**Read first:** `PDF_EXPORT_QUALITY_PLAN.md` — ⚠ **and read the bottom of it before the top.** The
top argues the project got *smaller*; the bottom carries the owner's widened scope. Both are true,
about different things, and the file says so.

---

## 1 · The question

> *"I want to do a deep dive of these reports and their formats so we can evaluate anything missing,
> whether we have logos, color schemes, how the data fits, portrait vs landscape, etc., so it will
> need a pretty lengthy planning session and also needs to be relative to each pdf, or at least
> grouped to similar types of pdf outputs."* — the owner, 2026-08-21

These documents leave the product. A roster gets pinned to a dugout wall; a Budget vs. Actual gets
emailed to a club treasurer; a lineup card goes in a coach's back pocket in the rain. **They are the
most public thing we make and nobody has ever looked at them properly.**

---

## 2 · ⚠⚠ START HERE: THE INVENTORY IN THE PLAN IS WRONG, AND THAT IS THE FIRST FINDING

The plan states **fifteen PDFs — nine sharing one renderer, six bespoke.** A spot-check while
writing this prompt found that number cannot be trusted:

**At least three of the "fifteen" are buttons that apologise instead of exporting.** They offer PDF
in the export menu and then show a message:

- **House League → Season Registrations** — *"PDF export is coming soon."*
- **Rep Teams → Program Year roster** — *"PDF roster export is coming soon. It will include your org
  logo, header, and privacy settings…"*
- **Rep Teams → Tryouts** — same shape.

⚠ **Two of those are counted in the plan's list of nine as though they ship.** A customer clicking
PDF on those screens today gets a promise, not a document.

**So the session's first job is to rebuild the inventory from the code, not from the plan.** For
every export the product offers, establish: does it produce a PDF at all? Which renderer? Who is it
for? **Do not carry the 9/6/15 numbers forward until you have re-counted them yourself.** This repo
has been bitten repeatedly by plans that described a product slightly different from the real one.

**And a question for the owner falls straight out of it:** a PDF button that says "coming soon" is a
worse answer than no PDF button. Should those three be **built**, or **removed until they exist**?

---

## 3 · What already exists, so you do not rediscover it

**Branding is real and configurable**, at Org Settings → PDF Settings: a header line and second
line, the **org logo** (defaults to the logo already uploaded in Org Settings — no separate upload,
and a print-specific override is marked "coming soon"), an **accent colour**, **footer text**, an
"Exported: {date}" stamp, page numbers, and **orientation**.

⚠ **But branding is fetched per-screen, not applied centrally**, and only some screens fetch it.
**Establish which documents actually carry the org's identity and which go out plain** — that is the
literal answer to *"whether we have logos"* and the session should answer it as a table, not a
guess.

**Two defects are already confirmed and are SHARED plumbing** — fix once, and every document on that
renderer improves:

- **D1 — every PDF prints its own title twice by default.** The header falls back to the report
  title when the custom header line is blank, and the title block prints it again. The custom line
  is blank out of the box, so an org that has customised nothing gets its title stamped twice in two
  sizes.
- **D2 — orientation is an org-wide preference, not a property of the report.** It defaults to
  portrait and nothing considers how many columns a table has. Budget vs. Actual's month grid is
  **17 columns** in portrait letter — about 11mm per column, which is why every heading wraps to one
  character per line and the document runs to six pages.

⚠ **Neither is a Budget vs. Actual defect.** It is simply the widest table we ship, so it is where a
shared weakness became visible first. **Do not fix it alone.**

---

## 4 · How to group them — and the grouping is the owner's first decision

The owner asked for this "relative to each pdf, or at least grouped to similar types". **Group by
what the document IS FOR, not by which code built it** — the renderer is an implementation detail
and grouping by it will produce the wrong conversation.

A starting proposal to put to the owner, **not a conclusion**:

| Group | What it is | What "good" probably means |
|---|---|---|
| **Registers** | Registrations, dues, budget vs. actual | Complete, reconcilable, survives being emailed to a treasurer |
| **Rosters** | Team roster, rep roster | Readable pinned to a wall; privacy-aware |
| **Schedules** | Tournament schedule, results | Scannable at a glance, holds up folded in a pocket |
| **Working sheets** | Practice plan, development summary, tryout board | Written on, in the field, possibly in weather |
| **Posters / cards** | Lineup poster, batting-order card, bracket | Big type, high contrast, one job |

**Ask the owner whether that is the right cut before evaluating anything against it.**

---

## 5 · What to evaluate, per group

For each group, and then per document where the group is not uniform:

1. **Is anything MISSING?** The owner's first word. What does a reader of this document need that it
   does not carry — a date, a total, a season name, a contact, a page count, a "generated on"?
2. **Does it carry the club's identity?** Logo, accent colour, header, footer. Or does it go out
   looking like nothing?
3. **Does the colour scheme survive?** These get printed, often in black and white, often on a bad
   printer. A colour that only works on screen is a defect here.
4. **Does the data FIT?** Column count against page width. ⚠ **Judge on the widest real table we
   ship, never a tidy five-column one** — that is exactly how this rotted unseen.
5. **Portrait or landscape?** A month grid is landscape by nature; a roster is portrait by nature.
   Today one org-wide setting decides for all of them.
6. **What happens when it does not fit?** Scale the type, split columns across pages with the label
   column repeated, or refuse and say why. **Silently unreadable is the one answer that is not
   allowed.**

### Two questions the plan already raised and could not answer alone

- **Is a wide month grid even the right thing to hand someone as a PDF**, or should the PDF be the
  statement shape and the spreadsheet carry the months?
- **Twenty catalog exports offer no PDF at all**, including Transactions & Payables and the Budget
  Plan. That may be right — a ledger is a spreadsheet, not a handout — **but it should be a decision
  rather than an accident.** Where is the floor?

---

## 6 · How to work with the owner

**Ask when their opinion is genuinely required**, at the moment it is required, rather than picking
a default and reporting it afterwards. The questions that matter here are the ones where two
reasonable answers give different products: is the grouping right? Do the three "coming soon"
buttons get built or removed? Should a report be able to override the org's orientation, and if so
where does a coach set that? Is a treasurer-facing document allowed to look different from a
dugout-facing one?

**Do not ask** what you can find by opening the code or generating the file. Do not present a menu
where one option is obviously right.

**Disagree out loud, before the work** — and argue from the documents, not from the plan. The
inventory error in §2 is the standing proof that this file's own numbers need checking.

### When you are ready to propose

Come back with **options, not an answer**, and for each: what the reader sees, the trade-offs
honestly including the cost, what it removes, and **your recommendation with the rationale**.

⚠ **Show it, do not describe it.** This is a session about how documents LOOK. **Generate the actual
PDFs and look at them** — that is the only honest evidence here, and the plan notes that *nothing
renders a PDF in any check*, which is precisely how this rotted unseen. Mockups and comparisons are
published as **Claude Artifacts**, and an approved mockup becomes the spec.

---

## 7 · The deliverable

An updated `PDF_EXPORT_QUALITY_PLAN.md` — corrected inventory first — plus its PM brief, and a
`TODO.md` line pointing at them. Record what was decided, what was rejected and why, and what is
deliberately not being built.

**The shape the plan currently proposes, for you to confirm or replace:**
1. Fix the shared plumbing (D1, D2) so the deep dive is not distracted by faults every document has.
2. The deep dive itself, by group.
3. The six bespoke documents, one at a time.

### What must not happen

- **Fixing Budget vs. Actual alone.** Others share its renderer and its defects.
- **A per-report formatting fork**, which is how a handful of exports become a handful of formats to
  maintain forever.
- **Treating "it got smaller" as "there is nothing per-document to do."** That reading is what this
  session exists to correct.

---

## 8 · Context

- **Nothing renders a PDF in any automated check.** Whatever is decided, one of the outcomes should
  be something that fails when a document stops fitting — a page-count and column-width assertion on
  the widest table would have caught D2 long before an owner saw it.
- **This repo runs one shared `dev` branch** and other sessions may be working in it. A planning
  session writes no code; if you commit documents, stage explicit paths and never `git add -A`.
- **Sequencing:** this project is independent of the money-centralization session and the phone
  density one — it is about documents leaving the product, not about screens a coach works in. It
  can run alongside either.
