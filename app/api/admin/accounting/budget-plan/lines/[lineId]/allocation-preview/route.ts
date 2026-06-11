import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

type Ctx = { params: Promise<{ lineId: string }> };

// GET /api/admin/accounting/budget-plan/lines/[lineId]/allocation-preview
// ?teamIds=id1,id2&splitMethod=equal|percentage|fixed
// &splits=JSON (array of { teamId, splitMethod, value } for per-team config)
// Read-only: returns the computed per-team amounts before the treasurer confirms.
export const GET = withObservability(async (req: Request, { params }: Ctx) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { lineId } = await params;
  const url = new URL(req.url);

  const { data: line, error: le } = await supabaseAdmin
    .from('org_budget_lines')
    .select('id, org_id, description, total_amount, season_year, budget_categories(name)')
    .eq('id', lineId)
    .eq('org_id', ctx!.org.id)
    .maybeSingle();

  if (le) return NextResponse.json({ error: le.message }, { status: 500 });
  if (!line) return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });

  // Periods for this line (for installment date inheritance)
  const { data: periods } = await supabaseAdmin
    .from('org_budget_periods')
    .select('id, period_label, period_date, amount, sort_order')
    .eq('budget_line_id', lineId)
    .order('sort_order')
    .order('period_date', { nullsFirst: false });

  // Parse splits from query param
  let splits: Array<{ teamId: string; splitMethod: string; value: number; amount?: number }> = [];
  try {
    const raw = url.searchParams.get('splits');
    if (raw) splits = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid splits parameter' }, { status: 400 });
  }

  if (splits.length === 0) {
    return NextResponse.json({ line, periods: periods ?? [], preview: [] });
  }

  // Fetch team names
  const teamIds = splits.map(s => s.teamId);
  const { data: teams } = await supabaseAdmin
    .from('rep_teams')
    .select('id, name')
    .in('id', teamIds)
    .eq('org_id', ctx!.org.id);

  const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t.name]));
  const total = Number(line.total_amount);

  const preview = splits.map(s => {
    let amount = s.amount ?? 0;
    if (s.splitMethod === 'equal') {
      amount = parseFloat((total / splits.length).toFixed(2));
    } else if (s.splitMethod === 'percentage') {
      amount = parseFloat((total * s.value / 100).toFixed(2));
    } else {
      // fixed: amount comes directly from the split
      amount = s.amount ?? s.value ?? 0;
    }
    return {
      teamId:   s.teamId,
      teamName: teamMap.get(s.teamId) ?? s.teamId,
      amount,
    };
  });

  return NextResponse.json({ line, periods: periods ?? [], preview });
}, { route: '/api/admin/accounting/budget-plan/lines/[lineId]/allocation-preview' });
