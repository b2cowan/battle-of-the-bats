import { NextResponse } from 'next/server';
import {
  getRepTeamExpenses,
  getRepTeamMoneyIn,
  getRepPlayerDuesSchedules,
  getRepDuesPaymentsByProgramYear,
  getRepDuesCreditsByProgramYear,
  getRepDuesPayoutsByProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { orgDayKey } from '@/lib/timezone';
import { duesRemainingByInstallment } from '@/lib/coach-dues-remaining';
import { buildBook, REGISTER_SOURCE_LABEL, type RegisterRow } from '@/lib/coach-register';

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
 * ⛔ NOTHING PENDING A DECISION EVER APPEARS. An unapproved club request is money the club may
 * decline; putting it on the book — even as a projection — would let a coach plan around money that
 * does not exist. The standing "a pending request never enters the plan" ruling, applied here.
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
      .select('id, rep_cost_allocations ( description )')
      .eq('team_id', teamId)
      .eq('program_year_id', programYear.id),
    /* ⚠ SEASON-SCOPED AS OF MIGRATION 247. This used to be team-LIFETIME, which is precisely why a
       register scoped to the working season could not reproduce Cash on hand. */
    supabaseAdmin
      .from('rep_team_payment_requests')
      .select('id, request_type, amount, description, status, reviewed_at, created_at')
      .eq('team_id', teamId)
      .eq('program_year_id', programYear.id)
      .eq('status', 'approved'),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('program_year_id', programYear.id),
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
  const splits = (splitsRes.data ?? []) as unknown as Array<{ id: string; rep_cost_allocations: { description: string } | null }>;

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

    if (e.expenseType === 'tournament_payable') {
      /* A payable's halves are separate commitments with their own dates and their own paid state —
         they are two rows here exactly as they are two rows on the payment schedule. A blended
         entry would put money on the book on a day nothing moved. */
      const halves = [
        { half: 'deposit' as const, amount: e.depositAmount, due: e.depositDueDate, paidAt: e.depositPaidAt },
        { half: 'balance' as const, amount: e.balanceAmount, due: e.balanceDueDate, paidAt: e.balancePaidAt },
      ];
      for (const h of halves) {
        const amount = Number(h.amount ?? 0);
        if (!(amount > 0)) continue;
        rows.push({
          ...base,
          id: `expense-${e.id}-${h.half}`,
          date: h.paidAt ? orgDayKey(h.paidAt) : h.due,
          description: `${e.description} — ${h.half}`,
          moneyOut: amount,
          scheduled: !h.paidAt,
          // A payable is billed to the team by a third party — there is no out-of-pocket leg.
          movesCash: true,
          markPaid: h.paidAt ? null : { expenseId: e.id, half: h.half, amount },
          detail: h.paidAt ? null : h.due ? 'Due' : 'No date set',
        });
      }
      continue;
    }

    rows.push({
      ...base,
      id: `expense-${e.id}`,
      /* ⚠ AN UNPAID PLAIN EXPENSE HAS NO DATE AT ALL, and that is not an omission to paper over: a
         cost the coach logged without saying when it was paid is exactly what they came here to
         find. It sorts to the end of the scheduled block and carries Mark paid. */
      date: e.expensePaidAt ? orgDayKey(e.expensePaidAt) : null,
      description: e.description,
      moneyOut: e.amount,
      scheduled: !e.expensePaidAt,
      /* ⚠⚠ THE ONE ROW THAT DOES NOT MOVE THE BALANCE. A family paid the vendor direct: the season
         spent the money, the team's cash did not. `expenseTotals().cashPaid` has always excluded
         it — the book agrees with that figure rather than arguing with it. */
      movesCash: !e.paidByPlayerId,
      markPaid: e.expensePaidAt ? null : { expenseId: e.id, half: 'expense', amount: e.amount },
      detail: e.paidByPlayerId
        ? `${playerName.get(e.paidByPlayerId) ?? 'A family'} paid direct — no team cash moved`
        : e.expensePaidAt ? null : 'Not marked paid',
    });
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
      movesCash: true,
      open: { kind: 'money-in', id: m.id },
      markPaid: null,
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
    movesCash: true,
    open: { kind: 'workspace', section: 'dues' },
    /* ⚠ NEVER SETTLED FROM HERE, on any of the three. A dues instalment is marked paid by recording
       the family's PAYMENT on Player Dues — routing it through the money form would write a second,
       unlinked record of money the dues ledger has already accounted for. */
    markPaid: null,
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
      movesCash: true,
      open: { kind: 'workspace', section: 'fundraisers' },
      markPaid: null,
      sourceLabel: REGISTER_SOURCE_LABEL.fundraising,
      detail: realised ? 'Recorded on this date' : 'Pledged — not arrived yet',
    });
  }

  // ── Derived: the Club — what it billed, and what it settled ───────────────
  {
    const splitDesc = new Map(splits.map(s => [s.id, s.rep_cost_allocations?.description ?? 'Club allocation']));
    for (const i of (allocInstRes.data ?? []) as AllocationInstallmentRow[]) {
      rows.push({
        id: `allocation-${i.id}`,
        date: i.paid_at ? orgDayKey(i.paid_at) : i.due_date,
        kind: 'club',
        description: splitDesc.get(i.split_id) ?? 'Club allocation',
        categoryName: null,
        itemName: null,
        moneyOut: Number(i.amount ?? 0),
        moneyIn: 0,
        scheduled: !i.paid_at,
        movesCash: true,
        open: { kind: 'workspace', section: 'allocations' },
        /* ⚠ NO MARK PAID HERE, deliberately. An allocation is settled on the Club's own screen,
           against the club's ledger — routing it through the money form would create a second,
           unlinked record of money the club has already accounted for. */
        markPaid: null,
        sourceLabel: REGISTER_SOURCE_LABEL.club,
        detail: `Installment #${i.installment_number}`,
      });
    }
  }

  for (const r of (requestsRes.data ?? []) as Array<{ id: string; request_type: string; amount: number; description: string; reviewed_at: string | null; created_at: string }>) {
    const incoming = r.request_type === 'charge_to_org';
    const amount = Number(r.amount ?? 0);
    rows.push({
      id: `request-${r.id}`,
      // Approval posts the transfer, so an approved request is SETTLED on the day it was decided.
      date: orgDayKey(r.reviewed_at ?? r.created_at),
      kind: 'club',
      description: r.description,
      categoryName: null,
      itemName: null,
      moneyOut: incoming ? 0 : amount,
      moneyIn: incoming ? amount : 0,
      scheduled: false,
      movesCash: true,
      open: { kind: 'workspace', section: 'payment-requests' },
      markPaid: null,
      sourceLabel: REGISTER_SOURCE_LABEL.club,
      detail: incoming ? 'Approved by the club' : 'Paid to the club',
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
    for (const i of all) {
      /* ⚠ A PAID INSTALLMENT IS NOT A ROW HERE. Its money is already on the book as the PAYMENT that
         covered it (`rep_dues_payments`), and adding the installment as well would count the same
         dollar twice — the exact double-count the whole "one row, one source" rule exists to stop. */
      if (i.paidAt) continue;
      const owed = remaining.get(i.id) ?? i.amount;
      if (!(owed > 0.005)) continue;
      rows.push(duesRow({
        id: `dues-installment-${i.id}`, date: i.dueDate,
        description: `Installment #${i.installmentNumber}`,
        amount: owed, direction: 'in', scheduled: true, playerId: i.playerId,
      }));
    }
  }

  const book = buildBook(rows);
  return NextResponse.json({
    scheduled: book.scheduled,
    settled: book.settled,
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
