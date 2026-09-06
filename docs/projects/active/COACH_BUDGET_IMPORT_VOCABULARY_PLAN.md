# Coach Budget Import — the sheet teaches its own vocabulary

**Status: BUILT on dev 2026-09-06, uncommitted — committing needs the owner’s word. Owner QA §147; walk artifact `854b93f7`, linked from the run order at step B6.**
Owner ask, in spirit: *"an accounting user who wants to import a budget file may not know exactly
the names available for the standard category/items — when we export a template, can we include all
options so they don't mistype something and create a new item simply for some slightly different
characters?"* Owner then added: **build the dropdowns too.**

Companion: `COACH_BUDGET_IMPORT_VOCABULARY_PM_BRIEF.md`.

---

## 1. The problem, stated from what the code does

### 1.1 The template shows six words out of forty-plus

`BudgetImportSheet.downloadTemplate()` builds a one-sheet file from `monthGridTemplateHeaders()` /
`LIST_TEMPLATE_HEADERS` / `PAYABLES_TEMPLATE_HEADERS` plus
`templateExampleRows(categories, headers.length)` — and that helper is capped at **`limit = 6`**
(`lib/coach-budget-import.ts`). It walks categories in order and stops after the sixth
category/item pair.

The team's actual vocabulary is the platform library (migrations 027 / 241 / 242 — nine seeded
categories, roughly four to five items each), **plus** anything the club published, **plus** the
team's own items. Call it forty to seventy words. The coach sees six of them and types the rest
from memory.

### 1.2 A wrong category is refused; a wrong cost name is silently invented

This asymmetry is the whole defect:

| What the sheet says | What happens |
|---|---|
| Category we don't hold | `reviewBudgetRows()` returns `outcome: 'blocked'`, *"No category called …"*. The coach must fix it. |
| Line name we don't hold | Row reviews as a clean **`add`**. The commit route then **creates a new `budget_items` row** for the team (`direction: 'out'`, `team_id` = this team) and links the line to it. |

The create branch is deliberate and correct in its own right — the comment on it explains that a
line with no item lands under "Not itemized" and is invisible to Budget vs. Actual, so an unmatched
name *must* produce an item. What is missing is that **nobody tells the coach it happened.**
"Tourney Fees" becomes a permanent second word beside "Entry Fees":

- it shows in the item picker forever after,
- it splits spend across two rows on Budget vs. Actual that should be one,
- and unpicking it means using the item-merge door after the fact.

Matching is `trim().toLowerCase()` on both sides, so **only** case and outer whitespace are
forgiven. `Entry  Fees` (double space), `Entry-Fees`, `Entry Fees.` and `Entry Fee` all mint a new
word today.

### 1.3 The review step's Line cell is bare free text

In the review table the Category cell is a `<select>` — a coach can fix a bad category in place —
but the Line cell is a plain `<input>` with no list behind it and no verdict beyond "Adds".

### 1.4 Secondary, same code path: the importer matches across both sides of the books

Migration 248 made a word's **direction** part of its identity — "Grant" as income and "Grant" as an
expense are two different words, and the coach's picker only ever shows one side at a time
(`panel.tsx` passes `direction` into the picker). The importer does not do this:

- the commit route selects `budget_items(id, name, org_id, team_id)` with **no direction filter**,
  so a cost row can match an income word and link a cost line to it;
- `panel.tsx` passes the same unfiltered list into `BudgetImportSheet`;
- the `23505` recovery lookup after a create race (`.ilike('name', name).maybeSingle()`) also omits
  `direction`, so where an `in` and an `out` item share a name it can match **two rows** and
  `maybeSingle()` fails — the row is then reported as *"Could not add this to your item list"*, with
  no explanation a coach could act on.

Not what the owner asked about, same twenty lines, fix it in the same pass.

---

## 2. What ships

Four parts. P1–P3 are the answer to the ask; P4 is the correctness fix above.

### P1 — The Excel template carries the whole vocabulary on a Reference sheet

The template becomes a **three-sheet workbook**:

