import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { currentExpenses, hasValidConversionEvidence, isExpenseDate, parseCents, redactExpenseRevision, type ExpenseRevision, type PaymentSource, type TaxStatus } from '@/lib/bookkeeping-expenses';
import { deleteExpenseRevisions, deleteReceipt, insertExpenseRevision, latestExpenseRevision, listExpenseRevisions, putReceipt } from '@/lib/bookkeeping-store';
import { withObservability } from '@/lib/observability';

const MAX_FILE = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES: PaymentSource[] = ['business_bank', 'business_card', 'personal', 'other'];
const TAX: TaxStatus[] = ['pending', 'none', 'reviewed'];

function textField(form: FormData, key: string, max: number): string | null {
  const raw = form.get(key);
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value.length <= max ? value : null;
}

function validFile(file: File, bytes: Uint8Array): boolean {
  if (file.type === 'application/pdf') return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return false;
}

export const GET = withObservability(async () => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  try {
    const rows = await listExpenseRevisions();
    if (rows.length > 1000) return NextResponse.json({ error: 'Expense register needs pagination before more records can be shown' }, { status: 503 });
    const revisions = rows.map(redactExpenseRevision);
    return NextResponse.json({ expenses: currentExpenses(revisions), revisions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load expenses' }, { status: 500 });
  }
}, { route: '/api/platform-admin/bookkeeping/expenses' });

export const DELETE = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const origin = req.headers.get('origin');
  try {
    if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const expenseId = req.nextUrl.searchParams.get('expenseId') ?? '';
  const revisionInput = req.nextUrl.searchParams.get('expectedRevision') ?? '';
  const expectedRevision = Number(revisionInput);
  if (!UUID.test(expenseId) || !/^\d+$/.test(revisionInput) || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    return NextResponse.json({ error: 'Invalid expense reference' }, { status: 400 });
  }

  try {
    const previous = await latestExpenseRevision(expenseId);
    if (!previous) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    if (previous.revision !== expectedRevision) return NextResponse.json({ error: 'Expense changed; reload before deleting' }, { status: 409 });

    const receiptPaths = await deleteExpenseRevisions(expenseId, expectedRevision);
    if (!receiptPaths) return NextResponse.json({ error: 'Expense changed; reload before deleting' }, { status: 409 });
    const cleanup = await Promise.allSettled(receiptPaths.map(deleteReceipt));
    return NextResponse.json({ deleted: true, receiptCleanupIncomplete: cleanup.some(result => result.status === 'rejected') });
  } catch {
    return NextResponse.json({ error: 'Unable to delete expense' }, { status: 500 });
  }
}, { route: '/api/platform-admin/bookkeeping/expenses' });

