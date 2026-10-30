import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { CONVERSION_SOURCES, currentExpenses, expenseConversionRate, hasConfirmedDates, isConversionSource, isExpenseDate, isRecordId, MAX_RECEIPT_BYTES, parseCents, RECEIPT_EMPTY_MESSAGE, RECEIPT_MESSAGE, RECEIPT_NAME_MESSAGE, redactExpenseRevision, validateExpenseFields, type ExpenseRevision, type PaymentSource, type TaxStatus } from '@/lib/bookkeeping-expenses';
import { currentOwnerMovements } from '@/lib/bookkeeping-owner-movements';
import { deleteReceipt, hasExpenseConversionColumns, hasExpenseDateColumns, hasExpenseTaxColumn, hasOwnerMovementTable, insertExpenseRevision, latestExpenseRevision, listExpenseRevisions, listOwnerMovementRevisions, putReceipt } from '@/lib/bookkeeping-store';
import { withObservability } from '@/lib/observability';

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

async function activeReimbursementCents(expenseId: string): Promise<number> {
  if (!await hasOwnerMovementTable()) return 0;
  const revisions = await listOwnerMovementRevisions();
  if (revisions.length > 1000) throw new Error('Owner movement list needs pagination');
  return currentOwnerMovements(revisions).filter(row => !row.void_reason && row.movement_kind === 'expense_reimbursement' && row.linked_expense_id === expenseId)
    .reduce((total, row) => total + row.amount_cents, 0);
}

