# Coach Money — the list reports become one surface

**Status:** ✅ **BUILT and OWNER-QA-PASSED** — ledger §146, 49/49, zero defects, 2026-09-06. Three
Part-F rulings taken (F1 keep the amber dash · F2 the file follows the screen · F3 spun out into an
app-wide review). A follow-on ruling the same day gave By activity the fold it was missing — §11.
Uncommitted on `dev` at the time of writing. ⚠ This line read *"approved on mockup, not built"* for
a day after it shipped; the build record is §10, the follow-on is §11.
**Owner ruling:** 2026-09-05, mockup artifact `dde45c3f-7faf-4d5c-869f-627c0c52fb8b`
(round 1 capped the table width; round 2 spans it — the owner rejected the cap on sight,
*"this format looks odd to me when the rest of the screen fits the width"*).
**Mockup source:** `docs/projects/active/COACH_MONEY_REPORT_ONE_SURFACE_MOCKUP.html`
**PM brief:** `COACH_MONEY_ONE_SURFACE_PM_BRIEF.md`

---

## 1. What this is

The owner asked for a fresh look at the three list-shaped money reports — Budget vs. Actual's
**Statement** and **By activity**, and the Budget tab's **List** — measured against the **Months**
grid, which he named the best reading experience in the product:

> *"I am not a fan of the design of this by activity report, there is so much space and the row
> colors do not make it at all clear how these are grouped… the way the monthly view fits everything
> so well on the screen still is the best viewing experience that I have had."*

He explicitly released the standing rulings on these surfaces for this pass: *"do not worry about
any old 'rules' that we have logged regarding these."* Where this plan reverses a logged ruling it
**says so and cites it**, because those rulings are written into code comments that will otherwise
argue with the next contributor.

## 2. The diagnosis

The Money hub draws one structure — categories holding lines holding periods, a figure at every
level — through **two recipes**:

| | Recipe | Adopters |
|---|---|---|
| **Outline** | a bordered, rounded card per category, sitting on the paper ground, 12px gaps between | BvA Statement + By activity; Budget List |
| **Grid** | one white table, hairline rows, tints for structure only | BvA Months; Budget By-period; the Dues installment table |

Months works because it is the grid. Everything in the owner's note traces to the outline:

1. **Two recipes for one hub.** Nothing about these reports needs a card.
2. **The row colour is a status pretending to be a structure.** Amber = "nobody planned this". On
   By activity a planned line sits bare on the paper and an unplanned one is amber, so the colour
   *splits* a group rather than holding it together. Add the tan dues card and the white section
   band: four grounds, none meaning "these belong together".
   ⚠ The code's own note at `.unplannedRow` already conceded this — *"the tint stopped reading as a
   STATUS and started reading as a GROUPING"* — and kept the tint anyway. This pass removes it.
3. **A name and its figures are a screen-width apart with nothing to walk across.** The distance is
   not the defect: Months has the same distance from a line name to its Total column and nobody
   notices, because **a hairline under every row carries the eye across**. Outline rows have no rule
   under them, so the eye has nothing to follow and falls back on the row colours for grouping.
4. **The two shapes put their totals in different places.** The Statement carries a category's total
   on the category row (as Months does); By activity carries it in a closing "netted" row under a
   band, two inner labels and its lines — three extra rows per activity, which is where the height
   goes.

## 3. The change

Move the three list reports onto the **grid recipe**. Nothing the reports *say* changes; only how
the same rows are drawn.

| # | Change | Applies to |
|---|---|---|
| 1 | **One surface.** A single white table with a hairline between rows. No per-category frames, radii or gaps. | all three |
| 2 | **Tints mean structure only.** Olive for a band heading (Revenue / Expenses), tan for a category row. Nothing else gets a ground. | all three |
| 3 | **Status stops wearing a row colour.** An unplanned line shows an **amber dash** in the Plan column and nothing else. | Statement, By activity |
| 4 | **Full width.** The table spans the page as the summary band, the toolbar and Months do. | all three |
| 5 | **Months' rhythm and headings.** Condensed uppercase column headings, 36–38px rows, tabular figures, sticky heading row. | all three |
| 6 | **An activity is a category row carrying its own net.** The "netted" closing row goes; Revenue / Costs become quiet sub-labels inside the block. | By activity |
| 7 | **Player dues is an ordinary category row**, caption under the name. No card of its own. | Statement, By activity |
| 8 | **The Budget List takes the same recipe.** The When column and the pencil stay exactly where they are. | Budget List |

