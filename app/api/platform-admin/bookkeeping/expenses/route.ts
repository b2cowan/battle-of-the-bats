import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { CONVERSION_SOURCES, currentExpenses, expenseConversionRate, hasConfirmedDates, hasUnsetTaxType, isConversionSource, isExpenseDate, isRecordId, MAX_RECEIPT_BYTES, MAX_SUPPLIER_TAX_NUMBER, parseCents, RECEIPT_EMPTY_MESSAGE, RECEIPT_MESSAGE, RECEIPT_NAME_MESSAGE, redactExpenseRevision, redactExpenseRevisions, validateExpenseFields, validateExpenseTaxFields, type ExpenseRevision, type ExpenseTaxFields, type PaymentSource, type TaxStatus } from '@/lib/bookkeeping-expenses';
import { expenseCredit } from '@/lib/bookkeeping-gst';
import { currentOwnerMovements } from '@/lib/bookkeeping-owner-movements';
import { deleteReceipt, gstRegistrationDate, hasExpenseConversionColumns, hasExpenseDateColumns, hasExpenseTaxColumn, hasGstTaxSchema, hasOwnerMovementTable, insertExpenseRevision, latestExpenseRevision, listExpenseRevisions, listOwnerMovementRevisions, putReceipt } from '@/lib/bookkeeping-store';
import { withObservability } from '@/lib/observability';
import { expenseVoidMatches } from '@/lib/bookkeeping-void';

const STORAGE_UPDATING = 'Expense storage is being updated; try again after the upgrade';

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
    const revisions = redactExpenseRevisions(rows);
    const expenses = currentExpenses(revisions);
    const registrationDate = await gstRegistrationDate();
    // Worked out here on every read, never stored: a change of registration date re-works every credit.
    const credits = Object.fromEntries(expenses.filter(row => !row.void_reason).map(row => [row.expense_id, expenseCredit(row, registrationDate)]));
    return NextResponse.json({ expenses, revisions, credits, registrationDate, dateSchemaReady: await hasExpenseDateColumns(), taxSchemaReady: await hasExpenseTaxColumn(),
      conversionSchemaReady: await hasExpenseConversionColumns(), gstSchemaReady: await hasGstTaxSchema() }, { headers: { 'Cache-Control': 'no-store' } });
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

  // A void is its own operation. Compare BEFORE ordinary form validation: old unknown values
  // must survive, and no replacement receipt may be uploaded as part of a void.
  if (form.has('voidReason')) {
    if (!previous) return NextResponse.json({ error: 'Save an expense before voiding it' }, { status: 400 });
    if (previous.void_reason) return NextResponse.json({ error: 'A voided expense cannot be changed' }, { status: 409 });
    if (!expenseVoidMatches(previous, form)) return NextResponse.json({ error: 'A void must keep the saved expense values unchanged. Reload the record and try again.' }, { status: 409 });
    const reason = textField(form, 'voidReason', 500);
    if (!reason) return NextResponse.json({ field: 'voidReason', error: 'Say why this expense should leave the report.' }, { status: 400 });
    try {
      if (!await hasGstTaxSchema()) return NextResponse.json({ error: STORAGE_UPDATING }, { status: 503 });
      if (await activeReimbursementCents(previous.expense_id)) return NextResponse.json({ error: 'Void or correct the linked reimbursement before changing this personal expense' }, { status: 409 });
      // The spread carries the saved tax lines and every 4a field into the void revision unchanged.
      const inserted = await insertExpenseRevision({ ...previous, revision: previous.revision + 1,
        change_reason: reason, void_reason: reason, created_by: gate.auth!.user.id });
      return NextResponse.json({ expense: redactExpenseRevision(inserted) }, { status: 201 });
    } catch (error) {
      const conflict = error && typeof error === 'object' && 'code' in error && error.code === '23505';
      return NextResponse.json({ error: conflict ? 'Expense changed; reload before saving' : 'Unable to void expense' }, { status: conflict ? 409 : 503 });
    }
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
  // GST/HST Stage 4a: a post that answers "Tax on this receipt" carries the whole tax section. One without it is the
  // form from before 4a: it still saves (its revision reads through the legacy mapping), but it may not overwrite
  // an expense that already holds 4a tax details, because it would drop them.
  const gstPost = form.has('taxAnswer');
  if (!gstPost && previous?.tax_answer) return NextResponse.json({ error: 'This expense has newer tax details. Reload the page and try again.' }, { status: 409 });
  const taxAnswer = textField(form, 'taxAnswer', 10);
  const refusal = validateExpenseFields({
    incurredDate, paidDate, voidingLegacy, supplier, category, businessPurpose, originalCurrency, originalCents, cadCents, taxCents,
    taxAmountKnown: gstPost ? String(taxAnswer !== 'unknown') : taxAmountKnown,
    taxStatus, businessUse, paymentSource, conversionNote, conversionSource, hasConversionNote: form.has('conversionNote'),
    notes, hasNotes: form.has('notes'), isCorrection: Boolean(previous), changeReason, isVoid: form.has('voidReason'), voidReason,
  });
  if (refusal) return NextResponse.json(refusal, { status: 400 });
  let tax: ExpenseTaxFields | null = null;
  if (gstPost) {
    // Any credit figure the client sends is never read: the credit is worked out on read, and never stored.
    const checked = validateExpenseTaxFields({
      taxAnswer, taxLines: textField(form, 'taxLines', 20000), taxCents: taxCents!,
      supplierTaxNumber: textField(form, 'supplierTaxNumber', MAX_SUPPLIER_TAX_NUMBER), hasSupplierTaxNumber: form.has('supplierTaxNumber'),
      // Generous limits, so an unexpected value is refused as unexpected instead of read as absent.
      supplierRegistration: textField(form, 'supplierRegistration', 200), purchaseKind: textField(form, 'purchaseKind', 200),
      numberUnobtainable: textField(form, 'numberUnobtainable', 200),
      allowUnsetType: Boolean(previous && hasUnsetTaxType(previous)),
    });
    if (!('value' in checked)) return NextResponse.json(checked, { status: 400 });
    tax = checked.value;
  }
  if (previous?.void_reason) return NextResponse.json({ error: 'A voided expense cannot be changed' }, { status: 409 });
  let registrationDate: string | null;
  try {
    if (!await hasExpenseDateColumns() || !await hasExpenseTaxColumn() || !await hasExpenseConversionColumns() || !await hasGstTaxSchema()) return NextResponse.json({ error: STORAGE_UPDATING }, { status: 503 });
    registrationDate = await gstRegistrationDate();
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
    // A pre-4a post stores NULL in every 4a column: its revision reads through the legacy mapping.
    tax_answer: null, tax_lines: [], supplier_tax_number: null, supplier_registration: null, purchase_kind: null, number_unobtainable: null,
    ...tax,
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
    return NextResponse.json({ expense: redactExpenseRevision(inserted), credit: expenseCredit(inserted, registrationDate) }, { status: 201 });
  } catch (error) {
    if (file && receiptPath) await deleteReceipt(receiptPath).catch(() => undefined);
    const duplicate = error && typeof error === 'object' && 'code' in error && error.code === '23505';
    return NextResponse.json({ error: duplicate ? 'Expense changed; reload before saving' : 'Unable to save expense' }, { status: duplicate ? 409 : 500 });
  }
}, { route: '/api/platform-admin/bookkeeping/expenses' });
