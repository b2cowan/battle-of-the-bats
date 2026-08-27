# PM Brief — Real Excel Formatting for Money Exports

**What changes for the coach.** The Excel files downloaded from the Money hub stop looking like a
raw data dump and start looking like a spreadsheet a treasurer would have built by hand. On the
grouped reports (Budget by month, Budget vs. actual): section rows (REVENUE / EXPENSES), category
rows and total rows come out **bold**; the individual line rows are **indented and grouped under
their category with Excel's own +/− collapse buttons** in the left margin, so a coach can fold the
file down to categories or open one category at a time. On **every** Money tab's Excel file, money
cells become real currency cells — `$2,600.04` with thousands separators — instead of bare
`2600.04`. On the two budget reports, a zero shows as a quiet `—` (exactly as the screen shows it)
and a negative shows in brackets (ditto), so the exported file finally reads like the report it
came from instead of a wall of zeros.

**v2, same day, from the owner's first rendered file:** the groups now **start closed** — the
file opens at category level and the "+" opens a group; the `— ` dashes are **gone from the
Excel cells** (the indent replaces them); and the month headers are **real date cells**
displaying "Feb 2026", so they sort and pivot like dates.

**What does not change.** Numbers, rows and columns are identical — this is presentation. CSV
files and PDFs are byte-for-byte what they were, dashes and text headers included. "Export it,
edit it, import it back" still works: the importer was taught, in the same change, to read a
row's Excel indent/grouping as the line-row marker the dash used to be, and to read a
date-valued month header — both verified against the parser's code, including that collapsed
(hidden) rows import in full. One accepted limit: copy-pasting the file's cells into a fresh
sheet drops that styling, so re-importing the downloaded file itself is the supported path.

**Why it matters.** The exported spreadsheet is the product's handshake with people who never log
in — treasurers, club boards, accountants. A flat unformatted dump quietly says "intermediate
data"; a grouped, bolded, currency-formatted sheet says "finished report." It is also the file the
coach keeps after the season, so its quality outlives the session that made it.

**Tradeoffs taken.** One level of grouping (lines under categories) rather than two (categories
under REVENUE/EXPENSES) — the deeper version has an ugly edge case when a team has no revenue
rows, so v1 ships the robust subset. Admin-side and roster/schedule Excel exports gain the same
capability in the shared layer but don't adopt it yet.

**How to test.** Money → Budget vs. actual → Months view → Export → Excel: check bold bands,
collapsible line groups, `$`/`—`/brackets cells. Then re-import that same file via Import → Month
grid and confirm the line rows still land under their categories. Spot-check one flat tab
(Transactions → Excel) for currency cells. CSV of any view should be identical to last week's.