### 3.1 What explicitly does not change

- Every figure that opens a panel still opens it (budget figure → plan lines, actual → payments).
- A **report** row still folds on tap; a **plan** row still opens its editor. The two screens keep
  their different jobs — see the long note at the BvA row, which is correct and stays.
- Compare (Whole season / To date), Expand all, the exports and the footnote stack are untouched.
- Months is the reference and is **not** redrawn.
- Variance still says the word ("under" / "over"); colour never carries meaning alone.
- The screen-reader sentences for an unplanned row **stay** — only the visible ground goes.
- Exports (PDF / XLSX / CSV) are a separate path and are not touched by this pass.

## 4. ⚠ What the build actually is — read this before starting

**This is not "restyle two panels". It is "retire the outline recipe."**

Verified by grep, 2026-09-05: the shared `.ledger*` family has **exactly two adopters** — the BvA
panel (48 references) and the Budget panel (45). Both are converted here. Three other files match
the string `ledger` but read **their own local classes** with coincidentally similar names, not the
shared recipe:

- `accounting/dues/panel.tsx` — already renders real tables (and already shares `gridColNow` with
  the month grid)
- `accounting/MoneyNextThirtyDays.tsx` — local `styles.ledger*`
- `admin/accounting/ledger/[ledgerId]/page.tsx` — a different portal, local classes

**Consequences the build must handle deliberately:**

1. **The shared `.ledger*` family becomes dead CSS.** `check:css-selectors` is a real gate inside
   `verify:changed`, so the family must actually be **deleted**, not orphaned. That is ~15 classes
   plus their media blocks in `coaches.module.css`.
2. **`tests/unit/money-hierarchy-type-scale.test.ts` loses its subject.** It exists to stop the
   outline and the grid drifting apart, and it asserts the outline's rules *exist* ("the class was
   renamed or removed. Update this test WITH the rename; do not delete it"). With one recipe left
   there is nothing to keep in sync. Retire it **explicitly**, with a tombstone comment naming this
   ruling — do not let it fail and get patched around. Its surviving relational assertion (a
   category reads larger than its lines) should move onto the grid family.
3. **The five type-scale variables on `.coachesShell` stay** — the grid reads them too.
4. **Phone pinning gets simpler, not harder.** The outline pins a grid cell (`.scrollXStickyCell`
   plus the `--scrollx-pin-gutter` hand-off, written to stop a label lurching on the first swipe);
   a real table pins `th/td:first-child` through the older, better-tested primitive. The gutter
   mechanics and the per-row `padding-left` dance go away with the outline.

**Net effect: the hub goes from two styling systems to one.** That is a simplification, and it is
the strongest argument for doing this now rather than adding a third variation later.

## 5. Guards that bind this change

| Guard | What it demands |
|---|---|
| `check:css-selectors` | no orphaned CSS — the ledger family must be deleted, not left behind |
| `check:css-module-purity` | any new shared rule needs a local class (a `:global(:root)` rule passes dev and **fails the production build**) |
| `bva-figure-doors-guard` | every figure stays a door; no "N lines" caption returns |
| `check:layout` | 361 / 390 / 768 / 1440 — no document-level sideways scroll, tap floors held |
| `check:contrast` / `check:text-contrast` | the amber dash on white, and every ink on the new grounds |
| `money-hierarchy-type-scale` | must be retired deliberately (see §4.2) |
| `coach-money-exports-*` | untouched — proves the exports did not move |

## 6. Sequence

