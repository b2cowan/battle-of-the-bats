import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepDuesCreditsByProgramYear,
  getRepDuesPayoutsByProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canViewMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday, addCalendarDays, daysBetweenDateStrings } from '@/lib/timezone';
import { duesRemainingByInstallment } from '@/lib/coach-dues-remaining';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// Calendar days in the ORG timezone. Deriving "today" from the runtime (UTC in production)
// made dues read a day sooner from ~8 PM Toronto — flagged overdue the evening before.
function daysUntil(dueDateStr: string): number {
  return daysBetweenDateStrings(tournamentToday(), dueDateStr);
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/upcoming-payables?days=90
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const url = new URL(req.url);
  // days=0 means "no window" — the full payment-schedule tab (chunk H) needs every commitment,
  // not the hub panel's 90-day preview. includePaid=1 additionally keeps settled rows, so the
  // schedule can offer Unpaid / Paid / All rather than only what is still owed.
  const daysParam = parseInt(url.searchParams.get('days') ?? '90', 10);
  const unbounded = daysParam === 0;
  const days = unbounded ? 0 : Math.min(Math.max(isNaN(daysParam) ? 90 : daysParam, 1), 365);
  const includePaid = url.searchParams.get('includePaid') === '1';

  const todayStr = tournamentToday();
  // A date string that sorts after every real due date — simpler and safer than branching every
  // comparison, and it keeps the window logic in exactly one shape.
  const cutoffStr = unbounded ? '9999-12-31' : addCalendarDays(todayStr, days);

  // ── Lane 1: player dues installments ────────────────────────────────────
  const { data: schedules } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, player_id')
    .eq('program_year_id', programYear.id);

  const scheduleIds = (schedules ?? []).map((s: any) => s.id);
  const schedulePlayerMap = new Map<string, string>(
    (schedules ?? []).map((s: any) => [s.id, s.player_id]),
  );

  let duesItems: any[] = [];
  if (scheduleIds.length > 0) {
    // ALL installments, not just the window: coverage (mig 232) is derived per player across the
    // whole schedule, so a windowed subset can't be allocated correctly. Window-filter after.
    const [{ data: installments }, { data: payRows }, seasonCredits, seasonPayouts] = await Promise.all([
      supabaseAdmin
        .from('rep_player_dues_installments')
        .select('id, schedule_id, player_id, installment_number, amount, due_date, paid_at')
        .in('schedule_id', scheduleIds)
        .order('due_date', { ascending: true }),
      supabaseAdmin
        .from('rep_dues_payments')
        .select('id, player_id, amount, received_date, created_at')
        .eq('program_year_id', programYear.id),
      getRepDuesCreditsByProgramYear(programYear.id),
      getRepDuesPayoutsByProgramYear(programYear.id),
    ]);
    /**
     * How much of each unpaid installment is already covered — by cash AND by credits (owner model
     * 2026-08-14): a bill fundraising covered is not coming due for anyone, and a partly-earned one
     * quotes only what is left to send.
     *
     * ⚠⚠ THE SHARED DERIVATION, NOT A SECOND COPY OF IT (money redesign P3, 2026-08-17). This was
     * ~28 lines of per-player grouping and `deriveDuesPosition` calls written out here, and the
     * register's scheduled overlay needed the identical answer. `lib/coach-dues-remaining.ts` was
     * extracted for both — and its own header warns that a second hand-written copy is "exactly how
     * the 'quote the face value' defect got shipped the first time." This route was that copy until
     * it was wired up. **The dues lane on the payment schedule and the dues rows on the register now
     * quote a family the same figure by construction, not by two authors agreeing.**
     */
    const remainingById = duesRemainingByInstallment({
      installments: (installments ?? []).map((i: any) => ({
        id: i.id,
        playerId: i.player_id ?? schedulePlayerMap.get(i.schedule_id) ?? '',
        installmentNumber: i.installment_number,
        amount: Number(i.amount),
        dueDate: i.due_date ?? null,
        paidAt: i.paid_at ?? null,
      })),
      payments: (payRows ?? []).map((p: any) => ({
        id: p.id, playerId: p.player_id, amount: Number(p.amount),
        receivedDate: p.received_date, createdAt: p.created_at,
      })),
      credits: seasonCredits,
      payouts: seasonPayouts,
      mode: programYear.creditApplication,
    });

    const windowed = (installments ?? []).filter((i: any) =>
      (i.due_date ?? '') <= cutoffStr && (includePaid || !i.paid_at));

    const playerIds = [...new Set(windowed.map((i: any) => i.player_id).filter(Boolean))];
    const nameMap = new Map<string, string>();

    if (playerIds.length > 0) {
      const { data: players } = await supabaseAdmin
        .from('rep_roster_players')
        .select('id, player_first_name, player_last_name')
        .in('id', playerIds);
      for (const p of players ?? []) {
        nameMap.set(p.id, [p.player_first_name, p.player_last_name].filter(Boolean).join(' '));
      }
    }

    duesItems = windowed.map((i: any) => {
      const pid = i.player_id ?? schedulePlayerMap.get(i.schedule_id);
      const d = daysUntil(i.due_date);
      // An open installment owes its REMAINDER, not its face value — a family $200 into a $300
      // installment has $100 coming due, and quoting $300 here was inventory row 12. A paid row
      // (includePaid) keeps its face value: that money was collected.
      const remaining = i.paid_at
        ? Number(i.amount)
        : (remainingById.get(i.id) ?? Number(i.amount));
      // ⚠ description/dueDate/amount double as a MERGE KEY: the Money Overview
      // ledger (MoneyNextThirtyDays) collapses dues rows that share all three
      // into one "Installment #N — X players" line. Personalizing description
      // per player (a discount note, a partial-payment marker) silently turns
      // that grouping into one-row-per-player again. A PART-PAID row leaving the
      // group via its smaller amount is deliberate — it genuinely differs, and it
      // keeps the player's name so the coach sees whose remainder it is.
      return {
        id:          i.id,
        description: `Installment #${i.installment_number}`,
        amount:      remaining,
        dueDate:     i.due_date,
        daysUntilDue: d,
        overdue:     !i.paid_at && d < 0,
        paid:        !!i.paid_at,
        label:       pid ? (nameMap.get(pid) ?? null) : null,
      };
    }).filter((i: any) => i.paid || i.amount > 0.005);
  }

  // ── Lane 2: team expenses (deposit + balance due dates) ──────────────────
  const { data: expenses } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('id, description, category, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at')
    .eq('team_id', teamId)
    .eq('program_year_id', programYear.id);

  const expenseItems: any[] = [];
  for (const e of expenses ?? []) {
    // A payable's deposit and balance are separate commitments with their own dates and their own
    // paid state — they belong on the schedule as separate rows, not as one blended entry.
    const halves: Array<{ suffix: string; amount: unknown; due: string | null; paidAt: string | null }> = [
      { suffix: 'deposit', amount: e.deposit_amount, due: e.deposit_due_date, paidAt: e.deposit_paid_at },
      { suffix: 'balance', amount: e.balance_amount, due: e.balance_due_date, paidAt: e.balance_paid_at },
    ];
    for (const h of halves) {
      if (!h.due || Number(h.amount) <= 0) continue;
      if (h.paidAt && !includePaid) continue;
      if (h.due > cutoffStr) continue;
      const d = daysUntil(h.due);
      expenseItems.push({
        id:          `${e.id}-${h.suffix}`,
        expenseId:   e.id,
        half:        h.suffix,
        description: `${e.description} — ${h.suffix}`,
        category:    e.category ?? null,
        amount:      Number(h.amount),
        dueDate:     h.due,
        daysUntilDue: d,
        overdue:     !h.paidAt && d < 0,
        paid:        !!h.paidAt,
        label:       null,
      });
    }
  }
  expenseItems.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  // ── Lane 3: org allocation installments ────────────────────────────────
  const { data: splits } = await supabaseAdmin
    .from('rep_allocation_splits')
    .select(`
      id,
      rep_cost_allocations ( description )
    `)
    .eq('team_id', teamId)
    .eq('org_id', team.orgId);

  const splitIds = (splits ?? []).map((s: any) => s.id);
  const splitDescMap = new Map<string, string>(
    (splits ?? []).map((s: any) => [s.id, (s.rep_cost_allocations as any)?.description ?? 'Org allocation']),
  );

  let allocItems: any[] = [];
  if (splitIds.length > 0) {
    let allocQuery = supabaseAdmin
      .from('rep_allocation_installments')
      .select('id, split_id, installment_number, amount, due_date, paid_at')
      .in('split_id', splitIds)
      .lte('due_date', cutoffStr)
      .order('due_date', { ascending: true });
    if (!includePaid) allocQuery = allocQuery.is('paid_at', null);
    const { data: allocInst } = await allocQuery;

    allocItems = (allocInst ?? []).map((i: any) => {
      const d = daysUntil(i.due_date);
      return {
        id:          i.id,
        description: splitDescMap.get(i.split_id) ?? 'Org allocation',
        amount:      Number(i.amount),
        dueDate:     i.due_date,
        daysUntilDue: d,
        overdue:     !i.paid_at && d < 0,
        paid:        !!i.paid_at,
        label:       `Installment #${i.installment_number}`,
      };
    });
  }

  return NextResponse.json({
    lanes: [
      { id: 'collections_due', title: 'Dues Coming Due',     emptyMessage: 'No player dues due in this window.',      items: duesItems },
      { id: 'team_payables',   title: 'Team Payables',       emptyMessage: 'No expense payments due in this window.', items: expenseItems },
      /* ⚠ "Club", not "Org" (owner ruling 2026-08-17, money redesign P4). This lane title survived
         the merge as the last coach-facing string still calling the relationship by the schema's
         word, on the Money Overview — one tab away from a tab now called Club. The lane `id` is
         DELIBERATELY unchanged: it is a wire value the Overview panel keys its rows on, and
         renaming it would be a silent behaviour change dressed as copy. */
      { id: 'org_payables',    title: 'Club Bills Due',      emptyMessage: 'Nothing owed to your club in this window.', items: allocItems },
    ],
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/upcoming-payables' });
