# Revenue first, balances carried forward — implementation proposal

**Status:** **built on dev 2026-09-12** (both views, both files, the importer, the helper, both previews, help and demo re-read; `/simplify` + `/review` and the owner's walk follow — Owner QA Ledger **§173**, the hub's QA Walk tab). Approved by the owner 2026-09-12, decisions A–D below all made. **Tile wording ruled the same day:** the three tiles wear the table's own words — *Total revenue · Total expenses · Closing balance* — not the mockup's *Planned revenue / Planned expenses / Projected season closing* (the 2026-09-08 tiles-are-the-subtotals ruling outranks the drawing; the mockup was corrected to match). **Committed `182c7192` 2026-09-12** (a private-index commit; `/simplify` and `/review` ran first — see Owner QA §173). ⚠ The Set-dues sheet, the help article and the budget panel also carried other sessions' hunks; the sheet and the article were committed as mine-only blobs, the panel shipped with the Categories & Items door (§163, owner QA ✅) by the owner's word.
**Project hub:** [Mockup, PM brief, this plan and decisions on one artifact](COACH_BUDGET_REVENUE_FIRST_HUB.html).
**PM brief:** [Outcome and customer experience](COACH_BUDGET_REVENUE_FIRST_PM_BRIEF.md).
**Mockup:** [Interactive states, List / months / quarters, extra-expense preview](COACH_BUDGET_REVENUE_FIRST_MOCKUP.html).
**Origin:** [Owner QA Ledger §164](OWNER_QA_LEDGER.md), ruling F1. Supersedes the earlier deferral of balances as a planning direction; does not rewrite the historical build.

## 0. Owner decisions (2026-09-12)

This proposal went through a second review pass against the working code before approval, which changed one
part of it. The four decisions below are binding; §4 and §3 stage 6 were rewritten to match.

