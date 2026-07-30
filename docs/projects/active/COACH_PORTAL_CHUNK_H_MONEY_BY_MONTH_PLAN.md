# Coach Portal Chunk H — Money by Month — Implementation Plan

> **Status:** **H1 (the view half) BUILT ON DEV 2026-07-30 — uncommitted.** D-H1…D-H10 **and the
> sequencing call ALL RATIFIED** at the recommendations ("agree with your recommendations"), so
> **H2 (import) is planned + mocked but deliberately NOT in this pass** — it gets its own
> undivided HIGH-tier review. NO migration, as predicted.
>
> **Build deviations / decisions taken during the build (flag at QA, each with its reason):**
> - **The month range extends to a 6-column minimum only when the range is DEGENERATE** (nothing
>   dated, or everything in one month). A genuine five-month season keeps five columns — padding a
>   real range would invent a month nothing lives in. The plan's wording implied always-6.
> - **Money in is player dues ONLY.** Fundraiser proceeds already credit dues, so counting both
>   would count the same dollar twice. The cash-flow strip says so on screen.
> - **Line rows read "—" under the Scheduled and Actual lenses**, because a commitment or a payment
>   is matched to a CATEGORY, not to a line (there is no payable↔line link, by ruling). The grid
>   says this out loud rather than inventing a per-line split. Same shape the shipped category view
>   already uses.
> - **`?periods=1` on the drill-in also sets the discard-guard BASELINE.** Opening the period split
>   for the coach is our doing, not their work, so an untouched deep-linked form still closes
>   silently. This collapsed the memoised `editingLine ? formFromLine(...) : addBaseline`
>   derivation into ONE `formBaseline` state set by every open path (a simplification, not a new
>   concept — `formFromLine` is still the single mapping).
> - **The lens buttons carry an `aria-label` with the full word.** The visible label abbreviates on
>   a phone ("Diff."); the accessible name must not.
> - **The undated and current-month columns are marked with rules and header ink, not a cell fill.**
>   A fill would have to fight the category row's own opaque ground, and the loser would be the
>   pinned column's opacity (Chunk A D3).
> - **`.modalFlushFooter` uses a DESCENDANT selector**, so a footer inside a conditional wrapper
>   can't silently fail to satisfy it — the "unsatisfiable contract" failure mode Chunk A named.
>
> **`/simplify` applied:** the lens maths moved into the pure module (`lensCell` / `lensTotal` /
> `lensReadsPlan`) and is now shared by the grid AND its export, so a downloaded file cannot
> disagree with the screen · the three cash-flow rows collapsed into one row spec · the schedule
> tab's row type reuses the payables panel's `PayableItem` instead of restating it · the route's
> private `toMonthKey` retired in favour of the shared `monthKeyOf` · the season-total/buffer
> reconciliation now happens ONCE in the route instead of twice. **Skipped:** hoisting the 14
> copies of the local `fmt()` currency helper into a shared util — a real duplication, but it is
> the portal's established convention and the fix reaches well outside this diff.
>
> **`/review` found and fixed two real defects in this chunk's own code:**
> 1. **The prior-season column could double-count.** Two current lines matching one prior line (or
>    one prior line matching lines in two categories) inflated the category and grand totals. The
>    index now holds prior LINES, and totals sum the DISTINCT set. Regression test added.
> 2. **The month view omitted the non-itemized buffer**, so a team with a season total above its
>    itemized sum saw a smaller Total in Months than in Categories — the same page reporting two
>    budget totals, which is the exact failure D-H4 exists to prevent. The buffer now renders as
>    its own row in the "No date yet" column. Regression test added.
>
> **`/docs`:** the Money guide gained the month view + four lenses, the cash-flow strip and the
> shortfall sentence, the prior-season column, the payment-schedule tab and the payable
> generalization; "Tournament Payables" retired throughout the body while the old phrase is kept in
> `searchText` so a coach who learned the old name still finds the page.
>
> **Gate:** `tsc --noEmit` 0 errors · `npm test` **506/506** (24 new for the month module) · focused
> lint 0 errors · `verify:changed` fully green (**all six colour-token baselines unchanged**; the
> new CSS module joined the guardrail at zero literals, 205→206) · Playwright Money suite extended
> to **26 tests** (10 new + the renamed-payables fix), 30/30 green including auth setup.
>
> **Remaining:** clean dev restart → owner QA → commit with per-action OK.
>
> Original planning header follows:
> **Mockups (approval = binding visual spec):** `claude.ai/code/artifact/ab72877e-c0e7-4a46-a1ce-89e6982c104e` rev 1 — 7 frames, every element labelled NEW / RESTYLED / UNCHANGED.
> **Branch:** dev (ONE shared branch; tree shared with an active concurrent session)
> **Source:** `PROGRAM_COACH_PORTAL.md` §1.1 chunk H (owner-raised 2026-07-30 at Chunk G approval; direction RATIFIED). Build prompt: `COACH_PORTAL_CHUNK_H_MONEY_BY_MONTH_BUILD_PROMPT.md`.
> **PM brief:** `COACH_PORTAL_CHUNK_H_MONEY_BY_MONTH_PM_BRIEF.md`.
> **Predecessors whose contracts bind here:** Batch 1 `934e5275` (sheet default ≤640, `CoachModalHeader`, `useOverlayOpen`, one-column `.formGrid`) · Batch 2 `8040f4e6` (`CoachFormDisclosure`, >8-field rule, per-row bulk outcomes) · Batch 4 `13e2c021` (mirrored events; device-memory markers) · Chunk A `a737acbf` (list-vs-grid D1, `CoachScrollX` D2, pinned-gutter D3, `useDiscardGuard` D4, `.pageWide` D5) · Chunk G `06f77442` (**D-G1 no product-supplied dollar**, derived-checklist rule, education-vs-write gating split).
> **Already decided by the owner (2026-07-30), NOT open:** the month grid's shape (rows = category/line, columns = months, totals both ways, desktop-first, four-lens toggle, drill-ins through the EXISTING forms) · **Scheduled is a separate LENS, never a write into the budget column** (no payable↔line link migration in v1) · payables generalize beyond tournaments + one full payment-schedule view · import/export templates round-trippable, preview-first, **amount cells ship EMPTY**.
> **Plan gating:** Premium Coaches Portal only. **No billing-plan change.** ⚠ The coach importer is gated by `money: write` ONLY — it must **not** borrow the admin Data Tools gate `bulk_data_imports` (an org Tournament-Plus feature; borrowing it would silently paywall a premium coach behind an unrelated org plan). `PLAN_PRICING_FACTS.md` untouched.
> **Migrations: NONE expected.** Verified feasible — see ground truth. If a schema change appears mid-build, stop and re-scope. One sanctioned non-migration API change: an explicit client-supplied `sortOrder` on the lines POST (see §Design 9).

