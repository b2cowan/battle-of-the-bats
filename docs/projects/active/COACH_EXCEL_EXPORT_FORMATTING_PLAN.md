# Coach Money — Real Excel Formatting (Grouping, Bold Bands, Currency Cells)

**Status:** Planned 2026-08-25 (owner "go ahead" same day) · Build in the same session
**Scope:** The Money hub's Excel exports (all seven tabs' `.xlsx` files). CSV and PDF byte-identical to today.
**PM brief:** `COACH_EXCEL_EXPORT_FORMATTING_PM_BRIEF.md`

## The problem

Every export is built from one deliberately dumb shared shape — a flat list of rows of plain
text/numbers (`lib/coach-money-exports.ts` → `serializeRows` → `downloadXLSX`). That is why the
same report can never come out two ways in two formats, but it also means Excel receives a flat
table: hierarchy is faked with `  — ` label prefixes and ALL-CAPS section rows baked into the cell
text, and money lands as bare unformatted numbers (`2600.04`). The owner's screenshot of
"Budget by month — Actual" is exactly this.

ExcelJS (already our writer — chosen over SheetJS for its two unfixed HIGH CVEs, see
`lib/export/xlsx.ts` header) natively supports everything missing: row outline grouping (the +/−
collapse buttons in the sheet margin), per-row bold, first-cell indent, and number formats. We use
none of it today.

## Decisions (made in this plan, grounded in code)

1. **The `  — ` item prefix leaves the EXCEL cells only (owner call 2026-08-25, v2)** — Excel's
   own indent carries the nesting there. CSV and PDF keep the dash text: they have no indent of
   their own, and it is the spelling their import path reads. v1 had kept the dash everywhere
   because the budget importer's `stripLineIndent` recognized a line row **by it** (and `parseXLSX`
   trims cells, so leading spaces don't survive an upload); the round trip now holds a different
   way — **the import layer reads the styling**: `parseXLSX` marks any row carrying an outline
   level or a first-cell indent, `ParsedImportRow` carries it as `indented`, and `stripLineIndent`
   accepts that flag as the same signal as a dash. Accepted degradation, named to the owner:
   copy-pasting an exported Excel file's CELLS into a fresh sheet drops the styling and with it
   the line-vs-category distinction; re-importing the downloaded FILE is the promise, and it is
   kept. Side effect, judged an improvement: a coach's own hand-made sheet that nests rows with
   Excel outline/indent (instead of dashes or spaces) now imports correctly too.
   1b. **Item groups start CLOSED (owner call 2026-08-25).** The file opens at category level;
   the "+" opens a group. Collapsed rows are hidden, not absent — `parseXLSX` iterates hidden
   rows, so a re-imported still-folded file loses nothing. Mechanics: rows are `hidden` and
   `ws.properties.outlineLevelRow` is set to the deepest collapsed level, because ExcelJS derives
   each row's `collapsed="1"` attribute from that property (a getter, not settable per row).
   1c. **Month headers are real DATE cells in Excel (owner call 2026-08-25)** — stored as the
   month's first day, displayed `mmm yyyy` ("Feb 2026"), so the header sorts/pivots/date-maths.
   UTC-midnight dates deliberately: ExcelJS converts with pure epoch math (verified in its
   `dateToExcel`/`excelToDate` — no timezone term), so only a UTC boundary lands on the intended
   day in every locale, and it reads back symmetrically. `parseXLSX` hands such a header over as
   `2026-02-01`; `parseMonthHeader` was extended to read a full ISO date (it previously anchored
   on `YYYY-MM` and would have silently dropped every month column of a re-imported file). CSV
   and PDF keep the `Feb '26` label strings.
2. **One level of outline grouping — item rows only (level 1).** Categories, sections and totals
   stay level 0. Two-level grouping (categories under REVENUE/EXPENSES) was considered and
   deferred: the BvA statement omits the section rows when a team has no revenue categories, which
   would leave level-1 rows with no summary row above them. v1 is the robust subset.
   `summaryBelow: false` because our summary (category) row sits ABOVE its items.
3. **Number formats are display-only and round-trip-safe.** `parseXLSX` reads `cell.value` (the
   raw stored number), never the formatted text — verified before this plan was written. So a 0
   formatted to display as `—` still re-imports as 0, and empty stays distinguishable from zero.
4. **Two currency notations, per download.** The shared default is `$#,##0.00` (negative = leading
   minus), matching `money()` and every PDF. The BvA statement and month grid pass
   `brackets` — `$#,##0.00;($#,##0.00);"—"` — because that report's binding screen notation is
   brackets-for-negative and em-dash-for-zero (`fmtCell`), and its Excel file should read like its
   screen. No other tab's screen uses brackets, so no other tab gets them.
