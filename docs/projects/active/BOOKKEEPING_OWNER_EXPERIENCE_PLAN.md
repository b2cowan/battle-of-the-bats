# Owner bookkeeping: easier daily work

**Status:** Proposal written 2026-10-24 for owner review. This is a new experience and reporting plan for the existing private bookkeeping tool. The earlier build was stopped and archived on 2026-10-23 after its expense-only gate passed; its [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md) remains the record of what was completed and what still needs an owner.

**PM brief:** [BOOKKEEPING_OWNER_EXPERIENCE_PM_BRIEF.md](BOOKKEEPING_OWNER_EXPERIENCE_PM_BRIEF.md)  
**Browser review and progress:** [BOOKKEEPING_OWNER_EXPERIENCE_REVIEW.html](BOOKKEEPING_OWNER_EXPERIENCE_REVIEW.html) — Stage 0 screen concepts, decisions and durable task checklist.  
**Existing screen exploration:** [B0 screen designs](../archive/BOOKKEEPING_B0_SCREEN_DESIGNS.html) — useful separation of tasks, but its entry form still exposes too many accounting fields at once.  
**Related launch work:** [Revenue and accounting readiness](REVENUE_ACCOUNTING_READINESS_PLAN.md) owns the Stripe source contract, tax and fee decisions, and payment implementation.

## 1. Outcome and scope

The sole proprietor can record a normal purchase, find its receipt, correct an error, understand recorded spending, and give an accountant the matching records without learning accounting-system terms. Start with expenses already supported by the tool. Add a full proprietor ledger only after the revenue source and owner-movement contracts are settled.

The tool is private to the authorized bookkeeping owner. It has its own AWS expense records and receipts; the club and coach accounting screens are interaction references, not a source of proprietor transactions.

### What the code does today

- One page puts a fixture-only Stripe CSV preview first, then a long expense form, then an expense report and the expense list. An ordinary CAD purchase asks for both invoice total and CAD total. The payment source defaults to **Paid personally**. USD conversion and tax fields are visible even for an ordinary CAD purchase. Correcting a row scrolls to the top, where the preview sits ahead of the form. See `app/platform-admin/bookkeeping/BookkeepingClient.tsx`.
- The tool stores expense revisions and private receipts. Its report covers recorded expenses, purchase-tax status, categories, payment sources and missing evidence. Filtered CSV and receipt package exports already work. The owner reported the B2 expense-only walk passed 13/13 on 2026-10-23.
- It has no posted income, processor fees, payouts, owner transfers, bank reconciliation, or validated business cash balance. Its Stripe CSV control is a local fixture preview; it does not import or post rows. The [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md) identifies the unfinished source and operating gates.
- The current `expense_date` field is labelled “Date paid or incurred,” mixing two events in one period filter. `tax_cad_cents = 0` with `tax_status = pending` cannot distinguish an unknown tax amount from a confirmed zero. Category suggestions come only from existing free-text entries.

## 2. Experience to build

| Place | First thing the owner sees | Main action |
|---|---|---|
| **Overview** | Recorded spend for a named period, receipts/details needing attention, and recent expenses | **Add expense** |
| **Expenses** | Searchable list with date, supplier, category, business amount, payment source and receipt state | Open a row to see its record |
| **Expense record** | The entered facts and original receipt, followed by change history | Correct; Void and permanent Delete are secondary actions |
| **Reports** | A named month/year/custom period, recorded spend by category and supplier, personal payments, tax/evidence status and the matching entries | Open the entries behind a figure; export the visible report |
| **Sources** | The current fixture preview in an advanced area with clear “preview only” status | Review a source file when the Revenue contract is accepted; no posting control yet |

**Ordinary expense flow:** Add expense → enter the expense date (incurred), supplier, one amount, category, what it was for, how it was paid, and attach a receipt → review → Save → open the saved expense. The payment date defaults to the incurred date. A **Payment date is different from expense date** checkbox reveals the second date only when needed; toggling it off restores the incurred date. The form labels use words an owner uses. It asks for a payment source explicitly. For CAD, the same entered amount supplies the stored original and CAD totals. USD reveals the original amount, CAD amount, conversion source and date. Business-use share and purchase-tax details live in a clearly named **More details** section when they need attention. A missing receipt is allowed and appears in the review queue.

**Record flow:** The row opens one readable record with the receipt, all amounts, payment source and history. Correct opens the same focused form with existing values and asks why the record changed. Void is a separate question. Permanent Delete remains available because the owner requested it on 2026-10-23; it sits under secondary actions with the permanent-loss consequence stated before confirmation.

**Reporting rule:** Until income, payouts and bank movements are accepted and reconciled, Overview and Reports describe **recorded expenses**. They do not display profit, cash on hand, a bank balance or recoverable tax. The proposed period convention is incurred date for expense reports and paid date for future payment/cash views; confirm it in the owner walk. Neither view silently treats a legacy “paid or incurred” value as both dates. Each summary figure must trace to the exact entries it counts. Existing CSV/ZIP exports keep the visible filters and revision/receipt evidence.

## 3. Proposed stages and order