---

## Goal

A treasurer-coach runs the season in a month-columns spreadsheet — *what do we pay, when, and how
did it actually land*. The portal already computes every one of those numbers and shows almost none
of them. Chunk H puts the month view on screen: **rows = category → line, columns = the season's
months, cells = amounts, totals both ways**, with a **Budget · Scheduled · Actual · Difference**
lens toggle, cell drill-ins that open the forms that already exist, a forward cash-flow strip that
answers *"do we run dry in July?"*, a prior-season comparison column, generalized payables plus one
full payment-schedule view, and spreadsheet import/export that round-trips — with **every amount
cell in every template shipped empty (D-G1)**.

---

## Ground truth — VERIFIED by direct read 2026-07-30 (this session). Re-confirmed beyond the build prompt; five findings matter.

### The monthly math already runs — and the grid must NOT inherit its one dishonesty

`app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts` already:
- collects `monthSet` from every period `period_date` **and** every paid-expense date (§8);
- buckets `budgetByMonth` from each line's dated periods;
- buckets `actualByMonth` by `paidDate(exp)` (earliest of `expense_paid_at` / `deposit_paid_at` / `balance_paid_at`);
- computes `paidAmount(exp)` — a plain expense counts when `expense_paid_at` is set; a payable counts deposit + balance **independently**, each on its own `*_paid_at`.

