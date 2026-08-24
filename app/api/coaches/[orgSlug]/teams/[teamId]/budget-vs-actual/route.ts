import { NextResponse } from 'next/server';
import {
  getRepDuesPaymentsByProgramYear, getRepDuesPayoutsByProgramYear,
  getRealisedFundraiserEntries, getRepTeamMoneyIn, getDerivedIncomeClaims,
  getRepAllocationSplitsForTeam, getCommitmentStandings,
} from '@/lib/db';
import { installmentLabel } from '@/lib/payable-standing';
import { clubRequestIsReimbursement, type ClubRequestType } from '@/lib/coach-club-money';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { tournamentToday, orgDayKey } from '@/lib/timezone';
import {
  buildMonthGrid, monthKeyOf,
  type CategoryEvent, type GridLine,
} from '@/lib/coach-budget-months';
import { computeBudgetTotals, normalizeBudgetLineKind, isFundingKind } from '@/lib/coach-budget-totals';
import {
  rollupMoneyReport, categoryKey, displayCategoryName,
  type RollupLine, type RollupSpend, type RollupRefund, type ItemRow,
} from '@/lib/coach-budget-rollup';
import { paidMovements, type PaidExpenseRow } from '@/lib/coach-expense-movements';
import { buildActualCashStrip } from '@/lib/coach-cash-strip';
import { placeDerivedActual } from '@/lib/coach-money-derived';
import { duesPaidAmount, paymentsTotalByPlayer } from '@/lib/dues-payments';
import { resolveCoachHistoryReadFromRequest } from '@/lib/coach-team-read';

