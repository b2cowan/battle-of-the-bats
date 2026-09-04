# Coach Budget Tab Revamp — One Grain, Remembered Splits, a Denser Plan

**Status: BUILT ON DEV 2026-09-02 (phases A–F; migration 274 applied to dev the same day) — with
ONE deliberate hold: §6.2's category rename stopped at its owner checkpoint as this plan requires.
Owner QA = ledger §133, ✅ PASSED 2026-09-04 (28/28, all eight parts).** Approved 2026-09-02 (owner
ruled Q1–Q8 in session, all as recommended, plus the export rider). One disclosed mockup deviation:
category bars keep the build-enforced 44px tap floor instead of the mockup's tighter band — the
density win comes from the line and sub rows.

**Q6 has grown into its OWN plan, 2026-09-04** — `COACH_BUDGET_CATEGORY_OWNERSHIP_PLAN.md` (shared
vs. local categories, not just a rename button). Not yet approved or built; does not block this
plan's PASSED status above.

**Mockup gate (owner-approved, whole-screen before/after):**
https://claude.ai/code/artifact/f1bd6e4d-631e-4a82-a10f-a46646b5fb4c
Both grids and both lists render from ONE 32-line dataset so every total reconciles. The build must
match these mockups; deviations go back to the owner first.

**Analysis provenance:** six parallel code readers (panel, data model/API, reporting consumers,
design consistency, standing rulings, add flow), findings merged, 14 factual claims adversarially
re-verified against code (11 confirmed, 3 corrected narrower, 0 refuted). Line references below were
verified 2026-09-02 and may drift; re-verify at build time.

---

## 0. Owner rulings (2026-09-02, binding for this build)