⚠ **Lines with no dated periods are smeared evenly across every month** (route lines ~292–300:
`share = unperiodedBudget / months.length`). That is invisible in a cumulative chart and would be a
lie in a grid — a coach would see budget in months they never assigned. **The grid gets an explicit
leading "No date yet" column instead** (D-H3), and the cumulative chart on the same page must stop
smearing too, or one page will state two different things about the same dollars (D-H4).

### `rep_program_years` has NO season start/end dates

Columns are `year`, `name`, `status`, `budget_amount`, `tryout_open`, … — **no date span**
(verified in `docs/agents/db/DATA_DICTIONARY.md`). So the month range **cannot** be read off the
season; it must be derived from the team's own dated money events (D-H2).

### Payables are already general — only the words are tournament-specific

`rep_team_expenses.expense_type` is CHECK'd `expense|tournament_payable`. A payable already
supports **one amount + one due date** (deposit fields with no balance), the deposit/balance split
is an optional `CoachFormDisclosure`, each half carries its own due date and `paid_at`,
mark-paid posts straight into the actuals ledger (so "actualized" is continuous, not month-end), and
the form already uses the full shared category picker with the honest
"this will show as Unbudgeted" hint. **The stored enum value `tournament_payable` does NOT change**
— renaming it would be a migration for zero user benefit. Only labels, copy and framing change.

### Cash-flow ingredients all exist; the prior-season column is derivable

Dues installments carry `due_date` + `amount` + `paid_at` (money in, scheduled and actual) ·
payables carry `deposit_due_date` / `balance_due_date` (money out, scheduled) · expenses carry paid
dates (money out, actual) · `lib/rep-season-rollover.ts` carries lines + periods + the season
envelope forward, so a year-2+ team's prior-year `rep_budget_lines` are readable by
`program_year_id` and matchable by item link or name.

### ⚠ The line **PATCH** has the taxonomy-ownership gap the POST had (Chunk G's review flagged it — CONFIRMED)

`budget-plan/lines/[lineId]/route.ts` lines 76–77 assign `categoryId` / `itemId` straight from the
body with **no `org_id IS NULL OR org_id = ctx.org.id` check**, while the POST was hardened in
Chunk G. A crafted PATCH can link a line to — and echo back the name of — another org's custom
category or item. **Fixed in this chunk** (§Design 10), with a probe.

### Import: reuse the portal's own precedent, not the admin importer

Two different things exist and must not be confused:
- **Admin Data Tools** (`lib/import/tournament-teams*.ts`, `import_batches`, plan gate
  `bulk_data_imports`) — durable preview batches, org-plan gated. **Not this.**
- **The coach roster bulk-add** (`components/coaches/RosterBulkAddSheet.tsx` +
  `lib/coach-roster-bulk.ts` + `roster/bulk/preview` + `roster/bulk`) — paste tab **and** file tab,
  one shared draft-row model, an **editable** preview table, commit returning
  `created` / `failed` / `skipped` / `warnings` per row, and an explicit refusal to dress a
  total failure up as success. **This is the pattern H copies.**
The generic parsers (`lib/import/{csv,xlsx,tabular}.ts` — `parseCSV`, `parseXLSX`,
`matrixToParsedRows`, `normalizeHeader`) are domain-free and are reused server-side.

### The sticky-footer overlap is a SHARED defect with two local patches

`.modalFooter` bleeds `margin: 1.25rem -1.5rem -1.5rem` so its background reaches the modal edge.
On a **sticky** footer inside a scrolling `.modal`, that negative bottom margin shortens the scroll
extent by 24px and permanently hides the last ~1.5rem of a tall form. The @640 branch already
zeroes it **with a comment naming exactly this bug** (`coaches.module.css` ~3166); desktop still
has it. Three local patches exist: `.eventFormModal .modalFooter { margin-bottom: 0 }` and Chunk G's
two `footerFlush` copies. **Generalized here** (§Design 10).