5. **Zero shows `$0.00` everywhere except the BvA pair** (where the screen's `—` rule applies via
   the brackets format's third section). The month grid's wall of `0`s becomes a wall of quiet
   dashes — the single biggest legibility win in the screenshot.

## Design

### Generic layer — `lib/export/xlsx.ts`
`downloadXLSX` gains an optional fifth argument:

```ts
opts?: {
  columnNumFmts?: (string | undefined)[];   // index-aligned with headers; data cells only
  rowStyles?: (XlsxRowStyle | undefined)[]; // index-aligned with rows (header row not counted)
}
export type XlsxRowStyle = { bold?: boolean; outlineLevel?: number; indent?: number };
```

- Any `outlineLevel > 0` present ⇒ `ws.properties.outlineProperties = { summaryBelow: false, summaryRight: false }`.
- `indent` applies to the row's first cell (`alignment.indent`).
- Width heuristic pads formatted columns a little more ($ sign + thousands separators).
- All existing callers (admin exports, roster, schedule, import templates, tryout report) pass no
  opts and produce byte-identical files. They can adopt later; out of scope here.

### Money layer — `lib/coach-money-exports.ts`
- `export type MoneyRowKind = 'section' | 'category' | 'item' | 'total'`.
- `MoneyDownload` gains `rowKinds?: (MoneyRowKind | undefined)[]` and
  `currencyNotation?: 'minus' | 'brackets'` (default `minus`).
- `downloadMoneyExport`'s xlsx branch maps: currency columns → the chosen numFmt;
  kinds → styles (`section`/`category`/`total` = bold, `item` = outline 1 + indent 1).
- `bvaCategoryRows` returns `{ rows, kinds }` (one caller — the BvA panel). Kinds:
  REVENUE/EXPENSES = section · category rows = category · item + "of which never budgeted" = item ·
  Total revenue / Total expenses / Total / Season net / Funded by players = total · buffer row plain.

### The month grid — `budget-vs-actual/panel.tsx`
`buildMonthExportRows` returns `{ rows, kinds }` (sections, categories, `— ` line items, band
totals, Net for the month + Running balance = total). `buildExport` passes `rowKinds` and
`currencyNotation: 'brackets'` for both of its shapes.

### v2 additions (owner, 2026-08-25, from the rendered file)
- `XlsxRowStyle.collapsed` + `downloadXLSX` support (hidden rows + `outlineLevelRow`); item kind
  styles as collapsed.
- `ExportColumnDef.headerMonth?: string` (`YYYY-MM`) → `downloadXLSX opts.columnHeaderDates`;
  the month-grid columns declare it.
- The xlsx branch of `downloadMoneyExport` strips the item prefix from its own serialized body
  (the CSV/PDF paths serialize separately and are untouched).
- Import layer: `ParsedImportRow.indented`, `matrixToParsedRows` `indentedRows` option,
  `parseXLSX` outline/indent detection, `stripLineIndent(value, styledIndent)`,
  `parseMonthHeader` full-ISO acceptance.

### Explicitly NOT in scope
- No new columns, rows, or cell values anywhere (Excel header month cells excepted, per 1c).
  No CSV/PDF change.
- Flat money tabs (dues, transactions, schedule, fundraisers, club) get currency formatting
  automatically via the shared path and need no caller change.
- Admin/roster/schedule/platform exports: capability available, adoption deferred.
- Freeze panes beyond the existing header row, filters, conditional colour: not now.

## Risks
- **Round trip** — held by decision 1 + 3 (both verified against the importer's actual code, not
  its docs, before writing this plan).
- **ExcelJS column-style vs cell-style ambiguity** — avoided by setting numFmt per data cell in
  the row loop, never via the column object.
- No unit tests existed on this layer; the change is presentation-only so verification is
  `lint:focused` + `typecheck` + the owner open-in-Excel walk (QA ledger **§97**).

## QA walk (owner, in Excel) — ledger §97
1. Money → Budget vs. actual → Months view → Export → Excel: file OPENS at category level
   (groups closed, "+" beside each category with lines); expanding shows dash-free indented
   line rows; REVENUE/EXPENSES/category/total rows bold; month headers are real dates reading
   "Feb 2026" (click one — the formula bar shows a date); money cells show `$`, `—` for zero,
   brackets for negative; every month still present. CSV of the same view unchanged from before
   (dashes, `Feb '26` labels).
2. Categories view → Excel: same treatment on the statement shape.
3. ⚠ Re-import the exported Excel month file (Import → Month grid), WITHOUT expanding the
   groups first: every line lands under its category with its months — the round trip holds on
   styling + date headers now, not on dashes.
4. Any flat tab (e.g. Transactions) → Excel: currency cells formatted, everything else untouched.
