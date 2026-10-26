import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { csvCell } from '@/lib/bookkeeping-expenses';
import { expenseCsv, ownerMovementCsv, parseExpenseFilters, selectExpenseRevisions, selectOwnerMovementRevisions } from '@/lib/bookkeeping-export';
import { getReceipt, hasOwnerMovementTable, headReceipt, listExpenseRevisions, listOwnerMovementRevisions } from '@/lib/bookkeeping-store';
import type { OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import { zipStream, type ZipEntry } from '@/lib/bookkeeping-zip';
import { withObservability } from '@/lib/observability';

export const runtime = 'nodejs';

export const GET = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const filters = parseExpenseFilters(req.nextUrl.searchParams);
  if (!filters) return NextResponse.json({ error: 'Invalid report period' }, { status: 400 });
  let revisions;
  let ownerRevisions: OwnerMovementRevision[] = [];
  let ownerSchemaReady = false;
  try {
    revisions = await listExpenseRevisions();
    ownerSchemaReady = await hasOwnerMovementTable();
    if (ownerSchemaReady) ownerRevisions = await listOwnerMovementRevisions();
  } catch { return NextResponse.json({ error: 'Unable to prepare accountant package' }, { status: 500 }); }
  if (revisions.length > 1000) return NextResponse.json({ error: 'Expense package needs pagination before more records can be included' }, { status: 503 });
  if (ownerRevisions.length > 1000) return NextResponse.json({ error: 'Owner transfer package needs pagination before more records can be included' }, { status: 503 });
  const selected = selectExpenseRevisions(revisions, filters);
  const selectedOwners = selectOwnerMovementRevisions(ownerRevisions, filters, selected);
  const documents = new Map<string, { filename: string; contentType: string }>();
  // Check every referenced object before starting the download. The ZIP itself fetches one file at a time.
  try {
    for (const row of selected) {
      if (!row.receipt_path || documents.has(row.receipt_path)) continue;
      const found = await headReceipt(row.receipt_path);
      if (found.size > 10 * 1024 * 1024) throw new Error('Receipt exceeds the upload limit');
      const extension = ({ 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' } as Record<string, string>)[found.contentType] ?? '.bin';
      documents.set(row.receipt_path, {
        filename: `receipts/${row.expense_id}/${row.receipt_path.split('/').at(-1)}${extension}`,
        contentType: found.contentType,
      });
    }
  } catch {
    return NextResponse.json({ error: 'A receipt is unavailable; the package was not created' }, { status: 503 });
  }
  const hashes = new Map<string, string>();
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    { name: 'expenses.csv', load: async () => encoder.encode(expenseCsv(selected, filters)) },
    { name: 'owner-transfers.csv', load: async () => encoder.encode(ownerMovementCsv(selectedOwners)) },
    { name: 'package-scope.txt', load: async () => encoder.encode([
      'FieldLogicHQ private proprietor bookkeeping package',
      `Expense revisions: ${selected.length}; owner transfer revisions: ${selectedOwners.length}; receipt files: ${documents.size}.`,
      `Period: ${filters.from || 'any start'} to ${filters.to || 'any end'}. Expenses use incurred date; owner transfers use transfer date.`,
      'Legacy expense dates with unknown meaning may appear outside the selected period and are labelled in expenses.csv.',
      'Expense filters apply to expenses.csv. If an expense category, supplier, payment source, search or review filter is selected, owner-transfers.csv includes only reimbursements linked to those expenses.',
      ownerSchemaReady ? 'Owner transfer history is included where records match the scope.' : 'Owner transfer storage is not present in this environment; owner-transfers.csv has a header only.',
      'Bank statements, Stripe income, processor fees, refunds, payouts and bank reconciliation are not in this package.',
      'A source reference is owner-entered text and is not a bank statement.',
    ].join('\r\n') + '\r\n') },
  ];
  for (const [path, document] of documents) {
    entries.push({ name: document.filename, load: async () => {
      const file = await getReceipt(path);
      hashes.set(path, createHash('sha256').update(file.bytes).digest('hex'));
      return file.bytes;
    } });
  }
  entries.push({ name: 'receipt-index.csv', load: async () => {
    const lines = [['expense_id', 'revision', 'original_receipt_name', 'package_file', 'sha256', 'content_type'].map(csvCell).join(',')];
    for (const row of selected) {
      const path = row.receipt_path;
      const document = path ? documents.get(path) : null;
      lines.push([
        row.expense_id, row.revision, row.receipt_name,
        document?.filename ?? '', path ? hashes.get(path) : '', document?.contentType ?? '',
      ].map(csvCell).join(','));
    }
    return encoder.encode('\uFEFF' + lines.join('\r\n') + '\r\n');
  } });
  return new Response(zipStream(entries), { headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="fieldlogichq-accountant-package.zip"',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}, { route: '/api/platform-admin/bookkeeping/package' });
