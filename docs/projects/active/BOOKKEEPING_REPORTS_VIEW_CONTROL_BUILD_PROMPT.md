# Bookkeeping · Reports "View" control, thin first cut (build prompt, ONE session)

> Written 2026-11-07 in the GST/HST Stage 4b kickoff session ([GST_HST_STAGE4B_KICKOFF_PROMPT.md](GST_HST_STAGE4B_KICKOFF_PROMPT.md)). Recommended model: Sonnet is enough.
> Plans of record: [BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) §3 ladder row **3** (Q12) and row **4b**.
> Drawings (build to these, do not redraw): the View pill in `BOOKKEEPING_HOLISTIC_REEVAL_HUB.html` (Q12 frames) and the toolbar in
> https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan tab 5 ("View · GST/HST return ▾" beside the period control).
> Mark each fact you rely on [V] (you opened it this session) or [H] (handed over). Everything below is [H] unless marked [V 2026-11-07].

## Why this exists, and the owner ruling that shaped it

Row 3 of the ladder ("Reports that answer questions": one View pill over five views) is **drawn and ruled and NOT built** [V 2026-11-07: no
View pill and none of By month / Compare / Money position / Tax year exist in the code]. GST/HST 4b needs a place to live that is a **view
under Reports**, not a fifth tab (drawings Ask 7 = A). Waiting for all five views would hold 4b behind the accounts and registers
(Stage 2, redraw owed) and the category-to-tax-line mapping (Q13). **Owner ruling 2026-11-07: build a thin View control first, then 4b.**
The other views join the same control later as their own prerequisites land; nothing here is thrown away.

## What the owner sees after this build (almost nothing, on purpose)

- Reports looks and works **exactly as it does today**. The View pill appears only when Reports has **two or more** views. With the one
  view that exists now (Spending = today's page, **moved in unchanged, not tidied**), no pill renders and there is no dead choice.
- The first time the pill appears is when 4b adds "GST/HST return". The house rule says a pill is for more than three views; a two-choice pill
  is a deliberate, owner-accepted departure so there is no switch-to-pill rework later. Say so in the walk note; do not "fix" it to a switch.
- Every view gets its own address, so a link or Back lands on the same view (Q16).

## Build

1. **Split today's Reports section** (`app/platform-admin/bookkeeping/BookkeepingClient.tsx`, the inline Reports `<section>`, about lines
   263-332 [H]) into a `ReportsSpending` component. Move JSX and its local state; change **no** copy, order, filter or number. The shared period
   state (from/to) and the expense export stay available to any view.
2. **A small registry of report views** (key, label, whether it is available, its component). Today: `spending` only. Adding a view later is
   one registry entry plus its component, nothing else.
3. **The View control**: the shipped olive pill from the drawings, built from the **shipped component** (do not draw a new one). It renders only
   when the registry offers 2+ views. Phone: it keeps its place in the toolbar and does not wrap; check at 390.
4. **Addresses.** Extend the address contract in `lib/bookkeeping-navigation.ts` with a report-view sub-key (`?view=reports&report=...`), default
   `spending`, unknown value falls back to `spending`. Keep every existing address working. Update `tests/unit/bookkeeping-navigation.test.ts`.
5. **No data changes, no migration, no new API.**

## Checks

- `npm run verify:changed`; `npm run check:layout --changed` on Reports at desktop and 390 (the dev server, `--changed` only).
- A guard test: the registry has `spending`; with one view the pill is absent; with two it is present (render test or pure registry test).
- Before/after: Reports renders the same sections in the same order as before (note any unavoidable difference in the hand-off).
- `/review` offer after; `/simplify` only if the registry feels heavy for one entry. No help-content change (platform-admin only; confirm no
  Bookkeeping help article exists before skipping `/docs`).

## Rules of the room

Branch `dev` only; commit nothing until the owner says; stage explicit pathspecs. Do not change hooks, settings or database checks. A helper's
summary is a lead, not evidence. Do not add a tab; do not move Overview, Expenses or Ledger.

## Progress

**2026-11-07 — built, reviewed and committed 2026-11-07 (owner asked for the commit after `/review`).** Branch `dev`. Facts below are [V 2026-11-07].

**What landed**
- `app/platform-admin/bookkeeping/ReportsSpending.tsx` (new): today's Reports `<section>`, moved in. Proven identical: the
  moved JSX was diffed against `git show HEAD:…/BookkeepingClient.tsx` lines 263-332 with only the handler renames reversed
  (`setFrom`→`onFrom`, `openRecord`→`onOpenExpense`, `setReportDrilldown`→`onDrilldown`, …) — **IDENTICAL**. Same sections,
  same order, same copy, same filters, same figures. The rendered DOM is unchanged (with one view the wrapper is a fragment).
- `BookkeepingClient.tsx`: the registry (`reportViews`: key, available, render) and the View pill —
  `SingleSelectDropdown lead label="View"`, the club money tabs' shipped olive View pill (e.g. club Allocations), not a new
  control — rendered only when `reportControl.options` is non-null. Platform admin already carries the warm tokens it paints with.