---

## Decisions for the owner (mockup round)

| # | Decision | Recommendation |
|---|----------|----------------|
| **D-H1** | **Where the month grid lives.** | **A "Months" view toggle on Budget vs. Actual**, beside the existing category view. It already owns budget/actual/variance, already loads every ingredient, already has the wide-page opt-in and the `CoachScrollX` idiom. A new nav item would make Money's fourth section a fifth. |
| **D-H2** | **The season's month range** (their sheet runs Sep–Aug). | **Derive it, contiguously, from the team's own dated money events** — period dates, expense paid dates, payable due dates, dues due dates — from the earliest to the latest, so months with nothing in them still appear (a spreadsheet has no gaps). Anchor a minimum window on the season year so a brand-new plan isn't a one-column grid. Cap at 24 columns and say so if clipped. **No fixed Sep–Aug assumption** — the platform is Canada-wide and multi-sport. |
| **D-H3** | **Undated budget lines.** | An explicit leading **"No date yet"** column, never invisible smearing. For a write coach the column header carries a quiet "add dates" affordance; for read-only it is a plain column. |
| **D-H4** | **The cumulative chart on the same page currently smears undated budget across months.** | **Fix it in the same pass** — exclude undated budget from the monthly series and state the excluded amount in one line under the chart. One page must not tell two stories about the same dollars. (Small visual change to a shipped chart — flag at QA.) |
| **D-H5** | **Lens set + what "Difference" means.** | Budget · Scheduled · Actual · Difference, **Difference = Budget − Actual** (positive = under). **Future months show "—" in the Difference lens**, not a full-budget "under" — nothing has happened yet and calling that a saving is dishonest. Scheduled is read-only in v1. |
| **D-H6** | **Cash-flow projection: v1 or fast-follow?** | **v1**, and as **three extra rows inside the same grid** (Money in · Money out · Running balance), not a separate widget — it reuses the month columns exactly, adds no new layout, and answers the question in the coach's own row-and-column language. **It projects using the lens you are viewing** (Budget projects the plan, Scheduled projects commitments), never a blend — which is what keeps the "Scheduled never merges into Budget" ruling intact and removes every double-count guess. Hidden under the Difference lens (it has no meaning there). |
| **D-H7** | **"Last season" comparison column: v1 or fast-follow?** | **v1.** Rollover already carries the data, it is one extra query, and their own spreadsheet has the column. Renders only for a team with a prior season that has lines; matched by item link first, then case-insensitive name. |
| **D-H8** | **Import v1 scope.** | **All three templates.** The preview machinery is genuinely shared: one parser → one draft-row model → one editable preview table → one commit with per-row outcomes; only the column map and the writer differ per template. ⚠ **But see the sequencing question below** — import is the half of this chunk that can be lifted out cleanly if the owner wants the view sooner. |
| **D-H9** | **Payables rename + where the full schedule lives.** | Page becomes **"Expenses & Payables"**; the tab becomes **"Payables"**; the form becomes "Add Payable" / "Payment schedule". The full commitment list is a **third tab on the same page** ("Payment schedule"), not a new Money section — commitments belong beside what creates them, and Money's hub already carries the 90-day preview panel, which gains a "See the full schedule" link. **Stored value `tournament_payable` unchanged.** |
| **D-H10** | **The sticky-footer sweep.** | **Fold it in here.** It is a shared-primitive fix with three local copies already; leaving it out means a fourth copy for H's own tall modals. |

