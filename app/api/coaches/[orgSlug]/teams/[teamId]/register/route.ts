import { NextResponse } from 'next/server';
import {
  getRepTeamExpenses,
  getRepTeamMoneyIn,
  getRepPlayerDuesSchedules,
  getRepDuesPaymentsByProgramYear,
  getRepDuesCreditsByProgramYear,
  getRepDuesPayoutsByProgramYear,
  getCommitmentStandings,
} from '@/lib/db';
import { installmentLabel, paymentLabel } from '@/lib/payable-standing';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { orgDayKey, tournamentToday, daysBetweenDateStrings } from '@/lib/timezone';
import { duesRemainingByInstallment } from '@/lib/coach-dues-remaining';
import { buildBook, REGISTER_SOURCE_LABEL, formatMoney, type RegisterRow } from '@/lib/coach-register';

/**
 * GET /api/coaches/[orgSlug]/teams/[teamId]/register — the season's whole book.
 *
 * ⚠⚠ EVERY MOVEMENT OF CASH ON HAND, AND NOTHING ELSE. The register's headline rule is that the
 * balance at Today IS Cash on hand (plan §4.2), which only holds if this route emits exactly the
 * records `money-summary` counts — no more, no fewer. **The two are a matched pair: a source added
 * to one and not the other breaks the identity silently**, because both figures still look
 * plausible. When you touch either, read the other.
 *
 * Working season only — no `?year=` here or anywhere near it
 * (`tests/unit/coach-history-endpoint-guard.test.ts` is the contract).
 *
 * ⚖⚖ **THIS FILE USED TO SAY "NOTHING PENDING A DECISION EVER APPEARS." THAT IS NO LONGER TRUE, and
 * the change is an owner ruling (2026-08-17, money redesign P4), recorded here rather than quietly
 * edited away.** A club request awaiting an answer now appears in the FORWARD view — never on the
 * settled book, never in Cash on hand, never in the Budget Plan, never on the report. The argument
 * that overturned it was that this book already carries a sponsor PLEDGE in the same view, and a
 * pledge a sponsor may not honour is the same species of uncertainty as a request a club may
 * decline. The full reasoning sits on the loop that emits the row.
 *
 * 🔒 The rule that survives intact: **nothing undecided may touch a settled figure.** The identity
 * above is an identity at TODAY, and everything projected sits strictly beyond it.
 */
