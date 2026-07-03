import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

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
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

interface PeriodInput {
  periodLabel: string;
  periodDate?: string | null;
  amount: number;
}

// POST /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]/periods
// Full replace of periods for a budget line.
// Sending an empty array clears all periods (reverts to lump-sum).
// Amounts are validated to sum to the line's total_amount (±$0.02 rounding tolerance).
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; lineId: string }> },) => {
  const { orgSlug, teamId, lineId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Verify line belongs to this program year
  const { data: line, error: lineErr } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('id, total_amount')
    .eq('id', lineId)
    .eq('program_year_id', programYear.id)
    .single();

  if (lineErr || !line) {
    return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
  }

  const body = await req.json();
  const periods: PeriodInput[] = Array.isArray(body.periods) ? body.periods : [];

  if (periods.length > 0) {
    // Each period must have a label and a positive amount
    for (const p of periods) {
      if (!p.periodLabel?.trim()) {
        return NextResponse.json({ error: 'Each period must have a periodLabel' }, { status: 400 });
      }
      if (typeof p.amount !== 'number' || p.amount <= 0) {
        return NextResponse.json({ error: 'Each period amount must be a positive number' }, { status: 400 });
      }
    }

    const sumAmounts = periods.reduce((s, p) => s + p.amount, 0);
    const lineTotal  = line.total_amount as number;
    if (Math.abs(sumAmounts - lineTotal) > 0.02) {
      return NextResponse.json(
        { error: `Period amounts (${sumAmounts.toFixed(2)}) must sum to the line total (${lineTotal.toFixed(2)})` },
        { status: 400 },
      );
    }
  }

  // Delete existing periods then insert new ones in one transaction
  const { error: delErr } = await supabaseAdmin
    .from('rep_budget_periods')
    .delete()
    .eq('budget_line_id', lineId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (periods.length === 0) {
    return NextResponse.json({ periods: [] });
  }

  const rows = periods.map((p, i) => ({
    budget_line_id: lineId,
    period_label:   p.periodLabel.trim(),
    period_date:    p.periodDate || null,
    amount:         p.amount,
    sort_order:     i,
  }));

  const { data, error: insErr } = await supabaseAdmin
    .from('rep_budget_periods')
    .insert(rows)
    .select();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ periods: data }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]/periods' });