export const POST = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const origin = req.headers.get('origin');
  try {
    if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Invalid form' }, { status: 400 }); }
  const expenseIdInput = textField(form, 'expenseId', 36);
  const expectedRevision = Number(textField(form, 'expectedRevision', 10) ?? '0');
  if (expenseIdInput && (!UUID.test(expenseIdInput) || !Number.isInteger(expectedRevision) || expectedRevision < 1)) {
    return NextResponse.json({ error: 'Invalid correction reference' }, { status: 400 });
  }
  let previous: ExpenseRevision | null = null;
  if (expenseIdInput) {
    try { previous = await latestExpenseRevision(expenseIdInput); }
    catch { return NextResponse.json({ error: 'Unable to load expense' }, { status: 500 }); }
    if (!previous) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    if (previous.revision !== expectedRevision) return NextResponse.json({ error: 'Expense changed; reload before saving' }, { status: 409 });
  }

  const expenseDate = textField(form, 'expenseDate', 10);
  const supplier = textField(form, 'supplier', 160);
  const category = textField(form, 'category', 80);
  const businessPurpose = textField(form, 'businessPurpose', 500);
  const originalCurrency = textField(form, 'originalCurrency', 3);
  const originalCents = parseCents(form.get('originalAmount'));
  const cadCents = parseCents(form.get('cadAmount'));
  const taxCents = parseCents(form.get('taxCadAmount'));
  const taxStatus = textField(form, 'taxStatus', 20);
  const businessUse = Number(textField(form, 'businessUsePercent', 3));
  const paymentSource = textField(form, 'paymentSource', 20);
  const conversionNote = textField(form, 'conversionNote', 500);
  const notes = textField(form, 'notes', 2000);
  const changeReason = textField(form, 'changeReason', 500);
  const voidReason = textField(form, 'voidReason', 500);
  if (!isExpenseDate(expenseDate) || !supplier || !category || !businessPurpose ||
    !['CAD', 'USD'].includes(originalCurrency ?? '') || !originalCents || !cadCents || taxCents === null || taxCents > cadCents ||
    !TAX.includes(taxStatus as TaxStatus) || !SOURCES.includes(paymentSource as PaymentSource) ||
    !Number.isInteger(businessUse) || businessUse < 1 || businessUse > 100 ||
    (originalCurrency === 'USD' && !hasValidConversionEvidence(conversionNote)) ||
    (originalCurrency === 'CAD' && originalCents !== cadCents) ||
    (taxStatus === 'none' && taxCents !== 0) ||
    (form.has('voidReason') && !voidReason) || (previous && !changeReason) ||
    (form.has('notes') && notes === null) || (form.has('conversionNote') && conversionNote === null)) {
    return NextResponse.json({ error: 'Check the expense amounts and required fields' }, { status: 400 });
  }
  if (previous?.void_reason) return NextResponse.json({ error: 'A voided expense cannot be changed' }, { status: 409 });

  const file = form.get('receipt');
  if (file !== null && !(file instanceof File)) return NextResponse.json({ error: 'Invalid receipt' }, { status: 400 });
  if (file && (file.size === 0 || file.size > MAX_FILE || file.name.length > 180)) {
    return NextResponse.json({ error: 'Receipt must be a PDF, JPEG or PNG under 10 MB' }, { status: 400 });
  }
  const expenseId = expenseIdInput ?? crypto.randomUUID();
  const revision = previous ? previous.revision + 1 : 1;
  let receiptPath = previous?.receipt_path ?? null;
  let receiptName = previous?.receipt_name ?? null;
  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validFile(file, bytes)) return NextResponse.json({ error: 'Receipt must be a valid PDF, JPEG or PNG' }, { status: 400 });
    receiptPath = `${expenseId}/${crypto.randomUUID()}`;
    receiptName = file.name;
    try { await putReceipt(receiptPath, bytes, file.type); }
    catch { return NextResponse.json({ error: 'Unable to store receipt' }, { status: 500 }); }
  }
  const row = {
    expense_id: expenseId, revision, expense_date: expenseDate, supplier, category,
    business_purpose: businessPurpose, original_currency: originalCurrency as ExpenseRevision['original_currency'],
    original_cents: originalCents, cad_cents: cadCents, tax_cad_cents: taxCents,
    tax_status: taxStatus as TaxStatus, business_use_percent: businessUse, payment_source: paymentSource as PaymentSource,
    conversion_note: conversionNote || null, notes: notes || null, change_reason: changeReason || null,
    receipt_path: receiptPath, receipt_name: receiptName, void_reason: voidReason || null,
    created_by: gate.auth!.user.id,
  };
  try {
    const inserted = await insertExpenseRevision(row);
    return NextResponse.json({ expense: redactExpenseRevision(inserted) }, { status: 201 });
  } catch (error) {
    if (file && receiptPath) await deleteReceipt(receiptPath).catch(() => undefined);
    const duplicate = error && typeof error === 'object' && 'code' in error && error.code === '23505';
    return NextResponse.json({ error: duplicate ? 'Expense changed; reload before saving' : 'Unable to save expense' }, { status: duplicate ? 409 : 500 });
  }
}, { route: '/api/platform-admin/bookkeeping/expenses' });
