# App-wide table & list consistency — the build plan

**Status:** owner approved the standard, the mockups and all seven recommendations on
2026-09-06 (*"proceed with your recommended updates"*). Built the same day on `dev`; `/simplify`, `/review` and `/docs` passed 2026-09-06 (see the register changelog); owner QA §149 in progress — first finding fixed, see §6.1; A-08 open; committed `07321b4a` 2026-09-07.
**Standard:** `docs/agents/design/TABLE_AND_LIST_STANDARD.md` · **Register:**
`docs/agents/design/TABLE_EXCEPTION_REGISTER.md` · **Evidence:**
`docs/agents/design/TABLE_INVENTORY_2026-09-06.md` · **Mockups + decisions:**
https://claude.ai/code/artifact/0aa319dd-a6eb-4fff-b09b-df8591475fe1 · **PM brief:**
`APP_WIDE_TABLE_CONSISTENCY_PM_BRIEF.md` · **Owner QA:** the ledger section claimed at build's end.

## 0. The rulings this build is built to (owner, 2026-09-06)

| Id | Ruled | Consequence in this build |
|---|---|---|
| A-01 | **Density by content** — a one-line row takes the compact height, a two-line row the comfortable one | coach list rows carrying a caption keep 0.7rem; every other list row drops to 0.42rem |
| A-02 | Platform admin body **14px in the data face** | the platform shell keeps mono; the size comes from the ladder |
| A-03 | **Delete** the register's zebra rule | the rule that never painted is removed, not defined |
| A-04 | Worklists remember what you closed; reports open on their totals; **the guide says which is which** | one sentence in the help; no code |
| A-05 | Public tables **adopt the heading, hairline and hover tokens; keep 16px padding** as a documented exception | standings/results/pricing headings and rules move to tokens; row height unchanged (register K-16) |
| A-06 | Column headings keep the **condensed display face** | written into the baseline as a decision, no visual change |
| A-07 | The money grids' private ladder stays **K-02** | untouched |

Everything else follows the standard verbatim. **No new rulings are taken in this build**; anything
that turns out to need one becomes an ASK row in the register and waits.

## 1. Phases, in the order the standard's §8 argues (by reader impact)

### P1 — The baseline becomes the standard (F-01 · F-03 · F-11 · A-06)
`app/globals.css`. The global `th` / `td` element rules stop being a recipe by accident and become
the standard's baseline: heading `--type-support` in the display face, uppercase, `0.05em`,
`--text-secondary`, `--home-line` rule; cell `--type-body`, `--text-primary`, `--home-line` rule,
compact padding from a new `--table-pad-compact` token (with `--table-pad-comfortable` and
`--table-pad-register` beside it). The global `tbody tr:hover` tint is **deleted** — hover belongs
to a row that opens, and the recipe that makes it open paints it. The light-mode `thead tr` ground
override goes with it (the heading ground is the card, 2026-08-15).
**Blast radius, stated:** every table with no cell rule of its own changes at once — the admin
dashboard's registration table, tournament Manage, the settings tables, help tables, the account
notifications table. That is F-11: those tables were wearing the accident, and now wear the
standard.

### P2 — The coach list family (F-02 · F-04 · F-09 · F-10 · F-14 · F-15 · A-01 · A-03)
`app/[orgSlug]/coaches/coaches.module.css`, edits confined to the named rules:
- `.tableWrap` frame → `--home-line` (was the accent tint). One frame, list and report alike.
- `.td` row rule → `--home-line` (was `--white-05`, paper in warm); padding → `--table-pad-compact`.
- **Density by content:** `.tr:has(.listRowSub), .tr:has(.rowSubNote), .tr:has(.guardianStack),
  .tr:has(.payBillMeta)` → `--table-pad-comfortable`. The rule names the four caption classes the
  portal actually renders inside a list cell (verified by grep), so a row is comfortable because it
  *holds* a second line, never because of which screen it is on.
- `.tr:hover .td` → `.tr.rowTappable:hover .td` — hover only on a row that opens. Rows that open
  and do not yet carry `.rowTappable` get it (Player Dues).
- The register: its `0.28rem` density moves onto `--table-pad-register`; the two zebra rules are
  **deleted** (A-03); `.registerBalanceRow`'s undefined `--white-4` becomes `--home-fill`.
- `.insightsTable`: heading ground → card; `tabular-nums` on the table (F-09's alignment half needs
  the panels to mark numeric cells — done for playing-time and results where a class exists,
  otherwise listed as remaining).
- `.devBoardTable th` → the baseline heading (was 11px mono, tertiary) (F-15).

