import { NextRequest, NextResponse } from 'next/server';
import { requireBookkeepingApi } from '@/lib/bookkeeping-access';
import { businessCents, currentExpenses, isExpenseDate, parseCents } from '@/lib/bookkeeping-expenses';
import { currentOwnerMovements, type OwnerMovementKind } from '@/lib/bookkeeping-owner-movements';
import { hasOwnerMovementTable, insertOwnerMovementRevision, latestOwnerMovementRevision, listExpenseRevisions, listOwnerMovementRevisions } from '@/lib/bookkeeping-store';
import { withObservability } from '@/lib/observability';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const KINDS: OwnerMovementKind[] = ['owner_contribution', 'owner_draw', 'expense_reimbursement'];
const clean = (value: unknown, max: number) => typeof value === 'string' && value.trim().length <= max ? value.trim() : null;

export const GET = withObservability(async () => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  try {
    if (!await hasOwnerMovementTable()) return NextResponse.json({ revisions: [], movements: [], schemaReady: false }, { headers: { 'Cache-Control': 'no-store' } });
    const rows = await listOwnerMovementRevisions();
    if (rows.length > 1000) return NextResponse.json({ error: 'Owner movement list needs pagination' }, { status: 503 });
    return NextResponse.json({ revisions: rows, movements: currentOwnerMovements(rows), schemaReady: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load owner movements' }, { status: 500 });
  }
}, { route: '/api/platform-admin/bookkeeping/owner-movements' });

export const POST = withObservability(async (req: NextRequest) => {
  const gate = await requireBookkeepingApi();
  if (gate.response) return gate.response;
  const origin = req.headers.get('origin');
  try {
    if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
    input = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: 'Invalid owner movement' }, { status: 400 }); }
  const movementId = clean(input.movementId, 36);
  const movementDate = clean(input.movementDate, 10);
  const movementKind = clean(input.movementKind, 30);
  const amountCents = parseCents(input.amount);
  const linkedExpenseId = clean(input.linkedExpenseId, 36) || null;
  const sourceReference = clean(input.sourceReference, 160) || null;
  const note = clean(input.note, 1000) || null;
  const changeReason = clean(input.changeReason, 500) || null;
  const voidReason = clean(input.voidReason, 500) || null;
  const expectedRevision = input.expectedRevision === undefined ? null : Number(input.expectedRevision);
  if (!movementId || !UUID.test(movementId) || !isExpenseDate(movementDate) || !KINDS.includes(movementKind as OwnerMovementKind) ||
    !amountCents || (input.sourceReference != null && sourceReference === null && input.sourceReference !== '') ||
    (input.note != null && note === null && input.note !== '') ||
    (linkedExpenseId !== null && !UUID.test(linkedExpenseId)) ||
    (movementKind === 'expense_reimbursement') !== (linkedExpenseId !== null) ||
    (expectedRevision !== null && (!Number.isInteger(expectedRevision) || expectedRevision < 1)) ||
    (input.voidReason !== undefined && !voidReason)) {
    return NextResponse.json({ error: 'Check the date, amount and required movement details' }, { status: 400 });
  }
  try {
    if (!await hasOwnerMovementTable()) return NextResponse.json({ error: 'Owner movement storage is being prepared' }, { status: 503 });
    const previous = await latestOwnerMovementRevision(movementId);
    if (previous && expectedRevision === null) {
      if (previous.revision === 1 && previous.movement_date === movementDate && previous.movement_kind === movementKind &&
        previous.amount_cents === amountCents && previous.linked_expense_id === linkedExpenseId &&
        previous.source_reference === sourceReference && previous.note === note && !previous.void_reason) {
        return NextResponse.json({ movement: previous, repeated: true });
      }
      return NextResponse.json({ error: 'This movement was already saved; reload before changing it' }, { status: 409 });
    }
    if (!previous && expectedRevision !== null) return NextResponse.json({ error: 'Movement not found' }, { status: 404 });
    if (!previous && voidReason) return NextResponse.json({ error: 'Save a transfer before voiding it' }, { status: 400 });
    if (previous?.void_reason) return NextResponse.json({ error: 'A voided movement cannot be changed' }, { status: 409 });
    if (previous && previous.revision !== expectedRevision) return NextResponse.json({ error: 'Movement changed; reload before saving' }, { status: 409 });
    if (previous && !changeReason) return NextResponse.json({ error: 'Say why this movement changed' }, { status: 400 });
    if (movementKind === 'expense_reimbursement' && !voidReason) {
      const expenses = currentExpenses(await listExpenseRevisions());
      const expense = expenses.find(row => row.expense_id === linkedExpenseId);
      if (!expense || expense.void_reason || expense.payment_source !== 'personal') {
        return NextResponse.json({ error: 'Choose an active expense paid personally' }, { status: 400 });
      }
      const movementRevisions = await listOwnerMovementRevisions();
      if (movementRevisions.length > 1000) return NextResponse.json({ error: 'Owner movement list needs pagination' }, { status: 503 });
      const movements = currentOwnerMovements(movementRevisions);
      const alreadyReimbursed = movements.filter(row => !row.void_reason && row.movement_kind === 'expense_reimbursement' &&
        row.linked_expense_id === linkedExpenseId && row.movement_id !== movementId).reduce((sum, row) => sum + row.amount_cents, 0);
      if (alreadyReimbursed + amountCents > businessCents(expense)) {
        return NextResponse.json({ error: 'Reimbursements for this expense exceed its recorded business amount' }, { status: 400 });
      }
    }
    const row = await insertOwnerMovementRevision({
      movement_id: movementId, revision: previous ? previous.revision + 1 : 1,
      movement_date: movementDate, movement_kind: movementKind as OwnerMovementKind,
      amount_cents: amountCents, linked_expense_id: linkedExpenseId,
      source_reference: sourceReference, note, change_reason: changeReason,
      void_reason: voidReason, created_by: gate.auth!.user.id,
    });
    return NextResponse.json({ movement: row }, { status: 201 });
  } catch (error) {
    const duplicate = error && typeof error === 'object' && 'code' in error && error.code === '23505';
    return NextResponse.json({ error: duplicate ? 'Movement changed; reload before saving' : 'Unable to save owner movement' }, { status: duplicate ? 409 : 500 });
  }
}, { route: '/api/platform-admin/bookkeeping/owner-movements' });
