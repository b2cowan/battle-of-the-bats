import { NextResponse } from 'next/server';
import {
  getRepTeamTagLibrary, getRepTeamExpenseTagsMap, getRepDuesPaymentsByProgramYear,
  getRealisedFundraiserEntries, getRepTeamMoneyIn, getDerivedIncomeClaims,
  getRepAllocationSplitsForTeam,
} from '@/lib/db';
import { clubRequestIsReimbursement, type ClubRequestType } from '@/lib/coach-club-money';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { tournamentToday, orgDayKey } from '@/lib/timezone';
import {
  buildMonthGrid, monthKeyOf,
  type CategoryEvent, type GridLine, type PriorLine,
} from '@/lib/coach-budget-months';
import { computeBudgetTotals, normalizeBudgetLineKind, isFundingKind } from '@/lib/coach-budget-totals';
import {
  rollupMoneyReport, type RollupLine, type RollupSpend, type RollupRefund, type ItemRow,
} from '@/lib/coach-budget-rollup';
import { placeDerivedActual } from '@/lib/coach-money-derived';
import { duesPaidAmount, paymentsTotalByPlayer } from '@/lib/dues-payments';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';

/** A category row without the raw records behind each item — see the note at the payload. */
function slimCategory<T extends { items: ItemRow[] }>(cat: T) {
  return {
    ...cat,
    items: cat.items.map(({ lines: _lines, costs: _costs, costCount: _costCount, ...item }) => item),
  };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual
//
// Returns a full budget-vs-actual report for the active program year.
//
// ⚠ THE REPORT IS TWO LEVELS: CATEGORY → ITEM (owner ruling 2026-08-15), and a cost reaches them
// three ways that coexist — its ITEM (mig 240), its category id, or its free-text `category` matched
// by NAME, which is every row written before any of this. All three land under the same headings,
// which is what makes shipping without a backfill safe.
// Two budget lines on one item SUM into one row; an item with spending and NO line is its own
// flagged row; and whether something was budgeted is DERIVED, never stored. The rule lives in
// lib/coach-budget-rollup.ts, which owns it for this route and the screen together.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Optional money-tag filter (Phase 3): when ?tagId= is present, the actuals are scoped to
  // expenses carrying that tag (the budget plan stays whole) — a "spend by tag" cut of the report.
  const filterTagId = new URL(req.url).searchParams.get('tagId');

  // ── 1. Load budget lines + periods ──────────────────────────────────────
  const { data: linesRaw } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('*, rep_budget_periods(*), budget_categories(name), budget_items(name)')
    .eq('program_year_id', programYear.id)
    .order('sort_order');

  const allLines = (linesRaw ?? []) as Array<Record<string, unknown>>;
  /* ⚠ MONEY-IN LINES STILL MUST NOT ENTER THE COST MACHINERY — but the mechanism changed in
     mig 243, and the old one would now be wrong. Until this release they were FILTERED OUT at the
     top, because the report matches costs to a category by NAME and a funding line filed under
     "Fundraising" would have sat waiting to absorb a real expense carrying that word. They now
     carry a category and an item of their own, so filtering them out would lose them — instead
     they go through the rollup with `direction: 'in'`, which puts them in a different SECTION.
     A cost and an income row can never collide even on the same category+item, because direction
     is part of the grouping key (lib/coach-budget-rollup.ts rule 5).
     ⚠ BOTH MONEY-IN KINDS, through `isFundingKind`. Naming one would leave the other on the cost
     side, where it would inflate the very budget it exists to offset (2026-08-15). */
  const lines = allLines.filter(l => !isFundingKind(l.line_kind as string | null));
  const fundingLines = allLines.filter(l => isFundingKind(l.line_kind as string | null));

  // ── 2. Load expenses (paid and unpaid) ───────────────────────────────────
  const { data: expensesRaw } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('id, description, category, budget_item_id, budget_category_id, amount, expense_paid_at, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, expense_type, created_at, budget_items(name, category_id, budget_categories(name))')
    .eq('program_year_id', programYear.id)
    .order('created_at');

  const allExpenses = (expensesRaw ?? []) as Array<Record<string, unknown>>;

  /* ── 2b. Club money (money redesign P4, 2026-08-17) ───────────────────────────────────────────
     ⚠⚠ NONE OF THIS REACHED THIS REPORT BEFORE. See the long note at the rollup call for what was
     missing and why; this is the read.

     ⚠ SKIPPED ENTIRELY WHEN A MONEY TAG IS FILTERING. "Spend by tag" is a cut of the tagged
     EXPENSES, and club money carries no tags — folding it in would make every tag's total include
     the same untagged club bill, so the filtered figures would not sum to the unfiltered one and
     the cut would be meaningless. Same rule the expenses half applies one block up.

     ⚠ SPLITS ARE SEASON-SCOPED, matching every other read on this page and the P4 correction to the
     Club tab itself. Requests are approved-only: a pending one is money the club may still decline
     and belongs to no settled figure anywhere. */
  /* ⚠⚠ ONE WAVE, AND IT REUSES THE SHARED READER (`/simplify`, 2026-08-17 — all four lenses landed
     on this block). The first draft stood up its own `rep_allocation_splits` +
     `rep_allocation_installments` queries and then a THIRD wave to turn filing ids into words —
     re-implementing `getRepAllocationSplitsForTeam`, which had been rewritten in this very release
     and already returns exactly this shape with the names joined. Three extra sequential round
     trips on a report screen's critical path, on a route whose own comments already call out being
     "a long serial chain of awaits".

     Both legs depend only on `teamId` / `programYear.id` / `filterTagId`, all known here, so they
     ride one `Promise.all`. */
  const [clubSplits, clubReqRes] = await Promise.all([
    filterTagId
      ? Promise.resolve([] as Awaited<ReturnType<typeof getRepAllocationSplitsForTeam>>)
      : getRepAllocationSplitsForTeam(teamId, programYear.id),
    filterTagId
      ? Promise.resolve({ data: [] as Array<Record<string, any>> })
      : supabaseAdmin
          .from('rep_team_payment_requests')
          .select('id, request_type, amount, description, reviewed_at, created_at, budget_item_id, budget_category_id, budget_items(name), budget_categories(name)')
          .eq('team_id', teamId)
          .eq('program_year_id', programYear.id)
          .eq('status', 'approved'),
  ]);

  const clubApprovedRequests = ((clubReqRes.data ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id as string,
    requestType: r.request_type as ClubRequestType,
    amount: Number(r.amount ?? 0),
    description: (r.description as string) ?? '',
    categoryId: (r.budget_category_id as string | null) ?? null,
    categoryName: (r.budget_categories?.name as string) ?? null,
    itemId: (r.budget_item_id as string | null) ?? null,
    itemName: (r.budget_items?.name as string) ?? null,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));

  // Money-tag library (team + org-shared) for the filter chip row, and which tags each expense
  // carries. When a tag filter is active, the actuals-side of the report only sees tagged expenses.
  const [expenseTags, tagsByExpenseId] = await Promise.all([
    getRepTeamTagLibrary(teamId, 'expense', ctx.org.id),
    getRepTeamExpenseTagsMap(allExpenses.map(e => e.id as string)),
  ]);
  const expenses = filterTagId
    ? allExpenses.filter(e => (tagsByExpenseId[e.id as string] ?? []).includes(filterTagId))
    : allExpenses;

  // Compute the "paid amount" for each expense:
  // - simple expense → amount when expense_paid_at IS NOT NULL
  // - tournament_payable → deposit when deposit_paid_at + balance when balance_paid_at
  function paidAmount(exp: Record<string, unknown>): number {
    if (exp.expense_type === 'tournament_payable') {
      return (exp.deposit_paid_at ? (exp.deposit_amount as number ?? 0) : 0)
           + (exp.balance_paid_at  ? (exp.balance_amount  as number ?? 0) : 0);
    }
    return exp.expense_paid_at ? (exp.amount as number) : 0;
  }

  // Effective paid date for sorting/period assignment (earliest paid event)
  function paidDate(exp: Record<string, unknown>): string | null {
    const dates: string[] = [];
    if (exp.expense_paid_at)  dates.push(exp.expense_paid_at  as string);
    if (exp.deposit_paid_at)  dates.push(exp.deposit_paid_at  as string);
    if (exp.balance_paid_at)  dates.push(exp.balance_paid_at  as string);
    if (dates.length === 0) return null;
    return dates.sort()[0].slice(0, 10);
  }

  // ── 3–5. Roll the plan and the spending up to CATEGORY → ITEM ───────────────────────────────
  //
  // ⚠ THE ITEM IS THE KEY — NOT THE LINE, AND NEVER THE DESCRIPTION (owner ruling 2026-08-15). Two
  // lines on one item SUM into one row, an item with spending and no line is its own row, and the
  // rule lives in lib/coach-budget-rollup.ts so this route and the screen cannot group one plan two
  // different ways. That module's header carries the reasoning, including why the one-day-old
  // expense→line link was retired to get here.
  //
  // Resolving ONE cost to its place in the taxonomy, in strict order of trust:
  //   1. its ITEM (mig 240) — which states the category too, since an item lives in exactly one;
  //   2. its category id (mig 238) — an imported or part-classified row;
  //   3. its free-text `category`, matched by NAME against the categories the plan uses, exactly as
  //      this report has always done for every row written before any of it existed.
  // Anything resolving to none of the three is spending with no category at all, and gets one
  // honest row of its own rather than a separate section nobody scrolls to.
  const categoryNameById = new Map<string, string>();
  const categoryIdByName = new Map<string, string>();
  const learnCategory = (catId: string | null, catName: string | null) => {
    const name = (catName ?? '').trim();
    if (!catId || !name) return;
    if (!categoryNameById.has(catId)) categoryNameById.set(catId, name);
    if (!categoryIdByName.has(name.toLowerCase())) categoryIdByName.set(name.toLowerCase(), catId);
  };

  for (const line of lines) {
    learnCategory(
      line.category_id as string | null,
      ((line.budget_categories as Record<string, unknown> | null)?.name as string) ?? null,
    );
  }
  /* ⚠ AND FROM THE SPENDING TOO, or a category the team never budgeted for SPLITS IN TWO. Learning
     names only from budget lines means a category with no line has no id↔name pairing at all — so a
     cost carrying its id buckets under the id while a sibling cost carrying only the typed text
     buckets under the name, and the report shows "Officials" twice, $2,000 and $600, for one $2,600
     category. The season total stayed right; the breakdown a coach actually reads did not. (The two
     rows also shared one expand toggle, being keyed by name.) */
  for (const exp of expenses) {
    const item = exp.budget_items as Record<string, unknown> | null;
    learnCategory(
      (exp.budget_category_id as string | null) ?? (item?.category_id as string | null) ?? null,
      ((item?.budget_categories as Record<string, unknown> | null)?.name as string)
        ?? (exp.category as string | null),
    );
  }
  /* ⚠ AND FROM CLUB MONEY (P4), for exactly the reason above: a club bill filed under a category the
     team has neither budgeted for nor spent against otherwise would arrive with an id this map
     cannot name, and split that category into an id row and a name row. */
  for (const s of clubSplits) learnCategory(s.budgetCategoryId, s.budgetCategoryName);
  for (const r of clubApprovedRequests) learnCategory(r.categoryId, r.categoryName);

  const toRollupLine = (l: Record<string, unknown>, direction: 'in' | 'out'): RollupLine => ({
    id:           l.id as string,
    categoryId:   (l.category_id as string | null) ?? null,
    categoryName: ((l.budget_categories as Record<string, unknown> | null)?.name as string) ?? null,
    itemId:       (l.item_id as string | null) ?? null,
    itemName:     ((l.budget_items as Record<string, unknown> | null)?.name as string) ?? null,
    totalAmount:  (l.total_amount as number) ?? 0,
    description:  l.description as string,
    notes:        (l.notes as string | null) ?? null,
    direction,
    periods: ((l.rep_budget_periods ?? []) as Array<Record<string, unknown>>)
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map(p => ({
        label:     p.period_label as string,
        date:      p.period_date as string | null,
        amount:    p.amount as number,
        sortOrder: p.sort_order as number,
      })),
  });
  const rollupLines: RollupLine[] = lines.map(l => toRollupLine(l, 'out'));

  /** Where one cost sits in the taxonomy — the three-step resolution above, in one place. */
  function placeCost(exp: Record<string, unknown>) {
    const item = exp.budget_items as Record<string, unknown> | null;
    if (exp.budget_item_id && item) {
      const catId = (item.category_id as string | null) ?? null;
      return {
        categoryId:   catId,
        categoryName: ((item.budget_categories as Record<string, unknown> | null)?.name as string)
          ?? (catId ? categoryNameById.get(catId) ?? null : null),
        itemId:       exp.budget_item_id as string,
        itemName:     (item.name as string) ?? null,
      };
    }
    const explicitCat = exp.budget_category_id as string | null;
    if (explicitCat) {
      return {
        categoryId:   explicitCat,
        categoryName: categoryNameById.get(explicitCat) ?? (exp.category as string | null),
        itemId: null, itemName: null,
      };
    }
    const text = ((exp.category as string | null) ?? '').trim();
    return {
      categoryId:   text ? categoryIdByName.get(text.toLowerCase()) ?? null : null,
      categoryName: text || null,
      itemId: null, itemName: null,
    };
  }

  /* Resolved ONCE per expense, then read by both the category table and the month grid below.
     Those are two readings of one report: a cost landing under Facilities in one and under a stale
     string in the other is the same product answering itself twice — and resolving it twice was
     also plain repeated work. */
  const placedByExpense = new Map<string, ReturnType<typeof placeCost>>(
    expenses.map(exp => [exp.id as string, placeCost(exp)]));
  const placedFor = (exp: Record<string, unknown>) =>
    placedByExpense.get(exp.id as string) ?? placeCost(exp);

  const rollupSpend: RollupSpend[] = expenses
    .map(exp => ({ exp, paid: paidAmount(exp) }))
    .filter(({ paid }) => paid > 0)   // only paid amounts are actuals
    .map(({ exp, paid }) => ({
      id:          exp.id as string,
      description: exp.description as string,
      ...placedFor(exp),
      amount:      paid,
      paidDate:    paidDate(exp),
    }));

  /* ── Money IN, in the same two levels (mig 243) ──────────────────────────────────────────────
     Three feeds, one grouping pass:
       · money-in BUDGET lines, as revenue rows;
       · TYPED arrivals, as their actuals;
       · the DERIVED pools — what fundraisers and sponsors already report — placed as deep in the
         taxonomy as the claiming lines actually agree.
     ⚠ AND MONEY BACK, which is none of the three: it nets into the row it repaid, on either side,
     and never appears as income (COACH_MONEY_BACK_ON_A_COST_PLAN §4.3). */
  /* ⚠ ALL THREE IN ONE TRIP. This route already runs a long serial chain of awaits, and the
     realised-entries read below needs nothing these two produce — whether to make it at all is
     decided by `fundingLines`, which was known before this line. Left sequential it was one more
     round trip on every request from a team that budgets any fundraising, which is most of them. */
  const [moneyInRecords, derivedClaims, realisedEntries] = await Promise.all([
    getRepTeamMoneyIn(programYear.id),
    getDerivedIncomeClaims(programYear.id),
    fundingLines.length > 0 ? getRealisedFundraiserEntries(programYear.id) : Promise.resolve([]),
  ]);

  for (const line of fundingLines) {
    learnCategory(
      line.category_id as string | null,
      ((line.budget_categories as Record<string, unknown> | null)?.name as string) ?? null,
    );
    rollupLines.push(toRollupLine(line, 'in'));
  }

  /**
   * Where a money-in record sits. Both names come WITH the record (one join, in the reader) —
   * the list, the export and this route all read the same two fields.
   *
   * ⚠ THE ITEM NAME IS NOT OPTIONAL HERE. An earlier draft passed null on the reasoning that the
   * budget line would supply it; an arrival on an item the plan never mentions has no budget line,
   * so its row rendered as "Not itemized" on the report while the register two clicks away showed
   * its real name — the same fact, two answers.
   */
  const placeArrival = (m: (typeof moneyInRecords)[number]) => ({
    categoryId:   m.budgetCategoryId,
    categoryName: m.budgetCategoryName
      ?? (m.budgetCategoryId ? categoryNameById.get(m.budgetCategoryId) ?? null : null),
    itemId:       m.budgetItemId,
    itemName:     m.budgetItemName,
  });

  const incomeSpend: RollupSpend[] = moneyInRecords
    .filter(m => m.kind === 'income')
    .map(m => ({
      id: m.id,
      description: m.description ?? '',
      ...placeArrival(m),
      amount: m.amount,
      paidDate: m.receivedDate,
      direction: 'in' as const,
    }));

  const refunds: RollupRefund[] = moneyInRecords
    .filter(m => m.kind === 'money_back')
    .map(m => ({
      id: m.id,
      description: m.description ?? '',
      ...placeArrival(m),
      amount: m.amount,
      receivedDate: m.receivedDate,
    }));

  /* ⚠⚠ THE DERIVED POOLS, AND WHY THEY ARE NOT TYPED (§4.1). Fundraisers and sponsors report their
     own realised figures — receipts only, less whatever was rebated to the player who raised it —
     and PLAYER REBATES ARE COMPUTED FROM THEM. A coach cannot also type an income record on those
     rows (the money-in write path refuses it), so counting both here is impossible by construction
     rather than by care.
     ⚠ SPLIT BY SOURCE. Drives and sponsors are two totals against two sets of lines; placing one
     with the other's category would look precise and be wrong. */
  const derivedSpend: RollupSpend[] = [];
  if (fundingLines.length > 0) {
    for (const source of ['fundraiser', 'sponsor'] as const) {
      const total = realisedEntries
        .filter(e => e.kind === source)
        .reduce((s, e) => s + (e.amountRaised - e.rebateAmount), 0);
      if (Math.abs(total) < 0.005) continue;
      const at = placeDerivedActual(derivedClaims.filter(c => c.source === source));
      derivedSpend.push({
        id: `derived-${source}`,
        // Named so the drill-in says where the figure came from — a coach who cannot find the
        // record behind a number has to be told there isn't one to find.
        description: source === 'fundraiser' ? 'From your fundraisers' : 'From your sponsors',
        categoryId: at.categoryId, categoryName: at.categoryName,
        itemId: at.itemId, itemName: at.itemName,
        amount: Math.round(total * 100) / 100,
        paidDate: null,
        direction: 'in' as const,
      });
    }
  }

  /* ══ CLUB MONEY — absent from this report entirely until 2026-08-17 (money redesign P4) ═══════
     ⚠⚠ THIS IS A FIX, NOT A FEATURE. This route read the plan, `rep_team_expenses`,
     `rep_team_money_in`, realised fundraiser entries and dues — and neither `rep_allocation_*` nor
     `rep_team_payment_requests`. So on a club-run team, every dollar of the club's bill the team
     PAID and every cost the club AGREED TO COVER were missing from the one screen that answers
     "how did we do against plan?" — frequently the season's single largest line. The owner found it
     by asking why a request did not name a budget category.

     It could not have been fixed by reading harder: club money carried no team-side classification
     at all. Migration 250 adds it, a coach files it, and this is where it arrives.

     ⚠ NO DOUBLE COUNT IS POSSIBLE. Approving a request posts a ledger transfer and creates NO
     `rep_team_expenses` row (the two tables are decoupled by design — DATA_DICTIONARY, this table's
     gotcha 3), and an allocation instalment has never had an expense row either. Club money is not
     reachable from any other feed on this page.

     ⚠⚠ THE THREE KINDS DO NOT ALL LAND ON THE SAME SIDE, and the odd one is the whole rule:
       · a PAID allocation instalment  → a cost
       · an approved `payment_to_org`  → a cost (the team sent the club money)
       · an approved `charge_to_org`   → a REFUND, netting into the item it repaid — NEVER income.
     The club covering a $325 entry fee means the team spent $325 less, not that it earned $325.
     Booking it as revenue would make the season look $650 better than it is, which is the exact
     arithmetic `rep_team_money_in`'s own table comment spells out for the same shape.

     ⚠ UNFILED CLUB MONEY STILL COUNTS. A row with no item lands in the report's existing
     "Not itemized" bucket rather than being dropped — the money moved, and hiding it would trade
     one silence for another. The Club tab says on the row that filing it is what puts it in a
     category. */
  const clubSpend: RollupSpend[] = [];
  const clubRefunds: RollupRefund[] = [];
  for (const split of clubSplits) {
    const placed = {
      categoryId: split.budgetCategoryId, categoryName: split.budgetCategoryName,
      itemId: split.budgetItemId, itemName: split.budgetItemName,
    };
    for (const inst of split.installments) {
      // Only what has actually been PAID — this report is settled money, like every other feed on it.
      if (!inst.paidAt) continue;
      clubSpend.push({
        id: `club-allocation-${inst.id}`,
        description: split.allocationDescription || 'Club allocation',
        ...placed,
        amount: inst.amount,
        // The day the team paid it, so it lands in the right month on the grid.
        paidDate: orgDayKey(inst.paidAt),
        direction: 'out' as const,
      });
    }
  }
  for (const r of clubApprovedRequests) {
    const placed = { categoryId: r.categoryId, categoryName: r.categoryName, itemId: r.itemId, itemName: r.itemName };
    // Approval posts the transfer, so a request is settled on the day it was DECIDED.
    const settledOn = orgDayKey(r.reviewedAt ?? r.createdAt);
    /* ⚠ THE COST-vs-REIMBURSEMENT RULE IS IMPORTED, NOT RE-DERIVED HERE (`/simplify`, 2026-08-17).
       `clubRequestIsReimbursement` carries the whole justification for it and was, embarrassingly,
       dead code: the one route that needed it had re-written the same branch by hand. An
       abstraction whose own caller does not call it is worse than no abstraction. */
    if (clubRequestIsReimbursement(r.requestType)) {
      // The club paying the team back — NETS into the cost it repaid, never revenue.
      clubRefunds.push({
        id: `club-request-${r.id}`, description: r.description, ...placed,
        amount: r.amount, receivedDate: settledOn,
      });
    } else {
      // The team paying the club — an ordinary cost.
      clubSpend.push({
        id: `club-request-${r.id}`, description: r.description, ...placed,
        amount: r.amount, paidDate: settledOn, direction: 'out' as const,
      });
    }
  }

  const report = rollupMoneyReport({
    lines: rollupLines,
    spend: [...rollupSpend, ...incomeSpend, ...derivedSpend, ...clubSpend],
    refunds: [...refunds, ...clubRefunds],
  });
  /* ⚠ THE MONTH GRID AND EVERY COST FIGURE BELOW READ THE EXPENSES HALF, and only that half. The
     grid is a money-OUT shape — a prior-season column, an un-itemized buffer row, a payment
     schedule — and putting revenue rows in it would be a second report wearing the first's
     clothes. Reading it off `report` rather than a second rollup call is what keeps Months and the
     statement grouping one plan one way. */
  const categoryResults = report.expenses.categories;

  // Kept flat for the export and for anything still asking "what wasn't planned?" as a list. It is
  // no longer a separate SECTION on screen — unplanned spending now sits in its own row inside its
  // own category, where a coach reads it beside everything else rather than below it.
  /* ⚠ NET OF MONEY BACK. The list below is the individual costs; the FIGURE the screen names
     ("of which never budgeted") has to reconcile with `totalActual`, which is net of refunds. Left
     gross, an unplanned $500 truck hire with $200 back reported $500 of unplanned spending against
     a row contributing $300 — the same money described two ways on one screen (/review). */
  const unbudgetedRefunds = categoryResults.reduce((s, cat) =>
    s + cat.items.filter(i => !i.inPlan).reduce((t, i) => t + i.refundTotal, 0), 0);
  const unbudgetedActuals = categoryResults.flatMap(cat =>
    cat.items.filter(i => !i.inPlan).flatMap(i => i.costs.map(c => ({
      id:          c.id,
      description: c.description,
      category:    cat.categoryName,
      item:        i.itemName,
      amount:      c.amount,
      paidAt:      c.paidDate,
    }))));

  // ── 6. Dues collection summary ────────────────────────────────────────
  const { data: schedules } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, player_id, total_amount')
    .eq('program_year_id', programYear.id);

  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);
  const expectedDues = (schedules ?? []).reduce(
    (s: number, r: { total_amount: number }) => s + (r.total_amount ?? 0), 0,
  );

  // Collected = recorded payment FACTS (mig 232), capped per player at their schedule total —
  // the same figure the dues table's Paid column shows, so this card and that screen can never
  // disagree. Installments stay fetched for the SCHEDULED half of the cash-flow strip ("what
  // lands in July if everyone pays on time").
  let collectedDues = 0;
  let duesInstallments: Array<{ amount: number; due_date: string | null; paid_at: string | null }> = [];
  let duesPayments: Array<{ playerId: string; amount: number; receivedDate: string | null }> = [];
  if (scheduleIds.length > 0) {
    const [{ data: inst }, pays] = await Promise.all([
      supabaseAdmin
        .from('rep_player_dues_installments')
        .select('amount, due_date, paid_at')
        .in('schedule_id', scheduleIds),
      getRepDuesPaymentsByProgramYear(programYear.id),
    ]);
    duesInstallments = (inst ?? []) as typeof duesInstallments;
    duesPayments = pays;
    const paymentsByPlayer = paymentsTotalByPlayer(pays);
    for (const s of (schedules ?? []) as Array<{ player_id: string; total_amount: number }>) {
      collectedDues += duesPaidAmount(paymentsByPlayer.get(s.player_id) ?? 0, s.total_amount ?? 0);
    }
  }

  const duesCollection = {
    expected:    Math.round(expectedDues    * 100) / 100,
    collected:   Math.round(collectedDues   * 100) / 100,
    outstanding: Math.round((expectedDues - collectedDues) * 100) / 100,
  };

  // ── 7. Monthly chart data ─────────────────────────────────────────────
  // Collect all relevant months from period_dates and paid expense dates
  const monthSet = new Set<string>();

  for (const line of lines) {
    for (const p of (line.rep_budget_periods ?? []) as Array<Record<string, unknown>>) {
      const m = monthKeyOf(p.period_date as string | null);
      if (m) monthSet.add(m);
    }
  }
  for (const exp of expenses) {
    const d = paidDate(exp);
    if (d) monthSet.add(d.slice(0, 7));
  }
  /* ⚠⚠ AND CLUB MONEY — THE THIRD FEED POINT, MISSED ON THE FIRST PASS (`/review`, money lens,
     2026-08-17). This report renders club costs in THREE independent places: the statement (via the
     rollup), the Months grid (`gridActuals`), and this cumulative chart. The first two were wired
     up; this one was not, so on a club-run team the chart a coach reads sat DIRECTLY ABOVE a
     statement whose totals it contradicted — and the club's bill is frequently the season's single
     largest line, which is the exact scenario the whole change exists for.

     ⚠ COSTS ONLY, and that is consistent rather than lazy: this chart has never netted refunds
     (`actualByMonth` sums `paidAmount(exp)` from raw expenses and `rep_team_money_in` reaches it
     nowhere), so feeding club REIMBURSEMENTS in would make club money the one kind that nets here.
     The statement and the grid both net them; the chart nets none. That inconsistency is older than
     this release and is logged as debt rather than half-fixed under cover of this one. */
  for (const c of clubSpend) {
    if (c.paidDate) monthSet.add(c.paidDate.slice(0, 7));
  }

  // If no months, default to current month
  if (monthSet.size === 0) monthSet.add(new Date().toISOString().slice(0, 7));

  const months = [...monthSet].sort();

  // Budget per month: sum of period amounts whose period_date falls in that month
  const budgetByMonth = new Map<string, number>();
  for (const line of lines) {
    for (const p of (line.rep_budget_periods ?? []) as Array<Record<string, unknown>>) {
      const m = monthKeyOf(p.period_date as string | null);
      if (m) budgetByMonth.set(m, (budgetByMonth.get(m) ?? 0) + (p.amount as number));
    }
  }

  // Budget with NO date stays OFF the monthly series (chunk H, owner decision D-H4). It used to be
  // spread evenly across every month, which is invisible in a cumulative chart but a plain untruth
  // in the month grid on the same page — a coach would read budget in months they never chose. The
  // amount is reported instead, so the chart can say out loud what it is not showing.
  const totalBudget = lines.reduce((s, l) => s + (l.total_amount as number), 0);
  const periodedBudget = [...budgetByMonth.values()].reduce((s, v) => s + v, 0);
  const undatedBudget = Math.max(0, Math.round((totalBudget - periodedBudget) * 100) / 100);

  // Actual per month: sum of paid expenses by paid date month
  const actualByMonth = new Map<string, number>();
  for (const exp of expenses) {
    const d = paidDate(exp);
    if (!d) continue;
    const m = d.slice(0, 7);
    actualByMonth.set(m, (actualByMonth.get(m) ?? 0) + paidAmount(exp));
  }
  // The other half of the fix above — the months were being collected and then spent nothing into.
  for (const c of clubSpend) {
    if (!c.paidDate) continue;
    const m = c.paidDate.slice(0, 7);
    actualByMonth.set(m, (actualByMonth.get(m) ?? 0) + c.amount);
  }

  let cumBudget = 0;
  let cumActual = 0;
  const monthlyChart = months.map(month => {
    const b = Math.round((budgetByMonth.get(month) ?? 0) * 100) / 100;
    const a = Math.round((actualByMonth.get(month)  ?? 0) * 100) / 100;
    cumBudget = Math.round((cumBudget + b) * 100) / 100;
    cumActual = Math.round((cumActual + a) * 100) / 100;
    return { month, budgetedForMonth: b, actualForMonth: a, cumBudget, cumActual };
  });

  // ── 8. The month grid (chunk H) ────────────────────────────────────────
  // Rows = category → ITEM, columns = the season's months, one payload serving all four lenses
  // (Budget · Scheduled · Actual · Difference) so flipping a lens never refetches. The arithmetic
  // lives in lib/coach-budget-months.ts and is unit-tested; this block is the assembly half.
  const todayMonth = tournamentToday().slice(0, 7); // ORG timezone — never the runtime's UTC month

  /* ⚠⚠ THE GRID'S ROWS COME FROM THE ROLLUP, NOT FROM THE RAW LINES — because Months and Categories
     are two views of ONE report and must not group it two different ways. Built from `lines` (as it
     was until 2026-08-15) a team with two budget lines on one item read as ONE row under Categories
     and TWO under Months, on the same screen, for the same plan. Taking the rows from
     `categoryResults` means the SUM ruling, the merged payment periods and the "not budgeted" rows
     all arrive already applied, by the one module that owns them.
     ⚠ Unplanned items are included with a zero budget on purpose: their category exists on this
     screen, and their spending needs a row to land in. */
  const gridLines: GridLine[] = categoryResults.flatMap(cat => cat.items.map(item => ({
    id:           `${cat.categoryName}|${item.itemId ?? 'no-item'}`,
    description:  item.itemName,
    categoryName: cat.categoryName,
    itemId:       item.itemId,
    itemName:     item.itemName,
    totalAmount:  item.budgeted,
    // Carried so the grid can still tell a planned category from one that only has spending —
    // every item now arrives with a row, so the row's presence no longer answers that.
    inPlan:       item.inPlan,
    periods:      item.periods.map(p => ({ date: p.date, amount: p.amount })),
  })));

  // Actuals: what was paid, on the day it was paid. A payable's deposit and balance are separate
  // events — they land in different months and the grid must show them that way.
  const gridActuals: CategoryEvent[] = [];
  // Commitments: what the team has agreed to pay, on the day it falls due, paid or not.
  const gridScheduled: CategoryEvent[] = [];
  // Per-cell drill-in detail, keyed `${categoryKey}|${YYYY-MM}` — the read panels behind an
  // Actual or Scheduled cell. Already-loaded rows, so no extra query.
  const cellDetails: Record<string, Array<{ id: string; description: string; date: string | null; amount: number; paid: boolean }>> = {};
  function pushDetail(kind: 'actual' | 'scheduled', category: string | null, date: string | null, item: { id: string; description: string; amount: number; paid: boolean }) {
    const m = monthKeyOf(date);
    if (!m) return;
    const key = `${kind}|${(category ?? '').trim().toLowerCase()}|${m}`;
    (cellDetails[key] ??= []).push({ ...item, date });
  }

  for (const exp of expenses) {
    const cat = placedFor(exp).categoryName;
    const id = exp.id as string;
    const description = exp.description as string;

    if (exp.expense_type === 'tournament_payable') {
      const dep = (exp.deposit_amount as number | null) ?? 0;
      const bal = (exp.balance_amount as number | null) ?? 0;
      if (dep > 0 && exp.deposit_due_date) {
        gridScheduled.push({ categoryName: cat, date: exp.deposit_due_date as string, amount: dep });
        pushDetail('scheduled', cat, exp.deposit_due_date as string, { id: `${id}-deposit`, description: `${description} — deposit`, amount: dep, paid: !!exp.deposit_paid_at });
      }
      if (bal > 0 && exp.balance_due_date) {
        gridScheduled.push({ categoryName: cat, date: exp.balance_due_date as string, amount: bal });
        pushDetail('scheduled', cat, exp.balance_due_date as string, { id: `${id}-balance`, description: `${description} — balance`, amount: bal, paid: !!exp.balance_paid_at });
      }
      if (exp.deposit_paid_at && dep > 0) {
        gridActuals.push({ categoryName: cat, date: exp.deposit_paid_at as string, amount: dep });
        pushDetail('actual', cat, exp.deposit_paid_at as string, { id: `${id}-deposit`, description: `${description} — deposit`, amount: dep, paid: true });
      }
      if (exp.balance_paid_at && bal > 0) {
        gridActuals.push({ categoryName: cat, date: exp.balance_paid_at as string, amount: bal });
        pushDetail('actual', cat, exp.balance_paid_at as string, { id: `${id}-balance`, description: `${description} — balance`, amount: bal, paid: true });
      }
    } else if (exp.expense_paid_at) {
      const amt = exp.amount as number;
      gridActuals.push({ categoryName: cat, date: exp.expense_paid_at as string, amount: amt });
      pushDetail('actual', cat, exp.expense_paid_at as string, { id, description, amount: amt, paid: true });
    }
  }

  /* ⚠⚠ AND SO DOES CLUB MONEY, FOR EXACTLY THE SAME REASON (money redesign P4, 2026-08-17).
     This loop was nearly missed: `gridActuals` is built from the RAW `expenses` array, so adding
     club costs to the rollup alone would have put them on the Statement and the Categories view and
     left them off Months — one screen reporting two different totals for one season, which is the
     defect the note below records having already happened once with refunds.

     ⚠ The money-back half needs nothing here: an approved *from the club* request is a REFUND, so
     it arrives through `report.expenses.categories` in the loop underneath, netted against the item
     it repaid, exactly like a vendor refund. Only the COST half has to be added by hand, because
     only the cost half bypasses this array.

     ⚠ `gridScheduled` is deliberately NOT fed. An unpaid club instalment has a due date and would
     fit — but the grid's Scheduled row is built from `rep_team_expenses` commitments, and the
     Payment schedule already shows club instalments beside them. Adding them to one and not the
     other is how two surfaces start disagreeing; adding them to both is a P5 question, not a P4
     one. Said out loud so the omission reads as a decision rather than an oversight. */
  for (const c of clubSpend) {
    if (!c.paidDate) continue;
    gridActuals.push({ categoryName: c.categoryName, date: c.paidDate, amount: c.amount });
    pushDetail('actual', c.categoryName, c.paidDate, {
      id: c.id, description: c.description, amount: c.amount, paid: true,
    });
  }

  /* ⚠ MONEY BACK REACHES THE MONTH GRID TOO, as a NEGATIVE actual on the month it arrived — or
     Months and the statement would report different figures for the same item on the same screen,
     which is the exact defect that made the grid read its rows off the rollup in the first place.
     Taken from the EXPENSES half of the report rather than from the raw records, so the grid nets
     exactly the refunds the cost rows netted: a refund the rollup sent to the revenue side must
     not also come off spending here. */
  for (const cat of report.expenses.categories) {
    for (const item of cat.items) {
      for (const back of item.refunds) {
        gridActuals.push({ categoryName: cat.categoryName, date: back.receivedDate, amount: -back.amount });
        pushDetail('actual', cat.categoryName, back.receivedDate, {
          id: back.id,
          description: `${back.description || item.itemName} — money back`,
          amount: -back.amount,
          paid: true,
        });
      }
    }
  }

  // Prior season — the comparison column. Only the most recent earlier year, and only when it
  // actually has lines; rollover already carries lines + periods forward, so a year-2+ team has
  // this for free and a first-season team correctly gets nothing.
  const { data: priorYearRow } = await supabaseAdmin
    .from('rep_program_years')
    .select('id, year, name')
    .eq('team_id', teamId)
    .lt('year', programYear.year)
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();

  let priorLines: PriorLine[] = [];
  if (priorYearRow) {
    const { data: priorRows } = await supabaseAdmin
      .from('rep_budget_lines')
      .select('description, item_id, total_amount, budget_categories(name)')
      .eq('program_year_id', priorYearRow.id as string);
    priorLines = (priorRows ?? []).map((r: Record<string, unknown>) => ({
      description:  r.description as string,
      itemId:       (r.item_id as string | null) ?? null,
      itemName:     null,
      categoryName: ((r.budget_categories as Record<string, unknown> | null)?.name as string) ?? 'Uncategorized',
      totalAmount:  r.total_amount as number,
    }));
  }

  // The optional ESTIMATED total reconciled against the itemized sum. ⚠ Owner ruling 2026-08-12:
  // the estimate wins whenever it is set, in BOTH directions — it used to be max(itemized,
  // estimate), which kept a lower estimate in the database and then ignored it. One shared module
  // decides this for the planner, the Money hub and this report, because when all three did it
  // inline they were one edit away from disagreeing on the same screen. Computed HERE rather than
  // with headroom below, because the month grid needs the un-itemized part too.
  const budgetTotals = computeBudgetTotals({
    lines: allLines.map(l => ({
      totalAmount: (l.total_amount as number) ?? 0,
      lineKind: normalizeBudgetLineKind(l.line_kind as string | null),
    })),
    estimatedTotal: programYear.budgetAmount ?? null,
  });
  const seasonTotal = budgetTotals.estimatedTotal;
  const effectiveBudget = budgetTotals.totalPlanned;
  // The month grid's own "not itemized yet" row: only the POSITIVE case is money the grid can
  // stand in for. When the lines have outgrown the estimate there is nothing unallocated to show,
  // and a negative pseudo-row in a month grid would read as a refund.
  const buffer = Math.max(0, budgetTotals.difference);

  const monthGrid = buildMonthGrid({
    lines: gridLines,
    actuals: gridActuals,
    scheduled: gridScheduled,
    priorLines,
    todayMonth,
    bufferAmount: buffer,
  });

  /* ── 9. What players still have to fund ──────────────────────────────────────────────────────
     ⚠ THE "EXPECTED FUNDING" BLOCK IS GONE FROM HERE, and this is where it went: money in is now a
     SECTION of the report (`report.revenue`), grouped category → item exactly as spending is, so a
     single derived total beside the cost table would be the same money reported twice.
     What survives is the one figure the section cannot state — what dues still have to cover once
     everything coming in is taken off. Owner ruling 2026-08-12 stands unchanged behind the actual:
     it is the team's SHARE, everything raised less whatever was rebated to the player who raised
     it, because a rebate already lowers that player's own dues and counting it here would lower the
     same dues twice. ⚠ RECEIPTS ONLY — a pledge that counted as actual would flatter the season
     (mig 237; enforced in the shared reader). */
  const funding = report.revenue.categories.length === 0 ? null : {
    budget: budgetTotals.expectedFunding,
    actual: report.revenue.actual,
    fundedByPlayers: budgetTotals.fundedByPlayers,
  };

  // Money IN by month, both bases. The cash-flow strip pairs whichever of these matches the lens
  // the coach is reading with that lens's money-out — never a blend of plan and commitment.
  // Dues only, deliberately: fundraiser rebates CREDIT dues, so counting both would double-count
  // the same dollar. The strip says so on screen.
  const duesInScheduled: Record<string, number> = {};
  const duesInActual: Record<string, number> = {};
  for (const i of duesInstallments) {
    const amt = i.amount ?? 0;
    if (!amt) continue;
    const due = monthKeyOf(i.due_date);
    if (due) duesInScheduled[due] = Math.round(((duesInScheduled[due] ?? 0) + amt) * 100) / 100;
  }
  // ACTUAL is the receipt book, not the stamp: each payment lands in the month the money ARRIVED
  // (mig 232, owner ruling 3). Under the old model a coach catching up on a month of e-transfers
  // put them all in "today's" month, and a part-payment appeared in no month at all.
  for (const p of duesPayments) {
    const amt = p.amount ?? 0;
    if (!amt) continue;
    const m = monthKeyOf(p.receivedDate);
    if (m) duesInActual[m] = Math.round(((duesInActual[m] ?? 0) + amt) * 100) / 100;
  }

  // ── 10. Headroom ──────────────────────────────────────────────────────
  // Measured against the EFFECTIVE budget (see above, where it is reconciled) so this report,
  // the Money hub, and the budget planner always agree.
  /* ⚠ EVERY PAID DOLLAR IS NOW INSIDE A CATEGORY ROW, including the unplanned ones — the rollup
     gives spending on an unbudgeted item its own row rather than a separate list. So the season's
     actual is the categories' sum and nothing is added on top; `unbudgeted` is reported as its own
     figure for the screen to name, NOT as a second addend. Adding it again here would double-count
     precisely the spending this change set out to make visible. */
  const totalActual  = Math.round(categoryResults.reduce((s, c) => s + c.actual, 0) * 100) / 100;
  const unbudgeted   = Math.round(
    (unbudgetedActuals.reduce((s, u) => s + u.amount, 0) - unbudgetedRefunds) * 100) / 100;
  const headroom     = Math.round((effectiveBudget - totalActual) * 100) / 100;

  /* The season net, once, against the figures the report actually SHOWS — see the note beside it
     in the payload. With no estimate set the effective budget IS the itemized sum, and this is
     exactly the rollup's own net. */
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const netBudget = r2(report.revenue.budgeted - effectiveBudget);
  const netActual = r2(report.revenue.actual - totalActual);
  const seasonNet = { budgeted: netBudget, actual: netActual, variance: r2(netActual - netBudget) };
  const expenseCategories = categoryResults.map(slimCategory);

  return NextResponse.json({
    headroom,
    totalBudget:     Math.round(totalBudget * 100) / 100,
    seasonTotal,
    effectiveBudget,
    buffer,
    /** Signed, so a report can say "over your estimate" rather than showing nothing. */
    estimateDifference: budgetTotals.difference,
    overPlanned:        budgetTotals.overPlanned,
    /** Null when the team budgets no funding — the row simply isn't there. */
    funding,
    // Already whole (see §10): the categories now hold every paid dollar, planned or not.
    totalActual,
    /* ⚠ SENT WITHOUT THE RAW LINES AND COSTS BEHIND EACH ROW. The rollup carries them because the
       PLAN page uses them (it calls the same function locally to render editable lines), but this
       report renders neither — shipping them would put two full arrays of raw records on every item
       row of a season's report for nothing. The unbudgeted list below is already extracted from
       them server-side.
       ⚠ REFUNDS ARE THE EXCEPTION AND STAY. They are what lets a row say "$2,400 paid · $150 back"
       instead of only "$2,250", and there are ordinarily nought or one of them per row. */
    /* Both report shapes, off ONE grouping pass (plan §3.5). The statement is the default and the
       shape a treasurer, a board and a parent already know; by-activity answers the question a
       statement structurally cannot, because a category appears in both its sections. They end on
       the same season net because they are the same rows read two ways.
       ⚠ THE EXPENSES CATEGORIES ARE NOT ALSO SENT AT THE TOP LEVEL. They were, briefly — the same
       tree twice in one payload, doubling the heaviest part of a season's report on every load,
       because the export builder still read the old field. It reads this one now. */
    report: {
      revenue:  { ...report.revenue,  categories: report.revenue.categories.map(slimCategory) },
      expenses: { ...report.expenses, categories: expenseCategories },
      activities: report.activities.map(block => ({
        ...block,
        revenue: block.revenue ? slimCategory(block.revenue) : null,
        costs:   block.costs   ? slimCategory(block.costs)   : null,
      })),
      /* ⚠ THE SEASON NET IS COMPUTED HERE, not left to each screen. The pure rollup's own net is
         revenue less the ITEMIZED cost sum; the report's Total expenses row has always shown the
         EFFECTIVE budget (the estimate whenever one is set — owner ruling 2026-08-12, shared with
         the plan page, the Money hub and headroom). Shipping the rollup's figure as `net` put a
         number in the payload that looked authoritative and was wrong for any team with an
         estimate, so the screen quietly recomputed its own — two answers, one of them a trap for
         the next caller. One answer now, and both shapes and the export read it. */
      net: seasonNet,
    },
    /** How much of `totalActual` went on items nobody planned — a figure to NAME, never to add. */
    unbudgeted,
    unbudgetedActuals,
    duesCollection,
    monthlyChart,
    // Named so the chart can state what it is NOT plotting, rather than smearing it (D-H4).
    undatedBudget,
    // ── chunk H ──
    monthGrid,
    cellDetails,
    moneyIn: { scheduled: duesInScheduled, actual: duesInActual },
    todayMonth,
    // Short enough to be a column header on a phone; the full season name is not.
    priorSeasonLabel: priorLines.length > 0 && priorYearRow ? String(priorYearRow.year) : null,
    // Only tags actually used by this year's expenses head the filter row (not the whole library).
    expenseTags: expenseTags.filter(t => new Set(Object.values(tagsByExpenseId).flat()).has(t.id)),
    activeTagId: filterTagId,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual' });