1. **A — the grid recipe absorbs a fourth column set.** Months is 15+ columns; these reports are 3–4.
   Confirm the shared grid rules carry a narrow column set without change, and add only what is
   genuinely new (the Statement's band heading already exists on the month grid).
2. **B — Statement.** The simplest conversion: it already puts the total on the category row.
3. **C — By activity.** Includes the structural change (§3 item 6): the block's net moves onto the
   category row, Revenue / Costs become sub-labels.
4. **D — Budget List.** Same recipe plus the When column and the pencil track.
5. **E — retire the outline.** Delete the `.ledger*` family, retire the type-scale test with a
   tombstone, run the full gate set.
6. **F — rendered check** at 361 / 390 / 768 / 1440, then the owner QA walk.

**Do A–E as one unit.** Converting one screen and leaving the other on the outline recreates the
exact "two recipes in one hub" defect this pass exists to remove — which is how the hub got here.

## 7. Open question for the owner

**Does an unplanned line keep any cue beyond the dash?** The mockup keeps the dash in **amber**.
Dropping the colour and leaving a plain dash is also defensible, since the Off-plan tile at the top
already totals what nobody budgeted. What is settled: the **row ground goes**.

## 8. Owner QA

New ledger section, to be numbered when the walk is written. The walk must pin identities, not
as-of-today figures.

---

## 9. The other money tables — surveyed 2026-09-05 (owner question)

Owner asked whether Dues, Fundraising, Club and the Transactions register should be brought into
line with the reports. **Mostly no, and the reason matters: they already share one recipe**, and it
was deliberately aligned to the budget grids in August.

Verified by reading the stylesheet, not the plans:

- All four read the **same shared list-table recipe** (`.table` / `.th` / `.td` / `.tr`).
- Their **column headings already match the grid's** — size and ink (owner call 2026-08-14), then
  ground (owner call 2026-08-15), which closed a heading that was the brightest surface on the page
  carrying the faintest ink.
- Their **figures already right-align with tabular numerals** (`.thNum` / `.tdNum`, the same pass),
  which retired ~30 inline `tabular-nums` call sites.

So the structural consistency work is done. What remains is one real thing plus two small ones.

### 9.1 Row density — the one that matters, and this pass makes it visible

Four densities exist today. The outline dies here, leaving three:

| Surface | Vertical cell padding |
|---|---|
| Transactions register (always compact) | `0.28rem` |
| Money grids — Months, By-period, **and the new reports** | `0.42rem` |
| ⚰ the outline the reports leave behind | `0.6rem` |
| Dues, Fundraising, Club | `0.7rem` |

Today nobody compares a card-stack to a table. **After this pass everything in the money area is a
table**, so three row heights sit side by side as an inconsistency.

**Recommendation: two densities, split by what a ROW HOLDS, not by which screen it is on.** A row
carrying one line of figures takes the compact height; a row carrying two lines (a name plus a
caption, or an action control) takes the roomier one. A per-screen rule would drift again the first
time a screen gains a two-line row; a content rule cannot.

### 9.2 Two small alignments worth folding in when that happens

- **Frame ink.** The list tables are framed in an **accent-tinted** hairline (olive in the warm
  portal, platform primary in dark — `--blueprint-blue-rgb` remaps per theme); the report cards use
  the **neutral** `--home-line`. Cheap to match.
- **Row rule.** The list tables' row rule (`--white-05`) is **fainter** than the grids'
  (`--home-line`). Since §2.3 of this plan argues the hairline is what carries the eye across a wide
  row, the faintest rule currently sits on the widest tables.

### 9.3 ⚠ What must STAY different — do not "unify" these

- **Phone behaviour.** List tables stack into cards below 640; the grids never reflow, they scroll
  with the first column pinned. **This is correct.** A register reads fine as cards; a 2-D
  comparison does not.
- **Zebra striping on the Transactions register.** Earned there — a season of rows across eight
  columns is exactly the case banding exists for — and it would be noise on a six-row Club table.
  Keep it scoped to that register.
- **Row hover on the list tables.** Their rows are targets; the grids' rows are not.

### 9.4 Sequencing — deliberately NOT folded into this build

Do §1–§8 first, then look at the money area with one recipe gone and decide density with everything
on screen. Density is the species of decision that reads obvious on a mockup and wrong on a real
screen, and choosing a target now means guessing at it with the outline still in the way.

---

## 10. BUILD RECORD — 2026-09-05, built on `dev`, UNCOMMITTED

All of §1–§8 is built. §9 (the adjacent tables) is deliberately **not** started.

### What changed on screen

| Screen | Change |
|---|---|
| **Statement** | one full-width white table, hairline rows, olive band + tan category row the only tints |
| **By activity** | the same, plus the structural change: an activity's net moved onto its own category row; "Revenue"/"Costs" became quiet sub-labels; the closing "X netted" row is gone |
| **Budget → List** | the same recipe; the When column, the pencil, the funding green and the closing row all behave exactly as before |
| **Months** | ⚠ ONE FIX, see below — otherwise untouched |
| every report | an unplanned line shows an **amber dash** in the Plan column; the amber row ground is gone |
| Player dues | an ordinary category row with its caption, no card of its own |

### ⚠ A latent bug found and fixed on the way (Months)

The band headings on the month grid — "Revenue" and "Expenses" — have been rendering as **ordinary
dark sentence-case row headings since 2026-08-13**, not the small olive caps their CSS asks for.
Every declaration in `.bandLead` sat at specificity (0,1,0) while `.moneyGrid tbody th` — the "a row
heading is not a column heading" reset added the same week — sets font-size, weight, colour,
letter-spacing **and** text-transform at (0,1,1). All five lost. Nothing caught it: a file-reading
gate cannot see an inherited cascade, and the band still got its TINT, because that half was written
on the row at (0,2,3). It is visible in the owner's own screenshot from this session.

Fixed by lifting the band to a shared `.moneyGridBand` with the text treatment **on the row
selector**, where it cannot be outranked. Months now renders the band it always intended to.
`money-hierarchy-type-scale.test.ts` gained an assertion pinning the outcome.

### What the build actually retired

- **The whole `.ledger*` family is deleted** — ~15 classes plus their media blocks. It had exactly
  two adopters and both are tables now. The hub is down to **one** recipe for a money hierarchy.
- `.ledgerExpand` / `.ledgerExpandSpacer` / `.ledgerNumMuted` survive, **renamed** into the grid
  family. A stray class from a deleted family is how somebody re-derives it from fossils.
- `.linesContainer`, `.linesCanWrite`, both `--ledger-cols` templates, `.lineInfo`, `.fundingGroup`,
  `.gridInner`, `.unplannedRow`, `--bva-unbudgeted` (and its warm remap), the whole BvA
  `@media (max-width: 640px)` pin-gutter block, and the Budget tab's desktop density override.
- `money-hierarchy-type-scale.test.ts` — its equality assertions compared the two families and went
  with the second one. **Retired deliberately, with a tombstone**; its relational assertions were
  re-pointed at the grid and two new ones added.

### Findings the rendered sweep caught, and what each one was

Every one of these was a real defect in the first build, not a false positive:

1. **Category toggles were 24px at 768.** The old category bar cleared the 44px floor from its own
   row padding alone; a toggle inside a cell does not. Both tables now opt into the touch band.
2. **The unbudgeted screen-reader sentence was inside the button**, so it joined the control's
   accessible NAME — the sweep read it as *"TournamentsNothing in Tournaments was bu…"*. Moved out.
3. **A sticky heading row that can never engage.** Both tables live in a horizontal scroller, and a
   box with `overflow-x: auto` computes `overflow-y` to `auto`, so the heading sticks to a box with
   no vertical travel. Cancelled where it cannot work — except on the first cell, which keeps its
   sticky for the LEFT pin. ⚠ The month grid carries the same inert declaration and is deliberately
   left alone; fixing it properly belongs to whoever does all three.
4. **The expander's pointer hit area overflowed its cell by 4px.** Now vertical-only (20×36px).
5. **The Budget table's `<colgroup>` was unsafe** because its When column leaves the table below
   640; a `<col>` list is positional, so the money column could inherit the wrong width. Widths
   moved onto the heading cells, which travel with the cells that disappear.

### Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| unit tests | 3,005 pass, 0 fail |
| `check:css-selectors` | no new dead selectors |
| `check:css-module-purity` | 253 modules clean |
| `check:spelling` / `check:contrast` / `check:text-contrast` | pass |
| `lint:focused` (3 files) | 0 errors |
| `check:layout` — the two screens, 4 widths | **no new findings** |
| `check:layout` — full 28-screen sweep | 8 findings on 6 OTHER screens; **proved pre-existing** by stashing this work and reproducing them all against unchanged code |

⚠ Those 8 belong to another agent's in-flight work in this shared tree (dues panel, `lib/db.ts`,
the remind-unpaid route) or to fixture data — not to this pass.

