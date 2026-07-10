# Coach Money Hub Redesign — Implementation Plan

**Status:** In progress (build started 2026-07-08)
**Owner decisions locked 2026-07-08:**
1. Keep BOTH budget styles — the single "season total" number AND the itemized Season Budget Plan — reconciled elegantly: if a total is set and itemizing has begun, the difference shows as a **"Non-itemized buffer"**; if no total is entered, the total **is** the sum of line items and the UI says so.
2. Replace hub headline stats with **cash-honest numbers**: Money In / Money Out / On Hand / Budget Headroom, computed consistently with Budget vs. Actual.
3. Expense categories become **structured** (same taxonomy as the budget picker); free-text goes away. Existing unmatched categories get a fix-it path.
4. **Full experience in one phase** (anchor + regrouped hub + honest numbers + category discipline + cross-links + standalone cleanup).

## Problem (from the 2026-07-08 UX deep dive)

The Money hub (`app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx`) is 7 identical stacked link cards in non-workflow order with:
- A **false first-run banner** ("Your org admin will set up dues schedules…") — wrong for self-serve coaches and standalone (team-workspace) portals.
- **Two competing budgets** (`rep_program_years.budget_amount` "Budget Set" vs. the itemized `rep_budget_lines` plan) that never reconcile.
- **Dishonest math**: hub "Net Balance" = budgetAmount + duesCollected − totalExpenses (budget counted as income; expenses counts *logged* not *paid*, disagreeing with BvA's paid-only actuals).
- **Free-text expense categories** silently mismatching the BvA case-insensitive name join → spending falls into "Unbudgeted" with no warning (DATA_DICTIONARY gotcha on `rep_team_expenses.category`).
- The **budget → generate-installments** flow (the best feature) is undiscoverable from the Dues page.
- **Org Allocations / Payment Requests cards always render**, even for standalone team-workspace orgs that have no org admin.
- Automatic Dues Reminders toggle lives on the hub, not with Dues.
- BvA has no export and no fix-it for unbudgeted rows.

## Design (matches Lineups Hub / Overview conventions: `.nowCard` anchor, earned lime, hub + drill-in, tokens not hex)

### 1. New API — `GET /api/coaches/[orgSlug]/teams/[teamId]/money-summary`
One server-computed payload (money-view gated via `canViewMoney`), replacing the hub's `/budget` + `/accounting-settings` reads:
- `stage`: `'plan' | 'collect' | 'operate'`
  - `plan` — no effective budget AND no dues schedules
  - `collect` — budget exists (season total OR lines), no dues schedules yet
  - `operate` — schedules exist. Operate sub-states derived client-side: overdue → never-paid → all-collected → on-track. (No 'wrapup' stage: `getActiveRepProgramYear` means the Money section only ever sees an active year; the refund calculator stays discoverable on Dues.)
- `moneyIn`: duesCollected (paid installments) + fundraisingRaised (`rep_fundraiser_entries.amount_raised`) + orgFunding (approved `charge_to_org` payment requests) + total
- `moneyOut`: expensesPaid (paid legs only, mirroring BvA `paidAmount()` semantics) + allocationsPaid (paid `rep_allocation_installments`) + orgPayments (approved `payment_to_org`) + total
- `onHand` = in − out
- `budget`: seasonTotal (`rep_program_years.budget_amount`), itemizedTotal (Σ `rep_budget_lines.total_amount`), **effectiveTotal = max(itemizedTotal, seasonTotal ?? 0)**, buffer (= effectiveTotal − itemizedTotal when seasonTotal > itemized), overItemized flag, lineCount, hasInstallments, rosterCount, perPlayer
- `headroom` = effectiveTotal − expensesPaidTotal (identical basis to BvA once BvA adopts effectiveTotal) — null when no budget
- `dues`: expected/collected/outstanding, overdueCount + overdueAmount (unpaid past due_date), neverPaidCount (server mirror of `isNeverPaidPlayer`: has schedule/outstanding, zero paid installments, credits counted), schedulesCount, playersCount
- `fundraisers`: activeCount, totalRaised, creditsIssued
- `expenses`: paidTotal, loggedCount, upcomingDueCount (unpaid deposit/balance legs due ≤30d)
- `allocations`: count, totalAllocated, outstanding, overdueCount — and `paymentRequests`: pendingCount
- `orgLinked` = `!isTeamWorkspaceOrg(ctx.org)` (drives hiding Org Allocations + Payment Requests)
- `autoRemindersEnabled` (so the hub no longer needs it; Dues page fetches accounting-settings itself)
Note: `rep_team_payment_requests` has no program_year scoping — sums filter by team_id only (single-active-season semantics; acceptable, documented here).

### 2. Money hub rebuild (`accounting/page.tsx`)
- **Stage-aware `.nowCard` anchor** (one lime CTA max, write-capability aware; read-only assistants get status-only copy with view links):
  - plan → "Start with your season budget" (meta teaches Plan → Collect → Spend → Review; lime **Build your budget** → budget page; secondary "Set dues directly"). Variant when seasonTotal set but no lines: "Break your budget into line items."
  - collect → "Turn your plan into player dues" ($effective across N players ≈ $X each; lime **Generate installments** → budget page `?generate=1`; secondary "Set dues manually")
  - operate → overdue: "N players overdue · $X" (lime **Send reminders** → dues) › never-paid: "N players haven't paid anything yet" (lime **Review dues**) › all-collected: "All dues collected 🎉" (CTA Log an expense) › on-track: "You're on track" (collected/expected %, headroom stat; CTA Log an expense)
- **Cash-honest summary cards**: Money In (sub "dues + fundraising"), Money Out (sub "expenses + org payments"), On Hand (in − out, signed colour), Budget Headroom (vs effective budget; em-dash + "no budget yet" when none). All tokens, no literal hex. The inline "Budget Set" editor moves to the Budget page.
- **UpcomingPayablesPanel** stays.
- **Grouped card list** replacing the flat stack — group labels teach the workflow: **Plan** (Season Budget Plan — effective total + per-player, or "Not started"), **Collect** (Player Dues — $collected of $expected + overdue/unpaid chip; Fundraisers — $raised · $credits credited), **Spend** (Expenses & Payables — $paid + N due soon; Org Allocations + Payment Requests only when `orgLinked`), **Review** (Budget vs. Actual — live headroom, or "Needs a budget plan").
- **Delete** the false HelpCallout banner (anchor replaces it) and the auto-reminders row (moves to Dues).

### 3. Budget page (`accounting/budget/page.tsx`)
- Summary banner gains a **Season total (optional)** inline-editable item (reuses existing `PATCH /budget`); reconciliation display:
  - seasonTotal > itemized → "Non-itemized buffer $X" pseudo-row above the grand total + banner item; per-player uses effectiveTotal
  - itemized > seasonTotal(>0) → warning: line items exceed the season total; plan uses the itemized sum
  - no seasonTotal → grand-total row states "= sum of your line items"
- `?generate=1` deep link auto-opens the Generate Installments modal when eligible (used by the hub collect anchor + Dues cross-link).
- `budget-plan` GET extended to return `seasonBudgetAmount` (programYear.budgetAmount).

### 4. Budget vs. Actual (route + page)
- Route adds `seasonTotal`, `effectiveBudget`, `buffer`; **headroom switches to effectiveBudget − totalActual**. Empty-report gate becomes "no lines AND no seasonTotal".
- UI: headroom banner Total Budget = effective (+ "includes $X non-itemized buffer" subtext); buffer row in the category table (budgeted = buffer, actual —).
- **Export** (xlsx/csv/pdf via existing `lib/export` + `ExportMenu`, `pdf_exports`-gated like Dues) of the summary + category/line variance table.
- **Unbudgeted fix-it**: per-row "Recategorize" (money-write only) → category picker modal → existing `PATCH /expenses/[expenseId]` `{category}` → reload.

### 5. Expenses page
- Category **select** (taxonomy from `GET /api/coaches/[orgSlug]/budget-items`, team/both scopes) replaces the free-text input in both Add modals; "— No category —" allowed.
- Entry-time warning when the chosen category has no budget line (and a plan exists): "Won't count against your budget plan — shows as Unbudgeted in Budget vs. Actual."

### 5b. Follow-ups built 2026-07-09 (owner walkthrough feedback)
- **Button/nav consistency:** all Money sub-pages moved onto the coach-portal button set (one lime primary per page, grey secondary; Budget page was on the app-wide blue set); the visible breadcrumb trail on Budget/BvA (hidden portal-wide elsewhere) replaced by a single "← Back to Money" link on every sub-page ("← Back to Fundraisers" on the fundraiser detail), flush-left above the header icon. New shared `.backLink` class in coaches.module.css.
- **Coach-created categories:** coaches with money-write can now create top-level budget categories inline from the picker ("+ Add custom category…"), saved org-wide with scope `team` (previously org owner/treasurer only — unreachable for standalone Premium coaches). Extended the coach budget-items POST with `newCategoryName`; `BudgetItemPicker` gains `allowCreateCategory` (coach budget planner only).
- **Percent period splits:** the line modal's Period Breakdown gains a $/% toggle (values convert both ways when the total is set), a "Split evenly" helper (last row absorbs the rounding remainder), live computed-$ per row in % mode, and 100%-sum validation. Storage unchanged — % converts to exact-cent dollars on save.

### 6. Dues page
- **Automatic Dues Reminders** toggle card relocates here (same `accounting-settings` API), write-gated.
- **Generator cross-link** when players exist but zero schedules (write): budget lines exist → callout linking budget `?generate=1`; no budget → tip suggesting the budget-first path alongside "Set dues for all players".

## Non-goals / kept as-is
- No migration; no `lib/db.ts` / `lib/types.ts` shared-type changes (route + pages own local interfaces).
- Fundraisers pages unchanged. Nav unchanged (`lib/coach-nav-visibility.ts` already gates Money by capability).
- BvA date-range/category filters deferred (export covers slicing V1).
- The unified all-sources transaction feed ("where did every dollar go" ledger view) deferred — Money Out totals now reconcile the three spend systems on the hub, which addresses the confusion at the summary level.

## Verification
- `npm run lint:focused` on touched files; `npm run typecheck` (new API route + page changes).
- Dev-server restart before handoff (new files added).
- Manual test matrix: standalone workspace org (no org cards) vs org-linked; head coach vs money-read assistant vs money-off; each stage (empty team → budget → generate → overdue).
- Post-build: offer `/review` (High risk: money math) + `/docs` (coach help recipes reference the Money workflow).
