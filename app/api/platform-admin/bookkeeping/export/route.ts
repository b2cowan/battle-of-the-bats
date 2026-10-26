import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { expenseCsv, parseExpenseFilters, selectExpenseRevisions } from '@/lib/bookkeeping-export';
import { listExpenseRevisions } from '@/lib/bookkeeping-store';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const filters = parseExpenseFilters(req.nextUrl.searchParams);
  if (!filters) return NextResponse.json({ error: 'Invalid report period' }, { status: 400 });
  let revisions;
  try { revisions = await listExpenseRevisions(); }
  catch { return NextResponse.json({ error: 'Unable to export expenses' }, { status: 500 }); }
  if (revisions.length > 1000) return NextResponse.json({ error: 'Expense export needs pagination before more records can be included' }, { status: 503 });
  return new NextResponse(expenseCsv(selectExpenseRevisions(revisions, filters), filters), { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="fieldlogichq-expenses.csv"',
    'Cache-Control': 'private, no-store',
  } });
}, { route: '/api/platform-admin/bookkeeping/export' });
