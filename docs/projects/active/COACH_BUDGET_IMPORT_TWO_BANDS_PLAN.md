# The plan file reads back whole — Import learns the file's two bands

**Status: BUILT on dev 2026-09-10** — typecheck clean, 3,415 unit tests green, `check:money-report`,
`check:export-catalog`, spelling, CSS purity, dictionary, date-correctness and CSS selectors all
green. **No migration.** Owner QA rides **ledger §165** and its own instrument,
`COACH_BUDGET_IMPORT_TWO_BANDS_WALK.html` — published at https://claude.ai/code/artifact/e3dbfafa-ce42-4e7e-a4af-732061747d69 (30 checks, 10 steps, four parts).

Owner asked for it from a screenshot of that step: *"have we addressed this?"*

⚠⚠ **THE ASK WAS ONE DEFECT AND THE FILE HAD THREE — see §8, which is the most important section
here.** The other two were found only by round-tripping the real file for the first time, and one of
them was a day old.

**Origin.** `/review` found it on 2026-09-09 during the *category is the shelf* build (§7c HIGH,
`COACH_BUDGET_CATEGORY_IS_THE_SHELF_PLAN.md` §8). It was handed to "peer session 7a, which owns that
importer" and **the hand-off did not take** — that session shipped *one word, one line* (`88ecf2ac`)
and *the By-period close* (`3d6289be`), both touching the importer, without picking it up. It has
lived since as a line of prose inside another task and a note in QA ledger §158. That is the reason
this is now its own plan with its own TODO line: work handed to a session rather than to a task
disappears when the session ends.

## 1. The defect, stated as a coach meets it

Budget → export the plan → Budget → Import that same file.

Every **money-in** line in the file — a fundraising drive, a team sponsor, tournament revenue, other
income — arrives in the preview as an **add**, and if committed becomes a **cost line inside a
revenue category**. Planned costs rise by the amount of the plan's own funding; the coach's item
list gains a spending word ("Chocolate Sale") on the wrong side; and the plan now double-counts,
because the real money-in line is still there.

**Why it happens.** Three facts compound:

1. The importer writes **cost lines and nothing else** — the item it creates is hardcoded
   `direction: 'out'`, and the line insert never writes `line_kind` at all (it takes the column
   default, `cost`).
2. The vocabulary it matches against is **cost words only** — `toKnownCategories` filters
   `direction === 'out'` on purpose (mig 248: a word's side is part of its identity, so "Grant" the
   cheque and "Grant" the application fee are two different words). So a money-in row matches
   nothing and is therefore a new word.
3. The file's own **band headings are deliberately ignored** — `PLAN_LADDER_DERIVED` excludes
   `costsBand`/`fundingBand` so that a coach who owns a category called "Costs" is not broken, and
   the readers treat a non-indented row as a category name.

Each of the three was the right call on its own day. Together they mean the product cannot read the
file it just wrote.

**Pre-existing, widened by §158.** Before that build the phantom cost lines landed under
*Fundraising* / *Sponsorship* — headings that at least looked odd in a spending plan. Since money in
groups by **category**, they now land under *Tournaments* and *Other Income* beside real cost lines,
where nothing looks out of place.

## 2. The design decision: the bands, and NO new column

The `/review` finding offered two shapes — "a direction per row, or the band heading as the switch".
**The band heading wins, and the column is refused.** Reasons, in order of weight:

- **An export's shape is its screen's shape** (QA §146 F2, standing). The plan screen has no
  direction column; it has two **bands**. A file that grew a column the screen does not have would
  be the drift that rule exists to stop.
- **The file already carries the signal.** Every plan file the product has written since 2026-09-08
  has `COSTS` and `FUNDING` as non-indented rows, in both the statement file and the by-period grid.
  A column fixes files written from tomorrow; the band fixes every file already on a coach's disk.
- **The file is already positional and always has been.** A line attaches to the category row above
  it. If a coach re-sorts the sheet, the categories are lost with or without a direction column — so
  a column buys robustness the rest of the file does not have.

