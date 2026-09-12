# Kickoff prompt — Revenue first, balances carried forward: finish the build

*(paste into a fresh chat)*

**Build `COACH_BUDGET_REVENUE_FIRST_PLAN.md` — owner-approved 2026-09-12, decisions A–D locked — from
where the previous session stopped.** The shared calculation layer is **built on `dev`, uncommitted,
and compiles clean on its own**; everything downstream of it (both screens, the exports, the
importer's band recognition, the tests, the two previews, help, demo) is still to do. Carry the plan
and its four rulings verbatim; **do not re-litigate A–D**, and in particular do not reopen the
season-estimate rule — decision A kept it exactly as built, with the reasoning in plan §4.

---

## Read first, in this order

1. **The project hub** (mockup · PM brief · full plan · decisions, one URL, tabs):
   https://claude.ai/code/artifact/88741405-2b00-48b7-ae60-8b25498e3d51 — source
   `docs/projects/active/COACH_BUDGET_REVENUE_FIRST_HUB.html`. The Mockup tab's scenario picker
   walks all eight states. **Where this prompt and the mockup disagree, the mockup wins** — republish
   the same file path if a deviation is needed and say so before building it, never after. (One
   known disagreement is listed under "Open before building" below — it needs the owner's word.)
2. **`COACH_BUDGET_REVENUE_FIRST_PLAN.md`** — §0 (the four decisions), §3 (what each stage shows),
   §4 (estimate rule kept — and the one edge case it asks you to confirm), §5 (the balance
   contract), §7 (sequence), §8 (verification cases).
3. **`COACH_BUDGET_REVENUE_FIRST_PM_BRIEF.md`** — the trade-offs in the owner's terms.
4. **`lib/coach-budget-periods-view.ts`** — the part already built. Read its header and every
   comment tagged 2026-09-12; they state the invariants the screens must honour.
5. Owner QA Ledger **§164** (`OWNER_QA_LEDGER.md`) — the By-period close this replaces, and its
   `/review` findings. Two of them are traps the new rows can fall straight back into (below).

---

## ⚠ State of the working copy — verify before touching anything

**This session's uncommitted edits (all on `dev`):**

- `lib/coach-budget-periods-view.ts` — **the core change.** `PeriodView` is reshaped:
  - `costTotals` → **`expenseTotals`**; `fundingTotals` → **`revenueTotals`** (now POSITIVE, and
    includes Player installments once dues exist; null only when there is no revenue at all).
  - `totals` (the old costs-less-funding per column) and `close` (installments + Shortfall (Buffer))
    are **gone**. In their place: **`balance: PeriodBalance`** — `opening` / `net` / `closing`
    per display column, `seasonOpening` / `seasonNet` / `seasonClosing`, `openingUnset`
    (NULL ≠ ZERO — render "None carried", never $0.00, when true), and `shortfall` (first real
    MONTH below zero, computed from months whatever the display granularity).
  - `groups` is sorted **revenue first**, and when dues exist a synthetic group with
    `key: 'installments'`, `name: PLAN_LADDER_LABEL.installments`, `lineKind: 'funding'`,
    `rows: []` is injected FIRST among the revenue groups (the approved mockup's order). It renders
    through the existing `renderGroup` as a plain non-toggleable line because it has no rows.
  - The balance is walked by **`buildCashFlow`** from `lib/coach-budget-months.ts` — Budget vs.
    Actual's own function, reused not re-derived — always at month resolution off the same `dated`
    domain, then aggregated to quarters (first month's opening, last month's closing, Σ net).
    Undated money reaches `buildCashFlow`'s `undatedFlow` (revenue's and expenses' `unscheduled`
    cells) so `seasonNet === revenueTotals.total − expenseTotals.total` holds algebraically. ⚠ The
    estimate remainder — positive OR negative — is already inside `costCells[UNSCHEDULED]` before
    that call, which is exactly how plan §4's "over estimate, nothing undated to net against" edge
    case flows through with no special case. Confirm it renders (a negative, line-less No date yet
    cell) rather than assuming.
  - `buildPeriodView` gained `opts.openingBalance?: number | null`.
- `lib/coach-budget-totals.ts` — `PLAN_LADDER_LABEL` gained `revenueBand`, `expensesBand`,
  `totalRevenue`, `totalExpenses`, `requiredDues` ("Required player dues" — decision C),
  `openingBalance`, `netForMonth`, `netForQuarter`, `seasonNet`, `closingBalance`. **The old keys
  are deliberately NOT deleted** — the importer's derived-row skip set is built from
  `Object.entries(PLAN_LADDER_LABEL)`, so an old exported file still reads back clean.
- `app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/route.ts` — the GET now returns
  `openingBalance: programYear.openingBalance ?? null` (no new query; `RepProgramYear` already
  carries it).
- Docs: `COACH_BUDGET_REVENUE_FIRST_PLAN.md`, `_PM_BRIEF.md`, `_MOCKUP.html` (estimate scenario
  corrected to decision A, "Set"→"Scheduled" badge, dues wording), `_HUB.html` (new), `TODO.md`
  (one line).

**Typecheck right now: the lib compiles; 83 errors downstream, all expected, all yours to clear:**
`accounting/budget/panel.tsx` (8), `lib/coach-money-exports.ts` (7),
`tests/unit/coach-budget-periods-view.test.ts` (67), `tests/unit/budget-sponsorship-kind.test.ts`
(1). ⚠ **The tree is red on typecheck until you clear these, and the working copy is shared with
other sessions** — make getting to green the first thing you do, before any new feature work.

- **Establish what else is modified before touching anything**: `git status --porcelain`. At the
  start of the previous session the tree already carried other sessions' edits (budget panel,
  dues-credit guards, BudgetItemManagerModal, sidebar, and more). **Stage explicit pathspecs only**
  when the owner says to commit; never `git add -A`. Bracket directories (`[teamId]`, `[orgSlug]`)
  need `:(literal)` pathspecs or they stage nothing. **Commit only on the owner's word.**
- **Migrations: none expected.** Confirm against `docs/agents/db/schema-snapshots/` — the opening
  balance column already exists.

---

## Open before building — needs the owner's yes

- **The three summary tiles.** Standing owner ruling (2026-09-08, `memory/design_decisions.md`):
  *the tiles above the table are the table's subtotals, with the same names verbatim.* The new table
  subtotals are **Total revenue / Total expenses**, and the close is **Closing balance**. The approved
  mockup's tiles read *Planned revenue / Planned expenses / Projected season closing* — a wording
  drift from the table beneath them. Recommend the tiles wear the table's words (Total revenue ·
  Total expenses · Closing balance, captioned "includes the No date yet amounts" as the mockup's
  third tile is). Put it to the owner as a one-line deviation before building the tiles, then
  republish the hub to match whichever way it goes.

