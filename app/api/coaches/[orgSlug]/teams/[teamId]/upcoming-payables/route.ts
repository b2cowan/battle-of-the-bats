import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canViewMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday, addCalendarDays, daysBetweenDateStrings } from '@/lib/timezone';

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
    let duesQuery = supabaseAdmin
      .from('rep_player_dues_installments')
      .select('id, schedule_id, player_id, installment_number, amount, due_date, paid_at')
      .in('schedule_id', scheduleIds)
      .lte('due_date', cutoffStr)
      .order('due_date', { ascending: true });
    if (!includePaid) duesQuery = duesQuery.is('paid_at', null);
    const { data: installments } = await duesQuery;

    const playerIds = [...new Set((installments ?? []).map((i: any) => i.player_id).filter(Boolean))];
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

    duesItems = (installments ?? []).map((i: any) => {
      const pid = i.player_id ?? schedulePlayerMap.get(i.schedule_id);
      const d = daysUntil(i.due_date);
      return {
        id:          i.id,
        description: `Installment #${i.installment_number}`,
        amount:      Number(i.amount),
        dueDate:     i.due_date,
        daysUntilDue: d,
        overdue:     !i.paid_at && d < 0,
        paid:        !!i.paid_at,
        label:       pid ? (nameMap.get(pid) ?? null) : null,
      };
    });
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
      { id: 'org_payables',    title: 'Org Allocations Due', emptyMessage: 'No org allocation payments due.',         items: allocItems },
    ],
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/upcoming-payables' });
