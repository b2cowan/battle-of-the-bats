import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { getReceipt, receiptReference } from '@/lib/bookkeeping-store';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ expenseId: string; revision: string }> }) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const { expenseId, revision } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(expenseId) || !/^[1-9]\d*$/.test(revision)) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }
  let found;
  try { found = await receiptReference(expenseId, Number(revision)); }
  catch { return NextResponse.json({ error: 'Unable to load receipt' }, { status: 500 }); }
  if (!found?.receipt_path) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  let file;
  try { file = await getReceipt(found.receipt_path); }
  catch { return NextResponse.json({ error: 'Unable to retrieve receipt' }, { status: 500 }); }
  const safeName = (found.receipt_name ?? 'receipt').replace(/[^\x20-\x7e]|["\\]/g, '_');
  return new NextResponse(new Uint8Array(file.bytes), { headers: {
    'Content-Type': file.contentType,
    'Content-Disposition': `attachment; filename="${safeName}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}, { route: '/api/platform-admin/bookkeeping/receipt/[expenseId]/[revision]' });