| Q | Ruling |
|---|--------|
| Q1 | **Approved** — P1 one grain: By-period sums same-item lines; add form asks what makes a second line different; export follows the screen. |
| Q2 | **Approved** — P2 remembered splits: store the split mode (one column), optional dates in names mode, total-change rescale prompt. |
| Q3 | **Approved** — P3 density WITH the Schedule column, collapse-all, remembered folds. |
| Q4 | **Approved** — P4 dropdown pills (BvA's `SingleSelectDropdown` shape) + shared page-width utility. |
| Q5 | **Approved** — add an "other income" line kind. |
| Q6 | **Approved** — a coach can rename their own categories (investigation-first; see §6.2). |
| Q7 | **Approved as scoped** — the platform item-library placement review gets its OWN session; kept OUT of this build. TODO.md line added. |
| Q8 | **Approved, both** — (a) PDF export of the plan; (b) "Bring last season's plan" door on the empty state for a coach who skipped the carry at rollover. |
| **Export rider (owner, verbatim intent)** | "Make sure the export manages the groupings properly like the budget vs actual export does and formats date headers the same way." → The plan tab's exports adopt BvA's contract: the file is grouped exactly the way the screen is grouped, and month/date column headers are produced by the same helpers/format BvA's month export uses — shared code, not a re-implementation. See §5. |
| P6 | Not vetoed → in scope (one headroom, export contract, paper truth-ups). |

## 1. Why (verified findings this build answers)

1. **Row identity (High, verified).** List view merges two lines on one item into one summed row
   (owner ruling 2026-08-15, `lib/coach-budget-rollup.ts` rule 3, itemFor keyed by itemId ~374-390);
   the By-period view keeps one row per raw line labeled `itemName ?? description`
   (`lib/coach-budget-periods-view.ts:251`) and its `PeriodViewLine` type carries no `notes` field
   at all (:52-63) — so two same-item lines render as indistinguishable twins. Since mig 243 removed
   the typed description input, a new line's `description` is always the item name
   (`budget/panel.tsx` handleSaveLine ~1194-1196), so the optional `notes` field is the only
   distinguisher anywhere — and nothing asks for it. The flat export has the same twins
   (`lib/coach-money-exports.ts:119`).
2. **The period editor guesses (Medium, verified).** Split mode is inferred on reopen
   (`lib/coach-budget-period-modes.ts` inferSplitMode :231-247): quarters need every label to start
   "Qn" or silently reopen as months; ONE dateless period flips the whole line to names mode and
   hides the date controls for every period on it. A names-mode chunk (dateless) always lands in
   Unscheduled (`coach-budget-periods-view.ts` columnFor :203-213 — correct per the Chunk H ruling)
   but the editor never says so.
3. **Silent desync (High, verified).** PATCH `budget-plan/lines/[lineId]` changes `total_amount`
   without re-validating `rep_budget_periods` (:67-73); the ±$0.02 sum check runs only in the periods
   POST (:75-83). No DB constraint backs it.
4. **Design drift (verified).** Budget's `.segmented` toggle is a third, locally-declared control
   idiom, 44px at every width (`budget.module.css:313-342`), never named in the 2026-08-20 "one
   control shape" adoption list; Budget and BvA both hand-copy `max-width:1200px` instead of
   composing `.pageWide` (`coaches.module.css:977-980` — whose own comment names "the Budget↔BvA
   drift rule" as its reason to exist). All four collapse states are plain `useState`; the
   PeriodGrid's additionally resets on every List↔By-period toggle (component remounts,
   panel.tsx ~1635). View mode + granularity also reset on reload.
5. **Scale.** A 32-line plan runs ~4 laptop screens in List view; two data columns on a 1,200px
   canvas; no collapse-all, nothing persists. (No pagination needed — no virtualization work here.)
6. **Quiet arithmetic (verified).** `/money-summary` headroom uses `spendAgainstPlan()`
   (`lib/coach-money-summary.ts:193-222`), a documented approximation of `rollupMoneyReport` whose
   own comment names the one divergent case (refund filed against a revenue-only item) — so the
   Overview card + MoneyRail can disagree with the BvA screen. The plan export is one row per raw
   line while the screen groups (BvA's exports explicitly guarantee screen-matches-file,
   `lib/coach-money-exports.ts:703-716`; the plan's does not). Plan export formats are xlsx/csv only
   (panel.tsx:1365-1368) — no PDF, while BvA has one.
7. **Capability gaps.** No income kind other than funding/sponsorship
   (`lib/coach-budget-totals.ts:34-36`); `budget_categories` has NO rename/delete route anywhere
   (16 routes grepped — GET/POST only), so a typo'd category is permanent; a coach who declined the
   rollover carry has no later way to bring last season's plan (the carry itself EXISTS and is on by
   default — `lib/rep-season-rollover.ts:335-420`, dates shifted by `shiftDateYears`).

## 2. P1 — One grain everywhere (no schema change)

- `buildPeriodView` merges rows **by `itemId` within a category** (not by name), summing month
  buckets per line via the same merge discipline `mergePeriods` uses for BvA
  (`coach-budget-rollup.ts:572-638`). Rows with >1 merged line get a quiet "N lines" subtext —
  the List view's existing vocabulary.
- **Ordering unifies with the List view** (verify pass correction: today the two views sort
  differently — List inPlan-first/alphabetical via `compareCategories` :484-487, period view by
  line-kind index then insertion order, `coach-budget-periods-view.ts:283`). One ordering rule,
  the List's, in both views. Funding/sponsorship sections and the "Costs less funding" footer stay.
- **Add/Edit form:** when the chosen item already has ≥1 line in this plan, show an optional field
  "What makes this line different?" saving to `notes`. Encouraged, never blocking.
- The grid stays read-only navigation (Chunk H ruling) — no inline editing added.
- Same-name-but-different-ITEM twins (club's "Entry Fees" vs team's) are NOT solved here — that is
  vocabulary territory and moves with Q7's library session.

## 3. P2 — Remembered splits (the only schema change)

- **Migration (next free number at build time; 273 existed on dev at planning time):**
  `rep_budget_lines.split_mode text NULL CHECK (split_mode IN ('months','quarters','dates','names'))`.
  NULL = legacy → fall back to `inferSplitMode`. Editor writes it on every save; reopen reads it.
  Dictionary + `npm run refresh:snapshots` in the same unit of work (`check:dictionary` gates).
  ⚠ Confirm from live `information_schema` whether `line_kind` carries a DB CHECK before writing the
  migration file (needed for Q5 anyway, §6.1).
- **Names mode gains an optional per-period date** (label stays primary; date column optional) with
  the honest hint: "A chunk without a date shows under Unscheduled in the By-period view and the
  month report." One dateless period no longer hides the date controls for dated siblings
  (per-period, not per-line, rendering).
- **Total-change guard:** in the modal, if the period rows no longer sum to the line total (±$0.02),
  a banner blocks save: "Rescale the split proportionally" / "I'll adjust it myself". Server belt:
  lines PATCH re-checks the period sum whenever
  `total_amount` changes and 409s on mismatch unless the same request carries a consistent period
  set (check-then-act; re-assert org+team in every WHERE per standing memory).
  - ⚠⚠ **BOTH HALVES OF THIS BULLET WERE WRONG AS BUILT — owner walk §133, 2026-09-04.** The plan
    said "mockup shows even; build: proportional rescale, even when all equal", and that parenthesis
    is where the defect lived: **a split is almost never *exactly* equal.** $5,200 across three
    months is stored 1733 / 1733 / 1734, so refitting those shares onto $6,000 gave
    1999.62 / 1999.62 / 2000.76 — under a button that said **"evenly"**. Two fixes, both landed:
    - **The word matches the deed.** The button now says **"Rescale the split proportionally"**
      (owner: proportional is the right behaviour, it just has to say so). Help copy follows.
    - **Rounding is not a shape.** `refitSplit` treats rows as even when the gap between the
      biggest and the smallest is within **$1.00, or half a percent of the average row**, whichever
      is more generous — so a coach's whole-dollar thirds come back exactly even, while a $2,000
      deposit against a $3,200 balance keeps its proportions. Unit-covered in
      `tests/unit/coach-budget-period-modes.test.ts` (this arithmetic had **no** coverage at all).
  - ⚠ **The banner's trigger was a dead end.** It fired on "the total differs from the one the modal
    opened with", so typing the ORIGINAL figure back made the offer vanish while the rows still added
    to the old number and the red sum error still blocked the save — an error you can see with no fix
    you can reach. It now follows the mismatch itself, and steps aside only while the coach is
    editing the period rows by hand (`lastMoneyEdit`), which is what the baseline comparison was
    really protecting.
  - A latent rounding defect went with them: "Split evenly" floored in floating point, so $5.85
    across three rows produced 1.94 / 1.94 / 1.97 instead of 1.95 each. Both paths now do whole-cent
    arithmetic through
    `evenShares`.
- Stretch (only if an RPC path already exists): make the periods delete-then-insert replace
  (:86-108) atomic. Otherwise record as known residual risk — do not hand-roll transactions.

## 4. P3 — Thirty lines on a screen (List view; card stack stays, per Chunk A rule 1)

- **Schedule column:** per line, derived from its periods — "Jan–Mar · 3 chunks", "Apr", "3 chunks ·
  no dates", or "—". NO dollar figures (2026-08-15 §9.6 / Chunk G rule 1). It also finally makes the
  periods feature visible without expanding lines.
- **Density:** row/band paddings tighten ~20% per the mockup. ⚠ The ledger classes are SHARED with
  BvA (`coaches.module.css:3337+`) — implement as a budget-scoped density variable/override, or a
  shared change only after checking BvA renders; `tests/unit/money-hierarchy-type-scale.test.ts`
  guards sizes (not paddings) — keep category > line size intact. Mind CSS Module purity +
  `check:css-selectors`.
- **Collapse all / Expand all** in the toolbar row (ghost button, mockup).
- **Persistence** (localStorage, per team+season — precedent: `lastSplitMode`, `dismissedChecklist`
  keys in panel.tsx ~650-685): viewMode, granularity, List collapse sets, and the period grid's
  folds — which also means lifting PeriodGrid's `closed` state to the parent (or persisting) so a
  List↔By-period toggle stops resetting it.

## 5. P4 + exports — One control shape, one width, one export contract

- **Controls:** replace `.segmented` with the shared `SingleSelectDropdown` pills BvA uses
  (bva/panel.tsx:1260-1283): "View · List/By period" + (period view only) "Columns ·
  Months/Quarters". Export + Add Line stay put (2026-08-13 placement ruling). Update the in-repo
  `memory/design_decisions.md` 2026-08-20 adoption list to name Budget Plan, same unit of work.
- **Width:** budget + bva root wrappers compose `${shared.page} ${shared.pageWide}`; delete both
  local hardcodes. Fundraisers' narrower 960px column is NOT touched (open question, §8).
- **Exports (owner rider):**
  - The file is grouped the way the screen is grouped, both views. List view → statement shape
    (category rows → item rows, same-item lines summed; per-line sub-rows with their notes where an
    item holds >1 line, mirroring the screen's fold). By-period view → the month-grid shape.
  - **Month/date column headers use BvA's format via genuinely shared pieces** (adversarial-review
    correction 2026-09-02: `monthExportColumns`/`buildMonthExportRows` are LOCAL closures inside
    `budget-vs-actual/panel.tsx` (~884, ~917), NOT in `lib/coach-money-exports.ts`, and are
    BvA-lens-specific — they close over monthGrid/lens/cash concepts the plan doesn't have; the
    exports lib disclaims the month grid twice, :649-650/:711-712). Reuse what IS shared:
    `formatMonthLabel` (`lib/coach-budget-months.ts:~1195`) and the `headerMonth`→real-Excel-date
    mechanism (`lib/coach-money-exports.ts:884-895` on `ExportColumnDef.headerMonth`). Write a NEW
    plan-specific row builder (no lens, Unscheduled column, funding sign) MODELED on
    `buildMonthExportRows`' shape — never a second month-label formatter. Same header text, same
    order, same Unscheduled column treatment as BvA.
  - **PDF added (Q8a)** via `MoneyExportButton` formats. Convention mirrors BvA: PDF is always the
    statement (List) shape even from the period view, announced via the same `pdfHint` mechanism
    (bva/panel.tsx:1044-1052). Rendered-PDF check applies at QA (memory: reference_pdf_rendered_check).
  - `BUDGET_LINE_COLUMNS`/`budgetLineRows` (:100-127) are superseded — remove or rewrite; no dead
    export path left behind (`check:root`/knip hygiene).

## 6. P5 — Capability adds

### 6.1 "Other income" kind (Q5)
- `BudgetLineKind` gains `'other_income'` (`lib/coach-budget-totals.ts:34-36`);
  `FUNDING_LINE_KINDS` (:46) gains it — it nets against what players fund, exactly like
  funding/sponsorship; BvA revenue side follows the same path sponsorship took (mig 268-270 era
  precedent). ⚠ **The array drives NOTHING by itself** (adversarial-review finding 2026-09-02):
  `isFundingKind()` (:47-49) and `normalizeBudgetLineKind()` (:61-63) are hardcoded literal
  comparisons, not derived from the array — BOTH must be edited by name, and until
  `normalizeBudgetLineKind` is taught the new value it defaults any unrecognized kind to `'cost'`,
  which would silently count the new income as spending and inflate what families are asked to
  fund. The line-kind guard test exempts `coach-budget-totals.ts` itself, so nothing fails
  automatically here — this is a by-hand edit with a unit test to pin it.
- `tests/unit/budget-line-kind-guard.test.ts` is a build-failing allow-list over every call site —
  that is the tool for finding every consumer; extend it deliberately, site by site (three consumers
  were already summing funding as cost when `line_kind` first landed — the guard exists because of
  this exact change class).
- Check for a DB CHECK on `line_kind` from the live schema (never from migration files); widen in
  the same migration as §3 if present.
- Picker direction: `in` (mig 246 filter). Add/Edit modal "This line is" gains the fourth choice.
- Copy: tile label "Expected fundraising" likely becomes "Expected funding" everywhere it aggregates
  more than fundraising — check against the By-period section labels and `check:spelling`; if the
  wording change ripples into help/demo copy, §7 carries it.

### 6.2 Category rename (Q6) — ✅ RULED 2026-09-04 (org/club-admin-only), owner walk §133
- The investigation was effectively done in review: `budget_categories` carries **no team/creator
  column at all** (coach POST inserts `{org_id, name, scope:'team', is_default:false}`,
  `budget-items/route.ts:180`; dictionary confirms), and the code states the DESIGN INTENT
  outright — *"CATEGORIES ARE STILL ORG-WIDE. A category is a heading, not a name… clubs want them
  shared, and the report's top level would fragment if each team invented its own"*
  (`budget-items/route.ts:149-150`); the GET never filters categories by team, unlike items.
- **Consequence:** "rename your own category" mutates one org-shared row — if a second team in the
  org has started using that category, their screens silently relabel too. Even the descoped
  variant ("only categories this team's lines use") can't fully prevent that race.
- **Owner ruling (2026-09-04, on the §133 walk): option (c) — org/club-admin-only rename.** A head
  or assistant coach never sees or can trigger a rename; only an org/club admin can, since they are
  positioned to know whether other teams depend on the category. The other two options considered
  were: (a) refuse the rename while another team's lines use the category (a per-request race check,
  no role change) and (b) add real provenance + team-scoping (reverses the code's stated org-wide
  sharing intent — not chosen).