| Sheet | Purpose | Read on re-import? |
|---|---|---|
| `Data` | The fill-in grid: headings + the six example rows we ship today. | **Yes** |
| `Reference` | Human-readable: every category and every cost name this team may use. | No |
| `Lists` | Hidden. The de-duplicated ranges the dropdowns point at. | No |

`Reference` columns: **Category · Cost name · Where it comes from** (`Standard` / `Your club` /
`This team`). A category with no items still gets a row so the coach can see it exists.

**⚠ D-G1 holds absolutely: no amount column, no suggested figure, anywhere on any sheet.** The
Reference sheet says *what a team can budget for*, never *how much*.

**Why this shape is already proven safe.** `lib/import/xlsx.ts` picks the data sheet as
`getWorksheet('Data')`, else the first sheet not named instructions/reference, else sheet one. The
tournament schedule and registrations templates already ship Instructions/Data/Reference through
this exact contract. Renaming our fill-in sheet from `Template` to **`Data`** makes it win
outright, which is what keeps the hidden `Lists` sheet from ever being mistaken for the grid — belt
and braces against the fallback depending on sheet order.

**⚠ Templates already on coaches' machines keep working.** A one-sheet file called `Template` still
parses through the fallback. Nothing on disk is invalidated.

### P2 — Dropdowns in the Data sheet

Excel list validation (`cell.dataValidation = { type: 'list', … }`; ExcelJS 4.4.0, confirmed present
in the installed typings) on the fill-in rows — rows 2 through 301, matching `MAX_IMPORT_ROWS = 300`:

- **Category** column → every category name.
- **Line** column → every cost name (month grid and simple list only; the bills template's
  Description is genuinely free text and gets no dropdown, only Category).

`allowBlank: true` and **`showErrorMessage: false`** — the dropdown *offers*, it never *refuses*. A
coach with a cost we have no word for must still be able to type it; that is the entire reason the
create-an-item path exists.

**Decision: the Line dropdown is FLAT, not dependent on the row's Category.** A dependent list needs
`INDIRECT()` over one defined name per category, and category names must then be sanitised into
legal Excel names — "League & Fees" and "Team Gear" both break the rule, a club can name a category
anything, and two sanitised names can collide. It is also the first thing to break when a coach
opens the file in Google Sheets. A flat list eliminates the typo — which is the actual ask — and a
category/name mismatch is then caught by P3, which can say something more useful than a greyed-out
cell: *"Entry Fees is already under Tournaments."*

**Decision: the list source is a range on the hidden `Lists` sheet, not an inline list.** Excel caps
an inline validation formula at 255 characters; forty-plus names blow through that instantly.

### P3 — The review step stops a duplicate word being minted

Three changes, in the order the coach meets them.

**(a) Snap trivial spelling differences to the library, before review.** A new pass runs on the
parsed draft rows — in the browser for the paste path, in the file-preview route for the upload path
— and rewrites `categoryName` / `lineName` to the library's own spelling when the *normalised* forms
match. Normalisation: lowercase, straighten curly apostrophes, `&` to `and`, drop anything that is
not a letter/digit/space, collapse whitespace.

- Snapped: `entry fees`, `Entry  Fees`, `Entry-Fees`, `Entry Fees.`
- **Not** snapped: `Entry Fee`, `Tourney Fees` — those go to (b).
- **⚠ Only when exactly one library item normalises to that form.** Migration 248's uniqueness key
  is `lower(name)`, so `Entry Fees` and `Entry-Fees` can genuinely both exist; on a tie we snap
  nothing and fall through to (b).
- **Nothing happens behind their back**: the snap lands in the draft the coach is *looking at*, so
  the corrected spelling is visible in the Line cell and can be typed back.

This is what fixes the owner's literal words — *"a new item simply for some slightly different
characters"* — and it also removes false **blocks** on categories, which today refuse a row over a
stray full stop.