export const GET = withObservability(async () => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  try {
    const rows = await listExpenseRevisions();
    if (rows.length > 1000) return NextResponse.json({ error: 'Expense register needs pagination before more records can be shown' }, { status: 503 });
    const revisions = rows.map(redactExpenseRevision);
    return NextResponse.json({ expenses: currentExpenses(revisions), revisions, dateSchemaReady: await hasExpenseDateColumns(), taxSchemaReady: await hasExpenseTaxColumn(), conversionSchemaReady: await hasExpenseConversionColumns() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load expenses' }, { status: 500 });
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
  try { form = await req.formData(); } catch {
    // The request proxy buffers only the first 10 MB of a body, so an oversized receipt arrives cut off and the form
    // cannot be parsed. Say so in the receipt's own words rather than "Invalid form".
    const tooLarge = Number(req.headers.get('content-length') ?? 0) > MAX_RECEIPT_BYTES;
    return NextResponse.json(tooLarge ? { field: 'receipt', error: RECEIPT_MESSAGE }
      : { error: 'This form could not be read. Reload the page and try again.' }, { status: tooLarge ? 413 : 400 });
  }
  const expenseIdInput = textField(form, 'expenseId', 36);
  const expectedRevision = Number(textField(form, 'expectedRevision', 10) ?? '0');
  if (expenseIdInput && (!isRecordId(expenseIdInput) || !Number.isInteger(expectedRevision) || expectedRevision < 1)) {
    return NextResponse.json({ error: 'Invalid correction reference' }, { status: 400 });
  }
  let previous: ExpenseRevision | null = null;
  if (expenseIdInput) {
    try { previous = await latestExpenseRevision(expenseIdInput); }
    catch { return NextResponse.json({ error: 'Unable to load expense' }, { status: 500 }); }
    if (!previous) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    if (previous.revision !== expectedRevision) return NextResponse.json({ error: 'Expense changed; reload before saving' }, { status: 409 });
  }

  const incurredDate = textField(form, 'incurredDate', 10);
  const paidDate = textField(form, 'paidDate', 10);
  const supplier = textField(form, 'supplier', 160);
  const category = textField(form, 'category', 80);
  const businessPurpose = textField(form, 'businessPurpose', 500);
  const originalCurrency = textField(form, 'originalCurrency', 3);
  const originalCents = parseCents(form.get('originalAmount'));
  const cadCents = parseCents(form.get('cadAmount'));
  const taxCents = parseCents(form.get('taxCadAmount'));
  const taxAmountKnown = textField(form, 'taxAmountKnown', 5);
  const taxStatus = textField(form, 'taxStatus', 20);
  const businessUse = Number(textField(form, 'businessUsePercent', 3));
  const paymentSource = textField(form, 'paymentSource', 20);
  const conversionNote = textField(form, 'conversionNote', 500);
  const conversionSource = textField(form, 'conversionSource', 40);
  const notes = textField(form, 'notes', 2000);
  const changeReason = textField(form, 'changeReason', 500);
  const voidReason = textField(form, 'voidReason', 500);
  const datesConfirmed = isExpenseDate(incurredDate) && isExpenseDate(paidDate);
  const voidingLegacy = Boolean(previous && !hasConfirmedDates(previous) && form.has('voidReason'));
  const refusal = validateExpenseFields({
    incurredDate, paidDate, voidingLegacy, supplier, category, businessPurpose, originalCurrency, originalCents, cadCents, taxCents,
    taxAmountKnown, taxStatus, businessUse, paymentSource, conversionNote, conversionSource, hasConversionNote: form.has('conversionNote'),
    notes, hasNotes: form.has('notes'), isCorrection: Boolean(previous), changeReason, isVoid: form.has('voidReason'), voidReason,
  });
  if (refusal) return NextResponse.json(refusal, { status: 400 });
  if (previous?.void_reason) return NextResponse.json({ error: 'A voided expense cannot be changed' }, { status: 409 });
  try {
    if (!await hasExpenseDateColumns() || !await hasExpenseTaxColumn() || !await hasExpenseConversionColumns()) return NextResponse.json({ error: 'Expense storage is being updated; try again after the upgrade' }, { status: 503 });
  } catch {
    return NextResponse.json({ error: 'Unable to check expense date storage' }, { status: 503 });
  }
  if (previous) {
    try {
      const reimbursed = await activeReimbursementCents(expenseIdInput!);
      const correctedBusinessAmount = Math.floor((cadCents! * businessUse + 50) / 100);
      if (reimbursed && (paymentSource !== 'personal' || voidReason || reimbursed > correctedBusinessAmount)) {
        return NextResponse.json({ error: 'Void or correct the linked reimbursement before changing this personal expense' }, { status: 409 });
      }
    } catch { return NextResponse.json({ error: 'Unable to check linked reimbursements' }, { status: 503 }); }
  }

  const file = form.get('receipt');
  if (file !== null && !(file instanceof File)) return NextResponse.json({ field: 'receipt', error: RECEIPT_MESSAGE }, { status: 400 });
  if (file && (file.size === 0 || file.size > MAX_RECEIPT_BYTES || file.name.length > 180)) {
    const error = file.size === 0 ? RECEIPT_EMPTY_MESSAGE : file.size > MAX_RECEIPT_BYTES ? RECEIPT_MESSAGE : RECEIPT_NAME_MESSAGE;
    return NextResponse.json({ field: 'receipt', error }, { status: 400 });
  }
  const expenseId = expenseIdInput ?? crypto.randomUUID();
  const revision = previous ? previous.revision + 1 : 1;
  let receiptPath = previous?.receipt_path ?? null;
  let receiptName = previous?.receipt_name ?? null;
  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validFile(file, bytes)) return NextResponse.json({ field: 'receipt', error: RECEIPT_MESSAGE }, { status: 400 });
    receiptPath = `${expenseId}/${crypto.randomUUID()}`;
    receiptName = file.name;
    try { await putReceipt(receiptPath, bytes, file.type); }
    catch { return NextResponse.json({ error: 'Unable to store receipt' }, { status: 500 }); }
  }
  const row = {
    expense_id: expenseId, revision,
    expense_date: datesConfirmed ? incurredDate! : previous!.expense_date,
    incurred_date: datesConfirmed ? incurredDate! : null,
    paid_date: datesConfirmed ? paidDate! : null,
    // validateExpenseFields has refused every missing value above.
    supplier: supplier!, category: category!,
    business_purpose: businessPurpose!, original_currency: originalCurrency as ExpenseRevision['original_currency'],
    original_cents: originalCents!, cad_cents: cadCents!, tax_cad_cents: taxCents!,
    tax_amount_known: taxAmountKnown === 'true',
    tax_status: taxStatus as TaxStatus, business_use_percent: businessUse, payment_source: paymentSource as PaymentSource,
    conversion_source: originalCurrency === 'USD' && isConversionSource(conversionSource) ? conversionSource : null,
    conversion_rate: originalCurrency === 'USD' ? expenseConversionRate(originalCents!, cadCents!) : null,
    conversion_note: originalCurrency === 'USD'
      ? conversionNote || (isConversionSource(conversionSource) ? CONVERSION_SOURCES[conversionSource] : previous?.conversion_note ?? null)
      : null,
    notes: notes || null, change_reason: changeReason || null,
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