- **⚠⚠ SUPERSEDED 2026-09-04 — this grew into its own plan, do not build from this section.** While
  scoping where the rename control would live, the owner ruled the underlying model itself needs to
  change first: categories split into **shared** (club-created, org/team-visible, Owner/Treasurer
  only can create or rename) and **local** (a coach's own, team-only, but club-readable on reports —
  a coach CAN rename their own). This reverses this plan's own "categories are still org-wide"
  premise (§6.2 above), mirrors the `budget_items.team_id` three-tier model already shipped (mig
  240), and needs a migration — out of scope for a plan that has already BUILT and PASSED (§133).
  **See `docs/projects/active/COACH_BUDGET_CATEGORY_OWNERSHIP_PLAN.md`** (+ its PM brief) for the
  full model, migration, routes and open questions. Not yet approved or built as of 2026-09-04.
- BvA name-matching risk is the narrow legacy fallback path only (verified: FK trust order in
  budget-vs-actual/route.ts placeCost :325-351; name fallback :337-351) — renames are safe for
  FK-linked rows; note it in the route comment anyway.
- Delete stays absent. Rename only.

### 6.3 "Bring last season's plan" door (Q8b)
- Empty-state gains a door (beside starter/sample/import/add): visible only when write-capable, the
  current plan is empty, and a prior program year for this team has lines.
