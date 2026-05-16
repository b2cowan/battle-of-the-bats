import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

type Ctx = { params: Promise<{ lineId: string }> };

// POST /api/admin/accounting/budget-plan/lines/[lineId]/periods
// Full replace: deletes all existing periods for this line and inserts the new set.
// Send an empty array to clear all periods (revert line to lump sum).
// Body: { periods: [{ label, periodDate?, amount, sortOrder? }] }
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { lineId } = await params;

  // Verify the line belongs to this org
  const { data: line, error: fe } = await supabaseAdmin
    .from('org_budget_lines')
    .select('id, org_id, total_amount')
    .eq('id', lineId)
    .eq('org_id', ctx!.org.id)
    .maybeSingle();

  if (fe) return NextResponse.json({ error: fe.message }, { status: 500 });
  if (!line) return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });

  const body = await req.json();
  const rawPeriods = Array.isArray(body.periods) ? body.periods : [];

  // Validate each period
  for (let i = 0; i < rawPeriods.length; i++) {
    const p = rawPeriods[i];
    const label = typeof p.label === 'string' ? p.label.trim() : '';
    if (!label) {
      return NextResponse.json({ error: `Period ${i + 1}: label is required` }, { status: 400 });
    }
    const amount = Number(p.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: `Period ${i + 1}: amount must be a positive number` }, { status: 400 });
    }
  }

  // Replace all periods: delete existing, insert new
  const { error: de } = await supabaseAdmin
    .from('org_budget_periods')
    .delete()
    .eq('budget_line_id', lineId);

  if (de) return NextResponse.json({ error: de.message }, { status: 500 });

  if (rawPeriods.length === 0) {
    return NextResponse.json({ periods: [] });
  }

  const rows = rawPeriods.map((p: any, i: number) => ({
    budget_line_id: lineId,
    period_label:   String(p.label).trim(),
    period_date:    p.periodDate ?? null,
    amount:         Number(p.amount),
    sort_order:     p.sortOrder ?? i,
  }));

  const { data: inserted, error: ie } = await supabaseAdmin
    .from('org_budget_periods')
    .insert(rows)
    .select('id, budget_line_id, period_label, period_date, amount, sort_order');

  if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });

  const periods = (inserted ?? []).map((p: any) => ({
    id:         p.id,
    label:      p.period_label,
    periodDate: p.period_date,
    amount:     Number(p.amount),
    sortOrder:  p.sort_order,
  }));

  return NextResponse.json({ periods });
}