**(b) A warning, with a one-tap fix, on every row that would mint a new word.** `RowVerdict` gains
`suggestion?: { lineName?: string; categoryName?: string; label: string }`. The row still reviews as
`add` — non-blocking, because a genuinely new cost must import in one pass — but the verdict column
now says one of:

| Situation | Copy |
|---|---|
| Close to a name in the same category | *New name — did you mean "Entry Fees"?* |
| Exact name lives in another category | *"Entry Fees" is already under Tournaments — this adds a second one under Facilities.* |
| Nothing close | *New name — adds "Tourney Fees" to your Tournaments list.* |

Where there is a suggestion, a small **Use "Entry Fees"** button beside it applies it to the row.

Near-match rule (deliberately dull and explainable), on normalised strings: one is a prefix of the
other with at least 4 characters in common, **or** Levenshtein distance ≤ 1 for names up to 8
characters and ≤ 2 above that. Best single candidate only; no suggestion when two tie.

**⚠ `Verdict` renders `row.reason ?? row.warning`** — reason wins. That is correct here: a row
carrying a reason is `blocked` or `update`, and an `update` matched an existing budget **line**, so
no item is created and there is nothing to warn about. Do not "fix" the precedence.

**(c) The Line cell gets a `<datalist>`** of the cost names in the row's currently selected
category. Type-ahead, still free text — consistent with the owner's standing ruling that a form
select is a dropdown, without turning a field that must accept new words into a closed `<select>`.

### P4 — Both sides of the books stop being one list

- Filter items to `direction === 'out'` where the importer reads them: the commit route's taxonomy
  select, the `panel.tsx` prop that feeds `BudgetImportSheet`, and the file-preview route.
- Add a direction predicate to the `23505` recovery lookup so it can never match two rows.
- The Reference sheet and both dropdowns list `out` words only — the importer writes cost lines and
  nothing else, so an income word in a cost template is an invitation to a bad row.

---

## 3. Deliberately not doing

- **Dumping all 40–70 items into the Data sheet as blank rows.** It reads as the product proposing a
  sixty-line budget, it fills the review screen with skipped "no amount" rows, and it does nothing
  at all for the coach who imports their club's own sheet.
- **Dependent Line dropdowns.** Rationale in P2.
- **Blocking an unrecognised cost name.** A coach must always be able to name a cost we have never
  heard of. The word is the fix, not the wall.
- **Auto-merging near-matches.** Distance-1 is a suggestion, never an action. `Entry Fee` and
  `Entry Fees` may be two real things.
- **Anything for the CSV template.** A CSV cannot carry a second sheet or a dropdown. CSV keeps
  today's headings + six examples; those coaches are covered by P3, which is the safety net that
  works regardless of where the sheet came from. Accepted tradeoff, stated in the UI copy.

---

## 4. Files

| File | Change |
|---|---|
| `lib/coach-budget-import.ts` | Normalisation + snap pass; near-match/suggestion logic; `RowVerdict.suggestion`; reference/list row builders; **`toKnownCategories`** — the one mapping all three import-sheet mounts now share. Added because each was writing it out by hand, and the day one of them needed the direction filter, all three needed it and nothing would have said so. |
| `lib/export/xlsx.ts` | Two new opt-in options: `extraSheets` and `columnChoices` (plus `choiceRowCount`). Both absent means byte-identical output for every existing caller, asserted by a test. **Also split `buildXLSXWorkbook` out of `downloadXLSX`** — the download half touches the DOM, so without the split nothing could reload the written bytes, and every claim about dropdowns and sheets would have rested on reading the code rather than the file. |
| `components/coaches/BudgetImportSheet.tsx` | Sheet name `Template` to `Data`; build Reference + Lists; wire dropdowns; suggestion button; Line `<datalist>`; template note copy. |
| `app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/import/route.ts` | Direction filter (twice, including the 23505 recovery); run the snap pass server-side before `reviewBudgetRows`. |
| ~~`.../budget-plan/import/preview/route.ts`~~ | **Not touched, and better this way.** The snap runs client-side at BOTH entry points (the pasted block and the file response), so the upload and paste paths go through the identical correction against the identical library — one place, one behaviour — and the coach sees the corrected spelling either way. The commit route still snaps again independently, which is the contract that actually matters. |
| `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx`, `.../accounting/expenses/panel.tsx`, `components/coaches/MoneyImportMenu.tsx` | All three call `toKnownCategories` instead of mapping by hand. **Three mounts, not one** — the plan named only the budget panel, which would have left two screens matching income words. |
| `tests/unit/coach-budget-import.test.ts` | Cases below. |
| `tests/unit/coach-budget-template-workbook.test.ts` *(new)* | Workbook shape + round trip. |