### P3 — Platform admin (F-05 · F-06 · A-02 · K-10)
`app/platform-admin/platform-admin.module.css` gains the shell recipe: `.shell table` in the data
face (K-10). The fourteen modules that each restate `.table th` / `.table td` lose every
declaration the baseline now owns (size, tracking, case, ink, rule, padding) and keep only what is
theirs (column widths, a clickable row's hover at lime 6%). Generic `.table tr:hover` rules go —
platform rows that open carry `.clickableRow` / `.rowLink`, and only those tint.
**F-12 (a phone card shape for the platform shell) is built as a global `.table-cards` recipe and
applied to Orgs and Users in this pass**; the other twelve tables need their cells labelled one
file at a time and are listed under §4 as the remaining work, with the recipe ready for them.

### P4 — Tournament admin (F-07 · F-16 · K-13)
The five heading treatments become one: `.tableHeader` (the flat-row label row), the schedule
health table, the role matrix and the notifications table take the baseline heading — size,
tracking, ink — in the data face the shell keeps (K-13 keeps the row shape). Check-in's row
controls take the touch floor at ≤ 768.

### P5 — The Months view and target width (F-08 · F-19)
`components/coaches/MoneyMonthGrid.module.css`: the figure doors take `--tap-min` both ways at
≤ 768, exactly as the Statement's already do. `.moneyGridToggle` fills its lead cell so the
semantic control's hit box is the cell, not the category's name.

### P6 — Public tables (A-05 · F-20 · K-11 · K-16)
Standings and results: heading → `--type-support`, `0.05em`, `--text-secondary`; keep the 16px
padding (K-16) and the centred figures (K-11); no hover. Pricing comparison: heading and body sizes
from the ladder; compact padding; the lime category rows keep their tint (structure).

### P7 — Enforcement (standard §9)
1. `tests/unit/table-recipe-guard.test.ts` — parses every module's table-part rules and asserts:
   every `font-size` on a th/td/row-class is a `--type-*` token (or `--money-*` inside `.moneyGrid`,
   or the line carries `table-exception: K-nn`); every hairline/frame colour is a line token; and
   **every `var(--x)` referenced in a table rule names a token that is defined somewhere in the
   stylesheets** (this would have caught F-04). Proven by breaking it.
2. `scripts/check-layout-invariants.mjs` — a `control-width` rule at touch widths for icon-only
   controls (≥ `--tap-min` wide), and a `type-ladder` rule at 1440 asserting every visible cell's
   size is a ladder value (membership, not pixels).
3. `scripts/layout-screens.mjs` — a `storage` hook on a screen entry so the report views the default
   URL never shows (Months, By activity, By period) are addressed and swept.

### P8 — Records
Register changelog (each FIX row → its commit), standard status → APPROVED, the seven rulings
logged in `memory/design_decisions.md`, the help sentence for A-04, TODO, and an owner QA walk as a
checkable Artifact claiming the next ledger section.

## 2. Deliberately not in this pass

- **F-17** (one recipe for the coach portal's eight div-based row lists) — the owner approved the
  table mockups; the row lists were not drawn and each is a feature surface. Own session, with its
  own frames.
- **F-18** (club-side admin `<table>` modules) — no fixture can render them. Blocked on one fixture
  decision (a member on `qa-families-fixture`, or seeding the club fixture org); measure first.
- **F-12 beyond Orgs and Users** — twelve platform tables, one file each (§4).

## 3. Verification

`npm run typecheck` · `npm test` · `npm run verify:changed` (css-selectors, css-purity, contrast,
text-contrast, spelling, lint) · `npm run check:layout -- --only=<the coach money tabs, roster,
attendance, insights, tadmin-*, platform-*>` at 361/390/768/1440 · **re-run the review's own
measurement on the changed surfaces and read the numbers back against the standard** (row heights
40/47/65–69, body 14, heading 12, hairline token, hover only on target rows) · a browser pass of
`:has()` density on the Club tab and Player Dues in both skins. State any skipped check.

## 4. Remaining after this pass (positive facts, no perishable negatives)

**Built and verified 2026-09-06** (uncommitted at the time of writing; the register changelog
lists what landed per row): P1–P7 as above, with these measured read-backs on the changed
surfaces — Player Dues one-line rows 47 → 37px with Avery's two-line row at 64; Club two-line rows
67–71 and its one-line row 40; body 14 on every coach list, insights and devBoard table; headings
12 in the display face on the platform console (from 8.8), tournament settings (from 11.2 mono),
Manage (from 12.8) and public standings; `--home-line` under every row in both skins; the Months
view's figure doors 44 × 44 at 390 (from 44 × 26); Orgs and Users as cards at 390. Gates: typecheck ·
3,099 unit tests (the new guard included, which caught a second undefined token, `--white-15`) ·
css-selectors · css-purity · contrast · text-contrast · spelling · public tokens · root · lint
0 errors · rendered sweep on 19 coach screens at 361/390/768/1440 with `type-ladder` reporting
nothing and the money grids' toggles and expanders clearing the floor to 768. The 129 findings the
new rules surfaced on pre-existing chrome are in the baseline with reasons (F-21 / F-22 / F-23).

| Item | State |
|---|---|
| F-12 phone cards: change requests, early access, email, email templates, exports, feedback, observability, audit, bulk operations, plans & pricing, retention, org detail | recipe built in P3 (`.table-cards`, global); each table needs `data-label` on its cells |
| F-06 tail: cell-level literals inside platform cells (`.tsCell`, `.emptyCell`, `.rowError`…) and the tournament settings notifications table's 0.85rem cell padding | judged by the rendered `type-ladder` rule when those screens join the sweep; one file each |
| F-09 alignment on insights tables whose panels do not mark numeric cells (playing time) | **DONE 2026-09-07** — `.insightsNumHead` pairs with `.insightsNum`, six figure columns headed right and six figure-plus-words columns returned to left (§6.1) |
| F-17 coach row lists | own session, own mockups |
| F-18 club admin tables | blocked on fixture; measure before touching; pinned in the guard's KNOWN_DEBT |
| F-21 · F-22 · F-23 portal chrome and inline links under the touch floor | surfaced by the new rules; in the baseline with reasons; COACH_TOUCH_TARGET_DEBT_PLAN |
| A-08 admin shell control height inside a table at touch widths | owner decision (register) |

## 5. Risks named before the work

- **The same stylesheet carries uncommitted §146 and §148 work from other sessions.** This build's
  edits are confined to named rule blocks so the eventual commit can be split by hunk; the
  reconstructed-blob staging method in memory applies, never hunk-picking by eye.
- **The global baseline reaches every unstyled table.** That is the point (F-11), and it is why
  P1 is verified by a rendered sweep across four shells, not by reading the diff.
- **`:has()`** is used for density by content. It is supported by every browser the product
  targets in 2026; the alternative (a row class in thirteen files) drifts the first time a row gains
  a caption without the class.

## 6. QA §149 findings, fixed as they are found

### 6.1 The Insights tables were headed left over right-aligned figures (2026-09-07)

**What the owner saw.** On Insights → Playing Time, every figure column's heading sat hard left
while its figures sat hard right — the widest gap being "BACK-TO-BACK SITS" with its dash 170px
away from the start of its own heading.

**What it actually was — a regression from this plan's own commit.** Before `07321b4a`,
`.insightsNum` was `tabular-nums` + `nowrap` and set **no** `text-align`, so figures inherited
left and matched their left headings. P2 gave the cells `text-align: right` (correctly — that is
F-09) and gave the headings nothing. Half a fix reads worse than none: the columns had been
consistent, and the pass made them inconsistent.

**And the class had been applied to six columns that are not figure columns.** Reading the columns
rather than the class turned up a second, quieter half: `.insightsNum` had also been right-aligning
two **date** columns (standard §3.4 says dates left; on Results it is the *first* column, so the
date was pushed rightward into the game name) and four **figure-plus-words** columns — Pitching
("3 IP · cap 1/g ⚠ over cap ×2"), Arm care's Season, Last outing and Your per-game cap. Those
suffixes vary per row, so right alignment lines up the end of a sentence and puts the leading
figure at a different x on every row.

**Fixed:**

| | Columns | Treatment |
|---|---|---|
| Headings moved right to meet their figures | Playing Time · On field, Bench, Back-to-back sits · Which lineup wins · Record, Times used · Results · Score | new `.insightsNumHead`, written `.insightsTable th.insightsNumHead` so it out-specifies `.insightsTable th` (0-1-1) rather than relying on source order the way `.thNum` must |
| Returned to left | Playing Time · Pitching · Arm care · Season, Last outing, Your per-game cap | `.insightsNum` dropped; tabular figures still come from `.insightsTable` itself |
| Returned to left, shrink-to-fit | Results · Date · Awards · Date | `.tdShrink` (existing utility — nowrap, and the slack goes to the name column beside it) |

**One shape change.** "On field" carries a 64px share bar. It used to trail the number, which made
the **bar's** edge the column's right edge — so a right-aligned heading would have sat over the bar
with the digits still floating, the half-fix that leaves the original complaint standing. The bar
now **leads** its figure (its margin moved left → right), so On field and Bench read as the pair a
coach compares them as.

**Also:** `.ptMatrixHead` dropped its `!important`. It only ever needed the specificity the new
pair now establishes, and the position-recency matrix had been solving this same problem alone.

**New rule, recorded in the standard §3.4:** a column earns right alignment only if every row ends
at the same semantic place. A figure followed by varying qualifying words is a text column that
begins with a number.

**Gates:** `check:css-selectors`, `check-css-module-purity` and focused ESLint on the three panels
all clean. No copy, terminology or flow changed, so no help-docs or demo-narration follow-up.