### ⚰ Known divergence — RULED AND CLOSED 2026-09-06 (owner, QA §146 F2)

> **The exported By-activity file still prints a "Tournaments netted" line**, because exports were
> out of scope and a flat file needs a label on a closing row. The screen now carries that figure on
> the category row instead. The help article describes the FILE and is still accurate. If the two
> should match, that is a small export change and a help edit.

⚠ **Both of the last two sentences are now FALSE, and the note is kept struck through rather than
deleted so that is visible.** The owner ruled: *"the file should match the screen."* Done in the
same unit of work — see §11 below and ledger §146 F2. The file now leads each block with the
category's own name carrying its net; the shouted band and the closing "netted" row are both gone.
**And the help article was NOT still accurate** — it described the deleted row to the customer, in
prose and in its search keywords, and was trued up with the change (`/docs`).

### Not done, deliberately

- §9 — the density of Dues / Fundraising / Club / Transactions. Sequenced after this on purpose.
- The unplanned dash ships **amber**. The owner's open question (amber vs plain) is unanswered.
- No `/docs` pass yet. Help copy was re-read and is still true, but a help keyword still says
  "flagged row" for what is now a dash.

---

## 11. REVIEW + DOCS PASS — 2026-09-05

### `/review` — standard-plus tier (shared portal stylesheet + `components/coaches/`)