---

## 5. Test plan

**Unit — `coach-budget-import.test.ts`**
- Snap: each of `entry fees` / `Entry  Fees` / `Entry-Fees` / `Entry Fees.` becomes `Entry Fees`.
- Snap declines on ambiguity: with both `Entry Fees` and `Entry-Fees` in the library, neither wins.
- Snap does **not** touch `Entry Fee` or `Tourney Fees`.
- Category snap clears a block that a stray full stop used to cause.
- Suggestion: `Entry Fee` suggests `Entry Fees`; `Tourney Fees` suggests nothing; a name that exists
  in another category yields a `categoryName` suggestion, not a `lineName` one.
- Row outcome stays `add` in every warning case — a warning must never block.
- Direction: an `in` item with the same name as an `out` item is never matched or suggested.
- **D-G1 guard extended:** every Reference row is amount-free (the existing "no figure in a
  template" assertion, widened to the new sheet).

**Unit — `coach-budget-template-workbook.test.ts` (new)**
- Build the workbook in Node, write to a buffer, reload with ExcelJS: assert three sheets, that
  `Lists` is hidden, that `Data` row 2 column A carries a `list` dataValidation whose formula points
  at `Lists`, and that `showErrorMessage` is false.
- **Round trip:** feed the same buffer to our own `parseXLSX` and assert it reads the `Data`
  headers, ignores `Reference` and `Lists`, and yields the six example rows.
- Backward compatibility: a one-sheet workbook named `Template` still parses.
- `downloadXLSX` with neither new option produces one sheet and no validation.

**Gates:** `npm run verify:changed`, then `npm run typecheck` (shared module touched).

**Owner QA (browser, next free section in the ledger).** Excel and Google Sheets both:
1. Download the Excel month-grid template — three tabs, Reference lists every category/cost name, no
   amounts anywhere.
2. Category and Line cells offer dropdowns; a typed word not on the list is still accepted.
3. Fill two rows from the dropdowns and import — both land, neither creates a new item.
4. Type `Entry Fee` — preview says *did you mean "Entry Fees"?*, one tap fixes it.
5. Type `Entry-Fees` — preview already shows `Entry Fees`, imports onto the existing item.
6. Type `Tourney Fees` — preview says it adds a new name; import; confirm it appears in the item
   picker (the create path is intentionally intact).
7. CSV template still downloads and still imports.
8. A template downloaded **before** this change still imports.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Cross-sheet validation ranges render differently across Excel versions / Google Sheets | Range on a real sheet rather than an inline list or a defined name; verified by reloading the written buffer in the new test, and by the owner opening it in both. |
| 600 validation entries bloat the file | Measured in the new test; drop the row span from 300 if it is material. |
| `downloadXLSX` is used by every export in the product | Both new options are optional; absent means identical output, and a test asserts it. |
| The snap pass changes what an existing sheet imports to | Only where normalised forms match *exactly one* library word, and always visible in the preview before commit. |
| Direction filter changes matching for a team that previously linked a cost to an income word | Historic lines are untouched — the filter governs matching, not existing data. |

## 7. Follow-through

- **Help docs:** the budget-import guide describes the template; it must gain the Reference tab and
  the dropdowns. Run `/docs` in the same unit of work.
- **Demo sandboxes:** the coach sandbox's money narration does not currently mention the import
  door. Check, don't assume — this surface has gone stale across three consecutive releases.
- No migration. No plan/pricing/gating impact.
