import { NextResponse } from 'next/server';
import {
  getRepDuesPaymentsByProgramYear, getRepDuesPayoutsByProgramYear,
  getRepDuesCreditsByProgramYear,
  getSeasonFundraiserEntries, getRepTeamMoneyIn, getDerivedIncomeClaims,
  getRepAllocationSplitsForTeam, getCommitmentStandings, getSeasonName,
} from '@/lib/db';
import { duesRemainingByInstallment } from '@/lib/coach-dues-remaining';
import { installmentLabel, paymentLabel, effectivePayerId } from '@/lib/payable-standing';
import {
  clubRequestOnSide, clubRequestReportSide,
  type ClubMoneyInMeaning, type ClubRequestType,
} from '@/lib/coach-club-money';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { tournamentToday, orgDayKey } from '@/lib/timezone';
import {
  buildMonthGrid, monthKeyOf, deriveMonthRange, isPayoutCategory, UNDATED_CELL,
  revenueCategoryId, revenueGroupLabel, revenueGroupOf, REVENUE_GROUPS,
  PAYOUT_CATEGORY_ID, PAYOUT_CATEGORY_NAME,
  type CategoryEvent, type GridLine, type RevenueGroupKey, type GridCategoryResult,
} from '@/lib/coach-budget-months';
import { LINE_KIND_ACTUAL_SOURCE } from '@/lib/coach-budget-totals';
import { computeBudgetTotals, normalizeBudgetLineKind, isFundingKind } from '@/lib/coach-budget-totals';
import {
  rollupMoneyReport, categoryKey, displayCategoryName,
  type RollupLine, type RollupSpend, type RollupRefund, type ItemRow,
} from '@/lib/coach-budget-rollup';
import { paidMovements, type PaidExpenseRow } from '@/lib/coach-expense-movements';
import { buildActualCashStrip } from '@/lib/coach-cash-strip';
import { placeDerivedActual } from '@/lib/coach-money-derived';
import { resolveCoachHistoryReadFromRequest } from '@/lib/coach-team-read';
import { DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from '@/lib/types';

/**
 * How a payment arrived, in the word the rest of the portal prints.
 *
 * ⚠⚠ THE SHARED MAP, NOT THE STORED TOKEN (owner-found 2026-08-25). The drill-in shipped the raw
 * value straight to the screen, so a coach read "other" and "etransfer" in lower case beside
 * figures — while Player Dues, the payout sheet and the recording conversation all printed
 * "E-Transfer" from `DUES_PAYMENT_METHOD_LABEL`. That map's own header records it being written to
 * stop a THIRD copy; this was worse than a copy, it was no lookup at all.
 *
 * ⚠ "Other" IS DROPPED RATHER THAN PRINTED. It is the answer a coach gives when they did not say
 * how the money came, so putting it on the line adds a word and no information — the row simply
 * reads "Sep 2", and the one beside it still reads "Sep 2 · Cash".
 */
function methodWord(method: DuesPaymentMethod | null): string | null {
  if (!method || method === 'other') return null;
  return DUES_PAYMENT_METHOD_LABEL[method] ?? null;
}

/** Money in a sentence — the panel's own notes ("$100 of $317 already paid"). */
function fmtMoney(n: number): string {
  const whole = Math.abs(n % 1) < 0.005;
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "Aug 2" — a day in a note, never a column header. */
function fmtDay(d: string | null): string {
  if (!d) return 'no date';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return y && m && day ? `${names[m - 1] ?? m} ${day}` : d;
}

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
    /* ⚠⚠ NO LONGER `.eq('status', 'approved')` (Option D, owner ruling 2026-08-23). A PENDING
       request now reaches the SCHEDULED forward view — "Asked of the club" —
       exactly as it reaches the register's, on the same argument that put it there: this book
       already carries a sponsor PLEDGE, and a request the club may decline is the same species of
       uncertainty. The status filter moved into the two loops below, which is also where a
       DECLINED request is dropped; filtering here instead would split "which statuses does this
       report admit?" across two places.
       🔒 UNCHANGED AND LOAD-BEARING: a pending request touches no settled figure. It reaches the
       Scheduled lens only — never the statement, never the cash bands, never Cash on hand. */
    supabaseAdmin
      .from('rep_team_payment_requests')
      .select('id, request_type, money_in_meaning, amount, description, status, reviewed_at, created_at, budget_item_id, budget_category_id, budget_items(name), budget_categories(name)')
      .eq('team_id', teamId)
      .eq('program_year_id', programYear.id),
  ]);

  const allClubRequests = ((clubReqRes.data ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id as string,
    status: r.status as string,
    requestType: r.request_type as ClubRequestType,
    /* ⚠ NULL IS LEGACY, NOT UNANSWERED — `clubRequestReportSide` reads it as a reimbursement,
       which is the reading these rows have reported under since they were approved (mig 271, no
       backfill by rule). */
    moneyInMeaning: (r.money_in_meaning as ClubMoneyInMeaning | null) ?? null,
    amount: Number(r.amount ?? 0),
    description: (r.description as string) ?? '',
    categoryId: (r.budget_category_id as string | null) ?? null,
    categoryName: (r.budget_categories?.name as string) ?? null,
    itemId: (r.budget_item_id as string | null) ?? null,
    itemName: (r.budget_items?.name as string) ?? null,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
  /* Settled club money — everything the statement, the cash bands and Cash on hand are allowed to
     see. ⚠ A DECLINED request appears nowhere at all: it is not money that moved and not money
     that might, and its home is the Club tab's own record. */
  const clubApprovedRequests = allClubRequests.filter(r => r.status === 'approved');

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
  /* ⚠⚠ THE UNFILTERED ENTRIES READ (Option D, 2026-08-23), where this was
     `getRealisedFundraiserEntries`. The Scheduled lens is the season's FORWARD view and a sponsor
     PLEDGE is the clearest thing on it — money the team has been promised and not received. That
     reader cannot answer "how much is merely promised", by design, so this takes the whole list and
     splits it once, here. ⚠ `realisedEntries` below is the ONLY thing any cash or actual figure may
     read; a pledge summed into a "raised" total would flatter the season (mig 237's rule).
     ⚠ DUES CREDITS ride along for the same forward view: what a family still owes on an instalment
     is net of the credits their fundraising already earned, and quoting the face value here while
     the payment schedule quotes the remainder is two answers to one family's question. */
  /* ⚠⚠ AND THE ROSTER'S NAMES (D-2, owner ruling 2026-08-24). The REVENUE band's rows are the
     actual families, drives and sponsors behind a figure, so the report has to be able to say whose
     dollar it is. ⚠ GATED EXACTLY AS THE PLAYER DUES TAB IS AND NO WIDER: this whole route already
     refuses a coach without `canViewMoney` above, which is the same key that opens Dues. Nothing
     here widens who can read a family name. */
  const [moneyInRecords, derivedClaims, allEntries, duesPayments, duesPayouts, duesCredits, rosterRes] = await Promise.all([
    getRepTeamMoneyIn(programYear.id),
    getDerivedIncomeClaims(programYear.id),
    getSeasonFundraiserEntries(programYear.id),
    getRepDuesPaymentsByProgramYear(programYear.id),
    getRepDuesPayoutsByProgramYear(programYear.id),
    getRepDuesCreditsByProgramYear(programYear.id),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('program_year_id', programYear.id),
  ]);
  /* ⚠ THE SAME NAME THE REGISTER PRINTS, assembled the same way — a family reading as "Maya Ledger"
     on one screen and "Maya" on the next is the same record answering twice. */
  const playerName = new Map(
    ((rosterRes.data ?? []) as Array<{ id: string; player_first_name: string; player_last_name: string | null }>)
      .map(pl => [pl.id, [pl.player_first_name, pl.player_last_name].filter(Boolean).join(' ')]),
  );
  /** A family whose roster row is gone (a mid-season removal) still has money on the book. */
  const familyName = (playerId: string | null) =>
    (playerId ? playerName.get(playerId) : null) ?? 'A family';
  const realisedEntries = allEntries.filter(e => e.realised);
  /**
   * What a sponsor has promised and not sent. ⚠ READ FROM THE RECORD, NOT ENTRIES (mig 268): a
   * pledged sponsor has zero entries now — its promise lives in `pledged_amount` — and a
   * part-paid one's outstanding promise is pledged minus arrived. Undated by nature until an
   * expected-by date exists (Q13, phase D).
   */
  const arrivedBySponsor = new Map<string, number>();
  for (const e of realisedEntries) {
    if (e.kind === 'sponsor') {
      arrivedBySponsor.set(e.fundraiserId, (arrivedBySponsor.get(e.fundraiserId) ?? 0) + e.amountRaised);
    }
  }
  const { data: sponsorRecordRows } = await supabaseAdmin
    .from('rep_fundraisers')
    .select('id, name, pledged_amount, created_at')
    .eq('program_year_id', programYear.id)
    .eq('kind', 'sponsor');
  const sponsorPledges = (sponsorRecordRows ?? [])
    .map(s => ({
      fundraiserId: s.id as string,
      fundraiserName: (s.name as string) ?? '',
      remaining: Math.max(0, Math.round(((Number(s.pledged_amount) || 0) - (arrivedBySponsor.get(s.id as string) ?? 0)) * 100) / 100),
      recordedDay: orgDayKey(s.created_at as string),
    }))
    .filter(s => s.remaining > 0.005);

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

     ⚠⚠ THE KINDS DO NOT ALL LAND ON THE SAME SIDE, and the ARRIVAL is the whole rule:
       · a PAID allocation instalment  → a cost
       · an approved `payment_to_org`  → a cost (the team sent the club money)
       · an approved `charge_to_org`   → **the coach's answer** (mig 271, owner D1): a REFUND that
         nets into the item it repaid, or NEW MONEY that is its own revenue row.

     ⚠⚠ THIS WAS ONE UNCONDITIONAL BRANCH UNTIL 2026-08-30, AND THAT WAS THE DEFECT. Every arrival
     from the club was read as a repayment. For a repayment that is right — the club covering a $325
     entry fee means the team spent $325 less, not that it earned $325, and booking it as revenue
     would make the season look $650 better than it is (the arithmetic `rep_team_money_in`'s own
     table comment spells out). For a GRANT it is wrong in the mirror image: the money vanishes into
     a cost line it was never about, the line claims spending the club actually carried, and the
     fact the club contributed appears nowhere a treasurer would look. Both net out at the season
     level; the harm is entirely in the lines, which is why no total-based guard could catch it.

     ⚠ ONLY THE COACH KNOWS WHICH IT IS — nothing on the record distinguishes them. So the answer is
     ASKED (required, on the Club tab) and read here; `clubRequestReportSide` owns the rule,
     including that a NULL meaning is LEGACY and keeps the reimbursement reading.

     ⚠ UNFILED CLUB MONEY STILL COUNTS. A row with no item lands in the report's existing
     "Not itemized" bucket rather than being dropped — the money moved, and hiding it would trade
     one silence for another. The Club tab says on the row that filing it is what puts it in a
     category. */
  const clubSpend: RollupSpend[] = [];
  const clubRefunds: RollupRefund[] = [];
  /* New money the club gave the season — money IN, in the same two levels as any other arrival.
     ⚠ IT JOINS `spend` WITH `direction: 'in'`, exactly as typed income and the derived pools do,
     because direction is part of the rollup's grouping key: a cost and an income row on the same
     category+item can never collide (rollup rule 5). ⚠ AND NO BUDGET LINE IS EVER CREATED — the
     row's dash under Budget is DERIVED from there being no line, which is the same flagged-row
     parity unplanned spending already has. */
  const clubIncome: RollupSpend[] = [];
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
    /* ⚠ THE RULE IS IMPORTED, NOT RE-DERIVED HERE. Its module carries the whole justification, and
       the predicate it replaced was once — embarrassingly — dead code, because the one route that
       needed it had re-written the same branch by hand.
       ⚠ A RECORD OF HANDLERS RATHER THAN A SWITCH: every side must be answered or this does not
       compile, which is what a fourth answer should meet instead of a `default` nobody wrote. */
    const body = { id: `club-request-${r.id}`, description: r.description, ...placed, amount: r.amount };
    clubRequestOnSide(r, {
      // The club paying the team back — NETS into the cost it repaid, never revenue.
      reimbursement: () => clubRefunds.push({ ...body, receivedDate: settledOn }),
      // New money for the season — its own revenue row, under the words the coach filed it with.
      funding: () => clubIncome.push({ ...body, paidDate: settledOn, direction: 'in' as const }),
      // The team paying the club — an ordinary cost.
      cost: () => clubSpend.push({ ...body, paidDate: settledOn, direction: 'out' as const }),
    });
  }

  const report = rollupMoneyReport({
    lines: rollupLines,
    spend: [...rollupSpend, ...incomeSpend, ...derivedSpend, ...clubSpend, ...clubIncome],
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

  // ── 6. Dues schedules and instalments ─────────────────────────────────
  const { data: schedules } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, player_id, total_amount')
    .eq('program_year_id', programYear.id);

  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);

  /* ⚠⚠ THE DUES-COLLECTION SUMMARY IS GONE FROM THIS PAYLOAD (owner ruling 2026-08-26). It fed
     one thing — the four-tile `Dues Collection` card at the top of Budget vs. Actual — and that
     card was deleted: dues are money IN, this report measures spending against plan, and all
     four of its figures are already told on the Money hub's Overview card and on Player Dues'
     own footer. The report states dues month by month in its own income band besides.
     ⚠ Removed rather than left computed-and-unread: the payload's own contract note (below, at
     `unbudgetedActuals`) is that a field nothing sends or nothing reads is how the next reader
     gets `undefined` with a clean typecheck. The SCHEDULES and INSTALLMENTS fetches stay — the
     cash-flow strip and the Scheduled lens both hang off them. */
  /* ⚠ THE INSTALMENT'S OWN IDENTITY RIDES ALONG (Option D, 2026-08-23). The Scheduled lens quotes
     what is STILL OWED on each piece, and `duesRemainingByInstallment` matches payments, credits
     and payouts to instalments by id and player — a list of bare amounts cannot be asked the
     question at all. */
  let duesInstallments: Array<{
    id: string; schedule_id: string; player_id: string | null; installment_number: number;
    amount: number; due_date: string | null; paid_at: string | null;
  }> = [];
  if (scheduleIds.length > 0) {
    const { data: inst } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('id, schedule_id, player_id, installment_number, amount, due_date, paid_at')
      .in('schedule_id', scheduleIds);
    duesInstallments = (inst ?? []) as typeof duesInstallments;
  }

  /* Whose instalment is whose. ⚠ `rep_player_dues_installments.player_id` is denormalised and can
     be null on older rows, so the SCHEDULE answers for them — the register's own fallback, and the
     remainder derivation groups by player, so an instalment with no owner would be dropped. */
  const scheduleOwner = new Map(
    ((schedules ?? []) as Array<{ id: string; player_id: string }>).map(s => [s.id, s.player_id]));

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
  /* ⚠⚠ KEYED BY CATEGORY AND MONTH, AND EACH RECORD NAMES ITS OWN ROW (D-2, 2026-08-24). An ITEM's
     panel is a FILTER of its category's list, never a second copy of it in the payload: the same
     records would otherwise ship twice on a report that is already the heaviest read in the portal,
     and two arrays are two things a future change can put out of step. `row` is the grid row's own
     id — `<categoryKey>|<itemId>` — which is exactly what `buildMonthGrid` keys money by, so the
     filter cannot drift from the placement. */
  const cellDetails: Record<string, Array<{
    id: string; description: string; date: string | null; amount: number;
    /**
     * What kind of record it is, for the rows whose own words are just that kind repeated.
     *
     * ⚠ A ROW'S panel leads with the record's words and falls back to this; a GROUP's panel leads
     * with the row's NAME and never shows the kind, because the group already is the kind. Sending
     * both is what lets one list serve two panels without the screen guessing which word is which.
     */
    kind?: string | null;
    /** Absent where paid/unpaid says nothing — a dues payment did not "get paid". */
    paid?: boolean;
    /** The meta line, when the record has something to say the date does not. */
    note?: string | null;
    /** "Due", "Asked" — a word before a date that is not the day money moved. */
    datePrefix?: string;
    row?: string;
  }>> = {};
  /* ⚠ THE SAME CATEGORY IDENTITY THE GRID ITSELF RETURNS, or a cell has detail behind it that its
     own panel cannot find. This used to key on `(category ?? '').trim().toLowerCase()` while
     `buildMonthGrid` returned its own key — for a NAMELESS category those were `''` and
     `'uncategorized'`, so the cell's drill-in resolved to an empty list and the cell rendered as
     un-clickable. Silent, and only ever wrong for the one bucket nobody seeds. */
  function pushDetail(
    kind: 'actual' | 'scheduled',
    category: { categoryId: string | null; categoryName: string },
    date: string | null,
    item: {
      id: string; description: string; amount: number;
      kind?: string | null; paid?: boolean; note?: string | null; datePrefix?: string; itemId?: string | null;
    },
  ) {
    /* ⚠⚠ UNDATED MONEY GETS A BUCKET RATHER THAN BEING DROPPED (D-2, 2026-08-24). A sponsor
       PLEDGE and a club request awaiting an answer have no date because nothing records when they
       land — they live entirely in the "No date yet" column, and until now that column's figure had
       nothing behind it. A cell a coach can see and cannot open is the dead end this build exists
       to close. `UNDATED_CELL` is deliberately not a month key shape, so nothing can mistake it
       for one. */
    const m = monthKeyOf(date) ?? (date === null ? UNDATED_CELL : null);
    if (!m) return;
    const cat = categoryKey(category.categoryId, category.categoryName);
    const { itemId, ...rest } = item;
    /* ⚠ THE ROW KEY IS BUILT THE WAY THE GRID BUILDS IT — `no-item` for unattributed money, the
       same fallback `buildMonthGrid` uses — so a record and the row it belongs to can never key
       differently. */
    (cellDetails[`${kind}|${cat}|${m}`] ??= []).push({ ...rest, date, row: `${cat}|${itemId ?? 'no-item'}` });
  }

  /* ══ SCHEDULED KEEPS ITS OWN RAW FEED, AND THAT IS A DECISION ══════════════════════════════════
     Every ACTUAL figure on this report now comes from the rollup (below). Commitments cannot: the
     rollup only knows money that has MOVED, and the statement has no "committed" column to grow one
     from. Deriving Scheduled would mean teaching the rollup a third dimension it exists not to have,
     which is worse than one honest exception — so it is stated here rather than left as an omission
     for a reader to mistake for an oversight (COACH_MONEY_ONE_ARITHMETIC_PLAN.md §3, Phase B.5).

     ⚠ IT STILL SHARES THE CATEGORY IDENTITY. A commitment and the payment that settles it must land
     in the same row, so the events go through `gridCategory` exactly as the actuals do.

     ⚠⚠ CLUB INSTALMENTS ARE HERE NOW (owner ruling 2026-08-30), AND THIS COMMENT USED TO SAY THE
     OPPOSITE. It read: "deliberately absent… adding them to both is its own question, not this
     one's." That was an honest deferral and this is that question, answered yes. An unpaid club
     instalment is an obligation with a due date; leaving it out made Scheduled quote LESS than the
     team is committed to pay, while the Payment schedule and Next 30 days — sitting beside it,
     reading the same rows — quoted the whole of it. Three surfaces, one question, two answers.
     The loop that adds them is below the expenses loop rather than inside it: they are a different
     table with a different shape, and pretending otherwise would mean teaching `standings` about
     a record it does not own. */
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
        itemId: placed.itemId,
        description: installmentLabel(description, inst.installmentNumber, count),
        amount: inst.remaining,
        /* ⚠ R4 — SETTLED MEANS PAID IN FULL, and a part-paid piece is therefore still here, for
           its REMAINDER. Never `true` now: a settled piece no longer reaches this list at all. */
        paid: false,
      });
    }
  }

  /* ══ CLUB BILLS, ON THE SAME COLUMN ═══════════════════════════════════════════════════════════
     What the club has billed this team and the team has not yet paid — in the month it falls due,
     under the bill's OWN filing, so a club instalment and the team's own spending on that word land
     on one row rather than two.

     ⚠⚠ REMAINDER, NOT FACE VALUE — the standing rule for this column (owner, 2026-08-20:
     *"scheduled is what we are currently obligated to pay"*). For a club instalment the two figures
     are THE SAME NUMBER, and that is worth saying rather than leaving a reader to wonder whether
     the rule was applied: a club instalment is settled or it is not (`paid_at`), because nothing in
     the product records a part payment against one. If that ever changes, the remainder derivation
     belongs here and this comment is the place it was expected.

     ⚠ A SETTLED INSTALMENT LEAVES THIS VIEW ENTIRELY — its money is already on the Actual lens as
     the payment that covered it, and counting the instalment too would double the same dollar.
     ⚠ A PAST-DUE ONE STAYS IN ITS DUE MONTH and still counts: "currently obligated to pay" includes
     what should already have been paid, and dropping it would hide the most urgent money on the
     report.
     ⚠ AN UNFILED BILL STILL COUNTS, in "Not itemized" — the same rule its PAID instalments already
     follow on the Actual side. Money the team owes does not become invisible for want of a label. */
  for (const split of clubSplits) {
    const cat = gridCategory(split.budgetCategoryId, split.budgetCategoryName);
    const count = split.installments.length;
    const description = split.allocationDescription || 'Club allocation';
    for (const inst of split.installments) {
      if (inst.paidAt) continue;
      gridScheduled.push({ ...cat, itemId: split.budgetItemId, date: inst.dueDate, amount: inst.amount });
      pushDetail('scheduled', cat, inst.dueDate, {
        id: inst.id,
        itemId: split.budgetItemId,
        // The same namer the payment schedule, the register and this report's other lenses use, so
        // one piece of one bill is called one thing wherever a coach meets it.
        description: installmentLabel(description, inst.installmentNumber, count),
        amount: inst.amount,
        // What it IS, for the panel's own words — this row is not one of the team's commitments.
        kind: 'Club bill',
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
  /* ══ THE CASH STRIP — every dollar that MOVED, gross, from the primitive records ══════════════
     ⚠⚠ NEVER FROM THE GRID'S CELLS (owner ruling 2026-08-23, reversing 2026-07-30's dues-only
     strip — memory/design_decisions.md). The cells are the REPORT: netted (money back and club
     reimbursements shrink the costs they repaid) and including spending that never touched team
     cash (a family paying a vendor direct). Cash is gross both directions and team-cash only.
     The inclusion and dating rules live in lib/coach-cash-strip.ts, pinned by its unit tests;
     `check:money-report` proves the result equals the register month-by-month, to the cent. */
  const cashStrip = buildActualCashStrip({
    duesPayments: duesPayments.map(p => ({
      id: p.id, amount: p.amount, receivedDate: p.receivedDate,
      playerId: p.playerId, playerName: familyName(p.playerId), method: methodWord(p.method),
    })),
    /* ⚠ THE SAME `placeArrival` THE STATEMENT USES. An arrival filing itself one way on the report
       and another in its own drill-in is the "two answers to one fact" defect this route's header is
       about — the resolution is called once, here, and both readings take it. */
    moneyInRecords: moneyInRecords.map(m => {
      const at = placeArrival(m);
      return {
        id: m.id, amount: m.amount, receivedDate: m.receivedDate, kind: m.kind,
        description: m.description ?? '',
        categoryName: at.categoryName, itemId: at.itemId, itemName: at.itemName,
      };
    }),
    realisedEntries: realisedEntries.map(e => ({
      id: e.id, amountRaised: e.amountRaised, receivedDate: e.receivedDate, createdAt: e.createdAt,
      kind: e.kind, fundraiserId: e.fundraiserId, fundraiserName: e.fundraiserName,
      playerId: e.playerId, playerName: e.playerId ? familyName(e.playerId) : null,
      rebateAmount: e.rebateAmount,
    })),
    clubRequests: clubApprovedRequests.map(r => ({
      id: `club-request-${r.id}`,
      description: r.description,
      amount: r.amount,
      place: { categoryId: r.categoryId, categoryName: r.categoryName, itemId: r.itemId },
      itemName: r.itemName ?? null,
      side: clubRequestReportSide(r),
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    })),
    expensePayments: expenses.flatMap(exp => {
      const placed = placedFor(exp);
      const standing = standings[exp.id as string];
      const count = standing?.installments.length ?? 0;
      return (standing?.payments ?? []).map(p => ({
        id: `${exp.id as string}-payment-${p.id}`,
        description: paymentLabel(exp.description as string, p, count),
        amount: p.amount,
        place: { categoryId: placed.categoryId, categoryName: placed.categoryName, itemId: placed.itemId },
        paidDate: p.paidDate,
        /* ⚠⚠ PER PAYMENT (money centralization P4, mig 267). This read `!!exp.paid_by_player_id`,
           which was a complete answer while a cost was fronted or it was not. A commitment can now
           hold a deposit a parent paid direct and a balance the team paid — at cost level the cash
           strip either subtracts the whole bill from cash the team still holds, or none of it. */
        familyPaidDirect: effectivePayerId(p, exp.paid_by_player_id as string | null) !== null,
      }));
    }),
    duesPayouts: duesPayouts.map(p => ({
      id: `dues-payout-${p.id}`, amount: p.amount, paidDate: p.paidDate,
      playerId: p.playerId, playerName: familyName(p.playerId), method: methodWord(p.method),
      /* ⚠ THE COACH'S OWN WORDS FOR WHY — "overpaid instalment #2", a shared surplus, a cashed-out
         credit. Nothing is invented when the note is blank; the row simply says how it was sent. */
      reason: p.note,
    })),
    clubInstallments: clubSplits.flatMap(s =>
      s.installments.map(i => ({
        id: `club-allocation-${i.id}`,
        description: s.allocationDescription || 'Club allocation',
        amount: i.amount,
        place: { categoryId: s.budgetCategoryId, categoryName: s.budgetCategoryName, itemId: s.budgetItemId },
        paidAt: i.paidAt,
      }))),
  });

  /* ⚠⚠ THE EXPENSE BAND'S ACTUAL IS **CASH**, AND THIS IS THE OPTION D RULING (owner, 2026-08-23).
     It was `actualMovements` — the statement's own list — until the Months view became the season's
     cash statement. The two differ in exactly three ways, all deliberate:
       · a cost a FAMILY paid the vendor direct is season spending and never team cash, so it is out
         ("we didn't pay anything — once we pay the player it shows up at that point");
       · MONEY BACK no longer nets into the cost it repaid — it is an arrival, and it moved to the
         revenue band's own group, where a coach can see it;
       · money PAID BACK to a family joins the band, under its own heading.
     `actualMovements` survives above and still feeds the cumulative CHART, which is report-basis and
     stays paired with the statement. Two labelled truths, one guard each — the grid answers to the
     register, the statement and the chart answer to each other. */
  /* ⚠⚠ AND MONEY PAID BACK OPENS BY FAMILY (D-2, owner call 2026-08-24). This group has no budget
     items to be fed from, so its rows are the families themselves — registered here, in the order
     the money left, exactly as the revenue band learns its own rows. Left shut it would have been
     the one figure on the statement a coach could not trace back to a record. */
  const payoutRows = new Map<string, GridLine>();
  for (const mv of cashStrip.expenses) {
    const cat = gridCategory(mv.place.categoryId, mv.place.categoryName);
    if (isPayoutCategory(mv.place.categoryId) && mv.place.itemId) {
      const id = `${categoryKey(PAYOUT_CATEGORY_ID, PAYOUT_CATEGORY_NAME)}|${mv.place.itemId}`;
      if (!payoutRows.has(id)) {
        payoutRows.set(id, {
          id,
          description: familyName(mv.place.itemId),
          categoryId: PAYOUT_CATEGORY_ID,
          categoryName: PAYOUT_CATEGORY_NAME,
          itemId: mv.place.itemId,
          totalAmount: 0,
          inPlan: false,
          periods: [],
        });
      }
    }
    gridActuals.push({ ...cat, itemId: mv.place.itemId, date: mv.date, amount: mv.amount });
    pushDetail('actual', cat, mv.date, {
      id: mv.id, itemId: mv.place.itemId, description: mv.description, kind: mv.kind, amount: mv.amount,
      /* ⚠ A PAYOUT'S META LINE IS ITS REASON, NOT THE WORD "paid" (owner ruling 2026-08-24). Every
         other cash-out row keeps paid/unpaid, which is the only thing it has to say. */
      ...(mv.note ? { note: mv.note } : { paid: true }),
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

  /* ══ 8b. THE REVENUE BAND — the other half of the season's cash statement ═════════════════════
     ⚠⚠ MONTHS IS TWO BANDS AS OF 2026-08-23 (owner ruling, Option D, drawn and taken). It answered
     "what did we spend?" and the coach had to look elsewhere for "what came in", which is why the
     one figure a treasurer actually wants — the balance — was a three-row strip bolted underneath
     rather than the thing the table adds up to. Now: REVENUE groups, EXPENSES categories, a total
     under each, and Net = the running balance's step. Revenue − expenses = balance, to the cent.

     ⚠ GROUPED BY WHERE THE MONEY CAME FROM, never by the budget category it was filed under — see
     `REVENUE_GROUPS`. Five fixed groups; a group with nothing under any lens never renders.

     ⚠⚠ THE SAME `buildMonthGrid` BUILDS BOTH BANDS, and that is the point rather than a shortcut.
     A second builder for revenue would be a parallel copy of the windowing, the undated bucket, the
     category identity and the totals — four rules this module has already been consolidated twice
     to keep in one place. What revenue needed was one honest addition: a plan can arrive as dated
     EVENTS (a dues instalment schedule is a plan, and it is not a budget line). */
  const revenueEvent = (
    group: RevenueGroupKey, date: string | null, amount: number,
    subject: { id: string | null; name: string } | null = null,
  ): CategoryEvent => ({
    categoryId: revenueCategoryId(group),
    // The lens-neutral name; the screen re-labels per lens (`revenueGroupLabel`).
    categoryName: revenueGroupLabel(group, 'actual'),
    /* ⚠⚠ WHO OR WHAT THE MONEY CAME FROM (D-2, owner ruling 2026-08-24) — the family, the drive,
       the sponsor, the filing. It rides in `itemId` because that is the field `buildMonthGrid`
       already keys a row by; giving revenue its own second key would be a parallel copy of the
       placement rule, which is the thing this builder has been consolidated twice to avoid. */
    itemId: subject?.id ?? null,
    date,
    amount,
  });

  /* ══ THE REVENUE BAND'S OWN ROWS ══════════════════════════════════════════════════════════════
     ⚠⚠ ONE ROW PER SUBJECT, LEARNED FROM THE MONEY ITSELF. A revenue group has no budget lines to
     be fed from — what a season collects in dues is a schedule, what it raises is a drive — so the
     rows are the families, drives, sponsors and requests that actually have a figure. Registered in
     FIRST-APPEARANCE order within each group, which is the register's own chronology.
     ⚠ NOTHING IS ELIDED. Every family renders; the drawing's "…nine more families" was drawing
     economy, not a design (owner ruling 2026-08-24). */
  const revenueRows = new Map<string, GridLine>();
  function revenueRow(group: RevenueGroupKey, subject: { id: string | null; name: string }) {
    const categoryId = revenueCategoryId(group);
    /* ⚠⚠ MONEY NOBODY FILED STILL GETS A ROW, and it took an owner question about sample data to
       notice it did not. This returned early on a null subject, so an arrival with no budget item
       reached the group's TOTAL and no row beneath it — expand the group and the rows silently add
       up to less than the figure above them, with nothing on screen saying why.
       ⚠ `no-item` IS NOT AN INVENTED KEY: it is the exact fallback `buildMonthGrid` already uses
       when it places an event carrying no item, so the row and its money meet on the same key
       rather than the row being a label with nothing behind it. */
    const id = `${categoryKey(categoryId, revenueGroupLabel(group, 'actual'))}|${subject.id ?? 'no-item'}`;
    if (revenueRows.has(id)) return;
    revenueRows.set(id, {
      id,
      description: subject.name,
      categoryId,
      categoryName: revenueGroupLabel(group, 'actual'),
      itemId: subject.id,
      /* ⚠ NO PLAN, ON PURPOSE. A revenue row is a RECORD of where money came from, not a line
         anybody budgeted — so it carries no total and no periods, and the group's own budget
         (a dues schedule, a funding line) stays on the group row where a coach set it. `inPlan`
         false keeps every pre-240 reader honest about that. */
      totalAmount: 0,
      inPlan: false,
      periods: [],
    });
  }

  /** A revenue record's own line in the panel behind its cell. */
  function pushRevenueDetail(
    kind: 'actual' | 'scheduled', group: RevenueGroupKey, date: string | null,
    rec: {
      id: string; subject: { id: string | null; name: string };
      description?: string | null; kind?: string | null;
      note?: string | null; amount: number; datePrefix?: string;
    },
  ) {
    pushDetail(kind, { categoryId: revenueCategoryId(group), categoryName: revenueGroupLabel(group, 'actual') }, date, {
      id: rec.id, itemId: rec.subject.id, description: rec.description ?? '', kind: rec.kind,
      amount: rec.amount, note: rec.note ?? null, datePrefix: rec.datePrefix,
    });
  }

  // ── Revenue · ACTUAL: the cash that arrived, in its group, on the day it arrived.
  const revenueActuals: CategoryEvent[] = cashStrip.revenue.map(e => {
    revenueRow(e.group, e.subject);
    pushRevenueDetail('actual', e.group, e.date, e);
    return revenueEvent(e.group, e.date, e.amount, e.subject);
  });

  /* ── Revenue · BUDGET: what the season PLANNED to bring in.
     Two feeds, and they are genuinely different animals:
       · the dues INSTALMENT SCHEDULE — dated amounts a coach set on Player Dues, the only income
         with a schedule and never a budget line;
       · the plan's own funding lines, split by KIND so expected fundraising and expected
         sponsorship land in their own groups (through `LINE_KIND_ACTUAL_SOURCE`, never a ternary —
         see its header for the nineteen readers that got that wrong). */
  const revenueBudgets: CategoryEvent[] = [];
  for (const i of duesInstallments) {
    revenueBudgets.push(revenueEvent('dues', i.due_date, i.amount ?? 0));
  }
  for (const line of fundingLines) {
    const source = LINE_KIND_ACTUAL_SOURCE[normalizeBudgetLineKind(line.line_kind as string | null)];
    const group: RevenueGroupKey = source === 'sponsor' ? 'sponsorship'
      : source === 'fundraiser' ? 'fundraising' : 'other';
    const periods = ((line.rep_budget_periods ?? []) as Array<Record<string, unknown>>);
    let placed = 0;
    for (const p of periods) {
      const amt = (p.amount as number) ?? 0;
      placed += amt;
      revenueBudgets.push(revenueEvent(group, p.period_date as string | null, amt));
    }
    /* ⚠ THE UNDATED REMAINDER IS EMITTED, NOT DROPPED. A budget LINE hands the grid its total and
       the grid works out what has no date; an event stream has to say so itself, or a funding line
       nobody has phased would silently plan nothing. */
    const rest = Math.round((((line.total_amount as number) ?? 0) - placed) * 100) / 100;
    if (rest > 0.005) revenueBudgets.push(revenueEvent(group, null, rest));
  }

  /* ── Revenue · SCHEDULED: the season's FORWARD view (owner ruling 2026-08-23, drawn).
     Everything the team knows is coming and has not yet received — the same rows the register
     already shows past Today, so "will we run short?" is answered from all of it rather than dues
     alone. ⚠ A settled thing is never scheduled: money already in is on the Actual lens. */
  const revenueScheduled: CategoryEvent[] = [];
  {
    /* ⚠ THE REMAINDER, NEVER THE FACE VALUE — the shared derivation, so this lens and the payment
       schedule quote a family the same figure. A family $200 into a $300 instalment has $100
       coming, and credits their fundraising earned lower it further. */
    const remaining = duesRemainingByInstallment({
      installments: duesInstallments.map(i => ({
        id: i.id,
        playerId: i.player_id ?? scheduleOwner.get(i.schedule_id) ?? '',
        installmentNumber: i.installment_number,
        amount: i.amount ?? 0,
        dueDate: i.due_date,
        paidAt: i.paid_at,
      })),
      payments: duesPayments.map(p => ({
        id: p.id, playerId: p.playerId, amount: p.amount, receivedDate: p.receivedDate, createdAt: p.createdAt,
      })),
      credits: duesCredits,
      payouts: duesPayouts,
      mode: programYear.creditApplication,
    });
    for (const i of duesInstallments) {
      /* ⚠ A PAID INSTALMENT IS NOT SCHEDULED. Its money is already on the Actual lens as the
         PAYMENT that covered it, and counting the instalment too would double the same dollar —
         the exact rule the register's own forward view follows. */
      if (i.paid_at) continue;
      const owed = remaining.get(i.id) ?? (i.amount ?? 0);
      if (owed <= 0.005) continue;
      const playerId = i.player_id ?? scheduleOwner.get(i.schedule_id) ?? null;
      const subject = { id: playerId, name: familyName(playerId) };
      revenueRow('dues', subject);
      /* ⚠⚠ THE REMAINDER, AND THE PANEL SAYS SO OUT LOUD (owner ruling 2026-08-24). A family $100
         into a $317 instalment has $217 coming — quoting the face value here while the payment
         schedule quotes the remainder is two answers to one family's question, and the note is what
         stops the smaller figure reading as a mistake. */
      const face = i.amount ?? 0;
      const covered = Math.round((face - owed) * 100) / 100;
      pushRevenueDetail('scheduled', 'dues', i.due_date, {
        id: i.id, subject, amount: owed,
        // One word, one spelling, everywhere a customer can read it (owner ruling 2026-08-24).
        description: `Installment #${i.installment_number}`,
        datePrefix: 'Due ',
        note: covered > 0.005 ? `${fmtMoney(covered)} of ${fmtMoney(face)} already paid` : null,
      });
      revenueScheduled.push(revenueEvent('dues', i.due_date, owed, subject));
    }
  }
  /* A sponsor's promise, and a request the club has not answered. ⚠ BOTH UNDATED, and that is
     honest rather than missing: nothing records when a pledge lands or when a club will decide.
     They sit in the "No date yet" column — in the Total, in no month — so they are counted as
     POSSIBLE and can never rescue a month the team has to get through without them. */
  for (const e of sponsorPledges) {
    const subject = { id: e.fundraiserId, name: e.fundraiserName };
    revenueRow('sponsorship', subject);
    pushRevenueDetail('scheduled', 'sponsorship', null, {
      id: `sponsor-pledge-${e.fundraiserId}`, subject, amount: e.remaining,
      description: 'Pledged', note: `recorded ${fmtDay(e.recordedDay)}`,
    });
    revenueScheduled.push(revenueEvent('sponsorship', null, e.remaining, subject));
  }
  for (const r of allClubRequests) {
    /* ⚠ INCOMING ONLY, AND THIS IS NOW AN ASYMMETRY WORTH STATING (2026-08-30). The expense band's
       Scheduled column gained club INSTALMENTS in this release — money the club has already billed
       and the team is committed to pay. A pending `payment_to_org` is not that: nobody has agreed
       to anything, and the club may decline. So it stays out of both bands, where it has always
       been, and the register carries it.

       ⚠ THE MEANING IS NOT READ HERE, DELIBERATELY (D4). "Asked of the club" is the PENDING bucket:
       until the club answers, a request is a question, and whether the coach expects a grant or a
       repayment does not change what the season may not count on. The meaning starts speaking the
       day the request is approved and reaches the statement. */
    if (r.status !== 'pending' || r.requestType !== 'charge_to_org') continue;
    const subject = { id: r.id, name: r.description || 'Asked of the club' };
    revenueRow('moneyback', subject);
    pushRevenueDetail('scheduled', 'moneyback', null, {
      id: `club-request-${r.id}`, subject, amount: r.amount,
      description: r.description || 'Asked of the club',
      note: `Asked ${fmtDay(orgDayKey(r.createdAt))} · they may still decline`,
    });
    revenueScheduled.push(revenueEvent('moneyback', null, r.amount, subject));
  }

  /* ══ ONE MONTH DOMAIN, TWO BANDS ══════════════════════════════════════════════════════════════
     ⚠⚠ DERIVED ONCE AND HANDED TO BOTH. The bands are two calls rendered as one table, so a column
     one of them has and the other does not is not a cosmetic problem — every cell after it reads
     the wrong month, and Net for the month would subtract April's costs from May's revenue.
     ⚠ A month where only CASH moved still gets a column (Exhibit C ruling, 2026-08-23): folding
     off-range cash into an edge month, and footnote-only disclosure, were both rejected. */
  const { months: gridMonths, truncated: gridTruncated } = deriveMonthRange(
    [
      ...gridLines.flatMap(l => l.periods.map(p => p.date)),
      ...gridActuals.map(a => a.date),
      ...gridScheduled.map(s => s.date),
      ...revenueActuals.map(e => e.date),
      ...revenueBudgets.map(e => e.date),
      ...revenueScheduled.map(e => e.date),
      ...cashStrip.dates,
    ],
    todayMonth,
  );

  const monthGridRaw = buildMonthGrid({
    lines: [...gridLines, ...payoutRows.values()],
    actuals: gridActuals,
    scheduled: gridScheduled,
    todayMonth,
    bufferAmount: buffer,
    months: gridMonths,
    truncated: gridTruncated,
  });
  /* ⚠⚠ "Paid back to families" IS PINNED TO THE FOOT OF THE BAND, and it now has to be said rather
     than arranged. The mockup draws it last, and until D-2 it landed there by accident: the group
     arrived only as EVENTS, and the builder appends event-only categories after the planned ones.
     Giving it real rows (one per family) moved it into the planned list, where it would have jumped
     to the TOP of a treasurer's spending table. Order that matters is order that is stated. */
  const monthGrid = {
    ...monthGridRaw,
    categories: [...monthGridRaw.categories].sort(
      (a, b) => Number(isPayoutCategory(a.categoryKey)) - Number(isPayoutCategory(b.categoryKey))),
  };

  const revenueGridRaw = buildMonthGrid({
    lines: [...revenueRows.values()],
    actuals: revenueActuals,
    scheduled: revenueScheduled,
    budgets: revenueBudgets,
    todayMonth,
    months: gridMonths,
    truncated: gridTruncated,
  });
  /* ⚠ THE BAND'S ORDER IS THE VOCABULARY'S, not the order money happened to arrive in. Groups
     reach the grid as events, so without this a team whose first record was a sponsor cheque would
     read Sponsorships · Player dues · Fundraising — a different statement every season. */
  const revenueRank = (c: GridCategoryResult) => {
    const group = revenueGroupOf(c.categoryKey);
    return group ? REVENUE_GROUPS.indexOf(group) : REVENUE_GROUPS.length;
  };
  const revenueGrid = {
    ...revenueGridRaw,
    categories: [...revenueGridRaw.categories].sort((a, b) => revenueRank(a) - revenueRank(b)),
  };

  /** Money to the cent, once — the whole file rounds the same way. */
  const r2 = (n: number) => Math.round(n * 100) / 100;

  /* ⚠⚠ CASH ON HAND, COMPUTED THE GRID'S OWN WAY. The Scheduled lens's running balance starts from
     TODAY'S REAL MONEY — a forward view projected from zero would be a work of fiction — and this
     is the same figure `check:money-report` holds equal to the register's `cashOnHand`. It is
     summed from the strip's month maps rather than from the bands, deliberately: the bands can
     truncate their columns, and a balance that quietly shrank with the window would be worse than
     no balance at all. */
  /* ⚠⚠ AND IT STARTS FROM WHAT THE SEASON WAS HANDED (mig 262, owner ruling 2026-08-23). The
     carried balance is not a movement — it is in no month, in no band and in no cash map — so it is
     added HERE, once, exactly where the register adds it. A season that carried nothing reads
     `null` and this is unchanged. */
  const openingBalance = programYear.openingBalance;
  /* ⚠ ONE EXTRA ROUND TRIP, AND ONLY WHERE THERE IS SOMETHING TO NAME. A season that carried
     nothing, or whose balance a coach typed in by hand, asks the database nothing at all. */
  const carriedFromSeason = openingBalance != null
    ? await getSeasonName(programYear.openingBalanceFromYearId)
    : null;
  const cashOnHand = r2(
    (openingBalance ?? 0)
    + Object.values(cashStrip.in).reduce((s, v) => s + v, 0)
    - Object.values(cashStrip.out).reduce((s, v) => s + v, 0));

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

  /* ⚠⚠ THE STRIP'S TWO "MONEY IN" BASE MAPS RETIRED HERE (Option D, owner ruling 2026-08-23).
     They existed because the strip was three rows the grid could not express: Money in, Money out,
     Running balance. The BAND TOTALS are those rows now — Total revenue IS money in — so a
     server-side map beside them would be the same fact computed twice, and the "same dollar two
     ways" defect this whole programme exists to remove. What the dues-only scheduled map used to
     hold is a REVENUE ROW on the Scheduled lens, where a coach can see which month it lands in. */

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
    monthlyChart,
    // Named so the chart can state what it is NOT plotting, rather than smearing it (D-H4).
    undatedBudget,
    /* ── chunk H, and since 2026-08-23 the season's cash statement (Option D) ──
       ⚠ `monthGrid` IS THE EXPENSES BAND. The name predates the second band and is kept because
       every reader — the screen, the export, `check:money-report` — already speaks it; renaming it
       would be a wide, silent rename on the portal's most-guarded payload for no reader's benefit.
       `revenueGrid` is its twin, built by the same function over the SAME months. */
    monthGrid,
    revenueGrid,
    cellDetails,
    /* ⚠⚠ THE MONTH-BY-MONTH CASH MAPS, SHIPPED FOR THE GUARD (`check:money-report` claim 5) rather
       than for the screen, which reads the bands. They are the strip's own bucketing before the
       grid places it, and holding BOTH equal to the register is two claims, not one: this map says
       the cash was DATED right, the band totals say the grid PLACED it. A single claim could not
       tell a mis-dated dollar from a dropped one. */
    cash: { in: cashStrip.in, out: cashStrip.out },
    /** Where the Scheduled lens's running balance starts — today's real money, proven by the guard. */
    cashOnHand,
    /* ⚠⚠ WHAT THE SEASON OPENED WITH (mig 262). **NULL IS NOT ZERO**: a season that carried nothing
       shows no opening row at all, and a season carried at exactly $0 shows one that says so. The
       screens read that difference, and `check:money-report`'s claim 6 reads this field by name —
       it used to be a hardcoded zero with a comment naming itself as the thing to change the day
       carry-forward shipped. This is that field, and the `?? 0` habit went with it. */
    openingBalance,
    /** The season it was carried FROM, named — the provenance the report's own row reads back. */
    openingBalanceFrom: carriedFromSeason,
    /* ⚠⚠ WHAT THE CASH VIEW LEFT OUT, so the STATEMENT can explain its own gap (owner ruling
       2026-08-24, Option A). The Statement counts a cost a family paid the vendor — the season
       really did incur it — and cash cannot, because no team money moved. Until now only Months
       said so, in a footnote; the Statement is the half that gets exported to a board, which is
       exactly where the question is asked and where nobody can ask a follow-up.
       ⚠ SOURCED FROM THE ARITHMETIC THAT EXCLUDED IT (), never re-derived here.
       A second copy of the exclusion rule is a second copy free to drift from the one that runs. */
    familyPaidCosts: cashStrip.excluded.map(e => ({
      id: e.id,
      description: e.description,
      categoryName: e.place.categoryName,
      itemId: e.place.itemId,
      amount: e.amount,
    })),
    todayMonth,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual' });