**Sequencing question for the owner (the only scope call in this plan):** H is large — the view
half (grid, lenses, drill-ins, cash flow, prior season, payables, payment schedule, exports,
hardening) and the import half are independently shippable, and the build prompt's own definition of
done anticipates this ("HIGH review tier **if import ships**; standard only if import slips to a
fast-follow"). **Recommendation: build and QA the view half first (H1), then import (H2) immediately
after, against the same approved mockups.** The owner sees the month grid sooner, and the new write
path gets its own undivided HIGH-tier review instead of sharing one with a 2,000-line view change.
Both are planned and mocked now either way.

---

## Design

### 1 · The Months view (Budget vs. Actual)

A segmented control (`.segChoice` — the shipped control, per Chunk G's deviation note) at the top of
the report: **Categories** (today's view, default) · **Months** (new). The choice is device memory
(`localStorage`, per team+season — the winding-down / Moved-marker pattern), so a treasurer who
lives in the month view lands there.

**The grid** — a genuine 2-D comparison, therefore `CoachScrollX` with the first column pinned and
its honest hint (Chunk A D1/D2/D3; never `.tableAsCards`):

```
Line / Category      [2025]   No date yet   Sep '26  Oct '26  Nov '26 …   Total
▼ Tournaments                        —        1,200      —      2,400     4,800
    Entry Fees                        —        1,200      —      2,400     3,600
    Uniforms                        900          —       —         —        900
▼ Officials                         …
──────────────────────────────────────────────────────────────────────────────
  Total                             900       1,200      —      2,400     …
  Money in                            —       2,400   1,200        —      …
  Money out                         900       1,200      —      2,400     …
  Running balance                  -900         300   1,500     -900      …
```

- Categories collapse/expand exactly as they do today (same `expandedCats` state, same chevrons).
- First column pinned via `shared.scrollXStickyCell` + `--scrollx-pin-gutter` for the line indent.
- Two breakpoints only (900 / 640). The grid is desktop-first and **scrolls** on a phone — it is a
  comparison, and Chunk A's D1 forbids card-stacking it.
- Column totals across the bottom, row totals in the trailing **Total** column.

### 2 · The four lenses

One segmented control under the view toggle. Each lens repaints the same cells:

| Lens | A cell holds | Source |
|---|---|---|
| **Budget** | the plan for that month | dated `rep_budget_periods` amounts, by `period_date` month; undated line totals → the "No date yet" column |
| **Scheduled** | commitments falling due that month | payable `deposit_amount`@`deposit_due_date` + `balance_amount`@`balance_due_date`, mapped to a category by the same case-insensitive category-name match the actuals use |
| **Actual** | cash actually paid that month | `paidAmount(exp)` at `paidDate(exp)` |
| **Difference** | Budget − Actual, **elapsed months only** | computed; future months render "—" |

**Scheduled never writes into Budget.** Nothing merges, nothing double-counts, no payable↔line
link, no migration (owner ruling). A category with commitments but no plan lines appears in the
Scheduled lens under its own row, so a coach can *see* the gap they'd otherwise miss.

### 3 · Cash-flow rows (D-H6)

Three rows below the grand total, inside the same column frame, with a one-line basis statement
above them ("Projected with the **Budget** lens — your plan, not your commitments"):

- **Money in** — dues installments by `due_date` (and by `paid_at` under the Actual lens) +
  fundraiser proceeds already credited.
- **Money out** — the currently-selected lens's own money-out figure for that month.
- **Running balance** — cumulative `in − out`, coloured only when it goes negative, with the
  first negative month called out in plain words under the grid
  ("On this plan you go short in **July** — about $1,240.").

### 4 · The prior-season column (D-H7)

A single leading money column labelled with the prior season's year, rendered only when a prior
`rep_program_years` row with budget lines exists. Values are last season's line totals matched by
`item_id` first, then case-insensitive description/item name. Unmatched prior lines roll into a
quiet "Last season only" group at the foot of the grid — a line they had last year and have not
planned this year is exactly the thing this column exists to reveal.

### 5 · Drill-ins — the grid navigates, it never edits

Binding: **the grid is a navigation surface, never a new editor** (owner ruling).

- **A Budget cell** (write coach) → the existing Add/Edit Budget Line modal, with the line's
  payment periods open. That form lives on the Budget page and is ~400 lines of state; it is
  **not** duplicated. The cell deep-links to `…/accounting/budget?line=<id>&periods=1`, and the
  Budget page opens the modal on arrival — the exact `?generate=1` / `?starter=1` recipe already
  shipped there (one-shot ref, write-capable only, silently ignored otherwise).
- **An Actual cell** → a small read-only panel listing that month's paid expenses in that category
  (description · paid date · amount), each linking to the Expenses page. No editor.
- **A Scheduled cell** → the same panel shape, listing that month's commitments, linking to the
  Payables tab.
- **Read-only coaches** get the read panels and no budget drill-in. (Chunk G rule 4: write surfaces
  gate on write; reading doesn't.)

### 6 · Payables, generalized (D-H9)

Presentation only — no schema change, stored `expense_type` untouched.

- Page title **"Expenses & Payables"**; tab **"Payables"**; modal **"Add Payable"**; the disclosure
  keeps its "deposit now, balance later" explanation but stops saying *tournament*.
- Empty state, hub card, nav label, and the Money hub's Spend card copy follow.
- The `useDiscardGuard` noun becomes `payable`.
- **Sport-neutral, tournament-neutral copy** throughout ("a commitment you've agreed to pay").

### 7 · The Payment schedule tab (D-H9)

A third tab on Expenses & Payables: every money-**out** commitment in one list, ordered by due date
— payable deposits and balances, plus org-allocation installments when the team is org-linked.
Filters: **Unpaid (default) · Paid · All**. Overdue rows carry the existing overdue treatment
(`isInstallmentOverdue`, org-timezone `tournamentToday()` — never raw UTC date math). It is a LIST,
so `.tableAsCards` at 640 (Chunk A D1). Mark-paid works inline for write coaches, using the existing
`markDepositPaid` / `markBalancePaid` actions.

Server: extend `upcoming-payables` with `?includePaid=1&days=0` (0 = no window) rather than a new
route — same lanes, same shapes, one gate. The Money hub panel is unchanged and gains a
"See the full payment schedule →" link.

### 8 · Export (round-trip)

The BvA `ExportMenu` gains a **month-grid** export in XLSX/CSV/PDF whose columns are exactly the
import template's columns, so today's export is tomorrow's import. PDF stays landscape-friendly by
exporting the visible lens only, named in the title ("Budget by month — Actual").

### 9 · Import (H2 if the owner splits) — preview-first, per-row outcomes, never all-or-nothing

**Three templates, one machine.** New pure module `lib/coach-budget-import.ts` (unit-tested, no IO):
parse → normalize → match → per-row outcome `add | update | skip | blocked(reason)`.

| Template | Columns | Writes |
|---|---|---|
| **Month grid** | Category · Line · *(one column per month)* · Notes | one budget line + dated periods per row |
| **Simple list** | Category · Line · Amount · Notes | one lump-sum budget line per row |
| **Payables schedule** | Payee · Description · Category · Amount · Due date · *(optional Deposit / Deposit due / Balance / Balance due)* | one payable per row |

- **Amount cells ship EMPTY in every template. (D-G1.)** A downloadable template carrying an example
  dollar is a product-supplied figure. A probe asserts template emptiness.
- **Preview first, always.** Paste tab (works on a phone, no file picker) + file tab (`.csv`/`.xlsx`
  parsed server-side by the existing parsers). One editable preview table; the coach fixes rows
  before anything is written.
- **Match update-vs-add explicitly** on category + line name, shown per row, and the coach chooses.
  **Parse names and numbers only — never guess data out of prose.**
- **Commit returns per-row outcomes** and refuses to report success when nothing was created
  (the roster-bulk contract).
- **Write order IS display order** — `rep_budget_lines.sort_order` defaults 0 and the read has no
  tiebreaker. The importer sends an explicit `sortOrder` on each line POST (**small API addition,
  no migration**) so sheet order survives regardless of write timing.
- Gate: `money: write` only. **Not** `bulk_data_imports`.
- Chunk G's first-run surface gains a fourth, quiet door: **"Import a spreadsheet"**.

### 10 · Hardening folded in

1. **Line PATCH taxonomy ownership** — mirror the POST's `org_id.is.null,org_id.eq.<org>` check on
   `categoryId` / `itemId`. Probe: a PATCH naming a foreign custom category is refused.
2. **Sticky-footer sweep** — one shared modifier on `.modal` (drops its own `padding-bottom`, zeroes
   the footer's bottom bleed — the mechanism `.eventFormModal` already proves), applied to the tall
   Money modals; **retire both Chunk G `footerFlush` copies** and the event-modal local rule. Probe
   (already exists, extended): a tall sheet's last content clears the sticky footer.

---

## API surface

| Route | Change |
|---|---|
| `GET …/budget-vs-actual` | **+`monthGrid`** (months, per-category/per-line budget·scheduled·actual by month, undated bucket, totals), **+`cashFlow`** (in/out/running by month, per lens inputs), **+`priorSeason`** (per-line prior-year totals, null when none). Two extra queries: all dues installments (currently only paid ones) and prior-year lines. Same gate (`canViewMoney`). **Stop smearing undated budget in `monthlyChart` (D-H4).** |
| `GET …/upcoming-payables` | **+`includePaid`**, **+`days=0`** (no window). Same gate. |
| `POST …/budget-plan/lines` | **+ optional `sortOrder`** (number, validated). |
| `PATCH …/budget-plan/lines/[lineId]` | **+ taxonomy-ownership check** on `categoryId`/`itemId`. |
| `POST …/budget-plan/import/preview` | **NEW** — multipart file → draft rows (server parse). `canWriteMoney`. |
| `POST …/budget-plan/import` | **NEW** — commit draft rows → lines + periods (or payables). Per-row outcomes. `canWriteMoney`. |

---

## Files (expected)

**New:** `components/coaches/MoneyMonthGrid.{tsx,module.css}` · `components/coaches/BudgetImportSheet.{tsx,module.css}` · `lib/coach-budget-months.ts` (pure: month range, bucketing, lens math, cash flow — unit-tested) · `lib/coach-budget-import.ts` (pure: parse/validate/match — unit-tested) · the two import routes.
**Changed:** the BvA page + route + `bva.module.css` · the budget page (deep-link `?line=`, the import door on the first-run surface) · the expenses page (rename, third tab) · `upcoming-payables` route · the lines POST/PATCH · the Money hub (Spend card copy + schedule link) · `coaches.module.css` (the footer modifier + primitives-header entry) · `lib/help-content/coaches.tsx` (via `/docs`) · the Money probe suite.

---

## Verification

- `npm run verify:changed` (**all six colour-token baselines unchanged**; two new CSS modules join the guardrail at zero literals) · `npm run typecheck` (shared modules + API contracts change) · `npm test` (new unit packs for both pure modules) · focused lint.
- **Playwright** — extend `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` (do **not** fork; its provisioning recipe and CHECK-constraint gotchas are inline). New coverage: month grid at 360 and desktop (pinned first column, hint honest, zero page-level horizontal scroll) · each lens repaints and Difference blanks future months · a budget drill-in opens the real edit modal / a read-only coach gets no drill-in · the read-only sweep extended to the new surfaces · payment-schedule filters · import preview shows per-row outcomes and a zero-created commit reports failure · **D-G1: every downloadable template's amount cells are empty** · the PATCH ownership refusal. Computed styles, never screenshots. Text assertions scoped to `main[class*="coachesMain"]`.
- Fresh dev restart (new files ⇒ stop → `rm -rf .next` → `npm run dev` → verify login 200, no `EACCES`) before handoff.

## Definition of done

Plan + PM brief ✅ · approved mockups · built in one pass · `/simplify` · `/review` (**HIGH if import
ships in the same pass**) · `/docs` · green gates + probes · owner QA · committed on `dev` with
explicit per-action OK (explicit `:(literal)` pathspecs; check `git status` for foreign STAGED files
first; audit `git show --stat` after) · `PROGRAM_COACH_PORTAL.md` §1.1 + `memory/design_decisions.md`
+ help content updated in the same unit of work.