**The blank template stays spending-only** — it says so in its own words ("This template plans
spending only"), and widening it to both sides is a design question about dropdowns, the Reference
sheet and its two validation prompts, not part of fixing a round trip. One sentence is added to the
Reference note telling a coach the band row exists, so the promise stays true rather than becoming
half-true.

## 3. The rule, precisely

A row is **money in** when the nearest preceding **band row** was the funding band; otherwise money
out. A **band row** is a row that is:

- **not indented** (no dash prefix, no Excel outline level / cell indent), and
- whose text matches `PLAN_LADDER_LABEL.costsBand` / `.fundingBand`, case-insensitively, and
- **carries no amount** in any money column.

The third clause is what protects the club that owns a real category called "Funding": a category
row always carries its own total (`planned: cat.total`), a band heading never does. A category named
"Funding" holding $0.00 still prints a figure, not a blank.

A band row **switches the band and clears the remembered category**, rather than becoming the
remembered category as it does today. A line that appears under a band heading with no category row
between them is blocked with the existing "No category. Pick one to import this row." — honest, and
fixable in the preview.

Files with no band row at all behave **exactly as they do today**: every row is money out. That is
every hand-built sheet, every template download, and every file written before 2026-09-08.

## 4. What changes, surface by surface

### 4a. The readers — `lib/coach-budget-import.ts`
- `DraftBudgetRow` gains `direction: 'in' | 'out'` (money out is the default everywhere).
- `rowsFromList` and `rowsFromMonthGrid` both track the current band and stamp each row.
- Band detection is one shared helper, taking the row's money cells so it can apply the no-amount
  clause; the band words are read from `PLAN_LADDER_LABEL`, never retyped — the same construction
  that keeps `DERIVED_ROW_LABELS` honest.

### 4b. The vocabulary — `KnownCategory`
- `items` keeps its meaning: **the cost words**, so the template, Reference sheet, dropdowns and
  their two prompts are untouched and still spending-only.
- New `incomeItems` carries the money-in words. `incomeNameCount` is deleted — it was
  `incomeItems.length` waiting to happen, and two fields that must agree is how they stop agreeing.
- `toKnownCategories` fills both. **The import route stops building its own** and calls it instead:
  that route is the "second place in the product that builds a `KnownCategory`" its own comment warns
  about, and this change would otherwise need making twice.
- One helper answers "which words does this row match against?" — used by the snapper, the
  new-word verdict and the preview's type-ahead, so the three cannot disagree.

### 4c. The review — `reviewBudgetRows`
- Existing lines carry a `direction`, and a row matches an existing line **only on its own side**.
  Today's cost-only filter becomes a two-sided rule, which is strictly safer: the guard that stopped
  a row called "Fundraising" overwriting a funding line still stops it.
- The new-word verdict searches the row's own side, so a money-in row is never told it meant a cost
  word ("did you mean Entry Fees?" for a bottle drive).

### 4d. The write — the import route
- The item it creates for an unknown money-in word is `direction: 'in'` with `actual_source` taken
  from **the category's `income_source`** (mig 285 — the shelf decides who fills a word in), the
  same call the Add-item door makes. The duplicate-name race recovery looks up the row's own side
  rather than always `'out'`.
- The line insert writes `line_kind` from **`budgetLineKindForItem`** — the one home for that
  derivation, so a fifth money-in kind needs nothing here. An update writes it too, keeping the
  "kind agrees with its item" invariant mig 280 exists for.
- The update guard becomes side-aware: a cost row may not touch a money-in line (as today) **and** a
  money-in row may not touch a cost line.

### 4e. The preview — `BudgetImportSheet`
- A money-in row wears a quiet **"Funding"** chip under its line name — the band's own name, read
  from `PLAN_LADDER_LABEL`, which is the same record the reader matches the band row against and the
  same word the plan screen and both plan files print above those lines. The chip answers "which
  band of your file did this row come from?", so the band's name is both the honest answer and the
  one that cannot drift.
  ⚠ It said **"Money in"** (from `SIDE_FLOW_SHORT`) until the commit, and the change is worth
  recording: that record lives in `lib/coach-budget-manager-view.ts`, which is a **peer session's
  untracked file**. Committing against it would have shipped a build that cannot resolve its own
  import. A shared working copy makes "the one home for this word" a question about what is
  *committed*, not about what is on disk.
- The Line type-ahead follows the row's side: a money-in row offers the category's money-in words.
- **No per-row flip control in this build.** The band is in the file, one row above; a coach who
  wants a row on the other side fixes the sheet. Noted in §7 rather than built on a guess.

## 5. What deliberately does NOT change

- **The blank template** stays spending-only (§2).
- **Payables** are untouched — a bill is a cost by construction.
- **No migration.** Every column this needs exists; the bug is that the code never wrote them.
- **Sort order.** Imported money-in lines append at the plan's end like every other imported line and
  are grouped into the Funding band by the plan's own rollup.

## 6. Verification

- Unit: band switching in both readers (list + month grid); the no-amount clause protecting a real
  "Funding" category; a file with no bands unchanged; side-scoped matching, snapping and verdicts;
  `line_kind` derived rather than defaulted.
- **The round trip as one test**: build a plan holding both bands → write the statement rows → read
  them back → assert every line is an **update** on its own side and nothing is an add. This is the
  test whose absence let the defect live: the parser had a round-trip test, the whole door did not.
- `npm run verify:changed`, typecheck, `check:money-report`.
- Owner QA: **QA ledger §165**, with its **own walk** — `COACH_BUDGET_IMPORT_TWO_BANDS_WALK.html`.
  ⚠ The first cut of this plan folded it into §158's step C2, which described the gap; that walk was
  **taken and passed 69/69 on the morning this was built**, so editing the step would have rewritten
  a completed record. It stands as taken.

## 7. Noted, not in scope

- A per-row **side flip** in the preview (§4e).
- The template offering both bands (§2) — its own design question.
- A money-in row whose category holds **no** money-in words yet still creates one, exactly as a cost
  row does. That is the same asymmetry the template's two prompts already describe (a word is
  created, a category never is).