/** The two instalment shapes the second wave reads, named so the query and its consumer agree. */
type AllocationInstallmentRow = {
  id: string; split_id: string; installment_number: number;
  amount: number; due_date: string | null; paid_at: string | null;
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

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const [
    expenses,
    moneyIn,
    duesPayments,
    duesCredits,
    duesPayouts,
    schedules,
    fundraiserRes,
    splitsRes,
    requestsRes,
    rosterRes,
    standings,
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
       columns it reads, so "realised" cannot mean two things. */
    supabaseAdmin
      .from('rep_fundraiser_entries')
      .select('id, amount_raised, created_at, rep_fundraisers!inner(name, kind, sponsor_status, program_year_id)')
      .eq('rep_fundraisers.program_year_id', programYear.id),
    supabaseAdmin
      .from('rep_allocation_splits')
      .select('id, budget_item_id, budget_category_id, rep_cost_allocations ( description )')
      .eq('team_id', teamId)
      .eq('program_year_id', programYear.id),
    /* ⚠ SEASON-SCOPED AS OF MIGRATION 247. This used to be team-LIFETIME, which is precisely why a
       register scoped to the working season could not reproduce Cash on hand.
       ⚠⚠ AND NO LONGER `.eq('status','approved')` (owner ruling 2026-08-17): a PENDING request now
       reaches the forward view, so the filter moved into the loop below — where it also drops a
       DECLINED one, which belongs on neither half of this book. Filtering here instead would make
       "which statuses does the register admit?" a fact split across two places. */
    supabaseAdmin
      .from('rep_team_payment_requests')
      .select('id, request_type, amount, description, status, budget_item_id, budget_category_id, reviewed_at, created_at')
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
  const splits = (splitsRes.data ?? []) as unknown as Array<{
    id: string; budget_item_id: string | null; budget_category_id: string | null;
    rep_cost_allocations: { description: string } | null;
  }>;
  const clubRequests = (requestsRes.data ?? []) as Array<{
    id: string; request_type: string; amount: number; description: string; status: string;
    budget_item_id: string | null; budget_category_id: string | null;
    reviewed_at: string | null; created_at: string;
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
    splits.length > 0
      ? supabaseAdmin
          .from('rep_allocation_installments')
          .select('id, split_id, installment_number, amount, due_date, paid_at')
          .in('split_id', splits.map(s => s.id))
      : EMPTY<AllocationInstallmentRow>(),
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
      sourceLabel: null,
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
      rows.push({
        ...base,
        id: `expense-${e.id}-payment-${p.id}`,
        date: p.paidDate,
        description: paymentLabel(e.description, p, count),
        moneyOut: p.amount,
        scheduled: false,
        overdueDays: null, // tagged for real below, once every row exists
        /* ⚠⚠ THE ONE ROW THAT DOES NOT MOVE THE BALANCE. A family paid the vendor direct: the
           season spent the money, the team's cash did not. `expenseTotals().cashPaid` has always
           excluded it — the book agrees with that figure rather than arguing with it. A payable is
           billed to the team by a third party, so it never has an out-of-pocket leg. */
        movesCash: !e.paidByPlayerId,
        recordPayment: null,
        detail: e.paidByPlayerId
          ? `${playerName.get(e.paidByPlayerId) ?? 'A family'} paid direct — no team cash moved`
          : null,
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
      sourceLabel: null,
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
   */
  const duesRow = (r: {
    id: string; date: string | null; description: string;
    amount: number; direction: 'in' | 'out'; scheduled: boolean; playerId: string;
  }): RegisterRow => ({
    id: r.id,
    date: r.date,
    kind: 'dues',
    description: r.description,
    categoryName: null,
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
    sourceLabel: REGISTER_SOURCE_LABEL.dues,
    detail: playerName.get(r.playerId) ?? null,
  });

  for (const p of duesPayments) {
    rows.push(duesRow({
      id: `dues-payment-${p.id}`, date: p.receivedDate, description: 'Dues payment',
      amount: p.amount, direction: 'in', scheduled: false, playerId: p.playerId,
    }));
  }
  for (const p of duesPayouts) {
    /* Money handed BACK to a family is real money out (mig 234) and lowers Cash on hand. It was
       missing from the register's own design note; without it the balance is off by every payout
       the team has made. */
    rows.push(duesRow({
      id: `dues-payout-${p.id}`, date: p.paidDate, description: 'Paid back to a family',
      amount: p.amount, direction: 'out', scheduled: false, playerId: p.playerId,
    }));
  }

  // ── Derived: Fundraising — drives and sponsors ────────────────────────────
  type FundraiserEntryRow = {
    id: string; amount_raised: number; created_at: string;
    rep_fundraisers: { name: string; kind: string | null; sponsor_status: string | null } | null;
  };
  for (const raw of (fundraiserRes.data ?? []) as unknown as FundraiserEntryRow[]) {
    const parent = raw.rep_fundraisers;
    if (!parent) continue;
    const isSponsor = parent.kind === 'sponsor';
    // A drive's money is realised as recorded; a sponsor's is realised only once it has ARRIVED.
    const realised = !isSponsor || parent.sponsor_status === 'received';
    const amount = Number(raw.amount_raised ?? 0);
    if (!(amount > 0)) continue;
    rows.push({
      id: `fundraiser-${raw.id}`,
      /* ⚠ A FUNDRAISING ENTRY HAS NO DATE COLUMN — `rep_fundraiser_entries` carries only
         `created_at`. So the book dates it by the day the coach recorded it, and the row says so
         rather than letting a reader assume it is the day the money changed hands. A PLEDGE has no
         date at all: it has not arrived, and nothing records when it is expected. */
      date: realised ? orgDayKey(raw.created_at) : null,
      kind: 'fundraising',
      description: parent.name,
      categoryName: null,
      itemName: null,
      moneyOut: 0,
      moneyIn: amount,
      scheduled: !realised,
      overdueDays: null, // a pledge has no due date to be overdue against
      movesCash: true,
      open: { kind: 'workspace', section: 'fundraisers' },
      recordPayment: null,
      sourceLabel: REGISTER_SOURCE_LABEL.fundraising,
      detail: realised ? 'Recorded on this date' : 'Pledged — not arrived yet',
    });
  }

  // ── Derived: the Club — what it billed, and what it settled ───────────────
  {
    const splitById = new Map(splits.map(s => [s.id, s]));
    for (const i of (allocInstRes.data ?? []) as AllocationInstallmentRow[]) {
      const split = splitById.get(i.split_id);
      rows.push({
        id: `allocation-${i.id}`,
        date: i.paid_at ? orgDayKey(i.paid_at) : i.due_date,
        kind: 'club',
        description: split?.rep_cost_allocations?.description ?? 'Club allocation',
        /* ⚠ THE FILING IS THE SPLIT'S, NOT THE INSTALMENT'S. One bill, one classification — the
           instalments are its payment schedule, and four instalments carrying four answers is
           exactly what filing on the split prevents. */
        categoryName: split?.budget_category_id ? catName.get(split.budget_category_id) ?? null : null,
        itemName: split?.budget_item_id ? itemName.get(split.budget_item_id) ?? null : null,
        moneyOut: Number(i.amount ?? 0),
        moneyIn: 0,
        scheduled: !i.paid_at,
        overdueDays: null, // tagged for real below, once every row exists
        movesCash: true,
        open: { kind: 'workspace', section: 'club' },
        /* ⚠ NO MARK PAID HERE, deliberately. An allocation is settled on the Club's own screen,
           against the club's ledger — routing it through the money form would create a second,
           unlinked record of money the club has already accounted for. */
        recordPayment: null,
        sourceLabel: REGISTER_SOURCE_LABEL.club,
        detail: `Installment #${i.installment_number}`,
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
      sourceLabel: REGISTER_SOURCE_LABEL.club,
      detail: pending
        ? 'Awaiting the club — they may still decline it'
        : incoming ? 'Approved by the club' : 'Paid to the club',
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
        }));
        continue;
      }
      rows.push({
        id: `dues-installment-group-${g.installmentNumber}-${g.dueDate ?? 'undated'}`,
        date: g.dueDate,
        kind: 'dues',
        description: `Installment #${g.installmentNumber}`,
        categoryName: null,
        itemName: null,
        moneyOut: 0,
        moneyIn: g.amount,
        scheduled: true,
        overdueDays: null, // tagged for real below, once every row exists
        movesCash: true,
        open: { kind: 'workspace', section: 'dues' },
        recordPayment: null,
        sourceLabel: REGISTER_SOURCE_LABEL.dues,
        detail: `${g.ids.length} families outstanding`,
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

  const book = buildBook(taggedRows);
  return NextResponse.json({
    book: book.book,
    todayIndex: book.todayIndex,
    cashOnHand: book.cashOnHand,
    projectedBalance: book.projectedBalance,
    // The filter strip drops its "from Club" option on a standalone team workspace — an option that
    // can never match anything is a dead control, not a reassurance.
    orgLinked: !isTeamWorkspaceOrg(ctx.org),
    /* ⚠ NO `readOnly` FIELD, deliberately. A finished season renders every money surface as a
       record, but the screen already knows that from the season page context and gates every write
       affordance on it — a second answer travelling down with the data would be one more thing that
       can disagree with the first, on the question of whether a coach may change anything. */
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/register' });