- `lib/bookkeeping-navigation.ts`: `REPORT_VIEWS = ['spending']`, `REPORT_VIEW_LABELS`, `reportViewControl(requested, views)`
  (current view + options, `null` below two available views); `bookkeepingPlace` returns `report` (unknown/missing →
  `spending`); `bookkeepingAddress` takes `report` and writes the default as no key, so today's Reports address is unchanged.
- `bookkeeping.module.css`: `.reportViewBar` (the pill's row: left, no wrap). Unused until a second view exists.

**⚖ One departure from step 1, argued before the build.** The prompt said "move JSX and its local state". The state is not
local: the filters survive a trip to another tab, `reportRows` is the record window's Previous · Next list
(`defaultRecordRows`), and `exportExpenses` reads the filters and the drill-down. Moving them into the view would reset the
filters on every tab switch and break stepping and export. **The JSX moved; the state stayed on the page** and is handed in,
which also keeps the period (from/to) and the export shared with every view, as the prompt asks.

**Adding a view (for 4b Session B):** a key + label in `REPORT_VIEWS`/`REPORT_VIEW_LABELS`, one entry in `reportViews` with
its component. The pill then appears by itself. The period control stays inside Spending today; whether 4b's toolbar sets it
beside the pill (tab 5 drawing) is 4b's call. The two-choice pill is the owner-accepted departure from "a pill past three
views" (no switch-to-pill rework later); say so in 4b's walk note and do not "fix" it to a switch.

**Checks**
- `tests/unit/bookkeeping-navigation.test.ts`: existing place assertions gain `report: 'spending'`; new suite — default and
  fallback, the default writes no key, a view's address survives a record and a tab trip, one view → no pill, an unavailable
  view is no choice, two views → pill with both, and a source guard (registry has `spending`, the pill renders only from
  `reportControl.options`, the four tabs unchanged). 7/7.
- Guards that read Reports' source moved with it: `bookkeeping-gst-reports.test.ts` (ruling 3, Tax review pending, Change date)
  reads both files; `bookkeeping-accountant-fixes.test.ts` C3 adds `ReportsSpending.tsx` to the "no delete" screens. All 148
  bookkeeping tests pass.
- `npm run typecheck`: 0 errors. Focused ESLint (`verify-changed.mjs`) on my files: clean. Spelling, contrast, date, CSS purity,
  public tokens: clean.
- `npm run verify:changed` as a whole exits 1 on **other sessions' work in the shared tree**, none in these files: tax words in
  `lib/help-content/{coaches,org}.tsx`, `lib/console-money-sales-tax-wait.ts` (workspace-flip census), admin-type baseline drops
  (Billing/KitDialog CSS), old-look `schedule-admin.module.css`, CSS orphans in `record.module`, the export catalog's
  `FoundingSeasonDesk`, and ~20 portal/house-league tests.
- **`check:layout` not run:** Bookkeeping is not one of the sweep's screens (`--list`), and the page is owner-only. With one
  view the page's DOM is unchanged, so there is nothing new to measure; the pill's 390 check moves to 4b, the first build that
  renders it.
- `/docs` skipped: `lib/help-content/platform-admin.tsx` names Bookkeeping in the console menu only; no Bookkeeping article.

**`/review` 2026-11-07 (high-risk tier on paths; two Sonnet finders — correctness/regression, state/navigation; main-loop
triage).** Nothing Critical/High; nothing reachable today. Applied:
- *The hidden third place (Medium, both finders):* the record window's steps and the export keyed on the Reports **tab**, so
  a Spending drill-down would have narrowed the next view's export and steps. Both now key on `spendingOpen` (Reports open
  AND Spending the view in force); the registry moved above its first reader so they can. A new view with its own line list
  passes it to `openRecord` and its filters to `exportExpenses` (comment beside the registry).
- An unavailable view is never drawn, even when the address names it; picking the view already open pushes no duplicate
  history entry; the pill clears `movement`/`transfer` like the tabs do.
- Tests: the `spendingOpen` wiring and the availability check are guarded; every `REPORT_VIEWS` key must have pill words. 149/149.

**For 4b Session B (deliberately not decided here):**
- `report` is sticky across tabs: the Overview's "Spent in <month> · Reports ›" tile lands on the last view picked, not on
  Spending. Decide whether that tile should pin `report: 'spending'` (it is an Overview change, out of this build's scope).
- An address may name a view that exists but is unavailable; the page shows the fallback and the address is not rewritten.
  Harmless while every view is `available: true`; normalize it if a view ever becomes conditional (e.g. on schema readiness).
- The payment-source labels are now copied in five bookkeeping files (the existing per-file pattern); a candidate for `/simplify`
  when Spending is tidied (ladder row 3).

**Files for the commit (explicit pathspecs):** `app/platform-admin/bookkeeping/ReportsSpending.tsx`,
`app/platform-admin/bookkeeping/BookkeepingClient.tsx`, `app/platform-admin/bookkeeping/bookkeeping.module.css`,
`lib/bookkeeping-navigation.ts`, `tests/unit/bookkeeping-navigation.test.ts`, `tests/unit/bookkeeping-gst-reports.test.ts`,
`tests/unit/bookkeeping-accountant-fixes.test.ts`, this prompt, and the one TODO.md line (TODO.md also holds other sessions'
lines — commit HEAD + this hunk only).
