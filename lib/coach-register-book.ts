import 'server-only';
import { getSeasonClubBills } from './coach-club-bills';
import {
  getRepTeamExpenses,
  getRepTeamMoneyIn,
  getRepPlayerDuesSchedules,
  getRepDuesPaymentsByProgramYear,
  getRepDuesCreditsByProgramYear,
  getRepDuesPayoutsByProgramYear,
  getCommitmentStandings,
} from './db';
import { effectivePayerId, installmentLabel, paymentLabel } from './payable-standing';
import { supabaseAdmin } from './supabase-admin';
import { orgDayKey, tournamentToday, daysBetweenDateStrings } from './timezone';
import { duesRemainingByInstallment } from './coach-dues-remaining';
import { cashOnHandCents, REGISTER_SOURCE_LABEL, formatMoney, toCents, type RegisterRow } from './coach-register';
import { incomeCategoryFor } from './coach-cash-strip';
import { PAYOUT_CATEGORY_NAME, revenueGroupLabel } from './coach-budget-months';
import { joinNames } from './practice-plan-send';
import { clubInstallmentLeftTeamOn, clubInstallmentWaitingOnClub } from './club-money-figures';
import { howItCame } from './club-money-words';
import type { RepProgramYear } from './types';

/**
 * THE SEASON'S BOOK, ASSEMBLED — every dated movement of a team's cash, and nothing else.
 *
 * ⚠⚠ THIS WAS THE /register ROUTE'S OWN BODY UNTIL 2026-08-25, and it moved for one reason: a
 * SECOND caller appeared that must not be allowed to answer differently. `Start next season` carries
 * the closing season's cash forward into the new season's opening balance (mig 262), and the figure
 * it writes is PERMANENT — a coach corrects it afterwards only by hand. Computing it from anything
 * other than the register's own walk would have meant a fourth arithmetic for one question, on the
 * single occasion where being wrong is written to the database rather than merely displayed.
 *
 * ⚠ THE ROUTE IS NOW A THIN CALLER and keeps every one of its own rules: auth, the money
 * capability, the workspace's filter strip, and `buildBook`. Nothing about WHICH RECORDS ARE CASH
 * moved — the inclusions, the exclusions and the dating fallbacks below are byte-for-byte what the
 * route carried, comments included, because `check:register` proves them and a rewrite on the way
 * past would have been a change nobody asked for inside a build that already changes plenty.
 *
 * ⚠⚠ AND IT REMAINS A MATCHED PAIR WITH `money-summary`. The register's headline rule is that the
 * balance at Today IS Cash on hand, which only holds while this list and that route's category
 * totals count exactly the same records — no more, no fewer. When you touch either, read the other.
 * `scripts/check-register-balance.mjs` is what makes a mistake loud instead of plausible.
 *
 * Working season only — no `?year=` here or anywhere near it
 * (`tests/unit/coach-history-endpoint-guard.test.ts` is the contract).
 */

/** The two instalment shapes the second wave reads, named so the query and its consumer agree. */
type AllocationInstallmentRow = {
  id: string; split_id: string; installment_number: number;
  amount: number; due_date: string | null; paid_at: string | null;
  sent_at: string | null; sent_on: string | null; paid_on: string | null;
  sent_method: string | null; sent_reference: string | null; paid_method: string | null; paid_reference: string | null;
};
type DuesInstallmentRow = {
  id: string; schedule_id: string; player_id: string | null; installment_number: number;
  amount: number; due_date: string | null; paid_at: string | null;
};

/**
 * The Record-a-payment door a still-owing piece offers (Payables Rebuild P2).
 *
 * ⚖ EVERY UNSETTLED PIECE OFFERS IT — the old half-based door could not express a part-paid piece
 * or a commitment with more than two pieces, so those rows offered no button at all. A payment is
 * its own record now, so the door opens pre-aimed at this piece (the coach's override, R3) with the
 * piece's REMAINDER as the suggested figure — never its face value on a part-paid one.
 */
function recordPaymentAction(
  expenseId: string,
  inst: { id: string; remaining: number },
): RegisterRow['recordPayment'] {
  return { expenseId, installmentId: inst.id, amount: inst.remaining };
}

/**
 * Every row of one season's book, each unsettled piece already tagged with how overdue it is.
 */