/** A category row without the raw records behind each item — see the note at the payload. */
function slimCategory<T extends { items: ItemRow[] }>(cat: T) {
  return {
    ...cat,
    items: cat.items.map(({ lines: _lines, costs: _costs, costCount: _costCount, ...item }) => item),
  };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual
//
// Returns a full budget-vs-actual report for the team's WORKING program year — or, since
// 2026-08-17 (P4, `COACH_MONEY_PAST_SEASON_BOOK_PLAN.md`), for a season the caller names.
//
/**
 * ⚠⚠ **A HISTORY ENDPOINT — the fourth, and the LAST money surface that will ever be one**
 * (owner-approved 2026-08-17 from the P4 design session).
 *
 * ⚠ **REUSED, NOT REBUILT, and that is the load-bearing decision.** The closed money book could
 * have been a new "season statement" route. It is not, because that would be a SECOND walk of the
 * same records — which is exactly the defect `14af00f0` fixed two days earlier, when the statement,
 * the Months grid and the cumulative chart turned out to be three independent walks and two of them
 * disagreed about what a season had spent. There is ONE arithmetic (`lib/coach-budget-rollup.ts`)
 * and it stays one. A season's figures must not depend on which screen asked.
 *
 * ── The three questions `HISTORY_ENDPOINTS` demands, answered here as well as at the list ──
 *   1. **Record or instrument? RECORD.** This route computes over money records a closed season can
 *      no longer change; it moves no money, bills nobody and configures nothing. It is GET-only and
 *      performs no write of any kind. ⚠ It is the ONLY one of Money's seven tabs that passes this
 *      question — Payables marks things paid, Club creates and withdraws requests, Dues records
 *      payments, Fundraisers logs amounts, Budget and Transactions are editors. Those six stay on
 *      the working season, and pointing them at a closed year is the archive-as-a-place the owner
 *      deleted.
 *   2. **Does the whole subtree carry the year? ONLY BECAUSE THE READER FLATTENS IT.** The LIVE
 *      panel is not a leaf — its rows expand, its Months cells link into the budget editor, and its
 *      "no date yet" figure opens a chooser (two of those links were dead for two days and nobody
 *      noticed). The past-season reader on Season's End renders the statement FLAT: figures, no
 *      drill-ins, so there is no second level for a Chunk-F-class defect to hide on. ⚠ That is a
 *      constraint on the CALLER, which is why it is written here too — this route cannot enforce it.
 *   3. **Could the coach tell which season they are reading? YES, STRUCTURALLY.** The only caller
 *      that passes a year is Season's End, a page about one named season that titles itself so.
 *
 * ⚠ **Figures are CORRECTED, not preserved** (owner ruling 2026-08-17). This report is DERIVED, and
 * its arithmetic changed on 2026-08-17 — so a past season now adds up differently, and more
 * accurately, than the coach saw at the time. That is the objection that made playing-time analytics
 * live-season-only PERMANENTLY, and the distinction is what the derivation is over: playing time
 * re-interprets lineups, this adds up money records that a closed season cannot change. A corrected
 * total is the same story added up properly. ⚠ This does NOT reopen playing time.
 */
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
  // The year goes THROUGH the resolver, never around it — that is what makes the access check run
  // against the requested SEASON rather than the team. Absent `?year=`, this is the team's working
  // season, which is every existing caller: the live Budget vs Actual panel and its exports.
  const resolved = await resolveCoachHistoryReadFromRequest(req, orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ── 1–2. The plan, the costs, and where every commitment stands ─────────────────────────────
     ⚠ ONE WAVE. All three depend only on `programYear.id` and on nothing from each other, and this
     route's own comments elsewhere call out being "a long serial chain of awaits" as a known cost
     on the portal's heaviest read. Left sequential, the standings read alone was a third full round
     trip — the register and the Money hub both fold their copy of it into an existing wave, and this
     one was the odd surface out (`/simplify`, 2026-08-19). */
  const [{ data: linesRaw }, { data: expensesRaw }, standings] = await Promise.all([
    supabaseAdmin
      .from('rep_budget_lines')
      .select('*, rep_budget_periods(*), budget_categories(name), budget_items(name)')
      .eq('program_year_id', programYear.id)
      .order('sort_order'),
    supabaseAdmin
      .from('rep_team_expenses')
      /* ⚠⚠ NO DEPOSIT/BALANCE/PAID COLUMNS ANY MORE (Payables Rebuild P1, mig 255). What a
         commitment owes, what it has paid and when are all in `standings`; this query is down to
         what a cost IS and where it files. Naming a paid stamp here again would be caught by
         `tests/unit/money-one-arithmetic-guard.test.ts`, which is the point. */
      /* ⚠ `paid_by_player_id` rides for the CASH STRIP only. The report counts a family-paid cost
         as spending (the season spent it); cash must not (no team money moved — the register marks
         it `movesCash: false`). The rollup below never reads it. */
      .select('id, description, category, budget_item_id, budget_category_id, amount, expense_type, created_at, paid_by_player_id, budget_items(name, category_id, budget_categories(name))')
      .eq('program_year_id', programYear.id)
      .order('created_at'),
    /* The plan, the payments, and what that adds up to — feeding both the actuals (what moved, and
       when) and the Scheduled column (what is owed, and on what day). `lib/payable-standing.ts`
       owns that arithmetic for every money screen. */
    getCommitmentStandings(programYear.id),
  ]);

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

     Both legs depend only on `teamId` / `programYear.id`, both known here, so they ride one
     `Promise.all`. */
  const [clubSplits, clubReqRes] = await Promise.all([
    getRepAllocationSplitsForTeam(teamId, programYear.id),
    supabaseAdmin
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

  /* ⚠⚠ THE MONEY-TAG FILTER WAS REMOVED FROM THIS REPORT (owner ruling 2026-08-21) — the two tag
     reads and the filtered `expenses` list went with it. It worked, and that was not the
     problem: it narrowed the ACTUAL and SCHEDULED sides while the BUDGET stayed whole (a plan
     line carries no tag), so a filtered reading compared a slice of spending against the whole
     plan and Headroom ROSE as you narrowed. Tag filtering belongs on Transactions, which lists
     rather than compares. Reinstating it here needs tagged plan lines first. */
  const expenses = allExpenses;

  /* ⚠ "WHAT DID THIS EXPENSE ACTUALLY PAY, AND WHEN" IS NOT A ROUTE CONCERN — it lives in
     lib/coach-expense-movements.ts, and that module's header carries the whole rule plus the two
     sibling functions it must not be merged with. It was a local helper here until `/review` pointed
     out that a local helper is an UNTESTABLE one, and that the very consolidation this release shipped
     had made this route's own build-blocking check blind to a mistake inside it. */

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

  /* Only what actually moved, and one record per movement — see `lib/coach-expense-movements.ts`.
     A commitment paid in pieces contributes each piece on its own day, so every dated reading
     downstream (the cumulative chart, the Months grid, the statement's expand-a-row schedule) has
     the real dates to read. ⚠ A PART-PAID commitment contributes only what was actually paid: the
     movements are its PAYMENTS, so a $600 bill with $200 handed over counts $200 here and shows
     $400 still owing in the Scheduled column below. */
  const rollupSpend: RollupSpend[] = expenses.flatMap(exp => {
    const placed = placedFor(exp);
    const row: PaidExpenseRow = { id: exp.id as string, description: exp.description as string };
    return paidMovements(row, standings[exp.id as string]).map(mv => ({ ...mv, ...placed }));
  });

  /* ── Money IN, in the same two levels (mig 243) ──────────────────────────────────────────────
     Three feeds, one grouping pass:
       · money-in BUDGET lines, as revenue rows;
       · TYPED arrivals, as their actuals;
       · the DERIVED pools — what fundraisers and sponsors already report — placed as deep in the
         taxonomy as the claiming lines actually agree.
     ⚠ AND MONEY BACK, which is none of the three: it nets into the row it repaid, on either side,
     and never appears as income (COACH_MONEY_BACK_ON_A_COST_PLAN §4.3). */
  /* ⚠ ALL FIVE IN ONE TRIP. This route already runs a long serial chain of awaits, and none of
     these reads needs anything the others produce.
     ⚠⚠ THE REALISED-ENTRIES READ IS NO LONGER GATED ON `fundingLines` (2026-08-23, the whole-cash
     strip). The REPORT still only derives income rows when funding lines exist (its own gate,
     below, unchanged) — but cash arrives whether or not it was budgeted, and the strip missing
     every drive dollar on a team that never budgeted fundraising is exactly the silent subset the
     owner's ruling reversed. Dues PAYMENTS and PAYOUTS ride here for the same reason: both are
     cash facts of the season, needed by the strip regardless of whether a dues schedule exists
     (the register reads both unconditionally, and the guard holds this route to the register). */
  const [moneyInRecords, derivedClaims, realisedEntries, duesPayments, duesPayouts] = await Promise.all([
    getRepTeamMoneyIn(programYear.id),
    getDerivedIncomeClaims(programYear.id),
    getRealisedFundraiserEntries(programYear.id),
    getRepDuesPaymentsByProgramYear(programYear.id),
    getRepDuesPayoutsByProgramYear(programYear.id),
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
     grid is a money-OUT shape — an un-itemized buffer row, a payment schedule, dated commitments
     — and putting revenue rows in it would be a second report wearing the first's
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
  // Payments arrive with the money-in wave above (the strip needs them schedule or no schedule);
  // only the INSTALLMENTS still hinge on schedules existing, because they hang off them.
  let collectedDues = 0;
  let duesInstallments: Array<{ amount: number; due_date: string | null; paid_at: string | null }> = [];
  if (scheduleIds.length > 0) {
    const { data: inst } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('amount, due_date, paid_at')
      .in('schedule_id', scheduleIds);
    duesInstallments = (inst ?? []) as typeof duesInstallments;
    const paymentsByPlayer = paymentsTotalByPlayer(duesPayments);
    for (const s of (schedules ?? []) as Array<{ player_id: string; total_amount: number }>) {
      collectedDues += duesPaidAmount(paymentsByPlayer.get(s.player_id) ?? 0, s.total_amount ?? 0);
    }
  }

  const duesCollection = {
    expected:    Math.round(expectedDues    * 100) / 100,
    collected:   Math.round(collectedDues   * 100) / 100,
    outstanding: Math.round((expectedDues - collectedDues) * 100) / 100,
  };

  /* ══ 7. EVERY ACTUAL MOVEMENT ON THIS REPORT, FLATTENED ONCE ═══════════════════════════════════
     ⚠⚠ THE ACTUALS ARE READ OFF THE STATEMENT, NOT OFF THE RAW ROWS
     (COACH_MONEY_ONE_ARITHMETIC_PLAN.md, 2026-08-17). The cumulative chart used to walk
     `rep_team_expenses` for itself, and the Months grid did too, and club money was added to each by
     hand — three independent answers to "what did we actually spend?" on one screen. Two of the three
     already disagreed:

       · the chart never netted MONEY BACK, so a $500 hire with $200 refunded read $500 there and $300
         in the statement rendered six inches below it;
       · a commitment paid in two instalments arrived as one payment dated by the earlier half, so a
         July balance was charted in May;
       · club money reached the statement and the grid and was silently absent from the chart — found
         by `/review` the day this route learned to read club money at all, which is what made a patch
         the wrong answer and this the right one.

     ⚠ AND IT IS FLATTENED **ONCE**, not once per consumer (`/simplify`, 2026-08-17 — three of the
     four lenses landed here). The first pass gave the chart its own walk of this tree and the grid
     another 140 lines later, each restating "expenses side only, refunds netted as the statement
     netted them" in its own comment. Two feeds reading one source is the fix; two feeds reading it
     through two hand-kept traversals is the same disease one level down, and a third consumer (an
     export, say) would have been a third copy. **This list is the answer. Consumers sum it.**

     ⚠ THE EXPENSES SIDE ONLY, and refunds exactly as the statement netted them. A refund the rollup
     sent to the REVENUE side (`sideForRefund` — an item that is revenue and nothing else) must not
     also come off spending; taking both from `report.expenses` makes that impossible rather than
     careful. Money back is dated the day it ARRIVED — back-dating it into the month the cost was paid
     would rewrite a month already reported on and reconciled. */
  /**
   * How a category is NAMED and IDENTIFIED on the grid — the statement's own spelling, so the two
   * views of one report land on one row.
   *
   * ⚠ IT IS NO LONGER LOAD-BEARING FOR IDENTITY, and that is the point of the `/simplify` altitude
   * pass. `categoryKey` used to treat `null` and `NO_CATEGORY_LABEL` as two different categories, so
   * this helper WAS the fix for the split-bucket defect — meaning the fix was a convention every
   * future caller had to remember. `categoryKey` normalises the nameless case itself now, so
   * forgetting this can no longer split a bucket. What survives is the display name.
   */
  const gridCategory = (categoryId: string | null, categoryName: string | null) => ({
    categoryId,
    categoryName: displayCategoryName(categoryName),
  });

  /* ⚠⚠ THE ITEM RIDES ALONG (2026-08-21, owner-found). This walks the categories AND their items
     and used to key every movement by the category alone — dropping the item it was already holding.
     The grid files money by category+item, so without it every item row showed a dash in its money
     columns while its category carried the total, and the Statement view of the SAME report
     itemised the same money correctly. */
  const actualMovements = report.expenses.categories.flatMap(cat => {
    const category = gridCategory(cat.categoryId, cat.categoryName);
    return cat.items.flatMap(item => [
      ...item.costs.map(c => ({
        category, itemId: item.itemId, date: c.paidDate, amount: c.amount,
        id: c.id, description: c.description,
      })),
      ...item.refunds.map(b => ({
        category, itemId: item.itemId, date: b.receivedDate, amount: -b.amount,
        id: b.id, description: `${b.description || item.itemName} — money back`,
      })),
    ]);
  });

  // ── 7b. Monthly chart data ────────────────────────────────────────────────
  const monthSet = new Set<string>();

  for (const line of lines) {
    for (const p of (line.rep_budget_periods ?? []) as Array<Record<string, unknown>>) {
      const m = monthKeyOf(p.period_date as string | null);
      if (m) monthSet.add(m);
    }
  }

  // Actual per month — the statement's own movements, gross less what came back.
  const actualByMonth = new Map<string, number>();
  for (const mv of actualMovements) {
    const m = monthKeyOf(mv.date);
    if (!m) continue;
    monthSet.add(m);
    actualByMonth.set(m, (actualByMonth.get(m) ?? 0) + mv.amount);
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
  /* The dates each individual budget line is currently split across, by line id.
     ⚠ PER LINE, WHICH IS NOT WHAT THE ROW CARRIES. `item.periods` is the schedule of every line on
     the item MERGED (two lines' Nov 30 is one period holding the sum — the SUM ruling made visible),
     so it cannot say which line owns a date. The chooser below has to, or it would offer a coach two
     rows it cannot tell apart. */
  const lineDates = new Map<string, string[]>(allLines.map(l => [
    l.id as string,
    ((l.rep_budget_periods ?? []) as Array<Record<string, unknown>>)
      .map(p => p.period_date as string | null)
      .filter((d): d is string => !!d)
      .sort(),
  ]));

  const gridLines: GridLine[] = categoryResults.flatMap(cat => cat.items.map(item => ({
    /* ⚠ KEYED BY THE CATEGORY's IDENTITY, NOT ITS NAME. Two categories may legitimately share a
       name (`budget_categories.name` has no unique index and an org's list is platform defaults ∪
       its own customs), and their two item-less rows collided on one id. */
    id:           `${categoryKey(cat.categoryId, cat.categoryName)}|${item.itemId ?? 'no-item'}`,
    description:  item.itemName,
    ...gridCategory(cat.categoryId, cat.categoryName),
    itemId:       item.itemId,
    totalAmount:  item.budgeted,
    // Carried so the grid can still tell a planned category from one that only has spending —
    // every item now arrives with a row, so the row's presence no longer answers that.
    inPlan:       item.inPlan,
    periods:      item.periods.map(p => ({ date: p.date, amount: p.amount })),
    /* ⚠ THE REAL BUDGET LINES BEHIND THE ROW — the whole point of `GridPlanLine`, whose header
       carries the ruling. Without these a month cell has only the composite row id, which no editor
       can resolve, which is how two affordances on this grid did nothing at all for two days. */
    planLines:    item.lines.map(l => ({
      id:          l.id,
      description: l.description,
      amount:      l.totalAmount,
      dates:       lineDates.get(l.id) ?? [],
    })),
  })));

  // Actuals: what was paid, on the day it was paid. A payable's deposit and balance are separate
  // events — they land in different months and the grid must show them that way.
  const gridActuals: CategoryEvent[] = [];
  // Commitments: what the team has agreed to pay, on the day it falls due, paid or not.
  const gridScheduled: CategoryEvent[] = [];
  // Per-cell drill-in detail, keyed `${categoryKey}|${YYYY-MM}` — the read panels behind an
  // Actual or Scheduled cell. Already-loaded rows, so no extra query.
  const cellDetails: Record<string, Array<{ id: string; description: string; date: string | null; amount: number; paid: boolean }>> = {};
  /* ⚠ THE SAME CATEGORY IDENTITY THE GRID ITSELF RETURNS, or a cell has detail behind it that its
     own panel cannot find. This used to key on `(category ?? '').trim().toLowerCase()` while
     `buildMonthGrid` returned its own key — for a NAMELESS category those were `''` and
     `'uncategorized'`, so the cell's drill-in resolved to an empty list and the cell rendered as
     un-clickable. Silent, and only ever wrong for the one bucket nobody seeds. */
  function pushDetail(
    kind: 'actual' | 'scheduled',
    category: { categoryId: string | null; categoryName: string },
    date: string | null,
    item: { id: string; description: string; amount: number; paid: boolean },
  ) {
    const m = monthKeyOf(date);
    if (!m) return;
    const key = `${kind}|${categoryKey(category.categoryId, category.categoryName)}|${m}`;
    (cellDetails[key] ??= []).push({ ...item, date });
  }

  /* ══ SCHEDULED KEEPS ITS OWN RAW FEED, AND THAT IS A DECISION ══════════════════════════════════
     Every ACTUAL figure on this report now comes from the rollup (below). Commitments cannot: the
     rollup only knows money that has MOVED, and the statement has no "committed" column to grow one
     from. Deriving Scheduled would mean teaching the rollup a third dimension it exists not to have,
     which is worse than one honest exception — so it is stated here rather than left as an omission
     for a reader to mistake for an oversight (COACH_MONEY_ONE_ARITHMETIC_PLAN.md §3, Phase B.5).

     ⚠ IT STILL SHARES THE CATEGORY IDENTITY. A commitment and the payment that settles it must land
     in the same row, so the events go through `gridCategory` exactly as the actuals do.

     ⚠ CLUB INSTALMENTS ARE DELIBERATELY ABSENT. An unpaid one has a due date and would fit — but
     this feed is `rep_team_expenses` commitments, and the Payment schedule already shows club
     instalments beside them. Adding them to one surface and not the other is how two surfaces start
     disagreeing; adding them to both is its own question, not this one's. */
  /* ⚠⚠ EVERY PIECE OF THE PLAN, NOT TWO OF THEM (Payables Rebuild P1). This loop used to read the
     deposit and balance columns, which meant a commitment could contribute at most two dated
     figures and — because it required BOTH an amount and a due date on each half — a commitment
     recorded with no due date contributed nothing at all. That is the old "No schedule" record: a
     real obligation, absent from this column, absent from the payment schedule, with nowhere to
     mark it paid. R1 means it cannot exist any more, so there is no row to skip. */
  for (const exp of expenses) {
    if (exp.expense_type !== 'tournament_payable') continue;
    const standing = standings[exp.id as string];
    if (!standing) continue;
    const placed = placedFor(exp);
    const cat = gridCategory(placed.categoryId, placed.categoryName);
    const description = exp.description as string;
    const count = standing.installments.length;
    for (const inst of standing.installments) {
      /* ⚠⚠ SCHEDULED IS WHAT IS STILL OWED, NOT THE PLAN AT FACE VALUE (owner ruling 2026-08-20,
         Payables Rebuild P3). *"Budget is the overall plan, actual is what was already paid,
         scheduled is what we are currently obligated to pay."*

         Until this ruling the cell carried `inst.amount` — every installment in its due month,
         paid or not — so a September holding a settled $200 piece and an unpaid $400 piece read
         $600, and a fully-paid month never fell to zero. The owner read that as the row quoting the
         whole commitment's total, and the product's own words agreed with him: the payment
         schedule, the Overview's next 30 days and the Payables list all meant "the remainder" by
         the same word, and an internal comment in the grid component described this very cell as
         "money still owed". One semantics now, on all four surfaces.

         ⚠ THE COST WAS STATED AND ACCEPTED: the Scheduled row now SHRINKS as a season pays down,
         so it can no longer be read as a month-by-month plan to compare Actual against. The owner's
         reasoning is that the comparison was never sound anyway — most of what lands in Budget and
         Actual is not a payable at all, so the plan figures were never comparable. Budget is the
         plan; this row is the obligation.

         ⚠ A PAST-DUE PIECE STAYS IN ITS DUE MONTH and still counts. "Currently obligated to pay"
         includes what should already have been paid — dropping it would hide the most urgent money
         on the report. */
      if (inst.state === 'settled') continue;
      // ⚠ `placed` already knows the item — carry it, or this money lands on the category and the
      // item row it belongs to shows a dash (owner-found 2026-08-21).
      gridScheduled.push({ ...cat, itemId: placed.itemId, date: inst.dueDate, amount: inst.remaining });
      pushDetail('scheduled', cat, inst.dueDate, {
        id: inst.id,
        description: installmentLabel(description, inst.installmentNumber, count),
        amount: inst.remaining,
        /* ⚠ R4 — SETTLED MEANS PAID IN FULL, and a part-paid piece is therefore still here, for
           its REMAINDER. Never `true` now: a settled piece no longer reaches this list at all. */
        paid: false,
      });
    }
  }

  /* ══ AND THE ACTUALS ARE THE SAME LIST THE CHART SUMMED ════════════════════════════════════════
     ⚠⚠ THE GRID USED TO WALK THE RAW ROWS ITSELF, in three loops: paid expense stamps, then club
     costs added by hand, then refunds off the rollup. Each new kind of money meant remembering to
     feed this one too — club money was "nearly missed" here by its own comment, and the cumulative
     chart above WAS missed, twice. There is nothing left to remember, and nothing left to keep in
     step either: `actualMovements` (step 7) is flattened once and the chart and this grid are two
     readings of it. A movement the statement counts is a movement this grid places, in the month the
     statement dated it, described the way the statement describes it. */
  for (const mv of actualMovements) {
    gridActuals.push({ ...mv.category, itemId: mv.itemId, date: mv.date, amount: mv.amount });
    pushDetail('actual', mv.category, mv.date, {
      id: mv.id, description: mv.description, amount: mv.amount, paid: true,
    });
  }

  /* ⚠ THE PRIOR-SEASON COMPARISON COLUMN WAS REMOVED HERE (owner ruling 2026-08-21). This report
     is read daily and evaluates THIS season only; last season's plan sat in the leading column
     labelled with a bare year, read as one more month bucket, and never followed the Showing
     lens — so under Scheduled it put last year's BUDGET beside this year's remaining debt.
     Cross-season comparison is wanted, but as its own view, not as daily furniture here.
     Do not reinstate it in this grid; the whole query it needed went with it. */
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

  /* ══ THE CASH STRIP — every dollar that MOVED, gross, from the primitive records ══════════════
     ⚠⚠ NEVER FROM THE GRID'S CELLS (owner ruling 2026-08-23, reversing 2026-07-30's dues-only
     strip — memory/design_decisions.md). The cells are the REPORT: netted (money back and club
     reimbursements shrink the costs they repaid) and including spending that never touched team
     cash (a family paying a vendor direct). Cash is gross both directions and team-cash only.
     The inclusion and dating rules live in lib/coach-cash-strip.ts, pinned by its unit tests;
     `check:money-report` proves the result equals the register month-by-month, to the cent. */
  const cashStrip = buildActualCashStrip({
    duesPayments,
    moneyInRecords,
    realisedEntries,
    clubRequests: clubApprovedRequests.map(r => ({
      amount: r.amount,
      isReimbursement: clubRequestIsReimbursement(r.requestType),
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    })),
    expensePayments: expenses.flatMap(exp =>
      (standings[exp.id as string]?.payments ?? []).map(p => ({
        amount: p.amount,
        paidDate: p.paidDate,
        familyPaidDirect: !!exp.paid_by_player_id,
      }))),
    duesPayouts,
    clubInstallments: clubSplits.flatMap(s =>
      s.installments.map(i => ({ amount: i.amount, paidAt: i.paidAt }))),
  });

  const monthGrid = buildMonthGrid({
    lines: gridLines,
    actuals: gridActuals,
    scheduled: gridScheduled,
    todayMonth,
    bufferAmount: buffer,
    // A month where only cash moved still gets a column (Exhibit C ruling, 2026-08-23) — the
    // strip renders on the grid's months, so a missing column is silently dropped money.
    cashDates: cashStrip.dates,
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

  // Money IN's SCHEDULED base — dues installments by due month, the only income with a schedule.
  // The ACTUAL base is `cashStrip` above (every dollar that arrived — owner ruling 2026-08-23;
  // the dues-only actual map this block used to also build retired with the ruling it enacted).
  // The strip pairs whichever base matches the lens with that lens's money-out — never a blend.
  const duesInScheduled: Record<string, number> = {};
  for (const i of duesInstallments) {
    const amt = i.amount ?? 0;
    if (!amt) continue;
    const due = monthKeyOf(i.due_date);
    if (due) duesInScheduled[due] = Math.round(((duesInScheduled[due] ?? 0) + amt) * 100) / 100;
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
    /* The strip's two IN bases and its ACTUAL out. Scheduled/Budget money-out stays the lens's own
       grid cells (projections are the plan's business) — only ACTUAL carries a server-assembled
       out-map, because only cash diverges from the cells (gross vs netted, and team-cash only). */
    moneyIn: { scheduled: duesInScheduled, actual: cashStrip.in },
    moneyOut: { actual: cashStrip.out },
    todayMonth,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual' });
