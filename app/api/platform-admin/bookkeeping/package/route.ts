import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { expenseCsv, ownerMovementCsv, packageCsv, parseExpenseFilters, selectExpenseRevisions, selectOwnerMovementRevisions } from '@/lib/bookkeeping-export';
import { getReceipt, gstRegistrationDate, hasOwnerMovementTable, headReceipt, listExpenseRevisions, listOwnerMovementRevisions } from '@/lib/bookkeeping-store';
import type { OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import { zipStream, type ZipEntry } from '@/lib/bookkeeping-zip';
import { withObservability } from '@/lib/observability';
import { CLUB_GONE, INVOICE_FILE_HEADER, INVOICE_FILE_NAME, SALES_RECORD_FLOOR } from '@/lib/sales-by-month';
import { readInvoiceFile } from '@/lib/sales-by-month-read';

export const runtime = 'nodejs';

export const GET = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const filters = parseExpenseFilters(req.nextUrl.searchParams);
  if (!filters) return NextResponse.json({ error: 'Invalid report period' }, { status: 400 });
  // Plans & pricing Part 4e + the owner ruling of 2026-11-08: ONE invoice file (invoices and credit notes, sales and GST/HST
  // figures together), for the package's dates by issue day. Started now, beside the expense reads; it never throws.
  const invoiceRead = readInvoiceFile(filters);
  let revisions;
  let ownerRevisions: OwnerMovementRevision[] = [];
  let ownerSchemaReady = false;
  let registrationDate: string | null = null;
  try {
    revisions = await listExpenseRevisions();
    registrationDate = await gstRegistrationDate();
    ownerSchemaReady = await hasOwnerMovementTable();
    if (ownerSchemaReady) ownerRevisions = await listOwnerMovementRevisions();
  } catch { return NextResponse.json({ error: 'Unable to prepare accountant package' }, { status: 500 }); }
  if (revisions.length > 1000) return NextResponse.json({ error: 'Expense package needs pagination before more records can be included' }, { status: 503 });
  if (ownerRevisions.length > 1000) return NextResponse.json({ error: 'Owner transfer package needs pagination before more records can be included' }, { status: 503 });
  const selected = selectExpenseRevisions(revisions, filters, registrationDate);
  const selectedOwners = selectOwnerMovementRevisions(ownerRevisions, filters, selected);
  // Sales that cannot be read refuse the package: one sent without its sales would say less than its scope note claims.
  const invoiceFile = await invoiceRead;
  if (invoiceFile.state === 'failed') return NextResponse.json({ error: 'Your sales could not be read; the package was not created. Try again.' }, { status: 503 });
  const invoiceRows = invoiceFile.state === 'read' ? invoiceFile.rows.length - 1 : 0;
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
    { name: 'expenses.csv', load: async () => encoder.encode(expenseCsv(selected, filters, registrationDate)) },
    { name: 'owner-transfers.csv', load: async () => encoder.encode(ownerMovementCsv(selectedOwners)) },
    { name: INVOICE_FILE_NAME, load: async () => encoder.encode(packageCsv(invoiceFile.state === 'read' ? invoiceFile.rows : [INVOICE_FILE_HEADER])) },
    { name: 'package-scope.txt', load: async () => encoder.encode([
      'FieldLogicHQ private proprietor bookkeeping package',
      `Expense revisions: ${selected.length}; owner transfer revisions: ${selectedOwners.length}; receipt files: ${documents.size}; invoice and credit note rows: ${invoiceRows}.`,
      `Period: ${filters.from || 'any start'} to ${filters.to || 'any end'}. Expenses use incurred date; owner transfers use transfer date.`,
      invoiceFile.state === 'read'
        ? `${INVOICE_FILE_NAME}: ${invoiceFile.live ? 'live' : 'TEST-MODE'} sales, ${invoiceFile.period.from} to ${invoiceFile.period.to} (Ontario days). One row per invoice issued, paid, voided or written off in those dates ("Listed for" says which) and one per credit note issued in them, with its invoice number. Amounts in the bill's own currency, in CAD at the Bank of Canada rate on file, and GST/HST as the return values it. The buyer is the club's name; an individual is "Coach". No address is included. "Before GST/HST registration" uses the registration date on file: ${invoiceFile.registration.state === 'set' ? invoiceFile.registration.date : invoiceFile.registration.state === 'unset' ? 'none recorded' : 'it could not be read, so no bill is marked'} (a changeable setting; a granted backdate changes this column). "Status" is each bill's status today, not at the end of these dates. A club deleted since it was billed reads "${CLUB_GONE}".${invoiceFile.period.from < SALES_RECORD_FLOOR ? ` Our sales record starts ${SALES_RECORD_FLOOR}: nothing before it is in this file.` : ''}${invoiceFile.clubNamesRead ? '' : ' The clubs\u2019 names could not be read just now, so club buyers read "Club".'}`
        : `${INVOICE_FILE_NAME} has a header only: the chosen period ends before ${SALES_RECORD_FLOOR}, when our sales record starts.`,
      'Legacy expense dates with unknown meaning may appear outside the selected period and are labelled in expenses.csv.',
      `Expense status: ${filters.status ?? 'all'}; review: ${filters.review}${filters.taxType ? `; tax type: ${filters.taxType}` : ''}.`,
      'Expense filters apply to expenses.csv. If an expense category, supplier, payment source, tax type, search, review or status filter narrows the view, owner-transfers.csv includes only reimbursements linked to those expenses.',
      ownerSchemaReady ? 'Owner transfer history is included where records match the scope.' : 'Owner transfer storage is not present in this environment; owner-transfers.csv has a header only.',
      'Bank statements, payouts and bank reconciliation are not in this package; sales and credit notes are. Stripe’s fees to us are included only as the monthly expenses entered from Stripe’s statement (expenses.csv).',
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
    const lines: unknown[][] = [['expense_id', 'revision', 'original_receipt_name', 'package_file', 'sha256', 'content_type']];
    for (const row of selected) {
      const path = row.receipt_path;
      const document = path ? documents.get(path) : null;
      lines.push([
        row.expense_id, row.revision, row.receipt_name,
        document?.filename ?? '', path ? hashes.get(path) : '', document?.contentType ?? '',
      ]);
    }
    return encoder.encode(packageCsv(lines));
  } });
  return new Response(zipStream(entries), { headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="fieldlogichq-accountant-package.zip"',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}, { route: '/api/platform-admin/bookkeeping/package' });