| Ref | Decision |
|-----|----------|
| **A** | **The season-estimate rule is unchanged — withdrawn, not adopted.** §4 below originally proposed that itemized expenses win over the estimate once they run higher. The owner kept the existing rule instead: the estimate stays the governing total in both directions, symmetrically netted against the "No date yet" column ("Still to itemize" when under, a negative netted adjustment when over) so the same mechanism does the work either way and neither figure is a special case. "Lines so far" and "Over your estimate" stay visible above it, in red when over, exactly as they render today. Nothing here is new build — it is a decision to build nothing on this point. **One follow-up carried forward:** confirm the effective total this produces is the one figure every consumer reads (the tiles, the per-player suggestion, Budget vs. Actual's Budget basis) — expected to already hold, since they share one calculation, but not independently re-verified in this review. |
| **B** | **Quarters' running balance confirmed as specified in §5** — a quarter's opening is its first month's opening, its closing its last month's closing, summed from the underlying months; a negative month still raises its own warning even inside a quarter that nets positive. No change from the draft. |
| **C** | **Vocabulary split, not a single rename.** "Player installments" is the right word once a dated schedule exists — it names dated, scheduled payments correctly. Before a schedule exists there is no schedule to name, only a total, so every pre-dues reference reads **"Required player dues"**, not "Required player installments." Applied throughout §3 and the mockup. |
| **D** | **The schedule preview and the extra-expense preview ship as part of this same project**, not as a later delivery. §3 stage 6's "second delivery" framing and §7's phased priority are both replaced with a single delivery. |

## 1. Recommendation and reasoning

Revenue above Expenses is appropriate throughout the Budget tab. The old cost-first presentation explained how dues were derived: costs less outside funding equals what players must cover. That calculation belongs in a funding helper before dues exist. Once player installments join revenue, total revenue less total expenses is a useful season result, rather than the permanently negative partial result the earlier design rejected. Table order and the dues calculator do not need to be the same thing.

Use the same closing grammar as Budget vs. Actual: Opening balance + Net for the month = Closing balance. A month spending more than it receives is a negative net, not necessarily a shortfall; a negative closing balance identifies the shortfall. Negative balances and negative net use red brackets, as the twin report does. Positive net alone is not a promise that money can be spent. Keep a conditional bracket legend, revising its explanation for the new signs. Keep “Lines so far” in both views, per F3.

Do not use “Surplus to share” for a projection: that remains the Dues tab's settlement concept. Revenue-first changes the old Shortfall (Buffer) sign and row intentionally, across both views and exports together. This is a proposal to replace that close, not an assertion that the 15 passed checks failed.

## 2. Evidence from the current working code

Read the current files, including concurrent edits, rather than relying on the old plan:

| Source | Observed behavior | Consequence |
| --- | --- | --- |
| `lib/coach-budget-periods-view.ts`, `buildPeriodView` | Costs ordered first; funding stored in negative presentation cells; installments subtracted below; signed estimate remainder in No date yet | Reordering headings alone gives the wrong new net. Build an explicit positive revenue/expense adapter and reconcile its results. |
| `lib/coach-budget-totals.ts`, `computeBudgetTotals` | Estimate wins even below lines; required dues floored at zero | Changing the expense basis is a policy change, reaching tiles, dues helpers and other readers. |
| `lib/coach-budget-months.ts`, `buildMonthGrid` | Only positive unitemized estimate reserve; a negative reserve would read as a refund | Existing cross-report estimate policy differs; do not promise universal agreement by copying the footer. |
| `lib/coach-budget-months.ts`, `buildCashFlow` / `buildBandCashFlow` | Budget uses season opening; Scheduled uses current cash; undated net reaches season Total but no dated running balance | Reuse the cash-flow arithmetic with the Budget basis; never add today's cash to a whole-season budget. |
| `components/coaches/MoneyMonthGrid.tsx` | Opening / net / closing, undated balances blank, Total opening is season opening and Total closing is season ending | Follow this behavior; balances are endpoints, not sums. |
| Budget plan GET route | Returns dues net of current adjustments/forgiveness and dated installments; response lacks season opening | Add opening and provenance through the existing season accessor, with the same team/season scoping. No new opening-balance store. |
| Budget panel, `duesView` | Uses `duesAssessed > 0` as presence | Carry an explicit schedule-presence state so zero-value or fully adjusted schedules do not masquerade as never set. |

## 3. What each stage shows

1. **Nothing planned.** Revenue and Expenses have useful empty states; offer Add budget item, Set season estimate and existing import/prior-season doors. No invented per-player $0 or “fully funded” claim. Opening is still visible, sourced from the existing season setting.
2. **Estimate or some lines entered, dues unset.** Revenue contains only the money-in plan. Expenses include entered items and positive Still to itemize reserve, if any. Below the report: Required player dues = max(0, planned expenses − other planned revenue), followed by the per-player estimate when roster count is positive. With no roster, request players rather than dividing by zero. This helper is not additive revenue, has no invented dates, and points to Set dues for all players. Label negative balances “Before player dues”; they are the current plan's gap, not overdue bills.
3. **Schedule preview.** Existing set-dues flow previews amount and dates before persistence. A clearly marked draft may show installments in Revenue for comparison, but Cancel restores the saved plan. Partial schedules expose their undated remainder. Saving must keep the current validation, family adjustments and confirmation consequences.
4. **Dues set.** Player installments becomes a derived row in Revenue, net of the existing adjustments/forgiveness with the same explanatory clause as the tile. Opening that row uses the dues flow. No duplicate editable budget word or imported dues line. Show roster coverage when only some families have schedules; do not imply every player has dues set.
5. **Timing problem.** Show the earliest negative monthly closing balance and the amount. The row/alert leads to the affected month and its underlying lines or dues dates; do not automatically move a family's due date. Keep the alert in List and Quarters too, computed from months.
6. **Considering another expense.** Preview amount and date, with before/after season closing and first shortage. Show every later balance change. Save through the normal add-item form; before saving recheck current data. A separate cancel clears the preview. **Ships in the same delivery as the report itself (owner decision D, 2026-09-12) — not gated behind it, and not deferred.**
7. **Already over-funded.** Required installments is $0 if no dues exist. Show the positive net/closing without deriving negative dues or offering an automatic refund. Existing dues stay unchanged unless the coach deliberately edits them.

Keep the table editable through existing item doors, preserve one word per line, category order within each side and collapse controls. Keep summary to planned revenue, planned expenses and projected season closing; attach the active timing/coverage issue as one sentence below, not another dashboard of competing totals. Retain the same whole-season context when changing views.

## 4. Estimate treatment — kept as built, no policy change (owner decision A, 2026-09-12)

**The earlier draft of this section proposed reversing the 2026-08-12 estimate ruling. That proposal is
withdrawn.** The owner reviewed it against a real screen (a team with $14,186 of itemized costs and a
$13,000 estimate) and confirmed the existing behavior stays exactly as built:

Planned expenses reads **$13,000 — the estimate** — not $14,186. "Lines so far" shows the true itemized
total one line above it, unchanged. "Over your estimate $1,186" prints in red immediately below that. The
$1,186 gap is not a separate special case: it nets into the same **No date yet** column "Still to itemize"
already uses on the other side of this comparison — a positive reserve there when the estimate exceeds the
lines, a negative one when the lines exceed the estimate. One mechanism, one column, symmetric in both
directions, so neither number "wins" as a rule — the estimate is simply what the coach typed, and it keeps
governing the total everything else reads, with the true itemized figure and the size of the gap both
staying visible, never hidden.

Nothing here is new build. This section is a record that the question was asked and answered, not a
change to make. Two things worth confirming during implementation, not before it:

1. **Consistency check, not a design question.** The summary tiles, the per-player dues suggestion, and
   Budget vs. Actual's Budget basis should already read this same total, since they're built off one shared
   calculation rather than each computing their own. Confirm that holds rather than assuming it — this is a
   verification step, not a rebuild.
2. **The unaddressed edge case:** a team with real dated cost lines that already cover 100% of the season —
   nothing sitting in "No date yet" at all — comes in over its estimate. The netted adjustment has no
   existing undated line to offset, so it would need to render as a negative "No date yet" figure with
   nothing underneath it. Confirm the screen and export already handle a negative, line-less undated cell
   correctly before this ships; if not, that is the one small fix this section actually calls for.

## 5. Balance contract and uncertainty

- Revenue is positive, including scheduled installments exactly once. Expenses are positive. Reversals/negative residuals retain their sign; never absolute-value all cells.
- Each dated period: net = revenue − expenses; closing = opening + net; next opening = previous closing. Compute the full monthly series before paging or grouping quarters. Empty intervening months carry the balance.
- First opening uses the existing season opening balance. It is not revenue and does not silently reduce default dues. Any future choice to use opening funds to lower dues must show the resulting end balance explicitly.
- No date yet leads the grid. Its revenue and expense values reconcile to Total, but opening/closing cells there are dashes. Undated money never enters a dated running balance.
- Season Total net includes undated values. Season Total closing = season opening + season Total net; label the note “includes amounts with no date.” Explain why the final dated closing can differ. Never sum monthly openings or closings.
- Quarters: sum monthly flows; opening is the first month's opening; closing is the last month's closing. A negative month inside a positive quarter still triggers the month-specific warning.
- Whole-season columns should use the existing season dates plus the dated budget/dues domain. Preserve year labels. Existing range truncation currently folds far dates into the final column; a cash forecast must not pretend those amounts arrive earlier. Mark an incomplete range and suppress spending-room claims until a truthful complete series is available.
- “Room for an extra expense in month m” is at most max(0, minimum of all monthly closing balances from m onward − an explicitly selected reserve). It assumes receipts arrive as planned. A shortage before m still needs resolution. Missing dates, schedule over-allocation, lower-estimate conflict or truncated range prevent an affirmative availability claim. A late-month receipt can still follow an early-month bill: monthly positivity is not a day-level cash guarantee. A future day-level check should use existing exact dates and report unknown intra-month timing; do not claim a “best date” from month buckets.
- List / months / quarters / exports share one calculated report shape. Budget vs. Actual's **Budget** basis should reconcile; Scheduled and Actual legitimately answer different questions. Returned family money has its own treatment in the existing report and must not be accidentally folded into plan expenses when reusing its renderer.

## 6. Mockup fixture and reading guide

Illustrative data, not the UAT fixture: Sep–Dec 2026, opening $1,000, expenses $6,000 / $3,000 / $4,000 / $1,000, sponsor $2,000 in October, 12 players.

| State | Installments | Monthly closing balances | Season closing |
| --- | --- | --- | --- |
| Dues unset | none; required $12,000 / $1,000 per player | ($5,000), ($6,000), ($10,000), ($11,000) | ($11,000) |
| Dues set | $4,000 / $4,000 / $4,000 / $0 | ($1,000), $2,000, $2,000, $1,000 | $1,000 |
| Timing revised | $6,000 / $3,000 / $3,000 / $0 | $1,000, $3,000, $2,000, $1,000 | $1,000 |
| Higher estimate | revised timing plus $2,000 undated expense reserve | same dated closings as above | ($1,000), including undated reserve |
| Lower estimate | target $12,000; entered expenses still $14,000 (§0 decision A: target still governs) | same revised-timing closings — the true dated $14,000 is unaffected | $3,000, netting −$2,000 into No date yet — **this fixture has no other undated cost line, so it is the §4 edge case: confirm a negative, line-less No date yet cell renders correctly here before shipping** |

October's $3,000 balance leaves only $1,000 above zero through the remaining season, not $3,000 for a purchase. A $600 October purchase changes Oct/Nov/Dec closings to $2,400 / $1,400 / $400. September and October both support it in this fixture, so the mockup does not falsely name October the uniquely best month. The original schedule has a September shortage even though Q4 and the season end positive.

The standalone mockup includes empty, estimate-only, dues-unset, dues-set, revised-timing, higher/lower-estimate and over-funded states. View switching and expense previews are functional; persistent app forms and exports are represented in the plan, not simulated as saved data.

When a preview adds an item within an existing unitemized estimate allowance, it consumes that allowance first. The mockup says this explicitly: dating part of an already reserved amount changes timing without increasing the season total. Any excess above the allowance increases planned expenses.

## 7. Implementation sequence

- [x] Trace current report arithmetic and record §164 result/rulings.
- [x] Prepare PM brief, proposal and interactive mockups; verify fixture calculations and script syntax.
- [x] Review revenue-first presentation and the estimate-policy question with the owner — decisions A–D
  made 2026-09-12 (§0). The estimate policy is confirmed unchanged; nothing to revise before build.
- [x] Build one report model with positive bands, explicit dues presence, season opening and full monthly running balances; retain current money capability checks and net-dues contract. *(2026-09-12 — `buildPeriodView` carries `revenueTotals`/`expenseTotals`/`balance`, walked by Budget vs. Actual's own `buildCashFlow` at month resolution; presence is the route's new `duesScheduled`, from the schedules table.)*
- [x] Apply to List and By period together; surface stage-appropriate helper, warning and existing edit doors. Confirm — not revise — that the summary tiles and Budget-basis consumers already read the same estimate-governed total (§4's carried-forward check). *(2026-09-12 — one view object, built unconditionally, read by the tiles, the status line, both tables, the helper and both previews; §4's check holds: with nothing previewed `expenseTotals.total === computeBudgetTotals().totalPlanned`, the estimate in both directions.)*
- [x] Confirm the "over estimate, nothing undated to net against" edge case (§4) renders a correct negative undated figure on both screens before this ships. *(2026-09-12 — rendered on the UAT fixture: "Over your estimate (1,186)" as a bracketed, line-less No date yet cell, netted into Total expenses' undated cell; pinned in the view and export tests.)*
- [x] Deliver the installment schedule preview and the extra-expense preview in this same build (decision D) — not held for a later pass. *(2026-09-12 — the trial is an option on the view, the draft is handed up by the Set-dues sheet; both are transient and neither reaches a file.)*
- [x] Update screen-following CSV/Excel rows, catalogue, import band aliases and non-importable derived rows. Accept historical COSTS/FUNDING files as well as new REVENUE/EXPENSES; round-trip generated files without duplicate dues, balances, estimate reserves or helper rows. *(2026-09-12 — statement and grid files rebuilt from the view; the importer reads both band pairs; a club owning a category called "Revenue" keeps it; round-tripped in tests.)*
- [x] Align help/search terms (including the "Required player dues" / "Player installments" split, decision C) and inspect demo narration against the final wording. *(2026-09-12 — money guide's budget article rewritten; demo re-read recorded in `lib/sandbox-chrome.ts`: no step stops on the plan, nothing quoted the retired words.)*
- [x] Run focused validation; owner performs browser QA. *(2026-09-12 — typecheck, 3,639 unit tests, the `verify:changed` gates, `check:money-report`, `check:pdf`, `check:demos`, `check:layout` on the three budget screens at 361/390/768/1440, and a rendered text probe of both views, the trial, the draft and the pre-dues state on the UAT fixture. Dev server: hot reload picked the change up — a restart is still owed at handoff.)*

No new schema is expected for the report itself; confirm that against current accessors/snapshots at implementation. A saved scenario feature would be separate scope; this proposal uses transient previews.

## 8. Verification for implementation

Meaningful cases: column and row reconciliation; no dues / explicit zero dues / partial roster / adjusted dues and negative undated remainder; both estimate branches; no roster; positive and negative opening; no-date revenue and costs; multi-year and empty months; quarter hiding a negative month; paging preserves earlier carry; truncated date range; an extra expense causing a later shortage; net-positive month with negative opening; over-funded plan. Test the report model, then generated export/import round trips from the actual producer. Existing tests that pin the historical Shortfall (Buffer) shape must be deliberately revised after design review, not deleted simply to make gates pass.

Use focused lint/unit checks and typecheck for shared/API changes. Run required static gates serially. Browser/visual checks belong to the owner under AGENCY_RULES.md; do not claim mockup or application rendering was tested unless explicitly performed. No application server is needed to open this standalone documentation artifact.

### Proposal verification — 2026-09-12

The standalone script parsed successfully. A Node execution with a minimal document stub exercised all eight scenarios in three views, with and without an expense preview: 48 generated table states, checking valid values, band/closing order and column counts. Independently specified fixture expectations passed for unset/set/revised dues, both estimate branches, the zero required-dues floor, quarter endpoints, the $600 October expense and a $1,100 expense that creates a December shortage. Checked the higher estimate's undated expense subtotal and local artifact links. `git diff --check` passed for the edited tracking documents. Browser rendering/visual verification was not run; no application code or server behavior changed in this proposal task.
