import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === teamId)) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, programYear };
}

function daysUntil(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/upcoming-payables?days=90
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { team, programYear } = resolved;

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '90', 10), 1), 365);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

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
    const { data: installments } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('id, schedule_id, player_id, installment_number, amount, due_date')
      .in('schedule_id', scheduleIds)
      .is('paid_at', null)
      .lte('due_date', cutoffStr)
      .order('due_date', { ascending: true });

    const playerIds = [...new Set((installments ?? []).map((i: any) => i.player_id).filter(Boolean))];
    const nameMap = new Map<string, string>();

    if (playerIds.length > 0) {
      const { data: players } = await supabaseAdmin
        .from('rep_roster_players')
        .select('id, player_first_name, player_last_name')
        .in('id', playerIds);
      for (const p of players ?? []) {
        nameMap.set(p.id, `${p.player_first_name} ${p.player_last_name}`);
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
        overdue:     d < 0,
        label:       pid ? (nameMap.get(pid) ?? null) : null,
      };
    });
  }

  // ── Lane 2: team expenses (deposit + balance due dates) ──────────────────
  const { data: expenses } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('id, description, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at')
    .eq('team_id', teamId)
    .eq('program_year_id', programYear.id);

  const expenseItems: any[] = [];
  for (const e of expenses ?? []) {
    if (e.deposit_due_date && !e.deposit_paid_at && e.deposit_due_date <= cutoffStr && Number(e.deposit_amount) > 0) {
      const d = daysUntil(e.deposit_due_date);
      expenseItems.push({
        id:          `${e.id}-deposit`,
        description: `${e.description} — deposit`,
        amount:      Number(e.deposit_amount),
        dueDate:     e.deposit_due_date,
        daysUntilDue: d,
        overdue:     d < 0,
        label:       null,
      });
    }
    if (e.balance_due_date && !e.balance_paid_at && e.balance_due_date <= cutoffStr && Number(e.balance_amount) > 0) {
      const d = daysUntil(e.balance_due_date);
      expenseItems.push({
        id:          `${e.id}-balance`,
        description: `${e.description} — balance`,
        amount:      Number(e.balance_amount),
        dueDate:     e.balance_due_date,
        daysUntilDue: d,
        overdue:     d < 0,
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
    const { data: allocInst } = await supabaseAdmin
      .from('rep_allocation_installments')
      .select('id, split_id, installment_number, amount, due_date')
      .in('split_id', splitIds)
      .is('paid_at', null)
      .lte('due_date', cutoffStr)
      .order('due_date', { ascending: true });

    allocItems = (allocInst ?? []).map((i: any) => {
      const d = daysUntil(i.due_date);
      return {
        id:          i.id,
        description: splitDescMap.get(i.split_id) ?? 'Org allocation',
        amount:      Number(i.amount),
        dueDate:     i.due_date,
        daysUntilDue: d,
        overdue:     d < 0,
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
}