- **Extract the rollover carry block** (`lib/rep-season-rollover.ts:335-420`) into a shared helper
  consumed by both callers — lines + periods + `shiftDateYears` on dates + (post-§3) `split_mode`
  carried. ⚠ The rollover's own hard-won comment (line_kind carried, NEVER defaulted — the
  funding-reclassified-as-cost incident) rides along verbatim.
- The rollover path itself must also carry `split_mode` once §3 lands.

## 7. P6 — Quiet integrity fixes + sync

- **One headroom:** close the divergence between `/money-summary` headroom and BvA's
  (`spendAgainstPlan` docstring names the case). Either compute from `rollupMoneyReport` (measure
  the query cost first) or fix the refund-on-revenue-item netting in the approximation; tests in
  `tests/unit/coach-money-summary.test.ts` pin the closed case.
- **Paper truth-ups (do these even if phases stall):**
  - `COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md` line 3 still says "owner walk owed, ledger §126" —
    STALE: ledger shows §126 ✅ PASSED 43/43, closed 2026-09-02. Correct the header.
  - `memory/design_decisions.md` 2026-08-15 pencil entry still says Budget keeps a local copy owed
    migration to `RowEditButton` — code shows `RowEditButton` adopted (panel.tsx ~227-240,
    coaches.module.css ~7693). Correct the rider.