export async function loadSeasonRegisterRows(
  programYear: Pick<RepProgramYear, 'id' | 'creditApplication'>,
  teamId: string,
): Promise<RegisterRow[]> {
  const [
    expenses,
    moneyIn,
    duesPayments,
    duesCredits,
    duesPayouts,
    schedules,
    fundraiserRes,
    sponsorRecordRes,
    splitsRes,
    requestsRes,
    rosterRes,
    standings,
    shelvesRes,
  ] = await Promise.all([
    getRepTeamExpenses(programYear.id),
    getRepTeamMoneyIn(programYear.id),
    getRepDuesPaymentsByProgramYear(programYear.id),
    getRepDuesCreditsByProgramYear(programYear.id),
    getRepDuesPayoutsByProgramYear(programYear.id),
    getRepPlayerDuesSchedules(programYear.id),
    /* ⚠ THE ENTRY'S OWN QUERY, not `getSeasonFundraiserEntries`. That reader deliberately returns
       only what a TOTAL needs; a dated book needs the day the money was booked and the drive's name,
       and neither is in its shape. Filtering by kind/status is done here from the same parent
       columns it reads, so "realised" cannot mean two things.
       ⚠ `player_id` and the parent's budget line ride along for the row's WORDS only — who handed a
       drive's money in, and the Category / Item the record is raising for (mig 285). Neither
       decides whether a row is cash. */
    supabaseAdmin
      .from('rep_fundraiser_entries')
      .select('id, fundraiser_id, player_id, amount_raised, created_at, received_date, method, rep_fundraisers!inner(name, kind, sponsor_status, program_year_id, budget_item_id, budget_category_id)')
      .eq('rep_fundraisers.program_year_id', programYear.id),
    /* ⚠ The PLEDGE line reads the RECORD, not entries (mig 268) — a pledged sponsor has no
       entries at all, and a part-paid one's outstanding promise is pledged minus arrived. */
    supabaseAdmin
      .from('rep_fundraisers')
      .select('id, name, pledged_amount, created_at, budget_item_id, budget_category_id')
      .eq('program_year_id', programYear.id)
      .eq('kind', 'sponsor'),
    /* ⚖ CLUB TIER STAGE 3c, S3C-11 (owner 2026-10-07, call 1): the season's CLUB BILLS through the one reader
       every coach cash read shares (`getSeasonClubBills`, lib/coach-club-bills.ts) — this season's bills still
       owed, and every club payment carried by this season (recorded while it ran), whichever season's bill it
       paid. A payment of an earlier bill made after that season closed lands HERE, never in the closed season. */
    getSeasonClubBills(teamId, programYear.id),
    /* ⚠ SEASON-SCOPED AS OF MIGRATION 247. This used to be team-LIFETIME, which is precisely why a
       register scoped to the working season could not reproduce Cash on hand.
       ⚠⚠ AND NO LONGER `.eq('status','approved')` (owner ruling 2026-08-17): a PENDING request now
       reaches the forward view, so the filter moved into the loop below — where it also drops a
       DECLINED one, which belongs on neither half of this book. Filtering here instead would make
       "which statuses does the register admit?" a fact split across two places. */
    supabaseAdmin
      .from('rep_team_payment_requests')
      .select('id, request_type, amount, description, status, budget_item_id, budget_category_id, reviewed_at, created_at, payment_method, paid_method, paid_reference')
      .eq('team_id', teamId)
      .eq('program_year_id', programYear.id),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('program_year_id', programYear.id),
    /* Where every commitment stands — its plan, its payments, and what that adds up to. ⚠ ONE read
       for the whole season, and it rides THIS wave because it depends on nothing but the year: a
       per-commitment fetch on the heaviest read in the portal is exactly what this route's own
       comments about serialisation are written about. */
    getCommitmentStandings(programYear.id),
    /* The platform's two money-in shelves — where a drive or sponsor that names no line files
       (owner ruling 2026-09-09, "the category is the shelf"). Budget vs. Actual reads the same rows
       for the same fallback; this book used to print "—" for every fundraising row instead. */
    supabaseAdmin
      .from('budget_categories')
      .select('id, name, income_source')
      .is('org_id', null)
      .in('income_source', ['fundraiser', 'sponsor']),
  ]);

  const rows: RegisterRow[] = [];

  // ── The budget's words, for the two columns that file a row ────────────────
  // Expenses store ids and no names (their money-in sibling joins them on read), so one lookup
  // covers both rather than each half inventing its own — the divergence `RepTeamMoneyIn`'s own
  // comment records having already happened once.
  const itemIds = new Set<string>();
  const categoryIds = new Set<string>();
  for (const e of expenses) {
    if (e.budgetItemId) itemIds.add(e.budgetItemId);
    if (e.budgetCategoryId) categoryIds.add(e.budgetCategoryId);
  }
  const splits = splitsRes.map(b => ({
    id: b.id, budget_item_id: b.budgetItemId, budget_category_id: b.budgetCategoryId,
    rep_cost_allocations: { description: b.allocationDescription } as { description: string } | null,
  }));
  const clubRequests = (requestsRes.data ?? []) as Array<{
    id: string; request_type: string; amount: number; description: string; status: string;
    budget_item_id: string | null; budget_category_id: string | null;
    reviewed_at: string | null; created_at: string;
    payment_method: string | null; paid_method: string | null; paid_reference: string | null;
  }>;
  /* ⚠ CLUB MONEY FILES ITSELF NOW (mig 250, money redesign P4). These two columns were the reason
     club rows on this book had a blank Category and Item — and, one screen over, the reason NO club
     money reached Budget vs. Actual at all. They join the SAME name lookup as the expenses rather
     than growing a third: a row is a row, and two ways of turning an item id into a word is how the
     two halves of a table start disagreeing. */
  for (const s of splits) {
    if (s.budget_item_id) itemIds.add(s.budget_item_id);
    if (s.budget_category_id) categoryIds.add(s.budget_category_id);
  }
  for (const r of clubRequests) {
    if (r.budget_item_id) itemIds.add(r.budget_item_id);
    if (r.budget_category_id) categoryIds.add(r.budget_category_id);
  }
  /* ⚠ FUNDRAISING FILES ITSELF TOO (mig 285) — the line a drive or sponsor is RAISING FOR joins the
     same lookup, for the same reason club money does: one way of turning an id into a word. */
  type FundraisingLine = { budget_item_id: string | null; budget_category_id: string | null };
  type FundraiserEntryRow = {
    id: string; fundraiser_id: string; player_id: string | null; amount_raised: number;
    created_at: string; received_date: string | null; method: string | null;
    rep_fundraisers: (FundraisingLine & { name: string; kind: string | null; sponsor_status: string | null }) | null;
  };
  type SponsorRecordRow = FundraisingLine & {
    id: string; name: string; pledged_amount: number | string | null; created_at: string;
  };
  const fundraiserEntries = (fundraiserRes.data ?? []) as unknown as FundraiserEntryRow[];
  const sponsorRecords = (sponsorRecordRes.data ?? []) as unknown as SponsorRecordRow[];
  for (const line of [...fundraiserEntries.map(e => e.rep_fundraisers), ...sponsorRecords]) {
    if (line?.budget_item_id) itemIds.add(line.budget_item_id);
    if (line?.budget_category_id) categoryIds.add(line.budget_category_id);
  }

  /**
   * ⚠ THE SECOND WAVE IS ONE WAVE. All four of these depend on the FIRST wave and on nothing from
   * each other — the two name lookups need `expenses`, the club instalments need `splitsRes`, the
   * dues instalments need `schedules`. Written as three separate `if` blocks they awaited in
   * sequence, so an ordinary mid-season team (budget items AND a club allocation AND a live dues
   * schedule) paid four sequential round trips where two do. This is the heaviest read on the
   * screen; it should not also be the most serialised.
   *
   * Each leg resolves to an empty payload rather than being skipped, so the tuple keeps one shape
   * and the destructuring below never has to test for `null`.
   */
  const EMPTY = <T,>() => Promise.resolve({ data: [] as T[] });
  const [itemsRes, catsRes, allocInstRes, duesInstRes] = await Promise.all([
    itemIds.size > 0
      ? supabaseAdmin.from('budget_items').select('id, name').in('id', [...itemIds])
      : EMPTY<{ id: string; name: string }>(),
    categoryIds.size > 0
      ? supabaseAdmin.from('budget_categories').select('id, name').in('id', [...categoryIds])
      : EMPTY<{ id: string; name: string }>(),
    // The installments this season reads came with its bills (one reader, call 1) — in the row shape below.
    Promise.resolve({
      data: splitsRes.flatMap(b => b.installments.map((i): AllocationInstallmentRow => ({
        id: i.id, split_id: b.id, installment_number: i.installmentNumber, amount: i.amount, due_date: i.dueDate,
        paid_at: i.paidAt, sent_at: i.sentAt, sent_on: i.sentOn, paid_on: i.paidOn,
        sent_method: i.sentMethod, sent_reference: i.sentReference, paid_method: i.paidMethod, paid_reference: i.paidReference,
      }))),
    }),
    schedules.length > 0
      ? supabaseAdmin
          .from('rep_player_dues_installments')
          .select('id, schedule_id, player_id, installment_number, amount, due_date, paid_at')
          .in('schedule_id', schedules.map(s => s.id))
      : EMPTY<DuesInstallmentRow>(),
  ]);
  const itemName = new Map((itemsRes.data ?? []).map((i: { id: string; name: string }) => [i.id, i.name]));
  const catName = new Map((catsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

  const playerName = new Map(
    (rosterRes.data ?? []).map((p: { id: string; player_first_name: string; player_last_name: string | null }) =>
      [p.id, [p.player_first_name, p.player_last_name].filter(Boolean).join(' ')]),
  );

  // ── Recorded: costs and commitment halves ──────────────────────────────────
  for (const e of expenses) {
    const category = e.budgetCategoryId ? catName.get(e.budgetCategoryId) ?? null : (e.category ?? null);
    const item = e.budgetItemId ? itemName.get(e.budgetItemId) ?? null : null;
    const base = {
      kind: 'expense' as const,
      categoryName: category,
      itemName: item,
      moneyIn: 0,
      open: { kind: 'expense' as const, id: e.id },
    };

    /* ⚠⚠ A COMMITMENT IS ITS PAYMENTS AND WHAT IS STILL OWED — never a single blended row
       (Payables Rebuild P1, mig 255). What each row is has not changed; what has changed is that a
       commitment is no longer limited to two of them, and that a PART payment finally has somewhere
       to appear. Two kinds of row come out of one commitment:
         · RECORDED — one per payment, dated the day the money actually left. §41 Part D holds: a
           settled piece leaves exactly ONE transaction on the book and no second row beside it,
           which is what the running balance depends on.
         · SCHEDULED — one per piece with something still owing, dated when it falls due, carrying
           the REMAINDER rather than the face value. A $450 piece with $200 against it shows $250
           still to pay and a $200 movement on the day it moved, which is the pair of facts the old
           boolean could not express at all. */
    const standing = standings[e.id];
    const count = standing?.installments.length ?? 0;

    for (const p of standing?.payments ?? []) {
      /* ⚠⚠ THE PAYER IS THIS PAYMENT'S, NOT THE COST'S (money centralization P4, mig 267). Both
         lines below read `e.paidByPlayerId` until P4, which was a complete answer while a cost was
         fronted or it was not. A commitment can now hold a $200 deposit a parent paid direct and a
         $400 balance the team paid — and asking at cost level got BOTH rows wrong: the whole bill
         counted as team cash, or none of it did. This book's running balance IS cash on hand
         (`scripts/check-register-balance.mjs` guards exactly that claim), so getting it wrong here
         is the register disagreeing with the bank. */
      const payer = effectivePayerId(p, e.paidByPlayerId);
      rows.push({
        ...base,
        id: `expense-${e.id}-payment-${p.id}`,
        date: p.paidDate,
        description: paymentLabel(e.description, p, count),
        moneyOut: p.amount,
        scheduled: false,
        overdueDays: null, // tagged for real below, once every row exists
        /* ⚠⚠ THE ONE ROW THAT DOES NOT MOVE THE BALANCE. A family paid the vendor direct: the
           season spent the money, the team's cash did not. `expenseTotals().cashPaid` excludes the
           same payments — the book agrees with that figure rather than arguing with it. */
        movesCash: !payer,
        recordPayment: null,
        /* ⚠ THE ROW SAYS THE CASH FACT ONCE (owner, §132 walk 2026-09-02). This line used to end
           "— no team cash moved" while the `No team cash` CHIP sat three words to its left on the
           same row, saying it again; the chip is the scannable half and this is the half that
           names WHO, which the chip cannot. They render together and always have (the chip and
           `detail` are adjacent in the register's own row markup), so the tail was never carrying
           the fact anywhere the chip was absent. */
        detail: payer
          ? `${playerName.get(payer) ?? 'A family'} paid direct`
          : null,
        paidByName: payer ? (playerName.get(payer) ?? null) : null,
      });
    }

    for (const inst of standing?.installments ?? []) {
      if (inst.remaining <= 0.005) continue;
      const partly = inst.state === 'partly_paid';
      const payable = e.expenseType === 'tournament_payable';
      rows.push({
        ...base,
        id: `expense-${e.id}-installment-${inst.id}`,
        /* ⚠ AN UNPAID PLAIN EXPENSE HAS NO DATE ON THIS BOOK, and that is not an omission to paper
           over: a cost the coach logged without saying when it was paid is exactly what they came
           here to find, and it sorts to the end of the scheduled block. R1 gives every commitment a
           due date so that nothing can hide from the payment schedule — but the day a cost was
           TYPED UP is not a day it is due, and printing it here would invent an obligation. */
        date: payable ? inst.dueDate : null,
        description: installmentLabel(e.description, inst.installmentNumber, count),
        moneyOut: inst.remaining,
        scheduled: true,
        overdueDays: null, // tagged for real below, once every row exists
        /* ⚠ COST-LEVEL HERE, DELIBERATELY, AND IT IS NOT THE P4 OVERSIGHT IT LOOKS LIKE. A
           SCHEDULED row is money that has not moved, so no payment exists to carry a payer yet.
           The cost's own answer is the only fact available and it is the right one: a bill a family
           has undertaken to front will not move team cash when it is recorded either. */
        movesCash: !e.paidByPlayerId,
        recordPayment: recordPaymentAction(e.id, inst),
        detail: partly
          ? `${formatMoney(inst.applied)} of ${formatMoney(inst.amount)} paid`
          : payable ? 'Due' : 'Not marked paid',
      });
    }

    /* ⚠ A COMMITMENT WITH NOTHING AT ALL RECORDED still has to appear — R1 guarantees it has a
       plan, so the loop above covers it. This is the one case that cannot: a record whose
       installments were somehow never written. It is emitted rather than silently dropped, because
       a cost missing from the book is the failure this screen exists to make impossible. */
    if (!standing) {
      rows.push({
        ...base,
        id: `expense-${e.id}`,
        date: null,
        description: e.description,
        moneyOut: e.amount,
        scheduled: true,
        overdueDays: null,
        movesCash: !e.paidByPlayerId,
        recordPayment: null,
        detail: 'No payment schedule recorded',
      });
    }
  }

  // ── Recorded: arrivals (income and money back) ─────────────────────────────
  for (const m of moneyIn) {
    rows.push({
      id: `money-in-${m.id}`,
      date: m.receivedDate,
      /* The register is where the word "Money in" finally retires (plan §10 P1's deferred rename):
         income and money back are two filters here, so each heading is true of its own rows. */
      kind: m.kind === 'money_back' ? 'refund' : 'income',
      description: m.description?.trim() || m.budgetItemName || (m.kind === 'money_back' ? 'Money back' : 'Income'),
      categoryName: m.budgetCategoryName,
      itemName: m.budgetItemName,
      moneyOut: 0,
      moneyIn: m.amount,
      scheduled: false,
      overdueDays: null,
      movesCash: true,
      open: { kind: 'money-in', id: m.id },
      recordPayment: null,
      detail: null,
    });
  }

  // ── Derived: Player Dues, both directions and both tenses ─────────────────
  /**
   * ONE SHAPE FOR EVERY DUES ROW — a payment in, a payout back, an instalment still to come.
   *
   * ⚠ EIGHT OF THIRTEEN FIELDS WERE IDENTICAL IN THREE HAND-WRITTEN COPIES, with nothing to keep
   * them in step. Where a dues row LINKS TO, what it is CALLED in its chip, and whether it can be
   * settled here are properties of the workspace, not of the individual row — so a change to any of
   * them (a second dues section, a different chip, a Mark paid that dues rows one day earn) had to
   * be made three times correctly or the book would show three subtly different kinds of dues row.
   *
   * ⚠ THE CATEGORY IS THE SHELF THE MONTHS GRID PUTS IT ON — never a dash (owner, 2026-09-30).
   * Dues are a SCHEDULE, never a budget line, so no row here has a category it was filed in; but a
   * dash in that column means "nobody filed this" on a bill, and a dues payment is not unfiled.
   * Money in reads the grid's own revenue group ("Player dues"); a payout reads the returned band's
   * group ("Dues credits paid out"), the same phrase the report uses. ITEM STAYS EMPTY: there is no
   * word in the library to name, and an invented one ("Installment #2") would become an Item-filter
   * option that matches nothing on any other screen.
   */
  const duesCategoryName = (direction: 'in' | 'out', scheduled: boolean) =>
    direction === 'out' ? PAYOUT_CATEGORY_NAME : revenueGroupLabel('dues', scheduled ? 'scheduled' : 'actual');
  const duesRow = (r: {
    id: string; date: string | null; description: string;
    amount: number; direction: 'in' | 'out'; scheduled: boolean; playerId: string;
    origin: 'dues-payment' | 'dues-payout' | 'dues-installment'; method?: string | null;
  }): RegisterRow => ({
    id: r.id,
    date: r.date,
    kind: 'dues',
    description: r.description,
    categoryName: duesCategoryName(r.direction, r.scheduled),
    itemName: null,
    moneyOut: r.direction === 'out' ? r.amount : 0,
    moneyIn: r.direction === 'in' ? r.amount : 0,
    scheduled: r.scheduled,
    overdueDays: null, // tagged for real below, once every row exists
    movesCash: true,
    open: { kind: 'workspace', section: 'dues' },
    /* ⚠ NEVER SETTLED FROM HERE, on any of the three. A dues instalment is marked paid by recording
       the family's PAYMENT on Player Dues — routing it through the money form would write a second,
       unlinked record of money the dues ledger has already accounted for. */
    recordPayment: null,
    detail: playerName.get(r.playerId) ?? null,
    playerName: playerName.get(r.playerId) ?? null,
    origin: r.origin,
    paidHow: howItCame(r.method, null),
  });

  for (const p of duesPayments) {
    rows.push(duesRow({
      id: `dues-payment-${p.id}`, date: p.receivedDate, description: 'Dues payment',
      amount: p.amount, direction: 'in', scheduled: false, playerId: p.playerId,
      origin: 'dues-payment', method: p.method,
    }));
  }
  for (const p of duesPayouts) {
    /* Money handed BACK to a family is real money out (mig 234) and lowers Cash on hand. It was
       missing from the register's own design note; without it the balance is off by every payout
       the team has made. */
    rows.push(duesRow({
      id: `dues-payout-${p.id}`, date: p.paidDate, description: 'Paid back to a family',
      amount: p.amount, direction: 'out', scheduled: false, playerId: p.playerId,
      origin: 'dues-payout', method: p.method,
    }));
  }

  // ── Derived: Fundraising — drives and sponsors ────────────────────────────
  /**
   * Where a drive's or sponsor's money files — the Category and Item columns.
   *
   * ⚠⚠ THE SAME ANSWER BUDGET vs. ACTUAL GIVES (owner ruling 2026-09-09, "the category is the shelf,
   * on every surface"). This book printed "—" in both columns for every fundraising row until
   * 2026-09-30 — it predated mig 285's raising-for link and was missed when the ruling went across
   * the reports — so the Item filter could never find a sponsorship. The line the record names, else
   * its kind's platform shelf through `incomeCategoryFor`, the one rule the cash strip and the
   * Months pledge rows read.
   * ⚠ A record naming no line shows its shelf and NO item. Budget vs. Actual's "Sponsor money" is a
   * report bucket, not a budget item; written here it would become a word in the Item filter that
   * no record is filed under. "Raising for" counts only when the item still resolves, exactly as
   * that report's `raisingForByRecord` does — a deleted item falls to the shelf there too.
   */
  const shelfFor = (source: 'fundraiser' | 'sponsor') => {
    const c = ((shelvesRes.data ?? []) as Array<{ id: string; name: string; income_source: string }>)
      .find(s => s.income_source === source);
    return c ? { categoryId: c.id, categoryName: c.name } : null;
  };
  const shelves = { fundraising: shelfFor('fundraiser'), sponsorship: shelfFor('sponsor') };
  const fundraisingFiling = (line: FundraisingLine, source: 'fundraiser' | 'sponsor') => {
    const item = line.budget_item_id ? itemName.get(line.budget_item_id) ?? null : null;
    const raisingFor = item && line.budget_category_id
      ? { categoryId: line.budget_category_id, categoryName: catName.get(line.budget_category_id) ?? null }
      : null;
    return {
      categoryName: incomeCategoryFor(raisingFor, source, shelves).categoryName,
      itemName: raisingFor ? item : null,
    };
  };
  /**
   * The families each sponsor cheque CREDITED, by arrival — one cheque can credit several (Q16).
   * Read from the credits themselves rather than the credit plan: a share accrues per cheque, so
   * the credit rows are what actually happened on THIS arrival.
   */
  const creditedByArrival = new Map<string, string[]>();
  for (const c of duesCredits) {
    if (!c.fundraiserEntryId || !c.playerId) continue;
    const ids = creditedByArrival.get(c.fundraiserEntryId) ?? [];
    if (!ids.includes(c.playerId)) ids.push(c.playerId);
    creditedByArrival.set(c.fundraiserEntryId, ids);
  }
  const namesOf = (ids: readonly (string | null)[]) =>
    ids.map(id => (id ? playerName.get(id) : undefined)).filter((n): n is string => !!n);

  const arrivedBySponsor = new Map<string, number>();
  for (const raw of fundraiserEntries) {
    const parent = raw.rep_fundraisers;
    if (!parent) continue;
    const isSponsor = parent.kind === 'sponsor';
    // ⚠ Since mig 268 an entry IS money that arrived — a pledge has no entries. The belt stays:
    // an unrealised row, if one ever exists again, must never read as cash.
    const realised = !isSponsor || parent.sponsor_status === 'received';
    if (!realised) continue;
    const amount = Number(raw.amount_raised ?? 0);
    if (!(amount > 0)) continue;
    if (isSponsor) {
      arrivedBySponsor.set(raw.fundraiser_id, (arrivedBySponsor.get(raw.fundraiser_id) ?? 0) + amount);
    }
    /* ⚠⚠ WHO THE ROW IS ABOUT, AND THE NAME MEANS A DIFFERENT THING ON EACH KIND (owner, 2026-09-30).
       A drive's row is one player's hand-in, so the bare name reads exactly as it does on a dues
       payment: who brought the money in. A sponsor's cheque came from the SPONSOR — the family is
       who it CREDITED — so the bare "· Isla Cowan" a dues row wears would claim her family wrote the
       cheque; it says "credited to" instead. A whole-team hand-in names nobody. The credit's AMOUNT
       is never shown: it lowers a family's dues and moves no team cash, and a figure on a cash book
       reads as money leaving (the rebate-is-a-note ruling, 2026-08-24). */
    const names = isSponsor ? namesOf(creditedByArrival.get(raw.id) ?? []) : namesOf([raw.player_id]);
    const who = names.length === 0 ? null : isSponsor ? `credited to ${joinNames(names)}` : names[0];
    rows.push({
      id: `fundraiser-${raw.id}`,
      /* ⚠ THE DAY THE MONEY ARRIVED when the record knows it (mig 261/268 — sponsor arrivals
         always carry it; owner ruling 2026-08-23: logged late still lands in its period), and
         the day the coach RECORDED it for legacy drive rows, which carry only `created_at` —
         the row's detail flags ONLY that second case (see below). */
      date: raw.received_date ?? orgDayKey(raw.created_at),
      kind: 'fundraising',
      description: parent.name,
      ...fundraisingFiling(parent, isSponsor ? 'sponsor' : 'fundraiser'),
      moneyOut: 0,
      moneyIn: amount,
      scheduled: false,
      overdueDays: null,
      movesCash: true,
      open: { kind: 'workspace', section: 'fundraisers' },
      recordPayment: null,
      /* ⚠⚠ THE EXCEPTION SPEAKS; THE NORMAL CASE DOES NOT (owner ruling 2026-09-02, §132 walk:
         *"what's the point of these 'the day the money arrived' notes?"*). This printed on BOTH
         branches, so an ordinary drive entry announced the very thing every other row on this book
         does silently — dues payments, bills, club money and payouts are all dated the day money
         moved and none of them says so, which made fundraising look like a special case it is not,
         three rows running on a team with a normal season.
         ⚠ THE LEGACY FLAG STAYS, and it is the half that was always carrying information: a row
         dated when the coach typed it in, rather than when the money came, is quietly different
         from its neighbours and nothing else on the row reveals that. Pre-mig-261 drive entries
         only; the set shrinks to nothing on its own. */
      detail: [who, raw.received_date ? null : 'Recorded on this date'].filter(Boolean).join(' · ') || null,
      playerName: names.length > 0 ? names.join(', ') : null,
      origin: isSponsor ? 'sponsor' : 'drive',
      paidHow: howItCame(raw.method, null),
      ...(raw.received_date ? {} : { datedWhenRecorded: true }),
    });
  }
  /* The PLEDGE line — what a sponsor has promised and not sent, read from the record itself
     (mig 268). No date: it has not arrived, and nothing records when it is expected (Q13 owns
     that). A part-paid pledge shows only what is STILL to come, beside its arrivals above.
     ⚠ It names no family: credits accrue per CHEQUE, so a promise has credited nobody yet. */
  for (const s of sponsorRecords) {
    const pledged = s.pledged_amount != null ? Number(s.pledged_amount) : 0;
    const remaining = Math.max(0, Math.round((pledged - (arrivedBySponsor.get(s.id) ?? 0)) * 100) / 100);
    if (!(remaining > 0.005)) continue;
    rows.push({
      id: `sponsor-pledge-${s.id}`,
      date: null,
      kind: 'fundraising',
      description: s.name,
      // The promise files where its cash will land — Budget vs. Actual's pledge rows do the same.
      ...fundraisingFiling(s, 'sponsor'),
      moneyOut: 0,
      moneyIn: remaining,
      scheduled: true,
      overdueDays: null, // a pledge has no due date to be overdue against
      movesCash: true,
      open: { kind: 'workspace', section: 'fundraisers' },
      recordPayment: null,
      detail: 'Pledged — not arrived yet',
      origin: 'pledge',
    });
  }

  // ── Derived: the Club — what it billed, and what it settled ───────────────
  {
    const splitById = new Map(splits.map(s => [s.id, s]));
    for (const i of (allocInstRes.data ?? []) as AllocationInstallmentRow[]) {
      const split = splitById.get(i.split_id);
      /* ⚖ THE TEAM'S SIDE OF A CLUB BILL (Stage 3a, question 1): money left the team the day the coach
         SENT it, whether or not the club has confirmed — one rule, `clubInstallmentLeftTeamOn`, that
         money-summary, the settlement pot and the cash band read too, so Cash on hand and this book
         agree to the cent. A pre-3a payment has no sent day and dates by its stamp, as before. */
      const facts = { paidAt: i.paid_at, sentAt: i.sent_at, sentOn: i.sent_on, paidOn: i.paid_on };
      const leftOn = clubInstallmentLeftTeamOn(facts);
      const waiting = clubInstallmentWaitingOnClub(facts);
      rows.push({
        id: `allocation-${i.id}`,
        date: leftOn ?? i.due_date,
        kind: 'club',
        description: split?.rep_cost_allocations?.description ?? 'Club allocation',
        /* ⚠ THE FILING IS THE SPLIT'S, NOT THE INSTALMENT'S. One bill, one classification — the
           instalments are its payment schedule, and four instalments carrying four answers is
           exactly what filing on the split prevents. */
        categoryName: split?.budget_category_id ? catName.get(split.budget_category_id) ?? null : null,
        itemName: split?.budget_item_id ? itemName.get(split.budget_item_id) ?? null : null,
        moneyOut: Number(i.amount ?? 0),
        moneyIn: 0,
        scheduled: !leftOn,
        overdueDays: null, // tagged for real below, once every row exists
        movesCash: true,
        open: { kind: 'workspace', section: 'club' },
        /* ⚠ NO MARK PAID HERE, deliberately. An allocation is settled on the Club's own screen,
           against the club's ledger — routing it through the money form would create a second,
           unlinked record of money the club has already accounted for. */
        recordPayment: null,
        /* The waiting words ride the row as its CHIP (`waitingOnClub`, specimen 7: "Sent · waiting for the
           club"), so the detail stays the installment's number. */
        detail: `Installment #${i.installment_number}`,
        ...(waiting ? { waitingOnClub: true } : {}),
        origin: 'club-installment',
        installmentNumber: i.installment_number,
        paidHow: howItCame(i.sent_method, i.sent_reference) ?? howItCame(i.paid_method, i.paid_reference),
      });
    }
  }

  /**
   * ⚖⚖ A REQUEST THE CLUB HAS NOT ANSWERED NOW APPEARS HERE, IN THE FORWARD VIEW ONLY (owner ruling
   * 2026-08-17, money redesign P4). This REVERSES the plan's own §4.4 *"⛔ never qualifies: anything
   * pending a decision"*, and the reversal is the owner's, argued from what this book already does:
   *
   *   the forward view **already carries a sponsor PLEDGE** — money that may never arrive at all,
   *   ruled in by P3's own review — so a pledge a sponsor may not honour and a request the club may
   *   decline are the same species of uncertainty. The distinction was not one the screen could
   *   defend, and the switch is called *include what's scheduled*: a coach planning wants to see
   *   what they have asked for.
   *
   * 🔒 WHAT DOES NOT CHANGE, AND IS STILL LOAD-BEARING: a pending request touches **no settled
   * balance, no Cash on hand, no Budget Plan and no report**. `scheduled: true` is what keeps it
   * strictly past the Today rule — this file's headline identity is an identity AT TODAY, and the
   * overlay runs beyond it. `check:register` is the proof: it fails if a projection leaks into the
   * settled close.
   *
   * ⚠ NO DATE, AND THAT IS HONEST RATHER THAN MISSING. Nothing records when a club will answer. The
   * book already sorts a dateless forward row to the END of the scheduled block and prints *No
   * date* — the rule an undated unpaid expense follows — so a pending request lands last and its
   * amount still reaches the forward total.
   *
   * ⚠ NO MARK PAID: a coach cannot settle a request the club has not agreed to.
   *
   * ⚠ A DECLINED REQUEST APPEARS NOWHERE, on or off. It is not money that moved and not money that
   * might; it is a closed conversation, and its home is the Club tab's record.
   */
  for (const r of clubRequests) {
    if (r.status !== 'approved' && r.status !== 'pending') continue;
    const pending = r.status === 'pending';
    const incoming = r.request_type === 'charge_to_org';
    const amount = Number(r.amount ?? 0);
    rows.push({
      id: `request-${r.id}`,
      // Approval posts the transfer, so an approved request is SETTLED on the day it was decided.
      date: pending ? null : orgDayKey(r.reviewed_at ?? r.created_at),
      kind: 'club',
      description: r.description,
      categoryName: r.budget_category_id ? catName.get(r.budget_category_id) ?? null : null,
      itemName: r.budget_item_id ? itemName.get(r.budget_item_id) ?? null : null,
      moneyOut: incoming ? 0 : amount,
      moneyIn: incoming ? amount : 0,
      scheduled: pending,
      overdueDays: null, // tagged for real below, once every row exists
      movesCash: true,
      open: { kind: 'workspace', section: 'club' },
      recordPayment: null,
      detail: pending
        ? 'Awaiting the club — they may still decline it'
        : incoming ? 'Approved by the club' : 'Paid to the club',
      origin: 'club-request',
      paidHow: howItCame(r.paid_method, r.paid_reference) ?? howItCame(r.payment_method, null),
    });
  }

  // ── Scheduled: dues still to come ─────────────────────────────────────────
  {
    const scheduleOwner = new Map(schedules.map(s => [s.id, s.playerId]));
    const all = ((duesInstRes.data ?? []) as DuesInstallmentRow[])
      .map(i => ({
        id: i.id,
        playerId: i.player_id ?? scheduleOwner.get(i.schedule_id) ?? '',
        installmentNumber: i.installment_number,
        amount: Number(i.amount ?? 0),
        dueDate: i.due_date,
        paidAt: i.paid_at,
      }));
    /* ⚠ THE REMAINDER, NEVER THE FACE VALUE — the shared derivation, so this screen and the payment
       schedule quote a family the same figure. A family $200 into a $300 installment has $100
       coming, and credits fundraising already earned lower it further. */
    const remaining = duesRemainingByInstallment({
      installments: all,
      payments: duesPayments.map(p => ({
        id: p.id, playerId: p.playerId, amount: p.amount, receivedDate: p.receivedDate, createdAt: p.createdAt,
      })),
      credits: duesCredits,
      payouts: duesPayouts,
      mode: programYear.creditApplication,
    });
    /* ⚠⚠ GROUPED BY INSTALLMENT, NOT ONE ROW PER FAMILY (owner call, 2026-08-19). A team-wide
       payment schedule mints the SAME installment number and due date for every player on it, so
       "Installment #2" used to repeat once per family still owing it — seven near-identical rows
       reading as seven different things when they were one bill with seven answers still open.
       Grouped by (installment number, due date): a family owing it alone still gets its own row
       (nothing changes for the common case), and two or more collapse into ONE row naming how
       many are outstanding, not who — the destination link already goes to the Dues tab in
       general, never to one family, so nothing about WHERE this goes is lost by grouping. */
    const installmentGroups = new Map<string, {
      installmentNumber: number; dueDate: string | null; amount: number; ids: string[]; playerId: string;
    }>();
    for (const i of all) {
      /* ⚠ A PAID INSTALLMENT IS NOT A ROW HERE. Its money is already on the book as the PAYMENT that
         covered it (`rep_dues_payments`), and adding the installment as well would count the same
         dollar twice — the exact double-count the whole "one row, one source" rule exists to stop. */
      if (i.paidAt) continue;
      const owed = remaining.get(i.id) ?? i.amount;
      if (!(owed > 0.005)) continue;
      const key = `${i.installmentNumber}::${i.dueDate ?? ''}`;
      const g = installmentGroups.get(key)
        ?? { installmentNumber: i.installmentNumber, dueDate: i.dueDate, amount: 0, ids: [], playerId: i.playerId };
      g.amount += owed;
      g.ids.push(i.id);
      installmentGroups.set(key, g);
    }
    for (const g of installmentGroups.values()) {
      if (g.ids.length === 1) {
        rows.push(duesRow({
          id: `dues-installment-${g.ids[0]}`, date: g.dueDate,
          description: `Installment #${g.installmentNumber}`,
          amount: g.amount, direction: 'in', scheduled: true, playerId: g.playerId,
          origin: 'dues-installment',
        }));
        continue;
      }
      rows.push({
        id: `dues-installment-group-${g.installmentNumber}-${g.dueDate ?? 'undated'}`,
        date: g.dueDate,
        kind: 'dues',
        description: `Installment #${g.installmentNumber}`,
        categoryName: duesCategoryName('in', true),
        itemName: null,
        moneyOut: 0,
        moneyIn: g.amount,
        scheduled: true,
        overdueDays: null, // tagged for real below, once every row exists
        movesCash: true,
        open: { kind: 'workspace', section: 'dues' },
        recordPayment: null,
        detail: `${g.ids.length} families outstanding`,
        origin: 'dues-installment',
      });
    }
  }

  /* ⚠⚠ OVERDUE IS COMPUTED HERE, ONCE, AGAINST THE ORG'S OWN "TODAY" — never inside
     `coach-register.ts`, which stays pure and takes it as a fact on the row (reading-order
     ruling, follow-up to P3). Every row above pushed a `null` placeholder; this is where it
     becomes real. Same `tournamentToday`/`daysBetweenDateStrings` pair the payables routes
     already use, so "overdue" reads the same everywhere in the portal — deriving it from the
     runtime clock instead flags things overdue a day early after ~8 PM Toronto, the exact bug
     those routes were fixed for once already. */
  const todayKey = tournamentToday();
  const taggedRows: RegisterRow[] = rows.map(r => ({
    ...r,
    overdueDays: r.scheduled && r.date !== null && r.date < todayKey
      ? daysBetweenDateStrings(r.date, todayKey)
      : null,
  }));

  return taggedRows;
}

/**
 * What this season would close at if it ended right now, in integer cents.
 *
 * ⚠⚠ THE FIGURE `Start next season` CARRIES FORWARD, computed here rather than trusted from the
 * browser. The dialog shows a coach a number; the server writes one. If those could differ — a
 * stale tab, a payment recorded in another window, a hand-edited request — the season that starts
 * would open on a balance the team never had, and nothing downstream could tell.
 *
 * ⚠ IT IS THE SAME `cashOnHandCents` THE REGISTER AND `money-summary` USE. One arithmetic, three
 * callers, and `check:register` holds the first two equal on every run.
 */
export async function seasonClosingCashCents(
  programYear: Pick<RepProgramYear, 'id' | 'creditApplication' | 'openingBalance'>,
  teamId: string,
): Promise<number> {
  const rows = await loadSeasonRegisterRows(programYear, teamId);
  /* ⚠ THE CLOSING SEASON'S OWN CARRY IS PART OF WHAT IT CLOSES WITH. A team that carried $500 in
     and neither spent nor received a dollar still has $500 to hand on; starting this sum at zero
     would quietly lose the carry, one season per year, forever. */
  return cashOnHandCents(rows, toCents(programYear.openingBalance ?? 0));
}