## 8. What the build found that the ask did not name

The reported gap was one of three, and the other two were worse. All three were invisible to every
gate and every test for the same structural reason, stated at the bottom of this section.

### 8a. Every cost line was silently dropped (since 2026-09-09 — one day old)

A cost word's row printed **flush** in the file, carrying no `— ` marker. In a flat file that marker
is the only thing distinguishing a line from the category heading above it (Excel has an outline
indent instead, which the reader also understands). So the reader took every cost row for a category
name and dropped the line — and, worse, remembered that name as the current category, so anything
after it filed under a heading the coach never wrote.

It survived until now because the **sub-rows** under each word used to carry the dash and be read as
the lines. When a word became its own line (owner ruling 2026-09-09, mig 286) the sub-rows went, and
the marker went with them. The funding half of the same file never stopped writing it.

**Fixed** by printing the marker on the cost item row, exactly as the funding item row already does.
The XLSX writer strips it from both and indents instead, so Excel is unchanged; the PDF gains the
same indent the funding rows already had, which is a consistency fix rather than a redesign.

### 8b. No row carried an amount at all (since 2026-09-02)

The money column was renamed to **`Planned`** by §133 (the Budget tab revamp). `getCell` matches a
header **exactly**, and the reader's alias list held `amount`/`total`/`cost`/`budget`/`estimate` —
never `planned`. So every row of a re-imported plan arrived with no amount and was refused with *"No
amount. Add one here, or leave the row out."*

Note what this means about the reported gap: for the last eight days a coach re-importing their plan
would not even have reached the money-in phantoms. They would have got a preview of nothing but
refusals.

**Fixed** by adding `planned` to the alias list.

### 8c. Why nothing could see any of it

The exporter has tests for every row it writes. The reader has tests for every shape it reads —
including one named *"reads the plan's own statement export back as lines only"*. Both were green
throughout.

**The reader's tests spell their own column headers and hand-write their own rows.** They were
testing a file that *resembled* ours. A test that types `'Amount'` cannot notice that the product now
writes `Planned`; a test that types `'  — Entry Fees'` cannot notice that the product stopped. Two of
the three defects were renames, and a hand-written fixture is blind to a rename by construction.

The catalog gate has the same shape of hole. `lib/export/catalog.ts` declares
`roundTrip: 'lib/coach-budget-import.ts'` for this export — a claim the platform-admin Export Registry
page and the customer help system both publish — and `check:export-catalog` verifies only that the
named reader **file exists**.

**The guard:** `tests/unit/coach-budget-plan-round-trip.test.ts` builds both plan files **from the
exporters, with `BUDGET_PLAN_COLUMNS` as its headers**, in both the CSV and the Excel shape, and reads
them back through the real reader. It asserts every line returns as an **update on its own side**;
that no band, subtotal or ladder rung survives as a line; that the month schedule survives; and that a
plan holding "Grant" as both a cheque and an application fee updates both without either touching the
other. The catalog entry now carries a headstone naming that test as its proof.

**The rule worth keeping:** a round trip is a claim about two modules, so it cannot be tested inside
either one. Build the fixture from the producer.