- **Help + demo sync (same unit of work, standing CLAUDE.md instruction):** re-read the WHOLE
  coach-money demo narration (flagged stale across three consecutive releases) before shipping;
  check the Budget help article in `lib/help-content/` (keywords/searchText included) against the
  new View pills, Schedule column, fourth line kind, and the second-line question. `npm run
  check:demos` (dev-only self-heal caveat applies — a green local run says nothing about prod).

## 8. Explicitly OUT of scope (do not solve in passing)

- Q7 platform item-library placements ("Uniforms"/"Travel" under Tournaments, parked since
  2026-08-15, ITEM_ALIGNMENT §10.6) — **own session**, own TODO line.
- Scheduled-vs-paid in BvA's Statement view — parked by COACH_ORG_MONEY_IN_THE_BUDGET_PLAN §4 for
  its own session; must use the word "Scheduled" when it comes.
- Fundraisers' 960px page width (one tier narrower than the other five Money tabs) — open question
  for the owner, not ruled; do not change.
- Same-name different-item disambiguation beyond the picker's tier chips (→ Q7 session).
- Per-line expense linking (retired 2026-08-15 — mig 238 ADDED the link, mig 240 dropped it, per
  240's own header; 238 never reached prod); dollar figures in pickers
  (§9.6 + Chunk G — the leadGroup "owing" carve-out is its own ruling, don't generalize either way);
  merging Budget into the one-conversation recording flow (Expectations screen, 2026-08-21).

## 9. Build order

| Phase | Contents | Schema |
|---|---|---|
| A | P1 grain + ordering unification + second-line question | none |
| B | Export contract + BvA date headers + PDF (owner rider + Q8a) | none |
| C | P2 splits: migration, editor, guards | **mig (split_mode; maybe line_kind CHECK widen + category provenance)** |
| D | P3 density/persistence + P4 controls/width | none |
| E | P5: other_income (Q5), category rename (Q6), carry door (Q8b) | rides C's migration |
| F | P6 + help/demo sync + QA walkthrough artifact | none |

Phases A+B can ship together; C before E (E rides its migration). D is mockup-gated visual work.
One session can take A–B and another C–F, or one session all six — build prompt orders it.

## 10. Verification

- `npm run verify:changed` (+ its gates: spelling, dictionary, css-selectors, root); `npx next
  typegen` before `npm run typecheck` (16.3 memory) — shared modules ARE touched.
- `tests/unit/budget-line-kind-guard.test.ts` (extend for other_income),
  `money-hierarchy-type-scale.test.ts` (density must not break category>line),
  `coach-money-summary.test.ts` (headroom case).
- **Run the pure modules** (node --test) for the new merge/ordering arithmetic in
  `coach-budget-periods-view` — execute, don't eyeball (memory: run-the-pure-module).
- `check:layout`: ⚠ the gate is blind inside folds and this page is four folds deep; the UAT fixture
  must HOLD the failing states (a 2-line item, a names-mode split, a quarters split) or the sweep is
  green by blindness (memory: green-check-over-empty-fixture / fixture SHAPE = coverage). Reseed
  first; use `--only` in this shared worktree.
- Rendered-PDF check for the new plan PDF; export files opened and compared against the screen
  grouping for both views.
- Owner QA: new ledger § (next number, append — never sort), checkable QA-walkthrough artifact with
  the standing sign-in card (uat-coach@uat-test-org.local / UATPassword2026!).

## 11a. Owner SECOND LOOK, §133 (2026-09-04) — after the walk passed 28/28

A screenshot pass over the built screens, in the pattern §132 established: a walk that passes can
still miss the row. Four findings. The two about the Rescale banner are recorded against the bullet
they belong to (§3, P2); these are the rest.

- **The nameless bucket sorted by the alphabet, not last.** One comparator serves both sides of the
  statement — in-plan first, then out-of-plan, each alphabetical — so "No category" sat ABOVE
  "Tournaments" in Revenue while looking correctly last under Expenses. There was no rule; the
  expense side was flattered by where its names fall. ✅ FIXED: the nameless bucket sorts last on
  both sides and in the By-activity blocks, matching the rule that already governed **items** one
  level down ("Not itemized" last — *a gap to close, not a row to read*). Unit-covered as rule 8.
  - ⚠ NOT fixed, and it is a separate call: the **Months grid sorts its categories not at all** —
    they come out in assembly order — so the nameless bucket lands wherever it lands there. Left
    alone deliberately (another session held that module at the time, and "what orders the month
    grid?" is a bigger question than this ruling).
- **Collapse all / Expand all reached one outline of four.** ✅ FIXED on the Budget tab's **By
  period** grid (it folds the same categories, keeps its own closed set, and the button was rendered
  for the List alone) and added to **Budget vs. Actual's statement**, which opens fully folded — so
  every reading of that report used to start with a row of clicks.
  - By activity needs none: it renders items with no category fold at all.
  - ⚠ **BvA Months is NOT wired** — that grid keeps its folds inside the shared month-grid
    component, which was being edited by another session; lifting them is a small refactor to do
    once that work lands.
  - ⚠ **Two vocabularies for one gesture, unruled:** the budget says *Collapse all / Expand all*,
    the Ledger says *Fold all / Open all*. Same control, same product. Owner to pick a pair.
- **"Not in your plan yet" sits mid-plan wearing a budget row's clothes.** Placed at the end of the
  cost list when that WAS the bottom; everything below it (the money-in sections, "Short of covering
  the plan") arrived later, so it now interrupts the arithmetic — and it is a full-width tinted bar
  carrying no money and appearing in no total. Its preview names two arbitrary items out of 42.
  ✅ BUILT to **Option B** (owner approved the mockup 2026-09-04:
  https://claude.ai/code/artifact/ebe1bd82-9583-4583-8650-705e8323f93c). It moves below the whole
  plan, loses the dashed border, the tint and the bar, and states a count instead of two names —
  and the question the Chunk G plan named it after IS the control now, replacing a `Review` verb hung off a label. The dead classes went with it. List view only, as before.
  ⚠ The UAT walk drove this control by the name `Review` in three places and asserted an item name
  on the COLLAPSED strip; both were updated with it. Not run here — it needs a server and the
  fixture.

## 11. Shared-worktree cautions for the build session

`git status` today shows other sessions' modified files across accounting/. Stage explicit
pathspecs only; bracket dirs need `-LiteralPath`/pathspec care (memory: git-bracket-pathspec);
verify `git show --stat HEAD` after committing; a mine-only commit can still be broken if it
imports another session's uncommitted module (memory: shared-worktree stage races).