Deterministic gate first, all green: `verify:changed` in full (every token ratchet, palette and text
contrast, date correctness, snapshot freshness, schema parity, index coverage, dictionary coverage,
org-context guard, marketing shots, **demo sandboxes presentable**, CSS selectors, repo root),
`typecheck`, `lint:focused` (0 errors), and the rendered `check:layout` on both changed screens at
four widths.

Four non-overlapping finder lenses ran: correctness/logic, regression/blast-radius,
accessibility/interaction, CSS cascade/specificity.

**Confirmed and fixed:**

1. **Tap-target shrinkage on every collapsible row — Medium, found independently by TWO lenses.**
   The outline's category bar was one full-width `<button>`; converting it to a `<tr>` with a button
   in the first cell shrank the touch target from the whole row to the width of the name, leaving
   the figure cells inert. ⚠ **The tap-floor gate could not catch this: it measures HEIGHT, and the
   height was correct.** It also re-created, in the opposite direction, the exact asymmetry an owner
   ruling had removed in September ("the category bar opened on a click anywhere; the item row
   opened only on its 13px chevron") — item rows kept their full-row target through the conversion,
   header rows did not. Fixed on all four collapsible row kinds: the row is the pointer/touch
   shortcut, the button stays the semantic control, and the button stops propagation so a click on
   it cannot toggle twice.
   ⚠ NOT applied to the month grid, which never had a row-wide target and is the reference screen.
   That is the one behavioural difference left between the three tables.
2. **An unnamed column header — Low.** The Budget list's action column was an empty `<span>` in the
   div grid and is a real `<th>` now, which a screen reader's table navigation announces as blank.
   Given an assistive-tech-only label.

**Cleared, with evidence:**

- **Blast radius: nothing dangling.** All 19 deleted class names traced across every `.tsx`/`.ts`/
  `.css`, with each `styles.`/`shared.` prefix resolved back to its actual import — the three other
  files matching "ledger" read their OWN local modules that merely share the name. No straggler on
  the three renamed classes (including inside `@media` and `:global()`), no test or script asserting
  a removed literal, and the surviving `.ledgerActions` still exists. **This mattered because a
  missing CSS-module class resolves to `undefined` and renders unstyled with no error.**
- **Correctness: no cell-count mismatch** in any of the ~16 row-producing branches across both
  tables, **no figure or sign changed** on the relocated activity net (same three values, same
  direction argument), no lost conditional, no key problem, no dead prop.
- **Accessibility: table structure valid** (nothing non-`<tr>` left between rows to be hoisted out),
  every `aria-expanded` on the element that toggles, every `aria-describedby` target rendered under
  the same condition as its reference, all ~26 `<th>` carrying an explicit scope, and the
  accessible-name pollution fixed earlier confirmed correct.

Re-verified after the fixes: typecheck clean, 3,005 tests pass, lint 0 errors, rendered layout gate
**no new findings**.

### `/docs` — help + demo sync

- The money guide said an unbudgeted row sits **"on a faintly tinted row"**. That tint is gone;
  it now names the **amber dash** instead.
- **By activity** re-described: its net sits on the category row now, with Revenue and Costs beneath.
- A new short paragraph states the rule a coach can now rely on — **shading means a heading**, and
  the Budget list and Months read the same way.
- Search metadata extended so the change is findable: "why does budget vs actual look different",
  "row colours gone", "amber dash", "what does the shading mean", "one table", plus terms for the
  plan list now scrolling sideways on a phone. ⚠ Rendered prose is NOT searched — terms only work in
  `keywords`/`searchText`/`answerText`.
- ⚠ The edited sub-topic is ~1,225 words, over the 350-word scannable standard — but it was already
  over before this edit, the standard exempts a correction from forcing a restructure, and splitting
  it is a separate piece of work across the whole money guide.
- **Demo sandboxes: read, verdict recorded in the tour file.** No dock line or tour step went stale.
  The clause most at risk was *"the report says so rather than hiding it"*, since the removed tint
  WAS a way the report said something — but it marked unbudgeted spending, not over-plan, and the
  amber dash still states that. Over-plan was and is carried by the variance word. No new clause:
  the one-proof-point cap holds, and a drawing change is the weakest candidate for narration.

### ⚠⚠ WHAT THE REVIEW ACTUALLY CAUGHT — the case for having run it

The tap-target regression above was the *small* finding. The CSS-cascade lens found two classes of
defect that **every other gate in this repo reported as green**, and both would have reached the
owner's QA walk:

**1. Seven rules were silently deleted from the report's stylesheet by my own scripted edit.**
The script cut between two heading comments by text; the block I had inserted higher in the file
repeated one of those headings, so `indexOf` matched the NEW heading and the cut ran from there to
the old one — taking everything between. Lost:

| Class | What stopped working |
|---|---|
| `unplannedDash` | **the amber dash itself** — the entire replacement for the removed row tint, rendering with no colour |
| `duesCaption` | the Player dues caption, inheriting the category row's 800-weight |
| `catTwoLine` | the dues row's two-line breathing room |
| `varianceKey`, `duesNote`, `undatedNote`, `fundingNote`, `bridgeSentence` | **all four footnote sentences under the table** — the disclaimers the owner had just ruled must travel with the report |

⚠⚠ **NOTHING COULD HAVE CAUGHT THIS.** A CSS-module class with no rule resolves to `undefined`,
React drops the attribute, and the element renders unstyled **in silence**. TypeScript is satisfied.
`check:css-selectors` looks for rules with no markup — this is markup with no rule, the exact
inverse. The rendered layout sweep passed because unstyled text still lays out. **The only reason
this was found is that a reviewer diffed the class list against the stylesheet.**
→ A used-class/defined-class reconciliation is now the first thing to run after any scripted edit
to a CSS module. Both panels are clean: BvA 52/52, Budget 104/104.

**2. Five new rules were written at a specificity that loses to the shared recipe.**
All deterministic losses (not order-dependent), all silent:

| Rule | Lost to | Consequence |
|---|---|---|
| `.lead` (0,1,0) | `.moneyGrid th, .moneyGrid td` (0,1,1) | the name column **never wrapped**, and lost its gutter |
| `.subLead` (0,1,0) | `.moneyGrid tbody th` (0,1,2) | Revenue/Costs rendered as ordinary line names |
| `.netRow` / `.closeRow` th (0,1,1) | `.moneyGrid tbody th` (0,1,2) | the closing row — the answer — rendered **quieter than the subtotals above it** |
| `.periodRow th` (0,1,1) | `.moneyGrid tbody th` (0,1,2) | period label at full strength beside its own muted date |
| `.periodRow td` (0,1,1) | beat `.moneyGridNumMuted` (0,1,0) | every "nothing happened" dash un-muted |

⚠ **This is the same no-op the month grid's stylesheet documents at length — in a file edited in
this very pass.** Reading a warning is not the same as applying it. Every rule is now compounded
(`.reportTable th.lead`, `.reportTable tbody tr.subRow th.lead`, …) and each carries the two
competing specificities in its comment.
⚠ Two of the fixes also had to **stop naming a shared class**: a local module cannot select
`.moneyGridCat` — CSS Modules hashes per file, so it would compile clean and match nothing. Doubled
local classes are used instead.

**Verified by MEASUREMENT, not arithmetic** (the repo's own rule), reading computed styles off the
rendered page at 1440: band heading `uppercase / 11px / 700 / olive`; category name `white-space:
normal`, `padding-left: 14.4px`; closing row `14.72px / 800` with its inset cap; **amber `#835006`
present among the table's inks**; zero document side-scroll.

Re-verified after all fixes: typecheck clean · **3,008 tests pass** · lint 0 errors · CSS purity ·
no dead selectors · both contrast gates · rendered layout sweep **no new findings**.

### ⚠ A process lesson worth more than the fixes — scripted edits

Both the deleted rules AND a whole-file line-ending churn in `TODO.md` came from the same habit:
editing files with scripts that match on **text that is not unique**, and writing them back without
checking what else moved.

- `indexOf` on a heading comment matched the NEW copy of that heading, not the old one.
- A rewrite normalised a file that had **mixed** CRLF/CR/LF endings, turning a 1-line edit into a
  2,545-line diff that would have buried a peer agent's uncommitted change. (Recovered: the peer's
  entry was restored to its original position and the file is back to two real changed lines.)

**The rules that follow, for anyone scripting an edit in this repo:**
1. Anchor on something **unique**, and assert the match count before replacing.
2. After any scripted edit to a CSS module, **reconcile the class list**: every `styles.x` used in
   the component must have a rule. Nothing else catches the inverse-orphan case.
3. Preserve the file's own line endings — read them, don't assume — and check `git diff --numstat`
   is the size you expect before moving on.

---

## 11. FOLLOW-ON RULING — **BY ACTIVITY FOLDS** (owner, 2026-09-06)

Shown the built screen, the owner asked: *"why aren't the items grouped in the categories? the
categories are just headers."*

**He was right, and the diagnosis is worth keeping because both halves matter.** The arithmetic
grouped perfectly — a Tournaments row reading `($2,500.00) / $160.00 / +$2,660.00` IS its own
revenue less its own costs, and the items beneath it are the rows that make that figure. **The
drawing did not.** §3 item 6 moved an activity's net onto its own category row and deleted the
band, the two inner bands and the closing subtotal — a real improvement — but it left the row
**inert**: no chevron, no fold, no click, every item of every category on screen at once, and a
`moneyGridChevronSpacer` holding a blank chevron-width gap that reads as a control gone missing.

Four failures, one cause:

1. **Two grammars for one object.** A category on the Statement is a fold you open; the same
   category on By activity was a dead heading. The gesture a coach learns on one tab died on the
   next — the exact defect this whole pass exists to remove, one level below where it was fixed.
2. **Nothing bracketed a block.** With every item always open, the only signal that Tournaments had
   ended was that the next tinted row began.
3. **`Expand all` vanished on this tab**, with no explanation, because there was nothing to act on.
4. **PM brief success criterion 4 was unreachable** — *"By activity reaches Season net inside a
   laptop screen with categories collapsed"* — because there were no categories to collapse. That
   line is the strongest evidence the fold was intended all along and simply never got built.

### What was done

- The tinted foldable category row is now **one component shared by both shapes** (`CatFoldRow`),
  for the same stated reason `ItemRows` already is: the two lenses must not be able to draw one
  object two ways. The three figure cells stay the caller's — a category's Budgeted is always
  positive and takes `fmt` plus the unplanned dash, an activity's is a **net** that can go negative
  and takes `fmtCell`'s brackets. One row drawing, without pretending two different figures are one.
- `ActivityGroup` renders the block: the fold row carrying `block.net`, then Revenue/Costs
  sub-labels and item rows **behind the fold**. Closed by default, matching the Statement.
- **`Expand all` / `Collapse all` now serves both list shapes** and acts on **the active view's keys
  only**. It used to clear `expandedCats` outright, which was harmless while one shape folded and is
  not now — on By activity it would have silently shut every row opened on the Statement.
- **Activity keys live in their own `activity|` namespace** (`activityKeyOf`). `catKeyOf` can only
  emit `in|…` or `out|…`, so the three namespaces are disjoint by construction and one state set
  serves both shapes without leaking between them.
- **Player dues is unchanged** — still an ordinary row with no chevron. It has no items to hold
  (dues are a schedule, not budget lines), so a fold there would open nothing: the same reasoning
  §3 item 7 already records.

### Not changed

Every figure, every door, both exports, the footnote stack, and the Statement's own markup.

### Verified

Typecheck clean · **3,044 unit tests pass** (incl. `bva-figure-doors-guard`,
`money-hierarchy-type-scale`, `coach-money-exports-bva-shapes`) · lint 0 errors · css-selectors ·
CSS purity · spelling · rendered layout sweep on `coach-budget-vs-actual` at 361/390/768/1440 with
**no new findings**.

Proven in a real browser against the UAT fixture, 11/11: eight activities render a real fold control
· every one opens **closed** · the chevron opens and closes · **the row itself** opens it too ·
`aria-expanded` tracks · Player dues offers no fold · `Expand all` is offered here, opens all eight
and flips to `Collapse all` · **and the Statement's own folds are untouched by it**.

### Review + docs pass, same day

`/review` ran four scoped lenses over this change (correctness · export contract · blast radius ·
state and accessibility) on top of a fully green deterministic gate. **No Critical or High defect
survived.** Three things were fixed as a result:

1. **The fold's key list read `data.report` instead of the re-cut `report`** — the rule stated over
   that memo in this very file, broken by the first version of the list and then copied by the
   fold's. Harmless today only because `rebaseReport` is 1:1; a To-date cut that ever dropped an
   empty category would desync `Expand all` from what is on screen. Both lists now read the memo.
2. **`toggleAllCats` derived its direction from the render closure**, not from `prev`. Unreachable
   today — one button, one click event, a re-render between any two — and fixed anyway, because it
   made the updater's answer depend on when it happened to run.
3. **The exported file's Revenue / Costs labels are now SHOUTED.** Demoting them to item level (so
   they collapse with the block, as on screen) took their bold with them, and a plain "Revenue" at
   the same indent as "Concession revenue" with three empty money cells is not a heading — it is a
   line somebody forgot to fill in. The screen sets them in small capitals; a spreadsheet cell
   cannot, so the case rides in the string. Same rule as everything else here: **match the screen.**

