import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { readSalesReport } from '@/lib/sales-by-month-read';
import { isCalendarDate } from '@/lib/timezone';
import { withObservability } from '@/lib/observability';

/**
 * SALES BY MONTH'S READ (Plans & pricing Stage 2 Part 4d). Bookkeeping › Reports › View · Sales.
 *
 * ⚖ THE GATE COMES FIRST: the report reads every sale on the platform with the service role, so the Bookkeeping gate (the owner
 * allowlist, `requireBookkeepingApi`) runs before anything is read, exactly as the GST/HST return's route does. Read only: no
 * Stripe call, nothing stored (owner rulings 2026-11-06).
 */
const ROUTE = '/api/platform-admin/bookkeeping/sales';
const NO_STORE = { 'Cache-Control': 'no-store' };

export const GET = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const from = req.nextUrl.searchParams.get('from') ?? '';
  const to = req.nextUrl.searchParams.get('to') ?? '';
  if (!isCalendarDate(from) || !isCalendarDate(to)) return NextResponse.json({ error: 'Choose both dates for the sales.' }, { status: 400 });
  if (from > to) return NextResponse.json({ error: 'Choose a From date on or before the To date.' }, { status: 400 });
  try {
    return NextResponse.json(await readSalesReport({ from, to }), { headers: NO_STORE });
  } catch (err) {
    console.warn('[platform-admin] Sales by month failed:', (err as { code?: string }).code ?? 'error');
    return NextResponse.json({ error: 'Unable to work out the sales' }, { status: 500 });
  }
}, { route: ROUTE });