| Stage | Deliverable | Dependency and exit check |
|---|---|---|
| **0. Set the daily flow** | Updated review mockup for Overview, Expenses, Add expense, Expense record and Reports; a field-by-field before/after list; owner walk of one CAD purchase, one USD purchase, missing receipt and correction. Record the approved new-entry date and unknown-tax rules, and resolve legacy date mapping before changing stored records. | Uses existing B0 designs and code. Exit: owner can point to the intended first click, each field they must enter, and where a saved expense appears. |
| **1. Make expenses easy to record and find** | Store incurred and paid dates separately under the Stage 0 legacy mapping before exposing the new form. Overview and Expenses become the daily doors; focused Add expense and record views; CAD one-amount entry; conditional USD and advanced fields; explicit payment source; readable categories and field-specific errors; one record window with receipt/history; technical CSV preview moved to Sources. Apply the app's warm type, window, toolbar and phone control rules. | Preserve current expense revisions, receipt paths and export contracts. Exit: the owner completes the four Stage 0 journeys without hunting through the report or retyping a CAD amount. |
| **2. Make the expense facts and reports trustworthy** | Apply incurred-date period filters and the legacy-date rule to reports; represent unknown purchase tax distinctly from confirmed zero; provide a controlled starting category list with correction of old spellings; an actionable missing-evidence queue; period, category and supplier reports with drill-down; printable owner/accountant summary if the owner needs it. | Requires the Stage 1 date contract and careful tax migration of existing expense revisions. Exit: every displayed total opens its contributing entries, and exports agree with the selected report. |
| **3. Add the proprietor ledger and reconciliation** | A dated money-in/money-out ledger with source detail, separate owner contributions/draws, income, Stripe fees/refunds/payout transfers and reconciliation status. Use the club/coach ledger's readable rows, filters and record window; keep the proprietor's data and accounting rules separate. | Requires Revenue to accept the real Stripe source identifiers, seller/tax attribution, fee/refund links and payout mapping, plus an accountant-reviewed owner-movement model. Exit: repeat and interrupted imports do not duplicate money; payouts and reimbursements do not become new income or expense. |
| **4. Prove operating handoff** | Backup custody and restore proof, accountant review of reports and source documents, and a first real close with exceptions resolved. | Carries forward unfinished B4 work from the archived project. Exit: records and receipts can be recovered and the owner can hand over one complete period. |

Stages 0–2 improve a useful expense-only tool. Stage 3 is a separate financial-data build with a firm dependency on Revenue's accepted contract. Stage 4 can prepare its backup work alongside earlier stages, then close against real records.

## 4. Reuse from the existing app

- Club Accounting Overview's short figures and “Waiting on you” pattern inspire the expense-only overview. The new figures use proprietor expense data and explicit period labels.
- Both Ledgers' filtered list, whole-row record door and source-aware read window inspire the expense register and later proprietor ledger. They are UI patterns; the club/team ledger tables and balances stay separate.
- Budget vs. Actual's “open the amount to see the lines behind it” pattern makes each report total explainable. The proprietor report starts with actual expenses, since it has no approved budget model.
- The shared One Window and toolbar rules supply form, confirmation, focus, dismissal and phone control behavior. The current native `window.confirm` and tiny inline row actions should give way to that interaction recipe.

## 5. Stage 0 owner rulings and remaining definitions

1. **D1 — dates (owner direction, 2026-10-24):** New entries carry incurred and paid dates. Paid defaults to incurred; a checkbox reveals a different payment date. **Proposed reporting convention to confirm:** expense reports use incurred date; future payment/cash views use paid date. The existing `expense_date` is labelled “paid or incurred,” so historical rows cannot safely populate both new dates. Review their evidence and define an explicit legacy/unknown display and export rule before migration.
2. **D2 — tax (approved, 2026-10-24):** Store unknown purchase tax separately from confirmed $0. The owner can record tax shown on a receipt without the product claiming a credit. The exact data migration remains in Stage 2.
3. **D3 — categories (direction approved, 2026-10-24):** Use a short initial set of plain-language categories and a clear way to add or correct one. Select the initial labels during the owner walk; preserve original spellings in revision history.
4. **D4 — receipt (approved, 2026-10-24):** Put upload beside the core entry fields, with a visible **Add it later** path and a missing-receipt follow-up item.
5. **D5 — reports (approved, 2026-10-24):** First answer spend in the selected period, purchases needing evidence, and personally paid purchases.

These are product/data definitions. The experience work can be designed immediately. Tax treatment and full ledger classifications remain with the accountant and Revenue workstream.

## 6. Acceptance and implementation discipline

- The owner can add a normal CAD expense with one amount entry; USD reveals only its necessary evidence; an absent receipt remains visible for follow-up.
- A saved expense is easy to find, open, correct and export. A correction keeps the previous revision and original receipt; void and delete have distinct consequences.
- The selected period is named on every figure and export. Voided expenses are excluded from active expense totals, and filtered export contents match the visible entries.
- Phone controls meet the product's 44px tap floor; labels and refusals read in plain language; the form does not lose entered work on an incidental dismissal.
- Owner browser and visual verification follows the repo's `AGENCY_RULES.md`. Code changes to shared components, API/data contracts or config take their required focused/static gates and restart before handoff.

**Recommended start:** review the five first-pass screen concepts in the browser review page against a real ordinary CAD expense, then walk the USD, missing-receipt, different-payment-date and correction paths. Select the initial category labels and resolve how existing ambiguous dates are represented. Then build Stage 1 as one owner-walkable slice: Overview → Add expense → saved record → Expenses list.