---

## What this builds (the plan's words, condensed) — in this order

1. **`panel.tsx`, the By-period grid** (`PeriodGrid`, ~L537–1010): band order Revenue → Expenses;
   band labels `PLAN_LADDER_LABEL.revenueBand` / `.expensesBand`; subtotals `.totalRevenue` /
   `.totalExpenses` (revenue subtotal keeps the green `periodGridFunding` ink); the estimate rows
   stay exactly where they are inside Expenses; **delete** the Costs-less-funding, Player
   installments ladder and Shortfall (Buffer) rows and the `closeCells` renderer's green-bracket
   rule; **add** Opening balance / Net for the month|quarter / Closing balance rows read from
   `view.balance` (dashes in No date yet on Opening and Closing; Net carries the undated figure).
   ⚠ **Balance rows bracket in RED when negative** — Budget vs. Actual's balance rule, not the old
   plan-close green; `periodGridAhead` is the old row's class and must not be applied here.
   ⚠⚠ **The installments group's cells must render SIGNED, not through `fundingCell`'s `abs()`** —
   its No date yet cell goes negative whenever a schedule is lowered after its instalments exist
   (§164 `/review` finding #2, a real state). Special-case `group.key === 'installments'` to the
   signed formatter, or the row stops summing to its own Total again.
   Notes under the table: the bracket legend becomes the mockup's ("Brackets mean a negative
   figure. On Net, more goes out than comes in. On Closing balance, the plan ends the period below
   zero."), shown only when `view.hasNegative`; the "Set dues and they appear here" note is replaced
   by the **helper card** (below); the written-off clause is gated on dues existing (the
   `installments` group present), not on the deleted `view.close`.
2. **`panel.tsx`, the List** (~L3280–3480 and the tiles ~L2790–2850): the List does **not** call
   `buildPeriodView` today (`periodView` is null unless `viewMode === 'period'`). **Call it
   unconditionally** and have the List read `revenueTotals.total`, `expenseTotals.total` and
   `balance.season*` from the SAME object the grid reads — one calculation, two renderers. Reorder
   its bands the same way; put the Player installments row (with its existing Scheduled badge and
   `writtenOffClause`) at the top of the Revenue section instead of in the ladder; delete
   `costsLessFunding` / `leftToFund` / `shortOfPlan` / `buffer` rendering; add Opening balance /
   Season net / Closing balance as the List's close. Under the When filter the season's close still
   steps aside and the subtotals read *Costs shown / Funding shown* → rename those to the new
   words' "shown" forms (add `revenueShown` / `expensesShown` to `PLAN_LADDER_LABEL`).
3. **The pre-dues helper card, off the table (decisions B + C)** — both views, only when no dues
   are scheduled: **"Required player dues · $X"** = `max(0, expenseTotals.total − revenueTotals
   total)` (the existing `totals.fundedByPlayers` is this figure — reuse it), "≈ $Y per player ÷ N"
   from `totals.perPlayer`, and the existing **Set dues for all players** door (`setGenOpen`). It
   never enters revenue and never appears in a file. Replaces the old "Player installments
   (estimated)" ladder row.
4. **`lib/coach-money-exports.ts`** — `budgetPeriodGridRows` (~L470–500) and
   `budgetPlanStatementRows`: REVENUE / EXPENSES `section` rows (uppercase, the statement
   convention), the two new subtotals, the three balance rows as `total` kind (Opening/Closing blank
   in No date yet; Net carries it; Total column = season figures). **Export follows screen in the
   same unit of work.** Update `tests/unit/coach-money-exports-budget-plan.test.ts` from the real
   producer, not hand-typed rows.
5. **`lib/coach-budget-import.ts`** — `BAND_LABELS` gains `{ label: 'revenue', direction: 'in' }`
   and `{ label: 'expenses', direction: 'out' }` while **keeping** `costs` / `funding` (old files
   must still import). `PLAN_LADDER_DERIVED` must exclude `revenueBand` / `expensesBand` exactly as
   it excludes `costsBand` / `fundingBand` (a club may own a category called "Revenue"). Round-trip
   test both an old-band file and a new-band file in `tests/unit/coach-budget-import.test.ts`.
6. **Tests** — rewrite `coach-budget-periods-view.test.ts` against the new shape (the plan's §8
   cases: both estimate branches, negative undated dues remainder, quarter hiding a negative month,
   `seasonNet === revenue − expenses`, `openingUnset`, `shortfall` from months under quarters).
   `budget-ladder-sign-guard.test.ts` pins the List's deleted Costs-less-funding formatter — **revise
   it deliberately** (plan §8: never delete a guard to make a gate pass) to pin the balance rows'
   signed rendering instead. Fix the one `.totals` reference in `budget-sponsorship-kind.test.ts`.
   Then `tests/unit/coach-budget-period-grid-doors-guard.test.ts` and the layout baseline
   (`check:layout` — do not launder other sessions' findings).
7. **The two previews (decision D — same delivery, not a later pass).** Cheapest correct shape for
   both, because `buildPeriodView` is pure: **build a second view over `[...allLines, trialLine]`**
   (or `dues` replaced by the previewed schedule) and render before/after `balance` from the two
   results — zero new arithmetic, no chance of the preview disagreeing with the real table.
   Extra-expense preview: amount + month in the existing panel, transient, cleared by its own
   Cancel, saved only through the normal Add-line form. Schedule preview: the Set-dues sheet already
   has a preview endpoint (`splitPerPlayer`, `describeInstallmentBases`); show the previewed
   instalments in Revenue marked as a draft, Cancel restores the saved plan. Plan §5's "room for an
   expense" sentence: at most `max(0, min(closing from m onward))`, and never an affirmative claim
   while `estimateRows` is non-null or the range is `truncated`.
8. **Help + demo** — `lib/help-content/coaches.tsx` budget-plan article (it learned the three
   closing rows and the bracket note in §164; it must now describe Revenue → Expenses, the balance
   rows, the helper, and the `installments`/`dues` split, with search terms). Grep every customer-
   visible surface for `Shortfall`, `Costs less funding`, `Planned costs`, `Planned funding`,
   `Short of covering the plan`, `Planned buffer` — help, `lib/sandbox-chrome.ts`, demo seed,
   `check:demos`. §164 recorded that no demo step stops on the Budget plan tab; **re-check, do not
   assume** (CLAUDE.md: the coach-money narration has gone stale five releases running).
   `npm run check:spelling` will hold "installments" (two Ls) — fine.
9. **Verification**: `npm run typecheck`, the touched unit files, `npm run verify:changed`,
   `check:money-report`, `check:demos`, `check:layout` sliced to the three budget screens at
   361/390/768/1440. **Restart the dev server** (shared module changed) before handoff. Then
   `/simplify` (a new preview abstraction is exactly its brief) and `/review` (high-risk tier).
10. **Paper**: unhide the hub's QA Walk tab and fill `QA_PARTS` from the plan's §8 cases; new
    ledger entry (next § number — read the ledger's tail); TODO line; hub stage strip
    "Built <hash> <date>" **after** the owner commits; `memory/design_decisions.md` entry for
    2026-09-12 (the four decisions; the tile wording once ruled).

---

## Traps, from the code and from §164 — read these twice

- **Funding is stored NEGATIVE inside `buildPeriodView`** (`sign = isFundingKind ? -1 : 1`); the
  panel's `fundingCell` abs()es it for display. `revenueCells` is already negated to positive in
  the lib — do not negate again in the panel.
- **A balance is a moment; undated money has none.** Opening/Closing are dashes in No date yet.
  The last dated Closing can differ from the season Closing by exactly the undated remainder —
  say so in the note (plan §5), exactly as Budget vs. Actual's export does.
- **`duesAssessed > 0` is still the presence test in the panel** (`duesView`). Plan §2 asks for an
  explicit schedule-presence state so a fully-adjusted or zero schedule does not read as "never
  set" — the route already returns `plan.hasInstallments`; prefer that.
- **`hasNegative` now means "any balance cell below zero"** — it no longer describes the deleted
  close row. The legend text must follow.
- **Two registers, never mixed inside one pair** (ruling 2026-09-10): the table reports (Revenue /
  Expenses); the Add-line form still asks plainly (Money coming in / Money the team spends). Do
  not rename the form.
- **"Surplus" is spoken for** (Player Dues tab, season-end cash). Never on a projection row.