Re-verified after all three: typecheck clean · 3,045 unit tests · lint 0 errors · full
`verify:changed` · rendered layout sweep no new findings · and a second browser run proving the fold
and `Expand all` behave **across both Compare bases** and still cannot reach the Statement's folds.

⚠⚠ **THE MOST INTERESTING FINDING WAS IN THE DOCS, NOT THE CODE.** The help said, of Budget vs.
Actual: *"which view you read, which columns, and which categories you left open are all remembered
for that team and season, so tomorrow opens where today left off."* **False — and it had been for as
long as the sentence existed.** The Budget tab's List genuinely persists its closed sections; Budget
vs. Actual persists the view, the reading, the trend shelf and the Compare basis, and **never the
folds**. One sentence was describing two tabs and was right about one of them. Corrected in the same
unit of work.

**⚠ OPEN, FOR THE OWNER — a product inconsistency the doc fix exposes rather than settles.** The two
tabs really do differ: the plan list remembers what you closed, the report always opens folded. Both
are defensible on their own (a worklist should hold your place; a report should open on its totals).
Having both, undocumented and unruled, is what is not. This is not urgent and it is not a defect —
it is a decision nobody has taken.

**Not treated as defects, with reasons:**

- **The category toggle's hit area is only as wide as the category's name**, and the tap-floor gate
  measures HEIGHT only, so nothing sees it. Real, and **not from this change**: that control shipped
  in the month grid on 2026-08-13 and is on production. Before this change these rows had no control
  at all. Routed to the app-wide table review (§146 F3) with a required output — the standard must
  state a minimum target WIDTH and say how to gate it.
- **The §146 walk file still poses F2 as an open question.** It is a completed walk; the ledger is
  the record. Editing a signed-off walk to look tidy would be rewriting history.

⚠ **A COVERAGE NOTE, STATED RATHER THAN LEFT AS AN OMISSION.** The layout gate opens nothing, and it
only ever sweeps this screen's DEFAULT view — so By activity's item rows were never in the sweep,
before or after. This change does not narrow gate coverage; it does mean the fold's contents are
proven by the browser run above rather than by the ratchet.
